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
const { runtimeConfig } = await import(pathToFileURL(path.join(root, 'growth_agent_runner.js')).href);
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
