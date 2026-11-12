// Closed-loop expression selection for Reply. Six expression arms compete under a
// contextual UCB1 bandit with deterministic hash jitter, and a cadence-entropy guard
// keeps consecutive replies from collapsing into one shape. No model call happens
// here: selection is arithmetic over persisted state, so it is cheap and replayable.
import { DomainValidationError } from './errors.js';

export const DYNAMIC_EXPRESSION_STATE_KEY = 'dynamic_expression_state_v1';
const STATE_VERSION = 1;
const HISTORY_LIMIT = 200;
const RECONCILE_LIMIT = 100;
const MEASUREMENT_DELAY_MS = 2 * 60 * 60 * 1000;

export const EXPRESSION_ARMS = Object.freeze([
  Object.freeze({
    id: 'systems_tradeoff',
    label: 'Systems trade-off',
    domains: Object.freeze(['systems', 'general_tech']),
    directive: 'Surface the concrete architectural invariant, failure mode, tail-latency bottleneck, state/lease boundary, or retry/cache trade-off in 1-2 crisp peer sentences. Zero textbook definitions.',
  }),
  Object.freeze({
    id: 'frontend_craft',
    label: 'Frontend craft',
    domains: Object.freeze(['frontend', 'general_tech']),
    directive: 'Spot the real UI/DX engineering detail: client/server state split, render waterfall, frame budget, optimistic rollback, layout/interaction feel, keyboard/TUI ergonomics, or component API surface.',
  }),
  Object.freeze({
    id: 'sharp_micro',
    label: 'Sharp micro',
    domains: Object.freeze(['any']),
    directive: 'Drop one unforgettable 4-12 word human line (<= 80 chars) — punchy contrast, deadpan observation, or crisp verdict — and stop immediately.',
  }),
  Object.freeze({
    id: 'builder_curiosity',
    label: 'Builder curiosity',
    domains: Object.freeze(['systems', 'frontend', 'general_tech']),
    directive: 'Point at one non-obvious implementation choice in their post and ask the single concrete engineering question the author actually wants to geek out on.',
  }),
  Object.freeze({
    id: 'independent_counterpoint',
    label: 'Independent counterpoint',
    domains: Object.freeze(['systems', 'frontend', 'general_tech']),
    directive: "Offer a respectful, grounded peer counterpoint or sharp boundary condition ('works great until X / the real win is Y, not Z') with zero arrogance.",
  }),
  Object.freeze({
    id: 'dry_wit_or_camaraderie',
    label: 'Dry wit or camaraderie',
    domains: Object.freeze(['humor', 'social', 'any']),
    directive: 'Pure human wit, deadpan dev commiseration, or low-key peer respect — zero technical lecture, zero corporate praise.',
  }),
]);

const FRONTEND_DOMAIN_PATTERN = /\b(?:ui|ux|tui|css|dom|html|react|next\.?js|solid|vue|svelte|tailwind|canvas|webgl|webgpu|shader|animation|layout|render|hydration|optimistic|viewport|keyboard|component|frontend|front-end|design system|latency|frame)\b/i;
const SYSTEMS_DOMAIN_PATTERN = /\b(?:backend|distributed|postgres|sqlite|database|redis|queue|kafka|cache|idempoten|retry|lease|lock|consensus|p99|throughput|backpressure|stream|protocol|rust|golang|\bgo\b|kernel|memory|cpu|docker|systemd|agent|llm|token|kv|inference|schema|api|server|benchmark)\b/i;
const HUMOR_DOMAIN_PATTERN = /\b(?:lol|lmao|haha|deleted the database|prod|friday deploy|padding|centered|joke|meme)\b/i;
const PRAISE_OPENER_PATTERN = /^(?:congrats|nice|love|great|cool)\b/i;

export function classifyCandidateDomains(text = '') {
  const value = String(text || '');
  const domains = [];
  if (FRONTEND_DOMAIN_PATTERN.test(value)) domains.push('frontend');
  if (SYSTEMS_DOMAIN_PATTERN.test(value)) domains.push('systems');
  if (HUMOR_DOMAIN_PATTERN.test(value)) domains.push('humor');
  return domains.length ? domains : ['general_tech', 'social'];
}

