# AI Runtime + Editorial Director Wave 2 — Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Source of truth:** `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md` and `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md`
**Coordination base:** `32c7575` (Wave-1 integrated main: shared AI runtime core + deterministic editorial core)
**Execution shape:** parallel: AI configuration/product surface and Phase-6 backend orchestration, then main integration
**Current wave:** 2

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A2 — AI Settings + Configuration Surface | executable/UI | ready | now | `/home/hamza/repo/x_test-w6-ai-settings` | concurrent writes to web/API/UI while Agent B2 owns backend persistence/orchestration | none |
| Agent B2 — Phase-6 Backend Critical Path | executable | ready | now | `/home/hamza/repo/x_test-w6-editorial-backend` | concurrent backend work; Agent B2 owns store/source/editorial orchestration and stays off web/API/UI | none |

## Dependency map

```text
32c7575 integrated Wave 1
      /                    \
     v                      v
Agent A2                  Agent B2
AI Settings/API           source truth + editorial persistence
                          + research + editorial runtime/plan
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

Main/integration owner reviews and cherry-picks both Wave-2 commits. Agent branches do not merge each other. Phase-6 workflow selection/writer evidence and Today/Discover integration begin only after both Wave-2 outputs are reconciled on main.

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
