# Agent-first Growth Workspace Implementation Plan

**Goal:** Replace the rejected minimal operator-console presentation with a readable creator workspace whose primary operator is an AI agent and whose human surface supports oversight, analysis, selection, and intervention.

**Architecture:** Keep the existing agent bridge, persona model, behavior/content gates, delegation, queues, browser claims, reconciliation, and measurements authoritative. The React workspace reads these owners rather than introducing a second agent runtime or permission model. A human can inspect and steer the same state used by another ChatGPT/Codex session.

**Tech Stack:** Existing React, TypeScript, TanStack Query, Tailwind, semantic CSS, and native browser facilities. No added dependencies.

## Global Constraints

- Approved direction: graphite sidebar, light reading surfaces, cobalt actions, restrained teal accents, substantial headings and comfortable body typography; support the existing dark theme.
- Restore decision-relevant text, full selected sources, draft context, reasons, and approval blockers. Use disclosure for diagnostics rather than essential judgment.
- The agent is the primary operator. Natural requests may define one action, an objective, a duration, or action-count bounds. Counts are requested work, not proof of growth or permission to bypass relevance, persona, authority, or platform constraints.
- Relevant follower growth and recurring conversations are objectives, not guaranteed outcomes. Observe, reconcile, measure, and adapt using durable state.
- A running delegation is not evidence of an attached reasoning/browser session. Do not imply that the Node daemon creates future model turns.
- This pass does not start an engagement run, change grants, enable publication, mutate the persona, change backend contracts, or publish on X.
- No new tests or dependencies. Use the existing non-test production build and rendered-page inspection for completion evidence.

## Design

Palette: canvas #f2f5f7, surface #ffffff, graphite #222831, ink #202c3b, cobalt #2255ce, teal #0c7c78. Warning/error states remain semantic and explicit in text. Display typography uses Bahnschrift/Segoe UI Variable Display with restrained weight; body uses Segoe UI/system sans; code/data uses Consolas/system monospace. No external font downloads.

The signature is source beside decision: readable evidence and conversation content adjacent to the recommendation, review state, and next action. A desktop sidebar replaces the two-tier header. Mobile navigation remains labeled and scrollable, without hiding the selected source or human stop controls.

## Task 1: Shared presentation

Files: `ui/src/App.tsx`, `ui/src/main.tsx`, `ui/src/components/workspace.tsx`, `ui/src/components/primitives.tsx`, removed `ui/src/index.css`, new `ui/src/workspace.css`.

Consume existing routes/theme state. Build a persistent sidebar, account context, skip link, page toolbar, larger controls, readable semantic panels, paired themes, and responsive layouts. Retire the duplicated legacy shell stylesheet instead of appending another competing theme. Keep route URLs and query behavior unchanged.

Acceptance: all existing routes remain accessible, meaningful labels and focus remain visible, selected source/detail fit both desktop and mobile, and the dark theme preserves contrast.

## Task 2: Agent oversight on Today

Files: new `ui/src/features/today/OperatorOverview.tsx`, `ui/src/features/today/Today.tsx`.

Consume `useGrowthOperator`, `usePersona`, and `useAutonomousReplies`; never derive an agent heartbeat from a grant. Show persona version/status, delegation mode/state/revision, reply mode/state/budget, and links to their existing owner controls. Offer a copyable session handoff referencing the canonical prompt, not a fake in-app agent launcher. Show full recommendations and their rationale; display source freshness and growth measures.

Acceptance: unknown/error state is not rendered as ready; context is readable without opening several disclosures; no automatic settings or X writes occur.

## Task 3: Source, conversation, publishing, and evidence views

Files: `ui/src/features/discover/Discover.tsx`, `ui/src/features/create/GrowthFitPanel.tsx`, `ui/src/features/create/Create.tsx`, `ui/src/features/create/DraftPage.tsx`, `ui/src/features/create/WritingApproachPanel.tsx`, `ui/src/features/conversations/Conversations.tsx`, `ui/src/features/conversations/ConversationDetail.tsx`, `ui/src/features/results/Results.tsx`.

Restore full selected content, meaningful list previews, visible reasons, and readable contextual evidence. Keep the existing action handlers and approval boundaries intact. Put source and decision into task-specific layouts, rather than changing the shared backend.

Acceptance: essential decision information and current blockers remain visible; draft/approval text is not silently altered; agent activity is distinguished from confirmed public outcomes; results retain sample and attribution limits.

## Task 4: Durable operating contract and verification

Files: `AGENTS.md`, `docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md`, the prior console design specification.

