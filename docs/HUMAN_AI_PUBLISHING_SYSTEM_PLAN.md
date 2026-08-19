# Human + AI Network Growth & Publishing System Implementation Plan

**Goal:** Turn the existing X research dashboard into a human-supervised network-growth operating system where every saved signal enters triage, relevant accounts accumulate relationship intelligence, current conversations are ranked for Engage Next, content opportunities are scored for Reach/Follow/Conversation/Relationship potential, owned content passes research/writing/media/quality gates, and follower/relationship outcomes feed back into future targeting, content, and timing.

**Architecture:** Keep SQLite as the system of record. Preserve the existing candidate, draft, action-history, audience, and performance owners; add one workflow owner for queue state, one relationship-intelligence owner, one opportunity-scoring owner, one engagement-opportunity owner, one account-health/visibility owner, one scheduler owner for main-feed timing, one experiment owner, and one learned-strategy owner. AI may discover, classify, research, recommend, draft, score, surface target/conversation opportunities, propose experiments, and propose timing, but human approval controls consequential main-feed publication and outbound replies.

**Tech Stack:** Node.js 24, built-in `node:sqlite`, Bootstrap dashboard, existing XActions/private X transport, existing `strategy.js`, `store.js`, `drafting.js`, `automation.js`, `agent_bridge.js`, and `x_http.js`.

## Global Constraints

- Preserve the account identity: **AI-native developer + builder**.
- The account promise is: **turn fast-moving AI/software signals into developer decisions: what changed, what actually works, what breaks, why it matters, and how to use it.**
- Saving a research signal must eventually place it into a human-visible triage queue rather than merely storing it as preference history.
- AI may recommend a distribution format, but the human can override it.
- Every original post, quote post, and thread opener must pass the same factuality, originality, niche, scannability, integrity, and quality gates before scheduling.
- Human approval is required before a queued main-feed item can become publishable. An explicit user command to publish a specific final item counts as human approval for that item.
- Replies remain relationship-building interactions and must not become unsolicited mass automation.
- Do not automate likes, follow churn, reciprocal engagement, or spammy keyword replies.
- Do not add fake-human timing, random delays, or other anti-detection/evasion logic. Scheduling optimizes freshness, audience coverage, semantic diversity, and self-cannibalization risk.
- Viral items may pre-empt normal queue order, but main-feed writes remain serialized; the system must not dump several queued items at once.
- Use current public X recommendation code as directional evidence, not a raw-points formula. Public action weights multiply predicted viewer probabilities rather than observed engagement counts.
- Timing defaults are editorial heuristics until enough `@ham_zax` outcome data exists to learn better slots.
- Optimize for **qualified follower conversion**, not raw reach alone. A post that attracts the wrong audience or produces no durable follow value can be strategically weaker than a smaller post that recruits relevant developers/builders.
- Opportunity scoring must keep **Reach Potential**, **Follow Potential**, **Conversation Potential**, and **Relationship Potential** separate. These are transparent internal heuristics, not simulations of X's Phoenix score.
- Target selection must use relationship intelligence (TopicFit, AudienceOverlap, ConversationQuality, ReplyVisibility, RelationshipPotential) with follower count only as a bounded secondary reach modifier.
- Conversation follow-ups should generally outrank endless cold insertion when a substantive response is warranted.
- Account-health behavior is advisory-first: target saturation, reply volume, repeated archetype, and conversation density are soft modifiers/experiment variables, not automatic bans.
- Genuine active-conversation bursts are healthy by default when the interaction is bidirectional and substantive.
- A hard account-level constraint requires observed visibility/enforcement evidence or an explicit platform/project boundary; do not invent hidden bot/reputation thresholds.
- Algorithm/tactic assumptions must be classified through `ALGORITHM_EVIDENCE_LEDGER.md` as CODE_BACKED, OFFICIAL_PRODUCT_OR_POLICY, EMPIRICAL_VARIABLE, or RETIRED.
- Experiments must compare independent future posts/cohorts; do not publish duplicate or near-duplicate A/B variants of the same content to manufacture a clean test.
- Engagement opportunities may be discovered and drafted automatically, but replies remain human-approved and must add concrete value.
- Per-post follower conversion is an attribution estimate unless X exposes direct post-level follow attribution. When multiple posts overlap a measurement window, store attribution confidence rather than claiming causality.
- No new database service is required; use the existing built-in SQLite store.
- No new front-end framework is required; Bootstrap is already installed and sufficient.
- This plan does not authorize tests. Implementation should use direct behavior checks and the repository's normal non-test static checks only when execution is requested.

## Existing System vs Planned System

### Already implemented

- niche/keyword classification;
- fresh X and viral-24h discovery;
- SQLite candidate persistence;
- Saved preference memory;
- candidate action history for direct/quote/repost/reply actions;
- audience follower/following snapshot and relevance scoring;
- Direct / Quote / Repost / Reply / Ignore recommendation logic;
- structured drafts and 50-point scoring;
- `ready` draft queue;
- ordinary posting cooldown;
- performance snapshots;
- agent JSON bridge;
- Bootstrap dashboard;
- Phase 1A persistent `queue_items` with Save -> Triage backfill/ownership;
- separate Reach / Follow / Conversation / Relationship opportunity scores;
- stored AI recommendation separate from human-selected pipeline;
- explicit Original / Quote / Thread / Reply / Repost / Research / Watch / Ignore routing;
- Queue dashboard plus `route` / `workflow` bridge commands;
- `needs_review` workflow state and explicit dashboard human approval boundary;
- temporary compatibility bridge where human approval alone sets an associated text draft to `ready`.

### Planned by this document

- final writing-prompt contract;
- hard pre-publication gate beyond the numeric rubric;
- media planning and upload attachment metadata;
- urgency/expiry model for viral content;
- coverage-aware scheduler with viral pre-emption;
- format-aware publishing for originals, quotes, and threads;
- post-publication measurement windows;
- learned timing and format recommendations from account outcomes;
- relationship profiles/events, target classes, TargetScore, and relationship-stage derivation;
- a dedicated Engagement Queue for relevant, time-sensitive reply and follow-up opportunities;
- Account Health / visibility observability with HEALTHY/WATCH/CONSTRAINED state, Under the Hood snapshots when observable, soft saturation/repetition diagnostics, Network Quality, and InteractionYield;
- an Experiment Engine for controlled content/network/timing hypotheses without duplicate posting;
- four-dimensional candidate scoring: Reach Potential, Follow Potential, Conversation Potential, and Relationship Potential;
- follower-conversion plus relationship-conversion analytics that prioritize recruiting and connecting with the target AI/developer/builder network over vanity reach;
- a learned-strategy layer that can propose bounded account-specific adjustments after enough evidence accumulates.

