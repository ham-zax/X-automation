# Network Growth System — Wave 4 Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Coordination base:** `fc50a60` (full Phase 1C + full Phase 2 + full Phase 3 + Account Health Core + Under-the-Hood reader)
**Source of truth:** `docs/plans/PHASE_1D_ACCOUNT_HEALTH.md`, `docs/plans/PHASE_4_MEASUREMENT_EXPERIMENTS.md`
**Execution shape:** parallel isolated integration + pure core
**Current wave:** 4

## Current frontier

| Mission | Type | Status | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|
| Agent A6 — Account Health Integration | executable/mixed | ready after worktree setup | `/home/hamza/repo/x_test-w2-engagement` | owns Phase-1D persistence/UI/bridge/Engage integration | Health Core + Under-the-Hood reader + Phase 1C complete |
| Agent B4 — Experiment & Measurement Core | executable | ready after worktree setup | `/home/hamza/repo/x_test-w2-content-integration` | owns only new pure `experiments.js`; no shared persistence/UI writes | Phase 3 metadata + pure health diagnostics available |

## Dependency map

```text
fc50a60 full Phase 3 + health core + visibility reader
        |
        +--------------------------------+
        |                                |
        v                                v
Agent A6: Phase 1D Integration     Agent B4: Phase 4 Pure Core
store/engagement/UI/bridge/docs    experiments.js only
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
- **Agent A6 may modify Phase-1D integration surfaces**: `store.js`, `engagement.js`, `dashboard.js`, `agent_bridge.js`, `tech_news.js` only for reader integration defects, `relationship.js` only if current event aggregates are insufficient, and Phase-1D operating docs. `health.js` should remain stable unless a concrete integration defect is demonstrated.
- **Agent B4 owns only new `experiments.js`.** It must not modify persistence, automation, audience, health, dashboard, scheduler, bridge, engagement, or docs.
- Agent B4 must treat health/network/publication observations as supplied inputs; it may not claim Phase 4 persistence/capture is implemented.
- No tests are authorized by current plans; use focused pure/isolated smoke evidence and static checks.

## Integration policy

The main checkout remains the single integration writer. Both current missions derive from the same coordination commit and have disjoint writable ownership. Agents commit only to their assigned branches. The orchestrator verifies and integrates each result centrally.

Phase 4 full persistence/capture/UI work remains blocked until Agent A6 lands. Agent B4 is intentionally limited to the pure owner so it can proceed without depending on SQLite health observations or competing for shared files.

## Execution lifetime policy

Both missions require **Causal Coding** before source mutation and **Persistent Agent Loop** for execution lifetime. Status/progress steering does not terminate an incomplete mission. Use event waits only for real external/persistent blockers.

## Verification policy

Use the smallest evidence capable of disproving the claimed behavior. Do not create test files or run broad suites. Appropriate evidence: pure-function smoke for `experiments.js`; disposable SQLite/bridge/dashboard health integration smoke for Agent A6; `node --check`; `git diff --check`. No live X writes.

## Future / blocked work

- Phase 4 full measurement/experiment integration — blocked by integrated Agent A6 plus Agent B4 core.
- Phase 5 Learned Strategy — blocked by Phase 4 persisted evidence/cohort summaries.

## Status log

- `2026-08-19` — Under-the-Hood reader integrated as `342616d`; Phase 3 Distribution Integration integrated as `fc50a60`.
- `2026-08-19` — Wave 4 prepared as full Account Health integration in parallel with isolated Phase-4 experiment/measurement core.
