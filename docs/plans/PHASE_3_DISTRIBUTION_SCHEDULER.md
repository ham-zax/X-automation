# Phase 3 Distribution Scheduler Implementation Plan

**Goal:** Replace draft-only cooldown publishing with a queue-aware scheduler that serializes original/quote/thread/repost items, handles urgency and expiry, explains timing decisions, and publishes the correct format exactly once after human approval.

**Architecture:** `scheduler.js` owns publication eligibility/order/time. `pipeline.js` owns whether a format is a main-feed item and which preconditions it requires. `automation.js` becomes an orchestrator that asks the scheduler for the next eligible approved item and delegates publication to `x_http.js`. Relationship/engagement replies remain outside the main-feed scheduler.

**Tech Stack:** Node.js 24, built-in SQLite, existing `queue_items`, `drafting.js`, `x_http.js`, `postThreadHttp`, Bootstrap dashboard.

## Global Constraints

- Requires Phase 1 queue/human approval and Phase 2 format-aware drafting/gates.
- Main-feed writes are serialized.
- Viral/timely items may pre-empt evergreen order but do not bypass remaining gates or human approval.
- Scheduling optimizes coverage/freshness; it does not introduce fake-human randomness or detection-evasion timing.
- Initial time windows are empirical heuristics and must be tagged accordingly.
- Repost is rare and still requires explicit human approval.
- Engagement replies are not consumed by this scheduler.
- No tests are authorized by this plan.

## File Responsibility Map

### Create

- `scheduler.js` — eligibility, priority, expiry, semantic conflict, timing slot, and explanation.

### Modify

- `store.js` — queue scheduling/publish-lock fields/queries.
- `pipeline.js` — main-feed vs engagement requirements and format publication mapping.
- `automation.js` — scheduler-driven orchestration.
- `x_http.js` — quote/thread/media-aware publish helpers using existing transport.
- `dashboard.js` — schedule explanation/override visibility.
- `agent_bridge.js` — schedule inspection/approval reads.

---

## Scheduler Inputs

Each main-feed queue item provides:

```text
id
candidate_key
pipeline
status
priority
urgency
reach_potential
follow_potential
conversation_potential
relationship_potential
quality_score
expires_at
human_approved_at
scheduled_at
media_plan
experiment_variant_id
```

Scheduler context:

```text
last_main_feed_post_at
recent_published_topics
recent_published_semantic_anchors
current_time
historical_timing_summary (later phase; optional)
```

---

## Eligibility

A queue item is schedulable only when:

```text
lane = main_feed
status = approved
human_approved_at != null
pipeline in original|quote|thread|repost
all required hard gates pass
not expired
not already published
```

For original/quote/thread, associated draft content must be exact final approved content.

---

## Initial Urgency

```text
evergreen
timely
viral
```

### Evergreen

Useful after the current day/topic cycle.

### Timely

Value decays within roughly 24 hours.

### Viral

Source/topic is rapidly accelerating and commentary value decays quickly.

Urgency is a project classification, not a hidden X label.

---

## Initial Main-Feed Spacing Heuristics

Tag these `EMPIRICAL_VARIABLE`.

```text
ordinary separation target  ~3h
evergreen preferred gap     4-6h
viral hard floor             none inferred from public evidence
```

These are coverage defaults, not enforcement thresholds.

For ordinary/evergreen items, the scheduler should normally preserve spacing to reduce self-cannibalization. For an approved viral item whose shelf-life is short, the scheduler may recommend immediate publication even when the previous main-feed item is recent, provided writes remain serialized and the operator sees the overlap warning.

The scheduler must consider:

- source expiry;
- semantic similarity to the last post;
- current item strength;
- whether the previous post is still accelerating when observable;
- time since the last main-feed write as a coverage signal, not a bot-risk threshold;
- explicit human schedule override.

Do not add random delay/jitter or a fake minimum interval whose purpose is to look human.

---

## Priority Model

Base queue priority:

```text
0.30 * followPotential
+ 0.25 * reachPotential
+ 0.15 * conversationPotential
+ 0.10 * relationshipPotential
+ 0.20 * qualityNormalized
```

Then urgency modifiers:

```text
viral +15
timely +7
evergreen +0
```

Expiry pressure:

```text
<=1h remaining +15
<=3h remaining +10
<=6h remaining +5
expired reject
```

This is internal editorial prioritization, not X scoring.

---

## Semantic Conflict Rule

Before scheduling, compare the item against recent main-feed posts using existing token/topic primitives first.

If semantic/topic overlap is high:

- prefer the stronger item;
- delay the weaker item when still useful;
- expire/drop the weaker item if delay makes it stale;
- allow override when the second post is an intentional continuation/thread.

Do not add embedding infrastructure until existing text/topic similarity proves insufficient.

---

## Scheduling Decision Output

`scheduler.js` returns:

```js
{
  item,
  eligible,
  recommendedAt,
  reason,
  priority,
  blockers: [],
  empiricalAssumptions: [],
}
```

