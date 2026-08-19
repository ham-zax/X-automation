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
  const healthWatch = opportunity.healthState === 'watch' ? 5 : 0;
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
      healthState: opportunity.healthState || 'healthy',
      healthReasons: Array.isArray(opportunity.healthReasons) ? opportunity.healthReasons : [],
      saturationSummary: opportunity.saturationSummary || null,
      repetitionSummary: opportunity.repetitionSummary || null,
      observedConstraint: opportunity.observedConstraint || null,
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

function contributionTopic(candidate = {}) {
  const niche = candidate.niche || {};
  const explicit = niche.matches?.[0] || niche.tags?.[0];
  if (explicit) return String(explicit).replaceAll('_', ' ');
  return String(candidate.text || '').replace(/https?:\/\/\S+/g, '').trim().split(/\s+/).slice(0, 6).join(' ') || 'the technical point';
}

export function proposeEngagementContribution(candidate = {}, { response = false, directQuestion = false } = {}) {
  const text = String(candidate.text || '');
  const topic = contributionTopic(candidate);
  if (response) {
    if (directQuestion) {
      return {
        archetype: 'implementation_detail',
        summary: `Answer the target's direct question about ${topic} with one concrete implementation detail or explicitly verified fact.`,
        contextAdjustment: -15,
      };
    }
    return {
      archetype: 'synthesis',
      summary: `Connect the target's response about ${topic} to the prior thread and state one new technical implication.`,
    };
  }
  if (/\b(?:benchmark|latency|throughput|performance|measured|result(?:s)?)\b/i.test(text)) {
    return {
      archetype: 'caveat_or_edge_case',
      summary: `Probe the workload, version, or environment assumptions behind the source's ${topic} result before generalizing it.`,
      contextAdjustment: -10,
    };
  }
  if (/\b(?:compare|comparison|vs\.?|versus|trade-?off|better|worse)\b/i.test(text)) {
    return {
      archetype: 'comparison',
      summary: `Compare the ${topic} trade-off on one concrete developer constraint such as latency, cost, reliability, or compatibility.`,
      contextAdjustment: -10,
    };
  }
  if (/\b(?:api|sdk|cli|config|configuration|install|deploy|repository|repo|code|agent|model)\b/i.test(text)) {
    return {
      archetype: 'informed_question',
      summary: `Ask which concrete integration constraint around ${topic} mattered most in the described workflow, and why.`,
      contextAdjustment: -10,
    };
  }
  if (text.includes('?')) {
    return {
      archetype: 'informed_question',
      summary: `Ask a precise follow-up about the unresolved ${topic} constraint instead of offering generic agreement.`,
      contextAdjustment: -10,
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
} = {}) {
  const [store, tech, opportunity, strategy, health] = await Promise.all([
    import('./store.js'),
    import('./tech_news.js'),
    import('./opportunity.js'),
    import('./strategy.js'),
    import('./health.js'),
  ]);
  const coldProfiles = store.listRelationshipProfiles({ minTargetScore, limit: Math.max(1, Math.min(50, Number(targetLimit || 12))) });
  const allResponseProfiles = store.listRelationshipProfiles({ minTargetScore: 0, limit: 1000 });
  const responseProfilesByUsername = new Map(allResponseProfiles.map((profile) => [profile.username, profile]));
  const ourPosts = store.listRecentOurConversationPosts({ limit: 100 });
  const recentResponseUsernames = ourPosts
    .map((item) => sourceUsername(store.getCandidate(item.candidateKey) || {}))
    .filter((username) => responseProfilesByUsername.has(username));
  const responseUsernames = [...new Set([...recentResponseUsernames, ...allResponseProfiles.map((profile) => profile.username)])].slice(0, 20);
  const responseProfiles = responseUsernames.map((username) => responseProfilesByUsername.get(username)).filter(Boolean);
  const parentById = new Map(ourPosts.map((item) => [item.tweetId, item]));
  const seenItemIds = new Set();
  const createdOrRefreshed = [];
  const rejected = [];
  const errors = [];
  const accountHealth = store.getAccountHealthSummary({ now });
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
    const contribution = context.contribution || proposeEngagementContribution(candidate, {
      response: context.response === true,
      directQuestion: context.directQuestion === true,
    });
    if (!contribution) {
      rejected.push({ candidateKey: candidate.key, reason: 'NO_CONCRETE_CONTRIBUTION' });
      return null;
    }
    const targetTweetId = context.targetTweetId || tweetIdFromCandidate(candidate);
    if (!targetTweetId) {
      rejected.push({ candidateKey: candidate.key, reason: 'MISSING_TARGET_TWEET_ID' });
      return null;
    }
    const opportunityScores = opportunity.scoreOpportunity(candidate, {
      now,
      relationship: profile ? { ...profile, nicheTags: profile.primaryTopics || [] } : null,
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
    const scored = scoreEngagementOpportunity({

      candidate,
      targetUsername,
      targetTweetId,
      engagementKind: context.engagementKind || 'initial_reply',
      relationship: profile || {},
      conversationPotential: opportunityScores.conversationPotential,
      relationshipPotential: Number(profile?.relationshipPotential ?? opportunityScores.relationshipPotential ?? 0),
      targetScore: Number(profile?.targetScore ?? 0),
      profileReplyVisibility: profile?.replyVisibility ?? undefined,
      expiryClass: context.response === true ? undefined : engagementExpiryClass(candidate),
      contribution,
      saturation: saturationSummary.pressure,
      repetition: repetitionPressure,
      healthState: accountHealth.health.state,
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
      replyCount: candidate.metrics?.replies,
      sameSourceExhausted: store.hasCandidateAction(candidate.key),
      newValue: context.response === true,
    }, { now });
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
      routingReason: `EngagePriority ${scored.engagePriority}: ${scored.contribution.summary}`,
      engagement: { ...scored, refreshedAt: now, source: context.source || 'target_timeline' },
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

  if (ourPosts.length && responseProfiles.length) {
    const responseRead = await tech.fetchXTargetResponses(
      responseProfiles.map((profile) => profile.username),
      ourPosts.map((item) => item.tweetId),
      { maxTargets: responseProfiles.length, responsesPerTarget: 10, since: now - responseSinceHours * 3_600_000 },
    );
    errors.push(...responseRead.errors.map((item) => `response @${item.targetUsername}: ${item.error}`));
    for (const response of responseRead.responses) {
      const parent = parentById.get(response.parentOurTweetId);
      let profile = store.getRelationshipProfile(response.targetUsername);
      if (!profile) continue;
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
        targetUsername: post.targetUsername,
        targetTweetId: post.id,
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
