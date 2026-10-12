import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(tmpdir(), 'growth-semantic-controller-'));
const previousCwd = process.cwd();
process.chdir(scratch);
const moduleUrl = (name) => pathToFileURL(path.join(root, name)).href;
const controller = await import(moduleUrl('semantic_controller.js'));
const store = await import(moduleUrl('store.js'));
const jobs = await import(moduleUrl('semantic_jobs.js'));
const lease = await import(moduleUrl('operator_lease.js'));
const persona = await import(moduleUrl('persona.js'));
const runner = await import(moduleUrl('growth_agent_runner.js'));
const runtime = await import(moduleUrl('ai_runtime.js'));
const boundedCli = await import(moduleUrl('ai_bounded_cli.js'));
const dbPath = path.join(scratch, '.x-research.sqlite');

const NOW = Date.UTC(2026, 9, 11, 9, 30, 0);
const REST_NOW = Date.UTC(2026, 9, 10, 21, 30, 0);
const MIN = 60_000;
const HOUR = 3_600_000;

const SENSOR_KEY = 'x_for_you_sensor_provenance_v1';
const expectedHandle = String(process.env.X_ACCOUNT || 'ham_zax').replace(/^@/, '');
const seededKeys = [];
function observeAll(at = NOW) {
  store.saveDiscoverSnapshot('x_for_you', seededKeys.map((key) => ({ key })), at);
  store.recordSourceObservations(seededKeys.map((key, index) => ({
    candidateKey: key, snapshotKind: 'x_for_you', observedAt: at, rank: index + 1, metrics: {},
  })));
  // Authenticated sensor provenance: observedAt equals the snapshot time.
  store.setAppState(SENSOR_KEY, JSON.stringify({
    observedAt: at,
    accountHandle: expectedHandle,
    accountVerified: true,
    adapterType: 'test',
    sessionId: 'test',
    runId: 'test',
    sensorVersion: 'x_for_you_v1',
    collectionStatus: 'complete',
    acceptedCount: seededKeys.length,
  }));
}
// Test-only slate reset for the global unknown fence: production keeps the
// fence until explicit reconciliation; the suite clears it between scenarios.
function clearPending() {
  store.setAppState('semantic_controller_pending_v1', JSON.stringify({ pending: {} }));
}
// Schema-complete outputs: unused fields are empty strings per the decision
// schema contract.
const fullOutput = (over = {}) => ({
  decision: 'skip', purpose: 'p', rationale: 'r',
  targetCandidateKey: '', draft: '', missingEvidence: '', revisitCondition: '', ...over,
});
async function waitFor(condition, label) {
  for (let i = 0; i < 200 && !condition(); i += 1) await new Promise((r) => setTimeout(r, 10));
  assert.ok(condition(), `timed out waiting for ${label}`);
}
function seedCandidate(id, text = `Substantive runtime API note ${id}`, metrics = {}) {
  const key = `https://x.com/dev${id}/status/${1000 + id}`;
  store.upsertCandidates([{
    key, source: 'x', title: `@dev${id}`, text, url: key, timestamp: NOW - 60 * MIN, metrics,
  }]);
  seededKeys.push(key);
  observeAll();
  return key;
}

function grantLive() {
  store.configureGrowthOperatorDelegation({ mode: 'live' }, { actor: 'human' });
  if (store.getGrowthOperatorDelegation().state !== 'running') store.startGrowthOperatorDelegation({ actor: 'human' });
}

function fakeRuntime(script = {}) {
  const calls = [];
  const runStructured = async (options) => {
    calls.push(options);
    if (script.throw) throw script.throw;
    return {
      output: script.output ?? fullOutput({ purpose: 'Nothing worthwhile.', rationale: 'No contribution stands out.' }),
      execution: { inputTokens: 100, cachedInputTokens: 10, outputTokens: 50, reasoningTokens: 5, ...(script.execution || {}) },
    };
  };
  return { calls, runStructured };
}

const laneDirect = { name: 'test-direct', runtime: 'direct_api', providerKind: 'openai_compatible', protocol: 'responses', model: 'test-model', baseUrl: 'https://example.invalid/v1' };
const laneCodex = { name: 'test-codex-luna', runtime: 'codex', providerKind: 'runtime_managed', protocol: 'runtime_native', model: 'gpt-6-luna', reasoning: 'max' };
const codexExecution = { runtime: 'claive', engine: 'codex', executable: '/tmp/test-claive', codexExecutable: '/tmp/test-codex' };
const measuredCodex = { inputTokens: 100, cachedInputTokens: 10, outputTokens: 50, reasoningTokens: 5, modelCalls: 1, toolCalls: 0 };
function tickCodex(overrides = {}) {
  return tick({ profile: laneCodex, runtimeExecution: codexExecution, ...overrides });
}
const HIGH_CEILING = { maxDailyModelCalls: 1000000, maxDailyInputTokens: 1e9, maxDailyOutputTokens: 1e8 };
let seq = 0;
function tick(overrides = {}) {
  return controller.controllerTick({
    now: NOW,
    sessionId: `t-${++seq}`,
    profile: laneDirect,
    config: { ceiling: HIGH_CEILING },
    ...overrides,
  });
}

function stubTransport(captured, body) {
  return async (url, options, timeoutMs) => {
    captured.push({ url: String(url), body: JSON.parse(options.body), timeoutMs });
    return { status: 200, ok: true, text: JSON.stringify(body) };
  };
}

