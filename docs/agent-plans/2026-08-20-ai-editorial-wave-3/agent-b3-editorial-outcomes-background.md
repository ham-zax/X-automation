# Agent B3 — Editorial Outcome Provenance + Background Refresh

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable
**Workspace:** `/home/hamza/repo/x_test-w6-editorial-outcomes`
**Isolation reason:** concurrent Wave-3 work; this mission is the sole Wave-3 owner of `store.js` and `automation.js`
**Can start:** immediately from Wave-3 coordination base
**Depends on:** integrated Wave-2 Phase-6 persistence/backend
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md` — Tasks 15-16
- `docs/agent-plans/2026-08-20-ai-editorial-wave-3/README.md` — ownership/dependency map
- `docs/plans/PHASE_4_MEASUREMENT_EXPERIMENTS.md` and existing Phase-4 code — current measurement semantics
- `docs/plans/PHASE_5_LEARNED_STRATEGY.md` and existing learning code — current bounded learning authority

## Objective

Carry the selected editorial recommendation provenance into existing publication measurement/learning context without creating a new attribution or auto-learning authority, and add the optional advisory background Editorial Plan recomputation after the canonical source refresh cycle.

## Current state

Wave 2 persists `editorial_selections`, recommendation details, objective/Authority/ProfileProof/evidence/algorithm metadata, and `getLatestEditorialSelectionForQueueItem()`. Publication measurements and Phase-5 learned-strategy machinery already exist. `automation.js` now delegates source fetching to `refreshAllSourceSnapshots()` but does not automatically recompute an Editorial Plan.

## Ownership

You own:
- `store.js` changes needed to attach the editorial selection/recommendation context in force at publication to Phase-4 measurement metadata and expose bounded outcome summaries when data exists;
- `automation.js` optional post-refresh advisory plan recomputation with default-off configuration;
- `learning.js` only if the existing learning-context matcher cannot consume the new metadata without a small bounded change.

Neighboring Agent A3 owns:
- human recommendation selection/workflow routing;
- writer research-evidence integration;
- `editorial.js`, `pipeline.js`, `drafting.js`, `writer_runtime.js`, and web writer-generation changes.

Final-wave work owns:
- Today/Discover/Editorial APIs/UI;
- presentation of outcome summaries;
- final documentation.

## Coordination contract

Do not modify `web_api.js`, `editorial.js`, `pipeline.js`, `drafting.js`, `writer_runtime.js`, `agent_bridge.js`, React UI, or AI runtime/provider files. Consume persisted selections/recommendations defensively: absence of a selection means existing measurement behavior, not an error.

Do not reinterpret one post as causal proof. Keep existing Phase-4 attribution confidence/evidence states and Phase-5 human acceptance boundaries unchanged.

## Success conditions

- When a published queue item has an editorial selection in force, its measurement metadata can preserve selection ID, recommendation ID, editorial objective, story key, recommended pipeline, selected pipeline, final published pipeline, visible objective-fit/Authority/ProfileProof components, evidence state, and algorithm-mechanism tags.
- Human route override remains explicit: recommendation and selected/final pipeline are separate fields rather than rewritten history.
- Existing publications with no editorial selection continue to measure normally.
- Bounded outcome summaries can group available completed observations by editorial objective/recommended format/chosen format without inventing samples or causal claims.
- Existing Phase-5 suggestion logic can receive relevant editorial format/topic/objective context through its current evidence thresholds; no new automatic learned-rule path is introduced and suggested rules remain inert until human acceptance.
- Add one explicit configuration flag for automatic Editorial Plan recomputation after the canonical research/source refresh cycle, default `false`.
- When enabled, automation reuses the snapshots already refreshed by `refreshAllSourceSnapshots()` and invokes `refreshEditorialPlan({ objective: 'qualified_growth', refreshSources: false })`; it does not fetch sources again, select work, approve, publish, or send anything.
- Editorial-plan recomputation failure is isolated from the normal source research cycle and leaves existing queue/editorial state intact; logging is limited to useful plan/recommendation status.

## Required validation

No tests. Use only minimal non-test syntax/direct temporary-state checks needed to establish metadata preservation, existing no-selection compatibility, and default-off/no-selection background behavior. No live X writes or provider/model calls.

## Out of scope

- recommendation selection implementation;
- writer context/gates;
- general editorial web/agent APIs or React surfaces;
- altering Phase-4 attribution semantics or Phase-5 evidence thresholds;
- automatic learned-rule acceptance;
- final documentation.

## Working style

Use @Causal Coding before mutation. Reuse the existing measurement and learning owners; do not build a second analytics path. Keep editorial provenance as additional inspectable context, not a new causal score. Do not create, modify, or run tests.

## Finish report

Return:
1. status: complete / blocked / needs decision;
2. workspace/branch and commit hash;
3. exact measurement metadata/provenance fields added and where they are attached;
4. any outcome-summary or learning-context interface added;
5. background refresh configuration/behavior;
6. non-test validation actually run;
7. anything the final API/UI session must know;
8. unresolved risks/deviations.
