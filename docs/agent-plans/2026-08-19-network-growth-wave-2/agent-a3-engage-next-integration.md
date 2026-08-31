# Agent A3 — Engage Next Full Integration

**Repository:** `/home/hamza/repo/x_test`  
**Artifact type:** executable/mixed  
**Workspace:** `/home/hamza/repo/x_test-w2-engagement` on branch `agent/w2-engage-next-integration`  
**Isolation reason:** concurrent writable mission; this branch owns the remaining shared Phase-1C vertical while Agent B2 owns only `scheduler.js`  
**Can start:** immediately after the assigned worktree is reset to the coordination base  
**Depends on:** integrated Phase 1A, Phase 1B, full Phase 2, Engage Next Core, and target timeline reader (`aa08ddc`)  
**Execution lifetime:** Persistent Agent Loop required  
**Wake strategy:** no artificial timer; use event waits only for real persistent/external blockers  
**Developer visibility:** headless by default

## Read first

- `docs/plans/PHASE_1C_ENGAGE_NEXT.md` — authoritative Phase-1C requirements.
- `docs/RELATIONSHIP_INTELLIGENCE.md` — target/event/stage semantics.
- `docs/agent-plans/2026-08-19-network-growth-wave-2/README.md` — current ownership and concurrency boundaries.
- `AGENTS.md` and `docs/AGENT_WORKFLOW.md` — current workflow/human-approval invariants.
- `engagement.js` — integrated EngagePriority/contribution/expiry core.
- `tech_news.js` — integrated `fetchXTargetRecentPosts(...)` adapter.
- `relationship.js`, `store.js`, `pipeline.js`, `drafting.js`, `agent_bridge.js`, `dashboard.js`, `automation.js`, `x_http.js` — current owners/interfaces to integrate rather than replace.

Before source mutation, use **Causal Coding**. Use **Persistent Agent Loop** for execution lifetime. Do not create or run tests unless independently mandated by repository rules; the current plans do not authorize tests.

## Objective

Complete Phase 1C as a coherent human-reviewed engagement vertical. Persist and rank actionable reply opportunities, prioritize active responses over cold opportunities, discover high-value target posts through the existing bounded reader, turn concrete contributions into reviewable Phase-2 reply drafts, surface Engage Next and Active Conversations, refresh opportunities without sending autonomously, and send exactly one approved reply only after an explicit human action while recording queue/action/relationship history.

## Current state

- `engagement.js` already owns contribution qualification, freshness, ReplyVisibility, expiry, EngagePriority, hard rejection reasons, ranking, and queue proposals.
- `fetchXTargetRecentPosts(...)` already provides bounded normalized recent posts for supplied relationship-target usernames.
- Phase 2 already persists editor/gate/thread metadata and exposes writer packets/structured output through `pipeline.js`.
- `x_http.js` already delegates to XActions `postTweet(..., { replyTo })`; do not create a second posting client.
- Agent B2 is concurrently working only in `scheduler.js`. Do not modify that file.

## Ownership

You own the remaining Phase-1C vertical, including the smallest necessary changes in:

- `store.js` — engagement queue fields, idempotent engagement item creation/read/update, active/history queries;
- `engagement.js` — orchestration helpers only if the pure core needs narrow composition around already-exported scoring;
- `tech_news.js` — bounded response/conversation reads when needed, reusing installed XActions facilities;
- `relationship.js` — only Phase-1C event aggregation or response de-duplication needed by completed engagement actions;
- `pipeline.js` — engagement-lane review/approval semantics only where Phase-2 main-feed assumptions need a narrow compatible extension;
- `agent_bridge.js` — `engage-next`, `engage-draft`, and `engage-resolve`;
- `dashboard.js` — Engage Next and Active Conversations workbench;
- `automation.js` — refresh/expire/log engagement opportunities only, never send;
- `x_http.js` — only if a narrow explicit reply helper/wrapper is required; reuse existing `postTweetHttp(..., { replyTo })` behavior;
- required current-behavior documentation synchronization after behavior exists.

Agent B2 owns `scheduler.js` exclusively.

## Coordination contract

- Do **not** modify `scheduler.js`.
- Keep `pipeline.js` the workflow/human-approval owner; writer output cannot approve or send.
- Keep `relationship.js` the relationship profile/event owner; do not duplicate TargetScore/stage formulas in engagement code.
- Keep `drafting.js` the reply text/gate owner; use Phase-2 packet/output/gate interfaces rather than creating a second reply-quality engine.
- Keep `engagement.js` the EngagePriority/contribution/freshness/expiry owner; persistence/UI code must consume its explanations rather than reimplementing the formula.
- Reuse `fetchXTargetRecentPosts(...)` for target timelines. Do not create another target reader.
- No daemon/automation path may send a reply.
- No batch-send action exists. Every outbound reply requires explicit human approval of the exact text and one explicit send action.
- No random timing/jitter or detector-evasion machinery.
- Do not implement Account Health, scheduler integration, media upload, experiments, learning, or follower automation.

## Required behavior

### Engagement persistence

Reuse `queue_items` with `lane = engagement` and `pipeline = reply`. Add only Phase-1C fields missing from the current schema, including target/source/kind/priority/expiry/contribution/archetype context. Preserve main-feed queue behavior.

