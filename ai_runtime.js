import { aiLimit } from './ai_policy.js';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  createAiRunAttempt,
  finishAiRunAttempt,
  getAiProfile,
  resolveAiProfileForRole,
} from './store.js';
import { resolveAiSecret } from './ai_secrets.js';
import {
  AiDirectError,
  checkDirectAiConnection,
  listDirectAiCatalog,
  runDirectStructuredAI,
} from './ai_direct.js';
import {
  AiCliError,
  checkCliAiConnection,
  listAiCliAvailability,
  listCliAiCatalog,
  runCliStructuredAI,
} from './ai_cli.js';
import { BoundedCliError, runBoundedCliStructuredAI } from './ai_bounded_cli.js';

const SUPPORTED_SCHEMA_KEYWORDS = new Set([
  '$schema', '$id', '$ref', '$defs', 'definitions',
  'title', 'description', 'default', 'examples', 'deprecated', 'readOnly', 'writeOnly',
  'type', 'enum', 'const',
  'properties', 'required', 'additionalProperties', 'minProperties', 'maxProperties',
  'items', 'minItems', 'maxItems', 'uniqueItems',
  'minLength', 'maxLength', 'pattern',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'allOf', 'anyOf', 'oneOf', 'not',
]);

export class AiRuntimeError extends Error {
  constructor(code, message, { fallbackEligible = false, invocationId = null, attempts = null } = {}) {
    super(message);
    this.name = 'AiRuntimeError';
    this.code = code;
    this.fallbackEligible = fallbackEligible;
    this.invocationId = invocationId;
    this.attempts = attempts;
  }
}

function assertSchemaSupported(schema, path = '$', seen = new Set()) {
  if (typeof schema === 'boolean') return;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new AiRuntimeError('schema_unsupported', `JSON Schema at ${path} must be an object or boolean.`);
  }
  if (seen.has(schema)) throw new AiRuntimeError('schema_unsupported', `Recursive in-memory JSON Schema at ${path} is not supported.`);
  seen.add(schema);
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_SCHEMA_KEYWORDS.has(key)) {
      throw new AiRuntimeError('schema_unsupported', `Unsupported JSON Schema keyword at ${path}: ${key}`);
    }
  }
  const childMaps = [schema.properties, schema.$defs, schema.definitions];
  for (const childMap of childMaps) {
    if (childMap == null) continue;
    if (!childMap || typeof childMap !== 'object' || Array.isArray(childMap)) {
      throw new AiRuntimeError('schema_unsupported', `Invalid schema map at ${path}.`);
    }
    for (const [key, child] of Object.entries(childMap)) assertSchemaSupported(child, `${path}.${key}`, seen);
  }
  if (schema.items != null) assertSchemaSupported(schema.items, `${path}.items`, seen);
  if (schema.additionalProperties != null && typeof schema.additionalProperties !== 'boolean') {
    assertSchemaSupported(schema.additionalProperties, `${path}.additionalProperties`, seen);
  }
  for (const key of ['allOf', 'anyOf', 'oneOf']) {
    if (schema[key] == null) continue;
    if (!Array.isArray(schema[key])) throw new AiRuntimeError('schema_unsupported', `${key} at ${path} must be an array.`);
    schema[key].forEach((child, index) => assertSchemaSupported(child, `${path}.${key}[${index}]`, seen));
  }
  if (schema.not != null) assertSchemaSupported(schema.not, `${path}.not`, seen);
  seen.delete(schema);
}

function resolveLocalRef(rootSchema, ref) {
  if (ref === '#') return rootSchema;
  if (typeof ref !== 'string' || !ref.startsWith('#/')) {
    throw new AiRuntimeError('schema_unsupported', `Only local JSON Schema references are supported: ${String(ref)}`);
  }
  let current = rootSchema;
  for (const rawPart of ref.slice(2).split('/')) {
    const part = rawPart.replace(/~1/g, '/').replace(/~0/g, '~');
    current = current?.[part];
    if (current == null) throw new AiRuntimeError('schema_unsupported', `Unresolved JSON Schema reference: ${ref}`);
  }
  return current;
}

