# Relationship Intelligence

This document defines the current Phase-1B relationship-memory/target-selection layer for `@ham_zax` and the implemented Phase-1C Engage Next workflow that consumes it.

The system should stop treating every X post as an isolated content opportunity. It should remember **who** the account interacts with, **why** they matter, **what topics overlap**, **how prior conversations went**, and **whether the relationship is compounding**.

Relationship intelligence sits between discovery/audience sync and the Engage Next queue.

---

## 1. Objective

Answer four questions reliably:

1. **Who is worth paying attention to?**
2. **Which recent conversation is worth entering now?**
3. **What can we add that is actually useful?**
4. **Which relationships are becoming more valuable over time?**

The system should optimize repeated useful interaction with the right network rather than maximize the raw number of accounts touched.

---

## 2. Relationship profile owner

Authoritative strategic record:

```text
relationship_profiles
```

One row per X username. `store.js` persists this separately from raw audience observations.

Current fields:

```text
username TEXT PRIMARY KEY
display_name TEXT
bio TEXT

classes_json TEXT
primary_topics_json TEXT
matched_keywords_json TEXT

topic_fit REAL
audience_overlap REAL
conversation_quality REAL
reply_visibility REAL
relationship_potential REAL
reach_modifier REAL
target_score REAL

relevance_score REAL
customer_density REAL
authority_score REAL

follows_you INTEGER
you_follow INTEGER
mutual INTEGER

relationship_stage TEXT
meaningful_interactions INTEGER
their_replies_to_us INTEGER
our_replies_to_them INTEGER
our_quotes_of_them INTEGER
their_quotes_of_us INTEGER
their_reposts_of_us INTEGER

first_seen_at INTEGER
last_seen_at INTEGER
last_interaction_at INTEGER
last_response_at INTEGER
last_scored_at INTEGER
score_explanation_json TEXT
```

`audience_profiles` remains the raw follower/following observation owner. `relationship_profiles` is the strategic layer derived from currently observed audience state + durable interaction history; partial audience refreshes do not delete omitted strategic profiles or relationship events.

---

## 3. Target classes

Store classes as a set because one account may serve multiple strategic roles.

```text
distribution
relationship
authority
customer_density
source
```

### Distribution

Strong audience overlap and enough active conversation volume to create useful exposure.

### Relationship

Repeated interaction is realistic and strategically useful.

### Authority

Technically respected account where interaction carries informational/credibility value.

### Customer density

Conversation audience contains people likely to care about developer tooling, AI implementation, infrastructure, consulting, or future technical products.

### Source

Produces useful primary/early technical information even if direct interaction value is low.

Class assignment should be explainable rather than a hidden label.

---

## 4. TargetScore components

All core components are 0-100 and individually visible.

### TopicFit

Inputs:

- overlap with core niche tags;
- overlap with `RESEARCH_AGENDA.md` topics;
- matched technical keywords;
- repeated recent topic consistency.

Suggested starting scoring:

```text
40% niche-tag overlap
30% research-agenda topic overlap
20% matched high-specificity keywords
10% recent-topic consistency
```

### AudienceOverlap

Use the strongest observable signals available.

Initial approximation may use:

```text
35% bio/niche similarity
25% shared followed accounts / graph proximity when observable
25% relevance of recent repliers/followers sampled from conversations
15% recurring topic overlap
```

Do not fabricate follower-overlap precision when the data is unavailable. Missing components should be omitted and the remaining weights renormalized.

### ConversationQuality

Estimate whether entering their threads is likely to produce technical exchange.

Signals:

```text
technical reply density
specific-question density
author response behavior
ratio of substantive replies to praise/noise
repeat commenters
```

Initial implementation may use a bounded manual/heuristic score until enough observed interactions exist.

### ReplyVisibility

Context-sensitive rather than profile-static.

Profile-level baseline:

- typical thread size;
- author response behavior;
- conversation depth.

Per-post override:

- post age;
- current reply count;
- reply velocity;
- source velocity;
- whether the conversation is already saturated.

### RelationshipPotential

Strongest signals:

```text
prior target reply
prior continued conversation
recurring shared topics
current follow state
mutual status
accessible account scale
historical response to informed commenters
```

