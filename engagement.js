import { applyAcceptedLearnedRules } from './learning.js';
import { selectBehaviorDecision } from './persona.js';

export const ENGAGEMENT_KINDS = ['initial_reply', 'follow_up', 'own_post_response'];

export const CONTRIBUTION_ARCHETYPES = [
  'implementation_detail',
  'benchmark_or_result',
  'caveat_or_edge_case',
  'comparison',
  'correction',
  'independent_judgment',
  'informed_question',
  'synthesis',
  'reproduction',
  'personal_experience',
  'direct_answer',
  'status_response',
  'agreement',
  'gratitude',
  'support',
  'celebration',
  'enthusiasm',
  'humor',
  'social_observation',
  'de_escalation',
  'relationship_callback',
];

export const ENGAGEMENT_EXPIRY_CLASSES = ['viral', 'normal', 'slow_technical', 'follow_up', 'own_post_response'];

const EMPIRICAL_VARIABLE = 'EMPIRICAL_VARIABLE';
const PRIORITY_WEIGHTS = {
  conversationPotential: 0.28,
  relationshipPotential: 0.22,
  targetScore: 0.22,
  freshness: 0.17,
  replyVisibility: 0.11,
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

  if (!summary) rejectionReasons.push(rejection('NO_PURPOSE', 'A concrete reason to exist is required before drafting.'));
  if (!CONTRIBUTION_ARCHETYPES.includes(archetype)) {
    rejectionReasons.push(rejection('INVALID_ARCHETYPE', `Unsupported contribution archetype: ${archetype || 'missing'}.`));
  }

  return {
    archetype,
    summary,
    verified: contribution.verified === true,
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
  const healthWatch = finite(opportunity.healthWatchPenalty)
    ? Math.max(0, Number(opportunity.healthWatchPenalty))
    : opportunity.healthState === 'watch' ? 5 : 0;
  const rawModifier = -Math.min(25, round((saturation ?? 0) / 10 + (repetition ?? 0) / 10 + healthWatch));
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
    healthState: opportunity.healthState || 'healthy',
    healthWatchPenalty: healthWatch,
    evidence: EMPIRICAL_VARIABLE,
  };
}

