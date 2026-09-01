import 'dotenv/config';
import { Scraper } from 'xactions';
import { createBrowser, createPage } from './x_browser.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyNiche, getActiveContentGroups, getActiveNicheProfile, getXSearchQueryGroups } from './strategy.js';

// ============================================================================
// ANSI Color Formatting
// ============================================================================
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  white: '\x1b[37m',
};

// ============================================================================
// 1. Hacker News Top Stories Fetcher
// ============================================================================
export async function fetchHackerNews(limit = 5) {
  try {
    const topIdsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topIdsRes.ok) throw new Error(`HN API error: ${topIdsRes.status}`);
    const topIds = await topIdsRes.json();
    const idsToFetch = topIds.slice(0, limit);

    const stories = await Promise.all(
      idsToFetch.map(async (id) => {
        try {
          const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          return await itemRes.json();
        } catch {
          return null;
        }
      })
    );

    return stories.filter(Boolean).map((s, index) => ({
      source: 'hn',
      title: s.title,
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      score: s.score || 0,
      by: s.by,
      comments: s.descendants || 0,
      timestamp: s.time ? s.time * 1000 : 0,
      hnUrl: `https://news.ycombinator.com/item?id=${s.id}`,
      rank: index + 1,
    }));
  } catch (err) {
    return { error: err.message };
  }
}

// ============================================================================
// 2. GitHub Trending (Today) Fetcher
// ============================================================================
export async function fetchGitHubTrending(limit = 5) {
  try {
    const fetchedAt = Date.now();
    const res = await fetch('https://github.com/trending?since=daily', {
      headers: {
        'User-Agent': 'xactions-tech-news/1.0',
        Accept: 'text/html',
      },
    });

    if (!res.ok) throw new Error(`GitHub Trending error: ${res.status}`);
    const html = await res.text();
    const articles = [...html.matchAll(/<article class="Box-row">([\s\S]*?)<\/article>/g)].slice(0, limit);
    const decodeText = (value = '') => String(value)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
      .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
      .replace(/\s+/g, ' ')
      .trim();
    const metric = (article, repoName, suffix) => {
      const escaped = repoName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = article.match(new RegExp(`href="/${escaped}/${suffix}"[^>]*>[\\s\\S]*?<\\/svg>\\s*([\\d,]+)\\s*<\\/a>`));
      return Number(String(match?.[1] || '0').replace(/,/g, ''));
    };

    const repos = articles.map((match, index) => {
      const article = match[1];
      const repoName = article.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="\/([^"?#]+\/[^"?#]+)"[^>]*>/)?.[1] || '';
      const description = decodeText(article.match(/<p[^>]*class="[^"]*color-fg-muted[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] || '');
      const language = decodeText(article.match(/<span itemprop="programmingLanguage">([\s\S]*?)<\/span>/)?.[1] || '');
      const starsToday = Number(String(article.match(/([\d,]+)\s+stars?\s+today/i)?.[1] || '0').replace(/,/g, ''));
      return {
        source: 'github',
        name: repoName,
        description,
        stars: metric(article, repoName, 'stargazers'),
        starsToday,
        language: language || 'Code',
        url: `https://github.com/${repoName}`,
        forks: metric(article, repoName, 'forks'),
        rank: index + 1,
        fetchedAt,
      };
    }).filter((repo) => repo.name);

    const apiHeaders = {
      'User-Agent': 'xactions-tech-news/1.0',
      Accept: 'application/vnd.github+json',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    };
    return Promise.all(repos.map(async (repo) => {
      if (repo.description && repo.stars && repo.forks && repo.language !== 'Code') return repo;
      try {
        const metadataRes = await fetch(`https://api.github.com/repos/${repo.name}`, { headers: apiHeaders });
        if (!metadataRes.ok) return repo;
        const metadata = await metadataRes.json();
        return {
          ...repo,
          description: repo.description || String(metadata.description || ''),
          stars: repo.stars || Number(metadata.stargazers_count || 0),
          forks: repo.forks || Number(metadata.forks_count || 0),
          language: repo.language !== 'Code' ? repo.language : String(metadata.language || 'Code'),
        };
      } catch {
        return repo;
      }
    }));
  } catch (err) {
    return { error: err.message };
  }
}

// ============================================================================
// 3. X / Twitter Tech News Highlights via XActions
// ============================================================================
export async function fetchXTechNews(accounts = ['github', 'OpenAI', 'ycombinator', 'TechCrunch'], limitPerAccount = 1) {
  const tweets = [];
  try {
    const scraper = new Scraper();

    for (const username of accounts) {
      try {
        let count = 0;
        for await (const t of scraper.getTweets(username, limitPerAccount)) {
          tweets.push({
            source: 'x',
            author: `@${username}`,
            text: (t.text || t.fullText || '').replace(/\s+/g, ' ').trim(),
            likes: t.likes || 0,
            retweets: t.retweets || 0,
            replies: t.replies || 0,
            views: t.views || 0,
            timestamp: t.timestamp || (t.timeParsed ? Date.parse(t.timeParsed) : 0),
            url: t.permanentUrl || (t.id ? `https://x.com/${username}/status/${t.id}` : `https://x.com/${username}`),
          });
          count++;
          if (count >= limitPerAccount) break;
        }
      } catch (err) {
        // Continue with other accounts if one fails
      }
    }
  } catch (err) {
    return { error: err.message };
  }
  return tweets;
}

const X_TARGET_MAX_TARGETS = 20;
const X_TARGET_MAX_POSTS_PER_TARGET = 10;
const X_TARGET_MAX_RAW_PER_TARGET = 30;

function xReadErrorMessage(error, { credentialed = false } = {}) {
  const message = String(error?.message || error || 'Unknown X read error.');
  if (!/(?:\b429\b|rate limit)/i.test(message)) return message;
  const reset = message.match(/Reset:\s*(.+)$/i)?.[1]?.trim();
  return `${credentialed ? 'Credentialed X read' : 'X read'} was rate limited (429). Use cached state and retry after the platform reset window${reset ? ` (${reset})` : ''}.`;
}

