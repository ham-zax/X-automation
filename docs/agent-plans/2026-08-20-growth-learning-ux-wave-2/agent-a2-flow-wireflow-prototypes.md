# Agent A2 — Task/User Flows + Low-Fidelity Wireflows

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** documentation/prototype
**Workspace:** `/home/hamza/repo/x_test-w7-ux-audit`
**Branch:** `agent/w7-ux-wireflows`
**Isolation reason:** concurrent documentation writer; this mission owns only flow/wireflow artifacts while Agent B2 owns language/Human-AI artifacts
**Can start:** immediately
**Depends on:** integrated Wave-1 evidence + `docs/ux/WAVE1_SYNTHESIS.md`
**Execution lifetime:** ordinary

## Read first

- `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md` — authoritative product purpose, research sequence, and implementation constraints.
- `docs/ux/WAVE1_SYNTHESIS.md` — frozen interaction contracts and unresolved hypotheses.
- `docs/ux/CURRENT_STATE_IA.md`
- `docs/ux/ACTION_INVENTORY.md`
- `docs/ux/BASELINE_HEURISTIC_REVIEW.md`
- `docs/ux/COGNITIVE_WALKTHROUGHS.md`
- `docs/ux/TASK_ANALYSIS.md`
- `docs/ux/JOBS_TO_BE_DONE.md`
- `docs/ux/JOURNEY_MAPS.md`
- `docs/ux/SERVICE_BLUEPRINT.md`
- `docs/ux/IA_RESEARCH.md`
- current React routes/components only as needed to keep the prototype grounded in real product capability.

## Mission

Turn Wave-1 findings into a testable low-fidelity interaction model without choosing a final production IA by preference.

The output should let an evaluator walk through the important operator/stakeholder jobs, see decision/recovery branches, and compare the H1/H2 navigation hypotheses where routing differs. It should make the frozen authority/consequence/lifecycle/evidence semantics visible before any React implementation begins.

## Ownership

You own only:

- `docs/ux/TASK_FLOWS.md`
- `docs/ux/USER_FLOWS.md`
- `docs/ux/WIREFLOWS.md`

You may inspect but must not modify:

- React/backend/API/persistence/prompt code;
- `docs/ux/PRODUCT_LANGUAGE.md`;
- `docs/ux/HUMAN_AI_INTERACTION.md`;
- `docs/ux/STATUS_LANGUAGE.md`;
- Wave-1 evidence artifacts.

Do not create another worktree.

## Coordination contract

Preserve these frozen Wave-1 semantics:

- recommendation -> human selection -> draft/review -> human approval -> schedule/wait -> publish/send -> result remain distinct;
- action consequence is visible before activation;
- lifecycle state must be recognizable without module-memory burden;
- partial-success/error recovery distinguishes remote action uncertainty, current authoritative state, retry safety, and next step;
- external/internal/experiment evidence remain separate;
- strategy behavior supports canonical `off|suggest|apply` semantics, but user-facing labels remain provisional;
- default strategic purpose is qualified growth velocity.

Do not resolve final IA/terminology unless repository authority requires a fixed system term. When navigation materially changes the flow, preserve H1 and H2 variants or annotate the difference explicitly.

## Required flow coverage

### `TASK_FLOWS.md`

Create goal-level Mermaid task flows for at least these jobs:

1. **Daily orientation** — identify real open obligations versus advisory opportunities; take one next action.
2. **Editorial recommendation** — understand recommendation, choose/override content type, select or dismiss, then enter draft work without implying approval/publication.
3. **Post lifecycle** — draft -> checks/blockers -> human confirmations -> approval -> timing -> waiting/scheduled -> publishing -> published/failed.
4. **Conversation lifecycle** — choose opportunity/conversation -> generate/edit -> approve -> explicit send -> sent result.
5. **Exceptional recovery** — deterministic blocker, safe retryable failure, remote-success/local-reconciliation uncertainty; every branch terminates in recovery, explicit wait, or escalation.
6. **Historical Viral research** — scope -> depth/advanced options -> run -> checkpoint progress -> patterns/evidence -> limitations.
7. **Learning comparison** — external niche evidence vs internal account evidence vs explicit tests without blending provenance.
8. **Writing strategy** — inspect recommendation/evidence -> choose no influence/advice only/deliberate use -> Original/Thread/Quote/Reply generation -> review/change/remove -> normal approval flow; Repost not applicable.