try {
  await test('empty cache needs observations with zero calls', async () => {
    grantLive();
    const fake = fakeRuntime();
    const result = await tick({ runStructured: fake.runStructured });
    assert.equal(result.status, 'observation_required');
    assert.equal(result.modelCalls, 0);
    assert.equal(fake.calls.length, 0);
  });

  await test('stale snapshot without current observations stops with zero calls', async () => {
    seedCandidate(10);
    observeAll(NOW - 7 * HOUR);
    const fake = fakeRuntime();
    const result = await tick({ runStructured: fake.runStructured });
    assert.equal(result.status, 'observation_required');
    assert.equal(fake.calls.length, 0);
    observeAll();
  });

  await test('one worthwhile candidate produces one finite invocation and durable receipts', async () => {
    const key = seedCandidate(11, 'A worthwhile question about isolating inference budgets per request');
    const fake = fakeRuntime({
      output: fullOutput({
        decision: 'reply',
        purpose: 'Answer a concrete budgeting question.',
        rationale: 'The author asks exactly what the ledger answers.',
        targetCandidateKey: key,
        draft: 'Reserve per request against the parent budget; unknown usage stays fenced.',
      }),
    });
    const result = await tick({ runStructured: fake.runStructured });
    assert.equal(result.status, 'completed');
    assert.equal(result.modelCalls, 1);
    assert.equal(fake.calls.length, 1);
    const call = fake.calls[0];
    assert.equal(call.allowRepair, false);
    assert.equal(call.allowFallback, false);
    assert.equal(call.maxOutputTokens, 1000);
    assert.ok(String(call.prompt).includes('A worthwhile question about isolating inference budgets per request'));
    const job = jobs.getJob(result.jobId);
    assert.equal(job.status, 'completed');
    assert.equal(job.result.preparationOnly, true);
    assert.deepEqual(job.budget.unsupported, []);
    const receipts = JSON.parse(store.getAppState('semantic_controller_receipts_v1', '{}')).receipts;
    assert.equal(receipts[key]?.jobId, result.jobId);
    assert.equal(receipts[key]?.outcome, 'completed');
  });

  await test('refreshed timestamps, metric noise, and order changes reuse with zero calls', async () => {
    const key = seedCandidate(12, 'A stable conversation about queue backpressure');
    const first = await tick({ runStructured: fakeRuntime().runStructured });
    assert.equal(first.modelCalls, 1);
    store.upsertCandidates([{ key, source: 'x', title: '@dev12', text: 'A stable conversation about queue backpressure', url: key, timestamp: NOW - 60 * MIN, metrics: { views: 4242, likes: 87 } }]);
    observeAll();
    const fake = fakeRuntime();
    const second = await tick({ runStructured: fake.runStructured });
    assert.equal(second.status, 'reused');
    assert.equal(fake.calls.length, 0);
  });

  await test('an unrelated candidate judges only the new source', async () => {
    const seen = [];
    const fake = fakeRuntime();
    const capturing = async (options) => {
      seen.push(String(options.prompt));
      return fake.runStructured(options);
    };
    const key = seedCandidate(13, 'A brand new conversation about eBPF schedulers');
    const result = await tick({ runStructured: capturing });
    assert.equal(result.modelCalls, 1);
    assert.ok(seen[0].includes('A brand new conversation about eBPF schedulers'));
    assert.ok(!seen[0].includes('A worthwhile question about isolating inference budgets'));
    assert.ok(!seen[0].includes('A stable conversation about queue backpressure'));
    assert.notEqual(result.jobId, null);
  });

  await test('new reply text, rules, and persona revisions each invalidate', async () => {
    const key = seedCandidate(14, 'Original wording about connection pooling');
    const fake = fakeRuntime();
    const first = await tick({ runStructured: fake.runStructured });
    assert.ok(first.jobId);
    store.upsertCandidates([{ key, source: 'x', title: '@dev14', text: 'Edited wording with a new reply about pool exhaustion', url: key, timestamp: NOW - 5 * MIN }]);
    observeAll();
    const second = await tick({ runStructured: fake.runStructured });
    assert.equal(second.modelCalls, 1);
    assert.notEqual(second.jobId, first.jobId);
    const ruled = await tick({
      runStructured: fake.runStructured,
      store: { ...store, listAcceptedLearnedRules: () => [{ ruleId: 'timing:x', scope: 'timing', key: 'x', finding: 'Morning replies land better.', recommendation: 'Prefer morning windows.', primaryMetric: 'replies', adjustment: { proposed: 5 }, evidence: { state: 'directional' } }] },
    });
    assert.equal(ruled.modelCalls, 1);
    assert.notEqual(ruled.jobId, second.jobId);
    const repersonaed = await tick({
      runStructured: fake.runStructured,
      personaSlice: () => ({ ...persona.getPersonaSlice('engagement'), version: 'hamza-v2' }),
    });
    assert.equal(repersonaed.modelCalls, 1);
    assert.notEqual(repersonaed.jobId, ruled.jobId);
  });

  await test('exploration draws outside the display cutoff without gating', () => {
    const ranked = Array.from({ length: 30 }, (_, index) => `key-${index}`);
    const pool = [
      ...ranked.map((key) => ({ key })),
      ...['x-a', 'x-b', 'x-c', 'x-d', 'x-e'].map((key) => ({ key })),
    ];
    const picked = controller.selectShortlist({
      rankedKeys: ranked,
      pool,
      config: { priorityPicks: 3, explorationPicks: 2, shortlistSize: 5 },
    });
    assert.deepEqual(picked.map((item) => item.key), ['key-0', 'key-1', 'key-2', 'x-a', 'x-b']);
    assert.deepEqual(picked.map((item) => item.exploration), [false, false, false, true, true]);
  });

  await test('bounded shortlist keeps exact text with exploration marked', async () => {
    for (const id of [21, 22, 23, 24, 25, 26]) seedCandidate(id);
    const seen = [];
    const fake = fakeRuntime();
    const capturing = async (options) => {
      seen.push(String(options.prompt));
      return fake.runStructured(options);
    };
    const result = await tick({ runStructured: capturing });
    assert.equal(result.modelCalls, 1);
    const prompt = seen[0];
    assert.equal((prompt.match(/^CANDIDATE /gm) || []).length, 5);
    assert.ok(prompt.includes('[exploration]'));
  });

  await test('oversize reduction retains exploration, then defers visibly', () => {
    const eligible = ['a', 'b', 'c', 'd'].map((suffix) => ({
      candidateKey: `https://x.com/u${suffix}/status/1${suffix}`,
      author: `u${suffix}`,
      url: `https://x.com/u${suffix}/status/1${suffix}`,
      text: `Note ${suffix} with enough text to matter for sizing purposes.`,
      metrics: {},
    }));
    const packet = controller.buildDecisionPacket({
      shortlist: eligible.map((card) => ({
        key: card.candidateKey, url: card.url, author: card.author, text: card.text,
        publishedAt: null, nicheTags: [], breakout: null,
        relationship: { tracked: false, stage: null, recentResponses: [] },
        context: {}, exploration: card.candidateKey.endsWith('1c') || card.candidateKey.endsWith('1d'),
        viewsPerHour: 1, engagementsPerHour: 1, ageMinutes: 60,
      })),
      store,
      persona: { version: 'v', identity: {}, operatorDecisions: {} },
      rules: [],
      config: controller.CONTROLLER_DEFAULTS,
      now: NOW,
    });
    const roomy = controller.reducePacket(packet, { maxContextBytes: 1e9, maxEstimatedInputTokens: 1e8 });
    assert.equal(roomy.fits, true);
    assert.deepEqual(roomy.reductions, []);
    const tiny = controller.reducePacket(packet, { maxContextBytes: 100, maxEstimatedInputTokens: 33 });
    assert.equal(tiny.fits, false);
    // Non-exploration drops first, in reverse order; exploration survives to the end.
    const drops = tiny.reductions.filter((entry) => entry.startsWith('candidate:'));
    assert.deepEqual(drops, [
      'candidate:https://x.com/ub/status/1b',
      'candidate:https://x.com/ua/status/1a',
      'candidate:https://x.com/ud/status/1d',
    ]);
    assert.deepEqual(tiny.packet.semanticInput.candidates.map((item) => item.key), ['https://x.com/uc/status/1c']);
  });

  await test('oversize tick defers explicitly before any child launch', async () => {
    const fake = fakeRuntime();
    const result = await tick({ runStructured: fake.runStructured, config: { ceiling: HIGH_CEILING, budget: { maxContextBytes: 100 } } });
    assert.equal(result.status, 'deferred_oversize');
    assert.equal(result.modelCalls, 0);
    assert.equal(result.jobId, null);
    assert.equal(fake.calls.length, 0);
  });

  await test('invalid output ends finitely with one counted call and no silent repair', async () => {
    seedCandidate(31, 'A fresh candidate for the invalid-output path');
    const failure = new Error('AI runtime did not produce schema-valid structured output.');
    failure.code = 'invalid_structured_output';
    const fake = fakeRuntime({ throw: failure });
    const result = await tick({ runStructured: fake.runStructured });
    assert.equal(result.status, 'unresolved');
    assert.equal(result.modelCalls, 1);
    assert.equal(result.result.advisory, true);
    assert.equal(result.result.usageUnknown, true);
    assert.equal(fake.calls.length, 1);
    assert.equal(jobs.getJob(result.jobId).usage.hasUnknownUsage, true);
    clearPending();
  });

  await test('unknown provider usage stays advisory and cannot retry', async () => {
    seedCandidate(32, 'A fresh candidate for the unknown-usage path');
    const fake = fakeRuntime({ execution: { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null } });
    const result = await tick({ runStructured: fake.runStructured });
    assert.equal(result.status, 'unresolved');
    assert.equal(result.result.advisory, true);
    const job = jobs.getJob(result.jobId);
    assert.equal(job.usage.hasUnknownUsage, true);
    assert.equal(job.usage.modelCalls, 1);
    clearPending();
  });

  await test('unverified CLI lanes report capability_unavailable with zero calls', async () => {
    seedCandidate(33, 'A fresh candidate for the capability gate');
    // Codex left this list: the native codex lane is admitted on a labeled,
    // accounted basis (strictLimits:false, maxOutputTokens unsupported) and is
    // covered by the codex-lane tests below. Every other CLI runtime stays
    // refused with no alternate-model fallback.
    for (const testRuntime of ['pi', 'agy', 'opencode', 'claude']) {
      const fake = fakeRuntime();
      const result = await tick({
        runStructured: fake.runStructured,
        profile: { name: `test-${testRuntime}`, runtime: testRuntime, providerKind: 'runtime_managed', protocol: 'runtime_native', model: 'm' },
      });
      assert.equal(result.status, 'blocked');
      assert.match(result.reason, /capability_unavailable/);
      assert.equal(result.jobId, null);
      assert.equal(fake.calls.length, 0);
    }
  });

  await test('codex lane dispatches one finite Luna job with accounted limits metadata', async () => {
    const key = seedCandidate(100, 'A worthwhile Luna question about isolating inference budgets per request');
    const fake = fakeRuntime({ execution: { ...measuredCodex } });
    const captured = [];
    const capturing = async (options) => { captured.push(options); return fake.runStructured(options); };
    const result = await tickCodex({ runStructured: capturing });
    assert.equal(result.status, 'skipped');
    assert.equal(result.modelCalls, 1);
    assert.equal(captured.length, 1);
    const call = captured[0];
    assert.equal(call.profile?.runtime, 'codex');
    assert.equal(call.profile?.model, 'gpt-6-luna');
    assert.equal(call.boundedSemanticJob?.budget?.maxOutputTokens, 1000);
    assert.equal(Object.hasOwn(call.boundedSemanticJob?.budget || {}, 'unsupported'), false);
    assert.equal(call.boundedSemanticJob?.budget?.maxModelCalls, 1);
    assert.deepEqual(call.runtimeExecution, codexExecution);
    assert.equal(call.allowRepair, false);
    assert.equal(call.allowFallback, false);
    assert.equal(call.maxOutputTokens, 1000);
    assert.ok(String(call.prompt).includes('A worthwhile Luna question about isolating inference budgets'));
    const job = jobs.getJob(result.jobId);
    assert.deepEqual(job.budget.unsupported, ['maxOutputTokens', 'maxModelCalls']);
    assert.equal(result.lane, 'codex');
    assert.equal(result.strictLimits, false);
    assert.deepEqual(result.unsupported, ['maxOutputTokens', 'maxModelCalls']);
    const prepared = boundedCli.prepareBoundedCliRequest(laneCodex, {
      prompt: call.prompt,
      schema: controller.CONTROLLER_DECISION_SCHEMA,
      maxOutputTokens: call.maxOutputTokens,
      timeoutMs: call.timeoutMs,
      budget: call.boundedSemanticJob.budget,
    });
    assert.deepEqual(result.enforcement, prepared.metadata.enforcement);
    assert.match(result.enforcement.outputCap, /no per-response output cap/);
    assert.match(result.enforcement.modelCalls, /retries stay at native defaults/);
    assert.match(result.enforcement.retries, /native built-in defaults/);
    const attempt = jobs.getAttempt(result.attemptId);
    assert.equal(attempt.actual.modelCalls, 1);
    assert.equal(attempt.actual.toolCalls, 0);
    const receipts = JSON.parse(store.getAppState('semantic_controller_receipts_v1', '{}')).receipts;
    assert.equal(receipts[key]?.jobId, result.jobId);
  });

  await test('codex output overshoot is charged and stops terminally', async () => {
    seedCandidate(101, 'A Luna candidate whose single response exceeds its cap');
    const before = JSON.parse(store.getAppState('semantic_controller_usage_v1', '{}'));
    const fake = fakeRuntime({ execution: { ...measuredCodex, outputTokens: 1500 } });
    const result = await tickCodex({ runStructured: fake.runStructured });
    assert.equal(result.status, 'blocked');
    assert.match(result.reason, /budget_exceeded: output 1500 > max 1000/);
    assert.equal(result.modelCalls, 1);
    assert.equal(fake.calls.length, 1);
    const job = jobs.getJob(result.jobId);
    assert.equal(job.terminalOutcome, 'blocked');
    // The excess is recorded as genuine usage, never hidden behind the cap.
    assert.equal(job.usage.outputTokens, 1500);
    assert.match(result.result.budgetExceeded, /output 1500 > max 1000/);
    assert.equal(result.result.usage.outputTokens, 1500);
    // The daily ceiling ends charged exactly the actual excess relative to
    // pre-tick: admission reserved maxOutputTokens 1000, settlement replaced
    // that estimate with the actual 1500 (and the estimate input with 100).
    const after = JSON.parse(store.getAppState('semantic_controller_usage_v1', '{}'));
    assert.equal(after.reservations?.[result.attemptId], undefined);
    assert.equal(after.outputTokens, before.outputTokens + 1500);
    assert.equal(after.inputTokens, before.inputTokens + 100);
    assert.equal(after.modelCalls, before.modelCalls + 1);
  });

  await test('codex actual request count reconciles the daily ledger and fences the next job', async () => {
    seedCandidate(106, 'A Luna candidate whose adapter audit observes a native retry');
    const before = JSON.parse(store.getAppState('semantic_controller_usage_v1', '{}'));
    const fake = fakeRuntime({ execution: { ...measuredCodex, modelCalls: 2 } });
    const ceiling = {
      maxDailyModelCalls: before.modelCalls + 1,
      maxDailyInputTokens: 1e9,
      maxDailyOutputTokens: 1e8,
    };
    const result = await tickCodex({
      runStructured: fake.runStructured,
      config: { budget: { maxModelCalls: 2 }, ceiling },
    });
    assert.equal(result.status, 'skipped');
    assert.equal(result.modelCalls, 2);
    assert.equal(result.adapterInvocations, 1);
    assert.equal(jobs.getAttempt(result.attemptId).actual.modelCalls, 2);
    const after = JSON.parse(store.getAppState('semantic_controller_usage_v1', '{}'));
    assert.equal(after.modelCalls, before.modelCalls + 2);
    assert.equal(after.reservations?.[result.attemptId], undefined);

    seedCandidate(107, 'A second candidate after native request-count overage');
    const next = fakeRuntime({ execution: { ...measuredCodex } });
    const blocked = await tickCodex({ runStructured: next.runStructured, config: { ceiling } });
    assert.equal(blocked.status, 'ceiling_reached');
    assert.equal(next.calls.length, 0);
  });

  await test('Codex measurement and unsupported limits come from adapter preparation with zero tool authority', () => {
    const key = 'https://x.com/measure106/status/2106';
    const packet = controller.buildDecisionPacket({
      shortlist: [{ key, url: key, author: 'measure106', text: 'A short sizing candidate.', context: {}, exploration: false }],
      store,
      persona: { version: 'test', identity: {}, operatorDecisions: {} },
      rules: [], config: controller.CONTROLLER_DEFAULTS, now: NOW,
    });
    const budget = { ...controller.CONTROLLER_DEFAULTS.budget, maxToolCalls: 0 };
    const measured = controller.measureCodexPacket(packet, laneCodex, budget);
    const prepared = boundedCli.prepareBoundedCliRequest(laneCodex, {
      prompt: measured.prompt,
      schema: controller.CONTROLLER_DECISION_SCHEMA,
      maxOutputTokens: budget.maxOutputTokens,
      timeoutMs: budget.maxWallTimeMs,
      budget,
    });
    assert.equal(measured.bytes, prepared.bytes);
    assert.equal(measured.estimate, prepared.estimatedInputTokens);
    assert.deepEqual(measured.unsupported, ['maxOutputTokens', 'maxModelCalls']);
    assert.deepEqual(measured.unsupported, prepared.metadata.unsupported);
  });

  await test('nonzero Codex tool budget blocks before admission and dispatch', async () => {
    seedCandidate(109, 'A candidate behind the zero-tool authority boundary');
    const fake = fakeRuntime();
    const result = await tickCodex({ runStructured: fake.runStructured, config: { budget: { maxToolCalls: 3 } } });
    assert.equal(result.status, 'blocked');
    assert.match(result.reason, /wire_packet_unmeasurable: unsupported_budget/);
    assert.equal(result.jobId, null);
    assert.equal(result.modelCalls, 0);
    assert.equal(fake.calls.length, 0);
  });

  await test('codex unknown counts stay advisory and fence the next wake', async () => {
    seedCandidate(102, 'A Luna candidate with unmeasured call counts');
    const unmeasured = fakeRuntime({ execution: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 50, reasoningTokens: 0 } });
    const result = await tickCodex({ runStructured: unmeasured.runStructured });
    assert.equal(result.status, 'unresolved');
    assert.match(result.reason, /provider_usage_unknown_advisory_only/);
    assert.equal(result.lane, 'codex');
    assert.equal(result.modelCalls, null);
    assert.equal(result.adapterInvocations, 1);
    assert.equal(jobs.getJob(result.jobId).usage.hasUnknownUsage, true);
    seedCandidate(103, 'A brand new candidate behind the unknown fence');
    const fake = fakeRuntime({ execution: { ...measuredCodex } });
    const fenced = await tickCodex({ runStructured: fake.runStructured });
    assert.equal(fenced.status, 'unresolved');
    assert.match(fenced.reason, /uncertain_usage_fence/);
    assert.equal(fenced.modelCalls, 0);
    assert.equal(fake.calls.length, 0);
    clearPending();
  });

  await test('unsupported configured runtime never substitutes another model', async () => {
    seedCandidate(104, 'A candidate behind an unsupported runtime selection');
    const fake = fakeRuntime({ execution: { ...measuredCodex } });
    const result = await tick({
      runStructured: fake.runStructured,
      profile: { name: 'test-opencode', runtime: 'opencode', providerKind: 'runtime_managed', protocol: 'runtime_native', model: 'opencode/m' },
    });
    assert.equal(result.status, 'blocked');
    assert.match(result.reason, /capability_unavailable: runtime opencode/);
    assert.equal(result.jobId, null);
    assert.equal(result.modelCalls, 0);
    assert.equal(fake.calls.length, 0);
  });

  await test('unsupported explicit native Codex model is rejected before job admission', async () => {
    seedCandidate(108, 'A candidate behind an explicitly selected unsupported Codex model');
    const fake = fakeRuntime({ execution: { ...measuredCodex } });
    const result = await tickCodex({
      profile: { ...laneCodex, model: 'gpt-6' },
      runStructured: fake.runStructured,
    });
    assert.equal(result.status, 'blocked');
    assert.match(result.reason, /wire_packet_unmeasurable: profile_unsupported/);
    assert.equal(result.jobId, null);
    assert.equal(result.modelCalls, 0);
    assert.equal(fake.calls.length, 0);
  });

  await test('direct_api lane keeps strict admission with no unsupported limits', async () => {
    seedCandidate(105, 'A direct_api candidate proving strict admission');
    const fake = fakeRuntime();
    const seen = [];
    const capturing = async (options) => { seen.push(options); return fake.runStructured(options); };
    const result = await tick({ runStructured: capturing });
    assert.equal(result.modelCalls, 1);
    assert.equal(seen[0].boundedSemanticJob, undefined);
    assert.equal(seen[0].runtimeExecution, undefined);
    assert.equal(result.lane, 'direct_api');
    assert.equal(result.strictLimits, true);
    assert.deepEqual(result.unsupported, []);
    assert.deepEqual(jobs.getJob(result.jobId).budget.unsupported, []);
    assert.equal(result.enforcement.perResponseCap, true);
  });

  await test('decision validation respects lanes and rejects illegal output', () => {
    const keys = ['k1'];
    assert.equal(controller.validateDecision({ decision: 'reply', purpose: 'p', rationale: 'r', targetCandidateKey: 'k1', draft: 'hi' }, { keys, lanes: { reply: true, quote: true } }).ok, true);
    assert.equal(controller.validateDecision({ decision: 'reply', purpose: 'p', rationale: 'r', targetCandidateKey: 'k1', draft: 'hi' }, { keys, lanes: { reply: false, quote: true } }).ok, false);
    assert.equal(controller.validateDecision({ decision: 'skip', purpose: 'p', rationale: '' }, { keys, lanes: { reply: true, quote: true } }).ok, false);
    assert.equal(controller.validateDecision({ decision: 'defer', purpose: 'p', rationale: 'r' }, { keys, lanes: { reply: true, quote: true } }).ok, false);
  });

  await test('direct_api enforces the per-request output cap and parses usage details', async () => {
    const captured = [];
    const body = {
      output_text: JSON.stringify(fullOutput()),
      usage: { input_tokens: 80, output_tokens: 20, input_tokens_details: { cached_tokens: 30 }, output_tokens_details: { reasoning_tokens: 7 } },
      model: 'test-model',
    };
    const response = await runtime.runStructuredAI({
      role: 'editorial_scan',
      profile: { ...laneDirect },
      prompt: 'Decide.',
      schema: controller.CONTROLLER_DECISION_SCHEMA,
      timeoutMs: 10000,
      allowRepair: false,
      allowFallback: false,
      maxOutputTokens: 1000,
      transport: stubTransport(captured, body),
    });
    assert.equal(response.output.decision, 'skip');
    assert.equal(captured.length, 1);
    assert.equal(captured[0].body.max_output_tokens, 1000);
    assert.equal(response.execution.inputTokens, 80);
    assert.equal(response.execution.cachedInputTokens, 30);
    assert.equal(response.execution.outputTokens, 20);
    assert.equal(response.execution.reasoningTokens, 7);
    assert.equal(response.execution.outputTokenLimit, 1000);
  });

  await test('direct_api tick persists cached and reasoning usage per attempt', async () => {
    seedCandidate(34, 'A fresh candidate for real direct_api accounting');
    const captured = [];
    const body = {
      output_text: JSON.stringify(fullOutput({ purpose: 'Not now.', rationale: 'Thin evidence.' })),
      usage: { input_tokens: 90, output_tokens: 21, input_tokens_details: { cached_tokens: 12 }, output_tokens_details: { reasoning_tokens: 4 } },
      model: 'test-model',
    };
    const result = await tick({ config: { ceiling: HIGH_CEILING, transport: stubTransport(captured, body) } });
    assert.equal(result.status, 'skipped');
    assert.equal(captured[0].body.max_output_tokens, 1000);
    const attempt = jobs.getAttempt(result.attemptId);
    assert.equal(attempt.actual.cachedInputTokens, 12);
    assert.equal(attempt.actual.reasoningTokens, 4);
    assert.equal(attempt.actual.modelCalls, 1);
  });

  await test('concurrent ticks admit once and stop the loser safely', async () => {
    seedCandidate(35, 'A fresh candidate for the concurrency path');
    const fake = fakeRuntime({
      output: fullOutput(),
    });
    const [first, second] = await Promise.all([
      tick({ runStructured: fake.runStructured, sessionId: 'conc-a' }),
      tick({ runStructured: fake.runStructured, sessionId: 'conc-b' }),
    ]);
    assert.equal(fake.calls.length, 1);
    assert.equal(first.status, 'skipped');
    assert.equal(second.status, 'job_in_progress');
    assert.equal(second.jobId, first.jobId);
  });

  await test('in-flight work fenced with a visible descriptor, never auto-rerun', async () => {
    seedCandidate(36, 'A fresh candidate beside in-flight work');
    const admitted = jobs.admitJob({
      kind: 'opportunity_selection',
      semanticInput: { probe: 'in-flight' },
      versions: {},
      budget: {
        maxCandidates: 5, maxContextBytes: 20000, maxEstimatedInputTokens: 4000,
        maxCumulativeInputTokens: 12000, maxModelCalls: 3, maxOutputTokens: 2000,
        maxWallTimeMs: 60000, maxRepairs: 1,
      },
    });
    jobs.claimJob(admitted.job.id, { claimant: 'probe' });
    jobs.reserveAttempt(admitted.job.id, { claimant: 'probe', inputTokensReserved: 10, outputTokensReserved: 10 });
    store.setAppState('semantic_controller_pending_v1', JSON.stringify({
      pending: { [admitted.job.id]: { keys: { 'https://x.com/other/status/1': 'fp' }, admittedAt: NOW } },
    }));
    const fake = fakeRuntime();
    const fenced = await tick({ runStructured: fake.runStructured });
    assert.equal(fenced.status, 'job_in_progress');
    assert.equal(fenced.jobId, admitted.job.id);
    assert.equal(fenced.descriptor.fences[0].reservedAttempts, 1);
    assert.equal(fake.calls.length, 0);
    const attempt = jobs.listJobAttempts(admitted.job.id)[0];
    jobs.settleAttempt(attempt.id, { claimant: 'probe', usage: { inputTokens: 10, outputTokens: 5, modelCalls: 1, toolCalls: 0, wallTimeMs: 5 } });
    jobs.settleJobTerminal(admitted.job.id, { claimant: 'probe', outcome: 'completed', reason: 'Probe cleanup.' });
  });

  await test('terminal waiting stays waiting until defined evidence changes', async () => {
    seedCandidate(37, 'A candidate that must wait for evidence');
    const fake = fakeRuntime({
      output: fullOutput({ decision: 'needs_evidence', missingEvidence: 'Benchmark numbers.' }),
    });
    const first = await tick({ runStructured: fake.runStructured });
    assert.equal(first.status, 'waiting_for_evidence');
    const again = await tick({ runStructured: fake.runStructured });
    assert.equal(again.status, 'reused');
    assert.equal(fake.calls.length, 1);
  });

  await test('controller main uses the real mode branch without browser or child', async () => {
    seedCandidate(38, 'A fresh candidate for the runner-mode path');
    const fake = fakeRuntime({ output: fullOutput({ purpose: 'Not worthwhile.', rationale: 'Thin.' }) });
    const config = {
      runtime: 'codex', claiveEngine: 'muse', model: 'test-model', windowMinutes: 5,
      browserTarget: 'linux', cdpPort: '9222', agentBrowserCli: 'none',
      browserInterface: 'agent-browser-cli', browserMcpServer: 'xgrowth_browser',
      browserFastBackend: 'clearcote', thinking: 'low', experiment: false,
      agentMode: 'controller', executable: 'never-spawn',
    };
    const outcome = await runner.main({
      config,
      now: () => NOW,
      record: () => ({}),
      backoffStateFile: `${scratch}/backoff.json`,
      child: () => { throw new Error('controller mode must not spawn a child'); },
      controller: { runStructured: fake.runStructured, profile: laneDirect, sessionId: 'runner-mode-test', config: { ceiling: HIGH_CEILING } },
    });
    assert.equal(outcome.controller.status, 'skipped');
    assert.equal(outcome.controller.modelCalls, 1);
    assert.equal(jobs.getJob(outcome.controller.jobId).status, 'skipped');
  });

  await test('daily ceiling stops novelty and survives process restart', async () => {
    const state = JSON.parse(store.getAppState('semantic_controller_usage_v1', '{}'));
    const ceiling = {
      maxDailyModelCalls: Number(state.modelCalls || 0),
      maxDailyInputTokens: Number(state.inputTokens || 0),
      maxDailyOutputTokens: Number(state.outputTokens || 0),
    };
    seedCandidate(39, 'A fresh candidate under a spent ceiling');
    const fake = fakeRuntime();
    const result = await tick({ runStructured: fake.runStructured, config: { ceiling } });
    assert.equal(result.status, 'ceiling_reached');
    assert.equal(fake.calls.length, 0);
    const handle = new DatabaseSync(dbPath);
    try {
      const row = handle.prepare('SELECT value FROM app_state WHERE key = ?').get('semantic_controller_usage_v1');
      assert.equal(JSON.parse(row.value).modelCalls, ceiling.maxDailyModelCalls);
    } finally {
      handle.close();
    }
  });

  await test('unfinished publication, social, and queue work emit descriptors', async () => {
    const queueItem = store.ensureQueueItem(seedCandidate(40), { status: 'triage', pipeline: 'original', lane: 'main' });
    const handle = new DatabaseSync(dbPath);
    try {
      handle.exec('BEGIN IMMEDIATE');
      try {
        handle.prepare(`INSERT INTO publication_attempts(
          attempt_id, queue_item_id, candidate_key, lane, pipeline, action_type, action_fingerprint,
          state, claimed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          'attempt-recovery-1', queueItem.id, queueItem.candidateKey, 'main', 'original',
          'publish', 'fp-1', 'send_started', NOW, NOW, NOW,
        );
        handle.prepare(`INSERT INTO social_action_attempts(
          attempt_id, action, target_key, target_url, run_id, session_id, state, reason, context_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          'social-recovery-1', 'like', 'dev40', 'https://x.com/dev40/status/1040',
          'run-1', 'session-1', 'claimed', 'test recovery', '{}', NOW,
        );
        handle.exec('COMMIT');
      } catch (error) {
        handle.exec('ROLLBACK');
        throw error;
      }
      const fake = fakeRuntime();
      const recovery = await tick({ runStructured: fake.runStructured });
      assert.equal(recovery.status, 'recovery_required');
      assert.equal(recovery.descriptor.attempts[0].attemptId, 'attempt-recovery-1');
      assert.equal(fake.calls.length, 0);
      handle.prepare("UPDATE publication_attempts SET state = 'closed_unresolved' WHERE attempt_id = 'attempt-recovery-1'").run();
      const social = await tick({ runStructured: fake.runStructured });
      assert.equal(social.status, 'recovery_required');
      assert.equal(social.descriptor.attempts[0].attemptId, 'social-recovery-1');
      handle.prepare("DELETE FROM social_action_attempts WHERE attempt_id = 'social-recovery-1'").run();
      const dueKey = seedCandidate(41, 'A repostable release note with unusual benchmark numbers');
      let dueItem = store.ensureQueueItem(dueKey, { status: 'approved', pipeline: 'repost', lane: 'main', humanApprovedAt: NOW - MIN });
      const dueFp = store.computeApprovalFingerprint(dueItem, null, store.getCandidate(dueKey));
      store.saveQueueItem({ id: dueItem.id, approvalSnapshot: { contentHash: dueFp.contentHash, mediaHash: dueFp.mediaHash, gateHash: dueFp.gateHash, approvedAt: NOW - MIN, authority: { type: 'human' } } });
      const queue = await tick({ runStructured: fake.runStructured });
      assert.equal(queue.status, 'due_queue');
      assert.ok(queue.descriptor.items.some((item) => item.pipeline === 'repost' && item.candidateKey.endsWith('/status/1041')));
    } finally {
      handle.close();
    }
  });

  await test('dispatched body fits the wire-packet reservation', async () => {
    // The recovery fixture's due item is spent: expire it through the real
    // scheduler path so later dispatch tests are not shadowed by due work.
    const spent = store.getQueueItemByCandidate('https://x.com/dev41/status/1041');
    if (spent) store.saveQueueItem({ id: spent.id, expiresAt: NOW - MIN });
    seedCandidate(50, 'A wire-budget question about reserving the full provider envelope');
    const captured = [];
    const body = {
      output_text: JSON.stringify(fullOutput({ purpose: 'Envelope accounted.', rationale: 'Reservation covers the wire body.' })),
      usage: { input_tokens: 120, output_tokens: 22, input_tokens_details: { cached_tokens: 8 }, output_tokens_details: { reasoning_tokens: 3 } },
      model: 'test-model',
    };
    const result = await tick({ config: { ceiling: HIGH_CEILING, transport: stubTransport(captured, body) } });
    assert.equal(result.status, 'skipped');
    assert.equal(captured.length, 1);
    assert.equal(captured[0].body.max_output_tokens, 1000);
    const bytes = Buffer.byteLength(JSON.stringify(captured[0].body));
    const job = jobs.getJob(result.jobId);
    assert.ok(job.estimatedInputTokens >= Math.ceil(bytes / 3),
      `reservation ${job.estimatedInputTokens} omitted envelope from ${bytes}-byte actual request`);
    assert.ok(bytes <= job.budget.maxContextBytes);
  });

  await test('wire-packet budget rejects at the exact boundary', () => {
    const cards = ['w-a', 'w-b'].map((suffix) => ({
      key: `https://x.com/wire${suffix}/status/90${suffix}`,
      url: `https://x.com/wire${suffix}/status/90${suffix}`,
      author: `wire${suffix}`,
      text: `Wire budget note ${suffix} with enough text to matter for sizing.`,
      publishedAt: null,
      nicheTags: [],
      breakout: null,
      relationship: { tracked: false, stage: null, recentResponses: [] },
      context: {},
      exploration: false,
      viewsPerHour: 1,
      engagementsPerHour: 1,
      ageMinutes: 60,
    }));
    const build = (list) => controller.buildDecisionPacket({
      shortlist: list, store, persona: { version: 'v', identity: {}, operatorDecisions: {} },
      rules: [], config: controller.CONTROLLER_DEFAULTS, now: NOW,
    });
    const sizer = (target) => controller.measureWirePacket(target, laneDirect, 1000);
    const full = sizer(build(cards));
    assert.equal(full.estimate, Math.ceil(full.bytes / 3));
    assert.equal(sizer(build(cards)).bytes, full.bytes);
    const exact = controller.reducePacket(build(cards), { maxContextBytes: full.bytes, maxEstimatedInputTokens: full.estimate }, sizer);
    assert.equal(exact.fits, true);
    assert.deepEqual(exact.reductions, []);
    // One byte below the single-candidate floor: the tail drops first, then
    // the remainder visibly defers instead of dispatching.
    const one = sizer(build(cards.slice(0, 1)));
    const tight = controller.reducePacket(build(cards), { maxContextBytes: one.bytes - 1, maxEstimatedInputTokens: 1e9 }, sizer);
    assert.equal(tight.fits, false);
    assert.deepEqual(tight.reductions, [`candidate:${cards[1].key}`]);
    const tightTokens = controller.reducePacket(build(cards), { maxContextBytes: 1e9, maxEstimatedInputTokens: one.estimate - 1 }, sizer);
    assert.equal(tightTokens.fits, false);
  });

  await test('failed validation usage settles known fields without a fence', async () => {
    seedCandidate(51, 'A candidate whose provider response fails validation');
    const captured = [];
    const body = {
      output_text: 'not json{{{',
      usage: { input_tokens: 60, output_tokens: 10, input_tokens_details: { cached_tokens: 4 }, output_tokens_details: { reasoning_tokens: 2 } },
      model: 'test-model',
    };
    const first = await tick({ config: { ceiling: HIGH_CEILING, transport: stubTransport(captured, body) } });
    assert.equal(first.status, 'unresolved');
    assert.match(first.reason, /dispatch_failed: invalid_structured_output/);
    assert.equal(captured.length, 1);
    const job = jobs.getJob(first.jobId);
    assert.equal(job.usage.inputTokens, 60);
    assert.equal(job.usage.outputTokens, 10);
    assert.equal(job.usage.hasUnknownUsage, false);
    const attempt = jobs.getAttempt(first.attemptId);
    assert.equal(attempt.actual.cachedInputTokens, 4);
    assert.equal(attempt.actual.reasoningTokens, 2);
    assert.equal(attempt.actual.modelCalls, 1);
    // Earlier unknown-fence scenarios intentionally keep their estimate
    // charges; this attempt's own reservation must be reconciled away.
    const usage = JSON.parse(store.getAppState('semantic_controller_usage_v1', '{}'));
    assert.equal(usage.reservations?.[first.attemptId], undefined);
    const fake = fakeRuntime();
    const second = await tick({ runStructured: fake.runStructured });
    assert.equal(second.status, 'reused');
    assert.equal(fake.calls.length, 0);
    // The reused outcome surfaces prior decisions in pool order; our failed
    // job must be among them with its own receipt intact.
    assert.ok((second.descriptor?.jobIds || []).includes(first.jobId));
    assert.equal(JSON.parse(store.getAppState('semantic_controller_receipts_v1', '{}')).receipts?.['https://x.com/dev51/status/1051']?.jobId, first.jobId);
  });

  await test('terminal unknown usage fences a different candidate across day rollover', async () => {
    seedCandidate(60, 'A candidate whose usage stays unknown before rollover');
    const unknown = fakeRuntime({ execution: { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null } });
    const fenced = await tick({ runStructured: unknown.runStructured });
    assert.equal(fenced.status, 'unresolved');
    const nextDay = NOW + 26 * HOUR;
    seedCandidate(61, 'A brand new candidate observed after rollover');
    observeAll(nextDay);
    const fake = fakeRuntime();
    const result = await tick({ now: nextDay, runStructured: fake.runStructured });
    assert.equal(result.status, 'unresolved');
    assert.match(result.reason, /uncertain_usage_fence/);
    assert.equal(result.modelCalls, 0);
    assert.equal(fake.calls.length, 0);
    assert.ok((result.descriptor?.fences || []).some((fence) => fence.jobId === fenced.jobId && fence.hasUnknownUsage));
    const usage = JSON.parse(store.getAppState('semantic_controller_usage_v1', '{}'));
    assert.ok(Object.keys(usage.reservations || {}).length >= 1, 'unknown charge survives rollover');
    clearPending();
    // A new day resets counters without releasing anything: the next dispatch
    // starts from zero rather than accumulating pre-rollover totals.
    const third = await tick({ now: nextDay, runStructured: fake.runStructured });
    assert.equal(third.modelCalls, 1);
    const reset = JSON.parse(store.getAppState('semantic_controller_usage_v1', '{}'));
    assert.equal(reset.date, new Date(nextDay).toISOString().slice(0, 10));
    assert.equal(reset.modelCalls, 1);
    assert.equal(reset.inputTokens, 100);
    observeAll();
  });

  await test('two processes with distinct packets cannot both consume one daily call', async () => {
    const procScratch = await mkdtemp(path.join(tmpdir(), 'growth-semantic-duel-'));
    try {
      const run = (id) => new Promise((resolve, reject) => {
        execFile(process.execPath, [path.join(root, 'tests/controller_proc_tick.mjs'), procScratch, String(id), '400'], { timeout: 60000 }, (error, stdout, stderr) => {
          if (error) reject(new Error(`proc ${id} failed: ${String(stderr || error.message).slice(0, 300)}`));
          else resolve(JSON.parse(String(stdout).trim().split('\n').at(-1)));
        });
      });
      const [a, b] = await Promise.all([run(71), run(72)]);
      assert.equal(a.modelCalls + b.modelCalls, 1);
      assert.equal([a, b].filter((r) => r.modelCalls === 1).length, 1);
      assert.ok([a, b].some((r) => r.status === 'job_in_progress' || r.status === 'ceiling_reached'));
    } finally {
      await rm(procScratch, { recursive: true, force: true });
    }
  });

  await test('crash between settlement and accounting charges once with no retry', async () => {
    seedCandidate(62, 'A candidate judged before the simulated crash');
    const fake = fakeRuntime({ execution: { ...measuredCodex, modelCalls: 2 } });
    const jobBudget = { budget: { maxModelCalls: 2 } };
    const first = await tickCodex({ runStructured: fake.runStructured, config: jobBudget });
    assert.ok(first.jobId && first.attemptId);
    assert.equal(first.modelCalls, 2);
    const job = jobs.getJob(first.jobId);
    // Restore the pre-accounting durable state: receipts without this
    // candidate, the pending marker, and the estimate charge present.
    const receiptsKey = 'semantic_controller_receipts_v1';
    const all = JSON.parse(store.getAppState(receiptsKey, '{}'));
    const fp62 = all.receipts?.['https://x.com/dev62/status/1062']?.fp;
    assert.ok(fp62);
    delete all.receipts['https://x.com/dev62/status/1062'];
    store.setAppState(receiptsKey, JSON.stringify(all));
    store.setAppState('semantic_controller_pending_v1', JSON.stringify({
      pending: { [first.jobId]: { keys: { 'https://x.com/dev62/status/1062': fp62 }, admittedAt: NOW } },
    }));
    const usageKey = 'semantic_controller_usage_v1';
    const before = { date: '', modelCalls: 0, inputTokens: 0, outputTokens: 0, reservations: {}, ...JSON.parse(store.getAppState(usageKey, '{}')) };
    const actual = jobs.getAttempt(first.attemptId).actual;
    before.reservations[first.attemptId] = { jobId: first.jobId, modelCalls: 1, input: job.estimatedInputTokens, output: job.budget.maxOutputTokens };
    before.inputTokens = before.inputTokens - actual.inputTokens + job.estimatedInputTokens;
    before.outputTokens = before.outputTokens - actual.outputTokens + job.budget.maxOutputTokens;
    before.modelCalls = before.modelCalls - actual.modelCalls + 1;
    store.setAppState(usageKey, JSON.stringify(before));
    const again = await tickCodex({ runStructured: fake.runStructured, config: jobBudget });
    assert.equal(again.status, 'reused');
    assert.equal(again.modelCalls, 0);
    assert.equal(fake.calls.length, 1);
    const after = JSON.parse(store.getAppState(usageKey, '{}'));
    assert.equal(after.reservations?.[first.attemptId], undefined);
    assert.equal(after.inputTokens, before.inputTokens - job.estimatedInputTokens + actual.inputTokens);
    assert.equal(after.outputTokens, before.outputTokens - job.budget.maxOutputTokens + actual.outputTokens);
    assert.equal(after.modelCalls, before.modelCalls - 1 + actual.modelCalls);
    assert.equal(jobs.listJobAttempts(first.jobId).length, 1);
  });

  await test('corrupt controller ledger and ceiling config fail closed', async () => {
    assert.deepEqual(
      controller.resolveCeiling({ maxDailyModelCalls: 0, maxDailyInputTokens: NaN, maxDailyOutputTokens: -5 }),
      controller.CONTROLLER_DEFAULTS.ceiling,
    );
    assert.deepEqual(controller.resolveCeiling(undefined), controller.CONTROLLER_DEFAULTS.ceiling);
    seedCandidate(63, 'A candidate judged only after ledger repair');
    store.setAppState('semantic_controller_pending_v1', 'not-json{{{');
    const fake = fakeRuntime();
    const corruptPending = await tick({ runStructured: fake.runStructured });
    assert.equal(corruptPending.status, 'blocked');
    assert.match(corruptPending.reason, /controller_pending_state_corrupt/);
    assert.equal(fake.calls.length, 0);
    store.setAppState('semantic_controller_pending_v1', JSON.stringify({ pending: {} }));
    store.setAppState('semantic_controller_usage_v1', '{"modelCalls":"lots"}');
    const corruptUsage = await tick({ runStructured: fake.runStructured });
    assert.equal(corruptUsage.status, 'blocked');
    assert.match(corruptUsage.reason, /controller_usage_state_corrupt/);
    assert.equal(fake.calls.length, 0);
    store.setAppState('semantic_controller_usage_v1', '');
    const repaired = await tick({ runStructured: fake.runStructured });
    assert.equal(repaired.modelCalls, 1);
  });

  await test('authority change between snapshot and dispatch prevents the request', async () => {
    const item = store.ensureQueueItem(seedCandidate(64), { status: 'triage', pipeline: 'original', lane: 'main' });
    const handle = new DatabaseSync(dbPath);
    try {
      handle.prepare(`INSERT INTO publication_attempts(
        attempt_id, queue_item_id, candidate_key, lane, pipeline, action_type, action_fingerprint,
        state, claimed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'attempt-authority-1', item.id, item.candidateKey, 'main', 'original',
        'publish', 'fp-authority', 'send_started', NOW, NOW, NOW,
      );
      let calls = 0;
      const flapping = {
        ...store,
        getGrowthOperatorDelegation: () => {
          calls += 1;
          const grant = store.getGrowthOperatorDelegation();
          return calls === 1 ? grant : { ...grant, revision: grant.revision + 1 };
        },
      };
      const fake = fakeRuntime();
      const result = await tick({ store: flapping, runStructured: fake.runStructured });
      assert.equal(result.status, 'blocked');
      assert.match(result.reason, /delegation_changed_during_tick/);
      assert.equal(result.descriptor, null);
      assert.equal(fake.calls.length, 0);
      handle.prepare("UPDATE publication_attempts SET state = 'closed_unresolved' WHERE attempt_id = 'attempt-authority-1'").run();
    } finally {
      handle.close();
    }
  });

  await test('for-you freshness requires exact authenticated provenance', async () => {
    seedCandidate(65, 'A candidate under provenance checks');
    const fake = fakeRuntime();
    observeAll(NOW + 60 * MIN);
    const future = await tick({ runStructured: fake.runStructured });
    assert.equal(future.status, 'observation_required');
    assert.equal(fake.calls.length, 0);
    observeAll();
    store.setAppState(SENSOR_KEY, JSON.stringify({ observedAt: NOW, accountHandle: 'someone_else', accountVerified: true }));
    const mismatch = await tick({ runStructured: fake.runStructured });
    assert.equal(mismatch.status, 'observation_required');
    assert.equal(fake.calls.length, 0);
    observeAll();
    store.setAppState(SENSOR_KEY, JSON.stringify({ observedAt: NOW - MIN, accountHandle: expectedHandle, accountVerified: true }));
    const drifted = await tick({ runStructured: fake.runStructured });
    assert.equal(drifted.status, 'observation_required');
    assert.equal(fake.calls.length, 0);
    observeAll();
    const repaired = await tick({ runStructured: fake.runStructured });
    assert.equal(repaired.modelCalls, 1);
  });

  await test('source error keeps fresh last-good evidence, stale error reports collection failure', async () => {
    seedCandidate(66, 'A candidate under a recorded source error');
    store.recordDiscoverSnapshotError('x_for_you', new Error('sensor hiccup'));
    const fake = fakeRuntime();
    const degraded = await tick({ runStructured: fake.runStructured });
    assert.equal(degraded.modelCalls, 1);
    observeAll(NOW - 7 * HOUR);
    store.recordDiscoverSnapshotError('x_for_you', new Error('sensor hiccup'));
    const failed = await tick({ runStructured: fake.runStructured });
    assert.equal(failed.status, 'observation_required');
    assert.equal(failed.reason, 'source_collection_error');
    assert.equal(fake.calls.length, 1);
    observeAll();
  });

  await test('dispatch timeout uses exact remaining deadline without a floor', async () => {
    seedCandidate(67, 'A candidate under a tight wall budget');
    const seen = [];
    const fake = fakeRuntime();
    const capturing = async (options) => { seen.push(options); return fake.runStructured(options); };
    const result = await tick({ runStructured: capturing, config: { ceiling: HIGH_CEILING, budget: { maxWallTimeMs: 500 } } });
    assert.equal(seen.length, 1);
    assert.ok(seen[0].timeoutMs > 0 && seen[0].timeoutMs < 1000, `timeoutMs ${seen[0].timeoutMs} must be exact remaining, not a floor`);
    assert.equal(result.modelCalls, 1);
  });

  await test('same-label persona change and new relationship reply invalidate', async () => {
    const key = seedCandidate(68, 'A candidate under persona and relationship watch');
    store.recordRelationshipEvent({ username: 'dev68', eventType: 'target_reply', candidateKey: key, topic: 'pool sizing', occurredAt: NOW - 10 * MIN });
    const fake = fakeRuntime();
    const first = await tick({ runStructured: fake.runStructured });
    assert.ok(first.jobId);
    const callsAfterFirst = fake.calls.length;
    const slice = persona.getPersonaSlice('engagement');
    const repersonaed = await tick({
      runStructured: fake.runStructured,
      personaSlice: () => ({ ...slice, behaviorPolicy: { ...(slice.behaviorPolicy || {}), testMutation: 'same-label-content-change' } }),
    });
    assert.equal(repersonaed.modelCalls, 1);
    assert.notEqual(repersonaed.jobId, first.jobId);
    store.recordRelationshipEvent({ username: 'dev68', eventType: 'target_reply', candidateKey: key, topic: 'connection churn', occurredAt: NOW - MIN });
    const reacted = await tick({ runStructured: fake.runStructured });
    assert.equal(reacted.modelCalls, 1);
    assert.notEqual(reacted.jobId, repersonaed.jobId);
    assert.ok(fake.calls.length >= callsAfterFirst + 2);
  });

  await test('missing and oversize essential context defer with zero calls', async () => {
    const sweeper = fakeRuntime();
    await tick({ runStructured: sweeper.runStructured });
    const keyA = seedCandidate(69, 'A reply needing its parent');
    store.upsertCandidates([{ key: keyA, source: 'x', title: '@dev69', text: 'A reply needing its parent', url: keyA, timestamp: NOW - 5 * MIN, metrics: { inReplyToStatusId: '999' } }]);
    const keyB = seedCandidate(70, 'A reply with an oversize parent');
    store.upsertCandidates([{ key: keyB, source: 'x', title: '@dev70', text: 'A reply with an oversize parent', url: keyB, timestamp: NOW - 5 * MIN, metrics: { parentText: `P-${'x'.repeat(3000)}` } }]);
    observeAll();
    const fake = fakeRuntime();
    const result = await tick({ runStructured: fake.runStructured });
    assert.equal(result.status, 'deferred_missing_context');
    assert.equal(result.modelCalls, 0);
    assert.equal(fake.calls.length, 0);
    assert.equal(result.descriptor.items.length, 2);
  });

  await test('dispatch carries the preflight-resolved profile', async () => {
    seedCandidate(71, 'A candidate proving adapter pinning');
    const seen = [];
    const fake = fakeRuntime();
    const capturing = async (options) => { seen.push(options); return fake.runStructured(options); };
    const result = await tick({ runStructured: capturing });
    assert.equal(result.modelCalls, 1);
    assert.equal(seen[0].profile?.runtime, 'direct_api');
    assert.notEqual(seen[0].profile, laneDirect);
  });

  await test('reply to A leaves B eligible for one finite next job', async () => {
    const keyA = seedCandidate(80, 'Alpha debate about pool sizing reserves');
    const keyB = seedCandidate(81, 'Beta question about queue depth limits');
    const replyA = fakeRuntime({
      output: fullOutput({ decision: 'reply', purpose: 'Answer the pool question.', rationale: 'Concrete budgeting question.', targetCandidateKey: keyA, draft: 'Reserve per request against the parent budget.' }),
      execution: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 50, reasoningTokens: 0 },
    });
    const first = await tick({ runStructured: replyA.runStructured });
    assert.equal(first.status, 'completed');
    assert.equal(replyA.calls.length, 1);
    assert.ok(String(replyA.calls[0].prompt).includes('Alpha debate about pool sizing reserves'), 'first request judges A');
    assert.ok(String(replyA.calls[0].prompt).includes('Beta question about queue depth limits'), 'first request judges B');
    assert.equal(jobs.getJob(first.jobId).usage.inputTokens, 100);
    const receipts = JSON.parse(store.getAppState('semantic_controller_receipts_v1', '{}')).receipts;
    assert.equal(receipts[keyA]?.jobId, first.jobId);
    assert.equal(receipts[keyB], undefined);
    const replyB = fakeRuntime({
      output: fullOutput({ decision: 'reply', purpose: 'Answer the queue question.', rationale: 'Concrete depth question.', targetCandidateKey: keyB, draft: 'Depth signals batching intensity.' }),
    });
    const second = await tick({ runStructured: replyB.runStructured });
    assert.equal(second.status, 'completed');
    assert.equal(replyB.calls.length, 1);
    assert.ok(String(replyB.calls[0].prompt).includes('Beta question about queue depth limits'), 'next request judges B');
    assert.ok(!String(replyB.calls[0].prompt).includes('Alpha debate about pool sizing reserves'), 'next request excludes judged A');
    assert.equal(second.modelCalls, 1);
    assert.notEqual(second.jobId, first.jobId);
    assert.match(second.reason, /Selected reply/);
    const after = JSON.parse(store.getAppState('semantic_controller_receipts_v1', '{}')).receipts;
    assert.equal(after[keyB]?.jobId, second.jobId);
    assert.equal(after[keyA]?.jobId, first.jobId);
  });

  await test('all-skip packet still memoizes every member with zero calls', async () => {
    const keyA = seedCandidate(82, 'Skip-shape alpha note on budgets');
    const keyB = seedCandidate(83, 'Skip-shape beta note on queues');
    const fake = fakeRuntime();
    const first = await tick({ runStructured: fake.runStructured });
    assert.equal(first.status, 'skipped');
    const second = await tick({ runStructured: fake.runStructured });
    // Earlier deferred-context stragglers (never receipted by design) defer
    // again; the skip memoization itself holds with zero new calls.
    assert.equal(second.status, 'deferred_missing_context');
    assert.equal(second.modelCalls, 0);
    assert.equal(fake.calls.length, 1);
    const receipts = JSON.parse(store.getAppState('semantic_controller_receipts_v1', '{}')).receipts;
    assert.equal(receipts[keyA]?.jobId, first.jobId);
    assert.equal(receipts[keyB]?.jobId, first.jobId);
  });

  await test('legacy poisoned completed receipt does not suppress its candidate', async () => {
    const keyA = seedCandidate(84, 'Poison-shape alpha note on budgets');
    const keyB = seedCandidate(85, 'Poison-shape beta note on queues');
    // Capture B's packet fingerprint mid-flight: the admission marker is
    // committed before the fake transport resolves.
    let capturedFpB = null;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const slow = async () => {
      const marker = JSON.parse(store.getAppState('semantic_controller_pending_v1', '{}')).pending;
      capturedFpB = Object.values(marker)[0]?.keys?.[keyB] || null;
      await gate;
      return {
        output: fullOutput({ decision: 'reply', purpose: 'Answer alpha.', rationale: 'Concrete alpha question.', targetCandidateKey: keyA, draft: 'Alpha gets the reply.' }),
        execution: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 50, reasoningTokens: 0 },
      };
    };
    const pending = tick({ runStructured: slow });
    release();
    const first = await pending;
    assert.equal(first.status, 'completed');
    assert.ok(capturedFpB, 'mid-flight marker carries B fingerprint');
    // Simulate the legacy whole-packet writer: B carries A's completed
    // receipt with a matching fingerprint. History itself stays intact.
    const all = JSON.parse(store.getAppState('semantic_controller_receipts_v1', '{}'));
    all.receipts[keyB] = { fp: capturedFpB, jobId: first.jobId, outcome: 'completed', decidedAt: NOW };
    store.setAppState('semantic_controller_receipts_v1', JSON.stringify(all));
    const replyB = fakeRuntime({
      output: fullOutput({ decision: 'reply', purpose: 'Answer beta.', rationale: 'Concrete beta question.', targetCandidateKey: keyB, draft: 'Beta gets its own reply.' }),
    });
    const second = await tick({ runStructured: replyB.runStructured });
    assert.equal(second.status, 'completed');
    assert.equal(second.modelCalls, 1);
    assert.notEqual(second.jobId, first.jobId);
    const after = JSON.parse(store.getAppState('semantic_controller_receipts_v1', '{}')).receipts;
    assert.equal(after[keyB]?.jobId, second.jobId);
    assert.equal(after[keyA]?.jobId, first.jobId);
    assert.equal(jobs.getJob(first.jobId).terminalOutcome, 'completed');
  });

  await test('crash backfill stamps only the selected target and charges once', async () => {
    const keyA = seedCandidate(86, 'Crash-shape alpha note on budgets');
    const keyB = seedCandidate(87, 'Crash-shape beta note on queues');
    let captured = null;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const slow = async () => {
      captured = Object.values(JSON.parse(store.getAppState('semantic_controller_pending_v1', '{}')).pending)[0]?.keys || null;
      await gate;
      return {
        output: fullOutput({ decision: 'reply', purpose: 'Answer alpha.', rationale: 'Concrete alpha question.', targetCandidateKey: keyA, draft: 'Alpha gets the reply.' }),
        execution: { ...measuredCodex, modelCalls: 2 },
      };
    };
    const jobBudget = { budget: { maxModelCalls: 2 } };
    const pending = tickCodex({ runStructured: slow, config: jobBudget });
    release();
    const first = await pending;
    assert.equal(first.status, 'completed');
    assert.equal(first.modelCalls, 2);
    assert.ok(captured?.[keyA], 'crash marker carries the selected target A');
    assert.ok(captured?.[keyB], 'crash marker carries the unselected member B');
    const job = jobs.getJob(first.jobId);
    // Simulate the crash window: receipts gone, marker and estimate charge
    // restored, settlement durable.
    const receiptsKey = 'semantic_controller_receipts_v1';
    const all = JSON.parse(store.getAppState(receiptsKey, '{}'));
    delete all.receipts[keyA];
    store.setAppState(receiptsKey, JSON.stringify(all));
    store.setAppState('semantic_controller_pending_v1', JSON.stringify({
      pending: { [first.jobId]: { keys: captured, admittedAt: NOW } },
    }));
    const usageKey = 'semantic_controller_usage_v1';
    const before = { date: '', modelCalls: 0, inputTokens: 0, outputTokens: 0, reservations: {}, ...JSON.parse(store.getAppState(usageKey, '{}')) };
    const firstActual = jobs.getAttempt(first.attemptId).actual;
    before.reservations[first.attemptId] = { jobId: first.jobId, modelCalls: 1, input: job.estimatedInputTokens, output: job.budget.maxOutputTokens };
    before.inputTokens = before.inputTokens - firstActual.inputTokens + job.estimatedInputTokens;
    before.outputTokens = before.outputTokens - firstActual.outputTokens + job.budget.maxOutputTokens;
    before.modelCalls = before.modelCalls - firstActual.modelCalls + 1;
    store.setAppState(usageKey, JSON.stringify(before));
    const fake = fakeRuntime({ execution: { ...measuredCodex } });
    const second = await tickCodex({ runStructured: fake.runStructured, config: jobBudget });
    assert.equal(second.modelCalls, 1);
    assert.equal(fake.calls.length, 1);
    assert.ok(String(fake.calls[0].prompt).includes('Crash-shape beta note on queues'), 'recovery request judges B');
    assert.ok(!String(fake.calls[0].prompt).includes('Crash-shape alpha note on budgets'), 'recovery request excludes backfilled A');
    assert.notEqual(second.jobId, first.jobId);
    const after = JSON.parse(store.getAppState(receiptsKey, '{}')).receipts;
    assert.equal(after[keyA]?.jobId, first.jobId);
    assert.equal(after[keyA]?.outcome, 'completed');
    assert.equal(after[keyB]?.jobId, second.jobId);
    assert.equal(jobs.listJobAttempts(first.jobId).length, 1);
    const usage = JSON.parse(store.getAppState(usageKey, '{}'));
    assert.equal(usage.reservations?.[first.attemptId], undefined);
    // Crash charge reconciled exactly once, plus exactly one new dispatch.
    const bActual = jobs.getAttempt(second.attemptId).actual;
    assert.equal(usage.inputTokens, before.inputTokens - job.estimatedInputTokens + firstActual.inputTokens + bActual.inputTokens);
    assert.equal(usage.modelCalls, before.modelCalls - 1 + firstActual.modelCalls + bActual.modelCalls);
  });

  await test('reused admission backfill cannot stamp the unselected member', async () => {
    const keyA = seedCandidate(88, 'Readmit-shape alpha note on budgets');
    const keyB = seedCandidate(89, 'Readmit-shape beta note on queues');
    const replyA = fakeRuntime({
      output: fullOutput({ decision: 'reply', purpose: 'Answer alpha.', rationale: 'Concrete alpha question.', targetCandidateKey: keyA, draft: 'Alpha gets the reply.' }),
      execution: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 50, reasoningTokens: 0 },
    });
    const first = await tick({ runStructured: replyA.runStructured });
    assert.equal(first.status, 'completed');
    // Lose receipts and marker without touching history: the next identical
    // packet must reuse the durable job, restore only the target receipt,
    // and leave B eligible with zero calls.
    const receiptsKey = 'semantic_controller_receipts_v1';
    const all = JSON.parse(store.getAppState(receiptsKey, '{}'));
    delete all.receipts[keyA];
    store.setAppState(receiptsKey, JSON.stringify(all));
    clearPending();
    const fake = fakeRuntime();
    const second = await tick({ runStructured: fake.runStructured });
    assert.equal(second.status, 'reused');
    assert.equal(second.jobId, first.jobId);
    assert.equal(fake.calls.length, 0);
    const after = JSON.parse(store.getAppState(receiptsKey, '{}')).receipts;
    assert.equal(after[keyA]?.jobId, first.jobId);
    assert.equal(after[keyB], undefined);
    assert.equal(jobs.listJobAttempts(first.jobId).length, 1);
  });

  await test('settlement receipt helper is selective only for completed actions', () => {
    const pairs = [{ key: 'a', fp: 'f1' }, { key: 'b', fp: 'f2' }];
    assert.deepEqual(
      controller.settlementReceiptItems(pairs, 'completed', { action: 'reply', targetCandidateKey: 'a' }, 'j1', 1),
      [['a', { fp: 'f1', jobId: 'j1', outcome: 'completed', decidedAt: 1 }]],
    );
    assert.deepEqual(
      controller.settlementReceiptItems(pairs, 'completed', { action: 'quote', targetCandidateKey: 'b' }, 'j1', 1).map(([key]) => key),
      ['b'],
    );
    // A target-less or unsupported completed result proves no candidate was
    // selected (mapTerminal settles skip as skipped, never completed): stamp none.
    assert.equal(controller.settlementReceiptItems(pairs, 'completed', { action: 'reply', targetCandidateKey: '' }, 'j1', 1).length, 0);
    assert.equal(controller.settlementReceiptItems(pairs, 'completed', null, 'j1', 1).length, 0);
    assert.equal(controller.settlementReceiptItems(pairs, 'completed', {}, 'j1', 1).length, 0);
    assert.equal(controller.settlementReceiptItems(pairs, 'completed', { action: 'skip', targetCandidateKey: 'a' }, 'j1', 1).length, 0);
    // Non-completed memoization keeps whole-packet receipts unchanged.
    assert.equal(controller.settlementReceiptItems(pairs, 'skipped', null, 'j1', 1).length, 2);
    assert.equal(controller.settlementReceiptItems(pairs, 'waiting_for_evidence', { action: 'reply', targetCandidateKey: 'a' }, 'j1', 1).length, 2);
    assert.equal(controller.settlementReceiptItems(pairs, 'unresolved', null, 'j1', 1).length, 2);
  });

  await test('completed receipt validation follows the durable job result', async () => {
    const keyA = seedCandidate(90, 'Validator-shape alpha note on budgets');
    const keyB = seedCandidate(91, 'Validator-shape beta note on queues');
    const replyA = fakeRuntime({
      output: fullOutput({ decision: 'reply', purpose: 'Answer alpha.', rationale: 'Concrete alpha question.', targetCandidateKey: keyA, draft: 'Alpha gets the reply.' }),
      execution: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 50, reasoningTokens: 0 },
    });
    const first = await tick({ runStructured: replyA.runStructured });
    assert.equal(first.status, 'completed');
    assert.equal(controller.completedReceiptCoversKey({ outcome: 'completed', jobId: first.jobId }, keyA), true);
    assert.equal(controller.completedReceiptCoversKey({ outcome: 'completed', jobId: first.jobId }, keyB), false);
    assert.equal(controller.completedReceiptCoversKey({ outcome: 'completed', jobId: 'sj_missing' }, keyA), false);
    assert.equal(controller.completedReceiptCoversKey({ outcome: 'waiting_for_evidence', jobId: first.jobId }, keyB), true);
    // A durable completed job whose result names no supported reply/quote
    // target covers no candidate: target-less completion is not evidence.
    const template = jobs.getJob(first.jobId);
    const admitted = jobs.admitJob({
      kind: 'test-targetless-completion',
      semanticInput: { note: 'targetless completion fixture', nonce: `validator-${seq}` },
      versions: {},
      budget: { ...template.budget },
    });
    assert.equal(admitted.reused, false);
    jobs.claimJob(admitted.job.id, { claimant: 'test-validator', now: NOW });
    const reserved = jobs.reserveAttempt(admitted.job.id, { claimant: 'test-validator', inputTokensReserved: 100, outputTokensReserved: 50, now: NOW });
    jobs.settleAttempt(reserved.id, {
      claimant: 'test-validator',
      usage: { inputTokens: 100, cachedInputTokens: 10, outputTokens: 50, reasoningTokens: 5, modelCalls: 1, toolCalls: 0, wallTimeMs: 5 },
      receiptId: 'validator-receipt',
      now: NOW,
    });
    const bare = jobs.settleJobTerminal(admitted.job.id, {
      claimant: 'test-validator',
      outcome: 'completed',
      reason: 'Legacy target-less completion row.',
      result: { action: 'note', preparationOnly: true },
      now: NOW,
    });
    assert.equal(bare.terminalOutcome, 'completed');
    assert.equal(controller.completedReceiptCoversKey({ outcome: 'completed', jobId: bare.id }, keyA), false);
    assert.equal(controller.completedReceiptCoversKey({ outcome: 'completed', jobId: bare.id }, keyB), false);
  });
} finally {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
}
