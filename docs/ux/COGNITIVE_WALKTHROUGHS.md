# Cognitive Walkthroughs — Current React Product

**Audit date:** 2026-08-20
**Baseline:** `004f7fc`
**Method:** expert cognitive walkthrough against the actual current React implementation and authoritative backend effects. No participant behavior is claimed.

## Evidence discipline and protocol

For every meaningful step, this audit asks the four questions required by `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md`:

1. **Q1 — Goal:** Will the user know what they are trying to achieve at this step?
2. **Q2 — Notice:** Will the user notice the correct action/control?
3. **Q3 — Mapping:** Will the user understand that the action moves them toward the goal?
4. **Q4 — Feedback:** After acting, will the user understand what happened and what to do next?

Labels:

- **Repository-observed** — implementation/copy/state directly exists.
- **Likely novice failure hypothesis** — expert inference to validate, not a research finding.
- **Research question** — requires real users or operational evidence.

Outcome terms:

- **Pass** — current repository provides a coherent path and consequence model.
- **Fragile** — task is possible, but a P1 misunderstanding/recall/recovery risk exists.
- **Fail** — current UI cannot reliably complete or recover the stated task.
- **Current gap** — task belongs to the future research/program contract but has no current UI; no invented control is assumed.

---

## Walkthrough 1 — Determine what needs attention today and take the correct next step

### Starting state

User opens the product at `#/today` with one or more queued workflow actions and an available AI Editorial Plan.

### Step 1 — Recognize the Today purpose

**Repository-observed.** The page title is `Today`. The subtitle says either `You are caught up` or `N things worth looking at`. Four status cards show active conversations, posts awaiting review, useful interactions, and new relevant followers.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** `Today` plus `N things worth looking at` strongly signals triage/next work. |
| Q2 — Notice | **Yes.** The page immediately exposes counts and a `Find new signals` secondary action. |
| Q3 — Mapping | **Mostly.** The counts indicate areas of work but are not themselves links/actions. The user still needs the next decision surface below. |
| Q4 — Feedback | N/A before action. |

### Step 2 — Decide whether the Editorial Plan or `Needs your attention` is the authoritative priority queue

**Repository-observed.** After the status cards, Today renders `AI Editorial Plan` with the heading `What is worth doing now?`. Only after the full recommendation block does it render `Needs your attention`. The backend `taskCount` is calculated from the latter `TodayAction` list, not from Editorial recommendations. Editorial copy states that recommendations are advisory and selection is not approval/publication.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Partly.** Both sections plausibly answer “what should I do now,” but only one represents current workflow obligations. |
| Q2 — Notice | **Yes, but competing.** The Editorial Plan is encountered first and can contain large evidence-rich cards and prominent CTAs. `Needs your attention` is lower on the page. |
| Q3 — Mapping | **Fragile.** The advisory sentence explains the authority boundary, but it does not explicitly say `Needs your attention` is the list counted by the Today headline or should take precedence for open decisions. |
| Q4 — Feedback | N/A until a card is chosen. |

**Likely novice failure hypothesis.** A novice selects a fresh optional Editorial recommendation while a waiting draft review, active conversation, or account constraint is the actual open decision they intended to resolve.

### Step 3 — Open a queued attention item

**Repository-observed.** `Needs your attention` cards have plain-language eyebrows (`Continue a conversation`, `Review a post`, `Account limitation`, `Next post`), titles, explanatory body text, and an action label. They link directly to the responsible surface.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Each card names the type of decision. |
| Q2 — Notice | **Yes.** Whole card is clickable and includes a button-like action label. |
| Q3 — Mapping | **Yes.** `Review draft`, `Open conversation`, `Review account status`, and `View publishing plan` map directly to the stated card purpose. |
| Q4 — Feedback | **Yes.** Navigation lands on the object/surface that owns the next action. |

### Step 4 — Determine whether anything urgent remains after completing the item