## Target Operating Loop

```text
DISCOVER / MANUAL INPUT
        |
        v
       SAVE
        |
        v
TRIAGE QUEUE
        |
        v
REACH / FOLLOW / CONVERSATION / RELATIONSHIP SCORING
        |
        v
AI ROUTING RECOMMENDATION
        |
        v
HUMAN ROUTE / OVERRIDE
        |
        +------------------------------+
        |                              |
        v                              v
MAIN-FEED LANE                   ENGAGEMENT LANE
        |                              |
        |                        TARGET/POST CONTEXT
        |                              |
        |                        REPLY DRAFT + REVIEW
        |                              |
        |                        HUMAN SEND / IGNORE
        |                              |
        |                        RELATIONSHIP OUTCOME
        |
        v
RESEARCH + VERIFY
        |
        v
ANGLE + NOVELTY CHECK
        |
        v
EXPERIMENT ASSIGNMENT (OPTIONAL)
        |
        v
FINAL-WRITING PROMPT
        |
        v
DRAFT + MEDIA PLAN
        |
        v
HARD GATES + QUALITY SCORE
        |
        v
HUMAN APPROVAL
        |
        v
TIMING ENGINE
        |
        v
SCHEDULED
        |
        v
PUBLISH
        |
        v
15m / 1h / 6h / 24h OUTCOMES
        |
        v
FOLLOWER-CONVERSION + EXPERIMENT ANALYSIS
        |
        v
LEARN
```

The viral lane shortens the middle of the loop but does not remove factual verification, quality gating, or human approval:

```text
VIRAL SIGNAL -> URGENT TRIAGE -> VERIFY -> DIRECT/QUOTE -> FAST DRAFT -> GATE -> HUMAN APPROVAL -> EARLIEST COVERAGE SLOT
```

## Planned Pipeline Types

| Pipeline | Purpose | Main-feed slot? | Draft required? | Human approval? |
| --- | --- | --- | --- | --- |
| `original` | Our own thesis, experiment, synthesis, workflow, benchmark, or decision rule | Yes | Yes | Yes |
| `quote` | Source remains visible evidence and our commentary creates a new information object | Yes | Yes | Yes |
| `thread` | Multi-step tutorial, benchmark, teardown, or argument that loses value when compressed | Yes | Yes | Yes |
| `reply` | Relationship building via a concrete technical contribution or informed question | No ordinary main-feed slot | Yes/reviewable text | Yes before sending unless explicitly authorized workflow says otherwise |
| `repost` | Rare pure amplification when commentary would not improve the source | Yes | No | Yes |
| `research` | Keep as evidence/input without turning it directly into distribution | No | No | No |
| `watch` | Re-evaluate a developing signal later | No | No | No |
| `ignore` | Remove weak/used/off-niche signal from active queue | No | No | No |

## Planned Queue States

```text
triage
  -> researching
  -> drafting
  -> needs_review
  -> approved
  -> scheduled
  -> publishing
  -> published
```

Alternative terminal states:

- `watching`
- `expired`
- `ignored`
- `failed`

AI-controlled transitions stop at `needs_review`. Only a human approval action can move a queued main-feed item to `approved`. The scheduler owns `approved -> scheduled`. The publisher owns `scheduled -> publishing -> published`.

## Data Model: Phase 1A current, later fields planned

Phase 1A now uses `queue_items` rather than overloading `drafts` with workflow responsibility. Later phases extend this workflow record with their owned fields.

Planned fields:

```text
id
candidate_key
lane
pipeline
status
priority
urgency
reach_potential
follow_potential
conversation_potential
relationship_potential
recommended_pipeline
draft_id
routing_reason
research_summary
target_username
target_tweet_id
target_score
relationship_stage
experiment_variant_id
media_plan_json
expires_at
human_approved_at
scheduled_at
schedule_reason
published_tweet_id
created_at
updated_at
```

Responsibilities remain separate:

- `candidates`: discovered/manual source material and preference state;
- `drafts`: text composition and quality score;
- `queue_items`: workflow, lane, approval, opportunity scores, urgency, experiment assignment, scheduling;
- `candidate_actions`: historical candidate-based actions actually performed;
- `audience_profiles`: raw follower/following observations and current niche relevance;
- `relationship_profiles`: strategic target classes, TargetScore components, relationship stage, and materialized interaction counters;
- `relationship_events`: append-only network/conversation history;
- `account_health_observations`: append-only visibility/enforcement observations with provenance; soft saturation/repetition/network-health diagnostics remain derived;
- `post_metrics` / `account_metrics`: raw outcomes;
- `publication_measurements`: fixed-window publication/follower-normalized outcomes;
- `learned_rules`: human-accepted bounded strategy adjustments after enough evidence.

Add experiment ownership without duplicating published content:

```text
experiments
-----------
id
name
hypothesis
dimension
status
created_at
started_at
ended_at

experiment_variants
-------------------
id
experiment_id
label
config_json
```

`queue_items.experiment_variant_id` assigns at most one active variant to a queued publication or engagement item. The experiment engine compares cohorts of naturally different future items; it must not schedule duplicate or near-duplicate copies merely to create an A/B pair.

Relationship ownership is specified in `RELATIONSHIP_INTELLIGENCE.md`: raw audience snapshots remain separate from strategic target profiles, and every meaningful interaction is preserved as an append-only relationship event before materialized stage/counters are recomputed.

Extend the existing outcome persistence so fixed measurement windows can be associated with follower state. At minimum each measured published item needs:

```text
measurement_window_minutes
followers_at_capture
follower_delta_since_publish
follows_per_1000_views
attribution_confidence
```

`follower_delta_since_publish` is an associated account-level change, not proof that one post caused every follow. `attribution_confidence` should be lower when multiple main-feed posts overlap the same measurement window.

## Opportunity Scoring Model

Every triaged candidate should expose four independent 0-100 scores before route selection.

### Reach Potential

Estimate broad-distribution opportunity from observable inputs such as:

- freshness and remaining shelf-life;
- current views/hour and engagement/hour when available;
- source authority/reach;
- breadth of developer relevance;
- whether the topic is accelerating across multiple sources.

