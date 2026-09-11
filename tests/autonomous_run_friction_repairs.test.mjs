import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'xgrowth-friction-repairs-'));
const previousCwd = process.cwd();
process.chdir(tempDir);
process.env.X_ACCOUNT = 'ham_zax';

const rootUrl = pathToFileURL(`${repoRoot}${path.sep}`).href;
const store = await import(`${rootUrl}store.js`);
const autonomous = await import(`${rootUrl}autonomous_reply.js`);
const reconciliation = await import(`${rootUrl}publication_reconciliation.js`);
const growthRun = await import(`${rootUrl}growth_run.js`);
const pipeline = await import(`${rootUrl}pipeline.js`);
const drafting = await import(`${rootUrl}drafting.js`);
const behavior = await import(`${rootUrl}behavior.js`);
const strategy = await import(`${rootUrl}strategy.js`);
const runtime = await import(`${rootUrl}growth_agent_runtime.js`);
const operatorLease = await import(`${rootUrl}operator_lease.js`);

function candidate(key, text = 'AI agent API runtime tooling for developers') {
  return {
    key,
    source: 'x',
    title: '@builder',
    text,
    url: key,
    timestamp: Date.now(),
    metrics: { views: 100, likes: 5, retweets: 1, replies: 1 },
  };
}

function liveReplyGrant(revision = 7, budgetUsed = 0) {
  return {
    state: 'running',
    mode: 'live',
    revision,
    liveBudget: 10,
    budgetUsed,
    allowedSources: ['active', 'momentum', 'normal'],
    allowedIntents: ['technical_insight', 'social_reaction'],
    allowedTones: ['direct', 'conversational', 'warm'],
    humorAllowed: true,
    refreshMinutes: 30,
    discoveryWatermarkAt: 1,
  };
}

function createAutonomousReply({ key, tweetId, exactReply, grantRevision = 7 }) {
  store.upsertCandidates([candidate(key)]);
  const item = store.ensureEngagementItem({
    candidateKey: key,
    targetTweetId: tweetId,
    targetUsername: 'builder',
    engagementKind: 'initial_reply',
    status: 'drafting',
    priority: 60,
    contributionSummary: 'Add one useful implementation constraint.',
  });
  const decision = store.recordAutonomousReplyDecision({
    queueItemId: item.id,
    candidateKey: key,
    targetTweetId: tweetId,
    targetUsername: 'builder',
    sourceClass: 'normal',
    intent: 'technical_insight',
    tone: 'direct',
    exactReply,
    grantRevision,
    mode: 'live',
    decision: 'eligible_live',
  });
  return { item, decision };
}

function runBridge(command, payload) {
  const output = execFileSync(process.execPath, [path.join(repoRoot, 'agent_bridge.js'), command], {
    cwd: tempDir,
    input: `${JSON.stringify(payload)}\n`,
    encoding: 'utf8',
    env: { ...process.env, X_ACCOUNT: 'ham_zax' },
  });
  return JSON.parse(output);
}

await test('confirmed_not_sent atomically restores an autonomous reply for exact retry without double-refunding budget', () => {
  store.saveAutonomousReplyGrantState(liveReplyGrant(7, 0));
  const key = 'https://x.com/builder/status/1001';
  const exactReply = 'Capability scope is the runtime boundary that matters here.';
  const { decision } = createAutonomousReply({ key, tweetId: '1001', exactReply });
  const first = store.claimAutonomousReplyDecision(decision.id, {
    grantRevision: 7,
    now: 10_000,
    transport: 'browser_agent',
    claimHolder: 'session-a',
  });
  assert.ok(first?.attempt?.attemptId);
  assert.equal(store.getAutonomousReplyGrantState().budgetUsed, 1);

  const recovered = reconciliation.confirmPublicationAttemptNotSent(first.attempt.attemptId, {
    reason: 'Controlled browser test proved the mutation was never dispatched.',
    evidence: {
      sendBoundaryCrossed: false,
      composerStillOpen: true,
      notSentProof: { kind: 'mutation_not_dispatched', detail: 'The controlled test transport did not invoke a mutation.' },
    },
    now: 11_000,
  });
  assert.equal(recovered.queueItem.status, 'drafting');
  assert.equal(recovered.autonomousReplyDecision.decision, 'eligible_live');
  assert.equal(recovered.autonomousReplyDecision.exactReply, exactReply);
  assert.equal(recovered.autonomousReplyDecision.claimedAt, null);
  assert.equal(recovered.autonomousReplyBudgetRefunded, true);
  assert.equal(store.getAutonomousReplyGrantState().budgetUsed, 0);

  const repeated = reconciliation.confirmPublicationAttemptNotSent(first.attempt.attemptId, {
    reason: 'Controlled browser test proved the mutation was never dispatched.',
    evidence: {
      sendBoundaryCrossed: false,
      composerStillOpen: true,
      notSentProof: { kind: 'mutation_not_dispatched', detail: 'The controlled test transport did not invoke a mutation.' },
    },
    now: 12_000,
  });
  assert.equal(repeated.autonomousReplyBudgetRefunded, false);
  assert.equal(store.getAutonomousReplyGrantState().budgetUsed, 0);
  assert.equal(repeated.autonomousReplyDecision.exactReply, exactReply);

  const retry = store.claimAutonomousReplyDecision(decision.id, {
    grantRevision: 7,
    now: 13_000,
    transport: 'browser_agent',
    claimHolder: 'session-a',
  });
  assert.ok(retry?.attempt?.attemptId);
  assert.notEqual(retry.attempt.attemptId, first.attempt.attemptId);
  assert.equal(store.getAutonomousReplyGrantState().budgetUsed, 1);
});

