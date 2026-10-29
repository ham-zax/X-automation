import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const originalCwd = process.cwd();
const NOW = Date.UTC(2026, 9, 28, 12, 0, 0);
const TARGET = 'devbuilder';
const PROFILE_URL = `https://x.com/${TARGET}`;
const NULL_OBSERVATION = {
  targetFollowers: null,
  targetFollowersObservedAt: null,
  targetFollowersSourceUrl: null,
  replyShape: null,
};

let tmpDir;
let act;
let store;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xgrowth-act-metadata-'));
  process.chdir(tmpDir);
  act = await import(pathToFileURL(path.join(REPO, 'act.js')).href);
  store = await import(pathToFileURL(path.join(REPO, 'store.js')).href);
});

after(async () => {
  process.chdir(originalCwd);
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

function seedCandidate(candidateKey, targetTweetId) {
  store.upsertCandidates([{
    key: candidateKey,
    source: 'x',
    title: `@${TARGET}`,
    text: '',
    url: `https://x.com/${TARGET}/status/${targetTweetId}`,
    timestamp: NOW,
    metrics: {},
  }]);
}

function seedEngagementItem({ candidateKey, targetTweetId, engagementKind, parentOurTweetId = '', replyArchetype = '' }) {
  seedCandidate(candidateKey, targetTweetId);
  store.ensureEngagementItem({
    candidateKey,
    targetTweetId,
    engagementKind,
    parentOurTweetId,
    replyArchetype,
    targetUsername: TARGET,
    status: 'approved',
  });
  const item = store.getQueueItemByCandidate(candidateKey);
  assert.ok(item, `expected a queue item for ${candidateKey}`);
  assert.equal(item.engagementKind, engagementKind);
  return item;
}

test('missing observation normalizes to null measurement fields', () => {
  assert.deepEqual(act.validateActObservation(undefined, { targetUsername: TARGET, now: NOW }), NULL_OBSERVATION);
  assert.deepEqual(act.validateActObservation(null, { now: NOW }), NULL_OBSERVATION);
  assert.deepEqual(act.validateActObservation({}, { targetUsername: TARGET, now: NOW }), NULL_OBSERVATION);
});

test('supplied observation accepts zero, the count ceiling and a trimmed label', () => {
  const zero = act.validateActObservation({
    targetFollowers: 0,
    targetFollowersObservedAt: NOW - 60_000,
    targetFollowersSourceUrl: 'https://x.com/DevBuilder/',
    replyShape: '  direct answer  ',
  }, { targetUsername: '@devbuilder', now: NOW });
  assert.deepEqual(zero, {
    targetFollowers: 0,
    targetFollowersObservedAt: NOW - 60_000,
    targetFollowersSourceUrl: 'https://x.com/DevBuilder/',
    replyShape: 'direct answer',
  });
  const ceiling = act.validateActObservation({
    targetFollowers: 1_000_000_000,
    targetFollowersObservedAt: NOW,
    targetFollowersSourceUrl: PROFILE_URL,
  }, { targetUsername: TARGET, now: NOW });
  assert.equal(ceiling.targetFollowers, 1_000_000_000);
  assert.equal(ceiling.replyShape, null);
});

test('invalid observation data is rejected before any side effect', () => {
  let sideEffects = 0;
  // Mirrors agent_bridge.js: validate after the target author resolves, then
  // claim and browser work start. Invalid data must never reach the second step.
  const bridgeGate = (observation, options = {}) => {
    const validated = act.validateActObservation(observation, { targetUsername: TARGET, now: NOW, ...options });
    sideEffects += 1;
    return validated;
  };
  const follower = {
    targetFollowers: 1_200,
    targetFollowersObservedAt: NOW - 1_000,
    targetFollowersSourceUrl: PROFILE_URL,
  };
  const cases = [
    ['array observation', [], /JSON object/],
    ['string observation', 'observed', /JSON object/],
    ['unknown field', { ...follower, engagementKind: 'initial_reply' }, /unsupported field/],
    ['string count', { ...follower, targetFollowers: '1200' }, /integer/],
    ['fractional count', { ...follower, targetFollowers: 12.5 }, /integer/],
    ['negative count', { ...follower, targetFollowers: -1 }, /integer/],
    ['count above ceiling', { ...follower, targetFollowers: 1_000_000_001 }, /integer/],
    ['missing count', { targetFollowersObservedAt: NOW, targetFollowersSourceUrl: PROFILE_URL }, /targetFollowers/],
    ['missing time', { targetFollowers: 1200, targetFollowersSourceUrl: PROFILE_URL }, /ObservedAt/],
    ['missing source', { targetFollowers: 1200, targetFollowersObservedAt: NOW }, /SourceUrl/],
    ['future time', { ...follower, targetFollowersObservedAt: NOW + 1 }, /future/],
    ['zero time', { ...follower, targetFollowersObservedAt: 0 }, /positive/],
    ['mismatched profile', { ...follower, targetFollowersSourceUrl: 'https://x.com/otherbuilder' }, /must be/],
    ['status url', { ...follower, targetFollowersSourceUrl: `${PROFILE_URL}/status/1900000000000000001` }, /must be/],
    ['http profile', { ...follower, targetFollowersSourceUrl: `http://x.com/${TARGET}` }, /must be/],
    ['twitter host', { ...follower, targetFollowersSourceUrl: `https://twitter.com/${TARGET}` }, /must be/],
    ['query string', { ...follower, targetFollowersSourceUrl: `${PROFILE_URL}?ref=profile` }, /must be/],
    ['fragment', { ...follower, targetFollowersSourceUrl: `${PROFILE_URL}#top` }, /must be/],
    ['blank label', { replyShape: '   ' }, /nonblank/],
    ['long label', { replyShape: 'x'.repeat(81) }, /80/],
    ['non-string label', { replyShape: 7 }, /string/],
  ];
  for (const [label, observation, pattern] of cases) {
    assert.throws(() => bridgeGate(observation), pattern, label);
  }
  assert.throws(
    () => bridgeGate(follower, { targetUsername: '' }),
    /resolved target username/,
    'follower evidence needs a resolved author',
  );
  assert.equal(sideEffects, 0);
});

test('reply outcomes preserve queue classification and health counts them correctly', () => {
  const initial = seedEngagementItem({
    candidateKey: 'xr0304-initial',
    targetTweetId: '1900000000000001001',
    engagementKind: 'initial_reply',
    replyArchetype: 'implementation_detail',
  });
  const followUp = seedEngagementItem({
    candidateKey: 'xr0304-follow-up',
    targetTweetId: '1900000000000001002',
    engagementKind: 'follow_up',
    parentOurTweetId: '1900000000000002001',
    replyArchetype: 'informed_question',
  });
  const ownPost = seedEngagementItem({
    candidateKey: 'xr0304-own-post',
    targetTweetId: '1900000000000001003',
    engagementKind: 'own_post_response',
    parentOurTweetId: '1900000000000002002',
  });

  const initialMetadata = act.buildActRelationshipMetadata({
    action: 'reply',
    queueItem: initial,
    observation: act.validateActObservation(undefined, { targetUsername: TARGET, now: NOW }),
    attemptId: 'attempt-initial',
    outputUrl: 'https://x.com/ham_zax/status/1900000000000002003',
  });
  assert.deepEqual(initialMetadata, {
    attemptId: 'attempt-initial',
    outputUrl: 'https://x.com/ham_zax/status/1900000000000002003',
    engagementKind: 'initial_reply',
    parentOurTweetId: null,
    replyArchetype: 'implementation_detail',
    replyShape: 'implementation_detail',
    targetFollowers: null,
    targetFollowersObservedAt: null,
    targetFollowersSourceUrl: null,
  });
  const initialEvent = store.recordRelationshipEvent({
    username: TARGET,
    eventType: 'our_reply',
    candidateKey: initial.candidateKey,
    sourceTweetId: initial.targetTweetId,
    ourTweetId: '1900000000000002003',
    occurredAt: NOW,
    metadata: initialMetadata,
  });
  assert.deepEqual(initialEvent.metadata, initialMetadata);

  const followUpMetadata = act.buildActRelationshipMetadata({
    action: 'reply',
    queueItem: followUp,
    observation: act.validateActObservation({ replyShape: 'informed question' }, { targetUsername: TARGET, now: NOW }),
    attemptId: 'attempt-follow-up',
    outputUrl: 'https://x.com/ham_zax/status/1900000000000002004',
  });
  assert.equal(followUpMetadata.engagementKind, 'follow_up');
  assert.equal(followUpMetadata.parentOurTweetId, '1900000000000002001');
  assert.equal(followUpMetadata.replyArchetype, 'informed_question');
  assert.equal(followUpMetadata.replyShape, 'informed question');
  const followUpEvent = store.recordRelationshipEvent({
    username: TARGET,
    eventType: 'our_reply',
    candidateKey: followUp.candidateKey,
    sourceTweetId: followUp.targetTweetId,
    ourTweetId: '1900000000000002004',
    occurredAt: NOW,
    metadata: followUpMetadata,
  });
  assert.deepEqual(followUpEvent.metadata, followUpMetadata);

  const ownPostMetadata = act.buildActRelationshipMetadata({
    action: 'reply',
    queueItem: ownPost,
    observation: null,
    attemptId: 'attempt-own-post',
    outputUrl: 'https://x.com/ham_zax/status/1900000000000002005',
  });
  assert.deepEqual(ownPostMetadata, {
    attemptId: 'attempt-own-post',
    outputUrl: 'https://x.com/ham_zax/status/1900000000000002005',
    engagementKind: 'own_post_response',
    parentOurTweetId: '1900000000000002002',
    replyArchetype: null,
    replyShape: null,
    targetFollowers: null,
    targetFollowersObservedAt: null,
    targetFollowersSourceUrl: null,
  });
  const ownPostEvent = store.recordRelationshipEvent({
    username: TARGET,
    eventType: 'our_reply',
    candidateKey: ownPost.candidateKey,
    sourceTweetId: ownPost.targetTweetId,
    ourTweetId: '1900000000000002005',
    occurredAt: NOW,
    metadata: ownPostMetadata,
  });
  assert.deepEqual(ownPostEvent.metadata, ownPostMetadata);

  const health = store.getAccountHealthSummary({ now: NOW });
  assert.equal(health.networkQuality.components.authorResponseRate.meaningfulInitialReplies, 1);
  assert.equal(health.networkQuality.components.conversationContinuationRate.interactionsWithFollowUp, 1);
  assert.equal(health.networkQuality.components.conversationContinuationRate.rate, 100);
});

test('quote outcomes keep observation evidence without an initial-reply label', () => {
  seedCandidate('xr0304-quote', '1900000000000001005');
  const quoteItem = store.ensureQueueItem('xr0304-quote', { lane: 'main', pipeline: 'quote', status: 'approved' });
  // Deliberate reply residue in the queue: the action, not the queue snapshot,
  // decides that a quote is never labeled an initial reply.
  const quoteQueue = store.saveQueueItem({ ...quoteItem, engagementKind: 'initial_reply' });
  const observation = act.validateActObservation({
    targetFollowers: 0,
    targetFollowersObservedAt: NOW - 5_000,
    targetFollowersSourceUrl: PROFILE_URL,
  }, { targetUsername: TARGET, now: NOW });
  const metadata = act.buildActRelationshipMetadata({
    action: 'quote',
    queueItem: quoteQueue,
    observation,
    attemptId: 'attempt-quote',
    outputUrl: 'https://x.com/ham_zax/status/1900000000000002006',
  });
  assert.equal(metadata.engagementKind, null);
  assert.equal(metadata.targetFollowers, 0);
  assert.equal(metadata.targetFollowersObservedAt, NOW - 5_000);
  assert.equal(metadata.targetFollowersSourceUrl, PROFILE_URL);
  assert.equal(metadata.replyShape, null);

  const before = store.getAccountHealthSummary({ now: NOW })
    .networkQuality.components.authorResponseRate.meaningfulInitialReplies;
  const event = store.recordRelationshipEvent({
    username: TARGET,
    eventType: 'our_quote',
    candidateKey: quoteQueue.candidateKey,
    sourceTweetId: quoteQueue.targetTweetId,
    ourTweetId: '1900000000000002006',
    occurredAt: NOW,
    metadata,
  });
  assert.deepEqual(event.metadata, metadata);
  const after = store.getAccountHealthSummary({ now: NOW })
    .networkQuality.components.authorResponseRate.meaningfulInitialReplies;
  assert.equal(after, before, 'a quote must not add an initial reply');
});

test('unrecognized queue engagement kinds stay unknown', () => {
  const custom = seedEngagementItem({
    candidateKey: 'xr0304-custom-kind',
    targetTweetId: '1900000000000001004',
    engagementKind: 'custom_kind',
    replyArchetype: 'comparison',
  });
  const metadata = act.buildActRelationshipMetadata({
    action: 'reply',
    queueItem: custom,
    observation: null,
    attemptId: 'attempt-custom-kind',
    outputUrl: 'https://x.com/ham_zax/status/1900000000000002007',
  });
  assert.equal(metadata.engagementKind, null);
  assert.equal(metadata.replyShape, 'comparison');
});