**Repository-observed.** Mutating workflow actions invalidate Today on successful completion; a later Today read recomputes `taskCount` and action cards from authoritative queue/health state.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Return to Today to see what remains. |
| Q2 — Notice | **Mostly.** There is no universal `Back to Today` action on all detail surfaces, but Today stays in persistent primary navigation. |
| Q3 — Mapping | **Yes.** Today is a stable top-level destination. |
| Q4 — Feedback | **Yes on successful actions.** Recomputed counts/cards reflect the new state. |

### Outcome

**Fragile — P1 priority-comprehension risk.** Once the user reaches `Needs your attention`, the individual task cards are strong. The failure risk is the preceding competition between an advisory section literally asking `What is worth doing now?` and the lower section containing the workflow obligations counted by the Today headline.

### Research questions

- Do first-time users choose `Needs your attention` when asked to resolve an already-open human decision?
- What distinction—ordering, naming, grouping, or explanatory copy—makes advisory opportunities versus obligations immediately legible?
- Do returning users rely on Today counts, Editorial ranking, or the first visible CTA when time-limited?

---

## Walkthrough 2 — Understand and act on an Editorial recommendation without confusing recommendation, selection, and approval

### Starting state

User is on Today and sees a suggested PREPARE or RESEARCH_MORE recommendation.

### Step 1 — Understand what the recommendation is

**Repository-observed.** The section is labeled `AI Editorial Plan`. It says recommendations are advisory and `Selection is not approval or publication`. Each card shows decision/format, title, thesis, `Why now`, `Why this format`, desired reader outcome, evidence/profile proof, risks/alternatives/AI provenance under disclosure, and source freshness above.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** User is evaluating whether the suggested story/action is worth selecting. |
| Q2 — Notice | **Yes.** Recommendation decision and primary CTA are visually obvious. |
| Q3 — Mapping | **Yes.** Why-now/format/evidence text provides a reason to accept, research, or dismiss. Bare potential scores add density but are not required to find the CTA. |
| Q4 — Feedback | N/A before action. |

### Step 2 — Predict what the CTA will do

**Repository-observed.** CTA is derived from recommendation state:

- `Draft this` for original/quote/thread;
- `Open conversation` for reply;
- `Prepare repost` for repost;
- `Open research` for RESEARCH_MORE;
- no select CTA for SKIP, while `Dismiss` remains available.

All these CTAs call editorial **selection**, not direct approval/publication/send.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Commit the recommendation to the appropriate workflow or dismiss it. |
| Q2 — Notice | **Yes.** One prominent blue CTA plus secondary `Dismiss`. |
| Q3 — Mapping | **Mostly.** Format-specific labels are understandable, and advisory copy states selection is not approval. However, `Draft this` suggests text generation, while this path only persists selection/routing and creates a draft scaffold. |
| Q4 — Feedback | N/A until click. |

**Likely novice failure hypothesis.** User expects `Draft this` to behave like Discover's `Draft original/quote/thread`, which does run initial AI generation when no draft exists.

### Step 3 — Select the recommendation

**Repository-observed.** `editorial.js::selectEditorialRecommendation` records selection provenance, routes the candidate, carries recommendation potential/routing/evidence linkage forward, changes recommendation status to selected, and returns the queue/draft identity. It does not grant human approval, save a publication schedule, publish, or send.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Move the recommendation into an actionable workflow. |
| Q2 — Notice | **Yes.** CTA switches to `Selecting…` while pending. |
| Q3 — Mapping | **Yes for route; fragile for generation.** Workflow route is correct, but `Draft this` overpromises writer execution. |
| Q4 — Feedback | **Yes.** Success navigates to Draft, Conversation detail, or Posts. On a later Today render the card shows `Selected · {format}` and links to the selected workflow. |

### Step 4 — Confirm that selection did not approve or publish

**Repository-observed.** The destination has separate states/actions:

- DraftEditor shows `Generate with AI` when selection produced only an empty scaffold;
- draft readiness/approval are separate controls;
- main-feed approval copy says `Approval is not publication`;
- reply send is only available in Conversation detail with explicit exact-send wording;
- Posts owns the publishing plan.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Continue preparing/reviewing the selected work. |
| Q2 — Notice | **Yes.** Destination exposes draft/gates/status rather than a success claim that it was published. |
| Q3 — Mapping | **Yes.** Separate controls reinforce the authority model. |
| Q4 — Feedback | **Yes.** No published/sent state appears from selection alone. |

