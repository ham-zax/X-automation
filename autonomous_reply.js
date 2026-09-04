import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeBehaviorDecision } from './behavior.js';
import { applyWriterOutput, buildWriterPacket, createDraftScaffold, scoreDraft } from './drafting.js';
import { sendAutonomousEngagementReply } from './pipeline.js';
import { assessStrategicRelevance } from './strategy.js';
import { generateWriterOutput } from './writer_runtime.js';
import {
  claimAutonomousReplyDecision,
  getAccountHealthSummary,
  getAutonomousReplyDecisionForTarget,
  getAutonomousReplyGrantState,
  getAutonomousReplyRuntimeState,
  getCandidate,
  getDraftByCandidate,
  getRelationshipProfile,
  hasCandidateAction,
  listAutonomousReplyDecisions,
  listEngagementItems,
  listRecentOurConversationPosts,
  listRecentPublishedContent,
  listRelationshipEvents,
  recordAutonomousReplyDecision,
  saveAutonomousReplyGrantState,
  saveAutonomousReplyRuntimeState,
  saveDraft,
  saveQueueItem,
  updateAutonomousReplyDecision,
} from './store.js';

export const AUTONOMOUS_REPLY_SOURCE_CLASSES = Object.freeze(['active', 'momentum', 'normal']);
export const AUTONOMOUS_REPLY_INTENTS = Object.freeze([
  'technical_insight',
  'useful_question',
  'constructive_feedback',
  'caveat_edge_case',
  'verified_correction',
  'comparison',
  'synthesis',
  'resource_pointer',
  'social_reaction',
]);
export const AUTONOMOUS_REPLY_TONES = Object.freeze(['direct', 'warm', 'conversational', 'light_humor', 'dry_wit']);
export const AUTONOMOUS_REPLY_MIN_REFRESH_MINUTES = 5;
const AUTONOMOUS_COLD_PRIORITY_MIN = 60;
const AUTONOMOUS_ACTIVE_PRIORITY_MIN = 40;
const HUMOR_TONES = new Set(['light_humor', 'dry_wit']);

const ARCHETYPE_TO_INTENT = Object.freeze({
  implementation_detail: 'technical_insight',
  benchmark_or_result: 'technical_insight',
  caveat_or_edge_case: 'caveat_edge_case',
  comparison: 'comparison',
  correction: 'verified_correction',
  independent_judgment: 'constructive_feedback',
  informed_question: 'useful_question',
  synthesis: 'synthesis',
  reproduction: 'technical_insight',
  personal_experience: 'technical_insight',
  direct_answer: 'social_reaction',
  direct_technical_answer: 'technical_insight',
  status_response: 'social_reaction',
  agreement: 'social_reaction',
  gratitude: 'social_reaction',
  support: 'social_reaction',
  celebration: 'social_reaction',
  enthusiasm: 'social_reaction',
  humor: 'social_reaction',
  social_observation: 'social_reaction',
  de_escalation: 'social_reaction',
  relationship_callback: 'social_reaction',
});

function boundedReason(code, reason) {
  return { code: String(code || 'UNKNOWN'), reason: String(reason || '').slice(0, 500) };
}

function defaultGrant() {
  return {
    state: 'stopped',
    mode: 'dry_run',
    allowedSources: [...AUTONOMOUS_REPLY_SOURCE_CLASSES],
    allowedIntents: [...AUTONOMOUS_REPLY_INTENTS],
    allowedTones: ['direct', 'warm', 'conversational'],
    humorAllowed: false,
    liveBudget: null,
    budgetUsed: 0,
    refreshMinutes: AUTONOMOUS_REPLY_MIN_REFRESH_MINUTES,
    revision: 0,
    updatedAt: null,
    startedAt: null,
    pausedAt: null,
    stoppedAt: null,
    discoveryWatermarkAt: null,
  };
}

function defaultRuntime() {
  return {
    lastAttemptAt: null,
    lastSuccessfulRefreshAt: null,
    nextExpectedRefreshAt: null,
    lastError: '',
    lastDecisionCounts: { sent: 0, review: 0, skipped: 0 },
  };
}

function enumList(value, allowed, fallback) {
  const input = value === undefined ? fallback : value;
  if (!Array.isArray(input)) throw new Error('Autonomous reply selections must be arrays.');
  const selected = [...new Set(input.map((item) => String(item)))];
  const invalid = selected.filter((item) => !allowed.includes(item));
  if (invalid.length) throw new Error(`Unsupported autonomous reply selection: ${invalid.join(', ')}.`);
  if (!selected.length) throw new Error('Choose at least one autonomous reply option in each enabled category.');
  return selected;
}