await test('confirmed_not_sent never rewinds sent evidence and does not restore a stale grant revision', () => {
  store.saveAutonomousReplyGrantState(liveReplyGrant(20, 0));
  const key = 'https://x.com/builder/status/1002';
  const { decision } = createAutonomousReply({ key, tweetId: '1002', exactReply: 'One bounded reply.', grantRevision: 20 });
  const claimed = store.claimAutonomousReplyDecision(decision.id, {
    grantRevision: 20,
    now: 20_000,
    transport: 'browser_agent',
    claimHolder: 'session-b',
  });
  store.saveAutonomousReplyGrantState(liveReplyGrant(21, 0));
  const stale = reconciliation.confirmPublicationAttemptNotSent(claimed.attempt.attemptId, {
    reason: 'Transport proved the request was not accepted.',
    evidence: {
      sendBoundaryCrossed: false,
      notSentProof: { kind: 'transport_rejected', detail: 'The test transport rejected the request before acceptance.' },
    },
    now: 21_000,
  });
  assert.equal(stale.queueItem.status, 'drafting');
  assert.equal(stale.autonomousReplyDecision.decision, 'skipped');
  assert.match(stale.autonomousReplyDecision.reasons[0].code, /AUTHORITY_CHANGED/);
  assert.equal(store.getAutonomousReplyGrantState().revision, 21);
  assert.equal(store.getAutonomousReplyGrantState().budgetUsed, 0);

  store.saveAutonomousReplyGrantState(liveReplyGrant(30, 0));
  const second = createAutonomousReply({
    key: 'https://x.com/builder/status/1003',
    tweetId: '1003',
    exactReply: 'This one already has output evidence.',
    grantRevision: 30,
  });
  const sentClaim = store.claimAutonomousReplyDecision(second.decision.id, {
    grantRevision: 30,
    now: 30_000,
    transport: 'browser_agent',
    claimHolder: 'session-c',
  });
  store.updateAutonomousReplyDecision(second.decision.id, {
    decision: 'sent',
    sentAt: 31_000,
    outputTweetId: '9001',
    outputUrl: 'https://x.com/ham_zax/status/9001',
    updatedAt: 31_000,
  });
  assert.throws(() => reconciliation.confirmPublicationAttemptNotSent(sentClaim.attempt.attemptId, {
    reason: 'Contradictory recovery must fail.',
    evidence: {
      sendBoundaryCrossed: false,
      notSentProof: { kind: 'transport_rejected', detail: 'Synthetic contradictory evidence for the invariant test.' },
    },
    now: 32_000,
  }), /cannot rewind/);
});

