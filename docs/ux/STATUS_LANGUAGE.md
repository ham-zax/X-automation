# Status, Error, and Recovery Language

This document is the repository owner for lifecycle, status, error, retry, and reconciliation vocabulary.

It defines **semantic states first**. Recommended display wording is guidance for prototypes and later implementation; it is not participant validation. Product/action/evidence semantics live in `docs/ux/PRODUCT_LANGUAGE.md`. Human-AI authority/presentation patterns live in `docs/ux/HUMAN_AI_INTERACTION.md`.

## Evidence discipline

- **Stable semantic contract** — the state meaning and authority boundary are fixed by current product behavior or Wave-1 synthesis.
- **Current baseline wording** — wording already used by the product. It may be retained in prototypes but is not automatically validated user language.
- **Prototype label** — candidate plain-language presentation whose comprehension still requires participant evidence.

No participant results are recorded here.

## Lifecycle principles

1. **Status names the current authority state, not the page that owns it.** A returning user should not need to remember whether Draft, Posts, Today, or Conversations owns the next step.
2. **Pending is not success.** `Publishing…`, `Sending…`, `Unfollowing…`, `Generating…`, and `Researching…` describe an operation in progress.
3. **Approval is not remote completion.** Approved work remains distinct from published/sent work.
4. **A plan is not a guarantee.** Recommended or human-chosen timing must not be phrased as guaranteed execution when automation/eligibility/transport still remain.
5. **Failure language must state remote-effect certainty.** `Failed` is not enough when a remote write may already have happened.
6. **Retry language is conditional.** Never offer a generic retry for a potentially completed remote write.
7. **Blocked states name the blocker and the unlock condition.** Do not hide deterministic requirements behind a generic score.
8. **Historical result states are durable.** Later edits or strategy changes must not rewrite what was actually published/sent/observed.

## Canonical authority/lifecycle sequence

Main-feed authored work:

`Recommended -> Selected/routed -> Drafting/generating -> Needs review/blocked -> Approved -> Waiting/planned -> Publishing -> Published`

Reply work:

`Recommended/opportunity -> Selected/routed -> Drafting/generating -> Needs review/blocked -> Approved -> Sending -> Sent`

Research:

`Ready to run -> Researching -> Complete | Stopped | Failed`

Measurement:

`Waiting for measurement -> Observed at window`

Learned recommendation:

`Suggested -> Accepted -> Retired`

These sequences describe semantics, not a required visual component or final IA.

## Core status vocabulary

### Advisory and human-choice states

| Semantic state | Recommended presentation | What it means | What has **not** happened | Safe next action | Retry | Wording status |
|---|---|---|---|---|---|---|
| Recommended / advisory | `Recommended` plus the suggested action | AI/system has produced advice based on current context/evidence. | Human has not selected it; no approval, schedule, send, or publish occurred. | Inspect why/evidence; select; research further; dismiss; choose another valid option. | Not a retry state. | **Stable semantic contract.** Exact heading such as `Recommendation`, `Plan`, or `Suggestion` remains a language question where Wave 1 flagged it. |
| Selected / routed | `Selected for {content type}` or `Chosen: {content type}` | Human has chosen the workflow/content treatment to pursue. | Content is not approved or public merely because it was selected. AI generation may or may not have occurred; state must say separately. | Generate/edit the draft, research, or change route while reversible. | Not a retry state. | Semantic stable; exact user-facing selection label remains provisional. |
| Dismissed / skipped | `Dismissed`, `Skipped source`, or object-specific equivalent | Human chose not to pursue this recommendation/source/conversation in current work. | Historical source/evidence is not necessarily deleted; no public action occurred. | Reopen only where the object contract supports it; otherwise inspect history. | Not a retry state. | Semantic stable; object-specific wording required. |

### Drafting, checking, and approval states

