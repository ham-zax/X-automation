# Remove Ethics Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove invented-claim and mass-autonomous-engagement prohibitions and runtime enforcement while preserving unrelated workflow, data integrity, deduplication, budgets, provenance, and transport-failure handling.

**Architecture:** Delete the restrictions at their owning seams instead of adding bypass flags: content gates in `drafting.js`, writer constraints in the AI prompt runtimes, autonomous authority checks in `autonomous_reply.js`/`store.js`/`pipeline.js`, and their UI/API projections. Restore the unrelated repository instructions, remove the obsolete policy document and references, and update current and historical documentation to match executable behavior.

**Tech Stack:** Node.js ESM, built-in `node:sqlite`, React/TypeScript, Vite, Markdown documentation.

**Spec:** `docs/superpowers/specs/2026-08-31-remove-ethics-enforcement-design.md`

## Global Constraints

- Execute inline in the current session; do not dispatch subagents.
- Do not edit, revert, stage, or commit the existing unrelated `x_browser.js` working-tree change.
- Restore unrelated `AGENTS.md` content; remove only the two approved policy families and dependent descriptions.
- Keep explicit human Start/Pause/Stop, Live budget, deduplication, target validation, account-health constraints, atomic claims, grant revisions, exact-text provenance, and unknown-send reconciliation.
- Keep raw analytics ingestion and persistence faithful to observed values and missing values.
- Do not add dependencies, a feature flag, a compatibility abstraction, or a parallel policy mode.
- Existing stored grant JSON may retain obsolete `xApprovalReference` and `optOutMechanism` keys; new reads and writes ignore them.

---

### Task 1: Remove factuality and evidence claim gates

**Files:**
- Modify: `drafting.js`
- Modify: `writer_runtime.js`
- Modify: `writing_strategy.js`
- Modify: `agent_bridge.js`
- Modify: `pipeline.js`
- Modify: `web_api.js`
- Modify: `autonomous_main_feed.js`
- Modify: `ui/src/api/client.ts`
- Modify: `ui/src/components/primitives.tsx`
- Modify: `ui/src/features/create/DraftEditor.tsx`
- Modify: `ui/src/features/create/DraftPage.tsx`
- Modify: `ui/src/features/create/Create.tsx`
- Modify: `ui/src/features/conversations/ConversationDetail.tsx`

**Interfaces:**
- Consumes: existing `evaluateDraftGates(draft, candidate, context)` and `scoreDraft(...)` results.
- Produces: gate results with no factuality/evidence confirmation failures or human-confirmation projection; approval/review actions no longer consume confirmation booleans.

- [ ] **Step 1: Run the current content-gate probe and verify the target failures exist**

```bash
node --input-type=module <<'NODE'
import { evaluateDraftGates } from './drafting.js';
const result = evaluateDraftGates(
  { body: 'We benchmarked this at 9.7x faster with 3ms latency.', editor: { pipeline: 'original', evidenceUsed: ['made-up'] } },
  { key: 'probe', text: 'A tool announcement', title: 'Probe', niche: { score: 100, tags: ['devtools'], matches: ['devtools'] } },
  { pipeline: 'original', factualityConfirmed: false, evidenceConfirmed: false, evidence: [] },
);
const codes = result.failures.map(({ code }) => code);
if (!codes.includes('FACTUALITY_UNCONFIRMED') || !codes.includes('EVIDENCE_UNCONFIRMED')) throw new Error(JSON.stringify(codes));
console.log(codes.filter((code) => /FACTUALITY|EVIDENCE|FIRST_PERSON/.test(code)).join('\n'));
NODE
```

Expected: prints `FACTUALITY_UNCONFIRMED`, `EVIDENCE_UNCONFIRMED`, and evidence-reference failures.

- [ ] **Step 2: Delete the content gate owners and dead helpers**

In `drafting.js`:

```js
export function evaluateDraftGates(draft, candidate, {
  pipeline: requestedPipeline,
  recentPosts = [],
  recentReplies = [],
  recentReplyArchetypes = [],
  replyArchetype = '',
  mediaReady = false,
  relevanceOverride = null,
  conversationRelevanceCandidate = null,
  growthObjective = null,
  threadLengthApproved = false,
} = {}) {
```

Remove `factualityConfirmed`, `evidenceConfirmed`, and `evidence` from the gate context; remove the related check keys and all failures from `FACTUALITY_UNCONFIRMED` through `FIRST_PERSON_EVIDENCE_UNVERIFIED`. Delete helpers used only by that block: `claimNeedsEvidence`, `firstPersonEvidenceClaim`, evidence-reference resolution/eligibility helpers, and sensitive-claim scope matching helpers.

In `writer_runtime.js`, delete `validateEvidenceReferences`, remove the two prompt lines forbidding invented facts/evidence IDs, and stop validating `result.output.evidenceUsed` against the packet.

In `writing_strategy.js` and `agent_bridge.js`, delete prompt instructions that require verified numbers or prohibit invented measurements/evidence. Preserve deterministic option construction and general structured-output validation.

- [ ] **Step 3: Remove confirmation plumbing and obsolete mission gate handling**

In `pipeline.js`, make `contentGateContext(candidateKey, pipeline)` independent of confirmations and remove factuality/evidence values from all `scoreDraft` calls. Approval still requires the remaining score, growth-packaging, and gate checks. Keep mission source/selection authority and queue snapshot provenance.

In `web_api.js`, remove factuality/evidence confirmation request mapping, response checks, `humanCodes`, and `humanConfirmations`; `gatesView` should contain only `passed`, `approvalFailures`, and `warnings`.

In `autonomous_main_feed.js`, remove obsolete factuality/evidence confirmation gate codes and evidence-claim repair routing while retaining formatting repair such as `THREAD_PART_TOO_LONG`.

In `agent_bridge.js`, stop accepting/passing `factualityConfirmed` and `evidenceConfirmed` for draft/review actions.

- [ ] **Step 4: Remove confirmation UI and types**

Delete `ConfirmCheckboxes` from `ui/src/components/primitives.tsx`. Remove confirmation state, evidence-required derivation, checkbox rendering, request payload fields, and confirmation-dependent button disabling from `DraftPage.tsx`, `Create.tsx`, and `ConversationDetail.tsx`.

Change gate-view types in `ui/src/api/client.ts` and `DraftEditor.tsx` to:

```ts
{
  passed: boolean
  approvalFailures: { code: string; message: string }[]
  warnings: { code: string; message: string }[]
}
```

Update `GatePanel` to render only approval failures and warnings.

- [ ] **Step 5: Re-run the gate probe**

Run the Step 1 probe with the final assertion changed to:

```js
if (codes.some((code) => /FACTUALITY|EVIDENCE|FIRST_PERSON/.test(code))) throw new Error(JSON.stringify(codes));
```

Expected: exits 0 and prints no target gate codes.

- [ ] **Step 6: Commit the content-gate removal without touching unrelated staged work**

```bash
git commit --only drafting.js writer_runtime.js writing_strategy.js agent_bridge.js pipeline.js web_api.js autonomous_main_feed.js ui/src/api/client.ts ui/src/components/primitives.tsx ui/src/features/create/DraftEditor.tsx ui/src/features/create/DraftPage.tsx ui/src/features/create/Create.tsx ui/src/features/conversations/ConversationDetail.tsx -m "Remove factuality and evidence claim gates"
```

### Task 2: Remove Live autonomous engagement policy authority

**Files:**
- Modify: `autonomous_reply.js`
- Modify: `store.js`
- Modify: `pipeline.js`
- Modify: `ui/src/api/client.ts`
- Modify: `ui/src/features/settings/AutonomousRepliesSettings.tsx`

**Interfaces:**
- Consumes: persisted autonomous grant state and `claimAutonomousReplyDecision(id, { grantRevision, now })`.
- Produces: Live grants start with a positive budget alone; eligible generated replies can claim and send without consent, approval, opt-out, or transport-policy fields.

