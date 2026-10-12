import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const previousCwd = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), 'growth-observation-budget-'));
process.chdir(scratch);
const store = await import('../store.js');
const discovery = await import('../x_discovery.js');
const growth = await import('../growth_run.js');
const now = Date.now();
let sequence = 0;

function posts(count = 2) {
  return Array.from({ length: count }, (_, index) => {
    const tweetId = (((BigInt(now) - 1288834974657n) << 22n) + BigInt(++sequence)).toString();
    return { tweetId, url: `https://x.com/builder/status/${tweetId}`, username: 'builder',
      text: `Builder conversation ${sequence}`, rank: index + 1, metrics: { views: 100 } };
  });
}

function run(ceiling = 50) {
  return store.createGrowthRun({ delegationRevision: 1, sessionId: `session-${++sequence}`,
    ceilings: { maxObservations: ceiling }, now });
}

function batch(activeRun, overrides = {}) {
  return { kind: 'x_for_you', observedAt: now, accountHandle: 'ham_zax',
    runId: activeRun.runId, sessionId: activeRun.sessionId, posts: posts(), ...overrides };
}

try {
  await test('multiple batches consume cumulative budget even while the sensor is fresh', () => {
    store.configureGrowthOperatorDelegation({ mode: 'live' });
    store.startGrowthOperatorDelegation();
    const { run: activeRun } = growth.beginGrowthRun({ adapterType: 'test', sessionId: 'observations',
      capabilities: { reasoning: true, browser_read: true, browser_mutation: true, x_authenticated: true },
      ceilings: { maxObservations: 5 }, now });
    for (let index = 0; index < 3; index++) {
      assert.equal(discovery.ingestXForYouObservation(batch(activeRun)).snapshotReplaced, true);
    }
    const status = growth.getGrowthRunStatus(activeRun.runId, { now });
    assert.equal(status.next.ceilings.observations, 6);
    assert.equal(status.next.ceilings.observationsRead, 6);
    assert.equal(status.next.ceilings.observationCeilingReached, true);
    assert.equal(status.next.permittedOperations.includes('collect_for_you'), false);
    assert.equal(status.next.permittedOperations.includes('inspect_candidate'), true);
    assert.equal(discovery.ingestXForYouObservation(batch(activeRun)).snapshotReplaced, false);
    assert.equal(store.getGrowthRunObservationBudget(activeRun.runId).acceptedCount, 6);
    growth.finishGrowthRun(activeRun.runId, { status: 'completed', stopReason: 'no_worthwhile_eligible_work', now });
  });

  await test('replayed receipts neither double charge nor replace a newer snapshot', () => {
    const activeRun = run();
    const first = batch(activeRun, { observationBatchId: 'first' });
    const second = batch(activeRun, { observationBatchId: 'second', observedAt: now + 1 });
    discovery.ingestXForYouObservation(first);
    discovery.ingestXForYouObservation(second);
    const before = store.getGrowthRunObservationBudget(activeRun.runId);
    const replay = discovery.ingestXForYouObservation(first);
    assert.equal(replay.observationBudget.replayed, true);
    assert.equal(replay.snapshotReplaced, false);
    assert.deepEqual(store.getGrowthRunObservationBudget(activeRun.runId), before);
    assert.equal(store.getDiscoverSnapshot('x_for_you').candidates[0].text, second.posts[0].text);
  });

  await test('receipt reuse with changed evidence rolls back accounting and snapshot changes', () => {
    const activeRun = run();
    const payload = batch(activeRun, { observationBatchId: 'immutable' });
    discovery.ingestXForYouObservation(payload);
    const before = store.getGrowthRunObservationBudget(activeRun.runId);
    const result = discovery.ingestXForYouObservation({ ...payload,
      posts: payload.posts.map(post => ({ ...post, text: 'Different claim' })) });
    assert.equal(result.snapshotReplaced, false);
    assert.match(result.diagnostics.at(-1).message, /different evidence/);
    assert.deepEqual(store.getGrowthRunObservationBudget(activeRun.runId), before);
    assert.equal(store.getDiscoverSnapshot('x_for_you').candidates[0].text, payload.posts[0].text);
  });

  await test('rejected, promoted, and empty batches consume finite observation work', () => {
    const activeRun = run(3);
    const invalid = discovery.ingestXForYouObservation(batch(activeRun, {
      posts: [{ promoted: true }, { text: 'Missing identity' }, { tweetId: 'invalid' }],
    }));
    assert.equal(invalid.snapshotReplaced, false);
    assert.deepEqual(store.getGrowthRunObservationBudget(activeRun.runId), {
      acceptedCount: 0, observationsRead: 3, rejectedCount: 2, skippedCount: 1, batchCount: 1,
    });
    assert.equal(discovery.ingestXForYouObservation(batch(activeRun)).snapshotReplaced, false);
    const emptyRun = run(2);
    for (let index = 0; index < 3; index++) {
      discovery.ingestXForYouObservation(batch(emptyRun, { posts: [], observationBatchId: `empty-${index}` }));
    }
    assert.equal(store.getGrowthRunObservationBudget(emptyRun.runId).batchCount, 2);
  });

  await test('another session cannot attribute observation work to the run', () => {
    const activeRun = run();
    const result = discovery.ingestXForYouObservation(batch(activeRun, { sessionId: 'foreign' }));
    assert.equal(result.snapshotReplaced, false);
    assert.equal(store.getGrowthRunObservationBudget(activeRun.runId).batchCount, 0);
  });

  await test('counters survive an independent process and historical gaps stay explicit', () => {
    const activeRun = run();
    discovery.ingestXForYouObservation(batch(activeRun));
    const child = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const s=await import(${JSON.stringify(new URL('../store.js', import.meta.url).href)}); console.log(JSON.stringify(s.getGrowthRunObservationBudget(${JSON.stringify(activeRun.runId)})));`],
    { cwd: scratch, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(JSON.parse(child.stdout).acceptedCount, 2);
    const handle = new DatabaseSync(path.join(scratch, '.x-research.sqlite'));
    handle.prepare('DELETE FROM app_state WHERE key = ?').run(`growth_run_observations_v1:${activeRun.runId}`);
    handle.close();
    assert.equal(store.getGrowthRunObservationBudget(activeRun.runId), null);
    const result = discovery.ingestXForYouObservation(batch(activeRun));
    assert.equal(result.snapshotReplaced, false);
    assert.match(result.diagnostics.at(-1).message, /Historical observation budget is unknown/);
  });
} finally {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
}
