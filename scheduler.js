import { applyAcceptedLearnedRules } from './learning.js';

const HOUR_MS = 3_600_000;
const MAIN_FEED_LANES = new Set(['main', 'main_feed']);
const MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread', 'repost']);
const AUTOMATED_MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread']);
const URGENCY_MODIFIERS = { evergreen: 0, timely: 7, viral: 15 };
const SEMANTIC_CONFLICT_THRESHOLD = 0.50;

export const SCHEDULER_EMPIRICAL_ASSUMPTIONS = Object.freeze([
  Object.freeze({
    code: 'ORDINARY_SPACING',
    classification: 'EMPIRICAL_VARIABLE',
    hours: 3,
    note: 'Coverage target, not an X platform rule or enforcement threshold.',
  }),
  Object.freeze({
    code: 'EVERGREEN_SPACING',
    classification: 'EMPIRICAL_VARIABLE',
    preferredHours: [4, 6],
    note: 'Editorial coverage preference; the upper end is used when the previous post is observably accelerating.',
  }),
  Object.freeze({
    code: 'VIRAL_HARD_FLOOR',
    classification: 'EMPIRICAL_VARIABLE',
    hours: null,
    note: 'No hard minimum interval is inferred for approved viral content with short shelf-life.',
  }),
]);

function field(item, camel, snake) {
  return item?.[camel] ?? item?.[snake];
}

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requireNow(context) {
  const now = finiteNumber(context?.now ?? context?.currentTime ?? context?.current_time);
  if (now == null) throw new Error('Scheduler context requires numeric now/currentTime.');
  return now;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function missionBreakout(item) {
  return approvalAuthorityOf(item)?.type === 'mission_agent'
    && String(item?.candidate?.viral?.tier || '').toLowerCase() === 'breakout';
}

function urgencyOf(item) {
  const urgency = String(item?.urgency || '').toLowerCase();
  if (Object.hasOwn(URGENCY_MODIFIERS, urgency) && urgency !== 'evergreen') return urgency;
  if (missionBreakout(item)) return 'viral';
  return Object.hasOwn(URGENCY_MODIFIERS, urgency) ? urgency : 'evergreen';
}

function expiresAtOf(item) {
  return finiteNumber(field(item, 'expiresAt', 'expires_at'));
}

function publishedAtOf(item) {
  return finiteNumber(field(item, 'publishedAt', 'published_at'));
}

function approvedAtOf(item) {
  return finiteNumber(field(item, 'humanApprovedAt', 'human_approved_at'));
}

function approvalRecordedAtOf(item) {
  return approvedAtOf(item) ?? finiteNumber(item?.approvalSnapshot?.approvedAt);
}

function approvalAuthorityOf(item) {
  if (approvedAtOf(item) != null) return { type: 'human' };
  return item?.approvalAuthority ?? item?.approvalSnapshot?.authority ?? null;
}

function humanOverrideAtOf(item) {
  return finiteNumber(field(item, 'humanScheduleOverrideAt', 'human_schedule_override_at'));
}

function gatesPassed(item) {
  return item?.gatesPassed === true
    || item?.hardGatesPassed === true
    || item?.gates?.passed === true;
}

function isPublished(item) {
  return item?.published === true
    || publishedAtOf(item) != null
    || field(item, 'publishedTweetId', 'published_tweet_id') != null;
}

function addIssue(target, code, message) {
  target.push({ code, message });
}

function scoreValue(item, camel, snake) {
  return clamp(field(item, camel, snake));
}

function qualityNormalized(item) {
  const normalized = finiteNumber(field(item, 'qualityNormalized', 'quality_normalized'));
  if (normalized != null) return clamp(normalized);
  return clamp(Number(field(item, 'qualityScore', 'quality_score') || 0) * 2);
}

function expiryModifier(item, now) {
  const expiresAt = expiresAtOf(item);
  if (expiresAt == null) return { modifier: 0, remainingHours: null };
  const remainingHours = (expiresAt - now) / HOUR_MS;
  if (remainingHours <= 0) return { modifier: 0, remainingHours };
  if (remainingHours <= 1) return { modifier: 15, remainingHours };
  if (remainingHours <= 3) return { modifier: 10, remainingHours };
  if (remainingHours <= 6) return { modifier: 5, remainingHours };
  return { modifier: 0, remainingHours };
}

function tokenSet(text) {
  return new Set(String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9+.#-]{2,}/g) || []);
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const value of left) if (right.has(value)) overlap++;
  return overlap / Math.max(1, new Set([...left, ...right]).size);
}

function textOf(item) {
  if (typeof item === 'string') return item;
  if (Array.isArray(item?.threadParts)) return item.threadParts[0] || '';
  return item?.text || item?.body || item?.finalText || '';
}

function topicSet(item) {
  const values = [];
  for (const value of [item?.topic, ...(item?.topics || []), ...(item?.semanticAnchors || item?.semantic_anchors || [])]) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized) values.push(normalized);
  }
  return new Set(values);
}