// recentReplies is newest-first, matching listRecentPublishedContent ordering.
export function computeCadenceEntropy(recentReplies = []) {
  const normalized = (Array.isArray(recentReplies) ? recentReplies : [])
    .map((item) => (typeof item === 'string' ? item : item && typeof item === 'object' ? item.text : ''))
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const newest = normalized.slice(0, 3);
  const questionStreak = newest.filter((text) => text.endsWith('?')).length;
  const praiseOpenerCount = newest.filter((text) => PRAISE_OPENER_PATTERN.test(text)).length;
  const avgChars = normalized.length
    ? normalized.reduce((sum, text) => sum + text.length, 0) / normalized.length
    : 0;
  const constraints = [];
  if (questionStreak >= 2) {
    constraints.push('Recent replies already asked questions — do NOT end with a question mark this turn; land a crisp statement, observation, or quip.');
  }
  if (praiseOpenerCount >= 2) {
    constraints.push("Recent replies opened with praise/Congrats — start directly on the concrete technical detail, contrast, or humor with zero 'Congrats/Nice' opener.");
  }
  if (normalized.length >= 3 && avgChars > 135) {
    constraints.push('Recent replies ran medium-long — keep this one tight and punchy (under 110 characters) unless a critical technical nuance requires more.');
  } else if (normalized.length >= 3 && avgChars < 65) {
    constraints.push('Recent replies were ultra-short — if the source has real technical meat, bring a sharper 1-2 sentence architectural or UI insight.');
  }
  return {
    questionStreak,
    praiseOpenerCount,
    avgChars: Math.round(avgChars || 0),
    constraints,
    cadenceConstraint: constraints.join(' ') || 'Vary sentence rhythm naturally from recentReplies; stop the instant the point lands.',
  };
}

function emptyArmStats() {
  return { pulls: 0, wins: 0, measuredCount: 0, rewardSum: 0, totalImpressions: 0, totalReplies: 0, totalLikes: 0 };
}

function emptyState() {
  return {
    version: STATE_VERSION,
    arms: Object.fromEntries(EXPRESSION_ARMS.map((arm) => [arm.id, emptyArmStats()])),
    history: [],
  };
}

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeState(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return state;
  const arms = raw.arms && typeof raw.arms === 'object' && !Array.isArray(raw.arms) ? raw.arms : {};
  for (const arm of EXPRESSION_ARMS) {
    const saved = arms[arm.id];
    if (!saved || typeof saved !== 'object') continue;
    state.arms[arm.id] = {
      pulls: nonNegative(saved.pulls),
      wins: nonNegative(saved.wins),
      measuredCount: nonNegative(saved.measuredCount),
      rewardSum: nonNegative(saved.rewardSum),
      totalImpressions: nonNegative(saved.totalImpressions),
      totalReplies: nonNegative(saved.totalReplies),
      totalLikes: nonNegative(saved.totalLikes),
    };
  }
  state.history = (Array.isArray(raw.history) ? raw.history : [])
    .filter((entry) => entry && typeof entry === 'object' && EXPRESSION_ARMS.some((arm) => arm.id === entry.armId))
    .slice(-HISTORY_LIMIT)
    .map((entry) => ({
      draftId: entry.draftId == null ? null : Number(entry.draftId) || null,
      candidateKey: String(entry.candidateKey || ''),
      armId: entry.armId,
      naturalWon: entry.naturalWon === true,
      createdAt: nonNegative(entry.createdAt),
      reconciledAt: entry.reconciledAt == null ? null : nonNegative(entry.reconciledAt),
      reward: entry.reward == null ? null : nonNegative(entry.reward),
    }));
  return state;
}

function readState(store) {
  if (!store || typeof store.getAppState !== 'function') {
    throw new DomainValidationError('Dynamic expression requires the Growth OS store.');
  }
  const raw = store.getAppState(DYNAMIC_EXPRESSION_STATE_KEY, '');
  if (!raw) return emptyState();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

function writeState(store, state) {
  if (typeof store.setAppState !== 'function') {
    throw new DomainValidationError('Dynamic expression requires a writable Growth OS store.');
  }
  store.setAppState(DYNAMIC_EXPRESSION_STATE_KEY, JSON.stringify(state));
  return state;
}

// Latest captured metrics per tweet, keyed by tweet id. getPerformanceSnapshot is the
// existing store reader over post_metrics; a missing reader simply defers rewards.
function readPostMetrics(store) {
  const metrics = new Map();
  if (typeof store.getPerformanceSnapshot !== 'function') return metrics;
  let snapshot;
  try {
    snapshot = store.getPerformanceSnapshot(500);
  } catch {
    return metrics;
  }
  for (const post of Array.isArray(snapshot?.posts) ? snapshot.posts : []) {
    if (!post?.tweet_id) continue;
    metrics.set(String(post.tweet_id), post);
  }
  return metrics;
}

function publishedAttemptsByCandidate(store) {
  const published = new Map();
  if (typeof store.listPublicationAttempts !== 'function') return published;
  const attempts = store.listPublicationAttempts({ limit: 200 });
  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    if (!attempt || attempt.state !== 'confirmed_published' || !attempt.outputTweetId) continue;
    const key = String(attempt.candidateKey || '');
    if (!key) continue;
    const existing = published.get(key);
    const attemptAt = Number(attempt.reconciledAt || attempt.createdAt || 0);
    const existingAt = existing ? Number(existing.reconciledAt || existing.createdAt || 0) : -1;
    if (!existing || attemptAt > existingAt) published.set(key, attempt);
  }
  return published;
}

