// Read-only "what to do next" ranking for the live operator loop:
// scout (ranked cards) -> agent writes text for the top card -> act posts it.
// buildScoutCards is pure: every input arrives as data; it reads no clock and no DB.
// readScoutInput gathers that data from the store and performs no writes.

import { MAIN_FEED_SPACING_MINUTES, ORIGINAL_SPACING_MINUTES } from './scheduler.js';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MENTIONS_URL = 'https://x.com/notifications/mentions';
const MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'repost']);

export const SCOUT_DEFAULTS = Object.freeze({
  limit: 10,
  maxLimit: 50,
  ownHandle: 'ham_zax',
  replyMaxAgeHours: 6,
  replyFloor: 15,
  replyTarget: 20,
  nicheFloor: 40,
  velocityFloor: 2000,
  relaxedNicheFloor: 25,
  relaxedVelocityFloor: 500,
  originalSpacingMinutes: ORIGINAL_SPACING_MINUTES,
  mainFeedSpacingMinutes: MAIN_FEED_SPACING_MINUTES,
  maxOriginalsPerDay: 4,
  inspirationLimit: 3,
  inspirationSources: Object.freeze(['hn', 'github']),
  quoteViralTier: 'breakout',
  textLimit: 400,
});

const ORIGINAL_SPACING_MS = SCOUT_DEFAULTS.originalSpacingMinutes * MINUTE_MS;
const MAIN_FEED_SPACING_MS = SCOUT_DEFAULTS.mainFeedSpacingMinutes * MINUTE_MS;

export function parseStatusUrl(url) {
  const match = String(url || '').match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)\/status(?:es)?\/(\d+)/i);
  return match ? { author: match[1], tweetId: match[2] } : { author: '', tweetId: '' };
}

function handleOf(url) {
  return parseStatusUrl(url).author.toLowerCase();
}

function clampLimit(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return SCOUT_DEFAULTS.limit;
  return Math.min(n, SCOUT_DEFAULTS.maxLimit);
}

