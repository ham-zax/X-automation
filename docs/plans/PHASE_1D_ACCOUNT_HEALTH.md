# Phase 1D: Account Health, Visibility Observability, and Lenient Guardrails Implementation Plan

**Goal:** Add an account-level observability layer that tracks real visibility/enforcement evidence, target saturation, reply repetition, network quality, and interaction yield while keeping most behavioral signals advisory rather than imposing arbitrary activity quotas.

**Architecture:** Add `health.js` as the owner of derived HEALTHY/WATCH/CONSTRAINED state and soft health diagnostics. Keep raw relationship events in Phase 1B, engagement decisions in `engagement.js`, writing/duplicate gates in Phase 2, and experiment/measurement ownership in Phase 4. Persist observed health/visibility events in SQLite with provenance; derive constraints only from that inspectable state.

**Tech Stack:** Node.js 24, built-in `node:sqlite`, existing `store.js`, Phase-1B `relationship.js`/relationship events, Phase-1C `engagement.js`/queue items, Bootstrap dashboard, existing authenticated X read/browser facilities.

## Global Constraints

- This phase is advisory-first.
- `WATCH` may lower priority or create a warning; it must not block a useful human-approved action by itself.
- `CONSTRAINED` requires observed platform/visibility evidence, a current platform/project hard boundary, or an item-level duplicate hard failure owned by the relevant subsystem.
- Do not add fixed daily reply caps.
- Do not add fake-human timing, circadian simulation, random jitter, typing delays, browser-fingerprint tactics, or other evasion machinery.
- Genuine active-conversation bursts are healthy by default when replies remain substantive.
- Target saturation is a bounded modifier, not an automatic ban.
- Exact/near-duplicate content may remain a hard stop; repeated archetype/style is a warning unless it is also near-duplicate.
- Under the Hood data is recorded only when actually observable to the authenticated account; absence of the surface is not a health failure.
- Do not add a new database service or external ML/embedding dependency.
- Use existing/native text-similarity facilities before considering embeddings.
- Do not add or run tests unless separately requested.

## File Responsibility Map

### Create

- `health.js` — derived health state, saturation pressure, reply-repetition diagnostics, network-quality summaries, InteractionYield, and health explanations.

### Modify

- `store.js` — persisted health observations and provenance reads/writes.
- `relationship.js` — expose relationship-event aggregates consumed by health; do not duplicate health formulas.
- `engagement.js` — consume soft saturation/repetition/health modifiers and hard observed constraints.
- `dashboard.js` — Account Health view and health warnings on Engage Next.
- `agent_bridge.js` — planned `account-health`, `health-observe`, and optional `health-under-the-hood` commands.
- existing authenticated X read owner — optionally read Under the Hood when the surface is available; no new browser abstraction.
- `AGENTS.md`, `docs/AGENT_WORKFLOW.md`, `README.md` — synchronize current behavior after implementation.

## Persistence Model

Add one append-only observation table rather than multiple health-specific state tables:

```sql
CREATE TABLE IF NOT EXISTS account_health_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL,
  source_ref TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  observed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_observed_at
  ON account_health_observations(observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_type_observed
  ON account_health_observations(type, observed_at DESC);
```

Supported initial observation types:

```text
under_the_hood_snapshot
visibility_label_observed
visibility_label_cleared
platform_challenge_observed
platform_restriction_observed
operator_note
```

Soft diagnostics such as saturation/repetition are derived from existing events/actions and need not create append-only rows every refresh unless the operator explicitly records a notable observation.

## Health State Contract

`health.js` exports:

```js
export const HEALTH_STATES = ['healthy', 'watch', 'constrained'];

export function calculateSaturationPressure(target, events, { now = Date.now() } = {}) { ... }
export function analyzeReplyRepetition(recentReplies, { targetUsername = null, topic = null } = {}) { ... }
export function summarizeNetworkQuality(relationshipProfiles, relationshipEvents, options = {}) { ... }
export function calculateInteractionYield(metrics) { ... }
export function deriveAccountHealth({ observations, relationshipSummary, engagementSummary, repetitionSummary }) { ... }
```

Return values must include component explanations rather than only totals.

## Saturation Pressure Contract

Inputs:

```text
interactions_7d
interactions_30d
unanswered_interactions_7d
consecutive_unanswered
last_our_interaction_at
last_target_response_at
last_conversation_continued_at
interaction_topic_diversity
active_conversation
```

Return:

```js
{
  pressure: 0..100,
  band: 'low' | 'mild' | 'meaningful' | 'high',
  modifiers: [],
  overrideReasons: [],
  explanation: '',
}
```

Starting semantics:

- more recent unanswered one-sided interactions increase pressure;
- recent target response/continued conversation reduces pressure;
- active bidirectional conversation reduces pressure substantially;
- topic diversity reduces concentration pressure;
- direct target question or new verified evidence can neutralize the pressure for the specific opportunity.

