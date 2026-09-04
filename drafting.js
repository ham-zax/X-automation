import { createHash } from 'node:crypto';
import {
  behaviorDecisionRequiresFactualEvidence,
  behaviorDecisionSupportsSocialOnly,
  isGenericSocialPraise,
  normalizeBehaviorDecision,
  socialActMatchesPurpose,
  socialPurposeContextAvailable,
  validateBehaviorDecision,
} from './behavior.js';
import { getPersonaSlice, selectBehaviorDecision } from './persona.js';
import { assessStrategicRelevance } from './strategy.js';
import { extractViralStyleFeatures } from './viral_style.js';

const PLACEHOLDER = /\[[^\]]+\]/;
const CONTENT_PIPELINES = new Set(['original', 'quote', 'thread', 'reply']);
const WRITER_DECISIONS = new Set(['POST', 'DO_NOT_POST']);
const MEDIA_TYPES = new Set(['none', 'screenshot', 'chart', 'code', 'diagram']);
const CANONICAL_ACRONYMS = new Set(['AI', 'API', 'CLI', 'CPU', 'GPU', 'HTTP', 'JSON', 'LLM', 'MCP', 'RAG', 'SDK', 'SQL']);

function ensurePipeline(pipeline = 'original') {
  if (!CONTENT_PIPELINES.has(pipeline)) throw new Error(`Invalid content pipeline: ${pipeline}`);
  return pipeline;
}

function threadParts(draft) {
  const parts = draft?.threadParts ?? draft?.editor?.threadParts ?? [];
  return Array.isArray(parts) ? parts.map((part) => String(part ?? '').trim()) : [];
}

export function composeDraft(draft = {}, { pipeline = 'original' } = {}) {
  ensurePipeline(pipeline);
  if (pipeline === 'thread') return threadParts(draft);
  const { hook = '', insight = '', evidence = '', action = '' } = draft;
  return [hook, insight, evidence, action].map((value) => String(value || '').trim()).filter(Boolean).join('\n\n');
}

export function weightedPostLength(text) {
  return String(text || '').replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
}

export function createDraftScaffold(candidate, { pipeline = 'original' } = {}) {
  ensurePipeline(pipeline);
  const draft = {
    candidateKey: candidate.key || candidate.url,
    hook: '',
    insight: '',
    evidence: '',
    action: '',
    body: '',
    status: 'draft',
    scheduledAt: null,
  };
  if (pipeline === 'thread') draft.threadParts = ['', ''];
  draft.qualityScore = scoreDraft(draft, candidate).score;
  return draft;
}

function usefulText(value, minimum = 24) {
  const text = String(value || '').trim();
  return text.length >= minimum && !PLACEHOLDER.test(text);
}

