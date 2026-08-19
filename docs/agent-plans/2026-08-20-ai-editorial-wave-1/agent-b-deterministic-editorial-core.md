# Agent B — Deterministic Editorial Core

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable behavior + documentation
**Workspace:** `/home/hamza/repo/x_test-w6-editorial-core`
**Isolation reason:** runs concurrently with the AI runtime mission; this mission deliberately avoids shared persistence/API/UI files
**Can start:** immediately
**Depends on:** architecture base `08132b7` and this coordination package
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md` — authoritative Phase-6 contract.
- `docs/PRODUCT_ARCHITECTURE.md` — final product loop and authority model.
- `docs/agent-plans/2026-08-20-ai-editorial-wave-1/README.md` — ownership and integration boundaries.
- `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md` — only to respect the future `runStructuredAI()` seam; do not implement the provider layer.
- `docs/RESEARCH_AGENDA.md`, `docs/ALGORITHM_EVIDENCE_LEDGER.md`, `docs/CONTENT_OPERATING_STANDARD.md`, and `docs/NICHE_AND_KEYWORDS.md` — source contracts for deterministic editorial semantics and the canonical prompt.

Use @Causal Coding before source mutation.

## Objective

Build the provider-independent, persistence-independent deterministic core of Phase 6 so later integration can assemble live snapshots/evidence from `store.js` and invoke AI through `runStructuredAI()` without re-deriving editorial math or taxonomy.

Own the deterministic Research Agenda mapping, strict input-driven ProfileProofCoverage calculation, current GitHub opportunity correction, story/recommendation scoring and validation primitives, safe generic research-page retrieval primitives, and the canonical editorial prompt. Keep all functions usable from supplied inputs so this branch never needs to edit the shared `store.js` owner.

## Current state

- Current GitHub candidates already expose real `starsToday`, but `opportunity.js` still uses legacy `starsPerDay` in GitHub traction.
- Research Agenda tiers/topics exist only in prose today.
- `drafting.js` accepts a `profileProof` packet, but there is no strict shared runtime coverage owner yet.
- There is no Phase-6 `editorial.js`, `research_topics.js`, `research.js`, or canonical editorial prompt yet.
- Agent A concurrently owns AI runtime/provider persistence and all Wave-1 `store.js` changes.
- Source snapshot persistence, editorial database tables, source-refresh orchestration, and final AI execution remain later integration work.

## Ownership

You own:

- `opportunity.js` correction for current GitHub `starsToday` semantics while preserving legacy-candidate behavior.
- `research_topics.js`: the exact machine-readable topic IDs, tiers, deterministic high-specificity anchors, matching, and story primary-topic selection defined in the Phase-6 plan.
- `profile_proof.js`: deterministic coverage calculation from caller-supplied **actually published main-feed content** plus topic/semantic anchors. It must not query or mutate persistence in this wave; later integration will supply rows from the strict `store.js:listPublishedMainFeedContent()` owner.
- `editorial.js`: pure/provider-independent editorial constants and deterministic functions that can be established without persistence or AI execution, including objective weights, Authority component mappings/validation, pre-research story fit/primary-candidate selection, final recommendation potential selection, deterministic objective-fit ordering, and validation helpers for bounded enums/IDs/angle semantics where inputs are supplied.
- `research.js`: the guarded untrusted generic-page retrieval boundary and reusable evidence-normalization primitives that do not require persistence. Implement the Phase-6 `safeFetchResearchPage()` network trust contract; leave evidence-row storage/orchestration to later integration.
- `docs/EDITORIAL_RECOMMENDATION_PROMPT.md`: canonical editorial scan/final reasoning contract aligned with Phase 6, including source-as-untrusted-data, no browsing/tooling by the model, evidence/algorithm ID limits, PREPARE/RESEARCH_MORE/SKIP semantics, and no final publication prose.

Neighboring missions own:

- Agent A owns `store.js`, AI profiles/provider execution, `runStructuredAI()`, and writer-runtime migration.
- Main integration later owns source-refresh orchestration, source/editorial persistence, `editorial_runtime.js`, final plan orchestration, selected-recommendation workflow linkage, writer evidence integration, APIs/UI, measurements, automation, and bridge commands.

## Coordination contract

- Do not edit `store.js`, `web_api.js`, `agent_bridge.js`, `writer_runtime.js`, `drafting.js`, React UI files, automation, measurement, or learning code.
- Do not create a Codex/OpenRouter/provider subprocess or call a model directly.
- `editorial.js`, `profile_proof.js`, and evidence helpers in this wave should accept explicit data inputs rather than smuggling persistence ownership into the module.
- Preserve the exact five objective profiles and code-owned scoring/order semantics from the accepted Phase-6 plan.
- The AI may supply only the bounded `angleClass`; code must validate/downgrade it against evidence/source-family facts supplied by the caller.
- Keep algorithm mechanism tags dependent on the explicit Phase-6 mapping; do not create a competing evidence taxonomy or hard-code retired folklore as product truth.
- `safeFetchResearchPage()` must enforce the documented destination-address/redirect/timeout/body/content-type boundary and must not provide an alternate bypass network path on rejection.
- The canonical prompt may describe the shared `runStructuredAI()` contract but must not depend on Agent A implementation details.
- If a required function cannot remain persistence-independent without changing the authoritative contract, report that seam for integration rather than editing `store.js`.

## Success conditions

- Current GitHub opportunity traction consumes `starsToday` for current Trending candidates and preserves the plan's explicit legacy fallback.
- Research Agenda topic/tier matching is machine-readable, deterministic, and excludes generic single-token matches as documented.
- ProfileProofCoverage produces `none/weak/medium/strong`, supporting IDs, and a reason from only supplied published-main-feed items; drafts, approved/scheduled items, replies, repost-only actions, and bookmarks cannot enter through its contract.
- Deterministic editorial functions reproduce the accepted objective weights, pre-research story ranking, primary/target candidate potential semantics, Authority component validation, and final code-owned ordering without calling AI or SQLite.
- The generic research fetch helper enforces the accepted SSRF/redirect/size/timeout/content-type boundary and returns structured success/failure data suitable for later evidence persistence.
- The canonical editorial prompt cleanly separates scan from final planning, treats source material as untrusted data, references only supplied evidence/algorithm IDs, returns bounded structured semantics, and never asks the model to generate final post copy or exercise workflow authority.
- The completed mission is committed on `agent/w6-editorial-core` and the finish report names the pure interfaces main integration can wire to persistence and `runStructuredAI()`.

## Required validation

No tests are authorized. Use only the smallest non-test syntax/static/direct checks necessary to establish these deterministic modules and documentation. Do not run a broad application test suite and do not make live X writes.

## Out of scope

- Any `store.js` schema/helper changes.
- `source_refresh.js` persistence/orchestration and source-observation tables.
- Editorial run/recommendation/evidence persistence.
- `editorial_runtime.js` or any real model execution.
- Writer evidence-ID wiring or writer generation changes.
- Workflow selection/routing integration.
- Web/bridge APIs and React UI.
- Phase-4/5 measurement/learning integration or automation refresh.
- Optional provider/runtime work owned by Agent A/later waves.

## Working style

Explore current code before choosing implementation details. Keep the new core input-driven and easy for the integration owner to compose. Follow the accepted plan's exact numeric mappings and trust boundaries rather than inventing extra scoring rules or verification machinery. Do not create, modify, or run tests. Inspect the complete diff once at candidate completion and stop after this mission's observable contract is established.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commits created;
3. concise behavior/interface summary, especially exported deterministic functions and research-fetch contract;
4. non-test validation actually run, if any; otherwise state none;
5. anything main integration needs to know when wiring persistence and `runStructuredAI()`;
6. unresolved risks, deviations, or decisions needed.
