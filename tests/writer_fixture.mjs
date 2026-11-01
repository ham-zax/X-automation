import { normalizeBehaviorDecision, WRITER_BEHAVIOR_SCHEMA } from '../behavior.js';

// Current model-response fixtures. These grant no review or publication authority.
export function selectedBehavior(input) {
  const behavior = normalizeBehaviorDecision(input);
  return Object.fromEntries(WRITER_BEHAVIOR_SCHEMA.required.map(key => [key, behavior[key]]));
}

export function replyOutput(behavior, finalText = 'Love this direction.') {
  const checks = () => Array.from({ length: 16 }, (_, index) => ({ rule: index + 1, status: 'PASS', detail: '' }));
  return { decision: 'POST', finalText, evidenceUsed: [], behavior: selectedBehavior(behavior),
    replyReview: { candidates: [{ id: 'A', text: finalText, checks: checks() },
      { id: 'B', text: 'Nice, thanks for sharing.', checks: checks() }], selection: 'A', reason: 'Fits the supplied context.' } };
}