Do not reward a candidate merely because it is sensational.

### Follow Potential

Estimate whether a target developer who sees the finished content would want more from `@ham_zax`:

- core niche fit;
- ability to demonstrate testing, technical judgment, or implementation depth;
- originality/distinct angle;
- practical usefulness;
- reinforcement of the account promise;
- fit with the audience the account is trying to recruit.

### Conversation Potential

Estimate whether the signal can create useful technical interaction:

- unresolved practitioner question;
- meaningful trade-off or disagreement;
- specificity sufficient for an informed reply;
- likelihood that a response would improve our research rather than merely increase comment count.

### Relationship Potential

Estimate whether the specific source author/conversation can compound into recurring relevant network value:

- target class and TargetScore;
- prior target responses;
- prior continued conversations;
- current relationship stage;
- shared recurring topics;
- follow/mutual state;
- realistic opportunity for repeated useful interaction.

The route recommender consumes all four scores. A high-Reach/low-Follow/low-Relationship item may become `repost`, `research`, or `ignore`; a medium-Reach/high-Follow/high-Relationship item may be a stronger `reply` or owned `original` opportunity than a generic viral source.

## Engagement Queue Design

The Engagement Queue is a filtered view over `queue_items` with `lane = engagement`, not a separate persistence system.

An engagement opportunity should include:

```text
source candidate
target author
target tweet
relationship state
niche fit
conversation potential
freshness / expiry
why we can add value
suggested contribution
draft reply
human decision
```

Primary sources of engagement opportunities:

- recent posts from niche-aligned accounts in `audience_profiles`;
- replies/comments under our own recent posts that deserve a substantive response;
- viral/niche candidates where `reply` is better than `quote` or `original`.

The system may rank and draft these opportunities automatically. It must not autonomously send unsolicited replies.

## Experiment Engine Design

Experiments are editorial hypotheses attached to naturally different future posts. One experiment should vary one primary dimension at a time when practical.

Supported initial dimensions:

- `style`: technical/helpful, opinionated, personal, humorous, contrarian;
- `hook_type`: result, claim, question, problem, comparison;
- `media_type`: none, screenshot, chart, code, diagram;
- `format`: original, quote, thread;
- `timing_bucket`: scheduler-selected time cohorts after enough history exists.

Rules:

- never post the same or near-identical content twice for an experiment;
- never sacrifice factuality or useful value to create a variant;
- record the hypothesis before publication;
- attach the experiment/variant to the queue item before final drafting when the variant affects writing/media;
- evaluate on normalized outcome metrics, including follower conversion, not likes alone;
- allow the human to decline an experiment assignment without blocking publication.

## Follower-Conversion Analytics

The learning loop should distinguish reach from account-building value.

Primary derived metrics:

```text
views_per_hour
replies_per_1000_views
reposts_per_1000_views
visible_engagement_per_1000_views
associated_follower_delta
follows_per_1000_views
```

Group results by:

- niche;
- pipeline/format;
- style;
- hook type;
- media type;
- semantic anchors;
- publication hour/weekday;
- experiment variant.

Where audience snapshots make it observable, also track whether newly observed followers are niche-aligned. The strategic target is not merely `more followers`; it is an increasing proportion of developers, AI builders, maintainers, technical founders, and relevant engineering-career accounts.

## Initial Scheduling Policy

The system should optimize **coverage**, not attempt to disguise automation.

### Normal main-feed items

Initial editorial defaults:

- serialize all original/quote/thread/repost publications;
- preferred evergreen spacing: roughly 4-6 hours;
- ordinary separation target: roughly 3 hours, advisory rather than a hard floor;
- do not post merely because a slot exists;
- if two queued items are semantically similar, prefer the stronger one and delay/expire the weaker one.

These are project defaults, not claims about hidden X enforcement.

### Viral / urgent items

- may pre-empt a normal evergreen item;
- target the earliest reasonable coverage slot after human approval;
- freshness and expected shelf-life should outweigh ordinary FIFO order;
- do not publish several viral items simultaneously; writes remain serialized;
- an approved viral item may be recommended for immediate publication when shelf-life outweighs self-cannibalization risk, even if the previous main-feed item is recent;
- if the item will be stale before any worthwhile publication opportunity, route to `reply`, `research`, or `ignore` instead of publishing stale commentary.

Do not define a universal viral emergency floor from public evidence. Time since last post is a coverage signal, not an anti-flag threshold, and can later be learned from account outcomes.

## Algorithm-Aware Design Assumptions

The implementation should preserve these principles from the current public X recommendation code and existing repo analysis:

- action coefficients weight **predicted probabilities**, not raw observed engagement totals;
- originals are the main stranger-discovery asset for this account;
- author-diversity logic makes repeated same-author presence less attractive in a recommendation slate, so self-cannibalizing bursts are strategically weak;
- semantic diversity/DPP makes near-identical trend summaries weak relative to distinctive analysis;
- out-of-network distribution begins at a disadvantage, so clear niche fit and utility matter;
- cold-start exploration exists for low-follower/low-impression authors but is not guaranteed distribution;
- negative user feedback matters enough that ragebait and misleading hooks are strategically bad even if they create activity;
- ranking and visibility filtering are separate layers in the August 2026 public tree;
- public labeling/account-scoring/enforcement components exist, while some anti-abuse rules are intentionally not published;
- Under the Hood provides stronger observable visibility evidence when available than guessed risk derived from activity volume/timing.

The scheduler/account-health layer must not convert any of these observations into fake raw engagement-point arithmetic, hidden bot scores, or arbitrary action quotas.

## File Responsibility Map

### New files planned

- `pipeline.js` — pipeline definitions, route requirements, queue-state transition rules, and hard-gate requirements by format.
- `scheduler.js` — priority, urgency, expiry, serialization, timing recommendation, and next-slot selection.
- `opportunity.js` — Reach/Follow/Conversation/Relationship scoring and score explanations used by triage, routing, and dashboard views.
- `relationship.js` — target classes, TargetScore, relationship-stage derivation, and event-to-profile aggregation.
- `engagement.js` — discovery/ranking of initial/follow-up reply opportunities from relationship targets, own-post conversations, and reply-suitable research candidates.
- `health.js` — advisory account-health state, observed visibility evidence, target saturation, reply repetition, Network Quality, and InteractionYield.
- `experiments.js` — content/network/timing experiment definitions, variant assignment, active-experiment rules, and cohort summaries.
- `learning.js` — evidence-backed bounded learned recommendations after enough account-specific outcomes accumulate.
- `docs/POST_GENERATION_PROMPT.md` — canonical writer/editor prompt and structured output contract.
- `docs/RESEARCH_AGENDA.md` — deep research areas that produce original account IP.

