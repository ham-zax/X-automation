import { normalizeBehaviorDecision } from './behavior.js';
import { createDraftScaffold, scoreDraft } from './drafting.js';
import { selectBehaviorDecision } from './persona.js';
import { isMeaningfulOutboundInteraction } from './relationship.js';
import { scoreOpportunity } from './opportunity.js';
import { authorizeReplyBrowserContent, postTweetBrowser } from './x_browser_publish.js';
import { assessStrategicRelevance, recommendDistributionAction } from './strategy.js';
import {
  captureQueueApproval,
  deleteDraft,
  ensureQueueItem,
  getAudienceProfile,
  getCandidate,
  getDraftByCandidate,
  getEditorialRecommendation,
  getAccountHealthSummary,
  getAutonomousReplyDecision,
  getAutonomousReplyGrantState,
  getGrowthOperatorDelegation,
  getLatestEditorialSelectionForQueueItem,
  getLatestWritingStrategySelectionForQueueItem,
  getPreferenceProfile,
  getPerformanceSnapshot,
  getQueueItemByCandidate,
  getRelationshipProfile,
  hasCandidateAction,
  invalidateQueueApproval,
  listCandidateActions,
  listAcceptedLearnedRules,
  listExperiments,
  listQueueItems,
  listQueueSources,
  listResearchEvidence,
  listRecentOurConversationPosts,
  listRecentPublishedContent,
  listRelationshipEvents,
  markCandidateSaved,
  recordCandidateAction,
  recordRelationshipEvent,
  rescoreCandidateClassifications,
  runStoreTransaction,
  saveDraft,
  saveQueueItem,
} from './store.js';

export const PIPELINES = [
  'triage',
  'original',
  'quote',
  'thread',
  'reply',
  'repost',
  'research',
  'watch',
  'ignore',
];

export const QUEUE_STATUSES = [
  'triage',
  'researching',
  'drafting',
  'needs_review',
  'approved',
  'publishing',
  'published',
  'watching',
  'ignored',
  'expired',
  'failed',
];

const TEXT_PIPELINES = new Set(['original', 'quote', 'thread', 'reply']);
const MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread', 'repost']);
const AUTOMATED_MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread']);

function requireCandidate(key) {
  const candidate = getCandidate(key);
  if (!candidate) throw new Error(`Candidate not found: ${key}`);
  return candidate;
}

function sourceUsername(candidate) {
  if (candidate?.source !== 'x') return '';
  const title = String(candidate.title || '').trim();
  if (title.startsWith('@')) return title.slice(1).toLowerCase();
  const match = String(candidate.url || '').match(/x\.com\/([^/]+)/i);
  return match?.[1]?.toLowerCase() || '';
}

function sourceTweetId(candidate) {
  if (candidate?.source !== 'x') return '';
  const match = String(candidate.url || candidate.key || '').match(/\/status\/(\d+)/i);
  return match?.[1] || '';
}

function editorialEvidenceForQueue(queueItem) {
  if (!queueItem) return [];
  const selection = getLatestEditorialSelectionForQueueItem(queueItem.id);
  if (!selection) return [];
  const recommendation = getEditorialRecommendation(selection.editorialRecommendationId);
  if (!recommendation) return [];
  const evidence = listResearchEvidence({ editorialRunId: recommendation.editorialRunId, storyKey: recommendation.storyKey });
  if (recommendation.decision === 'RESEARCH_MORE') return evidence;
  const linkedIds = new Set((recommendation.evidenceIds || []).map((id) => String(id)));
  return evidence.filter((item) => linkedIds.has(String(item.id)));
}

function relationshipContext(candidate) {
  const username = sourceUsername(candidate);
  if (!username) return null;
  return getRelationshipProfile(username) || getAudienceProfile(username);
}

function scoringContext(candidate, context = {}) {
  const relationship = context.relationship ?? relationshipContext(candidate);
  return {
    preference: getPreferenceProfile(),
    relationship,
    now: context.now || Date.now(),
    learnedRules: context.learnedRules ?? listAcceptedLearnedRules({ limit: 500 }),
    learningContext: {
      targetUsername: relationship?.username || sourceUsername(candidate),
      targetClass: relationship?.classes || [],
      relationshipStage: relationship?.relationshipStage || 'observed',
      topicTags: candidate?.niche?.tags || [],
      ...context.learningContext,
    },
  };
}

export function recommendationContext(candidate, scores, context = {}) {
  const storedFollowers = context.accountFollowers == null
    ? Number(getPerformanceSnapshot(1)?.account?.followers)
    : Number(context.accountFollowers);
  const accountFollowers = Number.isFinite(storedFollowers) ? storedFollowers : null;
  const behavior = context.behavior || null;
  const purposefulReply = behavior?.decision === 'ACT'
    && ['relationship', 'support', 'celebration', 'humor', 'learning', 'correction', 'de_escalation', 'social_presence', 'technical_value']
      .includes(String(behavior.primaryPurpose || ''));
  const purposefulRelationship = behavior?.decision === 'ACT'
    && ['relationship', 'support', 'celebration', 'humor', 'de_escalation', 'social_presence']
      .includes(String(behavior.primaryPurpose || ''));
  return {
    ...context,
    behavior,
    accountFollowers,
    opportunityScores: context.opportunityScores ?? scores,
    alreadyUsed: context.alreadyUsed ?? hasCandidateAction(candidate.key),
    canAddReplyValue: context.canAddReplyValue
      ?? (purposefulReply || (scores.conversationPotential >= 50 && scores.relationshipPotential > 0)),
    relationshipValue: context.relationshipValue
      ?? (purposefulRelationship || scores.relationshipPotential >= 20),
  };
}

function actionToPipeline(action) {
  if (action === 'direct') return 'original';
  if (['quote', 'reply', 'repost', 'ignore'].includes(action)) return action;
  return 'ignore';
}

function routeState(pipeline) {
  if (pipeline === 'research') return { lane: 'main', status: 'researching' };
  if (pipeline === 'watch') return { lane: 'main', status: 'watching' };
  if (pipeline === 'ignore') return { lane: 'main', status: 'ignored' };
  if (pipeline === 'reply') return { lane: 'engagement', status: 'drafting' };
  if (pipeline === 'repost') return { lane: 'main', status: 'needs_review' };
  if (pipeline === 'triage') return { lane: 'main', status: 'triage' };
  return { lane: 'main', status: 'drafting' };
}

function requireCurrentStrategyDecision(queueItem, draft) {
  const selection = getLatestWritingStrategySelectionForQueueItem(queueItem.id);
  if (!selection) throw new Error('Save No influence, Advice only, or Use for this draft before approval.');
  const generation = draft?.editor?.generation;
  if (generation && (generation.strategySelectionId == null || generation.strategyMode == null)) {
    throw new Error('This AI draft predates an explicit writing-strategy decision. Regenerate after saving the current writing choice before approval.');
  }
  if (generation && Number(generation.strategySelectionId) !== Number(selection.id)) {
    throw new Error('The writing-strategy choice changed after this AI generation. Regenerate with the current saved choice before approval.');
  }
  return selection;
}

