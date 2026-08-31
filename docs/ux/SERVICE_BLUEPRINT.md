# Service Blueprint

This blueprint ties user-visible work to the current repository's real authority boundaries. It is intended to prevent UX research from proposing labels or journeys that imply powers the backend does not have.

It is a research/design reference, not a new architecture specification.

## Evidence discipline

- **RO — Repository-observed:** current implementation/authority.
- **SS — Stakeholder-stated:** desired constraint or future capability.
- **RH — Research hypothesis:** proposed user framing or placement to validate.

No participant findings are represented here.

## Authority model to preserve

The current product has deliberately separate states and owners:

`recommendation -> human selection/routing -> draft -> readiness checks -> human approval -> schedule/wait -> transport -> authoritative completion -> later measurement -> later learning`

These are not interchangeable.

For replies, the transport path is deliberately more immediate:

`draft -> readiness checks -> explicit human approval -> explicit send -> authoritative completion`

A future writing-strategy selection must sit **before Writer generation** and must not gain approval, scheduling, send, or publication authority.

## End-to-end blueprint

| Journey step | Frontstage user experience | Backstage authority / owner | Persisted or authoritative state | Side-effect boundary | Evidence status |
|---|---|---|---|---|---|
| 1. Discover source signals | User reviews X latest/momentum, GitHub Trending, HN, opportunities, bookmarks, handled work; can refresh source. | `source_refresh.js` orchestrates fetch/rank; `tech_news.js` supplies upstream reads; `strategy.js` personalizes; `store.js` persists candidates, snapshots, observations, refresh errors. | Discover snapshot + candidate/source observations. | Read/fetch only; source failure can preserve previous snapshot. | RO |
| 2. Build Editorial Plan | User explicitly refreshes or later sees a completed plan for an objective; views freshness, rationale, evidence, risks, alternatives, provenance. | `editorial.js:refreshEditorialPlan()` builds context and persists run; `editorial_runtime.js` runs structured AI scan/final; `research.js` collects story evidence; `store.js` persists editorial runs/recommendations/evidence. | Editorial run + recommendation records; recommendation status initially suggested. | Advisory computation only. No route, approval, or publication. | RO |
| 3. Human selects/dismisses recommendation | User selects a recommendation, opens research, drafts, conversation, or dismisses it. | `editorial.js:selectEditorialRecommendation()` validates decision/pipeline and records human selection; calls `pipeline.js:routeCandidate()`; `dismissEditorialRecommendation()` handles dismissal; `store.js` records selection/queue links. | Editorial selection + queue item + linked sources, or dismissed recommendation. | Workflow-state mutation, but no public action. | RO |
| 4. Add/collect research evidence | User can inspect research evidence and, for `RESEARCH_MORE`, attach a source URL and the claim it should support. | `research.js` owns evidence normalization/fetch/collection and `attachEditorialResearchSource()`; `store.js` persists research evidence. | Evidence rows with source/status/claim scope and recommendation linkage. | External page reads may occur; no content publication. | RO |
| 5. Choose route outside Editorial Plan | User can choose original, quote, thread, reply, repost, research, pause, skip from Discover/Posts. | `pipeline.js:routeCandidate()` owns route state; `store.js` owns queue/draft persistence. | Queue lane/pipeline/status; draft scaffold for text routes. | Workflow mutation only. | RO |
| 6. Generate Writer draft | User asks AI to generate/regenerate and receives editable candidate text. | `web_api.js` builds generation request; `drafting.js:buildWriterPacket()` supplies candidate/editorial/evidence/relationship/health/profile context; `writer_runtime.js:generateWriterOutput()` calls `ai_runtime.js:runStructuredAI()`; `drafting.js:applyWriterOutput()` applies structured result; `store.js` persists draft. | Draft/editor fields, AI output/provenance, quality/gates after save/evaluation. | AI execution only. Writer does not browse or run shell commands. No approval/publication. | RO |
| 7. Edit + preview quality | User edits exact post/reply text; quality/gate feedback updates. | `drafting.js:scoreDraft()` and draft gate logic evaluate current content; draft preview/save API persists through `store.js`. | Editable draft + derived quality/gate state. | No public side effect. | RO |
| 8. Readiness check | User checks readiness. | `pipeline.js:requestQueueReview()` re-scores the exact draft; `drafting.js` gate logic enforces the remaining content/media constraints. | Queue enters `needs_review`; checked draft/gates persisted. | No approval, send, or publication. | RO |
| 9a. Approve main-feed work | User explicitly approves original/quote/thread/repost work. | `pipeline.js:approveQueueItem()` requires `needs_review`, re-evaluates publishability, records human approval. | Queue status `approved`, `humanApprovedAt`; draft `ready` for text routes. | Authorization state only. No publication. | RO |
| 9b. Approve engagement reply | User explicitly approves an exact reply after readiness checks. | `pipeline.js:approveEngagementQueueItem()` requires human actor, exact publishable draft, and records `approvedText`. | Engagement queue `approved`, human approval timestamp, exact approved text. | Authorization state only. | RO |
| 10. Plan/wait for main-feed publication | User sees advisory timing, can provide a human schedule override, and sees approved/waiting state. | `scheduler.js:recommendMainFeedSchedule()` and `rankMainFeedItems()` evaluate eligibility/spacing/conflict/expiry and accepted learned-rule inputs; schedule persistence lives in `store.js`. | Scheduling fields and recommendation; approved queue item remains authoritative work state. | No transport. A schedule recommendation is not publication. | RO |
| 11a. Send approved reply | User explicitly sends already approved exact reply, or uses the combined explicit approve-and-send UI path. | `pipeline.js:sendApprovedEngagementReply()` verifies human approval, unchanged exact text, target tweet, credentials; transport defaults to X HTTP posting; then persists success/failure/reconciliation state. | Queue/draft published state + output tweet/url on success; failed/publishing reconciliation state on uncertainty. | **Public X side effect.** | RO |
| 11b. Publish approved main-feed work | UI may show waiting/ready; background cycle acts only when automation is enabled and work remains eligible. | `automation.js:processMainFeedQueue()` reads approved automated items, uses `scheduler.js`, claims item, and calls `x_browser_publish.js:publishMainFeedBrowser()`; `store.js` marks published/failed; draft/action history is recorded. | Queue `publishing`/`published`/failed or reconciliation metadata; output tweet/url. | **Public X side effect.** With `AUTO_POST=false`, automation returns preview and performs no transport. | RO |
| 12. Record manual repost | User confirms only after actually reposting on X. | `pipeline.js:recordManualRepost()` requires human actor and prior approval, then records local completion/action. | Repost queue becomes published/completed locally. | X repost itself happens outside this app; this action records human-confirmed completion. | RO |
| 13. Capture publication baseline and fixed-window outcomes | User later reviews measured results; collection happens after publication. | `automation.js:capturePublicationFollowerBaseline()` and `captureDuePublicationMeasurements()` fetch performance; `store.js` persists performance snapshots and publication measurements; `experiments.js` supplies normalized metrics/attribution semantics. | Publication measurements at fixed supported windows plus follower baseline/context. | External performance reads; no publication authority. | RO |
| 14. Present account/performance outcomes | User reviews audience state, follower quality, conversations, measured posts, editorial outcome cohorts, health and technical details. | `web_api.js` composes `/results` from `store.js` measurement/audience/health/editorial-outcome queries and experiment summary semantics. | Read model only; source records remain authoritative. | Read-only presentation except explicit refresh performance read. | RO |
| 15. Run Viral Styles external research | User configures bounded historical research, starts/stops it, sees checkpoints, then reviews external associations and examples. | `web_api.js` owns in-process job orchestration; `viral_style_sweep.js:runViralSweep()` defines/runs historical sweep jobs; `viral_style_research.js` owns bounded collection/inspection/snapshot/export operations; `viral_style_intent.js` performs optional AI semantic labeling; `viral_style.js` derives normalized style/performance rows and dataset summaries; `viral_style_analyze.js` analyzes/exports the stored retrospective dataset. | Stored external observations/analysis plus current in-process job state. | Read-only X research and AI analysis. It does not post, reply, follow, or unfollow. | RO |
| 16. Define and assign a test | User states hypothesis/options/metric, activates, then explicitly assigns a real work item to an option. | `experiments.js` validates definitions/populations/variant assignment and summarizes cohorts; `store.js` persists experiment definitions/assignments; web API exposes mutations. | Test lifecycle + explicit assignment records. | No automatic randomization, duplicate content, approval, or publication. | RO |
| 17. Generate/review learned rule | User checks for a pattern; sees suggested/accepted/retired changes and supporting evidence. | `learning.js` qualifies evidence, creates candidates, manages status semantics/review/matching/bounded application; `store.js` persists learned rules and exposes refresh/accept/retire mutations. | Suggested/accepted/retired learned rule with evidence/adjustment/review context. | Suggested/retired rules have zero production effect. Accepted rules can only exert bounded matching recommendation influence. | RO |
| 18. Choose optional writing strategy | Proposed Learn/Writer flow would expose evidence-backed strategy and let human choose no influence, suggestion-only, or deliberate application before generation. | No current backend owner/selection contract exists. Source plan proposes a future strategy-guidance/selection layer before Writer packet construction. | Future append-only strategy selection/provenance would be needed. | **Must remain advisory/human-selected. Must not approve, schedule, send, publish, or bypass current gates.** | SS + RH; not implemented |
| 19. Record actual business outcome | Stakeholder would link a directly observed lead/signup/partnership/revenue outcome to work when evidence exists. | No current business-outcome ledger/owner exists in inspected repository. | Future bounded business-outcome record. | Recording only; must not fabricate attribution. | SS + future gap |

