import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import {
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
  getPreferenceProfile,
  listApprovedMainFeedItems,
  listRecentMainFeedPublications,
  markQueueFailed,
  markQueuePublished,
  recordCandidateAction,
  saveDraft,
  saveQueueItem,
  upsertCandidates,
} from './store.js';

const POLL_MINUTES = Number(process.env.POLL_MINUTES || 30);
const NEWS_LIMIT = Number(process.env.NEWS_LIMIT || 8);
const AUTO_POST = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';

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
  return { ...mainFeed, top, engagement, errors: [...research.errors, ...engagement.errors] };
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
