import { whBrowserTransport } from './ops/browser_publish_transport.js';
import { MAIN_FEED_SPACING_MINUTES, ORIGINAL_SPACING_MINUTES } from './scheduler.js';

const MINUTE_MS = 60_000;
export const ACT_ACTIONS = Object.freeze(['reply', 'quote', 'original']);
export const ACT_MAX_TEXT_LEN = 280;
const TWEET_ID_RE = /^\d{5,25}$/;
const STATUS_URL_RE = /https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/(\d+)/;
const PLACEHOLDER_RE = /\[\s*(?:placeholder|tbd|todo|insert\b[^\]]*|fill\b[^\]]*)\s*\]|\{[^}]*(?:placeholder|todo)[^}]*\}|LOREM IPSUM/i;
const TODO_MARKER_RE = /\bTODO\b/;
const NUMBER_CLAIM_RE = /(\$\s*\d[\d,.]*|\b\d+(?:\.\d+)?\s*(?:%|x(?![\w-])|million(?!\w)|billion(?!\w)|ms(?!\w)))/i;
const ANNOUNCE_RE = /(?:^|[\s"'(])(@\w+|[A-Z][\w.]*)\s+(announced|launched|released|unveiled|confirmed|revealed)\b/;
const ANNOUNCE_PRONOUNS = new Set(['i', 'we', 'they', 'it', 'he', 'she', 'you', 'our', 'this', 'that', 'my', 'their', 'its']);
const CREATE_TWEET_RE = /createtweet/i;
const MAX_CREATE_TWEET_CANDIDATES = 10;
const CREATE_TWEET_SCAN_ROUNDS = 3;
const CREATE_TWEET_SCAN_GAP_MS = 1500;
const MAX_SCAN_PAGES = 20;
const MAX_SCAN_IGNORED = 10;
const NETWORK_LINE_RE = /^reqid=(\d+)\s+(\S+)\s+(\S+)/gm;
const TRUNCATED_CREATE_TWEET_ID_RE = /"create_tweet"\s*:\s*\{\s*"tweet_results"\s*:\s*\{\s*"result"\s*:\s*\{\s*(?:"__typename"\s*:\s*"Tweet"\s*,\s*)?"rest_id"\s*:\s*"(\d+)"/;
const FRESHNESS_SLACK_MS = 120000;
const REQUEST_BODY_PATHS = [['request', 'postData'], ['request', 'body'], ['requestBody'], ['request_body'], ['postData']];
const RESPONSE_BODY_PATHS = [['response', 'body'], ['responseBody'], ['response_body'], ['body']];

export function extractTweetIdFromUrl(url) {
  const match = String(url || '').match(STATUS_URL_RE);
  return match ? match[1] : '';
}

export function normalizeTextForFence(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(text) {
  return new Set(String(text || '').split(' ').filter((t) => t.length > 2));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isNearCopy(left, right) {
  const a = normalizeTextForFence(left);
  const b = normalizeTextForFence(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (!setA.size || !setB.size) return false;
  let overlap = 0;
  for (const token of setA) if (setB.has(token)) overlap++;
  return overlap / Math.max(setA.size, setB.size) >= 0.9;
}

function numberAppearsIn(source, number) {
  return new RegExp(`(?<![\\d.])${escapeRegExp(number)}(?![\\d.])`).test(source);
}

export function checkAttributionNeedsRewrite(text, { action = '', sourceText = '' } = {}) {
  const value = String(text || '');
  const source = action === 'reply' || action === 'quote' ? String(sourceText || '') : '';
  const hasUrl = /https?:\/\/\S+/.test(value);
  const namesSource = /\b(per|via|according to|source|from)\b.{0,60}(https?:\/\/\S+|@[A-Za-z0-9_]+)/i.test(value);
  if (hasUrl || namesSource) return null;
  const numbers = [...value.matchAll(new RegExp(NUMBER_CLAIM_RE.source, 'gi'))]
    .map((match) => (match[0].match(/\d+(?:\.\d+)?/) || [])[0])
    .filter(Boolean);
  if (numbers.some((number) => !source || !numberAppearsIn(source, number))) {
    return { reason: 'quantitative_claim_without_source', detail: 'Text states a number/measure without naming its source; add the source or drop the number.' };
  }
  const announcement = value.match(ANNOUNCE_RE);
  if (announcement && !ANNOUNCE_PRONOUNS.has(announcement[1].toLowerCase())) {
    const subject = announcement[1].replace(/^@/, '');
    const attributed = Boolean(source) && new RegExp(`\\b${escapeRegExp(subject)}\\b`, 'i').test(source);
    if (!attributed) {
      return { reason: 'attribution_claim_without_source', detail: 'Text attributes an announcement/statement without naming the source; name who announced it.' };
    }
  }
  return null;
}

function latestPublishedAt(posts) {
  const times = posts.map((post) => Number(post?.publishedAt)).filter((at) => Number.isFinite(at) && at > 0);
  return times.length ? Math.max(...times) : null;
}

// Owner rule (2026-10-08): >= 90 min between Originals, >= 30 min between any two main-feed posts. Replies have no spacing.
// recentPosts are published main-feed rows (store listRecentMainFeedPublications); only publishedAt and pipeline are read.
// Returns null when the action may proceed, else the refusal with the gate that holds longest.
export function checkMainFeedSpacing({ action = '', recentPosts = [], now = Date.now() } = {}) {
  const kind = String(action || '').trim().toLowerCase();
  if (kind !== 'original' && kind !== 'quote') return null;
  const mainFeedAt = latestPublishedAt(recentPosts);
  const originalAt = latestPublishedAt(recentPosts.filter((post) => post?.pipeline === 'original'));
  const gates = [];
  if (mainFeedAt != null) {
    gates.push({
      reason: 'main_feed_spacing',
      detail: `Owner rule: ${MAIN_FEED_SPACING_MINUTES} min between main-feed posts; the last main-feed post was published at ${new Date(mainFeedAt).toISOString()}.`,
      allowedAtMs: mainFeedAt + MAIN_FEED_SPACING_MINUTES * MINUTE_MS,
    });
  }
  if (kind === 'original' && originalAt != null) {
    gates.push({
      reason: 'original_spacing',
      detail: `Owner rule: ${ORIGINAL_SPACING_MINUTES} min between Originals; the last Original was published at ${new Date(originalAt).toISOString()}.`,
      allowedAtMs: originalAt + ORIGINAL_SPACING_MINUTES * MINUTE_MS,
    });
  }
  const blocking = gates.filter((gate) => gate.allowedAtMs > now).sort((a, b) => b.allowedAtMs - a.allowedAtMs)[0];
  if (!blocking) return null;
  return { reason: blocking.reason, detail: blocking.detail, allowedAtMs: blocking.allowedAtMs };
}

export function validateActInput(input = {}) {
  const action = String(input.action || '').trim().toLowerCase();
  if (!ACT_ACTIONS.includes(action)) {
    throw new Error(`act requires action=reply|quote|original; received ${input.action || 'missing'}.`);
  }
  const text = String(input.text || '').trim();
  if (!text) throw new Error('act requires non-empty text.');
  if (text.length > ACT_MAX_TEXT_LEN) throw new Error(`act text is ${text.length} chars; X limit is ${ACT_MAX_TEXT_LEN}.`);
  if (PLACEHOLDER_RE.test(text) || TODO_MARKER_RE.test(text)) throw new Error('act text contains a placeholder; fill it before sending.');
  if (/^test$/i.test(text)) throw new Error('act text must be real content, never a bare test post.');
  let targetTweetId = String(input.targetTweetId || '').trim();
  const targetUrl = String(input.targetUrl || '').trim();
  if (action === 'reply') {
    if (!targetTweetId && targetUrl) targetTweetId = extractTweetIdFromUrl(targetUrl);
    if (!TWEET_ID_RE.test(targetTweetId)) throw new Error('act reply requires a numeric targetTweetId or a status targetUrl.');
  } else if (action === 'quote') {
    if (!targetTweetId && targetUrl) targetTweetId = extractTweetIdFromUrl(targetUrl);
    if (!TWEET_ID_RE.test(targetTweetId)) throw new Error('act quote requires the source status targetTweetId or targetUrl.');
    if (!targetUrl && !STATUS_URL_RE.test(text)) throw new Error('act quote requires targetUrl or the source status URL in text.');
  }
  const candidateKey = String(input.candidateKey || '').trim() || null;
  return { action, text, targetTweetId: targetTweetId || '', targetUrl, candidateKey };
}

export function buildIntentUrl({ action, text, targetTweetId = '', targetUrl = '' }) {
  const encoded = encodeURIComponent(String(text || ''));
  if (action === 'reply') return `https://x.com/intent/post?in_reply_to=${encodeURIComponent(targetTweetId)}&text=${encoded}`;
  if (action === 'quote') {
    let body = String(text || '');
    const sourceUrl = targetUrl || (body.match(STATUS_URL_RE) || [])[0] || '';
    if (sourceUrl && !body.trimEnd().endsWith(sourceUrl)) body = `${body.trimEnd()}\n\n${sourceUrl}`;
    return `https://x.com/intent/post?text=${encodeURIComponent(body)}`;
  }
  return `https://x.com/intent/post?text=${encoded}`;
}

const BLOCKING_TARGET_STATES = new Set([
  'claimed', 'send_started', 'confirmed_published', 'investigating', 'closed_unresolved',
]);

export function findBlockingAttemptForTarget(targetTweetId, attempts = []) {
  const id = String(targetTweetId || '');
  if (!id) return null;
  return attempts.find((attempt) => String(attempt.targetTweetId || '') === id
    && BLOCKING_TARGET_STATES.has(String(attempt.state || ''))) || null;
}

export function findDuplicateTextAttempt(text, attempts = []) {
  return attempts.find((attempt) => isNearCopy(text, attempt.approvedContent || '')) || null;
}

function snapshotText(observeResult) {
  return String(observeResult?.snapshot || '');
}

function findRefByName(observeResult, pattern) {
  const refs = observeResult?.refs || {};
  for (const [key, value] of Object.entries(refs)) {
    if (pattern.test(String(value?.name || '')) && /button/i.test(String(value?.role || ''))) return key;
  }
  return null;
}

export function findSendButtonRef(observeResult) {
  const refs = observeResult?.refs || {};
  const buttons = Object.entries(refs).filter(([, value]) => /button/i.test(String(value?.role || '')));
  const nameOf = (value) => String(value?.name || '').trim().toLowerCase();
  const exact = buttons.find(([, value]) => /^(post|reply)$/.test(nameOf(value)));
  if (exact) return exact[0];
  const loose = buttons.find(([, value]) => {
    const name = nameOf(value);
    if (/schedule|add post|quote/.test(name)) return false;
    return /(^|\s)(post|reply)(\s|$)/.test(name);
  });
  return loose ? loose[0] : null;
}

function findTextboxRef(observeResult) {
  const refs = observeResult?.refs || {};
  for (const [key, value] of Object.entries(refs)) {
    if (/textbox/i.test(String(value?.role || ''))) return key;
  }
  return null;
}

function accountHandle() {
  return String(process.env.X_ACCOUNT || 'ham_zax').replace(/^@/, '');
}

function notSent(reason, kind, detail, tab, extra = {}) {
  return { outcome: 'not_sent', reason, evidence: { ...extra, sendBoundaryCrossed: false, notSentProof: { kind, detail } }, tab };
}

function unresolved(reason, evidence, tab) {
  return { outcome: 'unresolved', reason, evidence, tab };
}

function published(reason, evidence, tab) {
  return { outcome: 'published', reason, evidence, tab };
}

function parseBodyValue(value) {
  if (value && typeof value === 'object') return value;
  try {
    return JSON.parse(String(value || ''));
  } catch {
    return null;
  }
}

function bodyAt(detail, paths) {
  for (const path of paths) {
    const value = path.reduce((node, key) => node?.[key], detail);
    const parsed = value != null && value !== '' ? parseBodyValue(value) : null;
    if (parsed) return parsed;
  }
  return null;
}

function firstBodyValue(detail, paths) {
  for (const path of paths) {
    const value = path.reduce((node, key) => node?.[key], detail);
    if (value != null && value !== '') return value;
  }
  return null;
}

export function tweetIdTimeMs(id) {
  const text = String(id ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  return Number((BigInt(text) >> 22n) + 1288834974657n);
}

function isFreshOutputId(id, clickAtMs, nowMs) {
  const at = tweetIdTimeMs(id);
  return at !== null && at >= clickAtMs - FRESHNESS_SLACK_MS && at <= nowMs + FRESHNESS_SLACK_MS;
}

function networkEntries(net) {
  if (Array.isArray(net?.requests)) return net.requests;
  if (Array.isArray(net)) return net;
  return [...String(net?.raw || '').matchAll(NETWORK_LINE_RE)]
    .map((match) => ({ reqid: Number(match[1]), method: match[2], url: match[3] }));
}

// Body sections of a `get_network_request` markdown dump. Header sections are dropped on purpose: they carry cookies and csrf tokens.
function markdownSection(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === `### ${heading}`);
  if (start < 0) return '';
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,3} /.test(line)) break;
    body.push(line);
  }
  return body.join('\n').trim();
}

function networkBodies(detail) {
  const text = typeof detail?.raw === 'string' ? detail.raw : '';
  if (!text) return detail;
  return {
    request: { body: markdownSection(text, 'Request Body') },
    response: { body: markdownSection(text, 'Response Body') },
  };
}

function postedTextOf(intentUrl, fallback) {
  try {
    const text = new URL(intentUrl).searchParams.get('text');
    return String(text ?? fallback ?? '').trim();
  } catch {
    return String(fallback || '').trim();
  }
}

function createTweetRequestMatches(request, { postedText, action, targetTweetId }) {
  const variables = request?.variables || {};
  const tweetText = String(variables.tweet_text ?? '').trim();
  const replyTo = String(variables.reply?.in_reply_to_tweet_id || '').trim();
  if (action === 'quote') {
    if (replyTo || !targetTweetId) return false;
    const sourceRe = new RegExp(`/status/${escapeRegExp(targetTweetId)}(?!\\d)`);
    if (tweetText === postedText) return sourceRe.test(String(variables.attachment_url || '')) || sourceRe.test(postedText);
    // X may move the trailing source URL out of the text into attachment_url.
    const withoutSourceUrl = postedText.replace(/\s*https:\/\/(?:x|twitter)\.com\/\S+\/status\/\d+\S*$/, '').trim();
    return tweetText === withoutSourceUrl && sourceRe.test(String(variables.attachment_url || ''));
  }
  if (tweetText !== postedText) return false;
  if (action === 'reply') return Boolean(targetTweetId) && replyTo === targetTweetId;
  return !replyTo;
}

function judgeCreateTweet(detail, expectation, isFresh) {
  const bodies = networkBodies(detail);
  const request = bodyAt(bodies, REQUEST_BODY_PATHS);
  if (!createTweetRequestMatches(request, expectation)) return { kind: 'ignore', why: request ? 'request_mismatch' : 'unparsed_request' };
  const responseValue = firstBodyValue(bodies, RESPONSE_BODY_PATHS);
  const response = parseBodyValue(responseValue);
  if (!response) {
    // Oversized responses are cut mid-JSON; trust only the id anchored to the create_tweet result.
    const truncatedId = (String(responseValue || '').match(TRUNCATED_CREATE_TWEET_ID_RE) || [])[1] || '';
    return isFresh(truncatedId) ? { kind: 'published', restId: truncatedId } : { kind: 'ignore', why: truncatedId ? 'stale_id' : 'no_id' };
  }
  const restId = String(response?.data?.create_tweet?.tweet_results?.result?.rest_id || '').trim();
  if (TWEET_ID_RE.test(restId)) return isFresh(restId) ? { kind: 'published', restId } : { kind: 'ignore', why: 'stale_id' };
  const errors = Array.isArray(response?.errors) ? response.errors : [];
  if (errors.length) {
    const summary = errors.map((error) => `${error?.code ?? ''} ${error?.message ?? ''}`.trim()).join('; ');
    return { kind: 'rejected', detail: summary.slice(0, 300) };
  }
  return { kind: 'ignore', why: 'no_id' };
}

async function listPageIds(listPages) {
  try {
    const pages = await listPages();
    const textPages = String(pages?.raw || JSON.stringify(pages));
    const ids = [...textPages.matchAll(/(?:^|\n)\s*(\d+):/g)].map((match) => Number(match[1]));
    return [...new Set(ids)].filter(Number.isFinite);
  } catch {
    return [];
  }
}

async function closeComposerTab(execute, tab) {
  try {
    await execute(tab, [{ op: 'tab_close', tab }], 'compact');
  } catch {
    // best effort: the attempt outcome is already decided and must not change
  }
}

async function runComposerSend({ intentUrl, expectedText, action, targetAuthor = '', targetSnippet = '', targetTweetId = '' }, env, state) {
  const start = await env.observe(null, 'compact');
  const startTab = start?.active_tab;
  if (!startTab) {
    return notSent('no_active_tab', 'mutation_not_dispatched', 'Browser has no active tab; no composer was opened and nothing was clicked.', null, { intentUrl });
  }
  const pagesBeforeOpen = await listPageIds(env.listPages);
  const opened = await env.execute(startTab, [{ op: 'tab_new', url: intentUrl }], 'full');
  const tab = opened?.final_state?.active_tab || opened?.active_tab;
  if (!tab) {
    return notSent('intent_tab_missing', 'mutation_not_dispatched', 'Intent navigation did not report a composer tab; nothing was clicked.', null, { intentUrl });
  }
  state.tab = tab;
  // An X intent tab can open before its prefilled composer becomes visible.
  // Re-observe only: no typing, clicking, or retrying a public mutation here.
  const normalizedExpected = String(expectedText || '').trim().slice(0, 60).toLowerCase();
  let observed;
  let snapshot = '';
  let snapshotLower = '';
  for (const readDelayMs of [1500, 1250, 1250, 1250]) {
    await env.sleep(readDelayMs);
    observed = await env.observe(tab, 'full');
    snapshot = snapshotText(observed);
    snapshotLower = snapshot.toLowerCase();
    if (normalizedExpected && snapshotLower.includes(normalizedExpected.slice(0, 30))) break;
  }
  if (!normalizedExpected || !snapshotLower.includes(normalizedExpected.slice(0, 30))) {
    return notSent('composer_prefill_mismatch', 'mutation_not_dispatched', 'Composer prefill does not match the approved text; no click was attempted.', tab, { intentUrl, snapshotExcerpt: snapshot.slice(0, 800) });
  }
  if (action === 'reply' && targetAuthor) {
    const authorLower = String(targetAuthor).replace(/^@/, '').toLowerCase();
    const hasContext = snapshotLower.includes('replying')
      || (authorLower && snapshotLower.includes(authorLower))
      || (targetSnippet && snapshotLower.includes(String(targetSnippet).slice(0, 30).toLowerCase()));
    if (!hasContext) {
      return notSent('reply_context_unverified', 'mutation_not_dispatched', 'Composer does not show the reply context for the target; no click was attempted.', tab, { intentUrl, snapshotExcerpt: snapshot.slice(0, 800) });
    }
  }
  const postRef = findSendButtonRef(observed);
  if (!postRef) {
    return notSent('post_button_missing', 'mutation_not_dispatched', 'No Post/Reply send button ref in the intent composer snapshot; no click was attempted.', tab, { intentUrl });
  }
  try {
    await env.beforeClick({ tab, postRef, composerVerified: true });
  } catch (error) {
    return notSent('before_click_refused', 'mutation_not_dispatched', `Pre-click hook refused the send; no click was attempted: ${String(error?.message || error).slice(0, 300)}`, tab, { intentUrl });
  }
  const clickAtMs = env.now();
  state.boundaryCrossed = true;
  await env.execute(tab, [{ op: 'click', target: postRef }], 'compact');
  await env.sleep(4000);
  const afterClick = await env.observe(tab, 'full');
  const afterClickSnapshot = snapshotText(afterClick);
  if (/will send on/i.test(afterClickSnapshot) && /schedule/i.test(afterClickSnapshot)) {
    const closeRef = findRefByName(afterClick, /^\s*close\s*$/i);
    if (closeRef) {
      await env.execute(tab, [{ op: 'click', target: closeRef }], 'compact').catch(() => null);
      await env.sleep(1500);
    }
    const rechecked = await env.observe(tab, 'full');
    const recheckedSnapshot = snapshotText(rechecked);
    return unresolved('schedule_dialog_after_click', { snapshotExcerpt: recheckedSnapshot.slice(0, 800), scan: { freshPageIds: [], pages: [], errors: 0 } }, tab);
  }
  const expectation = {
    postedText: postedTextOf(intentUrl, expectedText),
    action,
    targetTweetId: String(targetTweetId || '').trim(),
  };
  const pageIds = await listPageIds(env.listPages);
  const freshPageIds = pageIds.filter((id) => !pagesBeforeOpen.includes(id));
  const isFresh = (id) => isFreshOutputId(id, clickAtMs, env.now());
  const scan = { freshPageIds, pages: [], errors: 0 };
  const recordFor = (pageId) => {
    let record = scan.pages.find((page) => page.pageId === pageId);
    if (!record) {
      record = { pageId, fresh: freshPageIds.includes(pageId), rounds: 0, createTweets: 0, ignored: [] };
      if (scan.pages.length < MAX_SCAN_PAGES) scan.pages.push(record);
    }
    return record;
  };
  // One attempt on one page. Returns a published/rejected verdict, or null when nothing decisive was found.
  const scanPage = async (pageId) => {
    const record = recordFor(pageId);
    record.rounds += 1;
    try {
      const net = await env.listNetwork(pageId, 1000);
      const entries = networkEntries(net)
        .filter((entry) => CREATE_TWEET_RE.test(String(entry?.url || entry?.name || '')) && String(entry?.method || 'POST').toUpperCase() === 'POST');
      record.createTweets = Math.max(record.createTweets, entries.length);
      const createTweets = entries.slice(-MAX_CREATE_TWEET_CANDIDATES).reverse();
      for (const candidate of createTweets) {
        const detail = await env.getNetwork(pageId, candidate.reqid ?? candidate.id);
        const verdict = judgeCreateTweet(detail, expectation, isFresh);
        if (verdict.kind === 'ignore') {
          if (record.ignored.length < MAX_SCAN_IGNORED) record.ignored.push(verdict.why);
          continue;
        }
        return verdict;
      }
    } catch {
      scan.errors += 1;
      // fall through to the next round, then the toast fallback
    }
    return null;
  };
  // Up to CREATE_TWEET_SCAN_ROUNDS passes over pageList, sleeping only between passes.
  const scanRounds = async (pageList) => {
    if (!pageList.length) return null;
    for (let round = 0; round < CREATE_TWEET_SCAN_ROUNDS; round++) {
      for (const pageId of pageList) {
        const verdict = await scanPage(pageId);
        if (verdict) return verdict;
      }
      if (round < CREATE_TWEET_SCAN_ROUNDS - 1) await env.sleep(CREATE_TWEET_SCAN_GAP_MS);
    }
    return null;
  };
  // The composer opened by tab_new is a new page, so it is scanned first; older pages get one pass after it.
  let found = await scanRounds(freshPageIds.length ? freshPageIds : pageIds);
  if (!found && freshPageIds.length) {
    for (const pageId of pageIds.filter((id) => !freshPageIds.includes(id))) {
      found = await scanPage(pageId);
      if (found) break;
    }
  }
  if (found?.kind === 'published') {
    const outputUrl = `https://x.com/${accountHandle()}/status/${found.restId}`;
    return published('createtweet_response', { outputTweetId: found.restId, outputUrl, intentUrl, scan }, tab);
  }
  if (found?.kind === 'rejected') {
    return notSent('createtweet_rejected', 'transport_rejected', `CreateTweet for this text returned errors and no tweet id: ${found.detail}`, tab, { intentUrl, scan });
  }
  const after = await env.observe(tab, 'full');
  const afterSnapshot = snapshotText(after);
  const selfStatusRe = new RegExp(`https://x\\.com/${escapeRegExp(accountHandle())}/status/(\\d+)`, 'gi');
  for (const match of afterSnapshot.matchAll(selfStatusRe)) {
    if (match[1] !== expectation.targetTweetId && isFresh(match[1])) {
      return published('toast_view_link', { outputTweetId: match[1], outputUrl: match[0], intentUrl, scan }, tab);
    }
  }
  if (/your post was sent|posted/i.test(afterSnapshot)) {
    return unresolved('sent_toast_without_link', { snapshotExcerpt: afterSnapshot.slice(0, 800), scan }, tab);
  }
  return unresolved('no_confirmatory_evidence', { snapshotExcerpt: afterSnapshot.slice(0, 800), scan }, tab);
}

export async function driveBrowserSend(input, deps = {}) {
  const env = {
    observe: deps.observe || whBrowserTransport.observe,
    execute: deps.execute || whBrowserTransport.execute,
    listPages: deps.listPages || whBrowserTransport.listPages,
    listNetwork: deps.listNetwork || whBrowserTransport.listNetwork,
    getNetwork: deps.getNetwork || whBrowserTransport.getNetwork,
    sleep: deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    beforeClick: deps.beforeClick || (() => {}),
    now: deps.now || Date.now,
  };
  const state = { tab: null, boundaryCrossed: false };
  try {
    return await runComposerSend(input, env, state);
  } catch (error) {
    const message = String(error?.message || error).slice(0, 300);
    if (!state.boundaryCrossed) {
      return notSent('browser_error_before_send', 'mutation_not_dispatched', `Browser error before the send boundary; no click was dispatched: ${message}`, state.tab, { intentUrl: input?.intentUrl });
    }
    return unresolved('error_after_send_boundary', { error: message }, state.tab);
  } finally {
    if (state.tab) await closeComposerTab(env.execute, state.tab);
  }
}
