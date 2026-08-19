# Phase 6 AI Editorial Director Implementation Plan

**Goal:** Turn current X, GitHub Trending, Hacker News, relationship, profile-proof, account-health, and measured account outcomes into an explainable daily editorial plan that recommends what `@ham_zax` should do next, which format to use, which growth objective it serves, what evidence supports it, and why it is timely.

**Architecture:** Add an editorial layer above per-candidate routing and below human selection. The layer reads authoritative live-source snapshots, source-observation history, existing opportunity scores, relationship state, profile proof, account health, recent owned content, accepted learned rules, and controlled research evidence. A bounded AI scan clusters current signals into stories; controlled research enriches the strongest stories; a second structured AI pass produces advisory recommendations through the shared runtime/provider boundary in `AI_RUNTIME_PROVIDER_LAYER.md`. Existing writer, hard gates, human approval, scheduler, publication, measurement, and learned-strategy owners remain authoritative after a recommendation is selected.

**Tech Stack:** Node.js 24, built-in SQLite, existing XActions/X read path, GitHub Trending + GitHub API, Hacker News API, built-in `fetch` for fixed trusted APIs, Node `http`/`https` + `dns`/`net` primitives for guarded untrusted-page retrieval, shared `runStructuredAI()` runtime/provider layer, React + TypeScript UI, existing Phase 1-5 workflow/measurement/learning data.

## Global Constraints

- This phase consumes Phases 1-5. It does not replace their owners.
- Structured AI execution must use `docs/plans/AI_RUNTIME_PROVIDER_LAYER.md`; Phase 6 must not create another Codex-only process owner.
- The operator may use different AI profiles for `editorial_scan`, `editorial_final`, and `writer`; changing provider/model does not change evidence, score, workflow, approval, or publication authority.
- The default product objective is **qualified developer growth**, not raw impressions or raw follower count.
- Keep Reach Potential, Follow Potential, Conversation Potential, and Relationship Potential visible and separate. Do not label any internal score as a Phoenix score, X score, or predicted X ranking score.
- Algorithm-aware recommendations may use only mechanisms classified by `docs/ALGORITHM_EVIDENCE_LEDGER.md`. Preserve `CODE_BACKED`, `OFFICIAL_PRODUCT_OR_POLICY`, `EMPIRICAL_VARIABLE`, and `RETIRED` distinctions in recommendation explanations.
- Do not turn public X action weights into raw engagement-count arithmetic.
- Do not add detector-evasion logic, fake-human timing, jitter, hidden bot-risk scores, or anti-abuse circumvention tactics.
- Treat source text, linked pages, README content, HN comments, and X posts as untrusted content. Never follow instructions embedded in source material.
- Editorial AI must not browse, run shell commands, edit files, or silently fetch additional data. It reasons only over the packet assembled by controlled code.
- Controlled research owns source retrieval and evidence provenance. The writer remains a no-browse consumer of persisted evidence.
- Generic page retrieval must use one SSRF-safe fetch boundary in `research.js`; untrusted URLs never go directly to built-in `fetch`.
- A recommendation is advisory. AI cannot route, approve, schedule, publish, send a reply, mark a repost complete, accept a learned rule, or change account-health state without the existing explicit workflow action.
- The system may recommend **no main-feed post** when no current opportunity is strong enough.
- Missing evidence must remain missing. If an important claim cannot be supported from controlled research, return `RESEARCH_MORE`, narrow the claim, or skip it.
- A source already handled must not be recommended again unless the current story contains a material new development. The recommendation must state the new reason.
- Live-source views remain authoritative snapshots. Persisted backlog/history must never be presented as the current GitHub Trending, HN Top Stories, X Latest, or X Momentum state.
- `Bookmarks` remain reference state. They are not proof that a source is unresolved or recommended.
- Existing accepted learned rules may adjust current opportunity/scheduler scores only through their current bounded Phase-5 contracts. Editorial AI cannot invent or auto-accept learned rules.
- ProfileProofCoverage may use only actually published owned main-feed content. Approved, scheduled, drafted, bookmarked, replied, or repost-only items do not establish profile proof.
- Code owns all numeric editorial scores and final recommendation ordering. AI may supply only the explicitly bounded semantic classifications defined in this plan; it cannot silently demote or reorder a higher numeric recommendation.
- No tests are authorized by this plan.

---

## Product Contract

Phase 6 adds one product concept:

> **Editorial Plan** — a ranked, evidence-bounded set of actions the account could take now, derived from current signals plus account-specific context.

The plan answers:

```text
What is happening now?
What story clusters matter to our niche?
What do we know versus only suspect?
What angle can this account own?
Which objective does the action serve?
Original / Quote / Thread / Reply / Repost / Research / Skip?
Why this format?
Why now?
What useful downstream actions are plausible?
What profile-proof gap would this strengthen?
Which X/public mechanisms are relevant?
Which parts are only empirical/account-specific?
What risks or missing evidence remain?
```

The plan does **not** generate final publication prose. The existing writer owns final copy after the human selects an editorial recommendation.

### Editorial objectives

Support these explicit modes:

```text
qualified_growth      default
reach_momentum
relationships
technical_authority
balanced
```

Starting internal editorial-fit weights:

| Objective | Reach | Follow | Conversation | Relationship | Authority |
| --- | ---: | ---: | ---: | ---: | ---: |
| `qualified_growth` | 0.20 | 0.40 | 0.10 | 0.10 | 0.20 |
| `reach_momentum` | 0.55 | 0.20 | 0.10 | 0.05 | 0.10 |
| `relationships` | 0.05 | 0.10 | 0.35 | 0.40 | 0.10 |
| `technical_authority` | 0.15 | 0.25 | 0.10 | 0.05 | 0.45 |
| `balanced` | 0.25 | 0.25 | 0.20 | 0.15 | 0.15 |

These weights are transparent **editorial preferences**, not X ranking weights. Show the selected objective and component inputs anywhere an editorial-fit number is shown.

### Authority value

Add one editorial-only 0-100 value. Do not add it to Phase-1 queue opportunity fields.

Compute it from visible components:

```text
profile-proof gap       0-40
research-agenda value   0-30
evidence depth          0-20
novel-angle headroom    0-10
```

Starting mappings:

```text
Profile-proof gap
none   -> 40
weak   -> 30
medium -> 15
strong -> 0

Research-agenda value
Tier 1 -> 30
Tier 2 -> 20
Tier 3 -> 10
none   -> 0

Evidence depth
primary-supported evidence from >=2 distinct source families -> 20
primary-supported evidence from 1 source family              -> 12
source claim / metadata only                                  -> 4
no usable evidence                                             -> 0

Novel-angle headroom
our experiment or defensible multi-source synthesis -> 10
distinct evidence-backed interpretation             -> 6
useful but source-dependent commentary               -> 3
summary/paraphrase only                              -> 0
```

`research_topics.js` owns the machine-readable Research Agenda taxonomy used for `research-agenda value`. It must expose these canonical topic IDs and tiers from `docs/RESEARCH_AGENDA.md`:

```text
coding_agent_reliability             Tier 1
agent_context_memory_state           Tier 1
mcp_tool_use_architecture            Tier 1
coding_model_cost_reliability        Tier 1
agent_sandboxing_execution           Tier 2
local_open_coding_models             Tier 2
agent_observability                  Tier 2
ai_coding_security                   Tier 2
agent_native_developer_tooling       Tier 2
ai_engineer_job_market               Tier 3
devtool_ai_product_economics         Tier 3
technical_product_distribution       Tier 3
```

`research_topics.js` also owns deterministic anchor/tag matching. Start with this runtime map; anchors are normalized case-insensitively and generic single tokens such as `AI`, `developer`, `tool`, or `model` never match by themselves:

