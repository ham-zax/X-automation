# Expert Prototype Review — Wave 3

**Review date:** 2026-08-20
**Review scope:** integrated Wave-2 task flows, user flows, wireflows, product language, Human-AI interaction, and status/recovery language.
**Method:** expert cognitive walkthrough, Nielsen heuristic evaluation, WCAG 2.2 AA-oriented design review, and phone interaction review.
**Evidence type:** expert review of repository artifacts. No participant behavior, preference, quotation, success rate, card-sort result, or tree-test result is claimed.

## Review contract

This review treats the following as frozen semantics rather than design preferences:

- recommendation != human selection != generation/review != approval != schedule/wait != send/publish != confirmed result;
- every consequential action exposes its immediate effect before activation;
- lifecycle state is recognizable without remembering which module owns it;
- recovery states expose what failed, remote-effect certainty, current authoritative state, retry safety, and the next safe action;
- external niche evidence, own-account evidence, and declared test evidence remain visibly distinct;
- writing-strategy behavior IDs remain `off|suggest|apply`; `suggest` has zero Writer effect and `apply` affects one human-authorized generation only;
- applicable writing strategy starts in canonical `suggest` until participant research supports another default;
- qualified growth velocity remains the default strategic frame rather than raw likes/reach/follower count.

This review does **not** select C0, H1, H2, final navigation labels, final evidence labels, final research-depth labels, or final display wording for the writing-strategy modes.

## Readiness summary

**Result after repair: READY for moderated prototype sessions.**

No expert-detectable P0 defect remains in the reviewed artifacts. Five P1 prototype/readiness defects were found and repaired. The repairs preserve the same authority model, keep H1/H2 comparable, and do not add backend behavior.

The remaining issues are either:

- P2/P3 implementation/detail risks that should not consume this mission; or
- explicit participant-research questions that expert review cannot validly resolve.

## P0/P1 issue table

| ID | Severity | Artifact / location | Observable prototype failure | Violated contract / heuristic | Repair status |
|---|---|---|---|---|---|
| PR-1 | P1 | `WIREFLOWS.md`, writing-strategy frames; `PRODUCT_LANGUAGE.md`; `HUMAN_AI_INTERACTION.md` | The draft review wireflow exposed a fourth strategy state, `Not selected`, while strategy pickers showed no active mode. A participant could not know whether Writer guidance was off, advice-only, or applied before generation. | Frozen three-mode strategy contract; consistency; visibility of system status; error prevention. The source plan requires canonical `suggest` as the current default until participant research supports another default. | **Repaired.** Product/Human-AI contracts now state canonical `suggest` as the initial behavior and explicitly reject a fourth unset state. Wireflows show advice-only as the default stimulus, remove canonical IDs from participant-facing frames, and render desktop/phone point-of-use choice before generation. |
| PR-2 | P1 | `WIREFLOWS.md`, Discover -> Reply and Conversations detail | Discover/Editorial selection was defined as route-only, but the wireflow sent a newly selected Reply directly to an already generated editable reply. That silently reintroduced the Draft-consequence inconsistency for Reply. | Consequence contract; consistency and standards; Human selection != generation. | **Repaired.** Added desktop `[D-C2a]` and phone `[P-C2a]` pre-generation reply states. New opportunities/Reply selection now reach explicit `Generate reply`; existing drafts still use the normal detail state. |
| PR-3 | P1 | `WIREFLOWS.md`, phone Posts lifecycle | Phone Posts exposed `Open recovery` but provided no phone destination showing remote-effect certainty, retry safety, and next action. A phone participant could enter a failure path without being able to complete the recovery task. | Recovery contract; help users recognize/diagnose/recover; mobile parity. | **Repaired.** Added `[P-P5]` variants for known pre-remote failure and remote/local uncertainty, including explicit no-retry state and authoritative refresh/inspection actions. |
| PR-4 | P1 | `WIREFLOWS.md`, phone external research | Phone Viral research had setup and findings but no concrete running/progress state, stop-after-current-unit behavior, or re-entry model. The desktop task could not be completed equivalently on phone. | Visibility of system status; recognition over recall; mobile parity; truthful progress contract. | **Repaired.** Added `[P-L-EXT2]` with real checkpoint/current-unit semantics, stop-after-current-unit consequence, and leave/re-enter behavior; phone scenario now traverses it. |
| PR-5 | P1 | `USER_FLOWS.md`, H2 definition; `WIREFLOWS.md`, H2 shell | H2 is defined as a six-primary-destination hypothesis, but the shell rendered `Advanced` as an equal seventh primary peer. That changes the experimental condition and makes expert/system configuration appear to be normal daily navigation. | Research isolation rule; progressive disclosure; minimalist design; advanced complexity must not dominate ordinary work. | **Repaired.** H2 now distinguishes six primary destinations from an explicit support/utility `Advanced / Settings` entry. H1 remains unchanged, preserving its intentional `Results -> More` hypothesis. |

