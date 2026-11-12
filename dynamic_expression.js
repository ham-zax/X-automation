// Closed-loop experimental dynamism engine for Reply & social expression.
// Combines a 7-arm domain-aware Contextual UCB1 + stochastic exploration bandit,
// dynamic register modulation, and a rolling anti-monotony entropy guard — backed
// by real published X outcome reconciliation in app_state (zero extra LLM calls).
import { DomainValidationError } from './errors.js';

export const DYNAMIC_EXPRESSION_STATE_KEY = 'dynamic_expression_state_v1';
const STATE_VERSION = 1;
const HISTORY_LIMIT = 200;
const RECONCILE_LIMIT = 100;
const MEASUREMENT_DELAY_MS = 2 * 60 * 60 * 1000;

export const EXPRESSION_ARMS = Object.freeze([
  Object.freeze({
    id: 'systems_tradeoff',
    label: 'Practical builder recognition',
    domains: Object.freeze(['systems', 'showcase', 'general_tech']),
    directive: 'In 1-2 plain, easy-to-read sentences, validate why the practical engineering choice in the post makes sense or name the everyday headache it avoids, using clear subjects from the post. Zero metaphors, zero riddles, zero audit questions.',
  }),
  Object.freeze({
    id: 'frontend_craft',
    label: 'UI & product taste',
    domains: Object.freeze(['frontend', 'showcase', 'general_tech']),
    directive: 'Respond in plain everyday English to the tangible user or developer experience in the post — validate why a clean interaction, escape hatch, or workflow decision feels right in practice. Use the post’s own nouns; never parrot canned jargon or quiz the author.',
  }),
  Object.freeze({
    id: 'sharp_micro',
    label: 'Plain human one-liner',
    domains: Object.freeze(['any']),
    directive: 'Write one natural, effortless human sentence (5-16 plain words) — warm recognition, relatable reaction, or dry literal wit — whose meaning is obvious on first read without decoding any clever phrase or metaphor.',
  }),
  Object.freeze({
    id: 'sarcastic_pushback',
    label: 'Dry reality check on hype',
    domains: Object.freeze(['hype_or_take']),
    directive: 'Use plain-spoken dry wit or honest pushback aimed strictly at impersonal hype, fake benchmarks, or engagement-bait claims — never at an honest builder sharing work, never as personal abuse, and never as a cryptic riddle.',
  }),
  Object.freeze({
    id: 'builder_curiosity',
    label: 'Warm peer curiosity',
    domains: Object.freeze(['systems', 'frontend', 'general_tech']),
    directive: 'Start by warmly appreciating or validating what is cool about what they shared, then ask one easy, flattering question a fellow builder enjoys answering — never an edge-case audit, retry/security interrogation, or cold quiz.',
  }),
  Object.freeze({
    id: 'independent_counterpoint',
    label: 'Clear peer perspective',
    domains: Object.freeze(['systems', 'frontend', 'hype_or_take', 'general_tech']),
    directive: 'Share a calm, plain-English developer perspective on when one approach works better than another, spending the extra plain words needed so every referent is clear on first read. Never nitpick a builder’s launch.',
  }),
  Object.freeze({
    id: 'dry_wit_or_camaraderie',
    label: 'Builder appreciation & camaraderie',
    domains: Object.freeze(['showcase', 'humor', 'social', 'any']),
    directive: 'Make the author genuinely glad you showed up: on launches and builds, offer warm builder appreciation and validate the real pain they solved or a smart choice visible in their post (zero invented facts, zero interrogation); on dev pain or humor, commiserate on their side in plain words.',
  }),
]);

