# Phase 1: Workflow Foundation + Triage Intelligence Implementation Plan

**Goal:** Make every saved research signal enter a persistent triage workflow, score it separately for reach/follow/conversation/relationship potential, let AI recommend a route, let the human choose or override that route, and enforce a human approval boundary before a main-feed item becomes publishable.

**Architecture:** Keep `store.js` as the persistence owner. Add `pipeline.js` as the workflow/domain owner and `opportunity.js` as the transparent opportunity-scoring owner. `dashboard.js` and `agent_bridge.js` consume those interfaces; they must not duplicate queue transitions or scoring formulas. Preserve the current `drafts.status = ready` contract temporarily as a compatibility bridge for `automation.js`: only an explicit human approval action may set a draft to `ready` during this phase.

**Tech Stack:** Node.js 24, built-in `node:sqlite`, existing Bootstrap dashboard, existing `strategy.js`, `store.js`, `drafting.js`, `dashboard.js`, and `agent_bridge.js`.

## Global Constraints

- Saving a candidate must create or ensure a persistent triage queue item.
- Unsaving removes the preference signal but does not silently delete workflow history; a queued item is dismissed explicitly with the Ignore route/state.
- Existing saved candidates that already have a recorded `candidate_actions` distribution action must not re-enter active triage during backfill.
- AI may score and recommend; the human may override the route.
- Main-feed routes are `original`, `quote`, `thread`, and `repost`.
- Engagement route is `reply`; it is reviewable but not scheduler-driven in this phase.
- Non-distribution routes are `research`, `watch`, and `ignore`.
- AI-controlled workflow may reach `needs_review`; only an explicit human action may move a main-feed item to `approved`.
- Until the scheduler migration is implemented, human approval also sets the associated draft to `ready` so the existing automation path remains functional.
- `update-draft` from an agent must no longer be able to self-authorize publication by directly setting `ready`; a request for readiness becomes a review request.
- Do not add scheduling, media, experiment, or engagement-discovery machinery in this phase.
- Relationship Potential in Phase 1A is only a bootstrap from currently available `audience_profiles`/source context. Phase 1B replaces that shallow context with durable relationship profiles/events and TargetScore; do not pull Phase 1B persistence into this phase.
- Do not add a new dependency or database service.
- Do not add or run tests unless separately requested.

## Current Owners to Preserve

- `store.js`: SQLite schema, candidate persistence, drafts, action history, audience, metrics.
- `strategy.js`: niche taxonomy and current Direct/Quote/Repost/Reply/Ignore recommendation rules.
- `drafting.js`: draft composition and 50-point publishability analysis.
- `dashboard.js`: human-facing web controls.
- `agent_bridge.js`: JSON-in/JSON-out agent interface.
- `automation.js`: currently consumes `drafts.status = ready`; it is intentionally not redesigned in this phase.

## Target Phase-1 State

```text
candidate
   |
   | Save
   v
queue_items(status=triage)
   |
   +--> opportunity.js
   |      reachPotential
   |      followPotential
   |      conversationPotential
   |      relationshipPotential
   |
   +--> AI route recommendation
   |
   v
human route / override
   |
   +--> research/watch/ignore   (no draft required)
   |
   +--> reply                   (engagement lane; review only)
   |
   +--> original/quote/thread/repost
             |
             v
          drafting
             |
             v
        needs_review
             |
          HUMAN ONLY
             v
          approved
             |
             +--> compatibility: associated draft.status = ready
```

## Phase-1 Data Model

Add only fields required by this phase. Later scheduling/media/experiment fields stay out until their owning phase.

```sql
CREATE TABLE IF NOT EXISTS queue_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_key TEXT NOT NULL UNIQUE,
  lane TEXT NOT NULL DEFAULT 'main',
  pipeline TEXT NOT NULL DEFAULT 'triage',
  status TEXT NOT NULL DEFAULT 'triage',
  reach_potential REAL NOT NULL DEFAULT 0,
  follow_potential REAL NOT NULL DEFAULT 0,
  conversation_potential REAL NOT NULL DEFAULT 0,
  relationship_potential REAL NOT NULL DEFAULT 0,
  recommended_pipeline TEXT NOT NULL DEFAULT '',
  routing_reason TEXT NOT NULL DEFAULT '',
  draft_id INTEGER,
  human_approved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(candidate_key) REFERENCES candidates(key),
  FOREIGN KEY(draft_id) REFERENCES drafts(id)
);
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_queue_status_updated
  ON queue_items(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_pipeline_status
  ON queue_items(pipeline, status, updated_at DESC);
```