| Semantic state | Recommended presentation | What it means | What has **not** happened | Safe next action | Retry | Wording status |
|---|---|---|---|---|---|---|
| Drafting | `Draft in progress` | Editable candidate wording exists or the item is in an authored-content workflow. | No approval or remote publication/send is implied. | Edit, save, generate/regenerate, inspect evidence. | Generation retry has different consequences from save; do not use one generic retry. | Semantic stable. `Draft in progress` is current baseline wording. |
| Generating | `Generating draft…` / `Regenerating draft…` | AI generation is actively producing/replacing candidate wording. | Generation has not completed; nothing is approved/public. | Wait for completion; preserve/resolve unsaved-edit warnings before regeneration. | Do not start duplicate generation while current request is unresolved unless the owner explicitly supports cancellation/retry. | Semantic stable. |
| Needs review | `Needs review` with exact next requirement nearby | Current draft requires human review/readiness work before approval. | No human approval; no send/publish. | Inspect exact text, blockers, facts/evidence confirmations; check readiness. | Not normally a retry state. | Semantic stable; `Needs review` is current baseline but final comprehension still requires participant testing. |
| Blocked by writing check | `Fix before approval: {plain reason}` | Deterministic content rule prevents approval. | Human approval and remote action have not occurred. | Edit the content or resolve the actual blocker. | Retrying the same unchanged check is not a recovery strategy. | Semantic stable; blocker copy is object-specific. |
| Blocked by evidence/confirmation | `Supporting proof must be checked before approval` / `Fact confirmation required` | Required human confirmation/evidence condition is unmet. | Approval/send/publish has not occurred. | Inspect proof, confirm only when warranted, or change unsupported wording. | Do not “retry” around a missing confirmation. | Semantic stable; exact confirmation labels remain copy candidates. |
| Blocked by account/policy state | `Sending is temporarily unavailable` or specific consequence | A deterministic account/eligibility condition prevents the action. | The blocked remote action did not start through this control. | Resolve/check the account condition or choose another allowed task. | Retry only after authoritative state shows the blocker cleared. | Semantic stable. |
| Approved | `Approved — not published yet` for main feed; `Approved — ready to send` for replies | Human approved the exact current content under the relevant confirmations. | Main-feed publication has not necessarily happened; reply send has not happened until explicit send/combined action completes. | Main feed: inspect publishing plan/wait. Reply: send exact approved reply when appropriate. | Approval is not a generic retry state. Editing may invalidate approval. | Semantic stable; the explicit suffix is preferred over bare `Approved` where consequence could be ambiguous. |

### Timing and remote-action states

| Semantic state | Recommended presentation | What it means | What has **not** happened | Safe next action | Retry | Wording status |
|---|---|---|---|---|---|---|
| Recommended time | `Recommended for {time}` | Scheduler recommends an eligible time. | Human has not necessarily chosen that time; publication is not guaranteed or completed. | Accept/override timing where supported; inspect why. | Not a retry state. | Semantic stable. |
| Human-chosen time | `Planned for {time}` plus `You chose this time` | Human saved a timing override/plan. | The post is not necessarily published; automation/eligibility/transport still govern execution. | Change/clear plan while allowed; wait or inspect automation status. | Not a retry state. | Semantic stable; `Planned for` is a prototype label. Test whether users read `scheduled` as guaranteed. |
| Approved and waiting | `Approved — waiting for {time/automation}` | Exact content is approved but transport has not started. | Not public yet. | Wait, change valid plan, or inspect publishing mode. | No remote retry is relevant because transport has not started. | Semantic stable; exact label remains prototype wording. |
| Publishing | `Publishing…` | A main-feed remote publication attempt is in progress or the owner has intentionally kept the item in the publishing/reconciliation state. | Confirmed publication is not yet represented. | Wait for authoritative result; if state becomes uncertain, follow reconciliation guidance. | **Unsafe to offer ordinary publish retry while unresolved.** | Semantic stable. Current baseline uses `Publishing`. |
| Sending | `Sending reply…` | Reply transport is in progress or unresolved after send started. | Confirmed sent result is not yet represented. | Wait for authoritative result; reconcile if uncertain. | **Unsafe to offer ordinary resend while unresolved.** | Semantic stable. Current baseline uses `Sending…` pending copy. |
| Published | `Published` plus time/link when known | X publication is authoritatively represented with remote identity/result. | Nothing higher in publication authority remains. Later measurement may still be pending. | View result; inspect later measurements; no backward reroute/discard. | Do not publish again as “retry.” | Semantic stable. `Published` is an effect term. |
| Sent | `Sent` / `Reply sent` plus link when known | X reply is authoritatively represented with remote identity/result. | Nothing higher in send authority remains. Later conversation outcomes may still be unknown. | View conversation/result; wait for later response/outcomes. | Do not resend as “retry.” | Semantic stable. |
| Manual repost recorded | `Repost recorded` / `Marked as reposted` | Human confirmed they already reposted on X; app recorded completion. | The app did not perform the repost transport. | View history/source; no further app transport. | Not a retry state. | Semantic stable; exact label contextual. |

