import { scoreOpportunity } from './opportunity.js';
import { calculateProfileProofCoverage } from './profile_proof.js';
import { classifyResearchStory, matchResearchTopics } from './research_topics.js';
import { routeCandidate } from './pipeline.js';
import { GROWTH_FOCUS_OBJECTIVES } from './strategy.js';
import {
  SOURCE_SNAPSHOT_KINDS,
  createEditorialRun,
  ensureEditorialCandidate,
  getAccountHealthSummary,
  getCandidate,
  getDiscoverSnapshot,
  getEditorialRecommendation,
  getEditorialSelectionByRecommendation,
  getPreferenceProfile,
  getQueueItem,
  getQueueItemByCandidate,
  getRelationshipProfile,
  getSourceMomentum,
  linkQueueSource,
  listAcceptedLearnedRules,
  listAlgorithmEvidenceEntries,
  listApprovedMainFeedItems,
  listCandidateActions,
  listEngagementItems,
  listPublicationMeasurementSeries,
  listPublishedMainFeedContent,
  listQueueSources,
  listRecentMainFeedPublications,
  listResearchEvidence,
  recordEditorialSelection,
  saveEditorialRecommendation,
  saveQueueItem,
  setEditorialRecommendationStatus,
  supersedeSuggestedEditorialRecommendations,
  updateEditorialRun,
  upsertCandidates,
} from './store.js';

export const EDITORIAL_OBJECTIVE_WEIGHTS = Object.freeze({
  qualified_growth: Object.freeze({ reach: 0.20, follow: 0.40, conversation: 0.10, relationship: 0.10, authority: 0.20 }),
  reach_momentum: Object.freeze({ reach: 0.55, follow: 0.20, conversation: 0.10, relationship: 0.05, authority: 0.10 }),
  relationships: Object.freeze({ reach: 0.05, follow: 0.10, conversation: 0.35, relationship: 0.40, authority: 0.10 }),
  technical_authority: Object.freeze({ reach: 0.15, follow: 0.25, conversation: 0.10, relationship: 0.05, authority: 0.45 }),
  balanced: Object.freeze({ reach: 0.25, follow: 0.25, conversation: 0.20, relationship: 0.15, authority: 0.15 }),
});

export const EDITORIAL_OBJECTIVES = GROWTH_FOCUS_OBJECTIVES;
export const RECOMMENDATION_DECISIONS = Object.freeze(['PREPARE', 'RESEARCH_MORE', 'SKIP']);
export const PREPARE_PIPELINES = Object.freeze(['original', 'quote', 'thread', 'reply', 'repost']);
export const SCAN_FORMAT_CANDIDATES = Object.freeze([...PREPARE_PIPELINES, 'research']);
export const ANGLE_CLASSES = Object.freeze([
  'our_experiment',
  'multi_source_synthesis',
  'evidence_backed_interpretation',
  'source_dependent_commentary',
  'summary_only',
]);

export const ALGORITHM_MECHANISM_LEDGER_IDS = Object.freeze({
  semantic_retrieval: 'semantic_topic_representations_are_part_of_retrieval_ranking',
  in_network_thunder: 'thunder_is_an_in_network_source',
  out_of_network_retrieval: 'out_of_network_retrieval_exists_separately',
  multi_action_prediction: 'ranking_combines_predicted_actions_not_raw_observed_counts',
  author_diversity: 'author_diversity_attenuation_exists',
  mutual_follow_reply_boost: 'bidirectional_mutual_follow_original_post_reply_boost_exists',
  freshness_filtering: 'candidate_age_filtering_exists_in_the_current_pipeline',
  ranking_vs_visibility: 'ranking_and_visibility_filtering_are_separate_layers',
});