Backfill rule executed once through idempotent SQL at store initialization:

```sql
INSERT OR IGNORE INTO queue_items (
  candidate_key, lane, pipeline, status,
  reach_potential, follow_potential, conversation_potential, relationship_potential,
  recommended_pipeline, routing_reason, draft_id, human_approved_at, created_at, updated_at
)
SELECT
  c.key, 'main', 'triage', 'triage',
  0, 0, 0, 0,
  '', '', NULL, NULL, c.updated_at, c.updated_at
FROM candidates c
WHERE c.saved = 1
  AND NOT EXISTS (
    SELECT 1 FROM candidate_actions a WHERE a.candidate_key = c.key
  );
```

This keeps previously quoted/reposted/replied saved sources out of active triage.

## Opportunity Score Contract

Create `opportunity.js` with one public function:

```js
scoreOpportunity(candidate, context = {})
```

Input context:

```js
{
  preference: { savedCount, tags, keywords },
  relationship: null | {
    relevanceScore,
    followsYou,
    youFollow,
    nicheTags,
  },
  now: Date.now(),
}
```

Output:

```js
{
  reachPotential: 0..100,
  followPotential: 0..100,
  conversationPotential: 0..100,
  relationshipPotential: 0..100,
  breakdown: {
    reach: { freshness, momentum, traction, breadth },
    follow: { niche, preference, specificity, utility, identity },
    conversation: { discussion, questionTradeoff, freshness, specificity },
    relationship: { available, relevance, followsYou, youFollow, mutual, topicOverlap },
  }
}
```

### Reach Potential formula

Use a transparent additive 100-point heuristic:

- freshness: 0-25
  - X <= 1h: 25
  - <= 3h: 22
  - <= 6h: 18
  - <= 12h: 14
  - <= 24h: 10
  - <= 48h: 5
  - older/unknown: 2
  - GitHub/HN may use `timestamp` with 7-day falloff rather than X's 48h buckets.
- momentum: 0-35
  - if `candidate.viral.score` exists, map `0..100 -> 0..35`;
  - otherwise map `candidate.score` conservatively `0..100 -> 0..20` so generic candidate rank does not masquerade as virality.
- traction: 0-20
  - use logarithmic scaling from X `views + likes*20 + retweets*50 + replies*20` when metrics exist;
  - GitHub uses stars/star velocity;
  - HN uses points/comments;
  - missing metrics = 0.
- breadth: 0-20
  - 4 points per distinct matched keyword up to 12;
  - 4 points per distinct niche tag up to 8.

Clamp final score to 0-100.

### Follow Potential formula

- niche: 0-30 from `candidate.niche.score / 50 * 30`.
- preference: 0-20 from overlap with the existing saved preference profile:
  - tag matches contribute 5 each;
  - matched-keyword overlaps contribute 2 each;
  - divide/cap so a large saved library cannot push above 20.
- specificity: 0-20
  - precise matched keywords: up to 12;
  - concrete technical markers in source text such as version numbers, percentages, code/CLI syntax, repository/docs/API terms: up to 8.
- utility: 0-20
  - detect explicit implementation/evidence cues such as benchmark, latency, cost, install, CLI, SDK, API, repo, code, test, bug, failure, fix, config, architecture; one point bucket per distinct cue group, capped at 20.
- identity: 0-10
  - 10 when a core account pillar (`agents`, `models`, `devtools`, `infra`) is present;
  - 7 for `builders`/`jobs/career` with technical context;
  - 4 for `business` with technical context;
  - 0 otherwise.

Clamp final score to 0-100.

### Conversation Potential formula

- discussion: 0-35
  - X only: logarithmic scaling from replies and reply/view ratio;
  - non-X or missing metrics: 0.
- question/trade-off: 0-20
  - 10 if source contains a real question mark or explicit compare/vs/better/worse/trade-off/bottleneck/failure language;
  - another 10 if the source contains a technical decision boundary such as cost, latency, reliability, limits, context, security, compatibility.
- freshness: 0-20 using the same X freshness buckets scaled to 20.
- specificity: 0-15 from precise matched-keyword count.

Clamp final score to 0-100.

### Relationship Potential bootstrap formula

Phase 1A uses only relationship evidence already available before Phase 1B:

- relevance: 0-40 from `audience_profiles.relevance_score / 50 * 40` when source author matches an observed audience profile;
- follows-you: +20;
- you-follow: +10;
- mutual: +15 when both follow flags are true;
- topic overlap: 0-15 from overlap between candidate niche tags and the matched audience profile's niche tags.

If the source author has no observed audience profile, return `relationshipPotential = 0` with `breakdown.relationship.available = false` rather than pretending the system knows the relationship.

