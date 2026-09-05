# Product Architecture

This document is the canonical product-level map for the X network-growth and publishing system. Use it to understand what the product is trying to become, which phase owns each capability, how the human and AI divide responsibility, and how current source data becomes measured account learning.

Implementation details live in `docs/plans/`. Current operational contracts live in the domain docs linked at the end of this file.

## Product objective

Build a local, owner-directed operating system for growing a qualified software-developer/builder audience on X across the active Growth Focus, with durable agent delegation for bounded execution rather than per-action approval ceremonies.

The system should help `@ham_zax` answer six questions:

1. What is happening now in the software-development topics and relationships that matter to this account?
2. Which current story, conversation, or relationship deserves attention?
3. What legitimate purpose could Hamza serve here—or should the system remain silent?
4. Which mode, affect, information depth, conversation stage, and format best realize that purpose?
5. What factual and biographical provenance constrains the wording?
6. What did the action actually produce, and what should change next time?

The default optimization target is **qualified developer growth**, not raw impressions or raw follower count.

## Intended final product

```text
DISCOVER
What is actually happening?
Current X / GitHub / Hacker News / conversation signals
        |
        v
RESEARCH
What is actually true?
Source material, optional context, unresolved questions
        |
        v
AI EDITORIAL DIRECTOR
What is worth doing about it for this account now?
Objective + story + purpose + mode + affect + depth + format
        |
        v
BEHAVIOR + PERSONA DECISION
Validate reason to exist, conversation stage, stance context,
provenance, and active Hamza model version
        |
        v
YOU
Select, override, research more, dismiss, or do nothing
        |
        v
WRITER
Realize the selected behavior in publication copy
using supplied source/context and bounded persona slice
        |
        v
YOU
Edit, approve, or reject
        |
        v
SCHEDULER + PUBLISH
Choose a coverage-aware slot and publish the approved item
        |
        v
MEASURE
15m / 1h / 6h / 24h content, follower, conversation,
and relationship outcomes
        |
        v
LEARN
Experiments + accepted learned rules improve future
priorities without silently rewriting strategy
        |
        +-----------------------------------------------+
                                                        |
                                                        v
                                                   DISCOVER / PLAN
```

The engagement lane runs beside the main-feed lane:

```text
DISCOVER CONVERSATION
        |
        v
RELATIONSHIP + CONVERSATION PRIORITY
        |
        v
PURPOSE / MODE / AFFECT / DEPTH / STAGE
        |
        v
AI REPLY REALIZATION
        |
        v
YOU REVIEW + SEND / IGNORE
        |
        v
RELATIONSHIP EVENT
        |
        v
MEASURE + LEARN
```

AI may recommend and prepare work. Consequential authority comes from the owner-controlled workflow boundary: either an exact one-shot human action or a running revisioned Growth Operator/autonomous-reply delegation whose scope, gates, budget, and revocation remain owner-controlled.

## Current vs planned state

Current repository state:

- Phases 1A, 1B, 1C, 1D, 2, 3, 4, 5, and 6 are implemented.
- The shared AI runtime/provider layer is implemented: Direct API/OpenRouter/OpenAI-compatible endpoints, Codex, and installed AGY use the common structured boundary; AI Settings owns profile/default/role configuration and safe secret references.
- `continuous_scan` remains configuration-only and visibly **Not active** until a concrete background consumer exists. OpenCode uses its documented SDK/server structured-output contract when available; OpenCode 2 remains separately capability-gated rather than being simulated through undocumented output parsing.
- Operator-attached JPEG/PNG/WebP/GIF media has real local readiness and preview. Background X API publication still rejects local media. The browser-agent lane now owns the end-to-end handoff without weakening `browser-fast`: upload binds the attachment bytes by SHA-256, and immediately before atomic publication claim Growth OS rechecks that hash and maps only the exact current `.x-media` file to short-lived logical artifact `x-growth.queue.<id>.media`; reconciliation requires proof that exact artifact was attached and then removes its allowlist entry. Writer-planned media still does not create files by itself.

