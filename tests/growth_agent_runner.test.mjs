import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(tmpdir(), 'growth-runner-'));
const previousCwd = process.cwd();
process.chdir(scratch);
// Importing the runner must neither invoke a real runtime nor operate on live state.
const runner = await import(pathToFileURL(path.join(root, 'growth_agent_runner.js')).href);
// Every harness run gets its own backoff file here, so no test touches the real default path.
const backoffDir = await mkdtemp(path.join(tmpdir(), 'growth-runner-backoff-'));
after(() => rm(backoffDir, { recursive: true, force: true }));
let harnessCount = 0;


function tickMain({ config = null, env = null, tickImpl = null } = {}) {
  // Ordinary-main harness: the controllerTick seam counts invocations and the
  // child stub throws if anything ever tries to spawn a reasoning child.
  const ticks = [];
  let childCalls = 0;
  const dependencies = {
    config: config || runner.runtimeConfig(env || {}),
    now: () => 100_000,
    record: () => {},
    backoffStateFile: path.join(backoffDir, `tick-${++harnessCount}.json`),
    controllerTick: async (options) => {
      ticks.push(options);
      if (tickImpl) return tickImpl(options);
      return { status: 'blocked', reason: 'test-tick', jobId: null, attemptId: null, modelCalls: 0 };
    },
    child: async () => { childCalls++; throw new Error('reasoning child must not spawn'); },
  };
  return { dependencies, ticks, childCalls: () => childCalls };
}

try {
  await test('default executor carries verified discovery-to-Original/Thread path and preserves claim fences', () => {
    const defaultPrompt = runner.buildOperatorPrompt({ runtime: 'claive', sessionId: 'discovery-check', maxDurationMinutes: 20 });
    const legacyPrompt = runner.buildOperatorPrompt({ mode: 'legacy', runtime: 'claive', sessionId: 'discovery-check', maxDurationMinutes: 20 });
    for (const needle of ['useful-tech discovery', 'xDiscoveryInspirations', 'primary_supported', 'writer-packet',
      'mission-approve', 'browser-publish-claim', 'publication-attempt-send-start', 'record-action',
      'no synonym', 'existing candidate key']) {
      assert.ok(defaultPrompt.toLowerCase().includes(needle.toLowerCase()), 'Default executor missing: ' + needle);
    }
    assert.match(defaultPrompt, /quick act cannot attach media or publish a multi-part Thread/i);
    assert.match(defaultPrompt, /not another feed/i);
    assert.doesNotMatch(defaultPrompt, /Only the bridge .*act.* publishes\./i);
    assert.ok(legacyPrompt.includes('Owner-selected discovery angle'));
  });
  await test('runtime selection bounds the window and Claude uses explicit noninteractive permissions', () => {
    assert.equal(runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claude' }).windowMinutes, 20);
    for (const value of ['0', '-1', '481', 'NaN']) assert.throws(() => runner.runtimeConfig({ X_GROWTH_AGENT_WINDOW_MINUTES: value }));
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'unknown' }));
    assert.throws(() => runner.runtimeConfig({ NODE_ENV: 'production' }), /AI_ALLOW_RUNTIME_MANAGED/);
    assert.equal(runner.runtimeConfig({ NODE_ENV: 'production', AI_ALLOW_RUNTIME_MANAGED: 'true' }).runtime, 'opencode');
    const command = runner.commandFor(runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claude' }), 'work');
    assert.equal(command.stdinPrompt, 'work');
    assert.equal(command.args[command.args.indexOf('--permission-mode') + 1], 'dontAsk');
    assert.equal(command.args.includes('--dangerously-skip-permissions'), false);
    assert.ok(command.args.includes('Bash(npm run agent -- *)'));
    assert.ok(command.args.includes('mcp__browser-fast__*'));
    const openCode = runner.commandFor(runner.runtimeConfig({}), 'work');
    assert.ok(openCode.args.includes('--standalone'));
    assert.equal(openCode.args.includes('--pure'), false);
  });
  await test('Pi runtime targets the headless Linux browser and passes the prompt after --', () => {
    const config = runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'pi', X_GROWTH_PI_BIN: '/opt/pi', HOME: '/h' });
    assert.equal(config.executable, '/opt/pi');
    assert.equal(config.browserTarget, 'linux');
    assert.equal(config.model, 'opencode2api/muse-spark-1.3-contributor-free');
    const command = runner.commandFor(config, 'work');
    assert.equal(command.stdinPrompt, undefined);
    assert.deepEqual(command.args.slice(-2), ['--', 'work']);
    for (const flag of ['--print', '--no-session', '--offline', '--no-extensions', '--no-approve']) assert.ok(command.args.includes(flag), flag);
    assert.equal(command.args[command.args.indexOf('--provider') + 1], 'opencode2api');
    assert.equal(command.args[command.args.indexOf('--model') + 1], 'muse-spark-1.3-contributor-free');
    assert.equal(command.args[command.args.indexOf('--tools') + 1], 'read,bash');
    assert.equal(command.args[command.args.indexOf('--thinking') + 1], 'high');
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'pi', X_GROWTH_PI_THINKING: 'turbo' }), /X_GROWTH_PI_THINKING/);
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_BROWSER_TARGET: 'mars' }), /X_GROWTH_BROWSER_TARGET/);
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_BROWSER_CDP_PORT: '9222; rm' }), /CDP_PORT/);
  });
