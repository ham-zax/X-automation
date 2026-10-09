import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(os.tmpdir(), 'tech-discovery-contract-'));
const previousCwd = process.cwd();
process.chdir(scratch);

const strategy = await import(pathToFileURL(path.join(repo, 'strategy.js')).href);
const { buildViralSweepJobs } = await import(pathToFileURL(path.join(repo, 'viral_style_sweep.js')).href);
const { selectRotatingXQueryGroups } = await import(pathToFileURL(path.join(repo, 'tech_news.js')).href);
const { extractViralStyleFeatures, buildViralStyleReportRows, VIRAL_STYLE_CLASSIFIER_VERSION } = await import(pathToFileURL(path.join(repo, 'viral_style.js')).href);
const { evaluateTechDiscoveryEvidence } = await import(pathToFileURL(path.join(repo, 'discovery_verification.js')).href);
const { buildScoutCards } = await import(pathToFileURL(path.join(repo, 'scout.js')).href);
const store = await import(pathToFileURL(path.join(repo, 'store.js')).href);
const pipeline = await import(pathToFileURL(path.join(repo, 'pipeline.js')).href);
const editorial = await import(pathToFileURL(path.join(repo, 'editorial.js')).href);
const drafting = await import(pathToFileURL(path.join(repo, 'drafting.js')).href);
const contentReview = await import(pathToFileURL(path.join(repo, 'content_review.js')).href);

const NOW = Date.parse('2026-10-10T12:00:00Z');
const xPost = (text, id = '2109000000000000001') => ({
  key: 'https://x.com/example/status/' + id, url: 'https://x.com/example/status/' + id,
  source: 'x', title: '@example', text, timestamp: NOW - 3_600_000,
  metrics: { views: 12000, likes: 200, bookmarks: 70 },
});

