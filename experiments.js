import { calculateInteractionYield } from './health.js';

const PER_1000 = 1000;
const HOUR_MS = 3_600_000;
const CONFIDENCE_ORDER = ['low', 'medium', 'high'];

export const EXPERIMENT_DIMENSIONS = Object.freeze({
  content: Object.freeze(['style', 'hook_type', 'media_type', 'format']),
  timing: Object.freeze(['timing_bucket']),
  network: Object.freeze([
    'target_class',
    'target_score_bucket',
    'target_size_bucket',
    'reply_age_bucket',
    'conversation_saturation_bucket',
    'reply_archetype',
    'relationship_stage',
    'interaction_volume_bucket',
    'target_concentration_bucket',
    'archetype_repetition_bucket',
  ]),
});

export const CONTENT_METRICS = Object.freeze([
  'views_per_hour',
  'replies_per_1000_views',
  'reposts_per_1000_views',
  'visible_engagement_per_1000_views',
  'associated_follows_per_1000_views',
]);

export const NETWORK_METRICS = Object.freeze([
  'author_response_rate',
  'conversation_continuation_rate',
  'relationship_stage_progression',
  'connected_target_conversion',
  'recurring_relationship_conversion',
  'mutual_relationship_count',
  'interaction_yield',
  'target_diversity',
  'class_diversity',
  'topic_diversity',
  'top_target_concentration',
]);

export const EVIDENCE_STATES = Object.freeze([
  'insufficient',
  'preliminary',
  'directional',
  'repeated',
]);

const DIMENSION_KIND = new Map([
  ...EXPERIMENT_DIMENSIONS.content.map((dimension) => [dimension, 'content']),
  ...EXPERIMENT_DIMENSIONS.timing.map((dimension) => [dimension, 'timing']),
  ...EXPERIMENT_DIMENSIONS.network.map((dimension) => [dimension, 'network']),
]);

const CONTENT_CONFOUNDER_FIELDS = [
  'topic',
  'topicTags',
  'format',
  'mediaType',
  'timingBucket',
  'healthState',
];

const NETWORK_CONFOUNDER_FIELDS = [
  'targetUsername',
  'targetClass',
  'targetScoreBucket',
  'targetSizeBucket',
  'replyAgeBucket',
  'replyArchetype',
  'topic',
  'relationshipStageBefore',
  'conversationSaturationBucket',
  'interactionVolumeBucket',
  'targetConcentrationBucket',
  'archetypeRepetitionBucket',
  'healthState',
];

