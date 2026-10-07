# Writer Voice Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the X Growth writer preserve Hamza's actual voice during final realization, so a correct thesis/behavior/strategy cannot silently become institutional analyst prose and delegated automation cannot publish an off-voice draft.

**Architecture:** Keep purpose, provenance, strategy, and voice as separate layers. The active persona becomes a binding realization constraint above optional writing-strategy presentation guidance; the writer packet gains bounded voice-calibration examples; an async voice-review pass evaluates only realization against the exact persona and behavior, performs at most one constrained repair, and binds its verdict to the exact generated text + persona version. Human approval remains the subjective override boundary, while mission-agent main-feed approval and autonomous live replies require a current passing voice review.

**Tech Stack:** Node.js ES modules, existing `runStructuredAI()` runtime, JSON persona model, SQLite-backed draft/queue persistence through existing store/pipeline APIs, Node built-in `node:test`, React/Vite UI only for observability.

**Spec:** `docs/POST_GENERATION_PROMPT.md` (canonical Writer-realization contract), with regression evidence in `docs/research/x_creator_phase2/HAMZA_X_BEFORE_AFTER_AUDIT_2026-09-04.md`.

## Global Constraints

- Source facts, factual provenance, exact-text owner evidence, and explicit human decisions remain higher authority than style.
- The normalized `behavior` decision still owns purpose, social mode, affect, information depth, conversation stage, and reason to exist.
- Active persona realization constrains wording and rhetorical shape; optional `writingStrategy` may influence presentation but may not replace Hamza's register or force a stock comparison morphology.
- Preserve the existing persona rules: builder-to-builder, decisive before diplomatic, spoken when appropriate, precise when consequence requires it; avoid institutional analyst prose, ritual hidden-boundary framing, and abstract takeaway sentences added only for completeness.
- Do not make casualness a universal rule: `technical_explanation` and `reusable_artifact` may remain long and structured when the behavior requires them.
- Do not invent owner use, testing, deployment, purchases, benchmarks, private history, or emotional history.
- A social-only act may remain terse; do not append technical content just to satisfy the reviewer.
- The voice reviewer judges realization only. It must not recompute factual truth, route, purpose, strategy, or publication authority.
- One automatic voice-repair attempt maximum. If the repaired text still fails, stop automation and require review; never loop until the model agrees with itself.
- Reuse the configured `writer` AI role with separate metadata (`consumer: writer_voice_review` / `writer_voice_repair`); do not add a new required runtime role or migration for this repair.
- Voice review must be bound to a SHA-256 hash of the exact publication text/thread plus `personaModelVersion`; edited text or a persona-version change invalidates it.
- Human main-feed/reply approval may proceed after existing hard factual/purpose gates even if voice review is absent/failing, because the human is the final subjective voice authority. Mission-agent approval and autonomous live replies must fail closed without a current passing voice review.
- Bump the persona version when the new voice-calibration contract lands. Existing delegated approvals using the old persona must be re-reviewed by the existing stale-persona safeguards; do not mass-reapprove them.
- Before deploying the persona bump, resolve any queue item already in `publishing` using the existing unknown-outcome protocol. Do not change persona state in the middle of an unresolved public write.
- Verification for this change must generate/review drafts only. Do not publish to X as part of implementation tests.

---

### Task 1: Make voice a first-class persona contract and demote strategy below it

**Files:**
- Modify: `persona/hamza-v1.json:3,118-149,212-263`
- Modify: `persona.js:75-116`
- Modify: `docs/POST_GENERATION_PROMPT.md` sections `AUTHORITY ORDER`, `sourceStyle`, and `writingStrategy`
- Test: `tests/writer_voice_fidelity.test.mjs` (create in this task)

**Interfaces:**
- Consumes: existing `getPersonaSlice('writer')` and `languageRealization` contract.
- Produces: `persona.voiceCalibration` in every writer packet; persona version `hamza-v1-alpha-2026-09-08`; explicit authority rule that persona realization constrains strategy presentation.

- [ ] **Step 1: Write the failing persona-slice regression test**

Create `tests/writer_voice_fidelity.test.mjs` with a direct JSON-model check that does not require the live store DB:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const persona = JSON.parse(fs.readFileSync(new URL('../persona/hamza-v1.json', import.meta.url), 'utf8'));