function stableKey(item) {
  return String(item?.id ?? item?.candidateKey ?? item?.candidate_key ?? item?.key ?? '');
}

function spacingTargetHours(item, previousPost = null) {
  if (urgencyOf(item) !== 'evergreen') return 3;
  return previousPost?.accelerating === true || previousPost?.isAccelerating === true ? 6 : 4;
}

function latestPublishedPost(recentPosts = [], lastMainFeedPostAt = null) {
  let latest = null;
  let latestAt = finiteNumber(lastMainFeedPostAt);
  for (const post of recentPosts || []) {
    const publishedAt = publishedAtOf(post);
    if (publishedAt != null && (latestAt == null || publishedAt >= latestAt)) {
      latestAt = publishedAt;
      latest = post;
    }
  }
  return { post: latest, publishedAt: latestAt };
}

function recentPriority(post, now) {
  const supplied = finiteNumber(post?.priority);
  if (supplied != null) return supplied;
  const hasScoreInput = [
    field(post, 'followPotential', 'follow_potential'),
    field(post, 'reachPotential', 'reach_potential'),
    field(post, 'conversationPotential', 'conversation_potential'),
    field(post, 'relationshipPotential', 'relationship_potential'),
    field(post, 'qualityScore', 'quality_score'),
    field(post, 'qualityNormalized', 'quality_normalized'),
  ].some((value) => finiteNumber(value) != null);
  if (!hasScoreInput) return null;
  const result = calculateSchedulePriority(post, { now });
  return round2(result.basePriority + result.urgencyModifier);
}

function assumptions() {
  return SCHEDULER_EMPIRICAL_ASSUMPTIONS.map((item) => ({
    ...item,
    ...(Array.isArray(item.preferredHours) ? { preferredHours: [...item.preferredHours] } : {}),
  }));
}

