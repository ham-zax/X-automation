import { normalizeBehaviorDecision } from './behavior.js';

export const NICHE_GROUPS = [
  {
    tag: 'agents',
    label: 'AI-assisted development',
    weight: 16,
    role: 'core',
    targetShare: 12,
    researchTier: 2,
    terms: ['coding agent', 'coding agents', 'ai agent', 'ai agents', 'claude code', 'codex', 'cursor', 'opencode', 'windsurf', 'copilot', 'github copilot', 'cline', 'roo code', 'aider', 'mcp', 'model context protocol', 'agentic', 'developer agent', 'software agent', 'agent runtime', 'agent memory', 'tool calling', 'computer use', 'browser agent', 'terminal agent', 'code review agent', 'autonomous coding', 'agent skills', 'ai ide', 'ai pair programmer', 'vibe coding'],
  },
  {
    tag: 'models',
    label: 'Models & inference',
    weight: 12,
    role: 'core',
    targetShare: 8,
    researchTier: 2,
    terms: ['llm', 'ai model', 'open source model', 'reasoning model', 'coding model', 'open model', 'open weights', 'local llm', 'local model', 'openai', 'anthropic', 'claude', 'gemini', 'grok', 'qwen', 'deepseek', 'glm', 'minimax', 'mistral', 'llama', 'inference', 'tokens per second', 'context window', 'structured output', 'function calling', 'tool use', 'multimodal', 'terminal-bench', 'swe-bench', 'quantization', 'fine-tuning', 'ollama', 'vllm'],
  },
  {
    tag: 'frontend',
    label: 'JavaScript, TypeScript & frontend',
    weight: 16,
    role: 'core',
    targetShare: 14,
    researchTier: 1,
    terms: ['frontend', 'front-end', 'javascript', 'typescript', 'react', 'reactjs', 'react.js', 'next.js', 'nextjs', 'vue', 'vuejs', 'svelte', 'sveltekit', 'astro', 'css', 'html', 'browser performance', 'web performance', 'vite', 'tailwind', 'tailwindcss', 'redux', 'zustand'],
  },
  {
    tag: 'backend',
    label: 'Node.js, backend & APIs',
    weight: 16,
    role: 'core',
    targetShare: 14,
    researchTier: 1,
    terms: ['backend', 'back-end', 'node.js', 'nodejs', 'express.js', 'expressjs', 'fastify', 'nestjs', 'nest.js', 'api', 'api design', 'rest api', 'graphql', 'grpc', 'trpc', 'server', 'microservice', 'microservices', 'bun', 'deno'],
  },
  {
    tag: 'python',
    label: 'Python engineering',
    weight: 14,
    role: 'core',
    targetShare: 10,
    researchTier: 1,
    terms: ['python', 'django', 'flask', 'fastapi', 'pytest', 'pip', 'uv', 'poetry', 'pydantic'],
  },
  {
    tag: 'systems',
    label: 'Rust, Go & systems',
    weight: 14,
    role: 'core',
    targetShare: 10,
    researchTier: 1,
    terms: ['rust', 'rustlang', 'golang', 'go programming', 'c++', 'cpp', 'zig', 'systems programming', 'systems engineer', 'concurrency', 'memory safety', 'webassembly', 'wasm'],
  },
  {
    tag: 'data',
    label: 'Databases & data systems',
    weight: 14,
    role: 'core',
    targetShare: 8,
    researchTier: 2,
    terms: ['database', 'databases', 'postgres', 'postgresql', 'mysql', 'sqlite', 'redis', 'mongodb', 'sql', 'nosql', 'clickhouse', 'dynamodb', 'orm', 'prisma', 'drizzle'],
  },
  {
    tag: 'devtools',
    label: 'Developer tools & open source',
    weight: 14,
    role: 'core',
    targetShare: 10,
    researchTier: 1,
    terms: ['developer tool', 'developer tools', 'devtools', 'developer experience', 'sdk', 'cli', 'github', 'git', 'vscode', 'vs code', 'neovim', 'open source', 'open-source', 'oss', 'npm', 'pnpm', 'yarn', 'cargo', 'package manager', 'testing tool', 'debugging'],
  },
  {
    tag: 'infra',
    label: 'Infrastructure & architecture',
    weight: 14,
    role: 'core',
    targetShare: 9,
    researchTier: 2,
    terms: ['docker', 'kubernetes', 'k8s', 'ci/cd', 'serverless', 'cloudflare', 'vercel', 'supabase', 'aws', 'azure', 'gcp', 'observability', 'linux', 'terraform', 'ansible', 'latency', 'cloud cost', 'distributed systems', 'software architecture'],
  },
  {
    tag: 'builders',
    label: 'Building & shipping software',
    weight: 12,
    role: 'core',
    targetShare: 5,
    researchTier: 2,
    terms: ['indie hacker', 'developer founder', 'micro-saas', 'build in public', 'building in public', 'shipping software', 'ship products', 'product launch', 'technical founder', 'software founder', 'saas'],
  },
  {
    tag: 'jobs/career',
    label: 'Developer careers',
    weight: 10,
    role: 'adjacent',
    targetShare: 0,
    researchTier: 3,
    discover: false,
    requiresTechnicalContext: true,
    terms: ['software engineer job', 'developer job', 'ai engineer', 'hiring developers', 'engineering jobs', 'internship', 'job search', 'developer career', 'engineering career', 'technical interview', 'remote job'],
  },
  {
    tag: 'business',
    label: 'Developer business & productization',
    weight: 10,
    role: 'adjacent',
    targetShare: 0,
    researchTier: 3,
    discover: false,
    requiresTechnicalContext: true,
    terms: ['pricing', 'revenue', 'customers', 'distribution', 'sales', 'consulting', 'productized service', 'api monetization', 'developer marketing', 'sponsorship'],
  },
];

