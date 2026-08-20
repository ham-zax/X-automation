# Information Architecture Research Package

This package is designed to test where users expect to find work and evidence in the product. It does **not** assert that the proposed IA is better than the current navigation.

## Evidence discipline

- **Repository-observed (RO):** the current React route/navigation structure or current content.
- **Stakeholder-stated (SS):** desired product concepts and constraints from the UX/HCI program.
- **Research hypothesis (RH):** a proposed grouping/label/path to falsify with participants.

There are no card-sort results, tree-test results, success percentages, participant quotations, or validated preferences in this document.

## Primary research question

Can operators and stakeholders reliably predict where to find:

- work needing a decision;
- discovered signals;
- active conversations;
- drafts/review/publishing state;
- performance and audience quality;
- external evidence about current writing patterns;
- internal evidence about what works for this account;
- explicit tests;
- learned/strategy recommendations;
- advanced AI/runtime/diagnostic controls;

without learning internal implementation vocabulary or conflating different evidence/authority types?

## Strongest IA hypothesis to test

**RH:** a six-destination primary structure centered on **Today / Discover / Conversations / Posts / Results / Learn**, with system detail under Advanced/Settings, will make ordinary tasks easier to predict than the current mixed goal/tool/method navigation.

Within **Learn**, the proposed child concepts are:

- **Current winning styles** — external market evidence;
- **What works for you** — this account's observed evidence;
- **Tests** — explicit comparisons and assignments;
- **Strategy recommendations** — evidence-backed guidance and, in the future, human-controlled writing-strategy selection.

This hypothesis is specifically falsifiable. The study must permit participants to show that:

- external patterns belong somewhere other than Learn;
- “Learn” means education/help rather than evidence/strategy;
- “Current winning styles” overclaims certainty or is not understandable;
- “What works for you” is too vague or confused with generic personalization;
- tests should remain a primary destination;
- strategy recommendations belong in Posts/Today/Results rather than Learn;
- a five-destination structure is more predictable;
- the current structure is already more predictable for key tasks.

## IA conditions to compare

### Condition C0 — Current product IA (RO)

```text
Today
Discover
Viral Styles
Conversations
Posts
Performance
  Audience quality        [linked secondary route]
Experiments
Diagnostics
  Your niche
  AI Settings
  Relationships           [legacy detailed view]
  Account status          [legacy detailed view]
```

Current method-oriented/detail content includes:

```text
Viral Styles
  Run historical research
  Research findings
    Evidence
    Intent & style
    Niche & timing
    Posts

Experiments
  Tests
  What we've learned
  Look for a new pattern
```

**RO diagnosis, not a user finding:** primary navigation currently mixes a daily goal (`Today`), source-work object (`Discover`), research method (`Viral Styles`), interaction object (`Conversations`), work state (`Posts`), outcome view (`Performance`), method (`Experiments`), and system detail (`Diagnostics`). Whether users actually find that confusing remains to be tested.

### Condition H1 — Five-destination hypothesis (RH)

This condition tests the source-plan hypothesis that learning/evidence can remain secondary under Results/More rather than receive a primary Learn destination.

```text
Today
Discover
Conversations
Posts
Results
  Overview
  Audience quality
  What is working now          [external evidence]
  What works for this account  [internal evidence]
  Tests
  Strategy recommendations     [future strategy concept]
  More
    AI Settings
    Niche / audience definition
    Relationships detail
    Account status / diagnostics
```

**Scoring note:** labels above are experimental stimuli. They are not recommended final UI copy.

### Condition H2 — Six-destination Learn hypothesis (RH)

```text
Today
Discover
Conversations
Posts
Results
  Overview
  Audience quality
  Recent content outcomes
  Conversation outcomes
  Business outcomes            [future; no current ledger]
Learn
  Current winning styles       [external evidence]
  What works for you           [internal evidence]
  Tests                        [declared experiment evidence]
  Strategy recommendations     [learned/future writing guidance]
Advanced / Settings
  AI Settings
  Niche / audience definition
  Relationships detail
  Account status / diagnostics
  Raw evidence / runtime / system detail
```

**Important:** `Business outcomes` is included only as a future expectation probe. The current product does not implement the underlying ledger. Do not present a fake populated business-outcome screen in a usability session.