### Existing files planned for modification

- `store.js` — `queue_items`, relationship profiles/events, account-health observations, experiment persistence, learned-rule persistence, fixed-window follower/outcome fields, and queue queries.
- `dashboard.js` — Save-to-triage behavior, route controls, Relationships/Engage/Account Health/Queue/Experiments/Learning views, approval UI, timing/media visibility, opportunity scores, and follower/relationship-conversion summaries.
- `strategy.js` — extend recommendation from five-way distribution action into pipeline recommendation inputs and urgency/expiry signals; consume opportunity/relationship scores rather than owning their formulas.
- `audience.js` — preserve raw follower/following observations and feed strategic relationship/follower-quality layers without owning target scoring.
- `drafting.js` — format-aware drafting and hard gates.
- `agent_bridge.js` — queue/routing/review, opportunity, engagement, and experiment commands without exposing raw SQLite writes.
- `automation.js` — scheduler-driven queue consumption, read-only engagement-opportunity refresh, fixed-window outcome capture, and experiment/follower-conversion measurement.
- `x_http.js` — format-aware quote/thread/media publication using already available transport capabilities.
- `README.md` — user-facing workflow once each capability is actually implemented.
- `AGENTS.md` and `docs/AGENT_WORKFLOW.md` — agent contract once new bridge commands exist.

---

### Task 1: Add persistent triage queue ownership

**Files:**
- Modify: `store.js`

**Interfaces:**
- Consumes: existing `candidates`, `drafts`, `candidate_actions`.
- Produces: `queue_items` plus queue CRUD/query functions.

**Steps:**
- [ ] Add `queue_items` with one active queue item per candidate by default.
- [ ] Add `ensureQueueItem(candidateKey)` so Save can idempotently create triage work.
- [ ] Add queue reads for status, pipeline, urgency, and scheduling order.
- [ ] Add transition/update function that preserves one authoritative queue-state owner.
- [ ] Backfill currently saved candidates into `triage` once without changing their Saved preference state.

**Acceptance criteria:**
- Saving a candidate can create one and only one active triage item without duplicating queue rows on repeated Save actions.
- Existing candidate/draft/action history remains intact.

### Task 2: Define pipeline and transition contracts

**Files:**
- Create: `pipeline.js`
- Modify: `strategy.js`

**Interfaces:**
- Consumes: niche classification, candidate action history, source type, viral data.
- Produces: supported pipeline definitions and route recommendation metadata.

**Steps:**
- [ ] Define `original`, `quote`, `thread`, `reply`, `repost`, `research`, `watch`, and `ignore`.
- [ ] For each pipeline, define whether research, draft, media evaluation, human approval, main-feed scheduling, and action recording are required.
- [ ] Preserve the current Direct/Quote/Repost/Reply/Ignore logic as the recommendation core while mapping it to the broader pipeline vocabulary.
- [ ] Make `alreadyUsed` and weak niche fit remain hard reasons not to recycle a source by default.

**Acceptance criteria:**
- One candidate can receive an AI recommendation with a reason while allowing an explicit human override to any valid pipeline.

### Task 3: Save -> triage and route-after-Save dashboard UX

**Files:**
- Modify: `dashboard.js`
- Modify: `store.js`

**Interfaces:**
- Consumes: `ensureQueueItem`, pipeline recommendations.
- Produces: Save-and-triage behavior plus route controls.

**Steps:**
- [ ] Make Save persist preference state and ensure a triage queue item in the same request flow.
- [ ] Show `Recommended: <pipeline>` with the recommendation reason.
- [ ] Add explicit route buttons/menu for Original, Quote, Thread, Reply, Repost, Research, Watch, Ignore.
- [ ] Add a Queue dashboard view grouped by queue status rather than mixing workflow into Saved/Drafts.
- [ ] Keep Unsave independent from deleting historical queue/action records.

**Acceptance criteria:**
- A user can Save a card, see it in Queue immediately, and deliberately choose which pipeline it should enter.

### Task 4: Add human approval as a hard workflow boundary

**Files:**
- Modify: `pipeline.js`
- Modify: `store.js`
- Modify: `dashboard.js`
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: queue status and completed draft/gate result.
- Produces: `needs_review -> approved` human transition.

**Steps:**
- [ ] Prevent AI/agent queue commands from setting main-feed items directly to `approved`.
- [ ] Add `Approve for scheduling`, `Revise`, and `Reject/Ignore` controls in the dashboard.
- [ ] Record `human_approved_at` when approval occurs.
- [ ] Treat an explicit immediate-publish user instruction as approval only for the exact finalized content being published.

**Acceptance criteria:**
- No queued original, quote, thread, or repost is scheduler-eligible without an approval timestamp.

### Task 5: Make drafting format-aware

**Files:**
- Modify: `drafting.js`
- Modify: `agent_bridge.js`
- Use: `docs/POST_GENERATION_PROMPT.md`

**Interfaces:**
- Consumes: pipeline type, candidate context, verified evidence, niche keywords, recent account posts, media availability.
- Produces: structured final draft packet appropriate to Original / Quote / Thread / Reply.

**Steps:**
- [x] Keep Hook / Insight / Evidence / Action as the core reasoning fields.
- [x] Add format-specific composition rules so quote copy does not paraphrase the source and thread Post 1 stands alone.
- [x] Include recent approved/published account content in the writer packet and deterministic duplicate context.
- [x] Preserve structured `DO_NOT_POST` output and recommend Research/Watch/Ignore rather than forcing publication.

**Acceptance criteria:**
- The same source produces meaningfully different valid structures depending on the human-selected pipeline.

### Task 6: Add hard pre-publication gates

**Files:**
- Modify: `drafting.js`
- Modify: `pipeline.js`

**Interfaces:**
- Consumes: draft, source, evidence, pipeline, recent posts, media plan.
- Produces: hard-gate result plus existing numeric quality score.

**Steps:**
- [x] Add deterministic gates for explicit factuality/evidence confirmation, niche fit, additive value, source/recent originality, placeholders, scannability/weighted length, CTA integrity, hashtag/emoji limits, first-person evidence, thread rules, and required-media readiness.
- [x] Keep the numeric 50-point rubric separate from hard pass/fail.
- [x] Allow `needs_review` to expose gate failures, but require at least 40/50 plus passing current gates for explicit human approval.
- [x] Recompute current gates at approval so a high score cannot override a hard invariant.

