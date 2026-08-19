# Implementation Plan Index

These files are the authoritative execution sequence for the network-first growth system. Phases 1A-1D and 2-5 are implemented; the phase files now serve as the executable design/history for the current runtime.

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
```

## Phase 1A — implemented

[`PHASE_1_WORKFLOW_FOUNDATION.md`](PHASE_1_WORKFLOW_FOUNDATION.md)

Current code now owns:

- `queue_items` foundation;
- Save -> Triage;
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
- ProfileProofCoverage context;
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

## Cross-cutting source-of-truth docs

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