- [ ] **Step 1: Run the current Live-start probe and verify it is blocked**

```bash
node --input-type=module <<'NODE'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'x-test-live-probe-')));
const replies = await import(`${pathToFileURL(path.join(root, 'autonomous_reply.js')).href}?probe=${Date.now()}`);
replies.configureAutonomousReplyGrant({ mode: 'live', liveBudget: 1 });
try {
  replies.startAutonomousReplies();
  throw new Error('Expected current Live Start to be blocked');
} catch (error) {
  if (!/official X API/.test(error.message)) throw error;
  console.log(error.message);
}
NODE
```

Expected: prints the official-X-API transport block.

- [ ] **Step 2: Delete grant and evaluation policy fields/checks**

In `autonomous_reply.js`:

- delete `AUTONOMOUS_REPLY_WRITE_TRANSPORT` and `AUTONOMOUS_REPLY_LIVE_TRANSPORT_READY`;
- delete `xApprovalReference` and `optOutMechanism` from defaults and configuration writes;
- retain the positive Live budget check but delete transport, X-approval, and opt-out checks from Start;
- delete `recipientOptedIn`, the opt-out-text skip, `livePolicy`, and policy projection in evaluation;
- delete the generated-reply prohibition on invented evidence and autonomous evidence/security review logic;
- remove policy checks from `currentLiveAuthority` while preserving grant, health, duplicate, and claim-state checks;
- return a read model with `liveStartReady: Number(grant.liveBudget || 0) > 0` and no `policy` object.

In `store.js`, make `claimAutonomousReplyDecision` require non-empty exact text, current Live grant/revision, and remaining budget, but not `decision.checks.policy`, X approval, or an opt-out mechanism.

In `pipeline.js`, remove the send-time `decision.checks.policy.allowed` requirement while preserving exact candidate/text/decision/grant matching.

- [ ] **Step 3: Remove obsolete settings fields and policy UI**

In `ui/src/api/client.ts`, delete `xApprovalReference`, `optOutMechanism`, and the entire autonomous `policy` response type.

In `AutonomousRepliesSettings.tsx`, remove the two field states and inputs, the policy warning panel, transport-blocked labels, Start-button transport disabling, and the Live-blocked alert. Keep mode, cadence, sources, intents, tones, humor, budget, Start/Pause/Stop, decisions, and outcomes.

- [ ] **Step 4: Re-run the Live-start probe with success assertions**

Replace the `try/catch` block in Step 1 with:

```js
const grant = replies.startAutonomousReplies();
if (grant.state !== 'running' || grant.mode !== 'live') throw new Error(JSON.stringify(grant));
const view = replies.getAutonomousReplyReadModel();
if (view.policy !== undefined || view.grant.liveStartReady !== true) throw new Error(JSON.stringify(view));
console.log(`${grant.state}:${grant.mode}:${view.grant.liveStartReady}`);
```

Expected: `running:live:true`.

- [ ] **Step 5: Commit autonomous policy removal explicitly**

```bash
git commit --only autonomous_reply.js store.js pipeline.js ui/src/api/client.ts ui/src/features/settings/AutonomousRepliesSettings.tsx -m "Remove autonomous engagement policy gates"
```

### Task 3: Restore repository instructions without the removed policies

**Files:**
- Modify: `AGENTS.md`
- Delete: `docs/ENGAGEMENT_INTEGRITY.md`
- Modify: `README.md`
- Modify: `docs/AGENT_WORKFLOW.md`
- Modify: `docs/ALGORITHM_EVIDENCE_LEDGER.md`
- Modify: `docs/CONTENT_OPERATING_STANDARD.md`
- Modify: `docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`
- Modify: `docs/GROWTH_OS_MOMENTUM_OPERATOR.md`
- Modify: `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`
- Modify: `docs/LIVE_PUBLISHING_SESSION_2026-08-21.md`
- Modify: `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`
- Modify: `docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md`
- Modify: `docs/POST_GENERATION_PROMPT.md`
- Modify: `docs/PRODUCT_ARCHITECTURE.md`
- Modify: `docs/RELATIONSHIP_INTELLIGENCE.md`
- Modify: `docs/X_GROWTH_ISSUES.md`