function valueTypeMatches(value, expected) {
  if (expected === 'null') return value === null;
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (expected === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === expected;
}

function schemaErrors(value, schema, rootSchema, path = '$', depth = 0) {
  if (depth > 64) throw new AiRuntimeError('schema_unsupported', 'JSON Schema reference depth exceeded 64 levels.');
  if (schema === true) return [];
  if (schema === false) return [{ path, message: 'Value is rejected by a false schema.' }];
  const errors = [];
  if (schema.$ref) errors.push(...schemaErrors(value, resolveLocalRef(rootSchema, schema.$ref), rootSchema, path, depth + 1));

  if (schema.allOf) {
    schema.allOf.forEach((child) => errors.push(...schemaErrors(value, child, rootSchema, path, depth + 1)));
  }
  if (schema.anyOf) {
    const matches = schema.anyOf.some((child) => schemaErrors(value, child, rootSchema, path, depth + 1).length === 0);
    if (!matches) errors.push({ path, message: 'Value does not match any allowed schema.' });
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((child) => schemaErrors(value, child, rootSchema, path, depth + 1).length === 0).length;
    if (matches !== 1) errors.push({ path, message: 'Value must match exactly one allowed schema.' });
  }
  if (schema.not && schemaErrors(value, schema.not, rootSchema, path, depth + 1).length === 0) {
    errors.push({ path, message: 'Value matches a forbidden schema.' });
  }

  if (schema.type != null) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.every((type) => typeof type === 'string')) throw new AiRuntimeError('schema_unsupported', `Invalid type declaration at ${path}.`);
    if (!types.some((type) => valueTypeMatches(value, type))) {
      errors.push({ path, message: `Expected type ${types.join('|')}.` });
      return errors;
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => isDeepStrictEqual(entry, value))) {
    errors.push({ path, message: 'Value is not in the allowed enum.' });
  }
  if (Object.hasOwn(schema, 'const') && !isDeepStrictEqual(schema.const, value)) {
    errors.push({ path, message: 'Value does not match const.' });
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (schema.minProperties != null && keys.length < Number(schema.minProperties)) errors.push({ path, message: 'Object has too few properties.' });
    if (schema.maxProperties != null && keys.length > Number(schema.maxProperties)) errors.push({ path, message: 'Object has too many properties.' });
    if (schema.required != null) {
      if (!Array.isArray(schema.required)) throw new AiRuntimeError('schema_unsupported', `required at ${path} must be an array.`);
      for (const key of schema.required) {
        if (!Object.hasOwn(value, key)) errors.push({ path: `${path}.${key}`, message: 'Required property is missing.' });
      }
    }
    const properties = schema.properties || {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) errors.push(...schemaErrors(value[key], childSchema, rootSchema, `${path}.${key}`, depth + 1));
    }
    const extras = keys.filter((key) => !Object.hasOwn(properties, key));
    if (schema.additionalProperties === false) {
      extras.forEach((key) => errors.push({ path: `${path}.${key}`, message: 'Additional property is not allowed.' }));
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      extras.forEach((key) => errors.push(...schemaErrors(value[key], schema.additionalProperties, rootSchema, `${path}.${key}`, depth + 1)));
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < Number(schema.minItems)) errors.push({ path, message: 'Array has too few items.' });
    if (schema.maxItems != null && value.length > Number(schema.maxItems)) errors.push({ path, message: 'Array has too many items.' });
    if (schema.uniqueItems === true) {
      for (let i = 0; i < value.length; i += 1) {
        if (value.slice(0, i).some((entry) => isDeepStrictEqual(entry, value[i]))) {
          errors.push({ path: `${path}[${i}]`, message: 'Array item must be unique.' });
          break;
        }
      }
    }
    if (schema.items != null) {
      value.forEach((entry, index) => errors.push(...schemaErrors(entry, schema.items, rootSchema, `${path}[${index}]`, depth + 1)));
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < Number(schema.minLength)) errors.push({ path, message: 'String is too short.' });
    if (schema.maxLength != null && value.length > Number(schema.maxLength)) errors.push({ path, message: 'String is too long.' });
    if (schema.pattern != null) {
      let pattern;
      try {
        pattern = new RegExp(String(schema.pattern), 'u');
      } catch {
        throw new AiRuntimeError('schema_unsupported', `Invalid JSON Schema pattern at ${path}.`);
      }
      if (!pattern.test(value)) errors.push({ path, message: 'String does not match the required pattern.' });
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (schema.minimum != null && value < Number(schema.minimum)) errors.push({ path, message: 'Number is below minimum.' });
    if (schema.maximum != null && value > Number(schema.maximum)) errors.push({ path, message: 'Number is above maximum.' });
    if (schema.exclusiveMinimum != null && value <= Number(schema.exclusiveMinimum)) errors.push({ path, message: 'Number is not above exclusiveMinimum.' });
    if (schema.exclusiveMaximum != null && value >= Number(schema.exclusiveMaximum)) errors.push({ path, message: 'Number is not below exclusiveMaximum.' });
    if (schema.multipleOf != null) {
      const multiple = Number(schema.multipleOf);
      if (!(multiple > 0)) throw new AiRuntimeError('schema_unsupported', `multipleOf at ${path} must be positive.`);
      const quotient = value / multiple;
      if (Math.abs(quotient - Math.round(quotient)) > 1e-9) errors.push({ path, message: 'Number is not a required multiple.' });
    }
  }
  return errors;
}

