# Agent B2 — Distribution Scheduler Core

**Repository:** `/home/hamza/repo/x_test`  
**Artifact type:** executable  
**Workspace:** `/home/hamza/repo/x_test-w2-content-integration` on branch `agent/w2-scheduler-core`  
**Isolation reason:** concurrent writable mission; Agent A2 owns `tech_news.js` discovery while this mission owns only new pure `scheduler.js`  
**Can start:** immediately after the assigned worktree is rebased onto the current coordination base  
**Depends on:** Phase 1A approval + completed Phase 2 content integration on main  
**Execution lifetime:** Persistent Agent Loop required  
**Wake strategy:** no artificial timer; event wait only for a real persistent/external blocker  
**Developer visibility:** headless by default

## Read first

- `docs/plans/PHASE_3_DISTRIBUTION_SCHEDULER.md` — authoritative Phase-3 scheduler behavior.
- `docs/agent-plans/2026-08-19-network-growth-wave-2/README.md` — current parallel ownership boundary.
- `AGENTS.md` — repository invariants.
- `pipeline.js`, `drafting.js`, `store.js`, `automation.js`, `x_http.js` — stable neighboring contracts to inspect but not modify in this mission.

Before source mutation, use **Causal Coding**. Use **Persistent Agent Loop** for execution lifetime. Do not create or run tests unless independently mandated by repository rules; the current plan does not authorize tests.

## Objective

Implement the pure scheduling decision core for Phase 3 in a new `scheduler.js`. Given already-supplied approved main-feed queue items and recent publication context, the module should decide eligibility, editorial priority, expiry pressure, semantic conflict, and a recommended publication time with transparent reasons and empirical-assumption labels.

This mission deliberately stops before persistence, queue claiming/locking, automation orchestration, X transport, dashboard/bridge, or publication execution.

## Ownership

You own:

- new `scheduler.js` only;
- main-feed eligibility evaluation from supplied queue/draft metadata;
- internal editorial priority and urgency/expiry modifiers;
- coverage-spacing recommendation using the documented empirical defaults;
- semantic/self-cannibalization comparison using local token/topic primitives only;
- deterministic ranking/recommended slot explanation;
- focused non-test verification of those pure contracts.

Neighboring Agent A2 owns authenticated relationship-target discovery in `tech_news.js` only.

## Coordination contract

- Final commit must modify only `scheduler.js`.
- Do not modify `store.js`, `pipeline.js`, `automation.js`, `x_http.js`, `dashboard.js`, `agent_bridge.js`, `drafting.js`, `engagement.js`, `tech_news.js`, docs, or package files.
- Do not read/write SQLite or perform X/network actions from `scheduler.js`.
- Engagement-lane replies are out of scope and must be rejected/not ranked as main-feed items.
- Treat timing windows as `EMPIRICAL_VARIABLE`, not X platform laws.
- Do not add random jitter, circadian simulation, fake-human delay, or detection-evasion logic.
- Viral/timely priority may recommend immediate publication but may never bypass supplied approval/gate eligibility.
- Use caller-supplied evidence for current acceleration, approved gate state, published state, and explicit human schedule override rather than inventing observations.
- Use local token/Jaccard/topic primitives for semantic conflict; no embeddings/dependencies.

## Required behavior

Implement the source-plan scheduler model:

- main-feed eligibility requires `lane = main` or `main_feed`, `status = approved`, non-null human approval, pipeline in `original|quote|thread|repost`, required hard gates represented as passing by caller input, not expired, and not already published;
- base priority weights: Follow .30, Reach .25, Conversation .15, Relationship .10, QualityNormalized .20;
- urgency modifiers: viral +15, timely +7, evergreen +0;
- expiry pressure: <=1h +15, <=3h +10, <=6h +5, expired reject;
- ordinary spacing target around 3h, evergreen preferred 4–6h, no inferred viral hard floor;
- approved viral content with short shelf-life may recommend `now` despite recent prior posting, with an explicit overlap/coverage warning;
- explicit human schedule override is respected when it does not violate hard eligibility/expiry;
- semantic overlap with recent main-feed content creates a delay/conflict recommendation for weaker items, while intentional continuation can override the conflict;
- return deterministic structured decisions with `eligible`, `recommendedAt`, `priority`, `reason`, `blockers`, warnings/conflicts, and `empiricalAssumptions`.

Prefer exports that let the later integration session independently evaluate and rank items, for example pure functions for eligibility, priority, semantic overlap/conflict, per-item schedule decision, and ranking. Exact export names are yours to choose; report them clearly.

## Success conditions

- An unapproved, engagement-lane, expired, already-published, or hard-gate-failing item is never schedulable.
- A strong approved viral item nearing expiry can outrank and pre-empt an evergreen item without any fake minimum timing floor.
- Evergreen items normally preserve the documented coverage spacing.
- High semantic overlap delays the weaker item when still useful; intentional continuation can remain eligible.
- An explicit human schedule override is visible and deterministic, not silently ignored.
- Same inputs produce the same decision/ranking.
- All timing assumptions are exposed as empirical/editorial rather than platform rules.
- Final commit changes only `scheduler.js`.

## Verification intent

Use focused pure-function smoke scripts to demonstrate:

- hard eligibility blockers;
- priority weights and urgency/expiry modifiers;
- ordinary versus evergreen spacing;
- viral immediate-preemption recommendation;
- semantic-conflict behavior and intentional-continuation override;
- explicit human schedule override;
- deterministic ranking.

Run `node --check scheduler.js` and `git diff --check` near completion. Do not create tests, touch live SQLite/X state, or run broad suites.

## Out of scope

- queue schema scheduling fields;
- atomic claim/publish locks;
- automation migration;
- quote/thread/media publication helpers;
- X transport;
- dashboard/bridge scheduler UI;
- Engage Next;
- Account Health;
- measurement/experiments/learning;
- documentation synchronization beyond the finish report.

## Working style

Explore current contracts first, then implement the smallest pure scheduling owner that satisfies the plan. Preserve existing ownership boundaries. Status/progress/compatible steering does not terminate the mission; continue until success conditions are freshly verified or explicitly stopped/replaced.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commit;
3. exact public exports added by `scheduler.js`;
4. concise eligibility/priority/spacing/conflict behavior summary;
5. checks actually run and results;
6. inputs/assumptions the later Phase-3 integration session must supply;
7. unresolved risks/deviations;
8. explicit confirmation that only `scheduler.js` changed.