await test('default and executor wakes invoke exactly one finite tick and never continue', async () => {
    for (const [label, env] of [['default', {}], ['executor', { GROWTH_AGENT_MODE: 'executor' }]]) {
      const state = tickMain({ config: runner.runtimeConfig({ ...env, X_GROWTH_AGENT_WINDOW_MINUTES: '480' }) });
      const result = await runner.main(state.dependencies);
      assert.equal(state.ticks.length, 1, label);
      assert.equal(state.childCalls(), 0, label);
      assert.equal(result.status, 'blocked', label);
      assert.equal(result.reason, 'test-tick', label);
      assert.equal(result.controller.reason, 'test-tick', label);
      assert.equal(result.windowMinutes, 480, label);
      if (label === 'executor') assert.equal(result.agentModeNote, 'executor_alias_controller');
      else assert.equal(result.agentModeNote, undefined);
    }
  });
  await test('legacy mode is rejected with zero tick and zero child', async () => {
    const state = tickMain({ config: runner.runtimeConfig({ GROWTH_AGENT_MODE: 'legacy' }) });
    const result = await runner.main(state.dependencies);
    assert.equal(result.status, 'blocked');
    assert.match(result.reason, /legacy_retired/);
    assert.equal(state.ticks.length, 0);
    assert.equal(state.childCalls(), 0);
  });
  await test('ordinary main runs the real controller tick with zero child', async () => {
    // No controllerTick seam: the real tick runs against the scratch store
    // (delegation not live) and no reasoning child may spawn.
    const config = runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'codex' });
    let childCalls = 0;
    const result = await runner.main({
      config, now: () => 100_000, record: () => {},
      backoffStateFile: path.join(backoffDir, `real-tick-${++harnessCount}.json`),
      child: async () => { childCalls++; throw new Error('reasoning child must not spawn'); },
    });
    assert.equal(result.status, 'blocked');
    assert.equal(result.controller.status, 'blocked');
    assert.equal(childCalls, 0);
  });
  await test('Claive Codex selection forwards the ephemeral Luna profile and runtimeExecution', async () => {
    const state = tickMain({ config: runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'codex' }) });
    await runner.main(state.dependencies);
    assert.equal(state.ticks.length, 1);
    const options = state.ticks[0];
    assert.equal(options.profile?.runtime, 'codex');
    assert.equal(options.profile?.model, 'gpt-6-luna');
    assert.equal(options.profile?.reasoning, 'max');
    assert.deepEqual(options.runtimeExecution, {
      runtime: 'claive', engine: 'codex',
      executable: state.dependencies.config.executable,
      codexExecutable: state.dependencies.config.codexExecutable,
    });
  });
  await test('native codex and unsupported selections forward without substitution', async () => {
    const native = tickMain({ config: runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'codex' }) });
    await runner.main(native.dependencies);
    assert.equal(native.ticks[0].profile?.runtime, 'codex');
    assert.equal(native.ticks[0].profile?.model, 'gpt-6-luna');
    assert.equal(native.ticks[0].runtimeExecution?.runtime, 'codex');
    assert.equal(native.ticks[0].runtimeExecution?.engine, 'codex');
    const nativeExplicit = tickMain({ config: runner.runtimeConfig({
      X_GROWTH_AGENT_RUNTIME: 'codex', X_GROWTH_AGENT_MODEL: 'gpt-6',
    }) });
    await runner.main(nativeExplicit.dependencies);
    assert.equal(nativeExplicit.ticks[0].profile?.model, 'gpt-6');
    assert.equal(nativeExplicit.ticks[0].runtimeExecution?.runtime, 'codex');
    const pi = tickMain({ config: runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'pi' }) });
    await runner.main(pi.dependencies);
    assert.equal(pi.ticks[0].profile?.runtime, 'pi');
    assert.equal(pi.ticks[0].runtimeExecution, null);
    const other = tickMain({ config: runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claude' }) });
    await runner.main(other.dependencies);
    assert.equal(other.ticks[0].profile?.runtime, 'claude');
    assert.equal(other.ticks[0].runtimeExecution, null);
  });
  await test('explicit controller profile and runtimeExecution override the ephemeral defaults', async () => {
    const custom = { name: 'custom', runtime: 'direct_api', providerKind: 'openai_compatible', protocol: 'responses', model: 'custom-model', baseUrl: 'https://example.invalid/v1' };
    const state = tickMain({ config: runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'codex' }) });
    state.dependencies.controller = { profile: custom, runtimeExecution: { runtime: 'custom' } };
    await runner.main(state.dependencies);
    assert.equal(state.ticks[0].profile, custom);
    assert.deepEqual(state.ticks[0].runtimeExecution, { runtime: 'custom' });
  });
  await test('controllerRuntimeProfile maps selections without touching saved state', () => {
    const claiveCodex = runner.controllerRuntimeProfile(runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'codex' }));
    assert.equal(claiveCodex.profile.runtime, 'codex');
    assert.equal(claiveCodex.profile.model, 'gpt-6-luna');
    assert.equal(claiveCodex.profile.reasoning, 'max');
    assert.equal(claiveCodex.runtimeExecution.runtime, 'claive');
    assert.equal(claiveCodex.runtimeExecution.engine, 'codex');
    assert.ok(String(claiveCodex.runtimeExecution.executable).length > 0);
    assert.ok(String(claiveCodex.runtimeExecution.codexExecutable).length > 0);
    const nativeExplicit = runner.controllerRuntimeProfile(runner.runtimeConfig({
      X_GROWTH_AGENT_RUNTIME: 'codex', X_GROWTH_AGENT_MODEL: 'gpt-6',
    }));
    assert.equal(nativeExplicit.profile.model, 'gpt-6');
    for (const env of [
      { X_GROWTH_AGENT_RUNTIME: 'opencode' },
      { X_GROWTH_AGENT_RUNTIME: 'pi', X_GROWTH_PI_BIN: '/opt/pi' },
      { X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'pi' },
      { X_GROWTH_AGENT_RUNTIME: 'claive' },
    ]) {
      const ephemeral = runner.controllerRuntimeProfile(runner.runtimeConfig(env));
      assert.equal(ephemeral.runtimeExecution, null);
      assert.ok(String(ephemeral.profile.runtime).length > 0);
    }
  });
  await test('Claive Pi uses opencode2api and inherits the selected model without Muse flags', () => {
    const config = runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'pi' });
    const { args } = runner.commandFor(config, 'work', { promptFile: '/tmp/operator.md' });
    assert.equal(config.model, '');
    assert.equal(args[args.indexOf('--engine') + 1], 'pi');
    assert.equal(args[args.indexOf('--provider') + 1], 'opencode2api');
    assert.equal(args[args.indexOf('--reasoning-effort') + 1], 'max');
    for (const flag of ['--model', '--max-model-steps', '--web', '--fallback-models']) assert.equal(args.includes(flag), false);
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'other' }), /must be muse, pi, or codex/);
  });
  await test('Claive Codex defaults to Luna and permits an owner-selected model', () => {
    const config = runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'codex' });
    assert.equal(config.model, 'gpt-6-luna');
    assert.equal(runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'codex', X_GROWTH_AGENT_MODEL: 'gpt-6' }).model, 'gpt-6');
    const command = runner.commandFor(config, 'work', { promptFile: '/tmp/operator.md' });
    const { args } = command;
    assert.equal(args[args.indexOf('--engine') + 1], 'codex');
    assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
    assert.equal(args[args.indexOf('--reasoning-effort') + 1], 'max');
    assert.equal(args.includes('--web'), true);
    for (const flag of ['--max-model-steps', '--provider', '--session-id', '--output-schema', '--fallback-models']) assert.equal(args.includes(flag), false);
    assert.deepEqual(command.env, { CLAIVE_CODEX_YOLO: '1', CLAIVE_CODEX_USE_USER_CONFIG: '1' });
  });
  await test('Claive Muse and Pi commands carry no yolo env', () => {
    for (const engine of ['muse', 'pi']) {
      const command = runner.commandFor(runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: engine }), 'work', { promptFile: '/tmp/operator.md' });
      assert.equal(command.env, undefined, engine);
    }
  });
  await test('prompt follows the browser target and no longer hardcodes the WebHarness path', () => {
    const base = { runtime: 'pi', sessionId: 'pi-1', maxDurationMinutes: 20 };
    const linux = runner.operatorPrompt({ ...base, browserTarget: 'linux', agentBrowserCli: '/bin/ab', cdpPort: '9333' });
    assert.match(linux, /\/bin\/ab --cdp 9333 --session pi-1/);
    assert.match(linux, /browserTarget=linux/);
    assert.match(linux, /do not log in/);
    assert.doesNotMatch(linux, /Windows X/);
    const windows = runner.operatorPrompt(base);
    assert.match(windows, /Windows X tab/);
    assert.match(windows, /browserTarget=windows/);
    assert.doesNotMatch(linux, /webharness\/node_modules/);
    assert.match(runner.operatorPrompt({ ...base, agentBrowserCli: '/x/ab.js' }), /CLI at \/x\/ab\.js/);
    assert.match(windows, /adapterType `pi_unattended`/);
  });
  await test('deadline kills a runtime that ignores SIGTERM and cleans up signal listeners', async () => {
    const pidFile = path.join(scratch, 'runtime.pid');
    const beforeTerm = process.listenerCount('SIGTERM');
    const beforeInt = process.listenerCount('SIGINT');
    const source = `require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`;
    await assert.rejects(runner.runChild({ executable: process.execPath, args: ['-e', source] }, { cwd: scratch, timeoutMs: 2000, killGraceMs: 40 }), /deadline expired/);
    const pid = Number(await readFile(pidFile, 'utf8'));
    assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
    assert.equal(process.listenerCount('SIGTERM'), beforeTerm);
    assert.equal(process.listenerCount('SIGINT'), beforeInt);
  });
} finally {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
}