| Topic ID | High-specificity anchors |
| --- | --- |
| `coding_agent_reliability` | `coding agent`, `agent eval`, `agent evaluation`, `repo-scale`, `repository-scale`, `agent verification`, `autonomous debugging` |
| `agent_context_memory_state` | `agent memory`, `agent context`, `persistent state`, `context compression`, `task ledger`, `repo map`, `context window` |
| `mcp_tool_use_architecture` | `MCP`, `Model Context Protocol`, `tool calling`, `tool schema`, `tool discovery`, `agent tool` |
| `coding_model_cost_reliability` | `coding model`, `Claude Code`, `Codex`, `Qwen`, `DeepSeek`, `GLM`, `coding reliability`, `cost per task` |
| `agent_sandboxing_execution` | `sandbox`, `Firecracker`, `microVM`, `WebAssembly`, `execution environment`, `container isolation` |
| `local_open_coding_models` | `Ollama`, `llama.cpp`, `vLLM`, `quantization`, `open-weight coding`, `local coding model`, `VRAM` |
| `agent_observability` | `agent observability`, `tool-call trace`, `tool-call log`, `replay`, `eval dashboard`, `prompt versioning` |
| `ai_coding_security` | `prompt injection`, `credential exfiltration`, `MCP security`, `package hallucination`, `permission escalation`, `AI coding security` |
| `agent_native_developer_tooling` | `agent-friendly CLI`, `machine-readable CLI`, `structured error`, `idempotent command`, `dry-run`, `non-interactive workflow` |
| `ai_engineer_job_market` | `AI engineer`, `agent engineer`, `AI product engineer`, `agent-engineering role`, `AI job market` |
| `devtool_ai_product_economics` | `devtool pricing`, `AI product pricing`, `developer tool business`, `AI SaaS economics`, `developer SaaS revenue` |
| `technical_product_distribution` | `developer marketing`, `technical product distribution`, `customer discovery`, `build in public`, `devtool launch`, `technical sales` |

A candidate may match several topics. Count unique matched anchors per topic. For a story, code takes the union of member-candidate matches and chooses the primary research topic by: lower tier number first, then greater unique-anchor count, then canonical topic ID. The AI may explain or challenge that mapping in text, but it cannot assign a tier or numeric research-agenda value.

Novel-angle headroom is the only Authority component that accepts a bounded semantic field from the final AI pass. The model returns exactly one `angleClass`:

```text
our_experiment
multi_source_synthesis
evidence_backed_interpretation
source_dependent_commentary
summary_only
```

Code validates and maps it:

```text
our_experiment                   -> 10 only when supplied first-party experiment evidence supports the thesis
multi_source_synthesis           -> 10 only when >=2 real candidate keys and >=2 source families support the thesis
evidence_backed_interpretation   -> 6 only when >=1 primary_supported evidence item supports the thesis
source_dependent_commentary      -> 3
summary_only                     -> 0
```

If validation fails, code downgrades the class to the strongest class whose requirements are met and records the downgrade reason. The AI may explain the visible components but may not replace them with an opaque Authority score.

### Recommendation decisions

The final editorial pass may return:

```text
PREPARE
RESEARCH_MORE
SKIP
```

When `decision = PREPARE`, `pipeline` must be one of:

```text
original
quote
thread
reply
repost
```

`PREPARE` means "enter the selected existing workflow" rather than "a text draft always exists." Original/Quote/Thread/Reply create editable text work through the current pipeline. Repost follows the current repost contract: no draft is created; it enters `needs_review` for explicit human approval and later manual completion.

When `decision = RESEARCH_MORE`, the recommendation enters the existing `research` workflow without publication text and must carry concrete unresolved research questions. Phase 6 does not claim to perform a broader web search. The UI must state **Manual/external research required** and allow the operator to attach additional source URLs through the controlled `research.js` fetch boundary before choosing a publication route.

`SKIP` records no queue mutation unless the human explicitly chooses **Skip source**.

---

## End-to-End Flow

```text
Refresh sources / existing research cycle
        |
        v
AUTHORITATIVE SOURCE SNAPSHOTS
X Latest / X Momentum / GitHub Trending / HN Top Stories
        |
        +--> append source observations for deltas
        |
        v
EDITORIAL CONTEXT BUILDER
        |
        +--> unresolved/handled state
        +--> active conversations
        +--> Reach/Follow/Conversation/Relationship potentials
        +--> recent owned posts
        +--> profile-proof coverage
        +--> account health
        +--> accepted learned adjustments
        +--> recent measured outcomes
        |
        v
AI SCAN PASS
        |
        +--> cluster related source items
        +--> identify claims/questions that require research
        |
        +--> code computes storyPreResearchFit and selects top five
        |
        v
CONTROLLED RESEARCH
        |
        +--> exact source/thread
        +--> GitHub metadata/README/release when applicable
        +--> linked primary page/article
        +--> structured evidence with provenance
        |
        v
AI EDITORIAL PASS
        |
        +--> objective
        +--> PREPARE / RESEARCH_MORE / SKIP
        +--> Original / Quote / Thread / Reply / Repost
        +--> thesis
        +--> why now
        +--> why this format
        +--> desired reader outcome
        +--> transparent potentials / authority value
        +--> profile-proof effect
        +--> algorithm evidence tags
        +--> empirical/learned context
        +--> risks / missing evidence
        |
        v
HUMAN SELECTS OR OVERRIDES
        |
        +--> Draft text route / open conversation / prepare repost
        +--> Open research + attach external source
        +--> Choose another route
        +--> Dismiss
        |
        v
EXISTING WRITER -> GATES -> HUMAN APPROVAL -> SCHEDULER -> PUBLISH
        |
        v
PHASE 4 MEASUREMENTS + RELATIONSHIP/FOLLOWER OUTCOMES
        |
        v
PHASE 5 LEARNED RULES
```

---

## File Responsibility Map

### Create

- `source_refresh.js` — one non-HTTP source-refresh owner for X Latest, X Momentum, GitHub Trending, and HN Top Stories; normalizes legacy source names, ranks/upserts candidates, persists ordered snapshots, and returns per-source refresh results.
- `research_topics.js` — machine-readable Research Agenda topic IDs, tiers, and deterministic anchor/tag matching shared by editorial planning and ProfileProofCoverage.
- `editorial.js` — editorial objectives, context assembly, shortlist bounds, authority-value calculation, story/recommendation validation, orchestration, recommendation selection semantics.
- `editorial_runtime.js` — two structured provider-independent calls through `runStructuredAI()`: current-signal scan and final editorial recommendation. No browsing or mutation.
- `research.js` — controlled source enrichment, SSRF-safe generic-page fetch boundary, evidence normalization, and manual/external research-source attachment for shortlisted stories.
- `profile_proof.js` — one reusable ProfileProofCoverage owner for editorial planning and writer packets.
- `docs/EDITORIAL_RECOMMENDATION_PROMPT.md` — canonical AI editorial contract: niche, objectives, algorithm-evidence discipline, scan/final-pass rules, structured output semantics.

### Modify

- `store.js` — source-snapshot persistence, strict published-main-feed reads for profile proof, source-observation history, editorial runs/recommendations, research evidence, append-only editorial-selection history, and queue-source associations.
- `tech_news.js` — expose normalized upstream source data/metrics consumed by `source_refresh.js`; keep source-specific fetching/parsing ownership here.
- `opportunity.js` — consume current GitHub `starsToday`/rank metrics instead of relying on the retired legacy `starsPerDay` field for current GitHub Trending candidates.
- `pipeline.js` — accept a human-selected editorial recommendation and route it through existing workflow contracts without granting approval.
- `drafting.js` — consume real ProfileProofCoverage and structured research evidence in writer packets.
- `writer_runtime.js` — keep the existing no-browse writer boundary and shared AI runtime from `AI_RUNTIME_PROVIDER_LAYER.md`; tighten evidence-ID output semantics if needed by the new research evidence contract.
- `web_api.js` — editorial read/refresh/select/dismiss/research-source endpoints and thin compatibility wrappers over `source_refresh.js`; no source-refresh implementation ownership.
- `automation.js` — use `source_refresh.js` for the normal research cycle and optionally refresh the editorial plan afterward; never select or publish a recommendation automatically.
- `agent_bridge.js` — inspect/refresh/select editorial plans through domain functions; no raw SQLite mutation commands.
- `ui/src/api/client.ts` — editorial plan types, queries, and mutations.
- `ui/src/features/today/Today.tsx` — primary Editorial Plan surface above workflow attention items.
- `ui/src/features/discover/Discover.tsx` — show whether a live source participates in a current editorial recommendation; relabel the existing per-source rule route so it is not confused with Phase-6 AI editorial planning.
- `docs/plans/README.md` — add Phase 6 to the authoritative sequence after Phase 5.
- `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md` — after implementation, document the current editorial layer and preserve existing network-first objective.
- `docs/AGENT_WORKFLOW.md` — after implementation, document editorial bridge commands and evidence flow.
- `README.md` — after implementation, document the operator-visible Today -> Editorial Plan -> Draft workflow.

