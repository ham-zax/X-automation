# Human-AI Interaction Contract

This document is the repository owner for reusable Human-AI interaction patterns. It upgrades the existing contract; it is not a second Human-AI framework.

Use `docs/ux/PRODUCT_LANGUAGE.md` for product/action/evidence semantics and provisional labels. Use `docs/ux/STATUS_LANGUAGE.md` for lifecycle, error, retry, and reconciliation wording.

There are no participant findings in this document. Where exact display labels remain open after Wave 1, this document defines the required behavior and prohibited interpretations rather than pretending the label is validated.

## Core authority model

The product has four distinct kinds of authority:

1. **AI/advisory authority** — research, classify, rank, recommend, generate, explain, and summarize. It can produce evidence-backed advice but does not silently become human intent.
2. **Deterministic policy authority** — hard validation, factual/evidence requirements, eligibility, account-health constraints, expiry, supported content types, and other domain rules. These are not AI opinions.
3. **Human decision authority** — selecting a route/strategy, confirming facts/evidence, approving exact wording, accepting/retiring a learned change, assigning a test option, choosing timing, or explicitly initiating a remote action where the backend requires it.
4. **Transport/result authority** — X/backend confirmation that a public action actually completed. A local pending state is not remote success.

Keep this sequence recognizable:

`AI recommendation -> human selection -> draft/generation -> deterministic readiness -> human approval -> schedule/wait -> remote send/publish -> confirmed result`

A product surface may combine adjacent actions only when the combined consequence is explicit before activation. The existing `Approve & send exact reply` pattern is valid because the control names both the human approval and immediate remote send.

## Layering model

Every Human-AI pattern uses the same three information layers:

### First layer — decision-ready

Show only what a non-technical operator needs to decide safely:

- what the object/recommendation/state is;
- why it matters now;
- what evidence/limitation materially changes the decision;
- what the human can do;
- what happens immediately after each consequential action.

### Explanation on demand

Expose reasoning and evidence needed to challenge or understand the recommendation:

- evidence provenance and strength;
- why a format/strategy was proposed;
- blockers and limitations;
- alternatives;
- relevant timing/relationship/account context;
- what changed since the previous state.

### Technical detail on demand

Expose exact identifiers, metrics, intervals, raw cohorts, model/runtime/provenance, gate codes, experiment configuration, and diagnostic context for advanced inspection.

Technical detail must not be required for ordinary approval, reply, research, or stakeholder tasks.

## Pattern 1 — AI recommendation

Use for editorial recommendations, audience review suggestions, optional writing guidance, and similar AI/advisory outputs.

**Visible first layer**

- State that this is a **recommendation/advice**, not a completed decision.
- Show the recommended action/format plus the reason it is worth considering now.
- Show the evidence source at least at the lane level: external, own-account, test, or other supplied context.
- Show a limitation when evidence is insufficient, directional, stale, contradictory, or otherwise decision-relevant.
- Offer explicit human choices such as inspect evidence, select/use, research further, dismiss, or choose another valid route.

**Explanation on demand**

- supporting sources/evidence;
- evidence state/sample/time context;
- why-now and why-this-format/strategy reasoning;
- alternatives/risks;
- account/relationship context used;
- AI provenance if needed to evaluate trust or cost.

**Technical-detail layer**

- model/runtime/profile;
- structured-output provenance;
- raw recommendation components/identifiers;
- exact evidence IDs and algorithm mechanisms where relevant.

**Human authority boundary**

The human decides whether to select/use/dismiss/research the recommendation. Selection may route work but is not approval.

**Prohibited interpretation/side effect**

- `AI decided for you`;
- selection that silently approves, schedules, publishes, sends, assigns a test, or accepts a learned rule;
- opaque score as the sole reason to act.

## Pattern 2 — Deterministic rule or gate

Use for writing/evidence checks, hard eligibility, account-health constraints, expiry, and other non-AI policy boundaries.

**Visible first layer**

- Name the consequence: `Fix before approval`, `Sending is temporarily unavailable`, `Evidence confirmation required`.
- State what must change or be confirmed.
- Do not present a hard rule as an AI suggestion that can be casually ignored.

**Explanation on demand**

- why the rule applies;
- which exact content/state triggered it;
- whether a human confirmation is sufficient or the underlying content/state must change;
- what action becomes available after resolution.

**Technical-detail layer**

- gate/check code;
- scorer component or rule identifier;
- exact health/repetition/saturation evidence;
- raw validation state.

