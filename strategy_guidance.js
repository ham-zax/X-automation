const EXTERNAL_GROUP_DIMENSIONS = Object.freeze({
  intent: 'intent',
  semantic_style: 'style',
  hook: 'opening_feature',
  feature: 'opening_feature',
});

const FIT_RANK = Object.freeze({
  weak_fit: 1,
  possible_fit: 2,
  strong_fit: 3,
});

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function stringValue(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function stringList(value) {
  return [...new Set(asArray(value).map(stringValue).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function evidenceState(value) {
  const state = String(value ?? '').trim().toLowerCase();
  if ([
    'supported',
    'repeated',
    'repeated_association',
    'strong_repeated_association',
    'primary_supported',
  ].includes(state)) return 'supported';
  if (state === 'directional') return 'directional';
  return 'insufficient';
}

function strategyFrom(item = {}, groupType = null) {
  const supplied = item.strategy && typeof item.strategy === 'object' ? item.strategy : item;
  let intent = stringValue(supplied.intent ?? supplied.primaryIntent ?? supplied.primary_intent);
  let style = stringValue(supplied.style ?? supplied.semanticStyle ?? supplied.semantic_style);
  let openingFeatures = stringList(
    supplied.openingFeatures
      ?? supplied.opening_features
      ?? supplied.openingFeature
      ?? supplied.opening_feature
      ?? [],
  );

  const externalDimension = EXTERNAL_GROUP_DIMENSIONS[groupType];
  const label = stringValue(item.label);
  if (!intent && externalDimension === 'intent') intent = label;
  if (!style && externalDimension === 'style') style = label;
  if (!openingFeatures.length && externalDimension === 'opening_feature' && label) openingFeatures = [label];

  return { intent, style, openingFeatures };
}

function strategyKey(strategy = {}) {
  return JSON.stringify([
    strategy.intent || null,
    strategy.style || null,
    stringList(strategy.openingFeatures || []),
  ]);
}

function strategyHasGuidance(strategy = {}) {
  return Boolean(strategy.intent || strategy.style || asArray(strategy.openingFeatures).length);
}

function sourceStateOf(item = {}, fallback = null) {
  return stringValue(
    item.evidenceClass
      ?? item.evidence_class
      ?? item.evidenceState
      ?? item.evidence_state
      ?? item.state
      ?? item.evidence?.state
      ?? fallback,
  );
}

function scopeOf(item = {}) {
  const appliesTo = item.appliesTo && typeof item.appliesTo === 'object' ? item.appliesTo : {};
  return {
    objectives: stringList(appliesTo.objectives ?? item.objectives ?? []).map((value) => value.toLowerCase()),
    pipelines: stringList(appliesTo.pipelines ?? item.pipelines ?? []).map((value) => value.toLowerCase()),
    topicTags: stringList(appliesTo.topicTags ?? appliesTo.topic_tags ?? item.topicTags ?? item.topic_tags ?? []).map((value) => value.toLowerCase()),
  };
}

function candidateContext(candidate = {}) {
  const niche = candidate?.niche && typeof candidate.niche === 'object' ? candidate.niche : {};
  const status = ['current', 'stale', 'unclassified'].includes(niche.status) ? niche.status : 'unclassified';
  const current = status === 'current';
  return {
    key: stringValue(candidate.key),
    source: stringValue(candidate.source),
    title: stringValue(candidate.title),
    topicClassification: {
      status,
      authoritative: current,
      score: current && niche.score != null && niche.score !== '' && Number.isFinite(Number(niche.score)) ? Number(niche.score) : null,
      tags: current ? stringList(niche.tags) : [],
      matches: current ? stringList(niche.matches) : [],
      profileRevision: niche.profileRevision == null ? null : Number(niche.profileRevision),
      classifierVersion: niche.classifierVersion == null ? null : Number(niche.classifierVersion),
      classifiedAt: niche.classifiedAt == null ? null : Number(niche.classifiedAt),
    },
  };
}

function scopeMatch(scope, context) {
  if (scope.objectives.length && !scope.objectives.includes(context.objective)) {
    return { matches: false, reason: 'objective_mismatch' };
  }
  if (scope.pipelines.length && !scope.pipelines.includes(context.pipeline)) {
    return { matches: false, reason: 'pipeline_mismatch' };
  }
  if (scope.topicTags.length) {
    const classification = context.candidate.topicClassification;
    if (classification.status !== 'current') return { matches: false, reason: 'topic_classification_not_current' };
    const candidateTags = new Set(classification.tags.map((tag) => tag.toLowerCase()));
    if (!scope.topicTags.some((tag) => candidateTags.has(tag))) return { matches: false, reason: 'topic_mismatch' };
  }
  return { matches: true, reason: null };
}

function evidenceId(item, lane, index, strategy) {
  const supplied = stringValue(
    item.id
      ?? item.evidenceId
      ?? item.evidence_id
      ?? item.ruleId
      ?? item.rule_id
      ?? item.experimentId
      ?? item.experiment_id,
  );
  if (supplied) return supplied;
  const groupType = stringValue(item.groupType ?? item.group_type);
  const label = stringValue(item.label);
  if (groupType && label) return `${lane}:${groupType}:${label}`;
  return `${lane}:${index}:${strategyKey(strategy)}`;
}

function limitationsOf(item = {}) {
  return stringList(item.limitations ?? item.limitation ?? []);
}

function normalizeEvidenceRef(item, { lane, index, context, fallbackState = null } = {}) {
  const source = item && typeof item === 'object' ? item : {};
  const groupType = stringValue(source.groupType ?? source.group_type);
  const strategy = strategyFrom(source, groupType);
  const sourceState = sourceStateOf(source, fallbackState);
  const scope = scopeOf(source);
  const match = scopeMatch(scope, context);
  const sample = Number(source.sampleSize ?? source.sample_size ?? source.evidence?.sampleSize ?? source.evidence?.sample_size);

  return {
    id: evidenceId(source, lane, index, strategy),
    lane,
    state: evidenceState(sourceState),
    sourceState,
    strategy,
    sampleSize: Number.isFinite(sample) ? Math.max(0, sample) : null,
    rationale: stringValue(source.rationale ?? source.finding ?? source.explanation ?? source.recommendation),
    limitations: limitationsOf(source),
    scope,
    contextMatch: match.matches,
    contextMismatchReason: match.reason,
    learnedRuleStatus: lane === 'learned_rule' ? stringValue(source.status) : null,
    learnedRuleMatch: lane === 'learned_rule' && source.match && typeof source.match === 'object' ? source.match : null,
  };
}

function externalEvidenceItems(externalPatterns) {
  if (Array.isArray(externalPatterns)) return externalPatterns.map((item) => ({ item, fallbackState: null }));
  if (!externalPatterns || typeof externalPatterns !== 'object') return [];
  const result = [];
  for (const [key, fallbackState] of [
    ['supportedGroups', 'supported'],
    ['directionalGroups', 'directional'],
    ['insufficientGroups', 'insufficient'],
  ]) {
    for (const item of asArray(externalPatterns[key])) result.push({ item, fallbackState });
  }
  return result;
}

function normalizeLane(items, lane, context) {
  return asArray(items).map((item, index) => normalizeEvidenceRef(item, { lane, index, context }));
}

function normalizeExternalLane(externalPatterns, context) {
  return externalEvidenceItems(externalPatterns).map(({ item, fallbackState }, index) => (
    normalizeEvidenceRef(item, { lane: 'external', index, context, fallbackState })
  ));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function evidenceLimitations(refs, context) {
  const limitations = refs.flatMap((ref) => ref.limitations);
  if (refs.some((ref) => ref.lane === 'external')) {
    limitations.push('External Viral evidence is observational association, not X-ranking causality or future-performance certainty.');
  }
  if (refs.some((ref) => ref.lane === 'internal')) {
    limitations.push('Own-account outcome evidence is observational unless an explicit declared comparison is supplied separately.');
  }
  if (refs.some((ref) => ref.lane === 'experiment')) {
    limitations.push('Explicit-test evidence preserves its declared evidence state and does not imply causal proof beyond the supplied experiment contract.');
  }
  if (refs.some((ref) => ref.state === 'directional')) {
    limitations.push('Directional evidence is weaker than repeated/supporting evidence and must not be presented as certainty.');
  }
  if (context.candidate.topicClassification.status !== 'current') {
    limitations.push(`Candidate topic classification is ${context.candidate.topicClassification.status}; its score/tags/matches were not used as authoritative context.`);
  }
  return unique(limitations);
}

function lanePhrase(lane, refs) {
  if (!refs.length) return null;
  const supported = refs.some((ref) => ref.state === 'supported');
  const name = lane === 'external'
    ? 'external Viral evidence'
    : lane === 'internal'
      ? 'own-account outcome evidence'
      : 'explicit-test evidence';
  return `${supported ? 'supported' : 'directional'} ${name}`;
}

function optionFit(externalEvidence, internalEvidence, experimentEvidence) {
  const supportedInternal = internalEvidence.some((ref) => ref.state === 'supported');
  const supportedExperiment = experimentEvidence.some((ref) => ref.state === 'supported');
  const supportedLanes = [externalEvidence, internalEvidence, experimentEvidence]
    .filter((refs) => refs.some((ref) => ref.state === 'supported')).length;
  if (supportedInternal || supportedExperiment || supportedLanes >= 2) return 'strong_fit';
  if (supportedLanes === 1 || internalEvidence.length || experimentEvidence.length) return 'possible_fit';
  return 'weak_fit';
}

function describeStrategy(strategy) {
  const parts = [];
  if (strategy.intent) parts.push(`intent ${strategy.intent}`);
  if (strategy.style) parts.push(`style ${strategy.style}`);
  if (strategy.openingFeatures.length) parts.push(`opening ${strategy.openingFeatures.join(' + ')}`);
  return parts.join(', ');
}

export function buildWritingStrategyEvidence({
  objective = null,
  pipeline = null,
  candidate = null,
  editorialRecommendation = null,
  externalPatterns = [],
  internalOutcomes = [],
  experiments = [],
  learnedRules = [],
} = {}) {
  const context = {
    objective: String(objective ?? '').trim().toLowerCase(),
    pipeline: String(pipeline ?? '').trim().toLowerCase(),
    candidate: candidateContext(candidate || {}),
    editorialRecommendation: editorialRecommendation ?? null,
  };

  return {
    context,
    externalEvidence: normalizeExternalLane(externalPatterns, context),
    internalEvidence: normalizeLane(internalOutcomes, 'internal', context),
    experimentEvidence: normalizeLane(experiments, 'experiment', context),
    learnedRuleEvidence: normalizeLane(learnedRules, 'learned_rule', context),
  };
}

export function buildWritingStrategyShortlist(evidence = {}) {
  const context = evidence.context && typeof evidence.context === 'object'
    ? evidence.context
    : { objective: '', pipeline: '', candidate: candidateContext({}), editorialRecommendation: null };

  if (context.pipeline === 'repost') {
    return {
      status: 'not_applicable',
      reason: 'Repost has no authored body, so writing strategy does not apply.',
      options: [],
      rejectedEvidence: [],
    };
  }

  const sourceLanes = [
    ['externalEvidence', 'external'],
    ['internalEvidence', 'internal'],
    ['experimentEvidence', 'experiment'],
  ];
  const groups = new Map();
  const rejectedEvidence = [];

  for (const [field, lane] of sourceLanes) {
    for (const ref of asArray(evidence[field])) {
      if (ref.state === 'insufficient') {
        rejectedEvidence.push({ id: ref.id, lane, reason: 'insufficient_evidence' });
        continue;
      }
      if (ref.contextMatch === false) {
        rejectedEvidence.push({ id: ref.id, lane, reason: ref.contextMismatchReason || 'context_mismatch' });
        continue;
      }
      if (!strategyHasGuidance(ref.strategy)) {
        rejectedEvidence.push({ id: ref.id, lane, reason: 'no_strategy_dimension' });
        continue;
      }
      const key = strategyKey(ref.strategy);
      if (!groups.has(key)) groups.set(key, { strategy: ref.strategy, external: [], internal: [], experiment: [] });
      groups.get(key)[lane].push(ref);
    }
  }

  const learnedByStrategy = new Map();
  for (const ref of asArray(evidence.learnedRuleEvidence)) {
    if (!strategyHasGuidance(ref.strategy) || ref.contextMatch === false) continue;
    const key = strategyKey(ref.strategy);
    if (!learnedByStrategy.has(key)) learnedByStrategy.set(key, []);
    learnedByStrategy.get(key).push(ref);
  }

  const options = [...groups.entries()].map(([key, group]) => {
    const learnedRuleEvidence = learnedByStrategy.get(key) || [];
    const refs = [...group.external, ...group.internal, ...group.experiment];
    const phrases = [
      lanePhrase('external', group.external),
      lanePhrase('internal', group.internal),
      lanePhrase('experiment', group.experiment),
    ].filter(Boolean);
    const acceptedLearnedRules = learnedRuleEvidence.filter((ref) => ref.learnedRuleStatus === 'accepted');
    if (acceptedLearnedRules.length) phrases.push('matching accepted learned-rule context');

    const limitations = evidenceLimitations(refs, context);
    if (!group.internal.length && !group.experiment.length) {
      limitations.push('No own-account or explicit-test evidence is attached to this option.');
    }

    return {
      intent: group.strategy.intent,
      style: group.strategy.style,
      openingFeatures: [...group.strategy.openingFeatures],
      applicability: optionFit(group.external, group.internal, group.experiment),
      rationale: `${describeStrategy(group.strategy)} is backed by ${phrases.join(', ')}.`,
      externalEvidence: group.external,
      internalEvidence: group.internal,
      experimentEvidence: group.experiment,
      learnedRuleEvidence,
      limitations: unique(limitations),
    };
  });

  options.sort((left, right) => {
    const rank = FIT_RANK[right.applicability] - FIT_RANK[left.applicability];
    if (rank) return rank;
    const rightLanes = [right.externalEvidence, right.internalEvidence, right.experimentEvidence].filter((lane) => lane.length).length;
    const leftLanes = [left.externalEvidence, left.internalEvidence, left.experimentEvidence].filter((lane) => lane.length).length;
    if (rightLanes !== leftLanes) return rightLanes - leftLanes;
    return strategyKey(left).localeCompare(strategyKey(right));
  });

  if (!options.length) {
    return {
      status: 'insufficient_evidence',
      reason: 'No supported or directional evidence produced a context-applicable writing-strategy option.',
      options: [],
      rejectedEvidence,
    };
  }

  return {
    status: 'applicable',
    reason: null,
    options,
    rejectedEvidence,
  };
}
