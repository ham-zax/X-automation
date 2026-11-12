import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(tmpdir(), 'growth-config-'));
const previousCwd = process.cwd();
process.chdir(scratch);
const { growthRoleConfig, loadGrowthConfig } = await import(pathToFileURL(path.join(root, 'growth_config.js')).href);
const { classifyChildResult, runtimeConfig } = await import(pathToFileURL(path.join(root, 'growth_agent_runner.js')).href);
const { parseCodexExecUsage } = await import(pathToFileURL(path.join(root, 'ai_cli.js')).href);
process.chdir(previousCwd);

after(async () => {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
});

test('YAML overrides operator environment and inherits writer for unlisted review roles', async () => {
  const file = path.join(scratch, 'growth-agent.yaml');
  await writeFile(file, `version: 1
operator:
  runtime: claive
  engine: codex
  model: gpt-6-luna
  reasoning: max
  browserTarget: linux
  cdpPort: '9222'
roles:
  writer:
    runtime: codex
    model: gpt-5.6-terra
    reasoning: medium
    settings:
      structuredOutput: supported
`);
  const env = {
    X_GROWTH_CONFIG_FILE: file,
    X_GROWTH_AGENT_RUNTIME: 'opencode',
    X_GROWTH_AGENT_MODEL: 'stale-model',
    X_GROWTH_BROWSER_TARGET: 'linux',
  };
  const config = loadGrowthConfig({ env });
  assert.equal(config.operator.model, 'gpt-6-luna');
  assert.equal(runtimeConfig(env).model, 'gpt-6-luna');
  assert.equal(runtimeConfig(env).runtime, 'claive');
  const writer = growthRoleConfig('writer', env);
  const reviewer = growthRoleConfig('content_review', env);
  assert.equal(writer.sourceRole, 'writer');
  assert.equal(writer.model, 'gpt-5.6-terra');
  assert.deepEqual(writer.settings, { structuredOutput: 'supported' });
  assert.equal(reviewer.sourceRole, 'writer');
  assert.equal(reviewer.model, 'gpt-5.6-terra');
  await writeFile(file, (await readFile(file, 'utf8')).replace('gpt-6-luna', 'gpt-5.6-luna'));
  assert.equal(runtimeConfig(env).model, 'gpt-5.6-luna');
});

test('invalid YAML fails closed and no config preserves environment selection', async () => {
  const invalid = path.join(scratch, 'invalid.yaml');
  await writeFile(invalid, 'version: 1\noperator:\n\truntime: claive\n');
  assert.throws(() => loadGrowthConfig({ env: { X_GROWTH_CONFIG_FILE: invalid } }), /tabs are not allowed/);
  const config = runtimeConfig({ X_GROWTH_AGENT_RUNTIME: 'claive', X_GROWTH_CLAIVE_ENGINE: 'codex', X_GROWTH_AGENT_MODEL: 'env-model' });
  assert.equal(config.model, 'env-model');
  assert.equal(growthRoleConfig('writer', {}), null);
});

test('the committed ARM config selects native Codex gpt-6.1-terra at low for the operator and every role', () => {
  const file = path.join(root, 'ops/systemd/arm/growth-agent.yaml');
  const env = { X_GROWTH_CONFIG_FILE: file };
  const config = loadGrowthConfig({ env });
  assert.equal(config.version, 1);
  assert.equal(config.ai.totalTimeoutMs, 240000);
  assert.equal(config.schedule.blockSeconds, 300);
  assert.equal(config.schedule.order, 'momentum,forYou');
  assert.equal(config.schedule.restWatchMinutes, 60);
  assert.equal(config.schedule.builderRefreshMinutes, 60);
  assert.deepEqual(config.runtimes.codex, { binaryPath: '/home/ubuntu/.local/bin/codex' });
  assert.equal(config.runtimes.codex.codexHome, undefined);
  const resolved = runtimeConfig(env);
  assert.equal(resolved.runtime, 'claive');
  assert.equal(resolved.claiveEngine, 'codex');
  assert.equal(resolved.model, 'gpt-6.1-terra');
  assert.equal(resolved.reasoning, 'low');
  assert.equal(resolved.windowMinutes, 12);
  for (const role of ['continuous_scan', 'editorial_scan', 'editorial_final', 'audience_review',
    'writer', 'reply_writer', 'content_review']) {
    const roleConfig = growthRoleConfig(role, env);
    assert.equal(roleConfig.sourceRole, role, role);
    assert.equal(roleConfig.runtime, 'codex', role);
    assert.equal(roleConfig.model, 'gpt-6.1-terra', role);
    assert.equal(roleConfig.reasoning, 'low', role);
  }
});

test('parseCodexExecUsage sums completed-turn usage and reports nulls when absent', () => {
  const stdout = [
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }),
    JSON.stringify({ type: 'turn.started' }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 120, cached_input_tokens: 40, output_tokens: 30, reasoning_output_tokens: 10 } }),
    'not json at all',
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 80, cached_input_tokens: 20, output_tokens: 12, reasoning_output_tokens: 4 } }),
    JSON.stringify({ type: 'turn.completed' }),
    '',
  ].join('\n');
  assert.deepEqual(parseCodexExecUsage(stdout), {
    inputTokens: 200, cachedInputTokens: 60, outputTokens: 42, reasoningTokens: 14,
  });
  const absent = { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null };
  assert.deepEqual(parseCodexExecUsage(''), absent);
  assert.deepEqual(parseCodexExecUsage(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: -1, output_tokens: 1.5 } })), absent);
});

test('a usage-limit child failure is classified as rate limited', () => {
  assert.equal(classifyChildResult({ exitCode: 1, tail: "You've hit your usage limit" }), 'rate_limited');
  assert.equal(classifyChildResult({ exitCode: 1, tail: 'You have hit your usage limit. Try again later.' }), 'rate_limited');
});