try {
  await test('historical sweeps retain baseline cohort while operational lenses rotate inside the configured budget', () => {
    const baseline = strategy.getXSearchQueryGroups();
    const optIn = strategy.getXSearchQueryGroups({ includeFormatLenses: true });
    assert.equal(baseline.some(group => String(group.chunk).endsWith('_lens')), false);
    assert.equal(optIn.filter(group => String(group.chunk).endsWith('_lens')).length, 4);
    assert.equal(buildViralSweepJobs({ days: 21, analysisNow: NOW, thresholds: ['strong'] }).length, 42);
    assert.equal(buildViralSweepJobs({ days: 21, analysisNow: NOW, thresholds: ['strong', 'breakout'] }).length, 84);
    assert.equal(buildViralSweepJobs({ days: 28, analysisNow: NOW, thresholds: ['strong', 'breakout'] }).length, 112);
    const seen = new Set();
    const minutes = strategy.getActiveNicheProfile().discovery.rotationMinutes;
    for (let i = 0; i < 32; i++) {
      const selected = selectRotatingXQueryGroups('latest', i * minutes * 60_000);
      assert.ok(selected.length <= strategy.getActiveNicheProfile().discovery.latestQueryBudget);
      const lenses = selected.filter(group => String(group.chunk).endsWith('_lens'));
      assert.ok(lenses.length <= 1);
      for (const lens of lenses) seen.add(lens.chunk);
    }
    assert.ok(seen.size >= 2, 'multiple format variants receive bounded time slices');
    const original = strategy.getActiveNicheProfile();
    try {
      strategy.setActiveNicheProfile({
        ...original,
        contentGroups: original.contentGroups.map(group =>
          ['devtools', 'builders', 'systems', 'infra'].includes(group.tag) ? { ...group, discover: false } : group),
      });
      assert.equal(strategy.getXSearchQueryGroups({ includeFormatLenses: true })
        .some(group => String(group.chunk).endsWith('_lens')), false);
    } finally {
      strategy.setActiveNicheProfile(original);
    }
  });

  await test('useful-tech hooks distinguish building from testing and require observed media for visual demonstrations', () => {
    const built = extractViralStyleFeatures({ text: 'I built an open-source CLI to review pull requests in GitHub.' });
    assert.ok(built.hookLabels.includes('first_person_build'));
    assert.equal(built.hookLabels.includes('first_person_test'), false);
    assert.equal(built.styleLabels.includes('tested_experiment'), false);
    const surprise = extractViralStyleFeatures({ text: 'You can now turn an Android tablet into a CarPlay receiver.' });
    assert.ok(surprise.hookLabels.includes('unexpected_capability'));
    assert.ok(surprise.styleLabels.includes('useful_tech_discovery'));
    assert.equal(surprise.styleLabels.includes('visual_capability_demo'), false);
    const visual = extractViralStyleFeatures({ text: surprise.firstLine, mediaType: 'video' });
    assert.ok(visual.styleLabels.includes('visual_capability_demo'));
    const list = extractViralStyleFeatures({ text: '50 free websites every developer should bookmark 🧵' });
    assert.ok(list.hookLabels.includes('curated_list'));
    assert.ok(list.hookLabels.includes('free_resource'));
    const risky = extractViralStyleFeatures({ text: 'You can now run untrusted code on your production server without isolation.' });
    assert.ok(risky.hookLabels.includes('unexpected_capability'));
    assert.ok(!risky.styleLabels.includes('visual_capability_demo'));
    assert.equal(visual.classifierVersion, VIRAL_STYLE_CLASSIFIER_VERSION);
    const row = buildViralStyleReportRows([{ id: '1', text: surprise.firstLine, createdAt: NOW }])[0];
    assert.equal(row.styleClassificationBasis, 'recomputed_current');
    assert.equal(row.styleClassifierVersion, VIRAL_STYLE_CLASSIFIER_VERSION);
  });

  await test('Scout keeps bookmark data descriptive while surfacing an existing X candidate as T2 inspiration', () => {
    const source = xPost('50 free websites every developer should bookmark 🧵');
    const base = { now: NOW, ownHandle: 'ham_zax', attempts: [], inspirationCandidates: [], limit: 5 };
    const input = {
      key: source.key, source: 'x', url: source.url, text: source.text,
      publishedAt: NOW - 3_600_000, nicheScore: 50,
      viewsPerHour: 1500, engagementsPerHour: 80,
      hasAction: false, dispositionActive: false, blockingAttempt: false,
    };
    const unknown = buildScoutCards({ ...base, candidates: [{ ...input, observedMetrics: { views: 12000 } }] });
    const observed = buildScoutCards({ ...base, candidates: [{ ...input, observedMetrics: source.metrics }] });
    const left = unknown.cards.find(card => card.tier === 'T1');
    const right = observed.cards.find(card => card.tier === 'T1');
    assert.equal(left.score, right.score, 'sensor coverage must not change priority');
    assert.equal(left.metrics.bookmarksPerThousandViews, null);
    assert.ok(right.metrics.bookmarksPerThousandViews > 0);
    assert.ok(right.independentResearchFormats.includes('thread'));
    assert.equal(observed.cards.find(card => card.tier === 'T2').reason.xDiscoveryInspirations[0].candidateKey, source.key);
  });

  await test('verification separates creator claims and metadata from cited implementation evidence', () => {
    const source = xPost('You can now turn Android into an iPhone companion with this open-source tool.');
    const base = { candidate: source, pipeline: 'original' };
    const id = 81;
    const readme = { id, status: 'primary_supported', sourceKind: 'github_readme',
      summary: 'README details required versions and usage.', claimType: 'implementation' };
    assert.equal(evaluateTechDiscoveryEvidence(base).status, 'unverified_source_claim');
    assert.equal(evaluateTechDiscoveryEvidence({ ...base, evidence: [readme] }).status, 'primary_evidence_not_cited');
    assert.equal(evaluateTechDiscoveryEvidence({ ...base, evidence: [{ ...readme, sourceKind: 'github_api' }], usedEvidenceIds: [id] }).satisfied, false);
    assert.equal(evaluateTechDiscoveryEvidence({ ...base, evidence: [{ ...readme, status: 'source_claim' }], usedEvidenceIds: [id] }).satisfied, false);
    assert.equal(evaluateTechDiscoveryEvidence({ ...base, evidence: [readme], usedEvidenceIds: [id] }).satisfied, true);
    assert.equal(evaluateTechDiscoveryEvidence({ ...base, pipeline: 'quote' }).satisfied, true);
  });

  await test('delegated standalone discovery approval rejects unsourced creator claims before quality gates', () => {
    store.configureGrowthOperatorDelegation({ mode: 'live' }, { actor: 'human' });
    const grant = store.startGrowthOperatorDelegation({ actor: 'human' });
    const source = xPost('You can now turn an Android phone into a new open source developer workstation.', '2109000000000000108');
    store.upsertCandidates([source]);
    // Construct the minimal already-routed queue row to isolate the exact
    // mission-approval invariant from unrelated distribution recommendations.
    const queue = store.ensureQueueItem(source.key);
    store.linkQueueSource(queue.id, source.key, 'primary');
    store.saveDraft({ ...drafting.createDraftScaffold(source, { pipeline: 'original' }),
      candidateKey: source.key, editor: { pipeline: 'original', evidenceUsed: [] } });
    store.saveQueueItem({ ...queue, lane: 'main', pipeline: 'original', status: 'needs_review' });
    assert.throws(() => pipeline.approveQueueItemAsMissionAgent(source.key, {
      grantRevision: grant.revision,
      verificationProvenance: { authorityType: 'mission_agent', sourceReferences: [source.url], evidenceReferences: [] },
    }), /requires cited material primary-source evidence/i);
    assert.equal(store.getQueueItemByCandidate(source.key).status, 'needs_review');
  });

  await test('an X discovery retains source identity through governed editorial selection and Writer evidence packet', () => {
    const source = xPost('You can now run a useful developer tool on Android using this open-source CLI.', '2109000000000000099');
    store.upsertCandidates([source]);
    const original = store.getCandidate(source.key);
    assert.equal(original.source, 'x');
    const run = store.createEditorialRun({ objective: 'qualified_growth' });
    const storyKey = 'useful-tool-check';
    const evidence = store.saveResearchEvidence({
      editorialRunId: run.id, storyKey, claim: 'README documents setup and supported platform.',
      claimType: 'implementation', status: 'primary_supported', sourceKind: 'github_readme',
      sourceFamily: 'github:example/useful-tool',
      requestedUrl: 'https://api.github.com/repos/example/useful-tool/readme',
      resolvedUrl: 'https://api.github.com/repos/example/useful-tool/readme',
      title: 'Useful tool README', summary: 'Android requires an explicit CLI bridge and supported version.',
      observedAt: Date.now(),
    });
    const rec = store.saveEditorialRecommendation({
      editorialRunId: run.id, storyKey, rank: 1, decision: 'PREPARE', pipeline: 'original',
      objective: 'qualified_growth', title: 'Verify a useful Android tool capability',
      thesis: 'The real setup matters more than the viral shortcut.',
      whyNow: 'The project demonstration surfaced in the developer graph.',
      candidateKeys: [source.key], evidenceIds: [evidence.id],
      potentials: { objectiveFit: 70, reachPotential: 60, followPotential: 60, candidateKey: source.key },
      behavior: { decision: 'ACT', primaryPurpose: 'technical_value', socialMode: 'explainer',
        informationDepth: 'compact_reason', affectStrategy: 'neutral', affectProvenance: 'none',
        reasonToExist: 'Explain the verified steps and boundaries for developers.' },
    });
    const selected = editorial.selectEditorialRecommendation(rec.id);
    const queueSources = store.listQueueSources(selected.queueItem.id).map(row => store.getCandidate(row.candidateKey));
    assert.equal(queueSources[0].url, source.url);
    const storedEvidence = pipeline.editorialEvidenceForQueue(selected.queueItem);
    assert.ok(storedEvidence.some(row => row.id === evidence.id && row.status === 'primary_supported'));
    const packet = drafting.buildWriterPacket({
      candidate: selected.candidate, queueItem: selected.queueItem,
      draft: store.getDraftByCandidate(selected.candidate.key),
      sourceCandidates: queueSources, evidence: storedEvidence,
    });
    assert.equal(packet.discoveryVerification.required, true);
    assert.equal(packet.discoveryVerification.status, 'primary_evidence_not_cited');
    assert.ok(packet.discoveryVerification.materialPrimaryEvidenceIds.includes(String(evidence.id)));
    const satisfied = evaluateTechDiscoveryEvidence({
      pipeline: 'original', candidate: selected.candidate, sourceCandidates: queueSources,
      evidence: storedEvidence, usedEvidenceIds: [evidence.id],
    });
    assert.equal(satisfied.satisfied, true);

    // Complete the existing guarded route, not a mock publisher.
    const existingDraft = store.getDraftByCandidate(selected.candidate.key);
    const draft = { ...existingDraft,
      body: 'The project README describes a CLI bridge for Android developers. Check the supported version and device setup before relying on this workflow. The extra setup step matters more than a one-line viral shortcut.',
      editor: { ...existingDraft.editor, pipeline: 'original', decision: 'POST',
        behavior: selected.queueItem.behavior, evidenceUsed: [evidence.id],
        media: { type: 'none', required: false } },
    };
    draft.editor.contentReview = contentReview.bindContentReview({
      passed: true, factualClaims: [], ownerClaims: [], voiceIssues: [], issues: [],
    }, drafting.draftReviewContext(draft, selected.candidate, { pipeline: 'original',
      behavior: selected.queueItem.behavior, evidence: storedEvidence }));
    store.saveDraft(draft);
    store.recordWritingStrategySelection({ queueItemId: selected.queueItem.id, mode: 'off',
      selectionSource: 'manual', selectedBy: 'human' });
    pipeline.requestQueueReview(selected.candidate.key);
    const grant = store.getGrowthOperatorDelegation();
    const approved = pipeline.approveQueueItemAsMissionAgent(selected.candidate.key, {
      grantRevision: grant.revision,
      verificationProvenance: { authorityType: 'mission_agent',
        sourceReferences: [source.url], evidenceReferences: [String(evidence.id)] },
    });
    assert.equal(approved.queueItem.status, 'approved');
    assert.equal(approved.approvalSnapshot.authority.type, 'mission_agent');
  });
} finally {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
}
