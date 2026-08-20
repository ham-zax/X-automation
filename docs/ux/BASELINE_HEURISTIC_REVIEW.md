# Baseline Heuristic Review — Current React Product

**Audit date:** 2026-08-20
**Baseline:** `004f7fc`
**Method:** repository-based expert heuristic review of the current React product plus authoritative action effects. No user study, analytics, screenshot study, accessibility test, or usability test was performed.

## Evidence and severity rules

- **Repository-observed** means the behavior/copy/state is directly present in code.
- **Likely novice failure hypothesis** is an expert inference, not an observed participant result.
- **Research question** requires empirical user evidence.

Severity follows `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md`:

- **P0** — blocks a task or risks an unintended consequential action;
- **P1** — recurring major misunderstanding or friction;
- **P2** — efficiency/readability issue;
- **P3** — polish/consistency issue.

A visual preference is not P0/P1 by itself.

## Executive result

**Repository-observed + severity judgment.** No P0 defect is confirmed by this repository-only audit of the current React shell. The most consequential current controls generally state their authority boundary: reply send says it sends the exact reply; main-feed approval repeatedly says it is not publication; schedule controls say they do not approve or publish; manual repost completion states that the app does not repost; Audience review cannot unfollow; and tests/learned suggestions state their bounded effect.

The highest confirmed baseline findings are P1 because they can plausibly produce recurring task/comprehension/recovery failure without showing a repository-backed path to an unintended remote send/publication.

This differs from the older `docs/ux/CURRENT_STATE_AUDIT.md`, which classified architecture-first navigation as P0. The current mission uses a stricter P0 definition and the current React shell is materially more guided than the pre-shell state described by that older audit.

## P0 findings

**None confirmed.**

Potential remote/consequential actions were traced before reaching this conclusion:

- `Approve & send exact reply` is explicit and backend-gated by exact approved text and account health/credentials.
- `Unfollow` performs one exact account unfollow and displays pending state; the existing Human-AI Interaction contract explicitly says a confirmation popup is not required.
- `Approve for publishing` does not publish.
- `Save plan` does not publish.
- `Mark reposted` requires a confirmation that the human already reposted on X.
- `Accept change` activates bounded learned recommendation behavior but cannot bypass human approval, routing/scheduling overrides, expiry, or publication/send authority.

## P1 findings

### H1 — Today presents two competing priority surfaces

**Severity:** P1
**Heuristics:** match between system and real world; recognition rather than recall; visibility of system status; minimalist prioritization
**Surfaces:** Today

**Repository-observed.** Today says `N things worth looking at`, then renders four summary metrics, then an `AI Editorial Plan` headed `What is worth doing now?`, and only afterward renders `Needs your attention`. The backend `taskCount` is the count of `TodayAction` items in `Needs your attention`; Editorial recommendations are a separate advisory data source.

**Likely novice failure hypothesis.** A first-time or occasional operator may treat the first, larger recommendation block as the authoritative task queue and postpone a waiting draft review, active conversation, account constraint, or already-approved publishing decision lower on the page.

**Observable user failure to test.** User chooses an optional Editorial recommendation when asked to find the item that already requires a human decision.

**Research question.** Without coaching, can users explain which Today items are optional recommendations versus already-open workflow obligations?

### H2 — “Draft” has different consequences on Today and Discover

**Severity:** P1
**Heuristics:** consistency and standards; match between system and real world; error prevention/predictability
**Surfaces:** Today, Discover, Draft

**Repository-observed.** Today `Draft this` calls editorial selection: it persists selection, routes the candidate, and creates a text draft scaffold, but does not invoke writer generation. Discover `Draft original`, `Draft quote`, `Draft thread`, and `Draft reply` route the candidate and, when no draft exists, immediately invoke AI generation before navigating to the draft.

**Likely novice failure hypothesis.** Users cannot form one stable meaning for “Draft.” The same conceptual action may mean “select + create an empty scaffold” or “select/route + run AI + persist text.”

**Observable user failure to test.** After choosing Today `Draft this`, user expects generated text and interprets an empty editor/`Generate with AI` prompt as failure; or after choosing Discover `Draft …`, user is surprised that an AI call ran immediately.

**Research question.** Which action labels let users predict whether AI generation happens now versus after entering the editor?

### H3 — Approval-to-publication and reply-to-send state are locally clear but globally fragmented

**Severity:** P1
**Heuristics:** recognition rather than recall; consistency; visibility of system status
**Surfaces:** Posts, Draft, Conversations, Today

