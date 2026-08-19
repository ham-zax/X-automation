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

function containsTerm(haystack, term) {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
}

export function classifyNiche(text) {
  const haystack = String(text || '').toLowerCase();
  const hasTechnicalContext = TECHNICAL_ANCHORS.some((term) => containsTerm(haystack, term));
  const tags = [];
  const matches = [];
  let score = 0;

  for (const group of NICHE_GROUPS) {
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
  const tags = candidate?.niche?.tags || [];
  return tags.some((tag) => ['jobs/career', 'builders', 'business'].includes(tag));
}

export function recommendDistributionAction(candidate, context = {}) {
  const nicheScore = Number(candidate?.niche?.score || 0);
  if (context.alreadyUsed || nicheScore < 12) {
    return { action: 'ignore', reason: context.alreadyUsed ? 'Already used for distribution.' : 'Weak niche fit.' };
  }

  if (context.originalStandalone || context.ourExperiment || context.multipleSources) {
    return { action: 'direct', reason: 'The insight stands on its own and should build our own author identity.' };
  }

  if (context.canAddReplyValue && context.relationshipValue) {
    return { action: 'reply', reason: 'A specific useful contribution can start or deepen a relevant relationship.' };
  }

  if (candidate?.source === 'x' && context.addsMaterialValue && context.sourceIsEvidence) {
    return { action: 'quote', reason: 'The source is useful evidence and our commentary creates a new information object.' };
  }

  if (candidate?.source === 'x' && context.amplificationOnly && Number(candidate?.viral?.score || candidate?.score || 0) >= 70) {
    return { action: 'repost', reason: 'The source is unusually useful and amplification is the point; no commentary is being forced.' };
  }

  return { action: 'ignore', reason: 'No sufficiently additive distribution action yet; research it or wait for a stronger angle.' };
}