export const GROWTH_FOCUS_PROFILE_VERSION = 5;
export const NICHE_LABELS = Object.fromEntries(NICHE_GROUPS.map(({ tag, label }) => [tag, label]));
export const CANDIDATE_CLASSIFIER_VERSION = 8;
export const GROWTH_FOCUS_OBJECTIVES = Object.freeze([
  'qualified_growth',
  'reach_momentum',
  'relationships',
  'technical_authority',
  'balanced',
]);

const DISCOVERY_CRYPTO_SIGNALS = [
  'crypto', 'cryptocurrency', 'blockchain', 'web3', 'defi', 'nft', 'memecoin', 'on-chain', 'airdrop', 'tokenomics',
];
const DISCOVERY_CRYPTO_PROMOTION_SIGNALS = [
  'currency', 'token', 'miners', 'validators', 'staking', 'presale', 'holders', 'buy now',
];
const DISCOVERY_JOB_AD_SIGNALS = [
  'we are hiring', "we're hiring", 'we’re hiring', 'hiring now', 'hiring an engineer', 'hiring a developer',
  'job opening', 'open role', 'open roles', 'apply now', 'join our team',
];
const DISCOVERY_ADULT_SPAM_SIGNALS = [
  'adult content', '18+ only', 'nsfw', 'onlyfans', 'escort', 'porn', 'pornography',
  'sex video', 'videosex', 'groupsex', 'sexy18',
];

export const AUDIENCE_NICHE_GROUPS = [
  {
    tag: 'agents',
    label: 'AI & agents',
    weight: 18,
    discover: false,
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
      'solidity', 'smart contract', 'smart contracts', 'web3 developer', 'blockchain developer', 'protocol engineer',
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
    tag: 'engineering',
    label: 'Broader engineering & emerging tech',
    weight: 14,
    terms: [
      'engineering', 'engineer', 'hardware', 'computer hardware', 'semiconductor', 'semiconductors', 'chip', 'chips', 'chip design',
      'cpu', 'gpu', 'cuda', 'nvidia', 'amd', 'arm', 'risc-v', 'fpga', 'asic', 'electronics', 'electrical engineering',
      'robotics', 'robot', 'robots', 'autonomous systems', 'embedded', 'embedded engineering', 'firmware', 'iot', 'internet of things',
      'operating system', 'operating systems', 'kernel', 'compiler', 'compilers', 'runtime', 'distributed systems', 'networking',
      'network engineering', 'protocol', 'protocols', 'cybersecurity', 'security research', 'reverse engineering', 'cryptography',
      'computer vision', 'computer graphics', 'graphics programming', 'simulation', 'high performance computing', 'hpc',
      'mechanical engineering', 'aerospace', 'aerospace engineering', 'space technology', 'drone', 'drones', 'autonomous vehicle', 'autonomous vehicles',
      'battery technology', 'energy technology', 'clean tech', 'materials science', '3d printing', 'additive manufacturing',
      'biotechnology', 'bioengineering', 'medical device', 'medical devices', 'quantum computing', 'quantum computer',
    ],
  },
  {
    tag: 'jobs/career',
    label: 'Developer education & careers',
    weight: 12,
    discover: false,
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
    discover: false,
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
    discover: false,
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

const AUDIENCE_DEPRIORITY_SIGNALS = [
  'crypto', 'cryptocurrency', 'blockchain', 'web3', 'defi', 'nft', 'nfts', 'memecoin', 'memecoins', 'solana',
  'bitcoin', 'btc', 'eth', 'ethereum', 'on-chain', 'trader', 'trading', 'crypto-trader', 'forex', 'fx trader',
  'airdrop', 'pnl', 'pump.fun', 'dexscreener', 'tokenomics', 'degen', 'hodl', 'altcoin', 'altcoins',
  'bsc', 'bep20', 'decentralized', 'decentralised', 'metaverse',
];

const AUDIENCE_EXCLUSION_SIGNALS = [
  'adult content', '18+ only', 'nsfw', 'onlyfans', 'escort',
  'casino', 'gambling', 'sports betting', 'betting tips', 'slot online',
  'gain followers', 'follow for follow', 'f4f', 'like for like', 'engagement group', 'engagement pod',
  'retweet to win', 'comment to win', 'free money', 'horoscope', 'astrology',
];

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
}

function normalizeTag(value, fallback = '') {
  const normalized = String(value || fallback).trim().toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.slice(0, 64);
}

function cloneNicheGroup(group) {
  return {
    tag: group.tag,
    label: group.label,
    weight: group.weight,
    ...(group.role ? { role: group.role } : {}),
    ...(group.targetShare != null ? { targetShare: group.targetShare } : {}),
    ...(group.researchTier != null ? { researchTier: group.researchTier } : {}),
    ...(group.discover != null ? { discover: group.discover !== false } : {}),
    ...(group.requiresTechnicalContext ? { requiresTechnicalContext: true } : {}),
    terms: [...group.terms],
  };
}

function normalizeContentRole(value, fallback = 'core') {
  return ['core', 'adjacent', 'off'].includes(value) ? value : fallback;
}

function normalizeGrowthObjective(value) {
  return GROWTH_FOCUS_OBJECTIVES.includes(value) ? value : 'qualified_growth';
}

function normalizeTerms(values, fallback = []) {
  const source = Array.isArray(values) ? values : fallback;
  return [...new Set(source.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))].slice(0, 500);
}

