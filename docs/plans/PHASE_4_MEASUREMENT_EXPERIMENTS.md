# Phase 4 Measurement & Experiments Implementation Plan

**Goal:** Measure content, follower, conversation, and relationship outcomes at fixed windows; attach experiments to naturally different future items; and compare normalized cohorts without confusing correlation with direct attribution.

**Architecture:** Extend existing performance snapshots rather than adding a separate analytics service. `experiments.js` owns experiment definitions/variant assignment/cohort summaries. `relationship_events` supplies network outcomes. `post_metrics`/`account_metrics` remain raw observations; add explicit publication measurement records that connect queue metadata to fixed windows.

**Tech Stack:** Node.js 24, built-in SQLite, existing performance reads, queue/action history, relationship profiles/events, Bootstrap dashboard.

## Global Constraints

- Requires published queue metadata from Phase 3 and relationship events from Phase 1B/1C.
- Measure reach and follower/network conversion side by side.
- Associated follower deltas are not automatically causal attribution.
- Experiments compare naturally different future posts; do not duplicate/near-duplicate content to create A/B pairs.
- One primary experimental dimension per item when practical.
- Do not declare a winner before minimum evidence thresholds.
- No tests are authorized by this plan.

## File Responsibility Map

### Create

- `experiments.js` — experiment definitions, variant assignment, cohort eligibility, normalized summaries.

### Modify

- `store.js` — experiments/variants/publication measurement persistence and new-follower first-seen state.
- `automation.js` — due measurement-window capture.
- `audience.js` — first-seen follower observations / relationship profile refresh.
- `dashboard.js` — Performance + Experiments views.
- `scheduler.js` — consume learned summaries only in Phase 5; in this phase store context only.
- `agent_bridge.js` — experiment/measurement inspection commands.

---

## Publication Measurement Model

Add:

```text
publication_measurements
```

Suggested fields:

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
queue_item_id INTEGER NOT NULL,
tweet_id TEXT NOT NULL,
window_minutes INTEGER NOT NULL,
captured_at INTEGER NOT NULL,
views INTEGER NOT NULL DEFAULT 0,
likes INTEGER NOT NULL DEFAULT 0,
reposts INTEGER NOT NULL DEFAULT 0,
replies INTEGER NOT NULL DEFAULT 0,
followers INTEGER NOT NULL DEFAULT 0,
follower_delta INTEGER NOT NULL DEFAULT 0,
follows_per_1000_views REAL,
replies_per_1000_views REAL,
reposts_per_1000_views REAL,
visible_engagement_per_1000_views REAL,
attribution_confidence TEXT NOT NULL,
metadata_json TEXT NOT NULL DEFAULT '{}',
UNIQUE(queue_item_id, window_minutes)
```

Fixed windows:

```text
15m
60m
360m
1440m
```

If the process misses an exact target time, capture the first available snapshot after the window and store actual `captured_at`.

---

## Attribution Confidence

Associated follower change is not guaranteed to come from one post.

Starting confidence rule:

```text
high   no other main-feed publication between baseline and capture
medium exactly one overlapping main-feed publication
low    two or more overlapping main-feed publications
```

Also downgrade one level when:

- a major external mention/referral is known;
- follower baseline was captured materially late;
- account/profile changes occurred during the window and are known.

Do not prevent analytics when confidence is low; make the uncertainty visible.

---

## New-Follower Quality

Add `first_seen_at` to the audience/relationship observation path if missing.

For newly observed followers:

- run existing niche classification;
- capture relevance score/tags;
- mark whether strongly aligned with the target AI/developer/builder audience;
- preserve raw profile/follow state.

Derived metric:

```text
niche_aligned_new_followers / newly_observed_followers
```

Group around measurement periods rather than claiming one-to-one post attribution.

---

## Relationship Outcome Metrics

From `relationship_events`:

```text
author_response_rate
conversation_continuation_rate
recurring_relationship_conversion
connected_target_conversion
mutual_relationship_count
```

Normalize by unique targets/interactions rather than raw event count.

Example:

```text
author_response_rate =
  unique targets producing target_reply
  / unique targets receiving meaningful initial reply
