// Dynamic expression bandit tests run against a disposable SQLite DB only.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = await mkdtemp(path.join(tmpdir(), 'growth-dynamic-expression-'));
const previousCwd = process.cwd();
process.chdir(directory);
const url = (name) => pathToFileURL(path.join(root, name)).href;
const store = await import(url('store.js'));
const expression = await import(url('dynamic_expression.js'));

after(async () => {
  process.chdir(previousCwd);
  await rm(directory, { recursive: true, force: true });
});

const HOUR = 60 * 60 * 1000;

function publishedReply(key, text) {
  store.upsertCandidates([{ key, url: key, source: 'x', title: '@builder', text: 'A source post.', timestamp: Date.now() }]);
  store.ensureQueueItem(key, { pipeline: 'reply', lane: 'engagement', status: 'drafting' });
  store.saveDraft({ candidateKey: key, body: text, editor: { pipeline: 'reply' }, status: 'published', publishedTweetId: key.split('/').pop() });
}

function attemptStub(attempts) {
  return {
    getAppState: store.getAppState,
    setAppState: store.setAppState,
    getPerformanceSnapshot: store.getPerformanceSnapshot,
    listPublicationAttempts: () => attempts,
  };
}

test('candidate domains separate showcase, frontend, systems, hype_or_take and humor', () => {
  assert.deepEqual(expression.classifyCandidateDomains('Our React hydration waterfall is killing the frame budget on mobile.'), ['frontend']);
  assert.deepEqual(expression.classifyCandidateDomains('Postgres p99 tail and idempotent retry keys under backpressure.'), ['systems']);
  assert.ok(expression.classifyCandidateDomains('Hot take: AI wrappers will replace all engineers in 6 months').includes('hype_or_take'));
  const humor = expression.classifyCandidateDomains('lol we deleted the database on a friday deploy');
  assert.ok(humor.includes('humor'));
  assert.deepEqual(expression.classifyCandidateDomains('shipped a small thing today'), ['showcase']);
  const imapShowcase = expression.classifyCandidateDomains("I built my own IMAP MCP server. It's open source.");
  assert.ok(imapShowcase.includes('showcase'));
  assert.equal(imapShowcase.includes('hype_or_take'), false);
  assert.deepEqual(expression.classifyCandidateDomains('Looking forward to the weekend.'), ['general_tech', 'social']);
  assert.deepEqual(expression.classifyCandidateDomains(''), ['general_tech', 'social']);
});

test('cadence entropy blocks even a single recent question, varies praise openers and avoids compression riddles', () => {
  const singleQuestion = expression.computeCadenceEntropy(['What stack is that?', 'Nice write-up.', 'Clean setup.']);
  assert.equal(singleQuestion.questionStreak, 1);
  assert.ok(singleQuestion.constraints.some((item) => item.includes('do NOT end with a question mark')));
  const questions = expression.computeCadenceEntropy(['What stack is that?', 'How did you measure it?', 'Nice write-up.']);
  assert.equal(questions.questionStreak, 2);
  assert.ok(questions.constraints.some((item) => item.includes('do NOT end with a question mark')));
  const praise = expression.computeCadenceEntropy(['Congrats on the launch!', 'Nice one.', 'Love the canvas.']);
  assert.equal(praise.praiseOpenerCount, 3);
  assert.ok(praise.constraints.some((item) => item.includes("zero 'Congrats/Nice' opener")));
  const long = expression.computeCadenceEntropy(['x'.repeat(210), 'y'.repeat(195), 'z'.repeat(190)]);
  assert.ok(long.constraints.some((item) => item.includes('under 140 characters')));
  assert.ok(long.constraints.some((item) => item.includes('never compressed into a metaphor or riddle')));
  const short = expression.computeCadenceEntropy(['ok', 'nice', 'yep']);
  assert.ok(short.constraints.some((item) => item.includes('1-2 plain, clear sentences')));
  const empty = expression.computeCadenceEntropy([]);
  assert.equal(empty.avgChars, 0);
  assert.ok(empty.cadenceConstraint.includes('plain, natural developer English'));
});

