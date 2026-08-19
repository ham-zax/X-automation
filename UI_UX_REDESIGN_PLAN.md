# X Network Growth OS Frontend Modernization Plan

**Goal:** Modernize the dashboard into a fast, maintainable, component-based interface without changing the human-centered product model, backend ownership, or consequential-action boundaries already established in `docs/plans/UX_REDESIGN_PROGRAM.md`.

**Architecture:** Treat the existing UX program as the product/interaction source of truth and this document as its frontend-architecture companion. Migrate incrementally from server-rendered `dashboard.js` to a Vite + React + TypeScript client backed by an explicit browser-facing Node API that calls the existing domain owners directly. Keep the legacy dashboard available during migration and retire it only after each user journey has functional parity.

**Tech Stack:** Node.js built-in HTTP server, SQLite, existing domain modules, Vite, React, TypeScript, Tailwind CSS v4, accessible headless UI primitives where they materially reduce implementation work, and TanStack Query for browser/server state.

## Global Constraints

- Preserve the current primary information architecture: **Today / Discover / Conversations / Create / Results / Improve / Advanced**.
- Preserve all human approval and explicit send/unfollow/strategy-change boundaries.
- Preserve `AUTO_POST=false`, scheduler authority, content gates, Account Health hard evidence, expiry, manual routing, and manual schedule overrides.
- AI recommendations, deterministic rules, and human decisions must remain visibly distinct.
- Technical metrics remain available through progressive disclosure rather than dominating normal workflows.
- Do not make `agent_bridge.js` the browser backend; it remains a JSON-in/stdout agent/CLI boundary.
- Do not use optimistic state for consequential writes whose truth belongs to the server or X.
- Do not simulate progress. Show real progress when the backend can measure it; otherwise use an indeterminate pending state.
- Keep migration reversible until the corresponding journey reaches functional parity.
- Do not add dependencies merely for visual novelty; each dependency must solve a current interaction or maintainability problem.

## Relationship to the Existing UX Program

`docs/plans/UX_REDESIGN_PROGRAM.md` remains authoritative for:

- user needs and behavioral roles;
- the six user-goal areas;
- plain-language terminology;
- progressive disclosure;
- Human-AI interaction rules;
- approval/publishing semantics;
- Results/Tests/What-we've-learned comprehension.

This plan governs only **how that validated product model is migrated to a maintainable frontend architecture**.

### Why this separation matters

The earlier version of this plan started from framework choices and introduced a new `Operations / Growth / Analytics` navigation model. That would reverse the central UX improvement already made: users should navigate by goals, not by implementation or business-system categories. Frontend modernization must not silently become a second product redesign.

## Architecture Decisions and Reasons

### Decision 1: React + TypeScript is a migration option because the current UI has reached a maintainability threshold

`dashboard.js` is now a large mixed-responsibility file containing HTTP routing, orchestration, HTML generation, forms, UI terminology, view state, and client behavior. A component boundary and typed browser API can reduce coupling and make later UX iteration safer.

**Reason:** the case for React is maintainability and clearer ownership, not visual trend-following.

### Decision 2: Preserve Today / Discover / Conversations / Create / Results / Improve

Do not replace the current goal-based IA with `Operations / Growth / Analytics`.

**Reason:** the existing redesign deliberately stopped exposing backend architecture as navigation. Reintroducing category-oriented navigation would make the interface harder for ordinary operators and stakeholders to predict.

### Decision 3: Build a real browser API instead of wrapping `agent_bridge.js`

The React client should call `/api/*` routes owned by the Node web process. Those routes call existing domain owners such as:

- `pipeline.js`;
- `store.js`;
- `engagement.js`;
- `scheduler.js`;
- `experiments.js`;
- `learning.js`;
- `audience.js`;
- `writer_runtime.js`.

`agent_bridge.js` remains a separate consumer of those same modules.