### Outcome

**Pass on authority separation; P1 consistency defect on `Draft this`.** The current product makes recommendation → selection → later approval/publication a visible sequence. The weakness is not hidden authority; it is inconsistent action semantics between two surfaces that use “Draft.”

### Research questions

- Do users read the advisory/selection sentence before acting?
- Does `Draft this` create a false expectation that AI generation already happened?
- Are the six potential scores used as meaningful evidence or treated as opaque authority?

---

## Walkthrough 3 — Review a draft, understand blockers, approve it, and understand scheduling/publication

### Starting state

User opens a main-feed draft from Today, Discover, or Posts.

### Step 1 — Identify the exact content and current state

**Repository-observed.** DraftEditor leads with `Post draft`, title, pipeline label, queue status, quality score/approval threshold, AI generation action, and exact editable text. Completed output becomes read-only historical text.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Review/edit the exact text that may later be approved. |
| Q2 — Notice | **Yes.** Exact text and status are primary. |
| Q3 — Mapping | **Yes.** Editor controls operate on the current draft only. |
| Q4 — Feedback | **Yes.** Dirty state, debounced preview, pending state, and save/generation success update the editor. |

### Step 2 — Understand why the draft is or is not ready

**Repository-observed.** `GatePanel` lists failed writing checks, warnings, and required human confirmations. Quality feedback uses plain-language categories. As text changes, `/drafts/:id/preview` recalculates score/gates without persisting approval.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Fix blockers and verify wording/proof. |
| Q2 — Notice | **Yes.** Gate panel sits above the editor and failures use `Fix before approval`. |
| Q3 — Mapping | **Yes.** Failure text is tied to approval readiness; quality score and gate result are separate but explained. |
| Q4 — Feedback | **Yes.** Preview feedback updates from exact edited text. |

### Step 3 — Check readiness

**Repository-observed.** DraftPage renders final wording/proof confirmations and `Check readiness`/`Recheck readiness`. Adjacent copy says: `This checks whether the current draft is ready for human approval. It does not publish anything.`

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Verify whether the exact current draft can be approved. |
| Q2 — Notice | **Yes.** Readiness control is grouped with the confirmations. |
| Q3 — Mapping | **Yes.** Copy directly defines the action boundary. |
| Q4 — Feedback | **Yes.** Queue/draft state is invalidated on success and the next approval state appears when eligible. |

### Step 4 — Approve the main-feed draft

**Repository-observed.** When eligible, DraftPage/Posts show `Approve for publishing`, require the applicable confirmations, and say: `Approval is not publication.` Copy distinguishes `Automation may publish it at the planned time` from `Automation is off; nothing is auto-published.`

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Grant human approval to the exact publishable draft. |
| Q2 — Notice | **Yes.** Approval is the dominant green action once ready. |
| Q3 — Mapping | **Yes.** Action name and explanatory sentence match the approval goal without claiming publication. |
| Q4 — Feedback | **Yes locally.** The item becomes `Approved — not published yet` and DraftPage points to the publishing plan in Posts. |

### Step 5 — Find or change publication timing

**Repository-observed.** Draft detail does not edit the schedule. It says `The publishing plan lives in Posts`. Posts exposes recommended time, Ready/Not ready, manual/human source, urgency, expiry, optional chosen time, `Save plan`, `Why this time?`, and the global `Auto-publishing on/off` badge.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes after the handoff copy.** Understand/change when an approved post is eligible to publish. |
| Q2 — Notice | **Fragile.** User must leave Draft for Posts; persistent nav and an inline link exist, but schedule state is not co-located with the approved object editor. |
| Q3 — Mapping | **Yes in Posts.** `Save plan` and explanatory text state timing is separate from approval/publication. |
| Q4 — Feedback | **Yes on successful save.** Updated queue/schedule state is re-read. |

### Step 6 — Predict actual publication

