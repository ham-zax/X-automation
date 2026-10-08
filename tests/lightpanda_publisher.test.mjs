import test from 'node:test';
import assert from 'node:assert/strict';
import { driveLightpandaSend } from '../ops/lightpanda_publisher.js';

process.env.X_ACCOUNT = 'ham_zax';
const target = '2108272338123079709';
const targetUrl = `https://x.com/ham_zax/status/${target}`;
const text = 'A bounded reply with an exact parent.';
const ownId = () => String((BigInt(Date.now() - 1288834974657) << 22n) + 1n);

function fixture(action = 'reply', options = {}) {
  const input = { action, expectedText: text, targetTweetId: target, targetAuthor: 'ham_zax', targetUrl };
  const body = action === 'quote' ? `${text}\n\n${targetUrl}` : text;
  input.intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(body)}`;
  if (action === 'reply') input.intentUrl += `&in_reply_to=${target}`;
  let clicked = 0;
  let closed = false;
  let authorized = 0;
  const before = {
    url: input.intentUrl, profilePresent: true, account: 'Hamza @ham_zax',
    editorText: body, context: 'Replying to @ham_zax',
    composerParents: [{ id: target }],
    sendButton: { selector: '[data-testid="tweetButton"]', text: action === 'reply' ? 'Reply' : 'Post', disabled: false },
    ...options.before,
  };
  const client = {
    async connect() { return this; },
    async tool(name, args) {
      if (name === 'click') { clicked++; if (options.clickError) throw Error('Connection lost during click'); }
      if (name === 'evaluate') {
        if (args.script.includes('return window.__xGrowthTweetReceipts')) return { data: [{
          status: 200, errors: false, id: ownId(), text: body,
          parent: action === 'reply' ? target : '', attachment: action === 'quote' ? targetUrl : '',
          ...options.receipt,
        }] };
        if (args.script.includes('window.fetch =')) return { data: true };
        return { data: clicked ? { ...before, articles: options.articles || [] } : before };
      }
      return { data: {} };
    },
    close() { closed = true; },
  };
  return {
    input, client,
    beforeClick(evidence) { authorized++; if (action === 'reply') assert.equal(evidence.verifiedParentTweetId, target); },
    counts: () => ({ clicked, closed, authorized }),
  };
}

test('exact rendered reply parent is required before authorization or click', async () => {
  for (const composerParents of [[], [{ id: '2108272338123079708' }], [{ id: target }, { id: target }]]) {
    const f = fixture('reply', { before: { composerParents } });
    const r = await driveLightpandaSend(f.input, f);
    assert.equal(r.outcome, 'not_sent');
    assert.deepEqual(f.counts(), { clicked: 0, authorized: 0, closed: true });
  }
});

test('verified reply sends once and confirms the exact response parent', async () => {
  const f = fixture();
  assert.equal((await driveLightpandaSend(f.input, f)).outcome, 'published');
  assert.deepEqual(f.counts(), { clicked: 1, authorized: 1, closed: true });
});

test('quote source URL must match the approved source ID before send', async () => {
  const f = fixture('quote');
  f.input.targetTweetId = '2108272338123079708';
  assert.equal((await driveLightpandaSend(f.input, f)).outcome, 'not_sent');
  assert.equal(f.counts().clicked, 0);
});

test('quote confirmation requires the native quote attachment', async () => {
  const good = fixture('quote');
  assert.equal((await driveLightpandaSend(good.input, good)).outcome, 'published');
  const bad = fixture('quote', { receipt: { attachment: '' } });
  assert.equal((await driveLightpandaSend(bad.input, bad)).outcome, 'unresolved');
  assert.equal(bad.counts().clicked, 1);
});

test('wrong parent, error response or absent status cannot confirm publication', async () => {
  for (const receipt of [{ parent: '2108272338123079708' }, { status: 500 }, { status: undefined }, { errors: true }]) {
    const f = fixture('reply', { receipt });
    assert.equal((await driveLightpandaSend(f.input, f)).outcome, 'unresolved');
    assert.equal(f.counts().clicked, 1);
  }
});

test('an unrelated target link in a profile article is not reply structure proof', async () => {
  const id = ownId();
  const f = fixture('reply', {
    receipt: { parent: '2108272338123079708' },
    articles: [{ id, text, parentId: '', quoteId: '', links: [`https://x.com/ham_zax/status/${id}`, targetUrl] }],
  });
  assert.equal((await driveLightpandaSend(f.input, f)).outcome, 'unresolved');
});

test('a click connection failure stays unresolved and is never retried', async () => {
  const f = fixture('reply', { clickError: true });
  assert.equal((await driveLightpandaSend(f.input, f)).outcome, 'unresolved');
  assert.deepEqual(f.counts(), { clicked: 1, authorized: 1, closed: true });
});

test('preflight refusal does not dispatch the mutation', async () => {
  const f = fixture();
  const r = await driveLightpandaSend(f.input, { ...f, beforeClick() { throw Error('preflight stop'); } });
  assert.equal(r.outcome, 'not_sent');
  assert.equal(r.evidence.sendBoundaryCrossed, false);
  assert.equal(f.counts().clicked, 0);
});