## Service lanes

### User / frontstage lane

The user should be asked to make only decisions that require human judgment or consequential authorization:

- what deserves attention;
- whether a recommendation is useful;
- what a source should become;
- whether more evidence is needed;
- whether the exact draft is factually/evidentially acceptable;
- whether to approve;
- when to override a schedule;
- whether to send an approved reply;
- whether a manual repost actually occurred;
- whether to accept/retire learned recommendation influence;
- in the future, whether writing-strategy guidance should influence generation.

### AI/advisory lane

Current AI may:

- scan/cluster/rank editorial candidates;
- research and summarize supplied evidence;
- recommend a content treatment;
- generate editable draft text;
- explain provenance/rationale;
- classify text-supported external communicative intent/style;
- review audience-following profiles and suggest inspection targets.

AI output does not gain human approval or public-action authority by being high confidence or structured.

### Deterministic policy/domain lane

Current deterministic logic owns:

- route/status validation;
- draft gates and publishability conditions;
- evidence-reference constraints;
- scheduler eligibility/expiry/conflict rules;
- experiment validation/summary semantics;
- learned-rule acceptance/bounds/protected boundaries;
- state-transition invariants.

This lane should not be described to ordinary users using internal object names unless diagnostic context requires it.

### Transport/integration lane

Public side effects are narrow and consequential:

- main-feed X publication through `automation.js` + `x_browser_publish.js` only after approved eligibility and automation enablement;
- reply transport only after explicit human approval of unchanged exact text;
- unfollow is a separate explicit one-account action outside this blueprint's core content journey;
- repost is not automated by the app.

## Consequence/authority matrix

| State/action | AI can initiate/recommend? | Human action required? | Can it cause public side effect? | Current source of truth |
|---|---:|---:|---:|---|
| Editorial recommendation | Yes | No to compute; yes to use | No | Editorial recommendation record |
| Editorial selection | AI can recommend; cannot silently select | Yes | No | Editorial selection + queue route |
| Draft generation | Yes on explicit user request/current workflow | User can request/edit | No | Draft record |
| Readiness check | System evaluates | Human reviews blockers | No | Draft gates + queue review state |
| Main-feed approval | No autonomous approval | Yes | Not immediately; makes future automated publication possible | Queue approval state |
| Reply approval | No autonomous approval | Yes | No until send action | Engagement queue + exact approved text |
| Schedule recommendation | Yes/deterministic advisory | Override optional | No | Schedule decision/queue fields |
| Main-feed publication | System automation can execute **only after human approval and when enabled** | Prior human approval required | Yes | X transport result + queue publication state |
| Reply send | Autonomous send requires an explicit active grant | Yes, through either the approved human path or active autonomous grant | Yes | X transport result + engagement queue |
| Manual repost completion record | No | Yes, after real external repost | Records completion only | Queue/action history |
| Experiment assignment | No automatic assignment | Yes | No | Experiment assignment record |
| Suggested learned rule | System can generate | No to suggest | No | Learned-rule record, zero effective adjustment |
| Accepted learned rule | No autonomous acceptance | Yes | No direct side effect; bounded future recommendation influence | Accepted learned-rule record |
| Future writing-strategy selection | May be suggested | **Must be human-selected for Apply** | **Must not** | Future selection/provenance contract |

