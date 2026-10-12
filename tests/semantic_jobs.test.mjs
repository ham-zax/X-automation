import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(tmpdir(), 'growth-semantic-jobs-'));
const previousCwd = process.cwd();
process.chdir(scratch);
const moduleUrl = (name) => pathToFileURL(path.join(root, name)).href;
const jobs = await import(moduleUrl('semantic_jobs.js'));
const dbPath = path.join(scratch, '.x-research.sqlite');

let kindSeq = 0;
const freshKind = () => `semantic-test-${kindSeq += 1}`;

function budget(overrides = {}) {
  return {
    maxCandidates: 5,
    maxContextBytes: 20000,
    maxEstimatedInputTokens: 4000,
    maxCumulativeInputTokens: 12000,
    maxModelCalls: 3,
    maxOutputTokens: 2000,
    maxWallTimeMs: 60000,
    maxToolCalls: null,
    maxRepairs: 1,
    ...overrides,
  };
}

function semanticInput(overrides = {}) {
  return {
    candidates: [{ key: 'https://x.com/dev/status/1', text: 'Worthwhile conversation about runtime APIs' }],
    question: 'Which opportunity deserves participation?',
    ...overrides,
  };
}

function versions(overrides = {}) {
  return {
    source: 'x_latest:2026-10-11T12:00',
    persona: 'hamza-v1',
    policy: 'policy-v3',
    strategy: 'accepted-rules-r12',
    ...overrides,
  };
}

function reservation(overrides = {}) {
  return { inputTokensReserved: 500, outputTokensReserved: 200, ...overrides };
}

function usage(overrides = {}) {
  return {
    inputTokens: 400,
    cachedInputTokens: 50,
    outputTokens: 120,
    reasoningTokens: 30,
    modelCalls: 1,
    toolCalls: 0,
    wallTimeMs: 900,
    ...overrides,
  };
}

function admitFresh(overrides = {}) {
  return jobs.admitJob({
    kind: freshKind(),
    semanticInput: semanticInput(),
    versions: versions(),
    budget: budget(),
    ...overrides,
  });
}

function claimFresh(spec = {}) {
  const { job } = admitFresh(spec.admit || {});
  return jobs.claimJob(job.id, { claimant: 'runner-A' });
}

function expectCode(fn, code) {
  try {
    fn();
  } catch (error) {
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`expected SemanticJobError ${code}`);
}

function reopenRow(table, id) {
  const handle = new DatabaseSync(dbPath);
  try {
    return handle.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  } finally {
    handle.close();
  }
}

