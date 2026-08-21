import { createDraftScaffold, scoreDraft } from './drafting.js';
import { scoreOpportunity } from './opportunity.js';
import { postTweetHttp } from './x_http.js';
import { assessStrategicRelevance, recommendDistributionAction } from './strategy.js';
import {
  deleteDraft,
  ensureQueueItem,
  getAudienceProfile,
  getCandidate,
  getDraftByCandidate,
  getEditorialRecommendation,
  getAccountHealthSummary,
  getAutonomousReplyDecision,
  getAutonomousReplyGrantState,
  getLatestEditorialSelectionForQueueItem,
  getLatestWritingStrategySelectionForQueueItem,
  getPreferenceProfile,
  getQueueItemByCandidate,
  hasCandidateAction,
  listCandidateActions,
  listAcceptedLearnedRules,
  listQueueItems,
  listResearchEvidence,
  listRecentOurConversationPosts,
  listRecentPublishedContent,
  listRelationshipEvents,
  markCandidateSaved,
  recordCandidateAction,
  recordRelationshipEvent,
  rescoreCandidateClassifications,
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
  if (!queueItem) return null;
  const selection = getLatestEditorialSelectionForQueueItem(queueItem.id);
  if (!selection) return null;
  const recommendation = getEditorialRecommendation(selection.editorialRecommendationId);
  if (!recommendation) return null;
  const evidence = listResearchEvidence({ editorialRunId: recommendation.editorialRunId, storyKey: recommendation.storyKey });
  if (recommendation.decision === 'RESEARCH_MORE') return evidence;
  const linkedIds = new Set((recommendation.evidenceIds || []).map((id) => String(id)));
  return evidence.filter((item) => linkedIds.has(String(item.id)));
}

