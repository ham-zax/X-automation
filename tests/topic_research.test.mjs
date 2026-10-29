import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectTopicResearch, getTopicCollection } from '../topic_research.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(os.tmpdir(), 'xgrowth-topic-research-'));

after(async () => {
  await rm(scratch, { recursive: true, force: true });
});

const HOUR = 60 * 60 * 1000;
const WINDOW = 48 * HOUR;
const NOW = Date.parse('2026-10-28T12:00:00.000Z');
const iso = (offset) => new Date(NOW + offset).toISOString();

function rootFor(name) {
  return path.join(scratch, name, 'research', 'topics');
}

function observedPost(id, overrides = {}) {
  return {
    id,
    author: 'builder',
    text: `post ${id}`,
    at: iso(-HOUR),
    url: `https://x.com/builder/status/${id}`,
    inReplyTo: null,
    likes: 3,
    replies: 1,
    reposts: 2,
    views: 100,
    ...overrides,
  };
}

function fakeReader({ search, replies } = {}) {
  const calls = [];
  const read = async (request, options) => {
    calls.push({ request, options });
    if (request.kind === 'search') return search;
    if (request.kind === 'replies') return replies;
    throw new Error(`Unexpected read kind: ${request.kind}`);
  };
  return { calls, read };
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

test('collects one bounded Top search inside the exact 48-hour window', async () => {
  const root = rootFor('window');
  const reader = fakeReader({
    search: {
      ok: true,
      kind: 'search',
      posts: [
        observedPost('10001', { at: iso(-WINDOW), likes: 0, replies: null, reposts: 7, views: 0 }),
        observedPost('10002', { at: iso(-WINDOW - 1) }),
        observedPost('10003', { at: iso(0) }),
        observedPost('10004', { at: iso(1) }),
        observedPost('10005', { at: iso(-2 * HOUR) }),
        observedPost('10006'),
      ],
    },
  });

  const saved = await collectTopicResearch(
    { topic: 'Rust CLI', query: '  rust   cli ', limit: 4 },
    { reader: reader.read, readerOptions: { marker: 'test' }, rootDir: root, now: NOW },
  );

  assert.equal(saved.ok, true);
  assert.equal(saved.saved, true);
  assert.deepEqual(reader.calls, [{
    request: { kind: 'search', query: 'rust cli since:2026-10-26', mode: 'top', limit: 40 },
    options: { marker: 'test' },
  }]);
  assert.deepEqual(saved.collection.posts.map((post) => post.id), ['10001', '10003', '10005', '10006']);
  assert.deepEqual(saved.collection.posts.map((post) => post.rank), [1, 3, 5, 6]);
  assert.deepEqual(
    {
      likes: saved.collection.posts[0].likes,
      replies: saved.collection.posts[0].replies,
      reposts: saved.collection.posts[0].reposts,
      views: saved.collection.posts[0].views,
    },
    { likes: 0, replies: null, reposts: 7, views: 0 },
  );
  assert.equal(saved.collection.posts[1].at, iso(0));
  assert.equal(saved.collection.posts[1].url, 'https://x.com/builder/status/10003');
  assert.equal(saved.collection.schemaVersion, 1);
  assert.equal(saved.collection.topic, 'Rust CLI');
  assert.equal(saved.collection.query, 'rust cli');
  assert.equal(saved.collection.mode, 'top');
  assert.equal(saved.collection.capturedAt, NOW);
  assert.equal(saved.collection.windowStartAt, NOW - WINDOW);
  assert.equal(saved.collection.expiresAt, NOW + WINDOW);
  assert.equal(saved.collection.partial, false);
  assert.deepEqual(saved.collection.errors, []);
  assert.match(saved.collection.note, /bounded Top search sample/i);
  assert.match(saved.collection.note, /untrusted data/i);
  assert.match(saved.id, /^2026-10-28-rust-cli-[0-9a-f-]{36}$/);
  assert.equal(saved.path, path.join(root, saved.id, 'posts.json'));
  assert.deepEqual(JSON.parse(await readFile(saved.path, 'utf8')), saved.collection);
  assert.equal((await stat(saved.path)).mode & 0o777, 0o600);
  assert.equal((await stat(path.dirname(saved.path))).mode & 0o777, 0o700);
});

test('deduplicates IDs, rejects invalid identity and text and respects the limit', async () => {
  const root = rootFor('filters');
  const reader = fakeReader({
    search: {
      ok: true,
      posts: [
        observedPost('20001'),
        observedPost('20001', { text: 'duplicate' }),
        observedPost('20002', { author: 'Bad Handle!' }),
        observedPost('not-a-number'),
        observedPost('20003', { text: '   ' }),
        observedPost('20004', { text: 'x'.repeat(10_001) }),
        observedPost('20005', { at: null }),
        observedPost('20006'),
        observedPost('20007'),
        observedPost('20008', { author: '@Mixed_Case' }),
        observedPost('20009'),
      ],
    },
  });

  const saved = await collectTopicResearch(
    { topic: 'Filters', query: 'filters', limit: 4 },
    { reader: reader.read, rootDir: root, now: NOW },
  );

  assert.deepEqual(saved.collection.posts.map((post) => post.id), ['20001', '20006', '20007', '20008']);
  assert.deepEqual(saved.collection.posts.map((post) => post.rank), [1, 8, 9, 10]);
  assert.equal(saved.collection.posts[3].author, 'Mixed_Case');
  assert.equal(saved.collection.posts[3].url, 'https://x.com/mixed_case/status/20008');
});

test('adds one exact-parent Top reply sample with target context', async () => {
  const root = rootFor('replies');
  const parent = '123456789012345';
  const reader = fakeReader({
    search: { ok: true, posts: [observedPost('30001')] },
    replies: {
      ok: true,
      kind: 'replies',
      target: {
        id: parent,
        author: 'Root_Author',
        text: 'root post',
        at: iso(-72 * HOUR),
        likes: 1,
        replies: 2,
        reposts: 3,
        views: 4,
      },
      mode: 'Top',
      observedAt: NOW,
      count: 6,
      posts: [
        observedPost('30002', { inReplyTo: parent }),
        observedPost('30003', { inReplyTo: '999999999999999' }),
        observedPost('30002', { inReplyTo: parent, text: 'duplicate' }),
        observedPost('30004', { inReplyTo: parent, at: iso(1) }),
        observedPost('30005', { inReplyTo: parent, text: '   ' }),
        observedPost('30006', { inReplyTo: parent, at: iso(-HOUR) }),
      ],
      note: 'bounded upstream note',
    },
  });

  const saved = await collectTopicResearch(
    { topic: 'Replies', query: 'replies', replyToId: parent },
    { reader: reader.read, rootDir: root, now: NOW },
  );

  assert.equal(reader.calls.length, 2);
  assert.deepEqual(reader.calls[1].request, { kind: 'replies', id: parent, mode: 'top', limit: 20 });
  assert.deepEqual(saved.collection.posts.map((post) => post.id), ['30001']);
  const sample = saved.collection.replySample;
  assert.deepEqual(sample.posts.map((post) => post.id), ['30002', '30006']);
  assert.equal(sample.count, 2);
  assert.equal(sample.replyToId, parent);
  assert.equal(sample.mode, 'top');
  assert.equal(sample.target.id, parent);
  assert.equal(sample.target.author, 'Root_Author');
  assert.equal(sample.target.text, 'root post');
  assert.equal(sample.target.at, iso(-72 * HOUR));
  assert.equal(sample.target.url, `https://x.com/root_author/status/${parent}`);
  assert.match(sample.note, /bounded Top reply sample/i);
  assert.match(sample.note, /not proof of absence/i);
  assert.match(sample.note, /untrusted data/i);
  assert.equal(saved.collection.partial, false);
  assert.deepEqual(saved.collection.errors, []);
});

test('marks a failed reply read partial and still saves the topic sample', async () => {
  const root = rootFor('partial');
  const reader = fakeReader({
    search: { ok: true, posts: [observedPost('40001')] },
    replies: { ok: false, fallback: 'browser', reason: 'HTTP 503: service unavailable' },
  });

  const saved = await collectTopicResearch(
    { topic: 'Partial', query: 'partial', replyToId: '987654321098765' },
    { reader: reader.read, rootDir: root, now: NOW },
  );

  assert.equal(saved.ok, true);
  assert.equal(saved.saved, true);
  assert.equal(saved.collection.partial, true);
  assert.deepEqual(saved.collection.errors, [{ source: 'replies', reason: 'HTTP 503: service unavailable' }]);
  assert.equal(saved.collection.replySample, undefined);
  assert.deepEqual(saved.collection.posts.map((post) => post.id), ['40001']);
  assert.ok((await stat(saved.path)).isFile());

  const thrown = await collectTopicResearch(
    { topic: 'Thrown', query: 'thrown', replyToId: '987654321098766' },
    {
      reader: async (request) => {
        if (request.kind === 'replies') throw new Error('z'.repeat(500));
        return { ok: true, posts: [observedPost('40002')] };
      },
      rootDir: root,
      now: NOW,
    },
  );
  assert.equal(thrown.collection.partial, true);
  assert.equal(thrown.collection.errors[0].source, 'replies');
  assert.equal(thrown.collection.errors[0].reason.length, 300);
  assert.deepEqual(thrown.collection.posts.map((post) => post.id), ['40002']);
});

test('a failed primary search saves nothing', async () => {
  const root = rootFor('primary-failure');
  const reader = fakeReader({
    search: { ok: false, fallback: 'browser', reason: 'HTTP 404: Not Found' },
  });

  const failed = await collectTopicResearch(
    { topic: 'Missing', query: 'missing' },
    { reader: reader.read, rootDir: root, now: NOW },
  );

  assert.deepEqual(failed, { ok: false, saved: false, reason: 'HTTP 404: Not Found' });
  assert.equal(reader.calls.length, 1);
  assert.equal(await pathExists(root), false);

  const thrown = await collectTopicResearch(
    { topic: 'Missing', query: 'missing' },
    {
      reader: async () => { throw new Error('y'.repeat(500)); },
      rootDir: root,
      now: NOW,
    },
  );
  assert.equal(thrown.ok, false);
  assert.equal(thrown.saved, false);
  assert.equal(thrown.reason.length, 300);
  assert.equal(await pathExists(root), false);
});

test('a storage failure does not claim a saved collection', async () => {
  const blockedRoot = path.join(scratch, 'blocked-root');
  await writeFile(blockedRoot, 'not a directory');
  const reader = fakeReader({ search: { ok: true, posts: [observedPost('50001')] } });

  const failed = await collectTopicResearch(
    { topic: 'Blocked', query: 'blocked' },
    { reader: reader.read, rootDir: blockedRoot, now: NOW },
  );

  assert.equal(failed.ok, false);
  assert.equal(failed.saved, false);
  assert.match(failed.reason, /EEXIST|exist|directory/i);
  assert.equal((await stat(blockedRoot)).isFile(), true);
});

test('repeated payloads create independent immutable collections and safe slugs', async () => {
  const root = rootFor('immutable');
  const firstReader = fakeReader({ search: { ok: true, posts: [observedPost('50011')] } });
  const secondReader = fakeReader({ search: { ok: true, posts: [observedPost('50012')] } });

  const first = await collectTopicResearch(
    { topic: 'Same Topic', query: 'same' },
    { reader: firstReader.read, rootDir: root, now: NOW },
  );
  const second = await collectTopicResearch(
    { topic: 'Same Topic', query: 'same' },
    { reader: secondReader.read, rootDir: root, now: NOW },
  );

  assert.notEqual(first.id, second.id);
  assert.notEqual(first.path, second.path);
  assert.deepEqual(JSON.parse(await readFile(first.path, 'utf8')).posts.map((post) => post.id), ['50011']);
  assert.deepEqual(JSON.parse(await readFile(second.path, 'utf8')).posts.map((post) => post.id), ['50012']);
  const firstRead = await getTopicCollection(first.id, { rootDir: root, now: NOW });
  assert.equal(firstRead.collection.posts[0].id, '50011');

  const fallbackReader = fakeReader({ search: { ok: true, posts: [observedPost('50013')] } });
  const fallback = await collectTopicResearch(
    { topic: '!!!', query: 'fallback' },
    { reader: fallbackReader.read, rootDir: root, now: NOW },
  );
  assert.match(fallback.id, /^2026-10-28-topic-[0-9a-f-]{36}$/);

  const longReader = fakeReader({ search: { ok: true, posts: [observedPost('50014')] } });
  const long = await collectTopicResearch(
    { topic: 'a'.repeat(80), query: 'long' },
    { reader: longReader.read, rootDir: root, now: NOW },
  );
  assert.match(long.id, /^2026-10-28-a{48}-[0-9a-f-]{36}$/);
});

test('rejects malformed payloads before any reader call', async () => {
  const root = rootFor('validation');
  const reader = fakeReader({ search: { ok: true, posts: [] } });
  const cases = [
    [null, /JSON object payload/],
    [[], /JSON object payload/],
    [{}, /requires a topic/],
    [{ topic: '   ', query: 'x' }, /requires a topic/],
    [{ topic: 'a'.repeat(121), query: 'x' }, /requires a topic/],
    [{ topic: 'x' }, /requires a query/],
    [{ topic: 'x', query: '   ' }, /requires a query/],
    [{ topic: 'x', query: 'a'.repeat(241) }, /requires a query/],
    [{ topic: 'x', query: 'y', limit: 0 }, /limit/],
    [{ topic: 'x', query: 'y', limit: 31 }, /limit/],
    [{ topic: 'x', query: 'y', limit: 1.5 }, /limit/],
    [{ topic: 'x', query: 'y', limit: '5' }, /limit/],
    [{ topic: 'x', query: 'y', replyToId: '1234' }, /replyToId/],
    [{ topic: 'x', query: 'y', replyToId: '1'.repeat(26) }, /replyToId/],
    [{ topic: 'x', query: 'y', replyToId: 12345 }, /replyToId/],
  ];

  for (const [payload, expected] of cases) {
    await assert.rejects(
      collectTopicResearch(payload, { reader: reader.read, rootDir: root, now: NOW }),
      expected,
    );
  }
  await assert.rejects(
    collectTopicResearch({ topic: 'x', query: 'y' }, { reader: reader.read, rootDir: root, now: 0 }),
    /positive safe timestamp/,
  );
  assert.equal(reader.calls.length, 0);
  assert.equal(await pathExists(root), false);
});

test('reads one collection locally, computes expiry and preserves expired evidence', async () => {
  const root = rootFor('readback');
  const reader = fakeReader({
    search: { ok: true, posts: [observedPost('60001'), observedPost('60002')] },
  });
  const saved = await collectTopicResearch(
    { topic: 'Readback', query: 'readback' },
    { reader: reader.read, rootDir: root, now: NOW },
  );

  const fresh = await getTopicCollection(saved.id, { rootDir: root, now: NOW + 1 });
  assert.deepEqual(fresh.collection, saved.collection);
  assert.equal(fresh.expired, false);

  const lastMoment = await getTopicCollection(saved.id, { rootDir: root, now: NOW + WINDOW - 1 });
  assert.equal(lastMoment.expired, false);

  const atExpiry = await getTopicCollection(saved.id, { rootDir: root, now: NOW + WINDOW });
  assert.equal(atExpiry.expired, true);
  assert.deepEqual(atExpiry.collection.posts.map((post) => post.id), ['60001', '60002']);

  const later = await getTopicCollection(saved.id, { rootDir: root, now: NOW + 30 * 24 * HOUR });
  assert.equal(later.expired, true);
  assert.equal(later.collection.posts.length, 2);
});

test('refuses unsafe IDs, missing collections, malformed artifacts and oversize files', async () => {
  const root = rootFor('rejects');
  const fixture = (slug) => `2026-10-28-${slug}-123e4567-e89b-42d3-a456-426614174000`;

  for (const bad of [
    undefined,
    '',
    '   ',
    '../../etc/passwd',
    '2026-10-28-topic-../../x',
    '/tmp/passwd',
    '2026-10-28-topic-1234',
    '2026-13-40-topic-123e4567-e89b-42d3-a456-426614174000',
  ]) {
    await assert.rejects(
      getTopicCollection(bad, { rootDir: root, now: NOW }),
      /requires a collection id|Invalid topic collection id/,
    );
  }
  await assert.rejects(
    getTopicCollection(fixture('missing'), { rootDir: root, now: NOW }),
    /No topic collection found/,
  );

  const invalidJsonId = fixture('invalidjson');
  await mkdir(path.join(root, invalidJsonId), { recursive: true });
  await writeFile(path.join(root, invalidJsonId, 'posts.json'), '{');

  const schemaId = fixture('schema');
  await mkdir(path.join(root, schemaId), { recursive: true });
  await writeFile(path.join(root, schemaId, 'posts.json'), JSON.stringify({ schemaVersion: 2, id: schemaId }));

  const postsId = fixture('posts');
  await mkdir(path.join(root, postsId), { recursive: true });
  await writeFile(path.join(root, postsId, 'posts.json'), JSON.stringify({
    schemaVersion: 1,
    id: postsId,
    topic: 'x',
    query: 'x',
    mode: 'top',
    capturedAt: NOW,
    windowStartAt: NOW - WINDOW,
    expiresAt: NOW + WINDOW,
    posts: [{}],
    partial: false,
    errors: [],
    note: 'note',
  }));

  const largeId = fixture('large');
  await mkdir(path.join(root, largeId), { recursive: true });
  await writeFile(path.join(root, largeId, 'posts.json'), 'x'.repeat(1024 * 1024 + 1));

  await assert.rejects(getTopicCollection(invalidJsonId, { rootDir: root, now: NOW }), /not valid JSON/);
  await assert.rejects(getTopicCollection(schemaId, { rootDir: root, now: NOW }), /malformed/);
  await assert.rejects(getTopicCollection(postsId, { rootDir: root, now: NOW }), /malformed/);
  await assert.rejects(getTopicCollection(largeId, { rootDir: root, now: NOW }), /exceeds 1 MiB/);
});

test('real bridge reads a saved scratch collection and rejects malformed collect input', async () => {
  const cwd = path.join(scratch, 'bridge');
  const root = path.join(cwd, 'research', 'topics');
  const bridgeNow = Date.now();
  const reader = fakeReader({
    search: {
      ok: true,
      posts: [observedPost('70001', { at: new Date(bridgeNow - HOUR).toISOString() })],
    },
  });
  const saved = await collectTopicResearch(
    { topic: 'Bridge', query: 'bridge' },
    { reader: reader.read, rootDir: root, now: bridgeNow },
  );
  assert.equal(saved.ok, true);

  const readRun = spawnSync(process.execPath, [path.join(repo, 'agent_bridge.js'), 'topic-read'], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    input: JSON.stringify({ id: saved.id }),
    env: { ...process.env, X_ACCOUNT: 'ham_zax', AUTH_TOKEN: '' },
  });
  assert.equal(readRun.error, undefined);
  assert.equal(readRun.status, 0, readRun.stderr);
  const read = JSON.parse(readRun.stdout);
  assert.equal(read.collection.id, saved.id);
  assert.deepEqual(read.collection.posts.map((post) => post.id), ['70001']);
  assert.equal(read.expired, false);

  const badCwd = path.join(scratch, 'bridge-bad');
  await mkdir(badCwd, { recursive: true });

  const malformed = spawnSync(process.execPath, [path.join(repo, 'agent_bridge.js'), 'topic-collect'], {
    cwd: badCwd,
    encoding: 'utf8',
    timeout: 30_000,
    input: JSON.stringify({ topic: ' ', query: 'bridge' }),
    env: { ...process.env, X_ACCOUNT: 'ham_zax', AUTH_TOKEN: '' },
  });
  assert.equal(malformed.error, undefined);
  assert.notEqual(malformed.status, 0);
  const malformedError = JSON.parse(malformed.stderr.trim().split('\n').filter(Boolean).at(-1));
  assert.match(malformedError.error, /requires a topic/);

  const badReply = spawnSync(process.execPath, [path.join(repo, 'agent_bridge.js'), 'topic-collect'], {
    cwd: badCwd,
    encoding: 'utf8',
    timeout: 30_000,
    input: JSON.stringify({ topic: 'Bridge', query: 'bridge', replyToId: '1234' }),
    env: { ...process.env, X_ACCOUNT: 'ham_zax', AUTH_TOKEN: '' },
  });
  assert.equal(badReply.error, undefined);
  assert.notEqual(badReply.status, 0);
  const badReplyError = JSON.parse(badReply.stderr.trim().split('\n').filter(Boolean).at(-1));
  assert.match(badReplyError.error, /replyToId/);
  assert.equal(await pathExists(path.join(badCwd, 'research', 'topics')), false);
});
