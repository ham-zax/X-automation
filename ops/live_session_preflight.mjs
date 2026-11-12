// Live session preflight. Decides, before any browser tab or reasoning child is
// allocated, whether this wall-clock block has work worth a session. Every check
// is deterministic and local: no browser, no LLM, no public mutation.
//
// Order matters. An unfinished publication or social attempt outranks rest,
// health and idle gates: an uncertain send must be reconciled before anything
// else. A crashed run must not keep a lease that blocks the next session.

const UNFINISHED_SOCIAL_STATES = Object.freeze(['claimed', 'mutation_started', 'repost_confirmation_started']);
const UNFINISHED_SOCIAL_STATE_SET = new Set(UNFINISHED_SOCIAL_STATES);
const SOCIAL_ATTEMPT_LIMIT = 200;
const DEFAULT_MIN_REMAINING_BLOCK_MS = 75_000;
const ABANDONED_RUN_DETAIL = 'Closed abandoned active run with expired lease and zero unfinished attempts before new session.';
const EXITED_SESSION_DETAIL = 'Session exited abnormally with zero unfinished attempts.';

// The real modules are imported only when a caller supplies no deps, so unit
// tests can drive every branch without opening SQLite or the network.
async function loadDefaultDeps() {
  const [store, operatorLease, publicationReconciliation, socialEngagement, growthRun,
    discoverySchedule, growthConfig, activityPolicy, scout, sourceRefresh, engagement, xReads] = await Promise.all([
    import('../store.js'),
    import('../operator_lease.js'),
    import('../publication_reconciliation.js'),
    import('../social_engagement.js'),
    import('../growth_run.js'),
    import('../discovery_schedule.js'),
    import('../growth_config.js'),
    import('../growth_activity_policy.js'),
    import('../scout.js'),
    import('../source_refresh.js'),
    import('../engagement.js'),
    import('../x_reads.js'),
  ]);
  return {
    store,
    getOperatorLeaseStatus: operatorLease.getOperatorLeaseStatus,
    releaseOperatorLease: operatorLease.releaseOperatorLease,
    getPublicationReconciliationReadiness: publicationReconciliation.getPublicationReconciliationReadiness,
    listSocialAttempts: socialEngagement.listSocialAttempts,
    listGrowthRuns: store.listGrowthRuns,
    finishGrowthRun: growthRun.finishGrowthRun,
    getGrowthOperatorDelegation: store.getGrowthOperatorDelegation,
    getAccountHealthSummary: store.getAccountHealthSummary,
    discoveryBlock: discoverySchedule.discoveryBlock,
    growthScheduleConfig: growthConfig.growthScheduleConfig,
    getGrowthProductPolicy: store.getGrowthProductPolicy,
    activityWindow: activityPolicy.activityWindow,
    getDiscoverSnapshot: store.getDiscoverSnapshot,
    refreshDiscoverySource: (kind) => sourceRefresh.refreshSourceSnapshot(kind),
    buildScoutCards: scout.buildScoutCards,
    readScoutInput: scout.readScoutInput,
    listEngagementItems: store.listEngagementItems,
    listQueueItems: store.listQueueItems,
    readXMentions: () => xReads.xRead({ kind: 'mentions' }),
    refreshEngagementOpportunities: engagement.refreshEngagementOpportunities,
  };
}

function unfinishedSocialAttempts(deps) {
  const attempts = deps.listSocialAttempts({ limit: SOCIAL_ATTEMPT_LIMIT });
  return (Array.isArray(attempts) ? attempts : [])
    .filter((attempt) => UNFINISHED_SOCIAL_STATE_SET.has(attempt?.state));
}

// A dependency call that must never abort the session: collection failures are
// reported as degraded evidence, not as a thrown preflight.
async function attempt(call, fallback) {
  try {
    return await call();
  } catch (error) {
    return fallback(String(error?.message || error));
  }
}

function snapshotAge(snapshot, now) {
  return snapshot?.fetchedAt ? now - Number(snapshot.fetchedAt) : Infinity;
}