test('experiment mode is opt-in and only adds the experiment section to the prompt', () => {
  const base = { runtime: 'pi', sessionId: 's', browserTarget: 'linux', agentBrowserCli: '/bin/agent-browser' };
  assert.equal(runner.operatorPrompt(base).includes('EXPERIMENT MODE'), false);
  assert.equal(runner.operatorPrompt({ ...base, experiment: true }).includes('EXPERIMENT MODE'), true);
  assert.equal(runner.runtimeConfig({}).experiment, false);
  assert.equal(runner.runtimeConfig({ X_GROWTH_AGENT_EXPERIMENT: 'true' }).experiment, true);
});

test('GROWTH_AGENT_MODE defaults to controller, keeps executor and legacy spellings, rejects others', () => {
  assert.equal(runner.runtimeConfig({}).agentMode, 'controller');
  assert.equal(runner.runtimeConfig({ GROWTH_AGENT_MODE: ' Executor ' }).agentMode, 'executor');
  assert.equal(runner.runtimeConfig({ GROWTH_AGENT_MODE: ' Legacy ' }).agentMode, 'legacy');
  assert.throws(() => runner.runtimeConfig({ GROWTH_AGENT_MODE: 'fast' }), /GROWTH_AGENT_MODE/);
});

test('default executor prompt is a compact scout and act loop with run and session bindings', async () => {
  const base = { runtime: 'claive', sessionId: 'claive-s1', maxDurationMinutes: 15, browserTarget: 'linux', agentBrowserCli: '/bin/ab', cdpPort: '9333' };
  const executor = runner.buildOperatorPrompt({ ...base });
  const legacy = runner.operatorPrompt(base);
  const recovery = await readFile(path.join(root, 'docs/GROWTH_CONTEXT_RECOVERY.md'), 'utf8');
  for (const prompt of [executor, legacy]) assert.ok(prompt.includes(recovery));
  for (const prompt of [executor, legacy]) assert.ok(prompt.includes('Write a reply as @ham_zax'));
  for (const text of ['scout', 'act', 'record-disposition', 'runId', 'sessionId `claive-s1`', 'https://x.com/notifications/mentions',
    'growth-run-begin', 'adapterType `claive_unattended`', 'ceilings.maxPublicMutations=25', 'ceilings.maxDurationMinutes=15']) {
    assert.ok(executor.includes(text), text);
  }
  assert.ok(executor.length < legacy.length);
  assert.ok(executor.split('\n').length <= 120);
  assert.equal(runner.buildOperatorPrompt({ ...base, mode: 'executor' }), executor);
});

