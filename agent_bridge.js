import 'dotenv/config';
import { applyWriterOutput, buildWriterPacket, composeDraft, scoreDraft } from './drafting.js';
import { refreshEngagementOpportunities } from './engagement.js';
import {
  AUTONOMOUS_REPLY_LIVE_TRANSPORT_READY,
  AUTONOMOUS_REPLY_WRITE_TRANSPORT,
  getAutonomousReplyGrant,
  getAutonomousReplyRuntime,
} from './autonomous_reply.js';
import { reviewAudienceFollowing, syncAudience } from './audience.js';
import {
  acquireOperatorLease,
  getOperatorLeaseStatus,
  releaseOperatorLease,
  renewOperatorLease,
} from './operator_lease.js';
import { getAutonomousMainFeedMissionStatus } from './autonomous_main_feed.js';
import { fetchXUnderTheHoodReport } from './tech_news.js';
import { refreshSourceSnapshot } from './source_refresh.js';
import { rankMainFeedItems, recommendMainFeedSchedule } from './scheduler.js';
import { assessDiscoveryQuality, classifyNiche, recommendDistributionAction } from './strategy.js';
import { extractViralStyleFeatures } from './viral_style.js';
import {
  EDITORIAL_OBJECTIVES,
  dismissEditorialRecommendation,
  refreshEditorialPlan,
  selectEditorialRecommendation,
} from './editorial.js';
import { attachEditorialResearchSource } from './research.js';
import {
  ensureCandidateWorkflow,
  inspectGrowthOpportunity,
  inspectWorkflow,
  recommendationContext,
  requestQueueReview,
  resolveEngagementItem,
  rescoreCandidateRelevance,
  routeCandidate,
  saveCandidateToWorkflow,
  sendApprovedEngagementReply,
} from './pipeline.js';
import {
  ACCOUNT_HEALTH_OBSERVATION_TYPES,
  AI_ROLES,
  SOURCE_SNAPSHOT_KINDS,
  acceptLearnedRule,
  assignExperimentVariant,
  candidateKey,
  createExperiment,
  clearAiDefaultProfile,
  clearAiRoleBinding,
  getAccountAnalyticsSnapshot,
  getAccountHealthSummary,
  getAiProfile,
  getAppState,
  getAiRuntimeSettings,
  getAudienceSummary,
  getCandidate,
  getCandidateDisposition,
  getDraft,
  getDraftByCandidate,
  getDiscoverSnapshot,
  getEditorialOutcomeSummary,
  getEditorialRecommendation,
  getEditorialSelectionByRecommendation,
  getExperiment,
  getExperimentSummary,
  getGrowthOperatorMemoryCheckpoint,
  getLearningOverview,
  getLatestEditorialPlan,
  getMainFeedScheduleItem,
  getNewFollowerQuality,
  getNicheProfile,
  getPublicationMeasurements,
  getPerformanceSnapshot,
  getQueueItem,
  getRelationshipProfile,
  getSourceMomentum,
  hasCandidateAction,
  listAudienceProfiles,
  listAcceptedLearnedRules,
  listAiProfiles,
  listCandidateActions,
  listCandidates,
  listDrafts,
  listDueMeasurementWindows,
  listEngagementItems,
  listExperimentAssignments,
  listExperiments,
  listApprovedMainFeedItems,
  listPublicationMeasurementSeries,
  listQueueItems,
  listRecentMainFeedPublications,
  listRecentPublishedContent,
  listResearchEvidence,
  listRelationshipEvents,
  listRelationshipProfiles,
  recordAccountHealthObservation,
  recordAudienceAnalyticsSnapshot,
  recordCandidateAction,
  recordCandidateDisposition,
  recordGrowthOperatorMemoryReview,
  recordPerformanceSnapshot,
  recordRelationshipEvent,
  recordUnderTheHoodSnapshot,
  refreshLearnedRuleSuggestion,
  retireLearnedRule,
  saveDraft,
  saveQueueItem,
  setAiDefaultProfile,
  setAiRoleBinding,
  upsertCandidates,
  resolveAiProfileForRole,
} from './store.js';
import { listAiRuntimeAvailability } from './ai_runtime.js';
import {
  buildWritingStrategyGenerationProvenance,
  classifyPublishedContent,
  getWritingStrategyGenerationContext,
  getWritingStrategyPreview,
  recommendWritingStrategy,
  selectWritingStrategy,
  validateWritingStrategyGenerationContext,
} from './writing_strategy.js';

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

const ACCOUNT_ANALYTICS_CONTENT_TYPES = new Set(['posts', 'replies', 'all']);
const ACCOUNT_ANALYTICS_AUDIENCE_METRICS = new Set([
  'likes',
  'impressions',
  'bookmarks',
  'shares',
  'new_follows',
  'replies',
  'reposts',
  'profile_visits',
]);

