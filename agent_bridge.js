import 'dotenv/config';
import { composeDraft, createDraftScaffold, scoreDraft } from './drafting.js';
import { syncAudience } from './audience.js';
import { classifyNiche, recommendDistributionAction } from './strategy.js';
import {
  candidateKey,
  getAudienceSummary,
  getCandidate,
  getDraft,
  getDraftByCandidate,
  getNextReadyDraft,
  getPerformanceSnapshot,
  hasCandidateAction,
  listAudienceProfiles,
  listCandidateActions,
  listCandidates,
  listDrafts,
  markCandidateSaved,
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
    upsertCandidates([candidate], { saved: payload.saved !== false });
    if (payload.saved !== false) markCandidateSaved(candidateKey(candidate), true);
    let draft = null;
    if (payload.createDraft) {
      draft = getDraftByCandidate(candidateKey(candidate)) || saveDraft(createDraftScaffold(getCandidate(candidateKey(candidate))));
    }
    result({ candidate: getCandidate(candidateKey(candidate)), draft });
    return;
  }

  if (command === 'inspect') {
    const candidate = requireCandidate(payload.key);
    result({ candidate, draft: getDraftByCandidate(candidate.key) });
    return;
  }

  if (command === 'create-draft') {
    const candidate = requireCandidate(payload.key);
    markCandidateSaved(candidate.key, true);
    const draft = getDraftByCandidate(candidate.key) || saveDraft(createDraftScaffold(candidate));
    result({ draft, analysis: scoreDraft(draft, candidate) });
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
    next.status = requestedStatus === 'ready' && !analysis.publishable ? 'draft' : requestedStatus;
    const draft = saveDraft(next);
    result({ draft, analysis, readyRejected: requestedStatus === 'ready' && draft.status !== 'ready' });
    return;
  }

  if (command === 'queue') {
    result({ next: getNextReadyDraft(Date.now(), Number(payload.minScore || 40)), drafts: listDrafts({ status: payload.status, limit: Number(payload.limit || 20) }) });
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

  throw new Error('Usage: node agent_bridge.js <ingest|inspect|create-draft|update-draft|queue|research|performance|decide|record-action|audience-sync|audience> < JSON');
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exit(1);
});
