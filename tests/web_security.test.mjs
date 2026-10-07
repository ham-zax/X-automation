import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
const originalCwd = process.cwd();
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'web-security-test-'));
process.chdir(scratch);
const { protectWebRequest, releaseWebRequest } = await import('../web_security.js');
after(async () => { process.chdir(originalCwd); await fs.rm(scratch, { recursive: true, force: true }); });

process.env.WEB_AUTH_PASSWORD = 'test-owner-password';
const auth = `Basic ${Buffer.from('owner:test-owner-password').toString('base64')}`;
function request({ method = 'GET', headers = {}, pathname = '/api/session' } = {}) {
  const req = { method, headers: { host: 'localhost:3030', ...headers }, socket: { remoteAddress: 'test' } };
  const res = { status: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, writeHead(status, h) { this.status = status; Object.assign(this.headers, h); }, end(body) { this.body = body; } };
  const allowed = protectWebRequest(req, res, new URL(pathname, 'http://localhost:3030'));
  releaseWebRequest(req);
  return { allowed, ...res };
}
test('owner authentication is mandatory on reads and served assets', () => {
  assert.equal(request().status, 401);
  assert.equal(request({ pathname: '/app/main.js' }).status, 401);
  assert.equal(request({ headers: { authorization: auth } }).allowed, true);
  assert.equal(request({ headers: { authorization: 'Basic ' + Buffer.from('owner:wrong').toString('base64') } }).status, 401);
});
test('mutation enforces JSON, exact origin, and Fetch Metadata', () => {
  const headers = { authorization: auth, 'content-type': 'application/json', origin: 'http://localhost:3030', 'sec-fetch-site': 'same-origin' };
  assert.equal(request({ method: 'POST', headers }).allowed, true);
  assert.equal(request({ method: 'POST', headers: { ...headers, origin: 'https://attacker.example' } }).status, 403);
  assert.equal(request({ method: 'POST', headers: { ...headers, 'sec-fetch-site': 'same-site' } }).status, 403);
  assert.equal(request({ method: 'POST', headers: { authorization: auth, 'content-type': 'text/plain' } }).status, 415);
  assert.equal(request({ method: 'POST', pathname: '/api/drafts/1/media', headers: { ...headers, 'content-type': 'image/png' } }).allowed, true);
});
test('security headers and bounded concurrent work apply', () => {
  const result = request({ headers: { authorization: auth } });
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['x-frame-options'], 'DENY');
  assert.ok(result.headers['x-request-id']);
  const pending = [];
  for (let i = 0; i < 32; i++) {
    const req = { method: 'GET', headers: { authorization: auth }, socket: { remoteAddress: 'concurrency' } };
    const res = { setHeader() {}, writeHead() {}, end() {} };
    assert.equal(protectWebRequest(req, res, new URL('http://localhost/api/session')), true);
    pending.push(req);
  }
  assert.equal(request({ headers: { authorization: auth } }).status, 503);
  for (const req of pending) releaseWebRequest(req);
});

test('media rejects spoofed bytes, damaged PNG payloads, and oversized dimensions', async () => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const cwd = process.cwd();
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'web-media-test-'));
  try {
    process.chdir(temporary);
    const { validateImage, handleApi } = await import('../web_api.js');
    const directResponse = { writeHead(status) { this.status = status; }, end() {} };
    await handleApi({ method: 'GET', headers: {} }, directResponse, new URL('http://localhost/api/session'));
    assert.equal(directResponse.status, 401);
    assert.throws(() => validateImage(Buffer.from('<html>spoofed upload</html>'), 'image/png'));
    const valid = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    assert.deepEqual(validateImage(valid, 'image/png'), { width: 1, height: 1 });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64');
    // Deliberately corrupt the checksum of an otherwise recognizable PNG.
    png[29] ^= 1;
    assert.throws(() => validateImage(png, 'image/png'));
    const gif = Buffer.from('474946383961ffffffffff002c003b', 'hex');
    assert.throws(() => validateImage(gif, 'image/gif'));
  } finally {
    process.chdir(cwd);
    await fs.rm(temporary, { recursive: true, force: true });
  }
});


