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
    backoffStateFile: path.join(backoffDir, `harness-${++harnessCount}.json`),
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
  await test('Claive pins Muse and cleans its operational prompt after a bounded pass', async () => {
    const state = harness({ minutes: 20 });
    state.dependencies.config = runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive' });
    assert.equal(state.dependencies.config.model, 'muse-spark-1.3-contributor');
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_AGENT_MODEL: 'other' }), /require/);
    let promptFile;
    state.dependencies.child = async (command) => {
      assert.equal(command.executable, path.join(process.env.HOME, '.local/bin/claive'));
      assert.equal(command.args[0], 'run');
      assert.equal(command.args[command.args.indexOf('--engine') + 1], 'muse');
      assert.equal(command.args[command.args.indexOf('--reasoning-effort') + 1], 'xhigh');
      assert.equal(command.args[command.args.indexOf('--model') + 1], 'muse-spark-1.3-contributor');
      assert.equal(command.args.includes('--fallback-models'), false);
      promptFile = command.args[command.args.indexOf('--prompt-file') + 1];
      const prompt = await readFile(promptFile, 'utf8');
      assert.match(prompt, /adapterType `claive_unattended`/);
      assert.match(prompt, /publication-attempt-send-start/);
    };
    state.dependencies.runs = () => [{ runId: 'claive-run', status: 'completed', stopReason: 'no_worthwhile_eligible_work' }];
    const result = await runner.main(state.dependencies);
    assert.equal(result.stopReason, 'no_worthwhile_eligible_work');
    await assert.rejects(readFile(promptFile), { code: 'ENOENT' });
    state.dependencies.child = async (command) => {
      promptFile = command.args[command.args.indexOf('--prompt-file') + 1];
      throw new Error('runtime unavailable');
    };
    state.dependencies.runs = () => [];
    await assert.rejects(runner.main(state.dependencies), /runtime unavailable/);
    await assert.rejects(readFile(promptFile), { code: 'ENOENT' });
    assert.equal(state.heartbeatStops(), 2);
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
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'pi', X_GROWTH_AGENT_MODEL: 'nemotron-free' }), /not allowed/);
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'pi', X_GROWTH_AGENT_MODEL: 'ling-3.1-flash' }), /not allowed/);
  });
  await test('Claive Codex pins gpt-6-luna at max effort in yolo mode without unsupported flags', () => {
    const config = runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'codex' });
    assert.equal(config.model, 'gpt-6-luna');
    assert.throws(() => runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'codex', X_GROWTH_AGENT_MODEL: 'gpt-6' }), /require gpt-6-luna/);
    const command = runner.commandFor(config, 'work', { promptFile: '/tmp/operator.md' });
    const { args } = command;
    assert.equal(args[args.indexOf('--engine') + 1], 'codex');
    assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-luna');
    assert.equal(args[args.indexOf('--reasoning-effort') + 1], 'max');
    assert.equal(args.includes('--web'), true);
    for (const flag of ['--max-model-steps', '--provider', '--session-id', '--output-schema', '--fallback-models']) assert.equal(args.includes(flag), false);
    assert.deepEqual(command.env, { CLAIVE_CODEX_YOLO: '1' });
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
  await test('normal incomplete exit closes the orphan and allows only one continuation before any claim', async () => {
    const state = harness({ minutes: 20 });
    let activeRun = null;
    let finished = null;
    let childCalls = 0;
    state.dependencies.runs = ({ status, sessionId }) => {
      if (status) return [];
      return activeRun && activeRun.sessionId === sessionId ? [activeRun] : [];
    };
    state.dependencies.child = async (command) => {
      childCalls++;
      if (childCalls === 2) assert.match(command.stdinPrompt, /CONTINUATION: Run run-active/);
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
    assert.equal(childCalls, 2);
    assert.equal(state.heartbeatStops(), 2);
    assert.equal(result.sessions.length, 2);
  });
  await test('an incomplete run with any publication attempt is not automatically restarted', async () => {
    const state = harness({ minutes: 20 });
    let activeRun = null;
    let calls = 0;
    state.dependencies.runs = ({ sessionId }) => activeRun?.sessionId === sessionId ? [activeRun] : [];
    state.dependencies.child = async command => {
      calls++;
      activeRun = { runId: 'claimed-run', sessionId: /sessionId `([^`]+)`/.exec(command.stdinPrompt)[1], status: 'active' };
    };
    state.dependencies.attempts = ({ runId, limit }) => {
      assert.equal(runId, 'claimed-run');
      assert.equal(limit, 1);
      return [{ attemptId: 'existing-attempt', state: 'claimed' }];
    };
    state.dependencies.finishRun = (runId, payload) => ({ ...activeRun, ...payload });
    const result = await runner.main(state.dependencies);
    assert.equal(calls, 1);
    assert.equal(result.reason, 'launcher_closed_orphaned_active_run');
    assert.equal(state.heartbeatStops(), 1);
  });
  await test('Pi retains run and session across early ends and restricts uncertain sends to reconciliation', async () => {
    const state = harness({ minutes: 20 });
    state.dependencies.config = runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'pi' });
    let activeRun, engineId, count = 0;
    state.dependencies.runs = ({ sessionId }) => activeRun?.sessionId === sessionId ? [activeRun] : [];
    state.dependencies.attempts = () => [{ attemptId: 'owned', state: count === 1 ? 'claimed' : 'send_started' }];
    state.dependencies.child = async command => {
      const prompt = await readFile(command.args[command.args.indexOf('--prompt-file') + 1], 'utf8');
      const id = command.args[command.args.indexOf('--session-id') + 1];
      if (!count) {
        engineId = id;
        activeRun = { runId: 'same-run', sessionId: /sessionId `([^`]+)`/.exec(prompt)[1], status: 'active' };
      } else {
        assert.equal(id, engineId);
        assert.match(prompt, /SAME Growth Run same-run/);
        assert.ok(prompt.includes(activeRun.sessionId));
        assert.match(prompt, count === 1 ? /owned claimed attempt/ : /RECONCILIATION ONLY/);
      }
      count++;
    };
    let finishes = 0;
    state.dependencies.finishRun = (id, payload) => { finishes++; return { ...activeRun, ...payload }; };
    const result = await runner.main(state.dependencies);
    assert.equal(count, 4);
    assert.equal(finishes, 1);
    assert.equal(state.heartbeatStops(), 1);
    assert.equal(result.sessions.length, 1);
  });
  await test('Pi provider failure never launches a continuation', async () => {
    const state = harness({ minutes: 20 });
    state.dependencies.config = runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'pi' });
    let count = 0;
    state.dependencies.child = async () => { count++; throw new Error('provider failed'); };
    await assert.rejects(runner.main(state.dependencies), /provider failed/);
    assert.equal(count, 1);
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

