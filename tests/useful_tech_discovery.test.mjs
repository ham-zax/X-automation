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
      const sequences = [];
      for (const selectedTag of ['devtools', 'models']) {
        strategy.setActiveNicheProfile({ ...original,
          discovery: { ...original.discovery, latestQueryBudget: 2 },
          exploration: { ...original.exploration, enabled: false },
          contentGroups: original.contentGroups.map(group => ({ ...group,
            discover: group.tag === selectedTag, targetShare: group.tag === selectedTag ? 100 : 0 })),
        });
        const tags = Array.from({ length: 16 }, (_, i) =>
          selectRotatingXQueryGroups('latest', i * original.discovery.rotationMinutes * 60_000)
            .map(group => group.tag));
        assert.ok(tags.every(selection => selection.length >= 1 && selection.length <= 2 && selection.every(tag => tag === selectedTag)),
          '100% owner share cannot be replaced by zero-share groups');
        sequences.push(JSON.stringify(tags));
      }
      assert.notEqual(sequences[0], sequences[1], 'different owner preferences produce different searches');
      strategy.setActiveNicheProfile({ ...original,
        discovery: { ...original.discovery, latestQueryBudget: 1 },
        exploration: { ...original.exploration, enabled: false },
        contentGroups: original.contentGroups.map(group => ({ ...group,
          discover: ['devtools', 'models'].includes(group.tag),
          targetShare: group.tag === 'devtools' ? 80 : group.tag === 'models' ? 20 : 0 })),
      });
      const weighted = Array.from({ length: 256 }, (_, i) =>
        selectRotatingXQueryGroups('latest', i * original.discovery.rotationMinutes * 60_000)[0]?.tag);
      const devtoolsShare = weighted.filter(tag => tag === 'devtools').length / weighted.length;
      assert.ok(devtoolsShare > 0.73 && devtoolsShare < 0.87,
        'weighted discovery must honor configured shares rather than equal group rotation');
      assert.ok(weighted.every(tag => ['devtools', 'models'].includes(tag)));
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

  await test('claim-to-evidence validation rejects missing, unrelated, contradicted and omitted material assertions', () => {
    const source = xPost('I built a CLI that lets Android developers debug iOS tools. https://github.com/example/bridge');
    const claimText = 'Android 14 requires a bridge to debug iOS applications.';
    const evidence = { id: 81, status: 'primary_supported', sourceKind: 'github_readme',
      sourceFamily: 'github:example/bridge', requestedUrl: 'https://api.github.com/repos/example/bridge/readme',
      summary: claimText, claimType: 'implementation' };
    const claim = { text: claimText, status: 'supported', sourceId: '81',
      sourceQuote: claimText, attributed: false,
      supportAssessment: { support: 'supported', projectMatch: true, contradictionChecked: true, limitationsChecked: true } };
    const review = { passed: true, factualClaims: [claim] };
    const base = { candidate: source, pipeline: 'original', publicUnits: [claimText], review };
    assert.equal(evaluateTechDiscoveryEvidence(base).satisfied, false);
    assert.ok(evaluateTechDiscoveryEvidence({ ...base, evidence: [evidence] }).issues.includes('MISSING_CITED_MATERIAL_PRIMARY'));
    assert.equal(evaluateTechDiscoveryEvidence({ ...base, evidence: [{ ...evidence, sourceKind: 'github_api' }], usedEvidenceIds: ['81'] }).satisfied, false);
    assert.equal(evaluateTechDiscoveryEvidence({ ...base, evidence: [{ ...evidence, status: 'source_claim' }], usedEvidenceIds: ['81'] }).satisfied, false);
    const valid = { ...base, evidence: [evidence], usedEvidenceIds: ['81'] };
    assert.equal(evaluateTechDiscoveryEvidence(valid).satisfied, true);
    assert.ok(evaluateTechDiscoveryEvidence({ ...valid, review: { passed: true, factualClaims: [] } })
      .issues.includes('UNREVIEWED_PUBLIC_ASSERTION'), 'an unquantified false claim cannot be omitted');
    assert.equal(evaluateTechDiscoveryEvidence({ ...valid, publicUnits: [claimText, 'Every phone is compatible.'] }).satisfied, false);
    assert.ok(evaluateTechDiscoveryEvidence({ ...valid, evidence: [{
      ...evidence, sourceFamily: 'github:other/project',
      requestedUrl: 'https://api.github.com/repos/other/project/readme',
    }] }).issues.includes('PRIMARY_PROJECT_IDENTITY_MISMATCH'));
    assert.ok(evaluateTechDiscoveryEvidence({ ...valid, evidence: [{
      ...evidence, summary: 'Android 14 does not support debugging iOS applications.',
    }], review: { passed: true, factualClaims: [{
      ...claim, sourceQuote: 'Android 14 does not support debugging iOS applications.',
    }] } }).issues.includes('ASSERTION_NOT_SUPPORTED_BY_CITED_EXCERPT'));
    assert.equal(evaluateTechDiscoveryEvidence({ ...valid, review: { passed: true,
      factualClaims: [{ ...claim, supportAssessment: { ...claim.supportAssessment, support: 'contradicted' } }] } }).satisfied, false);
    assert.equal(evaluateTechDiscoveryEvidence({ ...valid, pipeline: 'quote' }).satisfied, true);
    for (const text of ['I built a CLI that lets developers debug iOS apps from Android.',
      'Introducing a developer CLI for debugging iOS applications.']) {
      assert.equal(evaluateTechDiscoveryEvidence({
        candidate: xPost(text), pipeline: 'thread',
      }).required, true, 'hook wording must never decide verification authority');
    }
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
    }), /claim-to-primary-evidence review/i);
    assert.equal(store.getQueueItemByCandidate(source.key).status, 'needs_review');
  });

  await test('an X discovery retains source identity through governed editorial selection and Writer evidence packet', () => {
    const source = xPost('You can now run a useful developer tool on Android using this open-source CLI. https://github.com/example/useful-tool', '2109000000000000099');
    store.upsertCandidates([source]);
    const original = store.getCandidate(source.key);
    assert.equal(original.source, 'x');
    // Drive the real Source Snapshot → Editorial Context seam before supplying
    // the independently controlled final recommendation in this offline test.
    const observedAt = Date.now() - 45_000;
    store.saveDiscoverSnapshot('x_for_you', [source], observedAt);
    store.recordSourceObservations([{
      candidateKey: source.key, snapshotKind: 'x_for_you', observedAt,
      rank: 1, metrics: { views: 12000, likes: 200 },
    }]);
    const context = editorial.buildEditorialContext({ objective: 'qualified_growth', now: Date.now() });
    assert.ok(context.scanCandidates.some(item => item.key === source.key
      && item.snapshotKinds.includes('x_for_you')), 'live editorial scan input contains the observed For You key');
    const run = store.createEditorialRun({ objective: 'qualified_growth' });
    const storyKey = 'useful-tool-check';
    const evidence = store.saveResearchEvidence({
      editorialRunId: run.id, storyKey, claim: 'README documents setup and supported platform.',
      claimType: 'implementation', status: 'primary_supported', sourceKind: 'github_readme',
      sourceFamily: 'github:example/useful-tool',
      requestedUrl: 'https://api.github.com/repos/example/useful-tool/readme',
      resolvedUrl: 'https://api.github.com/repos/example/useful-tool/readme',
      title: 'Useful tool README', summary: 'Android requires an explicit CLI bridge and supported version. The setup requires a supported Android device before deploying the developer CLI. Check compatibility before installing this tool.',
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
    assert.equal(packet.discoveryVerification.status, 'missing_cited_material_primary');
    assert.ok(packet.discoveryVerification.materialPrimaryEvidenceIds.includes(String(evidence.id)));
    assert.equal(packet.discoveryVerification.required, true);
    assert.ok(packet.discoveryVerification.issues.includes('MISSING_CITED_MATERIAL_PRIMARY'));

    // Complete the existing guarded route, not a mock publisher.
    const existingDraft = store.getDraftByCandidate(selected.candidate.key);
    const draft = { ...existingDraft,
      body: 'Android requires an explicit CLI bridge and supported version. The setup requires a supported Android device before deploying the developer CLI. Check compatibility before installing this tool.',
      editor: { ...existingDraft.editor, pipeline: 'original', decision: 'POST',
        behavior: selected.queueItem.behavior, evidenceUsed: [evidence.id],
        media: { type: 'none', required: false } },
    };
    const claimAssessment = { support: 'supported', projectMatch: true,
      contradictionChecked: true, limitationsChecked: true };
    const factualClaims = [
      'Android requires an explicit CLI bridge and supported version.',
      'The setup requires a supported Android device before deploying the developer CLI.',
    ].map(text => ({ text, status: 'supported', sourceId: String(evidence.id), sourceQuote: text,
      attributed: false, supportAssessment: claimAssessment }));
    factualClaims.push({ text: 'Check compatibility before installing this tool.', status: 'supported',
      sourceId: String(evidence.id), sourceQuote: 'Check compatibility before installing this tool.',
      attributed: false, supportAssessment: claimAssessment });
    draft.editor.contentReview = contentReview.bindContentReview({
      passed: true, factualClaims, ownerClaims: [], voiceIssues: [], issues: [],
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
    assert.ok(approved.approvalSnapshot.evidenceReviewHash, 'approval must bind specific evidence and review');
    const sameTextDraft = store.getDraftByCandidate(source.key);
    const alternativeReview = { ...sameTextDraft, editor: { ...sameTextDraft.editor,
      contentReview: { ...sameTextDraft.editor.contentReview, issues: ['Now unresolved.'] } } };
    assert.notEqual(store.computeApprovalFingerprint(approved.queueItem, alternativeReview).evidenceReviewHash,
      approved.approvalSnapshot.evidenceReviewHash, 'review-only changes must alter the approval fingerprint');
    const tampered = store.saveQueueItem({ ...approved.queueItem,
      approvalSnapshot: { ...approved.approvalSnapshot, evidenceReviewHash: 'stale-attestation' } });
    assert.equal(store.getMainFeedScheduleItem(source.key).approvalSnapshotMismatch, true);
    assert.equal(store.claimQueueItemForPublication(tampered.id), null, 'atomic queue claim rejects stale evidence fingerprint');
    store.saveQueueItem({ ...tampered, approvalSnapshot: approved.approvalSnapshot });
    const currentDraft = store.getDraftByCandidate(source.key);
    store.saveDraft({ ...currentDraft, editor: { ...currentDraft.editor, evidenceUsed: [] } });
    assert.equal(store.getQueueItemByCandidate(source.key).status, 'needs_review',
      'changing ONLY cited evidence after approval invalidates it');
  });
} finally {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
}