export function validateStructuredOutput(value, schema) {
  assertSchemaSupported(schema);
  const errors = schemaErrors(value, schema, schema);
  return { valid: errors.length === 0, errors };
}

function parseStructuredText(text) {
  try {
    return { value: JSON.parse(String(text || '').trim()), parseError: null };
  } catch {
    return { value: null, parseError: { path: '$', message: 'Output is not valid JSON.' } };
  }
}

function invalidOutputError() {
  return new AiRuntimeError('invalid_structured_output', 'AI runtime did not produce schema-valid structured output.', { fallbackEligible: true });
}

function normalizeExecutionError(error) {
  if (error instanceof AiRuntimeError) return error;
  if (error instanceof AiDirectError || error instanceof AiCliError || error instanceof BoundedCliError) {
    const normalized = new AiRuntimeError(error.code || 'execution_error', error.message || 'AI execution failed.', {
      fallbackEligible: error.fallbackEligible === true,
    });
    // Thread through known provider usage from a failed adapter call so the
    // caller can reconcile it instead of settling the attempt as unknown.
    if (error.failedAttemptUsage != null) normalized.failedAttemptUsage = error.failedAttemptUsage;
    return normalized;
  }
  return new AiRuntimeError('execution_error', 'AI execution failed.');
}

function usageSum(first, second) {
  // An unknown request cannot contribute a fabricated zero to a total.
  if (first == null || second == null) return null;
  return Number(first) + Number(second);
}

function repairPrompt(originalPrompt, schema, invalidText, validationErrors) {
  return [
    'Repair the previous response into one JSON value that matches the supplied JSON Schema.',
    'Do not add facts, claims, sources, or decisions that were not present in the task or previous response.',
    'Return JSON only. Do not use markdown fences or prose.',
    '',
    'JSON SCHEMA:',
    JSON.stringify(schema),
    '',
    'VALIDATION ERRORS:',
    JSON.stringify(validationErrors.slice(0, 20)),
    '',
    'PREVIOUS INVALID RESPONSE:',
    String(invalidText || ''),
    '',
    'ORIGINAL TASK:',
    originalPrompt,
  ].join('\n');
}

async function executeAdapter(profile, prompt, schema, deadline, adapterOpts = {}) {
  const timeoutMs = deadline - Date.now();
  if (timeoutMs <= 0) throw new AiRuntimeError('timeout', 'AI invocation total deadline exceeded.');
  const result = await executeAdapterUnchecked(profile, prompt, schema, deadline, adapterOpts);
  // The adapter call completed: a post-return guard failure still consumed
  // provider usage, so preserve it on the error for settlement reconciliation.
  if (Date.now() >= deadline) {
    const error = new AiRuntimeError('timeout', 'AI invocation total deadline exceeded.');
    error.failedAttemptUsage = failedUsageWithBoundedCounts(result);
    throw error;
  }
  if (Buffer.byteLength(String(result.text || '')) > aiLimit('AI_MAX_RESPONSE_BYTES', 2 * 1024 * 1024)) {
    const error = new AiRuntimeError('response_limit', 'AI output exceeds deployment limit.');
    error.failedAttemptUsage = failedUsageWithBoundedCounts(result);
    throw error;
  }
  return result;
}