**Reason:** `agent_bridge.js` is stdin/stdout JSON, not an HTTP endpoint. Making the browser shell out through it would add an unnecessary process boundary, duplicate validation, and blur ownership.

### Decision 4: Use optimistic UI only for reversible local presentation state

Good optimistic candidates:

- opening/closing panels;
- local filters and sort order;
- tab/view selection;
- temporary client-only rearrangement that has no persisted consequence.

Use server-confirmed pending states for:

- approving content;
- sending a reply;
- publishing;
- unfollowing;
- assigning an experiment variant;
- accepting/retiring a learned strategy change;
- recording or resolving Account Health evidence.

**Reason:** these actions change authoritative local state, remote X state, or future strategy behavior. Showing them as completed before confirmation can create exactly the stale-state contradictions the backend lifecycle review uncovered.

### Decision 5: Never simulate progress

For long operations:

- show real counts/progress when the backend exposes measurable progress;
- otherwise show `Refreshing…`, `Generating…`, or another indeterminate state;
- add SSE only when there is a real backend job/event stream worth exposing.

**Reason:** fake percentages are persuasive decoration, not system status. They reduce trust when duration or completion cannot actually be measured.

### Decision 6: Motion is explanatory polish, not architecture

Do not require Framer Motion in the first migration slice. Prefer CSS transitions for simple state changes. Add a motion dependency only if a specific transition is materially clearer with it.

**Reason:** physics-based animation does not solve the current usability or maintainability bottleneck and should not become a foundational dependency by default.

### Decision 7: Charts are task-driven

Do not install Recharts merely because Results exists. First identify which stakeholder question cannot be answered well by the current summaries/tables; add a chart only for that question.

**Reason:** interactive charts can increase cognitive load and dependency surface without improving decision quality.

### Decision 8: Discover should optimize judgment, not mimic Tinder

The migrated Discover view should make rapid triage easy, but retain source context, AI rationale, and explicit actions such as Original / Quote / Conversation / Save / Ignore.

**Reason:** swipe metaphors encourage fast binary disposal while this product is evidence-led and often needs more than a yes/no decision.

### Decision 9: Skeletons are appropriate only for genuine initial loading

Use layout-matched skeletons where data is actually pending and the final shape is predictable. For mutations, prefer a clear pending state on the affected control/card.

**Reason:** skeletons reduce perceived initial-load friction but should not hide whether a consequential action has actually completed.

## Required Application State Vocabulary

The frontend must represent these states explicitly and consistently:

- loading;
- refreshing;
- awaiting human decision;
- pending server action;
- success;
- retryable failure;
- ambiguous remote-write state;
- blocked;
- expired;
- approved but not published;
- publishing;
- published;
- Account Health constraint active;
- Account Health constraint resolved;
- AI suggestion;
- deterministic rule/gate;
- human decision.

**Reason:** the important UX problem is state comprehension, not card styling. These states correspond to real backend invariants and must not be collapsed into generic success/error decoration.

# Migration Architecture

```text
React/Vite client
      |
      v
Node /api/* browser routes
      |
      +--> pipeline.js
      +--> store.js
      +--> engagement.js
      +--> scheduler.js
      +--> experiments.js
      +--> learning.js
      +--> audience.js
      +--> writer_runtime.js

agent_bridge.js --------------------+
                                     |
                                     +--> same domain owners

legacy dashboard.js ----------------+
```

The migration is a strangler pattern: new React journeys replace legacy presentation one at a time while the domain layer remains shared.

# Implementation Roadmap

### Phase 0: Freeze the Interaction Contract

**Files:**
- Reference: `docs/plans/UX_REDESIGN_PROGRAM.md`
- Update when necessary: `docs/ux/PRODUCT_LANGUAGE.md`
- Update when necessary: `docs/ux/HUMAN_AI_INTERACTION.md`

**Interfaces:**
- Consumes: the current Today/Discover/Conversations/Create/Results/Improve behavior and backend action boundaries.
- Produces: a stable presentation contract for the migration.

