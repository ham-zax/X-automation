// Bridge compact-output contract tests run only against a disposable SQLite DB.
// They spawn agent_bridge.js in a scratch directory and never open the production store.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previousCwd = process.cwd();
const scratch = mkdtempSync(path.join(tmpdir(), 'xgrowth-bridge-compact-'));
process.chdir(scratch);

after(() => {
  process.chdir(previousCwd);
  rmSync(scratch, { recursive: true, force: true });
});

function bridgeStdout(command, input = {}) {
  const run = spawnSync(process.execPath, [path.join(repo, 'agent_bridge.js'), command], {
    cwd: scratch,
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, X_ACCOUNT: 'ham_zax' },
  });
  assert.equal(
    run.status,
    0,
    `${command} exit ${run.status} signal ${run.signal} error ${run.error?.code ?? 'none'}: ${run.stderr}`,
  );
  return run.stdout;
}

function bridge(command, input) {
  return JSON.parse(bridgeStdout(command, input));
}

test('account-health piped stdout is one line of JSON', () => {
  const stdout = bridgeStdout('account-health').trim();
  assert.equal(stdout.includes('\n'), false, 'piped account-health output must be a single line');
  assert.doesNotThrow(() => JSON.parse(stdout));
});

test('account-health default is the compact projection', () => {
  const body = bridge('account-health', {});
  assert.equal(body.compact, true);
  assert.equal(typeof body.detailHint, 'string');
  assert.equal(typeof body.health.state, 'string');
  assert.ok(Array.isArray(body.health.reasons));
  assert.equal(body.saturation.targets, undefined);
  assert.equal(body.observations, undefined);
  assert.equal(body.recentReplies, undefined);
  assert.equal(body.health.provenance, undefined);
});

test('account-health detail returns saturation targets without compact', () => {
  const body = bridge('account-health', { detail: true });
  assert.ok(Array.isArray(body.saturation.targets));
  assert.equal(body.compact, undefined);
});

test('operator-status default omits readiness sensors and account health', () => {
  const body = bridge('operator-status', {});
  assert.equal(body.readiness.sensors, undefined);
  assert.equal(body.readiness.accountHealth, undefined);
  assert.ok(Array.isArray(body.integrityWarnings));
  assert.ok(body.laneChampions && typeof body.laneChampions === 'object');
  assert.equal(body.personaHint, 'persona-model');
});

test('operator-status detail returns readiness sensors and no persona hint', () => {
  const body = bridge('operator-status', { detail: true });
  assert.notEqual(body.readiness.sensors, undefined);
  assert.equal(body.personaHint, undefined);
});

test('queue default returns draft and queue item arrays marked compact', () => {
  const body = bridge('queue', {});
  assert.ok(Array.isArray(body.drafts));
  assert.ok(Array.isArray(body.queueItems));
  assert.equal(body.compact, true);
});

test('publication-attempts default reports counts and omitted terminal rows', () => {
  const body = bridge('publication-attempts', {});
  assert.ok(body.counts && typeof body.counts === 'object');
  assert.equal(typeof body.omittedTerminal, 'number');
  assert.ok(Array.isArray(body.attempts));
});

test('publication-attempts with a state filter omits counts and omittedTerminal', () => {
  const body = bridge('publication-attempts', { state: 'confirmed_published' });
  assert.equal(body.counts, undefined);
  assert.equal(body.omittedTerminal, undefined);
});
