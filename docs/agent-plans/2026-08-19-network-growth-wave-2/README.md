# Network Growth System — Wave 2 Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Current integration base:** `0f75e9b` (Phase 1A + Relationship Intelligence + Content Core + Engage Next Core + Phase 2 integration)
**Source of truth:** `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`, `docs/plans/PHASE_1C_ENGAGE_NEXT.md`, `docs/plans/PHASE_2_CONTENT_QUALITY.md`, `docs/plans/PHASE_3_DISTRIBUTION_SCHEDULER.md`
**Execution shape:** parallel isolated slices with central integration
**Current wave:** 2

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A — Engage Next Core | executable | complete + integrated (`1d480e3`) | complete | `/home/hamza/repo/x_test-w2-engagement` | isolated writer; verified one-file engagement core | none |
| Agent A2 — Engage Target Discovery | executable | active | now | `/home/hamza/repo/x_test-w2-engagement` | owns only `tech_news.js` target discovery while shared files remain untouched | Engage Next Core integrated |
| Agent B — Phase 2 Content Integration | executable/mixed | complete + integrated (`0f75e9b`) | complete | `/home/hamza/repo/x_test-w2-content-integration` | verified 10-file Phase-2 integration slice | none |
| Agent B2 — Distribution Scheduler Core | executable | ready after branch reset to current coordination base | now | `/home/hamza/repo/x_test-w2-content-integration` | sequential reuse of Agent B worktree; owns only new `scheduler.js` while Agent A2 owns `tech_news.js` | Phase 2 complete |

## Dependency map

```text
0f75e9b integrated Phase 2 + 1d480e3 Engage Core
        |
        +------------------------------+
        |                              |
        v                              v
Agent A2: Target Discovery      Agent B2: Scheduler Core
tech_news.js only               scheduler.js only
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
- Engage Next Core is integrated as `1d480e3`; `engagement.js` is a stable input to later Phase-1C integration.
- **Agent A2 owns only `tech_news.js`** for bounded relationship-target timeline reads. It must not modify persistence, dashboard, bridge, automation, workflow, docs, content code, or X write paths.
- **Agent B2 owns only new `scheduler.js`**. It must not modify store/pipeline/automation/transport/UI/bridge/content/engagement/read-path files.
- No autonomous reply sending, queue claiming, scheduler transport migration, media upload, experiments, or learning in the current parallel slice.
- No tests are authorized by current plans; use focused non-test evidence only.

## Integration policy

The main checkout remains the single integration writer. Agents commit only to their assigned branches. The orchestrator verifies each branch against its mission, integrates centrally, resolves interface drift, and then materializes only the next ready frontier.

Agent A2 supplies bounded target-timeline observations to the existing pure `engagement.js` scorer. Agent B2 supplies only the pure `scheduler.js` decision layer. Neither may absorb persistence/automation/transport integration.

After Agent A2 lands, Phase-1C persistence/response detection/Engage Next UI/bridge/explicit-send integration becomes the critical shared-file mission. After Agent B2 lands, Phase-3 store/claim/automation/transport/UI integration can be scheduled independently because Phase-2 content contracts are already stable.

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

- Phase 1C target timeline discovery — Agent A2 active now.
- Phase 1C persistence + response detection + Active Conversations/Engage Next UI + explicit send path — blocked by Agent A2 target-discovery contract; Phase-2 shared surfaces are now stable.
- Phase 1D Account Health — blocked by completed Phase 1C relationship-event/engagement history.
- Phase 3 scheduler core — Agent B2 ready now because Phase 1A + Phase 2 dependencies are satisfied.
- Phase 3 persistence/claim/automation/format-aware transport integration — blocked by Agent B2 scheduler-core contract.
- Phase 4 Measurement/Experiments — blocked by Phase 1B/1C relationship events, Phase 1D health diagnostics, and Phase 3 published queue metadata.
- Phase 5 Learned Strategy — blocked by Phase 4 evidence and Phase 1D health contract.

## Status log

- `2026-08-19` — Wave 1 integrated: Content Core on `fa1a6a1`, Relationship Intelligence on `0784943`.
- `2026-08-19` — Wave 2 materialized as isolated Engage Next Core + Phase-2 Content Integration.
- `2026-08-19` — Agent A Engage Core integrated on main as `1d480e3`; Agent A2 target discovery launched as the next isolated read-path slice.
- `2026-08-19` — Agent B Phase-2 Content Integration `0dedaa2` verified and integrated on main as `0f75e9b`; Phase 2 is complete except intentionally deferred Phase-3 publication/media execution.
- `2026-08-19` — Agent B2 scheduler-core mission materialized as the next independent Phase-3 slice while Agent A2 continues target discovery.
