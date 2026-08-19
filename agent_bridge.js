import 'dotenv/config';
import { applyWriterOutput, buildWriterPacket, composeDraft, scoreDraft } from './drafting.js';
import { refreshEngagementOpportunities } from './engagement.js';
import { syncAudience } from './audience.js';
import { classifyNiche, recommendDistributionAction } from './strategy.js';
import {
  inspectWorkflow,
  requestQueueReview,
  resolveEngagementItem,
  routeCandidate,
  saveCandidateToWorkflow,
  sendApprovedEngagementReply,
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
  listEngagementItems,
  listQueueItems,
  listRecentPublishedContent,
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

function sourceUsername(candidate) {
  if (candidate?.source !== 'x') return '';
  const title = String(candidate.title || '').trim();
  if (title.startsWith('@')) return title.slice(1).toLowerCase();
  const match = String(candidate.url || '').match(/x\.com\/([^/]+)/i);
  return match?.[1]?.toLowerCase() || '';
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

function engagementPacket(queueItem) {
  const candidate = getCandidate(queueItem.candidateKey);
  const draft = getDraftByCandidate(queueItem.candidateKey);
  const relationship = queueItem.targetUsername ? getRelationshipProfile(queueItem.targetUsername) : null;
  return { queueItem, candidate, draft, relationship };
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

  if (command === 'writer-packet') {
    const workflow = inspectWorkflow(payload.key);
    const pipeline = workflow.queueItem?.pipeline;
    if (!['original', 'quote', 'thread', 'reply'].includes(pipeline)) {
      throw new Error(`writer-packet requires a routed text pipeline; current pipeline is ${pipeline || 'none'}.`);
    }
    if (!workflow.draft) throw new Error(`Draft required for ${pipeline}.`);
    const username = sourceUsername(workflow.candidate);
    result(buildWriterPacket({
      candidate: workflow.candidate,
      queueItem: workflow.queueItem,
      draft: workflow.draft,
      relationship: username ? getRelationshipProfile(username) : null,
      recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: workflow.candidate.key }),
      recentReplies: listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: workflow.candidate.key }),
    }));
    return;
  }

  if (command === 'apply-writer-output') {
    const current = requireDraft(payload.id);
    const candidate = requireCandidate(current.candidateKey);
    const workflow = inspectWorkflow(candidate.key);
    const pipeline = workflow.queueItem?.pipeline;
    if (!['original', 'quote', 'thread', 'reply'].includes(pipeline)) {
      throw new Error(`apply-writer-output requires a routed text pipeline; current pipeline is ${pipeline || 'none'}.`);
    }
    if (payload.output?.pipeline !== pipeline) {
      throw new Error(`Writer pipeline mismatch: ${payload.output?.pipeline || 'missing'} !== ${pipeline}. Route the queue item first.`);
    }
    const writerBase = current.editor?.pipeline && current.editor.pipeline !== pipeline
      ? { ...current, editor: {} }
      : current;
    const next = applyWriterOutput(writerBase, payload.output || {});
    const analysis = scoreDraft(next, candidate, {
      pipeline,
      recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidate.key }),
      recentReplies: pipeline === 'reply'
        ? listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidate.key })
        : [],
      factualityConfirmed: false,
      evidenceConfirmed: false,
      mediaReady: false,
    });
    const draft = saveDraft({ ...next, gates: analysis.gates, qualityScore: analysis.score, status: 'draft' });
    const queueItem = routeCandidate(candidate.key, pipeline, { actor: 'agent' });
    result({
      draft,
      analysis,
      queueItem,
      ...(payload.output?.decision === 'DO_NOT_POST'
        ? { recommendation: 'Do not publish this draft; route the queue item to research, watch, or ignore as appropriate.' }
        : {}),
    });
    return;
  }

  if (command === 'update-draft') {
    const current = requireDraft(payload.id);
    const candidate = requireCandidate(current.candidateKey);
    let workflow = inspectWorkflow(candidate.key);
    if (!workflow.queueItem) workflow = saveCandidateToWorkflow(candidate.key, true);
    const pipeline = ['original', 'quote', 'thread', 'reply'].includes(workflow.queueItem?.pipeline) ? workflow.queueItem.pipeline : 'original';
    const next = {
      ...current,
      hook: payload.hook ?? current.hook,
      insight: payload.insight ?? current.insight,
      evidence: payload.evidence ?? current.evidence,
      action: payload.action ?? current.action,
      scheduledAt: payload.scheduledAt == null ? current.scheduledAt : Number(payload.scheduledAt),
      publishedTweetId: payload.publishedTweetId ?? current.publishedTweetId,
    };
    if (pipeline === 'thread') {
      if (payload.threadParts != null && !Array.isArray(payload.threadParts)) throw new Error('threadParts must be an array.');
      next.threadParts = (payload.threadParts ?? current.threadParts ?? []).map((part) => String(part ?? ''));
      next.body = '';
      if (Object.keys(current.editor || {}).length) next.editor = { ...current.editor, pipeline, threadParts: [...next.threadParts] };
    } else {
      next.body = payload.body ?? (current.editor?.finalText ? current.body : composeDraft(next, { pipeline }));
      if (Object.keys(current.editor || {}).length) next.editor = { ...current.editor, pipeline, finalText: next.body };
    }
    const analysis = scoreDraft(next, candidate);
    next.qualityScore = analysis.score;
    next.gates = {};
    const requestedStatus = payload.status ?? current.status;
    if (!['draft', 'ready', 'published'].includes(requestedStatus)) throw new Error(`Invalid draft status: ${requestedStatus}`);
    if (requestedStatus === 'published' && !next.publishedTweetId) throw new Error('published status requires publishedTweetId.');

    if (requestedStatus === 'published') {
      const draft = saveDraft({ ...next, status: 'published' });
      result({ draft, analysis, queueItem: inspectWorkflow(candidate.key).queueItem });
      return;
    }

    const draft = saveDraft({ ...next, status: 'draft' });
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

  if (command === 'engage-next') {
    const refresh = payload.refresh === false ? null : await refreshEngagementOpportunities({
      targetLimit: Math.max(1, Math.min(50, Number(payload.targetLimit || 12))),
      postsPerTarget: Math.max(1, Math.min(10, Number(payload.postsPerTarget || 4))),
      minTargetScore: Number(payload.minTargetScore ?? 35),
      targetSinceHours: Math.max(1, Number(payload.targetSinceHours || 24)),
      responseSinceHours: Math.max(1, Number(payload.responseSinceHours || 72)),
    });
    const items = listEngagementItems({
      status: payload.status || undefined,
      minPriority: Number(payload.minPriority || 0),
      includeExpired: Boolean(payload.includeExpired),
      limit: Math.max(1, Math.min(200, Number(payload.limit || 50))),
    });
    const packets = items.map(engagementPacket);
    result({
      refresh: refresh ? { refreshed: refresh.refreshed, rejected: refresh.rejected, expired: refresh.expired, errors: refresh.errors } : null,
      activeConversations: packets.filter((item) => item.queueItem.engagementKind !== 'initial_reply'),
      newOpportunities: packets.filter((item) => item.queueItem.engagementKind === 'initial_reply'),
    });
    return;
  }

  if (command === 'engage-draft') {
    const key = String(payload.key || '');
    if (!key) throw new Error('engage-draft requires key.');
    const item = listEngagementItems({ includeExpired: true, limit: 500 }).find((queueItem) => queueItem.candidateKey === key);
    if (!item) throw new Error(`Engagement item not found: ${key}`);
    if (['published', 'ignored', 'expired'].includes(item.status)) throw new Error(`Engagement item is terminal: ${item.status}.`);
    routeCandidate(key, 'reply', { actor: 'agent' });
    let workflow = inspectWorkflow(key);
    if (payload.body != null) {
      const body = String(payload.body).trim();
      if (!body) throw new Error('engage-draft body cannot be empty.');
      const updated = {
        ...workflow.draft,
        body,
        gates: {},
        status: 'draft',
        editor: { ...(workflow.draft.editor || {}), pipeline: 'reply', finalText: body },
      };
      updated.qualityScore = scoreDraft(updated, workflow.candidate).score;
      saveDraft(updated);
      routeCandidate(key, 'reply', { actor: 'agent' });
      workflow = inspectWorkflow(key);
    }
    let review = null;
    if (payload.requestReview === true) {
      review = requestQueueReview(key, {
        factualityConfirmed: payload.factualityConfirmed === true,
        evidenceConfirmed: payload.evidenceConfirmed === true,
      });
      workflow = inspectWorkflow(key);
    }
    const queueItem = workflow.queueItem;
    result({
      ...engagementPacket(queueItem),
      review: review ? { analysis: review.analysis, approvalRequired: true } : null,
      writerPacket: buildWriterPacket({
        candidate: workflow.candidate,
        queueItem,
        draft: workflow.draft,
        relationship: queueItem.targetUsername ? getRelationshipProfile(queueItem.targetUsername) : null,
        recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: key }),
        recentReplies: listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: key }),
        recentReplyArchetypes: listEngagementItems({ includeExpired: true, limit: 30 })
          .filter((recent) => recent.candidateKey !== key && recent.replyArchetype)
          .map((recent) => recent.replyArchetype),
      }),
    });
    return;
  }

  if (command === 'engage-resolve') {
    const key = String(payload.key || '');
    const action = String(payload.action || '');
    if (!key) throw new Error('engage-resolve requires key.');
    if (action === 'ignore' || action === 'expire') {
      result({ queueItem: resolveEngagementItem(key, action, payload.reason || '') });
      return;
    }
    if (action === 'send') {
      if (payload.confirmSend !== true) throw new Error('engage-resolve send requires confirmSend=true for the explicit send action.');
      result(await sendApprovedEngagementReply(key));
      return;
    }
    throw new Error(`Invalid engage-resolve action: ${action || 'missing'}.`);
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

  throw new Error('Usage: node agent_bridge.js <ingest|inspect|create-draft|writer-packet|apply-writer-output|update-draft|queue|route|workflow|research|performance|decide|record-action|engage-next|engage-draft|engage-resolve|relationship-targets|relationship-inspect|relationship-events|audience-sync|audience> < JSON');
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exit(1);
});