## Hypotheses by destination

| Concept | Hypothesis to test | Evidence boundary |
|---|---|---|
| Today | Participants expect human decisions and next useful work here, not historical analysis. | Current Today already combines recommendation/attention/status. |
| Discover | Participants expect source exploration and unresolved signals here, not own-account outcome analysis. | Current Discover is source/candidate oriented. |
| Conversations | Participants expect active/new engagement opportunities and reply state here. | Current dedicated conversation route. |
| Posts | Participants expect drafts, review, approval, schedule, publication/failure state here. | Current Create/Posts route. |
| Results | Participants expect “is this working?” evidence about this account, including audience quality. | Current Performance route. |
| Learn | Participants expect external patterns, own-account patterns, tests, and strategy guidance as distinct evidence subtypes. | Proposed grouping; not current primary destination. |
| Advanced / Settings | Participants expect runtime/provider/model, niche configuration, diagnostics, and raw system evidence here. | Current Diagnostics/AI/Niche surfaces are technical. |

## Study sequence

Do not show all labels before eliciting natural grouping. Use this order:

1. **Open card sort** with neutral content/task cards.
2. Short retrospective interview: why were these grouped; what would each group be called?
3. **Closed card sort** using one IA condition's top-level categories.
4. **Tree test** for that condition using task prompts that do not name the destination.
5. Repeat tree testing on a second condition in a later/counterbalanced block, or use between-participant assignment if learning effects would be too strong.
6. After participants have committed to paths, run terminology probes for candidate labels.
7. Repeat critical findability tasks on phone-sized navigation.

Avoid showing H2 first to every participant; that would prime “Learn” as the expected answer.

## Participant coverage

Recruit for roles rather than technical sophistication labels alone:

- frequent daily operator;
- owner/stakeholder who primarily wants status, evidence, and strategic decisions;
- occasional reviewer returning without daily context;
- advanced operator responsible for niche/AI/runtime/diagnostic configuration.

Where one person holds multiple roles, record which role they are acting in for each task.

Do not claim representativeness from a small qualitative round. Use early rounds to expose systematic path/label failures, then set quantitative tree-test thresholds only after baseline behavior is known.

## Open card sort

### Instruction

Use wording similar to:

> Imagine these are things you may want to find or do in a tool that helps you research, write, publish, and learn from an X account. Group the cards in whatever way makes sense to you. You can create as many or as few groups as you need, and name each group in your own words. There is no correct product structure here.

Do **not** mention Today, Results, Learn, Viral Styles, Experiments, Diagnostics, pipeline, queue, or strategy mode before grouping.

### Core cards

Cards should describe user-visible objects/outcomes, not current module names.

1. Things that need a decision from me now
2. A recommended opportunity and why it matters now
3. Fresh signals from X, GitHub, or Hacker News
4. Sources I bookmarked for later
5. Sources I already acted on
6. Active conversations I may want to continue
7. New people/posts where I may have something useful to add
8. A post draft I am editing
9. A reply draft I am editing
10. A draft that is blocked by missing evidence or a writing check
11. Content I approved but that has not been published yet
12. A publishing attempt that failed or needs reconciliation
13. The planned time for an approved post
14. Recent post views/replies/reposts measured at a fixed time window
15. Whether newly observed followers match the audience I want
16. Whether conversations received a useful response or continuation
17. Observed writing styles that perform strongly among comparable niche posts
18. Observed communicative purposes/intents in strong external posts
19. Examples and evidence behind an external writing pattern
20. Patterns repeatedly observed on my own account
21. A focused comparison I deliberately set up between two choices
22. Which work item was assigned to which test option
23. A suggested change based on measured evidence
24. An accepted learned change that can influence future recommendations
25. A possible writing strategy for this specific draft, with evidence and limitations **[future concept]**
26. Whether I want a suggested writing strategy to influence generation **[future concept]**
27. AI runtime, provider, exact model, and reasoning settings
28. AI connection checks, credentials, and recent model usage
29. Which topics and audience signals count as relevant
30. Detailed relationship profile/history
31. Raw account-health or system diagnostics
32. A directly recorded lead, signup, partnership, or revenue outcome **[future concept; no current ledger]**
33. Why an outcome should not be treated as causal proof
34. Source freshness and last refresh error