const POPULATION_ALIASES = Object.freeze({
  topicTags: ['topicTags', 'topic_tags', 'topics', 'topic', 'niche.tags', 'candidate.niche.tags'],
  targetClass: ['targetClass', 'target_class'],
  targetScoreBucket: ['targetScoreBucket', 'target_score_bucket'],
  targetSizeBucket: ['targetSizeBucket', 'target_size_bucket'],
  replyAgeBucket: ['replyAgeBucket', 'reply_age_bucket'],
  replyArchetype: ['replyArchetype', 'reply_archetype'],
  relationshipStage: ['relationshipStage', 'relationship_stage'],
  relationshipStageBefore: ['relationshipStageBefore', 'relationship_stage_before'],
  conversationSaturationBucket: ['conversationSaturationBucket', 'conversation_saturation_bucket'],
  interactionVolumeBucket: ['interactionVolumeBucket', 'interaction_volume_bucket'],
  targetConcentrationBucket: ['targetConcentrationBucket', 'target_concentration_bucket'],
  archetypeRepetitionBucket: ['archetypeRepetitionBucket', 'archetype_repetition_bucket'],
  timingBucket: ['timingBucket', 'timing_bucket'],
  mediaType: ['mediaType', 'media_type'],
  healthState: ['healthState', 'health_state', 'health.state'],
  targetUsername: ['targetUsername', 'target_username', 'username'],
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegative(value) {
  const number = finiteNumber(value);
  return number == null ? 0 : Math.max(0, number);
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(Number(value || 0) * scale) / scale;
}

function percentage(numerator, denominator) {
  return denominator > 0 ? round((numerator / denominator) * 100) : null;
}

function per1000(numerator, views) {
  return views > 0 ? round((numerator / views) * PER_1000) : null;
}

function snakeCase(value) {
  return String(value || '').replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function readKey(object, key) {
  if (!isPlainObject(object)) return undefined;
  if (Object.hasOwn(object, key)) return object[key];
  const snake = snakeCase(key);
  if (Object.hasOwn(object, snake)) return object[snake];
  return undefined;
}

function readPath(object, path) {
  let current = object;
  for (const part of String(path || '').split('.')) {
    current = readKey(current, part);
    if (current === undefined) return undefined;
  }
  return current;
}

function resolveValue(item, context, key) {
  const aliases = POPULATION_ALIASES[key] || [key, snakeCase(key)];
  const roots = [item, item?.network, item?.networkOutcome, item?.item, item?.context, context];
  for (const root of roots) {
    for (const alias of aliases) {
      const value = readPath(root, alias);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

function normalizedComparable(value) {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return value;
}

function criterionMatches(actual, expected) {
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  const actualValues = Array.isArray(actual) ? actual : [actual];
  return actualValues.some((actualValue) => expectedValues.some((expectedValue) => (
    normalizedComparable(actualValue) === normalizedComparable(expectedValue)
  )));
}

function normalizeVariant(variant) {
  if (typeof variant === 'string') return { label: variant.trim(), config: {} };
  if (!isPlainObject(variant)) return { label: '', config: {}, invalid: true };
  const configMissing = variant.config == null;
  return {
    label: String(variant.label || '').trim(),
    config: configMissing ? {} : isPlainObject(variant.config) ? { ...variant.config } : {},
    ...(!configMissing && !isPlainObject(variant.config) ? { invalidConfig: true } : {}),
  };
}

function supportedMetricsForDimension(dimension) {
  return DIMENSION_KIND.get(dimension) === 'network' ? NETWORK_METRICS : CONTENT_METRICS;
}

function normalizeDefinition(definition = {}) {
  return {
    name: String(definition.name || '').trim(),
    hypothesis: String(definition.hypothesis || '').trim(),
    dimension: String(definition.dimension || '').trim(),
    population: definition.population == null ? {} : definition.population,
    primaryMetric: String(definition.primaryMetric ?? definition.primary_metric ?? '').trim(),
    secondaryMetrics: Array.isArray(definition.secondaryMetrics ?? definition.secondary_metrics)
      ? [...(definition.secondaryMetrics ?? definition.secondary_metrics)].map((value) => String(value || '').trim())
      : [],
    variants: Array.isArray(definition.variants) ? definition.variants.map(normalizeVariant) : [],
    minimumCompletedPerVariant: finiteNumber(
      definition.minimumCompletedPerVariant ?? definition.minimum_completed_per_variant,
    ),
    status: definition.status == null ? null : String(definition.status),
  };
}

export function validateExperimentDefinition(definition = {}) {
  const experiment = normalizeDefinition(definition);
  const errors = [];
  if (!experiment.name) errors.push({ code: 'NAME_REQUIRED', message: 'Experiment name is required.' });
  if (!experiment.hypothesis) errors.push({ code: 'HYPOTHESIS_REQUIRED', message: 'Experiment hypothesis is required.' });
  if (!DIMENSION_KIND.has(experiment.dimension)) {
    errors.push({ code: 'UNSUPPORTED_DIMENSION', message: `Unsupported experiment dimension: ${experiment.dimension || 'missing'}.` });
  }
  if (!isPlainObject(experiment.population)) {
    errors.push({ code: 'INVALID_POPULATION', message: 'Experiment population must be an object.' });
  } else {
    for (const [key, expected] of Object.entries(experiment.population)) {
      const values = Array.isArray(expected) ? expected : [expected];
      if (!key.trim() || !values.length || values.some((value) => value == null || typeof value === 'object')) {
        errors.push({ code: 'INVALID_POPULATION_CRITERION', message: `Population criterion ${key || 'missing'} must be a scalar or non-empty scalar array.` });
      }
    }
  }

  const supportedMetrics = supportedMetricsForDimension(experiment.dimension);
  if (!experiment.primaryMetric) {
    errors.push({ code: 'PRIMARY_METRIC_REQUIRED', message: 'A primary metric is required.' });
  } else if (DIMENSION_KIND.has(experiment.dimension) && !supportedMetrics.includes(experiment.primaryMetric)) {
    errors.push({ code: 'UNSUPPORTED_PRIMARY_METRIC', message: `${experiment.primaryMetric} is not supported for ${experiment.dimension}.` });
  }
  for (const metric of experiment.secondaryMetrics) {
    if (!metric || (DIMENSION_KIND.has(experiment.dimension) && !supportedMetrics.includes(metric))) {
      errors.push({ code: 'UNSUPPORTED_SECONDARY_METRIC', message: `Unsupported secondary metric: ${metric || 'missing'}.` });
    }
  }

  if (experiment.variants.length < 2) {
    errors.push({ code: 'VARIANTS_REQUIRED', message: 'At least two variants are required.' });
  }
  const labels = new Set();
  for (const variant of experiment.variants) {
    if (variant.invalid || !variant.label) {
      errors.push({ code: 'INVALID_VARIANT', message: 'Every variant requires a non-empty label.' });
      continue;
    }
    if (variant.invalidConfig) {
      errors.push({ code: 'INVALID_VARIANT_CONFIG', message: `Variant ${variant.label} config must be an object.` });
    }
    const key = variant.label.toLowerCase();
    if (labels.has(key)) errors.push({ code: 'DUPLICATE_VARIANT', message: `Variant label is duplicated: ${variant.label}.` });
    labels.add(key);
  }

  if (!Number.isInteger(experiment.minimumCompletedPerVariant) || experiment.minimumCompletedPerVariant < 1) {
    errors.push({ code: 'MINIMUM_COMPLETED_REQUIRED', message: 'minimumCompletedPerVariant must be a positive integer.' });
  }

  return {
    valid: errors.length === 0,
    errors,
    experiment,
    dimensionKind: DIMENSION_KIND.get(experiment.dimension) || null,
    assignmentPolicy: 'caller_selected',
    randomized: false,
    duplicatePairingRequired: false,
  };
}

export function evaluateExperimentPopulation(definition, item = {}, context = {}) {
  const validation = validateExperimentDefinition(definition);
  if (!validation.valid) {
    return { eligible: false, criteria: [], blockers: validation.errors, definitionValid: false };
  }

  const criteria = [];
  const blockers = [];
  for (const [key, expected] of Object.entries(validation.experiment.population)) {
    const actual = resolveValue(item, context, key);
    if (actual === undefined) {
      const result = { key, expected, actual: null, matched: false, reason: 'missing_input' };
      criteria.push(result);
      blockers.push({ code: 'POPULATION_INPUT_MISSING', message: `Population field ${key} was not supplied.` });
      continue;
    }
    const matched = criterionMatches(actual, expected);
    criteria.push({ key, expected, actual, matched, reason: matched ? 'matched' : 'mismatch' });
    if (!matched) blockers.push({ code: 'POPULATION_MISMATCH', message: `Population field ${key} does not match the experiment criterion.` });
  }

  if (validation.experiment.dimension === 'timing_bucket' && context?.timingHistorySufficient !== true) {
    blockers.push({
      code: 'TIMING_HISTORY_NOT_CONFIRMED',
      message: 'Timing experiments require caller-confirmed sufficient schedule history; no history threshold is invented by this core.',
    });
  }

  return {
    eligible: blockers.length === 0,
    criteria,
    blockers,
    definitionValid: true,
  };
}

export function validateVariantAssignment(definition, variantLabel, item = {}, context = {}) {
  const validation = validateExperimentDefinition(definition);
  const label = String(variantLabel || '').trim();
  const variant = validation.experiment.variants.find((candidate) => candidate.label === label) || null;
  const population = validation.valid
    ? evaluateExperimentPopulation(definition, item, context)
    : { eligible: false, criteria: [], blockers: validation.errors, definitionValid: false };
  const errors = [...validation.errors];
  if (validation.experiment.status !== 'active') {
    errors.push({ code: 'EXPERIMENT_NOT_ACTIVE', message: 'Experiment variant assignment requires an active experiment.' });
  }
  if (!variant) errors.push({ code: 'UNKNOWN_VARIANT', message: `Unknown experiment variant: ${label || 'missing'}.` });
  errors.push(...population.blockers);
  return {
    valid: errors.length === 0,
    errors,
    variant,
    population,
    assignmentPolicy: 'caller_selected',
    randomized: false,
    duplicatePairingRequired: false,
  };
}

function overlapCountFrom(input) {
  const supplied = input?.overlappingMainFeedPublications
    ?? input?.overlapping_main_feed_publications
    ?? input?.overlapCount
    ?? input?.overlap_count;
  if (Array.isArray(supplied)) return supplied.length;
  const count = finiteNumber(supplied);
  return count == null ? null : Math.max(0, Math.floor(count));
}

function downgradeConfidence(confidence) {
  const index = CONFIDENCE_ORDER.indexOf(confidence);
  return index <= 0 ? 'low' : CONFIDENCE_ORDER[index - 1];
}

export function calculateAttributionConfidence(input = {}) {
  const overlapCount = overlapCountFrom(input);
  if (overlapCount == null) {
    return {
      confidence: null,
      baseConfidence: null,
      overlapCount: null,
      downgrades: [],
      complete: false,
      associatedOnly: true,
      causalClaimAllowed: false,
      explanation: 'Attribution confidence requires the number of overlapping main-feed publications; follower change remains associated, not causal.',
    };
  }

  const baseConfidence = overlapCount === 0 ? 'high' : overlapCount === 1 ? 'medium' : 'low';
  const downgrades = [];
  if (input.majorExternalMention === true || input.major_external_mention === true || input.externalReferral === true || input.external_referral === true) {
    downgrades.push({ code: 'EXTERNAL_MENTION_OR_REFERRAL', message: 'A known external mention/referral overlaps the measurement window.' });
  }
  if (input.baselineMateriallyLate === true || input.baseline_materially_late === true || input.followerBaselineMateriallyLate === true) {
    downgrades.push({ code: 'LATE_FOLLOWER_BASELINE', message: 'The follower baseline was materially late.' });
  }
  if (input.profileChanged === true || input.profile_changed === true || input.accountProfileChanged === true) {
    downgrades.push({ code: 'PROFILE_CHANGE', message: 'A known account/profile change occurred during the measurement window.' });
  }

  let confidence = baseConfidence;
  for (const downgrade of downgrades) confidence = downgradeConfidence(confidence);
  return {
    confidence,
    baseConfidence,
    overlapCount,
    downgrades,
    complete: true,
    associatedOnly: true,
    causalClaimAllowed: false,
    explanation: `Follower change is associated with the measurement window; attribution confidence is ${confidence} after overlap and supplied downgrade context.`,
  };
}

function elapsedHoursOf(measurement) {
  const hours = finiteNumber(measurement?.elapsedHours ?? measurement?.elapsed_hours);
  if (hours != null && hours > 0) return hours;
  const elapsedMinutes = finiteNumber(measurement?.elapsedMinutes ?? measurement?.elapsed_minutes);
  if (elapsedMinutes != null && elapsedMinutes > 0) return elapsedMinutes / 60;
  const capturedAt = finiteNumber(measurement?.capturedAt ?? measurement?.captured_at);
  const publishedAt = finiteNumber(measurement?.publishedAt ?? measurement?.published_at);
  if (capturedAt != null && publishedAt != null && capturedAt > publishedAt) return (capturedAt - publishedAt) / HOUR_MS;
  const windowMinutes = finiteNumber(measurement?.windowMinutes ?? measurement?.window_minutes);
  return windowMinutes != null && windowMinutes > 0 ? windowMinutes / 60 : null;
}

export function normalizeContentMeasurement(measurement = {}) {
  const views = nonNegative(measurement.views);
  const likes = nonNegative(measurement.likes);
  const reposts = nonNegative(measurement.reposts ?? measurement.retweets);
  const replies = nonNegative(measurement.replies);
  const suppliedBookmarks = finiteNumber(measurement.bookmarks ?? measurement.bookmarkCount ?? measurement.bookmark_count);
  const bookmarks = suppliedBookmarks == null ? null : Math.max(0, suppliedBookmarks);
  const followerDelta = finiteNumber(measurement.followerDelta ?? measurement.follower_delta) ?? 0;
  const elapsedHours = elapsedHoursOf(measurement);
  const visibleEngagement = likes + reposts + replies;
  return {
    raw: {
      views,
      likes,
      reposts,
      replies,
      bookmarks,
      followerDelta,
      visibleEngagement,
      elapsedHours,
    },
    metrics: {
      views_per_hour: elapsedHours && elapsedHours > 0 ? round(views / elapsedHours) : null,
      replies_per_1000_views: per1000(replies, views),
      reposts_per_1000_views: per1000(reposts, views),
      bookmarks_per_1000_views: bookmarks == null ? null : per1000(bookmarks, views),
      visible_engagement_per_1000_views: per1000(visibleEngagement, views),
      associated_follows_per_1000_views: per1000(followerDelta, views),
    },
    attribution: calculateAttributionConfidence({ ...measurement, ...(measurement.attribution || {}) }),
  };
}

function distribution(values = []) {
  const counts = new Map();
  for (const value of values.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))) {
    if (value == null || value === '') continue;
    const key = typeof value === 'object' ? stableStringify(value) : String(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return {
    total,
    values: Object.fromEntries([...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => [key, { count, share: total ? round(count / total) : 0 }])),
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function observationValue(observation, key) {
  const context = observation?.context || {};
  for (const source of [observation, observation?.network, observation?.networkOutcome, observation?.item]) {
    const value = resolveValue(source || {}, context, key);
    if (value !== undefined) return value;
  }
  return undefined;
}

function summarizeConfounders(observations, fields, exclusions = []) {
  const excluded = new Set(exclusions.map(String));
  const discovered = new Set(fields.filter((field) => !excluded.has(field) && !excluded.has(snakeCase(field))));
  for (const observation of observations) {
    if (!isPlainObject(observation?.confounders)) continue;
    for (const key of Object.keys(observation.confounders)) if (!excluded.has(key)) discovered.add(key);
  }

  const result = {};
  for (const key of [...discovered].sort()) {
    const values = observations.map((observation) => {
      if (isPlainObject(observation?.confounders) && Object.hasOwn(observation.confounders, key)) return observation.confounders[key];
      return observationValue(observation, key);
    }).filter((value) => value !== undefined);
    if (values.length) result[key] = distribution(values);
  }
  return result;
}

function summarizeContext(observations) {
  const healthValues = observations.map((observation) => (
    observation?.health?.state ?? observationValue(observation, 'healthState')
  )).filter((value) => value !== undefined && value !== null && value !== '');

  const networkKeys = new Set();
  for (const observation of observations) {
    if (!isPlainObject(observation?.networkContext)) continue;
    for (const key of Object.keys(observation.networkContext)) networkKeys.add(key);
  }
  const network = {};
  for (const key of [...networkKeys].sort()) {
    network[key] = distribution(observations
      .map((observation) => observation?.networkContext?.[key])
      .filter((value) => value !== undefined));
  }
  return {
    healthStates: distribution(healthValues),
    network,
    causalInterpretation: 'context_only',
  };
}

export function summarizeContentCohort(observations = [], options = {}) {
  const rows = Array.isArray(observations) ? observations : [];
  const normalized = rows.map((observation) => normalizeContentMeasurement(
    observation?.measurement ?? observation?.publicationMeasurement ?? observation,
  ));
  const totals = normalized.reduce((acc, row) => {
    acc.views += row.raw.views;
    acc.likes += row.raw.likes;
    acc.reposts += row.raw.reposts;
    acc.replies += row.raw.replies;
    if (row.raw.bookmarks != null) {
      acc.bookmarks += row.raw.bookmarks;
      acc.bookmarkViews += row.raw.views;
      acc.bookmarkObservationCount += 1;
    }
    acc.followerDelta += row.raw.followerDelta;
    acc.visibleEngagement += row.raw.visibleEngagement;
    if (row.raw.elapsedHours != null) {
      acc.elapsedHours += row.raw.elapsedHours;
      acc.viewsWithElapsed += row.raw.views;
      acc.elapsedObservationCount += 1;
    }
    return acc;
  }, {
    views: 0,
    likes: 0,
    reposts: 0,
    replies: 0,
    bookmarks: 0,
    bookmarkViews: 0,
    bookmarkObservationCount: 0,
    followerDelta: 0,
    visibleEngagement: 0,
    elapsedHours: 0,
    viewsWithElapsed: 0,
    elapsedObservationCount: 0,
  });

  return {
    kind: 'content',
    sampleSize: rows.length,
    totals,
    metrics: {
      views_per_hour: totals.elapsedHours > 0 ? round(totals.viewsWithElapsed / totals.elapsedHours) : null,
      replies_per_1000_views: per1000(totals.replies, totals.views),
      reposts_per_1000_views: per1000(totals.reposts, totals.views),
      bookmarks_per_1000_views: totals.bookmarkObservationCount > 0 ? per1000(totals.bookmarks, totals.bookmarkViews) : null,
      visible_engagement_per_1000_views: per1000(totals.visibleEngagement, totals.views),
      associated_follows_per_1000_views: per1000(totals.followerDelta, totals.views),
    },
    attributionConfidence: distribution(normalized.map((row) => row.attribution.confidence || 'unknown')),
    confounders: summarizeConfounders(rows, CONTENT_CONFOUNDER_FIELDS, options.excludeConfounders || []),
    context: summarizeContext(rows),
    causalClaimAllowed: false,
  };
}

function networkValue(observation, camel, snake = snakeCase(camel)) {
  const network = observation?.network ?? observation?.networkOutcome ?? observation;
  return network?.[camel] ?? network?.[snake] ?? observation?.[camel] ?? observation?.[snake];
}

function outcomeCount(observation, camel, snake) {
  const value = networkValue(observation, camel, snake);
  if (value === true) return 1;
  if (value === false || value == null) return 0;
  return nonNegative(value);
}

function targetIdentity(observation) {
  return String(
    networkValue(observation, 'targetUsername', 'target_username')
      ?? networkValue(observation, 'username', 'username')
      ?? '',
  ).replace(/^@/, '').toLowerCase();
}

function valuesFrom(observations, key) {
  return observations.map((observation) => observationValue(observation, key)).flatMap((value) => (
    Array.isArray(value) ? value : [value]
  )).filter((value) => value != null && value !== '');
}

export function summarizeNetworkCohort(observations = [], options = {}) {
  const rows = Array.isArray(observations) ? observations : [];
  const engagedTargets = new Set();
  const initialTargets = new Set();
  const responseTargets = new Set();
  const continuationTargets = new Set();
  const progressedTargets = new Set();
  const connectedTargets = new Set();
  const recurringTargets = new Set();
  const mutualTargets = new Set();
  const interactionCounts = new Map();
  let missingTargetIdentityForRates = 0;
  let missingTargetIdentityForInteractions = 0;
  const components = {
    authorResponses: 0,
    continuedConversations: 0,
    newRecurringRelationships: 0,
    relevantTargetFollows: 0,
    newMutualConnections: 0,
    meaningfulInteractions: 0,
  };

  for (const observation of rows) {
    const target = targetIdentity(observation);
    const meaningfulInitialReplies = outcomeCount(observation, 'meaningfulInitialReplies', 'meaningful_initial_replies');
    const authorResponses = outcomeCount(observation, 'authorResponses', 'author_responses');
    const continuedConversations = outcomeCount(observation, 'continuedConversations', 'continued_conversations');
    const stageProgressions = outcomeCount(observation, 'relationshipStageProgressions', 'relationship_stage_progressions');
    const connectedConversions = outcomeCount(observation, 'connectedTargetConversions', 'connected_target_conversions');
    const recurringConversions = outcomeCount(observation, 'newRecurringRelationships', 'new_recurring_relationships');
    const mutualConnections = outcomeCount(observation, 'newMutualConnections', 'new_mutual_connections');
    const relevantTargetFollows = outcomeCount(observation, 'relevantTargetFollows', 'relevant_target_follows');
    const meaningfulInteractions = outcomeCount(observation, 'meaningfulInteractions', 'meaningful_interactions');

    components.authorResponses += authorResponses;
    components.continuedConversations += continuedConversations;
    components.newRecurringRelationships += recurringConversions;
    components.relevantTargetFollows += relevantTargetFollows;
    components.newMutualConnections += mutualConnections;
    components.meaningfulInteractions += meaningfulInteractions;

    if (!target && (meaningfulInitialReplies > 0 || authorResponses > 0 || continuedConversations > 0
      || stageProgressions > 0 || connectedConversions > 0 || recurringConversions > 0 || mutualConnections > 0)) {
      missingTargetIdentityForRates += 1;
    }
    if (!target && meaningfulInteractions > 0) missingTargetIdentityForInteractions += 1;

    if (target) {
      engagedTargets.add(target);
      if (meaningfulInitialReplies > 0) initialTargets.add(target);
      if (authorResponses > 0) responseTargets.add(target);
      if (continuedConversations > 0) continuationTargets.add(target);
      if (stageProgressions > 0) progressedTargets.add(target);
      if (connectedConversions > 0) connectedTargets.add(target);
      if (recurringConversions > 0) recurringTargets.add(target);
      if (mutualConnections > 0) mutualTargets.add(target);
      if (meaningfulInteractions > 0) interactionCounts.set(target, (interactionCounts.get(target) || 0) + meaningfulInteractions);
    }
  }

  const interactionYield = calculateInteractionYield(components);
  const totalInteractionsWithIdentity = [...interactionCounts.values()].reduce((sum, count) => sum + count, 0);
  const targetRatesComplete = missingTargetIdentityForRates === 0;
  const concentrationComplete = missingTargetIdentityForInteractions === 0;
  const topTarget = [...interactionCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] || null;
  const targetClasses = new Set(valuesFrom(rows, 'targetClass').map((value) => String(value)));
  const topics = new Set(valuesFrom(rows, 'topic').map((value) => String(value).toLowerCase()));
  for (const value of valuesFrom(rows, 'topicTags')) topics.add(String(value).toLowerCase());

  return {
    kind: 'network',
    sampleSize: rows.length,
    metrics: {
      author_response_rate: targetRatesComplete ? percentage(responseTargets.size, initialTargets.size) : null,
      conversation_continuation_rate: targetRatesComplete ? percentage(continuationTargets.size, initialTargets.size) : null,
      relationship_stage_progression: targetRatesComplete ? percentage(progressedTargets.size, engagedTargets.size) : null,
      connected_target_conversion: targetRatesComplete ? percentage(connectedTargets.size, engagedTargets.size) : null,
      recurring_relationship_conversion: targetRatesComplete ? percentage(recurringTargets.size, engagedTargets.size) : null,
      mutual_relationship_count: targetRatesComplete ? mutualTargets.size : null,
      interaction_yield: round(interactionYield.value),
      target_diversity: engagedTargets.size,
      class_diversity: targetClasses.size,
      topic_diversity: topics.size,
      top_target_concentration: concentrationComplete && totalInteractionsWithIdentity > 0 && topTarget
        ? percentage(topTarget[1], totalInteractionsWithIdentity)
        : null,
    },
    interactionYield: {
      ...interactionYield,
      components: { ...interactionYield.components },
      weights: { ...interactionYield.weights },
    },
    diversity: {
      targets: [...engagedTargets].sort(),
      classes: [...targetClasses].sort(),
      topics: [...topics].sort(),
      topTarget: topTarget ? { username: topTarget[0], interactions: topTarget[1], totalMeaningfulInteractionsWithIdentity: totalInteractionsWithIdentity } : null,
    },
    denominatorVisibility: {
      uniqueEngagedTargets: engagedTargets.size,
      uniqueInitialReplyTargets: initialTargets.size,
      meaningfulInteractions: components.meaningfulInteractions,
      meaningfulInteractionsWithTargetIdentity: totalInteractionsWithIdentity,
      missingTargetIdentityForRates,
      missingTargetIdentityForInteractions,
      uniqueTargetRatesComplete: targetRatesComplete,
      concentrationComplete,
    },
    confounders: summarizeConfounders(rows, NETWORK_CONFOUNDER_FIELDS, options.excludeConfounders || []),
    context: summarizeContext(rows),
    cohortSemantics: {
      volumeIsDescriptive: true,
      saturationIsDescriptive: true,
      repetitionIsDescriptive: true,
      hardLimitApplied: false,
    },
    causalClaimAllowed: false,
  };
}

export function deriveEvidenceState(completedByVariant = {}, minimumCompletedPerVariant) {
  const minimum = finiteNumber(minimumCompletedPerVariant);
  if (!Number.isInteger(minimum) || minimum < 1) throw new Error('minimumCompletedPerVariant must be a positive integer.');
  const counts = Array.isArray(completedByVariant)
    ? completedByVariant.map((value) => Math.max(0, Math.floor(nonNegative(value))))
    : Object.values(completedByVariant || {}).map((value) => Math.max(0, Math.floor(nonNegative(value))));
  if (!counts.length) throw new Error('Evidence state requires at least one variant count.');

  const minimumCount = Math.min(...counts);
  let state;
  if (minimumCount === 0) state = 'insufficient';
  else if (minimumCount < minimum) state = 'preliminary';
  else if (minimumCount < 20) state = 'directional';
  else state = 'repeated';

  const explanation = state === 'insufficient'
    ? 'At least one variant has no completed observation; comparative evidence is insufficient.'
    : state === 'preliminary'
      ? `Every variant has observations, but at least one is below the declared minimum of ${minimum}.`
      : state === 'directional'
        ? `Every variant meets the declared minimum of ${minimum}, but at least one has fewer than 20 completed observations; treat differences as directional associations.`
        : `Every variant meets the declared minimum of ${minimum} and has at least 20 completed observations; the result is repeated observational evidence, not causal proof.`;

  return {
    state,
    counts,
    minimumCompletedPerVariant: minimum,
    repeatedThresholdPerVariant: 20,
    minimumCount,
    comparisonReady: state === 'directional' || state === 'repeated',
    causalClaimAllowed: false,
    explanation,
  };
}

function observationVariantLabel(observation) {
  return String(
    observation?.variantLabel
      ?? observation?.variant_label
      ?? observation?.variant?.label
      ?? observation?.variant
      ?? '',
  ).trim();
}

function observationCompleted(observation) {
  return observation?.completed === true
    || observation?.status === 'completed'
    || observation?.completedAt != null
    || observation?.completed_at != null;
}

export function summarizeExperiment(definition, observations = []) {
  const validation = validateExperimentDefinition(definition);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors, experiment: validation.experiment, cohorts: {}, evidence: null };
  }

  const experiment = validation.experiment;
  const rows = Array.isArray(observations) ? observations : [];
  const cohorts = Object.fromEntries(experiment.variants.map((variant) => [variant.label, []]));
  const rejected = [];

  rows.forEach((observation, index) => {
    const variantLabel = observationVariantLabel(observation);
    if (!Object.hasOwn(cohorts, variantLabel)) {
      rejected.push({ index, variantLabel: variantLabel || null, reason: 'unknown_variant' });
      return;
    }
    const population = evaluateExperimentPopulation(experiment, observation?.item ?? observation, observation?.context || {});
    if (!population.eligible) {
      rejected.push({ index, variantLabel, reason: 'population_ineligible', blockers: population.blockers });
      return;
    }
    if (!observationCompleted(observation)) {
      rejected.push({ index, variantLabel, reason: 'not_completed' });
      return;
    }
    cohorts[variantLabel].push(observation);
  });

  const summaries = {};
  const counts = {};
  for (const variant of experiment.variants) {
    const cohort = cohorts[variant.label];
    counts[variant.label] = cohort.length;
    const options = { excludeConfounders: [experiment.dimension] };
    summaries[variant.label] = validation.dimensionKind === 'network'
      ? summarizeNetworkCohort(cohort, options)
      : summarizeContentCohort(cohort, options);
  }

  const evidence = deriveEvidenceState(counts, experiment.minimumCompletedPerVariant);
  const primaryMetricValues = Object.fromEntries(experiment.variants.map((variant) => [
    variant.label,
    summaries[variant.label].metrics[experiment.primaryMetric] ?? null,
  ]));
  const secondaryMetricValues = Object.fromEntries(experiment.secondaryMetrics.map((metric) => [
    metric,
    Object.fromEntries(experiment.variants.map((variant) => [variant.label, summaries[variant.label].metrics[metric] ?? null])),
  ]));

  return {
    valid: true,
    experiment,
    dimensionKind: validation.dimensionKind,
    sampleSize: Object.values(counts).reduce((sum, count) => sum + count, 0),
    completedByVariant: counts,
    primaryMetric: experiment.primaryMetric,
    primaryMetricValues,
    secondaryMetricValues,
    cohorts: summaries,
    rejected,
    evidence,
    interpretation: {
      winnerLabel: null,
      causalClaimAllowed: false,
      duplicatePairingRequired: false,
      assignmentPolicy: 'caller_selected',
      message: evidence.state === 'repeated'
        ? 'Repeated observational evidence is visible across naturally different items; describe differences probabilistically and retain confounders.'
        : evidence.state === 'directional'
          ? 'Directional observational differences may be discussed, but not as a winner or causal effect.'
          : 'Samples are not yet sufficient for directional comparison; show descriptive cohort values only.',
    },
  };
}
