// XR-02 follower status consistency. Runs only against a disposable SQLite DB in a
// scratch directory; bridge commands are spawned there and never touch the repo store.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previousCwd = process.cwd();
const scratch = mkdtempSync(path.join(tmpdir(), 'xgrowth-follower-status-'));
process.chdir(scratch);

const store = await import(pathToFileURL(path.join(repo, 'store.js')).href);

after(() => {
  process.chdir(previousCwd);
  rmSync(scratch, { recursive: true, force: true });
});

const DAY = 86_400_000;
const FOLLOWER_STATE_KEY = 'growth_follower_observation_v1';

function metricProfile({ followers, following, posts, likes }) {
  return { followersCount: followers, followingCount: following, tweetCount: posts, likesCount: likes };
}

function bridge(command, input = {}) {
  const run = spawnSync(process.execPath, [path.join(repo, 'agent_bridge.js'), command], {
    cwd: scratch,
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, X_ACCOUNT: 'ham_zax' },
  });
  assert.equal(
    run.status,
    0,
    `${command} exit ${run.status} signal ${run.signal} error ${run.error?.code ?? 'none'}: ${run.stderr}`,
  );
  return JSON.parse(run.stdout);
}

test('empty state keeps the existing null account result', () => {
  const now = Date.now();
  assert.equal(store.getFreshGrowthFollowerObservation({ now }), null);
  assert.equal(store.getCurrentAccountSnapshot({ now }), null);

  const compact = bridge('operator-status', { now });
  assert.equal(compact.account, null);
  assert.equal(compact.compact, true);
  assert.equal(compact.growthOperator.followers.count, null);
  assert.equal(compact.growthOperator.followers.capturedAt, null);

  const detail = bridge('operator-status', { now, detail: true });
  assert.equal(detail.account, null);
  assert.equal(detail.compact, undefined);

  assert.equal(bridge('growth-next', {}).account, null);
  assert.equal(bridge('growth-policy', {}).accountMetricsCapturedAt, null);
});

test('stale and future app-state observations are excluded', () => {
  const now = Date.now();
  store.setAppState(FOLLOWER_STATE_KEY, JSON.stringify({
    followers: 41,
    observedAt: now - 15 * DAY,
    source: 'authenticated_x_profile',
  }));
  assert.equal(store.getFreshGrowthFollowerObservation({ now }), null);
  assert.equal(store.getCurrentAccountSnapshot({ now }), null);

  store.setAppState(FOLLOWER_STATE_KEY, JSON.stringify({
    followers: 42,
    observedAt: now + 60_000,
    source: 'authenticated_x_profile',
  }));
  assert.equal(store.getFreshGrowthFollowerObservation({ now }), null);
  assert.equal(store.getCurrentAccountSnapshot({ now }), null);

  // Leave a stale record so later supported writers can append in capture order.
  store.setAppState(FOLLOWER_STATE_KEY, JSON.stringify({
    followers: 42,
    observedAt: now - 15 * DAY,
    source: 'authenticated_x_profile',
  }));
});

test('observation-only state returns a current account object without profile counters', () => {
  const observedAt = Date.now();
  store.recordGrowthFollowerObservation({ followers: 64, observedAt });
  const account = store.getCurrentAccountSnapshot({ now: observedAt });
  assert.deepEqual(account, {
    captured_at: null,
    followers: 64,
    following: null,
    posts: null,
    likes: null,
    followersCapturedAt: observedAt,
    followersSource: 'authenticated_x_profile',
  });
  assert.deepEqual(store.getFreshGrowthFollowerObservation({ now: observedAt }), {
    followers: 64,
    observedAt,
    source: 'authenticated_x_profile',
  });
});

test('zero followers is a valid observation, not a missing value', () => {
  const observedAt = Date.now();
  store.recordGrowthFollowerObservation({ followers: 0, observedAt });
  const account = store.getCurrentAccountSnapshot({ now: observedAt });
  assert.equal(account.followers, 0);
  assert.equal(account.followersCapturedAt, observedAt);
  assert.equal(account.followersSource, 'authenticated_x_profile');
  assert.equal(account.captured_at, null);
  for (const detail of [false, true]) {
    const status = bridge('operator-status', { detail });
    assert.equal(status.account.followers, 0);
    assert.equal(status.growthOperator.followers.count, 0);
    assert.equal(status.growthOperator.followers.capturedAt, observedAt);
  }
  assert.equal(bridge('growth-next').account.followers, 0);
  const policy = bridge('growth-policy');
  assert.equal(policy.audience.observedFollowers, 0);
  assert.equal(policy.accountMetricsCapturedAt, observedAt);
});