**Acceptance criteria:**
- A high-scoring draft that violates a hard invariant cannot become scheduler-eligible.

### Task 7: Add media planning and attachment metadata

**Files:**
- Modify: `store.js`
- Modify: `pipeline.js`
- Modify: `dashboard.js`
- Modify: `x_http.js`

**Interfaces:**
- Consumes: candidate evidence and final draft.
- Produces: optional media plan and attached media IDs at publication.

**Steps:**
- [x] Store the Phase-2 media plan inside draft editor metadata: required flag, type, reason, source/local evidence reference, and alt text.
- [x] Normalize the persisted/editor media enum to `none`, `screenshot`, `chart`, `code`, `diagram`.
- [x] Default to no media unless it proves or explains something the text cannot; required media blocks approval while readiness is unavailable.
- [ ] Add actual attachment/media-ID persistence and reuse available upload transport in Phase 3; Phase 2 does not fake readiness or upload media.

**Acceptance criteria:**
- An approved item can clearly explain why it needs media, and the publisher can attach an already prepared media ID without changing text workflow responsibility.

### Task 8: Add urgency, expiry, and coverage-aware scheduling

**Files:**
- Create: `scheduler.js`
- Modify: `strategy.js`
- Modify: `store.js`

**Interfaces:**
- Consumes: queue items, viral velocity, source age, approval time, existing scheduled/published items.
- Produces: `scheduled_at`, schedule reason, expiry decisions.

**Steps:**
- [ ] Define urgency classes `evergreen`, `timely`, `viral`.
- [ ] Estimate `expires_at` for time-sensitive items.
- [ ] Serialize main-feed items so only one publication occupies a given slot.
- [ ] Use an ordinary ~3-hour separation target / 4-6-hour evergreen preference as advisory editorial defaults for non-urgent main-feed items, not hard eligibility floors.
- [ ] Allow viral items to pre-empt evergreen order and recommend immediate serialized publication after approval when shelf-life outweighs overlap risk.
- [ ] Expire or reroute viral commentary that will be stale before its next viable slot.
- [ ] Keep timing parameters explicitly framed as coverage heuristics that can later be learned from account data.

**Acceptance criteria:**
- Viral items can jump ahead without causing simultaneous main-feed publication, while stale viral content does not remain queued as evergreen content.

### Task 9: Make automation consume the workflow queue

**Files:**
- Modify: `automation.js`
- Modify: `store.js`
- Use: `scheduler.js`

**Interfaces:**
- Consumes: approved/scheduled queue items.
- Produces: one publication action or research-only cycle per scheduler decision.

**Steps:**
- [ ] Replace draft-only FIFO selection with scheduler selection from approved queue items.
- [ ] Keep research refresh independent from publication selection.
- [ ] Publish at most one eligible main-feed queue item per cycle.
- [ ] Preserve `AUTO_POST=false` as preview mode.
- [ ] Record publish outcome back into queue state and `candidate_actions`.

**Acceptance criteria:**
- A research cycle never publishes an unapproved item and never drains several main-feed items in one burst.

### Task 10: Add format-aware publication

**Files:**
- Modify: `x_http.js`
- Modify: `automation.js`

**Interfaces:**
- Consumes: scheduled queue item, finalized draft, source tweet ID when quoting, thread parts, media IDs.
- Produces: published X IDs and URLs.

**Steps:**
- [ ] Route `original` to ordinary post creation.
- [ ] Route `quote` to CreateTweet with the quoted tweet ID.
- [ ] Route `thread` to the existing thread transport with the approved thread parts.
- [ ] Keep `reply` as a separately approved interaction path rather than ordinary autonomous queue publication.
- [ ] Keep `repost` rare and explicit rather than treating it as a default publishing format.

**Acceptance criteria:**
- The queue pipeline type determines the correct publication operation and the resulting action is recorded against the source candidate.

### Task 11: Add scheduled performance capture

**Files:**
- Modify: `store.js`
- Modify: `automation.js`
- Modify: `dashboard.js`

**Interfaces:**
- Consumes: published queue/action metadata.
- Produces: outcome snapshots associated with pipeline, niche, keywords, media, and schedule slot.

**Steps:**
- [ ] Associate published posts with their pipeline/queue metadata.
- [ ] Capture intended outcome windows around 15 minutes, 1 hour, 6 hours, and 24 hours when the process is available.
- [ ] Compute visible rates such as views/hour, replies/1k views, reposts/1k views, and follower delta where observable.
- [ ] Show performance grouped by pipeline, niche, and publication hour rather than only raw totals.

**Acceptance criteria:**
- The dashboard can answer which formats/topics/times produced the strongest outcomes for this account rather than only showing per-post counters.

### Task 12: Learn targeting, engagement, content, and timing from account outcomes

**Files:**
- Create: `learning.js`
- Modify: `store.js`
- Modify: `relationship.js`
- Modify: `engagement.js`
- Modify: `opportunity.js`
- Modify: `scheduler.js`
- Modify: `dashboard.js`
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: completed post/follower measurements, relationship events, experiment summaries, queue metadata, and accepted algorithm-evidence classifications.
- Produces: suggested/accepted/retired bounded learned rules for targeting, engagement, content, and timing with visible evidence/sample size.

**Steps:**
- [ ] Generate evidence-backed suggestions for target classes/score buckets, reply archetypes/age buckets, content formats/topics, and timing cohorts.
- [ ] Store learned rules as `suggested` until explicit human acceptance; do not let one outcome rewrite strategy automatically.
- [ ] Require evidence state/sample size in every recommendation and keep `insufficient/preliminary/directional/repeated` distinctions visible.
- [ ] Apply only accepted learned rules as bounded adjustments after transparent base scoring; show base score and learned adjustment separately.
- [ ] Let viral urgency and explicit human override supersede learned evergreen timing preferences.
- [ ] Re-evaluate/retire rules when newer account evidence reverses them or `ALGORITHM_EVIDENCE_LEDGER.md` marks a linked mechanism stale.

**Acceptance criteria:**
- The system can explain an account-specific target/reply/content/timing recommendation from observed history, but no learned rule affects production behavior until human acceptance.
- Detailed execution contract: `plans/PHASE_5_LEARNED_STRATEGY.md`.

### Task 13: Add four-dimensional opportunity scoring

