// Bridge compact-output contract tests run only against a disposable SQLite DB.
// They spawn agent_bridge.js in a scratch directory and never open the production store.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previousCwd = process.cwd();
const scratch = mkdtempSync(path.join(tmpdir(), 'xgrowth-bridge-compact-'));
// Importing the bridge opens the store, so the in-process projections get their own
// directory: the spawned bridge calls below must never share a SQLite file with them.
const moduleScratch = mkdtempSync(path.join(tmpdir(), 'xgrowth-bridge-compact-modules-'));
process.chdir(moduleScratch);
const bridgeModule = await import('../agent_bridge.js');
const runtime = await import('../writer_runtime.js');
process.chdir(scratch);

after(() => {
  process.chdir(previousCwd);
  rmSync(scratch, { recursive: true, force: true });
  rmSync(moduleScratch, { recursive: true, force: true });
});

function bridgeStdout(command, input = {}) {
  const run = spawnSync(process.execPath, [path.join(repo, 'agent_bridge.js'), command], {
    cwd: scratch,
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, X_ACCOUNT: 'ham_zax' },
  });
  assert.equal(
    run.status,
    0,
    `${command} exit ${run.status} signal ${run.signal} error ${run.error?.code ?? 'none'}: ${run.stderr}`,
  );
  return run.stdout;
}

function bridge(command, input) {
  return JSON.parse(bridgeStdout(command, input));
}

test('account-health piped stdout is one line of JSON', () => {
  const stdout = bridgeStdout('account-health').trim();
  assert.equal(stdout.includes('\n'), false, 'piped account-health output must be a single line');
  assert.doesNotThrow(() => JSON.parse(stdout));
});

test('account-health default is the compact projection', () => {
  const body = bridge('account-health', {});
  assert.equal(body.compact, true);
  assert.equal(typeof body.detailHint, 'string');
  assert.equal(typeof body.health.state, 'string');
  assert.ok(Array.isArray(body.health.reasons));
  assert.equal(body.saturation.targets, undefined);
  assert.equal(body.observations, undefined);
  assert.equal(body.recentReplies, undefined);
  assert.equal(body.health.provenance, undefined);
});

test('account-health detail returns saturation targets without compact', () => {
  const body = bridge('account-health', { detail: true });
  assert.ok(Array.isArray(body.saturation.targets));
  assert.equal(body.compact, undefined);
});

test('operator-status default omits readiness sensors and account health', () => {
  const body = bridge('operator-status', {});
  assert.equal(body.readiness.sensors, undefined);
  assert.equal(body.readiness.accountHealth, undefined);
  assert.ok(Array.isArray(body.integrityWarnings));
  assert.ok(body.laneChampions && typeof body.laneChampions === 'object');
  assert.equal(body.personaHint, 'persona-model');
});

test('operator-status detail returns readiness sensors and no persona hint', () => {
  const body = bridge('operator-status', { detail: true });
  assert.notEqual(body.readiness.sensors, undefined);
  assert.equal(body.personaHint, undefined);
});

test('queue default returns draft and queue item arrays marked compact', () => {
  const body = bridge('queue', {});
  assert.ok(Array.isArray(body.drafts));
  assert.ok(Array.isArray(body.queueItems));
  assert.equal(body.compact, true);
});

test('publication-attempts default reports counts and omitted terminal rows', () => {
  const body = bridge('publication-attempts', {});
  assert.ok(body.counts && typeof body.counts === 'object');
  assert.equal(typeof body.omittedTerminal, 'number');
  assert.ok(Array.isArray(body.attempts));
});

test('publication-attempts with a state filter omits counts and omittedTerminal', () => {
  const body = bridge('publication-attempts', { state: 'confirmed_published' });
  assert.equal(body.counts, undefined);
  assert.equal(body.omittedTerminal, undefined);
});

test('scout paceOnly returns pace without cards or card guidance', () => {
  const body = bridge('scout', { paceOnly: true });
  assert.ok(body.pace && typeof body.pace === 'object');
  assert.equal(typeof body.pace.policy, 'string');
  assert.equal(body.cards, undefined);
  assert.equal(body.cardGuidance, undefined);
  assert.equal(body.compact, true);
  assert.equal(typeof body.detailHint, 'string');
});