---

## Persistence Model

### 1. `source_observations`

Purpose: retain observed external-source state over time so the product can distinguish current level from acceleration/deceleration.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
candidate_key TEXT NOT NULL,
snapshot_kind TEXT NOT NULL,
observed_at INTEGER NOT NULL,
rank INTEGER,
metrics_json TEXT NOT NULL DEFAULT '{}',
FOREIGN KEY(candidate_key) REFERENCES candidates(key),
UNIQUE(candidate_key, snapshot_kind, observed_at)
```

Allowed `snapshot_kind`:

```text
x_latest
x_momentum
github_trending
hn_top
```

Derived deltas stay computed, not persisted as new truth:

```text
X: views / likes / reposts / replies delta and delta-per-hour
GitHub: rank movement, total-star delta, stars-today delta
HN: rank movement, points delta, comments delta
```

If only one observation exists, return `null` deltas rather than `0`.

### 2. `editorial_runs`

Purpose: preserve what context the system used for one editorial decision cycle.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
objective TEXT NOT NULL,
source_snapshot_json TEXT NOT NULL DEFAULT '{}',
context_json TEXT NOT NULL DEFAULT '{}',
scan_json TEXT NOT NULL DEFAULT '{}',
status TEXT NOT NULL DEFAULT 'building',
error TEXT NOT NULL DEFAULT '',
created_at INTEGER NOT NULL,
completed_at INTEGER
```

Allowed status:

```text
building
complete
failed
```

The stored context should contain references/summaries, not copies of large fetched page bodies.

### 3. `research_evidence`

Purpose: make evidence inspectable and reusable by the final editorial pass and writer.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
editorial_run_id INTEGER NOT NULL,
story_key TEXT NOT NULL,
candidate_key TEXT,
claim TEXT NOT NULL DEFAULT '',
claim_type TEXT NOT NULL,
status TEXT NOT NULL,
source_kind TEXT NOT NULL,
source_family TEXT NOT NULL,
requested_url TEXT NOT NULL,
resolved_url TEXT NOT NULL,
title TEXT NOT NULL DEFAULT '',
summary TEXT NOT NULL DEFAULT '',
observed_at INTEGER NOT NULL,
metadata_json TEXT NOT NULL DEFAULT '{}',
FOREIGN KEY(editorial_run_id) REFERENCES editorial_runs(id)
```

Allowed `claim_type`:

```text
announcement
capability
implementation
benchmark
performance
reliability
security
pricing
compatibility
other
```

Allowed evidence status:

```text
primary_supported
source_claim
contradicted
unresolved
```

`primary_supported` means the cited primary artifact supports the exact stored claim **within that claim type**. For example, vendor benchmark methodology may support "the vendor reports benchmark X under methodology Y"; it does not establish general real-world performance. `source_claim` means the evidence establishes only that the source/author made the claim.

`source_family` prevents row-count inflation from being mistaken for independent support. By default, all artifacts reached from one candidate share that candidate's family. GitHub README/release/API rows for the same repository share `github:<owner>/<repo>`. Manually attached external sources use a normalized host/source family. Evidence depth counts distinct supporting families, not README/release/page row count.

### 4. `editorial_recommendations`

Purpose: retain each advisory recommendation and the human decision around it.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
editorial_run_id INTEGER NOT NULL,
story_key TEXT NOT NULL,
rank INTEGER NOT NULL,
decision TEXT NOT NULL,
pipeline TEXT NOT NULL DEFAULT '',
objective TEXT NOT NULL,
title TEXT NOT NULL,
thesis TEXT NOT NULL DEFAULT '',
why_now TEXT NOT NULL DEFAULT '',
why_format TEXT NOT NULL DEFAULT '',
desired_reader_outcome TEXT NOT NULL DEFAULT '',
candidate_keys_json TEXT NOT NULL DEFAULT '[]',
potentials_json TEXT NOT NULL DEFAULT '{}',
authority_json TEXT NOT NULL DEFAULT '{}',
profile_proof_json TEXT NOT NULL DEFAULT '{}',
evidence_ids_json TEXT NOT NULL DEFAULT '[]',
algorithm_evidence_json TEXT NOT NULL DEFAULT '[]',
learned_context_json TEXT NOT NULL DEFAULT '{}',
risks_json TEXT NOT NULL DEFAULT '[]',
alternatives_json TEXT NOT NULL DEFAULT '[]',
research_questions_json TEXT NOT NULL DEFAULT '[]',
status TEXT NOT NULL DEFAULT 'suggested',
selected_at INTEGER,
dismissed_at INTEGER,
created_at INTEGER NOT NULL,
FOREIGN KEY(editorial_run_id) REFERENCES editorial_runs(id)
```

Allowed human-decision status:

```text
suggested
selected
dismissed
superseded
```

Generating a newer editorial run may mark older still-`suggested` recommendations `superseded`; never rewrite selected/dismissed history.

### 5. `queue_sources`

Purpose: let one drafted/published item be based on more than one discovered source without pretending one URL was the entire origin.

```sql
queue_item_id INTEGER NOT NULL,
candidate_key TEXT NOT NULL,
role TEXT NOT NULL,
PRIMARY KEY(queue_item_id, candidate_key),
FOREIGN KEY(queue_item_id) REFERENCES queue_items(id),
FOREIGN KEY(candidate_key) REFERENCES candidates(key)
```

Allowed `role`:

```text
primary
supporting
```

### 6. `editorial_selections`

