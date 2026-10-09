// Single versioned product policy. Pure validation: storage, UI and agents
// consume the same schema. No setting can bypass publication authority.
import { DomainValidationError } from './errors.js';

export const DEFAULT_GROWTH_POLICY = Object.freeze({
  version: 1,
  activity: {
    timeZone: 'Asia/Kolkata', sleepStart: '01:00', sleepEnd: '08:30',
    discoveryIntervalMinutes: 5,
  },
  lanes: {
    reply: { enabled: true, priority: 90, editorialMinimum: 0, dailyLimit: null },
    quote: { enabled: true, priority: 55, editorialMinimum: 65, dailyLimit: null },
    original: { enabled: true, priority: 35, editorialMinimum: 80, dailyLimit: null },
  },
  social: {
    follow: { enabled: true, maxPer24Hours: 4, minimumObservedPosts: 2, preference: 80 },
    like: { enabled: true, maxPer24Hours: 20, minimumObservedPosts: 1, preference: 85 },
    repost: { enabled: true, maxPer24Hours: 5, minimumObservedPosts: 1, preference: 60 },
  },
  editorial: {
    // These are topic preferences, not a restrictive whitelist.
    interests: { code_demos: 90, ai_breakthroughs: 90, tool_discoveries: 85,
      builder_lessons: 80, industry_commentary: 55 },
    voiceGuidance: 'Write like a curious builder. Show executable code or a concrete example when it makes the insight useful. Never invent experience.',
    prioritizeReplies: true,
  },
  breakthrough: {
    enabled: true, recentObservationMinutes: 20,
    shortPostAgeMinutes: 120, shortBurstMinutes: 20,
    shortLikes: 400, shortReplies: 40,
    extendedBurstMinutes: 75, extendedLikes: 1000, extendedReplies: 100,
    deltaMinimumMinutes: 2, deltaMaximumMinutes: 75,
    deltaLikes: 300, deltaReplies: 30,
    minLikesPerMinute: 10, minRepliesPerMinute: 1,
    verifiedEventMinutes: 90,
  },
  audience: {
    followerExpansion: true,
    milestones: [0, 1000, 10000, 100000],
    // Guidance is *not* a hard post count. Larger audiences earn more
    // latitude to offer strong standalone explanations, not a spam quota.
    feedSelectivityByTier: [100, 92, 82, 72],
  },
  learning: {
    enabled: true, lookbackDays: 30, minimumSample: 5,
    allowWeakEvidenceToAdjustVolume: false,
  },
});

const positiveInt = (v, name, min, max) => {
  if (!Number.isInteger(v) || v < min || v > max) throw new DomainValidationError(`${name} must be an integer between ${min} and ${max}.`);
  return v;
};
const score = (v, name) => positiveInt(v, name, 0, 100);
const time = (v, name) => {
  if (typeof v !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new DomainValidationError(`${name} must be HH:MM (24h).`);
  return v;
};
const boolean = (v, name) => {
  if (typeof v !== 'boolean') throw new DomainValidationError(`${name} must be true or false.`);
  return v;
};
const shape = (value, defaults, path = 'policy') => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainValidationError(`${path} must be an object.`);
  for (const key of Object.keys(value)) {
    if (!(key in defaults)) throw new DomainValidationError(`Unknown configuration property: ${path}.${key}.`);
  }
  return Object.fromEntries(Object.entries(defaults).map(([key, defaultValue]) => {
    const v = value[key] === undefined ? defaultValue : value[key];
    return [key, defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue)
      ? shape(v, defaultValue, `${path}.${key}`) : v];
  }));
};

