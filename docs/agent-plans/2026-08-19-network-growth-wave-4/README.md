# Network Growth System — Wave 4 Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Current integration base:** `86533fa` (full Phase 1D + full Phase 3 + Phase-4 experiment/measurement core)
**Source of truth:** `docs/plans/PHASE_1D_ACCOUNT_HEALTH.md`, `docs/plans/PHASE_4_MEASUREMENT_EXPERIMENTS.md`
**Execution shape:** parallel isolated integration + pure core
**Current wave:** 4

## Current frontier

| Mission | Type | Status | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|
| Agent A6 — Account Health Integration | executable/mixed | complete + integrated (`3d987d0`) | `/home/hamza/repo/x_test-w2-engagement` | verified Phase-1D integration slice | none |
| Agent B4 — Experiment & Measurement Core | executable | complete + integrated (`86533fa`) | `/home/hamza/repo/x_test-w2-content-integration` | verified one-file pure `experiments.js` owner | none |

## Dependency map

```text
86533fa full Phase 1D + Phase 3 + Phase-4 pure core
        |
        +--------------------------------+
        |                                |
        v                                v
Agent A6: Phase 1D Integration     Agent B4: Phase 4 Pure Core
complete + integrated              complete + integrated
        |                                |
        +----------------+---------------+
                         |
                         v
                  central integration
                         |
                         v
              Phase 4 full integration
       persistence/capture/audience/UI/bridge
                         |
                         v
                  Phase 5 Learning
```

## Shared contracts

- `health.js` owns HEALTHY/WATCH/CONSTRAINED, SaturationPressure, repetition diagnostics, Network Quality components, and InteractionYield.
- `tech_news.js#fetchXUnderTheHoodReport()` is observation-only and may return `available:false`; absence is never health failure.
- `engagement.js` owns EngagePriority and the explicit human-reviewed reply flow. WATCH-only health signals may modify priority/warnings but must not block useful human-approved replies.
- `scheduler.js` and Phase-3 queue state own main-feed publication; engagement replies remain outside it.
- Phase 1D is complete on main as `3d987d0`; `getAccountHealthSummary()` is now a stable structured input for later measurement/learning work.
- Phase-4 pure experiment/measurement ownership is integrated as `86533fa`; `experiments.js` is stable for persistence/UI integration unless a concrete integration defect is found.
- No tests are authorized by current plans; use focused pure/isolated smoke evidence and static checks.

## Integration policy

The main checkout remains the single integration writer. Both current missions derive from the same coordination commit and have disjoint writable ownership. Agents commit only to their assigned branches. The orchestrator verifies and integrates each result centrally.

Both Wave-4 missions are landed. Phase 4 full persistence/capture/audience/UI/bridge work is now ready. Phase 5 remains non-operational until real Phase-4 persisted evidence exists, although an isolated pure `learning.js` contract may be prepared in parallel with Phase-4 integration.

## Execution lifetime policy

Both missions require **Causal Coding** before source mutation and **Persistent Agent Loop** for execution lifetime. Status/progress steering does not terminate an incomplete mission. Use event waits only for real external/persistent blockers.

## Verification policy

Use the smallest evidence capable of disproving the claimed behavior. Do not create test files or run broad suites. Appropriate evidence: pure-function smoke for `experiments.js`; disposable SQLite/bridge/dashboard health integration smoke for Agent A6; `node --check`; `git diff --check`. No live X writes.

## Future / blocked work

- Phase 4 full measurement/experiment integration — ready now.
- Phase 5 full Learned Strategy integration — blocked by Phase 4 persisted evidence/cohort summaries.

## Status log

- `2026-08-19` — Under-the-Hood reader integrated as `342616d`; Phase 3 Distribution Integration integrated as `fc50a60`.
- `2026-08-19` — Wave 4 prepared as full Account Health integration in parallel with isolated Phase-4 experiment/measurement core.
- `2026-08-19` — Agent A6 Account Health Integration `ac04124` verified and integrated as `3d987d0`; Phase 1D is complete.
- `2026-08-19` — Agent B4 Experiment & Measurement Core `bbedeb8` verified as one-file `experiments.js` and integrated as `86533fa`.
