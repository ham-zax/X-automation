import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(os.tmpdir(), 'xgrowth-analytics-cooldown-'));
const stateDir = path.join(scratch, 'x_test');
const binDir = path.join(scratch, 'bin');
await mkdir(stateDir);
await mkdir(binDir);
// An active Growth agent stops the real runner before browser allocation.
await writeFile(path.join(binDir, 'systemctl'), `#!${process.execPath}\nprocess.stdout.write('123\\n');\n`, { mode: 0o700 });
after(() => rm(scratch, { recursive: true, force: true }));

test('only explicit failed collections receive the shorter retry delay', async () => {
  for (const [status, ageHours, expected] of [
    ['failed', 0.5, 'recently attempted'],
    ['failed', 2, 'Growth Luna owns browser'],
    ['completed', 2, 'recently attempted'],
    ['running', 2, 'recently attempted'],
    [undefined, 2, 'recently attempted'],
    ['completed', 22, 'Growth Luna owns browser'],
  ]) {
    const state = { lastStartedAt: Date.now() - ageHours * 3_600_000, ...(status ? { status } : {}) };
    const file = path.join(stateDir, 'analytics-collector.json');
    const serialized = JSON.stringify(state);
    await writeFile(file, serialized);
    const run = spawnSync(process.execPath, [path.join(repo, 'growth_analytics_runner.js')], {
      cwd: scratch, encoding: 'utf8', timeout: 10_000,
      env: { ...process.env, XDG_STATE_HOME: scratch, PATH: `${binDir}:${process.env.PATH}` },
    });
    assert.equal(run.error, undefined);
    assert.equal(run.status, 0, `${status}: ${run.stderr}`);
    assert.ok(run.stdout.includes(expected), `${status} at ${ageHours} hours: ${run.stdout}`);
    assert.equal(await readFile(file, 'utf8'), serialized, 'a skipped invocation must not advance the checkpoint');
  }
});
