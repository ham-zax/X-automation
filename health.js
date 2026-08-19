export const HEALTH_STATES = ['healthy', 'watch', 'constrained'];

const EMPIRICAL_VARIABLE = 'EMPIRICAL_VARIABLE';
const OBSERVED_EVIDENCE = 'OBSERVED_EVIDENCE';
const HARD_OBSERVATION_TYPES = new Set([
  'visibility_label_observed',
  'platform_challenge_observed',
  'platform_restriction_observed',
]);
const OUTBOUND_EVENT_TYPES = new Set(['our_reply', 'our_quote']);
const RESPONSE_EVENT_TYPES = new Set(['target_reply', 'target_quote', 'target_repost']);
const HEALTH_WATCH_THRESHOLDS = {
  saturationPressure: 50,
  topTargetConcentration: 60,
  minimumInitialReplies: 5,
  lowAuthorResponseRate: 20,
  lowContinuationRate: 10,
};
const DAY_MS = 24 * 60 * 60 * 1000;

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

function nonNegative(value) {
  return finite(value) ? Math.max(0, Number(value)) : 0;
}

function firstFinite(source, ...keys) {
  for (const key of keys) {
    if (finite(source?.[key])) return Number(source[key]);
  }
  return null;
}

function firstBoolean(source, ...keys) {
  for (const key of keys) {
    if (typeof source?.[key] === 'boolean') return source[key];
  }
  return null;
}

function eventType(event) {
  return String(event?.eventType ?? event?.event_type ?? '');
}

function eventTime(event) {
  return Number(event?.occurredAt ?? event?.occurred_at ?? 0) || 0;
}

function eventUsername(event) {
  return String(event?.username ?? event?.targetUsername ?? event?.target_username ?? '').replace(/^@/, '').toLowerCase();
}

function eventMetadata(event) {
  return event?.metadata && typeof event.metadata === 'object' ? event.metadata : {};
}

function eventMeaningful(event) {
  return eventMetadata(event).meaningful !== false;
}

function eventTopic(event) {
  return String(event?.topic ?? eventMetadata(event).topic ?? '').trim().toLowerCase();
}

function eventSourceKey(event) {
  return String(event?.sourceTweetId ?? event?.source_tweet_id ?? event?.candidateKey ?? event?.candidate_key ?? '');
}

function recentAgeHours(timestamp, now) {
  if (!timestamp) return null;
  return Math.max(0, (Number(now) - Number(timestamp)) / 3_600_000);
}

function recencyModifier(timestamp, now, values) {
  const age = recentAgeHours(timestamp, now);
  if (age == null) return 0;
  if (age <= 24) return values[0];
  if (age <= 72) return values[1];
  if (age <= 168) return values[2];
  return 0;
}

function saturationBand(pressure) {
  if (pressure < 25) return 'low';
  if (pressure < 50) return 'mild';
  if (pressure < 75) return 'meaningful';
  return 'high';
}