function contentGateContext(candidateKey, pipeline) {
  const queueItem = getQueueItemByCandidate(candidateKey);
  const draft = getDraftByCandidate(candidateKey);
  const strategySelection = queueItem ? getLatestWritingStrategySelectionForQueueItem(queueItem.id) : null;
  const parentConversation = pipeline === 'reply' && queueItem?.parentOurTweetId
    ? listRecentOurConversationPosts({ limit: 100 }).find((item) => String(item.tweetId) === String(queueItem.parentOurTweetId))
    : null;
  const candidate = getCandidate(candidateKey);
  const relationship = candidate ? relationshipContext(candidate) : null;
  const persistedBehavior = queueItem?.behavior?.decision === 'ACT'
    ? queueItem.behavior
    : draft?.editor?.behavior?.decision === 'ACT'
      ? draft.editor.behavior
      : null;
  const behavior = persistedBehavior || selectBehaviorDecision({
    pipeline,
    contribution: {
      archetype: queueItem?.replyArchetype
        || (pipeline === 'quote' ? 'social_observation' : pipeline === 'reply' ? 'synthesis' : 'synthesis'),
      summary: queueItem?.contributionSummary
        || queueItem?.routingReason
        || `Legacy ${pipeline} item requires a purpose-aware review.`,
    },
    relationship,
    engagementKind: queueItem?.engagementKind || 'initial_reply',
    parentOurTweetId: queueItem?.parentOurTweetId || '',
    sourceClass: queueItem?.engagement?.sourceClass || '',
    reasonToExist: queueItem?.contributionSummary
      || queueItem?.routingReason
      || `Legacy ${pipeline} item requires a purpose-aware review.`,
    selectionSource: 'legacy',
  });
  return {
    pipeline,
    behavior,
    relationship,
    recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidateKey }),
    recentReplies: pipeline === 'reply'
      ? listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidateKey })
      : [],
    evidence: editorialEvidenceForQueue(queueItem),
    mediaReady: Boolean(draft?.editor?.media?.attachment?.localPath),
    mediaPublishingAvailable: true,
    relevanceOverride: queueItem?.relevance?.humanOverride || null,
    conversationRelevanceCandidate: parentConversation ? getCandidate(parentConversation.candidateKey) : null,
    strategyMode: strategySelection?.mode || null,
    strategySelectionId: strategySelection?.id ?? null,
    generationStrategySelectionId: draft?.editor?.generation?.strategySelectionId ?? null,
    generationStrategyMode: draft?.editor?.generation?.strategyMode ?? null,
    hasGenerationProvenance: Boolean(draft?.editor?.generation),
    strategyApproach: strategySelection?.guidance?.rationale || '',
    replyArchetype: pipeline === 'reply' ? (queueItem?.replyArchetype || '') : '',
  };
}

function requireMissionHookExperimentAssignment(queueItem) {
  const queueCreatedAt = Number(queueItem?.createdAt || 0);
  const activeExperiments = listExperiments({ status: 'active', limit: 100 })
    .filter((experiment) => experiment.dimension === 'hook_type')
    .filter((experiment) => queueCreatedAt >= Number(experiment.startedAt || experiment.createdAt || 0));
  if (!activeExperiments.length) return null;

  const assignment = queueItem?.experimentAssignment || {};
  const experiment = activeExperiments.find((candidate) => Number(candidate.id) === Number(assignment.experimentId));
  if (!experiment) {
    throw new Error('Mission-agent approval requires assignment to the active hook_type experiment before approval.');
  }
  const variant = (experiment.variants || []).find((candidate) => String(candidate.label) === String(assignment.variantLabel));
  if (!variant) throw new Error('Mission-agent hook experiment assignment references an unknown variant.');

  const patternId = String(assignment.context?.hookPattern ?? variant.config?.patternId ?? variant.config?.pattern_id ?? '').trim();
  const hookInstructions = String(assignment.context?.hookInstructions ?? variant.config?.hookInstructions ?? variant.config?.hook_instructions ?? '').trim();
  if (!patternId || !hookInstructions) {
    throw new Error('Mission-agent hook experiment assignment requires hookPattern and hookInstructions.');
  }
  return { experiment, variant, patternId, hookInstructions };
}

