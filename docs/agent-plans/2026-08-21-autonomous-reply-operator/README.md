# Autonomous Reply Operator — Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Source of truth:** `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`, `docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`, `docs/AGENT_WORKFLOW.md`, plus the user's 2026-08-21 authorization to add a bounded automatic reply capability
**Coordination base:** `92ccd17`
**Execution shape:** sequential dependency with isolated preparation
**Current wave:** 1

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A9 — Autonomous Reply Operator | mixed | dependency-gated | Read/plan immediately; shared-authority mutation only after A8 lands | `/home/hamza/repo/x_test-w8-autoreply` | A8 is an active writer in the main worktree and currently edits `pipeline.js`, `store.js`, `web_api.js`, and related authority paths | A8 Growth Decision Recovery must land a stable integrated commit before A9 changes shared reply/publication authority |

## Dependency map

```text
A8 Growth Decision Recovery (current main worktree writer)
        |
        | stable integrated commit / current authority contracts
        v
A9 Autonomous Reply Operator
        |
        +--> bounded autonomous opportunity selection
        +--> reply intent + tone selection
        +--> explicit operator autonomy grant
        +--> persistent refresh / start-pause-stop daemon semantics
        +--> zero/one/many eligible replies per refresh within the grant budget
        +--> shared safe reply-send transport/bookkeeping
        +--> Settings / Conversations observability
        +--> dry-run operator verification
```

## Shared contracts

- Existing `Engage Next` is real and remains the source of engagement opportunity/relationship context.
- Existing contribution and freshness/reply-visibility scoring should be extended rather than replaced.
- Human-reviewed reply flow must remain available even after autonomous mode exists.
- Autonomous send authority must never be represented as `humanApprovedAt` or fake human approval.
- Main-feed scheduler and reply automation remain separate lanes.
- Growth Focus, account-health constraints, duplicate protection, relationship history, and result recording remain existing owners.
- High engagement may improve opportunity value but must not be required; normal relevant tweets can qualify when conversation/relationship/contribution value is strong.
- "Start autonomous replies" means keep refreshing and acting until explicitly paused/stopped/revoked (or the application process is stopped), not a one-shot scan.
- A refresh is not capped to one reply. Zero, one, or several independently eligible opportunities may be processed serially, constrained by the explicit operator grant/budget and current safety/value state.
- Continuous mode must use fresh source observations and durable dedupe/decision state; repeatedly scoring one stale snapshot is not an autonomous reply loop.

## Workspace policy

A9 has a dedicated worktree because A8 is currently writing the main checkout. Do not create another worktree. While A8 is active, A9 may inspect shared files but must not race changes to shared authority owners. Once A8 lands, A9 may update its branch from the new stable `main` as explicitly required by its mission, then own the complete autonomous-reply change in this worktree.

## Integration policy

A9 should finish on `agent/w8-autonomous-reply`. It must not merge into `main` itself. Return its commit(s) for central integration after A8 is stable. If A8 materially changes the reply/publication authority seam, A9 must adapt to the landed contracts rather than preserving stale assumptions from `92ccd17`.

## Execution lifetime policy

A9 uses `persistent-agent-loop`. It may begin with read-only investigation while waiting for A8's stable integration commit. Use repository state/event observation rather than a fake polling loop. After the dependency clears, implement and verify the mission. The product itself must own long-running autonomous-reply continuity through the repository's automation/process lifecycle; ChatGPT session lifetime is not the product runtime. No live X reply send is authorized by this coordination package; live sending requires a separate bounded user authorization.

## Validation policy

No test creation, modification, or execution. Use only directly relevant non-test checks: targeted syntax/runtime inspection, UI build if the UI changes materially, `git diff --check`, dry-run autonomous selection/generation, browser flow, and final diff review.

## Future / blocked work

- Bounded live autonomous-reply pilot — available after A9 integration when the user starts Live mode with a concrete live-send budget.
- Outcome learning for autonomous reply intent/tone — use real published-reply outcomes only after sufficient observations; do not auto-promote rules from tiny samples.

## Status log

- 2026-08-21 — coordination package created. Existing Engage Next confirmed implemented; autonomous sending/tone-selection does not yet exist. A9 isolated because A8 currently owns overlapping shared authority files in the main worktree.
- 2026-08-21 — requirement sharpened: autonomous mode is a persistent refresh-and-act loop. Once started it keeps discovering newly observed tweets and may send zero/one/several qualified replies per refresh within the explicit operator grant; it does not stop merely because one cycle had no candidate or because one reply was sent.
