import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await mkdtemp(path.join(tmpdir(), 'xgrowth-act-'));
const previousCwd = process.cwd();
process.chdir(tempDir);
process.env.X_ACCOUNT = 'ham_zax';

const rootUrl = pathToFileURL(`${repoRoot}${path.sep}`).href;
const act = await import(`${rootUrl}act.js`);
const store = await import(`${rootUrl}store.js`);

await test('validateActInput accepts reply/quote/original and rejects bad input', () => {
  const reply = act.validateActInput({ action: 'reply', text: 'This is a useful reply with context.', targetTweetId: '123456789' });
  assert.equal(reply.action, 'reply');
  assert.throws(() => act.validateActInput({ action: 'reply', text: 'hi', targetTweetId: 'abc' }), /targetTweetId/);
  assert.throws(() => act.validateActInput({ action: 'quote', text: 'take' }), /targetTweetId|targetUrl/);
  assert.throws(() => act.validateActInput({ action: 'original', text: 'x'.repeat(281) }), /280/);
  assert.throws(() => act.validateActInput({ action: 'original', text: 'fill [placeholder] here' }), /placeholder/);
});

await test('checkAttributionNeedsRewrite flags sourceless numbers and announcements', () => {
  assert.ok(act.checkAttributionNeedsRewrite('This is 10x faster than before'));
  assert.ok(act.checkAttributionNeedsRewrite('X announced a new API today'));
  assert.equal(act.checkAttributionNeedsRewrite('This is 10x faster per https://x.com/a/status/1'), null);
  assert.equal(act.checkAttributionNeedsRewrite('A plain builder observation with no claims.'), null);
});

await test('buildIntentUrl uses reply in_reply_to and quote URL embed', () => {
  const replyUrl = act.buildIntentUrl({ action: 'reply', text: 'hello', targetTweetId: '999' });
  assert.ok(replyUrl.includes('in_reply_to=999'));
  const quoteUrl = act.buildIntentUrl({ action: 'quote', text: 'my take', targetUrl: 'https://x.com/a/status/999' });
  assert.ok(decodeURIComponent(quoteUrl).endsWith('https://x.com/a/status/999'));
  const originalUrl = act.buildIntentUrl({ action: 'original', text: 'hello world' });
  assert.ok(originalUrl.startsWith('https://x.com/intent/post?text='));
});

await test('target fence blocks investigating and closed_unresolved but not confirmed_not_sent', () => {
  assert.ok(act.findBlockingAttemptForTarget('1', [{ targetTweetId: '1', state: 'investigating' }]));
  assert.ok(act.findBlockingAttemptForTarget('1', [{ targetTweetId: '1', state: 'closed_unresolved' }]));
  assert.ok(act.findBlockingAttemptForTarget('1', [{ targetTweetId: '1', state: 'confirmed_published' }]));
  assert.equal(act.findBlockingAttemptForTarget('1', [{ targetTweetId: '1', state: 'confirmed_not_sent' }]), null);
  assert.equal(act.findBlockingAttemptForTarget('2', [{ targetTweetId: '1', state: 'claimed' }]), null);
});

await test('isNearCopy detects exact and near duplicates', () => {
  assert.ok(act.isNearCopy('Hello world builder tooling', 'hello world builder tooling'));
  assert.equal(act.isNearCopy('Completely different thought here', 'Unrelated builder note'), false);
});

await test('claimActPublication requires a live grant and enforces the target fence', () => {
  assert.throws(() => store.claimActPublication({
    action: 'reply', text: 'Useful reply with enough context to pass.', targetTweetId: '555001',
  }), /grant|delegation/);
  store.saveAutonomousReplyGrantState({
    state: 'running', mode: 'live', revision: 3, liveBudget: 10, budgetUsed: 0,
    allowedSources: ['active'], allowedIntents: ['technical_insight'], allowedTones: ['direct'],
    humorAllowed: false, refreshMinutes: 5, discoveryWatermarkAt: 1,
  });
  const first = store.claimActPublication({
    action: 'reply', text: 'Session retries need a bounded budget and a visible attempt id.', targetTweetId: '555001',
    targetUrl: 'https://x.com/builder/status/555001', claimHolder: 'test-session',
  });
  assert.ok(first.attempt?.attemptId);
  assert.equal(first.attempt.transport, 'browser_agent');
  assert.equal(first.attempt.state, 'claimed');
  assert.equal(first.queueItem.status, 'publishing');
  assert.throws(() => store.claimActPublication({
    action: 'reply', text: 'A different wording for the same target.', targetTweetId: '555001',
    targetUrl: 'https://x.com/builder/status/555001', claimHolder: 'test-session',
  }), /fenced|never re-send/);
});