Do not hard-code a reject threshold based on `pressure` alone.

Numeric component weights are internal `EMPIRICAL_VARIABLE` defaults and must be exposed in `ALGORITHM_EVIDENCE_LEDGER.md`/dashboard explanations.

## Reply Repetition Contract

Use recent published replies from `candidate_actions`/relationship events.

Each reply should expose or infer one primary archetype:

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

Return:

```js
{
  exactDuplicate: false,
  nearDuplicate: false,
  archetypeConcentration: 0..100,
  phraseSimilarity: 0..100,
  warnings: [],
  examples: [],
}
```

Implementation ladder:

1. normalize whitespace/case/URLs/usernames;
2. exact comparison;
3. token/shingle/Jaccard similarity using local JavaScript only;
4. archetype concentration from stored metadata;
5. no embedding model/dependency in this phase.

Hard stop only when `exactDuplicate` or high-confidence near-duplicate is true. Archetype/phrase concentration otherwise remains a warning/modifier.

## Network Quality Contract

`summarizeNetworkQuality()` exposes components, not a secret-score analogy:

```text
target_diversity
class_diversity
topic_diversity
author_response_rate
conversation_continuation_rate
recurring_relationship_count
connected_target_count
mutual_target_count
top_target_concentration
```

Optional summary score:

```js
{
  score: 0..100,
  components,
  trend,
}
```

The component values remain authoritative in the UI.

## InteractionYield Contract

Starting internal formula:

```text
(
  author_responses
+ 2 * continued_conversations
+ 3 * new_recurring_relationships
+ 3 * relevant_target_follows
+ 4 * new_mutual_connections
) / max(meaningful_interactions, 1)
```

Always return raw numerator components with the composite.

Groupable dimensions:

```text
target_class
target_score_bucket
target_size_bucket
reply_age_bucket
reply_archetype
relationship_stage_before
topic
```

Phase 4 owns richer cohort measurement. Phase 1D only supplies direct relationship-event-derived diagnostics and the formula contract.

## Engage Next Integration

`engagement.js` consumes:

```js
{
  saturationPressure,
  repetitionWarning,
  healthState,
  observedConstraint,
}
```

Rules:

### Hard reject

- no concrete contribution;
- exact/near-duplicate reply;
- exact source action already completed with no new value;
- expired and no active conversation;
- observed platform/project hard constraint.

### Soft modifier/warning

- target saturation;
- repeated archetype;
- weak recent InteractionYield;
- high target concentration;
- crowded conversation;
- similar point recently made.

Active bidirectional conversation, direct target question, or new verified evidence may offset soft penalties.

## Under the Hood Observation Contract

Prefer a manual/observable path that cannot fabricate data.

If existing authenticated browser facilities can load the available account surface, the reader may return:

```js
{
  available: true,
  capturedAt,
  accountLabels: [],
  postLabels: [],
  period: null,
  rawSummary: {},
}
```

If unavailable:

```js
{
  available: false,
  reason: 'surface unavailable or not readable',
}
```

Do not infer labels from reach changes.

The dashboard should also allow an operator to record a visible label/challenge/restriction with a note/provenance when automatic parsing is unavailable.

## Dashboard Contract

Add **Account Health** navigation.

Sections:

### State

```text
HEALTHY | WATCH | CONSTRAINED
```

with explicit reasons and provenance.

### Visibility

- latest Under the Hood snapshot when available;
- observed/cleared labels;
- challenge/restriction observations;
- last clean/known state.

### Interaction health

- meaningful interactions 7d/30d;
- author response rate;
- continuation rate;
- InteractionYield;
- repeated archetype warning;
- top-target concentration;
- saturation distribution.

### Network quality

- target/class/topic diversity;
- recurring/connected/mutual relationships;
- top target concentration;
- niche-aligned follower context when already available.

Engage Next cards show soft warnings but retain the approve button unless a true hard stop exists.

## Agent Bridge Contract

Planned commands:

```text
account-health
health-observe
health-under-the-hood
```

### `account-health`

Read-only derived state/metrics.

### `health-observe`

Input requires explicit provenance:

```json
{
  "type": "visibility_label_observed",
  "severity": "constraint",
  "source": "x_under_the_hood",
  "sourceRef": "...",
  "metadata": {},
  "observedAt": 0
}
```

Reject unsupported speculative observation types that pretend a hidden detector score was observed.

### `health-under-the-hood`

Attempts a bounded authenticated read and records a snapshot only if observable.

## Tasks

### Task 1: Add account-health observation persistence

**Files:**
- Modify: `store.js`

**Interfaces:**
- Produces: `recordAccountHealthObservation`, `listAccountHealthObservations`, `getLatestHealthObservation`.

**Steps:**
- [ ] Create the append-only observation table/indexes.
- [ ] Add decode/read/write functions with JSON metadata parsing.
- [ ] Preserve provenance and observation timestamp.
- [ ] Do not store a guessed health state as raw evidence.

