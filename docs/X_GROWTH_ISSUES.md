# X Growth Issue Inventory

**Original checkpoint:** 2026-08-29

**Last reviewed:** 2026-10-28 against local commit `6b29fcb85a71e85ca3351d753bed907c1de49d6f`.

**Reply-quality update:** 2026-10-29 against `be76450`. [The detailed audit](research/GROWTH_REPLY_QUALITY_REPORT_2026-10-29.md) records 458 October replies, 456 parent texts, and 22 assessed cases. XR-14 is in-progress. XG-06 is open on confirmed October evidence. No writing repair or owner acceptance is claimed. Earlier implementation and deployment statements below retain their original scope and date.

**Pilot update:** 2026-10-29 against `8dfcb39`. Three writing runs and one fresh
diagnosis use DeepSeek 4.1 Flash max. Two probes retain the evaluator habit.
The [pilot report](research/voice-audit-2026-10-29/pilot/REPORT.md) records mixed
results and the stop. The 18 reserved cases remain unused. No writing repair is accepted.

**Status:** the October review covers all 20 original findings, the documentation task XR-21 and three display defects grouped under XR-22.
The September inventory remains historical evidence. Its status labels do not establish current deployment or runtime health.

This document records X growth problems without converting plausible ideas into production rules without evidence.

This is not an implementation plan. Each issue should be fixed only after its owner and acceptance condition are confirmed against current runtime state.

## 2026-10-28 review and task inventory

### Scope and evidence

All 20 original findings remain relevant to the requested review. They are not 20 confirmed current defects.
The entries distinguish local fixes, code gaps, operating risks, planned features, and historical observations that need fresh evidence.
Each `XR` number matches the original finding number. `XR-21` records the additional handoff reconciliation task.

The initial review covers the latest commit, relevant unchanged source, handoffs, engagement notes, the overhaul plan, and local `operator-status` output.
Before that initial review, the tracked tree was clean. The subsequent implementation remains uncommitted. The existing untracked `live-progress.json` remains untouched.
The review does not inspect today's ARM services, browser, model logs, or live X outcomes. Local state is not production evidence.
No tests ran during the initial revalidation. Later implementation evidence appears in each status and in `TASKS.md`.
Evidence bullets describe the initial baseline unless dated otherwise. Source line numbers may move after repairs.
Hamza separately authorized local implementation. Recording a task here grants no deployment, public send, timer or owner-policy authority.
Read `docs/GROWTH_IMPLEMENTATION_HANDOFF_2026-10-28.md` for the current local checkpoint and dated production records.

Final graph review found three additional defects within existing tasks.
XR-02 now rejects synthetic follower evidence at ingestion. XR-11's command sheet
now names the actual engage-refresh fields. XR-21's status definition no longer
claims uncommitted repairs exist in HEAD. Parent repaired all three in one round.
The focused repair run passes 22/22. Existing synthetic zeros need source evidence
before historical correction. Retrospective proposals live in `docs/FUTURE_IMPROVEMENTS.md`.

Status meanings:

- **Confirmed gap:** current source or local state establishes the stated limitation.
- **Fixed locally:** the correction exists locally. October implementation repairs remain uncommitted unless stated otherwise. Deployment and runtime success remain unchecked.
- **Confirmed risk:** the execution path exists. The review does not establish that harm occurred.
- **Historical / needs evidence:** dated reports establish relevance, but do not establish a current failure.
- **Planned:** the accepted direction identifies future work, not a regression in an existing feature.

### XR-01 — Connect observed responses to relationship state

- **Status:** local repair at review on October 28. **Priority:** P1. **Plan:** T3.
- **Result:** opt-in engagement refresh uses one bounded HTTP mention read and the existing event owner. The versioned live brief requests collection explicitly.
- **Checks:** parent targeted run 20/20 passes. Fixtures check exact parent links, repeated-read deduplication, follow-up opportunities, health responses and stored missing metrics.
- **Limit:** no live read or deployment. Empty successful mention reads do not prove that no response exists.
- **Evidence:** `agent_bridge.js:651` and `:1445` disable response and target-timeline refresh. Its `x-read` handler returns observations without recording relationship events.
- **Limit:** `engagement.js:727` can record responses when enabled. The retired daemon also calls the refresh owner, so collection is not universally absent.
- **Task:** connect authenticated observations to the existing response owner without restoring the retired daemon or changing send paths.
- **Done when:** an observed author response creates one correctly linked event and appears in health and conversation views. Repeated ingestion creates no duplicate event.
- **Interpretation:** zero recorded responses does not establish zero actual responses.

### XR-02 — Use consistent follower observations in status views

- **Status:** local repair at review on October 28. **Priority:** P1. **Plan:** T4. **Related:** XG-02.
- **Result:** current status views share the newest eligible observation, with separate follower time and source. Historical metric fields retain their meaning.
- **Checks:** parent focused run 19/19, isolated tie case 1/1, syntax and diff checks pass. Independent contract review found no blockers.
- **Review repairs:** invalid follower payloads fail before conversion. Current reads select the latest non-future metric without changing historical performance output.
- **Final review repair:** performance ingestion now skips account rows without a valid follower count while retaining usable post measurements. Newer missing counts no longer replace genuine observations. Valid zero remains evidence. Parent repair checks pass 22/22.
- **Limit:** no deployment check or historical backfill. Existing synthetic zeros cannot be distinguished from real zeros without source evidence.
- **Evidence:** `store.js:6034` writes `growth_follower_observation_v1`. `agent_bridge.js:1093` and `:2445` read `getPerformanceSnapshot().account` from `account_metrics`.
- **Task:** choose the existing authoritative observation for current follower displays. Preserve its actual capture time and distinguish it from historical account metrics.
- **Done when:** a supported follower observation updates the relevant status displays consistently. Unknown or stale values remain explicit.
- **Baseline observation:** the initial local display returned 64 followers from September 11. Today's production count remains unknown.

### XR-03 — Preserve reply classification in relationship events

- **Status:** at review. Queue classification now reaches confirmed act events. Targeted checks pass 33/33. **Priority:** P1. **Plan:** T5.
- **Evidence:** `agent_bridge.js:1937` records only attempt and output metadata for `act`. `health.js:423` treats missing `engagementKind` as `initial_reply`.
- **Task:** preserve the actual engagement classification through the existing event owner.
- **Done when:** initial replies, follow-ups, and responses to owned posts produce the correct health denominators and continuation counts.
- **Boundary:** do not infer an historical classification without supporting evidence.

### XR-04 — Record supported dimensions for outcome comparisons

- **Status:** local metadata at review. Observed target size and writing labels pass focused checks. XR-20-C adds compact paragraph references to confirmed act events. **Priority:** P2. **Plan:** T5, T7/T8.
- **Evidence:** the metadata at `agent_bridge.js:1944` omits target follower count, reply shape, and brief references.
- **Task:** record observed target size and supported writing metadata through existing state owners. Add brief references when briefs exist.
- **Done when:** results can group outputs by supported dimensions. Missing observations remain unknown.
- **Boundary:** share implementation with XR-03. Do not create a second event owner or invent retrospective metrics.

### XR-05 — Check duplicate protection after the reply-text correction

