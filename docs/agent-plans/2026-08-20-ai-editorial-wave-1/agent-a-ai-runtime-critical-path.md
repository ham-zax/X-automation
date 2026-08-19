# Agent A — AI Runtime Critical Path

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable behavior + configuration
**Workspace:** `/home/hamza/repo/x_test-w6-ai-runtime`
**Isolation reason:** runs concurrently with the deterministic editorial mission; Agent A is the only Wave-1 writer of AI persistence/runtime files and `store.js`
**Can start:** immediately
**Depends on:** architecture base `08132b7` and this coordination package
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md` — authoritative runtime/provider implementation contract.
- `docs/PRODUCT_ARCHITECTURE.md` — product authority and AI/human boundaries.
- `docs/agent-plans/2026-08-20-ai-editorial-wave-1/README.md` — neighboring ownership and integration policy.
- `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md` — downstream consumer contract; do not implement its domain work.

Use @Causal Coding before source mutation.

## Objective

Land the Phase-6-critical AI execution foundation so the existing writer can run through one provider-independent `runStructuredAI()` boundary while preserving today's Codex compatibility behavior. Support persisted non-secret profiles/default/role bindings/run provenance, durable secret references, Direct API execution for OpenAI/OpenRouter/arbitrary OpenAI-compatible endpoints, and the required Codex runtime path.

This mission should leave Phase 6 with a stable AI runtime interface without implementing editorial reasoning itself.

## Current state

- The current writer owns a Codex subprocess directly.
- There is no shared AI profile/default/role-binding persistence yet.
- There is no product-owned secret-reference store for provider API keys.
- The accepted plan now requires global-default resolution and `ai_runs.invocation_id` correlation.
- `continuous_scan` has no background consumer yet and must remain configuration-only / **Not active**.
- AGY/OpenCode/OpenCode 2 are optional and are not required to unblock Phase 6.

## Ownership

You own:

- AI runtime/provider persistence in `store.js`: profiles, one global default, per-role primary/fallback bindings, correlated `ai_runs`, and their domain helpers.
- `ai_secrets.js` and `.env.example` secret-reference behavior.
- `ai_direct.js` for OpenAI, OpenRouter, and arbitrary OpenAI-compatible direct endpoints, including Responses/Chat Completions and catalog/capability normalization required by the plan.
- `ai_cli.js` for the existing Codex critical-path runtime, including availability and structured execution with read-only/ephemeral constraints.
- `ai_runtime.js` and the common `runStructuredAI()` contract, including local schema validation, one compatibility repair where authorized by the plan, failure-class fallback semantics, execution provenance, and invocation correlation.
- Migration of `writer_runtime.js` from private Codex process ownership to `runStructuredAI({ role: 'writer', ... })` while preserving the no-configuration Codex compatibility default.

Neighboring missions own:

- Research-topic taxonomy, deterministic editorial scoring/validation, profile-proof calculation, controlled research primitives, and the canonical editorial prompt.
- Main integration later owns web/bridge configuration endpoints, AI Settings React UI, Phase-6 editorial runtime wiring, and other cross-domain integration.

## Coordination contract

- You are the only Wave-1 agent allowed to edit `store.js`.
- Do not edit Phase-6 editorial domain files merely to demonstrate `runStructuredAI()`.
- Keep `runStructuredAI()` provider-independent and aligned with the accepted plan; downstream callers should not receive provider-specific response objects.
- Profile resolution order is exactly: explicit profile override -> role binding -> global default profile -> documented role compatibility fallback.
- The writer compatibility fallback is the current Codex configuration only when no explicit/role/global default resolves a writer profile.
- Every logical run has one `invocation_id`; primary/fallback attempts share it and increment attempt order.
- Do not make `continuous_scan` run anything in this mission.
- Do not make optional AGY/OpenCode/OpenCode 2 completion a prerequisite for this mission. If you add only truthful availability/incompatibility detection for them while implementing the shared adapter boundary, keep it small; full optional adapters belong to a later slice.
- Do not modify `web_api.js`, `agent_bridge.js`, React UI files, Phase-6 source/research/editorial files, measurement/learning code, or publication authority.

## Success conditions

- Non-secret AI profiles, global default, role overrides/fallbacks, and AI-run provenance can be persisted/read without storing API keys or prompts in ordinary SQLite state.
- UI-managed secret values have a file/env reference contract that never returns or logs the resolved secret and implements the documented owner-only local-file semantics.
- Direct OpenAI/OpenRouter/OpenAI-compatible calls are normalized behind one adapter contract, including model catalog/manual-model behavior and structured-output compatibility handling described by the plan.
- Codex remains available through the shared runtime with the existing read-only/ephemeral structured-output behavior.
- `runStructuredAI()` returns only schema-valid output plus normalized execution provenance, applies fallback only for documented execution failures, and exposes the actual producing profile/runtime/model.
- Existing writer generation uses the shared boundary and retains current Codex behavior when no new AI configuration exists.
- No change grants AI any additional routing, approval, scheduling, publishing, reply-send, health, or learned-rule authority.
- The completed mission is committed on `agent/w6-ai-runtime-core` and the finish report identifies the public functions/contracts that main integration should consume.

## Required validation

No tests are authorized. Use only the smallest non-test syntax/static/direct checks necessary to establish the implemented runtime and writer contract. Do not run a broad application test suite.

## Out of scope

- Full AGY runtime implementation.
- Full OpenCode/OpenCode 2 runtime implementation.
- AI Settings API/UI.
- Phase-6 `editorial_runtime.js` or editorial prompts/domain logic.
- Source refresh, controlled editorial research, recommendation persistence/selection, Today/Discover UI.
- Measurement/learning/automation integration.
- Unrelated cleanup or dependency modernization.

## Working style

Explore the repository before deciding implementation details. Follow current code and the accepted plans rather than assuming the old Codex-only implementation shape must be preserved internally. Keep the change focused on the critical execution path. Do not create, modify, or run tests. Inspect the complete diff once at candidate completion and stop after the mission's observable contract is established.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commits created;
3. concise behavior/interface summary, especially `runStructuredAI()` and store/profile helper contracts;
4. non-test validation actually run, if any; otherwise state none;
5. anything the main integration session or Agent B-compatible downstream work needs to know;
6. unresolved risks, deviations, or decisions needed.
