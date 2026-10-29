// Cheap read-only X lookups through the XActions HTTP client. This is an optional
// fast lane: every failure reports `fallback: 'browser'` and the authorized browser
// observation remains the route that always works. Nothing here can mutate X.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const X_READ_KINDS = Object.freeze(['mentions', 'post', 'thread', 'own-replies', 'replied', 'replies', 'search']);
const STATUS_STALE_MS = 48 * 60 * 60 * 1000;
const READ_TIMEOUT_MS = 30_000;
const MAX_LIMIT = 40;
const MAX_QUERY_LENGTH = 300;
const SEARCH_MODES = Object.freeze({ top: 'Top', latest: 'Latest' });
const RESPONSE_MENTION_LIMIT = 40;
const RESPONSE_PARENT_LIMIT = 100;
const RESPONSE_ERROR_LIMIT = 300;
const TWEET_ID_PATTERN = /^\d{5,25}$/;
const HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/;

export function xactionsHome(env = process.env) {
  return path.resolve(env.X_GROWTH_XACTIONS_HOME || '.xactions-upstream');
}

export function readXactionsStatus({ env = process.env, now = Date.now() } = {}) {
  const use = 'x-read {"kind":"mentions|post|thread|own-replies|replied|replies","id":"<tweetId>"} or {"kind":"search","query":"<X search query>","mode":"top|latest"}; on ok:false read through the browser. The For You feed is browser-only.';
  let status;
  try {
    status = JSON.parse(fs.readFileSync(path.join(xactionsHome(env), 'status.json'), 'utf8'));
  } catch {
    return { healthy: null, pinnedCommit: null, note: 'Never checked. Run ops/xactions_update.mjs.', use };
  }
  return {
    healthy: status.healthy === true,
    pinnedCommit: status.pinnedCommit ? String(status.pinnedCommit).slice(0, 7) : null,
    pinnedAt: status.pinnedAt || null,
    checkedAt: status.checkedAt || null,
    stale: !Number.isFinite(Date.parse(status.checkedAt)) || now - Date.parse(status.checkedAt) > STATUS_STALE_MS,
    ...(status.healthy === true ? {} : { reason: status.reason || 'Last smoke test failed.' }),
    ...(status.candidate ? { candidate: status.candidate } : {}),
    use,
  };
}

// The promoted upstream checkout when one exists, otherwise the installed package.
async function loadScraper({ dir, env }) {
  const pinned = dir || path.join(xactionsHome(env), 'current');
  if (dir || fs.existsSync(pinned)) {
    const entry = path.join(fs.realpathSync(pinned), 'src/client/index.js');
    return { Scraper: (await import(pathToFileURL(entry).href)).Scraper, source: 'xactions-upstream' };
  }
  return { Scraper: (await import('xactions/client')).Scraper, source: 'xactions-installed' };
}

function slimPost(tweet) {
  if (!tweet?.id) return null;
  const author = tweet.username || null;
  return {
    id: String(tweet.id),
    author,
    text: String(tweet.text || ''),
    inReplyTo: tweet.inReplyToStatusId ? String(tweet.inReplyToStatusId) : null,
    conversationId: tweet.conversationId ? String(tweet.conversationId) : null,
    at: tweet.timeParsed ? new Date(tweet.timeParsed).toISOString() : null,
    likes: tweet.likes ?? null,
    replies: tweet.replies ?? null,
    reposts: tweet.retweets ?? null,
    views: tweet.views ?? null,
    url: author ? `https://x.com/${author}/status/${tweet.id}` : `https://x.com/i/status/${tweet.id}`,
  };
}

function tweetId(value, label) {
  const id = String(value || '').match(/(?:status\/)?(\d{5,25})\/?$/)?.[1];
  if (!id) throw new Error(`${label} requires a tweet id or status URL.`);
  return id;
}

function searchRequest(payload) {
  const query = String(payload.query || '').replace(/\s+/g, ' ').trim();
  if (!query || query.length > MAX_QUERY_LENGTH) throw new Error(`x-read search requires a query of 1-${MAX_QUERY_LENGTH} characters.`);
  const mode = SEARCH_MODES[String(payload.mode || 'top').toLowerCase()];
  if (!mode) throw new Error('x-read search requires a mode of top or latest.');
  return { query, mode };
}

function repliesRequest(payload) {
  const mode = SEARCH_MODES[String(payload.mode || 'top').toLowerCase()];
  if (!mode) throw new Error('x-read replies requires a mode of top or latest.');
  return { mode };
}

function clampLimit(value, fallback) {
  const limit = Number(value);
  return Number.isFinite(limit) && limit >= 1 ? Math.min(MAX_LIMIT, Math.floor(limit)) : fallback;
}