test('GROWTH_AGENT_MODE=legacy builds the previous operator prompt unchanged', () => {
  const base = { runtime: 'pi', sessionId: 'pi-1', maxDurationMinutes: 15, browserTarget: 'linux', agentBrowserCli: '/bin/ab', cdpPort: '9333' };
  const legacy = runner.buildOperatorPrompt({ ...base, mode: runner.runtimeConfig({ GROWTH_AGENT_MODE: 'legacy' }).agentMode });
  assert.equal(legacy, runner.operatorPrompt(base));
  assert.ok(legacy.includes('You are the unattended reasoning operator for XGrowth'));
  assert.ok(legacy.includes('Before scanning, read operator-status and growth-run-next'));
  assert.equal(legacy.includes('growth-run-begin'), true);
});

// Runs fn with a fresh state file path; the file holds `contents` when given.
async function withStateFile(fn, contents) {
  const dir = await mkdtemp(path.join(tmpdir(), 'growth-backoff-'));
  try {
    const file = path.join(dir, 'backoff.json');
    if (contents !== undefined) await writeFile(file, contents);
    return await fn(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const readState = async file => JSON.parse(await readFile(file, 'utf8'));

test('child failures are classified from exit code, deadline, and captured tail', () => {
  const { classifyChildResult, CHILD_FAILURE_PATTERNS } = runner;
  assert.ok(CHILD_FAILURE_PATTERNS.rate_limited instanceof RegExp);
  assert.ok(CHILD_FAILURE_PATTERNS.provider_error instanceof RegExp);
  assert.equal(classifyChildResult({ exitCode: 0, tail: 'HTTP 429' }), 'ok');
  for (const tail of ['HTTP 429 Too Many Requests', 'Error: rate limit exceeded', 'quota exhausted', 'too many requests'])
    assert.equal(classifyChildResult({ exitCode: 1, tail }), 'rate_limited', tail);
  for (const tail of ['API Error: 503 overloaded', 'read ECONNRESET', 'connect ETIMEDOUT', 'socket hang up', 'provider error: bad gateway'])
    assert.equal(classifyChildResult({ exitCode: 1, tail }), 'provider_error', tail);
  assert.equal(classifyChildResult({ exitCode: 1, tail: 'syntax error in prompt' }), 'other');
  assert.equal(classifyChildResult({ exitCode: undefined, tail: '' }), 'other');
  assert.equal(classifyChildResult({ exitCode: 1, deadlineExpired: true, tail: 'HTTP 429' }), 'deadline');
  assert.equal(classifyChildResult({ exitCode: null, deadlineExpired: true }), 'deadline');
});

test('backoff waits 2, 4, 8, 16, 30, 30 minutes over consecutive rate or provider failures', () => {
  const start = 1_000_000;
  let state = runner.emptyBackoffState();
  const waits = [];
  for (const kind of ['rate_limited', 'provider_error', 'rate_limited', 'provider_error', 'rate_limited', 'provider_error']) {
    state = runner.nextBackoffState(state, kind, start);
    waits.push((state.notBefore - start) / 60_000);
  }
  assert.deepEqual(waits, [2, 4, 8, 16, 30, 30]);
  assert.equal(state.consecutiveFailures, 6);
  assert.equal(state.lastKind, 'provider_error');
});

test('an ok child resets the backoff counter and clears the gate', () => {
  let state = runner.emptyBackoffState();
  for (let i = 0; i < 3; i++) state = runner.nextBackoffState(state, 'rate_limited', 0);
  state = runner.nextBackoffState(state, 'ok', 5);
  assert.deepEqual(state, { consecutiveFailures: 0, lastKind: 'ok', lastAt: 5, notBefore: null });
  assert.equal(runner.nextBackoffState(state, 'rate_limited', 0).notBefore, 2 * 60_000);
});

test('deadline and other failures are logged without changing the counter or the gate', () => {
  const failed = { consecutiveFailures: 3, lastKind: 'rate_limited', lastAt: 10, notBefore: 480_010 };
  for (const kind of ['deadline', 'other']) {
    const next = runner.nextBackoffState(failed, kind, 20);
    assert.equal(next.consecutiveFailures, 3, kind);
    assert.equal(next.notBefore, 480_010, kind);
    assert.equal(next.lastKind, kind);
    assert.equal(next.lastAt, 20);
  }
});

test('a wake with a stored non-gating counter still ticks once and leaves the file alone', async () => {
  // No reasoning child runs anymore, so there is no child outcome to persist:
  // a stored deadline/other counter passes the gate, the tick runs once, and
  // the file is byte-identical afterwards.
  const state = tickMain({});
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    const before = await readFile(file, 'utf8');
    const outcome = await runner.main(state.dependencies);
    assert.equal(state.ticks.length, 1);
    assert.equal(state.childCalls(), 0);
    assert.equal(outcome.controller.reason, 'test-tick');
    assert.equal(await readFile(file, 'utf8'), before);
  }, JSON.stringify({ consecutiveFailures: 2, lastKind: 'deadline', lastAt: 1, notBefore: null }));
});

test('a future notBefore launches no tick and reports the remaining wait', async () => {
  const state = tickMain({});
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    const outcome = await runner.main(state.dependencies);
    assert.equal(outcome.status, 'backoff');
    assert.equal(outcome.reason, 'child_failure_backoff');
    assert.equal(outcome.lastKind, 'provider_error');
    assert.equal(outcome.remainingMs, 60_000);
    assert.equal(state.ticks.length, 0);
    assert.equal(state.childCalls(), 0);
  }, JSON.stringify({ consecutiveFailures: 1, lastKind: 'provider_error', lastAt: 99_000, notBefore: 160_000 }));
});

