# Task Analysis

**Scope:** Wave 1 research package for the current React product at commit `004f7fcc9eb9`.

This document describes user tasks in terms of decisions and outcomes, not current module names. It is a research input, not a record of participant findings.

## Evidence discipline

Three evidence classes are kept separate throughout this document:

- **Repository-observed** — behavior or authority visible in the current React/backend implementation.
- **Stakeholder-stated** — desired product purpose or constraint stated in the UX/HCI program and Wave 1 coordination material.
- **Research hypothesis** — a proposition that must be tested with representative users; it is not a finding or preference.

No interviews, task observations, usability sessions, card sorts, or tree tests have been completed for this package.

## Outcome frame

### Stakeholder-stated product purpose

The product should help a human operator turn relevant AI/developer/builder attention into durable audience capital and, eventually, observable business opportunities. The default strategic target is **qualified growth velocity**, not raw reach or likes.

The intended outcome hierarchy is:

1. actual recorded business outcomes, when they exist;
2. relevant audience growth;
3. relationship outcomes;
4. durable content value;
5. distribution;
6. vanity interaction.

### Repository-observed measurement boundary

The current product measures audience state, newly observed relevant followers, conversations, fixed-window post outcomes, attribution confidence, experiments, and learned rules. It does **not** currently persist a business-opportunity/revenue outcome ledger.

Therefore the current product can support statements such as “relevant followers increased” or “this post had an associated follower change with low isolation confidence.” It cannot truthfully claim that a post generated a customer, partnership, or revenue event unless that outcome is recorded elsewhere by the operator.

### Research implication

A participant must be able to distinguish:

- “the account is attracting a more relevant audience” from “this generated a business opportunity”;
- an observed association from a causal claim;
- external niche patterns from results measured on this account.

Failure to make those distinctions is a task/comprehension defect, not merely a terminology preference.

## Hierarchical task analysis

### 0. Operate the growth system under human control

**Goal:** identify worthwhile work, act deliberately, understand consequences, and learn from observable outcomes without needing to understand internal software architecture.

#### 1. Orient to what matters now

1.1 Determine whether anything requires a human decision.

1.2 Separate urgent decisions from optional opportunities and status information.

1.3 Notice account constraints that can block a later action.

1.4 Identify the next useful task without reconstructing state from several modules.

**Repository-observed:** Today exposes an attention count, account status, active conversations, posts awaiting review, recent interaction/follower indicators, editorial recommendations, and attention cards.

**Research hypothesis:** a first-time or occasional operator can understand the difference between “worth looking at” and “requires my decision” without learning queue/status vocabulary first.

#### 2. Evaluate an editorial opportunity

2.1 Understand the underlying signal or story.

2.2 Understand why it is relevant now.

2.3 Understand the proposed contribution or thesis.

2.4 Inspect supporting source/evidence when needed.

2.5 Distinguish recommendation from human selection.

2.6 Choose to use, research further, dismiss, or leave the opportunity alone.

**Repository-observed:** the AI Editorial Plan can return `PREPARE`, `RESEARCH_MORE`, or `SKIP`; recommendation cards expose rationale, sources, evidence, risks, alternatives, source freshness, and AI provenance. Selecting a recommendation records a human selection and routes work; it does not approve or publish it.

#### 3. Choose what a signal should become

3.1 Decide whether to create an Original post.

3.2 Decide whether the source is better handled as a Thread.

3.3 Decide whether to add commentary with a Quote post.

3.4 Decide whether to continue a conversation with a Reply.

3.5 Decide whether a Repost is appropriate.

3.6 Decide whether more Research is required before any publication route.

3.7 Pause or skip work that is not worth pursuing.

**Repository-observed:** current routing supports original, quote, thread, reply, repost, research, watch/pause, and ignore/skip. A `RESEARCH_MORE` editorial selection is required to enter the research route first. Repost completion is manual and is only recorded after an explicit human confirmation.

**Research hypothesis:** users think about these as content/contribution choices rather than “pipelines” or “routes.”

#### 4. Prepare and review authored content

4.1 Generate a draft or write/edit it directly.

4.2 Verify the exact wording that may later be sent or published.

4.3 Inspect writing-quality feedback and blockers.

4.4 Verify factuality.

4.5 Verify evidence when the draft contains claims that require it.

4.6 Resolve media requirements where applicable.

