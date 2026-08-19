import 'dotenv/config';
import { Scraper, createBrowser, createPage } from 'xactions';
import { TwitterHttpClient, unfollowUser as unfollowUserHttp } from 'xactions/scrapers/twitter/http';
import { classifyNiche } from './strategy.js';
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

export const AUDIENCE_NICHE_GROUPS = [
  {
    tag: 'agents',
    label: 'AI & agents',
    weight: 18,
    terms: [
      'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
      'coding agent', 'coding agents', 'ai agent', 'ai agents', 'developer agent', 'agentic', 'agentic workflow', 'agentic workflows',
      'claude', 'claudes', 'claude code', 'codex', 'cursor', 'cursor ai', 'opencode', 'mcp', 'model context protocol', 'ai pair programmer', 'vibe coding',
      'llm', 'llms', 'ai model', 'ai models', 'open source model', 'open source models', 'frontier model', 'frontier models',
      'foundation model', 'foundation models', 'qwen', 'deepseek', 'glm', 'llama', 'inference', 'context window',
      'quantization', 'fine-tuning', 'ollama', 'vllm', 'mistral', 'anthropic', 'openai', 'chatgpt', 'gemini',
      'hugging face', 'huggingface', 'prompt engineering', 'langchain', 'llamaindex', 'crewai', 'autogpt',
      'ml engineer', 'ai engineer', 'applied ai', 'generative ai', 'genai', 'text-to-code', 'embeddings', 'vector db', 'vector database',
      'ai safety', 'ai research', 'ai researcher', 'superintelligence', 'agi',
    ],
  },
  {
    tag: 'devtools',
    label: 'Dev tools & frameworks',
    weight: 16,
    terms: [
      'angular', 'angularjs', 'react', 'reactjs', 'react.js', 'react native', 'vue', 'vuejs', 'vue.js',
      'svelte', 'sveltekit', 'next.js', 'nextjs', 'nuxt', 'nuxtjs', 'remix', 'astro', 'solidjs', 'solid.js', 'gatsby',
      'django', 'rails', 'ruby on rails', 'laravel', 'spring boot', 'spring framework', '.net', 'asp.net', 'dotnet',
      'express.js', 'expressjs', 'fastify', 'nestjs', 'nest.js', 'flask', 'fastapi', 'gin', 'fiber', 'actix', 'axum', 'phoenix',
      'swiftui', 'uikit', 'flutter', 'expo', 'jetpack compose', 'ionic', 'capacitor', 'electron', 'tauri', 'web framework',
      'typescript', 'ts', 'javascript', 'js', 'python', 'node.js', 'nodejs', 'node', 'bun', 'deno',
      'golang', 'go dev', 'go developer', 'go engineer', 'go programming', 'rust', 'rustlang', 'rustacean',
      'c++', 'cpp', 'c#', 'csharp', 'java', 'jvm', 'kotlin', 'kmp', 'swift', 'php', 'ruby', 'scala', 'elixir', 'clojure', 'haskell', 'zig',
      'tailwind', 'tailwindcss', 'bootstrap', 'redux', 'ngrx', 'rxjs', 'zustand', 'prisma', 'drizzle', 'typeorm', 'graphql', 'rest api', 'grpc', 'trpc',
      'github', 'gitlab', 'git', 'vscode', 'vs code', 'neovim', 'vim', 'ide', 'sdk', 'cli', 'devtool', 'devtools', 'developer tool', 'developer tools',
      'developer experience', 'devex', 'npm', 'pnpm', 'yarn', 'cargo', 'pip', 'webpack', 'vite', 'turbopack',
    ],
  },
  {
    tag: 'software',
    label: 'Software engineering',
    weight: 16,
    terms: [
      'software engineer', 'software engineering', 'software developer', 'software dev', 'software architecture', 'software architect',
      'software', 'developer', 'developers', 'devs', 'dev', 'programmer', 'programmers', 'programming', 'coder', 'coders', 'coding',
      'frontend', 'front-end', 'frontend engineer', 'frontend developer', 'frontend dev',
      'backend', 'back-end', 'backend engineer', 'backend developer', 'backend dev',
      'fullstack', 'full stack', 'full-stack', 'fullstack developer', 'fullstack engineer', 'fullstack dev',
      'web developer', 'web development', 'web dev', 'web app', 'web apps', 'web application', 'web applications',
      'mobile developer', 'mobile dev', 'ios developer', 'ios dev', 'android developer', 'android dev',
      'embedded systems', 'firmware', 'firmware engineer', 'game developer', 'game dev',
      'devops', 'sre', 'site reliability', 'site reliability engineer', 'sysadmin', 'system administrator', 'systems engineer',
      'tech lead', 'technical lead', 'staff engineer', 'principal engineer', 'engineering manager', 'engineering lead', 'engineering director',
      'cto', 'vp of engineering', 'chief technology officer', 'head of engineering',
      'data engineer', 'data engineering', 'data scientist', 'data science', 'qa engineer', 'test automation',
      'cybersecurity', 'security engineer', 'security researcher', 'infosec', 'appsec', 'whitehat', 'pentest', 'cryptography',
      'computer science', 'computer scientist',
      'open source', 'oss', 'open-source', 'core contributor', 'maintainer',
    ],
  },
  {
    tag: 'infra',
    label: 'Cloud & infrastructure',
    weight: 14,
    terms: [
      'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'cloudflare', 'vercel', 'netlify', 'heroku',
      'hetzner', 'digitalocean', 'fly.io', 'supabase', 'firebase', 'web hosting', 'data center',
      'docker', 'kubernetes', 'k8s', 'containers', 'serverless', 'microservices', 'lambda', 'terraform', 'ansible',
      'linux', 'unix', 'bash', 'shell', 'ci/cd', 'observability', 'datadog', 'prometheus', 'grafana', 'webassembly', 'wasm', 'webgpu',
      'postgres', 'postgresql', 'mysql', 'sqlite', 'mongodb', 'redis', 'cassandra', 'dynamodb', 'vector database',
      'elasticsearch', 'meilisearch', 'clickhouse', 'snowflake', 'bigquery', 'database', 'databases', 'db admin', 'dba', 'sql', 'nosql',
      'api design', 'latency', 'distributed systems', 'cloud architecture', 'cloud engineer', 'cloud cost', 'cloud',
    ],
  },
  {
    tag: 'jobs/career',
    label: 'Developer education & careers',
    weight: 12,
    terms: [
      'tech education', 'technical education', 'coding education', 'programming education', 'developer education', 'developer training',
      'tech school', 'coding bootcamp', 'tech bootcamp', 'coding course', 'coding courses', 'programming course', 'developer courses',
      'coding tutorial', 'coding tutorials', 'learn to code', 'teach code', 'learn programming', 'tech tutorial', 'tech tutorials', 'developer tutorial', 'developer tutorials',
      'course creator', 'instructor', 'teaching programming', 'ztm', 'zerotomastery',
      'software engineer job', 'developer job', 'developer career', 'engineering career', 'tech jobs', 'technical interview',
      'leetcode', 'mentors', 'mentor', 'mentoring developers', 'developer mentor', 'tech mentor', 'hiring developers', 'remote developer',
      'developer advocate', 'developer advocacy', 'devrel', 'developer relations', 'tech speaker', 'tech content creator', 'tech educator', 'tech author',
    ],
  },
  {
    tag: 'builders',
    label: 'Builders & startups',
    weight: 12,
    terms: [
      'indie hacker', 'indie hackers', 'indie dev', 'indie developer', 'micro-saas', 'ai saas', 'dev saas', 'b2b saas',
      'tech founder', 'technical founder', 'developer founder', 'build in public', 'building in public',
      'bootstrapped founder', 'shipping software', 'software founder', 'maker', 'ship products', 'saas founder', 'startup founder', 'saas',
    ],
  },
  {
    tag: 'communities',
    label: 'Technical communities',
    weight: 12,
    terms: [
      'technical community', 'tech community', 'developer community', 'engineering community', 'open communities', 'open community',
      'it professionals', 'tech professionals', 'tech meetup', 'developer meetup', 'user group',
      'gdg', 'google developer expert', 'gde', 'microsoft mvp', 'aws hero', 'aws community builder',
      'tech podcast', 'developer podcast', 'tech newsletter', 'developer newsletter', 'tech blog', 'developer publication', 'tech publication', 'tech conference',
    ],
  },
];

