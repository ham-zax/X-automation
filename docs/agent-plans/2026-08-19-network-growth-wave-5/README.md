# Network Growth System — Wave 5 Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Coordination base:** `86533fa` (full Phase 1D + full Phase 3 + Phase-4 pure experiment/measurement core)
**Source of truth:** `docs/plans/PHASE_4_MEASUREMENT_EXPERIMENTS.md`, `docs/plans/PHASE_5_LEARNED_STRATEGY.md`
**Execution shape:** completed Phase-4 integration + learned-strategy pure core, followed by orchestrator-owned Phase-5 integration on `main`
**Current wave:** 5 — complete

## Current frontier

| Mission | Type | Status | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|
| Agent A7 — Learned Strategy Core | executable | complete + integrated (`5f7db94`) | `/home/hamza/repo/x_test-w2-engagement` | verified one-file pure `learning.js` core | none |
| Agent B5 — Phase 4 Measurement & Experiments Integration | executable/mixed | complete + integrated (`6bb9ca5`) | `/home/hamza/repo/x_test-w2-content-integration` | verified Phase-4 persistence/capture/audience/UI/bridge vertical | none |
| Orchestrator — Phase 5 Operational Integration | executable/mixed | implemented on `main` in the post-wave integration session | `/home/hamza/repo/x_test` | owns learned-rule persistence, human controls, consumer wiring, docs | A7 + B5 integrated |

## Dependency map

```text
86533fa full Phase 1D + full Phase 3 + experiments.js core
        |
        +------------------------------------+
        |                                    |
        v                                    v
Agent A7: Learning Core              Agent B5: Phase 4 Integration
learning.js only                     store/automation/audience/UI/bridge
        |                                    |
        +------------------+-----------------+
                           |
                           v
                    central integration
                           |
                           v
                    Phase 4 complete
                           |
                           v
                 Phase 5 full integration
          persistence/consumers/UI/bridge/docs
```

## Shared contracts

- `experiments.js` owns pure experiment validation, population matching, attribution semantics, normalized content/network cohorts, and evidence states.
- `health.js` plus `getAccountHealthSummary()` own current account-health/network diagnostics. Phase 4 consumes these as context; it does not redefine health state.
- `scheduler.js` and Phase-3 queue state own publication timing/outcome metadata.
- `relationship.js`/`relationship_events` own relationship history; Phase 4 may add first-seen preservation/query support but must not rewrite relationship scoring/stage semantics.
- `audience.js` remains the raw follower/following observation path and should preserve original first-seen timestamps.
- **Agent A7 owns only new `learning.js`.** It must be pure/side-effect-free and consume supplied Phase-4/health/relationship evidence. It must not modify SQLite, scorers, scheduler, engagement, health, dashboard, bridge, docs, or production behavior.
- **Agent B5 owns the remaining Phase-4 vertical:** `store.js`, `automation.js`, `audience.js`, `relationship.js` only for first-seen/measurement support, `dashboard.js`, `agent_bridge.js`, and Phase-4 operating docs. `experiments.js` should change only for a concrete integration defect. `health.js` is read-only unless a concrete contract defect blocks Phase 4.
- Agent B5 must not create/modify `learning.js` or implement Phase-5 learned-rule persistence/production adjustments.
- Experiment assignment is explicit; do not invent random assignment or duplicate/near-duplicate A/B posting.
- Associated follower deltas remain non-causal and must retain attribution confidence.
- No tests are authorized by current plans; use focused non-test verification only.

## Integration policy

Both worktrees derive from the same coordination base and have disjoint intended write ownership. Agents commit only to their assigned branches. The main checkout remains the single integration writer.

Agent A7 may establish the pure rule-generation/bounded-adjustment contract early because it accepts evidence as inputs and cannot affect production. It must not claim Phase 5 operational readiness. Agent B5 is the critical path: Phase 4 is complete only after fixed-window measurements, follower-quality state, experiment persistence/assignment, cohort UI, and bridge inspection are integrated.

Both agent missions landed. The user then requested the final integration be completed directly by the orchestrator on `main`: learned-rule persistence, refresh/accept/retire controls, bounded consumer application, dashboard/bridge visibility, and documentation are the final Wave-5 integration boundary.

## Execution lifetime policy

Both missions require **Causal Coding** before source mutation and **Persistent Agent Loop** for execution lifetime. Status/progress steering does not terminate an incomplete mission. Use event waits only for real external/persistent blockers.

## Verification policy

Use the smallest evidence capable of disproving the claimed behavior. Do not create test files or run broad suites.

- Agent A7: pure-function smoke, deterministic repeated inputs, `node --check learning.js`, `git diff --check`.
- Agent B5: disposable SQLite migration/window idempotency, mocked/read-only measurement capture, follower first-seen preservation, explicit experiment assignment/cohort smoke, dashboard/bridge inspection, changed-JS `node --check`, `git diff --check`.
- No live X writes are required or authorized for verification.

## Future / blocked work

- No planned network-growth phase remains after the direct Phase-5 integration. Real account evidence must accumulate before many useful rules reach directional/repeated states.
- Media upload/attachment readiness remains a separate publication capability and is not part of Phase 4/5 evidence learning.

## Status log

- `2026-08-19` — Phase 1D completed on main as `3d987d0`; Phase-4 pure experiment/measurement core integrated as `86533fa`.
- `2026-08-19` — Wave 5 prepared as full Phase-4 integration in parallel with isolated pure Phase-5 learning core.
- `2026-08-19` — Agent B5 Phase-4 Integration integrated as `6bb9ca5`; Agent A7 Learned Strategy Core integrated as `5f7db94`.
- `2026-08-19` — User requested the final Phase-5 operational integration be completed directly by the orchestrator on `main` rather than delegated to another agent.