**Human authority boundary**

The human can edit content, provide required confirmations, change a valid configuration, or choose not to proceed. Human approval does not erase a hard rule the backend still enforces.

**Prohibited interpretation/side effect**

- treating the gate as AI confidence;
- allowing recommendation/strategy strength to bypass the gate;
- hiding a hard blocker behind a generic low score.

## Pattern 3 — Human selection

Use when the human chooses a recommendation, content type/route, test option, or future writing-strategy behavior.

**Visible first layer**

- Name what is being chosen.
- State the immediate workflow effect.
- State what higher authority has **not** happened.

Example semantic copy:

> `This records your choice and moves the item into the Thread workflow. Nothing is approved or published.`

**Explanation on demand**

- original recommendation versus human-selected alternative;
- why the choice is compatible/incompatible;
- evidence linked to the selection;
- reversibility conditions.

**Technical-detail layer**

- selection provenance, actor, timestamp, route/pipeline ID;
- exact strategy/test assignment IDs when relevant.

**Human authority boundary**

Selection belongs to the human. AI may recommend an option but must not report the recommendation as if the human selected it.

**Prohibited interpretation/side effect**

- selection granting approval;
- a `Draft` label that implies AI generation if the actual action only routes/creates a scaffold;
- strategy selection accepting a learned rule.

## Pattern 4 — Draft generation and regeneration

Use when AI creates or replaces candidate wording.

**Visible first layer**

- Action says generation occurs now: for example `Generate draft with AI`.
- Pending state says what is happening: `Generating draft…`.
- Existing editable text remains clearly a **draft**, not an approved/public result.
- Regeneration warns when unsaved human edits will be replaced.

**Explanation on demand**

- what source/evidence/context AI received;
- material limitations, including that generation did not independently verify facts unless a verified evidence path supplied them;
- any advisory `do not post yet` output and its reasoning;
- whether optional writing strategy influenced this generation.

**Technical-detail layer**

- model/runtime/profile and execution provenance;
- evidence IDs supplied/used;
- structured generation metadata;
- selected strategy ID/snapshot when the future strategy path exists.

**Human authority boundary**

The human owns the exact final wording and required factual/evidence confirmations. Generated text is always reviewable/editable before approval.

**Prohibited interpretation/side effect**

- generation approving or publishing content;
- AI advisory `DO_NOT_POST` becoming a hidden hard block;
- strategy guidance overriding factual evidence, hard gates, content type, or human edits.

## Pattern 5 — Human approval

Use when a person authorizes exact wording for a later controlled action.

**Visible first layer**

- Show the exact content being approved or make it directly inspectable without leaving the decision context.
- Show required fact/evidence confirmations.
- State the next consequence in plain language.
- For main-feed work: `Approval is not publication.`
- If automation may act later, say so explicitly and name the condition/time relationship.

**Explanation on demand**

- blockers already satisfied;
- what approval records;
- whether later automation is enabled;
- publishing plan/eligibility context;
- how editing after approval affects approval.

**Technical-detail layer**

- human approval timestamp/actor;
- approved text/hash where applicable;
- gate state at approval;
- automation/scheduler context.

**Human authority boundary**

Approval is an explicit human decision over exact wording/evidence. It may make content eligible for a later transport path, but does not itself prove publication.

**Prohibited interpretation/side effect**

- a plain `Approve` control that secretly sends/publishes immediately;
- carrying approval forward after the approved exact text changes;
- treating a quality score or AI recommendation as approval.

### Combined approval + remote action

A combined control is allowed only when its label and consequence copy explicitly name both effects. Current example:

> `Approve & send exact reply`
>
> `This sends the exact text above as a reply on X after your approval. Nothing sends until you click.`

Do not generalize this to main-feed publication unless the backend actually performs the immediate remote action.

## Pattern 6 — Send or publish

Use only for an immediate remote side effect.

**Visible first layer**

- Use the remote verb: `Send`, `Publish`, `Unfollow`.
- Identify the exact object/target when ambiguity matters.
- State that the remote effect starts now.
- Show a pending state that does not imply success.

**Explanation on demand**

- approved text/target;
- publication/reply target identity;
- any constraint that can still prevent transport;
- why this action is available now.

**Technical-detail layer**

- remote identity/tweet ID/link after confirmation;
- transport timestamp and recorded result;
- failure/reconciliation metadata when incomplete.

**Human authority boundary**

