// Cache-fed deterministic controller tick: one finite pass over cached,
// currently-observed sources that admits at most one semantic job (zero model
// calls for unchanged or unworthy evidence) and dispatches at most one isolated
// structured decision. The direct_api lane keeps a genuine per-request output
// cap with strict admission. The native codex lane (Claive->Codex/Luna or
// native codex, via the bounded adapter contract) is admitted on a labeled,
// accounted basis: maxOutputTokens has no per-response cap there, so the
// residual single-response overshoot risk is disclosed in every tick outcome
// and any actual excess is charged before a terminal budget stop. Every other
// runtime reports capability_unavailable with no alternate-model fallback.
//
// Ordinary runner mode defaults to this controller; the deprecated executor
// spelling aliases it and legacy is blocked. This tick never collects live
// observations, opens a browser, begins a Growth Run, or grants publication
// authority. It returns preparation/recovery descriptors only; live source
// collection and attached-executor integration remain unimplemented.

import { createHash, randomUUID } from 'node:crypto';
import * as storeModule from './store.js';
import { listSocialAttempts } from './social_engagement.js';
import { getPersonaSlice } from './persona.js';
import { getOperatorLeaseStatus } from './operator_lease.js';
import { runStructuredAI } from './ai_runtime.js';
import { prepareDirectStructuredRequest } from './ai_direct.js';
import { prepareBoundedCliRequest } from './ai_bounded_cli.js';
import { rankMainFeedItems } from './scheduler.js';
import { buildScoutCards, parseStatusUrl, readScoutInput } from './scout.js';
import {
  admitJob,
  claimJob,
  getAttempt,
  getJob,
  listJobAttempts,
  markAttemptInterrupted,
  reserveAttempt,
  settleAttempt,
  settleJobTerminal,
} from './semantic_jobs.js';

// The direct API contract is owned here because its wire helper enforces the
// protocol output cap. Codex capabilities and accounting come from the
// bounded runtime adapter's preparation result; do not duplicate native
// limits or retry claims here. Unsupported runtimes remain unavailable.
const LANE_CONTRACTS = Object.freeze({
  direct_api: Object.freeze({
    lane: 'direct_api',
    strictLimits: true,
    unsupported: Object.freeze([]),
    enforcement: Object.freeze({
      outputCap: 'provider_protocol',
      perResponseCap: true,
      modelCalls: 'single_request_no_repair_no_fallback',
      tools: 'none',
    }),
  }),
});
const LANE_RUNTIMES = new Set(['direct_api', 'codex']);
const X_SNAPSHOT_KINDS = ['x_for_you', 'x_creator_latest', 'x_latest', 'x_momentum'];
const UNFINISHED_PUBLICATION_STATES = ['claimed', 'send_started', 'investigating'];
const UNFINISHED_SOCIAL_STATES = new Set(['claimed', 'mutation_started', 'repost_confirmation_started']);

// Canonical source freshness in minutes. Owner: operator_readiness.js
// SOURCE_FRESHNESS_MINUTES; this lane reuses those thresholds, never its own.
const SOURCE_FRESHNESS_MINUTES = Object.freeze({
  x_for_you: 45,
  x_latest: 60,
  x_momentum: 60,
  x_creator_latest: 90,
  github_trending: 180,
  hn_top: 180,
});
// Canonical writer: x_discovery.js X_FOR_YOU_SENSOR_STATE_KEY. Read here only.
const FOR_YOU_SENSOR_STATE_KEY = 'x_for_you_sensor_provenance_v1';
// Canonical future-skew bound: x_discovery.js MAX_OBSERVED_FUTURE_SKEW_MS.
const FUTURE_SKEW_MS = 5 * 60_000;
// Read-only lister caps: listSocialAttempts clamps to 200, newest-first;
// listPublicationAttempts clamps to 500. Hitting the cap fails closed.
const SOCIAL_LIST_MAX = 200;
const PUBLICATION_LIST_MAX = 500;

// Narrowly scoped controller receipts backed by app_state (no schema change).
const RECEIPTS_KEY = 'semantic_controller_receipts_v1';
const PENDING_KEY = 'semantic_controller_pending_v1';
const USAGE_KEY = 'semantic_controller_usage_v1';
const MAX_RECEIPTS = 500;

export const CONTROLLER_DEFAULTS = Object.freeze({
  kind: 'opportunity_selection',
  role: 'editorial_scan',
  claimantPrefix: 'controller',
  shortlistSize: 5,
  priorityPicks: 3,
  explorationPicks: 2,
  perCandidateTextLimit: 2000,
  maxRules: 20,
  maxStances: 30,
  maxBeliefs: 20,
  ruleTextCap: 500,
  transport: null,
  ceiling: Object.freeze({ maxDailyModelCalls: 25, maxDailyInputTokens: 200000, maxDailyOutputTokens: 50000 }),
  budget: Object.freeze({
    maxCandidates: 5,
    maxContextBytes: 48000,
    maxEstimatedInputTokens: 16000,
    maxCumulativeInputTokens: 32000,
    maxModelCalls: 1,
    maxOutputTokens: 1000,
    maxWallTimeMs: 60000,
    maxToolCalls: null,
    maxRepairs: 0,
  }),
});

export const CONTROLLER_DECISION_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    decision: { type: 'string', enum: ['reply', 'quote', 'skip', 'defer', 'needs_evidence'] },
    purpose: { type: 'string', maxLength: 200 },
    rationale: { type: 'string', maxLength: 1000 },
    targetCandidateKey: { type: 'string', maxLength: 500 },
    draft: { type: 'string', maxLength: 280 },
    missingEvidence: { type: 'string', maxLength: 500 },
    revisitCondition: { type: 'string', maxLength: 500 },
  },
  // Strict structured output requires every property; unused fields are empty strings.
  required: ['decision', 'purpose', 'rationale', 'targetCandidateKey', 'draft', 'missingEvidence', 'revisitCondition'],
  additionalProperties: false,
});

const CONTROLLER_QUESTION = 'Which opportunity deserves Hamza\'s participation, what role should he take, and what contribution would make that participation worthwhile?';

// Context fields preserved from cached observations when actually available.
// Anything else is ignored; missing essential context defers, never invents.
const CONTEXT_KEYS = ['parentText', 'parentUrl', 'parentAuthor', 'conversationId', 'inReplyToStatusId', 'quotedText', 'quotedUrl'];

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function contentHash(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 16);
}

function contentVersion(prefix, value) {
  return `${prefix}:${contentHash(value)}`;
}

function outcome(status, reason, extra = {}) {
  return { status, reason, jobId: null, attemptId: null, modelCalls: 0, result: null, descriptor: null, preparationOnly: true, ...extra };
}

