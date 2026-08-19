# X Research & Publishing Automation

Local Node.js research and publishing system for `@ham_zax`. It discovers AI/developer signals, learns from saved posts, stores research in SQLite, turns sources into scored drafts, tracks account performance, and can publish approved queued drafts through authenticated HTTP GraphQL.

## Components

- `x_http.js` — validates the cookie session, discovers the live `CreateTweet` operation ID from X's current web bundle, and performs HTTP GraphQL writes.
- `post_thread.js` — dry-run, HTTP session check, HTTP thread publishing, or explicit `--browser` publishing.
- `strategy.js` — executable niche taxonomy, keyword lanes, classification, saved-preference ranking boost, and Direct/Quote/Repost/Reply/Ignore decision method.
- `audience.js` — authenticated follower/following sync with niche relevance scoring and legacy-crypto downranking.
- `tech_news.js` — X niche/viral discovery, Hacker News, GitHub, ranking, and account-performance reads.
- `store.js` — built-in `node:sqlite` research memory for candidates, saved preferences, candidate action history, audience profiles, drafts, current draft-queue state, and performance snapshots.
- `drafting.js` — Hook → Insight → Evidence → Action scaffolds and the 50-point quality gate.
- `agent_bridge.js` — stable JSON-in/JSON-out interface for another agent to ingest manual posts, draft, score, and inspect the queue.
- `dashboard.js` — Bootstrap research, Saved, Viral, Drafts, Opportunities, Audience, and Performance workbench.
- `automation.js` — research polling plus the approved-draft publishing queue.

## Operating standards

- [`docs/CONTENT_OPERATING_STANDARD.md`](docs/CONTENT_OPERATING_STANDARD.md) — hard content invariants plus good/strong/excellent standards for originals, replies, quotes, threads, and news.
- [`docs/ENGAGEMENT_INTEGRITY.md`](docs/ENGAGEMENT_INTEGRITY.md) — engagement-farming boundaries, networking rules, automation constraints, and safe growth loop.
- [`docs/NICHE_AND_KEYWORDS.md`](docs/NICHE_AND_KEYWORDS.md) — target audience, content pillars, keyword clusters, source themes, and exclusion terms.
- [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md) — exact agent contract for manually supplied posts, research, drafting, scoring, distribution decisions, audience sync, and queue interaction.
- [`docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`](docs/GROWTH_DISTRIBUTION_PLAYBOOK.md) — Direct/Quote/Repost/Reply/Ignore rules, attention prompts, relationship recruitment, and follower-quality strategy.
- [`docs/POST_GENERATION_PROMPT.md`](docs/POST_GENERATION_PROMPT.md) — canonical English writing/editing contract, semantic anchors, scannability rules, media decision, and final structured output.
- [`docs/RESEARCH_AGENDA.md`](docs/RESEARCH_AGENDA.md) — deep technical research bets and the first 30-day research program.
- [`docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`](docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md) — implementation-ready plan for Save → Triage → Route → Research → Draft → Review → Schedule → Publish → Learn.

### Planned next architecture

The current app has Saved candidates, drafts, an approved-draft queue, audience data, action history, and performance snapshots. The next implementation milestone is the human+AI workflow specified in `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`: saving creates a triage item, AI recommends a pipeline, the human chooses/overrides it, content passes research/writing/media gates, the human approves the exact final item, and a scheduler serializes main-feed publication with an urgency lane for fresh viral signals.

This paragraph describes the **planned** workflow; do not assume the triage queue, route-after-Save UI, media planner, or learned scheduler exist until their plan tasks are implemented.

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
# One research + queue cycle. AUTO_POST=false previews a ready draft only.
npm run automation:once

# Keep polling while this process/PC environment is running.
npm run automation
```

Key settings:

```dotenv
POLL_MINUTES=30
POST_INTERVAL_HOURS=4
MIN_DRAFT_SCORE=40
AUTO_POST=false
```

The automation refreshes X niche discovery, X viral discovery, GitHub, and Hacker News, then checks SQLite for the next draft explicitly marked `ready`. A ready draft must score at least `MIN_DRAFT_SCORE` (default 40/50), contain no scaffold placeholders, and fit a 280-character weighted single-post limit. `AUTO_POST=false` only previews that queue item. `AUTO_POST=true` may publish it after the configured cooldown and records the resulting tweet ID on the draft.

## Web preview

```bash
npm run web
```

Then open `http://localhost:3030/?source=x`.

Dashboard views:

- **X posts** — fresh niche-matched research with exact tags and matched keywords.
- **Viral · 24h** — rolling last-24-hour developer/AI signals with viral tier and velocity.
- **Saved** — your explicit taste/preference library.
- **Drafts** — editable Hook/Insight/Evidence/Action drafts with a live 50-point rubric and ready gate.
- **Opportunities** — technical jobs/career, builders/SaaS, and productization signals.
- **Audience** — follower/following niche map and relevant accounts to build relationships with.
- **Performance** — snapshots of `@ham_zax` followers and recent original-post metrics.
- **GitHub / Hacker News / All** — secondary discovery sources.

Use **Save** to train the preference profile and **Create draft** to move a source into the drafting workflow.

## Agent interface

Another agent should use the bridge rather than editing SQLite or scraping dashboard HTML:

```bash
npm run agent -- research <<<'{"source":"x","limit":10}'
npm run agent -- queue <<<'{"minScore":40}'
npm run agent -- audience <<<'{"minScore":12,"limit":30}'
npm run audience:sync
```

When you manually give the agent an X post, it should inspect the exact source, ingest it, research primary evidence, create/update a draft, and request `ready` only when the quality gate passes. See `docs/AGENT_WORKFLOW.md` for the full protocol and JSON examples.

## Important limitation

This project uses X's internal web GraphQL interface, not the official X API. Query IDs and private endpoints can change without notice, and automated use may carry platform-account risk. The live query-ID discovery removes one common breakage mode, but cannot make an unofficial interface contractually stable.