### P0 result

**None found after repair.** Consequential send/publish semantics remain explicit, approval remains distinct from public action, and uncertain remote effects suppress ordinary resend/republish actions.

---

# Cognitive walkthrough

For each job, the review asks:

1. Will the operator know the goal?
2. Will they notice the correct action?
3. Will they understand that the action advances the goal?
4. After acting, will they understand what happened and what comes next?

Outcome labels:

- **Pass** — no remaining expert-detectable P0/P1 defect.
- **Pass after repair** — a P1 defect was repaired and the affected path was re-walked successfully.
- **Participant question remains** — task is structurally testable, but placement/wording preference still requires user evidence.

## Walkthrough 1 — Resolve an open Today obligation without mistaking advice for required work

**Prototype path:** Today -> `Needs your decision` -> object owner -> action -> authoritative feedback -> Today.

**Goal recognition:** Pass. The prototype separates open human obligations from advisory opportunities and states the number of decisions needing the operator.

**Action notice:** Pass. Obligations expose object-specific actions such as `Review exact draft` and `Open conversation`; advisory items are in a separate region.

**Action-goal mapping:** Pass. Consequence text states that review/navigation does not publish/send. Advisory selection states that it selects work only.

**Feedback/next step:** Pass. The flows require authoritative state plus next step and return/re-entry through Today.

**Outcome:** **Pass.** Wave-1 priority ambiguity is repaired at prototype level.

**Still for participants:** exact ordering/heading words and whether the advisory section remains useful without feeling urgent.

## Walkthrough 2 — Choose an Editorial recommendation and predict route/generation/approval/publication

**Prototype path:** recommendation -> inspect why/evidence -> choose/override type -> route-only selection -> explicit generation for authored work -> review.

**Goal recognition:** Pass. Recommendation and human choice are visibly distinct.

**Action notice:** Pass. Selection controls name the content/contribution type; generation is a separate action.

**Action-goal mapping:** Pass after PR-2. Original/Thread/Quote and Reply now all preserve the same sequence: route first, generate second. Repost explicitly avoids authored-body generation.

**Feedback/next step:** Pass. Generated content enters editable draft/reply state without approval/publication authority.

**Outcome:** **Pass after repair.** No authored route now silently skips the explicit-generation consequence model.

**Still for participants:** best route-selection verb and whether the extra explicit generation step improves prediction enough to justify later production implementation.

## Walkthrough 3 — Review draft, fix blockers, approve, plan, leave, and identify state later

**Prototype path:** Draft -> readiness/blocker -> human confirmations -> approve exact text -> publishing plan -> approved/waiting -> later re-entry -> publishing -> published/failed/reconcile.

**Goal recognition:** Pass. Exact content, blockers, confirmations, and lifecycle state are co-present.

**Action notice:** Pass. `Check readiness`, approval, and `Save plan` have distinct consequence text.

**Action-goal mapping:** Pass. Approval states `not public yet`; plan changes timing only; background publication is conditional on approval/eligibility/configured mode.

**Feedback/next step:** Pass after PR-3 on phone. Desktop and phone now both expose publication failure/reconciliation behavior as part of the object lifecycle.

**Outcome:** **Pass after repair.** Cross-session lifecycle is recognizable without reconstructing Draft-versus-Posts ownership.