test('GROWTH_AGENT_MODE defaults to executor, accepts legacy, and rejects other values', () => {
  assert.equal(runner.runtimeConfig({}).agentMode, 'executor');
  assert.equal(runner.runtimeConfig({ GROWTH_AGENT_MODE: ' Legacy ' }).agentMode, 'legacy');
  assert.throws(() => runner.runtimeConfig({ GROWTH_AGENT_MODE: 'fast' }), /GROWTH_AGENT_MODE/);
});

test('default executor prompt is a compact scout and act loop with run and session bindings', () => {
  const base = { runtime: 'claive', sessionId: 'claive-s1', maxDurationMinutes: 15, browserTarget: 'linux', agentBrowserCli: '/bin/ab', cdpPort: '9333' };
  const executor = runner.buildOperatorPrompt({ ...base });
  const legacy = runner.operatorPrompt(base);
  for (const text of ['scout', 'act', 'record-disposition', 'runId', 'sessionId `claive-s1`', 'https://x.com/notifications/mentions',
    'growth-run-begin', 'adapterType `claive_unattended`', 'ceilings.maxPublicMutations=8', 'ceilings.maxDurationMinutes=15']) {
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

test('the default executor prompt reaches the runtime child through main', async () => {
  const state = harness({ minutes: 20 });
  const prompts = [];
  state.dependencies.child = async (command) => { prompts.push(command.stdinPrompt); };
  state.dependencies.runs = () => [{ runId: 'run-1', status: 'completed', stopReason: 'no_worthwhile_eligible_work' }];
  await runner.main(state.dependencies);
  assert.ok(prompts.length >= 1);
  assert.match(prompts[0], /You are the unattended growth operator for XGrowth/);
  assert.match(prompts[0], /adapterType `claude_unattended`/);
  assert.match(prompts[0], /maxDurationMinutes=20/);
  assert.equal(prompts[0].includes('Before scanning, read operator-status'), false);
});

test('GROWTH_AGENT_MODE=legacy sends the legacy prompt through main', async () => {
  const state = harness({ minutes: 20 });
  state.dependencies.config = runner.runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claude', X_GROWTH_AGENT_WINDOW_MINUTES: '20', GROWTH_AGENT_MODE: 'legacy' });
  const prompts = [];
  state.dependencies.child = async (command) => { prompts.push(command.stdinPrompt); };
  state.dependencies.runs = () => [{ runId: 'run-1', status: 'completed', stopReason: 'no_worthwhile_eligible_work' }];
  await runner.main(state.dependencies);
  assert.ok(prompts.length >= 1);
  assert.ok(prompts[0].includes('You are the unattended reasoning operator for XGrowth'));
  assert.ok(prompts[0].includes('Before scanning, read operator-status and growth-run-next'));
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

test('a deadline-killed child through main leaves the persisted counter unchanged', async () => {
  const state = harness({ minutes: 20 });
  state.dependencies.runs = () => [];
  state.dependencies.child = async () => {
    throw Object.assign(new Error('Growth agent runtime deadline expired.'), { deadlineExpired: true });
  };
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    await assert.rejects(runner.main(state.dependencies), /deadline expired/);
    assert.deepEqual(await readState(file), { consecutiveFailures: 2, lastKind: 'deadline', lastAt: 100_000, notBefore: null });
  }, JSON.stringify({ consecutiveFailures: 2, lastKind: 'rate_limited', lastAt: 1, notBefore: null }));
});

test('a future notBefore launches no child and reports the remaining wait', async () => {
  const state = harness({ minutes: 20 });
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    const outcome = await runner.main(state.dependencies);
    assert.equal(outcome.status, 'backoff');
    assert.equal(outcome.reason, 'child_failure_backoff');
    assert.equal(outcome.lastKind, 'provider_error');
    assert.equal(outcome.remainingMs, 60_000);
    assert.equal(state.calls.length, 0);
    assert.equal(state.heartbeatStops(), 0);
  }, JSON.stringify({ consecutiveFailures: 1, lastKind: 'provider_error', lastAt: 99_000, notBefore: 160_000 }));
});

test('a corrupt backoff file means no backoff and the child launches', async () => {
  const state = harness({ minutes: 20 });
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    const outcome = await runner.main(state.dependencies);
    assert.equal(outcome.reason, 'operation_window_elapsed');
    assert.equal(state.calls.length, 1);
    assert.equal((await readState(file)).consecutiveFailures, 0);
  }, '{"consecutiveFailures": 4, "notBefore": ');
});

