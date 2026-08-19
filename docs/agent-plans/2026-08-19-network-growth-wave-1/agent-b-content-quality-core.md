# Agent B — Content Quality Core

**Repository:** `/home/hamza/repo/x_test`  
**Artifact type:** executable  
**Workspace:** `/home/hamza/repo/x_test-w1-content` on branch `agent/w1-content-quality-core`  
**Isolation reason:** concurrent writable mission; this branch owns only the pure `drafting.js` content core while Agent A owns shared persistence/UI/bridge surfaces  
**Can start:** immediately after assigned worktree exists  
**Depends on:** Phase 1A commit `7ccdb7c` and the coordination package  
**Execution lifetime:** Persistent Agent Loop required  
**Wake strategy:** no artificial timer; use event waits only if a real persistent process/external condition blocks progress  
**Developer visibility:** headless by default; passive presentation only on request

## Read first

- `docs/plans/PHASE_2_CONTENT_QUALITY.md` — authoritative Phase-2 content contracts.
- `docs/POST_GENERATION_PROMPT.md` — canonical writing/editor contract.
- `docs/agent-plans/2026-08-19-network-growth-wave-1/README.md` — coordination boundaries and neighboring ownership.
- `AGENTS.md` — repository invariants and current Phase 1A workflow.
- `drafting.js` — current content owner that this mission extends.

Before the first source mutation, load and follow **Causal Coding**. Use **Persistent Agent Loop** for execution lifetime. Do not create or run tests unless the repository itself independently mandates them; the current phase plan does not authorize tests.

## Objective

Implement the isolated Phase-2 content-quality core in `drafting.js` without touching persistence, workflow approval, dashboard, or agent-bridge integration. The resulting module should understand Original/Quote/Reply/Thread formats, build the canonical writer packet, accept allow-listed structured writer output, and evaluate deterministic hard gates while preserving current default Original behavior for existing callers.

This mission intentionally stops before Phase-2 storage/UI/bridge integration so it can run safely in parallel with Relationship Intelligence.

## Current state

Phase 1A is implemented. `pipeline.js` owns workflow/human approval, `opportunity.js` owns current candidate scoring, and the existing `drafting.js` owns Hook/Insight/Evidence/Action composition plus the 50-point rubric.

The neighboring relationship agent concurrently owns `store.js`, `audience.js`, `dashboard.js`, `agent_bridge.js`, relationship persistence, and relationship docs. Treat all of those as externally owned for this wave.

## Ownership

You own only the content-core behavior in `drafting.js`:

- format-aware `createDraftScaffold(candidate, { pipeline = 'original' })`;
- format-aware `composeDraft(draft, { pipeline = 'original' })` while preserving existing default callers;
- existing `weightedPostLength` as the single weighted-length owner;
- pure `buildWriterPacket(...)` from the documented contract;
- pure/allow-listed `applyWriterOutput(draft, writerOutput)`;
- deterministic `evaluateDraftGates(...)` using the documented gate rules;
- `scoreDraft(...)` integration so numeric score remains separate and publishability can consume gate results/context without breaking legacy default callers;
- focused non-test verification of the pure content contracts.

If a tiny private helper inside `drafting.js` is sufficient, keep it there. Do not introduce a new module/dependency merely for organization.

Neighboring mission owns all persistence/UI/bridge work.

## Coordination contract

Hard boundaries for this wave:

- **Do not modify** `store.js`, `pipeline.js`, `dashboard.js`, `agent_bridge.js`, `audience.js`, `relationship.js`, `README.md`, `AGENTS.md`, or relationship/agent-workflow docs.
- Do not add draft schema fields or persist editor/gate/thread data yet. Return plain JS objects compatible with the Phase-2 plan; persistence is a later integration mission.
- Do not wire the new gates into `approveQueueItem()` yet. `pipeline.js` remains untouched in this branch.
- Preserve existing default Original behavior for current Phase-1 callers that invoke `createDraftScaffold(candidate)`, `composeDraft(draft)`, and `scoreDraft(draft, candidate)` without new context.
- Do not call an LLM or add an LLM SDK. `buildWriterPacket()` only prepares inspectable context.
- Do not invent relationship/health data. Accept optional context fields and preserve missing information as missing/empty according to the plan.
- Do not implement media upload. Gate logic may represent media-plan readiness exactly as specified, but transport belongs to Phase 3.

