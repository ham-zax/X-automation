import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const RUNTIME_COMMANDS = Object.freeze({
  codex: 'codex',
  opencode: 'opencode',
  opencode2: 'opencode2',
  agy: 'agy',
});
const CODEX_CONFIG_CACHE_MS = 5 * 60_000;
const codexConfigCache = new Map();
const AGY_REQUIRED_FLAGS = Object.freeze([
  '--print',
  '--output-format',
  '--json-schema',
  '--sandbox',
  '--mode',
  '--model',
  '--effort',
  '--disable-slash-commands',
]);
const AGY_EFFORTS = new Set(['low', 'medium', 'high']);

export class AiCliError extends Error {
  constructor(code, message, { fallbackEligible = false } = {}) {
    super(message);
    this.name = 'AiCliError';
    this.code = code;
    this.fallbackEligible = fallbackEligible;
  }
}

function classifyCliFailure(stderr = '') {
  const text = String(stderr).toLowerCase();
  if (/\b(?:401|403|unauthorized|authentication|not logged in|login required)\b/.test(text)) {
    return new AiCliError('auth', 'AI runtime authentication failed.', { fallbackEligible: true });
  }
  if (/\b(?:429|rate.?limit|too many requests)\b/.test(text)) {
    return new AiCliError('rate_limit', 'AI runtime rate limit was reached.', { fallbackEligible: true });
  }
  if (/\b(?:timed? ?out|timeout)\b/.test(text)) {
    return new AiCliError('timeout', 'AI runtime request timed out.', { fallbackEligible: true });
  }
  if (/\b(?:connection|network|503|502|500|service unavailable|server error)\b/.test(text)) {
    return new AiCliError('provider_error', 'AI runtime provider connection failed.', { fallbackEligible: true });
  }
  if (/conflicts with --effort|invalid (?:reasoning )?effort|unsupported effort/.test(text)) {
    return new AiCliError('reasoning_unsupported', 'AI runtime rejected the selected reasoning effort.');
  }
  if (/\b(?:unknown model|model not found|invalid model)\b/.test(text)) {
    return new AiCliError('provider_error', 'AI runtime rejected the selected model.');
  }
  return new AiCliError('runtime_error', 'AI runtime execution failed.');
}

function runProcess(command, args, { input = null, timeoutMs = 15_000, maxOutputChars = 16_000, cwd = undefined } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
      cwd,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(reject, new AiCliError('timeout', 'AI runtime request timed out.', { fallbackEligible: true }));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
      if (stdout.length > maxOutputChars) stdout = stdout.slice(-maxOutputChars);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
      if (stderr.length > maxOutputChars) stderr = stderr.slice(-maxOutputChars);
    });
    child.once('error', (error) => {
      if (error?.code === 'ENOENT') {
        finish(reject, new AiCliError('runtime_unavailable', `AI runtime ${command} is not installed.`, { fallbackEligible: true }));
      } else {
        finish(reject, new AiCliError('runtime_unavailable', `AI runtime ${command} could not start.`, { fallbackEligible: true }));
      }
    });
    child.once('exit', (code) => {
      if (settled) return;
      if (code === 0) finish(resolve, { stdout, stderr });
      else finish(reject, classifyCliFailure(stderr || stdout));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input == null ? '' : input);
  });
}

export async function getAiCliAvailability(runtime, { timeoutMs = 5_000 } = {}) {
  const command = RUNTIME_COMMANDS[runtime];
  if (!command) return { runtime, installed: false, version: null, structuredOutput: 'unsupported', reason: 'unknown_runtime' };
  try {
    const { stdout, stderr } = await runProcess(command, ['--version'], { timeoutMs });
    const version = String(stdout || stderr).trim().split(/\r?\n/)[0] || null;
    if (runtime === 'codex') return { runtime, installed: true, version, structuredOutput: 'supported', reason: null };
    if (runtime === 'agy') {
      try {
        const help = await runProcess(command, ['--help'], { timeoutMs, maxOutputChars: 64_000 });
        const text = `${help.stdout}\n${help.stderr}`;
        const missing = AGY_REQUIRED_FLAGS.filter((flag) => !text.includes(flag));
        if (missing.length) {
          return { runtime, installed: true, version, structuredOutput: 'unsupported', reason: 'structured_contract_unavailable' };
        }
        return { runtime, installed: true, version, structuredOutput: 'supported', reason: null };
      } catch {
        return { runtime, installed: true, version, structuredOutput: 'unknown', reason: 'capability_check_failed' };
      }
    }
    return { runtime, installed: true, version, structuredOutput: 'unsupported', reason: 'adapter_not_implemented' };
  } catch (error) {
    if (error instanceof AiCliError && error.code === 'runtime_unavailable') {
      return { runtime, installed: false, version: null, structuredOutput: 'unsupported', reason: 'not_installed' };
    }
    return {
      runtime,
      installed: true,
      version: null,
      structuredOutput: runtime === 'codex' ? 'supported' : runtime === 'agy' ? 'unknown' : 'unsupported',
      reason: 'version_check_failed',
    };
  }
}