- **Status:** at review. Disposable-state record-and-guard regression passes 1/1. Historical coverage remains incomplete. **Priority:** P1 acceptance task. **Plan:** T1.
- **Evidence:** HEAD stores `commentary: validated.text` at `agent_bridge.js:1932`. `store.js:4481` reads that commentary as published reply text.
- **Task:** check the real record-and-guard path with a focused regression case before accepting the fix for production.
- **Done when:** a confirmed reply records its exact text, and a later duplicate to another target is refused by the content guard.
- **Correction:** old labels do not necessarily leave every guard after seven days. The `act` lookup has a row limit without a `since` argument.
- **Boundary:** no direct database backfill. Any historical repair needs recoverable exact text and a supported state operation.

### XR-06 — Check analytics collection after the effort correction

- **Status:** fixed locally. **Priority:** P1 acceptance task. **Plan:** T2.
- **Evidence:** `growth_analytics_runner.js:55` now passes `--reasoning-effort max` for `gpt-6-luna`.
- **Task:** check the deployed revision and collect one bounded production result when operational work is authorized.
- **Done when:** the collector starts with the supported effort and reports measured writes or an accurate blocker. It also releases its owned tab.
- **Current evidence:** the October 28 ARM run uses gpt-6-luna max and reports exact owned-tab cleanup. Analytics redirects to login. Parent checks zero new measured rows. See `docs/ANALYTICS_COLLECTOR_ACCEPTANCE_2026-10-28.md`. The code bytes used at that run are not provable. October 29 owner-authorized cookie import restores authenticated @ham_zax Home and Premium Analytics access. Values persist only in ignored .env with mode 0600. A new collector run and measured writes remain untested.

### XR-07 — Distinguish successful collection cooldown from failure recovery

- **Status:** at review after current-run diagnosis. Blocked, missing or invalid child outcomes now fail even on exit 0. Accessible empty is distinct from blocked. Parent focused checks pass 11/11. **Priority:** P2.
- **Evidence:** `growth_analytics_runner.js:19` checks only `lastStartedAt`. Both successful and failed attempts retain that timestamp.
- **Impact:** a failed launch or collection attempt suppresses another attempt for 21 hours.
- **Task:** define bounded failure recovery separately from the successful collection interval.
- **Done when:** failures can recover within the agreed interval without overlapping collectors or retrying uncertain public actions.
- **Continuation result:** an ID-bound private JSON receipt carries the reported outcome and new-post count. Process failures remain failures. The historical completed checkpoint stays unchanged. No real collector or timer ran during repair tests.

### XR-08 — Expand approved persona evidence

- **Status:** confirmed content gap, not a code defect. **Priority:** P2. **Plan:** T9/T10. **Related:** XG-04.
- **Evidence:** `persona/hamza-v1.json:282` has empty verified experience, tools, results, and failures lists. Verified projects are present.
- **Task:** propose examples from supported owner material. Add only owner-approved facts or evidence from authorized bounded experiments through `persona.js`.
- **Done when:** writing can use traceable first-person material without inventing experience.
- **Limit:** empty lists do not prove that Hamza lacks the experience. The review does not prove they caused repetitive writing.
- **October 29 scope:** existing persona calibration permits ordinary writing. Missing new experience evidence does not block all operation. Do not invent first-person claims.

### XR-09 — Use one progress-file path

- **Status:** at review. The brief and recovery document use the same absolute checkpoint path. Historical artifacts remain untouched. **Priority:** P2. **Plan:** T15.
- **Evidence:** the live brief grants an absolute state path at line 15, then uses relative paths at lines 44 and 46.
- **Evidence:** the untracked root `live-progress.json` records a completed October 13 session. It is not current run state.
- **Task:** use one absolute path throughout the brief and recovery instructions.
- **Done when:** a bounded session writes progress only to the state directory, and the operator can locate the same file for recovery.
- **Boundary:** preserve existing artifacts until their owner decides their retention.

### XR-10 — Check rest policy before broad discovery

- **Status:** at review. The brief checks saved rest policy before broad collection and preserves urgent checks. Historical cost needs fresh measurement. **Priority:** P2. **Plan:** T15.
- **Evidence:** the live brief orders mentions, For You ingestion, and niche searches before `scout`, which exposes `pace.activity`.
- **Task:** check saved rest policy before broad collection. Preserve the existing exception for urgent signals.
- **Done when:** a rest-window session avoids broad discovery, inspects only permitted urgent work, and records the reason for stopping.
- **Limit:** the reported eight-minute overhead comes from the October audit, not a current measurement.

### XR-11 — Complete the operator command sheet

- **Status:** at review. Both examples match disposable bridge output. **Priority:** P2. **Plan:** T15.
- **Evidence:** the command sheet in `ops/systemd/arm/arm-growth-live.md` omits `social-status` and `growth-run-status`.
- **Task:** add examples that match the current bridge payload contracts and required identifiers.
- **Done when:** each example returns the documented shape without missing-field errors in an appropriate nonpublishing context.
- **Limit:** earlier malformed commands are historical reports. Missing examples do not prove that all such failures share one cause.

### XR-12 — Add top-ranked reply collection for topic research

- **Status:** at review. Explicit Top/Latest reply samples pass 13 focused tests. Chronological thread reads remain available. **Priority:** P2. **Plan:** T6.
- **Evidence:** `x_reads.js:127` searches a conversation in the default Latest mode, then sorts the bounded results chronologically.
- **Task:** add explicit ranked-reply collection for topic research while preserving existing thread-read behavior.
- **Done when:** the collector returns a bounded, attributed reply sample with its ranking mode and capture time.
- **Limit:** the current reader cannot establish the highest-ranked replies from that latest-only sample.

### XR-13 — Review upstream code before authenticated execution

- **Status:** at review. Exact commit approval now precedes candidate execution. Seven tests pass after the export-failure continuation. Independent boundary reviews find no blocker. **Priority:** P1.
- **Evidence:** `ops/xactions_update.mjs:69` smoke-checks a newly fetched candidate before promotion. `x_reads.js` imports that candidate and supplies account cookies.
- **Task:** establish a reviewed or explicitly trusted revision boundary before authenticated candidate execution.
- **Done when:** an unapproved candidate cannot execute with account credentials. A failed candidate preserves the existing working pin.
- **Limit:** automatic promotion controls act after execution. No compromise or credential disclosure was observed by this review.
- **Continuation repair:** the working tree catches approved-candidate export failure, records fixed `failed: export` text, and continues the pin smoke and status write. The missing-src fixture passes with no candidate execution, unchanged pin and removed temporary export. Seven focused cases pass after parent test-evidence repairs. Immediate boundary review finds no blocker. Raw child stderr remains a pre-existing diagnostic limit. No live pin or approval changed.

### XR-14 — Reassess repetitive writing and the action mix

- **Fresh-prompt continuation:** six DeepSeek-only calls test four new prompts, a repeat, and four new sources. V4 improves the conversational register but still shows factual drift and an extra output field. Terra stays on hold. [Checkpoint](research/voice-audit-2026-10-29/fresh-prompt/REPORT.md). No production repair or owner acceptance is claimed.

