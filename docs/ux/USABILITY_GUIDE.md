# Usability / IA / Language Research Runbook

**Purpose:** execution guide for real moderated participant sessions against the Wave-2 low-fidelity UX prototypes and IA hypotheses.

This document prepares research. It contains no participant findings, preference claims, success percentages, quotations, or validated terminology.

Use it with:

- `docs/ux/IA_RESEARCH.md` for the full C0/H1/H2 trees and card deck;
- `docs/ux/USER_LANGUAGE_RESEARCH_GUIDE.md` for the full language-question bank;
- `docs/ux/TASK_FLOWS.md`, `docs/ux/USER_FLOWS.md`, and `docs/ux/WIREFLOWS.md` for prototype states and transitions;
- `docs/ux/PRODUCT_LANGUAGE.md` for stable action/evidence semantics and provisional labels;
- `docs/ux/HUMAN_AI_INTERACTION.md` for AI, deterministic-rule, and human-authority boundaries;
- `docs/ux/STATUS_LANGUAGE.md` for lifecycle, failure, retry, and reconciliation semantics.

Do not create `USABILITY_FINDINGS.md` until real sessions have produced observations.

## 1. Research questions

The study should answer, with observed participant behavior rather than stakeholder preference:

1. Can people find work that genuinely needs a human decision and distinguish it from advisory recommendations?
2. Can people predict the consequence of selection, generation, readiness, approval, scheduling, send, and publication before acting?
3. Can people recognize lifecycle state after leaving and returning without remembering which current module owns each step?
4. Can people recover safely when a remote send/publication may have happened but local state is incomplete?
5. Which of C0, H1, and H2 produces the most predictable information architecture for daily work, results, evidence, and advanced configuration?
6. Does `Learn` communicate evidence/adaptation or tutorials/help/education?
7. Can people distinguish external niche evidence, this account's evidence, and explicit-test evidence without treating them as one score?
8. Can people interpret observational strength, sample/context, and attribution limits without converting them into virality probability or causal proof?
9. Can an ordinary operator run simplified external/Viral research without believing runtime/model/sampling controls are required?
10. What words do participants naturally use for communicative intent versus presentation style?
11. Can people distinguish writing guidance with no Writer effect, advice-only display, and deliberate one-generation influence before candidate labels are taught?
12. Where do people expect strategy evidence to live, and where do they expect the per-draft influence choice to happen?
13. Where do people expect AI model/provider, niche/audience definition, and raw diagnostics to live before `Settings`, `Advanced`, or `Diagnostics` is treated as final language?
14. Can a stakeholder answer what happened, whether the account appears to be improving, what is learned externally versus internally, and what human decision is waiting without mistaking audience proxies for direct business outcomes?
15. Do the same high-priority tasks remain understandable on a phone-sized treatment?

A valid outcome is **unresolved**. Do not force a winning IA, placement, or label when evidence conflicts or is too thin.

## 2. Frozen semantics the study must not change

These are constraints on the stimulus, not hypotheses for participants to vote on.

- Recommendation != human selection != draft/generation != readiness/review != approval != plan/wait != publish/send != confirmed result.
- A consequential action must make its immediate effect predictable before activation.
- Approval is not publication.
- Main-feed timing is a plan/eligibility input, not guaranteed publication.
- A reply send is an explicit public action using the exact approved text.
- A remote effect that is uncertain must not expose an ordinary resend/republish path.
- External niche evidence, internal account evidence, and explicit-test evidence remain separate provenance lanes.
- Observational association is not causal proof.
- Communicative intent means what the text is trying to accomplish with the reader; it does not claim private motivation.
- Presentation style is how the message is structured/presented; it is not Original/Thread/Quote/Reply.
- Canonical writing-strategy behavior is `off|suggest|apply`:
  - `off`: no strategy influence on Writer generation;
  - `suggest`: advice is visible, with **zero Writer effect**;
  - `apply`: a human deliberately allows selected guidance to influence one generation only.
- Strategy influence never approves, schedules, publishes, sends, assigns a test, accepts a learned rule, or enables account-wide autonomous writing.
- Repost has no authored-body strategy application.
- Qualified growth is about relevant audience movement, not raw likes/followers, and it is not direct business outcome evidence.
- The current product has no direct business-opportunity/revenue ledger. Do not present a populated one as current capability.

If a prototype shown in a session violates one of these semantics, stop using that stimulus and repair the research material. Do not record the resulting confusion as a participant finding.

## 3. Evidence discipline

Keep five layers separate during capture and later analysis:

1. **Observed participant behavior** — what the participant actually clicked, said, searched for, avoided, or retried.
2. **Participant language** — exact participant wording, captured before candidate terminology where possible.
3. **Researcher interpretation** — a hypothesis about why the behavior occurred.
4. **Repository/product constraint** — the real authority or capability the design must preserve.
5. **Design recommendation** — a later proposed change supported by the preceding evidence.

Do not rewrite layer 1 or 2 to make a cleaner narrative. A participant taking an unexpected but plausible path is evidence about the IA, not automatically an error.

## 4. Participant roles and screening

Recruit by work responsibility, not by developer sophistication.

### Primary: daily / likely operator

Look for people who can realistically decide what a professional/technical account should discuss, write, reply to, or approve.

Useful screening signals:

- has made content/reply decisions for a professional, product, technical, founder, community, or similar account;
- can judge whether a source is worth responding to without needing the system's internal vocabulary;
- is comfortable reviewing AI-prepared wording but is not required to know this repository.

Do not require prior knowledge of `pipeline`, `queue`, scoring fields, runtime profiles, or XActions internals.