function isBoundedAdapterOpts(adapterOpts = {}) {
  const hasJob = adapterOpts.boundedSemanticJob != null;
  const hasExecution = adapterOpts.runtimeExecution != null;
  if (hasJob !== hasExecution) {
    throw new AiRuntimeError('invalid_request', 'Bounded lane requires both boundedSemanticJob and runtimeExecution.');
  }
  return hasJob && hasExecution;
}

function boundedCountsOf(adapter = {}) {
  const metadata = adapter?.metadata || {};
  const modelCalls = finiteAdapterNumber(adapter.modelCalls ?? metadata.modelCalls ?? null);
  const toolCalls = finiteAdapterNumber(adapter.toolCalls ?? metadata.toolCalls ?? null);
  // Only surface when the bounded adapter actually measured them; generic
  // adapters keep their historical shape without these fields.
  if (adapter.modelCalls === undefined && adapter.toolCalls === undefined
    && metadata.modelCalls === undefined && metadata.toolCalls === undefined) {
    return {};
  }
  return { modelCalls, toolCalls };
}

function failedUsageWithBoundedCounts(adapter) {
  const base = failedUsageOf(adapter);
  const counts = boundedCountsOf(adapter);
  if (Object.keys(counts).length === 0) return base;
  return { ...base, ...counts };
}

async function executeAdapterUnchecked(profile, prompt, schema, deadline, adapterOpts = {}) {
  if (isBoundedAdapterOpts(adapterOpts)) {
    const timeoutMs = deadline - Date.now();
    if (timeoutMs <= 0) throw new AiRuntimeError('timeout', 'AI invocation total deadline exceeded.');
    return runBoundedCliStructuredAI(profile, {
      prompt,
      schema,
      timeoutMs,
      maxOutputTokens: adapterOpts.maxOutputTokens ?? null,
      budget: adapterOpts.boundedSemanticJob?.budget ?? adapterOpts.boundedSemanticJob ?? null,
      boundedSemanticJob: adapterOpts.boundedSemanticJob,
      runtimeExecution: adapterOpts.runtimeExecution,
    });
  }
  if (profile.runtime === 'direct_api') {
    const apiKey = profile.secretRef ? await resolveAiSecret(profile.secretRef) : null;
    if (profile.secretRef && !apiKey) throw new AiRuntimeError('auth', 'Configured AI secret is unavailable.', { fallbackEligible: true });
    if (['openai', 'openrouter'].includes(profile.providerKind) && !apiKey) {
      throw new AiRuntimeError('auth', 'AI provider API key is unavailable.', { fallbackEligible: true });
    }
    const timeoutMs = deadline - Date.now();
    if (timeoutMs <= 0) throw new AiRuntimeError('timeout', 'AI invocation total deadline exceeded.');
    return runDirectStructuredAI(profile, {
      apiKey, prompt, schema, timeoutMs,
      maxOutputTokens: adapterOpts.maxOutputTokens ?? null,
      transport: adapterOpts.transport ?? null,
    });
  }
  return runCliStructuredAI(profile, { prompt, schema, timeoutMs: deadline - Date.now() });
}

function finiteAdapterNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Only cache reads count as cached input. Cache writes (newly stored context)
// are provider-internal accounting, not evidence of reused input.
export function adapterUsageSummary(adapter = {}) {
  const metadata = adapter.metadata || {};
  return {
    inputTokens: finiteAdapterNumber(adapter.inputTokens),
    cachedInputTokens: finiteAdapterNumber(Object.hasOwn(metadata, 'cacheReadTokens')
      ? metadata.cacheReadTokens : adapter.cachedInputTokens),
    outputTokens: finiteAdapterNumber(adapter.outputTokens),
    reasoningTokens: finiteAdapterNumber(Object.hasOwn(metadata, 'reasoningTokens')
      ? metadata.reasoningTokens : metadata.thinkingTokens ?? adapter.reasoningTokens),
  };
}