test('writer persona contains bounded voice calibration and the new version', () => {
  assert.equal(persona.version, 'hamza-v1-alpha-2026-09-08');
  assert.equal(persona.voiceCalibration.schemaVersion, 1);
  assert.ok(persona.voiceCalibration.preserveExamples.some((row) => row.text === 'just dont its bad'));
  assert.ok(persona.voiceCalibration.preserveExamples.some((row) => row.text === 'what?'));
  assert.ok(persona.voiceCalibration.repairPairs.some((row) => row.rule === 'stop_after_concrete_payoff'));
});
```

- [ ] **Step 2: Run the test and confirm it fails for the missing version/calibration**

Run:

```bash
node --test tests/writer_voice_fidelity.test.mjs
```

Expected: FAIL because the current persona version is `hamza-v1-alpha-2026-09-05` and `voiceCalibration` does not exist.

- [ ] **Step 3: Add bounded calibration data and bump the persona version**

Add this top-level object to `persona/hamza-v1.json` and change the version to `hamza-v1-alpha-2026-09-08`:

```json
"voiceCalibration": {
  "schemaVersion": 1,
  "evidenceBoundary": "preserveExamples are observed own-account utterances. repairPairs are counterfactual communication examples from the 2026-09-04 audit; they are calibration guidance, not proof of owner authorship or performance superiority.",
  "preserveExamples": [
    {
      "text": "just dont its bad",
      "source": "own_account_observed",
      "lesson": "A terse human reply may already be complete; do not rewrite it into analysis."
    },
    {
      "text": "what?",
      "source": "own_account_observed",
      "lesson": "Very short social participation is a legitimate Hamza mode when context carries the meaning."
    }
  ],
  "repairPairs": [
    {
      "before": "The interesting signal isn’t ‘found 2 Chrome bugs.’ A full-chain bonus means the pieces survived composition.",
      "after": "2 Chrome bugs is cool. chaining them into remote code exec + a sandbox escape on a released build is the part that matters.",
      "rule": "developer_judgment_before_analyst_taxonomy"
    },
    {
      "before": "Important boundary: Cursor’s self-hosted machines move execution, not the whole agent.",
      "after": "this is useful, but ‘self-hosted’ can sound more private than it is.",
      "rule": "reader_consequence_before_boundary_label"
    },
    {
      "before": "That’s a chunk-graph result. Measure request topology per route, not bundle size alone.",
      "after": "fewer requests are doing the work here.",
      "rule": "plain_conclusion_over_policy_memo"
    },
    {
      "before": "make the agent prove retry/idempotency semantics, not just tests.",
      "after": "duplicate webhook + retry + non-idempotent write is exactly the kind of bug that passes the happy path and charges someone twice.",
      "rule": "stop_after_concrete_payoff"
    }
  ]
}
```

Do not add generated 2026-09-08 agent copy as a `preserveExample`; this calibration layer must distinguish observed owner/account evidence from counterfactual repair guidance.

- [ ] **Step 4: Expose calibration only to the writer slice**

Change the `consumer === 'writer'` branch in `persona.js` to include:

```js
voiceCalibration: model.voiceCalibration || {
  schemaVersion: 1,
  evidenceBoundary: '',
  preserveExamples: [],
  repairPairs: [],
},
```

Keep editorial/engagement slices unchanged unless they already need the field for another documented consumer.

- [ ] **Step 5: Fix the canonical authority order and strategy wording**

In `docs/POST_GENERATION_PROMPT.md`, change the relevant authority order from:

```text
7. selected writingStrategy presentation guidance;
8. active persona language/affect realization;
```

to:

```text
7. active persona language/affect realization and voice-calibration constraints;
8. selected writingStrategy presentation guidance;
```

Add this binding rule immediately after the `writingStrategy` instructions:

```text
Writing strategy is presentation guidance, not a voice template. It may choose comparison, explanation, proof order, or opening features, but it may not force institutional analyst register, repeated X-vs-Y symmetry, a hidden-boundary/corrector posture, or an abstract takeaway after the concrete payoff when the active persona says to avoid those forms. When strategy and persona realization conflict, preserve the strategy's informational intent and rewrite its morphology into the active persona.
```

Add a calibration rule:

```text
`persona.voiceCalibration.preserveExamples` are small observed examples showing what may be left alone. `repairPairs` demonstrate direction of repair only; do not copy their wording, do not treat them as owner-authored facts, and do not infer that their performance is better.
```

- [ ] **Step 6: Extend the test to prove the contract text has the intended precedence**

Append to `tests/writer_voice_fidelity.test.mjs`:

```js
const prompt = fs.readFileSync(new URL('../docs/POST_GENERATION_PROMPT.md', import.meta.url), 'utf8');

test('persona realization outranks optional writing strategy', () => {
  const personaIndex = prompt.indexOf('active persona language/affect realization and voice-calibration constraints');
  const strategyIndex = prompt.indexOf('selected `writingStrategy` presentation guidance');
  assert.ok(personaIndex >= 0);
  assert.ok(strategyIndex >= 0);
  assert.ok(personaIndex < strategyIndex);
  assert.match(prompt, /Writing strategy is presentation guidance, not a voice template\./);
});
```

- [ ] **Step 7: Run the focused test**

Run:

```bash
node --test tests/writer_voice_fidelity.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit the persona/contract change**

