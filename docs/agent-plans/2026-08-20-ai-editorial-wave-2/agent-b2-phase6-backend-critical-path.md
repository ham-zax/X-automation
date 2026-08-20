# Agent B2 — Phase-6 Backend Critical Path

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable
**Workspace:** `/home/hamza/repo/x_test-w6-editorial-backend`
**Isolation reason:** concurrent backend persistence/orchestration while Agent A2 owns web/API/UI configuration surfaces
**Can start:** immediately
**Depends on:** integrated Wave-1 AI runtime + deterministic editorial core at `32c7575`
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md` — authoritative Phase-6 backend contract
- `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md` — `runStructuredAI()` dependency/provenance contract
- `docs/agent-plans/2026-08-20-ai-editorial-wave-2/README.md` — ownership boundary
- `docs/EDITORIAL_RECOMMENDATION_PROMPT.md` — already-landed canonical prompt

## Objective

Land the provider-independent Phase-6 backend critical path from authoritative source snapshots through persisted claim-level evidence and a completed auditable Editorial Plan. Reuse the Wave-1 deterministic functions and shared `runStructuredAI()` boundary; do not build web/UI/workflow-selection/writer-evidence surfaces yet.

## Current state

Wave 1 already provides:
- shared AI profile/runtime/run persistence and `runStructuredAI()`;
- `editorial.js` deterministic objectives/Authority/story/recommendation primitives;
- `research_topics.js`, strict input-driven `profile_proof.js`, guarded `research.js:safeFetchResearchPage()`, current GitHub `starsToday` opportunity semantics, and the canonical editorial prompt.

The current repository still has duplicated source-refresh orchestration in `web_api.js` and `automation.js`, no Phase-6 editorial/research persistence, no strict store-owned published-main-feed reader for ProfileProof, no `editorial_runtime.js`, and no persisted end-to-end `refreshEditorialPlan()`.

## Ownership

You own:
- `store.js` Phase-6 source snapshot/observation, strict published-main-feed, editorial run/recommendation/research evidence/queue-source/selection persistence contracts;
- `source_refresh.js` plus the source-specific normalization needed from `tech_news.js`;
- migration of the automation research cycle to the shared source-refresh owner, without enabling automatic editorial selection/publication;
- `editorial.js` integration-level context/orchestration additions on top of the landed deterministic primitives;
- `editorial_runtime.js` using `runStructuredAI({ role: 'editorial_scan' | 'editorial_final', ... })` only;
- `research.js` controlled GitHub/HN/X/generic enrichment and evidence normalization/persistence-domain helpers needed by plan generation;
- persisted `refreshEditorialPlan({ objective, refreshSources = false, now })` through final code-owned ordering.

Neighboring mission owns:
- `web_api.js`, `agent_bridge.js`, React UI/API client, and AI Settings product surfaces.

## Coordination contract

Do not modify `web_api.js`, `agent_bridge.js`, React UI, `drafting.js`, `writer_runtime.js`, `pipeline.js`, Phase-4 measurement/learning code, or AI runtime/provider files.

`web_api.js` compatibility delegation to `source_refresh.js` is intentionally deferred to the integration/API wave to avoid a shared-file collision. Design `source_refresh.js` as a non-HTTP owner that the later wrapper can call directly.

Use `runStructuredAI()` rather than adapters/CLI processes. Validate model-returned candidate/evidence/algorithm IDs through the deterministic owners before persistence. Numeric potentials/Authority/objective fit/final ordering remain code-owned.

## Success conditions

- One canonical source-refresh owner supports `x_latest`, `x_momentum`, `github_trending`, and `hn_top`, preserves legacy snapshot-read compatibility, persists ordered snapshots and source observations, and returns per-source partial failure truthfully.
- `automation.js` uses the shared source-refresh owner instead of maintaining its own fetch/rank/upsert path; no automatic recommendation selection/publication is introduced.
- Store exposes strict `listPublishedMainFeedContent()` semantics suitable for ProfileProof: actually published Original/Quote/Thread only, with a real published/output tweet ID; approved/scheduled/draft/reply/repost/bookmark rows do not count.
- Store persists/reads `editorial_runs`, claim-scoped `research_evidence`, `editorial_recommendations`, `queue_sources`, and append-only `editorial_selections` per the authoritative schema/transition semantics.
- `buildEditorialContext()` assembles bounded current snapshots, workflow/handled state, source momentum, four potentials, relationship/conversation/account-health/recent-content/learned context, Research Agenda classification, and strict ProfileProof without refreshing sources implicitly.
- `editorial_runtime.js` performs scan/final structured calls through `runStructuredAI()` and returns execution provenance; it never browses or spawns provider processes.
- Controlled enrichment covers fixed GitHub metadata/README/release, HN item + guarded linked article, exact X/thread/quote context when available, explicit source URLs, and manual attached URLs through the guarded generic fetch boundary; evidence remains claim-scoped with source-family provenance.
- `refreshEditorialPlan()` can optionally refresh canonical sources, persist a run, validate/derive story keys, deterministically select the top five for research, persist evidence, run final editorial reasoning, recompute code-owned final scores/order, supersede prior unselected suggestions only after successful completion, and represent an empty/no-action plan honestly.
- Missing/rejected evidence remains unresolved; material unresolved claims cannot survive as `PREPARE` through a hidden penalty.

## Required validation

None beyond the smallest non-test checks needed to establish the backend contract. No tests are authorized. Do not make live X writes.

## Out of scope

- selecting a recommendation into queue/pipeline state;
- writer evidence-ID integration;
- Phase-6 web/agent endpoints and Today/Discover UI;
- measurement/learning provenance;
- AI Settings;
- automatic editorial refresh configuration beyond replacing the existing source-refresh duplication required by this mission;
- final docs.

## Working style

Use @Causal Coding before source mutation. Reuse the Wave-1 deterministic/runtime owners rather than creating parallel abstractions. Keep network retrieval read-only and within the controlled research contract. Do not create, modify, or run tests. Do not create additional worktrees.

## Finish report

Return:
1. status: complete / blocked / needs decision;
2. branch/workspace and commit hash;
3. source-refresh/store/editorial/research interfaces produced;
4. `editorial_runtime.js` and `refreshEditorialPlan()` contracts/provenance behavior;
5. non-test validation actually run, if any;
6. anything selection/writer/API/UI integration must know;
7. unresolved risks/deviations.
