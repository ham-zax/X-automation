# Agent A — Engage Next Core

**Repository:** `/home/hamza/repo/x_test`  
**Artifact type:** executable  
**Workspace:** `/home/hamza/repo/x_test-w2-engagement` on branch `agent/w2-engage-next-core`  
**Isolation reason:** concurrent writable mission; this branch owns only the new pure engagement domain module  
**Can start:** immediately after assigned worktree exists  
**Depends on:** integrated Phase 1A + Phase 1B (`0784943`)  
**Execution lifetime:** Persistent Agent Loop required  
**Wake strategy:** no artificial timer; event wait only for a real external/persistent blocker  
**Developer visibility:** headless by default

## Read first

- `docs/plans/PHASE_1C_ENGAGE_NEXT.md` — authoritative Phase-1C behavior.
- `docs/RELATIONSHIP_INTELLIGENCE.md` — relationship stages, target classes, event semantics.
- `docs/agent-plans/2026-08-19-network-growth-wave-2/README.md` — strict parallel ownership boundary.
- `AGENTS.md` — repository invariants.
- `relationship.js`, `opportunity.js`, `pipeline.js`, `drafting.js` — stable neighboring contracts to consume/read, not replace.

Before source mutation, use **Causal Coding**. Use **Persistent Agent Loop** for execution lifetime. Do not create or run tests unless independently mandated by repository rules; the current plan does not authorize tests.

## Objective

Implement the pure domain/scoring core for Phase 1C Engage Next in a new `engagement.js`. Given already-supplied source-post/candidate context, Relationship Intelligence context, interaction state, and contribution evidence, the module should decide whether an opportunity is actionable, explain its contribution archetype/strength, compute freshness/reply-visibility/EngagePriority/expiry, and rank opportunities transparently.

This mission deliberately stops before persistence, X fetching, dashboard, bridge, automation, or outbound sends. Those are later integration work.

## Ownership

You own:

- new `engagement.js` only;
- pure contribution qualification;
- empirical freshness and expiry heuristics;
- per-post ReplyVisibility adjustment with bounded soft saturation;
- EngagePriority components/modifiers/rejection reasons;
- deterministic ranking of supplied opportunities;
- focused non-test verification of those pure contracts.

Neighboring Agent B owns all Phase-2 persistence/workflow/UI/bridge content integration.

## Coordination contract

- Do not modify `store.js`, `relationship.js`, `pipeline.js`, `opportunity.js`, `drafting.js`, `dashboard.js`, `agent_bridge.js`, `tech_news.js`, `automation.js`, README/docs, or package files.
- Do not read or write SQLite from `engagement.js`.
- Do not perform browser/network/X actions from `engagement.js`.
- Do not implement reply drafting/sending or approval workflow.
- Accept observed/context values as inputs rather than inventing unavailable graph data.
- Saturation is advisory and bounded; active bidirectional conversation/direct responses may offset ordinary age/saturation pressure.
- No fixed daily reply quota.
- Exact/near-duplicate and same-source-exhaustion rejection should be driven by explicit caller-supplied evidence/context where final reply text is not yet available; do not duplicate the Phase-2 drafting gate engine.
- Expose clear stable exports and document them in the finish report so the Phase-1C integration session can wire persistence/read paths without reverse engineering.

## Required behavior

Implement the Phase-1C model from the source plan:

- freshness buckets: 0–5m 100, 5–15m 95, 15–30m 85, 30–60m 70, 1–2h 50, 2–6h 30, 6h+ 10, labeled `EMPIRICAL_VARIABLE`;
- contribution archetypes: `implementation_detail`, `benchmark_or_result`, `caveat_or_edge_case`, `comparison`, `correction`, `informed_question`, `synthesis`, `reproduction`, `personal_experience`;
- contribution strength baseline from the plan and rejection below 60 after evidence/context adjustment;
- EngagePriority base weights: Conversation .25, Relationship .20, TargetScore .20, Freshness .15, ReplyVisibility .10, Contribution .10;
- event modifiers: direct question +15, target replied +15, active recurring +10, own-post substantive reply +8, bounded soft saturation/repetition negative modifier;
- reject no contribution, explicit near-duplicate, exhausted same source/no new value, or truly expired/no-active-conversation;
- active conversation may extend ordinary expiry/freshness treatment;
- expiry defaults from the plan for viral, normal/news, slow technical, follow-up, and own-post-response opportunities;
- return transparent components/modifiers/rejection/explanation rather than a magic scalar only.

## Success conditions

- A small highly relevant responsive peer can outrank a huge generic account because relationship/conversation quality dominates raw size.
- Direct responses/follow-ups can outrank comparable cold opportunities.
- Saturation lowers priority but does not independently reject a useful active conversation.
- Missing/no concrete contribution makes the opportunity non-actionable.
- Expired inactive opportunities are non-actionable while active conversations can remain eligible.
- Results are deterministic for the same inputs and expose enough breakdown for later dashboard/bridge use.
- Final commit changes only `engagement.js`.

## Verification intent

Use focused pure-function smoke scripts to demonstrate:

- freshness boundaries;
- contribution archetype/strength behavior;
- priority weights/modifiers;
- soft saturation versus active-conversation override;
- rejection conditions;
- expiry classes;
- ranking where a high-fit responsive peer beats a generic high-reach source.

Run `node --check engagement.js` and `git diff --check` near completion. Do not create tests or mutate live application/X state.

## Out of scope

- queue schema/CRUD;
- authenticated target timeline reads or response detection;
- relationship-event writes;
- Engage Next dashboard/bridge;
- reply draft storage or sending;
- automation refresh;
- Account Health;
- content-quality/publishing work;
- docs synchronization beyond the finish report.

## Working style

Explore current contracts first, then implement the smallest pure owner that satisfies the plan. Do not create abstractions for future integration. Status/progress/compatible steering does not terminate the mission; continue until the success conditions are freshly verified or explicitly stopped/replaced.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commit;
3. exact public exports added by `engagement.js`;
4. concise behavior summary;
5. checks actually run and results;
6. any assumptions the Phase-1C integration session must supply as inputs;
7. unresolved risks/deviations;
8. explicit confirmation that only `engagement.js` changed.
