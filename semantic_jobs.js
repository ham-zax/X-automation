// Durable finite semantic jobs: the foundation for the persistent-controller design
// (docs/plans/XGROWTH_SEMANTIC_CONTROLLER_DESIGN_2026-10-11.md, Part I).
//
// This module is the authoritative owner of the semantic job contract and budget
// ledger. It owns fingerprinting, budget validation, admission, atomic claim,
// per-attempt reservation/settlement/reconciliation, follow-up rules, and
// terminal outcomes. store.js owns only the record persistence (semantic_jobs /
// semantic_job_attempts tables plus thin record helpers); publication records
// remain wholly separate and authoritative.
//
// This interface grants NO publication authority: terminal results are never
// approval, and this module cannot approve, claim, send, or reconcile any
// public action. Later waves integrate the runner, scout, and browser lanes.
//
// Lifecycle:
//   admit (idempotent on kind+fingerprint) -> claim (sets deadline) ->
//   reserve -> settle* -> terminal outcome. Only the first invocation is
//   primary; every follow-up is a repair/restart under the same allowance and
//   changed-evidence contract. Changed semantic input or versions admit as a
//   NEW job row; prior rows are retained as evidence, never rewritten.

import { createHash, randomUUID } from 'node:crypto';
import { DomainValidationError } from './errors.js';
import {
  findSemanticJobAttemptByAnyReceipt,
  findSemanticJobRecord,
  getSemanticJobAttemptRecord,
  getSemanticJobRecord,
  insertSemanticJobAttemptRecord,
  insertSemanticJobRecord,
  listSemanticJobAttemptRecords,
  runStoreTransaction,
  updateSemanticJobAttemptRecord,
  updateSemanticJobRecord,
} from './store.js';

export class SemanticJobError extends DomainValidationError {
  constructor(code, message) {
    super(message, { code });
    this.name = 'SemanticJobError';
  }
}

function fail(code, message) {
  throw new SemanticJobError(code, message);
}

export const SEMANTIC_JOB_STATUSES = Object.freeze([
  'active',
  'claimed',
  'completed',
  'skipped',
  'deferred',
  'waiting_for_evidence',
  'blocked',
  'unresolved',
]);

export const SEMANTIC_JOB_TERMINAL_OUTCOMES = Object.freeze([
  'completed',
  'skipped',
  'deferred',
  'waiting_for_evidence',
  'blocked',
  'unresolved',
]);

export const SEMANTIC_JOB_ATTEMPT_MODES = Object.freeze(['primary', 'restart', 'repair']);
export const SEMANTIC_JOB_ATTEMPT_STATUSES = Object.freeze(['reserved', 'settled', 'interrupted']);

const STATUS_SET = new Set(SEMANTIC_JOB_STATUSES);
const TERMINAL_SET = new Set(SEMANTIC_JOB_TERMINAL_OUTCOMES);
const ATTEMPT_MODE_SET = new Set(SEMANTIC_JOB_ATTEMPT_MODES);

// Budget limit names. maxToolCalls is null when the job has no tool authority;
// maxRepairs is 0 when no follow-up is allowed. maxEstimatedInputTokens bounds
// one request's context; maxCumulativeInputTokens bounds lifetime input spend.
// `unsupported` names limits the executing provider cannot enforce: tracking a
// limit is not evidence of provider enforcement, and strict callers must refuse
// unsupported budgets at admission. A wall-time timeout is never a token cap.
export const SEMANTIC_JOB_BUDGET_LIMITS = Object.freeze([
  'maxCandidates',
  'maxContextBytes',
  'maxEstimatedInputTokens',
  'maxCumulativeInputTokens',
  'maxModelCalls',
  'maxOutputTokens',
  'maxWallTimeMs',
  'maxToolCalls',
  'maxRepairs',
]);

const BUDGET_LIMIT_SET = new Set(SEMANTIC_JOB_BUDGET_LIMITS);
const REQUIRED_POSITIVE_LIMITS = [
  'maxCandidates',
  'maxContextBytes',
  'maxEstimatedInputTokens',
  'maxCumulativeInputTokens',
  'maxModelCalls',
  'maxOutputTokens',
  'maxWallTimeMs',
];
const VERSION_KEYS = new Set(['source', 'persona', 'policy', 'strategy']);
const USAGE_FIELDS = [
  'inputTokens',
  'cachedInputTokens',
  'outputTokens',
  'reasoningTokens',
  'modelCalls',
  'toolCalls',
  'wallTimeMs',
];
// Core accounting fields: when any is unknown the inference is fenced until
// reconciliation. Cached/reasoning subsets are parts of input/output totals.
const CORE_USAGE_FIELDS = ['inputTokens', 'outputTokens', 'modelCalls', 'toolCalls', 'wallTimeMs'];

const OBSERVATION_MAX_BYTES = 8192;
const RESULT_MAX_BYTES = 8192;
// A terminal result must never carry approval or publication authority.
const RESULT_AUTHORITY_KEYS = new Set([
  'humanApprovedAt',
  'human_approved_at',
  'approved',
  'approvalSnapshot',
  'approval_snapshot',
  'publicationAttemptId',
  'publication_attempt_id',
  'sendAuthorized',
  'send_authorized',
  'authorized',
  'publishedTweetId',
  'published_tweet_id',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertFiniteNonNegativeInteger(value, label) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail('semantic_job_invalid_usage', `${label} must be a non-negative safe integer or null (unknown).`);
  }
  return value;
}

