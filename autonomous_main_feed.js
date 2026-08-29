import { fetchAccountPerformance } from './tech_news.js';
import {
  refreshEditorialPlan,
  selectEditorialRecommendationAsMissionAgent,
} from './editorial.js';
import { getOperatorLeaseStatus } from './operator_lease.js';
import {
  approveQueueItemAsMissionAgent,
  requestQueueReview,
  routeCandidate,
} from './pipeline.js';
import { rankMainFeedItems } from './scheduler.js';
import {
  assignExperimentVariant,
  completeFirst1000MainFeedMission,
  getAccountHealthSummary,
  getCandidate,
  getDraftByCandidate,
  getEditorialRecommendation,
  getEditorialSelectionByRecommendation,
  getFirst1000MainFeedMissionGrant,
  getLatestEditorialPlan,
  getLatestEditorialSelectionForQueueItem,
  getLatestWritingStrategySelectionForQueueItem,
  getNicheProfile,
  getPerformanceSnapshot,
  getQueueItem,
  listAcceptedLearnedRules,
  listApprovedMainFeedItems,
  listEditorialRecommendations,
  listExperimentAssignments,
  listExperiments,
  listQueueItems,
  listQueueSources,
  listRecentMainFeedPublications,
  listResearchEvidence,
  recordPerformanceSnapshot,
} from './store.js';
import { selectWritingStrategyAsMissionAgent } from './writing_strategy.js';

const MISSION_PIPELINES = new Set(['original', 'quote', 'thread']);
const MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread', 'repost']);
const MISSION_REPAIRABLE_GATE_CODES = new Set(['EVIDENCE_CLAIM_SCOPE_MISMATCH', 'THREAD_PART_TOO_LONG']);
const MISSION_REVIEW_CONFIRMATION_GATE_CODES = new Set(['FACTUALITY_UNCONFIRMED', 'EVIDENCE_UNCONFIRMED']);

function compactGrant(grant) {
  return {
    state: grant.state,
    mode: grant.mode,
    revision: Number(grant.revision),
    targetFollowers: Number(grant.targetFollowers),
  };
}

function storedFollowerState(grant) {
  const account = getPerformanceSnapshot(1)?.account || null;
  const count = account == null ? null : Number(account.followers);
  const capturedAt = account == null ? null : Number(account.captured_at);
  const validCount = Number.isFinite(count) ? count : null;
  return {
    count: validCount,
    capturedAt: Number.isFinite(capturedAt) ? capturedAt : null,
    targetReached: validCount == null ? null : validCount >= Number(grant.targetFollowers),
  };
}

function approvedSchedulerWork(now) {
  const approved = listApprovedMainFeedItems({ automatedOnly: true, limit: 100 });
  if (!approved.length) return null;
  const recentPosts = listRecentMainFeedPublications({ limit: 20 });
  const decisions = rankMainFeedItems(approved, {
    now,
    recentPosts,
    lastMainFeedPostAt: recentPosts[0]?.publishedAt ?? null,
    learnedRules: listAcceptedLearnedRules({ limit: 500 }),
  });
  return decisions.find((decision) => decision.eligible) || null;
}

function unresolvedPublishingItem() {
  return listQueueItems({ status: 'publishing', limit: 100 })
    .find((item) => ['main', 'main_feed'].includes(item.lane) && MAIN_FEED_PIPELINES.has(item.pipeline)) || null;
}