await test('findSendButtonRef prefers Post/Reply and skips Schedule', () => {
  const observed = { refs: {
    a: { name: 'Post', role: 'button' },
    b: { name: 'Schedule post', role: 'button' },
    c: { name: 'Post', role: 'link' },
  } };
  assert.equal(act.findSendButtonRef(observed), 'a');
  const replyObserved = { refs: {
    a: { name: 'Schedule post', role: 'button' },
    b: { name: 'Reply', role: 'button' },
  } };
  assert.equal(act.findSendButtonRef(replyObserved), 'b');
  assert.equal(act.findSendButtonRef({ refs: { a: { name: 'Schedule post', role: 'button' } } }), null);
});

await test('driveBrowserSend returns not_sent when the Post button is missing', async () => {
  const result = await act.driveBrowserSend({
    intentUrl: 'https://x.com/intent/post?text=hi', expectedText: 'hi', action: 'original',
  }, {
    observe: async () => ({ active_tab: 'tab-1', snapshot: 'textbox hi here', refs: {} }),
    execute: async () => ({ final_state: { active_tab: 'tab-2' } }),
    listPages: async () => ({ raw: '' }),
    sleep: async () => {},
  });
  assert.equal(result.outcome, 'not_sent');
  assert.equal(result.evidence?.notSentProof?.kind, 'mutation_not_dispatched');
});

// Fixed clock for the recency fence; ids are snowflakes minted at a given offset from it.
const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);
const idAt = (ms) => ((BigInt(ms - 1288834974657) << 22n) | 1n).toString();
const FRESH_ID = idAt(NOW - 5000);
const FRESH_ID_2 = idAt(NOW - 9000);
const OLD_ID = idAt(NOW - 3 * 3600000);

// Mocked browser: observe #1 is the pre-open snapshot, #2 the composer, #3+ the post-click view.
function fakeBrowser({ composer, after = composer, requests = [], detailFor = () => null, calls = [] }) {
  let observed = 0;
  return {
    now: () => NOW,
    observe: async () => {
      observed += 1;
      if (observed === 1) return { active_tab: 'tab-1', snapshot: '', refs: {} };
      return observed === 2 ? composer : after;
    },
    execute: async (tab, actions) => {
      calls.push(`execute:${actions[0].op}`);
      if (actions[0].op === 'tab_new') return { final_state: { active_tab: 'tab-2' } };
      return { final_state: {} };
    },
    listPages: async () => ({ raw: '1: https://x.com/intent/post' }),
    listNetwork: async () => ({ requests }),
    getNetwork: async (pageId, reqid) => detailFor(reqid),
    sleep: async () => {},
  };
}

const POST_TEXT = 'Session retries need a bounded budget and a visible attempt id.';
const postComposer = (extra = '') => ({
  active_tab: 'tab-2',
  snapshot: `textbox: ${POST_TEXT} ${extra}`,
  refs: { t: { name: 'Post text', role: 'textbox' }, p: { name: 'Post', role: 'button' } },
});
const createTweetEntry = (reqid) => ({ reqid, url: 'https://x.com/i/api/graphql/abc123/CreateTweet' });
// Body field paths are an assumption (see act.js REQUEST_BODY_PATHS / RESPONSE_BODY_PATHS); not verified against live wh-browser output.
const createTweetDetail = ({ text, replyTo = null, restId = null, errors = null }) => ({
  request: { postData: JSON.stringify({ variables: { tweet_text: text, ...(replyTo ? { reply: { in_reply_to_tweet_id: replyTo } } : {}) } }) },
  response: { body: JSON.stringify(errors
    ? { data: { create_tweet: null }, errors }
    : { data: { create_tweet: { tweet_results: { result: { rest_id: restId } } } } }) },
});