function readJsonState(store, key, fallback) {
  try {
    const value = JSON.parse(store.getAppState(key, ''));
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function utcDate(now) {
  return new Date(Number(now)).toISOString().slice(0, 10);
}

// Stable breakout identity: threshold crossing kind and evidence basis only.
// Counts, timestamps, and rates are observation noise, not new evidence.
export function breakoutIdentity(urgent) {
  if (!urgent || urgent.kind !== 'measured_breakout') return null;
  return `${urgent.kind}:${urgent.basis || 'unknown'}`;
}

function lanesOf(policy) {
  return {
    reply: policy?.lanes?.reply?.enabled !== false,
    quote: policy?.lanes?.quote?.enabled !== false,
  };
}

// Objective pool fences only (mirrors scout's hard exclusions): parseable
// non-own identity, no recorded action/disposition/blocking fence, and an
// enabled lane. Scores, reach, topics, and relationship coldness never gate.
export function filterObjectivePool(items, { ownHandle, lanes }) {
  const own = String(ownHandle || '').replace(/^@/, '').toLowerCase();
  return (items || []).filter((item) => {
    if (!item?.key || !item?.text) return false;
    const { author, tweetId } = parseStatusUrl(item.url || item.key);
    if (!author || !tweetId || author.toLowerCase() === own) return false;
    if (item.hasAction || item.dispositionActive || item.blockingAttempt) return false;
    if (!lanes.reply && !lanes.quote) return false;
    return true;
  });
}

// Priority head from advisory ranking plus exploration slots drawn from pool
// members outside the display cutoff, so genuinely unfamiliar candidates stay
// reachable. During rest only urgent (threshold-crossed) members are eligible.
export function selectShortlist({ rankedKeys, pool, config, rest = false }) {
  const cutoff = new Set(rankedKeys.slice(0, 30));
  const eligible = rest ? pool.filter((item) => item.breakout) : pool;
  const priority = [];
  for (const key of rankedKeys) {
    if (priority.length >= Math.max(0, config.priorityPicks)) break;
    const item = eligible.find((entry) => entry.key === key);
    if (item && !priority.some((entry) => entry.key === key)) priority.push(item);
  }
  const picked = new Set(priority.map((item) => item.key));
  const outside = eligible.filter((item) => !picked.has(item.key) && !cutoff.has(item.key));
  const exploration = [...outside];
  if (exploration.length < Math.max(0, config.explorationPicks)) {
    // Small pools have nothing outside the cutoff: backfill from the ranked tail.
    const byKey = new Map(eligible.map((item) => [item.key, item]));
    for (const key of [...rankedKeys].reverse()) {
      if (exploration.length >= Math.max(0, config.explorationPicks)) break;
      const item = byKey.get(key);
      if (item && !picked.has(key) && !exploration.some((entry) => entry.key === key)) exploration.push(item);
    }
  }
  const chosen = [...priority, ...exploration.slice(0, Math.max(0, config.explorationPicks))].slice(0, Math.max(1, config.shortlistSize));
  const explorationKeys = new Set(exploration.slice(0, Math.max(0, config.explorationPicks)).map((item) => item.key));
  return chosen.map((item) => ({ ...item, exploration: explorationKeys.has(item.key) }));
}

function summarizeMetadata(metadata) {
  if (metadata == null) return null;
  if (typeof metadata === 'string') return metadata.slice(0, 500);
  try {
    return stableStringify(metadata).slice(0, 500);
  } catch {
    return null;
  }
}

function ruleVersionOf(rule) {
  return {
    ruleId: rule.ruleId, scope: rule.scope, key: rule.key, finding: rule.finding,
    recommendation: rule.recommendation, primaryMetric: rule.primaryMetric,
    adjustment: rule.adjustment, evidence: rule.evidence,
  };
}

function relationshipView(store, author) {
  try {
    const context = store.readRelationshipContext(author, { limit: 3 });
    if (!context || context.status === 'not_tracked') return { tracked: false, stage: null, recentResponses: [] };
    const stage = context.profile?.relationshipStage ?? context.profile?.relationship_stage ?? null;
    return {
      tracked: true,
      stage: typeof stage === 'string' && stage ? stage : null,
      // Actual response evidence (type, time, target, topic, metadata) is
      // semantic: a new response invalidates. Profile refresh timestamps are
      // never read, so a timestamp-only refresh cannot invalidate.
      recentResponses: (context.events || []).slice(0, 3).map((event) => ({
        type: event.eventType ?? event.type ?? null,
        occurredAt: event.occurredAt ?? event.occurred_at ?? null,
        candidateKey: event.candidateKey ?? event.candidate_key ?? null,
        topic: typeof event.topic === 'string' ? event.topic.slice(0, 120) : null,
        detail: summarizeMetadata(event.metadata),
      })),
    };
  } catch {
    return { tracked: false, stage: null, recentResponses: [] };
  }
}

// Essential parent/quote text must never change meaning unnoticed: overlong
// essential fields are reported via truncatedKeys so the packet builder can
// visibly defer the candidate instead of silently slicing evidence.
const ESSENTIAL_CONTEXT_KEYS = new Set(['parentText', 'quotedText']);
const CONTEXT_FIELD_CAP = 2000;

function extractContext(metrics) {
  const context = {};
  const truncatedKeys = [];
  if (!metrics || typeof metrics !== 'object') return { context, truncatedKeys };
  for (const key of CONTEXT_KEYS) {
    const value = metrics[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    if (value.length > CONTEXT_FIELD_CAP) truncatedKeys.push(key);
    context[key] = value.slice(0, CONTEXT_FIELD_CAP);
  }
  const evidence = metrics.evidenceUrls ?? metrics.evidence_urls;
  if (Array.isArray(evidence)) {
    const urls = evidence.filter((entry) => typeof entry === 'string' && entry.startsWith('http')).slice(0, 5);
    if (urls.length) context.evidenceUrls = urls;
  }
  return { context, truncatedKeys };
}

// Per-candidate semantic identity: meaningful source facts, threshold-crossing
// breakout, relationship revision, and strategy/persona/policy revisions.
// Rank, age, refreshed timestamps, and metric noise are excluded, so an
// unrelated new cache key never invalidates already-judged sources.
export function candidateIdentity(item, versions) {
  return {
    key: item.key,
    text: item.text,
    breakout: item.breakout || null,
    relationshipStage: item.relationship?.stage || null,
    relationshipResponses: item.relationship?.recentResponses || [],
    context: item.context || {},
    persona: versions.persona,
    policy: versions.policy,
    strategy: versions.strategy,
  };
}

export function candidateFingerprint(item, versions) {
  return createHash('sha256').update(stableStringify(candidateIdentity(item, versions))).digest('hex');
}

function capText(value, limit) {
  const text = String(value || '');
  return text.length > limit ? { text: text.slice(0, limit), truncated: true } : { text, truncated: false };
}

// Rule text may be a string or a structured object; objects render as stable
// JSON, never "[object Object]".
function textOf(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try {
    return stableStringify(value);
  } catch {
    return String(value);
  }
}

// The exact persona snapshot sent in the packet. versions.persona hashes this
// content (identity plus behavior/affect/relationship policies, stances,
// beliefs), never a bare version label.
export function personaSnapshotOf(persona, config) {
  const stances = Array.isArray(persona?.currentStances) ? persona.currentStances : [];
  const beliefs = Array.isArray(persona?.candidateBeliefs) ? persona.candidateBeliefs : [];
  return {
    version: persona?.version || 'unknown',
    identity: persona?.identity || {},
    operatorDecisions: persona?.operatorDecisions || {},
    behaviorPolicy: persona?.behaviorPolicy || {},
    affectPolicy: persona?.affectPolicy || {},
    relationshipPolicy: persona?.relationshipPolicy || {},
    currentStances: stances.slice(0, config.maxStances),
    candidateBeliefs: beliefs.slice(0, config.maxBeliefs),
  };
}

// Builds the bounded decision packet. Persona policies/stances/beliefs and
// rule recommendation/effect/evidence ride along in capped, explicitly counted
// form; versions hash content, never bare IDs or labels.
export function buildDecisionPacket({ shortlist, store, persona, rules, config, now, rest = false }) {
  const snapshot = personaSnapshotOf(persona, config);
  const stances = Array.isArray(persona?.currentStances) ? persona.currentStances : [];
  const beliefs = Array.isArray(persona?.candidateBeliefs) ? persona.candidateBeliefs : [];
  const truncatedRules = [];
  const ruleProjections = (rules || []).slice(0, config.maxRules).map((rule) => {
    const finding = capText(textOf(rule.finding), config.ruleTextCap);
    const recommendation = capText(textOf(rule.recommendation), config.ruleTextCap);
    if (finding.truncated || recommendation.truncated) truncatedRules.push(rule.ruleId ?? rule.key);
    return {
      ruleId: rule.ruleId ?? `${rule.scope ?? ''}:${rule.key ?? ''}`,
      scope: rule.scope ?? null,
      key: rule.key ?? null,
      finding: finding.text,
      recommendation: recommendation.text,
      primaryMetric: rule.primaryMetric || null,
      adjustmentProposed: rule.adjustment?.proposed ?? null,
      evidenceState: rule.evidence?.state ?? null,
    };
  });
  const included = [];
  const excludedOversize = [];
  const missingContext = [];
  const truncatedContext = [];
  for (const item of shortlist) {
    if (item.text.length > config.perCandidateTextLimit) {
      excludedOversize.push({ key: item.key, chars: item.text.length, reason: 'per_candidate_text_limit' });
      continue;
    }
    if (item.context?.inReplyToStatusId && !item.context?.parentText) {
      missingContext.push({ key: item.key, reason: 'missing_parent_context' });
      continue;
    }
    const oversizeEssential = (item.contextTruncated || []).filter((key) => ESSENTIAL_CONTEXT_KEYS.has(key));
    if (oversizeEssential.length) {
      // Essential evidence would change meaning if sliced: defer visibly with
      // zero model calls instead of sending a truncated parent/quote.
      missingContext.push({ key: item.key, reason: 'oversize_essential_context', fields: oversizeEssential });
      continue;
    }
    for (const key of item.contextTruncated || []) {
      truncatedContext.push({ key: item.key, field: key, cap: CONTEXT_FIELD_CAP });
    }
    included.push({
      key: item.key,
      url: item.url,
      author: item.author,
      text: item.text,
      publishedAt: item.publishedAt ?? null,
      nicheTags: item.nicheTags || [],
      breakout: item.breakout || null,
      relationship: item.relationship?.tracked ? item.relationship : null,
      context: item.context || {},
      exploration: item.exploration === true,
    });
  }
  const metricsByKey = new Map(shortlist.map((item) => [item.key, item]));
  const observations = included.map((item) => {
    const source = metricsByKey.get(item.key) || {};
    return {
      key: item.key,
      viewsPerHour: source.viewsPerHour ?? null,
      engagementsPerHour: source.engagementsPerHour ?? null,
      ageMinutes: source.ageMinutes ?? null,
    };
  });
  return {
    semanticInput: {
      question: CONTROLLER_QUESTION,
      candidates: included,
      persona: snapshot,
      rules: ruleProjections,
      meta: {
        shortlistSize: included.length,
        reducedFrom: shortlist.length,
        droppedKeys: excludedOversize.map((entry) => entry.key),
        explorationKeys: included.filter((item) => item.exploration).map((item) => item.key),
        rulesOmitted: Math.max(0, (rules || []).length - ruleProjections.length),
        stancesOmitted: Math.max(0, stances.length - Math.min(stances.length, config.maxStances)),
        beliefsOmitted: Math.max(0, beliefs.length - Math.min(beliefs.length, config.maxBeliefs)),
        truncatedRules,
        exclusionReasons: excludedOversize,
        missingContext,
        truncatedContext,
        contextReductions: [],
        rest,
      },
    },
    observationMetadata: { observedAt: now, rest, candidates: observations },
  };
}

// Exact wire-packet sizing: the serialized provider body built by the same
// ai_direct helper the runtime dispatches, including native schema or the
// compatible wrapper plus system instructions. The estimate stays explicitly
// bytes/3, never actual tokenizer usage. Throws on a misconfigured profile;
// callers map that to a finite blocked outcome before any claim.
export function measureWirePacket(packet, profile, maxOutputTokens) {
  const prompt = renderDecisionPrompt(packet);
  const prepared = prepareDirectStructuredRequest(profile, { prompt, schema: CONTROLLER_DECISION_SCHEMA, maxOutputTokens });
  const bytes = Buffer.byteLength(JSON.stringify(prepared.body));
  return { prompt, bytes, estimate: Math.max(1, Math.ceil(bytes / 3)) };
}

// Codex sizing and capability metadata come from the bounded adapter's own
// preparation. Its estimate includes adapter overhead but is not the exact
// provider wire. Direct_api keeps its protocol wire sizing above.
export function measureCodexPacket(packet, profile, budget) {
  const prompt = renderDecisionPrompt(packet);
  const prepared = prepareBoundedCliRequest(profile, {
    prompt,
    schema: CONTROLLER_DECISION_SCHEMA,
    maxOutputTokens: budget?.maxOutputTokens ?? null,
    timeoutMs: budget?.maxWallTimeMs ?? 60_000,
    budget,
  });
  return {
    prompt,
    bytes: prepared.bytes,
    estimate: prepared.estimatedInputTokens,
    metadata: prepared.metadata,
    unsupported: [...prepared.unsupported],
  };
}

// Explicit reduction: priority tail first, exploration retained to the end.
// Fit is measured on the exact outgoing wire packet when a measure function
// is supplied (the tick always supplies one); the default prompt-plus-schema
// fallback exists only for measurement-agnostic unit tests of drop order.
// Returns the reduced packet, the dropped keys in order, and fit state.
export function reducePacket(packet, budget, measure = null) {
  const reductions = [];
  const sizer = measure || (() => {
    const bytes = Buffer.byteLength(renderDecisionPrompt(packet))
      + Buffer.byteLength(JSON.stringify(CONTROLLER_DECISION_SCHEMA));
    return { bytes, estimate: Math.max(1, Math.ceil(bytes / 3)) };
  });
  let sized = sizer(packet);
  const fits = () => sized.bytes <= budget.maxContextBytes && sized.estimate <= budget.maxEstimatedInputTokens;
  while (!fits() && packet.semanticInput.candidates.length > 1) {
    const list = packet.semanticInput.candidates;
    const victim = [...list].reverse().find((item) => !item.exploration) ?? list[list.length - 1];
    packet.semanticInput.candidates = list.filter((item) => item.key !== victim.key);
    packet.observationMetadata.candidates = packet.observationMetadata.candidates.filter((entry) => entry.key !== victim.key);
    packet.semanticInput.meta.droppedKeys.push(victim.key);
    reductions.push(`candidate:${victim.key}`);
    sized = sizer(packet);
  }
  const persona = packet.semanticInput.persona;
  for (const [field, label] of [['currentStances', 'stances'], ['candidateBeliefs', 'beliefs']]) {
    while (!fits() && persona[field].length > 0) {
      const drop = Math.max(1, Math.ceil(persona[field].length / 2));
      const removed = persona[field].splice(-drop, drop);
      reductions.push(`${label}:-${removed.length}`);
      packet.semanticInput.meta.contextReductions.push(`${label}:-${removed.length}`);
      sized = sizer(packet);
    }
  }
  while (!fits() && packet.semanticInput.rules.length > 1) {
    const dropped = packet.semanticInput.rules.pop();
    reductions.push(`rule:${dropped.ruleId}`);
    packet.semanticInput.meta.contextReductions.push(`rule:${dropped.ruleId}`);
    sized = sizer(packet);
  }
  return {
    packet,
    reductions,
    fits: fits(),
    bytes: sized.bytes,
    estimate: sized.estimate,
    sizing: {
      bytes: sized.bytes,
      estimate: sized.estimate,
      metadata: sized.metadata ?? null,
      unsupported: Array.isArray(sized.unsupported) ? [...sized.unsupported] : null,
    },
  };
}

function renderDecisionPrompt(packet) {
  const input = packet.semanticInput;
  const lines = [
    'You are a bounded opportunity-selection judge for Hamza\'s developer/builder account. One JSON decision, no tools, no publication authority. Your output is preparation only: it never approves or sends anything.',
    '',
    `QUESTION: ${input.question}`,
    '',
    `PERSONA ${input.persona.version}: ${JSON.stringify({ identity: input.persona.identity, behaviorPolicy: input.persona.behaviorPolicy, affectPolicy: input.persona.affectPolicy, relationshipPolicy: input.persona.relationshipPolicy })}`,
    `OPERATOR DECISIONS: ${JSON.stringify(input.persona.operatorDecisions)}`,
    `STANCES: ${JSON.stringify(input.persona.currentStances)}`,
    `BELIEFS: ${JSON.stringify(input.persona.candidateBeliefs)}`,
    `ACCEPTED STRATEGY RULES: ${JSON.stringify(input.rules)}`,
    '',
  ];
  for (const candidate of input.candidates) {
    const rel = candidate.relationship?.stage ? ` [relationship: ${candidate.relationship.stage}]` : '';
    const resp = candidate.relationship?.recentResponses?.length
      ? ` [recent: ${candidate.relationship.recentResponses.map((event) => `${event.type}@${event.occurredAt}${event.topic ? `:${event.topic}` : ''}`).join(',')}]` : '';
    const ctx = candidate.context && Object.keys(candidate.context).length ? ` [context: ${JSON.stringify(candidate.context)}]` : '';
    lines.push(`CANDIDATE ${candidate.key} by @${candidate.author}${candidate.exploration ? ' [exploration]' : ''}${candidate.breakout ? ` [breakout: ${candidate.breakout}]` : ''}${rel}${resp}${ctx}: ${candidate.text}`);
  }
  lines.push(
    '',
    'Decide exactly one of reply/quote/skip/defer/needs_evidence with purpose and rationale. For reply/quote name a listed candidate key and a draft of at most 280 characters that is additive to the source, never a near-copy. For defer/needs_evidence state the revisit condition or missing evidence. Silence (skip) is a successful decision when nothing is worthwhile.',
  );
  return lines.join('\n');
}

export function validateDecision(output, { keys, lanes }) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return { ok: false, reason: 'Decision output is not an object.' };
  }
  const valid = new Set(['reply', 'quote', 'skip', 'defer', 'needs_evidence']);
  if (!valid.has(output.decision)) return { ok: false, reason: `Unknown decision: ${String(output.decision || 'missing')}` };
  if (!String(output.purpose || '').trim()) return { ok: false, reason: 'Decision purpose is required.' };
  if (!String(output.rationale || '').trim()) return { ok: false, reason: 'Decision rationale is required.' };
  if (output.decision === 'reply' || output.decision === 'quote') {
    if (output.decision === 'reply' && !lanes.reply) return { ok: false, reason: 'Reply lane is disabled.' };
    if (output.decision === 'quote' && !lanes.quote) return { ok: false, reason: 'Quote lane is disabled.' };
    if (!keys.includes(output.targetCandidateKey)) {
      return { ok: false, reason: 'Decision target is not a listed candidate.' };
    }
    const draft = String(output.draft || '');
    if (!draft.trim() || draft.length > 280) return { ok: false, reason: 'Reply/quote decision requires a draft of 1-280 characters.' };
  }
  if ((output.decision === 'defer' || output.decision === 'needs_evidence')
    && !String(output.revisitCondition || output.missingEvidence || '').trim()) {
    return { ok: false, reason: 'Deferral requires a revisit condition or missing evidence.' };
  }
  return { ok: true };
}

function mapTerminal(output) {
  const rationale = String(output.rationale || '').trim();
  const revisit = String(output.revisitCondition || output.missingEvidence || '').trim();
  const base = {
    action: output.decision,
    purpose: String(output.purpose || '').trim(),
    rationale,
    preparationOnly: true,
  };
  if (output.decision === 'reply' || output.decision === 'quote') {
    return {
      outcome: 'completed',
      reason: `Selected ${output.decision} on ${output.targetCandidateKey}.`,
      result: { ...base, targetCandidateKey: output.targetCandidateKey, draft: String(output.draft || ''), ...(revisit ? { revisitCondition: revisit } : {}) },
    };
  }
  if (output.decision === 'skip') {
    return {
      outcome: 'skipped',
      reason: rationale || String(output.purpose || '').trim(),
      result: { ...base, ...(revisit ? { revisitCondition: revisit } : {}) },
    };
  }
  return {
    outcome: output.decision === 'defer' ? 'deferred' : 'waiting_for_evidence',
    reason: rationale || String(output.purpose || '').trim(),
    result: { ...base, revisitCondition: revisit },
  };
}

// ---- Durable per-candidate receipts, pending markers, and usage ceiling ----

function readReceipts(store) {
  const state = readJsonState(store, RECEIPTS_KEY, null);
  if (state && typeof state.receipts === 'object' && state.receipts) return state.receipts;
  return {};
}

function writeReceipts(store, receipts) {
  const entries = Object.entries(receipts);
  while (entries.length > MAX_RECEIPTS) {
    let oldest = 0;
    for (let index = 1; index < entries.length; index += 1) {
      if (Number(entries[index][1]?.decidedAt || 0) < Number(entries[oldest][1]?.decidedAt || 0)) oldest = index;
    }
    entries.splice(oldest, 1);
  }
  store.setAppState(RECEIPTS_KEY, JSON.stringify({ receipts: Object.fromEntries(entries) }));
}

// Partial ceiling configuration merges finite positive defaults: undefined,
// NaN, zero, negative, or corrupt values can never turn a cap off.
export function resolveCeiling(partial) {
  const base = CONTROLLER_DEFAULTS.ceiling;
  const source = partial && typeof partial === 'object' ? partial : {};
  const pick = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback);
  return {
    maxDailyModelCalls: pick(source.maxDailyModelCalls, base.maxDailyModelCalls),
    maxDailyInputTokens: pick(source.maxDailyInputTokens, base.maxDailyInputTokens),
    maxDailyOutputTokens: pick(source.maxDailyOutputTokens, base.maxDailyOutputTokens),
  };
}