Purpose: preserve every human selection without overwriting queue provenance when the same real source/queue item is considered again.

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
editorial_recommendation_id INTEGER NOT NULL UNIQUE,
queue_item_id INTEGER NOT NULL,
selected_pipeline TEXT NOT NULL,
selected_at INTEGER NOT NULL,
FOREIGN KEY(editorial_recommendation_id) REFERENCES editorial_recommendations(id),
FOREIGN KEY(queue_item_id) REFERENCES queue_items(id)
```

Do **not** add a mutable `queue_items.editorial_recommendation_id` as the sole provenance link. The latest `editorial_selections.selected_at` for a queue item is the recommendation in force at publication; older selection rows remain inspectable. A repeated call selecting the same recommendation is idempotent because `editorial_recommendation_id` is unique.

For every selected multi-source Original/Thread recommendation, and for a single-source Original/Thread whose real candidate is no longer routable, create the synthetic candidate with recommendation-specific identity:

```text
key    = editorial:<editorialRecommendationId>
source = editorial
```

Reusing `editorial:<id>` is allowed only for idempotent re-selection of that exact recommendation. Never reuse a synthetic candidate across recommendations, even when the story/source set is the same. Link every real source through `queue_sources` and exclude `source = 'editorial'` from external-source Discover tabs.

For Quote/Reply/Repost, keep the real X candidate as the primary queue candidate and link supporting research candidates as `supporting`. `editorial_selections` preserves recommendation history if more than one advisory recommendation is ever selected against that queue item.

---

## Editorial AI Contracts

### Scan pass

The scan pass receives bounded current context and returns at most eight story clusters.

Input caps before de-duplication:

```text
X Latest             12
X Momentum           12
GitHub Trending      10
HN Top Stories       10
active/follow-up conversation items 8
```

Maximum packet candidate count after de-duplication: 52.

Always include:

- source snapshot timestamps;
- candidate keys;
- exact source title/text available in the candidate record;
- normalized source metrics;
- source-observation deltas when available;
- niche tags/matches;
- existing handled/draft/workflow state;
- opportunity potentials;
- relationship context for X authors when available.

The scan output for each story:

```json
{
  "storyKey": "derived after validation from sorted candidate keys",
  "title": "short human label",
  "candidateKeys": [],
  "summary": "what appears to be happening",
  "whyCurrent": "why it is current now",
  "researchQuestions": [],
  "initialFormatCandidates": ["original", "quote", "thread", "reply", "repost", "research"]
}
```

Validate that every returned candidate key existed in the input. Derive the persisted `storyKey` in code from the validated sorted candidate keys rather than trusting an AI-generated identifier. After clustering, derive the story's Research Agenda topic in code through `research_topics.js`; the scan model does not assign the numeric tier.

### Final editorial pass

After validating the scan clusters, code ranks them with `storyPreResearchFit` from the scoring contract and sends the top five to controlled research. Then run one final structured AI call that returns at most five recommendations.

The final output for each recommendation must include:

```json
{
  "decision": "PREPARE | RESEARCH_MORE | SKIP",
  "pipeline": "original | quote | thread | reply | repost | research | null",
  "storyKey": "...",
  "targetCandidateKey": null,
  "title": "...",
  "thesis": "one defensible editorial thesis, not final post copy",
  "whyNow": "...",
  "whyThisFormat": "...",
  "desiredReaderOutcome": "...",
  "angleClass": "evidence_backed_interpretation",
  "potentialInterpretation": {
    "reach": "...",
    "follow": "...",
    "conversation": "...",
    "relationship": "...",
    "authority": "..."
  },
  "researchQuestions": [],
  "evidenceIds": [],
  "algorithmMechanisms": [],
  "empiricalContext": [],
  "riskFlags": [],
  "alternatives": []
}
```

Code, not the model, supplies numeric Reach/Follow/Conversation/Relationship/Authority values and the objective-fit calculation. The only numeric input derived from a model field is the bounded `angleClass` mapping defined above, after code validates its evidence requirements. The AI explains implications rather than supplying numbers.

For Quote/Reply/Repost, `targetCandidateKey` must reference one supplied X candidate in the story. For Original/Thread, code chooses the deterministic primary candidate described in the scoring contract below and ignores model attempts to substitute another numeric owner.

The model may only reference candidate keys, evidence IDs, and algorithm-mechanism tags supplied in its packet.

---

## Story and Recommendation Scoring Contract

Phase 1 scores are candidate-level. Phase 6 must not average or mix components from different candidates into a fake story score.

### Pre-research story ranking

After the scan pass returns validated clusters, code computes a deterministic pre-research score for each story:

1. For each member candidate, read its existing Reach/Follow/Conversation/Relationship potentials.
2. Compute pre-research Authority using only code-known components: ProfileProof gap + Research Agenda value. Evidence depth and novel-angle headroom are `0` before research/final reasoning.
3. Apply the selected objective weights to that candidate's four potentials plus the story's pre-research Authority.
4. `storyPreResearchFit` is the **maximum complete candidate fit** among the story members. Do not take Reach from one candidate, Follow from another, and Relationship from a third.
5. Choose `primaryCandidateKey` as the candidate that produced that maximum. Break ties by more recent source observation, then candidate key.

Use `storyPreResearchFit` to choose the five stories sent to controlled research. Tie stories by:

```text
more distinct current snapshot kinds
newer latest observation
storyKey lexical order
```

Distinct-source count is a tie-breaker, not a hidden numeric bonus.

### Final recommendation potentials

After research and the final AI pass, code supplies recommendation potentials from one real candidate:

- Original/Thread: use the deterministic `primaryCandidateKey` selected above; set Relationship Potential to `0` because the publication is not itself a direct relationship action. Supporting sources affect evidence/Authority, not the four Phase-1 potentials.
- Quote/Reply/Repost: use the validated `targetCandidateKey` returned by the model. It must be a real X candidate in the story; use that candidate's four potentials unchanged.
- `RESEARCH_MORE` and `SKIP`: retain the story's primary candidate potentials for explanation only; they do not create publishable work.

Recompute Authority after research using the code-owned ProfileProof tier, machine-readable Research Agenda tier, distinct-family evidence depth, and validated `angleClass`. Then compute final `objectiveFit` from the five visible components.

### Ordering

Code sorts recommendations by `objectiveFit DESC`, then `storyPreResearchFit DESC`, then `storyKey`. The final AI pass cannot demote or reorder a recommendation.

Evidence insufficiency, handled-source duplication, invalid target candidate, or account-health constraints are **validation/decision semantics**, not invisible ranking penalties. A recommendation that depends on a material unresolved claim must narrow the thesis, become `RESEARCH_MORE`, or become `SKIP`; it cannot remain `PREPARE` and merely receive a model-authored demotion.

---

## Algorithm-Evidence Packet

Do not pass arbitrary creator folklore to the editorial model.

The packet should expose the current usable mechanisms as structured entries, each with:

```text
tag
evidenceClass
ledgerSection
operationalImplication
```

Use stable editorial tags only through an explicit mapping to the IDs currently produced by `store.js:listAlgorithmEvidenceEntries()`:

| Editorial tag | Ledger entry ID |
| --- | --- |
| `semantic_retrieval` | `semantic_topic_representations_are_part_of_retrieval_ranking` |
| `in_network_thunder` | `thunder_is_an_in_network_source` |
| `out_of_network_retrieval` | `out_of_network_retrieval_exists_separately` |
| `multi_action_prediction` | `ranking_combines_predicted_actions_not_raw_observed_counts` |
| `author_diversity` | `author_diversity_attenuation_exists` |
| `mutual_follow_reply_boost` | `bidirectional_mutual_follow_original_post_reply_boost_exists` |
| `freshness_filtering` | `candidate_age_filtering_exists_in_the_current_pipeline` |
| `ranking_vs_visibility` | `ranking_and_visibility_filtering_are_separate_layers` |

`editorial.js` must resolve this table against `listAlgorithmEvidenceEntries()` at runtime. If a mapped ledger ID is absent, `RETIRED`, or materially changed, the tag is unavailable or surfaced for review according to the current ledger status; do not create a second algorithm-evidence taxonomy disconnected from the ledger.

The editorial contract must enforce:

- `CODE_BACKED` mechanisms may support structural reasoning.
- `OFFICIAL_PRODUCT_OR_POLICY` may support the documented product/policy behavior only.
- `EMPIRICAL_VARIABLE` items may appear only as hypotheses/account-specific learned context.
- `RETIRED` items must not support a recommendation.
- Numeric X parameter defaults may be shown in advanced evidence detail when relevant, but must not be converted into raw creator-side action arithmetic.

---

## Controlled Research Contract

`research.js` owns fetching. It does not decide what to publish.

### GitHub story enrichment

For a shortlisted GitHub repository, collect:

```text
GitHub repository API metadata
README from default branch when available
latest release metadata when available
repository homepage URL when present
```

Record separate evidence rows for distinct claims. Do not infer performance/reliability from stars or Trending rank.

### Hacker News story enrichment

Collect:

```text
exact HN item metadata
linked article/page when fetchable
HN discussion URL
```

HN comments are conversation/context evidence, not independent verification of a technical claim.

### X story enrichment

Collect:

```text
exact X post
thread/quoted-post context when material and available through the authenticated X read path
explicit URLs contained in the source
```

If a linked URL is GitHub, reuse GitHub enrichment. For a normal HTTP page, use the generic-page fetch boundary below and retain title, final resolved URL, and a bounded readable text excerpt/summary with provenance.

A company/maintainer X announcement normally produces `source_claim` evidence for **that the author announced a claim**. It does not independently establish benchmark, reliability, security, or performance claims unless a primary artifact supports the exact narrower claim.

### Generic-page URL fetch boundary

All untrusted HTTP(S) destinations, including URLs extracted from X/source text and operator-attached research URLs, must pass through one `research.js` helper before any request is made.

`safeFetchResearchPage(url)` must:

- accept only `http:` and `https:` URLs and reject embedded credentials;
- resolve the destination hostname and reject loopback, RFC1918/private, link-local, carrier-grade NAT, multicast, unspecified, IPv6 unique-local, IPv6 link-local, and known cloud-metadata destinations;
- use Node `http.request`/`https.request` with a guarded `lookup` callback (or an equivalent existing connection hook) so the address actually used for the connection is one of the validated public addresses; a separate preflight DNS lookup followed by ordinary `fetch` is insufficient;
- do not auto-follow redirects; handle 3xx `Location` values explicitly, allow at most 3 redirects, and repeat the full scheme/hostname/address validation for every redirect target;
- enforce a 10-second total request timeout;
- read at most 1 MiB of response body before aborting;
- accept only bounded text-like types needed by this phase: `text/html`, `text/plain`, `application/json`, `application/xhtml+xml`, `application/xml`, and `text/xml`;
- reject other content types rather than handing arbitrary binary data to the model;
- persist both `requested_url` and the final `resolved_url` on the evidence row;
- return a structured failure reason for rejected/timeout/oversize/unsupported responses without retrying through another network path.

Dedicated GitHub/HN/X owners may call their fixed trusted endpoints directly. Any destination derived from untrusted content still goes through the applicable validated owner/path before it can trigger a request.

### Manual/external research path

`RESEARCH_MORE` means the controlled automatic path was insufficient. It is not a claim that another hidden search is running.

The recommendation must persist concrete `researchQuestions`. In the `research` workflow, show those questions and allow the operator to provide an additional source URL. `attachEditorialResearchSource(recommendationId, { url, claim })` sends that URL through `safeFetchResearchPage()`, appends evidence to the same story, and leaves the queue in `researching` until the human chooses a publication route. The operator may do the broader search externally; Phase 6 only validates/attaches the source provided.

### No general web-search dependency in the initial phase

Do not introduce a search-engine API solely for Phase 6. If the controlled source/linked-primary path cannot establish enough evidence, preserve that gap and recommend `RESEARCH_MORE`.

A later plan may add a separate searchable research provider if the product needs broader independent corroboration.

---

## ProfileProofCoverage Contract

`profile_proof.js` derives coverage only from `store.js:listPublishedMainFeedContent()`. It must not infer expertise from approved/scheduled work, drafts, bookmarks, replies, or repost-only actions.

Inputs:

```text
topic / research-agenda topic
semantic anchors
recent published main-feed content
publication timestamp
```

Output:

```json
{
  "topic": "agent memory",
  "coverage": "none | weak | medium | strong",
  "supportingPostIds": [],
  "reason": "..."
}
```

Starting coverage rules over the most recent 30 published main-feed items:

```text
none   = 0 matching owned posts
weak   = 1 matching owned post
medium = 2-3 matching owned posts
strong = 4+ matching owned posts
```

`supportingPostIds` contains actual published tweet IDs from the strict published-content owner, never draft IDs or candidate IDs.

A match requires at least one shared normalized topic/semantic anchor, not only a generic `AI`/`tech` token.

Coverage is editorial context, not a hard publication gate. A `strong` topic can still deserve a new post when the new information object is materially different. A `none` topic does not justify filler.

Use the same function from `editorial.js` and `buildWriterPacket()` so Today and the writer cannot disagree about profile proof.

---

## Source Momentum Contract

The product should report source-specific movement instead of inventing one cross-platform "trending score".

Examples:

```text
GitHub
#11 -> #5 -> #2
+1,240 stars since previous observation
stars today 580 -> 803