- **Status:** confirmed October quality failure, investigation in-progress. **Priority:** P1. **Plan:** T8/T9/T12/T13. **Related:** XG-06/XG-08/XG-11.
- **Evidence:** [Detailed report](research/GROWTH_REPLY_QUALITY_REPORT_2026-10-29.md), 29 October. The corpus contains 458 replies, 448 matched confirmed Growth OS publications, and 456 parent texts. Twenty-two selected cases distinguish role failures, source-reading failures, ambiguous cases, and useful technical controls. `docs/ENGAGEMENT_IDEAS_2026-10.md`, section 2, remains earlier evidence.
- **Task:** repair the demonstrated source and role failures through the actual writing paths, then compare unpublished outputs against the frozen cases. No repair or replay runs in the reporting step. Missing first-person evidence limits experience claims, not diagnosis or ordinary participation.
- **Pilot:** current static guidance, replacement reply guidance, and a narrower persona produce four unpublished replies each. Neither change consistently resolves the main failure. A fresh diagnosis finds mixed gains. Four of five pilot dispatches complete. Composition and the reserved-case run stop under the repository rule. [Exact evidence](research/voice-audit-2026-10-29/pilot/REPORT.md). XR-14 stays in-progress.
- **Model follow-up:** Hamza requests Terra 6.1 medium for dispatch five. The identical baseline task returns three replies and one skip. The parent sees less dismissive language in this sample. [Comparison](research/voice-audit-2026-10-29/pilot/terra-medium/REPORT.md). Stable superiority and owner acceptance remain unestablished. All five dispatches are used. No production model changes.
- **Additional models:** MiMo high, GLM 5.3 max, and Big Pickle high complete through Pi on the same baseline request. Each retains evaluator language or unsupported generalizations. The parent still prefers Terra on these four cases. [Evidence](research/voice-audit-2026-10-29/pilot/other-models/REPORT.md). New budget consumed: three of three. No production or reserved-case run.
- **Done when:** the owner accepts the resulting writing sample and outcome comparisons use qualified measurements.
- **Boundary:** do not impose quotas, human-looking delays, or a universal format rule. The audit does not establish an optimal action mix.

### XR-15 — Measure and reduce session cost at the actual launcher

- **Status:** local queue-guidance repair at review. Three retained attached sessions support the diagnosis. Current command output falls from 61,369 B unfiltered to 2,682 B for approved5 or 5,239 B for review5. Different retrieval scopes are intentional. Full-session token improvement remains unmeasured. **Priority:** P1. **Related plan:** context-budget work.
- **Evidence:** the October 13 handoff records 76 model calls and peak context of 243,511 tokens for one session.
- **Evidence:** `ops/systemd/arm/attached-live.conf` selects `arm-growth-live.sh`, bypassing `growth_agent_runner.js` as the service entry point.
- **Task:** measure calls, cached and uncached input, output, context growth, outcomes, and elapsed time for the actual attached path.
- **Done when:** a measured change reduces the identified waste without weakening authority, recovery, or content gates.
- **Limit:** compact bridge responses already exist. Do not recreate that completed work or assume runner-only changes affect the attached launcher.
- **Repair:** the live command sheet now documents bounded queue filters and avoids unchanged repeated draft reads. Evidence: `docs/ATTACHED_LAUNCHER_COST_2026-10-28.md` and the parent checkpoint in the plan. No live model run or send occurred.

### XR-16 — Diagnose stale discovery by source

- **Status:** local repairs and October 28 source observations at review. Four sources refreshed successfully. Creator refresh saved 13 candidates with an unavailable-account error. See `docs/SOURCE_FRESHNESS_ACCEPTANCE_2026-10-28.md`. Automatic refresh cadence remains unproven. **Priority:** P1. **Plan:** T14.
- **Evidence:** the October 28 local status read returns September snapshots for Latest, Momentum, GitHub, HN, and creator timelines.
- **Evidence:** For You was last captured on October 13. It is newer than those feeds, but it is not fresh on October 28.
- **Correction:** stored missing-Chrome errors describe older attempts. Current `x_browser.js` launches CloakBrowser, so those errors do not establish the current cause.
- **Task:** check each source through its current owner and authorized read transport. Record collection time, failures, and preserved last-good state.
- **Done when:** each intended source has a current successful observation or an explicit current blocker.
- **Correction:** creator refresh has a caller in `engagement.js`. An earlier claim that it has no caller is unsupported.
- **Current transports:** Latest/Momentum use CloakBrowser. Creator timelines use the HTTP client. GitHub/HN use native fetch. The old Chrome error cannot explain all five sources.
- **Local repairs:** explicit `engage-refresh {"refreshTargetTimelines":true}` now reaches the existing creator owner. Default remains local. Hard source errors report preserved candidates truthfully through `preservedLastGood`.
- **Remaining findings:** the dashboard has no direct creator Refresh control. HN item failures can yield a partial result without item errors. Empty and zero-target results need policy context, not automatic failure labels. No new scheduler or transport replacement is justified by the stale snapshot alone.
- **Needed evidence:** deployed revision, source attempt times and errors, current browser availability and service logs, then one authorized bounded refresh per source. Do not use the retired automation daemon.

### XR-17 — Investigate browser tab drift

- **Status:** October 29 attached failure-cleanup repair passes immediate lifecycle review with no blocker. The launcher now uses the existing exact tab lease and child supervisor. Fifty focused checks and 404 integrated tests pass before the final permission-order repair. The affected file passes 11/11 afterward. Retained normal exits show no owned-tab leak. Live failure exit and deployment remain untested. **Priority:** P2. **Plan:** T15.
- **Evidence:** the October audit records baseline counts rising from eight to nine to ten tabs. The cause remains unknown.
- **Task:** compare exact tab identities before allocation and after cleanup for a bounded authorized session.
- **Done when:** each new tab has an owner, and normal and failure exits reclaim only session-owned tabs or report exact recovery identities.
- **Boundary:** existing cleanup in `ops/agent_browser_session.js` is counter-evidence against assuming every path leaks. Do not close shared tabs.
- **Current trace:** `docs/BROWSER_TAB_OWNERSHIP_2026-10-28.md` records exact identities and close commands. Historical counts of 8/9/10 do not match the retained sample baselines of 9/5/5. No duplicate cleanup repair is justified by that sample.

### XR-18 — Reproduce the two recorded test failures

- **Status:** fixture repair at review. October 29 reproduced rest-hour dependence and a follow-on test lease failure. Product gates remain unchanged. **Priority:** P1. **Plan:** T0.
- **Check:** October 28 focused run passed 14/14. October 29 serial suite failed 5 cases during owner rest hours. Three disposable fixtures now set an explicit empty rest interval for claim/lease checks. All 26 affected cases pass. Final integrated result is in TASKS.md.
- **Evidence:** the overhaul plan records failures at `26723ed` before the latest fixes.
- **Cases:** `send-start needs only attemptId…` and `valid run-bound bridge activity renews…` in `tests/autonomous_run_friction_repairs.test.mjs`.
- **Task:** run the focused existing cases in an isolated test context during authorized implementation or test work. Diagnose the first actual failure.
- **Done when:** evidence distinguishes a runtime defect from a stale fixture or test contract, and the justified correction passes the relevant checks.
- **Limit:** this review does not establish that the two cases still fail at HEAD.

### XR-19 — Collect reproducible application defects