function assertNoNonFiniteNumbers(value, label = 'value') {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    fail('semantic_job_invalid_input', `${label} contains a non-finite number.`);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoNonFiniteNumbers(entry, `${label}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) assertNoNonFiniteNumbers(entry, `${label}.${key}`);
  }
}

function assertAuthorityFree(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertAuthorityFree(entry, `${label}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (RESULT_AUTHORITY_KEYS.has(key)) {
        fail('semantic_job_invalid_result', `${label} must not carry approval/publication authority (${key}).`);
      }
      assertAuthorityFree(entry, `${label}.${key}`);
    }
  }
}

// Key order is normalized for determinism. Nothing is omitted: every field of
// semanticInput is semantic, including replies arrays, claim evidence numbers,
// and acceleration metadata. Volatile observation noise belongs in
// observationMetadata, which is persisted but never fingerprinted.
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      const entry = canonicalize(value[key]);
      if (entry === undefined) continue;
      result[key] = entry;
    }
    return result;
  }
  return value === undefined ? undefined : value;
}

export function computeSemanticFingerprint(semanticInput, versions = {}) {
  if (!isPlainObject(semanticInput)) fail('semantic_job_invalid_input', 'Semantic input must be an object.');
  assertNoNonFiniteNumbers(semanticInput, 'semanticInput');
  return createHash('sha256')
    .update(JSON.stringify({ input: canonicalize(semanticInput), versions: canonicalize(versions || {}) }))
    .digest('hex');
}

function normalizeVersions(versions = {}) {
  if (!isPlainObject(versions)) fail('semantic_job_invalid_versions', 'Versions must be an object.');
  const normalized = {};
  for (const [key, value] of Object.entries(versions)) {
    if (!VERSION_KEYS.has(key)) fail('semantic_job_invalid_versions', `Unknown version key: ${key}`);
    const text = String(value || '').trim();
    if (!text) fail('semantic_job_invalid_versions', `Version ${key} must be a non-empty string.`);
    if (text.length > 256) fail('semantic_job_invalid_versions', `Version ${key} exceeds 256 characters.`);
    normalized[key] = text;
  }
  return normalized;
}

function normalizeBudget(budget) {
  if (!isPlainObject(budget)) fail('semantic_job_invalid_budget', 'Budget must be an object.');
  for (const key of Object.keys(budget)) {
    if (key !== 'unsupported' && !BUDGET_LIMIT_SET.has(key)) {
      fail('semantic_job_invalid_budget', `Unknown budget field: ${key}`);
    }
  }
  const normalized = {};
  for (const key of REQUIRED_POSITIVE_LIMITS) {
    const value = budget[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
      fail('semantic_job_invalid_budget', `Budget ${key} must be a finite positive integer.`);
    }
    normalized[key] = value;
  }
  const maxToolCalls = budget.maxToolCalls ?? null;
  if (maxToolCalls !== null) {
    if (typeof maxToolCalls !== 'number' || !Number.isSafeInteger(maxToolCalls) || maxToolCalls < 0) {
      fail('semantic_job_invalid_budget', 'Budget maxToolCalls must be a non-negative integer or null (no tool authority).');
    }
  }
  normalized.maxToolCalls = maxToolCalls;
  const maxRepairs = budget.maxRepairs ?? 0;
  if (typeof maxRepairs !== 'number' || !Number.isSafeInteger(maxRepairs) || maxRepairs < 0) {
    fail('semantic_job_invalid_budget', 'Budget maxRepairs must be a non-negative integer.');
  }
  normalized.maxRepairs = maxRepairs;
  const unsupported = budget.unsupported ?? [];
  if (!Array.isArray(unsupported) || unsupported.some((entry) => !BUDGET_LIMIT_SET.has(entry))) {
    fail('semantic_job_invalid_budget', 'Budget unsupported must list known limit names only.');
  }
  normalized.unsupported = [...new Set(unsupported)];
  return normalized;
}

function normalizeObservationMetadata(value = {}) {
  if (!isPlainObject(value)) fail('semantic_job_invalid_input', 'observationMetadata must be an object.');
  assertNoNonFiniteNumbers(value, 'observationMetadata');
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) > OBSERVATION_MAX_BYTES) {
    fail('semantic_job_invalid_input', `observationMetadata exceeds ${OBSERVATION_MAX_BYTES} bytes.`);
  }
  return json;
}

function normalizeResult(value = {}) {
  if (!isPlainObject(value)) fail('semantic_job_invalid_result', 'Terminal result must be an object.');
  assertNoNonFiniteNumbers(value, 'result');
  assertAuthorityFree(value, 'result');
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) > RESULT_MAX_BYTES) {
    fail('semantic_job_invalid_result', `Terminal result exceeds ${RESULT_MAX_BYTES} bytes.`);
  }
  return json;
}

function parseJsonObject(raw, label) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    fail('semantic_job_corrupt_record', `Stored ${label} is not valid JSON.`);
  }
  if (!isPlainObject(value)) fail('semantic_job_corrupt_record', `Stored ${label} is not an object.`);
  return value;
}