Record the agent-first interaction model and bounded invocation semantics for successor sessions. Mark the prior minimalism direction superseded. Run `npm run ui:build` once at the candidate final state, inspect the scoped diff, and review real rendered routes at desktop/mobile and dark/light where browser access permits. Do not claim screenshots or checks that were unavailable.

## Implementation checkpoint

The shared presentation, agent-context overview, fuller source/review views, and durable agent-first operating instructions are implemented. `DraftEditor.tsx` now places the exact editable text and approval readiness before configuration. `autonomousView.ts` centralizes truthful labels/tone: eligible work, dry runs, failed sends, and uncertain outcomes are not presented as confirmed publication.

Verification: the final root `npm run ui:build` passes TypeScript, Vite (93 modules), and Tailwind. The existing >500 kB bundle warning remains. The aggregate scoped diff was inspected. Browser accessibility observations confirmed the rebuilt Overview, Discover, Conversations, Posts, and Results routes render. No content/grant mutations or live X actions were performed by this redesign session. No automated tests were created, modified, or run.

Visual verification limit: browser-fast recovered after a transient connection error, but browser-devtools still could not connect to its configured Windows Chrome endpoint. Screenshot-based appearance, mobile viewport behavior, and light/dark visual contrast are not signed off. Do not treat accessibility observations or the successful build as pixel-level visual proof.

The redesign is uncommitted. A separate concurrent change to `docs/AGENT_WORKFLOW.md` appeared during verification and was left untouched by the initial redesign session.

## Screenshot repair and live-operation checkpoint

The owner subsequently requested real screenshots/error inspection, followed by live posting. Native browser screenshots now cover the desktop overview in light/dark themes, the source-status error presentation, and 390px mobile source statuses and Discover. The original error expanded a 1434px document to 4589px. Source cells now permit shrinking and long-token wrapping; ANSI formatting is removed, concise failures remain visible, and the complete diagnostics are expandable. Both collapsed and expanded diagnostics kept the document at 1434px; the mobile check reported 390px viewport and 390px document width. These observations replace the earlier blanket screenshot-access limitation, not a claim that every route/state has been visually checked.

The dashboard was still running a September 3 process and returned API-route-not-found errors for current persona/delegation endpoints. Restarting only `x-test-dashboard.service` loaded the current routes; both endpoints returned success and the overview displayed the actual persona and grant. The independent X source-refresh browser crashes/resource failures remain unresolved and honestly visible with retained snapshot timestamps.

Live use exposed two bridge handoff defects. `route` now forwards an explicitly supplied object `routeContext` to the existing routing owner, allowing a genuine purpose to be established without fabricating a human Ignore override. `apply-writer-output` now builds its authoritative current Writer packet and supplies it to the existing behavior/evidence validator; the same previously rejected operation then saved the draft. No content, persona, or approval gate was weakened. Root UI production build, `node --check agent_bridge.js`, and `git diff --check` passed; no automated test suite was run.

### Unconfirmed public action: reconcile before retry

- Candidate: `https://github.com/ChromeDevTools/chrome-devtools-mcp`; draft 107; queue 16469; Original.
- Exact draft begins `"Make it premium" is not a UI brief.` It recommends screenshots and concrete UI failure states, with the verified official Chrome DevTools MCP source URL.
- Current persona/behavior and writing-strategy selection 58 were supplied. Review passed 50/50 with no hard-gate or packaging blockers. The exact verified candidate was linked as the primary queue source through the existing source-link owner before mission-agent approval.
- Approval authority is mission-agent, Growth Operator revision 2; `humanApprovedAt` remains null. The owner's instruction to begin posting after the checks was interpreted as a one-off immediate timing request for this item; normal scheduler cadence was not changed.
- `browser-publish-claim` succeeded at 1788625518333. One browser Post click was issued. The action tool reported the click completed, but final observation failed with `UtilAcceptVsock: accept4 failed 110`.
- Subsequent observations still showed the populated composer. A separate fresh profile tab showed no matching new post. Network/console diagnostics did not establish a CreateTweet success or definitive rejection. This is an UNKNOWN publication outcome, not a confirmed send or a proven failure.
- No second Post click was issued. Keep the queue in-flight. A successor must re-observe the live account, composer, and publication evidence and reconcile an exact matching public result through `record-action` before counting success. Do not blindly resend or clear the claim.
- Working composer tab at this checkpoint: `9A78EFB0E44C53D8E9109BBCC283744D`; read-only verification tab: `5024B41CEE056B01E654966BDC52695A`. Tabs are shared and must be re-observed, not trusted as permanent IDs.
- Autonomous replies remain Dry run. No new reply authority, background wake process, or API mutation credential was introduced.