// Known provider usage from failed validation attempts, in the same
// number-or-null shape as the success-path execution fields. Zeros are
// preserved; any unknown contribution keeps its total unknown.
function failedUsageOf(adapter) {
  const usage = adapterUsageSummary(adapter);
  return {
    inputTokens: usage.inputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    costUsd: finiteAdapterNumber(adapter.costUsd),
  };
}

function aggregatedFailedUsage(first, repaired) {
  const firstUsage = adapterUsageSummary(first);
  const repairedUsage = adapterUsageSummary(repaired);
  return {
    inputTokens: usageSum(firstUsage.inputTokens, repairedUsage.inputTokens),
    cachedInputTokens: usageSum(firstUsage.cachedInputTokens, repairedUsage.cachedInputTokens),
    outputTokens: usageSum(firstUsage.outputTokens, repairedUsage.outputTokens),
    reasoningTokens: usageSum(firstUsage.reasoningTokens, repairedUsage.reasoningTokens),
    costUsd: usageSum(finiteAdapterNumber(first.costUsd), finiteAdapterNumber(repaired.costUsd)),
  };
}

function invalidOutputErrorWithUsage(usage) {
  const error = invalidOutputError();
  error.failedAttemptUsage = usage;
  return error;
}

// A completed adapter receipt that fails a post-return guard (refusal/text
// extraction, timeout, response limit) still counts as exactly one provider
// request. Pre-dispatch failures carry no receipt and are never counted.
async function invokeCountedAdapter(state, profile, prompt, schema, deadline, opts) {
  try {
    const result = await executeAdapter(profile, prompt, schema, deadline, opts);
    state.requestCount += 1;
    return result;
  } catch (error) {
    if (error?.failedAttemptUsage != null) state.requestCount += 1;
    throw error;
  }
}

async function executeValidated(profile, prompt, schema, deadline, { allowRepair = true, maxOutputTokens = null, transport = null, boundedSemanticJob = null, runtimeExecution = null } = {}) {
  // Bounded semantic jobs never repair: exactly one adapter request per call.
  if (boundedSemanticJob != null || runtimeExecution != null) allowRepair = false;
  const boundedOpts = (boundedSemanticJob != null || runtimeExecution != null)
    ? { boundedSemanticJob, runtimeExecution }
    : {};
  const state = { requestCount: 0 };
  let repairAttempted = false;
  try {
    const first = await invokeCountedAdapter(state, profile, prompt, schema, deadline, { maxOutputTokens, transport, ...boundedOpts });
    let parsed = parseStructuredText(first.text);
    let validation = parsed.parseError ? { valid: false, errors: [parsed.parseError] } : validateStructuredOutput(parsed.value, schema);
    if (validation.valid) {
      return { output: parsed.value, adapter: first, requestCount: state.requestCount, repairAttempted };
    }
    // Bounded lanes disable automatic repair: one invalid response is a
    // terminal invalid-output failure, never a silent second request.
    if (!allowRepair || first.nativeStructuredOutput) throw invalidOutputErrorWithUsage(failedUsageWithBoundedCounts(first));

    repairAttempted = true;
    let repaired;
    try {
      repaired = await invokeCountedAdapter(state, profile, repairPrompt(prompt, schema, first.text, validation.errors), schema, deadline, { maxOutputTokens, transport });
    } catch (error) {
      // A completed repair request that then fails keeps both receipts: the
      // first receipt is aggregated with the repair receipt, never dropped.
      const normalized = normalizeExecutionError(error);
      if (normalized.failedAttemptUsage != null) {
        normalized.failedAttemptUsage = aggregatedFailedUsage(first, normalized.failedAttemptUsage);
      }
      throw normalized;
    }
    parsed = parseStructuredText(repaired.text);
    validation = parsed.parseError ? { valid: false, errors: [parsed.parseError] } : validateStructuredOutput(parsed.value, schema);
    if (!validation.valid) throw invalidOutputErrorWithUsage(aggregatedFailedUsage(first, repaired));
    const firstUsage = adapterUsageSummary(first);
    const repairedUsage = adapterUsageSummary(repaired);
    return {
      output: parsed.value,
      adapter: {
        ...repaired,
        inputTokens: usageSum(first.inputTokens, repaired.inputTokens),
        outputTokens: usageSum(first.outputTokens, repaired.outputTokens),
        costUsd: usageSum(first.costUsd, repaired.costUsd),
        metadata: {
          ...repaired.metadata,
          cacheReadTokens: usageSum(firstUsage.cachedInputTokens, repairedUsage.cachedInputTokens),
          reasoningTokens: usageSum(firstUsage.reasoningTokens, repairedUsage.reasoningTokens),
        },
      },
      requestCount: state.requestCount,
      repairAttempted,
    };
  } catch (error) {
    const normalized = normalizeExecutionError(error);
    normalized.requestCount = state.requestCount;
    normalized.repairAttempted = repairAttempted;
    throw normalized;
  }
}

