# X Growth Operator UI/UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the existing X Growth React client into a faster operator workspace while preserving all Growth OS, approval, scheduler, autonomous-reply, publication, and browser-execution contracts.

**Architecture:** Keep all existing routes and API hooks. Add a small reusable workspace presentation layer plus pure view-model helpers for selection/lifecycle/brief derivation, then refactor each screen to change hierarchy and density without changing mutations or server semantics. Verify visual behavior against the live dashboard and preserve the pre-existing dirty repair surface.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4, TanStack Query, Node 24 built-in test runner, Vite SSR for component contract tests.

**Spec:** `docs/superpowers/specs/2026-09-05-x-growth-operator-ui.md`

> **Superseding integration note (2026-09-05):** A later explicit user instruction requested that the completed UI overhaul be committed. That later instruction supersedes the original no-commit constraint below for the UI surface only; unrelated backend repair work remains untouched.

## Global Constraints

- Work in `/home/hamza/repo/x_test` because the current dirty working tree is authoritative and contains uncommitted repair work the UI depends on.
- Do not reset, stash, clean, checkout, or rewrite existing non-UI changes.
- Do not commit in this mission; `ui/src/features/create/Create.tsx` already contains unrelated uncommitted contract copy that must remain intact.
- Do not change API response semantics or backend Growth OS behavior.
- Do not add external fonts or new runtime UI dependencies.
- Preserve light/dark themes, focus-visible behavior, and reduced-motion behavior.
- Use TDD for new reusable component contracts and pure view-model behavior; visual CSS/layout work is additionally verified by build/lint and live browser inspection.

---

### Task 1: UI contract test harness and reusable workspace primitives

**Files:**
- Create: `ui/tests/workspace-ui.test.mjs`
- Create: `ui/src/components/workspace.tsx`
- Modify: `ui/src/components/primitives.tsx`
- Modify: `ui/package.json`

**Interfaces:**
- Produces: `WorkspaceNav`, `PageHeader`, `SegmentedTabs`, `MetricCard`, `OperatorStrip`, and `SectionHeading` presentation components.
- Produces: `npm run test:ui`, using Node's test runner and Vite SSR; no new package dependency.

- [ ] **Step 1: Write the failing SSR contract test**

Create `ui/tests/workspace-ui.test.mjs` that starts Vite in middleware mode, loads `/src/components/workspace.tsx` with `ssrLoadModule`, renders components with `react-dom/server`, and asserts:

```js
assert.match(nav, /aria-current="page"/)
assert.match(nav, /Today/)
assert.match(nav, /Discover/)
assert.match(header, /Needs your attention/)
assert.match(tabs, /Attention/)
assert.match(tabs, /Published/)
```

The test must fail because `workspace.tsx` does not exist yet.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd ui && node --test tests/workspace-ui.test.mjs
```

Expected: FAIL because `/src/components/workspace.tsx` cannot be loaded.

- [ ] **Step 3: Implement the minimal workspace primitives**

Create `workspace.tsx` with data-driven navigation/tabs and simple semantic markup. Keep styling classes local to the component and use no new dependency. Reuse `Badge` only for true state signals.

- [ ] **Step 4: Add the UI test script**

Add:

```json
"test:ui": "node --test tests/*.test.mjs"
```

to `ui/package.json`.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd ui && npm run test:ui
```

Expected: PASS.

---

### Task 2: Operator shell and global visual system

**Files:**
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/index.css`
- Use: `ui/src/components/workspace.tsx`

**Interfaces:**
- Consumes: `WorkspaceNav`.
- Preserves: existing hash routes, theme storage key `x-growth-theme`, settings routing, and query provider.

- [ ] **Step 1: Extend the workspace contract test before shell integration**

Add assertions that `WorkspaceNav` renders all six destinations and exposes the active destination with `aria-current="page"`.

- [ ] **Step 2: Verify the new assertion fails if the component contract is incomplete**

Run `cd ui && npm run test:ui` and confirm the failure is tied to the missing contract rather than test setup.

- [ ] **Step 3: Refactor `App.tsx` to use `WorkspaceNav`**

Keep routing unchanged. Replace the current pill-heavy header markup with a tighter brand row plus scrollable/faded mobile nav. Keep theme and Settings utilities secondary.

- [ ] **Step 4: Replace ambient/glass styling in `index.css`**

Implement:

- flat neutral light/dark canvases;
- subtle section borders;
- quieter header;
- restrained link accent;
- minimal shadows only for sticky/overlay surfaces;
- mobile nav edge-fade to signal horizontal continuation;
- consistent form/control focus states;
- dark-mode counterparts for all new utility classes.

- [ ] **Step 5: Verify shell**

Run:

```bash
cd ui && npm run test:ui && npm run build && npm run lint
```

Expected: all pass.

---

### Task 3: Today command-center hierarchy

**Files:**
- Modify: `ui/src/features/today/Today.tsx`
- Use: `ui/src/components/workspace.tsx`

**Interfaces:**
- Preserves: all existing Today/editorial hooks and mutations.
- Changes only order, density, disclosure depth, and visual emphasis.

- [ ] **Step 1: Add a failing reusable-component assertion for the Today header/metric primitives**

Extend `workspace-ui.test.mjs` to assert `PageHeader` supports eyebrow/title/note/right-action content and `MetricCard` renders label/value/note with semantic text.

- [ ] **Step 2: Verify RED then complete the primitive contract if needed**

Run `cd ui && npm run test:ui`; make only the minimal primitive change needed; rerun to green.

- [ ] **Step 3: Reorder Today**

Render in this order:

1. `PageHeader`;
2. `Needs your attention` actions;
3. growth pulse metrics;
4. editorial plan;
5. compact account/schedule footer.

- [ ] **Step 4: Compress editorial recommendation cards**

Keep rank, format/decision, title, thesis, why-now, desired outcome, key scores, primary action, and all existing disclosures. Move six-dimensional scoring/evidence/provenance to secondary visual weight instead of removing them.

- [ ] **Step 5: Make source freshness compact**

Render source snapshot status as a compact strip/grid after the editorial controls, with amber only for actual source errors.

- [ ] **Step 6: Verify Today**

Run `cd ui && npm run test:ui && npm run build && npm run lint`, then inspect `#/today` live at desktop and 390px.

