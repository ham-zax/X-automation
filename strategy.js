export const NICHE_GROUPS = [
  {
    tag: 'agents',
    label: 'AI coding & agents',
    weight: 18,
    terms: ['coding agent', 'claude code', 'codex', 'cursor', 'opencode', 'mcp', 'agentic', 'developer agent', 'ai pair programmer', 'vibe coding'],
  },
  {
    tag: 'models',
    label: 'Models & inference',
    weight: 16,
    terms: ['llm', 'ai model', 'open source model', 'qwen', 'deepseek', 'glm', 'llama', 'inference', 'context window', 'quantization', 'fine-tuning', 'ollama', 'vllm'],
  },
  {
    tag: 'devtools',
    label: 'Developer tools',
    weight: 16,
    terms: ['developer tool', 'devtools', 'developer experience', 'sdk', 'cli', 'github', 'vercel', 'supabase', 'open source', 'typescript', 'node.js', 'python', 'ide'],
  },
  {
    tag: 'infra',
    label: 'Infra & architecture',
    weight: 14,
    terms: ['docker', 'kubernetes', 'ci/cd', 'serverless', 'mlops', 'latency', 'api design', 'database', 'postgres', 'vector db', 'cloud cost', 'observability', 'sandbox', 'webassembly', 'webgpu'],
  },
  {
    tag: 'jobs/career',
    label: 'Jobs & career',
    weight: 12,
    requiresTechnicalContext: true,
    terms: ['software engineer job', 'developer job', 'ai engineer', 'hiring developers', 'engineering jobs', 'internship', 'job search', 'developer career', 'engineering career', 'technical interview', 'remote job'],
  },
  {
    tag: 'builders',
    label: 'Builders & SaaS',
    weight: 12,
    requiresTechnicalContext: true,
    terms: ['indie hacker', 'developer founder', 'ai saas', 'micro-saas', 'build in public', 'shipping', 'launched', 'product launch', 'technical founder'],
  },
  {
    tag: 'business',
    label: 'Business & productization',
    weight: 10,
    requiresTechnicalContext: true,
    terms: ['pricing', 'revenue', 'customers', 'distribution', 'sales', 'consulting', 'productized service', 'api monetization', 'developer marketing', 'sponsorship'],
  },
];

export const NICHE_LABELS = Object.fromEntries(NICHE_GROUPS.map(({ tag, label }) => [tag, label]));
export const CANDIDATE_CLASSIFIER_VERSION = 1;
export const GROWTH_FOCUS_OBJECTIVES = Object.freeze([
  'qualified_growth',
  'reach_momentum',
  'relationships',
  'technical_authority',
  'balanced',
]);

const DEFAULT_CONTENT_ROLES = Object.freeze({
  agents: 'core',
  models: 'core',
  devtools: 'core',
  infra: 'core',
  'jobs/career': 'adjacent',
  builders: 'adjacent',
  business: 'adjacent',
});

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