export function decodeSemanticJob(row) {
  if (!row) return null;
  const terminal = row.terminal_outcome || '';
  return {
    id: row.id,
    kind: row.kind,
    fingerprint: row.fingerprint,
    versions: parseJsonObject(row.versions_json, 'versions'),
    input: parseJsonObject(row.input_json, 'input'),
    observationMetadata: parseJsonObject(row.observation_json ?? '{}', 'observationMetadata'),
    candidateCount: Number(row.candidate_count),
    contextBytes: Number(row.context_bytes),
    estimatedInputTokens: row.estimated_input_tokens == null ? null : Number(row.estimated_input_tokens),
    estimationMethod: row.estimation_method,
    budget: parseJsonObject(row.budget_json, 'budget'),
    status: row.status,
    claimant: row.claimant || '',
    claimedAt: row.claimed_at == null ? null : Number(row.claimed_at),
    deadlineAt: row.deadline_at == null ? null : Number(row.deadline_at),
    terminalOutcome: terminal || null,
    terminalReason: row.terminal_reason || '',
    revisitCondition: row.revisit_condition || '',
    result: parseJsonObject(row.result_json ?? '{}', 'result'),
    decidedAt: row.decided_at == null ? null : Number(row.decided_at),
    usage: {
      modelCalls: Number(row.used_model_calls),
      reservedModelCalls: Number(row.reserved_model_calls),
      inputTokens: Number(row.used_input_tokens),
      reservedInputTokens: Number(row.reserved_input_tokens),
      outputTokens: Number(row.used_output_tokens),
      reservedOutputTokens: Number(row.reserved_output_tokens),
      toolCalls: Number(row.used_tool_calls),
      reservedToolCalls: Number(row.reserved_tool_calls),
      wallTimeMs: Number(row.used_wall_time_ms),
      repairsUsed: Number(row.repairs_used),
      attempts: Number(row.attempts_count),
      hasUnknownUsage: Number(row.has_unknown_usage) === 1,
    },
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function decodeSemanticJobAttempt(row) {
  if (!row) return null;
  const actual = {};
  for (const [field, column] of [
    ['inputTokens', 'actual_input_tokens'],
    ['cachedInputTokens', 'actual_cached_input_tokens'],
    ['outputTokens', 'actual_output_tokens'],
    ['reasoningTokens', 'actual_reasoning_tokens'],
    ['modelCalls', 'actual_model_calls'],
    ['toolCalls', 'actual_tool_calls'],
    ['wallTimeMs', 'actual_wall_time_ms'],
  ]) {
    actual[field] = row[column] == null ? null : Number(row[column]);
  }
  return {
    id: row.id,
    jobId: row.job_id,
    seq: Number(row.seq),
    mode: row.mode,
    status: row.status,
    hypothesis: row.hypothesis || '',
    evidenceFingerprint: row.evidence_fingerprint || '',
    reservedModelCalls: Number(row.reserved_model_calls),
    reservedInputTokens: Number(row.reserved_input_tokens ?? 0),
    reservedOutputTokens: Number(row.reserved_output_tokens ?? 0),
    reservedToolCalls: Number(row.reserved_tool_calls),
    actual,
    usageUnknown: Number(row.usage_unknown) === 1,
    receiptId: row.receipt_id || null,
    reconcileReceiptId: row.reconcile_receipt_id || null,
    createdAt: Number(row.created_at),
    settledAt: row.settled_at == null ? null : Number(row.settled_at),
  };
}

function getJobOrFail(jobId) {
  const job = decodeSemanticJob(getSemanticJobRecord(jobId));
  if (!job) fail('semantic_job_not_found', `Semantic job not found: ${jobId}`);
  return job;
}

function requireClaimed(job) {
  if (job.status === 'active') fail('semantic_job_unclaimed', `Semantic job ${job.id} must be claimed before execution.`);
  if (!STATUS_SET.has(job.status)) fail('semantic_job_corrupt_record', `Semantic job ${job.id} has an unknown status.`);
  if (TERMINAL_SET.has(job.status)) fail('semantic_job_terminal', `Semantic job ${job.id} is already terminal (${job.status}).`);
}

function requireClaimant(job, claimant) {
  const holder = String(claimant || '').trim();
  if (!holder) fail('semantic_job_claimant_mismatch', `Semantic job ${job.id} requires its claimant.`);
  if (holder !== job.claimant) {
    fail('semantic_job_claimant_mismatch', `Semantic job ${job.id} is claimed by ${job.claimant || 'nobody'}.`);
  }
  return holder;
}

function normalizeNow(now) {
  const value = now == null ? Date.now() : Number(now);
  if (!Number.isFinite(value) || value <= 0) fail('semantic_job_invalid_input', 'now must be a positive timestamp.');
  return value;
}

function normalizeEstimate(rawEstimate, contextBytes) {
  if (rawEstimate == null) {
    return { value: Math.max(1, Math.ceil(contextBytes / 4)), method: 'heuristic_bytes_div_4' };
  }
  if (typeof rawEstimate !== 'number' || !Number.isSafeInteger(rawEstimate) || rawEstimate <= 0) {
    fail('semantic_job_invalid_input', 'estimatedInputTokens must be a finite positive integer.');
  }
  return { value: rawEstimate, method: 'caller_supplied' };
}

function normalizeReservation(value, label) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    fail('semantic_job_invalid_reservation', `${label} must be a finite positive integer.`);
  }
  return value;
}

