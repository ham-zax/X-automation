import fs from 'node:fs';
import { recordOwnerRequestAudit } from './store.js';
import path from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const credentialPath = () => path.resolve('.x-web-owner-password');
const admitted = new WeakSet();
const clients = new Map();
let active = 0;

function publicOrigin() {
  const configured = process.env.WEB_PUBLIC_ORIGIN;
  if (!configured) return null;
  const parsed = new URL(configured);
  if (!['http:', 'https:'].includes(parsed.protocol) || configured !== parsed.origin) {
    throw new Error('WEB_PUBLIC_ORIGIN must be an exact http(s) origin without credentials, path, query, or fragment.');
  }
  return parsed.origin;
}

export function initializeWebAuth(host) {
  publicOrigin();
  if (process.env.WEB_AUTH_PASSWORD) return;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('WEB_AUTH_PASSWORD is required for a non-loopback WEB_HOST.');
  }
  const file = credentialPath();
  try { fs.writeFileSync(file, randomBytes(32).toString('base64url'), { mode: 0o600, flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const info = fs.lstatSync(file);
  if (!info.isFile() || (info.mode & 0o077)) throw new Error('Owner password file must be a regular file with mode 600.');
  process.env.WEB_AUTH_PASSWORD = fs.readFileSync(file, 'utf8').trim();
  if (!process.env.WEB_AUTH_PASSWORD) throw new Error('Owner password file is empty.');
  console.log(`[web] Owner login: ${process.env.WEB_AUTH_USER || 'owner'}; password file: ${file}`);
}

function equal(a, b) {
  const first = Buffer.from(a), second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function protectWebRequest(req, res, requestUrl) {
  if (admitted.has(req)) return true;
  const requestId = randomUUID();
  req.webRequestId = requestId;
  const startedAt = Date.now();
  res.once?.('finish', () => {
    const entry = { requestId, actor: req.webActor || 'anonymous', method: req.method, route: requestUrl.pathname, status: res.statusCode, durationMs: Date.now() - startedAt };
    console.log('[web] request', JSON.stringify(entry));
    if (req.webActor && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      try { recordOwnerRequestAudit(entry); } catch (error) { logWebError(error, req); }
    }
  });
  const headers = {
    'x-request-id': requestId,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  };
  for (const [name, value] of Object.entries(headers)) res.setHeader?.(name, value);
  const reject = (status, message, extra = {}) => {
    res.writeHead(status, { ...headers, ...extra, 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ state: 'error', message, requestId }));
    return false;
  };
  let configuredOrigin;
  try { configuredOrigin = publicOrigin(); }
  catch { return reject(503, 'Public origin configuration is invalid.'); }
  const address = req.socket?.remoteAddress || 'local';
  const now = Date.now();
  for (const [key, value] of clients) if (value.until <= now) clients.delete(key);
  if (!clients.has(address) && clients.size >= 1024) return reject(429, 'Request limit reached.');
  const counter = clients.get(address) || { until: now + 60_000, count: 0 };
  clients.set(address, counter);
  if (++counter.count > 300) return reject(429, 'Request limit reached.', { 'retry-after': '60' });
  const password = process.env.WEB_AUTH_PASSWORD;
  if (!password) return reject(503, 'Owner authentication is not configured.');
  const authorization = String(req.headers?.authorization || '');
  let decoded = '';
  if (/^Basic [A-Za-z0-9+/]+=*$/i.test(authorization)) decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
  if (!equal(decoded, `${process.env.WEB_AUTH_USER || 'owner'}:${password}`)) {
    return reject(401, 'Owner authentication required.', { 'www-authenticate': 'Basic realm="Growth OS", charset="UTF-8"' });
  }
  req.webActor = 'owner';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers?.origin;
    const site = req.headers?.['sec-fetch-site'];
    // Non-browser clients may omit Origin; browsers must come from this exact origin.
    const protocol = req.socket?.encrypted ? 'https:' : 'http:';
    if (!configuredOrigin && (req.headers?.['x-forwarded-proto'] || req.headers?.['x-forwarded-host'])) return reject(503, 'WEB_PUBLIC_ORIGIN is required behind a reverse proxy.');
    const expected = configuredOrigin || `${protocol}//${req.headers?.host || requestUrl.host}`;
    if ((origin && origin !== expected) || (site && !['same-origin', 'none'].includes(site))) return reject(403, 'Cross-origin mutation rejected.');
    const type = String(req.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (requestUrl.pathname.startsWith('/api/') && !/^\/api\/drafts\/\d+\/media$/.test(requestUrl.pathname) && type !== 'application/json') return reject(415, 'application/json is required.');
    if (!requestUrl.pathname.startsWith('/api/') && type !== 'application/x-www-form-urlencoded') return reject(415, 'Form content type is required.');
  }
  if (active >= 32) return reject(503, 'Server is busy.', { 'retry-after': '1' });
  active++;
  admitted.add(req);
  res.once?.('finish', () => releaseWebRequest(req));
  return true;
}

export function releaseWebRequest(req) {
  if (admitted.delete(req)) active--;
}

export function logWebError(error, req) {
  // Never log credentials, query strings, request bodies, or provider error text.
  console.error('[web] request failed', { requestId: req.webRequestId, method: req.method, code: /^[A-Z0-9_]+$/.test(error?.code || '') ? error.code : 'INTERNAL_ERROR' });
}
