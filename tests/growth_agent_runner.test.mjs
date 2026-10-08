import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(tmpdir(), 'growth-runner-'));
const previousCwd = process.cwd();
process.chdir(scratch);
// Importing the runner must neither invoke a real runtime nor operate on live state.
const runner = await import(pathToFileURL(path.join(root, 'growth_agent_runner.js')).href);

function harness({ minutes = 120, stopReason = 'resource_ceiling_reached', mutate } = {}) {
  let clock = 100_000;
  let grant = { state: 'running', mode: 'live', revision: 7 };
  const calls = [], runs = new Map();
  let heartbeatStops = 0;
  const dependencies = {
    config: runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claude', X_GROWTH_AGENT_WINDOW_MINUTES: String(minutes) }),
    now: () => clock,
    delegation: () => grant,
    lease: () => ({ active: false }),
    health: () => ({ health: { state: 'normal' } }),
    attempts: () => [],
    record: () => {},
    runs: ({ status, sessionId }) => status ? [] : [runs.get(sessionId)].filter(Boolean),
    heartbeat: () => () => { heartbeatStops++; },
    child: async (command, options) => {
      const sessionId = /sessionId `([^`]+)`/.exec(command.stdinPrompt)[1];
      const duration = Number(/maxDurationMinutes=(\d+)/.exec(command.stdinPrompt)[1]);
      calls.push({ sessionId, duration, timeoutMs: options.timeoutMs });
      clock += duration * 60_000;
      runs.set(sessionId, { runId: `run-${calls.length}`, sessionId, status: 'completed', stopReason,
        result: { investigating: 0, closedUnresolved: 0 } });
      mutate?.({ calls, grant, setGrant: value => { grant = value; }, runs, sessionId, dependencies });
    },
  };
  return { dependencies, calls, heartbeatStops: () => heartbeatStops };
}

try {
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
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'pi', X_GROWTH_AGENT_MODEL: 'opencode2api/nemotron-3-ultra-free' }), /Nemotron and Ling/);
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'pi', X_GROWTH_AGENT_MODEL: 'opencode2api/ling-3.1-flash' }), /Nemotron and Ling/);
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_BROWSER_TARGET: 'mars' }), /X_GROWTH_BROWSER_TARGET/);
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_BROWSER_CDP_PORT: '9222; rm' }), /CDP_PORT/);
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
  await test('two-hour window creates sequential fresh sessions with bounded passes and deadlines', async () => {
    const state = harness();
    const outcome = await runner.main(state.dependencies);
    assert.equal(outcome.reason, 'operation_window_elapsed');
    assert.equal(state.calls.length, 6);
    assert.equal(new Set(state.calls.map(call => call.sessionId)).size, 6);
    assert.equal(state.heartbeatStops(), 6);
    assert.deepEqual(state.calls.map(call => call.duration), [20, 20, 20, 20, 20, 20]);
    assert.deepEqual(state.calls.map(call => call.timeoutMs), [22, 22, 22, 22, 22, 20].map(n => n * 60_000));
    const remainder = harness({ minutes: 25 });
    await runner.main(remainder.dependencies);
    assert.deepEqual(remainder.calls.map(call => call.duration), [20, 5]);
  });
  await test('no worthwhile work ends the window without manufacturing additional sessions', async () => {
    const state = harness({ stopReason: 'no_worthwhile_eligible_work' });
    const result = await runner.main(state.dependencies);
    assert.equal(state.calls.length, 1);
    assert.equal(result.stopReason, 'no_worthwhile_eligible_work');
  });
  await test('continuation requires an explicitly clean completed run', () => {
    const clean = { status: 'completed', stopReason: 'resource_ceiling_reached', result: { closedUnresolved: 0, investigating: 0 } };
    assert.equal(runner.continuationAllowed(clean), true);
    for (const run of [null, { ...clean, status: 'partial' }, { ...clean, result: {} },
      { ...clean, result: { investigating: 1, closedUnresolved: 0 } },
      { ...clean, result: { investigating: 0, closedUnresolved: 1 } }]) assert.equal(runner.continuationAllowed(run), false);
  });
  await test('revoked authority, constrained health and competing leases stop before another runtime', async () => {
    for (const reason of ['delegation_not_live_or_revised', 'account_health_constrained',
      'operator_lease_active']) {
      let block = false;
      const state = harness({ mutate: ({ setGrant, grant }) => {
        block = true;
        if (reason === 'delegation_not_live_or_revised') setGrant({ ...grant, revision: 8 });
      } });
      if (reason === 'account_health_constrained') state.dependencies.health = () => ({ health: { state: block ? 'constrained' : 'normal' } });
      if (reason === 'operator_lease_active') state.dependencies.lease = () => ({ active: block, leaseId: 'other', runId: 'other-run' });
      const outcome = await runner.main(state.dependencies);
      assert.equal(outcome.reason, reason);
      assert.equal(state.calls.length, 1);
    }
  });
  await test('an orphaned active run does not block a fresh reasoning session when no lease is active', async () => {
    const state = harness({ minutes: 20 });
    const originalRuns = state.dependencies.runs;
    state.dependencies.runs = (query) => query.status === 'active'
      ? [{ runId: 'stale-run', sessionId: 'old-session', status: 'active', stopReason: '' }]
      : originalRuns(query);
    const result = await runner.main(state.dependencies);
    assert.equal(state.calls.length, 1);
    assert.equal(result.reason, 'operation_window_elapsed');
  });
  await test('normal child exit with its durable run still active closes the orphan canonically', async () => {
    const state = harness({ minutes: 20 });
    let activeRun = null;
    let finished = null;
    state.dependencies.runs = ({ status, sessionId }) => {
      if (status) return [];
      return activeRun && activeRun.sessionId === sessionId ? [activeRun] : [];
    };
    state.dependencies.child = async (command) => {
      const sessionId = /sessionId `([^`]+)`/.exec(command.stdinPrompt)[1];
      activeRun = { runId: 'run-active', sessionId, status: 'active', stopReason: '' };
    };
    state.dependencies.finishRun = (runId, payload) => {
      finished = { runId, payload };
      activeRun = { ...activeRun, status: payload.status, stopReason: payload.stopReason, finishedAt: 123456 };
      return activeRun;
    };
    const result = await runner.main(state.dependencies);
    assert.equal(finished.runId, 'run-active');
    assert.equal(finished.payload.status, 'partial');
    assert.equal(finished.payload.stopReason, 'manual_intervention_required');
    assert.equal(finished.payload.result.launcherRecovery.reason, 'normal_child_exit_with_active_run');
    assert.equal(finished.payload.result.runtimeFailure, undefined);
    assert.equal(result.status, 'partial');
    assert.equal(result.reason, 'launcher_closed_orphaned_active_run');
    assert.equal(result.stopReason, 'manual_intervention_required');
    assert.equal(state.heartbeatStops(), 1);
  });
  await test('runtime failure and a session without its own durable run cannot be reported as another run', async () => {
    const state = harness();
    state.dependencies.runs = () => [];
    const result = await runner.main(state.dependencies);
    assert.equal(result.reason, 'runtime_completed_without_growth_run');
    assert.equal(state.calls.length, 1);
    const failure = harness();
    failure.dependencies.child = async () => { throw new Error('fixture failure'); };
    await assert.rejects(runner.main(failure.dependencies), /fixture failure/);
    assert.equal(failure.heartbeatStops(), 1);
  });
  await test('runtime failure after a durable run starts closes the run and releases recovery responsibility', async () => {
    const state = harness();
    let activeRun = null;
    let finished = null;
    state.dependencies.runs = ({ status, sessionId }) => {
      if (status) return [];
      return activeRun && activeRun.sessionId === sessionId ? [activeRun] : [];
    };
    state.dependencies.child = async (command) => {
      const sessionId = /sessionId `([^`]+)`/.exec(command.stdinPrompt)[1];
      activeRun = { runId: 'run-active', sessionId, status: 'active', stopReason: '' };
      throw new Error('malformed server-sent event JSON');
    };
    state.dependencies.finishRun = (runId, payload) => {
      finished = { runId, payload };
      activeRun = { ...activeRun, status: payload.status, stopReason: payload.stopReason, finishedAt: 123456 };
      return activeRun;
    };
    const result = await runner.main(state.dependencies);
    assert.equal(finished.runId, 'run-active');
    assert.equal(finished.payload.status, 'partial');
    assert.equal(finished.payload.stopReason, 'capability_unavailable');
    assert.match(finished.payload.stopDetail, /malformed server-sent event JSON/);
    assert.equal(finished.payload.result.runtimeFailure.runtime, 'claude');
    assert.equal(result.status, 'partial');
    assert.equal(result.reason, 'runtime_provider_failure');
    assert.equal(result.stopReason, 'capability_unavailable');
    assert.equal(state.heartbeatStops(), 1);
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
