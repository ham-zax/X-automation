# X Network Growth & Publishing System

Local Node.js human+AI operating system for `@ham_zax`. The current runtime discovers AI/developer signals, learns from saved posts, stores research in SQLite, maintains strategic relationship profiles/events, surfaces freshness-aware Engage Next opportunities, turns sources into scored drafts, tracks account performance, and can publish approved queued drafts through authenticated HTTP GraphQL. The network-first architecture now includes human-reviewed engagement before owned-content conversion, measurement, and learned targeting/content/timing.

## Components

- `x_http.js` — validates the cookie session, discovers the live `CreateTweet` operation ID from X's current web bundle, and performs HTTP GraphQL writes.
- `post_thread.js` — dry-run, HTTP session check, HTTP thread publishing, or explicit `--browser` publishing.
- `strategy.js` — executable niche taxonomy, keyword lanes, classification, saved-preference ranking boost, and Direct/Quote/Repost/Reply/Ignore decision method.
- `audience.js` — authenticated follower/following sync with niche relevance scoring, legacy-crypto downranking, and non-destructive Relationship Intelligence refresh for observed relevant accounts.
- `relationship.js` — target classes, transparent TargetScore components, bounded reach modifier, event aggregation, and derived relationship stages.
- `tech_news.js` — X niche/viral discovery, bounded relationship-target timelines/responses, Hacker News, GitHub, ranking, and account-performance reads.
- `store.js` — built-in `node:sqlite` research memory for candidates, saved preferences, candidate action history, raw audience profiles, strategic relationship profiles/events, format-aware drafts/editor/gate metadata, main/engagement queue state, Phase-3 schedule/claim/publication metadata, and performance snapshots.
- `drafting.js` — Original/Quote/Reply/Thread composition, canonical writer packets, structured writer output, deterministic hard gates, weighted length, and the separate 50-point quality rubric.
- `scheduler.js` — pure main-feed eligibility, priority, urgency/expiry, coverage spacing, semantic conflict, explicit human override, and deterministic ranking; timing assumptions stay labeled `EMPIRICAL_VARIABLE`.
- `agent_bridge.js` — stable JSON-in/JSON-out interface for ingest/research/workflow, relationship reads, Engage Next inspection/drafting/resolution, `writer-packet`, `apply-writer-output`, and read-only `schedule-next` / `schedule-inspect`; it cannot approve or publish main-feed content.
- `dashboard.js` — Bootstrap research/workflow workbench with Engage Next/Active Conversations, format-aware draft editing, hard-gate review, scheduler reasoning/override controls, publication state, Relationships, Audience, and Performance.
- `automation.js` — research plus engagement-opportunity refresh, followed by scheduler-ranked approved main-feed publication with an atomic queue claim; it never sends Engage Next replies.

## Operating standards

