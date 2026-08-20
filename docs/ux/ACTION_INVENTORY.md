# Current React Consequential Action Inventory

**Audit date:** 2026-08-20
**Baseline:** `004f7fc`
**Scope:** user-visible React actions that mutate workflow, remote account state, persisted research/configuration, or learned behavior. Pure navigation, filtering, disclosures, and read-only inspection are omitted unless they are necessary to explain a consequential boundary.

## Evidence discipline

- **Repository-observed** effects below are traced from the React control through `ui/src/api/client.ts` into the current API/domain owner.
- **Likely novice misinterpretation** is an inference, not user-research evidence.
- **Research questions** appear at the end.

## Authority boundary summary

**Repository-observed.** These are different actions in the current system and should not be collapsed conceptually:

| Boundary | Current authoritative meaning |
| --- | --- |
| Recommendation | Advisory AI output. It does not create approval/publication/send authority. |
| Selection | Persists human selection provenance and routes a candidate into a workflow. For text routes it creates a draft scaffold; it does not itself approve, schedule, publish, or send. |
| Draft generation | Runs the configured writer and saves generated candidate text. Generation does not approve, schedule, publish, or send. |
| Readiness review | Re-evaluates the exact current draft plus required confirmations and moves/keeps the item in review state. It does not approve or publish/send. |
| Main-feed approval | Records explicit human approval of the exact current draft/repost route. It does not itself publish. |
| Scheduling | Persists timing/urgency/expiry choices and recomputes an advisory schedule decision. It does not approve or publish. |
| Main-feed publication | No ordinary React `Publish now` action exists. Approved, eligible main-feed work can be published by the existing automation path when `AUTO_POST` is enabled. |
| Reply send | A remote X write. `Approve & send exact reply` combines approval and send; `Send approved reply` sends an already-approved exact reply. |
| Manual repost completion | The repost happens outside the app on X. `Mark reposted` only records that the human says it already happened. |

## Today — Editorial Plan

| Visible action | Location | Repository-observed authoritative effect | Reversibility / recovery | Likely novice misinterpretation — **inference** |
| --- | --- | --- | --- | --- |
| `Refresh sources & recommendations` | Today → AI Editorial Plan | `POST /editorial/refresh`; optionally refreshes source snapshots, runs the editorial plan for the selected objective, then returns the latest plan | Can run again; it updates current research/recommendation state rather than content authority | May be read as a harmless page refresh rather than an explicit source-fetch + AI editorial pass |
| `Draft this` | PREPARE recommendation for original/quote/thread | Calls editorial `select`; records selection provenance, routes the queue item, links evidence/sources, and creates a draft scaffold through `routeCandidate`; **does not run writer generation** | Workflow route can still be changed before publishing; selection provenance remains and the recommendation can no longer be dismissed | The label strongly suggests that a written draft will be produced immediately; Discover's similarly named Draft actions actually do initial generation |
| `Open conversation` | PREPARE reply recommendation | Selects the recommendation and routes the candidate into reply/engagement workflow, then opens Conversation detail | Can resolve or reroute before publication; selection provenance remains | Could be read as navigation-only even though it records a selection and changes workflow state |
| `Prepare repost` | PREPARE repost recommendation | Selects recommendation and routes candidate to main-feed repost workflow; no repost occurs | Re-route before completion; selected provenance remains | Could be read as creating X-side repost state; it only prepares local workflow |
| `Open research` | RESEARCH_MORE recommendation | Selects recommendation and routes candidate to `research`; manual/external research remains required | Later routing can change after research; selection provenance remains | The label sounds like opening a research viewer, but the action also persists selection/routing |
| `Dismiss` | Suggested Editorial recommendation | Marks recommendation `dismissed`; selected recommendations cannot then be dismissed | No visible undo on Today | May be read as hiding a card locally rather than changing persisted recommendation status |
| `Add source` | RESEARCH_MORE recommendation | Persists a research-evidence row tied to the editorial story/recommendation | Evidence remains part of provenance; no delete control is present here | May be read as a temporary note; it becomes persisted evidence used by the recommendation context |