export async function createXReader({ dir, env = process.env, scraper: injected, handle } = {}) {
  const ownHandle = String(handle || env.X_ACCOUNT || 'ham_zax').replace(/^@/, '');
  let scraper = injected;
  let source = injected ? 'injected' : null;
  if (!scraper) {
    if (!env.AUTH_TOKEN) throw new Error('AUTH_TOKEN is missing.');
    const loaded = await loadScraper({ dir, env });
    source = loaded.source;
    scraper = new loaded.Scraper({ fetch: (url, options = {}) => fetch(url, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(READ_TIMEOUT_MS)]) : AbortSignal.timeout(READ_TIMEOUT_MS),
    }) });
    const cookies = [{ name: 'auth_token', value: env.AUTH_TOKEN }];
    if (env.CT0) cookies.push({ name: 'ct0', value: env.CT0 });
    await scraper.setCookies(cookies);
  }

  async function search(query, limit, mode = SEARCH_MODES.latest) {
    const posts = [];
    for await (const tweet of scraper.searchTweets(query, limit, mode)) {
      const post = slimPost(tweet);
      if (post) posts.push(post);
      if (posts.length >= limit) break;
    }
    return posts;
  }

  async function post(id) {
    const found = slimPost(await scraper.getTweet(tweetId(id, 'post')));
    if (!found) throw new Error('Post not found.');
    return found;
  }

  return {
    source,
    ownHandle,
    post,
    search: (query, mode, limit) => search(query, clampLimit(limit, 10), mode),
    mentions: (limit) => search(`to:${ownHandle}`, clampLimit(limit, 20)),
    ownReplies: (limit) => search(`from:${ownHandle} filter:replies`, clampLimit(limit, 20)),
    async thread(id, limit) {
      const root = await post(id);
      const posts = await search(`conversation_id:${root.conversationId || root.id}`, clampLimit(limit, 20));
      if (!posts.some((item) => item.id === root.id)) posts.push(root);
      return posts.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    },
    // A bounded sample in upstream order, never a complete or globally ranked reply list.
    async replies(id, mode, limit) {
      const target = await post(id);
      const candidates = await search(`conversation_id:${target.conversationId || target.id}`, MAX_LIMIT, mode);
      const seen = new Set([target.id]);
      const posts = [];
      for (const item of candidates) {
        if (seen.has(item.id) || item.inReplyTo !== target.id) continue;
        seen.add(item.id);
        posts.push(item);
      }
      return { target, posts: posts.slice(0, clampLimit(limit, 20)) };
    },
    // Search can lag or omit posts: a found reply is definitive, a miss is not.
    async replied(id) {
      const target = await post(id);
      const ours = await search(`from:${ownHandle} conversation_id:${target.conversationId || target.id}`, 20);
      return { target, ourReplies: ours.filter((item) => item.inReplyTo === target.id) };
    },
  };
}

// Bridge entry: never throws for a read failure, so the agent can switch lanes.
export async function xRead(payload = {}, options = {}) {
  const kind = String(payload.kind || '');
  if (!X_READ_KINDS.includes(kind)) throw new Error(`x-read kind must be one of: ${X_READ_KINDS.join(', ')}.`);
  const request = kind === 'search' ? searchRequest(payload) : null;
  const replies = kind === 'replies' ? repliesRequest(payload) : null;
  try {
    if (!request && kind !== 'mentions' && kind !== 'own-replies') tweetId(payload.id, `x-read ${kind}`);
    const reader = await createXReader(options);
    const base = { ok: true, kind, source: reader.source };
    // Search results are not personalized and are not For You observations.
    if (request) {
      const posts = await reader.search(request.query, request.mode, payload.limit);
      return { ...base, ...request, count: posts.length, posts, note: 'Search finds, not For You observations. Results are unfiltered, so judge each post.' };
    }
    if (replies) {
      const { target, posts } = await reader.replies(payload.id, replies.mode, payload.limit);
      return { ...base, target, mode: replies.mode, observedAt: Date.now(), count: posts.length, posts,
        note: 'Bounded search sample in the selected mode, not complete thread coverage; an empty result is not proof of absence.' };
    }
    if (kind === 'post') return { ...base, posts: [await reader.post(payload.id)] };
    if (kind === 'replied') {
      const { target, ourReplies } = await reader.replied(payload.id);
      return { ...base, replied: ourReplies.length > 0, target, ourReplies,
        ...(ourReplies.length ? {} : { note: 'No reply of ours found. Search can lag, so confirm in the browser before a send.' }) };
    }
    const posts = kind === 'mentions' ? await reader.mentions(payload.limit)
      : kind === 'own-replies' ? await reader.ownReplies(payload.limit)
        : await reader.thread(payload.id, payload.limit);
    return { ...base, count: posts.length, posts,
      ...(posts.length ? {} : { note: 'Empty result. Search can lag, so check the browser before concluding there is nothing.' }) };
  } catch (error) {
    if (/requires a tweet id/.test(String(error?.message))) throw error;
    return { ok: false, kind, fallback: 'browser', reason: String(error?.message || error).slice(0, 300) };
  }
}