For each flow, separate repository-observed current capability from proposed prototype behavior.

### `USER_FLOWS.md`

Map route/surface-level movement for the same core jobs.

Requirements:

- include current C0 route mapping as baseline where useful;
- represent H1 and H2 when a navigation choice changes where users would go;
- show cross-session re-entry for scheduled publication, background Viral research, measurement windows, and later learning;
- show what surface owns the authoritative action versus where a summary/link may appear;
- avoid inventing backend actions that do not exist.

### `WIREFLOWS.md`

Create connected low-fidelity desktop and phone wireflows for:

- Today;
- Discover;
- Conversations + conversation detail;
- Posts + draft review/lifecycle;
- Results;
- Learn / Viral research / evidence comparison / strategy recommendation.

The wireflows must specifically make the Wave-1 P1 defects testable:

- distinguish `Needs your attention` obligations from advisory Editorial Plan opportunities;
- give Draft-related controls consequences that match what they actually do;
- make the post lifecycle visible across review/schedule/publication handoffs;
- show an explicit safe recovery model for partial-success/failed transport states;
- simplify default Viral research while retaining Advanced access;
- show external/internal/test evidence provenance;
- place future strategy selection in a way that allows user research to determine whether Learn, Draft, or both are the correct locations.

Use plain boxes/text/Mermaid/ASCII as appropriate. Do not spend effort on visual polish, colors, component libraries, or pixel specifications.

## Observable success conditions

- All eight required task flows exist and terminate in success, recovery, explicit wait, escalation, or exit.
- Consequential actions state their immediate effect before the user activates them.
- No flow implies that selection is approval or that approval is publication/send.
- Current product capability and proposed behavior are visually/textually distinguishable.
- H1/H2 differences remain testable rather than being silently collapsed into one preferred IA.
- Desktop and phone wireflows cover all six proposed user-goal areas without requiring technical runtime/scorer knowledge.
- The exceptional-recovery prototype covers the exact Wave-1 remote/local divergence problem without inventing unsafe resend semantics.
- Learn-related wireflows keep external, internal, and experiment evidence distinguishable.
- The strategy flow makes canonical behavior semantics explicit while leaving exact user-facing labels open for research.
- No product source, APIs, persistence, prompts, or tests are changed.

## Required validation

None mandated. Do not create, modify, or run tests or application builds.

Inspect the three owned artifacts and the final owned-file diff once. Documentation diff hygiene is sufficient if you choose to run it.

## Out of scope

- Final IA selection.
- Participant findings.
- Production React/UI implementation.
- Backend recovery implementation.
- Strategy synthesis/persistence/Writer changes.
- Outcome/revenue persistence.
- Visual high-fidelity design.

## Working style

Use @Causal Coding and @Ponytail before mutation. Reuse Wave-1 evidence rather than re-auditing the repository broadly. Prefer the smallest number of flows that fully covers the required jobs; do not create speculative screens or abstractions for hypothetical future features.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. branch/workspace and commit hash;
3. three artifacts created;
4. flow coverage summary;
5. how H1/H2 remain testable;
6. how the wireflows repair each Wave-1 P1 defect at prototype level;
7. strategy Off/Suggest/Apply semantic treatment and placement hypotheses;
8. unresolved questions that still require real participants;
9. deviations/conflicts, if any;
10. validation performed (state explicitly that no tests/builds were run).
