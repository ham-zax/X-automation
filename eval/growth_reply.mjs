import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const original = process.cwd();
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const write = async (p, value) => writeFile(p, JSON.stringify(value, null, 2) + '\n');
const resolve = p => path.resolve(original, p);
const sentinel = Symbol('capture');
async function capture(fn) {
  let request;
  try { await fn(async value => { request = value; throw sentinel; }); } catch (error) { if (error !== sentinel) throw error; }
  if (!request) throw new Error('Request was not captured');
  return request;
}
async function main(input) {
  const dir = resolve(input.outputDir || '.');
  await mkdir(dir, { recursive: true });
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'growth-reply-'));
  try {
    process.chdir(scratch);
    const [drafting, runtime, ai, content, act] = await Promise.all([
      import('../drafting.js'), import('../writer_runtime.js'), import('../ai_runtime.js'), import('../content_review.js'), import('../act.js'),
    ]);
    const files = Object.fromEntries(['packet', 'case', 'request', 'review-request', 'inspection'].map(n => [n, path.join(dir, `${n}.json`)]));
    if (input.operation === 'prepare') {
      const fixture = await read(resolve(input.fixtureFile || path.join(root, 'eval/fixtures/growth_reply.json')));
      const item = fixture.cases.find(c => c.id === input.caseId);
      if (!item) throw new Error('Unknown caseId');
      const lane = input.lane || 'writer';
      if (!['writer', 'direct'].includes(lane)) throw new Error('Invalid lane');
      const candidate = { ...item, key: item.url };
      const draft = { candidateKey: item.url, body: '', editor: { pipeline: 'reply' } };
      const queueItem = { pipeline: 'reply', behavior: item.behavior, replyArchetype: item.replyArchetype, contributionSummary: item.contributionSummary };
      const expected = drafting.buildWriterPacket({ candidate, queueItem, draft });
      const packet = input.packetFile ? await read(resolve(input.packetFile)) : expected;
      if (packet.pipeline !== 'reply' || !isDeepStrictEqual(packet.candidate, expected.candidate)
        || !isDeepStrictEqual(packet.behavior, expected.behavior)) throw new Error('Frozen packet does not match this reply source or behavior. Use a fresh run root.');
      if (input.packetFile) await writeFile(files.packet, await readFile(resolve(input.packetFile))); else await write(files.packet, packet);
      await write(files.case, { lane, candidate, draft, omissions: ['blank recent and history state', 'no owner attestations', 'no browser, room or thread context', 'fixture behavior is not a generation trace'], publicationAuthority: false });
      const style = input.styleFile ? await readFile(resolve(input.styleFile), 'utf8') : '';
      let request;
      if (lane === 'writer') {
        const prompt = await readFile(path.join(root, 'docs/POST_GENERATION_PROMPT.md'), 'utf8');
        request = await capture(runAI => runtime.generateWriterOutput(packet, prompt + (style ? `\n\nVOICE FRAGMENT:\n${style}` : ''), { runAI }));
      } else {
        const brief = await readFile(path.join(root, 'ops/systemd/arm/arm-growth-live.md'), 'utf8');
        const start = brief.indexOf('Writing a Reply:');
        const end = brief.indexOf('\nExecution:', start);
        if (start < 0 || end < 0) throw new Error('Attached reply instruction section is missing.');
        const section = brief.slice(start, end);
        request = { role: 'writer', prompt: `Limited instruction replay, not an attached browser run. Browser, room and history context are omitted.\n${section}\n\nFROZEN PACKET:\n${JSON.stringify(packet, null, 2)}${style ? `\n\nVOICE FRAGMENT:\n${style}` : ''}`, schema: { type: 'object', additionalProperties: false, required: ['decision', 'finalText'], properties: { decision: { enum: ['POST', 'DO_NOT_POST'] }, finalText: { type: 'string' } } } };
      }
      await write(files.request, request);
      return { status: 'prepared', artifacts: { packet: files.packet, case: files.case, request: files.request } };
    }
    const state = await read(files.case), packet = await read(files.packet), request = await read(files.request);
    let output;
    try { output = await read(path.join(dir, 'model-output.json')); } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      await rm(files['review-request'], { force: true });
      await write(files.inspection, { status: 'blocked', schemaErrors: ['Model output is not valid JSON.'], exactText: null, publicationAuthority: false });
      return { status: 'blocked', artifacts: { inspection: files.inspection } };
    }
    const validation = ai.validateStructuredOutput(output, request.schema);
    const errors = [...validation.errors];
    if (validation.valid && state.lane === 'writer') { try { drafting.validateWriterEvidenceReferences(output, packet); } catch (e) { errors.push(e.message); } }
    if (errors.length) {
      await rm(files['review-request'], { force: true });
      await write(files.inspection, { status: 'blocked', schemaErrors: errors, exactText: output?.finalText ?? null, publicationAuthority: false });
      return { status: 'blocked', artifacts: { inspection: files.inspection } };
    }
    const reviewOutput = state.lane === 'writer' ? output : { ...output, pipeline: 'reply', threadParts: [] };
    if (input.operation === 'review-request') {
      const reviewRequest = await capture(runAI => runtime.reviewWriterOutput(packet, reviewOutput, { runAI }));
      if (input.reviewStyleFile) reviewRequest.prompt += `\n\nOFFLINE REVIEW CALIBRATION:\n${await readFile(resolve(input.reviewStyleFile), 'utf8')}`;
      await write(files['review-request'], reviewRequest);
      return { status: 'review-requested', artifacts: { reviewRequest: files['review-request'] } };
    }
    if (input.operation !== 'inspect') throw new Error('Unknown operation');
    const reviewRequest = await read(files['review-request']);
    let review;
    try { review = await read(path.join(dir, 'review-output.json')); } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      await write(files.inspection, { status: 'blocked', schemaErrors: ['Review output is not valid JSON.'], exactText: output.finalText, publicationAuthority: false });
      return { status: 'blocked', artifacts: { inspection: files.inspection } };
    }
    const reviewValidation = ai.validateStructuredOutput(review, reviewRequest.schema);
    let draft = state.draft, actError = null, bound = null, score = null;
    if (state.lane === 'writer') draft = drafting.applyWriterOutput(draft, output, { writerPacket: packet });
    else {
      draft = { ...draft, body: output.finalText, editor: { pipeline: 'reply', finalText: output.finalText, behavior: packet.behavior } };
      if (output.decision === 'POST') try { act.validateActInput({ action: 'reply', text: output.finalText, targetTweetId: state.candidate.sourceId, targetUrl: state.candidate.url }); } catch (e) { actError = e.message; }
    }
    const context = { pipeline: 'reply', behavior: packet.behavior, evidence: packet.evidence, personaVersion: packet.persona?.version };
    if (reviewValidation.valid) {
      bound = content.bindContentReview(review, drafting.draftReviewContext(draft, state.candidate, context));
      draft.editor.contentReview = bound;
      score = drafting.scoreDraft(draft, state.candidate, context);
    }
    const inspection = { status: !reviewValidation.valid || !bound?.passed || actError ? 'blocked' : output.decision === 'DO_NOT_POST' ? 'do-not-post' : 'inspected', exactText: output.finalText, decision: output.decision, schemaErrors: reviewValidation.errors, reviewFailures: bound?.issues || [], review: bound, actError, score, publicationAuthority: false };
    await write(files.inspection, inspection);
    return { status: inspection.status, artifacts: { inspection: files.inspection } };
  } finally { process.chdir(original); await rm(scratch, { recursive: true, force: true }); }
}
try {
  let data = ''; for await (const chunk of process.stdin) data += chunk;
  const result = await main(JSON.parse(data));
  process.stdout.write(JSON.stringify(result) + '\n');
} catch (error) { process.stdout.write(JSON.stringify({ status: 'error', error: error.message }) + '\n'); process.exitCode = 1; }
