import 'dotenv/config';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { applyWriterOutput, buildWriterPacket, composeDraft, scoreDraft } from './drafting.js';
import { getPersonaModelSummary, getPersonaSlice } from './persona.js';
import { isMeaningfulOutboundInteraction } from './relationship.js';
import { refreshEngagementOpportunities } from './engagement.js';
import {
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
import { getGrowthOperatorMainFeedStatus } from './autonomous_main_feed.js';
import { getXApiMainFeedCapability } from './x_api_publish.js';
import { fetchXUnderTheHoodReport } from './tech_news.js';
import { refreshSourceSnapshot } from './source_refresh.js';
import { rankMainFeedItems, recommendMainFeedSchedule } from './scheduler.js';
import { assessDiscoveryQuality, classifyNiche, getActiveContentGroups, getActiveNicheProfile, recommendDistributionAction } from './strategy.js';
import { extractViralStyleFeatures } from './viral_style.js';
import {
  EDITORIAL_OBJECTIVES,
  dismissEditorialRecommendation,
  refreshEditorialPlan,
  selectEditorialRecommendation,
  selectEditorialRecommendationAsMissionAgent,
} from './editorial.js';
import { attachEditorialResearchSource } from './research.js';
import {
  claimApprovedEngagementReplyForBrowser,
  ensureCandidateWorkflow,
  inspectGrowthOpportunity,
  inspectWorkflow,
  recommendationContext,
  reconcileRecordedActionWorkflow,
  requestQueueReview,
  resolveEngagementItem,
  rescoreCandidateRelevance,
  routeCandidate,
  saveCandidateToWorkflow,
  setBehaviorDecision,
  sendApprovedEngagementReply,
} from './pipeline.js';
import {
  ACCOUNT_HEALTH_OBSERVATION_TYPES,
  AI_ROLES,
  SOURCE_SNAPSHOT_KINDS,
  acceptLearnedRule,
  assignExperimentVariant,
  candidateKey,
  claimAutonomousReplyDecision,
  claimQueueItem,
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
  getCurrentPersonaStances,
  getQueueItem,
  getQueueItemByCandidate,
  getRelationshipProfile,
  requireGrowthOperatorDelegation,
  getSourceMomentum,
  hasCandidateAction,
  listAudienceProfiles,
  listAcceptedLearnedRules,
  listAiProfiles,
  listAutonomousReplyDecisions,
  listCandidateActions,
  listCandidates,
  listDrafts,
  listDueMeasurementWindows,
  listEngagementItems,
  listExperimentAssignments,
  listExperiments,
  listApprovedMainFeedItems,
  listPublicationMeasurementSeries,
  listPersonaStanceEvents,
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
  recordPersonaStanceEvent,
  recordRelationshipEvent,
  recordUnderTheHoodSnapshot,
  refreshLearnedRuleSuggestion,
  runStoreTransaction,
  retireLearnedRule,
  saveDraft,
  saveQueueItem,
  setAiDefaultProfile,
  setAiRoleBinding,
  setExperimentMinimumCompletedPerVariant,
  setExperimentStatus,
  setExperimentSecondaryMetrics,
  upsertCandidates,
  updateAutonomousReplyDecision,
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
  selectWritingStrategyAsMissionAgent,
  validateWritingStrategyGenerationContext,
} from './writing_strategy.js';

const BROWSER_ARTIFACTS_FILE = path.join(os.homedir(), '.config', 'mcp-dev-bridge', 'browser-artifacts.json');
const BROWSER_ARTIFACTS_LOCK_FILE = `${BROWSER_ARTIFACTS_FILE}.x-growth.lock`;
const DRAFT_MEDIA_DIR = path.resolve('.x-media');

function queueBrowserMediaArtifactName(queueItemId) {
  const id = Number(queueItemId);
  if (!Number.isInteger(id) || id < 1) throw new Error('Browser media artifact requires a positive queue item ID.');
  return `x-growth.queue.${id}.media`;
}

async function readBrowserArtifactManifest() {
  try {
    const parsed = JSON.parse(await fs.readFile(BROWSER_ARTIFACTS_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('manifest must be a JSON object');
    return parsed;
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw new Error(`Browser artifact manifest is unavailable or invalid: ${error.message}`);
  }
}

async function writeBrowserArtifactManifest(manifest) {
  const directory = path.dirname(BROWSER_ARTIFACTS_FILE);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${BROWSER_ARTIFACTS_FILE}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporary, BROWSER_ARTIFACTS_FILE);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

async function withBrowserArtifactManifestLock(callback) {
  await fs.mkdir(path.dirname(BROWSER_ARTIFACTS_FILE), { recursive: true, mode: 0o700 });
  let handle = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      handle = await fs.open(BROWSER_ARTIFACTS_LOCK_FILE, 'wx', 0o600);
      await handle.writeFile(`${process.pid} ${Date.now()}\n`);
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const stat = await fs.stat(BROWSER_ARTIFACTS_LOCK_FILE).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > 30_000) {
        await fs.rm(BROWSER_ARTIFACTS_LOCK_FILE, { force: true }).catch(() => {});
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  if (!handle) throw new Error('Browser artifact manifest is busy; re-read publication state before claiming again.');
  try {
    return await callback();
  } finally {
    await handle.close().catch(() => {});
    await fs.rm(BROWSER_ARTIFACTS_LOCK_FILE, { force: true }).catch(() => {});
  }
}

async function registerQueueBrowserMediaArtifact(queueItemId, filePath, expectedSha256) {
  const artifact = queueBrowserMediaArtifactName(queueItemId);
  const resolved = await fs.realpath(path.resolve(String(filePath || '')));
  if (!resolved.startsWith(`${DRAFT_MEDIA_DIR}${path.sep}`)) {
    throw new Error('Browser media artifact must come from the Growth OS draft-media directory.');
  }
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) throw new Error('Browser media artifact must resolve to a regular file.');
  const approvedHash = String(expectedSha256 || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(approvedHash)) {
    throw new Error('Browser media artifact is not content-hash bound; reattach the media before publication.');
  }
  const actualHash = createHash('sha256').update(await fs.readFile(resolved)).digest('hex');
  if (actualHash !== approvedHash) {
    throw new Error('Browser media attachment bytes changed after approval; reattach and re-review before publication.');
  }
  await withBrowserArtifactManifestLock(async () => {
    const manifest = await readBrowserArtifactManifest();
    const existing = manifest[artifact];
    if (existing !== undefined && path.resolve(String(existing)) !== resolved) {
      throw new Error(`Browser media artifact ${artifact} already points to a different file; re-read claim state before acting.`);
    }
    manifest[artifact] = resolved;
    await writeBrowserArtifactManifest(manifest);
  });
  return { artifact, resolved };
}

async function unregisterQueueBrowserMediaArtifact(queueItemId, expectedPath = null) {
  const artifact = queueBrowserMediaArtifactName(queueItemId);
  return withBrowserArtifactManifestLock(async () => {
    const manifest = await readBrowserArtifactManifest();
    if (!Object.hasOwn(manifest, artifact)) return false;
    if (expectedPath && path.resolve(String(manifest[artifact])) !== path.resolve(String(expectedPath))) {
      throw new Error('Browser media artifact changed concurrently; refusing to remove a different approved file.');
    }
    delete manifest[artifact];
    await writeBrowserArtifactManifest(manifest);
    return true;
  });
}

async function readInput() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  if (!input.trim()) return {};
  return JSON.parse(input);
}

function requireCandidate(key) {
  if (!key || typeof key !== 'string' || !key.trim()) throw new Error('Candidate key is required (provide "key").');
  const candidate = getCandidate(key);
  if (!candidate) throw new Error(`Candidate not found: ${key}`);
  return candidate;
}

function requireDraft(id) {
  const draft = getDraft(Number(id));
  if (!draft) throw new Error(`Draft not found: ${id}`);
  return draft;
}

function requireConfirmedOrDelegated(confirmed, label, { requireLive = false } = {}) {
  if (confirmed === true) return { type: 'explicit_confirmation', grantRevision: null };
  try {
    const authority = requireGrowthOperatorDelegation({ actor: 'agent', requireLive });
    return { type: 'growth_operator', grantRevision: authority.grant.revision };
  } catch (error) {
    throw new Error(`${label} requires an explicit confirmation or a running Growth Operator delegation: ${error.message}`);
  }
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

function manualSourceType(payloadSource, url) {
  if (typeof payloadSource === 'string' && payloadSource.trim()) return payloadSource.trim();
  if (/^https?:\/\/(?:www\.)?x\.com\//i.test(url)) return 'x';
  if (/^https?:\/\/(?:www\.)?github\.com\//i.test(url)) return 'github';
  if (/^https?:\/\/news\.ycombinator\.com\//i.test(url)) return 'hn';
  if (/^https?:\/\//i.test(url)) return 'web';
  return 'manual';
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
    source: manualSourceType(payload.source, url),
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
  const suppliedContext = payload.sourceContext && typeof payload.sourceContext === 'object' && !Array.isArray(payload.sourceContext)
    ? payload.sourceContext
    : null;
  const source = suppliedOperatorSource(payload);
  const publicationVerification = payload.publicationVerification && typeof payload.publicationVerification === 'object' && !Array.isArray(payload.publicationVerification)
    ? payload.publicationVerification
    : null;
  if (!suppliedContext && !source && !publicationVerification) return null;
  return {
    ...(suppliedContext || {}),
    ...(source ? {
      observedAt: source.observedAt ?? suppliedContext?.observedAt,
      sourceTimestamp: source.timestamp ?? suppliedContext?.sourceTimestamp,
      sourceKinds: Array.isArray(source.sourceKinds) ? source.sourceKinds : suppliedContext?.sourceKinds,
      metrics: source.metrics && typeof source.metrics === 'object' && !Array.isArray(source.metrics)
        ? source.metrics
        : suppliedContext?.metrics || {},
    } : {}),
    ...(publicationVerification ? { publicationVerification } : {}),
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

function recentTopicBalance(windowSize = null) {
  const settings = getActiveNicheProfile().topicBalance;
  const boundedWindow = Math.max(10, Math.min(100, Number(windowSize ?? settings.windowSize)));
  const groups = getActiveContentGroups().filter((group) => Number(group.targetShare || 0) > 0);
  const targetTotal = groups.reduce((sum, group) => sum + Number(group.targetShare || 0), 0);
  if (!groups.length || targetTotal <= 0) return { sampleSize: 0, groups: {}, enabled: false };

  const eligibleTags = new Set(groups.map((group) => group.tag));
  const recent = [
    ...listRecentMainFeedPublications({ limit: boundedWindow }),
    ...listRecentPublishedContent({ kind: 'reply', limit: boundedWindow }),
  ]
    .sort((left, right) => Number(right.publishedAt || right.updatedAt || 0) - Number(left.publishedAt || left.updatedAt || 0))
    .slice(0, boundedWindow);
  const counts = new Map(groups.map((group) => [group.tag, 0]));
  let sampleSize = 0;

  for (const item of recent) {
    const candidate = getCandidate(item.candidateKey);
    const tags = (candidate?.niche?.status === 'current' ? candidate.niche.tags : classifyNiche(item.text || item.body || '').tags)
      .filter((tag) => eligibleTags.has(tag));
    if (!tags.length) continue;
    sampleSize += 1;
    const share = 1 / tags.length;
    for (const tag of tags) counts.set(tag, Number(counts.get(tag) || 0) + share);
  }

  return {
    enabled: Number(settings.strength || 0) > 0 && Number(settings.maxAdjustment || 0) > 0,
    settings: { ...settings, windowSize: boundedWindow },
    sampleSize,
    groups: Object.fromEntries(groups.map((group) => {
      const targetShare = (Number(group.targetShare || 0) / targetTotal) * 100;
      const observedShare = sampleSize ? (Number(counts.get(group.tag) || 0) / sampleSize) * 100 : 0;
      return [group.tag, {
        targetShare: Math.round(targetShare * 10) / 10,
        observedShare: Math.round(observedShare * 10) / 10,
        deficit: Math.round((targetShare - observedShare) * 10) / 10,
      }];
    })),
  };
}

function candidateTopicBalance(candidate, topicBalance) {
  if (!topicBalance?.enabled) return { adjustment: 0, matchedTags: [], reason: 'Topic balance is disabled because no active target shares are configured.' };
  const matchedTags = (candidate?.niche?.tags || []).filter((tag) => topicBalance.groups[tag]);
  if (!matchedTags.length) return { adjustment: 0, matchedTags: [], reason: 'Candidate does not match a target-share topic.' };
  const strongest = matchedTags
    .map((tag) => ({ tag, ...topicBalance.groups[tag] }))
    .sort((left, right) => right.deficit - left.deficit)[0];
  const strength = Number(topicBalance.settings?.strength || 0);
  const maxAdjustment = Number(topicBalance.settings?.maxAdjustment || 0);
  const adjustment = Math.max(-maxAdjustment, Math.min(maxAdjustment, Math.round(strongest.deficit * strength)));
  return {
    adjustment,
    matchedTags,
    targetShare: strongest.targetShare,
    observedShare: strongest.observedShare,
    deficit: strongest.deficit,
    reason: `${strongest.tag} is ${strongest.deficit >= 0 ? 'under' : 'over'} its configured rolling target by ${Math.abs(strongest.deficit)} percentage points.`,
  };
}

function growthOperatorPacket(candidate, sourceKinds = [], topicBalance = null) {
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
  const lowSignal = candidate.source === 'x'
    && sourceViews != null
    && sourceViews < 100
    && !candidate.viral?.tier
    && scores.relationshipPotential <= 0;
  const urgency = recommendation.action === 'ignore'
    ? 'blocked'
    : candidate.viral?.tier === 'breakout' || (viewsPerHour != null && viewsPerHour >= 1_000) || (ageHours != null && ageHours <= 3)
      ? 'now'
      : ageHours != null && ageHours <= 12
        ? 'soon'
        : 'normal';
  const topicBalanceDecision = candidateTopicBalance(candidate, topicBalance);
  const operatorPriority = Math.round(
    scores.reachPotential * 0.45
      + scores.conversationPotential * 0.25
      + scores.followPotential * 0.20
      + scores.relationshipPotential * 0.10
      + (borrowedDistribution ? 8 : 0)
      + (urgency === 'now' ? 8 : urgency === 'soon' ? 3 : 0)
      + topicBalanceDecision.adjustment
      - (lowSignal ? 25 : 0)
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
    priorityBasis: 'Empirical operator heuristic: Reach 45%, Conversation 25%, Follow 20%, Relationship 10%, plus borrowed-distribution, freshness, bounded configured topic-balance adjustments, and a low-signal penalty for unproven X sources. Not an X ranking-law claim.',
    topicBalance: topicBalanceDecision,
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
    signal: {
      low: lowSignal,
      reason: lowSignal
        ? 'Fewer than 100 observed views, no viral tier, and no relationship signal; keep available for diagnostics but do not let freshness alone make it an execution leader.'
        : 'No low-signal suppression matched.',
    },
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
    actionable: recommendation.action !== 'ignore' && disposition?.active !== true && !lowSignal,
    execution: {
      route,
      automaticMainFeedAfterApproval: ['original', 'quote', 'thread'].includes(route),
      autonomousReplyCandidate: route === 'reply',
      manualFinalActionRequired: route === 'repost',
    },
    styleTransfer: {
      principle: 'Source style is observational context only. Transfer no wording and do not turn source morphology into a writing rule.',
      directives: [
        'Select and persist the behavior purpose/mode/affect/depth before final writing.',
        'Use only the structure and information depth that the selected act actually needs; short social acts and long technical explanations are both valid.',
        'Keep the object and point legible without forcing a hook, block count, question, number, hashtag treatment, or technical wrinkle.',
        'Let the versioned persona govern decisiveness, warmth, humor, skepticism, and social range; factual and biographical provenance remain separate.',
      ],
    },
    persona: getPersonaModelSummary(),
  };
}

function growthRead(payload = {}) {
  const snapshots = ['x_latest', 'x_momentum', 'github_trending', 'hn_top'].map((kind) => getDiscoverSnapshot(kind));
  const merged = new Map();
  for (const snapshot of snapshots) {
    for (const candidate of snapshot.candidates) {
      if (candidate.source === 'x' && sourceUsername(candidate) === 'ham_zax') continue;
      const current = merged.get(candidate.key) || { candidate, sourceKinds: [] };
      if (snapshot.kind === 'x_momentum') current.candidate = candidate;
      if (!current.sourceKinds.includes(snapshot.kind)) current.sourceKinds.push(snapshot.kind);
      merged.set(candidate.key, current);
    }
  }
  const topicBalance = recentTopicBalance(payload.topicWindow == null ? null : Number(payload.topicWindow));
  const includeIgnored = payload.includeIgnored === true;
  const includeDisposed = payload.includeDisposed === true;
  const includeLowSignal = payload.includeLowSignal === true;
  const items = [...merged.values()]
    .map(({ candidate, sourceKinds }) => growthOperatorPacket(candidate, sourceKinds, topicBalance))
    .filter((item) => !item.growthFit || item.growthFit.allowed || includeIgnored)
    .filter((item) => item.discoveryQuality.allowed)
    .filter((item) => includeLowSignal || item.signal?.low !== true)
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
    topicBalance,
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
  const eligibleBrowserReplies = listAutonomousReplyDecisions({ decision: 'eligible_live', limit: 100 })
    .filter((decision) => decision.claimedAt == null);
  const browserReadCredentialsPresent = Boolean(process.env.AUTH_TOKEN);
  const xApiAccessToken = String(process.env.X_API_ACCESS_TOKEN || '').trim();
  const xApiAccessTokenPresent = Boolean(xApiAccessToken);
  const autoPostEnabled = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';
  const firstEligibleScheduleDecision = scheduleDecisions.find((decision) => decision.eligible) || null;
  const nextScheduleDecision = xApiAccessTokenPresent
    ? scheduleDecisions.find((decision) => decision.eligible
      && getXApiMainFeedCapability(decision.item, { accessToken: xApiAccessToken }).supported) || firstEligibleScheduleDecision
    : firstEligibleScheduleDecision;
  const nextTransportCapability = nextScheduleDecision
    ? getXApiMainFeedCapability(nextScheduleDecision.item, { accessToken: xApiAccessToken })
    : null;
  const accountHealth = getAccountHealthSummary({ now });
  const currentPersonaVersion = getPersonaModelSummary().version;
  const integrityWarnings = [
    ...scheduleDecisions
      .filter((decision) => decision.item.status === 'approved' && decision.blockers.some((blocker) => blocker.code === 'HARD_GATES_NOT_PASSED'))
      .map((decision) => ({
        code: 'APPROVED_ITEM_GATES_FAILED',
        queueItemId: decision.item.id,
        candidateKey: decision.item.candidateKey,
        message: 'Approved queue state exists, but current draft/media hard gates do not pass. Inspect approval integrity before publication.',
      })),
    ...scheduleDecisions
      .filter((decision) => decision.item.status === 'approved'
        && decision.item.approvalAuthority?.type === 'mission_agent'
        && String(decision.item.behavior?.personaModelVersion || '') !== String(currentPersonaVersion || ''))
      .map((decision) => ({
        code: 'DELEGATED_APPROVAL_PERSONA_STALE',
        queueItemId: decision.item.id,
        candidateKey: decision.item.candidateKey,
        approvedPersonaModelVersion: decision.item.behavior?.personaModelVersion || null,
        currentPersonaModelVersion: currentPersonaVersion || null,
        message: 'Delegated approval predates the current persona model and must be re-reviewed before publication.',
      })),
  ];
  return {
    generatedAt: now,
    account: getPerformanceSnapshot(1)?.account || null,
    persona: getPersonaModelSummary(),
    accountHealth: { state: accountHealth.health.state, reasons: accountHealth.health.reasons, generatedAt: accountHealth.generatedAt },
    laneChampions: {
      activeConversationKey: activeConversations[0]?.candidateKey || null,
      newReplyKey: newReplies[0]?.candidateKey || null,
      discoveryKey: growth.items[0]?.key || null,
      approvedMainFeedQueueItemId: (nextScheduleDecision || scheduleDecisions[0])?.item.id || null,
    },
    scoreBoundary: 'Priorities are comparable only within their lane; arbitrate lane champions by relevance, contribution, urgency, relationship continuity, claim confidence, and execution readiness.',
    discovery: { snapshots: growth.snapshots, top: growth.items.map(compactGrowthItem) },
    engagement: { activeConversations, newReplies, cachedRead: true },
    runtime: {
      automation: automationRuntimeStatus(now),
      operatorLease: getOperatorLeaseStatus({ now }),
    },
    growthOperator: getGrowthOperatorMainFeedStatus({ now }),
    execution: {
      mainFeed: {
        autoPostEnabled,
        credentialsPresent: xApiAccessTokenPresent,
        browserReadCredentialsPresent,
        configured: autoPostEnabled && xApiAccessTokenPresent,
        mutationTransport: xApiAccessTokenPresent ? 'x_api_v2' : 'none',
        blockingReason: xApiAccessTokenPresent
          ? (nextTransportCapability?.supported === false ? nextTransportCapability.code : null)
          : 'compliant_transport_unavailable',
        preflight: xApiAccessTokenPresent
          ? 'X API v2 user access token is configured for the background daemon. Publication still remains queue/gate/capability checked; no test post is emitted for preflight.'
          : 'No X API v2 user access token is configured for the background daemon. A persistent Growth Operator may still have a separately authorized browser-agent lane; verify that capability in its owning browser runtime before mutation.',
        next: compactScheduleDecision(nextScheduleDecision),
        nextTransportCapability,
        blocked: scheduleDecisions.filter((decision) => !decision.eligible).slice(0, 5).map(compactScheduleDecision),
      },
      autonomousReply: {
        state: replyGrant.state,
        mode: replyGrant.mode,
        remainingBudget: remainingReplyBudget,
        nextExpectedRefreshAt: replyRuntime.nextExpectedRefreshAt || null,
        lastError: replyRuntime.lastError || null,
      },
      browserAgentTransport: {
        owner: 'operator_runtime',
        preferred: 'browser-fast',
        diagnostics: 'browser-devtools',
        fallback: 'webharness_bundled_agent_browser_cli',
        fallbackRuntime: '/home/hamza/repo/webharness/node_modules/agent-browser/bin/agent-browser.js',
        secondaryFallback: 'global_agent-browser_cli',
        rawFallback: 'disabled_legacy_repository_browser_writer',
        availability: 'not_observed_by_growth_os',
        mainFeedClaimCommand: 'browser-publish-claim',
        replyClaimCommand: 'browser-reply-claim',
        eligibleLiveReplyCount: eligibleBrowserReplies.length,
      },
      browserAndContentExtension: 'Not observed by Growth OS; verify browser-fast session/memory state, prefer the WebHarness-bundled Agent Browser CLI when MCP/Local is unavailable, use the global CLI only as a secondary fallback, and verify the enabled x-content extension in its owning runtime.',
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
    const selected = payload.selectedBy === 'mission_agent'
      ? selectEditorialRecommendationAsMissionAgent(Number(payload.recommendationId), { grantRevision: payload.grantRevision })
      : selectEditorialRecommendation(Number(payload.recommendationId), {
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
    requireConfirmedOrDelegated(payload.confirmRecommend, 'writing-strategy-recommend');
    const queueItemId = Number(payload.queueItemId);
    if (!Number.isInteger(queueItemId) || queueItemId < 1) throw new Error('writing-strategy-recommend requires queueItemId.');
    result(await recommendWritingStrategy(queueItemId, { profile: payload.profileId ?? null }));
    return;
  }

  if (command === 'writing-strategy-select') {
    if (payload.selectedBy === 'mission_agent') {
      result({ selection: await selectWritingStrategyAsMissionAgent(Number(payload.queueItemId), {
        grantRevision: payload.grantRevision,
        draftId: payload.draftId ?? null,
      }) });
      return;
    }
    if (payload.confirmSelect !== true) throw new Error('writing-strategy-select requires confirmSelect=true for the explicit human strategy selection.');
    result({ selection: await selectWritingStrategy(payload) });
    return;
  }

  if (command === 'learn-classify-published') {
    requireConfirmedOrDelegated(payload.confirmClassify, 'learn-classify-published');
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
    if (!payload.key || typeof payload.key !== 'string' || !payload.key.trim()) {
      throw new Error('inspect requires "key" (candidate URL). Use operator-status for the cockpit, or growth-next / queue for discoverable keys.');
    }
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
    const username = sourceUsername(candidate);
    const writerPacket = buildWriterPacket({
      candidate,
      queueItem: workflow.queueItem,
      draft: writerBase,
      relationship: username ? getRelationshipProfile(username) : null,
      recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidate.key }),
      recentReplies: listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidate.key }),
      writingStrategy: strategyGeneration.writingStrategy,
    });
    const next = applyWriterOutput(writerBase, payload.output || {}, { generationProvenance, writerPacket });
    const analysis = scoreDraft(next, candidate, {
      pipeline,
      recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidate.key }),
      recentReplies: pipeline === 'reply'
        ? listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidate.key })
        : [],
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
      publishedTweetId: current.publishedTweetId,
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
    if (!['draft', 'ready'].includes(requestedStatus)) {
      if (requestedStatus === 'published') throw new Error('update-draft cannot declare publication. Verify the live X output and reconcile it through record-action.');
      throw new Error(`Invalid draft status: ${requestedStatus}`);
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

  if (command === 'browser-publish-claim') {
    const now = payload.now == null ? Date.now() : Number(payload.now);
    if (!Number.isFinite(now)) throw new Error('browser-publish-claim now must be numeric when supplied.');
    let item = null;
    if (payload.queueItemId != null) {
      const queueItem = getQueueItem(Number(payload.queueItemId));
      if (!queueItem) throw new Error(`Queue item not found: ${payload.queueItemId}`);
      item = getMainFeedScheduleItem(queueItem.candidateKey);
      if (!item || Number(item.id) !== Number(queueItem.id)) throw new Error('Queue item is not the current main-feed schedule item for its candidate.');
    } else {
      const key = String(payload.key || '');
      if (!key) throw new Error('browser-publish-claim requires queueItemId or key.');
      item = getMainFeedScheduleItem(key);
    }
    if (!item || !['original', 'quote', 'thread', 'repost'].includes(item.pipeline)) {
      throw new Error('browser-publish-claim supports approved Original, Quote, Thread, or Repost items only.');
    }
    const decision = recommendMainFeedSchedule(item, schedulerContext(now));
    if (!decision.eligible) throw new Error(`Browser publication claim blocked: ${decision.reason}`);
    const currentPersonaVersion = getPersonaModelSummary().version;
    if (item.pipeline !== 'repost'
      && item.approvalAuthority?.type === 'mission_agent'
      && String(item.behavior?.personaModelVersion || '') !== String(currentPersonaVersion || '')) {
      throw new Error(`Browser publication claim blocked: delegated approval used persona ${item.behavior?.personaModelVersion || 'unknown'}, current persona is ${currentPersonaVersion || 'unknown'}; re-review before publication.`);
    }
    if (decision.recommendedAt == null || Number(decision.recommendedAt) > now) {
      throw new Error(`Browser publication is not due yet; recommended at ${decision.recommendedAt == null ? 'unknown' : new Date(decision.recommendedAt).toISOString()}.`);
    }
    const threadParts = Array.isArray(item.threadParts) ? item.threadParts.map((part) => String(part).trim()).filter(Boolean) : [];
    const isRepost = item.pipeline === 'repost';
    const text = isRepost ? '' : (item.pipeline === 'thread' ? String(threadParts[0] || '').trim() : String(item.body || item.text || '').trim());
    const sourceUrl = ['quote', 'repost'].includes(item.pipeline) ? String(item.candidate?.url || item.candidate?.key || '').trim() : '';
    if ((!isRepost && !text) || (item.pipeline === 'thread' && threadParts.length === 0) || (['quote', 'repost'].includes(item.pipeline) && !sourceUrl)) {
      throw new Error('Browser publication packet is incomplete; queue state was not claimed.');
    }
    const mediaAttachment = item.media?.attachment || null;
    let browserMediaArtifact = null;
    let registeredMediaPath = null;
    if (mediaAttachment) {
      if (!mediaAttachment.localPath) throw new Error('Browser publication has attached media without a local file path.');
      const registered = await registerQueueBrowserMediaArtifact(item.id, mediaAttachment.localPath, mediaAttachment.sha256);
      browserMediaArtifact = registered.artifact;
      registeredMediaPath = registered.resolved;
    }
    let claimed;
    try {
      claimed = claimQueueItem(item.id, { expectedUpdatedAt: item.updatedAt, now });
      if (!claimed) throw new Error('Browser publication claim lost or authority changed; re-read schedule state before acting.');
    } catch (error) {
      if (registeredMediaPath) await unregisterQueueBrowserMediaArtifact(item.id, registeredMediaPath).catch(() => {});
      throw error;
    }
    const mediaPacket = item.media ? {
      ...item.media,
      attachment: mediaAttachment ? {
        fileName: mediaAttachment.fileName || '',
        mimeType: mediaAttachment.mimeType || '',
        size: Number(mediaAttachment.size || 0),
        sha256: mediaAttachment.sha256 || '',
        attachedAt: mediaAttachment.attachedAt || null,
        provenance: mediaAttachment.provenance || '',
      } : null,
    } : null;
    result({
      claimedAt: now,
      queueItemId: claimed.id,
      candidateKey: claimed.candidateKey,
      pipeline: claimed.pipeline,
      exactText: isRepost ? null : text,
      threadParts,
      sourceUrl: ['quote', 'repost'].includes(item.pipeline) ? sourceUrl : null,
      media: mediaPacket,
      browserMediaArtifact,
      actionForReconciliation: item.pipeline === 'quote' ? 'quote' : item.pipeline === 'repost' ? 'repost' : 'direct',
      executionRule: isRepost
        ? 'Re-observe the exact source post, execute one native Repost action, verify the account now shows the reposted state for that exact source tweet, then call record-action with publicationVerification.repostedSourceTweetId and repostActive=true. Unknown results stay publishing and must not be retried blindly.'
        : `Re-observe the exact X tab/source, execute this claimed action once${browserMediaArtifact ? `, upload only the approved browser-fast artifact ${browserMediaArtifact}` : ''}, verify the public ID/URL, rendered text, media when present, and required structure, then call record-action. Unknown results stay publishing and must not be retried blindly.`,
    });
    return;
  }

  if (command === 'route') {
    requireCandidate(payload.key);
    if (payload.routeContext != null && (typeof payload.routeContext !== 'object' || Array.isArray(payload.routeContext))) {
      throw new Error('routeContext must be an object when supplied.');
    }
    const queueItem = routeCandidate(payload.key, payload.pipeline, { actor: 'agent', reason: payload.reason || '', routeContext: payload.routeContext || {} });
    result({ queueItem, approvalRequired: queueItem.status === 'needs_review' });
    return;
  }

  if (command === 'workflow') {
    if (!payload.key || typeof payload.key !== 'string' || !payload.key.trim()) {
      throw new Error('workflow requires "key" (candidate URL).');
    }
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
      topicBalance: growth.topicBalance,
      items: growth.items,
      readOnlyPlanning: true,
      nextStep: 'For X items, inspect the exact live source/thread before acting and verify the result before record-action. For GitHub/HN items, inspect the primary source before routing or drafting. Use record-disposition for an exact skip/defer.',
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
    requireConfirmedOrDelegated(payload.confirmCreate, 'experiment-create');
    const definition = payload.experiment || payload.definition;
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error('experiment-create requires an experiment definition object.');
    result({ experiment: createExperiment(definition), assignmentPolicy: 'caller_selected', randomized: false });
    return;
  }

  if (command === 'experiment-assign') {
    requireConfirmedOrDelegated(payload.confirmAssign, 'experiment-assign');
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

  if (command === 'experiment-update') {
    requireConfirmedOrDelegated(payload.confirmUpdate, 'experiment-update');
    if (payload.id == null) throw new Error('experiment-update requires id.');
    if (payload.minimumCompletedPerVariant == null && payload.secondaryMetrics == null && payload.status == null) {
      throw new Error('experiment-update requires minimumCompletedPerVariant, secondaryMetrics, and/or status.');
    }
    const currentExperiment = getExperiment(Number(payload.id));
    if (!currentExperiment) throw new Error(`Experiment not found: ${payload.id}`);
    const experiment = runStoreTransaction(() => {
      let updated = currentExperiment;
      if (payload.minimumCompletedPerVariant != null) {
        updated = setExperimentMinimumCompletedPerVariant(updated.id, Number(payload.minimumCompletedPerVariant));
      }
      if (payload.secondaryMetrics != null) {
        updated = setExperimentSecondaryMetrics(updated.id, payload.secondaryMetrics);
      }
      if (payload.status != null) {
        updated = setExperimentStatus(updated.id, payload.status);
      }
      return updated;
    });
    result({ experiment });
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
    if (payload.id == null) throw new Error('learning-accept requires id.');
    const authority = requireConfirmedOrDelegated(payload.confirmAccept, 'learning-accept', { requireLive: true });
    if (authority.type === 'growth_operator') {
      const overview = getLearningOverview();
      const candidateRule = overview.rules.find((rule) => Number(rule.id) === Number(payload.id));
      if (!candidateRule) throw new Error(`Learned rule not found: ${payload.id}`);
      if (candidateRule.status !== 'suggested') throw new Error('Delegated learning acceptance requires a currently suggested rule.');
      if (candidateRule.evidence?.state !== 'repeated' || candidateRule.acceptance?.eligible !== true || candidateRule.review?.suspendEffect === true) {
        throw new Error('Delegated learning acceptance requires repeated qualified evidence with no active review suspension.');
      }
    }
    result({ rule: acceptLearnedRule(Number(payload.id)), overview: getLearningOverview(), authority });
    return;
  }

  if (command === 'learning-retire') {
    if (payload.id == null) throw new Error('learning-retire requires id.');
    const authority = requireConfirmedOrDelegated(payload.confirmRetire, 'learning-retire', { requireLive: true });
    if (authority.type === 'growth_operator') {
      const overview = getLearningOverview();
      const currentRule = overview.rules.find((rule) => Number(rule.id) === Number(payload.id));
      if (!currentRule) throw new Error(`Learned rule not found: ${payload.id}`);
      if (currentRule.status !== 'accepted' || currentRule.review?.retirementRecommended !== true) {
        throw new Error('Delegated learning retirement requires an accepted rule with evidence-backed retirement recommendation.');
      }
    }
    result({ rule: retireLearnedRule(Number(payload.id), { reason: payload.reason || '' }), overview: getLearningOverview(), authority });
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
    const queueBefore = getQueueItemByCandidate(candidate.key);
    if (queueBefore?.status === 'publishing') {
      const expectedAction = queueBefore.pipeline === 'quote'
        ? 'quote'
        : queueBefore.pipeline === 'repost'
          ? 'repost'
          : queueBefore.pipeline === 'reply'
            ? 'reply'
            : ['original', 'thread'].includes(queueBefore.pipeline) ? 'direct' : null;
      if (expectedAction && action !== expectedAction) {
        throw new Error(`Publishing ${queueBefore.pipeline} reconciliation requires action=${expectedAction}; received ${action}.`);
      }
    }
    let browserMediaCleanup = null;
    const sendingReply = action === 'reply'
      ? listAutonomousReplyDecisions({ decision: 'sending', limit: 500 })
        .filter((decision) => decision.candidateKey === candidate.key)
        .sort((left, right) => Number(right.claimedAt || 0) - Number(left.claimedAt || 0))[0] || null
      : null;
    if (sendingReply) {
      if (!payload.outputTweetId) throw new Error('Autonomous browser Reply reconciliation requires outputTweetId.');
      const verifiedParentTweetId = String(payload.publicationVerification?.parentTweetId || '');
      const verifiedText = String(payload.publicationVerification?.outputText || '').trim();
      if (!verifiedParentTweetId || verifiedParentTweetId !== String(sendingReply.targetTweetId)
        || verifiedParentTweetId !== String(queueBefore?.targetTweetId || '')) {
        throw new Error('Autonomous browser Reply reconciliation requires a verified parentTweetId matching the claimed target.');
      }
      if (!verifiedText || verifiedText !== String(sendingReply.exactReply || '').trim()) {
        throw new Error('Autonomous browser Reply reconciliation requires verified outputText matching the claimed exact reply.');
      }
    }
    if (action === 'reply' && queueBefore?.status === 'publishing' && queueBefore.pipeline === 'reply'
      && queueBefore.humanApprovedAt && queueBefore.approvedText) {
      if (!payload.outputTweetId) throw new Error('Human-approved browser Reply reconciliation requires outputTweetId.');
      const verifiedParentTweetId = String(payload.publicationVerification?.parentTweetId || '');
      const verifiedText = String(payload.publicationVerification?.outputText || '').trim();
      if (!verifiedParentTweetId || verifiedParentTweetId !== String(queueBefore.targetTweetId || '')) {
        throw new Error('Human-approved browser Reply reconciliation requires a verified parentTweetId matching the approved target.');
      }
      if (!verifiedText || verifiedText !== String(queueBefore.approvedText || '').trim()) {
        throw new Error('Human-approved browser Reply reconciliation requires verified outputText matching the approved reply.');
      }
    }
    if (queueBefore?.status === 'publishing' && queueBefore.pipeline === 'repost') {
      const expectedSourceTweetId = String(candidate.url || candidate.key || '').match(/\/status\/(\d+)/)?.[1] || '';
      const verifiedSourceTweetId = String(payload.publicationVerification?.repostedSourceTweetId || '');
      if (!expectedSourceTweetId || verifiedSourceTweetId !== expectedSourceTweetId || payload.publicationVerification?.repostActive !== true) {
        throw new Error('Browser Repost reconciliation requires repostActive=true and verified repostedSourceTweetId matching the claimed source.');
      }
    }
    if (queueBefore?.status === 'publishing' && ['original', 'quote', 'thread'].includes(queueBefore.pipeline)) {
      const scheduled = getMainFeedScheduleItem(candidate.key);
      const mediaAttachment = scheduled?.media?.attachment || null;
      if (mediaAttachment) {
        const expectedMediaArtifact = queueBrowserMediaArtifactName(queueBefore.id);
        if (payload.publicationVerification?.mediaAttached !== true
          || String(payload.publicationVerification?.mediaArtifact || '') !== expectedMediaArtifact) {
          throw new Error('Browser main-feed reconciliation requires verified mediaAttached=true and the exact claimed browser media artifact.');
        }
        browserMediaCleanup = { queueItemId: queueBefore.id, localPath: mediaAttachment.localPath || null };
      }
      const expectedText = queueBefore.pipeline === 'thread'
        ? String(scheduled?.threadParts?.[0] || '').trim()
        : String(scheduled?.body || scheduled?.text || '').trim();
      if (String(payload.publicationVerification?.outputText || '').trim() !== expectedText) {
        throw new Error('Browser main-feed reconciliation requires verified outputText matching the claimed publication text.');
      }
      if (queueBefore.pipeline === 'quote') {
        const expectedQuotedTweetId = String(scheduled?.candidate?.url || scheduled?.candidate?.key || '').match(/\/status\/(\d+)/)?.[1] || '';
        if (!expectedQuotedTweetId || String(payload.publicationVerification?.quotedTweetId || '') !== expectedQuotedTweetId) {
          throw new Error('Browser Quote reconciliation requires verified quotedTweetId matching the approved source.');
        }
      }
      if (queueBefore.pipeline === 'thread') {
        const tweetIds = Array.isArray(payload.publicationVerification?.threadTweetIds)
          ? payload.publicationVerification.threadTweetIds.map((value) => String(value || '')).filter(Boolean)
          : [];
        const parentIds = Array.isArray(payload.publicationVerification?.threadParentTweetIds)
          ? payload.publicationVerification.threadParentTweetIds.map((value) => value == null ? null : String(value))
          : [];
        const expectedCount = Array.isArray(scheduled?.threadParts) ? scheduled.threadParts.length : 0;
        const outputTweetId = String(payload.outputTweetId || '');
        const validChain = tweetIds.length === expectedCount
          && expectedCount > 0
          && parentIds.length === expectedCount
          && tweetIds[0] === outputTweetId
          && parentIds[0] == null
          && new Set(tweetIds).size === tweetIds.length
          && tweetIds.slice(1).every((tweetId, index) => parentIds[index + 1] === tweetIds[index]);
        if (!validChain) throw new Error('Browser Thread reconciliation requires the verified tweet ID/parent chain for every approved thread part.');
      }
    }
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
    let autonomousReplyDecision = null;
    if (action === 'reply' && payload.outputTweetId) {
      const sending = listAutonomousReplyDecisions({ decision: 'sending', limit: 500 })
        .filter((decision) => decision.candidateKey === candidate.key)
        .sort((left, right) => Number(right.claimedAt || 0) - Number(left.claimedAt || 0))[0] || null;
      if (sending) {
        autonomousReplyDecision = updateAutonomousReplyDecision(sending.id, {
          decision: 'sent',
          sentAt: payload.actedAt == null ? Date.now() : Number(payload.actedAt),
          outputTweetId: payload.outputTweetId || null,
          outputUrl: payload.outputUrl || null,
        });
      }
    }
    let browserMediaArtifactCleanup = null;
    if (browserMediaCleanup?.localPath) {
      try {
        browserMediaArtifactCleanup = {
          removed: await unregisterQueueBrowserMediaArtifact(browserMediaCleanup.queueItemId, browserMediaCleanup.localPath),
          artifact: queueBrowserMediaArtifactName(browserMediaCleanup.queueItemId),
        };
      } catch (error) {
        browserMediaArtifactCleanup = {
          removed: false,
          artifact: queueBrowserMediaArtifactName(browserMediaCleanup.queueItemId),
          error: error.message,
        };
      }
    }
    result({
      candidateKey: candidate.key,
      recorded: listCandidateActions(candidate.key).find((item) => item.action === action) || recorded,
      reconciledQueue,
      autonomousReplyDecision,
      browserMediaArtifactCleanup,
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
      review = requestQueueReview(key);
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

  if (command === 'browser-reply-claim') {
    const key = String(payload.key || '');
    if (!key) throw new Error('browser-reply-claim requires key.');
    const pending = listAutonomousReplyDecisions({ limit: 500 })
      .filter((decision) => decision.candidateKey === key && decision.decision === 'eligible_live' && decision.claimedAt == null)
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
    const decision = pending[0] || null;
    const queueItem = getQueueItemByCandidate(key);
    const candidate = getCandidate(key);
    if (!queueItem || queueItem.pipeline !== 'reply' || !queueItem.targetTweetId || !candidate) {
      throw new Error('Reply browser claim is missing its persisted target/workflow state.');
    }

    if (decision) {
      if (String(queueItem.targetTweetId) !== String(decision.targetTweetId) || !String(decision.exactReply || '').trim()) {
        throw new Error('Eligible autonomous reply is mismatched with its persisted target/workflow state.');
      }
      const claimed = claimAutonomousReplyDecision(decision.id, { grantRevision: decision.grantRevision, now: Date.now() });
      if (!claimed) throw new Error('Autonomous reply claim lost or authority changed; re-read engagement state before acting.');
      result({
        authorityType: 'autonomous',
        decisionId: claimed.id,
        grantRevision: claimed.grantRevision,
        candidateKey: key,
        targetTweetId: queueItem.targetTweetId,
        targetUsername: queueItem.targetUsername || claimed.targetUsername || null,
        sourceUrl: candidate.url || candidate.key,
        exactReply: claimed.exactReply,
        actionForReconciliation: 'reply',
        executionRule: 'Re-observe the exact target tweet/thread immediately before sending, execute this exact reply once, verify that the resulting post is a child of targetTweetId and the rendered text matches exactReply, then call record-action with publicationVerification.parentTweetId and outputText. Unknown results remain sending and must not be retried blindly.',
      });
      return;
    }

    const manual = claimApprovedEngagementReplyForBrowser(key, { now: Date.now() });
    result({
      authorityType: 'human',
      decisionId: null,
      grantRevision: null,
      queueItemId: manual.queueItem.id,
      candidateKey: key,
      targetTweetId: manual.queueItem.targetTweetId,
      targetUsername: manual.queueItem.targetUsername || null,
      sourceUrl: candidate.url || candidate.key,
      exactReply: manual.exactReply,
      actionForReconciliation: 'reply',
      executionRule: 'Re-observe the exact target tweet/thread immediately before sending, execute this exact approved reply once, verify that the resulting post is a child of targetTweetId and the rendered text matches exactReply, then call record-action with publicationVerification.parentTweetId and outputText. Unknown results remain publishing and must not be retried blindly.',
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

  if (command === 'persona-model') {
    const consumer = String(payload.consumer || '').trim();
    result({
      model: getPersonaModelSummary(),
      ...(consumer ? { slice: getPersonaSlice(consumer) } : {}),
      currentStances: getCurrentPersonaStances({ limit: Math.max(1, Math.min(500, Number(payload.limit || 200))) }),
    });
    return;
  }

  if (command === 'persona-stances') {
    const subject = String(payload.subject || '').trim();
    const status = String(payload.status || '').trim();
    result({
      current: getCurrentPersonaStances({ limit: Math.max(1, Math.min(500, Number(payload.limit || 200))) }),
      history: listPersonaStanceEvents({
        subject: subject || null,
        status: status || null,
        limit: Math.max(1, Math.min(1000, Number(payload.historyLimit || payload.limit || 200))),
      }),
    });
    return;
  }

  if (command === 'persona-stance-record') {
    if (payload.confirmRecord !== true) throw new Error('persona-stance-record requires confirmRecord=true.');
    const stance = recordPersonaStanceEvent({
      subject: payload.subject,
      position: payload.position,
      confidence: payload.confidence || 'medium',
      status: payload.status || 'provisional',
      basis: payload.basis,
      sourceRef: payload.sourceRef ?? payload.source_ref ?? '',
      provenance: {
        ...(payload.provenance && typeof payload.provenance === 'object' && !Array.isArray(payload.provenance) ? payload.provenance : {}),
        recordedBy: 'human_bridge',
      },
      supersedesId: payload.supersedesId ?? payload.supersedes_id ?? null,
      observedAt: payload.observedAt ?? payload.observed_at ?? Date.now(),
    });
    result({ stance, current: getCurrentPersonaStances({ limit: 500 }) });
    return;
  }

  if (command === 'behavior-select') {
    const key = String(payload.key || '').trim();
    if (!key) throw new Error('behavior-select requires key.');
    const selected = setBehaviorDecision(key, payload.behavior || {}, { actor: 'human' });
    result(selected);
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

  throw new Error('Usage: node agent_bridge.js <editorial-plan|editorial-refresh|editorial-recommendation|editorial-select|editorial-dismiss|editorial-add-source|editorial-outcomes|writing-strategy|writing-strategy-recommend|writing-strategy-select|learn-classify-published|ai-config|ai-runtimes|ai-select-default|ai-bind-role|ingest|inspect|create-draft|writer-packet|apply-writer-output|update-draft|queue|operator-status|operator-lease-acquire|operator-lease-renew|operator-lease-release|operator-memory-review|schedule-next|schedule-inspect|browser-publish-claim|route|workflow|research|performance|analytics|analytics-record|growth-refresh|growth-next|measurements|experiments|experiment-create|experiment-assign|experiment-update|experiment-summary|learning|learning-refresh|learning-accept|learning-retire|decide|record-action|record-disposition|engage-next|engage-refresh|engage-draft|browser-reply-claim|engage-resolve|account-health|health-observe|health-under-the-hood|persona-model|persona-stances|persona-stance-record|behavior-select|relationship-targets|relationship-inspect|relationship-events|audience-sync|audience-review|audience> < JSON');
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exit(1);
});
