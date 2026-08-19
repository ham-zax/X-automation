const TOPIC_DEFINITIONS = [
  {
    id: 'coding_agent_reliability',
    tier: 1,
    anchors: ['coding agent', 'agent eval', 'agent evaluation', 'repo-scale', 'repository-scale', 'agent verification', 'autonomous debugging'],
  },
  {
    id: 'agent_context_memory_state',
    tier: 1,
    anchors: ['agent memory', 'agent context', 'persistent state', 'context compression', 'task ledger', 'repo map', 'context window'],
  },
  {
    id: 'mcp_tool_use_architecture',
    tier: 1,
    anchors: ['MCP', 'Model Context Protocol', 'tool calling', 'tool schema', 'tool discovery', 'agent tool'],
  },
  {
    id: 'coding_model_cost_reliability',
    tier: 1,
    anchors: ['coding model', 'Claude Code', 'Codex', 'Qwen', 'DeepSeek', 'GLM', 'coding reliability', 'cost per task'],
  },
  {
    id: 'agent_sandboxing_execution',
    tier: 2,
    anchors: ['sandbox', 'Firecracker', 'microVM', 'WebAssembly', 'execution environment', 'container isolation'],
  },
  {
    id: 'local_open_coding_models',
    tier: 2,
    anchors: ['Ollama', 'llama.cpp', 'vLLM', 'quantization', 'open-weight coding', 'local coding model', 'VRAM'],
  },
  {
    id: 'agent_observability',
    tier: 2,
    anchors: ['agent observability', 'tool-call trace', 'tool-call log', 'replay', 'eval dashboard', 'prompt versioning'],
  },
  {
    id: 'ai_coding_security',
    tier: 2,
    anchors: ['prompt injection', 'credential exfiltration', 'MCP security', 'package hallucination', 'permission escalation', 'AI coding security'],
  },
  {
    id: 'agent_native_developer_tooling',
    tier: 2,
    anchors: ['agent-friendly CLI', 'machine-readable CLI', 'structured error', 'idempotent command', 'dry-run', 'non-interactive workflow'],
  },
  {
    id: 'ai_engineer_job_market',
    tier: 3,
    anchors: ['AI engineer', 'agent engineer', 'AI product engineer', 'agent-engineering role', 'AI job market'],
  },
  {
    id: 'devtool_ai_product_economics',
    tier: 3,
    anchors: ['devtool pricing', 'AI product pricing', 'developer tool business', 'AI SaaS economics', 'developer SaaS revenue'],
  },
  {
    id: 'technical_product_distribution',
    tier: 3,
    anchors: ['developer marketing', 'technical product distribution', 'customer discovery', 'build in public', 'devtool launch', 'technical sales'],
  },
];

export const RESEARCH_TOPICS = Object.freeze(TOPIC_DEFINITIONS.map((topic) => Object.freeze({
  ...topic,
  anchors: Object.freeze([...topic.anchors]),
})));

export const RESEARCH_TOPIC_IDS = Object.freeze(RESEARCH_TOPICS.map((topic) => topic.id));

const TOPICS_BY_ID = new Map(RESEARCH_TOPICS.map((topic) => [topic.id, topic]));

export function normalizeResearchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function values(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function collectText(input) {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) return input.map(collectText).filter(Boolean).join('\n');
  if (!input || typeof input !== 'object') return '';

  return [
    input.title,
    input.text,
    input.description,
    input.summary,
    ...values(input.tags),
    ...values(input.semanticAnchors),
    ...values(input.matches),
    ...values(input.topics),
    ...values(input.niche?.tags),
    ...values(input.niche?.matches),
  ].filter(Boolean).join('\n');
}

function matchesAnchor(normalizedText, anchor) {
  const normalizedAnchor = normalizeResearchText(anchor);
  if (!normalizedAnchor) return false;
  return ` ${normalizedText} `.includes(` ${normalizedAnchor} `);
}

function compareMatches(left, right) {
  return left.tier - right.tier
    || right.matchedAnchors.length - left.matchedAnchors.length
    || left.topicId.localeCompare(right.topicId);
}

export function getResearchTopic(topicId) {
  return TOPICS_BY_ID.get(String(topicId || '')) || null;
}

export function matchResearchTopics(input) {
  const normalizedText = normalizeResearchText(collectText(input));
  if (!normalizedText) return [];

  return RESEARCH_TOPICS.map((topic) => {
    const matchedAnchors = topic.anchors.filter((anchor) => matchesAnchor(normalizedText, anchor));
    return matchedAnchors.length
      ? { topicId: topic.id, tier: topic.tier, matchedAnchors }
      : null;
  }).filter(Boolean).sort(compareMatches);
}

export function selectPrimaryResearchTopic(candidates = []) {
  return classifyResearchStory(candidates).primaryTopic;
}

export function classifyResearchStory(candidates = []) {
  const combined = new Map();
  for (const candidate of values(candidates)) {
    for (const match of matchResearchTopics(candidate)) {
      const current = combined.get(match.topicId) || { topicId: match.topicId, tier: match.tier, anchors: new Set() };
      for (const anchor of match.matchedAnchors) current.anchors.add(anchor);
      combined.set(match.topicId, current);
    }
  }

  const matches = [...combined.values()].map((match) => ({
    topicId: match.topicId,
    tier: match.tier,
    matchedAnchors: [...match.anchors].sort((left, right) => left.localeCompare(right)),
  })).sort(compareMatches);

  return { primaryTopic: matches[0] || null, matches };
}
