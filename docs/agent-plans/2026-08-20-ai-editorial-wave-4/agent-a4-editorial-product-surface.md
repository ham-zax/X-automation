# Agent A4 — Editorial Product Surface

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable/UI
**Workspace:** `/home/hamza/repo/x_test-w6-editorial-surface`
**Isolation reason:** owns the final web/bridge/React Phase-6 surface while Agent B4 owns only the AI CLI adapter
**Can start:** immediately
**Depends on:** integrated main through `ce1b062` + `1b93542`
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md` — authoritative Phase-6 Tasks 12-14, plus the remaining UI exposure required by Task 15.
- `docs/agent-plans/2026-08-20-ai-editorial-wave-4/README.md` — current ownership and integration boundaries.
- `docs/PRODUCT_ARCHITECTURE.md` — product authority and source/workflow/history semantics.
- Current `web_api.js`, `agent_bridge.js`, `ui/src/api/client.ts`, Today/Discover/Results/Improve surfaces — actual integration conventions.

## Objective

Complete the operator-facing Phase-6 product loop on top of the already-landed backend contracts. A user should be able to open Today, understand the current Editorial Plan and its evidence, explicitly refresh it, select/dismiss/research a recommendation, see Discover remain source truth rather than a competing planner, and inspect real editorial outcome summaries when observations exist.

## Current state

The backend already owns and persists:

- canonical source snapshots/refresh/momentum via `source_refresh.js` + store helpers;
- current Editorial Plans via `refreshEditorialPlan()` and `getLatestEditorialPlan()`;
- explicit selection/dismissal through `selectEditorialRecommendation()` / `dismissEditorialRecommendation()`;
- controlled manual research attachment through `attachEditorialResearchSource()`;
- writer evidence/ProfileProof after selection;
- publication-time recommendation/selection/final-route provenance;
- `getEditorialOutcomeSummary()` returning `null` when no real editorial measurement exists.

`web_api.js` still contains legacy discover snapshot/refresh ownership that predates `source_refresh.js`; this mission should leave one source owner rather than two.

## Ownership

You own:

- `web_api.js` for Phase-6 Editorial/Discover/outcome endpoints and removal/delegation of legacy source snapshot/refresh ownership;
- `agent_bridge.js` for Editorial read/refresh/select/dismiss/add-source commands with no new authority;
- `ui/src/api/client.ts` for the required Phase-6 types/hooks/mutations;
- `ui/src/features/today/Today.tsx` for the primary Editorial Plan decision surface;
- `ui/src/features/discover/Discover.tsx` for live-source context + editorial-plan badges without competing recommendation semantics;
- `ui/src/features/results/Results.tsx` and/or `ui/src/features/improve/Improve.tsx` only as needed to expose real non-null editorial outcome summaries under the existing Performance/Experiments product model.

Neighboring work owns:

- `store.js`, `editorial.js`, `research.js`, `pipeline.js`, `drafting.js`, `writer_runtime.js`, `automation.js` domain behavior;
- AI runtime/provider/CLI behavior;
- final repository documentation after Wave 4 integration.

## Coordination contract

Use existing domain functions directly; do not recreate their logic in HTTP/UI code.

Required backend reads/actions include the landed equivalents of:

- latest plan by objective;
- explicit plan refresh with optional `refreshSources`;
- recommendation detail;
- explicit select / dismiss;
- Add Research Source with recommendation ID + URL + claim;
- canonical source snapshots and source momentum;
- editorial outcome summary only when real observations exist.

`web_api.js` must delegate current source refresh/read behavior to `source_refresh.js` / store helpers. Preserve legacy request aliases where needed for current clients, but do not persist or load a second `discover_snapshot:*` truth in the HTTP layer.

Selection remains an explicit human routing action. An HTTP/bridge selection endpoint must not approve, schedule, publish, send a reply, complete a repost, change health state, or accept learned rules as a side effect.

Preserve backend recommendation ordering exactly. Do not sort/re-rank Editorial recommendations in React.

## Success conditions

- Today reads the latest plan without automatically triggering expensive refresh/model work on page load.
- Today exposes the five objective modes with `qualified_growth` as the default operator goal.
- An explicit **Refresh sources & recommendations** action can refresh the plan and shows per-source freshness/partial errors when present.
- **AI Editorial Plan** appears above the existing concrete workflow attention items.
- Each recommendation shows the decision/format, thesis, why-now/why-format, four opportunity dimensions, Authority, objective fit, ProfileProof/evidence state, desired reader outcome, and AI execution provenance where available.
- **Why this recommendation?** exposes source list, algorithm evidence, learned/empirical context, risks, alternatives, and evidence detail without presenting internal values as an X/Phoenix score.
- Contextual CTA semantics match the source plan: Draft this for Original/Quote/Thread; Open conversation for Reply; Prepare repost for Repost; Open research + Add source for RESEARCH_MORE; Dismiss for SKIP/no action.
- RESEARCH_MORE visibly says manual/external research is required and shows unresolved questions.
- A successful empty plan is shown as a valid **No strong main-feed post right now** state rather than an error.
- Discover relabels the pre-Phase-6 route as **Rule-based route**, shows **In today's plan** / research context when applicable, and shows source-native movement/observation interval when available.
- Discover source controls remain independent of the Editorial Plan and handled live sources do not masquerade as unresolved recommendations.
- Source tabs read canonical snapshots and no longer depend on HTTP-layer duplicate snapshot persistence.
- Web and bridge callers expose the same Editorial inspect/refresh/select/dismiss/add-source semantics through domain functions; no raw table writes are exposed.
- When `getEditorialOutcomeSummary()` is non-null, the relevant Results/Improve surface shows actual sample size, recommended/selected/final format distinction, attribution-confidence/confounder context, and non-causal interpretation. When it is `null`, do not fabricate an empty effectiveness report.
- Existing AI Settings endpoints/UI and existing workflow surfaces remain functional and are not absorbed/reimplemented.

## Required validation

None mandated by the source plans. Do not create or run tests. Use the smallest bounded syntax/type/production-build/direct API-shape checks necessary to establish this mission, and inspect the final diff once.

## Out of scope

- Changes to source/editorial/store/writer/pipeline/measurement domain ownership.
- Optional AGY/OpenCode runtime implementation.
- Final README/architecture/current-state documentation.
- Live X writes or provider/model inference during validation.

## Working style

Explore the integrated code before deciding exact endpoint names or component factoring. Preserve current API/UI conventions. Make the smallest coherent product-surface changes that expose the already-landed domain contracts. Do not duplicate source truth, scoring, evidence validation, routing, or outcome formulas in UI/HTTP code.

Do not create, modify, or run tests. Do not create another worktree.

## Finish report

Return:
1. status: complete / blocked / needs decision;
2. branch/workspace and commit hash;
3. Editorial web endpoints + bridge commands delivered;
4. Today and Discover behavior delivered;
5. source-refresh/snapshot legacy ownership removed or delegated;
6. editorial outcome visibility behavior;
7. exact authority/side-effect semantics of select/research actions;
8. bounded non-test validation actually performed;
9. anything final documentation/integration needs to know;
10. unresolved risks/deviations.
