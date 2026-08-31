# Product Language

This document is the repository owner for product-language semantics. It defines what the product must mean when it describes goals, actions, evidence, and writing-strategy behavior.

It does **not** select the final information architecture or claim that prototype labels have been validated by participants. Lifecycle/error wording lives in `docs/ux/STATUS_LANGUAGE.md`. Reusable Human-AI presentation patterns live in `docs/ux/HUMAN_AI_INTERACTION.md`.

## Evidence discipline

Use three labels when a wording decision depends on evidence status:

- **Stable semantic contract** — the behavior/authority meaning is fixed by the current product or Wave-1 synthesis. Wording may still be refined without changing the meaning.
- **Current baseline wording** — wording already present in the product. It is not automatically validated user language.
- **Research hypothesis** — candidate user-facing wording that requires participant evidence before becoming final product language.

There are no participant findings in this document.

## Language principles

1. **Name the user's goal before the system mechanism.** Say what the person is trying to accomplish; keep queue, pipeline, scorer, runtime, and database vocabulary in technical detail.
2. **Use action verbs for immediate consequences.** A button that selects must say selection, not generation. A button that sends must say send.
3. **Keep authorities distinct.** Recommendation, human selection, generation, readiness, approval, schedule/wait, remote send/publish, and confirmed result are different concepts.
4. **Keep evidence provenance visible.** External niche evidence, this account's evidence, and explicit test evidence are not one score.
5. **State uncertainty at the claim.** Do not hide observational or attribution limitations only in technical detail.
6. **Use exact nouns for overloaded outcomes.** A content opportunity, conversation opportunity, and business opportunity are different things.
7. **Prefer an answer first, then explanation, then technical detail.** Ordinary operators should not need internal identifiers to make a normal decision.
8. **Never imply guaranteed virality, guaranteed growth, or direct revenue attribution from proxy evidence.**

## Product purpose and goal language

The default strategic frame is **qualified growth velocity**: grow the relevant audience efficiently over time while preserving attribution caveats. It is not a promise that any post will gain followers, and it is not raw follower count, views, or likes.

The product outcome hierarchy is:

1. directly recorded business outcomes, when they exist;
2. relevant audience growth;
3. relationship outcomes;
4. durable content value;
5. distribution/reach;
6. vanity interaction.

Do not collapse these into one opaque success score.

| Stable semantic concept | Plain-language description | What it must not imply | Wording status |
|---|---|---|---|
| Qualified/relevant audience growth | More of the people the account actually wants to reach are appearing in the observed audience over time. | That one post caused the follow; that every new follower is valuable; guaranteed growth. | **Stable semantic contract.** Exact label such as `Qualified audience growth`, `Relevant audience growth`, or `Audience quality` requires participant evidence. |
| Reach | How widely content was distributed or viewed. | Audience quality, authority, business value, or causation by a specific tactic. | **Stable semantic contract.** `Reach` is an ordinary domain term, but surrounding interpretation still matters. |
| Technical authority | Evidence that the account is becoming a credible, useful technical reference through substantive, supported work. | A hidden reputation score; that impressions alone prove authority. | **Stable semantic contract.** Exact summary label remains a content-design choice. |
| Relationships | Repeated useful interaction and conversation with relevant people. | That every reply is a meaningful relationship; that relationship value equals revenue. | **Stable semantic contract.** |
| Opportunities | Must always name the object: `conversation opportunity`, `content opportunity`, or `business opportunity`. | Using bare `opportunity` when the kind is ambiguous. | **Stable semantic contract.** Final destination/label placement remains research-dependent. |
| Showcase a build | Put qualified attention on a concrete product, release, project, or result. | Conversion optimization when no conversion outcome is observed. | **Stable semantic contract.** Candidate goal wording. |
| Experiment/test | A deliberate comparison between declared choices using real work and an explicit success measure. Assignment is explicit. | Automatic randomization, duplicate/near-duplicate spam, an automatic winner, approval, scheduling, or publication. | **Stable semantic contract.** Whether the user-facing noun is `Test` or `Experiment` is a **research hypothesis**. |
| Revenue/business outcome | A directly recorded lead, signup, sale, partnership, career/consulting opportunity, or other business event. | Inferring business value from follower growth, reach, timing, or sequence alone. | **Stable semantic contract.** Current product has no business-outcome ledger. |