test('reverse proxy uses explicit HTTPS public origin and rejects malformed configuration', () => {
  const previous = process.env.WEB_PUBLIC_ORIGIN;
  const headers = { authorization: auth, 'content-type': 'application/json', origin: 'https://growth.example', 'sec-fetch-site': 'same-origin', 'x-forwarded-proto': 'https' };
  try {
    delete process.env.WEB_PUBLIC_ORIGIN;
    assert.equal(request({ method: 'POST', headers }).status, 503);
    process.env.WEB_PUBLIC_ORIGIN = 'https://growth.example';
    assert.equal(request({ method: 'POST', headers }).allowed, true);
    assert.equal(request({ method: 'POST', headers: { ...headers, origin: 'https://other.example' } }).status, 403);
    assert.equal(request({ method: 'POST', headers: { ...headers, origin: 'http://growth.example' } }).status, 403);
    for (const invalid of ['not-a-url', 'https://growth.example/path', 'https://owner:secret@growth.example', 'https://growth.example?query=yes']) {
      process.env.WEB_PUBLIC_ORIGIN = invalid;
      assert.equal(request({ method: 'POST', headers }).status, 503);
    }
  } finally {
    if (previous === undefined) delete process.env.WEB_PUBLIC_ORIGIN;
    else process.env.WEB_PUBLIC_ORIGIN = previous;
  }
});


test('authenticated health reports storage readiness and mutation audit excludes request contents', async () => {
  const { handleApi } = await import('../web_api.js');
  const response = { status: null, writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
  await handleApi({ method: 'GET', headers: { authorization: auth } }, response, new URL('http://localhost/api/health'));
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).data.storage.ready, true);
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args);
  try {
    const req = { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, socket: { remoteAddress: 'audit' } };
    const res = new EventEmitter();
    res.setHeader = () => {};
    res.statusCode = 400;
    assert.equal(protectWebRequest(req, res, new URL('http://localhost/api/test?secret=private')), true);
    assert.equal(protectWebRequest(req, res, new URL('http://localhost/api/test?secret=private')), true);
    res.emit('finish');
    assert.equal(logs.length, 1);
    assert.ok(!JSON.stringify(logs).includes('private'));
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(path.join(scratch, '.x-research.sqlite'));
    const row = db.prepare('SELECT * FROM owner_request_audit WHERE request_id = ?').get(req.webRequestId);
    assert.ok(row);
    assert.equal(row.actor, 'owner');
    assert.equal(row.route, '/api/test');
    db.close();
  } finally { console.log = originalLog; }
});

test('stale draft save is rejected with conflict and preserves current text', async () => {
  const store = await import('../store.js');
  const { handleApi } = await import('../web_api.js');
  const key = 'https://x.com/testowner/status/2099000000000000000';
  store.upsertCandidates([{ key, source: 'x', title: 'Source', text: 'Developer tooling source', url: key, timestamp: Date.now() }]);
  const original = store.saveDraft({ candidateKey: key, body: 'Original text', status: 'draft' });
  const current = store.saveDraft({ ...original, body: 'Newer owner edit' }, { expectedUpdatedAt: original.updatedAt });
  const req = { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ body: 'Stale replacement', expectedUpdatedAt: original.updatedAt })); } };
  const res = { writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
  await handleApi(req, res, new URL(`http://localhost/api/drafts/${current.id}/save`));
  assert.equal(res.status, 409);
  assert.equal(JSON.parse(res.body).code, 'DRAFT_CONFLICT');
  assert.equal(store.getDraft(current.id).body, 'Newer owner edit');
});

for (const action of ['save', 'thread-parts']) test(`draft ${action} rolls back when routing validation fails after persistence`, async () => {
  const store = await import('../store.js');
  const { handleApi } = await import('../web_api.js');
  const key = `https://example.invalid/qa-${action}-atomic`;
  const pipeline = action === 'thread-parts' ? 'thread' : 'original';
  store.upsertCandidates([{ key, source: 'x', title: 'QA fixture', text: 'Node.js TypeScript developer runtime API engineering', url: key, timestamp: Date.now() }]);
  const draft = store.saveDraft({ candidateKey: key, body: 'Original draft', threadParts: pipeline === 'thread' ? ['First part', 'Second part'] : [], status: 'draft' });
  store.ensureQueueItem(key);
  store.saveQueueItem({ candidateKey: key, draftId: draft.id, pipeline, status: 'drafting', behavior: {
    decision: 'ACT', primaryPurpose: 'technical_value', socialMode: 'explainer',
    informationDepth: 'invalid_legacy_depth', affectStrategy: 'neutral', affectProvenance: 'none',
    reasonToExist: 'Explain transaction durability.',
  } });
  const request = { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, async *[Symbol.asyncIterator]() {
    yield Buffer.from(JSON.stringify({ body: 'Must not persist a rejected save', op: 'add', expectedUpdatedAt: draft.updatedAt }));
  } };
  const response = { writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
  await handleApi(request, response, new URL(`http://localhost/api/drafts/${draft.id}/${action}`));
  assert.equal(response.status, 400);
  assert.match(JSON.parse(response.body).message, /behavior decision/);
  assert.equal(store.getDraft(draft.id).body, draft.body);
  assert.deepEqual(store.getDraft(draft.id).threadParts, draft.threadParts);
  assert.equal(store.getDraft(draft.id).updatedAt, draft.updatedAt);
});
