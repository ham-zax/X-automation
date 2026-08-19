# Phase 1C Engage Next Implementation Plan

**Goal:** Turn relationship intelligence into a human-reviewed, freshness-aware engagement workflow that surfaces the best current technical conversations, drafts one useful contribution, follows up on responses, and records relationship outcomes.

**Architecture:** Reuse Phase-1 `queue_items` rather than creating a second queue table. Engagement items use `lane = engagement` and `pipeline = reply`; `engagement.js` owns discovery, per-post opportunity scoring, expiry, and follow-up prioritization. Relationship history remains owned by `relationship.js`/`relationship_events`. Outbound replies remain one-by-one human decisions rather than daemon-driven unsolicited automation.

**Tech Stack:** Node.js 24, built-in `node:sqlite`, existing authenticated X read path, `queue_items`, `relationship.js`, `store.js`, `strategy.js`, `agent_bridge.js`, Bootstrap dashboard.

## Global Constraints

- Requires Phase 1 queue ownership and Phase 1B relationship intelligence.
- Engagement items are not main-feed scheduler items and do not consume ordinary original/quote slots.
- The daemon may discover/rank opportunities but may not batch-send unsolicited replies.
- A reply cannot enter review without a concrete contribution statement.
- Responses to existing conversations outrank new cold opportunities when both are useful.
- One source tweet may have at most one active initial-reply item per account.
- Reply freshness/visibility is an empirical variable; use transparent heuristics and preserve raw observations.
- No tests are authorized by this plan.

## File Responsibility Map

### Create

- `engagement.js` — opportunity discovery, per-post scoring, contribution qualification, expiry, and follow-up state.

### Modify

- `store.js` — engagement-specific queue fields/queries if not already covered by Phase 1 schema.
- `tech_news.js` or existing authenticated X read owner — bounded reads for target recent posts / replies to our content.
- `relationship.js` — consume completed engagement events, not discovery logic.
- `dashboard.js` — Engage Next / Active Conversations views.
- `agent_bridge.js` — engage-next, engage-draft, engage-resolve commands.
- `automation.js` — refresh opportunities only; no autonomous reply sends.

---

## Queue Contract

Engagement items use existing `queue_items` with:

```text
lane = engagement
pipeline = reply
```

Required fields:

```text
candidate_key
target_username
target_tweet_id
status
priority
urgency
conversation_potential
relationship_potential
routing_reason
expires_at
draft_id or reply_text field depending Phase-2 storage migration
```

If Phase-1 queue schema does not yet include the following, add them here:

```text
engagement_kind TEXT DEFAULT 'initial_reply'
parent_our_tweet_id TEXT
contribution_summary TEXT
reply_archetype TEXT
```

Allowed `engagement_kind`:

```text
initial_reply
follow_up
own_post_response
```

---

## Engagement States

Use queue status values already owned by `pipeline.js` where possible.

Engagement flow:

```text
triage
-> drafting
-> needs_review
-> approved
-> publishing
-> published
```

For this lane, `approved` means the human approved that exact reply for immediate send; there is no normal scheduler wait.

Additional terminal states:

```text
ignored
expired
failed
```

After successful send, relationship events track whether the conversation continues.

---

## Discovery Sources

### 1. Active conversation responses

Highest priority.

Find new replies to:

- our main-feed posts;
- our previously sent replies;
- our quote posts when the source author responds.

If the response is from an existing relationship target or a highly relevant new account, create `follow_up` or `own_post_response` item.

### 2. Relationship target recent posts

For high TargetScore accounts:

- fetch recent posts within a configurable freshness window;
- classify topic;
- reject posts already acted on;
- reject weak niche fit;
- calculate per-post opportunity scores.

### 3. Research candidates best suited to reply

If route recommendation says reply and author relationship context is meaningful, create an engagement item from the existing candidate.

---

## Per-Post Opportunity Inputs

### ConversationPotential

Use Phase-1 opportunity score, refreshed with source-post context.

### RelationshipPotential

Use the relationship profile score, plus recent interaction evidence.

### Freshness

Initial piecewise score:

```text
0-5m     100
5-15m     95
15-30m    85
30-60m    70
1-2h      50
2-6h      30
6h+       10
```

This is an initial heuristic only and must be tagged `EMPIRICAL_VARIABLE` in explanations.

For slow technical conversations, `engagement.js` may preserve a higher effective freshness when the author is still actively replying.

### ReplyVisibility

Per-post score derived from:

```text
post age
reply count
reply velocity
author response activity
conversation depth
saturation
```

Starting heuristic:

```text
base = profile.replyVisibility
- bounded saturation modifier
- age penalty
+ active-author-response boost
+ active-bidirectional-conversation boost
```

Saturation is `EMPIRICAL_VARIABLE` and advisory. It must not independently reject an opportunity. Phase 1D replaces the simple modifier with explainable `SaturationPressure` and active-conversation overrides.