**Still for participants:** exact lifecycle terms such as `Needs review`, `Approved — waiting`, and `Planned for`.

## Walkthrough 4 — Prepare and explicitly send a reply

**Prototype path:** Conversations -> opportunity/context -> explicit generation when needed -> edit -> readiness -> combined approval/send or already-approved send -> sent/recovery.

**Goal recognition:** Pass. `What you can add`, source, and relationship context establish the reply purpose.

**Action notice:** Pass after PR-2. New opportunities expose `Generate reply`; existing reply drafts expose editor/readiness.

**Action-goal mapping:** Pass. `Approve & send exact reply` explicitly names both human approval and immediate public transport.

**Feedback/next step:** Pass. `Sent` appears only as confirmed result; uncertain result enters reconciliation.

**Outcome:** **Pass after repair.** The normal send boundary remains one of the strongest prototype paths.

**Still for participants:** whether the combined approval/send action provides sufficient deliberate caution without excessive friction.

## Walkthrough 5 — Recover from pre-remote failure versus uncertain remote effect

**Prototype path A:** deterministic/pre-remote failure -> state no remote effect -> fix or safe retry when owner permits.

**Prototype path B:** send/publish attempted -> uncertain/partial result -> ordinary remote action suppressed -> authoritative refresh/inspection -> confirmed success, known safe failure path, or explicit wait/escalation.

**Goal recognition:** Pass. Recovery blocks name the failed operation and desired recovery goal.

**Action notice:** Pass. Safe read/refresh/inspect controls remain visible while resend/republish disappears during uncertainty.

**Action-goal mapping:** Pass. Retry is explicitly conditional on remote-effect certainty.

**Feedback/next step:** Pass after PR-3 for phone main-feed publication.

**Outcome:** **Pass after repair.** The prototype can test the exact Wave-1 remote/local divergence problem without inventing a reconciliation mutation.

**Still for participants/operations:** whether refresh + read-only inspection + wait/escalation is sufficient for real failure classes or a dedicated reconciliation action is required.

## Walkthrough 6 — Run simplified Viral research and understand progress/result evidence

**Prototype path:** H1 Results external area or H2 Learn external area -> period/niches/depth -> optional advanced -> run -> real checkpoint progress -> optional stop -> later re-entry/findings -> evidence detail.

**Goal recognition:** Pass. Ordinary setup starts with research scope rather than runtime/model machinery.

**Action notice:** Pass. `Run research`, `Advanced setup`, and `Stop after current unit` have distinct effects.

**Action-goal mapping:** Pass. The run is explicitly read-only and may outlive the current session.

**Feedback/next step:** Pass after PR-4. Desktop and phone now both expose a truthful running state and cross-session re-entry.

**Outcome:** **Pass after repair.** The research task is structurally ready for participant testing under both H1/H2.

**Still for participants:** ordinary-user control set, research-depth words, and whether `Standard` is a useful default label.

## Walkthrough 7 — Compare external, internal, and test evidence without blending provenance

**Prototype path:** open each evidence lane -> compare in one workspace -> inspect agreement/disagreement/insufficient state -> gather evidence, leave approach unchanged, inspect learned rule, or open possible writing guidance.

**Goal recognition:** Pass. Each lane answers a different question.

**Action notice:** Pass. Provenance is repeated at each evidence row/card rather than encoded only by location/color.

**Action-goal mapping:** Pass. The synthesis explicitly avoids an opaque combined score and preserves observational/confounder language.

**Feedback/next step:** Pass. Insufficient/conflicting evidence can terminate without forcing a strategy change.

**Outcome:** **Pass.** Evidence provenance is testable on desktop and phone.

**Still for participants:** whether H1 Results or H2 Learn makes comparison more findable, and whether vertically stacked phone evidence creates too much working-memory burden.

## Walkthrough 8 — Inspect writing strategy and choose no influence/advice only/deliberate use

**Prototype path:** evidence/recommendation -> applicable content type -> current mode -> keep/change mode -> generate -> display influence provenance -> review/change/remove -> normal approval flow.