export function reconcileDynamicExpressionRewards(store, { now = Date.now() } = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) {
    throw new DomainValidationError('Dynamic expression reconciliation requires a numeric timestamp.');
  }
  const state = readState(store);
  const pending = state.history.filter((entry) => entry.reconciledAt == null).slice(0, RECONCILE_LIMIT);
  if (!pending.length) return { reconciled: 0, pending: 0, state };
  const published = publishedAttemptsByCandidate(store);
  const metrics = readPostMetrics(store);
  let reconciled = 0;
  for (const entry of pending) {
    const attempt = published.get(entry.candidateKey);
    if (!attempt) continue;
    const post = metrics.get(String(attempt.outputTweetId));
    if (!post) continue;
    const publishedAt = Number(post.published_at) || Number(attempt.reconciledAt) || Number(attempt.createdAt) || 0;
    const measuredAt = Number(post.captured_at) || 0;
    // A reward needs a measurement that is at least two hours past publication.
    if (!publishedAt || !measuredAt || measuredAt - publishedAt < MEASUREMENT_DELAY_MS) continue;
    const views = nonNegative(post.views);
    const likes = nonNegative(post.likes);
    const replies = nonNegative(post.replies);
    const reward = Math.min(1, 0.45 * Math.min(1, replies) + 0.30 * Math.min(1, likes / 2) + 0.25 * Math.min(1, views / 100));
    const arm = state.arms[entry.armId];
    if (!arm) continue;
    arm.measuredCount += 1;
    arm.rewardSum += reward;
    arm.totalImpressions += views;
    arm.totalReplies += replies;
    arm.totalLikes += likes;
    entry.reconciledAt = timestamp;
    entry.reward = reward;
    entry.outputTweetId = String(attempt.outputTweetId);
    entry.views = views;
    entry.likes = likes;
    entry.replies = replies;
    reconciled += 1;
  }
  if (reconciled) writeState(store, state);
  return { reconciled, pending: state.history.filter((entry) => entry.reconciledAt == null).length, state };
}

