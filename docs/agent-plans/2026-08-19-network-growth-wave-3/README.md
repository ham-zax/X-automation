# Network Growth System — Wave 3 Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Current integration base:** `fc50a60` (full Phase 1C + full Phase 2 + full Phase 3 + Account Health Core + Under-the-Hood reader)
**Source of truth:** `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`, `docs/plans/PHASE_1D_ACCOUNT_HEALTH.md`, `docs/plans/PHASE_3_DISTRIBUTION_SCHEDULER.md`
**Execution shape:** parallel isolated slices with central integration
**Current wave:** 3

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A4 — Account Health Core | executable | complete + integrated (`f0c4b9b`) | complete | `/home/hamza/repo/x_test-w2-engagement` | verified one-file pure health core | none |
| Agent A5 — Under the Hood Reader | executable | complete + integrated (`342616d`) | complete | `/home/hamza/repo/x_test-w2-engagement` | verified one-file `tech_news.js` visibility reader | none |
| Agent B3 — Phase 3 Distribution Integration | executable/mixed | complete + integrated (`fc50a60`) | complete | `/home/hamza/repo/x_test-w2-content-integration` | verified Phase-3 scheduling/publish-lock/transport/UI integration | none |

## Dependency map

```text
f0c4b9b full Phase 1C + Phase 2 + Scheduler Core + Health Core
        |
        +-------------------------------+
        |                               |
        v                               v
Agent A5: Under the Hood Read     Agent B3: Phase 3 Integration
tech_news.js only                 store/automation/x_http/UI/bridge
        |                               |
        +---------------+---------------+
                        |
                        v
                 central integration
                        |
          +-------------+--------------+
          |                            |
          v                            v
Phase 1D health integration     Phase 3 complete
store/UI/bridge/engagement      main-feed publishing metadata
          |                            |
          +-------------+--------------+
                        |
                        v
              Phase 4 Measurement/Experiments
                        |
                        v
                 Phase 5 Learning
```

## Shared contracts

- `pipeline.js` remains the human approval/workflow owner.
- `engagement.js` plus Phase-1C persistence own human-reviewed one-at-a-time engagement replies. Engagement replies remain outside the main-feed scheduler.
- `drafting.js` owns content composition and hard content gates.
- `scheduler.js` is integrated and owns pure main-feed scheduling decisions.
- Account Health Core is integrated as `f0c4b9b`; `health.js` is a stable input to later Phase-1D integration.
- **Agent A5 owns only `tech_news.js`** for the bounded authenticated Under-the-Hood observation adapter. It must not modify persistence, health derivation, engagement, dashboard, bridge, scheduler, automation, transport, or docs.
- **Agent B3 owns Phase-3 integration surfaces:** `store.js`, `automation.js`, `x_http.js`, `dashboard.js`, `agent_bridge.js`, and Phase-3 operating docs. `pipeline.js` may be changed only if a concrete Phase-3 contract defect requires a small compatibility-preserving adjustment.
- Agent B3 must not modify `health.js`, `engagement.js`, `relationship.js`, or Account Health behavior.
- Phase-3 publication must preserve `AUTO_POST=false` as preview-only by default.
- Main-feed queue state, not legacy ready-draft FIFO, becomes publication authority.
- Main-feed writes are serialized through an atomic claim before transport.
- Original/quote/thread publication must use the existing transport owner; no second posting stack.
- Required media remains blocked unless a real attachment/upload path exists; do not fake media readiness.
- No random jitter, fake-human timing, anti-detection timing, automated likes/follow churn, batch replies, or unsolicited keyword auto-replies.
- No tests are authorized by current plans; use focused non-test evidence only.

## Integration policy

The main checkout remains the single integration writer. Agents commit only to their assigned branches. The orchestrator verifies each branch against its mission, integrates centrally, and materializes only the next newly ready frontier.

Wave 3 is complete. Account Health Core, the bounded Under-the-Hood reader, and full Phase-3 distribution integration are all integrated. Phase-1D persistence/UI/bridge/Engage integration is the next critical mission. A pure Phase-4 experiment/measurement core can proceed in parallel because it owns only a new `experiments.js` and consumes health/publication data as supplied inputs.

## Execution lifetime policy

Both current missions require **Causal Coding** before source mutation and **Persistent Agent Loop** for execution lifetime.

- Work headless by default.
- Status/progress/compatible steering does not terminate an incomplete mission.
- Use event waits only for real external/persistent blockers; do not invent heartbeat timers.
- Checkpoint at meaningful contract conflicts or commit-ready boundaries.
- Completion requires mission success conditions plus fresh Git/check evidence.

## Verification policy

Use the smallest direct evidence capable of disproving the claimed behavior. No test files or broad suites. Appropriate evidence includes pure-function smoke scripts for `health.js`; isolated temporary SQLite/claim/publication smoke for Phase 3; mocked/injected transport rather than live X writes; `node --check`; and `git diff --check` near completion.

Do not use live X writes merely to prove the implementation. Do not mutate live relationships during verification.

## Future / blocked work

- Phase 1D Under-the-Hood read adapter — complete + integrated as `342616d`.
- Phase 1D persistence + Account Health UI/bridge + soft Engage modifiers — ready now.
- Phase 4 pure experiment/measurement core — ready as an isolated `experiments.js` mission; full Phase-4 persistence/capture remains blocked by completed Phase 1D integration.
- Phase 5 Learned Strategy — blocked by Phase 4 evidence and Phase-1D health contract.

## Status log

- `2026-08-19` — Phase 1C Engage Next `426ec4d` verified and integrated on main as `d38a068`; Phase 1C is complete.
- `2026-08-19` — Wave 3 prepared as pure Account Health Core in parallel with full Phase-3 Distribution Integration.
- `2026-08-19` — Agent A4 Account Health Core `0d843fe` verified as one-file `health.js` and integrated on main as `f0c4b9b`; Agent A5 Under-the-Hood reader is the next collision-free Phase-1D slice while Agent B3 continues.

- `2026-08-19` — Agent A5 Under-the-Hood reader `77f5c3f` verified and integrated as `342616d`; Agent B3 Phase-3 Distribution Integration `c4d0426` verified and integrated as `fc50a60`. Wave 3 is complete.