function normalizeGroup(group, fallback = {}, { content = false } = {}) {
  const tag = normalizeTag(group?.tag, fallback.tag);
  if (!tag) return null;
  const label = String(group?.label || fallback.label || tag).trim().slice(0, 120) || tag;
  const normalized = {
    tag,
    label,
    weight: clampNumber(group?.weight, Number(fallback.weight || 12), 1, 50),
    ...(content ? { role: normalizeContentRole(group?.role, fallback.role || 'core') } : {}),
    ...(content ? { targetShare: clampNumber(group?.targetShare, Number(fallback.targetShare || 0), 0, 100) } : {}),
    ...(content ? { researchTier: Math.round(clampNumber(group?.researchTier, Number(fallback.researchTier || 2), 1, 3)) } : {}),
    discover: (group?.discover ?? fallback.discover) !== false,
    ...((group?.requiresTechnicalContext ?? fallback.requiresTechnicalContext) ? { requiresTechnicalContext: true } : {}),
    terms: normalizeTerms(group?.terms, fallback.terms || []),
  };
  return normalized;
}

function normalizeGroups(groups, fallbacks, { content = false, mergeLegacyDefaults = false } = {}) {
  const supplied = Array.isArray(groups) ? groups : [];
  const fallbackByTag = new Map((fallbacks || []).map((group) => [group.tag, group]));
  const source = mergeLegacyDefaults
    ? [
        ...(fallbacks || []).map((fallback) => ({ ...fallback, ...(supplied.find((group) => normalizeTag(group?.tag) === fallback.tag) || {}) })),
        ...supplied.filter((group) => !fallbackByTag.has(normalizeTag(group?.tag))),
      ]
    : supplied;
  const result = [];
  const seen = new Set();
  for (const group of source) {
    const requestedTag = normalizeTag(group?.tag);
    if (!requestedTag) throw new Error('Growth Focus groups require a non-empty tag.');
    const fallback = fallbackByTag.get(requestedTag) || {};
    const normalized = normalizeGroup(group, fallback, { content });
    if (!normalized) throw new Error(`Invalid Growth Focus group: ${requestedTag}.`);
    if (seen.has(normalized.tag)) throw new Error(`Duplicate Growth Focus tag: ${normalized.tag}.`);
    seen.add(normalized.tag);
    result.push(normalized);
  }
  return result.slice(0, 100);
}

export function getDefaultNicheProfile() {
  return {
    schemaVersion: GROWTH_FOCUS_PROFILE_VERSION,
    defaultObjective: 'qualified_growth',
    topicBalance: {
      windowSize: 30,
      strength: 0.25,
      maxAdjustment: 6,
    },
    exploration: {
      enabled: true,
      weight: 6,
      maxSearchQueries: 4,
    },
    discovery: {
      latestQueryBudget: 4,
      momentumQueryBudget: 4,
      rotationMinutes: 15,
    },
    contentGroups: NICHE_GROUPS.map(cloneNicheGroup),
    audienceGroups: AUDIENCE_NICHE_GROUPS.map(cloneNicheGroup),
    deprioritizedTerms: [...AUDIENCE_DEPRIORITY_SIGNALS],
    exclusionTerms: [...AUDIENCE_EXCLUSION_SIGNALS],
  };
}

let ACTIVE_NICHE_PROFILE = getDefaultNicheProfile();