await test('driveBrowserSend refuses a composer whose prefill differs and never clicks', async () => {
  const calls = [];
  let beforeClickCalls = 0;
  const result = await act.driveBrowserSend({
    intentUrl: act.buildIntentUrl({ action: 'original', text: POST_TEXT }), expectedText: POST_TEXT, action: 'original',
  }, {
    ...fakeBrowser({ calls, composer: { active_tab: 'tab-2', snapshot: 'textbox: some other draft', refs: { p: { name: 'Post', role: 'button' } } } }),
    beforeClick: () => { beforeClickCalls += 1; },
  });
  assert.equal(result.outcome, 'not_sent');
  assert.equal(result.reason, 'composer_prefill_mismatch');
  assert.equal(result.evidence.notSentProof.kind, 'mutation_not_dispatched');
  assert.equal(beforeClickCalls, 0);
  assert.ok(!calls.includes('execute:click'));
  assert.ok(calls.includes('execute:tab_close'), 'composer tab is closed on every exit');
});

await test('driveBrowserSend refuses a reply whose composer shows no reply context', async () => {
  const calls = [];
  let beforeClickCalls = 0;
  const result = await act.driveBrowserSend({
    intentUrl: act.buildIntentUrl({ action: 'reply', text: POST_TEXT, targetTweetId: '555100' }),
    expectedText: POST_TEXT, action: 'reply', targetTweetId: '555100', targetAuthor: 'builder', targetSnippet: '',
  }, {
    ...fakeBrowser({ calls, composer: postComposer() }),
    beforeClick: () => { beforeClickCalls += 1; },
  });
  assert.equal(result.outcome, 'not_sent');
  assert.equal(result.reason, 'reply_context_unverified');
  assert.equal(beforeClickCalls, 0);
  assert.ok(!calls.includes('execute:click'));
});

await test('driveBrowserSend calls beforeClick once, immediately before the single click, and publishes on a matching CreateTweet', async () => {
  const calls = [];
  const result = await act.driveBrowserSend({
    intentUrl: act.buildIntentUrl({ action: 'original', text: POST_TEXT }), expectedText: POST_TEXT, action: 'original',
  }, {
    ...fakeBrowser({
      calls,
      composer: postComposer(),
      requests: [createTweetEntry(7)],
      detailFor: (reqid) => (reqid === 7 ? createTweetDetail({ text: POST_TEXT, restId: FRESH_ID }) : null),
    }),
    beforeClick: (evidence) => {
      calls.push('beforeClick');
      assert.equal(evidence.composerVerified, true);
    },
  });
  assert.equal(result.outcome, 'published');
  assert.equal(result.reason, 'createtweet_response');
  assert.equal(result.evidence.outputTweetId, FRESH_ID);
  assert.equal(result.evidence.outputUrl, `https://x.com/ham_zax/status/${FRESH_ID}`);
  assert.deepEqual(calls.filter((call) => call === 'beforeClick' || call === 'execute:click'), ['beforeClick', 'execute:click']);
});

await test('driveBrowserSend ignores a CreateTweet whose text or reply target does not match', async () => {
  const stale = await act.driveBrowserSend({
    intentUrl: act.buildIntentUrl({ action: 'original', text: POST_TEXT }), expectedText: POST_TEXT, action: 'original',
  }, {
    ...fakeBrowser({
      composer: postComposer(),
      requests: [createTweetEntry(3)],
      detailFor: () => createTweetDetail({ text: 'An older unrelated post about caching.', restId: '777000001' }),
    }),
  });
  assert.notEqual(stale.outcome, 'published');
  assert.equal(stale.evidence?.outputTweetId, undefined);

  const wrongReplyTarget = await act.driveBrowserSend({
    intentUrl: act.buildIntentUrl({ action: 'reply', text: POST_TEXT, targetTweetId: '555100' }),
    expectedText: POST_TEXT, action: 'reply', targetTweetId: '555100', targetAuthor: 'builder', targetSnippet: '',
  }, {
    ...fakeBrowser({
      composer: postComposer('Replying to @builder'),
      requests: [createTweetEntry(4)],
      detailFor: () => createTweetDetail({ text: POST_TEXT, replyTo: '999999', restId: '777000002' }),
    }),
  });
  assert.notEqual(wrongReplyTarget.outcome, 'published');
  assert.equal(wrongReplyTarget.evidence?.outputTweetId, undefined);
});

