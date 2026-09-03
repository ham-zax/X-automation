import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveConversationStage,
  normalizeBehaviorDecision,
  validateBehaviorDecision,
} from './behavior.js';
import { getCurrentPersonaStances } from './store.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MODEL_PATH = path.join(MODULE_DIR, 'persona', 'hamza-v1.json');

const ARCHETYPE_BEHAVIOR = Object.freeze({
  implementation_detail: { primaryPurpose: 'technical_value', socialMode: 'explainer', informationDepth: 'compact_reason' },
  benchmark_or_result: { primaryPurpose: 'technical_value', socialMode: 'experimenter', informationDepth: 'compact_reason' },
  caveat_or_edge_case: { primaryPurpose: 'correction', socialMode: 'skeptic', informationDepth: 'compact_reason' },
  comparison: { primaryPurpose: 'technical_value', socialMode: 'explainer', informationDepth: 'compact_reason' },
  correction: { primaryPurpose: 'correction', socialMode: 'skeptic', informationDepth: 'compact_reason' },
  independent_judgment: { primaryPurpose: 'judgment', socialMode: 'opinionated_peer', informationDepth: 'judgment' },
  informed_question: { primaryPurpose: 'learning', socialMode: 'curious_peer', informationDepth: 'judgment' },
  synthesis: { primaryPurpose: 'technical_value', socialMode: 'explainer', informationDepth: 'technical_explanation' },
  reproduction: { primaryPurpose: 'profile_proof', socialMode: 'experimenter', informationDepth: 'reusable_artifact' },
  personal_experience: { primaryPurpose: 'profile_proof', socialMode: 'builder', informationDepth: 'compact_reason' },
  direct_answer: { primaryPurpose: 'relationship', socialMode: 'listener', informationDepth: 'social_only' },
  status_response: { primaryPurpose: 'relationship', socialMode: 'listener', informationDepth: 'social_only' },
  agreement: { primaryPurpose: 'social_presence', socialMode: 'supporter', informationDepth: 'social_only' },
  gratitude: { primaryPurpose: 'support', socialMode: 'supporter', informationDepth: 'social_only' },
  support: { primaryPurpose: 'support', socialMode: 'supporter', informationDepth: 'social_only' },
  celebration: { primaryPurpose: 'celebration', socialMode: 'enthusiast', informationDepth: 'social_only' },
  enthusiasm: { primaryPurpose: 'celebration', socialMode: 'enthusiast', informationDepth: 'social_only' },
  humor: { primaryPurpose: 'humor', socialMode: 'humorist', informationDepth: 'social_only' },
  social_observation: { primaryPurpose: 'taste', socialMode: 'taste_maker', informationDepth: 'judgment' },
  de_escalation: { primaryPurpose: 'de_escalation', socialMode: 'humorist', informationDepth: 'social_only' },
  relationship_callback: { primaryPurpose: 'relationship', socialMode: 'listener', informationDepth: 'social_only' },
});

let cachedModel = null;
let cachedPath = null;
let cachedMtimeMs = null;

function readModel(modelPath = DEFAULT_MODEL_PATH) {
  const resolved = path.resolve(modelPath);
  const stat = fs.statSync(resolved);
  if (cachedModel && cachedPath === resolved && cachedMtimeMs === stat.mtimeMs) return cachedModel;
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Persona model must be an object.');
  if (!String(parsed.version || '').trim()) throw new Error('Persona model requires version.');
  cachedModel = Object.freeze(parsed);
  cachedPath = resolved;
  cachedMtimeMs = stat.mtimeMs;
  return cachedModel;
}

export function getActivePersonaModel({ modelPath = DEFAULT_MODEL_PATH } = {}) {
  return readModel(modelPath);
}

export function getPersonaModelSummary(options = {}) {
  const model = getActivePersonaModel(options);
  return {
    schemaVersion: Number(model.schemaVersion || 1),
    version: String(model.version),
    status: String(model.status || ''),
    identity: model.identity || {},
    operatorDecisions: model.operatorDecisions || {},
    candidateBeliefs: Array.isArray(model.candidateBeliefs) ? model.candidateBeliefs : [],
    knownUnknowns: Array.isArray(model.knownUnknowns) ? model.knownUnknowns : [],
    sourceArtifacts: Array.isArray(model.sourceArtifacts) ? model.sourceArtifacts : [],
  };
}

