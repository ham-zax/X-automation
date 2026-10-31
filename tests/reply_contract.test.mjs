import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), 'reply-contract-'));
process.chdir(scratch);
const drafting = await import('../drafting.js');
const runtime = await import('../writer_runtime.js');
const contracts = await import('../reply_contract.js');
const content = await import('../content_review.js');
const store = await import('../store.js');
const { validateStructuredOutput } = await import('../ai_runtime.js');
after(async () => { process.chdir(repo); await rm(scratch, { recursive: true, force: true }); });

const candidate = { key: 'https://x.com/builder/status/929292', url: 'https://x.com/builder/status/929292',
  source: 'owner', title: '@builder', text: 'An agent can create a canvas through a plugin. The app supports git and has 20 users.' };
const behavior = { decision: 'ACT', primaryPurpose: 'social_presence', socialMode: 'enthusiast', informationDepth: 'social_only',
  affectStrategy: 'neutral', affectProvenance: 'none', reasonToExist: 'Participate in this developer release.' };
const packet = () => drafting.buildWriterPacket({ candidate, queueItem: { pipeline: 'reply', behavior }, draft: null });
const good = () => ({ passed: true, ownerClaims: [], factualClaims: [], voiceIssues: [], issues: [] });

test('Reply generation uses the small contract and normalizes the internal route', async () => {
  const p = packet();
  let seen;
  const raw = { decision: 'POST', finalText: 'Love this direction.', evidenceUsed: [] };
  const output = await runtime.generateWriterOutput(p, 'LARGE MULTIFORMAT MANUAL', { skipReview: true, runAI: async request => {
    seen = request;
    return { output: raw, execution: { actualModel: 'fixture-luna' } };
  } });
  assert.deepEqual(seen.schema.required, ['decision', 'finalText', 'evidenceUsed']);
  assert.equal(validateStructuredOutput(raw, seen.schema).valid, true);
  assert.equal(seen.prompt.includes('LARGE MULTIFORMAT MANUAL'), false);
  assert.equal(seen.prompt.includes('systems_consequence_signature'), false);
  assert.equal(seen.prompt.includes('accountEvidencePatterns'), false);
  assert.equal(seen.prompt.includes(contracts.REPLY_CONTRACT), true);
  assert.equal(output.pipeline, 'reply');
  assert.deepEqual(output.threadParts, []);
  assert.equal(output.thesis, undefined);
  const applied = drafting.applyWriterOutput({ body: '', editor: { pipeline: 'reply' } }, raw, { writerPacket: p });
  assert.equal(applied.body, raw.finalText);
  assert.equal(applied.editor.pipeline, 'reply');
});

test('Reply projection keeps explicit repair, relationship and research context', () => {
  const p = { ...packet(), relationship: { relationshipStage: 'responsive' }, ownerEvidence: { claimSummary: 'exact text only' },
    evidence: [{ id: 'e1' }], topicBrief: { paragraphIds: ['p1'] }, writingStrategy: { intent: 'explicit owner choice' },
    currentDraft: { body: 'old text', editor: { thesis: 'forced old thesis', followReason: 'old account justification', operatorContext: 'Owner context' }, gates: { failures: ['named error'] } } };
  const projected = contracts.projectReplyPacket(p);
  assert.deepEqual(projected.relationship, p.relationship);
  assert.deepEqual(projected.evidence, p.evidence);
  assert.deepEqual(projected.ownerEvidence, p.ownerEvidence);
  assert.deepEqual(projected.discoveryVerification, p.discoveryVerification);
  assert.deepEqual(projected.topicBrief, p.topicBrief);
  assert.deepEqual(projected.writingStrategy, p.writingStrategy);
  assert.deepEqual(projected.currentDraft.gates, p.currentDraft.gates);
  assert.equal(projected.currentDraft.editor.operatorContext, 'Owner context');
  assert.equal(projected.currentDraft.editor.thesis, undefined);
  assert.deepEqual(contracts.projectReplyPacket(projected), projected);
  assert.ok(contracts.replyOutputSchema(p).required.includes('briefParagraphIds'));
  assert.throws(() => drafting.applyWriterOutput({ editor: { pipeline: 'reply' } },
    { decision: 'POST', finalText: 'A reply.', evidenceUsed: ['invented'] }, { writerPacket: p }), /not supplied/);
});

test('Non-Reply generation retains its existing document and schema', async () => {
  const p = drafting.buildWriterPacket({ candidate, queueItem: { pipeline: 'original', behavior }, draft: null });
  let seen;
  await runtime.generateWriterOutput(p, 'ORIGINAL CONTRACT', { skipReview: true, runAI: async request => {
    seen = request;
    return { output: { decision: 'POST', pipeline: 'original', finalText: 'An original.', evidenceUsed: [] } };
  } });
  assert.ok(seen.schema.required.includes('thesis'));
  assert.ok(seen.schema.required.includes('followValue'));
  assert.ok(seen.prompt.includes('ORIGINAL CONTRACT'));
  assert.equal(p.promptDocument, 'docs/POST_GENERATION_PROMPT.md');
});