async function runAttempt({
  invocationId,
  attempt,
  attemptKind,
  role,
  profile,
  profileSource,
  fallbackProfileId,
  fallbackUsed,
  prompt,
  schema,
  deadline,
  metadata,
  allowRepair = true,
  maxOutputTokens = null,
  transport = null,
  boundedSemanticJob = null,
  runtimeExecution = null,
}) {
  const startedAt = Date.now();
  const run = createAiRunAttempt({
    invocationId,
    attempt,
    attemptKind,
    role,
    profileId: profile.id,
    runtime: profile.runtime,
    providerKind: profile.providerKind,
    model: profile.model === 'inherit' ? '' : profile.model,
    reasoning: profile.reasoning,
    fallbackProfileId,
    fallbackUsed,
    startedAt,
    metadata: { ...metadata, profileSource, compatibilityProfile: profile.compatibility === true },
  });
  let requestCount = 0;
  let repairAttempted = false;
  let result = null;
  try {
    if (profile.enabled === false) throw new AiRuntimeError('profile_disabled', 'Selected AI profile is disabled.');
    result = await executeValidated(profile, prompt, schema, deadline, { allowRepair, maxOutputTokens, transport, boundedSemanticJob, runtimeExecution });
    requestCount = result.requestCount;
    repairAttempted = result.repairAttempted;
    const completedAt = Date.now();
    try {
      finishAiRunAttempt(run.id, {
        status: 'complete',
        completedAt,
        model: result.adapter.model || profile.model,
        reasoning: result.adapter.reasoning || profile.reasoning || '',
        inputTokens: result.adapter.inputTokens,
        outputTokens: result.adapter.outputTokens,
        costUsd: result.adapter.costUsd,
        metadata: {
          ...(result.adapter.metadata || {}),
          requestCount,
          repairAttempted,
          actualModel: result.adapter.model || profile.model,
        },
      });
    } catch {
      const error = new AiRuntimeError('telemetry_error', 'AI execution completed, but usage telemetry could not be persisted.');
      error.requestCount = result.requestCount;
      error.repairAttempted = result.repairAttempted;
      error.failedAttemptUsage = failedUsageWithBoundedCounts(result.adapter);
      throw error;
    }
    const usage = adapterUsageSummary(result.adapter);
    const counts = boundedCountsOf(result.adapter);
    return {
      output: result.output,
      execution: {
        invocationId,
        attempt,
        runtime: result.adapter.runtime || profile.runtime,
        provider: result.adapter.provider || profile.providerKind,
        model: result.adapter.model || profile.model,
        reasoning: result.adapter.reasoning || profile.reasoning || '',
        profileId: profile.id,
        profileSource,
        fallbackUsed,
        startedAt,
        completedAt,
        inputTokens: usage.inputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        outputTokens: usage.outputTokens,
        reasoningTokens: usage.reasoningTokens,
        outputTokenLimit: finiteAdapterNumber(result.adapter.metadata?.outputTokenLimit),
        costUsd: result.adapter.costUsd ?? null,
        // Actual bounded counts when the adapter measured them; null (unknown)
        // otherwise. Generic adapters predate these fields and stay unchanged
        // apart from the honest unknown.
        modelCalls: counts.modelCalls ?? null,
        toolCalls: counts.toolCalls ?? null,
      },
    };
  } catch (error) {
    const normalized = normalizeExecutionError(error);
    if (result != null && normalized.failedAttemptUsage == null) {
      normalized.failedAttemptUsage = failedUsageWithBoundedCounts(result.adapter);
      normalized.requestCount = result.requestCount;
    }
    requestCount = Number(normalized.requestCount || requestCount || 0);
    repairAttempted = normalized.repairAttempted === true || repairAttempted;
    try {
      finishAiRunAttempt(run.id, {
        status: 'failed',
        completedAt: Date.now(),
        errorCode: normalized.code,
        metadata: {
          requestCount,
          repairAttempted,
          // Durable copy of known provider usage from the failed attempt(s) for
          // settlement reconciliation. Absent when nothing was reported.
          ...(normalized.failedAttemptUsage != null ? { failedAttemptUsage: normalized.failedAttemptUsage } : {}),
        },
      });
    } catch {
      // A telemetry write failure must never replace the measured provider
      // usage carried by the original execution error.
    }
    throw normalized;
  }
}

