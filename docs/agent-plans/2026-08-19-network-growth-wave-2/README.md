# Network Growth System — Wave 2 Agent Coordination

**Repository:** `/home/hamza/repo/x_test`  
**Combined code base:** `0784943` (`fa1a6a1` Content Core + Phase 1B Relationship Intelligence)  
**Source of truth:** `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`, `docs/plans/PHASE_1C_ENGAGE_NEXT.md`, `docs/plans/PHASE_2_CONTENT_QUALITY.md`  
**Execution shape:** parallel isolated cores with central integration  
**Current wave:** 2

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A — Engage Next Core | executable | ready after worktree setup | now | `/home/hamza/repo/x_test-w2-engagement` | concurrent writer; owns only new pure `engagement.js` domain core | none |
| Agent B — Phase 2 Content Integration | executable/mixed | ready after worktree setup | now | `/home/hamza/repo/x_test-w2-content-integration` | concurrent writer; owns persistence/workflow/UI/bridge content integration while Agent A avoids shared surfaces | none |

## Dependency map

```text
0784943 combined Wave-1 implementation
        |
        +---------------------------+
        |                           |
        v                           v
Agent A: Engage Next Core      Agent B: Phase 2 Integration
engagement.js only             store/pipeline/bridge/dashboard
        |                           |
        +-------------+-------------+
                      |
                      v
               central integration
                      |
                      v
             Phase 1C integration
        store/read-path/UI/bridge/automation
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
- **Agent A owns only `engagement.js` in this wave.** It must not modify persistence, dashboard, bridge, authenticated X reads, automation, workflow, docs, or content code.
- **Agent B owns Phase-2 integration surfaces:** `store.js`, `pipeline.js`, `agent_bridge.js`, `dashboard.js`, `drafting.js` only when needed for a discovered integration defect, and Phase-2 operating docs.
- Agent B must not create/modify `engagement.js`, `tech_news.js`, `automation.js`, or implement Engage Next/Account Health.
- No autonomous reply sending, scheduler migration, media upload, experiments, or learning in this wave.
- No tests are authorized by current plans; use focused non-test evidence only.

## Integration policy

The main checkout remains the single integration writer. Agents commit only to their assigned branches. The orchestrator verifies each branch against its mission, integrates centrally, resolves interface drift, and then materializes the next frontier.

Agent A's module is intentionally persistence-free so it can be integrated independently of Agent B. Phase 1C storage/discovery/UI/send integration is a later mission after both branches land.

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

- Phase 1C persistence + authenticated discovery + Active Conversations/Engage Next UI + explicit send path — blocked by integrated Agent A core and stable Phase-2 content contract.
- Phase 1D Account Health — blocked by completed Phase 1C relationship-event/engagement history.
- Phase 3 Distribution — blocked by Phase 2 gates/final content integration.
- Phase 4 Measurement/Experiments — blocked by publication and network outcome metadata.
- Phase 5 Learned Strategy — blocked by Phase 4 evidence.

## Status log

- `2026-08-19` — Wave 1 integrated: Content Core on `fa1a6a1`, Relationship Intelligence on `0784943`.
- `2026-08-19` — Wave 2 materialized as isolated Engage Next Core + Phase-2 Content Integration to avoid concurrent edits to shared persistence/UI/bridge files.
