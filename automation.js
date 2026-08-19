import 'dotenv/config';
import {
  fetchGitHubTrending,
  fetchHackerNews,
  fetchXNichePosts,
  fetchXViralPosts,
  rankNews,
  rankXViralPosts,
} from './tech_news.js';
import { postTweetHttp } from './x_http.js';
import { personalizeCandidates } from './strategy.js';
import {
  getAppState,
  getCandidate,
  getNextReadyDraft,
  getPreferenceProfile,
  saveDraft,
  setAppState,
  upsertCandidates,
} from './store.js';

const POLL_MINUTES = Number(process.env.POLL_MINUTES || 30);
const POST_INTERVAL_HOURS = Number(process.env.POST_INTERVAL_HOURS || 4);
const MIN_DRAFT_SCORE = Number(process.env.MIN_DRAFT_SCORE || 40);
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

export async function runCycle() {
  const research = await refreshResearch();
  const top = [...research.viral, ...research.ranked].sort((a, b) => b.score - a.score)[0] || null;
  if (top) {
    console.log(`[automation] Research leader: ${top.score}/100 ${top.source} ${top.title}`);
  } else {
    console.log('[automation] No research candidates this cycle.');
  }
  if (research.errors.length) console.log(`[automation] Partial research errors: ${research.errors.join(' | ')}`);

  const draft = getNextReadyDraft(Date.now(), MIN_DRAFT_SCORE);
  if (!draft) {
    console.log(`[automation] No ready draft at or above ${MIN_DRAFT_SCORE}/50.`);
    return { action: 'research-only', top, errors: research.errors };
  }

  const candidate = getCandidate(draft.candidateKey);
  if (!candidate) throw new Error(`Ready draft ${draft.id} has no source candidate.`);

  const lastPostedAt = Number(getAppState('last_posted_at', 0) || 0);
  const nextAllowedAt = lastPostedAt + POST_INTERVAL_HOURS * 3_600_000;
  if (Date.now() < nextAllowedAt) {
    console.log(`[automation] Ready draft ${draft.id} waiting for cooldown until ${new Date(nextAllowedAt).toLocaleString()}.`);
    return { action: 'cooldown', draft, candidate, nextAllowedAt };
  }

  console.log(`[automation] Ready draft ${draft.id} (${draft.qualityScore}/50):\n${draft.body}`);
  if (!AUTO_POST) {
    console.log('[automation] AUTO_POST=false; queue preview only.');
    return { action: 'preview', draft, candidate };
  }

  const authToken = process.env.AUTH_TOKEN;
  const csrfToken = process.env.CT0;
  if (!authToken || !csrfToken) throw new Error('AUTO_POST=true requires AUTH_TOKEN and CT0.');

  const result = await postTweetHttp(draft.body, { authToken, csrfToken });
  const tweetId = result?.rest_id || result?.legacy?.id_str || null;
  saveDraft({ ...draft, status: 'published', publishedTweetId: tweetId });
  setAppState('last_posted_at', Date.now());

  console.log(`[automation] Published draft ${draft.id}${tweetId ? ` as ${tweetId}` : ''}.`);
  return { action: 'posted', draft, candidate, tweetId };
}

async function main() {
  const once = process.argv.includes('--once');
  if (once) {
    await runCycle();
    return;
  }

  console.log(`[automation] Started. Poll=${POLL_MINUTES}m, cooldown=${POST_INTERVAL_HOURS}h, min draft=${MIN_DRAFT_SCORE}/50, auto-post=${AUTO_POST}.`);
  while (true) {
    try {
      await runCycle();
    } catch (error) {
      console.error(`[automation] Cycle failed: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MINUTES * 60_000));
  }
}

main().catch((error) => {
  console.error(`[automation] Fatal error: ${error.message}`);
  process.exit(1);
});