### Primary: owner / stakeholder

Look for people who mainly want status, evidence, audience/relationship outcomes, and strategy decisions rather than daily drafting.

Useful screening signals:

- reviews whether content/growth work is producing the right audience or useful relationships;
- cares about business opportunities but understands that a useful signal is not automatically a recorded lead or sale;
- can make or influence strategic decisions without operating every post.

### Primary: occasional / non-expert reviewer

Look for people who review wording or approve work intermittently and therefore cannot be expected to remember lifecycle vocabulary or page ownership between sessions.

Useful screening signals:

- reviews work after gaps of days/weeks;
- cares about exact wording/evidence and what an approval authorizes;
- is not a daily operator of the current product.

### Secondary: advanced operator

Use as a secondary group for AI provider/model, niche/audience definition, research controls, and diagnostic-detail questions.

Advanced participants must not define the default ordinary-user IA. Their task is to show whether expert controls remain findable after progressive disclosure.

### Avoid primary-sample contamination

Do not rely only on people who designed the current IA, wrote these research artifacts, or already know the repository's internal terms. Familiar experts may still participate in a separate expert/advanced group, but label that evidence accordingly.

### Sample-size discipline

Use small qualitative rounds for defect discovery and iteration, then repeat after material repairs. Choose recruitment volume based on the decisions and participant roles being studied.

Do **not** claim population validity from a small qualitative round and do not set arbitrary success percentages before a baseline exists.

## 5. Research safety and prototype setup

### Use safe stimuli

- Use low-fidelity prototypes, tree structures, card-sort materials, and read-only scenarios.
- Do not require a real X send, publication, repost, follow/unfollow, live provider call, credential entry, or production mutation.
- Use fictional/synthetic account, post, person, and measurement data in the prototype. Keep the same fixture content across IA variants when comparing structure.
- Do not ask for authentication tokens, API keys, personal messages, or private business data.
- Consequential actions are simulated: after the participant predicts the effect and activates the prototype control, the moderator advances to the corresponding prototype state.

### Prepare these stimulus states before a session

1. Today with at least one genuine human obligation and one advisory Editorial recommendation.
2. Editorial recommendation with evidence/rationale and a route-selection CTA that does not generate or approve.
3. Authored work immediately after selection with no generated text yet.
4. Draft requiring review/readiness and explicit approval.
5. Main-feed post in `Approved — not published yet` / planned/waiting state.
6. The same post after a simulated later re-entry in one of `Publishing`, `Published`, `Failed`, or reconciliation-required states.
7. Conversation with editable reply and explicit send action.
8. Conversation/post partial-success state where the remote effect may have happened and ordinary resend is absent.
9. Simplified external-research setup with period, niches, depth, optional semantic analysis, and an Advanced entry.
10. External evidence, own-account evidence, and explicit-test evidence fixtures with separate provenance and limitations.
11. At least one observational evidence example with interval/confidence/context detail that could be misread as a success probability.
12. Strategy recommendation fixture with evidence/limitations but no candidate mode labels in the first unprimed probe.
13. H1 and H2 strategy-placement stimuli as assigned for that session; do not expose all placement variants by default.
14. Results fixture with audience quality, conversation outcome, recent content observations, attribution caveats, and **no fabricated direct business outcome**.
15. Advanced/configuration tasks for provider/model, niche/audience definition, and raw account/system diagnostics.

### Keep comparison variables controlled

For H1/H2 comparisons:

- keep content, tasks, evidence, lifecycle states, and action semantics equivalent;
- change only hierarchy/path/label elements being tested;
- on phone, use the same compact-navigation mechanism for H1 and H2;
- do not make one condition visually richer or give it more explanatory text;
- record any unavoidable stimulus difference as a confound before analysis.

## 6. Condition assignment and counterbalancing

Choose the assignment scheme before the first session in a research round. Do not change schemes because early sessions appear to favor a condition.

### Preferred baseline: between-participant tree conditions

Use one primary tree condition per participant: C0, H1, or H2. Rotate assignment within each participant-role/device stratum so one condition is not systematically paired with a role or device.

This is preferred when repeating the same tree tasks would teach the hierarchy and contaminate later conditions.

Record:

- primary IA condition;
- participant role;
- primary device;
- session order in the research round.

### Optional within-participant comparison

If the research question requires direct within-person comparison and session burden is acceptable, use the six C0/H1/H2 order permutations rather than always showing H2 first:

1. C0 -> H1 -> H2
2. C0 -> H2 -> H1
3. H1 -> C0 -> H2
4. H1 -> H2 -> C0
5. H2 -> C0 -> H1
6. H2 -> H1 -> C0

Cycle through permutations within role/device strata. Hold task wording and content constant. Treat later-condition performance as potentially affected by learning; first-condition behavior remains the cleanest findability evidence.

### H1 versus H2 focused comparison

If the study only needs the proposed IA pair, alternate:

- H1 -> H2
- H2 -> H1

Do not use eventual findability in the second condition as proof that the second hierarchy is intuitive. Record first choice, backtracking, and the participant's explanation in each condition.

### Device order

When the same participant uses desktop and phone, alternate device order across sessions:

- desktop -> phone;
- phone -> desktop.

Use semantically equivalent task instances on each device. Treat the second device as potentially benefiting from task learning.

### Strategy-placement variants

The primary evidence is the participant's **unprimed placement expectation**. Only after recording it should you show an assigned placement stimulus:

- S1: evidence area owns selection; draft mirrors/can change it;
- S2: evidence area explains; draft owns the influence choice;
- S3: evidence area starts the handoff; draft confirms/changes it.

