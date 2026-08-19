import { NICHE_GROUPS, classifyNiche } from './strategy.js';

export const TARGET_CLASSES = ['distribution', 'relationship', 'authority', 'customer_density', 'source'];
export const RELATIONSHIP_STAGES = ['observed', 'interacted', 'responsive', 'recurring', 'connected', 'mutual'];
export const RELATIONSHIP_EVENT_TYPES = [
  'observed_relevant_post',
  'our_reply',
  'our_quote',
  'target_reply',
  'target_quote',
  'target_repost',
  'target_follow',
  'we_followed',
  'conversation_continued',
  'conversation_expired',
  'mutual_reached',
];

const CORE_WEIGHTS = {
  topicFit: 0.30,
  audienceOverlap: 0.25,
  conversationQuality: 0.20,
  replyVisibility: 0.10,
  relationshipPotential: 0.15,
};
const OUTBOUND_EVENTS = new Set(['our_reply', 'our_quote']);
const RESPONSE_EVENTS = new Set(['target_reply', 'target_quote', 'target_repost']);
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

function unique(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function metadata(event) {
  return event?.metadata && typeof event.metadata === 'object' ? event.metadata : {};
}

function meaningful(event) {
  return metadata(event).meaningful !== false;
}

function eventTime(event) {
  return Number(event?.occurredAt ?? event?.occurred_at ?? 0) || 0;
}

function eventType(event) {
  return String(event?.eventType ?? event?.event_type ?? '');
}

function sourceKey(event) {
  return String(event?.sourceTweetId ?? event?.source_tweet_id ?? event?.candidateKey ?? event?.candidate_key ?? '');
}

function profileText(profile) {
  return `${profile?.displayName || ''} ${profile?.bio || ''}`.trim();
}

function profileNiche(profile) {
  const classified = classifyNiche(profileText(profile));
  const tags = unique(profile?.primaryTopics || profile?.nicheTags || classified.tags);
  const matchedKeywords = unique(profile?.matchedKeywords || classified.matches);
  const relevanceScore = finite(profile?.relevanceScore)
    ? clamp(profile.relevanceScore, 0, 50)
    : clamp(classified.score, 0, 50);
  return { tags, matchedKeywords, relevanceScore };
}

function observedComponent(profile, context, component) {
  if (finite(context?.[component])) return clamp(context[component]);
  if (profile?.scoreExplanation?.componentConfidence?.[component] === 'observed' && finite(profile?.[component])) {
    return clamp(profile[component]);
  }
  return null;
}

function topicFit(profile) {
  const niche = profileNiche(profile);
  const maxGroupWeight = Math.max(...NICHE_GROUPS.map((group) => group.weight));
  const groupWeights = new Map(NICHE_GROUPS.map((group) => [group.tag, group.weight]));
  const nicheOverlap = clamp((niche.relevanceScore / 50) * 100);
  const keywordOverlap = clamp(niche.matchedKeywords.length * 25);
  const agendaWeights = niche.tags
    .map((tag) => groupWeights.get(tag))
    .filter((value) => Number.isFinite(value));
  const researchAgendaFit = agendaWeights.length
    ? clamp((agendaWeights.reduce((sum, value) => sum + value, 0) / agendaWeights.length / maxGroupWeight) * 100)
    : 0;
  const value = 0.45 * nicheOverlap + 0.30 * keywordOverlap + 0.25 * researchAgendaFit;
  return {
    value: round(value),
    niche,
    details: {
      nicheOverlap: round(nicheOverlap),
      keywordOverlap: round(keywordOverlap),
      researchAgendaFit: round(researchAgendaFit),
    },
  };
}

function audienceOverlap(topicFitValue, context = {}) {
  const weighted = [{ value: topicFitValue, weight: 0.50, name: 'targetNicheSimilarity' }];
  if (finite(context.sharedClusterScore)) weighted.push({ value: clamp(context.sharedClusterScore), weight: 0.30, name: 'sharedClusterMembership' });
  if (finite(context.audienceEvidenceScore)) weighted.push({ value: clamp(context.audienceEvidenceScore), weight: 0.20, name: 'relevantAudienceEvidence' });
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const value = weighted.reduce((sum, item) => sum + item.value * (item.weight / totalWeight), 0);
  const present = new Set(weighted.map((item) => item.name));
  const missingSignals = ['sharedClusterMembership', 'relevantAudienceEvidence'].filter((name) => !present.has(name));
  return { value: round(value), missingSignals };
}

function roleSignal(text) {
  const matches = String(text || '').match(/\b(?:developer|engineer|maintainer|researcher|scientist|founder|cto|creator|open source|staff engineer|principal engineer)\b/gi) || [];
  return Math.min(2, new Set(matches.map((value) => value.toLowerCase())).size);
}

function authorityScore(profile, topicFitValue, context = {}) {
  if (finite(context.authorityScore)) return clamp(context.authorityScore);
  const text = profileText(profile);
  const strongMarkers = String(text).match(/\b(?:maintainer|researcher|research scientist|professor|staff engineer|principal engineer|distinguished engineer|cto|technical founder|open[- ]source maintainer|core contributor|creator)\b/gi) || [];
  const markerCount = Math.min(3, new Set(strongMarkers.map((value) => value.toLowerCase())).size);
  return round(clamp(topicFitValue * 0.30 + markerCount * 22));
}

function customerDensity(profile, topicFitValue, context = {}) {
  if (finite(context.customerDensity)) return clamp(context.customerDensity);
  if (finite(profile?.customerDensity) && Number(profile.customerDensity) > 0) return clamp(profile.customerDensity);
  if (!finite(context.audienceEvidenceScore)) return 0;
  const niche = profileNiche(profile);
  const commercialTags = niche.tags.filter((tag) => ['devtools', 'infra', 'builders', 'business', 'jobs/career'].includes(tag)).length;
  return round(clamp(context.audienceEvidenceScore * 0.65 + topicFitValue * 0.20 + Math.min(15, commercialTags * 5)));
}

export function summarizeRelationshipEvents(events = []) {
  const outbound = events.filter((event) => OUTBOUND_EVENTS.has(eventType(event)));
  const meaningfulOutbound = outbound.filter(meaningful);
  const allResponses = events.filter((event) => RESPONSE_EVENTS.has(eventType(event)));
  const responses = allResponses.filter(meaningful);
  const allContinued = events.filter((event) => eventType(event) === 'conversation_continued');
  const continued = allContinued.filter(meaningful);
  const times = (items) => items.map(eventTime).filter(Boolean);
  return {
    meaningfulInteractions: meaningfulOutbound.length,
    theirRepliesToUs: events.filter((event) => eventType(event) === 'target_reply').length,
    ourRepliesToThem: events.filter((event) => eventType(event) === 'our_reply').length,
    ourQuotesOfThem: events.filter((event) => eventType(event) === 'our_quote').length,
    theirQuotesOfUs: events.filter((event) => eventType(event) === 'target_quote').length,
    theirRepostsOfUs: events.filter((event) => eventType(event) === 'target_repost').length,
    targetResponses: responses.length,
    continuedConversations: continued.length,
    lastInteractionAt: Math.max(0, ...times(outbound)) || null,
    lastResponseAt: Math.max(0, ...times(allResponses), ...times(allContinued)) || null,
  };
}

function effectiveFollowState(profile, events = []) {
  let followsYou = Boolean(profile?.followsYou);
  let youFollow = Boolean(profile?.youFollow);
  for (const event of events) {
    const type = eventType(event);
    if (type === 'target_follow' || type === 'mutual_reached') followsYou = true;
    if (type === 'we_followed' || type === 'mutual_reached') youFollow = true;
  }
  return { followsYou, youFollow, mutual: followsYou && youFollow };
}

function recurringExchange(events = []) {
  const continued = events
    .filter((event) => eventType(event) === 'conversation_continued' && meaningful(event))
    .map((event, index) => ({ key: sourceKey(event) || `continued:${index}`, at: eventTime(event) }))
    .filter((item) => item.at);
  const continuedSources = new Set(continued.map((item) => item.key).filter((key) => !key.startsWith('continued:')));
  const bySource = new Map();
  for (const event of events) {
    const type = eventType(event);
    if ((!OUTBOUND_EVENTS.has(type) && !RESPONSE_EVENTS.has(type)) || !meaningful(event)) continue;
    const key = sourceKey(event);
    if (!key) continue;
    const current = bySource.get(key) || { key, outbound: false, response: false, at: 0 };
    if (OUTBOUND_EVENTS.has(type)) current.outbound = true;
    if (RESPONSE_EVENTS.has(type)) current.response = true;
    current.at = Math.max(current.at, eventTime(event));
    bySource.set(key, current);
  }
  const paired = [...bySource.values()]
    .filter((item) => item.outbound && item.response && item.at && !continuedSources.has(item.key))
    .map(({ key, at }) => ({ key, at }));
  const exchanges = [...continued, ...paired].sort((a, b) => a.at - b.at);
  if (exchanges.length < 2) return false;
  if (new Set(exchanges.map((item) => item.key)).size >= 2) return true;
  return exchanges.at(-1).at - exchanges[0].at >= DAY_MS;
}

export function deriveRelationshipStage(profile = {}, events = []) {
  const follow = effectiveFollowState(profile, events);
  if (follow.mutual) return 'mutual';
  if (follow.followsYou) return 'connected';
  if (recurringExchange(events)) return 'recurring';
  if (events.some((event) => RESPONSE_EVENTS.has(eventType(event)) && meaningful(event))) return 'responsive';
  if (events.some((event) => OUTBOUND_EVENTS.has(eventType(event)) && meaningful(event))) return 'interacted';
  return 'observed';
}

function conversationQuality(profile, topicFitValue, events, context = {}) {
  const observed = observedComponent(profile, context, 'conversationQuality');
  if (observed != null) return { value: round(observed), confidence: 'observed' };
  const summary = summarizeRelationshipEvents(events);
  const niche = profileNiche(profile);
  const heuristic = 20
    + Math.min(20, topicFitValue * 0.20)
    + Math.min(15, niche.matchedKeywords.length * 3)
    + roleSignal(profileText(profile)) * 5
    + Math.min(20, summary.targetResponses * 10 + summary.continuedConversations * 5);
  return {
    value: round(clamp(heuristic, 0, 65)),
    confidence: summary.targetResponses || summary.continuedConversations ? 'medium' : 'low',
  };
}

function replyVisibility(profile, events, context = {}) {
  const observed = observedComponent(profile, context, 'replyVisibility');
  if (observed != null) return { value: round(observed), confidence: 'observed' };
  const summary = summarizeRelationshipEvents(events);
  if (!summary.targetResponses && !summary.continuedConversations) return { value: null, confidence: 'missing' };
  return {
    value: round(clamp(45 + summary.targetResponses * 10 + summary.continuedConversations * 5, 0, 70)),
    confidence: 'medium',
  };
}

function relationshipPotential(profile, events) {
  const summary = summarizeRelationshipEvents(events);
  const follow = effectiveFollowState(profile, events);
  const sharedTopicSignal = Math.min(15, profileNiche(profile).tags.length * 5);
  const responseSignal = summary.targetResponses
    ? 35 + Math.min(10, Math.max(0, summary.targetResponses - 1) * 5)
    : 0;
  const value = sharedTopicSignal
    + (summary.meaningfulInteractions ? 10 : 0)
    + responseSignal
    + Math.min(20, summary.continuedConversations * 10)
    + (follow.followsYou ? 15 : 0)
    + (follow.youFollow ? 5 : 0)
    + (follow.mutual ? 5 : 0);
  return {
    value: round(clamp(value)),
    details: {
      sharedTopicSignal,
      meaningfulOutbound: summary.meaningfulInteractions,
      targetResponses: summary.targetResponses,
      continuedConversations: summary.continuedConversations,
      followsYou: follow.followsYou,
      youFollow: follow.youFollow,
      mutual: follow.mutual,
    },
  };
}

function reachModifier(profile, context = {}) {
  const followerCount = finite(context.followerCount)
    ? Math.max(0, Number(context.followerCount))
    : finite(profile?.followerCount)
      ? Math.max(0, Number(profile.followerCount))
      : null;
  if (followerCount == null) return { value: 0, followerCount: null, bucket: 'unavailable' };
  if (followerCount < 1_000) return { value: -2, followerCount, bucket: '<1k' };
  if (followerCount < 5_000) return { value: -1, followerCount, bucket: '1k-5k' };
  if (followerCount < 20_000) return { value: 0, followerCount, bucket: '5k-20k' };
  if (followerCount < 100_000) return { value: 1, followerCount, bucket: '20k-100k' };
  if (followerCount < 500_000) return { value: 3, followerCount, bucket: '100k-500k' };
  return { value: 5, followerCount, bucket: '500k+' };
}

function classifyTarget(profile, context, evidence) {
  const classes = [];
  const reasons = {};
  const follow = effectiveFollowState(profile, context.events || []);
  const hasInteraction = evidence.relationshipPotential.details.meaningfulOutbound > 0
    || evidence.relationshipPotential.details.targetResponses > 0;
  const hasAudienceEvidence = finite(context.sharedClusterScore) || finite(context.audienceEvidenceScore);

  if (evidence.topicFit.value >= 55 && (follow.followsYou || follow.youFollow || hasInteraction)) {
    classes.push('relationship');
    reasons.relationship = 'Strong topic fit plus observed follow or interaction evidence makes repeated useful exchange plausible.';
  }
  if (evidence.authorityScore >= 65) {
    classes.push('authority');
    reasons.authority = 'Profile role evidence and technical topic fit meet the conservative authority heuristic.';
  }
  if (hasAudienceEvidence && evidence.audienceOverlap.value >= 65 && evidence.conversationQuality.value >= 50) {
    classes.push('distribution');
    reasons.distribution = 'Observed audience/cluster evidence combines with strong niche overlap and technical-conversation quality.';
  }
  if (evidence.customerDensity >= 60) {
    classes.push('customer_density');
    reasons.customer_density = 'Observed audience evidence indicates a high concentration of developer/product-relevant readers.';
  }
  if (context.sourceEvidence === true || (evidence.authorityScore >= 70 && evidence.topicFit.value >= 70 && profileNiche(profile).matchedKeywords.length >= 2)) {
    classes.push('source');
    reasons.source = context.sourceEvidence === true
      ? 'Source value was explicitly observed in current context.'
      : 'Strong technical authority, agenda fit, and keyword specificity make the account a useful primary-source candidate.';
  }

  return { classes, reasons };
}

export function scoreRelationshipTarget(profile = {}, context = {}) {
  const events = Array.isArray(context.events) ? context.events : [];
  const topic = topicFit(profile);
  const overlap = observedComponent(profile, context, 'audienceOverlap');
  const audience = overlap == null ? audienceOverlap(topic.value, context) : { value: round(overlap), missingSignals: [] };
  const conversation = conversationQuality(profile, topic.value, events, context);
  const visibility = replyVisibility(profile, events, context);
  const potentialObserved = observedComponent(profile, context, 'relationshipPotential');
  const potential = potentialObserved == null
    ? relationshipPotential(profile, events)
    : { value: round(potentialObserved), details: relationshipPotential(profile, events).details };
  const reach = reachModifier(profile, context);
  const authority = authorityScore(profile, topic.value, context);
  const density = customerDensity(profile, topic.value, context);

  const components = {
    topicFit: topic.value,
    audienceOverlap: audience.value,
    conversationQuality: conversation.value,
    replyVisibility: visibility.value,
    relationshipPotential: potential.value,
    reachModifier: reach.value,
  };
  const available = Object.entries(CORE_WEIGHTS).filter(([name]) => finite(components[name]));
  const totalWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
  const logMean = available.reduce((sum, [name, weight]) => {
    const normalizedWeight = totalWeight ? weight / totalWeight : 0;
    return sum + normalizedWeight * Math.log(Math.max(Number(components[name]), 10) / 100);
  }, 0);
  const base = available.length ? 100 * Math.exp(logMean) : 0;
  const targetScore = round(clamp(base + reach.value));
  const missingComponents = Object.keys(CORE_WEIGHTS).filter((name) => !finite(components[name]));
  const evidence = {
    topicFit: topic,
    audienceOverlap: audience,
    conversationQuality: conversation,
    replyVisibility: visibility,
    relationshipPotential: potential,
    authorityScore: authority,
    customerDensity: density,
  };
  const classification = classifyTarget(profile, { ...context, events }, evidence);

  return {
    targetScore,
    components,
    classes: classification.classes,
    explanation: {
      model: 'phase1b-target-score',
      missingComponents,
      componentConfidence: {
        topicFit: 'taxonomy',
        audienceOverlap: audience.missingSignals.length ? 'low' : 'observed',
        conversationQuality: conversation.confidence,
        replyVisibility: visibility.confidence,
        relationshipPotential: 'event/follow evidence',
      },
      topicFit: topic.details,
      audienceOverlapMissingSignals: audience.missingSignals,
      relationshipPotential: potential.details,
      classReasons: classification.reasons,
      reach: reach,
    },
    signals: {
      relevanceScore: topic.niche.relevanceScore,
      authorityScore: authority,
      customerDensity: density,
      primaryTopics: topic.niche.tags,
      matchedKeywords: topic.niche.matchedKeywords,
    },
  };
}

export function refreshRelationshipProfile(profile = {}, context = {}) {
  const events = Array.isArray(context.events) ? context.events : [];
  const now = Number(context.now || Date.now());
  const summary = summarizeRelationshipEvents(events);
  const follow = effectiveFollowState(profile, events);
  const stage = deriveRelationshipStage({ ...profile, ...follow }, events);
  const score = scoreRelationshipTarget({ ...profile, ...follow, ...summary }, { ...context, events });
  const eventTimes = events.map(eventTime).filter(Boolean);
  const firstSeenAt = Number(profile.firstSeenAt || profile.lastSeenAt || (eventTimes.length ? Math.min(...eventTimes) : now));
  const lastSeenAt = Math.max(Number(profile.lastSeenAt || 0), firstSeenAt);

  return {
    username: String(profile.username || '').replace(/^@/, '').toLowerCase(),
    displayName: profile.displayName || profile.username || '',
    bio: profile.bio || '',
    classes: score.classes,
    primaryTopics: score.signals.primaryTopics,
    matchedKeywords: score.signals.matchedKeywords,
    topicFit: score.components.topicFit,
    audienceOverlap: score.components.audienceOverlap,
    conversationQuality: score.components.conversationQuality,
    replyVisibility: score.components.replyVisibility,
    relationshipPotential: score.components.relationshipPotential,
    reachModifier: score.components.reachModifier,
    targetScore: score.targetScore,
    relevanceScore: score.signals.relevanceScore,
    customerDensity: score.signals.customerDensity,
    authorityScore: score.signals.authorityScore,
    followsYou: follow.followsYou,
    youFollow: follow.youFollow,
    mutual: follow.mutual,
    relationshipStage: stage,
    meaningfulInteractions: summary.meaningfulInteractions,
    theirRepliesToUs: summary.theirRepliesToUs,
    ourRepliesToThem: summary.ourRepliesToThem,
    ourQuotesOfThem: summary.ourQuotesOfThem,
    theirQuotesOfUs: summary.theirQuotesOfUs,
    theirRepostsOfUs: summary.theirRepostsOfUs,
    firstSeenAt,
    lastSeenAt,
    lastInteractionAt: summary.lastInteractionAt,
    lastResponseAt: summary.lastResponseAt,
    lastScoredAt: now,
    scoreExplanation: score.explanation,
  };
}
