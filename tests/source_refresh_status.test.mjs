import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previousCwd = process.cwd();
const scratch = await mkdtemp(path.join(os.tmpdir(), 'xgrowth-refresh-status-'));
process.chdir(scratch);
const store = await import(pathToFileURL(path.join(repo, 'store.js')).href);
const { refreshSourceSnapshot } = await import(pathToFileURL(path.join(repo, 'source_refresh.js')).href);
after(async () => {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
});

test('a hard refresh error reports the last-good candidates it preserves', async () => {
  const candidate = { key: 'xr16-hn', source: 'hn', title: 'Parser release', text: '', url: 'https://example.com/parser', timestamp: Date.now(), metrics: {} };
  store.upsertCandidates([candidate]);
  const fetchedAt = Date.now() - 60_000;
  store.saveDiscoverSnapshot('hn_top', [candidate], fetchedAt);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('fixture HN failure'); };
  try {
    const result = await refreshSourceSnapshot('hn_top');
    assert.equal(result.preservedLastGood, true);
    assert.equal(result.fetchedAt, fetchedAt);
    assert.deepEqual(result.candidates.map(item => item.key), [candidate.key]);
    assert.match(result.error, /fixture HN failure/);
    assert.ok(result.attemptedAt > fetchedAt);
    assert.equal(store.getDiscoverSnapshot('hn_top').fetchedAt, fetchedAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('creator refresh stays opt-in and the bridge can invoke the existing owner', () => {
  assert.equal(store.getDiscoverSnapshot('x_creator_latest').fetchedAt, null);
  function refresh(payload) {
    const run = spawnSync(process.execPath, [path.join(repo, 'agent_bridge.js'), 'engage-refresh'], {
      cwd: scratch, input: JSON.stringify(payload), encoding: 'utf8', timeout: 20_000,
      env: { ...process.env, AUTH_TOKEN: '', CT0: '', X_ACCOUNT: 'ham_zax' },
    });
    assert.equal(run.error, undefined);
    assert.equal(run.status, 0, run.stderr);
    return JSON.parse(run.stdout);
  }
  refresh({});
  assert.equal(store.getDiscoverSnapshot('x_creator_latest').fetchedAt, null);
  // No profiles or watchlist targets exist, so this seam performs no HTTP read.
  const result = refresh({ refreshTargetTimelines: true });
  assert.deepEqual(result.refresh.errors, []);
  assert.ok(store.getDiscoverSnapshot('x_creator_latest').fetchedAt > 0);
  assert.deepEqual(store.getDiscoverSnapshot('x_creator_latest').candidates, []);
});