## Failure and reconciliation states

Do not map every low-level error to `Failed before remote effect`. That semantic state requires evidence from the operation owner that no remote write occurred.

### Failure class A — known pre-remote failure

**Canonical meaning:** the operation failed before the remote side effect began, or the authoritative owner can prove no remote write occurred.

**Recommended presentation:**

> **{Action} did not start/complete.** Nothing was {sent/published/unfollowed} on X. {Current state}. You can {safe next action}.

**Retry:** safe only if the owner explicitly classifies the operation as retryable and the current state still permits it.

**Do not use** this class merely because a network/API call returned an error. A timeout/connection error may be ambiguous unless the transport contract proves otherwise.

### Failure class B — remote effect uncertain; reconciliation required

**Canonical meaning:** a public/remote write may already have happened, but the product cannot prove the final state.

**Recommended presentation:**

> **We could not confirm the final {send/publication} state.** The action may already have reached X. Current recorded state: `{state}`. Check the current state/verify on X before trying again. **Do not resend/republish yet.**

**Retry:** unsafe/unknown until reconciliation establishes that repeating the remote write will not duplicate the action.

This is the required semantic treatment for partial-success or ambiguous transport cases.

### Failure class C — remote effect confirmed; local recording incomplete

**Canonical meaning:** the remote action is known to have happened, but one or more local follow-up writes failed.

**Recommended presentation:**

> **{Reply/Post} reached X, but local recording is incomplete.** {Remote link/ID if known}. Current recorded state: `{state}`. Do not {send/publish} again. Reconcile the local record.

**Retry:** remote retry is **unsafe** because it would risk duplication. Only the local reconciliation operation may be retryable.

Current backend examples include:

- reply posted with a known tweet ID but local recording failed;
- main-feed transport succeeded but publication-state or later local action recording is incomplete;
- transport completed without a usable root tweet ID, leaving remote completion uncertain and requiring manual reconciliation.

### Failure class D — deterministic/precondition failure

**Canonical meaning:** the requested transition was rejected before its required state/confirmation was satisfied.

Examples:

- exact reply changed after approval, invalidating approval;
- evidence/factuality confirmation missing;
- account constraint blocks send;
- research configuration is incomplete.

**Recommended presentation:** name the violated requirement and the next valid action. Do not use a generic retry CTA.

## Retry-safety matrix

| Operation class | Default retry guidance | Why |
|---|---|---|
| Read-only page/query fetch | `Try again` is generally appropriate. | Repeats a read, not a consequential remote write. |
| Source/performance refresh | May retry when the read/refresh owner says it is safe; state what upstream data will be re-read. | No publish/send authority, but it may incur work/cost and replace freshness state. |
| AI generation | `Generate again`/`Regenerate` only with clear replacement/cost semantics and no unresolved concurrent generation. | Public-action safe, but it can replace draft text and spend AI resources. |
| Deterministic readiness check | Re-run after content/confirmation changes; avoid generic `Try again`. | Repeating unchanged input does not resolve the blocker. |
| Local selection/schedule/config mutation | Prefer an authoritative re-read before retry unless the owner guarantees idempotency. | The first mutation may already have persisted even if the client did not observe success. |
| Send/publish with **known no remote effect** | Retry may be offered after authoritative state confirms retry eligibility. | Duplicate remote action is ruled out by owner evidence. |
| Send/publish with **uncertain remote effect** | **Do not retry. Reconcile first.** | Duplicate public action risk. |
| Send/publish with **confirmed remote effect/local incomplete** | **Do not repeat remote action.** Retry only reconciliation/local recording if supported. | Remote action already happened. |
| Unfollow pending/uncertain | Do not issue another unfollow until X/local state is authoritative. | One-account consequential remote action; current contract requires confirmed success before local removal. |