export function scoreEngagementOpportunity(opportunity = {}, { now, learnedRules = [], learningContext = {}, learningReviewContext = {} } = {}) {
  const itemIdentity = identity(opportunity);
  const relationship = opportunity.relationship || {};
  const timestamp = sourceTimestamp(opportunity);
  const freshness = scoreEngagementFreshness(timestamp, { now });
  const contribution = qualifyContribution(opportunity.contribution || {});
  const behavior = selectBehaviorDecision({
    explicitBehavior: opportunity.behavior || null,
    pipeline: 'reply',
    contribution,
    relationship,
    engagementKind: itemIdentity.engagementKind,
    parentOurTweetId: opportunity.parentOurTweetId || '',
    sourceClass: opportunity.sourceClass || '',
    growthObjective: opportunity.growthObjective || '',
    directQuestion: opportunity.directQuestion === true,
    targetReplied: opportunity.targetReplied === true,
    hostile: opportunity.hostile === true,
    sourceExcited: opportunity.sourceExcited === true,
    understated: opportunity.understated === true,
    reasonToExist: contribution.summary,
    selectionSource: opportunity.behavior ? 'operator' : 'engagement_heuristic',
    now,
  });
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
  const preLearnedPriority = basePriority == null ? 0 : round(clamp(basePriority + modifierTotal));
  const ruleContext = {
    targetUsername: itemIdentity.targetUsername,
    targetClass: relationship.classes || [],
    relationshipStage: relationship.relationshipStage || 'observed',
    engagementKind: itemIdentity.engagementKind,
    replyAgeBucket: freshness.bucket,
    replyArchetype: contribution.archetype,
    primaryPurpose: behavior.primaryPurpose || '',
    socialMode: behavior.socialMode || '',
    affectStrategy: behavior.affectStrategy || 'neutral',
    informationDepth: behavior.informationDepth || '',
    conversationStage: behavior.conversationStage || 'initial',
    personaModelVersion: behavior.personaModelVersion || '',
    healthState: opportunity.healthState || 'healthy',
    conversationSaturationBucket: opportunity.conversationSaturationBucket,
    interactionVolumeBucket: opportunity.interactionVolumeBucket,
    targetConcentrationBucket: opportunity.targetConcentrationBucket,
    archetypeRepetitionBucket: opportunity.archetypeRepetitionBucket,
    topicTags: opportunity.candidate?.niche?.tags || [],
    ...learningContext,
  };
  const learnedPriority = applyAcceptedLearnedRules(preLearnedPriority, learnedRules, {
    ...ruleContext,
    expired: expiry.effectiveExpired,
    humanApprovalRequired: false,
  }, {
    adjustmentTarget: 'engage_priority',
    finalMin: 0,
    finalMax: 100,
    reviewContext: learningReviewContext,
  });
  const engagePriority = round(clamp(learnedPriority.finalValue));

  const rejectionReasons = [...contribution.rejectionReasons];
  if (behavior.decision !== 'ACT') {
    rejectionReasons.push(rejection('NO_PURPOSEFUL_BEHAVIOR', behavior.reasonToExist || 'No purposeful behavior was selected.'));
  }
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
  if (opportunity.observedConstraint) {
    rejectionReasons.push(rejection('OBSERVED_CONSTRAINT', opportunity.observedConstraint.message || 'Supported observed platform/project constraint is active.'));
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
    behavior,
  } : null;

  return {
    ...itemIdentity,
    actionable,
    engagePriority,
    basePriority,
    preLearnedPriority,
    learnedAdjustment: learnedPriority,
    components,
    modifiers,
    modifierTotal,
    contribution,
    behavior,
    freshness,
    replyVisibility,
    expiry,
    rejectionReasons,
    queueProposal,
    explanation: {
      model: 'phase1c-purpose-aware-engage-priority',
      weights: { ...PRIORITY_WEIGHTS },
      missingComponents,
      softPressure: pressure,
      healthState: opportunity.healthState || 'healthy',
      healthReasons: Array.isArray(opportunity.healthReasons) ? opportunity.healthReasons : [],
      saturationSummary: opportunity.saturationSummary || null,
      repetitionSummary: opportunity.repetitionSummary || null,
      observedConstraint: opportunity.observedConstraint || null,
      learning: learnedPriority,
      empiricalVariables: ['freshness', 'replyVisibility', 'expiry', 'softPressure'],
      note: 'EngagePriority is an internal prioritization heuristic, not an X ranking score.',
    },
  };
}

export function rankEngagementOpportunities(opportunities = [], { now, learnedRules = [], learningContext = {}, learningReviewContext = {} } = {}) {
  return opportunities
    .map((opportunity, index) => ({
      index,
      result: scoreEngagementOpportunity(opportunity, { now, learnedRules, learningContext, learningReviewContext }),
    }))
    .filter(({ result }) => result.actionable)
    .sort((left, right) => (
      right.result.engagePriority - left.result.engagePriority
      || (right.result.components.freshness || 0) - (left.result.components.freshness || 0)
      || left.index - right.index
    ))
    .map(({ result }, index) => ({ ...result, rank: index + 1 }));
}

function sourceAffectHints(text = '') {
  const value = String(text || '');
  return {
    excited: /(?:🚀|🔥|🎉|\b(?:launched|launching|shipped|released|milestone|congrats?|excited|proud|finally live|we did it)\b)/i.test(value),
    hostile: /\b(?:idiot|stupid|dumb|fraud|liar|garbage|trash|hate|coward|clown|bullshit|scam)\b|(?:🤡|😡)/i.test(value),
    humorous: /(?:😂|🤣|\blol\b|\bhaha\b|\brofl\b|\bmeme\b|\bworks on my machine\b|\byak shave\b)/i.test(value),
    taste: /\b(?:beautiful|ugly|clean|clunky|elegant|polished|design|ui|ux|dx|interface|ergonomic)\b/i.test(value),
  };
}