- **Status:** bounded local inventory at review. Twenty-four disposable page-load GETs return 200. Three concrete display defects become XR-22. Owner walkthrough remains missing. **Priority:** P2. **Plan:** T0.
- **Evidence:** the overhaul plan requests an owner walkthrough and concrete reproductions for the reported application quirks.
- **Task:** inventory the affected pages and bridge commands using existing facilities. Record steps, expected behavior, actual behavior, and state requirements.
- **Done when:** each accepted defect has a reproducible example, an owner, and a clear completion check.
- **Boundary:** use safe local settings. Do not approve or publish from the stale local database.

### XR-22 — Align approval displays and source labels with existing owners

- **Status:** at review. Parent checks pass 6/6 for ready and blocked states. Two missing labels are added. **Priority:** P2. **Depends:** XR-19.
- **Finding 1:** conversation detail can expose `flags.canApproveReply:true` while its embedded editor returns false. The outer predicate omits growth packaging. A score-44 draft with passing gates but `NO_CLEAR_PURPOSE_PAYOFF` reproduces the contradiction. `web_api.js::formatConversationDetail` owns the display. Use the existing editor flag. Server approval still rejects the blocked draft.
- **Finding 2:** Today calls the same blocked original ready for approval. Its predicate checks score/gates without growth packaging. Use the canonical analysis readiness result at `web_api.js` Today handler. The action must agree with the editor for ready and blocked fixtures.
- **Finding 3:** Today maps four of the six current source kinds. Add readable labels for `x_for_you` and `x_creator_latest` in `ui/src/features/today/Today.tsx`. Discover already labels those sources.
- **Evidence:** `docs/LOCAL_APP_REVIEW_2026-10-28.md` records requests, payloads, owners, limitations and completion checks. Parent inspected all three predicates/maps.
- **Boundary:** display state only. No approval write, publishing rule, schema, policy, routing or new source owner.

### XR-20 — Track the proposed topic brief workflow as separate deliverables

- **Status:** refinement and local T6/T7/T8 implementation are at review. Collections, draft briefs and optional paragraph citations have disposable-state coverage. Owner and operational acceptance remain separate. **Priority:** P2. **Plan:** T6–T13.
- **Evidence:** `docs/plans/ENGAGEMENT_OVERHAUL_2026-10-14.md` defines the approved direction and its remaining work.
- **Task:** retain the existing ticket boundaries below. Do not treat every planned feature as an existing defect.
- **Done when:** each selected deliverable meets its own completion check and fits the existing publication and approval owners.

| Deliverable | Existing ticket | Completion evidence | Dependency / overlap |
| --- | --- | --- | --- |
| Bounded topic collection | T6 | Attributed recent posts and ranked replies saved with capture times | XR-12 |
| Saved topic brief | T7 | Numbered, sourced paragraphs distinguish reports, tested facts, and opinion | T6, owner read |
| Brief-based writing | T8 | Drafts name supporting paragraphs and pass the owner's voice review | T7, XR-14 |
| Approved voice examples | T9 | Supported examples and persona facts accepted by the owner | XR-08 |
| Bounded real experiments | T10 | Authorized experiments save evidence through the persona owner | Separate design note |
| Review integration | T11 | Existing review surfaces support the agreed brief workflow and human approvals | Decide access to ARM state |
| Analysis of effective examples | T12 | Findings cite owned and outside examples without causal claims | Existing viral tools, qualified metrics |
| Peer relationship workflow | T13 | Supported peer choices use the social ledger | No automated Unfollow |

### XR-21 — Reconcile handoffs and issue status

- **Status:** local reconciliation at review. The October 28 handoff links current ledger evidence and labels historical ARM claims by date. October 29 user-unit reads show growth disabled and Analytics enabled. New launcher stop grace remains versioned only. **Priority:** P1 before operational continuation.
- **Evidence:** engagement notes call the latest fixes uncommitted, but HEAD contains them. Handoffs describe different dated timer and launcher states.
- **Evidence:** the September inventory below still describes lecturer tone as mitigated and unattended execution as missing. Later records qualify both claims.
- **Task:** preserve historical records, identify the current entry point, and label deployment facts with their check dates and hosts.
- **Done when:** a new operator can distinguish local implementation, checked production state, historical outcomes, and pending restart authority from one clear index.
- **Boundary:** documentation changes do not grant authority to restart the operator or watchdog. Check production state before adopting any historical startup command.

### Suggested task order

1. Reconcile evidence and current authority through XR-21. Reproduce XR-18 before code changes rely on the recorded test baseline.
2. Close measurement gaps through XR-01 to XR-04. Check the local fixes through XR-05 and XR-06.
3. Address the confirmed risks in XR-07 and XR-13 within separately scoped changes.
4. Measure reliability and cost through XR-09 to XR-11 and XR-15 to XR-17.
5. Use XR-08, XR-12, XR-14, XR-19, and XR-20 to implement only the selected overhaul deliverables.

The plan retains a separate deployment and restart ticket, T16. This inventory does not complete that ticket or authorize a restart.

## Historical September inventory

The remaining sections preserve the September 5 checkpoint. Read their current-tense statements as dated observations.
The October entries above take precedence where the scopes overlap. Unrelated historical issues require their own revalidation before action.

## Priority summary

| ID | Issue | Class | Priority |
| --- | --- | --- | --- |
| XG-01 | Editorial can select work the distribution owner will reject | observed defect | P1 |
| XG-02 | Follower conversion attribution is incomplete and inconsistently observable | observed gap | P0 |
| XG-03 | Hook experiment exists but lacks enough formal samples | observed gap | P0 |
| XG-04 | Owned technical proof is underrepresented relative to commentary | strategic hypothesis | P1 |
| XG-05 | Hook experiments optimize attention more clearly than follow intent | strategic hypothesis | P1 |
| XG-06 | Writer/reply voice can drift into lecturer mode | observed quality failure | P1 |
| XG-07 | Source selection can spend expensive reasoning on weak distribution objects | observed efficiency problem | P1 |
| XG-08 | Engagement volume can outrun relationship value | observed operating risk | P1 |
| XG-09 | Late or collapsed measurement windows weaken experiment interpretation | observed measurement problem | P0 |
| XG-10 | Live autonomous replies use the configured transport boundary | resolved implementation constraint | P1 |
| XG-11 | Bootstrap distribution surface is not sufficiently tested | observed strategic gap | P0 |
| XG-12 | Growth Focus and understandability gates can collapse development into AI-heavy, hard-to-follow output | observed defect | P0 |
| XG-13 | Audience unfollow still mutates X through private `xactions` HTTP rather than the browser-agent lane | observed transport inconsistency | P1 |
| XG-14 | Stored draft media is not yet an end-to-end browser-agent upload artifact | resolved transport gap | P1 |
| XG-15 | No repository-owned persistent model process consumes browser claims when no agent session is active | observed autonomy gap | P1 |

### 2026-09-05 revalidation