`Try again` is therefore not a universal error button. It is appropriate only when the repeated operation and its side effects are understood.

## Error-message anatomy

For consequential operations, compose the message in this order:

`What failed -> What may already have changed -> Current authoritative state -> Safe next action -> Retry/reconciliation guidance`

### Required fields

1. **What failed**
   - Name the operation, not just `Something went wrong`.
   - Example: `We could not confirm the reply send.`
2. **What may already have changed**
   - `Nothing was sent` only when known.
   - `The reply may already have reached X` when uncertain.
   - `The reply reached X` when remote identity confirms it.
3. **Current authoritative state**
   - Example: `Current recorded state: Publishing.`
   - If the current client view may be stale, say that an authoritative refresh is required rather than presenting stale controls as current.
4. **Safe next action**
   - Example: `Verify the reply on X and refresh status.`
5. **Retry/reconciliation guidance**
   - `You can retry` only when safe.
   - `Do not send again yet` when uncertain.
   - `Do not send again; reconcile the local record` when remote success is known.

### Message templates

**Read failure**

> **Could not load {object}.** No action was taken. Try loading it again.

**Known validation block**

> **This draft is not ready for approval.** {Specific blocker}. Fix or confirm that item, then check readiness again. Nothing has been published.

**Known pre-remote failure**

> **The {send/publish} did not start.** Nothing was {sent/published} on X. The item is still {state}. You can try again after {condition}.

Use only when no-remote-effect evidence is real.

**Uncertain remote result**

> **We could not confirm whether the {reply/post} completed on X.** It may already be public. Current recorded state: {state}. Verify the result and refresh the current state before doing anything else. **Do not {send/publish} again yet.**

**Remote success, local recording incomplete**

> **The {reply/post} reached X, but the product could not finish recording it.** {Link/ID if known}. Do not {send/publish} again. Reconcile the local record.

**Research failure**

> **Research stopped because {stage} failed.** Findings from this run may be incomplete. Previously stored evidence remains separate. Review the error, then start a new run only if you want to collect again.

**Measurement unavailable/delayed**

> **The {window} measurement is not available yet.** The post remains published; only this outcome observation is missing/delayed. Check again later or refresh metrics when appropriate.

## Research lifecycle

| Semantic state | Recommended presentation | Meaning | What has not happened | Safe next action | Retry | Wording status |
|---|---|---|---|---|---|---|
| Ready to run | `Ready to run research` / idle | Scope is configured; no research job is active. | No new collection has started. | Review scope; start explicitly. | N/A. | Semantic stable; label contextual. |
| Researching | `Researching…` plus real checkpoint | Bounded collection/AI analysis is active. | Final report for this run is not complete. | Watch progress; use stop-after-current-unit when needed. | Do not start a duplicate run while active. | Semantic stable. |
| Stopping | `Stopping after current unit…` | Stop requested; current bounded unit may complete first. | Job has not necessarily stopped yet. | Wait for stopped/complete state. | Not a retry state. | Semantic stable. |
| Research stopped | `Research stopped` | Operator-requested stop completed between bounded units. | Run is not a full completed sweep. | Review what was collected with run provenance; start a new run if more evidence is needed. | Starting a new run is a new action, not a retry of remote publication. | Semantic stable. |
| Research complete | `Research complete` | Bounded run reached its completion checkpoint. | Evidence is not thereby causal or universally applicable. | Review findings/limitations. | N/A. | Semantic stable. |
| Research failed | `Research failed` plus failed stage | Job ended unexpectedly. | Final run completeness is not established. | Inspect stage/error and preserved evidence; start a new run only deliberately. | May be safe to start another read-only research run, but state cost/scope and do not hide partial data. | Semantic stable. |

## Measurement states

Publication and measurement are different lifecycles. A post can be `Published` while later outcome windows remain pending.

