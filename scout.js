// Read-only "what to do next" ranking for the live operator loop:
// scout (ranked cards) -> agent writes text for the top card -> act posts it.
// buildScoutCards is pure: every input arrives as data; it reads no clock and no DB.
// readScoutInput gathers that data from the store and performs no writes.

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MENTIONS_URL = 'https://x.com/notifications/mentions';
const MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'repost', 'thread']);

// Discovery has bounded page sizes, not publishing quotas or eligibility score cutoffs.
// Relevance, momentum and freshness inform priority; none grants or denies authority.
export const SCOUT_DEFAULTS = Object.freeze({
  limit: 30,
  maxLimit: 50,
  ownHandle: 'ham_zax',
  candidateReadLimit: 500,
  inspirationLimit: 5,
  inspirationSources: Object.freeze(['hn', 'github']),
  textLimit: 400,
});

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function clampLimit(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return SCOUT_DEFAULTS.limit;
  return Math.min(n, SCOUT_DEFAULTS.maxLimit);
}

function latestAt(values) {
  return values.length ? Math.max(...values) : null;
}

// A soft ordering signal, not a definition of what is viral or worthwhile.
// Low measured reach does not disqualify an interesting, relevant conversation.
function opportunityScore({ nicheScore, viewsPerHour, engagementsPerHour, ageHours }) {
  const relevance = Math.max(0, Math.min(100, nicheScore)) / 12;
  const observedMomentum = Math.log10(1 + Math.max(0, viewsPerHour))
    + 0.6 * Math.log10(1 + Math.max(0, engagementsPerHour));
  // Observed average velocity ages; a popular old post is not necessarily a
  // better conversation than a recent niche-relevant post with modest reach.
  const momentum = observedMomentum / (1 + Math.max(0, ageHours) / 18);
  const freshness = 3 / (1 + Math.max(0, ageHours) / 6);
  return round3(relevance + momentum + freshness);
}

export function parseStatusUrl(url) {
  const match = String(url || '').match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)\/status(?:es)?\/(\d+)/i);
  return match ? { author: match[1], tweetId: match[2] } : { author: '', tweetId: '' };
}