**Files:**
- Create: `opportunity.js`
- Modify: `store.js`
- Modify: `strategy.js`
- Modify: `dashboard.js`
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: candidate niche data, freshness, viral velocity, source context, saved-preference data, and audience/relationship context when available.
- Produces: `{ reachPotential, followPotential, conversationPotential, relationshipPotential, breakdown }` plus persisted queue-item score fields.

**Steps:**
- [ ] Implement one transparent 0-100 scorer per dimension rather than one opaque viral score.
- [ ] Start Reach Potential from observable freshness/shelf-life, velocity, source reach/authority, breadth of developer relevance, and multi-source acceleration signals.
- [ ] Start Follow Potential from niche fit, useful/original angle headroom, evidence/implementation potential, account-identity reinforcement, and fit with saved preferences/target audience.
- [ ] Start Conversation Potential from unresolved technical question/trade-off, technical specificity, freshness, and whether an answer would improve research.
- [ ] Start Relationship Potential from target class/TargetScore, prior responses, continued conversations, relationship stage, shared topics, and follow/mutual state when available.
- [ ] Return a component breakdown for every score so the dashboard/agent can explain the result.
- [ ] Persist the four scores on `queue_items` when an item enters or is refreshed in triage.
- [ ] Change route recommendation to consume the four dimensions without collapsing them into Phoenix-like raw-point arithmetic.
- [ ] Expose the scores and short explanations on research/triage cards and through an agent bridge command.

**Acceptance criteria:**
- A candidate can visibly be high-Reach/low-Follow, low-Reach/high-Follow, high-Conversation, or high-Relationship without those differences being hidden by one total score, and the route recommendation explains how that affected Original/Quote/Reply/Repost/Research/Ignore.

### Task 14: Add Relationship Intelligence and the Engage Next workflow

**Files:**
- Create: `relationship.js`
- Create: `engagement.js`
- Modify: `store.js`
- Modify: `audience.js`
- Modify: authenticated X read owner for target posts/responses
- Modify: `dashboard.js`
- Modify: `agent_bridge.js`
- Modify: `automation.js`

**Interfaces:**
- Consumes: `audience_profiles`, relationship event history, recent niche/viral candidates, recent posts from priority relationship targets, replies/comments under our own posts when available, and Conversation/Relationship Potential from `opportunity.js`.
- Produces: strategic `relationship_profiles`, append-only `relationship_events`, target classes/TargetScore/stage, and `queue_items` with `lane = engagement`, `pipeline = reply`, target context, expiry, suggested contribution, reviewable reply draft, and human decision state.

**Steps:**
- [ ] Add strategic relationship profiles separate from raw audience observations.
- [ ] Classify targets as distribution / relationship / authority / customer_density / source using explainable evidence.
- [ ] Score targets from TopicFit, AudienceOverlap, ConversationQuality, ReplyVisibility, and RelationshipPotential using the `RELATIONSHIP_INTELLIGENCE.md` contract; keep follower count a bounded reach modifier.
- [ ] Persist append-only relationship events and derive stages `observed -> interacted -> responsive -> recurring -> connected -> mutual` from history/follow state.
- [ ] Reuse `queue_items` rather than creating a second queue table; engagement is a lane with different scheduling/sending rules.
- [ ] Discover responses to our existing conversations before cold opportunities, then recent posts from high-value relationship/distribution/authority targets and reply-suitable research candidates.
- [ ] Create an engagement item only when the system can state a concrete contribution such as a result, implementation detail, caveat, comparison, correction, or informed question.
- [ ] Store `target_username`, `target_tweet_id`, target/relationship context, Conversation Potential, Relationship Potential, freshness, `expires_at`, contribution archetype, and the reason the reply would be useful.
- [ ] Add **Relationships** and **Engage Next** dashboard views. Engage Next sorts active follow-ups above comparable cold opportunities and prioritizes freshness, conversation quality, relationship value, target score, and contribution strength rather than follower count alone.
- [ ] Let AI draft a reply and move it to `needs_review`; require one human approval/send action for each outbound reply.
- [ ] Do not let the daemon batch-send or automatically send unsolicited replies.
- [ ] Expire opportunities whose source conversation is no longer timely instead of sending stale replies.
- [ ] Record successful replies in `candidate_actions` plus `relationship_events`, then feed target responses, conversation continuation, follower/connection changes, and recurring relationships into analytics.

**Acceptance criteria:**
- The dashboard can explain who is worth engaging, why this particular conversation matters now, what prior relationship exists, and what useful contribution we can make; target responses can re-enter Engage Next as higher-priority follow-ups; no reply is sent merely because it entered the queue.
- The detailed execution contracts are `plans/PHASE_1B_RELATIONSHIP_INTELLIGENCE.md` and `plans/PHASE_1C_ENGAGE_NEXT.md`.

### Task 15: Add the Experiment Engine

**Files:**
- Create: `experiments.js`
- Modify: `store.js`
- Modify: `dashboard.js`
- Modify: `drafting.js`
- Modify: `scheduler.js`
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: approved experiment definitions, main-feed or engagement queue items before execution, writing/media/timing/target metadata, relationship context, and completed content/network outcomes.
- Produces: experiment/variant assignments, cohort summaries, and evidence for future targeting/reply/content/format/timing recommendations.

**Steps:**
- [ ] Add `experiments` and `experiment_variants` persistence plus one nullable `experiment_variant_id` assignment on `queue_items`.
- [ ] Support content dimensions `style`, `hook_type`, `media_type`, `format`; network dimensions `target_class`, `target_score_bucket`, `target_size_bucket`, `reply_age_bucket`, `conversation_saturation_bucket`, `reply_archetype`, `relationship_stage`; and later `timing_bucket` once enough timing history exists.
- [ ] Record a plain-language hypothesis before assigning variants, for example: `result-led hooks convert more AI/dev followers than question-led hooks for coding-agent originals`.
- [ ] Assign at most one primary experiment dimension to a publication when practical so the result remains interpretable.
- [ ] Never create duplicate or near-duplicate posts solely to form an A/B pair; compare naturally different future posts that satisfy the same experiment definition.
- [ ] Apply the assigned variant before final drafting/media selection when it affects the output, while allowing the human to decline or override the assignment.
- [ ] Show active experiments and each item's assignment in the dashboard before approval.
- [ ] Summarize normalized metrics by variant only after the relevant measurement window completes.
- [ ] Do not label a variant a winner until each compared variant has at least five completed 24-hour observations; before that, show `insufficient evidence` and raw cohort summaries.
- [ ] Never automatically change the account identity or permanent writing rules from one experiment; promote a finding only after repeated evidence and human acceptance.