await test('driveBrowserSend maps a CreateTweet error to not_sent transport_rejected', async () => {
  const result = await act.driveBrowserSend({
    intentUrl: act.buildIntentUrl({ action: 'original', text: POST_TEXT }), expectedText: POST_TEXT, action: 'original',
  }, {
    ...fakeBrowser({
      composer: postComposer(),
      requests: [createTweetEntry(9)],
      detailFor: () => createTweetDetail({ text: POST_TEXT, errors: [{ code: 187, message: 'Status is a duplicate.' }] }),
    }),
  });
  assert.equal(result.outcome, 'not_sent');
  assert.equal(result.reason, 'createtweet_rejected');
  assert.equal(result.evidence.notSentProof.kind, 'transport_rejected');
  assert.match(result.evidence.notSentProof.detail, /duplicate/);
});

await test('driveBrowserSend does not publish from a toast that links the target or a foreign account', async () => {
  const targetToast = await act.driveBrowserSend({
    intentUrl: act.buildIntentUrl({ action: 'reply', text: POST_TEXT, targetTweetId: '555010' }),
    expectedText: POST_TEXT, action: 'reply', targetTweetId: '555010', targetAuthor: 'builder', targetSnippet: '',
  }, {
    ...fakeBrowser({
      composer: postComposer('Replying to @builder'),
      after: { active_tab: 'tab-2', snapshot: 'Your post was sent https://x.com/builder/status/555010', refs: {} },
    }),
  });
  assert.equal(targetToast.outcome, 'unresolved');
  assert.equal(targetToast.reason, 'sent_toast_without_link');
  assert.equal(targetToast.evidence?.outputTweetId, undefined);

  const selfTargetLink = await act.driveBrowserSend({
    intentUrl: act.buildIntentUrl({ action: 'reply', text: POST_TEXT, targetTweetId: '555010' }),
    expectedText: POST_TEXT, action: 'reply', targetTweetId: '555010', targetAuthor: 'builder', targetSnippet: '',
  }, {
    ...fakeBrowser({
      composer: postComposer('Replying to @builder'),
      after: { active_tab: 'tab-2', snapshot: 'https://x.com/ham_zax/status/555010', refs: {} },
    }),
  });
  assert.notEqual(selfTargetLink.outcome, 'published');
  assert.equal(selfTargetLink.evidence?.outputTweetId, undefined);

  const ownToast = await act.driveBrowserSend({
    intentUrl: act.buildIntentUrl({ action: 'reply', text: POST_TEXT, targetTweetId: '555010' }),
    expectedText: POST_TEXT, action: 'reply', targetTweetId: '555010', targetAuthor: 'builder', targetSnippet: '',
  }, {
    ...fakeBrowser({
      composer: postComposer('Replying to @builder'),
      after: { active_tab: 'tab-2', snapshot: `Your post was sent https://x.com/ham_zax/status/${FRESH_ID}`, refs: {} },
    }),
  });
  assert.equal(ownToast.outcome, 'published');
  assert.equal(ownToast.evidence.outputTweetId, FRESH_ID);
  assert.equal(ownToast.evidence.outputUrl, `https://x.com/ham_zax/status/${FRESH_ID}`);
});