export const AUDIENCE_NICHE_LABELS = Object.fromEntries(
  AUDIENCE_NICHE_GROUPS.map(({ tag, label }) => [tag, label]),
);

export const AUDIENCE_NEGATIVE_SIGNALS = [
  'crypto', 'cryptocurrency', 'blockchain', 'defi', 'nft', 'nfts', 'memecoin', 'memecoins', 'solana',
  'bitcoin', 'btc', 'eth', 'ethereum', 'on-chain', 'trader', 'trading', 'crypto-trader', 'forex', 'fx trader',
  'airdrop', 'pnl', 'pump.fun', 'dexscreener', 'tokenomics', 'degen', 'hodl', 'altcoin', 'altcoins',
  'adult content', '18+', 'nsfw', 'onlyfans', 'escort',
  'casino', 'gambling', 'sports betting', 'betting tips', 'slot online',
  'gain followers', 'f4f', 'horoscope', 'astrology',
];

function containsProfileTerm(text, term) {
  const escaped = String(term).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(String(text || ''));
}

export function classifyAudienceProfile(profile) {
  const username = String(profile?.username || '').replace(/^@/, '');
  const displayName = String(profile?.displayName || username);
  const bio = String(profile?.bio || '');
  const combined = `${username} ${displayName} ${bio}`;
  const expanded = `${username} ${displayName} ${bio}`
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[#@_.:/\\-]+/g, ' ');

  const tags = [];
  const matches = [];
  let score = 0;

  for (const group of AUDIENCE_NICHE_GROUPS) {
    const groupMatches = group.terms.filter((term) =>
      containsProfileTerm(combined, term) || containsProfileTerm(expanded, term),
    );
    if (groupMatches.length) {
      tags.push(group.tag);
      matches.push(...groupMatches);
      score += group.weight;
    }
  }

  const contentNiche = classifyNiche(`${displayName} ${bio}`);
  if (contentNiche.tags?.length) {
    for (const tag of contentNiche.tags) {
      if (!tags.includes(tag)) tags.push(tag);
    }
  }
  if (contentNiche.matches?.length) {
    matches.push(...contentNiche.matches);
  }
  score = Math.max(score, contentNiche.score || 0);

  const uniqueMatches = [...new Set(matches)];
  const hasDevSignal = uniqueMatches.length > 0;

  const negativeMatches = AUDIENCE_NEGATIVE_SIGNALS.filter((term) =>
    containsProfileTerm(combined, term) || containsProfileTerm(expanded, term),
  );
  const uniqueNegativeMatches = [...new Set(negativeMatches)];

  let relevanceScore = 0;
  let fitBucket = 'uncertain';

  if (hasDevSignal) {
    relevanceScore = Math.min(50, Math.max(12, score));
    if (uniqueNegativeMatches.length && relevanceScore > 12) {
      relevanceScore = Math.max(12, relevanceScore - 6);
    }
    fitBucket = 'in_niche';
  } else if (uniqueNegativeMatches.length) {
    relevanceScore = 0;
    fitBucket = 'outside_niche';
  } else {
    relevanceScore = 0;
    fitBucket = 'uncertain';
  }

  return {
    username,
    displayName,
    bio,
    relevanceScore,
    nicheTags: tags,
    matchedKeywords: uniqueMatches,
    negativeMatches: uniqueNegativeMatches,
    fitBucket,
  };
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

  let browser;
  try {
    browser = await createBrowser({ headless: true });
    const page = await createPage(browser);
    const browserCookies = [{ name: 'auth_token', value: process.env.AUTH_TOKEN, domain: '.x.com', path: '/', secure: true, httpOnly: true }];
    if (process.env.CT0) browserCookies.push({ name: 'ct0', value: process.env.CT0, domain: '.x.com', path: '/', secure: true });
    await page.setCookie(...browserCookies);
    await page.goto(`https://x.com/${encodeURIComponent(normalized)}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    const button = await page.waitForSelector('[data-testid$="-unfollow"]', { timeout: 12_000 });
    const testId = await page.evaluate((element) => element.getAttribute('data-testid') || '', button);
    const userId = testId.match(/^(\d+)-unfollow$/)?.[1];
    if (!userId) throw new Error('Could not resolve the current X user ID from the profile.');

    const cookieString = [
      `auth_token=${process.env.AUTH_TOKEN}`,
      process.env.CT0 ? `ct0=${process.env.CT0}` : '',
    ].filter(Boolean).join('; ');
    const client = new TwitterHttpClient({ cookies: cookieString, maxRetries: 0 });
    const result = await unfollowUserHttp(client, userId);
    if (result?.success !== true) throw new Error('X did not return a successful unfollow response.');
  } catch (error) {
    throw new Error(`X did not complete the unfollow for @${normalized}: ${error.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
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
