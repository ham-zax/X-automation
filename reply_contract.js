import { readFileSync } from 'node:fs';
import { WRITER_BEHAVIOR_SCHEMA } from './behavior.js';

export const REPLY_CONTRACT_FILE = 'docs/REPLY_GENERATION_PROMPT_V2.md';
export const REPLY_CONTRACT = readFileSync(new URL(`./${REPLY_CONTRACT_FILE}`, import.meta.url), 'utf8').trim();

export function replyOutputSchema(packet = {}) {
  return {
    type: 'object', additionalProperties: false,
    required: ['decision', 'finalText', 'evidenceUsed', 'behavior', 'replyReview', ...(packet.topicBrief ? ['briefParagraphIds'] : [])],
    properties: {
      decision: { enum: ['POST', 'DO_NOT_POST'] },
      finalText: { type: 'string' },
      behavior: { ...WRITER_BEHAVIOR_SCHEMA, type: ['object', 'null'] },
      replyReview: {
        type: 'object', additionalProperties: false, required: ['candidates', 'selection', 'reason'],
        properties: {
          candidates: { type: 'array', minItems: 2, maxItems: 2, items: {
            type: 'object', additionalProperties: false, required: ['id', 'text', 'checks'],
            properties: {
              id: { enum: ['A', 'B'] }, text: { type: 'string' },
              checks: { type: 'array', minItems: 16, maxItems: 16, items: {
                type: 'object', additionalProperties: false, required: ['rule', 'status', 'detail'],
                properties: { rule: { type: 'integer', minimum: 1, maximum: 16 },
                  status: { enum: ['PASS', 'FAIL', 'UNCERTAIN'] }, detail: { type: 'string' } },
              } },
            },
          } },
          selection: { enum: ['A', 'B', null] }, reason: { type: 'string' },
        },
      },
      evidenceUsed: { type: 'array', items: { type: 'string' } },
      ...(packet.topicBrief ? { briefParagraphIds: { type: 'array', items: { type: 'string' } } } : {}),
    },
  };
}

export function projectReplyPacket(packet) {
  const persona = packet.persona || {};
  const draft = packet.currentDraft;
  return {
    pipeline: 'reply', candidate: packet.candidate,
    suggestedBehavior: Object.hasOwn(packet, 'suggestedBehavior') ? packet.suggestedBehavior : packet.behavior,
    ownerDirection: packet.ownerDirection || null,
    executorFeedback: packet.executorFeedback || '',
    suggestionPolicy: 'The executor suggests an act. Choose the act that fits the actual conversation. The suggestion is not evidence or an owner instruction.',
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
    ...(packet.conversationContext ? { conversationContext: packet.conversationContext } : {}),
    ...(packet.discoveryVerification ? { discoveryVerification: packet.discoveryVerification } : {}),
    ...(draft ? { currentDraft: {
      body: draft.body || '',
      editor: { finalText: draft.editor?.finalText || '', executorFeedback: packet.ownerDirection ? '' : draft.editor?.executorFeedback || draft.editor?.operatorContext || '' },
      ...(draft.gates ? { gates: draft.gates } : {}),
    } } : {}),
    ...(packet.writingStrategy ? { writingStrategy: packet.writingStrategy } : {}),
    ...(packet.topicBrief ? { topicBrief: packet.topicBrief } : {}),
    promptDocument: 'docs/REPLY_GENERATION_PROMPT_V2.md',
  };
}

// The route is already selected by Growth OS. The model need not invent it or
// analytical justification fields. Keep existing draft consumers on that route.
export function normalizeReplyOutput(output, pipeline) {
  if (pipeline !== 'reply') return output;
  if (output?.pipeline != null && output.pipeline !== 'reply') throw new Error('Reply Writer pipeline mismatch.');
  const audit = output?.replyReview;
  if (!audit || typeof audit !== 'object' || !Array.isArray(audit.candidates)
    || audit.candidates.length !== 2 || new Set(audit.candidates.map(item => item.id)).size !== 2
    || audit.candidates.some(item => !['A', 'B'].includes(item.id)
      || !Array.isArray(item.checks) || item.checks.length !== 16
      || new Set(item.checks.map(check => check.rule)).size !== 16
      || item.checks.some(check => !Number.isInteger(check.rule) || check.rule < 1 || check.rule > 16
        || !['PASS', 'FAIL', 'UNCERTAIN'].includes(check.status)))) {
    throw new Error('Reply Writer must return two candidates with all 16 checks.');
  }
  if (output.decision === 'POST') {
    const selected = audit.candidates.find(item => item.id === audit.selection);
    if (!selected || !selected.text?.trim() || output.finalText !== selected.text
      || selected.checks.some(check => check.status !== 'PASS')) {
      throw new Error('Reply public text must exactly match its passing selected candidate.');
    }
  } else if (output.decision !== 'DO_NOT_POST' || output.finalText !== '' || audit.selection !== null || output.behavior !== null) {
    throw new Error('A skipped Reply must have no public text, selected candidate or ACT behavior.');
  }
  return { ...output, pipeline: 'reply', threadParts: [] };
}

export function replyWorkflowInstruction(mode = 'profile') {
  return mode === 'operator'
    ? 'Reply writer mode is operator: write the reply yourself using the Reply contract, then use the existing act flow. No separate Writer call is needed.'
    : 'Reply writer mode is profile: call reply-generate through the saved reply_writer model with runId/sessionId, target URL/ID, exact card.sourceText and optional suggested ACT behavior. Omit conversationContext to let preparation collect up to 20 observed replies. Supply valid observed context or linked-source/image evidence when useful. The Writer chooses the fitting act. If generated, pass its unchanged text, saved behavior, draftId and writerInvocationId to act. If skipped, move on. For reply_input_invalid, correct the input or omit malformed conversationContext and retry preparation. Do not permanently skip a source because of a command-format error. Other recoverable pre-send errors also permit a corrected retry with the same Writer. If the same error repeats without progress, defer with an expiry and report the blocker. Never retry an uncertain public send or silently write with another model. For Originals, Threads and Quotes, route and create a saved draft, then call writer-generate with its key and current runId/sessionId. Use its selected Writer text unchanged. For Quotes pass draftId, writerInvocationId, saved text and behavior through act. The reviewed saved draft must match. Originals and Threads retain the approved queue flow. You orchestrate and select opportunities. Do not replace the selected Writer with your own public prose.';
}
