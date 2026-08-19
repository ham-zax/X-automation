import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import {
  fetchAccountPerformance,
  fetchGitHubTrending,
  fetchHackerNews,
  fetchXNichePosts,
  fetchXViralPosts,
  rankNews,
  rankXViralPosts,
} from './tech_news.js';
import { publishMainFeedHttp } from './x_http.js';
import { refreshEngagementOpportunities } from './engagement.js';
import { rankMainFeedItems } from './scheduler.js';
import { personalizeCandidates } from './strategy.js';
import {
  claimQueueItem,
  getAccountHealthSummary,
  getPreferenceProfile,
  getPublicationFollowerBaseline,
  listDueMeasurementWindows,
  listAcceptedLearnedRules,
  listApprovedMainFeedItems,
  listRecentMainFeedPublications,
  markQueueFailed,
  markQueuePublished,
  recordCandidateAction,
  recordPerformanceSnapshot,
  recordPublicationFollowerBaseline,
  recordPublicationMeasurement,
  saveDraft,
  saveQueueItem,
  upsertCandidates,
} from './store.js';

const POLL_MINUTES = Number(process.env.POLL_MINUTES || 30);
const NEWS_LIMIT = Number(process.env.NEWS_LIMIT || 8);
const AUTO_POST = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';

function compactMeasurementContext(summary) {
  const components = summary.networkQuality?.components || {};
  return {
    health: {
      state: summary.health.state,
      reasons: (summary.health.reasons || []).map((reason) => ({ code: reason.code, level: reason.level, evidence: reason.evidence })),
      generatedAt: summary.generatedAt,
    },
    networkContext: {
      targetDiversity: components.targetDiversity?.uniqueTargets ?? 0,
      classDiversity: components.classDiversity?.uniqueClasses ?? 0,
      topicDiversity: components.topicDiversity?.uniqueTopics ?? 0,
      topTargetConcentration: components.topTargetConcentration?.rate ?? null,
      interactionYield: summary.interactionYield?.value ?? null,
      interactionYieldComponents: summary.interactionYield?.components || {},
    },
  };
}

export async function capturePublicationFollowerBaseline({
  queueItemId,
  now = Date.now(),
  account = process.env.X_ACCOUNT || 'ham_zax',
  performanceSource = fetchAccountPerformance,
} = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('Publication baseline now must be numeric.');
  try {
    const existing = getPublicationFollowerBaseline(Number(queueItemId));
    if (['queue_publication_baseline', 'publication_measurement'].includes(existing.source)) {
      return { captured: true, error: null, baseline: existing };
    }
  } catch {
    // No persisted baseline yet; capture one below without affecting publication state.
  }
  const performance = await performanceSource(account, 1);
  if (performance?.error) return { captured: false, error: performance.error, baseline: null };
  const capturedAt = Number(performance?.capturedAt || performance?.profile?.capturedAt || Date.now());
  const followers = Number(performance?.profile?.followersCount);
  if (!Number.isFinite(capturedAt) || !Number.isFinite(followers)) {
    return { captured: false, error: 'Publication follower baseline unavailable from performance read.', baseline: null };
  }
  recordPerformanceSnapshot({ profile: performance.profile, posts: performance.posts || [], capturedAt });
  const queueItem = recordPublicationFollowerBaseline(Number(queueItemId), { followers, capturedAt });
  return {
    captured: true,
    error: null,
    baseline: {
      capturedAt: queueItem.measurementBaselineAt,
      followers: queueItem.measurementBaselineFollowers,
      source: 'queue_publication_baseline',
      delayMinutes: Math.max(0, (queueItem.measurementBaselineAt - queueItem.publishedAt) / 60_000),
    },
  };
}