---

### Task 4: Discover master/detail triage workspace

**Files:**
- Create: `ui/src/features/discover/discoverView.ts`
- Create: `ui/tests/discover-view.test.mjs`
- Modify: `ui/src/features/discover/Discover.tsx`

**Interfaces:**
- Produces: `resolveDiscoverSelection(candidates, currentKey): string | null`.
- Preserves: `useDiscover`, refresh behavior, `useDiscoverTriage`, `useRoutingDecision`, Growth Fit blocking/override rules, completion history, bookmarks, and source links.

- [ ] **Step 1: Write failing selection tests**

Test these behaviors:

```js
resolveDiscoverSelection([], 'old') === null
resolveDiscoverSelection([{ key: 'a' }, { key: 'b' }], null) === 'a'
resolveDiscoverSelection([{ key: 'a' }, { key: 'b' }], 'b') === 'b'
resolveDiscoverSelection([{ key: 'a' }], 'b') === 'a'
```

- [ ] **Step 2: Verify RED**

Run `cd ui && node --test tests/discover-view.test.mjs` and confirm failure because `discoverView.ts` is absent.

- [ ] **Step 3: Implement `resolveDiscoverSelection` and verify GREEN**

Keep the helper pure and generic over `{ key: string }`.

- [ ] **Step 4: Split candidate scan row from candidate detail inside `Discover.tsx`**

Create internal `CandidateRow` and `CandidateDetail` components. Move all mutations and provenance-sensitive actions into `CandidateDetail`; the row only selects a candidate.

- [ ] **Step 5: Replace filter-pill walls**

Keep feed buttons as compact primary tabs. Replace topic pill expansion with a labeled select/control that includes `All topics` plus the existing `data.topicFilters` values.

- [ ] **Step 6: Build responsive master/detail layout**

Desktop: dense candidate list left, selected detail right with sticky positioning.

Mobile: selected detail appears in-flow above the remaining list; no horizontal page overflow.

- [ ] **Step 7: Verify Discover behavior**

Run `cd ui && npm run test:ui && npm run build && npm run lint` and live-check:

- feed changes;
- topic changes;
- selection preservation;
- blocked/override state;
- bookmark/skip/draft controls remain available;
- 390px layout.

Do not trigger destructive triage mutations during visual QA.

---

### Task 5: Conversations relationship-first density

**Files:**
- Modify: `ui/src/features/conversations/Conversations.tsx`

**Interfaces:**
- Preserves: conversation destination URLs, relationship data, expiration, draft status, autonomous decision state, health warnings, and recent-decision history.

- [ ] **Step 1: Reuse `OperatorStrip`, `MetricCard`, and `SectionHeading` instead of adding new component behavior**

No new production helper/function is needed. Keep the TDD-covered primitives as the shared contract.

- [ ] **Step 2: Compress autonomous runtime status**

Show running/paused state, dry-run/live mode, last refresh, next refresh, and Configure link in one compact strip.

- [ ] **Step 3: Emphasize active conversations**

Use a stronger active-conversation row/card with relationship stage, fit, expiry, recommendation, source excerpt, and review action.

- [ ] **Step 4: Densify new opportunities**

Reduce repeated badges to essential state. Keep autonomous review/skip state, relationship data, source excerpt, and review destination.

- [ ] **Step 5: Verify Conversations**

Run `cd ui && npm run build && npm run lint`, then inspect desktop and 390px live.

---

### Task 6: Posts lifecycle navigation and Attention view

