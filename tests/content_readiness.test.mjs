import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const originalCwd = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), 'content-readiness-'));
process.chdir(scratch);
const drafting = await import('../drafting.js');
const review = await import('../content_review.js');
const persona = await import('../persona.js');
const runtime = await import('../writer_runtime.js');
const store = await import('../store.js');
const autonomous = await import('../autonomous_reply.js');
const pipeline = await import('../pipeline.js');
const growthRun = await import('../growth_run.js');
const behaviorRules = await import('../behavior.js');
after(async () => { process.chdir(originalCwd); await rm(scratch, { recursive: true, force: true }); });

store.upsertCandidates([{ key: 'https://x.com/builder/status/808080', url: 'https://x.com/builder/status/808080', source: 'x', title: '@builder',
  timestamp: Date.now(), metrics: { views: 20000, likes: 300, retweets: 30, replies: 10 },
  text: 'Agent API recovery should preserve valid state. Separate retry attempts from committed transactions so transient failures do not corrupt developer workflow.' }]);
const candidate = store.getCandidate('https://x.com/builder/status/808080');
const behavior = { decision: 'ACT', primaryPurpose: 'technical_value', socialMode: 'explainer', informationDepth: 'compact_reason',
  affectStrategy: 'neutral', affectProvenance: 'none', reasonToExist: 'Explain agent recovery and reliable transactions.' };
const opener = 'Agent recovery needs a clear transaction boundary. Use separate tests for rejected edits and committed work.';
const draft = (text = opener, route = 'original') => ({ candidateKey: candidate.key, body: Array.isArray(text) ? text[0] : text,
  ...(route === 'thread' ? { threadParts: text } : {}), editor: { pipeline: route, behavior, evidenceUsed: [] } });
const score = (item, context = {}) => drafting.scoreDraft(item, candidate, { pipeline: item.editor.pipeline, behavior, strategyMode: 'off', ...context });
const passingReview = () => ({ passed: true, ownerClaims: [], factualClaims: [], voiceIssues: [], issues: [] });
const attachReview = (item, result = passingReview(), context = {}) => {
  item.editor.contentReview = review.bindContentReview(result, drafting.draftReviewContext(item, candidate, context));
  return item;
};

test('unsupported experience and benchmark regressions fail the shared gate', () => {
  for (const text of [
    'Shipped this agent yesterday. My results: 99% fewer failed runs and 30ms recovery latency.',
    "I've switched our recovery system to this API. Measured 3x faster retries.",
    'I recently adopted this recovery system and measured 30ms latency.',
    'SQLite now delivers 99.9% agent recovery accuracy and 30ms latency in production benchmarks.',
    'Use this API for retries. SQLite now delivers 99.9% recovery accuracy.',
  ]) assert.equal(score(draft(text)).publishable, false, text);
});

test('a reported adoption milestone supports a source-backed celebration', () => {
  assert.equal(behaviorRules.socialPurposeContextAvailable({ purpose: 'celebration', sourceText: 'T3 Code now has over 400,000 users :)' }), true);
  assert.equal(behaviorRules.socialPurposeContextAvailable({ purpose: 'celebration', sourceText: 'The tool lost 400,000 users.' }), false);
  assert.equal(behaviorRules.socialPurposeContextAvailable({ purpose: 'celebration', sourceText: 'Our goal is 400,000 users.' }), false);
});

test('thread copying and repetition checks cover every part and recent thread bodies', () => {
  assert.ok(score(draft([opener, candidate.text], 'thread')).gates.failures.some(item => item.code === 'SOURCE_DUPLICATE'));
  assert.ok(score(draft([opener, 'Measure the cost of recovery before choosing a retry strategy.', opener], 'thread')).gates.failures.some(item => item.code === 'THREAD_PART_DUPLICATE'));
  const second = 'Bound the retry budget before starting another API call. A failed request should leave committed work intact.';
  assert.ok(score(draft([opener, second], 'thread'), { recentPosts: [{ threadParts: ['A different earlier opener.', second] }] }).gates.failures.some(item => item.code === 'RECENT_DUPLICATE'));
});

test('arrays and links are accepted while actual scaffold markers are blocked', () => {
  for (const text of [
    'For agent retries, use [100, 500, 1000] as backoff intervals. Stop after three attempts so a broken API cannot loop forever.',
    'Keep retries bounded. Check the [docs](https://example.invalid/docs) before committing another agent transaction.',
    'Keep retries bounded. Check the [evidence](https://example.invalid/docs) before committing another agent transaction.',
  ]) assert.equal(score(draft(text)).publishable, true, text);
  assert.equal(score(draft('Bound retries before publishing. [insert evidence here]')).publishable, false);
});