### Recommended strategic-goal explanations

These explanations are content-system guidance, not a new backend objective enum.

| Goal | Explanation pattern |
|---|---|
| Grow relevant followers | `Prioritize work that may help the account reach more people who match the audience you want to build. Results remain observational.` |
| Maximize reach | `Prioritize distribution and momentum while keeping the same evidence and approval requirements.` |
| Build technical authority | `Prioritize credible technical insight, proof, and durable reference value.` |
| Build relationships | `Prioritize useful conversations and repeated interaction with relevant people.` |
| Showcase a build | `Prioritize qualified attention to this build or release. Do not imply conversion unless conversion is recorded.` |
| Run a test | `Compare a declared choice on real work. Assignment stays explicit and does not publish anything.` |
| Revenue/business value | `Treat this as a long-term purpose until directly observed outcomes can be recorded. Do not present proxy movement as revenue optimization.` |

## Consequential action language contract

The action verb must describe the **first state-changing consequence** caused by activation.

### Semantic ladder

Keep this ladder explicit in copy and interaction design:

`inspect -> recommend -> select/route -> generate/edit -> check readiness -> approve -> plan/wait -> publish/send -> confirmed result`

A later step may depend on an earlier one, but one verb must not silently stand in for another authority.

| Action meaning | Stable semantic definition | Candidate user-facing action | What happens next pattern | Must not imply | Wording status |
|---|---|---|---|---|---|
| Inspect/read | Opens information or evidence without changing workflow authority. | `View evidence`, `Open source`, `Review details` | `This opens the evidence/details. It does not change the work item.` | Selection, generation, approval, send, publish. | Semantic stable; exact labels context-specific. |
| Select/route | Human chooses which recommendation/format/workflow to pursue. | `Choose this`, `Use as a thread`, `Select for drafting` | `This records your choice and moves the item into the {content type} workflow. Nothing is approved or published.` | That AI text has been generated unless generation also occurs. | Semantic stable; exact selection label requires task testing. |
| Generate draft | Starts AI generation and creates/replaces candidate wording. | `Generate draft with AI` | `AI will create draft wording from the supplied context. You will review the exact text before approval.` | Approval, publication. | Semantic stable. Current baseline already uses `Generate with AI`. |
| Regenerate/rewrite | Starts another generation that replaces or revises existing candidate wording. | `Regenerate with AI` | `AI will replace the current generated wording. Review the new text before approval.` | Preserving unsaved edits; approval carrying over automatically. | Semantic stable. Warn before destructive replacement. |
| Check readiness | Runs deterministic writing/evidence/confirmation checks against current content. | `Check readiness` | `This checks whether the current draft is ready for human approval. It does not approve or publish it.` | Human approval; AI recommendation; send/publish. | Semantic stable; `review` versus `check readiness` remains a participant-language question. |
| Approve wording | Human authorizes the exact current content for the next controlled stage. | `Approve for publishing`; for replies, approval may be a separate state or explicitly combined with send. | `This approves the exact text. It is not public yet.` | Immediate publication unless the same control explicitly says `publish`/`send`. | Semantic stable; exact label must preserve consequence. |
| Choose timing/schedule | Records or changes a publishing plan/time. | `Choose time`, `Save publishing plan` | `This saves the planned time. It does not approve or publish the post.` | Guaranteed execution; immediate publication. | Semantic stable. `Scheduled` as a label remains a comprehension hypothesis. |
| Publish now | Starts an immediate main-feed remote publication attempt. | `Publish now` only if that immediate remote effect truly exists. | `This will publish the approved post to X now.` | Merely approving, scheduling, or marking a manual action complete. | Semantic stable. **The current React baseline has no ordinary main-feed Publish-now control.** Do not introduce this wording for existing approval/schedule actions. |
| Send reply now | Starts the immediate remote reply transport using the exact approved text. | `Send approved reply`; `Approve & send exact reply` only for the combined action. | `This sends the exact approved reply to X now.` | A reversible local-only action. | Semantic stable. Current reply copy is a strong baseline. |
| Dismiss/ignore | Records that the recommendation/source should no longer compete for current attention. | `Dismiss recommendation`, `Skip source`, `Skip conversation` | `This removes it from current attention. It does not delete the source or publish anything.` | Deleting historical evidence; acting on X. | Semantic stable; exact terminal/reopen behavior must be stated per object. |
| Retry | Repeats an operation **only when retry safety is known**. | `Try again` only for read-only or explicitly retry-safe operations; otherwise name the operation. | `This will retry {operation}. {Known prior-effect statement}.` | That all failures are safe to repeat. | Semantic stable. See `STATUS_LANGUAGE.md`. |
| Reconcile/inspect uncertain remote state | Gets authoritative state or instructs verification before another remote write. | `Check current state`, `Verify on X`, `Refresh status` depending available capability. | `The previous action may already have reached X. Check the current state before trying again.` | Ordinary resend/republication. | Semantic stable. Exact recovery control is implementation-dependent and remains a prototype question for some failure classes. |

