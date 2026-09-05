# X Network Growth & Publishing System

Local Node.js human+AI operating system for `@ham_zax`. The runtime discovers software-development signals across the active Growth Focus, selects and persists purpose/mode/affect/depth before writing, loads a versioned experimental Hamza model, stores research and evolving stance history in SQLite, maintains relationship/health intelligence, realizes behavior-aware drafts, measures fixed-window outcomes, and proposes bounded learned strategy rules. X mutation is transport-gated: the background Node daemon is official-X-API-only, while a persistent Growth Operator may execute already-authorized work through the browser-agent lane and then reconcile the verified public result through Growth OS.

## Components

- `x_browser_publish.js` — owns authenticated Clearcote read/session checks, publication content-gate receipts, and read-only live-search identity recovery. Scripted x.com mutation exports fail closed.
- `x_api_publish.js` — official X API v2 main-feed transport. Text Originals and Threads are supported with an OAuth user access token; Quote requires explicit Enterprise capability; local media upload remains fail-closed.
- `post_thread.js` — browser-session preflight and dry-run validation only; direct browser thread mutation is disabled.
- `behavior.js` — shared neutral contract for action purpose, social mode, affect strategy/provenance, information depth, conversation stage, and ACT/RESEARCH/SILENT decisions.
- `persona.js` + `persona/hamza-v1.json` — versioned experimental Hamza model owner, bounded consumer slices, relationship-aware behavior selection, and current stance-memory exposure.
- `strategy.js` — executable niche taxonomy, keyword lanes, classification, saved-preference ranking boost, and purpose-aware Direct/Quote/Repost/Reply/Ignore decision method.
- `audience.js` — authenticated follower/following sync with niche relevance scoring, legacy-crypto downranking, and non-destructive Relationship Intelligence refresh for observed relevant accounts.
- `relationship.js` — target classes, transparent TargetScore components, bounded reach modifier, event aggregation, and derived relationship stages.
- `tech_news.js` — X niche/viral discovery, bounded relationship-target timelines/responses, authenticated Under-the-Hood visibility observations, Hacker News, GitHub, ranking, and account-performance reads.
- `store.js` — built-in `node:sqlite` system of record for candidates, source snapshots/observations, behavior/persona version provenance, append-only persona stance events, editorial runs/evidence/recommendations/selections, action/relationship/health history, audience first-seen state, drafts, workflow/publication state, fixed-window measurements, experiment assignments, AI run provenance, and suggested/accepted/retired learned rules.
- `drafting.js` — behavior/persona-aware Writer packets, structured Writer output, purpose/provenance/clarity gates, weighted platform length, and the purpose-aware 50-point review rubric.
- `writer_runtime.js` — writer-specific structured prompt/schema owner behind the shared provider-independent `runStructuredAI()` boundary; writer execution can use the configured Direct API, Codex, or supported installed runtime profile without changing workflow authority.
- `scheduler.js` — pure main-feed eligibility, priority, urgency/expiry, coverage spacing, semantic conflict, explicit human override, and deterministic ranking; timing assumptions stay labeled `EMPIRICAL_VARIABLE`.
- `experiments.js` — pure experiment definition/population validation, attribution-confidence semantics, normalized content/network cohorts, InteractionYield context, and cautious evidence states.
- `learning.js` — pure learned-strategy qualification, bounded adjustment, matching/application, lifecycle transition, and stale/reversal/mechanism-review logic.
- `agent_bridge.js` — stable JSON-in/JSON-out interface for editorial planning, AI configuration, workflow/health/relationship/measurement/experiment/learning reads and bounded writes. Explicit one-shot confirmations remain available, while a running Growth Operator delegation can authorize selected local strategy/experiment operations without repeated confirmation; the bridge itself still does not publish main-feed content.
- `dashboard.js` — web server/static owner for the migrated React workspace plus legacy Bootstrap diagnostic surfaces; Today includes the AI Editorial Plan, Advanced includes AI Settings, and Results exposes observational editorial outcomes alongside Account Health, Engage Next, scheduling, Relationships, Audience, Experiments, and bounded Learned Strategy.
- `automation.js` — captures due publication measurements, refreshes canonical sources and Engage Next, optionally recomputes an advisory editorial plan, and scheduler-ranks approved main-feed work. It claims a due item only when the selected route is supported by the configured official API transport.

## Operating standards

