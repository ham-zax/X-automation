import { createDraftScaffold, scoreDraft } from './drafting.js';
import { scoreOpportunity } from './opportunity.js';
import { postTweetHttp } from './x_http.js';
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
  listRecentPublishedContent,
  listRelationshipEvents,
  markCandidateSaved,
  recordCandidateAction,
  recordRelationshipEvent,
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

function contentGateContext(candidateKey, pipeline, confirmations = {}) {
  const queueItem = getQueueItemByCandidate(candidateKey);
  return {
    pipeline,
    recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidateKey }),
    recentReplies: pipeline === 'reply'
      ? listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidateKey })
      : [],
    factualityConfirmed: confirmations.factualityConfirmed === true,
    evidenceConfirmed: confirmations.evidenceConfirmed === true,
    mediaReady: false,
    replyArchetype: pipeline === 'reply' ? (queueItem?.replyArchetype || '') : '',
  };
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
  const previousQueueItem = getQueueItemByCandidate(key);
  const state = routeState(pipeline);
  let draft = getDraftByCandidate(key);
  if (draft?.status === 'ready') draft = saveDraft({ ...draft, gates: {}, status: 'draft' });
  let draftId = null;
  if (TEXT_PIPELINES.has(pipeline)) {
    if (draft && previousQueueItem?.pipeline && previousQueueItem.pipeline !== pipeline) {
      draft = saveDraft({ ...createDraftScaffold(candidate, { pipeline }), id: draft.id, candidateKey: key });
    }
    draft ||= saveDraft(createDraftScaffold(candidate, { pipeline }));
    draftId = draft.id;
  }

  return saveQueueItem({
    candidateKey: key,
    lane: state.lane,
    pipeline,
    status: state.status,
    draftId,
    humanApprovedAt: null,
    approvedText: null,
    routingReason: getQueueItemByCandidate(key)?.routingReason || reason || '',
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
  if (queueItem.pipeline !== 'repost') {
    draft = getDraftByCandidate(key);
    if (!draft) throw new Error(`Draft required for ${queueItem.pipeline}.`);
    analysis = scoreDraft(draft, candidate, contentGateContext(key, queueItem.pipeline, confirmations));
    draft = saveDraft({ ...draft, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
    if (!analysis.publishable) {
      const firstFailure = analysis.gates?.failures?.[0];
      const detail = firstFailure ? ` ${firstFailure.code}: ${firstFailure.message}` : '';
      throw new Error(`Draft is not publishable (${analysis.score}/50).${detail}`);
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
    const firstFailure = analysis.gates?.failures?.[0];
    const detail = firstFailure ? ` ${firstFailure.code}: ${firstFailure.message}` : '';
    throw new Error(`Reply is not publishable (${analysis.score}/50).${detail}`);
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
  if (!authToken || !csrfToken) throw new Error('Sending an approved reply requires AUTH_TOKEN and CT0.');

  saveQueueItem({ ...queueItem, status: 'publishing' });
  let result;
  try {
    result = await transport(currentText, { authToken, csrfToken }, { replyTo: queueItem.targetTweetId });
  } catch (error) {
    saveQueueItem({
      ...queueItem,
      status: 'failed',
      humanApprovedAt: null,
      approvedText: null,
      engagement: {
        ...(queueItem.engagement || {}),
        send: { failedAt: Date.now(), error: error.message },
      },
    });
    throw error;
  }

  const { tweetId, url } = outputTweetIdentity(result, account);
  if (!tweetId) {
    saveQueueItem({
      ...queueItem,
      status: 'publishing',
      outputUrl: url || null,
      engagement: {
        ...(queueItem.engagement || {}),
        send: { postedAt: Date.now(), recordingError: 'Transport returned no tweet ID.' },
      },
    });
    throw new Error('Reply transport succeeded but returned no tweet ID; item remains publishing for manual reconciliation.');
  }

  try {
    const publishedDraft = saveDraft({ ...draft, status: 'published', publishedTweetId: tweetId });
    const publishedItem = saveQueueItem({
      ...queueItem,
      status: 'published',
      draftId: publishedDraft.id,
      outputTweetId: tweetId,
      outputUrl: url || null,
      engagement: {
        ...(queueItem.engagement || {}),
        send: { postedAt: Date.now(), tweetId, url: url || null },
      },
    });
    recordCandidateAction({
      candidateKey: key,
      action: 'reply',
      outputTweetId: tweetId,
      outputUrl: url || null,
      commentary: currentText,
    });
    const alreadyRecorded = queueItem.targetUsername
      ? listRelationshipEvents(queueItem.targetUsername, { limit: 1000 })
        .some((event) => event.eventType === 'our_reply' && String(event.ourTweetId || '') === tweetId)
      : false;
    if (queueItem.targetUsername && !alreadyRecorded) {
      recordRelationshipEvent({
        username: queueItem.targetUsername,
        eventType: 'our_reply',
        candidateKey: key,
        sourceTweetId: queueItem.targetTweetId,
        ourTweetId: tweetId,
        topic: candidate.niche?.tags?.[0] || null,
        occurredAt: Date.now(),
        metadata: {
          meaningful: true,
          replyArchetype: queueItem.replyArchetype || null,
          engagementKind: queueItem.engagementKind || 'initial_reply',
        },
      });
    }
    return { queueItem: publishedItem, draft: publishedDraft, tweetId, url: url || null, result };
  } catch (error) {
    saveQueueItem({
      ...queueItem,
      status: 'publishing',
      outputTweetId: tweetId,
      outputUrl: url || null,
      engagement: {
        ...(queueItem.engagement || {}),
        send: { postedAt: Date.now(), tweetId, url: url || null, recordingError: error.message },
      },
    });
    throw new Error(`Reply posted as ${tweetId}, but local recording is incomplete: ${error.message}`);
  }
}

export function ignoreQueueItem(key, reason = '') {
  return routeCandidate(key, 'ignore', { actor: 'human', reason });
}
