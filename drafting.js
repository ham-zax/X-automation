import { NICHE_LABELS, assessStrategicRelevance } from './strategy.js';

const PLACEHOLDER = /\[[^\]]+\]/;
const CONTENT_PIPELINES = new Set(['original', 'quote', 'thread', 'reply']);
const WRITER_DECISIONS = new Set(['POST', 'DO_NOT_POST']);
const MEDIA_TYPES = new Set(['none', 'screenshot', 'chart', 'code', 'diagram']);
const CANONICAL_ACRONYMS = new Set(['AI', 'API', 'CLI', 'CPU', 'GPU', 'HTTP', 'JSON', 'LLM', 'MCP', 'RAG', 'SDK', 'SQL']);

function ensurePipeline(pipeline = 'original') {
  if (!CONTENT_PIPELINES.has(pipeline)) throw new Error(`Invalid content pipeline: ${pipeline}`);
  return pipeline;
}

function firstSignal(candidate) {
  const matches = candidate?.niche?.matches || [];
  if (matches.length) return matches.slice(0, 2).join(' + ');
  const words = String(candidate?.text || '').replace(/https?:\/\/\S+/g, '').trim().split(/\s+/).slice(0, 8);
  return words.join(' ') || 'developer signal';
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
  const primaryTag = candidate?.niche?.tags?.[0];
  const niche = NICHE_LABELS[primaryTag] || 'Developer/AI';
  const signal = firstSignal(candidate);
  const draft = {
    candidateKey: candidate.key || candidate.url,
    hook: `${niche}: ${signal} — [state the non-obvious finding, not the headline]`,
    insight: '[Explain what changes for a developer workflow, architecture, cost, speed, or product decision.]',
    evidence: `[Add a primary-source fact, benchmark, command, screenshot, or result.]\nSource: ${candidate.url}`,
    action: '[Give the developer one concrete thing to try, compare, configure, or avoid.]',
    status: 'draft',
    scheduledAt: null,
  };

  if (pipeline === 'quote') {
    draft.hook = `${niche}: ${signal} — [Add a consequence, test, comparison, correction, limitation, or informed question; do not summarize the source.]`;
    draft.insight = '[Explain the distinct developer implication that the visible source does not already provide.]';
    draft.action = '[Give the developer a concrete implication, decision rule, or useful question.]';
  } else if (pipeline === 'reply') {
    draft.hook = '[Address the actual source or conversation directly.]';
    draft.insight = '[Contribute one concrete implementation detail, caveat, comparison, correction, answer, or informed question.]';
    draft.evidence = `[Add verified supporting evidence only when it improves the reply.]\nSource: ${candidate.url}`;
    draft.action = '';
  } else if (pipeline === 'thread') {
    draft.threadParts = [
      '[Post 1: state the complete high-level finding; do not tease or withhold the conclusion.]',
      '[Post 2: add a distinct evidence or implementation block and end with a developer takeaway/action.]',
    ];
  }

  draft.body = pipeline === 'thread' ? '' : composeDraft(draft, { pipeline });
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
  return {
    account: {
      identity: 'AI-native developer + builder',
      promise: 'turn fast-moving AI/software signals into developer decisions',
      language: 'English',
    },
    pipeline,
    candidate: {
      source: candidate?.source ?? null,
      author: candidateAuthor(candidate),
      text: candidate?.text ?? '',
      url: candidate?.url ?? '',
      niche: candidate?.niche ?? null,
      metrics: candidate?.metrics ?? {},
      viral: candidate?.viral ?? null,
    },
    queue: {
      reachPotential: queueItem?.reachPotential ?? null,
      followPotential: queueItem?.followPotential ?? null,
      conversationPotential: queueItem?.conversationPotential ?? null,
      relationshipPotential: queueItem?.relationshipPotential ?? null,
      routingReason: queueItem?.routingReason ?? '',
    },
    relationship: relationship ?? queueItem?.relationship ?? null,
    evidence: (Array.isArray(evidence) ? evidence : []).map(writerEvidenceItem).filter(Boolean),
    editorial: editorialRecommendation ? {
      recommendationId: editorialRecommendation.id ?? null,
      thesis: editorialRecommendation.thesis ?? '',
      desiredReaderOutcome: editorialRecommendation.desiredReaderOutcome ?? '',
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
    ...(writingStrategy ? { writingStrategy } : {}),
    currentDraft: writerCurrentDraft(draft),
    constraints: {
      singlePostWeightedLimit: 280,
      hashtagsPreferredMax: 1,
      hashtagsHardMax: 2,
      emojiMax: 1,
      semanticAnchorsTarget: [1, 3],
    },
    promptDocument: 'docs/POST_GENERATION_PROMPT.md',
  };
}

export function applyWriterOutput(draft, writerOutput = {}, { generationProvenance = null } = {}) {
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

  const editor = {
    decision,
    pipeline,
    thesis: String(writerOutput?.thesis ?? '').trim(),
    finalText: String(writerOutput?.finalText ?? '').trim(),
    threadParts: asStringArray(writerOutput?.threadParts),
    semanticAnchors: asStringArray(writerOutput?.semanticAnchors).filter(Boolean),
    evidenceUsed: asStringArray(writerOutput?.evidenceUsed).filter(Boolean),
    discussionQuestion: String(writerOutput?.discussionQuestion ?? '').trim(),
    media: {
      required: mediaInput.required ?? false,
      type: mediaType,
      reason: String(mediaInput.reason ?? '').trim(),
      source: String(mediaInput.source ?? '').trim(),
      altText: String(mediaInput.altText ?? '').trim(),
    },
    riskFlags: asStringArray(writerOutput?.riskFlags).filter(Boolean),
    followReason: String(writerOutput?.followReason ?? writerOutput?.followValue ?? '').trim(),
    notes: String(writerOutput?.notes ?? '').trim(),
  };
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

function claimNeedsEvidence(text, sourceText) {
  const body = String(text || '');
  if (/\b(?:i|we)\s+(?:tested|measured|benchmarked|used|ran|observed|verified|found)\b/i.test(body)) return true;
  if (/\b(?:benchmark|latency|throughput|measured|tested|result(?:s)?|faster|slower|costs?)\b/i.test(body)) return true;
  if (/\b\d+(?:\.\d+)?\s?(?:%|x|ms|s|sec|seconds?|tokens?|rps|req\/s|mb|gb|usd)\b/i.test(body)) return true;

  const capability = /\b(?:supports?|allows?|adds?|ships?|includes?|handles?|runs?|works with|can|now has)\b/i;
  return body.split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => sentence.length >= 20 && capability.test(sentence))
    .some((sentence) => similarity(sentence, sourceText) < 0.30);
}

function firstPersonEvidenceClaim(text) {
  return /\b(?:i|we)\s+(?:tested|measured|benchmarked|used|ran|observed|verified|found|tried)\b/i.test(String(text || ''));
}

function evidenceId(item) {
  return String(item?.id ?? '').trim();
}

function resolveEvidenceReferences(draft, evidence = null) {
  const contextProvided = Array.isArray(evidence);
  const rows = contextProvided ? evidence : [];
  const byId = new Map(rows.map((item) => [evidenceId(item), item]).filter(([id]) => id));
  const requested = asStringArray(draft?.editor?.evidenceUsed || []).filter(Boolean);
  const invalidIds = contextProvided ? requested.filter((id) => !byId.has(id)) : [];
  const resolved = requested.map((id) => byId.get(id)).filter(Boolean);
  return { requested, resolved, invalidIds, availableCount: byId.size, contextProvided };
}

function eligibleEvidence(item) {
  return ['primary_supported', 'source_claim'].includes(String(item?.status || ''));
}

function firstPartyEvidence(item) {
  if (String(item?.status || '') !== 'primary_supported') return false;
  if (item?.metadata?.firstParty === true || item?.metadata?.ownedEvidence === true) return true;
  const identity = `${item?.sourceKind || ''} ${item?.sourceFamily || ''}`;
  return /\b(?:first[-_ ]?party|owned|our|ham_zax|experiment|measurement)\b/i.test(identity);
}

function claimTypes(sentence) {
  const types = [];
  if (/\b(?:benchmark|eval(?:uation)?|score|accuracy|pass rate)\b/i.test(sentence)) types.push('benchmark');
  if (/\b(?:performance|latency|throughput|faster|slower|speed|tokens?\s*\/\s*s|rps|req(?:uests?)?\s*\/\s*s|\d+(?:\.\d+)?\s*ms\b)/i.test(sentence)) types.push('performance');
  if (/\b(?:supports?|allows?|adds?|ships?|includes?|handles?|works with|compatible with|can now|now has)\b/i.test(sentence)) types.push('capability');
  return [...new Set(types)];
}

function attributedSourceClaim(sentence) {
  return /\b(?:according to|reports?|reported|says?|said|claims?|claimed|announces?|announced|release notes?|documentation|docs|readme|maintainer|vendor|author)\b/i.test(sentence);
}

const CLAIM_SCOPE_STOP_WORDS = new Set([
  'according', 'report', 'reports', 'reported', 'say', 'says', 'said', 'claim', 'claims', 'claimed',
  'announce', 'announces', 'announced', 'vendor', 'author', 'maintainer', 'model', 'tool', 'system',
  'support', 'supports', 'allow', 'allows', 'add', 'adds', 'ship', 'ships', 'include', 'includes',
  'handle', 'handles', 'work', 'works', 'with', 'can', 'now', 'has', 'have', 'the', 'this', 'that',
]);

function claimScopeTokens(text) {
  return new Set((String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9+.#/-]{2,}/g) || [])
    .filter((token) => !CLAIM_SCOPE_STOP_WORDS.has(token)));
}

function persistedClaimMatches(item, sentence, { requireAttribution = false } = {}) {
  if (requireAttribution && !attributedSourceClaim(sentence)) return false;
  const evidenceParts = [item?.claim, item?.title, item?.summary].map((value) => String(value || '')).filter(Boolean);
  const evidenceText = evidenceParts.join(' ');
  const numbers = String(sentence).match(/\d+(?:\.\d+)?/g) || [];
  if (numbers.length && numbers.some((value) => !evidenceText.includes(value))) return false;
  const requested = claimScopeTokens(sentence);
  if (!requested.size) return false;
  return evidenceParts.some((part) => {
    const available = claimScopeTokens(part);
    let overlap = 0;
    for (const token of requested) if (available.has(token)) overlap += 1;
    return overlap >= Math.min(2, requested.size);
  });
}

function primaryEvidenceSupportsType(item, type, sentence) {
  const claimType = String(item?.claimType || '');
  const compatibleType = type === 'benchmark'
    ? claimType === 'benchmark'
    : type === 'performance'
      ? ['performance', 'benchmark'].includes(claimType)
      : type === 'capability' && ['capability', 'implementation', 'compatibility'].includes(claimType);
  return compatibleType && persistedClaimMatches(item, sentence);
}

function sourceClaimMatchesSentence(item, sentence) {
  return persistedClaimMatches(item, sentence, { requireAttribution: true });
}

function supportsSensitiveClaim(item, type, sentence) {
  const status = String(item?.status || '');
  if (status === 'primary_supported') return primaryEvidenceSupportsType(item, type, sentence);
  if (status === 'source_claim') return sourceClaimMatchesSentence(item, sentence);
  return false;
}

function genericPraise(text) {
  const body = String(text || '').trim();
  const praise = /\b(?:great point|great post|love this|well said|spot on|exactly|awesome|amazing|nice|this is great|this is huge)\b/i.test(body);
  const contribution = /\?|https?:\/\/|\b(?:because|but|however|if|when|unless|benchmark|latency|api|sdk|code|model|agent|context|token|cost|failure|tradeoff|compare|test|measure)\b/i.test(body);
  return praise && !contribution && body.split(/\s+/).length <= 24;
}

function genericQuote(text) {
  return /^\s*(?:this is (?:huge|great|wild|massive)(?: for developers)?|huge for developers|game changer|big news)[.!]?\s*$/i.test(String(text || ''));
}

function blocks(text) {
  return String(text || '').split(/\n+/).map((block) => block.trim()).filter(Boolean);
}

function sentenceCount(text) {
  const clean = String(text || '').replace(/https?:\/\/\S+/g, 'URL');
  return (clean.match(/[^.!?]+(?:[.!?]+|$)/g) || []).map((part) => part.trim()).filter(Boolean).length;
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
  recentPosts = [],
  recentReplies = [],
  recentReplyArchetypes = [],
  replyArchetype = '',
  factualityConfirmed = false,
  evidenceConfirmed = false,
  evidence = null,
  mediaReady = false,
  relevanceOverride = null,
  growthObjective = null,
  threadLengthApproved = false,
} = {}) {
  const pipeline = ensurePipeline(requestedPipeline || draft?.editor?.pipeline || 'original');
  const units = contentUnits(draft, pipeline);
  const primaryText = units[0] || '';
  const combinedText = pipeline === 'thread' ? units.join('\n\n') : primaryText;
  const failures = [];
  const warnings = [];
  const checks = {
    factualityConfirmed: true,
    evidenceConfirmed: true,
    evidenceReferences: true,
    claimScope: true,
    growthFocus: true,
    additiveValue: true,
    originality: true,
    scannability: true,
    noPlaceholders: true,
    length: true,
    ctaIntegrity: true,
    recentDuplicate: true,
    hashtagCount: true,
    emojiCount: true,
    firstPersonEvidence: true,
    threadRules: true,
    mediaReady: true,
  };

  if (!factualityConfirmed) {
    checks.factualityConfirmed = false;
    addIssue(failures, 'FACTUALITY_UNCONFIRMED', 'Factuality must be explicitly confirmed before approval.');
  }

  const evidenceRequired = claimNeedsEvidence(combinedText, candidate?.text || '');
  if (evidenceRequired && !evidenceConfirmed) {
    checks.evidenceConfirmed = false;
    addIssue(failures, 'EVIDENCE_UNCONFIRMED', 'This draft contains test, measurement, benchmark, result, or unsupported capability claims that require explicit evidence confirmation.');
  }

  const evidenceReferences = resolveEvidenceReferences(draft, evidence);
  if (evidenceReferences.invalidIds.length) {
    checks.evidenceReferences = false;
    addIssue(failures, 'EVIDENCE_REFERENCE_INVALID', `Draft cites evidence IDs that were not supplied: ${evidenceReferences.invalidIds.join(', ')}.`);
  }
  const ineligibleEvidence = evidenceReferences.resolved.filter((item) => !eligibleEvidence(item));
  if (ineligibleEvidence.length) {
    checks.evidenceReferences = false;
    addIssue(failures, 'EVIDENCE_REFERENCE_INELIGIBLE', `Draft cites unresolved or contradicted evidence IDs: ${ineligibleEvidence.map(evidenceId).join(', ')}.`);
  }
  const eligibleCitedEvidence = evidenceReferences.resolved.filter(eligibleEvidence);
  if (evidenceRequired && evidenceReferences.availableCount > 0 && eligibleCitedEvidence.length === 0) {
    checks.evidenceReferences = false;
    addIssue(failures, 'EVIDENCE_REFERENCE_REQUIRED', 'This researched claim must cite at least one supplied eligible evidence ID.');
  }

  const sensitiveSentences = String(combinedText || '').split(/(?<=[.!?])\s+|\n+/).map((sentence) => sentence.trim()).filter(Boolean);
  for (const sentence of sensitiveSentences) {
    for (const type of claimTypes(sentence)) {
      if (eligibleCitedEvidence.some((item) => supportsSensitiveClaim(item, type, sentence))) continue;
      if (!eligibleCitedEvidence.length) continue;
      checks.claimScope = false;
      addIssue(failures, 'EVIDENCE_CLAIM_SCOPE_MISMATCH', `Cited evidence does not support the draft's ${type} claim at its persisted claim scope.`);
    }
  }

  if (firstPersonEvidenceClaim(combinedText) && !eligibleCitedEvidence.some(firstPartyEvidence)) {
    checks.firstPersonEvidence = false;
    addIssue(failures, 'FIRST_PERSON_EVIDENCE_UNVERIFIED', 'First-person test/measurement language requires a supplied eligible first-party evidence ID.');
  }

  const growthFit = assessStrategicRelevance(candidate, {
    objective: growthObjective,
    humanOverride: relevanceOverride,
  });
  if (growthFit.state === 'unknown') {
    checks.growthFocus = false;
    addIssue(failures, 'GROWTH_FIT_UNKNOWN', 'Growth fit needs a current classification. Rescore candidates from Growth Focus before approval.');
  } else if (!growthFit.allowed) {
    checks.growthFocus = false;
    addIssue(failures, 'GROWTH_FOCUS_DECISION_REQUIRED', 'This opportunity is outside the current Growth Focus. Choose “Use this opportunity anyway” and provide a reason before approval.');
  } else if (growthFit.state === 'outside' && growthFit.humanOverride) {
    addIssue(warnings, 'OUTSIDE_GROWTH_FOCUS_ACCEPTED', `Human decision to use an outside-focus opportunity: ${growthFit.humanOverride.reason}`);
  }

  const sourceText = candidate?.text || '';
  const sourceSimilarity = similarity(primaryText, sourceText);
  const sourceExact = normalizedText(primaryText) && normalizedText(primaryText) === normalizedText(sourceText);
  if (sourceExact || sourceSimilarity >= 0.70) {
    checks.originality = false;
    checks.additiveValue = false;
    addIssue(failures, 'SOURCE_DUPLICATE', `Draft is an exact/near duplicate of the source (${sourceSimilarity.toFixed(2)} similarity).`);
  } else if (sourceSimilarity >= 0.50) {
    addIssue(warnings, 'SOURCE_SIMILARITY_WARNING', `Draft is close to the source (${sourceSimilarity.toFixed(2)} similarity); confirm it adds distinct value.`);
  }

  if (pipeline === 'quote' && genericQuote(primaryText)) {
    checks.additiveValue = false;
    addIssue(failures, 'NON_ADDITIVE_QUOTE', 'Quote commentary is generic and does not add a thesis, consequence, test, comparison, limitation, correction, or informed question.');
  } else if (pipeline === 'reply' && genericPraise(primaryText)) {
    checks.additiveValue = false;
    addIssue(failures, 'GENERIC_REPLY', 'Reply is generic praise without a concrete technical contribution or informed question.');
  } else if (pipeline === 'thread') {
    const hasAnalysis = units.slice(1).some((part) => /\b(?:because|result|benchmark|evidence|failure|tradeoff|implementation|latency|cost|compare|measured|tested|code|command)\b/i.test(part))
      || Boolean(draft?.editor?.evidenceUsed?.length);
    if (units.length >= 2 && !hasAnalysis) {
      addIssue(warnings, 'THREAD_ADDITIVE_REVIEW', 'Thread follow-up parts do not contain an obvious evidence/analysis marker; confirm they add distinct value rather than expand a list.');
    }
  } else if (pipeline === 'original' && genericQuote(primaryText)) {
    checks.additiveValue = false;
    addIssue(failures, 'NON_ADDITIVE_ORIGINAL', 'Original is generic headline reaction without a distinct thesis or developer implication.');
  } else if (pipeline === 'original' && sourceSimilarity >= 0.50) {
    addIssue(warnings, 'ORIGINAL_ADDITIVE_REVIEW', 'Original is source-adjacent; confirm the thesis goes beyond the source headline.');
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
      if (blocks(units[index]).length > 4) {
        checks.scannability = false;
        addIssue(failures, 'THREAD_TOO_MANY_BLOCKS', `Thread part ${index + 1} has more than 4 newline-separated blocks.`);
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
    if (primaryText.length < 40 || PLACEHOLDER.test(primaryText)) {
      checks.threadRules = false;
      addIssue(failures, 'THREAD_OPENER_INCOMPLETE', 'Thread Post 1 must be non-placeholder text of at least 40 characters and contain the complete high-level finding.');
    }
    if (/^\s*1\/(?:\d+)?(?:\s|$)/i.test(primaryText) && /\b(?:thread|more below|read on|keep reading|details below|here'?s why)\b/i.test(primaryText)) {
      checks.threadRules = false;
      addIssue(failures, 'THREAD_TEASER', 'Thread Post 1 uses a numbered teaser pattern that appears to withhold the useful conclusion.');
    }
    const finalPart = units.at(-1) || '';
    if (finalPart && !/[?]|\b(?:try|use|avoid|choose|measure|compare|check|test|benchmark|configure|prefer|treat|watch|ship)\b/i.test(finalPart)) {
      addIssue(warnings, 'THREAD_TAKEAWAY_REVIEW', 'Final thread part has no obvious developer takeaway/action; confirm the ending is useful rather than promotional.');
    }
  } else {
    const textBlocks = blocks(primaryText);
    if (textBlocks.some((block) => sentenceCount(block) > 3)) {
      checks.scannability = false;
      addIssue(failures, 'PARAGRAPH_TOO_DENSE', 'A paragraph contains more than 3 sentences.');
    }
    if (textBlocks.length > 4) {
      checks.scannability = false;
      addIssue(failures, 'TOO_MANY_BLOCKS', `Single post has ${textBlocks.length} newline-separated blocks; maximum is 4.`);
    }
    const firstBlock = textBlocks[0] || '';
    if (firstBlock.length > 160 && !/https?:\/\/|`/.test(firstBlock)) {
      checks.scannability = false;
      addIssue(failures, 'FIRST_BLOCK_TOO_LONG', `First block is ${firstBlock.length} characters; maximum is 160 unless URL/code structure requires otherwise.`);
    }
    const firstLine = firstBlock.split('\n')[0] || '';
    if (allCapsLine(firstLine)) {
      checks.scannability = false;
      addIssue(failures, 'ALL_CAPS_FIRST_LINE', 'First line is all caps and longer than an acronym-sized label.');
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
      addIssue(failures, 'MEDIA_NOT_READY', 'Required media is not attached/ready; Phase 2 must block approval until the later media path marks it ready or the plan is revised.');
    }
  }

  return { passed: failures.length === 0, failures, warnings, checks };
}

export function scoreDraft(draft, candidate, context = {}) {
  const gateAware = arguments.length >= 3;
  const pipeline = gateAware ? ensurePipeline(context?.pipeline || draft?.editor?.pipeline || 'original') : 'original';
  const units = contentUnits(draft, pipeline);
  const body = units[0] ?? '';
  const blocks = String(body || '').split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const firstLine = String(blocks[0] || body || '').split('\n')[0].trim();
  const insightText = blocks.length > 1 ? blocks.slice(1).join(' ') : String(body || '').trim();
  const finalBlock = blocks.at(-1) || '';
  const hook = usefulText(firstLine, 20) ? 8 : firstLine ? 3 : 0;
  const insight = usefulText(insightText, 45) ? 10 : usefulText(body, 60) ? 6 : String(body || '').trim() ? 3 : 0;
  const evidenceText = String(body || '');
  const hasStrongEvidence = Boolean(draft?.editor?.evidenceUsed?.length) || (usefulText(evidenceText, 30)
    && /(\d|benchmark|latency|ms|sec|token|cost|install|npm|pnpm|curl|git |python |node |output|result|tested|measured|source|docs|release notes)/i.test(evidenceText));
  const hasSource = /https?:\/\//i.test(evidenceText) || Boolean(draft?.editor?.evidenceUsed?.length);
  const evidence = hasStrongEvidence ? 10 : usefulText(evidenceText, 30) && hasSource ? 6 : usefulText(evidenceText, 40) ? 4 : 1;
  const hasAction = /(?:\?|\b(?:try|use|run|install|compare|avoid|switch|keep|check|measure|benchmark|configure|ship|test)\b)/i.test(finalBlock);
  const action = usefulText(finalBlock, 24) && hasAction ? 7 : finalBlock ? 2 : 0;
  const sourceSimilarity = similarity(body, candidate?.text || '');
  const originality = sourceSimilarity < 0.30 ? 5 : sourceSimilarity < 0.50 ? 3 : 0;
  const rawWritingScore = hook + insight + evidence + action + originality;
  const score = Math.round((rawWritingScore / 40) * 50);
  const weightedLength = pipeline === 'thread'
    ? Math.max(0, ...units.map((part) => weightedPostLength(part)))
    : weightedPostLength(body);
  const quality = score >= 45 ? 'high-impact' : score >= 40 ? 'strong' : score >= 30 ? 'standard' : 'incomplete';
  const legacyPublishable = score >= 40 && !PLACEHOLDER.test(body) && weightedLength <= 280;
  const gates = gateAware ? evaluateDraftGates(draft, candidate, context) : null;
  return {
    score,
    quality,
    breakdown: { hook, insight, evidence, action, originality },
    sourceSimilarity,
    weightedLength,
    publishable: gateAware ? score >= 40 && gates.passed : legacyPublishable,
    ...(gates ? { gates } : {}),
  };
}