Clamp final score to 0-100. Phase 1B replaces this bootstrap with `RELATIONSHIP_INTELLIGENCE.md` TargetScore/event/stage context.

These are account-internal heuristics; never label them Phoenix/X scores.

## Pipeline Contract

Create `pipeline.js` with these exported constants/functions:

```js
export const PIPELINES = [
  'triage',
  'original',
  'quote',
  'thread',
  'reply',
  'repost',
  'research',
  'watch',
  'ignore',
];

export const QUEUE_STATUSES = [
  'triage',
  'researching',
  'drafting',
  'needs_review',
  'approved',
  'watching',
  'ignored',
];

export function saveCandidateToWorkflow(key, saved = true) { ... }
export function refreshQueueRecommendation(key, context = {}) { ... }
export function inspectWorkflow(key) { ... }
export function routeCandidate(key, pipeline, { actor = 'human', reason = '' } = {}) { ... }
export function requestQueueReview(key) { ... }
export function approveQueueItem(key) { ... }
export function ignoreQueueItem(key, reason = '') { ... }
```

Behavior:

- `saveCandidateToWorkflow(key, true)`:
  1. marks candidate saved;
  2. ensures queue item;
  3. computes opportunity scores;
  4. runs current `recommendDistributionAction` with available context;
  5. stores `recommended_pipeline` plus the recommendation reason but leaves `pipeline = triage` until a route is explicitly chosen.
- `saveCandidateToWorkflow(key, false)` only removes the saved preference flag. It does not delete the queue row.
- `refreshQueueRecommendation` recalculates the four scores and recommendation reason; it does not silently overwrite an already human-selected pipeline.
- `inspectWorkflow` returns candidate, queue row, draft/actions, current score breakdown, and stored recommendation without mutating workflow state.
- `routeCandidate` validates the pipeline. Human routing may choose any route. AI routing may recommend but must not advance a main-feed item beyond `needs_review`.
- route status mapping:
  - `research` -> `researching`
  - `watch` -> `watching`
  - `ignore` -> `ignored`
  - `original|quote|thread|repost|reply` -> `drafting` when a draft is required/created, otherwise `needs_review` for repost.
- `requestQueueReview` requires a draft for `original|quote|thread|reply`, computes the existing draft quality analysis, and sets queue status `needs_review`; it does not set draft `ready`.
- `approveQueueItem` is the human-only compatibility boundary:
  - reject if pipeline is not a main-feed pipeline;
  - for `original|quote|thread`, require existing draft and `scoreDraft(...).publishable === true`;
  - for `repost`, no draft is required;
  - set queue status `approved`, `human_approved_at = now`;
  - for routes backed by a draft, set `draft.status = ready` so current `automation.js` can continue operating until Phase 3 replaces draft-only queue consumption.

Do not make `pipeline.js` an HTTP/UI module.

---

### Task 1: Add `queue_items` persistence

**Files:**
- Modify: `store.js`

**Interfaces:**
- Consumes: existing `candidates`, `drafts`, and `candidate_actions` tables.
- Produces: queue row decoder plus low-level queue persistence/query functions used by `pipeline.js`.

**Steps:**
- [ ] Add the Phase-1 `queue_items` table and two indexes to the existing startup schema block.
- [ ] Add the idempotent saved-candidate backfill that excludes candidates already present in `candidate_actions`.
- [ ] Add `decodeQueueItem(row)` returning camelCase fields including `recommendedPipeline` separately from the human-selected `pipeline`.
- [ ] Export `ensureQueueItem(candidateKey, defaults = {})`; insert only when missing and return the decoded row.
- [ ] Export `getQueueItem(id)` and `getQueueItemByCandidate(candidateKey)`.
- [ ] Export `listQueueItems({ status, pipeline, lane, limit = 100 })` ordered by `updated_at DESC`.
- [ ] Export `saveQueueItem(item)` for known queue fields only; preserve `created_at` and update `updated_at`.
- [ ] Export `countQueueItems({ status })` for nav/status badges.
- [ ] Keep `markCandidateSaved` as a low-level persistence method; workflow behavior belongs to `pipeline.js` so queue/scoring logic is not embedded in SQLite helpers.

**Acceptance criteria:**
- Opening the store against an existing database creates `queue_items` without deleting data.
- Previously saved candidates with no recorded action appear once in triage.
- Previously used saved candidates do not reappear as active triage items.

### Task 2: Implement transparent opportunity scoring

**Files:**
- Create: `opportunity.js`

