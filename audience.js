import 'dotenv/config';
import { Scraper, createBrowser, createPage } from 'xactions';
import { TwitterHttpClient, unfollowUser as unfollowUserHttp } from 'xactions/scrapers/twitter/http';
import { AUDIENCE_NICHE_LABELS, classifyAudienceProfile } from './strategy.js';
import { runStructuredAI } from './ai_runtime.js';
import {
  getAppState,
  getAudienceProfile,
  getAudienceSummary,
  getNewFollowerQuality,
  getRelationshipProfile,
  listAudienceProfiles,
  refreshRelationshipFromAudience,
  replaceAudienceSnapshot,
  setAppState,
  setAudienceFollowState,
} from './store.js';

const AUDIENCE_AI_REVIEW_KEY = 'audience_ai_review';
const AUDIENCE_REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', maxLength: 2000 },
    suggestions: {
      type: 'array',
      maxItems: 150,
      items: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 1, maxLength: 50 },
          decision: { type: 'string', enum: ['consider_unfollow', 'needs_human_review'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          reason: { type: 'string', minLength: 1, maxLength: 600 },
          signals: {
            type: 'array',
            maxItems: 6,
            items: { type: 'string', minLength: 1, maxLength: 120 },
          },
        },
        required: ['username', 'decision', 'confidence', 'reason', 'signals'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'suggestions'],
  additionalProperties: false,
};

function audienceReviewInput(profile) {
  const relationship = getRelationshipProfile(profile.username);
  return {
    username: profile.username,
    displayName: profile.displayName || profile.username,
    bio: String(profile.bio || '').slice(0, 600),
    followsYou: Boolean(profile.followsYou),
    fitBucket: profile.fitBucket || 'uncertain',
    relevanceScore: Number(profile.relevanceScore || 0),
    nicheTags: (profile.nicheTags || []).map((tag) => AUDIENCE_NICHE_LABELS[tag] || tag),
    matchedKeywords: (profile.matchedKeywords || []).slice(0, 12),
    exclusionMatches: (profile.exclusionMatches || []).slice(0, 8),
    deprioritizationMatches: (profile.deprioritizationMatches || []).slice(0, 8),
    relationship: relationship ? {
      classes: relationship.classes || [],
      stage: relationship.relationshipStage || 'observed',
      targetScore: Number(relationship.targetScore || 0),
      meaningfulInteractions: Number(relationship.meaningfulInteractions || 0),
      theirRepliesToUs: Number(relationship.theirRepliesToUs || 0),
      theirQuotesOfUs: Number(relationship.theirQuotesOfUs || 0),
      theirRepostsOfUs: Number(relationship.theirRepostsOfUs || 0),
      lastInteractionAt: relationship.lastInteractionAt || null,
    } : null,
  };
}

function hydrateAudienceReview(review) {
  if (!review || typeof review !== 'object') return null;
  const suggestions = (review.suggestions || []).map((suggestion) => {
    const profile = getAudienceProfile(suggestion.username);
    if (!profile?.youFollow) return null;
    return { ...suggestion, profile };
  }).filter(Boolean);
  return { ...review, suggestions };
}

