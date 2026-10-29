import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalCwd = process.cwd();
const scratch = await mkdtemp(path.join(os.tmpdir(), 'xgrowth-duplicate-'));
process.chdir(scratch);
const store = await import(pathToFileURL(path.join(repo, 'store.js')).href);
after(async () => {
  process.chdir(originalCwd);
  await rm(scratch, { recursive: true, force: true });
});

test('recorded reply text reaches the real bridge duplicate guard for a different target', () => {
  const text = 'A local trace shows which parser phase repeats when the file changes.';
  store.upsertCandidates([{
    key: 'xr05-confirmed-reply', source: 'x', title: '@builder', text: 'Source text differs.',
    url: 'https://x.com/builder/status/1900000000000000011', timestamp: Date.now(), metrics: {},
  }]);
  // The confirmed act branch calls this owner with commentary: validated.text.
  const recorded = store.recordCandidateAction({
    candidateKey: 'xr05-confirmed-reply', action: 'reply', commentary: text,
    outputTweetId: '1900000000000000012', outputUrl: 'https://x.com/ham_zax/status/1900000000000000012',
  });
  assert.equal(recorded.commentary, text);
  assert.equal(store.listRecentPublishedReplies({ limit: 200 })[0].text, text);
  const attemptsBefore = store.listPublicationAttempts({ limit: 500 });
  const queueBefore = store.listQueueItems({ limit: 1000 });
  const run = spawnSync(process.execPath, [path.join(repo, 'agent_bridge.js'), 'act'], {
    cwd: scratch, encoding: 'utf8', timeout: 20_000,
    input: JSON.stringify({ action: 'reply', text, targetTweetId: '1900000000000000099', targetUsername: 'otherbuilder' }),
    env: { ...process.env, X_ACCOUNT: 'ham_zax' },
  });
  assert.equal(run.error, undefined);
  assert.notEqual(run.status, 0);
  assert.match(`${run.stdout}\n${run.stderr}`, /duplicate\/near-copy of recently published text/);
  assert.deepEqual(store.listPublicationAttempts({ limit: 500 }), attemptsBefore);
  assert.deepEqual(store.listQueueItems({ limit: 1000 }), queueBefore);
});