Provide idempotent active-item semantics so repeated refreshes cannot duplicate the same target tweet / engagement kind while the opportunity is active. Preserve ignored/expired/published/failed history.

Important expiry contract: use `engagement.js`'s `expiry.effectiveExpired` / `activeConversationOverride`; do not blindly treat `expiresAt < now` as a hard rejection during an active conversation.

### Opportunity refresh

Refresh in this order:

1. responses to our existing posts/replies/quotes when observable;
2. recent posts from high-value relationship targets;
3. existing research candidates whose route/context make reply the best action.

Pass caller-observed inputs into `scoreEngagementOpportunity`/`rankEngagementOpportunities`; do not invent unavailable graph signals. Contribution summary/archetype must be concrete before an item becomes actionable.

### Response/follow-up history

When a new relevant response to us is observed, de-duplicate it by response tweet ID, record the appropriate relationship event, and create/refresh a `follow_up` or `own_post_response` item when there is a concrete contribution to make. Active responses should outrank comparable cold opportunities.

Do not manufacture `target_reply` evidence from mere reply counts; only record an event for an actually observed response.

### Reviewable reply drafting

Use the existing Phase-2 reply route/writer/gate workflow. `engage-draft` may create/update reviewable reply text and move it toward `needs_review`, but it cannot self-approve or send through the human-reviewed path.

If the existing Phase-2 main-feed approval function intentionally excludes `reply`, add the smallest engagement-specific approval transition at the workflow owner rather than weakening main-feed semantics.

### Engage Next workbench

Add `Engage Next` with two clear groups:

- active conversations / responses to us;
- new opportunities.

Each actionable card should expose enough explanation to audit the recommendation: target, target classes, TargetScore, relationship stage, Conversation/Relationship Potential, source age, expiry/effective-expiry state, EngagePriority, contribution archetype/summary, relevant warnings/rejection state, exact source text, and current draft/review state.

Operator actions should remain one-item-at-a-time: Draft/Edit reply, review/request approval, explicit Approve & Send, Ignore/Expire, and Quote Instead when appropriate. Do not add a batch action.

### Explicit send path

`engage-resolve`/dashboard send must require an already human-approved exact reply. Immediately before transport, verify the current draft/text still matches the approved state so edited content cannot inherit approval.

Use the existing XActions HTTP transport's reply option (`postTweetHttp(text, credentials, { replyTo: targetTweetId })`) or an equivalent existing wrapper. Do not add a second write transport.

On success, record exactly once:

- queue item terminal/publication state and returned tweet ID/URL when available;
- candidate action where a candidate exists;
- `our_reply` relationship event with target/source/our-tweet context and reply archetype metadata.

On transport failure, keep the item recoverable/inspectable as failed/reviewable; do not silently retry within the same action.

### Automation

The daemon may refresh active responses first, then cold opportunities, expire stale inactive items, and log a concise top-opportunity summary. It must never call the engagement send path.

## Success conditions

- Repeated opportunity refresh is idempotent for one source/kind while active.
- Active target responses/follow-ups rank ahead of comparable cold items.
- No concrete contribution means no actionable Engage Next item.
- Active conversations remain actionable when advisory `expiresAt` passed but `effectiveExpired` is false.
- Dashboard/bridge can inspect and edit one reply at a time with relationship/scoring context.
- A bridge/AI command cannot self-approve or send an unapproved reply.
- Only an explicit human action can send the exact approved reply.
- A successful reply is recorded once in queue/action/relationship history and can seed later follow-up detection.
- Automation refreshes but never sends.
- Existing Phase-1A/1B/Phase-2 main-feed behavior remains intact.

## Verification intent

Use the smallest direct non-test evidence capable of disproving the affected contracts:

- isolated temporary SQLite migration/idempotency smoke for engagement fields/items/history;
- controlled pure/stubbed discovery smoke that does not make live X writes;
- bridge/dashboard import/parse checks;
- explicit approval-boundary smoke proving draft/update commands cannot send and edited text invalidates approval;
- mocked/stubbed transport smoke proving the explicit send path maps the correct `replyTo` tweet ID and records success/failure once without calling live X;
- automation smoke proving refresh code contains no send execution;
- `node --check` on changed JS and `git diff --check` near completion.

Do not create test files or run broad suites. Do not mutate live X state as verification.

## Out of scope

- `scheduler.js` / main-feed Phase-3 scheduling;
- Account Health / Under the Hood;
- experiments/measurement/learning;
- media upload;
- arbitrary refactors/cleanup outside the Phase-1C causal path.

## Working style

Inspect current combined code before choosing implementation details. Prefer existing owners and installed XActions APIs over new abstractions. Keep the change coherent and compatibility-preserving. Status/progress/compatible steering does not terminate the mission; continue until success conditions are freshly verified or explicitly stopped/replaced.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commit(s);
3. schema/interfaces/UI/automation/send behavior added;
4. exact human-approval/send boundary and how edit invalidation is enforced;
5. checks actually run and results;
6. any current XActions/read-path assumptions;
7. integration notes for Phase 1D and Phase 3;
8. unresolved risks/deviations;
9. explicit confirmation that `scheduler.js` was not modified and no live X write was used for verification.
