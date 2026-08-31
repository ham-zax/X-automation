# Growth Decision Recovery + Live Pilot — 2026-08-21

## Scope and evidence standard

This is the operating log for the recovery mission that followed the first weak live post. It records repository-observed state, real operator actions, X outcomes, and explicitly labeled interpretation. It is not participant research and it does not establish that any writing feature causes reach, engagement, or follower growth.

The account objective for this mission is qualified/relevant follower and engagement growth. Truth remains a constraint. The user authorized at most four additional outbound X items after the already-published cybersecurity post; the maximum is not a quota.

## Failure that triggered the recovery

Published source:

- candidate: `https://github.com/mukul975/Anthropic-Cybersecurity-Skills`
- queue item: `452`
- draft: `15`
- pipeline: Original
- X URL: `https://x.com/ham_zax/status/2090704035259232749`

Repository-observed generation provenance:

- `strategySelectionId = null`
- `strategyMode = null`
- `strategyApplied = false`
- queue recommendation remained `ignore`
- no explicit human use-anyway routing provenance existed

The public copy also spent scarce space on internal verification/risk framing, did not provide an actionable repository link, and had no useful media. The old 50-point draft score was easy to misread as a growth judgment even though it was only a writing-quality score.

Early fixed-window measurements captured during recovery:

| Window | Views | Likes | Reposts | Replies | Bookmarks | Associated follower delta | Attribution |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 15m | 18 | 0 | 0 | 0 | 0 | 0 | low / non-causal |
| 1h | 18 | 0 | 0 | 0 | 0 | 0 | low / non-causal |

These observations describe a weak outcome. They do not show that missing hashtags, media, hooks, links, or any other single feature caused it.

## Recovery root causes and repairs

### Editorial Director runtime

The real configured `editorial_scan` path was reproduced through the application bridge with Luna/Codex. The initial message `AI runtime provider connection failed` was misleading.

Repository/runtime-observed causes:

1. Codex native structured output rejected schema keywords/forms used by Editorial (`uniqueItems`, `oneOf`, `const` without explicit type, and quoted/backslashed story-key enum literals).
2. The CLI adapter classified those schema-contract failures as provider/connection failures.
3. After the schema boundary was repaired, Luna at `max` reasoning exceeded the former 120-second Editorial budget.

Repairs:

- normalize only the provider-facing Codex schema while retaining the original schema as the authoritative local validator;
- report strict-schema rejection as `schema_unsupported` instead of a connection failure;
- preserve the configured Luna model/reasoning rather than silently switching models;
- raise the Editorial scan/final budget to 420 seconds.

Observed outcome:

- current-source Editorial run `9` completed on the configured primary `gpt-5.6-luna` / Codex / `max` path;
- scan AI run `37` completed in about 270 seconds;
- final AI run `38` completed in about 300 seconds;
- no fallback profile or model substitution was used.

### Ignore and route authority

Two separate integrity gaps were found.

First, a newly routed candidate could receive a blank queue row and advance before its current rule recommendation was persisted. Second, selecting an Editorial recommendation overwrote the queue's rule-based `recommendedPipeline` and routing reason with the Editorial decision.

Repairs:

- every authored/repost route refreshes the current rule recommendation before advancing;
- `recommendedPipeline=ignore` now blocks authored/repost routing unless a human explicitly records **Use anyway** with a non-empty reason;
- the override records human actor, timestamp, current recommendation, current routing reason, and the human rationale;
- automation/agent callers can consume an existing human override but cannot create one;
- the override becomes stale/clears when the underlying recommendation changes;
- Editorial selection keeps its own selection provenance and no longer overwrites the independent rule recommendation.

### Writing-strategy decision

Generation now requires an explicit persisted choice:

- **No influence** (`off`)
- **Advice only** (`suggest`)
- **Use for this draft** (`apply`)

Approval also rejects an AI generation if its recorded strategy selection/mode is missing or stale relative to the current saved choice. Apply-only Writer semantics remain intact: Off and Suggest do not enter Writer generation.

### Public copy versus verification context

The Writer contract now separates:

- internal fact/risk/provenance context, which determines what may safely be claimed and stays inspectable in draft details;
- public copy, which should contain reader value plus only qualifications that materially change the reader's decision.