function readPending(store) {
  let raw = '';
  try {
    raw = store.getAppState(PENDING_KEY, '');
  } catch {
    return { pending: {}, corrupt: true };
  }
  if (!raw) return { pending: {} };
  try {
    const state = JSON.parse(raw);
    if (!state || typeof state !== 'object' || Array.isArray(state)
      || !state.pending || typeof state.pending !== 'object' || Array.isArray(state.pending)) {
      return { pending: {}, corrupt: true };
    }
    return { pending: state.pending };
  } catch {
    return { pending: {}, corrupt: true };
  }
}

function writePending(store, pending) {
  store.setAppState(PENDING_KEY, JSON.stringify({ pending }));
}

function readCeiling(store, now) {
  const today = utcDate(now);
  const empty = () => ({ date: today, modelCalls: 0, inputTokens: 0, outputTokens: 0, reservations: {} });
  let raw = '';
  try {
    raw = store.getAppState(USAGE_KEY, '');
  } catch {
    return { corrupt: true };
  }
  if (!raw) return empty();
  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    return { corrupt: true };
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) return { corrupt: true };
  // Shape is validated on every read, regardless of date: a typeless or
  // malformed persisted state must fail closed even when its date would
  // otherwise trigger a new-day reset. Absent fields default; present but
  // invalid fields are corruption.
  const checkCount = (value) => value === undefined ? 0
    : (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : NaN);
  const modelCalls = checkCount(state.modelCalls);
  const inputTokens = checkCount(state.inputTokens);
  const outputTokens = checkCount(state.outputTokens);
  let reservations = {};
  if (state.reservations !== undefined) {
    const carried = state.reservations;
    if (carried === null || typeof carried !== 'object' || Array.isArray(carried)) return { corrupt: true };
    for (const entry of Object.values(carried)) {
      if (!entry || typeof entry !== 'object' || !Number.isFinite(entry.input) || entry.input < 0
        || !Number.isFinite(entry.output) || entry.output < 0
        || (entry.modelCalls !== undefined && (!Number.isSafeInteger(entry.modelCalls) || entry.modelCalls < 0))) {
        return { corrupt: true };
      }
    }
    reservations = carried;
  }
  if (!Number.isFinite(modelCalls) || !Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    return { corrupt: true };
  }
  if (state.date !== today) {
    // A new day resets counters but never releases unknown or live fences:
    // pending markers persist under a separate key and survive rollover, and
    // validated unreconciled reservations carry over so dispatched work stays
    // charged.
    return { date: today, modelCalls: 0, inputTokens: 0, outputTokens: 0, reservations };
  }
  return { date: today, modelCalls, inputTokens, outputTokens, reservations };
}

function writeCeiling(store, ceiling) {
  store.setAppState(USAGE_KEY, JSON.stringify({
    date: ceiling.date,
    modelCalls: ceiling.modelCalls,
    inputTokens: ceiling.inputTokens,
    outputTokens: ceiling.outputTokens,
    reservations: ceiling.reservations || {},
  }));
}

// Reconcile one pre-request reservation to actual usage field by field. A
// known failed response charges actuals to the daily ledger instead of
// permanently keeping the estimate; unknown fields keep the estimate charge
// and the entry, so the uncertainty stays visible (and fenced) until explicit
// reconciliation. Convergent: repeating with the same actuals is a no-op.
function consumeReservation(ceiling, attemptId, actual) {
  const entry = ceiling.reservations?.[attemptId];
  if (!entry || !actual || typeof actual !== 'object') return false;
  let changed = false;
  if (Number.isSafeInteger(actual.modelCalls) && actual.modelCalls >= 0) {
    const reservedModelCalls = Number.isSafeInteger(entry.modelCalls) && entry.modelCalls >= 0 ? entry.modelCalls : 1;
    ceiling.modelCalls = Math.max(0, ceiling.modelCalls - reservedModelCalls + actual.modelCalls);
    entry.modelCalls = actual.modelCalls;
    changed = true;
  }
  if (actual.input != null) {
    ceiling.inputTokens = Math.max(0, ceiling.inputTokens - Math.max(0, entry.input ?? 0) + Math.max(0, actual.input));
    entry.input = Math.max(0, actual.input);
    changed = true;
  }
  if (actual.output != null) {
    ceiling.outputTokens = Math.max(0, ceiling.outputTokens - Math.max(0, entry.output ?? 0) + Math.max(0, actual.output));
    entry.output = Math.max(0, actual.output);
    changed = true;
  }
  if (changed && actual.modelCalls != null && actual.input != null && actual.output != null) {
    delete ceiling.reservations[attemptId];
  }
  return changed;
}

