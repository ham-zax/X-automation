import { randomUUID } from 'node:crypto';
import { prepareAutonomousMainFeed } from './autonomous_main_feed.js';
import {
  detachGrowthAgentRuntime,
  getGrowthAgentRuntimeStatus,
  heartbeatGrowthAgentRuntime,
} from './growth_agent_runtime.js';
import {
  acquireOperatorLease,
  getOperatorLeaseStatus,
  releaseOperatorLease,
  renewOperatorLease,
} from './operator_lease.js';
import { getOperatorReadiness } from './operator_readiness.js';
import {
  createGrowthRun,
  getGrowthRun,
  getGrowthOperatorDelegation,
  listGrowthRuns,
  listPublicationAttempts,
  updateGrowthRun,
} from './store.js';

const STOP_REASONS = new Set([
  'no_worthwhile_eligible_work',
  'resource_ceiling_reached',
  'delegation_revoked',
  'delegation_revised',
  'capability_unavailable',
  'reconciliation_scope_blocked',
  'budget_exhausted',
  'manual_intervention_required',
]);

const TERMINAL_RESULTS = new Set(['completed', 'partial', 'blocked', 'unresolved']);

function normalizedCeilings(input = {}) {
  const ceiling = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const boundedPositive = (value, fallback, max) => {
    if (value == null) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(max, parsed);
  };
  return {
    maxDurationMinutes: boundedPositive(ceiling.maxDurationMinutes, 20, 60),
    maxObservations: Math.floor(boundedPositive(ceiling.maxObservations, 50, 200)),
    maxPublicMutations: Math.floor(boundedPositive(ceiling.maxPublicMutations, 10, 25)),
  };
}

function requireRun(runId) {
  const run = getGrowthRun(runId);
  if (!run) throw new Error(`Growth Run not found: ${runId}`);
  return run;
}

function currentDelegationForRun(run) {
  const grant = getGrowthOperatorDelegation();
  if (grant.state !== 'running' || grant.mode !== 'live') {
    return { allowed: false, reason: 'delegation_revoked', grant };
  }
  if (Number(grant.revision) !== Number(run.delegationRevision)) {
    return { allowed: false, reason: 'delegation_revised', grant };
  }
  return { allowed: true, grant };
}

function runtimeHeartbeat(run, capabilities = null, now = Date.now()) {
  if (!run.adapterType || !run.sessionId) return null;
  const current = getGrowthAgentRuntimeStatus({ now });
  const sameRuntime = current.adapterType === run.adapterType
    && current.sessionId === run.sessionId
    && (!current.runId || current.runId === run.runId);
  const resolvedCapabilities = capabilities == null && sameRuntime ? current.capabilities : (capabilities || {});
  const accountHandle = sameRuntime ? current.accountHandle : '';
  return heartbeatGrowthAgentRuntime({
    adapterType: run.adapterType,
    sessionId: run.sessionId,
    runId: run.runId,
    accountHandle,
    capabilities: resolvedCapabilities,
    now,
  });
}

function ensureRunLease(run, { adapterType = null, sessionId = null, now = Date.now() } = {}) {
  const current = getOperatorLeaseStatus({ now });
  if (current.active && current.leaseId === run.leaseId) {
    const nextAdapterType = adapterType == null ? run.adapterType : String(adapterType || '');
    const nextSessionId = sessionId == null ? run.sessionId : String(sessionId || '');
    const renewed = renewOperatorLease(run.leaseId, {
      now,
      holder: 'growth_run',
      runId: run.runId,
      adapterType: nextAdapterType,
      sessionId: nextSessionId,
    });
    const next = (adapterType != null || sessionId != null)
      ? updateGrowthRun(run.runId, {
        adapterType: nextAdapterType,
        sessionId: nextSessionId,
        lastResumedAt: now,
        now,
      })
      : run;
    return { run: next, lease: renewed };
  }
  if (current.active) {
    throw new Error(`Another operator lease is active${current.runId ? ` for Growth Run ${current.runId}` : ''}.`);
  }
  const nextAdapterType = adapterType == null ? run.adapterType : String(adapterType || '');
  const nextSessionId = sessionId == null ? run.sessionId : String(sessionId || '');
  const lease = acquireOperatorLease({
    now,
    holder: 'growth_run',
    runId: run.runId,
    adapterType: nextAdapterType,
    sessionId: nextSessionId,
  });
  const next = updateGrowthRun(run.runId, {
    adapterType: nextAdapterType,
    sessionId: nextSessionId,
    leaseId: lease.leaseId,
    lastResumedAt: now,
    now,
  });
  return { run: next, lease };
}

