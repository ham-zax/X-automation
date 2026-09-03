# X Content & Persona System Overhaul Plan

**Date:** 2026-09-04  
**Repository:** `/home/hamza/repo/x_test`  
**Status:** design/implementation plan; no runtime behavior is changed merely by this document  
**Goal:** Replace the current technically useful-but-overconstrained X content system with a coherent behavioral system that can pursue aggressive growth, act socially like Hamza, preserve factual provenance, and later learn from `@ham_zax` outcomes without collapsing back into repetitive AI formulas.

**Architecture:** First clean the doctrine and authority hierarchy, then remove old content assumptions from the runtime, then model Hamza, then integrate that model upstream of writing, and finally learn from real account outcomes. The Writer should become the final realization layer of a prior behavioral decision, not the component that invents the account's role from scratch.

**Tech Stack:** Node.js repository modules, SQLite-backed persisted state in `store.js`, existing Growth OS pipeline/editorial/writer/relationship modules, React dashboard, Markdown operating contracts and research artifacts.

---

## Global Constraints

- The next system must optimize for follower growth and useful network construction, not merely technical correctness or content volume.
- Every public action must have a purpose, but not every public action must contain technical information.
- Social purposes are legitimate: humor, support, celebration, warmth, de-escalation, relationship maintenance, taste signaling, curiosity, and simple participation can be valid actions.
- A reply must not exist merely because the system wants another reply.
- Strategic imbalance is allowed while the account is small. The account does not need a perfectly balanced portfolio of modes.
- Performed social affect is allowed. The system may choose excitement, warmth, humor, calm, skepticism, teasing, or other socially useful affect even when Hamza's exact private feeling is unknown.
- Performed affect must not become fabricated biography or fabricated evidence.
- Factual first-person claims remain provenance-sensitive: tests, usage, project history, access, achievements, relationships, results, events, and other autobiographical facts may not be invented.
- Implied experiential authority must be treated with the same care as explicit `I tested` / `I used` claims.
- The system must not rebuild Hamza as a weighted blend of other creators.
- The seven-creator corpus remains a behavior reference library, not persona DNA.
- The Oracle reports and creator corpus are research evidence, not production authority.
- `FIRST_1000_GROWTH_MODE.md` and `ALGORITHM_EVIDENCE_LEDGER.md` are not to be treated as canonical strategy merely because older documents reference them. Salvage useful ideas only after independent review.
- Do not make platform-mechanic folklore into hard product rules.
- Preserve existing publication/send authority boundaries unless a later explicitly authorized implementation mission changes them.
- Do not redesign the UI merely because the content model changes. UI work should follow stable runtime contracts.
- This plan intentionally separates doctrine cleanup, runtime cleanup, modelling, integration, and learning. Do not jump directly to a giant Hamza prompt.
- No testing work is added by this plan. Testing/verification implementation should be authorized separately if required by the implementation mission or repository policy.

---

# 1. Why this overhaul exists

The current repository contains a sophisticated publishing, relationship, editorial, and measurement system, but its content philosophy was built around an earlier assumption:

> a good `@ham_zax` action should usually demonstrate useful technical intelligence.

That assumption created a recurring behavior pattern:

```text
source/event
-> find missing technical detail
-> add caveat / boundary / metric / implication
-> compress into polished reply/post
```

The first attempt to humanize it changed the prose but not the behavior-selection problem:

```text
source/event
-> human reaction
-> useful technical wrinkle
```

The Oracle audit identified the deeper problem: **behavioral selection, not merely wording**.

The better question is not:

> What sophisticated thing can Hamza add?

It is:

> What is a plausible Hamza role in this moment, what purpose would the action serve, and which available behavior best serves the current social context and growth objective?

That behavior may be:

- technical analysis;
- a benchmark or reproduction;
- a clear opinion;
- a useful question;
- skepticism;
- excitement;
- a joke;
- congratulations;
- support;
- taste;
- de-escalation;
- a relationship callback;
- an ordinary reaction;
- or silence.

The current canonical docs and runtime still partially force the older model. This overhaul exists to remove that contradiction before the Hamza model is built.

---

# 2. Core product principle

The system should adopt one universal rule across docs and runtime:

> **Every public action needs a purpose. Not every public action needs information.**

A public action is justified when it serves at least one legitimate purpose and fits the context.

Examples:

```text
Technical purpose:
correct a consequential misunderstanding

Relationship purpose:
congratulate a builder on a milestone in a way that strengthens recognition

Humor purpose:
reduce the temperature of an angry technical thread

Growth/discovery purpose:
join a major launch conversation with a memorable, context-appropriate reaction

Taste purpose:
signal a product/design judgment that helps make Hamza recognizable

Learning purpose:
ask a question whose answer meaningfully improves understanding

Support purpose:
make another person's contribution feel seen
```

A reply such as `LFG 🔥` generated mechanically under a random high-view account has no sufficient purpose merely because it might receive impressions.

A one-line reaction under a major model launch can have a clear purpose if it participates in a moment Hamza plausibly cares about, signals energy/taste, increases discovery, or advances a relationship.

---

# 3. New authority hierarchy

The repository currently has multiple documents that call themselves canonical/source-of-truth while encoding different generations of strategy. The first overhaul task is to make authority explicit.

## 3.1 Tier A — canonical operating contracts

These documents should contain current intended behavior and may constrain runtime implementation:

1. `docs/CONTENT_OPERATING_STANDARD.md`
   - owns the universal outbound-content contract;
   - defines what makes an action legitimate;
   - defines factual/provenance hard boundaries;
   - must no longer require technical information in every action.

2. `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`
   - owns strategic growth/network objectives;
   - explains why discovery, relationships, profile conversion, owned proof, and recurring recognition matter;
   - must not define a narrow technical-only contribution taxonomy.

3. `docs/RELATIONSHIP_INTELLIGENCE.md`
   - owns relationship state, interaction significance, target scoring, conversation continuity, and relationship measurement;
   - must recognize meaningful social interaction as well as technical exchange.

4. `docs/POST_GENERATION_PROMPT.md`
   - owns final Writer realization after upstream behavior has been selected;
   - must stop recomputing the account's purpose through the old `find a distinct developer angle` lens.

5. `docs/EDITORIAL_RECOMMENDATION_PROMPT.md`
   - owns advisory story/action selection semantics before writing;
   - should reason about behavior/purpose and social field, not only information thesis.

6. `docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md`
   - owns persistent operating-session behavior and handoffs;
   - must consume the new canonical behavior contract rather than maintaining a parallel content philosophy.

