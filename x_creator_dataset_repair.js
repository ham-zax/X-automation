import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Scraper, GRAPHQL_ENDPOINTS, buildGraphQLUrl } from 'xactions/client';

const ROOT = path.resolve('.');
const PHASE2 = path.join(ROOT, 'docs/research/x_creator_phase2');
const BASE_POSTS = path.join(PHASE2, 'posts.jsonl');
const BASE_MANIFEST = path.join(PHASE2, 'manifest.json');
const CREATOR_SET = path.join(PHASE2, '..', '..', 'X_AI_CREATOR_RESEARCH_SET.md');
const INPUT_CREATOR_MANIFEST = BASE_MANIFEST;
const DEFAULT_OUT = path.join(PHASE2, 'corpus_v4_fixed');
const SUPPLEMENT_DIRS = [
  path.join(PHASE2, 'corpus_v4_browser'),
  path.join(PHASE2, 'corpus_v4_probe2'),
  path.join(PHASE2, 'corpus_v4_supplement'),
];
const GEORGE_PROBE = path.join(PHASE2, 'corpus_v4_george_probe');
const SCHEMA_VERSION = 4;
const DEFAULT_WINDOW_DAYS = 90;
const DEFAULT_AUTHOR_CAP = 100;
const DETAIL_DELAY_MS = 120;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [key, inline] = arg.slice(2).split(/=(.*)/s);
    if (inline !== undefined) options[key] = inline;
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) options[key] = argv[++index];
    else options[key] = true;
  }
  return options;
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function cleanHandle(value) {
  return String(value || '').trim().replace(/^@/, '');
}

function safeHandle(value) {
  return cleanHandle(value).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
}

function optionalNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseTime(value) {
  const number = Date.parse(value || '');
  return Number.isFinite(number) ? number : null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readJsonMaybe(file) {
  return readJson(file).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
}

async function readJsonl(file) {
  const text = await fs.readFile(file, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return '';
    throw error;
  });
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temp, file);
}

async function writeJsonl(file, rows) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join('\n');
  await fs.writeFile(file, body ? `${body}\n` : '', 'utf8');
}

function unwrapTweetResult(value) {
  let result = value;
  while (result?.__typename === 'TweetWithVisibilityResults' && result?.tweet) result = result.tweet;
  return result?.legacy ? result : null;
}

function decodeText(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, token) => {
    if (token[0] !== '#') return named[token.toLowerCase()] ?? match;
    const hex = token[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
  });
}