function mutationCount(runId) {
  return listPublicationAttempts({ runId, limit: 500 })
    .filter((attempt) => ['send_started', 'investigating', 'confirmed_published', 'closed_unresolved'].includes(attempt.state)).length;
}

function ceilingState(run, now, readiness = null) {
  const elapsedMinutes = Math.max(0, (Number(now) - Number(run.startedAt)) / 60_000);
  const mutations = mutationCount(run.runId);
  const sensorProvenance = readiness?.sensors?.xForYou?.provenance || null;
  const observations = String(sensorProvenance?.runId || '') === String(run.runId)
    ? Number(sensorProvenance?.acceptedCount || 0)
    : 0;
  const observationCeiling = Number(run.ceilings.maxObservations || 50);
  const hitDuration = elapsedMinutes >= Number(run.ceilings.maxDurationMinutes || 20);
  const hitMutations = mutations >= Number(run.ceilings.maxPublicMutations || 10);
  return {
    elapsedMinutes,
    observations,
    observationCeiling,
    observationCeilingReached: observations >= observationCeiling,
    publicMutationAttempts: mutations,
    hit: hitDuration || hitMutations,
    reason: hitDuration ? 'max_duration' : hitMutations ? 'max_public_mutations' : null,
  };
}

function nextOperation(run, readiness, now) {
  const ceilings = ceilingState(run, now, readiness);
  if (ceilings.hit) {
    return {
      stage: 'finishing',
      recommendedOperation: 'finish',
      permittedOperations: ['finish'],
      stopReason: 'resource_ceiling_reached',
      ceilings,
    };
  }
  if (readiness.accountHealth.constrained) {
    return {
      stage: 'finishing',
      recommendedOperation: 'finish',
      permittedOperations: ['finish'],
      stopReason: 'manual_intervention_required',
      stopDetail: 'Account Health is constrained.',
      ceilings,
    };
  }
  if (!readiness.reasoningAgent.attached || readiness.reasoningAgent.capabilities?.reasoning !== true) {
    return {
      stage: 'finishing',
      recommendedOperation: 'finish',
      permittedOperations: ['finish'],
      stopReason: 'capability_unavailable',
      stopDetail: 'No attached reasoning runtime is advertising the required reasoning capability.',
      ceilings,
    };
  }
  if (readiness.reconciliation.activeCount > 0) {
    return {
      stage: 'recovery',
      recommendedOperation: 'recover_attempt',
      permittedOperations: ['recover_attempt', 'collect_for_you', 'inspect_candidate', 'finish'],
      ceilings,
    };
  }
  const fy = readiness.sensors.xForYou;
  if (!fy.fresh || fy.authenticatedAccountVerified !== true) {
    const browser = readiness.transports.browserAgent;
    if (!browser.runtimeAttached || !browser.browserRead || !browser.xAuthenticated) {
      return {
        stage: 'finishing',
        recommendedOperation: 'finish',
        permittedOperations: ['finish'],
        stopReason: 'capability_unavailable',
        stopDetail: 'Fresh personalized For You sensing requires an attached authenticated browser-read capability.',
        ceilings,
      };
    }
    if (ceilings.observationCeilingReached) {
      return {
        stage: 'finishing',
        recommendedOperation: 'finish',
        permittedOperations: ['finish'],
        stopReason: 'resource_ceiling_reached',
        stopDetail: 'The run cannot collect additional personalized observations because its observation ceiling is reached.',
        ceilings,
      };
    }
    return {
      stage: 'sensing',
      recommendedOperation: 'collect_for_you',
      permittedOperations: ['collect_for_you', 'finish'],
      ceilings,
    };
  }
  if (readiness.mainFeed?.blockingReason === 'approved_scheduler_work_available') {
    const queueItemId = Number(readiness.mainFeed?.approvedQueueItemId || 0) || null;
    return {
      stage: 'acting',
      recommendedOperation: 'claim_action',
      permittedOperations: ['inspect_candidate', 'claim_action', 'finish'],
      claim: queueItemId ? {
        lane: 'main_feed',
        command: 'browser-publish-claim',
        queueItemId,
        runId: run.runId,
        sessionId: run.sessionId,
        reason: 'An approved main-feed item is eligible now. The attached browser-agent lane owns the mutation even when the background daemon has no X API credentials.',
      } : null,
      ceilings,
    };
  }
  if (readiness.mainFeed?.allowed === true) {
    return {
      stage: 'selection',
      recommendedOperation: 'inspect_candidate',
      permittedOperations: ['inspect_candidate', 'select_behavior', 'prepare_main_feed', 'finish'],
      ceilings,
    };
  }
  return {
    stage: 'selection',
    recommendedOperation: 'inspect_candidate',
    permittedOperations: ['inspect_candidate', 'select_behavior', 'finish'],
    ceilings,
  };
}