**Repository-observed.** Main-feed editing/review/approval can happen on Draft detail, but the publishing plan lives in Posts after approval. Reply Draft detail explicitly sends the user to Conversation detail for send authority. Today summarizes the next scheduled post and automation mode but does not own schedule editing. Posts owns queue status and schedule plan; Draft owns exact text; Conversations owns reply send.

**Repository-observed strength.** Each handoff contains explicit explanatory copy: `Approval is not publication`, `The publishing plan lives in Posts`, and reply Draft directs the user to Conversation detail.

**Likely novice failure hypothesis.** An occasional reviewer returning after days/weeks may remember the object (“that draft”) but not the surface that owns the next authority decision. The product teaches the model repeatedly rather than letting users recognize the complete lifecycle in one place.

**Observable user failure to test.** User approves a draft and then cannot find or correctly describe the state controlling when it publishes; user opens a reply Draft expecting to send from there.

**Research question.** After a one-week delay, where do users look first to answer “is this approved, scheduled, publishing, or already published?”

### H4 — Failed/reconciliation states do not always provide a complete safe recovery path

**Severity:** P1
**Heuristics:** help users recognize/diagnose/recover from errors; visibility of system status; user control and freedom
**Surfaces:** Conversations, Draft, Posts, shared `Error`

**Repository-observed.** Shared `Error` renders `Something went wrong`, the supplied message, and optionally `Try again`. Most action-level errors render a backend message but no standardized `what changed / what did not change / safe next action` structure.

A concrete high-stakes path exists in `pipeline.js::sendApprovedEngagementReply`: X transport can succeed while tweet identity/local recording remains incomplete. In that case backend state stays `publishing` and the API intentionally returns an error that says manual reconciliation is required. `useConversationAction` invalidates the relevant queries on success, not on mutation error, so the current detail can continue to render its pre-action snapshot until another read. Backend state guards reject an ordinary second send, but the current UI does not provide a direct reconciliation action or force an authoritative refresh on this error path.

Main-feed `failed` items expose `publishError`, but the current React card does not provide a dedicated reconciliation/retry decision model.

**Likely novice failure hypothesis.** On a partial send/publish failure, a user may not know whether the remote action happened, whether the visible controls are stale, or what is safe to do next.

**Observable user failure to test.** User attempts to repeat a send or abandons a published-but-unreconciled reply because the visible state still appears pre-send; or cannot recover a failed main-feed publication without external system knowledge.

**Research question.** Which failure states actually occur in operation, and what minimal recovery affordance resolves them without introducing duplicate-write risk?

### H5 — Viral Styles requires advanced research/AI configuration before an occasional user can run a study

**Severity:** P1
**Heuristics:** flexibility and efficiency; recognition rather than recall; minimalist design; match to user task
**Surface:** Viral Styles

**Repository-observed.** Before `Run research`, the page exposes historical window, multiple niches, discovery floors, maximum posts/query, same-author controls/seed, optional thread reconstruction, optional AI intent analysis, AI Settings profile versus runtime mode, exact runtime/model, and reasoning/effort. The page does provide a run summary, disabled-state explanation, explicit read-only framing, checkpoints, and stop semantics.

**Likely novice failure hypothesis.** An occasional operator whose goal is “show me what styles/intents appear to work” must first reason about sampling and execution machinery. Wrong choices are more likely to produce no/weak evidence than an unintended production action, hence P1 rather than P0.

**Observable user failure to test.** User cannot start a sensible run without explanation of discovery floors, controls/seed, runtime/model, or reasoning; or changes them arbitrarily to escape disabled state.

**Research question.** Which minimum scope choices do users need to make themselves, and which defaults can be safely inferred without changing research validity?

### H6 — System configuration is partly hidden under a label that implies inspection only

**Severity:** P1
**Heuristics:** match between system and real world; recognition rather than recall; consistency
**Surfaces:** Diagnostics, AI Settings, Your niche, Audience, Viral Styles

**Repository-observed.** `Diagnostics` is a primary-navigation peer and its description says `Inspect account-health and relationship details`. The same page is also the only React hub for `Your niche` and `AI Settings`, both mutating configuration surfaces. Audience links to `Edit niche`; Viral Styles can link to `AI settings`, so contextual discovery exists after the user reaches those tasks.

**Likely novice failure hypothesis.** A user starting with “change what counts as my niche” or “change the AI model” may not predict `Diagnostics` as the destination unless a contextual link happens to be visible.