**Repository-observed.** There is no ordinary React `Publish now` button. Main-feed publication is performed by existing automation only for approved/eligible work when that mode is enabled. Today and Posts surface automation state. Reposts are manual-only.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Know whether approval will result in automatic publication and when. |
| Q2 — Notice | **Mostly.** Automation badge and explanatory copy exist, but they are on Posts/Today rather than a single persistent draft header. |
| Q3 — Mapping | **Yes if the user follows the handoff.** Approval + eligible timing + automation are distinct prerequisites. |
| Q4 — Feedback | **Yes for normal states.** Posts has `Publishing`, `Published`, and `Publish failed` sections; DraftPage shows published output or `publishError`. Recovery from failure is weaker (Walkthrough 5). |

### Outcome

**Fragile — P1 recognition-versus-recall risk, not an authority-confusion failure.** The local copy around readiness and approval is strong. The weak point is distributed lifecycle ownership: exact draft → approval on Draft, then timing/automation on Posts, then publication state across Posts/Draft/Today. Occasional users must remember or re-learn the handoff.

### Research questions

- After one week away, can users distinguish `approved`, `ready at a recommended time`, `publishing`, and `published` without retracing multiple pages?
- Is the current Draft → Posts handoff enough, or do users need a single object-level lifecycle summary?
- When automation is on, does `Approve for publishing` still get misread as immediate publication despite the explanatory copy?

---

## Walkthrough 4 — Continue a conversation and understand prepare/review/send boundaries

### Starting state

User wants to continue an existing conversation or evaluate a new reply opportunity.

### Step 1 — Find the relevant conversation

**Repository-observed.** Primary navigation includes `Conversations`. The list separates `Active conversations` from `New opportunities`; page guidance says to continue existing conversations first. Cards show status, priority label, contribution, source snippet, relationship context, draft quality/expiry where available, and `Review reply` or `Review opportunity`.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Page copy directly frames the conversation task. |
| Q2 — Notice | **Yes.** Active versus new sections and review links are explicit. |
| Q3 — Mapping | **Yes.** Opening one item is the obvious next step. |
| Q4 — Feedback | **Yes.** Detail page identifies the target/source and current state. |

### Step 2 — Decide whether there is something useful to add

**Repository-observed.** Conversation detail leads with `What you can add`, relationship history, exact source text, status/expiry, and any unavailability reasons. Internal score components are moved into `Why this recommendation?` disclosure.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Decide whether this interaction is worth entering/continuing. |
| Q2 — Notice | **Yes.** Contribution and source are primary. |
| Q3 — Mapping | **Yes.** The recommendation is framed as a reason to act, not a send command. |
| Q4 — Feedback | N/A until draft/resolve action. |

### Step 3 — Prepare the reply

**Repository-observed.** If no draft exists, `Generate reply with AI` routes to reply, generates a draft, and returns the shared DraftEditor. Copy says the AI will prepare a draft and the user reviews exact text before approval. Existing drafts are editable/saveable; reply text is never scheduled.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Create/edit exact reply text. |
| Q2 — Notice | **Yes.** Generate button is primary when no draft exists; editor is primary afterward. |
| Q3 — Mapping | **Yes.** Preparation is visibly distinct from sending. |
| Q4 — Feedback | **Yes.** Generated text appears in the editor; save/gate feedback is visible. |

### Step 4 — Check readiness

**Repository-observed.** Final wording/proof confirmations plus `Check readiness`; note says it `does not send anything`.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Verify the exact reply. |
| Q2 — Notice | **Yes.** Readiness action is immediately below editor. |
| Q3 — Mapping | **Yes.** No send claim. |
| Q4 — Feedback | **Yes.** Updated state exposes the next send-capable control when eligible. |

### Step 5 — Send the reply

**Repository-observed.** When approval and send are combined, the primary button says `Approve & send exact reply`; adjacent text says `This sends the exact text above as a reply on X after your approval. Nothing sends until you click.` If approval already exists, the action is `Send approved reply`, with copy that the exact reply is already approved and will send on X.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Perform the remote reply send. |
| Q2 — Notice | **Yes.** Consequential action is prominent and exact. |
| Q3 — Mapping | **Yes.** Button and explanation name the remote consequence. |
| Q4 — Feedback | **Yes on normal success.** Success panel says `Reply sent` and authoritative result/status are re-read. Exceptional reconciliation is covered in Walkthrough 5. |

