# Network Growth System — Wave 2 Agent Coordination

**Repository:** `/home/hamza/repo/x_test`  
**Current integration base:** `1d480e3` (Phase 1A + Relationship Intelligence + Content Core + Engage Next Core)
**Source of truth:** `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`, `docs/plans/PHASE_1C_ENGAGE_NEXT.md`, `docs/plans/PHASE_2_CONTENT_QUALITY.md`  
**Execution shape:** parallel isolated cores with central integration  
**Current wave:** 2

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A — Engage Next Core | executable | complete + integrated (`1d480e3`) | complete | `/home/hamza/repo/x_test-w2-engagement` | isolated writer; verified one-file engagement core | none |
| Agent A2 — Engage Target Discovery | executable | ready after branch reset to current base | now | `/home/hamza/repo/x_test-w2-engagement` | sequential reuse of Agent A worktree; owns only `tech_news.js` while Agent B continues on shared files | Engage Next Core integrated |
| Agent B — Phase 2 Content Integration | executable/mixed | active / working | now | `/home/hamza/repo/x_test-w2-content-integration` | concurrent writer; owns persistence/workflow/UI/bridge content integration while Agent A2 avoids shared surfaces | none |

## Dependency map

```text
1d480e3 integrated Engage Next Core
        |
        +------------------------------+
        |                              |
        v                              v
Agent A2: Target Discovery       Agent B: Phase 2 Integration
tech_news.js only                store/pipeline/bridge/dashboard
        |                              |
        +---------------+--------------+
                        |
                        v
                 central integration
                        |
                        v
             remaining Phase 1C integration
       persistence/responses/UI/bridge/automation/send
                        |
                        v
               Phase 1D Account Health
                        |
                        v
               Phase 3 Distribution
```

## Shared contracts

- `pipeline.js` remains the workflow mutation and human-approval owner.
- `relationship.js` owns target profiles/events/TargetScore/stage and is read-only to both agents unless a concrete correctness defect is discovered and reported.
- `opportunity.js` owns Reach/Follow/Conversation/Relationship candidate scores.
- `drafting.js` owns content composition/writer/gate behavior from integrated Content Core.
- Engage Next Core is integrated as `1d480e3`; `engagement.js` is now a stable input to later integration.
- **Agent A2 owns only `tech_news.js`** for bounded relationship-target timeline reads. It must not modify persistence, dashboard, bridge, automation, workflow, docs, content code, or X write paths.
- **Agent B owns Phase-2 integration surfaces:** `store.js`, `pipeline.js`, `agent_bridge.js`, `dashboard.js`, `drafting.js` only when needed for a discovered integration defect, and Phase-2 operating docs.
- Agent B must not create/modify `engagement.js`, `tech_news.js`, `automation.js`, or implement Engage Next/Account Health.
- No autonomous reply sending, scheduler migration, media upload, experiments, or learning in this wave.
- No tests are authorized by current plans; use focused non-test evidence only.

## Integration policy

The main checkout remains the single integration writer. Agents commit only to their assigned branches. The orchestrator verifies each branch against its mission, integrates centrally, resolves interface drift, and then materializes the next frontier.

Agent A's pure engagement core is already integrated. Agent A2 may now build only the target-timeline read adapter while Agent B continues on shared Phase-2 surfaces. Phase 1C persistence/response detection/UI/bridge/automation/send integration remains central/later work after both active branches land.

Agent B must normalize the Phase-2 prompt/editor media vocabulary before bridge exposure. The authoritative persisted/editor enum is:

```text
none | screenshot | chart | code | diagram
```

Prefer synchronizing prompt/document output to that enum rather than adding unused alias machinery.

## Execution lifetime policy

Both missions require **Causal Coding** before source mutation and **Persistent Agent Loop** for execution lifetime.

- Work headless by default.
- Status/progress/compatible steering does not terminate an incomplete mission.
- Use event waits only when a real external/persistent condition blocks work; do not invent heartbeat timers.
- Checkpoint at meaningful contract conflicts or commit-ready boundaries.
- Completion requires mission success conditions plus fresh Git/check evidence.

## Verification policy

Use the narrowest direct evidence capable of disproving the claimed behavior. No test files or broad suites. Appropriate checks include pure-function smoke scripts, isolated temporary-directory SQLite migration/workflow smoke, `node --check` on changed JS, and `git diff --check` near completion. Do not mutate live X relationships or send X actions as verification.

## Future / blocked work

- Phase 1C target timeline discovery — Agent A2 is ready now and stays isolated in `tech_news.js`.
- Phase 1C persistence + response detection + Active Conversations/Engage Next UI + explicit send path — blocked by Agent A2 target discovery plus stable Phase-2 shared surfaces from Agent B.
- Phase 1D Account Health — blocked by completed Phase 1C relationship-event/engagement history.
- Phase 3 Distribution — blocked by Phase 2 gates/final content integration.
- Phase 4 Measurement/Experiments — blocked by publication and network outcome metadata.
- Phase 5 Learned Strategy — blocked by Phase 4 evidence.

## Status log

- `2026-08-19` — Wave 1 integrated: Content Core on `fa1a6a1`, Relationship Intelligence on `0784943`.
- `2026-08-19` — Wave 2 materialized as isolated Engage Next Core + Phase-2 Content Integration to avoid concurrent edits to shared persistence/UI/bridge files.
- `2026-08-19` — Agent A returned `ba91a23`; verified as one-file `engagement.js` and integrated on `main` as `1d480e3`. Agent B remains active. Agent A2 target discovery is the new collision-free frontier.