**Steps:**
- Record the current primary navigation and plain-language labels that must survive the migration.
- Record the exact consequence of every consequential action: local save, human approval, external X write, scheduling, test assignment, strategy acceptance.
- Record the reusable application-state vocabulary above.

**Acceptance criteria:**
- A frontend engineer cannot reinterpret approval as publishing, assignment as randomization, or a learned suggestion as an automatically applied rule.

### Phase 1: Extract Browser-Facing JSON Routes

**Files:**
- Create: `web_api.js`
- Modify: `dashboard.js` to delegate `/api/*` requests to `web_api.js` while continuing to serve the legacy UI.
- Reuse: existing domain modules; do not proxy through `agent_bridge.js`.

**Interfaces:**
- Consumes: current store/pipeline/engagement/scheduler/experiment/learning/audience/writer functions.
- Produces: JSON endpoints for the first migrated journey plus a consistent JSON error envelope.

**Steps:**
- Add only the read/write endpoints needed by Today first.
- Return explicit server state after mutations instead of requiring the client to infer transitions.
- Keep consequential validation in the existing domain owners; the HTTP layer only validates request shape and authentication/session prerequisites already present in the app.

**Acceptance criteria:**
- Today can be rendered entirely from JSON without changing domain behavior or removing the legacy Today view.

### Phase 2: Create the React/Vite/Tailwind Shell

**Files:**
- Create: `ui/` Vite React TypeScript application.
- Reuse/port: `dashboard.tailwind.css` design tokens and current plain-language navigation.
- Modify: `package.json` only for dependencies/scripts required by the client build.

**Interfaces:**
- Consumes: `/api/*` JSON routes.
- Produces: a client shell with Today / Discover / Conversations / Create / Results / Improve / Advanced navigation.

**Steps:**
- Build a shared application shell and typed API client.
- Add TanStack Query only for server-state retrieval/cache/invalidation.
- Create reusable Pending / Error / Empty / Blocked / Technical-details presentation primitives.
- Keep motion to CSS transitions unless a specific later journey proves a stronger need.

**Acceptance criteria:**
- The shell preserves the current IA and can display truthful loading/error/pending states without optimistic consequential writes.

### Phase 3: Migrate Today

**Files:**
- Create React components under `ui/src/features/today/`.
- Extend `web_api.js` only for Today data/actions that are actually required.

**Interfaces:**
- Consumes: conversations needing attention, review items, approved upcoming posts, Account Health, recent outcomes.
- Produces: the same decision workspace currently exposed by the legacy Today page.

**Steps:**
- Preserve `Needs a decision / Worth doing / For awareness` hierarchy.
- Keep one dominant action per card.
- Show pending server state for any mutation and replace the card only after server confirmation.

**Acceptance criteria:**
- A user can answer “what needs my attention?” without opening a legacy module.

### Phase 4: Migrate Conversations

**Files:**
- Create: `ui/src/features/conversations/`.
- Extend: `web_api.js` with bounded conversation/draft/review/send routes.

**Interfaces:**
- Consumes: Engage Next items, relationship context, Account Health, writer output, explicit approval state.
- Produces: conversation review/drafting with explicit human send control.

**Steps:**
- Put contribution value and conversation context before technical scores.
- Keep AI generation separate from human approval.
- Treat send as pending until X/local reconciliation returns authoritative state.

**Acceptance criteria:**
- The UI never displays a reply as sent before the backend confirms or reports an ambiguous remote-write state.

### Phase 5: Migrate Create

**Files:**
- Create: `ui/src/features/create/`.
- Extend: `web_api.js` with creation, generation, live quality-preview, review, approval, scheduling, and publication-status routes.

**Interfaces:**
- Consumes: current queue lifecycle and `writer_runtime.js`/drafting owners.
- Produces: Ideas -> Drafting -> Needs review -> Ready to publish -> Published.