function normalizeMissionVerificationProvenance(provenance = {}) {
  if (String(provenance.authorityType || '') !== 'mission_agent') {
    throw new Error('Mission-agent approval requires verificationProvenance.authorityType=mission_agent.');
  }
  const normalizeReferences = (value, field, required = false) => {
    if (value === undefined && !required) return [];
    if (!Array.isArray(value)) throw new Error(`Mission-agent approval requires verificationProvenance.${field} to be an array.`);
    const references = [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
    if (required && references.length === 0) {
      throw new Error(`Mission-agent approval requires at least one concrete verificationProvenance.${field} reference.`);
    }
    return references;
  };
  return {
    authorityType: 'mission_agent',
    sourceReferences: normalizeReferences(provenance.sourceReferences, 'sourceReferences', true),
    evidenceReferences: normalizeReferences(provenance.evidenceReferences, 'evidenceReferences'),
  };
}

function requireMissionEvidenceProvenance(queueItem, draft, provenance) {
  const requested = [...new Set((Array.isArray(draft?.editor?.evidenceUsed) ? draft.editor.evidenceUsed : [])
    .map((id) => String(id || '').trim()).filter(Boolean))];
  const declared = provenance.evidenceReferences;
  if (requested.length !== declared.length || requested.some((id) => !declared.includes(id))) {
    throw new Error('Mission-agent evidence provenance must exactly match the draft evidenceUsed references.');
  }
  const storedEvidence = new Map(editorialEvidenceForQueue(queueItem).map((item) => [String(item.id), item]));
  const invalid = requested.filter((id) => !storedEvidence.has(id));
  if (invalid.length) {
    throw new Error(`Mission-agent evidence provenance does not resolve to supplied stored Editorial evidence: ${invalid.join(', ')}.`);
  }
  const ineligible = requested.filter((id) => !['primary_supported', 'source_claim'].includes(String(storedEvidence.get(id)?.status || '')));
  if (ineligible.length) {
    throw new Error(`Mission-agent evidence provenance references unresolved or contradicted Editorial evidence: ${ineligible.join(', ')}.`);
  }
}

function requireLiveGrowthOperatorDelegation(grantRevision) {
  const revision = Number(grantRevision);
  if (!Number.isInteger(revision) || revision < 1) {
    throw new Error('Mission-agent approval requires a positive integer grantRevision.');
  }
  const grant = getGrowthOperatorDelegation();
  if (grant.state !== 'running' || grant.mode !== 'live') {
    throw new Error('Growth Operator delegation must be running in live mode for mission-agent approval.');
  }
  if (Number(grant.revision) !== revision) {
    throw new Error('Growth Operator delegation revision is stale or has been revoked.');
  }
  return grant;
}

export function refreshQueueRecommendation(key, context = {}) {
  const candidate = requireCandidate(key);
  ensureQueueItem(key);
  const existingQueueItem = getQueueItemByCandidate(key);
  const effectiveContext = context.multipleSources == null
    ? {
        ...context,
        behavior: context.behavior || existingQueueItem?.behavior || null,
        multipleSources: listQueueSources(existingQueueItem.id).length > 1,
      }
    : { ...context, behavior: context.behavior || existingQueueItem?.behavior || null };
  const scoreContext = scoringContext(candidate, effectiveContext);
  const scores = scoreOpportunity(candidate, scoreContext);
  const growthFit = assessStrategicRelevance(candidate, {
    objective: effectiveContext.objective,
    humanOverride: existingQueueItem?.relevance?.humanOverride || null,
  });
  const recommendation = recommendDistributionAction(candidate, recommendationContext(candidate, scores, {
    ...effectiveContext,
    strategicRelevance: growthFit,
    relevanceOverride: existingQueueItem?.relevance?.humanOverride || null,
  }));
  const recommendedPipeline = actionToPipeline(recommendation.action);
  const routingDecision = existingQueueItem?.routingDecision?.accepted === true
    && existingQueueItem.routingDecision.recommendedPipeline === recommendedPipeline
    && existingQueueItem.routingDecision.routingReason === recommendation.reason
    ? existingQueueItem.routingDecision
    : {};
  const queueItem = saveQueueItem({
    candidateKey: key,
    reachPotential: scores.reachPotential,
    followPotential: scores.followPotential,
    conversationPotential: scores.conversationPotential,
    relationshipPotential: scores.relationshipPotential,
    recommendedPipeline,
    routingReason: recommendation.reason,
    behavior: effectiveContext.behavior || existingQueueItem?.behavior || null,
    routingDecision,
  });
  return { candidate, queueItem, scores, recommendation: { ...recommendation, pipeline: recommendedPipeline } };
}

export function refreshCandidateRecommendations() {
  let refreshed = 0;
  for (const queueItem of listQueueItems({ lane: 'main', limit: 10_000 })) {
    if (['approved', 'publishing', 'published'].includes(queueItem.status)) continue;
    refreshQueueRecommendation(queueItem.candidateKey);
    refreshed += 1;
  }
  return { refreshed };
}

export function rescoreCandidateRelevance(options = {}) {
  const classification = rescoreCandidateClassifications(options);
  const recommendations = refreshCandidateRecommendations();
  return { ...classification, queueRecommendationsRefreshed: recommendations.refreshed };
}

export function setRelevanceDecision(key, { decision, reason = '', actor = 'human' } = {}) {
  if (actor !== 'human') throw new Error('Growth Focus override decisions require an explicit human action.');
  const candidate = requireCandidate(key);
  ensureQueueItem(key);
  const queueItem = getQueueItemByCandidate(key);
  if (['approved', 'publishing', 'published'].includes(queueItem.status) || queueItem.humanApprovedAt || queueItem.publishedAt || queueItem.outputTweetId) {
    throw new Error('Growth Focus decisions cannot be changed after approval or publication.');
  }
  if (decision === 'clear_override') {
    const saved = saveQueueItem({ candidateKey: key, relevance: {} });
    return { queueItem: saved, growthFit: assessStrategicRelevance(candidate) };
  }
  if (decision !== 'use_anyway') throw new Error(`Unsupported Growth Focus decision: ${decision || 'missing'}.`);

  const growthFit = assessStrategicRelevance(candidate);
  if (growthFit.state === 'unknown') {
    throw new Error('Growth fit is unknown. Rescore candidates from Growth Focus before choosing to use this opportunity.');
  }
  if (growthFit.state !== 'outside') {
    throw new Error(`Growth Focus override is only needed for outside-scope opportunities; current state is ${growthFit.state}.`);
  }
  const explanation = String(reason || '').trim();
  if (!explanation) throw new Error('Using an outside-scope opportunity requires a short human reason.');
  const humanOverride = {
    accepted: true,
    reason: explanation,
    actor: 'human',
    at: Date.now(),
    profileRevision: growthFit.profileRevision,
    classifierVersion: growthFit.classifierVersion,
  };
  const saved = saveQueueItem({ candidateKey: key, relevance: { humanOverride } });
  return {
    queueItem: saved,
    growthFit: assessStrategicRelevance(candidate, { humanOverride }),
  };
}

export function setRoutingDecision(key, { decision, reason = '', actor = 'human' } = {}) {
  if (actor !== 'human') throw new Error('Use-anyway routing decisions require an explicit human action.');
  requireCandidate(key);
  ensureQueueItem(key);
  let queueItem = getQueueItemByCandidate(key);
  if (['approved', 'publishing', 'published'].includes(queueItem.status) || queueItem.humanApprovedAt || queueItem.publishedAt || queueItem.outputTweetId) {
    throw new Error('Routing decisions cannot be changed after approval or publication.');
  }
  refreshQueueRecommendation(key);
  queueItem = getQueueItemByCandidate(key);
  if (decision === 'clear_override') return saveQueueItem({ candidateKey: key, routingDecision: {} });
  if (decision !== 'use_anyway') throw new Error(`Unsupported routing decision: ${decision || 'missing'}.`);
  if (queueItem.recommendedPipeline !== 'ignore') {
    throw new Error(`Use anyway is only required when the current recommendation is Ignore; current recommendation is ${queueItem.recommendedPipeline || 'missing'}.`);
  }
  const explanation = String(reason || '').trim();
  if (!explanation) throw new Error('Using an ignored opportunity requires a short human reason.');
  return saveQueueItem({
    candidateKey: key,
    routingDecision: {
      accepted: true,
      decision: 'use_anyway',
      reason: explanation,
      actor: 'human',
      at: Date.now(),
      recommendedPipeline: queueItem.recommendedPipeline,
      routingReason: queueItem.routingReason,
    },
  });
}

export function inspectGrowthOpportunity(key, context = {}) {
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  const scores = scoreOpportunity(candidate, scoringContext(candidate, context));
  const growthFit = assessStrategicRelevance(candidate, { humanOverride: queueItem?.relevance?.humanOverride || null });
  const recommendation = recommendDistributionAction(candidate, recommendationContext(candidate, scores, {
    ...context,
    strategicRelevance: growthFit,
    relevanceOverride: queueItem?.relevance?.humanOverride || null,
  }));
  return {
    candidate,
    queueItem,
    actions: listCandidateActions(key),
    scores,
    growthFit,
    recommendation: { ...recommendation, pipeline: actionToPipeline(recommendation.action) },
  };
}

export function inspectWorkflow(key) {
  const opportunity = inspectGrowthOpportunity(key);
  const { candidate, queueItem, scores, growthFit, recommendation } = opportunity;
  const storedDraft = getDraftByCandidate(key);
  const historicalDraft = storedDraft?.status === 'published'
    || queueItem?.status === 'published'
    || Boolean(queueItem?.publishedAt || queueItem?.outputTweetId);
  let draft = storedDraft;
  if (storedDraft && queueItem && !historicalDraft && TEXT_PIPELINES.has(queueItem.pipeline)) {
    const analysis = scoreDraft(storedDraft, candidate, contentGateContext(key, queueItem.pipeline));
    draft = { ...storedDraft, qualityScore: analysis.score, gates: analysis.gates };
  }
  return {
    ...opportunity,
    draft,
    recommendation: queueItem ? recommendation : null,
  };
}

export function reconcileRecordedActionWorkflow(candidate, action, recorded) {
  const workflow = inspectWorkflow(candidate.key);
  const queueItem = workflow.queueItem;
  if (!queueItem) return null;
  const compatible = (action === 'reply' && queueItem.pipeline === 'reply')
    || (action === 'quote' && queueItem.pipeline === 'quote')
    || (action === 'direct' && ['original', 'thread'].includes(queueItem.pipeline))
    || (action === 'repost' && queueItem.pipeline === 'repost');
  if (!compatible) return null;
  const tweetId = recorded.output_tweet_id ? String(recorded.output_tweet_id) : null;
  const outputUrl = recorded.output_url || null;
  if (queueItem.outputTweetId && tweetId && String(queueItem.outputTweetId) !== tweetId) {
    throw new Error(`Queue item ${queueItem.id} already has a different output tweet ID.`);
  }
  const publishedAt = Number(recorded.created_at || Date.now());
  let draft = workflow.draft;
  if (draft && tweetId && (draft.status !== 'published' || String(draft.publishedTweetId || '') !== tweetId)) {
    draft = saveDraft({ ...draft, status: 'published', publishedTweetId: tweetId });
  }
  const reconciled = queueItem.status === 'published'
    && (!tweetId || String(queueItem.outputTweetId || '') === tweetId)
    ? queueItem
    : saveQueueItem({
      ...queueItem,
      status: 'published',
      draftId: draft?.id ?? queueItem.draftId,
      outputTweetId: tweetId || queueItem.outputTweetId || null,
      outputUrl: outputUrl || queueItem.outputUrl || null,
      publishedAt: queueItem.publishedAt || publishedAt,
      publishStartedAt: null,
      publishError: null,
    });
  if (action === 'reply' && tweetId && reconciled.targetUsername) {
    const alreadyRecorded = listRelationshipEvents(reconciled.targetUsername, { limit: 1000 })
      .some((event) => event.eventType === 'our_reply' && String(event.ourTweetId || '') === tweetId);
    if (!alreadyRecorded) {
      const relationship = getRelationshipProfile(reconciled.targetUsername);
      const meaningfulInteraction = isMeaningfulOutboundInteraction({
        behavior: reconciled.behavior || draft?.editor?.behavior || null,
        text: draft?.body || reconciled.approvedText || '',
        sourceText: candidate.text || '',
        engagementKind: reconciled.engagementKind || 'initial_reply',
        relationshipStage: relationship?.relationshipStage || 'observed',
      });
      recordRelationshipEvent({
        username: reconciled.targetUsername,
        eventType: 'our_reply',
        candidateKey: candidate.key,
        sourceTweetId: reconciled.targetTweetId,
        ourTweetId: tweetId,
        topic: candidate.niche?.tags?.[0] || null,
        occurredAt: publishedAt,
        metadata: {
          meaningful: meaningfulInteraction,
          primaryPurpose: reconciled.behavior?.primaryPurpose || draft?.editor?.behavior?.primaryPurpose || null,
          socialMode: reconciled.behavior?.socialMode || draft?.editor?.behavior?.socialMode || null,
          conversationStage: reconciled.behavior?.conversationStage || draft?.editor?.behavior?.conversationStage || null,
          replyArchetype: reconciled.replyArchetype || null,
          engagementKind: reconciled.engagementKind || 'initial_reply',
          replyAuthority: 'publication_reconciliation',
        },
      });
    }
  }
  return reconciled;
}

export function saveCandidateToWorkflow(key, saved = true) {
  requireCandidate(key);
  markCandidateSaved(key, saved);
  if (!saved) return inspectWorkflow(key);
  return ensureCandidateWorkflow(key);
}

export function ensureCandidateWorkflow(key) {
  requireCandidate(key);
  ensureQueueItem(key);
  return refreshQueueRecommendation(key);
}

export function discardCandidateDraft(key) {
  requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  const draft = getDraftByCandidate(key);
  if (!draft) return queueItem;
  if (queueItem && (['publishing', 'published'].includes(queueItem.status) || queueItem.outputTweetId || queueItem.publishedAt)) {
    throw new Error('Publishing or published work cannot be discarded.');
  }
  if (queueItem?.status === 'approved') {
    invalidateQueueApproval(key, { actor: 'human', reason: 'draft discarded after approval' });
  }
  if (queueItem) {
    const engagement = queueItem.lane === 'engagement';
    saveQueueItem({
      ...queueItem,
      lane: engagement ? 'engagement' : 'main',
      pipeline: engagement ? 'reply' : 'triage',
      status: engagement ? 'drafting' : 'triage',
      draftId: null,
      humanApprovedAt: null,
      approvedText: null,
      scheduledAt: null,
      scheduleSource: '',
      publishStartedAt: null,
      publishError: null,
    });
  }
  deleteDraft(draft.id);
  return getQueueItemByCandidate(key);
}

export function recordManualRepost(key, { actor = 'human' } = {}) {
  requireCandidate(key);
  if (actor !== 'human') throw new Error('Manual repost completion requires an explicit human action.');
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem || queueItem.lane !== 'main' || queueItem.pipeline !== 'repost') {
    throw new Error('This source is not in the repost workflow.');
  }
  if (queueItem.status !== 'approved') {
    throw new Error('Approve the repost before recording it as completed.');
  }
  const saved = saveQueueItem({
    ...queueItem,
    status: 'published',
    publishedAt: Date.now(),
    publishStartedAt: null,
    publishError: null,
  });
  const action = recordCandidateAction({
    candidateKey: key,
    action: 'repost',
    commentary: 'Recorded by the operator after completing the repost manually on X.',
  });
  return { queueItem: saved, action };
}

