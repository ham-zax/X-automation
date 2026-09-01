import { applyAcceptedLearnedRules } from './learning.js';
import { getActiveContentGroups } from './strategy.js';

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function round(value) {
  return Math.round(clamp(value));
}

function ageHours(candidate, now) {
  const timestamp = Number(candidate?.timestamp || 0);
  if (!timestamp) return null;
  return Math.max(0, (Number(now || Date.now()) - timestamp) / 3_600_000);
}

function freshness(candidate, now, max = 25) {
  const age = ageHours(candidate, now);
  if (age == null) return Math.round(max * 0.08);

  let score;
  if (candidate?.source === 'x') {
    if (age <= 1) score = 25;
    else if (age <= 3) score = 22;
    else if (age <= 6) score = 18;
    else if (age <= 12) score = 14;
    else if (age <= 24) score = 10;
    else if (age <= 48) score = 5;
    else score = 2;
  } else {
    if (age <= 24) score = 25;
    else if (age <= 72) score = 20;
    else if (age <= 168) score = 12;
    else score = 2;
  }

  return Math.round(score * (max / 25));
}

function logScale(value, max, reference) {
  const safe = Math.max(0, Number(value || 0));
  if (!safe) return 0;
  return clamp((Math.log10(safe + 1) / Math.log10(reference + 1)) * max, 0, max);
}

function unique(values) {
  return [...new Set((values || []).map((value) => String(value).toLowerCase()))];
}

function countMarkers(text, patterns, max) {
  const value = String(text || '');
  let count = 0;
  for (const pattern of patterns) if (pattern.test(value)) count++;
  return Math.min(max, count);
}

function preferenceScore(candidate, preference) {
  const savedCount = Math.max(1, Number(preference?.savedCount || 0));
  if (!Number(preference?.savedCount || 0)) return 0;
  const tags = unique(candidate?.niche?.tags);
  const keywords = unique(candidate?.niche?.matches);
  const tagHits = tags.reduce((sum, tag) => sum + Number(preference?.tags?.[tag] || 0) * 5, 0);
  const keywordHits = keywords.reduce((sum, keyword) => sum + Number(preference?.keywords?.[keyword] || 0) * 2, 0);
  return Math.min(20, Math.round((tagHits + keywordHits) / savedCount));
}

function traction(candidate) {
  const metrics = candidate?.metrics || {};
  if (candidate?.source === 'x') {
    const signal = Number(metrics.views || 0)
      + Number(metrics.likes || 0) * 20
      + Number(metrics.retweets || 0) * 50
      + Number(metrics.replies || 0) * 20;
    return round(logScale(signal, 20, 1_000_000));
  }
  if (candidate?.source === 'github') {
    const legacy = metrics.kind === 'github_legacy'
      || candidate?.kind === 'github_legacy'
      || (metrics.starsToday == null && metrics.starsPerDay != null);
    const currentMomentum = legacy ? metrics.starsPerDay : metrics.starsToday;
    const signal = Number(metrics.stars || 0) + Number(currentMomentum || 0) * 7;
    return round(logScale(signal, 20, 10_000));
  }
  if (candidate?.source === 'hn') {
    const signal = Number(metrics.points || 0) + Number(metrics.comments || 0) * 5;
    return round(logScale(signal, 20, 2_000));
  }
  return 0;
}

function discussion(candidate) {
  if (candidate?.source !== 'x') return 0;
  const metrics = candidate.metrics || {};
  const replies = Number(metrics.replies || 0);
  const views = Number(metrics.views || 0);
  const replyVolume = logScale(replies, 25, 500);
  const replyRate = views > 0 ? clamp((replies / views) * 1000, 0, 10) : 0;
  return round(replyVolume + replyRate);
}

function identityScore(tags) {
  const roles = new Map(getActiveContentGroups({ includeOff: true }).map((group) => [group.tag, group.role]));
  const matchedRoles = unique(tags).map((tag) => roles.get(tag)).filter(Boolean);
  if (matchedRoles.includes('core')) return 10;
  if (matchedRoles.includes('adjacent')) return 6;
  return 0;
}

function relationshipBreakdown(candidate, relationship) {
  if (!relationship) {
    return { available: false, relevance: 0, followsYou: 0, youFollow: 0, mutual: 0, topicOverlap: 0 };
  }
  const candidateTags = new Set(unique(candidate?.niche?.tags));
  const relationshipTags = unique(relationship.nicheTags);
  const overlap = relationshipTags.filter((tag) => candidateTags.has(tag)).length;
  return {
    available: true,
    relevance: round((clamp(relationship.relevanceScore, 0, 50) / 50) * 40),
    followsYou: relationship.followsYou ? 20 : 0,
    youFollow: relationship.youFollow ? 10 : 0,
    mutual: relationship.followsYou && relationship.youFollow ? 15 : 0,
    topicOverlap: Math.min(15, overlap * 5),
  };
}

