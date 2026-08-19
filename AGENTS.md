# Agent Instructions

This repository is the operating system for the `@ham_zax` X account.

## Account identity

Target identity: **AI-native developer + builder**.

Prefer content that gives developers leverage through AI coding agents, models/inference, devtools, infrastructure/architecture, jobs/career, builders/SaaS, and technical productization.

Every proposed original should aim for:

**signal -> insight -> evidence -> action**

Do not behave like a generic AI news account.

## Content operations

Use `agent_bridge.js` for content/research state. Do not mutate `.x-research.sqlite` directly when the bridge supports the operation.

Full protocol: `docs/AGENT_WORKFLOW.md`.

Key commands:

```bash
npm run agent -- ingest
npm run agent -- inspect
npm run agent -- create-draft
npm run agent -- update-draft
npm run agent -- queue
npm run agent -- research
npm run agent -- performance
npm run agent -- decide
npm run agent -- record-action
npm run agent -- audience
npm run agent -- audience-sync
```

Commands read JSON from stdin and return JSON to stdout.

When a user manually supplies an X post or URL:

1. inspect the exact source and surrounding context;
2. ingest the exact text/metrics available;
3. verify time-sensitive or technical claims against primary sources;
4. use `decide` plus `docs/GROWTH_DISTRIBUTION_PLAYBOOK.md` to choose DIRECT / QUOTE / REPOST / REPLY / IGNORE;
5. create an original angle rather than paraphrasing the source;
6. use `docs/POST_GENERATION_PROMPT.md` for the final writing/editing pass when producing outbound text;
7. update the Hook/Insight/Evidence/Action draft when a standalone post is appropriate;
8. request `ready` only after the bridge accepts the quality gate;
9. after any successful direct/quote/repost/reply action, call `record-action` with the resulting tweet ID/URL;
10. let `automation.js` handle the normal publishing queue.

A ready single-post draft requires >=40/50, no scaffold placeholders, and <=280 weighted characters.

## Strict invariants

- Never invent source text, metrics, benchmarks, quotes, or test results.
- Never mark placeholder scaffolds ready.
- Never silently enable `AUTO_POST`.
- Never bypass the queue for ordinary scheduled publishing.
- Never turn a source tweet into a near-copy.
- Never automate likes, follow churn, or mass unsolicited replies as growth tactics.
- Keep explicit saved-post preferences and actual performance data separate from guessed preferences.
- Preserve the standards in `docs/CONTENT_OPERATING_STANDARD.md`, `docs/ENGAGEMENT_INTEGRITY.md`, `docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`, and `docs/POST_GENERATION_PROMPT.md`.
- Keep the executable niche taxonomy in `strategy.js` aligned with `docs/NICHE_AND_KEYWORDS.md`.
- `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md` describes planned behavior. Do not pretend its future triage/route/scheduler interfaces exist until implemented.

## Coding changes

For source changes, follow the installed Causal Coding and Ponytail skills: find the true owner, make the smallest complete change, use existing/native facilities first, avoid unrequested tests/dependencies/cleanup, inspect the final diff, and stop.