function fenceEntry(jobId, marker, job, attempts, now) {
  const uncertain = (attempts || []).filter((attempt) => attempt.status === 'reserved' || attempt.status === 'interrupted');
  return {
    jobId,
    candidateKeys: Object.keys(marker?.keys || {}),
    terminalOutcome: job?.terminalOutcome || null,
    hasUnknownUsage: Boolean(job?.usage?.hasUnknownUsage),
    deadlinePassed: job?.deadlineAt != null && now >= job.deadlineAt,
    reservedAttempts: (attempts || []).filter((attempt) => attempt.status === 'reserved').length,
    attemptIds: uncertain.map((attempt) => attempt.id),
  };
}

// Reconcile pending markers against durable jobs: backfill receipts for
// settled work with known usage (reconciling any unreconciled reservation
// exactly once so a crash between settlement and accounting never loses or
// doubles a charge), keep a global fence for unknown usage, vanished rows, or
// anything still in flight, and never auto-rerun or steal claimed work.
function syncPendingMarkers(store, now) {
  const read = readPending(store);
  if (read.corrupt) return { fences: [], backfilled: 0, reconciled: 0, stateCorrupt: true };
  const pending = read.pending;
  const ids = Object.keys(pending);
  if (!ids.length) return { fences: [], backfilled: 0, reconciled: 0 };
  const fences = [];
  let backfilled = 0;
  let reconciled = 0;
  const receipts = readReceipts(store);
  let changed = false;
  let ceiling = null;
  for (const jobId of ids) {
    const marker = pending[jobId] && typeof pending[jobId] === 'object' ? pending[jobId] : {};
    let job = null;
    try {
      job = getJob(jobId);
    } catch {
      job = null;
    }
    if (!job) {
      // A vanished row is never fresh capacity: keep the marker as a fence
      // with a diagnostic instead of discarding it.
      fences.push({ ...fenceEntry(jobId, marker, null, [], now), jobMissing: true });
      continue;
    }
    const attempts = listJobAttempts(jobId);
    if (job.terminalOutcome) {
      if (job.usage.hasUnknownUsage) {
        // Terminal but uncertain: a new fingerprint is not authorization to
        // retry uncertain usage. Fence until explicit reconciliation.
        fences.push({ ...fenceEntry(jobId, marker, job, attempts, now), unresolved: true });
        continue;
      }
      if (ceiling === null) {
        ceiling = readCeiling(store, now);
        if (ceiling.corrupt) return { fences: [], backfilled: 0, reconciled: 0, usageCorrupt: true };
      }
      // Single-attempt controller jobs reconcile from durable cumulative
      // usage; anything else keeps its fence for explicit reconciliation.
      if (attempts.length === 1) {
        const settled = attempts[0];
        const actual = settled.actual || {};
        for (const attemptId of Object.keys(ceiling.reservations)) {
          const entry = ceiling.reservations[attemptId];
          // Null-preserving: unknown fields must not collapse to zero here;
          // per-field reconciliation charges what is known and keeps the
          // remainder fenced.
          if (entry && entry.jobId === jobId && consumeReservation(ceiling, attemptId, {
            modelCalls: actual.modelCalls ?? null,
            input: actual.inputTokens ?? null,
            output: actual.outputTokens ?? null,
          })) {
            reconciled += 1;
            changed = true;
          }
        }
      }
      const decidedAt = job.decidedAt || now;
      for (const [key, receipt] of settlementReceiptItems(
        Object.entries(marker?.keys || {}).map(([key, fp]) => ({ key, fp })),
        job.terminalOutcome, job.result, jobId, decidedAt,
      )) {
        receipts[key] = receipt;
        backfilled += 1;
      }
      delete pending[jobId];
      changed = true;
      continue;
    }
    fences.push(fenceEntry(jobId, marker, job, attempts, now));
  }
  if (changed) {
    writeReceipts(store, receipts);
    writePending(store, pending);
    if (ceiling) writeCeiling(store, ceiling);
  }
  return { fences, backfilled, reconciled };
}

function storeTx(store, fn) {
  return (store.runStoreTransaction || storeModule.runStoreTransaction)(fn);
}

// mapTerminal settles skip as skipped, never completed: a completed outcome
// arises only from a validated reply/quote decision, whose result carries
// action plus the selected listed-candidate target. A target-less or
// unsupported completed result proves no candidate was selected, so it
// stamps and covers nothing.
function completionTargetOf(result) {
  if (result?.action !== 'reply' && result?.action !== 'quote') return null;
  const target = result?.targetCandidateKey;
  return typeof target === 'string' && target ? target : null;
}

// Selective completion receipts (single owner for receipt semantics): for a
// terminal completed reply/quote, only the selected target carries a completed
// candidate judgment; unselected packet members stay eligible for a later
// decision. Every other terminal outcome keeps whole-packet receipts: skip,
// waiting/deferred/blocked/unresolved memoization is preserved. Pending
// markers are untouched by this rule: they remain uncertainty/in-flight fence
// diagnostics, never proof of selection.
export function settlementReceiptItems(pairs, outcome, result, jobId, decidedAt) {
  if (outcome === 'completed' && !completionTargetOf(result)) return [];
  const target = outcome === 'completed' ? completionTargetOf(result) : null;
  const entries = [];
  for (const { key, fp } of pairs) {
    if (target && key !== target) continue;
    entries.push([key, { fp, jobId, outcome, decidedAt }]);
  }
  return entries;
}

// Legacy tolerance: a completed receipt proves selection only when the
// durable job result agrees it selected this candidate. Poisoned rows from
// the old whole-packet writer are ignored in memory — never deleted,
// migrated, or rewritten — so the candidate is simply re-judged.
export function completedReceiptCoversKey(receipt, key) {
  if (!receipt || receipt.outcome !== 'completed') return true;
  let job = null;
  try {
    job = getJob(receipt.jobId);
  } catch {
    return false;
  }
  if (!job || job.terminalOutcome !== 'completed') return false;
  return completionTargetOf(job.result) === key;
}

// Settlement accounting: receipts persist for every terminal outcome, but the
// pending marker is deleted only when usage is fully known. Unknown usage
// keeps the global fence. The pre-request reservation is reconciled to actual
// exactly once; usage-state corruption fails closed by throwing (the
// transaction rolls back, so the marker and reservation are retained).
function persistSettlement(store, {
  items, jobId, attemptId = null, estimate = null, actual = null,
  outcome, result = null, decidedAt, countUsage = true,
}) {
  storeTx(store, () => {
    const receipts = readReceipts(store);
    for (const [key, receipt] of settlementReceiptItems(items, outcome, result, jobId, decidedAt)) {
      receipts[key] = receipt;
    }
    writeReceipts(store, receipts);
    let job = null;
    try {
      job = getJob(jobId);
    } catch {
      job = null;
    }
    const keepFence = !job || Boolean(job.usage.hasUnknownUsage);
    const read = readPending(store);
    if (read.corrupt) throw new Error('controller_pending_corrupt');
    if (read.pending[jobId] && !keepFence) {
      delete read.pending[jobId];
      writePending(store, read.pending);
    }
    if (!countUsage) return;
    const ceiling = readCeiling(store, decidedAt);
    if (ceiling.corrupt) throw new Error('controller_usage_corrupt');
    if (attemptId && ceiling.reservations[attemptId]) {
      consumeReservation(ceiling, attemptId, actual);
      // Fully unknown actuals keep the estimate charge and the entry: the
      // fence above retains the marker until explicit reconciliation.
    } else if (!attemptId) {
      // Direct settlements without an attempt have no prior reservation.
      // Attempt settlements with a missing reservation were already charged
      // at admission, so do not add their actuals again on a replay.
      if (actual?.modelCalls != null) ceiling.modelCalls += Math.max(0, actual.modelCalls);
      if (actual && actual.input != null) ceiling.inputTokens += Math.max(0, actual.input);
      if (actual && actual.output != null) ceiling.outputTokens += Math.max(0, actual.output);
    }
    writeCeiling(store, ceiling);
  });
}

function ceilingAllows(used, ceiling, estimate) {
  if (used.modelCalls + 1 > ceiling.maxDailyModelCalls) return false;
  if (used.inputTokens + estimate.inputTokensReserved > ceiling.maxDailyInputTokens) return false;
  if (used.outputTokens + estimate.outputTokensReserved > ceiling.maxDailyOutputTokens) return false;
  return true;
}

// ---- Read-only recovery descriptors (no claims, sends, or mutations) ----

// Recovery descriptors are preparation only: they name unfinished work for
// higher-level orchestration and never claim a send or mutate authority.
function publicationDescriptors(store) {
  const attempts = store.listPublicationAttempts({ states: [...UNFINISHED_PUBLICATION_STATES], limit: PUBLICATION_LIST_MAX });
  const truncated = attempts.length >= PUBLICATION_LIST_MAX;
  return {
    attempts: attempts.map((attempt) => ({
      attemptId: attempt.attemptId,
      lane: attempt.lane,
      pipeline: attempt.pipeline,
      state: attempt.state,
      targetTweetId: attempt.targetTweetId || null,
      candidateKey: attempt.candidateKey || null,
    })),
    // Fail closed: an older unresolved mutation could hide past the cap.
    truncated,
  };
}

function socialDescriptors() {
  const attempts = listSocialAttempts({ limit: SOCIAL_LIST_MAX });
  const truncated = attempts.length >= SOCIAL_LIST_MAX;
  return {
    attempts: attempts
      .filter((attempt) => UNFINISHED_SOCIAL_STATES.has(attempt.state))
      .map((attempt) => ({
        attemptId: attempt.attemptId,
        action: attempt.action,
        targetKey: attempt.targetKey,
        state: attempt.state,
      })),
    // Newest-first listing can miss an older unresolved mutation after many
    // completed actions: a full page fails closed.
    truncated,
  };
}

// Due main-feed selection belongs to the scheduler owner: only approved
// main-feed items (original/quote/thread/repost; engagement replies never
// enter the main feed) that pass scheduler eligibility with a recommendation
// at or before now are described. A bare status=approved row is not enough.
function dueQueueDescriptors(store, now) {
  const approved = store.listApprovedMainFeedItems({ automatedOnly: true, limit: 100 });
  if (!approved.length) return { items: [] };
  const recentPosts = store.listRecentMainFeedPublications({ limit: 20 });
  const decisions = rankMainFeedItems(approved, {
    now,
    recentPosts,
    lastMainFeedPostAt: Number(recentPosts[0]?.publishedAt || 0) || null,
    learnedRules: store.listAcceptedLearnedRules({ limit: 500 }),
  });
  return {
    items: decisions
      .filter((decision) => decision.eligible && decision.recommendedAt != null && Number(decision.recommendedAt) <= now)
      .map((decision) => ({
        queueItemId: decision.item.id,
        pipeline: decision.item.pipeline,
        lane: decision.item.lane,
        candidateKey: decision.item.candidateKey,
        scheduledAt: Number(decision.recommendedAt),
      })),
  };
}