// Real wh-browser devtools output is markdown, not JSON; these helpers mirror that shape.
const CREATE_URL = 'https://x.com/i/api/graphql/V0wMxbYBxdrkfmV3kJSyRQ/CreateTweet';
const mdList = (rows) => ({ raw: [
  '## Network requests',
  `Showing 1-${rows.length} of ${rows.length} (Page 1 of 1).`,
  ...rows.map((row) => `reqid=${row.reqid} ${row.method} ${row.url} [200]`),
].join('\n') });
const mdDetail = ({ requestBody, responseBody }) => ({ raw: [
  `## Request ${CREATE_URL}`,
  '### Request Headers',
  'cookie: auth_token=SECRET-COOKIE',
  'x-csrf-token: SECRET-CSRF',
  '### Request Body',
  requestBody,
  '### Response Headers',
  'set-cookie: guest_id=SECRET-GUEST',
  '### Response Body',
  responseBody,
].join('\n') });
const createTweetBody = ({ text, replyTo = null }) => JSON.stringify({
  variables: { tweet_text: text, ...(replyTo ? { reply: { in_reply_to_tweet_id: replyTo } } : {}) },
  queryId: 'V0wMxbYBxdrkfmV3kJSyRQ',
});
const createTweetResponse = (restId) => JSON.stringify({
  data: { create_tweet: { tweet_results: { result: { __typename: 'Tweet', rest_id: restId, core: { user_results: { result: { rest_id: '42' } } } } } } },
});
const mdBrowser = ({ composer, after, rows, details }) => ({
  ...fakeBrowser({ composer, after }),
  listNetwork: async () => mdList(rows),
  getNetwork: async (pageId, reqid) => {
    // The real devtools tool rejects a string reqid: "Expected number, received string at reqid".
    if (typeof reqid !== 'number') throw new Error('Expected number, received string at reqid');
    return details[String(reqid)] ?? { raw: '' };
  },
});
const originalSend = { intentUrl: act.buildIntentUrl({ action: 'original', text: POST_TEXT }), expectedText: POST_TEXT, action: 'original' };

await test('driveBrowserSend publishes from markdown devtools output and ignores non-POST CreateTweets', async () => {
  const sizes = [];
  const result = await act.driveBrowserSend(originalSend, {
    ...fakeBrowser({ composer: postComposer() }),
    listNetwork: async (pageId, pageSize) => {
      sizes.push(pageSize);
      return mdList([
        { reqid: 124, method: 'POST', url: CREATE_URL },
        { reqid: 125, method: 'GET', url: CREATE_URL },
      ]);
    },
    getNetwork: async (pageId, reqid) => (reqid === 124
      ? mdDetail({ requestBody: createTweetBody({ text: POST_TEXT }), responseBody: createTweetResponse(FRESH_ID) })
      : mdDetail({ requestBody: createTweetBody({ text: POST_TEXT }), responseBody: createTweetResponse(FRESH_ID_2) })),
  });
  assert.equal(result.outcome, 'published');
  assert.equal(result.evidence.outputTweetId, FRESH_ID);
  assert.deepEqual(sizes, [1000]);
  assert.ok(!JSON.stringify(result).includes('SECRET'), 'header values never reach the result');
});

await test('driveBrowserSend takes rest_id from a truncated CreateTweet response only when anchored to the tweet result', async () => {
  const anchored = `{"data":{"create_tweet":{"tweet_results":{"result":{"__typename":"Tweet","rest_id":"${FRESH_ID}","core":{"user_results":{"result":{"rest_id":"42","legacy":{"screen_name":"ham_zax","descr\n... <truncated>`;
  const published = await act.driveBrowserSend(originalSend, mdBrowser({
    composer: postComposer(),
    rows: [{ reqid: 1, method: 'POST', url: CREATE_URL }],
    details: { 1: mdDetail({ requestBody: createTweetBody({ text: POST_TEXT }), responseBody: anchored }) },
  }));
  assert.equal(published.outcome, 'published');
  assert.equal(published.evidence.outputTweetId, FRESH_ID);

  const userOnly = `{"data":{"viewer":{"user_results":{"result":{"__typename":"User","rest_id":"42","legacy":{"screen_name":"ham_zax"}}}}},"x":"\n... <truncated>`;
  const notPublished = await act.driveBrowserSend(originalSend, mdBrowser({
    composer: postComposer(),
    rows: [{ reqid: 2, method: 'POST', url: CREATE_URL }],
    details: { 2: mdDetail({ requestBody: createTweetBody({ text: POST_TEXT }), responseBody: userOnly }) },
  }));
  assert.notEqual(notPublished.outcome, 'published');
  assert.equal(notPublished.evidence?.outputTweetId, undefined);
});