This score should increase with demonstrated bidirectional interaction, not merely with follower count.

---

## 5. Aggregate TargetScore

Use weighted geometric mean so one weak component can meaningfully limit the result.

```text
base = 100 * exp(
  0.30 * ln(max(topic_fit, 10) / 100)
+ 0.25 * ln(max(audience_overlap, 10) / 100)
+ 0.20 * ln(max(conversation_quality, 10) / 100)
+ 0.10 * ln(max(reply_visibility, 10) / 100)
+ 0.15 * ln(max(relationship_potential, 10) / 100)
)

target_score = clamp(base + reach_modifier, 0, 100)
```

`reach_modifier` is deliberately bounded to `-5..+5` so raw account size cannot dominate.

Every score response should include a breakdown:

```json
{
  "targetScore": 87,
  "components": {
    "topicFit": 94,
    "audienceOverlap": 83,
    "conversationQuality": 91,
    "replyVisibility": 71,
    "relationshipPotential": 88,
    "reachModifier": 3
  },
  "reason": "High-overlap coding-agent peer with repeated technical reply behavior and one prior response."
}
```

---

## 6. Relationship stages

Use stage + raw follow flags.

```text
observed
interacted
responsive
recurring
connected
mutual
```

Stage derivation:

### observed

Relevant profile exists; no outbound interaction recorded.

### interacted

At least one meaningful `our_reply` or `our_quote` event.

### responsive

At least one meaningful target response event:

- target reply;
- target quote;
- target repost/reference.

### recurring

At least two bidirectional exchanges on separate source posts or separated by at least one day.

### connected

`follows_you = true`.

### mutual

`follows_you = true && you_follow = true`.

If follow state arrives before recurring conversation, the stage may move directly to `connected`; event history remains available for analysis.

---

## 7. Relationship events

Current append-only table:

```text
relationship_events
```

Fields:

```text
id INTEGER PRIMARY KEY AUTOINCREMENT
username TEXT NOT NULL
event_type TEXT NOT NULL
candidate_key TEXT
source_tweet_id TEXT
our_tweet_id TEXT
topic TEXT
occurred_at INTEGER NOT NULL
metadata_json TEXT NOT NULL DEFAULT '{}'
```

Indexes:

```text
(username, occurred_at DESC)
(event_type, occurred_at DESC)
(source_tweet_id)
(our_tweet_id)
```

Allowed initial event types:

```text
observed_relevant_post
our_reply
our_quote
target_reply
target_quote
target_repost
target_follow
we_followed
conversation_continued
conversation_expired
mutual_reached
```

Events are append-only history. Relationship profile counters/stage are derived materialized state.

---

## 8. Interaction quality

Not every reply should increment `meaningful_interactions` equally.

A meaningful outbound interaction should meet at least one:

- contains a concrete technical claim;
- contains evidence/measurement;
- contains implementation detail;
- identifies a specific trade-off/caveat;
- asks an informed question tied to the source;
- provides a useful reproduction/correction.

Generic praise or low-information acknowledgment should not improve relationship score.

---

## 9. Conversation memory

For each relationship target, preserve recent conversation summaries.

Planned data can live in relationship-event metadata first; avoid a separate conversation table until multiple real consumers require it.

Useful metadata:

```text
source text summary
our contribution summary
their response summary
unresolved question
shared topic
next useful follow-up
```

This enables future reply drafting to avoid repetitive introductions and to refer to prior technical context naturally.

---

## 10. Relationship opportunity generation

Candidate sources:

### A. Priority target recent posts

Fetch recent posts from top relationship/distribution/authority targets.

Filter:

- target score above configured floor;
- post inside freshness window or still actively conversational;
- topic fit above threshold;
- not already acted on in a way that exhausts the source;
- potential contribution exists.

Conversation saturation is **not** a hard filter. Phase 1D supplies `SaturationPressure` as a soft EngagePriority modifier. Active bidirectional conversation, a direct question, or new verified evidence may fully offset that pressure.

### B. Responses to us

Highest priority.

If a target replies to one of our replies/posts, surface as a follow-up opportunity immediately.