await test('composer persistence alone cannot create retry authority; late positive evidence corrects legacy unresolved truth', () => {
  store.saveAutonomousReplyGrantState(liveReplyGrant(35, 0));
  const key = 'https://x.com/builder/status/1004';
  const exactReply = 'The browser result is not the publication result.';
  const { decision } = createAutonomousReply({ key, tweetId: '1004', exactReply, grantRevision: 35 });
  const claimed = store.claimAutonomousReplyDecision(decision.id, {
    grantRevision: 35,
    now: 40_000,
    transport: 'browser_agent',
    claimHolder: 'session-d',
  });
  store.markPublicationAttemptSendStarted(claimed.attempt.attemptId, {
    now: 41_000,
    preSendEvidence: { targetTweetId: '1004' },
  });

  assert.throws(() => reconciliation.confirmPublicationAttemptNotSent(claimed.attempt.attemptId, {
    reason: 'The composer still looks unchanged.',
    evidence: {
      sendBoundaryCrossed: false,
      composerStillOpen: true,
      exactTextStillPresent: true,
      replyButtonStillPresent: true,
      sentToastObserved: false,
    },
    now: 42_000,
  }), /definitive evidence\.notSentProof/);
  assert.equal(store.getPublicationAttempt(claimed.attempt.attemptId).state, 'send_started');
  assert.equal(store.getAutonomousReplyDecision(decision.id).decision, 'sending');

  store.transitionPublicationAttempt(claimed.attempt.attemptId, {
    state: 'confirmed_not_sent',
    reconciliationEvidence: {
      sendBoundaryCrossed: false,
      composerStillOpen: true,
      exactTextStillPresent: true,
      replyButtonStillPresent: true,
    },
    closureReason: 'Legacy UI-only no-send conclusion.',
    now: 43_000,
  });
  const migration = reconciliation.ensureLegacyPublicationAttemptMigration({ now: 44_000 });
  assert.ok(migration.correctedConfirmedNotSent.includes(claimed.attempt.attemptId));
  assert.equal(store.getPublicationAttempt(claimed.attempt.attemptId).state, 'closed_unresolved');
  assert.equal(store.getQueueItem(claimed.queueItem.id).status, 'unresolved');
  assert.equal(store.getAutonomousReplyDecision(decision.id).decision, 'reconciliation_required');
  store.saveQueueItem({ ...store.getQueueItem(claimed.queueItem.id), expiresAt: 1 });
  runBridge('engage-refresh', {});
  assert.equal(store.getQueueItem(claimed.queueItem.id).status, 'unresolved');

  const corrected = runBridge('record-action', {
    key,
    action: 'reply',
    attemptId: claimed.attempt.attemptId,
    outputTweetId: '9901',
    outputUrl: 'https://x.com/ham_zax/status/9901',
    actedAt: 45_000,
    publicationVerification: {
      parentTweetId: '1004',
      outputText: exactReply,
      verifiedBy: 'test_structural_verification',
    },
  });
  assert.equal(corrected.reconciledQueue.status, 'published');
  assert.equal(corrected.reconciledQueue.outputTweetId, '9901');
  assert.equal(corrected.autonomousReplyDecision.decision, 'sent');
  assert.equal(corrected.autonomousReplyDecision.outputTweetId, '9901');
  const correctedAttempt = store.getPublicationAttempt(claimed.attempt.attemptId);
  assert.equal(correctedAttempt.state, 'confirmed_published');
  assert.equal(correctedAttempt.reconciliationEvidence.correction.fromState, 'closed_unresolved');
});

await test('active run-scoped agent priority survives heuristic refresh and can route an advisory Ignore', () => {
  store.configureGrowthOperatorDelegation({ mode: 'live' }, { actor: 'human' });
  store.startGrowthOperatorDelegation({ actor: 'human' });
  const run = growthRun.beginGrowthRun({
    adapterType: 'test_adapter',
    sessionId: 'priority-session',
    capabilities: { reasoning: true, browser_read: true, browser_mutation: true, x_authenticated: true },
    now: Date.now(),
  }).run;

  const key = 'https://x.com/builder/status/2001';
  store.upsertCandidates([candidate(key, 'Agent runtime API implementation note')]);
  pipeline.ensureCandidateWorkflow(key);
  let queueItem = store.getQueueItemByCandidate(key);
  queueItem = store.saveQueueItem({
    ...queueItem,
    routingDecision: {
      ...(queueItem.routingDecision || {}),
      agentPriorityJudgment: {
        score: 62,
        heuristicPriority: -25,
        reason: 'Live inspection shows a relevant agent/API opportunity despite the advisory recommendation.',
        signals: { source: 'x_for_you' },
        actor: 'operator',
        candidateKey: key,
        runId: run.runId,
        sessionId: 'priority-session',
        selectedAt: Date.now(),
      },
    },
  });
  assert.equal(pipeline.getActiveAgentPriorityJudgment(queueItem)?.score, 62);
  const routed = pipeline.routeCandidate(key, 'reply', { actor: 'agent', reason: 'Run-scoped judgment selects a Reply.' });
  assert.equal(routed.lane, 'engagement');
  assert.equal(routed.pipeline, 'reply');
  assert.equal(routed.routingDecision.agentPriorityJudgment.score, 62);

  const staleKey = 'https://x.com/builder/status/2002';
  store.upsertCandidates([candidate(staleKey, 'Agent runtime API implementation note')]);
  pipeline.ensureCandidateWorkflow(staleKey);
  const staleQueue = store.getQueueItemByCandidate(staleKey);
  store.saveQueueItem({
    ...staleQueue,
    routingDecision: {
      agentPriorityJudgment: {
        score: 90,
        heuristicPriority: -25,
        reason: 'Wrong session must not override anything.',
        signals: {},
        actor: 'operator',
        candidateKey: staleKey,
        runId: run.runId,
        sessionId: 'other-session',
        selectedAt: Date.now(),
      },
    },
  });
  assert.throws(() => pipeline.routeCandidate(staleKey, 'reply', { actor: 'agent' }), /no active run-scoped agent priority judgment/);
  growthRun.finishGrowthRun(run.runId, {
    status: 'completed',
    stopReason: 'no_worthwhile_eligible_work',
    stopDetail: 'Test run complete.',
    now: Date.now(),
  });
});

