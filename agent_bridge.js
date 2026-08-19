import 'dotenv/config';
import { composeDraft, scoreDraft } from './drafting.js';
import { syncAudience } from './audience.js';
import { classifyNiche, recommendDistributionAction } from './strategy.js';
import {
  inspectWorkflow,
  requestQueueReview,
  routeCandidate,
  saveCandidateToWorkflow,
} from './pipeline.js';
import {
  candidateKey,
  getAudienceSummary,
  getCandidate,
  getDraft,
  getDraftByCandidate,
  getNextReadyDraft,
  getPerformanceSnapshot,
  getRelationshipProfile,
  hasCandidateAction,
  listAudienceProfiles,
  listCandidateActions,
  listCandidates,
  listDrafts,
  listQueueItems,
  listRelationshipEvents,
  listRelationshipProfiles,
  recordCandidateAction,
  saveDraft,
  upsertCandidates,
} from './store.js';

async function readInput() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  if (!input.trim()) return {};
  return JSON.parse(input);
}

function requireCandidate(key) {
  const candidate = getCandidate(key);
  if (!candidate) throw new Error(`Candidate not found: ${key}`);
  return candidate;
}

function requireDraft(id) {
  const draft = getDraft(Number(id));
  if (!draft) throw new Error(`Draft not found: ${id}`);
  return draft;
}

function manualCandidate(payload) {
  const text = String(payload.text || '').trim();
  const url = String(payload.url || '').trim();
  if (!text) throw new Error('ingest requires text.');
  if (!url) throw new Error('ingest requires url.');
  const niche = classifyNiche(text);
  return {
    key: payload.key || url,
    source: payload.source || 'x',
    title: payload.author || payload.title || '@manual',
    text,
    url,
    timestamp: payload.timestamp ? Number(payload.timestamp) : 0,
    score: Number(payload.score || niche.score),
    niche,
    metrics: {
      views: Number(payload.metrics?.views || 0),
      likes: Number(payload.metrics?.likes || 0),
      retweets: Number(payload.metrics?.retweets || payload.metrics?.reposts || 0),
      replies: Number(payload.metrics?.replies || 0),
    },
  };
}