4.7 Save without confusing save with approval or publication.

**Repository-observed:** Writer generation is advisory, generated text remains editable, factuality/evidence checks can block readiness, quality is recalculated from the edited text, and saving does not approve or publish. Published/sent text becomes read-only historical state.

#### 5. Move content through consequential states

5.1 Check whether the current draft is ready for human approval.

5.2 Approve the exact content only after required confirmations pass.

5.3 Understand whether approval creates an immediate transport action or only a later eligible state.

5.4 Review or override an advisory publishing time.

5.5 Understand a scheduled/waiting state.

5.6 Understand when publication has started.

5.7 Distinguish published from failed or transport-complete/local-recording-incomplete states.

5.8 Recover safely when a consequential action fails.

**Repository-observed:** main-feed approval is separate from publication. Scheduler output is advisory. With automation off, nothing is auto-published. With automation on, approved eligible work may later be claimed and transported by the automation process. Replies have their own explicit human-approval/send path. Published work cannot be rerouted or discarded backward.

#### 6. Continue a worthwhile conversation

6.1 See active conversations before new opportunities.

6.2 Understand what concrete value could be added.

6.3 Review the source and relationship context.

6.4 Generate/edit a reply.

6.5 Check readiness.

6.6 Approve and send the exact reply, or send an already approved reply.

6.7 Skip or expire a conversation that is no longer useful.

6.8 Understand when account constraints prevent sending.

**Repository-observed:** reply text must be explicitly human-approved before send; changing approved text invalidates approval. Transport failure records a failed state instead of optimistic success.

#### 7. Diagnose blocked, failed, or ambiguous work

7.1 Identify what failed or is blocking progress.

7.2 Determine whether any irreversible side effect occurred.

7.3 Determine whether retry is safe.

7.4 Determine whether the human must change content, evidence, settings, or account state.

7.5 Determine the next valid state transition.

**Repository-observed:** product surfaces expose writing/evidence blockers, account constraints, source-refresh errors, research-job failures, publication failures, and some reconciliation states. Recovery language is not consistently action-specific across all surfaces.

**Research hypothesis:** the highest-risk failure is not the presence of an error message but inability to tell whether X already received the action.

#### 8. Discover worthwhile signals

8.1 Review unresolved candidates across sources.

8.2 Narrow by source/topic when useful.

8.3 Inspect freshness and source movement.

8.4 Understand why a candidate matches the target niche.

8.5 Distinguish live source snapshots from persisted work history.

8.6 Bookmark, act, pause, skip, or revisit handled work.

**Repository-observed:** Discover combines X latest, X momentum, opportunities, GitHub Trending, Hacker News, bookmarks, handled items, and persisted history. Some source tabs auto-refresh when initially empty; errors can preserve the prior snapshot.

#### 9. Understand recent performance and audience quality

9.1 Determine whether the target audience is growing.

9.2 Inspect the quality of newly observed followers.

9.3 Determine whether conversations are producing useful continuation.

9.4 Review recent post outcomes.

9.5 Understand attribution/isolation caveats.

9.6 Inspect exact fixed-window measurements only when needed.

**Repository-observed:** the product shows account/audience state, newly observed relevant followers, conversation outcomes, measured post outcomes, and descriptive editorial cohorts. It explicitly states that associated follower change is not direct post causality.

#### 10. Learn what is currently working outside this account

10.1 Choose the historical period and niche scope to study.

10.2 Run a bounded external research job.

10.3 Understand that collection may continue after the current interaction/session.

10.4 Review progress and recover from collection/AI-analysis failure.

10.5 Identify repeated or directional external associations.

10.6 Distinguish communicative intent from presentation style.

10.7 Inspect examples, sample size, author comparison, and observational limitations when needed.

**Repository-observed:** Viral Styles is read-only X research with bounded collection, optional AI semantic classification, explicit checkpoints, stop semantics, observational evidence classes, and technical comparison statistics.

**Research hypothesis:** ordinary operators need scope/depth choices before discovery floors, same-author controls, runtime, exact model, and reasoning controls.

#### 11. Learn what works for this account

11.1 Review measured outcomes from this account.

11.2 Separate AI-recommended format, human-selected format, and final published format.

11.3 Review suggested/accepted/retired learned rules.

11.4 Determine what evidence supports a learned suggestion.

