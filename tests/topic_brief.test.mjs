import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectTopicResearch, getTopicBrief, saveTopicBrief } from '../topic_research.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(os.tmpdir(), 'xgrowth-topic-brief-'));

after(async () => {
  await rm(scratch, { recursive: true, force: true });
});

const HOUR = 60 * 60 * 1000;
const WINDOW = 48 * HOUR;
const NOW = Date.parse('2026-10-28T12:00:00.000Z');
const PARENT = '123456789012345';
const iso = (offset) => new Date(NOW + offset).toISOString();
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

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
  const read = async (request) => {
    calls.push(request);
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

async function makeCollection(root, { now = NOW, replyToId = null, posts } = {}) {
  const reader = fakeReader({
    search: {
      ok: true,
      posts: posts ?? [
        observedPost('10001', { at: new Date(now - HOUR).toISOString() }),
        observedPost('10002', {
          author: 'Other_Dev',
          text: 'second <post> *text*',
          at: new Date(now - 2 * HOUR).toISOString(),
        }),
      ],
    },
    replies: replyToId
      ? {
        ok: true,
        target: {
          id: PARENT,
          author: 'Root_Author',
          text: 'root <b>post</b>',
          at: iso(-72 * HOUR),
          likes: 1,
          replies: 2,
          reposts: 3,
          views: 4,
        },
        posts: [observedPost('10003', {
          inReplyTo: replyToId,
          author: 'reply_dev',
          text: 'reply text',
          at: new Date(now - 3 * HOUR).toISOString(),
        })],
      }
      : undefined,
  });
  const saved = await collectTopicResearch(
    { topic: 'Fixture Topic', query: 'fixture', ...(replyToId ? { replyToId } : {}) },
    { reader: reader.read, rootDir: root, now },
  );
  assert.equal(saved.ok, true, saved.reason);
  return saved;
}

function fixturePersona({
  version = 'fixture-persona-v1',
  experiences = ['Fixture owner experience: built a local search index.'],
  results = [{ summary: 'Fixture result: synthetic lookup stayed under 10 ms.' }],
  failures = ['Fixture failure: the first migration attempt dropped a column.'],
} = {}) {
  return {
    version,
    technicalProvenanceSandbox: {
      verifiedOwnerExperiences: experiences,
      verifiedResults: results,
      verifiedFailures: failures,
    },
  };
}

function payloadFor(collectionId, overrides = {}) {
  return {
    confirmRecord: true,
    collectionId,
    paragraphs: [{ kind: 'reported', text: 'Room report.', postIds: ['10001'] }],
    ...overrides,
  };
}

async function writeBriefFile(root, collectionId, briefId, content) {
  const directory = path.join(root, collectionId, 'briefs', briefId);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(
    path.join(directory, 'brief.json'),
    typeof content === 'string' ? content : JSON.stringify(content),
  );
}

async function listTree(root) {
  const entries = [];
  const walk = async (directory, prefix) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      entries.push(relative);
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
    }
  };
  if (await pathExists(root)) await walk(root, '');
  return entries.sort();
}

function runBridge(command, payload, cwd) {
  return spawnSync(process.execPath, [path.join(repo, 'agent_bridge.js'), command], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    input: JSON.stringify(payload),
    env: { ...process.env, X_ACCOUNT: 'ham_zax', AUTH_TOKEN: '' },
  });
}