7. `docs/AGENT_WORKFLOW.md`
   - owns operator/agent workflow semantics;
   - should point to the current canonical contracts without restating stale writing doctrine.

8. `docs/PRODUCT_ARCHITECTURE.md`
   - remains the high-level product map;
   - should be updated only where the new behavior/persona layer changes architecture or ownership.

## 3.2 Tier B — experimental persona/model contracts

`docs/research/x_creator_phase2/HAMZA_X_PERSONA_EXPERIMENT.md`

This remains the current candidate behavior model until the dedicated Hamza modelling phase produces a stronger model.

It may guide experiments and model design, but its candidate beliefs must not silently become permanent truths about Hamza.

## 3.3 Tier C — research/evidence

Research informs decisions but does not directly constrain production behavior:

- `docs/research/x_creator_phase2/ORACLE_CREATOR_CORPUS_AUDIT.md`
- `docs/research/x_creator_phase2/ORACLE_HAMZA_PERSONA_REVIEW.md`
- `docs/research/x_creator_phase2/CANONICAL_X_WRITING_STUDY.md`
- `docs/research/x_creator_phase2/HAMZA_X_BEFORE_AFTER_AUDIT_2026-09-04.md`
- `docs/X_AI_CREATOR_RESEARCH_SET.md`
- collected creator corpora and derived research artifacts.

The file named `CANONICAL_X_WRITING_STUDY.md` should be treated as historical research despite its filename. Its title does not grant production authority.

## 3.4 Tier D — historical/retired strategy notes

The following should not govern the new system:

- `docs/FIRST_1000_GROWTH_MODE.md`
- `docs/ALGORITHM_EVIDENCE_LEDGER.md` as a strategy authority
- older session-specific recovery documents
- historical implementation plans whose implementation status has been superseded

### Proposed disposition

`FIRST_1000_GROWTH_MODE.md`:

- salvage the useful concept that small-account growth may require strategic imbalance, speed, borrowed distribution, and repeated recognizable participation;
- those ideas already live more cleanly in Persona V2 and should be moved into the appropriate canonical growth contract;
- after references are removed, retire/delete the document rather than preserving a competing growth doctrine.

`ALGORITHM_EVIDENCE_LEDGER.md`:

- salvage the evidence-discipline idea: distinguish current platform evidence, official policy, account-specific observation, hypothesis, and retired claims;
- do **not** let platform implementation details become content philosophy;
- either reduce it to a small non-authoritative research/evidence registry or retire it if no runtime consumer genuinely requires it;
- remove language that gives it blanket strategic authority unless the project deliberately re-establishes that role later.

---

# 4. Target behavioral architecture

The system needs explicit separation between **purpose**, **behavior**, **emotion**, **information depth**, and **provenance**.

These must not be collapsed into one `replyStrategy` string or one writing style.

## 4.1 Action purpose

Every outbound action should have one primary purpose and optional secondary purposes.

Initial purpose vocabulary:

```text
technical_value
profile_proof
discovery
relationship
support
celebration
humor
taste
learning
correction
de_escalation
social_presence
```

Definitions:

- `technical_value` — teach, explain, compare, reproduce, benchmark, expose an implementation detail, or improve a technical decision.
- `profile_proof` — create durable evidence of what Hamza builds, knows, tests, or consistently notices.
- `discovery` — use a relevant distributed context to help new target people encounter the account.
- `relationship` — deepen recognition or continuity with a person/community.
- `support` — acknowledge, encourage, thank, or visibly back another person's useful work.
- `celebration` — participate in a launch/milestone/success with appropriate energy.
- `humor` — add wit, absurdity, shared-builder recognition, or social relief.
- `taste` — express a product/engineering/design/DX judgment that contributes to recognizable identity.
- `learning` — ask or surface something whose answer improves understanding.
- `correction` — correct a consequential claim or boundary.
- `de_escalation` — improve a tense conversation by lowering hostility or bridging disagreement.
- `social_presence` — legitimate ordinary participation when the moment/relationship itself is the reason to be present.

The system should not automatically privilege `technical_value` over all others.

## 4.2 Social/behavioral mode

Initial mode vocabulary:

```text
builder
experimenter
explainer
curious_peer
enthusiast
skeptic
taste_maker
supporter
humorist
listener
personal_update
```

`silent` should be an action outcome, not a persona identity.

A mode answers:

> What role is Hamza playing?

A purpose answers:

> Why is the action worth taking?

These are different.

Example:

```text
purpose: relationship
mode: humorist
```

or:

```text
purpose: technical_value
mode: skeptic
```

## 4.3 Affect strategy

Initial affect vocabulary:

```text
neutral
match
amplify
contrast
de_escalate
bridge
reward
energize
understate
```

Affect strategy answers:

> What emotional energy should Hamza introduce relative to the current room?

Examples:

- `match`: join excitement around a legitimately exciting release.
- `amplify`: increase energy when a launch/milestone deserves celebration.
- `contrast`: answer hype with dry skepticism or answer anger with humor.
- `de_escalate`: reduce hostility without abandoning the point.
- `bridge`: make two apparently opposing views more collaborative.
- `reward`: make another person's contribution feel seen.
- `energize`: make an important but understated technical moment feel significant.
- `understate`: deliberately use restraint when the room is excessively loud.

## 4.4 Information depth

Initial depth vocabulary:

```text
social_only
judgment
compact_reason
technical_explanation
reusable_artifact
```

Depth should be selected from the action's purpose and context, not from a universal word-count target.

`social_only` is a legitimate final depth.

A social-only reply does not fail merely because it lacks a benchmark, caveat, implementation detail, or developer action.

## 4.5 Provenance classes

The runtime should distinguish at least:

```text
owner_fact
owner_experience
sourced_observation
analytical_judgment
inferred_affect
strategic_affect
genuine_or_social_question
```

Important distinction:

- `owner_experience` requires factual basis.
- `strategic_affect` does not claim literal private emotional truth.
- `analytical_judgment` may be strong without pretending Hamza personally ran the system.
- implied experience must be checked even when no first-person pronoun appears.

## 4.6 Behavior decision record

Before the final Writer runs, the system should eventually have an inspectable record similar to:

```json
{
  "decision": "ACT",
  "format": "reply",
  "primaryPurpose": "relationship",
  "secondaryPurposes": ["discovery", "humor"],
  "socialMode": "humorist",
  "affectStrategy": "de_escalate",
  "informationDepth": "social_only",
  "reasonToExist": "The thread is technically useful but unnecessarily hostile; a light joke can enter the conversation, lower tension, and make Hamza memorable without pretending to add another correction.",
  "growthObjective": "qualified_growth",
  "provenance": {
    "factualOwnerClaimsAllowed": false,
    "performedAffectAllowed": true,
    "sourceClaims": []
  },
  "personaModelVersion": null
}
```

or:

```json
{
  "decision": "SILENT",
  "reason": "No useful technical, social, relationship, identity, or growth purpose survives after context review. A reply would exist only to create activity."
}
```

The Writer should realize this decision rather than independently inventing a new role.

---

# 5. Fast decision architecture

The runtime should avoid turning every live X opportunity into a long research workflow.

Use two conceptual passes.

## Pass A — behavior/opportunity triage

Fast questions:

1. Is the source/context understood well enough for a low-risk action?
2. Is there at least one plausible Hamza role?
3. Is there at least one legitimate purpose?
4. What is the current social/emotional field?
5. Which available action best serves current growth/relationship objectives?
6. Does the action require deeper factual verification before wording?

Possible outputs:

```text
ACT_NOW
RESEARCH_THEN_ACT
SILENT
```

This pass should be cheap and fast.

## Pass B — wording and provenance guardrail

After a behavior is selected:

1. realize the selected purpose/mode/affect/depth;
2. verify factual source claims;
3. prevent fabricated explicit or implied biography;
4. check duplication/clarity/length/media constraints;
5. preserve route and human/publication authority.

The system should not spend Pass B proving that a social-only action secretly contains technical value.

---

# 6. Canonical document overhaul

This phase comes before implementation changes.

## 6.1 `docs/CONTENT_OPERATING_STANDARD.md`

### Current problem

The current MUST rules require every outbound item to add information/judgment/experience and to provide a specific developer benefit. The reply section hard-rejects generic excitement/praise and treats technical substance as the normal definition of legitimacy.

This conflicts with Persona V2 and the intended social model.

### Target role

Make this the smallest universal contract that all formats obey.

### Required changes

- Replace `every outbound action adds information/judgment/experience` with `every outbound action has a legitimate purpose`.
- Add the purpose taxonomy or reference its canonical owner.
- State explicitly that `social_only` can be valid.
- Separate `generic filler` from `purposeful social reaction`.
- Preserve hard truth/provenance rules.
- Add implied-biography guidance.
- Remove format rules that force a thesis where the selected purpose does not require one.
- Keep strong technical requirements for actions whose purpose is technical value/correction/proof.
- Rewrite Quote and Reply MUST sections so they depend on selected purpose rather than universal additivity.
- Keep duplicate, source copying, clarity, and fabricated-evidence constraints.
- Remove claims that every strong post should optimize the same reader action.
- Keep media as both explanation **and verified artifact/proof/identity** when appropriate.
- Stop treating fixed informational utility as the only route to follow value.

### Acceptance criteria

- A purposeful joke, congratulations, or excitement reply can pass the canonical standard without pretending to add a technical wrinkle.
- A random low-context engagement reply still fails because it has no sufficient purpose.
- A technical correction still requires evidence proportional to its consequence.
- The document no longer contradicts Persona V2's performed-affect model.

## 6.2 `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`

### Current problem

The network architecture is strong, but the account promise and contribution examples are overly technical. It defines demonstrated competence as the dominant conversational asset.

### Required changes

- Preserve the network loop, relationship compounding, profile conversion, and owned-content concepts.
- Replace the narrow account promise with a broader builder/person promise that allows technical work, taste, social participation, and varied behavior.
- Expand conversation insertion beyond benchmark/reproduction/correction/question.
- Add purposeful social interaction as a valid relationship/discovery tool.
- Define strategic imbalance by phase without creating a rigid First-1,000 doctrine.
- Make `every action needs a purpose` the eligibility principle.
- Retain separate metrics for reach, relationship, profile conversion, and owned proof.
- Remove dependency on `FIRST_1000_GROWTH_MODE.md` as precedence authority.
- Remove blanket dependency on `ALGORITHM_EVIDENCE_LEDGER.md` for strategic claims; preserve evidence discipline in a smaller bounded form if needed.

### Acceptance criteria

- The network system can explain why humor/support/celebration may create relationship value without misclassifying them as technical failure.
- It still rejects empty activity and engagement farming without context.
- The network architecture remains compatible with current route/queue/measurement ownership.

## 6.3 `docs/RELATIONSHIP_INTELLIGENCE.md`

### Current problem

`meaningful interaction` is currently defined almost entirely through technical content. The taxonomy omits celebration, support, humor, social observation, de-escalation, and relationship callbacks.

### Required changes

- Redefine meaningful interaction as an action with observable relationship/conversation purpose, not necessarily technical content.
- Keep generic praise from inflating relationship quality by default.
- Add social reply archetypes.
- Separate `interaction purpose` from `reply archetype`.
- Track author response/continuation regardless of whether the originating reply was technical or social.
- Preserve relationship stages and event history.
- Add qualitative relationship signals such as callback/recognition/inside-context when available.
- Revisit `InteractionYield` denominator so social interactions are not excluded merely because they lack technical information.

Proposed additional archetypes:

```text
celebration
support
humor
agreement
enthusiasm
social_observation
de_escalation
relationship_callback
```

Keep existing technical archetypes.

### Acceptance criteria

- A specific supportive interaction can contribute relationship evidence when it produces recognition/response/continuity.
- Generic filler does not automatically increase relationship quality.
- Analytics can compare social and technical modes instead of pretending only technical modes exist.

## 6.4 `docs/POST_GENERATION_PROMPT.md`

### Current problem

This is the highest-risk stale contract because it runs close to final generation.

It still pushes the model toward:

- distinct developer angle;
- reader lesson/action;
- technical additivity;
- `the interesting part isn't X...` style framing;
- no generic excitement;
- technical follow value as the main justification.

This can deform a correct Hamza behavior decision back into the old sophisticated-robot style.

### Target role

The Writer should realize an upstream behavioral decision faithfully.

### Required changes

