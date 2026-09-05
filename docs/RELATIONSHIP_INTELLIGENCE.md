# Relationship Intelligence

**Status:** canonical relationship-state and interaction-outcome contract
**Content contract:** `CONTENT_OPERATING_STANDARD.md`
**Research anchor:** `research/x_creator_phase2/V4_RESEARCH_REASSESSMENT.md`

This document defines the current Phase-1B relationship-memory/target-selection layer for `@ham_zax` and the implemented Phase-1C Engage Next workflow that consumes it.

The system should stop treating every X post as an isolated content opportunity. It should remember **who** the account interacts with, **why** they matter, **what topics overlap**, **how prior conversations went**, **which social and technical roles Hamza used**, and **whether recognition and reciprocity are compounding**.

Relationship intelligence sits between discovery/audience sync and the Engage Next queue. It measures relationship evidence; it does not require every relationship-building act to carry technical information.

---

## 1. Objective

Answer five questions reliably:

1. **Who is worth paying attention to?**
2. **Which recent conversation is worth entering now?**
3. **What legitimate purpose could an action serve here?**
4. **How should behavior change with relationship and conversation depth?**
5. **Which relationships are becoming more valuable over time?**

The system should optimize repeated purposeful interaction with the right network rather than maximize the raw number of accounts touched. Purpose may be technical, social, supportive, humorous, exploratory, corrective, or relational.

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

Estimate whether entering their threads is likely to produce a real exchange, not merely exposure.

Signals:

```text
technical reply density
specific-question density
author response behavior
substantive social or technical replies versus generic noise
repeat commenters
conversation continuation
repair, credit, support, and callback behavior
```

A short answer, joke, thanks, or congratulations can be substantive when it responds to real context. Generic praise is still noise when it exists only to obtain visibility.

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
recognition or callback across separate threads
current follow state
mutual status
accessible account scale
historical response to informed, supportive, or socially distinctive commenters
```

This score should increase with demonstrated bidirectional interaction and recognition, not merely with follower count or the technical density of Hamza's replies.

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

A meaningful outbound interaction has a contextual purpose and is not generic activity. It may meet at least one of these:

### Technical or learning evidence

- contains a concrete technical claim;
- contains evidence/measurement;
- contains implementation detail;
- identifies a consequential trade-off/caveat;
- asks a useful question tied to the source;
- provides a reproduction/correction.

### Social or relationship evidence

- directly answers the person in front of Hamza;
- gives specific credit, thanks, support, or congratulations;
- makes a context-dependent joke or useful emotional contrast;
- repairs a misunderstanding;
- recalls or continues prior shared context;
- receives or plausibly invites a substantive response;
- participates in an actual milestone or shared moment rather than emitting generic praise.

`meaningful` should be stored with purpose/mode/context metadata where available. Generic praise or low-context acknowledgment should not improve relationship score merely because it was sent.

---

## 9. Conversation memory

For each relationship target, preserve recent conversation summaries.

Planned data can live in relationship-event metadata first; avoid a separate conversation table until multiple real consumers require it.

Useful metadata:

```text
source text summary
our purpose / mode / affect / depth
our contribution or social act summary
their response summary
conversation stage
unresolved question
shared topic or recurring stance
repair / credit / callback signal
next useful follow-up
```

This enables future reply drafting to avoid repetitive introductions, use shared context naturally, and become less formal as a real exchange deepens without weakening factual precision.

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
- at least one plausible technical, social, relationship, support, celebration, humor, taste, judgment, learning, correction, or de-escalation purpose exists.

Conversation saturation is **not** a hard filter. Phase 1D supplies `SaturationPressure` as a soft EngagePriority modifier. Active bidirectional conversation, a direct question, or new conversation context may fully offset that pressure.

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
  0.28 * ConversationPotential
+ 0.22 * RelationshipPotential
+ 0.22 * TargetScore
+ 0.17 * Freshness
+ 0.11 * ReplyVisibility
```

Purpose is an eligibility/context decision, not an intrinsic numeric component. The system should not encode `benchmark > humor > agreement` or another universal purpose hierarchy; later outcome evidence may compare purposes without making one globally superior.

Then apply event boosts and health context:

```text
target replied to us        +15
direct question to us       +15
active recurring thread     +10
soft saturation/repetition  bounded negative modifier
active-conversation override may offset soft modifier
already acted on same source with no new purpose/context reject
no legitimate purpose       reject
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

A follow-up may be technical, social, humorous, supportive, or brief. It may also be resolved without replying when no legitimate next purpose remains.

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
- reply archetype;
- primary purpose;
- social mode;
- affect strategy;
- information depth;
- conversation stage;
- persona model version.

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

Use it comparatively by target class, purpose, mode, archetype, topic, and conversation stage rather than as a universal threshold.

### Network quality

Also expose target diversity, target-class diversity, topic diversity, and top-target concentration. A larger network is not necessarily a healthier network if most effort depends on one account or one conversation cluster.

---

## 15. Reply behavior for analytics

Persist **purpose** independently from reply archetype. The archetype describes the visible act; purpose explains why it was selected.

Technical archetypes:

```text
implementation_detail
benchmark_or_result
caveat_or_edge_case
comparison
correction
independent_judgment
informed_question
synthesis
reproduction
personal_experience
```

Social/interaction archetypes:

```text
direct_answer
direct_technical_answer
status_response
agreement
gratitude
support
celebration
enthusiasm
humor
social_observation
de_escalation
relationship_callback
```

Also retain:

```text
primary_purpose
social_mode
affect_strategy
affect_provenance
information_depth
conversation_stage
persona_model_version
```

This enables experiments such as:

> Which purposes and reply archetypes produce target responses, continued conversations, recurring relationships, profile visits, or follows for each relationship class?

Do not infer that a social act failed merely because it contains little information. Evaluate whether it produced the relationship or conversation outcome it was selected for.

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
browser-reply-claim
```

`engage-next` can refresh bounded target/response reads or return persisted actionable items, grouped into Active Conversations and New Opportunities. `engage-draft` creates/updates the existing Phase-2 reply draft and may request review but cannot approve or send. `engage-resolve` supports Ignore/Expire and the ordinary one-shot Send action for an already human-approved exact reply. Separately, when the autonomous-reply grant is Live and the daemon has no reply transport, a deterministic eligible decision remains `eligible_live` and unclaimed; after live thread inspection the persistent Growth Operator uses `browser-reply-claim` to atomically consume that exact decision/budget immediately before the browser action.

Example:

```json
{
  "command": "engage-next",
  "refresh": true,
  "minPriority": 40,
  "limit": 20
}
```

Each result packet includes the queue item/EngagePriority breakdown, target relationship profile, exact source candidate, draft when present, contribution/expiry state, and prior stage. Human approval remains a dashboard-only transition for the ordinary send lane; editing/rerouting invalidates that approval before any later send. Autonomous reply authority is separate and never manufactures `humanApprovedAt`.

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
- Conversation + Relationship Potential plus freshness/ReplyVisibility and purpose/behavior context;
- selected purpose, mode, affect/depth when available, plus the visible reply archetype/summary;
- drafted reply and Phase-2 hard-gate state when available;
- expiry and active-conversation override state;
- soft saturation/repetition warning context;
- one-item actions: Draft/Edit reply, Quote instead for initial opportunities, Ignore, Expire, and explicit exact-reply approval. The web UI stages approved text; browser execution belongs to the persistent Growth Operator.

There is no batch-send control in the human workflow. Human approval recomputes the latest Phase-2 reply gates and snapshots the exact body; it does not itself mutate X. The separate autonomous operator is controlled from Settings, not from a batch-send action in this view. Its dry-run/live decisions are shown in Conversations. Immediately before any browser-agent Reply, `browser-reply-claim` must atomically claim either the exact approved human reply or the exact `eligible_live` autonomous decision, the current target thread must be re-observed, and `record-action` requires verified parentTweetId plus outputText before reconciliation can complete.

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

Phase 1C is also implemented: the system surfaces bounded recent target posts, current Discover X observations, and observed responses; distinguishes active follow-up from cold insertion; ranks Engage Next opportunities; and requires a legitimate contextual purpose rather than mandatory technical additivity. The human path still drafts/reviews through Phase-2 gates and sends only exact human-approved text. A separate persisted autonomous grant can run in Dry run or Live mode; the daemon continuously refreshes and serially evaluates newly observed opportunities, preserving durable target decisions across restart. Dry-run records exact proposed replies without mutation. In Live mode, a daemon-owned transport may claim/send directly when one exists; otherwise the exact decision stays unclaimed `eligible_live` for the persistent Growth Operator. Browser execution uses `browser-reply-claim`, exact target/text provenance, current Account Health, one-shot send semantics, parent-structure verification, and `record-action` reconciliation; autonomous decisions never set `humanApprovedAt`. Successful human/autonomous sends share candidate-action and relationship-event recording with distinct authority metadata. Later phases still own Account Health, richer visibility/saturation diagnostics, measurement/experiments, and learned strategy.
