import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { resolvePublicDestination } from './research.js';
import { getAppState, setAppState, runStoreTransaction } from './store.js';

export function aiLimit(name, fallback) {
  const raw = process.env[name];
  const value = raw == null || raw === '' ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid deployment AI limit: ${name}`);
  return value;
}
export function assertAiEnvCredential(name) {
  const allowed = new Set(['OPENAI_API_KEY', 'OPENROUTER_API_KEY', ...String(process.env.AI_ALLOWED_ENV_CREDENTIALS || '').split(',').map(x => x.trim()).filter(Boolean)]);
  if (!allowed.has(name)) throw new Error('AI environment credential reference is not deployment-authorized.');
}
function configuredUrls(name) {
  return String(process.env[name] || '').split(',').map(x => x.trim()).filter(Boolean).map(x => new URL(x));
}
export function assertAiDestination(input) {
  const url = new URL(input);
  if (url.username || url.password || url.hash || !['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid AI provider URL.');
  const local = configuredUrls('AI_ALLOWED_LOCAL_PROVIDER_URLS');
  const matches = base => url.origin === base.origin && (url.pathname === base.pathname.replace(/\/$/, '') || url.pathname.startsWith(`${base.pathname.replace(/\/$/, '')}/`));
  const isLocal = local.some(matches);
  const allowed = [new URL('https://api.openai.com/v1'), new URL('https://openrouter.ai/api/v1'), ...configuredUrls('AI_ALLOWED_PROVIDER_URLS')];
  if (!isLocal && (url.protocol !== 'https:' || !allowed.some(matches))) throw new Error('AI provider URL is not deployment-authorized.');
  return { url, isLocal };
}

// DNS validation and the connection share the same addresses; redirects never inherit credentials.
export async function boundedAiRequest(input, options = {}, timeoutMs = 15_000) {
  const { url, isLocal } = assertAiDestination(input);
  const deadline = Date.now() + Math.min(timeoutMs, aiLimit('AI_TOTAL_TIMEOUT_MS', 120_000));
  let dnsTimer;
  const addresses = await Promise.race([
    isLocal ? (net.isIP(url.hostname.replace(/^\[|\]$/g, '')) ? Promise.resolve([{ address: url.hostname.replace(/^\[|\]$/g, ''), family: net.isIP(url.hostname.replace(/^\[|\]$/g, '')) }]) : dns.lookup(url.hostname, { all: true, verbatim: true })) : resolvePublicDestination(url, deadline),
    new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(new Error('AI request deadline exceeded.')), Math.max(1, deadline - Date.now())); }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (Date.now() >= deadline) throw new Error('AI request deadline exceeded.');
  const maxBytes = aiLimit('AI_MAX_RESPONSE_BYTES', 2 * 1024 * 1024);
  return new Promise((resolve, reject) => {
    let timer;
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: options.method || 'GET', headers: { ...options.headers, 'accept-encoding': 'identity' }, agent: false,
      lookup(_host, opts, callback) {
        const eligible = addresses.filter(x => !opts.family || Number(opts.family) === x.family);
        if (!eligible.length) return callback(new Error('No approved AI destination address.'));
        if (opts.all) callback(null, eligible); else callback(null, eligible[0].address, eligible[0].family);
      },
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400) { request.destroy(new Error('AI provider redirects are forbidden.')); return; }
      if (Number(response.headers['content-length'] || 0) > maxBytes || !['', 'identity'].includes(String(response.headers['content-encoding'] || ''))) { request.destroy(new Error('AI provider response exceeds transport limits.')); return; }
      const chunks = []; let bytes = 0;
      response.on('data', chunk => { bytes += chunk.length; if (bytes > maxBytes) request.destroy(new Error('AI provider response exceeds transport limits.')); else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, ok: response.statusCode >= 200 && response.statusCode < 300, text: Buffer.concat(chunks).toString('utf8') }));
    });
    timer = setTimeout(() => request.destroy(new Error('AI request deadline exceeded.')), Math.max(1, deadline - Date.now()));
    request.on('error', reject);
    request.on('close', () => clearTimeout(timer));
    request.end(options.body);
  });
}

function aiPolicyError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function estimateAiInputTokens(prompt) {
  // JSON/editorial prompts are predominantly ASCII. Three UTF-8 bytes per token is
  // deliberately conservative versus the usual ~4 chars/token while avoiding the
  // previous 1-byte=1-token overcount.
  return Math.max(1, Math.ceil(Buffer.byteLength(String(prompt)) / 3));
}

export function reserveAiRequest(prompt, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid AI request timeout.');
  timeoutMs = Math.min(timeoutMs, aiLimit('AI_TOTAL_TIMEOUT_MS', 120_000));
  const id = randomUUID(); const now = Date.now();
  const inputTokens = estimateAiInputTokens(prompt);
  const maxInputTokens = aiLimit('AI_MAX_INPUT_TOKENS', 120_000);
  if (inputTokens > maxInputTokens) {
    throw aiPolicyError('ai_input_limit', `AI prompt exceeds deployment input limit: ~${inputTokens} tokens > ${maxInputTokens}.`);
  }
  return runStoreTransaction(() => {
    const key = 'ai_request_concurrency';
    const state = JSON.parse(getAppState(key, '{"active":{}}'));
    const active = Object.fromEntries(Object.entries(state.active || {}).filter(([, value]) => value > now));
    if (Object.keys(active).length >= aiLimit('AI_MAX_CONCURRENCY', 2)) {
      throw aiPolicyError('ai_concurrency_limit', 'Deployment AI concurrency limit reached.');
    }
    active[id] = now + timeoutMs + 5_000;
    setAppState(key, JSON.stringify({ active }));
    return () => runStoreTransaction(() => {
      const latest = JSON.parse(getAppState(key, '{"active":{}}'));
      delete latest.active[id];
      setAppState(key, JSON.stringify({ active: latest.active || {} }));
    });
  });
}