**Interfaces:**
- Consumes: `AGENTS.md` content from commit `6cedc3d` and the behavior delivered by Tasks 1–2.
- Produces: current operational documentation that describes the unrestricted claim and autonomous-reply paths without removing unrelated repository workflow.

- [ ] **Step 1: Restore `AGENTS.md` from `6cedc3d` using `apply_patch` and remove only targeted statements**

Keep repository identity, commands, state ownership, queue/approval mechanics, analytics handling, phases, and coding guidance. Remove:

- factuality/evidence confirmation requirements;
- invented metric/benchmark/evidence prohibitions;
- anti-mass-engagement prohibitions;
- recipient consent/opt-out/X approval/official-API-only requirements;
- directives to preserve `ENGAGEMENT_INTEGRITY.md`.

Do not restore the original file wholesale with checkout/reset because the current deletion is user-owned working-tree state being intentionally transformed.

- [ ] **Step 2: Delete the dedicated ethics policy and remove all links to it**

Delete `docs/ENGAGEMENT_INTEGRITY.md`. Remove or rewrite its references in `README.md`, `AGENTS.md`, `docs/ALGORITHM_EVIDENCE_LEDGER.md`, `docs/CONTENT_OPERATING_STANDARD.md`, `docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`, and `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`.

- [ ] **Step 3: Update current workflow, prompt, and architecture documentation**

Remove the targeted prohibitions and obsolete confirmation/consent/transport descriptions from every remaining file listed in this task. Keep documentation for budgets, duplicate protection, explicit grant control, queue ownership, analytics, and failure reconciliation.

Update examples that currently send `factualityConfirmed` or `evidenceConfirmed` so request payloads omit those fields.

- [ ] **Step 4: Verify current documentation references executable behavior**

```bash
rg -n 'ENGAGEMENT_INTEGRITY|factualityConfirmed|evidenceConfirmed|recipient opt.?in|recipient opt.?out|written AI.?reply approval|official X API write|mass unsolicited|automated likes|follow churn|never invent|do not invent' AGENTS.md README.md docs -g '!docs/agent-plans/**' -g '!docs/plans/**' -g '!docs/superpowers/**'
```

Expected: no target-policy matches. Any match must be inspected and retained only when it concerns unrelated internal data correctness rather than public-claim or engagement restrictions.

- [ ] **Step 5: Commit current documentation explicitly**

```bash
git commit --only AGENTS.md README.md docs/AGENT_WORKFLOW.md docs/ALGORITHM_EVIDENCE_LEDGER.md docs/CONTENT_OPERATING_STANDARD.md docs/ENGAGEMENT_INTEGRITY.md docs/GROWTH_DISTRIBUTION_PLAYBOOK.md docs/GROWTH_OS_MOMENTUM_OPERATOR.md docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md docs/LIVE_PUBLISHING_SESSION_2026-08-21.md docs/NETWORK_GROWTH_OPERATING_SYSTEM.md docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md docs/POST_GENERATION_PROMPT.md docs/PRODUCT_ARCHITECTURE.md docs/RELATIONSHIP_INTELLIGENCE.md docs/X_GROWTH_ISSUES.md -m "Remove ethics policy documentation"
```

### Task 4: Remove obsolete policy language from plans and UX records

**Files:**
- Modify: `docs/plans/PHASE_2_CONTENT_QUALITY.md`
- Modify: `docs/plans/GROWTH_FOCUS_LEARN_WRITER_LOOP.md`
- Modify: `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md`
- Modify: `docs/plans/UX_REDESIGN_PROGRAM.md`
- Modify: relevant `docs/agent-plans/**` files returned by the target-policy search
- Modify: relevant `docs/ux/**` files returned by the target-policy search

**Interfaces:**
- Consumes: current behavior and terminology from Tasks 1–3.
- Produces: historical and planning records without instructions or acceptance criteria that reinstate removed policy.

