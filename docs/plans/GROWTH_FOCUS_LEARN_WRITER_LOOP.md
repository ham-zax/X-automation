# Growth Focus + H2 Learn + Evidence-Guided Writer Integration Plan

**Status:** Proposed custom integration front

**Date:** 2026-08-20

**Goal:** Make the product optimize for the operator's actual outcome — relevant engagement and follower growth — without turning a brittle keyword classifier into editorial authority. Adopt the H2 information model as the leading product hypothesis, move configuration out of the primary work navigation, make growth relevance explicit and editable, connect external/internal/test evidence to an optional per-draft writing strategy, and close the loop from recommendation -> generation -> publication -> measurement -> learning.

**Target product loop:**

> **Today -> Discover -> decide -> Posts/Conversations -> publish/send under human control -> Results -> Learn -> reuse learning deliberately.**

This plan is an integration plan across already-implemented Phase 1-6 capabilities and the Viral Styles subsystem. It does not replace those domain owners. It resolves the product gaps exposed by the current prototype and defines the new cross-system work needed to make the H2 experience coherent.

---

## 1. Why this front exists

The current repository has most of the ingredients for a growth operating system, but the operator-facing loop is not yet internally consistent.

The concrete failure that triggered this plan is useful because it exposes several independent problems at once:

- the GitHub candidate `santifer/career-ops` was persisted with `niche_score = 0`, no niche tags, and no matched keywords;
- running the current `classifyNiche()` implementation against the same stored description produces a strong match (`agents`, `devtools`, `jobs/career`) and a score of 46/50;
- `scoreDraft()` currently converts the persisted candidate niche score into up to 10 of the 50 draft-quality points, so stale or missing candidate classification directly lowers a number labeled **Draft quality**;
- `evaluateDraftGates()` hard-blocks approval below niche score 12 unless a reasoned adjacent-technical override exists;
- the backend has a `nicheOverride` input, but the current web/UI flow does not expose a practical control for supplying it;
- editing **Your niche** changes the active classifier but does not currently provide a clear candidate-rescore contract, so already-persisted candidates can remain stale;
- the live React navigation is still C0-like: `Today / Discover / Viral Styles / Conversations / Posts / Performance / Experiments / Diagnostics`, not H2;
- the Viral Styles subsystem can identify external hook/style/feature/intent associations, but there is no current `strategy_guidance.js`, no `writing_strategy_selections` persistence, and no Writer-packet strategy input;
- therefore research can say that a pattern appears promising, but the operator cannot ask Writer to use that pattern for this draft in a controlled, traceable way.

The problem is not simply a bad threshold. The product currently mixes four separate concepts:

1. **What topic/source is this about?**
2. **Is this strategically relevant to the audience and growth goal?**
3. **Is the writing itself good enough?**
4. **What evidence-backed presentation strategy should Writer use, if any?**

They need separate owners and separate UI semantics.

---

## 2. Relationship to existing plans

This plan consumes and coordinates, rather than re-implementing:

- `PHASE_1_WORKFLOW_FOUNDATION.md` — queue, routing, human selection, opportunity potentials;
- `PHASE_2_CONTENT_QUALITY.md` — Writer packet, writing gates, approval boundary;
- `PHASE_3_DISTRIBUTION_SCHEDULER.md` — publish timing and serialization;
- `PHASE_4_MEASUREMENT_EXPERIMENTS.md` — fixed-window measurements, follower deltas, attribution confidence, new-follower quality;
- `PHASE_5_LEARNED_STRATEGY.md` — evidence-backed learned rules and explicit human acceptance;
- `PHASE_6_AI_EDITORIAL_DIRECTOR.md` — objective-aware recommendation, evidence, ProfileProof, source linkage;
- `VIRAL_STYLE_RESEARCH.md` and `VIRAL_STYLE_RETROSPECTIVE_ANALYSIS.md` — external observational style/intent evidence;
- `VIRAL_STYLE_UI_RESEARCH_FLOW.md` — current operator research job;
- `UX_HCI_DEEP_RESEARCH_PROGRAM.md` plus `docs/ux/*` — H2 hypothesis, language semantics, Human-AI authority, usability research.

### Precedence

Where this plan overlaps the deep UX program:

- preserve its fixed Human-AI authority boundaries;
- preserve canonical writing-strategy semantics `off | suggest | apply`;
- preserve external/internal/test evidence provenance;
- preserve H2 as a hypothesis until participant evidence validates the final labels;
- **revise the implementation approach** so growth relevance is separated from writing quality and so the strategy layer supports both a deterministic evidence shortlist and an optional bounded AI recommendation over that shortlist.

This plan does **not** let AI accept learned rules, assign experiments, approve content, schedule, publish, or send.

---

## 3. Investigation findings

### 3.1 Candidate classification is source-inconsistent

Current source flow:

```text
source_refresh.js
  -> fetch source
  -> rankNews()/rankXViralPosts()
  -> personalizeCandidates()
  -> upsertCandidates()
  -> saveDiscoverSnapshot()
```

`rankNews()` currently classifies X posts with `classifyNiche(post.text)`, but GitHub and HN candidate construction does not attach the same `niche` object before persistence. `upsertCandidates()` persists missing niche data as score 0 / empty arrays.

This creates a false product state: a candidate can be strongly relevant according to the current classifier and still be stored and reviewed as 0-topic-fit.

### 3.2 Topic fit is incorrectly embedded in writing quality

Current `scoreDraft()` includes:

```text
Topic fit     up to 10
Opening       up to 8
Useful insight up to 10
Support       up to 10
Action        up to 7
Originality   up to 5
               -------
               50
```

The topic component is candidate/opportunity context, not writing quality. A perfectly written post should not become lower-quality merely because it is adjacent to the configured content focus.

The current coupling also means classification bugs can lower the approval score even when the generated writing is unchanged.

