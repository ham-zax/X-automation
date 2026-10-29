import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, chmod, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = await mkdtemp(path.join(os.tmpdir(), 'xgrowth-analytics-outcome-'));
const binDir = path.join(root, 'bin');
const fixturePath = path.join(root, 'lease-fixture.mjs');
const loaderPath = path.join(root, 'lease-loader.mjs');
const claivePath = path.join(binDir, 'claive');
await mkdir(binDir);

// The short retry path must not launch a collector while Growth is active.
await writeFile(path.join(binDir, 'systemctl'), `#!${process.execPath}\nprocess.stdout.write('0\\n');\n`, { mode: 0o700 });
await chmod(path.join(binDir, 'systemctl'), 0o700);

// Replace only the production tab lease. The runner, checkpoint and outcome
// parsing stay real; the fixture records one allocation and one release.
await writeFile(fixturePath, String.raw`import { appendFileSync } from 'node:fs';
export async function leaseAgentBrowserTab({ cli, cdpPort, sessionId } = {}) {
  appendFileSync(process.env.XGROWTH_TEST_LEASE_LOG, JSON.stringify({ event: 'allocate', sessionId, cli, cdpPort }) + '\n');
  let released = false;
  return {
    targetId: 'A'.repeat(32),
    pagesAtStart: 2,
    async release() {
      appendFileSync(process.env.XGROWTH_TEST_LEASE_LOG, JSON.stringify({ event: 'release', sessionId, targetId: 'A'.repeat(32), released }) + '\n');
      if (released) return { cleaned: false, warnings: ['released twice'] };
      released = true;
      return { cleaned: true, warnings: [] };
    },
  };
}
`);
await writeFile(loaderPath, String.raw`import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './ops/agent_browser_session.js' && context.parentURL?.endsWith('/growth_analytics_runner.js')) {
      return { url: pathToFileURL(process.env.XGROWTH_TEST_LEASE_FIXTURE).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
`);

const fakeClaive = '#!' + process.execPath + '\n' + String.raw`const fs = require('node:fs');
const path = require('node:path');
const scenario = process.env.XGROWTH_FAKE_SCENARIO || '';
const resultFile = process.env.X_GROWTH_ANALYTICS_RESULT_FILE;
const sessionId = process.env.X_GROWTH_ANALYTICS_SESSION_ID;
const promptArg = process.argv.indexOf('--prompt-file');
const promptFile = promptArg >= 0 ? process.argv[promptArg + 1] : '';
let prompt = '';
try { prompt = fs.readFileSync(promptFile, 'utf8'); } catch {}
const checks = {
  absoluteResultFile: typeof resultFile === 'string' && path.isAbsolute(resultFile),
  resultNamed: typeof resultFile === 'string' && path.basename(resultFile) === 'result.json',
  privatePromptDir: Boolean(process.env.TMPDIR) && promptFile.startsWith(process.env.TMPDIR + path.sep),
  samePrivateDir: typeof resultFile === 'string' && path.dirname(resultFile) === path.dirname(promptFile),
  sessionShape: /^analytics-[0-9a-f-]{36}$/.test(String(sessionId || '')),
  promptPathLiteral: prompt.includes(JSON.stringify(resultFile)),
  promptSessionLiteral: prompt.includes(JSON.stringify(sessionId)),
  promptContract: prompt.includes('zero_with_access') && prompt.includes('blocked'),
};
const ok = Object.values(checks).every(Boolean);
fs.appendFileSync(process.env.XGROWTH_FAKE_CLAIVE_LOG, JSON.stringify({ scenario, ok, checks, resultFile, sessionId, promptFile }) + '\n');
if (!ok) process.exit(9);

const results = {
  collected: { schemaVersion: 1, sessionId, outcome: 'collected', recordedPosts: 2, reason: 'Recorded two owned posts from Analytics.' },
  zero: { schemaVersion: 1, sessionId, outcome: 'zero_with_access', recordedPosts: 0, reason: 'Analytics accessible; no eligible measurable posts.' },
  blocked: { schemaVersion: 1, sessionId, outcome: 'blocked', recordedPosts: 0, reason: 'Login form blocked Account Analytics.' },
  partial: { schemaVersion: 1, sessionId, outcome: 'blocked', recordedPosts: 3, reason: 'Analytics access stopped after three acknowledged posts.' },
  'wrong-session': { schemaVersion: 1, sessionId: 'analytics-00000000-0000-4000-8000-000000000000', outcome: 'collected', recordedPosts: 1, reason: 'Wrong session claim.' },
  'wrong-version': { schemaVersion: 2, sessionId, outcome: 'collected', recordedPosts: 1, reason: 'Wrong schema claim.' },
  'extra-field': { schemaVersion: 1, sessionId, outcome: 'collected', recordedPosts: 1, reason: 'Extra field claim.', extra: true },
  'missing-field': { schemaVersion: 1, sessionId, outcome: 'collected', recordedPosts: 1 },
  'bad-outcome': { schemaVersion: 1, sessionId, outcome: 'success', recordedPosts: 1, reason: 'Unknown outcome claim.' },
  'collected-zero': { schemaVersion: 1, sessionId, outcome: 'collected', recordedPosts: 0, reason: 'Collected with no count.' },
  'zero-nonzero': { schemaVersion: 1, sessionId, outcome: 'zero_with_access', recordedPosts: 4, reason: 'Zero outcome with count.' },
  'invalid-count': { schemaVersion: 1, sessionId, outcome: 'blocked', recordedPosts: -1, reason: 'Negative count claim.' },
  'blank-reason': { schemaVersion: 1, sessionId, outcome: 'blocked', recordedPosts: 0, reason: '   ' },
  'long-reason': { schemaVersion: 1, sessionId, outcome: 'blocked', recordedPosts: 0, reason: 'x'.repeat(501) },
  'credential-reason': { schemaVersion: 1, sessionId, outcome: 'blocked', recordedPosts: 0, reason: 'authorization: Bearer abcdefghijklmnop' },
};

if (scenario === 'missing') process.exit(0);
if (scenario === 'malformed') {
  fs.writeFileSync(resultFile, '{"schemaVersion":1,"sessionId":"LEAK-MARKER"');
  process.exit(0);
}
if (scenario === 'oversize') {
  fs.writeFileSync(resultFile, 'x'.repeat(17000));
  process.exit(0);
}
if (scenario === 'nonzero-collected') {
  fs.writeFileSync(resultFile, JSON.stringify(results.collected));
  process.exit(2);
}
fs.writeFileSync(resultFile, JSON.stringify(results[scenario]), { mode: 0o600 });
process.exit(0);
`;
await writeFile(claivePath, fakeClaive, { mode: 0o700 });
await chmod(claivePath, 0o700);

