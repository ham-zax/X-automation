export const EDITORIAL_OBJECTIVE_WEIGHTS = Object.freeze({
  qualified_growth: Object.freeze({ reach: 0.20, follow: 0.40, conversation: 0.10, relationship: 0.10, authority: 0.20 }),
  reach_momentum: Object.freeze({ reach: 0.55, follow: 0.20, conversation: 0.10, relationship: 0.05, authority: 0.10 }),
  relationships: Object.freeze({ reach: 0.05, follow: 0.10, conversation: 0.35, relationship: 0.40, authority: 0.10 }),
  technical_authority: Object.freeze({ reach: 0.15, follow: 0.25, conversation: 0.10, relationship: 0.05, authority: 0.45 }),
  balanced: Object.freeze({ reach: 0.25, follow: 0.25, conversation: 0.20, relationship: 0.15, authority: 0.15 }),
});

export const EDITORIAL_OBJECTIVES = Object.freeze(Object.keys(EDITORIAL_OBJECTIVE_WEIGHTS));
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
    return {
      candidateKey: keyValue,
      source: String(candidate?.source || ''),
      snapshotKind: String(candidate?.snapshotKind || ''),
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
    distinctSnapshotKinds: new Set(candidateFits.map((candidate) => candidate.snapshotKind).filter(Boolean)).size,
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