Prefer one placement variant per participant in a round. If comparing variants within a participant, counterbalance order and explicitly mark the later exposure as learned/comparative evidence.

## 7. Moderator operating rules

### Opening script

Use wording similar to:

> We are evaluating the product structure and wording, not you. Some parts are prototypes and may be wrong. Please work as you normally would and say what you are looking for when that feels natural. If something is confusing, that is useful evidence. Nothing you do in this session will publish, send, unfollow, or change a real account.

Do not explain C0/H1/H2, `Learn`, strategy modes, evidence lanes, or the intended answer.

### Standard moderator behavior

- Give one task at a time.
- Do not point toward a destination or control.
- Accept `I don't know` and `nowhere here` as valid data.
- If the participant takes an unexpected path, let them continue unless the prototype cannot support it.
- Do not repair an interpretation with product vocabulary before recording it.
- Ask neutral follow-ups: `What are you looking for?`, `What do you expect to find there?`, `What would you try next?`.
- When help is necessary, give the smallest neutral hint and record the exact intervention.
- Do not ask whether a label is “good,” “clear,” or “preferred” before asking what it means and what it would cause.
- Do not praise/correct a path during the task; neutral acknowledgement prevents teaching the model.

### Consequence-prediction rule

Before every consequential prototype action, ask:

> **What do you think will happen if you press this?**

Record the answer before activation.

After the prototype advances, ask:

> **What happened? What has not happened yet? What can happen next?**

Do not initially ask leading yes/no questions such as `Will this publish?`. Use those only as follow-up probes after the participant has committed to an open prediction.

Use consequence prediction for at least:

- select/use recommendation;
- choose content type;
- generate/regenerate draft;
- check readiness;
- approve main-feed wording;
- save/change publishing plan;
- approve/send reply;
- retry/reconcile an error;
- run/stop research;
- accept a learned change when included as context;
- choose a writing-strategy influence behavior.

## 8. Session sequence

Use this order unless the research round intentionally isolates one module.

1. Consent/context and role framing.
2. Outcome-language warm-up.
3. Unprimed open grouping/card-sort probe.
4. Assigned/counterbalanced tree test.
5. Desktop or phone task-based prototype block (primary device according to assignment).
6. Lifecycle and recovery block.
7. External research/evidence block.
8. Strategy semantics and placement block.
9. Stakeholder or advanced block as role-appropriate.
10. Second-device critical-task block, if included.
11. Candidate terminology probes **after** natural language/path/consequence data is captured.
12. Closing debrief: missing concepts, strongest confusion, and anything the participant expected but did not find.

Do not show the candidate label list at the start of the session.

## 9. Warm-up: participant outcome language

Before showing navigation, ask:

1. `If you were responsible for growing a technical account, what would make you say the work is going well?`
2. `What would tell you the audience is getting better, not just bigger?`
3. `What outcomes would matter more than likes or views?`
4. `If a product said it was creating opportunities, what would you assume that meant?`
5. `What would count as evidence of a real business outcome rather than an encouraging signal?`

Capture exact words for relevant audience, relationship value, opportunity, technical authority, build visibility, and business value before showing product terms.

## 10. Open grouping / card-sort probe

Use this before C0/H1/H2 labels.

### Instruction

> Imagine these are things you may want to find or do in a tool that helps you research, write, publish, and learn from a professional X account. Group them in whatever way makes sense to you. Create as many or as few groups as you need, and name each group in your own words. There is no correct product structure here.

Do not mention Today, Results, Learn, Viral Styles, Experiments, Diagnostics, pipeline, queue, or strategy mode before grouping.

### Combined-session diagnostic deck

For a full standalone card sort, use the complete deck in `IA_RESEARCH.md`. For a combined usability session, use this smaller diagnostic subset while preserving the exact neutral concepts:

| Card | Concept |
|---|---|
| G1 | Things that need a decision from me now |
| G2 | A recommended opportunity and why it matters now |
| G3 | Fresh signals from X, GitHub, or Hacker News |
| G4 | Active conversations I may want to continue |
| G5 | A post draft I am editing |
| G6 | Content I approved but that has not been published yet |
| G7 | A publishing attempt that failed or needs reconciliation |
| G8 | Whether newly observed followers match the audience I want |
| G9 | Observed writing styles that perform strongly among comparable niche posts |
| G10 | Patterns repeatedly observed on my own account |
| G11 | A focused comparison I deliberately set up between two choices |
| G12 | A suggested change based on measured evidence |
| G13 | A possible writing strategy for this specific draft, with evidence and limitations |
| G14 | Whether I want a suggested writing strategy to influence generation |
| G15 | AI runtime, provider, exact model, and reasoning settings |
| G16 | Which topics and audience signals count as relevant |
| G17 | Raw account-health or system diagnostics |
| G18 | A directly recorded lead, signup, partnership, or revenue outcome |

Provide blank cards.

### Record

- groups and participant-created names verbatim;
- cards moved repeatedly;
- cards the participant deliberately keeps apart;
- where G9/G10/G11 land relative to each other;
- where G13/G14 land relative to evidence and drafting;
- where G15/G16/G17 land;
- whether G18 is separated from audience/performance proxies;
- whether G1 forms a distinct decision/attention group;
- where G7 recovery is expected.

Do not translate participant groups into H1/H2 during the session.

## 11. Tree testing

Use the exact trees in `IA_RESEARCH.md`. Do not add explanatory copy to one condition that the others do not receive.

### Core tasks for all IA conditions