test('a stale metric row is preserved with its own capture time', () => {
  const now = Date.now();
  const staleAt = now - 15 * DAY;
  store.setAppState(FOLLOWER_STATE_KEY, JSON.stringify({
    followers: 41,
    observedAt: now - 14 * DAY - 60_000,
    source: 'authenticated_x_profile',
  }));
  store.recordPerformanceSnapshot({
    profile: metricProfile({ followers: 55, following: 7, posts: 8, likes: 9 }),
    capturedAt: staleAt,
  });
  assert.equal(store.getFreshGrowthFollowerObservation({ now }), null);
  const account = store.getCurrentAccountSnapshot({ now });
  assert.equal(account.followers, 55);
  assert.equal(account.captured_at, staleAt);
  assert.equal(account.following, 7);
  assert.equal(account.posts, 8);
  assert.equal(account.likes, 9);
  assert.equal(account.followersCapturedAt, staleAt);
  assert.equal(account.followersSource, 'observed_account_metrics');
});

test('a newer follower observation overlays only the metric follower count', () => {
  const now = Date.now();
  const metricAt = now - 5 * 60_000;
  const observedAt = now - 60_000;
  store.recordPerformanceSnapshot({
    profile: metricProfile({ followers: 100, following: 10, posts: 20, likes: 30 }),
    capturedAt: metricAt,
  });
  store.recordGrowthFollowerObservation({ followers: 64, observedAt });

  const account = store.getCurrentAccountSnapshot({ now });
  assert.equal(account.followers, 64);
  assert.equal(account.captured_at, metricAt);
  assert.equal(account.following, 10);
  assert.equal(account.posts, 20);
  assert.equal(account.likes, 30);
  assert.equal(account.followersCapturedAt, observedAt);
  assert.equal(account.followersSource, 'authenticated_x_profile');

  const historical = store.getPerformanceSnapshot(1).account;
  assert.equal(historical.followers, 100);
  assert.equal(historical.captured_at, metricAt);
});

test('a newer metric row outranks the saved follower observation', () => {
  const now = Date.now();
  const observedAt = now - 30_000;
  const metricAt = now - 10_000;
  store.recordGrowthFollowerObservation({ followers: 63, observedAt });
  store.recordPerformanceSnapshot({
    profile: metricProfile({ followers: 120, following: 11, posts: 21, likes: 31 }),
    capturedAt: metricAt,
  });

  const account = store.getCurrentAccountSnapshot({ now });
  assert.equal(account.followers, 120);
  assert.equal(account.captured_at, metricAt);
  assert.equal(account.following, 11);
  assert.equal(account.posts, 21);
  assert.equal(account.likes, 31);
  assert.equal(account.followersCapturedAt, metricAt);
  assert.equal(account.followersSource, 'observed_account_metrics');
  const policy = bridge('growth-policy');
  assert.equal(policy.audience.observedFollowers, 120);
  assert.equal(policy.accountMetricsCapturedAt, metricAt);
  assert.equal(policy.followerObservationSource, 'observed_account_metrics');
});

test('an exact capture-time tie keeps the app-state observation', () => {
  const now = Date.now();
  const metricAt = now;
  store.recordPerformanceSnapshot({
    profile: metricProfile({ followers: 120, following: 11, posts: 21, likes: 31 }),
    capturedAt: metricAt,
  });
  store.recordGrowthFollowerObservation({ followers: 321, observedAt: metricAt });
  const account = store.getCurrentAccountSnapshot({ now });
  assert.equal(account.followers, 321);
  assert.equal(account.captured_at, metricAt);
  assert.equal(account.followersCapturedAt, metricAt);
  assert.equal(account.followersSource, 'authenticated_x_profile');
  assert.equal(store.getPerformanceSnapshot(1).account.followers, 120);
});