```bash
git add persona/hamza-v1.json persona.js docs/POST_GENERATION_PROMPT.md tests/writer_voice_fidelity.test.mjs
git commit -m "fix: make persona voice constrain writer strategy"
```

---

### Task 2: Add exact-text voice review and one-shot repair to the writer runtime

**Files:**
- Create: `voice_review.js`
- Modify: `writer_runtime.js:1-62`
- Modify: `drafting.js:274-320`
- Test: `tests/writer_voice_fidelity.test.mjs`

**Interfaces:**
- Consumes: `packet.persona`, `packet.behavior`, `packet.writingStrategy`, generated writer output, and existing `runStructuredAI({ role: 'writer', ... })`.
- Produces:
  - `reviewWriterVoice(packet, writerOutput, options) -> Promise<{ record, execution }>`
  - `generateWriterOutputWithVoiceReview(packet, promptDocumentText, options) -> Promise<writerOutput & { voiceReview, voiceRepair }>`
  - `isCurrentPassingVoiceReview(draft, personaModelVersion) -> boolean`
  - `applyWriterOutput(..., { voiceReview })` persistence in `draft.editor.voiceReview`.

- [ ] **Step 1: Add failing tests for hash binding and reviewer scope**

Append tests that import the new pure helpers:

```js
import {
  buildVoiceReviewPrompt,
  voiceReviewContentHash,
  isCurrentPassingVoiceReview,
} from '../voice_review.js';

test('voice review hash changes when publication text changes', () => {
  const a = voiceReviewContentHash({ pipeline: 'quote', finalText: 'one', threadParts: [] });
  const b = voiceReviewContentHash({ pipeline: 'quote', finalText: 'two', threadParts: [] });
  assert.notEqual(a, b);
});

test('voice review prompt judges realization without recomputing purpose or facts', () => {
  const reviewPrompt = buildVoiceReviewPrompt({
    persona: {
      version: 'hamza-v1-alpha-2026-09-08',
      languageRealization: { avoid: ['institutional analyst prose'] },
      accountEvidencePatterns: [],
      behaviorExamples: {},
      voiceCalibration: { schemaVersion: 1, preserveExamples: [], repairPairs: [] },
    },
    behavior: { primaryPurpose: 'judgment', informationDepth: 'compact_reason' },
    writingStrategy: { intent: 'compare_evaluate', style: 'comparison' },
  }, {
    decision: 'POST',
    pipeline: 'quote',
    finalText: 'Universal clients attack the visible pain. Portable context attacks the switching cost.',
    threadParts: [],
  });
  assert.match(reviewPrompt, /Do not recompute factual truth, route, purpose, or publication authority/);
  assert.match(reviewPrompt, /institutional analyst prose/);
  assert.match(reviewPrompt, /Universal clients attack the visible pain/);
});

test('passing voice review must match exact content hash and persona version', () => {
  const draft = {
    body: 'same text',
    threadParts: [],
    editor: {
      pipeline: 'quote',
      personaModelVersion: 'hamza-v1-alpha-2026-09-08',
      voiceReview: {
        decision: 'PASS',
        contentHash: voiceReviewContentHash({ pipeline: 'quote', finalText: 'same text', threadParts: [] }),
        personaModelVersion: 'hamza-v1-alpha-2026-09-08',
      },
    },
  };
  assert.equal(isCurrentPassingVoiceReview(draft, 'hamza-v1-alpha-2026-09-08'), true);
  assert.equal(isCurrentPassingVoiceReview({ ...draft, body: 'edited text' }, 'hamza-v1-alpha-2026-09-08'), false);
  assert.equal(isCurrentPassingVoiceReview(draft, 'hamza-v1-alpha-2026-09-09'), false);
});
```

- [ ] **Step 2: Run the test and confirm missing-module failure**

Run:

```bash
node --test tests/writer_voice_fidelity.test.mjs
```

Expected: FAIL because `voice_review.js` does not exist.

- [ ] **Step 3: Implement `voice_review.js` as a narrow realization critic**

Create `voice_review.js` with these exports and contracts:

```js
import { createHash } from 'node:crypto';
import { runStructuredAI } from './ai_runtime.js';

export const VOICE_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'violations', 'summary', 'rewriteGuidance'],
  properties: {
    decision: { enum: ['PASS', 'REPAIR'] },
    violations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'evidence', 'guidance'],
        properties: {
          code: {
            enum: [
              'INSTITUTIONAL_ANALYST_REGISTER',
              'STRATEGY_MORPHOLOGY_OVERRIDE',
              'TECHNICAL_CORRECTOR_SATURATION',
              'ABSTRACT_TAKEAWAY_AFTER_PAYOFF',
              'UNNATURAL_PARALLELISM',
              'VOICE_CALIBRATION_MISMATCH'
            ]
          },
          evidence: { type: 'string' },
          guidance: { type: 'string' }
        }
      }
    },
    summary: { type: 'string' },
    rewriteGuidance: { type: 'string' }
  }
};

function publicationMaterial(output) {
  return output?.pipeline === 'thread'
    ? { pipeline: 'thread', threadParts: Array.isArray(output.threadParts) ? output.threadParts.map((x) => String(x || '').trim()) : [] }
    : { pipeline: String(output?.pipeline || ''), finalText: String(output?.finalText || '').trim() };
}

export function voiceReviewContentHash(output) {
  return createHash('sha256').update(JSON.stringify(publicationMaterial(output))).digest('hex');
}

export function buildVoiceReviewPrompt(packet, output) {
  return [
    'You are a narrow voice-realization reviewer for @ham_zax.',
    'Judge only whether the proposed wording realizes the supplied behavior in the active Hamza persona.',
    'Do not recompute factual truth, route, purpose, writing strategy, or publication authority.',
    'Do not demand casualness, slang, lowercase, shortness, humor, or first person by default.',
    'Long technical writing is valid when the supplied informationDepth requires it.',
    'A terse social-only reply is valid and must not be expanded merely to look useful.',
    'Return REPAIR only when the wording violates a concrete supplied persona realization rule or calibration boundary.',
    'Writing strategy may shape information order but cannot override persona register or force stock morphology.',
    '',
    'PERSONA:', JSON.stringify({
      version: packet?.persona?.version || '',
      identity: packet?.persona?.identity || {},
      languageRealization: packet?.persona?.languageRealization || {},
      accountEvidencePatterns: packet?.persona?.accountEvidencePatterns || [],
      behaviorExamples: packet?.persona?.behaviorExamples || {},
      voiceCalibration: packet?.persona?.voiceCalibration || {},
    }, null, 2),
    '',
    'BEHAVIOR:', JSON.stringify(packet?.behavior || {}, null, 2),
    '',
    'WRITING STRATEGY:', JSON.stringify(packet?.writingStrategy || null, null, 2),
    '',
    'PROPOSED OUTPUT:', JSON.stringify(publicationMaterial(output), null, 2),
  ].join('\n');
}

export async function reviewWriterVoice(packet, output, { timeoutMs = 60_000, runStructured = runStructuredAI } = {}) {
  const result = await runStructured({
    role: 'writer',
    prompt: buildVoiceReviewPrompt(packet, output),
    schema: VOICE_REVIEW_SCHEMA,
    timeoutMs,
    metadata: { consumer: 'writer_voice_review' },
  });
  return {
    record: {
      schemaVersion: 1,
      decision: result.output.decision,
      violations: result.output.violations,
      summary: result.output.summary,
      rewriteGuidance: result.output.rewriteGuidance,
      contentHash: voiceReviewContentHash(output),
      personaModelVersion: String(packet?.persona?.version || packet?.behavior?.personaModelVersion || ''),
      reviewedAt: Date.now(),
    },
    execution: result.execution || null,
  };
}
```

Add `isCurrentPassingVoiceReview(draft, personaModelVersion)` that reconstructs the publication material from `draft.editor.pipeline` + `draft.body` / `draft.threadParts`, verifies `decision === 'PASS'`, exact `contentHash`, and exact persona version.

- [ ] **Step 4: Add one-shot repair orchestration to `writer_runtime.js`**

Export the current writer output schema as `WRITER_OUTPUT_SCHEMA`. Add a private repair prompt builder that preserves the existing output schema and all non-voice constraints:

```js
function voiceRepairPrompt(packet, promptDocumentText, originalOutput, review) {
  return [
    'Repair the proposed candidate for voice realization only.',
    'Preserve supplied facts, behavior purpose/mode/affect/depth, pipeline, evidenceUsed references, media decision, and any explicit experiment treatment.',
    'Do not add owner experience, facts, benchmarks, or claims.',
    'Do not change the strategy intent merely because the first phrasing was too analyst-like; change morphology/register instead.',
    'Apply the reviewer guidance once. Return the same structured writer schema.',
    '',
    'WRITING CONTRACT:', promptDocumentText,
    '',
    'WRITER PACKET:', JSON.stringify(packet, null, 2),
    '',
    'ORIGINAL OUTPUT:', JSON.stringify(originalOutput, null, 2),
    '',
    'VOICE REVIEW:', JSON.stringify(review, null, 2),
  ].join('\n');
}
```