export async function listAiCliAvailability() {
  return Promise.all(Object.keys(RUNTIME_COMMANDS).map((runtime) => getAiCliAvailability(runtime)));
}

async function resolveCodexInheritedModel(profile, { timeoutMs = 10_000 } = {}) {
  if (profile.model !== 'inherit') return profile.model;
  const cacheKey = profile.runtimeProfile || '<default>';
  const cached = codexConfigCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CODEX_CONFIG_CACHE_MS) return cached.model;
  const args = [];
  if (profile.runtimeProfile) args.push('--profile', profile.runtimeProfile);
  args.push('doctor', '--json', '--summary');
  try {
    const { stdout } = await runProcess('codex', args, { timeoutMs, maxOutputChars: 512_000 });
    const report = JSON.parse(stdout);
    const model = report?.checks?.config?.load?.details?.model;
    const resolved = typeof model === 'string' && model.trim() ? model.trim() : 'inherit';
    codexConfigCache.set(cacheKey, { model: resolved, fetchedAt: Date.now() });
    return resolved;
  } catch {
    return 'inherit';
  }
}

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resolveAgyReasoning(profile) {
  const model = String(profile.model || '').trim();
  if (!model || model === 'inherit') {
    throw new AiCliError('model_required', 'AGY profiles require an explicit model from the installed runtime catalog.');
  }
  if (profile.runtimeProfile) {
    throw new AiCliError('runtime_profile_unsupported', 'The installed AGY CLI does not expose a per-run runtime profile flag.');
  }
  const requested = String(profile.reasoning || '').trim().toLowerCase();
  if (!requested) return '';
  if (!AGY_EFFORTS.has(requested)) throw new AiCliError('reasoning_unsupported', `Unsupported AGY reasoning effort: ${requested}.`);
  return requested;
}

function parseAgyJson(stdout, label) {
  let body;
  try {
    body = JSON.parse(String(stdout || '').trim());
  } catch {
    throw new AiCliError('invalid_structured_output', `AGY ${label} did not return valid JSON.`, { fallbackEligible: true });
  }
  if (body?.status !== 'SUCCESS') throw classifyCliFailure(body?.error || body?.response || 'AGY command failed.');
  return body;
}

