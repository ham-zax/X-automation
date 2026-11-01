import { buildWriterPacket, applyWriterOutput } from './drafting.js';
import { generateWriterOutput } from './writer_runtime.js';
import { REPLY_CONTRACT, projectReplyPacket, replyOutputSchema } from './reply_contract.js';
import { xRead } from './x_reads.js';
import { extractTweetIdFromUrl, validateActInput } from './act.js';
import { getCandidate, getDraftByCandidate, saveDraft, upsertCandidates, ensureQueueItem, saveQueueItem, getBlockingActAttemptForTarget, requireActWriterSelection, recordServerWriterGeneration, runStoreTransaction } from './store.js';

export function operatorModelReport(env = process.env) {
  return { runtime: env.X_GROWTH_OPERATOR_RUNTIME || 'unknown', model: env.X_GROWTH_OPERATOR_MODEL || null,
    reasoning: env.X_GROWTH_OPERATOR_REASONING || null, source: 'launcher_environment_report' };
}

export function replyModelProvenance(payload) {
  const operator = operatorModelReport();
  if ((process.env.X_GROWTH_REPLY_WRITER_MODE || 'profile') === 'operator') {
    return { operator, writer: { ...operator, source: 'operator_supplied_text' } };
  }
  const selected = requireActWriterSelection({ ...payload, action: payload.action || 'reply', behavior: payload.behavior || payload.editorial?.behavior });
  return { operator, writer: selected.writer };
}

// Both fields contain observed, untrusted context. Oversized excerpts must be
// selected explicitly by the operator rather than silently clipped mid-claim.
function preparationError(message) {
  return Object.assign(new Error(message), {
    code: 'reply_input_invalid', retryable: true, phase: 'preparation',
    nextStep: 'Correct the input and retry reply-generate. Omit conversationContext to collect a bounded reply sample automatically. This command never sends.',
  });
}

function observedReplyContext(payload) {
  const conversationContext = payload.conversationContext ?? null;
  const evidence = payload.evidence ?? [];
  if (!Array.isArray(evidence)) throw preparationError('reply-generate evidence must be an array.');
  if (evidence.some(item => !item || typeof item !== 'object' || !item.id || !item.resolvedUrl
    || typeof item.summary !== 'string' || typeof item.partial !== 'boolean'
    || !['source_claim', 'primary_supported'].includes(item.status))) {
    throw preparationError('Evidence requires id, resolvedUrl, observed summary, status and partial coverage flag.');
  }
  if (conversationContext !== null && (typeof conversationContext !== 'object' || Array.isArray(conversationContext)
    || typeof conversationContext.sourceUrl !== 'string' || !conversationContext.sourceUrl.trim()
    || typeof conversationContext.partial !== 'boolean' || !Array.isArray(conversationContext.posts)
    || conversationContext.posts.some(post => !post || typeof post.id !== 'string' || !post.id.trim()
      || typeof post.url !== 'string' || !post.url.trim() || typeof post.text !== 'string'))) {
    throw preparationError('conversationContext requires sourceUrl, partial and observed posts with id, url and text.');
  }
  if (JSON.stringify({ conversationContext, evidence }).length > 16000) {
    throw preparationError('Reply context exceeds 16000 characters. Select bounded excerpts and mark partial coverage.');
  }
  return { conversationContext, evidence };
}