Phase-6 editorial planning is current runtime behavior and remains advisory: recommendation, route/behavior selection, approval authority, transport, and reconciliation stay separate. Main-feed approval may come from the ordinary owner lane or the running revisioned Growth Operator mission-agent lane; Repost is a source-only approval with no Writer draft. Reply authority has two explicit paths: exact owner approval staged for browser execution, or the separately persisted autonomous-reply grant with deterministic eligibility, budget, exact-text/target provenance, and atomic claim. Native Repost may likewise use the delegated browser lane after current source/provenance approval, while the manual owner completion path remains available.

## Phase map

| Phase | Status | Main job | Primary output |
| --- | --- | --- | --- |
| 1A | Implemented | Workflow foundation and behavior-aware triage | `queue_items`, behavior/route selection, approval boundary, Reach/Follow/Conversation/Relationship potentials |
| 1B | Implemented | Relationship Intelligence | target classes, TargetScore, relationship profiles/events/stages, social and technical interaction outcomes |
| 1C | Implemented | Engage Next + autonomous reply operator | purpose-aware reply/follow-up opportunities, ordinary exact owner send, delegated dry-run evaluation, and separately transport/policy-gated live reply authority |
| 1D | Implemented | Account Health and visibility observability | HEALTHY/WATCH/CONSTRAINED plus observed diagnostics |
| 2 | Implemented | Behavior realization, content quality, and profile proof | behavior/persona-aware writer packet, drafts, purpose/provenance gates, quality score, separate owner/delegated review authority |
| 3 | Implemented | Main-feed distribution | urgency/expiry, scheduler, atomic claim, API/browser execution contracts, source-only Repost, claim-scoped browser media artifacts, and structural reconciliation |
| 4 | Implemented | Measurement and experiments | fixed-window content, follower, relationship, and behavior outcomes plus experiment summaries |
| 5 | Implemented | Learned strategy | suggested/accepted/retired bounded learned rules; persona beliefs do not auto-mutate |
| 6 | Implemented | AI Editorial Director | current story clusters, controlled evidence, objective-aware behavior/format recommendations, selected-route/authority provenance, writer context, outcome context |
| P | Implemented alpha | Versioned persona and stance memory | owner-tuned `persona/hamza-v1.json`, bounded persona slices, append-only stance events, per-action persona version |

### Phase 1A — Workflow foundation

Phase 1A turns discovered candidates into explicit work instead of implicit saved state.

It owns:

- `queue_items`;
- Triage;
- route selection;
- Reach Potential;
- Follow Potential;
- Conversation Potential;
- Relationship Potential;
- AI/rule recommendation separate from the human-selected route;
- explicit approval authority before a main-feed item becomes publishable: ordinary owner approval or the active revisioned Growth Operator mission-agent path.

The four opportunity scores are internal editorial heuristics. They are not X ranking scores.

### Phase 1B — Relationship Intelligence

Phase 1B separates raw audience observation from strategic relationship state.

It owns:

- relationship target classes;
- TargetScore;
- relationship profiles;
- append-only relationship events;
- observed -> interacted -> responsive -> recurring -> connected -> mutual stages;
- durable context about who responded, who continued a conversation, and where repeated useful interaction exists.

The purpose is to grow a useful network, not merely reply to large accounts.

### Phase 1C — Engage Next

Phase 1C answers:

> Which conversation deserves a purposeful Hamza action now, and what should that action be?

It owns:

- active-conversation follow-ups;
- recent target-post opportunities;
- freshness/expiry;
- EngagePriority;
- contextual purpose validity and reply archetypes;
- conversation-stage context;
- persisted behavior decisions;
- reviewable Reply/Quote choices;
- one-by-one human send/ignore decisions.

Automation may refresh these opportunities. It may not spray replies.

### Phase 1D — Account Health

Phase 1D separates observable platform/account evidence from speculation.

It owns:

- `HEALTHY` / `WATCH` / `CONSTRAINED`;
- provenance-preserving health observations;
- optional Under the Hood observations when actually available;
- soft target saturation/repetition pressure;
- Network Quality;
- InteractionYield.

Low reach alone is not proof of an account-level constraint. WATCH signals normally change priority or warning text rather than banning a useful human-reviewed action.

### Phase 2 — Content quality and profile proof

Phase 2 turns a selected behavior and route into defensible publication content.

It owns:

