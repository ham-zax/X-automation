# X Network Growth & Publishing System

Local Node.js human+AI operating system for `@ham_zax`. The current runtime discovers AI/developer signals, learns from saved posts, stores research in SQLite, maintains strategic relationship profiles/events, derives provenance-backed Account Health diagnostics, surfaces freshness-aware health-aware Engage Next opportunities, turns sources into scored drafts, measures fixed-window content/network outcomes, compares declared observational experiments, proposes evidence-backed learned strategy rules, and can publish approved queued drafts through authenticated HTTP GraphQL.

## Components

- `x_http.js` — validates the cookie session, discovers the live `CreateTweet` operation ID from X's current web bundle, and performs HTTP GraphQL writes.
- `post_thread.js` — dry-run, HTTP session check, HTTP thread publishing, or explicit `--browser` publishing.
- `strategy.js` — executable niche taxonomy, keyword lanes, classification, saved-preference ranking boost, and Direct/Quote/Repost/Reply/Ignore decision method.
- `audience.js` — authenticated follower/following sync with niche relevance scoring, legacy-crypto downranking, and non-destructive Relationship Intelligence refresh for observed relevant accounts.
- `relationship.js` — target classes, transparent TargetScore components, bounded reach modifier, event aggregation, and derived relationship stages.
- `tech_news.js` — X niche/viral discovery, bounded relationship-target timelines/responses, authenticated Under-the-Hood visibility observations, Hacker News, GitHub, ranking, and account-performance reads.
- `store.js` — built-in `node:sqlite` system of record for candidates, authoritative source snapshots/observations, editorial runs/evidence/recommendations/selections, action/relationship/health history, audience first-seen state, format-aware drafts, workflow/publication state, fixed-window publication measurements, experiment/variant assignments, AI profile/run provenance, and suggested/accepted/retired learned rules.
- `drafting.js` — Original/Quote/Reply/Thread composition, canonical writer packets, structured writer output, deterministic hard gates, weighted length, and the separate 50-point quality rubric.
- `writer_runtime.js` — writer-specific structured prompt/schema owner behind the shared provider-independent `runStructuredAI()` boundary; writer execution can use the configured Direct API, Codex, or supported installed runtime profile without changing workflow authority.
- `scheduler.js` — pure main-feed eligibility, priority, urgency/expiry, coverage spacing, semantic conflict, explicit human override, and deterministic ranking; timing assumptions stay labeled `EMPIRICAL_VARIABLE`.
- `experiments.js` — pure experiment definition/population validation, attribution-confidence semantics, normalized content/network cohorts, InteractionYield context, and cautious evidence states.
- `learning.js` — pure learned-strategy qualification, bounded adjustment, matching/application, lifecycle transition, and stale/reversal/mechanism-review logic.
- `agent_bridge.js` — stable JSON-in/JSON-out interface for editorial planning, AI configuration, workflow/health/relationship/measurement/experiment/learning reads and explicit writes; recommendation selection is not approval, learning acceptance/retirement require explicit confirmation, and the bridge cannot approve or publish main-feed content.
- `dashboard.js` — web server/static owner for the migrated React workspace plus legacy Bootstrap diagnostic surfaces; Today includes the AI Editorial Plan, Advanced includes AI Settings, and Results exposes observational editorial outcomes alongside Account Health, Engage Next, scheduling, Relationships, Audience, Experiments, and human-controlled Learned Strategy.
- `automation.js` — captures due publication measurement windows, refreshes the canonical source snapshots and Engage Next, optionally recomputes an advisory editorial plan when explicitly enabled, then performs scheduler-ranked approved main-feed publication with an atomic queue claim; it never selects recommendations or sends Engage Next replies.

## Operating standards

