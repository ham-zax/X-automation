// Lightpanda-native guarded publisher for the existing Growth OS `act` bridge.
// Exactly one consequential click; no browser fallback or optimistic success.
import { LightpandaMcpClient } from './lightpanda_mcp_client.js';

const TWEET_ID_RE = /^\d{5,25}$/;
const PAGE_READ = `return (() => {
  const editor = document.querySelector('[data-testid="tweetTextarea_0"]')
    || document.querySelector('[role="textbox"][contenteditable="true"]');
  const composer = editor?.closest('[role="dialog"]');
  const btn = composer?.querySelector('[data-testid="tweetButton"]')
    || composer?.querySelector('[data-testid="tweetButtonInline"]');
  // X omits status links in its reply modal. Read only the rendered article's
  // own tweet props; never infer parent identity from the URL or author text.
  function tweetIdentity(article) {
    const key = Object.keys(article).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = key && article[key], depth = 0; fiber && depth < 24; fiber = fiber.return, depth++) {
      if (fiber.stateNode === composer) break;
      const tweet = fiber.memoizedProps?.tweet;
      if (tweet?.id_str) return {
        id: String(tweet.id_str),
        parentId: String(tweet.in_reply_to_status_id_str || ''),
        quoteId: String(tweet.quoted_status_id_str || '')
      };
    }
    return { id: '', parentId: '', quoteId: '' };
  }
  const account = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
  return {
    url: location.href,
    title: document.title,
    account: account?.innerText || account?.getAttribute('aria-label') || '',
    profilePresent: !!account,
    editorText: editor?.innerText || editor?.textContent || '',
    sendButton: btn ? {selector: '[data-testid="'+btn.getAttribute('data-testid')+'"]', text: btn.innerText || '', disabled: !!btn.disabled || btn.getAttribute('aria-disabled') === 'true'} : null,
    context: (composer?.innerText || '').slice(0, 3000),
    composerParents: Array.from(composer?.querySelectorAll('article[data-testid="tweet"]') || []).map(tweetIdentity),
    articles: Array.from(document.querySelectorAll('article[data-testid="tweet"]')).slice(0, 14).map(article => ({
      ...tweetIdentity(article),
      text: article.querySelector('[data-testid="tweetText"]')?.innerText || '',
      links: Array.from(article.querySelectorAll('a[href*="/status/"]')).map(a=>a.href).slice(0,15),
      visible: (article.innerText || '').slice(0, 500)
    }))
  };
})()`;

// Observe only the actual CreateTweet network response in the Lightpanda page.
// This does not dispatch a request or modify content. Store only the minimal
// create-tweet status and structural fields, never headers/cookies/CSRF.
export const SEND_AUDIT_INSTALL = `return (() => {
  if (window.__xGrowthAuditInstalled) return true;
  window.__xGrowthAuditInstalled = true;
  window.__xGrowthTweetReceipts = [];
  const nativeFetch = window.fetch;
  window.fetch = function(...args) {
    const url = String(typeof args[0] === 'string' ? args[0] : args[0]?.url || '');
    const tracked = /\\/CreateTweet(?:\\?|$)/i.test(url);
    const body = tracked && typeof args[1]?.body === 'string' ? args[1].body : '';
    const promise = nativeFetch.apply(this, args);
    if (tracked) Promise.resolve(promise).then(async response => {
      try {
        const payload = JSON.parse(body || '{}');
        const variables = typeof payload.variables === 'string' ? JSON.parse(payload.variables) : payload.variables || {};
        const data = await response.clone().json();
        window.__xGrowthTweetReceipts.push({
          status: response.status,
          text: String(variables.tweet_text || ''),
          parent: String(variables.reply?.in_reply_to_tweet_id || ''),
          attachment: String(variables.attachment_url || ''),
          id: String(data?.data?.create_tweet?.tweet_results?.result?.rest_id || ''),
          errors: Array.isArray(data?.errors) && data.errors.length > 0,
        });
      } catch { /* Incomplete audit evidence remains unresolved. */ }
    }).catch(() => {});
    return promise;
  };
  return true;
})()`;

function parsedValue(result) {
  const values = [result?.data, result?.text];
  for (const value of values) {
    if (value === null || value === undefined) continue;
    let candidate = value;
    for (let i = 0; i < 3; i++) {
      if (typeof candidate === 'string') {
        try { candidate = JSON.parse(candidate); } catch { break; }
      } else if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        if ('url' in candidate && 'profilePresent' in candidate) return candidate;
        candidate = candidate.result ?? candidate.value ?? candidate.data;
      } else break;
    }
    if (candidate && typeof candidate === 'object' && 'url' in candidate && 'profilePresent' in candidate) return candidate;
  }
  return null;
}