- Original / Quote / Thread / Reply realization contracts;
- behavior/persona-aware Writer packets;
- structured Writer output;
- purpose, factual/biographical provenance, originality, understandability, format, treatment, and media gates;
- the purpose-aware 50-point draft-quality score;
- media-plan metadata;
- the ProfileProofCoverage packet/editorial contract plus the strict published-only runtime owner shared by Today and the Writer;
- final review/approval boundary, either ordinary owner review or the bounded Growth Operator mission-agent approval path where current policy permits it.

The Writer receives the selected purpose, mode, affect, affect provenance, information depth, conversation stage, persona version, source, and working context. It may improve wording; it must not silently replace the behavior decision. Approval remains a separate workflow authority from Writer generation.

### Phase 3 — Main-feed distribution

Phase 3 owns publication eligibility and timing after approval.

It owns:

- urgency/expiry;
- semantic conflict/self-cannibalization checks;
- coverage spacing;
- optional explicit human timing override;
- one-winner main-feed ranking;
- atomic publication claim;
- route-specific execution: background official-API transport for its supported subset, and persistent browser-agent execution for Original/Quote/Thread/Repost;
- claim-scoped browser media artifact registration/verification/cleanup;
- persisted publication success/failure/reconciliation.

Repost remains a deliberate, rare distribution action, but it is not manual-only: a running Growth Operator may approve/claim a source-only Repost through the same bounded main-feed delegation. Reply execution stays outside the main-feed publisher and uses its own reply claim.

### Phase 4 — Measurement and experiments

Phase 4 records what happened after publication or interaction.

It owns:

- idempotent first-available 15m/1h/6h/24h measurements;
- actual capture timestamps;
- views/likes/reposts/replies and normalized rates;
- associated follower conversion with attribution confidence;
- first-seen/new-follower quality;
- conversation/relationship conversion outcomes;
- explicit content/timing/network experiment assignment;
- cautious evidence states.

The product should distinguish association from causality when several posts or outside events overlap.

### Phase 5 — Learned strategy

Phase 5 converts repeated measurements into bounded account-specific recommendations.

It owns:

- suggested learned rules;
- evidence qualification;
- authorized acceptance: manual on qualified directional/repeated evidence, or delegated autonomous acceptance only on repeated qualified evidence with no active review suspension;
- bounded production adjustments;
- retirement/review when evidence reverses or underlying algorithm evidence changes.

A learned rule cannot remove hard publication/provenance/health gates or create/widen delegation authority. Manual acceptance and delegated repeated-evidence acceptance remain explicit, inspectable transitions.

### Phase 6 — AI Editorial Director

Phase 6 sits above individual source routing and below the writer.

It answers:

> Given today's real source signals, our niche, our current profile proof, our conversations, our account health, and what has worked for this account, what should we do next?

It owns:

- one canonical live-source refresh path;
- source-observation history and source-native momentum deltas;
- cross-source story clustering;
- deterministic pre-research story ranking;
- controlled claim-level research evidence;
- objective-aware editorial planning;
- transparent Authority Value;
- recommendation provenance;
- multi-source source linkage;
- Today editorial-plan UX;
- linkage of selected recommendations to later measurement/learning.

Phase 6 may recommend:

```text
PREPARE + Original
PREPARE + Quote
PREPARE + Thread
PREPARE + Reply
PREPARE + Repost
RESEARCH_MORE
SKIP
no strong current action
```

It cannot approve, publish, send a reply, complete a repost, change account-health truth, or accept a learned rule.

## Source truth and workflow truth are different

The product has three separate concepts that must never be collapsed into one label.

### Live source snapshots

These answer:

> What is actually present in the external source right now?

Canonical source kinds:

```text
x_latest
x_momentum
github_trending
hn_top
```

Current intended semantics:

- **X Latest** — recent posts returned by configured X Latest searches, merged in real post-time order. It is not the global X timeline.
- **X Momentum** — current X Top-search results over the configured niche/topic set with observed engagement/momentum context. It is not the global X Trends product.
- **GitHub Trending** — repositories from GitHub's actual Trending page in upstream order, enriched with authoritative repository metadata such as description/stars/forks/language.
- **HN Top Stories** — current Hacker News `topstories` order with source-native points/comments/author metadata.

`Refresh source` refreshes the external-source snapshot. It does not mean "show every unresolved item we have stored from the last week."

### Workflow inbox

**To review** answers:

> Which persisted source candidates still need a decision from us?

