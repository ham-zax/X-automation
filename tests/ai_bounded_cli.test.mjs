// Fake-process coverage for the isolated Luna bounded lane (ai_bounded_cli.js
// + ops/bounded_codex_worker.mjs + ai_runtime forwarding). No live model, no
// network, no ARM: stub executables emit native-shaped JSONL, write result
// files, and maintain per-thread rollout audits under an isolated CODEX_HOME.
//
// Each scenario is baked into its own stub file as literals: the child
// environment is a minimal allowlist, so stubs take no behavioral input from
// the environment (CODEX_HOME is the only env input, and it passes through
// the production allowlist by design). Every stub uses a unique thread id so
// no test can read another test's rollout audit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { writeSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';

const cwd = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), 'growth-bounded-cli-'));
process.chdir(scratch);
const bounded = await import('../ai_bounded_cli.js');
const runtime = await import('../ai_runtime.js');
const store = await import('../store.js');

const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };
const profile = { name: 'bounded-test', runtime: 'codex', providerKind: 'runtime_managed', protocol: 'runtime_native', model: 'gpt-6-luna', reasoning: 'max' };

const fakeHome = await mkdtemp(path.join(tmpdir(), 'bounded-codex-home-'));
const binDir = path.join(scratch, 'bin');
await mkdir(binDir, { recursive: true });
const prevCodexHome = process.env.CODEX_HOME;
process.env.CODEX_HOME = fakeHome;

function total(input, cached, output, reasoning) {
  return { input_tokens: input, cached_input_tokens: cached, cache_write_input_tokens: 0, output_tokens: output, reasoning_output_tokens: reasoning, total_tokens: input + output };
}

const U1 = total(120, 30, 40, 5);
const T1 = total(100, 10, 20, 2);
const T2 = total(150, 40, 35, 4);
const WITHOUT_OPTIONAL_USAGE = { input_tokens: 90, output_tokens: 11, total_tokens: 101 };

// Builds a stub codex executable with baked-in behavior. Records used:
// token_count records (in order), the turn.completed usage, extra event
// lines, the result file text, the exit code, and an optional startup sleep.
function fakeCodexSource({ thread, records, turnUsage, extraEvents = [], resultText = '{"ok":true}', eventText = resultText, resultFileBytes = null, exitCode = 0, sleepMs = 0, garbage = false, truncatedReceipt = false }) {
  return `#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import path from 'node:path';
const argv = process.argv.slice(2);
try { appendFileSync(process.argv[1] + '.argv.log', JSON.stringify(argv) + '\\n'); } catch {}
const opt = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1] ?? null;
};
const out = (line) => writeSync(1, line + '\\n');
const THREAD = ${JSON.stringify(thread)};
const RECORDS = ${JSON.stringify(records)};
const TURN_USAGE = ${JSON.stringify(turnUsage)};
const EXTRA = ${JSON.stringify(extraEvents)};
const RESULT_TEXT = ${JSON.stringify(resultText)};
const EVENT_TEXT = ${JSON.stringify(eventText)};
const RESULT_FILE_BYTES = ${JSON.stringify(resultFileBytes)};
const EXIT_CODE = ${JSON.stringify(exitCode)};
const SLEEP_MS = ${JSON.stringify(sleepMs)};
const GARBAGE = ${JSON.stringify(garbage)};
const TRUNCATED_RECEIPT = ${JSON.stringify(truncatedReceipt)};
if (SLEEP_MS) await new Promise((resolve) => setTimeout(resolve, SLEEP_MS));
if (GARBAGE) {
  out('not json{{{');
  out('{"type":');
  process.exit(0);
}
const usageOf = (t) => ({ input_tokens: t.input_tokens, cached_input_tokens: t.cached_input_tokens, cache_write_input_tokens: 0, output_tokens: t.output_tokens, reasoning_output_tokens: t.reasoning_output_tokens });
const tokenRecord = (t) => JSON.stringify({ ordinal: 1, timestamp: '2026-10-12T00:00:00Z', type: 'token_usage_record', payload: { type: 'token_count', info: { total_token_usage: t, last_token_usage: t, model_context_window: 200000 }, rate_limits: null } });
if (RECORDS.length) {
  const dir = path.join(process.env.CODEX_HOME, 'sessions');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'rollout-20261012T000000-' + THREAD + '.jsonl'), RECORDS.map(tokenRecord).join('\\n') + '\\n');
}
out(JSON.stringify({ type: 'thread.started', thread_id: THREAD }));
out(JSON.stringify({ type: 'turn.started' }));
for (const line of EXTRA) out(line);
out(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: EVENT_TEXT } }));
if (TURN_USAGE) out(JSON.stringify({ type: 'turn.completed', usage: usageOf(TURN_USAGE) }));
if (TRUNCATED_RECEIPT) writeSync(1, '{"type":"item.completed","item":');
const resultPath = opt('--output-last-message');
if (resultPath) writeFileSync(resultPath, RESULT_FILE_BYTES == null ? RESULT_TEXT : 'x'.repeat(RESULT_FILE_BYTES));
const instructionConfig = argv.find((entry) => entry.startsWith('model_instructions_file='));
if (instructionConfig) {
  try {
    const instructionPath = JSON.parse(instructionConfig.slice('model_instructions_file='.length));
    appendFileSync(process.argv[1] + '.instructions.log', readFileSync(instructionPath, 'utf8'));
  } catch {}
}
process.exit(EXIT_CODE);
`;
}

