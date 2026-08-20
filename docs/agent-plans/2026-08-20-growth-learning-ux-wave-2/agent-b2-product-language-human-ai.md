# Agent B2 — Product Language + Human-AI Interaction System

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** documentation/content design
**Workspace:** `/home/hamza/repo/x_test-w7-ux-research`
**Branch:** `agent/w7-ux-language`
**Isolation reason:** concurrent documentation writer; this mission owns only language/Human-AI artifacts while Agent A2 owns flow/wireflow artifacts
**Can start:** immediately
**Depends on:** integrated Wave-1 evidence + `docs/ux/WAVE1_SYNTHESIS.md`
**Execution lifetime:** ordinary

## Read first

- `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md` — authoritative product purpose, research sequence, and interaction constraints.
- `docs/ux/WAVE1_SYNTHESIS.md` — frozen semantics and unresolved terminology/IA hypotheses.
- `docs/ux/USER_LANGUAGE_RESEARCH_GUIDE.md` — unanswered language questions and non-leading research protocol.
- `docs/ux/BASELINE_HEURISTIC_REVIEW.md`
- `docs/ux/COGNITIVE_WALKTHROUGHS.md`
- `docs/ux/TASK_ANALYSIS.md`
- `docs/ux/JOBS_TO_BE_DONE.md`
- `docs/ux/IA_RESEARCH.md`
- existing `docs/ux/PRODUCT_LANGUAGE.md` and `docs/ux/HUMAN_AI_INTERACTION.md` — update these rather than creating duplicate language systems.
- current React copy only where needed to ground wording in real actions/states.

## Mission

Turn the Wave-1 authority, consequence, evidence-provenance, lifecycle, recovery, and growth-purpose findings into one coherent content-design/Human-AI interaction system.

The artifacts should be usable by later prototype and implementation work while remaining honest about which labels are still hypotheses. Define stable semantics first; present candidate user-facing words and disqualifying interpretations where participant evidence is still required.

## Ownership

You own only:

- `docs/ux/PRODUCT_LANGUAGE.md` — modify the existing file;
- `docs/ux/HUMAN_AI_INTERACTION.md` — modify the existing file; this is the repository owner for the source plan's Human-AI pattern work;
- `docs/ux/STATUS_LANGUAGE.md` — create this file.

You may inspect but must not modify:

- React/backend/API/persistence/prompt code;
- Agent A2-owned flow/wireflow artifacts;
- Wave-1 evidence artifacts.

Do not create another worktree.

## Coordination contract

Preserve frozen semantics from `WAVE1_SYNTHESIS.md`:

- recommendation != selection != approval != schedule != publish/send;
- every consequential action communicates its immediate effect before activation;
- lifecycle state is recognizable without internal-module recall;
- error/recovery copy distinguishes what failed, whether remote effect may already exist, current authoritative state, retry safety, and next action;
- external niche evidence, internal account evidence, and experiment evidence stay distinguishable;
- canonical strategy behavior IDs are `off|suggest|apply`, but final user-facing words remain provisional;
- the product optimizes qualified growth velocity by default, not vanity engagement.

Do not declare `Learn`, `Current winning styles`, `What works for you`, `Tests`, `Strategy recommendations`, `Off/Suggest/Apply`, `Settings`, `Advanced`, or `Diagnostics` validated unless repository authority requires the system term itself.

## `PRODUCT_LANGUAGE.md` requirements

Expand the current small translation table into a usable language system for ordinary operators and stakeholders.

Cover at minimum:

### Product purpose and goals

Define plain-language descriptions for:

- qualified/relevant audience growth;
- reach;
- technical authority;
- relationships/opportunities;
- showcase a build;
- experiment/test;
- revenue/business outcomes versus audience proxies.

Avoid implying guaranteed growth, guaranteed virality, or direct revenue attribution.

### Consequential action verbs

Define semantics and candidate labels for actions that:

- inspect/read;
- select/route;
- generate a draft;
- regenerate/rewrite;
- approve wording;
- choose timing/schedule;
- publish now;
- send reply now;
- dismiss/ignore;
- retry;
- reconcile/inspect uncertain remote state.

For each consequential action, include a short `what happens next` sentence pattern.

### Learning/evidence language

Define stable semantic distinctions for:

- external niche evidence;
- internal account evidence;
- experiment/test evidence;
- insufficient/directional/repeated evidence;
- observational association versus causal proof;
- style versus communicative intent;
- sample size/confidence/limitations in plain language.

Where candidate labels remain unresolved, record:

- canonical semantic meaning;
- provisional label candidates;
- interpretations that would make a label unsafe/confusing;
- the user-research question that resolves it.

### Strategy behavior language

