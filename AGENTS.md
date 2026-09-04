# Agent Instructions

This repository is the operating system for the `@ham_zax` X account.

The strategic architecture is **network-first and behavior-aware**: use research to find purposeful conversations, select a plausible Hamza role before writing, build recurring relevant relationships, convert profile visits with owned work and recognizable identity, and learn which purpose/mode/affect/depth decisions recruit the target audience.

## Account identity

Target identity: **developer + builder in tech**.

Growth Focus is preference, not a closed whitelist. Registered content groups describe the topics the account should lean toward; the broader configurable technical audience defines an open-world exploration surface. A strong unregistered tech topic—new tooling, hardware, chips, robotics, security, systems, another engineering field, or a newly emerging category—may compete on live momentum without first being hardcoded as a niche. AI is one pillar inside that technical identity, not the parent category.

Universal operating principle:

> **Every public action needs a purpose. Not every public action needs information.**

An Original may use `signal -> insight -> evidence -> action` when that fits a technical job. It is not a universal prose template. Do not behave like a generic AI news account or a bot that manufactures a technical wrinkle under every source.

## Content operations

Use `agent_bridge.js` for content/research state. Do not mutate `.x-research.sqlite` directly when the bridge supports the operation.

Full protocol: `docs/AGENT_WORKFLOW.md`.

Current operating contracts:

- `docs/CONTENT_OPERATING_STANDARD.md` — universal outbound-content and purpose/provenance contract;
- `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md` — growth and network strategy;
- `docs/RELATIONSHIP_INTELLIGENCE.md` — relationship state and interaction outcomes;
- `docs/POST_GENERATION_PROMPT.md` — final Writer realization contract;
- `docs/ACCOUNT_HEALTH_AND_VISIBILITY.md` — health/visibility evidence and constraints;
- `behavior.js` — shared purpose/mode/affect/depth vocabulary;
- `persona.js` plus `persona/hamza-v1.json` — versioned experimental persona owner.

Research, historical plans, and `docs/ALGORITHM_EVIDENCE_LEDGER.md` may inform decisions. They are not parallel content constitutions.

Key commands:

```bash
npm run agent -- ingest
npm run agent -- inspect
npm run agent -- create-draft
npm run agent -- writer-packet
npm run agent -- apply-writer-output
npm run agent -- update-draft
npm run agent -- queue
npm run agent -- operator-status
npm run agent -- operator-memory-review
npm run agent -- schedule-next
npm run agent -- schedule-inspect
npm run agent -- route
npm run agent -- workflow
npm run agent -- research
npm run agent -- performance
npm run agent -- analytics
npm run agent -- analytics-record
npm run agent -- growth-refresh
npm run agent -- growth-next
npm run agent -- measurements
npm run agent -- experiments
npm run agent -- experiment-create
npm run agent -- experiment-assign
npm run agent -- experiment-summary
npm run agent -- decide
npm run agent -- record-action
npm run agent -- record-disposition
npm run agent -- relationship-targets
npm run agent -- relationship-inspect
npm run agent -- relationship-events
npm run agent -- persona-model
npm run agent -- persona-stances
npm run agent -- persona-stance-record
npm run agent -- behavior-select
npm run agent -- engage-next
npm run agent -- engage-refresh
npm run agent -- engage-draft
npm run agent -- engage-resolve
npm run agent -- audience
npm run agent -- audience-sync
```

Commands read JSON from stdin and return JSON to stdout.

When a user manually supplies an X post or URL:

1. inspect the exact source and surrounding context;
2. persist the exact text/metrics available when the source should enter research memory; for an immediate live action or exact skip/defer, `record-action` / `record-disposition` may capture the live source inline without a separate `ingest` round trip;
3. start with `operator-status` for the compact cross-lane cockpit, then use `growth-next` as the detailed read-only view over the current last-known-good X Latest, X Momentum, GitHub Trending, and HN Top snapshots; use `growth-refresh` explicitly when source state needs refreshing, but never block next-action selection on a slow refresh; for an X interaction, inspect the exact live source before acting, while GitHub/HN candidates normally feed owned Original/Thread research rather than borrowed-distribution actions;
4. use the current purpose-aware route/behavior decision plus `docs/CONTENT_OPERATING_STANDARD.md` and `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md` to choose DIRECT / QUOTE / REPOST / REPLY / IGNORE; account size and momentum may influence opportunity value but do not override purpose/persona selection;
5. create an original angle rather than paraphrasing the source when authoring text; a Repost may amplify a strong source without forcing commentary when amplification is the selected purpose;
6. use `docs/POST_GENERATION_PROMPT.md` for the final writing/editing pass when producing outbound text; transfer viral structure/information density rather than wording;
7. use `route` to select the workflow pipeline when a saved signal should move beyond Triage;
8. obtain `writer-packet` for the routed Original/Quote/Thread/Reply context and apply `docs/POST_GENERATION_PROMPT.md`; its `candidate.sourceStyle` is observational shape evidence, not permission to copy the source;
9. persist structured output with `apply-writer-output`; this always returns edited content to `drafting` and never self-approves;
10. request `status: ready` only to move the item to `needs_review`, where deterministic gates are visible;
11. treat the persisted Growth Operator delegation as the owner-to-agent authority boundary. The ordinary dashboard approval lane remains available, while a running Live delegation may approve eligible Original / Quote / Thread work through mission-agent authority without setting `humanApprovedAt`; every item still needs current content/evidence/provenance gates and an exact approval snapshot;
12. for Engage Next, keep the ordinary human-reviewed exact-text lane available. Delegated autonomous evaluation may operate without per-reply approval. A persistent Growth Operator may execute an authorized Reply through its browser-agent lane when the autonomous-reply grant, exact target/text gates, Account Health, and live browser context all pass; the background Node daemon does not inherit that browser authority;
13. successful Engage Next sends record their candidate action and `our_reply` relationship event internally; use `record-action` for other successful direct/quote/repost/reply actions that are not already recorded by that path, and use `record-disposition` for an exact-candidate `skip`/`defer` that should not immediately resurface in `growth-next`;
14. use `schedule-next` / `schedule-inspect` for read-only main-feed timing decisions; these commands cannot approve, claim, or publish;
15. use authenticated X Account Analytics as a read-only outcome source when available: the Content Posts/Replies/All tables provide owned-output impressions/likes/replies/reposts, and per-output detail may additionally expose engagement rate, profile visits, new follows, bookmarks, shares, and media views; persist explicitly observed values through `analytics-record` and inspect them through `analytics`; never convert unavailable analytics to zero, and treat Audience metric/demographic/active-time views as observational context rather than ranking laws;
16. use `measurements`, `experiments`, and `experiment-summary` for Phase-4 reads. Experiment create/assign/update remains explicitly validated and non-random; a running Growth Operator delegation may perform those bounded local writes without a second confirmation ceremony;
17. use `learning` for learned-rule inspection and `learning-refresh` to compute/update inert suggestions. Manual acceptance can use qualified directional/repeated evidence; delegated autonomous acceptance is stricter and requires repeated qualified evidence with no review suspension. Delegated retirement requires an evidence-backed retirement recommendation;
18. let `automation.js` capture due measurements, refresh real X/Engage Next inputs, run dry-run autonomous reply evaluation, prepare delegated Original / Quote / Thread work while Growth Operator delegation is eligible, and consume valid human- or mission-agent-approved main-feed work through `scheduler.js`. `AUTO_POST=true` never creates transport capability; the background Node daemon remains official-API-only. Separately, a persistent Growth Operator may execute already-authorized work through the browser-agent lane described below and reconcile the verified result through Growth OS.

An approved main-feed text draft requires >=40/50 and a passing purpose-aware hard-gate result. Compatibility `draft.status=ready` is retained for approved-content integrity but is no longer publication selection authority; the approved main-feed queue row plus scheduler owns automatic publication selection. Ordinary approval uses the dashboard lane. A running Live Growth Operator delegation may instead use the mission-agent approval path for Original / Quote / Thread and must not populate `humanApprovedAt`. Reaching a follower milestone does not revoke delegation. Required media remains blocked until the official API transport has a compliant media-upload owner.

## Strict invariants