await test('send-start needs only attemptId and validates the immutable run/session claim provenance', () => {
  const delegation = store.getGrowthOperatorDelegation();
  if (delegation.state !== 'running') store.startGrowthOperatorDelegation({ actor: 'human' });
  store.saveAutonomousReplyGrantState(liveReplyGrant(40, 0));
  const run = growthRun.beginGrowthRun({
    adapterType: 'test_adapter',
    sessionId: 'send-start-session',
    capabilities: { reasoning: true, browser_read: true, browser_mutation: true, x_authenticated: true },
    now: Date.now(),
  }).run;
  const key = 'https://x.com/builder/status/3001';
  const { decision } = createAutonomousReply({ key, tweetId: '3001', exactReply: 'The claim already knows its session.', grantRevision: 40 });
  const claimed = store.claimAutonomousReplyDecision(decision.id, {
    grantRevision: 40,
    runId: run.runId,
    claimHolder: 'send-start-session',
    now: Date.now(),
    transport: 'browser_agent',
  });
  const result = runBridge('publication-attempt-send-start', { attemptId: claimed.attempt.attemptId });
  assert.equal(result.attempt.state, 'send_started');
  assert.equal(result.attempt.runId, run.runId);

  reconciliation.confirmPublicationAttemptNotSent(claimed.attempt.attemptId, {
    reason: 'Test transport did not execute.',
    evidence: {
      sendBoundaryCrossed: false,
      notSentProof: { kind: 'mutation_not_dispatched', detail: 'The send-start test never invoked a transport mutation.' },
    },
    now: Date.now(),
  });
  growthRun.finishGrowthRun(run.runId, {
    status: 'completed',
    stopReason: 'no_worthwhile_eligible_work',
    stopDetail: 'Test run complete.',
    now: Date.now(),
  });
});

await test('valid run-bound bridge activity renews only the matching operator lease', async () => {
  store.configureGrowthOperatorDelegation({ mode: 'live' }, { actor: 'human' });
  const delegation = store.getGrowthOperatorDelegation();
  if (delegation.state !== 'running') store.startGrowthOperatorDelegation({ actor: 'human' });
  store.saveAutonomousReplyGrantState(liveReplyGrant(41, 0));
  const startedAt = Date.now();
  const sessionId = 'lease-renew-session';
  const run = growthRun.beginGrowthRun({
    adapterType: 'test_adapter',
    sessionId,
    capabilities: { reasoning: true, browser_read: true, browser_mutation: true, x_authenticated: true },
    ceilings: { maxDurationMinutes: 60, maxObservations: 50, maxPublicMutations: 10 },
    now: startedAt,
  }).run;
  const key = 'https://x.com/builder/status/3002';
  const { decision } = createAutonomousReply({ key, tweetId: '3002', exactReply: 'Lease renewal stays bound to the current run and session.', grantRevision: 41 });
  const claimed = store.claimAutonomousReplyDecision(decision.id, {
    grantRevision: 41,
    runId: run.runId,
    claimHolder: sessionId,
    now: startedAt + 1_000,
    transport: 'browser_agent',
  });
  const cleanupAt = startedAt + 50 * 60_000;

  try {
    const initialLease = operatorLease.getOperatorLeaseStatus({ now: startedAt + 1_000 });
    assert.equal(initialLease.active, true);
    assert.equal(initialLease.runId, run.runId);
    assert.equal(initialLease.sessionId, sessionId);

    assert.throws(() => runBridge('operator-priority-set', {
      runId: run.runId,
      sessionId: 'wrong-session',
      key,
      score: 60,
      reason: 'Wrong session must not refresh this lease.',
      now: startedAt + 13 * 60_000,
    }), /leased to session/);
    assert.throws(() => runBridge('operator-priority-set', {
      runId: 'wrong-run',
      sessionId,
      key,
      score: 60,
      reason: 'Wrong run must not refresh this lease.',
      now: startedAt + 13 * 60_000,
    }), /does not own the active operator lease/);
    assert.equal(operatorLease.getOperatorLeaseStatus({ now: startedAt + 13 * 60_000 }).expiresAt, initialLease.expiresAt);

    const beforeActivity = operatorLease.getOperatorLeaseStatus({ now: startedAt + 14 * 60_000 });
    const sendStarted = runBridge('publication-attempt-send-start', {
      attemptId: claimed.attempt.attemptId,
      now: startedAt + 14 * 60_000,
    });
    assert.equal(sendStarted.attempt.state, 'send_started');
    const afterActivity = operatorLease.getOperatorLeaseStatus({ now: startedAt + 14 * 60_000 });
    assert.equal(afterActivity.leaseId, initialLease.leaseId);
    assert.equal(afterActivity.runId, run.runId);
    assert.equal(afterActivity.sessionId, sessionId);
    assert.ok(afterActivity.expiresAt > beforeActivity.expiresAt);

    await growthRun.advanceGrowthRun(run.runId, { now: startedAt + 28 * 60_000 });
    const afterGrowthNext = operatorLease.getOperatorLeaseStatus({ now: startedAt + 28 * 60_000 });
    assert.equal(afterGrowthNext.leaseId, initialLease.leaseId);
    assert.ok(afterGrowthNext.expiresAt > afterActivity.expiresAt);

    reconciliation.confirmPublicationAttemptNotSent(claimed.attempt.attemptId, {
      reason: 'Lease renewal test never invoked a transport mutation.',
      evidence: {
        sendBoundaryCrossed: false,
        notSentProof: { kind: 'mutation_not_dispatched', detail: 'The deterministic test did not invoke a browser mutation.' },
      },
      now: startedAt + 28 * 60_000 + 1_000,
    });

    const otherAt = startedAt + 44 * 60_000;
    assert.equal(operatorLease.getOperatorLeaseStatus({ now: otherAt }).active, false);
    const otherLease = operatorLease.acquireOperatorLease({
      now: otherAt,
      holder: 'other_operator',
      runId: 'other-run',
      adapterType: 'other_adapter',
      sessionId: 'other-session',
    });
    assert.throws(() => runBridge('operator-priority-set', {
      runId: run.runId,
      sessionId,
      key,
      score: 60,
      reason: 'Expired run must not steal another operator lease.',
      now: otherAt + 1,
    }), /does not own the active operator lease/);
    const stillOther = operatorLease.getOperatorLeaseStatus({ now: otherAt + 1 });
    assert.equal(stillOther.leaseId, otherLease.leaseId);
    assert.equal(stillOther.runId, 'other-run');
    assert.equal(stillOther.sessionId, 'other-session');
    operatorLease.releaseOperatorLease(otherLease.leaseId, { now: otherAt + 2 });
  } finally {
    const active = operatorLease.getOperatorLeaseStatus({ now: cleanupAt });
    if (active.active) {
      try { operatorLease.releaseOperatorLease(active.leaseId, { now: cleanupAt }); } catch {}
    }
    growthRun.finishGrowthRun(run.runId, {
      status: 'completed',
      stopReason: 'no_worthwhile_eligible_work',
      stopDetail: 'Lease renewal test complete.',
      now: cleanupAt,
    });
  }
});