test('a recorded follower observation reaches every current status view', () => {
  const now = Date.now();
  const metricAt = now;
  const observedAt = now;
  store.recordPerformanceSnapshot({
    profile: metricProfile({ followers: 100, following: 11, posts: 21, likes: 31 }),
    capturedAt: metricAt,
  });
  const recorded = bridge('growth-followers-record', {
    confirmRecord: true,
    accountHandle: 'ham_zax',
    followers: 777,
    observedAt,
  });
  assert.deepEqual(recorded.recorded, {
    followers: 777,
    observedAt,
    source: 'authenticated_x_profile',
  });

  const readNow = Date.now();
  for (const detail of [false, true]) {
    const status = bridge('operator-status', { now: readNow, detail });
    assert.equal(status.account.followers, 777);
    assert.equal(status.account.followersCapturedAt, observedAt);
    assert.equal(status.account.followersSource, 'authenticated_x_profile');
    assert.equal(status.account.captured_at, metricAt);
    assert.equal(status.account.following, 11);
    assert.equal(status.account.posts, 21);
    assert.equal(status.account.likes, 31);
    assert.equal(status.growthOperator.followers.count, 777);
    assert.equal(status.growthOperator.followers.capturedAt, observedAt);
    if (detail) {
      assert.equal(status.compact, undefined);
    } else {
      assert.equal(status.compact, true);
      assert.equal(typeof status.detailHint, 'string');
      assert.equal(status.personaHint, 'persona-model');
      assert.equal(status.readiness.sensors, undefined);
      assert.equal(status.readiness.accountHealth, undefined);
    }
  }

  const next = bridge('growth-next', {});
  assert.equal(next.account.followers, 777);
  assert.equal(next.account.followersCapturedAt, observedAt);
  assert.equal(next.account.followersSource, 'authenticated_x_profile');
  assert.equal(next.account.captured_at, metricAt);
  assert.equal(next.account.following, 11);
  assert.equal(next.account.posts, 21);
  assert.equal(next.account.likes, 31);

  const policy = bridge('growth-policy', {});
  assert.equal(policy.audience.observedFollowers, 777);
  assert.equal(policy.accountMetricsCapturedAt, observedAt);
  assert.equal(policy.followerObservationSource, 'authenticated_x_profile');

  const historical = store.getPerformanceSnapshot(1).account;
  assert.equal(historical.followers, 100);
  assert.equal(historical.captured_at, metricAt);
  assert.equal(historical.following, 11);
  assert.equal(historical.posts, 21);
  assert.equal(historical.likes, 31);
});

test('invalid follower inputs cannot replace observed evidence with zero', () => {
  const before = store.getAppState(FOLLOWER_STATE_KEY, null);
  for (const followers of [undefined, null, '', '   ', false, true, [], {}]) {
    assert.throws(() => store.recordGrowthFollowerObservation({ followers }), /nonnegative integer/);
    assert.equal(store.getAppState(FOLLOWER_STATE_KEY, null), before);
  }
});

test('future metrics neither hide past evidence nor become current evidence', () => {
  const now = Date.now();
  const metricAt = now;
  const futureAt = now + 60_000;
  store.setAppState(FOLLOWER_STATE_KEY, JSON.stringify({
    followers: 41, observedAt: now - 15 * DAY, source: 'authenticated_x_profile',
  }));
  store.recordPerformanceSnapshot({
    profile: metricProfile({ followers: 88, following: 11, posts: 21, likes: 31 }),
    capturedAt: metricAt,
  });
  store.recordPerformanceSnapshot({
    profile: metricProfile({ followers: 99, following: 12, posts: 22, likes: 32 }),
    capturedAt: futureAt,
  });
  assert.equal(store.getFreshGrowthFollowerObservation({ now }).followers, 88);
  const account = store.getCurrentAccountSnapshot({ now });
  assert.equal(account.followers, 88);
  assert.equal(account.followersCapturedAt, metricAt);
  assert.equal(account.captured_at, metricAt);
  assert.equal(store.getPerformanceSnapshot(1).account.captured_at, futureAt);

  const status = bridge('operator-status', { now });
  assert.equal(status.account.followers, 88);
  assert.equal(status.growthOperator.followers.count, 88);
  assert.equal(bridge('growth-next').account.followers, 88);
  assert.equal(bridge('growth-policy').audience.observedFollowers, 88);

  // At this earlier instant all stored metric and app-state captures are in the future.
  const beforeCaptures = now - 30 * DAY;
  assert.equal(store.getFreshGrowthFollowerObservation({ now: beforeCaptures }), null);
  assert.equal(store.getCurrentAccountSnapshot({ now: beforeCaptures }), null);
  const earlierStatus = bridge('operator-status', { now: beforeCaptures });
  assert.equal(earlierStatus.account, null);
  assert.equal(earlierStatus.growthOperator.followers.count, null);
});