await test('driveBrowserSend ignores a matching CreateTweet whose snowflake id is older than the click', async () => {
  const result = await act.driveBrowserSend(originalSend, mdBrowser({
    composer: postComposer(),
    rows: [{ reqid: 3, method: 'POST', url: CREATE_URL }],
    details: { 3: mdDetail({ requestBody: createTweetBody({ text: POST_TEXT }), responseBody: createTweetResponse('1800000000000000000') }) },
  }));
  assert.notEqual(result.outcome, 'published');
  assert.equal(result.evidence?.outputTweetId, undefined);
});

await test('driveBrowserSend toast fallback takes our fresh status link and skips an older one', async () => {
  const fresh = await act.driveBrowserSend(originalSend, {
    ...fakeBrowser({
      composer: postComposer(),
      after: { active_tab: 'tab-2', snapshot: `Your post was sent https://x.com/ham_zax/status/${OLD_ID} https://x.com/ham_zax/status/${FRESH_ID}`, refs: {} },
    }),
  });
  assert.equal(fresh.outcome, 'published');
  assert.equal(fresh.reason, 'toast_view_link');
  assert.equal(fresh.evidence.outputTweetId, FRESH_ID);

  const onlyOld = await act.driveBrowserSend(originalSend, {
    ...fakeBrowser({
      composer: postComposer(),
      after: { active_tab: 'tab-2', snapshot: `Your post was sent https://x.com/ham_zax/status/${OLD_ID}`, refs: {} },
    }),
  });
  assert.equal(onlyOld.outcome, 'unresolved');
  assert.equal(onlyOld.reason, 'sent_toast_without_link');
  assert.equal(onlyOld.evidence?.outputTweetId, undefined);
});

await test('tweetIdTimeMs decodes the snowflake timestamp and rejects non-numeric ids', () => {
  assert.equal(new Date(act.tweetIdTimeMs('2108174634655117653')).getUTCFullYear(), 2026);
  assert.equal(act.tweetIdTimeMs(FRESH_ID), NOW - 5000);
  assert.equal(act.tweetIdTimeMs('abc'), null);
  assert.equal(act.tweetIdTimeMs(''), null);
});

await test('attribution, number and placeholder regexes flag real claims and pass ordinary prose', () => {
  assert.ok(act.checkAttributionNeedsRewrite('Cut latency by 40ms this week'));
  assert.ok(act.checkAttributionNeedsRewrite('Grew 3 million users in a month'));
  assert.ok(act.checkAttributionNeedsRewrite('Saved $4,000 on hosting'));
  assert.ok(act.checkAttributionNeedsRewrite('Retention went up 25% overall'));
  assert.equal(act.checkAttributionNeedsRewrite('I shipped 2 features and a 3-step guide'), null);
  assert.equal(act.checkAttributionNeedsRewrite('Version 2 of the spec reads well'), null);
  assert.equal(act.checkAttributionNeedsRewrite('We announced it in March'), null);
  assert.equal(act.checkAttributionNeedsRewrite('@openai announced a new model', { action: 'reply', sourceText: '@openai announced a new model today' }), null);
  assert.ok(act.checkAttributionNeedsRewrite('This is 10x faster', { action: 'reply', sourceText: 'Some unrelated post' }));
  assert.equal(act.checkAttributionNeedsRewrite('This is 10x faster', { action: 'reply', sourceText: 'Benchmarks: 10x faster builds' }), null);

  assert.throws(() => act.validateActInput({ action: 'original', text: '[TBD] pick a number' }), /placeholder/);
  assert.throws(() => act.validateActInput({ action: 'original', text: 'TODO: write the thread' }), /placeholder/);
  assert.doesNotThrow(() => act.validateActInput({ action: 'original', text: 'See the [link] in the thread notes' }));
});

await test('not_sent reconciliation followed by the act release leaves the queue item out of approved', async () => {
  const { confirmPublicationAttemptNotSent } = await import(`${rootUrl}publication_reconciliation.js`);
  const claim = store.claimActPublication({
    action: 'reply', text: 'Fresh wording for a fresh target about retries.', targetTweetId: '555200',
    targetUrl: 'https://x.com/builder/status/555200', claimHolder: 'test-session',
  });
  const resolved = confirmPublicationAttemptNotSent(claim.attempt.attemptId, {
    reason: 'test: composer refused before click',
    evidence: { sendBoundaryCrossed: false, notSentProof: { kind: 'mutation_not_dispatched', detail: 'test: composer refused before click' } },
    now: Date.now(),
  });
  assert.equal(resolved.attempt.state, 'confirmed_not_sent');
  assert.equal(store.getQueueItem(claim.queueItem.id).status, 'approved', 'reconciler restores delegated_act items to approved');
  const released = store.releaseActQueueItemAfterNotSent(claim.queueItem.id, { reason: 'test: composer refused before click', now: Date.now() });
  assert.equal(released.status, 'drafting');
  assert.notEqual(released.status, 'approved');
});