function maxOrNull(values) {
  return values.length ? Math.max(...values) : null;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

// Reply score (higher acts first):
//   log10(viewsPerHour)            velocity; log keeps one 500k/h post from drowning the rest
// + nicheScore / 20                topicality; niche 40 -> 2, niche 100 -> 5
// + 2 * (1 - ageMinutes / 360)     freshness; 2 when brand new, 0 at the 6h cutoff
export function buildScoutCards(input = {}) {
  const now = Number(input.now);
  if (!Number.isFinite(now)) throw new Error('buildScoutCards requires a numeric now.');
  const limit = clampLimit(input.limit);
  const ownHandle = String(input.ownHandle || SCOUT_DEFAULTS.ownHandle).replace(/^@/, '').toLowerCase();
  const attempts = input.attempts || [];
  const candidates = input.candidates || [];
  const inspirationCandidates = input.inspirationCandidates || [];
  const maxAgeMinutes = SCOUT_DEFAULTS.replyMaxAgeHours * 60;

  // Pace: confirmed replies in the last 24h decide whether the niche/velocity floors relax.
  const replies24h = attempts.filter((a) => a.pipeline === 'reply' && a.createdAt >= now - DAY_MS);
  const repliesLast24h = replies24h.length;
  const relaxed = repliesLast24h < SCOUT_DEFAULTS.replyFloor;
  const nicheFloor = relaxed ? SCOUT_DEFAULTS.relaxedNicheFloor : SCOUT_DEFAULTS.nicheFloor;
  const velocityFloor = relaxed ? SCOUT_DEFAULTS.relaxedVelocityFloor : SCOUT_DEFAULTS.velocityFloor;
  const pace = {
    repliesLast24h,
    floor: SCOUT_DEFAULTS.replyFloor,
    target: SCOUT_DEFAULTS.replyTarget,
    behind: repliesLast24h < SCOUT_DEFAULTS.replyTarget,
    relaxed,
    nicheFloor,
    velocityFloor,
    nextOriginalAt: null,
  };

  // Main feed: originals, quotes and reposts share a 30 min gap; originals also need 90 min
  // since the last original and fewer than 4 originals in 24h.
  const replyTargets = new Set(replies24h.map((a) => handleOf(a.candidateKey) || handleOf(a.targetUrl)).filter(Boolean));
  const originalAts = attempts.filter((a) => a.pipeline === 'original').map((a) => a.createdAt);
  const mainFeedAts = attempts.filter((a) => MAIN_FEED_PIPELINES.has(a.pipeline)).map((a) => a.createdAt);
  const lastOriginalAt = maxOrNull(originalAts);
  const lastMainFeedAt = maxOrNull(mainFeedAts);
  const originals24h = originalAts.filter((at) => at >= now - DAY_MS).sort((a, b) => b - a);
  const mainFeedAllowed = lastMainFeedAt == null || lastMainFeedAt + MAIN_FEED_SPACING_MS <= now;
  const originalBlockers = [];
  if (lastOriginalAt != null) originalBlockers.push(lastOriginalAt + ORIGINAL_SPACING_MS);
  if (lastMainFeedAt != null) originalBlockers.push(lastMainFeedAt + MAIN_FEED_SPACING_MS);
  if (originals24h.length >= SCOUT_DEFAULTS.maxOriginalsPerDay) {
    // The 4th most recent original leaving the 24h window frees a slot.
    originalBlockers.push(originals24h[SCOUT_DEFAULTS.maxOriginalsPerDay - 1] + DAY_MS);
  }
  const originalReadyAt = Math.max(now, ...originalBlockers);
  const originalAllowed = originalReadyAt === now;
  pace.nextOriginalAt = originalAllowed ? null : originalReadyAt;

  const replyCards = [];
  for (const candidate of candidates) {
    if (candidate.source !== 'x') continue;
    const url = candidate.url || candidate.key;
    const { author, tweetId } = parseStatusUrl(url);
    if (!author || !tweetId) continue;
    if (author.toLowerCase() === ownHandle) continue;
    const publishedAt = Number(candidate.publishedAt);
    if (!Number.isFinite(publishedAt) || now - publishedAt > maxAgeMinutes * MINUTE_MS) continue;
    if (candidate.hasAction || candidate.dispositionActive || candidate.blockingAttempt) continue;
    const nicheScore = candidate.nicheScore == null ? null : Number(candidate.nicheScore);
    if (nicheScore == null || !Number.isFinite(nicheScore) || nicheScore < nicheFloor) continue;
    const viewsPerHour = Number(candidate.viewsPerHour) || 0;
    if (viewsPerHour < velocityFloor) continue;

    const ageMinutes = Math.max(0, (now - publishedAt) / MINUTE_MS);
    const velocityPart = Math.log10(viewsPerHour);
    const nichePart = nicheScore / 20;
    const freshnessPart = 2 * (1 - ageMinutes / maxAgeMinutes);
    const score = round3(velocityPart + nichePart + freshnessPart);
    replyCards.push({
      tier: 'T1',
      action: 'reply',
      candidateKey: candidate.key,
      url,
      tweetId,
      author,
      text: String(candidate.text || '').slice(0, SCOUT_DEFAULTS.textLimit),
      metrics: {
        viewsPerHour: Math.round(viewsPerHour),
        engagementsPerHour: Math.round(Number(candidate.engagementsPerHour) || 0),
        ageMinutes: Math.round(ageMinutes),
        viralTier: candidate.viralTier || null,
        nicheScore,
      },
      score,
      reason: `score ${score} = log10(${Math.round(viewsPerHour)}/h) ${velocityPart.toFixed(2)}`
        + ` + niche ${nicheScore}/20 ${nichePart.toFixed(2)}`
        + ` + freshness ${Math.round(ageMinutes)}m ${freshnessPart.toFixed(2)}`,
    });
  }
  replyCards.sort((a, b) => b.score - a.score || a.candidateKey.localeCompare(b.candidateKey));

  // At most one quote, and only when the main feed is free: the highest-scoring breakout
  // among the cards shown, whose author we have not already replied to in 24h.
  const topReplies = replyCards.slice(0, limit);
  const quoteIndex = mainFeedAllowed
    ? topReplies.findIndex((card) => card.metrics.viralTier === SCOUT_DEFAULTS.quoteViralTier
      && !replyTargets.has(card.author.toLowerCase()))
    : -1;
  topReplies.forEach((card, index) => {
    card.action = index === quoteIndex ? 'quote' : 'reply';
  });

  const cards = [{
    tier: 'T0',
    action: 'check_mentions',
    candidateKey: null,
    url: MENTIONS_URL,
    tweetId: null,
    author: null,
    text: null,
    metrics: null,
    score: null,
    reason: `Open ${MENTIONS_URL} and reply to new replies to our posts before anything else.`,
  }];

  if (originalAllowed) {
    const inspiration = inspirationCandidates
      .filter((item) => SCOUT_DEFAULTS.inspirationSources.includes(item.source) && now - Number(item.publishedAt) <= DAY_MS)
      .sort((a, b) => Number(b.score) - Number(a.score))
      .slice(0, SCOUT_DEFAULTS.inspirationLimit)
      .map((item) => ({ url: item.url, title: item.title }));
    cards.push({
      tier: 'T2',
      action: 'original',
      candidateKey: null,
      url: null,
      tweetId: null,
      author: null,
      text: null,
      metrics: null,
      score: null,
      reason: {
        summary: `Last original is >= ${SCOUT_DEFAULTS.originalSpacingMinutes} min old and the main feed is free; write one original.`,
        inspiration,
      },
    });
  }

  cards.push(...topReplies);
  return { pace, cards };
}

// Gathers buildScoutCards input from the store. Read-only: no inserts, updates or sends.
export function readScoutInput(store, { now = Date.now() } = {}) {
  const ownHandle = String(process.env.X_ACCOUNT || SCOUT_DEFAULTS.ownHandle).replace(/^@/, '');
  const candidates = store.listCandidates({ source: 'x', withinHours: SCOUT_DEFAULTS.replyMaxAgeHours, limit: 500 })
    .map((candidate) => {
      const url = candidate.url || candidate.key;
      const { tweetId } = parseStatusUrl(url);
      return {
        key: candidate.key,
        source: candidate.source,
        url,
        text: candidate.text,
        publishedAt: candidate.timestamp,
        nicheScore: candidate.niche?.score ?? null,
        viralTier: candidate.viral?.tier ?? null,
        viewsPerHour: candidate.viral?.viewsPerHour ?? 0,
        engagementsPerHour: candidate.viral?.engagementsPerHour ?? 0,
        hasAction: store.listCandidateActions(candidate.key).length > 0,
        dispositionActive: Boolean(store.getCandidateDisposition(candidate.key, { now })?.active),
        blockingAttempt: Boolean(tweetId && store.getBlockingActAttemptForTarget(tweetId)),
      };
    });

  const inspirationCandidates = SCOUT_DEFAULTS.inspirationSources
    .flatMap((source) => store.listCandidates({ source, withinHours: 24, limit: 200 }))
    .map((item) => ({ source: item.source, url: item.url || item.key, title: item.title, score: item.score, publishedAt: item.timestamp }));

  // listPublicationAttempts is newest-first and capped at 500; if the cap could cut off the 24h window, refuse rather than undercount.
  const attemptRows = store.listPublicationAttempts({ states: ['confirmed_published'], limit: 500 });
  const oldest = attemptRows.at(-1);
  if (attemptRows.length === 500 && oldest && oldest.createdAt >= now - DAY_MS) {
    throw new Error('scout: 500 confirmed attempts fall inside 24h; the attempt window is truncated, so pace would be wrong.');
  }
  const attempts = attemptRows.map((a) => ({
    pipeline: a.pipeline,
    createdAt: a.createdAt,
    candidateKey: a.candidateKey,
    targetUrl: a.targetUrl,
  }));

  return { now, ownHandle, candidates, inspirationCandidates, attempts };
}