| ID | Current disposition | Evidence / next meaning |
| --- | --- | --- |
| XG-01 | **OPEN — P1 efficiency** | Autonomous preparation skips live-`Ignore` recommendations and continues, so throughput deadlock is fixed; Editorial can still spend reasoning on a source that the live distribution owner will later reject. |
| XG-02 | **OPEN — P0 observation gap** | Growth OS distinguishes account-level follower delta, profile visits, post-attributed follows, and qualification context, but X analytics does not consistently expose enough per-post follow data to optimize the full mission funnel. Missing fields remain unknown rather than zero. |
| XG-03 | **CLOSED / experiment completed insufficient** | Experiment 2 was rechecked at 60m with completed A/B/C counts `1/0/0`; no winner exists. On 2026-09-05 it was completed so insufficient A/B/C evidence no longer production-gates the persona. |
| XG-04 | **OPEN — strategic hypothesis** | Own-account evidence confirms Satori, a trading system, and a Catan neural-engine project surface, while recent output remains commentary-heavy. Whether owned proof converts profile visits/follows better remains unproven. |
| XG-05 | **REFRAMED — strategic hypothesis** | The A/B/C hook campaign is no longer an active production constraint. The useful remaining question is whether any payoff/format/owned-proof treatment increases profile inspection and qualified follow conversion, not whether a clever hook wins attention. |
| XG-06 | **OPEN — October recurrence confirmed on 29 October** | The earlier mitigated label relied on instructions rather than accepted outputs. [Paired October evidence](research/GROWTH_REPLY_QUALITY_REPORT_2026-10-29.md) shows unsolicited technical reviews and missed source details despite social-only permissions. Preserve useful technical answers. Do not impose a universal length or format rule. |
| XG-07 | **OPEN — P1 efficiency** | Distribution fit is checked and unroutable work is skipped, but Editorial can still spend provider/research budget before weak live distribution becomes decisive. |
| XG-08 | **OPEN — P1 operating risk** | Account Health currently remains WATCH on author-response/continuation yield. Budgets are ceilings rather than fill targets and generic filler no longer earns relationship credit, but relationship conversion is still weak. |
| XG-09 | **CLOSED in experiment/Editorial interpretation** | Measurement rows preserve actual capture time; `captureTiming` labels windows that crossed later windows as `collapsed_past_later_window`; age-inappropriate rows are excluded from Editorial cohorts and experiment completion. Historical rows remain descriptive evidence only. |
| XG-10 | **SUPERSEDED / resolved architecture** | The daemon stays API-only, while the persistent Growth Operator owns browser execution. Current browser handoff uses atomic `browser-publish-claim` / `browser-reply-claim`, one-shot execution, structural verification, and `record-action` reconciliation. |
| XG-11 | **OPEN — P0 strategic gap** | Distribution-surface evidence remains sparse/confounded. Do not promote Original vs Quote vs Thread as a law from the current small sample. |
| XG-12 | **CLOSED at the named defect chain** | Growth Focus schema v5 supports editable content/audience groups, derived rotating X queries, exploration, and topic balance. Current probes classify JavaScript/React/Rust/Node/Python as technical scope, and understandability is a separate hard gate. Browser-agent authored writes are required to come from repository-authorized state rather than freehand copy. |
| XG-13 | **OPEN — P1 transport consistency** | `audience.js::unfollowAudienceUser()` still resolves the user and calls `xactions` private HTTP mutation. It is explicit/human-confirmed and not autonomous posting, but it is the remaining hidden X mutation path and can break independently of the browser-agent contract. |
| XG-14 | **CLOSED — browser media handoff implemented** | Draft images remain local/previewable. Immediately before an atomic browser publication claim, Growth OS registers only the exact current `.x-media` attachment as logical artifact `x-growth.queue.<id>.media`; a lost claim removes it, successful reconciliation requires proof that exact artifact was attached and removes the allowlist entry, and `browser-fast` still rejects arbitrary paths. The background X API route correctly remains local-media-incapable. |
| XG-15 | **OPEN — P1 unattended execution** | `automation.js` can research/prepare/schedule indefinitely, but it cannot create or wake a browser-capable model turn. Browser publication works while a persistent Growth Operator agent is active; true unattended browser execution needs a durable CLI-agent consumer or another model-runtime owner. |

## XG-01 — Editorial can select work the distribution owner will reject

**Class:** observed defect  
**Priority:** P1  
**Primary owner:** `editorial.js` / autonomous main-feed selection boundary; live distribution recommendation remains owned by `pipeline.js` / strategy scoring.

### Problem

Editorial can produce a high-ranked `PREPARE` recommendation for a source that the live distribution owner currently recommends `Ignore`.

The concrete failure occurred with the Xcode/headless-MCP recommendation. Editorial marked it `PREPARE`, but `routeCandidate()` refreshed the live recommendation and correctly rejected the mission-agent route with:

`This opportunity is currently recommended Ignore. Choose “Use anyway” and provide a reason before routing it into authored or repost work.`

Before commit `cdb2f86`, that one stale `PREPARE` recommendation could block the whole autonomous Writer cycle.

### Current mitigation

Commit `cdb2f86` makes autonomous preparation skip a `PREPARE` recommendation when mission routing rejects it specifically because the current recommendation is `Ignore`, then try the next candidate. It does not grant `Use anyway` authority.

This prevents a dead-end recommendation from blocking all preparation, but it does not remove the upstream disagreement.

### Impact

- Editorial spends reasoning and research budget on work that cannot enter production.
- A high-ranked but unroutable recommendation can displace stronger candidates during selection.
- The operator has to reason about two conflicting recommendation systems.

The `cdb2f86` mitigation removed the production-deadlock consequence, so this is now an efficiency/selection defect rather than a current P0 throughput blocker.

### Desired condition

Editorial and live distribution may still disagree, but the disagreement must be explicit before expensive preparation becomes the chosen production path. An unroutable source must not occupy the effective top production slot.

---

## XG-02 — Follower conversion attribution is incomplete and inconsistently observable

**Class:** observed gap  
**Priority:** P0  
**Primary owner:** account analytics ingestion + Growth OS measurement/learning path.

### Problem

The mission objective is qualified follower growth. Growth OS already stores profile visits, new follows, publication follower baselines, follower deltas, and `associated_follows_per_1000_views`, but those later-funnel signals are not consistently available or attributable to a specific output.

The useful funnel is:

`impressions -> engagement -> profile visits -> new follows -> qualified follower / relationship outcome`

The gap is therefore not absence of follower-conversion machinery. It is incomplete observation and weak attribution, especially when account-level follower changes cannot be tied confidently to one post.

### Evidence

Recent decisions have had to rely on observations such as:

- views;
- likes;
- visible engagement per 1,000 views;
- associated follower snapshots.

Those signals can distinguish a dead post from an engaging post, but they do not reliably distinguish high-reach content from content that causes people to inspect and follow the account.

### Impact

- The system can optimize a proxy while missing follower conversion.
- A high-impression post can look successful even if it produces no profile visits or follows.
- A lower-reach post with strong follow conversion can be undervalued.
- Learned Strategy cannot confidently optimize the mission reward hierarchy.

### Desired condition

For important recent outputs and active experiments, Growth OS should compare matched-age impressions, engagements, profile visits, and follows without treating missing analytics fields as zero. It should distinguish account-level follower delta from post-attributed follows and, where audience observation supports it, record whether new followers are qualified for the target niche.

---

## XG-03 — Hook experiment exists but lacks enough formal samples