**Observable user failure to test.** In a findability/tree task, user searches Performance, Experiments, or Viral Styles rather than Diagnostics for configuration.

**Research question.** What category labels do users naturally assign to niche definition, AI provider/model configuration, account health, and relationship diagnostics?

## P2 findings

### H7 — Bare recommendation/relationship scores expose precision without explaining scale or decision role

**Severity:** P2
**Heuristics:** match to real world; minimalist design; help/documentation

**Repository-observed.** Editorial recommendations show six bare integer values for Reach, Follow, Conversation, Relationship, Authority, and Objective fit. Conversation lists expose `Relationship fit {targetScore}`. Advanced disclosures show additional component scores.

**Likely novice failure hypothesis.** Users may over-weight precise-looking numbers or assume a calibrated probability/rating scale. This is currently an interpretation/readability cost, not a demonstrated task blocker.

**Research question.** Do users use these numbers to make better decisions than reason/evidence summaries alone?

### H8 — `Apply` in Posts does not name the state change

**Severity:** P2 (escalate to P1 if user evidence shows repeated wrong routing)
**Heuristics:** match to real world; error prevention; consistency

**Repository-observed.** In `Next step`, choosing a content type and pressing `Apply` immediately persists route/lane/status changes and clears prior approval. The adjacent label gives context, but the button alone is generic.

**Likely novice failure hypothesis.** User may treat it as applying a selection locally rather than committing a workflow route.

### H9 — Niche reset has weak recovery

**Severity:** P2
**Heuristics:** user control and freedom; error prevention

**Repository-observed.** `Reset to defaults` is explicit and disabled when defaults are already active, but it immediately persists the default profile. There is no confirmation, prior-profile snapshot, or undo control in the React surface.

**Likely novice failure hypothesis.** An accidental click requires manual reconstruction of custom terms. Because it does not remotely publish/send and the label is explicit, this audit does not elevate it to P0/P1 without observed recurrence.

### H10 — Learned-rule acceptance has good consequence copy but weak immediate reversal visibility

**Severity:** P2
**Heuristics:** user control and freedom; error prevention

**Repository-observed.** Eligible suggestions show `What will change if accepted` and a single `Accept change` button. Acceptance immediately activates the bounded rule. Retirement is available afterward inside `Manage accepted change` and requires a reason.

**Likely novice failure hypothesis.** Users who skim may interpret accept as acknowledging the finding. The explicit consequence copy materially mitigates this risk.

### H11 — Unknown hash routes silently become Today

**Severity:** P2
**Heuristics:** visibility/status; recovery; consistency

**Repository-observed.** `App.tsx` falls through to `<Today />` for unknown route segments rather than showing Not Found or preserving route-error context.

**Likely novice failure hypothesis.** A stale/deep link can look like a successful navigation to Today rather than a broken destination, obscuring recovery.

### H12 — Primary navigation can overflow horizontally without an explicit overflow cue

**Severity:** P2 hypothesis
**Heuristics:** visibility; flexibility/responsive use

**Repository-observed.** The header navigation uses `overflow-x-auto` for eight peers.

**Likely novice failure hypothesis.** On narrow screens, later destinations can be off-screen and discoverable only by horizontal scrolling. No runtime/mobile observation was performed, so this remains a code-based responsive hypothesis rather than an observed accessibility defect.

## P3 findings

### H13 — Label hierarchy is not fully consistent

**Severity:** P3
**Heuristics:** consistency and standards

Examples:

- primary nav says `Experiments`, while the creation card is headed `Tests` and product language prefers `Test` for `experiment`;
- route/internal names remain `create`, `results`, `improve`, `advanced` while visible labels are Posts, Performance, Experiments, Diagnostics. Internal paths are not user-facing by default but appear in shared links/history;
- Viral copy correctly says AI classifies text-supported communicative intent, while the setup label still says `AI author-intent groups`, which can read more strongly than the epistemic caveat.

These are consistency/polish issues unless user evidence shows comprehension failure.

## Heuristic coverage by Nielsen category

