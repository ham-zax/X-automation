# Agent A3 — Editorial Selection + Writer Evidence

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable
**Workspace:** `/home/hamza/repo/x_test-w6-editorial-selection`
**Isolation reason:** concurrent Wave-3 work; this mission owns workflow/writer/web-generation files while Agent B3 owns store/automation outcome files
**Can start:** immediately from Wave-3 coordination base
**Depends on:** integrated Wave-2 Phase-6 persistence/backend and shared AI runtime
**Execution lifetime:** ordinary
**Wake strategy:** none
**Developer visibility:** headless

## Read first

- `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md` — Tasks 10-11 and their authority/evidence contracts
- `docs/agent-plans/2026-08-20-ai-editorial-wave-3/README.md` — ownership/dependency map
- `docs/PRODUCT_ARCHITECTURE.md` — human authority and evidence boundaries
- `docs/POST_GENERATION_PROMPT.md` — canonical writer contract

## Objective

Complete the causal path from a human-selected persisted editorial recommendation into the existing workflow, then ensure drafts produced through the normal web writer path receive the exact persisted research evidence and ProfileProof packet associated with that recommendation. Selection must remain distinct from approval/publication.

## Current state

Wave 2 already provides persisted recommendations/evidence, `queue_sources`, append-only `editorial_selections`, `ensureEditorialCandidate()`, strict published-only profile proof, `attachEditorialResearchSource()`, and a completed `refreshEditorialPlan()` backend. The writer now runs through `runStructuredAI()` but ordinary generation still builds packets without persisted Phase-6 evidence.

## Ownership

You own:
- `selectEditorialRecommendation()` / dismiss semantics in the editorial/workflow domain;
- routing selected Original/Quote/Thread/Reply/Repost/Research More through existing queue/pipeline contracts without approval;
- recommendation-specific synthetic candidate use and queue-source linking where required;
- persisted evidence/ProfileProof loading for selected editorial work;
- writer packet evidence-ID semantics and normal `web_api.js:generateDraftCandidate()` integration;
- persisted evidence references remain inspectable writer context.

Neighboring Agent B3 owns:
- `store.js` changes for measurement/editorial outcome metadata;
- `automation.js` optional background-plan refresh;
- bounded learning-context changes only if required.

Final-wave work owns:
- general Editorial Plan web/agent endpoints;
- Today/Discover editorial UI and client types/actions;
- final current-state documentation.

## Coordination contract

Do not modify `store.js`, `automation.js`, `learning.js`, React UI, or `agent_bridge.js`. Consume B2's existing store helpers. You may modify `web_api.js` only to make the existing normal writer-generation path load/use selected editorial evidence and profile proof; do not add the final Phase-6 HTTP surface in this mission.

Preserve existing manual/non-editorial draft behavior. A human route override must be recorded as selected pipeline without rewriting the AI recommendation. Re-selection of the same recommendation must be idempotent through existing selection persistence.

## Success conditions

- A suggested `PREPARE` recommendation can be explicitly selected by a human into Original/Quote/Thread/Reply/Repost with the existing workflow semantics and no approval side effect.
- Quote/Reply/Repost require a still-routable real X target; multi-source Original/Thread uses only `editorial:<recommendationId>` when the plan requires synthetic identity and links all real sources.
- `RESEARCH_MORE` enters the existing research workflow with its unresolved questions/evidence relationship preserved and creates no publication text.
- One append-only `editorial_selection` links recommendation, queue item, selected pipeline, and timestamp; the recommendation becomes `selected` without rewriting its recommended pipeline.
- Normal web writer generation for editorial-selected work supplies persisted evidence records with stable IDs, claim type/status/source family/provenance plus the exact persisted recommendation ProfileProof packet.
- Manually routed/non-editorial drafts keep current behavior while receiving strict published-only ProfileProof where applicable.
- `writer_runtime` output may carry supplied evidence IDs as inspectable context.
- linked evidence rows retain their persisted claim scope and provenance.
- Existing approval, scheduler, publication, reply-send, repost-completion, health, and learned-rule authority is unchanged.

## Required validation

No tests. Use only minimal non-test syntax/direct behavior checks needed to establish selection semantics, writer-packet evidence resolution, and unchanged authority boundaries. No live X writes.

## Out of scope

- `store.js` schema/helper changes unless a demonstrated missing primitive makes the mission impossible; report that blocker instead of silently crossing ownership.
- Today/Discover UI or general editorial API/bridge commands.
- Phase-4/5 outcome summaries.
- source refresh/research fetching changes.
- optional AI runtime adapters.

## Working style

Use @Causal Coding before mutation. Inspect the current integrated code and reuse B2 store helpers rather than inventing parallel persistence. Keep the shortest request -> owner -> change -> direct evidence path. Do not create, modify, or run tests.

## Finish report

Return:
1. status: complete / blocked / needs decision;
2. workspace/branch and commit hash;
3. selection/routing interfaces and exact human-authority semantics;
4. writer evidence/ProfileProof interfaces and evidence-ID validation semantics;
5. changes to the existing normal web generation path;
6. non-test validation actually run;
7. anything the final API/UI session must know;
8. unresolved risks/deviations.