Ask `Where would you look first?` and let the participant navigate without coaching.

**IA1 — Human decision now**

> You have a few minutes before another meeting and want to know whether anything needs your decision right now. Where would you look first?

**IA2 — Approved but not necessarily public**

> You approved a post earlier, but you are not sure whether it is public yet or waiting for its planned time. Where would you check its current state?

**IA3 — Publication failure**

> A publishing attempt reported a problem. You need to know whether the post reached X and what state the work is in before doing anything else. Where would you look?

**IA4 — Audience quality**

> You want to know whether newly observed followers look more like the technical audience you are trying to build. Where would you look?

**IA5 — External patterns**

> You want to see which writing styles appear to be performing strongly among comparable AI/developer posts right now, with sample evidence and limitations. Where would you look?

**IA6 — Own-account pattern**

> You want to know whether a pattern has repeatedly worked in your own account's measured results, not in the broader market. Where would you look?

**IA7 — Explicit comparison**

> You previously set up a deliberate comparison between two choices and now want to see its assignments and evidence. Where would you look?

**IA8 — Strategy recommendation**

> The system has enough evidence to suggest changing how future work is approached. You want to inspect the suggestion and what evidence supports it before accepting anything. Where would you look?

**IA9 — AI model/provider**

> You need to switch the AI provider or exact model used for a role and verify the connection. Where would you look?

**IA10 — Cross-evidence comparison**

> You have seen an external writing pattern and want to check whether your own account shows the same pattern before changing strategy. Where would you start?

### Role/device extensions

Use these when relevant without changing the core condition assignment.

**Operator — active conversation**

> Someone you replied to has continued the discussion, and you want to review the context before answering. Where would you go?

**Operator/reviewer — draft needing edits**

> A post draft already exists and needs edits before it can be approved. Where would you find it?

**Strategy placement expectation**

> Before generating a new draft, you want to decide whether an evidence-backed writing approach should be ignored, shown only as advice, or deliberately used for this generation. Where would you expect to make or inspect that choice?

**Stakeholder — measured outcome**

> You want the latest fixed-window views, replies, reposts, and attribution context for a post that was already published. Where would you look?

**Stakeholder — direct business outcome expectation**

> You need to check whether a specific piece of work has a directly recorded lead, signup, partnership, or revenue outcome — not just follower or reach movement. Where would you expect to find that?

This is an expectation probe. Do not imply the current product contains such a ledger.

**Advanced — audience definition**

> You need to change which topics and profile signals count as relevant for the audience you are trying to build. Where would you look?

**Advanced — raw diagnostics**

> You need detailed account-health evidence and system-level diagnostics rather than the normal day-to-day summary. Where would you look?

### Record per tree task

- first top-level choice;
- full path;
- final node;
- backtracks;
- `not sure` / `nowhere here`;
- expected content at chosen node;
- reason the label/path seemed to fit;
- whether an alternative plausible path competed;
- whether evidence source or action authority was misinterpreted;
- help/intervention, if any;
- device and condition/order.

Do not score a plausible competing destination as participant error simply because it differs from the design-intended path.

## 12. Task-based prototype usability

Use the assigned IA shell when hierarchy is part of the task. For action/lifecycle tasks where H1/H2 should not matter, keep the same object screen and semantics in both conditions.

### U1 — Find the real human obligation

**Prompt**

> You have about ten minutes before a call. Find the most important thing that already needs your judgment. Explain what makes it different from anything that is merely a suggestion.

**Observe**

- whether the participant enters the genuine obligation or the advisory recommendation first;
- language used for `needs my decision` versus `worth considering`;
- whether the participant can state who has decided what.

### U2 — Inspect an AI Editorial recommendation without turning it into an obligation

**Prompt**

> Now look at an opportunity the system thinks may be worth pursuing. Decide whether you would act on it, research it further, dismiss it, or choose another treatment. Explain why.

**Before any recommendation CTA** ask the standard consequence-prediction question.

**Observe**

- recommendation understood as advice;
- evidence/limitations inspected when needed;
- human choice distinguished from AI recommendation;
- alternative valid content treatment remains understandable.

### U3 — Predict recommendation selection versus generation

**Prompt**

> You want to pursue this as an authored post. Take the next step, but tell me what you expect to happen before you activate it.

After selection, ask:

> What exists now? Has any draft text been generated? Has anything been approved or published?

**Observe**

- route/selection versus AI generation;
- whether the prototype repair resolves the current `Draft` consequence ambiguity.

### U4 — Generate, review, and identify the approval boundary

**Prompt**

> Prepare editable wording for this selected idea. Review it as if you were responsible for the exact text and supporting evidence. Get it ready for a human approval decision, but do not make anything public.

Use consequence prediction before Generate/Regenerate and Check readiness.

**Observe**

- generation understood as editable draft creation;
- readiness understood as deterministic checking, not approval;
- approval responsibility is understood;
- AI recommendation versus deterministic gate versus human decision kept distinct.

### U5 — Approve wording without confusing approval and publication

**Prompt**

> The exact wording now looks acceptable. Take it to the state where a human has approved the content, but stop before anything is public.

Before approval ask consequence prediction. After approval ask:

> What has happened? Is it public? What could cause it to become public later?

**Observe**

- approval versus publication;
- automation/timing interpretation;
- whether `approved/waiting` is recognized as not public.

### U6 — Leave and return to identify lifecycle truth

Simulate a later session using the prepared re-entry state.

**Prompt**

> You approved this post earlier and have returned later. Find it and tell me whether it is waiting, publishing, published, failed, or otherwise unresolved. Tell me how you know.