- [`docs/CONTENT_OPERATING_STANDARD.md`](docs/CONTENT_OPERATING_STANDARD.md) — hard content invariants plus good/strong/excellent standards for originals, replies, quotes, threads, and news.
- [`docs/ENGAGEMENT_INTEGRITY.md`](docs/ENGAGEMENT_INTEGRITY.md) — engagement-farming boundaries, networking rules, automation constraints, and safe growth loop.
- [`docs/NICHE_AND_KEYWORDS.md`](docs/NICHE_AND_KEYWORDS.md) — target audience, content pillars, keyword clusters, source themes, and exclusion terms.
- [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md) — exact agent contract for manually supplied posts, research, drafting, scoring, distribution decisions, audience sync, and queue interaction.
- [`docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`](docs/GROWTH_DISTRIBUTION_PLAYBOOK.md) — Direct/Quote/Repost/Reply/Ignore rules, attention prompts, relationship recruitment, and follower-quality strategy.
- [`docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`](docs/NETWORK_GROWTH_OPERATING_SYSTEM.md) — strategic source of truth for conversation insertion, relationship conversion, owned-content conversion, target classes, network metrics, and the two-lane operating model.
- [`docs/RELATIONSHIP_INTELLIGENCE.md`](docs/RELATIONSHIP_INTELLIGENCE.md) — implemented target scoring, relationship profiles/events/stages, Engage Next discovery/follow-up workflow, and network analytics contracts.
- [`docs/ACCOUNT_HEALTH_AND_VISIBILITY.md`](docs/ACCOUNT_HEALTH_AND_VISIBILITY.md) — implemented HEALTHY/WATCH/CONSTRAINED observability, provenance-preserving Under-the-Hood snapshots, soft saturation/repetition diagnostics, Network Quality, and InteractionYield.
- [`docs/ALGORITHM_EVIDENCE_LEDGER.md`](docs/ALGORITHM_EVIDENCE_LEDGER.md) — separates current code-backed X mechanisms, official product/policy claims, empirical variables, and retired folklore.
- [`docs/POST_GENERATION_PROMPT.md`](docs/POST_GENERATION_PROMPT.md) — canonical English writing/editing contract, semantic anchors, scannability rules, media decision, and final structured output.
- [`docs/RESEARCH_AGENDA.md`](docs/RESEARCH_AGENDA.md) — deep technical research bets and the first 30-day research program.
- [`docs/PRODUCT_ARCHITECTURE.md`](docs/PRODUCT_ARCHITECTURE.md) — canonical current/planned product map: Phases 1–6, source truth vs workflow/history, Discover → Research → AI Editorial Director → Human → Writer → Human → Publish → Measure → Learn, AI runtime/provider choices, and authority boundaries.
- [`docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`](docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md) — cross-system implementation/history plan for the full network-growth and publishing loop.
- [`docs/plans/AI_RUNTIME_PROVIDER_LAYER.md`](docs/plans/AI_RUNTIME_PROVIDER_LAYER.md) — implemented shared structured runtime/provider layer: Direct API/OpenRouter/OpenAI-compatible, Codex, installed AGY support, AI Settings, role/default profiles, secrets, catalogs, and run provenance; absent OpenCode variants remain unavailable.
- [`docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md`](docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md) — implemented current-signal clustering, controlled evidence, objective-aware editorial recommendations, Today plan UX, human selection provenance, writer evidence, and editorial outcome context.
- [`docs/plans/README.md`](docs/plans/README.md) — phase-specific implementation-plan index; Phases 1A–6 and the shared AI runtime/provider layer are implemented.

### Current implemented architecture

Phase 1A is implemented: sources entering the workflow get a persistent Triage queue item, receive separate Reach/Follow/Conversation/Relationship scores, keep the rule/AI recommendation separate from the selected route, and can move through Drafting -> Needs Review -> explicit human approval. Bookmarking is independent reference state and is not required to start work. Human approval is the only workflow path that creates an approved main-feed queue item; the associated text draft remains compatibility `ready` as an approved-content integrity marker, not as the automation selector.