- Add `behaviorDecision` to Writer input.
- Do not let Writer recompute primary purpose/mode/affect/depth unless no behavior decision exists in a legacy path.
- Replace Step 1 `determine whether a post should exist` with `verify the selected action still has a coherent purpose and sufficient context`.
- For social-only actions, do not demand developer lesson/action/evidence.
- For technical-value actions, retain technical/evidence quality.
- Remove `The interesting part is not X...` as a positive example.
- Remove universal rejection of `this is insane`/similar phrases; judge them by purpose/context/repetition rather than phrase alone.
- Allow performed affect consistent with behavior decision.
- Add implied-biography checks.
- Permit humor to be the complete contribution when the selected purpose/mode says so.
- Permit simple congratulations/support when relationship/social purpose is explicit.
- Keep source copying, fabricated evidence, duplicate, safety, length, and route constraints.
- Make the writer produce a candidate that matches the selected depth rather than trying to maximize information density.

### Acceptance criteria

- Given `purpose=celebration`, `mode=enthusiast`, `depth=social_only`, Writer can produce a short high-energy reply without inserting a benchmark/caveat.
- Given `purpose=correction`, Writer still requires precise factual grounding.
- Writer no longer defaults to `human reaction + useful wrinkle`.

## 6.5 `docs/EDITORIAL_RECOMMENDATION_PROMPT.md`

### Current problem

The editorial layer reasons mostly in terms of thesis/value/source relationship. It needs to become the natural upstream location for behavior/purpose selection on main-feed opportunities.

### Required changes

- Add behavioral purpose to recommendation semantics.
- Allow recommendations whose value is social/taste/relationship/discovery rather than only technical information.
- Preserve `SKIP` when no legitimate purpose exists.
- Keep source/provenance and code-owned scoring boundaries.
- Add social-field interpretation when sufficient conversation context is supplied.
- Do not create arbitrary affect if the source context is too thin.
- Recommend format from purpose + context + growth objective.
- Avoid making Quote inherently require an information thesis if a valid social/taste action belongs on the main feed.

### Acceptance criteria

- Editorial can recommend a Quote for taste/humor/celebration when that is the strongest account action.
- Editorial can still choose Original for durable technical/profile proof.
- Recommendation records why the action exists beyond `engagement`.

## 6.6 `docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md`

### Required changes

- Replace old `real contribution = technical additivity` assumptions with the canonical purpose model.
- Preserve authority and transport boundaries.
- Make behavior decision/purpose inspectable in persistent mission state.
- Do not let persistent operation become activity maximization.
- Continue to allow silence when no purpose exists.

## 6.7 `docs/AGENT_WORKFLOW.md`

### Required changes

- Point to the revised canonical contracts.
- Remove stale summary language such as `zero hashtags by default` or other details if those are experiments rather than workflow invariants.
- Do not restate the old Writer doctrine.
- Document the behavior decision handoff when implementation lands.

## 6.8 `docs/PRODUCT_ARCHITECTURE.md`

### Required changes

After the runtime architecture is agreed, add one explicit layer:

```text
source/context
-> editorial/opportunity reasoning
-> behavior/persona decision
-> writer realization
-> deterministic gates
-> human/automation authority
-> publication
-> measurement
-> learning
```

Do not describe the Hamza model as a writing-style plugin.

---

# 7. Historical document cleanup

## 7.1 `docs/FIRST_1000_GROWTH_MODE.md`

Target disposition: **retire after salvage**.

Salvage into canonical docs:

- small-account distribution pressure is real;
- strategic imbalance can be rational;
- borrowed distribution can be useful;
- speed can matter on live conversations;
- originals remain useful for profile proof;
- format outcomes should be measured separately.

Do not salvage as doctrine:

- numeric bootstrap route thresholds as philosophy;
- `silence is not neutral` as a universal rule;
- event participation merely because a source has momentum;
- any implication that purpose can be replaced by market presence.

After references are removed and the useful concepts are incorporated elsewhere, delete or move the file to a clearly historical location.

## 7.2 `docs/ALGORITHM_EVIDENCE_LEDGER.md`

Target disposition: **demote or retire**.

Salvage:

- evidence classes;
- explicit separation of code/policy evidence from empirical account observations;
- retired-claim tracking.

Do not preserve:

- blanket strategic authority;
- platform mechanics as writing rules;
- speculative creator-side optimization framed as algorithm truth.

If retained, rename/rewrite it so its scope is obvious, e.g. an evidence notebook rather than `strategy authority`.

## 7.3 Research docs

Do not rewrite the Oracle reports to match the new system. Their value is historical evidence.

Add a short status/header only if needed later to state:

```text
Research artifact. Not production authority.
```

Do the same for `CANONICAL_X_WRITING_STUDY.md` if the misleading name causes recurring confusion.

---

# 8. Runtime/codebase overhaul before Hamza modelling

The codebase should be made behavior-neutral before a personal model is integrated.

The goal of this phase is **not to simulate Hamza yet**.

The goal is to remove assumptions that automatically reject or down-score legitimate social behavior.

## 8.1 Create a shared behavior contract

**Files:**
- Create: `behavior.js`
- Modify later consumers listed below.

**Responsibility:**

Own stable enums/normalization/validation for:

```text
primaryPurpose
secondaryPurposes
socialMode
affectStrategy
informationDepth
behaviorDecision
```

Do not put Hamza-specific beliefs in `behavior.js`.

This is a domain contract, not the persona.

### Interface sketch

```js
normalizeBehaviorDecision(input)
validateBehaviorDecision(input, { pipeline })
behaviorDecisionSupportsSocialOnly(input)
behaviorDecisionRequiresFactualEvidence(input)
```

The exact implementation may differ, but one owner should prevent each subsystem from inventing its own vocabulary.

### Acceptance criteria

- Writer, engagement, measurement, and later persona modules can use one stable taxonomy.
- No creator-specific traits live in this module.

## 8.2 Rewrite deterministic content gates

**Files:**
- Modify: `drafting.js`

### Current problematic behavior

`evaluateDraftGates()` currently sets `additiveValue=true` by default and rejects:

- generic Quote commentary through `NON_ADDITIVE_QUOTE`;
- generic Reply praise through `GENERIC_REPLY` requiring a concrete technical contribution or informed question;
- generic Original reaction through `NON_ADDITIVE_ORIGINAL`.

`reviewGrowthPackaging()` requires a reader payoff such as resource/action, decision support, proof/evidence, specific insight, or useful question.

`scoreDraft()` assigns large score weight to evidence/action/insight in ways that naturally penalize legitimate social-only behavior.

### Required changes