HN
#17 -> #8
+63 points
+21 comments

X
views 12,400 -> 31,800 in 47m
replies 14 -> 38
reposts 29 -> 81
```

Show the observation interval with every rate/delta. If source metrics are missing or changed semantics, return `null` and explain the unavailable component.

Keep existing `ReachPotential` as an account-internal editorial heuristic. Do not rename source deltas to X momentum unless they come from the X Momentum source view.

---

## Source Refresh Contract

Phase 6 must not import HTTP-layer `collectResearch()` and must not create a third source-fetch implementation. `source_refresh.js` is the one orchestration owner above the source-specific fetchers in `tech_news.js`.

Canonical source kinds:

```text
x_latest
x_momentum
github_trending
hn_top
```

Compatibility mapping from current names:

```text
x       -> x_latest
viral   -> x_momentum
github  -> github_trending
hn      -> hn_top
all     -> all four canonical kinds
```

`source_refresh.js` exposes:

```text
normalizeSourceKind(input)
refreshSourceSnapshot(kind)
refreshAllSourceSnapshots()
```

Each successful refresh performs the existing source-specific fetch, ranking/personalization, candidate upsert, and ordered snapshot persistence through store helpers. After Task 2 adds observation persistence, the same owner also appends source observations. It returns `{ kind, fetchedAt, candidates, error }`. Partial failure remains per-source.

`web_api.js` keeps any existing request names as compatibility input only and delegates to this owner. `automation.js` replaces its independent `refreshResearch()` fetch/rank/upsert implementation with this owner. `editorial.js` may request a refresh only through this owner.

For existing `app_state` data, `getDiscoverSnapshot(canonicalKind)` must read the current legacy key when a canonical key is absent. The first successful canonical refresh writes the canonical key. Do not lose the current persisted snapshot merely because names become explicit.

---

## Task 1: Create the shared source-refresh owner and canonical snapshot contract

**Files:**
- Create: `source_refresh.js`
- Modify: `store.js`
- Modify: `web_api.js`
- Modify: `automation.js`

**Interfaces:**
- Consumes: existing source-specific fetchers/rankers in `tech_news.js`, preference state, candidate persistence.
- Produces: `normalizeSourceKind(input)`, `refreshSourceSnapshot(kind)`, `refreshAllSourceSnapshots()`, `saveDiscoverSnapshot(kind, candidates, fetchedAt)`, and `getDiscoverSnapshot(kind)`.

**Steps:**
- [ ] Move the current `discover_snapshot:*` app-state serialization out of `web_api.js` into exported `store.js` helpers using the canonical/legacy mapping above.
- [ ] Add `source_refresh.js` and move fetch/rank/personalize/upsert/snapshot orchestration from `web_api.js:collectResearch()` and `automation.js:refreshResearch()` behind that owner.
- [ ] Keep `tech_news.js` responsible for the source-specific upstream reads; do not move X/GitHub/HN parsing into `source_refresh.js`.
- [ ] Preserve current legacy snapshot data through canonical read fallback; write canonical snapshot keys on the next successful refresh.
- [ ] Keep existing web refresh request names as compatibility aliases that delegate to `normalizeSourceKind()`.
- [ ] Make the automation research cycle call `refreshAllSourceSnapshots()` rather than maintaining its current independent fetch/rank/upsert path.
- [ ] Return snapshot kind, fetched timestamp, ordered candidate list, and per-source error without re-ranking the stored source order.

**Acceptance criteria:**
- Discover, automation, and the future editorial layer refresh/read the same persisted source snapshot through one non-HTTP owner.
- No source tab regresses to querying the historical candidate backlog as if it were a live source.

---

## Task 2: Persist source observations and expose source-specific deltas

**Files:**
- Modify: `store.js`
- Modify: `tech_news.js`
- Modify: `source_refresh.js`

**Interfaces:**
- Consumes: each successful canonical snapshot written by `source_refresh.js`.
- Produces: observation history and `getSourceMomentum(candidateKey, snapshotKind)`.

**Steps:**
- [ ] Add `source_observations` and indexes by `(snapshot_kind, observed_at)` and `(candidate_key, observed_at)`.
- [ ] On successful snapshot persistence, append one observation per candidate with source-native rank/metrics.
- [ ] Normalize current GitHub Trending fields to `rank`, `stars`, `starsToday`, `forks`, `language`; retain legacy GitHub fields only for historical candidates.
- [ ] Normalize HN to `rank`, `points`, `comments`, `by`.
- [ ] Normalize X observation metrics to views/likes/reposts/replies plus source timestamp when present.
- [ ] Derive the most recent prior-observation delta and interval in read code. Never write a fabricated zero when no prior observation exists.

**Acceptance criteria:**
- A source card/editorial packet can state whether a currently observed item moved in rank or engagement since the previous refresh, with the exact interval.

---

## Task 3: Correct current opportunity scoring for authoritative source metrics

**Files:**
- Modify: `opportunity.js`

**Interfaces:**
- Consumes: current candidate metrics from Phase-6 source snapshots.
- Produces: existing Reach/Follow/Conversation/Relationship potential contract with correct current inputs.

**Steps:**
- [ ] For current GitHub Trending candidates, calculate GitHub traction from total stars plus the real `starsToday` field; use `starsPerDay` only for `github_legacy` candidates.
- [ ] Preserve source rank/momentum as explanation data rather than calling it an X/Phoenix score.
- [ ] Keep accepted Phase-5 learned adjustments applied after transparent base calculations.

**Acceptance criteria:**
- Current GitHub Trending recommendations no longer depend on the retired "stars/day since creation" approximation.

---

## Task 4: Implement the Research Agenda taxonomy and one strict ProfileProofCoverage owner

**Files:**
- Create: `research_topics.js`
- Create: `profile_proof.js`
- Modify: `store.js`
- Modify: `drafting.js`
- Modify: `web_api.js`

**Interfaces:**
- Consumes: actual published owned main-feed items plus topic/semantic anchors.
- Produces: machine-readable Research Agenda topic/tier classification, `listPublishedMainFeedContent()`, and `{ topic, coverage, supportingPostIds, reason }`.

**Steps:**
- [ ] Encode the 12 canonical Research Agenda topic IDs/tiers listed in the Authority contract with deterministic anchor/tag matching; docs remain the explanatory source, code becomes the runtime taxonomy.
- [ ] Add `store.js:listPublishedMainFeedContent({ limit = 30 })` without changing `listRecentPublishedContent()`.
- [ ] Treat a current queue item as profile proof only when it is main-feed Original/Quote/Thread, `status = 'published'`, and has an actual published tweet ID/output ID. Include legacy rows only when `draft.status = 'published'` and a real `published_tweet_id` exists. Exclude replies, reposts, approved-only, scheduled-only, drafts, and bookmarks.
- [ ] Implement the documented `none/weak/medium/strong` coverage rules over the latest 30 rows from that strict owner.
- [ ] Exclude generic terms that do not establish topic proof by themselves.
- [ ] Use the owner when building the normal writer packet so `profileProof` is no longer left empty in the default web generation path.
- [ ] Return the same coverage object and research-topic classification to the editorial context builder in Task 6.

**Acceptance criteria:**
- The writer and editorial recommendation for the same topic display the same ProfileProofCoverage and supporting owned posts.

---

## Task 5: Add editorial persistence and multi-source workflow linkage

**Files:**
- Modify: `store.js`

**Interfaces:**
- Consumes: editorial run context, scan output, research evidence, final structured recommendations, and selected queue items.
- Produces: CRUD/read helpers for `editorial_runs`, `research_evidence`, `editorial_recommendations`, `queue_sources`, and append-only `editorial_selections`.

**Steps:**
- [ ] Add the persistence structures defined above; do not add a mutable `queue_items.editorial_recommendation_id` as the only selection history.
- [ ] Add store reads for latest complete run by objective, recommendation detail by ID, and latest selection for a queue item.
- [ ] Add idempotent recommendation selection/dismissal transitions; never change a selected/dismissed historical recommendation during refresh.
- [ ] Add append-only `editorial_selections` writes keyed uniquely by recommendation ID.
- [ ] Add queue-source link helpers with one `primary` source and zero-or-more `supporting` sources.
- [ ] Add an `editorial` candidate constructor that requires `editorial:<recommendationId>` identity for selected multi-source Original/Thread work; exclude this source from live Discover source tabs.

**Acceptance criteria:**
- A selected recommendation can be traced from Today -> queue item -> draft -> publication -> every real source that informed it.

---

## Task 6: Build the deterministic editorial context

**Files:**
- Create: `editorial.js`

**Interfaces:**
- Consumes: source snapshots/observations, queue/actions, `scoreOpportunity()`, relationship profiles, active Engage Next items, ProfileProofCoverage, account health, recent published content, performance/measurement summaries, accepted learned rules.
- Produces: `buildEditorialContext({ objective, now })` and bounded scan input.

**Steps:**
- [ ] Define the five objective profiles and transparent weights in one exported constant.
- [ ] Read the current authoritative source snapshots without refreshing them implicitly.
- [ ] Build the bounded candidate input using the scan caps defined above.
- [ ] Mark each candidate as unresolved, already handled, draft-in-progress, research, on-hold, or skipped using current workflow/action history.
- [ ] Include active conversation/follow-up opportunities ahead of comparable cold reply opportunities.
- [ ] Add source-specific momentum deltas from Task 2.
- [ ] Add current four-dimensional opportunity scores and base-vs-learned explanation.
- [ ] Classify candidates/stories through `research_topics.js`; do not let the model invent the Research Agenda tier.
- [ ] Attach ProfileProofCoverage from the strict published-content owner.
- [ ] Compute only the code-known pre-research Authority components here; evidence depth and novel-angle headroom remain zero until Task 9.
- [ ] Include current account-health state and warnings.
- [ ] Include recent owned posts and approved/scheduled main-feed work so AI can detect duplication/self-cannibalization context, while leaving final timing to `scheduler.js`.
- [ ] Include current source snapshot timestamps and any source refresh errors/staleness information.

**Acceptance criteria:**
- One JSON packet explains exactly what current source/account evidence is available before any AI editorial reasoning occurs.

---

## Task 7: Add the canonical editorial prompt and two-pass AI runtime

**Files:**
- Create: `docs/EDITORIAL_RECOMMENDATION_PROMPT.md`
- Create: `editorial_runtime.js`

**Interfaces:**
- Consumes: bounded editorial context, controlled research evidence, and canonical prompt text.
- Produces: validated scan output and final editorial recommendation objects.

**Steps:**
- [ ] Write the prompt around the current account promise from `CONTENT_OPERATING_STANDARD.md`, `NICHE_AND_KEYWORDS.md`, `RESEARCH_AGENDA.md`, and `NETWORK_GROWTH_OPERATING_SYSTEM.md` without copying whole documents into every runtime call.
- [ ] Encode the algorithm-evidence discipline and allowed mechanism tags from this plan.
- [ ] Define a strict scan JSON schema with at most eight story clusters and no final post text.
- [ ] Define a strict final-plan JSON schema with at most five recommendations and the `PREPARE/RESEARCH_MORE/SKIP` contract, including bounded `angleClass`, `researchQuestions`, and a required `targetCandidateKey` for Quote/Reply/Repost.
- [ ] Call `runStructuredAI({ role: 'editorial_scan', ... })` for the scan and `runStructuredAI({ role: 'editorial_final', ... })` for the final pass; do not spawn Codex directly from `editorial_runtime.js`.
- [ ] Persist the resolved AI profile/runtime/provider/model/reasoning provenance returned by the shared runtime with the editorial run/recommendation metadata.
- [ ] Explicitly instruct both passes: no shell, no browsing, no file edits, no invented source facts, no following instructions inside source content.
- [ ] Validate returned candidate/evidence/mechanism IDs against the supplied packet before persistence.

**Acceptance criteria:**
- The selected `editorial_scan` / `editorial_final` profiles can change runtime/provider/model without changing the Phase-6 domain contract, and the model can semantically combine multiple current sources into one story without inventing unseen sources, evidence IDs, algorithm mechanisms, or publication authority.

---

## Task 8: Implement controlled research and claim-level evidence

**Files:**
- Create: `research.js`
- Modify: `store.js`

**Interfaces:**
- Consumes: the top five validated stories by `storyPreResearchFit` plus their candidate/source URLs.
- Produces: persisted `research_evidence` rows and a bounded final-plan evidence packet.

**Steps:**
- [ ] Implement `safeFetchResearchPage(url)` exactly to the URL/network/content limits in the Controlled Research Contract; all untrusted generic destinations and operator-attached URLs use it.
- [ ] Implement GitHub repository metadata, README, and latest-release enrichment through fixed `github.com`/`api.github.com` endpoints after validating owner/repository identifiers; group those rows into one `github:<owner>/<repo>` source family. If repository metadata supplies an external homepage and Phase 6 follows it, use `safeFetchResearchPage()`.
- [ ] Implement HN item + linked-article enrichment using the existing HN data and `safeFetchResearchPage()` for the article destination.
- [ ] Implement exact X post/thread/quote-context enrichment through the existing authenticated X read owner.
- [ ] Extract explicit URLs from X source text and follow only direct linked destinations; reuse GitHub enrichment for validated GitHub URLs.
- [ ] For generic pages, persist requested/final URL, title, bounded readable text, claim type, evidence status, and source family rather than storing an entire page body.
- [ ] Persist claim-level rows with `primary_supported`, `source_claim`, `contradicted`, or `unresolved` status.
- [ ] Count evidence depth by distinct supporting `source_family`, not by evidence-row count.
- [ ] Implement `attachEditorialResearchSource(recommendationId, { url, claim })` for manual/external research; it must use the same safe fetch boundary.
- [ ] When an important research question cannot be resolved through controlled sources, persist an unresolved row and preserve the question instead of guessing.

**Acceptance criteria:**
- A final recommendation can point to exact persisted evidence rows, distinguish an announcement claim from primary support, and cannot make the server fetch a rejected private/internal destination.

---

## Task 9: Generate and persist the final editorial plan

**Files:**
- Modify: `editorial.js`
- Use: `editorial_runtime.js`
- Use: `research.js`

**Interfaces:**
- Consumes: deterministic context, scan output, persisted evidence.
- Produces: one completed `editorial_run` and up to five `editorial_recommendations`.

**Steps:**
- [ ] Implement `refreshEditorialPlan({ objective, refreshSources = false, now })` as the orchestration owner.
- [ ] When `refreshSources = true`, call `source_refresh.js:refreshAllSourceSnapshots()` and record its per-source success/error rather than treating partial failure as total success.
- [ ] Run the scan pass, validate clusters, derive stable story keys, and persist scan context.
- [ ] Compute `storyPreResearchFit` exactly from the Story and Recommendation Scoring Contract and research the top five by that deterministic ordering.
- [ ] Run the final editorial pass and validate all IDs/enums, including `targetCandidateKey`, evidence IDs, algorithm tags, decision/pipeline compatibility, research questions, and bounded `angleClass`.
- [ ] Recompute final recommendation potentials/Authority/objective fit in code after evidence and validated angle class are known.
- [ ] Require a material unresolved claim to be narrowed, `RESEARCH_MORE`, or `SKIP`; do not keep it `PREPARE` through a hidden score penalty.
- [ ] Persist final recommendations strictly in code-owned objective-fit/tie-break order; the final AI pass has no reorder/demotion authority.
- [ ] Mark prior unselected suggestions for the same objective `superseded` only after the new run completes successfully.
- [ ] Allow an empty plan with a clear `no strong current action` explanation.

**Acceptance criteria:**
- Refreshing an editorial plan produces an auditable current recommendation set even when the correct recommendation is to publish nothing.

---

## Task 10: Route a human-selected recommendation into the existing workflow

**Files:**
- Modify: `editorial.js`
- Modify: `pipeline.js`
- Modify: `store.js`

**Interfaces:**
- Consumes: one `editorial_recommendations.id` plus an explicit human selection/route override.
- Produces: normal queue/draft/research state with editorial provenance; no approval.

**Steps:**
- [ ] Implement `selectEditorialRecommendation(id, { pipelineOverride = null })`.
- [ ] For Quote/Reply/Repost, require the validated real X `targetCandidateKey` and require that its current queue/action state is still routable. If it is already completed in a way the existing workflow cannot repeat, reject selection rather than manufacturing a synthetic quote/reply/repost target.
- [ ] For single-source Original/Thread, use the real source candidate only when its queue is still routable and the work is clearly based on that source.
- [ ] For multi-source Original/Thread, or a single-source Original/Thread whose real candidate is no longer routable, create/reuse only `editorial:<recommendationId>` for that exact recommendation and link all real sources via `queue_sources`.
- [ ] For `RESEARCH_MORE`, route a routable real source or `editorial:<recommendationId>` to the existing `research` pipeline without generating a draft. Persist/show the recommendation's `researchQuestions` and **Manual/external research required** state.
- [ ] Allow attached research evidence from Task 8 while the item remains `researching`; once the operator has enough evidence, an explicit route choice enters the normal Original/Quote/Thread/Reply workflow.
- [ ] Append one `editorial_selections` row containing recommendation ID, queue item ID, selected pipeline, and timestamp; never overwrite prior queue-selection provenance.
- [ ] Mark the recommendation `selected` and preserve any human pipeline override in the selection/queue state without rewriting the AI recommendation.
- [ ] Do not call approval, scheduler, send, repost-completion, or publication functions.

**Acceptance criteria:**
- Selecting Original/Quote/Thread/Reply creates ordinary editable work, selecting Repost enters the existing no-draft repost review flow, and selecting Research More creates an actionable research state with unresolved questions and attachable evidence. Every existing approval/publication boundary still applies.

---

## Task 11: Feed structured research evidence into the writer

**Files:**
- Modify: `drafting.js`
- Modify: `writer_runtime.js`
- Modify: `web_api.js`

**Interfaces:**
- Consumes: selected editorial recommendation, linked `research_evidence`, ProfileProofCoverage, existing candidate/relationship/recent-content context.
- Produces: writer packet with real evidence and evidence-reference semantics.

**Steps:**
- [ ] When a draft comes from an editorial recommendation, load its linked evidence rows into `buildWriterPacket({ evidence, profileProof })`.
- [ ] For manually routed/non-editorial drafts, preserve existing behavior while supplying ProfileProofCoverage from Task 4.
- [ ] Represent writer evidence items with stable IDs plus claim type/status/source family/requested+resolved URL/title/summary rather than free-form `verified ...` strings.
- [ ] Require `evidenceUsed` to contain supplied evidence IDs when the final text relies on a researched claim.
- [ ] Update evidence confirmation checks so an evidence ID resolves to a persisted eligible evidence row; stop treating the literal word `verified` in an AI-generated string as proof. A `source_claim` row cannot satisfy a stronger capability/benchmark/performance assertion than the row's stored claim.
- [ ] Keep human factuality/evidence confirmation as the final approval assertion where existing gates require it.

**Acceptance criteria:**
- Evidence shown as supporting a draft resolves to a real persisted evidence record with claim scope and provenance; the UI/writer never turns an AI-authored `verified` label into proof.

---

## Task 12: Add the Editorial Plan to Today

**Files:**
- Modify: `web_api.js`
- Modify: `ui/src/api/client.ts`
- Modify: `ui/src/features/today/Today.tsx`

**Interfaces:**
- Consumes: latest complete editorial run and existing Today workflow actions.
- Produces: objective selector, source freshness, ranked recommendations, details, and explicit actions.

**Steps:**
- [ ] Extend `/api/today` or add `/api/editorial` so Today can read the latest plan without triggering an expensive refresh on page load.
- [ ] Add **Goal** selector with `Qualified growth` as default.
- [ ] Add **Refresh sources & recommendations** as an explicit action. Show per-source last snapshot time and partial refresh errors.
- [ ] Place **AI Editorial Plan** above **Needs your attention**; the latter remains the concrete workflow inbox.
- [ ] For each recommendation show: decision/format, thesis, why now, why format, Reach/Follow/Conversation/Relationship, Authority Value, objective fit, profile-proof coverage, evidence state, and primary desired reader outcome.
- [ ] Put algorithm-mechanism tags, empirical context, learned adjustments, source list, alternatives, and risk flags under **Why this recommendation?**.
- [ ] Use contextual primary CTA: **Draft this** for Original/Quote/Thread, **Open conversation** for Reply, **Prepare repost** for Repost, **Open research** for `RESEARCH_MORE`, or no CTA for `SKIP` beyond **Dismiss**. Research More must show its unresolved questions and **Manual/external research required** copy plus an **Add source** action.
- [ ] Show **No strong main-feed post right now** as a valid successful plan state when applicable.
- [ ] Never describe the recommendation as guaranteed momentum, guaranteed followers, or a prediction of X's hidden rank score.

**Acceptance criteria:**
- A user can open Today and understand what the system recommends doing now, why it serves the selected goal, what evidence supports it, and what remains a hypothesis before choosing any action.

---

## Task 13: Make Discover source cards contextual to the editorial plan

**Files:**
- Modify: `web_api.js`
- Modify: `ui/src/api/client.ts`
- Modify: `ui/src/features/discover/Discover.tsx`

**Interfaces:**
- Consumes: latest source snapshot plus current editorial recommendation links.
- Produces: live-source cards that distinguish source truth from editorial recommendation state.

**Steps:**
- [ ] Replace the current generic `Suggested next step` wording for the old deterministic route with **Rule-based route** until an editorial recommendation exists for that source.
- [ ] When a candidate belongs to a current editorial story, show a contextual badge such as **In today's plan · Original** or **Research recommended**.
- [ ] Show source-native movement when available: rank change, metric delta, and observation interval.
- [ ] Keep source controls (`Draft`, `Bookmark`, `Skip`, `Open source`) independent from the AI plan; the user may ignore or override the plan.
- [ ] For handled sources that remain genuinely present in a live upstream snapshot, show handled history but do not offer duplicate primary actions as if the source were unresolved.

**Acceptance criteria:**
- Discover answers "what is happening at the source," while Today answers "what should we do about it." The two screens no longer present competing recommendation semantics.

---

## Task 14: Add API and agent entry points without new authority

**Files:**
- Modify: `web_api.js`
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: editorial/research domain functions.
- Produces: inspect/refresh/select/dismiss/attach-research-source operations for web and agent workflows.

**Steps:**
- [ ] Add read endpoint/command for latest plan by objective.
- [ ] Add explicit refresh endpoint/command with optional `refreshSources` flag.
- [ ] Add recommendation-detail read.
- [ ] Add explicit human/operator select and dismiss actions.
- [ ] Add explicit **Add research source** endpoint/command that accepts recommendation ID + URL + claim and delegates to `research.js:attachEditorialResearchSource()`; it does not search the web itself.
- [ ] Route all writes through `editorial.js`/`research.js`/`pipeline.js`; expose no raw editorial table writes.
- [ ] Return the selected queue/draft ID after selection so the operator can continue in the normal workflow.
- [ ] Do not add any command that approves, publishes, sends, or accepts learned rules as a side effect of editorial selection.

**Acceptance criteria:**
- Web and agent callers can use the same editorial contract and receive the same persisted recommendation/provenance state.

---

## Task 15: Tie selected recommendations to Phase-4 measurement and Phase-5 learning

**Files:**
- Modify: `store.js`
- Modify: `web_api.js`
- Modify: `learning.js` only if the existing learning-context matcher cannot read the new metadata without changes.

**Interfaces:**
- Consumes: the latest `editorial_selections` row in force for a published queue item plus existing publication measurements/relationship/follower outcomes.
- Produces: inspectable editorial-outcome context; no automatic strategy changes.

**Steps:**
- [ ] Include selection ID, recommendation ID, editorial objective, story key, recommended pipeline, selected pipeline, final published pipeline, objective-fit components, Authority Value components, ProfileProofCoverage, evidence state, and algorithm-mechanism tags in publication measurement metadata.
- [ ] Preserve human route overrides so later analysis can distinguish "AI suggested Quote, human chose Original" rather than rewriting recommendation history.
- [ ] Expose outcome summaries by editorial objective/recommended format/chosen format in Performance/Experiments only when sample data exists.
- [ ] Feed matching format/topic/objective context to the existing Phase-5 suggestion process without adding a new auto-learning path.
- [ ] Keep existing evidence thresholds and explicit human acceptance for any learned rule that later adjusts recommendations.

**Acceptance criteria:**
- The product can eventually answer whether its editorial recommendations produced qualified reach/follows/conversations, while one successful or failed post cannot silently rewrite strategy.

---

## Task 16: Optional editorial refresh after the existing research cycle

**Files:**
- Modify: `automation.js`

**Interfaces:**
- Consumes: the `refreshAllSourceSnapshots()` result already used by the automation research cycle.
- Produces: a newly persisted advisory editorial plan when configured; no queue selection or outbound action.

**Steps:**
- [ ] Add one explicit configuration flag for automatic editorial-plan recomputation after research; default it to `false`.
- [ ] When enabled, build a `qualified_growth` plan from the canonical snapshots just refreshed by `source_refresh.js`; do not fetch/rank/upsert sources again.
- [ ] Log recommendation count/plan ID only; do not select a recommendation.
- [ ] A failed editorial refresh must not fail the source research cycle or change existing queue state.

**Acceptance criteria:**
- The system may keep an advisory plan current in the background, but human selection remains the only path from recommendation to work.

---

## Task 17: Update current-state documentation after implementation

**Files:**
- Modify: `docs/plans/README.md`
- Modify: `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`
- Modify: `docs/AGENT_WORKFLOW.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: implemented Phase-6 symbols, UI labels, endpoints/commands, and persistence semantics.
- Produces: current documentation that matches actual behavior.