await test('social and relationship reply relevance can come from a known builder relationship without technical keywords in the target sentence', () => {
  const key = 'https://x.com/socialbuilder/status/3501';
  store.upsertCandidates([candidate(key, 'Yep, exactly. That is the next test.')]);
  store.upsertRelationshipProfile({
    username: 'socialbuilder',
    displayName: 'Social Builder',
    primaryTopics: ['agents', 'developer tools'],
    matchedKeywords: ['agents'],
    targetScore: 70,
    relevanceScore: 40,
    relationshipStage: 'mutual',
    mutual: true,
  });
  const behavior = {
    decision: 'ACT',
    pipeline: 'reply',
    primaryPurpose: 'relationship',
    secondaryPurposes: ['social_presence'],
    socialMode: 'supporter',
    affectStrategy: 'match',
    affectProvenance: 'inferred',
    informationDepth: 'social_only',
    conversationStage: 'familiar',
    reasonToExist: 'Continue a reciprocal builder conversation naturally.',
    selectionSource: 'operator',
  };
  const direct = store.getCandidate(key);
  const relationship = store.getRelationshipProfile('socialbuilder');
  const relevance = strategy.assessActionRelevance(direct, { pipeline: 'reply', behavior, relationship });
  assert.equal(relevance.allowed, true);
  assert.equal(relevance.state, 'contextual');
  assert.ok(relevance.reasonCodes.includes('RELEVANT_RELATIONSHIP_CONTEXT'));
});