export function getAutonomousMainFeedMissionStatus({ now = Date.now() } = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('Autonomous main-feed status requires numeric now.');
  const grant = getFirst1000MainFeedMissionGrant();
  const followers = storedFollowerState(grant);
  const health = getAccountHealthSummary({ now: timestamp }).health;
  const lease = getOperatorLeaseStatus({ now: timestamp });
  const publishing = unresolvedPublishingItem();
  const approved = approvedSchedulerWork(timestamp);

  let blockingReason = null;
  if (grant.state !== 'running') blockingReason = `grant_${grant.state}`;
  else if (grant.mode !== 'live') blockingReason = `grant_mode_${grant.mode}`;
  else if (followers.count == null) blockingReason = 'followers_unavailable';
  else if (followers.targetReached) blockingReason = 'target_reached';
  else if (health.state === 'constrained') blockingReason = 'account_health_constrained';
  else if (lease.active) blockingReason = 'operator_lease_active';
  else if (publishing) blockingReason = 'publishing_reconciliation_required';
  else if (approved) blockingReason = 'approved_scheduler_work_available';

  return {
    grant: compactGrant(grant),
    followers,
    health: { state: health.state },
    operatorLease: {
      status: lease.status,
      active: lease.active,
      expiresAt: lease.expiresAt,
    },
    preparation: {
      allowed: blockingReason == null,
      blockingReason,
      publishingQueueItemId: publishing?.id ?? null,
      approvedQueueItemId: approved?.item?.id ?? null,
    },
  };
}

export async function refreshFirst1000MissionFollowerState({
  now = Date.now(),
  account = process.env.X_ACCOUNT || 'ham_zax',
  performanceSource = fetchAccountPerformance,
} = {}) {
  const startedAt = Number(now);
  if (!Number.isFinite(startedAt)) throw new Error('Mission follower refresh requires numeric now.');
  const startingGrant = getFirst1000MainFeedMissionGrant();
  if (startingGrant.state !== 'running') {
    return {
      required: false,
      fresh: false,
      grantRevision: startingGrant.revision,
      followers: storedFollowerState(startingGrant),
      completed: false,
      error: null,
    };
  }

  const performance = await performanceSource(account, 1);
  if (performance?.error) {
    return {
      required: true,
      fresh: false,
      grantRevision: startingGrant.revision,
      followers: storedFollowerState(startingGrant),
      completed: false,
      error: String(performance.error),
    };
  }
  const capturedAt = Number(performance?.capturedAt || performance?.profile?.capturedAt || Date.now());
  const followers = Number(performance?.profile?.followersCount);
  if (!Number.isFinite(capturedAt) || !Number.isFinite(followers)) {
    return {
      required: true,
      fresh: false,
      grantRevision: startingGrant.revision,
      followers: storedFollowerState(startingGrant),
      completed: false,
      error: 'Follower count unavailable from fresh account-performance read.',
    };
  }

  recordPerformanceSnapshot({ profile: performance.profile, posts: performance.posts || [], capturedAt });
  const currentGrant = getFirst1000MainFeedMissionGrant();
  if (currentGrant.state !== 'running' || Number(currentGrant.revision) !== Number(startingGrant.revision)) {
    return {
      required: true,
      fresh: false,
      grantRevision: startingGrant.revision,
      followers: { count: followers, capturedAt, targetReached: followers >= Number(currentGrant.targetFollowers) },
      completed: false,
      authorityChanged: true,
      error: 'First-1,000 mission authority changed during follower refresh.',
    };
  }

  if (followers >= Number(currentGrant.targetFollowers)) {
    const completedGrant = completeFirst1000MainFeedMission({ actor: 'agent' });
    return {
      required: true,
      fresh: true,
      grantRevision: startingGrant.revision,
      followers: { count: followers, capturedAt, targetReached: true },
      completed: true,
      completedGrant: compactGrant(completedGrant),
      error: null,
    };
  }

  return {
    required: true,
    fresh: true,
    grantRevision: startingGrant.revision,
    followers: { count: followers, capturedAt, targetReached: false },
    completed: false,
    error: null,
  };
}

function objective() {
  return getNicheProfile().profile.defaultObjective || 'qualified_growth';
}

function activeExperimentForDimension(dimension) {
  const active = listExperiments({ status: 'active', limit: 100 })
    .filter((experiment) => experiment.dimension === dimension);
  if (active.length > 1) throw new Error(`Autonomous main-feed preparation requires at most one active ${dimension} experiment.`);
  return active[0] || null;
}