// First listPages call is the pre-open snapshot, the second is taken after the click.
const listPagesBeforeAndAfter = (before, after) => {
  let calls = 0;
  return async () => ({ raw: calls++ === 0 ? before : after });
};
const PAGES_HOME = '1: a (https://x.com/home)';
const PAGES_WITH_COMPOSER = `${PAGES_HOME}\n5: b (https://x.com/intent/post?text=x)`;

await test('driveBrowserSend scans the freshly opened composer page before older pages', async () => {
  const networkCalls = [];
  const result = await act.driveBrowserSend(originalSend, {
    ...fakeBrowser({ composer: postComposer() }),
    listPages: listPagesBeforeAndAfter(PAGES_HOME, PAGES_WITH_COMPOSER),
    listNetwork: async (pageId) => {
      networkCalls.push(pageId);
      return { requests: pageId === 5 ? [createTweetEntry(7)] : [] };
    },
    getNetwork: async () => createTweetDetail({ text: POST_TEXT, restId: FRESH_ID }),
  });
  // Page 5 publishes on its first pass, so the older page 1 is never listed.
  assert.deepEqual(networkCalls, [5]);
  assert.equal(result.outcome, 'published');
  assert.equal(result.reason, 'createtweet_response');
  assert.deepEqual(result.evidence.scan.freshPageIds, [5]);
});

await test('driveBrowserSend records request_mismatch in scan diagnostics without leaking bodies', async () => {
  const result = await act.driveBrowserSend(originalSend, {
    ...fakeBrowser({ composer: postComposer() }),
    listPages: listPagesBeforeAndAfter(PAGES_HOME, PAGES_WITH_COMPOSER),
    listNetwork: async (pageId) => ({ requests: pageId === 5 ? [createTweetEntry(8)] : [] }),
    getNetwork: async () => createTweetDetail({ text: 'An unrelated post with SECRET-BODY-TEXT', restId: FRESH_ID }),
  });
  assert.equal(result.outcome, 'unresolved');
  assert.equal(result.evidence.outputTweetId, undefined);
  const composerPage = result.evidence.scan.pages.find((page) => page.pageId === 5);
  assert.ok(composerPage.fresh);
  assert.ok(composerPage.ignored.includes('request_mismatch'));
  const scanJson = JSON.stringify(result.evidence.scan);
  assert.ok(!scanJson.includes('SECRET-BODY-TEXT'));
  assert.ok(!scanJson.includes('tweet_text'));
  assert.ok(!scanJson.includes('CreateTweet'));
});

await test('driveBrowserSend sleeps only between scan rounds over non-fresh pages', async () => {
  const sleeps = [];
  const result = await act.driveBrowserSend(originalSend, {
    ...fakeBrowser({ composer: postComposer() }),
    listPages: async () => ({ raw: '1: a (https://x.com/home)\n2: b (https://x.com/theo)\n3: c (https://x.com/home)' }),
    listNetwork: async () => ({ requests: [] }),
    sleep: async (ms) => { sleeps.push(ms); },
  });
  assert.equal(result.outcome, 'unresolved');
  assert.equal(result.reason, 'no_confirmatory_evidence');
  // 1500 after tab_new, 4000 after click, then 1500 between the 3 scan rounds (none after last).
  assert.deepEqual(sleeps, [1500, 4000, 1500, 1500]);
  assert.equal(result.evidence.scan.pages.length, 3);
});

const MIN = 60_000;

// Claims use explicit historical timestamps to verify cadence-free distinct
// publication claims while retaining the objective claim/duplicate fences.
const SPACING_TIMELINE = Date.now() - 10 * 60 * MIN;
const rowCounts = () => ({
  attempts: store.listPublicationAttempts({ limit: 500 }).length,
  queue: store.listQueueItems({ limit: 10_000 }).length,
});