const PROFILE_PROOF_GAP = Object.freeze({ none: 40, weak: 30, medium: 15, strong: 0 });
const RESEARCH_AGENDA_VALUE = Object.freeze({ 1: 30, 2: 20, 3: 10 });
const ANGLE_VALUE = Object.freeze({
  our_experiment: 10,
  multi_source_synthesis: 10,
  evidence_backed_interpretation: 6,
  source_dependent_commentary: 3,
  summary_only: 0,
});
const TARGETED_PIPELINES = new Set(['quote', 'reply', 'repost']);
const PRIMARY_PIPELINES = new Set(['original', 'thread']);
const EVIDENCE_STATUSES = new Set(['primary_supported', 'source_claim', 'contradicted', 'unresolved']);

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function finitePotential(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Missing numeric ${name}.`);
  return Math.max(0, Math.min(100, number));
}

function candidateKey(candidate) {
  return String(candidate?.candidateKey ?? candidate?.key ?? '').trim();
}

function observedAt(candidate) {
  const value = Number(candidate?.latestObservationAt ?? candidate?.observedAt ?? candidate?.snapshotAt ?? candidate?.timestamp ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function candidatePotentials(candidate) {
  const source = candidate?.potentials || candidate?.opportunity || candidate?.scores || candidate || {};
  return {
    reachPotential: finitePotential(source.reachPotential, 'reachPotential'),
    followPotential: finitePotential(source.followPotential, 'followPotential'),
    conversationPotential: finitePotential(source.conversationPotential, 'conversationPotential'),
    relationshipPotential: finitePotential(source.relationshipPotential, 'relationshipPotential'),
  };
}

function coverageValue(profileProofCoverage) {
  const coverage = String(profileProofCoverage?.coverage ?? profileProofCoverage ?? '').toLowerCase();
  if (!(coverage in PROFILE_PROOF_GAP)) throw new Error(`Unsupported ProfileProofCoverage: ${coverage || 'missing'}.`);
  return { coverage, value: PROFILE_PROOF_GAP[coverage] };
}

function topicTier(researchTopic) {
  if (researchTopic == null || researchTopic === '') return null;
  const raw = typeof researchTopic === 'object' ? researchTopic.tier : researchTopic;
  const tier = Number(raw);
  if (![1, 2, 3].includes(tier)) throw new Error(`Unsupported Research Agenda tier: ${raw}.`);
  return tier;
}

function evidenceStatus(item) {
  return String(item?.status ?? item?.evidenceStatus ?? item?.evidence_status ?? '').toLowerCase();
}

function sourceFamily(item) {
  return String(item?.sourceFamily ?? item?.source_family ?? '').trim();
}

export function validateEditorialObjective(objective = 'qualified_growth') {
  const value = String(objective || 'qualified_growth');
  if (!EDITORIAL_OBJECTIVE_WEIGHTS[value]) throw new Error(`Unsupported editorial objective: ${value}.`);
  return value;
}

export function summarizeEvidenceDepth(evidence = []) {
  const items = Array.isArray(evidence) ? evidence : [];
  const primarySupported = items.filter((item) => evidenceStatus(item) === 'primary_supported');
  const primarySourceFamilies = uniqueStrings(primarySupported.map(sourceFamily));
  const hasSourceClaimOrMetadata = items.some((item) => {
    const status = evidenceStatus(item);
    return status === 'source_claim' || item?.metadataOnly === true || String(item?.claimType || '').toLowerCase() === 'metadata';
  });

  let value = 0;
  if (primarySourceFamilies.length >= 2) value = 20;
  else if (primarySourceFamilies.length === 1) value = 12;
  else if (hasSourceClaimOrMetadata) value = 4;

  return {
    value,
    primarySupportedCount: primarySupported.length,
    primarySourceFamilies,
    usableEvidenceCount: items.filter((item) => EVIDENCE_STATUSES.has(evidenceStatus(item))).length,
  };
}

function angleRequirements(angleClass, facts) {
  if (angleClass === 'our_experiment') return facts.firstPartyExperimentEvidence === true;
  if (angleClass === 'multi_source_synthesis') return facts.candidateKeys.length >= 2 && facts.supportingSourceFamilies.length >= 2;
  if (angleClass === 'evidence_backed_interpretation') return facts.primarySupportedCount >= 1;
  return true;
}

export function validateAngleClass(requestedAngleClass, {
  evidence = [],
  candidateKeys = [],
  supportingSourceFamilies = [],
  firstPartyExperimentEvidence = false,
} = {}) {
  const requested = String(requestedAngleClass || '');
  const requestedIndex = ANGLE_CLASSES.indexOf(requested);
  const depth = summarizeEvidenceDepth(evidence);
  const facts = {
    candidateKeys: uniqueStrings(candidateKeys),
    supportingSourceFamilies: uniqueStrings([...depth.primarySourceFamilies, ...supportingSourceFamilies]),
    primarySupportedCount: depth.primarySupportedCount,
    firstPartyExperimentEvidence: firstPartyExperimentEvidence === true,
  };

  if (requestedIndex < 0) {
    return {
      requested,
      angleClass: 'summary_only',
      value: 0,
      validRequested: false,
      downgraded: true,
      reason: `Unsupported angleClass ${requested || 'missing'}; downgraded to summary_only.`,
      facts,
    };
  }

  for (let index = requestedIndex; index < ANGLE_CLASSES.length; index += 1) {
    const candidate = ANGLE_CLASSES[index];
    if (!angleRequirements(candidate, facts)) continue;
    return {
      requested,
      angleClass: candidate,
      value: ANGLE_VALUE[candidate],
      validRequested: true,
      downgraded: candidate !== requested,
      reason: candidate === requested
        ? 'Requested angleClass satisfies its deterministic evidence requirements.'
        : `${requested} did not satisfy its deterministic evidence requirements; downgraded to ${candidate}.`,
      facts,
    };
  }

  return {
    requested,
    angleClass: 'summary_only',
    value: 0,
    validRequested: true,
    downgraded: requested !== 'summary_only',
    reason: 'No stronger angleClass requirements were satisfied; downgraded to summary_only.',
    facts,
  };
}

export function calculateAuthorityValue({
  profileProofCoverage,
  researchTopic = null,
  evidence = [],
  angleClass = 'summary_only',
  candidateKeys = [],
  supportingSourceFamilies = [],
  firstPartyExperimentEvidence = false,
} = {}) {
  const profileProof = coverageValue(profileProofCoverage);
  const tier = topicTier(researchTopic);
  const agenda = { tier, value: tier == null ? 0 : RESEARCH_AGENDA_VALUE[tier] };
  const evidenceDepth = summarizeEvidenceDepth(evidence);
  const novelAngle = validateAngleClass(angleClass, {
    evidence,
    candidateKeys,
    supportingSourceFamilies,
    firstPartyExperimentEvidence,
  });

  return {
    value: profileProof.value + agenda.value + evidenceDepth.value + novelAngle.value,
    components: {
      profileProofGap: profileProof,
      researchAgenda: agenda,
      evidenceDepth,
      novelAngle,
    },
  };
}

export function calculatePreResearchAuthority({ profileProofCoverage, researchTopic = null } = {}) {
  return calculateAuthorityValue({
    profileProofCoverage,
    researchTopic,
    evidence: [],
    angleClass: 'summary_only',
  });
}

export function calculateObjectiveFit({ objective = 'qualified_growth', potentials, authorityValue } = {}) {
  const selectedObjective = validateEditorialObjective(objective);
  const weights = EDITORIAL_OBJECTIVE_WEIGHTS[selectedObjective];
  const values = candidatePotentials(potentials || {});
  const authority = finitePotential(authorityValue, 'authorityValue');
  const value = values.reachPotential * weights.reach
    + values.followPotential * weights.follow
    + values.conversationPotential * weights.conversation
    + values.relationshipPotential * weights.relationship
    + authority * weights.authority;
  return Number(value.toFixed(2));
}

export function scoreStoryPreResearch({
  storyKey,
  candidates = [],
  objective = 'qualified_growth',
  profileProofCoverage,
  researchTopic = null,
} = {}) {
  const key = String(storyKey || '').trim();
  if (!key) throw new Error('storyKey is required.');
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error(`Story ${key} has no candidates.`);

  const authority = calculatePreResearchAuthority({ profileProofCoverage, researchTopic });
  const candidateFits = candidates.map((candidate) => {
    const keyValue = candidateKey(candidate);
    if (!keyValue) throw new Error(`Story ${key} contains a candidate without candidateKey.`);
    const potentials = candidatePotentials(candidate);
    const snapshotKinds = uniqueStrings(candidate?.snapshotKinds || [candidate?.snapshotKind]).filter(Boolean);
    return {
      candidateKey: keyValue,
      source: String(candidate?.source || ''),
      snapshotKind: snapshotKinds[0] || '',
      snapshotKinds,
      observedAt: observedAt(candidate),
      potentials,
      objectiveFit: calculateObjectiveFit({ objective, potentials, authorityValue: authority.value }),
    };
  }).sort((left, right) => right.objectiveFit - left.objectiveFit
    || right.observedAt - left.observedAt
    || left.candidateKey.localeCompare(right.candidateKey));

  const primary = candidateFits[0];
  return {
    storyKey: key,
    storyPreResearchFit: primary.objectiveFit,
    primaryCandidateKey: primary.candidateKey,
    preResearchAuthority: authority,
    candidateFits,
    distinctSnapshotKinds: new Set(candidateFits.flatMap((candidate) => candidate.snapshotKinds || [candidate.snapshotKind]).filter(Boolean)).size,
    latestObservationAt: Math.max(...candidateFits.map((candidate) => candidate.observedAt)),
  };
}

export function rankPreResearchStories(stories = []) {
  return [...(Array.isArray(stories) ? stories : [])].sort((left, right) =>
    Number(right?.storyPreResearchFit || 0) - Number(left?.storyPreResearchFit || 0)
    || Number(right?.distinctSnapshotKinds || 0) - Number(left?.distinctSnapshotKinds || 0)
    || Number(right?.latestObservationAt || 0) - Number(left?.latestObservationAt || 0)
    || String(left?.storyKey || '').localeCompare(String(right?.storyKey || '')));
}

export function deriveStoryKey(candidateKeys = []) {
  const keys = uniqueStrings(candidateKeys).sort((left, right) => left.localeCompare(right));
  if (keys.length === 0) throw new Error('At least one candidate key is required to derive a story key.');
  return `story:${JSON.stringify(keys)}`;
}

export function validateStoryCluster(cluster = {}, { allowedCandidateKeys = [] } = {}) {
  const candidateKeys = validateReferencedIds(cluster.candidateKeys, allowedCandidateKeys);
  const formatCandidates = validateReferencedIds(cluster.initialFormatCandidates, SCAN_FORMAT_CANDIDATES);
  const errors = [];
  if (candidateKeys.accepted.length === 0) errors.push('A story cluster must contain at least one supplied candidate key.');
  if (!candidateKeys.valid) errors.push(`Unknown candidateKeys: ${candidateKeys.rejected.join(', ')}.`);
  if (!formatCandidates.valid) errors.push(`Unsupported initialFormatCandidates: ${formatCandidates.rejected.join(', ')}.`);

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      ...cluster,
      storyKey: candidateKeys.accepted.length ? deriveStoryKey(candidateKeys.accepted) : null,
      candidateKeys: candidateKeys.accepted,
      initialFormatCandidates: formatCandidates.accepted,
      researchQuestions: uniqueStrings(cluster.researchQuestions),
    },
  };
}

export function validateDecisionPipeline(decision, pipeline) {
  const normalizedDecision = String(decision || '');
  const normalizedPipeline = pipeline == null ? null : String(pipeline);
  if (!RECOMMENDATION_DECISIONS.includes(normalizedDecision)) {
    return { valid: false, decision: normalizedDecision, pipeline: normalizedPipeline, reason: `Unsupported decision: ${normalizedDecision || 'missing'}.` };
  }
  if (normalizedDecision === 'PREPARE' && !PREPARE_PIPELINES.includes(normalizedPipeline)) {
    return { valid: false, decision: normalizedDecision, pipeline: normalizedPipeline, reason: 'PREPARE requires original, quote, thread, reply, or repost.' };
  }
  if (normalizedDecision === 'RESEARCH_MORE' && normalizedPipeline !== 'research') {
    return { valid: false, decision: normalizedDecision, pipeline: normalizedPipeline, reason: 'RESEARCH_MORE requires the research pipeline.' };
  }
  if (normalizedDecision === 'SKIP' && normalizedPipeline != null) {
    return { valid: false, decision: normalizedDecision, pipeline: normalizedPipeline, reason: 'SKIP requires pipeline = null.' };
  }
  return { valid: true, decision: normalizedDecision, pipeline: normalizedPipeline, reason: '' };
}

export function validateReferencedIds(requested = [], allowed = []) {
  const allowedSet = new Set(uniqueStrings(allowed));
  const accepted = [];
  const rejected = [];
  for (const id of uniqueStrings(requested)) {
    if (allowedSet.has(id)) accepted.push(id);
    else rejected.push(id);
  }
  return { valid: rejected.length === 0, accepted, rejected };
}

export function resolveAlgorithmMechanisms(ledgerEntries = []) {
  const byId = new Map((Array.isArray(ledgerEntries) ? ledgerEntries : []).map((entry) => [String(entry?.id ?? entry?.key ?? entry?.tag ?? ''), entry]));
  const available = [];
  const unavailable = [];

  for (const [tag, ledgerId] of Object.entries(ALGORITHM_MECHANISM_LEDGER_IDS)) {
    const entry = byId.get(ledgerId);
    if (!entry) {
      unavailable.push({ tag, ledgerId, reason: 'missing_ledger_entry' });
      continue;
    }
    const evidenceClass = String(entry.status || '');
    if (evidenceClass === 'RETIRED') {
      unavailable.push({ tag, ledgerId, reason: 'retired', evidenceClass });
      continue;
    }
    if (entry.materiallyChanged === true) {
      unavailable.push({ tag, ledgerId, reason: 'materially_changed', evidenceClass });
      continue;
    }
    if (!['CODE_BACKED', 'OFFICIAL_PRODUCT_OR_POLICY', 'EMPIRICAL_VARIABLE'].includes(evidenceClass)) {
      unavailable.push({ tag, ledgerId, reason: 'unsupported_evidence_class', evidenceClass });
      continue;
    }
    available.push({ tag, ledgerId, evidenceClass, title: String(entry.title || '') });
  }

  return { available, unavailable };
}

function findStoryCandidate(story, key) {
  return (Array.isArray(story?.candidates) ? story.candidates : []).find((candidate) => candidateKey(candidate) === key) || null;
}

export function selectRecommendationPotentials({ decision, pipeline, story, targetCandidateKey = null } = {}) {
  const route = validateDecisionPipeline(decision, pipeline);
  if (!route.valid) throw new Error(route.reason);
  const primaryKey = String(story?.primaryCandidateKey || '').trim();
  if (!primaryKey) throw new Error('story.primaryCandidateKey is required.');
  const primary = findStoryCandidate(story, primaryKey);
  if (!primary) throw new Error(`Primary candidate ${primaryKey} is not present in the story.`);

  if (route.decision !== 'PREPARE') {
    return { candidateKey: primaryKey, potentials: candidatePotentials(primary) };
  }

  if (PRIMARY_PIPELINES.has(route.pipeline)) {
    return {
      candidateKey: primaryKey,
      potentials: { ...candidatePotentials(primary), relationshipPotential: 0 },
    };
  }

  if (TARGETED_PIPELINES.has(route.pipeline)) {
    const targetKey = String(targetCandidateKey || '').trim();
    const target = findStoryCandidate(story, targetKey);
    if (!target || target?.source !== 'x') throw new Error(`${route.pipeline} requires targetCandidateKey to reference a real X candidate in the story.`);
    return { candidateKey: targetKey, potentials: candidatePotentials(target) };
  }

  throw new Error(`Unsupported PREPARE pipeline: ${route.pipeline}.`);
}

export function validateRecommendation(recommendation = {}, {
  story,
  allowedEvidenceIds = [],
  allowedAlgorithmMechanismTags = [],
} = {}) {
  const errors = [];
  const route = validateDecisionPipeline(recommendation.decision, recommendation.pipeline);
  if (!route.valid) errors.push(route.reason);

  const storyKey = String(story?.storyKey || '').trim();
  if (!storyKey || String(recommendation.storyKey || '') !== storyKey) errors.push('storyKey must reference the supplied story.');

  const angleClass = String(recommendation.angleClass || '');
  if (!ANGLE_CLASSES.includes(angleClass)) errors.push(`Unsupported angleClass: ${angleClass || 'missing'}.`);

  const evidenceIds = validateReferencedIds(recommendation.evidenceIds, allowedEvidenceIds);
  if (!evidenceIds.valid) errors.push(`Unknown evidenceIds: ${evidenceIds.rejected.join(', ')}.`);
  const mechanismTags = validateReferencedIds(recommendation.algorithmMechanisms, allowedAlgorithmMechanismTags);
  if (!mechanismTags.valid) errors.push(`Unknown algorithmMechanisms: ${mechanismTags.rejected.join(', ')}.`);

  const questions = uniqueStrings(recommendation.researchQuestions);
  if (route.decision === 'RESEARCH_MORE' && questions.length === 0) errors.push('RESEARCH_MORE requires at least one concrete research question.');

  if (route.valid && route.decision === 'PREPARE' && TARGETED_PIPELINES.has(route.pipeline)) {
    const target = findStoryCandidate(story, String(recommendation.targetCandidateKey || ''));
    if (!target || target?.source !== 'x') errors.push(`${route.pipeline} requires targetCandidateKey to reference a supplied X candidate.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      ...recommendation,
      decision: route.decision,
      pipeline: route.pipeline,
      evidenceIds: evidenceIds.accepted,
      algorithmMechanisms: mechanismTags.accepted,
      researchQuestions: questions,
      angleClass,
    },
  };
}