test('scout default still returns cards and card guidance', () => {
  const body = bridge('scout', {});
  assert.ok(Array.isArray(body.cards));
  assert.equal(typeof body.cardGuidance, 'string');
  assert.equal(body.compact, true);
});

test('writer execution projection keeps provenance and drops the envelope', () => {
  const execution = { invocationId: 'inv-1', runtime: 'pi', model: 'gpt-6-sol', reasoning: 'high',
    prompt: 'p'.repeat(2048), response: 'r'.repeat(2048), startedAt: 1 };
  assert.deepEqual(bridgeModule.compactWriterExecution(execution),
    { invocationId: 'inv-1', runtime: 'pi', model: 'gpt-6-sol', reasoning: 'high' });
  assert.equal(bridgeModule.compactWriterExecution(null), null);
  assert.equal(bridgeModule.compactWriterExecution(undefined), null);
  assert.equal(bridgeModule.compactWriterExecution('raw'), 'raw');
});

function replyPrepared() {
  const checks = () => Array.from({ length: 16 }, (_, index) => ({ rule: index + 1, status: 'PASS', detail: '' }));
  return {
    status: 'generated',
    text: 'Love this direction.',
    writerInvocationId: 'inv-1',
    writer: { invocationId: 'inv-1', runtime: 'pi', model: 'gpt-6-sol', reasoning: 'high', prompt: 'p'.repeat(2048) },
    draftId: 'draft-1',
    behavior: { decision: 'ACT' },
    targetTweetId: '1234567890',
    targetUrl: 'https://x.com/builder/status/1234567890',
    candidateKey: 'https://x.com/builder/status/1234567890',
    topicBrief: { collectionId: 'c1', briefId: 'b1', paragraphIds: ['p1'] },
    replyReview: { candidates: [{ id: 'A', text: 'Love this direction.', checks: checks() },
      { id: 'B', text: 'Nice, thanks for sharing.', checks: checks() }],
    selection: 'A', reason: 'Fits the supplied context.' },
    operator: { runtime: 'pi', model: 'gpt-6-sol', reasoning: 'high', source: 'launcher_environment_report' },
    publicationAuthority: false,
  };
}

test('reply-generate compact projection drops the check array and operator report', () => {
  const prepared = replyPrepared();
  const compact = bridgeModule.compactReplyGenerateResult(prepared);
  assert.equal(compact.compact, true);
  assert.equal(typeof compact.detailHint, 'string');
  assert.equal(compact.status, 'generated');
  assert.equal(compact.text, prepared.text);
  assert.equal(compact.targetTweetId, prepared.targetTweetId);
  assert.equal(compact.targetUrl, prepared.targetUrl);
  assert.equal(compact.candidateKey, prepared.candidateKey);
  assert.equal(compact.draftId, prepared.draftId);
  assert.equal(compact.writerInvocationId, prepared.writerInvocationId);
  assert.deepEqual(compact.writer, { invocationId: 'inv-1', runtime: 'pi', model: 'gpt-6-sol', reasoning: 'high' });
  assert.deepEqual(compact.behavior, prepared.behavior);
  assert.deepEqual(compact.topicBrief, prepared.topicBrief);
  assert.deepEqual(compact.reviewSummary, { selection: 'A', reason: 'Fits the supplied context.' });
  assert.equal(compact.publicationAuthority, false);
  assert.equal(compact.replyReview, undefined);
  assert.equal(compact.operator, undefined);
  assert.ok(JSON.stringify(compact).length * 2 < JSON.stringify(prepared).length);
});

test('reply-generate compact projection keeps a skipped reply without a review', () => {
  const compact = bridgeModule.compactReplyGenerateResult({ status: 'skipped', text: '', writerInvocationId: null,
    writer: null, draftId: null, behavior: null, targetTweetId: '1', targetUrl: 'https://x.com/a/status/1',
    candidateKey: 'k', replyReview: undefined, operator: {}, publicationAuthority: false });
  assert.equal(compact.status, 'skipped');
  assert.equal(compact.reviewSummary, null);
  assert.equal(compact.writer, null);
  assert.equal(compact.topicBrief, undefined);
});

test('reply-generate operator mode keeps the packet, contract and schema', () => {
  const prepared = { status: 'operator_writes', packet: { pipeline: 'reply' }, contract: 'CONTRACT',
    outputSchema: { required: ['decision'] }, publicationAuthority: false };
  assert.deepEqual(bridgeModule.compactReplyGenerateResult(prepared), prepared);
});