await test('social-only autonomous reply above the priority floor no longer requires an existing relationship or momentum', async () => {
  store.saveAutonomousReplyGrantState({
    ...liveReplyGrant(50, 0),
    allowedIntents: ['social_reaction'],
  });
  const key = 'https://x.com/newbuilder/status/3601';
  store.upsertCandidates([candidate(key, 'AI agent developer tooling milestone shipped today')]);
  const selectedBehavior = {
    decision: 'ACT',
    pipeline: 'reply',
    primaryPurpose: 'celebration',
    secondaryPurposes: ['discovery'],
    socialMode: 'supporter',
    affectStrategy: 'reward',
    affectProvenance: 'strategic',
    informationDepth: 'social_only',
    conversationStage: 'initial',
    reasonToExist: 'Celebrate a relevant builder milestone without manufacturing technical analysis.',
    selectionSource: 'operator',
  };
  const item = store.ensureEngagementItem({
    candidateKey: key,
    targetTweetId: '3601',
    targetUsername: 'newbuilder',
    engagementKind: 'initial_reply',
    status: 'drafting',
    priority: 35,
    replyArchetype: 'celebration',
    contributionSummary: 'Celebrate the milestone naturally.',
    behavior: selectedBehavior,
  });
  store.saveDraft({
    candidateKey: key,
    body: 'That AI agent tooling milestone is worth celebrating — congrats on shipping it.',
    status: 'draft',
    qualityScore: 0,
    editor: { pipeline: 'reply', behavior: selectedBehavior },
  });
  const queued = store.getQueueItem(item.id);
  const savedDraft = store.getDraftByCandidate(key);
  const operatorAnalysis = drafting.scoreDraft(savedDraft, store.getCandidate(key), {
    pipeline: 'reply',
    behavior: queued.behavior,
    relationship: null,
    recentPosts: [],
    recentReplies: [],
    recentReplyArchetypes: [],
  });
  assert.equal(operatorAnalysis.publishable, true, JSON.stringify({ gates: operatorAnalysis.gates, packaging: operatorAnalysis.growthPackaging }));
  const evaluation = await autonomous.evaluateAutonomousReplyItem(queued, {
    grant: store.getAutonomousReplyGrantState(),
    allowOperatorDraft: true,
  });
  assert.equal(evaluation.decision, 'send', JSON.stringify({ reasons: evaluation.reasons, checks: evaluation.checks }));
  assert.equal(evaluation.intent, 'social_reaction');
  assert.equal(evaluation.exactReply, 'That AI agent tooling milestone is worth celebrating — congrats on shipping it.');
});

await test('support purpose accepts concrete participation in a creator showcase without making generic filler sufficient', async () => {
  const sourceText = 'I built a physical Codex pet for OpenAI Dev Day! Should I make more to give away? And what features?';
  const exactReply = 'Definitely make more. Feature request: it purrs when a PR merges and gives a quiet angry chirp every time CI fails.';
  assert.equal(behavior.socialPurposeContextAvailable({ purpose: 'support', sourceText }), true);
  assert.equal(behavior.socialPurposeContextAvailable({ purpose: 'support', sourceText: 'A database query planner chooses a join order.' }), false);
  assert.equal(behavior.socialPurposeContextAvailable({ purpose: 'support', sourceText: 'I made a tiny hardware dashboard. Ideas for what I should add?' }), true);
  assert.equal(behavior.socialPurposeContextAvailable({ purpose: 'support', sourceText: 'We shipped the release today.' }), true);
  assert.equal(behavior.socialPurposeContextAvailable({ purpose: 'support', sourceText: 'Thanks to everyone who tested the beta.' }), true);
  assert.equal(behavior.socialPurposeContextAvailable({ purpose: 'support', sourceText: 'Ordinary update.', relationshipContext: true }), true);

  store.saveAutonomousReplyGrantState({
    ...liveReplyGrant(51, 0),
    allowedIntents: ['social_reaction'],
  });
  const key = 'https://x.com/natalieyeo/status/2098195154549285240';
  store.upsertCandidates([{ ...candidate(key, sourceText), title: '@natalieyeo' }]);
  const selectedBehavior = {
    decision: 'ACT',
    pipeline: 'reply',
    primaryPurpose: 'support',
    secondaryPurposes: ['humor', 'relationship'],
    socialMode: 'supporter',
    affectStrategy: 'match',
    affectProvenance: 'strategic',
    informationDepth: 'social_only',
    conversationStage: 'initial',
    reasonToExist: 'Support a builder showcase and answer the explicit feature request with one playful, concrete suggestion.',
    selectionSource: 'operator',
  };
  const item = store.ensureEngagementItem({
    candidateKey: key,
    targetTweetId: '2098195154549285240',
    targetUsername: 'natalieyeo',
    engagementKind: 'initial_reply',
    status: 'drafting',
    priority: 29.5,
    replyArchetype: 'support',
    contributionSummary: 'Answer the feature request with a concrete supportive suggestion.',
    behavior: selectedBehavior,
  });
  store.saveDraft({
    candidateKey: key,
    body: exactReply,
    status: 'draft',
    qualityScore: 0,
    editor: { pipeline: 'reply', behavior: selectedBehavior, finalText: exactReply },
  });
  const queued = store.getQueueItem(item.id);
  const analysis = drafting.scoreDraft(store.getDraftByCandidate(key), store.getCandidate(key), {
    pipeline: 'reply',
    behavior: queued.behavior,
    relationship: null,
    recentPosts: [],
    recentReplies: [],
    recentReplyArchetypes: [],
  });
  assert.equal(analysis.gates.failures.some((failure) => failure.code === 'PURPOSE_CONTEXT_WEAK'), false, JSON.stringify(analysis.gates.failures));
  assert.equal(analysis.gates.passed, true, JSON.stringify(analysis.gates.failures));
  const generic = drafting.scoreDraft({
    ...store.getDraftByCandidate(key),
    body: 'Nice project!',
    editor: { pipeline: 'reply', behavior: selectedBehavior, finalText: 'Nice project!' },
  }, store.getCandidate(key), {
    pipeline: 'reply',
    behavior: queued.behavior,
    relationship: null,
    recentPosts: [],
    recentReplies: [],
    recentReplyArchetypes: [],
  });
  assert.equal(generic.publishable, false);
  const live = await autonomous.ensureAutonomousReplyLiveDecision(queued, { grant: store.getAutonomousReplyGrantState() });
  assert.equal(live.decision?.decision, 'eligible_live', JSON.stringify({ reason: live.reason, evaluation: live.evaluation }));
  assert.equal(live.decision?.exactReply, exactReply);
  assert.equal(live.evaluation?.checks?.reusedOperatorDraft, true);
});