- [`docs/CONTENT_OPERATING_STANDARD.md`](docs/CONTENT_OPERATING_STANDARD.md) — hard content invariants plus good/strong/excellent standards for originals, replies, quotes, threads, and news.
- [`docs/NICHE_AND_KEYWORDS.md`](docs/NICHE_AND_KEYWORDS.md) — target audience, content pillars, keyword clusters, source themes, and exclusion terms.
- [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md) — exact agent contract for manually supplied posts, research, drafting, scoring, distribution decisions, audience sync, and queue interaction.
- [`docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`](docs/GROWTH_DISTRIBUTION_PLAYBOOK.md) — supporting distribution-format and relationship tactics under the canonical purpose-based contracts.
- [`docs/GROWTH_OS_MOMENTUM_OPERATOR.md`](docs/GROWTH_OS_MOMENTUM_OPERATOR.md) — live 2026-08-25 findings plus the agent-facing `growth-next` loop: last-known-good source refresh, momentum/urgency, borrowed distribution, and viral-structure transfer.
- [`docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md`](docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md) — reusable persistent-session invocation contract: qualified-growth reward hierarchy, anti-drift checks, operational completion criteria, authority boundaries, and continuation behavior.
- [`docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`](docs/NETWORK_GROWTH_OPERATING_SYSTEM.md) — strategic source of truth for conversation insertion, relationship conversion, owned-content conversion, target classes, network metrics, and the two-lane operating model.
- [`docs/RELATIONSHIP_INTELLIGENCE.md`](docs/RELATIONSHIP_INTELLIGENCE.md) — implemented target scoring, relationship profiles/events/stages, Engage Next discovery/follow-up workflow, and network analytics contracts.
- [`docs/ACCOUNT_HEALTH_AND_VISIBILITY.md`](docs/ACCOUNT_HEALTH_AND_VISIBILITY.md) — implemented HEALTHY/WATCH/CONSTRAINED observability, provenance-preserving Under-the-Hood snapshots, soft saturation/repetition diagnostics, Network Quality, and InteractionYield.
- [`docs/ALGORITHM_EVIDENCE_LEDGER.md`](docs/ALGORITHM_EVIDENCE_LEDGER.md) — non-authoritative evidence registry separating code-backed mechanisms, official policy, account observations, hypotheses, and retired claims.
- [`docs/POST_GENERATION_PROMPT.md`](docs/POST_GENERATION_PROMPT.md) — canonical behavior-realization contract for the final Writer.
- [`docs/research/x_creator_phase2/V4_RESEARCH_REASSESSMENT.md`](docs/research/x_creator_phase2/V4_RESEARCH_REASSESSMENT.md) — verified V4 corpus/reply reassessment and research-to-production limits.
- [`docs/research/x_creator_phase2/HAMZA_X_PERSONA_EXPERIMENT.md`](docs/research/x_creator_phase2/HAMZA_X_PERSONA_EXPERIMENT.md) — experimental persona/behavior model, not permanent doctrine.
- [`docs/plans/X_CONTENT_PERSONA_SYSTEM_OVERHAUL.md`](docs/plans/X_CONTENT_PERSONA_SYSTEM_OVERHAUL.md) — V4-reanchored doctrine/runtime/persona migration plan.
- [`docs/RESEARCH_AGENDA.md`](docs/RESEARCH_AGENDA.md) — deep technical research bets and the first 30-day research program.
- [`docs/PRODUCT_ARCHITECTURE.md`](docs/PRODUCT_ARCHITECTURE.md) — canonical current/planned product map: Phases 1–6, source truth vs workflow/history, Discover → Research → AI Editorial Director → Human → Writer → Human → Publish → Measure → Learn, AI runtime/provider choices, and authority boundaries.
- [`docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`](docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md) — cross-system implementation/history plan for the full network-growth and publishing loop.
- [`docs/plans/AI_RUNTIME_PROVIDER_LAYER.md`](docs/plans/AI_RUNTIME_PROVIDER_LAYER.md) — implemented shared structured runtime/provider layer: Direct API/OpenRouter/OpenAI-compatible, Codex, installed AGY support, AI Settings, role/default profiles, secrets, catalogs, and run provenance; absent OpenCode variants remain unavailable.
- [`docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md`](docs/plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md) — implemented current-signal clustering, controlled evidence, objective-aware editorial recommendations, Today plan UX, human selection provenance, writer evidence, and editorial outcome context.
- [`docs/plans/README.md`](docs/plans/README.md) — phase-specific implementation-plan index; Phases 1A–6 and the shared AI runtime/provider layer are implemented.

