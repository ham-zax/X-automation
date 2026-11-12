// Attached live Growth session on ARM. This module is the only renderer of the
// live brief and the only owner of the session's browser target. It allocates
// exactly one tab through the existing lease, runs one bounded operator child
// under the existing runChild supervision, and always releases the lease.
import { randomUUID } from 'node:crypto';
import { REPLY_CONTRACT, replyWorkflowInstruction } from '../reply_contract.js';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeConfig, runChild, commandFor, classifyChildResult, readBackoffState, writeBackoffState, nextBackoffState, backoffGateEnabled } from '../growth_agent_runner.js';
import { browserOperatorContract } from './browser_operator_contract.js';
import { leaseAgentBrowserTab } from './agent_browser_session.js';
import { reconcileExitedSessionRun, runLiveSessionPreflight } from './live_session_preflight.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_DIR = path.resolve(MODULE_DIR, '..');
const DEFAULT_STATE_DIR = '/home/ubuntu/.local/state/x_test';
const BRIEF_PATH = 'ops/systemd/arm/arm-growth-live.md';
const PROMPT_FILE = 'arm-growth-live.prompt.md';
const SESSION_ID = /^[A-Za-z0-9_-]{1,96}$/;
// One 5-minute block plus Writer and send reserve. The systemd timer wakes the
// next block; a session never loops into a second one.
const CHILD_TIMEOUT_MS = 900_000;
const KILL_GRACE_MS = 5_000;
const ERROR_TEXT_LIMIT = 500;

const WRITER_PREPARATION = Object.freeze({
  operator: 'Reload persona-model with {"consumer":"writer"}. Before writing the first public text of the session, read docs/CONTENT_OPERATING_STANDARD.md; for an Original, Thread or Quote also docs/POST_GENERATION_PROMPT.md.',
  profile: 'Profile Writer mode is active: call persona-model with {"consumer":"orchestrator"} once at startup for Hamza identity, stances, beliefs and projects. Server-side reply-generate and writer-generate automatically load the full writer persona, docs/CONTENT_OPERATING_STANDARD.md, and docs/POST_GENERATION_PROMPT.md; do not read those Writer prompt files yourself.',
});