Return component explanation.

### ContributionStrength

Before drafting, the system must identify one proposed contribution archetype:

```text
implementation_detail
benchmark_or_result
caveat_or_edge_case
comparison
correction
informed_question
synthesis
reproduction
personal_experience
```

Starting score:

```text
100 verified benchmark/result
90  concrete implementation detail
85  specific caveat/edge case
80  useful comparison
80  verified correction
75  informed question with precise context
70  concise synthesis with new implication
<60 reject for Engage Next
```

The score is reduced when evidence/context is weak.

---

## EngagePriority

```text
base =
  0.25 * conversationPotential
+ 0.20 * relationshipPotential
+ 0.20 * targetScore
+ 0.15 * freshness
+ 0.10 * replyVisibility
+ 0.10 * contributionStrength
```

Event modifiers:

```text
direct question to us       +15
target replied to us        +15
active recurring thread     +10
own post substantive reply  +8
soft saturation/repetition  bounded negative modifier
already acted same source with no new value reject
no contribution             reject
exact/near-duplicate reply  reject
expired with no active conversation reject
```

There is no fixed daily reply cap. A burst of substantive replies inside an active bidirectional conversation remains eligible. Phase 1D supplies richer health/repetition modifiers after this phase lands.

Final score is clamped `0..100`.

Return:

```js
{
  engagePriority,
  components,
  modifiers,
  contribution,
  expiresAt,
  explanation,
}
```

---

## Expiry Contract

Initial reply opportunity expiry:

```text
high-velocity viral source     2h advisory freshness target
normal launch/news source      6h advisory freshness target
slow technical discussion     24h advisory freshness target
follow-up direct response      24h or while thread active
own-post substantive response 48h unless clearly stale
```

An active conversation may extend the effective window; the timestamps above are queue-management defaults, not automatic conversation cutoffs.

Expiry is a queue-management heuristic, not an X law.

Expired items are preserved for analytics/history but removed from actionable Engage Next results.

---

## Reply Draft Contract

A reply packet includes:

```text
exact source text
source context/thread if needed
target profile/classes
relationship stage
prior conversation summaries
candidate niche/keywords
proposed contribution archetype
verified facts/evidence
unresolved question if any
```

Draft requirements:

- address the source directly;
- one concrete contribution;
- no generic praise prefix required;
- no invented testing/results;
- no exact/near-copy of another reply;
- repeated archetype or sentence structure should create an editorial warning rather than fail unless the text is genuinely near-duplicate;
- no forced question when a statement is stronger;
- short enough to scan in a thread;
- preserve enough technical specificity to demonstrate competence.

Phase 2's canonical writing/gate engine should eventually own final reply quality. If Phase 1C is implemented before Phase 2, use current drafting facilities only for reviewable text and keep approval explicit.

---

## Conversation Follow-Up Detection

After a reply is published:

1. record `our_reply` relationship event;
2. store `our_tweet_id` and source tweet ID;
3. future refresh checks for target responses;
4. a new target response records `target_reply`;
5. create/refresh `follow_up` engagement item;
6. elevate priority when response contains a direct question or unresolved technical issue.

Do not create multiple follow-up items for the same target response.

---

### Task 1: Add engagement queue persistence fields/queries

**Files:**
- Modify: `store.js`

**Interfaces:**
- Consumes: Phase-1 `queue_items`.
- Produces: engagement-specific reads/upserts without a new queue table.

**Steps:**
- [ ] Add missing engagement fields listed in the Queue Contract only if Phase 1 did not already create them.
- [ ] Add `ensureEngagementItem({ candidateKey, targetUsername, targetTweetId, engagementKind })` idempotent by target/source/kind while active.
- [ ] Add `listEngagementItems({ status, minPriority, includeExpired, limit })`.
- [ ] Add `getActiveEngagementItem(targetTweetId, engagementKind)`.
- [ ] Preserve expired/published history.

**Acceptance criteria:**
- Repeated refreshes do not duplicate one engagement opportunity.

### Task 2: Implement engagement scoring/discovery owner

**Files:**
- Create: `engagement.js`

**Interfaces:**
- Consumes: relationship profile, candidate/source post, existing actions/events.
- Produces: contribution qualification, EngagePriority, expiry, queue item proposal.

**Steps:**
- [ ] Implement freshness heuristic with evidence label `EMPIRICAL_VARIABLE`.
- [ ] Implement per-post ReplyVisibility adjustment with saturation kept as a bounded soft modifier.
- [ ] Implement contribution archetype/strength qualification from supplied context.
- [ ] Implement EngagePriority formula/modifiers.
- [ ] Reject no-contribution, exact/near-duplicate, exhausted same-source, or truly expired/no-active-conversation opportunities.
- [ ] Do not add a daily reply quota; allow active bidirectional conversation to offset ordinary age/saturation pressure.
- [ ] Return transparent explanation.

