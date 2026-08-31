# Growth OS Live Feedback Loop — Agent Coordination

**Repository:** `/home/hamza/repo/x_test`  
**Source of truth:** `docs/GROWTH_OS_MOMENTUM_OPERATOR.md` plus `docs/FIRST_1000_GROWTH_MODE.md`  
**Coordination base:** `d17d935` (`feat: add first 1000 growth operator`)  
**Execution shape:** single session  
**Current wave:** Wave 1

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A — Close the Growth OS live feedback-state gaps | mixed | ready | now, after this coordination package is committed | current checkout `/home/hamza/repo/x_test` | none; one writer owns the coupled store/bridge/operator contract | none |

## Dependency map

```text
First-1,000 operator landed at d17d935
        |
        v
Agent A: live source capture + exact disposition + action-time source state + outcome join
        |
        v
Growth OS can learn from real operator decisions without manual ledger repair
        |
        v
future ranking changes only after repeated own-account outcome evidence
```

## Why this wave exists

The live 2026-08-25 operating run proved that the First-1,000 operator is usable, but the state path is still fragmented.

The important observations are:

- Manual live X discovery repeatedly found better operator surfaces than the current stored ranking. Examples included an almonk source at roughly 3K views / 119 bookmarks / 4 replies and the Neon WAL thread at roughly 38.8K views / 237 bookmarks / 4 replies.
- One lower-reach Daniel San reply later showed roughly 310 reply views plus a like while some much larger and more crowded sources produced only roughly 32 and 81 reply views for our replies. This is directional evidence that raw source reach is not enough. It is not a causal ranking law.
- `growth-next` exposes reply density, but intentionally does not weight it yet. That restraint should remain until enough own-account outcomes exist.
- A skipped 205K-view DeepSeek Harness source kept returning at the top because the current state model only knows successful candidate actions; it has no durable exact-candidate operator disposition for `skip/defer because this source/topic is already saturated for us`.
- Live-discovered sources often were not yet in `candidates`. `record-action` therefore failed with `Candidate not found`, forcing a separate `ingest` round trip before the action could be reconciled.
- At least one previously live action (AgentSky) was missing from the local action ledger and had to be reconstructed from live X before the operator could safely avoid a duplicate. Live X remains authoritative for whether a consequential action actually exists.
- The current `candidate_actions` row records action/output/commentary but not the source state that justified the decision. This breaks the later learning question: what source conditions existed when this action was chosen?
- Browser pointer-submit reliability and systemd process supervision were also observed, but they are separate runtime/operator concerns and are not part of this Growth OS state mission.

The objective of this wave is therefore not to add another dashboard or immediately rewrite the ranking formula. It is to make the decision/action/outcome evidence path trustworthy enough that later ranking changes can be based on repeated own-account evidence.

## Shared contracts

- First-1,000 mode remains active until the account reaches 1,000 followers or the operator explicitly ends it.
- Live X is authoritative for whether a social mutation actually happened. Local state records observed tweet IDs, URLs, metrics, and successful actions.
- `growth-next` remains read-only planning. It may rank and explain, but it does not publish.
- `record-action` or its coherent successor must remain idempotent for the same exact candidate/action and must never create a second social mutation.
- Unknown metrics are not the same as observed zero. Preserve absence/provenance when the operator did not observe a value.
- Reply density, bookmark density, author authority, momentum, and similar fields are observational evidence. Do not turn the latest small sample into a claimed X algorithm law.
- Do not introduce a hard author/topic saturation ban. The requested suppression state is exact-candidate operator disposition, with transparent reason/state and a reversible or expiry-aware model if needed.
- Preserve duplicate prevention, publication authority, and human approval boundaries.
- Do not change `AUTO_POST`, browser transport, social-action safety, or scheduler authority in this mission.

## Workspace policy

Use the current checkout `/home/hamza/repo/x_test` on `main`.

No additional worktree is justified: this is one coherent writer mission over the coupled Growth OS store/bridge/operator contract. The checkout is clean at handoff. If another concurrent writer appears and needs the same mutable files, report the collision instead of silently creating a new worktree.

Do not delete or rewrite the existing historical agent worktrees; they may still contain useful isolated history and are not part of this cleanup.

## Integration policy

No separate branch integration is planned. Agent A may commit directly in the assigned current checkout and should report the commit(s) created.

Keep the change on the smallest causal path from the observed live failures to the durable state contract. Do not absorb unrelated dashboard, browser, service-supervision, content-writing, or scheduler work.

## Execution lifetime policy

Ordinary one-session engineering mission. `persistent-agent-loop` is not required unless the agent independently encounters a genuinely long-lived runtime observation that is necessary to complete the mission.

## Validation policy

Testing is not authorized for this wave. Do not create, modify, or run tests.

Follow `AGENTS.md` and Causal Coding. Use only the smallest non-test checks needed to establish the changed bridge/store/operator behavior, plus final syntax/static checks and diff inspection where relevant. Do not run a broad suite.

## Future / blocked work

- **Ranking-weight changes for bookmark density / reply crowding** — blocked until the new action-time context and outcome join produce enough repeated own-account evidence.
- **Browser submit-path repair** — separate browser/operator infrastructure task; current keyboard submit path is operational.
- **Systemd supervision cleanup** — separate runtime/service task; process liveness was not blocking publication.
- **Dashboard redesign** — not needed to solve this wave. The operator contract should become trustworthy before more UI is added.

## Status log

- `2026-08-25 d17d935` — First-1,000 operator committed with `growth-next`, `growth-refresh`, last-known-good source preservation, bootstrap route behavior, and source-style transfer.
- `2026-08-25` — Wave 1 materialized from the live operating run. Agent A is ready to close the live-source/disposition/action/outcome state gaps without prematurely hard-coding new ranking folklore.
