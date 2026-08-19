# AI Runtime + Editorial Director Wave 1 — Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Source of truth:** `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md` and `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md`
**Architecture base:** `08132b7` (`docs: define product architecture and ai editorial plan`)
**Execution shape:** hybrid: two isolated parallel missions, then main-branch integration
**Current wave:** 1

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A — AI Runtime Critical Path | executable/config | ready | now | `/home/hamza/repo/x_test-w6-ai-runtime` | concurrent executable changes; Agent A owns AI persistence/runtime files | none |
| Agent B — Deterministic Editorial Core | executable/docs | ready | now | `/home/hamza/repo/x_test-w6-editorial-core` | concurrent executable changes; Agent B is kept off shared persistence/API/UI files | none |

## Dependency map

```text
08132b7 architecture + provider/editorial contracts
                 |
        coordination package
          /               \
         v                 v
Agent A: AI runtime    Agent B: deterministic
critical path          editorial domain core
         \                 /
          \               /
           v             v
         Main integration wave
                |
                +--> shared source-refresh + editorial persistence/orchestration
                +--> editorial_runtime.js through runStructuredAI()
                +--> selection + researched writer evidence
                +--> APIs / Today / Discover / AI Settings
                +--> measurement / automation / docs
```

## Shared contracts

- `docs/PRODUCT_ARCHITECTURE.md` is the product-level authority map.
- `runStructuredAI({ role, profile, prompt, schema, ... })` is the only planned semantic-AI execution boundary. Agent B must not create a private Codex/provider subprocess.
- AI profile resolution is explicit override -> role binding -> global default -> documented compatibility fallback.
- `continuous_scan` is configuration-only in this wave and remains **Not active** until a concrete background consumer exists.
- Agent A owns `store.js` changes in Wave 1, and only for the AI runtime/provider persistence contract. Agent B must not edit `store.js`.
- Agent B may implement pure/input-driven editorial functions that later consume store-owned data, but it must not invent a second persistence owner.
- Neither current-wave agent owns `web_api.js`, `agent_bridge.js`, React UI integration, Phase-4 measurement integration, or automation wiring. Main integration owns those later seams unless replanned.
- No source, provider, or model choice may alter human approval/publication authority.

## Workspace policy

Both missions are concurrent writable code missions, so each gets a separate worktree from the same coordination state. Do not create additional worktrees. Main remains the integration workspace and should not be used by either coding agent.

Write ownership is separated deliberately:

- Agent A: AI runtime/provider persistence and execution path.
- Agent B: deterministic editorial calculations, research-topic taxonomy, strict input-driven profile-proof logic, controlled research retrieval primitives, and canonical editorial prompt.

If either mission discovers that correctness requires editing a neighboring mission's owned file, report the boundary conflict instead of expanding silently.

## Integration policy

Main/integration owner reviews and integrates both returned commits. Do not merge one agent branch into the other. Downstream Phase-6 orchestration is unlocked only after the AI runtime contract and deterministic editorial interfaces are reconciled on main.

No runtime code is considered integrated merely because both branches individually complete.

## Execution lifetime policy

Both current-wave missions are ordinary coding sessions. They should finish one coherent mission and return a commit/report. No persistent wait loop is required unless an agent encounters a real external wait condition.

## Validation policy

The authoritative plans explicitly state that no tests are authorized. Agents must not create, modify, or run tests. They may use the smallest relevant non-test syntax/static/build observation needed to establish their own requested behavior, then inspect their diff once and stop.

## Future / blocked work

- Shared source-refresh/store observation persistence and editorial persistence/orchestration — blocked on Wave-1 integration and single-owner `store.js` planning.
- `editorial_runtime.js` scan/final calls — blocked on Agent A's `runStructuredAI()` contract.
- Persisted controlled research + selected-recommendation provenance — blocked on integrated store/editorial contracts.
- Writer evidence-ID integration — blocked on persisted research evidence and recommendation selection provenance.
- AI Settings APIs/UI and Today/Discover editorial surfaces — blocked on stable runtime/editorial read/write contracts.
- Phase-4/5 outcome provenance, optional background refresh, bridge commands, and current-state docs — blocked on the integrated editorial workflow.
- Optional AGY/OpenCode/OpenCode 2 adapters — not a Phase-6 critical-path blocker.

## Status log

- `2026-08-20` — architecture/provider/editorial plan set committed on main at `08132b7`.
- `2026-08-20` — Wave 1 prepared as two isolated concurrent missions with main reserved for integration.