## Discover

| Visible action | Location | Repository-observed authoritative effect | Reversibility / recovery | Likely novice misinterpretation — **inference** |
| --- | --- | --- | --- | --- |
| `Refresh source` | Refreshable X/GitHub/HN feed | Fetches and persists the selected source snapshot | Can refresh again; source errors retain prior/fallback visibility | Usually predictable; risk is mainly mistaking fetch failure for loss of prior snapshot |
| `Draft original` | Candidate card | Routes as `original`; creates draft scaffold; if no prior draft exists, runs initial AI writer generation and saves generated draft | Reroute/edit/discard before publishing | Same “Draft” concept as Today has a different effect: this control may actually generate text |
| `Draft quote` | X candidate card | Routes as `quote`; initial AI generation when no prior draft | Reroute/edit/discard before publishing | Same inconsistency as above; also “Quote” is local workflow, not an immediate X quote post |
| `Draft thread` | Candidate card | Routes as `thread`; initial AI generation when no prior draft | Reroute/edit/discard before publishing | Could be read as starting a manual editor only; it can invoke AI immediately |
| `Draft reply` | X candidate card | Routes to reply engagement workflow; initial AI generation when no prior draft | Resolve/reroute before send | Could be read as a harmless draft action; it also creates engagement workflow state |
| `Reopen as …` | Skipped candidate | Calls the same route actions as above, replacing ignored state with the chosen active route | Can reroute again before publishing | Generally explicit; the prior “skipped” decision is no longer the active resolution |
| `Bookmark` / `Remove bookmark` | Candidate card | Persists candidate saved flag | Directly reversible | Low consequence; may be mistaken for workflow selection, but it does not route or draft |
| `Discard draft` | Candidate with draft | After confirmation, deletes the draft, clears its draft id and main-feed schedule/approval fields, and returns main-feed item to triage; engagement item stays in reply drafting with no draft | Destructive text loss; source/history remain; user must recreate/regenerate | “Discard draft” accurately names text loss, but the associated workflow/schedule reset is broader than deleting editor text |
| `Skip source` | Active candidate | Routes candidate to `ignore` with a recorded reason | UI exposes `Reopen as …`; source/bookmark/history remain | Could be read as hiding only the current feed card rather than changing active workflow resolution |

## Posts / main-feed workflow

| Visible action | Location | Repository-observed authoritative effect | Reversibility / recovery | Likely novice misinterpretation — **inference** |
| --- | --- | --- | --- | --- |
| `Apply` | Posts → `Next step` route selector | Immediately calls `/queue/route` with the selected pipeline; clears prior human approval and resets workflow status according to the route; text routes create/reuse a draft scaffold | Can reroute again until publishing/published; may replace incompatible draft scaffold when changing text type | `Apply` does not state what is being applied. It is a route/content-type state change, not a visual preference |
| `Research further` → `Apply` | Posts → `Next step` | Routes the source to `research`; queue status becomes `researching`; no draft approval/publication occurs | User can later choose another route before publishing | Could be read as opening a research viewer rather than changing the active workflow state |
| `Pause` → `Apply` | Posts → `Next step` | Routes the source to `watch`; queue status becomes `watching` / `On hold` so it stops competing with active decisions | User can later choose another route | The visible word `Pause` is plain language; the persistent consequence is an on-hold workflow state, not a temporary UI pause |
| `Skip source` → `Apply` | Posts → `Next step` | Routes the source to `ignore`; queue status becomes ignored/skipped and prior approval is cleared | User can later reroute from another surface before publication; no one-click undo appears on this card | Could be read as hiding the card only rather than changing the source's active workflow resolution |
| `Save plan` | Publishing plan | Persists human schedule/expiry/urgency fields and recomputes current scheduler recommendation | Can save a different plan; no publication occurs on click | Could be confused with scheduling a guaranteed future publish; actual publication still depends on approval, eligibility, and automation mode |
| `Check readiness` / `Recheck readiness` | Approval readiness | Runs draft review with confirmations and persists review/gate result; does not approve/publish | Re-run after edits/confirmations | Strong local explanatory copy reduces risk; main possible confusion is treating a passed check as approval |
| `Approve for publishing` | Needs-review original/quote/thread | Re-scores exact draft with confirmations, requires publishable result, stores human approval and exact ready draft, moves queue item to `approved` | Editing/rerouting later invalidates approval; no publication occurs on click | The phrase can still be conflated with publishing by users who skip the adjacent explanation, especially when automation is on |
| `Approve repost` | Needs-review repost | Marks the repost workflow approved; it does not repost on X | Can reroute before completion; no remote write occurs | Could be interpreted as authorizing the app to repost automatically, although reposts are manual-only |
| `Mark reposted` | Approved repost | Requires explicit completion confirmation, marks item published/completed, and records a `repost` action; **does not call X to repost** | Local record can only be corrected through deeper reconciliation; UI asks for confirmation first | A user may click before actually reposting; the control and confirmation explicitly warn against this |
| `Discard draft` | Queue card | Same destructive draft deletion/reset as Discover | Source/history preserved; draft content is not | Can be understood as text-only deletion even though schedule/approval state is also cleared |