Keep canonical IDs `off|suggest|apply`, but define their behavior in plain language:

- no influence;
- advice only;
- deliberately use for this generation.

`Apply` or any candidate replacement fails if a user could reasonably interpret it as approve, publish, account-wide automation, or accepted learned rule.

## `HUMAN_AI_INTERACTION.md` requirements

Upgrade the existing contract into reusable Human-AI patterns for the current product.

Cover:

1. **AI recommendation pattern** — what AI suggests, why, evidence/limitations, human choices, no hidden authority.
2. **Deterministic rule/gate pattern** — distinguish hard rule from AI recommendation.
3. **Human selection pattern** — reversible routing/strategy choice without approval side effect.
4. **Draft generation pattern** — exact consequence, pending state, provenance, generation does not approve.
5. **Approval pattern** — human wording/evidence confirmation; approval is not publication.
6. **Send/publish pattern** — explicit immediate remote effect and exact success criterion.
7. **Learned recommendation pattern** — evidence, uncertainty, proposed effect, suggested/accepted distinction.
8. **Writing-strategy pattern** — external/internal/experiment evidence -> human off/suggest/apply semantic choice -> generation influence provenance.
9. **Failure/reconciliation pattern** — especially remote-success/local-incomplete states; never show optimistic success or ordinary resend from stale state.
10. **Advanced disclosure pattern** — exact metrics/runtime/provenance accessible on demand without burdening ordinary tasks.

For each pattern specify:

- visible first layer;
- explanation-on-demand layer;
- technical-detail layer;
- human authority boundary;
- prohibited interpretation/side effect.

Reuse existing interaction boundaries for unfollow, tests, replies, approval, and learned rules; do not weaken them.

## `STATUS_LANGUAGE.md` requirements

Create one owner for lifecycle/error/recovery vocabulary.

Define canonical semantic states and recommended plain-language presentation for:

- recommended/advisory;
- selected/routed;
- drafting/generating;
- needs review;
- blocked by writing/evidence/human confirmation;
- approved;
- waiting/scheduled;
- publishing/sending;
- published/sent;
- failed before remote effect;
- remote effect uncertain / reconciliation required;
- researching;
- research stopped;
- research failed;
- measurement waiting/observed;
- learned suggestion/accepted/retired.

For each relevant state include:

- what it means;
- what has **not** happened yet;
- what the user can safely do next;
- whether retry is safe/unsafe/unknown;
- whether the wording is stable semantic language or still a prototype label.

Define error-message anatomy:

`What failed -> What may already have changed -> Current authoritative state -> Safe next action -> Retry/reconciliation guidance`

Avoid generic `Something went wrong` as the only product-level explanation for consequential operations.

## Observable success conditions

- The three artifacts form one non-duplicative language/Human-AI system.
- Existing `PRODUCT_LANGUAGE.md` and `HUMAN_AI_INTERACTION.md` are upgraded in place rather than replaced by competing documents.
- Consequential actions have stable semantics and consequence-copy patterns.
- Recommendation, human selection, approval, scheduling, publication/send, and result states cannot be confused by the documented language system.
- External/internal/experiment evidence are explicitly distinguishable.
- Style and communicative intent are semantically distinct.
- Strategy behavior is unambiguous even while exact user-facing labels remain research hypotheses.
- Error/reconciliation copy covers remote-success/local-incomplete states and retry safety.
- Product goals distinguish qualified growth proxies from directly recorded business outcomes.
- The documents explicitly mark unresolved labels/questions requiring real participant evidence.
- No product source, APIs, persistence, prompts, or tests are changed.

## Required validation

None mandated. Do not create, modify, or run tests or application builds.

Read the final three owned artifacts and inspect the owned-file diff once. Documentation diff hygiene is sufficient if you choose to run it.

## Out of scope

- Final IA selection.
- Real participant findings or a user-language ledger.
- React copy changes.
- Backend recovery implementation.
- Strategy synthesis/persistence/Writer changes.
- Product metrics/outcome code.
- High-fidelity visual design.

## Working style

Use @Causal Coding and @Ponytail before mutation. Reuse the existing language/Human-AI documents instead of creating redundant frameworks. Prefer stable semantics plus a small number of candidate labels over exhaustive synonym catalogs.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. branch/workspace and commit hash;
3. three artifacts modified/created;
4. consequential-action language contract;
5. lifecycle/recovery language contract;
6. Human-AI recommendation/selection/approval/send boundaries;
7. external/internal/experiment evidence language;
8. strategy-mode semantic language and unresolved label candidates;
9. remaining participant-research questions;
10. deviations/conflicts, if any;
11. validation performed (state explicitly that no tests/builds were run).
