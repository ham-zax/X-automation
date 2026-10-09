// Opportunity-driven autonomous activity policy.
// Temporal rest is real (not random delays to impersonate human behavior).
// Independently observed fast momentum or verified first-hand breaking news can
// override rest/cadence. Neither bypasses publishing authority or factual checks.

import { DEFAULT_GROWTH_POLICY } from './growth_product_policy.js';

const MINUTE = 60_000;
const DEFAULT_TZ = 'Asia/Kolkata';
const DEFAULT_SLEEP_START = '01:00';
const DEFAULT_SLEEP_END = '08:30';
const URGENT_TYPES = new Set(['verified_major_launch', 'verified_breakthrough']);

function clockMinutes(value, fallback) {
  const text = String(value || fallback);
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) return clockMinutes(fallback, fallback);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return clockMinutes(fallback, fallback);
  return h * 60 + m;
}

export function activityWindow({ now = Date.now(), env = process.env, policy = null } = {}) {
  const settings = policy?.activity || null;
  const timeZone = String(settings?.timeZone || env.X_GROWTH_OWNER_TIMEZONE || DEFAULT_TZ);
  const startMinutes = clockMinutes(settings?.sleepStart || env.X_GROWTH_SLEEP_START, DEFAULT_SLEEP_START);
  const endMinutes = clockMinutes(settings?.sleepEnd || env.X_GROWTH_SLEEP_END, DEFAULT_SLEEP_END);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(now)).map(({ type, value }) => [type, value]));
  const localMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const rest = startMinutes <= endMinutes
    ? localMinutes >= startMinutes && localMinutes < endMinutes
    : localMinutes >= startMinutes || localMinutes < endMinutes;
  return {
    timeZone, sleepStart: settings?.sleepStart || env.X_GROWTH_SLEEP_START || DEFAULT_SLEEP_START,
    sleepEnd: settings?.sleepEnd || env.X_GROWTH_SLEEP_END || DEFAULT_SLEEP_END,
    localTime: `${parts.hour}:${parts.minute}`, rest,
  };
}

// A post can explode without ever being labeled a particular "viral tier".
// Derive urgency only from recent, independently stored X metrics. No single
// stale lifetime view count qualifies; old popularity is not a fresh breakout.
export function observedBreakout({ momentum, postCreatedAt, now = Date.now(), policy = DEFAULT_GROWTH_POLICY } = {}) {
  const b = policy.breakthrough;
  if (!b.enabled) return null;
  const current = momentum?.current;
  const metrics = current?.metrics || {};
  const observedAge = now - Number(current?.observedAt || 0);
  const postAge = now - Number(postCreatedAt || 0);
  if (!(observedAge >= 0 && observedAge <= b.recentObservationMinutes * MINUTE)) return null;
  // Repeated observations can prove that even an older post is exploding NOW.
  // A single snapshot instead needs a young post to avoid treating total
  // lifetime popularity as a sudden event.
  const interval = Number(momentum?.intervalMs || 0);
  const likeDelta = Number(momentum?.deltas?.likes?.delta);
  const replyDelta = Number(momentum?.deltas?.replies?.delta);
  if (interval >= b.deltaMinimumMinutes * MINUTE && interval <= b.deltaMaximumMinutes * MINUTE
    && likeDelta >= b.deltaLikes && replyDelta >= b.deltaReplies
    && (likeDelta / (interval / MINUTE)  >= b.minLikesPerMinute)
    && (replyDelta / (interval / MINUTE)  >= b.minRepliesPerMinute)) {
    return { kind: 'measured_breakout', basis: 'measured_engagement_acceleration',
      sourceUrl: momentum.candidateKey, observedAt: current.observedAt,
      intervalMinutes: Math.round(interval / MINUTE), newLikes: likeDelta,
      newReplies: replyDelta };
  }
  const likes = Number(metrics.likes);
  const replies = Number(metrics.replies);
  const ageMinutes = postAge / MINUTE;
  if (postAge >= 0 && postAge <= b.shortPostAgeMinutes * MINUTE
    && Number.isFinite(likes) && Number.isFinite(replies)
    && ((ageMinutes <= b.shortBurstMinutes && likes >= b.shortLikes && replies >= b.shortReplies)
      || (ageMinutes <= b.extendedBurstMinutes && likes >= b.extendedLikes && replies >= b.extendedReplies))) {
    return { kind: 'measured_breakout', basis: 'recent_engagement_density',
      sourceUrl: momentum.candidateKey, observedAt: current.observedAt,
      likes, replies, postAgeMinutes: Math.round(ageMinutes) };
  }
  return null;
}