export function routeCandidate(key, pipeline, { actor = 'human', reason = '', routeContext = {} } = {}) {
  return runStoreTransaction(() => {
    const candidate = requireCandidate(key);
    if (!PIPELINES.includes(pipeline)) throw new Error(`Invalid pipeline: ${pipeline}`);
    if (!['human', 'agent'].includes(actor)) throw new Error(`Invalid routing actor: ${actor}`);

    ensureQueueItem(key);
    let previousQueueItem = getQueueItemByCandidate(key);
    if (['publishing', 'published'].includes(previousQueueItem.status) || previousQueueItem.outputTweetId || previousQueueItem.publishedAt) {
      throw new Error('Published or publishing items cannot be rerouted; use the publication reconciliation path instead.');
    }
    if (previousQueueItem.status === 'approved') {
      invalidateQueueApproval(key, { actor, reason: `route changed from ${previousQueueItem.pipeline} to ${pipeline} after approval` });
      previousQueueItem = getQueueItemByCandidate(key);
    }
    const existingEngagementReply = pipeline === 'reply'
      && previousQueueItem.lane === 'engagement'
      && previousQueueItem.pipeline === 'reply';
    if (!existingEngagementReply) {
      refreshQueueRecommendation(key, routeContext);
      previousQueueItem = getQueueItemByCandidate(key);
    }
    if (TEXT_PIPELINES.has(pipeline) || pipeline === 'repost') {
      if (!existingEngagementReply && previousQueueItem.recommendedPipeline === 'ignore') {
        const routingDecision = previousQueueItem.routingDecision || {};
        const currentOverride = routingDecision.accepted === true
          && routingDecision.actor === 'human'
          && routingDecision.recommendedPipeline === previousQueueItem.recommendedPipeline
          && routingDecision.routingReason === previousQueueItem.routingReason;
        if (!currentOverride) {
          throw new Error('This opportunity is currently recommended Ignore. Choose “Use anyway” and provide a reason before routing it into authored or repost work.');
        }
      }
      const growthFit = assessStrategicRelevance(candidate, { humanOverride: previousQueueItem.relevance?.humanOverride || null });
      if (growthFit.state === 'unknown') {
        throw new Error('Growth fit needs a current classification before this opportunity can move into authored or repost work. Rescore candidates from Growth Focus.');
      }
      if (!growthFit.allowed) {
        throw new Error('This opportunity is outside the configured technical scope. Choose “Use this opportunity anyway” and provide a reason before proceeding.');
      }
    }
    const state = routeState(pipeline);
    const selectedBehavior = TEXT_PIPELINES.has(pipeline)
      ? selectBehaviorDecision({
          explicitBehavior: routeContext.behavior
            || (previousQueueItem?.behavior?.decision === 'ACT' ? previousQueueItem.behavior : null),
          pipeline,
          contribution: {
            archetype: previousQueueItem?.replyArchetype
              || (pipeline === 'quote' ? 'social_observation' : 'synthesis'),
            summary: routeContext.reasonToExist
              || routeContext.behavior?.reasonToExist
              || previousQueueItem?.contributionSummary
              || previousQueueItem?.routingReason
              || `Create a purposeful ${pipeline} action from the selected source.`,
          },
          relationship: relationshipContext(candidate),
          engagementKind: previousQueueItem?.engagementKind || 'initial_reply',
          parentOurTweetId: previousQueueItem?.parentOurTweetId || '',
          sourceClass: previousQueueItem?.engagement?.sourceClass || '',
          reasonToExist: routeContext.reasonToExist
            || routeContext.behavior?.reasonToExist
            || previousQueueItem?.contributionSummary
            || previousQueueItem?.routingReason
            || `Create a purposeful ${pipeline} action from the selected source.`,
          selectionSource: routeContext.behavior ? 'operator' : 'persona_model',
        })
      : normalizeBehaviorDecision({
          decision: pipeline === 'research' ? 'RESEARCH' : pipeline === 'ignore' ? 'SILENT' : 'UNKNOWN',
          pipeline,
          reasonToExist: reason || previousQueueItem?.routingReason || `Route selected: ${pipeline}.`,
          selectionSource: actor === 'human' ? 'human' : 'operator',
          selectedAt: Date.now(),
        }, { pipeline });
    let draft = getDraftByCandidate(key);
    if (draft?.status === 'ready') draft = saveDraft({ ...draft, gates: {}, status: 'draft' });
    let draftId = null;
    if (TEXT_PIPELINES.has(pipeline)) {
      const draftPipeline = draft?.editor?.pipeline || (TEXT_PIPELINES.has(previousQueueItem?.pipeline) ? previousQueueItem.pipeline : '');
      if (draft && draftPipeline && draftPipeline !== pipeline) {
        draft = saveDraft({
          ...createDraftScaffold(candidate, { pipeline }),
          id: draft.id,
          candidateKey: key,
          editor: { pipeline, behavior: selectedBehavior, personaModelVersion: selectedBehavior.personaModelVersion || '' },
        });
      }
      draft ||= saveDraft({
        ...createDraftScaffold(candidate, { pipeline }),
        editor: { pipeline, behavior: selectedBehavior, personaModelVersion: selectedBehavior.personaModelVersion || '' },
      });
      draftId = draft.id;
    }

    const replyTarget = pipeline === 'reply' ? {
      targetUsername: previousQueueItem?.targetUsername || sourceUsername(candidate) || null,
      targetTweetId: previousQueueItem?.targetTweetId || sourceTweetId(candidate) || null,
      engagementKind: previousQueueItem?.engagementKind || 'initial_reply',
    } : {};

    return saveQueueItem({
      candidateKey: key,
      lane: state.lane,
      pipeline,
      status: state.status,
      draftId,
      humanApprovedAt: null,
      approvedText: null,
      routingReason: getQueueItemByCandidate(key)?.routingReason || reason || '',
      behavior: selectedBehavior,
      routingDecision: ['ignore', 'watch', 'research'].includes(pipeline) ? {} : (previousQueueItem.routingDecision || {}),
      ...replyTarget,
    });
  });
}

