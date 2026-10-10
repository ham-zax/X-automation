import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(tmpdir(), 'editorial-sources-'));
const previousCwd = process.cwd();
process.chdir(scratch);
const store = await import(pathToFileURL(path.join(root, 'store.js')));
const editorial = await import(pathToFileURL(path.join(root, 'editorial.js')));
const autonomous = await import(pathToFileURL(path.join(root, 'autonomous_main_feed.js')));

function recommendation(suffix, { decision = 'PREPARE', pipeline = 'original', invalidBehavior = false } = {}) {
  const sources = ['a', 'b'].map(part => ({
    key: `https://github.com/example/agent-runtime-${suffix}-${part}`,
    source: 'github', title: 'TypeScript coding agent runtime developer tooling',
    text: 'Open source TypeScript agent runtime with inspectable tools, API permissions and workflow recovery.',
    url: `https://github.com/example/agent-runtime-${suffix}-${part}`,
    timestamp: Date.now(), metrics: { stars: 1000 },
  }));
  store.upsertCandidates(sources);
  const run = store.createEditorialRun({ objective: 'qualified_growth' });
  const rec = store.saveEditorialRecommendation({
    editorialRunId: run.id, rank: 1, decision, pipeline,
    objective: 'qualified_growth', title: 'Compare TypeScript coding agent runtime control boundaries',
    thesis: 'Developer tooling should expose agent runtime recovery and API permission boundaries.',
    whyNow: 'Two source repos expose different agent runtime controls.',
    candidateKeys: sources.map(source => source.key),
    potentials: { objectiveFit: 90, reachPotential: 60, followPotential: 70, candidateKey: sources[0].key },
    behavior: { decision: 'ACT', primaryPurpose: invalidBehavior ? 'invalid-purpose' : 'technical_value', socialMode: 'explainer',
      informationDepth: 'compact_reason', affectStrategy: 'neutral', affectProvenance: 'none',
      reasonToExist: 'Compare coding agent runtime permission and recovery boundaries.' },
  });
  return { rec, sources };
}