- Replace universal `additiveValue` with purpose-aware `purposeIntegrity` / equivalent.
- Preserve source duplication and generic-filler detection.
- Make generic filler different from intentional social-only behavior.
- Require behavior decision context for social-only exceptions.
- Do not allow a model to bypass gates by simply labeling spam as `humor` or `relationship`.
- For technical modes, keep evidence/action/clarity requirements proportionate to claim risk.
- Make `reviewGrowthPackaging()` purpose-aware so social/relationship value can satisfy payoff when appropriate.
- Replace one universal 50-point writing score with either:
  - purpose-aware scoring; or
  - a smaller universal quality score plus purpose-specific checks.
- Avoid rewarding evidence merely for existing when the action does not require evidence.

### Acceptance criteria

- A purposeful short social reply can become publishable without fake technical content.
- A random generic reply still fails.
- Technical claims remain held to stronger evidence/provenance requirements.
- The deterministic gate can explain **why** a social action is valid.

## 8.3 Expand engagement opportunity semantics

**Files:**
- Modify: `engagement.js`
- Modify: `strategy.js`
- Modify: `pipeline.js`

### Required changes

- Separate `contribution` from `purpose`.
- Allow opportunities where the strongest contribution is social/relationship/humor/support.
- Do not make `relationshipPotential=0` or lack of technical additivity a universal reason to ignore a conversation.
- Do not make high momentum alone sufficient either.
- Prefer explicit `reasonToExist` over generic activity.
- Route Reply/Quote/Original from purpose and source relationship rather than old additivity flags alone.
- Preserve duplicate/already-used/source-scope checks.

### Acceptance criteria

- `strategy.js` no longer ends in a generic `No sufficiently additive distribution action yet` worldview as the only fallback explanation.
- A high-view source with no plausible Hamza purpose may still be ignored.
- A small but relationship-important conversation may outrank a large generic source.

## 8.4 Align autonomous reply behavior

**Files:**
- Modify: `autonomous_reply.js`

### Current state worth preserving

The existing code already separates reply intent and tone and includes a `social_reaction` path.

### Problem

The current rules still say:

- tone must not replace substantive value;
- the reply must make sense if any joke is ignored;
- lightweight social reactions require active/established relationship context.

Those rules partially encode the old technical-value assumption.

### Required changes

- Replace `intent + tone` with/augment it using the shared behavior decision.
- Allow humor/support/celebration to be the whole act when purpose is valid.
- Do not require the joke to contain a hidden technical payload.
- Keep stricter autonomous eligibility than human-reviewed behavior when needed for risk control, but call that an **automation authority/risk choice**, not the definition of valid Hamza behavior.
- Preserve live budget, duplicate, health, source eligibility, and atomic send boundaries.

### Acceptance criteria

- Autonomous mode can represent the new taxonomy without changing send authority.
- The system can intentionally route a valid social action to human review if autonomous authority is not broad enough.

## 8.5 Persist behavior decision/provenance

**Files:**
- Modify: `store.js`
- Modify: `agent_bridge.js`
- Modify: `pipeline.js`

### Preferred persistence shape

Avoid adding many top-level SQL columns prematurely.

Prefer one versioned JSON object first, e.g.:

```text
behavior_json
behavior_model_version
```

or embed a versioned behavior object in the existing editor/queue metadata if that is clearly owned and queryable.

The chosen location must support later analysis by purpose/mode/affect/depth.

### Required stored fields

At minimum:

```text
schemaVersion
primaryPurpose
secondaryPurposes
socialMode
affectStrategy
informationDepth
reasonToExist
selectionSource
personaModelVersion
provenanceSummary
```

### Acceptance criteria

- Published content can later be grouped by behavior dimensions.
- Human edits do not silently erase the behavior decision used to create the draft.
- Historical rows without behavior metadata remain readable as `unknown/legacy`.

## 8.6 Pass behavior context into the Writer

**Files:**
- Modify: `drafting.js`
- Modify: `agent_bridge.js`
- Modify: `autonomous_reply.js`
- Modify: any writer-packet builder owner located during implementation.

### Required behavior

`writer-packet` must include the selected behavior decision.

The Writer may adjust wording but should not silently replace:

- purpose;
- mode;
- affect;
- depth;
- route.

If Writer output materially contradicts the selected behavior, the deterministic review should surface it.

## 8.7 Update relationship persistence and analytics

**Files:**
- Modify: `store.js`
- Modify: `engagement.js`
- Modify: `experiments.js`
- Modify: relationship-related bridge/UI consumers only after the domain contract stabilizes.

### Required behavior

- Preserve existing `reply_archetype` history for compatibility.
- Extend or replace the taxonomy with social archetypes.
- Persist primary purpose independently from archetype.
- Allow outcome comparisons such as:

```text
purpose=relationship + mode=humorist
vs
purpose=technical_value + mode=skeptic
```

- Do not treat raw likes as relationship success.
- Continue tracking target response, conversation continuation, recurring interaction, follow/mutual conversion, and profile/follower evidence where available.

---

# 9. Hamza modelling phase

Do **not** begin this phase until the docs and runtime are capable of representing varied behavior without forcing technical additivity.

The goal is not to create a writing style.

The goal is to create a versioned model of:

> Hamza's beliefs, tastes, technical history, emotional/social behavior, humor, boundaries, growth instincts, and language realization.

## 9.1 Modelling sources

Use several sources rather than one interview.

### A. Forced-choice X situations

Present real or realistic X situations with several plausible actions:

```text
technical correction
joke
hype reaction
support
question
quote
original
ignore
```

Ask Hamza to choose, reject, or rewrite them and explain why.

This reveals behavior selection better than personality sliders.

### B. Disgust/attraction test

Show real technical/social posts and ask:

```text
would repost
would reply
would quote
like but say nothing
finds annoying
finds fake
finds impressive
would never write
```

Capture why.

### C. Technical first-person sandbox

Inventory technologies/projects/tools actually used or built within a defined period.

This becomes a factual first-person permission map, not a complete identity map.

Track:

```text
verified_owner_experience
verified_project
verified_tool_use
verified_result
verified_failure
unknown
```

Do not assume lack of an entry proves non-use forever; it means the model cannot confidently claim it yet.

### D. Belief calibration

Use forced tradeoffs rather than virtues.

Examples:

```text
velocity vs rigor
boring monolith vs distributed architecture
raw SQL vs ORM
strict typing vs iteration speed
local models vs hosted convenience
framework abstraction vs explicit code
benchmark obsession vs workflow usefulness
open source vs managed product convenience
```

The actual questions should reflect Hamza's real technical domains.

### E. Social behavior calibration

Model:

- how Hamza congratulates;
- how he handles someone he respects;
- how he handles arrogant behavior;
- how he handles a wrong but harmless claim;
- how he handles a consequential wrong claim;
- how he responds when two people are fighting;
- how much he teases;
- how much sarcasm is normal;
- profanity range;
- warmth with strangers vs familiar people;
- what he considers cringe.

### F. Affect calibration

Determine when the system may safely infer:

- excitement;
- annoyance;
- skepticism;
- delight;
- humor;
- pride;
- disappointment.

Separately define how strategic affect may be performed when private emotion is unknown.

### G. Language realization

Only after behavior is understood, model:

- sentence rhythm;
- vocabulary;
- punctuation;
- capitalization;
- profanity;
- emoji use;
- technical density;
- long-form explanation habits;
- casual vs professional register;
- repeated phrases to avoid.

Language is the last layer, not the persona core.

---

# 10. Versioned Hamza model design

The model should have one owner and version.

Do not duplicate a giant persona prompt across editorial, reply, and writer modules.

## 10.1 Proposed conceptual schema

```json
{
  "version": "hamza-v1",
  "identity": {},
  "beliefs": [],
  "tastes": [],
  "technicalProvenance": {},
  "behaviorPreferences": {},
  "socialPatterns": {},
  "affectPatterns": {},
  "humorBoundaries": {},
  "growthPosture": {},
  "languageRealization": {},
  "negativeExamples": [],
  "positiveExamples": [],
  "uncertainties": []
}
```

## 10.2 Runtime owner

**Proposed new file:** `persona.js`

Responsibilities:

- load the active versioned Hamza model;
- expose bounded slices to consumers;
- never grant publication/send authority;
- select/infer behavior only when the owning workflow asks;
- distinguish stable known profile facts from experimental model hypotheses.

Do not let the persona module own source truth, route persistence, deterministic scoring, or transport.

## 10.3 Storage

Do not hardcode the full Hamza model into multiple JS prompts.

Preferred options to decide during implementation:

1. versioned repository JSON/Markdown model with explicit operator edits; or
2. persisted model snapshot plus inspectable source artifact.

Whichever is chosen must support:

- version history;
- inspectability;
- explicit human changes;
- rollback;
- per-publication `personaModelVersion` attribution.

---

# 11. Persona integration architecture

The persona must influence **behavior selection before writing**.

Bad integration:

```text
strategy chooses technical caveat
-> Hamza Writer makes caveat sound casual
```

Target integration:

```text
source/context
        |
        v
opportunity + relationship state
        |
        v
social/informational field read
        |
        v
Hamza persona/model
        |
        v
plausible behavior candidates
        |
        v
growth objective + purpose selection
        |
        v
behavior decision
  purpose / mode / affect / depth / provenance
        |
        v
format/route realization
        |
        v
Writer
        |
        v
purpose-aware deterministic gates
        |
        v
human/automation authority
        |
        v
publish/send
```

## 11.1 Editorial consumer

Editorial should receive:

- relevant Hamza interests/beliefs/tastes;
- current growth objective;
- source/story context;
- profile-proof gaps;
- relationship context when relevant.

Editorial should not receive every language quirk.

## 11.2 Engagement/reply consumer

Engagement should receive:

- relationship history;
- social behavior preferences;
- affect patterns;
- humor boundaries;
- relevant beliefs/tastes;
- factual first-person sandbox.

## 11.3 Writer consumer

Writer should receive:

- selected behavior decision;
- only the language/persona slice needed to realize it;
- relevant provenance constraints;
- source/context.

Writer should not decide account strategy from scratch.

---

# 12. Learning and measurement after integration

The later learning system should measure behavior, not only format and topic.

## 12.1 Outcome dimensions

Keep separate:

```text
reach
likes
reposts
bookmarks
profile visits
follows
author response
second-turn conversation
repeat interaction
relationship stage change
mutual/follow relationship
```

Missing analytics remain unknown, not zero.

## 12.2 Behavior dimensions

Associate outcomes with:

```text
primaryPurpose
socialMode
affectStrategy
informationDepth
format
topic
relationshipStage
source/target class
first_hand_vs_external
personaModelVersion
```

## 12.3 Candidate lessons

Valid examples of later account-specific hypotheses:

> Humor/contrast replies perform better than neutral analysis in already-saturated AI launch conversations.

> Supportive replies to mid-size builders produce more recurring relationships than technical caveats under very large official accounts.

> Technical corrections produce strong impressions but weak profile-to-follow conversion unless the profile already contains matching owned proof.

> Enthusiastic Quote posts followed by owned build evidence improve profile conversion.

These remain observations/candidate lessons until repeated account evidence supports promotion.

Do not let one viral result rewrite the persona.

---

# 13. Detailed implementation tasks

## Task 1: Establish document authority and retire conflicting doctrine

**Files:**
- Modify: `docs/CONTENT_OPERATING_STANDARD.md`
- Modify: `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`
- Modify: `docs/RELATIONSHIP_INTELLIGENCE.md`
- Modify: `docs/POST_GENERATION_PROMPT.md`
- Modify: `docs/EDITORIAL_RECOMMENDATION_PROMPT.md`
- Modify: `docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md`
- Modify: `docs/AGENT_WORKFLOW.md`
- Modify: `docs/PRODUCT_ARCHITECTURE.md` only where ownership/architecture changes
- Retire/delete after reference cleanup: `docs/FIRST_1000_GROWTH_MODE.md`
- Demote/retire after reference cleanup: `docs/ALGORITHM_EVIDENCE_LEDGER.md`

**Interfaces:**
- Consumes: Persona V2, Oracle findings, current Growth OS architecture.
- Produces: one coherent canonical doctrine for implementation.

**Steps:**
- [ ] Replace universal technical-additivity language with purpose-based legitimacy.
- [ ] Define social-only behavior as legitimate when purpose/context supports it.
- [ ] Add performed-affect and implied-biography boundaries.
- [ ] Preserve factual truth/provenance requirements.
- [ ] Remove references that make the two spur-of-the-moment strategy docs authoritative.
- [ ] Ensure every canonical document points to the same behavioral hierarchy instead of restating a competing one.

**Acceptance criteria:**
- No canonical doc claims every reply must contain technical information.
- No canonical doc treats generic activity as valid merely because it may produce distribution.
- Persona V2 and canonical content/runtime docs no longer contradict each other.

---

## Task 2: Create the neutral behavior domain contract

**Files:**
- Create: `behavior.js`
- Modify: `drafting.js`
- Modify: `engagement.js`
- Modify: `pipeline.js`
- Modify: `strategy.js`
- Modify: `agent_bridge.js`
- Modify: `autonomous_reply.js`

