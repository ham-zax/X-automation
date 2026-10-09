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

test('excludes own, acted, blocked and disposed candidates, not stale or below a score floor', () => {
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
  assert.deepEqual(new Set(replyCards(result).map(card => card.author)),
    new Set(['author2', 'author6', 'author7', 'author8', 'author9']));
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

test('reply counts are descriptive and do not change discovery eligibility', () => {
  const candidate = cand(20, { viewsPerHour: 600, nicheScore: 30 });
  for (const count of [3, 16, 20]) {
    const result = build({ attempts: replies(count), candidates: [candidate] });
    assert.equal(result.pace.repliesLast24h, count);
    assert.equal(result.pace.policy, 'opportunity_led_with_rest_and_breakout_override');
    assert.equal(Object.hasOwn(result.pace, 'behind'), false);
    assert.equal(Object.hasOwn(result.pace, 'relaxed'), false);
    assert.deepEqual(replyCards(result).map(card => card.author), ['author20']);
  }
});

test('original card is present when the last original was 120 min ago', () => {
  const result = build({ attempts: [attempt('original', 120)] });

  assert.ok(originalCard(result));
  assert.equal(result.pace.nextOriginalAt, null);
});

test('Original editorial review is not suppressed by fixed intervals or a daily count', () => {
  for (const attempts of [
    [attempt('original', 60)],
    [attempt('original', 60), attempt('original', 120), attempt('original', 180), attempt('original', 240)],
    [attempt('repost', 10)],
  ]) {
    const result = build({ attempts });
    assert.ok(originalCard(result), 'editorial review remains possible');
    assert.equal(originalCard(result).reason.requiresEditorialEvidence, true);
    assert.equal(result.pace.nextOriginalAt, null);
  }
});

test('source cards expose Reply and Quote choices without an automatic Quote quota', () => {
  const result = build({
    attempts: replies(16),
    candidates: [
      cand(30, { viralTier: 'breakout', viewsPerHour: 9000 }),
      cand(31, { viralTier: 'breakout', viewsPerHour: 8000 }),
      cand(32, { viralTier: 'breakout', viewsPerHour: 7000 }),
    ],
  });
  const cards = replyCards(result);
  assert.equal(cards.length, 3);
  assert.equal(cards[0].author, 'author30');
  for (const card of cards) {
    assert.equal(card.action, 'reply');
    assert.deepEqual(card.eligibleActions, ['reply', 'quote']);
  }
});

test('a prior reply to an author does not unilaterally disqualify a new distinct source', () => {
  const result = build({
    attempts: [...replies(16), attempt('reply', 40, { candidateKey: 'https://x.com/author30/status/9' })],
    candidates: [
      cand(30, { viralTier: 'breakout', viewsPerHour: 9000 }),
      cand(31, { viralTier: 'breakout', viewsPerHour: 8000 }),
    ],
  });
  assert.deepEqual(replyCards(result).map(card => card.author), ['author30', 'author31']);
});

test('recent Quote does not disqualify another distinct source from Reply or Quote', () => {
  const result = build({
    attempts: [...replies(16), attempt('quote', 10)],
    candidates: [cand(40, { viralTier: 'breakout', viewsPerHour: 9000 })],
  });

  const card = replyCards(result)[0];
  assert.equal(card.author, 'author40');
  assert.equal(card.action, 'reply');
  assert.deepEqual(card.eligibleActions, ['reply', 'quote']);
});