export function getGrowthRunStatus(runId, { now = Date.now() } = {}) {
  const run = requireRun(runId);
  const delegation = currentDelegationForRun(run);
  const readiness = getOperatorReadiness({ now, operatorLeaseId: run.leaseId || null });
  const next = run.status === 'active' && delegation.allowed ? nextOperation(run, readiness, now) : null;
  return {
    protocolVersion: 1,
    run,
    delegation: { allowed: delegation.allowed, reason: delegation.allowed ? null : delegation.reason, currentRevision: delegation.grant.revision },
    readiness,
    next,
  };
}

export function beginGrowthRun({
  adapterType = 'agent_bridge',
  sessionId = '',
  capabilities = {},
  ceilings = {},
  now = Date.now(),
} = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('Growth Run begin requires numeric now.');
  const active = listGrowthRuns({ status: 'active', limit: 20 })[0] || null;
  if (active) return resumeGrowthRun(active.runId, { adapterType, sessionId, capabilities, now: timestamp });
  const grant = getGrowthOperatorDelegation();
  if (grant.state !== 'running' || grant.mode !== 'live') {
    throw new Error(`Growth Operator delegation must be running/live to begin a Growth Run; current state is ${grant.state}/${grant.mode}.`);
  }
  const runId = randomUUID();
  const lease = acquireOperatorLease({
    now: timestamp,
    holder: 'growth_run',
    runId,
    adapterType,
    sessionId,
  });
  let run;
  try {
    run = createGrowthRun({
      runId,
      delegationRevision: grant.revision,
      adapterType,
      sessionId,
      leaseId: lease.leaseId,
      ceilings: normalizedCeilings(ceilings),
      now: timestamp,
    });
  } catch (error) {
    try { releaseOperatorLease(lease.leaseId, { now: timestamp }); } catch {}
    throw error;
  }
  runtimeHeartbeat(run, capabilities, timestamp);
  const status = getGrowthRunStatus(run.runId, { now: timestamp });
  const staged = updateGrowthRun(run.runId, { stage: status.next?.stage || 'startup', now: timestamp });
  return getGrowthRunStatus(staged.runId, { now: timestamp });
}

export function resumeGrowthRun(runId, {
  adapterType = null,
  sessionId = null,
  capabilities = null,
  now = Date.now(),
} = {}) {
  const timestamp = Number(now);
  let run = requireRun(runId);
  if (run.status !== 'active') return getGrowthRunStatus(run.runId, { now: timestamp });
  const delegation = currentDelegationForRun(run);
  if (!delegation.allowed) {
    const terminal = updateGrowthRun(run.runId, {
      status: 'blocked',
      stage: 'finishing',
      stopReason: delegation.reason,
      stopDetail: `Growth Operator delegation is ${delegation.grant.state}/${delegation.grant.mode} at revision ${delegation.grant.revision}; run is bound to revision ${run.delegationRevision}.`,
      now: timestamp,
    });
    const lease = getOperatorLeaseStatus({ now: timestamp });
    if (lease.active && lease.leaseId === run.leaseId) {
      try { releaseOperatorLease(run.leaseId, { now: timestamp }); } catch {}
    }
    return getGrowthRunStatus(terminal.runId, { now: timestamp });
  }
  run = ensureRunLease(run, { adapterType, sessionId, now: timestamp }).run;
  runtimeHeartbeat(run, capabilities, timestamp);
  const status = getGrowthRunStatus(run.runId, { now: timestamp });
  updateGrowthRun(run.runId, { stage: status.next?.stage || run.stage, lastResumedAt: timestamp, now: timestamp });
  return getGrowthRunStatus(run.runId, { now: timestamp });
}

