# AI Runtime + Editorial Director Wave 4 — Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Source of truth:** `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md` and `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md`
**Coordination base:** `ce1b062` plus integrated selection/writer-evidence `1b93542`
**Execution shape:** parallel final product surface + optional installed AGY runtime adapter, then main integration and current-state documentation
**Current wave:** 4

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A4 — Editorial Product Surface | executable/UI | complete + integrated | completed | `/home/hamza/repo/x_test-w6-editorial-surface` | isolated web/bridge/React Editorial surface ownership | none |
| Agent B4 — AGY Structured Runtime Adapter | executable | complete + integrated | completed | `/home/hamza/repo/x_test-w6-agy-runtime` | isolated `ai_cli.js` runtime ownership | none |

## Dependency map

```text
Wave 3 integrated
selection + writer evidence + outcome provenance
                    |
          /-------------------\
          v                   v
       Agent A4             Agent B4
 Editorial API/bridge       installed AGY structured
 + Today/Discover           runtime adapter
 + outcome visibility       (OpenCode variants remain absent)
          \                   /
           \                 /
              main integration
                    |
                    v
        final current-state docs
 README + PRODUCT_ARCHITECTURE + AGENT_WORKFLOW
 NETWORK_GROWTH_OPERATING_SYSTEM + plan indexes
```

## Shared contracts

- `editorial.js` owns `refreshEditorialPlan()`, `selectEditorialRecommendation()`, and `dismissEditorialRecommendation()`; Agent A4 exposes these, it does not recreate them in HTTP/UI code.
- `research.js:attachEditorialResearchSource()` is the only Add Source path for manual/external research.
- `store.js:getLatestEditorialPlan()`, `getDiscoverSnapshot()`, `getSourceMomentum()`, and `getEditorialOutcomeSummary()` are authoritative reads. Agent A4 must not reconstruct plan/source/outcome truth from historical candidate backlog or current recommendation status.
- `source_refresh.js` is the only current source-refresh orchestration owner. Legacy `web_api.js` snapshot/refresh helpers must be removed or reduced to compatibility delegation, not retained as a second source owner.
- Human recommendation selection is not approval. UI/API selection must not approve, schedule, publish, send, complete reposts, change health state, or accept learned rules.
- Editorial recommendation ordering is backend-owned. UI must preserve persisted rank/order.
- Outcome summaries remain Phase-4 observational summaries: show real sample size/attribution/confounder context and never label cohort differences causal proof.
- Agent B4 owns optional AGY support in `ai_cli.js`. `ai_runtime.js` already delegates CLI runtimes through that adapter; change it only if the installed AGY contract proves a tiny normalization seam is genuinely required.
- Installed AGY is currently `1.1.15`. Its local CLI exposes `--print`, `--output-format`, `--json-schema`, `--sandbox`, `--mode`, `--model`, `--effort`, and `agy models`. OpenCode/OpenCode 2 are not installed and must remain truthfully unavailable.
- Do not use `--dangerously-skip-permissions` for editorial/writer jobs.
- No tests are authorized by the source plans.

## Workspace policy

Both missions are genuinely independent writable missions, so each uses an isolated worktree from the same coordination state. Use only the assigned worktree; do not create additional worktrees. Main remains the integration workspace.

If either mission discovers it needs the other mission's owned mutable file, report the boundary conflict rather than crossing it silently.

## Integration policy

Agent A4 is integrated on main as `f4aca2b`; Agent B4 is integrated on main as `5a6f066`. Wave 4 is complete. Current-state documentation is reconciled after those integration commits so it describes landed behavior rather than planned behavior.

## Validation policy

No test creation, modification, or execution. Use only the smallest relevant non-test syntax/type/build/direct checks needed to establish the requested behavior, then inspect the final diff once.

Do not make live X writes. Agent A4 should not trigger provider/model inference merely to validate UI/API wiring. Agent B4 should not spend inference tokens merely to validate CLI argument construction unless the user separately authorizes a live model call.

## Future / blocked work

- Final current-state documentation / plan completion marking — blocked until A4 and B4 integrate.
- OpenCode/OpenCode 2 execution adapters — remain unavailable while the corresponding runtimes are not installed; do not invent or parse undocumented TUI behavior.
- `continuous_scan` background consumer — still intentionally not active; profile assignment alone must not imply a running continuous job.

## Status log

- `2026-08-20` — Waves 1-2 integrated runtime/settings/editorial backend foundations.
- `2026-08-20` — Wave 3 selection/writer evidence and outcome/background refresh integrated as `1b93542` and `ce1b062`.
- `2026-08-20` — Wave 4 materialized as the final operator-facing product surface plus the independently supported installed AGY adapter.
- `2026-08-20` — Agent A4 Editorial Product Surface integrated as `f4aca2b`; Agent B4 AGY adapter integrated as `5a6f066`; final current-state documentation reconciliation completed with syntax/UI-build/diff checks passing.