### Main-feed publication itself

**Repository-observed.** The current React shell does not expose a direct main-feed publish button. `AUTO_POST` is read by the server and surfaced as `Auto-publishing on/off`. The scheduler/automation path is the authority that may take an approved eligible main-feed item through `publishing` to `published`. Consequently:

- approval is not publication;
- a recommended or manually saved time is not publication;
- `AUTO_POST=false` means due approved work remains un-published by automation;
- reposts remain manual regardless of this path.

## Draft editor and draft detail

| Visible action | Location | Repository-observed authoritative effect | Reversibility / recovery | Likely novice misinterpretation — **inference** |
| --- | --- | --- | --- | --- |
| `Generate with AI` | DraftEditor | Runs writer generation and saves new draft content/metadata | User can edit or regenerate; no authority state is granted | Mostly clear; AI may return `DO_NOT_POST` advisory while still leaving editable generated text |
| `Regenerate with AI` | DraftEditor | Replaces draft with a new generated candidate; dirty unsaved edits require browser confirmation before replacement | Previous unsaved edits are not recoverable; saved history is not presented as versions | Confirmation correctly names unsaved replacement risk |
| `Save changes` | DraftEditor | Persists exact text/media-plan fields and recomputes gates/quality; routes item in same pipeline; does not publish | Continue editing/saving | Strong explanatory copy; low misinterpretation risk |
| `This post needs a visual before publishing` + visual fields | DraftEditor disclosure | Changes local editor state; becomes persisted only on `Save changes`; required visual can block publishing because attachment path is not implemented here | Toggle/edit before/after save until publication | User may believe a file has been attached; UI explicitly says visual plans do not attach files yet |
| `Check readiness` / `Recheck readiness` | DraftPage | Same queue review action described above | Re-run after correction | Low risk due explicit “does not publish anything” copy |
| `Approve for publishing` | DraftPage main-feed draft | Same main-feed approval boundary described above | Approval can be invalidated by subsequent content/route changes | Local copy explicitly says approval is not publication and points to Posts for plan |
| `Go to conversation` | Reply DraftPage | Navigation only; send authority is intentionally not on standalone reply DraftPage | N/A | Useful handoff; requires remembering that reply send lives elsewhere |

## Conversations / replies