export function scoreOpportunity(candidate, context = {}) {
  const now = Number(context.now || Date.now());
  const text = String(candidate?.text || '');
  const tags = unique(candidate?.niche?.tags);
  const matches = unique(candidate?.niche?.matches);

  const reach = {
    freshness: freshness(candidate, now, 25),
    momentum: candidate?.viral?.score != null
      ? round((clamp(candidate.viral.score) / 100) * 35)
      : round((clamp(candidate?.score) / 100) * 20),
    traction: traction(candidate),
    breadth: Math.min(20, Math.min(12, matches.length * 4) + Math.min(8, tags.length * 4)),
  };

  const specificityMarkers = [
    /\b\d+(?:\.\d+)*(?:%|x|ms|s|gb|mb|k|m)?\b/i,
    /(?:^|\s)(?:npm|pnpm|yarn|pip|uv|cargo|go|docker|kubectl|git|curl)\s/i,
    /\b(?:repository|repo|docs?|api|sdk|cli|endpoint|config|benchmark)\b/i,
  ];
  const utilityGroups = [
    /\b(?:benchmark|measured|measurement|result)\b/i,
    /\b(?:latency|throughput|performance|speed)\b/i,
    /\b(?:cost|price|pricing|token)\b/i,
    /\b(?:install|npm|pnpm|pip|curl|cli)\b/i,
    /\b(?:sdk|api|endpoint)\b/i,
    /\b(?:repo|repository|github|code)\b/i,
    /\b(?:test|eval|evaluation)\b/i,
    /\b(?:bug|failure|fails|broken|fix)\b/i,
    /\b(?:config|configuration|architecture|deploy)\b/i,
  ];
  const follow = {
    niche: round((clamp(candidate?.niche?.score, 0, 50) / 50) * 30),
    preference: preferenceScore(candidate, context.preference || {}),
    specificity: Math.min(20, Math.min(12, matches.length * 3) + Math.min(8, countMarkers(text, specificityMarkers, 3) * 3)),
    utility: Math.min(20, countMarkers(text, utilityGroups, 20) * 3),
    identity: identityScore(tags),
  };

  const hasQuestionOrTradeoff = /\?|\b(?:compare|comparison|vs\.?|versus|better|worse|trade-?off|bottleneck|failure|fails)\b/i.test(text);
  const hasDecisionBoundary = /\b(?:cost|latency|reliability|limit|limits|context|security|compatibility|throughput|quality)\b/i.test(text);
  const conversation = {
    discussion: discussion(candidate),
    questionTradeoff: (hasQuestionOrTradeoff ? 10 : 0) + (hasDecisionBoundary ? 10 : 0),
    freshness: freshness(candidate, now, 20),
    specificity: Math.min(15, matches.length * 3),
  };

  const relationship = relationshipBreakdown(candidate, context.relationship || null);
  const base = {
    reachPotential: round(Object.values(reach).reduce((sum, value) => sum + value, 0)),
    followPotential: round(Object.values(follow).reduce((sum, value) => sum + value, 0)),
    conversationPotential: round(Object.values(conversation).reduce((sum, value) => sum + value, 0)),
    relationshipPotential: relationship.available
      ? round(relationship.relevance + relationship.followsYou + relationship.youFollow + relationship.mutual + relationship.topicOverlap)
      : 0,
  };
  const learningContext = {
    source: candidate?.source || '',
    topicTags: tags,
    topic: tags,
    format: context.format || context.pipeline || '',
    mediaType: context.mediaType || 'none',
    ...context.learningContext,
  };
  const learned = {
    reachPotential: applyAcceptedLearnedRules(base.reachPotential, context.learnedRules || [], learningContext, {
      adjustmentTarget: 'reach_potential', finalMin: 0, finalMax: 100, reviewContext: context.learningReviewContext || {},
    }),
    followPotential: applyAcceptedLearnedRules(base.followPotential, context.learnedRules || [], learningContext, {
      adjustmentTarget: 'follow_potential', finalMin: 0, finalMax: 100, reviewContext: context.learningReviewContext || {},
    }),
    conversationPotential: applyAcceptedLearnedRules(base.conversationPotential, context.learnedRules || [], learningContext, {
      adjustmentTarget: 'conversation_potential', finalMin: 0, finalMax: 100, reviewContext: context.learningReviewContext || {},
    }),
  };

  return {
    reachPotential: round(learned.reachPotential.finalValue),
    followPotential: round(learned.followPotential.finalValue),
    conversationPotential: round(learned.conversationPotential.finalValue),
    relationshipPotential: base.relationshipPotential,
    basePotentials: base,
    learnedAdjustments: learned,
    breakdown: { reach, follow, conversation, relationship },
  };
}