export const REGISTER_MODES = Object.freeze([
  Object.freeze({ id: 'warm_builder', cue: 'Warm, appreciative peer — genuinely happy to see someone shipping good work; specific and human, never corporate.' }),
  Object.freeze({ id: 'plain_direct', cue: 'Plain everyday developer English — clear subjects, zero metaphors, understood effortlessly on first read.' }),
  Object.freeze({ id: 'relatable_peer', cue: 'Friendly teammate in Slack — validates the real-world annoyance or smart design choice without overcomplicating it.' }),
  Object.freeze({ id: 'dry_literal', cue: 'Light, natural wit that comes straight from the literal situation — never a quotable aphorism or riddle.' }),
  Object.freeze({ id: 'grounded_skeptic', cue: 'Allergic to impersonal hype, grounded in plain practical reality, respectful toward real builders.' }),
]);

const FRONTEND_DOMAIN_PATTERN = /\b(?:ui|ux|tui|css|dom|html|react|next\.?js|solid|vue|svelte|tailwind|canvas|webgl|webgpu|shader|animation|layout|render|hydration|optimistic|viewport|keyboard|component|frontend|front-end|design system|frame|scroll|cursor|modal|state|onboarding)\b/i;
const SYSTEMS_DOMAIN_PATTERN = /\b(?:backend|distributed|postgres|sqlite|database|redis|queue|kafka|cache|idempoten|retry|lease|lock|consensus|p99|throughput|backpressure|stream|protocol|rust|golang|\bgo\b|kernel|memory|cpu|docker|systemd|agent|subagent|mcp|llm|token|kv|inference|schema|api|server|benchmark|latency)\b/i;
const SHOWCASE_DOMAIN_PATTERN = /(?:💥|\b(?:(?:i|we)\s+(?:(?:just|finally|recently)\s+)?(?:built|made|created|shipped|released|launched|open[- ]sourced|put together|wrote)|shipped|launching|just released|daily driving|it'?s open source|check out (?:my|our)|try out))\b/i;
const HYPE_OR_TAKE_PATTERN = /\b(?:10x|100x|dead|rip\s+\w+|replace\s+(?:all\s+)?(?:devs|developers|engineers|programmers)|revolutionary|game.?changer|unpopular opinion|hot take|no.?code|microservices|enterprise|agi|wrapper|slop|hype|insane|mind.?blowing|hotter take|everyone is wrong)\b/i;
const HUMOR_DOMAIN_PATTERN = /\b(?:lol|lmao|haha|deleted the database|prod|friday deploy|padding|centered|joke|meme|cursed|wtf)\b/i;
const INVITED_QUESTION_PATTERN = /\b(?:feedback|thoughts|ideas?|suggestions?|what should (?:i|we)|what would you|how are you|anyone else)\b|\?\s*$/i;
const PRAISE_OPENER_PATTERN = /^(?:congrats|congratulations|nice|love|great|cool|awesome|amazing)\b/i;

export function classifyCandidateDomains(text = '') {
  const value = String(text || '');
  const domains = [];
  if (SHOWCASE_DOMAIN_PATTERN.test(value)) domains.push('showcase');
  if (FRONTEND_DOMAIN_PATTERN.test(value)) domains.push('frontend');
  if (SYSTEMS_DOMAIN_PATTERN.test(value)) domains.push('systems');
  if (HYPE_OR_TAKE_PATTERN.test(value) && !domains.includes('showcase')) domains.push('hype_or_take');
  if (HUMOR_DOMAIN_PATTERN.test(value)) domains.push('humor');
  return domains.length ? domains : ['general_tech', 'social'];
}

// recentReplies is newest-first across both candidate_actions and published drafts.
export function computeCadenceEntropy(recentReplies = []) {
  const normalized = (Array.isArray(recentReplies) ? recentReplies : [])
    .map((item) => (typeof item === 'string' ? item : item && typeof item === 'object' ? item.text : ''))
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const newest = normalized.slice(0, 3);
  const questionStreak = newest.filter((text) => text.includes('?')).length;
  const totalQuestions = normalized.filter((text) => text.includes('?')).length;
  const praiseOpenerCount = newest.filter((text) => PRAISE_OPENER_PATTERN.test(text)).length;
  const lowercaseCount = newest.filter((text) => /^[a-z]/.test(text)).length;
  const avgChars = normalized.length
    ? normalized.reduce((sum, text) => sum + text.length, 0) / normalized.length
    : 0;
  const constraints = [];
  if (questionStreak >= 1 || totalQuestions >= 2) {
    constraints.push('Recent replies already asked questions — do NOT end with a question mark or ask any question this turn; write a warm, plain statement, appreciation, or relatable observation.');
  }
  if (praiseOpenerCount >= 2) {
    constraints.push("Recent replies opened with praise/Congrats — keep warm appreciation, just vary the opening words by starting directly on the concrete detail or problem solved (zero 'Congrats/Nice' opener).");
  }
  if (normalized.length >= 3 && avgChars > 185) {
    constraints.push('Recent replies ran long — keep this one concise (under 140 characters) in plain everyday words, never compressed into a metaphor or riddle.');
  } else if (normalized.length >= 3 && avgChars < 60) {
    constraints.push('Recent replies were ultra-short — spend 1-2 plain, clear sentences so the thought is effortless to read on first glance.');
  }
  if (newest.length === 3 && lowercaseCount === 3) {
    constraints.push('Mix casing naturally — use normal sentence capitalization this turn so lowercase never becomes a robotic tic.');
  }
  return {
    questionStreak,
    totalQuestions,
    praiseOpenerCount,
    avgChars: Math.round(avgChars || 0),
    constraints,
    cadenceConstraint: constraints.join(' ') || 'Write in plain, natural developer English; spend the extra clear words that make the meaning effortless on first read.',
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

function hashUnit(seed) {
  let hash = 2166136261;
  const text = String(seed || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function selectRegisterMode({ domains, armId, candidateKey, historyLength }) {
  if (armId === 'sarcastic_pushback' || domains.includes('hype_or_take')) {
    return REGISTER_MODES.find((m) => m.id === 'grounded_skeptic');
  }
  if (domains.includes('showcase')) {
    const warmModes = REGISTER_MODES.filter((m) => ['warm_builder', 'relatable_peer', 'plain_direct'].includes(m.id));
    const slot = Math.floor(hashUnit(`${candidateKey}::reg::${historyLength}`) * warmModes.length);
    return warmModes[slot % warmModes.length];
  }
  if (armId === 'sharp_micro') {
    return REGISTER_MODES.find((m) => m.id === 'dry_literal');
  }
  const regularModes = REGISTER_MODES.filter((m) => m.id !== 'grounded_skeptic');
  const slot = Math.floor(hashUnit(`${candidateKey}::reg::${historyLength}`) * regularModes.length);
  return regularModes[slot % regularModes.length];
}

function armScore(stats, { candidateKey, armId, totalPulls, domains, exploratoryRoll }) {
  const jitter = hashUnit(`${candidateKey}::${armId}`);
  const questionPenalty = armId === 'builder_curiosity' ? -0.22 : 0;
  const domainBoost = (armId === 'dry_wit_or_camaraderie' && domains.includes('showcase')) ? 0.35
    : (armId === 'sarcastic_pushback' && domains.includes('hype_or_take')) ? 0.28
      : (armId === 'frontend_craft' && domains.includes('frontend')) ? 0.18
        : (armId === 'systems_tradeoff' && domains.includes('systems')) ? 0.18
          : 0;
  // Exploratory roll (~22% of turns) deliberately surfaces wildcards and under-pulled arms.
  if (exploratoryRoll) {
    return (1 / (1 + stats.pulls * 0.35)) + domainBoost + questionPenalty + jitter * 0.45;
  }
  if (stats.measuredCount < 2 && stats.pulls < 3) {
    return 1.5 - stats.pulls * 0.2 + domainBoost + questionPenalty + jitter * 0.15;
  }
  const mean = stats.measuredCount > 0 ? stats.rewardSum / stats.measuredCount : 0.45;
  const total = Math.max(2, totalPulls);
  return mean + 0.55 * Math.sqrt(Math.log(total) / Math.max(1, stats.pulls)) + domainBoost + questionPenalty + jitter * 0.08;
}

function readRecentReplyHistory(store, limit = 6) {
  const merged = [];
  try {
    if (typeof store.listRecentPublishedReplies === 'function') {
      for (const item of store.listRecentPublishedReplies({ limit: limit + 4 }) || []) {
        const text = String(item?.text || item?.outputText || '').trim();
        if (text) merged.push({ text, at: Number(item?.createdAt || 0) });
      }
    }
  } catch {
    // Fall back to published draft records if candidate_actions read fails.
  }
  try {
    if (typeof store.listRecentPublishedContent === 'function') {
      for (const item of store.listRecentPublishedContent({ kind: 'reply', limit: limit + 4 }) || []) {
        const text = String(item?.text || item?.body || '').trim();
        if (text) merged.push({ text, at: Number(item?.publishedAt || item?.updatedAt || 0) });
      }
    }
  } catch {
    // Optional store query in minimal test stubs.
  }
  merged.sort((left, right) => right.at - left.at);
  const seen = new Set();
  const unique = [];
  for (const entry of merged) {
    if (seen.has(entry.text)) continue;
    seen.add(entry.text);
    unique.push(entry.text);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function selectDynamicExpressionPlan(store, { candidateKey = '', sourceText = '', now = Date.now() } = {}) {
  let state;
  try {
    state = reconcileDynamicExpressionRewards(store, { now }).state;
  } catch {
    state = readState(store);
  }
  const recentReplies = readRecentReplyHistory(store, 6);
  const entropy = computeCadenceEntropy(recentReplies);
  const domains = classifyCandidateDomains(sourceText);
  const isShowcase = domains.includes('showcase');
  const invitedQuestion = INVITED_QUESTION_PATTERN.test(String(sourceText || ''));
  const eligible = EXPRESSION_ARMS.filter((arm) => {
    if (isShowcase && ['sarcastic_pushback', 'independent_counterpoint'].includes(arm.id)) return false;
    if (isShowcase && !invitedQuestion && arm.id === 'builder_curiosity') return false;
    return arm.domains.includes('any') || arm.domains.some((domain) => domains.includes(domain));
  });
  // Hard anti-streak: the last two arms sit out while any alternative remains.
  const recentArmIds = state.history.slice(-2).map((entry) => entry.armId);
  const rotated = eligible.filter((arm) => !recentArmIds.includes(arm.id));
  const pool = rotated.length ? rotated : eligible;
  const blockCuriosity = entropy.questionStreak >= 1 || entropy.totalQuestions >= 2;
  const withoutQuestions = blockCuriosity ? pool.filter((arm) => arm.id !== 'builder_curiosity') : pool;
  const candidates = withoutQuestions.length ? withoutQuestions : pool;
  const totalPulls = EXPRESSION_ARMS.reduce((sum, arm) => sum + state.arms[arm.id].pulls, 0);
  const exploratoryRoll = totalPulls >= 6 && hashUnit(`${candidateKey}::explore::${state.history.length}`) < 0.22;

  let best = null;
  for (const arm of candidates) {
    const score = armScore(state.arms[arm.id], { candidateKey, armId: arm.id, totalPulls, domains, exploratoryRoll });
    if (!best || score > best.score) best = { arm, score };
  }
  const arm = best.arm;
  const register = selectRegisterMode({ domains, armId: arm.id, candidateKey, historyLength: state.history.length });
  const showcaseRule = isShowcase
    ? 'Builder showcase detected — make them feel appreciated and glad you showed up by validating what they built or the pain it solves in plain words; NEVER interrogate or quiz them on edge cases. '
    : '';
  return {
    recentReplies,
    dynamicExperiment: {
      armId: arm.id,
      label: arm.label,
      domains,
      exploratory: exploratoryRoll,
      registerMode: register.id,
      registerCue: register.cue,
      candidateBDirective: `${arm.directive} Register: ${register.cue}`,
      cadenceConstraint: `${showcaseRule}${entropy.cadenceConstraint}`,
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
