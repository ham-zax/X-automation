import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(tmpdir(), 'growth-production-state-'));
const previousCwd = process.cwd();
process.chdir(scratch);
const moduleUrl = name => pathToFileURL(path.join(root, name)).href;
const store = await import(moduleUrl('store.js'));
const lease = await import(moduleUrl('operator_lease.js'));
const growth = await import(moduleUrl('growth_run.js'));
const reconciliation = await import(moduleUrl('publication_reconciliation.js'));
const db = new DatabaseSync(store.DB_FILE);
const exec = promisify(execFile);

function source(id) {
  const key = `https://x.com/builder/status/${id}`;
  store.upsertCandidates([{ key, source: 'x', title: '@builder', text: 'Developer tooling and runtime API engineering', url: key, timestamp: Date.now() }]);
  return key;
}
function reply(id) {
  const key = source(id);
  const item = store.ensureEngagementItem({ candidateKey: key, targetTweetId: String(id), targetUsername: 'builder', status: 'drafting', priority: 60 });
  const decision = store.recordAutonomousReplyDecision({ queueItemId: item.id, candidateKey: key, targetTweetId: String(id), targetUsername: 'builder', exactReply: `Runtime scope matters for ${id}.`, sourceClass: 'normal', grantRevision: 7, mode: 'live', decision: 'eligible_live' });
  return { item, decision };
}
function grant() {
  store.saveAutonomousReplyGrantState({ state: 'running', mode: 'live', revision: 7, liveBudget: 100, budgetUsed: 0 });
}
function start(options = {}) {
  store.configureGrowthOperatorDelegation({ mode: 'live' }, { actor: 'human' });
  if (store.getGrowthOperatorDelegation().state !== 'running') store.startGrowthOperatorDelegation({ actor: 'human' });
  return growth.beginGrowthRun({ adapterType: 'test', sessionId: 'production-state', capabilities: { reasoning: true }, ...options }).run;
}
function finish(run) {
  growth.finishGrowthRun(run.runId, { stopReason: 'no_worthwhile_eligible_work', status: 'completed' });
}
function claim(decision, run, now = Date.now()) {
  return store.claimAutonomousReplyDecision(decision.id, { grantRevision: 7, runId: run?.runId, claimHolder: run?.sessionId || 'test', now });
}

