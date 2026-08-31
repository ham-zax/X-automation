# Jobs to Be Done

**Scope:** jobs research frame for the current React product and the stakeholder-stated future Learn/strategy direction.

Exact job wording in this document is a **research hypothesis** until representative operators and stakeholders describe the work in their own language. It must not be promoted into final UI copy solely because it appears here.

## Evidence discipline

- **Repository-observed:** supported by current product behavior.
- **Stakeholder-stated:** desired product purpose or control boundary.
- **Research hypothesis:** proposed user framing to test.

No participant language or preference data is represented in this document.

## Core progress users are trying to make

The product's technical modules are not the jobs. A user does not need to think “run Editorial Plan, then inspect queue state.” The useful unit is the progress they are trying to make under uncertainty.

The principal jobs below combine a functional outcome with confidence/control requirements because this product can trigger public actions and can present AI-derived evidence.

## Principal jobs

### J1 — Know what deserves attention now

**Research-hypothesis wording**

> When I open the product during the day, tell me what is worth my attention so I can spend time on the highest-value decision instead of scanning every source and workflow.

**Functional progress**

- find decisions waiting on the operator;
- see the strongest current editorial opportunity, if one exists;
- continue an active conversation before chasing weaker new work;
- see when nothing merits action.

**Confidence/control progress**

- understand why something is being surfaced;
- know whether it is advice or an action already taken;
- see important constraints before entering a dead-end workflow.

**Repository-observed support**

Today currently combines editorial recommendations, attention cards, account status, active-conversation/review counts, and next-scheduled information. Editorial recommendation selection is explicitly not approval/publication.

**Open research questions**

- Do users distinguish “worth looking at” from “requires a decision”?
- Does one surface provide enough orientation, or do users still scan other destinations for trust/completeness?
- Does a stakeholder returning after several days understand the same priority language as a daily operator?

### J2 — Turn a worthwhile signal into the right kind of contribution

**Research-hypothesis wording**

> When I find a worthwhile signal, help me decide what useful contribution it deserves so I can choose an original post, thread, quote, reply, repost, or more research without treating every signal as a posting opportunity.

**Functional progress**

- understand the source/story and why it matters;
- choose a content/conversation treatment;
- defer or research weak evidence;
- skip work that is not additive.

**Confidence/control progress**

- understand why a format is recommended;
- retain the ability to choose a different valid treatment;
- avoid accidental publishing while exploring a recommendation.

**Repository-observed support**

Editorial recommendations can propose `PREPARE`, `RESEARCH_MORE`, or `SKIP`. Discover and Posts support explicit route choices. Research-first editorial recommendations cannot be selected directly into a publication route.

**Open research questions**

- Which words do users use for “what should this become?”
- Do users think of reply/repost as content types, relationship actions, or both?
- When do users want one recommended action versus a visible set of alternatives?

### J3 — Prepare public content without losing authorship or control

**Research-hypothesis wording**

> When I decide to create something, help me get to strong final wording faster while keeping me responsible for the exact text and evidence before anything public can happen.

**Functional progress**

- generate or edit a draft;
- inspect the source and evidence;
- improve weak wording;
- satisfy remaining content/media requirements;
- preserve the completed text as history.

**Confidence/control progress**

- know what the AI used and did not independently verify;
- understand what a writing-quality score can and cannot authorize;
- know that saving/regenerating/editing is reversible until approval;
- know that a generated “do not post” decision is advisory.

**Repository-observed support**

Writer generation uses supplied context and structured output; drafts remain editable; draft gates require human confirmations for relevant claims; save and generation do not approve/publish; completed content becomes read-only.

### J4 — Move from review to public action without ambiguity

**Research-hypothesis wording**

> When content is ready, show me exactly which decision I am making now and what will happen next so I never confuse checking, approval, scheduling, sending, and publication.

**Functional progress**

- check readiness;
- approve exact content;
- understand a recommended or overridden publish time;
- send an approved reply or allow an approved main-feed item to reach publication under the configured mode;
- recover from failure.

**Confidence/control progress**

- predict immediate and delayed side effects;
- know whether X received the action;
- distinguish “approved — waiting” from “published”;
- avoid optimistic success states.

**Repository-observed support**

Main-feed approval and publication are separate. Replies require explicit human approval and then send. Scheduler timing is advisory. Automation publishes only approved eligible main-feed items when enabled. Failure/reconciliation states are persisted rather than treated as success.

**Open research questions**

- Which lifecycle words are understood without explanation?
- Does “Approve for publishing” imply immediate publication to some users?
- Is “scheduled” interpreted as “guaranteed to publish” or merely “planned/eligible at this time”?

### J5 — Keep useful conversations moving

**Research-hypothesis wording**

> When someone worth engaging with creates an opening, help me continue the relationship with a concrete reply so I do not miss high-value conversations or send generic engagement.