A source leaves To review when it is routed into research/drafting/watch/review/publishing/completion/skip state. It may remain visible in a live source snapshot while genuinely still trending upstream.

### History/reference

- **Bookmarks** mean the operator explicitly wants to keep the source for reference. Bookmark state is independent of workflow state.
- **Handled** is derived from real action/publication history such as Quote, Reply, Repost, or Published post/thread. It is not a separate mutable `handled` flag.
- **All sources** is historical/persisted source context and must not be labeled as a current upstream snapshot.

This separation is a product invariant.

## Editorial objectives

Phase 6 supports explicit operator goals:

```text
qualified_growth      default
reach_momentum
relationships
technical_authority
balanced
```

The selected objective changes the editorial weighting, not the underlying source facts.

The product keeps these values visible and separate:

- Reach Potential;
- Follow Potential;
- Conversation Potential;
- Relationship Potential;
- editorial Authority Value.

No combined value may be presented as an X/Phoenix score.

## Research and evidence contract

The system may research when additional context would improve an editorial angle.

For shortlisted stories, controlled code may inspect:

- exact X post/thread/quote context;
- GitHub repository metadata;
- README;
- release metadata;
- exact HN item metadata;
- directly linked pages/articles;
- operator-supplied additional research URLs.

Research material is stored with provenance when available.

Evidence status:

```text
primary_supported
source_claim
contradicted
unresolved
```

`primary_supported` records that the cited primary artifact was associated with the stored claim within its claim type. It does not represent a general ranking or publication requirement.

If automatic controlled research leaves useful questions open, the product may return **Research More — manual/external research suggested** and show the unresolved questions. The operator may find another source externally and attach its URL through the controlled fetch boundary.

The initial Phase-6 design does not add a general web-search provider.

## AI responsibility

AI is used for semantic tasks that benefit from language-model reasoning:

```text
1. EDITORIAL SCAN
   cluster current source items into stories;
   summarize what appears to be happening;
   identify useful research questions.

2. FINAL EDITORIAL PASS
   propose purpose/format/why-now/desired-reader-outcome;
   select an inspectable mode, affect, depth, and conversation stage;
   use supplied source context and evidence classifications when relevant.

3. BEHAVIOR + PERSONA REALIZATION
   validate reason to exist and route compatibility;
   apply the active Hamza model and stance context;
   preserve factual, experiential, relational, and emotional-history boundaries.

4. WRITER
   produce publication copy from the selected behavior,
   supplied source context, profile proof, relationship context,
   bounded persona slice, and canonical writing contract.
```

AI does not own:

- source fetching truth;
- external-source rank;
- workflow state;
- evidence provenance;
- the four opportunity scores;
- final numeric recommendation ordering;
- account-health truth;
- approval;
- publication authorization;
- measurements;
- learned-rule acceptance.

## AI runtime and provider model

The product must not equate "AI" with one model or one vendor.

Separate two concepts:

```text
AI RUNTIME / HARNESS
How the model is invoked

DIRECT API
CODEX
OPENCODE
OPENCODE 2
AGY / ANTIGRAVITY

        +

MODEL PROVIDER / ENDPOINT
Where inference comes from

OPENAI
OPENROUTER
OPENAI-COMPATIBLE ENDPOINT
RUNTIME-MANAGED PROVIDER
LOCAL OLLAMA / LM STUDIO / vLLM / etc.
```

The common product boundary is:

```text
runStructuredAI({
  role,
  profile,
  prompt,
  schema
})
```

The rest of the editorial/writer architecture must not care whether the result came from Codex, OpenRouter, a local model, OpenCode, OpenCode 2, or AGY.

Detailed implementation is in `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md`.

### Required selectable AI roles

The UI must support a default profile plus per-role overrides:

```text
continuous_scan
editorial_scan
editorial_final
writer
```

This allows cheap/local inference for continuous work and stronger reasoning only where it earns the cost.

Resolution is explicit profile override -> role override -> global default profile -> documented compatibility fallback. The global default is persisted separately from role bindings so the UI's **Default profile** is real configuration rather than presentation-only state.

`continuous_scan` is a reserved cheap/background role until a concrete continuous consumer is implemented. The UI may configure it, but must show **Not active** rather than implying that assigning a model starts a 24/7 job.

