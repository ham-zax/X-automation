const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const CATALOG_CACHE_MS = 5 * 60_000;
const catalogCache = new Map();

export class AiDirectError extends Error {
  constructor(code, message, { fallbackEligible = false, httpStatus = null } = {}) {
    super(message);
    this.name = 'AiDirectError';
    this.code = code;
    this.fallbackEligible = fallbackEligible;
    this.httpStatus = httpStatus;
  }
}

function baseUrlForProfile(profile) {
  if (profile.providerKind === 'openai') return profile.baseUrl || OPENAI_BASE_URL;
  if (profile.providerKind === 'openrouter') return profile.baseUrl || OPENROUTER_BASE_URL;
  return profile.baseUrl;
}

function endpointUrl(profile, suffix) {
  const base = String(baseUrlForProfile(profile) || '').replace(/\/+$/, '');
  if (!base) throw new AiDirectError('provider_configuration', 'Direct AI profile has no base URL.');
  return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

function headersForProfile(profile, apiKey) {
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  if (profile.providerKind === 'openrouter') {
    if (profile.settings?.httpReferer) headers['HTTP-Referer'] = profile.settings.httpReferer;
    if (profile.settings?.appTitle) headers['X-Title'] = profile.settings.appTitle;
  }
  return headers;
}

function classifyHttpError(status) {
  if (status === 401 || status === 403) return ['auth', 'AI provider authentication failed.', true];
  if (status === 408) return ['timeout', 'AI provider request timed out.', true];
  if (status === 429) return ['rate_limit', 'AI provider rate limit was reached.', true];
  if (status >= 500) return ['provider_error', 'AI provider returned a server error.', true];
  return ['provider_error', 'AI provider rejected the request.', false];
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === 'AbortError') throw new AiDirectError('timeout', 'AI provider request timed out.', { fallbackEligible: true });
      throw new AiDirectError('connection', 'AI provider connection failed.', { fallbackEligible: true });
    }
    if (!response.ok) {
      const [code, message, fallbackEligible] = classifyHttpError(response.status);
      throw new AiDirectError(code, message, { fallbackEligible, httpStatus: response.status });
    }
    try {
      return await response.json();
    } catch {
      throw new AiDirectError('provider_error', 'AI provider returned an invalid JSON response.');
    }
  } finally {
    clearTimeout(timer);
  }
}

function nativeStructuredOutput(profile) {
  const configured = profile.settings?.structuredOutput;
  if (configured === 'unsupported') {
    throw new AiDirectError('structured_output_unsupported', 'AI profile is marked unsupported for structured output.');
  }
  if (configured === 'supported') return true;
  if (configured === 'compatible_fallback' || configured === 'unknown') return false;
  return profile.providerKind === 'openai';
}

function jsonSchemaDefinition(schema) {
  return {
    name: 'x_test_output',
    schema,
    strict: true,
  };
}

function responseFormat(schema) {
  return { type: 'json_schema', ...jsonSchemaDefinition(schema) };
}

function buildResponsesRequest(profile, prompt, schema, useNativeSchema) {
  const body = {
    model: profile.model,
    input: prompt,
    store: false,
  };
  if (useNativeSchema) body.text = { format: responseFormat(schema) };
  if (profile.reasoning) body.reasoning = { effort: profile.reasoning };
  return body;
}

function buildChatRequest(profile, prompt, schema, useNativeSchema) {
  const body = {
    model: profile.model,
    messages: [{ role: 'user', content: prompt }],
  };
  if (useNativeSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: jsonSchemaDefinition(schema),
    };
  }
  if (profile.reasoning) {
    if (profile.providerKind === 'openrouter') body.reasoning = { effort: profile.reasoning };
    else body.reasoning_effort = profile.reasoning;
  }
  return body;
}

function extractResponsesText(body) {
  if (typeof body?.output_text === 'string') return body.output_text;
  for (const item of Array.isArray(body?.output) ? body.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === 'string' && (!part.type || part.type === 'output_text')) return part.text;
    }
  }
  throw new AiDirectError('provider_error', 'AI provider response did not contain structured output text.');
}

function extractChatText(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content.map((part) => typeof part === 'string' ? part : part?.text || '').join('');
    if (text) return text;
  }
  throw new AiDirectError('provider_error', 'AI provider response did not contain structured output text.');
}

function nullableNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedUsage(body) {
  const usage = body?.usage || {};
  return {
    inputTokens: nullableNumber(usage.input_tokens ?? usage.prompt_tokens),
    outputTokens: nullableNumber(usage.output_tokens ?? usage.completion_tokens),
    costUsd: nullableNumber(usage.cost),
  };
}

