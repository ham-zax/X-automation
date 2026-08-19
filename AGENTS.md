# Agent Instructions

This repository is the operating system for the `@ham_zax` X account.

The strategic architecture is **network-first**: use research to find useful conversations, build recurring relevant relationships, convert profile visits with strong owned technical content, and learn which network/content/timing decisions recruit the target developer audience.

## Account identity

Target identity: **AI-native developer + builder**.

Prefer content that gives developers leverage through AI coding agents, models/inference, devtools, infrastructure/architecture, jobs/career, builders/SaaS, and technical productization.

Every proposed original should aim for:

**signal -> insight -> evidence -> action**

Do not behave like a generic AI news account.

## Content operations

Use `agent_bridge.js` for content/research state. Do not mutate `.x-research.sqlite` directly when the bridge supports the operation.

Full protocol: `docs/AGENT_WORKFLOW.md`.

Strategic sources of truth:

- `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`
- `docs/RELATIONSHIP_INTELLIGENCE.md`
- `docs/ACCOUNT_HEALTH_AND_VISIBILITY.md`
- `docs/ALGORITHM_EVIDENCE_LEDGER.md`
- `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`
- `docs/plans/`

Key commands:

```bash
npm run agent -- ingest
npm run agent -- inspect
npm run agent -- create-draft
npm run agent -- writer-packet
npm run agent -- apply-writer-output
npm run agent -- update-draft
npm run agent -- queue
npm run agent -- route
npm run agent -- workflow
npm run agent -- research
npm run agent -- performance
npm run agent -- decide
npm run agent -- record-action
npm run agent -- relationship-targets
npm run agent -- relationship-inspect
npm run agent -- relationship-events
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
7. use `route` to select the workflow pipeline when a saved signal should move beyond Triage;
8. obtain `writer-packet` for the routed Original/Quote/Thread/Reply context and apply `docs/POST_GENERATION_PROMPT.md`;
9. persist structured output with `apply-writer-output`; this always returns edited content to `drafting` and never self-approves;
10. request `status: ready` only to move the item to `needs_review`, where deterministic gates are visible;
11. require explicit human factuality confirmation, evidence confirmation when the gate requires it, and the dashboard approval action before a main-feed text draft becomes compatibility `ready`;
12. after any successful direct/quote/repost/reply action, call `record-action` with the resulting tweet ID/URL;
13. let `automation.js` handle the normal publishing queue.

A human-approved compatibility-ready main-feed draft requires >=40/50 and a passing Phase-2 hard-gate result. Factuality is always an explicit human confirmation; evidence confirmation is required when the gate detects evidence-dependent claims. Required media cannot pass approval until Phase 3 provides real attachment readiness.

## Strict invariants

- Never invent source text, metrics, benchmarks, quotes, or test results.
- Never request review or human approval for a scaffold that still contains placeholders.
- Never silently enable `AUTO_POST`.
- Never bypass the queue for ordinary scheduled publishing.
- Never turn a source tweet into a near-copy.
- Never automate likes, follow churn, or mass unsolicited replies as growth tactics.
- Keep explicit saved-post preferences and actual performance data separate from guessed preferences.
- Preserve the standards in `docs/CONTENT_OPERATING_STANDARD.md`, `docs/ENGAGEMENT_INTEGRITY.md`, `docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`, and `docs/POST_GENERATION_PROMPT.md`.
- Treat `docs/ALGORITHM_EVIDENCE_LEDGER.md` as the authority for whether a growth claim is CODE_BACKED, OFFICIAL_PRODUCT_OR_POLICY, EMPIRICAL_VARIABLE, or RETIRED.
- Optimize network recommendations around target relevance, conversation quality, relationship potential, and qualified follower conversion; do not reduce target selection to follower count.
- Keep the executable niche taxonomy in `strategy.js` aligned with `docs/NICHE_AND_KEYWORDS.md`.
- Phase 1A triage/routing/review interfaces are current: use `queue`, `route`, and `workflow`; do not invent later scheduler/engagement interfaces from `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`.
- Phase 1B Relationship Intelligence is current: use `relationship-targets`, `relationship-inspect`, and `relationship-events` for strategic relationship reads. `audience_profiles` remains raw observation; `relationship_profiles` and append-only `relationship_events` own strategic state/history.
- Phase 2 content integration is current: use `writer-packet` / `apply-writer-output`, persisted thread/editor/gate metadata, and dashboard hard-gate review. The persisted media enum is `none|screenshot|chart|code|diagram`; actual media upload remains Phase 3 work.
- Phase 1C Engage Next remains planned. Do not invent `engage-next`, reply-drafting/sending, or other engagement-execution behavior before that phase lands.
- `docs/ACCOUNT_HEALTH_AND_VISIBILITY.md` and Phase 1D describe planned account-health/visibility behavior. Do not invent `account-health`, `health-observe`, or `health-under-the-hood` before implementation.
- Do not impose arbitrary reply quotas, human-looking delay/jitter rules, or a hard target-saturation ban. Until Phase 1D exists, treat those as editorial/empirical judgments rather than platform laws.

## Coding changes

For source changes, follow the installed Causal Coding and Ponytail skills: find the true owner, make the smallest complete change, use existing/native facilities first, avoid unrequested tests/dependencies/cleanup, inspect the final diff, and stop.