// Admit a finite job. Idempotent on (kind, fingerprint): an unchanged replay
// returns the existing row with reused:true, including terminal rows (a reusable
// decision carrying its structured result). Changed semantic input or versions
// produce a new row; prior rows are retained. observationMetadata is persisted
// for inspection but never fingerprinted. Oversize input is rejected before any
// row or attempt exists. strictLimits refuses budgets whose limits the provider
// cannot enforce, since tracked limits are not enforcement evidence.
export function admitJob({
  kind,
  semanticInput,
  observationMetadata = {},
  versions = {},
  budget,
  candidateCount = null,
  estimatedInputTokens = null,
  strictLimits = false,
} = {}) {
  const normalizedKind = String(kind || '').trim();
  if (!normalizedKind || normalizedKind.length > 128) {
    fail('semantic_job_invalid_kind', 'Job kind must be a non-empty string of at most 128 characters.');
  }
  if (!isPlainObject(semanticInput)) fail('semantic_job_invalid_input', 'Semantic input must be an object.');
  const normalizedVersions = normalizeVersions(versions);
  const normalizedBudget = normalizeBudget(budget);
  if (strictLimits && normalizedBudget.unsupported.length > 0) {
    fail('semantic_job_unsupported_limits', `Strict admission refuses unenforceable limits: ${normalizedBudget.unsupported.join(',')}.`);
  }
  const observationJson = normalizeObservationMetadata(observationMetadata);
  const fingerprint = computeSemanticFingerprint(semanticInput, normalizedVersions);
  const inputJson = JSON.stringify(semanticInput);
  const contextBytes = Buffer.byteLength(inputJson);
  const count = candidateCount == null
    ? (Array.isArray(semanticInput.candidates) ? semanticInput.candidates.length : 1)
    : candidateCount;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    fail('semantic_job_invalid_input', 'candidateCount must be a non-negative safe integer.');
  }
  const estimate = normalizeEstimate(estimatedInputTokens, contextBytes);
  if (count > normalizedBudget.maxCandidates) {
    fail('semantic_job_oversize', `candidateCount ${count} exceeds budget maxCandidates ${normalizedBudget.maxCandidates}.`);
  }
  if (contextBytes > normalizedBudget.maxContextBytes) {
    fail('semantic_job_oversize', `contextBytes ${contextBytes} exceeds budget maxContextBytes ${normalizedBudget.maxContextBytes}.`);
  }
  if (estimate.value > normalizedBudget.maxEstimatedInputTokens) {
    fail('semantic_job_oversize', `estimatedInputTokens ${estimate.value} exceeds budget maxEstimatedInputTokens ${normalizedBudget.maxEstimatedInputTokens}.`);
  }
  const now = Date.now();
  return runStoreTransaction(() => {
    const existing = decodeSemanticJob(findSemanticJobRecord(normalizedKind, fingerprint));
    if (existing) return { job: existing, reused: true };
    const id = `sj_${randomUUID()}`;
    try {
      insertSemanticJobRecord({
        id,
        kind: normalizedKind,
        fingerprint,
        versions_json: JSON.stringify(normalizedVersions),
        input_json: inputJson,
        observation_json: observationJson,
        candidate_count: count,
        context_bytes: contextBytes,
        estimated_input_tokens: estimate.value,
        estimation_method: estimate.method,
        budget_json: JSON.stringify(normalizedBudget),
        status: 'active',
        claimant: '',
        claimed_at: null,
        deadline_at: null,
        terminal_outcome: '',
        terminal_reason: '',
        revisit_condition: '',
        result_json: '{}',
        decided_at: null,
        used_model_calls: 0,
        reserved_model_calls: 0,
        used_input_tokens: 0,
        reserved_input_tokens: 0,
        used_output_tokens: 0,
        reserved_output_tokens: 0,
        used_tool_calls: 0,
        reserved_tool_calls: 0,
        used_wall_time_ms: 0,
        repairs_used: 0,
        attempts_count: 0,
        has_unknown_usage: 0,
        created_at: now,
        updated_at: now,
      });
    } catch (error) {
      // A concurrent admission of the same (kind, fingerprint) wins; reuse it.
      const raced = decodeSemanticJob(findSemanticJobRecord(normalizedKind, fingerprint));
      if (raced) return { job: raced, reused: true };
      throw error;
    }
    return { job: getJobOrFail(id), reused: false };
  });
}

// Atomically claim an active job for one claimant. Exactly one claimant wins;
// every other concurrent or later claim is rejected without state change.
// Claiming starts the persistent elapsed budget: deadline = now + maxWallTimeMs.
export function claimJob(jobId, { claimant, now = null } = {}) {
  const holder = String(claimant || '').trim();
  if (!holder || holder.length > 128) {
    fail('semantic_job_invalid_claimant', 'Claimant must be a non-empty string of at most 128 characters.');
  }
  const at = normalizeNow(now);
  return runStoreTransaction(() => {
    const job = getJobOrFail(jobId);
    if (TERMINAL_SET.has(job.status)) fail('semantic_job_terminal', `Semantic job ${jobId} is already terminal (${job.status}).`);
    if (job.status === 'claimed') {
      fail('semantic_job_already_claimed', `Semantic job ${jobId} is already claimed by ${job.claimant || 'another claimant'}.`);
    }
    if (job.status !== 'active') fail('semantic_job_invalid_state', `Semantic job ${jobId} cannot be claimed from status ${job.status}.`);
    updateSemanticJobRecord(jobId, {
      status: 'claimed',
      claimant: holder,
      claimed_at: at,
      deadline_at: at + job.budget.maxWallTimeMs,
      updated_at: at,
    });
    return getJobOrFail(jobId);
  });
}

function listAttemptsOrFail(jobId) {
  return listSemanticJobAttemptRecords(jobId).map(decodeSemanticJobAttempt);
}

function latestResolvedAttempt(attempts) {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (attempts[index].status === 'settled' || attempts[index].status === 'interrupted') return attempts[index];
  }
  return null;
}