### Step 6 — Choose not to reply

**Repository-observed.** `More actions` offers `Make a quote post instead` for initial-reply opportunities, `Skip conversation`, and `No longer useful`. Quote reroutes without publishing; skip/expire resolve the engagement item.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Exit or change strategy without sending a reply. |
| Q2 — Notice | **Yes, secondary.** Alternatives are appropriately less prominent than draft/send. |
| Q3 — Mapping | **Mostly.** Labels are plain; terminal resolution is not explicitly described as irreversible in the UI. |
| Q4 — Feedback | **Yes on success.** Resolve navigates back to Conversations; quote opens/links to draft workflow. |

### Outcome

**Pass.** This is the strongest current consequential workflow. Prepare, readiness, approval, and send are visibly distinct; the remote send button describes the exact consequence. The main weakness is exceptional failure recovery, not normal-path comprehension.

### Research questions

- Do users understand `Relationship fit`/priority values, or ignore them in favor of `What you can add`?
- Does `Approve & send exact reply` produce the intended level of deliberate caution without unnecessary friction?
- Do users understand `Skip conversation` versus `No longer useful` as different terminal resolutions?

---

## Walkthrough 5 — Recover from a blocked or failed state: what failed, did anything change, and what is safe next?

### Scenario A — Ordinary validation/readiness block

**Repository-observed.** Gate failures are shown inline with `Fix before approval`; confirmations state what the human must review; quality feedback updates after edits; approval remains disabled/unavailable until conditions are met.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Make the draft ready. |
| Q2 — Notice | **Yes.** Failed checks and confirmations are visible near the editor. |
| Q3 — Mapping | **Yes.** Messages identify what to fix before approval. |
| Q4 — Feedback | **Yes.** Preview/review updates the current gate state. |

**Result:** pass for deterministic pre-action blockers.

### Scenario B — Page/query load failure

**Repository-observed.** Shared `Error` shows `Something went wrong`, the backend/client message, and optional `Try again`.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Mostly.** User knows the page failed to load. |
| Q2 — Notice | **Yes.** Error panel is explicit. |
| Q3 — Mapping | **Mostly.** `Try again` is available on query failures, but the message is not action-specific. |
| Q4 — Feedback | **Fragile.** There is no standardized statement of whether the last known data remains authoritative or what changed. |

### Scenario C — Remote reply succeeds partially but local reconciliation is incomplete

**Repository-observed.** `sendApprovedEngagementReply` deliberately distinguishes remote transport from local recording. If the remote post succeeds but no tweet id is returned, server state remains `publishing` and the API throws: the transport succeeded, there is no tweet id, and manual reconciliation is required. If remote identity exists but local recording fails, server state also remains `publishing` with the output identity and the API throws a published-but-recording-incomplete message.

`useConversationAction` invalidates Conversation/Today/Create queries only in `onSuccess`. These partial-success cases are delivered as mutation errors, so the currently rendered detail can retain the pre-send data snapshot until a subsequent read. The backend state guard prevents a normal repeat send because the item is no longer `approved`, but no dedicated React reconciliation action is presented.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Determine whether the reply actually reached X and recover without duplicating it. |
| Q2 — Notice | **Partly.** The backend error text can be precise, but it appears in a generic action-error panel. |
| Q3 — Mapping | **No complete recovery action.** The message can say manual reconciliation is required, but the UI does not provide a reconciliation control or explicit `inspect X / refresh authoritative state / do not resend` sequence. |
| Q4 — Feedback | **Fail.** Authoritative server state may already be `publishing`, while the current view can still display pre-action controls until another fetch. The user is told something exceptional happened but is not given a complete in-product next step. |

### Scenario D — Main-feed publication failed