export function setBehaviorDecision(key, input = {}, { actor = 'human' } = {}) {
  return runStoreTransaction(() => {
    const candidate = requireCandidate(key);
    if (!['human', 'agent'].includes(actor)) throw new Error(`Invalid behavior actor: ${actor}`);
    const queueItem = getQueueItemByCandidate(key);
    if (!queueItem) throw new Error(`Queue item not found: ${key}`);
    if (!TEXT_PIPELINES.has(queueItem.pipeline)) {
      throw new Error(`Behavior selection requires a routed text pipeline; current pipeline is ${queueItem.pipeline || 'missing'}.`);
    }
    if (['approved', 'publishing', 'published'].includes(queueItem.status)
        || queueItem.humanApprovedAt
        || queueItem.outputTweetId
        || queueItem.publishedAt) {
      throw new Error('Behavior cannot be changed after approval or publication.');
    }

    const behavior = selectBehaviorDecision({
      explicitBehavior: {
        ...(input && typeof input === 'object' && !Array.isArray(input) ? input : {}),
        decision: 'ACT',
        pipeline: queueItem.pipeline,
        selectionSource: actor === 'human' ? 'human' : 'operator',
        selectedAt: Date.now(),
      },
      pipeline: queueItem.pipeline,
      relationship: relationshipContext(candidate),
      engagementKind: queueItem.engagementKind || 'initial_reply',
      parentOurTweetId: queueItem.parentOurTweetId || '',
      sourceClass: queueItem.engagement?.sourceClass || '',
      reasonToExist: input?.reasonToExist
        || queueItem.contributionSummary
        || queueItem.routingReason
        || `Realize a purposeful ${queueItem.pipeline} action.`,
      selectionSource: actor === 'human' ? 'human' : 'operator',
    });

    const savedQueueItem = saveQueueItem({
      ...queueItem,
      behavior,
      humanApprovedAt: null,
      approvedText: null,
    });
    const currentDraft = getDraftByCandidate(key);
    const savedDraft = currentDraft ? saveDraft({
      ...currentDraft,
      editor: {
        ...(currentDraft.editor || {}),
        pipeline: queueItem.pipeline,
        behavior,
        personaModelVersion: behavior.personaModelVersion || '',
      },
      gates: {},
      qualityScore: 0,
      status: 'draft',
    }) : null;
    return { candidate, queueItem: savedQueueItem, draft: savedDraft, behavior };
  });
}