function textFromRaw(raw) {
  const note = raw?.note_tweet?.note_tweet_results?.result
    || raw?.note_tweet_results?.result
    || raw?.note_tweet?.result;
  if (typeof note?.text === 'string' && note.text.trim()) {
    return { text: decodeText(note.text).trim(), textSource: 'note_tweet' };
  }
  return { text: decodeText(raw?.legacy?.full_text ?? raw?.legacy?.text ?? '').trim(), textSource: 'legacy_full_text' };
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

function normalizeEmbeddedRaw(value) {
  const raw = unwrapTweetResult(value);
  if (!raw) return null;
  const legacy = raw.legacy || {};
  const user = raw?.core?.user_results?.result;
  const userLegacy = user?.legacy || {};
  const userCore = user?.core || {};
  const { text, textSource } = textFromRaw(raw);
  const media = normalizeMedia(legacy);
  return {
    id: String(raw?.rest_id || legacy?.id_str || ''),
    authorHandle: userLegacy?.screen_name || userCore?.screen_name || null,
    authorName: userLegacy?.name || userCore?.name || null,
    text,
    textSource,
    textLength: text.length,
    textPossiblyClipped: false,
    postedAt: legacy?.created_at ? new Date(legacy.created_at).toISOString() : null,
    views: optionalNumber(raw?.views?.count ?? raw?.ext_views?.count),
    likes: optionalNumber(legacy?.favorite_count),
    reposts: optionalNumber(legacy?.retweet_count),
    replies: optionalNumber(legacy?.reply_count),
    bookmarks: optionalNumber(legacy?.bookmark_count),
    quotes: optionalNumber(legacy?.quote_count),
    media,
    photoCount: media.filter((item) => item.type === 'photo').length,
    videoCount: media.filter((item) => item.type === 'video' || item.type === 'animated_gif').length,
    contextSource: 'tweet_detail',
  };
}

function extractTweetDetailResult(data, tweetId) {
  const expected = String(tweetId);
  let direct = data?.data?.tweetResult?.result;
  let raw = unwrapTweetResult(direct);
  if (raw && String(raw?.rest_id || raw?.legacy?.id_str || '') === expected) return direct;
  const instructions = data?.data?.threaded_conversation_with_injections_v2?.instructions || [];
  for (const instruction of instructions) {
    const entries = instruction?.entries || instruction?.moduleItems || [];
    for (const entry of entries) {
      const candidates = [
        entry?.content?.itemContent?.tweet_results?.result,
        entry?.item?.itemContent?.tweet_results?.result,
      ].filter(Boolean);
      for (const candidate of candidates) {
        raw = unwrapTweetResult(candidate);
        if (raw && String(raw?.rest_id || raw?.legacy?.id_str || '') === expected) return candidate;
      }
    }
  }
  return null;
}

function createScraper() {
  const cookies = [];
  if (process.env.AUTH_TOKEN) cookies.push({ name: 'auth_token', value: process.env.AUTH_TOKEN });
  if (process.env.CT0) cookies.push({ name: 'ct0', value: process.env.CT0 });
  return new Scraper({ cookies });
}

async function fetchTweetDetail(scraper, tweetId) {
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
  return extractTweetDetailResult(data, tweetId);
}

function syndicationToken(tweetId) {
  return ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

async function fetchSyndication(tweetId) {
  const token = syndicationToken(tweetId);
  const response = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=${token}`, {
    headers: { 'user-agent': 'Mozilla/5.0' },
  });
  if (!response.ok) throw new Error(`syndication HTTP ${response.status}`);
  const value = await response.json();
  return value && Object.keys(value).length ? value : null;
}

function syndicationMedia(value) {
  const media = Array.isArray(value?.mediaDetails) ? value.mediaDetails : [];
  return media.map((item) => ({
    id: String(item?.id_str || ''),
    type: item?.type || null,
    url: item?.media_url_https || null,
    expandedUrl: item?.expanded_url || null,
    altText: item?.ext_alt_text || null,
    width: optionalNumber(item?.original_info?.width),
    height: optionalNumber(item?.original_info?.height),
    durationMs: optionalNumber(item?.video_info?.duration_millis),
  }));
}

function normalizeSyndicationQuote(value) {
  if (!value?.id_str) return null;
  const media = syndicationMedia(value);
  const text = decodeText(value?.text || '').trim();
  const noteTweetPresent = Boolean(value?.note_tweet);
  return {
    id: String(value.id_str),
    authorHandle: value?.user?.screen_name || null,
    authorName: value?.user?.name || null,
    text,
    textSource: noteTweetPresent ? 'syndication_note_tweet_preview' : 'syndication_text',
    textLength: text.length,
    textPossiblyClipped: noteTweetPresent,
    postedAt: value?.created_at ? new Date(value.created_at).toISOString() : null,
    views: null,
    likes: optionalNumber(value?.favorite_count),
    reposts: null,
    replies: optionalNumber(value?.conversation_count),
    bookmarks: null,
    quotes: null,
    media,
    photoCount: media.filter((item) => item.type === 'photo').length,
    videoCount: media.filter((item) => item.type === 'video' || item.type === 'animated_gif').length,
    contextSource: 'x_public_syndication',
  };
}

function looksClipped(row) {
  if (row?.textSource === 'note_tweet') return false;
  const length = String(row?.text || '').length;
  return Boolean(row?.textPossiblyClipped) || (length >= 276 && length <= 304);
}

function falseZeroView(row) {
  if (row?.views !== 0) return false;
  if (!['original', 'quote', 'reply'].includes(row?.postType)) return false;
  return [row?.likes, row?.reposts, row?.replies, row?.bookmarks].some((value) => Number(value || 0) > 0);
}

function normalizeMetricProvenance(row) {
  const copy = structuredClone(row);
  copy.schemaVersion = SCHEMA_VERSION;
  if (falseZeroView(copy)) {
    copy.views = null;
    copy.metricAvailability = { ...(copy.metricAvailability || {}), views: false };
    copy.viewObservationStatus = 'unavailable_legacy_zero_sentinel';
  } else {
    copy.metricAvailability = {
      views: copy.views != null,
      likes: copy.likes != null,
      reposts: copy.reposts != null,
      replies: copy.replies != null,
      bookmarks: copy.bookmarks != null,
      quotes: copy.quotes != null,
      ...(copy.metricAvailability || {}),
    };
    copy.viewObservationStatus = copy.views == null ? 'unavailable' : 'observed';
  }
  copy.metricsComparable = copy.postType !== 'repost';
  copy.followerCountSemantics = 'observation_time_not_publish_time';
  copy.historicalFollowerNormalizationEligible = false;
  return copy;
}

function preferRow(existing, candidate) {
  if (!existing) return candidate;
  const existingScore = (existing.schemaVersion === SCHEMA_VERSION ? 10 : 0)
    + (existing.textSource === 'note_tweet' ? 4 : 0)
    + (existing.quotedPost?.text ? 2 : 0)
    + (existing.views != null ? 1 : 0);
  const candidateScore = (candidate.schemaVersion === SCHEMA_VERSION ? 10 : 0)
    + (candidate.textSource === 'note_tweet' ? 4 : 0)
    + (candidate.quotedPost?.text ? 2 : 0)
    + (candidate.views != null ? 1 : 0);
  return candidateScore >= existingScore ? candidate : existing;
}

async function loadSupplement(dir) {
  const manifest = await readJsonMaybe(path.join(dir, 'manifest.json'));
  if (!manifest) return { dir, manifest: null, main: [], replies: [] };
  const main = await readJsonl(path.join(dir, 'posts.jsonl'));
  const replies = await readJsonl(path.join(dir, 'replies.jsonl'));
  if (main.length || replies.length) return { dir, manifest, main, replies };
  const collectedMain = [];
  const collectedReplies = [];
  for (const creator of manifest.creators || []) {
    collectedMain.push(...await readJsonl(path.join(dir, 'main', `${safeHandle(creator.handle)}.jsonl`)));
    collectedReplies.push(...await readJsonl(path.join(dir, 'replies', `${safeHandle(creator.handle)}.jsonl`)));
  }
  return { dir, manifest, main: collectedMain, replies: collectedReplies };
}

function baseCoverageByCreator(baseRows, creators, windowStartMs) {
  const grouped = new Map();
  for (const row of baseRows) {
    const key = cleanHandle(row.creatorHandle).toLowerCase();
    const state = grouped.get(key) || { total: 0, oldestMs: null };
    state.total += 1;
    const timestamp = parseTime(row.postedAt);
    if (timestamp != null) state.oldestMs = state.oldestMs == null ? timestamp : Math.min(state.oldestMs, timestamp);
    grouped.set(key, state);
  }
  return new Map(creators.map((creator) => {
    const key = cleanHandle(creator.handle).toLowerCase();
    const state = grouped.get(key) || { total: 0, oldestMs: null };
    const complete = (state.total > 0 && state.total < 100) || (state.oldestMs != null && state.oldestMs <= windowStartMs);
    return [key, { ...state, complete }];
  }));
}

function supplementalCoverage(supplements) {
  const map = new Map();
  for (const supplement of supplements) {
    for (const creator of supplement.manifest?.creators || []) {
      const key = cleanHandle(creator.handle).toLowerCase();
      if (creator.status !== 'complete') continue;
      const main = creator.main || {};
      if (!(main.complete ?? (main.hitLimit || main.coverageReachedSince))) continue;
      map.set(key, {
        sourceDir: path.basename(supplement.dir),
        status: creator.status,
        hitLimit: Boolean(main.hitLimit),
        coverageReachedSince: Boolean(main.coverageReachedSince),
      });
    }
  }
  return map;
}

async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => run()));
  return results;
}

async function enrichQuoteContexts(rows) {
  const targets = rows.filter((row) => row.postType === 'quote' && !row.quotedPost?.text && row.quotedStatusId);
  let enriched = 0;
  let unavailable = 0;
  const detailNeeded = [];
  await mapLimit(targets, 12, async (row) => {
    try {
      const value = await fetchSyndication(row.id);
      const quote = normalizeSyndicationQuote(value?.quoted_tweet);
      if (quote) {
        row.quotedPost = quote;
        row.quoteContextStatus = quote.textPossiblyClipped ? 'preview_needs_detail' : 'available';
        enriched += 1;
        if (quote.textPossiblyClipped) detailNeeded.push(row);
      } else {
        row.quoteContextStatus = 'unavailable';
        unavailable += 1;
      }
    } catch (error) {
      row.quoteContextStatus = 'syndication_error';
      row.quoteContextError = error?.message || String(error);
      unavailable += 1;
    }
  });
  return { targets: targets.length, enriched, unavailable, detailNeeded };
}

async function enrichTweetDetails(rows, detailRows) {
  const scraper = createScraper();
  const unique = [...new Map(detailRows.map((row) => [row.id, row])).values()];
  const errors = [];
  let enriched = 0;
  for (const row of unique) {
    try {
      const result = await fetchTweetDetail(scraper, row.id);
      const raw = unwrapTweetResult(result);
      if (!raw) throw new Error('tweet detail result missing');
      const { text, textSource } = textFromRaw(raw);
      if (text) {
        row.text = text;
        row.textSource = textSource;
        row.textLength = text.length;
        row.textPossiblyClipped = false;
      }
      const quotedRaw = unwrapTweetResult(raw?.quoted_status_result?.result);
      if (quotedRaw) {
        row.quotedPost = normalizeEmbeddedRaw(quotedRaw);
        row.quoteContextStatus = 'available';
      }
      const viewsRaw = raw?.views?.count ?? raw?.ext_views?.count;
      if (viewsRaw != null) {
        row.views = optionalNumber(viewsRaw);
        row.metricAvailability = { ...(row.metricAvailability || {}), views: true };
        row.viewObservationStatus = 'observed_detail_refresh';
      }
      enriched += 1;
    } catch (error) {
      errors.push({ id: row.id, error: error?.message || String(error) });
    }
    await delay(DETAIL_DELAY_MS);
  }
  return { requested: unique.length, enriched, errors };
}

function addAnalysisMetadata(row, anchorMs, windowStartMs) {
  const copy = normalizeMetricProvenance(row);
  const postedMs = parseTime(copy.postedAt);
  copy.analysisWindow = {
    start: new Date(windowStartMs).toISOString(),
    end: new Date(anchorMs).toISOString(),
    withinWindow: postedMs != null && postedMs >= windowStartMs && postedMs <= anchorMs,
  };
  copy.ageHoursAtAnchor = postedMs == null ? null : Math.max(0, (anchorMs - postedMs) / 3_600_000);
  copy.performanceEligible24h = copy.ageHoursAtAnchor != null && copy.ageHoursAtAnchor >= 24 && copy.views != null && copy.views > 0;
  copy.performanceEligible72h = copy.ageHoursAtAnchor != null && copy.ageHoursAtAnchor >= 72 && copy.views != null && copy.views > 0;
  return copy;
}

async function main() {
  const options = parseArgs();
  const outDir = path.resolve(options['out-dir'] || DEFAULT_OUT);
  const windowDays = boundedInteger(options['window-days'], DEFAULT_WINDOW_DAYS, 7, 730);
  const authorCap = boundedInteger(options['author-cap'], DEFAULT_AUTHOR_CAP, 1, 500);
  const baseRows = await readJsonl(BASE_POSTS);
  const baseManifest = await readJson(BASE_MANIFEST);
  const creatorManifest = await readJson(INPUT_CREATOR_MANIFEST);
  const creators = creatorManifest.creators || [];
  const supplements = [];
  for (const dir of [...SUPPLEMENT_DIRS, GEORGE_PROBE]) supplements.push(await loadSupplement(dir));

  const observedTimes = [baseManifest.updatedAt, ...supplements.map((item) => item.manifest?.updatedAt)]
    .map(parseTime).filter((value) => value != null);
  const anchorMs = options.anchor ? parseTime(options.anchor) : Math.max(...observedTimes);
  if (anchorMs == null || !Number.isFinite(anchorMs)) throw new Error('Unable to determine dataset anchor');
  const windowStartMs = anchorMs - windowDays * 86_400_000;

  const baseCoverage = baseCoverageByCreator(baseRows, creators, windowStartMs);
  const supplementCoverage = supplementalCoverage(supplements);
  const georgeManifest = supplements.find((item) => item.dir === GEORGE_PROBE)?.manifest;
  const georgeProfile = georgeManifest?.creators?.find((creator) => cleanHandle(creator.handle).toLowerCase() === 'realgeorgehotz')?.profile;

  const authoredMap = new Map();
  const repostMap = new Map();
  for (const row of baseRows) {
    const timestamp = parseTime(row.postedAt);
    if (timestamp == null || timestamp < windowStartMs || timestamp > anchorMs) continue;
    const target = row.postType === 'original' || row.postType === 'quote' ? authoredMap : row.postType === 'repost' ? repostMap : null;
    if (!target) continue;
    target.set(row.id, preferRow(target.get(row.id), row));
  }
  for (const supplement of supplements) {
    for (const row of supplement.main) {
      const timestamp = parseTime(row.postedAt);
      if (timestamp == null || timestamp < windowStartMs || timestamp > anchorMs) continue;
      if (row.postType !== 'original' && row.postType !== 'quote') continue;
      authoredMap.set(row.id, preferRow(authoredMap.get(row.id), row));
    }
  }

  const authoredByCreator = new Map();
  for (const row of authoredMap.values()) {
    const key = cleanHandle(row.creatorHandle).toLowerCase();
    const list = authoredByCreator.get(key) || [];
    list.push(row);
    authoredByCreator.set(key, list);
  }

  const selectedAuthored = [];
  const creatorCoverage = [];
  for (const creator of creators) {
    const key = cleanHandle(creator.handle).toLowerCase();
    const rows = (authoredByCreator.get(key) || [])
      .sort((left, right) => Number(parseTime(right.postedAt) || 0) - Number(parseTime(left.postedAt) || 0) || String(right.id).localeCompare(String(left.id)))
      .slice(0, authorCap);
    rows.forEach((row, index) => {
      row.authorWindowOrdinal = index + 1;
      selectedAuthored.push(addAnalysisMetadata(row, anchorMs, windowStartMs));
    });
    const base = baseCoverage.get(key);
    const supplement = supplementCoverage.get(key);
    const observedZeroPosts = key === 'realgeorgehotz' && Number(georgeProfile?.postsObserved) === 0;
    const coverageComplete = Boolean(base?.complete || supplement || observedZeroPosts);
    creatorCoverage.push({
      index: creator.index,
      name: creator.name,
      handle: creator.handle,
      lane: creator.lane,
      phase1Followers: optionalNumber(creator.phase1Followers),
      authoredRowsInWindow: rows.length,
      coverageStatus: coverageComplete ? 'complete' : 'partial',
      baseCoverage: base,
      supplementCoverage: supplement || null,
      observedProfilePosts: key === 'realgeorgehotz' ? optionalNumber(georgeProfile?.postsObserved) : null,
    });
  }

  const clippedRows = selectedAuthored.filter(looksClipped);
  const quoteSummary = await enrichQuoteContexts(selectedAuthored);
  const detailTargets = [...clippedRows, ...quoteSummary.detailNeeded];
  const detailSummary = await enrichTweetDetails(selectedAuthored, detailTargets);

  const repostRows = [...repostMap.values()]
    .map((row) => {
      const copy = addAnalysisMetadata(row, anchorMs, windowStartMs);
      copy.metricsComparable = false;
      copy.metricSemantics = 'repost wrapper metrics may be inherited or structurally incomparable; use only as curation behavior';
      return copy;
    })
    .sort((left, right) => Number(parseTime(right.postedAt) || 0) - Number(parseTime(left.postedAt) || 0));

  const replyMap = new Map();
  for (const supplement of supplements) {
    for (const row of supplement.replies) {
      const timestamp = parseTime(row.postedAt);
      if (timestamp == null || timestamp < windowStartMs || timestamp > anchorMs || row.postType !== 'reply') continue;
      replyMap.set(row.id, preferRow(replyMap.get(row.id), row));
    }
  }
  const replyRows = [...replyMap.values()]
    .map((row) => addAnalysisMetadata(row, anchorMs, windowStartMs))
    .sort((left, right) => Number(parseTime(right.postedAt) || 0) - Number(parseTime(left.postedAt) || 0));

  selectedAuthored.sort((left, right) => Number(parseTime(right.postedAt) || 0) - Number(parseTime(left.postedAt) || 0));

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    builtAt: new Date().toISOString(),
    anchor: new Date(anchorMs).toISOString(),
    windowDays,
    windowStart: new Date(windowStartMs).toISOString(),
    authorCap,
    sourcePolicy: {
      base: 'v3 collected post IDs/metrics retained where the old collection demonstrably covers the shared window',
      supplement: 'authenticated live X UserOriginalsTimeline/SearchTimeline used only where the v3 100-total-post quota truncates the shared window',
      longText: 'authenticated X TweetDetail used selectively for likely clipped note_tweet rows',
      quoteContext: 'X public syndication used for quote context; authenticated TweetDetail upgrades long-form quote previews when needed',
      replies: 'separate authenticated X reply captures; never mixed into authored-post performance analysis',
    },
    invariants: [
      'Authored performance corpus contains only original and quote posts.',
      'Reposts are stored separately and marked metricsComparable=false.',
      'Legacy views=0 with nonzero engagement becomes views=null rather than false zero exposure.',
      'Historical follower normalization is disabled because follower counts are observation-time snapshots, not publish-time values.',
      'The primary authored corpus uses one shared trailing window and a per-author cap.',
      'Posts younger than 24h remain in the dataset but are explicitly ineligible for mature performance analysis.',
    ],
    creators: creatorCoverage,
    enrichment: {
      clippedCandidates: clippedRows.length,
      quoteContext: { targets: quoteSummary.targets, enriched: quoteSummary.enriched, unavailable: quoteSummary.unavailable },
      tweetDetail: detailSummary,
    },
    totals: {
      intendedCreators: creators.length,
      creatorsWithAuthoredRows: creatorCoverage.filter((creator) => creator.authoredRowsInWindow > 0).length,
      creatorsCoverageComplete: creatorCoverage.filter((creator) => creator.coverageStatus === 'complete').length,
      creatorsCoveragePartial: creatorCoverage.filter((creator) => creator.coverageStatus === 'partial').length,
      authoredPosts: selectedAuthored.length,
      reposts: repostRows.length,
      replies: replyRows.length,
      falseZeroViewsRemaining: selectedAuthored.filter(falseZeroView).length,
      unknownAuthoredViews: selectedAuthored.filter((row) => row.views == null).length,
      mature24hWithViews: selectedAuthored.filter((row) => row.performanceEligible24h).length,
      mature72hWithViews: selectedAuthored.filter((row) => row.performanceEligible72h).length,
      noteTweets: selectedAuthored.filter((row) => row.textSource === 'note_tweet').length,
      textOver280: selectedAuthored.filter((row) => String(row.text || '').length > 280).length,
      quotePosts: selectedAuthored.filter((row) => row.postType === 'quote').length,
      quoteContextAvailable: selectedAuthored.filter((row) => row.postType === 'quote' && row.quotedPost?.text).length,
    },
    creatorSetReference: path.relative(ROOT, CREATOR_SET),
    supplementDirs: supplements.filter((item) => item.manifest).map((item) => path.relative(ROOT, item.dir)),
  };

  await writeJsonl(path.join(outDir, 'authored_posts.jsonl'), selectedAuthored);
  await writeJsonl(path.join(outDir, 'reposts.jsonl'), repostRows);
  await writeJsonl(path.join(outDir, 'replies.jsonl'), replyRows);
  await writeJson(path.join(outDir, 'manifest.json'), manifest);
  console.log(JSON.stringify({ outDir, ...manifest.totals, enrichment: manifest.enrichment }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