**Steps:**
- [ ] Mark Phase 6 implemented only after its actual runtime/UI is landed.
- [ ] Document the final loop as `live sources -> editorial plan -> controlled research -> human selection -> writer -> gates -> approval -> scheduler -> measure -> learn`.
- [ ] Document the difference between source snapshot, editorial recommendation, rule-based per-source route, queue state, and final human-selected pipeline.
- [ ] Document controlled research limits and the fact that editorial/writer AI does not independently browse.
- [ ] Document objective modes and state that objective-fit weights are internal editorial preferences, not X ranking weights.
- [ ] Document recommendation/route override provenance through measurement and learning.

**Acceptance criteria:**
- An engineer/operator can determine from repository docs what the recommendation system actually knows, what it merely infers, what the AI is allowed to do, and where the human boundary sits.

---

## Rollout Order

Implement in these reviewable slices:

Cross-cutting prerequisite: `AI_RUNTIME_PROVIDER_LAYER.md` Tasks 1-6 must exist before Phase-6 Task 7 wires `editorial_runtime.js`. Phase-6 deterministic source/research/persistence work may proceed before that runtime layer is complete.

```text
A. Source truth foundation
   Tasks 1-3

B. Account/editorial context foundation
   Tasks 4-6

C. AI scan + controlled research + final planner
   Tasks 7-9

D. Human selection into existing workflow + real writer evidence
   Tasks 10-11

E. Product surfaces
   Tasks 12-14

F. Outcome loop + optional background refresh + current docs
   Tasks 15-17
```