export function requestQueueReview(key) {
  return runStoreTransaction(() => {
    const candidate = requireCandidate(key);
    let queueItem = getQueueItemByCandidate(key);
    if (!queueItem) throw new Error(`Queue item not found: ${key}`);

    if (queueItem.status === 'approved') {
      invalidateQueueApproval(key, { actor: 'system', reason: 'review requested after approval' });
      queueItem = getQueueItemByCandidate(key);
    }
    if (queueItem.pipeline === 'repost') {
      return saveQueueItem({ candidateKey: key, status: 'needs_review' });
    }
    if (!TEXT_PIPELINES.has(queueItem.pipeline)) throw new Error(`Pipeline ${queueItem.pipeline} cannot request content review.`);

    const draft = getDraftByCandidate(key);
    if (!draft) throw new Error(`Draft required for ${queueItem.pipeline}.`);
    const analysis = scoreDraft(draft, candidate, contentGateContext(key, queueItem.pipeline));
    const savedDraft = saveDraft({ ...draft, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
    return {
      queueItem: saveQueueItem({ candidateKey: key, status: 'needs_review', draftId: savedDraft.id, humanApprovedAt: null, approvedText: null }),
      draft: savedDraft,
      analysis,
    };
  });
}

export function approveQueueItem(key) {
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem) throw new Error(`Queue item not found: ${key}`);
  if (!MAIN_FEED_PIPELINES.has(queueItem.pipeline)) throw new Error(`Pipeline ${queueItem.pipeline} is not a main-feed approval route.`);
  if (queueItem.status !== 'needs_review') throw new Error('Queue item must be in needs_review before approval.');

  let draft = null;
  let analysis = null;
  if (queueItem.pipeline === 'repost') {
    const growthFit = assessStrategicRelevance(candidate, { humanOverride: queueItem.relevance?.humanOverride || null });
    if (growthFit.state === 'unknown') throw new Error('Growth fit needs a current classification before repost approval.');
    if (!growthFit.allowed) throw new Error('This repost is outside the configured technical scope. Choose “Use this opportunity anyway” and provide a reason before approval.');
  } else {
    draft = getDraftByCandidate(key);
    if (!draft) throw new Error(`Draft required for ${queueItem.pipeline}.`);
    requireCurrentStrategyDecision(queueItem, draft);
    analysis = scoreDraft(draft, candidate, contentGateContext(key, queueItem.pipeline));
    draft = saveDraft({ ...draft, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
    if (!analysis.publishable) {
      const firstFailure = analysis.gates?.failures?.[0] || analysis.growthPackaging?.blockers?.[0];
      const detail = firstFailure ? ` ${firstFailure.code}: ${firstFailure.message}` : '';
      throw new Error(`Draft is not approval-ready. Writing quality is ${analysis.score}/50.${detail}`);
    }
    draft = saveDraft({ ...draft, status: 'ready' });
  }

  const captured = runStoreTransaction(() => {
    saveQueueItem({
      candidateKey: key,
      status: 'approved',
      draftId: draft?.id ?? null,
      humanApprovedAt: Date.now(),
      publishStartedAt: null,
      publishError: null,
    });
    return captureQueueApproval(key, { actor: 'human', reason: 'approved' });
  });
  return {
    queueItem: captured.queueItem,
    draft,
    analysis,
    approvalSnapshot: captured.snapshot,
  };
}

export function approveQueueItemAsMissionAgent(key, { grantRevision, verificationProvenance } = {}) {
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem) throw new Error(`Queue item not found: ${key}`);
  if (!['main', 'main_feed'].includes(queueItem.lane) || !AUTOMATED_MAIN_FEED_PIPELINES.has(queueItem.pipeline)) {
    throw new Error('Mission-agent approval is limited to automated main-feed Original, Quote, and Thread items.');
  }
  if (queueItem.status !== 'needs_review') throw new Error('Queue item must be in needs_review before mission-agent approval.');

  requireLiveGrowthOperatorDelegation(grantRevision);
  requireMissionHookExperimentAssignment(queueItem);
  const provenance = normalizeMissionVerificationProvenance(verificationProvenance);
  let draft = getDraftByCandidate(key);
  if (!draft) throw new Error(`Draft required for ${queueItem.pipeline}.`);
  requireMissionEvidenceProvenance(queueItem, draft, provenance);
  requireCurrentStrategyDecision(queueItem, draft);
  const analysis = scoreDraft(draft, candidate, contentGateContext(key, queueItem.pipeline));
  draft = saveDraft({ ...draft, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
  if (!analysis.publishable) {
    const firstFailure = analysis.gates?.failures?.[0] || analysis.growthPackaging?.blockers?.[0];
    const detail = firstFailure ? ` ${firstFailure.code}: ${firstFailure.message}` : '';
    throw new Error(`Draft is not mission-agent approval-ready. Writing quality is ${analysis.score}/50.${detail}`);
  }
  draft = saveDraft({ ...draft, status: 'ready' });

  const result = runStoreTransaction(() => {
    const grant = requireLiveGrowthOperatorDelegation(grantRevision);
    saveQueueItem({
      candidateKey: key,
      status: 'approved',
      draftId: draft.id,
      humanApprovedAt: null,
      publishStartedAt: null,
      publishError: null,
    });
    const captured = captureQueueApproval(key, {
      actor: 'agent',
      reason: 'approved by delegated Growth Operator',
      authority: {
        type: 'mission_agent',
        mission: 'growth_operator',
        grantRevision: grant.revision,
      },
      verificationProvenance: provenance,
    });
    return { captured, grant };
  });
  return {
    queueItem: result.captured.queueItem,
    draft,
    analysis,
    approvalSnapshot: result.captured.snapshot,
    missionGrant: result.grant,
  };
}

export function approveEngagementQueueItem(key, { actor = 'human' } = {}) {
  if (actor !== 'human') throw new Error('Engagement approval requires an explicit human action.');
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem || queueItem.lane !== 'engagement' || queueItem.pipeline !== 'reply') {
    throw new Error(`Engagement reply not found: ${key}`);
  }
  if (queueItem.status !== 'needs_review') throw new Error('Engagement reply must be in needs_review before approval.');

  const draft = getDraftByCandidate(key);
  if (!draft) throw new Error('A reply draft is required before approval.');
  const analysis = scoreDraft(draft, candidate, contentGateContext(key, 'reply'));
  const checkedDraft = saveDraft({ ...draft, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
  if (!analysis.publishable) {
    const firstFailure = analysis.gates?.failures?.[0] || analysis.growthPackaging?.blockers?.[0];
    const detail = firstFailure ? ` ${firstFailure.code}: ${firstFailure.message}` : '';
    throw new Error(`Reply is not approval-ready. Writing quality is ${analysis.score}/50.${detail}`);
  }
  const approvedText = String(checkedDraft.body || '');
  if (!approvedText.trim()) throw new Error('Approved reply text cannot be empty.');
  const readyDraft = saveDraft({ ...checkedDraft, status: 'ready' });
  const captured = runStoreTransaction(() => {
    saveQueueItem({
      candidateKey: key,
      status: 'approved',
      draftId: readyDraft.id,
      humanApprovedAt: Date.now(),
      approvedText,
    });
    return captureQueueApproval(key, { actor, reason: 'approved' });
  });
  return {
    queueItem: captured.queueItem,
    draft: readyDraft,
    analysis,
    approvalSnapshot: captured.snapshot,
  };
}

export function resolveEngagementItem(key, resolution, reason = '') {
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem || queueItem.lane !== 'engagement') throw new Error(`Engagement item not found: ${key}`);
  if (!['ignore', 'expire'].includes(resolution)) throw new Error(`Invalid engagement resolution: ${resolution}`);
  if (['publishing', 'published'].includes(queueItem.status) || queueItem.outputTweetId || queueItem.publishedAt) {
    throw new Error('Published or publishing engagement items cannot be resolved backward.');
  }
  const status = resolution === 'ignore' ? 'ignored' : 'expired';
  return saveQueueItem({
    ...queueItem,
    status,
    humanApprovedAt: null,
    approvedText: null,
    engagement: {
      ...(queueItem.engagement || {}),
      resolution: { action: resolution, reason: String(reason || ''), resolvedAt: Date.now() },
    },
  });
}

function outputTweetIdentity(result, account) {
  const tweetId = String(result?.rest_id || result?.id || result?.legacy?.id_str || '');
  const url = result?.permanentUrl || result?.url || (tweetId ? `https://x.com/${account}/status/${tweetId}` : '');
  return { tweetId, url };
}

async function sendEngagementReplyTransport({
  candidate,
  queueItem,
  draft,
  text,
  authority,
  authToken,
  account,
  transport,
}) {
  if (transport === postTweetBrowser) {
    throw new Error('Scripted x.com reply mutation is disabled. Configure a compliant X API reply transport instead.');
  }
  if (typeof transport !== 'function') throw new Error('No compliant X reply mutation transport is configured.');
  const contentGate = authorizeReplyBrowserContent({
    candidateKey: candidate.key,
    text,
    targetTweetId: queueItem.targetTweetId,
    authority,
  });
  const publishingItem = saveQueueItem({
    ...queueItem,
    status: 'publishing',
    humanApprovedAt: authority.type === 'human' ? queueItem.humanApprovedAt : null,
    approvedText: authority.type === 'human' ? queueItem.approvedText : null,
    engagement: {
      ...(queueItem.engagement || {}),
      send: { authority, startedAt: Date.now() },
    },
  });
  let result;
  try {
    result = await transport(text, { authToken }, {
      account,
      replyTo: publishingItem.targetTweetId,
      contentGate,
    });
  } catch (error) {
    if (error?.code === 'TRANSPORT_RESULT_NO_TWEET_ID') {
      saveQueueItem({
        ...publishingItem,
        status: 'publishing',
        humanApprovedAt: authority.type === 'human' ? publishingItem.humanApprovedAt : null,
        approvedText: authority.type === 'human' ? publishingItem.approvedText : null,
        engagement: {
          ...(publishingItem.engagement || {}),
          send: { authority, postedAt: Date.now(), recordingError: error.message },
        },
      });
      throw new Error(`Reply browser publication is ambiguous and requires reconciliation: ${error.message}`);
    }
    saveQueueItem({
      ...publishingItem,
      status: 'failed',
      humanApprovedAt: null,
      approvedText: null,
      engagement: {
        ...(publishingItem.engagement || {}),
        send: { authority, failedAt: Date.now(), error: error.message },
      },
    });
    throw error;
  }

  const { tweetId, url } = outputTweetIdentity(result, account);
  if (!tweetId) {
    saveQueueItem({
      ...publishingItem,
      status: 'publishing',
      outputUrl: url || null,
      engagement: {
        ...(publishingItem.engagement || {}),
        send: { authority, postedAt: Date.now(), recordingError: 'Transport returned no tweet ID.' },
      },
    });
    throw new Error('Reply transport completed but returned no tweet ID; item remains publishing for reconciliation and cannot be retried automatically.');
  }

  try {
    const publishedDraft = saveDraft({ ...draft, status: 'published', publishedTweetId: tweetId });
    const publishedItem = saveQueueItem({
      ...publishingItem,
      status: 'published',
      draftId: publishedDraft.id,
      humanApprovedAt: authority.type === 'human' ? publishingItem.humanApprovedAt : null,
      approvedText: authority.type === 'human' ? publishingItem.approvedText : null,
      outputTweetId: tweetId,
      outputUrl: url || null,
      publishedAt: Date.now(),
      engagement: {
        ...(publishingItem.engagement || {}),
        send: { authority, postedAt: Date.now(), tweetId, url: url || null },
      },
    });
    recordCandidateAction({
      candidateKey: candidate.key,
      action: 'reply',
      outputTweetId: tweetId,
      outputUrl: url || null,
      commentary: text,
    });
    const alreadyRecorded = publishingItem.targetUsername
      ? listRelationshipEvents(publishingItem.targetUsername, { limit: 1000 })
        .some((event) => event.eventType === 'our_reply' && String(event.ourTweetId || '') === tweetId)
      : false;
    if (publishingItem.targetUsername && !alreadyRecorded) {
      const relationship = getRelationshipProfile(publishingItem.targetUsername);
      const meaningfulInteraction = isMeaningfulOutboundInteraction({
        behavior: publishingItem.behavior || publishedDraft.editor?.behavior || null,
        text,
        sourceText: candidate.text || '',
        engagementKind: publishingItem.engagementKind || 'initial_reply',
        relationshipStage: relationship?.relationshipStage || 'observed',
      });
      recordRelationshipEvent({
        username: publishingItem.targetUsername,
        eventType: 'our_reply',
        candidateKey: candidate.key,
        sourceTweetId: publishingItem.targetTweetId,
        ourTweetId: tweetId,
        topic: candidate.niche?.tags?.[0] || null,
        occurredAt: Date.now(),
        metadata: {
          meaningful: meaningfulInteraction,
          primaryPurpose: publishingItem.behavior?.primaryPurpose || publishedDraft.editor?.behavior?.primaryPurpose || null,
          socialMode: publishingItem.behavior?.socialMode || publishedDraft.editor?.behavior?.socialMode || null,
          conversationStage: publishingItem.behavior?.conversationStage || publishedDraft.editor?.behavior?.conversationStage || null,
          replyArchetype: publishingItem.replyArchetype || null,
          engagementKind: publishingItem.engagementKind || 'initial_reply',
          replyAuthority: authority.type,
          ...(authority.type === 'autonomous' ? {
            autonomousDecisionId: authority.decisionId,
            autonomousGrantRevision: authority.grantRevision,
            replyIntent: authority.intent,
            replyTone: authority.tone,
            autonomousSourceClass: authority.sourceClass,
          } : {}),
        },
      });
    }
    return { queueItem: publishedItem, draft: publishedDraft, tweetId, url: url || null, result };
  } catch (error) {
    saveQueueItem({
      ...publishingItem,
      status: 'publishing',
      outputTweetId: tweetId,
      outputUrl: url || null,
      engagement: {
        ...(publishingItem.engagement || {}),
        send: { authority, postedAt: Date.now(), tweetId, url: url || null, recordingError: error.message },
      },
    });
    throw new Error(`Reply posted as ${tweetId}, but local recording is incomplete: ${error.message}`);
  }
}

export async function sendApprovedEngagementReply(key, {
  authToken = process.env.AUTH_TOKEN,
  account = process.env.X_ACCOUNT || 'ham_zax',
  transport = postTweetBrowser,
} = {}) {
  if (transport === postTweetBrowser) {
    throw new Error('Scripted x.com reply mutation is disabled. Configure a compliant X API reply transport instead.');
  }
  if (typeof transport !== 'function') throw new Error('No compliant X reply mutation transport is configured.');
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem || queueItem.lane !== 'engagement' || queueItem.pipeline !== 'reply') {
    throw new Error(`Engagement reply not found: ${key}`);
  }
  if (queueItem.status !== 'approved' || !queueItem.humanApprovedAt || !queueItem.approvedText) {
    throw new Error('Reply must be explicitly human-approved before sending.');
  }
  if (!queueItem.targetTweetId) throw new Error('Engagement reply is missing targetTweetId.');
  const draft = getDraftByCandidate(key);
  if (!draft || draft.status !== 'ready') throw new Error('Approved reply draft is not ready.');
  const currentText = String(draft.body || '');
  if (currentText !== queueItem.approvedText) {
    saveQueueItem({ ...queueItem, status: 'drafting', humanApprovedAt: null, approvedText: null });
    throw new Error('Reply text changed after approval; approval was invalidated.');
  }
  const currentAnalysis = scoreDraft(draft, candidate, contentGateContext(key, 'reply'));
  if (!currentAnalysis.publishable || currentAnalysis.gates?.checks?.understandable !== true) {
    saveDraft({ ...draft, gates: currentAnalysis.gates, qualityScore: currentAnalysis.score, status: 'draft' });
    invalidateQueueApproval(key, { actor: 'system', reason: 'Current content gates changed after approval; reply requires review again.' });
    const firstFailure = currentAnalysis.gates?.failures?.[0];
    throw new Error(`Reply approval is stale under the current content gates.${firstFailure ? ` ${firstFailure.code}: ${firstFailure.message}` : ''}`);
  }
  return sendEngagementReplyTransport({
    candidate,
    queueItem,
    draft,
    text: currentText,
    authority: { type: 'human', humanApprovedAt: queueItem.humanApprovedAt },
    authToken,
    account,
    transport,
  });
}

export async function sendAutonomousEngagementReply(key, {
  exactReply,
  decisionId,
  grantRevision,
  intent,
  tone,
  sourceClass,
  generatedDraft,
  authToken = process.env.AUTH_TOKEN,
  account = process.env.X_ACCOUNT || 'ham_zax',
  transport = postTweetBrowser,
} = {}) {
  if (transport === postTweetBrowser) {
    throw new Error('Scripted x.com reply mutation is disabled. Configure a compliant X API reply transport instead.');
  }
  if (typeof transport !== 'function') throw new Error('No compliant X reply mutation transport is configured.');
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem || queueItem.lane !== 'engagement' || queueItem.pipeline !== 'reply') {
    throw new Error(`Engagement reply not found: ${key}`);
  }
  if (queueItem.humanApprovedAt || queueItem.approvedText) {
    throw new Error('Autonomous reply authority cannot consume or overwrite human approval.');
  }
  if (!queueItem.targetTweetId) throw new Error('Autonomous engagement reply is missing targetTweetId.');
  if (hasCandidateAction(key, 'reply') || queueItem.outputTweetId || queueItem.status === 'published') {
    throw new Error('This target already has a recorded reply; autonomous resend is blocked.');
  }
  const decision = getAutonomousReplyDecision(Number(decisionId));
  if (!decision
    || decision.decision !== 'sending'
    || decision.candidateKey !== key
    || decision.targetTweetId !== queueItem.targetTweetId
    || Number(decision.grantRevision) !== Number(grantRevision)
    || decision.exactReply !== String(exactReply || '')) {
    throw new Error('Autonomous reply claim/provenance does not match the exact candidate reply.');
  }
  const currentGrant = getAutonomousReplyGrantState() || {};
  if (currentGrant.state !== 'running' || currentGrant.mode !== 'live' || Number(currentGrant.revision) !== Number(grantRevision)) {
    throw new Error('Autonomous reply grant was paused, stopped, or revised after claim; transport is blocked.');
  }
  if (getAccountHealthSummary().health.state === 'constrained') {
    throw new Error('Account Health became constrained after autonomous claim; transport is blocked.');
  }
  const text = String(exactReply || '').trim();
  if (!text) throw new Error('Autonomous reply text cannot be empty.');
  const draft = saveDraft({
    ...(generatedDraft || createDraftScaffold(candidate, { pipeline: 'reply' })),
    candidateKey: key,
    body: text,
    status: 'draft',
  });
  const preparedItem = saveQueueItem({
    ...queueItem,
    draftId: draft.id,
    humanApprovedAt: null,
    approvedText: null,
  });
  return sendEngagementReplyTransport({
    candidate,
    queueItem: preparedItem,
    draft,
    text,
    authority: {
      type: 'autonomous',
      decisionId: Number(decisionId),
      grantRevision: Number(grantRevision),
      intent: intent || null,
      tone: tone || null,
      sourceClass: sourceClass || null,
    },
    authToken,
    account,
    transport,
  });
}

export function ignoreQueueItem(key, reason = '') {
  return routeCandidate(key, 'ignore', { actor: 'human', reason });
}
