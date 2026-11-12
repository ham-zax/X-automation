import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoveryBlock } from '../discovery_schedule.js';
import { reconcileExitedSessionRun, runLiveSessionPreflight } from '../ops/live_session_preflight.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(tmpdir(), 'attached-live-'));
const previousCwd = process.cwd();
// Importing the runner opens its SQLite file relative to cwd; keep that disposable.
process.chdir(scratch);
const { runAttachedLiveSession } = await import(pathToFileURL(path.join(root, 'ops/attached_live_session.mjs')).href);
process.chdir(previousCwd);

after(async () => {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
});

const BASELINE = Object.freeze(['EE7FB04B22D884108A739F63B939DFB0', '805FD13B9236394CB0A18B0BBBB6FA7E']);
const TARGET = 'A1B2C3D4E5F60718293A4B5C6D7E8F90';
const BRIEF = 'Session {{SESSION}} owns {{OWNED_TAB}}.\n{{BROWSER_CONTRACT}}\n{{REPLY_CONTRACT}}\n{{WRITER_PREPARATION}}\n{{PREFLIGHT_CONTEXT}}\n';
let sequence = 0;

function config(overrides = {}) {
  return {
    browserTarget: 'linux',
    browserInterface: 'agent-browser-cli',
    agentBrowserCli: '/fake/agent-browser',
    cdpPort: '9222',
    codexExecutable: '/fake/codex',
    runtime: 'claive', claiveEngine: 'codex', model: 'gpt-6-luna', reasoning: 'max',
    executable: '/fake/claive', replyWriterMode: 'profile',
    ...overrides,
  };
}

async function makeRepo(brief = BRIEF) {
  const repoDir = path.join(scratch, `repo-${++sequence}`);
  await mkdir(path.join(repoDir, 'ops/systemd/arm'), { recursive: true });
  await writeFile(path.join(repoDir, 'ops/systemd/arm/arm-growth-live.md'), brief);
  return repoDir;
}

function fakeLease({ targetId = TARGET, result, error } = {}) {
  const targets = new Set(BASELINE);
  const calls = { allocate: [], release: 0 };
  const leaseTab = async (request) => {
    calls.allocate.push(request);
    targets.add(targetId);
    return {
      targetId,
      pagesAtStart: targets.size - 1,
      async release() {
        calls.release += 1;
        if (error) throw error;
        targets.delete(targetId);
        return result || { targetId, cleaned: true, warnings: [] };
      },
    };
  };
  return { leaseTab, calls, targets };
}

function fakeRun({ failure } = {}) {
  const calls = [];
  const run = async (command, options) => {
    calls.push({ command, options });
    if (failure) throw failure;
    return { code: 0 };
  };
  return { run, calls };
}

function captureConsole() {
  const lines = [];
  const original = { log: console.log, error: console.error };
  console.log = (...args) => lines.push({ level: 'log', text: args.join(' ') });
  console.error = (...args) => lines.push({ level: 'error', text: args.join(' ') });
  return {
    lines,
    restore() {
      console.log = original.log;
      console.error = original.error;
    },
  };
}

async function pathMissing(target) {
  try {
    await stat(target);
    return false;
  } catch {
    return true;
  }
}