test('exact human attestation is preserved only when writer output keeps public text unchanged', () => {
  const item = draft('I shipped this agent with a bounded retry budget. Test recovery before committing another transaction.');
  item.editor.ownerEvidence = { attestedBy: 'human_web', experienceConfirmed: true, claimSummary: 'Owner confirmed this implementation.',
    attestedAt: Date.now(), textHash: createHash('sha256').update(item.body).digest('hex') };
  assert.equal(score(item).publishable, true);
  const packet = drafting.buildWriterPacket({ candidate, queueItem: { pipeline: 'original', behavior }, draft: item });
  const output = { decision: 'POST', pipeline: 'original', finalText: item.body, threadParts: [], evidenceUsed: [], media: { type: 'none', required: false } };
  const same = drafting.applyWriterOutput(item, output, { writerPacket: packet });
  assert.ok(same.editor.ownerEvidence);
  const edited = drafting.applyWriterOutput(item, { ...output, finalText: `${item.body} A new claim.` }, { writerPacket: packet });
  assert.equal(edited.editor.ownerEvidence, undefined);
});

test('autonomous review binds exact content, evidence, behavior and persona, and respects DO_NOT_POST', () => {
  const item = attachReview(draft());
  assert.equal(score(item, { requireContentReview: true }).publishable, true);
  assert.equal(score(draft(), { requireContentReview: true }).publishable, false);
  assert.equal(score({ ...item, body: `${item.body} Another sentence.` }, { requireContentReview: true }).publishable, false);
  assert.equal(score(item, { requireContentReview: true, evidence: [{ id: 'new', status: 'primary_supported', claim: 'Different evidence.' }] }).publishable, false);
  assert.equal(score(item, { requireContentReview: true, behavior: { ...behavior, reasonToExist: 'A materially different public act.' } }).publishable, false);
  assert.equal(review.currentContentReview(item.editor.contentReview, { ...drafting.draftReviewContext(item, candidate), personaVersion: 'new-persona' }).passed, false);
  item.editor.decision = 'DO_NOT_POST';
  assert.equal(score(item, { requireContentReview: true }).publishable, false);
});

test('review source excerpts and units cannot be invented or substituted', () => {
  const item = draft('The source reports 30ms recovery latency. Keep the retry budget bounded before adopting this API.');
  const proof = { id: 'e1', status: 'primary_supported', claim: 'The test measured 30ms recovery latency.', summary: '' };
  const context = drafting.draftReviewContext(item, candidate, { evidence: [proof] });
  const valid = { ...passingReview(), factualClaims: [{ text: '30ms recovery latency', status: 'supported', sourceId: 'e1', sourceQuote: proof.claim, attributed: true }] };
  assert.equal(review.bindContentReview(valid, context).passed, true);
  assert.equal(review.bindContentReview({ ...valid, factualClaims: [{ ...valid.factualClaims[0], sourceQuote: 'Invented source says 30ms.' }] }, context).passed, false);
  const changed = { ...context, units: [item.body.replace('30ms', '30seconds')] };
  assert.equal(review.bindContentReview({ ...valid, factualClaims: [{ ...valid.factualClaims[0], text: '30seconds recovery latency' }] }, changed).passed, false);
  assert.equal(review.bindContentReview(passingReview(), context).passed, false);
  assert.equal(review.bindContentReview({ ...passingReview(), ownerClaims: ['Shipped this agent.'] }, drafting.draftReviewContext(draft(), candidate)).passed, false);
});

test('independent writer review is bounded, and an unavailable reviewer preserves an editable candidate', async () => {
  const packet = drafting.buildWriterPacket({ candidate, queueItem: { pipeline: 'original', behavior }, draft: draft() });
  const calls = [];
  const output = await runtime.generateWriterOutput(packet, 'No fabricated facts.', { timeoutMs: 5000, runAI: async request => {
    calls.push(request);
    if (calls.length === 1) return { output: { decision: 'POST', pipeline: 'original', finalText: opener, threadParts: [], evidenceUsed: [] }, execution: {} };
    throw new Error('Synthetic reviewer timeout');
  } });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].metadata.consumer, 'writer_content_review');
  assert.ok(calls[1].timeoutMs <= 5000);
  const item = drafting.applyWriterOutput(draft(), output, { writerPacket: packet });
  assert.equal(item.body, opener);
  assert.equal(score(item, { requireContentReview: true }).publishable, false);
  assert.equal(score(item).publishable, true);
});

test('persona calibration preserves uncertainty and factual authority', () => {
  const slice = persona.getPersonaSlice('writer');
  assert.ok(slice.knownUnknowns.length);
  assert.ok(slice.voiceCalibration.preserveExamples.some(item => item.text === 'what?'));
  assert.ok(slice.voiceCalibration.repairPairs.every(item => item.source === 'counterfactual_audit_edit'));
  assert.equal(slice.technicalProvenanceSandbox.verifiedResults.length, 0);
  assert.ok(slice.technicalProvenanceSandbox.verifiedProjects.some(item => item.name === 'ZenGate'));
});

