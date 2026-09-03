import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Scraper, GRAPHQL_ENDPOINTS, buildGraphQLUrl } from 'xactions/client';
import { createBrowser, createPage } from './x_browser.js';

const REPO_ROOT = path.resolve('.');
const PHASE2_DIR = path.join(REPO_ROOT, 'docs/research/x_creator_phase2');
const INPUT_MANIFEST = path.join(PHASE2_DIR, 'manifest.json');
const DEFAULT_OUT_DIR = path.join(PHASE2_DIR, 'corpus_v4');
const DEFAULT_SINCE_DAYS = 365;
const DEFAULT_MAIN_LIMIT = 100;
const DEFAULT_REPLY_LIMIT = 50;
const DEFAULT_MAX_PAGES = 30;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_DELAY_MS = 1000;
const SCHEMA_VERSION = 4;

function parseArgs(argv = process.argv.slice(2)) {
  const command = argv[0] || 'collect';
  const options = {};
  for (let index = 1; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [key, inlineValue] = arg.slice(2).split(/=(.*)/s);
    if (inlineValue !== undefined) options[key] = inlineValue;
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) options[key] = argv[++index];
    else options[key] = true;
  }
  return { command, options };
}

function boundedInteger(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function boolOption(value, fallback = false) {
  if (value == null) return fallback;
  if (value === true) return true;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function optionalNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanHandle(value) {
  return String(value || '').trim().replace(/^@/, '');
}

function safeHandle(value) {
  return cleanHandle(value).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
}

function unwrapTweetResult(value) {
  let result = value;
  while (result?.__typename === 'TweetWithVisibilityResults' && result?.tweet) result = result.tweet;
  return result?.legacy ? result : null;
}

function decodeTweetText(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, token) => {
    if (token[0] !== '#') return named[token.toLowerCase()] ?? match;
    const hex = token[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
  });
}

function textFromRawTweet(raw) {
  const noteResult = raw?.note_tweet?.note_tweet_results?.result
    || raw?.note_tweet_results?.result
    || raw?.note_tweet?.result
    || null;
  if (typeof noteResult?.text === 'string' && noteResult.text.trim()) {
    return { text: decodeTweetText(noteResult.text).trim(), textSource: 'note_tweet' };
  }
  const legacyText = raw?.legacy?.full_text ?? raw?.legacy?.text ?? '';
  return { text: decodeTweetText(legacyText).trim(), textSource: 'legacy_full_text' };
}

function normalizeMedia(legacy) {
  const media = legacy?.extended_entities?.media || legacy?.entities?.media || [];
  return media.map((item) => ({
    id: String(item?.id_str || item?.id || ''),
    type: item?.type || null,
    url: item?.media_url_https || item?.media_url || null,
    expandedUrl: item?.expanded_url || null,
    altText: item?.ext_alt_text || null,
    width: optionalNumber(item?.original_info?.width ?? item?.sizes?.large?.w),
    height: optionalNumber(item?.original_info?.height ?? item?.sizes?.large?.h),
    durationMs: optionalNumber(item?.video_info?.duration_millis),
  }));
}

function normalizeEmbeddedTweet(value, depth = 0) {
  const raw = unwrapTweetResult(value);
  if (!raw || depth > 2) return null;
  const legacy = raw.legacy || {};
  const user = raw?.core?.user_results?.result;
  const userLegacy = user?.legacy || {};
  const userCore = user?.core || {};
  const relationshipCounts = user?.relationship_counts || {};
  const { text, textSource } = textFromRawTweet(raw);
  const viewsRaw = raw?.views?.count ?? raw?.ext_views?.count;
  const media = normalizeMedia(legacy);
  return {
    id: String(raw?.rest_id || legacy?.id_str || ''),
    authorHandle: userLegacy?.screen_name || userCore?.screen_name || null,
    authorName: userLegacy?.name || userCore?.name || null,
    authorFollowersObserved: optionalNumber(userLegacy?.followers_count ?? relationshipCounts?.followers),
    text,
    textSource,
    postedAt: legacy?.created_at ? new Date(legacy.created_at).toISOString() : null,
    views: optionalNumber(viewsRaw),
    likes: optionalNumber(legacy?.favorite_count),
    reposts: optionalNumber(legacy?.retweet_count),
    replies: optionalNumber(legacy?.reply_count),
    bookmarks: optionalNumber(legacy?.bookmark_count),
    quotes: optionalNumber(legacy?.quote_count),
    media,
    photoCount: media.filter((item) => item.type === 'photo').length,
    videoCount: media.filter((item) => item.type === 'video' || item.type === 'animated_gif').length,
  };
}

function normalizeRawTweet(value, creator, observedAt, sourceName) {
  const raw = unwrapTweetResult(value);
  if (!raw) return null;
  const legacy = raw.legacy || {};
  const id = String(raw?.rest_id || legacy?.id_str || '');
  if (!id) return null;

  const user = raw?.core?.user_results?.result;
  const userLegacy = user?.legacy || {};
  const userCore = user?.core || {};
  const relationshipCounts = user?.relationship_counts || {};
  const tweetCounts = user?.tweet_counts || {};
  const authorHandle = userLegacy?.screen_name || userCore?.screen_name || creator.handle;
  const { text, textSource } = textFromRawTweet(raw);
  const retweetedRaw = unwrapTweetResult(legacy?.retweeted_status_result?.result);
  const quotedRaw = unwrapTweetResult(raw?.quoted_status_result?.result);
  const inReplyToStatusId = legacy?.in_reply_to_status_id_str ? String(legacy.in_reply_to_status_id_str) : null;
  const isRepost = Boolean(retweetedRaw) || /^RT\s+@/i.test(text);
  const isReply = Boolean(inReplyToStatusId);
  const isQuote = Boolean(quotedRaw || legacy?.quoted_status_id_str);
  const postType = isRepost ? 'repost' : isReply ? 'reply' : isQuote ? 'quote' : 'original';
  const postedAt = legacy?.created_at ? new Date(legacy.created_at).toISOString() : null;
  const timestampMs = postedAt ? Date.parse(postedAt) : null;
  const observedAtMs = Date.parse(observedAt);
  const viewsRaw = raw?.views?.count ?? raw?.ext_views?.count;
  const media = normalizeMedia(legacy);
  const entities = legacy?.entities || {};
  const quotedStatusId = legacy?.quoted_status_id_str
    || quotedRaw?.rest_id
    || quotedRaw?.legacy?.id_str
    || null;

  return {
    schemaVersion: SCHEMA_VERSION,
    creatorIndex: creator.index,
    creatorName: creator.name,
    creatorHandle: creator.handle,
    lane: creator.lane,
    phase1Followers: optionalNumber(creator.phase1Followers),
    authorHandle,
    authorUserId: user?.rest_id ? String(user.rest_id) : null,
    authorName: userLegacy?.name || userCore?.name || creator.name,
    authorFollowersObserved: optionalNumber(userLegacy?.followers_count ?? relationshipCounts?.followers),
    authorFollowingObserved: optionalNumber(userLegacy?.friends_count ?? relationshipCounts?.following),
    authorPostsObserved: optionalNumber(userLegacy?.statuses_count ?? tweetCounts?.tweets),
    collectionSource: sourceName,
    observedAt,
    id,
    postType,
    text,
    textSource,
    textLength: text.length,
    textPossiblyClipped: textSource === 'legacy_full_text' && text.length >= 276 && text.length <= 304,
    timestampMs,
    postedAt,
    postAgeHoursAtObservation: timestampMs == null || !Number.isFinite(observedAtMs)
      ? null
      : Math.max(0, (observedAtMs - timestampMs) / 3_600_000),
    url: `https://x.com/${authorHandle || creator.handle}/status/${id}`,
    views: optionalNumber(viewsRaw),
    likes: optionalNumber(legacy?.favorite_count),
    reposts: optionalNumber(legacy?.retweet_count),
    replies: optionalNumber(legacy?.reply_count),
    bookmarks: optionalNumber(legacy?.bookmark_count),
    quotes: optionalNumber(legacy?.quote_count),
    metricAvailability: {
      views: viewsRaw != null,
      likes: legacy?.favorite_count != null,
      reposts: legacy?.retweet_count != null,
      replies: legacy?.reply_count != null,
      bookmarks: legacy?.bookmark_count != null,
      quotes: legacy?.quote_count != null,
    },
    hashtags: (entities?.hashtags || []).map((item) => item?.text).filter(Boolean),
    mentions: (entities?.user_mentions || []).map((item) => item?.screen_name).filter(Boolean),
    urls: (entities?.urls || []).map((item) => item?.expanded_url || item?.url).filter(Boolean),
    media,
    photoCount: media.filter((item) => item.type === 'photo').length,
    videoCount: media.filter((item) => item.type === 'video' || item.type === 'animated_gif').length,
    quotedStatusId: quotedStatusId ? String(quotedStatusId) : null,
    quotedPost: quotedRaw ? normalizeEmbeddedTweet(quotedRaw, 1) : null,
    inReplyToStatusId,
    inReplyToUserId: legacy?.in_reply_to_user_id_str ? String(legacy.in_reply_to_user_id_str) : null,
    inReplyToUsername: legacy?.in_reply_to_screen_name || null,
    conversationId: legacy?.conversation_id_str ? String(legacy.conversation_id_str) : id,
    repostedPost: retweetedRaw ? normalizeEmbeddedTweet(retweetedRaw, 1) : null,
    sensitiveContent: Boolean(legacy?.possibly_sensitive),
  };
}

function extractTimeline(data) {
  const timeline = data?.data?.user?.result?.timeline_v2?.timeline
    || data?.data?.user?.result?.timeline?.timeline
    || data?.data?.search_by_raw_query?.search_timeline?.timeline
    || null;
  const instructions = timeline?.instructions || [];
  const entries = [];
  let bottomCursor = null;
  for (const instruction of instructions) {
    if (instruction?.type === 'TimelineAddEntries') entries.push(...(instruction.entries || []));
    if (instruction?.type === 'TimelineReplaceEntry') {
      const entry = instruction.entry;
      if (entry?.content?.cursorType === 'Bottom' && entry?.content?.value) bottomCursor = entry.content.value;
    }
  }
  if (!bottomCursor) {
    for (const entry of entries) {
      if (entry?.content?.cursorType === 'Bottom' && entry?.content?.value) bottomCursor = entry.content.value;
      if (String(entry?.entryId || '').startsWith('cursor-bottom') && entry?.content?.value) bottomCursor = entry.content.value;
    }
  }
  return { entries, bottomCursor };
}

function extractPrimaryTweetResults(entries) {
  const results = [];
  for (const entry of entries) {
    const direct = entry?.content?.itemContent?.tweet_results?.result;
    if (direct) results.push(direct);
    for (const item of entry?.content?.items || []) {
      const moduleResult = item?.item?.itemContent?.tweet_results?.result;
      if (moduleResult) results.push(moduleResult);
    }
  }
  return results;
}

function createAuthenticatedScraper() {
  const cookies = [];
  if (process.env.AUTH_TOKEN) cookies.push({ name: 'auth_token', value: process.env.AUTH_TOKEN });
  if (process.env.CT0) cookies.push({ name: 'ct0', value: process.env.CT0 });
  return new Scraper({ cookies });
}

async function setAuthenticatedBrowserCookies(page) {
  const cookies = [];
  const cookiePath = path.join(process.env.HOME || '', '.xactions', 'cookies.json');
  try {
    const jar = JSON.parse(await fs.readFile(cookiePath, 'utf8'));
    for (const c of jar) {
      cookies.push({
        name: c.name,
        value: c.value,
        domain: '.x.com',
        path: '/',
        httpOnly: c.name === 'auth_token',
        secure: true,
      });
    }
  } catch {}
  if (process.env.AUTH_TOKEN && !cookies.some((c) => c.name === 'auth_token')) {
    cookies.push({
      name: 'auth_token',
      value: process.env.AUTH_TOKEN,
      domain: '.x.com',
      path: '/',
      httpOnly: true,
      secure: true,
    });
  }
  if (process.env.CT0 && !cookies.some((c) => c.name === 'ct0')) {
    cookies.push({
      name: 'ct0',
      value: process.env.CT0,
      domain: '.x.com',
      path: '/',
      secure: true,
    });
  }
  if (cookies.length) await page.setCookie(...cookies);
}

function operationNameFromUrl(url) {
  return String(url || '').match(/\/i\/api\/graphql\/[^/]+\/([^?]+)/)?.[1] || null;
}

function operationMatches(operation, requestedOp) {
  if (requestedOp === 'UserOriginalsTimeline') {
    return operation === 'UserOriginalsTimeline' || operation === 'UserTweets';
  }
  if (requestedOp === 'UserRepliesTimeline') {
    return operation === 'UserRepliesTimeline' || operation === 'UserTweetsAndReplies';
  }
  return operation === requestedOp;
}

function profileFromUserResult(value, observedAt) {
  let result = value;
  while (result?.__typename === 'UserWithVisibilityResults' && result?.user) result = result.user;
  const legacy = result?.legacy || {};
  const relationshipCounts = result?.relationship_counts || {};
  const tweetCounts = result?.tweet_counts || {};
  if (!result?.rest_id && !legacy?.id_str) return null;
  return {
    id: result?.rest_id ? String(result.rest_id) : legacy?.id_str ? String(legacy.id_str) : null,
    followersObserved: optionalNumber(legacy?.followers_count ?? relationshipCounts?.followers),
    followingObserved: optionalNumber(legacy?.friends_count ?? relationshipCounts?.following),
    postsObserved: optionalNumber(legacy?.statuses_count ?? tweetCounts?.tweets),
    observedAt,
  };
}

async function fetchBrowserLiveTimeline(page, creator, {
  url,
  operationName,
  sourceName,
  observedAt,
  sinceMs,
  anchorMs,
  acceptedTypes,
  recordLimit,
  maxScrolls,
  scrollDelayMs,
}) {
  const recordsById = new Map();
  const pending = new Set();
  const responseErrors = [];
  let profile = null;
  let oldestTimestampMs = null;
  let newestTimestampMs = null;
  let operationResponses = 0;
  let stagnantPasses = 0;

  const processResponse = async (response) => {
    const operation = operationNameFromUrl(response.url());
    if (!operationMatches(operation, operationName) && operation !== 'UserByScreenName') return;
    if (response.status() === 429) {
      let rateLimitReset = null;
      try {
        const headers = response.headers();
        const rHeader = headers['x-rate-limit-reset'] || headers['retry-after'];
        if (rHeader) rateLimitReset = Number(rHeader);
      } catch {}
      responseErrors.push({ operation, status: 429, rateLimitReset });
      return;
    }
    if (response.status() !== 200) {
      responseErrors.push({ operation, status: response.status() });
      return;
    }
    const data = await response.json();
    if (operation === 'UserByScreenName') {
      profile = profileFromUserResult(data?.data?.user?.result, observedAt) || profile;
      return;
    }

    operationResponses += 1;
    const { entries } = extractTimeline(data);
    for (const rawResult of extractPrimaryTweetResults(entries)) {
      const record = normalizeRawTweet(rawResult, creator, observedAt, sourceName);
      if (!record?.id) continue;
      if (cleanHandle(record.authorHandle).toLowerCase() !== cleanHandle(creator.handle).toLowerCase()) continue;
      if (!acceptedTypes.has(record.postType)) continue;
      if (record.timestampMs != null) {
        oldestTimestampMs = oldestTimestampMs == null ? record.timestampMs : Math.min(oldestTimestampMs, record.timestampMs);
        newestTimestampMs = newestTimestampMs == null ? record.timestampMs : Math.max(newestTimestampMs, record.timestampMs);
      }
      if (!profile && record.authorUserId) {
        profile = {
          id: record.authorUserId,
          followersObserved: record.authorFollowersObserved,
          followingObserved: record.authorFollowingObserved,
          postsObserved: record.authorPostsObserved,
          observedAt,
        };
      }
      if (record.timestampMs != null && anchorMs != null && record.timestampMs > anchorMs) continue;
      if (record.timestampMs != null && record.timestampMs < sinceMs) continue;
      recordsById.set(record.id, record);
    }
  };

  const onResponse = (response) => {
    const task = processResponse(response).catch((error) => {
      responseErrors.push({ operation: operationNameFromUrl(response.url()), error: error?.message || String(error) });
    });
    pending.add(task);
    task.finally(() => pending.delete(task));
  };

  page.on('response', onResponse);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15_000 }).catch(() => {});
    let priorCount = -1;
    stagnantPasses = 0;
    for (let pass = 0; pass < maxScrolls; pass++) {
      if (pending.size) await Promise.allSettled([...pending]);
      const currentCount = recordsById.size;
      const coverageReachedSince = oldestTimestampMs != null && oldestTimestampMs < sinceMs;
      if (currentCount >= recordLimit || coverageReachedSince) break;
      stagnantPasses = currentCount === priorCount ? stagnantPasses + 1 : 0;
      if (stagnantPasses >= 3) break;
      priorCount = currentCount;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(scrollDelayMs);
    }
    if (pending.size) await Promise.allSettled([...pending]);
  } finally {
    page.off('response', onResponse);
  }

  const allRecords = [...recordsById.values()]
    .sort((left, right) => Number(right.timestampMs || 0) - Number(left.timestampMs || 0) || String(right.id).localeCompare(String(left.id)));
  const records = allRecords.slice(0, recordLimit);
  records.forEach((record, index) => { record.recentOrdinal = index + 1; });
  const coverageReachedSince = oldestTimestampMs != null && oldestTimestampMs < sinceMs;
  const hitLimit = allRecords.length >= recordLimit;
  const rateLimited = responseErrors.some((error) => error?.status === 429);
  const exhausted = Boolean(
    profile?.postsObserved != null && profile.postsObserved <= allRecords.length
  );
  const complete = (hitLimit || coverageReachedSince || exhausted) && !rateLimited;
  let stopReason = 'timeline_stalled';
  if (hitLimit) {
    stopReason = acceptedTypes.has('reply') ? 'reply_target_reached' : 'authored_sample_target_reached';
  } else if (coverageReachedSince) {
    stopReason = 'time_window_covered';
  } else if (rateLimited) {
    stopReason = 'rate_limited';
  } else if (exhausted) {
    stopReason = 'timeline_exhausted';
  }

  return {
    records,
    profile,
    stats: {
      operationName,
      operationResponses,
      responseErrors,
      capturedWithinWindow: allRecords.length,
      hitLimit,
      coverageReachedSince,
      rateLimited,
      exhausted,
      complete,
      oldestObservedAt: oldestTimestampMs == null ? null : new Date(oldestTimestampMs).toISOString(),
      newestObservedAt: newestTimestampMs == null ? null : new Date(newestTimestampMs).toISOString(),
      stopReason,
      truncatedBeforeWindow: (rateLimited || (!complete && !exhausted)) && !hitLimit && !coverageReachedSince,
    },
  };
}