for (const replyWriterMode of ['profile', 'operator']) {
test(`success renders the exact owned target and releases that one lease once (${replyWriterMode})`, async () => {
  const repoDir = await makeRepo();
  const stateDir = path.join(scratch, `state-${++sequence}`);
  const lease = fakeLease();
  const child = fakeRun();
  const capture = captureConsole();
  let result;
  try {
    result = await runAttachedLiveSession({
      repoDir,
      stateDir,
      sessionId: 'luna-arm-test-1',
      config: config({ replyWriterMode }),
      leaseTab: lease.leaseTab,
      run: child.run,
      claiveBin: '/fake/claive',
    });
  } finally {
    capture.restore();
  }

  assert.equal(lease.calls.allocate.length, 1);
  assert.deepEqual(lease.calls.allocate[0], {
    cli: '/fake/agent-browser', cdpPort: '9222', sessionId: 'luna-arm-test-1',
  });
  assert.equal(lease.calls.release, 1);
  for (const id of BASELINE) assert.ok(lease.targets.has(id), `baseline target ${id} must remain`);
  assert.equal(lease.targets.has(TARGET), false);

  const promptFile = path.join(stateDir, 'arm-growth-live.prompt.md');
  const prompt = await readFile(promptFile, 'utf8');
  assert.ok(prompt.includes('luna-arm-test-1'));
  assert.ok(prompt.includes(TARGET));
  assert.ok(prompt.includes('Browser interface: agent-browser-cli'));
  assert.ok(prompt.includes(`Use only launcher-owned target ${TARGET}`));
  assert.equal(prompt.includes('Write as @ham_zax'), replyWriterMode === 'operator');
  assert.equal(prompt.includes('saved reply_writer receives the full Reply contract server-side'), replyWriterMode === 'profile');
  assert.equal(prompt.includes('Reload persona-model'), replyWriterMode === 'operator');
  assert.equal(prompt.includes('read docs/CONTENT_OPERATING_STANDARD.md'), replyWriterMode === 'operator');
  assert.equal(prompt.includes('Profile Writer mode is active'), replyWriterMode === 'profile');
  assert.ok(prompt.includes('Preflight: manual/unpreflighted session; run normal block checks.'));
  assert.equal(prompt.includes('`tab new '), false);
  assert.equal(prompt.includes('`tab close '), false);
  assert.equal(prompt.includes('{{'), false);
  assert.equal((await stat(stateDir)).mode & 0o777, 0o700);
  assert.equal((await stat(promptFile)).mode & 0o777, 0o600);

  assert.equal(child.calls.length, 1);
  const { command, options } = child.calls[0];
  assert.equal(command.executable, '/fake/claive');
  assert.deepEqual(command.args, [
    'run',
    '--workspace', repoDir,
    '--prompt-file', promptFile,
    '--label', 'XGrowth autonomous operator',
    '--engine', 'codex',
    '--model', 'gpt-6-luna',
    '--reasoning-effort', 'max',
    '--web',
    '--turn-timeout', '900',
  ]);
  assert.deepEqual(command.env, {
    CODEX_WORKER_BINARY: '/fake/codex',
    X_GROWTH_OPERATOR_BROWSER_TAB: TARGET,
    CLAIVE_CODEX_YOLO: '1',
    CLAIVE_CODEX_USE_USER_CONFIG: '1',
    X_GROWTH_OPERATOR_RUNTIME: 'claive',
    X_GROWTH_OPERATOR_MODEL: 'gpt-6-luna',
    X_GROWTH_OPERATOR_REASONING: 'max',
    X_GROWTH_REPLY_WRITER_MODE: replyWriterMode,
  });
  assert.deepEqual(options, { cwd: repoDir, timeoutMs: 900_000, killGraceMs: 5_000 });

  assert.equal(capture.lines[0].level, 'log');
  assert.ok(capture.lines[0].text.includes('luna-arm-test-1'));
  assert.ok(capture.lines[0].text.includes(TARGET));
  assert.ok(capture.lines.some(line => line.text.includes(JSON.stringify({ targetId: TARGET, cleaned: true, warnings: [] }))));
  assert.deepEqual(result, {
    sessionId: 'luna-arm-test-1',
    targetId: TARGET,
    cleanup: { targetId: TARGET, cleaned: true, warnings: [] },
    operator: { runtime: 'claive', engine: 'codex', model: 'gpt-6-luna', reasoning: 'max',
      replyWriterMode, source: 'launcher_command_configuration' },
  });
});
}