export async function advanceGrowthRun(runId, {
  operation = null,
  capabilities = null,
  now = Date.now(),
} = {}) {
  const timestamp = Number(now);
  let run = requireRun(runId);
  if (run.status !== 'active') return getGrowthRunStatus(run.runId, { now: timestamp });
  const delegation = currentDelegationForRun(run);
  if (!delegation.allowed) return resumeGrowthRun(run.runId, { capabilities, now: timestamp });
  run = ensureRunLease(run, { now: timestamp }).run;
  runtimeHeartbeat(run, capabilities, timestamp);
  let status = getGrowthRunStatus(run.runId, { now: timestamp });
  const requested = operation == null ? null : String(operation);
  if (requested && !status.next?.permittedOperations?.includes(requested)) {
    throw new Error(`Growth Run operation ${requested} is not permitted in stage ${status.next?.stage || run.stage}.`);
  }
  if (requested === 'prepare_main_feed') {
    updateGrowthRun(run.runId, { stage: 'preparation', now: timestamp });
    const preparation = await prepareAutonomousMainFeed({ now: timestamp, operatorLeaseId: run.leaseId });
    const nextStatus = getGrowthRunStatus(run.runId, { now: Date.now() });
    updateGrowthRun(run.runId, {
      stage: nextStatus.next?.stage || 'selection',
      result: { ...run.result, lastPreparation: preparation },
      now: Date.now(),
    });
    status = getGrowthRunStatus(run.runId, { now: Date.now() });
    return { ...status, operationResult: preparation };
  }
  if (requested === 'finish') {
    return finishGrowthRun(run.runId, {
      status: 'completed',
      stopReason: status.next?.stopReason || 'no_worthwhile_eligible_work',
      stopDetail: status.next?.stopReason
        ? 'The Growth Run reached its configured resource ceiling.'
        : 'The reasoning operator found no additional worthwhile eligible action for this run.',
      now: timestamp,
    });
  }
  if (requested) {
    updateGrowthRun(run.runId, { stage: status.next?.stage || run.stage, now: timestamp });
  }
  return getGrowthRunStatus(run.runId, { now: timestamp });
}

export function finishGrowthRun(runId, {
  status = 'completed',
  stopReason = 'no_worthwhile_eligible_work',
  stopDetail = '',
  result = {},
  now = Date.now(),
} = {}) {
  const run = requireRun(runId);
  if (run.status !== 'active') return getGrowthRunStatus(run.runId, { now });
  const terminalStatus = String(status || 'completed');
  const reason = String(stopReason || '');
  if (!TERMINAL_RESULTS.has(terminalStatus)) throw new Error(`Invalid Growth Run terminal result: ${terminalStatus}.`);
  if (!STOP_REASONS.has(reason)) throw new Error(`Invalid Growth Run stop reason: ${reason}.`);
  const attempts = listPublicationAttempts({ runId: run.runId, limit: 500 });
  const summary = {
    ...result,
    publicationAttempts: attempts.length,
    confirmedPublished: attempts.filter((attempt) => attempt.state === 'confirmed_published').length,
    closedUnresolved: attempts.filter((attempt) => attempt.state === 'closed_unresolved').length,
    investigating: attempts.filter((attempt) => ['claimed', 'send_started', 'investigating'].includes(attempt.state)).length,
  };
  const terminal = updateGrowthRun(run.runId, {
    status: terminalStatus,
    stage: 'finishing',
    stopReason: reason,
    stopDetail,
    result: summary,
    now,
  });
  const lease = getOperatorLeaseStatus({ now });
  if (lease.active && lease.leaseId === run.leaseId) {
    try { releaseOperatorLease(run.leaseId, { now }); } catch {}
  }
  if (run.adapterType && run.sessionId) detachGrowthAgentRuntime({ now });
  return getGrowthRunStatus(terminal.runId, { now });
}