export async function runLiveSessionPreflight(options = {}) {
  const now = options.now == null ? Date.now() : Number(options.now);
  const env = options.env || process.env;
  const minRemainingBlockMs = options.minRemainingBlockMs == null
    ? DEFAULT_MIN_REMAINING_BLOCK_MS
    : Number(options.minRemainingBlockMs);
  const deps = options.deps || await loadDefaultDeps();

  // 1. Another operator owns the account. Never allocate a tab or a child.
  const lease = deps.getOperatorLeaseStatus({ now });
  if (lease.active) {
    return {
      action: 'skip',
      reason: 'operator_lease_active',
      detail: {
        runId: lease.runId || null,
        sessionId: lease.sessionId || null,
        expiresAt: lease.expiresAt || null,
      },
    };
  }

  // The block is read once and reused, so the schedule cannot shift mid-check.
  let blockCache = null;
  const currentBlock = () => {
    if (!blockCache) blockCache = deps.discoveryBlock({ now, schedule: deps.growthScheduleConfig(env) });
    return blockCache;
  };

  // 2. Unfinished attempts outrank rest, health and idle gates.
  const reconciliation = deps.getPublicationReconciliationReadiness();
  const unfinishedSocial = unfinishedSocialAttempts(deps);
  if (Number(reconciliation?.activeCount || 0) > 0 || unfinishedSocial.length > 0) {
    return {
      action: 'run',
      mode: 'recovery',
      reason: 'unfinished_attempts',
      block: currentBlock(),
      precollected: null,
    };
  }

  // 3. No active lease and zero unfinished attempts: any active run is an
  // abandoned crash with no in-flight send, so close it before starting.
  const healedRunIds = [];
  for (const run of deps.listGrowthRuns({ status: 'active', limit: 20 })) {
    try {
      deps.finishGrowthRun(run.runId, {
        status: 'partial',
        stopReason: 'capability_unavailable',
        stopDetail: ABANDONED_RUN_DETAIL,
        now,
      });
      healedRunIds.push(run.runId);
    } catch (error) {
      console.error(`Live session preflight could not close abandoned run ${run.runId}: ${String(error?.message || error)}`);
    }
  }

  // 4. Delegation and account health.
  const grant = deps.getGrowthOperatorDelegation();
  if (grant?.state !== 'running' || grant?.mode !== 'live') {
    return { action: 'skip', reason: 'delegation_inactive', healedRunIds };
  }
  const healthSummary = deps.getAccountHealthSummary({ now });
  if (healthSummary?.health?.state === 'constrained') {
    return { action: 'skip', reason: 'account_health_constrained', healedRunIds };
  }

  // 5. Rest window: only a measured breakout justifies a session.
  const block = currentBlock();
  const policy = deps.getGrowthProductPolicy();
  const window = deps.activityWindow({ now, env, policy });
  if (window.rest) {
    const momentumSnap = deps.getDiscoverSnapshot('x_momentum');
    if (snapshotAge(momentumSnap, now) < block.restWatchMinutes * 60_000) {
      return { action: 'skip', reason: 'rest_window', block, healedRunIds };
    }
    let momentumError = null;
    try {
      await deps.refreshDiscoverySource('x_momentum', { now });
    } catch (error) {
      momentumError = String(error?.message || error);
    }
    const { pace } = deps.buildScoutCards(deps.readScoutInput(deps.store, { now }));
    if (Number(pace?.urgentCandidates || 0) < 1) {
      return { action: 'skip', reason: 'rest_watch_no_breakout', block, healedRunIds };
    }
    return {
      action: 'run',
      mode: 'rest_breakout',
      reason: 'measured_breakout',
      block,
      healedRunIds,
      precollected: { stream: 'momentum', momentumRefreshed: !momentumError, momentumError },
    };
  }

  // 6. Too little of the block left to finish a bounded pass.
  if (block.endsAt - now < minRemainingBlockMs) {
    return { action: 'skip', reason: 'block_nearly_elapsed', block, healedRunIds };
  }

  // 7. Awake: collect what the child would otherwise collect first.
  const mentions = await attempt(() => deps.readXMentions(),
    (error) => ({ ok: false, error }));
  const engage = await attempt(() => deps.refreshEngagementOpportunities({
    now, refreshResponses: true, refreshTargetTimelines: false,
  }), (error) => ({ errors: [error] }));
  const engageErrors = Array.isArray(engage?.errors) ? engage.errors : [];
  const mentionsOk = mentions?.ok === true;
  const mentionsCount = Array.isArray(mentions?.posts) ? mentions.posts.length : 0;

  if (block.stream === 'forYou') {
    return {
      action: 'run',
      mode: 'single_block',
      reason: 'for_you_block',
      block,
      healedRunIds,
      precollected: {
        stream: 'forYou',
        mentionsOk,
        mentionsCount,
        engageRefreshed: engageErrors.length === 0,
        engageErrors,
      },
    };
  }

  let momentumError = null;
  try {
    await deps.refreshDiscoverySource('x_momentum', { now });
  } catch (error) {
    momentumError = String(error?.message || error);
  }
  const builderRefreshMs = Number(block.builderRefreshMinutes || 0) * 60_000;
  const staleBuilders = ['github_trending', 'hn_top']
    .filter((kind) => snapshotAge(deps.getDiscoverSnapshot(kind), now) >= builderRefreshMs);
  await Promise.all(staleBuilders.map((kind) => attempt(() => deps.refreshDiscoverySource(kind, { now }), () => null)));

  const { cards } = deps.buildScoutCards({ ...deps.readScoutInput(deps.store, { now }), limit: 12 });
  const t1Count = (Array.isArray(cards) ? cards : []).filter((card) => card?.tier === 'T1').length;
  const engagementItems = deps.listEngagementItems({ status: 'new', limit: 20 });
  const draftingItems = deps.listEngagementItems({ status: 'drafting', limit: 20 })
    .filter((item) => item?.engagement?.expiry?.effectiveExpired !== true);
  const approvedQueue = deps.listQueueItems({ status: 'approved', limit: 5 });
  const needsReviewQueue = deps.listQueueItems({ status: 'needs_review', limit: 5 });
  const collectionDegraded = !mentionsOk || engageErrors.length > 0 || Boolean(momentumError);
  if (t1Count === 0 && engagementItems.length === 0 && draftingItems.length === 0
    && approvedQueue.length === 0 && needsReviewQueue.length === 0 && !collectionDegraded) {
    return { action: 'skip', reason: 'momentum_no_eligible_work', block, healedRunIds };
  }
  return {
    action: 'run',
    mode: 'single_block',
    reason: 'momentum_work_available',
    block,
    healedRunIds,
    precollected: {
      stream: 'momentum',
      mentionsOk,
      mentionsCount,
      engageRefreshed: engageErrors.length === 0,
      engageErrors,
      momentumRefreshed: !momentumError,
      momentumError: momentumError || null,
      t1Count,
    },
  };
}