Phase 1B Relationship Intelligence is also implemented: raw `audience_profiles` observations refresh separate strategic `relationship_profiles`; append-only `relationship_events` materialize counters/stages; TargetScore exposes its component breakdown and missing evidence; the dashboard and agent bridge provide read-only relationship inspection.

Phase 1C Engage Next is implemented: bounded relationship-target reads and observed responses feed an engagement lane; active conversations rank ahead of comparable cold opportunities; reply drafting/review uses the Phase-2 writer/gate engine; the dashboard provides one-item Draft/Quote/Ignore/Expire/Approve & Send actions; successful replies record candidate action plus relationship history. Automation refreshes opportunities but never sends them.

Phase 2 Content Quality is implemented through the human-review boundary: routed formats persist single text or explicit thread parts plus editor/gate metadata; agents can retrieve `writer-packet` and persist allow-listed structured output; review/approval recomputes deterministic hard gates with explicit human factuality/evidence confirmation. Required media remains blocked because no real attachment/upload readiness path is implemented yet.

Phase 3 Main-feed Distribution is implemented: approved main-feed queue rows, not compatibility `draft.status=ready` FIFO, are publication authority; the pure scheduler explains urgency/expiry/coverage/semantic timing; optional human schedule overrides are stored separately from approval; enabled automation atomically claims one Original/Quote/Thread row before transport; success/failure remains inspectable in queue state. Reposts remain manual and engagement replies remain outside this scheduler.

Phase 1D Account Health is implemented: append-only observed health/visibility evidence retains provenance; `health.js` derives HEALTHY/WATCH/CONSTRAINED plus SaturationPressure, reply repetition, Network Quality, and InteractionYield; the dashboard/bridge expose the structured diagnostics; Under the Hood is recorded only when observable; WATCH changes warnings/priority only, while supported hard evidence blocks explicit engagement send.

Phase 4 Measurement & Experiments is implemented: published main-feed items accumulate first-available 15m/1h/6h/24h snapshots with actual capture time; follower deltas retain overlap/downgrade attribution confidence and remain associated rather than causal; audience first-seen state supports new-follower quality; declared content/timing/network experiments use explicit non-random assignments and normalized cohort summaries with sample/confounder/health-network context and `insufficient -> preliminary -> directional -> repeated` evidence states.

Phase 5 Learned Strategy is implemented: Phase-4 experiment summaries can produce `suggested` evidence-backed rules; suggestions remain zero-effect until explicit human acceptance; accepted target/engagement/health/content/format/topic/timing adjustments are bounded and shown separately from base scoring; retirement preserves history; linked retired algorithm-evidence tags and newer/reversing evidence surface review signals. Hard gates, expiry, required human approval, explicit manual routing/timing, and provenance-backed Account Health constraints remain authoritative over learning.

Phases 1A–6 plus the shared AI runtime/provider layer are current runtime behavior. Remaining planned work outside that implemented boundary is:

- **media attachment/upload readiness** — required proof media remains blocked until a real attachment path exists;
- **continuous-scan background consumer** — the `continuous_scan` role is configurable but intentionally shown as **Not active** until a concrete background semantic consumer is implemented;
- **optional OpenCode/OpenCode 2 execution adapters** — these remain unavailable when the corresponding runtimes are not installed; no undocumented TUI parsing is used.

Phase 6 is implemented: canonical X/GitHub/HN source snapshots feed an evidence-bounded two-pass AI Editorial Plan; code owns story/recommendation scoring and final order; the human selects or overrides a recommendation; selected work enters the existing writer/gates/approval workflow; publication measurements preserve recommendation vs selected vs final route provenance. AI runtime/provider/model choice never changes approval or publication authority.

`docs/PRODUCT_ARCHITECTURE.md` owns the end-to-end product map. `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md` owns the strategic network model. `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md` owns the cross-system implementation/history map. `docs/plans/` owns implementation order and exact file/interface changes.

## Setup