test('saves numbered reported and take paragraphs with citations, escaping and collection expiry', async () => {
  const root = rootFor('save');
  const collection = await makeCollection(root, { replyToId: PARENT });
  const saved = await saveTopicBrief({
    confirmRecord: true,
    collectionId: collection.id,
    policy: 'Keep the room opinionated and cite every claim.',
    paragraphs: [
      { kind: 'reported', text: '  The room reports <fast> startup.  ', postIds: ['10001', '10002'] },
      { kind: 'take', text: 'My take: [click](javascript:alert(1)) is not evidence.', postIds: ['10003', PARENT] },
    ],
    roomJokes: [{ text: 'A joke with `code` and <b>tags</b>.', postIds: ['10002'] }],
    openQuestions: [{ text: 'Does the reply sample agree?', postIds: ['10003'] }],
  }, { rootDir: root, now: NOW + HOUR });

  assert.equal(saved.ok, true);
  assert.equal(saved.saved, true);
  assert.equal(saved.id, saved.brief.id);
  assert.equal(saved.collectionId, collection.id);
  assert.match(saved.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(saved.path, path.join(root, collection.id, 'briefs', saved.id, 'brief.json'));

  const brief = saved.brief;
  assert.equal(brief.schemaVersion, 1);
  assert.equal(brief.status, 'draft');
  assert.equal(brief.topic, 'Fixture Topic');
  assert.equal(brief.collectionId, collection.id);
  assert.equal(brief.sourceDigest, sha256(JSON.stringify(collection.collection)));
  assert.equal(brief.createdAt, NOW + HOUR);
  assert.equal(brief.expiresAt, collection.collection.expiresAt);
  assert.equal(brief.policy, 'Keep the room opinionated and cite every claim.');
  assert.deepEqual(brief.paragraphs.map((paragraph) => [paragraph.id, paragraph.kind]), [
    ['p1', 'reported'],
    ['p2', 'take'],
  ]);
  assert.equal(brief.paragraphs[0].text, 'The room reports <fast> startup.');
  assert.deepEqual(brief.paragraphs[0].postIds, ['10001', '10002']);
  assert.deepEqual(brief.paragraphs[1].postIds, ['10003', PARENT]);
  assert.equal(Object.prototype.hasOwnProperty.call(brief.paragraphs[0], 'personaEvidence'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(brief.paragraphs[1], 'personaEvidence'), false);
  assert.deepEqual(brief.citations.map((citation) => citation.id), ['10001', '10002', '10003', PARENT]);
  assert.deepEqual(brief.citations[2], {
    id: '10003',
    author: 'reply_dev',
    url: 'https://x.com/reply_dev/status/10003',
    at: new Date(NOW - 3 * HOUR).toISOString(),
  });
  assert.deepEqual(brief.citations[3], {
    id: PARENT,
    author: 'Root_Author',
    url: `https://x.com/root_author/status/${PARENT}`,
    at: iso(-72 * HOUR),
  });
  assert.deepEqual(brief.roomJokes, [{ text: 'A joke with `code` and <b>tags</b>.', postIds: ['10002'] }]);
  assert.deepEqual(brief.openQuestions, [{ text: 'Does the reply sample agree?', postIds: ['10003'] }]);

  const briefDirectory = path.dirname(saved.path);
  assert.equal((await stat(saved.path)).mode & 0o777, 0o600);
  assert.equal((await stat(path.join(briefDirectory, 'brief.md'))).mode & 0o777, 0o600);
  assert.equal((await stat(briefDirectory)).mode & 0o777, 0o700);
  assert.equal((await stat(path.dirname(briefDirectory))).mode & 0o777, 0o700);

  const markdown = await readFile(path.join(briefDirectory, 'brief.md'), 'utf8');
  assert.equal(markdown, saved.markdown);
  assert.match(markdown, /Draft research only/);
  assert.match(markdown, /## 1\. Reported \(p1\)/);
  assert.match(markdown, /## 2\. Take \(p2\)/);
  assert.match(markdown, /## Room jokes/);
  assert.match(markdown, /## Open questions/);
  assert.match(markdown, /The room reports &lt;fast&gt; startup\./);
  assert.match(markdown, /\\\[click\\\]\\\(javascript:alert\\\(1\\\)\\\)/);
  assert.match(markdown, /\[1\. @builder\]\(https:\/\/x\.com\/builder\/status\/10001\)/);
  assert.match(markdown, /\[4\. @Root_Author\]\(https:\/\/x\.com\/root_author\/status\/123456789012345\)/);
  assert.doesNotMatch(markdown, /<fast>/);
  assert.doesNotMatch(markdown, /\]\(javascript:/);

  const read = await getTopicBrief(
    { collectionId: collection.id, briefId: saved.id },
    { rootDir: root, now: NOW + 2 * HOUR, personaModel: fixturePersona() },
  );
  assert.deepEqual(read.brief, brief);
  assert.equal(read.markdown, saved.markdown);
  assert.equal(read.expired, false);
  assert.equal(read.sourceChanged, false);
  assert.equal(read.personaEvidenceCurrent, true);
});

test('rejects invalid save input before creating any files', async () => {
  const root = rootFor('invalid');
  const collection = await makeCollection(root);
  const id = collection.id;
  const paragraph = (overrides = {}) => ({ kind: 'reported', text: 'Room report.', postIds: ['10001'], ...overrides });
  const longText = (length) => 'x'.repeat(length);
  const cases = [
    ['non-object', null, /JSON object payload/],
    ['confirm false', payloadFor(id, { confirmRecord: false }), /confirmRecord=true/],
    ['confirm missing', { collectionId: id, paragraphs: [paragraph()] }, /confirmRecord=true/],
    ['collection missing', { confirmRecord: true, paragraphs: [paragraph()] }, /requires a collection id/],
    ['collection unsafe', payloadFor('../escape'), /Invalid topic collection id/],
    ['paragraphs missing', { confirmRecord: true, collectionId: id }, /1-30 paragraphs/],
    ['paragraphs empty', payloadFor(id, { paragraphs: [] }), /1-30 paragraphs/],
    ['paragraphs too many', payloadFor(id, { paragraphs: Array.from({ length: 31 }, () => paragraph()) }), /1-30 paragraphs/],
    ['paragraph not object', payloadFor(id, { paragraphs: ['text'] }), /paragraph 1 must be an object/],
    ['paragraph id', payloadFor(id, { paragraphs: [paragraph({ id: 'p1' })] }), /must not supply id/],
    ['paragraph unknown field', payloadFor(id, { paragraphs: [paragraph({ note: 'x' })] }), /unsupported fields/],
    ['paragraph kind', payloadFor(id, { paragraphs: [paragraph({ kind: 'opinion' })] }), /kind must be reported, tested or take/],
    ['paragraph blank', payloadFor(id, { paragraphs: [paragraph({ text: '   ' })] }), /text must be 1-4000 characters/],
    ['paragraph long', payloadFor(id, { paragraphs: [paragraph({ text: longText(4001) })] }), /text must be 1-4000 characters/],
    ['postIds missing', payloadFor(id, { paragraphs: [paragraph({ postIds: undefined })] }), /requires 1-10 postIds/],
    ['postIds empty', payloadFor(id, { paragraphs: [paragraph({ postIds: [] })] }), /requires 1-10 postIds/],
    ['postIds too many', payloadFor(id, { paragraphs: [paragraph({ postIds: Array.from({ length: 11 }, (_, index) => String(10001 + index)) })] }), /requires 1-10 postIds/],
    ['postIds duplicate', payloadFor(id, { paragraphs: [paragraph({ postIds: ['10001', '10001'] })] }), /must be unique/],
    ['postIds nonnumeric', payloadFor(id, { paragraphs: [paragraph({ postIds: ['abc'] })] }), /must be numeric post ids/],
    ['postIds unknown', payloadFor(id, { paragraphs: [paragraph({ postIds: ['99999'] })] }), /not in collection/],
    ['tested missing evidence', payloadFor(id, { paragraphs: [paragraph({ kind: 'tested' })] }), /requires personaEvidence/],
    ['reported with evidence', payloadFor(id, { paragraphs: [paragraph({ personaEvidence: [{ field: 'verifiedResults', index: 0 }] })] }), /must not take personaEvidence/],
    ['evidence field', payloadFor(id, { paragraphs: [paragraph({ kind: 'tested', personaEvidence: [{ field: 'verifiedProjects', index: 0 }] })] }), /field must be one of/],
    ['evidence index negative', payloadFor(id, { paragraphs: [paragraph({ kind: 'tested', personaEvidence: [{ field: 'verifiedResults', index: -1 }] })] }), /non-negative integer/],
    ['evidence index float', payloadFor(id, { paragraphs: [paragraph({ kind: 'tested', personaEvidence: [{ field: 'verifiedResults', index: 1.5 }] })] }), /non-negative integer/],
    ['evidence missing entry', payloadFor(id, { paragraphs: [paragraph({ kind: 'tested', personaEvidence: [{ field: 'verifiedResults', index: 4 }] })] }), /missing persona evidence/],
    ['evidence payload text', payloadFor(id, { paragraphs: [paragraph({ kind: 'tested', personaEvidence: [{ field: 'verifiedResults', index: 0, text: 'I did this.' }] })] }), /takes \{field,index\} references only/],
    ['policy blank', payloadFor(id, { policy: '   ' }), /policy must be 1-2000 characters/],
    ['policy long', payloadFor(id, { policy: longText(2001) }), /policy must be 1-2000 characters/],
    ['roomJokes type', payloadFor(id, { roomJokes: 'joke' }), /roomJokes must be an array/],
    ['roomJokes too many', payloadFor(id, { roomJokes: Array.from({ length: 11 }, () => ({ text: 'joke', postIds: ['10001'] })) }), /at most 10 entries/],
    ['roomJokes entry keys', payloadFor(id, { roomJokes: [{ text: 'joke', postIds: ['10001'], extra: true }] }), /takes \{text,postIds\} only/],
    ['roomJokes blank', payloadFor(id, { roomJokes: [{ text: ' ', postIds: ['10001'] }] }), /text must be 1-500 characters/],
    ['roomJokes long', payloadFor(id, { roomJokes: [{ text: longText(501), postIds: ['10001'] }] }), /text must be 1-500 characters/],
    ['roomJokes source', payloadFor(id, { roomJokes: [{ text: 'joke', postIds: ['99999'] }] }), /not in collection/],
    ['openQuestions type', payloadFor(id, { openQuestions: [{ text: 'why?', postIds: ['10001'], extra: true }] }), /takes \{text,postIds\} only/],
    ['openQuestions blank', payloadFor(id, { openQuestions: [{ text: '  ', postIds: ['10001'] }] }), /text must be 1-500 characters/],
    ['openQuestions source', payloadFor(id, { openQuestions: [{ text: 'why?', postIds: ['99999'] }] }), /not in collection/],
  ];

  for (const [label, bad, expected] of cases) {
    await assert.rejects(
      saveTopicBrief(bad, { rootDir: root, now: NOW + HOUR, personaModel: fixturePersona() }),
      expected,
      label,
    );
  }
  await assert.rejects(
    saveTopicBrief(
      payloadFor(id, { paragraphs: [paragraph({ kind: 'tested', personaEvidence: [{ field: 'verifiedOwnerExperiences', index: 0 }] })] }),
      { rootDir: root, now: NOW + HOUR, personaModel: fixturePersona({ experiences: [] }) },
    ),
    /missing persona evidence/,
  );
  await assert.rejects(
    saveTopicBrief(payloadFor(id), { rootDir: root, now: 0 }),
    /positive safe timestamp/,
  );
  assert.equal(await pathExists(path.join(root, id, 'briefs')), false);
});

test('tested paragraphs resolve only existing approved persona evidence', async () => {
  const root = rootFor('tested');
  const collection = await makeCollection(root);
  const persona = fixturePersona();
  const entry = persona.technicalProvenanceSandbox.verifiedResults[0];

  const saved = await saveTopicBrief({
    confirmRecord: true,
    collectionId: collection.id,
    paragraphs: [
      { kind: 'reported', text: 'The room reports a result.', postIds: ['10001'] },
      {
        kind: 'tested',
        text: 'A fixture result supports this claim.',
        postIds: ['10002'],
        personaEvidence: [{ field: 'verifiedResults', index: 0 }],
      },
    ],
  }, { rootDir: root, now: NOW + HOUR, personaModel: persona });

  assert.deepEqual(saved.brief.paragraphs[1].personaEvidence, [{
    field: 'verifiedResults',
    index: 0,
    personaVersion: 'fixture-persona-v1',
    entryDigest: sha256(JSON.stringify(entry)),
  }]);
  assert.equal(Object.prototype.hasOwnProperty.call(saved.brief.paragraphs[0], 'personaEvidence'), false);

  const current = await getTopicBrief(
    { collectionId: collection.id, briefId: saved.id },
    { rootDir: root, now: NOW + HOUR, personaModel: persona },
  );
  assert.equal(current.personaEvidenceCurrent, true);
  assert.deepEqual(current.brief, saved.brief);

  const changed = await getTopicBrief(
    { collectionId: collection.id, briefId: saved.id },
    {
      rootDir: root,
      now: NOW + HOUR,
      personaModel: fixturePersona({ results: [{ summary: 'Changed fixture result.' }] }),
    },
  );
  assert.equal(changed.personaEvidenceCurrent, false);
  assert.deepEqual(changed.brief, saved.brief);
  assert.match(changed.markdown, /Persona evidence: verifiedResults\[0\] \(persona fixture-persona-v1\)/);
});

test('successive saves are immutable and keep the collection expiry', async () => {
  const root = rootFor('immutable');
  const collection = await makeCollection(root);
  const payload = payloadFor(collection.id);

  const first = await saveTopicBrief(payload, { rootDir: root, now: NOW + HOUR, personaModel: fixturePersona() });
  const firstJson = await readFile(first.path);
  const firstMarkdown = await readFile(path.join(path.dirname(first.path), 'brief.md'));
  const collectionJson = await readFile(path.join(root, collection.id, 'posts.json'));

  const second = await saveTopicBrief(payload, { rootDir: root, now: NOW + 2 * HOUR, personaModel: fixturePersona() });

  assert.notEqual(first.id, second.id);
  assert.equal(first.brief.expiresAt, collection.collection.expiresAt);
  assert.equal(second.brief.expiresAt, collection.collection.expiresAt);
  assert.equal(second.brief.createdAt, NOW + 2 * HOUR);
  assert.deepEqual(second.brief.paragraphs.map((paragraph) => paragraph.id), ['p1']);
  assert.deepEqual(await readFile(first.path), firstJson);
  assert.deepEqual(await readFile(path.join(path.dirname(first.path), 'brief.md')), firstMarkdown);
  assert.deepEqual(await readFile(path.join(root, collection.id, 'posts.json')), collectionJson);
  assert.deepEqual(
    (await readdir(path.join(root, collection.id, 'briefs'))).sort(),
    [first.id, second.id].sort(),
  );
});

test('refuses expired and future-captured collections without writing', async () => {
  const root = rootFor('expiry-save');
  const collection = await makeCollection(root);
  const payload = payloadFor(collection.id);
  const briefs = path.join(root, collection.id, 'briefs');

  await assert.rejects(
    saveTopicBrief(payload, { rootDir: root, now: NOW + WINDOW, personaModel: fixturePersona() }),
    /expired at .*; save a new collection/,
  );
  assert.equal(await pathExists(briefs), false);

  await assert.rejects(
    saveTopicBrief(payload, { rootDir: root, now: NOW - HOUR, personaModel: fixturePersona() }),
    /future capture time/,
  );
  assert.equal(await pathExists(briefs), false);
});

test('read rejects unsafe IDs, missing briefs, malformed shapes and oversize artifacts', async () => {
  const root = rootFor('read-rejects');
  const collection = await makeCollection(root);
  const saved = await saveTopicBrief(payloadFor(collection.id), {
    rootDir: root,
    now: NOW + HOUR,
    personaModel: fixturePersona(),
  });
  const fixtureId = (suffix) => `123e4567-e89b-42d3-a456-426614174${suffix}`;

  for (const [payload, expected] of [
    [null, /JSON object payload/],
    [{}, /requires a collection id/],
    [{ collectionId: '../escape', briefId: saved.id }, /Invalid topic collection id/],
    [{ collectionId: collection.id }, /requires a brief id/],
    [{ collectionId: collection.id, briefId: '..' }, /Invalid topic brief id/],
    [{ collectionId: collection.id, briefId: '123E4567-E89B-42D3-A456-426614174000' }, /Invalid topic brief id/],
    [{ collectionId: collection.id, briefId: '123e4567' }, /Invalid topic brief id/],
    [{ collectionId: collection.id, briefId: fixtureId('999') }, /No topic brief found/],
  ]) {
    await assert.rejects(getTopicBrief(payload, { rootDir: root, now: NOW + HOUR }), expected);
  }

  const clone = () => JSON.parse(JSON.stringify(saved.brief));
  const invalidJsonId = fixtureId('001');
  await writeBriefFile(root, collection.id, invalidJsonId, '{');
  await assert.rejects(
    getTopicBrief({ collectionId: collection.id, briefId: invalidJsonId }, { rootDir: root, now: NOW + HOUR }),
    /not valid JSON/,
  );

  const schema = clone();
  schema.id = fixtureId('002');
  schema.schemaVersion = 2;
  await writeBriefFile(root, collection.id, schema.id, schema);
  await assert.rejects(
    getTopicBrief({ collectionId: collection.id, briefId: schema.id }, { rootDir: root, now: NOW + HOUR }),
    /malformed/,
  );

  const numbering = clone();
  numbering.id = fixtureId('003');
  numbering.paragraphs = [
    { id: 'p2', kind: 'take', text: 'second', postIds: ['10001'] },
    { id: 'p1', kind: 'reported', text: 'first', postIds: ['10002'] },
  ];
  await writeBriefFile(root, collection.id, numbering.id, numbering);
  await assert.rejects(
    getTopicBrief({ collectionId: collection.id, briefId: numbering.id }, { rootDir: root, now: NOW + HOUR }),
    /malformed/,
  );

  const citation = clone();
  citation.id = fixtureId('004');
  citation.citations[0].url = 'https://evil.test/status/10001';
  await writeBriefFile(root, collection.id, citation.id, citation);
  await assert.rejects(
    getTopicBrief({ collectionId: collection.id, briefId: citation.id }, { rootDir: root, now: NOW + HOUR }),
    /malformed/,
  );

  const dangling = clone();
  dangling.id = fixtureId('005');
  dangling.paragraphs[0].postIds = ['99999'];
  await writeBriefFile(root, collection.id, dangling.id, dangling);
  await assert.rejects(
    getTopicBrief({ collectionId: collection.id, briefId: dangling.id }, { rootDir: root, now: NOW + HOUR }),
    /malformed/,
  );

  const oversizeId = fixtureId('006');
  await writeBriefFile(root, collection.id, oversizeId, 'x'.repeat(1024 * 1024 + 1));
  await assert.rejects(
    getTopicBrief({ collectionId: collection.id, briefId: oversizeId }, { rootDir: root, now: NOW + HOUR }),
    /exceeds 1 MiB/,
  );
});

test('historical briefs stay readable after expiry, source change and persona change', async () => {
  const root = rootFor('historical');
  const collection = await makeCollection(root);
  const persona = fixturePersona();
  const saved = await saveTopicBrief({
    confirmRecord: true,
    collectionId: collection.id,
    paragraphs: [
      { kind: 'reported', text: 'The room reports a result.', postIds: ['10001'] },
      {
        kind: 'tested',
        text: 'A fixture result supports this claim.',
        postIds: ['10002'],
        personaEvidence: [{ field: 'verifiedResults', index: 0 }],
      },
    ],
  }, { rootDir: root, now: NOW + HOUR, personaModel: persona });

  const fresh = await getTopicBrief(
    { collectionId: collection.id, briefId: saved.id },
    { rootDir: root, now: NOW + HOUR, personaModel: persona },
  );
  assert.equal(fresh.expired, false);
  assert.equal(fresh.sourceChanged, false);
  assert.equal(fresh.personaEvidenceCurrent, true);

  await writeFile(path.join(path.dirname(saved.path), 'brief.md'), 'EDITED DERIVED FILE\n');

  const expired = await getTopicBrief(
    { collectionId: collection.id, briefId: saved.id },
    { rootDir: root, now: NOW + WINDOW, personaModel: persona },
  );
  assert.equal(expired.expired, true);
  assert.equal(expired.markdown, fresh.markdown);
  assert.match(expired.markdown, /Draft research only/);
  assert.doesNotMatch(expired.markdown, /EDITED DERIVED FILE/);
  assert.deepEqual(expired.brief, saved.brief);

  const collectionFile = path.join(root, collection.id, 'posts.json');
  const stored = JSON.parse(await readFile(collectionFile, 'utf8'));
  stored.posts[0].likes = 999;
  await writeFile(collectionFile, `${JSON.stringify(stored, null, 2)}\n`);

  const sourceChanged = await getTopicBrief(
    { collectionId: collection.id, briefId: saved.id },
    { rootDir: root, now: NOW + HOUR, personaModel: persona },
  );
  assert.equal(sourceChanged.sourceChanged, true);
  assert.equal(sourceChanged.expired, false);
  assert.deepEqual(sourceChanged.brief, saved.brief);
  assert.equal(sourceChanged.markdown, fresh.markdown);

  const evidenceChanged = await getTopicBrief(
    { collectionId: collection.id, briefId: saved.id },
    {
      rootDir: root,
      now: NOW + HOUR,
      personaModel: fixturePersona({ results: [{ summary: 'Changed fixture result.' }] }),
    },
  );
  assert.equal(evidenceChanged.personaEvidenceCurrent, false);
  assert.deepEqual(evidenceChanged.brief, saved.brief);
  assert.match(evidenceChanged.markdown, /verifiedResults\[0\]/);
});

test('real bridge saves and reads a reported and take brief with dummy local data', async () => {
  const cwd = path.join(scratch, 'bridge');
  const root = path.join(cwd, 'research', 'topics');
  const bridgeNow = Date.now();
  const collection = await makeCollection(root, {
    now: bridgeNow,
    posts: [
      observedPost('80001', { at: new Date(bridgeNow - HOUR).toISOString() }),
      observedPost('80002', { at: new Date(bridgeNow - 2 * HOUR).toISOString() }),
    ],
  });
  const personaPath = path.join(repo, 'persona', 'hamza-v1.json');
  const personaBefore = await readFile(personaPath);

  const saveRun = runBridge('topic-brief-save', {
    confirmRecord: true,
    collectionId: collection.id,
    paragraphs: [
      { kind: 'reported', text: 'The room reports <fast> startup.', postIds: ['80001'] },
      { kind: 'take', text: 'My take: this is worth watching.', postIds: ['80002'] },
    ],
    roomJokes: [{ text: 'A dummy room joke.', postIds: ['80001'] }],
    openQuestions: [{ text: 'Will this hold?', postIds: ['80002'] }],
  }, cwd);
  assert.equal(saveRun.error, undefined);
  assert.equal(saveRun.status, 0, saveRun.stderr);
  const saved = JSON.parse(saveRun.stdout);
  assert.equal(saved.ok, true);
  assert.equal(saved.saved, true);
  assert.match(saved.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(saved.path, path.join(root, collection.id, 'briefs', saved.id, 'brief.json'));
  assert.equal(saved.brief.status, 'draft');
  assert.deepEqual(saved.brief.paragraphs.map((paragraph) => [paragraph.id, paragraph.kind]), [
    ['p1', 'reported'],
    ['p2', 'take'],
  ]);
  assert.equal(saved.brief.expiresAt, collection.collection.expiresAt);
  assert.match(saved.markdown, /&lt;fast&gt;/);
  assert.match(saved.markdown, /\[1\. @builder\]\(https:\/\/x\.com\/builder\/status\/80001\)/);
  assert.equal(Object.prototype.hasOwnProperty.call(saved.brief, 'humanApprovedAt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(saved.brief, 'queueItemId'), false);

  const readRun = runBridge('topic-brief-read', { collectionId: collection.id, briefId: saved.id }, cwd);
  assert.equal(readRun.error, undefined);
  assert.equal(readRun.status, 0, readRun.stderr);
  const read = JSON.parse(readRun.stdout);
  assert.deepEqual(Object.keys(read).sort(), [
    'brief', 'expired', 'markdown', 'personaEvidenceCurrent', 'sourceChanged',
  ]);
  assert.deepEqual(read.brief, saved.brief);
  assert.equal(read.markdown, saved.markdown);
  assert.equal(read.expired, false);
  assert.equal(read.sourceChanged, false);
  assert.equal(read.personaEvidenceCurrent, true);

  const briefsDir = path.join(root, collection.id, 'briefs');
  const briefsBefore = (await readdir(briefsDir)).sort();
  const malformed = runBridge('topic-brief-save', {
    collectionId: collection.id,
    paragraphs: [{ kind: 'reported', text: 'Room report.', postIds: ['80001'] }],
  }, cwd);
  assert.equal(malformed.error, undefined);
  assert.notEqual(malformed.status, 0);
  const malformedError = JSON.parse(malformed.stderr.trim().split('\n').filter(Boolean).at(-1));
  assert.match(malformedError.error, /confirmRecord=true/);
  assert.deepEqual((await readdir(briefsDir)).sort(), briefsBefore);

  assert.deepEqual(await readFile(personaPath), personaBefore);
  const tree = await listTree(cwd);
  const unexpected = tree.filter((entry) => (
    !entry.startsWith('research/topics/')
    && entry !== 'research'
    && entry !== 'research/topics'
    && !/^\.x-research\.sqlite($|-)/.test(entry)
  ));
  assert.deepEqual(unexpected, []);
});
