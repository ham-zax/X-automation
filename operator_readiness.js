import { getAutonomousReplyGrant, getAutonomousReplyRuntime } from './autonomous_reply.js';
import { getGrowthOperatorMainFeedStatus } from './autonomous_main_feed.js';
import { getGrowthAgentRuntimeStatus, getGrowthAgentSchedulerStatus } from './growth_agent_runtime.js';
import { getOperatorLeaseStatus } from './operator_lease.js';
import { getPublicationReconciliationReadiness } from './publication_reconciliation.js';
import { getXApiPipelineCapability } from './x_api_publish.js';
import { getXForYouSensorStatus } from './x_discovery.js';
import {
  getAccountHealthSummary,
  getAppState,
  getDiscoverSnapshot,
  getGrowthOperatorDelegation,
  listGrowthRuns,
  listPublicationAttempts,
} from './store.js';

const AUTOMATION_RUNTIME_STATE_KEY = 'automation_runtime';
const SOURCE_FRESHNESS_MINUTES = Object.freeze({
  x_for_you: 45,
  x_latest: 60,
  x_momentum: 60,
  x_creator_latest: 90,
  github_trending: 180,
  hn_top: 180,
});

function readJsonState(key) {
  try {
    const raw = getAppState(key, null);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function sourceStatus(kind, now) {
  const snapshot = getDiscoverSnapshot(kind);
  const maxAgeMinutes = SOURCE_FRESHNESS_MINUTES[kind] || 120;
  const ageMinutes = snapshot.fetchedAt == null ? null : Math.max(0, (now - Number(snapshot.fetchedAt)) / 60_000);
  return {
    kind,
    fetchedAt: snapshot.fetchedAt,
    count: snapshot.candidates.length,
    ageMinutes,
    maxAgeMinutes,
    fresh: ageMinutes != null && ageMinutes <= maxAgeMinutes,
    lastRefreshAttemptAt: snapshot.lastRefreshAttemptAt,
    error: snapshot.error,
  };
}

function automationStatus(now) {
  const state = readJsonState(AUTOMATION_RUNTIME_STATE_KEY);
  const cycleStartedAt = Number(state.cycleStartedAt || 0) || null;
  const cycleFinishedAt = Number(state.cycleFinishedAt || 0) || null;
  const heartbeatAt = Math.max(cycleStartedAt || 0, cycleFinishedAt || 0) || null;
  const staleAfterMinutes = 2 * Number(process.env.POLL_MINUTES || 30) + 10;
  return {
    inProgress: state.inProgress === true,
    cycleStartedAt,
    cycleFinishedAt,
    lastHealthyCompletionAt: Number(state.lastHealthyCompletionAt || 0) || null,
    latestError: state.latestError || null,
    heartbeatAt,
    stale: !heartbeatAt || now - heartbeatAt > staleAfterMinutes * 60_000,
    staleAfterMinutes,
  };
}

export function getOperatorReadiness({ now = Date.now(), operatorLeaseId = null } = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('Operator readiness requires numeric now.');
  const delegation = getGrowthOperatorDelegation();
  const replyGrant = getAutonomousReplyGrant();
  const replyRuntime = getAutonomousReplyRuntime();
  const lease = getOperatorLeaseStatus({ now: timestamp });
  const runtime = getGrowthAgentRuntimeStatus({ now: timestamp });
  const scheduler = getGrowthAgentSchedulerStatus();
  const reconciliation = getPublicationReconciliationReadiness();
  const accountHealth = getAccountHealthSummary({ now: timestamp }).health;
  const forYou = sourceStatus('x_for_you', timestamp);
  const forYouSensor = getXForYouSensorStatus();
  const activeRun = listGrowthRuns({ status: 'active', limit: 1 })[0] || null;
  const latestRun = listGrowthRuns({ limit: 20 }).find((run) => run.status !== 'active') || null;
  const latestRunPublications = latestRun
    ? listPublicationAttempts({ runId: latestRun.runId, limit: 100 }).filter((attempt) => attempt.state === 'confirmed_published')
    : [];
  const latestRunActions = latestRunPublications.reduce((counts, attempt) => {
    const key = attempt.actionType === 'reply' ? 'replies'
      : attempt.actionType === 'quote' ? 'quotes'
        : attempt.actionType === 'repost' ? 'reposts' : 'originals';
    counts[key] += 1;
    counts.total += 1;
    return counts;
  }, { replies: 0, quotes: 0, reposts: 0, originals: 0, total: 0 });
  const apiPipelines = Object.fromEntries(['original', 'thread', 'quote', 'repost'].map((pipeline) => [
    pipeline,
    getXApiPipelineCapability(pipeline),
  ]));
  const browserCapabilities = runtime.capabilities || {};
  const browserAccountExpected = String(process.env.X_ACCOUNT || 'ham_zax').replace(/^@/, '').toLowerCase();
  const liveRuntimeAccount = runtime.attached ? String(runtime.accountHandle || '') : '';
  const browserAccountObserved = String(liveRuntimeAccount || forYouSensor?.accountHandle || '').replace(/^@/, '').toLowerCase();
  const browserAccountVerified = Boolean(browserAccountObserved && browserAccountObserved === browserAccountExpected);
  const mainFeed = getGrowthOperatorMainFeedStatus({ now: timestamp, operatorLeaseId });
  return {
    generatedAt: timestamp,
    permission: {
      state: delegation.state,
      mode: delegation.mode,
      revision: delegation.revision,
      startedAt: delegation.startedAt || null,
      live: delegation.state === 'running' && delegation.mode === 'live',
      mainFeedDelegated: delegation.state === 'running' && delegation.mode === 'live',
      autonomousReply: {
        state: replyGrant.state,
        mode: replyGrant.mode,
        revision: replyGrant.revision,
        remainingBudget: replyGrant.liveBudget == null ? null : Math.max(0, Number(replyGrant.liveBudget) - Number(replyGrant.budgetUsed || 0)),
      },
    },
    accountHealth: {
      state: accountHealth.state,
      constrained: accountHealth.state === 'constrained',
      reasons: accountHealth.reasons || [],
    },
    reasoningAgent: {
      ...runtime,
      operatorLease: lease,
      activeRunId: activeRun?.runId || '',
      activeRunStage: activeRun?.stage || null,
    },
    sensors: {
      xForYou: {
        ...forYou,
        provenance: forYouSensor,
        authenticatedAccountVerified: Boolean(forYouSensor?.accountVerified === true
          && String(forYouSensor.accountHandle || '').toLowerCase() === browserAccountExpected),
      },
      xLatest: sourceStatus('x_latest', timestamp),
      xMomentum: sourceStatus('x_momentum', timestamp),
      xCreatorLatest: sourceStatus('x_creator_latest', timestamp),
      githubTrending: sourceStatus('github_trending', timestamp),
      hnTop: sourceStatus('hn_top', timestamp),
    },
    transports: {
      autoPostConfigured: String(process.env.AUTO_POST || 'false').toLowerCase() === 'true',
      xApi: {
        credentialsPresent: Boolean(String(process.env.X_API_ACCESS_TOKEN || '').trim()),
        pipelines: apiPipelines,
      },
      browserAgent: {
        runtimeAttached: runtime.attached,
        browserRead: browserCapabilities.browser_read === true,
        browserMutation: browserCapabilities.browser_mutation === true,
        xAuthenticated: browserCapabilities.x_authenticated === true,
        accountExpected: browserAccountExpected,
        accountObserved: browserAccountObserved || null,
        accountVerified: browserAccountVerified,
      },
    },
    reconciliation,
    scheduler: {
      growthAgent: scheduler,
      backgroundAutomation: automationStatus(timestamp),
      autonomousReplyNextExpectedRefreshAt: replyRuntime.nextExpectedRefreshAt || null,
    },
    lastRun: latestRun ? {
      runId: latestRun.runId,
      status: latestRun.status,
      stopReason: latestRun.stopReason || null,
      startedAt: latestRun.startedAt,
      finishedAt: latestRun.finishedAt,
      actions: latestRunActions,
    } : null,
    mainFeed: mainFeed.preparation,
  };
}