The prompt no longer treats the absence of an independent second source as a reason to fill ordinary source-attributed commentary with verification boilerplate.

### Writing Quality versus Growth Packaging

The 50-point score is now labeled **Writing quality / structure** and explicitly says it is not predicted engagement, virality, or follower growth.

A separate inspectable Growth Packaging review covers:

- stopping power;
- reader payoff;
- distribution leverage;
- source/action path;
- interaction opening;
- media opportunity;
- strategy state.

Critical packaging blockers now participate in approval readiness, including missing reader payoff, missing/stale strategy decision, and a resource promise without a usable source/action path. Hashtags, emoji, questions, exclamation marks, and media are not universal gates.

### Resource/source behavior

The Writer contract is now format-aware:

- resource/tool Originals should normally include a usable URL when access is the payoff;
- Quotes can use the native quoted X object as the source/action path;
- opinions/observations do not need a URL merely because their candidate has one.

### Media path

Inspection showed the installed authenticated X stack already contains image upload, alt-text metadata, and CreateTweet `mediaIds` support. The product now has a bounded image path:

`operator attach -> local preview -> alt text/provenance -> approval readiness -> authenticated X upload -> CreateTweet mediaIds`

Supported attachment inputs are JPEG, PNG, WebP, and GIF up to 5 MB. Local draft media is kept under ignored `.x-media/` storage and the browser read model does not expose the filesystem path.

No live pilot item selected so far has had a useful media opportunity: both selected items are native Quotes where a separate source screenshot would be redundant. Therefore live X attachment publication remains unproven by this session; the pilot does not credit decorative or merely theoretical media as a growth advantage.

## Pre-failure draft authority recovery

The four approvals from before the failed pilot were revoked through the normal routing/domain path before new publication work began. Draft text/history was preserved.

| Draft | Candidate | Current pipeline | Current state | Current recommendation | Publication authority |
| --- | --- | --- | --- | --- | --- |
| 12 | `https://x.com/vercel_dev/status/2089828083415355806` | Quote | drafting | ignore | none |
| 13 | `https://x.com/cursor_ai/status/2089758713183613266` | Quote | drafting | ignore | none |
| 14 | `https://x.com/blocks/status/2089753189985706377` | Quote | drafting | ignore | none |
| 16 | `https://github.com/jundot/omlx` | Original | drafting | ignore | none |

All four have `humanApprovedAt = null` and `scheduledAt = null`. They remain raw material only. None was reused in the repaired live pilot so far.

## Current-source Editorial pass and opportunity disposition

Before the repaired live pilot, X momentum, GitHub Trending, and Hacker News source snapshots were refreshed. Editorial run `9` then evaluated the fresh set on Luna/max.

### 1. Slack Code — selected and published

Source: `https://x.com/SlackHQ/status/2090417108559548554`

At the source refresh the X momentum snapshot showed approximately 493k views, 1.4k likes, 264 reposts, and 83 replies. These are source observations, not proof of future distribution for this account.

Editorial decision:

- recommendation id: `6`
- pipeline: Quote
- thesis: evaluate whether the shared team surface improves coordination/control beyond existing coding-agent + PR workflows

Rule decision:

- current machine recommendation: `ignore`
- first Editorial selection attempt was blocked by the repaired route authority
- explicit human **Use anyway** reason: `Fresh breakout Slack Code announcement; Quote adds a concrete developer evaluation frame for coordination, permissions, auditability, and review while the native source carries the announcement context.`

Writing strategy:

- selection id: `1`
- mode: `apply`
- selection source: evidence-backed deterministic option
- primary hypothesis: semantic style `short_observation`
- evidence lane: external Viral only, directional/observational (`n=11`); no own-account, experiment, or learned-rule evidence was attached
- generation provenance recorded `strategySelectionId=1`, `strategyMode=apply`, `strategyApplied=true`

Growth Packaging at final review:

- stopping power: clear;
- reader payoff: clear;
- distribution leverage: borrowed context through native Quote;
- source/action path: not separately required;
- interaction opening: optional, no forced question;
- media: unnecessary;
- strategy state: clear.

Final public copy:

> Slack Code’s real test isn’t mentioning a coding agent.
>
> Before adopting it, check three things: permission boundaries, audit trail, and how agent work hands off into review.
>
> If those stay the same, the chat surface is mostly another place to invoke the same agents.

Published X URL: `https://x.com/ham_zax/status/2090782696855458204`

Queue item: `582`

Immediate authenticated verification after publication found the exact post live on the account. Publication follower baseline: `41` followers, captured about 0.25 minutes after the recorded publish time. The mature 15m fixed-window read recorded 0 views, 0 likes, 0 reposts, 0 replies, 0 bookmarks, and 0 associated follower change with low/non-causal attribution.

#### Quote transport reconciliation encountered during Slack publication

Two publication attempts completed without a usable root tweet ID and were left in the deliberate `publishing` / reconciliation state. The exact post was absent from repeated authenticated live account reads after each attempt, so the remote effect was treated as not observed before any retry.

A concrete contract mismatch was found in the installed low-level Quote helper: it used `https://x.com/i/web/status/<id>` while the installed high-level X client uses `https://x.com/i/status/<id>`. The adapter now uses the latter form and extracts GraphQL error details when available.

The first retry after that URL correction still returned an identity-less/no-post response, so the URL mismatch is not claimed as the sole cause. After a second reconciled retry, the same corrected Quote path returned tweet id `2090782696855458204` and the post was verified live. The remaining identity-less X response behavior is therefore treated as an unresolved transient transport/reconciliation defect, not a safely repeatable failure class.

### 2. Codex 20M/reset signal — skipped for publication

Source: `https://x.com/thsottiaux/status/2090766694897619318`

Editorial decision: `RESEARCH_MORE`.

Reason: the post combined a large active-user claim with a temporary/reset mechanic. The current evidence did not justify converting it directly into a growth post. No use-anyway decision, draft generation, approval, or publication was performed.

### 3. Ox Alpha six-day window — prepared, then left inactive

Source: `https://x.com/opencode/status/2090758645499728234`

At refresh the source had roughly 53k views, 1.3k likes, 74 reposts, and 88 replies. Two separately supplied user reports described mid-task stopping; the Editorial recommendation explicitly treated those as reports, not a confirmed incident or root cause.

Editorial decision:

- recommendation id: `8`
- pipeline: Quote
- reader job: verify task completion, interruption frequency, client/provider consistency, and usage-limit behavior before moving a workflow

Rule decision:

- current machine recommendation: `ignore`
- Editorial selection was initially blocked
- explicit human **Use anyway** reason: `Fresh high-momentum six-day OpenCode access window; Quote adds a concrete reliability checklist and keeps interruption reports attributed as user reports rather than a confirmed model or harness root cause.`

Writing strategy:

- selection id: `2`
- mode: `apply`
- selection source: evidence-backed deterministic option
- primary hypothesis: opening feature `bullet_list`
- evidence lane: external Viral only, directional/observational (`n=10`); no own-account, experiment, or learned-rule evidence was attached
- generation provenance recorded `strategySelectionId=2`, `strategyMode=apply`, `strategyApplied=true`

Final prepared public copy:

> Before switching work to Ox Alpha, test:
> • task completion + interruptions
> • client/provider consistency + limits
>
> Two early user reports describe mid-task stops. Six free days are useful; reliability decides whether it earns a workflow slot.

Growth Packaging was ready: clear stopping power/payoff, native Quote distribution leverage, no separate source URL requirement, no forced question, no media requirement, and a clear Apply strategy state.

The item was explicitly approved once, but the existing scheduler declined an immediate second post after Slack and recommended `2026-08-21T16:46:53.502Z` (22:16:53 Asia/Kolkata), with a coverage-spacing warning of about four hours. The mission cap is not a quota, and one repaired live item had already exercised the complete production path. Rather than keep latent publication authority solely to increase the post count, the item was routed back through the normal Quote path.

Final inactive state:

- queue item `632`: `drafting`;
- draft `18`: `draft`;
- `humanApprovedAt = null`;
- `scheduledAt = null`;
- no X URL;
- the current repaired Use-anyway decision and strategy/generation provenance remain inspectable with the preserved draft.

