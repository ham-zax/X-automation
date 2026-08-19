import { getResearchTopic, normalizeResearchText } from './research_topics.js';

const MAIN_FEED_PIPELINES = new Set(['original', 'quote', 'thread']);
const GENERIC_SINGLE_TOKENS = new Set(['ai', 'tech', 'technology', 'developer', 'developers', 'tool', 'tools', 'model', 'models']);

function values(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function publishedTweetId(item) {
  return String(
    item?.publishedTweetId
      ?? item?.published_tweet_id
      ?? item?.outputTweetId
      ?? item?.output_tweet_id
      ?? '',
  ).trim();
}

function isPublishedMainFeedItem(item) {
  const status = String(item?.status || '').toLowerCase();
  const pipeline = String(item?.pipeline || '').toLowerCase();
  return status === 'published' && MAIN_FEED_PIPELINES.has(pipeline) && Boolean(publishedTweetId(item));
}

function publicationTime(item) {
  const value = item?.publishedAt ?? item?.published_at ?? item?.timestamp ?? 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function usableAnchor(value) {
  const normalized = normalizeResearchText(value);
  if (!normalized) return null;
  if (!normalized.includes(' ') && GENERIC_SINGLE_TOKENS.has(normalized)) return null;
  return normalized;
}

function proofAnchors(topic, semanticAnchors) {
  const topicId = typeof topic === 'object' ? topic?.topicId || topic?.id : topic;
  const researchTopic = getResearchTopic(topicId);
  const raw = researchTopic
    ? [...researchTopic.anchors, ...values(semanticAnchors)]
    : [typeof topic === 'string' ? topic : '', ...values(topic?.matchedAnchors), ...values(semanticAnchors)];
  return [...new Set(raw.map(usableAnchor).filter(Boolean))];
}

function searchableText(item) {
  return normalizeResearchText([
    item?.text,
    item?.body,
    ...values(item?.threadParts),
    ...values(item?.semanticAnchors),
    ...values(item?.topics),
  ].filter(Boolean).join('\n'));
}

function matchesAnyAnchor(item, anchors) {
  const text = searchableText(item);
  if (!text) return false;
  const padded = ` ${text} `;
  return anchors.some((anchor) => padded.includes(` ${anchor} `));
}

function coverageForCount(count) {
  if (count <= 0) return 'none';
  if (count === 1) return 'weak';
  if (count <= 3) return 'medium';
  return 'strong';
}

export function calculateProfileProofCoverage({ topic, semanticAnchors = [], publishedMainFeedItems = [] } = {}) {
  const anchors = proofAnchors(topic, semanticAnchors);
  const recent = values(publishedMainFeedItems)
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isPublishedMainFeedItem(item))
    .sort((left, right) => publicationTime(right.item) - publicationTime(left.item) || left.index - right.index)
    .slice(0, 30)
    .map(({ item }) => item);

  const matches = anchors.length ? recent.filter((item) => matchesAnyAnchor(item, anchors)) : [];
  const supportingPostIds = [...new Set(matches.map(publishedTweetId).filter(Boolean))];
  const coverage = coverageForCount(supportingPostIds.length);
  const topicLabel = typeof topic === 'object' ? topic?.topicId || topic?.id || topic?.topic || '' : String(topic || '');

  return {
    topic: topicLabel,
    coverage,
    supportingPostIds,
    reason: anchors.length
      ? `${supportingPostIds.length} of the latest ${recent.length} eligible published main-feed posts match the supplied topic/semantic anchors.`
      : 'No specific topic or semantic anchor was supplied; generic terms do not establish profile proof.',
  };
}
