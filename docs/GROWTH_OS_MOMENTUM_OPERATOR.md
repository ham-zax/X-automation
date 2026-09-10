# Growth OS Momentum Operator

**Status:** active momentum-discovery/operator reference, added 2026-08-25; purpose/persona authority updated 2026-09-04.

This document turns the earlier cold-start observations into an agent-operable Growth OS discovery loop. `FIRST_1000_GROWTH_MODE.md` is now historical evidence only; current action legitimacy and behavior selection come from the canonical content/network contracts and active persona. This document still describes how an operating agent finds live opportunities without getting stranded between Discover, Viral Styles, routing, and the X browser.

To start or resume a continuous operating session, use [`PERSISTENT_GROWTH_OPERATOR_PROMPT.md`](PERSISTENT_GROWTH_OPERATOR_PROMPT.md). It defines the invocation contract, reward hierarchy, anti-drift checks, completion criteria, authority boundaries, and continuation behavior; this document remains the design and evidence reference for momentum operation.

## Live findings that triggered the redesign

The 2026-08-25 operating session produced a useful contrast.

A standalone Original published at 08:58 IST:

> The agent race is quietly moving down the stack.

X Post Analytics showed, after about 32 minutes:

- 2 impressions;
- 0 engagements;
- 0 detail expands;
- 0 profile visits.

A different no-hashtag standalone Original from about 14 hours earlier showed:

- 8 impressions;
- 1 engagement;
- 0 detail expands;
- 0 profile visits.

A Quote from about 9 hours earlier showed:

- 67 impressions;
- 6 engagements;
- 3 detail expands;
- 0 profile visits.

These are tiny samples and do not establish an X ranking law. They do establish an account-level operating fact: at roughly 42 followers, owned-only posts can receive almost no initial distribution, while participation attached to an existing source can expose the account to a larger distribution surface.

The session also repeatedly found live sources with tens of thousands to hundreds of thousands of views. Replies and Reposts could enter those active source graphs immediately. Several sources gained thousands of views during the few minutes used to inspect and reply. That makes elapsed time a real operating cost even though the exact algorithmic value of first-hour timing remains an `EMPIRICAL_VARIABLE`.

A controlled hashtag probe was also started on live post `2092100349234684010` using exactly `#OxAlpha #OpenRouter`. At about 22 minutes it showed 13 impressions, 1 engagement, 1 detail expand, and 0 profile visits. That cleared the earlier 2-impression cold-start floor, but the probe is intentionally non-causal: topic, timing, active Ox Alpha trend momentum, copy specificity, and hashtags all changed together. Treat it as a reason to keep measuring, not proof that hashtags caused the lift.

## The usability failure

Growth OS had the right pieces but made the agent assemble them manually:

- X Latest supplied recency.
- X Momentum supplied viral velocity.
- source observations could calculate metric deltas.
- distribution routing knew about Reply / Quote / Repost / Original.
- Viral Styles extracted hook and shape features.
- Writing Strategy could use retrospective viral evidence.
- the live browser remained authoritative for thread context and actual publication.

The pieces did not converge into one answer to the operating question:

> What purposeful Hamza action—technical, social, relational, supportive, humorous, amplifying, or silent—best fits this live context, why is the window open, and what depth/affect should realize it?

A second failure made the fragmentation worse. `refreshSourceSnapshot()` previously saved a successful zero-result refresh as the new canonical snapshot. A transient empty X fetch could therefore turn a useful Momentum view into an empty view even when a last-known-good snapshot existed.

## Concept fan: redesign the question

The old solution was a Discover/review workflow.

Ask: **what is Discover a way of doing?**

It is a way of selecting useful growth work.

Ask once more: **what is selecting useful growth work a way of doing?**

It is a way of allocating scarce attention while distribution windows are open.

That broader direction produces three useful branches:

1. **Next-best-action operator** — rank unhandled relevant sources and name the action.
2. **Distribution-window operator** — expose freshness, velocity, source momentum, and urgency explicitly.
3. **Packaging operator** — transfer the structural features of high-performing native posts into the chosen Reply/Quote/Original without copying wording.

A fourth branch, **add more dashboard tabs**, is rejected. It is the old fragmented solution with new labels. The agent still has to mentally join source, momentum, route, style, and state.

The structural insight is that **candidate selection, distribution leverage, and copy shape are one operating decision**. The OS should keep them inspectable as separate evidence fields, but hand them to the agent together.

## New operator loop

Use this loop during live Growth OS operation:

`operator-readiness -> growth-run begin/resume -> recover uncertain attempts -> sense/refresh only when useful -> preserve last good -> select lane champions -> inspect exact source -> verify claims -> select purpose/mode/affect/depth or silence -> prepare -> claim exact action -> send-start -> act once -> reconcile -> measure -> learn -> finish/resume`

### 1. Refresh without destroying useful state

Canonical source snapshots now use last-known-good behavior when a refresh returns zero candidates while a prior non-empty snapshot exists.

The refresh status still records the problem. Stale data is visible as stale; it is not silently presented as fresh. But a transient empty fetch no longer erases the agent's working set.

### 2. Ask Growth OS for the next actions

Start with operational truth, then bind the work to a durable run:

```bash
npm run agent -- operator-readiness <<<'{}'
npm run agent -- growth-run-begin <<<'{"adapterType":"chatgpt_webharness","sessionId":"<session>","capabilities":{"reasoning":true,"browser_read":true,"browser_mutation":true,"x_authenticated":true,"primary_source_web_research":true}}'
```

`operator-readiness` keeps delegation, agent attachment, sensor freshness, mutation capability, reconciliation, and scheduler state separate. The Growth Run binds the exact delegation revision and existing operator lease, then returns the current stage plus `recommendedOperation` / `permittedOperations`. Another supported reasoning session can resume the same `runId` instead of reconstructing the mission from chat history.

`operator-status` remains the compact cross-lane cockpit for cached discovery/engagement champions, approved-main-feed readiness, due measurements, memory checkpoint state, and integrity warnings. Priorities remain lane-local; the reasoning operator arbitrates lane champions rather than comparing unlike scores.

Then use the detailed discovery view when that lane is competitive:

```bash
npm run agent -- growth-next <<<'{"limit":12}'
```

`growth-next` is deliberately network-independent by default. It reads the current last-known-good canonical discovery snapshots available to Growth OS—including personalized `x_for_you`, creator-latest, X latest/momentum, and external discovery sources when present—merges duplicate sources, excludes this account's own posts, derives the current Growth Focus and distribution recommendation, attaches source-momentum observations, and returns the highest-priority usable candidates immediately.

When a source needs refreshing, run the explicit maintenance primitive:

```bash
npm run agent -- growth-refresh <<<'{"kind":"x_momentum"}'
```

Omit `kind` to refresh the pull-capable discovery sources owned by source maintenance. Personalized `x_for_you` is intentionally browser-agent pushed, not an HTTP/background pull source; when a Growth Run requests it, collect it from the authenticated X browser and submit `x-for-you-ingest` with `accountHandle`, adapter/session/run, and browser provenance. Refresh is allowed to be slow or degraded; next-action selection is not. If a refresh outlives one harness RPC, keep operating from the visible last-known-good snapshot rather than issuing duplicate refreshes.

The response includes:

- current stored account snapshot;
- source timestamp and raw source metrics;
- last-known snapshot age/error state;
- recommended action and reason;
- an explicit operator-priority heuristic;
- Reach / Follow / Conversation / Relationship potentials;
- urgency (`now`, `soon`, `normal`, or `blocked`);
- borrowed-versus-owned distribution leverage;
- current viral tier / views per hour / engagement velocity when available;
- conversation crowding as replies per 1,000 views;
- observed source metric deltas when repeated snapshots exist;
- the source post's hook/style shape;
- transfer guidance for the outbound copy;
- current exact-candidate operator disposition when one exists. Active `skip` / `defer` dispositions are suppressed from the normal actionable result set; `includeDisposed: true` exposes them for inspection.
- explicit claim exposure, including whether a Repost inherits source claims without corrective context;
- execution-path facts: scheduler-owned main-feed after valid human or explicitly active delegated mission-agent approval, autonomous-reply candidacy under its separate grant, or manual final action. The legacy grant name does not create content doctrine.
- hard discovery-quality exclusions for crypto promotion and direct job ads; `includeLowSignal: true` exposes them for inspection without making them normal growth candidates.

The operator-priority formula is deliberately inspectable and empirical:

- Reach: 45%;
- Conversation: 25%;
- Follow: 20%;
- Relationship: 10%;
- small bonuses for borrowed distribution and current urgency.

This is an internal attention-allocation heuristic, not a claim about X's ranking system.

### 3. Verify the exact source on live X

`growth-next` is a planning primitive, not publication authority. `growth-refresh` is source maintenance, not a prerequisite for every action.

Before a live action:

