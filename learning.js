import { EVIDENCE_STATES } from './experiments.js';

export const LEARNED_RULE_SCOPES = Object.freeze([
  'targeting',
  'engagement',
  'health',
  'content',
  'timing',
  'format',
  'topic',
]);

export const LEARNED_RULE_STATUSES = Object.freeze(['suggested', 'accepted', 'retired']);
export const LEARNING_EVIDENCE_STATES = EVIDENCE_STATES;

export const LEARNED_ADJUSTMENT_BOUNDS = Object.freeze({
  target_score_component: 10,
  engage_priority: 10,
  saturation_pressure: 10,
  health_watch_modifier: 8,
  reach_potential: 8,
  follow_potential: 8,
  conversation_potential: 8,
  scheduler_timing_preference: 15,
  content_preference: 10,
  format_preference: 10,
  topic_preference: 10,
});

const EVIDENCE_RANK = new Map(EVIDENCE_STATES.map((state, index) => [state, index]));
const LOWER_IS_BETTER_METRICS = new Set(['top_target_concentration']);
const DISALLOWED_PRIMARY_METRICS = new Set(['likes', 'like_count', 'raw_likes']);
const TARGET_SCORE_COMPONENTS = new Set(['topicFit', 'audienceOverlap', 'conversationQuality', 'replyVisibility', 'relationshipPotential']);
const EXPLICIT_SIGN_ADJUSTMENT_TARGETS = new Set(['saturation_pressure', 'health_watch_modifier']);
const ADJUSTMENT_SCOPES = Object.freeze({
  target_score_component: new Set(['targeting']),
  engage_priority: new Set(['engagement', 'health']),
  saturation_pressure: new Set(['health']),
  health_watch_modifier: new Set(['health']),
  reach_potential: new Set(['content', 'topic']),
  follow_potential: new Set(['content', 'topic']),
  conversation_potential: new Set(['content', 'topic']),
  scheduler_timing_preference: new Set(['timing']),
  content_preference: new Set(['content']),
  format_preference: new Set(['format']),
  topic_preference: new Set(['topic']),
});
const PROTECTED_BOUNDARY_FIELDS = Object.freeze([
  ['hard_gate_failed', (context) => context.hardGatePassed === false || context.hardGateFailed === true],
  ['expired', (context) => context.expired === true],
  ['human_approval_missing', (context) => context.humanApprovalRequired === true && context.humanApproved !== true],
  ['manual_route_or_schedule', (context) => context.manualOverride === true || context.manualRoute === true || context.manualScheduleOverride === true],
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(Number(value || 0) * scale) / scale;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function normalizedString(value) {
  return String(value ?? '').trim().toLowerCase();
}

function sortedUnique(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function evidenceState(value) {
  const state = normalizedString(value);
  return EVIDENCE_RANK.has(state) ? state : 'insufficient';
}

function downgradeState(state, ceiling) {
  return EVIDENCE_RANK.get(state) > EVIDENCE_RANK.get(ceiling) ? ceiling : state;
}

function normalizedCompletedByVariant(input = {}) {
  const supplied = input.completedByVariant ?? input.completed_by_variant;
  if (Array.isArray(supplied)) return supplied.map((value) => Math.max(0, Math.floor(Number(value) || 0)));
  if (!isPlainObject(supplied)) return {};
  return Object.fromEntries(Object.keys(supplied).sort().map((key) => [key, Math.max(0, Math.floor(Number(supplied[key]) || 0))]));
}

function completedCounts(input = {}) {
  const completed = normalizedCompletedByVariant(input);
  return Array.isArray(completed) ? completed : Object.values(completed);
}

function sampleSizeFrom(input = {}) {
  const supplied = finiteNumber(input.sampleSize ?? input.sample_size);
  if (supplied != null) return Math.max(0, Math.floor(supplied));
  const counts = completedCounts(input);
  return counts.length ? counts.reduce((sum, count) => sum + count, 0) : 0;
}

function normalizeSupport(input = {}) {
  const support = isPlainObject(input.support) ? input.support : {};
  const periods = sortedUnique(support.periods ?? input.periods ?? []);
  const topics = sortedUnique(support.topics ?? input.topics ?? []);
  const buckets = sortedUnique(support.buckets ?? input.supportBuckets ?? input.support_buckets ?? []);
  const requiresBroadSupport = support.requiresBroadSupport === true || input.requiresBroadSupport === true;
  const broadSupportConfirmed = !requiresBroadSupport || periods.length > 1 || topics.length > 1 || buckets.length > 1;
  return { periods, topics, buckets, requiresBroadSupport, broadSupportConfirmed };
}

export function qualifyLearningEvidence(input = {}) {
  const reportedState = evidenceState(input.state ?? input.evidenceState ?? input.evidence_state);
  const sampleSize = sampleSizeFrom(input);
  const minimumSampleSizeRaw = finiteNumber(input.minimumSampleSize ?? input.minimum_sample_size);
  const minimumSampleSize = minimumSampleSizeRaw == null ? 2 : Math.max(2, Math.floor(minimumSampleSizeRaw));
  const completedByVariant = normalizedCompletedByVariant(input);
  const support = normalizeSupport(input);
  const outlierDominated = input.outlierDominated === true
    || input.outlier_dominated === true
    || input.singleViralOutlier === true
    || input.single_viral_outlier === true;

  let state = reportedState;
  const qualificationReasons = [];

  if (sampleSize < 2) {
    state = 'insufficient';
    qualificationReasons.push({ code: 'TOO_FEW_OBSERVATIONS', message: 'At least two observations are required before a learned suggestion can be emitted.' });
  } else if (outlierDominated) {
    state = downgradeState(state, 'preliminary');
    qualificationReasons.push({ code: 'OUTLIER_DOMINATED', message: 'Caller-supplied outlier evidence prevents directional/repeated qualification.' });
  }

  if (sampleSize < minimumSampleSize && EVIDENCE_RANK.get(state) >= EVIDENCE_RANK.get('directional')) {
    state = 'preliminary';
    qualificationReasons.push({ code: 'BELOW_MINIMUM_SAMPLE', message: `Sample size ${sampleSize} is below the supplied learning minimum ${minimumSampleSize}.` });
  }

  if (state === 'repeated' && !support.broadSupportConfirmed) {
    state = 'directional';
    qualificationReasons.push({
      code: 'BROAD_SUPPORT_NOT_CONFIRMED',
      message: 'Repeated evidence was supplied, but the caller-required multi-period/topic/bucket support was not demonstrated; qualify it as directional.',
    });
  }

  const suggestionEligible = EVIDENCE_RANK.get(state) >= EVIDENCE_RANK.get('preliminary');
  const acceptanceEligible = EVIDENCE_RANK.get(state) >= EVIDENCE_RANK.get('directional');
  const acceptanceReasons = [];
  if (!acceptanceEligible) {
    acceptanceReasons.push({ code: 'DIRECTIONAL_EVIDENCE_REQUIRED', message: 'Human acceptance requires directional or repeated qualified evidence.' });
  }
  if (outlierDominated) {
    acceptanceReasons.push({ code: 'OUTLIER_DOMINATED', message: 'A supplied single/outlier-dominated result cannot become an accepted learned adjustment.' });
  }

  return {
    reportedState,
    state,
    sampleSize,
    completedByVariant,
    minimumSampleSize,
    suggestionEligible,
    acceptanceEligible: acceptanceEligible && !outlierDominated,
    support,
    outlierDominated,
    qualificationReasons,
    acceptanceReasons,
    causalClaimAllowed: false,
  };
}

function normalizeComparison(input = {}, primaryMetric = '') {
  const baseline = isPlainObject(input.baseline) ? input.baseline : {};
  const comparison = isPlainObject(input.comparison) ? input.comparison : {};
  const baselineValue = finiteNumber(baseline.value ?? input.baselineValue ?? input.baseline_value);
  const comparisonValue = finiteNumber(comparison.value ?? input.comparisonValue ?? input.comparison_value);
  if (baselineValue == null || comparisonValue == null) return null;
  const higherIsBetter = input.higherIsBetter == null
    ? !LOWER_IS_BETTER_METRICS.has(primaryMetric)
    : input.higherIsBetter === true;
  const rawDifference = comparisonValue - baselineValue;
  const scale = Math.max(Math.abs(comparisonValue), Math.abs(baselineValue), 1);
  const normalizedDifference = rawDifference / scale;
  const beneficialEffect = higherIsBetter ? normalizedDifference : -normalizedDifference;
  return {
    baselineLabel: String(baseline.label ?? input.baselineLabel ?? input.baseline_label ?? 'baseline'),
    baselineValue: round(baselineValue),
    comparisonLabel: String(comparison.label ?? input.comparisonLabel ?? input.comparison_label ?? 'comparison'),
    comparisonValue: round(comparisonValue),
    rawDifference: round(rawDifference),
    normalizedDifference: round(normalizedDifference),
    beneficialEffect: round(beneficialEffect),
    higherIsBetter,
  };
}

function normalizeAdjustment(scope, input, comparison) {
  const target = String(input.adjustmentTarget ?? input.adjustment_target ?? '').trim();
  const bound = LEARNED_ADJUSTMENT_BOUNDS[target];
  if (!bound) return { error: { code: 'INVALID_ADJUSTMENT_TARGET', message: `Unsupported learned adjustment target: ${target || 'missing'}.` } };
  if (!ADJUSTMENT_SCOPES[target].has(scope)) {
    return { error: { code: 'SCOPE_ADJUSTMENT_MISMATCH', message: `${target} is not a supported adjustment for ${scope}.` } };
  }

  const component = input.adjustmentComponent == null ? null : String(input.adjustmentComponent);
  if (target === 'target_score_component' && !TARGET_SCORE_COMPONENTS.has(component)) {
    return { error: { code: 'TARGET_SCORE_COMPONENT_REQUIRED', message: 'target_score_component requires one explicit base TargetScore component.' } };
  }

  const suppliedAdjustment = finiteNumber(input.proposedAdjustment ?? input.proposed_adjustment);
  const suppliedMagnitude = finiteNumber(input.adjustmentMagnitude ?? input.adjustment_magnitude);
  if (EXPLICIT_SIGN_ADJUSTMENT_TARGETS.has(target) && suppliedAdjustment == null) {
    return { error: { code: 'SIGNED_HEALTH_ADJUSTMENT_REQUIRED', message: `${target} requires an explicit signed proposedAdjustment; metric improvement does not imply whether health pressure should rise or fall.` } };
  }
  let requested;
  if (suppliedAdjustment != null) requested = suppliedAdjustment;
  else if (suppliedMagnitude != null && comparison) requested = Math.sign(comparison.beneficialEffect) * Math.abs(suppliedMagnitude);
  else if (comparison) requested = comparison.beneficialEffect * bound;
  else return { error: { code: 'ADJUSTMENT_SIGNAL_REQUIRED', message: 'A proposed adjustment or numeric baseline/comparison is required.' } };

  return {
    target,
    component,
    bound,
    requested: round(requested),
    proposed: round(clamp(requested, -bound, bound)),
    effective: 0,
    effectiveReason: 'suggested_rules_have_zero_production_effect',
  };
}

function defaultFinding(scope, primaryMetric, comparison, sampleSize) {
  return `${scope} finding from ${sampleSize} observations: ${comparison.comparisonLabel} ${primaryMetric} ${comparison.comparisonValue} vs ${comparison.baselineLabel} ${comparison.baselineValue}.`;
}

function defaultRecommendation(adjustment) {
  const direction = adjustment.proposed > 0 ? 'increase' : adjustment.proposed < 0 ? 'decrease' : 'leave unchanged';
  const amount = Math.abs(adjustment.proposed);
  return direction === 'leave unchanged'
    ? `Leave ${adjustment.target} unchanged for matching context; the supplied comparison shows no directional advantage.`
    : `${direction[0].toUpperCase()}${direction.slice(1)} ${adjustment.target} by ${amount} for matching context while preserving the base model and hard boundaries.`;
}

function normalizeMechanismTags(input = {}) {
  return sortedUnique(input.mechanismTags ?? input.mechanism_tags ?? input.algorithmEvidenceTags ?? input.algorithm_evidence_tags ?? []);
}

function healthHardConstraintRequested(input = {}) {
  const recommendationState = normalizedString(input.recommendationState ?? input.recommendation_state ?? input.healthState ?? input.health_state);
  return input.hardConstraint === true || input.hard_constraint === true || recommendationState === 'constrained';
}

export function createLearnedRuleCandidate(input = {}) {
  const scope = normalizedString(input.scope);
  const key = String(input.key ?? '').trim();
  const primaryMetric = normalizedString(input.primaryMetric ?? input.primary_metric);
  const issues = [];

  if (!LEARNED_RULE_SCOPES.includes(scope)) issues.push({ code: 'INVALID_SCOPE', message: `Unsupported learned-rule scope: ${scope || 'missing'}.` });
  if (!key) issues.push({ code: 'KEY_REQUIRED', message: 'Learned-rule key is required.' });
  if (!primaryMetric) issues.push({ code: 'PRIMARY_METRIC_REQUIRED', message: 'A primary metric is required for learned-rule evidence.' });
  if (DISALLOWED_PRIMARY_METRICS.has(primaryMetric)) {
    issues.push({ code: 'RAW_LIKES_NOT_LEARNING_METRIC', message: 'Raw likes may be diagnostic context but cannot independently drive a learned rule.' });
  }
  if (scope === 'health' && healthHardConstraintRequested(input)) {
    issues.push({ code: 'HEALTH_HARD_CONSTRAINT_NOT_LEARNABLE', message: 'Learned health rules are WATCH-level soft adjustments only and cannot create CONSTRAINED.' });
  }

  const evidence = qualifyLearningEvidence(input.evidence ?? input);
  if (!evidence.suggestionEligible) {
    issues.push({ code: 'PRELIMINARY_EVIDENCE_REQUIRED', message: 'A suggested learned rule requires at least preliminary qualified evidence.' });
  }

  const comparison = normalizeComparison(input, primaryMetric);
  if (!comparison) {
    issues.push({ code: 'COMPARISON_REQUIRED', message: 'Numeric baseline/comparison values are required so every learned rule preserves its comparison basis.' });
  }

  const adjustment = LEARNED_RULE_SCOPES.includes(scope)
    ? normalizeAdjustment(scope, input, comparison)
    : { error: { code: 'INVALID_SCOPE', message: 'Cannot select an adjustment before scope is valid.' } };
  if (adjustment.error) issues.push(adjustment.error);

  if (issues.length) return { created: false, rule: null, issues };

  const mechanismTags = normalizeMechanismTags(input);
  const match = stableObject(isPlainObject(input.match) ? input.match : {});
  const finding = String(input.finding ?? '').trim() || defaultFinding(scope, primaryMetric, comparison, evidence.sampleSize);
  const recommendation = String(input.recommendation ?? '').trim() || defaultRecommendation(adjustment);

  const rule = {
    ruleId: `${scope}:${key}`,
    scope,
    key,
    status: 'suggested',
    match,
    finding,
    recommendation,
    primaryMetric,
    comparison,
    evidence,
    adjustment,
    acceptance: {
      eligible: evidence.acceptanceEligible,
      reasons: evidence.acceptanceReasons,
    },
    mechanismTags,
    guardrails: {
      bypassHardGates: false,
      bypassHumanApproval: false,
      bypassExpiry: false,
      bypassManualRouteOrSchedule: false,
      canCreateConstrained: false,
    },
  };

  return { created: true, rule, issues: [] };
}

export function createExperimentLearnedRuleCandidate(summary = {}, input = {}) {
  if (summary?.valid !== true) {
    return { created: false, rule: null, issues: [{ code: 'INVALID_EXPERIMENT_SUMMARY', message: 'A valid Phase-4 experiment summary is required.' }] };
  }
  const baselineLabel = String(input.baselineLabel ?? input.baseline_label ?? '').trim();
  const comparisonLabel = String(input.comparisonLabel ?? input.comparison_label ?? '').trim();
  if (!baselineLabel || !comparisonLabel || baselineLabel === comparisonLabel) {
    return { created: false, rule: null, issues: [{ code: 'EXPLICIT_COMPARISON_REQUIRED', message: 'Distinct baselineLabel and comparisonLabel are required; the learning core does not invent a control or winner.' }] };
  }
  const values = summary.primaryMetricValues || {};
  if (!Object.hasOwn(values, baselineLabel) || !Object.hasOwn(values, comparisonLabel)) {
    return { created: false, rule: null, issues: [{ code: 'COMPARISON_VARIANT_MISSING', message: 'The requested baseline/comparison labels are not present in primaryMetricValues.' }] };
  }

  return createLearnedRuleCandidate({
    ...input,
    primaryMetric: summary.primaryMetric,
    baseline: { label: baselineLabel, value: values[baselineLabel] },
    comparison: { label: comparisonLabel, value: values[comparisonLabel] },
    evidence: {
      ...(summary.evidence || {}),
      sampleSize: summary.sampleSize,
      completedByVariant: summary.completedByVariant,
      minimumSampleSize: input.minimumSampleSize ?? input.minimum_sample_size,
      outlierDominated: input.outlierDominated === true || input.outlier_dominated === true,
      singleViralOutlier: input.singleViralOutlier === true || input.single_viral_outlier === true,
      support: input.support,
      requiresBroadSupport: input.requiresBroadSupport === true,
    },
  });
}

export function generateLearnedRuleCandidates(findings = []) {
  const rules = [];
  const rejected = [];
  for (const finding of Array.isArray(findings) ? findings : []) {
    const result = createLearnedRuleCandidate(finding);
    if (result.created) rules.push(result.rule);
    else rejected.push({ scope: normalizedString(finding?.scope), key: String(finding?.key ?? ''), issues: result.issues });
  }
  rules.sort((left, right) => left.ruleId.localeCompare(right.ruleId));
  rejected.sort((left, right) => `${left.scope}:${left.key}`.localeCompare(`${right.scope}:${right.key}`));
  return { rules, rejected };
}

function proposedAdjustmentOf(rule = {}) {
  if (isPlainObject(rule.adjustment)) return finiteNumber(rule.adjustment.proposed) ?? 0;
  return finiteNumber(rule.adjustment) ?? finiteNumber(rule.proposedAdjustment ?? rule.proposed_adjustment) ?? 0;
}

function adjustmentTargetOf(rule = {}) {
  return String(rule?.adjustment?.target ?? rule.adjustmentTarget ?? rule.adjustment_target ?? '').trim();
}

function acceptedEvidenceEligibility(rule = {}) {
  if (!isPlainObject(rule.evidence)) return { eligible: false, evidence: null };
  const evidence = qualifyLearningEvidence(rule.evidence);
  return { eligible: evidence.acceptanceEligible, evidence };
}

export function transitionLearnedRule(rule = {}, nextStatus, options = {}) {
  const status = normalizedString(nextStatus);
  if (!LEARNED_RULE_STATUSES.includes(status)) throw new Error(`Invalid learned-rule status: ${status || 'missing'}.`);
  const currentStatus = LEARNED_RULE_STATUSES.includes(rule.status) ? rule.status : 'suggested';
  if (currentStatus === 'retired' && status !== 'retired') throw new Error('Retired learned rules are not reactivated by the core; create a new suggestion from current evidence.');
  if (status === 'accepted' && !acceptedEvidenceEligibility(rule).eligible) throw new Error('Learned-rule acceptance requires directional or repeated qualified evidence.');
  if (currentStatus === 'accepted' && status === 'suggested') throw new Error('Accepted learned rules may be retired, not silently demoted to suggested.');

  const at = options.at == null ? null : Number(options.at);
  if (options.at != null && !Number.isFinite(at)) throw new Error('Status transition timestamp must be numeric when supplied.');
  const target = adjustmentTargetOf(rule);
  const bound = LEARNED_ADJUSTMENT_BOUNDS[target];
  if (status === 'accepted' && !bound) throw new Error(`Accepted learned rule has unsupported adjustment target: ${target || 'missing'}.`);
  const adjustment = isPlainObject(rule.adjustment) ? { ...rule.adjustment } : { target, proposed: proposedAdjustmentOf(rule) };
  adjustment.target = target;
  adjustment.bound = bound || 0;
  adjustment.proposed = bound ? round(clamp(proposedAdjustmentOf(rule), -bound, bound)) : 0;

  if (status === 'accepted') {
    adjustment.effective = adjustment.proposed;
    adjustment.effectiveReason = 'explicitly_accepted';
  } else {
    adjustment.effective = 0;
    adjustment.effectiveReason = status === 'retired' ? 'retired_rules_have_zero_production_effect' : 'suggested_rules_have_zero_production_effect';
  }

  return {
    ...rule,
    status,
    adjustment,
    ...(status === 'accepted' ? { acceptedAt: at ?? rule.acceptedAt ?? null } : {}),
    ...(status === 'retired' ? {
      retiredAt: at ?? rule.retiredAt ?? null,
      retirementReason: String(options.reason ?? rule.retirementReason ?? '').trim(),
    } : {}),
  };
}

function algorithmEvidenceKey(entry = {}) {
  return normalizedString(entry.tag ?? entry.key ?? entry.mechanism ?? entry.id);
}

function algorithmEvidenceForRule(rule, entries) {
  const tags = new Set((rule.mechanismTags || []).map(normalizedString));
  if (!tags.size) return [];
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => tags.has(algorithmEvidenceKey(entry)))
    .slice()
    .sort((left, right) => algorithmEvidenceKey(left).localeCompare(algorithmEvidenceKey(right)));
}

export function evaluateLearnedRuleReview(rule = {}, context = {}) {
  const reasons = [];
  let retirementRecommended = false;
  let suspendEffect = rule.status === 'retired';

  if (rule.status === 'accepted') {
    const acceptance = acceptedEvidenceEligibility(rule);
    if (!acceptance.eligible) {
      reasons.push({ code: 'ACCEPTED_WITHOUT_DIRECTIONAL_EVIDENCE', action: 'review', message: 'Accepted status is not backed by currently qualified directional/repeated evidence; suppress the learned effect.' });
      suspendEffect = true;
    }
  }

  if (context.stale === true) {
    reasons.push({ code: 'STALE_EVIDENCE', action: 'review', message: 'Caller marked the supporting evidence as stale.' });
  }
  const newerRelevantObservations = Math.max(0, Math.floor(Number(context.newerRelevantObservations ?? context.newer_relevant_observations) || 0));
  if (newerRelevantObservations >= 30) {
    reasons.push({ code: 'THIRTY_NEWER_OBSERVATIONS', action: 'review', message: `${newerRelevantObservations} newer relevant observations require re-evaluation.` });
  }

  const newerAdjustment = finiteNumber(context.newerAdjustment ?? context.newer_adjustment);
  const historicalDirection = Math.sign(proposedAdjustmentOf(rule));
  const newerDirection = newerAdjustment == null ? 0 : Math.sign(newerAdjustment);
  if (context.reversed === true || (historicalDirection && newerDirection && historicalDirection !== newerDirection)) {
    reasons.push({ code: 'NEWER_EVIDENCE_REVERSED', action: 'retire', message: 'Newer evidence reverses the accepted rule direction.' });
    retirementRecommended = true;
    suspendEffect = true;
  }

  if (context.nicheChanged === true || context.niche_changed === true) {
    reasons.push({ code: 'NICHE_STRATEGY_CHANGED', action: 'retire', message: 'The caller reports an explicit niche-strategy change affecting this rule.' });
    retirementRecommended = true;
    suspendEffect = true;
  }

  for (const evidence of algorithmEvidenceForRule(rule, context.algorithmEvidence ?? context.algorithm_evidence)) {
    const status = normalizedString(evidence.status);
    if (status === 'retired') {
      reasons.push({ code: 'LINKED_MECHANISM_RETIRED', action: 'retire', tag: algorithmEvidenceKey(evidence), message: 'A linked algorithm/public mechanism is retired.' });
      retirementRecommended = true;
      suspendEffect = true;
    } else if (evidence.materiallyChanged === true || evidence.materially_changed === true) {
      reasons.push({ code: 'LINKED_MECHANISM_CHANGED', action: 'review', tag: algorithmEvidenceKey(evidence), message: 'A linked algorithm/public mechanism materially changed and must be reviewed before continued application.' });
      suspendEffect = true;
    }
  }

  return {
    ruleId: rule.ruleId || `${rule.scope || ''}:${rule.key || ''}`,
    reviewRequired: reasons.length > 0,
    retirementRecommended,
    suspendEffect,
    newerRelevantObservations,
    reasons,
  };
}

export function reviewLearnedRules(rules = [], context = {}) {
  const byRule = isPlainObject(context.byRule) ? context.byRule : {};
  return (Array.isArray(rules) ? rules : [])
    .map((rule) => {
      const ruleId = rule.ruleId || `${rule.scope || ''}:${rule.key || ''}`;
      return evaluateLearnedRuleReview(rule, { ...context, ...(byRule[ruleId] || {}) });
    })
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

function readPath(object, path) {
  let current = object;
  for (const part of String(path || '').split('.')) {
    if (!isPlainObject(current) || !Object.hasOwn(current, part)) return undefined;
    current = current[part];
  }
  return current;
}

function matchValue(actual, expected) {
  const actualValues = Array.isArray(actual) ? actual : [actual];
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  return actualValues.some((left) => expectedValues.some((right) => {
    if (typeof left === 'string' || typeof right === 'string') return normalizedString(left) === normalizedString(right);
    return left === right;
  }));
}

function ruleMatchesContext(rule = {}, context = {}) {
  const match = isPlainObject(rule.match) ? rule.match : {};
  return Object.entries(match).every(([path, expected]) => {
    const actual = readPath(context, path);
    return actual !== undefined && matchValue(actual, expected);
  });
}

function protectedBoundaryReasons(context = {}) {
  return PROTECTED_BOUNDARY_FIELDS
    .filter(([, predicate]) => predicate(context))
    .map(([code]) => code);
}

export function matchAcceptedLearnedRules(rules = [], context = {}, options = {}) {
  const target = String(options.adjustmentTarget ?? options.adjustment_target ?? '').trim();
  const component = options.adjustmentComponent == null ? null : String(options.adjustmentComponent);
  const byRule = isPlainObject(options.reviewContext?.byRule) ? options.reviewContext.byRule : {};
  const matched = [];
  const suppressed = [];

  for (const rule of Array.isArray(rules) ? rules : []) {
    if (rule.status !== 'accepted' || !ruleMatchesContext(rule, context)) continue;
    if (target && adjustmentTargetOf(rule) !== target) continue;
    if (component != null && String(rule?.adjustment?.component ?? '') !== component) continue;
    const ruleId = rule.ruleId || `${rule.scope || ''}:${rule.key || ''}`;
    const review = evaluateLearnedRuleReview(rule, {
      ...(options.reviewContext || {}),
      ...(byRule[ruleId] || {}),
    });
    const item = { rule, review };
    if (review.suspendEffect) suppressed.push(item);
    else matched.push(item);
  }

  const sortById = (left, right) => String(left.rule.ruleId || '').localeCompare(String(right.rule.ruleId || ''));
  matched.sort(sortById);
  suppressed.sort(sortById);
  return { matched, suppressed };
}

export function applyAcceptedLearnedRules(baseValue, rules = [], context = {}, options = {}) {
  const base = finiteNumber(baseValue);
  if (base == null) throw new Error('Base value must be numeric.');
  const target = String(options.adjustmentTarget ?? options.adjustment_target ?? '').trim();
  const bound = LEARNED_ADJUSTMENT_BOUNDS[target];
  if (!bound) throw new Error(`Unsupported learned adjustment target: ${target || 'missing'}.`);

  const boundaryReasons = protectedBoundaryReasons(context);
  const matches = matchAcceptedLearnedRules(rules, context, { ...options, adjustmentTarget: target });
  const contributions = matches.matched.map(({ rule, review }) => ({
    ruleId: rule.ruleId || `${rule.scope || ''}:${rule.key || ''}`,
    adjustment: round(clamp(proposedAdjustmentOf(rule), -bound, bound)),
    reviewRequired: review.reviewRequired,
  }));
  const rawLearnedAdjustment = round(contributions.reduce((sum, item) => sum + item.adjustment, 0));
  const learnedAdjustment = boundaryReasons.length ? 0 : round(clamp(rawLearnedAdjustment, -bound, bound));
  let finalValue = base + learnedAdjustment;
  const finalMin = finiteNumber(options.finalMin ?? options.final_min);
  const finalMax = finiteNumber(options.finalMax ?? options.final_max);
  if (finalMin != null) finalValue = Math.max(finalMin, finalValue);
  if (finalMax != null) finalValue = Math.min(finalMax, finalValue);

  return {
    baseValue: round(base),
    adjustmentTarget: target,
    adjustmentBound: bound,
    rawLearnedAdjustment,
    learnedAdjustment,
    finalValue: round(finalValue),
    boundarySuppressed: boundaryReasons.length > 0,
    boundaryReasons,
    contributions,
    suppressedRules: matches.suppressed.map(({ rule, review }) => ({
      ruleId: rule.ruleId || `${rule.scope || ''}:${rule.key || ''}`,
      reasons: review.reasons,
    })),
  };
}