// Reserve one attempt against the parent job budget. Reservations are durable
// and cover model calls, request input, output, and tools; the persistent
// deadline covers elapsed wall time. A process interruption after reserve leaves
// the attempt `reserved` (uncertain) with the reservation charged; no further
// attempt in any mode is allowed while a reservation is outstanding or usage is
// unknown. Only the first invocation is primary: every follow-up is a
// repair/restart under the same persistent allowance and changed
// evidence/hypothesis contract, retaining the parent job identity.
export function reserveAttempt(jobId, {
  mode = 'primary',
  claimant,
  inputTokensReserved,
  outputTokensReserved,
  toolCallsReserved = 0,
  hypothesis = '',
  evidenceFingerprint = '',
  now = null,
} = {}) {
  const normalizedMode = String(mode || 'primary');
  if (!ATTEMPT_MODE_SET.has(normalizedMode)) fail('semantic_job_invalid_mode', `Unknown attempt mode: ${normalizedMode}`);
  const reservedInput = normalizeReservation(inputTokensReserved, 'inputTokensReserved');
  const reservedOutput = normalizeReservation(outputTokensReserved, 'outputTokensReserved');
  if (typeof toolCallsReserved !== 'number' || !Number.isSafeInteger(toolCallsReserved) || toolCallsReserved < 0) {
    fail('semantic_job_invalid_reservation', 'toolCallsReserved must be a non-negative safe integer.');
  }
  const normalizedHypothesis = String(hypothesis || '');
  const normalizedEvidence = String(evidenceFingerprint || '');
  if (normalizedHypothesis.length > 2000 || normalizedEvidence.length > 256) {
    fail('semantic_job_invalid_reservation', 'hypothesis/evidenceFingerprint exceed size limits.');
  }
  const at = normalizeNow(now);
  return runStoreTransaction(() => {
    const job = getJobOrFail(jobId);
    requireClaimed(job);
    requireClaimant(job, claimant);
    const attempts = listAttemptsOrFail(jobId);
    if (attempts.some((attempt) => attempt.status === 'reserved')) {
      fail('semantic_job_uncertain_attempt', `Semantic job ${jobId} has an outstanding reserved attempt; settle, reconcile, or interrupt it first.`);
    }
    if (job.usage.hasUnknownUsage) {
      fail('semantic_job_unknown_usage', `Semantic job ${jobId} has unreconciled unknown usage; reconcile it before further attempts.`);
    }
    let repairsUsed = job.usage.repairsUsed;
    if (normalizedMode === 'primary') {
      if (attempts.length > 0) {
        fail('semantic_job_invalid_primary', `Semantic job ${jobId} already invoked; follow-ups must be repair/restart with changed evidence or hypothesis.`);
      }
    } else {
      if (normalizedMode === 'repair' && !attempts.some((attempt) => attempt.status === 'settled')) {
        fail('semantic_job_invalid_repair', `Semantic job ${jobId} has no settled attempt to repair.`);
      }
      if (normalizedMode === 'restart' && !attempts.some((attempt) => attempt.status === 'interrupted')) {
        fail('semantic_job_invalid_restart', `Semantic job ${jobId} has no interrupted attempt to restart from.`);
      }
      if (repairsUsed >= job.budget.maxRepairs) {
        fail('semantic_job_repairs_exhausted', `Semantic job ${jobId} has no follow-ups remaining (${repairsUsed}/${job.budget.maxRepairs}).`);
      }
      const previous = latestResolvedAttempt(attempts);
      if (!previous) fail('semantic_job_invalid_repair', `Semantic job ${jobId} has no resolved attempt to follow up.`);
      const evidenceChanged = normalizedEvidence !== '' && normalizedEvidence !== previous.evidenceFingerprint;
      const hypothesisChanged = normalizedHypothesis !== '' && normalizedHypothesis !== previous.hypothesis;
      if (!evidenceChanged && !hypothesisChanged) {
        fail('semantic_job_repair_unchanged', `Semantic job ${jobId} follow-up requires changed evidence or a changed hypothesis.`);
      }
      repairsUsed += 1;
    }
    let deadlineAt = job.deadlineAt;
    if (deadlineAt == null) {
      // Self-heal rows claimed before the deadline column existed.
      deadlineAt = job.claimedAt + job.budget.maxWallTimeMs;
      updateSemanticJobRecord(jobId, { deadline_at: deadlineAt, updated_at: at });
    }
    if (reservedInput > job.budget.maxEstimatedInputTokens) {
      fail('semantic_job_oversize', `inputTokensReserved ${reservedInput} exceeds budget maxEstimatedInputTokens ${job.budget.maxEstimatedInputTokens}.`);
    }
    if (at >= deadlineAt) {
      fail('semantic_job_wall_exhausted', `Semantic job ${jobId} is at or past its elapsed budget (deadline ${deadlineAt}).`);
    }
    if (job.usage.wallTimeMs >= job.budget.maxWallTimeMs) {
      fail('semantic_job_wall_exhausted', `Semantic job ${jobId} has no elapsed budget remaining (${job.usage.wallTimeMs}/${job.budget.maxWallTimeMs}).`);
    }
    const spentModelCalls = job.usage.modelCalls + job.usage.reservedModelCalls;
    if (spentModelCalls + 1 > job.budget.maxModelCalls) {
      fail('semantic_job_budget_exhausted', `Semantic job ${jobId} has no model calls remaining (${spentModelCalls}/${job.budget.maxModelCalls}).`);
    }
    const spentInput = job.usage.inputTokens + job.usage.reservedInputTokens;
    if (spentInput + reservedInput > job.budget.maxCumulativeInputTokens) {
      fail('semantic_job_budget_exhausted', `Semantic job ${jobId} has no cumulative input remaining (${spentInput}/${job.budget.maxCumulativeInputTokens}).`);
    }
    const spentOutput = job.usage.outputTokens + job.usage.reservedOutputTokens;
    if (spentOutput + reservedOutput > job.budget.maxOutputTokens) {
      fail('semantic_job_budget_exhausted', `Semantic job ${jobId} has no output tokens remaining (${spentOutput}/${job.budget.maxOutputTokens}).`);
    }
    if (job.budget.maxToolCalls === null && toolCallsReserved > 0) {
      fail('semantic_job_no_tool_authority', `Semantic job ${jobId} has no tool authority.`);
    }
    if (job.budget.maxToolCalls !== null) {
      const spentTools = job.usage.toolCalls + job.usage.reservedToolCalls;
      if (spentTools + toolCallsReserved > job.budget.maxToolCalls) {
        fail('semantic_job_budget_exhausted', `Semantic job ${jobId} has no tool calls remaining (${spentTools}/${job.budget.maxToolCalls}).`);
      }
    }
    const attemptId = `sja_${randomUUID()}`;
    insertSemanticJobAttemptRecord({
      id: attemptId,
      job_id: jobId,
      seq: job.usage.attempts + 1,
      mode: normalizedMode,
      status: 'reserved',
      hypothesis: normalizedHypothesis,
      evidence_fingerprint: normalizedEvidence,
      reserved_model_calls: 1,
      reserved_input_tokens: reservedInput,
      reserved_output_tokens: reservedOutput,
      reserved_tool_calls: toolCallsReserved,
      actual_input_tokens: null,
      actual_cached_input_tokens: null,
      actual_output_tokens: null,
      actual_reasoning_tokens: null,
      actual_model_calls: null,
      actual_tool_calls: null,
      actual_wall_time_ms: null,
      usage_unknown: 0,
      receipt_id: null,
      reconcile_receipt_id: null,
      created_at: at,
      settled_at: null,
    });
    updateSemanticJobRecord(jobId, {
      reserved_model_calls: job.usage.reservedModelCalls + 1,
      reserved_input_tokens: job.usage.reservedInputTokens + reservedInput,
      reserved_output_tokens: job.usage.reservedOutputTokens + reservedOutput,
      reserved_tool_calls: job.usage.reservedToolCalls + toolCallsReserved,
      repairs_used: repairsUsed,
      attempts_count: job.usage.attempts + 1,
      updated_at: at,
    });
    return decodeSemanticJobAttempt(getSemanticJobAttemptRecord(attemptId));
  });
}