Copy the non-secret settings you want from `.env.example` into `.env`. HTTP writes require both `AUTH_TOKEN` and `CT0`.

```bash
npm run http:check
```

That command validates the authenticated HTTP session and resolves X's current `CreateTweet` GraphQL operation without publishing anything.

## Research

```bash
npm run news
node tech_news.js --ranked --to-post
node tech_news.js --hn --limit=10
node tech_news.js --github --limit=10
node tech_news.js --x --limit=3
node tech_news.js --json --limit=5
```

X discovery is driven by the taxonomy in `strategy.js`: AI coding agents, models/inference, developer tools, infrastructure/architecture, jobs/career, builders/SaaS, and technical productization. **X Latest** is the configured Latest-search source view in real post-time order. **X Momentum** is the configured Top-search/momentum view; neither is labeled as X's global Trends product. **GitHub Trending** reads the actual GitHub Trending source order and enriches repositories with authoritative metadata. **HN Top Stories** preserves the current Hacker News top-stories order and metadata.

Research candidates are persisted in `.x-research.sqlite`, but live source snapshots are distinct from workflow history. **To review** contains unresolved persisted candidates; **Bookmarks** means explicit reference state; **Handled** is derived from real publication/quote/reply/repost history; **All sources** is persisted history rather than a live upstream feed. Starting a draft does not implicitly bookmark its source.

## Publishing

```bash
# Validate only; no X write
node post_thread.js --dry-run "preview only"

# Direct authenticated HTTP GraphQL (default)
node post_thread.js "first post" "reply in the thread"

# Explicit browser fallback
node post_thread.js --browser "browser-mode post"
```

HTTP mode fails closed if the session or live operation discovery cannot be validated. It does not silently switch to browser automation.

## Automation

```bash
# One research + queue cycle. AUTO_POST=false previews the scheduler recommendation only.
npm run automation:once

# Keep polling while this process/PC environment is running.
npm run automation
```

Key settings:

```dotenv
POLL_MINUTES=30
AUTO_POST=false
AUTO_EDITORIAL_PLAN_REFRESH=false
```

Before research/publication work, automation checks for missing due 15m/1h/6h/24h measurements and, only when needed, batches one existing account/post performance read. It records the first available snapshot after each due window idempotently. After a successful publication it also attempts one read-only follower-baseline snapshot; baseline/measurement read failures never change the persisted publication result or authorize another send. It then refreshes canonical X Latest/X Momentum/GitHub Trending/HN Top Stories snapshots and Engage Next opportunities. `AUTO_EDITORIAL_PLAN_REFRESH=true` may recompute a `qualified_growth` advisory plan from those already-refreshed snapshots; failure is isolated and no recommendation is selected. Main-feed publication still ranks **human-approved main-lane queue items** through `scheduler.js`. `AUTO_POST=false` stops before publication claim/transport and only previews the scheduler recommendation; Phase-4 measurement reads and editorial planning do not change that authority. `AUTO_POST=true` may publish at most one due Original/Quote/Thread item after the existing atomic claim. Repost remains manual and required media remains blocked until real attachment readiness exists.

## Web preview

```bash
npm start
```

`npm start` rebuilds the Tailwind dashboard CSS and launches the web app. Then open `http://localhost:3030/`. `npm run web` is the equivalent explicit command.

The guided dashboard shell is organized around user goals instead of implementation modules:

- **Today** — the current AI Editorial Plan above prioritized workflow attention: objective selector, source freshness, evidence-bounded recommendations, explicit refresh/select/dismiss/research-source actions, useful conversations, review work, and account status.
- **Discover** — source truth and source workflow context: To review, X Latest, X Momentum, Opportunities, GitHub Trending, HN Top Stories, Bookmarks, Handled, and All sources.
- **Conversations** — active/new conversation opportunities plus relationship and audience context.
- **Create** — items to review and drafts, while preserving the existing review/approval/scheduler owners underneath.
- **Results** — performance/account-status views plus observational editorial outcome cohorts when real Phase-4 measurements exist.
- **Improve** — Tests and What we've learned.
- **Advanced** — direct access to detailed diagnostics plus **AI Settings** for global/per-role profiles, provider/runtime/model selection, connection/catalog checks, secret status, and recent AI-run usage/provenance.

