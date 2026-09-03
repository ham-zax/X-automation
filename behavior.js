export const BEHAVIOR_SCHEMA_VERSION = 1;

export const BEHAVIOR_DECISIONS = Object.freeze([
  'ACT',
  'SILENT',
  'RESEARCH',
  'UNKNOWN',
]);

export const ACTION_PURPOSES = Object.freeze([
  'technical_value',
  'profile_proof',
  'discovery',
  'relationship',
  'support',
  'celebration',
  'humor',
  'taste',
  'judgment',
  'learning',
  'correction',
  'de_escalation',
  'social_presence',
]);

export const SOCIAL_MODES = Object.freeze([
  'builder',
  'experimenter',
  'explainer',
  'curious_peer',
  'enthusiast',
  'skeptic',
  'opinionated_peer',
  'taste_maker',
  'supporter',
  'humorist',
  'listener',
  'personal_update',
]);

export const AFFECT_STRATEGIES = Object.freeze([
  'neutral',
  'match',
  'amplify',
  'contrast',
  'de_escalate',
  'bridge',
  'reward',
  'energize',
  'understate',
]);

export const AFFECT_PROVENANCE = Object.freeze([
  'none',
  'known',
  'inferred',
  'strategic',
]);

export const INFORMATION_DEPTHS = Object.freeze([
  'social_only',
  'judgment',
  'compact_reason',
  'technical_explanation',
  'reusable_artifact',
]);

export const CONVERSATION_STAGES = Object.freeze([
  'initial',
  'reciprocal',
  'ongoing',
  'familiar',
  'self_extension',
]);

export const BEHAVIOR_SELECTION_SOURCES = Object.freeze([
  'editorial_ai',
  'engagement_heuristic',
  'persona_model',
  'human',
  'operator',
  'legacy',
]);

const PURPOSE_SET = new Set(ACTION_PURPOSES);
const MODE_SET = new Set(SOCIAL_MODES);
const AFFECT_SET = new Set(AFFECT_STRATEGIES);
const AFFECT_PROVENANCE_SET = new Set(AFFECT_PROVENANCE);
const DEPTH_SET = new Set(INFORMATION_DEPTHS);
const STAGE_SET = new Set(CONVERSATION_STAGES);
const DECISION_SET = new Set(BEHAVIOR_DECISIONS);
const SOURCE_SET = new Set(BEHAVIOR_SELECTION_SOURCES);

const SOCIAL_PURPOSES = new Set([
  'relationship',
  'support',
  'celebration',
  'humor',
  'de_escalation',
  'social_presence',
]);

const EVIDENCE_PURPOSES = new Set([
  'technical_value',
  'profile_proof',
  'correction',
]);

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
}

function enumValue(value, allowed, fallback = null) {
  const normalized = value == null ? '' : String(value).trim();
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeProvenance(input = {}) {
  const sourceClaims = uniqueStrings(input.sourceClaims);
  const ownerClaims = uniqueStrings(input.ownerClaims);
  const restrictions = uniqueStrings(input.restrictions);
  return {
    ownerFactsAllowed: input.ownerFactsAllowed === true,
    ownerExperienceAllowed: input.ownerExperienceAllowed === true,
    sourceClaims,
    ownerClaims,
    restrictions,
    summary: String(input.summary || '').trim(),
  };
}

export function deriveConversationStage({
  engagementKind = '',
  relationshipStage = '',
  parentOurTweetId = '',
  selfReply = false,
  priorInteractionCount = 0,
} = {}) {
  if (selfReply) return 'self_extension';
  if (['recurring', 'connected', 'mutual'].includes(String(relationshipStage || ''))) return 'familiar';
  if (['follow_up', 'own_post_response'].includes(String(engagementKind || '')) || parentOurTweetId) return 'reciprocal';
  if (['interacted', 'responsive'].includes(String(relationshipStage || '')) || Number(priorInteractionCount || 0) > 1) return 'ongoing';
  return 'initial';
}

export function normalizeBehaviorDecision(input = {}, {
  pipeline = null,
  defaultConversationStage = 'initial',
  defaultPersonaModelVersion = '',
  defaultSelectionSource = 'legacy',
} = {}) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const decision = enumValue(raw.decision, DECISION_SET, Object.keys(raw).length ? 'ACT' : 'UNKNOWN');
  const primaryPurpose = enumValue(raw.primaryPurpose, PURPOSE_SET, null);
  const secondaryPurposes = uniqueStrings(raw.secondaryPurposes).filter((purpose) => PURPOSE_SET.has(purpose) && purpose !== primaryPurpose);
  const socialMode = enumValue(raw.socialMode, MODE_SET, null);
  const affectStrategy = enumValue(raw.affectStrategy, AFFECT_SET, 'neutral');
  const affectProvenance = enumValue(raw.affectProvenance, AFFECT_PROVENANCE_SET, affectStrategy === 'neutral' ? 'none' : 'strategic');
  const informationDepth = enumValue(raw.informationDepth, DEPTH_SET, null);
  const conversationStage = enumValue(raw.conversationStage, STAGE_SET,
    enumValue(defaultConversationStage, STAGE_SET, 'initial'));
  const selectionSource = enumValue(raw.selectionSource, SOURCE_SET,
    enumValue(defaultSelectionSource, SOURCE_SET, 'legacy'));

  return {
    schemaVersion: BEHAVIOR_SCHEMA_VERSION,
    decision,
    pipeline: pipeline == null ? String(raw.pipeline || '').trim() : String(pipeline || '').trim(),
    primaryPurpose,
    secondaryPurposes,
    socialMode,
    affectStrategy,
    affectProvenance,
    informationDepth,
    conversationStage,
    reasonToExist: String(raw.reasonToExist || raw.reason || '').trim(),
    selectionSource,
    personaModelVersion: String(raw.personaModelVersion || defaultPersonaModelVersion || '').trim(),
    provenance: normalizeProvenance(raw.provenance),
    selectedAt: raw.selectedAt == null || !Number.isFinite(Number(raw.selectedAt))
      ? null
      : Number(raw.selectedAt),
  };
}