test('a rejected child stays the primary error and the lease is still released', async () => {
  const repoDir = await makeRepo();
  const stateDir = path.join(scratch, `state-${++sequence}`);
  const childError = new Error('child rejected');
  const lease = fakeLease({ result: { targetId: TARGET, cleaned: false, warnings: ['owned tab still present'] } });
  const child = fakeRun({ failure: childError });
  const capture = captureConsole();
  try {
    await assert.rejects(runAttachedLiveSession({
      repoDir,
      stateDir,
      sessionId: 'luna-arm-test-2',
      config: config(),
      leaseTab: lease.leaseTab,
      run: child.run,
    }), error => {
      assert.equal(error, childError);
      return true;
    });
  } finally {
    capture.restore();
  }
  assert.equal(lease.calls.release, 1);
  for (const id of BASELINE) assert.ok(lease.targets.has(id));
  assert.ok(capture.lines.some(line => line.level === 'error' && line.text.includes('owned tab still present')));
});

test('a prompt-render failure releases the lease and never starts the child', async () => {
  const repoDir = await makeRepo('Session {{SESSION}} owns {{OWNED_TAB}} and {{UNKNOWN}}.\n{{BROWSER_CONTRACT}}\n');
  const stateDir = path.join(scratch, `state-${++sequence}`);
  const lease = fakeLease();
  const child = fakeRun();
  const capture = captureConsole();
  try {
    await assert.rejects(runAttachedLiveSession({
      repoDir,
      stateDir,
      sessionId: 'luna-arm-test-3',
      config: config(),
      leaseTab: lease.leaseTab,
      run: child.run,
    }), /Unfilled placeholder in the brief/);
  } finally {
    capture.restore();
  }
  assert.equal(lease.calls.release, 1);
  assert.equal(child.calls.length, 0);
  for (const id of BASELINE) assert.ok(lease.targets.has(id));
  assert.equal(await pathMissing(stateDir), true);
});

test('allocation failure starts no child and creates no state', async () => {
  const repoDir = await makeRepo();
  const stateDir = path.join(scratch, `state-${++sequence}`);
  const allocationError = new Error('allocation refused');
  const child = fakeRun();
  const calls = [];
  await assert.rejects(runAttachedLiveSession({
    repoDir,
    stateDir,
    sessionId: 'luna-arm-test-4',
    config: config(),
    leaseTab: async (request) => {
      calls.push(request);
      throw allocationError;
    },
    run: child.run,
  }), error => {
    assert.equal(error, allocationError);
    return true;
  });
  assert.equal(calls.length, 1);
  assert.equal(child.calls.length, 0);
  assert.equal(await pathMissing(stateDir), true);
});

test('a non-linux target or non-CLI interface is rejected before allocation', async () => {
  const repoDir = await makeRepo();
  const stateDir = path.join(scratch, `state-${++sequence}`);
  for (const overrides of [
    { browserTarget: 'windows' },
    { browserInterface: 'webharness-mcp' },
  ]) {
    const lease = fakeLease();
    const child = fakeRun();
    await assert.rejects(runAttachedLiveSession({
      repoDir,
      stateDir,
      sessionId: 'luna-arm-test-5',
      config: config(overrides),
      leaseTab: lease.leaseTab,
      run: child.run,
    }), /Attached live sessions require/);
    assert.equal(lease.calls.allocate.length, 0);
    assert.equal(child.calls.length, 0);
  }
  assert.equal(await pathMissing(stateDir), true);
});

test('an invalid session ID is rejected before allocation and state creation', async () => {
  const repoDir = await makeRepo();
  const stateDir = path.join(scratch, `state-${++sequence}`);
  const lease = fakeLease();
  const child = fakeRun();
  await assert.rejects(runAttachedLiveSession({
    repoDir,
    stateDir,
    sessionId: 'invalid session',
    config: config(),
    leaseTab: lease.leaseTab,
    run: child.run,
  }), /session ID/);
  assert.equal(lease.calls.allocate.length, 0);
  assert.equal(child.calls.length, 0);
  assert.equal(await pathMissing(stateDir), true);
});