// Preparation only. The bridge checks the lease before and after this call.
// Existing AI execution records own provenance. No claim or publication is made.
export async function generateActReply(payload, { generate = generateWriterOutput, env = process.env, readContext = xRead } = {}) {
  if (!payload.runId || !payload.sessionId) throw preparationError('reply-generate requires runId and sessionId.');
  const targetUrl = String(payload.targetUrl || '').trim();
  const targetTweetId = String(payload.targetTweetId || extractTweetIdFromUrl(targetUrl)).trim();
  let url;
  try { url = new URL(targetUrl); } catch { throw preparationError('reply-generate requires an exact X status targetUrl.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'x.com' || !/^\d{5,25}$/.test(targetTweetId)
    || extractTweetIdFromUrl(targetUrl) !== targetTweetId) throw preparationError('reply-generate target URL and ID must match.');
  const sourceText = String(payload.card?.sourceText || '').trim();
  if (!sourceText) throw preparationError('reply-generate requires the exact observed card.sourceText.');
  if (payload.behavior != null && payload.behavior.decision !== 'ACT') {
    throw preparationError('Optional behavior must be an ACT suggestion, or omit behavior and let the Writer choose.');
  }
  if (getBlockingActAttemptForTarget(targetTweetId)) throw new Error('reply-generate target has an existing publication fence.');
  const candidateKey = String(payload.candidateKey || '').trim();
  const savedAtStart = getCandidate(candidateKey || targetUrl);
  const draftAtStart = getDraftByCandidate(candidateKey || targetUrl);
  if (savedAtStart && extractTweetIdFromUrl(savedAtStart.url) !== targetTweetId) throw preparationError('reply-generate candidate does not match targetUrl.');
  const context = observedReplyContext(payload);
  if (!context.conversationContext) {
    // Collect once at the source owner instead of asking an executor to recreate
    // reader output by hand. A failed sample does not block a source-only act.
    let sample;
    try { sample = await readContext({ kind: 'replies', id: targetTweetId, mode: 'top', limit: 20 }); }
    catch { sample = { ok: false }; }
    const observed = sample?.ok === true;
    context.conversationContext = { sourceUrl: targetUrl, partial: true, posts: [],
      readStatus: observed ? 'observed' : 'unavailable',
      note: observed ? 'Bounded reply sample, not complete coverage.' : 'Reply sample unavailable. A fitting reaction to the observed source is still possible.' };
    for (const post of observed && Array.isArray(sample.posts) ? sample.posts.slice(0, 20) : []) {
      if (!post?.id || !post.url || typeof post.text !== 'string') continue;
      context.conversationContext.posts.push(post);
      if (JSON.stringify(context).length > 16000) {
        context.conversationContext.posts.pop();
        break;
      }
    }
    observedReplyContext(context);
  }
  const candidate = { ...savedAtStart, key: candidateKey || targetUrl, source: 'x', url: targetUrl,
    title: `@${url.pathname.split('/')[1]}`, text: sourceText };
  const writerBase = draftAtStart || { body: '', editor: { pipeline: 'reply' } };
  const packet = buildWriterPacket({ candidate, ...context, queueItem: { pipeline: 'reply', behavior: payload.behavior },
    draft: writerBase, topicBrief: payload.resolvedTopicBrief || null });
  packet.suggestedBehavior = payload.behavior || null;
  if (payload.feedback) packet.executorFeedback = String(payload.feedback);
  const operator = operatorModelReport(env);
  const mode = env.X_GROWTH_REPLY_WRITER_MODE || 'profile';
  if (!['operator', 'profile'].includes(mode)) throw new Error('Reply writer mode must be operator or profile.');
  if (mode === 'operator') return { status: 'operator_writes', packet: projectReplyPacket(packet),
    contract: REPLY_CONTRACT, outputSchema: replyOutputSchema(packet), publicationAuthority: false };
  const output = await generate(packet, REPLY_CONTRACT, { skipReview: true,
    metadata: { runId: payload.runId, sessionId: payload.sessionId, targetTweetId, operator } });
  if (!['POST', 'DO_NOT_POST'].includes(output.decision)) throw new Error('Writer returned an invalid Reply decision.');
  const text = String(output.finalText || '');
  if (text !== text.trim()) throw new Error('Writer public text must not contain surrounding whitespace.');
  const applied = applyWriterOutput(writerBase, output, { writerPacket: packet });
  const topicBrief = applied.editor.topicBrief || null;
  if (output.decision === 'POST') validateActInput({ action: 'reply', text, targetTweetId, targetUrl });
  let saved = null;
  if (output.decision === 'POST') {
    saved = runStoreTransaction(() => {
      if (!savedCandidateMatches(candidate, savedAtStart) || getBlockingActAttemptForTarget(targetTweetId)) {
        throw new Error('Reply source or publication fence changed during generation.');
      }
      const current = getDraftByCandidate(candidate.key);
      if (current?.updatedAt !== draftAtStart?.updatedAt) throw new Error('Reply draft changed during generation.');
      upsertCandidates([candidate]);
      const queue = ensureQueueItem(candidate.key, { pipeline: 'reply', lane: 'engagement', status: 'drafting' });
      saveQueueItem({ ...queue, behavior: applied.editor.behavior });
      const prepared = saveDraft({ ...current, ...applied, id: current?.id, candidateKey: candidate.key, status: 'draft' }, { expectedUpdatedAt: draftAtStart?.updatedAt });
      recordServerWriterGeneration(prepared, { execution: output.execution, runId: payload.runId, sessionId: payload.sessionId, packet });
      return prepared;
    });
  }
  return { status: output.decision === 'POST' ? 'generated' : 'skipped', text,
    writerInvocationId: output.execution?.invocationId || null, writer: output.execution || null,
    draftId: saved?.id || null, behavior: saved?.editor?.behavior || null,
    replyReview: output.replyReview,
    operator, targetTweetId, targetUrl, candidateKey: candidate.key,
    ...(topicBrief ? { topicBrief: { collectionId: topicBrief.collectionId, briefId: topicBrief.briefId, paragraphIds: topicBrief.paragraphIds } } : {}),
    publicationAuthority: false };
}

function savedCandidateMatches(candidate, before) {
  const current = getCandidate(candidate.key);
  return before ? current?.text === before.text && current?.url === before.url : !current;
}