export function validateBehaviorDecision(input, {
  pipeline = null,
  requireAct = false,
} = {}) {
  const behavior = normalizeBehaviorDecision(input, { pipeline });
  const errors = [];

  if (!DECISION_SET.has(behavior.decision)) errors.push('Unsupported behavior decision.');
  if (requireAct && behavior.decision !== 'ACT') errors.push('An ACT behavior decision is required.');

  if (behavior.decision === 'ACT') {
    if (!behavior.primaryPurpose) errors.push('ACT requires primaryPurpose.');
    if (!behavior.socialMode) errors.push('ACT requires socialMode.');
    if (!behavior.informationDepth) errors.push('ACT requires informationDepth.');
    if (!behavior.reasonToExist) errors.push('ACT requires reasonToExist.');
    if (behavior.affectStrategy !== 'neutral' && behavior.affectProvenance === 'none') {
      errors.push('Non-neutral affect requires known, inferred, or strategic provenance.');
    }
  }

  if (behavior.decision === 'SILENT' && !behavior.reasonToExist) {
    errors.push('SILENT requires a reason.');
  }

  if (behavior.decision === 'RESEARCH' && !behavior.reasonToExist) {
    errors.push('RESEARCH requires a reason.');
  }

  if (behavior.informationDepth === 'social_only' && behavior.primaryPurpose && !behaviorDecisionSupportsSocialOnly(behavior)) {
    errors.push(`${behavior.primaryPurpose} does not support social_only depth without a social secondary purpose.`);
  }

  return { valid: errors.length === 0, errors, behavior };
}

export function behaviorDecisionSupportsSocialOnly(input = {}) {
  const behavior = normalizeBehaviorDecision(input);
  if (behavior.primaryPurpose && SOCIAL_PURPOSES.has(behavior.primaryPurpose)) return true;
  return behavior.secondaryPurposes.some((purpose) => SOCIAL_PURPOSES.has(purpose));
}

export function behaviorDecisionRequiresFactualEvidence(input = {}) {
  const behavior = normalizeBehaviorDecision(input);
  if (behavior.primaryPurpose && EVIDENCE_PURPOSES.has(behavior.primaryPurpose)) return true;
  return behavior.secondaryPurposes.some((purpose) => EVIDENCE_PURPOSES.has(purpose));
}

export function isSocialPurpose(purpose) {
  return SOCIAL_PURPOSES.has(String(purpose || ''));
}

export function isEvidencePurpose(purpose) {
  return EVIDENCE_PURPOSES.has(String(purpose || ''));
}

export function legacyBehaviorDecision({ pipeline = '', reason = 'Historical item predates the behavior contract.' } = {}) {
  return normalizeBehaviorDecision({
    decision: 'UNKNOWN',
    pipeline,
    reasonToExist: reason,
    selectionSource: 'legacy',
  }, { pipeline });
}