11.5 Understand what production behavior would change if a suggestion were accepted.

11.6 Retire a learned change when it is no longer appropriate.

**Repository-observed:** suggested learned rules have zero production effect; accepted rules are bounded; retired rules have zero production effect. Acceptance requires qualified evidence and remains separate from approval/publication authority.

#### 12. Run a focused test

12.1 State what is being changed and what should be learned.

12.2 Choose options and a success measure.

12.3 Activate a test before assignment.

12.4 Explicitly assign a specific work item to a specific option.

12.5 Review observations and evidence state.

12.6 Complete the test when no more assignments should be made.

12.7 Check whether a measured pattern qualifies for a learned suggestion.

**Repository-observed:** experiments are explicit, not randomized, and do not create duplicate posts. A test or assignment never approves, schedules, sends, or publishes content.

#### 13. Decide whether learned writing guidance should influence a draft

13.1 Compare external niche evidence, internal account evidence, and experiment evidence.

13.2 Understand why a strategy may or may not fit the current opportunity.

13.3 Choose to ignore guidance, see it only as a suggestion, or deliberately apply it to generation.

13.4 Review whether the resulting draft was actually influenced by that strategy.

13.5 Remove or change the strategy before approval.

**Stakeholder-stated / future:** this is the proposed `Off / Suggest / Apply` writing-strategy contract.

**Repository-observed:** no current writing-strategy selection or application authority exists in the React/backend product inspected for this package. Current Writer generation receives editorial/evidence/profile context but not the future durable strategy-selection contract.

#### 14. Configure advanced system controls

14.1 Edit what topics/audience signals define the niche.

14.2 Configure AI profiles, runtimes/providers/models, credentials, fallbacks, and role assignments.

14.3 Test model/provider connections and inspect usage/provenance.

14.4 Inspect detailed relationship/account-health diagnostics.

**Repository-observed:** these controls exist under Diagnostics/advanced routes and expose technical runtime/provider/model terminology.

**Research hypothesis:** advanced controls should remain reachable without becoming required knowledge for ordinary research, writing, or performance-review tasks.

#### 15. Determine whether growth is producing actual business value

15.1 Identify the strategic business purpose for growth.

15.2 Distinguish audience/relationship proxies from a directly observed opportunity or revenue event.

15.3 Review linked business outcomes when and only when such outcomes are actually recorded.

**Stakeholder-stated / future:** a bounded business-outcome ledger is planned before the product can claim opportunity/revenue optimization.

**Repository-observed:** no such ledger currently exists.

## Priority by frequency, consequence, and likely confusion

Priority is qualitative. It is intentionally not converted to a synthetic numeric score before baseline user research exists.

| User task | Primary role | Expected frequency | Consequence of error | Likely confusion risk | Research priority | Evidence basis |
|---|---|---|---|---|---|---|
| Orient to what needs attention | Daily operator | Very high | Medium | High | P0 | Stakeholder-stated + current Today surface |
| Evaluate an editorial recommendation without confusing it with approval | Daily operator | High | High | High | P0 | Repository-observed authority separation |
| Choose Original / Thread / Quote / Reply / Repost / Research | Daily operator | High | High | High | P0 | Repository-observed routing choices |
| Review/edit a generated draft and understand blockers | Daily operator | High | Very high | High | P0 | Repository-observed gates and human confirmations |
| Predict review vs approval vs send/publish consequences | Daily operator / occasional reviewer | High | Very high | Very high | P0 | Repository-observed multiple consequential states |
| Continue and explicitly send a reply | Daily operator | High | Very high | High | P0 | Repository-observed explicit approval/send path |
| Recover from failed or ambiguous publication/send | Daily operator | Occasional | Very high | Very high | P0 | Repository-observed transport/reconciliation states |
| Understand optional writing-strategy influence before generation | Daily operator | High once implemented | High | High | P0 | Stakeholder-stated future requirement |
| Discover a worthwhile signal | Daily operator | High | Medium | Medium | P1 | Repository-observed multi-source Discover surface |
| Understand recent performance and audience quality | Operator / stakeholder | Medium | Medium | High | P1 | Repository-observed metrics + attribution caveats |
| Separate external winning patterns from what works for this account | Operator / stakeholder | Medium | High | Very high | P1 | Stakeholder-stated evidence architecture |
| Understand external style vs communicative intent | Operator | Occasional | Medium | High | P1 | Repository-observed Viral Styles taxonomies |
| Decide whether a learned pattern is credible | Operator / stakeholder | Occasional | Medium | High | P1 | Repository-observed evidence states/learned rules |
| Distinguish relevant-audience proxy from actual business opportunity/revenue | Stakeholder | Medium | High | Very high | P1 | Stakeholder-stated success hierarchy + current gap |
| Create/activate/assign a test | Advanced operator | Low | Medium | Medium | P2 | Repository-observed explicit experiment workflow |
| Configure niche/audience definitions | Advanced operator | Occasional | High | Medium | P2 | Repository-observed advanced setting |
| Configure AI runtime/provider/model | Advanced operator | Rare | High | Medium | P2 | Repository-observed advanced setting |
| Inspect raw diagnostics/provenance | Advanced operator | Rare | Medium | Low for intended expert | P3 | Repository-observed advanced detail |

