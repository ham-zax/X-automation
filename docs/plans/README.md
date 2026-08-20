# Implementation Plan Index

These files are the authoritative execution sequence for the network-first growth system. Phases 1A-1D and 2-6 plus the shared AI runtime/provider layer are implemented. The plan files now serve as executable design/history for the current runtime and remaining optional work.

Do not implement later phases by inventing interfaces that earlier plans have not established yet.

## Execution order

```text
Phase 1A  Workflow foundation + four-dimensional triage
   |
   v
Phase 1B  Relationship Intelligence
   |
   v
Phase 1C  Engage Next + conversation follow-up
   |
   v
Phase 1D  Account Health + visibility observability
   |
   v
Phase 2   Content quality + profile proof + media plan
   |
   v
Phase 3   Main-feed distribution scheduler
   |
   v
Phase 4   Measurement + content/network experiments
   |
   v
Phase 5   Learned strategy
   |
   v
AI Runtime & Provider Layer (cross-cutting Phase-6 prerequisite)
   |
   v
Phase 6   AI Editorial Director
   |
   v
Viral Style Research (observational research subsystem)
```

## Phase 1A — implemented

[`PHASE_1_WORKFLOW_FOUNDATION.md`](PHASE_1_WORKFLOW_FOUNDATION.md)

Current code now owns:

- `queue_items` foundation;
- workflow entry -> Triage with Bookmark/reference state independent in the current product;
- route selection;
- human approval boundary;
- Reach / Follow / Conversation / Relationship potential;
- temporary compatibility with the current `draft.status=ready` automation path.

Does **not** own durable relationship history or engagement discovery.

## Phase 1B — implemented

[`PHASE_1B_RELATIONSHIP_INTELLIGENCE.md`](PHASE_1B_RELATIONSHIP_INTELLIGENCE.md)

Owns:

- `relationship_profiles`;
- `relationship_events`;
- target classes;
- TargetScore;
- relationship stage;
- Relationships dashboard/agent reads.

Depends on:

- Phase 1A queue conventions;
- existing audience sync.

## Phase 1C — implemented

[`PHASE_1C_ENGAGE_NEXT.md`](PHASE_1C_ENGAGE_NEXT.md)

Owns:

- target recent-post discovery;
- active-conversation response discovery;
- EngagePriority;
- reply contribution archetypes;
- expiry/freshness;
- Engage Next UI;
- explicit one-by-one reply review/send;
- relationship-event updates after interaction.

Depends on:

- Phase 1A queue;
- Phase 1B relationship intelligence.

## Phase 1D — implemented

[`PHASE_1D_ACCOUNT_HEALTH.md`](PHASE_1D_ACCOUNT_HEALTH.md)

Owns:

- `health.js`;
- HEALTHY / WATCH / CONSTRAINED account-health state;
- observed visibility/enforcement evidence with provenance;
- optional Under the Hood snapshots when observable;
- soft target saturation pressure;
- reply archetype/repetition diagnostics;
- network-quality summaries;
- InteractionYield;
- health warnings/modifiers consumed by Engage Next.

Depends on:

- Phase 1B relationship history;
- Phase 1C engagement items/actions.

Most Phase 1D signals are advisory. Target saturation, reply volume, repeated archetype, and conversation density do not independently hard-block a human-reviewed useful interaction.

## Phase 2 — implemented

[`PHASE_2_CONTENT_QUALITY.md`](PHASE_2_CONTENT_QUALITY.md)

Owns:

- format-aware original/quote/reply/thread writing contracts;
- canonical writer packet;
- ProfileProofCoverage packet/editorial contract plus the strict published-only shared runtime owner implemented with Phase 6;
- deterministic gates;
- 50-point score integration;
- thread storage;
- media plan/attachment metadata;
- final human editorial review.

Depends on:

- Phase 1A workflow;
- consumes Phase 1B/1C relationship context when available;
- consumes Phase 1D repetition/health context when available.

## Phase 3 — implemented

[`PHASE_3_DISTRIBUTION_SCHEDULER.md`](PHASE_3_DISTRIBUTION_SCHEDULER.md)

Owns:

- `scheduler.js`;
- urgency/expiry;
- main-feed serialization;
- semantic conflict/self-cannibalization checks;
- queue claim/publish lock;
- format-aware original/quote/thread publication;
- viral pre-emption.

Depends on:

- Phase 1A approval state;
- Phase 2 gates/final content.

## Phase 4 — implemented

[`PHASE_4_MEASUREMENT_EXPERIMENTS.md`](PHASE_4_MEASUREMENT_EXPERIMENTS.md)

Owns:

- fixed 15m/1h/6h/24h measurements;
- follower conversion with attribution confidence;
- new-follower quality;
- relationship conversion metrics;
- content experiments;
- network experiments;
- evidence states for cohort findings.

Depends on:

- Phase 1B/1C relationship events;
- Phase 1D health/network diagnostics;
- Phase 3 published queue metadata.

## Phase 5 — implemented

[`PHASE_5_LEARNED_STRATEGY.md`](PHASE_5_LEARNED_STRATEGY.md)

Owns:

- `learning.js`;
- suggested/accepted/retired learned rules;
- bounded target/engagement/content/timing adjustments;
- evidence-backed strategy recommendations;
- dashboard human acceptance/retirement of learned rules.

Depends on:

- Phase 4 measurements/experiments;
- Phase 1D account-health/visibility contract.

## AI Runtime & Provider Layer — implemented

[`AI_RUNTIME_PROVIDER_LAYER.md`](AI_RUNTIME_PROVIDER_LAYER.md)

Owns:

- one provider-independent `runStructuredAI()` execution boundary;
- per-role AI profiles for continuous scan, editorial scan, editorial final, and writer;
- Codex model/reasoning selection, including an operator-created Luna/Max profile when supported by the installed model catalog;
- first-class OpenRouter configuration and dynamic model catalog;
- arbitrary OpenAI-compatible base URL/API key/model configuration for local or remote inference;
- installed AGY structured runtime support with exact model catalog IDs and capability-gated flags; OpenCode/OpenCode 2 remain unavailable when not installed;
- AI Settings UI, runtime/model availability, structured-output capability checks, secret references, and observable usage/cost provenance;
- migration of the former Codex-only writer subprocess behind the shared boundary.

Changing runtime/provider/model never changes source truth, workflow state, evidence authority, human approval, publication authorization, or learned-rule acceptance.

## Phase 6 — implemented

[`PHASE_6_AI_EDITORIAL_DIRECTOR.md`](PHASE_6_AI_EDITORIAL_DIRECTOR.md)

Owns:

- one shared canonical source-refresh path for X Latest / X Momentum / GitHub Trending / HN Top Stories;
- current-source editorial context plus source-observation history and source-native momentum deltas;
- cross-source story clustering with deterministic pre-research/final recommendation scoring;
- controlled research evidence with claim scope, provenance, safe URL fetching, and an explicit manual/external research path when automatic evidence is insufficient;
- objective-aware AI editorial recommendations;
- machine-readable Research Agenda tiers plus strict published-only ProfileProofCoverage for planning/writing;
- multi-source recommendation/source linkage and append-only human-selection provenance;
- Today editorial-plan UX;
- recommendation provenance into Phase-4 measurements and Phase-5 learning.

Depends on:

- `AI_RUNTIME_PROVIDER_LAYER.md` before Phase-6 structured AI calls are wired;
- authoritative source snapshots/discovery data;
- Phase 1A workflow and opportunity scores;
- Phase 1B/1C relationship/conversation state;
- Phase 1D account health;
- Phase 2 writer/gates;
- Phase 3 scheduler boundary;
- Phase 4 measurements;
- Phase 5 accepted learned rules.

Phase 6 remains advisory: it may recommend Prepare / Research More / Skip and a format, but it cannot approve, schedule, publish, send, complete a repost, or accept learned rules.

## Viral Style Research — implemented observational subsystem

[`VIRAL_STYLE_RESEARCH.md`](VIRAL_STYLE_RESEARCH.md)

Owns:

- read-only discovery of high-signal X posts in the AI/developer niche;
- exact post/profile enrichment with observed views/likes/reposts/replies/bookmarks/follower counts;
- matched same-author control sampling when available;
- best-effort thread reconstruction;
- append-only longitudinal post/author snapshots;
- deterministic hook/style/format/timing features;
- local gitignored JSONL plus CSV/summary exports;
- follower-normalized and same-author comparisons that remain observational rather than causal.

