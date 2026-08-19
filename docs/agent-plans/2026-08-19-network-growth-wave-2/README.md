# Network Growth System — Wave 2 Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Current integration base:** `d38a068` (Phase 1A + Relationship Intelligence + full Phase 1C + full Phase 2 + Scheduler Core)
**Source of truth:** `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`, `docs/plans/PHASE_1C_ENGAGE_NEXT.md`, `docs/plans/PHASE_2_CONTENT_QUALITY.md`, `docs/plans/PHASE_3_DISTRIBUTION_SCHEDULER.md`
**Execution shape:** parallel isolated slices with central integration
**Current wave:** 2

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A — Engage Next Core | executable | complete + integrated (`1d480e3`) | complete | `/home/hamza/repo/x_test-w2-engagement` | isolated writer; verified one-file engagement core | none |
| Agent A2 — Engage Target Discovery | executable | complete + integrated (`aa08ddc`) | complete | `/home/hamza/repo/x_test-w2-engagement` | verified one-file `tech_news.js` target reader | none |
| Agent A3 — Engage Next Full Integration | executable/mixed | complete + integrated (`d38a068`) | complete | `/home/hamza/repo/x_test-w2-engagement` | verified full Phase-1C vertical | none |
| Agent B — Phase 2 Content Integration | executable/mixed | complete + integrated (`0f75e9b`) | complete | `/home/hamza/repo/x_test-w2-content-integration` | verified 10-file Phase-2 integration slice | none |
| Agent B2 — Distribution Scheduler Core | executable | complete + integrated (`e116410`) | complete | `/home/hamza/repo/x_test-w2-content-integration` | verified one-file pure scheduler core | none |

## Dependency map

```text
0f75e9b integrated Phase 2 + 1d480e3 Engage Core
        |
        +------------------------------+
        |                              |
        v                              v
Agent A3: Phase 1C Integration Agent B2: Scheduler Core
complete + integrated          complete + integrated
        |                              |
        +---------------+--------------+
                        |
                        v
                 central integration
                        |
           +------------+-------------+
           |                          |
           v                          v
 remaining Phase 1C integration   Phase 3 integration
 store/UI/bridge/read/send        store/automation/x_http/UI
           |
           v
   Phase 1D Account Health
           |
           +--------------------------+
                                      v
                              Phase 4 Measurement
```

## Shared contracts

- `pipeline.js` remains the workflow mutation and human-approval owner.
- `relationship.js` owns target profiles/events/TargetScore/stage.
- `opportunity.js` owns Reach/Follow/Conversation/Relationship candidate scores.
- `drafting.js` owns content composition/writer/gate behavior.
- Phase 2 persistence/workflow/UI/bridge integration is complete on main as `0f75e9b`.
- Engage Next Core is integrated as `1d480e3`; target timeline discovery is integrated as `aa08ddc`.
- Phase 1C Engage Next is complete on main as `d38a068`: engagement queue persistence, response discovery, relationship-event recording, Engage Next/Active Conversations UI and bridge commands, reviewable reply drafting, automation refresh, and one-at-a-time explicit approved-send behavior are current.
- Scheduler Core is integrated as `e116410`; `scheduler.js` is now a stable input to later Phase-3 integration.
- No autonomous reply sending, queue claiming, scheduler transport migration, media upload, experiments, or learning in the current parallel slice.
- No tests are authorized by current plans; use focused non-test evidence only.

## Integration policy

The main checkout remains the single integration writer. Agents commit only to their assigned branches. The orchestrator verifies each branch against its mission, integrates centrally, resolves interface drift, and then materializes only the next ready frontier.

Phase 1C and Scheduler Core are landed. Wave 2 is complete. The next safe parallel fan-out is Phase-1D pure `health.js` core alongside Phase-3 scheduler/publisher integration; see the Wave-3 coordination package.

## Execution lifetime policy

Current missions require **Causal Coding** before source mutation and **Persistent Agent Loop** for execution lifetime.

- Work headless by default.
- Status/progress/compatible steering does not terminate an incomplete mission.
- Use event waits only when a real external/persistent condition blocks work; do not invent heartbeat timers.
- Checkpoint at meaningful contract conflicts or commit-ready boundaries.
- Completion requires mission success conditions plus fresh Git/check evidence.

## Verification policy

Use the narrowest direct evidence capable of disproving the claimed behavior. No test files or broad suites. Appropriate checks include pure-function smoke scripts, isolated temporary-directory SQLite/workflow smoke where relevant, `node --check` on changed JS, and `git diff --check` near completion. Do not mutate live X relationships or send X actions as verification.

## Future / blocked work

- Phase 1C full integration — complete + integrated as `d38a068`.
- Phase 1D Account Health — ready; Wave 3 starts with pure `health.js` core.
- Phase 3 scheduler core — complete + integrated as `e116410`.
- Phase 3 persistence/claim/automation/format-aware transport integration — ready in Wave 3.
- Phase 4 Measurement/Experiments — blocked by Phase 1B/1C relationship events, Phase 1D health diagnostics, and Phase 3 published queue metadata.
- Phase 5 Learned Strategy — blocked by Phase 4 evidence and Phase 1D health contract.

## Status log

- `2026-08-19` — Wave 1 integrated: Content Core on `fa1a6a1`, Relationship Intelligence on `0784943`.
- `2026-08-19` — Wave 2 materialized as isolated Engage Next Core + Phase-2 Content Integration.
- `2026-08-19` — Agent A Engage Core integrated on main as `1d480e3`; Agent A2 target discovery launched as the next isolated read-path slice.
- `2026-08-19` — Agent B Phase-2 Content Integration `0dedaa2` verified and integrated on main as `0f75e9b`; Phase 2 is complete except intentionally deferred Phase-3 publication/media execution.
- `2026-08-19` — Agent B2 scheduler-core mission materialized as the next independent Phase-3 slice while Agent A2 continues target discovery.
- `2026-08-19` — Agent A2 Target Discovery `4e9083f` verified as one-file `tech_news.js` and integrated on main as `aa08ddc`; full Phase-1C integration is now ready.

- `2026-08-19` — Agent B2 Scheduler Core `cce731b` verified as one-file `scheduler.js` and integrated on main as `e116410`; Agent B pauses until Agent A3 completes to avoid shared-file merge debt.
- `2026-08-19` — Agent A3 Engage Next Integration `426ec4d` verified and integrated on main as `d38a068`; Phase 1C and Wave 2 are complete.
