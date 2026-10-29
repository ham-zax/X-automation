import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const previousCwd = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), 'growth-performance-followers-'));
process.chdir(scratch);
const store = await import(pathToFileURL(path.join(repo, 'store.js')).href);
after(async () => {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
});

test('missing follower evidence saves post measurements without creating a zero account', () => {
  const capturedAt = Date.now() - 60_000;
  store.recordPerformanceSnapshot({
    profile: { followingCount: 7 },
    posts: [{ id: '90001', text: 'Measured fixture', views: 12, timestamp: capturedAt }],
    capturedAt,
  });
  const snapshot = store.getPerformanceSnapshot();
  assert.equal(snapshot.account, null);
  assert.equal(snapshot.posts.length, 1);
  assert.equal(snapshot.posts[0].views, 12);
  assert.equal(snapshot.posts[0].captured_at, capturedAt);
  assert.equal(store.getFreshGrowthFollowerObservation(), null);
});

test('invalid newer profile counts cannot displace an observation or change audience selection', () => {
  const now = Date.now();
  const metricAt = now - 50_000;
  const observedAt = now - 40_000;
  store.recordPerformanceSnapshot({ profile: { followersCount: 800 }, capturedAt: metricAt });
  store.recordGrowthFollowerObservation({ followers: 1200, observedAt });
  const expectedAudience = store.getGrowthProductPolicyView().audience;
  assert.equal(expectedAudience.observedFollowers, 1200);
  const invalid = [undefined, null, '', ' ', '-', 'unknown', true, false, [], {}, NaN, Infinity, -1, 1.5];
  invalid.forEach((followersCount, index) => {
    store.recordPerformanceSnapshot({ profile: { followersCount }, capturedAt: now - 30_000 + index });
    assert.equal(store.getPerformanceSnapshot().account.captured_at, metricAt);
    assert.equal(store.getFreshGrowthFollowerObservation().followers, 1200);
    assert.equal(store.getCurrentAccountSnapshot().followers, 1200);
    assert.deepEqual(store.getGrowthProductPolicyView().audience, expectedAudience);
  });
});

test('genuine zero and numeric string counts remain eligible newer observations', () => {
  const now = Date.now();
  const capturedAt = now - 20_000;
  store.recordPerformanceSnapshot({ profile: { followersCount: 0 }, capturedAt });
  assert.equal(store.getPerformanceSnapshot().account.followers, 0);
  assert.equal(store.getFreshGrowthFollowerObservation().followers, 0);
  assert.equal(store.getGrowthProductPolicyView().audience.observedFollowers, 0);
  store.recordPerformanceSnapshot({ profile: { followersCount: '1500' }, capturedAt: capturedAt + 1 });
  assert.equal(store.getFreshGrowthFollowerObservation().followers, 1500);
  assert.equal(store.getGrowthProductPolicyView().audience.observedFollowers, 1500);
});