const httpUrl = (v) => typeof v === 'string' && /^https:\/\/[^\s/?#]+\.[^\s/?#]+\//.test(v);
const meaningful = (v, min) => typeof v === 'string' && v.trim().length >= min;

export function editorialEvidence(action, editorial, { policy = DEFAULT_GROWTH_POLICY, audienceSelectivity = 100 } = {}) {
  if (action === 'reply') return { valid: true, reason: 'replies_are_conversational' };
  if (!['original', 'quote', 'thread', 'repost'].includes(action)) return { valid: false, reason: 'unsupported_action' };
  if (!editorial || typeof editorial !== 'object' || Array.isArray(editorial)) {
    return { valid: false, reason: 'main_feed_editorial_evidence_required' };
  }
  if (!meaningful(editorial.whyNow, 30) || !meaningful(editorial.distinctContribution, 35)
    || !meaningful(editorial.intendedAudience, 16) || !meaningful(editorial.whyNotReply, 28)
    || !Array.isArray(editorial.sourceUrls) || !editorial.sourceUrls.some(httpUrl)) {
    return { valid: false, reason: 'main_feed_needs_sources_why_now_distinct_value_audience_and_reason_not_to_reply' };
  }
  // Deterministic *evidence completeness*, not a subjective truth/quality score.
  // Luna must still verify each cited claim and the distinct contribution.
  const completeness = [
    editorial.whyNow.length >= 55 ? 20 : 10,
    editorial.distinctContribution.length >= 85 ? 25 : 12,
    editorial.intendedAudience.length >= 35 ? 15 : 8,
    editorial.whyNotReply.length >= 60 ? 20 : 10,
    editorial.sourceUrls.some(httpUrl) ? 20 : 0,
  ].reduce((a,b)=>a+b,0);
  const minimum = Math.round(Number(policy.lanes[action]?.editorialMinimum ?? 75)
    * Math.max(0, Math.min(100, audienceSelectivity)) / 100);
  return completeness >= minimum
    ? { valid: true, reason: 'editorial_evidence_present', completeness, minimum }
    : { valid: false, reason: `insufficient_main_feed_editorial_evidence_${completeness}_below_${minimum}`, completeness, minimum };
}

export function verifiedBreakingEvent(editorial, { now = Date.now(), policy = DEFAULT_GROWTH_POLICY } = {}) {
  if (!policy.breakthrough.enabled) return null;
  const urgent = editorial?.urgency;
  if (!urgent || !URGENT_TYPES.has(urgent.kind)) return null;
  const seen = Number(urgent.verifiedAt);
  if (!(seen > 0 && seen <= now && now - seen <= policy.breakthrough.verifiedEventMinutes * MINUTE)) return null;
  if (!meaningful(urgent.whatChanged, 40) || !meaningful(urgent.whyImmediate, 35)) return null;
  if (!Array.isArray(editorial?.sourceUrls) || !editorial.sourceUrls.some(httpUrl)) return null;
  return { kind: urgent.kind, basis: 'agent_verified_primary_source',
    sourceUrls: editorial.sourceUrls.filter(httpUrl), verifiedAt: seen };
}

// Only run-bound automation is affected: an explicit human manual publication
// outside a Growth Run is not silently re-scheduled by an AI lifestyle model.
export function evaluateActivity({ action, now = Date.now(), env = process.env,
  editorial = null, momentum = null, postCreatedAt = null, runBound = true,
  policy = DEFAULT_GROWTH_POLICY, audienceSelectivity = 100 } = {}) {
  const window = activityWindow({ now, env, policy });
  if (!runBound) return { allowed: true, window, urgent: null, reason: 'manual_action' };
  const evidence = editorialEvidence(action, editorial, { policy, audienceSelectivity });
  if (!evidence.valid) return { allowed: false, window, urgent: null, reason: evidence.reason };
  const urgent = observedBreakout({ momentum, postCreatedAt, now, policy })
    || verifiedBreakingEvent(editorial, { now, policy });
  if (window.rest && !urgent) {
    return { allowed: false, window, urgent: null, reason: 'rest_hours_no_verified_breakout' };
  }
  return { allowed: true, window, urgent, reason: urgent ? 'urgent_breakout_override' : 'ordinary_waking_hours' };
}