export function getAudienceAiReview() {
  const raw = getAppState(AUDIENCE_AI_REVIEW_KEY, '');
  if (!raw) return null;
  try {
    return hydrateAudienceReview(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function reviewAudienceFollowing({ profile = null } = {}) {
  const summary = getAudienceSummary();
  const following = listAudienceProfiles({
    youFollow: true,
    minScore: 0,
    limit: Math.max(100, Number(summary.following || 0) + 20),
  });
  const reviewedAt = Date.now();
  if (!following.length) {
    const empty = {
      reviewedAt,
      reviewedCount: 0,
      totalFollowing: 0,
      summary: 'No currently followed accounts are available to review.',
      suggestions: [],
      execution: null,
    };
    setAppState(AUDIENCE_AI_REVIEW_KEY, JSON.stringify(empty));
    return hydrateAudienceReview(empty);
  }

  const packet = following.map(audienceReviewInput);
  const prompt = [
    'You are reviewing the operator current X following list for network quality.',
    'The target network is AI, coding agents, models/inference, developer tools, software engineering, infrastructure, technical education/careers, builders/startups, and technical communities.',
    'Suggest only accounts worth CONSIDERING for unfollow. Do not produce keep recommendations.',
    'Be conservative. A sparse bio or an existing deterministic outside/uncertain label is not enough by itself.',
    'Preserve strategically useful technical accounts, active relationships, recurring conversations, authorities, customers/prospects, and mutual relationships unless the supplied evidence clearly argues otherwise.',
    'Prioritize clearly unrelated focus, explicit exclusion/spam signals, chronically low relevance with no strategic relationship, or accounts whose current profile evidence does not support the target network.',
    'Use needs_human_review instead of consider_unfollow when evidence is incomplete, the account follows the operator back, or relationship context creates a meaningful tradeoff.',
    'Never infer sensitive traits and never use protected characteristics as a reason.',
    'Return only exact usernames present in FOLLOWING. Do not invent usernames. Order suggestions from strongest removal case to weakest.',
    `TARGET NICHE LABELS: ${JSON.stringify(Object.values(AUDIENCE_NICHE_LABELS))}`,
    `FOLLOWING (${packet.length}): ${JSON.stringify(packet)}`,
  ].join('\n\n');

  const result = await runStructuredAI({
    role: 'audience_review',
    profile,
    prompt,
    schema: AUDIENCE_REVIEW_SCHEMA,
    timeoutMs: 120_000,
    metadata: { consumer: 'audience_review', followingCount: packet.length },
  });

  const allowed = new Map(following.map((item) => [item.username.toLowerCase(), item]));
  const seen = new Set();
  const suggestions = [];
  for (const item of result.output.suggestions || []) {
    const username = String(item.username || '').replace(/^@/, '').trim().toLowerCase();
    if (!allowed.has(username) || seen.has(username)) continue;
    seen.add(username);
    const stored = allowed.get(username);
    const relationship = getRelationshipProfile(username);
    const needsReview = Boolean(stored.followsYou)
      || Number(relationship?.meaningfulInteractions || 0) > 0
      || ['responsive', 'recurring', 'connected', 'mutual'].includes(String(relationship?.relationshipStage || ''));
    suggestions.push({
      rank: suggestions.length + 1,
      username,
      decision: needsReview ? 'needs_human_review' : item.decision,
      confidence: item.confidence,
      reason: item.reason,
      signals: item.signals || [],
    });
  }

  const review = {
    reviewedAt,
    reviewedCount: following.length,
    totalFollowing: Number(summary.following || following.length),
    summary: result.output.summary,
    suggestions,
    execution: result.execution,
  };
  setAppState(AUDIENCE_AI_REVIEW_KEY, JSON.stringify(review));
  return hydrateAudienceReview(review);
}

function normalizeCell(row) {
  const lines = String(row.text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const username = String(row.username || '').replace(/^@/, '');
  const displayName = lines[0] || username;
  const bio = lines.filter((line) => line !== displayName && line !== `@${username}` && !['Following', 'Follow', 'Follow back', 'Follows you'].includes(line)).join(' ');
  const classified = classifyAudienceProfile({ username, displayName, bio });
  return {
    username: classified.username,
    displayName: classified.displayName,
    bio: classified.bio,
    relevanceScore: classified.relevanceScore,
    nicheTags: classified.nicheTags,
    matchedKeywords: classified.matchedKeywords,
  };
}

export function refreshAudienceRelationships(usernames = []) {
  const observed = [...new Set(usernames.map((username) => String(username || '').replace(/^@/, '').toLowerCase()).filter(Boolean))];
  let refreshed = 0;
  let skipped = 0;
  for (const username of observed) {
    const audienceProfile = getAudienceProfile(username);
    if (!audienceProfile) continue;
    if (!getRelationshipProfile(username) && audienceProfile.relevanceScore < 12) {
      skipped++;
      continue;
    }
    refreshRelationshipFromAudience(audienceProfile);
    refreshed++;
  }
  return { observed: observed.length, refreshed, skipped };
}

async function scrapeRelationship(page, url, target, relationshipText) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  await page.waitForSelector('[data-testid="UserCell"]', { timeout: 10_000 }).catch(() => {});
  const seen = new Map();
  let stagnantPasses = 0;

  for (let pass = 0; pass < 90 && seen.size < target && stagnantPasses < 6; pass++) {
    const before = seen.size;
    const rows = await page.evaluate((requiredText) => [...document.querySelectorAll('[data-testid="UserCell"]')]
      .map((cell) => {
        const text = (cell.innerText || '').trim();
        if (!text.includes(requiredText)) return null;
        const link = [...cell.querySelectorAll('a[href^="/"]')].find((a) => /^\/[A-Za-z0-9_]+$/.test(a.getAttribute('href') || ''));
        return link ? { username: link.getAttribute('href').slice(1), text } : null;
      })
      .filter(Boolean), relationshipText);
    for (const row of rows) seen.set(row.username, row);
    stagnantPasses = seen.size === before ? stagnantPasses + 1 : 0;
    if (seen.size >= target) break;
    await page.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight * 2, 1400)));
    await new Promise((resolve) => setTimeout(resolve, 650));
  }

  return [...seen.values()].map(normalizeCell);
}