export function calculateSaturationPressure(target = {}, events = [], { now = Date.now() } = {}) {
  const username = String(target?.username || '').replace(/^@/, '').toLowerCase();
  const relevantEvents = (Array.isArray(events) ? events : [])
    .filter((event) => !username || !eventUsername(event) || eventUsername(event) === username)
    .filter(eventMeaningful)
    .sort((left, right) => eventTime(left) - eventTime(right));
  const outbound = relevantEvents.filter((event) => OUTBOUND_EVENT_TYPES.has(eventType(event)));
  const responses = relevantEvents.filter((event) => RESPONSE_EVENT_TYPES.has(eventType(event)));
  const continued = relevantEvents.filter((event) => eventType(event) === 'conversation_continued');
  const sevenDaysAgo = Number(now) - 7 * DAY_MS;
  const thirtyDaysAgo = Number(now) - 30 * DAY_MS;
  const outbound7d = outbound.filter((event) => eventTime(event) >= sevenDaysAgo);
  const outbound30d = outbound.filter((event) => eventTime(event) >= thirtyDaysAgo);
  const lastResponseAtDerived = Math.max(0, ...responses.map(eventTime)) || null;
  const lastContinuedAtDerived = Math.max(0, ...continued.map(eventTime)) || null;
  const lastOurInteractionAtDerived = Math.max(0, ...outbound.map(eventTime)) || null;
  const lastReciprocalAt = Math.max(lastResponseAtDerived || 0, lastContinuedAtDerived || 0) || null;
  const unanswered7dDerived = outbound7d.filter((outboundEvent) => {
    const outboundAt = eventTime(outboundEvent);
    const sourceKey = eventSourceKey(outboundEvent);
    return !relevantEvents.some((event) => {
      const type = eventType(event);
      if (!RESPONSE_EVENT_TYPES.has(type) && type !== 'conversation_continued') return false;
      if (eventTime(event) <= outboundAt) return false;
      const responseSource = eventSourceKey(event);
      return !sourceKey || !responseSource || responseSource === sourceKey;
    });
  }).length;
  const consecutiveUnansweredDerived = outbound.filter((event) => !lastReciprocalAt || eventTime(event) > lastReciprocalAt).length;
  const topicDiversityDerived = new Set(outbound30d.map(eventTopic).filter(Boolean)).size;

  const inputs = {
    interactions7d: firstFinite(target, 'interactions7d', 'interactions_7d') ?? outbound7d.length,
    interactions30d: firstFinite(target, 'interactions30d', 'interactions_30d') ?? outbound30d.length,
    unansweredInteractions7d: firstFinite(target, 'unansweredInteractions7d', 'unanswered_interactions_7d') ?? unanswered7dDerived,
    consecutiveUnanswered: firstFinite(target, 'consecutiveUnanswered', 'consecutive_unanswered') ?? consecutiveUnansweredDerived,
    lastOurInteractionAt: firstFinite(target, 'lastOurInteractionAt', 'last_our_interaction_at') ?? lastOurInteractionAtDerived,
    lastTargetResponseAt: firstFinite(target, 'lastTargetResponseAt', 'last_target_response_at') ?? lastResponseAtDerived,
    lastConversationContinuedAt: firstFinite(target, 'lastConversationContinuedAt', 'last_conversation_continued_at') ?? lastContinuedAtDerived,
    interactionTopicDiversity: firstFinite(target, 'interactionTopicDiversity', 'interaction_topic_diversity') ?? topicDiversityDerived,
  };
  const explicitActive = firstBoolean(target, 'activeConversation', 'active_conversation');
  const continuedAgeHours = recentAgeHours(inputs.lastConversationContinuedAt, now);
  const activeConversation = explicitActive ?? (continuedAgeHours != null && continuedAgeHours <= 24);

  const components = {
    recentInteractions7d: round(Math.min(24, nonNegative(inputs.interactions7d) * 3)),
    unansweredInteractions7d: round(Math.min(36, nonNegative(inputs.unansweredInteractions7d) * 9)),
    consecutiveUnanswered: round(Math.min(30, nonNegative(inputs.consecutiveUnanswered) * 10)),
    residualInteractions30d: round(Math.min(10, Math.max(0, nonNegative(inputs.interactions30d) - nonNegative(inputs.interactions7d)) * 0.5)),
  };
  const basePressure = Object.values(components).reduce((sum, value) => sum + value, 0);
  const modifiers = [];
  const addModifier = (name, value, reason) => {
    if (!value) return;
    modifiers.push({ name, value: round(value), reason, evidence: EMPIRICAL_VARIABLE });
  };

  addModifier(
    'recent_target_response',
    recencyModifier(inputs.lastTargetResponseAt, now, [-25, -15, -8]),
    'Recent observed target reciprocity lowers one-sided concentration pressure.',
  );
  addModifier(
    'recent_conversation_continuation',
    recencyModifier(inputs.lastConversationContinuedAt, now, [-20, -12, -6]),
    'A recently continued conversation lowers saturation pressure.',
  );
  addModifier(
    'topic_diversity',
    -Math.min(15, Math.max(0, nonNegative(inputs.interactionTopicDiversity) - 1) * 5),
    'More distinct interaction topics reduce concentration pressure.',
  );
  const lastOurAge = recentAgeHours(inputs.lastOurInteractionAt, now);
  addModifier(
    'interaction_age_decay',
    lastOurAge != null && lastOurAge > 168 ? -20 : lastOurAge != null && lastOurAge > 72 ? -10 : 0,
    'Older interaction bursts carry less current saturation pressure.',
  );
  addModifier(
    'active_bidirectional_conversation',
    activeConversation ? -45 : 0,
    'An active bidirectional conversation substantially offsets ordinary activity pressure.',
  );

  const overrideReasons = [];
  if (activeConversation) overrideReasons.push('active_conversation');
  if (firstBoolean(target, 'directQuestion', 'direct_question') === true) overrideReasons.push('direct_question');
  if (firstBoolean(target, 'newVerifiedEvidence', 'new_verified_evidence') === true) overrideReasons.push('new_verified_evidence');
  if (firstBoolean(target, 'differentTechnicalIssue', 'different_technical_issue') === true) overrideReasons.push('different_technical_issue');
  const targetResponseAgeHours = recentAgeHours(inputs.lastTargetResponseAt, now);
  if (targetResponseAgeHours != null && targetResponseAgeHours <= 1) overrideReasons.push('target_just_replied');

  const modifierTotal = modifiers.reduce((sum, item) => sum + item.value, 0);
  const unboundedPressure = clamp(basePressure + modifierTotal);
  const pressure = round(overrideReasons.length ? Math.min(24, unboundedPressure) : unboundedPressure);
  const band = saturationBand(pressure);

  return {
    pressure,
    band,
    modifiers,
    overrideReasons: [...new Set(overrideReasons)],
    explanation: `Saturation pressure is ${pressure}/100 (${band}); unanswered/consecutive activity raises pressure while reciprocity, topic diversity, age, and active conversation lower it.`,
    details: {
      inputs: { ...inputs, activeConversation },
      components,
      basePressure: round(basePressure),
      modifierTotal: round(modifierTotal),
      pressureBeforeOpportunityOverrides: round(unboundedPressure),
      bands: { low: '0-24', mild: '25-49', meaningful: '50-74', high: '75-100' },
      assumptions: {
        recentInteractions7d: { pointsPerInteraction: 3, cap: 24 },
        unansweredInteractions7d: { pointsPerInteraction: 9, cap: 36 },
        consecutiveUnanswered: { pointsPerInteraction: 10, cap: 30 },
        residualInteractions30d: { pointsPerInteraction: 0.5, cap: 10 },
        responseRecency: { within24h: -25, within72h: -15, within7d: -8 },
        continuationRecency: { within24h: -20, within72h: -12, within7d: -6 },
        topicDiversity: { pointsPerAdditionalTopic: -5, floor: -15 },
        interactionAgeDecay: { after72h: -10, after7d: -20 },
        activeConversation: -45,
        opportunityOverridePressureCap: 24,
      },
      evidence: EMPIRICAL_VARIABLE,
    },
  };
}