### Consequence-copy grammar

For consequential controls, pair the verb with one short sentence that answers the immediate effect.

Use one of these patterns:

- **Local reversible action:** `This {records/changes} {state}. It does not {next higher authority}.`
- **AI generation:** `AI will {create/replace} draft wording. You will review the exact text before approval.`
- **Human approval:** `This approves the exact {post/reply}. It is not {published/sent} yet.`
- **Timing:** `This saves the planned time. It does not approve or publish the post.`
- **Immediate remote action:** `This will {publish/send} the exact approved {post/reply} to X now.`
- **Manual completion record:** `Use this only after you completed the action on X. This records your confirmation; it does not perform the action.`
- **Uncertain prior remote action:** `The previous {send/publish} may already have reached X. Check the current state before trying again.`

Do not require a user to infer a high-consequence side effect from color, iconography, or surrounding architecture.

## Plain-language translation of internal terms

These translations are defaults for semantics, not evidence that the exact UI labels are participant-validated.

| Internal term | Plain-language concept |
|---|---|
| niche | Topic/audience fit |
| hook | Opening |
| insight | Useful insight |
| evidence score | Support |
| action score | Takeaway |
| originality | Original angle |
| attribution confidence | How isolated the observed result was from other changes/events |
| experiment | Deliberate comparison; candidate user-facing noun `Test` remains provisional |
| learned strategy | Evidence-backed change/guidance; distinguish accepted learned-rule influence from draft-level writing strategy |
| Queue | Work state / items waiting on a decision |
| Route | Choose what this should become |
| Pipeline | Content/contribution type |
| Engage Next | Conversation work / conversation opportunities |
| TargetScore | Relationship fit |
| EngagePriority | Reply priority |
| SaturationPressure | Recent interaction level |
| WATCH | Needs attention / advisory warning, depending object |
| CONSTRAINED | Some actions are temporarily limited |
| directional | Evidence is promising but still limited |
| repeated | A similar pattern appeared repeatedly; still observational unless the evidence design establishes more |

Technical identifiers and exact codes may remain available under technical detail.

## Evidence and learning language

### Provenance lanes

The source of evidence must be visible before the user is asked to apply or accept a conclusion.

| Evidence lane | Stable meaning | First-layer description | Must not be described as |
|---|---|---|---|
| External niche evidence | Observations from comparable outside posts/accounts in a defined niche/time sample. | `Observed among comparable niche posts` | `What works for your account`; universal X ranking truth; causal proof. |
| Internal account evidence | Outcomes repeatedly observed on this account. | `Observed on this account` | Market-wide truth; direct business causation. |
| Experiment/test evidence | Evidence from an explicitly declared comparison with explicit assignment and measured outcomes. | `From a deliberate comparison on your work` | Randomized trial unless it actually was randomized; automatic winner; causal proof by default. |
| Strategy synthesis | A transparent recommendation that may reference the three evidence lanes for one draft opportunity. It is **not** a fourth evidence owner. | `Guidance for this draft, based on the evidence shown below` | An accepted learned rule; one blended AI score; autonomous production authority. |

Do not hide provenance in a tooltip when it changes interpretation.

