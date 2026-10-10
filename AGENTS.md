# Agent Instructions

This repository is the operating system for the `@ham_zax` X account.

The strategic architecture is **network-first and behavior-aware**: use research to find purposeful conversations, select a plausible Hamza role before writing, build recurring relevant relationships, convert profile visits with owned work and recognizable identity, and learn which purpose/mode/affect/depth decisions recruit the target audience.

## Product interaction model

Growth OS is primarily operated by an AI agent on Hamza's behalf. The human interface supports occasional analysis, post/source selection, inspection, and intervention; it is not the required route for routine agent work. Another ChatGPT/Codex session should resume from the repository's durable persona, candidates, queue, approvals, relationships, and measurements instead of depending on this conversation's memory.

Before drafting or sending after context compaction or an incomplete-history resume, follow `docs/GROWTH_CONTEXT_RECOVERY.md`: reload the active persona, recover and revalidate the existing run, inspect unfinished attempts, restore the selected conversation and re-observe live X. Preserve the recovery document path and run/session/attempt identities in compaction checkpoints; never infer a send outcome from a chat summary.

Interpret natural instructions such as "make a post", "start engaging", a duration, or action-count bounds as an invocation of the same growth workflow. The current request narrows the work; it never bypasses persona, relevance, exact-content, delegation, health, transport, or platform boundaries. Counts are work targets/bounds, not evidence of growth and not a reason to force weak interactions. Distinguish confirmed completed actions, skipped candidates, blocked work, and uncertain outcomes. Never count preparation or dry-run decisions as public results.

Use `agent_bridge.js` for supported state operations and the authorized browser lane for live X interaction. Do not impersonate the human by clicking dashboard approval/configuration controls to obtain authority that the agent lane does not have. The dashboard must distinguish a persisted running delegation from a currently attached reasoning/browser session.

The objective is relevant follower growth, supported by purposeful posts and sustained relationships. Output volume is diagnostic. Improve from measured evidence; never promise a follower increase or infer causal attribution from a coincident account delta.

Production operator host is the ARM server: only one operator runs at a time, and WSL is test-only.

Deployment and the current runtime are documented in `docs/ARM_24X7_HANDOFF.md`.

## Account identity

Target identity: **developer + builder in tech**.

Growth Focus is preference, not a closed whitelist. Useful, surprising software discoveries and tool/resource demos are now an owner-preferred **cross-topic discovery format**, handled by the existing For You/Latest/Momentum, Viral Styles, Scout, editorial and Writer workflow—not an extra feed or an AI-only niche. Study source hooks and observed saves, verify the real project, and write a distinct contribution in the current persona. Refer to `docs/NICHE_AND_KEYWORDS.md` and `docs/GROWTH_OS_MOMENTUM_OPERATOR.md`; suggestions from recursive critique have no authority until evidence-backed learning approval.

Registered content groups describe the topics the account should lean toward; the broader configurable technical audience defines an open-world exploration surface. A strong unregistered tech topic—new tooling, hardware, chips, robotics, security, systems, another engineering field, or a newly emerging category—may compete on live momentum without first being hardcoded as a niche. AI is one pillar inside that technical identity, not the parent category.

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
npm run agent -- operator-readiness
npm run agent -- growth-run-begin
npm run agent -- growth-run-status
npm run agent -- growth-run-resume
npm run agent -- growth-run-next
npm run agent -- growth-run-finish
npm run agent -- operator-priority-set
npm run agent -- growth-focus-expand
npm run agent -- scout
npm run agent -- act
npm run agent -- publication-attempts
npm run agent -- publication-attempt-send-start
npm run agent -- publication-attempt-resolve
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
11. treat the persisted Growth Operator delegation as the owner-to-agent authority boundary. The ordinary dashboard approval lane remains available, while a running Live delegation may approve eligible Original / Quote / Thread work or a source-only Repost through mission-agent authority without setting `humanApprovedAt`; authored text still needs current content/evidence/persona gates, Repost still needs current Growth Focus/source provenance, and every route needs an exact approval snapshot;
12. for Engage Next, keep the ordinary human-reviewed exact-text lane available. Delegated autonomous evaluation may operate without per-reply approval. A persistent Growth Operator may execute an authorized Reply through its browser-agent lane when the autonomous-reply grant, exact target/text gates, Account Health, and live browser context all pass; the background Node daemon does not inherit that browser authority;
13. successful Engage Next sends record their candidate action and `our_reply` relationship event internally; use `record-action` for other successful direct/quote/repost/reply actions that are not already recorded by that path, and use `record-disposition` for an exact-candidate `skip`/`defer` that should not immediately resurface in `growth-next`;
14. use `schedule-next` / `schedule-inspect` for read-only main-feed timing decisions; these commands cannot approve, claim, or publish;
15. use authenticated X Account Analytics as a read-only outcome source when available: the Content Posts/Replies/All tables provide owned-output impressions/likes/replies/reposts, and per-output detail may additionally expose engagement rate, profile visits, new follows, bookmarks, shares, and media views; persist explicitly observed values through `analytics-record` and inspect them through `analytics`; never convert unavailable analytics to zero, and treat Audience metric/demographic/active-time views as observational context rather than ranking laws;
16. use `measurements`, `experiments`, and `experiment-summary` for Phase-4 reads. Experiment create/assign/update remains explicitly validated and non-random; a running Growth Operator delegation may perform those bounded local writes without a second confirmation ceremony;
17. use `learning` for learned-rule inspection and `learning-refresh` to compute/update inert suggestions. Manual acceptance can use qualified directional/repeated evidence; delegated autonomous acceptance is stricter and requires repeated qualified evidence with no review suspension. Delegated retirement requires an evidence-backed retirement recommendation;
18. keep live X operation reasoning-agent-owned. Continuous `automation.js` operation is disabled and must not be used as an unattended X browser/reply/publishing loop. `npm run automation:once` remains an explicit maintenance command when a human or reasoning agent intentionally invokes one bounded cycle. Fresh live X discovery, engagement selection, and browser execution belong to a Growth Run led by ChatGPT or another attached reasoning agent; Growth OS remains the deterministic state/gate/claim/reconciliation authority.