export async function captureDuePublicationMeasurements({
  now = Date.now(),
  account = process.env.X_ACCOUNT || 'ham_zax',
  performanceSource = fetchAccountPerformance,
  attributionContext = null,
} = {}) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('Measurement capture now must be numeric.');
  const due = listDueMeasurementWindows(timestamp);
  if (!due.length) return { due: 0, captured: [], skipped: [], error: null };

  const uniqueTweets = new Set(due.map((item) => String(item.tweetId)));
  const performance = await performanceSource(account, Math.max(20, uniqueTweets.size * 2));
  if (performance?.error) return { due: due.length, captured: [], skipped: due, error: performance.error };
  const capturedAt = Number(performance?.capturedAt || performance?.profile?.capturedAt || Date.now());
  recordPerformanceSnapshot({ profile: performance.profile, posts: performance.posts || [], capturedAt });
  const followers = Number(performance?.profile?.followersCount);
  if (!Number.isFinite(followers)) return { due: due.length, captured: [], skipped: due, error: 'Follower count unavailable from performance read.' };
  const postsById = new Map((performance.posts || []).map((post) => [String(post.id || ''), post]));
  const healthContext = compactMeasurementContext(getAccountHealthSummary({ now: capturedAt }));
  const captured = [];
  const skipped = [];

  for (const item of due) {
    const post = postsById.get(String(item.tweetId));
    if (!post) {
      skipped.push({ ...item, reason: 'published_post_not_in_read' });
      continue;
    }
    const baseline = getPublicationFollowerBaseline(item.queueItemId, { fallbackFollowers: followers, fallbackAt: capturedAt });
    const suppliedAttribution = typeof attributionContext === 'function'
      ? attributionContext(item) || {}
      : attributionContext || {};
    captured.push(recordPublicationMeasurement({
      queueItemId: item.queueItemId,
      tweetId: item.tweetId,
      windowMinutes: item.windowMinutes,
      baselineAt: baseline.capturedAt,
      baselineFollowers: baseline.followers,
      capturedAt,
      views: Number(post.views || 0),
      likes: Number(post.likes || 0),
      reposts: Number(post.retweets || post.reposts || 0),
      replies: Number(post.replies || 0),
      followers,
      attribution: suppliedAttribution,
      metadata: {
        dueAt: item.dueAt,
        baselineSource: baseline.source,
        baselineDelayMinutes: baseline.delayMinutes,
        ...healthContext,
      },
    }));
  }
  return { due: due.length, captured, skipped, error: null };
}

async function refreshResearch() {
  const [hnStories, ghRepos] = await Promise.all([
    fetchHackerNews(NEWS_LIMIT),
    fetchGitHubTrending(NEWS_LIMIT),
  ]);
  const xResult = await fetchXNichePosts(Math.max(NEWS_LIMIT * 4, 32));
  const viralResult = await fetchXViralPosts(Math.max(NEWS_LIMIT * 8, 64));

  const preference = getPreferenceProfile();
  const ranked = personalizeCandidates(rankNews({
    hnStories: Array.isArray(hnStories) ? hnStories : [],
    ghRepos: Array.isArray(ghRepos) ? ghRepos : [],
    xPosts: xResult.posts,
  }), preference);
  const viral = personalizeCandidates(rankXViralPosts(viralResult.posts), preference);
  upsertCandidates([...ranked, ...viral]);

  return {
    ranked,
    viral,
    errors: [
      !Array.isArray(hnStories) ? hnStories?.error : null,
      !Array.isArray(ghRepos) ? ghRepos?.error : null,
      xResult.error,
      viralResult.error,
    ].filter(Boolean),
  };
}

function publicationAction(pipeline) {
  return pipeline === 'quote' ? 'quote' : 'direct';
}

function publicationCommentary(item) {
  return item.pipeline === 'thread' ? (item.threadParts || []).join('\n\n') : String(item.body || item.text || '');
}