// Authority baseline captured before packet work; rechecked before exposing a
// prepared descriptor or dispatching, so stale or revoked evidence never
// yields a valid result.
function authorityBaseline(store, { persona, rules, leaseActive, now }) {
  const delegation = store.getGrowthOperatorDelegation();
  const health = store.getAccountHealthSummary({ now });
  return {
    delegation: `${delegation?.state}/${delegation?.mode}/${delegation?.revision}`,
    health: health?.health?.state || null,
    leaseActive: Boolean(leaseActive),
    // Same contentVersion prefixes as the admission versions: bare hashes
    // would mismatch on every tick.
    policy: contentVersion('policy', store.getGrowthProductPolicy()),
    persona: contentVersion('persona', persona),
    strategy: contentVersion('rules', rules || []),
  };
}

function recheckAuthority(store, { baseline, persona, rules, now, leaseStatus }) {
  const delegation = store.getGrowthOperatorDelegation();
  if (delegation?.state !== 'running' || delegation?.mode !== 'live') return 'delegation_not_live';
  const health = store.getAccountHealthSummary({ now });
  if (health?.health?.state === 'constrained') return 'account_health_constrained';
  if (baseline) {
    const lease = leaseStatus({ now });
    const current = authorityBaseline(store, { persona, rules, leaseActive: lease?.active, now });
    if (baseline.delegation !== undefined && current.delegation !== baseline.delegation) return 'delegation_changed_during_tick';
    if (baseline.health !== undefined && current.health !== baseline.health) return 'account_health_changed_during_tick';
    if (baseline.leaseActive !== undefined && current.leaseActive !== baseline.leaseActive) return 'operator_lease_changed_during_tick';
    if ((baseline.policy !== undefined && current.policy !== baseline.policy)
      || (baseline.persona !== undefined && current.persona !== baseline.persona)
      || (baseline.strategy !== undefined && current.strategy !== baseline.strategy)) {
      return 'evidence_changed_during_tick';
    }
  }
  return null;
}

function resolveLaneProfile(store, role, profile) {
  // An explicit ephemeral profile names its runtime directly: anything outside
  // the verified lanes is a concrete capability_unavailable with no silent
  // routing to another model or provider — even when the store would also
  // reject the shape. Lane members and saved bindings resolve through the
  // store as before so the pinned adapter is the normalized profile.
  const attempted = profile && typeof profile === 'object' && !Array.isArray(profile)
    ? String(profile.runtime || '')
    : '';
  if (attempted && !LANE_RUNTIMES.has(attempted)) {
    return { error: `capability_unavailable: runtime ${attempted} lacks a verified bounded adapter` };
  }
  let resolution;
  try {
    resolution = store.resolveAiProfileForRole(role, profile ?? null);
  } catch (error) {
    if (attempted) {
      return { error: `capability_unavailable: runtime ${attempted} lacks a verified bounded adapter` };
    }
    return { error: `profile_unconfigured: ${String(error?.message || error)}` };
  }
  if (!resolution?.profile) return { error: 'profile_unconfigured: no AI profile is configured for the controller lane' };
  if (!LANE_RUNTIMES.has(resolution.profile.runtime)) {
    return { error: `capability_unavailable: runtime ${resolution.profile.runtime} lacks a verified bounded adapter` };
  }
  const contract = LANE_CONTRACTS[resolution.profile.runtime];
  if (contract) return { profile: resolution.profile, ...contract };
  // Codex is a supported lane only after its actual adapter preparation has
  // supplied limits and enforcement metadata for this exact job.
  return { profile: resolution.profile, lane: 'codex', strictLimits: null, unsupported: null, enforcement: null };
}

function expectedAccountHandle() {
  // Canonical expectation: operator_readiness.js browserAccountExpected.
  return String(process.env.X_ACCOUNT || 'ham_zax').replace(/^@/, '').toLowerCase();
}

function snapshotFreshness(store, kind, now) {
  const maxAgeMs = (SOURCE_FRESHNESS_MINUTES[kind] || 120) * 60_000;
  let snapshot = null;
  try {
    snapshot = store.getDiscoverSnapshot(kind);
  } catch {
    return { kind, fresh: false, reason: 'snapshot_unavailable' };
  }
  const fetchedAt = Number(snapshot?.fetchedAt || 0);
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    return { kind, fresh: false, reason: snapshot?.error ? 'source_collection_error' : 'snapshot_missing' };
  }
  if (fetchedAt > now + FUTURE_SKEW_MS) return { kind, fresh: false, reason: 'snapshot_future_timestamp' };
  if (now - fetchedAt > maxAgeMs) {
    return { kind, fresh: false, reason: snapshot?.error ? 'source_collection_error' : 'snapshot_stale' };
  }
  return { kind, fresh: true, fetchedAt };
}

