# X Growth Operator Console UI Design

## Goal

Turn the existing X Growth React workspace into a deliberate operator console: fast to scan, semantically colored, information-dense without feeling cramped, and equally coherent in light and dark mode.

The redesign must improve presentation and interaction only. Growth strategy, persona semantics, approval boundaries, browser claims, publication/reconciliation, scheduler behavior, and autonomous-reply behavior remain authoritative and unchanged.

## Visual direction

Use deep ink/navy neutrals with one strong indigo primary. Reserve color by meaning:

- indigo: primary action, selection, current route;
- cyan: information and observed/source context;
- emerald: ready, confirmed, healthy;
- amber: attention, review, caution, incomplete evidence;
- red: actual failure or destructive action only;
- violet: AI/model-derived content only;
- slate: neutral/secondary state.

Color must communicate state rather than decorate every object. Surfaces remain quiet and borders do most structural work.

## Theme architecture

Replace the growing one-off light/dark utility overrides with semantic CSS variables for canvas, surface, elevated surface, subtle surface, text, muted text, border, strong border, primary, and each status family.

Shared components consume semantic classes so light and dark themes stay paired. Existing Tailwind utility classes may remain for layout, but shared state colors should move to semantic primitives.

## Shared UI primitives

Add/upgrade reusable components for:

- semantic badges;
- primary, secondary, ghost, danger, and success actions;
- notices for info/success/warning/danger/AI;
- segmented tabs with per-tab semantic tone;
- metric cards with optional accent tone;
- section headers and status surfaces.

Focus rings must use the primary color and remain visible in both themes. Hover must indicate selection/action without elevation gimmicks.

## Shell

Keep the six-route top navigation because Discover benefits from full horizontal workspace width. Improve the shell with:

- stronger indigo current-route indicator;
- clearer brand mark;
- quieter utility controls;
- better horizontal-scroll affordance on small screens;
- slightly stronger surface separation between navigation and workspace.

## Today

Keep the action-first hierarchy. Improve it with semantic action cards:

- conversation continuation: indigo/cyan relationship cue;
- post review: amber/emerald cue depending on readiness;
- metric pulse cards use restrained semantic accents;
- editorial recommendations visually distinguish selected, research, and skip states;
- primary CTA becomes consistent with the shared action system.

## Discover

Preserve the master/detail model. Improve the working ergonomics:

- selected candidate gets a clear indigo selection rail/background;
- candidate list stays compact and internally scrollable on desktop;
- detail pane becomes sticky on wide screens;
- source tabs and topic filter use the shared segmented/filter visual language;
- routing/recommendation warnings use semantic notices;
- actions are ordered primary -> secondary -> destructive/skip;
- mobile remains one-column with the selected detail directly after the selected candidate.

## Conversations

Make relationship work visibly higher priority than raw opportunity volume:

- active conversation receives a stronger relationship surface;
- autonomous-reply runtime becomes a compact status strip;
- lower-priority opportunities become denser rows with reduced badge noise;
- review-needed opportunities use amber, skipped/dry-run state stays neutral;
- relationship fit and expiry remain readable without competing with the actual social act.

## Posts

Treat lifecycle state as the main navigation language:

- Attention: amber;
- Sources: cyan/neutral;
- Drafts: violet;
- Review: amber;
- Approved: emerald;
- Published: slate/emerald-neutral.

The lifecycle tab row remains horizontally scrollable on mobile and becomes sticky enough to retain context while working through long queues. Queue cards get a subtle state rail rather than relying on many badges. Failure stays red and approval/ready stays emerald.

## Results

Keep the evidence-first hierarchy. Improve it with:

- the current constraint rendered as an amber brief, not a generic card;
- metrics gain small semantic accents rather than large colored fills;
- account health uses status color consistently;
- measured posts remain neutral editorial surfaces;
- experiment/evidence sections use violet only where AI/model-derived interpretation is actually present.

## Responsive behavior

At <= 639px:

- navigation and segmented controls scroll horizontally with visible fade affordances;
- page actions become full-width only when it improves tapability;
- cards reduce padding;
- multi-column operator panes collapse to one column without hiding the selected detail;
- controls retain >= 40px practical touch targets where they are primary actions.

## Testing

Add presentation tests for semantic tone rendering and lifecycle tone mapping. Keep the existing view-model tests. Verify:

- `npm run test:ui`;
- `npm run build` in `ui`;
- `npm run lint` in `ui` (0 errors; pre-existing warnings may remain if unrelated);
- root `npm run ui:build`;
- `git diff --check`;
- visual browser review for Today, Discover, Conversations, Posts, Results at desktop and mobile, plus dark mode.
