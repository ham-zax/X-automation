import { createDraftScaffold, scoreDraft } from './drafting.js';
import { scoreOpportunity } from './opportunity.js';
import { recommendDistributionAction } from './strategy.js';
import {
  ensureQueueItem,
  getCandidate,
  getDraftByCandidate,
  getPreferenceProfile,
  getQueueItemByCandidate,
  hasCandidateAction,
  listAudienceProfiles,
  listCandidateActions,
  markCandidateSaved,
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
  'watching',
  'ignored',
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

function relationshipContext(candidate) {
  const username = sourceUsername(candidate);
  if (!username) return null;
  return listAudienceProfiles({ minScore: 0, limit: 2000 })
    .find((profile) => String(profile.username || '').toLowerCase() === username) || null;
}

function scoringContext(candidate, context = {}) {
  return {
    preference: getPreferenceProfile(),
    relationship: context.relationship ?? relationshipContext(candidate),
    now: context.now || Date.now(),
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

export function refreshQueueRecommendation(key, context = {}) {
  const candidate = requireCandidate(key);
  ensureQueueItem(key);
  const scoreContext = scoringContext(candidate, context);
  const scores = scoreOpportunity(candidate, scoreContext);
  const recommendation = recommendDistributionAction(candidate, recommendationContext(candidate, scores, context));
  const recommendedPipeline = actionToPipeline(recommendation.action);
  const queueItem = saveQueueItem({
    candidateKey: key,
    reachPotential: scores.reachPotential,
    followPotential: scores.followPotential,
    conversationPotential: scores.conversationPotential,
    relationshipPotential: scores.relationshipPotential,
    recommendedPipeline,
    routingReason: recommendation.reason,
  });
  return { candidate, queueItem, scores, recommendation: { ...recommendation, pipeline: recommendedPipeline } };
}

export function inspectWorkflow(key) {
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  const scores = scoreOpportunity(candidate, scoringContext(candidate));
  return {
    candidate,
    queueItem,
    draft: getDraftByCandidate(key),
    actions: listCandidateActions(key),
    scores,
    recommendation: queueItem ? { pipeline: queueItem.recommendedPipeline, reason: queueItem.routingReason } : null,
  };
}

export function saveCandidateToWorkflow(key, saved = true) {
  const candidate = requireCandidate(key);
  markCandidateSaved(key, saved);
  if (!saved) return inspectWorkflow(key);
  ensureQueueItem(key);
  return refreshQueueRecommendation(key);
}

export function routeCandidate(key, pipeline, { actor = 'human', reason = '' } = {}) {
  const candidate = requireCandidate(key);
  if (!PIPELINES.includes(pipeline)) throw new Error(`Invalid pipeline: ${pipeline}`);
  if (!['human', 'agent'].includes(actor)) throw new Error(`Invalid routing actor: ${actor}`);

  ensureQueueItem(key);
  const state = routeState(pipeline);
  let draftId = null;
  if (TEXT_PIPELINES.has(pipeline)) {
    const draft = getDraftByCandidate(key) || saveDraft(createDraftScaffold(candidate));
    draftId = draft.id;
  }

  return saveQueueItem({
    candidateKey: key,
    lane: state.lane,
    pipeline,
    status: state.status,
    draftId,
    humanApprovedAt: null,
    routingReason: getQueueItemByCandidate(key)?.routingReason || reason || '',
  });
}

export function requestQueueReview(key) {
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem) throw new Error(`Queue item not found: ${key}`);

  if (queueItem.pipeline === 'repost') {
    return saveQueueItem({ candidateKey: key, status: 'needs_review' });
  }
  if (!TEXT_PIPELINES.has(queueItem.pipeline)) throw new Error(`Pipeline ${queueItem.pipeline} cannot request content review.`);

  const draft = getDraftByCandidate(key);
  if (!draft) throw new Error(`Draft required for ${queueItem.pipeline}.`);
  const analysis = scoreDraft(draft, candidate);
  const savedDraft = saveDraft({ ...draft, qualityScore: analysis.score, status: 'draft' });
  return {
    queueItem: saveQueueItem({ candidateKey: key, status: 'needs_review', draftId: savedDraft.id }),
    draft: savedDraft,
    analysis,
  };
}

export function approveQueueItem(key) {
  const candidate = requireCandidate(key);
  const queueItem = getQueueItemByCandidate(key);
  if (!queueItem) throw new Error(`Queue item not found: ${key}`);
  if (!MAIN_FEED_PIPELINES.has(queueItem.pipeline)) throw new Error(`Pipeline ${queueItem.pipeline} is not a main-feed approval route.`);
  if (queueItem.status !== 'needs_review') throw new Error('Queue item must be in needs_review before approval.');

  let draft = null;
  let analysis = null;
  if (queueItem.pipeline !== 'repost') {
    draft = getDraftByCandidate(key);
    if (!draft) throw new Error(`Draft required for ${queueItem.pipeline}.`);
    analysis = scoreDraft(draft, candidate);
    if (!analysis.publishable) throw new Error(`Draft is not publishable (${analysis.score}/50).`);
    draft = saveDraft({ ...draft, qualityScore: analysis.score, status: 'ready' });
  }

  return {
    queueItem: saveQueueItem({
      candidateKey: key,
      status: 'approved',
      draftId: draft?.id ?? null,
      humanApprovedAt: Date.now(),
    }),
    draft,
    analysis,
  };
}

export function ignoreQueueItem(key, reason = '') {
  return routeCandidate(key, 'ignore', { actor: 'human', reason });
}