## P0/P1 task success evidence to collect later

The following are research measures, not current results or targets:

- whether the participant reaches the intended information/action without coaching;
- wrong first destination and the competing destination chosen;
- backtracking and repeated navigation;
- hesitation or explicit “I do not know” responses;
- whether the participant can state what a button will do **before** activating it;
- whether the participant can state what changed **after** an action;
- whether recommendation, selection, readiness, approval, schedule, send, and publication are verbally distinguished;
- whether external evidence, internal account evidence, and experiment evidence are kept separate;
- whether an observational interval or attribution-confidence label is misread as causal probability;
- whether the participant can tell an audience proxy from an actual recorded business outcome;
- whether the same task remains findable on a phone-sized navigation treatment.

Do not set arbitrary pass percentages until a baseline round establishes the error distribution.

## Highest-value breakdown hypotheses

These are hypotheses to test, not diagnosed participant failures.

| Hypothesis | Why it is plausible from the repository | What would falsify or support it |
|---|---|---|
| Operators may mistake an AI editorial recommendation for a decision already made for them. | Recommendation and human selection are both visible near strong action CTAs. | Ask participants to explain who has decided what before and after selection. |
| Operators may understand “approve” but not know whether approval publishes immediately. | Main-feed approval can later feed automation; replies have a distinct approve/send path. | Before each consequential click, ask what will happen immediately and what might happen later. |
| “Viral Styles” and “Experiments” may be interpreted as separate tools rather than evidence for the job “what should we learn/change?” | They are separate primary destinations and use method-oriented labels. | Open-sort evidence concepts; tree-test external/internal/test/strategy tasks across IA variants. |
| External evidence and this account's own evidence may be blended into one perceived “AI score.” | Both surfaces show evidence labels and performance numbers, but provenance is distributed across destinations. | Ask participants to compare one external pattern with one internal outcome and explain the difference. |
| Exact runtime/model controls may make ordinary users think AI configuration is required to run research. | Viral Styles currently exposes profile/runtime/model/reasoning in the default run form. | Observe setup behavior without mentioning AI settings; ask what is required vs optional. |
| “Performance” may be read as distribution metrics rather than audience quality and learning. | The page contains audience, conversation, post, health, and cohort evidence under one Performance label. | Tree-test audience quality, failure diagnosis, and “is this working?” tasks under current and proposed labels. |
| Future `Off / Suggest / Apply` labels may be understood as system-wide modes or publication authority rather than draft-level writing influence. | The contract does not exist in the current product; semantics are unvalidated. | Elicit participant language before showing labels, then ask each label's expected effect and reversibility. |
| Stakeholders may infer business impact from follower or reach movement. | Current Results intentionally exposes proxies; actual business-outcome persistence is absent. | Ask which displayed observations prove an opportunity/customer/revenue outcome and why. |

## Device and role coverage

P0/P1 research should include both desktop and phone-sized task presentation because the current primary navigation is a horizontally scrollable row and future IA may use a different compact-navigation treatment.

At minimum, observe:

- a frequent daily operator on both desktop and phone-sized layouts;
- an owner/stakeholder completing Results/Learn questions without operating the drafting workflow first;
- an occasional/non-expert reviewer returning without assumed memory of lifecycle labels;
- an advanced operator locating AI/niche/diagnostic controls without using those controls as the path for ordinary tasks.

These are coverage requirements for later research sessions, not claims about current users.