# Agent A6 — Account Health Integration

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable/mixed
**Workspace:** `/home/hamza/repo/x_test-w2-engagement`
**Branch:** `agent/w4-account-health-integration`
**Depends on:** integrated `health.js` core, `fetchXUnderTheHoodReport()`, full Phase 1C, full Phase 3
**Execution lifetime:** Persistent Agent Loop required

## Read first

- `docs/plans/PHASE_1D_ACCOUNT_HEALTH.md` — authoritative requirements.
- `docs/ACCOUNT_HEALTH_AND_VISIBILITY.md` — semantics and provenance model.
- `docs/agent-plans/2026-08-19-network-growth-wave-4/README.md` — ownership boundary.
- `health.js`, `engagement.js`, `relationship.js`, `store.js`, `dashboard.js`, `agent_bridge.js`, `tech_news.js`.

Use **Causal Coding** before source mutation. Do not create/run tests unless independently mandated.

## Objective

Complete Phase 1D around the already-landed pure health core and visibility reader: persist observable health evidence with provenance; derive current account-health/network diagnostics from real relationship/engagement history; feed bounded WATCH-level health/repetition/saturation context into Engage Next; expose Account Health dashboard/bridge; and record Under-the-Hood snapshots only when actually observable.

## Required behavior

- Add append-only `account_health_observations` persistence and supported observation types from the source plan.
- Never store a guessed hidden reputation/bot/shadowban score.
- Build current health summary from `health.js` using persisted observations + actual relationship/engagement history.
- Provide bounded recent-reply/archetype inputs needed by `analyzeReplyRepetition`.
- Feed SaturationPressure/repetition/health context into Engage Next as transparent soft modifiers/warnings.
- WATCH alone must never remove the human approval path.
- `CONSTRAINED` must require supported observed hard evidence or an explicit project/platform constraint with provenance.
- Add Account Health UI with state reasons, evidence provenance, Network Quality components, InteractionYield raw components, saturation/repetition diagnostics, and visibility observations.
- Add bridge commands `account-health`, `health-observe`, and `health-under-the-hood`.
- `health-observe` requires explicit provenance and rejects speculative observation types.
- `health-under-the-hood` calls the existing bounded reader and records a snapshot only if `available:true`; unavailable is a clean non-error observation result, not evidence of health/constrained state.
- Synchronize current operating docs and evidence ledger only after behavior exists.

## Ownership / boundaries

You may modify `store.js`, `engagement.js`, `dashboard.js`, `agent_bridge.js`, relevant Phase-1D docs, and `relationship.js` only if current event reads are demonstrably insufficient. `tech_news.js` is read-only unless a concrete integration defect in the already-landed reader requires the smallest repair. `health.js` is a stable owner and should change only for a demonstrated integration defect.

Do not modify `experiments.js`, `scheduler.js`, main-feed publication behavior, Phase-4 measurement persistence, Phase-5 learning, media upload, or X write transport. Do not add reply quotas, fake-human timing, jitter, or hidden risk scores.

## Success conditions

- Observable health evidence round-trips with provenance and does not mutate relationship/action history.
- A reciprocal high-volume active conversation can remain HEALTHY.
- Repeated unanswered one-sided activity can become WATCH while retaining explicit human review/send capability.
- Only supported observed hard evidence can produce CONSTRAINED.
- Under-the-Hood absence/unavailability does not degrade health state.
- Engage Next displays health/repetition/saturation warnings with explanations and preserves active-conversation/direct-question/new-evidence offsets.
- Dashboard and bridge distinguish actual platform evidence from internal efficiency diagnostics.
- Phase 4 can consume health/network diagnostics without reverse engineering UI text.

## Verification intent

Use disposable SQLite/application state and mocked reader inputs only. Prove observation append/read behavior; HEALTHY/WATCH/CONSTRAINED boundaries; Under-the-Hood available/unavailable handling; repetition/saturation soft integration; bridge reads/writes; dashboard import/render. Run `node --check` on changed JS and `git diff --check` near completion. No live X writes or broad tests.

## Finish report

Return status; workspace/branch/commit; schema/interfaces/UI behavior; exact hard-vs-soft health boundary; checks actually run; Under-the-Hood integration semantics; inputs exposed for Phase 4; risks/deviations; and changed-file scope confirmation.