- Never request review or human approval for a scaffold that still contains placeholders.
- Never silently enable `AUTO_POST`.
- Never bypass the queue for ordinary scheduled publishing.
- Never bypass repository authority/content gates when using the x.com UI. For persistent-agent browser writes, use the installed `agent-browser` routing contract: prefer the harness-owned logical `browser-fast` MCP surface; use `browser-devtools` only for diagnostics; if Local/MCP is unavailable, use a named `agent-browser` CLI session; use a repository-owned raw browser/Puppeteer/Clearcote adapter only as an explicit last fallback. Re-observe the exact tab/source immediately before a consequential send, execute once, never blind-retry an unknown result, verify the exact public action, then reconcile its ID/URL through Growth OS. The background Node daemon remains official-API-only unless a separate transport is implemented.
- Understandability is a hard content invariant. Humor, wit, attitude, technical vocabulary, and a smart voice are allowed; if most technically curious readers would still have to decode the sentence before getting the point, rewrite it before approval or send.
- Never turn a source tweet into a near-copy.
- Keep explicit saved-post preferences and actual performance data separate from guessed preferences.
- Preserve the standards in `docs/CONTENT_OPERATING_STANDARD.md`, `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`, `docs/RELATIONSHIP_INTELLIGENCE.md`, and `docs/POST_GENERATION_PROMPT.md`. `docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`, historical plans, and retired bootstrap notes are supporting evidence/history, not higher-priority behavior constitutions.
- Do not treat cold `relationshipPotential = 0`, account size, or lack of a technical wrinkle as sufficient reasons to ignore an otherwise purposeful opportunity. Repost, concise Quote, useful Reply, judgment, support, humor, or silence remain available according to the selected behavior and current authority boundaries.
- Treat `docs/ALGORITHM_EVIDENCE_LEDGER.md` as a non-authoritative evidence registry for claims about X mechanisms/tactics. Code, policy, and account observations must remain distinguishable, but the ledger does not define Hamza's personality, content purpose, route, or strategy.
- Optimize network recommendations around target relevance, conversation quality, relationship potential, and qualified follower conversion; do not reduce target selection to follower count.
- Growth Focus is the runtime source of truth for preferred niche groups and the broader technical exploration universe. `strategy.js` supplies configurable defaults and schema/normalization only; content/audience groups may be added, removed, renamed, reweighted, disabled, or rebalanced without code changes. Registered groups receive preference; unregistered topics inside the broader configured technical scope remain eligible as exploratory opportunities. Keep `docs/NICHE_AND_KEYWORDS.md` aligned with defaults, not as a competing whitelist.
- Phase 1A triage/routing/review interfaces remain current: use `queue`, `route`, and `workflow`; the dashboard remains the ordinary owner approval path, while an active Growth Operator delegation is the bounded mission-agent path for eligible Original / Quote / Thread work.
- Phase 1B Relationship Intelligence is current: use `relationship-targets`, `relationship-inspect`, and `relationship-events` for strategic relationship reads. `audience_profiles` remains raw observation; `relationship_profiles` and append-only `relationship_events` own strategic state/history.
- Phase 2 content integration is current: use `writer-packet` / `apply-writer-output`, persisted thread/editor/gate metadata, and dashboard hard-gate review. The persisted media enum is `none|screenshot|chart|code|diagram`; operator-attached JPEG/PNG/WebP/GIF images provide real attachment readiness, and required media stays blocked until an attachment plus complete media plan exists.
- Phase 1C Engage Next is current: use cached `engage-next` reads by default, `engage-refresh` when freshness can change the action, and `engage-draft` / `engage-resolve` for the human-reviewed path. Active conversation responses outrank comparable cold opportunities; no legitimate purpose means no item; saturation/repetition remain soft. Human sends still require exact human-approved text. The separate autonomous path is off by default and can run continuously in Dry run or Live mode across active, momentum, and normal relevant X observations under its explicit persisted grant and remaining operator budget; autonomous decisions never set `humanApprovedAt`.
- Phase 3 main-feed distribution is current: `scheduler.js` owns pure timing decisions; `schedule-next` / `schedule-inspect` are read-only; queue timing overrides are explicit human metadata independent of approval; enabled automation must atomically claim one approved Original/Quote/Thread row before transport. Repost remains manual, scheduler spacing is `EMPIRICAL_VARIABLE`, and failed sends remain inspectable rather than silently retried.
- Engagement replies are never eligible for the main-feed scheduler. Editing or rerouting a human-approved reply invalidates approval. Autonomous replies use the reply operator inside the existing daemon, not main-feed approval or `AUTO_POST`. Every successful human or autonomous reply records the candidate action and relationship event exactly once.
- Phase 1D Account Health is current: use `account-health` for structured diagnostics, `health-observe` only for explicit provenance-backed observations, and `health-under-the-hood` for the bounded authenticated visibility report. An unavailable Under-the-Hood read is not health evidence; WATCH remains advisory, while CONSTRAINED requires supported observed hard evidence or an explicit provenance-backed project/platform constraint.
- Phase 4 measurement/experiments is current: published main-feed rows own fixed 15m/1h/6h/24h measurement identity; actual capture time is preserved; follower deltas are associated and carry attribution confidence; audience `first_seen_at` supports period-level new-follower quality; experiment assignment is explicit/non-random and never creates duplicate/near-duplicate A/B posts; cohort summaries retain sample/confounder/health-network context and cannot self-promote a permanent strategy rule.
- Phase 5 Learned Strategy is current: suggested rules are zero-effect; manual acceptance requires qualified directional/repeated evidence, while delegated autonomous acceptance requires repeated qualified evidence and no active review suspension; only accepted rules are supplied to production scorers; every adjustment is bounded and inspectable; retired rules remain historical and zero-effect. Learning cannot bypass hard content/provenance gates, expiry, owner-only scope/timing overrides, delegated-authority revocation, or provenance-backed CONSTRAINED health evidence, and low reach alone can never create a health constraint.
- Do not impose arbitrary reply quotas, human-looking delay/jitter rules, hidden risk/reputation scores, or a hard target-saturation ban. Saturation, repetition, concentration, interaction volume, and InteractionYield remain transparent `EMPIRICAL_VARIABLE` diagnostics/cohort variables rather than platform laws.

## Coding changes

For source changes, follow the installed Causal Coding and Ponytail skills: find the true owner, make the smallest complete change, use existing/native facilities first, avoid unrequested tests/dependencies/cleanup, inspect the final diff, and stop.
