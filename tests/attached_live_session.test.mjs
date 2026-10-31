import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const BRIEF = 'Session {{SESSION}} owns {{OWNED_TAB}}.\n{{BROWSER_CONTRACT}}\n{{REPLY_CONTRACT}}\n';
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

test('success renders the exact owned target and releases that one lease once', async () => {
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
      config: config(),
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
  assert.ok(prompt.includes('Write a reply as @ham_zax'));
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
    '--turn-timeout', '2700',
  ]);
  assert.deepEqual(command.env, {
    CODEX_WORKER_BINARY: '/fake/codex',
    CLAIVE_CODEX_YOLO: '1',
    CLAIVE_CODEX_USE_USER_CONFIG: '1',
    X_GROWTH_OPERATOR_RUNTIME: 'claive',
    X_GROWTH_OPERATOR_MODEL: 'gpt-6-luna',
    X_GROWTH_OPERATOR_REASONING: 'max',
    X_GROWTH_REPLY_WRITER_MODE: 'profile',
  });
  assert.deepEqual(options, { cwd: repoDir, timeoutMs: 2_700_000, killGraceMs: 5_000 });

  assert.equal(capture.lines[0].level, 'log');
  assert.ok(capture.lines[0].text.includes('luna-arm-test-1'));
  assert.ok(capture.lines[0].text.includes(TARGET));
  assert.ok(capture.lines.some(line => line.text.includes(JSON.stringify({ targetId: TARGET, cleaned: true, warnings: [] }))));
  assert.deepEqual(result, {
    sessionId: 'luna-arm-test-1',
    targetId: TARGET,
    cleanup: { targetId: TARGET, cleaned: true, warnings: [] },
    operator: { runtime: 'claive', engine: 'codex', model: 'gpt-6-luna', reasoning: 'max',
      replyWriterMode: 'profile', source: 'launcher_command_configuration' },
  });
});

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