export function getPersonaSlice(consumer, options = {}) {
  const model = getActivePersonaModel(options);
  const shared = {
    version: String(model.version),
    status: String(model.status || ''),
    identity: model.identity || {},
    operatorDecisions: model.operatorDecisions || {},
    currentStances: getCurrentPersonaStances({ limit: 200 }),
  };

  if (consumer === 'editorial') {
    return {
      ...shared,
      candidateBeliefs: model.candidateBeliefs || [],
      behaviorPolicy: model.behaviorPolicy || {},
      affectPolicy: model.affectPolicy || {},
      behaviorExamples: model.behaviorExamples || {},
      knownUnknowns: model.knownUnknowns || [],
    };
  }
  if (consumer === 'engagement') {
    return {
      ...shared,
      candidateBeliefs: model.candidateBeliefs || [],
      behaviorPolicy: model.behaviorPolicy || {},
      affectPolicy: model.affectPolicy || {},
      relationshipPolicy: model.relationshipPolicy || {},
      behaviorExamples: model.behaviorExamples || {},
      technicalProvenanceSandbox: model.technicalProvenanceSandbox || {},
    };
  }
  if (consumer === 'writer') {
    return {
      ...shared,
      affectPolicy: model.affectPolicy || {},
      relationshipPolicy: model.relationshipPolicy || {},
      behaviorExamples: model.behaviorExamples || {},
      languageRealization: model.languageRealization || {},
      technicalProvenanceSandbox: model.technicalProvenanceSandbox || {},
    };
  }
  return { ...shared };
}

function inferAffect(primaryPurpose, { hostile = false, sourceExcited = false, understated = false } = {}) {
  if (primaryPurpose === 'celebration') return sourceExcited
    ? { affectStrategy: 'match', affectProvenance: 'strategic' }
    : { affectStrategy: 'energize', affectProvenance: 'strategic' };
  if (primaryPurpose === 'support') return { affectStrategy: 'reward', affectProvenance: 'strategic' };
  if (primaryPurpose === 'humor') return { affectStrategy: hostile ? 'de_escalate' : 'contrast', affectProvenance: 'strategic' };
  if (primaryPurpose === 'de_escalation') return { affectStrategy: 'de_escalate', affectProvenance: 'strategic' };
  if (primaryPurpose === 'taste') return { affectStrategy: understated ? 'understate' : 'neutral', affectProvenance: understated ? 'strategic' : 'none' };
  if (primaryPurpose === 'judgment') return { affectStrategy: hostile ? 'contrast' : 'neutral', affectProvenance: hostile ? 'strategic' : 'none' };
  if (primaryPurpose === 'correction') return { affectStrategy: hostile ? 'contrast' : 'neutral', affectProvenance: hostile ? 'strategic' : 'none' };
  return { affectStrategy: 'neutral', affectProvenance: 'none' };
}

function inferredSecondaryPurposes(primaryPurpose, { sourceClass = '', relationshipStage = '', growthObjective = '' } = {}) {
  const purposes = [];
  if (['momentum', 'viral', 'breakout'].includes(String(sourceClass || '')) || growthObjective === 'reach_momentum') {
    if (primaryPurpose !== 'discovery') purposes.push('discovery');
  }
  if (['responsive', 'recurring', 'connected', 'mutual'].includes(String(relationshipStage || ''))
      && primaryPurpose !== 'relationship') {
    purposes.push('relationship');
  }
  return purposes;
}

