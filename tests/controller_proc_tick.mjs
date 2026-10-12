// One-shot child tick for the dual-process daily-cap test. The parent spawns
// two of these against the same scratch database with distinct candidates and
// a one-call daily ceiling; exactly one may dispatch. Args:
// scratchDir candidateId delayMs.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [scratchDir, candidateId, delayMs] = process.argv.slice(2);
process.chdir(scratchDir);
const moduleUrl = (name) => pathToFileURL(path.join(root, name)).href;
const controller = await import(moduleUrl('semantic_controller.js'));
const store = await import(moduleUrl('store.js'));

// Frozen daytime clock (15:00 IST): contention semantics do not need wall
// time, and the real clock would make rest-hours filtering flaky. Matches
// the frozen NOW convention in tests/semantic_controller.test.mjs.
const now = Date.UTC(2026, 9, 11, 9, 30, 0);
const key = `https://x.com/dev${candidateId}/status/${2000 + Number(candidateId)}`;
store.configureGrowthOperatorDelegation({ mode: 'live' }, { actor: 'human' });
if (store.getGrowthOperatorDelegation().state !== 'running') store.startGrowthOperatorDelegation({ actor: 'human' });
store.upsertCandidates([{
  key, source: 'x', title: `@dev${candidateId}`, text: `Dual-process contention note ${candidateId}`, url: key, timestamp: now - 60000, metrics: {},
}]);
store.saveDiscoverSnapshot('x_latest', [{ key }], now);
store.recordSourceObservations([{ candidateKey: key, snapshotKind: 'x_latest', observedAt: now, rank: 1 }]);
const full = {
  decision: 'skip', purpose: 'p', rationale: 'r',
  targetCandidateKey: '', draft: '', missingEvidence: '', revisitCondition: '',
};
const runStructured = async () => {
  await new Promise((resolve) => setTimeout(resolve, Number(delayMs || 400)));
  return {
    output: { ...full },
    execution: { inputTokens: 100, cachedInputTokens: 10, outputTokens: 50, reasoningTokens: 5 },
  };
};
const result = await controller.controllerTick({
  now,
  sessionId: `proc-${candidateId}`,
  profile: { name: 'proc-direct', runtime: 'direct_api', providerKind: 'openai_compatible', protocol: 'responses', model: 'test-model', baseUrl: 'https://example.invalid/v1' },
  runStructured,
  config: { ceiling: { maxDailyModelCalls: 1, maxDailyInputTokens: 1e12, maxDailyOutputTokens: 1e12 } },
});
console.log(JSON.stringify({ status: result.status, modelCalls: result.modelCalls, jobId: result.jobId }));