export function evaluateScheduleEligibility(item, context = {}) {
  const now = requireNow(context);
  const blockers = [];
  const lane = String(item?.lane || '');
  const pipeline = String(item?.pipeline || '');

  if (!MAIN_FEED_LANES.has(lane)) {
    addIssue(blockers, 'NOT_MAIN_FEED', `Lane ${lane || 'missing'} is not eligible for the main-feed scheduler.`);
  }
  if (item?.status !== 'approved') {
    addIssue(blockers, 'NOT_APPROVED', `Status ${item?.status || 'missing'} is not approved.`);
  }
  const authority = approvalAuthorityOf(item);
  if (approvedAtOf(item) == null) {
    if (authority?.type !== 'mission_agent') {
      addIssue(blockers, 'MISSING_APPROVAL_AUTHORITY', 'A valid human or delegated mission-agent approval is required.');
    } else {
      const snapshot = item?.approvalSnapshot || {};
      const verification = snapshot.verificationProvenance || {};
      const sourceReferences = Array.isArray(verification.sourceReferences)
        ? verification.sourceReferences.filter((value) => String(value || '').trim())
        : [];
      const grantRevision = Number(authority.grantRevision);
      const grant = item?.missionGrant || null;
      if (!AUTOMATED_MAIN_FEED_PIPELINES.has(pipeline) || authority.mission !== 'growth_operator') {
        addIssue(blockers, 'MISSION_APPROVAL_SCOPE_INVALID', 'Delegated Growth Operator authority is limited to automated Original, Quote, and Thread main-feed items.');
      }
      if (!Number.isInteger(grantRevision) || grantRevision < 1) {
        addIssue(blockers, 'MISSION_APPROVAL_REVISION_INVALID', 'Mission-agent approval must carry a positive grant revision.');
      }
      if (verification.authorityType !== 'mission_agent' || sourceReferences.length === 0 || !Array.isArray(verification.evidenceReferences)) {
        addIssue(blockers, 'MISSION_VERIFICATION_PROVENANCE_MISSING', 'Mission-agent approval requires inspectable source/evidence verification provenance.');
      }
      if (!grant || grant.state !== 'running' || grant.mode !== 'live' || Number(grant.revision) !== grantRevision) {
        addIssue(blockers, 'MISSION_AUTHORITY_STALE', 'The Growth Operator delegation is missing, paused, stopped, completed, non-live, or at a different revision.');
      } else {
        if (item?.missionAccountHealth?.state === 'constrained') {
          addIssue(blockers, 'MISSION_ACCOUNT_HEALTH_CONSTRAINED', 'Delegated Growth Operator publication is blocked while Account Health is constrained.');
        }
      }
    }
  }
  if (!MAIN_FEED_PIPELINES.has(pipeline)) {
    addIssue(blockers, 'UNSUPPORTED_PIPELINE', `Pipeline ${pipeline || 'missing'} is not a main-feed publication format.`);
  }
  if (!gatesPassed(item)) {
    addIssue(blockers, 'HARD_GATES_NOT_PASSED', 'Required content hard gates must be explicitly represented as passing.');
  }

  if (item?.approvalSnapshotMismatch === true) {
    addIssue(blockers, 'APPROVAL_SNAPSHOT_MISMATCH', item?.approvalMismatchReason || 'Current publication material differs from approved snapshot.');
  }

  if (item?.approvalInvalidatedAt != null || field(item, 'approvalInvalidatedAt', 'approval_invalidated_at') != null) {
    const reason = item?.approvalInvalidationReason || field(item, 'approvalInvalidationReason', 'approval_invalidation_reason') || 'content changed after approval';
    if (!blockers.some((b) => b.code === 'APPROVAL_SNAPSHOT_MISMATCH')) {
      addIssue(blockers, 'APPROVAL_INVALIDATED', `Approval invalidated: ${reason}`);
    }
  }

  if (item?.approvalSnapshot && Object.keys(item.approvalSnapshot).length === 0 && item?.status === 'approved' && approvedAtOf(item) != null) {
    addIssue(blockers, 'APPROVAL_SNAPSHOT_MISSING', 'Approved item predates snapshot binding, requires re-approval.');
  }

  const expiresAt = expiresAtOf(item);
  if (expiresAt != null && expiresAt <= now) {
    addIssue(blockers, 'EXPIRED', 'Item expiry is at or before the current scheduler time.');
  }
  if (isPublished(item)) {
    addIssue(blockers, 'ALREADY_PUBLISHED', 'Item already has published state and must not be scheduled again.');
  }

  return { eligible: blockers.length === 0, blockers };
}