### Current implemented architecture

Phase 1A is implemented: sources entering the workflow get a persistent Triage queue item, receive separate Reach/Follow/Conversation/Relationship scores, and keep the rule/AI recommendation separate from the selected route. The ordinary manual lane can move through Drafting -> Needs Review -> owner approval. A running Live Growth Operator delegation may instead approve eligible Original/Quote/Thread work, or a source-only Repost, through mission-agent authority without populating `humanApprovedAt`. Text routes retain their compatibility `ready` draft as an approved-content integrity marker; Repost deliberately has no Writer draft.

Phase 1B Relationship Intelligence is also implemented: raw `audience_profiles` observations refresh separate strategic `relationship_profiles`; append-only `relationship_events` materialize counters/stages; TargetScore exposes its component breakdown and missing evidence; the dashboard and agent bridge provide read-only relationship inspection.

Phase 1C Engage Next is implemented for discovery, evaluation, drafting, and measurement. Dry-run autonomous reply evaluation remains available. Live delegated replies may be executed by the persistent Growth Operator through its browser-agent lane when the persisted autonomous-reply grant, exact text/target gates, health state, and live context all permit the send. The background Node daemon does not inherit that browser authority.

Phase 2 Content Quality is implemented across manual and delegated authority paths: routed text formats persist behavior/persona provenance, text/thread parts, and editor/gate metadata; agents retrieve `writer-packet` and persist allow-listed structured output; approval recomputes purpose/provenance/clarity gates regardless of authority source. Operator-attached local media remains unsupported by the background official-API transport, but the persistent browser lane now grants the exact claimed attachment a temporary `browser-fast` approved-artifact name and removes that allowlist entry after verified reconciliation.

Phase 3 Main-feed Distribution is implemented: approved main-feed queue rows, not compatibility `draft.status=ready` FIFO, are publication authority; approval may come from the ordinary owner lane or delegated mission-agent lane. The scheduler explains urgency/expiry/coverage/semantic timing for Original/Quote/Thread/Repost. `AUTO_POST=true` requests background-daemon publication, and that daemon claims a row only when its official X API user-context transport supports the specific route. Separately, a persistent Growth Operator may atomically claim and execute an already-authorized Original/Quote/Thread/Repost through its browser-agent lane, verify the exact rendered action/structure, and reconcile it through Growth OS. Native Repost therefore remains rare by strategy, not manual-only by transport.

Phase 1D Account Health is implemented: append-only observed health/visibility evidence retains provenance; `health.js` derives HEALTHY/WATCH/CONSTRAINED plus SaturationPressure, reply repetition, Network Quality, and InteractionYield; the dashboard/bridge expose the structured diagnostics; Under the Hood is recorded only when observable; WATCH changes warnings/priority only, while supported hard evidence blocks explicit engagement send.

Phase 4 Measurement & Experiments is implemented: published items accumulate fixed-window observations with actual capture time; follower deltas remain associated rather than causal; audience first-seen state supports new-follower quality; declared content/timing/network/behavior experiments use explicit non-random assignments and normalized cohort summaries with purpose, mode, affect, depth, conversation stage, persona version, confounders, and `insufficient -> preliminary -> directional -> repeated` evidence states.

Phase 5 Learned Strategy is implemented: Phase-4 experiment summaries can produce `suggested` evidence-backed rules; suggestions remain zero-effect until accepted through an authorized transition. Manual acceptance may use qualified directional/repeated evidence; delegated autonomous acceptance is stricter and requires repeated qualified evidence with no active review suspension. Adjustments remain bounded and separately inspectable; retirement preserves history. Hard content/provenance gates, expiry, owner-only scope/timing overrides, delegation revocation, and provenance-backed Account Health constraints remain authoritative over learning.

Phases 1A–6 plus the shared AI runtime/provider layer are current runtime behavior. Remaining planned work outside that implemented boundary is:

- **continued persona calibration** — the current Hamza model is an owner-tuned versioned alpha. Further asymmetric tastes, technical first-person provenance, humor boundaries, and social choices are ongoing evidence/calibration work rather than a missing integration layer;
- **continuous-scan background consumer** — the `continuous_scan` role is configurable but intentionally shown as **Not active** until a concrete background semantic consumer is implemented;
- **OpenCode structured execution** — the installed OpenCode runtime uses its documented SDK/server JSON-schema path; OpenCode 2 remains separately capability-gated and no undocumented TUI parsing is used.

