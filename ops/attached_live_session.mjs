// Attached live Growth session on ARM. This module is the only renderer of the
// live brief and the only owner of the session's browser target. It allocates
// exactly one tab through the existing lease, runs one bounded Claive child
// under the existing runChild supervision, and always releases the lease.
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeConfig, runChild } from '../growth_agent_runner.js';
import { browserOperatorContract } from './browser_operator_contract.js';
import { leaseAgentBrowserTab } from './agent_browser_session.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_DIR = path.resolve(MODULE_DIR, '..');
const DEFAULT_STATE_DIR = '/home/ubuntu/.local/state/x_test';
const DEFAULT_CLAIVE_BIN = '/home/ubuntu/repo/claive/bin/claive';
const BRIEF_PATH = 'ops/systemd/arm/arm-growth-live.md';
const PROMPT_FILE = 'arm-growth-live.prompt.md';
const SESSION_ID = /^[A-Za-z0-9_-]{1,96}$/;
const CHILD_TIMEOUT_MS = 2_700_000;
const KILL_GRACE_MS = 5_000;
const ERROR_TEXT_LIMIT = 500;

function boundedText(value) {
  return String(value?.message || value).slice(0, ERROR_TEXT_LIMIT);
}

function cleanupFailure(cleanup, cleanupError, targetId) {
  if (cleanupError) return cleanupError;
  if (cleanup && cleanup.cleaned === true) return null;
  const warnings = Array.isArray(cleanup?.warnings) ? cleanup.warnings : [];
  const detail = warnings.length ? `: ${warnings.join('; ')}` : '';
  return new Error(`Owned browser target ${targetId} cleanup was incomplete${detail}`);
}

export async function runAttachedLiveSession(options = {}) {
  const repoDir = path.resolve(options.repoDir || DEFAULT_REPO_DIR);
  const stateDir = options.stateDir || DEFAULT_STATE_DIR;
  const sessionId = String(options.sessionId || process.env.SESSION || `luna-arm-${randomUUID()}`);
  if (!SESSION_ID.test(sessionId)) {
    throw new Error('Attached live session ID must match [A-Za-z0-9_-] with length 1 through 96.');
  }
  const config = options.config || runtimeConfig();
  if (config.browserTarget !== 'linux') {
    throw new Error('Attached live sessions require the linux browser target.');
  }
  if (config.browserInterface !== 'agent-browser-cli') {
    throw new Error('Attached live sessions require the agent-browser-cli interface.');
  }
  const leaseTab = options.leaseTab || leaseAgentBrowserTab;
  const run = options.run || runChild;
  const claiveBin = options.claiveBin || DEFAULT_CLAIVE_BIN;

  let lease;
  let failure = null;
  let cleanup = null;
  let cleanupError = null;
  // runChild handles an active child's signals. Capture setup/cleanup signals
  // too, so a stop before spawn still releases the exact lease it acquires.
  let stopSignal = null;
  const onTerm = () => { stopSignal ||= 'SIGTERM'; };
  const onInt = () => { stopSignal ||= 'SIGINT'; };
  process.on('SIGTERM', onTerm);
  process.on('SIGINT', onInt);
  try {
    lease = await leaseTab({ cli: config.agentBrowserCli, cdpPort: config.cdpPort, sessionId });
    console.log(`Attached live session ${sessionId} owns browser target ${lease.targetId}`);
    if (stopSignal) throw new Error(`Attached live session interrupted by ${stopSignal}.`);
    const template = await readFile(path.join(repoDir, BRIEF_PATH), 'utf8');
    const contract = browserOperatorContract({ ...config, sessionId, ownedTargetId: lease.targetId });
    if (!contract) throw new Error('No browser contract for this target.');
    const prompt = template
      .replace('{{BROWSER_CONTRACT}}', () => contract)
      .replaceAll('{{SESSION}}', () => sessionId)
      .replaceAll('{{OWNED_TAB}}', () => lease.targetId);
    if (prompt.includes('{{')) throw new Error('Unfilled placeholder in the brief.');
    await mkdir(stateDir, { recursive: true, mode: 0o700 });
    const promptFile = path.join(stateDir, PROMPT_FILE);
    // Narrow an old file before writing new session data. A new file gets 0600
    // from writeFile, so only absence may continue past this chmod.
    await chmod(promptFile, 0o600).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    await writeFile(promptFile, prompt, { mode: 0o600 });
    if (stopSignal) throw new Error(`Attached live session interrupted by ${stopSignal}.`);
    await run({
      executable: claiveBin,
      args: [
        'run',
        '--workspace', repoDir,
        '--prompt-file', promptFile,
        '--engine', 'codex',
        '--model', 'gpt-6-luna',
        '--reasoning-effort', 'max',
        '--web',
        '--turn-timeout', '2700',
        '--label', 'XGrowth live ARM',
      ],
      env: {
        CODEX_WORKER_BINARY: config.codexExecutable,
        CLAIVE_CODEX_YOLO: '1',
        CLAIVE_CODEX_USE_USER_CONFIG: '1',
      },
    }, { cwd: repoDir, timeoutMs: CHILD_TIMEOUT_MS, killGraceMs: KILL_GRACE_MS });
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (lease) cleanup = await lease.release();
    } catch (error) {
      cleanupError = error;
    } finally {
      process.removeListener('SIGTERM', onTerm);
      process.removeListener('SIGINT', onInt);
    }
  }

  if (stopSignal && !failure) failure = new Error(`Attached live session interrupted by ${stopSignal}.`);
  if (cleanup) console.log(`Owned browser target cleanup: ${JSON.stringify(cleanup)}`);
  else if (cleanupError) console.error(`Owned browser target cleanup failed: ${boundedText(cleanupError)}`);
  if (failure) {
    for (const warning of Array.isArray(cleanup?.warnings) ? cleanup.warnings : []) {
      console.error(`Owned browser target cleanup warning: ${String(warning).slice(0, ERROR_TEXT_LIMIT)}`);
    }
    throw failure;
  }
  const incomplete = cleanupFailure(cleanup, cleanupError, lease.targetId);
  if (incomplete) throw incomplete;
  return { sessionId, targetId: lease.targetId, cleanup };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runAttachedLiveSession()
    .then(result => console.log(`Attached live session finished: ${result.sessionId}, browser target ${result.targetId}`))
    .catch(error => {
      console.error(`Attached live session failed: ${boundedText(error)}`);
      process.exitCode = 1;
    });
}