If the authoritative Phase-2 plan proves internally inconsistent with current Phase-1 compatibility, prefer the smallest backward-compatible interpretation and report the discrepancy rather than expanding into neighboring files.

## Success conditions

- Original/Quote/Reply/Thread scaffolds reflect their actual format and legacy callers still receive Original-compatible behavior by default.
- Thread composition uses explicit `threadParts`; single formats continue to produce one body.
- `buildWriterPacket()` returns the documented inspectable account/candidate/queue/evidence/recent/profile-proof/constraints context without secrets or chain-of-thought.
- `applyWriterOutput()` accepts only documented decision/pipeline/media enums and allow-listed fields, preserves structured editor metadata in the returned draft object, and does not authorize workflow state.
- `evaluateDraftGates()` produces stable machine-readable failures/warnings/checks for factuality, evidence when required, niche, additive value, source/recent duplication, scannability, placeholders, weighted length, CTA integrity, hashtags, emoji, first-person evidence, thread rules, and media readiness as specified by the Phase-2 plan.
- Exact/near-duplicate text at the documented threshold can hard-fail; repeated reply archetype/style by itself remains warning-level rather than a ban.
- `scoreDraft()` preserves the current 50-point rubric and remains callable by existing Phase-1 code; gate-aware publishability is additive/contextual rather than a breaking API rewrite.
- No persistence, dashboard, bridge, workflow, scheduler, or X transport files are changed.

## Verification intent

Use direct pure-function/runtime evidence capable of disproving the contracts above:

- parse/syntax check changed JS;
- exercise representative Original/Quote/Reply/Thread inputs with short temporary Node invocations;
- confirm legacy default calls still return valid current-style draft/scoring results;
- confirm hard-gate failures do not become publishable merely because numeric quality is high;
- confirm duplicate/bait/factuality/length/thread/media cases produce the documented failure/warning shape;
- inspect the final diff to ensure only `drafting.js` (or an unavoidable tiny pure helper explicitly reported) changed and `git diff --check` is clean.

Do not create a test framework/file or run a broad suite merely for confidence.

## Out of scope

- draft schema migrations (`thread_parts_json`, `editor_json`, `gate_json`);
- `writer-packet` / `apply-writer-output` bridge commands;
- dashboard editing/review UI;
- wiring gates into `pipeline.js` approval;
- media-plan persistence/upload;
- relationship intelligence / Engage Next / Account Health;
- scheduler, publisher, measurement, experiments, learning;
- documentation synchronization beyond reporting what the integration session must update.

## Working style

Explore `drafting.js` and the canonical Phase-2 prompt/plan before editing. Follow Causal Coding: preserve the true owner, reuse the existing token/Jaccard and weighted-length primitives, use standard JavaScript facilities, avoid speculative abstractions, and stop when the isolated content-core outcome is proven.

Persistent-loop steering rule: status/progress requests or compatible side context do not terminate the mission. Continue until success conditions are freshly verified, the user explicitly stops/replaces the mission, or continuation becomes impossible/unsafe after checkpointing recoverable state.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commits created;
3. concise summary of the new `drafting.js` public behavior and compatibility guarantees;
4. checks actually run, results, and why they were relevant;
5. anything the later Phase-2 integration session must wire into store/bridge/dashboard/pipeline;
6. unresolved risks, deviations, or decisions needed;
7. explicit confirmation that shared persistence/UI/bridge/workflow files were not modified.
