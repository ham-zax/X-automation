# Network Growth System — Wave 5 Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Coordination base:** `86533fa` (full Phase 1D + full Phase 3 + Phase-4 pure experiment/measurement core)
**Source of truth:** `docs/plans/PHASE_4_MEASUREMENT_EXPERIMENTS.md`, `docs/plans/PHASE_5_LEARNED_STRATEGY.md`
**Execution shape:** parallel Phase-4 vertical integration + isolated Phase-5 pure core
**Current wave:** 5

## Current frontier

| Mission | Type | Status | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|
| Agent A7 — Learned Strategy Core | executable | ready after worktree setup | `/home/hamza/repo/x_test-w2-engagement` | owns only new pure `learning.js`; cannot affect production or persistence | Phase 1D complete + Phase-4 pure evidence contracts available |
| Agent B5 — Phase 4 Measurement & Experiments Integration | executable/mixed | ready after worktree setup | `/home/hamza/repo/x_test-w2-content-integration` | owns remaining Phase-4 persistence/capture/audience/UI/bridge vertical | full Phase 1D + Phase 3 + `experiments.js` core integrated |

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

After both land, full Phase-5 integration becomes the remaining major architecture phase.

## Execution lifetime policy

Both missions require **Causal Coding** before source mutation and **Persistent Agent Loop** for execution lifetime. Status/progress steering does not terminate an incomplete mission. Use event waits only for real external/persistent blockers.

## Verification policy

Use the smallest evidence capable of disproving the claimed behavior. Do not create test files or run broad suites.

- Agent A7: pure-function smoke, deterministic repeated inputs, `node --check learning.js`, `git diff --check`.
- Agent B5: disposable SQLite migration/window idempotency, mocked/read-only measurement capture, follower first-seen preservation, explicit experiment assignment/cohort smoke, dashboard/bridge inspection, changed-JS `node --check`, `git diff --check`.
- No live X writes are required or authorized for verification.

## Future / blocked work

- Phase 5 full learned-rule persistence/acceptance/consumer integration — blocked by completed Phase 4 plus Agent A7 pure core.
- Media upload/attachment readiness remains a separate publication capability and is not part of Phase 4/5 evidence learning.

## Status log

- `2026-08-19` — Phase 1D completed on main as `3d987d0`; Phase-4 pure experiment/measurement core integrated as `86533fa`.
- `2026-08-19` — Wave 5 prepared as full Phase-4 integration in parallel with isolated pure Phase-5 learning core.