**Acceptance criteria:**
- The system can run declared non-duplicate content or network experiments, attach variants before execution, collect comparable normalized outcomes, and show a cautious evidence summary without self-authorizing a permanent strategy change.

### Task 16: Add follower-conversion, follower-quality, and relationship-conversion analytics

**Files:**
- Modify: `store.js`
- Modify: `automation.js`
- Modify: `audience.js`
- Modify: `dashboard.js`
- Modify: `experiments.js`
- Modify: `scheduler.js`

**Interfaces:**
- Consumes: publication baseline, fixed-window post metrics, account follower counts, audience snapshots, relationship events/stages, queue metadata, and experiment assignments.
- Produces: associated follower delta, follows/1k views, attribution confidence, newly observed follower quality, author-response/conversation-continuation/recurring-relationship outcomes, and grouped content/network conversion summaries.

**Steps:**
- [ ] Capture follower count at publication baseline and at the 15m/1h/6h/24h measurement windows alongside post metrics.
- [ ] Compute `associated_follower_delta` and `follows_per_1000_views` for each window without claiming direct causal attribution.
- [ ] Mark attribution confidence `high` when no other main-feed publication occurred between baseline and capture, `medium` when exactly one other publication overlaps, and `low` when two or more overlap.
- [ ] Add/preserve `first_seen_at` for audience profiles so newly observed followers can be distinguished from the legacy follower set.
- [ ] When a new follower is observed, run the existing niche/audience classifier and record whether the follower appears aligned with the AI/developer/builder target audience.
- [ ] Show reach metrics and conversion metrics side-by-side so a large low-conversion post cannot automatically outrank a smaller high-quality recruiting post.
- [ ] Compute network metrics from relationship events: author response rate, conversation continuation rate, recurring relationship conversion, connected-target conversion, and mutual relationship count.
- [ ] Group content conversion by niche, format, style, hook, media, semantic anchors, timing bucket, and experiment variant.
- [ ] Group network conversion by target class, target-score bucket, target-size bucket, reply-age bucket, reply archetype, topic, and relationship stage before interaction.
- [ ] Feed content/network conversion summaries into experiment evaluation and learned strategy as evidence, while keeping the human able to override recommendations.

**Acceptance criteria:**
- The dashboard can identify posts that produced strong reach but weak follower recruitment, interactions that produced views but no relationship progression, interactions associated with target responses/recurring relationships, and whether newly observed followers are increasingly aligned with the target niche, with attribution confidence visible.
- Detailed execution contract: `plans/PHASE_4_MEASUREMENT_EXPERIMENTS.md`.

### Task 17: Add Account Health, visibility observability, and lenient engagement diagnostics

**Files:**
- Create: `health.js`
- Modify: `store.js`
- Modify: `relationship.js`
- Modify: `engagement.js`
- Modify: `dashboard.js`
- Modify: `agent_bridge.js`
- Modify: authenticated X read owner only if Under the Hood can reuse the existing session path.

**Interfaces:**
- Consumes: relationship events, recent reply/action text, observed platform/visibility events, and target interaction history.
- Produces: HEALTHY/WATCH/CONSTRAINED state, `SaturationPressure`, reply-repetition warnings, Network Quality components, InteractionYield, and provenance-backed visibility observations.

**Steps:**
- [ ] Persist append-only account-health observations with provenance; do not store guessed bot/reputation scores as evidence.
- [ ] Implement advisory `SaturationPressure` and reply-archetype/text-repetition diagnostics using local/native facilities.
- [ ] Hard-stop only actual duplicate/near-duplicate, no-contribution, exhausted same-source, expired/no-active-conversation, or observed platform/project constraint conditions.
- [ ] Keep daily reply volume, target saturation, repeated archetype, target concentration, and conversation density as soft modifiers/experiment variables.
- [ ] Treat active bidirectional conversation, direct target questions, and new verified evidence as valid soft-penalty overrides.
- [ ] Show Network Quality components and InteractionYield with raw numerator components.
- [ ] Record Under the Hood visibility snapshots only when actually observable; return unavailable cleanly otherwise.
- [ ] Add Account Health dashboard/bridge surfaces without pretending to expose an X bot/reputation score.

**Acceptance criteria:**
- High-volume reciprocal conversation can remain HEALTHY; one-sided repetitive activity can become WATCH without being automatically blocked; CONSTRAINED requires observed hard evidence or another explicit boundary.
- Detailed execution contract: `plans/PHASE_1D_ACCOUNT_HEALTH.md`.

## Rollout Order

Phase-specific plans in `docs/plans/` are authoritative for implementation detail. The master tasks above remain the cross-system map.

### Phase 1A — Workflow foundation + four-dimensional triage — IMPLEMENTED

Plan: `plans/PHASE_1_WORKFLOW_FOUNDATION.md`

- Save -> triage;
- pipeline routing;
- Queue UI;
- human approval;
- Reach / Follow / Conversation / Relationship scoring with explanations.

This creates the workflow boundary every later subsystem consumes.

### Phase 1B — Relationship Intelligence

Plan: `plans/PHASE_1B_RELATIONSHIP_INTELLIGENCE.md`

- strategic relationship profiles separate from raw audience observations;
- target classes: distribution / relationship / authority / customer_density / source;
- TargetScore from TopicFit / AudienceOverlap / ConversationQuality / ReplyVisibility / RelationshipPotential;
- append-only relationship events;
- stages observed -> interacted -> responsive -> recurring -> connected -> mutual;
- Relationships dashboard/agent reads.

This phase is upstream of Engage Next because the system must know **who** matters before it can rank **which conversation** matters.

### Phase 1C — Engage Next

Plan: `plans/PHASE_1C_ENGAGE_NEXT.md`

- active-conversation responses first;
- current posts from high-value targets;
- per-post EngagePriority using conversation/relationship/freshness/visibility/contribution evidence;
- reviewable initial/follow-up replies;
- one-by-one human send/ignore decisions;
- relationship-event updates after interactions.

### Phase 1D — Account Health + visibility observability

Plan: `plans/PHASE_1D_ACCOUNT_HEALTH.md`