export function selectBehaviorDecision({
  explicitBehavior = null,
  pipeline = 'reply',
  contribution = null,
  relationship = null,
  engagementKind = '',
  parentOurTweetId = '',
  selfReply = false,
  sourceClass = '',
  growthObjective = '',
  directQuestion = false,
  targetReplied = false,
  hostile = false,
  sourceExcited = false,
  understated = false,
  reasonToExist = '',
  selectionSource = 'persona_model',
  now = Date.now(),
} = {}) {
  const model = getActivePersonaModel();
  const relationshipStage = String(relationship?.relationshipStage || 'observed');
  const conversationStage = deriveConversationStage({
    engagementKind,
    relationshipStage,
    parentOurTweetId,
    selfReply,
    priorInteractionCount: relationship?.meaningfulInteractions || 0,
  });

  if (explicitBehavior) {
    const validated = validateBehaviorDecision(explicitBehavior, { pipeline });
    if (!validated.valid) throw new Error(`Invalid explicit behavior decision: ${validated.errors.join(' ')}`);
    return normalizeBehaviorDecision({
      ...validated.behavior,
      selectedAt: validated.behavior.selectedAt || now,
      personaModelVersion: validated.behavior.personaModelVersion || model.version,
    }, {
      pipeline,
      defaultConversationStage: conversationStage,
      defaultPersonaModelVersion: model.version,
      defaultSelectionSource: selectionSource,
    });
  }

  const archetype = String(contribution?.archetype || (directQuestion ? 'direct_answer' : targetReplied ? 'relationship_callback' : ''));
  const mapped = ARCHETYPE_BEHAVIOR[archetype] || null;
  if (!mapped) {
    return normalizeBehaviorDecision({
      decision: 'SILENT',
      pipeline,
      reasonToExist: reasonToExist || 'No legitimate technical, social, relationship, identity, learning, or growth purpose was established.',
      selectionSource,
      selectedAt: now,
      personaModelVersion: model.version,
      conversationStage,
    }, { pipeline, defaultPersonaModelVersion: model.version, defaultSelectionSource: selectionSource });
  }

  const primaryPurpose = mapped.primaryPurpose;
  const affect = inferAffect(primaryPurpose, { hostile, sourceExcited, understated });
  const secondaryPurposes = inferredSecondaryPurposes(primaryPurpose, {
    sourceClass,
    relationshipStage,
    growthObjective,
  });
  if (directQuestion && !secondaryPurposes.includes('learning') && primaryPurpose !== 'learning') secondaryPurposes.push('learning');

  const behavior = normalizeBehaviorDecision({
    decision: 'ACT',
    pipeline,
    primaryPurpose,
    secondaryPurposes,
    socialMode: mapped.socialMode,
    informationDepth: mapped.informationDepth,
    ...affect,
    conversationStage,
    reasonToExist: reasonToExist || String(contribution?.summary || '').trim(),
    selectionSource,
    selectedAt: now,
    personaModelVersion: model.version,
    provenance: {
      ownerFactsAllowed: false,
      ownerExperienceAllowed: false,
      restrictions: [
        'An archetype or persona inference never grants autobiographical authority. Owner facts/experience require explicit grounded provenance.',
        'Do not invent explicit or implied owner experience.',
        'Keep external facts attributed when they are not first-hand.',
      ],
      summary: affect.affectProvenance === 'strategic'
        ? 'Affect is a selected social stance, not proof of private emotional state.'
        : '',
    },
  }, {
    pipeline,
    defaultConversationStage: conversationStage,
    defaultPersonaModelVersion: model.version,
    defaultSelectionSource: selectionSource,
  });

  const validated = validateBehaviorDecision(behavior, { pipeline, requireAct: true });
  if (!validated.valid) throw new Error(`Persona produced invalid behavior: ${validated.errors.join(' ')}`);
  return validated.behavior;
}

export function behaviorForEditorialRecommendation(recommendation = {}, context = {}) {
  if (recommendation.behavior) {
    return selectBehaviorDecision({
      explicitBehavior: recommendation.behavior,
      pipeline: recommendation.pipeline || context.pipeline || 'original',
      reasonToExist: recommendation.whyNow || recommendation.thesis || '',
      selectionSource: 'editorial_ai',
      growthObjective: context.growthObjective || '',
    });
  }

  const contribution = recommendation.pipeline === 'reply'
    ? { archetype: 'synthesis', summary: recommendation.thesis || recommendation.whyNow || '' }
    : recommendation.pipeline === 'quote'
      ? { archetype: 'social_observation', summary: recommendation.thesis || recommendation.whyNow || '' }
      : { archetype: 'synthesis', summary: recommendation.thesis || recommendation.whyNow || '' };
  return selectBehaviorDecision({
    pipeline: recommendation.pipeline || context.pipeline || 'original',
    contribution,
    growthObjective: context.growthObjective || '',
    sourceClass: context.sourceClass || '',
    reasonToExist: recommendation.whyNow || recommendation.thesis || '',
    selectionSource: 'persona_model',
  });
}
