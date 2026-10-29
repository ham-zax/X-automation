// XR-20-C: explicit saved-brief paragraph citations for the external Writer
// commands and confirmed act events. Fixtures use disposable state only.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const originalCwd = process.cwd();
const scratch = await mkdtemp(path.join(os.tmpdir(), 'xgrowth-topic-citation-'));
process.chdir(scratch);

const topicResearch = await import(pathToFileURL(path.join(REPO, 'topic_research.js')).href);
const drafting = await import(pathToFileURL(path.join(REPO, 'drafting.js')).href);
const act = await import(pathToFileURL(path.join(REPO, 'act.js')).href);
const store = await import(pathToFileURL(path.join(REPO, 'store.js')).href);

after(async () => {
  process.chdir(originalCwd);
  await rm(scratch, { recursive: true, force: true });
});

const HOUR = 60 * 60 * 1000;
const WINDOW = 48 * HOUR;
const NOW = Date.parse('2026-10-28T12:00:00.000Z');
const TARGET = 'devbuilder';
const TARGET_TWEET = '1900000000000003001';
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const iso = (offset) => new Date(NOW + offset).toISOString();

function rootFor(name) {
  return path.join(scratch, 'unit', name, 'research', 'topics');
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

async function makeCollection(rootDir, { now = NOW, posts } = {}) {
  const reader = {
    async read(request) {
      if (request.kind !== 'search') throw new Error(`Unexpected read kind: ${request.kind}`);
      return {
        ok: true,
        posts: posts ?? [
          observedPost('90001', { at: new Date(now - HOUR).toISOString() }),
          observedPost('90002', { author: 'Other_Dev', at: new Date(now - 2 * HOUR).toISOString() }),
          observedPost('90003', { at: new Date(now - 3 * HOUR).toISOString() }),
          observedPost('90004', { at: new Date(now - 4 * HOUR).toISOString() }),
        ],
      };
    },
  };
  const saved = await topicResearch.collectTopicResearch(
    { topic: 'Citation Fixture', query: 'citation fixture' },
    { reader: reader.read, rootDir, now },
  );
  assert.equal(saved.ok, true, saved.reason);
  return saved;
}

function fixturePersona({
  results = [{ summary: 'Fixture result: synthetic lookup stayed under 10 ms.' }],
  version = 'citation-persona-v1',
} = {}) {
  return {
    version,
    technicalProvenanceSandbox: {
      verifiedOwnerExperiences: ['Fixture owner experience: built a local search index.'],
      verifiedResults: results,
      verifiedFailures: ['Fixture failure: the first migration attempt dropped a column.'],
    },
  };
}

function paragraphFixture() {
  return [
    { kind: 'reported', text: 'The room reports a narrow startup path.', postIds: ['90001', '90002'] },
    { kind: 'take', text: 'My take: the narrow path is worth watching.', postIds: ['90003'] },
    {
      kind: 'tested',
      text: 'A fixture result measured the synthetic lookup locally.',
      postIds: ['90004'],
      personaEvidence: [{ field: 'verifiedResults', index: 0 }],
    },
  ];
}

async function saveBriefFixture({
  rootDir,
  collectionId,
  now = NOW,
  persona = fixturePersona(),
  paragraphs = paragraphFixture(),
} = {}) {
  return topicResearch.saveTopicBrief({
    confirmRecord: true,
    collectionId,
    policy: 'Cite saved paragraphs. Do not claim primary verification.',
    paragraphs,
  }, { rootDir, now, personaModel: persona });
}

function compactExpectation(context) {
  return {
    collectionId: context.collectionId,
    briefId: context.briefId,
    paragraphIds: [...context.paragraphIds],
    briefDigest: context.briefDigest,
    sourceDigest: context.sourceDigest,
    createdAt: context.createdAt,
    expiresAt: context.expiresAt,
  };
}

function runBridge(command, payload, cwd = scratch) {
  return spawnSync(process.execPath, [path.join(REPO, 'agent_bridge.js'), command], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    input: JSON.stringify(payload),
    env: { ...process.env, X_ACCOUNT: 'ham_zax', AUTH_TOKEN: '' },
  });
}

function bridgeResult(run) {
  assert.equal(run.error, undefined);
  if (run.status === 0) return JSON.parse(run.stdout);
  const lines = String(run.stderr).trim().split('\n').filter(Boolean);
  return { error: JSON.parse(lines.at(-1)).error };
}