**Observe**

- recognition without module-memory coaching;
- planned/scheduled language interpreted as guarantee or plan;
- state found on both desktop and phone when assigned.

### U7 — Prepare and explicitly send a reply

**Prompt**

> There is an active conversation with a reply worth considering. Review the context, prepare the exact reply, and take it to the last decision before it becomes public.

At the send-capable control ask consequence prediction.

After simulated success ask:

> What confirms that the reply is actually public now?

**Observe**

- generation/readiness versus send;
- exact-text approval;
- use of `send` versus `publish` language;
- remote success recognized only after confirmed result.

### U8 — Partial-success/reconciliation recovery

Advance to the prepared uncertain-remote-result state.

**Prompt**

> Something did not finish cleanly after the reply action. Work out what may already have happened, whether it is safe to try again, and what you would do next.

Do not mention `reconciliation`, `remote effect`, or `do not resend` in the task prompt.

**Observe**

- whether participant recognizes the action may already exist on X;
- whether participant attempts an ordinary resend;
- whether they seek authoritative refresh/verification;
- natural words that make them stop and verify;
- whether they distinguish uncertain remote result from known pre-action failure.

If the participant tries to resend, record it; do not allow a real/public action.

### U9 — Run simplified external/Viral research

**Prompt**

> You want to study which writing approaches appear to be working among comparable AI/developer accounts over a recent period. Start a sensible study. You are not trying to tune the AI provider or model.

**Observe**

- first destination under assigned IA;
- whether participant can configure period/niche/depth without Advanced;
- whether they enter Advanced because they think it is required;
- interpretation of Quick/Standard/Deep or current research-depth wording;
- whether depth is misread as evidence certainty rather than collection scope/cost;
- whether optional semantic analysis is understood;
- Run research consequence prediction: read-only/background, no public action;
- understanding of stop-after-current-unit and later re-entry.

After setup ask:

> What do you expect this run to collect or analyze? What would you change only if you were doing expert setup?

### U10 — Distinguish external, own-account, and explicit-test evidence

**Prompt**

> You found a writing pattern in outside posts. Check whether your own account shows anything similar and whether you have a deliberate comparison related to it. Explain what each source can and cannot tell you.

**Observe**

- provenance of all three evidence lanes;
- whether participant assumes one hidden combined AI score;
- whether explicit-test assignment is understood as explicit/nonrandomized;
- whether external evidence is treated as a production learned rule;
- how disagreement or insufficient evidence is interpreted.

### U11 — Interpret observational strength and confidence

Show the prepared observational evidence fixture only after U10 provenance is understood.

**Prompt**

> Tell me what this result says, how strong you think the evidence is, and what it does **not** let you conclude.

Follow with:

> What do you think this interval/confidence information means?

Do not initially say `causal`, `probability`, or `viral`.

**Observe**

- association versus causal proof;
- whether an interval is interpreted as `chance this post will go viral`;
- sample/time/confounder details sought;
- participant language for insufficient/directional/repeated evidence;
- whether `winning` or `working` language overclaims certainty.

### U12 — Style versus communicative intent

Before showing candidate taxonomy words, describe two observed dimensions:

> One describes what the text is trying to accomplish with the reader — for example explain, compare, announce, challenge, or invite discussion. The other describes how the message is structured or presented.

Ask:

> What would you call each of those? What would you definitely not infer about the author from the text alone?

**Observe**

- natural words for communicative purpose/intent;
- natural words for presentation style;
- confusion with content type or private motivation.

### U13 — Writing-strategy semantics without teaching labels first

Do **not** show `Off`, `Suggest`, `Apply` first.

Present only the behaviors:

> The product has evidence about a writing approach that may fit the draft. Imagine three possible choices:
>
> 1. the evidence does not influence Writer generation at all;
> 2. you can see the advice, but Writer generation stays unchanged;
> 3. you deliberately let the selected guidance influence this generation only.
>
> What would you call those three choices? What would you expect each one to change?

Probe after the participant answers:

- `Which choice changes generated wording?`
- `Which choice, if any, approves or publishes something?`
- `Is any choice account-wide?`
- `Does any choice accept a learned rule or assign a test?`
- `If you remove the choice before approval, what should happen?`

A candidate interpretation is unsafe if it grants approval, send/publication, account-wide automation, experiment assignment, or learned-rule acceptance.

### U14 — Strategy placement expectation

Before showing S1/S2/S3, ask:

> You have evidence about a possible writing approach and a draft you are about to generate. Where would you expect to inspect the evidence, and where would you expect to decide whether it influences this draft?

Record the unprimed answer.

Then show the participant's assigned placement stimulus and ask them to complete the task. Observe whether evidence management and the per-draft influence choice feel like the same responsibility or two different moments.

Do not show all three variants and ask which one they like unless the round is explicitly designed as a counterbalanced placement comparison.

### U15 — Settings / Advanced / Diagnostics expectations

Before candidate labels, ask three separate tasks:

1. `You need to change the exact AI provider or model used for a role. Where would you look?`
2. `You need to change what topics and audience signals count as relevant. Where would you look?`
3. `You need raw account-health/system diagnostic detail rather than the normal summary. Where would you look?`

Ask after each path:

> What would you call the place that contains this kind of control or detail?

Only after natural language is captured, test `Settings`, `Advanced`, `Diagnostics`, `AI Settings`, `System details`, or other candidate words.

**Observe**

