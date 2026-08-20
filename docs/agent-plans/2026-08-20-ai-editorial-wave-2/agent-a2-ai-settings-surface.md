# Agent A2 — AI Settings + Configuration Surface

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable/UI
**Workspace:** `/home/hamza/repo/x_test-w6-ai-settings`
**Isolation reason:** concurrent web/API/UI work while Agent B2 owns Phase-6 persistence/orchestration
**Can start:** immediately
**Depends on:** integrated Wave-1 AI runtime/store contracts at `32c7575`
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md` — authoritative Tasks 7-8 and configuration UX contract
- `docs/agent-plans/2026-08-20-ai-editorial-wave-2/README.md` — neighboring ownership and integration boundary
- `docs/PRODUCT_ARCHITECTURE.md` — human/AI authority and product-surface contract

## Objective

Make the already-landed AI runtime/provider layer operable from the local product without changing its execution semantics. Deliver the AI configuration/runtime APIs, safe agent reads, and the React AI Settings surface so the operator can create/select profiles, choose the global default and role overrides/fallbacks, manage write-only API keys, inspect runtime/model availability, refresh model catalogs, check connections, and inspect recent execution provenance/usage.

## Current state

Wave 1 already provides `store.js` AI profile/default/binding/run helpers, `ai_secrets.js`, `ai_runtime.js`, Direct API/OpenRouter/OpenAI-compatible adapters, critical Codex support, and writer migration. Do not recreate or alter those owners unless a concrete correctness bug makes the existing public contract unusable; report such a conflict rather than absorbing runtime-core work.

## Ownership

You own:
- `web_api.js` AI configuration/runtime/catalog/check/recent-run endpoints;
- `agent_bridge.js` safe read/selection operations allowed by the source plan;
- `ui/src/features/settings/AISettings.tsx` and the React/API-client/router/Advanced wiring needed to expose it;
- truthful UI state for global default, role primary/fallback, runtime availability, capability status, secret existence, connection checks, and recent usage/provenance.

Neighboring mission owns:
- `store.js`, source refresh, editorial persistence/research/orchestration, `editorial_runtime.js`, automation source cycle, and all Phase-6 domain work.

## Coordination contract

Consume these existing owners rather than duplicating them: `resolveAiProfileForRole()`, profile/default/binding CRUD, `getAiSecretStatus()`/secret writes, `listAiCatalog()`, `listAiRuntimeAvailability()`, `checkAiProfileConnection()`, and recent `ai_runs` reads. Normal APIs must never return resolved secret values. `resolveAiSecret()` remains runtime-internal.

Do not modify `store.js`, `ai_runtime.js`, `ai_direct.js`, `ai_cli.js`, `ai_secrets.js`, `editorial.js`, `research.js`, or Phase-6 persistence/domain files.

## Success conditions

- Local web APIs can list/create/update/enable/disable/delete AI profiles with secret values write-only and non-secret reads truthful.
- Operator can get/set/clear the global default profile and role primary/fallback bindings.
- Runtime availability, provider/runtime model catalog, connection checks, and recent AI runs are exposed without secret/prompt disclosure.
- Agent bridge can safely explain active profiles/bindings/runtime availability and select existing non-secret configuration where authorized; no bridge secret-value read is added.
- `#/advanced/ai` provides a usable AI Settings screen covering global default, role assignments/fallbacks, profiles, model selection/manual model entry, write-only key replacement/removal, capability/availability, connection check, and recent usage/latency when observable.
- `continuous_scan` is explicitly **Not active** until a consumer exists; assigning a profile does not imply a running background job.
- No routing, approval, publishing, reply-send, health, measurement, or learned-rule authority changes.

## Required validation

None beyond the smallest non-test checks needed to observe the implemented API/UI contract. No tests are authorized.

## Out of scope

- Phase-6 editorial APIs/Today/Discover UI;
- source refresh/editorial persistence/research;
- full AGY/OpenCode/OpenCode 2 execution adapters;
- changes to AI runtime/profile persistence semantics;
- final documentation pass.

## Working style

Use @Causal Coding before source mutation. Inspect the current React/API patterns before deciding implementation details. Keep the change focused on AI configuration/product access. Do not create, modify, or run tests. Do not create additional worktrees.

## Finish report

Return:
1. status: complete / blocked / needs decision;
2. branch/workspace and commit hash;
3. API/bridge routes/commands and UI behavior delivered;
4. exact secret-read/write exposure semantics;
5. non-test validation actually run, if any;
6. anything the integration owner/Phase-6 UI work needs to know;
7. unresolved risks/deviations.
