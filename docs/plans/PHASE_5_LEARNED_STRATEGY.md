# Phase 5 Learned Strategy Implementation Plan

**Goal:** Use accumulated content, follower, relationship, and experiment outcomes to produce explainable recommendations for target selection, conversation strategy, content format, and publishing time without letting one noisy result rewrite the account strategy.

**Architecture:** Keep learned recommendations as summaries over existing persisted outcomes. Do not add a separate ML service initially. `learning.js` computes evidence-backed recommendations from measurement and relationship history; `scheduler.js`, `relationship.js`, and `strategy.js` consume bounded adjustments while retaining transparent base scores and human override.

**Tech Stack:** Node.js 24, built-in SQLite, existing experiment/measurement/relationship data, Bootstrap dashboard.

## Global Constraints

- Requires Phase 4 measurement/experiment data.
- Do not train a new ML model until the volume of data makes deterministic cohort/statistical summaries inadequate.
- Learned strategy must preserve the account's core niche identity.
- One viral outlier cannot permanently change target classes, content mix, or writing voice.
- Recommendations must state the supporting observation count and evidence state.
- Base formulas remain visible; learned adjustments are bounded.
- Human override remains available for targeting, route, content, and schedule decisions.
- No tests are authorized by this plan.

## File Responsibility Map

### Create

- `learning.js` — cohort summaries, bounded adjustments, recommendation explanations, promotion/decay of learned rules.

### Modify

- `relationship.js` — consume bounded target-component adjustments.
- `engagement.js` — consume learned reply-age/archetype/target-class evidence.
- `strategy.js` / `opportunity.js` — consume learned content/topic adjustments.
- `scheduler.js` — consume learned time/format outcomes.
- `dashboard.js` — Learned Strategy view with evidence.
- `agent_bridge.js` — inspect/accept/retire learned rules.
- `store.js` — persisted learned rules only if needed by current UI/consumers.

---

## Learned Rule Model

Add one small persisted table:

```text
learned_rules
```