Example reason:

> Viral quote approved 38m ago; previous main-feed post is 2h04m old, above emergency floor; source expires in ~2h; semantic overlap is low. Recommend earliest slot now.

---

## Publication Lock

Avoid duplicate sends across overlapping automation cycles.

Use queue status transition:

```text
scheduled -> publishing
```

`claimQueueItem(id)` must atomically move one eligible row to `publishing` before transport.

On success:

```text
publishing -> published
```

On transport failure:

```text
publishing -> failed
```

Store failure reason and do not silently retry in the same cycle.

---

## Format Mapping

### Original

```text
postTweetHttp(body)
```

### Quote

```text
postTweetHttp(body, { quoteTweetId: sourceTweetId })
```

### Thread

```text
postThreadHttp(threadParts)
```

The thread is one scheduled main-feed unit even though the child replies publish sequentially as part of the same thread operation.

### Repost

Use the existing explicit repost path only if already supported reliably; otherwise keep repost as manual until the current transport owner has a verified stable action path. Do not create a second posting stack just for repost.

---

### Task 1: Add scheduler/publish-lock persistence

**Files:**
- Modify: `store.js`

**Steps:**
- [ ] Add queue failure/attempt fields only if missing: `publish_started_at`, `publish_error`, `published_at`.
- [ ] Add `listApprovedMainFeedItems(now)`.
- [ ] Add atomic `claimQueueItem(id)` status transition.
- [ ] Add `markQueuePublished(id, tweetId, outputUrl)`.
- [ ] Add `markQueueFailed(id, error)`.

**Acceptance criteria:**
- Two cycles cannot simultaneously claim the same queue item.

### Task 2: Implement scheduler owner

**Files:**
- Create: `scheduler.js`

**Steps:**
- [ ] Implement eligibility rules.
- [ ] Implement advisory spacing plus urgency/expiry logic; do not encode the old 90-minute viral floor as a hard eligibility condition.
- [ ] Implement priority formula and transparent explanation.
- [ ] Implement semantic-conflict check using existing text/topic metadata.
- [ ] Return one next recommendation rather than mutating publication state itself.

**Acceptance criteria:**
- Scheduler can explain why an evergreen item waits while an approved expiring viral item pre-empts it.

### Task 3: Move automation from ready-draft FIFO to queue scheduler

**Files:**
- Modify: `automation.js`

**Steps:**
- [ ] Keep research refresh ownership unchanged.
- [ ] Replace `getNextReadyDraft` publication choice with scheduler recommendation.
- [ ] Preserve `AUTO_POST=false` as preview-only.
- [ ] When enabled, claim the queue item before transport.
- [ ] Publish only the claimed format.
- [ ] Persist success/failure and candidate action metadata.

**Acceptance criteria:**
- Automation no longer treats `draft.status=ready` as the authoritative scheduling owner.

### Task 4: Add format-aware main-feed transport

**Files:**
- Modify: `x_http.js`
- Reuse: installed XActions helpers.

**Steps:**
- [ ] Add one project-level helper mapping original/quote/thread to existing transport calls.
- [ ] Pass media IDs when Phase-2 media upload is ready.
- [ ] Preserve live CreateTweet operation discovery.
- [ ] Return canonical tweet IDs/URLs needed by queue/action history.

**Acceptance criteria:**
- Original, quote, and thread queue items invoke the correct existing transport shape without duplicating client/session creation logic.

### Task 5: Show schedule reasoning/override in dashboard

**Files:**
- Modify: `dashboard.js`

**Steps:**
- [ ] Show recommended time/reason for approved main-feed items.
- [ ] Show blockers such as cooldown, semantic conflict, or expiry.
- [ ] Allow human schedule override by selecting a concrete `scheduled_at`.
- [ ] Keep approval and schedule override separate actions.

**Acceptance criteria:**
- The user can see why an item is waiting and can intentionally override the recommended slot.

### Task 6: Expose scheduler inspection through agent bridge

**Files:**
- Modify: `agent_bridge.js`

**Produces:**
- `schedule-next`
- `schedule-inspect`

These commands inspect/recommend; they do not bypass human approval.

### Task 7: Synchronize docs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/AGENT_WORKFLOW.md`
- Modify: `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`
- Modify: `docs/ALGORITHM_EVIDENCE_LEDGER.md` only if scheduler assumptions changed.

---

## Phase 3 Completion Criteria

1. approved queue state, not draft FIFO, owns publication;
2. main-feed writes are serialized;
3. viral/timely expiry can pre-empt evergreen order and may recommend immediate serialized publication when shelf-life outweighs self-cannibalization risk;
4. scheduler explanations separate code-backed mechanisms from empirical spacing heuristics and never present a posting gap as an anti-flag rule;
5. original/quote/thread publish through one transport owner;
6. duplicate claims are prevented;
7. failed sends remain inspectable/recoverable;
8. engagement replies remain outside the main-feed scheduler.
