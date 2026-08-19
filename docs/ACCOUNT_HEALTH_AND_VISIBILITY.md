# Account Health & Visibility Operating Standard

This document defines the account-level observability and advisory layer for `@ham_zax`.

It exists to answer one question:

> **Are our publishing and relationship-building tactics improving durable account quality, or are they becoming repetitive, concentrated, low-yield, or visibility-constrained?**

It is deliberately **not** a bot-risk simulator and must not be used to imitate human timing or reverse-engineer hidden enforcement thresholds.

## 1. August 2026 calibration

The current public X stack exposes more than ranking. The public repository now documents a labeling and visibility path that includes:

- `visibility-filtering/`;
- `scarecrow/`;
- `botmaker/` and `botmaker-rules/`;
- account-scoring systems including `agatha/`, `bdsm/`, and `user-cred-v2/`;
- `safety-label-user-agg/`;
- `abuse-enforcement-service/`;
- `under-the-hood/` aggregate label reporting.

The system therefore should prefer **observable account/post visibility evidence** over folklore such as fixed bot thresholds, circadian imitation, or guessed action limits.

Current strategic rule:

> **Be aggressive about useful research, fast response, real conversation, experimentation, and original publishing. Be conservative only when there is actual quality failure, platform-policy conflict, or observed visibility/enforcement evidence.**

## 2. Health states

Account health has three operator-facing states.

### `HEALTHY`

No material observed visibility/enforcement concern. Soft diagnostics may still exist, but they do not justify slowing useful activity.

Examples:

- several replies in a short period because a real conversation is active;
- multiple useful interactions with one target who is responding;
- varied reply archetypes with healthy response/continuation outcomes;
- rapid viral posting that remains distinct and useful.

### `WATCH`

A soft diagnostic suggests declining efficiency, excessive concentration, or content repetition. `WATCH` is advisory.

Examples:

- several recent unanswered interactions with the same target;
- repeated use of the same reply archetype or sentence structure;
- falling author-response / conversation-continuation rate;
- a large share of engagement effort concentrated on one or two accounts;
- rising volume without proportional relationship/follower outcomes.

`WATCH` must not automatically block an otherwise valuable reply or post.

### `CONSTRAINED`

A hard operational condition exists.

Valid causes:

- an observed visibility-impacting account/post label that warrants intervention;
- an explicit platform enforcement/challenge/restriction signal;
- a requested action that conflicts with current platform rules or project hard boundaries;
- a content item fails factuality/source/duplicate hard gates at the item level.

A guessed timing pattern, follower-count bucket, daily reply count, or soft saturation signal must never create `CONSTRAINED` by itself.

## 3. Observable evidence first

Planned account-health evidence should be stored with provenance.

Suggested health observation types:

```text
under_the_hood_snapshot
visibility_label_observed
visibility_label_cleared
platform_challenge_observed
platform_restriction_observed
reply_repetition_warning
target_saturation_warning
network_concentration_warning
interaction_yield_warning
```

Every observation should record:

```text
type
observed_at
source
source_url_or_path
severity
metadata_json
```

Do not transform an inferred classifier theory into an observed platform event.

## 4. Under the Hood snapshots

When available to the authenticated account, the planned system may capture or manually record X's aggregate **Under the Hood** visibility information.

Persist only what is actually observable:

```text
captured_at
account_label_summary
post_label_summary
window_or_period_if_shown
raw_summary_json
operator_note
```

Use snapshots for longitudinal comparison:

```text
new label appeared
label count increased
a label cleared
visibility state remained clean through a high-activity period
```

Do not infer a specific hidden rule from one snapshot.

## 5. Leniency policy

### No arbitrary reply quota

The system must not impose a fixed maximum such as `5/day`, `10/day`, or `20/day` as an X law.

A day with many genuinely useful, human-reviewed conversations can be healthy.

Volume becomes relevant only as empirical context:

- outcome per interaction;
- concentration by target;
- semantic repetition;
- negative/visibility evidence;
- operator workload.

### Genuine conversation bursts are healthy by default

If a target replies several times, answering several times in the same active conversation is not treated as suspicious merely because the timestamps are close.

Active conversation evidence can offset age/saturation penalties.

### No human-timing imitation

Do not model:

- circadian gaps for evasion;
- uniform/random jitter for evasion;
- fake browsing/typing delays;
- account-age or device-fingerprint tactics intended to disguise automation.

Timing remains a coverage/freshness problem.

### Repetition is graded

Hard fail:

- exact duplicate;
- near-duplicate reply/post;
- substantially identical promotional response sent repeatedly.

Soft warning:

- same reply archetype repeated often;
- same question structure repeatedly used;
- several posts expressing the same thesis with different wording.

A soft warning may be overridden when the current conversation genuinely calls for the same archetype.

## 6. Target saturation is a modifier, not a ban

Track:

```text
interactions_7d
interactions_30d
unanswered_interactions_7d
consecutive_unanswered
last_our_interaction_at
last_target_response_at
last_conversation_continued_at
interaction_topic_diversity
```

Calculate an internal `SaturationPressure` from `0..100` for explanation/experiments.

Interpretation:

```text
0-24   low pressure
25-49  mild repetition risk
50-74  meaningful concentration
75-100 high concentration / low demonstrated reciprocity
```

`SaturationPressure` modifies `EngagePriority`; it does not independently reject an opportunity.

Strong override evidence can neutralize the penalty for a specific opportunity:

- the target directly asks us a question;
- the target has just replied to us;
- we have new verified evidence uniquely relevant to the thread;
- a new technical issue creates genuinely different value;
- the current conversation is actively bidirectional.