- [`docs/CONTENT_OPERATING_STANDARD.md`](docs/CONTENT_OPERATING_STANDARD.md) — hard content invariants plus good/strong/excellent standards for originals, replies, quotes, threads, and news.
- [`docs/ENGAGEMENT_INTEGRITY.md`](docs/ENGAGEMENT_INTEGRITY.md) — engagement-farming boundaries, networking rules, automation constraints, and safe growth loop.
- [`docs/NICHE_AND_KEYWORDS.md`](docs/NICHE_AND_KEYWORDS.md) — target audience, content pillars, keyword clusters, source themes, and exclusion terms.
- [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md) — exact agent contract for manually supplied posts, research, drafting, scoring, distribution decisions, audience sync, and queue interaction.
- [`docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`](docs/GROWTH_DISTRIBUTION_PLAYBOOK.md) — Direct/Quote/Repost/Reply/Ignore rules, attention prompts, relationship recruitment, and follower-quality strategy.
- [`docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`](docs/NETWORK_GROWTH_OPERATING_SYSTEM.md) — strategic source of truth for conversation insertion, relationship conversion, owned-content conversion, target classes, network metrics, and the two-lane operating model.
- [`docs/RELATIONSHIP_INTELLIGENCE.md`](docs/RELATIONSHIP_INTELLIGENCE.md) — implemented target scoring, relationship profiles/events/stages, Engage Next discovery/follow-up workflow, and network analytics contracts.
- [`docs/ACCOUNT_HEALTH_AND_VISIBILITY.md`](docs/ACCOUNT_HEALTH_AND_VISIBILITY.md) — planned HEALTHY/WATCH/CONSTRAINED observability, Under the Hood snapshots, soft saturation/repetition diagnostics, network quality, and InteractionYield.
- [`docs/ALGORITHM_EVIDENCE_LEDGER.md`](docs/ALGORITHM_EVIDENCE_LEDGER.md) — separates current code-backed X mechanisms, official product/policy claims, empirical variables, and retired folklore.
- [`docs/POST_GENERATION_PROMPT.md`](docs/POST_GENERATION_PROMPT.md) — canonical English writing/editing contract, semantic anchors, scannability rules, media decision, and final structured output.
- [`docs/RESEARCH_AGENDA.md`](docs/RESEARCH_AGENDA.md) — deep technical research bets and the first 30-day research program.
- [`docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`](docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md) — implementation-ready plan for Save → Triage → Route → Research → Draft → Review → Schedule → Publish → Learn.
- [`docs/plans/README.md`](docs/plans/README.md) — phase-specific implementation-plan index, with the implemented foundation and remaining execution sequence explicit.

### Current foundation and next architecture

Phase 1A is implemented: Saved candidates enter a persistent Triage queue, receive separate Reach/Follow/Conversation/Relationship scores, keep the AI recommendation separate from the selected route, and can move through Drafting -> Needs Review -> explicit human approval. Human approval is the only workflow path that creates an approved main-feed queue item; the associated text draft remains compatibility `ready` as an approved-content integrity marker, not as the automation selector.

Phase 1B Relationship Intelligence is also implemented: raw `audience_profiles` observations refresh separate strategic `relationship_profiles`; append-only `relationship_events` materialize counters/stages; TargetScore exposes its component breakdown and missing evidence; the dashboard and agent bridge provide read-only relationship inspection.

Phase 1C Engage Next is implemented: bounded relationship-target reads and observed responses feed an engagement lane; active conversations rank ahead of comparable cold opportunities; reply drafting/review uses the Phase-2 writer/gate engine; the dashboard provides one-item Draft/Quote/Ignore/Expire/Approve & Send actions; successful replies record candidate action plus relationship history. Automation refreshes opportunities but never sends them.

Phase 2 Content Quality is implemented through the human-review boundary: routed formats persist single text or explicit thread parts plus editor/gate metadata; agents can retrieve `writer-packet` and persist allow-listed structured output; review/approval recomputes deterministic hard gates with explicit human factuality/evidence confirmation. Required media remains blocked because no real attachment/upload readiness path is implemented yet.

Phase 3 Main-feed Distribution is implemented: approved main-feed queue rows, not compatibility `draft.status=ready` FIFO, are publication authority; the pure scheduler explains urgency/expiry/coverage/semantic timing; optional human schedule overrides are stored separately from approval; enabled automation atomically claims one Original/Quote/Thread row before transport; success/failure remains inspectable in queue state. Reposts remain manual and engagement replies remain outside this scheduler.

The remaining network-first architecture is:

**Account Health/visibility observability -> media attachment readiness -> follower/relationship/health experiments -> learned strategy.**

`docs/NETWORK_GROWTH_OPERATING_SYSTEM.md` owns the strategic model. `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md` owns the cross-system architecture. `docs/plans/` owns implementation order and exact file/interface changes.

Account Health/Under the Hood capture, actual media upload/attachment readiness, the experiment engine, and learned strategy remain planned until their matching phase is implemented.

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

X discovery is driven by the taxonomy in `strategy.js`: AI coding agents, models/inference, developer tools, infrastructure/architecture, jobs/career, builders/SaaS, and technical productization. Viral research is a separate rolling 24-hour Top-search lane ranked by reach and engagement velocity. GitHub candidates are restricted to recently created repositories and ranked by star velocity.

