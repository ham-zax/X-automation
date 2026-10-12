#!/usr/bin/env node
// Narrow per-job native wrapper for the Claive -> Codex bounded lane.
//
// Claive spawns $CODEX_WORKER_BINARY with its own codex args (see
// claive/bin/claivelib/engines/codex.py build_command). Claive rejects
// --output-schema and --max-model-steps, so this wrapper adds the VERIFIED
// native schema/flags without modifying installed Claive, and tees native
// JSONL events to the per-job receipt for usage accounting.
//
// Verified (codex exec --help, codex-config-schema.json):
// --json, --ignore-user-config, --ignore-rules, --skip-git-repo-check,
// --output-schema, --output-last-message,
// -c approval_policy / sandbox_mode / sandbox_workspace_write.network_access /
// web_search / mcp_servers / features.<boolean> / tools.*.enabled /
// agents.enabled. --ephemeral is STRIPPED when present: it would erase the
// rollout audit that the bounded lane counts for model-call accounting; a
// fresh thread with no resume is what prevents history reuse, not erasure.
// Unverified keys (model_max_output_tokens, per-provider retry overrides for
// the built-in provider, token/rollout budgets as caps) are never set here.
// Credentials are never read, exported, or printed.

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';

function fail(message) {
  process.stderr.write(`bounded_codex_worker: ${message}\n`);
  process.exit(2);
}

function requiredAbsoluteEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value || !path.isAbsolute(value)) fail(`${name} must be an absolute path.`);
  return value;
}

const codexBin = requiredAbsoluteEnv('BOUNDED_CODEX_BIN');
const schemaPath = requiredAbsoluteEnv('BOUNDED_SCHEMA_PATH');
const instructionsPath = requiredAbsoluteEnv('BOUNDED_INSTRUCTIONS_PATH');
const resultPath = requiredAbsoluteEnv('BOUNDED_RESULT_PATH');
const receiptPath = requiredAbsoluteEnv('BOUNDED_RECEIPT_PATH');
const deadlineEpochMs = Number(String(process.env.BOUNDED_DEADLINE_EPOCH_MS || '').trim());
if (!Number.isFinite(deadlineEpochMs) || deadlineEpochMs <= Date.now()) {
  fail('BOUNDED_DEADLINE_EPOCH_MS must be a finite future epoch-millisecond deadline.');
}
let isolation;
try {
  isolation = JSON.parse(String(process.env.BOUNDED_ISOLATION_CONFIG_JSON || ''));
} catch {
  fail('BOUNDED_ISOLATION_CONFIG_JSON must contain the adapter isolation config.');
}
if (!isolation || typeof isolation.model !== 'string' || !isolation.model
  || !Array.isArray(isolation.config)
  || isolation.config.some((entry) => !Array.isArray(entry) || typeof entry[0] !== 'string' || entry.length !== 2)) {
  fail('BOUNDED_ISOLATION_CONFIG_JSON has an invalid adapter isolation config.');
}
if (!existsSync(codexBin)) fail(`Codex binary missing: ${codexBin}`);
if (!existsSync(schemaPath)) fail(`Schema file missing: ${schemaPath}`);
if (!existsSync(instructionsPath)) fail(`Model instructions file missing: ${instructionsPath}`);

const incoming = process.argv.slice(2);
// --ephemeral would erase the rollout audit; strip it when present. A fresh
// thread with no resume is what prevents history reuse, not erasure.
const incomingDashDash = incoming.indexOf('--');
const incomingOptions = incomingDashDash === -1 ? incoming : incoming.slice(0, incomingDashDash);
if (incomingOptions.some((entry) => entry.toLowerCase() === 'resume'
  || /^--(?:resume|session(?:[-_][a-z0-9_-]*)?)(?:=.*)?$/i.test(entry))) {
  fail('Resume and session arguments are not allowed for a bounded job.');
}
const scrubbed = incoming.filter((entry) => entry !== '--ephemeral');
const dashDash = scrubbed.indexOf('--');
let before = dashDash === -1 ? [...scrubbed] : scrubbed.slice(0, dashDash);
const after = dashDash === -1 ? [] : scrubbed.slice(dashDash); // keeps '--' + prompt

const has = (flag) => before.includes(flag);
const isolationConfig = new Map(isolation.config);
const controlledConfigKeys = new Set([...isolationConfig.keys(), 'model_instructions_file']);
const configKey = (assignment) => {
  const equals = String(assignment || '').indexOf('=');
  return equals < 0 ? null : String(assignment).slice(0, equals).trim();
};

// Discard incoming values for job-owned isolation/model controls, then append
// the adapter's authoritative values after the remaining Claive arguments.
const filteredBefore = [];
for (let index = 0; index < before.length; index += 1) {
  const entry = before[index];
  if (['-m', '--model', '--sandbox'].includes(entry)) {
    index += 1;
    continue;
  }
  if (['-m=', '--model=', '--sandbox='].some((prefix) => entry.startsWith(prefix))) continue;
  if (entry === '-c' || entry === '--config') {
    const assignment = before[index + 1];
    if (controlledConfigKeys.has(configKey(assignment))) {
      index += 1;
      continue;
    }
    filteredBefore.push(entry);
    if (assignment != null) filteredBefore.push(assignment), index += 1;
    continue;
  }
  const configPrefix = ['-c=', '--config='].find((prefix) => entry.startsWith(prefix));
  if (configPrefix && controlledConfigKeys.has(configKey(entry.slice(configPrefix.length)))) continue;
  filteredBefore.push(entry);
}
before = filteredBefore;