function writerGenerated() {
  return {
    saved: { id: 'draft-1', body: 'An original.', status: 'draft', candidateKey: 'k',
      editor: { pipeline: 'original', behavior: { decision: 'ACT' },
        contentReview: { passed: true, available: true, issues: [], voiceIssues: ['voice'],
          factualClaims: [{ text: 'x'.repeat(1024) }] },
        generationHistory: [{ prompt: 'p'.repeat(1024) }] } },
    queueItem: { id: 'queue-1', pipeline: 'original', status: 'drafting', engagementKind: 'original',
      engagement: { engagePriority: 42, sourceClass: 'x' } },
    analysis: { score: 88, gates: { failures: [] } },
    output: { decision: 'POST', execution: { invocationId: 'inv-1', runtime: 'pi', model: 'gpt-6-sol',
      reasoning: 'high', prompt: 'p'.repeat(2048) } },
  };
}

test('writer-generate compact projection drops analysis, editor and engagement', () => {
  const generated = writerGenerated();
  const compact = bridgeModule.compactWriterGenerateResult(generated, false);
  assert.equal(compact.compact, true);
  assert.equal(typeof compact.detailHint, 'string');
  assert.equal(compact.decision, 'POST');
  assert.equal(compact.writerInvocationId, 'inv-1');
  assert.deepEqual(compact.writer, { invocationId: 'inv-1', runtime: 'pi', model: 'gpt-6-sol', reasoning: 'high' });
  assert.equal(compact.publicationAuthority, false);
  assert.equal(compact.analysis, undefined);
  assert.equal(compact.draft.editor, undefined);
  assert.equal(compact.draft.body, 'An original.');
  assert.deepEqual(compact.draft.behavior, { decision: 'ACT' });
  assert.deepEqual(compact.draft.contentReview,
    { passed: true, available: true, issues: [], voiceIssues: ['voice'] });
  assert.equal(compact.queueItem.engagement, undefined);
  assert.equal(compact.queueItem.engagementKind, 'original');
  assert.equal(compact.queueItem.engagePriority, 42);
  assert.ok(JSON.stringify(compact).length * 2 < JSON.stringify(generated).length);
});

test('writer-generate detail projection returns the full analysis and editor', () => {
  const generated = writerGenerated();
  const detail = bridgeModule.compactWriterGenerateResult(generated, true);
  assert.deepEqual(detail, { draft: generated.saved, queueItem: generated.queueItem, analysis: generated.analysis,
    decision: 'POST', writerInvocationId: 'inv-1', writer: generated.output.execution, publicationAuthority: false });
  assert.equal(detail.compact, undefined);
});

test('Writer packet reaches the model as compact single-line JSON', async () => {
  const behavior = { decision: 'ACT', primaryPurpose: 'social_presence', socialMode: 'enthusiast',
    informationDepth: 'social_only', affectStrategy: 'neutral', affectProvenance: 'none',
    reasonToExist: 'Participate in this developer release.' };
  const packet = { pipeline: 'original', behavior, persona: { version: 1 }, evidence: [],
    candidate: { key: 'https://x.com/builder/status/929292', text: 'A source.' } };
  let seen;
  const output = await runtime.generateWriterOutput(packet, 'ORIGINAL CONTRACT', {
    skipReview: true,
    runAI: async (request) => {
      seen = request;
      return { output: { decision: 'DO_NOT_POST', pipeline: 'original', finalText: '', evidenceUsed: [], behavior: null },
        execution: { invocationId: 'inv-1' } };
    },
  });
  assert.equal(output.decision, 'DO_NOT_POST');
  const marker = 'WRITER PACKET:\n';
  const index = seen.prompt.indexOf(marker);
  assert.ok(index > 0, 'the prompt carries a WRITER PACKET section');
  const packetLine = seen.prompt.slice(index + marker.length);
  assert.equal(packetLine.includes('\n'), false, 'the Writer packet must be one line');
  assert.deepEqual(JSON.parse(packetLine), { pipeline: 'original', persona: { version: 1 }, evidence: [],
    candidate: packet.candidate, suggestedBehavior: behavior });
});
