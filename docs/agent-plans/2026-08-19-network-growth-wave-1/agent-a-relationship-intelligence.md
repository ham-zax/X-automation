# Agent A — Relationship Intelligence

**Repository:** `/home/hamza/repo/x_test`  
**Artifact type:** executable/mixed  
**Workspace:** `/home/hamza/repo/x_test-w1-relationship` on branch `agent/w1-relationship-intelligence`  
**Isolation reason:** concurrent writable mission; this branch owns relationship persistence, audience integration, dashboard/bridge relationship surfaces  
**Can start:** immediately after assigned worktree exists  
**Depends on:** Phase 1A commit `7ccdb7c` and the coordination package  
**Execution lifetime:** Persistent Agent Loop required  
**Wake strategy:** no artificial timer; use event waits only if a real persistent process/external condition blocks progress  
**Developer visibility:** headless by default; passive presentation only on request

## Read first

- `docs/plans/PHASE_1B_RELATIONSHIP_INTELLIGENCE.md` — authoritative mission requirements.
- `docs/RELATIONSHIP_INTELLIGENCE.md` — domain model, TargetScore, stages, events, and semantics.
- `docs/agent-plans/2026-08-19-network-growth-wave-1/README.md` — coordination boundaries and neighboring ownership.
- `AGENTS.md` — repository invariants and current Phase 1A workflow.
- `pipeline.js`, `opportunity.js`, `store.js`, `audience.js` — current contracts you must integrate with rather than replace.

Before the first source mutation, load and follow **Causal Coding**. Use **Persistent Agent Loop** for execution lifetime. Do not create or run tests unless the repository itself independently mandates them; the current phase plan does not authorize tests.

## Objective

Implement Phase 1B Relationship Intelligence as a coherent vertical slice on top of the landed Phase 1A workflow. The system should persist strategic relationship profiles and append-only relationship events, derive target classes/TargetScore/relationship stage from observable evidence, refresh those profiles from existing audience state, and expose relationship inspection through the current dashboard/agent bridge without moving engagement discovery or Account Health into this mission.

## Current state

Phase 1A is implemented. `queue_items`, `pipeline.js`, four-dimensional opportunity scoring, Save→Triage, routing, `needs_review`, and the human approval boundary already exist. Existing `audience_profiles` remains raw follower/following/relevance observation and must stay separate from strategic relationship state.

The neighboring content agent is concurrently modifying only `drafting.js`. Treat that file as externally owned for this wave.

## Ownership

You own:

- `relationship.js` and the Phase-1B domain behavior described by the authoritative plan;
- relationship profile/event persistence additions in `store.js`;
- feeding current `audience_profiles` observations into strategic relationship refresh in `audience.js`;
- relationship read surfaces in `dashboard.js` and `agent_bridge.js`;
- Phase-1B documentation synchronization required by the source plan;
- focused non-test verification for these behaviors.

Neighboring mission owns:

- `drafting.js` format-aware composition, writer packet, structured writer-output application, and deterministic content gate core.

The orchestrator owns later cross-branch integration and future Phase 1C/1D/Phase 2 integration.

## Coordination contract

Preserve these stable boundaries:

- `pipeline.js` remains the workflow mutation/human-approval owner. Do not move relationship workflow transitions into `relationship.js`.
- `opportunity.js` remains the four-dimensional candidate-score owner. Relationship Intelligence may supply richer relationship context later, but do not duplicate the Reach/Follow/Conversation formulas.
- `audience_profiles` remains raw observation. Strategic classification/stage/history belongs in new relationship persistence.
- Relationship events are append-only evidence; stage/materialized counters may be recomputed from them and current follow state.
- Do not modify `drafting.js` in this branch. If its current interface genuinely blocks Phase 1B correctness, report the conflict instead of absorbing the neighboring mission.
- Do not implement Engage Next discovery, reply drafting/sending, Account Health, scheduler, experiments, or learning.

If a public/shared contract must change beyond the Phase-1B plan, keep the smallest compatibility-preserving change and call it out explicitly in the finish report.

## Success conditions

- The database can add Phase-1B relationship profile/event persistence without losing existing candidate/draft/audience data.
- Relevant accounts can be classified into the documented target classes with explainable components and TargetScore; follower count remains only the bounded reach modifier defined by the plan.
- Relationship stages derive from observable event/follow history using the documented progression rather than guessed identity/intent.
- Audience sync can refresh strategic relationship profiles while preserving prior append-only interaction history.
- Dashboard can inspect relationship targets/stages/components without replacing the existing Audience view or Phase-1A Queue behavior.
- Agent bridge exposes the planned relationship read interfaces and does not create an approval or engagement-send bypass.
- Existing Phase-1A Save/Triage/routing/approval contracts remain intact.
- Phase-1B operating docs are synchronized so later sessions do not mistake Relationship Intelligence for Engage Next or Account Health.

## Verification intent

Use direct evidence to prove the actual contracts affected:

- schema initialization/persistence can represent profiles/events on an existing-style database without destructive reset;
- deterministic target scoring/stage derivation returns explainable outputs from controlled input;
- audience refresh preserves prior relationship-event evidence;
- bridge/dashboard imports and changed JS parse successfully;
- final diff stays inside Phase 1B ownership and passes whitespace/diff checks.

Do not add or run a test suite merely for confidence. Do not mutate the user's live X relationships or send X actions as verification.

## Out of scope

- `drafting.js` and Phase-2 content engine work;
- Engage Next / recent target-post discovery / active conversation queue;
- outbound reply sending;
- Account Health / Under the Hood;
- scheduler/publisher changes;
- experiments, follower-conversion analytics, learned strategy;
- arbitrary cleanup or refactors unrelated to the Phase-1B causal path.

## Working style

Explore the current repository before deciding implementation details. Follow repository conventions and current code over stale assumptions. Use the shortest causal path through the true owners. Prefer built-in Node/SQLite facilities and existing helpers. Keep one authoritative owner for each mutable state collection.

Persistent-loop steering rule: status/progress requests or compatible side context do not terminate the mission. Continue until success conditions are freshly verified, the user explicitly stops/replaces the mission, or continuation becomes impossible/unsafe after checkpointing recoverable state.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commits created;
3. concise behavior/interface/schema summary;
4. checks actually run, results, and why they were relevant;
5. any contract changes the integration session must reconcile;
6. unresolved risks, deviations, or blockers;
7. explicit confirmation that `drafting.js` and neighboring Phase-2 work were not absorbed.
