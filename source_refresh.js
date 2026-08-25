import {
  fetchGitHubTrending,
  fetchHackerNews,
  fetchXNichePosts,
  fetchXViralPosts,
  rankNews,
  rankXViralPosts,
} from './tech_news.js';
import { personalizeCandidates } from './strategy.js';
import {
  SOURCE_SNAPSHOT_KINDS,
  getDiscoverSnapshot,
  getPreferenceProfile,
  recordDiscoverSnapshotError,
  recordSourceObservations,
  saveDiscoverSnapshot,
  upsertCandidates,
} from './store.js';

const SOURCE_ALIASES = Object.freeze({
  x: 'x_latest',
  x_latest: 'x_latest',
  viral: 'x_momentum',
  x_momentum: 'x_momentum',
  github: 'github_trending',
  github_trending: 'github_trending',
  hn: 'hn_top',
  hn_top: 'hn_top',
  all: 'all',
});

const NEWS_LIMIT = Math.max(1, Number(process.env.NEWS_LIMIT || 8));

export function normalizeSourceKind(input) {
  const value = String(input || '').trim().toLowerCase();
  const normalized = SOURCE_ALIASES[value];
  if (!normalized) throw new Error(`Unsupported source kind: ${value || 'missing'}.`);
  return normalized;
}

function orderedCandidates(rawItems, ranked, keyOf) {
  const byKey = new Map(ranked.map((candidate) => [candidate.key, candidate]));
  return rawItems.map((item) => byKey.get(keyOf(item))).filter(Boolean);
}

function numericMetric(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sourceObservation(kind, candidate, observedAt) {
  const metrics = candidate.metrics || {};
  if (kind === 'github_trending') {
    return {
      candidateKey: candidate.key,
      snapshotKind: kind,
      observedAt,
      rank: metrics.rank == null ? null : Number(metrics.rank),
      metrics: {
        stars: numericMetric(metrics.stars),
        starsToday: numericMetric(metrics.starsToday),
        forks: numericMetric(metrics.forks),
        language: String(metrics.language || ''),
      },
    };
  }
  if (kind === 'hn_top') {
    return {
      candidateKey: candidate.key,
      snapshotKind: kind,
      observedAt,
      rank: metrics.rank == null ? null : Number(metrics.rank),
      metrics: {
        points: numericMetric(metrics.points),
        comments: numericMetric(metrics.comments),
        by: String(metrics.by || ''),
      },
    };
  }
  return {
    candidateKey: candidate.key,
    snapshotKind: kind,
    observedAt,
    rank: null,
    metrics: {
      views: numericMetric(metrics.views),
      likes: numericMetric(metrics.likes),
      reposts: numericMetric(metrics.retweets ?? metrics.reposts),
      replies: numericMetric(metrics.replies),
      bookmarks: numericMetric(metrics.bookmarks),
      sourceTimestamp: Number(candidate.timestamp || 0) || null,
    },
  };
}

async function fetchAndRank(kind, preference) {
  if (kind === 'x_latest') {
    const result = await fetchXNichePosts(Math.max(NEWS_LIMIT * 6, 48));
    if (result.error) throw new Error(result.error);
    const ranked = personalizeCandidates(rankNews({ xPosts: result.posts }), preference);
    return { ranked, ordered: orderedCandidates(result.posts, ranked, (post) => post.url) };
  }
  if (kind === 'x_momentum') {
    const result = await fetchXViralPosts(Math.max(NEWS_LIMIT * 2, 16), 1, true);
    if (result.error) throw new Error(result.error);
    const ranked = personalizeCandidates(rankXViralPosts(result.posts), preference);
    return { ranked, ordered: ranked };
  }
  if (kind === 'github_trending') {
    const repos = await fetchGitHubTrending(Math.max(NEWS_LIMIT * 2, 16));
    if (!Array.isArray(repos)) throw new Error(repos?.error || 'GitHub Trending refresh failed.');
    const ranked = personalizeCandidates(rankNews({ ghRepos: repos }), preference);
    return { ranked, ordered: orderedCandidates(repos, ranked, (repo) => repo.url) };
  }
  if (kind === 'hn_top') {
    const stories = await fetchHackerNews(Math.max(NEWS_LIMIT * 2, 16));
    if (!Array.isArray(stories)) throw new Error(stories?.error || 'Hacker News refresh failed.');
    const ranked = personalizeCandidates(rankNews({ hnStories: stories }), preference);
    return { ranked, ordered: orderedCandidates(stories, ranked, (story) => story.url) };
  }
  throw new Error(`Unsupported source kind: ${kind}.`);
}

export async function refreshSourceSnapshot(inputKind) {
  const kind = normalizeSourceKind(inputKind);
  if (kind === 'all') throw new Error('Use refreshAllSourceSnapshots() for all source kinds.');
  const attemptedAt = Date.now();
  try {
    const preference = getPreferenceProfile();
    const { ranked, ordered } = await fetchAndRank(kind, preference);
    const current = getDiscoverSnapshot(kind);
    if (!ordered.length && current.candidates.length) {
      const message = `Source refresh returned no candidates; preserved ${current.candidates.length} last-known-good ${kind} candidates.`;
      const status = recordDiscoverSnapshotError(kind, message, attemptedAt);
      return {
        kind,
        fetchedAt: current.fetchedAt,
        candidates: current.candidates,
        error: status.error,
        attemptedAt,
        preservedLastGood: true,
      };
    }
    upsertCandidates(ranked);
    const fetchedAt = Date.now();
    const snapshot = saveDiscoverSnapshot(kind, ordered, fetchedAt);
    recordSourceObservations(snapshot.candidates.map((candidate) => sourceObservation(kind, candidate, fetchedAt)));
    return { kind, fetchedAt, candidates: snapshot.candidates, error: null, attemptedAt, preservedLastGood: false };
  } catch (error) {
    const status = recordDiscoverSnapshotError(kind, error, attemptedAt);
    const current = getDiscoverSnapshot(kind);
    return {
      kind,
      fetchedAt: current.fetchedAt,
      candidates: current.candidates,
      error: status.error,
      attemptedAt,
    };
  }
}

export async function refreshAllSourceSnapshots() {
  const results = [];
  for (const kind of SOURCE_SNAPSHOT_KINDS) results.push(await refreshSourceSnapshot(kind));
  return {
    fetchedAt: Date.now(),
    results,
    errors: results.filter((result) => result.error).map((result) => ({ kind: result.kind, error: result.error })),
  };
}