export function scoreFinalRecommendation({
  recommendation,
  story,
  objective = 'qualified_growth',
  profileProofCoverage,
  researchTopic = null,
  evidence = [],
  supportingSourceFamilies = [],
  firstPartyExperimentEvidence = false,
} = {}) {
  const selected = selectRecommendationPotentials({
    decision: recommendation?.decision,
    pipeline: recommendation?.pipeline,
    story,
    targetCandidateKey: recommendation?.targetCandidateKey,
  });
  const authority = calculateAuthorityValue({
    profileProofCoverage,
    researchTopic,
    evidence,
    angleClass: recommendation?.angleClass,
    candidateKeys: (story?.candidates || []).map(candidateKey),
    supportingSourceFamilies,
    firstPartyExperimentEvidence,
  });

  return {
    candidateKey: selected.candidateKey,
    potentials: selected.potentials,
    authority,
    objectiveFit: calculateObjectiveFit({ objective, potentials: selected.potentials, authorityValue: authority.value }),
    storyPreResearchFit: Number(story?.storyPreResearchFit || 0),
    storyKey: String(story?.storyKey || recommendation?.storyKey || ''),
  };
}

export function rankEditorialRecommendations(recommendations = []) {
  return [...(Array.isArray(recommendations) ? recommendations : [])].sort((left, right) =>
    Number(right?.objectiveFit || 0) - Number(left?.objectiveFit || 0)
    || Number(right?.storyPreResearchFit || 0) - Number(left?.storyPreResearchFit || 0)
    || String(left?.storyKey || '').localeCompare(String(right?.storyKey || '')));
}