### 3.3 The current niche gate is stricter than the operator goal

Phase 2 currently requires either:

- candidate niche score >= 12; or
- explicit human adjacent-technical-topic override with a reason.

That was a defensible safety mechanism for preserving account positioning, but it should not be the primary optimization mechanism for a system whose actual goal is **qualified growth**.

An adjacent topic can be strategically valuable when it attracts the right people or creates a strong technical angle. Conversely, a core keyword match can still be a poor growth opportunity.

### 3.4 The product already has a better objective model

`editorial.js` already owns objective-aware deterministic weights. Current `qualified_growth` is:

```text
Reach          0.20
Follow         0.40
Conversation   0.10
Relationship   0.10
Authority      0.20
```

That model is closer to the actual product goal than a binary niche threshold. The UI already exposes an objective selector on Today, but the selection is local UI state and the product does not yet present it as a persistent **growth focus** that controls the wider experience.

### 3.5 The measurement layer already supports the core feedback signal

Phase 4 already records:

- fixed 15m / 1h / 6h / 24h publication measurements;
- views, likes, reposts, replies;
- follower delta;
- associated follows per 1,000 views;
- attribution confidence;
- newly observed follower quality / niche alignment;
- experiment cohorts.

That means the product can already distinguish raw reach from associated follower movement and relevant-audience quality. The new strategy loop should reuse these facts rather than invent a new success score.

### 3.6 External research is richer than current Writer input

Viral Styles already records or derives:

- hook/features such as urgency or release language;
- deterministic presentation style features;
- semantic communicative intent;
- semantic presentation style;
- views/follower and engagement/view normalization;
- same-author comparison when available;
- matched-cohort percentile evidence;
- sample sizes and intervals;
- evidence classes such as directional and repeated association;
- per-post examples and provenance.

But the current Writer packet has no writing-strategy field, and the current draft UI has no evidence-backed/manual writing-strategy selector.

### 3.7 H2 is not implemented in the live shell

The current React primary navigation still exposes implementation mechanisms as peer destinations:

```text
Today
Discover
Viral Styles
Conversations
Posts
Performance
Experiments
Diagnostics
```

The target hypothesis is:

```text
Today
Discover
Conversations
Posts
Results
Learn

Settings / Advanced  <-- utility, not primary work destination
```

### 3.8 Current external API research supports richer owned-content measurement where available

Current X documentation describes public post metrics including impressions, likes, reposts, replies, quotes, and bookmarks. It also describes user public metrics including follower counts. For authenticated owned content, non-public metrics can include profile clicks and URL clicks, subject to access/authentication/time-window constraints.

This does **not** imply that all of those fields are available through the repository's installed adapter today. The implementation should capability-probe them and add only metrics that the actual authenticated path can observe reliably.

External references:

- X API Metrics: https://docs.x.com/x-api/fundamentals/metrics
- X API Data Dictionary: https://docs.x.com/x-api/fundamentals/data-dictionary

Multi-objective recommendation literature also supports the general product principle that short-term interaction signals should not be treated as the sole objective when longer-term value signals exist. This is a design principle only; it is **not** evidence about X's ranking algorithm.

- Zhang et al., *Multi-Task Fusion via Reinforcement Learning for Long-Term User Satisfaction in Recommender Systems*: https://arxiv.org/abs/2208.04560

---

# 4. Product decisions for this front

## Decision 1 — H2 is the implementation target, with label validation still required

Proceed toward:

**Today · Discover · Conversations · Posts · Results · Learn**

Treat `Learn` as the leading label, not an already-proven label. The participant research gate remains real: if users repeatedly interpret Learn as tutorials/help/onboarding, rename the destination without changing its information model.

## Decision 2 — Settings / Advanced is a utility

AI provider/model, growth-focus configuration, research internals, raw diagnostics, runtime detail, and account/system configuration must not be equal-weight daily navigation destinations.

They remain globally discoverable through a settings/utility entry and through contextual links where the setting matters.

## Decision 3 — Replace “niche as veto” with “Growth Focus + strategic relevance”

The operator needs to express:

- what outcome matters most;
- who they want to attract;
- what they want to be known for;
- which topics are core;
- which adjacent technical opportunities are acceptable;
- which topics should normally be ignored/excluded.

The product should present this as **Growth focus** or **Audience & topics** rather than implying a single immutable niche.

Exact final wording remains a usability-language question.

## Decision 4 — Topic/growth fit is not writing quality

The draft-quality score must evaluate the draft itself. Candidate relevance must be displayed separately.

The draft screen should therefore distinguish:

- **Growth fit** — Core / Adjacent / Outside current focus / Unknown;
- **Writing quality** — opening, insight, support, action/usefulness, originality, etc.;
- **Approval readiness** — deterministic facts/evidence/safety/length/etc. gates;
- **Writing approach** — optional intent/style/hook guidance used for generation.

## Decision 5 — Adjacent opportunities are allowed under explicit human control

A candidate that is technically adjacent should not be rejected merely because deterministic topic score is below 12.

Target semantics:

- **Core** — normal path;
- **Adjacent** — system explains why it may fit; human may pursue it without pretending it is core;
- **Outside current focus** — approval requires an explicit human “use anyway” decision with a reason;
- **Unknown/stale** — refresh classification before making a gate decision.

AI may recommend that a topic is strategically adjacent, but AI cannot silently create the human override.

## Decision 6 — `qualified_growth` remains the default objective

Do not replace the existing transparent objective machinery with an opaque “maximize engagement” score.

Default user-facing purpose:

> **Grow relevant followers**

Maps to `qualified_growth`.

Keep alternative existing objectives available:

- Maximize reach -> `reach_momentum`;
- Build technical authority -> `technical_authority`;
- Build relationships/opportunities -> `relationships`;
- Balanced -> `balanced`.

Persist the operator's default instead of resetting the mental model every time Today reloads.