await test('claimActPublication permits distinct originals without historical spacing quotas', () => {
  store.startGrowthOperatorDelegation({ actor: 'human' });
  store.configureGrowthOperatorDelegation({ mode: 'live' }, { actor: 'human' });
  const first = store.claimActPublication({
    action: 'original', text: 'First original on the historical spacing timeline.', candidateKey: 'spacing-original-first',
    claimHolder: 'test-session', now: SPACING_TIMELINE,
  });
  store.markQueuePublished(first.queueItem.id, '777001', 'https://x.com/ham_zax/status/777001', { publishedAt: SPACING_TIMELINE });
  const before = rowCounts();
  const second = store.claimActPublication({
    action: 'original', text: 'Second distinct original one hour after the first.', candidateKey: 'spacing-original-second',
    claimHolder: 'test-session', now: SPACING_TIMELINE + 60 * MIN,
  });
  assert.equal(second.attempt.state, 'claimed');
  assert.equal(rowCounts().attempts, before.attempts + 1);
  assert.equal(rowCounts().queue, before.queue + 1);
  store.markQueuePublished(second.queueItem.id, '777003', 'https://x.com/ham_zax/status/777003', { publishedAt: SPACING_TIMELINE + 60 * MIN });
  const third = store.claimActPublication({
    action: 'original', text: 'Third distinct original 95 minutes after the first.', candidateKey: 'spacing-original-allowed',
    claimHolder: 'test-session', now: SPACING_TIMELINE + 95 * MIN,
  });
  assert.equal(third.attempt.state, 'claimed');
  store.markQueuePublished(third.queueItem.id, '777002', 'https://x.com/ham_zax/status/777002', { publishedAt: SPACING_TIMELINE + 95 * MIN });
});

await test('claimActPublication permits a distinct Quote after an Original and independent reply', () => {
  const quoteAt = SPACING_TIMELINE + 115 * MIN;
  const before = rowCounts();
  const quote = store.claimActPublication({
    action: 'quote', text: 'A distinct value-adding Quote twenty minutes after a post.', targetTweetId: '666001',
    targetUrl: 'https://x.com/builder/status/666001', candidateKey: 'spacing-quote-allowed',
    claimHolder: 'test-session', now: quoteAt,
  });
  assert.equal(quote.attempt.state, 'claimed');
  assert.equal(rowCounts().attempts, before.attempts + 1);
  store.markQueuePublished(quote.queueItem.id, '777004', 'https://x.com/ham_zax/status/777004', { publishedAt: quoteAt });
  const reply = store.claimActPublication({
    action: 'reply', text: 'A useful reply near a main-feed publication still claims.', targetTweetId: '666002',
    targetUrl: 'https://x.com/builder/status/666002', claimHolder: 'test-session', now: quoteAt,
  });
  assert.equal(reply.attempt.state, 'claimed');
  assert.equal(reply.attempt.pipeline, 'reply');
});

await test('listRecentMainFeedPublications retains a published act Quote without creating a spacing gate', async () => {
  const delegation = store.startGrowthOperatorDelegation({ actor: 'human' });
  assert.equal(delegation.state, 'running');
  store.configureGrowthOperatorDelegation({ mode: 'live' }, { actor: 'human' });
  const claim = store.claimActPublication({
    action: 'quote', text: 'Spacing is checked against this published act quote.', targetTweetId: '888001',
    targetUrl: 'https://x.com/builder/status/888001', claimHolder: 'test-session', now: Date.now(),
  });
  const publishedAt = Date.now() - 20 * MIN;
  store.markQueuePublished(claim.queueItem.id, '888002', 'https://x.com/ham_zax/status/888002', { publishedAt });
  const recent = store.listRecentMainFeedPublications({ limit: 20 });
  const found = recent.find((item) => item.id === claim.queueItem.id);
  assert.ok(found, 'published act quote is a main-feed publication row');
  assert.equal(found.pipeline, 'quote');
  assert.equal(found.publishedAt, publishedAt);
});

process.chdir(previousCwd);
await rm(tempDir, { recursive: true, force: true });