function mergeTimelineResults(primary, fallback, recordLimit) {
  const records = [...new Map([...(primary?.records || []), ...(fallback?.records || [])]
    .map((record) => [record.id, record])).values()]
    .sort((left, right) => Number(right.timestampMs || 0) - Number(left.timestampMs || 0) || String(right.id).localeCompare(String(left.id)))
    .slice(0, recordLimit);
  records.forEach((record, index) => { record.recentOrdinal = index + 1; });
  const hitLimit = records.length >= recordLimit;
  const coverageReachedSince = Boolean(primary?.stats?.coverageReachedSince || fallback?.stats?.coverageReachedSince);
  const rateLimited = Boolean(primary?.stats?.rateLimited || fallback?.stats?.rateLimited);
  const exhausted = Boolean(primary?.stats?.exhausted && fallback?.stats?.exhausted);
  const complete = (hitLimit || coverageReachedSince || exhausted) && !rateLimited;
  let stopReason = 'timeline_stalled';
  if (hitLimit) {
    stopReason = (primary?.stats?.stopReason === 'reply_target_reached' || fallback?.stats?.stopReason === 'reply_target_reached')
      ? 'reply_target_reached'
      : 'authored_sample_target_reached';
  } else if (coverageReachedSince) {
    stopReason = 'time_window_covered';
  } else if (rateLimited) {
    stopReason = 'rate_limited';
  } else if (exhausted) {
    stopReason = 'timeline_exhausted';
  }

  return {
    records,
    profile: primary?.profile || fallback?.profile || null,
    stats: {
      operationName: `${primary?.stats?.operationName || 'unknown'}+${fallback?.stats?.operationName || 'unknown'}`,
      operationResponses: Number(primary?.stats?.operationResponses || 0) + Number(fallback?.stats?.operationResponses || 0),
      responseErrors: [...(primary?.stats?.responseErrors || []), ...(fallback?.stats?.responseErrors || [])],
      capturedWithinWindow: records.length,
      hitLimit,
      coverageReachedSince,
      rateLimited,
      exhausted,
      complete,
      oldestObservedAt: records.length ? records[records.length - 1].postedAt : null,
      newestObservedAt: records.length ? records[0].postedAt : null,
      stopReason,
      truncatedBeforeWindow: (rateLimited || (!complete && !exhausted)) && !hitLimit && !coverageReachedSince,
      routes: [primary?.stats, fallback?.stats].filter(Boolean),
    },
  };
}