**Repository-observed.** Posts has a `Publish failed` section; queue cards can expose the stored error. DraftPage displays `A publishing attempt failed. {error} The item remains inspectable for a human decision.` Main-feed publication is otherwise handled by automation rather than a React publish button.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes.** Decide what to do about a failed publication. |
| Q2 — Notice | **Yes.** `Publish failed` is a named lifecycle section and DraftPage surfaces the error. |
| Q3 — Mapping | **Fragile.** No dedicated retry/reconcile/abandon action is exposed in React; user needs backend/domain knowledge or another workflow change. |
| Q4 — Feedback | **Fragile.** Failure is visible, but the safe next action is not standardized. |

### Outcome

**Fail — P1 recovery defect.** Deterministic blockers are well explained. The failure is in exceptional post-action recovery: the product can accurately preserve remote/local divergence in backend state, but the React layer does not always refresh that authoritative state on mutation error or expose a direct reconciliation path.

This is **not classified P0** from repository evidence because backend state guards prevent a normal second send from an item that already moved to `publishing`; the current failure is blocked/uncertain recovery rather than an observed duplicate-write path.

### Research/operational questions

- How often do transport-succeeded/local-recording-incomplete states occur in real operation?
- What do users do when they see these messages today—refresh, inspect X, retry, or abandon?
- Is a forced authoritative refetch sufficient, or is a dedicated reconciliation workflow required?
- For main-feed `failed`, which failure classes are safely retryable versus reconciliation-only?

---

## Walkthrough 6 — From learning/research context, determine what style/intent appears to work and how future Off / Suggest / Apply should fit before draft generation

### Scope rule

This walkthrough evaluates the **current gap only**. `Off / Suggest / Apply` is a future contract in `UX_HCI_DEEP_RESEARCH_PROGRAM.md`; the current repository does not implement that draft-time strategy selector. No user preference, final IA, or fabricated UI is assumed.

### Step 1 — Inspect external style/intent evidence

**Repository-observed.** Viral Styles can run a retrospective external X study and show:

- supported/directional associations;
- AI communicative-intent groups;
- semantic presentation-style groups;
- niche/timing observations;
- high-performing stored posts;
- explicit caveats that associations are not causal X-ranking claims.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes for external evidence.** Identify patterns in the selected external dataset. |
| Q2 — Notice | **Yes after running research.** Findings are tabbed into Evidence, Intent & style, Niche & timing, Posts. |
| Q3 — Mapping | **Yes for inspection.** Evidence labels/caveats support retrospective judgment. |
| Q4 — Feedback | **Yes.** Run progress/checkpoints and final report state are visible. |

### Step 2 — Inspect what appears to work for this account

**Repository-observed.** Experiments/Improve shows explicit tests, descriptive evidence, and `What we've learned` rules derived from this account's measured work. Suggested rules have zero effect until accepted; accepted rules adjust bounded recommendation/scoring targets.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes for internal evidence.** Inspect account-specific measured patterns. |
| Q2 — Notice | **Yes.** `What we've learned` is a visible section. |
| Q3 — Mapping | **Mostly.** The surface explains what a learned change will affect, but this is production recommendation learning, not a draft-specific writing-strategy synthesis. |
| Q4 — Feedback | **Yes.** Suggestion/accepted/retired status is explicit. |

### Step 3 — Compare external evidence with internal evidence for one upcoming draft

**Repository-observed.** There is no current React surface that presents external Viral evidence and internal account evidence together for a selected candidate/draft. Viral Styles and Experiments are independent primary destinations. Today recommendation disclosure may contain measured/learned context, but it does not expose a writing-strategy synthesis with explicit evidence classes for draft generation.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes conceptually.** Decide whether a presentation pattern is relevant to this specific work item. |
| Q2 — Notice | **No current action/surface.** No current comparison/synthesis control exists. |
| Q3 — Mapping | **No.** User must mentally transfer findings across modules. |
| Q4 — Feedback | **No.** There is no persisted draft-level strategy choice to confirm. |

### Step 4 — Choose Off, Suggest, or Apply before generation