test('a corrupt backoff file means no backoff and the tick runs without repairing the file', async () => {
  const state = tickMain({});
  const corrupt = '{"consecutiveFailures": 4, "notBefore": ';
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    const outcome = await runner.main(state.dependencies);
    assert.equal(outcome.controller.reason, 'test-tick');
    assert.equal(state.ticks.length, 1);
    assert.equal(state.childCalls(), 0);
    assert.equal(await readFile(file, 'utf8'), corrupt);
  }, corrupt);
});

test('a missing backoff file means no backoff and the tick runs without creating one', async () => {
  const state = tickMain({});
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    const outcome = await runner.main(state.dependencies);
    assert.equal(outcome.controller.reason, 'test-tick');
    assert.equal(state.ticks.length, 1);
    assert.equal(state.childCalls(), 0);
    await assert.rejects(readFile(file), { code: 'ENOENT' });
  });
});

test('X_GROWTH_AGENT_BACKOFF=off ticks despite a future notBefore and leaves the file alone', async () => {
  const state = tickMain({});
  const contents = JSON.stringify({ consecutiveFailures: 3, lastKind: 'rate_limited', lastAt: 99_000, notBefore: 900_000 });
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    state.dependencies.env = { X_GROWTH_AGENT_BACKOFF: 'off' };
    const outcome = await runner.main(state.dependencies);
    assert.equal(outcome.controller.reason, 'test-tick');
    assert.equal(state.ticks.length, 1);
    assert.equal(state.childCalls(), 0);
    assert.equal(await readFile(file, 'utf8'), contents);
  }, contents);
});