**Acceptance criteria:**
- Observable label/restriction snapshots can be stored without modifying relationship/action history.

### Task 2: Add `health.js` derived diagnostics

**Files:**
- Create: `health.js`

**Interfaces:**
- Consumes: health observations, relationship profiles/events, recent reply/action text.
- Produces: health state, saturation, repetition, network-quality, and InteractionYield summaries.

**Steps:**
- [ ] Implement the exported contracts above using local JavaScript/native data.
- [ ] Keep `WATCH` signals advisory.
- [ ] Derive `CONSTRAINED` only from supported observed hard evidence/input boundaries.
- [ ] Return all component explanations.

**Acceptance criteria:**
- A high-volume active conversation with reciprocal replies remains HEALTHY unless other evidence says otherwise.
- Repeated unanswered one-sided activity can become WATCH without preventing a human-approved useful reply.

### Task 3: Add reply archetype/repetition metadata

**Files:**
- Modify: `relationship.js`
- Modify: `engagement.js`
- Modify: `store.js` only if existing action/event metadata cannot retain archetype.

**Interfaces:**
- Produces: primary reply archetype plus recent-repetition inputs.

**Steps:**
- [ ] Store archetype on published reply event/action metadata.
- [ ] Add bounded recent-reply reads by target/topic/global scope.
- [ ] Feed recent replies into `analyzeReplyRepetition`.
- [ ] Hard-reject only actual duplicates/near-duplicates; expose archetype concentration as warning.

**Acceptance criteria:**
- The system can distinguish five different informed questions from five near-identical templated questions.

### Task 4: Integrate soft health modifiers into Engage Next

**Files:**
- Modify: `engagement.js`
- Modify: `dashboard.js`

**Interfaces:**
- Consumes: health summary, saturation pressure, repetition summary.
- Produces: priority modifiers/warnings and hard-stop reason when applicable.

**Steps:**
- [ ] Add bounded soft modifier for saturation/concentration/repetition.
- [ ] Add active-conversation/direct-question/new-evidence overrides.
- [ ] Preserve human override for all WATCH-only conditions.
- [ ] Show warnings and component reason on Engage Next cards.

**Acceptance criteria:**
- Target saturation changes ranking but cannot block a valuable response by itself.

### Task 5: Add Account Health dashboard

**Files:**
- Modify: `dashboard.js`

**Interfaces:**
- Consumes: `deriveAccountHealth`, observations, network-quality summary.
- Produces: Account Health operator view.

**Steps:**
- [ ] Add Account Health navigation/state badge.
- [ ] Show reasons/provenance for state.
- [ ] Show visibility observations and Under the Hood snapshot when available.
- [ ] Show InteractionYield plus raw components.
- [ ] Show target/class/topic diversity and concentration.
- [ ] Avoid bot/reputation probability language.

**Acceptance criteria:**
- The operator can tell whether a warning is actual platform evidence or an internal efficiency diagnostic.

### Task 6: Add health bridge commands and optional Under the Hood read

**Files:**
- Modify: `agent_bridge.js`
- Modify: existing authenticated X read owner only if it can reuse the current session path.

**Interfaces:**
- Produces: `account-health`, `health-observe`, `health-under-the-hood`.

**Steps:**
- [ ] Add read-only health summary command.
- [ ] Add provenance-required observation recording.
- [ ] Reuse current authenticated browser/read facilities for Under the Hood when available.
- [ ] Return `available:false` cleanly instead of inventing a result.

**Acceptance criteria:**
- Agents can inspect health and record actual observable evidence without raw SQLite writes.

### Task 7: Synchronize operating documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/AGENT_WORKFLOW.md`
- Modify: `docs/ALGORITHM_EVIDENCE_LEDGER.md`
- Modify: `docs/ACCOUNT_HEALTH_AND_VISIBILITY.md`

**Steps:**
- [ ] Mark bridge/UI features current only after implementation exists.
- [ ] Keep reply volume/timing/saturation thresholds tagged as empirical variables.
- [ ] Document Under the Hood observations as actual evidence when available.

**Acceptance criteria:**
- Current vs planned behavior remains explicit.

## Phase 1D Completion Criteria

Phase 1D is complete when:

1. account health is derived as HEALTHY/WATCH/CONSTRAINED with reasons;
2. platform visibility observations are stored with provenance;
3. Under the Hood can be recorded when observable without fabricating unavailable data;
4. target saturation is a soft priority modifier;
5. genuine active-conversation bursts remain allowed;
6. exact/near-duplicate replies hard-stop while archetype repetition merely warns;
7. network-quality components and InteractionYield are visible;
8. Engage Next uses health context without arbitrary daily reply caps;
9. no evasion/timing-imitation machinery is introduced;
10. Phase 4/5 can later consume these diagnostics for experiments and learned strategy.