function normalizeUsage(usage = {}) {
  if (!isPlainObject(usage)) fail('semantic_job_invalid_usage', 'Usage must be an object.');
  for (const key of Object.keys(usage)) {
    if (!USAGE_FIELDS.includes(key)) fail('semantic_job_invalid_usage', `Unknown usage field: ${key}`);
  }
  const normalized = {};
  for (const field of USAGE_FIELDS) {
    const value = usage[field];
    if (value == null) {
      normalized[field] = null;
      continue;
    }
    assertFiniteNonNegativeInteger(value, field);
    normalized[field] = value;
  }
  checkUsageConsistency(normalized);
  return normalized;
}

function checkUsageConsistency(usage) {
  // Cached input tokens are part of input tokens; reasoning tokens are part of
  // output tokens. Subsets must never exceed their totals, and tokens without
  // at least one model call are contradictory. Applies to supplied payloads and
  // to merged reconciliation results alike.
  if (usage.cachedInputTokens != null && usage.inputTokens != null
    && usage.cachedInputTokens > usage.inputTokens) {
    fail('semantic_job_invalid_usage', 'cachedInputTokens cannot exceed inputTokens.');
  }
  if (usage.reasoningTokens != null && usage.outputTokens != null
    && usage.reasoningTokens > usage.outputTokens) {
    fail('semantic_job_invalid_usage', 'reasoningTokens cannot exceed outputTokens.');
  }
  if (usage.modelCalls === 0) {
    const tokenFields = ['inputTokens', 'cachedInputTokens', 'outputTokens', 'reasoningTokens'];
    if (tokenFields.some((field) => usage[field] != null && usage[field] > 0)) {
      fail('semantic_job_invalid_usage', 'Token usage with modelCalls 0 is contradictory.');
    }
  }
}

function usageEquals(normalized, stored) {
  return USAGE_FIELDS.every((field) => (normalized[field] ?? null) === (stored[field] ?? null));
}

// Settle a reserved attempt with a real provider receipt. Over-budget actuals
// are recorded as genuine usage and fence further work; they are never
// discarded. Missing usage stays null/unknown: the reservation remains charged
// and the job is fenced until reconciliation. A receipt is idempotent only for
// the same attempt with the same usage payload; reuse on another attempt, or a
// contradictory repeat, is an error.
export function settleAttempt(attemptId, { claimant, usage = {}, receiptId = null, now = null } = {}) {
  const normalizedReceipt = receiptId == null || receiptId === '' ? null : String(receiptId);
  if (normalizedReceipt != null && normalizedReceipt.length > 256) {
    fail('semantic_job_invalid_usage', 'receiptId exceeds 256 characters.');
  }
  const normalizedUsage = normalizeUsage(usage);
  const at = normalizeNow(now);
  return runStoreTransaction(() => {
    const attempt = decodeSemanticJobAttempt(getSemanticJobAttemptRecord(attemptId));
    if (!attempt) fail('semantic_job_not_found', `Semantic job attempt not found: ${attemptId}`);
    const job = getJobOrFail(attempt.jobId);
    requireClaimant(job, claimant);
    if (attempt.status !== 'reserved') {
      if (normalizedReceipt != null && normalizedReceipt === attempt.receiptId) {
        if (usageEquals(normalizedUsage, attempt.actual)) {
          return { attempt, job, idempotent: true };
        }
        fail('semantic_job_receipt_conflict', `Receipt ${normalizedReceipt} repeats with contradictory usage.`);
      }
      fail('semantic_job_already_settled', `Semantic job attempt ${attemptId} is already ${attempt.status}.`);
    }
    if (normalizedReceipt != null) {
      const prior = findSemanticJobAttemptByAnyReceipt(normalizedReceipt);
      if (prior) {
        fail('semantic_job_receipt_reused', `Receipt ${normalizedReceipt} is already recorded on attempt ${prior.id}.`);
      }
    }
    const unknown = CORE_USAGE_FIELDS.some((field) => normalizedUsage[field] == null);
    const charged = {
      modelCalls: normalizedUsage.modelCalls ?? attempt.reservedModelCalls,
      inputTokens: normalizedUsage.inputTokens ?? attempt.reservedInputTokens,
      outputTokens: normalizedUsage.outputTokens ?? attempt.reservedOutputTokens,
      toolCalls: normalizedUsage.toolCalls ?? attempt.reservedToolCalls,
      wallTimeMs: normalizedUsage.wallTimeMs ?? 0,
    };
    updateSemanticJobRecord(job.id, {
      reserved_model_calls: Math.max(0, job.usage.reservedModelCalls - attempt.reservedModelCalls),
      reserved_input_tokens: Math.max(0, job.usage.reservedInputTokens - attempt.reservedInputTokens),
      reserved_output_tokens: Math.max(0, job.usage.reservedOutputTokens - attempt.reservedOutputTokens),
      reserved_tool_calls: Math.max(0, job.usage.reservedToolCalls - attempt.reservedToolCalls),
      used_model_calls: job.usage.modelCalls + charged.modelCalls,
      used_input_tokens: job.usage.inputTokens + charged.inputTokens,
      used_output_tokens: job.usage.outputTokens + charged.outputTokens,
      used_tool_calls: job.usage.toolCalls + charged.toolCalls,
      used_wall_time_ms: job.usage.wallTimeMs + charged.wallTimeMs,
      has_unknown_usage: job.usage.hasUnknownUsage || unknown ? 1 : 0,
      updated_at: at,
    });
    updateSemanticJobAttemptRecord(attemptId, {
      status: 'settled',
      actual_input_tokens: normalizedUsage.inputTokens,
      actual_cached_input_tokens: normalizedUsage.cachedInputTokens,
      actual_output_tokens: normalizedUsage.outputTokens,
      actual_reasoning_tokens: normalizedUsage.reasoningTokens,
      actual_model_calls: normalizedUsage.modelCalls,
      actual_tool_calls: normalizedUsage.toolCalls,
      actual_wall_time_ms: normalizedUsage.wallTimeMs,
      usage_unknown: unknown ? 1 : 0,
      receipt_id: normalizedReceipt,
      settled_at: at,
    });
    return { attempt: decodeSemanticJobAttempt(getSemanticJobAttemptRecord(attemptId)), job: getJobOrFail(job.id), idempotent: false };
  });
}

