# Phase 1B Relationship Intelligence Implementation Plan

**Goal:** Add durable relationship memory, target classification, transparent TargetScore, and relationship-event history so the system can prioritize people/conversations rather than treating every research post independently.

**Architecture:** Preserve `audience_profiles` as the raw follower/following observation layer and add `relationship_profiles` as the strategic derived layer. Store meaningful interaction history in append-only `relationship_events`. Add a focused `relationship.js` owner for scoring/stage derivation; do not put relationship logic into `audience.js` or dashboard rendering.

**Tech Stack:** Node.js 24, built-in `node:sqlite`, existing `store.js`, `audience.js`, `strategy.js`, `agent_bridge.js`, Bootstrap dashboard.

## Global Constraints

- This phase starts after Phase 1 queue/workflow foundation establishes stable queue ownership.
- Preserve existing `audience_profiles` and current audience sync behavior.
- Do not add another database or ORM.
- Follower count is secondary; target selection is driven by topic fit, audience overlap, conversation quality, reply visibility, and relationship potential.
- TargetScore is our prioritization model, not an X internal ranking score.
- Store component breakdowns so every target recommendation is explainable.
- Relationship stage is derived from event/follow state rather than arbitrary manual labels.
- Do not implement outbound reply sending in this phase; that belongs to Phase 1C.
- No tests are authorized by this plan.

## File Responsibility Map

### Create

- `relationship.js` — target classes, TargetScore components, score aggregation, relationship-stage derivation, event-to-profile aggregation.

### Modify

- `store.js` — relationship profile/event schema and persistence.
- `audience.js` — feed observed profile/follow state into relationship refresh without owning strategic scoring.
- `dashboard.js` — Relationship Intelligence read-only view.
- `agent_bridge.js` — relationship inspection/list commands.
- `README.md`, `AGENTS.md`, `docs/AGENT_WORKFLOW.md` — update only after the behavior exists.

---

## Data Model

### `relationship_profiles`

```sql
CREATE TABLE IF NOT EXISTS relationship_profiles (
  username TEXT PRIMARY KEY,
  display_name TEXT,
  bio TEXT,
  classes_json TEXT NOT NULL DEFAULT '[]',
  primary_topics_json TEXT NOT NULL DEFAULT '[]',
  matched_keywords_json TEXT NOT NULL DEFAULT '[]',
  topic_fit REAL NOT NULL DEFAULT 0,
  audience_overlap REAL NOT NULL DEFAULT 0,
  conversation_quality REAL NOT NULL DEFAULT 0,
  reply_visibility REAL NOT NULL DEFAULT 0,
  relationship_potential REAL NOT NULL DEFAULT 0,
  reach_modifier REAL NOT NULL DEFAULT 0,
  target_score REAL NOT NULL DEFAULT 0,
  relevance_score REAL NOT NULL DEFAULT 0,
  customer_density REAL NOT NULL DEFAULT 0,
  authority_score REAL NOT NULL DEFAULT 0,
  follows_you INTEGER NOT NULL DEFAULT 0,
  you_follow INTEGER NOT NULL DEFAULT 0,
  mutual INTEGER NOT NULL DEFAULT 0,
  relationship_stage TEXT NOT NULL DEFAULT 'observed',
  meaningful_interactions INTEGER NOT NULL DEFAULT 0,
  their_replies_to_us INTEGER NOT NULL DEFAULT 0,
  our_replies_to_them INTEGER NOT NULL DEFAULT 0,
  our_quotes_of_them INTEGER NOT NULL DEFAULT 0,
  their_quotes_of_us INTEGER NOT NULL DEFAULT 0,
  their_reposts_of_us INTEGER NOT NULL DEFAULT 0,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_interaction_at INTEGER,
  last_response_at INTEGER,
  last_scored_at INTEGER NOT NULL,
  score_explanation_json TEXT NOT NULL DEFAULT '{}'
);
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_relationship_target_score
  ON relationship_profiles(target_score DESC, last_scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_stage
  ON relationship_profiles(relationship_stage, target_score DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_response
  ON relationship_profiles(last_response_at DESC);
```

### `relationship_events`

```sql
CREATE TABLE IF NOT EXISTS relationship_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  event_type TEXT NOT NULL,
  candidate_key TEXT,
  source_tweet_id TEXT,
  our_tweet_id TEXT,
  topic TEXT,
  occurred_at INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_relationship_events_user_time
  ON relationship_events(username, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_events_type_time
  ON relationship_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_events_source
  ON relationship_events(source_tweet_id);
CREATE INDEX IF NOT EXISTS idx_relationship_events_ours
  ON relationship_events(our_tweet_id);
```