function responseHandle(readerOptions = {}) {
  const env = readerOptions.env || process.env;
  return String(readerOptions.handle || env.X_ACCOUNT || 'ham_zax').replace(/^@/, '').trim().toLowerCase();
}

function responseSince(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function responseTimestamp(post) {
  if (!post?.at) return null;
  const timestamp = Date.parse(post.at);
  return Number.isFinite(timestamp) ? timestamp : null;
}

// Mention observation for owned posts. Search can lag or omit posts: a found reply is
// definitive, but a missing mention is not proof that no response exists.
export async function readXTargetResponses(ourTweetIds, { since = null, now = Date.now(), readerOptions = {} } = {}) {
  const parentIds = [...new Set((Array.isArray(ourTweetIds) ? ourTweetIds : [ourTweetIds])
    .map((value) => String(value || '').trim())
    .filter(Boolean))].slice(0, RESPONSE_PARENT_LIMIT);
  const responses = [];
  const errors = [];
  if (!parentIds.length) return { responses, errors };

  const parentSet = new Set(parentIds);
  const observedAt = Number(now);
  const sinceTimestamp = responseSince(since);
  const ownHandle = responseHandle(readerOptions);
  const read = await xRead({ kind: 'mentions', limit: RESPONSE_MENTION_LIMIT }, readerOptions);
  if (!read?.ok) {
    errors.push({
      targetUsername: ownHandle,
      error: String(read?.reason || read?.error || 'mention read failed').slice(0, RESPONSE_ERROR_LIMIT),
    });
    return { responses, errors };
  }

  const seen = new Set();
  for (const post of Array.isArray(read.posts) ? read.posts : []) {
    const id = String(post?.id || '');
    if (!TWEET_ID_PATTERN.test(id) || seen.has(id)) continue;
    const author = String(post?.author || '').replace(/^@/, '').trim().toLowerCase();
    if (!HANDLE_PATTERN.test(author) || author === ownHandle) continue;
    const parentOurTweetId = String(post?.inReplyTo || '');
    if (!parentSet.has(parentOurTweetId)) continue;
    const timestamp = responseTimestamp(post);
    if (timestamp == null || timestamp > observedAt) continue;
    if (sinceTimestamp != null && timestamp < sinceTimestamp) continue;
    seen.add(id);
    responses.push({
      id,
      authorUsername: author,
      targetUsername: author,
      text: String(post.text || ''),
      url: post.url || `https://x.com/${author}/status/${id}`,
      timestamp,
      parentOurTweetId,
      responseType: 'reply',
      observedAt,
      transport: 'http_mentions',
      views: post.views ?? null,
      likes: post.likes ?? null,
      reposts: post.reposts ?? null,
      replies: post.replies ?? null,
    });
  }
  return { responses, errors };
}

// Used by ops/xactions_update.mjs to decide whether a checkout may be promoted.
export async function smokeTestXReads(options = {}) {
  const checks = [];
  const run = async (name, fn) => {
    const startedAt = Date.now();
    try {
      const detail = await fn();
      checks.push({ name, ok: true, ms: Date.now() - startedAt, ...detail });
    } catch (error) {
      checks.push({ name, ok: false, ms: Date.now() - startedAt, error: String(error?.message || error).slice(0, 300) });
    }
    return checks.at(-1).ok;
  };
  let reader;
  let own = [];
  if (await run('load', async () => { reader = await createXReader(options); return { source: reader.source }; })) {
    await run('own-replies', async () => {
      own = await reader.ownReplies(5);
      if (!own.length) throw new Error('Search returned no posts from the account.');
      if (own.some((item) => String(item.author).toLowerCase() !== reader.ownHandle.toLowerCase())) throw new Error('Search returned a post without the expected author.');
      return { count: own.length };
    });
    await run('mentions', async () => ({ count: (await reader.mentions(5)).length }));
    await run('search', async () => {
      const found = await reader.search('javascript min_faves:100 lang:en', SEARCH_MODES.top, 5);
      if (!found.length || found.some((item) => !item.author)) throw new Error('Topic search returned no posts or a post without an author.');
      return { count: found.length };
    });
    if (own.length) {
      await run('post', async () => {
        const found = await reader.post(own[0].id);
        if (found.id !== own[0].id || !found.author) throw new Error('Post read returned the wrong id or no author.');
        return { count: 1 };
      });
      await run('thread', async () => ({ count: (await reader.thread(own[0].id, 5)).length }));
    }
  }
  return { ok: checks.length === 6 && checks.every((check) => check.ok), checks };
}
