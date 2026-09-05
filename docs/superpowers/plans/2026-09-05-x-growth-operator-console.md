# X Growth Operator Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved semantic operator-console visual system across the existing X Growth React workspace without changing Growth OS behavior.

**Architecture:** Introduce semantic presentation primitives and CSS variables, then migrate the high-traffic screens to consume those primitives. Preserve existing data hooks, route semantics, mutations, approval boundaries, and view models. Add only presentation-derived helpers where they improve deterministic rendering and testability.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 utilities, Vite, Node test runner + React SSR tests.

**Spec:** `docs/superpowers/specs/2026-09-05-x-growth-operator-console-design.md`

## Global Constraints

- Do not change Growth OS decision semantics, persona logic, approvals, browser claims, publication/reconciliation, scheduler behavior, or autonomous-reply behavior.
- Indigo = primary/selection; cyan = information; emerald = ready/success; amber = attention; red = real failure/destructive; violet = AI-derived; slate = neutral.
- Theme parity is required for light and dark modes.
- Preserve the six-route top navigation.
- Maintain the existing master/detail Discover architecture and Posts lifecycle grouping.
- New shared presentation behavior must be covered by tests before implementation.

---

### Task 1: Semantic presentation primitives

**Files:**
- Modify: `ui/src/components/primitives.tsx`
- Modify: `ui/src/components/workspace.tsx`
- Modify: `ui/src/index.css`
- Test: `ui/tests/workspace-ui.test.mjs`

**Interfaces:**
- Produces `ActionButton`, `Notice`, tone-aware `Badge`, tone-aware `SegmentedTabs`, and tone-aware `MetricCard`.
- Later tasks consume only these presentation interfaces; business/data hooks remain unchanged.

- [ ] Write failing SSR tests asserting semantic classes/tone data for badge, action, notice, segmented tabs, and metric cards.
- [ ] Run `node --test tests/workspace-ui.test.mjs` from `ui` and confirm failures are due to missing semantic interfaces/classes.
- [ ] Implement semantic component interfaces and CSS variables/classes for light/dark themes.
- [ ] Re-run the focused test until green.

### Task 2: Shell, navigation, and responsive affordances