## Decision 7 — Learn owns evidence/interpretation; Posts owns per-draft application

**Learn answers:** what appears to work, what works for us, what tests show, and what strategy may be worth trying.

**Posts/Draft answers:** should this evidence influence this generation?

The operator should not have to leave a draft and navigate to Learn just to apply a strategy.

## Decision 8 — Strategy recommendation supports AI-assisted and manual choice

The system should support both:

1. **Recommended approach** — evidence-backed candidate strategies are shortlisted deterministically; an optional bounded AI pass selects/explains the best fit for the current objective/pipeline/candidate using only those supplied options and evidence references.
2. **Choose manually** — the human can choose intent, style, and supported opening/feature guidance directly.

Manual selection is not automatically evidence-backed. If the human chooses a tactic without supporting evidence, label it as a manual choice rather than fabricating rationale.

## Decision 9 — Strategy application remains one-generation guidance

Canonical semantics remain:

- `off` — guidance does not influence Writer;
- `suggest` — guidance visible, Writer unchanged;
- `apply` — selected guidance influences this generation only.

No mode approves, schedules, publishes, sends, assigns an experiment, or accepts a learned rule.

## Decision 10 — Results reports outcomes; Learn interprets patterns

**Results = what happened.**

**Learn = what the accumulated evidence suggests.**

Cross-links are allowed. Semantic ownership must remain separate.

---

# 5. Target H2 information architecture

| Destination | Primary question | Owns | Must not become |
|---|---|---|---|
| **Today** | What deserves my decision now? | obligations, blockers, current editorial opportunities, unresolved states | an analytics archive |
| **Discover** | What external signals/opportunities are worth considering? | X/GitHub/HN source intake, candidate triage, source momentum | the long-term strategy center |
| **Conversations** | Who should I respond to or continue with? | active/new conversation work and reply state | general social analytics |
| **Posts** | What am I creating, approving, and publishing? | drafts, writing strategy at point of use, approval, timing, lifecycle | evidence research repository |
| **Results** | What happened? | reach, follower movement, audience quality, content/conversation outcomes, later business outcomes | a catch-all settings/learning page |
| **Learn** | What does the evidence suggest we should do differently? | external patterns, own-account patterns, tests, strategy recommendations | tutorials/help or one opaque AI score |
| **Settings / Advanced** | How is the system configured/diagnosed? | Growth Focus, AI, research defaults, diagnostics, runtime detail | a primary daily job destination |

## Proposed Learn structure

```text
Learn
├── Current patterns        [external observational evidence]
│   ├── Intent
│   ├── Presentation style
│   ├── Openings / features
│   └── Examples + evidence strength
├── What works for you      [own-account observational outcomes]
├── Tests                   [explicit comparisons]
└── Strategy recommendations
    ├── recommended approaches
    ├── agreement/disagreement across evidence sources
    └── limitations
```

`Current patterns` is a placeholder working label. The existing research package should test whether `Current winning styles`, `Patterns`, `What is working now`, or another label better preserves observational uncertainty.

## Proposed Settings structure

```text
Settings
├── Growth focus
│   ├── Default goal
│   ├── Core topics
│   ├── Adjacent topics
│   ├── Target audience
│   └── deprioritized / excluded signals
├── AI
│   ├── providers
│   ├── models
│   └── role assignments
├── Research defaults
└── Advanced
    ├── raw diagnostics
    ├── runtime details
    ├── exact research controls
    └── raw evidence / health detail
```

Contextual links should exist from the relevant work surface, for example:

- `Growth fit: Adjacent · Review growth focus`;
- `Using Writer profile: Luna Max · Change`;
- `Research depth: Standard · Advanced setup`.

---

# 6. Growth Focus domain contract

## 6.1 Preserve classifier taxonomy; add operator policy around it

The current `NICHE_GROUPS` / `AUDIENCE_NICHE_GROUPS` taxonomy remains the base classification vocabulary for the first version. Do not create a second incompatible topic taxonomy.

Evolve the saved profile from a terms-only “niche” configuration toward a versioned Growth Focus profile.

Proposed logical shape:

```ts
interface GrowthFocusProfileV2 {
  revision: number
  defaultObjective: 'qualified_growth' | 'reach_momentum' | 'relationships' | 'technical_authority' | 'balanced'
  contentGroups: Array<{
    tag: string
    label: string
    role: 'core' | 'adjacent' | 'off'
    requiresTechnicalContext?: boolean
    terms: string[]
  }>
  audienceGroups: Array<{
    tag: string
    label: string
    terms: string[]
  }>
  deprioritizedTerms: string[]
  exclusionTerms: string[]
}
```

The first migration may keep the existing `niche_profile:v1` storage key for compatibility and add `growth_focus:v2` only when role/objective fields are introduced. Do not destroy the old profile before migration is verified.

## 6.2 Candidate classification must be source-agnostic

Create one normalization path used by X, GitHub, HN, manual ingest, and editorial-created candidates.

Proposed interface:

```js
classifyCandidateForGrowth(candidate, profile) -> {
  ...candidate,
  niche: {
    score,
    tags,
    matches,
    profileRevision,
    classifierVersion,
    classifiedAt,
  }
}
```

Classification text should be source-aware but deterministic:

- X: post text;
- GitHub: repository name + description;
- HN: title + available story text/domain context when present;
- manual source: supplied title + text;
- editorial synthetic candidate: recommendation thesis + linked source classification, without pretending the synthetic text alone is source truth.

Every source path must produce a populated classification object before candidate persistence.

## 6.3 Version persisted classification

Add candidate classification provenance sufficient to detect stale data:

```text
niche_profile_revision
niche_classifier_version
niche_classified_at
```

Exact schema may be columns or a small JSON metadata field; prefer explicit columns if they are queried for stale-row backfill.

When Growth Focus changes:

1. increment profile revision;
2. reclassify stored candidate rows using current source text/title;
3. invalidate candidate/source/detail queries;
4. do not alter historical publication-time provenance;
5. do not rewrite the external Viral research dataset, whose niche/sample provenance belongs to the research run that produced it.

## 6.4 Strategic relevance is separate from topic classification

Introduce an explicit evaluation object:

```ts
interface StrategicRelevance {
  state: 'core' | 'adjacent' | 'outside' | 'unknown'
  topicScore: number
  tags: string[]
  objective: string
  reasonCodes: string[]
  explanation: string
  profileRevision: number
  humanOverride?: {
    accepted: boolean
    reason: string
    actor: 'human'
    at: number
  }
}
```

The deterministic baseline should consider:

- current Growth Focus group roles;
- technical-context requirements;
- objective-relevant Reach/Follow/Conversation/Relationship/Authority inputs;
- source/candidate semantics;
- explicit exclusion terms.

AI may add an advisory explanation or recommend `adjacent`, but the persisted human override remains separate.

## 6.5 Do not make relevance one hidden scalar

The UI should prefer a comprehensible state and explanation over another unexplained 0-100 score.

Example:

> **Adjacent growth opportunity**
> Career/job-search topic, but strongly connected to AI coding agents and developer CLI workflows. Likely relevant to the target developer audience.

That is more useful than `Topic fit 0/10`.

---

# 7. Draft quality and approval redesign

## 7.1 Separate four layers

The Draft surface should render four independent concepts:

### A. Growth fit

Candidate/opportunity context:

```text
Core
Adjacent
Outside current focus
Unknown / needs refresh
```

### B. Writing quality

Only properties of the actual generated text:

- Opening;
- Useful insight;
- Support/evidence expression;
- Action/takeaway;
- Originality;
- any future calibrated writing-only dimension.

### C. Approval readiness

Hard deterministic checks such as:

- factuality confirmation;
- evidence confirmation/scope;
- duplicate/source similarity;
- length;
- placeholders;
- media readiness;
- CTA integrity;
- explicit outside-focus override when required.

### D. Writing approach

Optional evidence-backed/manual strategy used for generation.

## 7.2 Remove candidate topic fit from the number labeled Draft quality

`scoreDraft()` should no longer derive writing score from `candidate.niche.score`.

Preserve a 50-point writing-quality scale if possible to avoid unnecessary product/schema churn, but recalibrate it using only writing dimensions. Do not simply add 10 arbitrary points elsewhere.

Implementation task:

1. score a representative corpus of existing drafts with the current five writing-only components;
2. define a transparent normalization/reweighting to 50;
3. preserve the existing `>= 40` approval threshold only if the migrated distribution still represents the intended quality boundary;
4. if it does not, update threshold and UI together with explicit migration notes.

The approval hard gates continue to dominate the numeric score.

## 7.3 Replace the current invisible adjacent override with a real user decision

For `adjacent`:

- show the reason;
- do not block drafting;
- allow normal approval when deterministic Growth Focus policy says adjacent topics are permitted;
- if the profile is configured as strict, require an explicit human decision.

For `outside`:

- show `Outside current growth focus`;
- offer `Use this opportunity anyway`;
- require a short reason;
- persist that human decision on the work item/draft provenance;
- never let AI press that control.

The error message must not claim “no override was supplied” when the product exposes no way to supply one.

---

# 8. Writing-strategy evidence model

## 8.1 Evidence lanes remain separate

A strategy recommendation may read:

### External evidence

What patterns appear associated with stronger performance in comparable outside posts.

### Own-account evidence

What has happened repeatedly when this account used the same intent/style/feature.

### Test evidence

What happened in explicit declared comparisons.

### Learned-rule context

Accepted/suggested learned rules may constrain or contextualize the recommendation, but they remain their existing domain objects.

No UI or backend field may collapse those into an unexplained “AI score.”

## 8.2 Canonical strategy dimensions

The first writing-strategy contract should support at least:

- **communicative intent** — existing `viral_style_intent.js` taxonomy;
- **semantic presentation style** — existing bounded style taxonomy;
- **opening/hook/features** — deterministic supported features from Viral analysis, such as urgency/release language, only when the evidence object identifies them as supported.

Do not confuse content type (`Original`, `Thread`, `Quote`, `Reply`) with presentation style.

## 8.3 Evidence shortlist first, AI recommendation second

Create a deterministic owner that filters/ranks evidence-backed choices before any AI call.

Proposed interfaces:

```js
buildWritingStrategyEvidence({
  objective,
  pipeline,
  candidate,
  editorialRecommendation,
  externalPatterns,
  internalOutcomes,
  experiments,
  learnedRules,
})

buildWritingStrategyShortlist(evidence) -> StrategyOption[]
```

A `StrategyOption` should carry:

```ts
interface StrategyOption {
  intent: string | null
  style: string | null
  openingFeatures: string[]
  applicability: 'strong_fit' | 'possible_fit' | 'weak_fit'
  externalEvidence: StrategyEvidenceRef[]
  internalEvidence: StrategyEvidenceRef[]
  experimentEvidence: StrategyEvidenceRef[]
  limitations: string[]
}
```

Then optionally call the configured structured AI runtime with a bounded schema:

```js
recommendWritingStrategy({
  objective,
  pipeline,
  candidateSummary,
  shortlist,
}) -> {
  optionIndex,
  rationale,
  limitations,
}
```

The model must:

- choose only from supplied options;
- reference supplied evidence IDs;
- not invent success probabilities;
- not infer hidden X ranking mechanisms;
- not copy example tweet wording;
- not turn directional evidence into certainty;
- return `no_recommendation` when no option fits.

This AI step is advisory. If unavailable or invalid, the deterministic shortlist still works and the user can choose manually.

## 8.4 Manual strategy selection

The draft should expose **Choose another approach**.