**Interfaces:**
- Consumes: candidate objects already decoded by `store.js`, saved preference profile, optional relationship profile.
- Produces: the exact `scoreOpportunity()` contract above.

**Steps:**
- [ ] Implement small pure helpers for clamp, age/freshness bucket, logarithmic traction scaling, keyword/specificity markers, utility cues, and relationship contribution.
- [ ] Implement Reach Potential exactly from the four documented component groups.
- [ ] Implement Follow Potential exactly from the five documented component groups.
- [ ] Implement Conversation Potential exactly from the five documented component groups.
- [ ] Return integer scores and integer breakdown components so UI output is stable/readable.
- [ ] Do not import SQLite or mutate state from this module.

**Acceptance criteria:**
- The same candidate/context always produces the same four scores and component breakdown.
- A fresh high-velocity X post can be high-Reach without automatically being high-Follow.
- A precise core-niche technical source can be high-Follow even when its public traction is modest.

### Task 3: Add workflow/pipeline ownership

**Files:**
- Create: `pipeline.js`
- Modify: `strategy.js`

**Interfaces:**
- Consumes: `store.js`, `opportunity.js`, existing `recommendDistributionAction`, and current preference/audience data.
- Produces: the `pipeline.js` public workflow functions documented above.

**Steps:**
- [ ] Define the allowed pipelines/statuses as plain constants; do not create class/factory abstractions.
- [ ] Add a small helper in `strategy.js` only if needed to map the current Direct/Quote/Repost/Reply/Ignore output to the expanded pipeline vocabulary; keep opportunity formulas out of `strategy.js`.
- [ ] Implement `saveCandidateToWorkflow` so Save becomes candidate preference + triage creation + scoring/recommendation refresh.
- [ ] When the X candidate title is an `@handle`, look up the matching `audience_profiles` record and pass it as optional relationship context; missing relationship data is valid.
- [ ] Implement explicit routing/status mapping.
- [ ] For human-selected `original|quote|thread|reply`, create/reuse a draft scaffold and attach `draft_id` to the queue row.
- [ ] For `repost`, move directly to `needs_review` because no text draft is required.
- [ ] For `research`, `watch`, and `ignore`, do not create drafts.
- [ ] Implement `requestQueueReview` and `approveQueueItem` with the human boundary documented above.

**Acceptance criteria:**
- Dashboard and agent callers can perform Save, route, review request, and approval through one domain owner rather than duplicating queue mutations.
- No AI-facing method can set a main-feed queue item to approved.

### Task 4: Replace direct Save calls with workflow Save

**Files:**
- Modify: `dashboard.js`
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: `saveCandidateToWorkflow()` from `pipeline.js`.
- Produces: consistent Save behavior from both UI and agent ingestion/draft creation.

**Steps:**
- [ ] Replace dashboard `/candidate/save` use of `markCandidateSaved` with `saveCandidateToWorkflow`.
- [ ] Replace agent `ingest` saved behavior with `saveCandidateToWorkflow`.
- [ ] Replace `create-draft`'s direct save flag mutation with `saveCandidateToWorkflow` before routing/creating a draft.
- [ ] Preserve existing response/redirect behavior for Save and ingest.
- [ ] Do not auto-route a newly saved candidate; leave `pipeline = triage` while storing the AI recommendation reason/scores.

**Acceptance criteria:**
- Saving through either dashboard or agent creates exactly one triage queue item.
- Saving the same candidate twice is idempotent.
- Unsaving does not remove the queue/history row.

### Task 5: Add route-after-Save and Queue dashboard UX

**Files:**
- Modify: `dashboard.js`

**Interfaces:**
- Consumes: queue read functions plus `routeCandidate` and score/recommendation data.
- Produces: human-facing Queue tab and candidate routing controls.

**Steps:**
- [ ] Add `queue` to allowed dashboard sources and navigation.
- [ ] Add `queueView()` grouped in this order: `triage`, `researching`, `drafting`, `needs_review`, `approved`, `watching`.
- [ ] On every saved candidate card, show four compact badges: `Reach N`, `Follow N`, `Conversation N`, `Relationship N`.
- [ ] Show `Recommended: <ACTION>` and the stored routing reason without presenting it as mandatory.
- [ ] After Save, show an inline route form using Bootstrap select/button with Original, Quote, Thread, Reply, Repost, Research only, Watch, Ignore.
- [ ] Add `POST /queue/route` accepting `key`, `pipeline`, and `returnTo`; call `routeCandidate(..., { actor: 'human' })`.
- [ ] Show current pipeline/status badges on candidate cards when a queue item exists.
- [ ] In Queue view, include source text/metrics/niche, opportunity score breakdown summary, route recommendation, selected pipeline, current status, draft badge/link when present, and source link.
- [ ] Keep current Saved, Drafts, Viral, Audience, and other views intact.

