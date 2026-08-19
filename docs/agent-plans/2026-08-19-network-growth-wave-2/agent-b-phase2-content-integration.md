# Agent B — Phase 2 Content Integration

**Repository:** `/home/hamza/repo/x_test`  
**Artifact type:** executable/mixed  
**Workspace:** `/home/hamza/repo/x_test-w2-content-integration` on branch `agent/w2-phase2-content-integration`  
**Isolation reason:** concurrent writable mission; this branch owns the shared content persistence/workflow/UI/bridge surfaces while Agent A owns only `engagement.js`  
**Can start:** immediately after assigned worktree exists  
**Depends on:** integrated Phase 1A + Phase 1B + Content Core (`0784943`, with Content Core integrated as `fa1a6a1`)  
**Execution lifetime:** Persistent Agent Loop required  
**Wake strategy:** no artificial timer; event wait only for a real external/persistent blocker  
**Developer visibility:** headless by default

## Read first

- `docs/plans/PHASE_2_CONTENT_QUALITY.md` — authoritative Phase-2 requirements.
- `docs/POST_GENERATION_PROMPT.md` — canonical writer/editor contract; reconcile its media vocabulary with the Phase-2 enum before bridge exposure.
- `docs/agent-plans/2026-08-19-network-growth-wave-2/README.md` — parallel ownership boundary.
- `AGENTS.md` and `docs/AGENT_WORKFLOW.md` — current Phase-1A/1B workflow and human approval boundary.
- `drafting.js` — already-integrated Content Core; use its public interfaces rather than reimplementing them.
- `store.js`, `pipeline.js`, `agent_bridge.js`, `dashboard.js`, `relationship.js` — current integration surfaces and relationship reads.

Before source mutation, use **Causal Coding**. Use **Persistent Agent Loop** for execution lifetime. Do not create or run tests unless independently mandated by repository rules; current plans do not authorize tests.

## Objective

Complete the Phase-2 integration around the already-landed content-quality core: persist thread/editor/gate metadata, expose writer-packet/structured-output bridge commands, make workflow review/approval gate-aware with explicit human factuality/evidence confirmation, provide format-aware review UI including thread/media-plan state, and synchronize current operating documentation.

Keep the existing Phase-1 human approval boundary intact. Do not absorb Engage Next, Account Health, scheduler, media upload, experiments, or publishing transport work.

## Ownership

You own:

- `store.js` Phase-2 draft metadata persistence and recent-content queries;
- `pipeline.js` routed-pipeline scaffold/review/gate/approval integration;
- `agent_bridge.js` writer-packet and structured writer-output interfaces;
- `dashboard.js` format-aware draft/review/gate/media-plan UI;
- `drafting.js` only if integration exposes a concrete defect in the already-integrated Content Core;
- `docs/POST_GENERATION_PROMPT.md` media-vocabulary normalization and Phase-2 operating-doc synchronization;
- relevant README/AGENTS/Agent Workflow/master-plan wording after behavior exists;
- focused non-test verification.

Neighboring Agent A owns only new `engagement.js` and must remain collision-free.

## Coordination contract

- Do not create or modify `engagement.js`, `tech_news.js`, `automation.js`, or X transport/publisher files.
- Preserve `relationship.js` and Phase-1B persistence as read-only inputs; do not change relationship scoring/stage semantics.
- Preserve `opportunity.js` ownership of four-dimensional candidate scores.
- `pipeline.js` remains the only workflow/human-approval mutator. No bridge command may self-approve.
- `drafting.js` remains the content composition/writer/gate owner; call its integrated `buildWriterPacket`, `applyWriterOutput`, `evaluateDraftGates`, and gate-aware `scoreDraft` rather than duplicating formulas in UI/bridge/workflow code.
- Do not add an LLM provider/SDK.
- Do not upload media or fake media readiness. Required media must remain blocked until Phase 3 provides attachment readiness.
- Normalize the prompt/editor media vocabulary to the authoritative persisted enum: `none | screenshot | chart | code | diagram`. Prefer updating prompt/document output names over adding unused alias machinery.
- Editing approved content must continue to invalidate approval and return to draft/review state.

## Required behavior

### Draft persistence

Implement idempotent SQLite migration and save/decode support for:

- `thread_parts_json` default `[]`;
- `editor_json` default `{}`;
- `gate_json` default `{}`.