test('Visible parent attribution is contextual for Reply only', () => {
  const text = 'The app supports git.';
  const review = { ...good(), factualClaims: [{ text, status: 'supported', sourceId: 'candidate', sourceQuote: 'The app supports git', attributed: false }] };
  const ctx = { units: [text], candidate };
  assert.deepEqual(content.checkReviewClaims(review, { ...ctx, pipeline: 'reply' }), []);
  for (const pipeline of ['original', 'thread', 'quote']) {
    assert.ok(content.checkReviewClaims(review, { ...ctx, pipeline }).some(x => /explicitly attributed/.test(x)));
  }
  const thirdParty = { ...review, factualClaims: [{ ...review.factualClaims[0], sourceId: 'external' }] };
  assert.ok(content.checkReviewClaims(thirdParty, { ...ctx, pipeline: 'reply', evidence: [{ id: 'external', status: 'source_claim', claim: candidate.text }] }).some(x => /explicitly attributed/.test(x)));
  const inventedQuote = { ...review, factualClaims: [{ ...review.factualClaims[0], sourceQuote: 'Does not exist' }] };
  const collision = { ...ctx, pipeline: 'reply', evidence: [{ id: 'candidate', status: 'source_claim', resolvedUrl: 'https://example.invalid/third-party', claim: candidate.text }] };
  assert.ok(content.checkReviewClaims(review, collision).some(x => /explicitly attributed/.test(x)));
  assert.ok(content.checkReviewClaims(inventedQuote, { ...ctx, pipeline: 'reply' }).some(x => /invented source excerpt/.test(x)));
  const count = 'The app has 30 users.';
  const changed = { ...review, factualClaims: [{ ...review.factualClaims[0], text: count, sourceQuote: '20 users' }] };
  assert.ok(content.checkReviewClaims(changed, { units: [count], candidate, pipeline: 'reply' }).some(x => /quantity/.test(x)));
});

test('Reply review keeps factual and owner-action refusals while social acts need no claim entry', () => {
  const reaction = good();
  assert.deepEqual(content.checkReviewClaims(reaction, { units: ['Love this direction.'], candidate, pipeline: 'reply' }), []);
  const factual = { ...good(), factualClaims: [{ text: 'It supports all devices.', status: 'interpretation' }] };
  assert.ok(content.checkReviewClaims(factual, { units: ['It supports all devices.'], candidate, pipeline: 'reply' }).length);
  const unsupported = { ...good(), factualClaims: [{ text: 'Every call has a diff sheet.', status: 'unsupported' }] };
  assert.ok(content.checkReviewClaims(unsupported, { units: ['Every call has a diff sheet.'], candidate, pipeline: 'reply' }).some(x => /Unsupported/.test(x)));
  const owner = { ...good(), ownerClaims: ['pulling the repo now'] };
  assert.ok(content.checkReviewClaims(owner, { units: ['pulling the repo now'], candidate, pipeline: 'reply' }).some(x => /attestation/.test(x)));
});

test('Real bridge returns the Reply contract and accepts its lean output', () => {
  store.upsertCandidates([{ ...candidate, timestamp: Date.now(), metrics: {} }]);
  store.ensureQueueItem(candidate.key, { lane: 'main', pipeline: 'reply', status: 'drafting', behavior });
  const draft = store.saveDraft({ ...drafting.createDraftScaffold(candidate, { pipeline: 'reply' }), editor: { pipeline: 'reply', behavior, evidenceUsed: [] } });
  const bridge = (command, payload) => JSON.parse(execFileSync(process.execPath, [path.join(repo, 'agent_bridge.js'), command], { cwd: scratch, input: JSON.stringify(payload), encoding: 'utf8' }));
  const prepared = bridge('writer-packet', { key: candidate.key });
  assert.equal(prepared.packet.promptDocument, 'docs/REPLY_GENERATION_PROMPT.md');
  assert.equal(prepared.contract, contracts.REPLY_CONTRACT);
  assert.deepEqual(prepared.outputSchema.required, ['decision', 'finalText', 'evidenceUsed']);
  assert.equal(prepared.packet.persona.voiceCalibration, undefined);
  bridge('apply-writer-output', { id: draft.id, generation: prepared.generation, output: { decision: 'POST', finalText: 'Love this direction.', evidenceUsed: [] } });
  const saved = store.getDraft(draft.id);
  assert.equal(saved.body, 'Love this direction.');
  assert.equal(saved.editor.pipeline, 'reply');
  assert.notEqual(saved.status, 'approved');
  assert.equal(store.listPublicationAttempts({ limit: 10 }).length, 0);
});
