# Human + AI Publishing System Implementation Plan

**Goal:** Turn the existing X research dashboard into a human-supervised growth and publishing operating system where every saved signal enters triage, is scored for reach/follow/conversation potential, is deliberately routed into the right distribution or engagement format, passes research/writing/media/quality gates, receives a coverage-aware publishing slot when appropriate, and feeds follower-conversion and experiment outcomes back into future decisions.

**Architecture:** Keep SQLite as the system of record. Preserve the existing candidate, draft, action-history, audience, and performance owners; add one workflow owner for queue state, one scheduler owner for publication timing, one opportunity-scoring owner, one engagement-opportunity owner, and one experiment owner. AI may discover, classify, research, recommend, draft, score, propose experiments, surface engagement opportunities, and propose timing, but human approval controls consequential main-feed publication and outbound replies.

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
- Opportunity scoring must keep **Reach Potential**, **Follow Potential**, and **Conversation Potential** separate. These are transparent internal heuristics, not simulations of X's Phoenix score.
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
- Bootstrap dashboard.

### Planned by this document

- Save -> triage queue creation;
- explicit pipeline routing after Save;
- queue workflow states independent from draft status;
- Research / Watch / Thread pipeline types;
- human approval boundary;
- final writing-prompt contract;
- hard pre-publication gate beyond the numeric rubric;
- media planning and upload attachment metadata;
- urgency/expiry model for viral content;
- coverage-aware scheduler with viral pre-emption;
- format-aware publishing for originals, quotes, and threads;
- post-publication measurement windows;
- learned timing and format recommendations from account outcomes;
- a dedicated Engagement Queue for relevant, time-sensitive reply opportunities;
- an Experiment Engine for controlled style/hook/media/timing hypotheses without duplicate posting;
- three-dimensional candidate scoring: Reach Potential, Follow Potential, and Conversation Potential;
- follower-conversion analytics that prioritize recruiting the target AI/developer/builder audience over vanity reach.

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
REACH / FOLLOW / CONVERSATION SCORING
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

## Planned Data Model

Add a `queue_items` table rather than overloading `drafts` with workflow responsibility.

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
draft_id
routing_reason
research_summary
target_username
target_tweet_id
relationship_score
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
- `candidate_actions`: historical actions actually performed;
- `audience_profiles`: relationship/relevance observations;
- `post_metrics` / `account_metrics`: outcomes.

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

`queue_items.experiment_variant_id` assigns at most one active variant to a queued publication. The experiment engine compares cohorts of naturally different posts; it must not schedule duplicate or near-duplicate copies merely to create an A/B pair.

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

Every triaged candidate should expose three independent 0-100 scores before route selection.

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
- relationship value of the source author;
- specificity sufficient for an informed reply;
- likelihood that a response would improve our research rather than merely increase comment count.

The route recommender consumes all three scores. A high-Reach/low-Follow item may become `repost`, `reply`, or `ignore`; a medium-Reach/high-Follow item may be a stronger `original` than a generic viral source.

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
- ordinary minimum spacing target: roughly 3 hours;
- do not post merely because a slot exists;
- if two queued items are semantically similar, prefer the stronger one and delay/expire the weaker one.

These are project defaults, not claims about hidden X enforcement.

### Viral / urgent items

- may pre-empt a normal evergreen item;
- target the earliest reasonable coverage slot after human approval;
- freshness and expected shelf-life should outweigh ordinary FIFO order;
- do not publish several viral items simultaneously;
- if the item will be stale before the next viable main-feed slot, route to `reply`, `research`, or `ignore` instead of publishing stale commentary.

The exact minimum emergency gap should remain configurable and should later be learned from account outcomes rather than treated as an anti-flag trick.

## Algorithm-Aware Design Assumptions

The implementation should preserve these principles from the current public X recommendation code and existing repo analysis:

- action coefficients weight **predicted probabilities**, not raw observed engagement totals;
- originals are the main stranger-discovery asset for this account;
- author-diversity logic makes repeated same-author presence less attractive in a recommendation slate, so self-cannibalizing bursts are strategically weak;
- semantic diversity/DPP makes near-identical trend summaries weak relative to distinctive analysis;
- out-of-network distribution begins at a disadvantage, so clear niche fit and utility matter;
- cold-start exploration exists for low-follower/low-impression authors but is not guaranteed distribution;
- negative user feedback matters enough that ragebait and misleading hooks are strategically bad even if they create activity.

The scheduler must not convert any of these observations into fake raw engagement-point arithmetic.

## File Responsibility Map

### New files planned

- `pipeline.js` — pipeline definitions, route requirements, queue-state transition rules, and hard-gate requirements by format.
- `scheduler.js` — priority, urgency, expiry, serialization, timing recommendation, and next-slot selection.
- `opportunity.js` — Reach/Follow/Conversation scoring and score explanations used by triage, routing, and dashboard views.
- `engagement.js` — discovery/ranking of reply opportunities from audience targets, own-post conversations, and reply-suitable research candidates.
- `experiments.js` — experiment definitions, variant assignment, active-experiment rules, and cohort summaries.
- `docs/POST_GENERATION_PROMPT.md` — canonical writer/editor prompt and structured output contract.
- `docs/RESEARCH_AGENDA.md` — deep research areas that produce original account IP.

### Existing files planned for modification

- `store.js` — `queue_items`, experiment persistence, fixed-window follower/outcome fields, and queue queries.
- `dashboard.js` — Save-to-triage behavior, route controls, Queue/Engage/Experiments views, approval UI, timing/media visibility, opportunity scores, and follower-conversion summaries.
- `strategy.js` — extend recommendation from five-way distribution action into pipeline recommendation inputs and urgency/expiry signals; consume opportunity scores rather than owning their formulas.
- `audience.js` — expose relationship context and newly observed follower alignment for engagement/follower-quality analysis.
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
- [ ] Keep Hook / Insight / Evidence / Action as the core reasoning fields.
- [ ] Add format-specific composition rules so quote copy does not paraphrase the source and thread Post 1 stands alone.
- [ ] Include recent account posts in the writing packet for semantic repetition checks.
- [ ] Return `DO_NOT_POST` when no additive thesis exists instead of forcing a draft.

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
- [ ] Add deterministic gates for factuality/evidence presence, niche fit, additive value, originality, placeholders, weighted length, CTA integrity, recent near-duplicate risk, hashtag count, and required human approval.
- [ ] Keep the numeric 50-point rubric separate from hard pass/fail.
- [ ] Require at least 40/50 to enter human review; target 43+ for scheduler eligibility and 45+ for major evergreen originals as an editorial preference rather than a hidden-platform rule.
- [ ] Refuse scheduling when any hard invariant fails regardless of score.

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
- [ ] Store media type, reason, source/local path, alt text, and uploaded media ID with the queue item.
- [ ] Support media decisions: `none`, `source-screenshot`, `terminal/code`, `chart`, `diagram`, `image`, `video` where available.
- [ ] Default to no media unless it proves or explains something the text cannot.
- [ ] Reuse XActions' installed media upload capability rather than adding a new media-upload dependency.

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
- [ ] Use ordinary 3-hour minimum / 4-6-hour preferred spacing as initial editorial defaults for non-urgent main-feed items.
- [ ] Allow viral items to pre-empt evergreen order and choose the earliest reasonable coverage slot after approval.
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

### Task 12: Learn timing and format from account outcomes

**Files:**
- Modify: `scheduler.js`
- Modify: `strategy.js`
- Modify: `dashboard.js`

**Interfaces:**
- Consumes: accumulated post/account metrics and queue metadata.
- Produces: learned timing recommendation and evidence shown to the human.