try {
  await test('multi-source Original links real research provenance before routing and remains idempotent', () => {
    const { rec, sources } = recommendation('original');
    const selected = editorial.selectEditorialRecommendation(rec.id);
    assert.equal(selected.candidate.key, `editorial:${rec.id}`);
    assert.deepEqual(selected.queueSources.map(source => [source.candidateKey, source.role]), [
      [sources[0].key, 'primary'], [sources[1].key, 'supporting'],
    ]);
    const again = editorial.selectEditorialRecommendation(rec.id);
    assert.equal(again.queueItem.id, selected.queueItem.id);
    assert.equal(again.idempotent, true);
    assert.deepEqual(again.queueSources, selected.queueSources);
  });

  await test('automated Writer preparation sees the exact linked X sources for an aggregated editorial Original', async () => {
    const sources = ['2111000000000000001', '2111000000000000002'].map((id, index) => ({
      key: 'https://x.com/toolbuilder/status/' + id,
      source: 'x', title: '@toolbuilder',
      text: index === 0
        ? 'Introducing the Acme Android SDK. Read https://docs.acme.dev/reference'
        : 'This SDK supports Android 14 according to https://docs.acme.dev/reference',
      url: 'https://x.com/toolbuilder/status/' + id,
      timestamp: Date.now() - 100000,
      metrics: { views: 5000, likes: 45 },
    }));
    store.upsertCandidates(sources);
    const run = store.createEditorialRun({ objective: 'qualified_growth' });
    const rec = store.saveEditorialRecommendation({
      editorialRunId: run.id, storyKey: 'acme-sdk', rank: 1, decision: 'PREPARE',
      pipeline: 'original', objective: 'qualified_growth', title: 'Acme SDK setup and requirements',
      thesis: 'Android setup prerequisites are more useful than the claim of instant compatibility.',
      whyNow: 'Developers are asking about the new SDK.',
      candidateKeys: sources.map(row => row.key),
      potentials: { objectiveFit: 85, reachPotential: 50, followPotential: 60, candidateKey: sources[0].key },
      behavior: { decision: 'ACT', primaryPurpose: 'technical_value', socialMode: 'explainer',
        informationDepth: 'compact_reason', affectStrategy: 'neutral', affectProvenance: 'none',
        reasonToExist: 'Explain SDK installation and compatibility.' },
    });
    const selected = editorial.selectEditorialRecommendation(rec.id);
    assert.equal(selected.candidate.key, 'editorial:' + rec.id);
    const { buildGeneratedWriterPacket } = await import(pathToFileURL(path.join(root, 'web_api.js')));
    const packet = buildGeneratedWriterPacket({
      candidate: selected.candidate, queueItem: selected.queueItem,
      draft: store.getDraftByCandidate(selected.candidate.key),
      strategyGeneration: { writingStrategy: null },
      editorialContext: { evidence: [], profileProof: {}, recommendation: rec },
    });
    assert.equal(packet.discoveryVerification.required, true,
      'automated Writer packet must observe the X original sources despite the synthetic editorial key');
    assert.deepEqual(packet.discoveryVerification.sourceUrls.sort(), sources.map(row => row.url).sort());
  });

  await test('delegated Thread selection uses the same real-source links', () => {
    store.configureGrowthOperatorDelegation({ mode: 'live' }, { actor: 'human' });
    const grant = store.startGrowthOperatorDelegation({ actor: 'human' });
    const { rec, sources } = recommendation('thread', { pipeline: 'thread' });
    const selected = editorial.selectEditorialRecommendationAsMissionAgent(rec.id, { grantRevision: grant.revision });
    assert.equal(selected.selection.selectedBy, 'mission_agent');
    assert.equal(selected.queueSources[0].candidateKey, sources[0].key);
    assert.equal(selected.queueSources[0].role, 'primary');
    assert.equal(selected.queueSources[1].candidateKey, sources[1].key);
    assert.equal(selected.queueItem.humanApprovedAt, null);
  });

  await test('delegated approval rejection preserves the draft and returns its exact repair path', async () => {
    // Remove unrelated selected work from this isolated fixture's preparation lane.
    for (const q of store.listQueueItems({ limit: 100 })) {
      if (q.pipeline === 'thread') store.saveQueueItem({ ...q, status: 'ignored' });
    }
    const grant = store.getGrowthOperatorDelegation();
    const { rec } = recommendation('rejected-draft');
    const selected = editorial.selectEditorialRecommendationAsMissionAgent(rec.id, { grantRevision: grant.revision });
    const strategy = store.recordWritingStrategySelection({ queueItemId: selected.queueItem.id,
      mode: 'off', selectionSource: 'manual', selectedBy: 'human' });
    const draft = store.getDraftByCandidate(selected.candidate.key);
    store.saveDraft({ ...draft, body: 'Every coding agent API guarantees perfect recovery without lost work.',
      editor: { ...draft.editor, pipeline: 'original', decision: 'POST',
        generation: { strategySelectionId: strategy.id },
        contentReview: { passed: false, issues: ['The source does not support a perfect recovery guarantee.'] } } });
    const result = await autonomous.prepareAutonomousMainFeed({ editorialAlreadyRefreshed: true });
    assert.equal(result.action, 'needs_revision');
    assert.equal(result.reason, 'mission_approval_rejected');
    assert.match(result.error, /approval-ready|review|quality|strategy|generation/i, result.error);
    assert.equal(result.repair.draftId, draft.id);
    assert.equal(result.repair.command, 'writer-packet');
    assert.equal(result.repair.payload.key, selected.candidate.key);
    const current = store.getQueueItem(selected.queueItem.id);
    assert.equal(current.pipeline, 'original');
    assert.equal(current.status, 'needs_review');
    assert.equal(current.humanApprovedAt, null);
    assert.equal(store.getDraftByCandidate(selected.candidate.key).id, draft.id);
  });

  await test('a conflicting persisted real primary source is still rejected without relinking', () => {
    const { rec, sources } = recommendation('conflict');
    const candidate = store.ensureEditorialCandidate(rec.id);
    const queue = store.ensureQueueItem(candidate.key);
    store.linkQueueSource(queue.id, sources[1].key, 'primary');
    assert.throws(() => editorial.selectEditorialRecommendation(rec.id), /already linked to primary source/);
    assert.deepEqual(store.listQueueSources(queue.id), [{ queueItemId: queue.id, candidateKey: sources[1].key, role: 'primary' }]);
    assert.equal(store.getEditorialSelectionByRecommendation(rec.id), null);
  });

  await test('failed routing rolls back provisional source links and candidate creation', () => {
    const { rec } = recommendation('invalid', { invalidBehavior: true });
    assert.throws(() => editorial.selectEditorialRecommendation(rec.id), /purpose|behavior/i);
    assert.equal(store.getEditorialSelectionByRecommendation(rec.id), null);
    assert.equal(store.getQueueItemByCandidate(`editorial:${rec.id}`), null);
    assert.equal(store.getCandidate(`editorial:${rec.id}`), null);
  });
} finally {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
}
