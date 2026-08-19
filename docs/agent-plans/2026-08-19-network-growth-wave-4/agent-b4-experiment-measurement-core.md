# Agent B4 — Experiment & Measurement Core

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable
**Workspace:** `/home/hamza/repo/x_test-w2-content-integration`
**Branch:** `agent/w4-experiment-measurement-core`
**Depends on:** full Phase 3 publication metadata contract + pure Phase-1D health/network diagnostics
**Execution lifetime:** Persistent Agent Loop required

## Read first

- `docs/plans/PHASE_4_MEASUREMENT_EXPERIMENTS.md` — authoritative Phase-4 requirements.
- `docs/agent-plans/2026-08-19-network-growth-wave-4/README.md` — strict ownership boundary.
- `health.js`, `scheduler.js`, current queue/publication contracts in `store.js` as read-only context.

Use **Causal Coding** before source mutation. Do not create/run tests unless independently mandated.

## Objective

Create the pure Phase-4 domain owner in new `experiments.js`. Given supplied experiment definitions, publication measurements, relationship/network outcomes, and health context, it should validate/qualify experiment populations, normalize metrics, calculate attribution-confidence semantics, derive evidence states, and summarize content/network cohorts transparently.

This mission intentionally stops before SQLite persistence, automation capture, audience first-seen changes, dashboard, bridge, or scheduler integration.

## Required behavior

Implement pure deterministic behavior from the source plan, including:

- supported content/timing/network experiment dimensions;
- experiment definition/variant validation suitable for later persistence;
- population eligibility without inventing unavailable fields;
- normalized content metrics (`replies/reposts/visible engagement/associated follows per 1000 views`, plus views/time where supplied);
- attribution confidence: high/medium/low from overlapping main-feed publications with documented downgrade inputs, while preserving that follower change is associated rather than automatically causal;
- cohort summaries with sample size, primary metric, relevant secondary metrics, confounder distributions, and supplied health/network context;
- network summaries that retain InteractionYield raw components and target/class/topic diversity/top-target concentration rather than reducing them to likes;
- evidence states `insufficient -> preliminary -> directional -> repeated`, respecting declared minimum completed observations and the plan's 20-per-variant directional/repeated semantics;
- no winner/causal language before evidence supports it;
- naturally different future items only; no duplicate/near-duplicate A/B requirement;
- deterministic output for identical supplied inputs.

If the source plan leaves variant assignment policy unspecified, do not invent randomization machinery. Keep assignment as a validated caller/persistence decision and expose the pure eligibility/summary contract needed by the later integration session.

## Ownership / boundaries

Final commit must modify **only `experiments.js`**. No SQLite, `store.js`, automation, audience, relationship, health, dashboard, scheduler, bridge, docs, network, browser, or X actions.

Do not silently implement Phase 5 learned strategy. Do not turn saturation/volume/repetition cohorts into hard limits.

## Success conditions

- Content and network experiments can share one pure owner.
- An experiment population can be evaluated transparently from supplied item/context data.
- Follower deltas carry attribution confidence rather than false causality.
- Cohort summaries retain normalized reach/follow/conversation/network outcomes plus sample/confounder context.
- Evidence states prevent premature winners.
- High-volume reciprocal conversation cohorts remain analyzable without being classified as unhealthy solely by volume.
- Final commit changes only `experiments.js`.

## Verification intent

Use focused pure-function smoke covering population matching, normalization, attribution confidence and downgrades, content/network cohort summaries, InteractionYield raw components, evidence thresholds, insufficient sample behavior, and deterministic repeated inputs. Run `node --check experiments.js` and `git diff --check`. No tests, persistence, network, or live application mutation.

## Finish report

Return status; workspace/branch/commit; exact public exports; behavior/formula summary; checks actually run; inputs later Phase-4 integration must supply; assumptions/risks; and explicit one-file scope confirmation.
