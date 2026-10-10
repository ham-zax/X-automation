import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const previousCwd = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), 'growth-run-priority-'));
process.chdir(scratch);
const store = await import('../store.js');
const pipeline = await import('../pipeline.js');
const drafting = await import('../drafting.js');
const review = await import('../content_review.js');
const growthRun = await import('../growth_run.js');

try {
  await test('a due approved main-feed claim precedes stale For You discovery', () => {
    const key = 'https://x.com/builder/status/808080';
    store.upsertCandidates([{ key, url: key, source: 'owner', title: '@builder',
      timestamp: Date.now(), metrics: { views: 20000, likes: 300, retweets: 30, replies: 10 },
      text: 'Agent API recovery should preserve valid state. Separate retry attempts from committed transactions so transient failures do not corrupt developer workflow.' }]);
    const behavior = { decision: 'ACT', primaryPurpose: 'technical_value', socialMode: 'explainer', informationDepth: 'compact_reason',
      affectStrategy: 'neutral', affectProvenance: 'none', reasonToExist: 'Explain agent recovery and reliable transactions.' };
    const queue = pipeline.routeCandidate(key, 'original', { actor: 'agent', routeContext: { behavior } });
    const draft = store.getDraftByCandidate(key);
    const current = { ...draft, body: 'Agent recovery needs a clear transaction boundary. Use separate tests for rejected edits and committed work.',
      editor: { pipeline: 'original', behavior, evidenceUsed: [] } };
    current.editor.contentReview = review.bindContentReview({ passed: true, factualClaims: [], ownerClaims: [], voiceIssues: [], issues: [] },
      drafting.draftReviewContext(current, store.getCandidate(key)));
    store.saveDraft(current);
    store.recordWritingStrategySelection({ queueItemId: queue.id, mode: 'off', selectionSource: 'manual', selectedBy: 'human' });
    pipeline.requestQueueReview(key);
    store.configureGrowthOperatorDelegation({ mode: 'live' });
    const grant = store.startGrowthOperatorDelegation();
    const { run } = growthRun.beginGrowthRun({ adapterType: 'test', sessionId: 'due-post-session',
      capabilities: { reasoning: true, browser_read: true, browser_mutation: true, x_authenticated: true } });
    const approved = pipeline.approveQueueItemAsMissionAgent(key, { grantRevision: grant.revision,
      verificationProvenance: { authorityType: 'mission_agent', sourceReferences: [key], evidenceReferences: [] } });
    const status = growthRun.getGrowthRunStatus(run.runId);
    assert.equal(status.readiness.sensors.xForYou.fresh, false);
    assert.equal(status.next.recommendedOperation, 'claim_action');
    assert.equal(status.next.claim.queueItemId, approved.queueItem.id);
    assert.equal(status.next.claim.runId, run.runId);
    assert.equal(status.next.claim.sessionId, 'due-post-session');
    assert.equal(approved.queueItem.humanApprovedAt, null);
    growthRun.finishGrowthRun(run.runId, { status: 'completed', stopReason: 'no_worthwhile_eligible_work' });
  });
} finally {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
}