Add:

```js
export async function generateWriterOutputWithVoiceReview(packet, promptDocumentText, { timeoutMs = 120_000 } = {}) {
  const first = await generateWriterOutput(packet, promptDocumentText, { timeoutMs });
  const firstReview = await reviewWriterVoice(packet, first);
  if (firstReview.record.decision === 'PASS') {
    return { ...first, voiceReview: { ...firstReview.record, execution: firstReview.execution }, voiceRepair: { attempted: false } };
  }

  const repairedResult = await runStructuredAI({
    role: 'writer',
    prompt: voiceRepairPrompt(packet, promptDocumentText, first, firstReview.record),
    schema: WRITER_OUTPUT_SCHEMA,
    timeoutMs,
    metadata: { consumer: 'writer_voice_repair' },
  });
  validateWriterEvidenceReferences(repairedResult.output, packet);
  const repaired = { ...repairedResult.output, execution: repairedResult.execution };
  const secondReview = await reviewWriterVoice(packet, repaired);
  return {
    ...repaired,
    voiceReview: { ...secondReview.record, execution: secondReview.execution },
    voiceRepair: {
      attempted: true,
      originalContentHash: firstReview.record.contentHash,
      originalReview: firstReview.record,
      repairExecution: repairedResult.execution || null,
    },
  };
}
```

Do not perform a third generation when the second review returns `REPAIR`.

- [ ] **Step 5: Persist review metadata through `applyWriterOutput`**

Extend the options signature in `drafting.js`:

```js
export function applyWriterOutput(
  draft,
  writerOutput = {},
  { generationProvenance = null, writerPacket = null, voiceReview = null, voiceRepair = null } = {},
) {
```

After constructing `editor`, add:

```js
if (voiceReview) editor.voiceReview = { ...voiceReview };
if (voiceRepair) editor.voiceRepair = { ...voiceRepair };
```

Do not allow the writer model's normal structured output to invent these fields; only runtime orchestration supplies them.

- [ ] **Step 6: Add fake-runtime tests for PASS, one repair, and no infinite loop**

Use dependency injection in `reviewWriterVoice` and a small test-only fake for the structured calls. Assert:

```js
assert.equal(result.voiceReview.decision, 'PASS');
assert.equal(result.voiceRepair.attempted, true);
assert.equal(repairCallCount, 1);
assert.equal(reviewCallCount, 2);
```

Also cover a second `REPAIR` verdict and assert no third generation call occurs.

- [ ] **Step 7: Run focused tests**

```bash
node --test tests/writer_voice_fidelity.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit the runtime layer**

```bash
git add voice_review.js writer_runtime.js drafting.js tests/writer_voice_fidelity.test.mjs
git commit -m "feat: add bounded writer voice review and repair"
```

---

### Task 3: Wire voice review into main-feed generation and autonomous replies

**Files:**
- Modify: `web_api.js:654-699`
- Modify: `autonomous_reply.js:341-487`
- Test: `tests/writer_voice_fidelity.test.mjs`

**Interfaces:**
- Consumes: `generateWriterOutputWithVoiceReview()` and `applyWriterOutput(..., { voiceReview, voiceRepair })` from Task 2.
- Produces: every internally generated draft has inspectable `editor.voiceReview`; autonomous live send requires current `PASS`.

- [ ] **Step 1: Add failing integration tests around the caller contract**

Extract or expose small pure helpers where necessary so the tests can assert these decisions without calling X or a real AI runtime:

```js
export function autonomousVoiceReviewPassed(draft, personaModelVersion) {
  return isCurrentPassingVoiceReview(draft, personaModelVersion);
}
```

Test that a `REPAIR`/stale/absent review returns false and a matching `PASS` returns true.

- [ ] **Step 2: Switch UI/main-feed generation to the reviewed writer orchestrator**

In `web_api.js`, replace:

```js
const output = await generateWriterOutput(packet, promptDocumentText);
```

with:

```js
const output = await generateWriterOutputWithVoiceReview(packet, promptDocumentText);
```

Then pass review metadata to persistence:

```js
const next = applyWriterOutput(writerBase, output, {
  generationProvenance,
  writerPacket: packet,
  voiceReview: output.voiceReview,
  voiceRepair: output.voiceRepair,
});
```

Return `voiceReview`/`voiceRepair` in the existing generation response so UI and agent callers can inspect what happened.

- [ ] **Step 3: Switch autonomous reply generation to the same orchestrator**

In `autonomous_reply.js`, replace the direct `generateWriterOutput()` call inside `generateExactReply()` with `generateWriterOutputWithVoiceReview()`, and pass the review metadata through `applyWriterOutput`.

Add to the generated draft's autonomous metadata only execution/strategy context; do not duplicate voice-review state there.

- [ ] **Step 4: Make autonomous live-send eligibility fail closed on voice review**

After deterministic gate calculation in `evaluateAutonomousReplyItem()`, compute:

```js
const voiceReviewPassed = isCurrentPassingVoiceReview(
  checkedDraft,
  checkedDraft.editor?.personaModelVersion || generated.draft.editor?.personaModelVersion || '',
);
```

Add it to `checks`:

```js
voiceReview: checkedDraft.editor?.voiceReview || null,
voiceReviewPassed,
voiceRepair: checkedDraft.editor?.voiceRepair || null,
```

Before returning `decision: 'send'`, add:

```js
if (!voiceReviewPassed) {
  return {
    ...base,
    exactReply,
    aiExecution: generated.output.execution || null,
    generatedDraft: checkedDraft,
    checks,
    decision: 'review',
    reasons: [boundedReason(
      'VOICE_FIDELITY_REVIEW',
      checkedDraft.editor?.voiceReview?.summary || 'The generated reply did not pass the active Hamza voice review.',
    )],
  };
}
```

Do not convert voice failure into `skipped`; it is a repair/review condition, not evidence the opportunity is bad.

- [ ] **Step 5: Add tests proving social-only terseness is not structurally blocked**

Use a fake `PASS` review on `finalText: 'what?'` with `informationDepth: 'social_only'`, and assert the autonomous voice check allows it. This test protects against a future reviewer contract that equates Hamza voice with technical elaboration.

- [ ] **Step 6: Run tests**

```bash
node --test tests/writer_voice_fidelity.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit caller integration**