await test('For You ingest immediately materializes only the observed candidates into engagement work', () => {
  const tweetId = '2098179923215339940';
  const key = `https://x.com/testbuilder/status/${tweetId}`;
  const result = runBridge('x-for-you-ingest', {
    kind: 'x_for_you',
    observedAt: Date.now(),
    accountHandle: 'ham_zax',
    adapterType: 'test_adapter',
    sessionId: 'fy-session',
    runId: '',
    browserTarget: 'windows',
    browserBackend: 'chrome',
    sensorVersion: 'test_v1',
    collectionStatus: 'complete',
    posts: [{
      tweetId,
      username: 'testbuilder',
      url: key,
      text: 'AI agents and developer tooling need better runtime capability boundaries.',
      rank: 1,
      metrics: { views: 500, likes: 20, reposts: 3, replies: 4, bookmarks: 8 },
    }],
  });
  assert.equal(result.ingest.acceptedCount, 1);
  assert.deepEqual(result.engagement.candidateKeys, [key]);
  const item = store.getQueueItemByCandidate(key);
  assert.ok(item, JSON.stringify(result.engagement));
  assert.equal(item.lane, 'engagement');
  assert.equal(item.pipeline, 'reply');

  const refreshed = runBridge('engage-refresh', { key });
  assert.ok(refreshed.refresh.refreshed <= 1);
  assert.match(refreshed.nextStep, /locally materialized/);
});

await test('reasoning heartbeat stays attached for the operator-lease lifetime and run-bound activity renews it', () => {
  const now = Date.now();
  runtime.heartbeatGrowthAgentRuntime({
    adapterType: 'test_adapter',
    sessionId: 'heartbeat-session',
    runId: 'heartbeat-run',
    accountHandle: 'ham_zax',
    capabilities: { reasoning: true, browser_read: true },
    now,
  });
  assert.equal(runtime.getGrowthAgentRuntimeStatus({ now: now + 6 * 60_000 }).attached, true);
  assert.equal(runtime.getGrowthAgentRuntimeStatus({ now: now + 14 * 60_000 }).attached, true);
  const renewed = runtime.renewGrowthAgentRuntimeHeartbeat({
    adapterType: 'test_adapter',
    sessionId: 'heartbeat-session',
    now: now + 14 * 60_000,
  });
  assert.equal(renewed.attached, true);
  assert.equal(renewed.runId, 'heartbeat-run');
  assert.equal(renewed.accountHandle, 'ham_zax');
  assert.equal(renewed.capabilities.reasoning, true);
  assert.equal(runtime.getGrowthAgentRuntimeStatus({ now: now + 28 * 60_000 }).attached, true);
  assert.equal(runtime.getGrowthAgentRuntimeStatus({ now: now + 30 * 60_000 }).attached, false);
});

await test('AGY runtime resolution is independent of the service PATH', () => {
  const node = process.execPath;
  const script = `import {getAiCliAvailability} from ${JSON.stringify(`${rootUrl}ai_cli.js`)}; console.log(JSON.stringify(await getAiCliAvailability('agy',{timeoutMs:5000})));`;
  const output = execFileSync(node, ['--input-type=module', '-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      HOME: os.homedir(),
      PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      X_ACCOUNT: 'ham_zax',
    },
  });
  const availability = JSON.parse(output);
  assert.equal(availability.installed, true);
  assert.equal(availability.runtime, 'agy');
});