export async function processMainFeedQueue({
  now = Date.now(),
  autoPost = AUTO_POST,
  authToken = process.env.AUTH_TOKEN,
  csrfToken = process.env.CT0,
  account = process.env.X_ACCOUNT || 'ham_zax',
  transport = publishMainFeedHttp,
} = {}) {
  const currentTime = Number(now);
  if (!Number.isFinite(currentTime)) throw new Error('processMainFeedQueue requires a numeric now timestamp.');
  const items = listApprovedMainFeedItems({ automatedOnly: true, limit: 100 });
  const recentPosts = listRecentMainFeedPublications({ limit: 20 });
  const decisions = rankMainFeedItems(items, {
    now: currentTime,
    recentPosts,
    lastMainFeedPostAt: recentPosts[0]?.publishedAt ?? null,
    learnedRules: listAcceptedLearnedRules({ limit: 500 }),
  });
  const decision = decisions.find((item) => item.eligible) || null;
  if (!decision) return { action: items.length ? 'blocked' : 'no-main-feed', decision: null, decisions };
  if (decision.recommendedAt > currentTime) {
    return { action: 'scheduled-wait', decision, decisions };
  }
  if (!autoPost) return { action: 'preview', decision, decisions };
  if (!authToken || !csrfToken) throw new Error('AUTO_POST=true requires AUTH_TOKEN and CT0.');

  const claimed = claimQueueItem(decision.item.id, {
    expectedUpdatedAt: decision.item.updatedAt,
    now: currentTime,
  });
  if (!claimed) return { action: 'claim-lost', decision, decisions };

  let output;
  try {
    output = await transport(decision.item, { authToken, csrfToken }, { account });
  } catch (error) {
    if (error?.code === 'TRANSPORT_RESULT_NO_TWEET_ID') {
      const queueItem = saveQueueItem({
        ...claimed,
        status: 'publishing',
        publishError: `Transport completed without a root tweet ID; manual reconciliation required: ${error.message}`,
      });
      return { action: 'posted-recording-incomplete', decision, decisions, queueItem, tweetId: null, url: null, error: queueItem.publishError };
    }
    const queueItem = markQueueFailed(claimed.id, error, { failedAt: Date.now() });
    return { action: 'failed', decision, decisions, queueItem, error: error.message };
  }

  let queueItem;
  try {
    queueItem = markQueuePublished(claimed.id, output.tweetId, output.url || null, { publishedAt: Date.now() });
  } catch (error) {
    const current = saveQueueItem({
      ...claimed,
      status: 'publishing',
      outputTweetId: output.tweetId,
      outputUrl: output.url || null,
      publishError: `Transport succeeded, but publication transition is incomplete: ${error.message}`,
    });
    return {
      action: 'posted-recording-incomplete',
      decision,
      decisions,
      queueItem: current,
      tweetId: output.tweetId,
      url: output.url || null,
      error: current.publishError,
    };
  }

  try {
    if (decision.item.draft) {
      saveDraft({ ...decision.item.draft, status: 'published', publishedTweetId: output.tweetId });
    }
    recordCandidateAction({
      candidateKey: decision.item.candidateKey,
      action: publicationAction(decision.item.pipeline),
      outputTweetId: output.tweetId,
      outputUrl: output.url || null,
      commentary: publicationCommentary(decision.item),
    });
  } catch (error) {
    queueItem = saveQueueItem({
      ...queueItem,
      publishError: `Published, but local draft/action recording is incomplete: ${error.message}`,
    });
    return {
      action: 'posted-recording-incomplete',
      decision,
      decisions,
      queueItem,
      tweetId: output.tweetId,
      url: output.url || null,
      error: queueItem.publishError,
    };
  }

  return { action: 'posted', decision, decisions, queueItem, tweetId: output.tweetId, url: output.url || null };
}