function tokenSet(text) {
  return new Set(String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9+.#-]{2,}/g) || []);
}

function similarity(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap++;
  return overlap / Math.max(1, new Set([...left, ...right]).size);
}

function normalizedText(text) {
  return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function contentUnits(draft, pipeline) {
  if (pipeline === 'thread') return threadParts(draft);
  const body = draft?.body != null
    ? String(draft.body).trim()
    : String(draft?.editor?.finalText || composeDraft(draft, { pipeline })).trim();
  return [body];
}

function recentText(item) {
  if (typeof item === 'string') return item;
  if (Array.isArray(item?.threadParts)) return item.threadParts[0] || '';
  return item?.body || item?.finalText || item?.text || '';
}

function asStringArray(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('Expected an array.');
  return value.map((item) => String(item ?? '').trim());
}

function candidateAuthor(candidate) {
  if (candidate?.author) return candidate.author;
  if (candidate?.username) return candidate.username;
  if (candidate?.source === 'x' && String(candidate?.title || '').startsWith('@')) return candidate.title;
  return null;
}

function writerEvidenceItem(item) {
  const id = String(item?.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    claim: String(item?.claim || ''),
    claimType: String(item?.claimType || ''),
    status: String(item?.status || ''),
    sourceKind: String(item?.sourceKind || ''),
    sourceFamily: String(item?.sourceFamily || ''),
    requestedUrl: String(item?.requestedUrl || ''),
    resolvedUrl: String(item?.resolvedUrl || ''),
    title: String(item?.title || ''),
    summary: String(item?.summary || ''),
    observedAt: item?.observedAt == null ? null : Number(item.observedAt),
  };
}

export function validateWriterEvidenceReferences(output, packet) {
  const allowed = new Set((Array.isArray(packet?.evidence) ? packet.evidence : [])
    .map((item) => String(item?.id ?? '').trim()).filter(Boolean));
  const used = asStringArray(output?.evidenceUsed).filter(Boolean);
  const invalid = used.filter((id) => !allowed.has(id));
  if (invalid.length) throw new Error(`Writer cited evidence IDs that were not supplied: ${[...new Set(invalid)].join(', ')}.`);
  return used;
}

function writerCurrentDraft(draft) {
  if (!draft) return null;
  const editor = { ...(draft.editor || {}) };
  delete editor.generation;
  delete editor.generationHistory;
  return { ...draft, editor };
}

export function buildWriterPacket({
  candidate,
  queueItem,
  draft,
  recentPosts = [],
  evidence = [],
  profileProof = {},
  editorialRecommendation = null,
  relationship = null,
  recentReplies = [],
  recentReplyArchetypes = [],
  health = {},
  writingStrategy = null,
} = {}) {
  const pipeline = ensurePipeline(queueItem?.pipeline || draft?.editor?.pipeline || 'original');
  const sourceStyle = extractViralStyleFeatures({ text: candidate?.text || '' });
  const contribution = {
    archetype: queueItem?.replyArchetype
      || (pipeline === 'quote' ? 'social_observation' : pipeline === 'reply' ? 'synthesis' : 'synthesis'),
    summary: queueItem?.contributionSummary
      || editorialRecommendation?.thesis
      || queueItem?.routingReason
      || `Realize the selected ${pipeline} action.`,
  };
  const behavior = selectBehaviorDecision({
    explicitBehavior: queueItem?.behavior?.decision === 'ACT'
      ? queueItem.behavior
      : draft?.editor?.behavior?.decision === 'ACT'
        ? draft.editor.behavior
        : editorialRecommendation?.behavior?.decision === 'ACT'
          ? editorialRecommendation.behavior
          : null,
    pipeline,
    contribution,
    relationship: relationship ?? queueItem?.relationship ?? null,
    engagementKind: queueItem?.engagementKind || queueItem?.engagement?.kind || '',
    parentOurTweetId: queueItem?.parentOurTweetId || '',
    sourceClass: queueItem?.engagement?.sourceClass || '',
    reasonToExist: contribution.summary,
    selectionSource: queueItem?.behavior ? 'operator' : editorialRecommendation?.behavior ? 'editorial_ai' : 'persona_model',
  });
  const behaviorValidation = validateBehaviorDecision(behavior, { pipeline, requireAct: true });
  if (!behaviorValidation.valid) throw new Error(`Writer packet requires a valid ACT behavior: ${behaviorValidation.errors.join(' ')}`);
  const hashtagExperimentCount = Number(queueItem?.experimentAssignment?.context?.hashtagCount);
  const hasHashtagExperiment = Number.isInteger(hashtagExperimentCount)
    && hashtagExperimentCount >= 0
    && hashtagExperimentCount <= 2;
  return {
    account: {
      identity: 'developer + builder in tech and social participant',
      promise: 'real work, useful judgment, recognizable taste, learning, humor, support, and context-appropriate participation',
      language: 'English',
    },
    pipeline,
    behavior: behaviorValidation.behavior,
    persona: getPersonaSlice('writer'),
    candidate: {
      source: candidate?.source ?? null,
      author: candidateAuthor(candidate),
      text: candidate?.text ?? '',
      url: candidate?.url ?? '',
      niche: candidate?.niche ?? null,
      metrics: candidate?.metrics ?? {},
      viral: candidate?.viral ?? null,
      sourceStyle: {
        hookLabels: sourceStyle.hookLabels,
        styleLabels: sourceStyle.styleLabels,
        wordCount: sourceStyle.wordCount,
        sentenceCount: sourceStyle.sentenceCount,
        paragraphCount: sourceStyle.paragraphCount,
        firstLineChars: sourceStyle.firstLineChars,
        numberCount: sourceStyle.numberCount,
        hashtagCount: sourceStyle.hashtagCount,
      },
    },
    queue: {
      reachPotential: queueItem?.reachPotential ?? null,
      followPotential: queueItem?.followPotential ?? null,
      conversationPotential: queueItem?.conversationPotential ?? null,
      relationshipPotential: queueItem?.relationshipPotential ?? null,
      routingReason: queueItem?.routingReason ?? '',
    },
    relationship: relationship ?? queueItem?.relationship ?? null,
    ownerEvidence: ownerEvidenceValid(draft, pipeline)
      ? {
          factsConfirmed: draft.editor.ownerEvidence.factsConfirmed === true,
          experienceConfirmed: draft.editor.ownerEvidence.experienceConfirmed === true,
          claimSummary: String(draft.editor.ownerEvidence.claimSummary || ''),
          attestedBy: draft.editor.ownerEvidence.attestedBy,
          attestedAt: draft.editor.ownerEvidence.attestedAt,
        }
      : null,
    evidence: (Array.isArray(evidence) ? evidence : []).map(writerEvidenceItem).filter(Boolean),
    editorial: editorialRecommendation ? {
      recommendationId: editorialRecommendation.id ?? null,
      thesis: editorialRecommendation.thesis ?? '',
      desiredReaderOutcome: editorialRecommendation.desiredReaderOutcome ?? '',
      behavior: editorialRecommendation.behavior || null,
      researchQuestions: Array.isArray(editorialRecommendation.researchQuestions) ? [...editorialRecommendation.researchQuestions] : [],
    } : null,
    recentPosts: Array.isArray(recentPosts) ? [...recentPosts] : [],
    recentReplies: Array.isArray(recentReplies) ? [...recentReplies] : [],
    recentReplyArchetypes: Array.isArray(recentReplyArchetypes) ? [...recentReplyArchetypes] : [],
    health: {
      state: health?.state ?? null,
      warnings: Array.isArray(health?.warnings) ? [...health.warnings] : [],
    },
    profileProof: {
      topic: profileProof?.topic ?? null,
      coverage: profileProof?.coverage ?? null,
      supportingPostIds: Array.isArray(profileProof?.supportingPostIds) ? [...profileProof.supportingPostIds] : [],
      reason: profileProof?.reason ?? '',
    },
    experiment: queueItem?.experimentAssignment?.experimentId ? {
      experimentId: queueItem.experimentAssignment.experimentId,
      variantLabel: queueItem.experimentAssignment.variantLabel || null,
      context: queueItem.experimentAssignment.context || {},
    } : null,
    ...(writingStrategy ? { writingStrategy } : {}),
    currentDraft: writerCurrentDraft(draft),
    constraints: {
      singlePostWeightedLimit: 280,
      hashtagsPreferredMax: 1,
      hashtagsHardMax: 2,
      ...(hasHashtagExperiment ? { hashtagExperimentCount } : {}),
      emojiMax: 1,
    },
    promptDocument: 'docs/POST_GENERATION_PROMPT.md',
  };
}

export function applyWriterOutput(draft, writerOutput = {}, { generationProvenance = null, writerPacket = null } = {}) {
  const decision = writerOutput?.decision;
  const pipeline = writerOutput?.pipeline;
  if (!WRITER_DECISIONS.has(decision)) throw new Error(`Invalid writer decision: ${decision}`);
  ensurePipeline(pipeline);
  if (draft?.editor?.pipeline && draft.editor.pipeline !== pipeline) {
    throw new Error(`Writer pipeline mismatch: ${pipeline} !== ${draft.editor.pipeline}`);
  }

  const mediaInput = writerOutput?.media && typeof writerOutput.media === 'object' ? writerOutput.media : {};
  if (mediaInput.required != null && typeof mediaInput.required !== 'boolean') throw new Error('media.required must be a boolean.');
  const mediaType = mediaInput.type || 'none';
  if (!MEDIA_TYPES.has(mediaType)) throw new Error(`Invalid media type: ${mediaType}`);
  const evidenceUsed = validateWriterEvidenceReferences(writerOutput, writerPacket);
  const behaviorValidation = validateBehaviorDecision(writerPacket?.behavior, { pipeline, requireAct: true });
  if (!behaviorValidation.valid) throw new Error(`Writer output is missing a valid selected behavior: ${behaviorValidation.errors.join(' ')}`);

  const editor = {
    decision,
    pipeline,
    thesis: String(writerOutput?.thesis ?? '').trim(),
    finalText: String(writerOutput?.finalText ?? '').trim(),
    threadParts: asStringArray(writerOutput?.threadParts),
    semanticAnchors: asStringArray(writerOutput?.semanticAnchors).filter(Boolean),
    evidenceUsed,
    discussionQuestion: String(writerOutput?.discussionQuestion ?? '').trim(),
    media: {
      required: mediaInput.required ?? false,
      type: mediaType,
      reason: String(mediaInput.reason ?? '').trim(),
      source: String(mediaInput.source ?? '').trim(),
      altText: String(mediaInput.altText ?? '').trim(),
    },
    riskFlags: asStringArray(writerOutput?.riskFlags).filter(Boolean),
    behavior: behaviorValidation.behavior,
    personaModelVersion: behaviorValidation.behavior.personaModelVersion || writerPacket?.persona?.version || '',
    followReason: String(writerOutput?.followReason ?? writerOutput?.followValue ?? '').trim(),
    notes: String(writerOutput?.notes ?? '').trim(),
  };
  const operatorContext = String(draft?.editor?.operatorContext || '').trim();
  if (operatorContext) editor.operatorContext = operatorContext;
  if (writerOutput?.relationshipValue != null) editor.relationshipValue = String(writerOutput.relationshipValue).trim();
  if (writerOutput?.profileProofValue != null) editor.profileProofValue = String(writerOutput.profileProofValue).trim();

  const generationHistory = Array.isArray(draft?.editor?.generationHistory) ? [...draft.editor.generationHistory] : [];
  if (generationProvenance) {
    editor.generation = generationProvenance;
    editor.generationHistory = [...generationHistory, generationProvenance];
  } else if (generationHistory.length) {
    editor.generationHistory = generationHistory;
  }

  const next = { ...draft, editor };
  if (pipeline === 'thread') {
    next.threadParts = editor.threadParts.length ? [...editor.threadParts] : (editor.finalText ? [editor.finalText] : []);
  } else {
    next.body = editor.finalText;
  }
  return next;
}

function addIssue(target, code, message) {
  target.push({ code, message });
}

function genericQuote(text) {
  return /^\s*(?:this is (?:huge|great|wild|massive)(?: for developers)?|huge for developers|game changer|big news|we are so back)[.!]?\s*$/i.test(String(text || ''));
}

function normalizeOwnerClaimGrammar(text) {
  return String(text || '')
    .replace(/[’]/g, "'")
    .replace(/\b(i|we)'ve\b/gi, '$1 have')
    .replace(/\b(i|we)'d\b/gi, '$1 had')
    .replace(/\bi'm\b/gi, 'i am')
    .replace(/\bwe're\b/gi, 'we are');
}

function explicitOwnerExperienceClaim(text) {
  const value = normalizeOwnerClaimGrammar(text);
  return /\b(?:i|we)\s+(?:(?:have|had|am|are|was|were)\s+)?(?:been\s+)?(?:built|building|tested|testing|used|using|tried|trying|ran|running|measured|measuring|deployed|deploying|migrated|migrating|spent|spending|bought|buying|paid|paying|debugged|debugging|shipped|shipping|implemented|implementing|hit|saw|seen|found)\b|\b(?:my|our)\s+(?:project|repo|repository|codebase|team|company|setup|workflow|app|product|benchmark|test|deployment|production|prod)\b|\b(?:saved|blocked|broke|cost|helped)\s+(?:me|us)\b|\b(?:worked|failed)\s+(?:for|on)\s+(?:me|us)\b/i.test(value);
}

function impliedOwnerExperienceSignal(text) {
  return /\b(?:after using|after testing|after running|after migrating|after deploying|in my setup|on my machine|pure pain|driving me crazy|nothing beats the feeling|works on my machine)\b/i.test(String(text || ''));
}

function draftEvidenceText(draft, pipeline) {
  const units = contentUnits(draft, pipeline);
  return pipeline === 'thread' ? units.join('\n\n') : (units[0] || '');
}

function ownerEvidenceValid(draft, pipeline) {
  const evidence = draft?.editor?.ownerEvidence;
  if (!evidence || evidence.attestedBy !== 'human_web' || evidence.experienceConfirmed !== true) return false;
  if (!String(evidence.claimSummary || '').trim() || !Number.isFinite(Number(evidence.attestedAt))) return false;
  const expectedHash = createHash('sha256').update(draftEvidenceText(draft, pipeline)).digest('hex');
  return String(evidence.textHash || '') === expectedHash;
}

function socialInteractionContext(behavior, { relationship, conversationRelevanceCandidate } = {}) {
  const stage = String(relationship?.relationshipStage || 'observed');
  return {
    relationshipContext: ['interacted', 'responsive', 'recurring', 'connected', 'mutual'].includes(stage)
      || Number(relationship?.meaningfulInteractions || 0) > 0
      || Number(relationship?.theirRepliesToUs || 0) > 0,
    conversationContext: Boolean(conversationRelevanceCandidate)
      || ['reciprocal', 'ongoing', 'familiar', 'self_extension'].includes(String(behavior?.conversationStage || 'initial')),
  };
}

function behaviorContextSupported(behavior, { pipeline, candidate, relationship, conversationRelevanceCandidate, draft } = {}) {
  if (!behavior || behavior.decision !== 'ACT' || !behavior.reasonToExist) return false;
  if (!behaviorDecisionSupportsSocialOnly(behavior)) return true;

  if (pipeline === 'reply' || pipeline === 'quote') {
    return socialPurposeContextAvailable({
      purpose: behavior.primaryPurpose,
      sourceText: candidate?.text || '',
      ...socialInteractionContext(behavior, { relationship, conversationRelevanceCandidate }),
    });
  }

  return ['humor', 'taste', 'social_presence'].includes(behavior.primaryPurpose)
    || (['celebration', 'support', 'relationship'].includes(behavior.primaryPurpose)
      && ownerEvidenceValid(draft, pipeline));
}

function socialActRealized(behavior, { pipeline, candidate, relationship, conversationRelevanceCandidate, draft } = {}) {
  if (!behaviorDecisionSupportsSocialOnly(behavior) || !['reply', 'quote'].includes(pipeline)) return true;
  return socialActMatchesPurpose({
    purpose: behavior.primaryPurpose,
    text: draftEvidenceText(draft, pipeline),
    sourceText: candidate?.text || '',
    ...socialInteractionContext(behavior, { relationship, conversationRelevanceCandidate }),
  });
}

function blocks(text) {
  return String(text || '').split(/\n+/).map((block) => block.trim()).filter(Boolean);
}

function sentenceCount(text) {
  const clean = String(text || '').replace(/https?:\/\/\S+/g, 'URL');
  return (clean.match(/[^.!?]+(?:[.!?]+|$)/g) || []).map((part) => part.trim()).filter(Boolean).length;
}

function readabilityWords(text) {
  const clean = String(text || '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[@#][\p{L}\p{N}_]+/gu, ' ');
  return [...clean.matchAll(/\p{L}[\p{L}'’-]*/gu)].map((match) => match[0]);
}

function allowedReadabilityTerms(candidate, draft) {
  const allowed = new Set();
  const values = [
    ...(candidate?.niche?.matches || []),
    ...(draft?.editor?.semanticAnchors || []),
  ];
  for (const value of values) {
    for (const word of readabilityWords(value)) allowed.add(word.toLowerCase());
  }
  return allowed;
}

export function assessUnderstandability(text, candidate = {}, draft = {}) {
  const words = readabilityWords(text);
  const allowed = allowedReadabilityTerms(candidate, draft);
  const unexplainedWords = words.filter((word) => {
    const normalized = word.toLowerCase().replace(/[’'-]/g, '');
    if (normalized.length < 10 || allowed.has(word.toLowerCase())) return false;
    if (/[A-Z].*[A-Z]|^[A-Z][a-z]+[A-Z]/.test(word)) return false;
    return true;
  });
  const unexplainedTerms = [...new Set(unexplainedWords.map((word) => word.toLowerCase()))];
  const sentences = (String(text || '').replace(/https?:\/\/\S+/g, 'URL').match(/[^.!?]+(?:[.!?]+|$)/g) || [])
    .map((part) => readabilityWords(part).length)
    .filter(Boolean);
  const maxSentenceWords = sentences.length ? Math.max(...sentences) : 0;
  const averageSentenceWords = sentences.length ? sentences.reduce((sum, count) => sum + count, 0) / sentences.length : 0;
  const unexplainedRatio = words.length ? unexplainedWords.length / words.length : 0;
  const compressionMarks = (String(text || '').match(/(?:\s[+→]\s|\/\p{L}|;|—|->)/gu) || []).length;
  const tooDense = words.length >= 12 && (
    maxSentenceWords > 34
    || (unexplainedWords.length >= 4 && unexplainedRatio >= 0.08 && compressionMarks >= 2)
    || (unexplainedWords.length >= 7 && unexplainedRatio >= 0.16 && maxSentenceWords >= 24)
  );
  return {
    passed: !tooDense,
    wordCount: words.length,
    maxSentenceWords,
    averageSentenceWords: Math.round(averageSentenceWords * 10) / 10,
    unexplainedWordCount: unexplainedWords.length,
    unexplainedRatio: Math.round(unexplainedRatio * 1000) / 1000,
    unexplainedTerms,
    compressionMarks,
  };
}

function allCapsLine(line) {
  const letters = String(line || '').match(/\p{L}/gu) || [];
  if (letters.length <= 5 || line !== line.toUpperCase()) return false;
  const words = line.match(/[A-Z]+/g) || [];
  return !(words.length && words.every((word) => CANONICAL_ACRONYMS.has(word)));
}

function hashtags(text) {
  const clean = String(text || '').replace(/https?:\/\/\S+/g, ' ').replace(/`[^`]*`/g, ' ');
  return [...clean.matchAll(/(?:^|\s)#([\p{L}\p{N}_]+)/gu)].map((match) => match[1]);
}

function hashtagsClearlyRelevant(tags, candidate, draft) {
  const context = [
    candidate?.text,
    candidate?.title,
    ...(candidate?.niche?.matches || []),
    ...(candidate?.niche?.tags || []),
    ...(draft?.editor?.semanticAnchors || []),
  ].filter(Boolean).join(' ').toLowerCase();
  const words = new Set(context.match(/[\p{L}\p{N}_]+/gu) || []);
  return tags.every((tag) => words.has(tag.toLowerCase()));
}

function emojiCount(text) {
  return (String(text || '').match(/\p{Extended_Pictographic}/gu) || []).length;
}

function duplicateAgainst(text, items) {
  let best = 0;
  let exact = false;
  for (const item of items) {
    const other = recentText(item);
    if (!other) continue;
    if (normalizedText(text) && normalizedText(text) === normalizedText(other)) exact = true;
    best = Math.max(best, similarity(text, other));
  }
  return { exact, similarity: best };
}

function mediaPlanComplete(media) {
  return MEDIA_TYPES.has(media?.type)
    && media.type !== 'none'
    && Boolean(String(media?.reason || '').trim())
    && Boolean(String(media?.source || '').trim())
    && Boolean(String(media?.altText || '').trim());
}

export function evaluateDraftGates(draft, candidate, {
  pipeline: requestedPipeline,
  behavior: requestedBehavior = null,
  relationship = null,
  recentPosts = [],
  recentReplies = [],
  recentReplyArchetypes = [],
  replyArchetype = '',
  mediaReady = false,
  relevanceOverride = null,
  conversationRelevanceCandidate = null,
  growthObjective = null,
  threadLengthApproved = false,
} = {}) {
  const pipeline = ensurePipeline(requestedPipeline || draft?.editor?.pipeline || 'original');
  const units = contentUnits(draft, pipeline);
  const primaryText = units[0] || '';
  const combinedText = pipeline === 'thread' ? units.join('\n\n') : primaryText;
  const behavior = normalizeBehaviorDecision(requestedBehavior || draft?.editor?.behavior || {}, { pipeline });
  const behaviorValidation = validateBehaviorDecision(behavior, { pipeline, requireAct: true });
  const failures = [];
  const warnings = [];
  const checks = {
    growthFocus: true,
    purposeIntegrity: true,
    factualProvenance: true,
    behaviorAlignment: true,
    originality: true,
    scannability: true,
    understandable: true,
    noPlaceholders: true,
    length: true,
    ctaIntegrity: true,
    recentDuplicate: true,
    hashtagCount: true,
    emojiCount: true,
    threadRules: true,
    mediaReady: true,
  };

  if (!behaviorValidation.valid) {
    checks.purposeIntegrity = false;
    checks.behaviorAlignment = false;
    addIssue(failures, 'BEHAVIOR_DECISION_INVALID', `Draft requires a valid ACT behavior decision: ${behaviorValidation.errors.join(' ')}`);
  } else if (!behaviorContextSupported(behavior, { pipeline, candidate, relationship, conversationRelevanceCandidate, draft })) {
    checks.purposeIntegrity = false;
    addIssue(failures, 'PURPOSE_CONTEXT_WEAK', 'The selected purpose is not supported by the current source, relationship, owner provenance, or conversation context.');
  } else if (!socialActRealized(behavior, { pipeline, candidate, relationship, conversationRelevanceCandidate, draft })) {
    checks.purposeIntegrity = false;
    addIssue(failures, 'SOCIAL_ACT_NOT_REALIZED', 'The source makes this social purpose available, but the draft does not actually perform the selected support, celebration, humor, de-escalation, relationship, or social-presence act.');
  }

  const ownerEvidenceGrounded = ownerEvidenceValid(draft, pipeline);
  if (explicitOwnerExperienceClaim(combinedText) && !ownerEvidenceGrounded) {
    checks.factualProvenance = false;
    addIssue(failures, 'OWNER_EXPERIENCE_UNGROUNDED', 'The draft makes an explicit first-person factual/experience claim without a human attestation bound to this exact text.');
  }
  if (impliedOwnerExperienceSignal(combinedText) && !ownerEvidenceGrounded) {
    addIssue(warnings, 'IMPLIED_OWNER_EXPERIENCE_REVIEW', 'The wording may imply personal use or lived experience that is not backed by a human attestation bound to this exact text.');
  }

  if (behaviorDecisionRequiresFactualEvidence(behavior)
      && behavior.primaryPurpose === 'correction'
      && !draft?.editor?.evidenceUsed?.length
      && !/https?:\/\/|\b(?:docs?|source|benchmark|measured|tested|release notes|according to|says)\b/i.test(combinedText)) {
    checks.factualProvenance = false;
    addIssue(failures, 'CORRECTION_EVIDENCE_MISSING', 'A consequential correction requires an inspectable source, evidence reference, or explicit attribution.');
  }

  let growthFit = assessStrategicRelevance(candidate, {
    objective: growthObjective,
    humanOverride: relevanceOverride,
  });
  if (pipeline === 'reply' && !growthFit.allowed && conversationRelevanceCandidate) {
    const conversationGrowthFit = assessStrategicRelevance(conversationRelevanceCandidate, {
      objective: growthObjective,
      humanOverride: relevanceOverride,
    });
    if (conversationGrowthFit.allowed) {
      growthFit = conversationGrowthFit;
      addIssue(warnings, 'ACTIVE_CONVERSATION_RELEVANCE_INHERITED', 'Reply relevance is inherited from the in-focus parent conversation instead of the isolated response text.');
    }
  }
  if (growthFit.state === 'unknown') {
    checks.growthFocus = false;
    addIssue(failures, 'GROWTH_FIT_UNKNOWN', 'Growth fit needs a current classification. Rescore candidates from Growth Focus before approval.');
  } else if (!growthFit.allowed) {
    checks.growthFocus = false;
    addIssue(failures, 'GROWTH_FOCUS_DECISION_REQUIRED', 'This opportunity is outside the configured technical scope. Choose “Use this opportunity anyway” and provide a reason before approval.');
  } else if (growthFit.state === 'outside' && growthFit.humanOverride) {
    addIssue(warnings, 'OUTSIDE_TECH_SCOPE_ACCEPTED', `Human decision to use an outside-scope opportunity: ${growthFit.humanOverride.reason}`);
  }

  const understandabilityUnits = units.map((unit) => assessUnderstandability(unit, candidate, draft));
  const opaqueUnit = understandabilityUnits.find((assessment) => !assessment.passed);
  if (opaqueUnit) {
    checks.understandable = false;
    const terms = opaqueUnit.unexplainedTerms.slice(0, 6).join(', ');
    addIssue(failures, 'UNDERSTANDABILITY_TOO_DENSE', `Rewrite so the point lands on one read. Humor, technical language, and a smart voice are fine; this version stacks too much compressed or unexplained wording${terms ? ` (${terms})` : ''}.`);
  } else {
    const borderline = understandabilityUnits.find((assessment) => assessment.compressionMarks >= 2 && assessment.unexplainedWordCount >= 3);
    if (borderline) {
      addIssue(warnings, 'UNDERSTANDABILITY_REVIEW', `This draft is compressed around several unexplained terms (${borderline.unexplainedTerms.slice(0, 6).join(', ')}). Keep the style if the point still lands immediately; otherwise unpack one phrase.`);
    }
  }

  const sourceText = candidate?.text || '';
  const sourceSimilarity = similarity(primaryText, sourceText);
  const sourceExact = normalizedText(primaryText) && normalizedText(primaryText) === normalizedText(sourceText);
  if (sourceExact || sourceSimilarity >= 0.70) {
    checks.originality = false;
    checks.purposeIntegrity = false;
    addIssue(failures, 'SOURCE_DUPLICATE', `Draft is an exact/near duplicate of the source (${sourceSimilarity.toFixed(2)} similarity).`);
  } else if (sourceSimilarity >= 0.50) {
    addIssue(warnings, 'SOURCE_SIMILARITY_WARNING', `Draft is close to the source (${sourceSimilarity.toFixed(2)} similarity); confirm it adds distinct value.`);
  }

  const socialOnly = behavior.informationDepth === 'social_only' && behaviorDecisionSupportsSocialOnly(behavior);
  const socialContextOkay = behaviorContextSupported(behavior, {
    pipeline,
    candidate,
    relationship,
    conversationRelevanceCandidate,
    draft,
  });
  if (pipeline === 'quote' && genericQuote(primaryText)) {
    if (!socialOnly || !socialContextOkay) {
      checks.purposeIntegrity = false;
      addIssue(failures, 'GENERIC_QUOTE_WITHOUT_PURPOSE', 'Short Quote commentary requires a supported social, relationship, taste, humor, or celebration purpose.');
    }
  } else if (pipeline === 'reply' && isGenericSocialPraise(primaryText)) {
    if (!socialOnly || !socialContextOkay) {
      checks.purposeIntegrity = false;
      addIssue(failures, 'GENERIC_REPLY_WITHOUT_PURPOSE', 'Short praise or reaction requires a supported social or relationship purpose in this context.');
    }
  } else if (pipeline === 'thread') {
    const hasAnalysis = units.slice(1).some((part) => /\b(?:because|result|benchmark|evidence|failure|tradeoff|implementation|latency|cost|compare|measured|tested|code|command)\b/i.test(part))
      || Boolean(draft?.editor?.evidenceUsed?.length);
    if (behaviorDecisionRequiresFactualEvidence(behavior) && units.length >= 2 && !hasAnalysis) {
      addIssue(warnings, 'THREAD_EVIDENCE_REVIEW', 'This evidence-dependent thread has no obvious evidence or analysis marker after the opener.');
    }
  } else if (pipeline === 'original' && genericQuote(primaryText)) {
    checks.purposeIntegrity = false;
    addIssue(failures, 'CONTEXTLESS_GENERIC_ORIGINAL', 'A contextless generic reaction is not a complete Original. Name or show the object, or use a source-bearing format.');
  } else if (pipeline === 'original' && sourceSimilarity >= 0.50) {
    addIssue(warnings, 'ORIGINAL_SOURCE_PROXIMITY_REVIEW', 'Original is source-adjacent; confirm its selected purpose goes beyond paraphrase.');
  }

  const recentMain = Array.isArray(recentPosts) ? recentPosts.slice(0, 20) : [];
  const recentReplyItems = Array.isArray(recentReplies) ? recentReplies.slice(0, 20) : [];
  const duplicatePool = pipeline === 'reply' ? [...recentMain, ...recentReplyItems] : recentMain;
  const recentDuplicate = duplicateAgainst(primaryText, duplicatePool);
  if (recentDuplicate.exact || recentDuplicate.similarity >= 0.70) {
    checks.recentDuplicate = false;
    addIssue(failures, 'RECENT_DUPLICATE', `Draft matches recent published/approved text at ${recentDuplicate.similarity.toFixed(2)} similarity.`);
  } else if (recentDuplicate.similarity >= 0.50) {
    addIssue(warnings, 'RECENT_SIMILARITY_WARNING', `Draft is similar to recent published/approved text (${recentDuplicate.similarity.toFixed(2)}).`);
  }

  if (pipeline === 'reply' && replyArchetype && recentReplyArchetypes.includes(replyArchetype)) {
    addIssue(warnings, 'REPLY_ARCHETYPE_REPEATED', `Reply archetype "${replyArchetype}" was used recently; vary it only if another form is equally useful.`);
  }

  if (pipeline === 'thread') {
    for (let index = 0; index < units.length; index++) {
      if (!units[index]) {
        checks.threadRules = false;
        addIssue(failures, 'THREAD_EMPTY_PART', `Thread part ${index + 1} is empty.`);
      }
      if (weightedPostLength(units[index]) > 280) {
        checks.length = false;
        addIssue(failures, 'THREAD_PART_TOO_LONG', `Thread part ${index + 1} is ${weightedPostLength(units[index])}/280 weighted characters.`);
      }
      if (index > 0) {
        const adjacent = duplicateAgainst(units[index], [units[index - 1]]);
        if (adjacent.exact || adjacent.similarity >= 0.70) {
          checks.threadRules = false;
          addIssue(failures, 'THREAD_PART_DUPLICATE', `Thread parts ${index} and ${index + 1} are exact/near duplicates.`);
        } else if (adjacent.similarity >= 0.50) {
          addIssue(warnings, 'THREAD_PART_SIMILARITY_WARNING', `Thread parts ${index} and ${index + 1} are similar (${adjacent.similarity.toFixed(2)}).`);
        }
      }
    }
    if (units.length < 2 || (units.length > 6 && !threadLengthApproved)) {
      checks.threadRules = false;
      addIssue(failures, 'THREAD_PART_COUNT', `Thread has ${units.length} parts; use 2-6 unless a human explicitly approves a longer thread.`);
    } else if (units.length > 6) {
      addIssue(warnings, 'LONG_THREAD_APPROVED', `Thread has ${units.length} parts with explicit human length approval.`);
    }
    if (!primaryText.trim() || PLACEHOLDER.test(primaryText)) {
      checks.threadRules = false;
      addIssue(failures, 'THREAD_OPENER_INCOMPLETE', 'Thread Post 1 must contain non-placeholder text that orients the reader to the selected act.');
    }
    if (/^\s*1\/(?:\d+)?(?:\s|$)/i.test(primaryText) && /\b(?:thread|more below|read on|keep reading|details below|here'?s why)\b/i.test(primaryText)) {
      checks.threadRules = false;
      addIssue(failures, 'THREAD_TEASER', 'Thread Post 1 uses a numbered teaser pattern that appears to withhold the useful conclusion.');
    }
  } else {
    const firstLine = (blocks(primaryText)[0] || '').split('\n')[0] || '';
    if (allCapsLine(firstLine)) {
      addIssue(warnings, 'ALL_CAPS_FIRST_LINE_REVIEW', 'First line is all caps; keep it only when the selected affect and context justify that intensity.');
    }
    const length = weightedPostLength(primaryText);
    if (length > 280) {
      checks.length = false;
      addIssue(failures, 'TOO_LONG', `Single post is ${length}/280 weighted characters.`);
    }
  }

  if (units.some((part) => PLACEHOLDER.test(part))) {
    checks.noPlaceholders = false;
    addIssue(failures, 'PLACEHOLDER', 'Draft contains bracketed scaffold placeholder text.');
  }

  const baitPatterns = [
    /\blike if you agree\b/i,
    /\brt if\b/i,
    /\brepost if\b/i,
    /\bcomment\s+["']?yes["']?\b/i,
    /\bfollow for part\b/i,
    /\bfollow me for\b/i,
    /\bshare this everywhere\b/i,
    /\btag 3 friends\b/i,
    /\bdrop your handle\b/i,
    /\b(?:agree|thoughts)\?\s*$/i,
  ];
  if (baitPatterns.some((pattern) => units.some((part) => pattern.test(part)))) {
    checks.ctaIntegrity = false;
    addIssue(failures, 'CTA_BAIT', 'Draft contains engagement bait or a metric-only discussion prompt.');
  }
  if (units.some((part) => /\bfollow(?: me)? for more\b/i.test(part))) {
    addIssue(warnings, 'FOLLOW_CTA_WARNING', 'A follow-for-more CTA is present; human review should normally remove it unless contextually justified after substantial value.');
  }

  const foundHashtags = hashtags(combinedText);
  if (foundHashtags.length > 2) {
    checks.hashtagCount = false;
    addIssue(failures, 'TOO_MANY_HASHTAGS', `Draft has ${foundHashtags.length} hashtags; hard maximum is 2.`);
  } else if (foundHashtags.length === 2 && !hashtagsClearlyRelevant(foundHashtags, candidate, draft)) {
    addIssue(warnings, 'TWO_HASHTAGS_REVIEW', 'Draft uses 2 hashtags; keep both only when both are directly relevant/canonical (EMPIRICAL_VARIABLE).');
  }

  const emojis = emojiCount(combinedText);
  if (emojis > 1) {
    checks.emojiCount = false;
    addIssue(failures, 'TOO_MANY_EMOJI', `Draft has ${emojis} extended-pictographic emoji matches; default maximum is 1.`);
  }

  const media = draft?.editor?.media || {};
  if (media.required === true) {
    const planComplete = mediaPlanComplete(media);
    if (!planComplete) {
      checks.mediaReady = false;
      addIssue(failures, 'MEDIA_PLAN_INCOMPLETE', 'Required media needs type, reason, source/local evidence reference, and alt text.');
    }
    if (!mediaReady) {
      checks.mediaReady = false;
      addIssue(failures, 'MEDIA_NOT_READY', 'Required media is not attached/ready; attach an image before approval or revise the visual plan so media is no longer required.');
    }
  }

  return { passed: failures.length === 0, failures, warnings, checks };
}

export function reviewGrowthPackaging(draft, candidate, context = {}) {
  const pipeline = ensurePipeline(context?.pipeline || draft?.editor?.pipeline || 'original');
  const units = contentUnits(draft, pipeline);
  const text = units.join('\n\n').trim();
  const firstLine = String(units[0] || '').split('\n')[0].trim();
  const editor = draft?.editor || {};
  const blockers = [];
  const behavior = normalizeBehaviorDecision(context.behavior || editor.behavior || {}, { pipeline });
  const behaviorValidation = validateBehaviorDecision(behavior, { pipeline, requireAct: true });
  const strategyMode = context.strategyMode ?? null;
  const strategyLabel = strategyMode === 'apply' ? 'Use for this draft' : strategyMode === 'suggest' ? 'Advice only' : strategyMode === 'off' ? 'No influence' : 'Missing decision';
  const socialOnly = behavior.informationDepth === 'social_only' && behaviorDecisionSupportsSocialOnly(behavior);
  const stoppingClear = Boolean(text) && (socialOnly ? !PLACEHOLDER.test(text) : usefulText(firstLine, 12));
  const payoffSignals = [];
  if (/\b(?:install|try|use|run|configure|download|repo(?:sitory)?|resource|guide|docs|library|package|cli)\b/i.test(text)) payoffSignals.push('useful resource/action');
  if (/\b(?:choose|avoid|switch|compare|trade-?off|decision|rule of thumb|when to|better for|worse for)\b/i.test(text)) payoffSignals.push('decision support');
  if (/\b(?:benchmark|measured|tested|result|latency|throughput|cost)\b/i.test(text)) payoffSignals.push('proof/evidence');
  const sourceSimilarity = similarity(text, candidate?.text || '');
  if (usefulText(text, 40)
    && sourceSimilarity < 0.80
    && /(?:\b(?:means|matters|because|instead|constraint|trade-?off|bottleneck|risk|before|after|if|when|not)\b|—)/i.test(text)) {
    payoffSignals.push('specific insight');
  }
  const hasPublicQuestion = Boolean(text) && /\?/.test(text);
  if (hasPublicQuestion) payoffSignals.push('question/conversation opening');
  if (socialOnly
    && behaviorContextSupported(behavior, {
      pipeline,
      candidate,
      relationship: context.relationship,
      conversationRelevanceCandidate: context.conversationRelevanceCandidate,
      draft,
    })
    && socialActRealized(behavior, {
      pipeline,
      candidate,
      relationship: context.relationship,
      conversationRelevanceCandidate: context.conversationRelevanceCandidate,
      draft,
    })) payoffSignals.push('contextual social/relationship act');
  const readerPayoffClear = behaviorValidation.valid && payoffSignals.length > 0;
  if (!behaviorValidation.valid) blockers.push({ code: 'BEHAVIOR_DECISION_INVALID', message: behaviorValidation.errors.join(' ') });
  else if (!readerPayoffClear) blockers.push({ code: 'NO_CLEAR_PURPOSE_PAYOFF', message: 'The current draft does not visibly fulfill its selected purpose.' });

  const resourcePromise = /\b(?:here(?:'s| is)|check out|try|install|use this|repo(?:sitory)?|resource|open[- ]source (?:tool|library|project)|tool you can|available at)\b/i.test(text);
  const explicitUrl = /https?:\/\/\S+/i.test(text);
  const nativeSourcePath = pipeline === 'quote' && candidate?.source === 'x';
  const sourcePathReady = !resourcePromise || explicitUrl || nativeSourcePath;
  if (!sourcePathReady) blockers.push({ code: 'RESOURCE_ACTION_PATH_MISSING', message: 'The draft promises a resource/tool but gives the reader no usable source or action path.' });
  const generationStrategyStale = context.hasGenerationProvenance === true && (
    context.generationStrategySelectionId == null
    || Number(context.generationStrategySelectionId) !== Number(context.strategySelectionId)
    || context.generationStrategyMode !== strategyMode
  );
  const strategyRequired = pipeline !== 'reply';
  if (strategyRequired && !strategyMode) blockers.push({ code: 'STRATEGY_DECISION_MISSING', message: 'Save No influence, Advice only, or Use for this draft before approval.' });
  else if (strategyRequired && generationStrategyStale) blockers.push({ code: 'STRATEGY_GENERATION_STALE', message: 'This AI generation does not carry the current writing-strategy decision. Regenerate before approval.' });

  const media = editor.media || {};
  const mediaPublishingAvailable = context.mediaPublishingAvailable === true;
  const mediaStatus = media.required === true
    ? mediaPublishingAvailable ? 'planned' : 'unavailable'
    : media.type && media.type !== 'none' ? mediaPublishingAvailable ? 'planned' : 'unavailable' : 'unnecessary';

  return {
    ready: blockers.length === 0,
    blockers,
    items: {
      stoppingPower: { status: stoppingClear ? 'clear' : 'review', detail: stoppingClear ? 'The selected act is legible at the required depth.' : 'The opening or complete short act is too thin to realize the selected behavior.' },
      readerPayoff: { status: readerPayoffClear ? 'clear' : 'blocked', detail: readerPayoffClear ? [...new Set(payoffSignals)].join(', ') : 'The selected purpose is not evident in the draft.' },
      distributionLeverage: { status: pipeline === 'quote' || pipeline === 'reply' ? 'borrowed_context' : 'owned_only', detail: pipeline === 'quote' ? 'Native Quote can borrow legitimate attention from the source conversation.' : pipeline === 'reply' ? 'Reply participates directly in the source conversation.' : 'Owned-only distribution; a cold-start account gets little graph help from format alone.' },
      sourceActionPath: { status: sourcePathReady ? (resourcePromise ? 'clear' : 'not_needed') : 'blocked', detail: sourcePathReady ? resourcePromise ? (nativeSourcePath ? 'The native quoted source is the action/source path.' : 'The public copy contains a usable URL/action path.') : 'This draft does not promise a resource/action path.' : 'Add a usable URL/source path or change the copy so it no longer promises a resource.' },
      interactionOpening: { status: hasPublicQuestion ? 'present' : 'optional', detail: hasPublicQuestion ? 'The public copy contains a question; confirm it serves the selected technical, social, playful, or rhetorical purpose.' : 'No forced question; the selected act may already be complete.' },
      mediaOpportunity: { status: mediaStatus, detail: mediaStatus === 'unavailable' ? 'Media is planned, but the current X transport cannot publish attachments.' : mediaStatus === 'planned' ? 'A real attachment path is available for this media plan.' : 'No media is required for this draft.' },
      strategyState: pipeline === 'reply'
        ? { status: 'not_required', mode: null, label: 'Engage Next reply', detail: 'Main-feed Writing Approach is not required for the reply lane; the persisted behavior decision owns purpose, mode, affect, and depth.' }
        : { status: strategyMode && !generationStrategyStale ? 'clear' : 'blocked', mode: strategyMode, label: strategyLabel, detail: generationStrategyStale ? 'The saved writing choice changed after this AI generation; regenerate before approval.' : strategyMode === 'apply' ? (context.strategyApproach || 'The persisted Apply selection is the active Writer hypothesis.') : strategyMode === 'suggest' ? 'Guidance is visible but does not enter Writer.' : strategyMode === 'off' ? 'Strategy influence is explicitly off.' : 'No human strategy decision is persisted.' },
    },
  };
}

export function scoreDraft(draft, candidate, context = {}) {
  const gateAware = arguments.length >= 3;
  const pipeline = gateAware ? ensurePipeline(context?.pipeline || draft?.editor?.pipeline || 'original') : 'original';
  const units = contentUnits(draft, pipeline);
  const body = units[0] ?? '';
  const text = units.join('\n\n').trim();
  const sourceSimilarity = similarity(body, candidate?.text || '');
  const weightedLength = pipeline === 'thread'
    ? Math.max(0, ...units.map((part) => weightedPostLength(part)))
    : weightedPostLength(body);
  const minimumScore = pipeline === 'reply' ? 30 : 40;

  if (!gateAware) {
    const textBlocks = String(body || '').split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
    const firstLine = String(textBlocks[0] || body || '').split('\n')[0].trim();
    const insightText = textBlocks.length > 1 ? textBlocks.slice(1).join(' ') : String(body || '').trim();
    const finalBlock = textBlocks.at(-1) || '';
    const hook = usefulText(firstLine, 20) ? 8 : firstLine ? 3 : 0;
    const insight = usefulText(insightText, 45) ? 10 : usefulText(body, 60) ? 6 : String(body || '').trim() ? 3 : 0;
    const evidence = usefulText(body, 30) && /(?:\b\d+(?:\.\d+)?(?:%|x|ms|s|gb|mb|k|m)?\b|https?:\/\/|\b(?:benchmark|latency|cost|result|tested|measured|source|docs)\b)/i.test(body) ? 10 : body ? 4 : 0;
    const action = usefulText(finalBlock, 24) && /(?:\?|\b(?:try|use|run|install|compare|avoid|switch|check|measure|test)\b)/i.test(finalBlock) ? 7 : finalBlock ? 2 : 0;
    const originality = !String(body || '').trim() ? 0 : sourceSimilarity < 0.30 ? 5 : sourceSimilarity < 0.50 ? 3 : 0;
    const score = Math.round(((hook + insight + evidence + action + originality) / 40) * 50);
    const quality = score >= 45 ? 'high' : score >= 40 ? 'strong' : score >= 30 ? 'standard' : 'incomplete';
    return {
      score,
      minimumScore,
      quality,
      breakdown: { hook, insight, evidence, action, originality },
      sourceSimilarity,
      weightedLength,
      publishable: score >= minimumScore && !PLACEHOLDER.test(body) && weightedLength <= 280,
    };
  }

  const gates = evaluateDraftGates(draft, candidate, context);
  const growthPackaging = reviewGrowthPackaging(draft, candidate, context);
  const behavior = normalizeBehaviorDecision(context.behavior || draft?.editor?.behavior || {}, { pipeline });
  const behaviorValidation = validateBehaviorDecision(behavior, { pipeline, requireAct: true });
  const purpose = behaviorValidation.valid && gates.checks?.purposeIntegrity === true ? 10 : 0;
  const clarity = text && gates.checks?.understandable === true ? 10 : text ? 4 : 0;
  const provenance = gates.checks?.factualProvenance === true ? 10 : 0;
  const originality = gates.checks?.originality === true && gates.checks?.recentDuplicate === true
    ? 10
    : gates.checks?.originality === true ? 5 : 0;
  const realization = text
    && gates.checks?.length === true
    && gates.checks?.noPlaceholders === true
    && gates.checks?.behaviorAlignment === true
    && growthPackaging.items?.readerPayoff?.status === 'clear'
    ? 10
    : text ? 4 : 0;
  const score = purpose + clarity + provenance + originality + realization;
  const quality = score >= 45 ? 'high' : score >= 40 ? 'strong' : score >= 30 ? 'standard' : 'incomplete';

  return {
    score,
    minimumScore,
    quality,
    breakdown: { purpose, clarity, provenance, originality, realization },
    behavior,
    sourceSimilarity,
    weightedLength,
    publishable: score >= minimumScore && gates.passed && growthPackaging.ready,
    gates,
    growthPackaging,
  };
}