| Visible action | Location | Repository-observed authoritative effect | Reversibility / recovery | Likely novice misinterpretation — **inference** |
| --- | --- | --- | --- | --- |
| `Generate reply with AI` | Conversation detail with no draft | Routes candidate to reply, creates draft if needed, runs initial AI generation, then returns editor data | Edit/regenerate/resolve before send | Clear that generation precedes review and approval |
| `Check readiness` / `Recheck readiness` | Conversation detail | Persists readiness/gate result only; does not send | Re-run after correction | Copy explicitly says no send |
| `Approve & send exact reply` | Conversation detail | Requires account send allowed; approves the exact draft with human confirmations and immediately calls X reply transport | Remote post is consequential and not undoable in this UI; backend preserves failure/reconciliation state | Label and adjacent text are unusually explicit; low semantic ambiguity |
| `Send approved reply` | Conversation detail | Sends an already human-approved exact reply to X | Remote post is consequential and not undoable in this UI | Explicit label and copy reduce ambiguity |
| `Make a quote post instead` | More actions | Re-routes an initial reply opportunity to main-feed quote; creates/reuses quote draft scaffold but does not publish | Can edit/reroute/discard before publishing | Could be read as posting a quote immediately; it only changes workflow route |
| `Skip conversation` | More actions | Resolves engagement item as `ignore` | No visible undo in Conversations | Could be read as hiding the card only; it changes terminal engagement resolution |
| `No longer useful` | More actions | Resolves engagement item as `expire` | No visible undo in Conversations | Similar risk: terminal workflow resolution rather than view-only cleanup |

### Reply failure/reconciliation boundary

**Repository-observed.** `pipeline.js::sendApprovedEngagementReply` can return several materially different outcomes:

- transport failure → queue becomes `failed`, approval/exact approved text are cleared;
- remote transport succeeds but no tweet id is returned → queue remains `publishing` for manual reconciliation and the API throws an explicit error;
- remote post succeeds but local recording later fails → queue remains `publishing` with remote identity when available and the API throws an explicit reconciliation error;
- full success → queue/draft become `published` and action/relationship history is recorded.

`useConversationAction` invalidates current queries on success, not on mutation error. Therefore a server-side transition to `publishing` that is reported as an error can leave the current React controls showing the pre-action snapshot until another fetch. Backend state guards prevent a normal second send, but the visible recovery path is incomplete.

## Performance and Audience

| Visible action | Location | Repository-observed authoritative effect | Reversibility / recovery | Likely novice misinterpretation — **inference** |
| --- | --- | --- | --- | --- |
| `Refresh account metrics` | Performance | Fetches current account performance and records a snapshot when fetch succeeds | Refresh again; no account write | Low consequence; “refresh” is accurate |
| `Ask AI to review following` | Audience quality | Sends current following/niche/relationship context to configured Audience-review AI and persists suggestions; AI cannot unfollow | Run again; suggestions are advisory | Strong explanatory copy reduces automation confusion |
| `Unfollow` | Audience profile row | Client sends explicit `confirmUnfollow: true`; backend starts one job; `audience.js` calls X unfollow for that exact account; local follow state changes only after X reports success | User could manually follow again on X; no in-product undo. Pending state is shown. | The action is genuinely remote/consequential. Existing `HUMAN_AI_INTERACTION.md` explicitly specifies one account per click and **no confirmation popup required**; popup absence is therefore not treated as a defect in this audit |

## Experiments and learned changes

| Visible action | Location | Repository-observed authoritative effect | Reversibility / recovery | Likely novice misinterpretation — **inference** |
| --- | --- | --- | --- | --- |
| `Create test` | Experiments | Persists a test with declared variants/metric/population and chosen draft/active status | Test can later be completed; creation does not assign/publish | Copy explicitly says no assignment/approval/scheduling/publication |
| `Activate test` | Draft test | Changes test status to active so it may receive explicit assignments | Later `Complete test` stops assignments | Low ambiguity |
| `Assign option` | Active test | Explicitly attaches selected test variant to one assignable queue item; no randomization or duplicate post | Assignment history persists; no UI unassign action is shown | Users may overread “test” as randomized A/B behavior; UI explicitly denies randomization |
| `Complete test` | Active test | After confirmation, changes status to completed; no new assignments | No reopen control is shown here | Clear confirmation names consequence |
| `Check for a pattern` | Learning section | Compares explicitly selected test variants at the chosen window and may persist a **suggested** learned rule; suggestion has zero effect | Re-run with another declared comparison/window | Could be read as automatically applying a winner; copy explicitly says suggestion only |
| `Accept change` | Eligible suggested learned rule | Immediately transitions rule to `accepted`; accepted bounded adjustment can affect future matching recommendations | Rule can later be `Retire change`; there is no second confirmation and retirement is under `Manage accepted change` | User may treat “accept” as acknowledging a finding rather than activating a future recommendation adjustment if they do not read “What will change if accepted” |
| `Retire change` | Accepted learned rule | Transitions accepted rule to retired with supplied reason; retired rule has zero production effect | Historical rule remains; no reactivate control | Generally explicit; management is behind disclosure |