```bash
git add web_api.js autonomous_reply.js tests/writer_voice_fidelity.test.mjs
git commit -m "fix: gate automated X copy on current voice review"
```

---

### Task 4: Require voice review for delegated main-feed approval and provide an agent-friendly review command

**Files:**
- Modify: `pipeline.js:879-946`
- Modify: `agent_bridge.js:1272-1326,2263`
- Modify: `docs/AGENT_WORKFLOW.md:355-385,426`
- Test: `tests/writer_voice_fidelity.test.mjs`

**Interfaces:**
- Consumes: `isCurrentPassingVoiceReview()` and `reviewWriterVoice()`.
- Produces: mission-agent approval fails closed on absent/stale/failing voice review; external/agent-generated drafts can obtain exact review through `writer-voice-review` before delegated approval.

- [ ] **Step 1: Add a pure delegated-approval guard and failing tests**

Add in `pipeline.js`:

```js
function requireCurrentDelegatedVoiceReview(draft) {
  const personaModelVersion = draft?.editor?.personaModelVersion || '';
  if (!isCurrentPassingVoiceReview(draft, personaModelVersion)) {
    const review = draft?.editor?.voiceReview || null;
    const detail = review?.summary ? ` ${review.summary}` : '';
    throw new Error(`Delegated approval requires a current passing Hamza voice review.${detail}`);
  }
}
```

Tests should cover missing review, stale hash, stale persona version, `REPAIR`, and matching `PASS`.

- [ ] **Step 2: Enforce the guard only in mission-agent approval**

In `approveQueueItemAsMissionAgent()`, after loading the draft and before `analysis.publishable` is accepted, call:

```js
requireCurrentDelegatedVoiceReview(draft);
```

Do **not** add this guard to `approveQueueItem()` or `approveEngagementQueueItem()`; a human who has inspected exact text remains allowed to approve subjectively after existing hard gates.

- [ ] **Step 3: Add `writer-voice-review` to `agent_bridge.js`**

Add a command that:

1. accepts `{ "key": "<candidate key>" }`;
2. loads the exact current candidate, queue item, and draft;
3. refuses published/publishing mutation; published items may be reviewed read-only but not persisted;
4. builds the same writer packet context as `writer-packet`, including current writing strategy when applicable;
5. constructs an output-shaped view from the current draft:

```js
const currentOutput = {
  decision: 'POST',
  pipeline,
  finalText: pipeline === 'thread' ? '' : String(draft.body || ''),
  threadParts: pipeline === 'thread' ? [...(draft.threadParts || [])] : [],
};
```

6. calls `reviewWriterVoice(packet, currentOutput)`;
7. for unpublished drafts, saves `editor.voiceReview` bound to the exact current text/persona; for published history, returns the review without changing the draft;
8. returns `{ review, persisted, draftId, candidateKey }`.

Use the same packet-building inputs already used by `writer-packet`; do not invent a second persona/context builder.

- [ ] **Step 4: Update agent workflow documentation**

Document the delegated sequence as:

```text
writer-packet -> apply-writer-output -> writer-voice-review -> request review -> mission-agent approval -> claim -> exact live verification -> reconciliation
```

