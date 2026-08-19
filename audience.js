import 'dotenv/config';
import { Scraper, createBrowser, createPage } from 'xactions';
import { TwitterHttpClient, unfollowUser as unfollowUserHttp } from 'xactions/scrapers/twitter/http';
import { classifyAudienceProfile } from './strategy.js';
import {
  getAppState,
  getAudienceProfile,
  getNewFollowerQuality,
  getRelationshipProfile,
  listAudienceProfiles,
  refreshRelationshipFromAudience,
  replaceAudienceSnapshot,
  setAppState,
  setAudienceFollowState,
} from './store.js';

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