**Steps:**
- Preserve AI-first drafting: users review finished text rather than filling scaffold fields.
- Preserve server-side quality/gate calculation.
- Keep “Approved — not published yet” visually distinct from publishing/published.

**Acceptance criteria:**
- Approval, scheduling, and actual publication are never visually conflated.

### Phase 6: Migrate Discover and Audience

**Files:**
- Create: `ui/src/features/discover/` and `ui/src/features/audience/`.
- Extend: `web_api.js` for discovery actions, audience refresh, and one-account unfollow.

**Interfaces:**
- Consumes: candidate research, niche/recommendation context, current audience state.
- Produces: evidence-led triage and manual one-account audience cleanup.

**Steps:**
- Use explicit triage actions instead of swipe-only interaction.
- Keep `Why?` available contextually.
- Unfollow must remain one account per explicit action and show pending until XActions + local reconciliation complete.

**Acceptance criteria:**
- The client does not decrement or remove a followed account until authoritative unfollow success is returned.

### Phase 7: Migrate Results

**Files:**
- Create: `ui/src/features/results/`.
- Extend: `web_api.js` with read-only result summaries as needed.

**Interfaces:**
- Consumes: content measurements, conversation outcomes, audience quality, Account Health.
- Produces: stakeholder-first result comprehension with technical measurements on demand.

**Steps:**
- Start from stakeholder questions: What happened? Is it working? Is anything wrong?
- Add charts only where a specific comparison/trend is materially easier to understand visually.

**Acceptance criteria:**
- A stakeholder can understand status/outcomes without reading raw measurement tables.

### Phase 8: Migrate Improve

**Files:**
- Create: `ui/src/features/improve/`.
- Extend: `web_api.js` with Test and learned-strategy endpoints.

**Interfaces:**
- Consumes: explicit experiment lifecycle/assignment and suggested/accepted/retired learned rules.
- Produces: Tests and What-we've-learned flows with bounded human-controlled changes.

**Steps:**
- Preserve explicit non-random experiment assignment.
- Require server confirmation before displaying assignment/acceptance as active.
- Keep evidence/sample/confounder details available under `Why?` / Technical details.

**Acceptance criteria:**
- Nothing in Improve can imply that a test was randomized or that a suggested strategy change is active before explicit acceptance.

### Phase 9: Retire Legacy Presentation

**Files:**
- Remove migrated rendering branches from `dashboard.js` only after every corresponding journey is served by the new client.
- Keep backend/domain owners unchanged unless separate requirements justify changes.

**Interfaces:**
- Consumes: completed migrated journeys.
- Produces: a small Node web/API entrypoint plus the React client.

**Steps:**
- Remove legacy view code incrementally after parity, not as one all-at-once rewrite.
- Keep Advanced/diagnostic functionality reachable until its replacement exists.
- Remove Bootstrap only when no remaining legacy markup depends on it.

**Acceptance criteria:**
- The old presentation layer can be removed without changing workflow, persistence, scheduling, measurement, or strategy behavior.

## Deferred Until a Concrete Need Exists

- Framer Motion.
- Recharts.
- SSE/WebSockets.
- Command palette.
- drag-and-drop prioritization.
- dark/light theme expansion beyond the current design requirements.

These are not rejected permanently. They are deferred because none is required to establish the current UX or migration architecture. Add them only when a specific user task or measured usability problem justifies the dependency and interaction cost.

## Migration Success Criteria

The modernization is successful when:

1. the current goal-based IA is preserved or changed only through UX evidence, not framework preference;
2. ordinary workflows use plain language and progressive disclosure;
3. AI, deterministic rules, and human decisions remain clearly distinguishable;
4. consequential actions use authoritative server-confirmed state;
5. no fake progress or causal certainty is introduced;
6. the React client and agent bridge share domain owners rather than duplicating business logic;
7. legacy presentation can be removed journey-by-journey without changing backend semantics;
8. frontend maintainability improves without turning the migration into a product rewrite.
