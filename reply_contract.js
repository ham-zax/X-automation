import { readFileSync } from 'node:fs';

export const REPLY_CONTRACT = readFileSync(new URL('./docs/REPLY_GENERATION_PROMPT.md', import.meta.url), 'utf8').trim();

export function replyOutputSchema(packet = {}) {
  return {
    type: 'object', additionalProperties: false,
    required: ['decision', 'finalText', 'evidenceUsed', ...(packet.topicBrief ? ['briefParagraphIds'] : [])],
    properties: {
      decision: { enum: ['POST', 'DO_NOT_POST'] },
      finalText: { type: 'string' },
      evidenceUsed: { type: 'array', items: { type: 'string' } },
      ...(packet.topicBrief ? { briefParagraphIds: { type: 'array', items: { type: 'string' } } } : {}),
    },
  };
}

export function projectReplyPacket(packet) {
  const persona = packet.persona || {};
  const draft = packet.currentDraft;
  return {
    pipeline: 'reply', candidate: packet.candidate, behavior: packet.behavior,
    persona: {
      version: persona.version,
      identity: packet.account?.identity || (typeof persona.identity === 'string' ? persona.identity : persona.identity?.label) || 'developer and builder in tech',
      affectBoundary: persona.affectPolicy?.boundary || persona.affectBoundary,
      language: {
        defaultRegister: 'builder-to-builder, spoken when appropriate, precise when consequence requires it',
        stoppingRule: persona.languageRealization?.stoppingRule || persona.language?.stoppingRule,
      },
      provenance: persona.technicalProvenanceSandbox || persona.provenance,
      ...(persona.dailyTone ? { dailyTone: persona.dailyTone } : {}),
    },
    relationship: packet.relationship || null, ownerEvidence: packet.ownerEvidence || null,
    evidence: packet.evidence || [], constraints: packet.constraints,
    ...(packet.discoveryVerification ? { discoveryVerification: packet.discoveryVerification } : {}),
    ...(draft ? { currentDraft: {
      body: draft.body || '',
      editor: { finalText: draft.editor?.finalText || '', operatorContext: draft.editor?.operatorContext || '' },
      ...(draft.gates ? { gates: draft.gates } : {}),
    } } : {}),
    ...(packet.writingStrategy ? { writingStrategy: packet.writingStrategy } : {}),
    ...(packet.topicBrief ? { topicBrief: packet.topicBrief } : {}),
    promptDocument: 'docs/REPLY_GENERATION_PROMPT.md',
  };
}

// The route is already selected by Growth OS. The model need not invent it or
// analytical justification fields. Keep existing draft consumers on that route.
export function normalizeReplyOutput(output, pipeline) {
  if (pipeline !== 'reply') return output;
  if (output?.pipeline != null && output.pipeline !== 'reply') throw new Error('Reply Writer pipeline mismatch.');
  return { ...output, pipeline: 'reply', threadParts: [] };
}