export async function runCycle() {
  let measurements = { due: 0, captured: [], skipped: [], error: null };
  try {
    measurements = await captureDuePublicationMeasurements();
    if (measurements.captured.length) console.log(`[automation] Captured ${measurements.captured.length} due publication measurement window(s).`);
    if (measurements.error) console.log(`[automation] Measurement capture skipped: ${measurements.error}`);
  } catch (error) {
    measurements.error = error.message;
    console.log(`[automation] Measurement capture failed: ${error.message}`);
  }
  const research = await refreshResearch();
  const top = [...research.viral, ...research.ranked].sort((a, b) => b.score - a.score)[0] || null;
  if (top) {
    console.log(`[automation] Research leader: ${top.score}/100 ${top.source} ${top.title}`);
  } else {
    console.log('[automation] No research candidates this cycle.');
  }
  if (research.errors.length) console.log(`[automation] Partial research errors: ${research.errors.join(' | ')}`);

  let engagement = { items: [], activeConversations: [], newOpportunities: [], refreshed: 0, rejected: 0, expired: 0, errors: [] };
  try {
    engagement = await refreshEngagementOpportunities();
    const nextEngagement = engagement.items[0];
    if (nextEngagement) {
      console.log(`[automation] Engage Next leader: ${Math.round(nextEngagement.priority)}/100 @${nextEngagement.targetUsername} ${nextEngagement.engagementKind}.`);
    } else {
      console.log('[automation] No actionable Engage Next items this cycle.');
    }
    if (engagement.errors.length) console.log(`[automation] Partial engagement read errors: ${engagement.errors.join(' | ')}`);
  } catch (error) {
    engagement.errors = [error.message];
    console.log(`[automation] Engagement refresh failed: ${error.message}`);
  }

  const mainFeed = await processMainFeedQueue();
  let publicationBaseline = null;
  const publicationReachedPublishedState = ['posted', 'posted-recording-incomplete'].includes(mainFeed.action)
    && mainFeed.queueItem?.status === 'published'
    && Boolean(mainFeed.tweetId);
  if (publicationReachedPublishedState) {
    try {
      publicationBaseline = await capturePublicationFollowerBaseline({ queueItemId: mainFeed.queueItem.id });
      if (publicationBaseline.captured) console.log(`[automation] Captured publication follower baseline for queue item ${mainFeed.queueItem.id}.`);
      else console.log(`[automation] Publication baseline capture skipped: ${publicationBaseline.error}`);
    } catch (error) {
      publicationBaseline = { captured: false, error: error.message, baseline: null };
      console.log(`[automation] Publication baseline capture failed without changing publish state: ${error.message}`);
    }
  }
  if (mainFeed.action === 'preview') {
    console.log(`[automation] Main-feed preview: ${mainFeed.decision.reason}`);
    console.log('[automation] AUTO_POST=false; no claim or publication write performed.');
  } else if (mainFeed.action === 'scheduled-wait') {
    console.log(`[automation] Main-feed recommendation waits until ${new Date(mainFeed.decision.recommendedAt).toLocaleString()}: ${mainFeed.decision.reason}`);
  } else if (mainFeed.action === 'posted') {
    console.log(`[automation] Published ${mainFeed.decision.item.pipeline} queue item ${mainFeed.decision.item.id} as ${mainFeed.tweetId}.`);
  } else if (mainFeed.action === 'failed') {
    console.log(`[automation] Publication failed after claim: ${mainFeed.error}`);
  } else if (mainFeed.action === 'posted-recording-incomplete') {
    console.log(`[automation] Publication reached X as ${mainFeed.tweetId}, but local recording is incomplete: ${mainFeed.error}`);
  } else if (mainFeed.action === 'claim-lost') {
    console.log('[automation] Main-feed recommendation changed before claim; no transport call was made.');
  } else if (mainFeed.action === 'blocked') {
    console.log('[automation] Approved main-feed items exist, but none currently pass scheduler eligibility.');
  } else {
    console.log('[automation] No approved automated main-feed items this cycle.');
  }
  return { ...mainFeed, top, engagement, measurements, publicationBaseline, errors: [...research.errors, ...engagement.errors, ...(measurements.error ? [measurements.error] : [])] };
}

async function main() {
  const once = process.argv.includes('--once');
  if (once) {
    await runCycle();
    return;
  }

  console.log(`[automation] Started. Poll=${POLL_MINUTES}m, scheduler=queue-aware, auto-post=${AUTO_POST}.`);
  while (true) {
    try {
      await runCycle();
    } catch (error) {
      console.error(`[automation] Cycle failed: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MINUTES * 60_000));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[automation] Fatal error: ${error.message}`);
    process.exit(1);
  });
}