// Deterministic per (candidate, arm) jitter: same input always breaks ties the same way.
function hashJitter(candidateKey, armId) {
  const input = `${String(candidateKey || '')}::${String(armId || '')}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function armScore(stats, { candidateKey, armId, totalPulls }) {
  const jitter = hashJitter(candidateKey, armId);
  if (stats.measuredCount < 2 && stats.pulls < 3) {
    return 1.5 - stats.pulls * 0.2 + jitter * 0.15;
  }
  const mean = stats.measuredCount > 0 ? stats.rewardSum / stats.measuredCount : 0.45;
  const total = Math.max(2, totalPulls);
  return mean + 0.55 * Math.sqrt(Math.log(total) / Math.max(1, stats.pulls)) + jitter * 0.08;
}

export function selectDynamicExpressionPlan(store, { candidateKey = '', sourceText = '', now = Date.now() } = {}) {
  let state;
  try {
    state = reconcileDynamicExpressionRewards(store, { now }).state;
  } catch {
    state = readState(store);
  }
  let recentReplies = [];
  try {
    const recentPublished = typeof store.listRecentPublishedContent === 'function'
      ? store.listRecentPublishedContent({ kind: 'reply', limit: 6 })
      : [];
    recentReplies = (Array.isArray(recentPublished) ? recentPublished : [])
      .map((item) => String(item?.text || item?.body || '').trim())
      .filter(Boolean);
  } catch {
    recentReplies = [];
  }
  const entropy = computeCadenceEntropy(recentReplies);
  const domains = classifyCandidateDomains(sourceText);
  const eligible = EXPRESSION_ARMS.filter((arm) => arm.domains.includes('any')
    || arm.domains.some((domain) => domains.includes(domain)));
  // Hard anti-streak: the last two arms sit out while any alternative remains.
  const recentArmIds = state.history.slice(-2).map((entry) => entry.armId);
  const rotated = eligible.filter((arm) => !recentArmIds.includes(arm.id));
  const pool = rotated.length ? rotated : eligible;
  // A question streak also rules out the curiosity arm so Candidate B cannot force one.
  const withoutQuestions = entropy.questionStreak >= 2 ? pool.filter((arm) => arm.id !== 'builder_curiosity') : pool;
  const candidates = withoutQuestions.length ? withoutQuestions : pool;
  const totalPulls = EXPRESSION_ARMS.reduce((sum, arm) => sum + state.arms[arm.id].pulls, 0);
  let best = null;
  for (const arm of candidates) {
    const score = armScore(state.arms[arm.id], { candidateKey, armId: arm.id, totalPulls });
    if (!best || score > best.score) best = { arm, score };
  }
  const arm = best.arm;
  return {
    recentReplies,
    dynamicExperiment: {
      armId: arm.id,
      label: arm.label,
      domains,
      candidateBDirective: arm.directive,
      cadenceConstraint: entropy.cadenceConstraint,
    },
  };
}

export function recordDynamicExpressionOutcome(store, { draftId = null, candidateKey = '', armId = '', selectedCandidate = 'A', now = Date.now() } = {}) {
  const arm = EXPRESSION_ARMS.find((item) => item.id === String(armId || ''));
  if (!arm) throw new DomainValidationError(`Unknown dynamic expression arm: ${armId || 'missing'}.`);
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) {
    throw new DomainValidationError('Dynamic expression outcome requires a numeric timestamp.');
  }
  const state = readState(store);
  const stats = state.arms[arm.id];
  const selectedB = String(selectedCandidate || '').toUpperCase() === 'B';
  stats.pulls += 1;
  if (selectedB) stats.wins += 1;
  state.history.push({
    draftId: draftId == null ? null : Number(draftId) || null,
    candidateKey: String(candidateKey || ''),
    armId: arm.id,
    naturalWon: !selectedB,
    createdAt: timestamp,
    reconciledAt: null,
    reward: null,
  });
  state.history = state.history.slice(-HISTORY_LIMIT);
  writeState(store, state);
  return { armId: arm.id, pulls: stats.pulls, wins: stats.wins, historyLength: state.history.length };
}

export function getDynamicExpressionSummary(store, { now = Date.now() } = {}) {
  const state = readState(store);
  const arms = EXPRESSION_ARMS.map((arm) => {
    const stats = state.arms[arm.id];
    return {
      armId: arm.id,
      label: arm.label,
      domains: [...arm.domains],
      pulls: stats.pulls,
      wins: stats.wins,
      measuredCount: stats.measuredCount,
      meanReward: stats.measuredCount ? Number((stats.rewardSum / stats.measuredCount).toFixed(4)) : null,
      totalImpressions: stats.totalImpressions,
      totalReplies: stats.totalReplies,
      totalLikes: stats.totalLikes,
    };
  });
  const totals = arms.reduce((sum, arm) => ({
    pulls: sum.pulls + arm.pulls,
    wins: sum.wins + arm.wins,
    measuredCount: sum.measuredCount + arm.measuredCount,
    impressions: sum.impressions + arm.totalImpressions,
    replies: sum.replies + arm.totalReplies,
    likes: sum.likes + arm.totalLikes,
  }), { pulls: 0, wins: 0, measuredCount: 0, impressions: 0, replies: 0, likes: 0 });
  const rewardSum = EXPRESSION_ARMS.reduce((sum, arm) => sum + state.arms[arm.id].rewardSum, 0);
  return {
    version: state.version,
    stateKey: DYNAMIC_EXPRESSION_STATE_KEY,
    arms,
    totals: {
      ...totals,
      meanReward: totals.measuredCount ? Number((rewardSum / totals.measuredCount).toFixed(4)) : null,
    },
    pendingReconciliation: state.history.filter((entry) => entry.reconciledAt == null).length,
    recent: state.history.slice(-5).map((entry) => ({
      armId: entry.armId,
      candidateKey: entry.candidateKey,
      naturalWon: entry.naturalWon,
      reward: entry.reward,
      createdAt: entry.createdAt,
      reconciledAt: entry.reconciledAt,
    })),
    observedAt: Number(now),
  };
}