try {
  await test('unchanged replay reuses a terminal decision with its structured result', () => {
    const kind = freshKind();
    const spec = { kind, semanticInput: semanticInput(), versions: versions(), budget: budget() };
    const first = jobs.admitJob(spec);
    assert.equal(first.reused, false);
    jobs.claimJob(first.job.id, { claimant: 'runner-A' });
    const attempt = jobs.reserveAttempt(first.job.id, { claimant: 'runner-A', ...reservation() });
    jobs.settleAttempt(attempt.id, { claimant: 'runner-A', usage: usage(), receiptId: 'replay-r1' });
    const result = {
      action: 'reply',
      purpose: 'answer a concrete runtime question',
      draft: 'Scope the retry budget per request, not per session.',
      evidence: ['https://x.com/dev/status/1'],
      revisit: 'Reconsider when new replies arrive.',
    };
    jobs.settleJobTerminal(first.job.id, { claimant: 'runner-A', outcome: 'completed', reason: 'Selected one reply target.', result });
    const replay = jobs.admitJob(spec);
    assert.equal(replay.reused, true);
    assert.equal(replay.job.id, first.job.id);
    assert.equal(replay.job.status, 'completed');
    assert.deepEqual(replay.job.result, result);
  });

  await test('reply text, claim evidence numbers, and acceleration metadata each invalidate', () => {
    const kind = freshKind();
    const base = { kind, versions: versions(), budget: budget() };
    const first = jobs.admitJob({ ...base, semanticInput: semanticInput() });
    const replyAdded = jobs.admitJob({
      ...base,
      semanticInput: semanticInput({ replies: [{ author: 'dev', text: 'Here is the missing context.' }] }),
    });
    assert.equal(replyAdded.reused, false);
    const evidenceChanged = jobs.admitJob({
      ...base,
      semanticInput: semanticInput({ claimMetrics: { reproductions: 3, failures: 1 } }),
    });
    assert.equal(evidenceChanged.reused, false);
    const acceleration = jobs.admitJob({
      ...base,
      semanticInput: semanticInput({ momentum: { viewsPerHour: 50000, accelerating: true } }),
    });
    assert.equal(acceleration.reused, false);
    const ids = new Set([first.job.id, replyAdded.job.id, evidenceChanged.job.id, acceleration.job.id]);
    assert.equal(ids.size, 4);
    assert.equal(jobs.getJob(first.job.id).status, 'active');
  });

  await test('observation metadata noise stays reusable; key order is deterministic', () => {
    const kind = freshKind();
    const base = { kind, semanticInput: semanticInput(), versions: versions(), budget: budget() };
    const first = jobs.admitJob({ ...base, observationMetadata: { observedAt: 1000, views: 10, likes: 1 } });
    const noisy = jobs.admitJob({ ...base, observationMetadata: { observedAt: 9999, views: 4242, likes: 87 } });
    assert.equal(noisy.reused, true);
    assert.equal(noisy.job.id, first.job.id);
    assert.equal(
      jobs.computeSemanticFingerprint({ b: 1, a: { y: 2, x: 1 } }),
      jobs.computeSemanticFingerprint({ a: { x: 1, y: 2 }, b: 1 }),
    );
  });

  await test('oversize input is rejected before anything launches', () => {
    const kind = freshKind();
    const spec = { kind, semanticInput: semanticInput(), versions: versions() };
    expectCode(() => jobs.admitJob({ ...spec, budget: budget({ maxContextBytes: 10 }) }), 'semantic_job_oversize');
    expectCode(() => jobs.admitJob({ ...spec, budget: budget({ maxEstimatedInputTokens: 1 }) }), 'semantic_job_oversize');
    expectCode(
      () => jobs.admitJob({ ...spec, kind: freshKind(), budget: budget({ maxCandidates: 1 }), candidateCount: 2 }),
      'semantic_job_oversize',
    );
    const admitted = jobs.admitJob({ ...spec, budget: budget() });
    assert.equal(admitted.reused, false);
    assert.equal(jobs.listJobAttempts(admitted.job.id).length, 0);
  });

  await test('strict admission refuses provider-unenforceable limits', () => {
    const spec = {
      kind: freshKind(),
      semanticInput: semanticInput(),
      versions: versions(),
      budget: budget({ unsupported: ['maxOutputTokens'] }),
      strictLimits: true,
    };
    expectCode(() => jobs.admitJob(spec), 'semantic_job_unsupported_limits');
    const tracked = jobs.admitJob({ ...spec, kind: freshKind(), strictLimits: false });
    assert.equal(tracked.reused, false);
    assert.deepEqual(tracked.job.budget.unsupported, ['maxOutputTokens']);
  });

  await test('atomic claim blocks a second claimant and sets the deadline', () => {
    const { job } = admitFresh();
    const claimed = jobs.claimJob(job.id, { claimant: 'runner-A', now: 1_000_000 });
    assert.equal(claimed.status, 'claimed');
    assert.equal(claimed.deadlineAt, 1_000_000 + claimed.budget.maxWallTimeMs);
    expectCode(() => jobs.claimJob(job.id, { claimant: 'runner-B' }), 'semantic_job_already_claimed');
    assert.equal(jobs.getJob(job.id).claimant, 'runner-A');
  });

  await test('output, cumulative input, and wall budgets fence reservation', () => {
    const job = claimFresh({ admit: { budget: budget({ maxOutputTokens: 300, maxCumulativeInputTokens: 600 }) } });
    const attempt = jobs.reserveAttempt(job.id, {
      claimant: 'runner-A',
      inputTokensReserved: 500,
      outputTokensReserved: 200,
    });
    jobs.settleAttempt(attempt.id, { claimant: 'runner-A', usage: usage(), receiptId: `fence-${job.id}` });
    expectCode(
      () => jobs.reserveAttempt(job.id, { mode: 'repair', claimant: 'runner-A', hypothesis: 'h2', evidenceFingerprint: 'e2', inputTokensReserved: 500, outputTokensReserved: 200 }),
      'semantic_job_budget_exhausted',
    );
    const spent = jobs.getJob(job.id).usage;
    assert.equal(spent.inputTokens, 400);
    assert.equal(spent.outputTokens, 120);
  });

  await test('elapsed deadline fences reservation', () => {
    const { job } = admitFresh({ budget: budget({ maxWallTimeMs: 1000 }) });
    const claimed = jobs.claimJob(job.id, { claimant: 'runner-A', now: 5_000 });
    expectCode(
      () => jobs.reserveAttempt(claimed.id, { claimant: 'runner-A', ...reservation(), now: 6_001 }),
      'semantic_job_wall_exhausted',
    );
    const attempt = jobs.reserveAttempt(claimed.id, { claimant: 'runner-A', ...reservation(), now: 5_500 });
    assert.equal(attempt.status, 'reserved');
  });

  await test('over-budget actuals are recorded and fence further work', () => {
    const job = claimFresh();
    const attempt = jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation() });
    jobs.settleAttempt(attempt.id, {
      claimant: 'runner-A',
      usage: usage({ outputTokens: 5000 }),
      receiptId: `over-${job.id}`,
    });
    assert.equal(jobs.getJob(job.id).usage.outputTokens, 5000);
    expectCode(
      () => jobs.reserveAttempt(job.id, { mode: 'repair', claimant: 'runner-A', hypothesis: 'h2', evidenceFingerprint: 'e2', ...reservation() }),
      'semantic_job_budget_exhausted',
    );
    const row = reopenRow('semantic_jobs', job.id);
    assert.equal(row.used_output_tokens, 5000);
  });

  await test('receipt idempotency is scoped to matching attempt and payload', () => {
    const job = claimFresh({ admit: { budget: budget({ maxRepairs: 2 }) } });
    const first = jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation() });
    const settled = jobs.settleAttempt(first.id, { claimant: 'runner-A', usage: usage(), receiptId: 'scoped-r1' });
    assert.equal(settled.idempotent, false);
    const before = jobs.getJob(job.id).usage;
    const replay = jobs.settleAttempt(first.id, { claimant: 'runner-A', usage: usage(), receiptId: 'scoped-r1' });
    assert.equal(replay.idempotent, true);
    assert.deepEqual(jobs.getJob(job.id).usage, before);
    expectCode(
      () => jobs.settleAttempt(first.id, { claimant: 'runner-A', usage: usage({ outputTokens: 999 }), receiptId: 'scoped-r1' }),
      'semantic_job_receipt_conflict',
    );
    const second = jobs.reserveAttempt(job.id, {
      mode: 'repair', claimant: 'runner-A', hypothesis: 'h2', evidenceFingerprint: 'e2', ...reservation(),
    });
    expectCode(
      () => jobs.settleAttempt(second.id, { claimant: 'runner-A', usage: usage(), receiptId: 'scoped-r1' }),
      'semantic_job_receipt_reused',
    );
    expectCode(
      () => jobs.settleAttempt(first.id, { claimant: 'runner-A', usage: usage(), receiptId: 'other-r2' }),
      'semantic_job_already_settled',
    );
  });

  await test('only the first invocation is primary; follow-ups share one allowance and evidence contract', () => {
    const job = claimFresh();
    const first = jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation() });
    jobs.settleAttempt(first.id, { claimant: 'runner-A', usage: usage(), receiptId: `primary-${job.id}` });
    expectCode(
      () => jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation() }),
      'semantic_job_invalid_primary',
    );
    expectCode(
      () => jobs.reserveAttempt(job.id, { mode: 'repair', claimant: 'runner-A', hypothesis: '', evidenceFingerprint: '', ...reservation() }),
      'semantic_job_repair_unchanged',
    );
    const repair = jobs.reserveAttempt(job.id, {
      mode: 'repair', claimant: 'runner-A', hypothesis: 'h2', evidenceFingerprint: 'e2', ...reservation(),
    });
    assert.equal(repair.mode, 'repair');
    assert.equal(jobs.getJob(job.id).usage.repairsUsed, 1);
    jobs.settleAttempt(repair.id, { claimant: 'runner-A', usage: usage(), receiptId: `repair-${job.id}` });
    expectCode(
      () => jobs.reserveAttempt(job.id, { mode: 'repair', claimant: 'runner-A', hypothesis: 'h3', evidenceFingerprint: 'e3', ...reservation() }),
      'semantic_job_repairs_exhausted',
    );
  });

  await test('outstanding reservations block every mode; restart needs interruption plus change', () => {
    const job = claimFresh({ admit: { budget: budget({ maxRepairs: 2 }) } });
    const first = jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation() });
    for (const mode of ['primary', 'repair', 'restart']) {
      expectCode(
        () => jobs.reserveAttempt(job.id, { mode, claimant: 'runner-A', hypothesis: 'hx', evidenceFingerprint: 'ex', ...reservation() }),
        'semantic_job_uncertain_attempt',
      );
    }
    jobs.markAttemptInterrupted(first.id, { claimant: 'runner-A', reason: 'worker lost' });
    expectCode(
      () => jobs.reserveAttempt(job.id, { mode: 'repair', claimant: 'runner-A', ...reservation() }),
      'semantic_job_unknown_usage',
    );
    const reconciled = jobs.reconcileAttemptUsage(first.id, {
      claimant: 'runner-A',
      usage: usage(),
      receiptId: `reconcile-${job.id}`,
    });
    assert.equal(reconciled.attempt.usageUnknown, false);
    assert.equal(jobs.getJob(job.id).usage.hasUnknownUsage, false);
    expectCode(
      () => jobs.reserveAttempt(job.id, { mode: 'restart', claimant: 'runner-A', ...reservation() }),
      'semantic_job_repair_unchanged',
    );
    const restart = jobs.reserveAttempt(job.id, {
      mode: 'restart', claimant: 'runner-A', hypothesis: 'h2', evidenceFingerprint: 'e2', ...reservation(),
    });
    assert.equal(restart.mode, 'restart');
    assert.equal(restart.jobId, job.id);
  });

  await test('budget exhaustion persists after reopening state', () => {
    const job = claimFresh({ admit: { budget: budget({ maxModelCalls: 1 }) } });
    const attempt = jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation() });
    jobs.settleAttempt(attempt.id, { claimant: 'runner-A', usage: usage(), receiptId: `exhaust-${job.id}` });
    expectCode(
      () => jobs.reserveAttempt(job.id, { mode: 'repair', claimant: 'runner-A', hypothesis: 'h2', evidenceFingerprint: 'e2', ...reservation() }),
      'semantic_job_budget_exhausted',
    );
    const row = reopenRow('semantic_jobs', job.id);
    assert.equal(row.used_model_calls, 1);
    assert.equal(row.used_input_tokens, 400);
    assert.equal(row.used_output_tokens, 120);
    assert.equal(row.reserved_model_calls, 0);
  });

  await test('unknown usage retains reservations and fences until reconciliation', () => {
    const job = claimFresh({ admit: { budget: budget({ maxRepairs: 2 }) } });
    const attempt = jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation() });
    const settled = jobs.settleAttempt(attempt.id, { claimant: 'runner-A', usage: {} });
    assert.equal(settled.attempt.usageUnknown, true);
    const current = jobs.getJob(job.id).usage;
    assert.equal(current.modelCalls, 1);
    assert.equal(current.inputTokens, 500);
    assert.equal(current.outputTokens, 200);
    assert.equal(current.hasUnknownUsage, true);
    expectCode(
      () => jobs.reserveAttempt(job.id, { mode: 'repair', claimant: 'runner-A', hypothesis: 'h2', evidenceFingerprint: 'e2', ...reservation() }),
      'semantic_job_unknown_usage',
    );
    const row = reopenRow('semantic_jobs', job.id);
    assert.equal(row.used_input_tokens, 500);
    assert.equal(row.has_unknown_usage, 1);
    const reconciled = jobs.reconcileAttemptUsage(attempt.id, {
      claimant: 'runner-A',
      usage: usage(),
      receiptId: `late-${job.id}`,
    });
    assert.equal(reconciled.job.usage.inputTokens, 400);
    assert.equal(reconciled.job.usage.outputTokens, 120);
    const repair = jobs.reserveAttempt(job.id, {
      mode: 'repair', claimant: 'runner-A', hypothesis: 'h2', evidenceFingerprint: 'e2', ...reservation(),
    });
    assert.equal(repair.mode, 'repair');
  });

  await test('reconciliation cannot rewrite settled history or reuse receipts', () => {
    const job = claimFresh({ admit: { budget: budget({ maxRepairs: 2 }) } });
    const attempt = jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation() });
    jobs.settleAttempt(attempt.id, { claimant: 'runner-A', usage: usage(), receiptId: `hist-${job.id}` });
    expectCode(
      () => jobs.reconcileAttemptUsage(attempt.id, { claimant: 'runner-A', usage: usage(), receiptId: `hist2-${job.id}` }),
      'semantic_job_nothing_to_reconcile',
    );
    const unknown = jobs.reserveAttempt(job.id, {
      mode: 'repair', claimant: 'runner-A', hypothesis: 'h2', evidenceFingerprint: 'e2', ...reservation(),
    });
    jobs.settleAttempt(unknown.id, { claimant: 'runner-A', usage: {} });
    expectCode(
      () => jobs.reconcileAttemptUsage(unknown.id, {
        claimant: 'runner-A',
        usage: usage({ inputTokens: 999, cachedInputTokens: 9, outputTokens: 999, reasoningTokens: 9, modelCalls: 2, toolCalls: 1, wallTimeMs: 5 }),
        receiptId: `hist-${job.id}`,
      }),
      'semantic_job_receipt_reused',
    );
    jobs.reconcileAttemptUsage(unknown.id, { claimant: 'runner-A', usage: usage(), receiptId: `late2-${job.id}` });
    expectCode(
      () => jobs.reconcileAttemptUsage(unknown.id, { claimant: 'runner-A', usage: usage(), receiptId: `late3-${job.id}` }),
      'semantic_job_nothing_to_reconcile',
    );
  });

  await test('malformed, negative, and contradictory usage is rejected', () => {
    const job = claimFresh();
    const attempt = jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation() });
    const bad = [
      { inputTokens: 10, cachedInputTokens: 11, modelCalls: 1 },
      { outputTokens: -1 },
      { outputTokens: 5, modelCalls: 0 },
      { inputTokens: Number.NaN },
    ];
    for (const fields of bad) {
      expectCode(
        () => jobs.settleAttempt(attempt.id, { claimant: 'runner-A', usage: fields }),
        'semantic_job_invalid_usage',
      );
    }
    expectCode(
      () => jobs.settleAttempt(attempt.id, { claimant: 'runner-A', usage: { bogus: 1 } }),
      'semantic_job_invalid_usage',
    );
    expectCode(
      () => jobs.reserveAttempt(job.id, { claimant: 'runner-A', inputTokensReserved: 0, outputTokensReserved: 1 }),
      'semantic_job_invalid_reservation',
    );
    assert.equal(jobs.getAttempt(attempt.id).status, 'reserved');
  });

  await test('terminal decisions require ownership, clean invocation state, and carry a result', () => {
    const job = claimFresh();
    expectCode(
      () => jobs.settleJobTerminal(job.id, { claimant: 'runner-B', outcome: 'completed', reason: 'No.' }),
      'semantic_job_claimant_mismatch',
    );
    const attempt = jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation() });
    expectCode(
      () => jobs.settleJobTerminal(job.id, { claimant: 'runner-A', outcome: 'completed', reason: 'Too early.' }),
      'semantic_job_in_flight',
    );
    jobs.settleAttempt(attempt.id, { claimant: 'runner-A', usage: {} });
    expectCode(
      () => jobs.settleJobTerminal(job.id, { claimant: 'runner-A', outcome: 'completed', reason: 'Uncertain.' }),
      'semantic_job_uncertain',
    );
    expectCode(
      () => jobs.settleJobTerminal(job.id, {
        claimant: 'runner-A', outcome: 'completed', reason: 'Bad.', result: { humanApprovedAt: 1 },
      }),
      'semantic_job_invalid_result',
    );
    const fenced = jobs.settleJobTerminal(job.id, {
      claimant: 'runner-A',
      outcome: 'unresolved',
      reason: 'Inference outcome unknown; fence retained.',
      result: { fence: 'unknown-usage', evidence: ['https://x.com/dev/status/1'] },
    });
    assert.equal(fenced.status, 'unresolved');
    assert.equal(fenced.usage.hasUnknownUsage, true);
    assert.deepEqual(fenced.result, { fence: 'unknown-usage', evidence: ['https://x.com/dev/status/1'] });
    const row = reopenRow('semantic_jobs', job.id);
    assert.equal(row.terminal_outcome, 'unresolved');
    assert.equal(row.result_json, JSON.stringify({ fence: 'unknown-usage', evidence: ['https://x.com/dev/status/1'] }));
    expectCode(
      () => jobs.settleJobTerminal(job.id, { claimant: 'runner-A', outcome: 'completed', reason: 'Late.' }),
      'semantic_job_terminal',
    );
  });

  await test('per-request input reservation cannot exceed its declared context limit', () => {
    const job = claimFresh({ admit: { budget: budget({ maxEstimatedInputTokens: 100, maxCumulativeInputTokens: 1000 }) } });
    expectCode(
      () => jobs.reserveAttempt(job.id, { claimant: 'runner-A', inputTokensReserved: 101, outputTokensReserved: 50 }),
      'semantic_job_oversize',
    );
    const attempt = jobs.reserveAttempt(job.id, { claimant: 'runner-A', inputTokensReserved: 100, outputTokensReserved: 50 });
    assert.equal(attempt.status, 'reserved');
  });

  await test('admission stops exactly at the persistent deadline', () => {
    const { job } = admitFresh({ budget: budget({ maxWallTimeMs: 1000 }) });
    const claimed = jobs.claimJob(job.id, { claimant: 'runner-A', now: 1000 });
    assert.equal(claimed.deadlineAt, 2000);
    expectCode(
      () => jobs.reserveAttempt(claimed.id, { claimant: 'runner-A', ...reservation(), now: 2000 }),
      'semantic_job_wall_exhausted',
    );
  });

  await test('recorded wall-time overrun fences subsequent requests', () => {
    const job = claimFresh({ admit: { budget: budget({ maxWallTimeMs: 1000, maxRepairs: 2 }) } });
    const attempt = jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation(), now: 1100 });
    jobs.settleAttempt(attempt.id, {
      claimant: 'runner-A',
      usage: usage({ wallTimeMs: 1001 }),
      receiptId: `wall-overrun-${job.id}`,
      now: 1200,
    });
    assert.equal(jobs.getJob(job.id).usage.wallTimeMs, 1001);
    expectCode(
      () => jobs.reserveAttempt(job.id, {
        mode: 'repair', claimant: 'runner-A', hypothesis: 'Changed evidence interpretation', ...reservation(), now: 1300,
      }),
      'semantic_job_wall_exhausted',
    );
  });

  await test('late accounting validates cached tokens against the merged input total', () => {
    const job = claimFresh();
    const attempt = jobs.reserveAttempt(job.id, { claimant: 'runner-A', ...reservation() });
    jobs.settleAttempt(attempt.id, {
      claimant: 'runner-A',
      usage: usage({ inputTokens: null, cachedInputTokens: 50 }),
      receiptId: `partial-${job.id}`,
    });
    expectCode(
      () => jobs.reconcileAttemptUsage(attempt.id, {
        claimant: 'runner-A',
        usage: usage({ inputTokens: 30, cachedInputTokens: null }),
        receiptId: `late-${job.id}`,
      }),
      'semantic_job_invalid_usage',
    );
    assert.equal(jobs.getAttempt(attempt.id).actual.inputTokens, null);
    assert.equal(jobs.getJob(job.id).usage.hasUnknownUsage, true);
  });

  await test('deferred terminal requires a revisit condition; clean completion persists', () => {
    const job = claimFresh();
    expectCode(
      () => jobs.settleJobTerminal(job.id, { claimant: 'runner-A', outcome: 'deferred', reason: 'Waiting.' }),
      'semantic_job_invalid_outcome',
    );
    const terminal = jobs.settleJobTerminal(job.id, {
      claimant: 'runner-A',
      outcome: 'deferred',
      reason: 'Compatibility claim is unverified.',
      revisitCondition: 'Primary documentation establishes supported platforms.',
      result: { action: 'defer', missingEvidence: 'platform support matrix' },
    });
    assert.equal(terminal.status, 'deferred');
    assert.equal(terminal.revisitCondition, 'Primary documentation establishes supported platforms.');
    assert.deepEqual(terminal.result, { action: 'defer', missingEvidence: 'platform support matrix' });
  });
} finally {
  process.chdir(previousCwd);
  await rm(scratch, { recursive: true, force: true });
}