Do not begin UI work before the persisted editorial recommendation contract exists. Do not wire Phase-6 model calls through a private Codex subprocess; use the shared AI runtime/provider boundary. Do not wire final writer evidence before controlled evidence rows exist. Do not add measurement/learning integration before selection provenance is persisted.

---

## Example Operator Experience

```text
Today
Goal: Qualified growth

Sources
X Latest       updated 2m ago
X Momentum     updated 3m ago
GitHub Trending updated 1m ago
HN Top Stories updated 1m ago

AI Editorial Plan

1. ORIGINAL · Agent memory architecture
   Best qualified-growth opportunity

   Thesis
   OpenViking's interesting decision is treating agent context as
   durable structured state rather than another prompt-history layer.

   Why now
   GitHub Trending #2; source activity is still increasing; the topic
   matches a Tier-1 research area where owned profile proof is weak.

   Reach          72
   Follow         91
   Conversation   76
   Relationship   25
   Authority      92

   Evidence
   3 primary evidence items · sufficient for the stated thesis

   Algorithm context
   CODE_BACKED: semantic retrieval, OON retrieval, multi-action prediction
   EMPIRICAL: no timing claim used

   [Draft this] [Why this recommendation?] [Dismiss]

2. REPLY · @maintainer
   Relationship opportunity
   ...

3. RESEARCH MORE · new model claim
   Vendor claim exists; benchmark methodology is not established.
   [Research more]

No recommendation is published until the existing human approval path.
```

