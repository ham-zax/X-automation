import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = await mkdtemp(path.join(tmpdir(), 'growth-persona-tone-'));
const previousCwd = process.cwd();
const previousTimezone = process.env.X_PERSONA_TIMEZONE;
process.chdir(directory);
process.env.X_PERSONA_TIMEZONE = 'Asia/Kolkata';
const url = name => pathToFileURL(path.join(root, name)).href;
const store = await import(url('store.js'));
const tone = await import(url('persona_tone.js'));
const persona = await import(url('persona.js'));
const drafting = await import(url('drafting.js'));

try {
  await test('reading the daily tone is inert and defaults to zero influence', () => {
    assert.equal(tone.getDailyPersonaTone().influence, 0);
    assert.equal(store.getAppState('persona_daily_tone:v1', null), null);
    assert.equal(persona.getPersonaSlice('writer').dailyTone.active, false);
  });
  await test('agent selection requires delegation and stored observation provenance', () => {
    assert.throws(() => tone.setDailyPersonaTone({ mode: 'curious', reason: 'Open questions' }), /running Growth Operator/);
    store.configureGrowthOperatorDelegation({ mode: 'dry_run' }, { actor: 'human' });
    store.startGrowthOperatorDelegation({ actor: 'human' });
    assert.throws(() => tone.setDailyPersonaTone({ mode: 'curious', reason: 'Open questions', sourceReferences: ['invented'] }), /observed candidates/);
    const key = 'https://x.com/builder/status/8001';
    store.upsertCandidates([{ key, url: key, source: 'x', title: '@builder', text: 'How should a developer recover a stopped workflow?', timestamp: Date.now() }]);
    const selected = tone.setDailyPersonaTone({ mode: 'curious', reason: 'Observed builder question about recovery', sourceReferences: [key] });
    assert.equal(selected.mode, 'curious');
    assert.equal(selected.influence, 0.1);
    assert.equal(selected.interpretation, 'writing_preference_only');
    assert.equal(selected.source, 'agent_context');
    assert.throws(() => tone.setDailyPersonaTone({ mode: 'energized', reason: 'New preference', sourceReferences: [key] }), /already selected/);
    assert.throws(() => tone.setDailyPersonaTone({ mode: 'warm', influence: 0.5, reason: 'Too much' }, { actor: 'human' }), /between 0 and 0.1/);
  });
  await test('owner override survives agent replacement and expires at the local day boundary', () => {
    const now = Date.parse('2026-10-01T18:29:00Z');
    const selected = tone.setDailyPersonaTone({ mode: 'focused', influence: 0.05, reason: 'Owner prefers a focused style today' }, { actor: 'human', now });
    assert.equal(selected.source, 'owner_override');
    assert.equal(selected.expiresAt, now + 60_000);
    assert.throws(() => tone.setDailyPersonaTone({ mode: 'playful', reason: 'Agent prefers jokes' }, { actor: 'agent', now: now + 1000 }), /only the owner/);
    assert.equal(tone.getDailyPersonaTone({ now: now + 59_000 }).mode, 'focused');
    assert.equal(tone.getDailyPersonaTone({ now: now + 60_000 }).active, false);
    assert.equal(tone.getDailyPersonaTone({ now: now + 60_000 }).influence, 0);
  });
  await test('tone reaches writer realization without changing selected behavior or editorial ranking context', () => {
    const candidate = store.getCandidate('https://x.com/builder/status/8001');
    const queueItem = { pipeline: 'reply', contributionSummary: 'Name a useful recovery boundary', replyArchetype: 'implementation_detail' };
    tone.setDailyPersonaTone({ mode: 'focused', reason: 'Focus' }, { actor: 'human' });
    const first = drafting.buildWriterPacket({ candidate, queueItem });
    tone.setDailyPersonaTone({ mode: 'energized', reason: 'Energy' }, { actor: 'human' });
    const second = drafting.buildWriterPacket({ candidate, queueItem });
    assert.equal(first.persona.dailyTone.mode, 'focused');
    assert.equal(second.persona.dailyTone.mode, 'energized');
    for (const key of ['decision', 'pipeline', 'primaryPurpose', 'socialMode', 'informationDepth', 'affectStrategy']) assert.equal(first.behavior[key], second.behavior[key]);
    assert.equal(persona.getPersonaSlice('editorial').dailyTone, undefined);
    assert.equal(persona.getPersonaSlice('engagement').dailyTone, undefined);
  });
  await test('another agent session reads the same persisted tone through the bridge', () => {
    const result = execFileSync(process.execPath, [path.join(root, 'agent_bridge.js'), 'persona-tone'], { cwd: directory, encoding: 'utf8', input: '{}', env: process.env });
    const parsed = JSON.parse(result);
    assert.equal(parsed.tone.mode, 'energized');
    assert.equal(parsed.scope, 'wording_only');
  });
} finally {
  process.chdir(previousCwd);
  if (previousTimezone === undefined) delete process.env.X_PERSONA_TIMEZONE;
  else process.env.X_PERSONA_TIMEZONE = previousTimezone;
  await rm(directory, { recursive: true, force: true });
}