function balancedExperimentVariant(experiment) {
  const counts = new Map((experiment?.variants || []).map((variant) => [variant.label, 0]));
  for (const assignment of listExperimentAssignments(experiment.id)) {
    counts.set(assignment.variantLabel, Number(counts.get(assignment.variantLabel) || 0) + 1);
  }
  return (experiment?.variants || [])
    .map((variant, index) => ({ variant, index, count: Number(counts.get(variant.label) || 0) }))
    .sort((left, right) => left.count - right.count || left.index - right.index)[0]?.variant || null;
}

function assignContentExperimentIfEligible(queueItem) {
  if (queueItem.experimentVariantId != null) return queueItem;

  const hookExperiment = activeExperimentForDimension('hook_type');
  if (hookExperiment) {
    const variant = balancedExperimentVariant(hookExperiment);
    const patternId = String(variant?.config?.patternId ?? variant?.config?.pattern_id ?? variant?.label ?? '').trim();
    const hookInstructions = String(variant?.config?.hookInstructions ?? variant?.config?.hook_instructions ?? '').trim();
    const openingFeatures = Array.isArray(variant?.config?.openingFeatures ?? variant?.config?.opening_features)
      ? [...(variant.config.openingFeatures ?? variant.config.opening_features)]
      : [];
    if (!variant || !patternId || !hookInstructions) {
      throw new Error('Active hook_type experiment variants require patternId and hookInstructions.');
    }
    return assignExperimentVariant(queueItem.candidateKey, hookExperiment.id, variant.label, {
      context: { hookPattern: patternId, hookInstructions, openingFeatures },
    });
  }

  const hashtagExperiment = activeExperimentForDimension('hashtag_count');
  if (!hashtagExperiment) return queueItem;
  const variant = balancedExperimentVariant(hashtagExperiment);
  const hashtagCount = Number(variant?.config?.hashtagCount ?? variant?.config?.hashtag_count);
  if (!variant || !Number.isInteger(hashtagCount) || hashtagCount < 0 || hashtagCount > 2) return queueItem;
  return assignExperimentVariant(queueItem.candidateKey, hashtagExperiment.id, variant.label, {
    context: { hashtagCount },
  });
}

function selectUsableRecommendation(recommendations = [], grantRevision) {
  const candidates = [...recommendations]
    .filter((item) => item.status === 'suggested' && item.decision === 'PREPARE' && MISSION_PIPELINES.has(item.pipeline))
    .filter((item) => item.potentials?.distributionRoutable !== false)
    .sort((left, right) => Number(left.rank || 0) - Number(right.rank || 0) || Number(left.id) - Number(right.id));

  for (const recommendation of candidates) {
    try {
      const selected = selectEditorialRecommendationAsMissionAgent(recommendation.id, { grantRevision });
      return { recommendation: selected.recommendation, selection: selected.selection, queueItem: selected.queueItem };
    } catch (error) {
      if (String(error?.message || '').includes('currently recommended Ignore')) continue;
      throw error;
    }
  }
  return null;
}

function missionRepairableDraft(draft) {
  const generations = Array.isArray(draft?.editor?.generationHistory) ? draft.editor.generationHistory : [];
  const failures = Array.isArray(draft?.gates?.failures) ? draft.gates.failures : [];
  const writerFailures = failures.filter((failure) => !MISSION_REVIEW_CONFIRMATION_GATE_CODES.has(String(failure?.code || '')));
  return generations.length === 1
    && writerFailures.length > 0
    && writerFailures.every((failure) => MISSION_REPAIRABLE_GATE_CODES.has(String(failure?.code || '')))
    && failures.every((failure) => MISSION_REPAIRABLE_GATE_CODES.has(String(failure?.code || ''))
      || MISSION_REVIEW_CONFIRMATION_GATE_CODES.has(String(failure?.code || '')));
}

function resumableMissionSelection(grantRevision) {
  return listEditorialRecommendations({ status: 'selected', limit: 100 })
    .map((recommendation) => ({ recommendation, selection: getEditorialSelectionByRecommendation(recommendation.id) }))
    .filter(({ recommendation, selection }) => selection
      && selection.selectedBy === 'mission_agent'
      && Number(selection.grantRevision) === Number(grantRevision)
      && recommendation.decision === 'PREPARE'
      && MISSION_PIPELINES.has(recommendation.pipeline))
    .map((entry) => ({ ...entry, queueItem: getQueueItem(entry.selection.queueItemId) }))
    .filter(({ queueItem }) => queueItem?.status === 'drafting')
    .sort((left, right) => Number(left.selection.selectedAt) - Number(right.selection.selectedAt))[0] || null;
}