export function setActiveNicheProfile(profile = {}) {
  const defaults = getDefaultNicheProfile();
  const schemaVersion = Number(profile.schemaVersion || 0);
  const legacyFixedGroups = schemaVersion < 2;
  const contentGroups = normalizeGroups(profile.contentGroups, defaults.contentGroups, {
    content: true,
    mergeLegacyDefaults: legacyFixedGroups,
  });
  const audienceGroups = normalizeGroups(profile.audienceGroups, defaults.audienceGroups, {
    mergeLegacyDefaults: legacyFixedGroups,
  });
  ACTIVE_NICHE_PROFILE = {
    schemaVersion: GROWTH_FOCUS_PROFILE_VERSION,
    defaultObjective: normalizeGrowthObjective(profile.defaultObjective),
    topicBalance: {
      windowSize: Math.round(clampNumber(profile.topicBalance?.windowSize, defaults.topicBalance.windowSize, 10, 100)),
      strength: clampNumber(profile.topicBalance?.strength, defaults.topicBalance.strength, 0, 1),
      maxAdjustment: Math.round(clampNumber(profile.topicBalance?.maxAdjustment, defaults.topicBalance.maxAdjustment, 0, 20)),
    },
    exploration: {
      enabled: profile.exploration?.enabled !== false,
      weight: clampNumber(profile.exploration?.weight, defaults.exploration.weight, 0, 50),
      maxSearchQueries: Math.round(clampNumber(profile.exploration?.maxSearchQueries, defaults.exploration.maxSearchQueries, 0, 20)),
    },
    discovery: {
      latestQueryBudget: Math.round(clampNumber(profile.discovery?.latestQueryBudget, defaults.discovery.latestQueryBudget, 1, 30)),
      momentumQueryBudget: Math.round(clampNumber(profile.discovery?.momentumQueryBudget, defaults.discovery.momentumQueryBudget, 1, 30)),
      rotationMinutes: Math.round(clampNumber(profile.discovery?.rotationMinutes, defaults.discovery.rotationMinutes, 1, 120)),
    },
    contentGroups: legacyFixedGroups && !Array.isArray(profile.contentGroups) ? defaults.contentGroups.map(cloneNicheGroup) : contentGroups,
    audienceGroups: legacyFixedGroups && !Array.isArray(profile.audienceGroups) ? defaults.audienceGroups.map(cloneNicheGroup) : audienceGroups,
    deprioritizedTerms: normalizeTerms(profile.deprioritizedTerms, defaults.deprioritizedTerms),
    exclusionTerms: normalizeTerms(profile.exclusionTerms, defaults.exclusionTerms),
  };
  AUDIENCE_PROFILE_CLASSIFICATION_CACHE.clear();
  return getActiveNicheProfile();
}

export function getActiveNicheProfile() {
  return {
    schemaVersion: ACTIVE_NICHE_PROFILE.schemaVersion,
    defaultObjective: ACTIVE_NICHE_PROFILE.defaultObjective,
    topicBalance: { ...ACTIVE_NICHE_PROFILE.topicBalance },
    exploration: { ...ACTIVE_NICHE_PROFILE.exploration },
    discovery: { ...ACTIVE_NICHE_PROFILE.discovery },
    contentGroups: ACTIVE_NICHE_PROFILE.contentGroups.map(cloneNicheGroup),
    audienceGroups: ACTIVE_NICHE_PROFILE.audienceGroups.map(cloneNicheGroup),
    deprioritizedTerms: [...ACTIVE_NICHE_PROFILE.deprioritizedTerms],
    exclusionTerms: [...ACTIVE_NICHE_PROFILE.exclusionTerms],
  };
}

export function getNicheLabels() {
  return Object.fromEntries(ACTIVE_NICHE_PROFILE.contentGroups.map(({ tag, label }) => [tag, label]));
}

export function getAudienceNicheLabels() {
  return Object.fromEntries(ACTIVE_NICHE_PROFILE.audienceGroups.map(({ tag, label }) => [tag, label]));
}

export function getActiveContentGroups({ includeOff = false } = {}) {
  return ACTIVE_NICHE_PROFILE.contentGroups
    .filter((group) => includeOff || group.role !== 'off')
    .map(cloneNicheGroup);
}