test('cached eligible replies lose eligibility when the current source or review changes', () => {
  store.upsertCandidates([candidate]);
  const item = store.ensureEngagementItem({ candidateKey: candidate.key, targetTweetId: '808080', targetUsername: 'builder', status: 'drafting', behavior });
  const reply = attachReview(draft(opener, 'reply'));
  const decision = store.recordAutonomousReplyDecision({ queueItemId: item.id, candidateKey: candidate.key,
    targetTweetId: item.targetTweetId, targetUsername: 'builder', sourceClass: 'normal', intent: 'technical_insight', tone: 'direct',
    mode: 'live', grantRevision: 1, decision: 'eligible_live', exactReply: reply.body, selection: { behavior }, checks: { contentReview: reply.editor.contentReview } });
  assert.equal(autonomous.inspectAutonomousReplyContent(item, decision).passed, true);
  store.saveAutonomousReplyGrantState({ state: 'running', mode: 'live', revision: 1, liveBudget: 5, budgetUsed: 0 });
  const claimed = store.claimAutonomousReplyDecision(decision.id, { grantRevision: 1, transport: 'browser_agent', claimHolder: 'content-test-session' });
  assert.equal(claimed.attempt.authoritySnapshot.type, 'autonomous_reply');
  assert.equal(claimed.queueItem.approvalSnapshot?.authority?.type, undefined);
  store.upsertCandidates([{ ...candidate, text: `${candidate.text} Different source facts.` }]);
  assert.equal(autonomous.inspectAutonomousReplyContent(item, decision).passed, false);
  assert.throws(() => execFileSync(process.execPath, [path.join(originalCwd, 'agent_bridge.js'), 'publication-attempt-send-start'],
    { cwd: scratch, input: JSON.stringify({ attemptId: claimed.attempt.attemptId }), stdio: 'pipe' }),
    error => error.status === 1 && /review is no longer current/.test(String(error.stderr)));
  assert.equal(store.getPublicationAttempt(claimed.attempt.attemptId).state, 'claimed');
});

test('mission-agent approval fails before approval when no current content review exists', () => {
  const key = 'https://x.com/builder/status/818181';
  // This fixture tests ordinary independent-review authority, not the
  // external-X discovery gate exercised in useful_tech_discovery.test.mjs.
  store.upsertCandidates([{ ...candidate, key, url: key, source: 'owner' }]);
  const queue = pipeline.routeCandidate(key, 'original', { actor: 'agent', routeContext: { behavior } });
  assert.deepEqual(store.listQueueSources(queue.id), [{ queueItemId: queue.id, candidateKey: key, role: 'primary' }]);
  pipeline.setBehaviorDecision(key, behavior, { actor: 'agent' });
  const item = store.getDraftByCandidate(key);
  store.saveDraft({ ...item, ...draft(), id: item.id, candidateKey: key, editor: { pipeline: 'original', behavior } });
  store.recordWritingStrategySelection({ queueItemId: queue.id, mode: 'off', selectionSource: 'manual', selectedBy: 'human' });
  pipeline.requestQueueReview(key);
  store.configureGrowthOperatorDelegation({ mode: 'live' });
  const grant = store.startGrowthOperatorDelegation();
  assert.throws(() => pipeline.approveQueueItemAsMissionAgent(key, { grantRevision: grant.revision,
    verificationProvenance: { authorityType: 'mission_agent', sourceReferences: [key], evidenceReferences: [] } }), /CONTENT_REVIEW_REQUIRED/);
  assert.equal(store.getQueueItemByCandidate(key).status, 'needs_review');
  const reviewed = store.getDraftByCandidate(key);
  reviewed.editor.contentReview = review.bindContentReview(passingReview(), drafting.draftReviewContext(reviewed, store.getCandidate(key)));
  store.saveDraft(reviewed);
  const run = growthRun.beginGrowthRun({ adapterType: 'test', sessionId: 'mission-review-test',
    capabilities: { reasoning: true, browser_read: true, browser_mutation: true, x_authenticated: true } }).run;
  const approve = sessionId => execFileSync(process.execPath, [path.join(originalCwd, 'agent_bridge.js'), 'mission-approve'],
    { cwd: scratch, input: JSON.stringify({ key, runId: run.runId, sessionId, grantRevision: grant.revision,
      verificationProvenance: { authorityType: 'mission_agent', sourceReferences: [key], evidenceReferences: [] } }), stdio: 'pipe' });
  assert.throws(() => approve('wrong-session'), error => error.status === 1);
  assert.equal(store.getQueueItemByCandidate(key).status, 'needs_review');
  const approved = JSON.parse(approve('mission-review-test'));
  assert.equal(approved.queueItem.status, 'approved');
  assert.equal(approved.queueItem.humanApprovedAt, null);
  assert.equal(approved.approvalSnapshot.authority.type, 'mission_agent');
  growthRun.finishGrowthRun(run.runId, { status: 'completed', stopReason: 'no_worthwhile_eligible_work', stopDetail: 'Review bridge test complete.' });
});