The subsystem does not automatically change Editorial Director ordering, writer prompts, learned rules, approval, or publication authority. Any later promotion of an observed style into product guidance requires repeated evidence and explicit review.

### Viral Style Retrospective Analysis — implemented

[`VIRAL_STYLE_RETROSPECTIVE_ANALYSIS.md`](VIRAL_STYLE_RETROSPECTIVE_ANALYSIS.md)

Owns the offline 14-day/30-day study over the already-collected dataset:

- mature-post filtering without new X reads;
- current-taxonomy hook/style/feature extraction from stored text;
- same-author/same-age normalized lift when comparable peers exist;
- follower-cohort/age matched percentile evidence;
- 90% Wilson intervals for directional win/breakout rates;
- explicit `INSUFFICIENT`, `DIRECTIONAL`, `REPEATED_ASSOCIATION`, and `STRONG_REPEATED_ASSOCIATION` evidence classes;
- gitignored post/group CSV plus JSON/Markdown retrospective reports.

The confidence intervals describe observed association strength inside the collected sample; they are not future-post virality accuracy.

### Viral Styles Research UI — implemented

[`VIRAL_STYLE_UI_RESEARCH_FLOW.md`](VIRAL_STYLE_UI_RESEARCH_FLOW.md)

Owns the operator-facing Viral Styles workflow:

- explicit 14/21/30-day historical windows;
- selectable existing niche families and breakout/strong discovery floors;
- configurable per-query depth, same-author controls, and thread reconstruction;
- explicit AI semantic analysis using either a configured AI Settings profile or an installed structured runtime + exact model + reasoning level;
- constrained AI intent/style labels with confidence, rationale, exact text evidence, and runtime/model provenance;
- one bounded background research job with named `queued -> discovering -> enriching -> controls -> threads -> intent_ai -> analyzing -> exporting -> complete` checkpoints, monotonic progress, recent activity, and stop-between-units semantics;
- findings views for repeated/directional evidence, AI intent, niche/timing, and per-post research provenance.

Opening the tab is read-only. X collection and AI inference begin only after the operator presses **Run research**.

Baseline findings before the broader sweep are recorded in [`../VIRAL_STYLE_FINDINGS_2026-08-20.md`](../VIRAL_STYLE_FINDINGS_2026-08-20.md).

## Cross-cutting source-of-truth docs

- [`../PRODUCT_ARCHITECTURE.md`](../PRODUCT_ARCHITECTURE.md) — canonical end-to-end product map, current/planned phase state, final Discover -> Research -> Editorial AI -> Human -> Writer -> Human -> Publish -> Measure -> Learn loop, and AI/human authority boundaries.
- [`../NETWORK_GROWTH_OPERATING_SYSTEM.md`](../NETWORK_GROWTH_OPERATING_SYSTEM.md) — strategy and operating model.
- [`../RELATIONSHIP_INTELLIGENCE.md`](../RELATIONSHIP_INTELLIGENCE.md) — target/relationship domain contract.
- [`../ACCOUNT_HEALTH_AND_VISIBILITY.md`](../ACCOUNT_HEALTH_AND_VISIBILITY.md) — lenient account-health, visibility-observation, saturation/repetition, and network-quality contract.
- [`../ALGORITHM_EVIDENCE_LEDGER.md`](../ALGORITHM_EVIDENCE_LEDGER.md) — evidence classification.
- [`../HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`](../HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md) — cross-system master architecture.
- [`../POST_GENERATION_PROMPT.md`](../POST_GENERATION_PROMPT.md) — canonical writing/editor prompt.
- [`../CONTENT_OPERATING_STANDARD.md`](../CONTENT_OPERATING_STANDARD.md) — outbound content standard.

## Implementation discipline

Before starting a phase:

1. confirm its dependencies are implemented, not merely documented;
2. use the exact owners/interfaces in the phase plan unless repository evidence forces a revision;
3. update the plan first if an implementation decision materially changes persistence/domain ownership;
4. keep current vs planned behavior explicit in user/agent docs;
5. do not pull later-phase machinery into an earlier phase merely because the future schema is known.