Phase 6 is implemented: canonical X/GitHub/HN source snapshots feed a source-context-aware two-pass AI Editorial Plan; code owns story/recommendation scoring and final order. The owner may select/override a recommendation manually, while an active Growth Operator delegation may select eligible PREPARE work through bounded mission-agent authority. Selected work enters the same writer/gates/approval workflow, and publication measurements preserve recommendation vs selected vs final route provenance.

`docs/PRODUCT_ARCHITECTURE.md` owns the end-to-end product map. `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md` owns the strategic network model. `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md` owns the cross-system implementation/history map. `docs/plans/` owns implementation order and exact file/interface changes.

## Setup

Copy the non-secret settings you want from `.env.example` into `.env`. `AUTH_TOKEN` may support authenticated browser reads/session checks. Automated main-feed mutation requires an OAuth user access token in `X_API_ACCESS_TOKEN` with `tweet.read`, `tweet.write`, and `users.read`; add `offline.access` to your OAuth flow if you need refresh tokens.

```bash
npm run browser:check
```

That command launches the Clearcote browser, authenticates the X UI session, verifies the configured account profile, and publishes nothing.

## Research

```bash
npm run news
node tech_news.js --ranked --to-post
node tech_news.js --hn --limit=10
node tech_news.js --github --limit=10
node tech_news.js --x --limit=3
node tech_news.js --json --limit=5
```

X discovery is generated from the persisted Growth Focus topic groups. The default profile spans frontend/JavaScript/TypeScript, Node.js/backend/APIs, Python, Rust/Go/systems, databases, developer tools/open source, infrastructure, building/shipping software, and AI-assisted development; groups can be added, removed, renamed, reweighted, disabled, or rebalanced without changing discovery code. **X Latest** is the configured Latest-search source view in real post-time order. **X Momentum** is the configured Top-search/momentum view; neither is labeled as X's global Trends product. **GitHub Trending** reads the actual GitHub Trending source order and enriches repositories with authoritative metadata. **HN Top Stories** preserves the current Hacker News top-stories order and metadata.

Research candidates are persisted in `.x-research.sqlite`, but live source snapshots are distinct from workflow history. **To review** contains unresolved persisted candidates; **Bookmarks** means explicit reference state; **Handled** is derived from real publication/quote/reply/repost history; **All sources** is persisted history rather than a live upstream feed. Starting a draft does not implicitly bookmark its source.

## Publishing

```bash
# Validate content only; no X write
node post_thread.js --dry-run "preview only"

# Verify the authenticated browser read/session profile; no X write
npm run browser:check
```

The background Node daemon does not script the x.com UI; its main-feed write path uses `POST https://api.x.com/2/tweets` only when `X_API_ACCESS_TOKEN` is configured. Separately, the persistent Growth Operator may execute already-authorized work through the browser-agent lane (`browser-fast` first, `agent-browser` CLI fallback) and reconcile the verified public result through Growth OS. Unknown consequential results are non-retryable until reconciled.

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
X_API_ACCESS_TOKEN=
X_API_ENTERPRISE_QUOTE=false
```

Automation checks due measurements, refreshes canonical X/GitHub/HN sources and Engage Next, and may recompute the advisory editorial plan. `AUTO_POST=false` previews only. `AUTO_POST=true` still does not create transport capability: without `X_API_ACCESS_TOKEN`, due work remains approved and unclaimed. With the token present, automation chooses the highest-ranked scheduler-eligible item that the X API transport can actually publish, authorizes the exact approved snapshot, atomically claims it, and then calls the official API. Quote is skipped unless Enterprise capability is explicitly enabled, and local media remains unsupported rather than silently switching transport.

## Web preview

```bash
npm start
```

`npm start` rebuilds the Tailwind dashboard CSS and launches the web app. Then open `http://localhost:3030/`. `npm run web` is the equivalent explicit command.

The guided dashboard shell is organized around user goals instead of implementation modules:

- **Today** — the current AI Editorial Plan above prioritized workflow attention: objective selector, source freshness, context-aware recommendations, explicit refresh/select/dismiss/research-source actions, useful conversations, review work, and account status.
- **Discover** — source truth and source workflow context: To review, X Latest, X Momentum, Opportunities, GitHub Trending, HN Top Stories, Bookmarks, Handled, and All sources.
- **Conversations** — active/new conversation opportunities plus relationship and audience context.
- **Posts** — items to review and drafts, while preserving the existing review/approval/scheduler owners underneath.
- **Results** — performance/account-status views plus observational editorial outcome cohorts when real Phase-4 measurements exist.
- **Learn** — external patterns, own-account evidence, explicit tests, and strategy context with provenance lanes kept separate.
- **Settings** — Growth Focus, AI/runtime configuration, autonomous-reply controls, and advanced diagnostics. Legacy diagnostic detail pages remain reachable from Advanced while they are migrated.

The shell changes presentation only: the existing approval, exact-reply send, scheduler, Account Health, experiment, and learned-rule boundaries remain authoritative. Technical scores/details are progressively disclosed rather than removed.

The implemented AI runtime layer supports Direct OpenAI/OpenRouter/OpenAI-compatible endpoints, Codex model/reasoning selection, OpenCode through its documented SDK/server structured-output contract, and the installed AGY structured runtime contract. AI Settings exposes a global default plus per-role profiles for `continuous_scan`, `editorial_scan`, `editorial_final`, and `writer`; `continuous_scan` is configurable but explicitly **Not active** until a background consumer exists. OpenCode uses exact `provider/model` catalog IDs plus optional advertised model variants. AGY support is capability-gated against its installed CLI contract and uses exact catalog model IDs; the current adapter was verified against AGY 1.1.15. OpenCode 2 remains separately unsupported until its own adapter contract is implemented.

## Agent interface

Another agent should use the bridge rather than editing SQLite or scraping dashboard HTML:

```bash
npm run agent -- operator-status <<<'{}'
npm run agent -- operator-memory-review <<<'{"result":"no_update_needed","note":"Reviewed after five reconciled interactions; no stable reusable pattern yet.","confirmReview":true}'
npm run agent -- research <<<'{"source":"x","limit":10}'
npm run agent -- queue <<<'{"limit":20}'
npm run agent -- schedule-next <<<'{}'
npm run agent -- schedule-inspect <<<'{"key":"https://x.com/example/status/123"}'
# Persistent Growth Operator only, immediately before an already-authorized browser action:
npm run agent -- browser-publish-claim <<<'{"key":"https://x.com/example/status/123"}'
npm run agent -- browser-reply-claim <<<'{"key":"https://x.com/example/status/123"}'
npm run agent -- measurements <<<'{"limit":20}'
npm run agent -- experiments <<<'{}'
npm run agent -- experiment-summary <<<'{"id":1,"windowMinutes":60}'
npm run agent -- learning <<<'{}'
npm run agent -- learning-refresh <<<'{"experimentId":1,"baselineLabel":"original","comparisonLabel":"thread","windowMinutes":60}'
# One-shot/manual transition:
npm run agent -- learning-accept <<<'{"id":1,"confirmAccept":true}'
npm run agent -- learning-retire <<<'{"id":1,"reason":"newer evidence reversed direction","confirmRetire":true}'
# During a running Growth Operator delegation the agent may omit those confirmation flags;
# autonomous acceptance is stricter and requires repeated qualified evidence.
npm run agent -- audience <<<'{"minScore":12,"limit":30}'
npm run agent -- relationship-targets <<<'{"class":"relationship","stage":"responsive","limit":20}'
npm run agent -- relationship-inspect <<<'{"username":"example","limit":20}'
npm run agent -- relationship-events <<<'{"username":"example","limit":50}'
npm run agent -- engage-next <<<'{"compact":true,"limit":30}'
npm run agent -- engage-refresh <<<'{"limit":30}'
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

Authenticated browser/private-web access remains dependent on X's live web application, so discovery, analytics, profile reads, browser-agent publication, and reconciliation can break when X changes its UI. The background Node daemon does **not** use browser mutation and remains official-X-API-only. The persistent Growth Operator has a separate browser-agent execution lane: prefer the harness-owned MCP `browser-fast` surface, use `browser-devtools` for diagnostics, fall back to the WebHarness-bundled Agent Browser CLI in a named session when Local/MCP is unavailable, and use the global `agent-browser` CLI only as a secondary fallback. The legacy repository Clearcote/xactions writer remains disabled because its reply-target integrity previously failed verification. Browser execution never creates approval; exact repository authority, target/content gates, one-shot send semantics, structural verification, and Growth OS reconciliation remain required.