function cloneNicheGroup(group) {
  return {
    tag: group.tag,
    label: group.label,
    weight: group.weight,
    ...(group.role ? { role: group.role } : {}),
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

function normalizeTerms(values, fallback) {
  if (!Array.isArray(values)) return [...fallback];
  return [...new Set(values.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))].slice(0, 500);
}

export function getDefaultNicheProfile() {
  return {
    defaultObjective: 'qualified_growth',
    contentGroups: NICHE_GROUPS.map((group) => ({
      ...cloneNicheGroup(group),
      role: DEFAULT_CONTENT_ROLES[group.tag] || 'core',
    })),
    audienceGroups: AUDIENCE_NICHE_GROUPS.map(cloneNicheGroup),
    deprioritizedTerms: [...AUDIENCE_DEPRIORITY_SIGNALS],
    exclusionTerms: [...AUDIENCE_EXCLUSION_SIGNALS],
  };
}

let ACTIVE_NICHE_PROFILE = getDefaultNicheProfile();

export function setActiveNicheProfile(profile = {}) {
  const defaults = getDefaultNicheProfile();
  const suppliedContent = new Map((profile.contentGroups || []).map((group) => [String(group?.tag || ''), group]));
  const suppliedAudience = new Map((profile.audienceGroups || []).map((group) => [String(group?.tag || ''), group]));
  ACTIVE_NICHE_PROFILE = {
    defaultObjective: normalizeGrowthObjective(profile.defaultObjective),
    contentGroups: defaults.contentGroups.map((group) => ({
      ...group,
      role: normalizeContentRole(suppliedContent.get(group.tag)?.role, group.role),
      terms: normalizeTerms(suppliedContent.get(group.tag)?.terms, group.terms),
    })),
    audienceGroups: defaults.audienceGroups.map((group) => ({
      ...group,
      terms: normalizeTerms(suppliedAudience.get(group.tag)?.terms, group.terms),
    })),
    deprioritizedTerms: normalizeTerms(profile.deprioritizedTerms, defaults.deprioritizedTerms),
    exclusionTerms: normalizeTerms(profile.exclusionTerms, defaults.exclusionTerms),
  };
  AUDIENCE_PROFILE_CLASSIFICATION_CACHE.clear();
  return getActiveNicheProfile();
}

export function getActiveNicheProfile() {
  return {
    defaultObjective: ACTIVE_NICHE_PROFILE.defaultObjective,
    contentGroups: ACTIVE_NICHE_PROFILE.contentGroups.map(cloneNicheGroup),
    audienceGroups: ACTIVE_NICHE_PROFILE.audienceGroups.map(cloneNicheGroup),
    deprioritizedTerms: [...ACTIVE_NICHE_PROFILE.deprioritizedTerms],
    exclusionTerms: [...ACTIVE_NICHE_PROFILE.exclusionTerms],
  };
}

const AUDIENCE_PROFILE_CLASSIFICATION_CACHE = new Map();

const TECHNICAL_ANCHORS = [
  'developer', 'software', 'engineer', 'engineering', 'coding', 'code', 'programming',
  'ai', 'llm', 'agent', 'model', 'api', 'sdk', 'cli', 'github', 'open source', 'saas',
  'typescript', 'javascript', 'python', 'node', 'cloud', 'database', 'infra', 'devops',
];

export const X_DISCOVERY_QUERIES = [
  '"Claude Code" OR Codex OR Cursor OR OpenCode OR MCP OR "coding agent" OR "vibe coding"',
  'Qwen OR DeepSeek OR GLM OR Llama OR "open source model" OR inference OR Ollama OR vLLM',
  '"developer tools" OR devtools OR GitHub OR Vercel OR Supabase OR "open source" OR SDK OR CLI',
  'Docker OR Kubernetes OR serverless OR MLOps OR WebGPU OR WebAssembly OR Postgres OR "API design"',
  '"AI engineer" OR "software engineer job" OR "developer job" OR "engineering career" OR "technical interview"',
  '"AI SaaS" OR "indie hacker" OR "developer founder" OR "build in public" OR "technical founder"',
];

export const X_VIRAL_QUERIES = [
  '"Claude Code" OR Codex OR Cursor OR OpenCode OR MCP OR Qwen OR DeepSeek OR GLM',
  '"developer tools" OR devtools OR "software engineering" OR GitHub OR Vercel OR Supabase OR "open source"',
  'Docker OR Kubernetes OR serverless OR MLOps OR WebGPU OR WebAssembly OR Postgres OR "AI infrastructure"',
  '"AI engineer" OR "software engineer" OR "developer job" OR "tech jobs" OR "developer career" OR internship',
  '"AI startup" OR "AI SaaS" OR "indie hacker" OR "build in public" OR "developer founder" OR "developer productivity" OR "vibe coding"',
];

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

export function classifyNiche(text) {
  const haystack = String(text || '').toLowerCase();
  const hasTechnicalContext = TECHNICAL_ANCHORS.some((term) => containsTerm(haystack, term));
  const tags = [];
  const matches = [];
  let score = 0;

  for (const group of ACTIVE_NICHE_PROFILE.contentGroups) {
    const matchedTerms = group.terms.filter((term) => containsTerm(haystack, term));
    if (!matchedTerms.length) continue;
    if (group.requiresTechnicalContext && !hasTechnicalContext) continue;
    tags.push(group.tag);
    matches.push(...matchedTerms);
    score += group.weight;
  }

  return {
    score: Math.min(50, score),
    tags,
    matches: [...new Set(matches)],
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
  const state = offTags.length ? 'outside' : adjacentTags.length ? 'adjacent' : coreTags.length ? 'core' : 'outside';
  const reasonCodes = state === 'core'
    ? ['CORE_GROUP_MATCH']
    : state === 'adjacent'
      ? ['ADJACENT_GROUP_MATCH']
      : offTags.length ? ['OFF_GROUP_MATCH'] : ['NO_ACTIVE_GROUP_MATCH'];
  const labels = (values) => values.map((tag) => groups.get(tag)?.label || tag).join(', ');
  let explanation = state === 'core'
    ? `Matches core Growth Focus groups: ${labels(coreTags)}.`
    : state === 'adjacent'
      ? `Matches adjacent Growth Focus groups: ${labels(adjacentTags)}.${coreTags.length ? ` Supporting core signals: ${labels(coreTags)}.` : ''}`
      : offTags.length
        ? `Matches a Growth Focus group currently set to Off: ${labels(offTags)}.`
        : 'The current classifier found no topic group configured as Core or Adjacent.';
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
    allowed: state === 'core' || state === 'adjacent' || Boolean(acceptedOverride),
    topicScore: Number(niche.score),
    tags,
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
  for (const tag of contentNiche.tags || []) {
    if (!tags.includes(tag)) tags.push(tag);
  }
  matches.push(...(contentNiche.matches || []));
  score = Math.max(score, contentNiche.score || 0);

  const uniqueMatches = [...new Set(matches)];
  const deprioritizationMatches = profileMatches(ACTIVE_NICHE_PROFILE.deprioritizedTerms);
  const exclusionMatches = profileMatches(ACTIVE_NICHE_PROFILE.exclusionTerms);
  const negativeMatches = [...new Set([...deprioritizationMatches, ...exclusionMatches])];
  const hasDeveloperContext = Boolean(contentNiche.tags?.length)
    || tags.some((tag) => ['devtools', 'software', 'infra'].includes(tag));
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
  const tags = candidate.niche.tags || [];
  return tags.some((tag) => ['jobs/career', 'builders', 'business'].includes(tag));
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
    return { action: 'ignore', reason: 'Outside current Growth Focus. A human can explicitly choose to use the opportunity anyway.' };
  }

  const accountFollowers = context.accountFollowers == null ? null : Number(context.accountFollowers);
  const first1000 = accountFollowers != null && Number.isFinite(accountFollowers) && accountFollowers >= 0 && accountFollowers < 1_000;
  const opportunityScores = context.opportunityScores || {};
  const reach = opportunityScores.breakdown?.reach || {};
  const bootstrapFresh = first1000 && candidate?.source === 'x' && Number(reach.freshness || 0) >= 10;
  const bootstrapMomentum = bootstrapFresh
    && Number(opportunityScores.reachPotential || 0) >= 50
    && Number(reach.freshness || 0) >= 10
    && Number(reach.momentum || 0) >= 10
    && Number(reach.traction || 0) >= 8;

  if (context.originalStandalone || context.ourExperiment || context.multipleSources) {
    return { action: 'direct', reason: 'The insight stands on its own and should build our own author identity.' };
  }

  if (context.canAddReplyValue && (context.relationshipValue || first1000)) {
    return {
      action: 'reply',
      reason: first1000
        ? 'First 1,000 mode: a useful contribution can enter this active relevant conversation without requiring prior relationship history.'
        : 'A specific useful contribution can start or deepen a relevant relationship.',
    };
  }

  if (candidate?.source === 'x' && context.addsMaterialValue && (context.sourceIsEvidence || bootstrapFresh)) {
    return {
      action: 'quote',
      reason: bootstrapFresh && !context.sourceIsEvidence
        ? 'First 1,000 mode: a distinct concise contribution is enough to quote a relevant source while it is current.'
        : 'The source is useful evidence and our commentary creates a new information object.',
    };
  }

  if (candidate?.source === 'x' && context.amplificationOnly && Number(candidate?.viral?.score || candidate?.score || 0) >= 70) {
    return { action: 'repost', reason: 'The source is unusually useful and amplification is the point; no commentary is being forced.' };
  }

  if (bootstrapMomentum) {
    return { action: 'repost', reason: 'First 1,000 mode: this fresh, high-momentum niche source is worth amplifying while the distribution window is open.' };
  }

  return { action: 'ignore', reason: 'No sufficiently additive distribution action yet; research it or wait for a stronger angle.' };
}
