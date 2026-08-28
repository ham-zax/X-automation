import { randomUUID } from 'node:crypto';
import { getAppState, setAppState } from './store.js';

const OPERATOR_LEASE_STATE_KEY = 'chatgpt_operator_lease';
const OPERATOR_LEASE_TTL_MS = 15 * 60_000;
const OPERATOR_LEASE_TTL_MINUTES = OPERATOR_LEASE_TTL_MS / 60_000;

function timestamp(value) {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error('Operator lease timestamp must be numeric.');
  return result;
}

function readOperatorLease() {
  const raw = getAppState(OPERATOR_LEASE_STATE_KEY, null);
  if (!raw) return null;
  const lease = JSON.parse(raw);
  if (!lease || typeof lease !== 'object' || Array.isArray(lease)) return null;
  if (typeof lease.leaseId !== 'string' || !lease.leaseId) return null;
  const acquiredAt = Number(lease.acquiredAt);
  const expiresAt = Number(lease.expiresAt);
  if (!Number.isFinite(acquiredAt) || !Number.isFinite(expiresAt)) return null;
  return { leaseId: lease.leaseId, acquiredAt, expiresAt };
}

function requireLeaseId(leaseId) {
  if (typeof leaseId !== 'string' || !leaseId) throw new Error('leaseId is required.');
  return leaseId;
}

function activeLease(now) {
  const lease = readOperatorLease();
  return lease && lease.expiresAt > now ? lease : null;
}

export function getOperatorLeaseStatus({ now = Date.now() } = {}) {
  const currentAt = timestamp(now);
  const lease = readOperatorLease();
  const active = Boolean(lease && lease.expiresAt > currentAt);
  return {
    status: active ? 'active' : (lease ? 'expired' : 'none'),
    active,
    acquiredAt: lease?.acquiredAt ?? null,
    expiresAt: lease?.expiresAt ?? null,
    ttlMinutes: OPERATOR_LEASE_TTL_MINUTES,
  };
}

export function acquireOperatorLease({ now = Date.now() } = {}) {
  const acquiredAt = timestamp(now);
  if (activeLease(acquiredAt)) throw new Error('An interactive operator lease is already active.');
  const lease = {
    leaseId: randomUUID(),
    acquiredAt,
    expiresAt: acquiredAt + OPERATOR_LEASE_TTL_MS,
  };
  setAppState(OPERATOR_LEASE_STATE_KEY, JSON.stringify(lease));
  return { ...lease, ttlMinutes: OPERATOR_LEASE_TTL_MINUTES };
}

export function renewOperatorLease(leaseId, { now = Date.now() } = {}) {
  const currentAt = timestamp(now);
  const expectedLeaseId = requireLeaseId(leaseId);
  const lease = activeLease(currentAt);
  if (!lease || lease.leaseId !== expectedLeaseId) throw new Error('leaseId does not match the active interactive operator lease.');
  const renewed = {
    ...lease,
    expiresAt: currentAt + OPERATOR_LEASE_TTL_MS,
  };
  setAppState(OPERATOR_LEASE_STATE_KEY, JSON.stringify(renewed));
  return { ...renewed, ttlMinutes: OPERATOR_LEASE_TTL_MINUTES };
}

export function releaseOperatorLease(leaseId, { now = Date.now() } = {}) {
  const currentAt = timestamp(now);
  const expectedLeaseId = requireLeaseId(leaseId);
  const lease = activeLease(currentAt);
  if (!lease || lease.leaseId !== expectedLeaseId) throw new Error('leaseId does not match the active interactive operator lease.');
  setAppState(OPERATOR_LEASE_STATE_KEY, JSON.stringify(null));
  return { released: true, releasedAt: currentAt };
}