**Acceptance criteria:**
- A small high-fit responsive peer conversation can outrank a huge generic account solely because network/conversation quality is stronger.

### Task 3: Discover recent posts from relationship targets

**Files:**
- Modify: existing authenticated X read owner (`tech_news.js` unless a more specific current helper already owns profile timeline reads).
- Modify: `engagement.js`

**Interfaces:**
- Consumes: top relationship target usernames.
- Produces: recent source posts with timestamps/metrics/text/URL.

**Steps:**
- [ ] Reuse the existing authenticated browser/read session pattern rather than adding a second browser abstraction.
- [ ] Fetch bounded recent posts for a supplied list of target usernames.
- [ ] Exclude obvious repost-only items when there is no reply context to add.
- [ ] Pass candidates to engagement scoring and persist only qualifying opportunities.

**Acceptance criteria:**
- One refresh can populate Engage Next from current high-value target posts without creating duplicate candidate/action records.

### Task 4: Detect responses to our existing conversations

**Files:**
- Modify: authenticated X read owner.
- Modify: `engagement.js`
- Modify: `relationship.js`

**Interfaces:**
- Consumes: recent our-tweet IDs from candidate actions/published drafts and relationship events.
- Produces: new target-response events and follow-up queue items.

**Steps:**
- [ ] Identify replies to our recent posts/replies using the narrowest existing authenticated read path.
- [ ] De-duplicate target responses by source response tweet ID in relationship-event metadata.
- [ ] Record `target_reply` or other supported response event.
- [ ] Create `follow_up` item when a concrete response is warranted.

**Acceptance criteria:**
- A target reply reappears as a higher-priority follow-up instead of being lost after our initial reply.

### Task 5: Add Engage Next dashboard

**Files:**
- Modify: `dashboard.js`

**Interfaces:**
- Consumes: actionable engagement items + relationship context.
- Produces: operator workbench.

**Steps:**
- [ ] Add `Engage Next` navigation.
- [ ] Separate `Active conversations` from `New opportunities`.
- [ ] Show target classes, TargetScore, relationship stage, Conversation/Relationship Potential, age, expiry, and EngagePriority.
- [ ] Show soft saturation/repetition warnings without removing the human approve path unless a true hard stop exists.
- [ ] Show exact source post and contribution summary.
- [ ] Add actions: `Draft reply`, `Quote instead`, `Ignore`.
- [ ] When draft exists, show editable reply text and explicit `Approve & send` control.
- [ ] Do not include any batch-send control.

**Acceptance criteria:**
- The user can work through engagement opportunities one by one with enough context to understand why each is prioritized.

### Task 6: Add human-reviewed send path

**Files:**
- Modify: `dashboard.js`
- Modify: `agent_bridge.js`
- Reuse: existing reply-capable publication transport only when the user explicitly approves the exact reply.

**Interfaces:**
- Produces commands:
  - `engage-next`
  - `engage-draft`
  - `engage-resolve`

**Steps:**
- [ ] `engage-next` returns ranked actionable items.
- [ ] `engage-draft` stores/updates reviewable reply text but does not send.
- [ ] `engage-resolve` supports `ignore`, `expire`, and an explicit approved-send action.
- [ ] On successful send, record queue publication result, candidate action if applicable, and `our_reply` relationship event.
- [ ] On transport failure, keep item recoverable as `failed`/reviewable instead of duplicating send attempts silently.

**Acceptance criteria:**
- Each outbound reply requires a specific approval action and is recorded once with tweet ID/event history.

### Task 7: Refresh engagement opportunities from automation

**Files:**
- Modify: `automation.js`

**Interfaces:**
- Consumes: relationship targets and current interaction history.
- Produces: refreshed queue only.

**Steps:**
- [ ] Add engagement discovery refresh after normal research refresh.
- [ ] Refresh active conversation responses before cold opportunities.
- [ ] Expire stale items.
- [ ] Log top opportunity summary.
- [ ] Do not send any engagement item from the normal daemon cycle.

**Acceptance criteria:**
- Automation can keep Engage Next fresh while outbound reply execution remains human-triggered.

### Task 8: Synchronize documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/AGENT_WORKFLOW.md`
- Modify: `docs/RELATIONSHIP_INTELLIGENCE.md`
- Modify: `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`

**Acceptance criteria:**
- Implemented Engage Next commands/UI are documented as current; later measurement/experiment features remain planned.

---

## Phase 1C Completion Criteria

Phase 1C is complete when:

1. relevant target posts can create engagement queue items;
2. each item explains its network/conversation value;
3. responses to us become higher-priority follow-up items;
4. no useful contribution means no actionable item;
5. the user can draft/approve/send one reply at a time;
6. every successful reply becomes relationship history;
7. the daemon refreshes but does not autonomously spray replies;
8. engagement outcomes are ready for later measurement/experiments.