import { NICHE_LABELS } from './strategy.js';

const PLACEHOLDER = /\[[^\]]+\]/;

function firstSignal(candidate) {
  const matches = candidate?.niche?.matches || [];
  if (matches.length) return matches.slice(0, 2).join(' + ');
  const words = String(candidate?.text || '').replace(/https?:\/\/\S+/g, '').trim().split(/\s+/).slice(0, 8);
  return words.join(' ') || 'developer signal';
}

export function composeDraft({ hook = '', insight = '', evidence = '', action = '' }) {
  return [hook, insight, evidence, action].map((value) => String(value || '').trim()).filter(Boolean).join('\n\n');
}

export function weightedPostLength(text) {
  return String(text || '').replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;
}

export function createDraftScaffold(candidate) {
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
  draft.body = composeDraft(draft);
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

export function scoreDraft(draft, candidate) {
  const body = draft.body || composeDraft(draft);
  const niche = Math.min(10, Math.round(Number(candidate?.niche?.score || 0) / 5));
  const hook = usefulText(draft.hook, 20) ? 8 : String(draft.hook || '').trim() ? 3 : 0;
  const insight = usefulText(draft.insight, 45) ? 10 : String(draft.insight || '').trim() ? 3 : 0;
  const evidenceText = String(draft.evidence || '');
  const hasStrongEvidence = usefulText(evidenceText, 30)
    && /(\d|benchmark|latency|ms|sec|token|cost|install|npm|pnpm|curl|git |python |node |output|result|tested|measured)/i.test(evidenceText);
  const hasSource = /https?:\/\//i.test(evidenceText);
  const evidence = hasStrongEvidence ? 10 : usefulText(evidenceText, 30) && hasSource ? 6 : usefulText(evidenceText, 20) ? 4 : 1;
  const action = usefulText(draft.action, 24) ? 7 : String(draft.action || '').trim() ? 2 : 0;
  const sourceSimilarity = similarity(body, candidate?.text || '');
  const originality = sourceSimilarity < 0.30 ? 5 : sourceSimilarity < 0.50 ? 3 : 0;
  const score = niche + hook + insight + evidence + action + originality;
  const weightedLength = weightedPostLength(body);
  const quality = score >= 45 ? 'high-impact' : score >= 40 ? 'strong' : score >= 30 ? 'standard' : 'incomplete';
  return {
    score,
    quality,
    breakdown: { niche, hook, insight, evidence, action, originality },
    sourceSimilarity,
    weightedLength,
    publishable: score >= 40 && !PLACEHOLDER.test(body) && weightedLength <= 280,
  };
}
