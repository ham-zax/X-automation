import {
  getAppState,
  getDiscoverSnapshot,
  recordDiscoverSnapshotError,
  recordSourceObservations,
  runStoreTransaction,
  saveDiscoverSnapshot,
  setAppState,
  upsertCandidates,
} from './store.js';
import { fetchXTargetRecentPosts } from './tech_news.js';
import { classifyNiche as classifyNicheDefault } from './strategy.js';

const X_SNOWFLAKE_EPOCH = 1288834974657n;
const X_SIGNAL_WATCHLIST_STATE_KEY = 'x_signal_watchlist_v1';
const X_FOR_YOU_SENSOR_STATE_KEY = 'x_for_you_sensor_provenance_v1';
const X_STATUS_URL = /^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([^/?#]+)\/status\/(\d+)(?:[/?#].*)?$/i;
const X_USERNAME = /^[A-Za-z0-9_]{1,15}$/;
const X_METRIC_KEYS = Object.freeze(['views', 'likes', 'reposts', 'replies', 'bookmarks']);
const TIMESTAMP_MISMATCH_MS = 5 * 60_000;
const MAX_OBSERVED_FUTURE_SKEW_MS = 5 * 60_000;

export function normalizeXUsername(value) {
  const username = String(value || '').trim().replace(/^@+/, '').toLowerCase();
  if (!X_USERNAME.test(username)) throw new Error(`Invalid X username: ${String(value || '').trim() || 'missing'}.`);
  return username;
}

export function deriveXTimestampFromTweetId(tweetId) {
  const value = String(tweetId || '').trim();
  if (!/^\d+$/.test(value)) throw new Error('X tweetId must be a numeric string.');
  let parsed;
  try {
    parsed = BigInt(value);
  } catch {
    throw new Error('X tweetId must be a numeric string.');
  }
  const timestamp = Number((parsed >> 22n) + X_SNOWFLAKE_EPOCH);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) throw new Error(`Invalid X tweetId timestamp: ${value}.`);
  return timestamp;
}

function parseStatusUrl(value, tweetId) {
  const raw = String(value || '').trim();
  const match = raw.match(X_STATUS_URL);
  if (!match) throw new Error('Post URL must be an X/Twitter status URL.');
  if (String(match[2]) !== String(tweetId)) throw new Error('Post URL status ID does not match tweetId.');
  return { username: normalizeXUsername(match[1]), tweetId: String(match[2]) };
}

function normalizeObservedMetrics(value) {
  if (value == null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Post metrics must be an object when supplied.');
  const metrics = {};
  for (const key of X_METRIC_KEYS) {
    if (!(key in value) || value[key] == null) continue;
    const metric = value[key];
    if (typeof metric !== 'number' || !Number.isFinite(metric) || metric < 0) {
      throw new Error(`Metric ${key} must be a non-negative finite number when supplied.`);
    }
    metrics[key] = metric;
  }
  return metrics;
}

function metricCompleteness(metrics = {}) {
  return X_METRIC_KEYS.reduce((count, key) => count + (metrics[key] == null ? 0 : 1), 0);
}

function candidateMetrics(observedMetrics = {}) {
  const metrics = {};
  if (observedMetrics.views != null) metrics.views = observedMetrics.views;
  if (observedMetrics.likes != null) metrics.likes = observedMetrics.likes;
  if (observedMetrics.reposts != null) metrics.retweets = observedMetrics.reposts;
  if (observedMetrics.replies != null) metrics.replies = observedMetrics.replies;
  if (observedMetrics.bookmarks != null) metrics.bookmarks = observedMetrics.bookmarks;
  return metrics;
}

function normalizeForYouPost(post, diagnostics, index) {
  if (!post || typeof post !== 'object' || Array.isArray(post)) throw new Error('Post entry must be an object.');
  if (post.promoted === true) return { skipped: true, reason: 'PROMOTED' };

  const tweetId = String(post.tweetId || '').trim();
  if (!/^\d+$/.test(tweetId)) throw new Error('Post tweetId must be a numeric string.');
  parseStatusUrl(post.url, tweetId);
  const username = normalizeXUsername(post.username);
  const text = String(post.text || '').trim();
  if (!text) throw new Error('Post text is required.');
  const rank = Number(post.rank);
  if (!Number.isInteger(rank) || rank < 1) throw new Error('Post rank must be a positive integer.');
  const observedMetrics = normalizeObservedMetrics(post.metrics);
  const derivedTimestamp = deriveXTimestampFromTweetId(tweetId);
  let timestamp = derivedTimestamp;
  if (post.timestamp != null && post.timestamp !== '') {
    const suppliedTimestamp = Number(post.timestamp);
    if (!Number.isFinite(suppliedTimestamp) || suppliedTimestamp <= 0) throw new Error('Post timestamp must be a positive numeric timestamp when supplied.');
    if (Math.abs(suppliedTimestamp - derivedTimestamp) > TIMESTAMP_MISMATCH_MS) {
      diagnostics.push({
        code: 'TIMESTAMP_MISMATCH',
        tweetId,
        index,
        suppliedTimestamp,
        derivedTimestamp,
        message: 'Supplied timestamp materially disagreed with tweet-ID timestamp; deterministic tweet-ID time was used.',
      });
    } else {
      timestamp = suppliedTimestamp;
    }
  }

  const url = `https://x.com/${username}/status/${tweetId}`;
  return {
    skipped: false,
    tweetId,
    username,
    text,
    rank,
    timestamp,
    observedMetrics,
    candidate: {
      key: url,
      source: 'x',
      title: `@${username}`,
      text,
      url,
      timestamp,
      score: 0,
      metrics: candidateMetrics(observedMetrics),
    },
  };
}

function failureResult({ observedAt, rejectedCount = 0, skippedCount = 0, diagnostics = [], error }) {
  const suppliedAt = Number(observedAt);
  const now = Date.now();
  const attemptedAt = Number.isSafeInteger(suppliedAt) && suppliedAt > 0 && suppliedAt <= now + MAX_OBSERVED_FUTURE_SKEW_MS
    ? suppliedAt
    : now;
  const message = String(error?.message || error || 'Invalid X For You observation batch.');
  const current = getDiscoverSnapshot('x_for_you');
  recordDiscoverSnapshotError('x_for_you', message, attemptedAt);
  return {
    kind: 'x_for_you',
    observedAt: attemptedAt,
    acceptedCount: 0,
    rejectedCount,
    skippedCount,
    snapshotReplaced: false,
    preservedLastGood: true,
    diagnostics: [...diagnostics, { code: 'BATCH_REJECTED', message }],
    candidates: current.candidates,
  };
}

export function ingestXForYouObservation(payload = {}) {
  const diagnostics = [];
  let observedAt = Number(payload?.observedAt);
  let accountHandle = '';
  try {
    if (String(payload?.kind || '') !== 'x_for_you') throw new Error('X For You ingest kind must be x_for_you.');
    if (!Number.isSafeInteger(observedAt) || observedAt <= 0) throw new Error('X For You observedAt must be a positive safe-integer timestamp.');
    if (observedAt > Date.now() + MAX_OBSERVED_FUTURE_SKEW_MS) {
      throw new Error('X For You observedAt is implausibly far in the future.');
    }
    if (!Array.isArray(payload.posts)) throw new Error('X For You posts must be an array.');
    accountHandle = normalizeXUsername(payload.accountHandle);
    const expectedAccount = normalizeXUsername(process.env.X_ACCOUNT || 'ham_zax');
    if (accountHandle !== expectedAccount) {
      throw new Error(`X For You observation belongs to @${accountHandle}, expected @${expectedAccount}.`);
    }
  } catch (error) {
    return failureResult({ observedAt, diagnostics, error });
  }

  const deduped = new Map();
  let rejectedCount = 0;
  let skippedCount = 0;
  for (let index = 0; index < payload.posts.length; index++) {
    const post = payload.posts[index];
    try {
      const normalized = normalizeForYouPost(post, diagnostics, index);
      if (normalized.skipped) {
        skippedCount++;
        diagnostics.push({ code: normalized.reason, index, message: 'Promoted post skipped.' });
        continue;
      }
      const existing = deduped.get(normalized.tweetId);
      if (!existing) {
        deduped.set(normalized.tweetId, normalized);
        continue;
      }

      skippedCount++;
      diagnostics.push({ code: 'DUPLICATE_TWEET', tweetId: normalized.tweetId, index, message: 'Duplicate tweet collapsed within observation batch.' });
      const bestRank = Math.min(existing.rank, normalized.rank);
      const existingCompleteness = metricCompleteness(existing.observedMetrics);
      const nextCompleteness = metricCompleteness(normalized.observedMetrics);
      const base = normalized.rank < existing.rank ? normalized : existing;
      const metricsSource = nextCompleteness > existingCompleteness ? normalized : existing;
      deduped.set(normalized.tweetId, {
        ...base,
        rank: bestRank,
        observedMetrics: metricsSource.observedMetrics,
        candidate: {
          ...base.candidate,
          metrics: candidateMetrics(metricsSource.observedMetrics),
        },
      });
    } catch (error) {
      rejectedCount++;
      diagnostics.push({
        code: 'POST_REJECTED',
        index,
        tweetId: String(post?.tweetId || ''),
        message: String(error?.message || error),
      });
    }
  }

  const accepted = [...deduped.values()].sort((left, right) => left.rank - right.rank || left.tweetId.localeCompare(right.tweetId));
  if (!accepted.length) {
    return failureResult({
      observedAt,
      rejectedCount,
      skippedCount,
      diagnostics,
      error: 'X For You ingest produced zero valid organic posts; preserved last-known-good snapshot.',
    });
  }

  const candidates = accepted.map((item) => item.candidate);
  upsertCandidates(candidates);
  const snapshot = saveDiscoverSnapshot('x_for_you', candidates, observedAt);
  setAppState(X_FOR_YOU_SENSOR_STATE_KEY, JSON.stringify({
    observedAt,
    accountHandle,
    accountVerified: true,
    adapterType: String(payload.adapterType || ''),
    sessionId: String(payload.sessionId || ''),
    runId: String(payload.runId || ''),
    browserTarget: String(payload.browserTarget || ''),
    browserBackend: String(payload.browserBackend || ''),
    browserProfile: payload.browserProfile == null ? null : String(payload.browserProfile),
    sensorVersion: String(payload.sensorVersion || 'x_for_you_v1'),
    collectionStatus: String(payload.collectionStatus || 'complete'),
    acceptedCount: accepted.length,
    rejectedCount,
    skippedCount,
  }));
  recordSourceObservations(accepted.map((item) => ({
    candidateKey: item.candidate.key,
    snapshotKind: 'x_for_you',
    observedAt,
    rank: item.rank,
    metrics: item.observedMetrics,
  })));

  return {
    kind: 'x_for_you',
    observedAt,
    acceptedCount: accepted.length,
    rejectedCount,
    skippedCount,
    snapshotReplaced: true,
    preservedLastGood: false,
    diagnostics,
    candidates: snapshot.candidates,
  };
}

export function getXForYouSensorStatus() {
  try {
    const raw = getAppState(X_FOR_YOU_SENSOR_STATE_KEY, null);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function mergeCreatorTargets(relationshipProfiles = [], signalWatchTargets = []) {
  const merged = new Map();
  const add = (value, origin) => {
    const username = normalizeXUsername(value);
    const current = merged.get(username) || { username, origins: [] };
    if (!current.origins.includes(origin)) current.origins.push(origin);
    merged.set(username, current);
  };
  for (const profile of Array.isArray(relationshipProfiles) ? relationshipProfiles : []) {
    if (!profile?.username) continue;
    add(profile.username, 'relationship');
  }
  for (const target of Array.isArray(signalWatchTargets) ? signalWatchTargets : []) {
    if (!target?.username || target.enabled === false) continue;
    add(target.username, 'signal_watch');
  }
  return [...merged.values()];
}

function creatorCandidateFromPost(post, classifyNiche) {
  const id = String(post?.id || '').trim();
  if (!/^\d+$/.test(id)) throw new Error('Creator post id must be a numeric string.');
  const targetUsername = normalizeXUsername(post?.targetUsername || post?.authorUsername);
  const authorUsername = normalizeXUsername(post?.authorUsername || post?.targetUsername);
  const text = String(post?.text || '').trim();
  if (!text) throw new Error(`Creator post ${id} text is required.`);
  const canonicalUrl = `https://x.com/${authorUsername}/status/${id}`;
  if (post?.url) parseStatusUrl(post.url, id);
  const timestamp = Number(post?.timestamp || 0) || deriveXTimestampFromTweetId(id);
  const niche = classifyNiche(text) || { score: 0, tags: [], matches: [] };
  const metrics = {};
  if (Number.isFinite(Number(post?.views))) metrics.views = Number(post.views);
  if (Number.isFinite(Number(post?.likes))) metrics.likes = Number(post.likes);
  if (Number.isFinite(Number(post?.reposts))) metrics.retweets = Number(post.reposts);
  if (Number.isFinite(Number(post?.replies))) metrics.replies = Number(post.replies);
  return {
    targetUsername,
    post: { ...post, id, targetUsername, authorUsername, text, timestamp, url: canonicalUrl },
    candidate: {
      key: canonicalUrl,
      source: 'x',
      title: `@${authorUsername}`,
      text,
      url: canonicalUrl,
      timestamp,
      score: Number(niche.score || 0),
      niche: {
        score: Number(niche.score || 0),
        tags: Array.isArray(niche.tags) ? niche.tags : [],
        matches: Array.isArray(niche.matches) ? niche.matches : [],
      },
      metrics,
    },
  };
}

function creatorObservation(entry, observedAt) {
  const metrics = {};
  if (entry.candidate.metrics.views != null) metrics.views = entry.candidate.metrics.views;
  if (entry.candidate.metrics.likes != null) metrics.likes = entry.candidate.metrics.likes;
  if (entry.candidate.metrics.retweets != null) metrics.reposts = entry.candidate.metrics.retweets;
  if (entry.candidate.metrics.replies != null) metrics.replies = entry.candidate.metrics.replies;
  return {
    candidateKey: entry.candidate.key,
    snapshotKind: 'x_creator_latest',
    observedAt,
    rank: null,
    metrics,
  };
}

function creatorErrorMessage(errors = []) {
  return errors.map((item) => `@${item.targetUsername || 'unknown'}: ${item.error || 'creator fetch failed'}`).join('; ');
}

export async function refreshCreatorLatestDiscovery({
  relationshipProfiles = [],
  signalWatchTargets = null,
  postsPerTarget = 4,
  since = null,
  fetchRecentPosts = fetchXTargetRecentPosts,
  classifyNiche = classifyNicheDefault,
  observedAt = Date.now(),
} = {}) {
  const timestamp = Number(observedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('Creator discovery observedAt must be a positive timestamp.');
  const watchTargets = signalWatchTargets == null ? getXSignalWatchlist().targets : signalWatchTargets;
  const targets = mergeCreatorTargets(relationshipProfiles, watchTargets);
  const originsByUsername = new Map(targets.map((target) => [target.username, target.origins]));
  if (!targets.length) {
    const snapshot = saveDiscoverSnapshot('x_creator_latest', [], timestamp);
    return {
      kind: 'x_creator_latest',
      observedAt: timestamp,
      targets,
      attemptedUsernames: [],
      entries: [],
      candidates: snapshot.candidates,
      errors: [],
      acceptedCount: 0,
      snapshotReplaced: true,
      preservedLastGood: false,
      partialFailure: false,
    };
  }

  let read;
  try {
    read = await fetchRecentPosts(targets.map((target) => target.username), {
      maxTargets: targets.length,
      postsPerTarget,
      since,
    });
  } catch (error) {
    const message = String(error?.message || error || 'Creator discovery fetch failed.');
    recordDiscoverSnapshotError('x_creator_latest', message, timestamp);
    return {
      kind: 'x_creator_latest',
      observedAt: timestamp,
      targets,
      attemptedUsernames: targets.map((target) => target.username),
      entries: [],
      candidates: getDiscoverSnapshot('x_creator_latest').candidates,
      errors: [{ targetUsername: '', error: message }],
      acceptedCount: 0,
      snapshotReplaced: false,
      preservedLastGood: true,
      partialFailure: false,
    };
  }

  const errors = Array.isArray(read?.errors) ? read.errors : [];
  const attemptedCount = Math.max(0, Math.min(targets.length, Number(read?.bounds?.maxTargets ?? targets.length) || targets.length));
  const attemptedUsernames = targets.slice(0, attemptedCount).map((target) => target.username);
  const failedUsers = new Set(errors.map((item) => {
    try { return normalizeXUsername(item?.targetUsername); } catch { return ''; }
  }).filter(Boolean));
  const rawPosts = Array.isArray(read?.posts) ? read.posts : [];
  if (!rawPosts.length && attemptedUsernames.length && attemptedUsernames.every((username) => failedUsers.has(username))) {
    const message = creatorErrorMessage(errors) || 'Every attempted creator fetch failed.';
    recordDiscoverSnapshotError('x_creator_latest', message, timestamp);
    return {
      kind: 'x_creator_latest',
      observedAt: timestamp,
      targets,
      attemptedUsernames,
      entries: [],
      candidates: getDiscoverSnapshot('x_creator_latest').candidates,
      errors,
      acceptedCount: 0,
      snapshotReplaced: false,
      preservedLastGood: true,
      partialFailure: false,
    };
  }

  const entries = [];
  const normalizationErrors = [];
  const seen = new Set();
  for (const post of rawPosts) {
    try {
      const normalized = creatorCandidateFromPost(post, classifyNiche);
      if (seen.has(normalized.candidate.key)) continue;
      seen.add(normalized.candidate.key);
      entries.push({
        ...normalized,
        origins: originsByUsername.get(normalized.targetUsername) || [],
      });
    } catch (error) {
      normalizationErrors.push({ targetUsername: post?.targetUsername || '', error: String(error?.message || error) });
    }
  }
  const allErrors = [...errors, ...normalizationErrors];
  const candidates = entries.map((entry) => entry.candidate);
  upsertCandidates(candidates);
  const snapshot = saveDiscoverSnapshot('x_creator_latest', candidates, timestamp);
  recordSourceObservations(entries.map((entry) => creatorObservation(entry, timestamp)));
  const partialFailure = allErrors.length > 0;
  if (partialFailure) {
    recordDiscoverSnapshotError('x_creator_latest', `Partial creator refresh: ${creatorErrorMessage(allErrors)}`, timestamp);
  }
  return {
    kind: 'x_creator_latest',
    observedAt: timestamp,
    targets,
    attemptedUsernames,
    entries,
    candidates: snapshot.candidates,
    errors: allErrors,
    acceptedCount: entries.length,
    snapshotReplaced: true,
    preservedLastGood: false,
    partialFailure,
  };
}

function parseWatchlistState() {
  const raw = getAppState(X_SIGNAL_WATCHLIST_STATE_KEY, null);
  if (!raw) return { revision: 0, updatedAt: null, targets: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { revision: 0, updatedAt: null, targets: [] };
    return {
      revision: Math.max(0, Number(parsed.revision || 0)),
      updatedAt: parsed.updatedAt == null ? null : Number(parsed.updatedAt),
      targets: Array.isArray(parsed.targets) ? parsed.targets : [],
    };
  } catch {
    return { revision: 0, updatedAt: null, targets: [] };
  }
}

export function getXSignalWatchlist() {
  const state = parseWatchlistState();
  return {
    revision: Number.isFinite(state.revision) ? state.revision : 0,
    updatedAt: Number.isFinite(state.updatedAt) && state.updatedAt > 0 ? state.updatedAt : null,
    targets: state.targets.map((target) => ({
      username: normalizeXUsername(target.username),
      enabled: target.enabled !== false,
      note: String(target.note || ''),
    })),
  };
}

function validateWatchTargets(value) {
  if (!Array.isArray(value)) throw new Error('Signal watchlist targets must be an array.');
  const seen = new Set();
  return value.map((target, index) => {
    if (!target || typeof target !== 'object' || Array.isArray(target)) throw new Error(`Signal watchlist target ${index + 1} must be an object.`);
    const username = normalizeXUsername(target.username);
    if (seen.has(username)) throw new Error(`Signal watchlist contains duplicate username: ${username}.`);
    seen.add(username);
    if (target.enabled != null && typeof target.enabled !== 'boolean') throw new Error(`Signal watchlist target ${username} enabled must be boolean.`);
    if (target.note != null && typeof target.note !== 'string') throw new Error(`Signal watchlist target ${username} note must be a string.`);
    return {
      username,
      enabled: target.enabled !== false,
      note: String(target.note || '').trim(),
    };
  });
}

export function updateXSignalWatchlist({ targets } = {}) {
  const normalizedTargets = validateWatchTargets(targets);
  return runStoreTransaction(() => {
    const current = parseWatchlistState();
    const next = {
      revision: Math.max(0, Number(current.revision || 0)) + 1,
      updatedAt: Date.now(),
      targets: normalizedTargets,
    };
    setAppState(X_SIGNAL_WATCHLIST_STATE_KEY, JSON.stringify(next));
    return next;
  });
}