function relationshipContext(candidate) {
  const username = sourceUsername(candidate);
  if (!username) return null;
  return getAudienceProfile(username);
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

function recommendationContext(candidate, scores, context = {}) {
  return {
    ...context,
    alreadyUsed: context.alreadyUsed ?? hasCandidateAction(candidate.key),
    canAddReplyValue: context.canAddReplyValue ?? (scores.conversationPotential >= 50 && scores.relationshipPotential > 0),
    relationshipValue: context.relationshipValue ?? scores.relationshipPotential >= 20,
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

function contentGateContext(candidateKey, pipeline, confirmations = {}) {
  const queueItem = getQueueItemByCandidate(candidateKey);
  const draft = getDraftByCandidate(candidateKey);
  const strategySelection = queueItem ? getLatestWritingStrategySelectionForQueueItem(queueItem.id) : null;
  const parentConversation = pipeline === 'reply' && queueItem?.parentOurTweetId
    ? listRecentOurConversationPosts({ limit: 100 }).find((item) => String(item.tweetId) === String(queueItem.parentOurTweetId))
    : null;
  return {
    pipeline,
    recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidateKey }),
    recentReplies: pipeline === 'reply'
      ? listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidateKey })
      : [],
    factualityConfirmed: confirmations.factualityConfirmed === true,
    evidenceConfirmed: confirmations.evidenceConfirmed === true,
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

export function refreshQueueRecommendation(key, context = {}) {
  const candidate = requireCandidate(key);
  ensureQueueItem(key);
  const scoreContext = scoringContext(candidate, context);
  const scores = scoreOpportunity(candidate, scoreContext);
  const existingQueueItem = getQueueItemByCandidate(key);
  const growthFit = assessStrategicRelevance(candidate, {
    objective: context.objective,
    humanOverride: existingQueueItem?.relevance?.humanOverride || null,
  });
  const recommendation = recommendDistributionAction(candidate, recommendationContext(candidate, scores, {
    ...context,
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
    throw new Error(`Growth Focus override is only needed for outside-focus opportunities; current state is ${growthFit.state}.`);
  }
  const explanation = String(reason || '').trim();
  if (!explanation) throw new Error('Using an outside-focus opportunity requires a short human reason.');
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

export function inspectWorkflow(key) {
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  const storedDraft = getDraftByCandidate(key);
  const historicalDraft = storedDraft?.status === 'published'
    || queueItem?.status === 'published'
    || Boolean(queueItem?.publishedAt || queueItem?.outputTweetId);
  let draft = storedDraft;
  if (storedDraft && queueItem && !historicalDraft && TEXT_PIPELINES.has(queueItem.pipeline)) {
    const checks = storedDraft.gates?.checks || {};
    const analysis = scoreDraft(storedDraft, candidate, contentGateContext(key, queueItem.pipeline, {
      factualityConfirmed: checks.factualityConfirmed === true,
      evidenceConfirmed: checks.evidenceConfirmed === true,
    }));
    draft = { ...storedDraft, qualityScore: analysis.score, gates: analysis.gates };
  }
  const scores = scoreOpportunity(candidate, scoringContext(candidate));
  const growthFit = assessStrategicRelevance(candidate, { humanOverride: queueItem?.relevance?.humanOverride || null });
  const currentRecommendation = queueItem
    ? recommendDistributionAction(candidate, recommendationContext(candidate, scores, {
        strategicRelevance: growthFit,
        relevanceOverride: queueItem?.relevance?.humanOverride || null,
      }))
    : null;
  return {
    candidate,
    queueItem,
    draft,
    actions: listCandidateActions(key),
    scores,
    growthFit,
    recommendation: currentRecommendation
      ? { ...currentRecommendation, pipeline: actionToPipeline(currentRecommendation.action) }
      : null,
  };
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

export function routeCandidate(key, pipeline, { actor = 'human', reason = '' } = {}) {
  const candidate = requireCandidate(key);
  if (!PIPELINES.includes(pipeline)) throw new Error(`Invalid pipeline: ${pipeline}`);
  if (!['human', 'agent'].includes(actor)) throw new Error(`Invalid routing actor: ${actor}`);

  ensureQueueItem(key);
  let previousQueueItem = getQueueItemByCandidate(key);
  if (['publishing', 'published'].includes(previousQueueItem.status) || previousQueueItem.outputTweetId || previousQueueItem.publishedAt) {
    throw new Error('Published or publishing items cannot be rerouted; use the publication reconciliation path instead.');
  }
  const existingEngagementReply = pipeline === 'reply'
    && previousQueueItem.lane === 'engagement'
    && previousQueueItem.pipeline === 'reply';
  if (!existingEngagementReply) {
    refreshQueueRecommendation(key);
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
      throw new Error('This opportunity is outside the current Growth Focus. Choose “Use this opportunity anyway” and provide a reason before proceeding.');
    }
  }
  const state = routeState(pipeline);
  let draft = getDraftByCandidate(key);
  if (draft?.status === 'ready') draft = saveDraft({ ...draft, gates: {}, status: 'draft' });
  let draftId = null;
  if (TEXT_PIPELINES.has(pipeline)) {
    const draftPipeline = draft?.editor?.pipeline || (TEXT_PIPELINES.has(previousQueueItem?.pipeline) ? previousQueueItem.pipeline : '');
    if (draft && draftPipeline && draftPipeline !== pipeline) {
      draft = saveDraft({ ...createDraftScaffold(candidate, { pipeline }), id: draft.id, candidateKey: key, editor: { pipeline } });
    }
    draft ||= saveDraft({ ...createDraftScaffold(candidate, { pipeline }), editor: { pipeline } });
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
    routingDecision: ['ignore', 'watch', 'research'].includes(pipeline) ? {} : (previousQueueItem.routingDecision || {}),
    ...replyTarget,
  });
}

export function requestQueueReview(key, confirmations = {}) {
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem) throw new Error(`Queue item not found: ${key}`);

  if (queueItem.pipeline === 'repost') {
    return saveQueueItem({ candidateKey: key, status: 'needs_review' });
  }
  if (!TEXT_PIPELINES.has(queueItem.pipeline)) throw new Error(`Pipeline ${queueItem.pipeline} cannot request content review.`);

  const draft = getDraftByCandidate(key);
  if (!draft) throw new Error(`Draft required for ${queueItem.pipeline}.`);
  const analysis = scoreDraft(draft, candidate, contentGateContext(key, queueItem.pipeline, confirmations));
  const savedDraft = saveDraft({ ...draft, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
  return {
    queueItem: saveQueueItem({ candidateKey: key, status: 'needs_review', draftId: savedDraft.id, humanApprovedAt: null, approvedText: null }),
    draft: savedDraft,
    analysis,
  };
}

export function approveQueueItem(key, confirmations = {}) {
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
    if (!growthFit.allowed) throw new Error('This repost is outside the current Growth Focus. Choose “Use this opportunity anyway” and provide a reason before approval.');
  } else {
    draft = getDraftByCandidate(key);
    if (!draft) throw new Error(`Draft required for ${queueItem.pipeline}.`);
    requireCurrentStrategyDecision(queueItem, draft);
    analysis = scoreDraft(draft, candidate, contentGateContext(key, queueItem.pipeline, confirmations));
    draft = saveDraft({ ...draft, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
    if (!analysis.publishable) {
      const firstFailure = analysis.gates?.failures?.[0] || analysis.growthPackaging?.blockers?.[0];
      const detail = firstFailure ? ` ${firstFailure.code}: ${firstFailure.message}` : '';
      throw new Error(`Draft is not approval-ready. Writing quality is ${analysis.score}/50.${detail}`);
    }
    draft = saveDraft({ ...draft, status: 'ready' });
  }

  return {
    queueItem: saveQueueItem({
      candidateKey: key,
      status: 'approved',
      draftId: draft?.id ?? null,
      humanApprovedAt: Date.now(),
      publishStartedAt: null,
      publishError: null,
    }),
    draft,
    analysis,
  };
}

export function approveEngagementQueueItem(key, confirmations = {}, { actor = 'human' } = {}) {
  if (actor !== 'human') throw new Error('Engagement approval requires an explicit human action.');
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem || queueItem.lane !== 'engagement' || queueItem.pipeline !== 'reply') {
    throw new Error(`Engagement reply not found: ${key}`);
  }
  if (queueItem.status !== 'needs_review') throw new Error('Engagement reply must be in needs_review before approval.');

  const draft = getDraftByCandidate(key);
  if (!draft) throw new Error('A reply draft is required before approval.');
  const analysis = scoreDraft(draft, candidate, contentGateContext(key, 'reply', confirmations));
  const checkedDraft = saveDraft({ ...draft, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
  if (!analysis.publishable) {
    const firstFailure = analysis.gates?.failures?.[0] || analysis.growthPackaging?.blockers?.[0];
    const detail = firstFailure ? ` ${firstFailure.code}: ${firstFailure.message}` : '';
    throw new Error(`Reply is not approval-ready. Writing quality is ${analysis.score}/50.${detail}`);
  }
  const approvedText = String(checkedDraft.body || '');
  if (!approvedText.trim()) throw new Error('Approved reply text cannot be empty.');
  const readyDraft = saveDraft({ ...checkedDraft, status: 'ready' });
  return {
    queueItem: saveQueueItem({
      candidateKey: key,
      status: 'approved',
      draftId: readyDraft.id,
      humanApprovedAt: Date.now(),
      approvedText,
    }),
    draft: readyDraft,
    analysis,
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
  csrfToken,
  account,
  transport,
}) {
  if (!authToken || !csrfToken) throw new Error('Sending a reply requires AUTH_TOKEN and CT0.');
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
    result = await transport(text, { authToken, csrfToken }, { replyTo: publishingItem.targetTweetId });
  } catch (error) {
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
      recordRelationshipEvent({
        username: publishingItem.targetUsername,
        eventType: 'our_reply',
        candidateKey: candidate.key,
        sourceTweetId: publishingItem.targetTweetId,
        ourTweetId: tweetId,
        topic: candidate.niche?.tags?.[0] || null,
        occurredAt: Date.now(),
        metadata: {
          meaningful: true,
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
  csrfToken = process.env.CT0,
  account = process.env.X_ACCOUNT || 'ham_zax',
  transport = postTweetHttp,
} = {}) {
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
  return sendEngagementReplyTransport({
    candidate,
    queueItem,
    draft,
    text: currentText,
    authority: { type: 'human', humanApprovedAt: queueItem.humanApprovedAt },
    authToken,
    csrfToken,
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
  csrfToken = process.env.CT0,
  account = process.env.X_ACCOUNT || 'ham_zax',
  transport = postTweetHttp,
} = {}) {
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
  if (decision.checks?.policy?.allowed !== true) {
    throw new Error('Autonomous reply policy authority is not satisfied for this interaction.');
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
    csrfToken,
    account,
    transport,
  });
}

export function ignoreQueueItem(key, reason = '') {
  return routeCandidate(key, 'ignore', { actor: 'human', reason });
}