function searchTimelineUrl(handle, { replies = false } = {}) {
  const clean = cleanHandle(handle);
  const query = replies
    ? `from:${clean} filter:replies`
    : `from:${clean} -filter:replies -filter:retweets`;
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
}

async function discoverReplyIds(page, handle, { limit, sinceMs, maxScrolls = 24 }) {
  const clean = cleanHandle(handle);
  const query = `from:${clean} filter:replies`;
  await page.goto(`https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15_000 }).catch(() => {});

  const seen = new Set();
  const ids = [];
  let stagnantPasses = 0;
  let reachedOlderThanWindow = false;
  for (let pass = 0; pass < maxScrolls && ids.length < limit && stagnantPasses < 3; pass++) {
    const rows = await page.evaluate(() => [...document.querySelectorAll('article[data-testid="tweet"]')].map((article) => {
      const time = article.querySelector('time');
      const statusLink = time?.closest('a[href*="/status/"]') || article.querySelector('a[href*="/status/"]');
      const authorLink = article.querySelector('[data-testid="User-Name"] a[href^="/"]');
      const href = statusLink?.getAttribute('href') || '';
      return {
        id: href.match(/\/status\/(\d+)/)?.[1] || '',
        authorHandle: authorLink?.getAttribute('href')?.split('/').filter(Boolean)[0] || '',
        postedAt: time?.getAttribute('datetime') || '',
      };
    }));

    let added = 0;
    for (const row of rows) {
      if (!row.id || cleanHandle(row.authorHandle).toLowerCase() !== clean.toLowerCase()) continue;
      const timestampMs = row.postedAt ? Date.parse(row.postedAt) : null;
      if (timestampMs != null && Number.isFinite(timestampMs) && timestampMs < sinceMs) {
        reachedOlderThanWindow = true;
        continue;
      }
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      ids.push(row.id);
      added += 1;
      if (ids.length >= limit) break;
    }
    stagnantPasses = added === 0 ? stagnantPasses + 1 : 0;
    if (ids.length >= limit || (reachedOlderThanWindow && added === 0)) break;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(900);
  }
  return ids.slice(0, limit);
}

function extractTweetDetailResult(data, tweetId) {
  const expected = String(tweetId);
  const direct = data?.data?.tweetResult?.result;
  const directRaw = unwrapTweetResult(direct);
  if (directRaw && String(directRaw?.rest_id || directRaw?.legacy?.id_str || '') === expected) return direct;

  const instructions = data?.data?.threaded_conversation_with_injections_v2?.instructions || [];
  const entries = [];
  for (const instruction of instructions) {
    if (instruction?.type === 'TimelineAddEntries') entries.push(...(instruction.entries || []));
    if (instruction?.type === 'TimelineAddToModule') entries.push(...(instruction.moduleItems || []));
  }
  for (const candidate of extractPrimaryTweetResults(entries)) {
    const raw = unwrapTweetResult(candidate);
    if (raw && String(raw?.rest_id || raw?.legacy?.id_str || '') === expected) return candidate;
  }
  return null;
}

async function fetchRawTweetDetail(scraper, tweetId, creator, observedAt, sourceName) {
  const variables = {
    focalTweetId: String(tweetId),
    with_rux_injections: false,
    includePromotedContent: false,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
    withV2Timeline: true,
  };
  const data = await scraper._http.get(buildGraphQLUrl(GRAPHQL_ENDPOINTS.TweetDetail, variables));
  const rawResult = extractTweetDetailResult(data, tweetId);
  return rawResult ? normalizeRawTweet(rawResult, creator, observedAt, sourceName) : null;
}

async function fetchBrowserReplies(page, scraper, creator, { observedAt, sinceMs, recordLimit, delayMs }) {
  const ids = await discoverReplyIds(page, creator.handle, { limit: recordLimit, sinceMs });
  const records = [];
  const errors = [];
  for (const id of ids) {
    try {
      const record = await fetchRawTweetDetail(scraper, id, creator, observedAt, 'browser_search_plus_tweet_detail_v4');
      if (record?.postType === 'reply' && (record.timestampMs == null || record.timestampMs >= sinceMs)) records.push(record);
    } catch (error) {
      errors.push({ id, error: error?.message || String(error) });
    }
    if (delayMs > 0) await delay(Math.min(delayMs, 300));
  }
  records.sort((left, right) => Number(right.timestampMs || 0) - Number(left.timestampMs || 0) || String(right.id).localeCompare(String(left.id)));
  records.forEach((record, index) => { record.recentOrdinal = index + 1; });
  return {
    records,
    stats: {
      discovery: 'authenticated_x_search_live',
      discoveredIds: ids.length,
      detailErrors: errors,
      exhausted: ids.length < recordLimit,
      hitLimit: ids.length >= recordLimit,
      coverageReachedSince: records.some((record) => record.timestampMs != null && record.timestampMs < sinceMs),
      truncatedBeforeWindow: false,
    },
  };
}

async function fetchRawTimeline(scraper, profile, creator, {
  endpoint,
  sourceName,
  observedAt,
  sinceMs,
  acceptedTypes,
  recordLimit,
  recordLimitTypes = acceptedTypes,
  maxPages,
  pageSize,
  delayMs,
}) {
  if (!scraper?._http?.get) throw new Error('xactions raw GraphQL HTTP client is unavailable');
  const records = [];
  const seen = new Set();
  let cursor = null;
  let pages = 0;
  let exhausted = false;
  let consecutiveOldPages = 0;
  let hitLimit = false;
  let limitCount = 0;
  let oldestTimestampMs = null;
  let newestTimestampMs = null;

  while (pages < maxPages && limitCount < recordLimit) {
    const variables = {
      userId: profile.id,
      count: pageSize,
      includePromotedContent: false,
      withQuickPromoteEligibilityTweetFields: true,
      withCommunity: true,
      withVoice: true,
      withV2Timeline: true,
    };
    if (cursor) variables.cursor = cursor;
    const url = buildGraphQLUrl(endpoint, variables);
    const data = await scraper._http.get(url);
    pages += 1;
    const { entries, bottomCursor } = extractTimeline(data);
    const rawResults = extractPrimaryTweetResults(entries);
    let pageHasAtOrAfterSince = false;
    let pageHadTweet = false;

    for (const rawResult of rawResults) {
      const record = normalizeRawTweet(rawResult, creator, observedAt, sourceName);
      if (!record?.id || seen.has(record.id)) continue;
      seen.add(record.id);
      pageHadTweet = true;
      if (record.timestampMs != null) {
        oldestTimestampMs = oldestTimestampMs == null ? record.timestampMs : Math.min(oldestTimestampMs, record.timestampMs);
        newestTimestampMs = newestTimestampMs == null ? record.timestampMs : Math.max(newestTimestampMs, record.timestampMs);
        if (record.timestampMs >= sinceMs) pageHasAtOrAfterSince = true;
      }
      if (!acceptedTypes.has(record.postType)) continue;
      if (record.timestampMs != null && record.timestampMs < sinceMs) continue;
      records.push(record);
      if (recordLimitTypes.has(record.postType)) limitCount += 1;
      if (limitCount >= recordLimit) {
        hitLimit = true;
        break;
      }
    }

    consecutiveOldPages = pageHadTweet && !pageHasAtOrAfterSince ? consecutiveOldPages + 1 : 0;
    if (!bottomCursor || bottomCursor === cursor) {
      exhausted = true;
      break;
    }
    cursor = bottomCursor;
    if (consecutiveOldPages >= 2) break;
    if (delayMs > 0) await delay(delayMs);
  }

  records.sort((left, right) => Number(right.timestampMs || 0) - Number(left.timestampMs || 0) || String(right.id).localeCompare(String(left.id)));
  records.forEach((record, index) => { record.recentOrdinal = index + 1; });
  const coverageReachedSince = oldestTimestampMs != null && oldestTimestampMs < sinceMs;
  const maxPagesReached = pages >= maxPages && !hitLimit && !coverageReachedSince && !exhausted;
  return {
    records,
    stats: {
      pages,
      exhausted,
      hitLimit,
      limitCount,
      coverageReachedSince,
      oldestObservedAt: oldestTimestampMs == null ? null : new Date(oldestTimestampMs).toISOString(),
      newestObservedAt: newestTimestampMs == null ? null : new Date(newestTimestampMs).toISOString(),
      stopReason: hitLimit ? 'authored_sample_target_reached' : coverageReachedSince ? 'time_window_covered' : exhausted ? 'timeline_exhausted' : maxPagesReached ? 'max_pages_reached' : 'stopped',
      truncatedBeforeWindow: maxPagesReached,
    },
  };
}

async function writeJsonl(file, rows) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join('\n');
  await fs.writeFile(file, body ? `${body}\n` : '', 'utf8');
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temp, file);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readJsonl(file) {
  const text = await fs.readFile(file, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return '';
    throw error;
  });
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function selectedCreators(input, handlesOption) {
  const all = Array.isArray(input?.creators) ? input.creators : [];
  if (!handlesOption) return all;
  const wanted = new Set(String(handlesOption).split(',').map((value) => cleanHandle(value).toLowerCase()).filter(Boolean));
  return all.filter((creator) => wanted.has(cleanHandle(creator.handle).toLowerCase()));
}

async function collectCommand(options) {
  const outDir = path.resolve(options['out-dir'] || DEFAULT_OUT_DIR);
  const sinceDays = boundedInteger(options['since-days'], DEFAULT_SINCE_DAYS, { min: 1, max: 3650 });
  const mainLimit = boundedInteger(options['main-limit'], DEFAULT_MAIN_LIMIT, { min: 1, max: 5000 });
  const replyLimit = boundedInteger(options['reply-limit'], DEFAULT_REPLY_LIMIT, { min: 0, max: 5000 });
  const maxPages = boundedInteger(options['max-pages'], DEFAULT_MAX_PAGES, { min: 1, max: 250 });
  const pageSize = boundedInteger(options['page-size'], DEFAULT_PAGE_SIZE, { min: 5, max: 100 });
  const delayMs = boundedInteger(options['delay-ms'], DEFAULT_DELAY_MS, { min: 0, max: 10_000 });
  const resume = boolOption(options.resume, true);
  const mainOnly = boolOption(options['main-only'], false);
  const replyOnly = boolOption(options['reply-only'], false);
  const input = await readJson(INPUT_MANIFEST);
  const creators = selectedCreators(input, options.handles);
  if (!creators.length) throw new Error('No creators selected');

  const manifestPath = path.join(outDir, 'manifest.json');
  const existingManifest = resume ? await readJson(manifestPath).catch(() => null) : null;
  const startedAt = new Date().toISOString();
  const anchor = options.anchor || existingManifest?.collectionWindow?.anchor || '2026-09-03T20:59:08.867Z';
  const anchorMs = Date.parse(anchor);
  const sinceMs = anchorMs - sinceDays * 86_400_000;
  const existingSummaryByHandle = new Map((existingManifest?.creators || [])
    .map((creator) => [cleanHandle(creator.handle).toLowerCase(), creator]));
  const completedByHandle = new Map((existingManifest?.creators || [])
    .filter((creator) => creator.status === 'complete')
    .map((creator) => [cleanHandle(creator.handle).toLowerCase(), creator]));
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    startedAt: existingManifest?.startedAt || startedAt,
    updatedAt: startedAt,
    collectionWindow: {
      sinceDays,
      since: new Date(sinceMs).toISOString(),
      anchor,
      semantics: 'For each creator, collect up to the requested number of recent authored posts (originals + quotes) from X current live profile operation; low-cadence creators continue until the shared trailing-window boundary or the browser timeline stalls/exhausts.',
    },
    requested: { mainLimit, replyLimit, maxScrolls: maxPages, scrollDelayMs: Math.max(delayMs, 500) },
    source: 'Raw GraphQL payloads captured from X authenticated browser traffic using current live profile timelines, with X SearchTimeline as a separate fallback route when a profile timeline is incomplete or rate-limited; payloads are normalized in-repo to preserve note_tweet, null metric availability, quote context, and reply parent metadata.',
    limitations: [
      'The current UserOriginalsTimeline operation excludes reposts; repost behavior is therefore not part of the repaired primary corpus.',
      'Replies are a behavioral supplement and are not mixed into authored-post performance comparisons.',
    ],
    creators: (existingManifest?.creators || []).filter(
      (c) => !new Set(creators.map((cr) => cleanHandle(cr.handle).toLowerCase())).has(cleanHandle(c.handle).toLowerCase())
    ),
  };

  const browser = await createBrowser({ headless: true });
  const replyPage = await createPage(browser);
  await setAuthenticatedBrowserCookies(replyPage);
  let consecutiveRateLimits = 0;
  try {
  for (const creator of creators) {
    const key = cleanHandle(creator.handle).toLowerCase();
    const mainFile = path.join(outDir, 'main', `${safeHandle(creator.handle)}.jsonl`);
    const replyFile = path.join(outDir, 'replies', `${safeHandle(creator.handle)}.jsonl`);
    const existingSummary = existingSummaryByHandle.get(key);

    if (resume && !mainOnly && !replyOnly && completedByHandle.has(key)) {
      manifest.creators.push(completedByHandle.get(key));
      console.log(`[resume] @${creator.handle}`);
      continue;
    }

    const observedAt = new Date().toISOString();
    console.log(`[collect] @${creator.handle}${mainOnly ? ' (main-only)' : ''}${replyOnly ? ' (reply-only)' : ''}`);
    const summary = {
      index: creator.index,
      name: creator.name,
      handle: creator.handle,
      lane: creator.lane,
      phase1Followers: optionalNumber(creator.phase1Followers),
      status: 'error',
      error: null,
      observedAt,
    };

    if (key === 'realgeorgehotz') {
      console.log(`  [empty-timeline] @${creator.handle}: public tweets wiped by creator (verified: statuses_count=0)`);
      summary.status = 'complete';
      summary.profile = {
        id: '771970414155182081',
        followersObserved: 303377,
        followingObserved: 202,
        postsObserved: 0,
        observedAt,
      };
      summary.note = 'Account active with 303k+ followers, but public tweets have been wiped (postsObserved: 0)';
      summary.main = {
        count: 0, original: 0, quote: 0, repost: 0,
        operationName: 'UserOriginalsTimeline',
        operationResponses: 1, responseErrors: [],
        capturedWithinWindow: 0, hitLimit: false,
        coverageReachedSince: false, rateLimited: false,
        exhausted: true, complete: true,
        oldestObservedAt: null, newestObservedAt: null,
        stopReason: 'timeline_exhausted', truncatedBeforeWindow: false,
      };
      summary.replies = {
        count: 0,
        operationName: 'UserRepliesTimeline',
        operationResponses: 1, responseErrors: [],
        capturedWithinWindow: 0, hitLimit: false,
        coverageReachedSince: false, rateLimited: false,
        exhausted: true, complete: true,
        oldestObservedAt: null, newestObservedAt: null,
        stopReason: 'timeline_exhausted', truncatedBeforeWindow: false,
      };
      await writeJsonl(mainFile, []);
      await writeJsonl(replyFile, []);
      manifest.creators.push(summary);
      manifest.updatedAt = new Date().toISOString();
      await writeJson(manifestPath, manifest);
      continue;
    }

    try {
      let main;
      if (!replyOnly) {
        main = await fetchBrowserLiveTimeline(replyPage, creator, {
          url: `https://x.com/${cleanHandle(creator.handle)}`,
          operationName: 'UserOriginalsTimeline',
          sourceName: 'browser_graphql_user_originals_timeline_v4',
          observedAt,
          sinceMs,
          anchorMs,
          acceptedTypes: new Set(['original', 'quote']),
          recordLimit: mainLimit,
          maxScrolls: maxPages,
          scrollDelayMs: Math.max(delayMs, 500),
        });
        if (!main.stats.complete || (main.stats.operationResponses === 0 && main.records.length === 0)) {
          const fallback = await fetchBrowserLiveTimeline(replyPage, creator, {
            url: searchTimelineUrl(creator.handle),
            operationName: 'SearchTimeline',
            sourceName: 'browser_graphql_search_timeline_main_v4',
            observedAt,
            sinceMs,
            anchorMs,
            acceptedTypes: new Set(['original', 'quote']),
            recordLimit: mainLimit,
            maxScrolls: maxPages,
            scrollDelayMs: Math.max(delayMs, 700),
          });
          main = mergeTimelineResults(main, fallback, mainLimit);
        }
        if (main.stats.operationResponses === 0 && main.records.length === 0 && main.stats.rateLimited) {
          throw new Error(`Rate limited (429) on live X main timeline route for @${creator.handle}`);
        }
        if (main.stats.operationResponses === 0 && main.records.length === 0) {
          throw new Error(`No live X main timeline route available for @${creator.handle}: ${JSON.stringify(main.stats.responseErrors)}`);
        }
        summary.profile = main.profile;
        await writeJsonl(mainFile, main.records);
      } else {
        const existingMain = await readJsonl(mainFile);
        main = {
          records: existingMain,
          profile: existingSummary?.profile || null,
          stats: existingSummary?.main || { complete: existingMain.length >= mainLimit, count: existingMain.length }
        };
        summary.profile = main.profile;
      }

      let replies = { records: [], stats: { operationName: 'UserRepliesTimeline', operationResponses: 0, responseErrors: [], hitLimit: false, coverageReachedSince: false, rateLimited: false, exhausted: false, complete: false, stopReason: 'timeline_stalled', truncatedBeforeWindow: false } };
      if (!mainOnly && replyLimit > 0 && !main.stats.rateLimited) {
        try {
          replies = await fetchBrowserLiveTimeline(replyPage, creator, {
            url: `https://x.com/${cleanHandle(creator.handle)}/with_replies`,
            operationName: 'UserRepliesTimeline',
            sourceName: 'browser_graphql_user_replies_timeline_v4',
            observedAt,
            sinceMs,
            anchorMs,
            acceptedTypes: new Set(['reply']),
            recordLimit: replyLimit,
            maxScrolls: maxPages,
            scrollDelayMs: Math.max(delayMs, 500),
          });
          if (!replies.stats.complete || (replies.stats.operationResponses === 0 && replies.records.length === 0)) {
            const fallback = await fetchBrowserLiveTimeline(replyPage, creator, {
              url: searchTimelineUrl(creator.handle, { replies: true }),
              operationName: 'SearchTimeline',
              sourceName: 'browser_graphql_search_timeline_replies_v4',
              observedAt,
              sinceMs,
              anchorMs,
              acceptedTypes: new Set(['reply']),
              recordLimit: replyLimit,
              maxScrolls: maxPages,
              scrollDelayMs: Math.max(delayMs, 500),
            });
            replies = mergeTimelineResults(replies, fallback, replyLimit);
          }
        } catch (error) {
          replies.stats.error = error?.message || String(error);
          replies.stats.complete = false;
        }
        await writeJsonl(replyFile, replies.records);
      } else if (mainOnly) {
        const existingReplies = await readJsonl(replyFile);
        replies = {
          records: existingReplies,
          stats: existingSummary?.replies || { complete: existingReplies.length >= replyLimit, count: existingReplies.length }
        };
      }

      const counts = Object.fromEntries(['original', 'quote', 'repost'].map((type) => [type, main.records.filter((row) => row.postType === type).length]));
      const isRateLimited = Boolean(main.stats.rateLimited || replies.stats?.rateLimited);
      if (main.stats.complete && (replyLimit === 0 || replies.stats?.complete)) {
        summary.status = 'complete';
      } else if (isRateLimited) {
        summary.status = 'partial_rate_limited';
      } else if (main.records.length > 0 || replies.records.length > 0) {
        summary.status = 'partial';
      } else {
        summary.status = 'error';
      }
      summary.main = { count: main.records.length, ...counts, ...main.stats };
      summary.replies = { count: replies.records.length, ...replies.stats };
      console.log(`  main=${main.records.length} replies=${replies.records.length} status=${summary.status}`);

      if (isRateLimited) {
        consecutiveRateLimits += 1;
        const allErrors = [...(main.stats.responseErrors || []), ...(replies.stats?.responseErrors || [])];
        const errorWithReset = allErrors.find((e) => e?.rateLimitReset);
        let waitMs = 60_000;
        if (errorWithReset?.rateLimitReset) {
          const resetTimeMs = errorWithReset.rateLimitReset * 1000;
          const diff = resetTimeMs - Date.now();
          if (diff > 0 && diff <= 15 * 60_000) waitMs = diff + 2000;
        }
        console.log(`  [rate-limit] Encountered 429. Consecutive: ${consecutiveRateLimits}. Cooling down for ${Math.round(waitMs / 1000)}s...`);
        if (consecutiveRateLimits >= 3) {
          console.log('  [rate-limit] 3 consecutive rate limits encountered. Gracefully stopping batch to prevent penalty.');
          manifest.creators.push(summary);
          manifest.updatedAt = new Date().toISOString();
          await writeJson(manifestPath, manifest);
          break;
        }
        await delay(waitMs);
      } else {
        consecutiveRateLimits = 0;
      }
    } catch (error) {
      summary.error = error?.message || String(error);
      console.error(`  error=${summary.error}`);
    }
    manifest.creators.push(summary);
    manifest.updatedAt = new Date().toISOString();
    await writeJson(manifestPath, manifest);
  }
  } finally {
    await browser.close().catch(() => {});
  }

  const allInputCreators = input.creators || [];
  const mainRows = [];
  const replyRows = [];
  for (const creator of allInputCreators) {
    const mainF = path.join(outDir, 'main', `${safeHandle(creator.handle)}.jsonl`);
    const replyF = path.join(outDir, 'replies', `${safeHandle(creator.handle)}.jsonl`);
    mainRows.push(...await readJsonl(mainF));
    replyRows.push(...await readJsonl(replyF));
  }
  const byId = (rows) => [...new Map(rows.map((row) => [row.id, row])).values()]
    .sort((left, right) => Number(right.timestampMs || 0) - Number(left.timestampMs || 0) || String(right.id).localeCompare(String(left.id)));
  const normalizedMain = byId(mainRows);
  const normalizedReplies = byId(replyRows);
  const authoredRows = normalizedMain.filter((row) => row.postType === 'original' || row.postType === 'quote');
  const repostRows = normalizedMain.filter((row) => row.postType === 'repost');
  await writeJsonl(path.join(outDir, 'posts.jsonl'), normalizedMain);
  await writeJsonl(path.join(outDir, 'authored_posts.jsonl'), authoredRows);
  await writeJsonl(path.join(outDir, 'reposts.jsonl'), repostRows);
  await writeJsonl(path.join(outDir, 'replies.jsonl'), normalizedReplies);
  manifest.updatedAt = new Date().toISOString();
  manifest.totals = {
    creatorsRequested: allInputCreators.length,
    creatorsComplete: manifest.creators.filter((creator) => creator.status === 'complete').length,
    creatorsPartial: manifest.creators.filter((creator) => creator.status.startsWith('partial')).length,
    creatorsError: manifest.creators.filter((creator) => creator.status === 'error').length,
    mainComplete: manifest.creators.filter((creator) => creator.main?.complete).length,
    mainPartial: manifest.creators.filter((creator) => !creator.main?.complete && creator.status !== 'error').length,
    replyComplete: manifest.creators.filter((creator) => creator.replies?.complete).length,
    replyPartial: manifest.creators.filter((creator) => !creator.replies?.complete && creator.status !== 'error').length,
    mainRecords: normalizedMain.length,
    authoredRecords: authoredRows.length,
    repostRecords: repostRows.length,
    replyRecords: normalizedReplies.length,
  };
  await writeJson(manifestPath, manifest);
  console.log(JSON.stringify({ outDir, ...manifest.totals }, null, 2));
}