try {
  await test('competing processes cannot acquire the same operator lease', async () => {
    const barrier = Date.now() + 1400;
    const script = `import {acquireOperatorLease} from ${JSON.stringify(moduleUrl('operator_lease.js'))}; await new Promise(r=>setTimeout(r,Math.max(0,${barrier}-Date.now()))); try { const x=acquireOperatorLease({holder:String(process.pid)}); console.log(JSON.stringify({ok:true,id:x.leaseId})); } catch { console.log(JSON.stringify({ok:false})); }`;
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => exec(process.execPath, ['--input-type=module', '-e', script], { cwd: scratch, maxBuffer: 100_000 })));
    const wins = outcomes.map(result => JSON.parse(result.stdout)).filter(result => result.ok);
    assert.equal(wins.length, 1);
    lease.releaseOperatorLease(wins[0].id);
  });
  await test('stale draft writes reject without losing newer edits or published identity', () => {
    const key = source(7101);
    const initial = store.saveDraft({ candidateKey: key, body: 'Initial', editor: {}, status: 'draft' });
    const changed = store.saveDraft({ ...initial, body: 'Newer' });
    assert.throws(() => store.saveDraft({ ...initial, body: 'Late AI completion' }), /changed while/);
    const published = store.saveDraft({ ...changed, status: 'published', publishedTweetId: '777' });
    assert.throws(() => store.saveDraft({ ...published, body: 'Overwrite', status: 'draft', publishedTweetId: null }), /immutable/);
    assert.throws(() => store.deleteDraft(published.id), /cannot be deleted/);
    assert.equal(store.getDraft(published.id).publishedTweetId, '777');
    assert.equal(store.getDraft(published.id).body, 'Newer');
  });
  await test('claims reserve the run ceiling atomically and rejected claims roll back all state', () => {
    grant();
    const run = start({ ceilings: { maxDurationMinutes: 1, maxPublicMutations: 1 } });
    const first = reply(7102), second = reply(7103);
    const reserved = claim(first.decision, run);
    assert.throws(() => claim(second.decision, run), /mutation ceiling/);
    assert.equal(store.getQueueItem(second.item.id).status, 'drafting');
    assert.equal(store.getAutonomousReplyDecision(second.decision.id).claimedAt, null);
    assert.equal(store.getAutonomousReplyGrantState().budgetUsed, 1);
    store.markPublicationAttemptSendStarted(reserved.attempt.attemptId);
    assert.throws(() => store.markPublicationAttemptSendStarted(reserved.attempt.attemptId), /cannot be replayed/);
    assert.equal(store.getPublicationAttemptCounts({ runId: run.runId }).send_started, 1);
    finish(run);
  });
  await test('elapsed run cannot claim; a valid claim cannot send after the deadline', () => {
    grant();
    const expired = start({ now: Date.now() - 120_000, ceilings: { maxDurationMinutes: 1, maxPublicMutations: 2 } });
    const blocked = reply(7104);
    assert.throws(() => claim(blocked.decision, expired), /duration ceiling/);
    assert.equal(store.getQueueItem(blocked.item.id).status, 'drafting');
    finish(expired);
    const run = start({ ceilings: { maxDurationMinutes: 1, maxPublicMutations: 2 } });
    const pending = claim(blocked.decision, run);
    assert.throws(() => store.markPublicationAttemptSendStarted(pending.attempt.attemptId, { now: run.startedAt + 60_000 }), /duration ceiling/);
    assert.equal(store.getPublicationAttempt(pending.attempt.attemptId).state, 'claimed');
    finish(run);
  });
  await test('active session ownership cannot be replaced by a second begin', () => {
    const run = start();
    assert.throws(() => growth.beginGrowthRun({ sessionId: 'competitor', adapterType: 'test' }), /release its lease/);
    assert.equal(store.getGrowthRun(run.runId).sessionId, 'production-state');
    assert.equal(store.listGrowthRuns({ sessionId: 'competitor' }).length, 0);
    finish(run);
  });
  await test('recovery counts and blocking identity include old attempts beyond the display limit', () => {
    grant();
    const { decision } = reply(7105);
    const attempt = claim(decision).attempt;
    db.prepare("UPDATE publication_attempts SET pipeline='original', lane='main' WHERE attempt_id=?").run(attempt.attemptId);
    const row = db.prepare('SELECT * FROM publication_attempts WHERE attempt_id = ?').get(attempt.attemptId);
    const names = Object.keys(row).filter(name => name !== 'id');
    const insert = db.prepare(`INSERT INTO publication_attempts(${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`);
    db.exec('BEGIN IMMEDIATE');
    try {
      for (let i = 0; i < 600; i++) insert.run(...names.map(name => name === 'attempt_id' ? `terminal-${i}` : name === 'state' ? 'confirmed_published' : name === 'created_at' ? row.created_at + i + 1 : row[name]));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    const readiness = reconciliation.getPublicationReconciliationReadiness();
    assert.ok(readiness.activeCount >= 1);
    assert.equal(readiness.mainFeedBlockingAttemptId, attempt.attemptId);
    assert.ok(store.listPublicationAttempts({ state: 'claimed', limit: 200 }).some(value => value.attemptId === attempt.attemptId));
  });
  await test('audience SQL pagination uses current classifications and survives Growth Focus changes', () => {
    store.replaceAudienceSnapshot({ followers: [{ username: 'engineer', bio: 'Software developer building APIs' }, { username: 'unrelated', bio: 'Unrelated observations' }], followersComplete: true });
    assert.equal(store.listAudienceProfiles({ followsYou: true, limit: 1 })[0].username, 'engineer');
    assert.equal(store.getAudienceSummary().followers, 2);
    assert.equal(store.getAudienceSummary().relevant_followers, 1);
    const current = store.getNicheProfile().profile;
    store.saveNicheProfile({ ...current, audienceGroups: [{ tag: 'observations', label: 'Observations', terms: ['unrelated'], weight: 20 }] });
    assert.equal(store.listAudienceProfiles({ followsYou: true, minScore: 12, limit: 1 })[0].username, 'unrelated');
  });
} finally {
  db.close();
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
}