**Goal recognition:** Pass after PR-1. The prototype now always has a defined three-mode state; applicable work starts in canonical `suggest` until changed.

**Action notice:** Pass. The three candidate display labels are shown as research stimuli, while canonical IDs are kept in evaluator annotations rather than participant-facing frames.

**Action-goal mapping:** Pass. Advice-only states Writer unchanged; deliberate use affects one generation; no mode approves/schedules/sends/publishes/accepts a learned rule/assigns a test.

**Feedback/next step:** Pass. Desktop and phone have point-of-use controls before generation and retain the selected influence state during review.

**Outcome:** **Pass after repair.** S1/S2/S3 placement hypotheses remain testable rather than being collapsed into one expert choice.

**Still for participants:** final display words and whether the choice belongs in the evidence area, the draft, or both.

## Walkthrough outcome summary

| # | Job | Outcome |
|---|---|---|
| 1 | Resolve a Today obligation without confusing advisory work | **Pass** |
| 2 | Editorial recommendation -> route -> explicit generation | **Pass after repair** |
| 3 | Draft -> blockers -> approval -> timing -> later lifecycle truth | **Pass after repair** |
| 4 | Prepare and explicitly send a reply | **Pass after repair** |
| 5 | Recover from known-no-remote versus uncertain-remote result | **Pass after repair** |
| 6 | Simplified Viral research -> progress -> results | **Pass after repair** |
| 7 | Compare external / own-account / test evidence | **Pass** |
| 8 | Choose optional writing-strategy influence safely | **Pass after repair** |

---

# Nielsen heuristic evaluation

## 1. Visibility of system status

**Result:** Pass for the prototype model.

Strengths:

- lifecycle state is repeated on object overview/detail surfaces;
- approved main-feed content explicitly says it is not public;
- send/publish pending states are distinct from confirmed result;
- research progress uses real checkpoint/current-unit semantics;
- recovery shows current authoritative state and uncertainty.

Implementation requirement: async generation, readiness, save, send/publish, research, and reconciliation changes must be exposed programmatically as status messages where they do not move focus.

## 2. Match between system and the real world

**Result:** Pass with participant-language questions.

Strengths:

- actions use immediate-effect verbs;
- technical runtime/scorer vocabulary is not required for ordinary work;
- evidence sources are described by their real provenance.

Unresolved by expert review: `Learn`, `Current winning styles`, `What works for you`, `Tests`, research-depth labels, and strategy display labels.

## 3. User control and freedom

**Result:** Pass.

- route/strategy choices remain changeable before later authority boundaries;
- strategy influence can be changed/removed before approval;
- stop-after-current-unit has a truthful delayed-stop model;
- uncertain remote writes suppress duplicate action rather than inviting retry.

P2/P3 items such as undo treatment for dismiss/reset remain outside this repair mission unless participant evidence elevates them.

## 4. Consistency and standards

**Result:** Pass after PR-1/PR-2.

- route selection and AI generation now use one consequence model for every authored type;
- strategy has exactly three behavior states and a defined default;
- post lifecycle terms are reused across summaries/detail/re-entry.

## 5. Error prevention

**Result:** Pass.

- public send action names the remote consequence before activation;
- approval is not publication;
- plan/timing is not publication;
- uncertain remote effect removes resend/republish controls;
- strategy apply cannot be mistaken for approval/publication in the consequence copy.

## 6. Recognition rather than recall

**Result:** Pass.

- object lifecycle state is visible wherever the user re-enters;
- evidence provenance labels travel with evidence rows/cards;
- Today separates obligations/advice structurally;
- Draft/Conversation surfaces show point-of-use writing influence instead of requiring memory of a prior Learn/Results choice.

## 7. Flexibility and efficiency of use

**Result:** Pass as a prototype hypothesis.

- ordinary Viral research uses scope/depth while exact technical controls remain Advanced;
- explanation and technical detail remain available on demand;
- H1/H2 intentionally test different placements for evidence/settings.

No expert preference is used to collapse those hypotheses.

## 8. Aesthetic and minimalist design

**Result:** No P0/P1 issue after repair.

Intentional density remains in:

- H1 Results, which is explicitly testing whether Results becomes too broad;
- desktop evidence comparison, which shows three lanes simultaneously;
- advanced research/settings disclosures.

Those are participant/research questions, not expert-authorized redesign triggers in this wave.

## 9. Help users recognize, diagnose, and recover from errors

**Result:** Pass after PR-3.

Recovery anatomy answers:

- what failed;
- what may have happened remotely;
- current authoritative state;
- retry safety;
- next safe action.

Known-no-remote failure and remote-uncertain states are not collapsed into one `Failed` treatment.

## 10. Help and documentation

**Result:** Pass at prototype/content-system level.

Decision-ready copy appears first, evidence/reasoning appears on demand, and technical provenance remains an advanced layer. Implementation should make disclosure controls keyboard-operable and preserve expanded/collapsed state where needed for comprehension.

---

# WCAG 2.2 AA-oriented prototype/design review

This is a **design review, not a conformance audit**. Low-fidelity Markdown/ASCII wireflows do not establish final DOM semantics, CSS contrast, target dimensions, focus behavior, or assistive-technology behavior.

Normative orientation: W3C WCAG 2.2 Recommendation, with particular relevance to meaningful structure/sequence, color independence, reflow, keyboard operation, focus order/visibility/not-obscured behavior, descriptive headings/labels, label-in-name, target size, error identification/instructions, name-role-value, and status messages.

## A11Y-1 — Logical heading and reading order

**Design state:** supportable; implementation requirement remains.

Requirements:

- implement page title -> major region heading -> object/card heading -> control order in the same logical sequence shown in the wireflows;
- do not use CSS grid/flex visual reordering that causes screen-reader/keyboard order to differ from Today obligation priority or evidence comparison order;
- preserve explicit text labels such as `EXTERNAL`, `OUR ACCOUNT`, and `TEST`; do not rely on column position alone;
- when desktop evidence lanes collapse to phone, retain a meaningful linear sequence and repeated provenance labels.

No P0/P1 prototype repair was required because the wireflows already encode an explicit textual order.

## A11Y-2 — Keyboard and focus expectations

**Design state:** implementation requirements, not conformance claims.

- Every link, button, radio/choice, disclosure, nav entry, stop control, refresh/recovery action, and consequential action must be keyboard operable.
- Focus order must follow task order and visible hierarchy.
- Focus must remain visible and must not be entirely obscured by sticky headers, sheets, dialogs, or recovery overlays.
- If `Choose treatment` is implemented as a dialog/sheet, give it a programmatic name, move focus into the dialog, keep interaction inside while modal, provide keyboard cancel/close, and restore focus to the invoking control on close.
- If section rows become tabs, implement actual tab semantics/keyboard behavior; otherwise use normal links/buttons rather than visually tab-like controls with incorrect roles.
- Disclosures must expose expanded/collapsed state programmatically.
- After a destructive/remote action changes the available controls, move or preserve focus predictably; do not strand focus on an element removed from the DOM without a meaningful destination.

## A11Y-3 — Status and progress cannot rely on color

**Design state:** strong.

The wireflows encode current state with text, position, brackets, headings, and consequence copy. Implementation must preserve that redundancy instead of using color-only state chips.

For non-focus-moving async changes such as `Generating…`, `Checking readiness…`, `Saving…`, `Sending…`, `Publishing…`, `Researching…`, and reconciliation refresh results, use programmatically determinable status messaging so assistive technology can announce the change without forcing focus.

## A11Y-4 — Control names and consequence text

**Design state:** strong after repair.

- Visible labels identify the actual action: generate, check readiness, approve, save plan, send, refresh state, stop after current unit.
- Accessible names must include the visible label text, especially for icon-enhanced controls.
- Consequence text must remain associated with the corresponding action; do not separate `This sends… now` from the send control so far that it becomes ambiguous.
- For repeated controls such as `Open`, `Inspect`, or `Review`, accessible names/context must identify the object or evidence lane.

## A11Y-5 — Phone target size and dense controls

**Design state:** P2 implementation risk; no expert-detectable P1 blocker remains.