const fakes = {};
async function makeFake(name, spec) {
  const file = path.join(binDir, `${name}.mjs`);
  await writeFile(file, fakeCodexSource(spec));
  await chmod(file, 0o755);
  fakes[name] = file;
  return file;
}

async function argvCalls(name) {
  try {
    const text = await readFile(`${fakes[name]}.argv.log`, 'utf8');
    return text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

async function instructionText(name) {
  return readFile(`${fakes[name]}.instructions.log`, 'utf8');
}

// Stub Claive: launches the real per-job wrapper with Claive-shaped incoming
// args (including --ephemeral, which the wrapper must strip) and relays stdio.
const FAKE_CLAIVE = `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const worker = process.env.CODEX_WORKER_BINARY;
const incoming = ['exec', '--json', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '--ephemeral',
  '-m', 'gpt-6-luna', '-c', 'model_reasoning_effort="max"', '-c', 'sandbox_mode="read-only"',
  '-c', 'approval_policy="never"', '--', 'bounded task prompt'];
const child = spawnSync(worker, incoming, { stdio: 'inherit', env: process.env });
process.exit(child.status ?? 2);
`;

const boundedJob = { budget: { maxOutputTokens: 1000, maxModelCalls: 1, maxToolCalls: 0, maxWallTimeMs: 8000 } };
const call = (fake, opts = {}) => bounded.runBoundedCliStructuredAI(profile, {
  prompt: 'Decide.', schema, timeoutMs: 8000, maxOutputTokens: 500,
  budget: boundedJob.budget, boundedSemanticJob: true,
  runtimeExecution: { runtime: 'codex', executable: fakes[fake] }, ...opts,
});

try {
  await makeFake('success1', { thread: 't-success1', records: [U1], turnUsage: U1 });
  await makeFake('success2', { thread: 't-success2', records: [T1, T2], turnUsage: T2 });
  await makeFake('dupe', { thread: 't-dupe', records: [U1, U1], turnUsage: U1 });
  await makeFake('no-rollout', { thread: 't-no-rollout', records: [], turnUsage: U1 });
  await makeFake('mismatch', { thread: 't-mismatch', records: [{ ...U1, output_tokens: 41, total_tokens: 161 }], turnUsage: U1 });
  await makeFake('decreasing', { thread: 't-decreasing', records: [T2, T1], turnUsage: T2 });
  await makeFake('tools', {
    thread: 't-tools', records: [U1], turnUsage: U1,
    extraEvents: [JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 'ls', exit_code: 0, status: 'completed' } })],
  });
  await makeFake('reroute', {
    thread: 't-reroute', records: [U1], turnUsage: U1,
    extraEvents: [JSON.stringify({ type: 'error', message: 'model rerouted: a -> b' })],
  });
  await makeFake('malformed', { thread: 't-malformed', records: [], turnUsage: null, garbage: true });
  await makeFake('truncated', { thread: 't-truncated', records: [U1], turnUsage: U1, truncatedReceipt: true });
  await makeFake('bad-subset', { thread: 't-bad-subset', records: [U1], turnUsage: { ...U1, cached_input_tokens: 999 } });
  await makeFake('fail-exit', { thread: 't-fail-exit', records: [U1], turnUsage: U1, exitCode: 3 });
  await makeFake('sleep', { thread: 't-sleep', records: [], turnUsage: null, sleepMs: 60000 });
  await makeFake('claive-codex', { thread: 't-claive1', records: [U1], turnUsage: U1 });
  await makeFake('rt-ok', { thread: 't-rt-ok', records: [U1], turnUsage: U1 });
  await makeFake('rt-bad', { thread: 't-rt-bad', records: [U1], turnUsage: U1, resultText: 'oops' });
  await makeFake('rt-large', { thread: 't-rt-large', records: [U1], turnUsage: U1, resultText: '{"ok":true}' + ' '.repeat(100) });
  await makeFake('rt-telemetry', { thread: 't-rt-telemetry', records: [U1], turnUsage: U1 });
  await makeFake('result-large', { thread: 't-result-large', records: [U1], turnUsage: U1, resultFileBytes: 2 * 1024 * 1024 + 1 });
  await makeFake('no-optional-usage', { thread: 't-no-optional-usage', records: [WITHOUT_OPTIONAL_USAGE], turnUsage: WITHOUT_OPTIONAL_USAGE });
  const fakeClaive = path.join(binDir, 'fake-claive.mjs');
  await writeFile(fakeClaive, FAKE_CLAIVE);
  await chmod(fakeClaive, 0o755);

  await test('prepare exposes maxOutputTokens and maxModelCalls as unsupported without claiming caps', () => {
    const prepared = bounded.prepareBoundedCliRequest(profile, { prompt: 'Decide.', schema, maxOutputTokens: 500, timeoutMs: 8000, budget: boundedJob.budget });
    assert.ok(prepared.unsupported.includes('maxOutputTokens'));
    assert.ok(prepared.unsupported.includes('maxModelCalls'));
    assert.equal(prepared.metadata.limits.advisoryMaxModelCalls, 1);
    assert.equal(prepared.metadata.limits.maxModelCalls, undefined);
    assert.match(prepared.metadata.enforcement.modelCalls, /observed/i);
    assert.equal(prepared.metadata.enforcement.perResponseCap, false);
    assert.ok(prepared.bytes > 0 && prepared.estimatedInputTokens > 0);
    const accounting = prepared.metadata.accounting;
    assert.equal(accounting.instructionBytes, Buffer.byteLength(prepared.jobMaterial.instructions));
    assert.equal(accounting.framedInputBytes, Buffer.byteLength(prepared.jobMaterial.prompt));
    assert.equal(accounting.schemaBytes, Buffer.byteLength(JSON.stringify(prepared.jobMaterial.schema)));
    assert.equal(prepared.bytes, accounting.instructionBytes + accounting.framedInputBytes + accounting.schemaBytes);
    assert.equal(accounting.materialBytes, prepared.bytes);
    assert.equal(accounting.overheadBytes, undefined);
  });

  await test('native success counts one rollout response and enforces isolation flags', async () => {
    const result = await call('success1');
    assert.equal(JSON.parse(result.text).ok, true);
    assert.equal(result.modelCalls, 1);
    assert.equal(result.toolCalls, 0);
    assert.equal(result.metadata.modelCalls, 1);
    assert.equal(result.inputTokens, 120);
    assert.equal(result.cachedInputTokens, 30);
    assert.equal(result.outputTokens, 40);
    assert.equal(result.reasoningTokens, 5);
    assert.equal(result.costUsd, null);
    assert.equal(result.nativeStructuredOutput, true);
    const calls = await argvCalls('success1');
    assert.equal(calls.length, 1);
    const argv = calls[0];
    for (const flag of ['--json', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--output-schema', '--output-last-message']) {
      assert.ok(argv.includes(flag), `missing ${flag}`);
    }
    assert.ok(!argv.includes('--ephemeral'), 'ephemeral must not erase the rollout audit');
    assert.ok(argv.includes('features.shell_tool=false'));
    assert.ok(argv.includes('mcp_servers={}'));
    assert.ok(argv.includes('approval_policy="never"'));
    assert.ok(argv.includes('sandbox_mode="read-only"'));
    assert.ok(argv.includes('gpt-6-luna'));
    assert.equal(await instructionText('success1'), bounded.BOUNDED_CODEX_MODEL_INSTRUCTIONS);
  });

  await test('two distinct rollout totals report two model calls instead of one', async () => {
    const result = await call('success2');
    assert.equal(result.modelCalls, 2);
    assert.equal(result.metadata.modelCalls, 2);
    assert.equal(result.inputTokens, 150);
    assert.equal(result.outputTokens, 35);
  });

  await test('repeated unchanged totals deduplicate to one call', async () => {
    const result = await call('dupe');
    assert.equal(result.modelCalls, 1);
  });

  await test('missing rollout fences with null model calls and preserved turn tokens', async () => {
    const error = await call('no-rollout').then(() => null, (failure) => failure);
    assert.equal(error?.code, 'unknown_usage');
    assert.equal(error.failedAttemptUsage.modelCalls, null);
    assert.equal(error.failedAttemptUsage.inputTokens, 120);
    assert.equal(error.failedAttemptUsage.toolCalls, 0);
  });

  await test('turn/rollout divergence fences everything except the tool count', async () => {
    const error = await call('mismatch').then(() => null, (failure) => failure);
    assert.equal(error?.code, 'inconsistent_receipt');
    assert.equal(error.failedAttemptUsage.modelCalls, null);
    assert.equal(error.failedAttemptUsage.inputTokens, null);
    assert.equal(error.failedAttemptUsage.toolCalls, 0);
  });

  await test('decreasing rollout totals fence as inconsistent', async () => {
    const error = await call('decreasing').then(() => null, (failure) => failure);
    assert.equal(error?.code, 'unknown_usage');
    assert.equal(error.failedAttemptUsage.modelCalls, null);
  });

  await test('tool use fences but preserves the proven receipt counts', async () => {
    const error = await call('tools').then(() => null, (failure) => failure);
    assert.equal(error?.code, 'tool_detected');
    assert.equal(error.failedAttemptUsage.toolCalls, 1);
    assert.equal(error.failedAttemptUsage.inputTokens, 120);
    assert.equal(error.failedAttemptUsage.modelCalls, 1);
  });

  await test('model reroute fences but keeps the proven receipt', async () => {
    const error = await call('reroute').then(() => null, (failure) => failure);
    assert.equal(error?.code, 'model_rerouted');
    assert.equal(error.failedAttemptUsage.modelCalls, 1);
    assert.equal(error.failedAttemptUsage.inputTokens, 120);
  });

  await test('malformed receipts fence without fabricated counts', async () => {
    const error = await call('malformed').then(() => null, (failure) => failure);
    assert.ok(error);
    assert.equal(error.failedAttemptUsage.modelCalls, null);
    assert.equal(error.failedAttemptUsage.inputTokens, null);
    assert.equal(error.failedAttemptUsage.toolCalls, null);
  });

  await test('complete receipt with inconsistent usage keeps only independently proven counts', async () => {
    const error = await call('bad-subset').then(() => null, (failure) => failure);
    assert.equal(error?.code, 'invalid_receipt');
    assert.equal(error.failedAttemptUsage.modelCalls, 1);
    assert.equal(error.failedAttemptUsage.inputTokens, null);
    assert.equal(error.failedAttemptUsage.toolCalls, 0);
  });

  await test('truncated receipt keeps proven token usage but leaves tool count unknown', async () => {
    const error = await call('truncated').then(() => null, (failure) => failure);
    assert.equal(error?.code, 'invalid_receipt');
    assert.equal(error.failedAttemptUsage.modelCalls, 1);
    assert.equal(error.failedAttemptUsage.toolCalls, null);
    assert.equal(error.failedAttemptUsage.inputTokens, 120);
    assert.equal(error.failedAttemptUsage.outputTokens, 40);
  });

  await test('absent cached and reasoning usage stays unknown', async () => {
    const result = await call('no-optional-usage');
    assert.equal(result.inputTokens, 90);
    assert.equal(result.outputTokens, 11);
    assert.equal(result.cachedInputTokens, null);
    assert.equal(result.reasoningTokens, null);
  });

  await test('oversized structured result is rejected before read and preserves receipt usage', async () => {
    const error = await call('result-large').then(() => null, (failure) => failure);
    assert.equal(error?.code, 'response_limit');
    assert.equal(error.failedAttemptUsage.modelCalls, 1);
    assert.equal(error.failedAttemptUsage.toolCalls, 0);
    assert.equal(error.failedAttemptUsage.inputTokens, 120);
  });

  await test('nonzero exit preserves a proven completed receipt', async () => {
    const error = await call('fail-exit').then(() => null, (failure) => failure);
    assert.equal(error?.code, 'runtime_error');
    assert.equal(error.failedAttemptUsage.modelCalls, 1);
    assert.equal(error.failedAttemptUsage.inputTokens, 120);
  });

  await test('timeout kills the group, cleans temp state, and stays unknown', async () => {
    const before = (await readdir(tmpdir())).filter((name) => name.startsWith('x-bounded-codex-'));
    const error = await bounded.runBoundedCliStructuredAI(profile, {
      prompt: 'Decide.', schema, timeoutMs: 500,
      budget: boundedJob.budget, boundedSemanticJob: true,
      runtimeExecution: { runtime: 'codex', executable: fakes.sleep },
    }).then(() => null, (failure) => failure);
    assert.equal(error?.code, 'timeout');
    assert.equal(error.failedAttemptUsage.modelCalls, null);
    const after = (await readdir(tmpdir())).filter((name) => name.startsWith('x-bounded-codex-'));
    assert.deepEqual(after, before);
  });

  await test('claive path runs the real wrapper: strips ephemeral, adds schema, counts the rollout', async () => {
    const result = await bounded.runBoundedCliStructuredAI(profile, {
      prompt: 'Decide.', schema, timeoutMs: 15000,
      budget: boundedJob.budget, boundedSemanticJob: true,
      runtimeExecution: { runtime: 'claive', engine: 'codex', executable: fakeClaive, codexExecutable: fakes['claive-codex'] },
    });
    assert.equal(JSON.parse(result.text).ok, true);
    assert.equal(result.modelCalls, 1);
    assert.equal(result.metadata.protocol, 'claive_codex_bounded');
    const calls = await argvCalls('claive-codex');
    assert.equal(calls.length, 1);
    assert.ok(!calls[0].includes('--ephemeral'), 'wrapper must strip ephemeral to keep the audit');
    assert.ok(calls[0].includes('--output-schema'));
    assert.ok(calls[0].includes('--output-last-message'));
    assert.equal(await instructionText('claive-codex'), bounded.BOUNDED_CODEX_MODEL_INSTRUCTIONS);
  });

  await test('ai_runtime forwards measured calls once with no repair on invalid output', async () => {
    const response = await runtime.runStructuredAI({
      role: 'editorial_scan', profile, prompt: 'Decide.', schema, timeoutMs: 10000,
      allowRepair: true, allowFallback: true, maxOutputTokens: 500,
      boundedSemanticJob: true, runtimeExecution: { runtime: 'codex', executable: fakes['rt-ok'] },
    });
    assert.equal(response.output.ok, true);
    assert.equal(response.execution.modelCalls, 1);
    assert.equal(response.execution.toolCalls, 0);
    assert.equal(response.execution.inputTokens, 120);

    const error = await runtime.runStructuredAI({
      role: 'editorial_scan', profile, prompt: 'Decide.', schema, timeoutMs: 10000,
      allowRepair: true, allowFallback: true, maxOutputTokens: 500,
      boundedSemanticJob: true, runtimeExecution: { runtime: 'codex', executable: fakes['rt-bad'] },
    }).then(() => null, (failure) => failure);
    assert.equal(error?.code, 'invalid_structured_output');
    assert.equal(error.failedAttemptUsage.modelCalls, 1);
    assert.equal(error.failedAttemptUsage.inputTokens, 120);
    assert.equal((await argvCalls('rt-bad')).length, 1);
  });

  await test('ai_runtime response limit preserves bounded counts from the completed adapter', async () => {
    const previousLimit = process.env.AI_MAX_RESPONSE_BYTES;
    process.env.AI_MAX_RESPONSE_BYTES = '64';
    try {
      const error = await runtime.runStructuredAI({
        role: 'editorial_scan', profile, prompt: 'Decide.', schema, timeoutMs: 10000,
        boundedSemanticJob: true, runtimeExecution: { runtime: 'codex', executable: fakes['rt-large'] },
      }).then(() => null, (failure) => failure);
      assert.equal(error?.code, 'response_limit');
      assert.equal(error.failedAttemptUsage.modelCalls, 1);
      assert.equal(error.failedAttemptUsage.toolCalls, 0);
      assert.equal(error.failedAttemptUsage.inputTokens, 120);
      assert.equal(error.failedAttemptUsage.outputTokens, 40);
    } finally {
      if (previousLimit == null) delete process.env.AI_MAX_RESPONSE_BYTES;
      else process.env.AI_MAX_RESPONSE_BYTES = previousLimit;
    }
  });

  await test('ai_runtime preserves measured usage when completion telemetry fails', async () => {
    const db = new DatabaseSync(store.DB_FILE);
    db.exec(`CREATE TRIGGER fail_bounded_completion BEFORE UPDATE ON ai_runs
      WHEN NEW.status = 'complete' AND instr(NEW.metadata_json, '"testCompletionFault":"bounded"') > 0
      BEGIN SELECT RAISE(ABORT, 'intentional bounded telemetry failure'); END;`);
    try {
      const error = await runtime.runStructuredAI({
        role: 'editorial_scan', profile, prompt: 'Decide.', schema, timeoutMs: 10000,
        metadata: { testCompletionFault: 'bounded' },
        boundedSemanticJob: true, runtimeExecution: { runtime: 'codex', executable: fakes['rt-telemetry'] },
      }).then(() => null, (failure) => failure);
      assert.equal(error?.code, 'telemetry_error');
      assert.equal(error.failedAttemptUsage.modelCalls, 1);
      assert.equal(error.failedAttemptUsage.toolCalls, 0);
      assert.equal(error.failedAttemptUsage.inputTokens, 120);
      assert.equal(error.failedAttemptUsage.outputTokens, 40);
      const [run] = store.listAiRuns({ invocationId: error.invocationId, limit: 1 });
      assert.equal(run.status, 'failed');
      assert.equal(run.metadata.failedAttemptUsage.modelCalls, 1);
    } finally {
      db.exec('DROP TRIGGER IF EXISTS fail_bounded_completion');
      db.close();
    }
  });

  await test('bounded profile lock rejects other models', async () => {
    await assert.rejects(bounded.runBoundedCliStructuredAI(
      { ...profile, model: 'other' },
      { prompt: 'x', schema, boundedSemanticJob: true, runtimeExecution: { runtime: 'codex', executable: fakes.success1 } },
    ), /locked to gpt-6-luna/);
  });
} finally {
  if (prevCodexHome == null) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = prevCodexHome;
  process.chdir(cwd);
  await rm(scratch, { recursive: true, force: true });
  await rm(fakeHome, { recursive: true, force: true });
}
