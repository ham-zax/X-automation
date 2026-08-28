import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Scraper } from 'xactions/client';
import { scrapeTweets, searchTweets } from 'xactions';
import { createBrowser, createPage } from './x_browser.js';
import { fetchXViralPosts } from './tech_news.js';
import {
  buildViralStyleReportRows,
  deriveViralPerformance,
  extractViralStyleFeatures,
  summarizeViralStyleDataset,
} from './viral_style.js';

const DATA_DIR = path.resolve(process.env.VIRAL_STYLE_DIR || '.viral-style-research');
const POSTS_FILE = path.join(DATA_DIR, 'posts.jsonl');
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.jsonl');
const THREADS_FILE = path.join(DATA_DIR, 'threads.jsonl');
const REPORT_FILE = path.join(DATA_DIR, 'style_report.csv');
const SUMMARY_FILE = path.join(DATA_DIR, 'style_summary.json');

const DEFAULT_SEED_LIMIT = 10;
const DEFAULT_CONTROL_LIMIT = 3;
const MAX_SEED_LIMIT = 50;
const MAX_CONTROL_LIMIT = 10;
const THREAD_SCROLL_PASSES = 4;

function parseArgs(argv = process.argv.slice(2)) {
  const command = argv[0] || 'collect';
  const options = {};
  for (let index = 1; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s);
    if (inlineValue !== undefined) options[rawKey] = inlineValue;
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) options[rawKey] = argv[++index];
    else options[rawKey] = true;
  }
  return { command, options };
}

function boundedInteger(value, fallback, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(max, Math.floor(number)));
}

function boolOption(value, fallback = false) {
  if (value == null) return fallback;
  if (value === true) return true;
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

function cleanUsername(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

function statusIdFromUrl(input) {
  try {
    const url = new URL(String(input || ''));
    if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname.toLowerCase())) return null;
    const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    return match ? { username: cleanUsername(match[1]), id: match[2], url: `https://x.com/${match[1]}/status/${match[2]}` } : null;
  } catch {
    return null;
  }
}