const EDITORIAL_SCAN_CAPS = Object.freeze({ x_latest: 12, x_momentum: 12, github_trending: 10, hn_top: 10 });
const EDITORIAL_CONVERSATION_CAP = 8;
const EDITORIAL_SCAN_MAX_CANDIDATES = 52;

function compactQueueItem(queueItem) {
  if (!queueItem) return null;
  return {
    id: queueItem.id,
    lane: queueItem.lane,
    pipeline: queueItem.pipeline,
    status: queueItem.status,
    targetUsername: queueItem.targetUsername || '',
    engagementKind: queueItem.engagementKind || '',
    draftId: queueItem.draftId,
    outputTweetId: queueItem.outputTweetId || null,
    publishedAt: queueItem.publishedAt || null,
    updatedAt: queueItem.updatedAt || null,
  };
}

function workflowState(candidateKeyValue) {
  const queueItem = getQueueItemByCandidate(candidateKeyValue);
  const actions = listCandidateActions(candidateKeyValue);
  if ((actions || []).length || queueItem?.status === 'published' || queueItem?.publishedAt || queueItem?.outputTweetId) {
    return { state: 'already_handled', queueItem: compactQueueItem(queueItem), actions };
  }
  const status = String(queueItem?.status || '');
  const pipeline = String(queueItem?.pipeline || '');
  if (pipeline === 'research' || status === 'researching') return { state: 'research', queueItem: compactQueueItem(queueItem), actions };
  if (pipeline === 'watch' || status === 'watching') return { state: 'on_hold', queueItem: compactQueueItem(queueItem), actions };
  if (['ignore', 'ignored', 'skip', 'skipped'].includes(pipeline) || ['ignored', 'skipped'].includes(status)) return { state: 'skipped', queueItem: compactQueueItem(queueItem), actions };
  if (queueItem && status !== 'triage') return { state: 'draft_in_progress', queueItem: compactQueueItem(queueItem), actions };
  return { state: 'unresolved', queueItem: compactQueueItem(queueItem), actions };
}

function editorialCandidateRoutability(candidate) {
  if (!candidate) return { routable: false, reason: 'candidate_missing' };
  const queueItem = getQueueItemByCandidate(candidate.key);
  const actions = listCandidateActions(candidate.key);
  if ((actions || []).length) return { routable: false, reason: 'candidate_already_completed' };
  if (queueItem && (['approved', 'publishing', 'published'].includes(queueItem.status) || queueItem.humanApprovedAt || queueItem.outputTweetId || queueItem.publishedAt)) {
    return { routable: false, reason: 'candidate_approved_or_completed' };
  }
  return { routable: true, reason: '' };
}

function xStatusId(candidate) {
  if (candidate?.source !== 'x') return '';
  const match = String(candidate.url || candidate.key || '').match(/\/status\/(\d+)/i);
  return match?.[1] || '';
}

