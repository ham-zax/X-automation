# Network Growth System — Wave 3 Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Coordination base:** `d38a068` (Phase 1A + Phase 1B + full Phase 1C + full Phase 2 + Scheduler Core)
**Source of truth:** `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`, `docs/plans/PHASE_1D_ACCOUNT_HEALTH.md`, `docs/plans/PHASE_3_DISTRIBUTION_SCHEDULER.md`
**Execution shape:** parallel isolated slices with central integration
**Current wave:** 3

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A4 — Account Health Core | executable | ready after worktree setup | now | `/home/hamza/repo/x_test-w2-engagement` | pure new `health.js` owner; no shared persistence/UI writes | Phase 1C complete |
| Agent B3 — Phase 3 Distribution Integration | executable/mixed | ready after worktree setup | now | `/home/hamza/repo/x_test-w2-content-integration` | owns scheduler persistence/orchestration/transport/UI surfaces while Agent A4 owns only `health.js` | Phase 2 + Scheduler Core complete |

## Dependency map

```text
d38a068 full Phase 1C + Phase 2 + Scheduler Core
        |
        +-------------------------------+
        |                               |
        v                               v
Agent A4: Account Health Core     Agent B3: Phase 3 Integration
health.js only                    store/automation/x_http/UI/bridge
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
- **Agent A4 owns only new `health.js`.** It must not modify persistence, engagement, dashboard, bridge, read paths, docs, scheduler, automation, or transport.
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

Agent A4 and Agent B3 have disjoint writable ownership and may run concurrently from the same coordination base. After both return, Phase-1D persistence/UI/bridge integration becomes the next shared-file mission. Phase 4 remains blocked until Phase 1D diagnostics and Phase-3 published queue metadata are both integrated.

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

- Phase 1D persistence + Account Health UI/bridge + soft Engage modifiers — blocked by Agent A4 `health.js` contract.
- Phase 4 Measurement/Experiments — blocked by completed Phase 1D plus Phase-3 published queue metadata.
- Phase 5 Learned Strategy — blocked by Phase 4 evidence and Phase-1D health contract.

## Status log

- `2026-08-19` — Phase 1C Engage Next `426ec4d` verified and integrated on main as `d38a068`; Phase 1C is complete.
- `2026-08-19` — Wave 3 prepared as pure Account Health Core in parallel with full Phase-3 Distribution Integration.
