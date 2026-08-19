# Agent B5 — Phase 4 Measurement & Experiments Integration

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable/mixed
**Workspace:** `/home/hamza/repo/x_test-w2-content-integration` on branch `agent/w5-phase4-integration`
**Isolation reason:** concurrent writer; owns the remaining Phase-4 persistence/capture/audience/UI/bridge vertical while Agent A7 owns only `learning.js`
**Can start:** immediately after assigned worktree points at the Wave-5 coordination base
**Depends on:** full Phase 1D, full Phase 3, integrated `experiments.js`
**Execution lifetime:** Persistent Agent Loop required

## Read first

- `docs/plans/PHASE_4_MEASUREMENT_EXPERIMENTS.md` — authoritative requirements.
- `docs/agent-plans/2026-08-19-network-growth-wave-5/README.md` — parallel ownership boundary.
- `experiments.js` — already-integrated pure owner; use its contracts rather than duplicating formulas.
- `store.js`, `automation.js`, `audience.js`, `relationship.js`, `dashboard.js`, `agent_bridge.js` — integration surfaces.
- `health.js` and `getAccountHealthSummary()` — health/network context inputs; do not redefine health state.
- `scheduler.js` and Phase-3 queue publication fields — publication measurement anchors.

Use **Causal Coding** before source mutation and **Persistent Agent Loop** for execution lifetime. Current plans do not authorize tests.

## Objective

Complete Phase 4 around the landed `experiments.js` core: persist fixed-window publication measurements and experiment definitions/variants/assignments, capture due measurements from existing read paths, preserve first-seen follower quality, expose normalized content/network outcomes with health context, and add Performance/Experiments dashboard and bridge interfaces.

Do not absorb Phase-5 learning or change production strategy based on experiment results.

## Ownership

You may modify:

- `store.js` — Phase-4 measurement/experiment persistence, due-window queries, first-seen preservation/query support;
- `automation.js` — due measurement capture only; preserve research and publication behavior;
- `audience.js` — preserve first-seen follower observation and expose newly observed follower quality;
- `relationship.js` — only the minimal first-seen/measurement aggregation support required by Phase 4; do not change TargetScore/stage semantics;
- `dashboard.js` — Performance + Experiments views;
- `agent_bridge.js` — Phase-4 inspection/write commands with explicit intent boundaries;
- Phase-4/current-state documentation: `README.md`, `AGENTS.md`, `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`, `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`, and evidence-ledger wording only when actually warranted;
- `experiments.js` only if a concrete integration defect in the landed core is demonstrated;
- `health.js` only if a concrete read-contract defect blocks Phase 4; prefer `getAccountHealthSummary()` as-is.

Do not create or modify `learning.js`.

## Required behavior

### Fixed-window measurements

Persist one row per published main-feed queue item per window:

```text
15m
60m
360m
1440m
```

Preserve actual `captured_at` when the process misses the exact target. Store visible post metrics, follower baseline/delta, normalized per-1000-view rates, attribution confidence, and metadata. Repeated cycles must remain idempotent.

Automation should check due windows and reuse/batch existing account/post performance reads where practical. It must not introduce any new X write path.

### Attribution confidence

Use `experiments.js` semantics. Count overlapping main-feed publications between baseline and capture, and visibly downgrade for known external referral, late baseline, or profile/account-change facts when supplied. Follower deltas are associated, not causal.

### New-follower quality

Preserve original first-seen timestamps across audience/relationship refreshes. Expose newly observed followers and niche-aligned quality using the existing classifier/relevance fields. Do not claim one-to-one post attribution.

### Experiment persistence/assignment

Persist experiments and variants, and link at most one active assigned variant to a queue item. Assignment is explicit/caller-selected; do not randomize and do not create duplicate content A/B pairs. Human may decline assignment without blocking content.

Support declared content, timing, and network dimensions from `experiments.js`. Timing assignment must respect the core's timing-history sufficiency contract.

### Cohort summaries

Use `experiments.js` for population evaluation, content/network normalization, confounder/sample visibility, and evidence states. Include Phase-1D health/network context as annotations rather than causal explanations. InteractionYield must retain raw numerator components.

### Dashboard

Extend Performance with fixed-window curves/rates, associated follower conversion with attribution confidence, and new-follower niche alignment. Add Experiments view showing definitions, variants, sample sizes, primary metric, evidence state, health/network context, and obvious confounders. Never show an automatic causal winner label.

### Bridge

Expose:

```text
measurements
experiments
experiment-create
experiment-assign
experiment-summary
```

Read commands are inspection. Creation/assignment require explicit user intent and must not silently alter production output beyond attaching the declared experiment context.

## Coordination boundary

- Do not modify `learning.js` or implement learned rules/acceptance.
- Do not change scheduler publication authority, human approval boundaries, engagement send semantics, or Account Health state rules.
- Do not add autonomous publishing/replies, random assignment, fixed reply caps, fake-human timing, or media-readiness bypasses.
- Do not treat likes alone as a learning/experiment primary conclusion.
- Do not infer visibility labels from reach changes.
- Preserve `AUTO_POST=false` behavior.

## Success conditions

- Every published main-feed queue item can accumulate at most one measurement per fixed window.
- A missed exact window records the first later capture with actual timestamp.
- Follower deltas include transparent attribution confidence and never become automatic causal claims.
- Newly observed follower quality is measurable with preserved first-seen state.
- Experiments/variants persist and explicit assignment attaches to eligible future items without randomization or duplicate posting.
- Content and network cohorts expose normalized metrics, sample sizes, confounders, evidence states, health/network context, and InteractionYield raw components.
- Dashboard and bridge can inspect the results and intentionally create/assign experiments.
- Phase 5 remains unimplemented by this branch.

## Verification intent

Use disposable SQLite state and injected/read-only data sources. Demonstrate migration preservation, one-row-per-window idempotency, due-window selection, actual-capture timing, attribution confidence, first-seen preservation, explicit variant assignment, population eligibility, cohort summaries, dashboard import/render, and bridge read/write intent boundaries. Use `node --check` on changed JS and `git diff --check` near completion. No test files, broad suites, or live X writes.

## Finish report

Return:

1. status;
2. workspace/branch/commit;
3. schema/interfaces/commands/UI added;
4. measurement/attribution/assignment semantics;
5. checks actually run;
6. inputs Phase 5 can consume after integration;
7. assumptions/risks;
8. changed-file scope and explicit confirmation that `learning.js` was not modified.