function recommendationSources(recommendation) {
  const keys = uniqueStrings(recommendation?.candidateKeys);
  const candidates = keys.map((key) => getCandidate(key));
  const missing = keys.filter((_, index) => !candidates[index]);
  if (missing.length) throw new Error(`Editorial recommendation ${recommendation.id} references missing source candidates: ${missing.join(', ')}.`);
  if (!candidates.length) throw new Error(`Editorial recommendation ${recommendation.id} has no source candidates.`);
  return candidates;
}

function recommendationPrimarySourceKey(recommendation, sources) {
  const preferred = String(recommendation?.potentials?.candidateKey || '').trim();
  if (preferred && sources.some((candidate) => candidate.key === preferred)) return preferred;
  return sources[0]?.key || '';
}

function enrichEditorialCandidate(recommendation, candidate, sources) {
  const editorialSourceText = sources
    .flatMap((source) => [source?.title, source?.text])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 12_000);
  upsertCandidates([{
    ...candidate,
    score: Number(recommendation?.potentials?.objectiveFit || candidate.score || 0),
    metrics: { ...(candidate.metrics || {}), editorialSourceText },
  }]);
  return getCandidate(candidate.key);
}

function selectionCandidate(recommendation, selectedPipeline, sources) {
  const primarySourceKey = recommendationPrimarySourceKey(recommendation, sources);
  if (TARGETED_PIPELINES.has(selectedPipeline)) {
    const target = getCandidate(recommendation.targetCandidateKey);
    if (!target || target.source !== 'x' || !sources.some((source) => source.key === target.key)) {
      throw new Error(`${selectedPipeline} requires recommendation targetCandidateKey to reference a real X source candidate.`);
    }
    if (!xStatusId(target)) throw new Error(`${selectedPipeline} requires a real X status target.`);
    const state = editorialCandidateRoutability(target);
    if (!state.routable) throw new Error(`Editorial ${selectedPipeline} target ${target.key} is no longer routable (${state.reason}).`);
    return { candidate: target, primarySourceKey: target.key };
  }

  if (PRIMARY_PIPELINES.has(selectedPipeline)) {
    const source = sources.length === 1 ? sources[0] : null;
    if (source && editorialCandidateRoutability(source).routable) {
      return { candidate: source, primarySourceKey: source.key };
    }
    return {
      candidate: enrichEditorialCandidate(recommendation, ensureEditorialCandidate(recommendation.id), sources),
      primarySourceKey,
    };
  }

  if (selectedPipeline === 'research') {
    const preferred = sources.find((source) => source.key === primarySourceKey && editorialCandidateRoutability(source).routable)
      || sources.find((source) => editorialCandidateRoutability(source).routable);
    if (preferred) return { candidate: preferred, primarySourceKey: preferred.key };
    return {
      candidate: enrichEditorialCandidate(recommendation, ensureEditorialCandidate(recommendation.id), sources),
      primarySourceKey,
    };
  }

  throw new Error(`Unsupported editorial selection pipeline: ${selectedPipeline}.`);
}

function linkEditorialSources(queueItem, sources, primarySourceKey) {
  const existingPrimary = listQueueSources(queueItem.id).find((source) => source.role === 'primary');
  if (existingPrimary && existingPrimary.candidateKey !== primarySourceKey) {
    throw new Error(`Queue item ${queueItem.id} is already linked to primary source ${existingPrimary.candidateKey}.`);
  }
  linkQueueSource(queueItem.id, primarySourceKey, 'primary');
  for (const source of sources) {
    if (source.key !== primarySourceKey) linkQueueSource(queueItem.id, source.key, 'supporting');
  }
  return listQueueSources(queueItem.id);
}

function selectedEditorialResult(recommendation, selection, { idempotent = false } = {}) {
  const queueItem = getQueueItem(selection.queueItemId);
  if (!queueItem) throw new Error(`Editorial selection ${selection.id} references missing queue item ${selection.queueItemId}.`);
  return {
    recommendation,
    selection,
    queueItem,
    candidate: getCandidate(queueItem.candidateKey),
    queueSources: listQueueSources(queueItem.id),
    research: recommendation.decision === 'RESEARCH_MORE' ? {
      required: true,
      state: 'manual_external_research_required',
      label: 'Manual/external research required',
      questions: [...recommendation.researchQuestions],
    } : null,
    idempotent,
  };
}

export function selectEditorialRecommendation(id, { pipelineOverride = null } = {}) {
  let recommendation = getEditorialRecommendation(id);
  if (!recommendation) throw new Error(`Editorial recommendation not found: ${id}`);
  const existing = getEditorialSelectionByRecommendation(recommendation.id);
  if (existing) {
    if (pipelineOverride && String(pipelineOverride) !== existing.selectedPipeline) {
      throw new Error(`Editorial recommendation ${recommendation.id} is already selected as ${existing.selectedPipeline}.`);
    }
    if (recommendation.status === 'suggested') recommendation = setEditorialRecommendationStatus(recommendation.id, 'selected', { at: existing.selectedAt });
    if (recommendation.status !== 'selected') throw new Error(`Editorial recommendation ${recommendation.id} has selection provenance but status is ${recommendation.status}.`);
    return selectedEditorialResult(recommendation, existing, { idempotent: true });
  }
  if (recommendation.status !== 'suggested') throw new Error(`Editorial recommendation ${recommendation.id} is ${recommendation.status} and cannot be selected.`);
  if (recommendation.decision === 'SKIP') throw new Error('SKIP recommendations are dismissed rather than routed into workflow.');

  const selectedPipeline = String(pipelineOverride || recommendation.pipeline || '');
  if (recommendation.decision === 'RESEARCH_MORE' && selectedPipeline !== 'research') {
    throw new Error('RESEARCH_MORE must enter the research workflow before any later publication route is chosen.');
  }
  if (recommendation.decision === 'PREPARE' && !PREPARE_PIPELINES.includes(selectedPipeline)) {
    throw new Error(`Invalid PREPARE pipeline override: ${selectedPipeline || 'missing'}.`);
  }

  const sources = recommendationSources(recommendation);
  const selected = selectionCandidate(recommendation, selectedPipeline, sources);
  const existingQueue = getQueueItemByCandidate(selected.candidate.key);
  if (existingQueue) {
    const existingPrimary = listQueueSources(existingQueue.id).find((source) => source.role === 'primary');
    if (existingPrimary && existingPrimary.candidateKey !== selected.primarySourceKey) {
      throw new Error(`Queue item ${existingQueue.id} is already linked to primary source ${existingPrimary.candidateKey}.`);
    }
  }

  let queueItem = routeCandidate(selected.candidate.key, selectedPipeline, {
    actor: 'human',
    reason: `Human selected editorial recommendation ${recommendation.id}.`,
  });
  queueItem = saveQueueItem({
    ...queueItem,
    reachPotential: Number(recommendation.potentials?.reachPotential || 0),
    followPotential: Number(recommendation.potentials?.followPotential || 0),
    conversationPotential: Number(recommendation.potentials?.conversationPotential || 0),
    relationshipPotential: Number(recommendation.potentials?.relationshipPotential || 0),
    recommendedPipeline: recommendation.pipeline || '',
    routingReason: recommendation.whyThisFormat || recommendation.whyNow || queueItem.routingReason || '',
  });
  const queueSources = linkEditorialSources(queueItem, sources, selected.primarySourceKey);
  const selectedAt = Date.now();
  const selection = recordEditorialSelection({
    editorialRecommendationId: recommendation.id,
    queueItemId: queueItem.id,
    selectedPipeline,
    selectedAt,
  });
  recommendation = setEditorialRecommendationStatus(recommendation.id, 'selected', { at: selectedAt });
  return { ...selectedEditorialResult(recommendation, selection), queueSources };
}