**Acceptance criteria:**
- A newly saved source immediately has a visible route selector.
- Human route choice persists across refreshes.
- Queue view clearly distinguishes AI recommendation from human-selected route.

### Task 6: Enforce review and human approval in the dashboard

**Files:**
- Modify: `dashboard.js`
- Modify: `drafting.js` only if a small reusable hard-gate helper is needed; otherwise reuse `scoreDraft` directly.

**Interfaces:**
- Consumes: `requestQueueReview()` and `approveQueueItem()`.
- Produces: explicit review-request and approval controls.

**Steps:**
- [ ] Remove `ready` as a direct editable human/agent draft status from the normal draft status selector; present `draft` plus workflow-controlled status information instead.
- [ ] Add a `Request review` action from a routed draft; call `requestQueueReview`.
- [ ] For `needs_review` main-feed items, show `Approve for publishing` only when the current draft analysis is publishable; show the failing rubric/gate explanation otherwise.
- [ ] `POST /queue/approve` must be the only dashboard path that calls `approveQueueItem`.
- [ ] After approval, display `Approved` and the compatibility `Draft ready` state.
- [ ] Do not add a Send/Publish button in this phase; current automation remains the publishing consumer.

**Acceptance criteria:**
- Editing a draft cannot make it automation-ready by itself.
- Only the explicit human approval action can set the associated draft to `ready`.

### Task 7: Update the agent bridge to request review instead of self-approval

**Files:**
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: queue/workflow methods from `pipeline.js`.
- Produces: stable JSON commands for queue inspection, routing, recommendation refresh, and review request; no agent command for human approval.

**Steps:**
- [ ] Change `update-draft` handling so `payload.status === 'ready'` means `requestQueueReview(candidateKey)` after saving/scoring; keep the draft itself as `draft` until human approval.
- [ ] Return `{ approvalRequired: true, queueItem }` when a readiness request reaches `needs_review`.
- [ ] Add `route` command: `{ key, pipeline, reason? }` using actor `agent`; allow route selection but not approval.
- [ ] Add `workflow` command to inspect one candidate plus queue row, draft, actions, scores, and recommendation.
- [ ] Extend `queue` output to include queue items; preserve the current draft list field temporarily for compatibility.
- [ ] Keep `record-action`, `audience`, `research`, and `performance` behavior unchanged.
- [ ] Do not add an `approve` bridge command; approval remains dashboard/user action in this phase.
- [ ] Update the usage error string with the new commands.

**Acceptance criteria:**
- An agent can save, route, draft, and request review.
- An agent cannot directly move a main-feed item to `approved` or make a draft `ready`.

### Task 8: Synchronize operating documentation after implementation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/AGENT_WORKFLOW.md`
- Modify: `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`

**Interfaces:**
- Consumes: implemented command names/status semantics.
- Produces: docs that describe current behavior rather than planned behavior for Phase 1.

**Steps:**
- [ ] Move Save -> triage, route-after-Save, opportunity scores, Queue view, and human approval from "planned" language to current behavior.
- [ ] Document the new `route` and `workflow` agent commands and the changed `update-draft status=ready` semantics.
- [ ] State that `draft.status = ready` remains a temporary compatibility bridge until scheduler-driven `queue_items` consumption is implemented in Phase 3.
- [ ] Keep media, experiments, Engage Next discovery, follower conversion, and learned scheduling explicitly marked planned.

**Acceptance criteria:**
- A new agent reading the repo cannot mistake AI review request for human approval or assume later phases already exist.

## Phase-1 Completion Criteria

Phase 1 is complete when all of the following are true:

1. Save from dashboard or agent creates/ensures one triage queue row.
2. Existing unused saved candidates are backfilled; already distributed saved candidates are not reactivated.
3. Every active triage item shows separate Reach, Follow, and Conversation scores with explanations.
4. AI recommendation and human-selected route are stored separately in behavior, even if both are visible on the same queue item.
5. Human can route to Original, Quote, Thread, Reply, Repost, Research, Watch, or Ignore.
6. Main-feed text routes create/reuse a draft; Research/Watch/Ignore do not.
7. Drafting can reach `needs_review` without becoming `ready`.
8. Only the dashboard human approval action can set queue `approved` and compatibility draft `ready`.
9. Agent bridge cannot self-approve.
10. Current `automation.js` can continue consuming only human-approved compatibility-ready drafts until the Phase-3 scheduler migration.