test('incomplete cleanup fails an otherwise successful child', async () => {
  const repoDir = await makeRepo();
  const stateDir = path.join(scratch, `state-${++sequence}`);
  const lease = fakeLease({ result: { targetId: TARGET, cleaned: false, warnings: ['owned tab still present'] } });
  const child = fakeRun();
  const capture = captureConsole();
  try {
    await assert.rejects(runAttachedLiveSession({
      repoDir,
      stateDir,
      sessionId: 'luna-arm-test-7',
      config: config(),
      leaseTab: lease.leaseTab,
      run: child.run,
    }), /cleanup was incomplete: owned tab still present/);
  } finally {
    capture.restore();
  }
  assert.equal(lease.calls.release, 1);
  assert.equal(child.calls.length, 1);
  for (const id of BASELINE) assert.ok(lease.targets.has(id));
});

test('a release failure does not mask the child failure', async () => {
  const repoDir = await makeRepo();
  const stateDir = path.join(scratch, `state-${++sequence}`);
  const childError = new Error('child failed first');
  const releaseError = new Error('release failed second');
  const lease = fakeLease({ error: releaseError });
  const child = fakeRun({ failure: childError });
  const capture = captureConsole();
  try {
    await assert.rejects(runAttachedLiveSession({
      repoDir,
      stateDir,
      sessionId: 'luna-arm-test-8',
      config: config(),
      leaseTab: lease.leaseTab,
      run: child.run,
    }), error => {
      assert.equal(error, childError);
      return true;
    });
  } finally {
    capture.restore();
  }
  assert.equal(lease.calls.release, 1);
  assert.ok(capture.lines.some(line => line.level === 'error' && line.text.includes('cleanup failed')));
});

test('an existing prompt is made private before the child reads it', async () => {
  const repoDir = await makeRepo();
  const stateDir = path.join(scratch, `state-${++sequence}`);
  await mkdir(stateDir, { mode: 0o700 });
  const promptFile = path.join(stateDir, 'arm-growth-live.prompt.md');
  await writeFile(promptFile, 'old prompt');
  await chmod(promptFile, 0o644);
  const lease = fakeLease();
  const capture = captureConsole();
  let ran = false;
  try {
    await runAttachedLiveSession({
      repoDir, stateDir, sessionId: 'private-prompt', config: config(), leaseTab: lease.leaseTab,
      run: async () => {
        ran = true;
        assert.equal((await stat(promptFile)).mode & 0o777, 0o600);
      },
    });
  } finally { capture.restore(); }
  assert.equal(ran, true);
  assert.equal(lease.calls.release, 1);
});

test('stop requests during allocation release the lease without starting a child', async () => {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    const repoDir = await makeRepo();
    const stateDir = path.join(scratch, `state-${++sequence}`);
    const lease = fakeLease();
    const child = fakeRun();
    const before = ['SIGTERM', 'SIGINT'].map(name => process.listenerCount(name));
    const capture = captureConsole();
    try {
      await assert.rejects(runAttachedLiveSession({
        repoDir, stateDir, sessionId: `stop-${signal}`, config: config(), run: child.run,
        leaseTab: async request => {
          const result = await lease.leaseTab(request);
          process.emit(signal);
          return result;
        },
      }), new RegExp(`interrupted by ${signal}`));
    } finally { capture.restore(); }
    assert.equal(child.calls.length, 0);
    assert.equal(lease.calls.release, 1);
    assert.deepEqual([...lease.targets], [...BASELINE]);
    assert.deepEqual(['SIGTERM', 'SIGINT'].map(name => process.listenerCount(name)), before);
    assert.equal(await pathMissing(stateDir), true);
  }
});

test('manual browser callers retain their tab allocation command reference', async () => {
  const { browserOperatorContract } = await import('../ops/browser_operator_contract.js');
  const contract = browserOperatorContract({ ...config(), sessionId: 'manual-session' });
  assert.ok(contract.includes('`tab new <url>`'));
  assert.ok(contract.includes('`tab close <targetId>`'));
  assert.equal(contract.includes('Use only launcher-owned target'), false);
});