function preflightContext(gate) {
  if (!gate) return 'Preflight: manual/unpreflighted session; run normal block checks.';
  const pre = gate.precollected || null;
  const facts = [];
  if (pre?.stream) facts.push(`stream=${pre.stream}`);
  if (pre?.mentionsOk === true) facts.push(`mentions=${Number(pre.mentionsCount || 0)}`);
  if (pre?.engageRefreshed === true) facts.push('engage-refresh=clean');
  else if (Array.isArray(pre?.engageErrors) && pre.engageErrors.length) facts.push(`engage-refresh=errors(${pre.engageErrors.length})`);
  if (pre?.momentumRefreshed === true) facts.push('x_momentum=clean');
  else if (pre?.momentumError) facts.push('x_momentum=error');
  if (Number.isFinite(Number(pre?.t1Count))) facts.push(`t1=${Number(pre.t1Count)}`);
  const head = ['Preflight mode=' + (gate.mode || 'single_block'), gate.reason ? 'reason=' + gate.reason : '']
    .filter(Boolean).join(' ');
  return facts.length
    ? `${head}; ${facts.join(' ')}. Do not repeat those identical refresh calls in this block.`
    : `${head}.`;
}

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
  const config = options.config || runtimeConfig({ ...process.env,
    X_GROWTH_AGENT_RUNTIME: process.env.X_GROWTH_AGENT_RUNTIME || 'claive',
    X_GROWTH_CLAIVE_ENGINE: process.env.X_GROWTH_CLAIVE_ENGINE || 'codex',
    X_GROWTH_AGENT_REASONING: process.env.X_GROWTH_AGENT_REASONING || 'max',
  });
  if (config.browserTarget !== 'linux') {
    throw new Error('Attached live sessions require the linux browser target.');
  }
  if (config.browserInterface !== 'agent-browser-cli') {
    throw new Error('Attached live sessions require the agent-browser-cli interface.');
  }
  const leaseTab = options.leaseTab || leaseAgentBrowserTab;
  const run = options.run || runChild;
  const operator = { runtime: config.runtime, engine: config.runtime === 'claive' ? config.claiveEngine : null,
    model: config.model || null, reasoning: config.reasoning || (config.runtime === 'pi' ? config.thinking : null),
    replyWriterMode: config.replyWriterMode || 'profile',
    source: config.configFile ? 'yaml_configuration' : 'launcher_command_configuration',
    ...(config.configFile ? { configFile: config.configFile } : {}) };

  const backoffFile = process.env.X_GROWTH_AGENT_BACKOFF_FILE || path.join(stateDir, 'growth-runner-backoff.json');
  const backoffEnabled = backoffGateEnabled();
  const previousBackoff = readBackoffState(backoffFile);
  if (backoffEnabled && previousBackoff.notBefore > Date.now()) {
    console.log(`Attached operator backoff: ${JSON.stringify({ kind: previousBackoff.lastKind, notBefore: previousBackoff.notBefore })}`);
    return { sessionId, status: 'backoff', targetId: null, operator };
  }
  const startedAt = Date.now();
  // A caller that supplies its own repoDir is a test harness or a manual run, so
  // it keeps the old behaviour unless it passes a preflight explicitly. The CLI
  // and production callers use the default repoDir and get the real gate.
  const preflight = options.preflight !== undefined
    ? options.preflight
    : (options.repoDir ? null : runLiveSessionPreflight);
  let gate = null;
  if (preflight) {
    gate = await preflight({ repoDir, stateDir, sessionId, config });
    if (gate?.action === 'skip') {
      console.log(`Attached live session skipped: ${JSON.stringify({ sessionId, reason: gate.reason,
        ...(gate.detail ? { detail: gate.detail } : {}) })}`);
      return { sessionId, status: 'skipped', reason: gate.reason, targetId: null, operator };
    }
  }

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
      .replace('{{REPLY_CONTRACT}}', () => operator.replyWriterMode === 'operator'
        ? REPLY_CONTRACT
        : 'The saved reply_writer receives the full Reply contract server-side. Use reply-generate and preserve its selected text and provenance as described above; do not draft a replacement reply.')
      .replace('{{REPLY_WORKFLOW}}', () => replyWorkflowInstruction(operator.replyWriterMode))
      .replace('{{WRITER_PREPARATION}}', () => WRITER_PREPARATION[operator.replyWriterMode] || WRITER_PREPARATION.profile)
      .replaceAll('{{PREFLIGHT_CONTEXT}}', () => preflightContext(gate))
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
    const command = commandFor({ ...config,
      ...(options.claiveBin && config.runtime === 'claive' ? { executable: options.claiveBin } : {}),
    }, prompt, { promptFile, workspace: repoDir });
    if (config.runtime === 'claive') command.args.push('--turn-timeout', '900');
    command.env = { ...command.env, CODEX_WORKER_BINARY: config.codexExecutable,
      X_GROWTH_OPERATOR_BROWSER_TAB: lease.targetId,
      X_GROWTH_OPERATOR_RUNTIME: config.runtime,
      X_GROWTH_OPERATOR_MODEL: config.model || '',
      X_GROWTH_OPERATOR_REASONING: operator.reasoning || '',
      X_GROWTH_REPLY_WRITER_MODE: operator.replyWriterMode,
    };
    if (config.configFile) command.env.X_GROWTH_CONFIG_FILE = config.configFile;
    console.log(`Attached operator: ${JSON.stringify(operator)}`);
    const childStartedAt = Date.now();
    console.log(`Attached session deadline: ${JSON.stringify({ startedAt: childStartedAt, deadlineAt: childStartedAt + CHILD_TIMEOUT_MS, timeoutMs: CHILD_TIMEOUT_MS })}`);
    await run(command, { cwd: repoDir, timeoutMs: CHILD_TIMEOUT_MS, killGraceMs: KILL_GRACE_MS });
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
    // A crashed child leaves its run active and its lease held. Release both now
    // so the next block is not blocked by a session that is already gone.
    if (failure && preflight) {
      try {
        await (options.reconcileSession || reconcileExitedSessionRun)({ sessionId, now: Date.now() });
      } catch (error) {
        console.error(`Attached session reconciliation failed: ${boundedText(error)}`);
      }
    }
  }

  if (stopSignal && !failure) failure = new Error(`Attached live session interrupted by ${stopSignal}.`);
  if (cleanup) console.log(`Owned browser target cleanup: ${JSON.stringify(cleanup)}`);
  else if (cleanupError) console.error(`Owned browser target cleanup failed: ${boundedText(cleanupError)}`);
  const failureKind = failure ? classifyChildResult({ exitCode: failure.exitCode, deadlineExpired: failure.deadlineExpired, tail: failure.outputTail || '' }) : 'ok';
  console.log(`Attached session outcome: ${JSON.stringify({ kind: failureKind, elapsedMs: Date.now() - startedAt, exitCode: failure?.exitCode ?? null })}`);
  if (backoffEnabled && ['ok', 'rate_limited', 'provider_error'].includes(failureKind)) {
    try { writeBackoffState(backoffFile, nextBackoffState(previousBackoff, failureKind, Date.now())); }
    catch { console.error('Attached failure backoff could not be saved.'); }
  }
  if (failure) {
    for (const warning of Array.isArray(cleanup?.warnings) ? cleanup.warnings : []) {
      console.error(`Owned browser target cleanup warning: ${String(warning).slice(0, ERROR_TEXT_LIMIT)}`);
    }
    throw failure;
  }
  const incomplete = cleanupFailure(cleanup, cleanupError, lease.targetId);
  if (incomplete) throw incomplete;
  return { sessionId, targetId: lease.targetId, cleanup, operator };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runAttachedLiveSession()
    .then(result => {
      if (result.status === 'backoff') console.log(`Attached live session deferred: ${result.sessionId}`);
      else if (result.status === 'skipped') console.log(`Attached live session skipped: ${result.sessionId}, reason ${result.reason}`);
      else console.log(`Attached live session finished: ${result.sessionId}, browser target ${result.targetId}`);
    })
    .catch(error => {
      console.error(`Attached live session failed: ${boundedText(error)}`);
      process.exitCode = 1;
    });
}