The final immediate remote action is human-triggered where the current backend requires it. Main-feed automation remains a separate configured authority path operating only on approved eligible work.

**Success criterion**

Do not show `Published`, `Sent`, or equivalent success until authoritative remote identity/result is known and the product can represent the resulting state. If the remote effect may have succeeded but local recording is incomplete, use the reconciliation pattern instead.

**Prohibited interpretation/side effect**

- optimistic success;
- generic `Continue` for a remote write;
- `Publish now` on a control that only approves or schedules;
- automatic unsolicited reply sending.

## Pattern 7 — Learned recommendation

Use for evidence-backed proposed changes to future recommendation logic.

**Visible first layer**

- finding;
- evidence state/sample context;
- suggested change;
- **what will change if accepted**;
- current status: suggested, accepted, retired/review-needed.

**Explanation on demand**

- baseline/comparison result;
- evidence provenance and metric;
- applicability/match context;
- limitations/review reasons;
- whether newer evidence is stale/reversed.

**Technical-detail layer**

- rule ID/scope/match;
- bounded adjustment target/component/value;
- mechanism tags and review internals.

**Human authority boundary**

A suggested rule has zero production effect until explicit human acceptance. An accepted rule may exert only the bounded influence its domain owner allows. Retirement removes production effect.

**Prohibited interpretation/side effect**

- accepting a suggestion approving/publishing/sending content;
- accepted learned rule becoming a hard gate;
- external Viral evidence silently becoming an accepted production rule;
- `accepted` meaning causally proven.

## Pattern 8 — Writing-strategy guidance and selection

This is the future draft-time writing-guidance contract from the source plan. The current product does not yet implement it.

Canonical behavior IDs are `off|suggest|apply`; final user-facing labels remain research hypotheses.

**Visible first layer**

Show:

- recommended communicative intent and presentation style, when evidence supports them;
- why the guidance fits this draft/opportunity;
- external, own-account, and test evidence as visibly separate sources;
- limitations/disagreement;
- current behavior choice: no influence, advice only, or deliberately use for this generation.

**Explanation on demand**

- evidence rows grouped by provenance;
- evidence strength/sample/window;
- why external/internal evidence agree or disagree;
- why a strategy is not applicable to a pipeline;
- how the strategy should affect presentation rather than facts/content type.

**Technical-detail layer**

- canonical intent/style IDs and taxonomy version;
- strategy selection ID and guidance snapshot;
- exact evidence references;
- generation provenance showing whether the selection actually influenced the generated draft.

**Human authority boundary**

- `off`: no strategy influence on Writer generation;
- `suggest`: advice visible to the human, **zero Writer effect**;
- `apply`: human deliberately permits the selected guidance to shape this generation only.

The human can change/remove the selection before approval. Repost normally has no authored-body strategy application.

**Prohibited interpretation/side effect**

No writing-strategy action may:

- select/approve the editorial recommendation;
- approve exact content;
- schedule;
- publish/send;
- assign a test;
- accept/retire a learned rule;
- enable account-wide autonomous writing behavior;
- turn external evidence into production learned-rule authority.

A display label equivalent to `Apply` fails if a reasonable participant interprets it as any of those effects.

## Pattern 9 — Failure and reconciliation

Use whenever a consequential action fails or the product cannot prove the final remote/local state.

The full vocabulary and retry matrix live in `docs/ux/STATUS_LANGUAGE.md`. The Human-AI pattern is:

**Visible first layer**

1. what operation failed;
2. whether the remote effect is known not to have happened, may have happened, or is confirmed to have happened;
3. the current authoritative state;
4. the safe next action;
5. whether retry is safe, unsafe, or unknown.

**Explanation on demand**

- remote/local divergence;
- known remote identity/link;
- failed recording step;
- last confirmed state/read time;
- reconciliation options.

**Technical-detail layer**

- transport error/code;
- remote ID/result if available;
- local status/publish error/recording error;
- timestamps and request/provenance detail.

**Human authority boundary**

The user must not be offered an ordinary resend/republish action while remote effect is uncertain. Recovery may require a fresh authoritative read or explicit verification on X before another remote write.

**Prohibited interpretation/side effect**

- generic `Something went wrong` as the only explanation;
- stale pre-send controls after an uncertain remote result being treated as authoritative;
- optimistic success;
- automatic retry of a potentially completed remote write.

## Pattern 10 — Advanced disclosure

Use for exact metrics, runtime/provider/model configuration, raw evidence, provenance, experiment internals, account-health details, and diagnostics.