test('an expired backoff window ticks once without rewriting the counter', async () => {
  // Retired with the elapsed loop: no child outcome means no 'ok' reset.
  // The expired gate passes, exactly one tick runs, and the stored counter
  // is left for the next real child outcome to update.
  const state = tickMain({});
  const contents = JSON.stringify({ consecutiveFailures: 3, lastKind: 'rate_limited', lastAt: 1, notBefore: 50_000 });
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    await runner.main(state.dependencies);
    assert.equal(state.ticks.length, 1);
    assert.equal(await readFile(file, 'utf8'), contents);
  }, contents);
});

// Records what the runner writes to this process's stdout and stderr. Nothing reaches the
// real streams, so child output cannot disturb the test reporter.
// Collects forwarded child output through runChild's sinks. The global streams are
// not stubbed because the node test reporter writes to them while a test runs.
function sink() {
  const chunks = [];
  return { chunks, write: (chunk) => { chunks.push(Buffer.from(chunk).toString('utf8')); return true; } };
}

test('backoff state path defaults under XDG_STATE_HOME or HOME and honours the explicit override', () => {
  assert.equal(runner.backoffStateFilePath({ XDG_STATE_HOME: '/xdg' }), path.join('/xdg', 'x_test', 'growth-runner-backoff.json'));
  assert.equal(runner.backoffStateFilePath({}), path.join(homedir(), '.local', 'state', 'x_test', 'growth-runner-backoff.json'));
  assert.equal(runner.backoffStateFilePath({ XDG_STATE_HOME: '/xdg', X_GROWTH_AGENT_BACKOFF_FILE: '/tmp/explicit.json' }), '/tmp/explicit.json');
});