### Evidence strength

Evidence-state semantics are stable even while final user-facing labels remain hypotheses.

| Semantic state | Meaning | Candidate plain-language presentation | Required caveat |
|---|---|---|---|
| Insufficient | There is not enough qualified evidence to support a directional recommendation. | `Not enough evidence yet` | Do not rank as a supported strategy. |
| Directional | The observed data points in a direction, but evidence is limited or not yet repeated enough. | `Promising — needs more evidence` | Observational; may reverse with more data. |
| Repeated | A similar association appears repeatedly under the source's evidence rules. | `Consistent pattern — still observational` | Repetition is not causal proof. |

`Directional`, `repeated`, `Current winning styles`, and similar terms must never be translated into a probability that a future post will go viral.

### Observational association versus causal proof

Use explicit claim grammar:

- **Observational:** `In this observed sample, {pattern} was associated with {outcome}. This does not show that the pattern caused the outcome.`
- **Own-account observation:** `On this account, posts with {pattern} had {outcome} in the measured sample. Other changes may have contributed.`
- **Test evidence:** `In this declared comparison, {option} had {observed result}. Assignment/confounders mean this is not automatically a causal result.`
- **Business outcome:** `A {business outcome} was recorded and linked to this work with {operator-selected attribution confidence}.` Do not say `generated` or `caused` unless direct evidence supports that claim.

Avoid:

- `This style drives growth.`
- `90% likely to go viral.`
- `This post gained 12 followers` when only account-level follower change was observed in the window.
- `This created a lead` when no direct outcome is recorded.

### Sample size, confidence, and limitations

First layer should answer the conclusion and its evidence strength. Explanation on demand should expose:

- sample size and unique authors/items where relevant;
- time window;
- comparison context;
- interval/confidence information in its actual statistical meaning;
- known confounders/attribution downgrades;
- evidence source/provenance;
- missing evidence.

Plain-language patterns:

- `Based on {n} observed posts from {authors} authors in this window.`
- `This result is easier/harder to isolate because {context}.`
- `The sample is small; treat this as a lead to investigate, not a rule.`
- `External and own-account evidence disagree; no single conclusion is implied.`

Do not use `confidence` without naming what confidence refers to when a non-expert could read it as success probability.

## Style versus communicative intent

These are separate semantic dimensions.

### Communicative intent

**Stable meaning:** what the text is trying to accomplish with the reader, inferred from the observable wording. Examples include teach/explain, compare/evaluate, announce, invite discussion, share a resource, report an experiment, or challenge/provoke opinion.

It must not be described as private motivation or psychological intent. Prefer phrasing such as `communicative intent`, `what this post is trying to do`, or another participant-validated equivalent.

### Presentation style

**Stable meaning:** how the message is structured/presented. Examples include announcement, field note, benchmark breakdown, comparison, how-to, curated list, problem/solution, opinion, community question, build-in-public, or short observation.

Style is not content type. A Thread is a content type; a how-to or benchmark breakdown is a presentation style; `teach/explain` is communicative intent.

### Unsafe conflations

Do not use:

- `intent` to mean the author's private motive;
- `style` to mean Original/Quote/Thread/Reply;
- `angle` as an unexplained substitute for both intent and style;
- an external style association as a command to reproduce reference wording.

The exact user-facing labels for intent and style remain **research hypotheses**.

## Writing-strategy behavior language

Canonical behavior IDs are fixed: `off|suggest|apply`. These are system semantics, not validated display labels.

Until participant research supports a different default, an applicable draft starts in canonical `suggest`: guidance is visible, but Writer generation is unchanged. This default is a behavior contract, not validation of any display label such as `Advice only` or `Suggest`. The human can explicitly change the mode to `off` or `apply` for the work item.

