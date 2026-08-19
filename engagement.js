export const ENGAGEMENT_KINDS = ['initial_reply', 'follow_up', 'own_post_response'];

export const CONTRIBUTION_ARCHETYPES = [
  'implementation_detail',
  'benchmark_or_result',
  'caveat_or_edge_case',
  'comparison',
  'correction',
  'informed_question',
  'synthesis',
  'reproduction',
  'personal_experience',
];

export const ENGAGEMENT_EXPIRY_CLASSES = ['viral', 'normal', 'slow_technical', 'follow_up', 'own_post_response'];

const EMPIRICAL_VARIABLE = 'EMPIRICAL_VARIABLE';
const CONTRIBUTION_MINIMUM = 60;
const PRIORITY_WEIGHTS = {
  conversationPotential: 0.25,
  relationshipPotential: 0.20,
  targetScore: 0.20,
  freshness: 0.15,
  replyVisibility: 0.10,
  contributionStrength: 0.10,
};
const CONTRIBUTION_BASELINES = {
  benchmark_or_result: { strength: 100, verificationRequired: true },
  implementation_detail: { strength: 90 },
  caveat_or_edge_case: { strength: 85 },
  comparison: { strength: 80 },
  correction: { strength: 80, verificationRequired: true },
  informed_question: { strength: 75 },
  synthesis: { strength: 70 },
};
const EXPIRY_HOURS = {
  viral: 2,
  normal: 6,
  slow_technical: 24,
  follow_up: 24,
  own_post_response: 48,
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function finite(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function scoreValue(value) {
  return finite(value) ? round(clamp(value)) : null;
}

function negativeAdjustment(value) {
  if (!finite(value)) return 0;
  return round(Math.max(-40, Math.min(0, Number(value))));
}

function sourceTimestamp(opportunity = {}) {
  const candidate = opportunity.candidate || opportunity.source || {};
  const value = opportunity.occurredAt ?? opportunity.sourceTimestamp ?? candidate.timestamp;
  return finite(value) ? Number(value) : null;
}

function identity(opportunity = {}) {
  const candidate = opportunity.candidate || opportunity.source || {};
  return {
    candidateKey: opportunity.candidateKey || candidate.key || candidate.url || '',
    targetUsername: String(opportunity.targetUsername || opportunity.relationship?.username || '').replace(/^@/, '').toLowerCase(),
    targetTweetId: String(opportunity.targetTweetId || candidate.tweetId || candidate.id || ''),
    engagementKind: opportunity.engagementKind || 'initial_reply',
  };
}

function rejection(code, reason) {
  return { code, reason };
}

export function scoreEngagementFreshness(timestamp, { now } = {}) {
  if (!finite(timestamp) || !finite(now)) {
    return {
      score: null,
      ageMinutes: null,
      bucket: 'unavailable',
      evidence: EMPIRICAL_VARIABLE,
    };
  }

  const ageMinutes = Math.max(0, (Number(now) - Number(timestamp)) / 60_000);
  let score;
  let bucket;
  if (ageMinutes < 5) { score = 100; bucket = '0-5m'; }
  else if (ageMinutes < 15) { score = 95; bucket = '5-15m'; }
  else if (ageMinutes < 30) { score = 85; bucket = '15-30m'; }
  else if (ageMinutes < 60) { score = 70; bucket = '30-60m'; }
  else if (ageMinutes < 120) { score = 50; bucket = '1-2h'; }
  else if (ageMinutes < 360) { score = 30; bucket = '2-6h'; }
  else { score = 10; bucket = '6h+'; }

  return {
    score,
    ageMinutes: round(ageMinutes),
    bucket,
    evidence: EMPIRICAL_VARIABLE,
  };
}

export function qualifyContribution(contribution = {}) {
  const archetype = String(contribution.archetype || '');
  const summary = String(contribution.summary || '').trim();
  const rejectionReasons = [];

  if (!summary) rejectionReasons.push(rejection('NO_CONTRIBUTION', 'A concrete contribution summary is required before drafting.'));
  if (!CONTRIBUTION_ARCHETYPES.includes(archetype)) {
    rejectionReasons.push(rejection('INVALID_ARCHETYPE', `Unsupported contribution archetype: ${archetype || 'missing'}.`));
  }

  const rule = CONTRIBUTION_BASELINES[archetype];
  const suppliedBaseline = finite(contribution.baselineStrength) ? scoreValue(contribution.baselineStrength) : null;
  const baselineStrength = rule?.strength ?? suppliedBaseline;
  const verificationRequired = Boolean(rule?.verificationRequired || archetype === 'reproduction');

  if (baselineStrength == null && CONTRIBUTION_ARCHETYPES.includes(archetype)) {
    rejectionReasons.push(rejection(
      'MISSING_BASELINE',
      `${archetype} has no plan-defined starting strength; the caller must supply baselineStrength.`,
    ));
  }
  if (verificationRequired && contribution.verified !== true) {
    rejectionReasons.push(rejection('VERIFICATION_REQUIRED', `${archetype} requires verified evidence before it can qualify.`));
  }

  const evidenceAdjustment = negativeAdjustment(contribution.evidenceAdjustment);
  const contextAdjustment = negativeAdjustment(contribution.contextAdjustment);
  const strength = baselineStrength == null
    ? null
    : round(clamp(baselineStrength + evidenceAdjustment + contextAdjustment));

  if (strength != null && strength < CONTRIBUTION_MINIMUM) {
    rejectionReasons.push(rejection(
      'WEAK_CONTRIBUTION',
      `Contribution strength ${strength} is below the Engage Next minimum ${CONTRIBUTION_MINIMUM}.`,
    ));
  }

  return {
    archetype,
    summary,
    baselineStrength,
    evidenceAdjustment,
    contextAdjustment,
    strength,
    qualified: rejectionReasons.length === 0,
    rejectionReasons,
  };
}

export function scoreReplyVisibility(profile = {}, context = {}) {
  const baseline = scoreValue(context.profileReplyVisibility ?? profile.replyVisibility);
  const freshness = context.freshness?.score != null
    ? scoreValue(context.freshness.score)
    : scoreValue(context.freshness);
  const saturation = scoreValue(context.saturation);
  const conversationDepthScore = scoreValue(context.conversationDepthScore);

  const modifiers = {
    age: freshness == null ? 0 : -Math.min(20, round((100 - freshness) / 5)),
    saturation: saturation == null ? 0 : -Math.min(10, round(saturation / 10)),
    authorResponding: context.authorResponding ? 10 : 0,
    activeConversation: context.activeConversation ? 15 : 0,
    conversationDepth: conversationDepthScore == null ? 0 : Math.min(5, round(conversationDepthScore / 20)),
  };
  const totalModifier = round(Object.values(modifiers).reduce((sum, value) => sum + value, 0));

  return {
    score: baseline == null ? null : round(clamp(baseline + totalModifier)),
    baseline,
    modifiers,
    totalModifier,
    observations: {
      replyCount: finite(context.replyCount) ? Number(context.replyCount) : null,
      replyVelocity: finite(context.replyVelocity) ? Number(context.replyVelocity) : null,
      saturation,
      conversationDepthScore,
    },
    evidence: EMPIRICAL_VARIABLE,
  };
}

export function getEngagementExpiry(opportunity = {}, { now } = {}) {
  const kind = opportunity.engagementKind || 'initial_reply';
  let expiryClass;
  if (kind === 'follow_up') expiryClass = 'follow_up';
  else if (kind === 'own_post_response') expiryClass = 'own_post_response';
  else if (opportunity.expiryClass === 'viral' || opportunity.expiryClass === 'slow_technical') expiryClass = opportunity.expiryClass;
  else expiryClass = 'normal';

  const occurredAt = sourceTimestamp(opportunity);
  const durationHours = EXPIRY_HOURS[expiryClass];
  const expiresAt = occurredAt == null ? null : occurredAt + durationHours * 3_600_000;
  const expiredByDefault = expiresAt != null && finite(now) ? Number(now) >= expiresAt : null;
  const activeConversationOverride = expiredByDefault === true && opportunity.activeConversation === true;

  return {
    expiryClass,
    durationHours,
    expiresAt,
    expiredByDefault,
    effectiveExpired: expiredByDefault === true && !activeConversationOverride,
    activeConversationOverride,
    evidence: EMPIRICAL_VARIABLE,
  };
}

function softPressureModifier(opportunity = {}) {
  const saturation = scoreValue(opportunity.saturation);
  const repetition = scoreValue(opportunity.repetition);
  const rawModifier = -Math.min(20, round((saturation ?? 0) / 10 + (repetition ?? 0) / 10));
  const overrideReasons = [];
  if (opportunity.directQuestion) overrideReasons.push('direct_question');
  if (opportunity.targetReplied) overrideReasons.push('target_replied');
  if (opportunity.newVerifiedEvidence) overrideReasons.push('new_verified_evidence');
  if (opportunity.activeConversation) overrideReasons.push('active_conversation');
  if (opportunity.activeRecurring) overrideReasons.push('active_recurring_thread');
  return {
    rawModifier,
    appliedModifier: overrideReasons.length ? 0 : rawModifier,
    overrideReasons,
    saturation,
    repetition,
    evidence: EMPIRICAL_VARIABLE,
  };
}

export function scoreEngagementOpportunity(opportunity = {}, { now } = {}) {
  const itemIdentity = identity(opportunity);
  const relationship = opportunity.relationship || {};
  const timestamp = sourceTimestamp(opportunity);
  const freshness = scoreEngagementFreshness(timestamp, { now });
  const contribution = qualifyContribution(opportunity.contribution || {});
  const replyVisibility = scoreReplyVisibility(relationship, {
    freshness,
    profileReplyVisibility: opportunity.profileReplyVisibility,
    saturation: opportunity.saturation,
    authorResponding: opportunity.authorResponding,
    activeConversation: opportunity.activeConversation,
    conversationDepthScore: opportunity.conversationDepthScore,
    replyCount: opportunity.replyCount,
    replyVelocity: opportunity.replyVelocity,
  });
  const expiry = getEngagementExpiry(opportunity, { now });

  const components = {
    conversationPotential: scoreValue(opportunity.conversationPotential),
    relationshipPotential: scoreValue(opportunity.relationshipPotential ?? relationship.relationshipPotential),
    targetScore: scoreValue(opportunity.targetScore ?? relationship.targetScore),
    freshness: freshness.score,
    replyVisibility: replyVisibility.score,
    contributionStrength: contribution.strength,
  };
  const missingComponents = Object.keys(PRIORITY_WEIGHTS).filter((name) => components[name] == null);
  const basePriority = missingComponents.length
    ? null
    : round(Object.entries(PRIORITY_WEIGHTS)
      .reduce((sum, [name, weight]) => sum + components[name] * weight, 0));

  const pressure = softPressureModifier(opportunity);
  const modifiers = {
    directQuestion: opportunity.directQuestion ? 15 : 0,
    targetReplied: opportunity.targetReplied ? 15 : 0,
    activeRecurring: opportunity.activeRecurring ? 10 : 0,
    ownPostSubstantiveReply: opportunity.ownPostSubstantiveReply ? 8 : 0,
    softPressure: pressure.appliedModifier,
  };
  const modifierTotal = round(Object.values(modifiers).reduce((sum, value) => sum + value, 0));
  const engagePriority = basePriority == null ? 0 : round(clamp(basePriority + modifierTotal));

  const rejectionReasons = [...contribution.rejectionReasons];
  if (!ENGAGEMENT_KINDS.includes(itemIdentity.engagementKind)) {
    rejectionReasons.push(rejection('INVALID_ENGAGEMENT_KIND', `Unsupported engagement kind: ${itemIdentity.engagementKind}.`));
  }
  if (!finite(now)) rejectionReasons.push(rejection('MISSING_NOW', 'A caller-supplied now timestamp is required for deterministic freshness and expiry.'));
  if (timestamp == null) rejectionReasons.push(rejection('MISSING_SOURCE_TIMESTAMP', 'A source/response timestamp is required for freshness and expiry.'));
  for (const component of missingComponents) {
    rejectionReasons.push(rejection('MISSING_PRIORITY_COMPONENT', `Missing required EngagePriority component: ${component}.`));
  }
  if (opportunity.nearDuplicate === true || opportunity.exactDuplicate === true) {
    rejectionReasons.push(rejection('NEAR_DUPLICATE', 'Caller-supplied duplicate evidence marks the proposed reply as exact/near-duplicate.'));
  }
  if (opportunity.sameSourceExhausted === true && opportunity.newValue !== true) {
    rejectionReasons.push(rejection('SOURCE_EXHAUSTED', 'The same source was already acted on and the caller supplied no new value.'));
  }
  if (expiry.effectiveExpired) {
    rejectionReasons.push(rejection('EXPIRED', 'The default opportunity window has expired and no active conversation override is present.'));
  }

  const actionable = rejectionReasons.length === 0;
  const queueProposal = actionable ? {
    lane: 'engagement',
    pipeline: 'reply',
    candidateKey: itemIdentity.candidateKey,
    targetUsername: itemIdentity.targetUsername,
    targetTweetId: itemIdentity.targetTweetId,
    engagementKind: itemIdentity.engagementKind,
    priority: engagePriority,
    conversationPotential: components.conversationPotential,
    relationshipPotential: components.relationshipPotential,
    expiresAt: expiry.expiresAt,
    contributionSummary: contribution.summary,
    replyArchetype: contribution.archetype,
  } : null;

  return {
    ...itemIdentity,
    actionable,
    engagePriority,
    basePriority,
    components,
    modifiers,
    modifierTotal,
    contribution,
    freshness,
    replyVisibility,
    expiry,
    rejectionReasons,
    queueProposal,
    explanation: {
      model: 'phase1c-engage-priority',
      weights: { ...PRIORITY_WEIGHTS },
      missingComponents,
      softPressure: pressure,
      empiricalVariables: ['freshness', 'replyVisibility', 'expiry', 'softPressure'],
      note: 'EngagePriority is an internal prioritization heuristic, not an X ranking score.',
    },
  };
}

export function rankEngagementOpportunities(opportunities = [], { now } = {}) {
  return opportunities
    .map((opportunity, index) => ({
      index,
      result: scoreEngagementOpportunity(opportunity, { now }),
    }))
    .filter(({ result }) => result.actionable)
    .sort((left, right) => (
      right.result.engagePriority - left.result.engagePriority
      || (right.result.components.freshness || 0) - (left.result.components.freshness || 0)
      || left.index - right.index
    ))
    .map(({ result }, index) => ({ ...result, rank: index + 1 }));
}