Example operator configuration:

```text
Continuous scan
Runtime: Direct API
Provider: Local OpenAI-compatible
Model: qwen/coder-or-general-local-model

Editorial scan
Runtime: Direct API
Provider: OpenRouter
Model: inexpensive structured-output model

Editorial final
Runtime: Codex
Model: gpt-5.6-luna
Reasoning: max

Writer
Runtime: AGY, Codex, OpenCode, or Direct API
Model: operator choice
```

`gpt-5.6-luna` + `max` is an example profile, not a hard-coded product default. The UI should expose only reasoning variants the selected runtime/model reports as available when that metadata exists.

### Direct providers

The first-class direct provider types are:

- **OpenAI**;
- **OpenRouter**;
- **OpenAI-compatible**.

OpenRouter should expose its current model catalog dynamically rather than hard-coding model IDs.

An arbitrary OpenAI-compatible profile must support:

```text
name
base URL
API key / secret reference
model ID
protocol: Responses or Chat Completions
optional model-catalog discovery
```

This is the path for local or remote endpoints such as Ollama, LM Studio, vLLM, SGLang, llama.cpp-compatible servers, gateways, or other compatible services.

### Agent runtimes

- **Codex** — supported as a runtime. The adapter may select model/reasoning per run and use the locally configured Codex authentication/provider profile. Codex may itself target OpenAI or compatible/local providers when configured by the operator.
- **OpenCode** — optional runtime when installed. Use its model/provider selector and structured-output/server facilities where available.
- **OpenCode 2** — optional runtime when installed. Prefer its V2 server/client contract when the beta API is stable enough for the required operation; keep runtime availability explicit because V2 contracts may change.
- **AGY / Antigravity CLI** — supported for the installed capability contract and verified against AGY 1.1.15: non-interactive `--print`, JSON output, JSON Schema, sandbox + plan mode, exact catalog model selection, optional `low|medium|high` effort, and runtime-managed credentials. The adapter never uses `--dangerously-skip-permissions` or silently substitutes a model. Catalog/model checks are intentionally non-generative, so authentication may remain unknown; AGY cost remains `null` when the runtime does not expose it.

A missing runtime is a normal availability state. The UI should show **Not installed** instead of failing after selection.

## AI configuration and UI

The product has an **AI Settings** surface.

It should show:

```text
AI Settings

Default profile
[ ... ]

Role assignments
Continuous scan   [ Local Qwen            ]
Editorial scan    [ OpenRouter / ...       ]
Editorial final   [ Codex / Luna / Max     ]
Writer            [ AGY / Claude ...       ]

Profiles
[ Codex Luna Max ]
[ OpenRouter ... ]
[ My Local Model ]

Runtime availability
Codex       Installed / version
OpenCode    Installed / Not installed
OpenCode 2  Installed / Not installed
AGY         Installed / version
```

For OpenRouter:

- enter/store API key;
- refresh the current model catalog;
- search/select a model;
- show useful capability/pricing/context metadata when supplied by OpenRouter.

For OpenAI-compatible endpoints:

- enter name;
- enter base URL;
- enter optional API key;
- choose Responses vs Chat Completions;
- fetch `/models` when supported;
- allow manual model ID when model listing is unavailable.

The UI must show the **resolved runtime + provider + model + reasoning setting actually used** for an AI run. A friendly profile name alone is not enough provenance.

## Structured-output requirement

Editorial scan, editorial final, and writer calls produce machine-consumed data. Every adapter must therefore return data validated against the supplied JSON Schema.

Preferred order:

1. native JSON-schema/structured-output facility when supported;
2. runtime-enforced schema facility such as Codex/AGY/OpenCode structured output;
3. for compatible endpoints without native schema support, JSON-only generation followed by local schema validation and at most one bounded repair attempt.

If the adapter still cannot produce valid structured output, fail that AI run visibly. Do not persist a partially parsed editorial recommendation as valid state.

## Secrets

API keys are local secrets, not content data.

The implemented contract is:

- non-secret AI profile configuration lives in SQLite;
- API keys are referenced by `secret_ref` and are not stored in ordinary profile JSON;
- a dedicated local secrets file outside the repository stores UI-entered keys with owner-only permissions;
- environment-variable secrets remain supported for operators who do not want UI-managed keys;
- API responses never return the full secret after save;
- logs and `ai_runs` never contain raw keys;
- deleting a profile deletes its local secret reference/value unless another profile explicitly shares that secret reference.

