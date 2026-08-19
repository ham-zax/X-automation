# Agent B3 — Phase 3 Distribution Integration

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable/mixed
**Workspace:** `/home/hamza/repo/x_test-w2-content-integration` on branch `agent/w3-phase3-distribution-integration`
**Isolation reason:** concurrent writer; this mission owns Phase-3 persistence/orchestration/transport/UI/bridge surfaces while Agent A4 owns only `health.js`
**Can start:** immediately after assigned branch is reset to the Wave-3 coordination base
**Depends on:** full Phase 2 content workflow + integrated `scheduler.js` core
**Execution lifetime:** Persistent Agent Loop required
**Wake strategy:** no artificial timer; use event wait only for a real persistent/external blocker
**Developer visibility:** headless by default

## Read first

- `docs/plans/PHASE_3_DISTRIBUTION_SCHEDULER.md` — authoritative Phase-3 requirements.
- `docs/agent-plans/2026-08-19-network-growth-wave-3/README.md` — parallel ownership boundary.
- `AGENTS.md` and `docs/AGENT_WORKFLOW.md` — approval/publishing invariants.
- `scheduler.js` — already-integrated pure scheduling owner; consume it rather than reimplementing formulas.
- `store.js`, `pipeline.js`, `automation.js`, `x_http.js`, `dashboard.js`, `agent_bridge.js` — current integration surfaces.

Before source mutation, use **Causal Coding**. Use **Persistent Agent Loop** for execution lifetime. Do not create or run tests unless independently mandated by repository rules; current plans do not authorize tests.

## Objective

Complete Phase 3 by making approved main-feed queue state the authoritative publication source, wiring the integrated scheduler core into persistent scheduling/claim semantics, publishing Original/Quote/Thread through the existing HTTP transport owner, exposing scheduler reasoning/override in dashboard and bridge, and preserving `AUTO_POST=false` preview behavior.

Engagement replies remain outside this scheduler and retain the Phase-1C one-item explicit human approval/send boundary.

## Ownership

You own:

- `store.js` Phase-3 scheduling, claim, success/failure persistence;
- `automation.js` migration from legacy ready-draft FIFO to queue/scheduler selection;
- `x_http.js` project-level format-aware main-feed publish helper using existing client/session logic;
- `dashboard.js` scheduler reasoning and explicit human scheduling override;
- `agent_bridge.js` read-only schedule inspection commands;
- `pipeline.js` only if a concrete Phase-3 compatibility defect requires a small adjustment;
- Phase-3 docs synchronization after behavior exists;
- focused non-test verification with temporary state and mocked/injected transport.

Agent A4 concurrently owns only `health.js`.

## Coordination contract

- Do not modify `health.js`, `engagement.js`, `relationship.js`, `tech_news.js`, `drafting.js`, or Account Health behavior.
- Treat `scheduler.js` as the pure scheduling decision owner. Modify it only if integration exposes a concrete correctness defect; otherwise report any mismatch rather than duplicating logic elsewhere.
- Preserve the existing Phase-1/2 human approval boundary. Scheduling/bridge commands cannot approve content.
- Engagement-lane replies are excluded from the main-feed scheduler and from normal daemon publication.
- Preserve `AUTO_POST=false` as preview-only. Do not silently enable it.
- Before any enabled main-feed transport call, atomically claim the queue item.
- Never silently retry a failed publication in the same cycle.
- Use the existing `x_http.js` client/session/CreateTweet discovery path; do not add a second posting stack.
- Original/Quote/Thread are the required automated main-feed formats. Repost remains manual unless an already-supported stable existing transport path can be reused without widening scope.
- Required media remains blocked unless a real attachment/upload readiness path already exists. Do not implement fake media readiness or a checkbox bypass.
- Do not add random jitter, human-mimic delays, anti-detection timing, or fake minimum posting intervals.
- Do not add autonomous engagement sends, likes, follow/unfollow automation, batch replies, or keyword auto-replies.

## Required behavior

### Persistence / atomic claim

Extend `queue_items` only with fields required by the source plan and not already present, including publication start/error/published timestamps where needed. Provide:

- approved main-feed item listing for scheduler input;
- atomic claim from schedulable state to `publishing`;
- mark published with tweet ID/output URL;
- mark failed with inspectable failure reason;
- human scheduling override persistence with clear provenance/semantics.

Two overlapping cycles must not successfully claim the same item.

### Scheduler orchestration

`automation.js` must stop using `getNextReadyDraft` as publication authority. It should:

1. retain research and Phase-1C engagement-refresh ownership;
2. ask the scheduler for the next approved main-feed recommendation;
3. preview the recommendation when `AUTO_POST=false` without claiming/sending;
4. when enabled, claim the exact queue item atomically before transport;
5. publish only the claimed item's approved format/content;
6. persist success/failure plus candidate action metadata exactly once.

The scheduler's spacing/urgency/expiry reasoning remains editorial/empirical, not an anti-flag system.

### Format-aware transport

Provide one project-level main-feed publish helper in `x_http.js` that maps:

- Original → existing `postTweetHttp` shape;
- Quote → existing tweet transport with `quoteTweetId` from the source candidate;
- Thread → existing `postThreadHttp(threadParts)` shape.

Preserve current authentication/CreateTweet discovery ownership. Return canonical identifiers/URLs needed by persistence/action history.

Do not add media upload unless an actual current upload contract already exists and is explicitly required by the source plan. If a draft's Phase-2 media plan says required and real readiness is absent, it remains unschedulable/unpublishable.

### Dashboard / bridge

Dashboard should show for approved main-feed items:

- scheduler recommendation time;
- transparent reason/priority;
- blockers such as coverage spacing, semantic conflict, expiry;
- explicit concrete human schedule override separate from approval.

Bridge commands:

- `schedule-next`
- `schedule-inspect`

These inspect/recommend only and cannot approve or publish.

## Success conditions

- Approved main-feed `queue_items`, not legacy `draft.status=ready` FIFO, own automatic publication selection.
- Engagement lane is never consumed by the main-feed scheduler.
- Two cycles cannot claim one queue item simultaneously.
- `AUTO_POST=false` performs no publication claim/write and only previews/explains the recommendation.
- Enabled publication claims first and records exactly one success or one recoverable failure.
- Original, Quote, and Thread invoke the correct existing transport shape.
- Quote uses the correct source tweet ID; Thread publishes its approved thread parts as one scheduled main-feed unit.
- Failed sends remain inspectable and are not silently retried in the same cycle.
- Schedule override is explicit, independent of approval, and cannot override hard expiry/gate failure.
- Scheduler explanations preserve `EMPIRICAL_VARIABLE` timing semantics; no anti-detection/random timing behavior exists.
- Required proof-media cannot be silently bypassed.

## Verification intent

Use direct non-live evidence only:

- disposable SQLite migration/claim smoke proving one-winner atomic claim and preserved existing rows;
- mocked/injected transport smoke for Original, Quote, and Thread mapping with exact IDs/options;
- `AUTO_POST=false` preview smoke proving zero transport calls/claims;
- enabled orchestration smoke proving claim-before-send, one success bookkeeping path, and recoverable failure behavior;
- engagement-lane exclusion;
- dashboard/bridge import/parse and inspection smoke;
- `node --check` on changed JS and `git diff --check` near completion.

Do not create test files or perform live X writes merely for verification.

## Out of scope

- Account Health / `health.js`;
- measurement/experiments or learned strategy;
- media upload infrastructure not already present;
- engagement reply scheduling/sending changes;
- automated repost implementation if no current stable transport path exists;
- unrelated transport refactors or new HTTP clients;
- browser-evasion or detection-avoidance machinery.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commit;
3. schema/interfaces/commands/UI behavior implemented;
4. exact publication authority/claim/send state machine;
5. format transport mapping and media limitation;
6. checks actually run and results;
7. integration notes for Phase 1D/4;
8. unresolved risks/deviations;
9. explicit protected-file confirmation, especially `health.js`/`engagement.js`/`relationship.js`.