function boundedTargetCount(value, fallback, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(numeric)));
}

function normalizeTargetUsernames(usernames) {
  const values = Array.isArray(usernames) ? usernames : [usernames];
  const seen = new Set();
  const normalized = [];
  for (const value of values) {
    const username = String(value || '').trim().replace(/^@/, '').toLowerCase();
    if (!username || seen.has(username)) continue;
    seen.add(username);
    normalized.push(username);
  }
  return normalized;
}

function normalizeSince(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    const timestamp = value.getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;
  throw new TypeError('since must be a timestamp, Date, or parseable date string.');
}

async function createAuthenticatedXScraper() {
  const scraper = new Scraper();
  if (process.env.AUTH_TOKEN) {
    const cookies = [{ name: 'auth_token', value: process.env.AUTH_TOKEN }];
    if (process.env.CT0) cookies.push({ name: 'ct0', value: process.env.CT0 });
    await scraper.setCookies(cookies);
  }
  return scraper;
}

async function setAuthenticatedXPageCookies(page) {
  const cookies = [];
  if (process.env.AUTH_TOKEN) {
    cookies.push({
      name: 'auth_token',
      value: process.env.AUTH_TOKEN,
      domain: '.x.com',
      path: '/',
      httpOnly: true,
      secure: true,
    });
  }
  if (process.env.CT0) {
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

function normalizeTargetTweet(tweet, targetUsername) {
  const id = String(tweet?.id || '');
  const authorUsername = String(tweet?.username || targetUsername || '').replace(/^@/, '').toLowerCase();
  const timestamp = Number(tweet?.timestamp || (tweet?.timeParsed ? Date.parse(tweet.timeParsed) : 0)) || 0;
  return {
    source: 'x',
    targetUsername,
    authorUsername,
    id,
    text: String(tweet?.text || tweet?.fullText || '').replace(/\s+/g, ' ').trim(),
    timestamp,
    url: tweet?.permanentUrl || (id && authorUsername ? `https://x.com/${authorUsername}/status/${id}` : ''),
    views: Number(tweet?.views || 0),
    likes: Number(tweet?.likes || 0),
    reposts: Number(tweet?.retweets || 0),
    replies: Number(tweet?.replies || 0),
    isReply: Boolean(tweet?.isReply),
    isRepost: Boolean(tweet?.isRetweet),
    isQuote: Boolean(tweet?.isQuote),
    inReplyToStatusId: tweet?.inReplyToStatusId ? String(tweet.inReplyToStatusId) : null,
    quotedStatusId: tweet?.quotedStatusId ? String(tweet.quotedStatusId) : null,
    conversationId: tweet?.conversationId ? String(tweet.conversationId) : null,
  };
}

export async function fetchXTargetRecentPosts(usernames, {
  maxTargets = 10,
  postsPerTarget = 5,
  since = null,
  includeReplies = false,
} = {}) {
  const normalizedTargets = normalizeTargetUsernames(usernames);
  const targetLimit = boundedTargetCount(maxTargets, 10, X_TARGET_MAX_TARGETS);
  const perTargetLimit = boundedTargetCount(postsPerTarget, 5, X_TARGET_MAX_POSTS_PER_TARGET);
  const targets = normalizedTargets.slice(0, targetLimit);
  const sinceTimestamp = normalizeSince(since);
  const posts = [];
  const errors = [];
  const seenTweetIds = new Set();
  const scraper = await createAuthenticatedXScraper();

  const rawPerTarget = Math.min(X_TARGET_MAX_RAW_PER_TARGET, perTargetLimit * 3);
  for (const targetUsername of targets) {
    try {
      let accepted = 0;
      const timeline = includeReplies
        ? scraper.getTweetsAndReplies(targetUsername, rawPerTarget)
        : scraper.getTweets(targetUsername, rawPerTarget);
      for await (const tweet of timeline) {
        const post = normalizeTargetTweet(tweet, targetUsername);
        if (post.isRepost) continue;
        if (!includeReplies && post.isReply) continue;
        if (sinceTimestamp != null && (!post.timestamp || post.timestamp < sinceTimestamp)) continue;
        if (post.id && seenTweetIds.has(post.id)) continue;
        if (post.id) seenTweetIds.add(post.id);
        posts.push(post);
        accepted++;
        if (accepted >= perTargetLimit) break;
      }
    } catch (error) {
      errors.push({ targetUsername, error: xReadErrorMessage(error, { credentialed: Boolean(process.env.AUTH_TOKEN) }) });
    }
  }

  return {
    posts,
    errors,
    bounds: {
      maxTargets: targetLimit,
      postsPerTarget: perTargetLimit,
      rawPerTarget,
      truncatedTargets: Math.max(0, normalizedTargets.length - targets.length),
    },
    filters: {
      since: sinceTimestamp,
      includeReplies: Boolean(includeReplies),
      excludeReposts: true,
    },
  };
}

export async function fetchXTargetResponses(usernames, ourTweetIds, {
  maxTargets = 20,
  responsesPerTarget = 10,
  since = null,
  account = process.env.X_ACCOUNT || 'ham_zax',
} = {}) {
  const normalizedTargets = normalizeTargetUsernames(usernames);
  const targets = normalizedTargets.slice(0, boundedTargetCount(maxTargets, 20, X_TARGET_MAX_TARGETS));
  const responseLimit = boundedTargetCount(responsesPerTarget, 10, X_TARGET_MAX_POSTS_PER_TARGET);
  const parentIds = [...new Set((Array.isArray(ourTweetIds) ? ourTweetIds : [ourTweetIds])
    .map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 100);
  const parentSet = new Set(parentIds);
  const sinceTimestamp = normalizeSince(since);
  const responses = [];
  const errors = [];
  const seenTweetIds = new Set();
  if (!parentIds.length) {
    return { responses, errors, bounds: { targets: targets.length, parents: parentIds.length, responsesPerTarget: responseLimit }, filters: { since: sinceTimestamp } };
  }

  const cleanAccount = String(account || '').trim().replace(/^@/, '').toLowerCase();
  if (!cleanAccount) throw new Error('X account username is required to discover direct responses.');
  const targetSet = targets.length ? new Set(targets) : null;
  const searchLimit = Math.max(20, responseLimit * Math.max(3, targets.length || 1));
  const search = await fetchXSearchPosts(`to:${cleanAccount} -from:${cleanAccount}`, searchLimit, 'live', 2);
  if (search.error) {
    errors.push({ targetUsername: cleanAccount, error: search.error });
    return {
      responses,
      errors,
      bounds: { targets: targets.length, parents: parentIds.length, responsesPerTarget: responseLimit, searchLimit },
      filters: { since: sinceTimestamp, account: cleanAccount },
    };
  }

  const candidates = search.posts.filter((post) => {
    const username = String(post.username || post.author || '').replace(/^@/, '').toLowerCase();
    if (!username || (targetSet && !targetSet.has(username))) return false;
    if (sinceTimestamp != null && (!post.timestamp || post.timestamp < sinceTimestamp)) return false;
    return true;
  });

  const browser = await createBrowser({ headless: true });
  try {
    const page = await createPage(browser);
    await setAuthenticatedXPageCookies(page);
    const acceptedByTarget = new Map();
    for (const post of candidates) {
      const targetUsername = String(post.username || post.author || '').replace(/^@/, '').toLowerCase();
      if ((acceptedByTarget.get(targetUsername) || 0) >= responseLimit) continue;
      const responseId = String(post.id || post.url?.match(/\/status\/(\d+)/)?.[1] || '');
      if (!responseId || seenTweetIds.has(responseId)) continue;
      try {
        await page.goto(post.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10_000 }).catch(() => {});
        const parentOurTweetId = await page.evaluate(({ focalId, parentIds: allowedParents }) => {
          const parentSet = new Set(allowedParents);
          const rows = [...document.querySelectorAll('article[data-testid="tweet"]')].map((article) => {
            const href = article.querySelector('time')?.closest('a[href*="/status/"]')?.getAttribute('href')
              || article.querySelector('a[href*="/status/"]')?.getAttribute('href')
              || '';
            return { id: href.match(/\/status\/(\d+)/)?.[1] || '' };
          });
          const focalIndex = rows.findIndex((row) => row.id === focalId);
          if (focalIndex <= 0) return null;
          for (let index = focalIndex - 1; index >= 0; index--) {
            if (parentSet.has(rows[index].id)) return rows[index].id;
          }
          return null;
        }, { focalId: responseId, parentIds });
        if (!parentOurTweetId) continue;
        const response = normalizeTargetTweet({
          ...post,
          id: responseId,
          username: targetUsername,
          permanentUrl: post.url,
          isReply: true,
        }, targetUsername);
        seenTweetIds.add(responseId);
        responses.push({ ...response, responseType: 'reply', parentOurTweetId });
        acceptedByTarget.set(targetUsername, (acceptedByTarget.get(targetUsername) || 0) + 1);
      } catch (error) {
        errors.push({ targetUsername, error: xReadErrorMessage(error, { credentialed: true }) });
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return {
    responses,
    errors,
    bounds: {
      targets: targets.length,
      parents: parentIds.length,
      responsesPerTarget: responseLimit,
      searchLimit,
      truncatedTargets: Math.max(0, normalizedTargets.length - targets.length),
    },
    filters: { since: sinceTimestamp, account: cleanAccount },
  };
}

function parseXStatusUrl(input) {
  try {
    const url = new URL(String(input || ''));
    const host = url.hostname.toLowerCase();
    if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(host)) return null;
    const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    return match ? { username: match[1], id: match[2], url: `https://x.com/${match[1]}/status/${match[2]}` } : null;
  } catch {
    return null;
  }
}

export async function fetchXPostContext(inputUrl) {
  const target = parseXStatusUrl(inputUrl);
  if (!target) return { post: null, context: [], error: 'Invalid X status URL.' };
  try {
    const scraper = await createAuthenticatedXScraper();
    const tweet = await scraper.getTweet(target.id);
    if (!tweet) return { post: null, context: [], error: 'X post was not observable.' };
    const post = normalizeTargetTweet(tweet, target.username);
    const context = [post];
    const relatedIds = [...new Set([post.inReplyToStatusId, post.quotedStatusId].filter(Boolean))];
    for (const id of relatedIds) {
      try {
        const relatedTweet = await scraper.getTweet(id);
        if (!relatedTweet) continue;
        const related = normalizeTargetTweet(relatedTweet, relatedTweet.username || target.username);
        if (related.id && related.id !== post.id) context.push(related);
      } catch {
        // Exact source post remains valid context when related content is unavailable.
      }
    }
    return { post, context, error: null };
  } catch (error) {
    return { post: null, context: [], error: xReadErrorMessage(error, { credentialed: Boolean(process.env.AUTH_TOKEN) }) };
  }
}

export const ACCOUNT_PERFORMANCE_CAPABILITIES = Object.freeze({
  bookmarks: Object.freeze({ available: true, field: 'bookmarkCount', source: 'xactions_scraper_tweet' }),
  profileClicks: Object.freeze({ available: false, reason: 'The current Scraper.getTweets owned-post measurement path does not expose profile-click analytics.' }),
  urlClicks: Object.freeze({ available: false, reason: 'The current Scraper.getTweets owned-post measurement path does not expose URL-click analytics.' }),
});

export async function fetchAccountPerformance(username = 'ham_zax', limit = 20) {
  try {
    const scraper = new Scraper();
    if (process.env.AUTH_TOKEN) {
      const cookies = [{ name: 'auth_token', value: process.env.AUTH_TOKEN }];
      if (process.env.CT0) cookies.push({ name: 'ct0', value: process.env.CT0 });
      await scraper.setCookies(cookies);
    }

    const profile = await scraper.getProfile(username);
    const posts = [];
    for await (const tweet of scraper.getTweets(username, Math.max(limit * 2, limit))) {
      if (tweet.isRetweet || tweet.isReply) continue;
      posts.push({
        id: tweet.id,
        text: (tweet.text || tweet.fullText || '').replace(/\s+/g, ' ').trim(),
        likes: Number(tweet.likes || 0),
        retweets: Number(tweet.retweets || 0),
        replies: Number(tweet.replies || 0),
        bookmarks: tweet.bookmarkCount == null ? null : Number(tweet.bookmarkCount),
        views: Number(tweet.views || 0),
        timestamp: tweet.timestamp || (tweet.timeParsed ? Date.parse(tweet.timeParsed) : 0),
        url: tweet.permanentUrl || (tweet.id ? `https://x.com/${username}/status/${tweet.id}` : ''),
      });
      if (posts.length >= limit) break;
    }
    return { profile, posts, error: null };
  } catch (error) {
    return { profile: null, posts: [], error: xReadErrorMessage(error, { credentialed: Boolean(process.env.AUTH_TOKEN) }) };
  }
}

const X_UNDER_THE_HOOD_URL = 'https://x.com/i/under_the_hood';
const X_UNDER_THE_HOOD_TIMEOUT_MS = 12_000;

function findNestedValue(value, keys, depth = 0) {
  if (depth > 12 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNestedValue(item, keys, depth + 1);
      if (found != null) return found;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  for (const key of keys) {
    if (Object.hasOwn(value, key) && value[key] != null) return value[key];
  }
  for (const child of Object.values(value)) {
    const found = findNestedValue(child, keys, depth + 1);
    if (found != null) return found;
  }
  return null;
}

function optionalUnderTheHoodNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : null;
}

function normalizedUnderTheHoodLabel(label, kind) {
  if (!label || typeof label !== 'object') return null;
  const normalized = {
    label: String(label.label || '').trim(),
    about: String(label.about || '').trim(),
    effect: String(label.effect || '').trim(),
  };
  if (!normalized.label) return null;
  if (kind === 'account') {
    normalized.days = optionalUnderTheHoodNumber(label.days);
    normalized.daysInPeriod = optionalUnderTheHoodNumber(label.daysInPeriod);
    normalized.percentageOfDays = String(label.percentageOfDays || '').trim() || null;
  } else {
    normalized.posts = optionalUnderTheHoodNumber(label.posts);
    normalized.totalPostsInMonth = optionalUnderTheHoodNumber(label.totalPostsInMonth);
    normalized.percentageOfPosts = String(label.percentageOfPosts || '').trim() || null;
  }
  return normalized;
}

function normalizeUnderTheHoodPayload(payload, capturedAt) {
  const reportValue = findNestedValue(payload, ['reportJson', 'report_json']);
  let report = reportValue;
  if (typeof reportValue === 'string') {
    try {
      report = JSON.parse(reportValue);
    } catch {
      return null;
    }
  }
  if (!report || typeof report !== 'object'
    || !Array.isArray(report.accountLabels)
    || !Array.isArray(report.postLabels)) return null;

  const reportInfo = findNestedValue(payload, ['reportInfo', 'report_info']);
  const periodValue = report.period && typeof report.period === 'object' ? report.period : null;
  const period = periodValue || reportInfo?.reportPeriod
    ? {
        label: String(reportInfo?.reportPeriod || '').trim() || null,
        startDate: String(periodValue?.startDate || '').trim() || null,
        endDate: String(periodValue?.endDate || '').trim() || null,
        timezone: String(periodValue?.timezone || '').trim() || null,
      }
    : null;

  return {
    available: true,
    capturedAt,
    accountLabels: report.accountLabels.map((label) => normalizedUnderTheHoodLabel(label, 'account')).filter(Boolean),
    postLabels: report.postLabels.map((label) => normalizedUnderTheHoodLabel(label, 'post')).filter(Boolean),
    period,
    rawSummary: {
      generatedAt: String(report.generatedAt || '').trim() || null,
      postCount: optionalUnderTheHoodNumber(report.postCount),
      totalAccountLabels: optionalUnderTheHoodNumber(report.totalAccountLabels),
      totalPostLabels: optionalUnderTheHoodNumber(report.totalPostLabels),
      eligibilityChecks: reportInfo?.eligibilityChecks && typeof reportInfo.eligibilityChecks === 'object'
        ? { ...reportInfo.eligibilityChecks }
        : {},
    },
  };
}

function unavailableUnderTheHood(capturedAt) {
  return {
    available: false,
    capturedAt,
    reason: 'surface unavailable or not readable',
    accountLabels: [],
    postLabels: [],
    period: null,
    rawSummary: {},
  };
}

export async function fetchXUnderTheHoodReport() {
  const capturedAt = Date.now();
  if (!process.env.AUTH_TOKEN) return unavailableUnderTheHood(capturedAt);

  let browser;
  try {
    browser = await createBrowser({ headless: true });
    const page = await createPage(browser);
    const cookies = [{
      name: 'auth_token',
      value: process.env.AUTH_TOKEN,
      domain: '.x.com',
      path: '/',
      httpOnly: true,
      secure: true,
    }];
    if (process.env.CT0) {
      cookies.push({
        name: 'ct0',
        value: process.env.CT0,
        domain: '.x.com',
        path: '/',
        secure: true,
      });
    }
    await page.setCookie(...cookies);

    const reportResponse = page.waitForResponse(
      (response) => response.url().includes('/graphql/') && /under.?the.?hood/i.test(response.url()),
      { timeout: X_UNDER_THE_HOOD_TIMEOUT_MS },
    ).catch(() => null);
    await page.goto(X_UNDER_THE_HOOD_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });

    const response = await reportResponse;
    if (!response) return unavailableUnderTheHood(capturedAt);
    const payload = await response.json().catch(() => null);
    return normalizeUnderTheHoodPayload(payload, capturedAt) || unavailableUnderTheHood(capturedAt);
  } catch {
    return unavailableUnderTheHood(capturedAt);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function fetchXSearchPosts(query, limit = 30, filter = 'live', passes = 4) {
  if (!process.env.AUTH_TOKEN) return { posts: [], error: 'Missing AUTH_TOKEN.' };

  const browser = await createBrowser({ headless: true });
  try {
    const page = await createPage(browser);
    await setAuthenticatedXPageCookies(page);
    const queries = Array.isArray(query) ? query : [query];
    const queryBuckets = [];
    const perQueryLimit = Math.max(10, Math.ceil(limit / Math.max(1, queries.length)));

    for (const searchQuery of queries) {
      await page.goto(`https://x.com/search?q=${encodeURIComponent(searchQuery)}&src=typed_query&f=${filter}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      });
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10_000 }).catch(() => {});

      const collected = new Map();
      for (let pass = 0; pass < passes && collected.size < perQueryLimit; pass++) {
        const posts = await page.evaluate(() => {
          const parseCount = (value) => {
            const text = String(value || '').replace(/,/g, '').trim();
            const match = text.match(/^([\d.]+)([KMB])?$/i);
            if (!match) return 0;
            const multiplier = { K: 1e3, M: 1e6, B: 1e9 }[(match[2] || '').toUpperCase()] || 1;
            return Math.round(Number(match[1]) * multiplier);
          };
          const metric = (label, name) => {
            const match = String(label || '').match(new RegExp(`([\\d.,]+[KMB]?)\\s+${name}`, 'i'));
            return parseCount(match?.[1]);
          };

          return [...document.querySelectorAll('article[data-testid="tweet"]')].map((article) => {
            const timeEl = article.querySelector('time');
            const statusLink = timeEl?.closest('a[href*="/status/"]') || article.querySelector('a[href*="/status/"]');
            const authorLink = article.querySelector('[data-testid="User-Name"] a[href^="/"]');
            const textEl = article.querySelector('[data-testid="tweetText"]');
            const groupLabel = article.querySelector('div[role="group"][aria-label]')?.getAttribute('aria-label') || '';
            const url = statusLink?.href || '';
            const id = url.match(/status\/(\d+)/)?.[1];
            const username = authorLink?.getAttribute('href')?.split('/').filter(Boolean)[0];
            return {
              id,
              username,
              text: textEl?.textContent?.trim() || '',
              timestamp: timeEl?.getAttribute('datetime') || '',
              likes: metric(groupLabel, 'likes?'),
              retweets: metric(groupLabel, 'reposts?'),
              replies: metric(groupLabel, 'repl(?:y|ies)'),
              views: metric(groupLabel, 'views?'),
              url,
            };
          }).filter((post) => post.id && post.username && post.text);
        });

        for (const post of posts) collected.set(post.id, post);
        if (collected.size >= perQueryLimit) break;
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      queryBuckets.push([...collected.values()]);
    }

    const balanced = [];
    const seen = new Set();
    const maxBucketSize = Math.max(0, ...queryBuckets.map((bucket) => bucket.length));
    for (let index = 0; index < maxBucketSize && balanced.length < limit; index++) {
      for (const bucket of queryBuckets) {
        const post = bucket[index];
        if (!post || seen.has(post.id)) continue;
        seen.add(post.id);
        balanced.push(post);
        if (balanced.length >= limit) break;
      }
    }

    const posts = balanced.map((post) => ({
      source: 'x',
      id: post.id,
      username: post.username,
      author: `@${post.username}`,
      text: post.text.replace(/\s+/g, ' ').trim(),
      likes: post.likes,
      retweets: post.retweets,
      replies: post.replies,
      views: post.views,
      timestamp: post.timestamp ? Date.parse(post.timestamp) : 0,
      url: post.url,
    }));
    return { posts, error: null };
  } catch (error) {
    const message = xReadErrorMessage(error, { credentialed: true });
    console.warn(`[x] niche search failed: ${message}`);
    return { posts: [], error: message };
  } finally {
    await browser.close();
  }
}

function selectRotatingXQueryGroups(kind, now = Date.now()) {
  const profile = getActiveNicheProfile();
  const all = getXSearchQueryGroups();
  const configuredBudget = kind === 'momentum'
    ? profile.discovery?.momentumQueryBudget
    : profile.discovery?.latestQueryBudget;
  const budget = Math.max(1, Math.min(all.length || 1, Number(configuredBudget || 1)));
  if (all.length <= budget) return all;

  const byTag = new Map();
  for (const group of all) {
    const bucket = byTag.get(group.tag) || [];
    bucket.push(group);
    byTag.set(group.tag, bucket);
  }
  const tags = [...byTag.keys()];
  if (!tags.length) return [];
  const rotationMinutes = Math.max(1, Number(profile.discovery?.rotationMinutes || 15));
  const slot = Math.floor(Number(now) / (rotationMinutes * 60_000));
  const sourceOffset = kind === 'momentum' ? Math.floor(tags.length / 2) : 0;
  const start = ((slot * budget) + sourceOffset) % tags.length;
  const orderedTags = Array.from({ length: tags.length }, (_, index) => tags[(start + index) % tags.length]);
  const selected = [];
  for (let depth = 0; selected.length < budget; depth++) {
    let added = false;
    for (const tag of orderedTags) {
      const bucket = byTag.get(tag) || [];
      if (depth >= bucket.length) continue;
      const index = bucket.length > 1 ? (slot + depth) % bucket.length : 0;
      const query = bucket[index];
      if (selected.some((item) => item.query === query.query)) continue;
      selected.push(query);
      added = true;
      if (selected.length >= budget) break;
    }
    if (!added) break;
  }
  return selected;
}

export async function fetchXNichePosts(limit = 30) {
  const queries = selectRotatingXQueryGroups('latest').map(({ query }) => `(${query}) lang:en -filter:replies -filter:retweets`);
  if (!queries.length) return { posts: [], error: 'Growth Focus has no preferred or exploratory technical terms for X discovery.' };
  const result = await fetchXSearchPosts(queries, limit, 'live', 3);
  if (result.error) return result;
  return {
    ...result,
    posts: [...result.posts].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)),
  };
}

export async function fetchXViralPosts(limit = 60, passes = 4, fast = false) {
  const cutoff = Date.now() - 24 * 3_600_000;
  const since = new Date(cutoff).toISOString().slice(0, 10);
  const queryGroups = getXSearchQueryGroups();
  const selectedGroups = fast ? selectRotatingXQueryGroups('momentum') : queryGroups;
  const queries = selectedGroups.map(({ query }) => `(${query}) since:${since} lang:en -filter:replies -filter:retweets`);
  if (!queries.length) return { posts: [], error: 'Growth Focus has no preferred or exploratory technical terms for X momentum discovery.' };
  const result = await fetchXSearchPosts(queries, limit, 'top', passes);
  if (result.error) return result;
  return {
    posts: result.posts.filter((post) => post.timestamp >= cutoff && post.timestamp <= Date.now() + 300_000),
    error: null,
  };
}

// ============================================================================
// 4. Thread Generator (Converts News into an X Thread)
// ============================================================================
export function generateNewsThread(hnStories, ghRepos, xPosts) {
  const thread = [];

  // Tweet 1: Intro / HN Highlights
  let tweet1 = '⚡ Top Tech & Dev News Today (Thread 🧵)\n\n🔥 Hacker News Highlights:';
  if (Array.isArray(hnStories)) {
    hnStories.slice(0, 2).forEach((s, idx) => {
      tweet1 += `\n• ${s.title.substring(0, 75)}... (${s.score} pts)`;
    });
  }
  thread.push(tweet1);

  // Tweet 2: GitHub Trending Repos
  let tweet2 = '⭐ Trending Open Source Projects on GitHub:\n';
  if (Array.isArray(ghRepos)) {
    ghRepos.slice(0, 2).forEach((r) => {
      tweet2 += `\n• ${r.name} [${r.language}]: ${r.description.substring(0, 60)}... (⭐ ${r.stars.toLocaleString()})`;
    });
  }
  thread.push(tweet2);

  // Tweet 3: X highlight with a stable 280-character bound.
  if (Array.isArray(xPosts) && xPosts[0]) {
    thread.push(fitWithUrl(`🚀 Tech signal from ${xPosts[0].author}:\n\n`, xPosts[0].text, xPosts[0].url));
  } else if (Array.isArray(hnStories) && hnStories[0]) {
    thread.push(fitWithUrl('🚀 Tech signal:\n\n', hnStories[0].title, hnStories[0].url));
  } else {
    thread.push('🚀 Tech signal: no additional high-confidence item in this digest.');
  }

  return thread;
}

function configuredTopics() {
  if (process.env.TOPICS) {
    return process.env.TOPICS.split(',').map((topic) => topic.trim().toLowerCase()).filter(Boolean);
  }
  const profile = getActiveNicheProfile();
  const preferred = getActiveContentGroups().flatMap((group) => group.terms);
  const exploratory = profile.exploration.enabled
    ? profile.audienceGroups.filter((group) => group.discover !== false).flatMap((group) => group.terms)
    : [];
  return [...new Set([...preferred, ...exploratory])];
}

function relevanceScore(text, topics) {
  const haystack = String(text || '').toLowerCase();
  return Math.min(30, topics.filter((topic) => haystack.includes(topic)).length * 10);
}

function freshnessScore(timestamp) {
  if (!timestamp) return 0;
  const hoursOld = Math.max((Date.now() - timestamp) / 3_600_000, 0);
  return Math.max(0, 20 - hoursOld / 6);
}

export function rankXViralPosts(xPosts = []) {
  const now = Date.now();
  const cutoff = now - 24 * 3_600_000;

  return xPosts
    .map((post) => {
      if (!post.timestamp || post.timestamp < cutoff || post.timestamp > now + 300_000) return null;
      const niche = classifyNiche(post.text);
      if (niche.score === 0) return null;

      const ageHours = Math.max((now - post.timestamp) / 3_600_000, 0.25);
      const views = Number(post.views || 0);
      const likes = Number(post.likes || 0);
      const retweets = Number(post.retweets || 0);
      const replies = Number(post.replies || 0);
      const engagements = likes + retweets * 2 + replies * 1.5;
      const viewsPerHour = views / ageHours;
      const engagementsPerHour = engagements / ageHours;
      const qualifies = views >= 5_000
        || likes >= 75
        || retweets >= 15
        || replies >= 20
        || viewsPerHour >= 500
        || engagementsPerHour >= 8;
      if (!qualifies) return null;

      const totalSignal = views + likes * 40 + retweets * 120 + replies * 80;
      const velocitySignal = viewsPerHour + engagementsPerHour * 100;
      const score = Math.round(Math.min(
        100,
        Math.log10(totalSignal + 1) * 7
          + Math.log10(velocitySignal + 1) * 7
          + niche.score * 0.25
      ));
      const tier = views >= 100_000 || likes >= 1_000 || retweets >= 200
        ? 'breakout'
        : views >= 25_000 || likes >= 250 || retweets >= 50 || replies >= 50
          ? 'viral'
          : 'rising';

      return {
        key: post.url,
        source: 'x',
        title: post.author,
        text: post.text,
        url: post.url,
        score,
        timestamp: post.timestamp,
        niche,
        metrics: { likes, retweets, replies, views },
        viral: {
          score,
          tier,
          ageHours,
          viewsPerHour,
          engagementsPerHour,
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

export function rankNews({ hnStories = [], ghRepos = [], xPosts = [] }, topics = configuredTopics()) {
  const candidates = [];

  if (Array.isArray(hnStories)) {
    for (const story of hnStories) {
      const momentum = Math.min(50, story.score / 18 + story.comments / 25);
      candidates.push({
        key: story.url,
        source: 'hn',
        title: story.title,
        text: story.title,
        url: story.url,
        timestamp: story.timestamp,
        score: Math.round(Math.min(100, momentum + relevanceScore(story.title, topics) + freshnessScore(story.timestamp))),
        metrics: { points: story.score, comments: story.comments, by: story.by || '', rank: story.rank || null, hnUrl: story.hnUrl || '' },
      });
    }
  }

  if (Array.isArray(ghRepos)) {
    for (const repo of ghRepos) {
      const momentum = Math.min(50, Math.log10(Number(repo.starsToday || 0) + 1) * 22);
      const text = `${repo.name} ${repo.description}`;
      candidates.push({
        key: repo.url,
        source: 'github',
        title: repo.name,
        text: repo.description,
        url: repo.url,
        timestamp: repo.fetchedAt || Date.now(),
        score: Math.round(Math.min(100, momentum + relevanceScore(text, topics) + freshnessScore(repo.fetchedAt))),
        metrics: {
          stars: repo.stars,
          starsToday: repo.starsToday,
          forks: repo.forks,
          language: repo.language,
          rank: repo.rank || null,
        },
      });
    }
  }

  if (Array.isArray(xPosts)) {
    for (const post of xPosts) {
      const niche = classifyNiche(post.text);
      if (niche.score === 0) continue;
      const engagement = post.views + post.likes * 20 + post.retweets * 50 + post.replies * 20;
      const momentum = Math.min(35, Math.log10(engagement + 1) * 7);
      candidates.push({
        key: post.url,
        source: 'x',
        title: post.author,
        text: post.text,
        url: post.url,
        timestamp: post.timestamp,
        score: Math.round(Math.min(100, momentum + niche.score + freshnessScore(post.timestamp))),
        niche,
        metrics: { likes: post.likes, retweets: post.retweets, replies: post.replies, views: post.views },
      });
    }
  }

  return [...new Map(candidates.map((candidate) => [candidate.key, candidate])).values()]
    .sort((a, b) => b.score - a.score);
}

function fitWithUrl(prefix, body, url) {
  const suffix = `\n\n${url}`;
  const maxBody = Math.max(0, 280 - prefix.length - suffix.length);
  const trimmed = body.length > maxBody
    ? `${body.slice(0, Math.max(0, maxBody - 1)).trimEnd()}…`
    : body;
  return `${prefix}${trimmed}${suffix}`;
}

export function generateMomentumPost(candidate) {
  if (!candidate) throw new Error('No ranked candidate available.');

  if (candidate.source === 'github') {
    if (candidate.metrics?.starsToday != null) {
      const metrics = candidate.metrics.starsToday ? ` (${candidate.metrics.starsToday} stars today)` : '';
      return fitWithUrl(`GitHub Trending: ${candidate.title}\n\n`, `${candidate.text}${metrics}`, candidate.url);
    }
    const legacyMetrics = candidate.metrics?.starsPerDay ? ` (~${candidate.metrics.starsPerDay} stars/day since creation)` : '';
    return fitWithUrl(`Legacy GitHub discovery: ${candidate.title}\n\n`, `${candidate.text}${legacyMetrics}`, candidate.url);
  }

  if (candidate.source === 'hn') {
    const metrics = ` (${candidate.metrics?.points || 0} pts, ${candidate.metrics?.comments || 0} comments)`;
    return fitWithUrl('Worth watching on Hacker News:\n\n', `${candidate.title}${metrics}`, candidate.url);
  }

  return fitWithUrl(`Worth watching from ${candidate.title}:\n\n`, candidate.text, candidate.url);
}

// ============================================================================
// Main Execution
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  const showHn = args.includes('--hn') || (!args.includes('--github') && !args.includes('--x'));
  const showGithub = args.includes('--github') || (!args.includes('--hn') && !args.includes('--x'));
  const showX = args.includes('--x') || (!args.includes('--hn') && !args.includes('--github'));
  const toThread = args.includes('--to-thread');
  const showRanked = args.includes('--ranked');
  const toPost = args.includes('--to-post');
  const jsonOutput = args.includes('--json');
  const xAccounts = (process.env.X_NEWS_ACCOUNTS || 'github,OpenAI,ycombinator,TechCrunch')
    .split(',')
    .map((account) => account.trim().replace(/^@/, ''))
    .filter(Boolean);

  let limit = 5;
  const limitArg = args.find((a) => a.startsWith('--limit=') || a === '-l');
  if (limitArg) {
    if (limitArg.includes('=')) {
      limit = parseInt(limitArg.split('=')[1], 10) || 5;
    } else {
      const idx = args.indexOf(limitArg);
      if (args[idx + 1]) limit = parseInt(args[idx + 1], 10) || 5;
    }
  }

  if (!jsonOutput) {
    console.log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}  🚀 LATEST TECH & DEVELOPER NEWS DIGEST${colors.reset}`);
    console.log(`${colors.dim}  ${new Date().toLocaleString()} | Powered by XActions & APIs${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);
    console.log(`${colors.yellow}⏳ Fetching latest updates from Hacker News, GitHub & X...${colors.reset}\n`);
  }

  const [hnResult, ghResult, xResult] = await Promise.allSettled([
    showHn ? fetchHackerNews(limit) : Promise.resolve([]),
    showGithub ? fetchGitHubTrending(limit) : Promise.resolve([]),
    showX ? fetchXTechNews(xAccounts, Math.max(1, Math.min(limit, 3))) : Promise.resolve([]),
  ]);

  const hnStories = hnResult.status === 'fulfilled' ? hnResult.value : { error: hnResult.reason };
  const ghRepos = ghResult.status === 'fulfilled' ? ghResult.value : { error: ghResult.reason };
  const xPosts = xResult.status === 'fulfilled' ? xResult.value : { error: xResult.reason };
  const ranked = rankNews({ hnStories, ghRepos, xPosts });

  if (jsonOutput) {
    console.log(JSON.stringify({ hnStories, ghRepos, xPosts, ranked }, null, 2));
    return;
  }

  // --- Display Hacker News ---
  if (showHn) {
    console.log(`${colors.bold}${colors.magenta}🔥 TOP HACKER NEWS STORIES${colors.reset}`);
    console.log(`${colors.dim}------------------------------------------------------${colors.reset}`);
    if (hnStories.error) {
      console.log(`${colors.red}  Error fetching HN: ${hnStories.error}${colors.reset}`);
    } else if (Array.isArray(hnStories) && hnStories.length > 0) {
      hnStories.forEach((s, idx) => {
        console.log(`  ${colors.bold}${idx + 1}. ${s.title}${colors.reset}`);
        console.log(`     ${colors.green}⭐ ${s.score} points${colors.reset} | ${colors.cyan}💬 ${s.comments} comments${colors.reset} | by ${colors.yellow}${s.by}${colors.reset}`);
        console.log(`     ${colors.dim}🔗 ${s.url}${colors.reset}\n`);
      });
    } else {
      console.log('  No stories found.\n');
    }
  }

  // --- Display GitHub Trending ---
  if (showGithub) {
    console.log(`${colors.bold}${colors.green}⭐ GITHUB TRENDING — TODAY${colors.reset}`);
    console.log(`${colors.dim}------------------------------------------------------${colors.reset}`);
    if (ghRepos.error) {
      console.log(`${colors.red}  Error fetching GitHub: ${ghRepos.error}${colors.reset}`);
    } else if (Array.isArray(ghRepos) && ghRepos.length > 0) {
      ghRepos.forEach((r, idx) => {
        console.log(`  ${colors.bold}${idx + 1}. ${r.name}${colors.reset} ${colors.yellow}[${r.language}]${colors.reset}`);
        console.log(`     ${r.description}`);
        console.log(`     ${colors.green}⭐ ${r.stars.toLocaleString()} stars${colors.reset} | ${colors.cyan}🍴 ${r.forks.toLocaleString()} forks${colors.reset}`);
        console.log(`     ${colors.yellow}⚡ ${Number(r.starsToday || 0).toLocaleString()} stars today · source rank #${r.rank || idx + 1}${colors.reset}`);
        console.log(`     ${colors.dim}🔗 ${r.url}${colors.reset}\n`);
      });
    } else {
      console.log('  No repositories found.\n');
    }
  }

  // --- Display X Tech Highlights ---
  if (showX) {
    console.log(`${colors.bold}${colors.blue}🐦 X/TWITTER TECH & DEV HIGHLIGHTS${colors.reset}`);
    console.log(`${colors.dim}------------------------------------------------------${colors.reset}`);
    if (xPosts.error) {
      console.log(`${colors.red}  Error fetching X posts: ${xPosts.error}${colors.reset}`);
    } else if (Array.isArray(xPosts) && xPosts.length > 0) {
      xPosts.forEach((t, idx) => {
        console.log(`  ${colors.bold}${idx + 1}. ${colors.cyan}${t.author}${colors.reset}`);
        console.log(`     ${t.text}`);
        console.log(`     ${colors.green}❤️ ${t.likes.toLocaleString()} likes${colors.reset} | ${colors.yellow}🔁 ${t.retweets.toLocaleString()} retweets${colors.reset} | ${colors.dim}👁️ ${t.views.toLocaleString()} views${colors.reset}`);
        console.log(`     ${colors.dim}🔗 ${t.url}${colors.reset}\n`);
      });
    } else {
      console.log(`  No tweets found.\n`);
    }
  }

  // --- Option: To Thread Format ---
  if (toThread) {
    const thread = generateNewsThread(hnStories, ghRepos, xPosts);
    console.log(`${colors.bold}${colors.yellow}🧵 GENERATED X THREAD READY TO POST:${colors.reset}`);
    console.log(`${colors.dim}------------------------------------------------------${colors.reset}`);
    thread.forEach((t, i) => {
      console.log(`\n--- Tweet ${i + 1}/${thread.length} (${t.length}/280 chars) ---`);
      console.log(t);
    });
    console.log(`\n💡 To publish this thread, run:`);
    console.log(`   node post_thread.js ${thread.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(' ')}`);
  }

  if (showRanked) {
    console.log(`\n${colors.bold}${colors.cyan}📈 RANKED MOMENTUM CANDIDATES${colors.reset}`);
    ranked.slice(0, limit).forEach((candidate, index) => {
      console.log(`  ${index + 1}. [${candidate.score}/100] ${candidate.source.toUpperCase()} — ${candidate.title}`);
      console.log(`     ${colors.dim}${candidate.url}${colors.reset}`);
    });
  }

  if (toPost && ranked[0]) {
    const post = generateMomentumPost(ranked[0]);
    console.log(`\n${colors.bold}${colors.yellow}✍️ TOP MOMENTUM POST (${post.length}/280)${colors.reset}`);
    console.log(post);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('Error running news digest:', err);
    process.exit(1);
  });
}