The only automatic reject remains `no concrete contribution`, `actual duplicate/near-duplicate`, `already acted on the exact source where another action adds no value`, or a hard platform/content constraint.

All numeric saturation bands are `EMPIRICAL_VARIABLE` project defaults and should be learned over time.

## 7. Reply-archetype and semantic repetition

Every outbound reply should retain one primary archetype for analytics:

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

Track recent archetype distribution by:

- global account;
- target;
- topic;
- rolling 7-day window.

Also retain a simple recent-text similarity signal using existing/native facilities first. Phase 2 may use token/shingle similarity before introducing any embedding dependency.

The writer packet should expose recent reply archetypes and representative recent replies so the editor can avoid sounding formulaic.

## 8. Network quality

Do not judge growth only by follower count.

Track a network-quality dashboard with separate components rather than one opaque score:

```text
target_diversity
class_diversity
topic_diversity
author_response_rate
conversation_continuation_rate
recurring_relationship_count
connected_target_count
mutual_target_count
niche_aligned_new_followers
top_target_concentration
```

Optional `NetworkQualityScore` may summarize these for trend visualization, but the component values remain visible and authoritative.

Healthy direction means:

- more independent relevant relationships;
- less dependence on one large account;
- recurring technical conversations;
- increasing target-audience follower quality;
- authority + peer + builder + customer-density diversity;
- multiple core technical topic clusters.

## 9. InteractionYield

`InteractionYield` is an internal network-efficiency diagnostic, not an X score.

Starting formula:

```text
InteractionYield =
(
  author_responses
+ 2 * continued_conversations
+ 3 * new_recurring_relationships
+ 3 * relevant_target_follows
+ 4 * new_mutual_connections
) / max(meaningful_interactions, 1)
```

Use it comparatively by cohort, not as a universal target.

Group by:

```text
target_class
target_score_bucket
target_size_bucket
reply_age_bucket
reply_archetype
relationship_stage_before
topic
```

Because outcomes can overlap and relationship progression double-count related events, always show the underlying component counts beside the composite.

## 10. Engage stop conditions

`Engage Next` should distinguish **hard stop** from **soft caution**.

### Hard stop

```text
no_concrete_contribution
exact_or_near_duplicate
source_action_already_completed_and_no_new_value
expired_and_no_active_conversation
platform_or_visibility_constraint
```

### Soft caution

```text
target_saturation
repeated_archetype
high_target_concentration
weak_recent_interaction_yield
crowded_conversation
similar_point_already_made_recently
```

Soft caution changes priority/explanation only. The human may still approve the interaction.

## 11. Health-aware optimization objective

The system should optimize:

```text
QualifiedReach
x FollowConversion
x RelationshipProgression
x OwnedAuthority
```

subject to maintaining healthy observable account quality.

Do not optimize for `number of actions executed`.

The desirable failure mode is:

```text
23 discovered opportunities
3 genuinely worth engaging
3 prepared for review
```

not:

```text
23 opportunities
23 replies generated because capacity exists
```

## 12. Dashboard contract — planned

Add an **Account Health** view with:

### Current state

```text
HEALTHY | WATCH | CONSTRAINED
```

and explicit reasons/provenance.

### Visibility observations

- latest Under the Hood snapshot when available;
- visibility-impacting labels observed/cleared;
- enforcement/challenge observations;
- trend over time.

### Interaction health

- replies/interactions over time;
- author response rate;
- continuation rate;
- InteractionYield;
- repeated archetype warning;
- top-target concentration;
- saturation-pressure distribution.

### Network health

- target/class/topic diversity;
- recurring/connected/mutual relationships;
- niche-aligned follower trend.

No panel should claim to expose X's hidden bot score, reputation score, or enforcement probability.

## 13. Agent contract — planned

Planned bridge commands:

```text
account-health
health-observe
health-under-the-hood
```

`account-health` is read-only.

`health-observe` records an explicit observed event with source/provenance; it does not accept speculative detector guesses as facts.

`health-under-the-hood` records/refreshes an observable Under the Hood snapshot when the authenticated surface is available.

These commands are planned until implementation.

## 14. Evidence classification

Use `ALGORITHM_EVIDENCE_LEDGER.md`.

### Code-backed / official evidence informs

- ranking and visibility are separate layers;
- account/post labels can affect visibility;
- public account-scoring/labeling/enforcement components exist;
- some anti-abuse rules are intentionally not public;
- predicted negative-action weights are not raw count penalties;
- Under the Hood exposes aggregate visibility-impacting label information when available.

### Empirical variables remain experimental

- ideal daily reply count;
- target saturation threshold;
- semantic/archetype repetition threshold;
- ideal interaction diversity;
- best reply age;
- target-size ranges;
- posting gaps;
- media/hashtag/link-placement tactics.

## 15. Completion condition

Account Health & Visibility is complete when the system can:

1. show HEALTHY / WATCH / CONSTRAINED with explicit reasons;
2. distinguish observed platform evidence from internal soft diagnostics;
3. preserve Under the Hood snapshots when available;
4. track target saturation without turning it into an arbitrary ban;
5. track reply archetype/repetition without hard-failing legitimate repeated structures;
6. show network-quality components;
7. calculate InteractionYield with raw component counts;
8. apply soft health modifiers to Engage Next while preserving human override;
9. use actual observed visibility/enforcement evidence as a real constraint;
10. feed health/network observations into Phase 4 experiments and Phase 5 learned strategy.