| Heuristic | Current strengths — **repository-observed** | Current risks |
| --- | --- | --- |
| Visibility of system status | Pending labels; source freshness; queue statuses; Viral progress/checkpoints; automation badge; success/error panels | Partial-failure mutation paths can leave stale pre-action UI; state is distributed across surfaces |
| Match between system and real world | Plain-language status labels; `Approval is not publication`; explicit exact-reply send copy | Mixed primary-nav categories; `Diagnostics` contains settings; bare scores; generic `Apply` |
| User control and freedom | Rerouting before publish; bookmark toggle; skipped sources can reopen; learned rule can retire | No visible undo for recommendation dismiss, conversation resolve, niche reset; failure reconciliation not directly actionable |
| Consistency and standards | Shared primitives; common pending/error/badge/disclosure patterns; quality language normalized | “Draft” consequence differs by surface; Experiments/Tests terminology; state ownership differs for main-feed vs replies |
| Error prevention | Confirmation before discarding dirty AI regeneration, draft deletion, test completion, profile deletion, manual repost recording; final confirmations before approval/send | Niche reset immediate; generic route `Apply`; partial remote success recovery relies on backend error text and state guards |
| Recognition rather than recall | Today task cards; visible Draft back-links; contextual links to Audience/Niche/AI Settings | Publishing plan and reply send require cross-surface handoffs; eight mixed top-level concepts remain peers |
| Flexibility and efficiency | Progressive disclosure; technical details; advanced test setup; direct expert AI configuration | Viral Styles places advanced execution/sampling controls in the ordinary run path |
| Aesthetic/minimalist design | Major pages lead with plain-language summaries and hide many internals in disclosures | Editorial card exposes six scores before the decision controls; Viral form is dense; advanced values still leak into ordinary lists |
| Help users recover from errors | Source refresh errors preserve explicit text; Draft publish error preserves server error; reply backend emits precise reconciliation messages | No standardized changed/not-changed/safe-next-step model; mutation error may leave stale state; failed publication lacks dedicated recovery control |
| Help/documentation | Inline caveats about causality, publication authority, AI limits, manual reposts, test semantics | Users still need repeated explanations because lifecycle/analysis concepts are distributed rather than structurally obvious |

## Current strengths to preserve

These are repository-observed and should not be lost in later redesign work:

1. **Human authority is explicit.** Recommendation, selection, readiness, approval, scheduling, publication, and send are not silently collapsed.
2. **Reply send boundary is unusually clear.** The exact text, human confirmations, and remote-send wording are visible at the consequential click.
3. **Progressive disclosure is already a product pattern.** Technical details, recommendation evidence, scheduler reason, and experiment confounders can remain inspectable without always occupying the primary line.
4. **Viral research progress is truthful.** It exposes named checkpoints, current unit, stop-after-current-unit semantics, and errors rather than fake instantaneous completion.
5. **Causal overclaims are actively avoided.** Performance and experiment copy repeatedly labels observations/associations and attribution limits.
6. **Audience AI cannot silently act.** AI suggestions and single-account unfollow authority are separated.
7. **Learned suggestions are inert until explicit acceptance.** Accepted effects are bounded and cannot bypass production authority gates.

## Complexity that should remain advanced

**Repository-observed classification, not a final IA recommendation.** The product currently has legitimate expert functionality that should remain inspectable somewhere even if later research changes its placement:

- AI runtime/provider/model/reasoning, secrets, role/fallback resolution, capability diagnostics, execution provenance;
- Viral discovery thresholds, same-author controls, exact model selection, checkpoint logs;
- experiment population JSON, exact metric identifiers, raw cohorts/confounders;
- learned-rule match/adjustment internals and mechanism tags;
- raw account-health and relationship diagnostics;
- exact editorial algorithm/AI provenance.

## Evidence anchors

- `ui/src/App.tsx`
- `ui/src/components/primitives.tsx`
- `ui/src/features/today/Today.tsx`
- `ui/src/features/discover/Discover.tsx`
- `ui/src/features/create/Create.tsx`
- `ui/src/features/create/DraftPage.tsx`
- `ui/src/features/create/DraftEditor.tsx`
- `ui/src/features/conversations/Conversations.tsx`
- `ui/src/features/conversations/ConversationDetail.tsx`
- `ui/src/features/results/Results.tsx`
- `ui/src/features/results/Audience.tsx`
- `ui/src/features/improve/Improve.tsx`
- `ui/src/features/viral/ViralStyles.tsx`
- `ui/src/features/advanced/Advanced.tsx`
- `ui/src/features/settings/AISettings.tsx`
- `ui/src/features/settings/NicheSettings.tsx`
- `ui/src/api/client.ts`
- `web_api.js`
- `pipeline.js`
- `editorial.js`
- `audience.js`
- `docs/ux/HUMAN_AI_INTERACTION.md`
- `docs/ux/PRODUCT_LANGUAGE.md`