---

## Target Class Contract

Allowed classes:

```text
distribution
relationship
authority
customer_density
source
```

Class assignment returns:

```js
{
  classes: ['relationship', 'authority'],
  reasons: {
    relationship: 'Repeated coding-agent topic overlap and responsive technical threads.',
    authority: 'Maintainer/research role inferred from profile/source context.'
  }
}
```

Initial classification should reuse existing bio/niche classification where possible. Do not create external enrichment dependencies in this phase.

---

## TargetScore Contract

`relationship.js` exports:

```js
scoreRelationshipTarget(profile, context = {})
```

Return:

```js
{
  targetScore,
  components: {
    topicFit,
    audienceOverlap,
    conversationQuality,
    replyVisibility,
    relationshipPotential,
    reachModifier,
  },
  classes,
  explanation,
}
```

Aggregate:

```text
base = 100 * exp(
  0.30 * ln(max(topicFit, 10) / 100)
+ 0.25 * ln(max(audienceOverlap, 10) / 100)
+ 0.20 * ln(max(conversationQuality, 10) / 100)
+ 0.10 * ln(max(replyVisibility, 10) / 100)
+ 0.15 * ln(max(relationshipPotential, 10) / 100)
)

targetScore = clamp(base + reachModifier, 0, 100)
```

`reachModifier` is clamped `-5..+5`.

### Missing component rule

When a component cannot be observed:

- do not pretend it is 0;
- omit it from the geometric mean;
- renormalize remaining component weights;
- include `missingComponents` in the explanation.

This prevents unavailable graph data from making every target appear poor.

---

## Starting Component Formulas

### TopicFit

Inputs already available or derivable:

```text
niche tag overlap
matched keyword overlap
research-agenda topic match
recent profile/post topic consistency when available
```

Starting weights:

```text
45% niche overlap
30% high-specificity keyword overlap
25% research-agenda topic fit
```

### AudienceOverlap

Phase-1B starting approximation:

```text
50% target-niche similarity
30% shared known source/account cluster membership
20% observed relevant-follower/replier evidence when available
```

If shared graph/replier data is unavailable, renormalize rather than inventing it.

### ConversationQuality

Use persisted observation fields from context when present:

```text
author response behavior
technical thread density
substantive vs praise/noise ratio
recurring commenters
```

Before Phase 1C collects enough conversation data, use a conservative profile/source heuristic and label confidence low.

### ReplyVisibility

Profile baseline in Phase 1B only:

```text
author response behavior
usual thread depth
usual saturation context
```

Per-post freshness/saturation handling is added in Phase 1C and becomes an explicit **soft** `SaturationPressure` diagnostic in Phase 1D. Saturation must not become a hard target filter in Phase 1B.

### RelationshipPotential

Starting inputs:

```text
prior target replies
prior continued conversations
shared topic recurrence
follows_you
you_follow
mutual
account accessibility band
```

A demonstrated target response must outweigh raw account size.

---

## Relationship Stage Contract

`deriveRelationshipStage(profile, events)` returns one of:

```text
observed
interacted
responsive
recurring
connected
mutual
```

Priority order:

1. `mutual` when both follow flags are true.
2. `connected` when `follows_you` is true.
3. `recurring` when at least two bidirectional exchanges exist on separate source posts or separated by >=24 hours.
4. `responsive` when at least one target response event exists.
5. `interacted` when at least one meaningful our-reply/our-quote event exists.
6. otherwise `observed`.

Follow flags and raw event counts remain stored even when stage collapses them into one label.

---

### Task 1: Add relationship persistence

**Files:**
- Modify: `store.js`

**Interfaces:**
- Consumes: existing audience/profile observations and future interaction events.
- Produces: relationship profile/event CRUD functions.

**Steps:**
- [ ] Create `relationship_profiles` and `relationship_events` tables/indexes exactly as specified above.
- [ ] Add `decodeRelationshipProfile(row)` with JSON parsing for classes/topics/keywords/explanation.
- [ ] Add `getRelationshipProfile(username)`.
- [ ] Add `listRelationshipProfiles({ className, stage, minTargetScore, limit })`.
- [ ] Add `upsertRelationshipProfile(profile)` preserving `first_seen_at`.
- [ ] Add `recordRelationshipEvent(event)` as append-only insertion.
- [ ] Add `listRelationshipEvents(username, { limit })`.

**Acceptance criteria:**
- Existing SQLite databases initialize the new tables without changing existing audience/candidate/draft records.
- One target can have durable score/stage state plus append-only interaction history.

### Task 2: Implement target classes and TargetScore

**Files:**
- Create: `relationship.js`

