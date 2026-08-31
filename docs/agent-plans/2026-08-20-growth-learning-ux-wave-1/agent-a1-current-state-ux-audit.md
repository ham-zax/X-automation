# Agent A1 — Current-State UX Forensic Audit

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** documentation/research
**Workspace:** `/home/hamza/repo/x_test-w7-ux-audit`
**Branch:** `agent/w7-ux-audit`
**Isolation reason:** concurrent documentation writer; this mission owns the current-state audit/walkthrough artifacts while Agent B1 owns task/journey/IA research artifacts
**Can start:** immediately
**Depends on:** authoritative plan `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md` at source base `01cc68f`; inspect the current product baseline at `d99ed94` or later compatible main state
**Execution lifetime:** ordinary

## Read first

- `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md` — authoritative UX/product purpose, research sequence, learning architecture, and implementation constraints.
- `docs/agent-plans/2026-08-20-growth-learning-ux-wave-1/README.md` — ownership, coordination, integration, and safety contracts.
- `ui/src/App.tsx` and current React route components — actual current product, not the older server-rendered UX architecture.
- `ui/src/components/primitives.tsx` — current shared loading/error/disclosure/gate/status vocabulary.
- Existing `docs/ux/CURRENT_STATE_AUDIT.md`, `docs/ux/HUMAN_AI_INTERACTION.md`, and `docs/ux/PRODUCT_LANGUAGE.md` as background only; do not modify them.

## Mission

Produce a forensic current-state UX baseline from the actual React product so later IA and implementation decisions are tied to demonstrated interface behavior rather than aesthetic preference.

The core question is:

> Where does the current product force an ordinary operator or stakeholder to understand product architecture, remember hidden state, or mispredict the consequence of an action?

## Owned artifacts

Create only:

- `docs/ux/CURRENT_STATE_IA.md`
- `docs/ux/ACTION_INVENTORY.md`
- `docs/ux/BASELINE_HEURISTIC_REVIEW.md`
- `docs/ux/COGNITIVE_WALKTHROUGHS.md`

Do not modify React, backend code, APIs, persistence, prompts, tests, existing UX docs, or Agent B1-owned artifacts.

## Required coverage

### Current-state IA

Inventory the actual React destinations and meaningful subroutes, including at minimum:

- Today;
- Discover;
- Viral Styles;
- Conversations and conversation detail;
- Posts/Create and draft review;
- Performance/Results and Audience;
- Experiments/Improve;
- Diagnostics/Advanced and AI Settings.

For each, record:

- user-visible purpose currently communicated;
- principal information objects;
- principal actions;
- likely user goal represented;
- whether the destination is a goal, work object, analysis method, or system/advanced function;
- cross-links/dependencies a user must remember.

### Action inventory

Inventory consequential and workflow-significant actions. For each action record the current label, location, authoritative effect, reversibility, and what an ordinary user could reasonably misinterpret.

Give extra attention to distinctions among:

- recommendation;
- selection/routing;
- draft generation/editing;
- approval controls;
- approval;
- scheduling;
- publishing/sending;
- dismiss/ignore/watch/save;
- Viral research Run/Stop;
- learned-rule/test actions;
- AI settings changes.

### Heuristic review

Use Nielsen's heuristics as the evaluation frame, weighted toward:

- visibility of system status;
- real-world/plain language;
- user control/freedom;
- error prevention;
- recognition vs recall;
- consistency;
- minimalist information density;
- error diagnosis/recovery;
- contextual help;
- flexibility for advanced users without burdening ordinary users.

Rank issues P0-P3 using the authoritative plan's severity semantics. State each P0/P1 as an observable user failure, not “this looks cluttered.”

### Cognitive walkthroughs

Walk the current interface, from a first-time/non-expert perspective, through these six tasks:

1. Determine what needs attention today and take the correct next step.
2. Understand and act on an Editorial recommendation without confusing recommendation, selection, or approval.
3. Review a draft, understand blockers, approve it, and understand what scheduling/publication action will do.
4. Continue a conversation and understand whether an action sends a reply or only prepares one.
5. Encounter a blocked/failed state and determine what failed, whether anything changed, and how to recover safely.
6. From learning/research context, determine what style/intent appears to work and how a future optional `Off / Suggest / Apply` strategy choice should fit before draft generation. For this sixth flow, evaluate the *current gap* only; do not invent UI that is not yet implemented.

For every meaningful step use the four questions from the source plan:

- Will the user know the goal here?
- Will they notice the correct action?
- Will they understand that action leads toward the goal?
- After acting, will they understand what happened and what comes next?

## Evidence discipline

Distinguish explicitly between:

- **repository-observed** behavior/labels/states;
- **inference** about likely novice failure;
- **research question** that needs actual user evidence.

Do not state that users prefer a label, navigation structure, or workflow unless there is actual participant evidence in the repository.

Do not turn internal values or X-algorithm evidence into unsupported causal claims.

## Success conditions

- Every current top-level React destination and major subroute has an explicit IA entry.
- Every user-significant action that can alter workflow, send/publish state, research state, learning state, or AI configuration has an inventory entry with its actual consequence.
- Recommendation, selection, approval, scheduling, publishing, and sending are analyzed as distinct states/actions.
- At least the six specified walkthroughs are complete and grounded in current UI/code.
- P0/P1 heuristic issues describe concrete task/comprehension/recovery failures.
- The audit identifies which complexity should remain advanced rather than simply recommending removal of capability.
- Unknowns are recorded as research questions rather than fabricated findings.

## Required validation

None. Do not create or run tests. Inspect the four produced documents and the final diff once.

## Out of scope

- Redesigning or editing the React UI.
- Choosing the final IA by preference.
- Conducting or fabricating participant interviews/usability sessions.
- Creating new product behavior, APIs, persistence, metrics, AI prompts, or learned-strategy logic.
- Editing Agent B1-owned files.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. branch/workspace and commit hash;
3. four artifacts created;
4. highest-severity current UX failures;
5. the six walkthrough outcomes;
6. key questions that require real user evidence;
7. deviations/conflicts, if any;
8. validation performed — normally documentation/diff inspection only.