The operator can select:

- intent;
- presentation style;
- optional opening/feature guidance.

If the selected combination is not supported by current evidence, display:

> **Manual choice — no evidence-backed recommendation attached.**

Do not prevent the choice unless it violates a true content/safety/pipeline constraint.

---

# 9. Persistence and provenance

## 9.1 Add content-style labels for owned published work

Implement the already-planned `content_style_labels` table so internal outcomes use the same canonical taxonomy as external research.

Minimum fields:

```text
id
queue_item_id
content_hash
taxonomy_version
primary_intent
semantic_style
audience_goal
reader_action
confidence
evidence_spans_json
ai_execution_json
classified_at
```

Classification of historical owned posts remains explicit/operator-triggered when it consumes AI tokens.

## 9.2 Add append-only strategy selections

Implement `writing_strategy_selections`:

```text
id
queue_item_id
draft_id nullable
mode                    off | suggest | apply
intent nullable
style nullable
opening_features_json
guidance_json
selection_source        recommended | manual
selected_by             human
selected_at
```

`guidance_json` stores the exact recommendation/evidence snapshot visible when the human selected it.

Never mutate old rows to make history match a later recommendation.

## 9.3 Persist strategy actually used by a generation

The resulting draft must record:

```text
strategy_selection_id
strategy_mode
strategy_applied boolean
strategy_snapshot
writer_ai_execution
```

A later regeneration can use the same selection only if the human has not changed/removed it.

## 9.4 Publication provenance

At publication, persist distinctly:

- strategy recommended at the time;
- strategy selected by the human;
- strategy actually applied to the published generation;
- editorial objective;
- pipeline;
- Growth Focus/profile revision;
- measurement/attribution metadata.

This enables later observational comparison without rewriting history.

---

# 10. Writer integration

## 10.1 Extend the Writer packet only in Apply mode

Target packet section:

```js
writingStrategy: {
  selectionId,
  objective,
  intent,
  style,
  openingFeatures,
  rationale,
  externalEvidence,
  internalEvidence,
  experimentEvidence,
  limitations,
}
```

Rules:

- `off`: omit the section;
- `suggest`: show it in UI, but do not pass it as Writer instruction;
- `apply`: pass the selected strategy as bounded presentation guidance.

## 10.2 Strategy never outranks source truth

Writer instruction priority remains:

```text
facts / verified evidence
  > content type / pipeline contract
  > hard constraints and gates
  > human edits / explicit decisions
  > selected writing strategy
  > stylistic preference
```

Examples:

- urgency guidance cannot invent a deadline;
- release framing cannot claim a release that did not occur;
- benchmark style cannot invent measurements;
- provocative opinion cannot fabricate controversy;
- “report experiment” cannot imply the operator ran an experiment unless first-party evidence exists.

## 10.3 Pipeline-aware realization

The same strategy should be adapted by pipeline:

- **Original:** may shape opening, structure, intent, pacing;
- **Thread:** may shape Post 1 framing and subsequent structure while keeping each part independently useful;
- **Quote:** must add distinct commentary rather than mimic the source;
- **Reply:** must remain context-specific and useful to the actual conversation;
- **Repost:** strategy is not applicable because there is no authored body.

---

# 11. Draft UI target

Immediately before Generate/Regenerate, show a compact **Writing approach** control.

Example structure:

```text
Writing approach

Recommended for: Grow relevant followers
Intent: Share observation
Style: Short observation / field note
Opening: Urgency framing

Why this may fit
- external evidence: repeated association in comparable posts
- own-account evidence: insufficient
- test evidence: none

Limitations
- observational association, not causal proof

( ) No influence
(*) Advice only
( ) Use for this draft

[Choose another approach]
```

`Advice only` remains the current default semantic until participant research supports a different default.

After generation, show provenance:

```text
This generation used:
Share observation · Short observation · Urgency framing
[View evidence] [Change approach] [Remove influence]
```

If `suggest` was active:

```text
Advice was visible, but it did not influence this generation.
```

---

# 12. Learn UX target

## 12.1 Current patterns / external

Default presentation order:

1. plain-language pattern;
2. communicative intent and style;
3. applicability / where it may fit;
4. evidence strength;
5. sample size / authors / time window;
6. normalized outcome measures;
7. limitations;
8. examples;
9. raw statistics/provenance on demand.

Do not lead ordinary users with same-author control counts or runtime/model configuration.

## 12.2 What works for you

Show only observed own-account evidence:

- outcomes by intent/style/opening feature when sample exists;
- associated follows per 1,000 views;
- relevant new-follower share;
- reach/engagement measures;
- attribution caveats;
- disagreements with external evidence.

## 12.3 Tests

Move the current experiment/learned-rule mechanism under Learn without changing its explicit assignment/acceptance authority.

## 12.4 Strategy recommendations

Show candidate reusable strategies with evidence separated by source.

Provide a path to a target draft, but do not make Learn itself an approval/publish surface.

---

# 13. Results UX target

Results answers **what happened**, not “what should I do because of it?”

Keep or add:

- reach/impressions/views;
- likes/replies/reposts;
- follower delta with attribution confidence;
- associated follows per 1,000 views;
- new-follower relevance/alignment;
- conversation/relationship outcomes;
- objective grouping;
- strategy provenance when available;
- bookmarks/saves when reliably observable;
- capability-probed owned-content profile clicks / URL clicks when the installed authenticated X path actually exposes them.

Do not claim that one post caused the full account-level follower delta unless the evidence design supports that claim.

Results can link to Learn with prompts such as:

> `See what patterns are emerging`

Learn can link back to the exact measured posts supporting a pattern.

---

# 14. Implementation waves

## Wave 0 — Preserve research decisions and establish baseline

**Purpose:** Separate work that can begin immediately from work whose final labels/navigation depend on participant evidence.

### Tasks