Suggested fields:

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
scope TEXT NOT NULL,
key TEXT NOT NULL,
recommendation_json TEXT NOT NULL,
evidence_json TEXT NOT NULL,
evidence_state TEXT NOT NULL,
adjustment REAL NOT NULL DEFAULT 0,
status TEXT NOT NULL DEFAULT 'suggested',
created_at INTEGER NOT NULL,
updated_at INTEGER NOT NULL,
accepted_at INTEGER,
retired_at INTEGER,
UNIQUE(scope, key)
```

Allowed `scope`:

```text
targeting
engagement
content
timing
format
topic
```

Allowed status:

```text
suggested
accepted
retired
```

Only `accepted` rules affect production recommendations.

---

## Evidence Thresholds

Reuse experiment evidence states:

```text
insufficient
preliminary
directional
repeated
```

Starting promotion rules:

### Suggested rule

May be created at `preliminary`, but adjustment = 0 until accepted.

### Acceptable bounded rule

Requires at least `directional` evidence and human acceptance.

### Strong repeated rule

Requires `repeated` evidence across more than one period/topic bucket where relevant.

No rule is auto-accepted.

---

## Adjustment Bounds

Learned evidence should tune, not replace, base models.

Suggested bounds:

```text
TargetScore component adjustment          +/-10
EngagePriority adjustment                 +/-10
Follow/Reach/Conversation potential       +/-8
scheduler timing preference               +/-15 priority points
content/format preference                 +/-10
```

No learned rule can override hard gates, explicit expiry, human approval, or a direct manual route choice.

---

## Targeting Learning

Questions:

- Which target classes produce target replies?
- Which target-score ranges create recurring relationships?
- Which account-size buckets are actually useful for us?
- Which topics produce connected/mutual relationships?
- Which authority/customer-density targets produce relevant followers?

Example learned rule:

```text
scope: targeting
key: relationship:agents:5k-20k
finding: 14 completed interactions; 43% target-response rate vs 17% baseline
recommendation: +7 RelationshipPotential for similar observed targets
state: directional
```

Do not infer causal certainty from a small cohort.

---

## Engagement Learning

Questions:

- Which reply-age buckets perform best by source velocity?
- Which reply archetypes generate responses?
- Which relationship stages justify follow-ups?
- How does conversation saturation affect outcome?

Example:

```text
scope: engagement
key: reply_age:viral:5-15m
finding: higher response/continuation rate than 15-60m in 26 observations
recommendation: +8 EngagePriority inside this bucket
```

---

## Content Learning

Questions:

- Which technical formats convert follows?
- Which niches produce aligned followers?
- Which hook types improve follower conversion without reducing technical value?
- Which media types help specific content categories?

Prioritize:

```text
associated_follows_per_1000_views
niche_aligned_new_followers
replies_per_1000_views
reposts_per_1000_views
```

Raw likes may appear in diagnostics but should not drive learned rules alone.

---

## Timing Learning

Group by:

```text
weekday
hour bucket
pipeline
niche
urgency
```

Require enough samples before any timing rule.

A learned timing rule should answer:

> For this account and this content class, what historical slots produced better first-hour reach/follower conversion?

It must not be phrased as a universal X best-time rule.

Viral urgency may override learned evergreen timing.

---

## Rule Decay / Retirement

Platform behavior and audience composition change.

Every accepted rule should be re-evaluated when:

- 30+ newer relevant observations accumulate;
- a major algorithm evidence-ledger change affects the mechanism;
- current outcomes reverse the historical direction;
- niche strategy changes explicitly.

Retire rather than silently delete outdated rules.

---

### Task 1: Add learned-rule persistence

**Files:**
- Modify: `store.js`

**Steps:**
- [ ] Create `learned_rules` table.
- [ ] Add list/get/upsert/accept/retire helpers.
- [ ] Preserve evidence history in `evidence_json` summaries.

**Acceptance criteria:**
- Suggested evidence can be reviewed without automatically changing system behavior.

### Task 2: Implement learning owner

**Files:**
- Create: `learning.js`

**Steps:**
- [ ] Read completed measurements/experiments/relationship outcomes.
- [ ] Generate candidate findings by target/content/timing scopes.
- [ ] Enforce minimum evidence states.
- [ ] Produce bounded adjustment recommendations and explanations.
- [ ] Do not write accepted rules automatically.

**Acceptance criteria:**
- Learning output names sample size, comparison baseline, primary metric, evidence state, and proposed adjustment.

### Task 3: Apply accepted target/engagement rules

**Files:**
- Modify: `relationship.js`
- Modify: `engagement.js`

**Steps:**
- [ ] Apply only accepted rules matching current context.
- [ ] Clamp total learned adjustment to configured bounds.
- [ ] Return base score, learned adjustment, and final score separately.

**Acceptance criteria:**
- Operator can see whether a target ranks highly because of base evidence or an accepted learned rule.

### Task 4: Apply accepted content/scheduler rules

**Files:**
- Modify: `strategy.js` / `opportunity.js`
- Modify: `scheduler.js`

**Steps:**
- [ ] Apply accepted topic/format/timing adjustments after base scoring.
- [ ] Preserve viral urgency and human override.
- [ ] Never bypass quality gates.

**Acceptance criteria:**
- Scheduler/content recommendations show historical account evidence rather than generic best-practice claims.

### Task 5: Add Learned Strategy dashboard

**Files:**
- Modify: `dashboard.js`

**Steps:**
- [ ] Show suggested/accepted/retired rules.
- [ ] Display evidence state, sample size, primary metric, baseline comparison, proposed adjustment.
- [ ] Add explicit `Accept` and `Retire` actions.
- [ ] Show which current recommendations were influenced by accepted rules.

**Acceptance criteria:**
- Human can audit and control every persistent learned adjustment.

### Task 6: Add agent bridge interface

**Files:**
- Modify: `agent_bridge.js`

**Produces:**

```text
learning
learning-refresh
learning-accept
learning-retire
```

`learning-refresh` computes suggestions; it does not accept them.

### Task 7: Connect algorithm evidence changes

**Files:**
- Modify: `learning.js`
- Modify: `docs/ALGORITHM_EVIDENCE_LEDGER.md` operational procedure only if needed.

**Steps:**
- [ ] Store evidence-ledger mechanism tags in relevant learned rules when applicable.
- [ ] When a mechanism is marked `RETIRED` or materially changed, surface linked learned rules for review rather than silently applying them forever.

**Acceptance criteria:**
- Algorithm/public-code changes can invalidate or prompt review of related internal learned rules.

### Task 8: Synchronize docs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`
- Modify: `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`

---

## Phase 5 Completion Criteria

1. system can generate evidence-backed strategy suggestions;
2. suggestions do not affect scoring until human acceptance;
3. accepted adjustments are bounded and explainable;
4. target, engagement, content, and timing recommendations can learn from account-specific outcomes;
5. one viral outlier cannot rewrite strategy;
6. stale learned rules can be retired;
7. algorithm evidence changes can trigger rule review;
8. the dashboard shows base vs learned contribution to recommendations.