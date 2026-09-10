import { getAppState, setAppState } from './store.js';

const RUNTIME_STATE_KEY = 'growth_agent_runtime_v1';
const SCHEDULER_STATE_KEY = 'growth_agent_scheduler_v1';
const DEFAULT_HEARTBEAT_TTL_MS = 5 * 60_000;

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

export function getGrowthAgentRuntimeStatus({ now = Date.now() } = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('Growth agent runtime status requires numeric now.');
  const state = readJsonState(RUNTIME_STATE_KEY);
  const lastSeenAt = Number(state.lastSeenAt || 0) || null;
  const expiresAt = Number(state.expiresAt || 0) || null;
  return {
    attached: Boolean(lastSeenAt && expiresAt && expiresAt > timestamp),
    adapterType: String(state.adapterType || ''),
    sessionId: String(state.sessionId || ''),
    runId: String(state.runId || ''),
    accountHandle: String(state.accountHandle || ''),
    capabilities: state.capabilities && typeof state.capabilities === 'object' && !Array.isArray(state.capabilities)
      ? state.capabilities
      : {},
    lastSeenAt,
    expiresAt,
    lastError: state.lastError ? String(state.lastError) : null,
  };
}

export function heartbeatGrowthAgentRuntime({
  adapterType,
  sessionId,
  runId = '',
  accountHandle = '',
  capabilities = {},
  lastError = null,
  now = Date.now(),
  ttlMs = DEFAULT_HEARTBEAT_TTL_MS,
} = {}) {
  const timestamp = Number(now);
  const ttl = Number(ttlMs);
  if (!Number.isFinite(timestamp) || !Number.isFinite(ttl) || ttl <= 0) {
    throw new Error('Growth agent runtime heartbeat requires numeric now and positive ttlMs.');
  }
  const adapter = String(adapterType || '').trim();
  const session = String(sessionId || '').trim();
  if (!adapter || !session) throw new Error('Growth agent runtime heartbeat requires adapterType and sessionId.');
  const normalizedCapabilities = capabilities && typeof capabilities === 'object' && !Array.isArray(capabilities)
    ? Object.fromEntries(Object.entries(capabilities).map(([key, value]) => [String(key), value === true]))
    : {};
  const state = {
    adapterType: adapter,
    sessionId: session,
    runId: String(runId || ''),
    accountHandle: String(accountHandle || '').replace(/^@/, ''),
    capabilities: normalizedCapabilities,
    lastSeenAt: timestamp,
    expiresAt: timestamp + ttl,
    lastError: lastError == null ? null : String(lastError),
  };
  setAppState(RUNTIME_STATE_KEY, JSON.stringify(state));
  return getGrowthAgentRuntimeStatus({ now: timestamp });
}

export function detachGrowthAgentRuntime({ now = Date.now() } = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('Growth agent runtime detach requires numeric now.');
  const current = readJsonState(RUNTIME_STATE_KEY);
  setAppState(RUNTIME_STATE_KEY, JSON.stringify({
    ...current,
    runId: '',
    capabilities: {},
    lastSeenAt: timestamp,
    expiresAt: timestamp,
  }));
  return getGrowthAgentRuntimeStatus({ now: timestamp });
}

export function getGrowthAgentSchedulerStatus() {
  const state = readJsonState(SCHEDULER_STATE_KEY);
  return {
    configured: state.configured === true,
    enabled: state.enabled === true,
    lastInvocationAt: Number(state.lastInvocationAt || 0) || null,
    lastInvocationResult: state.lastInvocationResult || null,
    activeRunId: String(state.activeRunId || ''),
    nextInvocationAt: Number(state.nextInvocationAt || 0) || null,
    lastError: state.lastError ? String(state.lastError) : null,
  };
}

export function updateGrowthAgentSchedulerStatus(patch = {}) {
  const current = readJsonState(SCHEDULER_STATE_KEY);
  const next = {
    ...current,
    ...patch,
  };
  setAppState(SCHEDULER_STATE_KEY, JSON.stringify(next));
  return getGrowthAgentSchedulerStatus();
}
