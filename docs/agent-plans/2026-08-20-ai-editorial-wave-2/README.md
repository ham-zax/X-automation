# AI Runtime + Editorial Director Wave 2 — Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Source of truth:** `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md` and `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md`
**Coordination base:** `32c7575` (Wave-1 integrated main: shared AI runtime core + deterministic editorial core)
**Execution shape:** parallel: AI configuration/product surface and Phase-6 backend orchestration, then main integration
**Current wave:** 2

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A2 — AI Settings + Configuration Surface | executable/UI | complete + integrated | completed | `/home/hamza/repo/x_test-w6-ai-settings` | isolated web/API/UI ownership | none |
| Agent B2 — Phase-6 Backend Critical Path | executable | complete + integrated | completed | `/home/hamza/repo/x_test-w6-editorial-backend` | isolated backend persistence/orchestration ownership | none |

## Dependency map

```text
32c7575 integrated Wave 1
      /                    \
     v                      v
Agent A2                  Agent B2
AI Settings/API           source truth + editorial persistence
   integrated             + research + editorial runtime/plan
      |                         |
   5306dde                     v
      \                    /
       \                  /
         Main integration
                |
                +--> human selection + writer evidence
                +--> Phase-6 web/agent API + Today/Discover UI
                +--> measurement/learning provenance
                +--> optional refresh + final docs
```

## Shared contracts

- `runStructuredAI()` from `ai_runtime.js` is authoritative for structured semantic AI execution.
- Agent A2 consumes store/runtime/secret helpers but does not modify `store.js`, `ai_runtime.js`, adapters, or Phase-6 editorial domain files.
- Agent B2 owns `store.js` for Wave 2 and may extend it only for Phase-6 source/editorial/research persistence and strict published-main-feed reads.
- Agent B2 must not modify `web_api.js`, `agent_bridge.js`, React UI, `drafting.js`, `writer_runtime.js`, `pipeline.js`, measurement/learning code, or AI Settings files.
- Agent A2 owns `web_api.js` and `agent_bridge.js` only for AI configuration/runtime endpoints/commands, plus the dedicated AI Settings React surface.
- `continuous_scan` remains configuration-only and must be shown as **Not active** until a real background consumer is implemented.
- Phase-6 numeric ranking/order remains code-owned. AI cannot reorder final recommendations or bypass evidence/workflow authority.

## Workspace policy

Both missions are concurrent writable missions with distinct ownership. Use only the assigned worktrees. Main is reserved for integration.

If correctness requires crossing the ownership boundary, report the conflict instead of silently editing the neighboring mission's files.

## Integration policy

Agent A2 is integrated on main as `5306dde`. Agent B2 is integrated on main as `e1ccb49`. Wave 2 is complete; downstream workflow selection/writer evidence and outcome-provenance work may now begin from the integrated main state.

## Execution lifetime policy

Both Wave-2 missions are ordinary coding sessions. No persistent wait loop is required unless an actual external wait condition appears.

## Validation policy

No tests are authorized. Do not create, modify, or run tests. Use only the minimum non-test checks needed to establish the requested behavior and inspect the final diff once.

## Future / blocked work

- Human selection into workflow + append-only provenance — blocked on Agent B2 editorial persistence/plan orchestration.
- Research-evidence IDs into the writer — blocked on Agent B2 persisted evidence + selection provenance.
- Editorial web/agent APIs and Today/Discover UI — blocked on Agent B2 backend contract and Wave-2 integration.
- Phase-4/5 outcome provenance — blocked on selected recommendation linkage.
- Optional background editorial refresh wiring/final current-state docs — blocked on complete editorial workflow.
- AGY/OpenCode/OpenCode 2 full execution adapters remain optional and off the Phase-6 critical path.

## Status log

- `2026-08-20` — Wave 1 integrated on main: `1203be4` AI runtime core and `32c7575` deterministic editorial core.
- `2026-08-20` — Wave 1 integration syntax/diff checks passed; Wave 2 materialized.
- `2026-08-20` — Agent A2 AI Settings/configuration surface integrated on main as `5306dde`; integrated syntax and React production build passed.
- `2026-08-20` — Agent B2 Phase-6 backend critical path integrated on main as `e1ccb49`; combined backend/runtime syntax and diff checks passed. Wave 2 complete.