**Interfaces:**
- Consumes: audience profile, niche taxonomy, saved/research topic context, relationship events.
- Produces: class assignment, transparent component scores, aggregate TargetScore, relationship stage.

**Steps:**
- [ ] Reuse `classifyNiche`/existing taxonomy rather than duplicating keyword ownership.
- [ ] Implement class assignment using only evidence available to the current system.
- [ ] Implement the component formulas and missing-component renormalization.
- [ ] Implement weighted geometric aggregate with bounded reach modifier.
- [ ] Implement stage derivation from event/follow state.
- [ ] Return explanations/confidence so missing evidence is visible.

**Acceptance criteria:**
- The same profile/context yields deterministic component values and one TargetScore with an explanation.
- Follower count can change reach modifier but cannot independently make an off-topic account a high target.

### Task 3: Materialize relationship profiles from audience sync

**Files:**
- Modify: `audience.js`
- Modify: `store.js`

**Interfaces:**
- Consumes: completed `audience_profiles` snapshot.
- Produces: updated relationship profile identity/follow fields plus fresh strategic score.

**Steps:**
- [ ] After audience snapshot persistence, fetch changed/observed audience rows.
- [ ] Merge display name, bio, follow flags, niche tags, and matched keywords into relationship input.
- [ ] Preserve existing relationship event counters/history.
- [ ] Recompute classes/TargetScore/stage only for observed/changed profiles.
- [ ] Preserve profiles not present in a partial scrape; follow existing non-destructive snapshot semantics.

**Acceptance criteria:**
- Audience refresh updates strategic relationship state without erasing prior interactions or profiles omitted by a partial scrape.

### Task 4: Aggregate events back into profile state

**Files:**
- Modify: `relationship.js`
- Modify: `store.js`

**Interfaces:**
- Consumes: one newly recorded relationship event.
- Produces: incremented counters, timestamps, stage, and refreshed RelationshipPotential/TargetScore.

**Steps:**
- [ ] Add one `applyRelationshipEvent(username)` path after event insertion.
- [ ] Recompute counts from event history for correctness instead of blindly incrementing caller-supplied counters.
- [ ] Update `last_interaction_at` for our outbound events and `last_response_at` for target response events.
- [ ] Recompute stage and target score after the event.

**Acceptance criteria:**
- Recording a target reply can move an account from `interacted` to `responsive` and increase relationship potential without direct raw-SQL mutations from callers.

### Task 5: Add Relationship Intelligence dashboard view

**Files:**
- Modify: `dashboard.js`

**Interfaces:**
- Consumes: relationship profile/event reads.
- Produces: read-only operator view.

**Steps:**
- [ ] Add `Relationships` navigation view.
- [ ] Show summary counts by stage and target class.
- [ ] Show top TargetScore profiles with component badges.
- [ ] Show follow/mutual state, last response, meaningful interaction count, and top topics.
- [ ] Add filters for target class and stage using query parameters.
- [ ] Keep this phase read-only; do not add reply/send buttons yet.

**Acceptance criteria:**
- The user can distinguish distribution, relationship, authority, customer-density, and source targets and inspect why each target ranks where it does.

### Task 6: Expose relationship reads through the agent bridge

**Files:**
- Modify: `agent_bridge.js`

**Interfaces:**
- Produces planned commands now implemented:
  - `relationship-targets`
  - `relationship-inspect`
  - `relationship-events`

**Steps:**
- [ ] Add `relationship-targets` filters for class/stage/min score/limit.
- [ ] Add `relationship-inspect` returning profile + recent event history.
- [ ] Add `relationship-events` for bounded event retrieval.
- [ ] Update usage output.

**Acceptance criteria:**
- An external agent can inspect relationship intelligence without querying SQLite directly.

### Task 7: Synchronize documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/AGENT_WORKFLOW.md`
- Modify: `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`
- Modify: `docs/RELATIONSHIP_INTELLIGENCE.md`

**Steps:**
- [ ] Change planned relationship commands to current behavior only after implementation exists.
- [ ] Document the new Relationships dashboard view.
- [ ] Keep Phase 1C Engage Next behavior labeled planned until Phase 1C ships.

**Acceptance criteria:**
- Documentation accurately distinguishes implemented relationship intelligence from not-yet-implemented engagement execution.

---

## Phase 1B Completion Criteria

Phase 1B is complete when:

1. one durable relationship profile exists per observed relevant account;
2. target classes and component scores are explainable;
3. follower count cannot dominate target score;
4. meaningful events persist append-only;
5. relationship stages update from observed history;
6. audience refresh feeds relationship state non-destructively;
7. dashboard and agent bridge can inspect relationship intelligence;
8. no outbound reply execution has been added yet.