test('backoff state writes create a 0700 parent, a 0600 file, and leave no temp file behind', async () => {
  const file = path.join(backoffDir, 'nested', 'x_test', 'growth-runner-backoff.json');
  const state = { consecutiveFailures: 1, lastKind: 'other', lastAt: 1, notBefore: null };
  runner.writeBackoffState(file, state);
  assert.equal((await stat(path.dirname(file))).mode & 0o777, 0o700);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(path.dirname(file)), ['growth-runner-backoff.json']);
  assert.deepEqual(await readState(file), state);
});

test('a wake with no explicit backoff file runs its tick and writes nothing', async () => {
  const state = tickMain({});
  const xdg = await mkdtemp(path.join(backoffDir, 'xdg-'));
  state.dependencies.backoffStateFile = undefined;
  state.dependencies.env = { XDG_STATE_HOME: xdg };
  await runner.main(state.dependencies);
  assert.equal(state.ticks.length, 1);
  assert.equal(state.childCalls(), 0);
  await assert.rejects(readFile(path.join(xdg, 'x_test', 'growth-runner-backoff.json')), { code: 'ENOENT' });
});

test('a real child that prints a 429 forwards its output unchanged for classification', async () => {
  // Retired through-main persistence: with no reasoning child, classification
  // stays a pure helper (covered above) and runChild forwarding is verified
  // directly here.
  const source = "process.stdout.write('fwd-out\\n');process.stderr.write('fwd-err HTTP 429 Too Many Requests\\n');process.exitCode = 1;";
  const stdout = sink();
  const stderr = sink();
  const error = await runner.runChild({ executable: process.execPath, args: ['-e', source] }, { cwd: tmpdir(), timeoutMs: 10_000, stdout, stderr }).catch(caught => caught);
  assert.equal(stdout.chunks.join(''), 'fwd-out\n');
  assert.equal(stderr.chunks.join(''), 'fwd-err HTTP 429 Too Many Requests\n');
  assert.equal(error.exitCode, 1);
  assert.equal(runner.classifyChildResult({ exitCode: error.exitCode, tail: error.outputTail }), 'rate_limited');
});

test('runChild merges command env into the child environment', async () => {
  const stdout = sink();
  await runner.runChild({ executable: process.execPath, args: ['-e', "process.stdout.write(String(process.env.CLAIVE_CODEX_YOLO))"], env: { CLAIVE_CODEX_YOLO: '1' } },
    { cwd: tmpdir(), timeoutMs: 10_000, stdout, stderr: sink() });
  assert.equal(stdout.chunks.join(''), '1');
});

test('runChild forwards large output unchanged and rejects with only the last 16 KiB for classification', async () => {
  const source = "process.stdout.write('fwd-' + 'x'.repeat(40 * 1024) + '\\nHTTP 429\\n');process.exitCode = 1;";
  const stdout = sink();
  const error = await runner.runChild({ executable: process.execPath, args: ['-e', source] }, { cwd: tmpdir(), timeoutMs: 10_000, stdout, stderr: sink() }).catch(caught => caught);
  assert.equal(error.exitCode, 1);
  assert.equal(stdout.chunks.join(''), `fwd-${'x'.repeat(40 * 1024)}\nHTTP 429\n`);
  assert.equal(error.outputTail.length, 16 * 1024);
  assert.ok(error.outputTail.endsWith('\nHTTP 429\n'));
  assert.equal(runner.classifyChildResult({ exitCode: error.exitCode, tail: error.outputTail }), 'rate_limited');
});
