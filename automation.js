import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import {
  fetchGitHubTrending,
  fetchHackerNews,
  fetchXTechNews,
  generateMomentumPost,
  rankNews,
} from './tech_news.js';
import { postTweetHttp } from './x_http.js';

const STATE_FILE = path.resolve('.automation-state.json');
const POLL_MINUTES = Number(process.env.POLL_MINUTES || 30);
const POST_INTERVAL_HOURS = Number(process.env.POST_INTERVAL_HOURS || 4);
const MIN_MOMENTUM_SCORE = Number(process.env.MIN_MOMENTUM_SCORE || 70);
const NEWS_LIMIT = Number(process.env.NEWS_LIMIT || 8);
const AUTO_POST = String(process.env.AUTO_POST || 'false').toLowerCase() === 'true';
const X_ACCOUNTS = (process.env.X_NEWS_ACCOUNTS || 'github,OpenAI,ycombinator,TechCrunch')
  .split(',')
  .map((account) => account.trim().replace(/^@/, ''))
  .filter(Boolean);

async function loadState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
  } catch {
    return { lastPostedAt: 0, postedKeys: [] };
  }
}

async function saveState(state) {
  await fs.writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function candidateId(candidate) {
  return candidate?.key || candidate?.url || `${candidate?.source}:${candidate?.title}`;
}

async function collectCandidates() {
  const [hnStories, ghRepos, xPosts] = await Promise.all([
    fetchHackerNews(NEWS_LIMIT),
    fetchGitHubTrending(NEWS_LIMIT),
    fetchXTechNews(X_ACCOUNTS, 2),
  ]);
  return rankNews({ hnStories, ghRepos, xPosts });
}

export async function runCycle() {
  const state = await loadState();
  const ranked = await collectCandidates();
  const posted = new Set(state.postedKeys || []);
  const candidate = ranked.find((item) => item.source !== 'x' && !posted.has(candidateId(item)));

  if (!candidate) {
    console.log('[automation] No unseen candidates.');
    return { action: 'none', reason: 'no-candidate' };
  }

  console.log(`[automation] Top unseen candidate: ${candidate.score}/100 ${candidate.source} ${candidate.title}`);

  if (candidate.score < MIN_MOMENTUM_SCORE) {
    console.log(`[automation] Below momentum threshold ${MIN_MOMENTUM_SCORE}; not posting.`);
    return { action: 'none', reason: 'below-threshold', candidate };
  }

  const cooldownMs = POST_INTERVAL_HOURS * 3_600_000;
  const nextAllowedAt = Number(state.lastPostedAt || 0) + cooldownMs;
  if (Date.now() < nextAllowedAt) {
    console.log(`[automation] Cooldown active until ${new Date(nextAllowedAt).toLocaleString()}.`);
    return { action: 'none', reason: 'cooldown', candidate };
  }

  const text = generateMomentumPost(candidate);
  console.log(`[automation] Candidate post (${text.length}/280):\n${text}`);

  if (!AUTO_POST) {
    console.log('[automation] AUTO_POST=false; preview only.');
    return { action: 'preview', candidate, text };
  }

  const authToken = process.env.AUTH_TOKEN;
  const csrfToken = process.env.CT0;
  if (!authToken || !csrfToken) {
    throw new Error('AUTO_POST=true requires AUTH_TOKEN and CT0.');
  }

  const result = await postTweetHttp(text, { authToken, csrfToken });
  state.lastPostedAt = Date.now();
  state.postedKeys = [...posted, candidateId(candidate)].slice(-200);
  await saveState(state);

  const tweetId = result?.rest_id || result?.legacy?.id_str || null;
  console.log(`[automation] Posted successfully${tweetId ? `: ${tweetId}` : '.'}`);
  return { action: 'posted', candidate, text, tweetId };
}

async function main() {
  const once = process.argv.includes('--once');

  if (once) {
    await runCycle();
    return;
  }

  console.log(`[automation] Started. Poll=${POLL_MINUTES}m, post cooldown=${POST_INTERVAL_HOURS}h, threshold=${MIN_MOMENTUM_SCORE}, auto-post=${AUTO_POST}.`);
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