---

## Success Criteria

Phase 6 is complete when all of the following are true:

1. Today can build an advisory plan from current authoritative X/GitHub/HN snapshots plus active relationship/conversation state.
2. The plan can combine multiple source items into one story instead of treating every URL as an isolated post idea.
3. The system can recommend Original, Quote, Thread, Reply, Repost, Research More, Skip, or no main-feed action at all.
4. Every recommendation states the selected objective, current source context, format rationale, desired reader outcome, and transparent opportunity/authority inputs.
5. Algorithm-aware reasoning cites only allowed evidence-ledger mechanisms and keeps empirical variables distinct.
6. Controlled research produces persisted claim-level evidence with source URL/provenance/status.
7. The writer consumes actual evidence records and can no longer manufacture supporting-evidence status through free-form text.
8. ProfileProofCoverage is computed once and shared by Today and the writer.
9. Multi-source originals preserve all source provenance without forcing one external URL to pretend to be the whole origin.
10. Selecting an editorial recommendation creates ordinary workflow work but cannot approve, schedule, publish, send, or accept learned strategy.
11. Discover remains the source-truth surface; Today becomes the action/recommendation surface.
12. Published outcomes can be traced back to the AI recommendation and any human route override for later Phase-4/5 analysis.
13. A failed/empty source refresh or missing evidence is visible; the product never silently presents stale or unsupported context as current or primary-supported.
14. "Do nothing now" is a first-class successful recommendation when the available opportunities do not justify occupying the feed.