export function dismissEditorialRecommendation(id) {
  const recommendation = getEditorialRecommendation(id);
  if (!recommendation) throw new Error(`Editorial recommendation not found: ${id}`);
  if (getEditorialSelectionByRecommendation(recommendation.id)) {
    throw new Error(`Editorial recommendation ${recommendation.id} is already selected and cannot be dismissed.`);
  }
  return setEditorialRecommendationStatus(recommendation.id, 'dismissed');
}

function xUsername(candidate) {
  const title = String(candidate?.title || '').trim().replace(/^@/, '');
  if (/^[A-Za-z0-9_]{1,30}$/.test(title)) return title.toLowerCase();
  try {
    const username = new URL(String(candidate?.url || '')).pathname.split('/').filter(Boolean)[0] || '';
    return /^[A-Za-z0-9_]{1,30}$/.test(username) ? username.toLowerCase() : '';
  } catch {
    return '';
  }
}

function compactRelationship(profile) {
  if (!profile) return null;
  return {
    username: profile.username,
    classes: profile.classes || profile.classNames || [],
    relationshipStage: profile.relationshipStage,
    targetScore: profile.targetScore,
    relevanceScore: profile.relevanceScore,
    followsYou: profile.followsYou,
    youFollow: profile.youFollow,
    mutual: profile.mutual,
    primaryTopics: profile.primaryTopics || [],
    scoreExplanation: profile.scoreExplanation || null,
  };
}

function compactPublished(item) {
  return {
    candidateKey: item.candidateKey,
    pipeline: item.pipeline,
    publishedAt: item.publishedAt || null,
    outputTweetId: item.outputTweetId || item.publishedTweetId || null,
    text: String(item.text || '').slice(0, 2000),
    semanticAnchors: item.semanticAnchors || [],
    topics: item.topics || [],
  };
}

function compactApproved(item) {
  return {
    candidateKey: item.candidateKey,
    pipeline: item.pipeline,
    status: item.status,
    scheduledAt: item.scheduledAt || null,
    text: String(item.text || '').slice(0, 2000),
    semanticAnchors: item.semanticAnchors || [],
    topics: item.topics || [],
  };
}

function compactLearnedRule(rule) {
  return {
    id: rule.id,
    scope: rule.scope,
    key: rule.key,
    recommendation: rule.recommendation || {},
    evidence: rule.evidence || {},
    adjustment: rule.adjustment,
    status: rule.status,
  };
}

function editorialCandidate(candidate, { snapshotKind = '', snapshotFetchedAt = null, now, preference, learnedRules, publishedMainFeed }) {
  const username = candidate?.source === 'x' ? xUsername(candidate) : '';
  const relationship = username ? getRelationshipProfile(username) : null;
  const opportunity = scoreOpportunity(candidate, {
    now,
    preference,
    relationship: relationship ? { ...relationship, nicheTags: relationship.primaryTopics || [] } : null,
    learnedRules,
  });
  const topicMatches = matchResearchTopics(candidate);
  const researchTopic = topicMatches[0] || null;
  const profileProof = calculateProfileProofCoverage({
    topic: researchTopic,
    semanticAnchors: researchTopic?.matchedAnchors || [],
    publishedMainFeedItems: publishedMainFeed,
  });
  return {
    key: candidate.key,
    source: candidate.source,
    title: candidate.title || '',
    text: candidate.text || '',
    url: candidate.url || '',
    timestamp: candidate.timestamp || null,
    metrics: candidate.metrics || {},
    niche: candidate.niche || { score: 0, tags: [], matches: [] },
    viral: candidate.viral || null,
    snapshotKind,
    snapshotKinds: snapshotKind ? [snapshotKind] : [],
    snapshotFetchedAt,
    snapshotFetchedAtByKind: snapshotKind ? { [snapshotKind]: snapshotFetchedAt } : {},
    latestObservationAt: getSourceMomentum(candidate.key, snapshotKind || (candidate.source === 'x' ? 'x_latest' : candidate.source === 'github' ? 'github_trending' : candidate.source === 'hn' ? 'hn_top' : 'x_latest')).current?.observedAt || candidate.timestamp || 0,
    sourceMomentum: snapshotKind ? getSourceMomentum(candidate.key, snapshotKind) : null,
    sourceMomentumBySnapshot: snapshotKind ? { [snapshotKind]: getSourceMomentum(candidate.key, snapshotKind) } : {},
    workflow: workflowState(candidate.key),
    opportunity,
    potentials: {
      reachPotential: opportunity.reachPotential,
      followPotential: opportunity.followPotential,
      conversationPotential: opportunity.conversationPotential,
      relationshipPotential: opportunity.relationshipPotential,
    },
    relationship: compactRelationship(relationship),
    researchTopic,
    researchTopicMatches: topicMatches,
    profileProof,
  };
}