test('a preflight skip allocates no tab, spawns no child and creates no state', async () => {
  const repoDir = await makeRepo();
  const stateDir = path.join(scratch, `state-${++sequence}`);
  const lease = fakeLease();
  const child = fakeRun();
  const requests = [];
  const capture = captureConsole();
  let result;
  try {
    result = await runAttachedLiveSession({
      repoDir, stateDir, sessionId: 'preflight-skip', config: config(),
      leaseTab: lease.leaseTab, run: child.run,
      preflight: async (request) => {
        requests.push(request);
        return { action: 'skip', reason: 'rest_window' };
      },
    });
  } finally { capture.restore(); }
  assert.equal(requests.length, 1);
  assert.equal(requests[0].sessionId, 'preflight-skip');
  assert.equal(requests[0].repoDir, repoDir);
  assert.equal(requests[0].stateDir, stateDir);
  assert.equal(lease.calls.allocate.length, 0);
  assert.equal(child.calls.length, 0);
  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'rest_window');
  assert.equal(result.targetId, null);
  assert.equal(await pathMissing(stateDir), true);
  assert.ok(capture.lines.some(line => line.text.includes('Attached live session skipped')
    && line.text.includes('rest_window')));
});

test('a preflight run gate renders its precollected context into the brief', async () => {
  const repoDir = await makeRepo();
  const stateDir = path.join(scratch, `state-${++sequence}`);
  const lease = fakeLease();
  const child = fakeRun();
  const capture = captureConsole();
  try {
    await runAttachedLiveSession({
      repoDir, stateDir, sessionId: 'preflight-run', config: config(),
      leaseTab: lease.leaseTab, run: child.run,
      preflight: async () => ({
        action: 'run', mode: 'single_block', reason: 'momentum_work_available',
        precollected: { stream: 'momentum', mentionsOk: true, mentionsCount: 3, engageRefreshed: true,
          engageErrors: [], momentumRefreshed: true, momentumError: null, t1Count: 2 },
      }),
    });
  } finally { capture.restore(); }
  const prompt = await readFile(path.join(stateDir, 'arm-growth-live.prompt.md'), 'utf8');
  assert.ok(prompt.includes('Preflight mode=single_block reason=momentum_work_available'));
  assert.ok(prompt.includes('stream=momentum'));
  assert.ok(prompt.includes('engage-refresh=clean'));
  assert.ok(prompt.includes('x_momentum=clean'));
  assert.ok(prompt.includes('t1=2'));
  assert.equal(prompt.includes('{{'), false);
});

test('the real brief renders with no unfilled placeholder', async () => {
  const repoDir = path.join(scratch, `repo-${++sequence}`);
  await mkdir(path.join(repoDir, 'ops/systemd/arm'), { recursive: true });
  await writeFile(path.join(repoDir, 'ops/systemd/arm/arm-growth-live.md'),
    await readFile(path.join(root, 'ops/systemd/arm/arm-growth-live.md'), 'utf8'));
  const stateDir = path.join(scratch, `state-${++sequence}`);
  const lease = fakeLease();
  const child = fakeRun();
  const capture = captureConsole();
  try {
    await runAttachedLiveSession({
      repoDir, stateDir, sessionId: 'real-brief', config: config(),
      leaseTab: lease.leaseTab, run: child.run,
      preflight: async () => ({ action: 'run', mode: 'single_block', reason: 'for_you_block',
        precollected: { stream: 'forYou', mentionsOk: true, mentionsCount: 1,
          engageRefreshed: true, engageErrors: [] } }),
    });
  } finally { capture.restore(); }
  const prompt = await readFile(path.join(stateDir, 'arm-growth-live.prompt.md'), 'utf8');
  assert.equal(prompt.includes('{{'), false);
  assert.ok(prompt.includes('"maxDurationMinutes":12'));
  assert.equal(prompt.includes('35 minutes'), false);
});