### Optional blank cards

Provide blank cards so participants can add missing concepts. Treat participant-added concepts as research data; do not silently map them into the existing taxonomy during the session.

### Open-sort observations

Capture:

- participant-created group labels verbatim;
- cards moved repeatedly;
- cards deliberately separated despite apparent similarity;
- whether external market evidence and own-account evidence land together or apart;
- whether tests group with evidence/learning or with daily post workflow;
- whether a future strategy choice groups with Posts, Learn/evidence, Settings, or somewhere else;
- whether “things needing a decision” form a distinct group;
- where failures/recovery live;
- where actual business outcomes are expected relative to audience/performance proxies;
- whether technical controls form a clear advanced/settings group.

Do not turn a single participant's grouping into an IA decision.

## Closed card sort

### Purpose

Closed sorting tests whether top-level category labels are interpretable once categories are imposed. It is not a substitute for the open sort.

### Condition C0 categories

- Today
- Discover
- Viral Styles
- Conversations
- Posts
- Performance
- Experiments
- Diagnostics

### Condition H1 categories

- Today
- Discover
- Conversations
- Posts
- Results
- More / Settings

For H1, ask a second-level placement question after any card assigned to Results or More because the hypothesis depends on secondary grouping.

### Condition H2 categories

- Today
- Discover
- Conversations
- Posts
- Results
- Learn
- Advanced / Settings

### Cards that should be most diagnostic

Use the full core deck if session length permits. At minimum include:

- recommended opportunity and why now;
- fresh source signal;
- active conversation;
- draft awaiting review;
- approved-not-published item;
- failed publishing attempt;
- audience quality;
- recent measured post outcome;
- external writing pattern;
- own-account pattern;
- focused test;
- evidence-backed strategy recommendation;
- future writing-strategy influence choice;
- AI model/runtime settings;
- raw diagnostics;
- directly recorded business outcome.

### Error categories to code later

These codes define observation structure; they are not current results.

- **EVIDENCE_SOURCE_MIX:** external, internal, test, or strategy evidence treated as the same thing.
- **AUTHORITY_MIX:** recommendation/selection/approval/publication concepts grouped as if equivalent.
- **OUTCOME_PROXY_MIX:** audience/distribution proxy grouped or described as direct business outcome.
- **METHOD_AS_DESTINATION:** participant looks for a task by current technical/research method rather than user goal and cannot recover.
- **ADVANCED_INTRUSION:** ordinary task placed under AI/runtime/diagnostics because the participant thinks configuration is required.
- **LEARN_EDUCATION_INTERPRETATION:** Learn interpreted as tutorials/help/education rather than evidence and adaptation.
- **RESULTS_TOO_BROAD:** Results becomes the default dumping ground for external research, tests, settings, and status because categories are not distinct.
- **POSTS_TOO_BROAD:** participant expects all writing evidence and strategy controls inside the draft workflow, making later learning hard to discover.

## Tree-test structures

Tree tests remove visual design so placement/label comprehension can be tested directly.

### C0 — current tree

```text
Today
Discover
Viral Styles
  Run historical research
  Research findings
    Evidence
    Intent & style
    Niche & timing
    Posts
Conversations
Posts
Performance
  Audience quality
  Technical measurements
Experiments
  Tests
  What we've learned
  Look for a new pattern
Diagnostics
  Your niche
  AI Settings
  Relationships
  Account status
```

### H1 — five-destination tree

```text
Today
Discover
Conversations
Posts
Results
  Overview
  Audience quality
  Recent content outcomes
  What is working now
    External evidence
    Intent & style
    Examples
  What works for this account
    Own outcomes
    Learned changes
  Tests
  Strategy recommendations
  More
    AI Settings
    Niche / audience definition
    Relationships detail
    Account status / diagnostics
    Raw evidence / runtime detail
```

### H2 — six-destination Learn tree

```text
Today
Discover
Conversations
Posts
Results
  Overview
  Audience quality
  Recent content outcomes
  Conversation outcomes
  Business outcomes [future concept]
Learn
  Current winning styles
    External evidence
    Intent & style
    Examples
  What works for you
    Own-account observations
    Learned changes
  Tests
  Strategy recommendations
Advanced / Settings
  AI Settings
  Niche / audience definition
  Relationships detail
  Account status / diagnostics
  Raw evidence / runtime detail
```

