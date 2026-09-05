# X Growth Operator UI/UX Polish Spec

## Goal

Turn the existing React X Growth interface into a faster operator workspace without changing Growth OS decisions, persona behavior, approval rules, scheduler semantics, autonomous reply policy, browser-claim ownership, publication/reconciliation, or live X state.

## Product direction

The interface should read as an operator desk, not a generic SaaS dashboard. The hierarchy is:

1. action;
2. decision;
3. evidence;
4. detail.

The default view should expose what needs a human decision now. Evidence and technical provenance stay available, but secondary material should not compete visually with the current action.

## Visual system

- Quiet neutral canvas with graphite/ink typography.
- Remove the ambient blue/violet page gradients and most glass blur.
- Use borders and dividers instead of shadows for normal structure.
- Use one restrained interaction accent for links/selection.
- Green means ready/success, amber means attention, red means actual failure.
- Reduce badge/pill count; badges should carry state, not ordinary metadata.
- Keep technical IDs, timestamps, and measurements visually secondary.
- Do not add external fonts or new runtime UI dependencies.
- Preserve light/dark theme support.
- Preserve accessible focus states and reduced-motion behavior.

## Shell

Keep the six-route information architecture:

- Today
- Discover
- Conversations
- Posts
- Results
- Learn

Settings and theme remain secondary utilities. Desktop navigation should become quieter and tighter. Mobile navigation must clearly indicate horizontal continuation rather than depending on invisible overflow.

## Today

Reorder the page so the user's concrete work is visible first:

1. Needs attention.
2. Current growth pulse.
3. Ranked editorial recommendations.
4. Source freshness/evidence health.
5. Expanded scoring/provenance on demand.

Editorial cards should emphasize rank, selected format, title/thesis, why-now, expected reader outcome, and the primary workflow action. Multi-dimensional scoring and evidence details remain present but visually secondary.

## Discover

Replace the wall of large candidate cards with a triage workspace.

Desktop layout:

- left: dense scan list of candidates;
- right: selected candidate detail and actions;
- selected detail can remain sticky within the viewport.

Mobile layout:

- list remains primary;
- selecting a row reveals the detail panel in-flow without requiring a desktop split.

Source feeds should behave as the primary filter row. Topic filters should collapse into a compact control instead of consuming a second wall of pills. Preserve all routing provenance, Growth Focus constraints, override requirements, disabled actions, evidence disclosures, bookmarks, source links, and triage mutations.

## Conversations

Make relationship continuation the visual priority.

- Active conversations appear before new opportunities.
- Keep relationship fit/stage, freshness, source text, recommended social act, draft/review state, and autonomous state.
- Compress low-priority opportunities into denser rows.
- Autonomous reply runtime status becomes a compact operational strip.
- Reduce badge noise while preserving the same state semantics.

## Posts

Expose the lifecycle already represented by the backend:

Source -> Draft -> Review -> Approved -> Published / Failed

Add presentation-only lifecycle views. Default to an Attention view that combines review-required, approved/waiting, and failed work. Other views expose Sources, Drafts, Review, Approved, and Published. Do not change queue state, approval gates, scheduler decisions, publication ownership, or mutation behavior.

## Results

Lead with the current operational constraint rather than treating every metric as equally important.

Current data should support a concise growth brief that can call out weak conversation continuation while explicitly preserving evidence limits. The rest of the page keeps audience, follower quality, useful interactions, account health, recent measured posts, writing experiments, editorial experiments, and attribution confidence.

Do not convert low-N/low-confidence evidence into causal claims.

## Responsive behavior

- 390px wide mobile is a required acceptance viewport.
- No primary destination may become effectively hidden.
- Dense desktop split views must collapse to a single readable column.
- Buttons and controls must remain usable without horizontal page overflow.

## Non-goals

Do not change:

- Growth OS routing or decision semantics;
- persona/content generation behavior;
- approval gates or growth-packaging contracts;
- browser claims or X execution ownership;
- publication/reconciliation logic;
- scheduler behavior;
- autonomous reply behavior;
- API response semantics;
- stored data.

## Acceptance

- `npm run build` in `ui/` passes.
- `npm run lint` in `ui/` passes.
- UI-specific tests pass.
- Today, Discover, Conversations, Posts, and Results are visually checked live at desktop width.
- At least Today/Discover/Posts/Results are checked at 390px width.
- Existing uncommitted non-UI repair work remains untouched.