export function validateGrowthPolicy(input) {
  const p = shape(input, DEFAULT_GROWTH_POLICY);
  if (p.version !== 1) throw new DomainValidationError('Unsupported growth policy schema version.');
  try { new Intl.DateTimeFormat('en', { timeZone: p.activity.timeZone }); }
  catch { throw new DomainValidationError('activity.timeZone must be a valid IANA timezone.'); }
  time(p.activity.sleepStart, 'sleepStart'); time(p.activity.sleepEnd, 'sleepEnd');
  positiveInt(p.activity.discoveryIntervalMinutes, 'discoveryIntervalMinutes', 5, 120);
  for (const lane of ['reply', 'quote', 'original']) {
    boolean(p.lanes[lane].enabled, `${lane}.enabled`);
    score(p.lanes[lane].priority, `${lane}.priority`);
    score(p.lanes[lane].editorialMinimum, `${lane}.editorialMinimum`);
    if (p.lanes[lane].dailyLimit !== null) positiveInt(p.lanes[lane].dailyLimit, `${lane}.dailyLimit`, 1, 500);
  }
  for (const action of ['follow', 'like', 'repost']) {
    boolean(p.social[action].enabled, `social.${action}.enabled`);
    positiveInt(p.social[action].maxPer24Hours, `social.${action}.maxPer24Hours`, 1, 100);
    positiveInt(p.social[action].minimumObservedPosts, `social.${action}.minimumObservedPosts`, 1, 8);
    score(p.social[action].preference, `social.${action}.preference`);
  }
  for (const [key, value] of Object.entries(p.editorial.interests)) score(value, `interests.${key}`);
  if (typeof p.editorial.voiceGuidance !== 'string' || p.editorial.voiceGuidance.length > 2000) throw new DomainValidationError('voiceGuidance must be text under 2000 characters.');
  boolean(p.editorial.prioritizeReplies, 'prioritizeReplies');
  for (const [key, value] of Object.entries(p.breakthrough)) {
    if (key === 'enabled') boolean(value, `breakthrough.${key}`);
    else positiveInt(value, `breakthrough.${key}`, 1, 100_000);
  }
  boolean(p.audience.followerExpansion, 'followerExpansion');
  if (!Array.isArray(p.audience.milestones) || p.audience.milestones.length < 1 || p.audience.milestones.length > 8
    || p.audience.milestones[0] !== 0 || p.audience.milestones.some((v, i) => !Number.isInteger(v) || v < 0 || (i > 0 && v <= p.audience.milestones[i-1]))) {
    throw new DomainValidationError('audience.milestones must start at 0 and increase strictly (up to 8 values).');
  }
  if (!Array.isArray(p.audience.feedSelectivityByTier)
    || p.audience.feedSelectivityByTier.length !== p.audience.milestones.length) throw new DomainValidationError('feedSelectivityByTier must match milestone tiers.');
  p.audience.feedSelectivityByTier.forEach((v) => score(v, 'feedSelectivityByTier'));
  boolean(p.learning.enabled, 'learning.enabled');
  positiveInt(p.learning.lookbackDays, 'lookbackDays', 1, 365);
  positiveInt(p.learning.minimumSample, 'minimumSample', 2, 1000);
  boolean(p.learning.allowWeakEvidenceToAdjustVolume, 'allowWeakEvidenceToAdjustVolume');
  return p;
}

export function mergeGrowthPolicy(current, patch) {
  const overlay = (a, b) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k,
    b?.[k] !== undefined ? (v && typeof v === 'object' && !Array.isArray(v) && b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? overlay(v, b[k]) : b[k]) : v]));
  // Validate unknown keys before merging so typos cannot be silently accepted.
  const rejectUnknown = (b, a, location='policy') => {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return;
    for (const [k, v] of Object.entries(b)) {
      if (!(k in a)) throw new DomainValidationError(`Unknown property ${location}.${k}.`);
      if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) rejectUnknown(v,a[k],`${location}.${k}`);
    }
  };
  rejectUnknown(patch, DEFAULT_GROWTH_POLICY);
  return validateGrowthPolicy(overlay(current, patch));
}

export function audienceTier(followers, policy = DEFAULT_GROWTH_POLICY) {
  if (!policy.audience.followerExpansion || !Number.isFinite(followers)) return { tier: 0, selectivity: policy.audience.feedSelectivityByTier[0], observedFollowers: null };
  let tier = 0;
  for (let i=0; i<policy.audience.milestones.length; i++) if (followers >= policy.audience.milestones[i]) tier = i;
  return { tier, selectivity: policy.audience.feedSelectivityByTier[tier], observedFollowers: followers };
}