**Functional progress**

- prioritize active conversations and new opportunities;
- understand the contribution to make;
- review relationship/source context;
- draft, approve, and send a reply;
- abandon stale opportunities.

**Confidence/control progress**

- know why the opportunity is prioritized;
- know when account constraints block send;
- verify the exact approved reply;
- know whether transport actually succeeded.

**Repository-observed support**

The conversation list prioritizes active conversations, exposes contribution/relationship context, and uses an explicit approval/send path. Approved reply text is invalidated if edited after approval.

### J6 — Understand whether growth is improving the right things

**Research-hypothesis wording**

> When I review progress, show me whether we are attracting the right audience and creating useful interactions, while making clear what is only associated with a post and what is an actual recorded outcome.

**Functional progress**

- review relevant audience movement;
- review conversation continuation;
- review recent content outcomes;
- inspect attribution context;
- identify directly recorded business outcomes when that capability exists.

**Confidence/control progress**

- avoid reading follower movement as causal proof;
- avoid equating reach with qualified growth;
- avoid equating qualified growth with a lead/customer/revenue outcome.

**Repository-observed support**

Current Results surfaces relevant follower quality, conversations, post measurements, editorial outcome cohorts, and attribution-confidence caveats.

**Stakeholder-stated gap**

A real business-opportunity/revenue ledger is desired but is not currently implemented. Until it exists, the UI must not imply that audience proxies are direct business outcomes.

### J7 — Learn what appears to be working in the market now

**Research-hypothesis wording**

> When the market changes, show me which writing approaches appear to be working among comparable people in my niche so I can inspect current external evidence instead of relying on generic social-media advice.

**Functional progress**

- choose a sensible research scope;
- run bounded historical collection;
- inspect repeated/directional associations;
- understand communicative intent and presentation style;
- inspect examples and limitations.

**Confidence/control progress**

- know that the evidence is external and observational;
- know the sample/time context;
- avoid reading an association interval as “probability this will go viral”;
- know that AI intent labels describe text-supported communicative purpose, not private motivation.

**Repository-observed support**

Viral Styles already provides read-only external X research, structured run progress, intent/style evidence, and explicit observational caveats.

**Open research questions**

- Do users use “winning,” “working,” “performing,” or another term for external associations?
- Do they distinguish “style” from “intent” without a taxonomy lesson?
- Which setup controls belong in the ordinary task versus advanced disclosure?

### J8 — Learn what repeatedly works for this account

**Research-hypothesis wording**

> When we have enough of our own outcomes, show me what repeatedly worked for this account so I can tell whether a market pattern actually transfers to us.

**Functional progress**

- inspect account-specific cohorts/outcomes;
- compare human choices and final published formats;
- inspect suggested learned rules;
- understand the evidence state and applicability;
- accept or retire bounded recommendation changes.

**Confidence/control progress**

- know that a suggestion is inert until accepted;
- know what accepting it will change;
- know that an accepted rule still cannot approve/send/publish content;
- know when later evidence makes the rule questionable.

**Repository-observed support**

Learned rules have suggested/accepted/retired semantics, bounded production adjustments, review/retirement signals, and protected authority boundaries.

### J9 — Ask a focused question with a test instead of guessing

**Research-hypothesis wording**

> When I am unsure which of two deliberate choices works better, let me run a focused comparison using real work so I can learn without creating spammy duplicate posts or pretending the result is causal proof.

**Functional progress**

- define a test/hypothesis;
- choose variants and a success measure;
- explicitly assign work;
- inspect evidence state and confounders;
- generate a learned suggestion only when evidence qualifies.

**Confidence/control progress**

- know assignment is explicit, not randomized;
- know a test does not create or publish content;
- know no automatic “winner” is declared;
- understand when evidence remains insufficient.

**Repository-observed support**

Current Experiments implements explicit definition/activation/assignment/completion and descriptive cohort evidence.

### J10 — Use learned writing guidance only when I choose to

**Research-hypothesis wording**

> When there is relevant evidence about how to write this item, let me decide whether the Writer should ignore it, show it as advice, or deliberately use it so the system never silently changes my writing strategy.

**Functional progress**

- inspect strategy evidence and fit;
- choose no guidance, suggestion-only, or deliberate application;
- see what strategy was selected for the draft;
- change/remove it before final approval.

**Confidence/control progress**

- distinguish strategy selection from content approval;
- know which external/internal/experiment evidence supports it;
- retain human authority over final text;
- know that applying guidance cannot publish/send anything.

**Stakeholder-stated / future:** this is the future `Off / Suggest / Apply` contract.

**Repository-observed:** no current writing-strategy mode/selection exists. Exact labels and mental model remain unvalidated.

### J11 — Give a stakeholder a truthful answer to “is this working?”

**Research-hypothesis wording**

