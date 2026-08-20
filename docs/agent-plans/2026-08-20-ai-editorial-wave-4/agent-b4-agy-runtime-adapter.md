# Agent B4 — AGY Structured Runtime Adapter

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable
**Workspace:** `/home/hamza/repo/x_test-w6-agy-runtime`
**Isolation reason:** owns only the optional AI CLI runtime seam while Agent A4 owns web/bridge/React Editorial surfaces
**Can start:** immediately
**Depends on:** integrated AI runtime/provider layer already on main
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md` — authoritative AGY/OpenCode runtime contract and Task 4.
- `docs/agent-plans/2026-08-20-ai-editorial-wave-4/README.md` — current ownership and constraints.
- Current `ai_cli.js` and `ai_runtime.js` — actual adapter boundary.
- Installed runtime help: `agy --help`, `agy models --help`, and current version output. The coordination base observed AGY `1.1.15` with noninteractive structured-output flags.
- If outside documentation is needed, use current official Google Antigravity/AGY documentation referenced by the source plan; do not rely on third-party examples when the installed CLI or official docs answer the contract.

## Objective

Complete the optional installed AGY runtime path behind the existing `runStructuredAI()` abstraction without changing product/domain authority. AGY should become truthfully usable for structured editorial/writer roles when its installed model/runtime contract supports the selected profile. OpenCode and OpenCode 2 are not installed and must remain explicitly unavailable rather than receiving speculative adapters.

## Current state

`ai_runtime.js` already routes every non-direct runtime through `ai_cli.js`, so the expected implementation owner is `ai_cli.js`.

Current `ai_cli.js` has a complete Codex adapter and truthful availability detection for `codex`, `opencode`, `opencode2`, and `agy`, but all non-Codex runtimes currently report `adapter_not_implemented` and `runCliStructuredAI()` rejects them.

The installed AGY CLI currently exposes:

```text
agy 1.1.15
--print
--output-format text|json|stream-json
--json-schema <schema string or path>
--sandbox
--mode accept-edits|plan
--model
--effort low|medium|high
--disable-slash-commands
agy models
```

The product must not use `--dangerously-skip-permissions` for editorial/writer jobs.

## Ownership

You own:

- `ai_cli.js` AGY availability, model catalog, connection-check, and structured execution behavior.
- `ai_runtime.js` only if the integrated runtime requires a very small normalization seam that cannot correctly live in `ai_cli.js`; do not otherwise modify it.

Neighboring work owns:

- Direct OpenAI/OpenRouter/OpenAI-compatible execution;
- Codex behavior unless a shared helper must change to support AGY without regression;
- AI Settings HTTP/UI;
- Phase-6 Editorial domain/workflow/UI;
- final current-state documentation after Wave 4 integration.

## Coordination contract

Preserve the public `runCliStructuredAI()`, `getAiCliAvailability()`, `listCliAiCatalog()`, and `checkCliAiConnection()` shapes expected by `ai_runtime.js`.

AGY structured execution must:

- run non-interactively;
- use sandbox + plan/read-only behavior for editorial/writer jobs;
- disable slash/skill expansion if that is the installed runtime's supported way to keep source content from invoking runtime commands;
- select exactly the configured model; never silently substitute another model;
- pass the supplied JSON Schema through AGY's supported schema option;
- request JSON output and return only the final structured result to `ai_runtime.js`;
- map supported reasoning values to AGY `--effort` only when valid for the installed contract;
- keep runtime-managed authentication/config external to this product;
- normalize runtime/provider/model/reasoning/usage metadata without inventing unavailable token/cost data.

AGY catalog behavior must use the runtime's supported `agy models` output. If the selected model disappears from the runtime catalog, report it unavailable/unknown through the existing capability/connection surfaces; do not translate or replace the model ID.

Connection checking should be bounded and non-mutating. Prefer runtime availability/catalog/model presence and supported auth/connectivity observations; do not spend inference tokens merely to make a connection-check button look stronger.

OpenCode/OpenCode 2 are not installed in the coordination environment. Preserve **Not installed** / unsupported state; do not add undocumented TUI parsing or speculative executable behavior.

## Success conditions

- `getAiCliAvailability('agy')` reports installed AGY as structured-output capable when the observed installed contract supports the adapter.
- `runCliStructuredAI()` supports `runtime = 'agy'` through the same normalized result shape as Codex and does not bypass `ai_runtime.js` local schema validation/provenance.
- AGY execution uses noninteractive sandbox/plan semantics, JSON Schema, explicit model, and JSON final output without dangerous permission bypass.
- `listCliAiCatalog()` returns normalized AGY model entries when `agy models` succeeds and truthful unavailable/error state when it does not.
- `checkCliAiConnection()` reports truthful AGY runtime/model/catalog capability without requiring a live generation request.
- AGY model/reasoning provenance is the actual selected runtime state; unknown token/cost fields remain `null` rather than zero.
- Existing Codex compatibility behavior remains unchanged.
- OpenCode/OpenCode 2 remain unavailable while their executables/contracts are absent.
- AI Settings can consequently see AGY as assignable only when the adapter/runtime capability is actually usable; no UI-specific special case is required in this mission.

## Required validation

None mandated by the source plan beyond the observable adapter contract. Do not create or run tests. Use bounded local help/version/catalog commands, syntax checks, and direct argument/output parsing checks as needed. Do not perform a live AGY model inference merely for validation unless the user separately authorizes that provider/model call.

## Out of scope

- Installing OpenCode/OpenCode 2 or implementing adapters for absent/undocumented runtimes.
- Rewriting global AGY configuration or credentials.
- AI Settings or Editorial UI/API changes.
- Final repository documentation.
- Live X writes.

## Working style

Use the installed AGY contract and current official documentation when necessary. Keep all runtime-specific behavior inside the existing CLI adapter boundary. Prefer a small extension of the current Codex-oriented helpers over introducing a second runtime architecture.

Do not create, modify, or run tests. Do not create another worktree.

## Finish report

Return:
1. status: complete / blocked / needs decision;
2. branch/workspace and commit hash;
3. exact AGY CLI invocation contract implemented;
4. catalog/model-resolution behavior;
5. connection/capability behavior;
6. normalized execution provenance/usage behavior;
7. confirmation that Codex and absent OpenCode states remain correct;
8. bounded non-test validation actually performed;
9. any official/runtime-contract limitation the final docs must state;
10. unresolved risks/deviations.