export function proposeEngagementContribution(candidate = {}, {
  response = false,
  directQuestion = false,
  profile = null,
  sourceClass = 'normal',
  engagementKind = 'initial_reply',
} = {}) {
  const text = String(candidate.text || '');
  const affect = sourceAffectHints(text);
  const relationshipStage = String(profile?.relationshipStage || 'observed');
  const familiar = ['responsive', 'recurring', 'connected', 'mutual'].includes(relationshipStage);

  if (response) {
    if (directQuestion) {
      return {
        archetype: 'direct_answer',
        summary: 'Answer the actual question directly at the depth it needs; add context only when the answer would otherwise be misleading.',
      };
    }
    if (/\b(?:thank(?:s| you)?|appreciate|helped)\b/i.test(text)) {
      return {
        archetype: 'gratitude',
        summary: 'Acknowledge the thanks naturally and continue only if a real next point remains.',
      };
    }
    if (affect.humorous) {
      return {
        archetype: 'relationship_callback',
        summary: 'Respond to the shared joke or callback in the existing exchange without restarting the technical explanation.',
      };
    }
    return {
      archetype: 'relationship_callback',
      summary: engagementKind === 'follow_up' || familiar
        ? 'Continue the actual exchange using shared context; respond to the point in front of Hamza rather than adding a fresh public performance.'
        : 'Acknowledge the response and continue the conversation only as far as the current point warrants.',
    };
  }

  const measurementClaim = /\b(?:benchmark|latency|throughput|performance|measured|result(?:s)?)\b/i.test(text)
    && /(?:\bbenchmark\b|\bmeasured\b|\bresults?\s*:|\d+(?:\.\d+)?\s*(?:ms|s|sec|seconds?|%|x\b|tokens?|rps|qps|ops|mb|gb)\b)/i.test(text);
  if (measurementClaim) {
    return {
      archetype: 'caveat_or_edge_case',
      summary: 'Address a workload, version, environment, or interpretation condition only if it materially changes how the measured result should be used.',
    };
  }
  if (/(?:\$\s?\d|\b(?:price|pricing|cost|costs|spent|spend|spending|credits?|budget)\b)/i.test(text)) {
    return {
      archetype: 'informed_question',
      summary: 'Ask or state one concrete cost assumption that would change the practical decision; do not manufacture a question when the source already answers it.',
    };
  }
  if (/\b(?:compare|comparison|vs\.?|versus|trade-?off|better|worse)\b/i.test(text)) {
    return {
      archetype: 'comparison',
      summary: 'Compare the approaches on one real developer constraint that is present in the source or in Hamza\'s established stance.',
    };
  }
  if (affect.hostile) {
    return {
      archetype: 'independent_judgment',
      summary: 'Take a clear position on the substance if the source supports one. Do not praise first or soothe by default; disagree directly, use dry humor, or de-escalate only when that actually improves the exchange. Attack the claim, not the person.',
    };
  }
  if (affect.humorous) {
    return {
      archetype: 'humor',
      summary: 'Join the joke or add one context-dependent builder observation when humor is the strongest complete contribution.',
    };
  }
  if (affect.excited) {
    return {
      archetype: familiar ? 'support' : 'celebration',
      summary: familiar
        ? 'Recognize the person or project with specific warmth appropriate to the existing relationship.'
        : 'Participate in the launch or milestone with a concise, context-specific reaction; do not force a technical caveat afterward.',
    };
  }
  if (affect.taste) {
    return {
      archetype: 'social_observation',
      summary: 'Express a grounded product, design, interface, or developer-experience judgment about the visible object.',
    };
  }
  if (/(?:github\.com|\b(?:repository|repo|resource|guide|bookmark|list of|websites?)\b)/i.test(text)) {
    return {
      archetype: 'informed_question',
      summary: 'Ask what concrete task made the resource useful or name the use case the source makes visible; do not repeat the recommendation.',
    };
  }
  const workflowTool = /\b(?:api|sdk|cli|config|configuration|install|deploy|agent|model|codex|claude|cursor)\b/i.test(text);
  const workflowAction = /\b(?:use|using|used|run|running|setup|workflow|integrat\w*|ship\w*|build\w*|adopt\w*|migrat\w*|release\w*|launch\w*)\b/i.test(text);
  if (workflowTool && workflowAction) {
    return {
      archetype: 'independent_judgment',
      summary: 'State the clearest workflow judgment, preference, or consequence the source actually supports. Ask only when a missing fact genuinely blocks a call.',
    };
  }
  if (text.includes('?')) {
    return {
      archetype: 'informed_question',
      summary: 'Answer or deepen the actual question only when Hamza has a useful angle or genuinely useful follow-up.',
    };
  }
  return null;
}