function forYouSensorProvenance(store) {
  try {
    const raw = store.getAppState(FOR_YOU_SENSOR_STATE_KEY, null);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Freshness per kind under canonical thresholds. A recorded source error does
// not discard otherwise fresh last-good evidence; it only surfaces when no
// fresh data remains. x_for_you additionally requires matching authenticated
// sensor provenance: observedAt equals the current snapshot time, the
// expected account, and accountVerified true.
function freshSnapshots(store, now) {
  const status = {};
  for (const kind of X_SNAPSHOT_KINDS) status[kind] = snapshotFreshness(store, kind, now);
  if (status.x_for_you.fresh) {
    const sensor = forYouSensorProvenance(store);
    const matches = sensor
      && Number(sensor.observedAt) === status.x_for_you.fetchedAt
      && sensor.accountVerified === true
      && String(sensor.accountHandle || '').replace(/^@/, '').toLowerCase() === expectedAccountHandle();
    if (!matches) {
      status.x_for_you = {
        kind: 'x_for_you',
        fresh: false,
        reason: sensor ? 'sensor_provenance_mismatch' : 'sensor_provenance_missing',
      };
    }
  }
  return status;
}

function assemblePool(store, candidates, { ownHandle, lanes, now }) {
  const items = filterObjectivePool(
    (candidates || []).map((candidate) => ({
      key: candidate.key,
      url: candidate.url || candidate.key,
      text: candidate.text,
      publishedAt: candidate.publishedAt ?? null,
      nicheTags: candidate.nicheTags || [],
      viewsPerHour: candidate.viewsPerHour ?? null,
      engagementsPerHour: candidate.engagementsPerHour ?? null,
      observedMetrics: candidate.observedMetrics || {},
      urgent: candidate.urgent || null,
      hasAction: candidate.hasAction,
      dispositionActive: candidate.dispositionActive,
      blockingAttempt: candidate.blockingAttempt,
    })),
    { ownHandle, lanes },
  );
  return items.map((item) => {
    const { author } = parseStatusUrl(item.url);
    const relationship = author ? relationshipView(store, author) : { tracked: false, stage: null, recentResponses: [] };
    const publishedAt = Number(item.publishedAt);
    const extracted = extractContext(item.observedMetrics);
    return {
      ...item,
      author: author || '',
      breakout: breakoutIdentity(item.urgent),
      relationship,
      context: extracted.context,
      contextTruncated: extracted.truncatedKeys,
      ageMinutes: Number.isFinite(publishedAt) && publishedAt > 0 ? Math.max(0, Math.round((now - publishedAt) / 60000)) : null,
    };
  });
}

// Core accounting completeness: input, output, and call counts must all be
// known before a decision can complete. Cached/reasoning subsets stay
// advisory. wallTimeMs is always measured locally at dispatch.
function usageKnown(usage) {
  return usage.inputTokens != null && usage.outputTokens != null
    && usage.modelCalls != null && usage.toolCalls != null;
}

// Measured adapter counts only: a non-finite or negative count is unknown,
// never a fabricated zero or one.
function measuredCount(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

// One cache-fed tick: gates, then at most one admitted job and one dispatch.
// runtimeExecution carries the ephemeral bounded-adapter execution selection
// (Claive->Codex executables or native codex) for the codex lane only; it is
// never persisted to saved profiles, delegation, or policy. The direct_api
// lane ignores it.
export async function controllerTick({
  now = Date.now(),
  store = storeModule,
  leaseStatus = (options) => getOperatorLeaseStatus(options),
  personaSlice = (consumer) => getPersonaSlice(consumer),
  runStructured = (options) => runStructuredAI(options),
  config = {},
  sessionId = `controller-${randomUUID()}`,
  profile = null,
  runtimeExecution = null,
} = {}) {
  const cfg = { ...CONTROLLER_DEFAULTS, ...config, budget: { ...CONTROLLER_DEFAULTS.budget, ...(config.budget || {}) } };
  const claimant = `${cfg.claimantPrefix}-${sessionId}`.slice(0, 128);
  // Real elapsed time since tick entry: dispatch-time math uses the injected
  // tick timestamp plus this elapsed duration, so synchronous admission and
  // revalidation work is subtracted from the persistent deadline.
  const tickStartReal = Date.now();
  const delegation = store.getGrowthOperatorDelegation();
  if (delegation?.state !== 'running' || delegation?.mode !== 'live') {
    return outcome('blocked', 'delegation_not_live');
  }
  const lease = leaseStatus({ now });
  if (lease?.active) {
    return outcome('coalesced', 'operator_lease_active', { descriptor: { kind: 'operator_lease_active', leaseId: lease.leaseId || null } });
  }
  const health = store.getAccountHealthSummary({ now });
  if (health?.health?.state === 'constrained') {
    return outcome('blocked', 'account_health_constrained');
  }
  const gateBaseline = {
    delegation: `${delegation?.state}/${delegation?.mode}/${delegation?.revision}`,
    health: health?.health?.state || null,
    leaseActive: Boolean(lease?.active),
  };
  const recheckGates = () => recheckAuthority(store, { baseline: gateBaseline, now, leaseStatus });
  const unfinished = publicationDescriptors(store);
  if (unfinished.attempts.length || unfinished.truncated) {
    const authority = recheckGates();
    if (authority) return outcome('blocked', authority);
    return outcome('recovery_required', unfinished.truncated ? 'publication_attempt_list_truncated' : 'unfinished_publication_attempts', {
      descriptor: { kind: 'recover_publication_attempts', attempts: unfinished.attempts, truncated: unfinished.truncated },
    });
  }
  const social = socialDescriptors();
  if (social.attempts.length || social.truncated) {
    const authority = recheckGates();
    if (authority) return outcome('blocked', authority);
    return outcome('recovery_required', social.truncated ? 'social_attempt_list_truncated' : 'unfinished_social_attempts', {
      descriptor: { kind: 'recover_social_attempts', attempts: social.attempts, truncated: social.truncated },
    });
  }
  const dueQueue = dueQueueDescriptors(store, now);
  if (dueQueue.items.length) {
    const authority = recheckGates();
    if (authority) return outcome('blocked', authority);
    return outcome('due_queue', 'due_approved_queue_items', {
      descriptor: { kind: 'claim_due_queue_items', items: dueQueue.items },
    });
  }
  const freshness = freshSnapshots(store, now);
  const freshKinds = new Set(Object.values(freshness).filter((entry) => entry.fresh).map((entry) => entry.kind));
  if (!freshKinds.size) {
    const reasons = Object.values(freshness).map((entry) => entry.reason);
    return outcome('observation_required', reasons.includes('source_collection_error') ? 'source_collection_error' : 'no_current_source_snapshot', {
      descriptor: {
        kind: 'stale_observations',
        freshness: Object.fromEntries(Object.values(freshness).map((entry) => [entry.kind, entry.reason])),
      },
    });
  }
  let lane = resolveLaneProfile(store, cfg.role, profile);
  if (lane.error) {
    return outcome('blocked', lane.error, { lane: null, strictLimits: null, unsupported: null, enforcement: null });
  }
  // Codex metadata stays unknown until the adapter has prepared this exact
  // job. Earlier exits do not invent an unsupported-limit contract.
  let laneMeta = {
    lane: lane.lane,
    strictLimits: lane.strictLimits,
    unsupported: Array.isArray(lane.unsupported) ? [...lane.unsupported] : null,
    enforcement: lane.enforcement ? { ...lane.enforcement } : null,
  };
  const out = (status, reason, extra = {}) => outcome(status, reason, { ...laneMeta, ...extra });
  let scoutInput;
  try {
    scoutInput = readScoutInput(store, { now });
  } catch (error) {
    return out('blocked', `scout_input_unavailable: ${String(error?.message || error).slice(0, 200)}`);
  }
  if (!scoutInput.candidates.length) {
    return out('observation_required', 'empty_candidate_cache');
  }
  const justified = new Set();
  for (const candidate of scoutInput.candidates) {
    const kinds = store.getCandidateSourceKinds(candidate.key);
    if (kinds.some((kind) => freshKinds.has(kind))) justified.add(candidate.key);
  }
  if (!justified.size) {
    return out('observation_required', 'no_currently_observed_candidates');
  }
  // The initial recovery sync runs inside one synchronous transaction: its
  // global receipt/pending/usage writes must not interleave with another
  // process's admission transaction and silently overwrite reservations.
  let sync;
  try {
    sync = storeTx(store, () => syncPendingMarkers(store, now));
  } catch (error) {
    return out('blocked', `controller_state_sync_failed: ${String(error?.message || error).slice(0, 200)}`);
  }
  if (sync.stateCorrupt || sync.usageCorrupt) {
    return out('blocked', sync.stateCorrupt ? 'controller_pending_state_corrupt' : 'controller_usage_state_corrupt', {
      descriptor: {
        kind: 'controller_state_corrupt',
        stateCorrupt: Boolean(sync.stateCorrupt),
        usageCorrupt: Boolean(sync.usageCorrupt),
      },
    });
  }
  if (sync.fences.length) {
    // Uncertain (unknown usage, vanished row) fences report unresolved with
    // recovery diagnostics; live work reports in progress. Neither retries.
    const uncertain = sync.fences.some((fence) => fence.unresolved || fence.hasUnknownUsage || fence.jobMissing);
    return out(uncertain ? 'unresolved' : 'job_in_progress', uncertain ? 'uncertain_usage_fence' : 'in_flight_job_fence', {
      jobId: sync.fences[0].jobId,
      descriptor: { kind: uncertain ? 'uncertain_usage_fence' : 'in_flight_job_fence', fences: sync.fences },
    });
  }
  const policy = store.getGrowthProductPolicy();
  const lanes = lanesOf(policy);
  const pool = assemblePool(store, scoutInput.candidates.filter((candidate) => justified.has(candidate.key)), {
    ownHandle: scoutInput.ownHandle,
    lanes,
    now,
  });
  if (!pool.length) {
    return out('no_eligible_work', 'no_objective_eligible_candidates');
  }
  const persona = personaSlice('engagement');
  const rules = store.listAcceptedLearnedRules({});
  const personaSnapshot = personaSnapshotOf(persona, cfg);
  const ruleVersions = (rules || []).map(ruleVersionOf);
  const versions = {
    source: contentVersion('scout', [...justified].sort()),
    persona: contentVersion('persona', personaSnapshot),
    policy: contentVersion('policy', policy),
    strategy: contentVersion('rules', ruleVersions),
  };
  const evidenceBaseline = {
    ...gateBaseline,
    policy: versions.policy,
    persona: versions.persona,
    strategy: versions.strategy,
  };
  const receipts = readReceipts(store);
  const fresh = [];
  const skippedKeys = [];
  for (const item of pool) {
    const fp = candidateFingerprint(item, versions);
    const receipt = receipts[item.key];
    if (receipt && receipt.fp === fp && completedReceiptCoversKey(receipt, item.key)) {
      skippedKeys.push(item.key);
      continue;
    }
    fresh.push({ ...item, fp });
  }
  if (!fresh.length) {
    const jobIds = [...new Set(skippedKeys.map((key) => receipts[key]?.jobId).filter(Boolean))];
    return out('reused', skippedKeys.length ? 'all_candidates_already_judged' : 'no_eligible_work', {
      jobId: jobIds[0] || null,
      result: null,
      descriptor: jobIds.length ? { kind: 'prior_decisions', jobIds } : null,
    });
  }
  const scoutResult = buildScoutCards({ ...scoutInput, limit: 50 });
  const rest = scoutResult.pace?.activity?.rest === true;
  const ranked = scoutResult.cards
    .filter((card) => card.tier === 'T1')
    .map((card) => card.candidateKey);
  const shortlist = selectShortlist({ rankedKeys: ranked, pool: fresh, config: cfg, rest });
  const packet = buildDecisionPacket({ shortlist, store, persona, rules, config: cfg, now, rest });
  if (!packet.semanticInput.candidates.length) {
    const missing = (packet.semanticInput.meta.missingContext || []).length;
    return out(missing ? 'deferred_missing_context' : 'no_eligible_work', missing ? 'missing_essential_context' : 'no_packet_candidates', {
      descriptor: missing ? { kind: 'missing_essential_context', items: packet.semanticInput.meta.missingContext } : null,
    });
  }
  // Prepare the exact job contract before any claim, reservation, or dispatch.
  // Direct_api sizes its provider wire; Codex uses the bounded adapter's own
  // sizing and capability metadata. Neither estimate is provider token usage.
  const laneIsCodex = lane.lane === 'codex';
  const wireSizer = laneIsCodex
    ? (target) => measureCodexPacket(target, lane.profile, cfg.budget)
    : (target) => measureWirePacket(target, lane.profile, cfg.budget.maxOutputTokens);
  let reduced;
  try {
    reduced = reducePacket(packet, cfg.budget, wireSizer);
  } catch (error) {
    return out('blocked', `wire_packet_unmeasurable: ${String(error?.code || error?.message || error).slice(0, 200)}`);
  }
  if (!reduced.fits) {
    return out('deferred_oversize', 'packet_exceeds_context_budget', {
      descriptor: {
        kind: 'packet_oversize',
        bytes: reduced.bytes,
        estimatedInputTokens: reduced.estimate,
        explorationRetained: reduced.packet.semanticInput.meta.explorationKeys,
      },
    });
  }
  if (!reduced.packet.semanticInput.candidates.length) {
    return out('no_eligible_work', 'reduction_emptied_shortlist');
  }
  if (laneIsCodex) {
    const prepared = reduced.sizing;
    if (!Array.isArray(prepared?.unsupported) || !prepared?.metadata?.enforcement) {
      return out('blocked', 'bounded_adapter_preparation_incomplete');
    }
    lane = {
      ...lane,
      strictLimits: prepared.unsupported.length === 0,
      unsupported: [...prepared.unsupported],
      enforcement: prepared.metadata.enforcement,
    };
    laneMeta = {
      lane: lane.lane,
      strictLimits: lane.strictLimits,
      unsupported: [...lane.unsupported],
      enforcement: { ...lane.enforcement },
    };
  }
  // One synchronous transaction for the final pending recheck, daily budget
  // check, admission, claim, reservation, and the durable global reservation
  // charge: across two processes, the second tick blocks in BEGIN IMMEDIATE
  // and then sees the first tick's marker. Every dispatched attempt is
  // charged before any request, so a crash never loses the count; settlement
  // reconciles the charge to actual exactly once.
  const estimate = { input: reduced.estimate, output: cfg.budget.maxOutputTokens };
  const resolvedCeiling = resolveCeiling(cfg.ceiling);
  const packetKeys = reduced.packet.semanticInput.candidates.map((item) => item.key);
  const packetFps = () => Object.fromEntries(
    reduced.packet.semanticInput.candidates.map((item) => [item.key, candidateFingerprint(item, versions)]),
  );
  let admission;
  try {
    admission = storeTx(store, () => {
      const inner = syncPendingMarkers(store, now);
      if (inner.stateCorrupt || inner.usageCorrupt) return { status: 'state_corrupt', inner };
      if (inner.fences.length) return { status: 'fenced', fences: inner.fences };
      const used = readCeiling(store, now);
      if (used.corrupt) return { status: 'state_corrupt', usage: true };
      if (!ceilingAllows(used, resolvedCeiling, {
        inputTokensReserved: reduced.estimate,
        outputTokensReserved: cfg.budget.maxOutputTokens,
      })) {
        return { status: 'ceiling_reached' };
      }
      let admitted;
      try {
        admitted = admitJob({
          kind: cfg.kind,
          semanticInput: reduced.packet.semanticInput,
          observationMetadata: reduced.packet.observationMetadata,
          versions,
          // Labeled accounted admission: direct_api stays strict with no
          // unsupported limits; the codex lane admits with its actual
          // unenforceable boundaries named on the budget.
          budget: { ...cfg.budget, unsupported: [...lane.unsupported] },
          candidateCount: reduced.packet.semanticInput.candidates.length,
          estimatedInputTokens: reduced.estimate,
          strictLimits: lane.strictLimits,
        });
      } catch (error) {
        return {
          status: 'admission_failed',
          code: String(error?.code || 'unknown'),
          message: String(error?.message || error).slice(0, 300),
        };
      }
      const job = admitted.job;
      if (admitted.reused) {
        if (job.terminalOutcome) {
          if (job.usage.hasUnknownUsage) {
            // An uncertain decision is never fresh capacity: ensure the
            // global fence instead of reusing it.
            const read = readPending(store);
            if (!read.corrupt && !read.pending[job.id]) {
              read.pending[job.id] = { keys: packetFps(), admittedAt: now, uncertain: true };
              writePending(store, read.pending);
            }
            return { status: 'fenced', fences: [{ ...fenceEntry(job.id, { keys: packetFps() }, job, listJobAttempts(job.id), now), unresolved: true }], job };
          }
          const receipts = readReceipts(store);
          for (const [key, receipt] of settlementReceiptItems(
            reduced.packet.semanticInput.candidates.map((item) => ({ key: item.key, fp: candidateFingerprint(item, versions) })),
            job.terminalOutcome, job.result, job.id, job.decidedAt || now,
          )) {
            receipts[key] = receipt;
          }
          writeReceipts(store, receipts);
          return { status: 'reused', job };
        }
        return { status: 'fenced', fences: [fenceEntry(job.id, { keys: packetFps() }, job, listJobAttempts(job.id), now)], job };
      }
      let claimed;
      try {
        claimed = claimJob(job.id, { claimant, now });
      } catch (error) {
        return { status: 'claim_race', code: String(error?.code || ''), job };
      }
      const pendingRead = readPending(store);
      if (pendingRead.corrupt) return { status: 'state_corrupt', pending: true, job };
      pendingRead.pending[job.id] = { keys: packetFps(), admittedAt: now };
      writePending(store, pendingRead.pending);
      let attempt;
      try {
        attempt = reserveAttempt(job.id, {
          claimant,
          inputTokensReserved: reduced.estimate,
          outputTokensReserved: cfg.budget.maxOutputTokens,
          toolCallsReserved: 0,
          now,
        });
      } catch (error) {
        // No inference happened: settle terminal and release the marker so a
        // failed reservation cannot strand a claimed job behind a fence.
        try {
          settleJobTerminal(job.id, { claimant, outcome: 'blocked', reason: `reserve_failed: ${String(error?.code || 'unknown')}`, now });
        } catch {}
        try {
          const reread = readPending(store);
          if (!reread.corrupt && reread.pending[job.id]) {
            delete reread.pending[job.id];
            writePending(store, reread.pending);
          }
        } catch {}
        return { status: 'reserve_race', code: String(error?.code || ''), message: String(error?.message || error).slice(0, 300), job };
      }
      const charged = readCeiling(store, now);
      if (charged.corrupt) return { status: 'state_corrupt', usage: true, job, attempt };
      const modelCallsReserved = 1;
      charged.modelCalls += modelCallsReserved;
      charged.inputTokens += reduced.estimate;
      charged.outputTokens += cfg.budget.maxOutputTokens;
      charged.reservations[attempt.id] = { jobId: job.id, modelCalls: modelCallsReserved, input: reduced.estimate, output: cfg.budget.maxOutputTokens };
      writeCeiling(store, charged);
      return { status: 'proceed', job: claimed, attempt };
    });
  } catch (error) {
    return out('blocked', `admission_transaction_failed: ${String(error?.message || error).slice(0, 200)}`);
  }
  if (!admission || admission.status === 'state_corrupt') {
    const usageCorrupt = Boolean(admission?.usage || admission?.inner?.usageCorrupt);
    const pendingCorrupt = Boolean(admission?.pending || admission?.inner?.stateCorrupt);
    const reason = usageCorrupt ? 'controller_usage_state_corrupt'
      : pendingCorrupt ? 'controller_pending_state_corrupt' : 'controller_state_corrupt';
    return out('blocked', reason, {
      descriptor: { kind: 'controller_state_corrupt' },
    });
  }
  if (admission.status === 'ceiling_reached') {
    return out('ceiling_reached', 'controller_daily_usage_ceiling');
  }
  if (admission.status === 'admission_failed') {
    return out('blocked', `admission_failed: ${admission.code} ${admission.message}`.slice(0, 400));
  }
  if (admission.status === 'fenced') {
    const uncertain = (admission.fences || []).some((fence) => fence.unresolved || fence.hasUnknownUsage || fence.jobMissing);
    return out(uncertain ? 'unresolved' : 'job_in_progress', uncertain ? 'uncertain_usage_fence' : 'job_already_admitted', {
      jobId: admission.job?.id || admission.fences?.[0]?.jobId || null,
      descriptor: { kind: uncertain ? 'uncertain_usage_fence' : 'in_flight_job_fence', fences: admission.fences },
    });
  }
  if (admission.status === 'claim_race') {
    return { ...claimRaceOutcome(admission.job.id, admission.code), ...laneMeta };
  }
  if (admission.status === 'reserve_race') {
    return { ...reserveRaceOutcome(admission.job.id, admission.code, admission.message), ...laneMeta };
  }
  if (admission.status === 'reused') {
    return out('reused', `reused_${admission.job.status}`, { jobId: admission.job.id, result: admission.job.result });
  }
  const job = admission.job;
  const attempt = admission.attempt;
  const keys = packetKeys;
  // Authority recheck before dispatch: revoked delegation, changed evidence,
  // constrained health, or a competing lease aborts the claimed job without
  // any request. No inference happened, so the reservation is released.
  const revoked = recheckAuthority(store, {
    baseline: evidenceBaseline,
    persona: personaSnapshotOf(personaSlice('engagement'), cfg),
    rules: store.listAcceptedLearnedRules({}).map(ruleVersionOf),
    now,
    leaseStatus,
  });
  if (revoked) {
    abortClaimedJob(store, {
      job, attempt, claimant, estimate, now,
      reason: revoked,
      items: keys.map((key) => ({ key, fp: fingerprintForKey(reduced.packet, versions, key) })),
    });
    return out('blocked', revoked, { jobId: job.id });
  }
  // Exact remaining persistent deadline at dispatch: never a floor above it,
  // stop instead. The clock stays consistent with the injected tick time plus
  // real elapsed duration since tick entry.
  const dispatchElapsed = Math.max(0, Date.now() - tickStartReal);
  const effectiveNow = now + dispatchElapsed;
  const remaining = (job.deadlineAt ?? effectiveNow) - effectiveNow;
  if (!(remaining > 0)) {
    abortClaimedJob(store, {
      job, attempt, claimant, estimate, now,
      reason: 'job_deadline_passed',
      items: keys.map((key) => ({ key, fp: fingerprintForKey(reduced.packet, versions, key) })),
    });
    return out('blocked', 'job_deadline_passed', { jobId: job.id });
  }
  const timeoutMs = Math.min(remaining, 120000, cfg.budget.maxWallTimeMs);
  const receiptId = `controller-${job.id}-a${attempt.seq}`;
  const startedAt = Date.now();
  let response;
  try {
    response = await runStructured({
      role: cfg.role,
      // The preflight-resolved profile pins the adapter: the runtime must not
      // re-resolve a different adapter after capability admission.
      profile: lane.profile,
      prompt: renderDecisionPrompt(reduced.packet),
      schema: CONTROLLER_DECISION_SCHEMA,
      timeoutMs,
      metadata: { lane: 'semantic_controller', jobId: job.id, selectedLane: lane.lane, strictLimits: lane.strictLimits, unsupported: [...lane.unsupported] },
      allowRepair: false,
      allowFallback: false,
      maxOutputTokens: cfg.budget.maxOutputTokens,
      transport: cfg.transport,
      // The bounded codex adapter is selected inside ai_runtime only on this
      // job contract and ephemeral runtimeExecution. Pass the full budget so
      // adapter preparation and admission evaluate the same limits.
      ...(laneIsCodex ? { boundedSemanticJob: { budget: { ...cfg.budget } }, runtimeExecution } : {}),
    });
  } catch (error) {
    return settleFailure(store, { jobId: job.id, attemptId: attempt.id, claimant, receiptId, startedAt, error, items: reduced.packet.semanticInput.candidates, versions, estimate, now, laneMeta });
  }
  // Settlement must never throw out of the tick: unexpected accounting errors
  // retain the reservation and marker behind an explicit unresolved fence.
  const settleItems = keys.map((key) => ({ key, fp: fingerprintForKey(reduced.packet, versions, key) }));
  const wallTimeMs = Math.max(0, Date.now() - startedAt);
  const execution = response?.execution || {};
  // Measured adapter counts, never fabricated: the direct_api lane performs
  // exactly one adapter request with no tools under allowRepair/allowFallback
  // false, so 1/0 there is structural. The codex lane must report measured
  // model/tool counts; missing counts stay unknown and fence the next tick.
  const reportedUsage = {
    inputTokens: execution.inputTokens ?? null,
    cachedInputTokens: execution.cachedInputTokens ?? null,
    outputTokens: execution.outputTokens ?? null,
    reasoningTokens: execution.reasoningTokens ?? null,
    modelCalls: measuredCount(execution.modelCalls) ?? (laneIsCodex ? null : 1),
    toolCalls: measuredCount(execution.toolCalls) ?? (laneIsCodex ? null : 0),
    wallTimeMs,
  };
  // Keep measured model requests distinct from the one runtime-adapter call
  // this controller made. An unmeasured Codex count remains null publicly.
  const modelCallsReported = reportedUsage.modelCalls;
  let settled;
  try {
    settled = settleAttempt(attempt.id, { claimant, usage: reportedUsage, receiptId });
  } catch (error) {
    try {
      markAttemptInterrupted(attempt.id, { claimant, reason: `settlement_failed: ${String(error?.code || 'unknown')}` });
    } catch {}
    return out('unresolved', `settlement_failed_fenced: ${String(error?.code || 'unknown')}`, {
      jobId: job.id,
      attemptId: attempt.id,
      modelCalls: modelCallsReported,
      adapterInvocations: 1,
      descriptor: { kind: 'uncertain_usage_fence', fences: [fenceEntry(job.id, { keys: packetFps() }, getJobOrNull(job.id), listJobAttempts(job.id), Date.now())] },
    });
  }
  const actual = {
    modelCalls: settled.attempt.actual.modelCalls ?? null,
    input: settled.attempt.actual.inputTokens ?? null,
    output: settled.attempt.actual.outputTokens ?? null,
  };
  const settleTerminal = (terminalInput) => {
    const terminal = settleJobTerminal(job.id, terminalInput);
    persistSettlement(store, {
      items: settleItems,
      jobId: job.id,
      attemptId: attempt.id,
      estimate,
      actual,
      outcome: terminalInput.outcome,
      result: terminal.result,
      decidedAt: now,
    });
    return terminal;
  };
  if (!usageKnown(settled.attempt.actual)) {
    // Advisory only: unknown provider usage can never complete a decision.
    const checked = validateDecision(response?.output, { keys, lanes });
    let terminal;
    try {
      terminal = settleTerminal({
        claimant,
        outcome: 'unresolved',
        reason: 'provider_usage_unknown_advisory_only',
        result: {
          preparationOnly: true,
          advisory: true,
          ...(checked.ok ? mapTerminal(response.output).result : {}),
          usageUnknown: true,
        },
      });
    } catch (error) {
      return out('unresolved', `settlement_failed_fenced: ${String(error?.code || error?.message || 'unknown')}`.slice(0, 300), {
        jobId: job.id,
        attemptId: attempt.id,
        modelCalls: modelCallsReported,
        adapterInvocations: 1,
        descriptor: { kind: 'uncertain_usage_fence', fences: [fenceEntry(job.id, { keys: packetFps() }, getJobOrNull(job.id), listJobAttempts(job.id), Date.now())] },
      });
    }
    return out('unresolved', 'provider_usage_unknown_advisory_only', {
      jobId: job.id, attemptId: attempt.id, modelCalls: modelCallsReported, adapterInvocations: 1, result: terminal.result,
    });
  }
  // Terminal budget stop on measured excess. A single response may exceed the
  // unenforceable codex output cap (or, on any lane, the call/tool budget):
  // settleAttempt above already recorded the excess as genuine usage and the
  // ceiling reconciliation charges it, so this stop records and halts instead
  // of completing as a normal decision or hiding the overage. Cumulative
  // overage stops the next wake through the charged daily ceiling.
  const overOutput = settled.attempt.actual.outputTokens > cfg.budget.maxOutputTokens;
  const overCalls = settled.attempt.actual.modelCalls > cfg.budget.maxModelCalls;
  const overTools = (settled.attempt.actual.toolCalls ?? 0) > (cfg.budget.maxToolCalls ?? 0);
  if (overOutput || overCalls || overTools) {
    const exceeded = [
      overOutput ? `output ${settled.attempt.actual.outputTokens} > max ${cfg.budget.maxOutputTokens}` : null,
      overCalls ? `modelCalls ${settled.attempt.actual.modelCalls} > max ${cfg.budget.maxModelCalls}` : null,
      overTools ? `toolCalls ${settled.attempt.actual.toolCalls} > max ${cfg.budget.maxToolCalls ?? 0}` : null,
    ].filter(Boolean).join('; ');
    let terminal;
    try {
      terminal = settleTerminal({
        claimant,
        outcome: 'blocked',
        reason: `budget_exceeded: ${exceeded}`,
        result: {
          preparationOnly: true,
          budgetExceeded: exceeded,
          usage: {
            inputTokens: settled.attempt.actual.inputTokens,
            outputTokens: settled.attempt.actual.outputTokens,
            modelCalls: settled.attempt.actual.modelCalls,
            toolCalls: settled.attempt.actual.toolCalls,
          },
        },
      });
    } catch (error) {
      return out('unresolved', `settlement_failed_fenced: ${String(error?.code || error?.message || 'unknown')}`.slice(0, 300), {
        jobId: job.id,
        attemptId: attempt.id,
        modelCalls: modelCallsReported,
        adapterInvocations: 1,
        descriptor: { kind: 'uncertain_usage_fence', fences: [fenceEntry(job.id, { keys: packetFps() }, getJobOrNull(job.id), listJobAttempts(job.id), Date.now())] },
      });
    }
    return out('blocked', `budget_exceeded: ${exceeded}`, {
      jobId: job.id, attemptId: attempt.id, modelCalls: modelCallsReported, adapterInvocations: 1, result: terminal.result,
    });
  }
  const checked = validateDecision(response?.output, { keys, lanes });
  if (!checked.ok) {
    let terminal;
    try {
      terminal = settleTerminal({ claimant, outcome: 'blocked', reason: `invalid_decision: ${checked.reason}` });
    } catch (error) {
      return out('unresolved', `settlement_failed_fenced: ${String(error?.code || error?.message || 'unknown')}`.slice(0, 300), {
        jobId: job.id,
        attemptId: attempt.id,
        modelCalls: modelCallsReported,
        adapterInvocations: 1,
        descriptor: { kind: 'uncertain_usage_fence', fences: [fenceEntry(job.id, { keys: packetFps() }, getJobOrNull(job.id), listJobAttempts(job.id), Date.now())] },
      });
    }
    return out('blocked', `invalid_decision: ${checked.reason}`, {
      jobId: job.id, attemptId: attempt.id, modelCalls: modelCallsReported, adapterInvocations: 1, result: terminal.result,
    });
  }
  const mapped = mapTerminal(response.output);
  let terminal;
  try {
    terminal = settleTerminal({
      claimant,
      outcome: mapped.outcome,
      reason: mapped.reason,
      ...(mapped.result.revisitCondition ? { revisitCondition: mapped.result.revisitCondition } : {}),
      result: mapped.result,
    });
  } catch (error) {
    return out('unresolved', `settlement_failed_fenced: ${String(error?.code || error?.message || 'unknown')}`.slice(0, 300), {
      jobId: job.id,
      attemptId: attempt.id,
      modelCalls: modelCallsReported,
      adapterInvocations: 1,
      descriptor: { kind: 'uncertain_usage_fence', fences: [fenceEntry(job.id, { keys: packetFps() }, getJobOrNull(job.id), listJobAttempts(job.id), Date.now())] },
    });
  }
  return out(mapped.outcome, mapped.reason, {
    jobId: job.id, attemptId: attempt.id, modelCalls: modelCallsReported, adapterInvocations: 1, result: terminal.result,
  });
}

function getJobOrNull(jobId) {
  try {
    return getJob(jobId);
  } catch {
    return null;
  }
}

// Abort a claimed job before any inference: settle terminal without usage and
// release the pre-request reservation, so the abort leaves no fence behind.
function abortClaimedJob(store, { job, attempt, claimant, estimate, now, reason, items }) {
  try {
    storeTx(store, () => {
      const ceiling = readCeiling(store, now);
      if (!ceiling.corrupt && attempt && ceiling.reservations[attempt.id]) {
        const entry = ceiling.reservations[attempt.id];
        const modelCallsReserved = Number.isSafeInteger(entry.modelCalls) && entry.modelCalls >= 0 ? entry.modelCalls : 1;
        ceiling.modelCalls = Math.max(0, ceiling.modelCalls - modelCallsReserved);
        ceiling.inputTokens = Math.max(0, ceiling.inputTokens - entry.input);
        ceiling.outputTokens = Math.max(0, ceiling.outputTokens - entry.output);
        delete ceiling.reservations[attempt.id];
        writeCeiling(store, ceiling);
      }
    });
  } catch {}
  try {
    settleJobTerminal(job.id, { claimant, outcome: 'blocked', reason, now });
  } catch {}
  try {
    persistSettlement(store, { items, jobId: job.id, outcome: 'blocked', decidedAt: now, countUsage: false });
  } catch {}
}

function packetByKey(packet, key) {
  return packet.semanticInput.candidates.find((item) => item.key === key) || { key };
}

function fingerprintForKey(packet, versions, key) {
  return candidateFingerprint(packetByKey(packet, key), versions);
}

function staticFenceDescriptor(jobId) {
  let job = null;
  try {
    job = getJob(jobId);
  } catch {
    return { kind: 'in_flight_job_fence', jobId };
  }
  const attempts = listJobAttempts(jobId);
  return {
    kind: 'in_flight_job_fence',
    jobId,
    deadlinePassed: job.deadlineAt != null && Date.now() >= job.deadlineAt,
    hasUnknownUsage: job.usage.hasUnknownUsage,
    reservedAttempts: attempts.filter((attempt) => attempt.status === 'reserved').length,
  };
}

function claimRaceOutcome(jobId, code) {
  if (code === 'semantic_job_terminal' || code === 'semantic_job_already_claimed') {
    return outcome('job_in_progress', 'claim_lost_to_concurrent_tick', {
      jobId,
      descriptor: staticFenceDescriptor(jobId),
    });
  }
  return outcome('blocked', `claim_failed: ${code || 'unknown'}`);
}

function reserveRaceOutcome(jobId, code, message) {
  if (code === 'semantic_job_uncertain_attempt') {
    return outcome('job_in_progress', 'uncertain_attempt_fence', {
      jobId,
      descriptor: staticFenceDescriptor(jobId),
    });
  }
  if (code === 'semantic_job_budget_exhausted' || code === 'semantic_job_wall_exhausted') {
    return outcome('blocked', message || 'budget_exhausted');
  }
  return outcome('blocked', `reserve_failed: ${code || 'unknown'}`);
}

async function settleFailure(store, { jobId, attemptId, claimant, receiptId, startedAt, error, items, versions, estimate, now, laneMeta = null }) {
  const wallTimeMs = Math.max(0, Date.now() - startedAt);
  const code = String(error?.code || 'runtime_error');
  const detail = String(error?.message || error).slice(0, 300);
  const laneIsCodex = laneMeta?.lane === 'codex';
  // Verified provider contract (ai_runtime invalidOutputErrorWithUsage): a JSON
  // or semantic validation failure carries failedAttemptUsage measured from
  // the completed response, in the same number-or-null shape as success
  // usage. When present, exactly one request demonstrably completed, so the
  // known fields settle instead of being discarded; any null field keeps the
  // unknown fence. Transport errors carry no receipt and stay fully unknown.
  // Call counts are measured only: the direct_api lane structurally performed
  // one request with no tools, while the codex lane fences unknown counts.
  const failedUsage = error?.failedAttemptUsage && typeof error.failedAttemptUsage === 'object'
    ? error.failedAttemptUsage
    : null;
  // A direct API schema failure can only happen after its single request
  // returned. Keep that structural request count even when token usage was
  // not attached to the error. Codex counts must remain adapter-measured.
  const invalidDirectResponse = !laneIsCodex && code === 'invalid_structured_output';
  let current = 'unknown';
  try {
    current = getAttempt(attemptId).status;
  } catch {}
  if (current === 'reserved') {
    try {
      settleAttempt(attemptId, {
        claimant,
        usage: failedUsage ? {
          inputTokens: failedUsage.inputTokens ?? null,
          cachedInputTokens: failedUsage.cachedInputTokens ?? null,
          outputTokens: failedUsage.outputTokens ?? null,
          reasoningTokens: failedUsage.reasoningTokens ?? null,
          modelCalls: measuredCount(failedUsage.modelCalls) ?? (laneIsCodex ? null : 1),
          toolCalls: measuredCount(failedUsage.toolCalls) ?? (laneIsCodex ? null : 0),
          wallTimeMs,
        } : {
          inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null,
          modelCalls: invalidDirectResponse ? 1 : null,
          toolCalls: invalidDirectResponse ? 0 : null,
          wallTimeMs,
        },
        receiptId: `${receiptId}-failed`,
      });
    } catch {
      try {
        markAttemptInterrupted(attemptId, { claimant, reason: `dispatch_failed: ${code}` });
      } catch {}
    }
  }
  let usageUnknown = true;
  try { usageUnknown = Boolean(getJob(jobId).usage.hasUnknownUsage); } catch {}
  let terminal = null;
  try {
    terminal = settleJobTerminal(jobId, {
      claimant,
      outcome: 'unresolved',
      reason: `dispatch_failed: ${code} ${detail}`.slice(0, 1000),
      result: {
        preparationOnly: true,
        error: code,
        failingAttempt: attemptId,
        ...(usageUnknown ? { advisory: true, usageUnknown: true } : {}),
      },
    });
  } catch {}
  // Reconcile whatever the failure receipt settled, field by field: known
  // usage charges actuals to the daily ledger instead of keeping the
  // estimate, while any unknown field keeps its charge and the global fence
  // until explicit reconciliation.
  let failedActual = null;
  try {
    const settledAttempt = getAttempt(attemptId);
    const settledUsage = settledAttempt.actual || {};
    failedActual = {
      modelCalls: settledUsage.modelCalls ?? null,
      input: settledUsage.inputTokens ?? null,
      output: settledUsage.outputTokens ?? null,
    };
  } catch {}
  if (terminal) {
    try {
      persistSettlement(store, {
        items: items.map((item) => ({ key: item.key, fp: candidateFingerprint(item, versions) })),
        jobId,
        attemptId,
        estimate,
        actual: failedActual,
        outcome: 'unresolved',
        result: terminal?.result,
        decidedAt: now,
      });
    } catch {}
  }
  let modelCalls = null;
  try { modelCalls = measuredCount(getAttempt(attemptId).actual.modelCalls); } catch {}
  return outcome('unresolved', `dispatch_failed: ${code}`, {
    ...(laneMeta || {}),
    jobId, attemptId, modelCalls, adapterInvocations: 1, result: terminal?.result || null,
  });
}
