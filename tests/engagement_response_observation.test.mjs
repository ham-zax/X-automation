import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const originalCwd = process.cwd();
let tmpDir;
let store;
let engagement;
let xReads;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'x-response-observation-'));
  process.chdir(tmpDir);
  store = await import(pathToFileURL(path.join(REPO, 'store.js')).href);
  engagement = await import(pathToFileURL(path.join(REPO, 'engagement.js')).href);
  xReads = await import(pathToFileURL(path.join(REPO, 'x_reads.js')).href);
});

after(async () => {
  process.chdir(originalCwd);
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

function mention(id, username, inReplyToStatusId, timeParsed, overrides = {}) {
  return {
    id,
    username,
    text: `observed mention ${id}`,
    inReplyToStatusId,
    conversationId: '10000',
    timeParsed,
    ...overrides,
  };
}

function fakeScraper(posts, { fail = false } = {}) {
  const queries = [];
  return {
    queries,
    async getTweet() { return null; },
    async *searchTweets(query) {
      queries.push(query);
      if (fail) throw new Error('HTTP 404: Not Found');
      for (const post of posts) yield post;
    },
  };
}

function injectedReader(scraper) {
  return (ourTweetIds, options) => xReads.readXTargetResponses(ourTweetIds, {
    ...options,
    readerOptions: { scraper, handle: '@ham_zax' },
  });
}

test('response observation keeps only exact direct replies to owned posts', async () => {
  const now = 1_791_000_000_000;
  const since = now - 72 * 3_600_000;
  const owned = '1900000000000000101';
  const validId = '1900000000000000201';
  const scraper = fakeScraper([
    mention(validId, 'devbuilder', owned, new Date(now - 60_000), {
      text: 'Which migration command did you run when the database locked?',
      likes: 0,
      replies: 0,
      retweets: 0,
    }),
    mention(validId, 'devbuilder', owned, new Date(now - 60_000)),
    mention('1900000000000000202', 'devbuilder', '1900000000000000999', new Date(now - 60_000)),
    mention('1900000000000000203', 'ham_zax', owned, new Date(now - 60_000)),
    mention('1900000000000000204', 'devbuilder', owned, new Date(since - 1000)),
    mention('1900000000000000205', 'devbuilder', owned, new Date(now + 1000)),
    mention('1900000000000000206', null, owned, new Date(now - 60_000)),
    mention('1900000000000000207', 'devbuilder', owned, null),
    mention('abc', 'devbuilder', owned, new Date(now - 60_000)),
  ]);

  const read = await xReads.readXTargetResponses([owned], { since, now, readerOptions: { scraper, handle: '@ham_zax' } });
  assert.deepEqual(read.errors, []);
  assert.deepEqual(read.responses.map((response) => response.id), [validId]);
  const [response] = read.responses;
  assert.equal(response.authorUsername, 'devbuilder');
  assert.equal(response.targetUsername, 'devbuilder');
  assert.equal(response.parentOurTweetId, owned);
  assert.equal(response.responseType, 'reply');
  assert.equal(response.timestamp, now - 60_000);
  assert.equal(response.observedAt, now);
  assert.equal(response.transport, 'http_mentions');
  assert.equal(response.likes, 0);
  assert.equal(response.views, null);
  assert.deepEqual(scraper.queries, ['to:ham_zax']);
});

test('response observation reads nothing without parents and reports read failure honestly', async () => {
  const emptyScraper = fakeScraper([]);
  assert.deepEqual(
    await xReads.readXTargetResponses([], { readerOptions: { scraper: emptyScraper } }),
    { responses: [], errors: [] },
  );
  assert.deepEqual(emptyScraper.queries, []);

  const failingScraper = fakeScraper([], { fail: true });
  const failed = await xReads.readXTargetResponses(['1900000000000000101'], {
    readerOptions: { scraper: failingScraper, handle: '@ham_zax' },
  });
  assert.deepEqual(failed.responses, []);
  assert.deepEqual(failed.errors, [{ targetUsername: 'ham_zax', error: 'HTTP 404: Not Found' }]);
  assert.ok(failed.errors[0].error.length <= 300);
});

test('response observation bounds owned parents to the conversation window', async () => {
  const now = 1_791_000_000_000;
  const parents = Array.from({ length: 101 }, (_, index) => String(1900000000000001000n + BigInt(index)));
  const scraper = fakeScraper([
    mention('1900000000000000301', 'devbuilder', parents[99], new Date(now - 60_000)),
    mention('1900000000000000302', 'devbuilder', parents[100], new Date(now - 60_000)),
  ]);
  const read = await xReads.readXTargetResponses(parents, { now, readerOptions: { scraper, handle: '@ham_zax' } });
  assert.deepEqual(read.responses.map((response) => response.id), ['1900000000000000301']);
});

test('engagement refresh records one linked response event and a follow-up opportunity', async () => {
  const now = 1_791_000_000_000;
  const originalId = '1900000000000000401';
  const ownedReplyId = '1900000000000000402';
  const responseId = '1900000000000000403';
  const author = 'devbuilder';
  const candidateKey = `https://x.com/${author}/status/${originalId}`;

  store.upsertCandidates([{
    key: candidateKey,
    source: 'x',
    title: `@${author}`,
    text: 'Queue design notes for a background worker.',
    url: candidateKey,
    timestamp: now - 2 * 3_600_000,
    metrics: { views: 1000, likes: 10, replies: 3, retweets: 2 },
  }]);
  const queueItem = store.ensureQueueItem(candidateKey, { lane: 'engagement', pipeline: 'reply', status: 'triage' });
  store.saveQueueItem({
    ...queueItem,
    targetUsername: author,
    targetTweetId: originalId,
    engagementKind: 'initial_reply',
  });
  store.recordCandidateAction({
    candidateKey,
    action: 'reply',
    outputTweetId: ownedReplyId,
    outputUrl: `https://x.com/ham_zax/status/${ownedReplyId}`,
    commentary: 'A concrete reply about queue behavior.',
    createdAt: now - 2 * 3_600_000,
  });
  store.upsertRelationshipProfile({
    username: author,
    displayName: author,
    primaryTopics: ['agents'],
    matchedKeywords: ['queue'],
    topicFit: 60,
    audienceOverlap: 40,
    conversationQuality: 50,
    replyVisibility: 55,
    relationshipPotential: 60,
    targetScore: 55,
    relevanceScore: 60,
    relationshipStage: 'responsive',
    meaningfulInteractions: 1,
    ourRepliesToThem: 1,
    lastInteractionAt: now - 2 * 3_600_000,
  });
  store.recordRelationshipEvent({
    username: author,
    eventType: 'our_reply',
    candidateKey,
    sourceTweetId: originalId,
    ourTweetId: ownedReplyId,
    topic: 'queue',
    occurredAt: now - 2 * 3_600_000,
    metadata: { engagementKind: 'initial_reply' },
  });

  const scraper = fakeScraper([
    mention(responseId, author, ownedReplyId, new Date(now - 60_000), {
      text: 'Which migration command did you run when the database locked?',
      likes: 4,
      retweets: 0,
      views: 0,
    }),
  ]);
  const result = await engagement.refreshEngagementOpportunities({
    now,
    refreshResponses: true,
    refreshTargetTimelines: false,
    responseReader: injectedReader(scraper),
  });

  assert.deepEqual(result.errors, []);
  const responseEvents = store.listRelationshipEvents(author, { limit: 100 })
    .filter((event) => event.eventType === 'target_reply');
  assert.equal(responseEvents.length, 1);
  const [event] = responseEvents;
  assert.equal(event.username, author);
  assert.equal(event.sourceTweetId, originalId);
  assert.equal(event.ourTweetId, ownedReplyId);
  assert.equal(event.occurredAt, now - 60_000);
  assert.equal(event.metadata.responseTweetId, responseId);
  assert.equal(event.metadata.responseType, 'reply');
  assert.equal(event.metadata.parentOurTweetId, ownedReplyId);
  assert.equal(event.metadata.transport, 'http_mentions');
  assert.equal(event.metadata.observedAt, now);

  const followUp = result.activeConversations.find((item) => item.targetTweetId === responseId);
  assert.ok(followUp, 'expected a follow-up opportunity for the observed reply');
  assert.equal(followUp.engagementKind, 'follow_up');
  assert.equal(followUp.parentOurTweetId, ownedReplyId);
  assert.equal(followUp.targetUsername, author);
  const observedCandidate = store.getCandidate(followUp.candidateKey);
  assert.equal(observedCandidate.metrics.views, 0);
  assert.equal(observedCandidate.metrics.replies, null);

  const health = store.getAccountHealthSummary({ now });
  assert.equal(health.networkQuality.components.authorResponseRate.meaningfulInitialReplies, 1);
  assert.equal(health.networkQuality.components.authorResponseRate.targetsWhoReplied, 1);
  assert.equal(health.networkQuality.components.authorResponseRate.rate, 100);
  assert.equal(health.interactionCounts.authorResponses30d, 1);

  const repeatedScraper = fakeScraper([
    mention(responseId, author, ownedReplyId, new Date(now - 60_000), {
      text: 'Which migration command did you run when the database locked?',
      likes: 4,
      replies: 1,
      retweets: 0,
      views: 0,
    }),
  ]);
  await engagement.refreshEngagementOpportunities({
    now: now + 60_000,
    refreshResponses: true,
    refreshTargetTimelines: false,
    responseReader: injectedReader(repeatedScraper),
  });
  assert.equal(
    store.listRelationshipEvents(author, { limit: 100 }).filter((item) => item.eventType === 'target_reply').length,
    1,
  );

  const failed = await engagement.refreshEngagementOpportunities({
    now: now + 120_000,
    refreshResponses: true,
    refreshTargetTimelines: false,
    responseReader: async () => ({ responses: [], errors: [{ targetUsername: author, error: 'mention read failed' }] }),
  });
  assert.ok(failed.errors.includes(`response @${author}: mention read failed`));
  assert.equal(
    store.listRelationshipEvents(author, { limit: 100 }).filter((item) => item.eventType === 'target_reply').length,
    1,
  );
});