export function buildEditorialContext({ objective = 'qualified_growth', now = Date.now() } = {}) {
  const selectedObjective = validateEditorialObjective(objective);
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('buildEditorialContext requires a positive numeric now timestamp.');
  const preference = getPreferenceProfile();
  const learnedRules = listAcceptedLearnedRules({ limit: 100 });
  const publishedMainFeed = listPublishedMainFeedContent({ limit: 30 });
  const snapshotState = Object.fromEntries(SOURCE_SNAPSHOT_KINDS.map((kind) => {
    const snapshot = getDiscoverSnapshot(kind);
    return [kind, {
      kind,
      fetchedAt: snapshot.fetchedAt,
      ageMs: snapshot.fetchedAt == null ? null : Math.max(0, timestamp - snapshot.fetchedAt),
      lastRefreshAttemptAt: snapshot.lastRefreshAttemptAt,
      error: snapshot.error,
      legacyFallback: snapshot.legacyFallback,
      candidateCount: snapshot.candidates.length,
      candidateKeys: snapshot.candidates.map((candidate) => candidate.key),
    }];
  }));

  const seen = new Map();
  const scanCandidates = [];
  const addCandidate = (candidate, metadata) => {
    if (!candidate?.key) return;
    const existing = seen.get(candidate.key);
    if (existing) {
      if (metadata.snapshotKind && !existing.snapshotKinds.includes(metadata.snapshotKind)) {
        const momentum = getSourceMomentum(candidate.key, metadata.snapshotKind);
        existing.snapshotKinds.push(metadata.snapshotKind);
        existing.snapshotFetchedAtByKind[metadata.snapshotKind] = metadata.snapshotFetchedAt;
        existing.sourceMomentumBySnapshot[metadata.snapshotKind] = momentum;
        existing.latestObservationAt = Math.max(existing.latestObservationAt || 0, momentum.current?.observedAt || candidate.timestamp || 0);
      }
      return;
    }
    if (scanCandidates.length >= EDITORIAL_SCAN_MAX_CANDIDATES) return;
    const value = editorialCandidate(candidate, {
      ...metadata,
      now: timestamp,
      preference,
      learnedRules,
      publishedMainFeed,
    });
    seen.set(candidate.key, value);
    scanCandidates.push(value);
  };

  for (const kind of SOURCE_SNAPSHOT_KINDS) {
    const snapshot = getDiscoverSnapshot(kind);
    for (const candidate of snapshot.candidates.slice(0, EDITORIAL_SCAN_CAPS[kind])) {
      addCandidate(candidate, { snapshotKind: kind, snapshotFetchedAt: snapshot.fetchedAt });
    }
  }

  const engagementItems = listEngagementItems({ includeExpired: false, limit: 100 })
    .filter((item) => !['expired', 'completed', 'published', 'ignored', 'skipped'].includes(String(item.status || '')))
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))
    .slice(0, EDITORIAL_CONVERSATION_CAP);
  for (const item of engagementItems) {
    const candidate = getCandidate(item.candidateKey);
    if (candidate) addCandidate(candidate, { snapshotKind: '', snapshotFetchedAt: null });
  }
  const activeConversationKeys = new Set(engagementItems.map((item) => item.candidateKey));
  scanCandidates.sort((left, right) => Number(activeConversationKeys.has(right.key)) - Number(activeConversationKeys.has(left.key)));

  const algorithmEvidence = resolveAlgorithmMechanisms(listAlgorithmEvidenceEntries());
  const recentPublished = listRecentMainFeedPublications({ limit: 20 }).map(compactPublished);
  const approvedMainFeed = listApprovedMainFeedItems({ automatedOnly: false, limit: 20 }).map(compactApproved);
  return {
    objective: selectedObjective,
    objectiveWeights: EDITORIAL_OBJECTIVE_WEIGHTS[selectedObjective],
    generatedAt: timestamp,
    sourceSnapshots: snapshotState,
    scanCandidates,
    activeConversationItems: engagementItems.map((item) => ({
      candidateKey: item.candidateKey,
      priority: item.priority,
      targetUsername: item.targetUsername,
      engagementKind: item.engagementKind,
      status: item.status,
      expiresAt: item.expiresAt,
    })),
    accountHealth: getAccountHealthSummary({ now: timestamp }),
    recentOwnedContent: { published: recentPublished, approved: approvedMainFeed },
    publishedProfileProofSource: publishedMainFeed.map(compactPublished),
    measurementSummary: listPublicationMeasurementSeries({ limit: 10 }),
    acceptedLearnedRules: learnedRules.map(compactLearnedRule),
    algorithmEvidence,
  };
}

function evidencePacket(row) {
  return {
    id: String(row.id),
    storyKey: row.storyKey,
    candidateKey: row.candidateKey,
    claim: row.claim,
    claimType: row.claimType,
    status: row.status,
    sourceKind: row.sourceKind,
    sourceFamily: row.sourceFamily,
    requestedUrl: row.requestedUrl,
    resolvedUrl: row.resolvedUrl,
    title: row.title,
    summary: row.summary,
    observedAt: row.observedAt,
  };
}

function sourceSnapshotRecord(context, refreshResult) {
  return {
    snapshots: context.sourceSnapshots,
    refresh: refreshResult ? {
      fetchedAt: refreshResult.fetchedAt,
      results: refreshResult.results.map((result) => ({ kind: result.kind, fetchedAt: result.fetchedAt, attemptedAt: result.attemptedAt, error: result.error, candidateCount: result.candidates.length })),
      errors: refreshResult.errors,
    } : null,
  };
}

function storyFromCluster(cluster, candidatesByKey, objective, publishedMainFeed) {
  const candidates = cluster.candidateKeys.map((key) => candidatesByKey.get(key)).filter(Boolean);
  const classification = classifyResearchStory(candidates);
  const researchTopic = classification.primaryTopic;
  const profileProof = calculateProfileProofCoverage({
    topic: researchTopic,
    semanticAnchors: researchTopic?.matchedAnchors || [],
    publishedMainFeedItems: publishedMainFeed,
  });
  const score = scoreStoryPreResearch({
    storyKey: cluster.storyKey,
    candidates,
    objective,
    profileProofCoverage: profileProof,
    researchTopic,
  });
  return {
    ...cluster,
    candidates,
    researchTopic,
    researchTopicMatches: classification.matches,
    profileProof,
    ...score,
  };
}

function recommendationAlgorithmEvidence(tags, available) {
  const byTag = new Map(available.map((entry) => [entry.tag, entry]));
  return tags.map((tag) => byTag.get(tag)).filter(Boolean);
}