WCAG 2.2 AA Target Size (Minimum) requires pointer targets to meet the minimum criterion or an allowed exception. Implementation should treat 24 by 24 CSS pixels as the AA floor and use more generous touch areas/spacing for high-consequence phone controls where practical.

Highest density risks:

- eight treatment choices in the Discover choice surface;
- three writing-influence choices plus evidence disclosure;
- H1 Results section list;
- paired recovery actions (`Refresh state`, `View X output`);
- small inline source/evidence links.

Do not make a compact phone label satisfy layout constraints by shrinking the target below the accessibility floor.

## A11Y-6 — Reflow and horizontal overflow

**Design state:** strong direction; implementation requirement remains.

Phone wireflows intentionally stack lifecycle and evidence content. Implementation must preserve complete task functionality without requiring horizontal scrolling for primary navigation, lifecycle state, evidence comparison, or action consequence.

The desktop three-lane evidence comparison should reflow to labeled vertical cards on narrow screens, as the phone wireflow already specifies.

## A11Y-7 — Errors, instructions, and association

**Design state:** strong recovery semantics.

Implementation requirements:

- associate field-level blockers with the relevant input/confirmation and identify the error in text;
- provide an actionable correction when one is known;
- preserve recovery block headings and current-state/retry text for assistive technology;
- do not automatically move focus to every non-blocking error; choose alert/status behavior according to urgency while keeping the message discoverable;
- after authoritative refresh resolves reconciliation, announce the resulting state and place focus at a meaningful next action/status location.

## A11Y-8 — Motion and animation

**Design state:** no dependency.

No task requires animation, motion, auto-advancing content, or visual transition to understand state. Production implementation should keep lifecycle/progress meaning available in static text and respect reduced-motion preferences if decorative transitions are added later.

## A11Y-9 — Contrast and visual styling

**Design state:** not evaluable in low fidelity.

Final implementation must validate text contrast, non-text contrast for controls/focus/state indicators, visible focus, and disabled-state distinguishability. No conformance claim can be made from these artifacts.

---

# Mobile interaction review

## Today

**Ready.** Obligations appear before advisory opportunities in the content order, primary consequences remain beside actions, and no horizontal navigation scan is required by the phone flow contract.

Participant question: how much account/outcome summary should remain above the fold after obligations without diluting priority.

## Discover

**Ready.** Choice of treatment is explicit and route-only; authored generation occurs on the next state. The treatment surface is dense but complete.

Implementation requirement: use touch targets/spacing that preserve accuracy for eight choices and keep the selected treatment announced/textually visible.

## Conversations

**Ready after PR-2.** New Reply work has a pre-generation state; existing drafts remain editable; explicit send stays on Conversation detail. Reconciliation removes resend.

## Posts / draft lifecycle

**Ready after PR-3.** Review, approval, waiting, and later truth are visible on phone. Publication failure now has a concrete phone recovery destination rather than an orphan `Open recovery` action.

## Results

**Ready as an IA hypothesis.** H1 intentionally exposes evidence/settings under Results; H2 keeps Results focused on own-account outcomes. The expert review does not decide which is better.

## External research / Learn

**Ready after PR-4.** Phone now supports setup -> run -> real progress/stop -> leave/re-enter -> findings. Advanced setup remains optional for ordinary use.

## Evidence comparison

**Ready with participant question.** Repeated provenance labels survive vertical stacking. The remaining concern is working-memory cost when participants compare several cards separated by scroll; that requires observed behavior before redesign.

## Writing strategy

**Ready after PR-1.** Phone and desktop show a defined current/default mode, exact consequence of each choice, evidence access, and generation afterward. Repost remains not applicable.

## Mobile parity summary

| Task | Desktop | Phone | Result |
|---|---|---|---|
| Today obligation vs advice | Complete | Complete | Ready |
| Recommendation -> route -> generation | Complete | Complete | Ready |
| Post review/approval/re-entry/recovery | Complete | Complete after PR-3 | Ready |
| Reply preparation/send/reconciliation | Complete | Complete after PR-2 | Ready |
| Failure certainty/retry safety | Complete | Complete after PR-3 | Ready |
| Viral setup/progress/stop/re-entry | Complete | Complete after PR-4 | Ready |
| Evidence provenance comparison | Complete | Complete stacked | Ready to test |
| Writing strategy choice | Complete after PR-1 | Complete after PR-1 | Ready to test |