Research candidates are persisted in `.x-research.sqlite`. Saving a post builds an explicit preference profile; matching future candidates receive a small capped ranking boost, so the system gradually adapts to what you mark interesting without changing niche identity from a single post.

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
```

The automation refreshes X niche discovery, X viral discovery, GitHub, Hacker News, and Engage Next opportunities. Engage refresh checks observed responses before cold target posts and persists/refreshes queue state only; it never calls the reply-send path. Main-feed publication then ranks **human-approved main-lane queue items** through `scheduler.js`. `AUTO_POST=false` stops before claim or transport and only previews/explains the next recommendation. `AUTO_POST=true` may publish at most one due Original/Quote/Thread item per cycle, but only after an atomic `approved -> publishing` claim; success becomes `published`, while transport failure becomes inspectable `failed` and is not silently retried in that cycle. Scheduler spacing is a coverage heuristic, not an anti-detection cooldown. Repost remains manual. Required media remains blocked until real attachment readiness exists.

## Web preview

```bash
npm run web
```

Then open `http://localhost:3030/?source=x`.

Dashboard views:

- **X posts** — fresh niche-matched research with exact tags and matched keywords.
- **Viral · 24h** — rolling last-24-hour developer/AI signals with viral tier and velocity.
- **Saved** — your explicit taste/preference library.
- **Engage Next** — Active Conversations before New Opportunities, with target/stage/TargetScore context, EngagePriority components, freshness/expiry, concrete contribution, exact source, soft warnings, reply drafting, Quote instead, Ignore/Expire, and explicit one-reply approval/send controls.
- **Queue** — triage/review plus approved main-feed scheduler time/reason/priority, blockers/warnings/conflicts, explicit human urgency/expiry/time override, and inspectable publishing/failed/published state.
- **Drafts** — format-aware Original/Quote/Reply/Thread editing, explicit thread parts and weighted counts, editor/media metadata, the 50-point rubric, deterministic hard-gate failures/warnings, and human factuality/evidence approval controls.
- **Opportunities** — technical jobs/career, builders/SaaS, and productization signals.
- **Relationships** — read-only strategic target classes, TargetScore/component evidence, follow state, stages, interaction counts, and class/stage filters.
- **Audience** — raw follower/following niche map that feeds Relationship Intelligence without being replaced by it.
- **Performance** — snapshots of `@ham_zax` followers and recent original-post metrics.
- **GitHub / Hacker News / All** — secondary discovery sources.

Use **Save** to train the preference profile and **Create draft** to move a source into the drafting workflow.

## Agent interface

Another agent should use the bridge rather than editing SQLite or scraping dashboard HTML:

```bash
npm run agent -- research <<<'{"source":"x","limit":10}'
npm run agent -- queue <<<'{"minScore":40}'
npm run agent -- schedule-next <<<'{}'
npm run agent -- schedule-inspect <<<'{"key":"https://x.com/example/status/123"}'
npm run agent -- audience <<<'{"minScore":12,"limit":30}'
npm run agent -- relationship-targets <<<'{"class":"relationship","stage":"responsive","limit":20}'
npm run agent -- relationship-inspect <<<'{"username":"example","limit":20}'
npm run agent -- relationship-events <<<'{"username":"example","limit":50}'
npm run agent -- engage-next <<<'{"refresh":true,"limit":30}'
npm run agent -- engage-draft <<<'{"key":"https://x.com/example/status/123"}'
npm run agent -- engage-resolve <<<'{"key":"https://x.com/example/status/123","action":"ignore"}'
npm run audience:sync
```

When you manually give the agent an X post, it should inspect the exact source, ingest it, research primary evidence, create/update a draft, and request `ready` only when the quality gate passes. See `docs/AGENT_WORKFLOW.md` for the full protocol and JSON examples.

## Important limitation

This project uses X's internal web GraphQL interface, not the official X API. Query IDs and private endpoints can change without notice, and automated use may carry platform-account risk. The live query-ID discovery removes one common breakage mode, but cannot make an unofficial interface contractually stable.