**Repository-observed guardrail.** Accepted learned rules remain bounded and cannot bypass hard gates, expiry, required human approval, or explicit manual route/schedule choices. Acceptance changes recommendation/scoring behavior, not publication/send authority.

## Viral Styles

| Visible action | Location | Repository-observed authoritative effect | Reversibility / recovery | Likely novice misinterpretation — **inference** |
| --- | --- | --- | --- | --- |
| `Run research` | Viral Styles | Starts one bounded in-memory background research job with the selected history/niches/discovery/sample/thread/AI configuration; job fetches/enriches/analyzes and writes stored research outputs | Can request stop; completed stored observations remain available | “Run research” is clear, but the large configuration surface may make it hard to predict scope/cost without expert knowledge |
| `Stop after current unit` | Active Viral run | Sets `stopRequested`; job status becomes `stopping`; termination occurs between bounded search/AI units rather than immediately | A later new run can be started after terminal state | Label accurately states delayed stop semantics |
| `Load catalog` / `Refresh catalog` in runtime setup | Viral AI selector | Queries runtime model catalog; does not save AI profile or start research | Repeatable/read-like | Low consequence, but exposes provider/runtime machinery inside a research task |

## Niche configuration

| Visible action | Location | Repository-observed authoritative effect | Reversibility / recovery | Likely novice misinterpretation — **inference** |
| --- | --- | --- | --- | --- |
| `Save niche` | Your niche | Persists the edited niche profile; invalidates niche/audience/discover reads; affects topic scoring/classification and audience-fit review | Can edit/save again | “Your niche” may be interpreted as controlling all source discovery; page note says live X search queries are not rewritten |
| `Reset to defaults` | Your niche | Immediately replaces custom niche profile with defaults | No snapshot/undo control is exposed; prior custom terms must be recreated manually | Explicit label, but adjacency to Save plus no confirmation/undo creates avoidable recovery cost for accidental activation |

## AI Settings

| Visible action | Location | Repository-observed authoritative effect | Reversibility / recovery | Likely novice misinterpretation — **inference** |
| --- | --- | --- | --- | --- |
| `Save default` | Default profile | Changes global fallback AI profile after capability checks | Select another/default none later | Affects advisory AI execution, not workflow authority; page states this explicitly |
| `Save assignment` | Role assignment | Persists primary/fallback profile IDs for one AI role | `Clear override` or save different assignment | Role-resolution semantics are expert-oriented; ordinary users may not predict which workflow invocation uses which role |
| `Clear override` | Role assignment | Clears role-specific primary/fallback bindings | Reassign later | Explicit but system-level |
| `Create profile` / `Save profile` | Profile editor | Persists runtime/provider/model/config; create may also persist a new secret reference | Editable/deletable later | No publication authority; complexity is configuration rather than action ambiguity |
| `Test profile` | Profile editor | Sends one bounded structured request using the saved profile and records provenance/usage | Repeatable | Tooltip explains remote test request; can incur provider usage/cost |
| `Enable` / `Disable` | Profile editor | Changes whether profile may be assigned/used | Directly reversible | Could affect future AI availability; no content authority |
| `Delete` | Profile editor | After browser confirmation, deletes profile; default/role references are cleared; unreferenced file secret may be cleaned up | Must recreate profile to recover | Confirmation correctly names reference clearing |
| `Replace key` | Direct API profile | Writes a new managed key; an env-backed profile switches to file-managed secret | Replace again | Security/config consequence; no second confirmation but explicit write-only field/action |
| `Remove key` | Direct API profile | Clears secret reference and cleans unreferenced managed secret; env variable itself is not changed | Reattach by replacing/recreating reference; no one-click undo | User may expect deleting the environment variable itself; page explicitly says it only detaches env reference |
| `Refresh catalog` | Saved profile | Refreshes provider/runtime model list | Repeatable | Does not save the chosen model until profile save, which may not be obvious |
| `Check connection` | Saved profile | Runs bounded availability/catalog/auth capability check; no editorial/workflow state | Repeatable | Explicitly diagnostic |