An approved main-feed text draft in an approval or queue lane requires >=40/50 and a passing purpose-aware hard-gate result. Compatibility `draft.status=ready` is retained for authored-content integrity but is no longer publication selection authority; the approved main-feed queue row plus scheduler owns publication selection. Ordinary approval uses the dashboard lane. A running Live Growth Operator delegation may instead use the mission-agent approval path for Original / Quote / Thread and source-only Repost, and must not populate `humanApprovedAt`. Reaching a follower milestone does not revoke delegation. The background API transport still rejects local media; browser publication may use only the exact temporary `x-growth.queue.<id>.media` artifact created by `browser-publish-claim` from the current `.x-media` attachment.

Delegated scout → act path: under a running Live Growth Operator delegation, `scout` returns read-only ranked cards (a T0 mentions check first, one independently evaluated T2 original idea, then ranked T1 conversations from which the agent chooses Reply or Quote per source context), and the reasoning agent writes text for one card. `act` then runs one deterministic bridge operation: validate `action`, `text`, and target; check the run lease when a `runId` is supplied; run attribution and near-copy checks against the card source; check the duplicate fence; atomically claim the exact action, which also checks Account Health and the live delegation grant; record send-start at the browser click; send through the x.com intent URL; confirm; and reconcile. On this path the blocking checks are objective only: duplicate/near-copy fence, attribution checks, no re-send of an uncertain attempt, Account Health not CONSTRAINED, length and placeholders, live delegation grant, and run lease. The 50-point score, LLM content review, and persona tone are advisory there: they rank and log but do not block. The path never sets `humanApprovedAt`. Original, Quote and Reply decisions remain independent and opportunity-led, but Originals now require a reviewed queued draft rather than quick act; no daily cap, fixed post interval, fixed measurement tier/velocity/niche cutoff, or compulsory minimum action count. The agent may act on every distinct worthwhile observed source—even 20 or more—within run resource and safety boundaries. Source momentum and topical metrics inform ordering, never grant publication authority or automatically require an action; Luna evaluates actual post value and skips filler. The atomic target/near-copy/uncertain-send fences still apply. **Owner rhythm:** ordinary run-bound sends pause during 01:00–08:30 Asia/Kolkata (configurable); Replies are the primary daytime activity. Originals/Quotes need substantive `editorial` justification and verified sources. Rapid independently observed like/reply acceleration or a newly verified first-hand major model launch/research breakthrough overrides the rest/cadence timing, but does NOT waive evidence, quality, grant/lease, Account Health, single-attempt or reconciliation gates. The direct `act` Original path is now denied: all standalone Originals and Threads must use the existing Writer, independent content-review and approved-queue claim process. Source-linked X Originals/Threads additionally require claim-by-claim evidence from a linked primary document; changing reviewed evidence after approval invalidates authorization. The dashboard approval lane and older Writer/approval routes retain their normal gates.

## Strict invariants