---

# Exact P0/P1 repairs made

## `docs/ux/PRODUCT_LANGUAGE.md`

- Added the source-plan default: applicable writing guidance starts in canonical `suggest` until participant research supports another default.
- Kept the default semantic rather than treating `Advice only`/`Suggest` as validated display language.

## `docs/ux/HUMAN_AI_INTERACTION.md`

- Added the same initial behavior to Pattern 8.
- Explicitly prohibited a fourth `unset`/`not selected` writing-strategy behavior state.

## `docs/ux/USER_FLOWS.md`

- Clarified that H2 has six primary destinations and that `Advanced / Settings` is a support/utility entry, not a seventh primary destination.
- Did not change H1/H2 task semantics or select a winning IA.

## `docs/ux/WIREFLOWS.md`

- Separated H2 primary navigation from its Advanced/Settings support entry.
- Added pre-generation Reply states on desktop and phone and routed new Reply selection/opportunities through them.
- Removed the undefined `Not selected` writing-strategy state.
- Marked advice-only as the current default stimulus while keeping canonical IDs in evaluator annotations instead of participant-facing frames.
- Added a desktop point-of-use strategy-choice frame so draft-only placement can actually be tested.
- Added phone publication failure/reconciliation state `[P-P5]`.
- Added phone Viral research progress/stop/re-entry state `[P-L-EXT2]`.
- Updated phone/desktop scenarios to traverse the repaired states.

No repair required `TASK_FLOWS.md` or `STATUS_LANGUAGE.md`; their semantics already matched the repaired prototype.

---

# P2/P3 observations deliberately not repaired

These do not currently meet the mission's P0/P1 repair threshold:

- The desktop H1 Results hypothesis is intentionally dense; participant evidence must determine whether it is too broad.
- Phone evidence comparison may impose working-memory cost because evidence lanes stack vertically; provenance remains visible, so observe before redesigning.
- Exact placement and mechanics for phone navigation remain intentionally unspecified.
- Exact interaction component for `Choose treatment` remains open (page, dialog, or sheet); accessibility requirements depend on the chosen implementation.
- Exact compact lifecycle wording remains a participant-language question.
- Low-fidelity artifacts do not specify final target sizes, contrast, focus indicator styling, or responsive breakpoints; these are implementation validation requirements.

---

# Questions reserved for real participant evidence

Do not resolve these from this review:

1. C0 vs H1 vs H2 primary IA findability.
2. Whether `Learn` means evidence/adaptation or education/help.
3. Whether H1 makes Results an understandable hub or an overloaded catch-all.
4. Exact labels for external patterns, own-account evidence, tests, strategy recommendations, and Advanced/Settings.
5. Exact user-facing words for canonical `off|suggest|apply` behavior.
6. Whether strategy selection belongs in the evidence area, at the draft point of use, or in both with different responsibilities.
7. Which Viral controls ordinary operators need before starting and what research-depth labels they understand.
8. Whether `Needs review`, `Approved — waiting`, and `Planned for` support correct lifecycle predictions after time away.
9. Whether refresh + external inspection + wait/escalation is sufficient for real reconciliation cases.
10. Whether phone evidence stacking makes cross-source comparison too memory-heavy.
11. Whether `Advanced / Settings` is the expected category for AI/niche/system configuration.
12. Whether bare recommendation/quality scores improve decisions or create false precision.

---

# Participant-session readiness decision

**READY after the repairs in this commit.**

The prototype now provides a complete, consequence-explicit path for all eight required jobs on desktop and phone where phone parity is required. No remaining expert-detectable P0/P1 issue blocks moderated sessions.

Readiness does **not** mean the IA or terminology is validated. The next evidence step remains actual moderated usability, card-sort/tree-test, and language research. Production React/backend implementation remains outside this mission and should not treat these expert-reviewed hypotheses as participant-validated product truth.