**Interfaces:**
- Consumes: canonical purpose/mode/affect/depth taxonomy from Task 1.
- Produces: normalized inspectable behavior decisions for runtime consumers.

**Steps:**
- [ ] Implement stable behavior enums and normalization.
- [ ] Represent ACT vs SILENT explicitly.
- [ ] Carry human-readable `reasonToExist`.
- [ ] Keep Hamza-specific data out of this module.
- [ ] Make legacy paths represent missing behavior as `legacy/unknown` rather than inventing one.

**Acceptance criteria:**
- All major content paths can carry one normalized behavior decision.
- Social-only behavior is representable without using fake technical intent labels.

---

## Task 3: Make draft gates and quality purpose-aware

**Files:**
- Modify: `drafting.js`

**Interfaces:**
- Consumes: behavior decision + source/draft/recent-content context.
- Produces: purpose-aware hard gates and quality/readiness analysis.

**Steps:**
- [ ] Replace universal technical `additiveValue` assumptions.
- [ ] Preserve source/recent duplicate detection.
- [ ] Distinguish generic filler from explicit valid social purpose.
- [ ] Make reader-payoff checks purpose-aware.
- [ ] Make scoring purpose-aware or reduce universal scoring to genuinely universal dimensions.
- [ ] Add explicit/implicit biography provenance checks at the appropriate layer.
- [ ] Keep technical/evidence gates strict for consequential technical claims.

**Acceptance criteria:**
- `purpose=celebration` does not fail because it lacks evidence/action language.
- An unsupported technical correction still fails.
- A random praise reply cannot pass merely by self-labeling `relationship`.

---

## Task 4: Rewrite engagement and routing around purpose

**Files:**
- Modify: `engagement.js`
- Modify: `strategy.js`
- Modify: `pipeline.js`

**Interfaces:**
- Consumes: opportunity scores, relationship state, source context, behavior options.
- Produces: route + behavior decision or silence.

**Steps:**
- [ ] Separate purpose from technical contribution strength.
- [ ] Allow social/relationship actions when they have real contextual value.
- [ ] Preserve rejection of no-purpose activity.
- [ ] Make format decisions from purpose/source relationship rather than universal additivity.
- [ ] Preserve deterministic route/authority boundaries.

**Acceptance criteria:**
- High momentum alone is insufficient.
- Technical additivity alone is not required.
- The routing reason can explain social/growth/relationship value explicitly.

---

## Task 5: Align autonomous replies without broadening authority accidentally

**Files:**
- Modify: `autonomous_reply.js`

**Interfaces:**
- Consumes: behavior decision, grant, relationship/source context, Writer output.
- Produces: exact reply candidate under existing autonomous authority boundaries.

**Steps:**
- [ ] Replace/augment `replyStrategy.intent + tone` with behavior decision fields.
- [ ] Permit social acts to be complete acts.
- [ ] Keep stricter autonomous review fallback when risk/relationship evidence is insufficient.
- [ ] Preserve budget, health, duplicate, exact-claim, and transport protections.

**Acceptance criteria:**
- Autonomous limitations are described as automation-risk policy, not as the definition of valid human behavior.

---

## Task 6: Persist behavior provenance for future learning

**Files:**
- Modify: `store.js`
- Modify: `agent_bridge.js`
- Modify: `pipeline.js`
- Modify: `experiments.js`

**Interfaces:**
- Consumes: selected behavior decision and publication outcome.
- Produces: versioned behavior metadata linked to draft/queue/publication measurements.

**Steps:**
- [ ] Persist a versioned behavior snapshot.
- [ ] Preserve legacy rows.
- [ ] Carry behavior metadata through generation, approval, publication, and measurement.
- [ ] Expose enough fields for later cohort analysis.

**Acceptance criteria:**
- A later query can compare outcomes by purpose/mode/affect/depth/persona version.

---

## Task 7: Expand relationship intelligence for social behavior

**Files:**
- Modify: `store.js`
- Modify: `engagement.js`
- Modify: `experiments.js`
- Modify: `docs/RELATIONSHIP_INTELLIGENCE.md` if implementation reveals final schema changes.

**Interfaces:**
- Consumes: sent interaction + behavior metadata + target response events.
- Produces: relationship metrics across both technical and social interactions.

**Steps:**
- [ ] Add social reply archetypes.
- [ ] Keep primary purpose separate from archetype.
- [ ] Ensure response/continuation/recurrence can validate a social interaction.
- [ ] Avoid treating generic praise as relationship success absent outcome/context evidence.

**Acceptance criteria:**
- The system can learn whether humor/support/celebration creates real recurring relationships.

---

## Task 8: Run the Hamza modelling program

**Files:**
- Create: a dedicated versioned modelling artifact under `docs/research/` or another explicitly chosen model-source location.
- Modify: `docs/research/x_creator_phase2/HAMZA_X_PERSONA_EXPERIMENT.md` only to supersede candidate sections with evidence from actual modelling.

**Interfaces:**
- Consumes: owner forced choices, real technical history, reactions, rejected examples, social calibration.
- Produces: Hamza Model V1.

**Steps:**
- [ ] Run forced-choice calibration across technical and social X situations.
- [ ] Build technical first-person sandbox.
- [ ] Calibrate asymmetric beliefs/tastes.
- [ ] Calibrate humor/teasing/profanity/social boundaries.
- [ ] Calibrate known vs inferred vs strategic affect.
- [ ] Record negative examples and `never write this` patterns.
- [ ] Model language only after behavioral calibration.

**Acceptance criteria:**
- Model contains specific asymmetric Hamza preferences rather than universal developer virtues.
- Model can explain why Hamza chooses different actions in similar-looking threads.

---

## Task 9: Create the versioned persona runtime owner

**Files:**
- Create: `persona.js`
- Create or modify: one versioned persona-model source artifact chosen by Task 8.
- Modify: `store.js` only if active-model metadata needs persistence.

**Interfaces:**
- Consumes: Hamza Model V1.
- Produces: bounded persona slices and `personaModelVersion` for consumers.

**Steps:**
- [ ] Load one active model version.
- [ ] Expose behavior, provenance, affect, and language slices separately.
- [ ] Keep publication/route/source authority outside persona module.
- [ ] Preserve inspectability and rollback.

**Acceptance criteria:**
- Changing the persona version does not require editing multiple prompts.

---

## Task 10: Integrate persona upstream of writing

