import { getActiveContentGroups } from './strategy.js';

export function getResearchTopics() {
  return getActiveContentGroups()
    .filter((group) => group.terms.length > 0)
    .map((group) => ({
      id: group.tag,
      label: group.label,
      tier: Number(group.researchTier || 2),
      anchors: [...group.terms],
    }));
}

export function getResearchTopicIds() {
  return getResearchTopics().map((topic) => topic.id);
}

export function normalizeResearchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function values(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function collectText(input) {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) return input.map(collectText).filter(Boolean).join('\n');
  if (!input || typeof input !== 'object') return '';

  return [
    input.title,
    input.text,
    input.description,
    input.summary,
    ...values(input.tags),
    ...values(input.semanticAnchors),
    ...values(input.matches),
    ...values(input.topics),
    ...values(input.niche?.tags),
    ...values(input.niche?.matches),
  ].filter(Boolean).join('\n');
}

function matchesAnchor(normalizedText, anchor) {
  const normalizedAnchor = normalizeResearchText(anchor);
  if (!normalizedAnchor) return false;
  return ` ${normalizedText} `.includes(` ${normalizedAnchor} `);
}

function compareMatches(left, right) {
  return left.tier - right.tier
    || right.matchedAnchors.length - left.matchedAnchors.length
    || left.topicId.localeCompare(right.topicId);
}

export function getResearchTopic(topicId) {
  const id = String(topicId || '');
  return getResearchTopics().find((topic) => topic.id === id) || null;
}

export function matchResearchTopics(input) {
  const normalizedText = normalizeResearchText(collectText(input));
  if (!normalizedText) return [];

  return getResearchTopics().map((topic) => {
    const matchedAnchors = topic.anchors.filter((anchor) => matchesAnchor(normalizedText, anchor));
    return matchedAnchors.length
      ? { topicId: topic.id, tier: topic.tier, matchedAnchors }
      : null;
  }).filter(Boolean).sort(compareMatches);
}

export function selectPrimaryResearchTopic(candidates = []) {
  return classifyResearchStory(candidates).primaryTopic;
}

export function classifyResearchStory(candidates = []) {
  const combined = new Map();
  for (const candidate of values(candidates)) {
    for (const match of matchResearchTopics(candidate)) {
      const current = combined.get(match.topicId) || { topicId: match.topicId, tier: match.tier, anchors: new Set() };
      for (const anchor of match.matchedAnchors) current.anchors.add(anchor);
      combined.set(match.topicId, current);
    }
  }

  const matches = [...combined.values()].map((match) => ({
    topicId: match.topicId,
    tier: match.tier,
    matchedAnchors: [...match.anchors].sort((left, right) => left.localeCompare(right)),
  })).sort(compareMatches);

  return { primaryTopic: matches[0] || null, matches };
}