1. open the exact source post through the installed `agent-browser` routing contract: prefer harness-owned MCP `browser-fast` on its current persistent authenticated profile; if Local/MCP is unavailable, use a named `agent-browser` CLI session; use a raw repository browser adapter only as the last fallback;
2. read the full post and relevant thread context;
3. confirm the visible metrics and timestamp are still materially current;
4. confirm we have not already acted on the source;
5. choose and persist the strongest purposeful behavior supported by the source, relationship, social field, and current growth objective;
6. realize it at the depth it actually needs;
7. claim the exact authorized action through `browser-publish-claim` or `browser-reply-claim`, retaining the returned `attemptId`;
8. immediately before the consequential browser mutation, call `publication-attempt-send-start` for that exact attempt;
9. send once;
10. verify the live output text and route-specific structure before reconciling through `record-action` with the same `attemptId`.

If a consequential click is ambiguous, do not blind-retry. Establish whether the action exists on the source thread, account profile, search, or network mutation result first. Failure to find it is not enough to claim `confirmed_not_sent`: keep the attempt investigating, or close it `closed_unresolved` with evidence after useful recovery is exhausted. The exact action remains duplicate-fenced while unrelated future work can continue.

### Record live truth without a manual ingest round trip

`record-action` and `record-disposition` now accept either an existing candidate key or an inline `source` object containing the exact URL/text/identity plus only the metrics actually observed. A live-discovered source can therefore become durable state in the same local recording call after the external X action has already been verified, or in the same disposition call when the operator intentionally skips/defers it.

`record-action` does not publish. For a claimed browser publication it is idempotent local reconciliation for the same candidate/action **and publication attempt**, requires the confirmed live output ID or URL for direct/quote/reply actions plus the route-specific structural verification, preserves the original action timestamp/context on ordinary retries, and rejects a conflicting output tweet ID instead of implying a second send. Newly recorded actions snapshot the source conditions known at action time: source/observation timestamps, route, views/likes/reposts/replies/bookmarks when observed, reply/bookmark density when computable, available viral/momentum fields, and the same source-style feature shape exposed by `growth-next`. Missing metrics remain `null`/unknown rather than being manufactured as observed zero.

`record-disposition` stores only exact-candidate operator state (`skip`, `defer`, or cleared) with a visible reason and optional expiry. It is not an author/topic saturation rule. Normal `growth-next` excludes an active disposition; `includeDisposed: true` is an inspection escape hatch.

`inspect` joins the candidate to its disposition and recorded actions. Each action includes its durable source context plus the exact output identity and any already-available owned-post/publication measurement rows, giving later Learn/ranking work one inspectable decision -> action -> outcome path without reconstructing source conditions from browser history.

## Momentum as leverage

Momentum is not just a badge. It changes action latency.

For X candidates, use three layers:

1. **freshness** — age of the source;
2. **current traction** — views, likes, reposts, replies, and viral tier;
3. **observed acceleration** — delta per hour between stored source observations when available.

A source can therefore be high-reach because it is already large, because it is moving quickly, or both.

Momentum can increase expected discovery value and reduce the time available for deliberation, but it does not manufacture purpose.

- a fresh source with strong borrowed distribution may outrank an equally relevant static source when both have legitimate behavior options;
- a Repost is valid when amplification itself is the purpose;
- a Reply fits when the act belongs inside the conversation;
- a Quote fits when source context belongs on Hamza's profile;
- an Original fits when the object should become owned profile proof or identity.

High velocity may reduce decision latency. It does not impose one format or a universal minute cutoff.

## Viral style: transfer the shape, not the wording

`viral_style.js` already extracts observable structure such as:

- hook labels;
- semantic style labels;
- word count;
- sentence count;
- paragraph count;
- first-line length;
- number count;
- hashtag count;
- benchmark, cost, release, curiosity, proof, and first-person markers.

The Writer packet now exposes the current source's shape as `candidate.sourceStyle`. This is useful when the source itself is a high-performing native X post.

Apply the following transfer rules:

### Orient the selected act

For a factual or technical act, name the object, result, constraint, product, model, tool, benchmark, price, or failure mode early enough that the intended reader understands it.

For a social-only Reply or Quote, the visible source may carry the referent and a short reaction, joke, answer, or celebration may be complete.

Orientation quality matters; there is no first-line character target.

### Depth and structure follow the job

V4 directly observes both very short social replies and long structured utility posts. Do not force a fixed number of blocks. Put enough value or social meaning early for the chosen format while preserving the structure a guide, argument, warning, or artifact genuinely needs.

### Verified numbers earn space

Concrete numbers are useful when they change a decision: price, token count, latency, views-per-hour, benchmark result, context length, usage window.

### Match the native shape

If a strong source succeeds as a one-line observation, do not turn the Reply into a design document. If a release post succeeds with a concrete noun plus three compact facts, borrow the rhythm, not the sentences.