**Class:** observed gap  
**Priority:** P0  
**Primary owner:** experiment assignment + main-feed production cadence + measurement.

### Problem

Experiment 2, `First-1,000 audience psychology hooks A/B/C`, is active and production-gated, but the formal Experiment-2 sample is still too small to support a treatment decision.

Variants are:

- A — insider contrast;
- B — hidden constraint;
- C — decision test.

The intended initial exploration is balanced rather than winner-take-all.

### Evidence

Bridge-cohort observations exist, but they are not formal Experiment-2 evidence:

- queue `3276`, A-like GitHub Copilot Quote: about 19 views and 0 visible actions by its stored 360-minute row;
- queue `3245`, C-like Unsloth GLM-5.3 Quote: 32 views and 2 likes in a late shared capture, about 62.5 visible engagements per 1,000 views;
- queue `3223`, B-like agent-extension Thread: published and reconciled, with measurement lag observed during the operating session.

These posts differ in source, format, timing, hashtag treatment, and measurement quality. They cannot identify a winning hook treatment.

### Impact

- A/B/C exists as production machinery without yet producing the evidence needed to tune production.
- One interesting result can be mistaken for a winner.
- The system can accumulate experiment complexity without changing decisions.

### Desired condition

Collect 3–5 completed formal posts per treatment at matched 60m, 360m, and 1440m windows before making an initial directional production adjustment. Do not name or promote a winner from this sample: assignments are caller-selected and the posts remain observationally confounded. The experiment engine's 20-completed-per-variant threshold remains the bar for repeated observational evidence, still not causal proof. If the 3–5-post read is mixed, continue balanced exploration.

---

## XG-04 — Owned technical proof is underrepresented relative to commentary

**Class:** strategic hypothesis  
**Priority:** P1  
**Primary owner:** Editorial / Research Agenda / content strategy.

### Problem

A large share of candidate activity comes from reacting to external AI/model/tool news through Quotes and Replies. This can borrow distribution, but it may not create enough account-specific reason to follow `@ham_zax`.

The hypothesis is that more owned proof would improve qualified follow conversion: real experiments, implementation findings, architecture observations, benchmarks we actually ran, failure modes we reproduced, repository findings, or compact technical artifacts.

This is not yet established as a performance law.

### Why it matters

A reader can agree with a commentary post and still have no reason to follow the author. Owned proof can demonstrate a repeatable capability or perspective that is specific to the account.

### Risk

Owned proof should remain a distinct content treatment from externally anchored commentary.

### Desired condition

The main-feed mix contains enough verified owned technical evidence to compare its profile-visit and follow conversion against externally anchored commentary at similar account stage and post age.

---

## XG-05 — Hook experiments optimize attention more clearly than follow intent

**Class:** strategic hypothesis  
**Priority:** P1  
**Primary owner:** Writer strategy / experiment design.

### Problem

The current hook system is good at defining psychological pull: insider contrast, hidden constraint, decision test, concrete consequence, or sharp question.

Those treatments are primarily designed to win the next few seconds of attention. They do not yet explicitly test whether the payoff makes the reader expect repeated future value from the account.

### Risk

Prefer specific account value and natural calls to action over generic copy templates.

### Desired condition

Future experiments can distinguish scroll-stopping performance from profile/follow conversion and determine whether some payoff structures create a stronger reason to inspect or follow the account.

---

## XG-06 — Writer/reply voice can drift into lecturer mode

**Class:** observed quality failure  
**Priority:** P1  
**Owners:** `engagement.js` selects contributions. `drafting.js` and `persona.js` supply Writer defaults. `autonomous_reply.js` uses the Writer prompt. The attached brief and `agent_bridge.js::act` also support operator-written replies. `x_reads.js` and the approved XActions normalization boundary own source fidelity. `docs/POST_GENERATION_PROMPT.md` alone does not cover every reply path.

### 29 October evidence and current disposition

XG-06 is open. The [detailed report](research/GROWTH_REPLY_QUALITY_REPORT_2026-10-29.md)
preserves the available October corpus and 22 assessed exchanges. The problem
includes unsolicited evaluator roles, questions partly or fully answered by the
source, unsupported defect implications, and selected-purpose/output mismatches.

The later [bounded pilot](research/voice-audit-2026-10-29/pilot/REPORT.md) tests
current static guidance and two candidate changes. Some individual replies improve.
Neither candidate earns promotion. Removing three systems-focused persona cues
does not eliminate the general lesson. Full source text also leaves evaluator
comparisons. Useful direct answers survive. No fixed sentence pattern or advice
ban follows from these mixed results.
Several connected technical replies remain useful controls. No percentage of bad
replies or causal growth effect is established.

The current installed XActions parser omits extended note text. The general
contribution fallback prefers technical and learning candidates. Missing Writer
archetypes default to synthesis. These are current checked facts and plausible
contributors. They do not prove every historical generation input or one universal
cause. The parser pin postdates the published replies.

No source, prompt, persona, production brief, or policy changes in this reporting
step. Future work needs paired offline comparison and owner feedback. Missing
new biography is not a reason to postpone correcting demonstrated failures.
The earlier direction below remains history, not proof of mitigation.

The [integrated offline experiment](research/voice-audit-2026-10-29/integrated-harness/REPORT.md)
adds a reusable model/prompt benchmark. The native cycle keeps the baseline.
No voice repair earns production acceptance. Optional review calibration stops
classifying a congratulation as a fact while retaining unsupported product claims.
Selected behavior is the next proposed variable to isolate, not a proven cause.

Later user-authorized [Reply contract integration](research/REPLY_CONTRACT_INTEGRATION_2026-10-31.md)
adds the compact Reply schema/persona projection, canonical instructions shared
by Writer and direct operator, and contextual attribution for the exact parent
on reviewed Replies. The Writer role now selects saved Luna5.6 max profile1.
This supersedes the earlier report-only implementation hold. It does not close
XG-06 or prove reliable 24x7 quality. Cheap checker trials retain known misses and
do not install a new automatic critic. No public send occurs in the integration.

### Problem

Several replies and draft directions drifted toward mini-essays: polished explanations, packaged takeaways, and advice to “developers” rather than participation in the actual conversation.

The user explicitly rejected this style.

### Current direction

The standing voice is builder-to-builder:

- conversational;
- shorter;
- lowercase when natural;
- contractions and fragments allowed;
- casual punctuation and shorthand allowed when natural;
- occasional tiny imperfections allowed when they arise naturally;
- curiosity, reaction, disagreement, or a specific observation before explanation.

Commit `6a630f2` made the autonomous Writer prompt more conversational, and the private X-content voice memory was updated in the same operating session.

### Impact

Lecturer copy can make the account sound generic, over-produced, and socially detached from the thread. It also creates repeated structural patterns that are easy to notice across posts.

### Desired condition

Main-feed posts still carry a clear thesis and evidence, but replies and short-form observations read like a builder participating in X rather than publishing a lesson plan.

---

## XG-07 — Source selection can spend expensive reasoning on weak distribution objects

**Class:** observed efficiency problem  
**Priority:** P1  
**Primary owner:** discovery ranking + Editorial candidate selection.

### Problem

Technically interesting, very fresh sources can enter expensive Editorial analysis even when their live distribution is tiny and there is no exceptional owned contribution that justifies ignoring that weakness.