**Files:**
- Create: `ui/src/features/create/createView.ts`
- Create: `ui/tests/create-view.test.mjs`
- Modify: `ui/src/features/create/Create.tsx`

**Interfaces:**
- Produces: `buildPostViews(sections)` returning view IDs/counts and the sections shown for each presentation view.
- Preserves: every existing `QueueCard` mutation, Growth Fit panel, gates, schedule plan, publication state, and the unrelated existing Repost-plan wording diff.

- [ ] **Step 1: Write failing lifecycle-view tests**

Given sections with IDs `ideas`, `drafting`, `review`, `approved`, `failed`, `published`, assert:

- `attention` includes `review`, `approved`, and `failed`;
- `attention` count is the sum of those item counts;
- each named lifecycle view exposes only its matching section;
- no queue item is mutated or copied with changed status.

- [ ] **Step 2: Verify RED**

Run `cd ui && node --test tests/create-view.test.mjs` and confirm failure because the helper is absent.

- [ ] **Step 3: Implement `buildPostViews` and verify GREEN**

Keep it pure and presentation-only.

- [ ] **Step 4: Add lifecycle tabs to `Create`**

Default to `attention` when any attention count exists; otherwise default to `ideas`/the first non-empty operational view. Tabs: Attention, Sources, Drafts, Review, Approved, Published. Failed items remain in Attention rather than gaining a separate primary tab.

- [ ] **Step 5: Preserve queue-card behavior while reducing visual density**

Keep current forms, gates, schedule controls, approval actions, source links, and disclosures. Reduce repeated metadata and only render the selected lifecycle section(s).

- [ ] **Step 6: Verify Posts**

Run `cd ui && npm run test:ui && npm run build && npm run lint`; inspect Attention, Sources, Drafts, Review, Approved, Published at desktop and 390px. Do not click mutation buttons during QA.

---

### Task 7: Results growth brief and evidence hierarchy

**Files:**
- Create: `ui/src/features/results/resultsView.ts`
- Create: `ui/tests/results-view.test.mjs`
- Modify: `ui/src/features/results/Results.tsx`

**Interfaces:**
- Produces: `describeGrowthConstraint(input)` returning a title/body/evidence-level presentation object only.
- Preserves: all measurements, attribution caveats, experiment tables, refresh behavior, audience link, and legacy health link.

- [ ] **Step 1: Write failing growth-brief tests**

Cover:

- response > 0 with continuation = 0 => continuation constraint language;
- no measured conversations => insufficient-evidence language;
- continuation > 0 => no false zero-continuation claim;
- brief text explicitly avoids causal wording.

- [ ] **Step 2: Verify RED**

Run `cd ui && node --test tests/results-view.test.mjs` and confirm failure because the helper is absent.

- [ ] **Step 3: Implement `describeGrowthConstraint` and verify GREEN**

The helper must describe measurement/constraint, not causality.

- [ ] **Step 4: Reorder Results**

Render:

1. `PageHeader` and refresh action;
2. growth brief;
3. audience/follower/conversation/account-health metrics;
4. advisory health strip;
5. recent measured posts;
6. writing/editorial experiment evidence.

- [ ] **Step 5: Verify Results**

Run `cd ui && npm run test:ui && npm run build && npm run lint`, then inspect desktop and 390px live.

---

### Task 8: Cross-screen consistency, dark mode, and final verification

**Files:**
- Modify if required by discovered inconsistencies: `ui/src/features/learn/Learn.tsx`, `ui/src/features/settings/Settings.tsx`, and shared CSS only.
- Do not broaden into a feature redesign of Learn or Settings.

**Interfaces:**
- Uses the same shell, typography, border, focus, and control system.

- [ ] **Step 1: Run the complete UI verification set**

```bash
cd ui && npm run test:ui && npm run build && npm run lint
```

Expected: all pass with no warnings/errors that indicate broken UI code.

- [ ] **Step 2: Run root UI build integration**

```bash
npm run ui:build
```

Expected: React build and generated dashboard Tailwind asset complete successfully.

- [ ] **Step 3: Live desktop QA**

Inspect `#/today`, `#/discover`, `#/conversations`, `#/create`, and `#/results` at normal desktop width. Confirm hierarchy, sticky/scroll behavior, dark-mode legibility, and no accidental action execution.

- [ ] **Step 4: Live 390px QA**

Inspect at least Today, Discover, Posts, and Results at 390px width. Confirm all primary routes remain discoverable and no horizontal page overflow hides content/actions.

- [ ] **Step 5: Inspect the final diff for scope**

Run:

```bash
git status --short
git diff -- ui docs/superpowers/specs/2026-09-05-x-growth-operator-ui.md docs/superpowers/plans/2026-09-05-x-growth-operator-ui.md
```

Confirm no unrelated existing file is overwritten and the pre-existing `Create.tsx` Repost-plan wording remains present.