function result(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const command = process.argv[2];
  const payload = await readInput();

  if (command === 'ingest') {
    const candidate = manualCandidate(payload);
    const key = candidateKey(candidate);
    upsertCandidates([candidate], { saved: false });
    let workflow = payload.saved !== false ? saveCandidateToWorkflow(key, true) : inspectWorkflow(key);
    if (payload.createDraft) {
      const currentPipeline = workflow.queueItem?.pipeline;
      const pipeline = ['original', 'quote', 'thread', 'reply'].includes(currentPipeline) ? currentPipeline : 'original';
      routeCandidate(key, pipeline, { actor: 'agent' });
      workflow = inspectWorkflow(key);
    }
    result({ candidate: workflow.candidate, draft: workflow.draft, queueItem: workflow.queueItem, scores: workflow.scores, recommendation: workflow.recommendation });
    return;
  }

  if (command === 'inspect') {
    const candidate = requireCandidate(payload.key);
    result({ candidate, draft: getDraftByCandidate(candidate.key) });
    return;
  }

  if (command === 'create-draft') {
    const candidate = requireCandidate(payload.key);
    let workflow = saveCandidateToWorkflow(candidate.key, true);
    const pipeline = ['original', 'quote', 'thread', 'reply'].includes(workflow.queueItem?.pipeline) ? workflow.queueItem.pipeline : 'original';
    routeCandidate(candidate.key, pipeline, { actor: 'agent' });
    workflow = inspectWorkflow(candidate.key);
    result({ draft: workflow.draft, analysis: scoreDraft(workflow.draft, candidate), queueItem: workflow.queueItem });
    return;
  }

  if (command === 'update-draft') {
    const current = requireDraft(payload.id);
    const candidate = requireCandidate(current.candidateKey);
    const next = {
      ...current,
      hook: payload.hook ?? current.hook,
      insight: payload.insight ?? current.insight,
      evidence: payload.evidence ?? current.evidence,
      action: payload.action ?? current.action,
      scheduledAt: payload.scheduledAt == null ? current.scheduledAt : Number(payload.scheduledAt),
      publishedTweetId: payload.publishedTweetId ?? current.publishedTweetId,
    };
    next.body = composeDraft(next);
    const analysis = scoreDraft(next, candidate);
    next.qualityScore = analysis.score;
    const requestedStatus = payload.status ?? current.status;
    if (!['draft', 'ready', 'published'].includes(requestedStatus)) throw new Error(`Invalid draft status: ${requestedStatus}`);
    if (requestedStatus === 'published' && !next.publishedTweetId) throw new Error('published status requires publishedTweetId.');

    if (requestedStatus === 'published') {
      const draft = saveDraft({ ...next, status: 'published' });
      result({ draft, analysis, queueItem: inspectWorkflow(candidate.key).queueItem });
      return;
    }

    const draft = saveDraft({ ...next, status: 'draft' });
    let workflow = inspectWorkflow(candidate.key);
    if (!workflow.queueItem) workflow = saveCandidateToWorkflow(candidate.key, true);
    const pipeline = ['original', 'quote', 'thread', 'reply'].includes(workflow.queueItem?.pipeline) ? workflow.queueItem.pipeline : 'original';
    routeCandidate(candidate.key, pipeline, { actor: 'agent' });

    if (requestedStatus === 'ready') {
      const review = requestQueueReview(candidate.key);
      result({ draft: review.draft, analysis: review.analysis, approvalRequired: true, queueItem: review.queueItem });
      return;
    }

    result({ draft, analysis, queueItem: inspectWorkflow(candidate.key).queueItem });
    return;
  }

  if (command === 'queue') {
    result({
      next: getNextReadyDraft(Date.now(), Number(payload.minScore || 40)),
      drafts: listDrafts({ status: payload.draftStatus, limit: Number(payload.limit || 20) }),
      queueItems: listQueueItems({ status: payload.status, pipeline: payload.pipeline, lane: payload.lane, limit: Number(payload.limit || 20) }),
    });
    return;
  }

  if (command === 'route') {
    requireCandidate(payload.key);
    const queueItem = routeCandidate(payload.key, payload.pipeline, { actor: 'agent', reason: payload.reason || '' });
    result({ queueItem, approvalRequired: queueItem.status === 'needs_review' });
    return;
  }

  if (command === 'workflow') {
    result(inspectWorkflow(payload.key));
    return;
  }

  if (command === 'research') {
    result({ candidates: listCandidates({ source: payload.source, saved: payload.saved, viralOnly: Boolean(payload.viralOnly), withinHours: Number(payload.withinHours || 0) || undefined, limit: Number(payload.limit || 30) }) });
    return;
  }

  if (command === 'performance') {
    result(getPerformanceSnapshot(Number(payload.limit || 30)));
    return;
  }

  if (command === 'decide') {
    const candidate = requireCandidate(payload.key);
    const existingActions = listCandidateActions(candidate.key);
    const context = {
      ...(payload.context || {}),
      alreadyUsed: payload.context?.alreadyUsed ?? hasCandidateAction(candidate.key),
    };
    result({ candidate, existingActions, recommendation: recommendDistributionAction(candidate, context) });
    return;
  }

  if (command === 'record-action') {
    const candidate = requireCandidate(payload.key);
    const action = String(payload.action || '');
    if (!['direct', 'quote', 'repost', 'reply'].includes(action)) throw new Error(`Invalid action: ${action}`);
    const recorded = recordCandidateAction({
      candidateKey: candidate.key,
      action,
      outputTweetId: payload.outputTweetId || null,
      outputUrl: payload.outputUrl || null,
      commentary: payload.commentary || '',
    });
    result({ candidateKey: candidate.key, recorded, actions: listCandidateActions(candidate.key) });
    return;
  }

  if (command === 'relationship-targets') {
    result({
      targets: listRelationshipProfiles({
        className: payload.className || payload.class || undefined,
        stage: payload.stage || undefined,
        minTargetScore: Number(payload.minTargetScore ?? payload.minScore ?? 0),
        limit: Math.max(1, Math.min(200, Number(payload.limit || 30))),
      }),
    });
    return;
  }

  if (command === 'relationship-inspect') {
    const username = String(payload.username || '').replace(/^@/, '');
    if (!username) throw new Error('relationship-inspect requires username.');
    const profile = getRelationshipProfile(username);
    if (!profile) throw new Error(`Relationship profile not found: ${username}`);
    result({ profile, events: listRelationshipEvents(username, { limit: Math.max(1, Math.min(200, Number(payload.limit || 30))) }) });
    return;
  }

  if (command === 'relationship-events') {
    const username = String(payload.username || '').replace(/^@/, '');
    if (!username) throw new Error('relationship-events requires username.');
    result({ username, events: listRelationshipEvents(username, { limit: Math.max(1, Math.min(200, Number(payload.limit || 50))) }) });
    return;
  }

  if (command === 'audience-sync') {
    result(await syncAudience(payload.username || process.env.X_ACCOUNT || 'ham_zax'));
    return;
  }

  if (command === 'audience') {
    const minScore = Number(payload.minScore || 12);
    result({
      summary: getAudienceSummary(),
      targetAccounts: listAudienceProfiles({ youFollow: true, followsYou: false, minScore, limit: Number(payload.limit || 30) }),
      relevantFollowers: listAudienceProfiles({ followsYou: true, minScore, limit: Number(payload.limit || 30) }),
    });
    return;
  }

  throw new Error('Usage: node agent_bridge.js <ingest|inspect|create-draft|update-draft|queue|route|workflow|research|performance|decide|record-action|relationship-targets|relationship-inspect|relationship-events|audience-sync|audience> < JSON');
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exit(1);
});