// allowRepair/allowFallback default to the historical behavior (schema repair
// plus provider fallback). Bounded lanes pass false/false for exactly one
// adapter request per call; every request is then reserved individually.
// maxOutputTokens/transport reach only the direct_api adapter; CLI adapters
// cannot enforce per-call token caps, so bounded lanes refuse them instead.
export async function runStructuredAI({ role, profile = null, prompt, schema, timeoutMs = 120_000, metadata = {}, allowRepair = true, allowFallback = true, maxOutputTokens = null, transport = null, boundedSemanticJob = null, runtimeExecution = null } = {}) {
  assertSchemaSupported(schema);
  const taskPrompt = String(prompt || '').trim();
  if (!taskPrompt) throw new AiRuntimeError('invalid_request', 'runStructuredAI requires a prompt.');
  const timeout = Number(timeoutMs);
  if (!Number.isFinite(timeout) || timeout <= 0) throw new AiRuntimeError('invalid_request', 'runStructuredAI timeoutMs must be positive.');
  const invocationId = randomUUID();
  const deadline = Date.now() + Math.min(timeout, aiLimit('AI_TOTAL_TIMEOUT_MS', 120_000));
  let resolution;
  try {
    resolution = resolveAiProfileForRole(role, profile);
  } catch (error) {
    throw new AiRuntimeError('profile_resolution', error?.message || 'AI profile resolution failed.', { invocationId });
  }
  if (!resolution.profile) {
    throw new AiRuntimeError('profile_unconfigured', `No AI profile is configured for role ${resolution.role}.`, { invocationId });
  }
  // Bounded semantic jobs never fall back: exactly one adapter request per
  // call. Generic lanes keep their historical fallback behavior.
  if (boundedSemanticJob != null || runtimeExecution != null) allowFallback = false;

  const attempts = [];
  try {
    return await runAttempt({
      invocationId,
      attempt: 1,
      attemptKind: 'primary',
      role: resolution.role,
      profile: resolution.profile,
      profileSource: resolution.source,
      fallbackProfileId: resolution.fallbackProfile?.id ?? null,
      fallbackUsed: false,
      prompt: taskPrompt,
      schema,
      deadline,
      metadata,
      allowRepair,
      maxOutputTokens,
      transport,
      boundedSemanticJob,
      runtimeExecution,
    });
  } catch (error) {
    const primaryError = normalizeExecutionError(error);
    attempts.push({ attempt: 1, profileId: resolution.profile.id, code: primaryError.code });
    if (!primaryError.fallbackEligible || !allowFallback || !resolution.fallbackProfile) {
      primaryError.invocationId = invocationId;
      primaryError.attempts = attempts;
      throw primaryError;
    }
  }

  try {
    return await runAttempt({
      invocationId,
      attempt: 2,
      attemptKind: 'fallback',
      role: resolution.role,
      profile: resolution.fallbackProfile,
      profileSource: 'role_fallback',
      fallbackProfileId: resolution.fallbackProfile.id,
      fallbackUsed: true,
      prompt: taskPrompt,
      schema,
      deadline,
      metadata,
      allowRepair,
      maxOutputTokens,
      transport,
      boundedSemanticJob,
      runtimeExecution,
    });
  } catch (error) {
    const fallbackError = normalizeExecutionError(error);
    attempts.push({ attempt: 2, profileId: resolution.fallbackProfile.id, code: fallbackError.code });
    fallbackError.invocationId = invocationId;
    fallbackError.attempts = attempts;
    throw fallbackError;
  }
}