The Xcode/headless-MCP source was the clearest example: the topic was highly relevant and novel, but the source had only about 11 visible views when inspected. The live distribution layer therefore rejected it.

### Impact

- AI/editorial cycles are spent on low-leverage objects.
- Stronger current sources can wait behind novelty-heavy weak-distribution candidates.
- The operator spends time verifying and researching stories that will not route.

### Desired condition

After a candidate is eligible to route, low-distribution sources should win expensive Editorial attention only when they offer unusually strong owned-proof value, primary evidence, or a durable Original that does not depend on borrowed distribution. Otherwise, source momentum should lower their effective production priority earlier.

This is distinct from XG-01: XG-01 is a contract disagreement about whether a candidate can route at all; XG-07 is ranking efficiency among candidates that can legitimately proceed.

---

## XG-08 — Engagement volume can outrun relationship value

**Class:** observed operating risk  
**Priority:** P1  
**Primary owner:** Engage Next / Relationship Intelligence / operator policy.

### Problem

A numeric engagement budget can encourage the system to keep finding another reply after the useful conversation seam is already weak.

During the expanded run, the operator encountered cases where a candidate technically remained available but was not worth forcing. The better behavior was to skip weak opportunities and wait for a thread where the account had a distinct question or observation.

Account Health was also in `WATCH` with weak author-response / conversation-continuation signals during the operating period.

### Impact

- More replies do not necessarily create more relationships.
- Repetitive reply structure can increase.
- Low-value interactions consume operator attention that could go to owned content or stronger targets.

### Desired condition

Engagement decisions should favor repeated interaction with relevant builders, maintainers, researchers, and tool authors, and should evaluate author response, continuation, profile visits, follows, and relationship-stage movement rather than reply count alone. Engagement and publishing budgets are ceilings, not fill targets; weak opportunities can be skipped while capacity stays available for stronger targets.

---

## XG-09 — Late or collapsed measurement windows weaken experiment interpretation

**Class:** observed measurement problem  
**Priority:** P0  
**Primary owner:** publication measurement scheduling/capture.

### Problem

Some nominal 15m, 60m, and 360m publication windows were captured late or at the same actual timestamp after the service caught up.

For example, queue `3245` recorded multiple nominal windows from one late shared observation. The data is still useful as a descriptive snapshot, but those rows are not independent matched-age measurements.

### Impact

- A/B/C comparisons become less trustworthy when several nominal windows come from one actual observation.
- Repeated rows can look like a time series when they are one observation copied into several due windows.
- Experiment summaries currently count the presence of each nominal-window row as a completed observation even when several rows share one late capture.

`views_per_hour` itself already uses actual elapsed time from `capturedAt - publishedAt` when those timestamps are present, so the problem is not its denominator.

### Desired condition

Keep the existing actual capture timestamp, but classify capture lateness and collapsed observations explicitly. Matched-window experiment comparisons should use genuinely distinct age-appropriate observations where available and exclude or downgrade nominal windows satisfied by the same late capture.

## XG-10 — Live autonomous replies use the configured transport boundary

**Class:** resolved implementation constraint
**Priority:** P1  
**Primary owner:** autonomous reply transport / operator authority.

### Problem

The autonomous reply operator can continuously discover, score, draft, gate, deduplicate, claim, record, and send reply decisions through the configured Clearcote browser UI transport.

### Impact

- Dry run evaluates growth opportunities without sending.
- Live mode can execute eligible decisions while an explicit grant and budget remain active.
- Exact persisted text/provenance, deduplication, health checks, and atomic claims remain inspectable.

### Desired condition

Keep autonomous discovery, writing, quality gates, dedupe, Account Health checks, atomic claims, exact persisted text/provenance, explicit live budgets, and operator Start/Pause/Stop controls around the configured transport.

## XG-11 — Bootstrap distribution surface is not sufficiently tested

**Class:** observed strategic gap  
**Priority:** P0  
**Primary owner:** Editorial / experiment design / distribution strategy.

### Problem

At the current account size, format and distribution surface may affect reach more than fine-grained hook treatment. Existing First-1,000 observations already show large differences between standalone Originals and Quotes, but those samples are confounded by topic, timing, copy, momentum, and other variables.

Owned proof and borrowed distribution are separate decisions. A technically original contribution does not have to be published as a standalone Original; it can also be delivered through a high-momentum Quote or another borrowed-distribution surface.

### Evidence

`docs/FIRST_1000_GROWTH_MODE.md` records one standalone Original at roughly 2 impressions after about 32 minutes, another no-hashtag Original at 8 impressions / 1 engagement after roughly 14 hours, and a Quote at 67 impressions / 6 engagements / 3 detail expands after roughly 9 hours.

Those observations do not establish causality, but they are strong enough to make distribution surface an explicit production variable rather than assuming all formats provide comparable discovery.

### Impact

- Hook experiments can optimize copy inside a weak distribution surface.
- More owned technical proof can be misread as a reason to publish more standalone Originals even if borrowed distribution is currently more effective.
- Small-account reach can remain the binding constraint while the system spends effort tuning downstream copy variables.

### Desired condition

Run explicit matched-age comparisons across distribution surfaces such as Original, Quote, and other eligible main-feed formats. Track reach, profile visits, follows, and qualified-follower outcomes separately from hook treatment. Do not promote a preferred surface from isolated posts; require repeated directional evidence under reasonably comparable conditions.

## XG-12 — Growth Focus and understandability gates can collapse development into AI-heavy, hard-to-follow output

**Class:** observed defect
**Priority:** P0
**Primary owner:** Growth Focus profile/taxonomy, X discovery query construction, operator candidate ordering, deterministic drafting gates, and outbound browser mutation boundary.

### Problem

The intended niche is software development and building, with AI-assisted development as one important pillar. The production path can instead converge on AI-heavy content and still approve copy that a normal software developer has to decode.

The defect is a chain rather than one bad prompt:

- Growth Focus stores editable terms but `setActiveNicheProfile()` rebuilds the profile from a fixed default group list, so categories cannot actually be added or removed;
- content classification is narrower than audience classification, so ordinary JavaScript, React, Rust, frontend, and backend content can score zero while AI-agent/model content matches multiple weighted groups;
- X search queries are maintained separately from Growth Focus and the fast momentum path takes the first two fixed query buckets, which are AI-heavy;
- `growth-next` ranks momentum/reach without a configurable recent-topic balance term;
- deterministic `scannability` checks layout rather than one-pass comprehension, so jargon-heavy copy can pass;
- repository browser transports are quality-gated when entered through queue/reply workflows, but an operator can still compose freehand in an authenticated browser unless the governing workflow explicitly forbids that bypass.

### Evidence

Representative current classifier probes before this repair:

- `JavaScript performance tips for the browser` -> score `0`;
- `React 20 improves frontend rendering` -> score `0`;
- `Rust makes this backend service faster` -> score `0`;
- `Node.js API with Fastify` -> score `16`;
- `Python FastAPI backend` -> score `16`;
- `Claude Code with Qwen for coding agents` -> score `34`.

A shortened version of the rejected Vercel reply remained `44/50`, `strong`, and publishable under the existing deterministic gate once unrelated length/current-classification blockers were removed. The gate therefore did not encode the human requirement that a competent general software developer should understand the point on one pass.