const BLOCK_MS = 300_000;
const SCHEDULE = Object.freeze({ blockSeconds: 300, order: ['momentum', 'forYou'],
  restWatchMinutes: 60, builderRefreshMinutes: 60 });
// Block 5_666_666 is even, so it is a momentum block; the next one is For You.
const MOMENTUM_NOW = 5_666_666 * BLOCK_MS + 1_000;
const FORYOU_NOW = 5_666_667 * BLOCK_MS + 1_000;

function preflightDeps(overrides = {}) {
  const calls = { finishGrowthRun: [], releaseOperatorLease: [], refreshDiscoverySource: [] };
  const deps = {
    store: {},
    getOperatorLeaseStatus: () => ({ active: false }),
    getPublicationReconciliationReadiness: () => ({ activeCount: 0 }),
    listSocialAttempts: () => [],
    listGrowthRuns: () => [],
    finishGrowthRun: (runId, options) => {
      calls.finishGrowthRun.push({ runId, options });
      return { run: { runId, status: options.status } };
    },
    releaseOperatorLease: (leaseId) => {
      calls.releaseOperatorLease.push(leaseId);
      return { released: true };
    },
    getGrowthOperatorDelegation: () => ({ state: 'running', mode: 'live' }),
    getAccountHealthSummary: () => ({ health: { state: 'healthy' } }),
    discoveryBlock: (request) => discoveryBlock(request),
    growthScheduleConfig: () => SCHEDULE,
    getGrowthProductPolicy: () => ({ activity: {} }),
    activityWindow: () => ({ rest: false, localTime: '12:00', timeZone: 'Asia/Kolkata' }),
    getDiscoverSnapshot: () => ({ fetchedAt: null, candidates: [] }),
    refreshDiscoverySource: async (kind) => {
      calls.refreshDiscoverySource.push(kind);
      return { kind, error: null };
    },
    buildScoutCards: () => ({ pace: { urgentCandidates: 0 }, cards: [] }),
    readScoutInput: () => ({ now: 0 }),
    listEngagementItems: () => [],
    listQueueItems: () => [],
    readXMentions: async () => ({ ok: true, posts: [] }),
    refreshEngagementOpportunities: async () => ({ errors: [] }),
    ...overrides,
  };
  return { deps, calls };
}

test('preflight skips while another operator lease is active', async () => {
  const { deps } = preflightDeps({
    getOperatorLeaseStatus: () => ({ active: true, runId: 'run-active',
      sessionId: 'session-active', expiresAt: 1_700_000_000_000 }),
  });
  const result = await runLiveSessionPreflight({ now: MOMENTUM_NOW, env: {}, deps });
  assert.deepEqual(result, {
    action: 'skip',
    reason: 'operator_lease_active',
    detail: { runId: 'run-active', sessionId: 'session-active', expiresAt: 1_700_000_000_000 },
  });
});

test('preflight runs recovery for an unfinished attempt even during the rest window', async () => {
  for (const overrides of [
    { getPublicationReconciliationReadiness: () => ({ activeCount: 1 }) },
    { listSocialAttempts: () => [{ state: 'mutation_started' }] },
  ]) {
    const { deps } = preflightDeps({ ...overrides, activityWindow: () => ({ rest: true }) });
    const result = await runLiveSessionPreflight({ now: MOMENTUM_NOW, env: {}, deps });
    assert.equal(result.action, 'run');
    assert.equal(result.mode, 'recovery');
    assert.equal(result.reason, 'unfinished_attempts');
    assert.equal(result.precollected, null);
    assert.equal(result.block.stream, 'momentum');
  }
});

test('preflight closes an abandoned active run with an expired lease and zero attempts', async () => {
  const { deps, calls } = preflightDeps({
    listGrowthRuns: () => [{ runId: 'run-abandoned', sessionId: 'old-session', leaseId: 'lease-old' }],
  });
  const result = await runLiveSessionPreflight({ now: FORYOU_NOW, env: {}, deps });
  assert.deepEqual(calls.finishGrowthRun.map(call => call.runId), ['run-abandoned']);
  assert.deepEqual(calls.finishGrowthRun[0].options, {
    status: 'partial',
    stopReason: 'capability_unavailable',
    stopDetail: 'Closed abandoned active run with expired lease and zero unfinished attempts before new session.',
    now: FORYOU_NOW,
  });
  assert.deepEqual(result.healedRunIds, ['run-abandoned']);
  assert.equal(result.action, 'run');
  assert.equal(result.reason, 'for_you_block');
});