```

---

## Experiment Data Model

### `experiments`

```sql
CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  dimension TEXT NOT NULL,
  population_json TEXT NOT NULL DEFAULT '{}',
  primary_metric TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  ended_at INTEGER
);
```

### `experiment_variants`

```sql
CREATE TABLE IF NOT EXISTS experiment_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(experiment_id, label)
);
```

`queue_items.experiment_variant_id` links publication to one assigned variant.

For network experiments that concern engagement items, the same field can point from engagement queue items.

---

## Supported Experiment Dimensions

### Content

```text
style
hook_type
media_type
format
```

### Timing

```text
timing_bucket
```

Only after enough schedule history exists.

### Network

```text
target_class
target_score_bucket
target_size_bucket
reply_age_bucket
conversation_saturation_bucket
reply_archetype
relationship_stage
```

---

## Experiment Assignment

One experiment defines:

```text
hypothesis
population
primary dimension
variants
primary metric
secondary metrics
minimum completed observations
```

Example:

```json
{
  "name": "peer-implementation-vs-question",
  "hypothesis": "Implementation-detail replies to relationship targets create more recurring conversations than informed-question replies.",
  "dimension": "reply_archetype",
  "population": {
    "targetClass": "relationship",
    "topicTags": ["agents", "devtools"]
  },
  "primaryMetric": "author_response_rate",
  "variants": ["implementation_detail", "informed_question"],
  "minimumCompletedPerVariant": 5
}
```

Assignment should occur before final drafting when the dimension changes the output.

Human can decline experiment assignment without blocking content.

---

## Cohort Rules

- only compare items matching experiment population;
- compare normalized metrics;
- show sample size for each variant;
- show topic/target distribution so obvious confounding is visible;
- no `winner` label before minimum sample threshold;
- after threshold, label result `directional` until at least 20 completed observations per variant;
- even after 20+, keep wording probabilistic rather than causal unless design genuinely isolates the variable.

Suggested evidence states:

```text
insufficient
preliminary
directional
repeated
```

---

## Core Content Metrics

```text
views_per_hour
replies_per_1000_views
reposts_per_1000_views
visible_engagement_per_1000_views
associated_follows_per_1000_views
```

When observable later:

```text
profile_visits_per_1000_views
bookmarks_per_1000_views
```

Do not block the phase on metrics X does not expose through the current read path.

---

## Core Network Metrics

```text
author_response_rate
conversation_continuation_rate
relationship_stage_progression
connected_target_conversion
recurring_relationship_conversion
```

Analyze by:

```text
target_class
target_score_bucket
reply_age_bucket
reply_archetype
topic
relationship_stage_before
```

---

### Task 1: Add publication measurement persistence

**Files:**
- Modify: `store.js`

**Steps:**
- [ ] Create `publication_measurements` table/unique window constraint.
- [ ] Add `recordPublicationMeasurement`.
- [ ] Add `getPublicationMeasurements(queueItemId)`.
- [ ] Add `listDueMeasurementWindows(now)` based on published queue items and missing windows.
- [ ] Add grouped analytics query helpers only for actual dashboard consumers.

**Acceptance criteria:**
- Each published queue item can accumulate at most one measurement row per fixed window.

### Task 2: Capture due fixed-window metrics

**Files:**
- Modify: `automation.js`
- Reuse: existing account/post performance reads.

**Steps:**
- [ ] Before/after research cycle, check for due measurement windows.
- [ ] Batch-read recent account/post performance once per cycle where possible.
- [ ] Map visible post metrics to published queue tweet IDs.
- [ ] Compute normalized metrics and attribution confidence.
- [ ] Record measurement rows idempotently.

**Acceptance criteria:**
- A long-running process gradually fills 15m/1h/6h/24h rows without duplicate captures.

### Task 3: Preserve first-seen follower quality

**Files:**
- Modify: `store.js`
- Modify: `audience.js`
- Modify: `relationship.js`

**Steps:**
- [ ] Add `first_seen_at` to audience/relationship observation if not already present.
- [ ] Preserve original first-seen time on refresh.
- [ ] Identify newly observed followers since a measurement baseline.
- [ ] Reuse niche classifier/relevance scoring.
- [ ] Expose grouped new-follower alignment summaries.

**Acceptance criteria:**
- The system can report whether newly observed followers are becoming more niche-aligned over time.

### Task 4: Add experiment persistence/owner

**Files:**
- Create: `experiments.js`
- Modify: `store.js`

**Steps:**
- [ ] Create experiment/variant tables.
- [ ] Add experiment CRUD/status helpers.
- [ ] Add variant assignment to queue items.
- [ ] Enforce one active assigned variant per queue item.
- [ ] Implement population eligibility.
- [ ] Implement evidence-state thresholds.

**Acceptance criteria:**
- An experiment can be declared before publication, attach variants to eligible future items, and later summarize completed outcomes.

### Task 5: Add content/network cohort summaries

**Files:**
- Modify: `experiments.js`
- Modify: `store.js`

**Steps:**
- [ ] Aggregate publication metrics by content variant.
- [ ] Aggregate relationship-event outcomes by network variant.
- [ ] Normalize relevant rates.
- [ ] Include sample size and confounder distributions.
- [ ] Return `insufficient/preliminary/directional/repeated` state.

**Acceptance criteria:**
- The system can answer a declared network/content hypothesis without reducing results to likes.

### Task 6: Add Performance + Experiments dashboard

**Files:**
- Modify: `dashboard.js`

**Steps:**
- [ ] Extend Performance with fixed-window curves and follower-conversion columns.
- [ ] Show attribution confidence.
- [ ] Show new-follower niche alignment.
- [ ] Add Experiments view: active/draft/completed experiments, variants, sample sizes, primary metric, evidence state.
- [ ] Show network experiments separately from content experiments when useful.

**Acceptance criteria:**
- The user can see which posts got reach versus followers and which relationship tactics produced recurring conversations.

### Task 7: Expose analytics through agent bridge

**Files:**
- Modify: `agent_bridge.js`

**Produces:**

```text
measurements
experiments
experiment-create
experiment-assign
experiment-summary
```

Write commands require explicit user intent; read commands are safe inspection.

### Task 8: Synchronize docs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`
- Modify: `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`
- Modify: `docs/ALGORITHM_EVIDENCE_LEDGER.md` when an empirical variable graduates to a repeated internal finding.

---

## Phase 4 Completion Criteria

1. every published main-feed item can accumulate fixed-window metrics;
2. follower delta is shown with attribution confidence;
3. new follower quality is measurable;
4. relationship outcomes are normalized by targets/interactions;
5. content and network experiments share one experiment owner;
6. duplicate/near-duplicate posts are not required for experiments;
7. cohort evidence states prevent premature winners;
8. outputs are ready for Phase 5 learned recommendations.