**Visible first layer**

Ordinary tasks show a plain conclusion and the next decision, with a clear way to inspect more when useful.

**Explanation on demand**

Show the evidence/reasoning needed to challenge the conclusion without requiring raw system vocabulary.

**Technical-detail layer**

Show exact metrics, model/runtime/provider, codes, raw cohorts/confounders, source snapshots, execution logs, and identifiers.

**Human authority boundary**

Advanced detail can inform a decision but must not create hidden action authority. Technical configuration remains an explicit human change.

**Prohibited interpretation/side effect**

- requiring runtime/model knowledge to run ordinary research or drafting;
- making technical values look like calibrated probabilities when they are internal scores;
- hiding consequential configuration mutations under a label that implies read-only diagnostics.

`Advanced`, `Settings`, and `Diagnostics` are still provisional category labels from Wave 1, not validated final IA terms.

## Preserved domain-specific boundaries

These constraints remain part of the Human-AI contract even when page structure/copy changes.

### Replies

- AI may generate/edit a reply draft.
- Deterministic gates and human confirmations govern readiness.
- Exact approved reply text is the authority for send.
- Editing after approval invalidates approval.
- Send is explicit and never scheduled.
- A partial remote/local result uses reconciliation, not optimistic `Sent`.

### Main-feed publication

- Recommendation/selection/generation/readiness/approval remain separate.
- Scheduler timing is advisory/eligibility planning, not publication.
- Automation may publish only approved eligible main-feed work when enabled.
- Current React has no ordinary `Publish now` control; do not imply that approval/schedule performs that action.
- Repost transport remains manual; the product records completion only after the human confirms it already happened on X.

### Unfollow

- AI may suggest accounts to inspect; it cannot unfollow them.
- One account per explicit human action.
- No bulk unfollow.
- Show pending immediately after click.
- Do not remove/decrement the account until XActions and local reconciliation confirm success.
- A confirmation popup is not required by the existing contract; consequence clarity must come from the action/context itself.

### Tests / experiments

- Definition and assignment are explicit.
- Only Active tests accept assignments.
- Do not imply randomization unless it actually occurs.
- Do not create duplicate/near-duplicate posts to manufacture A/B exposure.
- A test does not approve, schedule, publish, or send anything.
- No automatic winner or causal claim is produced by default.

Whether the user-facing primary noun is `Tests` or `Experiments` remains a participant-language question.

### Learned recommendations

- `suggested != accepted != retired`;
- suggestion has zero effect;
- show proposed effect before acceptance;
- acceptance is explicit and bounded;
- accepted does not mean hard constraint or causal truth;
- retirement removes production effect;
- later contradictory/stale evidence can require review/suspension/retirement.

### Research progress

- Show real checkpoints/progress only when backed by current job state.
- Never fake instantaneous completion or progress.
- `Stop after current unit` means the bounded current collection/AI unit may complete before stop takes effect.
- Research findings keep their run/time/evidence provenance.

## Recommendation, gate, and human-decision comparison

| Question | AI recommendation | Deterministic gate/rule | Human decision |
|---|---|---|---|
| What is it? | Advice based on supplied evidence/context. | A domain rule/eligibility requirement. | An explicit choice/authorization by the operator. |
| Can it be wrong/challenged? | Yes; inspect evidence/limitations and choose differently where valid. | The implementation/rule may be wrong, but the current rule is binding until the owning domain changes it. | Human may change a reversible choice until a later authority boundary makes it irreversible. |
| Does it act by itself? | No, unless a separate explicitly authorized automation contract says so. | It can allow/block domain transitions; it does not represent user intent. | It changes only the authority named by the action. |
| May it publish/send? | No. | No direct user intent; transport still follows its own authority path. | Only an action explicitly labeled/implemented as send/publish, or configured approved main-feed automation, can cause the remote effect. |
| First-layer copy | `Recommended…` + why/evidence/limitation. | `Blocked/required because…` + how to resolve. | `This will…` + immediate consequence. |

## Non-negotiable boundaries

Do not introduce:

- automatic unsolicited reply sending;
- mass follow/unfollow or bulk unfollow;
- fake-human timing/evasion;
- hidden reputation scores presented as truth;
- fake progress;
- optimistic remote success;
- causal claims from observational evidence;
- hidden blending of external/internal/test evidence;
- writing-strategy influence in `suggest` mode;
- writing-strategy `apply` that grants approval/publication authority;
- technical detail as a prerequisite for ordinary work.