function integerBudget(value, fallback = null) {
  if (value === undefined) return fallback;
  if (value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error('Live autonomous reply budget must be a positive whole number.');
  return number;
}

export function getAutonomousReplyGrant() {
  return { ...defaultGrant(), ...(getAutonomousReplyGrantState() || {}) };
}

export function getAutonomousReplyRuntime() {
  return { ...defaultRuntime(), ...(getAutonomousReplyRuntimeState() || {}) };
}

export function configureAutonomousReplyGrant(input = {}, { actor = 'human' } = {}) {
  if (actor !== 'human') throw new Error('Autonomous reply configuration requires an explicit human action.');
  const current = getAutonomousReplyGrant();
  const refreshMinutes = input.refreshMinutes === undefined ? current.refreshMinutes : Number(input.refreshMinutes);
  if (!Number.isInteger(refreshMinutes) || refreshMinutes < AUTONOMOUS_REPLY_MIN_REFRESH_MINUTES) {
    throw new Error(`Autonomous reply refresh cadence must be at least ${AUTONOMOUS_REPLY_MIN_REFRESH_MINUTES} minutes for the current daemon poll policy.`);
  }
  const nextMode = input.mode === undefined ? current.mode : String(input.mode);
  if (current.state === 'running' && nextMode !== current.mode) {
    throw new Error('Pause autonomous replies before changing Dry run / Live mode.');
  }
  const next = {
    ...current,
    mode: nextMode,
    allowedSources: enumList(input.allowedSources, AUTONOMOUS_REPLY_SOURCE_CLASSES, current.allowedSources),
    allowedIntents: enumList(input.allowedIntents, AUTONOMOUS_REPLY_INTENTS, current.allowedIntents),
    allowedTones: enumList(input.allowedTones, AUTONOMOUS_REPLY_TONES, current.allowedTones),
    humorAllowed: input.humorAllowed === undefined ? current.humorAllowed : input.humorAllowed === true,
    liveBudget: integerBudget(input.liveBudget, current.liveBudget),
    refreshMinutes,
    revision: current.revision + 1,
    updatedAt: Date.now(),
  };
  if (!['dry_run', 'live'].includes(next.mode)) throw new Error(`Unsupported autonomous reply mode: ${next.mode}.`);
  if (!next.humorAllowed) next.allowedTones = next.allowedTones.filter((tone) => !HUMOR_TONES.has(tone));
  if (!next.allowedTones.length) throw new Error('Choose a non-humor tone when humor is disabled.');
  return saveAutonomousReplyGrantState(next);
}

function transitionGrant(action, { actor = 'human' } = {}) {
  if (actor !== 'human') throw new Error('Autonomous reply Start/Pause/Stop requires an explicit human action.');
  const current = getAutonomousReplyGrant();
  const now = Date.now();
  if (action === 'start') {
    if (current.mode === 'live') {
      if (!Number.isInteger(Number(current.liveBudget)) || Number(current.liveBudget) <= 0) {
        throw new Error('Set an explicit positive live safety budget before starting live autonomous replies.');
      }
    }
    const fromStopped = current.state === 'stopped';
    return saveAutonomousReplyGrantState({
      ...current,
      state: 'running',
      budgetUsed: fromStopped ? 0 : Number(current.budgetUsed || 0),
      startedAt: fromStopped ? now : current.startedAt,
      discoveryWatermarkAt: fromStopped ? now : current.discoveryWatermarkAt,
      pausedAt: null,
      stoppedAt: null,
      revision: current.revision + 1,
      updatedAt: now,
    });
  }
  if (action === 'pause') {
    return saveAutonomousReplyGrantState({ ...current, state: 'paused', pausedAt: now, revision: current.revision + 1, updatedAt: now });
  }
  if (action === 'stop') {
    return saveAutonomousReplyGrantState({ ...current, state: 'stopped', stoppedAt: now, pausedAt: null, revision: current.revision + 1, updatedAt: now });
  }
  throw new Error(`Unsupported autonomous reply transition: ${action}.`);
}

export function startAutonomousReplies(options = {}) {
  const grant = transitionGrant('start', options);
  saveAutonomousReplyRuntimeState({ ...getAutonomousReplyRuntime(), nextExpectedRefreshAt: null });
  return grant;
}

export function pauseAutonomousReplies(options = {}) {
  const grant = transitionGrant('pause', options);
  saveAutonomousReplyRuntimeState({ ...getAutonomousReplyRuntime(), nextExpectedRefreshAt: null });
  return grant;
}

export function stopAutonomousReplies(options = {}) {
  const grant = transitionGrant('stop', options);
  saveAutonomousReplyRuntimeState({ ...getAutonomousReplyRuntime(), nextExpectedRefreshAt: null });
  return grant;
}

function sourceClassFor(item, candidate) {
  const persisted = String(item?.engagement?.sourceClass || '');
  if (AUTONOMOUS_REPLY_SOURCE_CLASSES.includes(persisted)) return persisted;
  if (item?.engagementKind && item.engagementKind !== 'initial_reply') return 'active';
  if (item?.engagement?.source === 'target_response') return 'active';
  const tier = String(candidate?.viral?.tier || '').toLowerCase();
  if (['viral', 'breakout'].includes(tier) || item?.engagement?.source === 'x_momentum') return 'momentum';
  return 'normal';
}

function unsafeHumorContext(text) {
  return /\b(?:death|died|dead|fatal|injur\w*|disaster|layoff\w*|laid off|harass\w*|assault|abuse|victim|suicid\w*|ransomware|breach|exploit|vulnerab\w*|race|racial|religion|gender|sexuality|disabil\w*|appearance|body|identity|private|doxx\w*)\b/i.test(String(text || ''));
}

function playfulContext(text) {
  return /(?:😂|😅|\blol\b|\bhaha\b|\bjoke\b|\bfunny\b|\bmeme\b|\bship it\b|\bworks on my machine\b|\byak shave\b)/i.test(String(text || ''));
}

function replyShingles(text) {
  const words = String(text || '').toLowerCase().replace(/https?:\/\/\S+/g, ' ').match(/[a-z0-9][a-z0-9+.#/-]*/g) || [];
  if (words.length < 2) return new Set(words);
  return new Set(words.slice(0, -1).map((word, index) => `${word} ${words[index + 1]}`));
}

function replySimilarity(left, right) {
  const a = replyShingles(left);
  const b = replyShingles(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function priorAutonomousDuplicate(text) {
  const normalized = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let best = 0;
  for (const decision of listAutonomousReplyDecisions({ limit: 100 })) {
    const prior = String(decision.exactReply || '').trim();
    if (!prior) continue;
    if (normalized && normalized === prior.toLowerCase().replace(/\s+/g, ' ')) return { duplicate: true, similarity: 1 };
    best = Math.max(best, replySimilarity(text, prior));
  }
  return { duplicate: best >= 0.75, similarity: best };
}

function chooseIntent(item, candidate, grant) {
  const text = String(candidate?.text || '');
  const allowed = new Set(grant.allowedIntents);
  if (/\b(?:feedback|what would you change|what should we improve)\b/i.test(text) && allowed.has('constructive_feedback')) return 'constructive_feedback';
  if (item.engagementKind !== 'initial_reply' && /\b(?:shipped|launched|released|milestone|finally live)\b/i.test(text) && allowed.has('social_reaction')) return 'social_reaction';
  const mapped = ARCHETYPE_TO_INTENT[String(item.replyArchetype || '')] || null;
  return mapped && allowed.has(mapped) ? mapped : null;
}

function chooseTone(intent, candidate, grant, behavior = {}) {
  const text = String(candidate?.text || '');
  const allowed = new Set(grant.allowedTones);
  const humorSafe = !unsafeHumorContext(text);
  const affect = String(behavior?.affectStrategy || 'neutral');
  const mode = String(behavior?.socialMode || '');
  const wantsHumor = ['contrast', 'de_escalate'].includes(affect) || mode === 'humorist' || playfulContext(text);
  if (grant.humorAllowed && humorSafe && wantsHumor) {
    if (allowed.has('light_humor')) return { tone: 'light_humor', humorSafe };
    if (allowed.has('dry_wit')) return { tone: 'dry_wit', humorSafe };
  }
  const assertive = ['judgment', 'correction', 'taste'].includes(String(behavior?.primaryPurpose || ''))
    || ['opinionated_peer', 'skeptic', 'taste_maker'].includes(mode);
  const preferred = assertive
    ? ['direct', 'conversational', 'warm']
    : ['reward', 'energize', 'match', 'amplify'].includes(affect)
      ? ['warm', 'conversational', 'direct']
      : intent === 'constructive_feedback' || intent === 'social_reaction'
        ? ['conversational', 'warm', 'direct']
        : intent === 'useful_question' || intent === 'synthesis'
          ? ['conversational', 'warm', 'direct']
          : ['direct', 'conversational', 'warm'];
  const tone = preferred.find((item) => allowed.has(item)) || null;
  return { tone, humorSafe };
}

function relationshipContext(profile) {
  if (!profile) return {};
  return {
    stage: profile.relationshipStage || 'observed',
    targetScore: Number(profile.targetScore || 0),
    meaningfulInteractions: Number(profile.meaningfulInteractions || 0),
    theirRepliesToUs: Number(profile.theirRepliesToUs || 0),
    ourRepliesToThem: Number(profile.ourRepliesToThem || 0),
  };
}

function preGenerationDecision(item, candidate, profile, grant, sourceClass, intent, tone, behavior) {
  if (!item.targetTweetId) return { decision: 'skipped', reason: boundedReason('MISSING_TARGET_TWEET_ID', 'A real X target tweet ID is required.') };
  if (!grant.allowedSources.includes(sourceClass)) return { decision: 'skipped', reason: boundedReason('SOURCE_CLASS_NOT_ALLOWED', `${sourceClass} sources are not enabled by the current grant.`) };
  if (!intent) return { decision: 'review', reason: boundedReason('NO_ALLOWED_REPLY_INTENT', 'The current contribution does not map to an intent allowed by the grant.') };
  if (!tone) return { decision: 'review', reason: boundedReason('NO_SAFE_ALLOWED_TONE', 'No context-safe tone allowed by the grant is available.') };
  if (hasCandidateAction(item.candidateKey, 'reply') || item.status === 'published' || item.outputTweetId) {
    return { decision: 'skipped', reason: boundedReason('ALREADY_REPLIED', 'This candidate already has a recorded reply action or published reply.') };
  }
  if (item.engagement?.expiry?.effectiveExpired === true) return { decision: 'skipped', reason: boundedReason('EXPIRED', 'The opportunity expired without an active-conversation override.') };
  if (['needs_review', 'approved', 'publishing', 'failed'].includes(item.status) || item.humanApprovedAt) {
    return { decision: 'skipped', reason: boundedReason('HUMAN_WORKFLOW_ACTIVE', 'An existing human review/send state is already active for this reply.') };
  }
  const draft = getDraftByCandidate(item.candidateKey);
  if (String(draft?.body || '').trim()) return { decision: 'skipped', reason: boundedReason('HUMAN_DRAFT_PRESENT', 'A reply draft already exists; autonomous mode will not overwrite human work.') };
  const health = getAccountHealthSummary().health;
  if (health.state === 'constrained') return { decision: 'skipped', reason: boundedReason('ACCOUNT_CONSTRAINED', 'Supported Account Health evidence currently constrains replies.') };
  const growthFit = assessStrategicRelevance(candidate, { humanOverride: item.relevance?.humanOverride || null });
  const minPriority = sourceClass === 'active' ? AUTONOMOUS_ACTIVE_PRIORITY_MIN : AUTONOMOUS_COLD_PRIORITY_MIN;
  if (Number(item.priority || 0) < minPriority) {
    return { decision: 'skipped', reason: boundedReason('AUTONOMOUS_VALUE_TOO_LOW', `Internal autonomous value threshold is ${minPriority}; current EngagePriority is ${Math.round(Number(item.priority || 0))}.`) };
  }
  if (intent === 'social_reaction') {
    const established = ['responsive', 'recurring', 'connected', 'mutual'].includes(profile?.relationshipStage);
    const momentumPurpose = sourceClass === 'momentum'
      && ['celebration', 'humor', 'taste', 'social_presence', 'support', 'de_escalation'].includes(String(behavior?.primaryPurpose || ''));
    if (sourceClass !== 'active' && !established && !momentumPurpose) {
      return { decision: 'review', reason: boundedReason('SOCIAL_ACTION_CONTEXT_WEAK', 'The social-only behavior is valid in principle but lacks enough relationship or high-momentum context for autonomous send authority.') };
    }
  }
  if (grant.mode === 'live' && Number(grant.budgetUsed || 0) >= Number(grant.liveBudget || 0)) {
    return { decision: 'skipped', reason: boundedReason('LIVE_BUDGET_EXHAUSTED', 'The explicit operator live safety budget has no remaining capacity.') };
  }
  return { decision: 'continue', growthFit, health };
}

async function generateExactReply(item, candidate, profile, grant, strategy) {
  const recentReplies = listRecentPublishedContent({ kind: 'reply', limit: 20, excludeCandidateKey: candidate.key });
  const recentReplyArchetypes = listEngagementItems({ includeExpired: true, limit: 30 })
    .map((entry) => entry.replyArchetype).filter(Boolean).slice(0, 20);
  const packet = buildWriterPacket({
    candidate,
    queueItem: item,
    draft: null,
    relationship: profile,
    recentReplies,
    recentReplyArchetypes,
    health: getAccountHealthSummary().health,
  });
  packet.replyStrategy = {
    intent: strategy.intent,
    tone: strategy.tone,
    sourceClass: strategy.sourceClass,
    behavior: packet.behavior,
    contribution: item.contributionSummary || item.engagement?.contribution?.summary || '',
    rules: [
      'The behavior decision owns purpose, mode, affect, depth, and conversation stage.',
      'A social-only action does not need a hidden technical payload.',
      'A technical or corrective action must preserve consequential evidence.',
      'Do not imitate a specific real person or invent explicit/implied owner experience.',
    ],
  };
  const promptDocumentText = await fs.readFile(path.resolve(packet.promptDocument), 'utf8');
  const output = await generateWriterOutput(packet, promptDocumentText);
  if (output.pipeline !== 'reply') throw new Error(`Writer returned ${output.pipeline}; expected reply.`);
  const base = { ...createDraftScaffold(candidate, { pipeline: 'reply' }), editor: { pipeline: 'reply' } };
  const generated = applyWriterOutput(base, output, {
    writerPacket: packet,
    generationProvenance: {
      writerAiExecution: output.execution || null,
      writerExecutionSource: 'autonomous_reply',
      strategySelectionId: null,
      strategyMode: null,
      strategyApplied: false,
    },
  });
  generated.editor = {
    ...(generated.editor || {}),
    autonomousReply: {
      intent: strategy.intent,
      tone: strategy.tone,
      sourceClass: strategy.sourceClass,
      grantRevision: grant.revision,
    },
  };
  return { output, draft: generated, recentReplies, recentReplyArchetypes };
}

function autonomousGateResult(item, candidate, generated, recentReplies, recentReplyArchetypes, relationship = null) {
  const parentConversation = item.parentOurTweetId
    ? listRecentOurConversationPosts({ limit: 100 }).find((entry) => String(entry.tweetId) === String(item.parentOurTweetId))
    : null;
  const analysis = scoreDraft(generated, candidate, {
    pipeline: 'reply',
    behavior: item.behavior || generated?.editor?.behavior || null,
    relationship,
    recentPosts: listRecentPublishedContent({ kind: 'main', limit: 20, excludeCandidateKey: candidate.key }),
    recentReplies,
    recentReplyArchetypes,
    replyArchetype: item.replyArchetype || '',
    relevanceOverride: item.relevance?.humanOverride || null,
    conversationRelevanceCandidate: parentConversation ? getCandidate(parentConversation.candidateKey) : null,
  });
  const failures = analysis.gates?.failures || [];
  const deterministicFailures = [...failures];
  const duplicate = priorAutonomousDuplicate(generated.body || '');
  if (duplicate.duplicate) {
    deterministicFailures.push({ code: 'AUTONOMOUS_REPLY_DUPLICATE', message: `Generated reply is exact/near-duplicate autonomous text (${duplicate.similarity.toFixed(2)} similarity).` });
  }
  return {
    analysis,
    passed: analysis.score >= analysis.minimumScore && analysis.growthPackaging?.ready === true && deterministicFailures.length === 0,
    deterministicFailures,
  };
}

export async function evaluateAutonomousReplyItem(item, { grant = getAutonomousReplyGrant() } = {}) {
  const candidate = getCandidate(item.candidateKey);
  if (!candidate) {
    return { decision: 'skipped', sourceClass: 'normal', intent: null, tone: null, exactReply: '', reasons: [boundedReason('CANDIDATE_MISSING', 'The source candidate no longer exists.')] };
  }
  const profile = item.targetUsername ? getRelationshipProfile(item.targetUsername) : null;
  const sourceClass = sourceClassFor(item, candidate);
  const behavior = normalizeBehaviorDecision(item.behavior || {}, { pipeline: 'reply' });
  const intent = chooseIntent(item, candidate, grant);
  const toneChoice = chooseTone(intent, candidate, grant, behavior);
  const pre = preGenerationDecision(item, candidate, profile, grant, sourceClass, intent, toneChoice.tone, behavior);
  const base = {
    sourceClass,
    intent,
    tone: toneChoice.tone,
    exactReply: '',
    relationshipStage: profile?.relationshipStage || null,
    relationshipContext: relationshipContext(profile),
    behavior,
    selection: {
      priority: Number(item.priority || 0),
      contribution: item.contributionSummary || item.engagement?.contribution?.summary || '',
      behavior,
      firstObservedAt: item.engagement?.firstObservedAt || item.createdAt || null,
      whySelected: sourceClass === 'active'
        ? 'Active/direct conversation received first consideration.'
        : `${sourceClass} relevant conversation passed Engage Next value/contribution screening.`,
    },
    checks: {
      humorSafe: toneChoice.humorSafe,
      growthFit: pre.growthFit || null,
      accountHealth: pre.health || getAccountHealthSummary().health,
    },
    reasons: pre.reason ? [pre.reason] : [],
  };
  if (pre.decision !== 'continue') return { ...base, decision: pre.decision };

  let generated;
  try {
    generated = await generateExactReply(item, candidate, profile, grant, {
      sourceClass,
      intent,
      tone: toneChoice.tone,
      behavior,
    });
  } catch (error) {
    return { ...base, decision: 'review', reasons: [boundedReason('AI_GENERATION_FAILED', error.message)] };
  }
  const exactReply = String(generated.draft.body || '').trim();
  const gates = autonomousGateResult(item, candidate, generated.draft, generated.recentReplies, generated.recentReplyArchetypes, profile);
  const checkedDraft = {
    ...generated.draft,
    gates: gates.analysis.gates,
    qualityScore: gates.analysis.score,
  };
  const checks = {
    ...base.checks,
    writingScore: gates.analysis.score,
    growthPackagingReady: gates.analysis.growthPackaging?.ready === true,
    deterministicFailures: gates.deterministicFailures,
  };
  if (generated.output.decision === 'DO_NOT_POST') {
    return { ...base, exactReply, aiExecution: generated.output.execution || null, generatedDraft: checkedDraft, checks, decision: 'skipped', reasons: [boundedReason('WRITER_DO_NOT_REPLY', 'The Writer found no strong reply worth sending.')] };
  }
  if (!gates.passed) {
    const first = gates.deterministicFailures[0];
    return {
      ...base,
      exactReply,
      aiExecution: generated.output.execution || null,
      generatedDraft: checkedDraft,
      checks,
      decision: 'review',
      reasons: [boundedReason('DETERMINISTIC_GATE_REVIEW', first?.message || 'The generated reply needs human review before sending.')],
    };
  }
  return { ...base, exactReply, aiExecution: generated.output.execution || null, generatedDraft: checkedDraft, checks, decision: 'send', reasons: [] };
}

function persistDecision(item, grant, evaluation, decision) {
  return recordAutonomousReplyDecision({
    queueItemId: item.id,
    candidateKey: item.candidateKey,
    targetTweetId: item.targetTweetId,
    targetUsername: item.targetUsername,
    sourceClass: evaluation.sourceClass,
    relationshipStage: evaluation.relationshipStage,
    intent: evaluation.intent,
    tone: evaluation.tone,
    exactReply: evaluation.exactReply,
    selection: { ...(evaluation.selection || {}), behavior: evaluation.behavior || evaluation.selection?.behavior || null },
    relationshipContext: evaluation.relationshipContext,
    aiExecution: evaluation.aiExecution || {},
    checks: evaluation.checks || {},
    reasons: evaluation.reasons || [],
    grantRevision: grant.revision,
    mode: grant.mode,
    decision,
  });
}

function persistHumanReview(item, evaluation, decisionId) {
  if (!evaluation.generatedDraft || !evaluation.exactReply) return null;
  const existing = getDraftByCandidate(item.candidateKey);
  if (String(existing?.body || '').trim()) return existing;
  const savedDraft = saveDraft({
    ...evaluation.generatedDraft,
    candidateKey: item.candidateKey,
    editor: {
      ...(evaluation.generatedDraft.editor || {}),
      autonomousReply: {
        ...(evaluation.generatedDraft.editor?.autonomousReply || {}),
        decisionId,
        downgradedToHumanReview: true,
      },
    },
    gates: evaluation.checks?.deterministicFailures?.length ? { passed: false, failures: evaluation.checks.deterministicFailures } : {},
    qualityScore: Number(evaluation.checks?.writingScore || 0),
    status: 'draft',
  });
  saveQueueItem({
    ...item,
    status: 'needs_review',
    draftId: savedDraft.id,
    humanApprovedAt: null,
    approvedText: null,
    engagement: {
      ...(item.engagement || {}),
      autonomousReview: { decisionId, at: Date.now() },
    },
  });
  return savedDraft;
}

function currentLiveAuthority(item, decision, expectedRevision) {
  const grant = getAutonomousReplyGrant();
  if (grant.state !== 'running' || grant.mode !== 'live' || grant.revision !== expectedRevision) {
    return { allowed: false, reason: boundedReason('AUTHORITY_CHANGED', 'Autonomous reply grant changed before send claim.') };
  }
  if (getAccountHealthSummary().health.state === 'constrained') {
    return { allowed: false, reason: boundedReason('ACCOUNT_CONSTRAINED', 'Account Health became constrained before send claim.') };
  }
  if (hasCandidateAction(item.candidateKey, 'reply') || item.outputTweetId || item.status === 'published') {
    return { allowed: false, reason: boundedReason('ALREADY_REPLIED', 'A reply was recorded before autonomous claim.') };
  }
  if (decision.decision !== 'eligible_live') {
    return { allowed: false, reason: boundedReason('CLAIM_STATE_CHANGED', 'Autonomous decision is no longer live-eligible.') };
  }
  return { allowed: true, grant };
}

export async function processAutonomousReplyBatch(items, processItem) {
  const results = [];
  for (const item of items) results.push(await processItem(item));
  return results;
}

function orderedUndecidedItems(grant) {
  const sourceRank = { active: 0, momentum: 1, normal: 2 };
  const watermark = Number(grant.discoveryWatermarkAt || 0);
  return listEngagementItems({ includeExpired: false, limit: 300 })
    .filter((item) => item.targetTweetId)
    .filter((item) => !getAutonomousReplyDecisionForTarget(item.targetTweetId))
    .filter((item) => Number(item.engagement?.firstObservedAt || item.createdAt || 0) >= watermark)
    .filter((item) => grant.allowedSources.includes(sourceClassFor(item, getCandidate(item.candidateKey))))
    .sort((left, right) => {
      const sourceDelta = sourceRank[sourceClassFor(left, getCandidate(left.candidateKey))] - sourceRank[sourceClassFor(right, getCandidate(right.candidateKey))];
      return sourceDelta || Number(right.priority || 0) - Number(left.priority || 0) || left.id - right.id;
    });
}

function decisionCounts(decisions) {
  const counts = { sent: 0, review: 0, skipped: 0 };
  for (const item of decisions) {
    if (['sent', 'dry_run_send', 'eligible_live', 'sending'].includes(item.decision)) counts.sent += 1;
    else if (['review', 'dry_run_review'].includes(item.decision)) counts.review += 1;
    else counts.skipped += 1;
  }
  return counts;
}

export async function runAutonomousReplyCycle({ now = Date.now(), refreshErrors = [], refreshFailed = false } = {}) {
  const startedGrant = getAutonomousReplyGrant();
  if (startedGrant.state !== 'running') return { active: false, reason: startedGrant.state, grant: startedGrant, decisions: [] };
  const runtime = getAutonomousReplyRuntime();
  if (runtime.nextExpectedRefreshAt && Number(now) < Number(runtime.nextExpectedRefreshAt)) {
    return { active: true, due: false, grant: startedGrant, runtime, decisions: [] };
  }
  if (refreshFailed) {
    const errors = Array.isArray(refreshErrors) ? refreshErrors.filter(Boolean) : [];
    const nextRuntime = saveAutonomousReplyRuntimeState({
      ...runtime,
      lastAttemptAt: Number(now),
      nextExpectedRefreshAt: Number(now) + startedGrant.refreshMinutes * 60_000,
      lastError: errors.join(' | ') || 'Engagement source refresh failed.',
      lastDecisionCounts: { sent: 0, review: 0, skipped: 0 },
    });
    return { active: true, due: true, grant: startedGrant, runtime: nextRuntime, decisions: [], refreshFailed: true };
  }
  const candidates = orderedUndecidedItems(startedGrant);
  const decisions = await processAutonomousReplyBatch(candidates, async (item) => {
    const grant = getAutonomousReplyGrant();
    if (grant.state !== 'running' || grant.revision !== startedGrant.revision) return null;
    const evaluation = await evaluateAutonomousReplyItem(item, { grant });
    const dryRunDecision = evaluation.decision === 'send' ? 'dry_run_send' : evaluation.decision === 'review' ? 'dry_run_review' : 'dry_run_skip';
    if (grant.mode === 'dry_run') return persistDecision(item, grant, evaluation, dryRunDecision);
    if (evaluation.decision !== 'send') {
      const recorded = persistDecision(item, grant, evaluation, evaluation.decision === 'review' ? 'review' : 'skipped');
      if (recorded.created && evaluation.decision === 'review') persistHumanReview(item, evaluation, recorded.id);
      return recorded;
    }

    let recorded = persistDecision(item, grant, evaluation, 'eligible_live');
    if (!recorded.created) return recorded;
    const authority = currentLiveAuthority(item, recorded, grant.revision);
    if (!authority.allowed) {
      recorded = updateAutonomousReplyDecision(recorded.id, { decision: 'review', reasons: [...recorded.reasons, authority.reason] });
      persistHumanReview(item, evaluation, recorded.id);
      return recorded;
    }
    let claimed;
    try {
      claimed = claimAutonomousReplyDecision(recorded.id, { grantRevision: grant.revision, now: Date.now() });
    } catch (error) {
      recorded = updateAutonomousReplyDecision(recorded.id, { decision: 'review', reasons: [...recorded.reasons, boundedReason('CLAIM_REJECTED', error.message)] });
      persistHumanReview(item, evaluation, recorded.id);
      return recorded;
    }
    if (!claimed) return getAutonomousReplyDecisionForTarget(item.targetTweetId);

    try {
      const sent = await sendAutonomousEngagementReply(item.candidateKey, {
        exactReply: evaluation.exactReply,
        decisionId: recorded.id,
        grantRevision: grant.revision,
        intent: evaluation.intent,
        tone: evaluation.tone,
        sourceClass: evaluation.sourceClass,
        generatedDraft: evaluation.generatedDraft,
      });
      return updateAutonomousReplyDecision(recorded.id, {
        decision: 'sent',
        sentAt: Date.now(),
        outputTweetId: sent.tweetId,
        outputUrl: sent.url || null,
      });
    } catch (error) {
      const latestItem = listEngagementItems({ includeExpired: true, limit: 500 }).find((entry) => entry.id === item.id);
      const remoteIdentityKnown = Boolean(latestItem?.outputTweetId);
      return updateAutonomousReplyDecision(recorded.id, {
        decision: remoteIdentityKnown || latestItem?.status === 'publishing' ? 'reconciliation_required' : 'send_failed',
        reasons: [...recorded.reasons, boundedReason('SEND_ERROR', error.message)],
        outputTweetId: latestItem?.outputTweetId || null,
        outputUrl: latestItem?.outputUrl || null,
      });
    }
  });
  const completed = decisions.filter(Boolean);
  const nextExpectedRefreshAt = Number(now) + startedGrant.refreshMinutes * 60_000;
  const errors = Array.isArray(refreshErrors) ? refreshErrors.filter(Boolean) : [];
  const nextRuntime = saveAutonomousReplyRuntimeState({
    ...runtime,
    lastAttemptAt: Number(now),
    lastSuccessfulRefreshAt: Number(now),
    nextExpectedRefreshAt,
    lastError: errors.join(' | '),
    lastDecisionCounts: decisionCounts(completed),
  });
  return { active: true, due: true, grant: getAutonomousReplyGrant(), runtime: nextRuntime, decisions: completed };
}

function groupedOutcome(decisions, keyOrReader) {
  const groups = new Map();
  const readLabel = typeof keyOrReader === 'function'
    ? keyOrReader
    : (decision) => decision[keyOrReader];
  for (const decision of decisions) {
    const label = readLabel(decision) || 'unknown';
    const current = groups.get(label) || { label, sent: 0, targetResponses: 0, continued: 0 };
    current.sent += 1;
    const events = decision.targetUsername ? listRelationshipEvents(decision.targetUsername, { limit: 500 }) : [];
    current.targetResponses += events.some((event) => event.occurredAt > decision.sentAt && ['target_reply', 'target_quote'].includes(event.eventType)) ? 1 : 0;
    current.continued += events.some((event) => event.occurredAt > decision.sentAt && event.eventType === 'conversation_continued') ? 1 : 0;
    groups.set(label, current);
  }
  return [...groups.values()].sort((left, right) => right.sent - left.sent || left.label.localeCompare(right.label));
}

export function getAutonomousReplyReadModel({ limit = 50 } = {}) {
  const grant = getAutonomousReplyGrant();
  const runtime = getAutonomousReplyRuntime();
  const recentDecisions = listAutonomousReplyDecisions({ limit });
  const sent = listAutonomousReplyDecisions({ decision: 'sent', limit: 500 });
  return {
    grant: {
      ...grant,
      remainingBudget: grant.liveBudget == null ? null : Math.max(0, Number(grant.liveBudget) - Number(grant.budgetUsed || 0)),
      liveStartReady: Number(grant.liveBudget || 0) > 0,
    },
    runtime,
    options: {
      sourceClasses: [...AUTONOMOUS_REPLY_SOURCE_CLASSES],
      intents: [...AUTONOMOUS_REPLY_INTENTS],
      tones: [...AUTONOMOUS_REPLY_TONES],
      minRefreshMinutes: AUTONOMOUS_REPLY_MIN_REFRESH_MINUTES,
    },
    recentDecisions,
    outcomes: {
      sampleSize: sent.length,
      byIntent: groupedOutcome(sent, 'intent'),
      byTone: groupedOutcome(sent, 'tone'),
      bySourceClass: groupedOutcome(sent, 'sourceClass'),
      byRelationshipStage: groupedOutcome(sent, 'relationshipStage'),
      byPrimaryPurpose: groupedOutcome(sent, (decision) => decision.behavior?.primaryPurpose),
      bySocialMode: groupedOutcome(sent, (decision) => decision.behavior?.socialMode),
      byAffectStrategy: groupedOutcome(sent, (decision) => decision.behavior?.affectStrategy),
      byInformationDepth: groupedOutcome(sent, (decision) => decision.behavior?.informationDepth),
      byConversationStage: groupedOutcome(sent, (decision) => decision.behavior?.conversationStage),
      byPersonaModelVersion: groupedOutcome(sent, (decision) => decision.behavior?.personaModelVersion),
      note: 'Descriptive observations only; small samples do not establish causal reply-strategy or persona rules.',
    },
  };
}