**Files:**
- Modify: `editorial.js`
- Modify: `engagement.js`
- Modify: `strategy.js`
- Modify: `pipeline.js`
- Modify: `autonomous_reply.js`
- Modify: `agent_bridge.js`
- Modify: `drafting.js`

**Interfaces:**
- Consumes: source/context, relationship state, growth objective, active persona.
- Produces: behavior decision before Writer generation.

**Steps:**
- [ ] Generate/select plausible behavior candidates using Hamza model.
- [ ] Apply growth/relationship objective to choose among plausible behaviors.
- [ ] Persist the selected decision.
- [ ] Pass the decision to Writer.
- [ ] Ensure Writer cannot silently rewrite the purpose/mode/affect/depth.

**Acceptance criteria:**
- The system can choose `joke`, `support`, `technical correction`, `hype`, or `silence` before wording begins.

---

## Task 11: Close the behavior-to-outcome learning loop

**Files:**
- Modify: `experiments.js`
- Modify: `store.js`
- Modify: analytics/result UI owners only after the domain query shape stabilizes.

**Interfaces:**
- Consumes: publication/reply outcomes + behavior/persona metadata.
- Produces: observational evidence about Hamza-specific behavior performance.

**Steps:**
- [ ] Add behavior dimensions to cohort analysis.
- [ ] Preserve matched observation windows and confounder visibility.
- [ ] Keep observations/candidate lessons separate from accepted learned rules.
- [ ] Do not automatically mutate persona beliefs from one result.

**Acceptance criteria:**
- The system can answer which Hamza behaviors correlate with discovery, profile conversion, and recurring relationships separately.

---

# 14. Migration and compatibility rules

The overhaul should not require rewriting all historical data.

Use compatibility semantics:

```text
historical behavior metadata absent -> legacy/unknown
old reply archetype -> preserve raw value and map to current taxonomy when unambiguous
old writing score -> historical metric, not recomputed silently
old strategy recommendation -> historical state, not rewritten by new persona
```

Do not backfill personality/purpose labels onto old posts by pretending the system knew the intent at publication time.

If historical classification is useful, store it explicitly as later analysis/inference rather than original decision provenance.

---

# 15. What should *not* happen during the overhaul

Do not:

- rewrite all creator research into the new philosophy;
- make Persona V2 permanent memory before modelling;
- replace the old robot with a rigid `purpose score` robot;
- require every action to hit a numeric threshold such as `7/10 humor`;
- create quotas for social vs technical modes;
- assign fixed percentages to emotions;
- infer that every high-view source deserves participation;
- infer that every low-view source is unimportant;
- use large-account size as a proxy for relationship value;
- let Writer invent factual owner history;
- let Persona own publication authority;
- let growth strategy override factual evidence;
- force a joke, caveat, question, hook, or emotional reaction into every post;
- turn the final model into `0.2 Theo + 0.15 Simon + ...`;
- optimize solely for raw follower count while ignoring the audience/relationship quality needed for future distribution and reputation.

---

# 16. Key risks

## Risk A — purpose labels become loopholes

The model could label generic engagement as `relationship` or `humor` to bypass quality gates.

Mitigation:

- require `reasonToExist`;
- use source/relationship context;
- preserve duplicate/filler detection;
- measure whether such actions actually produce response/continuity.

## Risk B — the persona becomes another giant prompt

Mitigation:

- one versioned model owner;
- consumers receive bounded slices;
- behavior selection occurs upstream;
- Writer receives selected behavior, not every modelling artifact.

## Risk C — strategic affect becomes repetitive fake hype

Mitigation:

- model affect range and context;
- track recent affect/archetype repetition;
- distinguish strategic affect from automatic enthusiasm;
- preserve silence and understatement.

## Risk D — social behavior weakens technical credibility

Mitigation:

- preserve claim-risk/evidence discipline;
- track technical and social outcomes separately;
- keep consequential specificity when needed;
- do not humanize technical posts by deleting important facts.

## Risk E — old docs silently reintroduce stale rules

Mitigation:

- explicit authority map;
- delete/retire competing strategy docs after salvage;
- make workflow docs reference owners rather than repeat doctrine.

## Risk F — code and docs diverge again

Mitigation:

- one shared behavior taxonomy in code;
- one canonical content contract;
- store behavior decision provenance;
- document each owner explicitly.

---

# 17. Rollout sequence

The required order is:

```text
WAVE 1 — Doctrine cleanup
canonical docs agree on purpose-based behavior

WAVE 2 — Runtime neutrality
code stops forcing technical-additivity behavior

WAVE 3 — Hamza modelling
learn the actual person through forced-choice calibration and provenance

WAVE 4 — Versioned persona runtime
one model owner with bounded consumers

WAVE 5 — Upstream integration
persona influences behavior selection before Writer

WAVE 6 — Live operation
publish/reply under the integrated model

WAVE 7 — Learning
compare purpose/mode/affect/depth outcomes and promote only repeated account-specific lessons
```

Do not begin Wave 3 as an implementation shortcut around unfinished Wave 1/2 contradictions.

---

# 18. Completion definition

The overhaul is complete when all of the following are true:

1. Canonical docs agree that every action needs purpose but not every action needs technical information.
2. `FIRST_1000_GROWTH_MODE.md` no longer governs behavior and has been retired after useful concepts are salvaged.
3. `ALGORITHM_EVIDENCE_LEDGER.md` no longer has accidental blanket strategy authority.
4. Draft gates can legitimately approve a purposeful social-only action while rejecting purposeless filler.
5. Relationship intelligence can measure social and technical interaction modes.
6. Editorial/engagement layers produce an inspectable behavior decision before final writing.
7. Writer realizes the selected behavior instead of inventing a technical wrinkle.
8. Factual and implied biography remain provenance-protected.
9. Strategic affect is allowed and inspectable.
10. Hamza Model V1 exists as a versioned, owner-approved model built from actual calibration rather than creator blending.
11. Publications/replies record the persona version and behavior decision used.
12. Outcome analysis can compare discovery, follows, profile conversion, and recurring relationships by behavior dimensions.
13. No one-post result silently rewrites permanent persona or growth doctrine.

---

# 19. Immediate next action

Start with **Wave 1 only**:

> Rewrite and reconcile the canonical X docs, retire competing authority, and produce a clean behavioral contract before changing executable code.

Once Wave 1 is frozen, perform a bounded source audit to map every current hardcoded assumption that conflicts with it. Then begin Wave 2 implementation.

The Hamza modelling phase begins only after the runtime is capable of representing the person we are trying to model.