test('resolves only selected stored paragraphs and their citations in stored order', async () => {
  const root = rootFor('resolve');
  const collection = await makeCollection(root);
  const saved = await saveBriefFixture({ rootDir: root, collectionId: collection.id });
  const briefFile = saved.path;
  const briefBytes = await readFile(briefFile, 'utf8');
  const collectionBytes = await readFile(path.join(root, collection.id, 'posts.json'), 'utf8');
  const entriesBefore = (await readdir(path.dirname(briefFile))).sort();

  const resolved = await topicResearch.resolveTopicBriefCitation({
    collectionId: collection.id,
    briefId: saved.id,
    paragraphIds: ['p3', 'p1'],
  }, { rootDir: root, now: NOW + HOUR, personaModel: fixturePersona() });

  assert.deepEqual(Object.keys(resolved).sort(), [
    'briefDigest', 'briefId', 'citations', 'collectionId', 'createdAt', 'expiresAt',
    'paragraphIds', 'paragraphs', 'policy', 'sourceDigest', 'status', 'topic',
  ]);
  assert.equal(resolved.collectionId, collection.id);
  assert.equal(resolved.briefId, saved.id);
  assert.deepEqual(resolved.paragraphIds, ['p1', 'p3']);
  assert.equal(resolved.briefDigest, sha256(JSON.stringify(saved.brief)));
  assert.equal(resolved.sourceDigest, saved.brief.sourceDigest);
  assert.equal(resolved.topic, 'Citation Fixture');
  assert.equal(resolved.policy, saved.brief.policy);
  assert.equal(resolved.createdAt, saved.brief.createdAt);
  assert.equal(resolved.expiresAt, saved.brief.expiresAt);
  assert.equal(resolved.status, 'draft');
  assert.deepEqual(resolved.paragraphs, [saved.brief.paragraphs[0], saved.brief.paragraphs[2]]);
  assert.deepEqual(resolved.citations, saved.brief.citations.filter((citation) => (
    ['90001', '90002', '90004'].includes(citation.id)
  )));
  assert.deepEqual(resolved.citations.map((citation) => citation.id), ['90001', '90002', '90004']);
  assert.equal(Object.prototype.hasOwnProperty.call(resolved, 'markdown'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(resolved, 'path'), false);

  assert.equal(await readFile(briefFile, 'utf8'), briefBytes);
  assert.equal(
    await readFile(path.join(root, collection.id, 'posts.json'), 'utf8'),
    collectionBytes,
  );
  assert.deepEqual((await readdir(path.dirname(briefFile))).sort(), entriesBefore);
});

test('rejects invalid selector shapes and unknown or duplicate paragraph ids without writes', async () => {
  const root = rootFor('invalid');
  const collection = await makeCollection(root);
  const saved = await saveBriefFixture({ rootDir: root, collectionId: collection.id });
  const briefBytes = await readFile(saved.path, 'utf8');
  const base = { collectionId: collection.id, briefId: saved.id, paragraphIds: ['p1'] };
  const cases = [
    ['non-object null', null, /JSON object payload/],
    ['array payload', [], /JSON object payload/],
    ['caller text', { ...base, text: 'Caller supplied claim' }, /unsupported field/],
    ['caller digest', { ...base, briefDigest: sha256('x') }, /unsupported field/],
    ['caller root', { ...base, rootDir: '/tmp/elsewhere' }, /unsupported field/],
    ['missing collection', { briefId: saved.id, paragraphIds: ['p1'] }, /requires a collection id/],
    ['unsafe collection', { ...base, collectionId: '../escape' }, /Invalid topic collection id/],
    ['missing brief', { collectionId: collection.id, paragraphIds: ['p1'] }, /requires a brief id/],
    ['invalid brief', { ...base, briefId: 'not-a-uuid' }, /Invalid topic brief id/],
    ['missing paragraphs', { collectionId: collection.id, briefId: saved.id }, /1-30 paragraphIds/],
    ['paragraphs string', { ...base, paragraphIds: 'p1' }, /1-30 paragraphIds/],
    ['paragraphs empty', { ...base, paragraphIds: [] }, /1-30 paragraphIds/],
    ['paragraphs too many', { ...base, paragraphIds: Array.from({ length: 31 }, () => 'p1') }, /1-30 paragraphIds/],
    ['paragraph number', { ...base, paragraphIds: [1] }, /paragraph ids p1-p30/],
    ['p0', { ...base, paragraphIds: ['p0'] }, /paragraph ids p1-p30/],
    ['p31', { ...base, paragraphIds: ['p31'] }, /paragraph ids p1-p30/],
    ['uppercase', { ...base, paragraphIds: ['P1'] }, /paragraph ids p1-p30/],
    ['duplicate', { ...base, paragraphIds: ['p1', 'p1'] }, /must be distinct/],
    ['unknown stored paragraph', { ...base, paragraphIds: ['p9'] }, /has no selected paragraph/],
  ];
  for (const [label, payload, pattern] of cases) {
    await assert.rejects(
      () => topicResearch.resolveTopicBriefCitation(payload, { rootDir: root, now: NOW + HOUR, personaModel: fixturePersona() }),
      pattern,
      label,
    );
  }
  assert.equal(await readFile(saved.path, 'utf8'), briefBytes);
});

test('refuses expired, future-created, changed-source and changed-persona artifacts', async () => {
  const expiredRoot = rootFor('expired');
  const expiredCollection = await makeCollection(expiredRoot);
  const expiredBrief = await saveBriefFixture({ rootDir: expiredRoot, collectionId: expiredCollection.id });
  await assert.rejects(
    () => topicResearch.resolveTopicBriefCitation({
      collectionId: expiredCollection.id,
      briefId: expiredBrief.id,
      paragraphIds: ['p1'],
    }, { rootDir: expiredRoot, now: expiredBrief.brief.expiresAt, personaModel: fixturePersona() }),
    /expired/,
  );

  const futureRoot = rootFor('future-created');
  const futureCollection = await makeCollection(futureRoot);
  const futureBrief = await saveBriefFixture({ rootDir: futureRoot, collectionId: futureCollection.id });
  await assert.rejects(
    () => topicResearch.resolveTopicBriefCitation({
      collectionId: futureCollection.id,
      briefId: futureBrief.id,
      paragraphIds: ['p1'],
    }, { rootDir: futureRoot, now: NOW - 1, personaModel: fixturePersona() }),
    /future creation time/,
  );

  const changedRoot = rootFor('changed-source');
  const changedCollection = await makeCollection(changedRoot);
  const changedBrief = await saveBriefFixture({ rootDir: changedRoot, collectionId: changedCollection.id });
  const changedFile = path.join(changedRoot, changedCollection.id, 'posts.json');
  const stored = JSON.parse(await readFile(changedFile, 'utf8'));
  stored.posts[0].likes = 999;
  await writeFile(changedFile, `${JSON.stringify(stored, null, 2)}\n`);
  await assert.rejects(
    () => topicResearch.resolveTopicBriefCitation({
      collectionId: changedCollection.id,
      briefId: changedBrief.id,
      paragraphIds: ['p1'],
    }, { rootDir: changedRoot, now: NOW + HOUR, personaModel: fixturePersona() }),
    /source collection changed/,
  );

  const personaRoot = rootFor('changed-persona');
  const personaCollection = await makeCollection(personaRoot);
  const personaBrief = await saveBriefFixture({ rootDir: personaRoot, collectionId: personaCollection.id });
  await assert.rejects(
    () => topicResearch.resolveTopicBriefCitation({
      collectionId: personaCollection.id,
      briefId: personaBrief.id,
      paragraphIds: ['p1', 'p3'],
    }, {
      rootDir: personaRoot,
      now: NOW + HOUR,
      personaModel: fixturePersona({ results: [{ summary: 'Changed fixture result.' }] }),
    }),
    /persona evidence is no longer current/,
  );
});

test('refuses a brief whose bound collection has a future capture time', async () => {
  const root = rootFor('future-capture');
  const captureAt = NOW + HOUR;
  const collection = await makeCollection(root, { now: captureAt });
  const saved = await saveBriefFixture({
    rootDir: root,
    collectionId: collection.id,
    now: captureAt + HOUR,
    paragraphs: [{ kind: 'reported', text: 'Room report without persona evidence.', postIds: ['90001'] }],
  });
  const briefFile = path.join(root, collection.id, 'briefs', saved.id, 'brief.json');
  const tampered = JSON.parse(await readFile(briefFile, 'utf8'));
  tampered.createdAt = NOW;
  await writeFile(briefFile, `${JSON.stringify(tampered, null, 2)}\n`);

  await assert.rejects(
    () => topicResearch.resolveTopicBriefCitation({
      collectionId: collection.id,
      briefId: saved.id,
      paragraphIds: ['p1'],
    }, { rootDir: root, now: NOW + 1 }),
    /future capture time/,
  );
});

const behavior = {
  decision: 'ACT',
  primaryPurpose: 'technical_value',
  socialMode: 'explainer',
  informationDepth: 'compact_reason',
  affectStrategy: 'neutral',
  affectProvenance: 'none',
  reasonToExist: 'Use explicitly selected saved research context.',
};

function writtenOutput(pipeline, briefParagraphIds) {
  return {
    decision: 'POST',
    pipeline,
    thesis: 'Keep the saved research context attributed.',
    finalText: 'The narrow path is worth watching, but the report stays attributed and the take stays mine.',
    threadParts: pipeline === 'thread'
      ? ['The narrow path is worth watching, but the report stays attributed.', 'The take stays separate from the reported source.']
      : [],
    semanticAnchors: [],
    evidenceUsed: [],
    ...(briefParagraphIds === undefined ? {} : { briefParagraphIds }),
    media: { required: false, type: 'none' },
  };
}

test('adds topic context to the writer packet and declared use to all four pipelines', async () => {
  const root = rootFor('pipelines');
  const collection = await makeCollection(root);
  const saved = await saveBriefFixture({ rootDir: root, collectionId: collection.id });
  const context = await topicResearch.resolveTopicBriefCitation({
    collectionId: collection.id,
    briefId: saved.id,
    paragraphIds: ['p1', 'p2'],
  }, { rootDir: root, now: NOW + HOUR, personaModel: fixturePersona() });
  const candidate = {
    key: 'https://x.com/builder/status/700001',
    source: 'x',
    title: '@builder',
    url: 'https://x.com/builder/status/700001',
    text: 'Source text for the citation pipeline fixture.',
    timestamp: NOW,
    metrics: {},
  };

  for (const name of ['original', 'quote', 'thread', 'reply']) {
    const draft = {
      candidateKey: candidate.key,
      body: name === 'thread' ? undefined : 'A fixture draft body.',
      ...(name === 'thread' ? { threadParts: ['A fixture draft body.'] } : {}),
      editor: { pipeline: name, behavior, evidenceUsed: [] },
    };
    const queueItem = { pipeline: name, behavior };
    const packet = drafting.buildWriterPacket({
      candidate,
      queueItem,
      draft,
      topicBrief: context,
    });
    assert.deepEqual(packet.topicBrief, context, name);
    assert.deepEqual(packet.evidence, [], name);
    assert.equal(
      JSON.stringify(packet.discoveryVerification).includes('90001'),
      false,
      `${name}: brief post ids must not become packet evidence`,
    );

    const next = drafting.applyWriterOutput(draft, writtenOutput(name, ['p2', 'p1']), { writerPacket: packet });
    assert.deepEqual(next.editor.topicBrief, {
      ...compactExpectation(context),
      paragraphIds: ['p2', 'p1'],
    }, name);
    assert.deepEqual(Object.keys(next.editor.topicBrief).sort(), [
      'briefDigest', 'briefId', 'collectionId', 'createdAt', 'expiresAt', 'paragraphIds', 'sourceDigest',
    ]);
    assert.equal(Object.prototype.hasOwnProperty.call(next.editor.topicBrief, 'paragraphs'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(next.editor.topicBrief, 'citations'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(next.editor.topicBrief, 'topic'), false);
    assert.equal(draft.editor.topicBrief, undefined, `${name}: the input draft stays unchanged`);
    if (name === 'thread') {
      assert.deepEqual(next.threadParts, writtenOutput(name, []).threadParts);
    } else {
      assert.equal(next.body, writtenOutput(name, []).finalText);
    }
  }
});

test('validates declared paragraph references and never restores stale citation metadata', async () => {
  const root = rootFor('references');
  const collection = await makeCollection(root);
  const saved = await saveBriefFixture({ rootDir: root, collectionId: collection.id });
  const context = await topicResearch.resolveTopicBriefCitation({
    collectionId: collection.id,
    briefId: saved.id,
    paragraphIds: ['p1', 'p2'],
  }, { rootDir: root, now: NOW + HOUR, personaModel: fixturePersona() });
  const candidate = {
    key: 'https://x.com/builder/status/700002',
    source: 'owner',
    title: '@builder',
    url: 'https://x.com/builder/status/700002',
    text: 'Owner-supplied fixture source.',
    timestamp: NOW,
    metrics: {},
  };
  const draft = {
    candidateKey: candidate.key,
    body: 'A fixture draft body.',
    editor: { pipeline: 'original', behavior, evidenceUsed: [] },
  };
  const packet = drafting.buildWriterPacket({ candidate, queueItem: { pipeline: 'original', behavior }, draft, topicBrief: context });
  const invalid = [
    ['missing for POST', undefined, /requires nonempty briefParagraphIds/],
    ['empty for POST', [], /requires nonempty briefParagraphIds/],
    ['string', 'p1', /must be an array/],
    ['non-string id', [1], /paragraph id strings/],
    ['blank id', ['  '], /blank ids/],
    ['duplicate id', ['p1', 'p1'], /must be distinct/],
    ['unknown id', ['p9'], /were not supplied/],
  ];
  for (const [label, value, pattern] of invalid) {
    assert.throws(
      () => drafting.applyWriterOutput(draft, writtenOutput('original', value), { writerPacket: packet }),
      pattern,
      label,
    );
  }
  assert.equal(draft.editor.topicBrief, undefined);

  const doNotPost = drafting.applyWriterOutput(
    draft,
    { ...writtenOutput('original', undefined), decision: 'DO_NOT_POST' },
    { writerPacket: packet },
  );
  assert.equal(doNotPost.editor.decision, 'DO_NOT_POST');
  assert.equal(doNotPost.editor.topicBrief, undefined);
  const declaredDoNotPost = drafting.applyWriterOutput(
    draft,
    { ...writtenOutput('original', ['p2']), decision: 'DO_NOT_POST' },
    { writerPacket: packet },
  );
  assert.deepEqual(declaredDoNotPost.editor.topicBrief, {
    ...compactExpectation(context),
    paragraphIds: ['p2'],
  });

  const noPacket = drafting.buildWriterPacket({ candidate, queueItem: { pipeline: 'original', behavior }, draft });
  assert.equal(Object.prototype.hasOwnProperty.call(noPacket, 'topicBrief'), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      drafting.buildWriterPacket({ candidate, queueItem: { pipeline: 'original', behavior }, draft, topicBrief: null }),
      'topicBrief',
    ),
    false,
  );
  assert.equal(
    drafting.applyWriterOutput(draft, writtenOutput('original', undefined), { writerPacket: noPacket }).editor.topicBrief,
    undefined,
  );
  assert.equal(
    drafting.applyWriterOutput(draft, writtenOutput('original', []), { writerPacket: noPacket }).editor.topicBrief,
    undefined,
  );
  assert.throws(
    () => drafting.applyWriterOutput(draft, writtenOutput('original', ['p1']), { writerPacket: noPacket }),
    /without a topic brief packet/,
  );

  const staleDraft = {
    ...draft,
    editor: { ...draft.editor, topicBrief: { briefId: 'stale-brief', paragraphIds: ['p1'] } },
  };
  const stalePacket = drafting.buildWriterPacket({ candidate, queueItem: { pipeline: 'original', behavior }, draft: staleDraft });
  assert.equal(Object.prototype.hasOwnProperty.call(stalePacket, 'topicBrief'), false);
  assert.equal(stalePacket.currentDraft.editor.topicBrief, undefined);
  const fresh = drafting.applyWriterOutput(staleDraft, writtenOutput('original', undefined), { writerPacket: noPacket });
  assert.equal(fresh.editor.topicBrief, undefined);
});

function seedEngagementItem({ candidateKey, targetTweetId, engagementKind, parentOurTweetId = '', replyArchetype = '' }) {
  store.upsertCandidates([{
    key: candidateKey,
    source: 'x',
    title: `@${TARGET}`,
    text: '',
    url: `https://x.com/${TARGET}/status/${targetTweetId}`,
    timestamp: NOW,
    metrics: {},
  }]);
  store.ensureEngagementItem({
    candidateKey,
    targetTweetId,
    engagementKind,
    parentOurTweetId,
    replyArchetype,
    targetUsername: TARGET,
    status: 'approved',
  });
  const item = store.getQueueItemByCandidate(candidateKey);
  assert.ok(item);
  return item;
}

test('confirmed act metadata keeps compact citation identity without changing classification', async () => {
  const root = rootFor('act');
  const collection = await makeCollection(root);
  const saved = await saveBriefFixture({ rootDir: root, collectionId: collection.id });
  const context = await topicResearch.resolveTopicBriefCitation({
    collectionId: collection.id,
    briefId: saved.id,
    paragraphIds: ['p1', 'p2'],
  }, { rootDir: root, now: NOW + HOUR, personaModel: fixturePersona() });
  const item = seedEngagementItem({
    candidateKey: 'xr20c-initial',
    targetTweetId: '1900000000000003101',
    engagementKind: 'initial_reply',
    replyArchetype: 'implementation_detail',
  });
  const before = store.getAccountHealthSummary({ now: NOW })
    .networkQuality.components.authorResponseRate.meaningfulInitialReplies;

  const metadata = act.buildActRelationshipMetadata({
    action: 'reply',
    queueItem: item,
    observation: act.validateActObservation(undefined, { targetUsername: TARGET, now: NOW }),
    attemptId: 'attempt-citation',
    outputUrl: 'https://x.com/ham_zax/status/1900000000000003201',
    topicBrief: context,
  });
  assert.equal(metadata.engagementKind, 'initial_reply');
  assert.equal(metadata.replyArchetype, 'implementation_detail');
  assert.equal(metadata.replyShape, 'implementation_detail');
  assert.deepEqual(metadata.topicBrief, compactExpectation(context));
  assert.deepEqual(Object.keys(metadata.topicBrief).sort(), [
    'briefDigest', 'briefId', 'collectionId', 'createdAt', 'expiresAt', 'paragraphIds', 'sourceDigest',
  ]);
  const event = store.recordRelationshipEvent({
    username: TARGET,
    eventType: 'our_reply',
    candidateKey: item.candidateKey,
    sourceTweetId: item.targetTweetId,
    ourTweetId: '1900000000000003201',
    occurredAt: NOW,
    metadata,
  });
  assert.deepEqual(event.metadata, metadata);
  const afterReply = store.getAccountHealthSummary({ now: NOW })
    .networkQuality.components.authorResponseRate.meaningfulInitialReplies;
  assert.equal(afterReply, before + 1);

  const bare = act.buildActRelationshipMetadata({
    action: 'reply',
    queueItem: item,
    observation: null,
    attemptId: 'attempt-bare',
    outputUrl: 'https://x.com/ham_zax/status/1900000000000003202',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(bare, 'topicBrief'), false);
  assert.deepEqual(Object.keys(bare), [
    'attemptId', 'outputUrl', 'engagementKind', 'parentOurTweetId', 'replyArchetype',
    'replyShape', 'targetFollowers', 'targetFollowersObservedAt', 'targetFollowersSourceUrl',
  ]);

  const quoteCandidate = 'xr20c-quote';
  store.upsertCandidates([{
    key: quoteCandidate,
    source: 'x',
    title: `@${TARGET}`,
    text: '',
    url: `https://x.com/${TARGET}/status/1900000000000003102`,
    timestamp: NOW,
    metrics: {},
  }]);
  const quoteItem = store.ensureQueueItem(quoteCandidate, { lane: 'main', pipeline: 'quote', status: 'approved' });
  const quoteQueue = store.saveQueueItem({ ...quoteItem, engagementKind: 'initial_reply' });
  const quoteMetadata = act.buildActRelationshipMetadata({
    action: 'quote',
    queueItem: quoteQueue,
    observation: null,
    attemptId: 'attempt-quote-citation',
    outputUrl: 'https://x.com/ham_zax/status/1900000000000003203',
    topicBrief: context,
  });
  assert.equal(quoteMetadata.engagementKind, null);
  assert.deepEqual(quoteMetadata.topicBrief, compactExpectation(context));
  store.recordRelationshipEvent({
    username: TARGET,
    eventType: 'our_quote',
    candidateKey: quoteQueue.candidateKey,
    sourceTweetId: quoteQueue.targetTweetId,
    ourTweetId: '1900000000000003203',
    occurredAt: NOW,
    metadata: quoteMetadata,
  });
  assert.equal(
    store.getAccountHealthSummary({ now: NOW }).networkQuality.components.authorResponseRate.meaningfulInitialReplies,
    afterReply,
    'a quote must not add an initial reply',
  );
});

test('real bridge writer-packet carries the resolved brief and refuses malformed selectors before writes', async () => {
  const bridgeNow = Date.now();
  const candidateUrl = 'https://x.com/builder/status/770001';
  const key = candidateUrl;
  store.upsertCandidates([{
    key,
    source: 'owner',
    title: '@builder',
    text: 'Owner-supplied bridge fixture source.',
    url: candidateUrl,
    timestamp: bridgeNow,
    metrics: {},
  }]);
  store.ensureQueueItem(key, { lane: 'main', pipeline: 'original', status: 'drafting', behavior });
  const savedDraft = store.saveDraft({
    ...drafting.createDraftScaffold(store.getCandidate(key), { pipeline: 'original' }),
    body: 'A local bridge fixture draft for citation packets.',
    editor: { pipeline: 'original', behavior, evidenceUsed: [] },
  });

  const root = path.join(scratch, 'research', 'topics');
  const collection = await makeCollection(root, {
    now: bridgeNow,
    posts: [
      observedPost('88001', { at: new Date(bridgeNow - HOUR).toISOString() }),
      observedPost('88002', { at: new Date(bridgeNow - 2 * HOUR).toISOString() }),
    ],
  });
  const saved = await topicResearch.saveTopicBrief({
    confirmRecord: true,
    collectionId: collection.id,
    paragraphs: [
      { kind: 'reported', text: 'The room reports a narrow startup path.', postIds: ['88001'] },
      { kind: 'take', text: 'My take: the narrow path is worth watching.', postIds: ['88002'] },
    ],
  }, { rootDir: root, now: bridgeNow });
  const selector = { collectionId: collection.id, briefId: saved.id, paragraphIds: ['p2', 'p1'] };

  const packetRun = runBridge('writer-packet', { key, topicBrief: selector });
  const packetResult = bridgeResult(packetRun);
  assert.equal(packetResult.error, undefined, packetResult.error);
  assert.deepEqual(packetResult.packet.topicBrief.paragraphIds, ['p1', 'p2']);
  assert.deepEqual(
    packetResult.packet.topicBrief.paragraphs.map((paragraph) => paragraph.id),
    ['p1', 'p2'],
  );
  assert.deepEqual(
    packetResult.packet.topicBrief.citations.map((citation) => citation.id),
    ['88001', '88002'],
  );
  assert.equal(packetResult.packet.topicBrief.briefId, saved.id);
  assert.deepEqual(packetResult.packet.evidence, []);
  assert.ok(packetResult.generation);

  const nullRun = runBridge('writer-packet', { key, topicBrief: null });
  const nullResult = bridgeResult(nullRun);
  assert.equal(nullResult.error, undefined, nullResult.error);
  assert.equal(Object.prototype.hasOwnProperty.call(nullResult.packet, 'topicBrief'), false);

  const malformedSelector = { ...selector, paragraphIds: ['p9'] };
  const draftBefore = store.getDraft(savedDraft.id);
  const queueBefore = store.listQueueItems({ limit: 1000 });
  const attemptsBefore = store.listPublicationAttempts({ limit: 1000 });
  const eventsBefore = store.listRelationshipEvents(TARGET, { limit: 50 });

  const applyRun = runBridge('apply-writer-output', {
    id: savedDraft.id,
    generation: packetResult.generation,
    output: writtenOutput('original', ['p1']),
    topicBrief: malformedSelector,
  });
  const applyResult = bridgeResult(applyRun);
  assert.match(applyResult.error || '', /has no selected paragraph/);
  assert.deepEqual(store.getDraft(savedDraft.id), draftBefore);
  assert.deepEqual(store.listQueueItems({ limit: 1000 }), queueBefore);
  assert.deepEqual(store.listPublicationAttempts({ limit: 1000 }), attemptsBefore);

  const actRun = runBridge('act', {
    action: 'reply',
    text: 'A saved report needs attribution, and the take stays separate from the source.',
    targetTweetId: TARGET_TWEET,
    targetUsername: TARGET,
    topicBrief: malformedSelector,
  });
  const actResult = bridgeResult(actRun);
  assert.match(actResult.error || '', /has no selected paragraph/);
  assert.deepEqual(store.listQueueItems({ limit: 1000 }), queueBefore);
  assert.deepEqual(store.listPublicationAttempts({ limit: 1000 }), attemptsBefore);
  assert.deepEqual(store.listRelationshipEvents(TARGET, { limit: 50 }), eventsBefore);
  assert.equal((await stat(path.join(root, collection.id, 'briefs', saved.id, 'brief.json'))).isFile(), true);
});
