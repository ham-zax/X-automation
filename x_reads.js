// Cheap read-only X lookups through the XActions HTTP client. This is an optional
// fast lane: every failure reports `fallback: 'browser'` and the authorized browser
// observation remains the route that always works. Nothing here can mutate X.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const X_READ_KINDS = Object.freeze(['mentions', 'post', 'thread', 'own-replies', 'replied']);
const STATUS_STALE_MS = 48 * 60 * 60 * 1000;
const READ_TIMEOUT_MS = 30_000;
const MAX_LIMIT = 40;

export function xactionsHome(env = process.env) {
  return path.resolve(env.X_GROWTH_XACTIONS_HOME || '.xactions-upstream');
}

export function readXactionsStatus({ env = process.env, now = Date.now() } = {}) {
  const use = 'x-read {"kind":"mentions|post|thread|own-replies|replied","id":"<tweetId>"}; on ok:false read through the browser.';
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

  async function search(query, limit) {
    const posts = [];
    for await (const tweet of scraper.searchTweets(query, limit)) {
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
    mentions: (limit) => search(`to:${ownHandle}`, clampLimit(limit, 20)),
    ownReplies: (limit) => search(`from:${ownHandle} filter:replies`, clampLimit(limit, 20)),
    async thread(id, limit) {
      const root = await post(id);
      const posts = await search(`conversation_id:${root.conversationId || root.id}`, clampLimit(limit, 20));
      if (!posts.some((item) => item.id === root.id)) posts.push(root);
      return posts.sort((a, b) => String(a.at).localeCompare(String(b.at)));
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
  try {
    if (kind !== 'mentions' && kind !== 'own-replies') tweetId(payload.id, `x-read ${kind}`);
    const reader = await createXReader(options);
    const base = { ok: true, kind, source: reader.source };
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
    if (own.length) {
      await run('post', async () => {
        const found = await reader.post(own[0].id);
        if (found.id !== own[0].id || !found.author) throw new Error('Post read returned the wrong id or no author.');
        return { count: 1 };
      });
      await run('thread', async () => ({ count: (await reader.thread(own[0].id, 5)).length }));
    }
  }
  return { ok: checks.length === 5 && checks.every((check) => check.ok), checks };
}
