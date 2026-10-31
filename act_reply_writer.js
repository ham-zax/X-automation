import { buildWriterPacket, applyWriterOutput } from './drafting.js';
import { generateWriterOutput } from './writer_runtime.js';
import { REPLY_CONTRACT, projectReplyPacket, replyOutputSchema } from './reply_contract.js';
import { extractTweetIdFromUrl, validateActInput } from './act.js';
import { getCandidate, getBlockingActAttemptForTarget, listAiRuns } from './store.js';

export function operatorModelReport(env = process.env) {
  return { runtime: env.X_GROWTH_OPERATOR_RUNTIME || 'unknown', model: env.X_GROWTH_OPERATOR_MODEL || null,
    reasoning: env.X_GROWTH_OPERATOR_REASONING || null, source: 'launcher_environment_report' };
}

export function replyModelProvenance(payload) {
  const operator = operatorModelReport();
  if (!payload.writerInvocationId) return { operator, writer: { ...operator, source: 'operator_supplied_text' } };
  const run = listAiRuns({ invocationId: payload.writerInvocationId, role: 'writer', status: 'complete', limit: 1 })[0];
  if (!run || run.metadata.runId !== payload.runId || run.metadata.sessionId !== payload.sessionId
    || run.metadata.targetTweetId !== String(payload.targetTweetId)) throw new Error('Writer execution does not belong to this reply run and target.');
  return { operator, writer: { invocationId: run.invocationId, runtime: run.runtime,
    model: run.model, reasoning: run.reasoning, fallbackUsed: run.fallbackUsed } };
}

// Preparation only. The bridge checks the lease before and after this call.
// Existing AI execution records own provenance. No claim or publication is made.
export async function generateActReply(payload, { generate = generateWriterOutput, env = process.env } = {}) {
  if (!payload.runId || !payload.sessionId) throw new Error('reply-generate requires runId and sessionId.');
  const targetUrl = String(payload.targetUrl || '').trim();
  const targetTweetId = String(payload.targetTweetId || extractTweetIdFromUrl(targetUrl)).trim();
  let url;
  try { url = new URL(targetUrl); } catch { throw new Error('reply-generate requires an exact X status targetUrl.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'x.com' || !/^\d{5,25}$/.test(targetTweetId)
    || extractTweetIdFromUrl(targetUrl) !== targetTweetId) throw new Error('reply-generate target URL and ID must match.');
  const sourceText = String(payload.card?.sourceText || '').trim();
  if (!sourceText) throw new Error('reply-generate requires the exact observed card.sourceText.');
  if (payload.behavior?.decision !== 'ACT') throw new Error('reply-generate requires an explicit ACT behavior.');
  if (getBlockingActAttemptForTarget(targetTweetId)) throw new Error('reply-generate target has an existing publication fence.');
  const candidateKey = String(payload.candidateKey || '').trim();
  const saved = candidateKey ? getCandidate(candidateKey) : null;
  if (saved && extractTweetIdFromUrl(saved.url) !== targetTweetId) throw new Error('reply-generate candidate does not match targetUrl.');
  const candidate = { ...saved, key: candidateKey || targetUrl, source: 'x', url: targetUrl,
    title: `@${url.pathname.split('/')[1]}`, text: sourceText };
  const packet = buildWriterPacket({ candidate, queueItem: { pipeline: 'reply', behavior: payload.behavior },
    draft: payload.feedback ? { body: '', editor: { pipeline: 'reply', operatorContext: String(payload.feedback) } } : null,
    topicBrief: payload.resolvedTopicBrief || null });
  const operator = operatorModelReport(env);
  const mode = env.X_GROWTH_REPLY_WRITER_MODE || 'profile';
  if (!['operator', 'profile'].includes(mode)) throw new Error('Reply writer mode must be operator or profile.');
  if (mode === 'operator') return { status: 'operator_writes', packet: projectReplyPacket(packet),
    contract: REPLY_CONTRACT, outputSchema: replyOutputSchema(packet), publicationAuthority: false };
  const output = await generate(packet, REPLY_CONTRACT, { skipReview: true,
    metadata: { runId: payload.runId, sessionId: payload.sessionId, targetTweetId, operator } });
  if (!['POST', 'DO_NOT_POST'].includes(output.decision)) throw new Error('Writer returned an invalid Reply decision.');
  const text = String(output.finalText || '').trim();
  const applied = applyWriterOutput({ body: '', editor: { pipeline: 'reply' } }, output, { writerPacket: packet });
  const topicBrief = applied.editor.topicBrief || null;
  if (output.decision === 'POST') validateActInput({ action: 'reply', text, targetTweetId, targetUrl });
  return { status: output.decision === 'POST' ? 'generated' : 'skipped', text,
    writerInvocationId: output.execution?.invocationId || null, writer: output.execution || null,
    operator, targetTweetId, targetUrl, candidateKey: candidateKey || null,
    ...(topicBrief ? { topicBrief: { collectionId: topicBrief.collectionId, briefId: topicBrief.briefId, paragraphIds: topicBrief.paragraphIds } } : {}),
    publicationAuthority: false };
}