export function calculateSchedulePriority(item, context = {}) {
  const now = requireNow(context);
  const follow = scoreValue(item, 'followPotential', 'follow_potential');
  const reach = scoreValue(item, 'reachPotential', 'reach_potential');
  const conversation = scoreValue(item, 'conversationPotential', 'conversation_potential');
  const relationship = scoreValue(item, 'relationshipPotential', 'relationship_potential');
  const quality = qualityNormalized(item);
  const basePriority = round2(
    follow * 0.30
      + reach * 0.25
      + conversation * 0.15
      + relationship * 0.10
      + quality * 0.20,
  );
  const urgency = urgencyOf(item);
  const urgencyModifier = URGENCY_MODIFIERS[urgency];
  const expiry = expiryModifier(item, now);
  const assignmentContext = item?.experimentAssignment?.context || item?.experiment_assignment?.context || {};
  const ruleContext = {
    format: String(item?.pipeline || ''),
    mediaType: item?.media?.type || 'none',
    topicTags: item?.topics || [],
    timingBucket: assignmentContext.timingBucket ?? assignmentContext.timing_bucket,
    style: assignmentContext.style,
    hookType: assignmentContext.hookType ?? assignmentContext.hook_type,
    urgency,
    ...context.learningContext,
    hardGatePassed: gatesPassed(item),
    expired: expiresAtOf(item) != null && expiresAtOf(item) <= now,
    humanApprovalRequired: true,
    humanApproved: approvedAtOf(item) != null,
    manualScheduleOverride: humanOverrideAtOf(item) != null,
  };
  const learningTargets = ['scheduler_timing_preference', 'content_preference', 'format_preference', 'topic_preference'];
  const learning = Object.fromEntries(learningTargets.map((target) => [target, applyAcceptedLearnedRules(0, context.learnedRules || [], ruleContext, {
    adjustmentTarget: target,
    reviewContext: context.learningReviewContext || {},
  })]));
  const rawLearnedAdjustment = round2(Object.values(learning).reduce((sum, applied) => sum + Number(applied.learnedAdjustment || 0), 0));
  const learnedAdjustment = round2(Math.max(-15, Math.min(15, rawLearnedAdjustment)));

  return {
    priority: round2(basePriority + urgencyModifier + expiry.modifier + learnedAdjustment),
    basePriority,
    urgency,
    urgencyModifier,
    expiryModifier: expiry.modifier,
    expiryRemainingHours: expiry.remainingHours == null ? null : round2(expiry.remainingHours),
    qualityNormalized: quality,
    rawLearnedAdjustment,
    learnedAdjustment,
    learning,
  };
}

export function semanticOverlap(left, right) {
  const tokenSimilarity = jaccard(tokenSet(textOf(left)), tokenSet(textOf(right)));
  const topicSimilarity = jaccard(topicSet(left), topicSet(right));
  return {
    score: Math.max(tokenSimilarity, topicSimilarity),
    tokenSimilarity,
    topicSimilarity,
  };
}

export function evaluateSemanticConflict(item, recentPosts = [], context = {}) {
  const now = requireNow(context);
  const currentPriority = finiteNumber(context.currentPriority)
    ?? calculateSchedulePriority(item, { ...context, now }).priority;
  const intentionalContinuation = item?.intentionalContinuation === true || item?.intentional_continuation === true;
  const matches = [];

  for (const recent of recentPosts || []) {
    const overlap = semanticOverlap(item, recent);
    if (overlap.score < SEMANTIC_CONFLICT_THRESHOLD) continue;
    matches.push({
      recent,
      overlap,
      recentPriority: recentPriority(recent, now),
      publishedAt: publishedAtOf(recent),
    });
  }

  matches.sort((a, b) => {
    if (b.overlap.score !== a.overlap.score) return b.overlap.score - a.overlap.score;
    const aTime = a.publishedAt ?? -Infinity;
    const bTime = b.publishedAt ?? -Infinity;
    if (bTime !== aTime) return bTime - aTime;
    return stableKey(a.recent).localeCompare(stableKey(b.recent));
  });

  const strongest = matches[0] || null;
  if (!strongest) return { conflict: false, delay: false, intentionalContinuation, matches: [] };

  const blockingMatches = matches.filter((match) => match.recentPriority == null || currentPriority <= match.recentPriority);
  const delay = !intentionalContinuation && blockingMatches.length > 0;
  let delayUntil = null;
  if (delay) {
    for (const match of blockingMatches) {
      if (match.publishedAt == null) continue;
      const candidateDelay = match.publishedAt + spacingTargetHours(item, match.recent) * HOUR_MS;
      delayUntil = delayUntil == null ? candidateDelay : Math.max(delayUntil, candidateDelay);
    }
  }
  const controlling = (blockingMatches.length ? blockingMatches : matches)
    .slice()
    .sort((a, b) => {
      const aPriority = a.recentPriority ?? Infinity;
      const bPriority = b.recentPriority ?? Infinity;
      if (bPriority !== aPriority) return bPriority - aPriority;
      if (b.overlap.score !== a.overlap.score) return b.overlap.score - a.overlap.score;
      return (b.publishedAt ?? -Infinity) - (a.publishedAt ?? -Infinity);
    })[0];

  return {
    conflict: true,
    delay,
    delayUntil,
    intentionalContinuation,
    currentPriority,
    strongest: {
      recentKey: stableKey(controlling.recent),
      overlap: controlling.overlap,
      recentPriority: controlling.recentPriority,
      publishedAt: controlling.publishedAt,
    },
    matches: matches.map((match) => ({
      recentKey: stableKey(match.recent),
      overlap: match.overlap,
      recentPriority: match.recentPriority,
      publishedAt: match.publishedAt,
    })),
  };
}