function requirePreparationAuthority(grantRevision, now = Date.now()) {
  const status = getAutonomousMainFeedMissionStatus({ now });
  if (Number(status.grant.revision) !== Number(grantRevision)) {
    throw new Error('First-1,000 mission revision changed during autonomous preparation.');
  }
  if (!status.preparation.allowed) {
    throw new Error(`Autonomous main-feed preparation blocked: ${status.preparation.blockingReason}.`);
  }
  return status;
}

function currentMissionStrategy(queueItem, grantRevision) {
  const selection = getLatestWritingStrategySelectionForQueueItem(queueItem.id);
  if (!selection) return null;
  if (selection.selectedBy === 'human') return selection;
  const authority = selection.guidance?.selectionAuthority || null;
  return selection.selectedBy === 'mission_agent'
    && authority?.mission === 'first_1000_main_feed'
    && Number(authority.grantRevision) === Number(grantRevision)
    ? selection
    : null;
}

function generationMatchesSelection(draft, selection) {
  return Boolean(draft?.editor?.generation
    && ['POST', 'DO_NOT_POST'].includes(draft?.editor?.decision)
    && Number(draft.editor.generation.strategySelectionId) === Number(selection?.id));
}

function missionVerificationProvenance(queueItem, draft) {
  const sourceReferences = [...new Set(listQueueSources(queueItem.id)
    .map((source) => getCandidate(source.candidateKey))
    .filter(Boolean)
    .map((candidate) => String(candidate.url || candidate.key || '').trim())
    .filter(Boolean))];

  const editorialSelection = getLatestEditorialSelectionForQueueItem(queueItem.id);
  const recommendation = editorialSelection ? getEditorialRecommendation(editorialSelection.editorialRecommendationId) : null;
  const storedEvidence = recommendation
    ? listResearchEvidence({ editorialRunId: recommendation.editorialRunId, storyKey: recommendation.storyKey })
    : [];
  const storedEvidenceIds = new Set(storedEvidence.map((item) => String(item.id)));
  const requestedEvidence = [...new Set((draft?.editor?.evidenceUsed || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const invalidEvidence = requestedEvidence.filter((id) => !storedEvidenceIds.has(id));
  if (invalidEvidence.length) {
    throw new Error(`Writer evidence provenance no longer resolves to stored Editorial evidence: ${invalidEvidence.join(', ')}.`);
  }

  return {
    authorityType: 'mission_agent',
    sourceReferences,
    evidenceReferences: requestedEvidence,
  };
}

export async function prepareAutonomousMainFeed({
  now = Date.now(),
  freshFollowerState = null,
  editorialAlreadyRefreshed = false,
} = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('Autonomous main-feed preparation requires numeric now.');
  const initialStatus = getAutonomousMainFeedMissionStatus({ now: timestamp });
  if (!initialStatus.preparation.allowed) {
    return { action: 'noop', reason: initialStatus.preparation.blockingReason, status: initialStatus };
  }
  if (!freshFollowerState?.fresh || Number(freshFollowerState.grantRevision) !== Number(initialStatus.grant.revision)) {
    return { action: 'noop', reason: 'fresh_follower_observation_required', status: initialStatus };
  }

  const grantRevision = Number(initialStatus.grant.revision);
  let work = resumableMissionSelection(grantRevision);
  let editorialRefreshed = Boolean(editorialAlreadyRefreshed);
  if (!work) {
    const selectedObjective = objective();
    let plan = getLatestEditorialPlan(selectedObjective);
    requirePreparationAuthority(grantRevision);
    work = selectUsableRecommendation(plan?.recommendations || [], grantRevision);
    if (!work && !editorialRefreshed) {
      await refreshEditorialPlan({ objective: selectedObjective, refreshSources: false });
      editorialRefreshed = true;
      requirePreparationAuthority(grantRevision);
      plan = getLatestEditorialPlan(selectedObjective);
      work = selectUsableRecommendation(plan?.recommendations || [], grantRevision);
    }
    if (!work) {
      return { action: 'noop', reason: 'no_current_prepare_recommendation', editorialRefreshed };
    }
  }

  let queueItem = getQueueItem(work.queueItem.id);
  let draft = getDraftByCandidate(queueItem.candidateKey);
  if (!draft) throw new Error(`Mission-owned queue item ${queueItem.id} has no draft.`);

  requirePreparationAuthority(grantRevision);
  queueItem = assignContentExperimentIfEligible(queueItem);

  requirePreparationAuthority(grantRevision);
  let strategySelection = currentMissionStrategy(queueItem, grantRevision);
  if (!strategySelection) {
    strategySelection = await selectWritingStrategyAsMissionAgent(queueItem.id, {
      grantRevision,
      draftId: draft.id,
    });
  }

  requirePreparationAuthority(grantRevision);
  if (!generationMatchesSelection(draft, strategySelection)) {
    const { generateDraftCandidate } = await import('./web_api.js');
    const generated = await generateDraftCandidate(draft);
    draft = generated.saved;
    queueItem = generated.queueItem;
  }

  requirePreparationAuthority(grantRevision);
  if (draft?.editor?.decision === 'DO_NOT_POST') {
    const ignored = routeCandidate(queueItem.candidateKey, 'ignore', {
      actor: 'agent',
      reason: 'Writer returned DO_NOT_POST during delegated First-1,000 preparation.',
    });
    return {
      action: 'do_not_post',
      reason: 'writer_do_not_post',
      queueItemId: ignored.id,
      candidateKey: ignored.candidateKey,
      editorialRecommendationId: work.recommendation.id,
      strategySelectionId: strategySelection.id,
      editorialRefreshed,
    };
  }

  requirePreparationAuthority(grantRevision);
  if (queueItem.status !== 'needs_review') {
    const reviewed = requestQueueReview(queueItem.candidateKey);
    queueItem = reviewed.queueItem;
    draft = reviewed.draft;
  }

  if (missionRepairableDraft(draft)) {
    requirePreparationAuthority(grantRevision);
    const { generateDraftCandidate } = await import('./web_api.js');
    const repaired = await generateDraftCandidate(draft);
    draft = repaired.saved;
    queueItem = repaired.queueItem;
    requirePreparationAuthority(grantRevision);
    const reviewed = requestQueueReview(queueItem.candidateKey);
    queueItem = reviewed.queueItem;
    draft = reviewed.draft;
  }

  requirePreparationAuthority(grantRevision);
  const provenance = missionVerificationProvenance(queueItem, draft);
  if (!provenance.sourceReferences.length) {
    return {
      action: 'review_required',
      reason: 'missing_source_verification_provenance',
      queueItemId: queueItem.id,
      candidateKey: queueItem.candidateKey,
      editorialRecommendationId: work.recommendation.id,
      strategySelectionId: strategySelection.id,
      editorialRefreshed,
    };
  }

  try {
    const approved = approveQueueItemAsMissionAgent(queueItem.candidateKey, {
      grantRevision,
      verificationProvenance: provenance,
    });
    return {
      action: 'approved',
      reason: 'mission_agent_approved',
      queueItemId: approved.queueItem.id,
      candidateKey: approved.queueItem.candidateKey,
      editorialRecommendationId: work.recommendation.id,
      strategySelectionId: strategySelection.id,
      humanApprovedAt: approved.queueItem.humanApprovedAt,
      editorialRefreshed,
    };
  } catch (error) {
    return {
      action: 'review_required',
      reason: 'mission_approval_rejected',
      error: error.message,
      queueItemId: queueItem.id,
      candidateKey: queueItem.candidateKey,
      editorialRecommendationId: work.recommendation.id,
      strategySelectionId: strategySelection.id,
      editorialRefreshed,
    };
  }
}
