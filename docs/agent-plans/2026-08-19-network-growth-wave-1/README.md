# Network Growth System — Agent Coordination

**Repository:** `/home/hamza/repo/x_test`  
**Source of truth:** `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md` and `docs/plans/`  
**Phase 1A implementation base:** `7ccdb7c`  
**Execution shape:** hybrid  
**Current wave:** 1 — post-foundation parallel fan-out

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A — Relationship Intelligence | executable/mixed | ready after worktree setup | now | `/home/hamza/repo/x_test-w1-relationship` | concurrent writer; owns persistence/audience/dashboard/bridge relationship vertical | none; Phase 1A is landed |
| Agent B — Content Quality Core | executable | ready after worktree setup | now | `/home/hamza/repo/x_test-w1-content` | concurrent writer; owns isolated drafting/content core while Agent A owns shared persistence/UI surfaces | none; Phase 1A is landed |

## Dependency map

```text
7ccdb7c Phase 1A foundation
          |
          +--------------------------+
          |                          |
          v                          v
Agent A: Phase 1B              Agent B: Phase 2 core
Relationship Intelligence      drafting/writer/gates only
          |                          |
          +------------+-------------+
                       |
                       v
                central integration
                       |
             +---------+---------+
             |                   |
             v                   v
       Phase 1C Engage Next   Phase 2 integration
             |
             v
       Phase 1D Account Health
             |
             v
       Phase 3 Distribution
             |
             v
       Phase 4 Measurement
             |
             v
       Phase 5 Learning
```

## Shared contracts

- `pipeline.js` owns Phase-1 workflow mutation and the human approval boundary. Neither agent may bypass it.
- `opportunity.js` owns the four current candidate opportunity scores. Agent A may consume Relationship Potential context but must not duplicate these formulas.
- `store.js` remains persistence owner. **Only Agent A may modify it in this wave.**
- `dashboard.js` and `agent_bridge.js` are shared integration surfaces. **Only Agent A may modify them in this wave.** Agent B must stop at pure content-core interfaces.
- `drafting.js` is the content composition/scoring/gate owner. **Only Agent B may modify it in this wave.**
- Agent A must not modify `drafting.js` except to report a blocking contract mismatch.
- Agent B must not modify `store.js`, `pipeline.js`, `dashboard.js`, `agent_bridge.js`, `audience.js`, or relationship persistence/UI files.
- No agent may change `AUTO_POST`, publishing transport behavior, scheduler semantics, or add autonomous reply sending.
- No tests are authorized by the current plans; use direct smoke/static evidence and repository-required non-test checks only.

## Workspace policy

Two writable missions run concurrently, so each gets a separate branch/worktree derived from the same coordination base. This isolation exists to prevent concurrent writes to one Git worktree and to keep the relationship vertical independent from the content-core vertical.

Planned branches/worktrees:

- `agent/w1-relationship-intelligence` → `/home/hamza/repo/x_test-w1-relationship`
- `agent/w1-content-quality-core` → `/home/hamza/repo/x_test-w1-content`

Agents must not merge, rebase, reset, switch another branch, or modify the main integration worktree.

## Integration policy

The main checkout `/home/hamza/repo/x_test` remains the integration workspace owned by the orchestrating session. Agents commit only to their assigned branches. When reports return, the orchestrator verifies the commits, integrates them centrally, resolves contract drift, runs the narrow final non-test checks invalidated by integration, and then materializes only the newly ready frontier.

Do not merge Agent B's content core directly into workflow approval until its pure interfaces have been reconciled with the relationship branch and the Phase-2 persistence/bridge/UI integration mission.

## Execution lifetime policy

Both current-wave missions use **Persistent Agent Loop** for execution lifetime and **Causal Coding** before source mutation.

- Work headless by default.
- Do not create artificial heartbeat timers. Continue ordinary implementation continuously while work is available.
- If a persistent command/process is needed, keep it in Terminal and use an event wait for readiness/output/exit.
- Checkpoint at meaningful boundaries such as a discovered cross-mission contract conflict, a commit-ready state, or before any unavoidable user decision.
- Status/progress/compatible steering does not terminate an incomplete mission.
- Completion requires the mission's success conditions plus fresh repository evidence.

## Verification policy

Executable missions should use the smallest direct evidence capable of disproving their claimed behavior. No tests are authorized by the phase plans. Appropriate evidence includes focused runtime smoke checks against temporary/non-destructive state, `node --check` on changed JS, relevant schema/read-path inspection, and `git diff --check` near completion. Do not run a broad/full test suite merely because the work is delegated.

## Future / blocked work

- Phase 1C Engage Next — blocked by integrated Phase 1B Relationship Intelligence.
- Phase 1D Account Health — blocked by integrated Phase 1C plus relationship-event history.
- Phase 2 persistence/bridge/UI/human-approval integration — blocked by Agent B content-core result and integration with Agent A shared surfaces.
- Phase 3 scheduler/distribution — blocked by completed Phase 2 gates/final content contract.
- Phase 4 measurement/experiments — blocked by publication metadata from Phase 3 and network events.
- Phase 5 learned strategy — blocked by Phase 4 evidence.

## Status log

- `2026-08-19` — Phase 1A landed at `7ccdb7c`; Wave 1 coordination package materialized for Relationship Intelligence + isolated Content Quality Core.