async function inspect(client) {
  const data = parsedValue(await client.tool('evaluate', { script: PAGE_READ }, 16000));
  if (!data || typeof data !== 'object') throw new Error('Lightpanda page state cannot be verified');
  return data;
}

function compact(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function parsedReceipts(result) {
  let candidate = result?.data ?? result?.text;
  for (let i = 0; i < 3 && typeof candidate === 'string'; i++) {
    try { candidate = JSON.parse(candidate); } catch { break; }
  }
  return Array.isArray(candidate) ? candidate : [];
}
function acceptedReceipt(receipt, input, now) {
  if (!receipt || !Number.isInteger(receipt.status) || receipt.status < 200 || receipt.status >= 300 || receipt.errors
    || !isFresh(String(receipt.id || ''), now)) return false;
  const actual = compact(receipt.text);
  const expected = compact(input.expectedText);
  if (actual !== expected && !(input.action === 'quote' && actual === compact(`${input.expectedText} ${input.targetUrl}`))) return false;
  if (input.action === 'reply') return String(receipt.parent) === String(input.targetTweetId || '');
  if (receipt.parent) return false;
  if (input.action === 'quote') return new RegExp(`/status/${String(input.targetTweetId)}(?:[/?#]|$)`).test(receipt.attachment);
  return true;
}

function urlTweetId(url, handle) {
  const match = String(url || '').match(/^https:\/\/x\.com\/([A-Za-z0-9_]+)\/status\/(\d+)(?:[/?#]|$)/i);
  return match && match[1].toLowerCase() === handle.toLowerCase() ? match[2] : '';
}
function isFresh(id, now) {
  if (!TWEET_ID_RE.test(id)) return false;
  const snowflakeMs = Number((BigInt(id) >> 22n) + 1288834974657n);
  return Number.isFinite(snowflakeMs) && snowflakeMs >= now - 120000 && snowflakeMs <= Date.now() + 120000;
}

export async function driveLightpandaSend(input, deps = {}) {
  const beforeClick = deps.beforeClick || (() => {});
  const handle = String(process.env.X_ACCOUNT || 'ham_zax').replace(/^@/, '');
  const expected = compact(input.expectedText);
  const clickExpected = input.action === 'quote'
    ? compact(`${input.expectedText}\n\n${input.targetUrl}`) : expected;
  const state = { sent: false, clickedAt: 0 };
  let client;
  try {
    if (!['reply', 'quote', 'original'].includes(input.action) || !expected) {
      return { outcome: 'not_sent', reason: 'invalid_lightpanda_intent', evidence: { sendBoundaryCrossed: false, notSentProof: { kind: 'mutation_not_dispatched', detail: 'Invalid action or text; no browser operation attempted.' } } };
    }
    client = deps.client || new LightpandaMcpClient();
    await client.connect();
    await client.tool('goto', { url: input.intentUrl, waitUntil: 'domcontentloaded', timeout: 15000 }, 19000);
    await client.tool('waitForState', { state: 'networkidle', timeout: 6500 }, 8500).catch(() => null);
    const before = await inspect(client);
    const accountMatch = compact(before.account).toLowerCase().includes(`@${handle.toLowerCase()}`);
    if (!before.profilePresent || !accountMatch) throw new Error('Authenticated X account identity is not confirmed in Lightpanda');
    if (!String(before.url || '').startsWith('https://x.com/intent/post')) throw new Error('Lightpanda did not open the exact intent composer');
    const actual = compact(before.editorText);
    if (actual !== clickExpected && actual !== expected) throw new Error('Lightpanda composer text does not exactly match approved content');
    if (input.action === 'reply') {
      const target = String(input.targetTweetId || '');
      if (!TWEET_ID_RE.test(target) || before.composerParents?.length !== 1
        || before.composerParents[0].id !== target
        || !compact(before.context).toLowerCase().includes('replying to')) {
        throw new Error('Lightpanda reply target/context not independently verified');
      }
      if (input.targetAuthor && !compact(before.context).toLowerCase().includes(String(input.targetAuthor).replace(/^@/, '').toLowerCase())) {
        throw new Error('Lightpanda target author not shown in reply composer');
      }
    }
    if (input.action === 'quote') {
      const sourceUrl = input.targetUrl || (String(input.expectedText).match(/https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+/) || [])[0];
      const target = String(input.targetTweetId || '');
      if (!TWEET_ID_RE.test(target) || !sourceUrl
        || !new RegExp(`^https://x\\.com/[A-Za-z0-9_]+/status/${target}(?:[/?#]|$)`).test(sourceUrl)
        || !actual.includes(sourceUrl)) {
        throw new Error('Lightpanda quote source URL does not match the exact approved target');
      }
    }
    if (!before.sendButton || before.sendButton.disabled || !/^(post|reply)$/i.test(compact(before.sendButton.text))) {
      throw new Error('Lightpanda composer has no verified enabled Post/Reply control');
    }
    const audit = await client.tool('evaluate', { script: SEND_AUDIT_INSTALL }, 10000);
    if (!String(audit.text || '').includes('true') && audit.data !== true) throw new Error('Cannot install single-send network audit');
    await beforeClick({ composerVerified: true, browser: 'lightpanda', intentUrl: input.intentUrl,
      verifiedParentTweetId: input.action === 'reply' ? before.composerParents[0].id : null });
    state.sent = true; // mark boundary BEFORE the single potentially consequential RPC.
    state.clickedAt = Date.now();
    await client.tool('click', { selector: before.sendButton.selector }, 20000);
    await client.tool('waitForState', { state: 'networkidle', timeout: 6500 }, 8500).catch(() => null);
    // A verified successful CreateTweet response is stronger than UI/toasts.
    let receipts = [];
    try { receipts = parsedReceipts(await client.tool('evaluate', { script: 'return window.__xGrowthTweetReceipts || []' }, 9000)); } catch {}
    const confirmed = receipts.find(receipt => acceptedReceipt(receipt, input, state.clickedAt));
    if (confirmed) return { outcome: 'published', reason: 'lightpanda_createtweet_response', evidence: {
      outputTweetId: confirmed.id, outputUrl: `https://x.com/${handle}/status/${confirmed.id}`, browser: 'lightpanda',
      action: input.action, targetTweetId: input.targetTweetId || '', verifiedExactText: true, verifiedFreshId: true, verifiedTargetLink: input.action !== 'original',
    } };
    // When interception is unavailable, inspect the own profile. A successful
    // click alone is NEVER proof. Require fresh ID + exact text + relation.
    await client.tool('goto', { url: `https://x.com/${handle}/with_replies`, waitUntil: 'domcontentloaded', timeout: 15000 }, 19000);
    await client.tool('waitForState', { state: 'networkidle', timeout: 6500 }, 8500).catch(() => null);
    const after = await inspect(client);
    const candidates = (after.articles || []).filter(a => compact(a.text) === expected);
    for (const article of candidates) {
      const id = (article.links || []).map(link => urlTweetId(link, handle)).find(id => id && id === article.id && isFresh(id, state.clickedAt));
      if (!id) continue;
      // A matching fresh post is not sufficient to prove a Reply or Quote's
      // target structure: require this rendered tweet's actual parent/quote ID.
      const relation = String(input.targetTweetId || '');
      if (input.action === 'reply' && article.parentId !== relation) continue;
      if (input.action === 'quote' && article.quoteId !== relation) continue;
      if (input.action === 'original' && (article.parentId || article.quoteId)) continue;
      return { outcome: 'published', reason: 'lightpanda_fresh_profile_structural_match', evidence: {
        outputTweetId: id, outputUrl: `https://x.com/${handle}/status/${id}`, browser: 'lightpanda',
        action: input.action, targetTweetId: relation, verifiedExactText: true, verifiedFreshId: true,
        verifiedTargetLink: input.action !== 'original',
      } };
    }
    return { outcome: 'unresolved', reason: 'lightpanda_send_no_structural_proof', evidence: {
      sendBoundaryCrossed: true, browser: 'lightpanda', profilePageAvailable: Boolean(after?.profilePresent),
      matchingArticles: candidates.length,
    } };
  } catch (error) {
    const reason = String(error?.message || error).slice(0, 200);
    return state.sent
      ? { outcome: 'unresolved', reason: 'lightpanda_error_after_send_boundary', evidence: { browser: 'lightpanda', error: reason, sendBoundaryCrossed: true } }
      : { outcome: 'not_sent', reason: 'lightpanda_blocked_before_send', evidence: { browser: 'lightpanda', error: reason, sendBoundaryCrossed: false, notSentProof: { kind: 'mutation_not_dispatched', detail: 'No Lightpanda Post/Reply click was dispatched.' } } };
  } finally {
    client?.close();
  }
}