async function runAgyStructuredAI(profile, { prompt, schema, timeoutMs }) {
  const reasoning = resolveAgyReasoning(profile);
  const dir = await mkdtemp(path.join(tmpdir(), 'x-ai-agy-'));
  const schemaPath = path.join(dir, 'output-schema.json');
  try {
    await writeFile(schemaPath, JSON.stringify(schema), 'utf8');
    const args = [
      '--output-format', 'json',
      '--json-schema', schemaPath,
      '--sandbox',
      '--mode', 'plan',
      '--model', profile.model,
      '--disable-slash-commands',
    ];
    if (profile.reasoning) args.push('--effort', reasoning);
    args.push('--print', prompt);
    const { stdout } = await runProcess('agy', args, { timeoutMs, maxOutputChars: 2_000_000, cwd: dir });
    const body = parseAgyJson(stdout, 'structured execution');
    if (body.response == null || body.response === '') {
      throw new AiCliError('invalid_structured_output', 'AGY did not produce a structured response.', { fallbackEligible: true });
    }
    return {
      text: typeof body.response === 'string' ? body.response : JSON.stringify(body.response),
      runtime: 'agy',
      provider: 'runtime_managed',
      model: profile.model,
      reasoning,
      inputTokens: finiteOrNull(body.usage?.input_tokens),
      outputTokens: finiteOrNull(body.usage?.output_tokens),
      costUsd: null,
      nativeStructuredOutput: true,
      metadata: {
        protocol: 'runtime_native',
        structuredOutput: 'runtime_schema',
        conversationId: String(body.conversation_id || '') || null,
        durationSeconds: finiteOrNull(body.duration_seconds),
        numTurns: finiteOrNull(body.num_turns),
        thinkingTokens: finiteOrNull(body.usage?.thinking_tokens),
        cacheReadTokens: finiteOrNull(body.usage?.cache_read_tokens),
      },
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function runCliStructuredAI(profile, { prompt, schema, timeoutMs = 120_000 } = {}) {
  if (profile.runtime === 'agy') {
    const availability = await getAiCliAvailability('agy', { timeoutMs: Math.min(timeoutMs, 5_000) });
    if (!availability.installed) {
      throw new AiCliError('runtime_unavailable', 'AI runtime agy is not installed.', { fallbackEligible: true });
    }
    if (availability.structuredOutput !== 'supported') {
      throw new AiCliError('runtime_unsupported', 'Installed AGY does not expose the required structured-output contract.');
    }
    return runAgyStructuredAI(profile, { prompt, schema, timeoutMs });
  }
  if (profile.runtime !== 'codex') {
    const availability = await getAiCliAvailability(profile.runtime);
    if (!availability.installed) {
      throw new AiCliError('runtime_unavailable', `AI runtime ${profile.runtime} is not installed.`, { fallbackEligible: true });
    }
    throw new AiCliError('runtime_unsupported', `AI runtime ${profile.runtime} does not have a structured adapter in this build.`);
  }
  const dir = await mkdtemp(path.join(tmpdir(), 'x-ai-codex-'));
  const schemaPath = path.join(dir, 'output-schema.json');
  const resultPath = path.join(dir, 'result.json');
  try {
    const actualModel = await resolveCodexInheritedModel(profile, { timeoutMs: Math.min(timeoutMs, 10_000) });
    await writeFile(schemaPath, JSON.stringify(schema), 'utf8');
    const args = [
      'exec',
      '--ephemeral',
      '--sandbox', 'read-only',
      '--skip-git-repo-check',
      '-C', tmpdir(),
    ];
    if (profile.model && profile.model !== 'inherit') args.push('--model', profile.model);
    if (profile.reasoning) args.push('-c', `model_reasoning_effort=${JSON.stringify(profile.reasoning)}`);
    if (profile.runtimeProfile) args.push('--profile', profile.runtimeProfile);
    args.push('--output-schema', schemaPath, '--output-last-message', resultPath, '-');
    await runProcess('codex', args, { input: prompt, timeoutMs });
    let text;
    try {
      text = await readFile(resultPath, 'utf8');
    } catch {
      throw new AiCliError('invalid_structured_output', 'Codex did not produce a structured output file.', { fallbackEligible: true });
    }
    return {
      text,
      runtime: 'codex',
      provider: 'runtime_managed',
      model: actualModel || profile.model || 'inherit',
      reasoning: profile.reasoning || '',
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      nativeStructuredOutput: true,
      metadata: { protocol: 'runtime_native', structuredOutput: 'runtime_schema' },
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function listCliAiCatalog(profile, { timeoutMs = 15_000 } = {}) {
  const availability = await getAiCliAvailability(profile.runtime);
  if (!availability.installed) {
    return {
      models: [],
      fetchedAt: Date.now(),
      manualModelEntry: profile.runtime === 'codex',
      capability: 'unsupported',
      availability,
    };
  }
  if (profile.runtime === 'agy') {
    try {
      const { stdout } = await runProcess('agy', ['--output-format', 'json', 'models'], { timeoutMs, maxOutputChars: 1_000_000 });
      const body = parseAgyJson(stdout, 'model catalog');
      const entries = body?.command?.name === 'models' && Array.isArray(body?.command?.data?.models)
        ? body.command.data.models
        : null;
      if (!entries) throw new AiCliError('catalog_unavailable', 'AGY model catalog response is missing model data.');
      const models = entries.map((model) => {
        const id = String(model?.id || '').trim();
        return {
          id,
          name: String(model?.label || id),
          provider: 'runtime_managed',
          runtime: 'agy',
          structuredOutput: availability.structuredOutput,
          defaultReasoning: null,
          reasoningLevels: [],
        };
      }).filter((model) => model.id);
      return {
        models,
        fetchedAt: Date.now(),
        manualModelEntry: false,
        capability: availability.structuredOutput,
        availability,
      };
    } catch (error) {
      const normalized = error instanceof AiCliError ? error : new AiCliError('catalog_unavailable', 'AGY model catalog is unavailable.');
      return {
        models: [],
        fetchedAt: null,
        manualModelEntry: false,
        capability: availability.structuredOutput,
        availability,
        error: { code: normalized.code },
      };
    }
  }
  if (profile.runtime !== 'codex') {
    return {
      models: [],
      fetchedAt: Date.now(),
      manualModelEntry: false,
      capability: availability.structuredOutput === 'supported' ? 'unknown' : 'unsupported',
      availability,
    };
  }
  try {
    const args = [];
    if (profile.runtimeProfile) args.push('--profile', profile.runtimeProfile);
    args.push('debug', 'models');
    const { stdout } = await runProcess('codex', args, { timeoutMs, maxOutputChars: 8_000_000 });
    const body = JSON.parse(stdout);
    const models = (Array.isArray(body?.models) ? body.models : []).map((model) => ({
      id: String(model?.slug || ''),
      name: String(model?.display_name || model?.slug || ''),
      provider: 'runtime_managed',
      runtime: 'codex',
      structuredOutput: 'supported',
      defaultReasoning: model?.default_reasoning_level || null,
      reasoningLevels: Array.isArray(model?.supported_reasoning_levels)
        ? model.supported_reasoning_levels.map((entry) => String(entry?.effort || '')).filter(Boolean)
        : [],
    })).filter((model) => model.id);
    return {
      models,
      fetchedAt: Date.now(),
      manualModelEntry: true,
      capability: 'supported',
      availability,
    };
  } catch (error) {
    const normalized = error instanceof AiCliError ? error : new AiCliError('catalog_unavailable', 'Codex model catalog is unavailable.');
    return {
      models: [],
      fetchedAt: null,
      manualModelEntry: true,
      capability: 'unknown',
      availability,
      error: { code: normalized.code },
    };
  }
}

export async function checkCliAiConnection(profile, { timeoutMs = 10_000 } = {}) {
  const startedAt = Date.now();
  const availability = await getAiCliAvailability(profile.runtime, { timeoutMs: Math.min(timeoutMs, 5_000) });
  if (!availability.installed || availability.structuredOutput !== 'supported') {
    return {
      runtimeAvailable: availability.installed,
      providerReachable: null,
      authenticated: null,
      modelFound: null,
      structuredOutputPath: availability.structuredOutput === 'supported' ? 'runtime_schema' : 'unsupported',
      latencyMs: Date.now() - startedAt,
      error: { code: availability.reason || 'runtime_unavailable' },
    };
  }
  if (profile.runtime === 'agy') {
    const catalog = await listCliAiCatalog(profile, { timeoutMs });
    let profileError = null;
    try {
      resolveAgyReasoning(profile);
    } catch (error) {
      profileError = error instanceof AiCliError
        ? error
        : new AiCliError('runtime_unsupported', 'AGY profile is incompatible with the installed runtime.');
    }
    const catalogErrorCode = catalog.error?.code || null;
    const modelFound = catalog.error || !profile.model || profile.model === 'inherit'
      ? null
      : catalog.models.some((model) => model.id === profile.model);
    const error = catalog.error
      || (profileError ? { code: profileError.code } : null)
      || (modelFound === false ? { code: 'model_not_found' } : null);
    const authError = catalogErrorCode === 'auth';
    return {
      runtimeAvailable: true,
      providerReachable: catalog.error
        ? ['provider_error', 'timeout'].includes(catalogErrorCode) ? false : catalogErrorCode === 'auth' ? true : null
        : true,
      authenticated: authError ? false : null,
      modelFound,
      structuredOutputPath: 'runtime_schema',
      latencyMs: Date.now() - startedAt,
      error,
    };
  }
  if (profile.runtime !== 'codex') {
    return {
      runtimeAvailable: true,
      providerReachable: null,
      authenticated: null,
      modelFound: null,
      structuredOutputPath: 'unsupported',
      latencyMs: Date.now() - startedAt,
      error: { code: availability.reason || 'adapter_not_implemented' },
    };
  }
  const catalog = await listCliAiCatalog(profile, { timeoutMs });
  const resolvedModel = await resolveCodexInheritedModel(profile, { timeoutMs });
  return {
    runtimeAvailable: true,
    providerReachable: null,
    authenticated: null,
    modelFound: catalog.models.length && resolvedModel !== 'inherit'
      ? catalog.models.some((model) => model.id === resolvedModel)
      : null,
    structuredOutputPath: 'runtime_schema',
    latencyMs: Date.now() - startedAt,
    error: catalog.error || null,
  };
}