Existing drafts must remain readable. Add the narrow recent approved/published main-feed/reply text queries needed by duplicate/gate context.

### Routed scaffolds and writer bridge

- Routed `original|quote|thread|reply` draft creation must pass the actual queue pipeline into `createDraftScaffold`.
- Add `writer-packet { key }` returning candidate/workflow, relationship context when available, current draft, recent content, and `docs/POST_GENERATION_PROMPT.md` path through `buildWriterPacket`.
- Add `apply-writer-output { id, output }` using `applyWriterOutput`, persisting editor/thread text without requesting review or approval automatically.
- Enforce queue-route/writer-output pipeline consistency; route changes go through existing workflow commands.
- `DO_NOT_POST` preserves history and returns an explicit recommendation rather than deleting evidence/state.

### Gate-aware review and approval

- `requestQueueReview` recomputes/saves gate output for the latest content and may enter `needs_review` even when gates fail so the human can inspect failures.
- Human approval must recompute the latest gate result and require both numeric score >=40 and `gates.passed`.
- Require explicit human `factualityConfirmed`; require `evidenceConfirmed` where the gate engine determines evidence claims need confirmation.
- Preserve the compatibility behavior where only explicit human approval sets the associated text draft to `ready`.
- Required media remains a hard approval blocker until actual Phase-3 readiness exists.

### Dashboard review

Provide format-aware editing/review for Original, Quote, Reply, and Thread:

- selected pipeline visible;
- single final body preview/edit context for single-post formats;
- 2–6 explicit editable thread parts with add/remove-last controls;
- weighted character count per publishable unit;
- editor metadata: semantic anchors, evidence used, follow reason, risk flags, discussion question, media recommendation;
- gate pass/fail/warning display with readable failure messages;
- human factuality/evidence confirmation controls not prechecked by AI;
- approval absent/blocked when gates or score fail;
- media state clearly distinguishes none/recommended/required and required-but-not-ready.

### Media plan

Persist/use `editor.media` as the Phase-2 owner. UI/bridge may edit plan fields (`required`, `type`, `reason`, `source`, `altText`) but must not imply upload readiness.

### Documentation

After behavior exists, update current docs so they describe Phase 2 as implemented while Engage Next integration, Account Health, scheduler, media upload, experiments, and learning remain planned.

## Success conditions

- Existing draft rows survive migration; thread/editor/gate metadata round-trips.
- Writer packet can be obtained and structured writer output persisted without direct SQLite edits or publication authorization.
- A numeric 40+ draft cannot be approved when a hard gate fails.
- Human approval always evaluates the latest saved content and explicit confirmations.
- Agent bridge cannot approve or create compatibility `ready` directly.
- Thread review clearly shows exactly what will be published and respects per-part limits/gates.
- Required media cannot pass approval before Phase-3 readiness exists.
- Phase-1A Save/Triage/routing and Phase-1B Relationship Intelligence remain functional.
- Agent A's concurrent `engagement.js` work has no file collision.

## Verification intent

Use focused evidence only:

- isolated temporary-directory SQLite migration/round-trip smoke for old/new draft rows;
- bridge smoke for `writer-packet` and `apply-writer-output` without live X actions;
- isolated workflow smoke showing failing gates block approval and explicit passing confirmations allow approval when otherwise publishable;
- format/thread/media UI import/parse checks;
- `node --check` on changed JS and `git diff --check` near completion.

Do not create tests or run broad suites. Do not mutate live X state as verification.

## Out of scope

- `engagement.js` / Engage Next discovery/send workflow;
- target timeline fetching or reply detection;
- Account Health / Under the Hood;
- scheduler migration or publishing transport changes;
- actual media upload/readiness;
- experiments, follower conversion, learned strategy;
- unrelated cleanup/refactoring.

## Working style

Inspect current integrated code before choosing implementation details. Use the already-landed content core and current relationship read APIs. Make the smallest complete integration changes at their true owners. Status/progress/compatible steering does not terminate the mission; continue until success conditions are freshly verified or explicitly stopped/replaced.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commits;
3. schema/interface/UI behavior implemented;
4. checks actually run, results, and why relevant;
5. any changes/defects required in `drafting.js`;
6. media-vocabulary resolution used;
7. anything Phase-1C integration must know;
8. unresolved risks/deviations;
9. explicit confirmation that `engagement.js`, `tech_news.js`, `automation.js`, and publishing transport were not modified.