// A child that exits abnormally leaves its run active and its lease held. Close
// it only when nothing is in flight: an unfinished attempt is never abandoned.
export async function reconcileExitedSessionRun({ sessionId, now = Date.now(), deps = null } = {}) {
  const resolved = deps || await loadDefaultDeps();
  const runs = resolved.listGrowthRuns({ status: 'active', limit: 10 })
    .filter((run) => run?.sessionId === sessionId);
  const reconciledRunIds = [];
  const releasedLeaseIds = [];
  if (!runs.length) return { reconciledRunIds, releasedLeaseIds };
  if (Number(resolved.getPublicationReconciliationReadiness()?.activeCount || 0) > 0) {
    return { reconciledRunIds, releasedLeaseIds };
  }
  if (unfinishedSocialAttempts(resolved).length > 0) return { reconciledRunIds, releasedLeaseIds };
  for (const run of runs) {
    try {
      resolved.finishGrowthRun(run.runId, {
        status: 'partial',
        stopReason: 'capability_unavailable',
        stopDetail: EXITED_SESSION_DETAIL,
        now,
      });
      reconciledRunIds.push(run.runId);
    } catch (error) {
      console.error(`Exited session could not close run ${run.runId}: ${String(error?.message || error)}`);
      continue;
    }
    if (!run.leaseId) continue;
    try {
      resolved.releaseOperatorLease(run.leaseId);
      releasedLeaseIds.push(run.leaseId);
    } catch {
      // Already released by finishGrowthRun, or owned by another session.
    }
  }
  return { reconciledRunIds, releasedLeaseIds };
}