- whether `Diagnostics` is read as read-only inspection rather than configuration;
- whether H1 `Results -> More` feels misplaced;
- whether H2 Advanced/Settings remains discoverable without attracting ordinary tasks;
- whether ordinary research users think model/runtime configuration is required.

### U16 — Stakeholder Results comprehension

Use owner/stakeholder participants and optionally operators in stakeholder role.

**Prompt**

> You are checking on the system rather than writing a post. Tell me what happened recently, whether the account appears to be improving in the ways that matter, whether anything is wrong, what has been learned from outside posts versus this account, and whether a human decision is waiting.

Then ask:

> Can this product prove that this activity created a lead, signup, partnership, or revenue event? What evidence does it actually have?

**Observe**

- qualified/relevant audience versus raw reach;
- relationship/conversation outcomes;
- recent content outcomes and attribution caveats;
- external versus internal learning;
- human decision waiting;
- proxy evidence versus direct business outcome;
- H1 Results breadth versus H2 Results/Learn separation.

## 13. Phone-sized critical block

Run on the assigned compact navigation treatment. Use the same navigation mechanic for H1 and H2.

At minimum cover semantically equivalent instances of:

1. find something needing a human decision;
2. find/edit a draft and identify its lifecycle state;
3. identify an approved/waiting post after simulated re-entry;
4. continue a conversation and identify the public-send action;
5. recover from an uncertain reply send without resending;
6. find audience-quality evidence;
7. find external research;
8. find own-account evidence;
9. find a strategy recommendation/placement point when included;
10. find AI model/provider settings;
11. compare external and own-account evidence.

Record mobile-specific observations separately:

- hidden destination not discovered;
- horizontal scanning expectation;
- lifecycle text truncated/ambiguous;
- explanation-on-demand hard to reach;
- evidence provenance lost when cards stack;
- action consequence hidden below the control;
- back navigation loses state/context;
- technical/Advanced entry dominates ordinary task route.

Do not infer phone success from desktop completion.

## 14. Candidate terminology probes — only after behavior

After natural language/path/consequence capture, show candidate terms in small sets. Rotate candidate order across sessions where order could bias interpretation.

For each term ask:

1. `What would you expect this to contain or do?`
2. `What would definitely not belong here?`
3. `What happens next if you choose it?`
4. `What is the difference between this and the neighboring term?`

Do not make `Which do you like?` the primary question.

### Terms to probe

- recommendation / suggestion / plan;
- selection / chosen format;
- draft / generate / regenerate;
- review / check readiness;
- approve / approved — not published yet;
- planned / waiting / scheduled / publishing / published;
- send / publish;
- reconciliation / verify before retrying / check current state;
- winning / working / promising / repeated;
- communicative intent / purpose / angle;
- presentation style;
- Test / Experiment;
- suggested change / learned recommendation / strategy recommendation;
- relevant followers / audience quality / qualified audience growth;
- content opportunity / conversation opportunity / business opportunity;
- Learn;
- Current winning styles;
- What works for you;
- Tests;
- Strategy recommendations;
- Settings / Advanced / Diagnostics;
- Off / Suggest / Apply;
- No influence / Advice only / Use for this generation.

### Strategy-label test

Only after U13's unprimed behavior test, show one candidate three-label set at a time. Ask the participant to predict Writer effect, scope, and public-action authority for each label.

A strategy label fails the intended semantic contract if the participant reasonably interprets it as:

- content approval;
- send/publication;
- account-wide autonomous behavior;
- learned-rule acceptance;
- experiment assignment;
- `suggest` changing Writer generation;
- `off` deleting evidence or retiring learned rules.

Record the interpretation; do not correct it until that label set has been fully tested.

## 15. Observation record

Create one blank record per session. Do not pre-fill participant behavior, quotes, or outcomes.

### Session header

| Field | Record |
|---|---|
| Session ID | Non-identifying study ID |
| Date | Session date |
| Researcher | Moderator initials/name |
| Participant role | Daily operator / stakeholder / occasional reviewer / advanced secondary |
| Relevant experience | Short work-context note; no unnecessary personal data |
| IA assignment | C0 / H1 / H2; include order if multiple |
| Device order | Desktop -> phone / phone -> desktop / single device |
| Strategy placement assignment | None / S1 / S2 / S3; include order if multiple |
| Prototype revision | Commit/version identifier used for the session |
| Known stimulus deviations | Any difference from planned controlled content |

### Task record

Repeat for each task.

| Field | Record |
|---|---|
| Task ID | IA/U task identifier |
| Device / condition | Actual stimulus shown |
| Outcome | Completed / completed with recovery / failed / skipped |
| First destination/action | Exact first path/action |
| Full path | Node/screen/action sequence |
| Backtracking | Paths/actions revisited |
| Hesitation | Factual note; time may be recorded descriptively |
| Help requested | Yes/no + exact request |
| Moderator intervention | Exact hint/help given |
| Consequence prediction | Verbatim or close verbatim before consequential action |
| Actual interpretation after transition | Participant's explanation of what happened |
| Current-state interpretation | Their words for current state |
| Evidence-source interpretation | External / own account / test / strategy / unclear based on explanation |
| Uncertainty interpretation | What they think confidence/interval/attribution means |
| Retry/recovery behavior | What they tried/wanted to try |
| Participant's natural term | Exact term before candidate labels |
| Candidate-label interpretation | Meaning/effect after term is shown |
| Mobile-specific issue | If applicable |
| Quote | Verbatim only if actually said; otherwise blank |
| Researcher observation | Factual observation separate from interpretation |

### End-of-session debrief

Ask:

- `What was hardest to predict?`
- `Was there anything you expected to find but could not?`
- `Which two things felt most similar even though the product treated them differently?`
- `Which two things needed to stay separate?`
- `Was there any action you would be nervous to use on a real account? Why?`
- `What words in the prototype would you change in your own language?`

Do not use the debrief to overwrite task behavior. Retrospective preference is secondary to observed path/consequence evidence.

## 16. Observation codes for later analysis

These codes organize observations; they are not findings until applied to real session data.

| Code | Meaning |
|---|---|
| `AUTHORITY_MIX` | Recommendation, selection, generation, approval, schedule, send, or publication treated as equivalent. |
| `EVIDENCE_SOURCE_MIX` | External, own-account, explicit-test, or strategy synthesis evidence treated as the same source/score. |
| `OUTCOME_PROXY_MIX` | Audience/distribution proxy described as a directly recorded business outcome. |
| `LEARN_EDUCATION_INTERPRETATION` | `Learn` interpreted as tutorials/help/education rather than evidence/adaptation. |
| `RESULTS_TOO_BROAD` | Results becomes an undifferentiated home for outcomes, research, tests, strategy, settings, and status. |
| `POSTS_TOO_BROAD` | Participant expects all evidence/strategy management inside Posts and cannot find later learning elsewhere. |
| `ADVANCED_INTRUSION` | Participant enters model/runtime/diagnostics for an ordinary task because they think configuration is required. |
| `LIFECYCLE_RECALL_FAILURE` | Participant cannot identify current state without reconstructing module ownership/history. |
| `UNSAFE_REMOTE_RETRY` | Participant wants to resend/republish while remote effect is uncertain or known complete. |
| `STRATEGY_SCOPE_MIX` | Per-generation writing influence interpreted as approval, global automation, learned-rule acceptance, or experiment assignment. |
| `SUGGEST_WRITER_EFFECT` | Advice-only strategy interpreted as changing Writer generation. |
| `STYLE_INTENT_MIX` | Presentation style, communicative intent, content type, or private author motivation are conflated. |
| `OBSERVATIONAL_CAUSAL_MIX` | Association/test result interpreted as causal proof without supporting design. |
| `CONFIDENCE_PROBABILITY_MIX` | Interval/confidence/attribution information interpreted as probability of future virality/success. |
| `VIRAL_DEPTH_CERTAINTY_MIX` | Research depth interpreted as truth/certainty level rather than study scope/depth. |
| `SETTINGS_CATEGORY_MISMATCH` | Participant predicts a materially different home/meaning for Settings/Advanced/Diagnostics concepts. |

Add new codes only when repeated observations cannot be represented accurately by this set. Preserve the raw observation regardless of coding.

## 17. Analysis plan after real sessions

Do not analyze by preference vote alone.

### Step 1 — Preserve raw evidence

For each task, retain:

- first path/action;
- full path/backtracking;
- consequence prediction;
- state interpretation;
- participant terms;
- evidence-source interpretation;
- recovery choice;
- moderator help;
- condition/device/order.

### Step 2 — Separate observation from interpretation

For each candidate finding, write five fields:

1. **Observed behavior** — factual session evidence.
2. **Participant language** — actual terms/quotes where available.
3. **Expert interpretation** — why the pattern may matter.
4. **Repository/frozen constraint** — authority/evidence rule that cannot be violated.
5. **Design implication/recommendation** — proposed next change, or `unresolved`.

Do not put expert reasoning in quotation marks or present it as participant language.

### Step 3 — Look for patterns, not arbitrary thresholds

For qualitative rounds, emphasize:

- recurring wrong first destinations;
- repeated consequence-prediction errors;
- unsafe remote-action assumptions;
- consistent participant-created category/language patterns;
- role-specific differences;
- desktop versus phone differences;
- first-exposure versus later-exposure differences;
- repeated evidence-provenance or causal-interpretation failures;
- whether an issue changes an IA, language, authority, or interaction decision.

A single high-consequence authority/retry misunderstanding can justify investigation or repair even when no frequency claim is warranted. A repeated low-consequence wording preference does not automatically outrank successful task behavior.

### Step 4 — Assign severity only after interpretation

Use the existing UX severity frame:

- **P0:** blocks a task or creates credible risk of unintended consequential action;
- **P1:** recurring major misunderstanding/friction or recovery failure;
- **P2:** efficiency/readability issue;
- **P3:** polish/consistency issue.

Severity is a researcher synthesis grounded in observed behavior and repository consequences; it is not a participant quote and not a percentage.

### Step 5 — Preserve confounds

When comparing conditions, note:

- condition order;
- device order;
- prior exposure to a task;
- moderator intervention;
- prototype differences outside the intended variable;
- participant role/familiarity.

Do not claim an IA effect when a screen-content/prototype-quality difference could explain the behavior.

## 18. Decision gates

These gates guide later `USABILITY_FINDINGS.md`. They do not pre-decide outcomes.

### C0 versus H1 versus H2

Support an IA only when participants can predict key destinations **and** their explanations match the intended content/authority.

Consider revision/rejection when:

- wrong first choices cluster on the same competing destination;
- recovery requires repeated backtracking or coaching;
- one condition produces evidence-source or authority collapse;
- mobile removes critical findability that worked on desktop;
- participants need current implementation vocabulary to choose correctly.

Do not declare H2 successful merely because participants eventually find `Learn`.

### `Learn`

Treat `Learn` as failed/requiring revision if real participants repeatedly interpret it as tutorials, onboarding, help, or generic AI education and therefore do not predict evidence/adaptation content.