test('preflight skips the rest window before the momentum watch interval', async () => {
  const { deps, calls } = preflightDeps({
    activityWindow: () => ({ rest: true }),
    getDiscoverSnapshot: (kind) => (kind === 'x_momentum'
      ? { fetchedAt: MOMENTUM_NOW - 10 * 60_000 }
      : { fetchedAt: null }),
  });
  const result = await runLiveSessionPreflight({ now: MOMENTUM_NOW, env: {}, deps });
  assert.equal(result.action, 'skip');
  assert.equal(result.reason, 'rest_window');
  assert.equal(result.block.stream, 'momentum');
  assert.deepEqual(calls.refreshDiscoverySource, []);
});

test('preflight skips an awake momentum block with no eligible work', async () => {
  const { deps } = preflightDeps();
  const result = await runLiveSessionPreflight({ now: MOMENTUM_NOW, env: {}, deps });
  assert.equal(result.action, 'skip');
  assert.equal(result.reason, 'momentum_no_eligible_work');
  assert.equal(result.block.stream, 'momentum');
});

test('preflight runs a momentum block when saved work exists', async () => {
  const { deps, calls } = preflightDeps({
    buildScoutCards: () => ({ pace: { urgentCandidates: 0 }, cards: [{ tier: 'T1' }, { tier: 'T2' }] }),
  });
  const result = await runLiveSessionPreflight({ now: MOMENTUM_NOW, env: {}, deps });
  assert.equal(result.action, 'run');
  assert.equal(result.mode, 'single_block');
  assert.equal(result.reason, 'momentum_work_available');
  assert.equal(result.precollected.t1Count, 1);
  assert.equal(result.precollected.momentumRefreshed, true);
  assert.ok(calls.refreshDiscoverySource.includes('x_momentum'));
});

test('preflight runs an awake For You block', async () => {
  const { deps } = preflightDeps();
  const result = await runLiveSessionPreflight({ now: FORYOU_NOW, env: {}, deps });
  assert.equal(result.action, 'run');
  assert.equal(result.mode, 'single_block');
  assert.equal(result.reason, 'for_you_block');
  assert.deepEqual(result.precollected, {
    stream: 'forYou', mentionsOk: true, mentionsCount: 0, engageRefreshed: true, engageErrors: [],
  });
});

test('an exited session closes its run only when nothing is in flight', async () => {
  const { deps, calls } = preflightDeps({
    listGrowthRuns: () => [{ runId: 'run-crashed', sessionId: 'crashed-session', leaseId: 'lease-crashed' }],
  });
  const reconciled = await reconcileExitedSessionRun({ sessionId: 'crashed-session', now: MOMENTUM_NOW, deps });
  assert.deepEqual(reconciled.reconciledRunIds, ['run-crashed']);
  assert.deepEqual(reconciled.releasedLeaseIds, ['lease-crashed']);
  assert.equal(calls.finishGrowthRun[0].options.stopDetail,
    'Session exited abnormally with zero unfinished attempts.');

  const blocked = preflightDeps({
    listGrowthRuns: () => [{ runId: 'run-crashed', sessionId: 'crashed-session', leaseId: 'lease-crashed' }],
    getPublicationReconciliationReadiness: () => ({ activeCount: 1 }),
  });
  const refused = await reconcileExitedSessionRun({ sessionId: 'crashed-session', now: MOMENTUM_NOW, deps: blocked.deps });
  assert.deepEqual(refused.reconciledRunIds, []);
  assert.equal(blocked.calls.finishGrowthRun.length, 0);
});