// Reconcile unknown usage with late-arriving provider accounting. The retained
// reservation is replaced by genuine actuals (never silently released), the
// unknown marker is recomputed across all attempts, and the fence lifts only
// when no unknown usage remains. Already-known fields must match; rewriting
// settled history is an error.
export function reconcileAttemptUsage(attemptId, { claimant, usage = {}, receiptId, now = null } = {}) {
  const normalizedReceipt = receiptId == null || receiptId === '' ? null : String(receiptId);
  if (normalizedReceipt == null || normalizedReceipt.length > 256) {
    fail('semantic_job_invalid_usage', 'Reconciliation requires a new receiptId of at most 256 characters.');
  }
  const normalizedUsage = normalizeUsage(usage);
  for (const field of CORE_USAGE_FIELDS) {
    if (normalizedUsage[field] == null) {
      fail('semantic_job_invalid_usage', `Reconciliation requires known ${field}.`);
    }
  }
  const at = normalizeNow(now);
  return runStoreTransaction(() => {
    const attempt = decodeSemanticJobAttempt(getSemanticJobAttemptRecord(attemptId));
    if (!attempt) fail('semantic_job_not_found', `Semantic job attempt not found: ${attemptId}`);
    const job = getJobOrFail(attempt.jobId);
    requireClaimant(job, claimant);
    if ((attempt.status !== 'settled' && attempt.status !== 'interrupted') || !attempt.usageUnknown) {
      fail('semantic_job_nothing_to_reconcile', `Semantic job attempt ${attemptId} has no unknown usage to reconcile.`);
    }
    const prior = findSemanticJobAttemptByAnyReceipt(normalizedReceipt);
    if (prior) {
      fail('semantic_job_receipt_reused', `Receipt ${normalizedReceipt} is already recorded on attempt ${prior.id}.`);
    }
    for (const field of USAGE_FIELDS) {
      const stored = attempt.actual[field];
      const incoming = normalizedUsage[field];
      if (stored != null && incoming != null && stored !== incoming) {
        fail('semantic_job_receipt_conflict', `Reconciliation contradicts settled ${field} (${stored} vs ${incoming}).`);
      }
    }
    const merged = {};
    for (const field of USAGE_FIELDS) merged[field] = attempt.actual[field] ?? normalizedUsage[field];
    checkUsageConsistency(merged);
    const retained = {
      modelCalls: attempt.actual.modelCalls ?? attempt.reservedModelCalls,
      inputTokens: attempt.actual.inputTokens ?? attempt.reservedInputTokens,
      outputTokens: attempt.actual.outputTokens ?? attempt.reservedOutputTokens,
      toolCalls: attempt.actual.toolCalls ?? attempt.reservedToolCalls,
      wallTimeMs: attempt.actual.wallTimeMs ?? 0,
    };
    updateSemanticJobRecord(job.id, {
      used_model_calls: job.usage.modelCalls - retained.modelCalls + merged.modelCalls,
      used_input_tokens: job.usage.inputTokens - retained.inputTokens + merged.inputTokens,
      used_output_tokens: job.usage.outputTokens - retained.outputTokens + merged.outputTokens,
      used_tool_calls: job.usage.toolCalls - retained.toolCalls + merged.toolCalls,
      used_wall_time_ms: job.usage.wallTimeMs - retained.wallTimeMs + merged.wallTimeMs,
      updated_at: at,
    });
    updateSemanticJobAttemptRecord(attemptId, {
      actual_input_tokens: merged.inputTokens,
      actual_cached_input_tokens: merged.cachedInputTokens,
      actual_output_tokens: merged.outputTokens,
      actual_reasoning_tokens: merged.reasoningTokens,
      actual_model_calls: merged.modelCalls,
      actual_tool_calls: merged.toolCalls,
      actual_wall_time_ms: merged.wallTimeMs,
      usage_unknown: 0,
      reconcile_receipt_id: normalizedReceipt,
    });
    const remaining = listAttemptsOrFail(job.id).some((entry) => entry.id !== attemptId && entry.usageUnknown);
    if (!remaining) updateSemanticJobRecord(job.id, { has_unknown_usage: 0, updated_at: at });
    return { attempt: decodeSemanticJobAttempt(getSemanticJobAttemptRecord(attemptId)), job: getJobOrFail(job.id) };
  });
}