function sourceUsername(candidate = {}) {
  const title = String(candidate.title || '');
  if (title.startsWith('@')) return title.slice(1).toLowerCase();
  return String(candidate.url || '').match(/x\.com\/([^/]+)/i)?.[1]?.toLowerCase() || '';
}

function tweetIdFromCandidate(candidate = {}) {
  return String(candidate.url || '').match(/\/status\/(\d+)/)?.[1] || '';
}

function engagementExpiryClass(candidate = {}) {
  if (['viral', 'breakout'].includes(candidate.viral?.tier)) return 'viral';
  const text = String(candidate.text || '');
  if (/\b(?:api|sdk|cli|benchmark|latency|throughput|architecture|implementation|config|configuration|deploy|repository|repo|code)\b/i.test(text)) {
    return 'slow_technical';
  }
  return 'normal';
}

export async function refreshEngagementOpportunities({
  now = Date.now(),
  targetLimit = 12,
  postsPerTarget = 4,
  minTargetScore = 35,
  targetSinceHours = 24,
  responseSinceHours = 72,
  refreshTargetTimelines = true,
} = {}) {
  const [store, tech, opportunity, strategy, health] = await Promise.all([
    import('./store.js'),
    import('./tech_news.js'),
    import('./opportunity.js'),
    import('./strategy.js'),
    import('./health.js'),
  ]);
  const coldProfiles = refreshTargetTimelines
    ? store.listRelationshipProfiles({ minTargetScore, limit: Math.max(1, Math.min(50, Number(targetLimit || 12))) })
    : [];
  const ourPosts = store.listRecentOurConversationPosts({ limit: 100 });
  const parentById = new Map(ourPosts.map((item) => [item.tweetId, item]));
  const seenItemIds = new Set();
  const createdOrRefreshed = [];
  const rejected = [];
  const errors = [];
  const accountHealth = store.getAccountHealthSummary({ now });
  const learnedRules = store.listAcceptedLearnedRules({ limit: 500 });
  const observedConstraint = accountHealth.health.state === 'constrained'
    ? accountHealth.health.reasons.find((reason) => reason.level === 'constrained') || null
    : null;

  const candidateFromPost = (post, profile = null, response = false) => {
    const classified = strategy.classifyNiche(post.text || '');
    const profileTopics = response ? (profile?.primaryTopics || []) : [];
    const profileKeywords = response ? (profile?.matchedKeywords || []) : [];
    const niche = {
      score: response ? Math.max(Number(classified.score || 0), Number(profile?.relevanceScore || 0)) : Number(classified.score || 0),
      tags: [...new Set([...(classified.tags || []), ...profileTopics])],
      matches: [...new Set([...(classified.matches || []), ...profileKeywords])],
    };
    return {
      key: post.url || `x:${post.id}`,
      source: 'x',
      title: `@${post.authorUsername || post.targetUsername}`,
      text: post.text || '',
      url: post.url || `https://x.com/${post.authorUsername || post.targetUsername}/status/${post.id}`,
      timestamp: Number(post.timestamp || 0),
      score: niche.score,
      niche,
      metrics: {
        views: Number(post.views || 0),
        likes: Number(post.likes || 0),
        retweets: Number(post.reposts || 0),
        replies: Number(post.replies || 0),
      },
    };
  };

  const persistOpportunity = (candidate, profile, context = {}) => {
    const engagementKind = context.engagementKind || 'initial_reply';
    const contribution = context.contribution || proposeEngagementContribution(candidate, {
      response: context.response === true,
      directQuestion: context.directQuestion === true,
      profile,
      sourceClass: context.sourceClass || (context.response === true ? 'active' : 'normal'),
      engagementKind,
    });
    if (!contribution) {
      rejected.push({ candidateKey: candidate.key, reason: 'NO_PURPOSEFUL_ACTION' });
      return null;
    }
    const targetTweetId = context.targetTweetId || tweetIdFromCandidate(candidate);
    if (!targetTweetId) {
      rejected.push({ candidateKey: candidate.key, reason: 'MISSING_TARGET_TWEET_ID' });
      return null;
    }
    const existingEngagement = store.getActiveEngagementItem(targetTweetId, engagementKind);
    const opportunityScores = opportunity.scoreOpportunity(candidate, {
      now,
      relationship: profile ? { ...profile, nicheTags: profile.primaryTopics || [] } : null,
      learnedRules,
      learningContext: {
        targetUsername: profile?.username || '',
        targetClass: profile?.classes || [],
        relationshipStage: profile?.relationshipStage || 'observed',
        topicTags: candidate.niche?.tags || [],
      },
    });
    const targetUsername = context.targetUsername || profile?.username || sourceUsername(candidate);
    const targetEvents = targetUsername ? store.listRelationshipEvents(targetUsername, { limit: 1000 }) : [];
    const saturationSummary = health.calculateSaturationPressure({
      ...(profile || {}),
      username: targetUsername,
      activeConversation: context.response === true,
      directQuestion: context.directQuestion === true,
      newVerifiedEvidence: context.newVerifiedEvidence === true,
    }, targetEvents, { now });
    const recentReplies = targetUsername
      ? store.listRecentPublishedReplies({ targetUsername, since: now - 7 * 24 * 3_600_000, limit: 20 })
      : [];
    const repetitionSummary = health.analyzeReplyRepetition(recentReplies, { targetUsername });
    const repetitionPressure = Math.max(Number(repetitionSummary.archetypeConcentration || 0), Number(repetitionSummary.phraseSimilarity || 0));
    const healthLearningContext = {
      targetUsername,
      targetClass: profile?.classes || [],
      relationshipStage: profile?.relationshipStage || 'observed',
      healthState: accountHealth.health.state,
      topicTags: candidate.niche?.tags || [],
    };
    const learnedSaturation = applyAcceptedLearnedRules(saturationSummary.pressure, learnedRules, healthLearningContext, {
      adjustmentTarget: 'saturation_pressure', finalMin: 0, finalMax: 100,
    });
    const learnedWatchPenalty = accountHealth.health.state === 'watch'
      ? applyAcceptedLearnedRules(5, learnedRules, healthLearningContext, {
        adjustmentTarget: 'health_watch_modifier', finalMin: 0, finalMax: 13,
      })
      : null;
    const scored = scoreEngagementOpportunity({
      candidate,
      targetUsername,
      targetTweetId,
      engagementKind,
      parentOurTweetId: context.parentOurTweetId || '',
      sourceClass: context.sourceClass || (context.response === true ? 'active' : 'normal'),
      growthObjective: strategy.getActiveNicheProfile()?.defaultObjective || 'qualified_growth',
      relationship: profile || {},
      conversationPotential: opportunityScores.conversationPotential,
      relationshipPotential: Number(profile?.relationshipPotential ?? opportunityScores.relationshipPotential ?? 0),
      targetScore: Number(profile?.targetScore ?? 0),
      profileReplyVisibility: profile?.replyVisibility ?? undefined,
      expiryClass: context.response === true ? undefined : engagementExpiryClass(candidate),
      contribution,
      saturation: learnedSaturation.finalValue,
      repetition: repetitionPressure,
      healthState: accountHealth.health.state,
      healthWatchPenalty: learnedWatchPenalty?.finalValue ?? 0,
      healthReasons: accountHealth.health.reasons,
      saturationSummary,
      repetitionSummary,
      observedConstraint,
      newVerifiedEvidence: context.newVerifiedEvidence === true,
      directQuestion: context.directQuestion === true,
      targetReplied: context.response === true,
      activeConversation: context.response === true,
      activeRecurring: profile?.relationshipStage === 'recurring',
      ownPostSubstantiveReply: context.engagementKind === 'own_post_response' && candidate.text.length >= 24,
      authorResponding: context.response === true,
      hostile: sourceAffectHints(candidate.text).hostile,
      sourceExcited: sourceAffectHints(candidate.text).excited,
      replyCount: candidate.metrics?.replies,
      sameSourceExhausted: store.hasCandidateAction(candidate.key),
      newValue: context.response === true,
    }, {
      now,
      learnedRules,
      learningContext: healthLearningContext,
    });
    if (!scored.actionable) {
      rejected.push({ candidateKey: candidate.key, rejectionReasons: scored.rejectionReasons });
      return null;
    }
    store.upsertCandidates([candidate]);
    const item = store.ensureEngagementItem({
      ...scored.queueProposal,
      parentOurTweetId: context.parentOurTweetId || '',
      status: 'triage',
      urgency: Number(scored.components.freshness || 0),
      routingReason: `EngagePriority ${scored.engagePriority}: ${scored.behavior.primaryPurpose || 'purpose'} — ${scored.contribution.summary}`,
      behavior: scored.behavior,
      engagement: {
        ...scored,
        refreshedAt: now,
        firstObservedAt: existingEngagement?.engagement?.firstObservedAt || existingEngagement?.createdAt || now,
        source: context.source || 'target_timeline',
        sourceClass: context.sourceClass || (context.response === true ? 'active' : 'normal'),
      },
    });
    if (item.lane !== 'engagement') {
      rejected.push({ candidateKey: candidate.key, reason: 'HUMAN_ROUTE_PRESERVED' });
      return null;
    }
    if (['ignored', 'expired', 'published', 'failed'].includes(item.status)) {
      rejected.push({ candidateKey: candidate.key, reason: `EXISTING_${item.status.toUpperCase()}` });
      return null;
    }
    seenItemIds.add(item.id);
    createdOrRefreshed.push(item);
    return item;
  };

  if (ourPosts.length) {
    const responseRead = await tech.fetchXTargetResponses(
      [],
      ourPosts.map((item) => item.tweetId),
      { responsesPerTarget: 10, since: now - responseSinceHours * 3_600_000 },
    );
    errors.push(...responseRead.errors.map((item) => `response @${item.targetUsername}: ${item.error}`));
    for (const response of responseRead.responses) {
      const parent = parentById.get(response.parentOurTweetId);
      let profile = store.getRelationshipProfile(response.targetUsername);
      const candidate = candidateFromPost(response, profile, true);
      const alreadyRecorded = store.listRelationshipEvents(response.targetUsername, { limit: 1000 })
        .some((event) => String(event.metadata?.responseTweetId || '') === String(response.id));
      if (!alreadyRecorded) {
        store.recordRelationshipEvent({
          username: response.targetUsername,
          eventType: response.responseType === 'quote' ? 'target_quote' : 'target_reply',
          candidateKey: candidate.key,
          sourceTweetId: parent?.sourceTweetId || response.parentOurTweetId,
          ourTweetId: response.parentOurTweetId,
          topic: candidate.niche.tags?.[0] || null,
          occurredAt: response.timestamp || now,
          metadata: {
            responseTweetId: response.id,
            responseType: response.responseType,
            parentOurTweetId: response.parentOurTweetId,
          },
        });
        profile = store.getRelationshipProfile(response.targetUsername) || profile;
      }
      persistOpportunity(candidate, profile, {
        source: 'target_response',
        sourceClass: 'active',
        response: true,
        directQuestion: candidate.text.includes('?'),
        targetUsername: response.targetUsername,
        targetTweetId: response.id,
        parentOurTweetId: response.parentOurTweetId,
        engagementKind: parent?.kind === 'reply' ? 'follow_up' : 'own_post_response',
      });
    }
  }

  if (coldProfiles.length) {
    const targetRead = await tech.fetchXTargetRecentPosts(
      coldProfiles.map((profile) => profile.username),
      { maxTargets: coldProfiles.length, postsPerTarget, since: now - targetSinceHours * 3_600_000 },
    );
    errors.push(...targetRead.errors.map((item) => `target @${item.targetUsername}: ${item.error}`));
    const profilesByUsername = new Map(coldProfiles.map((profile) => [profile.username, profile]));
    for (const post of targetRead.posts) {
      const profile = profilesByUsername.get(post.targetUsername);
      if (!profile) continue;
      const candidate = candidateFromPost(post, profile, false);
      persistOpportunity(candidate, profile, {
        source: 'target_timeline',
        sourceClass: 'normal',
        targetUsername: post.targetUsername,
        targetTweetId: post.id,
        engagementKind: 'initial_reply',
      });
    }
  }

  for (const [snapshotKind, sourceClass] of [['x_latest', 'normal'], ['x_momentum', 'momentum']]) {
    for (const candidate of store.getDiscoverSnapshot(snapshotKind).candidates.slice(0, 60)) {
      if (candidate.source !== 'x') continue;
      const username = sourceUsername(candidate);
      const profile = username ? store.getRelationshipProfile(username) : null;
      persistOpportunity(candidate, profile, {
        source: snapshotKind,
        sourceClass,
        targetUsername: username,
        targetTweetId: tweetIdFromCandidate(candidate),
        engagementKind: 'initial_reply',
      });
    }
  }

  for (const queueItem of store.listQueueItems({ limit: 250 })) {
    if (queueItem.lane === 'engagement'
      || queueItem.recommendedPipeline !== 'reply'
      || queueItem.pipeline !== 'triage'
      || queueItem.status !== 'triage') continue;
    const candidate = store.getCandidate(queueItem.candidateKey);
    if (!candidate || candidate.source !== 'x') continue;
    const username = sourceUsername(candidate);
    const profile = username ? store.getRelationshipProfile(username) : null;
    if (!profile) continue;
    persistOpportunity(candidate, profile, {
      source: 'research_candidate',
      sourceClass: ['viral', 'breakout'].includes(candidate.viral?.tier) ? 'momentum' : 'normal',
      targetUsername: username,
      targetTweetId: tweetIdFromCandidate(candidate),
      engagementKind: 'initial_reply',
    });
  }

  let expired = 0;
  for (const item of store.listEngagementItems({ includeExpired: true, limit: 500 })) {
    if (seenItemIds.has(item.id) || ['ignored', 'expired', 'published', 'failed'].includes(item.status)) continue;
    if (item.expiresAt != null && now >= item.expiresAt) {
      store.saveQueueItem({ ...item, status: 'expired', humanApprovedAt: null, approvedText: null });
      expired++;
    }
  }

  const items = store.listEngagementItems({ includeExpired: false, limit: 200 });
  return {
    items,
    activeConversations: items.filter((item) => item.engagementKind !== 'initial_reply'),
    newOpportunities: items.filter((item) => item.engagementKind === 'initial_reply'),
    refreshed: createdOrRefreshed.length,
    rejected: rejected.length,
    expired,
    errors,
  };
}
