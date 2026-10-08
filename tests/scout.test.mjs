import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScoutCards } from '../scout.js';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const MIN = 60_000;

function cand(id, overrides = {}) {
  const url = `https://x.com/author${id}/status/${id}`;
  return {
    key: url,
    source: 'x',
    url,
    text: `post ${id}`,
    publishedAt: NOW - 60 * MIN,
    nicheScore: 60,
    viralTier: 'trending',
    viewsPerHour: 5000,
    engagementsPerHour: 200,
    hasAction: false,
    dispositionActive: false,
    blockingAttempt: false,
    ...overrides,
  };
}

function attempt(pipeline, minutesAgo, extra = {}) {
  return { pipeline, createdAt: NOW - minutesAgo * MIN, candidateKey: null, targetUrl: null, ...extra };
}

function replies(count) {
  return Array.from({ length: count }, (_, i) => attempt('reply', 30 + i, {
    candidateKey: `https://x.com/someone${i}/status/${i}`,
  }));
}

function build(overrides = {}) {
  return buildScoutCards({
    now: NOW,
    limit: 10,
    ownHandle: 'ham_zax',
    candidates: [],
    inspirationCandidates: [],
    attempts: [],
    ...overrides,
  });
}

function replyCards(result) {
  return result.cards.filter((card) => card.tier === 'T1');
}

function originalCard(result) {
  return result.cards.find((card) => card.tier === 'T2');
}

test('excludes own, stale, already-acted, blocked, and below-floor candidates', () => {
  const result = build({
    attempts: replies(16),
    candidates: [
      cand(1, { url: 'https://x.com/ham_zax/status/1', key: 'https://x.com/ham_zax/status/1' }),
      cand(2, { publishedAt: NOW - 361 * MIN }),
      cand(3, { hasAction: true }),
      cand(4, { dispositionActive: true }),
      cand(5, { blockingAttempt: true }),
      cand(6, { nicheScore: 39 }),
      cand(7, { viewsPerHour: 1999 }),
      cand(8, { nicheScore: 40, viewsPerHour: 2000 }),
      cand(9),
    ],
  });

  assert.deepEqual(replyCards(result).map((card) => card.author), ['author9', 'author8']);
});

test('ranks higher velocity first when other factors match', () => {
  const result = build({
    attempts: replies(16),
    candidates: [
      cand(11, { viewsPerHour: 3000 }),
      cand(10, { viewsPerHour: 20000 }),
    ],
  });

  assert.deepEqual(replyCards(result).map((card) => card.author), ['author10', 'author11']);
});

test('3 replies in 24h is behind and relaxed, admitting a 600/h candidate that default floors drop', () => {
  const candidate = cand(20, { viewsPerHour: 600, nicheScore: 30 });

  const relaxed = build({ attempts: replies(3), candidates: [candidate] });
  assert.equal(relaxed.pace.repliesLast24h, 3);
  assert.equal(relaxed.pace.behind, true);
  assert.equal(relaxed.pace.relaxed, true);
  assert.equal(relaxed.pace.nicheFloor, 25);
  assert.equal(relaxed.pace.velocityFloor, 500);
  assert.deepEqual(replyCards(relaxed).map((card) => card.author), ['author20']);

  const defaults = build({ attempts: replies(16), candidates: [candidate] });
  assert.equal(defaults.pace.relaxed, false);
  assert.equal(defaults.pace.nicheFloor, 40);
  assert.equal(defaults.pace.velocityFloor, 2000);
  assert.deepEqual(replyCards(defaults), []);
});

test('16 replies uses default floors and is still behind the target of 20', () => {
  const result = build({ attempts: replies(16) });

  assert.equal(result.pace.repliesLast24h, 16);
  assert.equal(result.pace.relaxed, false);
  assert.equal(result.pace.behind, true);
});

test('20 replies is not behind the target', () => {
  const result = build({ attempts: replies(20) });

  assert.equal(result.pace.behind, false);
});

test('original card is present when the last original was 120 min ago', () => {
  const result = build({ attempts: [attempt('original', 120)] });

  assert.ok(originalCard(result));
  assert.equal(result.pace.nextOriginalAt, null);
});

test('original card is absent at 60 min with nextOriginalAt 90 min after the last original', () => {
  const result = build({ attempts: [attempt('original', 60)] });

  assert.equal(originalCard(result), undefined);
  assert.equal(result.pace.nextOriginalAt, NOW + 30 * MIN);
});

test('original card is absent with 4 originals in 24h, and nextOriginalAt is the 4th-most-recent plus 24h', () => {
  const result = build({
    attempts: [attempt('original', 60), attempt('original', 120), attempt('original', 180), attempt('original', 240)],
  });

  assert.equal(originalCard(result), undefined);
  assert.equal(result.pace.nextOriginalAt, NOW + 20 * 60 * MIN);
});

test('original card is absent when the last main-feed post was 10 min ago', () => {
  const result = build({ attempts: [attempt('repost', 10)] });

  assert.equal(originalCard(result), undefined);
  assert.equal(result.pace.nextOriginalAt, NOW + 20 * MIN);
});

test('at most one quote card is emitted per batch', () => {
  const result = build({
    attempts: replies(16),
    candidates: [
      cand(30, { viralTier: 'breakout', viewsPerHour: 9000 }),
      cand(31, { viralTier: 'breakout', viewsPerHour: 8000 }),
      cand(32, { viralTier: 'breakout', viewsPerHour: 7000 }),
    ],
  });

  const quotes = replyCards(result).filter((card) => card.action === 'quote');
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].author, 'author30');
});

test('quote skips an author we already replied to in 24h', () => {
  const result = build({
    attempts: [
      ...replies(16),
      attempt('reply', 40, { candidateKey: 'https://x.com/author30/status/9' }),
    ],
    candidates: [
      cand(30, { viralTier: 'breakout', viewsPerHour: 9000 }),
      cand(31, { viralTier: 'breakout', viewsPerHour: 8000 }),
    ],
  });

  const quotes = replyCards(result).filter((card) => card.action === 'quote');
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].author, 'author31');
});

test('no quote card when the last main-feed post was 10 min ago', () => {
  const result = build({
    attempts: [...replies(16), attempt('quote', 10)],
    candidates: [cand(40, { viralTier: 'breakout', viewsPerHour: 9000 })],
  });

  assert.equal(replyCards(result).filter((card) => card.action === 'quote').length, 0);
});