| Canonical ID | Stable behavior | Writer effect | Human-visible effect | Must not change |
|---|---|---|---|---|
| `off` | No learned style/intent guidance influences this generation. | No strategy instruction is supplied. | The UI may state that guidance is not being used. | Recommendation/selection, approval state, schedule, publication/send authority, learned-rule status. |
| `suggest` | Show relevant strategy/evidence as advice only. | **Zero Writer effect.** | Human can inspect the recommendation and evidence, then choose whether to use it. | Same authority boundaries; suggestion cannot silently influence text. |
| `apply` | Human deliberately selects intent/style guidance to influence this generation only. | Selected strategy is supplied as generation guidance, subject to content-type/voice/hard constraints. | UI must show what was deliberately selected and which context supports it. | Hard gates, content type, approval, timing, send/publish authority, experiment assignment, learned-rule acceptance. |

For repost, authored-body writing strategy is normally not applicable.

### Provisional label candidates

Do not freeze one set before participant research.

| Semantics | Candidate labels to test | Disqualifying interpretation |
|---|---|---|
| `off` | `No influence`, `Don't use guidance`, `Off` | User thinks evidence is deleted, disabled account-wide, or learned rules are retired. |
| `suggest` | `Advice only`, `Show suggestion`, `Suggest` | User thinks Writer will already use the strategy, or that accepting the suggestion is required. |
| `apply` | `Use for this generation`, `Use this strategy`, `Apply` | User thinks this approves content, publishes/sends, enables account-wide automation, or accepts a learned rule. |

The research question is behavioral, not preference-based: **after seeing the label, can the person predict whether the Writer changes this generation and whether any approval/public action occurs?**

## Provisional IA/category labels

Wave 1 did not validate the following labels. They may appear in prototypes only with their semantic intent documented:

| Candidate label | Intended meaning | Unsafe/confusing interpretation to test |
|---|---|---|
| `Learn` | Evidence and adaptation: external patterns, own-account evidence, tests, and strategy guidance kept distinct. | Tutorials, education, help center, generic AI learning. |
| `Current winning styles` | External observational evidence about presentation patterns among comparable niche posts. | Guaranteed winners, causal X-ranking recipe, probability of virality. |
| `What works for you` | Evidence observed on this account. | Generic personalization, AI opinion, universal best practice. |
| `Tests` | Explicit deliberate comparisons with explicit assignments. | Unit/software tests; randomized experiments; automatically generated duplicate posts. |
| `Strategy recommendations` | Evidence-backed guidance/learned proposals; exact scope must say whether it affects recommendation logic or draft generation. | Editorial recommendation, accepted learned rule, automatic strategy execution. |
| `Settings` | Place for durable configuration. | A validated final IA location; current research has not selected this label. |
| `Advanced` | Place for expert/technical controls/details. | A validated final IA location or a place ordinary tasks must pass through. |
| `Diagnostics` | Inspection of raw/system/account-health detail. | A natural home for mutating AI/niche settings; Wave 1 specifically found this may be unclear. |

Do not turn these prototype labels into a “canonical terminology” list until real participant evidence supports them.

## Words that require scope

Avoid bare terms when the object is ambiguous:

- `Opportunity` -> `conversation opportunity`, `content opportunity`, or `business opportunity`.
- `Review` -> human editorial review or deterministic readiness check; say which one.
- `Apply` -> name what is applied and where; never use as a generic workflow submit button.
- `Plan` -> editorial recommendation, publishing plan, or research plan; say which one.
- `Ready` -> ready for approval, ready to send, or eligible to publish; say which one.
- `Confidence` -> evidence interval, attribution isolation, AI classifier confidence, or other; say which one.
- `Learning` -> external evidence, own-account observation, test evidence, accepted learned change, or draft writing guidance; say which one.

## Language anti-patterns

Do not use these as the only explanation for consequential behavior:

- `Something went wrong.`
- `Apply` without an object/effect.
- `Continue` when the next action can send/publish.
- `Success` before remote confirmation.
- `Scheduled` when the state is only an advisory recommended time and execution is not guaranteed.
- `AI decided` when a human made the selection.
- `The system learned` without naming evidence source and whether the change is suggested or accepted.
- `Viral` as a guarantee or causal label.
- `Won`/`winner` for observational test results without the evidence design to support that claim.
- `Revenue growth` when only audience/distribution proxies are measured.

Use `docs/ux/STATUS_LANGUAGE.md` for state/error/retry wording and `docs/ux/HUMAN_AI_INTERACTION.md` for layer/authority patterns.