## Tree-test task bank

Prompts deliberately avoid the destination name. Ask “Where would you look first?” Do not coach after a wrong first choice; record path and recovery.

### Daily work and authority tasks

**T1 — human decision now**

> You have a few minutes before another meeting and want to know whether anything needs your decision right now. Where would you look first?

Intended scoring path:
- C0: Today
- H1: Today
- H2: Today

**T2 — find a new signal**

> You want to see fresh AI/developer items from X, GitHub, or Hacker News before deciding whether any are worth using. Where would you go?

Intended path: Discover in all conditions.

**T3 — continue a conversation**

> Someone you replied to has continued the discussion, and you want to review the context before answering. Where would you go?

Intended path: Conversations in all conditions.

**T4 — edit a draft waiting for review**

> A post draft already exists and needs edits before it can be approved. Where would you find it?

Intended path: Posts in all conditions.

**T5 — understand approved but unpublished work**

> You approved a post earlier, but you are not sure whether it is public yet or waiting for its planned time. Where would you check its current state?

Intended path: Posts in all conditions.

**T6 — diagnose publication failure**

> A publishing attempt reported a problem. You need to know whether the post reached X and what state the work is in before doing anything else. Where would you look?

Design-intended path: Posts in all conditions.

Observe competing expectation for Results/Diagnostics; a repeated competing path is evidence against the intended placement or label.

### Results and outcome tasks

**T7 — audience quality**

> You want to know whether newly observed followers look more like the technical audience you are trying to build. Where would you look?

Intended paths:
- C0: Performance -> Audience quality
- H1: Results -> Audience quality
- H2: Results -> Audience quality

**T8 — measured post outcome**

> You want the latest fixed-window views, replies, reposts, and attribution context for a post that was already published. Where would you look?

Intended paths:
- C0: Performance -> Technical measurements / recent measured posts
- H1: Results -> Recent content outcomes
- H2: Results -> Recent content outcomes

**T9 — actual business outcome**

> You need to check whether a specific piece of work has a directly recorded lead, signup, partnership, or revenue outcome — not just follower or reach movement. Where would you expect to find that?

Scoring:
- C0: **expectation probe only**; current product has no valid current destination/ledger.
- H1: ask participant to choose expected location; do not mark a populated business-outcome path as current functionality.
- H2: Results -> Business outcomes is the design-intended future path.

This task tests whether business outcomes conceptually belong under Results and whether participants distinguish them from audience proxies.

### External/internal/test/strategy learning tasks

**T10 — external writing patterns**

> You want to see which writing styles appear to be performing strongly among comparable AI/developer posts right now, with sample evidence and limitations. Where would you look?

Intended paths:
- C0: Viral Styles -> Research findings
- H1: Results -> What is working now
- H2: Learn -> Current winning styles

**T11 — external communicative intent**

> You want to inspect what strong outside posts are trying to accomplish with readers — for example, teaching, challenging, announcing, or inviting discussion — without claiming to know the author's private motivation. Where would you look?

Intended paths:
- C0: Viral Styles -> Research findings -> Intent & style
- H1: Results -> What is working now -> Intent & style
- H2: Learn -> Current winning styles -> Intent & style

**T12 — what repeatedly works for this account**

> You want to know whether a pattern has repeatedly worked in your own account's measured results, not in the broader market. Where would you look?

Intended paths:
- C0: Experiments -> What we've learned (also observe Performance as a plausible competing path)
- H1: Results -> What works for this account
- H2: Learn -> What works for you

A large C0 split between Performance and Experiments is diagnostic evidence, not automatically a participant error.

**T13 — active focused comparison**

> You previously set up a deliberate comparison between two choices and now want to see its assignments and evidence. Where would you look?

Intended paths:
- C0: Experiments -> Tests
- H1: Results -> Tests
- H2: Learn -> Tests

**T14 — evidence-backed strategy recommendation**

> The system has enough evidence to suggest changing how future work is approached. You want to inspect the suggestion and what evidence supports it before accepting anything. Where would you look?

Intended paths:
- C0: Experiments -> What we've learned for current learned-rule behavior; note that the future writing-strategy concept is absent.
- H1: Results -> Strategy recommendations
- H2: Learn -> Strategy recommendations