export function recommendMainFeedSchedule(item, context = {}) {
  const now = requireNow(context);
  const eligibility = evaluateScheduleEligibility(item, { ...context, now });
  const priorityBreakdown = calculateSchedulePriority(item, { ...context, now });
  const blockers = [...eligibility.blockers];
  const warnings = [];
  const conflicts = [];
  const empiricalAssumptions = assumptions();
  const expiresAt = expiresAtOf(item);
  const urgency = priorityBreakdown.urgency;

  if (!Object.hasOwn(URGENCY_MODIFIERS, String(item?.urgency || '').toLowerCase())) {
    addIssue(warnings, 'URGENCY_DEFAULTED', 'Missing or unknown urgency was treated as evergreen.');
  }

  const semantic = evaluateSemanticConflict(item, context.recentPosts || [], {
    now,
    currentPriority: priorityBreakdown.priority,
  });
  if (semantic.conflict) {
    conflicts.push({
      code: 'SEMANTIC_OVERLAP',
      message: `High semantic/topic overlap detected with recent item ${semantic.strongest.recentKey || 'unknown'}.`,
      ...semantic.strongest,
      delayRecommended: semantic.delay,
      delayUntil: semantic.delayUntil,
      intentionalContinuation: semantic.intentionalContinuation,
    });
  }

  if (blockers.length) {
    return {
      item,
      eligible: false,
      recommendedAt: null,
      priority: priorityBreakdown.priority,
      priorityBreakdown,
      reason: `Blocked: ${blockers.map((blocker) => blocker.message).join(' ')}`,
      blockers,
      warnings,
      conflicts,
      empiricalAssumptions,
    };
  }

  const humanOverrideAt = humanOverrideAtOf(item);
  if (humanOverrideAt != null) {
    if (expiresAt != null && humanOverrideAt >= expiresAt) {
      addIssue(blockers, 'HUMAN_OVERRIDE_AFTER_EXPIRY', 'Human schedule override is at or after item expiry.');
      return {
        item,
        eligible: false,
        recommendedAt: null,
        priority: priorityBreakdown.priority,
        priorityBreakdown,
        reason: 'Blocked: the explicit human schedule override would publish at or after expiry.',
        blockers,
        warnings,
        conflicts,
        empiricalAssumptions,
      };
    }
    const recommendedAt = Math.max(now, humanOverrideAt);
    addIssue(warnings, 'HUMAN_SCHEDULE_OVERRIDE', 'Explicit human schedule override is being respected over advisory spacing/conflict timing.');
    if (humanOverrideAt < now) {
      addIssue(warnings, 'HUMAN_OVERRIDE_PAST', 'Human schedule override is already in the past; earliest recommendation is now.');
    }
    return {
      item,
      eligible: true,
      recommendedAt,
      priority: priorityBreakdown.priority,
      priorityBreakdown,
      reason: `Human schedule override respected at ${new Date(recommendedAt).toISOString()}; hard eligibility and expiry still pass.`,
      blockers,
      warnings,
      conflicts,
      empiricalAssumptions,
    };
  }

  const latest = latestPublishedPost(context.recentPosts || [], context.lastMainFeedPostAt ?? context.last_main_feed_post_at);
  const spacingHours = spacingTargetHours(item, latest.post);
  let recommendedAt = latest.publishedAt == null
    ? now
    : Math.max(now, latest.publishedAt + spacingHours * HOUR_MS);

  if (latest.publishedAt != null && recommendedAt > now) {
    addIssue(warnings, 'COVERAGE_SPACING', `${urgency === 'evergreen' ? 'Evergreen' : 'Ordinary'} coverage spacing suggests waiting about ${spacingHours}h after the previous main-feed post.`);
  }
  if (latest.post?.accelerating === true || latest.post?.isAccelerating === true) {
    addIssue(warnings, 'PREVIOUS_POST_ACCELERATING', 'The most recent supplied main-feed post is still accelerating; spacing remains an editorial coverage preference.');
  }

  const viralPreemption = urgency === 'viral'
    && (missionBreakout(item) || item?.accelerating === true || item?.isAccelerating === true || (expiresAt != null && expiresAt - now <= 3 * HOUR_MS));
  if (viralPreemption && recommendedAt > now) {
    recommendedAt = now;
    addIssue(warnings, 'VIRAL_PREEMPTION', 'Approved viral content with observed breakout momentum or short shelf-life is recommended now despite advisory coverage spacing.');
    if (latest.publishedAt != null) {
      addIssue(warnings, 'COVERAGE_OVERLAP', 'Immediate viral publication overlaps the ordinary coverage-spacing window.');
    }
  } else if (expiresAt != null && recommendedAt >= expiresAt) {
    recommendedAt = now;
    addIssue(warnings, 'EXPIRY_PREEMPTS_SPACING', 'Item would expire before the advisory spacing target, so expiry pressure overrides that timing preference.');
  }

  if (semantic.conflict) {
    if (semantic.intentionalContinuation) {
      addIssue(warnings, 'INTENTIONAL_CONTINUATION', 'Semantic overlap is retained because the caller explicitly marked this item as an intentional continuation.');
    } else if (semantic.delay && semantic.delayUntil != null && semantic.delayUntil > recommendedAt) {
      if (expiresAt != null && semantic.delayUntil >= expiresAt) {
        addIssue(blockers, 'SEMANTIC_CONFLICT_EXPIRES', 'Delaying the weaker overlapping item past the conflicting post would reach or exceed its expiry.');
        return {
          item,
          eligible: false,
          recommendedAt: null,
          priority: priorityBreakdown.priority,
          priorityBreakdown,
          reason: 'Blocked: high semantic overlap makes the weaker item stale before a reasonable coverage slot.',
          blockers,
          warnings,
          conflicts,
          empiricalAssumptions,
        };
      }
      recommendedAt = semantic.delayUntil;
      addIssue(warnings, 'SEMANTIC_DELAY', 'High semantic/topic overlap delays the weaker or unranked item to reduce self-cannibalization.');
    } else if (!semantic.delay) {
      addIssue(warnings, 'STRONGER_OVERLAP_ITEM', 'High overlap is visible, but this item has higher supplied/computed editorial priority than the conflicting recent item.');
    }
  }

  const timing = recommendedAt <= now
    ? 'Recommend the earliest serialized slot now.'
    : `Recommend ${new Date(recommendedAt).toISOString()}.`;
  const learnedText = priorityBreakdown.learnedAdjustment
    ? `, learned ${priorityBreakdown.learnedAdjustment >= 0 ? '+' : ''}${priorityBreakdown.learnedAdjustment}`
    : '';
  const reason = `${urgency} priority ${priorityBreakdown.priority.toFixed(2)} (base ${priorityBreakdown.basePriority.toFixed(2)}, urgency +${priorityBreakdown.urgencyModifier}, expiry +${priorityBreakdown.expiryModifier}${learnedText}). ${timing}`;

  return {
    item,
    eligible: true,
    recommendedAt,
    priority: priorityBreakdown.priority,
    priorityBreakdown,
    reason,
    blockers,
    warnings,
    conflicts,
    empiricalAssumptions,
  };
}

export function rankMainFeedItems(items = [], context = {}) {
  const now = requireNow(context);
  const decisions = (items || []).map((item) => recommendMainFeedSchedule(item, { ...context, now }));
  return decisions.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const aTime = a.recommendedAt ?? Infinity;
    const bTime = b.recommendedAt ?? Infinity;
    if (aTime !== bTime) return aTime - bTime;
    if (a.priority !== b.priority) return b.priority - a.priority;
    const aExpiry = expiresAtOf(a.item) ?? Infinity;
    const bExpiry = expiresAtOf(b.item) ?? Infinity;
    if (aExpiry !== bExpiry) return aExpiry - bExpiry;
    const aApproved = approvalRecordedAtOf(a.item) ?? Infinity;
    const bApproved = approvalRecordedAtOf(b.item) ?? Infinity;
    if (aApproved !== bApproved) return aApproved - bApproved;
    return stableKey(a.item).localeCompare(stableKey(b.item));
  });
}