| Semantic state | Recommended presentation | Meaning | What has not happened | Safe next action | Wording status |
|---|---|---|---|---|---|
| Measurement waiting | `Waiting for {15m/1h/6h/24h} measurement` | The publication exists, but the target observation window has not been captured yet. | No valid measurement for that window exists. | Wait/check after the window; do not fabricate zero values. | Semantic stable; exact compact label contextual. |
| Measurement observed | `Measured at {window}` / `Latest observed at {window}` | A real measurement was captured for the target window. | Causality is not established by measurement alone. | Review values, attribution context, sample/limitations. | Semantic stable. |
| Measurement unavailable | `Measurement unavailable` plus reason | Capture could not produce a valid observation. | No valid outcome value should be shown as zero. | Retry/read later only if the measurement owner permits; preserve publication state. | Semantic stable. |

## Learned recommendation states

| Semantic state | Recommended presentation | Meaning | What has not happened | Safe next action | Retry | Wording status |
|---|---|---|---|---|---|---|
| Learned suggestion | `Suggested change` / `Suggestion` | Qualified evidence produced a bounded proposed adjustment. It has zero production effect. | Change has not been accepted/applied to recommendation logic. | Inspect evidence/effect; accept if eligible or leave inert. | N/A. | Semantic stable; exact display noun remains language-sensitive. |
| Learned accepted | `Accepted change` | Human accepted the bounded learned rule; it may influence matching recommendation logic within domain bounds. | It has not become a hard gate; it did not approve/publish/send anything; causal truth is not established. | Monitor evidence/review signals; retire when no longer appropriate. | Do not “accept again” as retry. | Semantic stable. |
| Learned needs review | `Needs review` plus reason | Accepted/suggested learning has stale/reversed/changed supporting context. Effect may be suspended according to domain rules. | Continued reliability is not assumed. | Review newer evidence; retire when recommended/appropriate. | N/A. | Semantic stable; pair with object name to avoid confusion with draft review. |
| Learned retired | `Retired change` / `Past learning` | Learned rule has zero production effect and is retained as history. | It is not active. | Inspect history; create a new suggestion from current evidence if needed. | Do not reactivate by generic retry. | Semantic stable. |

## Action-result copy pairs

The status after an action must confirm the **specific authority actually reached**.

| Action | Immediate pending/result language | Do not jump directly to |
|---|---|---|
| Select recommendation | `Selecting…` -> `Selected for {workflow}` | `Draft ready`, `Approved`, `Published` unless those actions truly occurred. |
| Generate draft | `Generating draft…` -> `Draft generated`/editable draft state | `Ready`, `Approved`, `Published`. |
| Check readiness | `Checking readiness…` -> `Ready for approval` or specific blocker | `Approved`. |
| Approve main-feed text | `Approving…` -> `Approved — not published yet` | `Publishing`, `Published`. |
| Save publishing plan | `Saving plan…` -> `Planned for {time}` | `Scheduled` as guaranteed execution, `Publishing`. |
| Send approved reply | `Sending reply…` -> `Reply sent` only on authoritative result | `Sent` on local request completion alone. |
| Main-feed automation transport | `Publishing…` -> `Published` only on authoritative result | `Published` before remote identity/result. |
| Record manual repost | `Recording…` -> `Repost recorded` | `Reposted by the app`. |
| Unfollow | `Unfollowing…` -> remove/update only after confirmed X/local success | Optimistic local removal. |
| Accept learned change | `Accepting…` -> `Accepted change` | `Applied to this draft`, `Approved`, `Published`. |
| Start research | `Starting…` -> `Researching…` with real checkpoint | `Complete` until actual complete checkpoint. |

## Prototype-label questions still requiring participants

The semantics above are fixed; these display-word choices remain open:

- Does `Needs review` distinguish human review from deterministic `Check readiness` clearly enough?
- Does `Approved — not published yet` remain understandable when main-feed automation is enabled?
- Does `Planned for` communicate timing without the guarantee implied by `Scheduled`?
- What phrase most strongly prevents unsafe retry when remote effect is uncertain: `Needs reconciliation`, `Check current state`, `Verify before retrying`, or another participant-derived phrase?
- Do operators reserve `Send` for replies and `Publish` for main-feed posts?
- What words distinguish a learned suggestion needing review from a draft needing review without context loss?
- Which compact phone-sized labels preserve the same consequence distinctions without relying on explanatory subtext?

Do not convert these questions into validated terminology until real participant evidence exists.