**Steps:**
- [ ] After enough meaningful observations, calculate historical outcome summaries by weekday, hour, pipeline, niche, and media type.
- [ ] Use learned values as a ranking adjustment for scheduling recommendations, not as an autonomous guarantee of reach.
- [ ] Show the evidence behind timing recommendations in the dashboard.
- [ ] Keep editorial urgency capable of overriding learned evergreen timing when the user approves a genuinely time-sensitive signal.

**Acceptance criteria:**
- The scheduler can explain why it recommends a slot using `@ham_zax` history, while the human can override it.

### Task 13: Add three-dimensional opportunity scoring

**Files:**
- Create: `opportunity.js`
- Modify: `store.js`
- Modify: `strategy.js`
- Modify: `dashboard.js`
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: candidate niche data, freshness, viral velocity, source context, saved-preference data, and audience/relationship context when available.
- Produces: `{ reachPotential, followPotential, conversationPotential, breakdown }` plus persisted queue-item score fields.

**Steps:**
- [ ] Implement one transparent 0-100 scorer per dimension rather than one opaque viral score.
- [ ] Start Reach Potential from observable freshness/shelf-life, velocity, source reach/authority, breadth of developer relevance, and multi-source acceleration signals.
- [ ] Start Follow Potential from niche fit, useful/original angle headroom, evidence/implementation potential, account-identity reinforcement, and fit with saved preferences/target audience.
- [ ] Start Conversation Potential from relationship value, unresolved technical question/trade-off, technical specificity, freshness, and whether an answer would improve research.
- [ ] Return a component breakdown for every score so the dashboard/agent can explain the result.
- [ ] Persist the three scores on `queue_items` when an item enters or is refreshed in triage.
- [ ] Change route recommendation to consume the three dimensions without collapsing them into Phoenix-like raw-point arithmetic.
- [ ] Expose the scores and short explanations on research/triage cards and through an agent bridge command.

**Acceptance criteria:**
- A candidate can visibly be high-Reach/low-Follow, low-Reach/high-Follow, or high-Conversation without those differences being hidden by one total score, and the route recommendation explains how that affected Original/Quote/Reply/Repost/Ignore.

### Task 14: Add the Engagement Queue and Engage Next workflow

**Files:**
- Create: `engagement.js`
- Modify: `store.js`
- Modify: `audience.js`
- Modify: `dashboard.js`
- Modify: `agent_bridge.js`
- Modify: `automation.js`

**Interfaces:**
- Consumes: `audience_profiles`, recent niche/viral candidates, recent posts from priority relationship targets, replies/comments under our own posts when available, and Conversation Potential from `opportunity.js`.
- Produces: `queue_items` with `lane = engagement`, `pipeline = reply`, target context, expiry, suggested contribution, reviewable reply draft, and human decision state.

**Steps:**
- [ ] Reuse `queue_items` rather than creating a second queue table; engagement is a lane with different scheduling/sending rules.
- [ ] Discover recent posts from high-relevance audience targets and reply-suitable research candidates using the authenticated read path already used by the project.
- [ ] Create an engagement item only when the system can state a concrete contribution such as a result, implementation detail, caveat, comparison, correction, or informed question.
- [ ] Store `target_username`, `target_tweet_id`, relationship score, Conversation Potential, freshness, `expires_at`, and the reason the reply would be useful.
- [ ] Add an **Engage Next** dashboard view sorted primarily by freshness, Conversation Potential, and relationship value rather than follower count alone.
- [ ] Let AI draft a reply and move it to `needs_review`; require one human approval/send action for each outbound reply.
- [ ] Do not let the daemon batch-send or automatically send unsolicited replies.
- [ ] Expire opportunities whose source conversation is no longer timely instead of sending stale replies.
- [ ] Record successful replies in `candidate_actions` and feed resulting conversation/follower observations back into analytics.

**Acceptance criteria:**
- The dashboard can surface a current target-account post, explain why engaging is worthwhile, prepare one substantive reply, and wait for a human decision; no reply is sent merely because it entered the queue.