- Never request review or human approval for a scaffold that still contains placeholders.
- Never silently enable `AUTO_POST`.
- Never bypass the queue for ordinary scheduled publishing.
- Never bypass repository authority/content gates when using the x.com UI. For ARM XGrowth, honor the explicitly selected `X_GROWTH_BROWSER_INTERFACE` (currently `agent-browser-cli` on the existing authenticated Chromium CDP 9222) and `ops/browser_operator_contract.js`. CLI browser commands are observational/pre-send only; all public sends remain behind Growth OS `act` (Reply/Quote) or the approved-queue `browser-publish-claim` (Original/Thread/Repost). An explicitly selected `webharness-mcp` mode uses its typed MCP observe/execute surface, without a silent mid-run interface change. Discard stale element refs on navigation and re-observe the exact tab. The legacy repository Clearcote/xactions writer is not an eligible raw fallback because its reply-target integrity previously failed verification. For `continue growing`, use the durable Growth Run contract in `docs/GROWTH_RUN_PROTOCOL.md`; run-bound public claims must include the current `runId` and `sessionId` and own the active operator lease. For due approved Original/Quote/Thread/Repost work, atomically claim the exact queue row with `browser-publish-claim`; for an approved or autonomous Reply, claim the exact persisted reply authority with `browser-reply-claim`. Each claim creates an immutable publication `attemptId` that stores its run/session provenance. A claimed media attachment is exposed only as the temporary logical `browserMediaArtifact`; never substitute the local path. Re-observe the exact tab/source immediately before a consequential send, call `publication-attempt-send-start` with that exact attempt ID only, execute once, never blind-retry an unknown result, verify exact text/parent/quote/thread/repost/media structure as applicable, then reconcile through `record-action` with the same attempt ID. Failure to find an output is not proof of `confirmed_not_sent`; that state requires definitive transport evidence that the mutation was never dispatched or was rejected before acceptance. Otherwise keep the attempt investigating or close `closed_unresolved` with evidence when useful recovery is exhausted. Do not start or re-enable the continuous `automation.js` daemon to obtain live-X activity; live X browsing/selection/execution requires an attached reasoning-agent Growth Run.
- Understandability is a hard content invariant. Humor, wit, attitude, technical vocabulary, and a smart voice are allowed; if most technically curious readers would still have to decode the sentence before getting the point, rewrite it before approval or send.
- Never turn a source tweet into a near-copy.
- Keep explicit saved-post preferences and actual performance data separate from guessed preferences.
- Preserve the standards in `docs/CONTENT_OPERATING_STANDARD.md`, `docs/NETWORK_GROWTH_OPERATING_SYSTEM.md`, `docs/RELATIONSHIP_INTELLIGENCE.md`, and `docs/POST_GENERATION_PROMPT.md`. `docs/GROWTH_DISTRIBUTION_PLAYBOOK.md`, historical plans, and retired bootstrap notes are supporting evidence/history, not higher-priority behavior constitutions.
- Do not treat cold `relationshipPotential = 0`, account size, or lack of a technical wrinkle as sufficient reasons to ignore an otherwise purposeful opportunity. Repost, concise Quote, useful Reply, judgment, support, humor, or silence remain available according to the selected behavior and current authority boundaries.
- The live product owner policy in SQLite (`growth-policy`, `#/settings/publishing`, `docs/GROWTH_PRODUCT_POLICY.md`) is authoritative for rest, publication lane enablement/optional daily limits, social Follow/Like/Repost enablement and safety ceilings, topic/code priorities, breakout thresholds, and measured follower-tier selectivity. Follow/Like/Repost use a separate mutation ledger: social-status → social-claim → social-start → exact-target mutation → social-resolve. A Repost uses an additional social-repost-menu-start before its final confirmation; a Quote uses canonical act with an additive editorial take. NEVER automate Unfollow; it remains human-only. Do not substitute prompt defaults for saved settings. Persona identity and stances remain separately owner-configurable under the existing Voice & preferences feature. `growth-analysis` supplies measured—not imagined—style and engagement feedback for later runs; an independent analytics collector uses read-only X browsing and `analytics-record` to refresh it.
- Treat `docs/ALGORITHM_EVIDENCE_LEDGER.md` as a non-authoritative evidence registry for claims about X mechanisms/tactics. Code, policy, and account observations must remain distinguishable, but the ledger does not define Hamza's personality, content purpose, route, or strategy.
- Optimize network recommendations around target relevance, conversation quality, relationship potential, and qualified follower conversion; do not reduce target selection to follower count.
- Growth Focus is the runtime source of truth for preferred niche groups and the broader technical exploration universe. `strategy.js` supplies configurable defaults and schema/normalization only; content/audience groups may be added, removed, renamed, reweighted, disabled, or rebalanced without code changes. Registered groups receive preference; unregistered topics inside the broader configured technical scope remain eligible as exploratory opportunities. Keep `docs/NICHE_AND_KEYWORDS.md` aligned with defaults, not as a competing whitelist.
- Phase 1A triage/routing/review interfaces remain current: use `queue`, `route`, and `workflow`; the dashboard remains the ordinary owner approval path, while an active Growth Operator delegation is the bounded mission-agent path for eligible Original / Quote / Thread work and source-only Repost approval.
- Phase 1B Relationship Intelligence is current: use `relationship-targets`, `relationship-inspect`, and `relationship-events` for strategic relationship reads. `audience_profiles` remains raw observation; `relationship_profiles` and append-only `relationship_events` own strategic state/history.
- Phase 2 content integration is current: use `writer-packet` / `apply-writer-output`, persisted thread/editor/gate metadata, and dashboard hard-gate review. The persisted media enum is `none|screenshot|chart|code|diagram`; operator-attached JPEG/PNG/WebP/GIF images provide real attachment readiness. Browser publication registers the current `.x-media` file into the `browser-fast` artifact allowlist only at atomic claim time and removes that entry after verified reconciliation; the background API transport remains media-incapable.
- Phase 1C Engage Next is current: use cached `engage-next` reads by default. Fresh `x_for_you` ingestion materializes those exact observed candidates directly into engagement work; `engage-refresh` is a bounded local re-evaluation tool and must not perform unrelated network/source refresh work. Use `engage-draft` / `engage-resolve` for the human-reviewed path. Active conversation responses outrank comparable cold opportunities; no legitimate purpose means no item; saturation/repetition remain soft. Human sends still require exact human-approved text. The separate autonomous path is off by default and can run continuously in Dry run or Live mode across active, momentum, and normal relevant X observations under its explicit persisted grant and remaining operator budget; autonomous decisions never set `humanApprovedAt`.
- Phase 3 main-feed distribution is current: `scheduler.js` owns pure timing decisions for Original/Quote/Thread/Repost; `schedule-next` / `schedule-inspect` are read-only; queue timing overrides are explicit human metadata independent of approval. The background daemon atomically claims only a route supported by its official API transport. The persistent Growth Operator may atomically claim Original/Quote/Thread/Repost through `browser-publish-claim`; native Repost remains rare by strategy but is not manual-only. Failed or unknown sends remain inspectable and are never silently retried.
- Engagement replies are never eligible for the main-feed scheduler. Editing or rerouting a human-approved reply invalidates approval. Autonomous replies use the reply operator inside the existing daemon, not main-feed approval or `AUTO_POST`. Every successful human or autonomous reply records the candidate action and relationship event exactly once.
- Phase 1D Account Health is current: use `account-health` for structured diagnostics, `health-observe` only for explicit provenance-backed observations, and `health-under-the-hood` for the bounded authenticated visibility report. An unavailable Under-the-Hood read is not health evidence; WATCH remains advisory, while CONSTRAINED requires supported observed hard evidence or an explicit provenance-backed project/platform constraint.
- Phase 4 measurement/experiments is current: published main-feed rows own fixed 15m/1h/6h/24h measurement identity; actual capture time is preserved; follower deltas are associated and carry attribution confidence; audience `first_seen_at` supports period-level new-follower quality; experiment assignment is explicit/non-random and never creates duplicate/near-duplicate A/B posts; cohort summaries retain sample/confounder/health-network context and cannot self-promote a permanent strategy rule.
- Phase 5 Learned Strategy is current: suggested rules are zero-effect; manual acceptance requires qualified directional/repeated evidence, while delegated autonomous acceptance requires repeated qualified evidence and no active review suspension; only accepted rules are supplied to production scorers; every adjustment is bounded and inspectable; retired rules remain historical and zero-effect. Learning cannot bypass hard content/provenance gates, expiry, owner-only scope/timing overrides, delegated-authority revocation, or provenance-backed CONSTRAINED health evidence, and low reach alone can never create a health constraint.
- Do not impose arbitrary reply quotas, human-looking delay/jitter rules, hidden risk/reputation scores, or a hard target-saturation ban. Saturation, repetition, concentration, interaction volume, and InteractionYield remain transparent `EMPIRICAL_VARIABLE` diagnostics/cohort variables rather than platform laws.

## Coding changes

For source changes, follow the installed Causal Coding and Ponytail skills: find the true owner, make the smallest complete change, use existing/native facilities first, avoid unrequested tests/dependencies/cleanup, inspect the final diff, and stop.