export async function unfollowAudienceUser(username) {
  const normalized = String(username || '').replace(/^@/, '').trim().toLowerCase();
  if (!normalized) throw new Error('Username is required.');
  const profile = getAudienceProfile(normalized);
  if (!profile?.youFollow) throw new Error(`@${normalized} is not marked as currently followed.`);
  if (!process.env.AUTH_TOKEN) throw new Error('Missing AUTH_TOKEN.');

  try {
    const scraper = new Scraper();
    const scraperCookies = [{ name: 'auth_token', value: process.env.AUTH_TOKEN }];
    if (process.env.CT0) scraperCookies.push({ name: 'ct0', value: process.env.CT0 });
    await scraper.setCookies(scraperCookies);
    let xProfile;
    try {
      xProfile = await scraper.getProfile(normalized);
    } catch (error) {
      if (/not found|unavailable|suspended/i.test(String(error?.message || ''))) throw error;
      const retryDelayMs = 1_000 + Math.floor(Math.random() * 2_001);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      xProfile = await scraper.getProfile(normalized);
    }
    if (!xProfile?.id) throw new Error('Could not resolve the current X user ID from the profile API.');

    const cookieString = [
      `auth_token=${process.env.AUTH_TOKEN}`,
      process.env.CT0 ? `ct0=${process.env.CT0}` : '',
    ].filter(Boolean).join('; ');
    const client = new TwitterHttpClient({ cookies: cookieString, maxRetries: 0 });
    const result = await unfollowUserHttp(client, xProfile.id);
    if (result?.success !== true) throw new Error('X did not return a successful unfollow response.');
  } catch (error) {
    throw new Error(`X did not complete the unfollow for @${normalized}: ${error.message}`);
  }

  const updated = setAudienceFollowState(normalized, { youFollow: false });
  if (getRelationshipProfile(normalized)) refreshRelationshipFromAudience(updated);
  return updated;
}

export async function syncAudience(username = 'ham_zax') {
  if (!process.env.AUTH_TOKEN) throw new Error('Missing AUTH_TOKEN.');
  const scraper = new Scraper();
  const scraperCookies = [{ name: 'auth_token', value: process.env.AUTH_TOKEN }];
  if (process.env.CT0) scraperCookies.push({ name: 'ct0', value: process.env.CT0 });
  await scraper.setCookies(scraperCookies);
  const profile = await scraper.getProfile(username);

  const browser = await createBrowser({ headless: true });
  try {
    const page = await createPage(browser);
    const cookies = [{ name: 'auth_token', value: process.env.AUTH_TOKEN, domain: '.x.com', path: '/', secure: true, httpOnly: true }];
    if (process.env.CT0) cookies.push({ name: 'ct0', value: process.env.CT0, domain: '.x.com', path: '/', secure: true });
    await page.setCookie(...cookies);

    const followers = await scrapeRelationship(page, `https://x.com/${username}/followers`, Math.max(profile.followersCount, 1), 'Follows you');
    const following = await scrapeRelationship(page, `https://x.com/${username}/following`, Math.max(profile.followingCount, 1), 'Following');
    const capturedAt = Date.now();
    const previousSyncAt = Number(getAppState('audience_last_sync_at', 0) || 0);
    const followersComplete = followers.length >= Number(profile.followersCount || 0);
    const followingComplete = following.length >= Number(profile.followingCount || 0);
    const previouslyActive = [
      ...(followersComplete ? listAudienceProfiles({ followsYou: true, minScore: 0, limit: 5000 }) : []),
      ...(followingComplete ? listAudienceProfiles({ youFollow: true, minScore: 0, limit: 5000 }) : []),
    ];
    const summary = replaceAudienceSnapshot({
      followers,
      following,
      observedAt: capturedAt,
      followersComplete,
      followingComplete,
    });
    const relationshipRefresh = refreshAudienceRelationships([
      ...previouslyActive.map((profile) => profile.username),
      ...followers.map((profile) => profile.username),
      ...following.map((profile) => profile.username),
    ]);
    const account = {
      username: profile.username,
      name: profile.name,
      bio: profile.bio,
      followersCount: profile.followersCount,
      followingCount: profile.followingCount,
      tweetCount: profile.tweetCount,
      likesCount: profile.likesCount,
      capturedAt,
    };
    setAppState('account_profile', JSON.stringify(account));
    setAppState('audience_last_sync_at', capturedAt);
    return {
      account,
      summary,
      followers: followers.length,
      following: following.length,
      relationshipRefresh,
      newFollowerQuality: getNewFollowerQuality({ since: previousSyncAt, until: capturedAt }),
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const result = await syncAudience(process.env.X_ACCOUNT || 'ham_zax');
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1]?.endsWith('/audience.js') || process.argv[1] === 'audience.js') {
  main().catch((error) => {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  });
}