- [ ] **Step 1: Remove targeted acceptance criteria and planned gates**

Delete or rewrite plan statements that require factuality/evidence confirmation, prohibit invented metrics/benchmarks/evidence, prohibit automated likes/follows/batch replies, or require consent/X approval/official-API transport for autonomous replies. Preserve unrelated plan history, ownership, and completed implementation notes.

- [ ] **Step 2: Run the full documentation policy search**

```bash
rg -n -i --hidden -g '!.git/**' -g '!node_modules/**' -g '*.md' '(never invent|do not invent|fabricat(ed|e|ing)?.{0,80}(metric|benchmark|evidence|result|experience)|unsupported (benchmark|metric|evidence|claim)|automated likes|follow churn|mass[- ]?(unsolicited )?(replies|engagement)|unsolicited automated|bulk engagement|batch unsolicited|recipient opt[- ]?in|recipient opt[- ]?out|written AI[- ]reply approval|official X API write)'
```

Expected: no matches belonging to the approved public-claim or mass-engagement policy families. Leave unrelated statements about fabricated usability participants, usernames, randomization, internal state, or stored analytics only when they do not recreate the removed enforcement.

- [ ] **Step 3: Commit the plan/history cleanup with explicit paths only**

Use `git diff --name-only -- docs/plans docs/agent-plans docs/ux` to review the exact set, then pass those reviewed paths explicitly to `git commit --only ... -m "Align plans with removed ethics gates"`. Do not include `x_browser.js`.

### Task 5: Verify the end-to-end deletion

**Files:**
- Verify: all files changed by Tasks 1–4
- Preserve: `x_browser.js`

**Interfaces:**
- Consumes: final source and documentation tree.
- Produces: verification evidence that no targeted policy owner, consumer, UI field, or stale document remains.

- [ ] **Step 1: Search source for removed symbols and reason codes**

```bash
rg -n 'FACTUALITY_UNCONFIRMED|EVIDENCE_UNCONFIRMED|EVIDENCE_REFERENCE_|EVIDENCE_CLAIM_SCOPE_MISMATCH|FIRST_PERSON_EVIDENCE_UNVERIFIED|POLICY_AUTHORITY_REQUIRED|RECIPIENT_OPTED_OUT|xApprovalReference|optOutMechanism|recipientOptInRequired|aiReplyApprovalRequired|officialApiWriteRequired|liveTransportReady|AUTONOMOUS_REPLY_LIVE_TRANSPORT_READY|AUTONOMOUS_REPLY_WRITE_TRANSPORT|ConfirmCheckboxes' --glob '*.{js,ts,tsx,md}' .
```

Expected: no matches, except the approved design/implementation records when they describe removed symbols historically.

- [ ] **Step 2: Run syntax checks on changed JavaScript modules**

```bash
node --check drafting.js
node --check writer_runtime.js
node --check writing_strategy.js
node --check agent_bridge.js
node --check pipeline.js
node --check web_api.js
node --check autonomous_main_feed.js
node --check autonomous_reply.js
node --check store.js
```

Expected: every command exits 0.

- [ ] **Step 3: Build the UI**

```bash
npm run ui:build
```

Expected: Vite/TypeScript and Tailwind builds complete successfully.

- [ ] **Step 4: Re-run both behavioral probes**

Run the post-change gate probe from Task 1 Step 5 and Live-start probe from Task 2 Step 4.

Expected: unsupported claim codes are absent; Live Start succeeds with only an explicit positive budget.

- [ ] **Step 5: Inspect repository safety and final diff**

```bash
git status --short
git diff --stat HEAD~4..HEAD
git diff HEAD~4..HEAD -- . ':(exclude)x_browser.js'
git diff -- x_browser.js
```

Expected: implementation commits contain only approved files; the pre-existing `x_browser.js` diff is unchanged from before implementation.

- [ ] **Step 6: Report completion**

Report source behavior removed, documentation deleted/updated, verification commands and outcomes, commit IDs, and that deleted tracked policy content remains recoverable through Git history.