**Files:**
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/components/workspace.tsx`
- Modify: `ui/src/index.css`
- Test: `ui/tests/workspace-ui.test.mjs`

**Interfaces:**
- `WorkspaceNav` remains `({ active: string }) => JSX.Element`.
- Shell routing and theme persistence remain unchanged.

- [ ] Add a failing test for route-specific semantic current-state class/marker.
- [ ] Run the focused test and confirm expected failure.
- [ ] Implement stronger shell/nav theme, current-route indigo marker, mobile scroll fades, and utility control styling.
- [ ] Re-run focused tests.

### Task 3: Today operator desk hierarchy

**Files:**
- Modify: `ui/src/features/today/Today.tsx`
- Modify: `ui/src/index.css`

**Interfaces:**
- Existing Today data hooks and mutations unchanged.
- Recommendation decision/pipeline values only determine presentation tone and CTA style.

- [ ] Add any required pure presentation-tone helper to `workspace.tsx` and test it first if logic is nontrivial.
- [ ] Migrate attention cards, growth pulse, editorial selected/research/skip treatments, and CTAs to semantic primitives.
- [ ] Run `npm run test:ui` and `npm run build` from `ui`.

### Task 4: Discover triage ergonomics

**Files:**
- Modify: `ui/src/features/discover/Discover.tsx`
- Modify: `ui/src/index.css`
- Test: `ui/tests/discover-view.test.mjs` only if presentation-derived helper logic is added.

**Interfaces:**
- Existing selection/view-model helpers remain authoritative.
- No source routing or action mutation behavior changes.

- [ ] Add a failing test first for any new deterministic tone/selection helper.
- [ ] Implement indigo selected row, sticky desktop detail, tighter candidate rows, semantic notices/actions, clearer tab/filter treatment, and one-column mobile selected-detail flow.
- [ ] Run Discover-focused tests then full UI tests/build.

### Task 5: Relationship queue polish

**Files:**
- Modify: `ui/src/features/conversations/Conversations.tsx`
- Modify: `ui/src/features/conversations/ConversationDetail.tsx` only for presentation consistency already touched by the existing repair.
- Modify: `ui/src/index.css`

**Interfaces:**
- Conversation data, reply decisions, and autonomous mode semantics unchanged.

- [ ] Migrate runtime strip and advisory notice to semantic primitives.
- [ ] Give active conversation a relationship-focused accent and reduce low-priority opportunity badge noise.
- [ ] Make review-needed/dry-run/skipped states visually distinct without changing their text or logic.
- [ ] Run full UI tests/build.

### Task 6: Publishing lifecycle semantics

**Files:**
- Modify: `ui/src/features/create/Create.tsx`
- Modify: `ui/src/features/create/DraftPage.tsx` and `ui/src/features/create/DraftEditor.tsx` only for shared visual primitive adoption.
- Modify: `ui/src/features/create/createView.ts`
- Modify: `ui/src/index.css`
- Test: `ui/tests/create-view.test.mjs`

**Interfaces:**
- `buildPostViews(sections)` remains the lifecycle authority for view membership/counts.
- Extend view metadata with presentation-only `tone` if useful; status membership must not change.

- [ ] Write failing test for lifecycle tone metadata.
- [ ] Run focused test and confirm expected failure.
- [ ] Add presentation tone metadata only.
- [ ] Apply colored lifecycle tabs, sticky lifecycle context, state rails, semantic gate/action styles, and real failure red.
- [ ] Run focused and full tests/build.

### Task 7: Results evidence hierarchy

**Files:**
- Modify: `ui/src/features/results/Results.tsx`
- Modify: `ui/src/features/results/resultsView.ts` only if additional deterministic presentation metadata is required.
- Modify: `ui/src/index.css`
- Test: `ui/tests/results-view.test.mjs`

**Interfaces:**
- Existing constraint inference remains unchanged.
- Presentation uses current health/constraint data only.

- [ ] Add a failing presentation test only if a helper is added.
- [ ] Migrate brief/health/metrics to semantic notice and metric primitives.
- [ ] Keep measured publication surfaces neutral and reserve violet for AI-derived experiment interpretation.
- [ ] Run focused and full tests/build.

### Task 8: Final product verification and commit

**Files:**
- Verify all modified UI and plan files.

- [ ] Run `npm run test:ui` in `ui`.
- [ ] Run `npm run build` in `ui`.
- [ ] Run `npm run lint` in `ui`; require 0 errors and identify whether warnings pre-existed/outside this pass.
- [ ] Run root `npm run ui:build`.
- [ ] Run `git diff --check`.
- [ ] Visually inspect Today, Discover, Conversations, Posts, Results on desktop; Today, Discover, Posts, Results at mobile width; and one representative dark-mode screen.
- [ ] Review `git diff -- ui docs/superpowers/...` for accidental business-logic changes.
- [ ] Stage the operator-console UI files and implementation plan only; do not stage unrelated backend repair files.
- [ ] Commit with `feat(ui): overhaul X Growth operator console`.

### Task 9: Progressive-disclosure minimalism refinement

**Files:**
- Modify: `ui/src/features/create/GrowthFitPanel.tsx`
- Modify: `ui/src/features/today/Today.tsx`
- Modify: `ui/src/features/discover/Discover.tsx`
- Modify: `ui/src/features/conversations/Conversations.tsx`
- Modify: `ui/src/features/create/Create.tsx`
- Modify: `ui/src/features/results/Results.tsx`
- Modify: `ui/src/index.css`

**Interfaces:**
- Data hooks and action semantics remain unchanged.
- Existing `Disclosure` is the progressive-disclosure boundary; no evidence is removed from the model.

- [ ] Compact Growth Fit into a one-line status with explanation/configuration behind details, preserving required override controls.
- [ ] Reduce Today recommendations to title, thesis, key fit, and next action; move why-now, format, full scores, reader outcome, and provenance into disclosure.
- [ ] Reduce Discover detail to source summary, growth-fit state, route warning, and actions; move classification/source-momentum evidence behind disclosure.
- [ ] Make new conversation opportunities compact and collapse autonomous-decision history by default.
- [ ] Add compact queue rendering for published/source-history views and keep workflow evidence behind details for active post cards.
- [ ] Collapse writing/editorial cohort analytics by default on Results.
- [ ] Re-run UI tests/build and visual checks before final commit.