const extras = [];
const ensureFlag = (flag, value = null) => {
  if (value == null) {
    if (!has(flag)) extras.push(flag);
  } else if (!has(flag)) {
    extras.push(flag, value);
  }
};

ensureFlag('--json');
ensureFlag('--ignore-user-config');
ensureFlag('--ignore-rules');
ensureFlag('--skip-git-repo-check');
const ownedInstructionsKey = 'model_instructions_file';
const configuredInstructions = `model_instructions_file=${JSON.stringify(instructionsPath)}`;
extras.push('-c', configuredInstructions);
for (const [key, value] of isolationConfig) extras.push('-c', `${key}=${JSON.stringify(value)}`);
const sandboxMode = isolationConfig.get('sandbox_mode');
if (typeof sandboxMode === 'string') extras.push('--sandbox', sandboxMode);
extras.push('-m', isolation.model);

if (!has('--output-schema')) extras.push('--output-schema', schemaPath);
if (!has('-o') && !has('--output-last-message')) extras.push('--output-last-message', resultPath);

const finalArgs = [...before, ...extras, ...after];

const receiptBytesLimit = 2 * 1024 * 1024;
let receiptBytes = 0;
let receiptFull = false;
let receipt;
let child = null;
let childClosed = false;
let deadlineTimer = null;
let killTimer = null;
let requestedExitCode = null;

const stopChild = (exitCode, signal, message) => {
  if (requestedExitCode == null) {
    requestedExitCode = exitCode;
    process.exitCode = exitCode;
  }
  if (message) process.stderr.write(`bounded_codex_worker: ${message}\n`);
  if (!child || childClosed) return;
  try { child.kill(signal); } catch {}
  if (killTimer == null) {
    killTimer = setTimeout(() => {
      killTimer = null;
      if (!childClosed) {
        try { child.kill('SIGKILL'); } catch {}
      }
    }, 500);
  }
};

const armDeadline = () => {
  const remainingMs = deadlineEpochMs - Date.now();
  if (remainingMs <= 0) {
    stopChild(124, 'SIGTERM', 'per-job deadline reached.');
    return;
  }
  deadlineTimer = setTimeout(() => {
    deadlineTimer = null;
    if (Date.now() >= deadlineEpochMs) stopChild(124, 'SIGTERM', 'per-job deadline reached.');
    else armDeadline();
  }, Math.min(remainingMs, 2_147_483_647));
};

try {
  receipt = createWriteStream(receiptPath, { mode: 0o600 });
} catch (error) {
  fail(`Cannot open receipt: ${String(error?.message || error)}`);
}
receipt.on('error', (error) => {
  stopChild(2, 'SIGTERM', `receipt failed: ${String(error?.message || error)}`);
});

process.stdout.on('error', (error) => {
  stopChild(2, 'SIGTERM', `stdout failed: ${String(error?.message || error)}`);
});

if (!Number.isFinite(deadlineEpochMs) || deadlineEpochMs <= Date.now()) {
  fail('per-job deadline expired before native Codex could start.');
}
child = spawn(codexBin, finalArgs, { stdio: ['ignore', 'pipe', 'inherit'] });
const signalExitCodes = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 };
for (const signal of Object.keys(signalExitCodes)) {
  process.once(signal, () => {
    stopChild(signalExitCodes[signal], signal, `received ${signal}; stopping native Codex.`);
  });
}
process.once('exit', () => {
  clearTimeout(deadlineTimer);
  clearTimeout(killTimer);
  if (child && !childClosed) {
    try { child.kill('SIGKILL'); } catch {}
  }
});
armDeadline();

let stdoutBytes = 0;
child.stdout.on('data', (chunk) => {
  if (requestedExitCode != null) return;
  stdoutBytes += chunk.length;
  if (stdoutBytes > receiptBytesLimit) {
    stopChild(2, 'SIGTERM', 'output exceeds deployment limit.');
    return;
  }
  if (!receiptFull) {
    if (receiptBytes + chunk.length > receiptBytesLimit) {
      receiptFull = true;
      process.stderr.write('bounded_codex_worker: receipt exceeds deployment limit.\n');
    } else {
      receiptBytes += chunk.length;
      try { receipt.write(chunk); } catch (error) {
        stopChild(2, 'SIGTERM', `receipt failed: ${String(error?.message || error)}`);
        return;
      }
    }
  }
  try { process.stdout.write(chunk); } catch (error) {
    stopChild(2, 'SIGTERM', `stdout failed: ${String(error?.message || error)}`);
  }
});
child.on('error', (error) => {
  stopChild(2, 'SIGTERM', `spawn failed: ${String(error?.message || error)}`);
});
child.on('close', (code) => {
  childClosed = true;
  clearTimeout(deadlineTimer);
  clearTimeout(killTimer);
  deadlineTimer = null;
  killTimer = null;
  receipt.end(() => {
    if (requestedExitCode == null) process.exitCode = code == null ? 2 : code;
  });
});