Treat evidence as supportive only when participants expect the relevant evidence/strategy concepts there while still distinguishing external, own-account, and test evidence.

### H1 Results breadth

Treat H1 as overloaded if real participant paths/expectations repeatedly make Results an undifferentiated catch-all for performance, research, tests, strategy, and technical settings or if `More` hides deliberate advanced tasks without helping ordinary tasks.

### Strategy placement

Keep evidence-management placement separate from per-draft influence placement in analysis.

Evidence supports a split responsibility when participants consistently expect:

- evidence/recommendation history in a learning/results area; and
- the final no-influence/advice-only/deliberate-use choice at the draft immediately before generation.

Evidence supports a single location only if participants can find it and predict its effect without losing evidence provenance or draft-level control.

If expectations differ materially by role, keep the decision open or define role/task responsibilities rather than forcing one location.

### Strategy labels

A candidate set is not acceptable merely because it sounds familiar. It must produce the intended behavior prediction.

Reject/revise a candidate if participants interpret it as:

- approval;
- send/publication;
- account-wide autonomous behavior;
- experiment assignment;
- learned-rule acceptance;
- `suggest` changing Writer generation;
- `apply` persisting beyond the intended generation without explicit choice.

### Simplified Viral research

Support the ordinary/Advanced split when ordinary operators can start a sensible bounded study without touching provider/model/raw sampling controls and can explain what depth changes.

Revise when:

- ordinary users repeatedly enter Advanced because the default path appears incomplete;
- research-depth words are read as certainty/quality guarantees;
- required scope choices are hidden by simplification;
- users cannot tell current-run evidence from older stored evidence after stop/failure.

### Lifecycle language

Support a lifecycle presentation only when participants can state:

- current state;
- what has not happened yet;
- the next allowed decision;
- whether a later/background transition may occur.

Particular high-consequence failures are:

- `Approved` interpreted as already public;
- planned/scheduled interpreted as guaranteed publication;
- `Publishing` interpreted as confirmed publication;
- generation/readiness interpreted as approval.

### Recovery/reconciliation

The safe mental model is:

- remote effect may already have happened;
- current authoritative state must be checked;
- ordinary resend/republish is not safe yet;
- verify/refresh/reconcile before another remote write.

If participants repeatedly choose resend from the uncertain state, treat the presentation as unsafe regardless of whether backend guards would reject a duplicate.

Do not use participant research to invent a backend reconciliation action. Research may show that refresh/inspection is insufficient; implementation design comes later.

### Evidence provenance and observational interpretation

Support an evidence presentation only when participants can identify:

- outside/comparable-post evidence;
- this account's observed outcomes;
- explicit-test evidence;
- the limitations of each.

Revise when participants infer one hidden score, universal market truth, causal X-ranking rules, or virality probability from interval/confidence information.

### Settings / Advanced / Diagnostics

Do not finalize these terms from expert preference.

Use participant-created group names, first paths, and task predictions for provider/model configuration, audience definition, and raw diagnostics. A label/placement is stronger when advanced users can deliberately find it and ordinary users do not route normal research/writing through it.

### Stakeholder Results

Support the Results presentation when a stakeholder can answer:

- what changed;
- whether the relevant audience/relationships appear to be improving;
- what recent content outcomes were observed;
- what is learned externally versus from this account;
- whether anything needs a human decision;
- whether direct business outcomes are actually recorded or absent.

Revise if reach/follower movement is repeatedly read as proof of leads/revenue or if H1/H2 structure prevents the stakeholder from connecting outcomes to evidence without conflating them.

## 19. What remains blocked until real participants

This runbook does not resolve:

- C0 versus H1 versus H2;
- whether `Learn` is a valid evidence/adaptation label;
- final labels for external patterns, own-account evidence, tests, or strategy recommendations;
- final words for `off|suggest|apply` semantics;
- strategy evidence/selection placement;
- ordinary Viral research-depth labels or which controls belong outside Advanced;
- Settings versus Advanced versus Diagnostics terminology/placement;
- final lifecycle/reconciliation wording;
- whether bare recommendation/quality scores aid judgment;
- whether refresh/inspection is sufficient for each real partial-success transport failure class;
- final phone navigation treatment;
- any population-level usability rate or preference.

Only real session evidence can move these from hypothesis to supported/rejected/revised decisions.

## 20. Researcher completion checklist

Before a session:

- [ ] participant role is recorded without unnecessary personal data;
- [ ] IA condition/order is assigned before exposure;
- [ ] device order is assigned;
- [ ] H1/H2 use equivalent content and the same phone navigation mechanic;
- [ ] strategy-placement stimulus is assigned if used;
- [ ] prototype contains no live consequential action;
- [ ] no candidate language is visible during the unprimed grouping/language stage unless it is intrinsic to the assigned tree stimulus;
- [ ] task record is blank.

During a session:

- [ ] first path/action is captured before coaching;
- [ ] consequence prediction is captured before each consequential action;
- [ ] participant wording is captured before candidate terms;
- [ ] moderator help is recorded verbatim/precisely;
- [ ] evidence-source interpretation is captured;
- [ ] recovery behavior is captured without allowing a real resend;
- [ ] mobile-specific issues are separated from desktop findings.

After a session:

- [ ] factual observations are preserved before interpretation;
- [ ] real quotes are marked verbatim; absent quotes remain blank;
- [ ] condition/device/order and confounds are retained;
- [ ] no individual session is converted into a population percentage;
- [ ] no IA/label is declared validated from preference alone;
- [ ] no `USABILITY_FINDINGS.md` claim is written until real observations exist and are analyzed.