### Hashtags are a narrow search-surface tool

Default to zero. Use one or two only when the tag is canonical and tied to a live topic/search surface. Do not use generic blocks such as `#AI #Tech #Coding` and do not duplicate posts to test hashtag combinations.

## Writer integration

The normal authored path should now be understood as:

`growth-next -> exact-source inspection -> behavior decision -> route -> optional writing-strategy -> writer-packet -> purpose-aware gates -> approval/send authority -> live verification`

`writing-strategy` remains the evidence-aware way to choose a presentation approach from Viral Styles, own-account outcomes, explicit experiments, and learned rules.

`writer-packet` includes the selected behavior, active persona slice, conversation/relationship context, and observable source style. Source shape is optional context. Facts, behavior purpose/mode/affect/depth, and the selected route govern the copy.

## What the OS should learn next

The current system should accumulate evidence around decisions that matter to this account:

- purpose, social mode, affect, information depth, conversation stage, and persona version;
- borrowed distribution versus owned-only distribution;
- source views/hour and reply-density at action time;
- Reply versus Quote versus Repost versus Original outcomes;
- short social acts versus compact reasons versus long explanations/artifacts;
- known versus inferred versus strategic affect;
- verified-number/resource/media presence when relevant;
- assigned hashtag treatments on non-duplicate comparable content;
- detail expands, profile visits, follows, and follower quality;
- author response, second-turn conversation, and recurring relationship creation.

Do not promote a permanent strategy rule from one post. Keep these as explicit observational variables until repeated account outcomes support a directional rule.

## First operator run after the redesign

The first live run of the redesigned loop produced four different decisions instead of forcing every source into the same behavior:

- **Damon Chen / xAI stack cost:** `growth-next` surfaced a roughly 0.6-hour-old source at about 1.9K views/hour, with stored observations implying roughly 3.0K views/hour acceleration. The source used a quantified cost comparison. The resulting Reply kept that quantified framing and shifted the decision metric from sticker price to which paid surface reaches its usage ceiling first. Live reply: `2092105631134364130`.
- **Andy Konwinski / Headlong:** the source was a primary project announcement at roughly 121K views with substantial bookmarking and enough detail to stand alone. Growth OS chose Repost. No commentary was added solely to create text.
- **Lou / GLM-5.3:** the source was still adding roughly 1.9K views/hour and made broad performance claims. The Reply asked for a per-category matrix with repeat success rate, wall time, and tokens. Live reply: `2092106772354113553`.
- **Andrew Ho / computer-use automation:** the source was under an hour old with only four replies and roughly 1.8K live views when inspected. The thesis stood alone: an edge case can itself be the signal that deserves human attention. Growth OS chose Repost; X verified the repost count moving from 3 to 4.

This first run also exposed a useful independent variable: **conversation crowding**. `growth-next` now reports replies per 1,000 views. It does not use that value in `operatorPriority` yet; there is not enough account evidence to justify a weight.

## Prioritized next OS improvements

Do not respond to this redesign by adding more dashboard surface area. The action-time source snapshot and inspectable action/outcome join are now in place; improve the evidence loop from that foundation in this order:

1. **Expand real outcome capture where the platform/runtime exposes it.** Use the joined action-time source context to compare observed impressions, engagements, detail expands, profile visits, author response, follower delta, and follower niche quality by Reply / Quote / Repost / Original.
2. **Deepen media readiness.** A later classifier may distinguish `needs_media_inspection` and `clean_to_amplify`; until then the live operator owns that judgment.
3. **Learn reply-density and bookmark-density direction before weighting either.** Keep both as observational evidence. Only add a ranking bonus after enough own-account outcomes show a repeated directional relationship with impressions, author responses, profile visits, or follows.
4. **Make refresh durable, not blocking.** `growth-refresh` is already separated from `growth-next`. The next runtime step is to let the existing automation/terminal layer refresh snapshots durably while the operator keeps consuming last-known-good state.
5. **Promote behavior or presentation lessons only from repeated outcomes.** Compare purpose, mode, affect, depth, conversation stage, format, number/resource/media use, and experiment treatments against separate account outcomes. Do not resurrect fixed length, block, or opener rules merely because one cohort performed well.

## Agent stopping rule

A temporary empty Discover view is no longer a reason to stop. Use the preserved last-known-good snapshot and the live authenticated X browser as the current-state authority.

Stop or ask for human intervention only for a real authorization/security boundary, unrecoverable browser access failure, destructive ambiguity that cannot be resolved safely, or an explicit operator stop.