export async function refreshEditorialPlan({ objective = 'qualified_growth', refreshSources = false, now = Date.now() } = {}) {
  const selectedObjective = validateEditorialObjective(objective);
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('refreshEditorialPlan requires a positive numeric now timestamp.');
  let refreshResult = null;
  if (refreshSources) {
    const { refreshAllSourceSnapshots } = await import('./source_refresh.js');
    refreshResult = await refreshAllSourceSnapshots();
  }

  const context = buildEditorialContext({ objective: selectedObjective, now: timestamp });
  const run = createEditorialRun({
    objective: selectedObjective,
    sourceSnapshot: sourceSnapshotRecord(context, refreshResult),
    context,
    createdAt: timestamp,
  });

  try {
    const { runEditorialFinal, runEditorialScan } = await import('./editorial_runtime.js');
    const scanResult = await runEditorialScan(context);
    const allowedCandidateKeys = context.scanCandidates.map((candidate) => candidate.key);
    const candidatesByKey = new Map(context.scanCandidates.map((candidate) => [candidate.key, candidate]));
    const publishedMainFeed = listPublishedMainFeedContent({ limit: 30 });
    const validatedClusters = [];
    for (const rawCluster of scanResult.stories) {
      const validation = validateStoryCluster(rawCluster, { allowedCandidateKeys });
      if (!validation.valid) throw new Error(`Invalid editorial scan cluster: ${validation.errors.join(' ')}`);
      validatedClusters.push(validation.normalized);
    }
    const rankedStories = rankPreResearchStories(validatedClusters.map((cluster) => storyFromCluster(
      cluster, candidatesByKey, selectedObjective, publishedMainFeed,
    )));
    const researchStories = rankedStories.slice(0, 5);
    updateEditorialRun(run.id, {
      scan: { stories: rankedStories },
      aiExecution: { scan: scanResult.execution },
    });

    if (researchStories.length === 0) {
      const completeRun = updateEditorialRun(run.id, {
        context: { ...context, noStrongCurrentAction: true, noStrongCurrentActionReason: 'Editorial scan returned no current story clusters.' },
        status: 'complete',
        completedAt: Date.now(),
      });
      supersedeSuggestedEditorialRecommendations(selectedObjective, { exceptRunId: run.id });
      return { run: completeRun, recommendations: [], refresh: refreshResult };
    }

    const { collectStoryResearch } = await import('./research.js');
    for (const story of researchStories) await collectStoryResearch({ editorialRunId: run.id, story });
    const evidence = listResearchEvidence({ editorialRunId: run.id });
    const finalPacket = {
      objective: selectedObjective,
      objectiveWeights: EDITORIAL_OBJECTIVE_WEIGHTS[selectedObjective],
      stories: researchStories,
      evidence: evidence.map(evidencePacket),
      algorithmMechanisms: context.algorithmEvidence.available,
      accountHealth: context.accountHealth,
      recentOwnedContent: context.recentOwnedContent,
      acceptedLearnedRules: context.acceptedLearnedRules,
    };
    const finalResult = await runEditorialFinal(finalPacket);
    const storyByKey = new Map(researchStories.map((story) => [story.storyKey, story]));
    const evidenceById = new Map(evidence.map((item) => [String(item.id), item]));
    const allowedMechanismTags = context.algorithmEvidence.available.map((item) => item.tag);
    const scored = [];
    for (const rawRecommendation of finalResult.recommendations) {
      const story = storyByKey.get(String(rawRecommendation.storyKey || ''));
      if (!story) throw new Error(`Editorial final result references unknown storyKey: ${rawRecommendation.storyKey || 'missing'}.`);
      const storyEvidence = evidence.filter((item) => item.storyKey === story.storyKey);
      const validation = validateRecommendation(rawRecommendation, {
        story,
        allowedEvidenceIds: storyEvidence.map((item) => String(item.id)),
        allowedAlgorithmMechanismTags: allowedMechanismTags,
      });
      if (!validation.valid) throw new Error(`Invalid editorial recommendation for ${story.storyKey}: ${validation.errors.join(' ')}`);
      const recommendation = validation.normalized;
      const referencedEvidence = recommendation.evidenceIds.map((id) => evidenceById.get(String(id))).filter(Boolean);
      if (recommendation.decision === 'PREPARE' && context.accountHealth?.health?.state === 'constrained') {
        throw new Error(`PREPARE recommendation ${story.storyKey} conflicts with the current constrained account-health state.`);
      }
      if (recommendation.decision === 'PREPARE' && story.candidates.every((candidate) => candidate.workflow?.state === 'already_handled')) {
        throw new Error(`PREPARE recommendation ${story.storyKey} contains only already-handled source candidates.`);
      }
      if (recommendation.decision === 'PREPARE' && referencedEvidence.some((item) => ['unresolved', 'contradicted'].includes(item.status))) {
        throw new Error(`PREPARE recommendation ${story.storyKey} references unresolved or contradicted evidence.`);
      }
      const scoredRecommendation = scoreFinalRecommendation({
        recommendation,
        story,
        objective: selectedObjective,
        profileProofCoverage: story.profileProof,
        researchTopic: story.researchTopic,
        evidence: referencedEvidence,
        supportingSourceFamilies: referencedEvidence.map((item) => item.sourceFamily),
      });
      scored.push({ ...recommendation, ...scoredRecommendation, story });
    }

    const ordered = rankEditorialRecommendations(scored).slice(0, 5);
    const persisted = ordered.map((item, index) => saveEditorialRecommendation({
      editorialRunId: run.id,
      storyKey: item.storyKey,
      rank: index + 1,
      decision: item.decision,
      pipeline: item.pipeline,
      objective: selectedObjective,
      title: item.title,
      thesis: item.thesis,
      whyNow: item.whyNow,
      whyThisFormat: item.whyThisFormat,
      desiredReaderOutcome: item.desiredReaderOutcome,
      candidateKeys: item.story.candidates.map((candidate) => candidate.key),
      targetCandidateKey: item.targetCandidateKey,
      potentials: {
        ...item.potentials,
        candidateKey: item.candidateKey,
        objectiveFit: item.objectiveFit,
        storyPreResearchFit: item.storyPreResearchFit,
        potentialInterpretation: item.potentialInterpretation || {},
      },
      authority: item.authority,
      profileProof: item.story.profileProof,
      evidenceIds: item.evidenceIds,
      algorithmEvidence: recommendationAlgorithmEvidence(item.algorithmMechanisms, context.algorithmEvidence.available),
      learnedContext: { empiricalContext: item.empiricalContext || [] },
      aiExecution: finalResult.execution,
      risks: item.riskFlags || [],
      alternatives: item.alternatives || [],
      researchQuestions: item.researchQuestions || [],
      createdAt: Date.now(),
    }));
    const completeRun = updateEditorialRun(run.id, {
      context: {
        ...context,
        noStrongCurrentAction: persisted.length === 0,
        noStrongCurrentActionReason: persisted.length === 0 ? 'Final editorial reasoning returned no recommendations.' : '',
      },
      aiExecution: { scan: scanResult.execution, final: finalResult.execution },
      status: 'complete',
      completedAt: Date.now(),
    });
    supersedeSuggestedEditorialRecommendations(selectedObjective, { exceptRunId: run.id });
    return { run: completeRun, recommendations: persisted, refresh: refreshResult };
  } catch (error) {
    updateEditorialRun(run.id, { status: 'failed', error: error.message, completedAt: Date.now() });
    throw error;
  }
}