## Failure and recovery blueprint

| Failure/uncertainty | Current backend truth | What the user must be able to determine | UX research task |
|---|---|---|---|
| Source refresh partial failure | Previous snapshot may remain while error/attempt time is recorded. | “Am I seeing old data, and did refresh fail?” | Ask participant to decide whether evidence is fresh enough to act. |
| Editorial run failure | Run is persisted failed; no completed recommendation should be presented as current success. | “Did AI finish the recommendation pass?” | Present failed/partial source scenario and ask next safe action. |
| Draft gate failure | Draft remains editable; approval is blocked until requirements pass. | “What exactly needs me, and what did not happen?” | Ask participant to resolve a remaining deterministic blocker. |
| Account constrained | Reply approval/send can be blocked while warning states can remain advisory. | “Which action is unavailable and why?” | Compare `watch` vs constrained language without internal code names. |
| Scheduled wait | Approved content remains unpublished until timing/eligibility/automation permits. | “Is it public yet? What could happen later?” | Consequence-prediction task before leaving the session. |
| Main-feed transport error | Queue can be failed; if transport completed without sufficient local identity, item can remain `publishing` for reconciliation. | “Did X receive it? Is retry safe?” | Give ambiguous recording scenario; require participant to explain next action. |
| Reply transport error | Failed send clears approval; missing tweet ID can leave publishing/reconciliation state. | Same as above, with exact approved text semantics. | Ask whether participant would edit/retry/send again and why. |
| Measurement read failure | Measurement capture can skip/fail without changing publication state. | “Published successfully, but outcome data is incomplete.” | Ensure Results error is not interpreted as publication failure. |
| Viral research stop/failure | Stop happens between bounded units; job can end stopped/failed with prior stored data still present. | “What findings belong to this completed run versus older stored evidence?” | Ask participant to identify freshness/run provenance. |
| Learned evidence becomes stale/reversed | Accepted rule can be flagged for review/suspension/retirement. | “Is this change still active and trustworthy?” | Ask participant to interpret review/retire recommendation. |

## External, internal, experiment, and strategy evidence contracts

### External evidence — RO

Owner chain: `web_api.js` orchestration -> `viral_style_sweep.js` sweep planning -> `viral_style_research.js` bounded collection/snapshots -> `viral_style_intent.js` optional semantic classification -> `viral_style.js` normalized feature/performance derivation -> `viral_style_analyze.js` retrospective analysis/export.

It supports statements about **observed associations in the selected external sample**. It does not establish X ranking causality, private author motivation, or guaranteed transfer to this account.

### Internal evidence — RO

Owner chain: publication/conversation/audience observations -> store -> Results/editorial cohorts/learning context.

It supports statements about **observed outcomes around this account's work** with attribution caveats. It does not create universal market claims.

### Experiment evidence — RO

Owner chain: explicit test definition/assignment -> later observations -> `experiments.js` cohort summary/evidence state.

It supports a bounded declared comparison. The product does not randomize variants or automatically declare a causal winner.

### Strategy recommendation — SS/RH

The future strategy layer should reference evidence from the lanes above and explain applicability/limitations. It must not hide provenance in a single opaque score.

The human-controlled mode must be semantically equivalent to:

- **no writing influence**;
- **show guidance without applying it**;
- **deliberately apply selected guidance to Writer generation**.

The labels `Off / Suggest / Apply` are hypotheses to validate, not established user language.

## Actual business outcomes versus growth proxies

**RO:** the product has audience, relationship, distribution, and content measurements.

**SS:** the strategic goal includes durable opportunities/revenue/build visibility.

**Current boundary:** no inspected backend component records a dedicated lead/signup/partnership/revenue event with provenance. Therefore no UI research concept should imply that relevant-follower or reach movement is itself a business conversion.

A future service blueprint for direct business outcomes will need, at minimum:

- an explicit human/system observation source;
- timestamp and outcome type;
- optional linkage to content/conversation/relationship evidence;
- attribution caveats;
- immutable provenance/audit semantics for consequential strategic claims.

Those are future requirements, not current implementation claims.
