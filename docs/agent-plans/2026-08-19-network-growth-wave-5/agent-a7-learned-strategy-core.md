# Agent A7 — Learned Strategy Core

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable
**Workspace:** `/home/hamza/repo/x_test-w2-engagement` on branch `agent/w5-learned-strategy-core`
**Isolation reason:** concurrent writer; this mission owns only new pure `learning.js`
**Can start:** immediately after assigned worktree points at the Wave-5 coordination base
**Depends on:** Phase 1D complete plus stable `experiments.js` evidence/cohort contracts
**Execution lifetime:** Persistent Agent Loop required

## Read first

- `docs/plans/PHASE_5_LEARNED_STRATEGY.md` — authoritative behavior.
- `docs/agent-plans/2026-08-19-network-growth-wave-5/README.md` — strict ownership boundary.
- `experiments.js` — evidence-state/cohort contract to consume, not replace.
- `health.js`, `relationship.js`, `engagement.js`, `scheduler.js`, `opportunity.js`, `strategy.js` — base-model semantics that learned adjustments must never obscure or bypass.

Use **Causal Coding** before source mutation and **Persistent Agent Loop** for execution lifetime. Current plans do not authorize tests.

## Objective

Implement the pure Phase-5 strategy-learning owner in a new `learning.js`. Given already-supplied Phase-4 experiment/cohort summaries, relationship/network outcomes, health context, current rules, and optional algorithm-evidence mechanism status, produce explainable candidate learned rules, bounded proposed adjustments, acceptance eligibility, and review/retirement signals.

This mission deliberately stops before persistence, dashboard, bridge, or production score application. It establishes the deterministic domain contract only.

## Ownership

You own only:

- new `learning.js`;
- candidate finding/rule generation from supplied evidence summaries;
- evidence-state qualification and minimum-sample safeguards;
- scope-specific adjustment bounds;
- suggested/accepted/retired rule semantics as pure data transformations;
- accepted-rule matching/application helpers that return base, learned adjustment, and final values separately without mutating production state;
- review/decay signals for stale/reversed/mechanism-invalidated evidence;
- focused pure verification.

## Coordination boundary

- Final commit must change only `learning.js`.
- Do not read/write SQLite.
- Do not modify `store.js`, `experiments.js`, `relationship.js`, `engagement.js`, `health.js`, `scheduler.js`, `strategy.js`, `opportunity.js`, dashboard, bridge, automation, docs, or package files.
- Treat measurements, experiment summaries, health/network summaries, current accepted rules, and algorithm evidence as caller-supplied inputs.
- Do not auto-accept any rule.
- A suggested rule may be emitted at preliminary evidence, but production/effective adjustment remains zero until explicit accepted status is supplied by a later integration layer.
- Acceptance eligibility requires at least directional evidence.
- One outlier or one viral item must not create an actionable learned adjustment.
- Preserve the account's niche identity and base formulas.
- No learned rule may bypass hard duplicate gates, explicit expiry, human approval, or a direct manual route/schedule decision.
- Health learning may tune WATCH-level soft behavior only. It must never infer CONSTRAINED from low reach/volume and must never create a hard constraint without supported observed platform/project evidence.
- Do not introduce fixed daily reply caps, fake-human timing, jitter, or human-simulation logic.

## Required domain behavior

Support the plan's rule scopes:

```text
targeting
engagement
health
content
timing
format
topic
```

Use the plan's evidence states:

```text
insufficient
preliminary
directional
repeated
```

Enforce bounded proposed/effective adjustments:

```text
TargetScore component        +/-10
EngagePriority               +/-10
SaturationPressure           +/-10
health WATCH modifier        +/-8
Follow/Reach/Conversation    +/-8
scheduler timing preference  +/-15
content/format preference    +/-10
```

Candidate learned output must expose enough evidence for later UI/persistence to show:

- scope/key;
- finding/recommendation;
- sample size;
- comparison baseline/primary metric;
- evidence state;
- proposed adjustment and applicable bound;
- whether the rule is eligible for human acceptance;
- why production effect is zero when not accepted;
- mechanism/evidence-ledger tags when supplied;
- review/retirement reasons when evidence is stale, reversed, the niche changed, or a linked public mechanism is retired/materially changed.

For strong/repeated recommendations, preserve evidence that the result is not merely one period/topic/outlier where the source plan requires broader support.

## Success conditions

- The same evidence inputs produce deterministic byte-equivalent summaries.
- Preliminary evidence can create a suggestion but cannot produce an effective adjustment.
- Directional/repeated evidence can be marked acceptance-eligible, but still has no effect until caller supplies accepted status.
- Accepted adjustment totals are clamped to the relevant scope bound and base vs learned vs final values remain visible.
- A viral outlier cannot independently promote a rule into a meaningful adjustment.
- Low reach alone cannot create a health constraint or `CONSTRAINED` recommendation.
- Saturation/repetition/interaction-volume findings remain soft/advisory.
- A retired/materially changed linked mechanism or reversed newer evidence produces a review/retire signal rather than silently continuing forever.
- No side effects or production mutations occur.

## Verification intent

Use focused pure-function smoke scripts for evidence thresholds, bounds, accepted-vs-suggested semantics, outlier resistance, health hard-boundary preservation, mechanism review flags, reversal/newer-observation review, and deterministic repeated inputs. Run `node --check learning.js` and `git diff --check` near completion. Do not create tests.

## Finish report

Return:

1. status;
2. workspace/branch/commit;
3. exact public exports from `learning.js`;
4. behavior/formula summary;
5. checks actually run;
6. inputs later Phase-5 integration must supply;
7. assumptions/risks;
8. confirmation that the commit changes only `learning.js`.
