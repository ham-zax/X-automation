import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const originalCwd = process.cwd();
let dir, policy, secrets, cli, runtime, store, server, base;
let received = [];
let advanceDeadline;
before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-security-'));
  process.chdir(dir);
  process.env.AI_SECRETS_FILE = path.join(dir, 'secrets.json');
  const load = name => import(pathToFileURL(path.join(repo, name)).href);
  policy = await load('ai_policy.js'); secrets = await load('ai_secrets.js');
  cli = await load('ai_cli.js'); runtime = await load('ai_runtime.js'); store = await load('store.js');
  server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      received.push({ url: request.url, auth: request.headers.authorization, body: Buffer.concat(chunks).toString() });
      if (request.url.includes('redirect')) { response.writeHead(302, { location: '/v1/target' }); response.end(); }
      else if (request.url.includes('large')) { response.end('x'.repeat(4096)); }
      else if (request.url.includes('slow')) { response.writeHead(200); response.write('{'); }
      else if (request.url.includes('repair')) {
        advanceDeadline?.();
        response.end(JSON.stringify({ choices: [{ message: { content: 'invalid json' } }] }));
      }
      else response.end(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/v1`;
});
after(async () => {
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  process.chdir(originalCwd); await fs.rm(dir, { recursive: true, force: true });
});

function resetBudget() { store.setAppState('ai_deployment_budget', '{"day":"","requests":0,"tokens":0,"active":{}}'); }
function child(code) {
  return new Promise((resolve, reject) => {
    const processChild = spawn(process.execPath, ['--input-type=module', '-e', code], { cwd: dir, env: process.env, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = ''; processChild.stderr.on('data', chunk => { stderr += chunk; });
    processChild.on('error', reject); processChild.on('close', code => code === 0 ? resolve() : reject(new Error(stderr)));
  });
}

test('credentials are deployment-selected, including old arbitrary env references', async () => {
  process.env.AUTH_TOKEN = 'must-not-leak'; process.env.OPENAI_API_KEY = 'allowed-key';
  await assert.rejects(secrets.resolveAiSecret('env:AUTH_TOKEN'), /deployment-authorized/);
  await assert.rejects(secrets.getAiSecretStatus('env:AUTH_TOKEN'), /deployment-authorized/);
  assert.equal(await secrets.resolveAiSecret('env:OPENAI_API_KEY'), 'allowed-key');
  process.env.AI_ALLOWED_ENV_CREDENTIALS = 'CUSTOM_AI_KEY'; process.env.CUSTOM_AI_KEY = 'custom';
  assert.equal(await secrets.resolveAiSecret('env:CUSTOM_AI_KEY'), 'custom');
  delete process.env.AI_ALLOWED_ENV_CREDENTIALS;
});

test('provider endpoint policy rejects arbitrary origins and local DNS even when public-allowlisted', async () => {
  assert.throws(() => policy.assertAiDestination('https://attacker.example/v1/chat/completions'), /deployment-authorized/);
  assert.throws(() => policy.assertAiDestination('https://api.openai.com/v10/chat/completions'), /deployment-authorized/);
  assert.throws(() => policy.assertAiDestination(`${base}/chat/completions`), /deployment-authorized/);
  assert.throws(() => policy.assertAiDestination('https://user:password@api.openai.com/v1/models'), /Invalid/);
  process.env.AI_ALLOWED_PROVIDER_URLS = 'https://127.0.0.1/v1';
  await assert.rejects(policy.boundedAiRequest('https://127.0.0.1/v1/models'), /non-public/);
  delete process.env.AI_ALLOWED_PROVIDER_URLS;
  assert.equal(received.length, 0);
});

test('explicit local providers reject redirects, bound bodies, and bound incomplete bodies', async () => {
  process.env.AI_ALLOWED_LOCAL_PROVIDER_URLS = base;
  await assert.rejects(policy.boundedAiRequest(`${base}/redirect`, { headers: { authorization: 'Bearer allowed' } }), /redirects/);
  assert.equal(received.at(-1).url, '/v1/redirect');
  assert.equal(received.some(x => x.url === '/v1/target'), false);
  process.env.AI_MAX_RESPONSE_BYTES = '1024';
  await assert.rejects(policy.boundedAiRequest(`${base}/large`), /transport limits/);
  delete process.env.AI_MAX_RESPONSE_BYTES;
  const started = Date.now();
  await assert.rejects(policy.boundedAiRequest(`${base}/slow`, {}, 50), /deadline/);
  assert.ok(Date.now() - started < 1000);
});

test('daily and concurrency reservations are shared across processes and fail closed on invalid configuration', async () => {
  resetBudget(); process.env.AI_MAX_CONCURRENCY = '1';
  const release = policy.reserveAiRequest('task', 1000);
  assert.throws(() => policy.reserveAiRequest('task', 1000), /budget exhausted/);
  const moduleUrl = pathToFileURL(path.join(repo, 'ai_policy.js')).href;
  await child(`import { reserveAiRequest } from ${JSON.stringify(moduleUrl)}; try { reserveAiRequest('task', 1000); process.exit(1); } catch (error) { if (!error.message.includes('budget exhausted')) throw error; }`);
  release(); delete process.env.AI_MAX_CONCURRENCY;
  process.env.AI_DAILY_REQUEST_BUDGET = '1';
  assert.throws(() => policy.reserveAiRequest('task', 1000), /budget exhausted/);
  delete process.env.AI_DAILY_REQUEST_BUDGET;
  resetBudget(); process.env.AI_DAILY_TOKEN_BUDGET = '100';
  assert.throws(() => policy.reserveAiRequest('task', 1000), /budget exhausted/);
  delete process.env.AI_DAILY_TOKEN_BUDGET;
  process.env.AI_MAX_CONCURRENCY = 'NaN';
  assert.throws(() => policy.reserveAiRequest('task', 1000), /Invalid deployment/);
  delete process.env.AI_MAX_CONCURRENCY; resetBudget();
});

test('concurrent secret updates preserve every key across processes', async () => {
  const moduleUrl = pathToFileURL(path.join(repo, 'ai_secrets.js')).href;
  await Promise.all(Array.from({ length: 6 }, (_, index) => child(`import { setAiSecret } from ${JSON.stringify(moduleUrl)}; await setAiSecret('file:key-${index}', 'value-${index}');`)));
  for (let index = 0; index < 6; index++) assert.equal(await secrets.resolveAiSecret(`file:key-${index}`), `value-${index}`);
  assert.equal((await fs.stat(process.env.AI_SECRETS_FILE)).mode & 0o777, 0o600);
});

test('an expired invocation cannot restart its deadline for repair and provider receives bounded output', async () => {
  resetBudget(); process.env.AI_ALLOWED_LOCAL_PROVIDER_URLS = base;
  const profile = store.createAiProfile({ name: 'deadline-test', runtime: 'direct_api', providerKind: 'openai_compatible', protocol: 'chat_completions', baseUrl: `${base}/repair`, model: 'test', settings: { structuredOutput: 'compatible_fallback' } });
  // Advance the invocation clock when the first response arrives instead of
  // relying on sub-200ms wall-clock scheduling under concurrent test load.
  const realNow = Date.now;
  let clock = realNow();
  const before = received.length;
  Date.now = () => clock;
  advanceDeadline = () => { clock += 5001; };
  try {
    await assert.rejects(runtime.runStructuredAI({ role: 'writer', profile: profile.id, prompt: 'Return an object.', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false }, timeoutMs: 5000 }), error => error.code === 'timeout');
    assert.equal(received.length - before, 1, 'an expired invocation must not dispatch repair');
  } finally {
    Date.now = realNow;
    advanceDeadline = undefined;
  }
  const request = JSON.parse(received[before].body);
  assert.equal(request.max_completion_tokens, 4096);
  assert.match(request.messages[0].content, /untrusted data/);
});

test('timed out CLI process groups are killed even when they ignore SIGTERM', async () => {
  const pidFile = path.join(dir, 'child.pid');
  const source = `const fs = require('fs'); fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`;
  const started = Date.now();
  await assert.rejects(cli.runProcess(process.execPath, ['-e', source], { timeoutMs: 150 }), error => error.code === 'timeout');
  const pid = Number(await fs.readFile(pidFile, 'utf8'));
  assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
  assert.ok(Date.now() - started < 2500);
});


test('CLI children receive only runtime credentials and explicit deployment environment grants', async () => {
  process.env.AUTH_TOKEN = 'secret-x'; process.env.WEB_AUTH_PASSWORD = 'secret-dashboard';
  const result = await cli.runProcess(process.execPath, ['-e', 'process.stdout.write(JSON.stringify({ x: process.env.AUTH_TOKEN, dashboard: process.env.WEB_AUTH_PASSWORD, provider: process.env.OPENAI_API_KEY }))']);
  assert.deepEqual(JSON.parse(result.stdout), { provider: 'allowed-key' });
  process.env.CUSTOM_RUNTIME_OPTION = 'allowed'; process.env.AI_ALLOWED_CLI_ENV = 'CUSTOM_RUNTIME_OPTION';
  const custom = await cli.runProcess(process.execPath, ['-e', 'process.stdout.write(process.env.CUSTOM_RUNTIME_OPTION || "missing")']);
  assert.equal(custom.stdout, 'allowed'); delete process.env.AI_ALLOWED_CLI_ENV;
});

test('CLI oversized output is rejected rather than silently truncated', async () => {
  await assert.rejects(cli.runProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(2048))'], { maxOutputChars: 100 }), error => error.code === 'response_limit');
});


test('production runtime-managed execution is denied before subprocess launch without explicit opt-in', async () => {
  const old = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  delete process.env.AI_ALLOW_RUNTIME_MANAGED;
  try {
    await assert.rejects(cli.runCliStructuredAI({ runtime: 'codex', model: 'inherit' }, { prompt: 'task', schema: { type: 'object' } }), error => error.code === 'runtime_policy');
  } finally { if (old == null) delete process.env.NODE_ENV; else process.env.NODE_ENV = old; }
});