> When I check on the system as an owner or stakeholder, give me a compact evidence trail from actions to outcomes to learning so I can make a strategy decision without operating the daily workflow or overclaiming causality.

**Functional progress**

- see relevant audience/conversation/content outcomes;
- compare external/current-market evidence with account-specific evidence;
- inspect active tests and strategy recommendations when relevant;
- identify missing evidence;
- distinguish proxy movement from recorded business outcomes.

**Confidence/control progress**

- understand provenance and time window;
- know which changes were human-selected or human-accepted;
- avoid interpreting AI output as autonomous strategy authority.

### J12 — Change advanced configuration without making it part of ordinary work

**Research-hypothesis wording**

> When I need to change the system's technical setup, give me precise control over the niche, AI runtime/provider/model, credentials, and diagnostics without requiring ordinary operators to understand those details.

**Repository-observed support**

Diagnostics currently links niche, AI Settings, relationship detail, and account status. AI Settings exposes runtime/provider/model/reasoning/role/credential/usage concepts.

**Open research question:** can advanced operators find this quickly while ordinary users correctly avoid it for daily research/writing tasks?

## Job hierarchy by strategic outcome

| Outcome layer | Primary jobs | Evidence status |
|---|---|---|
| Actual recorded business value | J6, J11 | Stakeholder-stated future capability; no current business-outcome ledger |
| Qualified audience growth | J1, J2, J5, J6 | Current product supports proxies/measurements |
| Relationship development | J1, J5, J6 | Current product supports relationship/conversation observations |
| Durable content value | J2, J3, J4 | Current product supports editorial/writing/review workflow |
| Learning and adaptation | J7, J8, J9, J10, J11 | External/internal/tests current; J10 future |
| Distribution/interaction | J4, J6 | Current product supports publication + measurements; not the top-level success definition |

## Confidence and control are part of the job

For this product, completing the functional task while losing authority clarity is a failed outcome. The minimum confidence/control contract to test is:

1. **Recommendation is advice.** It may be accepted, dismissed, or researched further.
2. **Selection is a human workflow choice.** It does not approve content.
3. **Readiness checks are not approval.** They evaluate current content/confirmations.
4. **Approval is not publication.** Main-feed work may wait for schedule/automation.
5. **A reply send is explicit.** It uses the exact approved text.
6. **A test assignment is not automated strategy.** It is an explicit comparison context.
7. **A suggested learned rule is inert.** Acceptance gives it bounded recommendation influence only.
8. **Future writing-strategy application is not approval authority.** It influences generation context only.
9. **External evidence is not this account's result.** Internal evidence is not a universal market claim.
10. **Audience proxies are not business outcomes.** Direct business claims require directly recorded evidence.

## Current product support versus research/future gaps

| Job | Current support | Important gap to research or build later |
|---|---|---|
| J1 Attention now | Strong current Today surface | Validate priority language and phone findability |
| J2 Choose contribution | Multiple recommendation/routing paths | Validate whether choices feel coherent rather than duplicated |
| J3 Prepare content | Writer + editor + gates | Validate quality/gate comprehension without internal terminology |
| J4 Consequential lifecycle | Strong backend authority separation | Validate prediction of approval/schedule/send/publication states |
| J5 Conversations | Dedicated conversation workflow | Validate opportunity/relationship language and expiry semantics |
| J6 Results/qualified growth | Performance/audience/conversation measurements | No direct business-outcome ledger |
| J7 External evidence | Viral Styles | Setup complexity and “viral”/“style” language unvalidated |
| J8 Own-account learning | Results + learned rules | IA currently splits evidence across Performance/Experiments |
| J9 Tests | Experiments | Validate whether “Tests” is the natural user term/location |
| J10 Optional strategy | Not implemented | Validate mental model and labels before implementation |
| J11 Stakeholder view | Evidence exists across several destinations | Validate a coherent read-only evidence journey |
| J12 Advanced config | Diagnostics + settings | Validate separation from ordinary workflows |

## Language hypotheses to take into research

Do not present these as preferred terms before participants speak naturally:

- “What should I work on next?” may be more natural than “priority queue.”
- “What should this become?” may be more natural than “route/pipeline.”
- “Check readiness” may be more predictable than “review” if participants use “review” to mean human editorial reading.
- “What is working now?” may or may not distinguish external evidence from “what works for me.”
- “Current winning styles” may overstate evidence if participants interpret “winning” as causal certainty.
- “Strategy recommendation” may be confused with an editorial recommendation unless scope is explicit.
- `Off / Suggest / Apply` may be too system-like unless participants understand it as draft-level guidance.
- “Relevant followers” may not communicate the stakeholder concept of qualified audience growth.
- “Opportunity” may mean an X conversation opportunity, a business lead, a career opening, or a content idea; the intended object must be made explicit.

The user-language guide defines how to test these hypotheses without leading participants.
