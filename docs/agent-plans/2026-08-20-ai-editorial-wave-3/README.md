# AI Runtime + Editorial Director Wave 3 — Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Source of truth:** `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md` and `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md`
**Coordination base:** `e1ccb49` plus integrated AI Settings `5306dde` and Wave-2 status `5edc5f1`
**Execution shape:** parallel domain/workflow integration + outcome-loop integration, then main integration
**Current wave:** 3

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A3 — Editorial Selection + Writer Evidence | executable | complete + integrated | completed | `/home/hamza/repo/x_test-w6-editorial-selection` | isolated workflow/writer/web generation ownership | none |
| Agent B3 — Editorial Outcome Provenance + Background Refresh | executable | complete + integrated | completed | `/home/hamza/repo/x_test-w6-editorial-outcomes` | isolated store measurement + automation ownership | none |

## Dependency map

```text
Wave 2 integrated
source snapshots + evidence + persisted Editorial Plan
                 |
          /-------------\
          v             v
       Agent A3        Agent B3
 selection/workflow    measurement provenance
 + writer evidence     + optional plan refresh
          \             /
           \           /
             main integration
                    |
                    v
       Final product-surface wave
 Editorial API + Today + Discover + bridge + docs
```

## Shared contracts

- `store.js` Phase-6 persistence from B2 is authoritative. Agent A3 consumes its editorial/research/selection helpers and must not modify `store.js`.
- Agent B3 is the only Wave-3 writer to `store.js`; its changes are limited to publication-measurement/editorial outcome metadata required by Phase 6.
- Agent A3 owns `editorial.js`, `pipeline.js`, `drafting.js`, `writer_runtime.js`, and `web_api.js` only for explicit recommendation selection and writer-evidence integration. It must not add the final Today/Discover editorial UI/API surface.
- Agent B3 owns `automation.js` and may modify `learning.js` only if the existing matcher cannot consume new editorial metadata without a small bounded change. It must not modify `web_api.js` or workflow/writer files.
- Human selection is not approval. Selecting a recommendation may create/reuse normal work, but must not approve, schedule, publish, send a reply, complete a repost, or accept a learned rule.
- Writer evidence must resolve to persisted `research_evidence` IDs and claim scope; free-form words such as `verified` are not proof.
- `refreshEditorialPlan()` remains advisory. Background refresh may recompute a plan only when explicitly configured and must never select a recommendation.
- No tests are authorized by the source plans.

## Workspace policy

Both missions are concurrent writable missions with disjoint file ownership. Use only the assigned worktrees. Main is reserved for integration. If a mission discovers it needs the other mission's owned file, report the boundary conflict instead of crossing it silently.

## Integration policy

Agent A3 is integrated on main as `1b93542`. Agent B3 is integrated on main as `ce1b062`. Wave 3 is complete; the final operator-facing Editorial surface and remaining optional runtime work may now proceed from the integrated main state.

## Validation policy

No test creation, modification, or execution. Use only bounded non-test syntax/build/direct behavior checks needed to establish the mission and inspect the final diff once.

## Future / blocked work

- Editorial web/agent read-refresh-select-dismiss/add-source entry points plus Today/Discover UI — blocked until A3 selection/writer semantics are integrated.
- Final current-state docs — blocked until the operator-visible Phase-6 workflow is landed.
- AI Runtime provider-layer final documentation — joins the final current-state documentation wave.
- Optional AGY/OpenCode/OpenCode 2 full execution remains outside the Phase-6 critical path.

## Status log

- `2026-08-20` — Wave 1 runtime + deterministic editorial core integrated.
- `2026-08-20` — Wave 2 AI Settings and Phase-6 persisted backend integrated; combined non-test checks passed.
- `2026-08-20` — Wave 3 materialized as two non-overlapping missions.
- `2026-08-20` — Agent A3 selection/writer-evidence work integrated as `1b93542`; Agent B3 outcome/background-refresh work integrated as `ce1b062`; combined non-test checks passed. Wave 3 complete.