function profileFromInput(profileOrId) {
  if (profileOrId && typeof profileOrId === 'object' && !Array.isArray(profileOrId)) {
    if (profileOrId.id != null) {
      const persisted = getAiProfile(profileOrId.id);
      if (!persisted) throw new AiRuntimeError('profile_not_found', `AI profile not found: ${profileOrId.id}`);
      return persisted;
    }
    return profileOrId;
  }
  const profile = getAiProfile(profileOrId);
  if (!profile) throw new AiRuntimeError('profile_not_found', `AI profile not found: ${profileOrId}`);
  return profile;
}

export async function listAiCatalog(profileOrId, { refresh = false, timeoutMs = 15_000 } = {}) {
  const profile = profileFromInput(profileOrId);
  if (profile.runtime === 'direct_api') {
    const apiKey = profile.secretRef ? await resolveAiSecret(profile.secretRef) : null;
    try {
      return await listDirectAiCatalog(profile, { apiKey, refresh, timeoutMs });
    } catch (error) {
      const normalized = normalizeExecutionError(error);
      return {
        models: [],
        fetchedAt: null,
        manualModelEntry: true,
        error: { code: normalized.code, message: normalized.message },
      };
    }
  }
  return listCliAiCatalog(profile, { timeoutMs, refresh });
}

export async function listAiRuntimeAvailability() {
  const cli = await listAiCliAvailability();
  return [
    { runtime: 'direct_api', installed: true, version: null, structuredOutput: 'supported', reason: null },
    ...cli,
  ];
}

export async function checkAiProfileConnection(profileOrId, { timeoutMs = 10_000 } = {}) {
  const profile = profileFromInput(profileOrId);
  if (profile.runtime === 'direct_api') {
    const apiKey = profile.secretRef ? await resolveAiSecret(profile.secretRef) : null;
    if (profile.secretRef && !apiKey) {
      return {
        runtimeAvailable: true,
        providerReachable: null,
        authenticated: false,
        modelFound: null,
        structuredOutputPath: profile.settings?.structuredOutput === 'supported' ? 'native' : 'compatible_fallback',
        latencyMs: 0,
        error: { code: 'auth' },
      };
    }
    return checkDirectAiConnection(profile, { apiKey, timeoutMs });
  }
  return checkCliAiConnection(profile, { timeoutMs });
}

export async function testAiProfile(profileOrId, { timeoutMs = 30_000 } = {}) {
  const profile = profileFromInput(profileOrId);
  if (profile.enabled === false) throw new AiRuntimeError('profile_disabled', 'Selected AI profile is disabled.');
  const startedAt = Date.now();
  const schema = {
    type: 'object',
    properties: { ok: { type: 'boolean' } },
    required: ['ok'],
    additionalProperties: false,
  };
  const result = await executeValidated(
    profile,
    'Return one JSON object with exactly {"ok": true}. This is a configuration test; do not call tools or add other content.',
    schema,
    Date.now() + timeoutMs,
  );
  if (result.output?.ok !== true) throw new AiRuntimeError('test_failed', 'AI profile test returned an unexpected structured result.');
  return {
    ok: true,
    runtime: result.adapter.runtime || profile.runtime,
    provider: result.adapter.provider || profile.providerKind,
    model: result.adapter.model || profile.model,
    reasoning: result.adapter.reasoning || profile.reasoning || '',
    structuredOutputPath: result.adapter.nativeStructuredOutput ? 'runtime_schema' : 'compatible_fallback',
    latencyMs: Date.now() - startedAt,
    inputTokens: result.adapter.inputTokens ?? null,
    outputTokens: result.adapter.outputTokens ?? null,
    costUsd: result.adapter.costUsd ?? null,
    requestCount: result.requestCount,
  };
}