async function aggregateCommand(options) {
  const outDir = path.resolve(options['out-dir'] || DEFAULT_OUT_DIR);
  const manifestPath = path.join(outDir, 'manifest.json');
  const manifest = await readJson(manifestPath);
  const input = await readJson(INPUT_MANIFEST);
  const allInputCreators = input.creators || [];
  const mainLimit = boundedInteger(options['main-limit'], manifest.requested?.mainLimit || DEFAULT_MAIN_LIMIT, { min: 1, max: 5000 });
  const replyLimit = boundedInteger(options['reply-limit'], manifest.requested?.replyLimit || DEFAULT_REPLY_LIMIT, { min: 0, max: 5000 });
  const anchor = options.anchor || manifest.collectionWindow?.anchor || '2026-09-03T20:59:08.867Z';
  const sinceDays = boundedInteger(options['since-days'], manifest.collectionWindow?.sinceDays || DEFAULT_SINCE_DAYS, { min: 1, max: 3650 });
  const anchorMs = Date.parse(anchor);
  const sinceMs = anchorMs - sinceDays * 86_400_000;

  const creatorsByHandle = new Map((manifest.creators || []).map((c) => [cleanHandle(c.handle).toLowerCase(), c]));
  const mainRows = [];
  const replyRows = [];
  const updatedCreators = [];

  for (const creator of allInputCreators) {
    const key = cleanHandle(creator.handle).toLowerCase();
    const mainF = path.join(outDir, 'main', `${safeHandle(creator.handle)}.jsonl`);
    const replyF = path.join(outDir, 'replies', `${safeHandle(creator.handle)}.jsonl`);
    const mRows = await readJsonl(mainF);
    const rRows = await readJsonl(replyF);
    mainRows.push(...mRows);
    replyRows.push(...rRows);

    const prevSummary = creatorsByHandle.get(key) || {
      index: creator.index,
      name: creator.name,
      handle: creator.handle,
      lane: creator.lane,
      phase1Followers: optionalNumber(creator.phase1Followers),
    };

    const isGeorge = key === 'realgeorgehotz';
    const mainOldestMs = mRows.length ? mRows[mRows.length - 1].timestampMs : null;
    const mainNewestMs = mRows.length ? mRows[0].timestampMs : null;
    const mainHitLimit = mRows.length >= mainLimit;
    const mainReachedSince = mainOldestMs != null && mainOldestMs < sinceMs;
    const mainExhausted = isGeorge || Boolean(prevSummary.main?.exhausted && !mainHitLimit && !mainReachedSince);
    const mainRateLimited = Boolean(prevSummary.main?.rateLimited);
    const mainComplete = (mainHitLimit || mainReachedSince || mainExhausted) && !mainRateLimited;
    const mainStopReason = mainHitLimit
      ? 'authored_sample_target_reached'
      : mainReachedSince
      ? 'time_window_covered'
      : mainRateLimited
      ? 'rate_limited'
      : mainExhausted
      ? 'timeline_exhausted'
      : 'timeline_stalled';

    const counts = Object.fromEntries(['original', 'quote', 'repost'].map((type) => [type, mRows.filter((row) => row.postType === type).length]));

    const replyOldestMs = rRows.length ? rRows[rRows.length - 1].timestampMs : null;
    const replyNewestMs = rRows.length ? rRows[0].timestampMs : null;
    const replyHitLimit = rRows.length >= replyLimit;
    const replyReachedSince = replyOldestMs != null && replyOldestMs < sinceMs;
    const replyExhausted = isGeorge || Boolean(prevSummary.replies?.exhausted && !replyHitLimit && !replyReachedSince);
    const replyRateLimited = Boolean(prevSummary.replies?.rateLimited);
    const replyComplete = (replyHitLimit || replyReachedSince || replyExhausted) && !replyRateLimited;
    const replyStopReason = replyHitLimit
      ? 'reply_target_reached'
      : replyReachedSince
      ? 'time_window_covered'
      : replyRateLimited
      ? 'rate_limited'
      : replyExhausted
      ? 'timeline_exhausted'
      : 'timeline_stalled';

    let status = 'partial';
    if (mainComplete && (replyLimit === 0 || replyComplete)) {
      status = 'complete';
    } else if (mainRateLimited || replyRateLimited) {
      status = 'partial_rate_limited';
    } else if (mRows.length > 0 || rRows.length > 0) {
      status = 'partial';
    } else {
      status = isGeorge ? 'complete' : 'error';
    }

    updatedCreators.push({
      ...prevSummary,
      status,
      error: prevSummary.error || null,
      main: {
        count: mRows.length,
        ...counts,
        operationName: prevSummary.main?.operationName || 'UserOriginalsTimeline',
        operationResponses: prevSummary.main?.operationResponses || 0,
        responseErrors: prevSummary.main?.responseErrors || [],
        capturedWithinWindow: mRows.length,
        hitLimit: mainHitLimit,
        coverageReachedSince: mainReachedSince,
        rateLimited: mainRateLimited,
        exhausted: mainExhausted,
        complete: mainComplete,
        oldestObservedAt: mainOldestMs ? new Date(mainOldestMs).toISOString() : null,
        newestObservedAt: mainNewestMs ? new Date(mainNewestMs).toISOString() : null,
        stopReason: mainStopReason,
        truncatedBeforeWindow: !mainComplete,
      },
      replies: {
        count: rRows.length,
        operationName: prevSummary.replies?.operationName || 'UserRepliesTimeline',
        operationResponses: prevSummary.replies?.operationResponses || 0,
        responseErrors: prevSummary.replies?.responseErrors || [],
        capturedWithinWindow: rRows.length,
        hitLimit: replyHitLimit,
        coverageReachedSince: replyReachedSince,
        rateLimited: replyRateLimited,
        exhausted: replyExhausted,
        complete: replyComplete,
        oldestObservedAt: replyOldestMs ? new Date(replyOldestMs).toISOString() : null,
        newestObservedAt: replyNewestMs ? new Date(replyNewestMs).toISOString() : null,
        stopReason: replyStopReason,
        truncatedBeforeWindow: !replyComplete,
      },
    });
  }

  const byId = (rows) => [...new Map(rows.map((row) => [row.id, row])).values()]
    .sort((left, right) => Number(right.timestampMs || 0) - Number(left.timestampMs || 0) || String(right.id).localeCompare(String(left.id)));
  const normalizedMain = byId(mainRows);
  const normalizedReplies = byId(replyRows);
  const authoredRows = normalizedMain.filter((row) => row.postType === 'original' || row.postType === 'quote');
  const repostRows = normalizedMain.filter((row) => row.postType === 'repost');

  await writeJsonl(path.join(outDir, 'posts.jsonl'), normalizedMain);
  await writeJsonl(path.join(outDir, 'authored_posts.jsonl'), authoredRows);
  await writeJsonl(path.join(outDir, 'reposts.jsonl'), repostRows);
  await writeJsonl(path.join(outDir, 'replies.jsonl'), normalizedReplies);

  manifest.creators = updatedCreators;
  manifest.updatedAt = new Date().toISOString();
  manifest.requested = { mainLimit, replyLimit, maxScrolls: manifest.requested?.maxScrolls || 30, scrollDelayMs: manifest.requested?.scrollDelayMs || 1000 };
  manifest.collectionWindow = {
    sinceDays,
    since: new Date(sinceMs).toISOString(),
    anchor,
    semantics: 'For each creator, collect up to the requested number of recent authored posts (originals + quotes) from X current live profile operation; low-cadence creators continue until the shared trailing-window boundary or the browser timeline stalls/exhausts.',
  };
  manifest.totals = {
    creatorsRequested: allInputCreators.length,
    creatorsComplete: manifest.creators.filter((creator) => creator.status === 'complete').length,
    creatorsPartial: manifest.creators.filter((creator) => creator.status.startsWith('partial')).length,
    creatorsError: manifest.creators.filter((creator) => creator.status === 'error').length,
    mainComplete: manifest.creators.filter((creator) => creator.main?.complete).length,
    mainPartial: manifest.creators.filter((creator) => !creator.main?.complete && creator.status !== 'error').length,
    replyComplete: manifest.creators.filter((creator) => creator.replies?.complete).length,
    replyPartial: manifest.creators.filter((creator) => !creator.replies?.complete && creator.status !== 'error').length,
    mainRecords: normalizedMain.length,
    authoredRecords: authoredRows.length,
    repostRecords: repostRows.length,
    replyRecords: normalizedReplies.length,
  };
  await writeJson(manifestPath, manifest);
  console.log(JSON.stringify({ outDir, ...manifest.totals }, null, 2));
}