- Record H2 as the target implementation hypothesis, not a validated label set.
- Freeze authority semantics from `PRODUCT_LANGUAGE.md` / `HUMAN_AI_INTERACTION.md`.
- Capture current candidate/draft fixtures including the Career Ops failure.
- Capture current navigation and key screenshot states for regression comparison.
- Record current stored candidate counts and candidate classification distribution.

### Can start before participant sessions

- candidate classification correctness;
- classification versioning/backfill;
- Growth Focus backend model;
- writing-quality/relevance separation;
- strategy persistence/domain work;
- evidence shortlist logic.

### Wait for or remain changeable after participant sessions

- final `Learn` display label;
- final child labels;
- final `off|suggest|apply` display words;
- final research-depth labels;
- compact/mobile navigation details.

---

## Wave 1 — Candidate relevance correctness

**Primary files:**

- `strategy.js`
- `tech_news.js`
- `source_refresh.js`
- `store.js`
- `web_api.js`
- `agent_bridge.js`
- `ui/src/api/client.ts`
- `ui/src/features/discover/Discover.tsx`

### Tasks

1. Add one source-agnostic candidate classification helper.
2. Ensure X/GitHub/HN/manual/editorial candidate paths populate classification before persistence.
3. Add classification revision/version provenance.
4. Add stored-candidate reclassification when Growth Focus revision changes.
5. Add a bridge/API action for explicit rescore/backfill and diagnostics.
6. Ensure Discover/detail returns current classification rather than stale zeros.
7. Add a visible stale/error state rather than silently treating unknown as 0.
8. Verify the Career Ops fixture no longer persists as zero under the current default profile.

### Acceptance criteria

- the same candidate text produces the same topic classification regardless of source ingestion path;
- changing Growth Focus reclassifies stored candidates deterministically;
- a missing classifier run is never displayed as `Topic fit 0`;
- source-native momentum ordering can remain visible without bypassing the canonical candidate classification.

---

## Wave 2 — Growth Focus + relevance/quality separation

**Primary files:**

- `strategy.js`
- `drafting.js`
- `store.js`
- `web_api.js`
- `ui/src/features/settings/NicheSettings.tsx` (rename/rework surface)
- `ui/src/features/create/DraftEditor.tsx`
- `ui/src/features/create/DraftPage.tsx`
- `ui/src/features/discover/Discover.tsx`
- `ui/src/api/client.ts`

### Tasks

1. Add persistent default objective to Growth Focus.
2. Add core/adjacent/off group policy or equivalent explicit relevance policy.
3. Add `assessStrategicRelevance()`.
4. Persist explicit human outside-focus override decisions.
5. Remove topic fit from writing-quality scoring.
6. Calibrate the writing-only 50-point score and approval threshold on current drafts.
7. Split Draft UI into Growth fit / Writing quality / Approval readiness / Writing approach.
8. Add `Review growth focus` contextual navigation.
9. Replace impossible override error copy with an actionable control/state.

### Acceptance criteria

- a classification/relevance defect cannot lower a number labeled Writing quality;
- an adjacent technical opportunity can be pursued with clear semantics;
- a clearly outside-focus opportunity requires an explicit human decision rather than an AI-only bypass;
- the default objective persists and is visible wherever objective fit is used.

---

## Wave 3 — H2 shell and Learn consolidation

**Primary files:**

- `ui/src/App.tsx`
- create `ui/src/features/learn/Learn.tsx`
- `ui/src/features/viral/ViralStyles.tsx`
- `ui/src/features/improve/Improve.tsx`
- `ui/src/features/results/Results.tsx`
- `ui/src/features/advanced/Advanced.tsx`
- settings components
- `ui/src/api/client.ts`

### Tasks

1. Change primary shell toward H2:
   - Today;
   - Discover;
   - Conversations;
   - Posts;
   - Results;
   - Learn.
2. Rename `Performance` presentation to `Results` while preserving routes/API owners.
3. Move Viral research under Learn external/current-pattern section.
4. Move experiments/learned evidence under Learn Tests / What works for you.
5. Remove Diagnostics from primary work navigation.
6. Add global Settings/utility access.
7. Preserve old hash routes as aliases/redirects for bookmarks and internal links:
   - `#/viral` -> Learn external;
   - `#/improve` -> Learn tests/learning;
   - `#/advanced/niche` -> Settings Growth focus;
   - `#/advanced/ai` -> Settings AI;
   - `#/advanced` -> Settings Advanced.
8. Keep route semantics stable enough that existing API/state ownership does not move merely because the information architecture changes.

### Acceptance criteria

- all current capabilities remain reachable;
- ordinary daily work does not require entering Settings/Advanced;
- Results and Learn have distinct semantic jobs;
- external, own-account, and test evidence remain visibly separate;
- old deep links do not silently fall back to Today.

---

## Wave 4 — Strategy evidence backbone

**Primary files:**

- create `strategy_guidance.js`
- `viral_style_analyze.js`
- `viral_style_intent.js`
- `store.js`
- `experiments.js`
- `learning.js` read-only consumption only
- `web_api.js`
- `agent_bridge.js`
- `ui/src/api/client.ts`
- Learn UI

### Tasks

1. Normalize external evidence into reusable StrategyEvidenceRef objects.
2. Add internal content classification table/cache.
3. Add explicit classify-published action for historical owned posts.
4. Build own-account strategy outcome summaries only from real measurements.
5. Build deterministic strategy shortlists from external/internal/test/learned context.
6. Expose strategy guidance API/bridge read.
7. Add append-only selection persistence.
8. Preserve evidence source and limitations per option.

### Acceptance criteria

- the system can answer “what evidence supports this suggested approach?” with exact references;
- no unsupported evidence class creates a recommendation;
- external evidence alone cannot become an accepted learned rule;
- strategy recommendation remains usable when AI runtime is unavailable.

