import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendMainFeedSchedule } from '../scheduler.js';

const MINUTE_MS = 60_000;
const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);

function approvedItem(overrides = {}) {
  return {
    id: 'queue-1',
    candidateKey: 'candidate-1',
    lane: 'main',
    pipeline: 'original',
    status: 'approved',
    urgency: 'evergreen',
    humanApprovedAt: NOW - 3 * 60 * MINUTE_MS,
    gatesPassed: true,
    published: false,
    text: 'Distinct scheduler draft about spacing.',
    topics: ['scheduling'],
    ...overrides,
  };
}

function publishedPost(pipeline, minutesAgo, id) {
  return {
    id,
    candidateKey: id,
    lane: 'main',
    pipeline,
    status: 'published',
    published: true,
    publishedAt: NOW - minutesAgo * MINUTE_MS,
    text: `Unrelated note ${id} about gardens.`,
    topics: [],
  };
}

function coverageWarning(decision) {
  return decision.warnings.find((warning) => warning.code === 'COVERAGE_SPACING') || null;
}

test('an Original 60 minutes after the last Original is not due', () => {
  const decision = recommendMainFeedSchedule(approvedItem(), {
    now: NOW,
    recentPosts: [publishedPost('original', 60, 'orig-a')],
  });

  assert.equal(decision.eligible, true);
  assert.equal(decision.recommendedAt, NOW + 30 * MINUTE_MS);
  assert.ok(decision.recommendedAt > NOW);
  assert.ok(coverageWarning(decision));
  assert.equal(decision.empiricalAssumptions.find((item) => item.code === 'ORIGINAL_SPACING').minutes, 90);
});

test('an Original 95 minutes after the last Original is due', () => {
  const decision = recommendMainFeedSchedule(approvedItem(), {
    now: NOW,
    recentPosts: [publishedPost('original', 95, 'orig-a')],
  });

  assert.equal(decision.eligible, true);
  assert.equal(decision.recommendedAt, NOW);
  assert.equal(coverageWarning(decision), null);
});

test('a repost 20 minutes after the last main-feed post is not due', () => {
  const decision = recommendMainFeedSchedule(approvedItem({ pipeline: 'repost' }), {
    now: NOW,
    recentPosts: [publishedPost('quote', 20, 'quote-a')],
  });

  assert.equal(decision.eligible, true);
  assert.equal(decision.recommendedAt, NOW + 10 * MINUTE_MS);
  assert.ok(decision.recommendedAt > NOW);
});

test('a repost 35 minutes after the last main-feed post is due', () => {
  const decision = recommendMainFeedSchedule(approvedItem({ pipeline: 'repost' }), {
    now: NOW,
    recentPosts: [publishedPost('quote', 35, 'quote-a')],
  });

  assert.equal(decision.eligible, true);
  assert.equal(decision.recommendedAt, NOW);
});

test('an Original still waits for the 30-minute main-feed gap after a recent Quote', () => {
  const decision = recommendMainFeedSchedule(approvedItem(), {
    now: NOW,
    recentPosts: [publishedPost('quote', 20, 'quote-a'), publishedPost('original', 200, 'orig-a')],
  });

  assert.equal(decision.recommendedAt, NOW + 10 * MINUTE_MS);
});

test('replies are not held by main-feed spacing', () => {
  const decision = recommendMainFeedSchedule(approvedItem({ lane: 'reply', pipeline: 'reply' }), {
    now: NOW,
    recentPosts: [publishedPost('original', 1, 'orig-a')],
  });

  assert.equal(decision.eligible, false);
  assert.equal(decision.recommendedAt, null);
  assert.ok(decision.blockers.some((blocker) => blocker.code === 'NOT_MAIN_FEED'));
  assert.equal(coverageWarning(decision), null);
});