### C. Own-post comments

Relevant commenters under our posts may become new relationship targets.

### D. Viral/niche research

When a candidate's best route is reply and the author has relationship value, create an engagement-lane item.

---

## 11. Relationship opportunity scoring

Per-post engagement priority should be distinct from profile `TargetScore`.

Suggested model:

```text
EngagePriority =
  0.25 * ConversationPotential
+ 0.20 * RelationshipPotential
+ 0.20 * TargetScore
+ 0.15 * Freshness
+ 0.10 * ReplyVisibility
+ 0.10 * ContributionStrength
```

Then apply event boosts and health context:

```text
target replied to us        +15
direct question to us       +15
active recurring thread     +10
soft saturation/repetition  bounded negative modifier
active-conversation override may offset soft modifier
already acted on same source with no new value reject
no concrete contribution    reject
exact/near-duplicate reply  reject
observed hard constraint    reject
```

Do not reject solely because reply volume, target interaction count, or conversation density is high.

Clamp to 0-100 after boosts.

This score is internal prioritization, not an X rank simulation.

---

## 12. Follow-up behavior

When a sent reply receives a target response:

1. append `target_reply`;
2. update `last_response_at`;
3. recompute relationship stage/potential;
4. create or refresh an engagement-lane follow-up item;
5. mark the item with `follow_up = true`;
6. prioritize above new cold opportunities when a concrete response is warranted.

A follow-up may be resolved without replying if no additional technical contribution is useful.

---

## 13. Relationship target discovery cadence

Initial schedule:

- full follower/following relationship refresh: daily or on explicit refresh;
- top target recent-post refresh: every research cycle when enabled;
- active conversation follow-up refresh: highest freshness cadence available within the existing poll loop;
- target scoring refresh: when profile data changes or after a meaningful interaction event.

Do not repeatedly rescore static profiles on every dashboard render.

---

## 14. Network metrics

### Author response rate

```text
targets_who_replied / meaningful_initial_replies
```

### Conversation continuation rate

```text
interactions_with_at_least_one_follow_up / meaningful_initial_replies
```

### Recurring relationship conversion

```text
new_recurring_relationships / unique_targets_engaged
```

### Follow conversion by target class

```text
new_target_follows / unique_targets_engaged
```

Group by:

- target class;
- topic;
- account-size bucket;
- reply age bucket;
- relationship stage before interaction;
- reply archetype.

### Mutual conversion

Track as a relationship outcome, not a quota.

### InteractionYield

Track the transparent internal diagnostic defined in `ACCOUNT_HEALTH_AND_VISIBILITY.md` alongside its raw components:

```text
(author responses
 + 2 * continued conversations
 + 3 * new recurring relationships
 + 3 * relevant target follows
 + 4 * new mutual connections)
/ meaningful interactions
```

Use it comparatively by target class/archetype/topic rather than as a universal threshold.

### Network quality

Also expose target diversity, target-class diversity, topic diversity, and top-target concentration. A larger network is not necessarily a healthier network if most effort depends on one account or one conversation cluster.

---

## 15. Reply archetypes for analytics

Classify outbound replies as one primary archetype:

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

This enables experiments such as:

> Which reply archetypes produce the most target responses among relationship targets?

---

## 16. Target-size buckets

Follower count remains experimental context, not target law.

Suggested analytical buckets:

```text
<1k
1k-5k
5k-20k
20k-100k
100k-500k
500k+
```

Use these for learning, not filtering by default.

---

## 17. Agent contract

Phase 1B exposes relationship intelligence without raw SQLite reads through these current read-only commands:

```text
relationship-targets
relationship-inspect
relationship-events
```

`relationship-targets` supports target-class, relationship-stage, minimum-TargetScore, and bounded-limit filters. `relationship-inspect` returns one strategic profile plus recent event history. `relationship-events` returns bounded append-only history for one username.

Phase 1C exposes these current engagement commands:

```text
engage-next
engage-draft
engage-resolve
```

`engage-next` can refresh bounded target/response reads or return persisted actionable items, grouped into Active Conversations and New Opportunities. `engage-draft` creates/updates the existing Phase-2 reply draft and may request review but cannot approve or send. `engage-resolve` supports Ignore/Expire and one explicit Send action only for an already human-approved exact reply.

