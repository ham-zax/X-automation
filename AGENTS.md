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
npm run agent -- schedule-next
npm run agent -- schedule-inspect
npm run agent -- route
npm run agent -- workflow
npm run agent -- research
npm run agent -- performance
npm run agent -- measurements
npm run agent -- experiments
npm run agent -- experiment-create
npm run agent -- experiment-assign
npm run agent -- experiment-summary
npm run agent -- decide
npm run agent -- record-action
npm run agent -- relationship-targets
npm run agent -- relationship-inspect
npm run agent -- relationship-events
npm run agent -- engage-next
npm run agent -- engage-draft
npm run agent -- engage-resolve
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
12. for Engage Next, let `engage-draft` create/update reviewable reply text but never self-approve; only the dashboard human action may snapshot the exact approved reply, and `engage-resolve` may send only that already-approved text;
13. successful Engage Next sends record their candidate action and `our_reply` relationship event internally; use `record-action` for other successful direct/quote/repost/reply actions that are not already recorded by that path;
14. use `schedule-next` / `schedule-inspect` for read-only main-feed timing decisions; these commands cannot approve, claim, or publish;
15. use `measurements`, `experiments`, and `experiment-summary` for Phase-4 reads; `experiment-create` and `experiment-assign` require explicit confirmation and assignment remains caller-selected rather than randomized;
16. use `learning` for learned-rule inspection and `learning-refresh` to compute/update inert suggestions from explicit experiment comparisons; `learning-accept` / `learning-retire` require explicit confirmation and are the only bridge paths that change production learned-rule status;
17. let `automation.js` capture due read-only measurement windows, refresh Engage Next, and consume the human-approved main-feed queue through `scheduler.js`; `AUTO_POST=false` must still stop before publication claim/transport, and the daemon must never send engagement replies.

A human-approved main-feed text draft requires >=40/50 and a passing Phase-2 hard-gate result. Compatibility `draft.status=ready` is retained for approved-content integrity but is no longer publication selection authority; the approved main-feed queue row plus scheduler owns automatic publication selection. Factuality is always an explicit human confirmation; evidence confirmation is required when the gate detects evidence-dependent claims. Required media is schedulable only when a real operator-attached image is present and the media plan is complete; the authenticated publication transport uploads that attachment at send time.

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
- Phase 1A triage/routing/review interfaces remain current: use `queue`, `route`, and `workflow`; only explicit dashboard human approval may create an approved main-feed queue item.
- Phase 1B Relationship Intelligence is current: use `relationship-targets`, `relationship-inspect`, and `relationship-events` for strategic relationship reads. `audience_profiles` remains raw observation; `relationship_profiles` and append-only `relationship_events` own strategic state/history.
- Phase 2 content integration is current: use `writer-packet` / `apply-writer-output`, persisted thread/editor/gate metadata, and dashboard hard-gate review. The persisted media enum is `none|screenshot|chart|code|diagram`; operator-attached JPEG/PNG/WebP/GIF images provide real attachment readiness, and required media stays blocked until an attachment plus complete media plan exists.
- Phase 1C Engage Next is current: use `engage-next`, `engage-draft`, and `engage-resolve`. Active conversation responses are refreshed before cold opportunities; no concrete contribution means no item; saturation/repetition remain soft; every outbound reply requires exact human-approved text and one explicit send action.
- Phase 3 main-feed distribution is current: `scheduler.js` owns pure timing decisions; `schedule-next` / `schedule-inspect` are read-only; queue timing overrides are explicit human metadata independent of approval; enabled automation must atomically claim one approved Original/Quote/Thread row before transport. Repost remains manual, scheduler spacing is `EMPIRICAL_VARIABLE`, and failed sends remain inspectable rather than silently retried.
- Engagement replies are never eligible for the main-feed scheduler or daemon publication. Editing or rerouting an approved reply invalidates approval; a successful explicit send records the reply once in candidate action history and relationship history.
- Phase 1D Account Health is current: use `account-health` for structured diagnostics, `health-observe` only for explicit provenance-backed observations, and `health-under-the-hood` for the bounded authenticated visibility report. An unavailable Under-the-Hood read is not health evidence; WATCH remains advisory, while CONSTRAINED requires supported observed hard evidence or an explicit provenance-backed project/platform constraint.
- Phase 4 measurement/experiments is current: published main-feed rows own fixed 15m/1h/6h/24h measurement identity; actual capture time is preserved; follower deltas are associated and carry attribution confidence; audience `first_seen_at` supports period-level new-follower quality; experiment assignment is explicit/non-random and never creates duplicate/near-duplicate A/B posts; cohort summaries retain sample/confounder/health-network context and cannot self-promote a permanent strategy rule.
- Phase 5 Learned Strategy is current: suggested rules are zero-effect; human acceptance requires qualified directional/repeated evidence; only accepted rules are supplied to production scorers; every adjustment is bounded and inspectable; retired rules remain historical and zero-effect. Learning cannot bypass hard content gates, expiry, required human approval, explicit manual route/schedule choices, or provenance-backed CONSTRAINED health evidence, and low reach alone can never create a health constraint.
- Do not impose arbitrary reply quotas, human-looking delay/jitter rules, hidden risk/reputation scores, or a hard target-saturation ban. Saturation, repetition, concentration, interaction volume, and InteractionYield remain transparent `EMPIRICAL_VARIABLE` diagnostics/cohort variables rather than platform laws.

## Coding changes

For source changes, follow the installed Causal Coding and Ponytail skills: find the true owner, make the smallest complete change, use existing/native facilities first, avoid unrequested tests/dependencies/cleanup, inspect the final diff, and stop.