## Consequence-predictability findings

### Repository-observed strengths

- `Approve & send exact reply` says the remote consequence in the button itself and requires final wording/proof confirmations where applicable.
- Main-feed approval copy repeatedly states `Approval is not publication`.
- Schedule copy states that recommended timing is advisory and does not approve/publish.
- Manual repost completion has both a confirmation prompt and explanatory copy that the app does not repost.
- AI Audience review says it can only suggest; one-account unfollow waits for X success before updating local state.
- Test assignment explicitly denies randomization and duplicate A/B posting.
- Suggested learned rules state zero production effect until explicit acceptance.

### Likely novice failure hypotheses

1. **`Draft this` vs `Draft original/quote/thread/reply` is semantically inconsistent.** Today selection creates/routs a scaffold; Discover may invoke AI generation on the same click. This is a consequence-predictability and consistency risk.
2. **`Apply` is under-specified.** In Posts, it means “persist this route/content type and reset workflow authority accordingly,” not “apply a harmless display choice.”
3. **Failure UI does not always re-read authoritative state.** A reply can transition server-side to `publishing` while the mutation reports an error; the current hook does not invalidate on error, so stale controls can remain until another fetch.
4. **`Reset to defaults` has no immediate undo.** An accidental configuration reset loses custom terms from the current UI even though it does not affect publication authority.
5. **`Accept change` may be read as acknowledging evidence rather than activating a bounded future recommendation change.** The explanatory card mitigates this, but the production-effect transition occurs on that single click.

## Research questions

1. Do operators correctly predict that Today `Draft this` may open an ungenerated scaffold while Discover `Draft …` may already contain AI-generated text?
2. What wording makes selection/routing clear without forcing users to learn `route` or `pipeline` terminology?
3. After a send/publish reconciliation error, what minimum information do users need to decide whether to retry, inspect X, or wait for reconciliation?
4. Do operators interpret `Accept change` as activation of future recommendation behavior, or merely acknowledgement of a finding?
5. Is a confirmation/undo affordance necessary for `Reset to defaults`, or is explicit button wording sufficient in observed use?
6. Can users explain the difference between `Save plan`, `Approve for publishing`, automation eligibility, and actual publication after a week away from the product?

## Evidence anchors

- `ui/src/features/today/Today.tsx`
- `ui/src/features/discover/Discover.tsx`
- `ui/src/features/create/Create.tsx`
- `ui/src/features/create/DraftPage.tsx`
- `ui/src/features/create/DraftEditor.tsx`
- `ui/src/features/conversations/ConversationDetail.tsx`
- `ui/src/features/results/Audience.tsx`
- `ui/src/features/improve/Improve.tsx`
- `ui/src/features/viral/ViralStyles.tsx`
- `ui/src/features/settings/AISettings.tsx`
- `ui/src/features/settings/NicheSettings.tsx`
- `ui/src/api/client.ts`
- `web_api.js`
- `pipeline.js`
- `editorial.js`
- `audience.js`
- `store.js`
- `learning.js`