Example:

```json
{
  "command": "engage-next",
  "refresh": true,
  "minPriority": 40,
  "limit": 20
}
```

Each result packet includes the queue item/EngagePriority breakdown, target relationship profile, exact source candidate, draft when present, contribution/expiry state, and prior stage. Human approval remains a dashboard-only transition; editing/rerouting invalidates approval before any later send.

---

## 18. Dashboard contract

### Relationship Intelligence view — current

The read-only **Relationships** view provides:

- summary counts by relationship stage and target class;
- class/stage query-parameter filters;
- profiles ordered by TargetScore;
- class and relationship-stage badges;
- TopicFit, AudienceOverlap, ConversationQuality, ReplyVisibility, RelationshipPotential, and ReachModifier evidence;
- missing-component disclosure when evidence is unavailable;
- follow/mutual state, last target response, meaningful outbound count, and shared topics;
- class-assignment reasons and a direct profile link.

It does not expose reply/send/approval actions.

### Engage Next view — current

The **Engage Next** view separates **Active Conversations** from **New Opportunities** and shows:

- exact source post and age;
- target identity/classes, TargetScore, and relationship stage;
- Conversation + Relationship Potential plus freshness/ReplyVisibility/contribution components;
- concrete contribution archetype/summary;
- drafted reply and Phase-2 hard-gate state when available;
- expiry and active-conversation override state;
- soft saturation/repetition warning context;
- one-item actions: Draft/Edit reply, Quote instead for initial opportunities, Ignore, Expire, and explicit Approve & Send / Send approved reply.

There is no batch-send control in the human workflow. Human approval recomputes the latest Phase-2 reply gates and snapshots the exact body; the human send path refuses edited/unapproved text. The separate autonomous operator is controlled from Settings, not from a batch-send action in this view. Its dry-run/live decisions are shown in Conversations, and live sends require the persisted grant plus autonomous eligibility/claim provenance rather than human approval.

---

## 19. Evidence discipline

Relationship intelligence is a strategic layer built on:

- observed follower/following state;
- observed interaction events;
- current public algorithm mechanisms documented in `ALGORITHM_EVIDENCE_LEDGER.md`;
- empirical scores that remain transparent and tunable.

TargetScore and EngagePriority are **our models**. Phase 1D `SaturationPressure`, `NetworkQualityScore`, and `InteractionYield` are also our advisory/diagnostic models. None may be described as X's internal score, bot score, or reputation score.

---

## 20. Completion condition

Phase 1B Relationship Intelligence is implemented when the system can:

1. maintain one durable strategic profile per observed relevant account;
2. classify target roles from current observable evidence;
3. explain a transparent TargetScore and disclose missing components;
4. persist meaningful relationship events append-only;
5. derive relationship stage and materialized counters from event/follow history;
6. refresh strategic relationship state from raw audience observations without erasing omitted profiles or prior history;
7. inspect relationship profiles/events through the dashboard and bridge without an engagement-send or approval bypass.

Phase 1C is also implemented: the system surfaces bounded recent target posts, current Discover X observations, and observed responses; distinguishes active follow-up from cold insertion; ranks Engage Next opportunities; and requires a concrete contribution. The human path still drafts/reviews through Phase-2 gates and sends only exact human-approved text. A separate persisted autonomous grant is off by default; when started in Dry run, the existing daemon continuously refreshes and serially evaluates newly observed opportunities, preserving durable target decisions across restart. Dry-run records exact proposed replies without transport. Live autonomous send requires deterministic autonomous eligibility, recipient opt-in, a recorded clear/easy opt-out mechanism, recorded X AI-reply approval, remaining operator budget, an atomic claim, and an official X API write transport. The current Clearcote browser-UI publisher keeps Live autonomous Start blocked; autonomous decisions never set `humanApprovedAt`. Successful human/autonomous sends share candidate-action and relationship-event recording with distinct authority metadata. Later phases still own Account Health, richer visibility/saturation diagnostics, measurement/experiments, and learned strategy.