function replyText(reply) {
  if (typeof reply === 'string') return reply;
  return String(reply?.text ?? reply?.body ?? reply?.commentary ?? reply?.finalText ?? '');
}

function replyArchetype(reply) {
  if (!reply || typeof reply === 'string') return '';
  return String(reply.archetype ?? reply.replyArchetype ?? reply.reply_archetype ?? reply.metadata?.replyArchetype ?? '').trim();
}

function normalizeReply(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/@[a-z0-9_]+/g, '<user>')
    .replace(/[^\p{L}\p{N}<>+#.\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return normalizeReply(text).split(/\s+/).filter(Boolean);
}

function uniqueSet(values) {
  return new Set(values);
}

function shingles(values, size = 2) {
  if (!values.length) return new Set();
  if (values.length < size) return new Set([values.join(' ')]);
  const result = new Set();
  for (let index = 0; index <= values.length - size; index++) result.add(values.slice(index, index + size).join(' '));
  return result;
}

function jaccard(left, right) {
  if (!left.size && !right.size) return 1;
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection++;
  return intersection / (left.size + right.size - intersection);
}

function containment(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection++;
  return intersection / Math.min(left.size, right.size);
}

function characterShingles(text, size = 3) {
  const normalized = normalizeReply(text);
  if (!normalized) return new Set();
  if (normalized.length <= size) return new Set([normalized]);
  const result = new Set();
  for (let index = 0; index <= normalized.length - size; index++) result.add(normalized.slice(index, index + size));
  return result;
}

function replyMatchesScope(reply, targetUsername, topic) {
  if (typeof reply === 'string') return !targetUsername && !topic;
  if (targetUsername) {
    const username = String(reply?.targetUsername ?? reply?.username ?? reply?.target_username ?? '').replace(/^@/, '').toLowerCase();
    if (username !== String(targetUsername).replace(/^@/, '').toLowerCase()) return false;
  }
  if (topic) {
    const expected = String(topic).trim().toLowerCase();
    const topics = [reply?.topic, ...(Array.isArray(reply?.topics) ? reply.topics : [])]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    if (!topics.includes(expected)) return false;
  }
  return true;
}

export function analyzeReplyRepetition(recentReplies = [], { targetUsername = null, topic = null } = {}) {
  const replies = (Array.isArray(recentReplies) ? recentReplies : [])
    .filter((reply) => replyMatchesScope(reply, targetUsername, topic))
    .map((reply, index) => ({
      index,
      text: replyText(reply),
      normalized: normalizeReply(replyText(reply)),
      archetype: replyArchetype(reply),
    }))
    .filter((reply) => reply.normalized);

  const pairs = [];
  let exactDuplicate = false;
  let nearDuplicate = false;
  for (let leftIndex = 0; leftIndex < replies.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < replies.length; rightIndex++) {
      const left = replies[leftIndex];
      const right = replies[rightIndex];
      const leftTokens = tokens(left.normalized);
      const rightTokens = tokens(right.normalized);
      const leftSet = uniqueSet(leftTokens);
      const rightSet = uniqueSet(rightTokens);
      const tokenJaccard = jaccard(leftSet, rightSet);
      const shingleJaccard = jaccard(shingles(leftTokens), shingles(rightTokens));
      const tokenContainment = containment(leftSet, rightSet);
      const characterJaccard = jaccard(characterShingles(left.normalized), characterShingles(right.normalized));
      const similarity = 0.35 * tokenJaccard + 0.25 * shingleJaccard + 0.20 * tokenContainment + 0.20 * characterJaccard;
      const exact = left.normalized === right.normalized;
      const near = !exact
        && Math.min(leftTokens.length, rightTokens.length) >= 6
        && tokenContainment >= 0.80
        && shingleJaccard >= 0.50
        && characterJaccard >= 0.80;
      exactDuplicate ||= exact;
      nearDuplicate ||= near;
      pairs.push({
        leftIndex: left.index,
        rightIndex: right.index,
        exact,
        nearDuplicate: near,
        similarity: round(similarity * 100),
        tokenJaccard: round(tokenJaccard * 100),
        shingleJaccard: round(shingleJaccard * 100),
        tokenContainment: round(tokenContainment * 100),
        characterJaccard: round(characterJaccard * 100),
        leftText: left.text,
        rightText: right.text,
      });
    }
  }

  pairs.sort((left, right) => right.similarity - left.similarity || left.leftIndex - right.leftIndex || left.rightIndex - right.rightIndex);
  const phraseSimilarity = pairs.length ? pairs[0].similarity : 0;
  const archetypeCounts = new Map();
  for (const reply of replies) {
    if (!reply.archetype) continue;
    archetypeCounts.set(reply.archetype, (archetypeCounts.get(reply.archetype) || 0) + 1);
  }
  const dominantArchetype = [...archetypeCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] || null;
  const archetypedReplyCount = [...archetypeCounts.values()].reduce((sum, count) => sum + count, 0);
  const archetypeConcentration = dominantArchetype && archetypedReplyCount
    ? round((dominantArchetype[1] / archetypedReplyCount) * 100)
    : 0;

  const warnings = [];
  if (exactDuplicate) warnings.push({ code: 'exact_duplicate', level: 'hard_duplicate_fact', evidence: 'CODE_BACKED' });
  if (nearDuplicate) warnings.push({ code: 'near_duplicate', level: 'hard_duplicate_fact', evidence: EMPIRICAL_VARIABLE });
  if (!exactDuplicate && !nearDuplicate && phraseSimilarity >= 65) {
    warnings.push({ code: 'phrase_similarity', level: 'watch', evidence: EMPIRICAL_VARIABLE });
  }
  if (archetypedReplyCount >= 4 && archetypeConcentration >= 70) {
    warnings.push({ code: 'archetype_concentration', level: 'watch', evidence: EMPIRICAL_VARIABLE });
  }

  return {
    exactDuplicate,
    nearDuplicate,
    archetypeConcentration,
    phraseSimilarity,
    warnings,
    examples: pairs.slice(0, 3),
    details: {
      replyCount: replies.length,
      archetypedReplyCount,
      dominantArchetype: dominantArchetype?.[0] || null,
      archetypeCounts: Object.fromEntries([...archetypeCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
      thresholds: {
        phraseSimilarityWarning: 65,
        archetypeConcentrationWarning: 70,
        archetypeMinimumSample: 4,
        nearDuplicate: { minimumTokens: 6, tokenContainment: 80, shingleJaccard: 50, characterJaccard: 80 },
      },
      evidence: EMPIRICAL_VARIABLE,
    },
  };
}

function profileUsername(profile) {
  return String(profile?.username ?? profile?.targetUsername ?? profile?.target_username ?? '').replace(/^@/, '').toLowerCase();
}

function profileStage(profile) {
  return String(profile?.relationshipStage ?? profile?.relationship_stage ?? '');
}

function profileClasses(profile) {
  const classes = profile?.classes ?? profile?.classes_json ?? [];
  if (Array.isArray(classes)) return classes.map(String).filter(Boolean);
  return [];
}

function profileTopics(profile) {
  const topics = profile?.primaryTopics ?? profile?.primary_topics ?? profile?.nicheTags ?? [];
  return Array.isArray(topics) ? topics.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean) : [];
}

function meaningfulInitialReply(event) {
  if (eventType(event) !== 'our_reply' || !eventMeaningful(event)) return false;
  const kind = String(eventMetadata(event).engagementKind ?? eventMetadata(event).engagement_kind ?? 'initial_reply');
  return kind === 'initial_reply';
}

export function summarizeNetworkQuality(relationshipProfiles = [], relationshipEvents = [], options = {}) {
  const profiles = Array.isArray(relationshipProfiles) ? relationshipProfiles : [];
  const events = (Array.isArray(relationshipEvents) ? relationshipEvents : []).filter(eventMeaningful);
  const profilesByUsername = new Map(profiles.map((profile) => [profileUsername(profile), profile]).filter(([username]) => username));
  const outboundEvents = events.filter((event) => OUTBOUND_EVENT_TYPES.has(eventType(event)));
  const initialReplies = events.filter(meaningfulInitialReply);
  const engagedTargets = new Set(outboundEvents.map(eventUsername).filter(Boolean));
  for (const profile of profiles) {
    if (nonNegative(profile?.meaningfulInteractions ?? profile?.meaningful_interactions) > 0 && profileUsername(profile)) engagedTargets.add(profileUsername(profile));
  }

  const targetClasses = new Set();
  const targetTopics = new Set();
  for (const username of engagedTargets) {
    const profile = profilesByUsername.get(username);
    for (const className of profileClasses(profile)) targetClasses.add(className);
    for (const topicName of profileTopics(profile)) targetTopics.add(topicName);
  }
  for (const event of outboundEvents) {
    const topicName = eventTopic(event);
    if (topicName) targetTopics.add(topicName);
  }

  const initialReplyTargets = new Set(initialReplies.map(eventUsername).filter(Boolean));
  const initialReplySources = new Set(initialReplies.map(eventSourceKey).filter(Boolean));
  const respondingTargets = new Set(events
    .filter((event) => RESPONSE_EVENT_TYPES.has(eventType(event)))
    .filter((event) => {
      const username = eventUsername(event);
      const sourceKey = eventSourceKey(event);
      return (username && initialReplyTargets.has(username)) || (sourceKey && initialReplySources.has(sourceKey));
    })
    .map(eventUsername)
    .filter(Boolean));
  const continuationKeys = new Set();
  for (const event of events) {
    const metadata = eventMetadata(event);
    const type = eventType(event);
    const kind = String(metadata.engagementKind ?? metadata.engagement_kind ?? '');
    if (type === 'conversation_continued' || (type === 'our_reply' && kind === 'follow_up')) {
      const sourceKey = eventSourceKey(event);
      const username = eventUsername(event);
      if ((sourceKey && initialReplySources.has(sourceKey)) || (username && initialReplyTargets.has(username))) {
        continuationKeys.add(sourceKey || username);
      }
    }
  }

  const initialReplyCount = initialReplies.length;
  const authorResponseRate = initialReplyCount
    ? round((Math.min(respondingTargets.size, initialReplyCount) / initialReplyCount) * 100)
    : null;
  const conversationContinuationRate = initialReplyCount
    ? round((Math.min(continuationKeys.size, initialReplyCount) / initialReplyCount) * 100)
    : null;

  const interactionCounts = new Map();
  for (const event of outboundEvents) {
    const username = eventUsername(event);
    if (!username) continue;
    interactionCounts.set(username, (interactionCounts.get(username) || 0) + 1);
  }
  if (!interactionCounts.size) {
    for (const profile of profiles) {
      const username = profileUsername(profile);
      const count = nonNegative(profile?.meaningfulInteractions ?? profile?.meaningful_interactions);
      if (username && count) interactionCounts.set(username, count);
    }
  }
  const totalTargetInteractions = [...interactionCounts.values()].reduce((sum, count) => sum + count, 0);
  const topTarget = [...interactionCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] || null;
  const topTargetConcentration = totalTargetInteractions && topTarget
    ? round((topTarget[1] / totalTargetInteractions) * 100)
    : 0;

  const components = {
    targetDiversity: {
      uniqueTargets: engagedTargets.size,
      meaningfulInteractions: totalTargetInteractions,
    },
    classDiversity: {
      uniqueClasses: targetClasses.size,
      classes: [...targetClasses].sort(),
    },
    topicDiversity: {
      uniqueTopics: targetTopics.size,
      topics: [...targetTopics].sort(),
    },
    authorResponseRate: {
      targetsWhoReplied: respondingTargets.size,
      meaningfulInitialReplies: initialReplyCount,
      rate: authorResponseRate,
    },
    conversationContinuationRate: {
      interactionsWithFollowUp: continuationKeys.size,
      meaningfulInitialReplies: initialReplyCount,
      rate: conversationContinuationRate,
    },
    recurringRelationshipCount: profiles.filter((profile) => profileStage(profile) === 'recurring').length,
    connectedTargetCount: profiles.filter((profile) => ['connected', 'mutual'].includes(profileStage(profile))).length,
    mutualTargetCount: profiles.filter((profile) => profileStage(profile) === 'mutual').length,
    topTargetConcentration: {
      username: topTarget?.[0] || null,
      interactions: topTarget?.[1] || 0,
      meaningfulInteractions: totalTargetInteractions,
      rate: topTargetConcentration,
    },
  };

  return {
    score: null,
    components,
    trend: options?.trend ?? null,
    explanation: 'Network Quality is component-first in Phase 1D; no opaque composite score is assigned until a later measurement phase supplies calibrated goals.',
    evidence: 'CODE_BACKED',
  };
}

export function calculateInteractionYield(metrics = {}) {
  const components = {
    authorResponses: nonNegative(metrics.authorResponses ?? metrics.author_responses),
    continuedConversations: nonNegative(metrics.continuedConversations ?? metrics.continued_conversations),
    newRecurringRelationships: nonNegative(metrics.newRecurringRelationships ?? metrics.new_recurring_relationships),
    relevantTargetFollows: nonNegative(metrics.relevantTargetFollows ?? metrics.relevant_target_follows),
    newMutualConnections: nonNegative(metrics.newMutualConnections ?? metrics.new_mutual_connections),
    meaningfulInteractions: nonNegative(metrics.meaningfulInteractions ?? metrics.meaningful_interactions),
  };
  const weights = {
    authorResponses: 1,
    continuedConversations: 2,
    newRecurringRelationships: 3,
    relevantTargetFollows: 3,
    newMutualConnections: 4,
  };
  const numerator = components.authorResponses
    + 2 * components.continuedConversations
    + 3 * components.newRecurringRelationships
    + 3 * components.relevantTargetFollows
    + 4 * components.newMutualConnections;
  const denominator = Math.max(components.meaningfulInteractions, 1);

  return {
    value: numerator / denominator,
    numerator,
    denominator,
    components,
    weights,
    explanation: 'InteractionYield is an internal comparative diagnostic; overlapping outcomes remain visible in the raw numerator components.',
    evidence: EMPIRICAL_VARIABLE,
  };
}

function observationType(observation) {
  return String(observation?.type || '');
}

function observationTime(observation) {
  return Number(observation?.observedAt ?? observation?.observed_at ?? 0) || 0;
}

function observationMetadata(observation) {
  return observation?.metadata && typeof observation.metadata === 'object'
    ? observation.metadata
    : observation?.metadata_json && typeof observation.metadata_json === 'object'
      ? observation.metadata_json
      : {};
}

function observationKey(observation) {
  const metadata = observationMetadata(observation);
  return String(metadata.label ?? metadata.name ?? observation?.sourceRef ?? observation?.source_ref ?? 'visibility_label');
}

function hardObservationReasons(observations) {
  const ordered = (Array.isArray(observations) ? observations : []).slice().sort((left, right) => observationTime(left) - observationTime(right));
  const visibilityClears = ordered.filter((observation) => observationType(observation) === 'visibility_label_cleared');
  const reasons = [];
  for (const observation of ordered) {
    const type = observationType(observation);
    if (!HARD_OBSERVATION_TYPES.has(type)) continue;
    const metadata = observationMetadata(observation);
    if (metadata.active === false || metadata.resolved === true || metadata.cleared === true) continue;
    if (type === 'visibility_label_observed') {
      const key = observationKey(observation);
      const clearedLater = visibilityClears.some((clear) => (
        observationTime(clear) > observationTime(observation)
        && (observationKey(clear) === key || observationKey(clear) === 'visibility_label')
      ));
      if (clearedLater) continue;
    }
    reasons.push({
      code: type,
      level: 'constrained',
      message: `Supported observed hard evidence is active: ${type}.`,
      provenance: {
        type,
        observedAt: observationTime(observation) || null,
        source: observation?.source || null,
        sourceRef: observation?.sourceRef ?? observation?.source_ref ?? null,
        metadata,
      },
      evidence: OBSERVED_EVIDENCE,
    });
  }
  return reasons;
}

function explicitConstraintReasons(engagementSummary) {
  const supplied = engagementSummary?.observedConstraint;
  const constraints = Array.isArray(supplied) ? supplied : supplied ? [supplied] : [];
  return constraints
    .filter((constraint) => constraint !== false && constraint?.active !== false && constraint?.supported !== false)
    .map((constraint) => ({
      code: typeof constraint === 'string' ? constraint : String(constraint?.code || constraint?.type || 'observed_constraint'),
      level: 'constrained',
      message: typeof constraint === 'string'
        ? `Caller supplied an active observed/project hard constraint: ${constraint}.`
        : String(constraint?.message || 'Caller supplied an active observed/project hard constraint.'),
      provenance: typeof constraint === 'object' ? constraint : { value: constraint },
      evidence: OBSERVED_EVIDENCE,
    }));
}

function saturationSummaries(engagementSummary) {
  const value = engagementSummary?.saturationPressure ?? engagementSummary?.saturation ?? null;
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function deriveAccountHealth({
  observations = [],
  relationshipSummary = null,
  engagementSummary = null,
  repetitionSummary = null,
} = {}) {
  const constrainedReasons = [
    ...hardObservationReasons(observations),
    ...explicitConstraintReasons(engagementSummary),
  ];
  if (constrainedReasons.length) {
    return {
      state: 'constrained',
      reasons: constrainedReasons,
      provenance: constrainedReasons.map((reason) => reason.provenance),
      advisory: false,
      explanation: 'Account health is constrained because active supported hard evidence was supplied; soft behavioral diagnostics were not used to infer this state.',
      details: { watchThresholds: HEALTH_WATCH_THRESHOLDS, evidence: EMPIRICAL_VARIABLE },
    };
  }

  const watchReasons = [];
  const activeConversation = engagementSummary?.activeConversation === true || engagementSummary?.active_conversation === true;
  for (const saturation of saturationSummaries(engagementSummary)) {
    const pressure = finite(saturation?.pressure) ? Number(saturation.pressure) : finite(saturation) ? Number(saturation) : null;
    if (!activeConversation && pressure != null && pressure >= HEALTH_WATCH_THRESHOLDS.saturationPressure) {
      watchReasons.push({
        code: 'saturation_pressure',
        level: 'watch',
        message: `Saturation pressure is ${round(pressure)}/100; this is advisory and does not block a useful human-reviewed action.`,
        provenance: saturation,
        evidence: EMPIRICAL_VARIABLE,
      });
    }
  }

  const repetitionWarnings = Array.isArray(repetitionSummary?.warnings) ? repetitionSummary.warnings : [];
  const duplicateFact = repetitionSummary?.exactDuplicate === true || repetitionSummary?.nearDuplicate === true;
  if (duplicateFact) {
    watchReasons.push({
      code: repetitionSummary.exactDuplicate ? 'exact_duplicate_fact' : 'near_duplicate_fact',
      level: 'watch',
      message: 'An exact/high-confidence near-duplicate reply fact exists. The item-level writing/engagement owner may hard-stop that item, but repetition alone does not make account health constrained.',
      provenance: repetitionSummary,
      evidence: repetitionSummary.exactDuplicate ? 'CODE_BACKED' : EMPIRICAL_VARIABLE,
    });
  } else if (!activeConversation && repetitionWarnings.length) {
    watchReasons.push({
      code: 'reply_repetition_warning',
      level: 'watch',
      message: 'Recent reply structure/archetype repetition warrants advisory review.',
      provenance: repetitionWarnings,
      evidence: EMPIRICAL_VARIABLE,
    });
  }

  const components = relationshipSummary?.components || relationshipSummary || {};
  const concentration = components?.topTargetConcentration;
  if (!activeConversation
    && finite(concentration?.rate)
    && nonNegative(concentration?.meaningfulInteractions) >= HEALTH_WATCH_THRESHOLDS.minimumInitialReplies
    && Number(concentration.rate) >= HEALTH_WATCH_THRESHOLDS.topTargetConcentration) {
    watchReasons.push({
      code: 'network_concentration',
      level: 'watch',
      message: `Top-target concentration is ${round(concentration.rate)}% across ${concentration.meaningfulInteractions} meaningful interactions.`,
      provenance: concentration,
      evidence: EMPIRICAL_VARIABLE,
    });
  }

  const responseRate = components?.authorResponseRate;
  if (finite(responseRate?.rate)
    && nonNegative(responseRate?.meaningfulInitialReplies) >= HEALTH_WATCH_THRESHOLDS.minimumInitialReplies
    && Number(responseRate.rate) < HEALTH_WATCH_THRESHOLDS.lowAuthorResponseRate) {
    watchReasons.push({
      code: 'low_author_response_rate',
      level: 'watch',
      message: `Author response rate is ${round(responseRate.rate)}% across ${responseRate.meaningfulInitialReplies} meaningful initial replies.`,
      provenance: responseRate,
      evidence: EMPIRICAL_VARIABLE,
    });
  }

  const continuationRate = components?.conversationContinuationRate;
  if (finite(continuationRate?.rate)
    && nonNegative(continuationRate?.meaningfulInitialReplies) >= HEALTH_WATCH_THRESHOLDS.minimumInitialReplies
    && Number(continuationRate.rate) < HEALTH_WATCH_THRESHOLDS.lowContinuationRate) {
    watchReasons.push({
      code: 'low_conversation_continuation_rate',
      level: 'watch',
      message: `Conversation continuation rate is ${round(continuationRate.rate)}% across ${continuationRate.meaningfulInitialReplies} meaningful initial replies.`,
      provenance: continuationRate,
      evidence: EMPIRICAL_VARIABLE,
    });
  }

  const state = watchReasons.length ? 'watch' : 'healthy';
  return {
    state,
    reasons: watchReasons,
    provenance: watchReasons.map((reason) => reason.provenance),
    advisory: state === 'watch',
    explanation: state === 'healthy'
      ? 'No active supported hard constraint or material soft diagnostic was derived from the supplied inputs.'
      : 'WATCH is advisory: one or more empirical efficiency/concentration/repetition diagnostics warrant attention, but this core does not prohibit publishing or engagement.',
    details: { watchThresholds: HEALTH_WATCH_THRESHOLDS, evidence: EMPIRICAL_VARIABLE },
  };
}