The local secret file is not represented as encrypted-at-rest unless the implementation actually adds an OS keyring/encryption facility.

## AI usage and cost visibility

The reason for multiple profiles is operational cost as well as quality.

For each AI call, record when available:

```text
role
runtime
provider
model
reasoning/variant
started_at / completed_at
input tokens
output tokens
provider-reported cost or locally estimated cost
status/error class
```

Every logical AI call also carries an invocation ID so primary/fallback attempts can be correlated without conflating separate user/domain requests.

Unknown usage/cost stays `null`; it must not be displayed as zero.

This lets the operator answer:

- which model is consuming the 24/7 budget;
- whether a cheaper continuous scanner changes recommendation quality;
- whether the strongest reasoning model is worth using for the final editorial pass;
- which provider/runtime has unacceptable latency or failure rate.

The product should optimize cost from measured account behavior and AI-run usage, not from assumptions about model names.

## Model/provider changes do not change authority

Switching AI runtime/provider must never change these boundaries:

```text
source truth                 code/source owner
research provenance          controlled research owner
workflow state               queue/pipeline owner
numeric editorial ordering   deterministic code
route / behavior authority   owner lane or bounded delegation
approval authority           owner lane or revisioned Growth Operator delegation
publication                  execution-plane transport owner after claim
measurement                  Phase 4
learned-rule acceptance      manual authority or bounded repeated-evidence delegation
```

A cheaper local model may produce a worse recommendation. It may not gain extra authority because it is local, and a more expensive model may not bypass approval because it is stronger.

## Product surfaces

### Today

Today becomes the main decision surface.

Today shows the implemented AI Editorial Plan above the existing workflow attention area.

It should answer:

- what deserves attention now;
- what objective is selected;
- what the best main-feed/relationship/research actions are;
- why each action is timely;
- what source/context informs it;
- what is unresolved;
- which AI profile produced the advisory reasoning.

### Discover

Discover is source truth plus persistent source workflow context.

It should not become a second competing editorial planner.

### Conversations

Conversations owns active/follow-up relationship opportunities plus both the ordinary human-reviewed reply lane and inspectable autonomous-reply state.

### Create

Create owns editable work, review, approval, publishing state, and immutable completed publication history.

### Results

Results shows content/network outcomes, attribution context, source/recommendation provenance, and account health.

### Improve

Improve shows experiments and bounded evidence-controlled learned strategy, including whether a transition was manual or delegated.

### Advanced / AI Settings

Advanced retains detailed diagnostics. AI Settings owns runtime/provider/model configuration and run/cost visibility.

## Authority map

| Action | AI may suggest? | Delegated execution? | Owner authority / boundary |
| --- | --- | --- | --- |
| Cluster source stories | Yes | Yes, advisory computation | Owner can ignore/dismiss |
| Research allowed sources | Yes | Yes, read-only controlled retrieval | Owner can add/withhold sources |
| Choose editorial objective | Can suggest | Yes while a running Growth Operator uses the configured/default objective | Owner may change the objective/scope |
| Recommend format | Yes | Yes, advisory only | Owner can override |
| Draft text | Yes | Yes after work exists | Owner may edit/reject; Writer has no publication authority |
| Approve main-feed item | AI can recommend readiness | Yes, only through the running revisioned Growth Operator mission-agent path with current evidence/provenance/persona/gates | Owner starts/pauses/stops/revokes delegation; ordinary manual approval remains available |
| Send human-reviewed reply | No | Yes after exact owner approval, through `browser-reply-claim` and verified browser execution | Owner freezes the exact text; browser execution cannot edit it or create approval |
| Send autonomous reply | AI may choose allowed behavior and exact text | Yes only with running Live reply grant, deterministic eligibility, remaining budget, exact persisted text/target/provenance, Account Health checks, and atomic `browser-reply-claim`/configured transport | Owner controls grant lifecycle and scope; autonomous decisions never create `humanApprovedAt` |
| Complete repost | Editorial may recommend Repost | Yes for a currently approved source-only Repost through `browser-publish-claim`, exact source-state verification, and `record-action` | Owner retains manual Repost completion as an alternative and controls/revokes delegation |
| Schedule suggestion | Yes | Yes, advisory calculation | Owner can override timing |
| Publish approved main-feed item | No new recommendation authority at transport time | Yes after an atomic claim: background daemon through supported API transport, or persistent Growth Operator through browser-agent execution | Transport does not create approval; owner controls delegation and can revoke it |
| Accept learned strategy rule | AI may suggest | Yes only under the stricter repeated-qualified-evidence delegated path with no active review suspension | Owner may accept manually, retire, or revoke delegation; rules never widen their own authority |