function observedAnalyticsNumber(input, label, aliases, { required = false } = {}) {
  for (const name of aliases) {
    if (!Object.hasOwn(input, name)) continue;
    const value = input[name];
    if (value == null || value === '' || value === '-') return required ? null : undefined;
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Invalid ${label}: ${value}`);
    return number;
  }
  return required ? null : undefined;
}

function normalizeAccountAnalyticsPost(post, index) {
  if (!post || typeof post !== 'object' || Array.isArray(post)) throw new Error(`analytics-record post ${index} must be an object.`);
  const id = String(post.id || post.tweetId || '').trim();
  if (!id) throw new Error(`analytics-record post ${index} requires id or tweetId.`);
  const impressions = observedAnalyticsNumber(post, 'impressions', ['impressions', 'views'], { required: true });
  const likes = observedAnalyticsNumber(post, 'likes', ['likes'], { required: true });
  const replies = observedAnalyticsNumber(post, 'replies', ['replies'], { required: true });
  const reposts = observedAnalyticsNumber(post, 'reposts', ['reposts', 'retweets'], { required: true });
  for (const [label, value] of [['impressions', impressions], ['likes', likes], ['replies', replies], ['reposts', reposts]]) {
    if (value == null) throw new Error(`analytics-record post ${index} requires observed ${label}; do not convert missing analytics to zero.`);
  }
  return {
    id,
    text: String(post.text || ''),
    timestamp: Number(post.publishedAt ?? post.timestamp ?? 0) || 0,
    views: impressions,
    likes,
    replies,
    retweets: reposts,
    bookmarks: observedAnalyticsNumber(post, 'bookmarks', ['bookmarks']),
    shares: observedAnalyticsNumber(post, 'shares', ['shares']),
    profileVisits: observedAnalyticsNumber(post, 'profile visits', ['profileVisits', 'profile_visits']),
    newFollows: observedAnalyticsNumber(post, 'new follows', ['newFollows', 'new_follows']),
    engagementRatePct: observedAnalyticsNumber(post, 'engagement rate', ['engagementRatePct', 'engagement_rate_pct', 'engagementRate']),
    mediaViews: observedAnalyticsNumber(post, 'media views', ['mediaViews', 'media_views']),
  };
}

function normalizeAudienceAnalyticsMetric(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function sourceUsername(candidate) {
  if (candidate?.source !== 'x') return '';
  const title = String(candidate.title || '').trim();
  if (title.startsWith('@')) return title.slice(1).toLowerCase();
  const match = String(candidate.url || '').match(/x\.com\/([^/]+)/i);
  return match?.[1]?.toLowerCase() || '';
}

function observedMetric(metrics, ...names) {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return undefined;
  for (const name of names) {
    if (!Object.hasOwn(metrics, name)) continue;
    const value = metrics[name];
    if (value == null || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

function manualCandidate(payload) {
  const text = String(payload.text || '').trim();
  const url = String(payload.url || '').trim();
  if (!text) throw new Error('ingest requires text.');
  if (!url) throw new Error('ingest requires url.');
  const niche = classifyNiche(text);
  const metrics = {};
  for (const [key, value] of [
    ['views', observedMetric(payload.metrics, 'views')],
    ['likes', observedMetric(payload.metrics, 'likes')],
    ['retweets', observedMetric(payload.metrics, 'retweets', 'reposts')],
    ['replies', observedMetric(payload.metrics, 'replies')],
    ['bookmarks', observedMetric(payload.metrics, 'bookmarks')],
  ]) {
    if (value !== undefined) metrics[key] = value;
  }
  const urlAuthor = url.match(/x\.com\/([^/]+)/i)?.[1];
  return {
    key: payload.key || url,
    source: payload.source || 'x',
    title: payload.author || payload.title || (urlAuthor ? `@${urlAuthor}` : '@manual'),
    text,
    url,
    timestamp: payload.timestamp ? Number(payload.timestamp) : 0,
    score: payload.score == null ? Number(niche.score || 0) : Number(payload.score),
    niche,
    metrics,
  };
}

function suppliedOperatorSource(payload) {
  if (payload.source && typeof payload.source === 'object' && !Array.isArray(payload.source)) return payload.source;
  return payload.text || payload.url ? payload : null;
}

function resolveOperatorCandidate(payload) {
  const supplied = suppliedOperatorSource(payload);
  if (!supplied) return requireCandidate(payload.key);
  const normalized = manualCandidate({ ...supplied, key: supplied.key || payload.key });
  const key = candidateKey(normalized);
  const existing = getCandidate(key);
  const candidate = existing ? {
    ...existing,
    ...normalized,
    timestamp: normalized.timestamp || existing.timestamp,
    metrics: { ...(existing.metrics || {}), ...(normalized.metrics || {}) },
  } : normalized;
  upsertCandidates([candidate], { saved: false });
  return requireCandidate(key);
}

function operatorSourceContext(payload) {
  if (payload.sourceContext && typeof payload.sourceContext === 'object' && !Array.isArray(payload.sourceContext)) {
    return payload.sourceContext;
  }
  const source = suppliedOperatorSource(payload);
  if (!source) return null;
  return {
    observedAt: source.observedAt,
    sourceTimestamp: source.timestamp,
    sourceKinds: Array.isArray(source.sourceKinds) ? source.sourceKinds : undefined,
    metrics: source.metrics && typeof source.metrics === 'object' && !Array.isArray(source.metrics) ? source.metrics : {},
  };
}

function reconcileRecordedActionWorkflow(candidate, action, recorded) {
  const workflow = inspectWorkflow(candidate.key);
  const queueItem = workflow.queueItem;
  if (!queueItem) return null;
  const compatible = (action === 'reply' && queueItem.pipeline === 'reply')
    || (action === 'quote' && queueItem.pipeline === 'quote')
    || (action === 'direct' && queueItem.pipeline === 'original')
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
      recordRelationshipEvent({
        username: reconciled.targetUsername,
        eventType: 'our_reply',
        candidateKey: candidate.key,
        sourceTweetId: reconciled.targetTweetId,
        ourTweetId: tweetId,
        topic: candidate.niche?.tags?.[0] || null,
        occurredAt: publishedAt,
        metadata: {
          meaningful: true,
          replyArchetype: reconciled.replyArchetype || null,
          engagementKind: reconciled.engagementKind || 'initial_reply',
          replyAuthority: 'manual_reconciliation',
        },
      });
    }
  }
  return reconciled;
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

function compactEngagementPacket(queueItem) {
  const candidate = getCandidate(queueItem.candidateKey);
  return {
    id: queueItem.id,
    candidateKey: queueItem.candidateKey,
    source: {
      url: candidate?.url || queueItem.candidateKey,
      text: candidate?.text || '',
      timestamp: candidate?.timestamp || null,
    },
    targetUsername: queueItem.targetUsername || null,
    targetTweetId: queueItem.targetTweetId || null,
    engagementKind: queueItem.engagementKind,
    sourceClass: queueItem.engagement?.sourceClass || null,
    status: queueItem.status,
    priority: queueItem.priority,
    urgency: queueItem.urgency,
    expiresAt: queueItem.expiresAt,
    contribution: {
      summary: queueItem.contributionSummary || '',
      archetype: queueItem.replyArchetype || '',
    },
    recipientOptIn: queueItem.engagement?.recipientOptIn === true,
  };
}

function engagementRefreshOptions(payload) {
  return {
    targetLimit: Math.max(1, Math.min(50, Number(payload.targetLimit || 12))),
    postsPerTarget: Math.max(1, Math.min(10, Number(payload.postsPerTarget || 4))),
    minTargetScore: Number(payload.minTargetScore ?? 35),
    targetSinceHours: Math.max(1, Number(payload.targetSinceHours || 24)),
    responseSinceHours: Math.max(1, Number(payload.responseSinceHours || 72)),
  };
}

function engagementRead(payload, { refresh = null, compact = false } = {}) {
  const items = listEngagementItems({
    status: payload.status || undefined,
    minPriority: Number(payload.minPriority || 0),
    includeExpired: Boolean(payload.includeExpired),
    limit: Math.max(1, Math.min(200, Number(payload.limit || 50))),
  });
  const packets = items.map(compact ? compactEngagementPacket : engagementPacket);
  const kindOf = (item) => compact ? item.engagementKind : item.queueItem.engagementKind;
  const accountHealth = getAccountHealthSummary();
  return {
    refresh: refresh ? {
      refreshed: refresh.refreshed,
      rejected: refresh.rejected,
      expired: refresh.expired,
      errors: refresh.errors,
    } : null,
    accountHealth: compact
      ? { generatedAt: accountHealth.generatedAt, health: accountHealth.health }
      : accountHealth,
    activeConversations: packets.filter((item) => kindOf(item) !== 'initial_reply'),
    newOpportunities: packets.filter((item) => kindOf(item) === 'initial_reply'),
  };
}

function schedulerContext(now) {
  const recentPosts = listRecentMainFeedPublications({ limit: 20 });
  return {
    now,
    recentPosts,
    lastMainFeedPostAt: recentPosts[0]?.publishedAt ?? null,
    learnedRules: listAcceptedLearnedRules({ limit: 500 }),
  };
}

function growthOperatorPacket(candidate, sourceKinds = []) {
  const opportunity = inspectGrowthOpportunity(candidate.key);
  const disposition = getCandidateDisposition(candidate.key);
  const sourceKind = sourceKinds.includes('x_momentum') ? 'x_momentum' : sourceKinds[0] || null;
  const observedMomentum = sourceKind ? getSourceMomentum(candidate.key, sourceKind) : null;
  const style = extractViralStyleFeatures({ text: candidate.text || '' });
  const scores = opportunity.scores;
  const recommendation = opportunity.recommendation;
  const route = recommendation.pipeline;
  const borrowedDistribution = ['reply', 'quote', 'repost'].includes(route);
  const ageHours = candidate.timestamp ? Math.max(0, (Date.now() - Number(candidate.timestamp)) / 3_600_000) : null;
  const viewsPerHour = candidate.viral?.viewsPerHour == null ? null : Math.round(Number(candidate.viral.viewsPerHour));
  const observedViewsPerHour = observedMomentum?.deltas?.views?.perHour == null ? null : Math.round(Number(observedMomentum.deltas.views.perHour));
  const sourceViews = observedMetric(candidate.metrics, 'views') ?? null;
  const sourceReplies = observedMetric(candidate.metrics, 'replies') ?? null;
  const repliesPerThousandViews = sourceViews != null && sourceViews > 0 && sourceReplies != null
    ? Math.round((sourceReplies / sourceViews) * 1_000 * 10) / 10
    : null;
  const discoveryQuality = assessDiscoveryQuality(candidate.text || '');
  const urgency = recommendation.action === 'ignore'
    ? 'blocked'
    : candidate.viral?.tier === 'breakout' || (viewsPerHour != null && viewsPerHour >= 1_000) || (ageHours != null && ageHours <= 3)
      ? 'now'
      : ageHours != null && ageHours <= 12
        ? 'soon'
        : 'normal';
  const operatorPriority = Math.round(
    scores.reachPotential * 0.45
      + scores.conversationPotential * 0.25
      + scores.followPotential * 0.20
      + scores.relationshipPotential * 0.10
      + (borrowedDistribution ? 8 : 0)
      + (urgency === 'now' ? 8 : urgency === 'soon' ? 3 : 0)
      - (recommendation.action === 'ignore' ? 60 : 0)
  );
  return {
    key: candidate.key,
    url: candidate.url,
    author: candidate.title,
    text: candidate.text,
    sourceKinds,
    sourceTimestamp: candidate.timestamp || null,
    metrics: candidate.metrics || {},
    recommendation,
    operatorPriority,
    priorityBasis: 'Empirical operator heuristic: Reach 45%, Conversation 25%, Follow 20%, Relationship 10%, plus borrowed-distribution and freshness bonuses. Not an X ranking-law claim.',
    urgency,
    distribution: {
      borrowed: borrowedDistribution,
      leverage: borrowedDistribution ? 'borrowed_distribution' : 'owned_distribution',
      reason: borrowedDistribution
        ? `${route} can enter an existing source/conversation graph while it is active.`
        : 'Original content builds owned profile proof but receives no source-conversation distribution by format alone.',
    },
    crowding: {
      replies: sourceReplies,
      views: sourceViews,
      repliesPerThousandViews,
      interpretation: 'Lower reply density can indicate a less crowded conversation surface, but this is observational and is not currently used in operatorPriority.',
    },
    momentum: {
      tier: candidate.viral?.tier || null,
      ageHours: ageHours == null ? null : Math.round(ageHours * 10) / 10,
      viewsPerHour,
      engagementsPerHour: candidate.viral?.engagementsPerHour == null ? null : Math.round(Number(candidate.viral.engagementsPerHour) * 10) / 10,
      observedViewsPerHour,
      observed: observedMomentum,
    },
    potentials: {
      reach: scores.reachPotential,
      follow: scores.followPotential,
      conversation: scores.conversationPotential,
      relationship: scores.relationshipPotential,
    },
    growthFit: opportunity.growthFit,
    discoveryQuality,
    sourceStyle: {
      hookLabels: style.hookLabels,
      styleLabels: style.styleLabels,
      wordCount: style.wordCount,
      sentenceCount: style.sentenceCount,
      paragraphCount: style.paragraphCount,
      firstLineChars: style.firstLineChars,
      numberCount: style.numberCount,
      hashtagCount: style.hashtagCount,
    },
    disposition,
    actionable: recommendation.action !== 'ignore' && disposition?.active !== true,
    verification: {
      exactSourceRequired: true,
      materialClaimsRequired: true,
      repostInheritsSourceClaims: route === 'repost',
      reason: route === 'repost'
        ? 'A Repost republishes the source claims without corrective context; verify every material claim before amplification.'
        : 'Verify material claims and current thread context before public action.',
    },
    execution: {
      route,
      automaticMainFeedAfterApproval: ['original', 'quote', 'thread'].includes(route),
      autonomousReplyCandidate: route === 'reply',
      manualFinalActionRequired: route === 'repost',
    },
    styleTransfer: {
      principle: 'Transfer structure and information density, never wording.',
      directives: [
        route === 'reply' ? 'Prefer one compact paragraph with one concrete contribution.' : 'Prefer 2-4 short visual blocks when the idea benefits from vertical scanability.',
        'Open with a concrete product, result, constraint, or verified number; remove generic setup.',
        'Put the payoff in the first 1-2 blocks and use short sentences around concrete nouns.',
        'Use a verified number near the top when it changes the reader decision; never invent one for punch.',
        'Default to zero hashtags; use 1-2 only when they are canonical and tied to an active topic/search surface.',
      ],
    },
  };
}

function growthRead(payload = {}) {
  const snapshots = ['x_latest', 'x_momentum'].map((kind) => getDiscoverSnapshot(kind));
  const merged = new Map();
  for (const snapshot of snapshots) {
    for (const candidate of snapshot.candidates) {
      if (candidate.source !== 'x' || sourceUsername(candidate) === 'ham_zax') continue;
      const current = merged.get(candidate.key) || { candidate, sourceKinds: [] };
      if (snapshot.kind === 'x_momentum') current.candidate = candidate;
      if (!current.sourceKinds.includes(snapshot.kind)) current.sourceKinds.push(snapshot.kind);
      merged.set(candidate.key, current);
    }
  }
  const includeIgnored = payload.includeIgnored === true;
  const includeDisposed = payload.includeDisposed === true;
  const includeLowSignal = payload.includeLowSignal === true;
  const items = [...merged.values()]
    .map(({ candidate, sourceKinds }) => growthOperatorPacket(candidate, sourceKinds))
    .filter((item) => !item.growthFit || item.growthFit.allowed || includeIgnored)
    .filter((item) => includeLowSignal || item.discoveryQuality.allowed)
    .filter((item) => includeIgnored || item.recommendation.action !== 'ignore')
    .filter((item) => includeDisposed || item.disposition?.active !== true)
    .sort((left, right) => right.operatorPriority - left.operatorPriority)
    .slice(0, Math.max(1, Math.min(50, Number(payload.limit || 12))));
  return {
    snapshots: snapshots.map((snapshot) => ({
      kind: snapshot.kind,
      fetchedAt: snapshot.fetchedAt,
      lastRefreshAttemptAt: snapshot.lastRefreshAttemptAt,
      candidateCount: snapshot.candidates.length,
      error: snapshot.error,
      legacyFallback: snapshot.legacyFallback,
    })),
    items,
  };
}

function compactGrowthItem(item) {
  if (!item) return null;
  const discoveryQuality = item.discoveryQuality.allowed
    ? { allowed: true }
    : item.discoveryQuality;
  return {
    key: item.key,
    url: item.url,
    author: item.author,
    text: item.text,
    recommendation: item.recommendation,
    operatorPriority: item.operatorPriority,
    urgency: item.urgency,
    momentum: {
      tier: item.momentum.tier,
      ageHours: item.momentum.ageHours,
      viewsPerHour: item.momentum.viewsPerHour,
      engagementsPerHour: item.momentum.engagementsPerHour,
      observedViewsPerHour: item.momentum.observedViewsPerHour,
    },
    potentials: item.potentials,
    discoveryQuality,
    verification: item.verification,
    execution: item.execution,
  };
}

function compactScheduleDecision(decision) {
  if (!decision) return null;
  return {
    queueItemId: decision.item.id,
    candidateKey: decision.item.candidateKey,
    pipeline: decision.item.pipeline,
    status: decision.item.status,
    eligible: decision.eligible,
    priority: decision.priority,
    recommendedAt: decision.recommendedAt,
    reason: decision.reason,
    blockers: decision.blockers,
    warnings: decision.warnings,
  };
}

const AUTOMATION_RUNTIME_STATE_KEY = 'automation_runtime';

function automationRuntimeStatus(now) {
  const configuredPollMinutes = Number(process.env.POLL_MINUTES || 30);
  const pollMinutes = Number.isFinite(configuredPollMinutes) && configuredPollMinutes > 0 ? configuredPollMinutes : 30;
  const staleAfterMinutes = pollMinutes * 2;
  const staleAfterMs = staleAfterMinutes * 60_000;
  let heartbeat = null;
  try {
    const raw = getAppState(AUTOMATION_RUNTIME_STATE_KEY, null);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) heartbeat = parsed;
  } catch {
    heartbeat = null;
  }

  if (!heartbeat) {
    return {
      heartbeatRecorded: false,
      status: 'not_recorded',
      stale: null,
      inProgress: false,
      cycleStartedAt: null,
      cycleFinishedAt: null,
      lastHealthyCompletionAt: null,
      latestError: null,
      staleAfterMinutes,
    };
  }

  const cycleStartedAt = Number(heartbeat.cycleStartedAt) || null;
  const cycleFinishedAt = Number(heartbeat.cycleFinishedAt) || null;
  const lastHealthyCompletionAt = Number(heartbeat.lastHealthyCompletionAt) || null;
  const inProgress = heartbeat.inProgress === true;
  const stale = lastHealthyCompletionAt == null || now - lastHealthyCompletionAt > staleAfterMs;
  let status = 'healthy';
  if (inProgress) status = 'in_progress';
  else if (heartbeat.latestError) status = 'error';
  else if (stale) status = 'stale';

  return {
    heartbeatRecorded: true,
    status,
    stale,
    inProgress,
    cycleStartedAt,
    cycleFinishedAt,
    lastHealthyCompletionAt,
    latestError: heartbeat.latestError || null,
    staleAfterMinutes,
  };
}

function operatorStatus(payload = {}) {
  const now = payload.now == null ? Date.now() : Number(payload.now);
  if (!Number.isFinite(now)) throw new Error('operator-status now must be numeric when supplied.');
  const growth = growthRead({ limit: Math.max(1, Math.min(10, Number(payload.growthLimit || 3))) });
  const engagementItems = listEngagementItems({ includeExpired: false, limit: Math.max(1, Math.min(20, Number(payload.engagementLimit || 6))) });
  const activeConversations = engagementItems.filter((item) => item.engagementKind !== 'initial_reply').map(compactEngagementPacket);
  const newReplies = engagementItems.filter((item) => item.engagementKind === 'initial_reply').map(compactEngagementPacket);
  const approved = listApprovedMainFeedItems({ automatedOnly: true, limit: 100 });
  const scheduleDecisions = rankMainFeedItems(approved, schedulerContext(now));
  const dueMeasurements = listDueMeasurementWindows(now);
  const replyGrant = getAutonomousReplyGrant();
  const replyRuntime = getAutonomousReplyRuntime();
  const remainingReplyBudget = replyGrant.liveBudget == null
    ? null
    : Math.max(0, Number(replyGrant.liveBudget) - Number(replyGrant.budgetUsed || 0));
  const credentialedMainFeed = Boolean(process.env.AUTH_TOKEN && process.env.CT0);
  const autoPostEnabled = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';
  const accountHealth = getAccountHealthSummary({ now });
  const integrityWarnings = scheduleDecisions
    .filter((decision) => decision.item.status === 'approved' && decision.blockers.some((blocker) => blocker.code === 'HARD_GATES_NOT_PASSED'))
    .map((decision) => ({
      code: 'APPROVED_ITEM_GATES_FAILED',
      queueItemId: decision.item.id,
      candidateKey: decision.item.candidateKey,
      message: 'Approved queue state exists, but current draft/media hard gates do not pass. Inspect approval integrity before publication.',
    }));
  return {
    generatedAt: now,
    account: getPerformanceSnapshot(1)?.account || null,
    accountHealth: { state: accountHealth.health.state, reasons: accountHealth.health.reasons, generatedAt: accountHealth.generatedAt },
    laneChampions: {
      activeConversationKey: activeConversations[0]?.candidateKey || null,
      newReplyKey: newReplies[0]?.candidateKey || null,
      discoveryKey: growth.items[0]?.key || null,
      approvedMainFeedQueueItemId: (scheduleDecisions.find((decision) => decision.eligible) || scheduleDecisions[0])?.item.id || null,
    },
    scoreBoundary: 'Priorities are comparable only within their lane; arbitrate lane champions by relevance, contribution, urgency, relationship continuity, claim confidence, and execution readiness.',
    discovery: { snapshots: growth.snapshots, top: growth.items.map(compactGrowthItem) },
    engagement: { activeConversations, newReplies, cachedRead: true },
    runtime: {
      automation: automationRuntimeStatus(now),
      operatorLease: getOperatorLeaseStatus({ now }),
    },
    first1000Mission: getAutonomousMainFeedMissionStatus({ now }),
    execution: {
      mainFeed: {
        autoPostEnabled,
        credentialsPresent: credentialedMainFeed,
        configured: autoPostEnabled && credentialedMainFeed,
        preflight: 'Run npm run http:check; this read model does not persist or infer preflight success.',
        next: compactScheduleDecision(scheduleDecisions.find((decision) => decision.eligible)),
        blocked: scheduleDecisions.filter((decision) => !decision.eligible).slice(0, 5).map(compactScheduleDecision),
      },
      autonomousReply: {
        state: replyGrant.state,
        mode: replyGrant.mode,
        remainingBudget: remainingReplyBudget,
        currentWriteTransport: AUTONOMOUS_REPLY_WRITE_TRANSPORT,
        liveTransportReady: AUTONOMOUS_REPLY_LIVE_TRANSPORT_READY,
        nextExpectedRefreshAt: replyRuntime.nextExpectedRefreshAt || null,
        lastError: replyRuntime.lastError || null,
      },
      browserAndContentExtension: 'Not observed by Growth OS; verify browser-fast memory/humanize state and the enabled x-content extension in their owning runtime.',
    },
    measurements: {
      dueCount: dueMeasurements.length,
      due: dueMeasurements.slice(0, 10).map((item) => ({
        queueItemId: item.queueItemId,
        tweetId: item.tweetId,
        windowMinutes: item.windowMinutes,
        dueAt: item.dueAt,
      })),
    },
    memoryCheckpoint: getGrowthOperatorMemoryCheckpoint(),
    integrityWarnings,
    readOnly: true,
  };
}

function aiProfileCapability(profile) {
  if (!profile) return 'unsupported';
  if (profile.runtime === 'codex' || profile.runtime === 'opencode' || profile.runtime === 'agy') return 'supported';
  if (profile.runtime !== 'direct_api') return 'unsupported';
  const configured = profile.settings?.structuredOutput;
  if (['supported', 'compatible_fallback', 'unknown', 'unsupported'].includes(configured)) return configured;
  return profile.providerKind === 'openai' ? 'supported' : 'compatible_fallback';
}

function safeAiProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    name: profile.name,
    runtime: profile.runtime,
    providerKind: profile.providerKind,
    baseUrl: profile.baseUrl,
    protocol: profile.protocol,
    model: profile.model,
    reasoning: profile.reasoning,
    runtimeProfile: profile.runtimeProfile,
    settings: profile.settings || {},
    enabled: profile.enabled !== false,
    compatibility: profile.compatibility === true,
    capability: aiProfileCapability(profile),
  };
}

function safeAiRole(role) {
  const resolved = resolveAiProfileForRole(role);
  return {
    role,
    activity: role === 'continuous_scan' ? 'not_active' : (resolved.profile ? 'configured' : 'unconfigured'),
    primaryProfileId: resolved.binding?.primaryProfileId ?? null,
    fallbackProfileId: resolved.binding?.fallbackProfileId ?? null,
    resolvedProfile: safeAiProfile(resolved.profile),
    fallbackProfile: safeAiProfile(resolved.fallbackProfile),
    resolutionSource: resolved.source,
  };
}

function safeAiConfig() {
  const settings = getAiRuntimeSettings();
  return {
    profiles: listAiProfiles({ limit: 500 }).map(safeAiProfile),
    defaultProfileId: settings.defaultProfileId,
    defaultProfile: safeAiProfile(settings.defaultProfile),
    roles: AI_ROLES.map(safeAiRole),
  };
}

function requireAssignableAiProfile(id, { confirmUnknownCapability = false } = {}) {
  const profile = getAiProfile(Number(id));
  if (!profile) throw new Error(`AI profile not found: ${id}`);
  if (!profile.enabled) throw new Error(`AI profile is disabled: ${profile.id}`);
  const capability = aiProfileCapability(profile);
  if (capability === 'unsupported') throw new Error(`${profile.name} does not support the structured-output path required by AI roles.`);
  if (capability === 'unknown' && confirmUnknownCapability !== true) {
    throw new Error(`${profile.name} has unknown structured-output capability. Confirm the advanced assignment explicitly.`);
  }
  return profile;
}

function bridgeEditorialObjective(value = null) {
  const objective = String(value || getNicheProfile().profile.defaultObjective || 'qualified_growth');
  if (!EDITORIAL_OBJECTIVES.includes(objective)) throw new Error(`Unsupported editorial objective: ${objective}.`);
  return objective;
}

function bridgeEditorialRecommendation(recommendation) {
  if (!recommendation) return null;
  const storyEvidence = listResearchEvidence({ editorialRunId: recommendation.editorialRunId, storyKey: recommendation.storyKey });
  const referenced = new Set((recommendation.evidenceIds || []).map((id) => String(id)));
  const evidence = recommendation.decision === 'RESEARCH_MORE'
    ? storyEvidence
    : storyEvidence.filter((item) => referenced.has(String(item.id)));
  const selection = getEditorialSelectionByRecommendation(recommendation.id);
  const queueItem = selection ? getQueueItem(selection.queueItemId) : null;
  return {
    ...recommendation,
    evidence,
    selection: selection ? {
      ...selection,
      candidateKey: queueItem?.candidateKey || null,
      draftId: queueItem?.draftId ?? null,
      queueStatus: queueItem?.status || null,
    } : null,
  };
}

function bridgeEditorialPlan(objective = null) {
  const selectedObjective = bridgeEditorialObjective(objective);
  const plan = getLatestEditorialPlan(selectedObjective);
  return {
    objective: selectedObjective,
    hasPlan: Boolean(plan),
    run: plan?.run || null,
    sourceFreshness: SOURCE_SNAPSHOT_KINDS.map((kind) => {
      const snapshot = getDiscoverSnapshot(kind);
      return {
        kind,
        fetchedAt: snapshot.fetchedAt,
        lastRefreshAttemptAt: snapshot.lastRefreshAttemptAt,
        error: snapshot.error,
        legacyFallback: snapshot.legacyFallback,
        candidateCount: snapshot.candidates.length,
      };
    }),
    recommendations: (plan?.recommendations || []).map(bridgeEditorialRecommendation),
    noStrongAction: Boolean(plan && plan.recommendations.length === 0),
    noStrongActionReason: plan?.run?.context?.noStrongCurrentActionReason || '',
  };
}

async function main() {
  const command = process.argv[2];
  const payload = await readInput();

  if (command === 'editorial-plan') {
    result(bridgeEditorialPlan(payload.objective));
    return;
  }

  if (command === 'editorial-refresh') {
    const objective = bridgeEditorialObjective(payload.objective);
    await refreshEditorialPlan({ objective, refreshSources: payload.refreshSources === true });
    result(bridgeEditorialPlan(objective));
    return;
  }

  if (command === 'editorial-recommendation') {
    const recommendation = getEditorialRecommendation(Number(payload.recommendationId));
    if (!recommendation) throw new Error(`Editorial recommendation not found: ${payload.recommendationId}`);
    result({ recommendation: bridgeEditorialRecommendation(recommendation) });
    return;
  }

  if (command === 'editorial-select') {
    const selected = selectEditorialRecommendation(Number(payload.recommendationId), {
      pipelineOverride: payload.pipelineOverride == null || payload.pipelineOverride === '' ? null : String(payload.pipelineOverride),
    });
    result({
      recommendation: bridgeEditorialRecommendation(selected.recommendation),
      selection: selected.selection,
      queueItem: selected.queueItem,
      candidateKey: selected.queueItem.candidateKey,
      draftId: selected.queueItem.draftId ?? null,
      research: selected.research || null,
      idempotent: selected.idempotent === true,
    });
    return;
  }

  if (command === 'editorial-dismiss') {
    const recommendation = dismissEditorialRecommendation(Number(payload.recommendationId));
    result({ recommendation: bridgeEditorialRecommendation(recommendation) });
    return;
  }

  if (command === 'editorial-add-source') {
    const evidence = await attachEditorialResearchSource(Number(payload.recommendationId), {
      url: payload.url,
      claim: payload.claim,
      claimType: payload.claimType || 'other',
    });
    const recommendation = getEditorialRecommendation(Number(payload.recommendationId));
    result({ evidence, recommendation: bridgeEditorialRecommendation(recommendation) });
    return;
  }

  if (command === 'editorial-outcomes') {
    result({
      outcomes: getEditorialOutcomeSummary({
        windowMinutes: Number(payload.windowMinutes || 1440),
        limit: Math.max(1, Math.min(200, Number(payload.limit || 200))),
      }),
    });
    return;
  }

  if (command === 'writing-strategy') {
    const queueItemId = Number(payload.queueItemId);
    if (!Number.isInteger(queueItemId) || queueItemId < 1) throw new Error('writing-strategy requires queueItemId.');
    result(await getWritingStrategyPreview(queueItemId));
    return;
  }

  if (command === 'writing-strategy-recommend') {
    if (payload.confirmRecommend !== true) throw new Error('writing-strategy-recommend requires confirmRecommend=true because it may spend AI tokens.');
    const queueItemId = Number(payload.queueItemId);
    if (!Number.isInteger(queueItemId) || queueItemId < 1) throw new Error('writing-strategy-recommend requires queueItemId.');
    result(await recommendWritingStrategy(queueItemId, { profile: payload.profileId ?? null }));
    return;
  }

  if (command === 'writing-strategy-select') {
    if (payload.confirmSelect !== true) throw new Error('writing-strategy-select requires confirmSelect=true for the explicit human strategy selection.');
    result({ selection: await selectWritingStrategy(payload) });
    return;
  }

  if (command === 'learn-classify-published') {
    if (payload.confirmClassify !== true) throw new Error('learn-classify-published requires confirmClassify=true because it may spend AI tokens.');
    result(await classifyPublishedContent({
      queueItemIds: payload.queueItemIds || [],
      limit: payload.limit,
      profile: payload.profileId ?? null,
    }));
    return;
  }

  if (command === 'ai-config') {
    result(safeAiConfig());
    return;
  }

  if (command === 'ai-runtimes') {
    result({ runtimes: await listAiRuntimeAvailability() });
    return;
  }

  if (command === 'ai-select-default') {
    if (payload.clear === true || payload.profileId == null || payload.profileId === '') {
      clearAiDefaultProfile();
      result(safeAiConfig());
      return;
    }
    const profile = requireAssignableAiProfile(payload.profileId, { confirmUnknownCapability: payload.confirmUnknownCapability === true });
    setAiDefaultProfile(profile.id);
    result(safeAiConfig());
    return;
  }

  if (command === 'ai-bind-role') {
    const role = String(payload.role || '');
    if (!AI_ROLES.includes(role)) throw new Error(`Invalid AI role: ${role || 'missing'}`);
    if (payload.clear === true) {
      clearAiRoleBinding(role);
      result({ role: safeAiRole(role) });
      return;
    }
    const confirmUnknownCapability = payload.confirmUnknownCapability === true;
    const primaryProfileId = payload.primaryProfileId == null || payload.primaryProfileId === '' ? null : Number(payload.primaryProfileId);
    const fallbackProfileId = payload.fallbackProfileId == null || payload.fallbackProfileId === '' ? null : Number(payload.fallbackProfileId);
    if (primaryProfileId != null) requireAssignableAiProfile(primaryProfileId, { confirmUnknownCapability });
    if (fallbackProfileId != null) requireAssignableAiProfile(fallbackProfileId, { confirmUnknownCapability });
    setAiRoleBinding(role, { primaryProfileId, fallbackProfileId });
    result({ role: safeAiRole(role) });
    return;
  }

  if (command === 'rescore-candidates') {
    result({ classification: rescoreCandidateRelevance() });
    return;
  }

  if (command === 'ingest') {
    const candidate = manualCandidate(payload);
    const key = candidateKey(candidate);
    upsertCandidates([candidate], { saved: false });
    let workflow = payload.saved === true ? saveCandidateToWorkflow(key, true) : inspectWorkflow(key);
    if (payload.createDraft) {
      if (!workflow.queueItem) workflow = ensureCandidateWorkflow(key);
      const currentPipeline = workflow.queueItem?.pipeline;
      const pipeline = ['original', 'quote', 'thread', 'reply'].includes(currentPipeline) ? currentPipeline : 'original';
      routeCandidate(key, pipeline, { actor: 'agent' });
      workflow = inspectWorkflow(key);
    }
    result({ candidate: workflow.candidate, draft: workflow.draft, queueItem: workflow.queueItem, scores: workflow.scores, recommendation: workflow.recommendation });
    return;
  }

  if (command === 'inspect') {
    const workflow = inspectWorkflow(payload.key);
    result({
      candidate: workflow.candidate,
      growthFit: workflow.growthFit,
      draft: workflow.draft,
      disposition: getCandidateDisposition(payload.key),
      actions: listCandidateActions(payload.key),
    });
    return;
  }

  if (command === 'create-draft') {
    const candidate = requireCandidate(payload.key);
    let workflow = ensureCandidateWorkflow(candidate.key);
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
    const generation = getWritingStrategyGenerationContext(workflow.queueItem.id);
    const packet = buildWriterPacket({
      candidate: workflow.candidate,
      queueItem: workflow.queueItem,
      draft: workflow.draft,
      relationship: username ? getRelationshipProfile(username) : null,
      recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: workflow.candidate.key }),
      recentReplies: listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: workflow.candidate.key }),
      writingStrategy: generation.writingStrategy,
    });
    result({ packet, generation });
    return;
  }

  if (command === 'apply-writer-output') {
    const current = requireDraft(payload.id);
    const candidate = requireCandidate(current.candidateKey);
    const workflow = inspectWorkflow(candidate.key);
    if (current.status === 'published' || current.publishedTweetId || workflow.queueItem?.status === 'published' || workflow.queueItem?.publishedAt || workflow.queueItem?.outputTweetId) {
      throw new Error('Published text is historical record and cannot be edited.');
    }
    const pipeline = workflow.queueItem?.pipeline;
    if (!['original', 'quote', 'thread', 'reply'].includes(pipeline)) {
      throw new Error(`apply-writer-output requires a routed text pipeline; current pipeline is ${pipeline || 'none'}.`);
    }
    if (payload.output?.pipeline !== pipeline) {
      throw new Error(`Writer pipeline mismatch: ${payload.output?.pipeline || 'missing'} !== ${pipeline}. Route the queue item first.`);
    }
    const writerBase = current.editor?.pipeline && current.editor.pipeline !== pipeline
      ? { ...current, editor: Array.isArray(current.editor?.generationHistory) ? { generationHistory: [...current.editor.generationHistory] } : {} }
      : current;
    const strategyGeneration = validateWritingStrategyGenerationContext(workflow.queueItem.id, payload.generation);
    const generationProvenance = buildWritingStrategyGenerationProvenance(strategyGeneration, {
      writerAiExecution: payload.writerAiExecution || null,
      writerExecutionSource: 'agent_bridge_external',
    });
    const next = applyWriterOutput(writerBase, payload.output || {}, { generationProvenance });
    const analysis = scoreDraft(next, candidate, {
      pipeline,
      recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidate.key }),
      recentReplies: pipeline === 'reply'
        ? listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidate.key })
        : [],
      factualityConfirmed: false,
      evidenceConfirmed: false,
      mediaReady: false,
      relevanceOverride: workflow.queueItem?.relevance?.humanOverride || null,
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
    if (current.status === 'published' || current.publishedTweetId || workflow.queueItem?.status === 'published' || workflow.queueItem?.publishedAt || workflow.queueItem?.outputTweetId) {
      throw new Error('Published text is historical record and cannot be edited.');
    }
    if (!workflow.queueItem) workflow = ensureCandidateWorkflow(candidate.key);
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
      drafts: listDrafts({ status: payload.draftStatus, limit: Number(payload.limit || 20) }),
      queueItems: listQueueItems({ status: payload.status, pipeline: payload.pipeline, lane: payload.lane, limit: Number(payload.limit || 20) }),
    });
    return;
  }

  if (command === 'schedule-next') {
    const now = payload.now == null ? Date.now() : Number(payload.now);
    if (!Number.isFinite(now)) throw new Error('schedule-next now must be numeric when supplied.');
    const items = listApprovedMainFeedItems({ automatedOnly: true, limit: Math.max(1, Math.min(200, Number(payload.limit || 100))) });
    const context = schedulerContext(now);
    const decisions = rankMainFeedItems(items, context);
    result({
      now,
      next: decisions.find((decision) => decision.eligible) || null,
      decisions,
      publicationAuthority: 'approved main-feed queue + scheduler',
    });
    return;
  }

  if (command === 'schedule-inspect') {
    const key = String(payload.key || '');
    if (!key) throw new Error('schedule-inspect requires key.');
    const item = getMainFeedScheduleItem(key);
    if (!item) throw new Error(`Main-feed schedule item not found: ${key}`);
    const now = payload.now == null ? Date.now() : Number(payload.now);
    if (!Number.isFinite(now)) throw new Error('schedule-inspect now must be numeric when supplied.');
    result({
      now,
      item,
      decision: recommendMainFeedSchedule(item, schedulerContext(now)),
      readOnly: true,
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

  if (command === 'analytics') {
    result(getAccountAnalyticsSnapshot({
      limit: Number(payload.limit || 30),
      audienceLimit: Number(payload.audienceLimit || 24),
    }));
    return;
  }

  if (command === 'analytics-record') {
    if (payload.confirmRecord !== true) throw new Error('analytics-record requires confirmRecord=true for the explicit local measurement write.');
    const capturedAt = payload.capturedAt == null ? Date.now() : Number(payload.capturedAt);
    if (!Number.isFinite(capturedAt) || capturedAt <= 0) throw new Error('analytics-record capturedAt must be a positive timestamp.');
    const kind = String(payload.kind || 'content').trim().toLowerCase();
    if (kind === 'content') {
      const contentType = String(payload.contentType || payload.type || 'all').trim().toLowerCase();
      if (!ACCOUNT_ANALYTICS_CONTENT_TYPES.has(contentType)) throw new Error(`Invalid analytics contentType: ${contentType || 'missing'}.`);
      if (!Array.isArray(payload.posts) || payload.posts.length === 0) throw new Error('analytics-record content requires a non-empty posts array.');
      const posts = payload.posts.map(normalizeAccountAnalyticsPost);
      recordPerformanceSnapshot({ posts, capturedAt, metricSource: 'account_analytics' });
      result({
        recorded: { kind, contentType, capturedAt, count: posts.length },
        analytics: getAccountAnalyticsSnapshot({ limit: Number(payload.limit || Math.max(30, posts.length)), audienceLimit: Number(payload.audienceLimit || 24) }),
      });
      return;
    }
    if (kind === 'audience') {
      const metric = normalizeAudienceAnalyticsMetric(payload.metric);
      if (!ACCOUNT_ANALYTICS_AUDIENCE_METRICS.has(metric)) throw new Error(`Invalid audience analytics metric: ${metric || 'missing'}.`);
      const windowDays = Number(payload.windowDays || 7);
      const data = payload.data ?? payload.insights ?? {};
      const snapshot = recordAudienceAnalyticsSnapshot({ metric, windowDays, data, capturedAt });
      result({
        recorded: { kind, ...snapshot },
        analytics: getAccountAnalyticsSnapshot({ limit: Number(payload.limit || 30), audienceLimit: Number(payload.audienceLimit || 24) }),
      });
      return;
    }
    throw new Error(`Invalid analytics-record kind: ${kind || 'missing'}.`);
  }

  if (command === 'operator-status') {
    result(operatorStatus(payload));
    return;
  }

  if (command === 'operator-lease-acquire') {
    result(acquireOperatorLease());
    return;
  }

  if (command === 'operator-lease-renew') {
    result(renewOperatorLease(payload.leaseId));
    return;
  }

  if (command === 'operator-lease-release') {
    result(releaseOperatorLease(payload.leaseId));
    return;
  }

  if (command === 'operator-memory-review') {
    if (payload.confirmReview !== true) throw new Error('operator-memory-review requires confirmReview=true after the memory review is actually complete.');
    result(recordGrowthOperatorMemoryReview({
      result: payload.result,
      note: payload.note || '',
      reviewedAt: payload.reviewedAt == null ? Date.now() : Number(payload.reviewedAt),
    }));
    return;
  }

  if (command === 'growth-refresh') {
    const kinds = payload.kind
      ? [String(payload.kind)]
      : ['x_latest', 'x_momentum'];
    const refreshes = await Promise.all(kinds.map((kind) => refreshSourceSnapshot(kind)));
    result({
      refreshed: refreshes.map((refresh) => ({
        kind: refresh.kind,
        fetchedAt: refresh.fetchedAt,
        attemptedAt: refresh.attemptedAt,
        candidateCount: refresh.candidates.length,
        preservedLastGood: refresh.preservedLastGood === true,
        error: refresh.error || null,
      })),
      nextStep: 'Run growth-next immediately from the current last-known-good snapshots; do not wait for another refresh before acting.',
    });
    return;
  }

  if (command === 'growth-next') {
    const refreshes = payload.refresh === true
      ? await Promise.all(['x_latest', 'x_momentum'].map((kind) => refreshSourceSnapshot(kind)))
      : [];
    const growth = growthRead(payload);
    result({
      account: getPerformanceSnapshot(1)?.account || null,
      refreshed: refreshes.map((refresh) => ({
        kind: refresh.kind,
        fetchedAt: refresh.fetchedAt,
        attemptedAt: refresh.attemptedAt,
        candidateCount: refresh.candidates.length,
        preservedLastGood: refresh.preservedLastGood === true,
        error: refresh.error || null,
      })),
      snapshots: growth.snapshots,
      items: growth.items,
      readOnlyPlanning: true,
      nextStep: 'Open the exact source on X, inspect thread context, then act once and verify the live result before record-action; use record-disposition for an exact skip/defer.',
    });
    return;
  }

  if (command === 'measurements') {
    if (payload.queueItemId != null) {
      result({ queueItemId: Number(payload.queueItemId), measurements: getPublicationMeasurements(Number(payload.queueItemId)) });
      return;
    }
    const since = Number(payload.since || 0);
    const until = payload.until == null ? Date.now() : Number(payload.until);
    result({
      series: listPublicationMeasurementSeries({ limit: Number(payload.limit || 30) }),
      newFollowerQuality: getNewFollowerQuality({ since, until, minScore: Number(payload.minScore ?? 12) }),
    });
    return;
  }

  if (command === 'experiments') {
    if (payload.id != null) {
      const experiment = getExperiment(Number(payload.id));
      if (!experiment) throw new Error(`Experiment not found: ${payload.id}`);
      result({ experiment, assignments: listExperimentAssignments(experiment.id), readOnly: true });
      return;
    }
    result({ experiments: listExperiments({ status: payload.status || null, limit: Number(payload.limit || 100) }), readOnly: true });
    return;
  }

  if (command === 'experiment-create') {
    if (payload.confirmCreate !== true) throw new Error('experiment-create requires confirmCreate=true for the explicit write action.');
    const definition = payload.experiment || payload.definition;
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error('experiment-create requires an experiment definition object.');
    result({ experiment: createExperiment(definition), assignmentPolicy: 'caller_selected', randomized: false });
    return;
  }

  if (command === 'experiment-assign') {
    if (payload.confirmAssign !== true) throw new Error('experiment-assign requires confirmAssign=true for the explicit write action.');
    if (!payload.key) throw new Error('experiment-assign requires key.');
    const context = payload.context == null ? {} : payload.context;
    if (!context || typeof context !== 'object' || Array.isArray(context)) throw new Error('experiment-assign context must be an object.');
    result({
      queueItem: assignExperimentVariant(payload.key, Number(payload.experimentId), payload.variant, {
        context,
        timingHistorySufficient: payload.timingHistorySufficient === true,
      }),
      assignmentPolicy: 'caller_selected',
      randomized: false,
    });
    return;
  }

  if (command === 'experiment-summary') {
    if (payload.id == null) throw new Error('experiment-summary requires id.');
    result(getExperimentSummary(Number(payload.id), { windowMinutes: payload.windowMinutes == null ? null : Number(payload.windowMinutes) }));
    return;
  }

  if (command === 'learning') {
    const algorithmEvidence = payload.algorithmEvidence == null ? null : payload.algorithmEvidence;
    if (algorithmEvidence != null && !Array.isArray(algorithmEvidence)) throw new Error('learning algorithmEvidence must be an array when supplied.');
    result({ ...getLearningOverview({ algorithmEvidence }), readOnly: true });
    return;
  }

  if (command === 'learning-refresh') {
    if (payload.experimentId == null) throw new Error('learning-refresh requires experimentId.');
    const match = payload.match == null ? undefined : payload.match;
    if (match != null && (!match || typeof match !== 'object' || Array.isArray(match))) throw new Error('learning-refresh match must be an object when supplied.');
    result(refreshLearnedRuleSuggestion({
      experimentId: Number(payload.experimentId),
      baselineLabel: payload.baselineLabel,
      comparisonLabel: payload.comparisonLabel,
      windowMinutes: payload.windowMinutes == null ? null : Number(payload.windowMinutes),
      key: payload.key,
      scope: payload.scope,
      adjustmentTarget: payload.adjustmentTarget,
      adjustmentComponent: payload.adjustmentComponent,
      match,
      mechanismTags: Array.isArray(payload.mechanismTags) ? payload.mechanismTags : [],
      outlierDominated: payload.outlierDominated === true,
      requiresBroadSupport: payload.requiresBroadSupport === true,
      support: payload.support,
      minimumSampleSize: payload.minimumSampleSize,
      higherIsBetter: payload.higherIsBetter,
      proposedAdjustment: payload.proposedAdjustment,
    }));
    return;
  }

  if (command === 'learning-accept') {
    if (payload.confirmAccept !== true) throw new Error('learning-accept requires confirmAccept=true for the explicit production-strategy change.');
    if (payload.id == null) throw new Error('learning-accept requires id.');
    result({ rule: acceptLearnedRule(Number(payload.id)), overview: getLearningOverview() });
    return;
  }

  if (command === 'learning-retire') {
    if (payload.confirmRetire !== true) throw new Error('learning-retire requires confirmRetire=true for the explicit production-strategy change.');
    if (payload.id == null) throw new Error('learning-retire requires id.');
    result({ rule: retireLearnedRule(Number(payload.id), { reason: payload.reason || '' }), overview: getLearningOverview() });
    return;
  }

  if (command === 'decide') {
    const candidate = requireCandidate(payload.key);
    const workflow = inspectWorkflow(candidate.key);
    const existingActions = listCandidateActions(candidate.key);
    const context = recommendationContext(candidate, workflow.scores, {
      ...(payload.context || {}),
      alreadyUsed: payload.context?.alreadyUsed ?? hasCandidateAction(candidate.key),
      strategicRelevance: payload.context?.strategicRelevance ?? workflow.growthFit,
      relevanceOverride: payload.context?.relevanceOverride ?? workflow.queueItem?.relevance?.humanOverride ?? null,
    });
    result({
      candidate,
      growthFit: workflow.growthFit,
      disposition: getCandidateDisposition(candidate.key),
      existingActions,
      recommendation: recommendDistributionAction(candidate, context),
    });
    return;
  }

  if (command === 'record-action') {
    const candidate = resolveOperatorCandidate(payload);
    const action = String(payload.action || '');
    if (!['direct', 'quote', 'repost', 'reply'].includes(action)) throw new Error(`Invalid action: ${action}`);
    const recorded = recordCandidateAction({
      candidateKey: candidate.key,
      action,
      outputTweetId: payload.outputTweetId || null,
      outputUrl: payload.outputUrl || null,
      commentary: payload.commentary || '',
      sourceContext: operatorSourceContext(payload),
      createdAt: payload.actedAt == null ? Date.now() : Number(payload.actedAt),
    });
    const reconciledQueue = reconcileRecordedActionWorkflow(candidate, action, recorded);
    result({
      candidateKey: candidate.key,
      recorded: listCandidateActions(candidate.key).find((item) => item.action === action) || recorded,
      reconciledQueue,
      disposition: getCandidateDisposition(candidate.key),
      actions: listCandidateActions(candidate.key),
    });
    return;
  }

  if (command === 'record-disposition') {
    const candidate = resolveOperatorCandidate(payload);
    const disposition = recordCandidateDisposition({
      candidateKey: candidate.key,
      state: payload.state || payload.disposition,
      reason: payload.reason || '',
      expiresAt: payload.expiresAt ?? null,
    });
    result({ candidateKey: candidate.key, disposition, actions: listCandidateActions(candidate.key) });
    return;
  }

  if (command === 'engage-next') {
    const refresh = payload.refresh === true
      ? await refreshEngagementOpportunities(engagementRefreshOptions(payload))
      : null;
    result(engagementRead(payload, { refresh, compact: payload.compact === true }));
    return;
  }

  if (command === 'engage-refresh') {
    const refresh = await refreshEngagementOpportunities(engagementRefreshOptions(payload));
    result({
      ...engagementRead(payload, { refresh, compact: payload.compact !== false }),
      nextStep: 'Select from the refreshed active-conversation and new-opportunity lane champions; do not refresh again before acting unless live evidence invalidates the result.',
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
    const writerGeneration = getWritingStrategyGenerationContext(queueItem.id);
    result({
      ...engagementPacket(queueItem),
      review: review ? { analysis: review.analysis, approvalRequired: true } : null,
      writerGeneration,
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
        writingStrategy: writerGeneration.writingStrategy,
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
      const accountHealth = getAccountHealthSummary();
      if (accountHealth.health.state === 'constrained') {
        const reason = accountHealth.health.reasons.find((item) => item.level === 'constrained');
        throw new Error(`Engagement send blocked by supported observed constraint: ${reason?.message || 'account health constrained'}`);
      }
      result(await sendApprovedEngagementReply(key));
      return;
    }
    throw new Error(`Invalid engage-resolve action: ${action || 'missing'}.`);
  }

  if (command === 'account-health') {
    const now = payload.now == null ? Date.now() : Number(payload.now);
    if (!Number.isFinite(now)) throw new Error('account-health now must be numeric when supplied.');
    result(getAccountHealthSummary({ now }));
    return;
  }

  if (command === 'health-observe') {
    const type = String(payload.type || '');
    if (!ACCOUNT_HEALTH_OBSERVATION_TYPES.includes(type) || type === 'under_the_hood_snapshot') {
      throw new Error(`Unsupported manual health observation type: ${type || 'missing'}.`);
    }
    const source = String(payload.source || '').trim();
    const sourceRef = String(payload.sourceRef ?? payload.source_ref ?? '').trim();
    const observedAt = Number(payload.observedAt ?? payload.observed_at);
    if (!source || !sourceRef) throw new Error('health-observe requires source and sourceRef provenance.');
    if (!Number.isFinite(observedAt) || observedAt <= 0) throw new Error('health-observe requires a positive observedAt timestamp.');
    const metadata = payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? { ...payload.metadata }
      : {};
    if (payload.label != null && metadata.label == null) metadata.label = String(payload.label);
    if (['visibility_label_observed', 'visibility_label_cleared'].includes(type) && !String(metadata.label || '').trim()) {
      throw new Error(`${type} requires metadata.label.`);
    }
    const observation = recordAccountHealthObservation({
      type,
      severity: payload.severity || 'info',
      source,
      sourceRef,
      metadata,
      observedAt,
    });
    result({ observation, accountHealth: getAccountHealthSummary({ now: Math.max(Date.now(), observedAt) }) });
    return;
  }

  if (command === 'health-under-the-hood') {
    const report = await fetchXUnderTheHoodReport();
    const observation = report.available === true ? recordUnderTheHoodSnapshot(report) : null;
    result({ report, recorded: Boolean(observation), observation, accountHealth: getAccountHealthSummary() });
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

  if (command === 'audience-review') {
    result(await reviewAudienceFollowing());
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

  throw new Error('Usage: node agent_bridge.js <editorial-plan|editorial-refresh|editorial-recommendation|editorial-select|editorial-dismiss|editorial-add-source|editorial-outcomes|writing-strategy|writing-strategy-recommend|writing-strategy-select|learn-classify-published|ai-config|ai-runtimes|ai-select-default|ai-bind-role|ingest|inspect|create-draft|writer-packet|apply-writer-output|update-draft|queue|operator-status|operator-lease-acquire|operator-lease-renew|operator-lease-release|operator-memory-review|schedule-next|schedule-inspect|route|workflow|research|performance|analytics|analytics-record|growth-refresh|growth-next|measurements|experiments|experiment-create|experiment-assign|experiment-summary|learning|learning-refresh|learning-accept|learning-retire|decide|record-action|record-disposition|engage-next|engage-refresh|engage-draft|engage-resolve|account-health|health-observe|health-under-the-hood|relationship-targets|relationship-inspect|relationship-events|audience-sync|audience-review|audience> < JSON');
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exit(1);
});