export async function runDirectStructuredAI(profile, { apiKey = null, prompt, schema, timeoutMs = 120_000 } = {}) {
  if (profile.runtime !== 'direct_api') throw new AiDirectError('provider_configuration', 'Profile is not a direct API profile.');
  const useNativeSchema = nativeStructuredOutput(profile);
  const effectivePrompt = useNativeSchema ? prompt : [
    'Return only one JSON value matching the supplied JSON Schema. Do not wrap it in markdown or prose.',
    'JSON SCHEMA:',
    JSON.stringify(schema),
    '',
    'TASK:',
    prompt,
  ].join('\n');
  let suffix;
  let body;
  let extractText;
  if (profile.protocol === 'responses') {
    suffix = '/responses';
    body = buildResponsesRequest(profile, effectivePrompt, schema, useNativeSchema);
    extractText = extractResponsesText;
  } else if (profile.protocol === 'chat_completions') {
    suffix = '/chat/completions';
    body = buildChatRequest(profile, effectivePrompt, schema, useNativeSchema);
    extractText = extractChatText;
  } else {
    throw new AiDirectError('provider_configuration', `Unsupported direct AI protocol: ${profile.protocol}`);
  }
  const response = await fetchJson(endpointUrl(profile, suffix), {
    method: 'POST',
    headers: headersForProfile(profile, apiKey),
    body: JSON.stringify(body),
  }, timeoutMs);
  const usage = normalizedUsage(response);
  return {
    text: extractText(response),
    runtime: 'direct_api',
    provider: profile.providerKind,
    model: String(response?.model || profile.model || ''),
    reasoning: profile.reasoning || '',
    ...usage,
    nativeStructuredOutput: useNativeSchema,
    metadata: {
      protocol: profile.protocol,
      structuredOutput: useNativeSchema ? 'native' : 'compatible_fallback',
      providerReportedCost: usage.costUsd != null,
    },
  };
}

function normalizeCatalogEntry(entry, providerKind) {
  const supportedParameters = Array.isArray(entry?.supported_parameters) ? entry.supported_parameters.map(String) : [];
  const architecture = entry?.architecture && typeof entry.architecture === 'object' ? entry.architecture : {};
  const structuredOutput = supportedParameters.includes('structured_outputs') || supportedParameters.includes('response_format')
    ? 'supported'
    : providerKind === 'openrouter'
      ? 'compatible_fallback'
      : 'unknown';
  return {
    id: String(entry?.id || ''),
    name: String(entry?.name || entry?.id || ''),
    provider: providerKind,
    contextLength: nullableNumber(entry?.context_length ?? entry?.context_window),
    pricing: entry?.pricing && typeof entry.pricing === 'object' ? entry.pricing : null,
    supportedParameters,
    structuredOutput,
    inputModalities: Array.isArray(architecture?.input_modalities) ? architecture.input_modalities.map(String) : null,
    outputModalities: Array.isArray(architecture?.output_modalities) ? architecture.output_modalities.map(String) : null,
  };
}

function catalogCacheKey(profile) {
  return [profile.providerKind, baseUrlForProfile(profile), profile.settings?.catalogPath || '/models'].join('|');
}

export async function listDirectAiCatalog(profile, { apiKey = null, timeoutMs = 15_000, refresh = false } = {}) {
  const cacheKey = catalogCacheKey(profile);
  const cached = catalogCache.get(cacheKey);
  if (!refresh && cached && Date.now() - cached.fetchedAt < CATALOG_CACHE_MS) return cached;
  const catalogPath = profile.settings?.catalogPath || '/models';
  const body = await fetchJson(endpointUrl(profile, catalogPath), {
    method: 'GET',
    headers: headersForProfile(profile, apiKey),
  }, timeoutMs);
  const entries = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
  const result = {
    models: entries.map((entry) => normalizeCatalogEntry(entry, profile.providerKind)).filter((entry) => entry.id),
    fetchedAt: Date.now(),
    manualModelEntry: true,
  };
  catalogCache.set(cacheKey, result);
  return result;
}

export async function checkDirectAiConnection(profile, { apiKey = null, timeoutMs = 10_000 } = {}) {
  const startedAt = Date.now();
  try {
    const catalog = await listDirectAiCatalog(profile, { apiKey, timeoutMs, refresh: true });
    return {
      runtimeAvailable: true,
      providerReachable: true,
      authenticated: apiKey ? true : null,
      modelFound: catalog.models.length ? catalog.models.some((model) => model.id === profile.model) : null,
      structuredOutputPath: nativeStructuredOutput(profile) ? 'native' : 'compatible_fallback',
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    if (!(error instanceof AiDirectError)) throw error;
    return {
      runtimeAvailable: true,
      providerReachable: !['connection', 'timeout'].includes(error.code),
      authenticated: error.code === 'auth' ? false : null,
      modelFound: null,
      structuredOutputPath: profile.settings?.structuredOutput === 'supported' || (profile.providerKind === 'openai' && !profile.settings?.structuredOutput)
        ? 'native'
        : 'compatible_fallback',
      latencyMs: Date.now() - startedAt,
      error: { code: error.code, httpStatus: error.httpStatus },
    };
  }
}