## Provenance chain

A completed Phase-6 publication should be traceable as:

```text
source snapshots
  -> source observations
  -> story cluster
  -> research evidence rows
  -> editorial run
  -> editorial recommendation + proposed behavior
  -> selected route / behavior + authority provenance
  -> normalized behavior snapshot + persona version
  -> queue item + source links
  -> draft + evidence IDs + bounded persona slice
  -> owner or delegated approval snapshot
  -> publication
  -> 15m/1h/6h/24h measurements
  -> follower/network outcomes
  -> experiment/learning context
```

Do not overwrite the original AI recommendation when the owner or delegated workflow selects a different route. Preserve recommendation versus selected route/behavior and authority provenance as measurement data.

## Failure semantics

The product must fail visibly rather than manufacture certainty.

- Source refresh fails -> retain last snapshot with its timestamp and show the source error/staleness.
- No previous observation -> momentum delta is unavailable, not zero.
- Additional research would improve the angle -> Research More is available, but it is not required before drafting.
- AI runtime is missing -> profile unavailable; do not silently choose another runtime unless a configured fallback exists.
- Provider/API key is invalid -> connection/run error; do not present old AI output as newly generated.
- Model lacks usable structured output -> block that profile for structured roles or use the documented validated compatibility fallback.
- AI output fails schema validation -> AI run fails; do not persist the malformed recommendation as complete.
- No strong current action -> successful empty editorial plan.
- Publication transport fails -> existing `failed` publication state; no duplicate send in the same cycle.

## What "working product" means here

A source label, status, metric, recommendation, or button must match real state and real utility.

Examples:

- `GitHub Trending` means the actual current GitHub Trending source snapshot, not an internal star-velocity approximation.
- `HN Top Stories` means the current HN source snapshot, not a seven-day unresolved backlog.
- `X Latest` means the configured Latest-search source view in actual post-time order, not internal relevance order.
- `Bookmark` means keep for reference; starting a draft does not silently bookmark the source.
- `Handled · Quoted` comes from real action history.
- `Published post` is immutable historical text in the UI; later edits cannot rewrite what was sent.
- `Prepare repost` does not imply an editable text draft exists.
- `Research More` shows unresolved questions and a real next action.
- `AI recommendation` identifies the runtime/model that generated it and remains separate from deterministic numeric scores and the human-selected route.

## Detailed source-of-truth documents

- `docs/CONTENT_OPERATING_STANDARD.md` — universal outbound purpose, provenance, and quality contract.
- `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md` — account/network strategy and metrics hierarchy.
- `docs/RELATIONSHIP_INTELLIGENCE.md` — relationship state, interaction selection, and relationship outcomes.
- `docs/POST_GENERATION_PROMPT.md` — final Writer realization contract.
- `behavior.js` — shared purpose/mode/affect/depth/stage vocabulary and normalization.
- `persona.js` plus `persona/hamza-v1.json` — active versioned experimental persona owner and bounded consumer slices.
- `docs/AGENT_WORKFLOW.md` — current agent operations and bridge commands.
- `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md` — cross-system implementation/history map.
- `docs/NICHE_AND_KEYWORDS.md` — niche taxonomy and source themes.
- `docs/RESEARCH_AGENDA.md` — research priorities.
- `docs/ALGORITHM_EVIDENCE_LEDGER.md` — evidence registry for claims about X mechanisms; not content/persona/route authority.
- `docs/plans/README.md` — implementation-plan index.
- `docs/plans/X_CONTENT_PERSONA_SYSTEM_OVERHAUL.md` — implementation history and remaining calibration frontier.
- `docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md` — detailed Phase-6 editorial plan.
- `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md` — runtime/provider/model selection and AI Settings plan.