Disposition: skipped for this live batch after scheduler deferral; prepared copy/history preserved for later reconsideration.

### 4. Agent continuity layers — skipped for this batch

Editorial recommendation: Thread.

Disposition: not advanced. The synthesis had useful primary evidence but lower cold-start distribution leverage and higher reading/production cost than the two current Quote opportunities. The pilot did not need another item merely to consume authorization.

### 5. Skills/methods/plugins layers — skipped for this batch

Editorial recommendation: Original.

Disposition: not advanced. The source set was well supported, but an owned-only Original from the current small account offered less immediate distribution leverage than the two additive current conversations. No post was manufactured to fill the quota.

## Measurement state

Existing fixed-window measurement infrastructure remains authoritative. No parallel analytics was added.

Current available observations:

- failed first cybersecurity post: 15m and 1h captured, both 18 views and zero visible engagement/bookmarks/associated follower delta;
- Slack Quote: publication baseline captured at 41 followers; the mature 15m fixed-window read recorded 0 views, 0 likes, 0 reposts, 0 replies, 0 bookmarks, and 0 associated follower change with low/non-causal attribution;
- Ox was intentionally left inactive after scheduler deferral, so it has no publication baseline or fixed-window measurements.

Later observations must keep views, replies, reposts, bookmarks, visible engagement, associated follows, relevant-follower quality, and attribution confidence separate. Any strategy comparison remains descriptive. External observations, own-account outcomes, explicit tests, and learned rules remain separate evidence lanes.

## Browser/operator verification

The repaired real browser path has been exercised through:

`Today Editorial -> blocked Ignore route -> Discover Use anyway + reason -> Today selection -> blank Draft -> deliberate strategy -> Generate -> Writing quality -> Growth Packaging -> manual public-copy edit -> readiness -> explicit approval -> scheduler/publication`

Observed product behavior:

- Ignore cannot silently become authored work;
- strategy choice is visible and persisted before generation;
- Writer generation records whether strategy actually applied;
- Growth Packaging is distinct from Writing Quality;
- verification/risk notes remain in draft details rather than being required public-copy filler;
- Quotes can rely on their native quoted source object;
- approval remains separate from publication;
- scheduler spacing is still authoritative;
- remote-effect-uncertain publication suppresses ordinary resend until external reconciliation.

## Post-mission integration review

The integration review found and repaired three contract mismatches before freezing the recovery work on `main`:

- the new main-feed Writing Approach requirement had accidentally made human Engage Next replies depend on a strategy selection that the Conversations UI does not own; existing engagement-lane replies now keep their separate Engage Next contribution/tone authority and do not require a main-feed Writing Approach selection;
- the generic rule-based `Ignore` refresh could overwrite an already-qualified Engage Next opportunity when the reply draft was reopened; existing `lane=engagement, pipeline=reply` items now preserve the Engage Next recommendation/context instead of being re-routed through the generic authored-post recommendation;
- Growth Packaging could previously infer payoff/question presence from hidden Writer metadata that might be stale after a human edit; it now judges those properties from the current public copy.

Current repository/operating documentation was also synchronized with the implemented operator image attachment/readiness path so future agents do not treat media publication as still universally unavailable.

## What remains unproven

- No causal statement about hooks, bullet lists, short observations, media, hashtags, questions, or format can be made from this sample.
- External Viral observations remain correlational.
- The Slack Quote has only one mature fixed measurement window so far; 1h/6h/24h remain immature at this log point.
- Ox was intentionally not published in this batch; its approval was revoked through the normal route while preserving the draft and provenance.
- Live X publication with an attached image has not been exercised because the selected pilot Quotes did not have a useful non-decorative media need.
- The intermittent identity-less/no-post Quote transport response is not fully explained, even though successful Quote publication is now observed.

## Non-test validation performed so far

No tests were created, modified, or run.

Direct validation used:

- targeted `node --check` on changed server files;
- production UI builds after material UI changes;
- `git diff --check`;
- real configured Luna/max Editorial refreshes;
- live source refreshes;
- browser walkthrough of the repaired decision/generation/review path;
- exact queue/routing/strategy/generation provenance reads;
- real X publication and authenticated account verification;
- existing fixed-window measurement capture.