// Explicitly mark a reserved (uncertain) attempt as interrupted, e.g. after the
// controller observes worker death. Reservations convert into used budget —
// never released — and the unknown marker fences further attempts until
// reconciliation. Only explicit repair/restart attempts may follow.
export function markAttemptInterrupted(attemptId, { claimant, reason = '', now = null } = {}) {
  const normalizedReason = String(reason || '');
  if (normalizedReason.length > 1000) fail('semantic_job_invalid_input', 'Interruption reason exceeds 1000 characters.');
  const at = normalizeNow(now);
  return runStoreTransaction(() => {
    const attempt = decodeSemanticJobAttempt(getSemanticJobAttemptRecord(attemptId));
    if (!attempt) fail('semantic_job_not_found', `Semantic job attempt not found: ${attemptId}`);
    const job = getJobOrFail(attempt.jobId);
    requireClaimant(job, claimant);
    if (attempt.status !== 'reserved') {
      fail('semantic_job_already_settled', `Semantic job attempt ${attemptId} is already ${attempt.status}.`);
    }
    updateSemanticJobRecord(job.id, {
      reserved_model_calls: Math.max(0, job.usage.reservedModelCalls - attempt.reservedModelCalls),
      reserved_input_tokens: Math.max(0, job.usage.reservedInputTokens - attempt.reservedInputTokens),
      reserved_output_tokens: Math.max(0, job.usage.reservedOutputTokens - attempt.reservedOutputTokens),
      reserved_tool_calls: Math.max(0, job.usage.reservedToolCalls - attempt.reservedToolCalls),
      used_model_calls: job.usage.modelCalls + attempt.reservedModelCalls,
      used_input_tokens: job.usage.inputTokens + attempt.reservedInputTokens,
      used_output_tokens: job.usage.outputTokens + attempt.reservedOutputTokens,
      used_tool_calls: job.usage.toolCalls + attempt.reservedToolCalls,
      has_unknown_usage: 1,
      updated_at: at,
    });
    updateSemanticJobAttemptRecord(attemptId, {
      status: 'interrupted',
      usage_unknown: 1,
      settled_at: at,
    });
    return { attempt: decodeSemanticJobAttempt(getSemanticJobAttemptRecord(attemptId)), job: getJobOrFail(job.id) };
  });
}

// Persist the terminal outcome with its structured result. Successful outcomes
// require no in-flight or uncertain invocation; only `unresolved` may preserve
// an explicit fence. Terminal state is immutable, carries no approval, and a
// replay of unchanged input reuses the persisted result.
export function settleJobTerminal(jobId, { claimant, outcome, reason = '', revisitCondition = '', result = {}, now = null } = {}) {
  const normalizedOutcome = String(outcome || '');
  if (!TERMINAL_SET.has(normalizedOutcome)) {
    fail('semantic_job_invalid_outcome', `Unknown terminal outcome: ${normalizedOutcome || 'missing'}`);
  }
  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason || normalizedReason.length > 2000) {
    fail('semantic_job_invalid_outcome', 'Terminal outcome requires a non-empty reason of at most 2000 characters.');
  }
  const normalizedRevisit = String(revisitCondition || '').trim();
  if ((normalizedOutcome === 'deferred' || normalizedOutcome === 'waiting_for_evidence') && !normalizedRevisit) {
    fail('semantic_job_invalid_outcome', `Outcome ${normalizedOutcome} requires an explicit revisit condition.`);
  }
  if (normalizedRevisit.length > 2000) fail('semantic_job_invalid_outcome', 'Revisit condition exceeds 2000 characters.');
  const resultJson = normalizeResult(result);
  const at = normalizeNow(now);
  return runStoreTransaction(() => {
    const job = getJobOrFail(jobId);
    requireClaimant(job, claimant);
    requireClaimed(job);
    const attempts = listAttemptsOrFail(jobId);
    if (attempts.some((attempt) => attempt.status === 'reserved')) {
      fail('semantic_job_in_flight', `Semantic job ${jobId} has an in-flight invocation; settle or interrupt it first.`);
    }
    if (job.usage.hasUnknownUsage && normalizedOutcome !== 'unresolved') {
      fail('semantic_job_uncertain', `Semantic job ${jobId} has uncertain usage; reconcile it or close as unresolved.`);
    }
    updateSemanticJobRecord(jobId, {
      status: normalizedOutcome,
      terminal_outcome: normalizedOutcome,
      terminal_reason: normalizedReason,
      revisit_condition: normalizedRevisit,
      result_json: resultJson,
      decided_at: at,
      updated_at: at,
    });
    return getJobOrFail(jobId);
  });
}

export function getJob(jobId) {
  return getJobOrFail(String(jobId));
}

export function getAttempt(attemptId) {
  const attempt = decodeSemanticJobAttempt(getSemanticJobAttemptRecord(attemptId));
  if (!attempt) fail('semantic_job_not_found', `Semantic job attempt not found: ${attemptId}`);
  return attempt;
}

export function listJobAttempts(jobId) {
  getJobOrFail(String(jobId));
  return listAttemptsOrFail(String(jobId));
}