after(() => rm(root, { recursive: true, force: true }));

async function newCase(name) {
  const dir = path.join(root, name);
  await mkdir(path.join(dir, 'state', 'x_test'), { recursive: true });
  await mkdir(path.join(dir, 'home'), { recursive: true });
  await mkdir(path.join(dir, 'tmp'), { recursive: true });
  return dir;
}
const checkpointPath = dir => path.join(dir, 'state', 'x_test', 'analytics-collector.json');
const leaseLogPath = dir => path.join(dir, 'lease.log');
const claiveLogPath = dir => path.join(dir, 'claive.log');
async function readCheckpoint(dir) {
  return JSON.parse(await readFile(checkpointPath(dir), 'utf8'));
}
async function readLines(file) {
  try {
    return (await readFile(file, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
function launch(dir, scenario) {
  return spawnSync(process.execPath, ['--import', loaderPath, path.join(repo, 'growth_analytics_runner.js')], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 20_000,
    env: {
      PATH: `${binDir}:${process.env.PATH || '/usr/bin:/bin'}`,
      HOME: path.join(dir, 'home'),
      TMPDIR: path.join(dir, 'tmp'),
      XDG_STATE_HOME: path.join(dir, 'state'),
      X_GROWTH_CLAIVE_BIN: claivePath,
      X_GROWTH_AGENT_BROWSER_CLI: path.join(binDir, 'agent-browser'),
      X_GROWTH_BROWSER_CDP_PORT: '19222',
      XGROWTH_TEST_LEASE_FIXTURE: fixturePath,
      XGROWTH_TEST_LEASE_LOG: leaseLogPath(dir),
      XGROWTH_FAKE_CLAIVE_LOG: claiveLogPath(dir),
      XGROWTH_FAKE_SCENARIO: scenario,
    },
  });
}
async function assertOneLease(dir) {
  const lease = await readLines(leaseLogPath(dir));
  const allocations = lease.filter(event => event.event === 'allocate');
  const releases = lease.filter(event => event.event === 'release');
  assert.equal(allocations.length, 1, 'one tab allocation');
  assert.equal(releases.length, 1, 'one exact tab release');
  assert.match(allocations[0].sessionId, /^analytics-[0-9a-f-]{36}$/);
  assert.equal(releases[0].sessionId, allocations[0].sessionId);
  assert.equal(releases[0].targetId, 'A'.repeat(32));
  assert.equal(releases[0].released, false);
}
async function assertPromptCleanup(dir, expectedInvocations = 1) {
  const claive = await readLines(claiveLogPath(dir));
  assert.equal(claive.length, expectedInvocations);
  for (const entry of claive) {
    assert.equal(entry.ok, true, `fake child contract checks: ${JSON.stringify(entry.checks)}`);
    assert.equal(existsSync(entry.promptFile), false, 'temporary prompt removed');
    assert.equal(existsSync(entry.resultFile), false, 'temporary result removed');
    assert.equal(existsSync(path.dirname(entry.promptFile)), false, 'temporary prompt dir removed');
  }
  assert.deepEqual(await readdir(path.join(dir, 'tmp')), [], 'no temporary invocation directory remains');
}

test('collected and zero-with-access are completed with truthful child counts', async () => {
  const collected = await newCase('collected');
  const first = launch(collected, 'collected');
  assert.equal(first.error, undefined);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /Analytics browser tab cleanup: \{"cleaned":true,"warnings":\[\]\}/);
  let checkpoint = await readCheckpoint(collected);
  assert.equal(checkpoint.status, 'completed');
  assert.equal(checkpoint.exitCode, 0);
  assert.equal(checkpoint.collectionOutcome, 'collected');
  assert.equal(checkpoint.recordedPosts, 2);
  assert.equal(checkpoint.collectionReason, 'Recorded two owned posts from Analytics.');
  assert.equal(typeof checkpoint.updatedAt, 'number');
  assert.equal('error' in checkpoint, false);
  await assertOneLease(collected);
  await assertPromptCleanup(collected);

  // A later invocation must never reuse the previous private result path.
  await rm(checkpointPath(collected));
  const second = launch(collected, 'collected');
  assert.equal(second.status, 0, second.stderr);
  const claive = await readLines(claiveLogPath(collected));
  assert.equal(claive.length, 2);
  assert.notEqual(claive[0].resultFile, claive[1].resultFile);
  assert.notEqual(claive[0].sessionId, claive[1].sessionId);
  assert.equal(existsSync(path.dirname(claive[0].resultFile)), false);
  assert.equal(existsSync(path.dirname(claive[1].resultFile)), false);
  const leases = await readLines(leaseLogPath(collected));
  assert.equal(leases.filter(event => event.event === 'allocate').length, 2);
  assert.equal(leases.filter(event => event.event === 'release').length, 2);
  await assertPromptCleanup(collected, 2);

  const zero = await newCase('zero');
  const run = launch(zero, 'zero');
  assert.equal(run.status, 0, run.stderr);
  checkpoint = await readCheckpoint(zero);
  assert.equal(checkpoint.status, 'completed');
  assert.equal(checkpoint.exitCode, 0);
  assert.equal(checkpoint.collectionOutcome, 'zero_with_access');
  assert.equal(checkpoint.recordedPosts, 0);
  assert.equal(checkpoint.collectionReason, 'Analytics accessible; no eligible measurable posts.');
  await assertOneLease(zero);
  await assertPromptCleanup(zero);
});

test('a truthful blocked child fails even when it exits zero', async () => {
  for (const [scenario, recordedPosts, reason] of [
    ['blocked', 0, 'Login form blocked Account Analytics.'],
    ['partial', 3, 'Analytics access stopped after three acknowledged posts.'],
  ]) {
    const dir = await newCase(scenario);
    const run = launch(dir, scenario);
    assert.equal(run.status, 1, run.stderr);
    const checkpoint = await readCheckpoint(dir);
    assert.equal(checkpoint.status, 'failed');
    assert.equal(checkpoint.exitCode, 0, 'the actual child exit code is retained');
    assert.equal(checkpoint.collectionOutcome, 'blocked');
    assert.equal(checkpoint.recordedPosts, recordedPosts);
    assert.equal(checkpoint.collectionReason, reason);
    assert.equal(typeof checkpoint.updatedAt, 'number');
    assert.match(checkpoint.error, /Analytics collection blocked:/);
    assert.ok(checkpoint.error.length <= 500);
    await assertOneLease(dir);
    await assertPromptCleanup(dir);
  }
});

test('missing, malformed and oversize outcomes fail closed without leaking content', async () => {
  const missing = await newCase('missing');
  let run = launch(missing, 'missing');
  assert.equal(run.status, 1);
  let checkpoint = await readCheckpoint(missing);
  assert.equal(checkpoint.status, 'failed');
  assert.equal(checkpoint.collectionOutcome, null);
  assert.equal(checkpoint.recordedPosts, null);
  assert.equal(checkpoint.collectionReason, null);
  assert.match(checkpoint.error, /outcome invalid: file is missing\./);
  await assertOneLease(missing);

  const malformed = await newCase('malformed');
  run = launch(malformed, 'malformed');
  assert.equal(run.status, 1);
  checkpoint = await readCheckpoint(malformed);
  assert.match(checkpoint.error, /not valid JSON/);
  assert.equal(run.stderr.includes('LEAK-MARKER'), false, 'raw malformed JSON is not logged');
  await assertOneLease(malformed);

  const oversize = await newCase('oversize');
  run = launch(oversize, 'oversize');
  assert.equal(run.status, 1);
  checkpoint = await readCheckpoint(oversize);
  assert.match(checkpoint.error, /larger than 16 KiB/);
  assert.equal(checkpoint.collectionOutcome, null);
  await assertOneLease(oversize);
});

test('wrong session, version, fields, outcome or counts fail closed', async () => {
  for (const [scenario, pattern] of [
    ['wrong-session', /sessionId does not match/],
    ['wrong-version', /schemaVersion must be 1/],
    ['extra-field', /exact fields are required/],
    ['missing-field', /exact fields are required/],
    ['bad-outcome', /outcome is not supported/],
    ['collected-zero', /collected requires at least one recorded post/],
    ['zero-nonzero', /zero_with_access requires zero recorded posts/],
    ['invalid-count', /nonnegative safe integer/],
    ['blank-reason', /reason must be trimmed text/],
    ['long-reason', /reason must be trimmed text/],
    ['credential-reason', /must not contain credentials/],
  ]) {
    const dir = await newCase(scenario);
    const run = launch(dir, scenario);
    assert.equal(run.status, 1, `${scenario}: ${run.stdout}`);
    const checkpoint = await readCheckpoint(dir);
    assert.equal(checkpoint.status, 'failed', scenario);
    assert.equal(checkpoint.exitCode, 0, scenario);
    assert.equal(checkpoint.collectionOutcome, null, scenario);
    assert.equal(checkpoint.recordedPosts, null, scenario);
    assert.equal(checkpoint.collectionReason, null, scenario);
    assert.match(checkpoint.error, pattern, scenario);
    assert.ok(checkpoint.error.length <= 500, scenario);
    await assertOneLease(dir);
    await assertPromptCleanup(dir);
  }
});

test('a collected claim never overrides a nonzero child exit', async () => {
  const dir = await newCase('nonzero-collected');
  const run = launch(dir, 'nonzero-collected');
  assert.equal(run.status, 1);
  const checkpoint = await readCheckpoint(dir);
  assert.equal(checkpoint.status, 'failed');
  assert.equal(checkpoint.exitCode, 2);
  assert.equal(checkpoint.collectionOutcome, 'collected');
  assert.equal(checkpoint.recordedPosts, 2);
  assert.equal(checkpoint.collectionReason, 'Recorded two owned posts from Analytics.');
  assert.match(checkpoint.error, /child exited with code 2/);
  await assertOneLease(dir);
  await assertPromptCleanup(dir);
});

test('failed and completed checkpoints keep their existing cooldown behavior', async () => {
  const failed = await newCase('retry-failed');
  const failedSeed = JSON.stringify({ lastStartedAt: Date.now() - 2 * 3_600_000, status: 'failed' });
  await writeFile(checkpointPath(failed), failedSeed);
  const retry = launch(failed, 'collected');
  assert.equal(retry.status, 0, retry.stderr);
  const retried = await readCheckpoint(failed);
  assert.equal(retried.status, 'completed');
  assert.equal(retried.collectionOutcome, 'collected');
  assert.ok(retried.lastStartedAt > JSON.parse(failedSeed).lastStartedAt, 'the failed checkpoint can start a new collection');
  assert.equal((await readLines(claiveLogPath(failed))).length, 1);

  const completed = await newCase('skip-completed');
  const completedSeed = JSON.stringify({ lastStartedAt: Date.now() - 2 * 3_600_000, status: 'completed' });
  await writeFile(checkpointPath(completed), completedSeed);
  const skip = launch(completed, 'collected');
  assert.equal(skip.status, 0, skip.stderr);
  assert.match(skip.stdout, /recently attempted/);
  assert.equal(await readFile(checkpointPath(completed), 'utf8'), completedSeed, 'skip keeps checkpoint bytes unchanged');
  assert.deepEqual(await readLines(claiveLogPath(completed)), []);
  assert.deepEqual(await readLines(leaseLogPath(completed)), []);
});