test('consecutive selections rotate arms instead of repeating one shape', () => {
  const sourceText = 'Postgres p99 tail and idempotent retry keys under backpressure.';
  const first = expression.selectDynamicExpressionPlan(store, { candidateKey: 'https://x.com/builder/status/7001', sourceText, now: 1_700_000_000_000 });
  assert.ok(expression.EXPRESSION_ARMS.some((arm) => arm.id === first.dynamicExperiment.armId));
  assert.deepEqual(first.dynamicExperiment.domains, ['systems']);
  assert.equal(typeof first.dynamicExperiment.candidateBDirective, 'string');
  expression.recordDynamicExpressionOutcome(store, { draftId: 1, candidateKey: 'https://x.com/builder/status/7001',
    armId: first.dynamicExperiment.armId, selectedCandidate: 'A', now: 1_700_000_000_100 });
  const second = expression.selectDynamicExpressionPlan(store, { candidateKey: 'https://x.com/builder/status/7002', sourceText, now: 1_700_000_000_200 });
  assert.notEqual(second.dynamicExperiment.armId, first.dynamicExperiment.armId);
  expression.recordDynamicExpressionOutcome(store, { draftId: 2, candidateKey: 'https://x.com/builder/status/7002',
    armId: second.dynamicExperiment.armId, selectedCandidate: 'B', now: 1_700_000_000_300 });
  const third = expression.selectDynamicExpressionPlan(store, { candidateKey: 'https://x.com/builder/status/7003', sourceText, now: 1_700_000_000_400 });
  assert.notEqual(third.dynamicExperiment.armId, second.dynamicExperiment.armId);
  assert.notEqual(third.dynamicExperiment.armId, first.dynamicExperiment.armId);
});

test('a question streak also rules out the curiosity arm', () => {
  publishedReply('https://x.com/builder/status/7050', 'What stack is that?');
  publishedReply('https://x.com/builder/status/7051', 'How did you measure it?');
  const plan = expression.selectDynamicExpressionPlan(store, { candidateKey: 'https://x.com/builder/status/7052',
    sourceText: 'Postgres p99 tail and idempotent retry keys under backpressure.', now: 1_700_000_100_000 });
  assert.equal(plan.recentReplies.length, 2);
  assert.notEqual(plan.dynamicExperiment.armId, 'builder_curiosity');
  assert.ok(plan.dynamicExperiment.cadenceConstraint.includes('do NOT end with a question mark'));
});

test('live act-published replies (draft status=draft, queue status=published) feed recentReplies and block questions', () => {
  const actKey = 'https://x.com/harryjwang/status/7060';
  const now = Date.now() + 10_000;
  store.upsertCandidates([{ key: actKey, url: actKey, source: 'x', title: '@harryjwang', text: 'I built an IMAP MCP server.', timestamp: now }]);
  const q = store.ensureQueueItem(actKey, { pipeline: 'reply', lane: 'engagement', status: 'drafting' });
  store.saveQueueItem({ ...q, status: 'published', publishedAt: now, outputTweetId: '706099', approvedText: 'How does retry work?' });
  store.saveDraft({ candidateKey: actKey, body: 'How does retry work?', editor: { pipeline: 'reply' }, status: 'draft' });
  store.recordCandidateAction({ candidateKey: actKey, action: 'reply', outputTweetId: '706099', outputUrl: 'https://x.com/ham_zax/status/706099', commentary: 'How does retry work?', createdAt: now });

  const recentContent = store.listRecentPublishedContent({ kind: 'reply', limit: 5 });
  assert.equal(recentContent[0].text, 'How does retry work?');

  const showcasePlan = expression.selectDynamicExpressionPlan(store, {
    candidateKey: 'https://x.com/joelmoss/status/7061',
    sourceText: 'So I built a little Rails app that runs PR reviews, and BAM! 💥',
    now: now + 1000,
  });
  assert.equal(showcasePlan.recentReplies[0], 'How does retry work?');
  assert.ok(showcasePlan.dynamicExperiment.domains.includes('showcase'));
  assert.equal(['sarcastic_pushback', 'independent_counterpoint', 'builder_curiosity'].includes(showcasePlan.dynamicExperiment.armId), false);
  assert.ok(showcasePlan.dynamicExperiment.cadenceConstraint.includes('Builder showcase detected'));
  assert.ok(showcasePlan.dynamicExperiment.cadenceConstraint.includes('do NOT end with a question mark'));
});