test('a missing backoff file means no backoff and the child launches', async () => {
  const state = harness({ minutes: 20 });
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    state.dependencies.child = async () => { throw new Error('runtime unavailable'); };
    await assert.rejects(runner.main(state.dependencies), /runtime unavailable/);
    assert.deepEqual(await readState(file), { consecutiveFailures: 0, lastKind: 'other', lastAt: 100_000, notBefore: null });
  });
});

test('X_GROWTH_AGENT_BACKOFF=off launches despite a future notBefore and leaves the file alone', async () => {
  const state = harness({ minutes: 20 });
  const contents = JSON.stringify({ consecutiveFailures: 3, lastKind: 'rate_limited', lastAt: 99_000, notBefore: 900_000 });
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    state.dependencies.env = { X_GROWTH_AGENT_BACKOFF: 'off' };
    const outcome = await runner.main(state.dependencies);
    assert.equal(outcome.reason, 'operation_window_elapsed');
    assert.equal(state.calls.length, 1);
    assert.equal(await readFile(file, 'utf8'), contents);
  }, contents);
});

test('a successful child after a backoff window resets the persisted counter', async () => {
  const state = harness({ minutes: 20 });
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    await runner.main(state.dependencies);
    assert.equal(state.calls.length, 1);
    assert.equal((await readState(file)).consecutiveFailures, 0);
    assert.equal((await readState(file)).lastKind, 'ok');
  }, JSON.stringify({ consecutiveFailures: 3, lastKind: 'rate_limited', lastAt: 1, notBefore: 50_000 }));
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

test('main persists to the default path under XDG_STATE_HOME when no explicit file is configured', async () => {
  const state = harness({ minutes: 20 });
  const xdg = await mkdtemp(path.join(backoffDir, 'xdg-'));
  state.dependencies.backoffStateFile = undefined;
  state.dependencies.env = { XDG_STATE_HOME: xdg };
  await runner.main(state.dependencies);
  assert.equal(state.calls.length, 1);
  const persisted = await readState(path.join(xdg, 'x_test', 'growth-runner-backoff.json'));
  assert.equal(persisted.consecutiveFailures, 0);
  assert.equal(persisted.lastKind, 'ok');
});

test('a real child that prints a 429 is persisted as rate_limited through main, and its output is forwarded', async () => {
  const state = harness({ minutes: 20 });
  const source = "process.stdout.write('fwd-out\\n');process.stderr.write('fwd-err HTTP 429 Too Many Requests\\n');process.exitCode = 1;";
  const stdout = sink();
  const stderr = sink();
  state.dependencies.child = (command, options) => runner.runChild({ executable: process.execPath, args: ['-e', source] }, { ...options, stdout, stderr });
  await withStateFile(async file => {
    state.dependencies.backoffStateFile = file;
    await assert.rejects(runner.main(state.dependencies), /exited with code 1/);
    assert.equal(stdout.chunks.join(''), 'fwd-out\n');
    assert.equal(stderr.chunks.join(''), 'fwd-err HTTP 429 Too Many Requests\n');
    assert.deepEqual(await readState(file), { consecutiveFailures: 1, lastKind: 'rate_limited', lastAt: 100_000, notBefore: 220_000 });
  });
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
