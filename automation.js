import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { fetchAccountPerformance } from './tech_news.js';
import { refreshAllSourceSnapshots, refreshSourceSnapshot } from './source_refresh.js';
import { refreshEditorialPlan } from './editorial.js';
import { publishMainFeedHttp } from './x_http.js';
import { refreshEngagementOpportunities } from './engagement.js';
import {
  AUTONOMOUS_REPLY_MIN_REFRESH_MINUTES,
  getAutonomousReplyGrant,
  runAutonomousReplyCycle,
} from './autonomous_reply.js';
import { rankMainFeedItems } from './scheduler.js';
import {
  prepareAutonomousMainFeed,
  refreshFirst1000MissionFollowerState,
} from './autonomous_main_feed.js';
import {
  claimQueueItem,
  getAccountHealthSummary,
  getAppState,
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
  setAppState,
} from './store.js';

const POLL_MINUTES = Number(process.env.POLL_MINUTES || 30);
const REPLY_POLL_MINUTES = Math.max(
  AUTONOMOUS_REPLY_MIN_REFRESH_MINUTES,
  Number(process.env.REPLY_POLL_MINUTES || AUTONOMOUS_REPLY_MIN_REFRESH_MINUTES),
);
const AUTO_POST = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';
export const AUTO_EDITORIAL_PLAN_REFRESH = String(process.env.AUTO_EDITORIAL_PLAN_REFRESH || 'false').toLowerCase() === 'true';

const AUTOMATION_RUNTIME_STATE_KEY = 'automation_runtime';