function quoteXSearchTerm(term) {
  const text = String(term || '').trim().replaceAll('"', '');
  if (!text) return '';
  return /^[a-z0-9_@.#/+:-]+$/i.test(text) ? text : `"${text}"`;
}

function chunkXSearchTerms(terms, maxLength = 360) {
  const chunks = [];
  let current = '';
  for (const term of terms.map(quoteXSearchTerm).filter(Boolean)) {
    const next = current ? `${current} OR ${term}` : term;
    if (current && next.length > maxLength) {
      chunks.push(current);
      current = term;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function roundRobinGroupTerms(groups) {
  const output = [];
  const seen = new Set();
  const maxTerms = Math.max(0, ...groups.map((group) => group.terms.length));
  for (let index = 0; index < maxTerms; index++) {
    for (const group of groups) {
      const term = String(group.terms[index] || '').trim().toLowerCase();
      if (!term || seen.has(term)) continue;
      seen.add(term);
      output.push(term);
    }
  }
  return output;
}

export function getXSearchQueryGroups() {
  const groups = [];
  const activeContentGroups = getActiveContentGroups();
  for (const group of activeContentGroups.filter((item) => item.discover !== false)) {
    chunkXSearchTerms(group.terms).forEach((query, index) => groups.push({
      tag: group.tag,
      label: group.label,
      targetShare: Number(group.targetShare || 0),
      query,
      chunk: index,
      exploratory: false,
    }));
  }

  if (ACTIVE_NICHE_PROFILE.exploration.enabled && ACTIVE_NICHE_PROFILE.exploration.maxSearchQueries > 0) {
    const preferredTerms = new Set(activeContentGroups.flatMap((group) => group.terms.map((term) => String(term).trim().toLowerCase())));
    const explorationTerms = roundRobinGroupTerms(ACTIVE_NICHE_PROFILE.audienceGroups.filter((group) => group.discover !== false))
      .filter((term) => !preferredTerms.has(term));
    chunkXSearchTerms(explorationTerms)
      .slice(0, ACTIVE_NICHE_PROFILE.exploration.maxSearchQueries)
      .forEach((query, index) => groups.push({
        tag: '__explore__',
        label: 'Tech exploration',
        targetShare: 0,
        query,
        chunk: index,
        exploratory: true,
      }));
  }
  return groups;
}

const AUDIENCE_PROFILE_CLASSIFICATION_CACHE = new Map();

const TERM_PATTERNS = new Map();

function containsTerm(haystack, term) {
  let pattern = TERM_PATTERNS.get(term);
  if (!pattern) {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    TERM_PATTERNS.set(term, pattern);
  }
  return pattern.test(haystack);
}

export function assessDiscoveryQuality(text) {
  const haystack = String(text || '').toLowerCase();
  const cryptoMatches = DISCOVERY_CRYPTO_SIGNALS.filter((term) => containsTerm(haystack, term));
  const cryptoPromotionMatches = DISCOVERY_CRYPTO_PROMOTION_SIGNALS.filter((term) => containsTerm(haystack, term));
  const tokenTicker = String(text || '').match(/\$[a-z][a-z0-9]{1,9}\b/i)?.[0] || null;
  const jobAdMatches = DISCOVERY_JOB_AD_SIGNALS.filter((term) => containsTerm(haystack, term));
  const adultSpamMatches = DISCOVERY_ADULT_SPAM_SIGNALS.filter((term) => containsTerm(haystack, term));
  const reasonCodes = [];
  if (cryptoMatches.length && (cryptoPromotionMatches.length || tokenTicker)) reasonCodes.push('CRYPTO_PROMOTION');
  if (jobAdMatches.length) reasonCodes.push('JOB_AD');
  if (adultSpamMatches.length) reasonCodes.push('ADULT_SPAM');
  return {
    allowed: reasonCodes.length === 0,
    reasonCodes,
    matches: [...new Set([...cryptoMatches, ...cryptoPromotionMatches, ...jobAdMatches, ...adultSpamMatches, ...(tokenTicker ? [tokenTicker] : [])])],
    explanation: reasonCodes.length
      ? `Discovery filter excluded ${reasonCodes.join(', ').toLowerCase().replaceAll('_', ' ')} content from the growth opportunity set.`
      : 'No hard discovery-quality exclusion matched.',
  };
}

export function classifyNiche(text) {
  const sourceText = String(text || '').replace(/https?:\/\/\S+/gi, ' ');
  const haystack = sourceText.toLowerCase().replace(/([a-z])(?=\d)/g, '$1 ');
  const ambiguousTerms = new Set(['python', 'pip', 'bun']);
  const genericTechnicalContext = /\b(?:code|coding|developer|programming|package|library|framework|runtime|compiler|script|benchmark|performance|install|dependency|api|cli|typescript|javascript|node|npm|pnpm|github|repo|server)\b/i.test(sourceText);
  const hasUnambiguousTerm = ACTIVE_NICHE_PROFILE.contentGroups.some((group) =>
    group.terms.some((term) => !ambiguousTerms.has(term) && containsTerm(haystack, term)));
  const termMatches = (term) => {
    if (!containsTerm(haystack, term)) return false;
    if (term === 'pip') return /\bpip\b/.test(sourceText) || genericTechnicalContext || hasUnambiguousTerm;
    if (term === 'python') return /\bPython(?:\s+\d+(?:\.\d+)*|\s+(?:release|released|devs?|developers?|package|library|code|programming|runtime|compiler|performance|benchmark))\b/.test(sourceText) || genericTechnicalContext || hasUnambiguousTerm;
    if (term === 'bun') return /\bBun\b/.test(sourceText) || genericTechnicalContext || hasUnambiguousTerm;
    return true;
  };
  const audienceMatches = ACTIVE_NICHE_PROFILE.exploration.enabled
    ? ACTIVE_NICHE_PROFILE.audienceGroups.map((group) => ({
        group,
        matchedTerms: group.terms.filter(termMatches),
      })).filter(({ matchedTerms }) => matchedTerms.length)
    : [];
  const groupMatches = ACTIVE_NICHE_PROFILE.contentGroups.map((group) => ({
    group,
    matchedTerms: group.terms.filter(termMatches),
  }));
  const hasTechnicalContext = audienceMatches.length > 0
    || groupMatches.some(({ group, matchedTerms }) => !group.requiresTechnicalContext && matchedTerms.length > 0);
  const tags = [];
  const matches = [];
  let score = 0;

  for (const { group, matchedTerms } of groupMatches) {
    if (!matchedTerms.length) continue;
    if (group.requiresTechnicalContext && !hasTechnicalContext) continue;
    tags.push(group.tag);
    matches.push(...matchedTerms);
    if (group.role !== 'off') score += group.weight;
  }

  const explorationTags = [...new Set(audienceMatches.map(({ group }) => group.tag))];
  const explorationMatches = [...new Set(audienceMatches.flatMap(({ matchedTerms }) => matchedTerms))];
  const groupsByTag = new Map(ACTIVE_NICHE_PROFILE.contentGroups.map((group) => [group.tag, group]));
  const registered = tags.some((tag) => ['core', 'adjacent'].includes(groupsByTag.get(tag)?.role));
  const exploratory = ACTIVE_NICHE_PROFILE.exploration.enabled && !registered && explorationMatches.length > 0;
  if (exploratory) score = Math.max(score, ACTIVE_NICHE_PROFILE.exploration.weight);

  return {
    score: Math.min(50, score),
    tags,
    matches: [...new Set(matches)],
    exploratory,
    explorationTags,
    explorationMatches,
  };
}

function candidateClassificationText(candidate = {}) {
  const source = String(candidate.source || '').toLowerCase();
  const title = String(candidate.title || '').trim();
  const text = String(candidate.text || '').trim();
  if (source === 'x') return text;
  const parts = title && title !== text ? [title, text] : [text || title];
  if (source === 'editorial') {
    const sourceText = String(candidate.metrics?.editorialSourceText || '').trim();
    if (sourceText) parts.push(sourceText);
  }
  return parts.filter(Boolean).join(' ');
}

export function classifyCandidateForGrowth(candidate = {}, { profileRevision = null, classifiedAt = Date.now() } = {}) {
  return {
    ...candidate,
    niche: {
      ...classifyNiche(candidateClassificationText(candidate)),
      profileRevision: profileRevision == null ? null : Number(profileRevision),
      classifierVersion: CANDIDATE_CLASSIFIER_VERSION,
      classifiedAt: Number(classifiedAt),
    },
  };
}

export function assessStrategicRelevance(candidate = {}, { objective, humanOverride = null } = {}) {
  const niche = candidate?.niche || {};
  const selectedObjective = normalizeGrowthObjective(objective || ACTIVE_NICHE_PROFILE.defaultObjective);
  const profileRevision = niche.profileRevision == null ? null : Number(niche.profileRevision);
  const classifierVersion = niche.classifierVersion == null ? null : Number(niche.classifierVersion);
  const current = niche.status === 'current' && niche.score != null;
  const validOverride = humanOverride?.accepted === true
    && humanOverride?.actor === 'human'
    && Boolean(String(humanOverride?.reason || '').trim())
    && Number(humanOverride?.profileRevision) === profileRevision
    && Number(humanOverride?.classifierVersion) === classifierVersion;

  if (!current) {
    return {
      state: 'unknown',
      allowed: false,
      topicScore: null,
      tags: [],
      objective: selectedObjective,
      reasonCodes: ['CLASSIFICATION_NOT_CURRENT'],
      explanation: 'Growth fit needs a current candidate classification. Rescore candidates before making a focus decision.',
      profileRevision,
      classifierVersion,
      humanOverride: null,
    };
  }

  const groups = new Map(ACTIVE_NICHE_PROFILE.contentGroups.map((group) => [group.tag, group]));
  const tags = [...new Set(niche.tags || [])];
  const coreTags = tags.filter((tag) => groups.get(tag)?.role === 'core');
  const adjacentTags = tags.filter((tag) => groups.get(tag)?.role === 'adjacent');
  const offTags = tags.filter((tag) => groups.get(tag)?.role === 'off');
  const exploratory = niche.exploratory === true;
  const state = offTags.length ? 'outside' : coreTags.length ? 'core' : adjacentTags.length ? 'adjacent' : exploratory ? 'exploratory' : 'outside';
  const reasonCodes = state === 'core'
    ? ['CORE_GROUP_MATCH']
    : state === 'adjacent'
      ? ['ADJACENT_GROUP_MATCH']
      : state === 'exploratory'
        ? ['TECH_EXPLORATION_MATCH']
        : offTags.length ? ['OFF_GROUP_MATCH'] : ['OUTSIDE_TECH_SCOPE'];
  const labels = (values) => values.map((tag) => groups.get(tag)?.label || tag).join(', ');
  let explanation = state === 'core'
    ? `Matches preferred Growth Focus groups: ${labels(coreTags)}.`
    : state === 'adjacent'
      ? `Matches adjacent Growth Focus groups: ${labels(adjacentTags)}.${coreTags.length ? ` Supporting preferred signals: ${labels(coreTags)}.` : ''}`
      : state === 'exploratory'
        ? `No registered content niche matched, but the candidate is inside the configured broader technical audience scope (${(niche.explorationMatches || []).slice(0, 6).join(', ')}). It may compete on momentum without being promoted into a permanent niche.`
        : offTags.length
          ? `Matches a Growth Focus group currently set to Off: ${labels(offTags)}.`
          : 'The current classifier found no registered niche or broader configured technical-scope match.';
  const acceptedOverride = validOverride ? {
    accepted: true,
    reason: String(humanOverride.reason).trim(),
    actor: 'human',
    at: Number(humanOverride.at || 0) || null,
    profileRevision,
    classifierVersion,
  } : null;
  if (state === 'outside' && acceptedOverride) {
    explanation += ` Human decision: use anyway — ${acceptedOverride.reason}`;
    reasonCodes.push('HUMAN_USE_ANYWAY');
  }

  return {
    state,
    allowed: state === 'core' || state === 'adjacent' || state === 'exploratory' || Boolean(acceptedOverride),
    topicScore: Number(niche.score),
    tags,
    explorationTags: [...new Set(niche.explorationTags || [])],
    explorationMatches: [...new Set(niche.explorationMatches || [])],
    objective: selectedObjective,
    reasonCodes,
    explanation,
    profileRevision,
    classifierVersion,
    humanOverride: acceptedOverride,
  };
}

export function classifyAudienceProfile(profile) {
  const username = String(profile?.username || '').replace(/^@/, '');
  const displayName = String(profile?.displayName || username);
  const bio = String(profile?.bio || '');
  const cacheKey = `${username}\u0000${displayName}\u0000${bio}`;
  const cached = AUDIENCE_PROFILE_CLASSIFICATION_CACHE.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      nicheTags: [...cached.nicheTags],
      matchedKeywords: [...cached.matchedKeywords],
      negativeMatches: [...cached.negativeMatches],
      deprioritizationMatches: [...cached.deprioritizationMatches],
      exclusionMatches: [...cached.exclusionMatches],
    };
  }
  const combined = `${username} ${displayName} ${bio}`;
  const expanded = combined
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[#@_.:/\\-]+/g, ' ');

  const profileMatches = (terms) => terms.filter((term) =>
    containsTerm(combined, term) || containsTerm(expanded, term),
  );
  const tags = [];
  const matches = [];
  let score = 0;

  for (const group of ACTIVE_NICHE_PROFILE.audienceGroups) {
    const groupMatches = profileMatches(group.terms);
    if (groupMatches.length) {
      tags.push(group.tag);
      matches.push(...groupMatches);
      score += group.weight;
    }
  }

  const contentNiche = classifyNiche(`${displayName} ${bio}`);
  const uniqueMatches = [...new Set(matches)];
  const deprioritizationMatches = profileMatches(ACTIVE_NICHE_PROFILE.deprioritizedTerms);
  const exclusionMatches = profileMatches(ACTIVE_NICHE_PROFILE.exclusionTerms);
  const negativeMatches = [...new Set([...deprioritizationMatches, ...exclusionMatches])];
  const hasDeveloperContext = Boolean(contentNiche.tags?.length);
  let relevanceScore = 0;
  let fitBucket = 'uncertain';

  if (exclusionMatches.length) {
    fitBucket = 'outside_niche';
  } else if (uniqueMatches.length && (!deprioritizationMatches.length || hasDeveloperContext)) {
    relevanceScore = Math.min(50, Math.max(12, score));
    if (deprioritizationMatches.length && relevanceScore > 12) {
      relevanceScore = Math.max(12, relevanceScore - 6);
    }
    fitBucket = 'in_niche';
  } else if (deprioritizationMatches.length && !uniqueMatches.length) {
    fitBucket = 'outside_niche';
  }

  const result = {
    username,
    displayName,
    bio,
    relevanceScore,
    nicheTags: tags,
    matchedKeywords: uniqueMatches,
    negativeMatches,
    deprioritizationMatches,
    exclusionMatches,
    fitBucket,
  };
  AUDIENCE_PROFILE_CLASSIFICATION_CACHE.set(cacheKey, result);
  return {
    ...result,
    nicheTags: [...result.nicheTags],
    matchedKeywords: [...result.matchedKeywords],
    negativeMatches: [...result.negativeMatches],
    deprioritizationMatches: [...result.deprioritizationMatches],
    exclusionMatches: [...result.exclusionMatches],
  };
}

export function personalizeCandidates(candidates = [], preference = {}) {
  const savedCount = Number(preference.savedCount || 0);
  if (!savedCount) return candidates;

  return candidates.map((candidate) => {
    const tagHits = (candidate.niche?.tags || []).reduce((sum, tag) => sum + Number(preference.tags?.[tag] || 0), 0);
    const keywordHits = (candidate.niche?.matches || []).reduce((sum, keyword) => sum + Number(preference.keywords?.[keyword] || 0), 0);
    const boost = Math.min(10, Math.round((tagHits * 5 + keywordHits * 2) / savedCount));
    return boost ? { ...candidate, score: Math.min(100, Number(candidate.score || 0) + boost) } : candidate;
  }).sort((a, b) => b.score - a.score);
}

export function isOpportunityCandidate(candidate) {
  if (candidate?.niche?.status !== 'current') return false;
  const groups = new Map(ACTIVE_NICHE_PROFILE.contentGroups.map((group) => [group.tag, group]));
  return (candidate.niche.tags || []).some((tag) => groups.get(tag)?.role === 'adjacent');
}

export function recommendDistributionAction(candidate, context = {}) {
  if (context.alreadyUsed) {
    return { action: 'ignore', reason: 'Already used for distribution.' };
  }
  const growthFit = context.strategicRelevance || assessStrategicRelevance(candidate, {
    objective: context.objective,
    humanOverride: context.relevanceOverride,
  });
  if (growthFit.state === 'unknown') {
    return { action: 'ignore', reason: 'Growth fit is unknown until the candidate classification is refreshed.' };
  }
  if (!growthFit.allowed) {
    return { action: 'ignore', reason: 'Outside the configured technical scope. A human can explicitly choose to use the opportunity anyway.' };
  }

  const behavior = normalizeBehaviorDecision(context.behavior || {}, {
    pipeline: context.pipeline || '',
    defaultSelectionSource: 'legacy',
  });
  const purposeful = behavior.decision === 'ACT'
    && Boolean(behavior.primaryPurpose)
    && Boolean(behavior.reasonToExist);
  const sourceIsX = candidate?.source === 'x';
  const preferredPipeline = String(context.preferredPipeline || behavior.pipeline || '').trim();
  const socialReplyPurposes = new Set(['relationship', 'support', 'celebration', 'humor', 'learning', 'correction', 'de_escalation', 'social_presence']);
  const profilePurposes = new Set(['profile_proof', 'taste', 'judgment', 'technical_value']);

  if (purposeful) {
    if (preferredPipeline === 'original' || preferredPipeline === 'thread') {
      return { action: 'direct', reason: `Selected ${behavior.primaryPurpose} behavior belongs on the owned profile surface.` };
    }
    if (sourceIsX && preferredPipeline === 'reply') {
      return { action: 'reply', reason: `Selected ${behavior.primaryPurpose} behavior belongs inside the current conversation.` };
    }
    if (sourceIsX && preferredPipeline === 'quote') {
      return { action: 'quote', reason: `Selected ${behavior.primaryPurpose} behavior should keep the source visible on Hamza's main profile.` };
    }
    if (sourceIsX && preferredPipeline === 'repost') {
      return { action: 'repost', reason: `Selected ${behavior.primaryPurpose} behavior is amplification-only; no commentary is being forced.` };
    }
    if (context.originalStandalone || context.ourExperiment || context.multipleSources || profilePurposes.has(behavior.primaryPurpose) && !sourceIsX) {
      return { action: 'direct', reason: `The selected ${behavior.primaryPurpose} behavior stands on its own and should build owned account identity.` };
    }
    if (sourceIsX && socialReplyPurposes.has(behavior.primaryPurpose)) {
      return { action: 'reply', reason: `The selected ${behavior.primaryPurpose} behavior is a purposeful conversation act.` };
    }
    if (sourceIsX && ['taste', 'judgment', 'profile_proof', 'discovery', 'technical_value'].includes(behavior.primaryPurpose)) {
      return { action: 'quote', reason: `The selected ${behavior.primaryPurpose} behavior benefits from visible source context on the profile.` };
    }
  }

  // Compatibility path for candidates created before behavior decisions existed.
  if (context.originalStandalone || context.ourExperiment || context.multipleSources) {
    return { action: 'direct', reason: 'Legacy context says the object stands on its own; select and persist a behavior before writing.' };
  }
  if (context.canAddReplyValue && context.relationshipValue) {
    return { action: 'reply', reason: 'Legacy context identifies a purposeful conversation opportunity; select and persist its behavior before writing.' };
  }
  if (sourceIsX && context.addsMaterialValue && context.sourceIsEvidence) {
    return { action: 'quote', reason: 'Legacy context identifies a source-bearing profile action; select and persist its behavior before writing.' };
  }
  if (sourceIsX && context.amplificationOnly && Number(candidate?.viral?.score || candidate?.score || 0) >= 70) {
    return { action: 'repost', reason: 'The source is unusually useful and amplification is the selected purpose; no commentary is being forced.' };
  }

  return { action: 'ignore', reason: 'No purposeful technical, social, relationship, identity, learning, or growth action has been established.' };
}