await test('Reply packaging distinguishes descriptive install wording from a promised resource path', () => {
  const key = 'https://x.com/builder/status/4001';
  store.upsertCandidates([candidate(key, 'AI agents and developer tools compare install-time auditing with runtime capabilities.')]);
  const storedCandidate = store.getCandidate(key);
  const selectedBehavior = {
    decision: 'ACT',
    pipeline: 'reply',
    primaryPurpose: 'technical_value',
    secondaryPurposes: [],
    socialMode: 'explainer',
    affectStrategy: 'neutral',
    affectProvenance: 'none',
    informationDepth: 'compact_reason',
    conversationStage: 'initial',
    reasonToExist: 'Name the runtime constraint that changes the decision.',
  };
  const context = {
    pipeline: 'reply',
    behavior: selectedBehavior,
    recentPosts: [],
    recentReplies: [],
    recentReplyArchetypes: [],
  };
  for (const body of [
    'Pre-install auditing helps, but runtime capability scoping is the real boundary once the agent can invoke tools, network access, and filesystem paths.',
    'The install receipt should bind the audited revision and permission set so the trust boundary stays inspectable.',
    'An install recommendation without revision identity is weaker evidence than a content-addressed audit record.',
    'The install step is separate from the runtime permission boundary.',
    'Does the installer pin the exact audited revision before execution?',
  ]) {
    const analysis = drafting.scoreDraft({ body, editor: { pipeline: 'reply', behavior: selectedBehavior } }, storedCandidate, context);
    assert.equal(analysis.growthPackaging.blockers.some((blocker) => blocker.code === 'RESOURCE_ACTION_PATH_MISSING'), false, body);
    assert.notEqual(analysis.growthPackaging.items.sourceActionPath.status, 'blocked', body);
  }

  const missingPath = drafting.scoreDraft({
    body: 'Install this, it fixes the issue.',
    editor: { pipeline: 'reply', behavior: selectedBehavior },
  }, storedCandidate, context);
  assert.equal(missingPath.growthPackaging.ready, false);
  assert.equal(missingPath.growthPackaging.items.sourceActionPath.status, 'blocked');
  assert.equal(missingPath.growthPackaging.blockers.some((blocker) => blocker.code === 'RESOURCE_ACTION_PATH_MISSING'), true);
});

await test('Dan operator draft clears packaging and is reused by the live autonomous evaluator', async () => {
  store.saveAutonomousReplyGrantState({
    ...liveReplyGrant(52, 0),
    allowedIntents: ['useful_question'],
  });
  const key = 'https://x.com/DanKornas/status/2098173164106727820';
  const sourceText = 'Choosing an agent skill shouldn’t start with guessing which install command to trust. OpenAgentSkill is a GitHub project for agents and developers who need to find, compare, and audit reusable Agent Skills before installation.';
  const exactReply = 'The install receipt is the bit I’d pressure-test. Does it pin the exact skill revision + permission set that was audited, so the agent can’t inspect one thing and execute a newer/different one?';
  store.upsertCandidates([{ ...candidate(key, sourceText), title: '@DanKornas' }]);
  const selectedBehavior = {
    decision: 'ACT',
    pipeline: 'reply',
    primaryPurpose: 'technical_value',
    secondaryPurposes: ['relationship'],
    socialMode: 'curious_peer',
    affectStrategy: 'match',
    affectProvenance: 'strategic',
    informationDepth: 'compact_reason',
    conversationStage: 'initial',
    reasonToExist: 'Ask whether the install receipt binds the recommendation to the exact skill revision and permission set that was audited.',
    selectionSource: 'operator',
  };
  const item = store.ensureEngagementItem({
    candidateKey: key,
    targetTweetId: '2098173164106727820',
    targetUsername: 'DanKornas',
    engagementKind: 'initial_reply',
    status: 'drafting',
    priority: 43.4,
    replyArchetype: 'informed_question',
    contributionSummary: 'Ask about the audited artifact identity boundary.',
    behavior: selectedBehavior,
  });
  store.saveDraft({
    candidateKey: key,
    body: exactReply,
    status: 'draft',
    qualityScore: 0,
    editor: { pipeline: 'reply', behavior: selectedBehavior, finalText: exactReply },
  });
  const queued = store.getQueueItem(item.id);
  const draft = store.getDraftByCandidate(key);
  const analysis = drafting.scoreDraft(draft, store.getCandidate(key), {
    pipeline: 'reply',
    behavior: queued.behavior,
    relationship: null,
    recentPosts: [],
    recentReplies: [],
    recentReplyArchetypes: [],
  });
  assert.equal(analysis.gates.passed, true, JSON.stringify(analysis.gates.failures));
  assert.equal(analysis.growthPackaging.ready, true, JSON.stringify(analysis.growthPackaging.blockers));
  assert.equal(analysis.growthPackaging.items.sourceActionPath.status, 'not_needed');
  const live = await autonomous.ensureAutonomousReplyLiveDecision(queued, { grant: store.getAutonomousReplyGrantState() });
  assert.equal(live.decision?.decision, 'eligible_live', JSON.stringify({ reason: live.reason, evaluation: live.evaluation }));
  assert.equal(live.decision?.exactReply, exactReply);
  assert.equal(live.evaluation?.checks?.reusedOperatorDraft, true);
});

process.chdir(previousCwd);
await rm(tempDir, { recursive: true, force: true });