### Impact

- Topic selection can recursively train itself toward AI because discovery, saved preferences, and source momentum all see the same skewed pool.
- The account can describe itself as a developer account while ordinary development topics are under-discovered or classified outside focus.
- A technically correct post can still reduce follow conversion because the reader has to translate internal engineering vocabulary before receiving the payoff.
- Prompt-only voice corrections are not reliable because the transport/operator can bypass them.

### Desired condition

Growth Focus is the single configurable preference/scope source of truth. Content groups can be added, removed, renamed, reweighted, and assigned a target share without code changes; audience groups define a broader technical universe for open-world exploration. Registered topics receive preference, but an unregistered technical topic may still enter discovery and compete on momentum without first becoming a permanent niche. Discovery queries are derived from both configured preferred groups and the configurable broader technical scope rather than a fixed AI-first list. Candidate ordering exposes a bounded topic-balance adjustment instead of silently repeating the dominant category.

Every authored outbound item must also pass an understandability gate that is separate from visual scannability. This gate does not require a plain or neutral voice; humor, technical language, attitude, and stylistic variation are allowed when the point still lands on one read. Repository-owned browser transports may only send text carrying current approval/gate provenance, and the live operator must not type freehand authored copy directly into X.

## XG-13 — Audience unfollow still uses private X HTTP mutation

**Class:** observed transport inconsistency

**Priority:** P1

**Primary owner:** `audience.js` + Audience UI/browser-operator workflow.

### Problem

`unfollowAudienceUser()` still resolves the target through `xactions` and calls its private Twitter HTTP unfollow helper. The operation is explicitly user-confirmed and never runs from the autonomous Growth Operator, so this is not an authorization bypass. It is nevertheless the one remaining production X mutation path that depends on X private HTTP/GraphQL behavior instead of the browser-agent or official-API execution planes.

### Impact

- X private endpoint changes can break Audience cleanup independently of the browser workflow.
- The product has two different mutation-recovery models: browser actions use visible-state verification and no blind retry, while unfollow currently trusts the private HTTP success response.
- Future agents may incorrectly infer that private X mutation is an approved general fallback because one production path still uses it.

### Desired condition

When Audience cleanup is next implemented, route an explicitly confirmed single-account unfollow through a browser-agent execution packet with the same pre-action identity check, one-shot click, post-action visible-state verification, and local reconciliation used by the Growth Operator. Until then, keep the private mutation isolated to this explicit human action and do not reuse it as a posting/engagement transport.

## XG-14 — Draft media browser-agent artifact handoff — resolved

**Class:** resolved transport gap

**Priority:** P1 historical

**Primary owner:** draft-media storage + persistent browser-agent execution boundary.

Growth OS stores validated operator-uploaded JPEG/PNG/WebP/GIF files under `.x-media` and exposes preview/readiness state. The background official API transport intentionally rejects local media. `browser-fast` continues to reject arbitrary filesystem paths and accepts uploads only through logical names in its approved-artifact manifest.

The missing seam is now closed without widening that filesystem boundary. Upload stores a SHA-256 content hash in the approval material. `browser-publish-claim` resolves only the exact current attachment under `.x-media`, recomputes and matches those bytes against the approved hash, registers it as `x-growth.queue.<queueItemId>.media`, then atomically claims the queue row. Growth OS serializes its own manifest updates so concurrent Growth OS claims preserve unrelated entries. If the queue claim loses, the artifact entry is removed. The claim packet returns only the logical artifact plus sanitized attachment metadata, not the local path. `record-action` requires `mediaAttached=true` and the exact logical artifact before reconciliation, then removes the temporary allowlist entry; a cleanup failure is returned explicitly rather than hidden. Unknown remote outcomes stay in-flight so the same claimed capability can be reconciled rather than blindly retried.

Reopen this issue only if claim-scoped artifact cleanup, path confinement, or structural media verification regresses.

## XG-15 — Browser execution is not unattended without a running model agent

**Class:** observed autonomy gap

**Priority:** P1

**Primary owner:** persistent Growth Operator runtime, not `automation.js`.

The Node daemon owns deterministic refresh, preparation, scheduling, measurements, and API-only publication. The browser-agent lane is intentionally owned by a model/agent because it must re-observe dynamic X UI state, reason about the target/source, use current refs, verify structured effects, and reconcile unknown outcomes. A local wait or timer does not create a future model turn.

Current consequence: if no ChatGPT/CLI Growth Operator session is active, browser-authorized work can remain ready/eligible indefinitely; the daemon cannot wake the browser agent. This is not a queue bug.

Desired condition if unattended browser operation is required: run a durable CLI-agent/model consumer using `PERSISTENT_GROWTH_OPERATOR_PROMPT.md` with the same Growth OS bridge and browser-fast MCP contract. Do not make `automation.js` pretend to be the reasoning/browser owner or reintroduce brittle raw-selector posting.

## Current dependency order

Closed items no longer occupy the frontier. The current order is:

1. **XG-02** — improve later-funnel observation where X actually exposes it; keep missing profile/follow data unknown rather than manufacturing attribution.
2. **XG-11** — accumulate enough matched-age distribution-surface evidence to learn whether Original/Quote/Thread placement changes reach or conversion at the current account stage.
3. **XG-08** — improve author response, conversation continuation, and recurring-relationship yield instead of filling reply capacity.
4. **XG-01 / XG-07** — reduce expensive Editorial work on candidates that live distribution will reject or that have weak leverage without owned-proof value.
5. **XG-04 / reframed XG-05** — test verified owned proof and profile/follow payoff without forcing one hook morphology.
6. **XG-15** — only if unattended browser execution is a product requirement, add a durable CLI-agent consumer rather than expanding the deterministic daemon into a browser reasoner.
7. **XG-13** — migrate the explicit Audience unfollow mutation away from private X HTTP when that workflow is next touched.
8. **XG-06** is open on the 29 October paired audit. This older ordering does not set its current priority. XR-14 now records the owner's active reply-quality investigation. Preserve useful technical answers while correcting source comprehension and unsolicited reviewer roles.

Closed/superseded items XG-03, XG-09, XG-10, XG-12, and XG-14 should be reopened only with concrete regression evidence.

This order is a triage view, not authorization to turn hypotheses into permanent strategy rules.

## Current non-issues

Do not reopen these without new evidence:

- the retired A/B/C hook experiment as though it still needs a winner;
- fixed first-line, fixed block-count, or mandatory hidden-constraint morphology;
- late nominal measurement rows that are already classified/excluded from matched-age completion;
- Growth Focus configurability or general software-topic inclusion based on the old pre-schema-v5 probes;
- the legacy Clearcote/xactions post writer as an eligible fallback—it is intentionally disabled, not a growth lever;
- mission-agent approval snapshots merely because growth is slow.

The current growth bottleneck is not established to be any one copy template, one transport, or one X-ranking mechanism.

October 29 delivery: implementation and tests are committed as ea09e0f. Earlier
working-tree descriptions record their prior checkpoint. TASKS.md owns the current
remaining acceptance. CloakBrowser launch passes through x_browser.js. The live
operator CDP browser remains a separate Chromium instance.