### Task 15: Add the Experiment Engine

**Files:**
- Create: `experiments.js`
- Modify: `store.js`
- Modify: `dashboard.js`
- Modify: `drafting.js`
- Modify: `scheduler.js`
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: approved experiment definitions, queue items before final drafting, writing/media/timing metadata, and completed fixed-window outcomes.
- Produces: experiment/variant assignments, cohort summaries, and evidence for future writing/format/timing recommendations.

**Steps:**
- [ ] Add `experiments` and `experiment_variants` persistence plus one nullable `experiment_variant_id` assignment on `queue_items`.
- [ ] Support initial dimensions `style`, `hook_type`, `media_type`, `format`, and later `timing_bucket` once enough timing history exists.
- [ ] Record a plain-language hypothesis before assigning variants, for example: `result-led hooks convert more AI/dev followers than question-led hooks for coding-agent originals`.
- [ ] Assign at most one primary experiment dimension to a publication when practical so the result remains interpretable.
- [ ] Never create duplicate or near-duplicate posts solely to form an A/B pair; compare naturally different future posts that satisfy the same experiment definition.
- [ ] Apply the assigned variant before final drafting/media selection when it affects the output, while allowing the human to decline or override the assignment.
- [ ] Show active experiments and each item's assignment in the dashboard before approval.
- [ ] Summarize normalized metrics by variant only after the relevant measurement window completes.
- [ ] Do not label a variant a winner until each compared variant has at least five completed 24-hour observations; before that, show `insufficient evidence` and raw cohort summaries.
- [ ] Never automatically change the account identity or permanent writing rules from one experiment; promote a finding only after repeated evidence and human acceptance.

**Acceptance criteria:**
- The system can run a declared non-duplicate content experiment, attach variants before publication, collect comparable outcomes, and show a cautious evidence summary without self-authorizing a permanent strategy change.

### Task 16: Add follower-conversion and follower-quality analytics

**Files:**
- Modify: `store.js`
- Modify: `automation.js`
- Modify: `audience.js`
- Modify: `dashboard.js`
- Modify: `experiments.js`
- Modify: `scheduler.js`

**Interfaces:**
- Consumes: publication baseline, fixed-window post metrics, account follower counts, audience snapshots, queue metadata, and experiment assignments.
- Produces: associated follower delta, follows/1k views, attribution confidence, newly observed follower quality, and grouped conversion summaries.

**Steps:**
- [ ] Capture follower count at publication baseline and at the 15m/1h/6h/24h measurement windows alongside post metrics.
- [ ] Compute `associated_follower_delta` and `follows_per_1000_views` for each window without claiming direct causal attribution.
- [ ] Mark attribution confidence `high` when no other main-feed publication occurred between baseline and capture, `medium` when exactly one other publication overlaps, and `low` when two or more overlap.
- [ ] Add/preserve `first_seen_at` for audience profiles so newly observed followers can be distinguished from the legacy follower set.
- [ ] When a new follower is observed, run the existing niche/audience classifier and record whether the follower appears aligned with the AI/developer/builder target audience.
- [ ] Show reach metrics and conversion metrics side-by-side so a large low-conversion post cannot automatically outrank a smaller high-quality recruiting post.
- [ ] Group conversion by niche, format, style, hook, media, semantic anchors, timing bucket, and experiment variant.
- [ ] Feed conversion summaries into experiment evaluation and learned scheduling as evidence, while keeping the human able to override recommendations.

**Acceptance criteria:**
- The dashboard can identify posts that produced strong reach but weak follower recruitment, posts associated with stronger follower conversion, and whether newly observed followers are increasingly aligned with the target niche, with attribution confidence visible.

## Rollout Order

### Phase 1 — Workflow foundation + triage intelligence

Tasks 1-4, then Task 13:

- Save -> triage;
- pipeline routing;
- Queue UI;
- human approval;
- Reach / Follow / Conversation scoring with explanations.

This is the first implementation milestone because it gives every later feature one workflow owner and gives the human a better decision surface before content is drafted.

### Phase 2 — Content quality

Tasks 5-7:

- format-aware writing;
- hard gates;
- media plan.

### Phase 3 — Engagement + distribution

Task 14, then Tasks 8-10:

- Engage Next lane for time-sensitive relationship opportunities;
- urgency and expiry;
- coverage-aware scheduler;
- format-aware main-feed publication.

The Engagement Queue may be refreshed by automation, but outbound replies remain one-by-one human decisions and do not become scheduler-driven unsolicited automation.

### Phase 4 — Experiment instrumentation + measurement

Task 15, then Tasks 11 and 16:

- declare experiments and attach variants before publication;
- capture fixed 15m/1h/6h/24h outcomes;
- capture associated follower conversion and follower quality;
- compare cohorts only after their measurement windows complete.

### Phase 5 — Learned strategy

Task 12:

- timing/format recommendations from actual account outcomes;
- incorporate follower conversion and experiment evidence;
- preserve human override and viral urgency.

## Risks and Boundaries

- X private web endpoints are not a stable public API contract. Publication transport may break independently of queue correctness.
- Current X automation rules restrict several forms of automated engagement; this architecture intentionally keeps likes, follow churn, mass replies, and unsolicited engagement outside the autonomous loop.
- The Engagement Queue must never become a reply quota. If there is no concrete contribution, the correct action is `ignore` or wait.
- Reach/Follow/Conversation scores are internal prioritization heuristics. They can be wrong and must show their component reasoning rather than masquerading as X's actual ranking score.
- No scheduler can guarantee virality. The system optimizes prerequisites: topic fit, distinctiveness, evidence, usefulness, freshness, readability, media value, timing, and follower-conversion value.
- `associated_follower_delta` is not direct causal attribution. Overlapping publications, profile changes, external mentions, or prior posts can contribute; attribution confidence must remain visible.
- Content experiments are observational cohort comparisons, not laboratory-isolated tests. Topic/source differences remain confounders, so the system must not overstate small-sample results.
- Do not publish duplicate/near-duplicate posts just to obtain an A/B pair; the experiment system learns across naturally different future posts.
- Do not infer that a short-term spike proves a new permanent content identity. Preference and performance changes should accumulate over multiple posts.
- Do not optimize timing as a way to mimic a human. Optimize timing because simultaneous or semantically redundant posts compete for limited attention.

## Definition of Done for the Full Program

The program is complete when a user can:

1. Save any research candidate.
2. See it automatically enter Triage.
3. See Reach Potential, Follow Potential, and Conversation Potential with understandable component explanations.
4. See an AI routing recommendation and reason.
5. Choose/override Original, Quote, Thread, Reply, Repost, Research, Watch, or Ignore.
6. See relevant reply opportunities separately in **Engage Next**, including relationship context, expiry, and the concrete contribution the system thinks we can make.
7. Review and explicitly send/ignore each outbound reply rather than having a daemon spray replies.
8. See research/evidence and a format-aware main-feed draft.
9. Optionally attach the item to a declared experiment and see the assigned variant before final drafting/approval.
10. See deterministic hard gates plus quality score.
11. Review media recommendation.
12. Approve the exact final main-feed content.
13. See the scheduler choose and explain a coverage slot.
14. See viral approved items pre-empt normal items without burst-posting.
15. See the correct X action published and persisted once.
16. See 15m/1h/6h/24h outcomes with reach and associated follower-conversion metrics side-by-side.
17. See attribution confidence and, when observable, whether newly observed followers are increasingly niche-aligned.
18. See experiment cohort summaries that refuse to declare a winner before the minimum evidence threshold.
19. See post outcomes feed back into future discovery, routing, writing, engagement targeting, format, experiment, and timing recommendations.