- HEALTHY / WATCH / CONSTRAINED with explicit evidence;
- observable visibility/enforcement snapshots with provenance;
- optional Under the Hood capture when available;
- target saturation as a soft EngagePriority modifier;
- reply archetype/repetition diagnostics with hard duplicate vs soft repetition distinction;
- Network Quality components and InteractionYield;
- no arbitrary reply quota or human-timing imitation.

### Phase 2 — Content quality + profile proof

Plan: `plans/PHASE_2_CONTENT_QUALITY.md`

Implemented through the human-review boundary:

- format-aware Original/Quote/Thread/Reply writing and structured writer packets;
- deterministic hard gates plus the separate 50-point score;
- persisted thread/editor/gate metadata and human factuality/evidence confirmation;
- media-plan state with required media blocked until Phase 3 attachment readiness;
- recent approved/published content plus relationship/profile-proof packet slots so owned posts can reinforce conversations the account is entering.

### Phase 3 — Main-feed distribution

Plan: `plans/PHASE_3_DISTRIBUTION_SCHEDULER.md`

- urgency and expiry;
- coverage-aware scheduler;
- semantic conflict/self-cannibalization checks;
- format-aware original/quote/thread publication;
- queue claim/publish locking;
- viral pre-emption without burst dumping.

### Phase 4 — Measurement + content/network experiments

Plan: `plans/PHASE_4_MEASUREMENT_EXPERIMENTS.md`

- fixed 15m/1h/6h/24h publication outcomes;
- associated follower conversion with attribution confidence;
- new-follower quality;
- author-response/conversation-continuation/relationship-conversion metrics;
- content experiments and network experiments under one experiment owner.

### Phase 5 — Learned strategy

Plan: `plans/PHASE_5_LEARNED_STRATEGY.md`

- evidence-backed suggestions for targets, reply archetypes, reply-age buckets, content formats, topics, and timing;
- bounded adjustments applied only after human acceptance;
- base vs learned contribution remains visible;
- evidence-ledger changes can trigger review/retirement of stale learned rules.

## Risks and Boundaries

- X private web endpoints are not a stable public API contract. Publication transport may break independently of queue correctness.
- Current X automation rules restrict several forms of automated engagement; this architecture intentionally keeps likes, follow churn, mass replies, and unsolicited engagement outside the autonomous loop.
- The Engagement Queue must never become a reply quota. If there is no concrete contribution, the correct action is `ignore` or wait; if there are many genuinely useful conversations, a fixed daily cap must not suppress them.
- Target saturation, repeated archetype, target concentration, and weak recent InteractionYield are advisory signals by default; they lower priority or warn rather than hard-blocking a useful human-approved interaction.
- Active bidirectional conversation, a direct target question, or new verified evidence may offset soft health penalties.
- Reach/Follow/Conversation/Relationship scores, TargetScore, EngagePriority, SaturationPressure, NetworkQualityScore, and InteractionYield are internal prioritization/diagnostic heuristics. They can be wrong and must show their component reasoning rather than masquerading as X's actual ranking score.
- No scheduler can guarantee virality. The system optimizes prerequisites: topic fit, distinctiveness, evidence, usefulness, freshness, readability, media value, timing, and follower-conversion value.
- `associated_follower_delta` is not direct causal attribution. Overlapping publications, profile changes, external mentions, or prior posts can contribute; attribution confidence must remain visible.
- Content experiments are observational cohort comparisons, not laboratory-isolated tests. Topic/source differences remain confounders, so the system must not overstate small-sample results.
- Do not publish duplicate/near-duplicate posts just to obtain an A/B pair; the experiment system learns across naturally different future posts.
- Do not infer that a short-term spike proves a new permanent content identity. Preference, relationship, and performance changes should accumulate over multiple observations.
- Do not optimize timing as a way to mimic a human. Optimize timing because simultaneous or semantically redundant posts compete for limited attention.
- Current public algorithm mechanisms and empirical tactics must remain separated through `ALGORITHM_EVIDENCE_LEDGER.md`; an empirical timing/target-size/reply-volume hypothesis must not silently become a hard product invariant.
- Relationship intelligence must preserve raw event/follow state so a learned stage/score never destroys the underlying evidence.

## Definition of Done for the Full Program

The program is complete when a user can:

1. Save any research candidate.
2. See it automatically enter Triage.
3. See Reach Potential, Follow Potential, Conversation Potential, and Relationship Potential with understandable component explanations.
4. See strategic target classes and TargetScore for relevant accounts without follower count dominating the decision.
5. Inspect relationship stage/event history and distinguish observed, responsive, recurring, connected, and mutual relationships.
6. See an AI routing recommendation and reason.
7. Choose/override Original, Quote, Thread, Reply, Repost, Research, Watch, or Ignore.
8. See relevant reply opportunities separately in **Engage Next**, with active conversation follow-ups ranked above comparable cold opportunities.
9. Review target context, freshness/expiry, contribution archetype, and the concrete technical contribution the system thinks we can make.
10. Review and explicitly send/ignore each outbound reply rather than having a daemon spray replies.
11. See successful replies/responses become relationship events and influence future relationship/target scoring.
12. See Account Health distinguish actual observed visibility/enforcement evidence from soft saturation/repetition/efficiency warnings.
13. See genuine active-conversation bursts remain actionable while one-sided repetitive activity receives advisory pressure.
14. See Network Quality and InteractionYield with raw component counts.
15. See research/evidence and a format-aware main-feed draft that reinforces profile proof for the topics the account is entering publicly.
16. Optionally attach main-feed or engagement items to declared content/network experiments and see the assigned variant before execution.
17. See deterministic hard gates plus quality score.
18. Review media recommendation.
19. Approve the exact final main-feed content.
20. See the scheduler choose and explain a coverage slot.
21. See viral approved items pre-empt normal items without burst-posting.
22. See the correct X action published and persisted once.
23. See 15m/1h/6h/24h outcomes with reach and associated follower-conversion metrics side-by-side.
24. See author-response, conversation-continuation, recurring-relationship, connected-target, and mutual-network outcomes.
25. See attribution confidence and, when observable, whether newly observed followers are increasingly niche-aligned.
26. See experiment cohort summaries that refuse to declare a winner before the minimum evidence threshold.
27. See evidence-backed learned strategy suggestions remain inert until human acceptance, then apply only bounded transparent adjustments.
28. See algorithm/tactic claims remain traceable to CODE_BACKED / OFFICIAL_PRODUCT_OR_POLICY / EMPIRICAL_VARIABLE / RETIRED evidence classes.