**Repository-observed.** A repository search of current React surfaces shows no `Off / Suggest / Apply` writing-strategy mode, no draft-level selected intent/style guidance, and no synthesis action connecting Viral/Improve evidence to DraftEditor. DraftEditor currently generates from its existing writer packet without this future mode.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Defined by source plan, not implemented.** Control whether learned style/intent guidance influences this draft. |
| Q2 — Notice | **No.** No current control exists. |
| Q3 — Mapping | **No.** There is nothing to select. |
| Q4 — Feedback | **No.** No mode/provenance state exists to display. |

### Step 5 — Generate and verify whether strategy influenced the draft

**Repository-observed.** Current DraftEditor exposes `Generate with AI`/`Regenerate with AI`, AI decision/risk flags, semantic anchors, evidence used, and AI draft details. It does not show a selected external/internal writing strategy or whether such a strategy was Off/Suggest/Applied.

| Question | Assessment |
| --- | --- |
| Q1 — Goal | **Yes for ordinary generation, not for strategy-controlled generation.** |
| Q2 — Notice | **Yes for generation; no for strategy state.** |
| Q3 — Mapping | **No for the future task.** User cannot attribute presentation choices to an explicit selected strategy mode. |
| Q4 — Feedback | **No for the future task.** Current provenance does not contain the future selection. |

### Outcome

**Current gap — task not supported in the current UI.** External Viral research and internal measured learning are both inspectable, but the user cannot currently synthesize them for a specific work item or select an `Off / Suggest / Apply` mode before generation.

This audit does **not** severity-rank the missing future selector as an existing unintended-action defect. It is recorded as the explicit gap required by the current mission/source plan. Later design must keep external evidence, internal account evidence, and production learned-rule authority distinct.

### Research questions

- Do users naturally compare external style/intent evidence with account-specific outcomes, or treat them as separate questions?
- Which evidence is sufficient for users to consider a presentation strategy credible?
- Where in the current flow do users expect to review optional strategy—before selecting a content type, after route selection, immediately before AI generation, or in the editor?
- Do users understand `Suggest` as zero writer effect until explicit strategy selection?
- What does `Apply` need to show so users understand it shapes presentation only and cannot override facts, content type, approval, timing, or send/publication authority?
- Should a selected strategy persist through regeneration/editing, and what evidence/provenance must remain visible to support later learning?

---

## Cross-walkthrough outcome summary

| # | Task | Outcome | Highest current issue |
| --- | --- | --- | --- |
| 1 | Determine what needs attention today and take the correct next step | **Fragile** | P1 — advisory Editorial Plan competes with the actual `Needs your attention` queue |
| 2 | Understand/act on Editorial recommendation without confusing recommendation/selection/approval | **Pass with consistency defect** | P1 — Today `Draft this` does not have the same generation effect as Discover `Draft …` |
| 3 | Review draft, blockers, approve, understand scheduling/publication | **Fragile** | P1 — lifecycle ownership is distributed across Draft, Posts, Today |
| 4 | Continue conversation and understand reply prepare/send | **Pass** | Normal authority boundary is clear; exceptional recovery deferred to #5 |
| 5 | Blocked/failed state: know what failed, what changed, safe recovery | **Fail** | P1 — partial remote/local failure can leave stale UI and no direct reconciliation path |
| 6 | Determine style/intent evidence and future Off/Suggest/Apply fit before generation | **Current gap** | External and internal evidence exist separately; no current draft-time synthesis/mode exists |

## Evidence anchors

- `ui/src/features/today/Today.tsx`
- `ui/src/features/discover/Discover.tsx`
- `ui/src/features/create/Create.tsx`
- `ui/src/features/create/DraftPage.tsx`
- `ui/src/features/create/DraftEditor.tsx`
- `ui/src/features/conversations/Conversations.tsx`
- `ui/src/features/conversations/ConversationDetail.tsx`
- `ui/src/features/viral/ViralStyles.tsx`
- `ui/src/features/improve/Improve.tsx`
- `ui/src/components/primitives.tsx`
- `ui/src/api/client.ts`
- `web_api.js`
- `editorial.js`
- `pipeline.js`
- `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md`