State explicitly:

```text
`writer-voice-review` is a realization check, not publication authority. It never posts. A passing result is required for delegated main-feed approval but does not substitute for purpose/provenance gates, source verification, approval snapshot integrity, or publication claim semantics.
```

- [ ] **Step 5: Run tests and bridge help smoke check**

```bash
node --test tests/writer_voice_fidelity.test.mjs
npm run agent -- help
```

Expected: tests PASS; help output lists `writer-voice-review`.

- [ ] **Step 6: Commit delegated-authority integration**

```bash
git add pipeline.js agent_bridge.js docs/AGENT_WORKFLOW.md tests/writer_voice_fidelity.test.mjs
git commit -m "fix: require voice review for delegated main-feed approval"
```

---

### Task 5: Surface voice review without adding another text-heavy workflow

**Files:**
- Modify: `ui/src/api/client.ts` around the existing draft/editor types
- Modify: `ui/src/features/create/DraftEditor.tsx:150-250`
- Test: `ui/tests/create-view.test.mjs`

**Interfaces:**
- Consumes: persisted `draft.editor.voiceReview` / `voiceRepair` already returned by the draft API.
- Produces: one compact status row in Create: `Voice: Pass`, `Voice: Repair needed`, or `Voice: Not reviewed`, with details only on expansion.

- [ ] **Step 1: Add a failing UI contract test**

Add a fixture with:

```js
editor: {
  voiceReview: {
    decision: 'REPAIR',
    summary: 'Comparison strategy became institutional analyst prose.',
    violations: [{
      code: 'INSTITUTIONAL_ANALYST_REGISTER',
      evidence: 'Universal clients attack the visible pain.',
      guidance: 'Keep the comparison, rewrite as a direct builder judgment.'
    }]
  },
  voiceRepair: { attempted: true }
}
```

Assert the rendered Create view includes `Voice` and `Repair needed` but does not dump all violation JSON into the default layout.

- [ ] **Step 2: Add typed optional review fields**

Add to the relevant editor type:

```ts
voiceReview?: {
  schemaVersion: number
  decision: 'PASS' | 'REPAIR'
  violations: Array<{ code: string; evidence: string; guidance: string }>
  summary: string
  rewriteGuidance: string
  contentHash: string
  personaModelVersion: string
  reviewedAt: number
}
voiceRepair?: {
  attempted: boolean
  originalContentHash?: string
}
```

- [ ] **Step 3: Add the minimal status UI**

Render a single compact row near the existing Persona/gates metadata:

```tsx
const voice = current?.voiceReview
const voiceLabel = voice?.decision === 'PASS'
  ? 'Pass'
  : voice?.decision === 'REPAIR'
    ? 'Repair needed'
    : 'Not reviewed'
```

Use an existing disclosure/details pattern for `summary` and violation guidance. Do not add a new dashboard card or large panel.

- [ ] **Step 4: Run UI tests and build**

```bash
cd ui && node --test tests/create-view.test.mjs && npm run build
```

Expected: PASS and successful build.

- [ ] **Step 5: Commit observability**

```bash
git add ui/src/api/client.ts ui/src/features/create/DraftEditor.tsx ui/tests/create-view.test.mjs
git commit -m "ui: show writer voice review status"
```

---

### Task 6: Regression verification, rollout safety, and documentation truth check

**Files:**
- Modify if needed after observed behavior: `docs/POST_GENERATION_PROMPT.md`
- Modify: `README.md` Phase 2 Content Quality paragraph
- Modify: `docs/CONTENT_OPERATING_STANDARD.md` writer/gate section
- No production-data mutation beyond ordinary draft review/generation; no X publication.

**Interfaces:**
- Consumes: completed Tasks 1-5.
- Produces: evidence that the known bad morphology is caught, terse/social and necessary technical depth still pass, delegated approval fails closed, and docs describe the actual runtime.

- [ ] **Step 1: Resolve any pre-existing `publishing` item before persona deployment**

Run:

```bash
npm run agent -- operator-status
npm run agent -- queue
```

If any item is already `publishing`, follow the existing exact public-verification/reconciliation protocol before proceeding. Do not reset, reapprove, or regenerate it merely to unblock this rollout.

- [ ] **Step 2: Run all focused tests**

```bash
node --test tests/writer_voice_fidelity.test.mjs
cd ui && node --test tests/create-view.test.mjs && npm run build
```

Expected: PASS.

- [ ] **Step 3: Verify active persona version and writer packet contents**

Run:

```bash
npm run agent -- persona-model
```

Expected: version `hamza-v1-alpha-2026-09-08`.

Then request a writer packet for an unpublished routed text item and verify it contains:

```text
persona.voiceCalibration
persona.languageRealization
behavior.personaModelVersion = hamza-v1-alpha-2026-09-08
```

- [ ] **Step 4: Run the known bad published wording through read-only voice review**

Use the existing historical draft whose text is:

```text
Universal clients attack the visible pain. Portable context attacks the switching cost.

Models and interfaces will change. Session memory and tool policy need to survive the move.

Context Mode looks like an early version of that layer—not the universal client itself. #AIAgents
```

Invoke `writer-voice-review` in read-only historical mode. Expected verdict: `REPAIR`, with at least one concrete violation among `INSTITUTIONAL_ANALYST_REGISTER`, `STRATEGY_MORPHOLOGY_OVERRIDE`, `UNNATURAL_PARALLELISM`, or `ABSTRACT_TAKEAWAY_AFTER_PAYOFF`.

The exact violation set is not a performance metric; the required property is that the known regression no longer silently receives a delegated-clean pass.

- [ ] **Step 5: Verify a terse social act and a necessary technical act are not flattened**

Review two fixtures without publishing:

```text
what?
```

with `informationDepth=social_only`, expected `PASS`.

And:

```text
62 is a nice headline, but I want the boring numbers too: speed and cost.

Muse 1.2 did ~154 tok/s at ~$0.40 per AA task. if 1.3 keeps that economics while adding 5 points, that’s much more interesting than the score alone.
```

with `informationDepth=compact_reason`, expected `PASS` unless the reviewer identifies a concrete current persona-rule violation. The reviewer must not fail merely because the second fixture is technical or multi-paragraph.

- [ ] **Step 6: Verify one-repair maximum and fail-closed delegated behavior**

With a test/fake runtime, force:

```text
initial review = REPAIR
repair review = REPAIR
```

Expected:

```text
one initial generation
one repair generation
exactly two voice reviews
no third generation
mission-agent approval rejects the draft
human approval path remains available after existing hard gates
```

- [ ] **Step 7: Verify persona bump invalidates stale delegated approvals without touching human approvals**

Run `operator-status`/queue inspection. Expected: old `mission_agent` approvals using `hamza-v1-alpha-2026-09-05` are reported stale/re-review-required by existing safeguards. Do not automatically reapprove them. Human approvals remain governed by their existing exact-content approval snapshots.

- [ ] **Step 8: Update the truthful architecture docs**

Document the final pipeline as:

```text
opportunity -> behavior -> optional writing strategy -> writer realization under persona -> voice review -> at most one voice repair -> deterministic factual/purpose/clarity gates -> human or delegated approval -> claim -> public verification -> reconciliation
```

Clarify:

```text
Voice review is model-judgment and therefore inspectable/advisory for humans, but it is mandatory for delegated automation. Deterministic gates remain the authority for factual provenance, purpose integrity, length, duplication, and other machine-checkable constraints.
```

- [ ] **Step 9: Review the full diff and run final smoke checks**

```bash
git diff --check
git status --short
node --test tests/writer_voice_fidelity.test.mjs
cd ui && node --test tests/create-view.test.mjs && npm run build
```

Expected: no whitespace errors, tests PASS, build PASS, only intended files modified.

- [ ] **Step 10: Commit rollout/docs**

```bash
git add README.md docs/CONTENT_OPERATING_STANDARD.md docs/POST_GENERATION_PROMPT.md
git commit -m "docs: define writer voice fidelity boundary"
```

---

## Self-Review

**Spec coverage:**
- Persona was already loaded but strategy could outrank realization: fixed in Task 1.
- Writer had descriptive persona rules but little concrete calibration: fixed with bounded observed/counterfactual calibration in Task 1.
- No final `sounds like Hamza` judgment existed: added as a narrow AI voice review in Task 2.
- Same model could loop until self-approval: prohibited; exactly one repair in Task 2/6.
- Automated replies/main-feed could proceed after deterministic gates alone: fail-closed voice requirement added in Tasks 3/4.
- Human authority must remain distinct from agent authority: preserved in Task 4.
- Exact text/persona binding required to prevent stale reviews: implemented by content hash + persona version in Task 2.
- Agent-operated external writer path needs a way to obtain review: `writer-voice-review` in Task 4.
- Operator needs visibility without another dense UI surface: compact status only in Task 5.
- Existing delegated approvals must become stale after persona bump, not silently inherit new voice: covered in Task 6.

**Placeholder scan:** no placeholder or deferred implementation markers remain.

**Type consistency:** `voiceReview.decision` is `PASS | REPAIR` everywhere; `contentHash` and `personaModelVersion` are the validity binding; `voiceRepair.attempted` is boolean; the same `writer` AI role is reused for generation/review/repair with distinct metadata consumers.