**T15 — future draft-level strategy choice**

> Before generating a new draft, you want to decide whether an evidence-backed writing approach should be ignored, shown only as advice, or deliberately used for this generation. Where would you expect to make or inspect that choice?

This is an **expectation/future placement task**, not current-functionality scoring.

Record whether the participant chooses:
- Posts/draft workflow;
- Learn/strategy recommendation;
- Today/editorial recommendation;
- Settings;
- another place.

The result should determine whether strategy selection itself belongs in the draft surface while evidence management lives in Learn.

### Advanced-control tasks

**T16 — change exact AI model/provider**

> You need to switch the AI provider or exact model used for a role and verify the connection. Where would you look?

Intended paths:
- C0: Diagnostics -> AI Settings
- H1: Results -> More -> AI Settings **only because H1 deliberately has no separate Advanced destination; observe whether this feels misplaced**
- H2: Advanced / Settings -> AI Settings

**T17 — change topic/audience definition**

> You need to change which topics and profile signals count as relevant for the audience you are trying to build. Where would you look?

Intended paths:
- C0: Diagnostics -> Your niche
- H1: Results -> More -> Niche / audience definition
- H2: Advanced / Settings -> Niche / audience definition

**T18 — raw account diagnostics**

> You need detailed account-health evidence and system-level diagnostics rather than the normal day-to-day summary. Where would you look?

Intended paths:
- C0: Diagnostics -> Account status
- H1: Results -> More -> Account status / diagnostics
- H2: Advanced / Settings -> Account status / diagnostics

### Cross-evidence task

**T19 — compare market and own evidence**

> You have seen an external writing pattern and want to check whether your own account shows the same pattern before changing strategy. Where would you start?

This is intentionally not given one forced correct terminal node. Observe whether participants:

- understand that two evidence sources must be consulted;
- can navigate between them;
- expect a comparison/synthesis surface;
- incorrectly assume one score already blends both sources.

H2 is falsified if placing both under Learn causes users to treat external and internal evidence as interchangeable rather than distinct child concepts.

**T20 — understand uncertainty**

> A result looks promising, but you want to know how much evidence supports it and what might make the result misleading. Where would you look?

Run once for external research and once for own-account/test evidence. Observe whether evidence details remain findable without forcing advanced/system navigation.

## Tree-test observations to capture

For each task, capture:

- first chosen top-level node;
- final chosen node;
- backtracks;
- “not sure / nowhere here” response;
- time only as a descriptive observation, not an arbitrary pass/fail cutoff;
- participant's explanation of why that label/path fit;
- whether they expected a different kind of content at the destination;
- evidence-source confusion;
- authority confusion;
- proxy/business-outcome confusion;
- role being enacted;
- device condition.

For future-feature tasks, score expectation consistency and mental model, not current task completion.

## Desktop and phone protocol

### Desktop

Use the tree itself for structure testing, then validate critical routes in the real desktop product or a faithful IA prototype. Observe whether page-level content changes the interpretation established by the tree.

### Phone-sized navigation

Repeat at least T1, T3, T4, T5, T7, T10, T12, T14, T16, and T19 using the proposed compact navigation treatment.

Observe:

- whether primary destinations are visible or hidden behind a menu;
- whether users remember which hidden destination contained the needed evidence;
- whether Learn/Results are distinguishable when screen space removes descriptive text;
- whether draft/approval state can be checked without horizontal scanning;
- whether Advanced is discoverable for a deliberate settings task without attracting ordinary tasks.

Do not infer mobile success from desktop tree-test performance alone.

## Terminology probes after navigation tasks

Only after the participant has completed unprimed tasks, show candidate labels and ask for meaning/effect prediction.

Candidates include:

- Today
- Results
- Learn
- Current winning styles
- What works for you
- Tests
- Strategy recommendations
- Advanced / Settings

Ask:

- “What would you expect to find here?”
- “What would definitely **not** belong here?”
- “What is the difference between these two?”
- “If you clicked this, what kind of information or action would you expect next?”

Do not ask “Do you like this label?” as the primary evidence.

## Falsification criteria for the Learn hypothesis

H2 should be revised or rejected if repeated participant behavior shows one or more of these patterns:

1. **Learn means education/help.** Participants look for tutorials, onboarding, or documentation and do not expect evidence/strategy.
2. **External evidence belongs elsewhere.** Participants consistently place/find external patterns under Discover/Results and cannot predict `Current winning styles` under Learn.
3. **Internal evidence belongs in Results.** Participants expect own-account patterns to be inseparable from performance outcomes and the Learn split adds a second place to check.
4. **Tests are operational work.** Participants consistently place tests with Posts/Today because assignment is a workflow action, and moving them under Learn harms findability.
5. **Strategy belongs at point of use.** Participants can understand strategy evidence in Learn but expect the actual apply/ignore decision only in the draft/editor. If so, separate “manage/inspect strategy evidence” from “select for this draft.”
6. **Winning language overclaims.** Participants interpret `Current winning styles` as guaranteed, causal, or “90% likely to go viral.”
7. **Evidence lanes collapse.** Grouping external/internal/tests under Learn makes participants assume they are components of one AI score rather than distinct evidence types.
8. **Advanced becomes harder to find.** A six-destination primary IA forces technical configuration into unclear overflow while a simpler alternative performs better for advanced tasks.

Conversely, H2 gains support when participants can predict its destinations, explain external/internal/test/strategy distinctions, and do so without sacrificing daily-work or advanced-control findability.

## Decision rules after research

Do not predeclare arbitrary success percentages before collecting a baseline. Use these evidence rules:

### Keep a placement/label when

- participants repeatedly choose the intended conceptual destination without coaching;
- their explanation matches the intended content and authority;
- errors are scattered rather than clustering on one competing destination;
- the same mental model survives desktop and phone-sized navigation;
- a destination helps separate external/internal/test/strategy evidence instead of blurring it.

### Change a placement/label when

- wrong first choices repeatedly cluster on the same alternative;
- participants' own group labels consistently describe a different concept;
- a label produces the wrong consequence expectation even when navigation succeeds;
- users need internal implementation vocabulary to distinguish sibling items;
- users repeatedly confuse audience proxies with directly recorded business outcomes;
- users repeatedly treat external or experiment evidence as causal prediction;
- future strategy controls are interpreted as global autonomous behavior rather than bounded human-selected writing influence.

### Split a concept when

- evidence shows different jobs at different moments, especially:
  - strategy evidence/recommendation versus selecting guidance for the current draft;
  - performance proxy review versus directly recorded business outcomes;
  - external research setup versus research findings;
  - ordinary account-status summary versus raw diagnostics.

### Merge concepts when

- users consistently treat two destinations as one job and cannot articulate a meaningful reason to choose between them;
- the merge does not erase provenance or authority boundaries.

## Research artifact template

For each session, record without interpretation first:

| Field | Capture |
|---|---|
| Participant role in task | Daily operator / stakeholder / reviewer / advanced operator |
| Device | Desktop / phone-sized |
| IA condition | C0 / H1 / H2 |
| Task ID | T1–T20 |
| First path | Verbatim node sequence |
| Final path | Verbatim node sequence |
| Backtracks | Count + path |
| Not sure | Yes/no + participant words |
| Expected content | Participant's words |
| Expected action consequence | Participant's words |
| Evidence provenance interpretation | External / own account / test / unclear, based on participant explanation |
| Authority interpretation | Recommendation / selection / approval / publication / unclear, based on participant explanation |
| Moderator intervention | Exact intervention, if any |

Analyze patterns only after the factual session record is complete.

## Questions this package is designed to answer

1. Is the current primary navigation already predictable enough for daily operator jobs?
2. Does a Results-centered five-destination model overload Results with too many evidence/method/settings concepts?
3. Does a Learn-centered six-destination model improve evidence findability without turning Learn into a vague catch-all?
4. Can users keep external market evidence, own-account evidence, declared tests, and strategy recommendations conceptually separate?
5. Where should the future “use this writing strategy for this draft” decision occur relative to Learn and Posts?
6. Does Results communicate qualified-growth evidence without implying business outcomes that are not directly recorded?
7. Can advanced controls remain discoverable while ordinary operators correctly avoid them?
8. Do the same conceptual paths remain usable on phone-sized navigation?

The output of this research should be a falsifiable IA decision with documented evidence, not a preference vote.