The shell changes presentation only: the existing approval, exact-reply send, scheduler, Account Health, experiment, and learned-rule boundaries remain authoritative. Technical scores/details are progressively disclosed rather than removed.

The implemented AI runtime layer supports Direct OpenAI/OpenRouter/OpenAI-compatible endpoints, Codex model/reasoning selection, and the installed AGY structured runtime contract. AI Settings exposes a global default plus per-role profiles for `continuous_scan`, `editorial_scan`, `editorial_final`, and `writer`; `continuous_scan` is configurable but explicitly **Not active** until a background consumer exists. AGY support is capability-gated against its installed CLI contract and uses exact catalog model IDs; the current adapter was verified against AGY 1.1.15. OpenCode/OpenCode 2 remain truthfully unavailable when not installed.

## Agent interface

Another agent should use the bridge rather than editing SQLite or scraping dashboard HTML:

```bash
npm run agent -- research <<<'{"source":"x","limit":10}'
npm run agent -- queue <<<'{"minScore":40}'
npm run agent -- schedule-next <<<'{}'
npm run agent -- schedule-inspect <<<'{"key":"https://x.com/example/status/123"}'
npm run agent -- measurements <<<'{"limit":20}'
npm run agent -- experiments <<<'{}'
npm run agent -- experiment-summary <<<'{"id":1,"windowMinutes":60}'
npm run agent -- learning <<<'{}'
npm run agent -- learning-refresh <<<'{"experimentId":1,"baselineLabel":"original","comparisonLabel":"thread","windowMinutes":60}'
npm run agent -- learning-accept <<<'{"id":1,"confirmAccept":true}'
npm run agent -- learning-retire <<<'{"id":1,"reason":"newer evidence reversed direction","confirmRetire":true}'
npm run agent -- audience <<<'{"minScore":12,"limit":30}'
npm run agent -- relationship-targets <<<'{"class":"relationship","stage":"responsive","limit":20}'
npm run agent -- relationship-inspect <<<'{"username":"example","limit":20}'
npm run agent -- relationship-events <<<'{"username":"example","limit":50}'
npm run agent -- engage-next <<<'{"refresh":true,"limit":30}'
npm run agent -- engage-draft <<<'{"key":"https://x.com/example/status/123"}'
npm run agent -- engage-resolve <<<'{"key":"https://x.com/example/status/123","action":"ignore"}'
npm run agent -- editorial-plan <<<'{"objective":"qualified_growth"}'
npm run agent -- editorial-refresh <<<'{"objective":"qualified_growth","refreshSources":true}'
npm run agent -- editorial-recommendation <<<'{"recommendationId":1}'
npm run agent -- editorial-select <<<'{"recommendationId":1}'
npm run agent -- editorial-dismiss <<<'{"recommendationId":1}'
npm run agent -- editorial-add-source <<<'{"recommendationId":1,"url":"https://example.com/evidence","claim":"Claim to investigate","claimType":"other"}'
npm run agent -- editorial-outcomes <<<'{"windowMinutes":1440,"limit":100}'
npm run agent -- ai-config <<<'{}'
npm run agent -- ai-runtimes <<<'{}'
npm run audience:sync
```

When you manually give the agent an X post, it should inspect the exact source, ingest it, research primary evidence, create/update a draft, and request `ready` only when the quality gate passes. See `docs/AGENT_WORKFLOW.md` for the full protocol and JSON examples.

## Important limitation

This project uses X's internal web GraphQL interface, not the official X API. Query IDs and private endpoints can change without notice, and automated use may carry platform-account risk. The live query-ID discovery removes one common breakage mode, but cannot make an unofficial interface contractually stable.