---

## Wave 5 — Bounded AI recommendation + manual choice + Writer application

**Primary files:**

- `strategy_guidance.js`
- `ai_runtime.js` / existing structured runtime boundary only as needed, no provider bypass
- `web_api.js`
- `drafting.js`
- `writer_runtime.js` only if output provenance requires it
- `docs/POST_GENERATION_PROMPT.md`
- `ui/src/features/create/DraftEditor.tsx`
- `ui/src/features/create/DraftPage.tsx`
- `ui/src/api/client.ts`

### Tasks

1. Add optional structured AI selection/explanation over the deterministic shortlist.
2. Add Draft **Writing approach** panel.
3. Add No influence / Advice only / Use for this draft behavior.
4. Add manual intent/style/opening-feature choice.
5. Add explicit generation/regeneration provenance.
6. Pass strategy to Writer only in `apply` mode.
7. Make regeneration preserve the current human strategy selection until changed.
8. Add safe fallback when recommendation AI fails.

### Acceptance criteria

- a human can deliberately generate the same candidate with guidance off, visible-only, or applied;
- the UI clearly states whether guidance affected the text;
- a manual choice is possible without fabricating evidence;
- urgency/release/benchmark/etc. guidance cannot invent unsupported facts;
- strategy selection has no approval/publication authority.

---

## Wave 6 — Strategy outcome feedback loop

**Primary files:**

- `store.js`
- measurement/experiment integration in current owners
- `web_api.js`
- `ui/src/features/results/Results.tsx`
- `ui/src/features/learn/Learn.tsx`
- `ui/src/api/client.ts`

### Tasks

1. Copy publication-time strategy provenance into measurement metadata.
2. Add observational cohorts by intent/style/opening feature when sample size exists.
3. Report associated follower conversion, relevant-follower quality, reach, and engagement separately.
4. Show external-vs-own-account agreement/disagreement in Learn.
5. Capability-probe bookmarks/profile clicks/URL clicks for owned-content measurement and add them only when current adapter/auth can support them reliably.
6. Never generate fake effectiveness percentages for zero/small samples.
7. Add review signals when new own-account evidence conflicts with a previously recommended external pattern.

### Acceptance criteria

- the product can answer “we used this approach on these posts; here is what happened” without claiming causation;
- relevant follower growth remains distinct from raw reach;
- the next strategy recommendation can use prior measured outcomes with visible provenance;
- changing a later strategy does not rewrite historical publication attribution.

---

## Wave 7 — Human validation and rollout gate

Use `docs/ux/USABILITY_GUIDE.md` and the existing 9-participant first-round design.

### Required validation questions for this front

1. Does H2 remain predictable when Viral Styles and Experiments are no longer primary destinations?
2. Does `Learn` mean evidence/adaptation rather than tutorials/help?
3. Can users distinguish Discover external signals from Learn external patterns?
4. Can users distinguish Results outcomes from Learn interpretation?
5. Does Growth Focus communicate audience/topic strategy better than `Your niche`?
6. Can users understand Core vs Adjacent vs Outside without reading a scoring formula?
7. Can users predict what **Use for this draft** changes?
8. Do they understand that Advice only has zero Writer effect?
9. Can they manually choose intent/style without mistaking that choice for approval or permanent AI configuration?
10. Do they know where to change AI provider/model and Growth Focus after Settings leaves primary navigation?

### Rollout rule

Backend correctness and provenance work do not wait on label research. Final navigation/label lock does.

---

# 15. API / bridge sketch

Names are proposed; reuse existing API style.

## Growth Focus

```text
GET  /api/growth-focus
POST /api/growth-focus
POST /api/growth-focus/reset
POST /api/growth-focus/rescore-candidates
```

Compatibility may temporarily keep `/api/niche` as an alias.

## Relevance override

```text
POST /api/work/relevance-decision
{
  queueItemId,
  decision: "use_anyway" | "clear_override",
  reason
}
```

## Writing strategy

```text
GET  /api/writing-strategy?queueItemId=<id>&draftId=<optional>
POST /api/writing-strategy/recommend
POST /api/writing-strategy/select
POST /api/learn/classify-published
```

`recommend` may spend AI tokens only after explicit operator action or when the product's configured policy explicitly permits recommendation generation as part of draft preparation. It must not silently spend tokens on passive page load.

Bridge commands should mirror the same domain owners and persistence semantics.

---

# 16. Data migration

## Candidate classification

- add classification provenance;
- backfill all persisted candidates from stored title/text using the active Growth Focus profile;
- verify before/after counts for zero-score candidates;
- do not rewrite source observation history;
- do not rewrite Viral research run data.

## Growth Focus

- migrate current `niche_profile:v1` terms losslessly;
- initial default objective = `qualified_growth`;
- derive default core/adjacent roles from current product strategy and document them;
- preserve reset-to-default behavior with explicit confirmation/undo consideration from UX review.

## Draft score

- do not mutate historical published quality scores merely because the new scorer changes;
- new or regenerated drafts use the new writing-only scoring contract;
- historical records should show the scorer/version if scores are compared across migrations.

## Strategy

- strategy tables begin empty;
- historical content style classification is explicit/bounded;
- historical publications have `strategy_applied = unknown/not_recorded`, not guessed from prose.

---

# 17. Observability and debugging

Add inspectable technical detail for advanced users without exposing it by default.

For a candidate, Advanced detail should be able to show:

```text
classification profile revision
classifier version
classification timestamp
source text used
matched terms/tags
strategic relevance state/reason codes
human override provenance
objective and opportunity potential inputs
```

For a strategy recommendation:

```text
external/internal/test evidence refs
shortlist construction
AI selection provenance if used
selected mode
human selection timestamp
strategy actually applied to generation
Writer model/runtime execution
```

For measurement:

```text
publication-time strategy snapshot
measurement windows
attribution confidence
new-follower observation coverage
capability availability for extra metrics
```

This should make false states such as “persisted niche 0 although classifier currently returns 46” diagnosable without reading SQLite manually.

---

# 18. Safety and authority invariants

Non-negotiable:

1. AI recommendation never equals human selection.
2. Writing strategy never equals content approval.
3. Content approval never secretly equals publication unless the control explicitly names both actions.
4. External Viral evidence is observational and cannot silently become production authority.
5. Strategy selection cannot accept a learned rule.
6. Strategy selection cannot assign an experiment.
7. Growth Focus changes future/current classification; it does not rewrite historical publication facts.
8. A high-engagement external pattern is not proof it will work for this account.
9. Relevant follower growth is not equivalent to raw follower count.
10. Follower deltas remain associated with measurement windows unless attribution evidence justifies a stronger statement.
11. AI cannot fabricate an adjacency override on behalf of the human.
12. Manual strategy choice may be allowed without evidence, but the product must not present it as evidence-backed.

---

# 19. End-to-end acceptance scenarios

## Scenario A — Career Ops regression

Given the current Career Ops description containing Claude Code/Codex/OpenCode/CLI/job-search signals:

- source ingestion classifies it consistently;
- persisted candidate classification is not zero;
- Growth fit explains the relevant agent/devtool/career relationship;
- Draft writing quality does not include the topic-fit component;
- no impossible “missing adjacent override” blocker appears.

## Scenario B — high-momentum but truly unrelated topic

Given a highly viral unrelated candidate:

- Discover may expose it only according to configured discovery policy;
- Growth fit shows Outside current focus;
- high reach does not masquerade as relevant-follower potential;
- human can explicitly use it anyway if they choose;
- the override is visible in provenance.

## Scenario C — external evidence recommends urgency

Given a supported external urgency-language association and a candidate for which urgency can be expressed truthfully:

- Learn shows evidence strength/sample/limitations;
- Draft recommends urgency only when it survives shortlist applicability;
- AI rationale references supplied evidence;
- user can choose Advice only or Apply;
- applying urgency cannot invent a deadline or unsupported scarcity.

## Scenario D — manual style

Given no supported external/internal evidence for a benchmark-breakdown style:

- user can manually choose benchmark breakdown;
- product labels it as a manual choice without evidence-backed recommendation;
- Writer still cannot invent benchmark results.

## Scenario E — strategy outcome learning

After several publications with recorded strategy provenance:

- Results shows each measured outcome;
- Learn can summarize observational cohorts by strategy when sample size exists;
- external and own-account evidence can disagree visibly;
- no causal claim is generated automatically.

## Scenario F — H2 navigation

A user can:

- find obligations in Today;
- find source opportunities in Discover;
- find replies in Conversations;
- find drafts/lifecycle in Posts;
- answer “what happened?” in Results;
- answer “what are we learning?” in Learn;
- change AI model or Growth Focus from Settings without treating Settings as a daily work destination.

---

# 20. Success metrics for this front

Do not use “people like the redesign” as the success criterion.

## UX success

- first-click success for H2 core tasks;
- low `Learn -> tutorials/help` interpretation rate in qualitative sessions;
- users correctly predict strategy mode consequences;
- users distinguish Growth fit from Writing quality;
- users can recover from outside-focus state without moderator explanation;
- users can locate Growth Focus and AI settings after utility relocation.

## Product-operational success

- zero candidate ingestion paths persist missing classification as a legitimate score 0;
- stale-classification revision mismatch is observable and repairable;
- percentage of draft generations with known strategy mode/provenance;
- percentage of publications with complete strategy provenance once feature is enabled;
- measurement coverage at fixed windows;
- relevant-follower quality and associated follow conversion available separately from raw reach;
- strategy recommendations with explicit evidence/limitations rather than unsupported labels.

## Growth success

Evaluate over meaningful windows, not one post:

- relevant follower growth velocity;
- associated follows per 1,000 views with attribution confidence;
- new-follower alignment/quality;
- substantive reply/conversation continuation;
- reach/impressions as distribution context;
- bookmarks/profile interest when observable;
- direct business outcomes only when actually recorded.

Do not optimize raw likes as the primary north star.

---

# 21. Open research questions

These remain empirical:

1. Does `Learn` survive participant testing, or should the same information model receive another label?
2. Is `Growth focus` clearer than `Audience & topics` for the configuration surface?
3. Which content groups should default to Core versus Adjacent for this account?
4. Should Adjacent require an explicit confirmation every time, only in strict mode, or never when deterministic technical-context evidence is strong?
5. Which writing-only quality weights best preserve the intended approval threshold after topic fit is removed?
6. How much own-account data is enough before internal intent/style outcomes should influence recommendation ordering?
7. Should the optional AI strategy recommendation run automatically when Generate is opened, only on explicit `Recommend approach`, or as part of explicit Generate?
8. Which Viral deterministic features are stable enough to expose as manual Writer controls without overwhelming users?
9. Which additional owned-post metrics are actually observable in the installed authenticated X path today?
10. How should objective defaults evolve if measured evidence shows reach-heavy tactics add impressions but poor relevant-follower conversion?

---

# 22. Recommended execution order

```text
1. Fix classification correctness and stale-data handling
2. Separate Growth fit from Writing quality
3. Add persistent Growth Focus + default objective
4. Land H2 shell/Learn structure behind research-aware labels
5. Build strategy evidence + append-only selection provenance
6. Add optional bounded AI recommendation + manual choice
7. Pass Apply strategy to Writer
8. Persist publication-time strategy provenance
9. Summarize real strategy outcomes in Results/Learn
10. Lock labels/navigation only after human research
```

The key sequencing principle is:

> **Correct the system's facts first, then change its information architecture, then let learning influence generation, then evaluate whether that influence actually improves the outcomes the operator cares about.**