function createdTimestamp(tweet) {
  const direct = Number(tweet?.timestamp);
  if (Number.isFinite(direct) && direct > 0) return direct;
  if (tweet?.timeParsed instanceof Date) return tweet.timeParsed.getTime();
  const parsed = Date.parse(String(tweet?.createdAt || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function mediaType(tweet) {
  const photos = Array.isArray(tweet?.photos) ? tweet.photos.length : 0;
  const videos = Array.isArray(tweet?.videos) ? tweet.videos.length : 0;
  if (photos && videos) return 'mixed';
  if (videos) return 'video';
  if (photos) return 'image';
  return 'none';
}

function accountAgeDays(profile, observedAt) {
  const joined = profile?.joined instanceof Date ? profile.joined.getTime() : Date.parse(String(profile?.joined || ''));
  if (!Number.isFinite(joined) || joined <= 0) return null;
  return Math.max(0, (observedAt - joined) / 86_400_000);
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
}

async function readJsonl(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function appendJsonl(file, values) {
  const rows = Array.isArray(values) ? values : [values];
  if (!rows.length) return;
  await ensureDataDir();
  await fs.appendFile(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function createReadOnlyScraper() {
  const scraper = new Scraper();
  const cookies = [];
  if (process.env.AUTH_TOKEN) cookies.push({ name: 'auth_token', value: process.env.AUTH_TOKEN });
  if (process.env.CT0) cookies.push({ name: 'ct0', value: process.env.CT0 });
  if (cookies.length) await scraper.setCookies(cookies);
  return scraper;
}

async function createReadOnlyBrowser() {
  const browser = await createBrowser({ headless: true });
  const page = await createPage(browser);
  const cookies = [];
  if (process.env.AUTH_TOKEN) cookies.push({ name: 'auth_token', value: process.env.AUTH_TOKEN, domain: '.x.com', path: '/', secure: true, httpOnly: true });
  if (process.env.CT0) cookies.push({ name: 'ct0', value: process.env.CT0, domain: '.x.com', path: '/', secure: true });
  if (cookies.length) await page.setCookie(...cookies);
  return { browser, page };
}

function postRecord(tweet, { sampleKind, sourceQuery, observedAt }) {
  const username = cleanUsername(tweet?.username);
  const id = String(tweet?.id || '');
  const createdAt = createdTimestamp(tweet);
  const text = String(tweet?.text || tweet?.fullText || '').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
  const record = {
    id,
    url: id && username ? `https://x.com/${username}/status/${id}` : '',
    username,
    text,
    createdAt,
    conversationId: String(tweet?.conversationId || ''),
    sampleKind,
    sourceQuery: String(sourceQuery || ''),
    isReply: Boolean(tweet?.isReply),
    isQuote: Boolean(tweet?.isQuote),
    isRetweet: Boolean(tweet?.isRetweet),
    mediaType: mediaType(tweet),
    photoCount: Array.isArray(tweet?.photos) ? tweet.photos.length : 0,
    videoCount: Array.isArray(tweet?.videos) ? tweet.videos.length : 0,
    hashtags: Array.isArray(tweet?.hashtags) ? tweet.hashtags : [],
    mentions: Array.isArray(tweet?.mentions) ? tweet.mentions : [],
    urls: Array.isArray(tweet?.urls) ? tweet.urls : [],
    firstObservedAt: observedAt,
  };
  return { ...record, styleFeatures: extractViralStyleFeatures(record) };
}

function snapshotRecord(tweet, profile, observedAt) {
  const createdAt = createdTimestamp(tweet);
  const postAgeMinutes = createdAt == null ? null : Math.max(0, (observedAt - createdAt) / 60_000);
  const base = {
    tweetId: String(tweet?.id || ''),
    observedAt,
    postAgeMinutes,
    views: Number.isFinite(Number(tweet?.views)) ? Number(tweet.views) : null,
    likes: Number.isFinite(Number(tweet?.likes)) ? Number(tweet.likes) : null,
    reposts: Number.isFinite(Number(tweet?.retweets)) ? Number(tweet.retweets) : null,
    replies: Number.isFinite(Number(tweet?.replies)) ? Number(tweet.replies) : null,
    bookmarks: Number.isFinite(Number(tweet?.bookmarkCount)) ? Number(tweet.bookmarkCount) : null,
    authorFollowers: Number.isFinite(Number(profile?.followersCount)) ? Number(profile.followersCount) : null,
    authorFollowing: Number.isFinite(Number(profile?.followingCount)) ? Number(profile.followingCount) : null,
    authorTweetCount: Number.isFinite(Number(profile?.tweetCount)) ? Number(profile.tweetCount) : null,
    authorListedCount: Number.isFinite(Number(profile?.listedCount)) ? Number(profile.listedCount) : null,
    authorBlueVerified: Boolean(profile?.isBlueVerified || profile?.verified),
    authorAccountAgeDays: accountAgeDays(profile, observedAt),
  };
  return { ...base, ...deriveViralPerformance(base) };
}

async function enrichTweet(scraper, id, profileCache, { observedAt = Date.now() } = {}) {
  const tweet = await scraper.getTweet(String(id));
  if (!tweet?.id) throw new Error(`X post not observable: ${id}`);
  const username = cleanUsername(tweet.username);
  let profile = profileCache.get(username);
  if (!profile) {
    profile = await scraper.getProfile(username);
    profileCache.set(username, profile);
  }
  return { tweet, profile, observedAt };
}

async function persistObservation({ tweet, profile, observedAt, sampleKind, sourceQuery }, state) {
  const id = String(tweet.id);
  if (!state.postsById.has(id)) {
    const post = postRecord(tweet, { sampleKind, sourceQuery, observedAt });
    state.postsById.set(id, post);
    await appendJsonl(POSTS_FILE, post);
  }
  const snapshot = snapshotRecord(tweet, profile, observedAt);
  await appendJsonl(SNAPSHOTS_FILE, snapshot);
  return { post: state.postsById.get(id), snapshot };
}

async function loadState() {
  await ensureDataDir();
  const [posts, snapshots, threads] = await Promise.all([readJsonl(POSTS_FILE), readJsonl(SNAPSHOTS_FILE), readJsonl(THREADS_FILE)]);
  return {
    posts,
    snapshots,
    threads,
    postsById: new Map(posts.map((post) => [String(post.id), post])),
    threadRoots: new Set(threads.filter((thread) => thread.complete === true).map((thread) => String(thread.rootTweetId || '')).filter(Boolean)),
  };
}

async function discoverDefaultSeeds(limit, { full = false } = {}) {
  const result = await fetchXViralPosts(Math.max(limit * 3, 24), full ? 2 : 1, !full);
  if (result.error) throw new Error(result.error);
  return result.posts.slice(0, limit).map((post) => ({ id: String(post.url || '').match(/\/status\/(\d+)/)?.[1] || '', sourceQuery: full ? 'default_viral_queries_full' : 'default_viral_queries_fast' })).filter((post) => post.id);
}

async function discoverQuerySeeds(page, query, limit) {
  const hits = await searchTweets(page, query, { limit: Math.max(limit, 1), filter: 'top' });
  return hits.slice(0, limit).map((hit) => ({ id: String(hit.id || ''), sourceQuery: query })).filter((hit) => hit.id);
}

async function collectAuthorControls(page, scraper, profileCache, state, seed, limit) {
  if (limit <= 0) return { collected: 0, errors: [] };
  const username = cleanUsername(seed.tweet.username);
  const errors = [];
  let collected = 0;
  try {
    const candidates = await scrapeTweets(page, username, { limit: Math.max(12, limit * 4), includeReplies: false });
    for (const candidate of candidates) {
      if (collected >= limit) break;
      const id = String(candidate?.id || '');
      if (!id || id === String(seed.tweet.id) || state.postsById.has(id)) continue;
      try {
        const enriched = await enrichTweet(scraper, id, profileCache);
        if (enriched.tweet.isRetweet || enriched.tweet.isReply) continue;
        await persistObservation({ ...enriched, sampleKind: 'author_control', sourceQuery: `author:${username}` }, state);
        collected++;
      } catch (error) {
        errors.push({ tweetId: id, error: error.message });
      }
    }
  } catch (error) {
    errors.push({ username, error: error.message });
  }
  return { collected, errors };
}

async function conversationTweetIds(page, rootPost) {
  await page.goto(rootPost.url, { waitUntil: 'networkidle2' });
  const ids = new Set([String(rootPost.id)]);
  for (let pass = 0; pass < THREAD_SCROLL_PASSES; pass++) {
    const rows = await page.evaluate(() => Array.from(document.querySelectorAll('article[data-testid="tweet"]')).map((article) => {
      const userLink = article.querySelector('[data-testid="User-Name"] a[href^="/"]');
      const statusLink = article.querySelector('a[href*="/status/"]');
      return {
        username: userLink?.getAttribute('href')?.split('/').filter(Boolean)[0] || '',
        id: statusLink?.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1] || '',
      };
    }));
    for (const row of rows) {
      if (cleanUsername(row.username) === cleanUsername(rootPost.username) && row.id) ids.add(String(row.id));
    }
    await page.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight * 1.5, 900)));
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  return [...ids];
}

function expectedThreadListItems(text) {
  const value = String(text || '');
  const match = value.match(/\b(?:top|here are|these are)\s+(\d{1,2})\b/i)
    || value.match(/\b(\d{1,2})\s+(?:best\s+)?(?:prompts?|tools?|ways?|things?|lessons?|use cases?|bots?|resources?)\b/i);
  const count = Number(match?.[1] || 0);
  return Number.isInteger(count) && count > 0 ? count : null;
}

async function reconstructThread(page, scraper, profileCache, state, seed) {
  const rootId = String(seed.tweet.id);
  if (state.threadRoots.has(rootId)) return null;
  const rootPost = state.postsById.get(rootId);
  if (!rootPost?.styleFeatures?.hasThreadPromise) return null;
  const username = cleanUsername(seed.tweet.username);
  const parts = [{
    id: rootId,
    text: rootPost.text,
    createdAt: rootPost.createdAt,
    views: seed.tweet.views ?? null,
    likes: seed.tweet.likes ?? null,
    reposts: seed.tweet.retweets ?? null,
    replies: seed.tweet.replies ?? null,
    bookmarks: seed.tweet.bookmarkCount ?? null,
    styleFeatures: rootPost.styleFeatures || extractViralStyleFeatures(rootPost),
  }];
  try {
    const ids = await conversationTweetIds(page, rootPost);
    for (const id of ids) {
      if (id === rootId) continue;
      try {
        const enriched = await enrichTweet(scraper, id, profileCache);
        const tweet = enriched.tweet;
        if (cleanUsername(tweet.username) !== username || String(tweet.conversationId || '') !== rootId) continue;
        const text = String(tweet.text || tweet.fullText || '').trim();
        parts.push({
          id: String(tweet.id),
          text,
          createdAt: createdTimestamp(tweet),
          views: tweet.views ?? null,
          likes: tweet.likes ?? null,
          reposts: tweet.retweets ?? null,
          replies: tweet.replies ?? null,
          bookmarks: tweet.bookmarkCount ?? null,
          styleFeatures: extractViralStyleFeatures({ text }),
        });
      } catch {
        // Thread reconstruction is best effort; the root remains valid evidence.
      }
    }
  } catch {
    // Conversation-page availability is best effort.
  }
  parts.sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0) || String(left.id).localeCompare(String(right.id)));
  const unique = [...new Map(parts.map((part) => [part.id, part])).values()];
  const expectedListItems = expectedThreadListItems(rootPost.text);
  const expectedThreadLength = expectedListItems == null ? null : expectedListItems + 1;
  const complete = expectedThreadLength == null
    ? (unique.length > 1 ? null : false)
    : unique.length >= expectedThreadLength;
  const record = {
    rootTweetId: rootId,
    username,
    observedAt: Date.now(),
    threadLength: unique.length,
    observedChildCount: Math.max(0, unique.length - 1),
    expectedListItems,
    expectedThreadLength,
    tweetIds: unique.map((part) => part.id),
    parts: unique,
    complete,
    note: complete === true
      ? 'Best-effort same-author conversation reconstruction reached the list length promised by the root.'
      : unique.length > 1
        ? 'Partial same-author conversation reconstruction; keep as observed evidence and allow a later retry.'
        : 'Thread marker observed, but same-author child posts were not recoverable from the bounded conversation-page scan.',
  };
  await appendJsonl(THREADS_FILE, record);
  if (record.complete === true || (record.complete == null && record.observedChildCount > 0)) state.threadRoots.add(rootId);
  state.threads.push(record);
  return record;
}

async function collect({
  query = '',
  limit = DEFAULT_SEED_LIMIT,
  controls = DEFAULT_CONTROL_LIMIT,
  threads = true,
  full = false,
  onProgress = null,
  shouldStop = null,
} = {}) {
  const seedLimit = boundedInteger(limit, DEFAULT_SEED_LIMIT, MAX_SEED_LIMIT);
  const controlLimit = boundedInteger(controls, DEFAULT_CONTROL_LIMIT, MAX_CONTROL_LIMIT);
  const state = await loadState();
  const scraper = await createReadOnlyScraper();
  const profileCache = new Map();
  let browserContext = null;
  const errors = [];
  const seeds = [];
  let stopped = false;
  try {
    onProgress?.({ checkpoint: 'discovering', message: 'Opening read-only X discovery.', completedCandidates: 0, totalCandidates: null });
    if (query || controlLimit > 0 || threads) browserContext = await createReadOnlyBrowser();
    const discovered = query
      ? await discoverQuerySeeds(browserContext.page, query, seedLimit)
      : await discoverDefaultSeeds(seedLimit, { full });
    onProgress?.({ checkpoint: 'discovering', message: `Discovered ${discovered.length} candidate posts.`, completedCandidates: 0, totalCandidates: discovered.length });
    for (let index = 0; index < discovered.length; index++) {
      if (shouldStop?.()) {
        stopped = true;
        break;
      }
      const candidate = discovered[index];
      try {
        onProgress?.({
          checkpoint: 'enriching',
          message: `Reading exact post/profile ${index + 1}/${discovered.length}.`,
          candidateId: candidate.id,
          completedCandidates: index,
          totalCandidates: discovered.length,
          collectedSeeds: seeds.length,
        });
        const enriched = await enrichTweet(scraper, candidate.id, profileCache);
        if (enriched.tweet.isRetweet || enriched.tweet.isReply) continue;
        const persisted = await persistObservation({ ...enriched, sampleKind: 'viral_seed', sourceQuery: candidate.sourceQuery }, state);
        const seed = { ...enriched, ...persisted };
        seeds.push(seed);
        if (controlLimit > 0 && browserContext) {
          onProgress?.({
            checkpoint: 'controls',
            message: `Collecting up to ${controlLimit} same-author controls for @${cleanUsername(seed.tweet.username)}.`,
            candidateId: candidate.id,
            completedCandidates: index,
            totalCandidates: discovered.length,
            collectedSeeds: seeds.length,
          });
          const control = await collectAuthorControls(browserContext.page, scraper, profileCache, state, seed, controlLimit);
          errors.push(...control.errors);
        }
        if (threads && browserContext) {
          onProgress?.({
            checkpoint: 'threads',
            message: `Checking thread structure for @${cleanUsername(seed.tweet.username)}.`,
            candidateId: candidate.id,
            completedCandidates: index,
            totalCandidates: discovered.length,
            collectedSeeds: seeds.length,
          });
          await reconstructThread(browserContext.page, scraper, profileCache, state, seed);
        }
        onProgress?.({
          checkpoint: 'enriching',
          message: `Stored candidate ${index + 1}/${discovered.length}.`,
          candidateId: candidate.id,
          completedCandidates: index + 1,
          totalCandidates: discovered.length,
          collectedSeeds: seeds.length,
        });
      } catch (error) {
        errors.push({ tweetId: candidate.id, error: error.message });
      }
    }
  } finally {
    if (browserContext) await browserContext.browser.close().catch(() => {});
  }
  onProgress?.({ checkpoint: 'exporting', message: 'Refreshing local CSV/summary exports.', completedCandidates: seeds.length, totalCandidates: seeds.length, collectedSeeds: seeds.length });
  await exportData();
  return { seeds: seeds.length, controlsRequestedPerSeed: controlLimit, errors, dataDir: DATA_DIR, stopped };
}

async function inspectTweet(url, { controls = 0, threads = true } = {}) {
  const target = statusIdFromUrl(url);
  if (!target) throw new Error('inspect requires a valid x.com/<user>/status/<id> URL.');
  const state = await loadState();
  const scraper = await createReadOnlyScraper();
  const profileCache = new Map();
  const enriched = await enrichTweet(scraper, target.id, profileCache);
  const persisted = await persistObservation({ ...enriched, sampleKind: 'targeted', sourceQuery: 'explicit_url' }, state);
  let browserContext = null;
  try {
    if (controls > 0 || threads) browserContext = await createReadOnlyBrowser();
    if (controls > 0 && browserContext) await collectAuthorControls(browserContext.page, scraper, profileCache, state, { ...enriched, ...persisted }, boundedInteger(controls, 0, MAX_CONTROL_LIMIT));
    if (threads && browserContext) await reconstructThread(browserContext.page, scraper, profileCache, state, { ...enriched, ...persisted });
  } finally {
    if (browserContext) await browserContext.browser.close().catch(() => {});
  }
  await exportData();
  return { tweetId: target.id, username: cleanUsername(enriched.tweet.username), dataDir: DATA_DIR };
}

async function snapshotTracked() {
  const state = await loadState();
  const scraper = await createReadOnlyScraper();
  const profileCache = new Map();
  let observed = 0;
  const errors = [];
  for (const post of state.posts) {
    try {
      const enriched = await enrichTweet(scraper, post.id, profileCache);
      await appendJsonl(SNAPSHOTS_FILE, snapshotRecord(enriched.tweet, enriched.profile, enriched.observedAt));
      observed++;
    } catch (error) {
      errors.push({ tweetId: post.id, error: error.message });
    }
  }
  await exportData();
  return { observed, errors, dataDir: DATA_DIR };
}

function csvCell(value) {
  if (value == null) return '';
  const text = Array.isArray(value) ? value.join('|') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function reportRecord(row) {
  const features = row.styleFeatures || {};
  return {
    tweetId: row.tweetId,
    url: row.url,
    username: row.username,
    sampleKind: row.sampleKind,
    sourceQuery: row.sourceQuery,
    createdAtUtc: row.createdAtIso,
    publicationUtcDay: row.publicationUtcDay,
    publicationUtcHour: row.publicationUtcHour,
    observedAtUtc: row.observedAt ? new Date(row.observedAt).toISOString() : '',
    postAgeMinutes: row.postAgeMinutes,
    ageBand: row.ageBand,
    authorFollowers: row.authorFollowers,
    followerCohort: row.followerCohort,
    authorFollowing: row.authorFollowing,
    authorTweetCount: row.authorTweetCount,
    authorListedCount: row.authorListedCount,
    authorBlueVerified: row.authorBlueVerified,
    authorAccountAgeDays: row.authorAccountAgeDays,
    views: row.views,
    likes: row.likes,
    reposts: row.reposts,
    replies: row.replies,
    bookmarks: row.bookmarks,
    viewsPerFollower: row.viewsPerFollower,
    engagementsPerView: row.engagementsPerView,
    bookmarksPerView: row.bookmarksPerView,
    repostsPerView: row.repostsPerView,
    repliesPerView: row.repliesPerView,
    viewsPerHour: row.viewsPerHour,
    engagementsPerHour: row.engagementsPerHour,
    followerDeltaFromFirstObservation: row.followerDeltaFromFirstObservation,
    authorControlSampleSize: row.authorControlSampleSize,
    authorAgeMatchedControlSampleSize: row.authorAgeMatchedControlSampleSize,
    authorControlMedianViewsPerFollower: row.authorControlMedianViewsPerFollower,
    viewsPerFollowerLift: row.viewsPerFollowerLift,
    authorControlMedianEngagementsPerView: row.authorControlMedianEngagementsPerView,
    engagementsPerViewLift: row.engagementsPerViewLift,
    mediaType: row.mediaType,
    threadLength: row.threadLength,
    threadObservedChildCount: row.threadObservedChildCount,
    threadExpectedListItems: row.threadExpectedListItems,
    threadExpectedLength: row.threadExpectedLength,
    threadComplete: row.threadComplete,
    hookLabels: row.hookLabels,
    styleLabels: row.styleLabels,
    wordCount: features.wordCount,
    charCount: features.charCount,
    sentenceCount: features.sentenceCount,
    lineCount: features.lineCount,
    paragraphCount: features.paragraphCount,
    firstLine: features.firstLine,
    firstLineChars: features.firstLineChars,
    bulletLineCount: features.bulletLineCount,
    linkCount: features.linkCount,
    mentionCount: features.mentionCount,
    hashtagCount: features.hashtagCount,
    emojiCount: features.emojiCount,
    questionCount: features.questionCount,
    exclamationCount: features.exclamationCount,
    uppercaseWordRatio: features.uppercaseWordRatio,
    numberCount: features.numberCount,
    percentCount: features.percentCount,
    currencyCount: features.currencyCount,
    hasFirstPersonExperience: features.hasFirstPersonExperience,
    hasSecondPersonAddress: features.hasSecondPersonAddress,
    hasBenchmarkLanguage: features.hasBenchmarkLanguage,
    hasCostValueLanguage: features.hasCostValueLanguage,
    hasReleaseLanguage: features.hasReleaseLanguage,
    hasUrgencyLanguage: features.hasUrgencyLanguage,
    hasContrarianLanguage: features.hasContrarianLanguage,
    hasCuriosityGap: features.hasCuriosityGap,
    hasImpossibleSurpriseLanguage: features.hasImpossibleSurpriseLanguage,
    hasProofLanguage: features.hasProofLanguage,
    hasResourcePromise: features.hasResourcePromise,
    hasThreadPromise: features.hasThreadPromise,
    text: row.text,
  };
}

async function exportData() {
  const [posts, snapshots, threads] = await Promise.all([readJsonl(POSTS_FILE), readJsonl(SNAPSHOTS_FILE), readJsonl(THREADS_FILE)]);
  const rows = buildViralStyleReportRows(posts, snapshots, threads).map(reportRecord);
  const headers = rows.length ? Object.keys(rows[0]) : Object.keys(reportRecord({ styleFeatures: {} }));
  const csv = `${headers.map(csvCell).join(',')}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\n')}${rows.length ? '\n' : ''}`;
  const summary = summarizeViralStyleDataset(posts, snapshots, threads);
  await ensureDataDir();
  await fs.writeFile(REPORT_FILE, csv, { encoding: 'utf8', mode: 0o600 });
  await fs.writeFile(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return { rows: rows.length, reportFile: REPORT_FILE, summaryFile: SUMMARY_FILE, summary };
}

function usage() {
  return `Usage:\n  node viral_style_research.js collect [--limit 10] [--controls 3] [--threads true] [--full] [--query "..."]\n  node viral_style_research.js snapshot\n  node viral_style_research.js export\n  node viral_style_research.js inspect --url https://x.com/user/status/123 [--controls 3] [--threads true]\n\nData is written only under ${DATA_DIR}.`;
}

async function main() {
  const { command, options } = parseArgs();
  if (command === 'collect') {
    const result = await collect({
      query: String(options.query || ''),
      limit: options.limit,
      controls: options.controls,
      threads: boolOption(options.threads, true),
      full: boolOption(options.full, false),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'snapshot') {
    console.log(JSON.stringify(await snapshotTracked(), null, 2));
    return;
  }
  if (command === 'export') {
    const result = await exportData();
    console.log(JSON.stringify({ rows: result.rows, reportFile: result.reportFile, summaryFile: result.summaryFile }, null, 2));
    return;
  }
  if (command === 'inspect') {
    if (!options.url) throw new Error(`Missing --url.\n${usage()}`);
    console.log(JSON.stringify(await inspectTweet(String(options.url), {
      controls: boundedInteger(options.controls, 0, MAX_CONTROL_LIMIT),
      threads: boolOption(options.threads, true),
    }), null, 2));
    return;
  }
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(usage());
    return;
  }
  throw new Error(`Unknown command: ${command}\n${usage()}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`[viral-style] ${error.message}`);
    process.exitCode = 1;
  });
}

export const viralStyleResearch = Object.freeze({ collect, inspectTweet, snapshotTracked, exportData });