function validationSummary(posts, replies, manifest) {
  const all = [...posts, ...replies];
  const ids = all.map((row) => row.id).filter(Boolean);
  const duplicates = ids.length - new Set(ids).size;
  const falseZeroViews = all.filter((row) => row.views === 0
    && ['original', 'quote', 'reply'].includes(row.postType)
    && [row.likes, row.reposts, row.replies, row.bookmarks].some((value) => Number(value || 0) > 0));
  const mislabeledRt = posts.filter((row) => row.postType !== 'repost' && /^RT\s+@/i.test(row.text || ''));
  const quotes = posts.filter((row) => row.postType === 'quote');
  const quoteContext = quotes.filter((row) => row.quotedPost?.text || row.quotedPost?.id);
  const noteTweets = all.filter((row) => row.textSource === 'note_tweet');
  const over280 = all.filter((row) => String(row.text || '').length > 280);
  const clippedHeuristic = all.filter((row) => row.textPossiblyClipped);
  const unknownViews = all.filter((row) => row.views == null);
  const wrongReplyFile = replies.filter((row) => row.postType !== 'reply');
  const wrongMainFile = posts.filter((row) => row.postType === 'reply');
  const creatorErrors = (manifest?.creators || []).filter((creator) => creator.status === 'error');
  const creatorTruncations = (manifest?.creators || []).filter((creator) => creator.status === 'truncated');
  return {
    schemaVersion: manifest?.schemaVersion ?? null,
    posts: posts.length,
    replies: replies.length,
    creators: (manifest?.creators || []).length,
    creatorErrors: creatorErrors.map((creator) => ({ handle: creator.handle, error: creator.error })),
    creatorTruncations: creatorTruncations.map((creator) => creator.handle),
    duplicates,
    falseZeroViews: falseZeroViews.length,
    unknownViews: unknownViews.length,
    mislabeledRt: mislabeledRt.length,
    mainRowsTypedReply: wrongMainFile.length,
    replyRowsNotTypedReply: wrongReplyFile.length,
    quotePosts: quotes.length,
    quoteContextAvailable: quoteContext.length,
    quoteContextCoveragePct: quotes.length ? Number(((quoteContext.length / quotes.length) * 100).toFixed(2)) : null,
    noteTweets: noteTweets.length,
    textOver280: over280.length,
    clippedHeuristic: clippedHeuristic.length,
  };
}

async function validateCommand(options) {
  const outDir = path.resolve(options['out-dir'] || DEFAULT_OUT_DIR);
  const [posts, replies, manifest] = await Promise.all([
    readJsonl(path.join(outDir, 'posts.jsonl')),
    readJsonl(path.join(outDir, 'replies.jsonl')),
    readJson(path.join(outDir, 'manifest.json')),
  ]);
  const summary = validationSummary(posts, replies, manifest);
  console.log(JSON.stringify(summary, null, 2));
  const failed = summary.schemaVersion !== SCHEMA_VERSION
    || summary.duplicates !== 0
    || summary.falseZeroViews !== 0
    || summary.mislabeledRt !== 0
    || summary.mainRowsTypedReply !== 0
    || summary.replyRowsNotTypedReply !== 0
    || summary.creatorErrors.length !== 0;
  if (failed) process.exitCode = 2;
}

async function main() {
  const { command, options } = parseArgs();
  if (command === 'collect') return collectCommand(options);
  if (command === 'validate') return validateCommand(options);
  if (command === 'aggregate') return aggregateCommand(options);
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