test('published post metrics reconcile into arm rewards after two hours', () => {
  const candidateKey = 'https://x.com/builder/status/7100';
  const publishedAt = 1_700_000_000_000;
  expression.recordDynamicExpressionOutcome(store, { draftId: 7, candidateKey, armId: 'systems_tradeoff', selectedCandidate: 'B', now: publishedAt });
  store.recordPerformanceSnapshot({ profile: { followersCount: 70 }, capturedAt: publishedAt + 3 * HOUR,
    posts: [{ id: '9100', timestamp: publishedAt, views: 400, likes: 4, retweets: 1, replies: 2, text: 'reply' }] });
  const result = expression.reconcileDynamicExpressionRewards(attemptStub([{ candidateKey, state: 'confirmed_published',
    outputTweetId: '9100', createdAt: publishedAt, reconciledAt: publishedAt }]), { now: publishedAt + 4 * HOUR });
  assert.equal(result.reconciled, 1);
  const arm = expression.getDynamicExpressionSummary(store).arms.find((item) => item.armId === 'systems_tradeoff');
  assert.equal(arm.measuredCount, 1);
  assert.equal(arm.totalImpressions, 400);
  assert.equal(arm.totalReplies, 2);
  assert.equal(arm.totalLikes, 4);
  assert.equal(arm.meanReward, 1);
});

test('a measurement younger than two hours defers the reward', () => {
  const candidateKey = 'https://x.com/builder/status/7200';
  const publishedAt = 1_700_100_000_000;
  expression.recordDynamicExpressionOutcome(store, { draftId: 8, candidateKey, armId: 'frontend_craft', selectedCandidate: 'A', now: publishedAt });
  store.recordPerformanceSnapshot({ profile: { followersCount: 70 }, capturedAt: publishedAt + 30 * 60 * 1000,
    posts: [{ id: '9200', timestamp: publishedAt, views: 900, likes: 9, retweets: 1, replies: 3, text: 'reply' }] });
  const result = expression.reconcileDynamicExpressionRewards(attemptStub([{ candidateKey, state: 'confirmed_published',
    outputTweetId: '9200', createdAt: publishedAt, reconciledAt: publishedAt }]), { now: publishedAt + HOUR });
  assert.equal(result.reconciled, 0);
  const arm = expression.getDynamicExpressionSummary(store).arms.find((item) => item.armId === 'frontend_craft');
  assert.equal(arm.measuredCount, 0);
});

test('recorded outcomes count pulls, B wins and stay bounded', () => {
  const before = expression.getDynamicExpressionSummary(store).arms.find((item) => item.armId === 'sharp_micro');
  expression.recordDynamicExpressionOutcome(store, { draftId: 9, candidateKey: 'https://x.com/builder/status/7300',
    armId: 'sharp_micro', selectedCandidate: 'B', now: 1_700_200_000_000 });
  const after = expression.getDynamicExpressionSummary(store).arms.find((item) => item.armId === 'sharp_micro');
  assert.equal(after.pulls, before.pulls + 1);
  assert.equal(after.wins, before.wins + 1);
  assert.throws(() => expression.recordDynamicExpressionOutcome(store, { armId: 'invented_arm' }), /Unknown dynamic expression arm/);
  const summary = expression.getDynamicExpressionSummary(store);
  assert.equal(summary.arms.length, 7);
  assert.equal(summary.stateKey, 'dynamic_expression_state_v1');
  assert.ok(summary.recent.length <= 5);
  assert.ok(summary.pendingReconciliation >= 1);
});

test('the bridge exposes the read-only dynamic-expression summary', () => {
  const parsed = JSON.parse(execFileSync(process.execPath, [path.join(root, 'agent_bridge.js'), 'dynamic-expression'], {
    cwd: directory, encoding: 'utf8', input: '{}', env: process.env,
  }));
  assert.equal(parsed.stateKey, 'dynamic_expression_state_v1');
  assert.equal(parsed.arms.length, 7);
  assert.ok(parsed.arms.some((arm) => arm.armId === 'systems_tradeoff' && arm.measuredCount === 1));
  assert.equal(typeof parsed.totals.pulls, 'number');
  assert.equal(parsed.totals.measuredCount, 1);
});