function readAutomationRuntimeState() {
  try {
    const raw = getAppState(AUTOMATION_RUNTIME_STATE_KEY, null);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function updateAutomationRuntimeState(patch) {
  try {
    setAppState(AUTOMATION_RUNTIME_STATE_KEY, JSON.stringify({
      ...readAutomationRuntimeState(),
      ...patch,
    }));
  } catch (error) {
    console.log(`[automation] Runtime heartbeat write failed without changing cycle behavior: ${error.message}`);
  }
}

function recordAutomationCycleStart() {
  updateAutomationRuntimeState({
    cycleStartedAt: Date.now(),
    inProgress: true,
  });
}

function recordAutomationCycleSuccess() {
  const finishedAt = Date.now();
  updateAutomationRuntimeState({
    cycleFinishedAt: finishedAt,
    lastHealthyCompletionAt: finishedAt,
    latestError: null,
    inProgress: false,
  });
}

function recordAutomationCycleFailure(error) {
  const finishedAt = Date.now();
  updateAutomationRuntimeState({
    cycleFinishedAt: finishedAt,
    latestError: {
      at: finishedAt,
      message: error instanceof Error ? error.message : String(error),
    },
    inProgress: false,
  });
}

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
      bookmarks: post.bookmarks == null && post.bookmarkCount == null ? null : Number(post.bookmarks ?? post.bookmarkCount),
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
  const refreshed = await refreshAllSourceSnapshots();
  const byKind = new Map(refreshed.results.map((result) => [result.kind, result]));
  return {
    ranked: [
      ...(byKind.get('x_latest')?.candidates || []),
      ...(byKind.get('github_trending')?.candidates || []),
      ...(byKind.get('hn_top')?.candidates || []),
    ],
    viral: byKind.get('x_momentum')?.candidates || [],
    errors: refreshed.errors.map((item) => `${item.kind}: ${item.error}`),
  };
}

async function refreshReplySources() {
  const results = [];
  for (const kind of ['x_latest', 'x_momentum']) results.push(await refreshSourceSnapshot(kind));
  return results.filter((result) => result.error).map((result) => `${result.kind}: ${result.error}`);
}

export async function refreshBackgroundEditorialPlan({
  enabled = AUTO_EDITORIAL_PLAN_REFRESH,
  planner = refreshEditorialPlan,
} = {}) {
  if (!enabled) return { enabled: false, refreshed: false, planId: null, recommendationCount: 0, error: null };
  try {
    const plan = await planner({ objective: 'qualified_growth', refreshSources: false });
    return {
      enabled: true,
      refreshed: true,
      planId: plan?.run?.id ?? null,
      recommendationCount: Array.isArray(plan?.recommendations) ? plan.recommendations.length : 0,
      error: null,
    };
  } catch (error) {
    return { enabled: true, refreshed: false, planId: null, recommendationCount: 0, error: error.message };
  }
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
  missionPublicationReady = null,
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
    missionPublicationReady,
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

export async function runEngagementAutonomousCycle({
  refreshSources = true,
  refreshTargetTimelines = true,
  researchErrors = [],
} = {}) {
  const sourceErrors = [...researchErrors];
  if (refreshSources) sourceErrors.push(...await refreshReplySources());

  let engagement = { items: [], activeConversations: [], newOpportunities: [], refreshed: 0, rejected: 0, expired: 0, errors: [], refreshFailed: false };
  try {
    engagement = await refreshEngagementOpportunities({ refreshTargetTimelines });
    const nextEngagement = engagement.items[0];
    if (nextEngagement) {
      console.log(`[automation] Engage Next leader: ${Math.round(nextEngagement.priority)}/100 @${nextEngagement.targetUsername} ${nextEngagement.engagementKind}.`);
    } else {
      console.log('[automation] No actionable Engage Next items this cycle.');
    }
    if (engagement.errors.length) console.log(`[automation] Partial engagement read errors: ${engagement.errors.join(' | ')}`);
  } catch (error) {
    engagement.errors = [error.message];
    engagement.refreshFailed = true;
    console.log(`[automation] Engagement refresh failed: ${error.message}`);
  }

  let autonomousReplies = { active: false, reason: getAutonomousReplyGrant().state, decisions: [] };
  try {
    autonomousReplies = await runAutonomousReplyCycle({
      refreshErrors: [...sourceErrors, ...engagement.errors],
      refreshFailed: engagement.refreshFailed,
    });
    if (autonomousReplies.active && autonomousReplies.due !== false) {
      const counts = autonomousReplies.runtime?.lastDecisionCounts || { sent: 0, review: 0, skipped: 0 };
      console.log(`[automation] Autonomous replies ${autonomousReplies.grant.mode}: ${counts.sent} send candidate(s), ${counts.review} review, ${counts.skipped} skipped.`);
    } else if (autonomousReplies.active) {
      console.log(`[automation] Autonomous replies running; next evaluation ${autonomousReplies.runtime?.nextExpectedRefreshAt ? new Date(autonomousReplies.runtime.nextExpectedRefreshAt).toLocaleString() : 'on the next eligible refresh'}.`);
    }
  } catch (error) {
    autonomousReplies = { active: true, error: error.message, decisions: [] };
    console.log(`[automation] Autonomous reply cycle failed without stopping the daemon: ${error.message}`);
  }

  return { engagement, autonomousReplies, sourceErrors };
}

async function runCycleBody() {
  let measurements = { due: 0, captured: [], skipped: [], error: null };
  try {
    measurements = await captureDuePublicationMeasurements();
    if (measurements.captured.length) console.log(`[automation] Captured ${measurements.captured.length} due publication measurement window(s).`);
    if (measurements.error) console.log(`[automation] Measurement capture skipped: ${measurements.error}`);
  } catch (error) {
    measurements.error = error.message;
    console.log(`[automation] Measurement capture failed: ${error.message}`);
  }
  let missionFollowers;
  try {
    missionFollowers = await refreshFirst1000MissionFollowerState();
    if (missionFollowers.completed) {
      console.log(`[automation] First-1,000 mission completed at ${missionFollowers.followers.count} followers.`);
    } else if (missionFollowers.required && missionFollowers.error) {
      console.log(`[automation] First-1,000 follower refresh skipped delegated publication/preparation: ${missionFollowers.error}`);
    }
  } catch (error) {
    missionFollowers = { required: true, fresh: false, completed: false, error: error.message };
    console.log(`[automation] First-1,000 follower refresh failed without stopping the daemon: ${error.message}`);
  }

  const research = await refreshResearch();
  const editorialPlanRefresh = await refreshBackgroundEditorialPlan();
  if (editorialPlanRefresh.refreshed) {
    console.log(`[automation] Editorial plan ${editorialPlanRefresh.planId ?? 'unknown'}: ${editorialPlanRefresh.recommendationCount} recommendation(s).`);
  } else if (editorialPlanRefresh.error) {
    console.log(`[automation] Editorial plan refresh failed: ${editorialPlanRefresh.error}`);
  }
  const top = [...research.viral, ...research.ranked].sort((a, b) => b.score - a.score)[0] || null;
  if (top) {
    console.log(`[automation] Research leader: ${top.score}/100 ${top.source} ${top.title}`);
  } else {
    console.log('[automation] No research candidates this cycle.');
  }
  if (research.errors.length) console.log(`[automation] Partial research errors: ${research.errors.join(' | ')}`);

  const { engagement, autonomousReplies } = await runEngagementAutonomousCycle({
    refreshSources: false,
    refreshTargetTimelines: true,
    researchErrors: research.errors,
  });

  let autonomousMainFeedPreparation;
  try {
    autonomousMainFeedPreparation = await prepareAutonomousMainFeed({
      freshFollowerState: missionFollowers,
      editorialAlreadyRefreshed: editorialPlanRefresh.refreshed,
    });
    if (autonomousMainFeedPreparation.action === 'approved') {
      console.log(`[automation] Delegated First-1,000 preparation approved queue item ${autonomousMainFeedPreparation.queueItemId}.`);
    } else if (!['noop', 'review_required'].includes(autonomousMainFeedPreparation.action)) {
      console.log(`[automation] Delegated First-1,000 preparation: ${autonomousMainFeedPreparation.reason}.`);
    } else if (autonomousMainFeedPreparation.action === 'review_required') {
      console.log(`[automation] Delegated First-1,000 item ${autonomousMainFeedPreparation.queueItemId} remains non-publication: ${autonomousMainFeedPreparation.error || autonomousMainFeedPreparation.reason}.`);
    }
  } catch (error) {
    autonomousMainFeedPreparation = { action: 'error', reason: 'mission_preparation_failed', error: error.message };
    console.log(`[automation] Delegated First-1,000 preparation failed without stopping the daemon: ${error.message}`);
  }

  const missionPublicationReady = missionFollowers?.required !== true
    || (missionFollowers.fresh === true && missionFollowers.authorityChanged !== true);
  const mainFeed = await processMainFeedQueue({ missionPublicationReady });
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
  return {
    ...mainFeed,
    top,
    engagement,
    autonomousReplies,
    measurements,
    publicationBaseline,
    editorialPlanRefresh,
    missionFollowers,
    autonomousMainFeedPreparation,
    errors: [
      ...research.errors,
      ...engagement.errors,
      ...(measurements.error ? [measurements.error] : []),
      ...(missionFollowers?.error ? [missionFollowers.error] : []),
      ...(autonomousMainFeedPreparation?.error ? [autonomousMainFeedPreparation.error] : []),
    ],
  };
}

export async function runCycle() {
  recordAutomationCycleStart();
  try {
    const cycleResult = await runCycleBody();
    recordAutomationCycleSuccess();
    return cycleResult;
  } catch (error) {
    recordAutomationCycleFailure(error);
    throw error;
  }
}

async function main() {
  const once = process.argv.includes('--once');
  if (once) {
    await runCycle();
    return;
  }

  console.log(`[automation] Started. Full poll=${POLL_MINUTES}m, reply poll=${REPLY_POLL_MINUTES}m, scheduler=queue-aware, auto-post=${AUTO_POST}.`);
  let nextFullCycleAt = 0;
  while (true) {
    const now = Date.now();
    try {
      if (now >= nextFullCycleAt) {
        nextFullCycleAt = now + POLL_MINUTES * 60_000;
        await runCycle();
      } else {
        await runEngagementAutonomousCycle({
          refreshSources: true,
          refreshTargetTimelines: false,
        });
      }
    } catch (error) {
      console.error(`[automation] Cycle failed: ${error.message}`);
    }
    const untilFullCycle = Math.max(1_000, nextFullCycleAt - Date.now());
    await new Promise((resolve) => setTimeout(resolve, Math.min(REPLY_POLL_MINUTES * 60_000, untilFullCycle)));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[automation] Fatal error: ${error.message}`);
    process.exit(1);
  });
}