export function buildScoutCards(input = {}) {
  const now = Number(input.now);
  if (!Number.isFinite(now)) throw new Error('buildScoutCards requires a numeric now.');
  const limit = clampLimit(input.limit);
  const ownHandle = String(input.ownHandle || SCOUT_DEFAULTS.ownHandle).replace(/^@/, '').toLowerCase();
  const attempts = input.attempts || [];
  const candidates = input.candidates || [];
  const inspirationCandidates = input.inspirationCandidates || [];
  // Reporting windows are descriptive, not targets, caps, or spacing constraints.
  const repliesLast24h = attempts.filter((a) => a.pipeline === 'reply' && a.createdAt >= now - DAY_MS).length;
  const originalsLast24h = attempts.filter((a) => a.pipeline === 'original' && a.createdAt >= now - DAY_MS).length;
  const quotesLast24h = attempts.filter((a) => a.pipeline === 'quote' && a.createdAt >= now - DAY_MS).length;
  const lastMainFeedAt = latestAt(attempts.filter((a) => MAIN_FEED_PIPELINES.has(a.pipeline)).map((a) => a.createdAt));
  const pace = {
    repliesLast24h,
    originalsLast24h,
    quotesLast24h,
    lastMainFeedAt,
    nextOriginalAt: null, // No timing or daily publication quota: retained for older consumers.
    policy: 'opportunity_led',
  };

  const replyCards = [];
  for (const candidate of candidates) {
    if (candidate.source !== 'x') continue;
    const url = candidate.url || candidate.key;
    const { author, tweetId } = parseStatusUrl(url);
    if (!author || !tweetId) continue;
    if (author.toLowerCase() === ownHandle) continue;
    if (candidate.hasAction || candidate.dispositionActive || candidate.blockingAttempt) continue;
    const publishedAt = Number(candidate.publishedAt);
    const ageHours = Number.isFinite(publishedAt) && publishedAt > 0
      ? Math.max(0, (now - publishedAt) / (60 * MINUTE_MS)) : null;
    const nicheScore = Number.isFinite(Number(candidate.nicheScore)) ? Number(candidate.nicheScore) : 0;
    const viewsPerHour = Math.max(0, Number(candidate.viewsPerHour) || 0);
    const engagementsPerHour = Math.max(0, Number(candidate.engagementsPerHour) || 0);
    const score = opportunityScore({ nicheScore, viewsPerHour, engagementsPerHour, ageHours: ageHours ?? 72 });
    replyCards.push({
      tier: 'T1',
      action: 'reply', // Default transport; the operator can choose quote after reading context.
      eligibleActions: ['reply', 'quote'],
      candidateKey: candidate.key,
      url,
      tweetId,
      author,
      text: String(candidate.text || '').slice(0, SCOUT_DEFAULTS.textLimit),
      metrics: {
        viewsPerHour: Math.round(viewsPerHour),
        engagementsPerHour: Math.round(engagementsPerHour),
        ageMinutes: ageHours == null ? null : Math.round(ageHours * 60),
        viralTier: candidate.viralTier || null, // Telemetry only, never a category gate.
        nicheScore: candidate.nicheScore ?? null,
        nicheTags: candidate.nicheTags || [],
        observed: candidate.observedMetrics || {},
      },
      score,
      reason: `Priority ${score}: relevance ${nicheScore}/100, measured momentum ${Math.round(viewsPerHour)} views/h and ${Math.round(engagementsPerHour)} engagements/h, age ${ageHours == null ? 'unknown' : `${Math.round(ageHours)}h`}. Inspect real context and choose reply, quote, or skip; no metric is a publishing threshold.`,
    });
  }
  replyCards.sort((a, b) => b.score - a.score || a.candidateKey.localeCompare(b.candidateKey));
  const topReplies = replyCards.slice(0, limit);

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

  // Original work is a separate lane. One editorial idea card per scout read is
  // not a rate limit: a subsequent read can offer another, if grounded and distinct.
  const inspiration = inspirationCandidates
    .filter((item) => SCOUT_DEFAULTS.inspirationSources.includes(item.source)
      && Number.isFinite(Number(item.publishedAt)) && Number(item.publishedAt) <= now)
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
      summary: 'Independent original-writing opportunity. Publish only with a distinct verified insight worth putting on the main feed; otherwise skip. No daily or spacing quota.',
      inspiration,
      recentMainFeedAt: lastMainFeedAt,
    },
  });

  cards.push(...topReplies);
  return { pace, cards };
}

// Gathers buildScoutCards input from the store. Read-only: no inserts, updates or sends.
export function readScoutInput(store, { now = Date.now() } = {}) {
  const ownHandle = String(process.env.X_ACCOUNT || SCOUT_DEFAULTS.ownHandle).replace(/^@/, '');
  const candidates = store.listCandidates({ source: 'x', sort: 'recent', limit: SCOUT_DEFAULTS.candidateReadLimit })
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
        nicheTags: candidate.niche?.tags || [],
        viralTier: candidate.viral?.tier ?? null,
        viewsPerHour: candidate.viral?.viewsPerHour ?? (Number(candidate.metrics?.views || 0)
          / Math.max(0.25, (now - Number(candidate.timestamp || now)) / 3_600_000)),
        engagementsPerHour: candidate.viral?.engagementsPerHour ?? (
          (Number(candidate.metrics?.likes || 0) + 2 * Number(candidate.metrics?.reposts || candidate.metrics?.retweets || 0)
            + 1.5 * Number(candidate.metrics?.replies || 0))
          / Math.max(0.25, (now - Number(candidate.timestamp || now)) / 3_600_000)),
        observedMetrics: candidate.metrics || {},
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
