# Agent Workflow

This document is the operating contract for any agent that researches, drafts, or queues content for this account.

## System objective

The account is an **AI-native developer + builder** account. The agent should turn useful signals into original developer value:

**signal -> why it matters -> evidence -> action**

The agent is not a generic news summarizer. It should prefer AI coding agents, models/inference, developer tools, infrastructure/architecture, developer jobs/career, builders/SaaS, and technical productization/business.

The architecture is also **network-first**. Publishing is one instrument inside a broader loop:

**conversation insertion -> repeated interaction -> relationship -> profile conversion -> follow -> stronger future distribution -> owned-content conversion.**

Use `PRODUCT_ARCHITECTURE.md` for the complete current/planned product map, `NETWORK_GROWTH_OPERATING_SYSTEM.md` for the strategic model, `RELATIONSHIP_INTELLIGENCE.md` for current relationship ownership and Engage Next behavior, and `ALGORITHM_EVIDENCE_LEDGER.md` for evidence classification. Phase 6 editorial planning and the selectable AI runtime/provider layer are current: agents may inspect/refresh/select/dismiss editorial recommendations and inspect/select AI configuration through the bridge, but those actions do not grant approval or publication authority.

## Stable interface

Agents should interact with the system through `agent_bridge.js`, not by editing `.x-research.sqlite`, `.automation-state.json`, or dashboard HTML directly.

The bridge is JSON-in / JSON-out:

```bash
printf '%s' '<json>' | node agent_bridge.js <command>
```

Available commands:

- `ingest` - add a manually supplied source post to research memory; classifies niche, creates workflow state only when requested/needed, and bookmarks it only when `saved: true` is explicitly supplied.
- `inspect` - inspect one stored candidate, its draft, current exact-candidate disposition, recorded actions, action-time source context, and available output/outcome evidence.
- `create-draft` - save/route a candidate into a text pipeline and create/reuse the structured Hook/Insight/Evidence/Action scaffold.
- `update-draft` - update/rescore a draft; `status: ready` now means **request workflow review**, not self-approval.
- `queue` - inspect workflow queue items plus the temporary compatibility draft queue.
- `operator-status` - read the compact cross-lane cockpit: account/health, last-known discovery, lane champions, write readiness, due measurements, and queue-integrity warnings. It performs no network refresh or mutation.
- `operator-memory-review` - record a completed Browser/`x-content` memory checkpoint and reset the interaction window; requires `confirmReview: true` and an exact result.
- `route` - select/override Original / Quote / Thread / Reply / Repost / Research / Watch / Ignore for a candidate; agents cannot approve.
- `workflow` - inspect one candidate's queue row, draft, actions, current score breakdown, and stored recommendation.
- `research` - query persisted research candidates.
- `performance` - read the latest persisted account/post performance snapshot.
- `decide` - apply the DIRECT / QUOTE / REPOST / REPLY / IGNORE distribution decision method to a stored candidate.
- `record-action` - persist a successful direct/quote/repost/reply result, including output tweet ID/URL, commentary, and durable action-time source context. It can capture a live source inline when the candidate is not stored yet.
- `record-disposition` - persist or revise an exact-candidate `skip` / `defer` (or clear it) with a transparent reason and optional expiry; it can also capture a live source inline.
- `relationship-targets` - list strategic relationship profiles with optional class/stage/min-TargetScore filters.
- `relationship-inspect` - inspect one relationship profile plus recent append-only event history.
- `relationship-events` - read bounded recent relationship events for one username.
- `engage-next` - read cached ranked actionable engagement items, grouped into Active Conversations and New Opportunities; pass `refresh: true` only for compatibility with an intentional inline refresh.
- `engage-refresh` - explicitly refresh engagement sources, then return refreshed Active Conversations and New Opportunities; compact output is the default.
- `engage-draft` - create/update a Phase-2 reply draft and optionally request review; it never approves or sends.
- `engage-resolve` - ignore/expire an item or explicitly send an already human-approved exact reply; it cannot approve one.
- `audience-sync` - refresh the authenticated follower/following audience snapshot and strategic state for currently observed relevant profiles.
- `audience` - inspect the raw niche-aligned follower/following observation layer.
- `editorial-plan` - read the latest completed plan for an objective without refreshing sources or invoking a model.
- `editorial-refresh` - explicitly recompute the advisory plan, optionally refreshing canonical sources first; it never selects a recommendation.
- `editorial-recommendation` - inspect one persisted recommendation and its evidence/provenance context.
- `editorial-select` - explicit human/operator route selection for one recommendation; may create/reuse normal workflow work but never approves, schedules, publishes, or sends.
- `editorial-dismiss` - dismiss one still-actionable recommendation.
- `editorial-add-source` - attach an operator-supplied URL/claim through the controlled research fetch boundary; it does not search the web itself.
- `editorial-outcomes` - read observational Phase-4 outcome cohorts associated with editorial provenance when real measurements exist.
- `ai-config` / `ai-runtimes` - inspect safe AI profile/binding/runtime state without exposing stored secrets.
- `ai-select-default` / `ai-bind-role` - explicitly select existing AI profiles; these commands cannot create/read secrets or change content/workflow authority.

### AI Editorial Director — implemented

The default product loop is now `Discover -> Research -> AI Editorial Director -> human select/override -> Writer -> human edit/approve -> Publish -> Measure -> Learn`.

```bash
npm run agent -- editorial-plan <<<'{"objective":"qualified_growth"}'
npm run agent -- editorial-refresh <<<'{"objective":"qualified_growth","refreshSources":true}'
npm run agent -- editorial-select <<<'{"recommendationId":1}'
npm run agent -- editorial-add-source <<<'{"recommendationId":2,"url":"https://example.com/evidence","claim":"Claim to investigate","claimType":"other"}'
```

`editorial-select` is route selection, not approval. Original/Quote/Thread/Reply enter the existing editable workflow, Repost enters its existing manual-review flow, and `RESEARCH_MORE` remains research-only with unresolved questions until the human explicitly chooses a publication route. Writer evidence references must resolve to persisted evidence IDs and claim scope; free-form AI labels such as `verified` are not proof.

## Distribution decision before drafting or engaging

Use `docs/GROWTH_DISTRIBUTION_PLAYBOOK.md` as the governing method. The agent must decide one of:

- **DIRECT** when the insight is ours, combines multiple sources, or stands alone as an experiment/result/implementation;
- **QUOTE** when the source itself is important evidence and our commentary adds a distinct thesis or developer implication;
- **REPOST** only when amplification itself is the point and forcing commentary would add nothing;
- **REPLY** when we can make a specific technical contribution or informed question that helps build a relevant relationship;
- **IGNORE** when niche fit or additive value is weak, or the candidate has already been used.

Example decision call:

```bash
cat <<'JSON' | node agent_bridge.js decide
{
  "key": "https://x.com/example/status/123",
  "context": {
    "addsMaterialValue": true,
    "sourceIsEvidence": true,
    "canAddReplyValue": false,
    "relationshipValue": false,
    "originalStandalone": false
  }
}
JSON
```

After a successful X action, persist it immediately. An already-stored source can still be referenced by key:

```bash
cat <<'JSON' | node agent_bridge.js record-action
{
  "key": "https://x.com/example/status/123",
  "action": "quote",
  "outputTweetId": "456",
  "outputUrl": "https://x.com/ham_zax/status/456",
  "commentary": "Exact commentary that was published"
}
JSON
```

A live-discovered source that is not stored yet can be captured and reconciled in the same call. Supply only metrics actually observed; omitted metrics remain unknown rather than becoming zero:

```bash
cat <<'JSON' | node agent_bridge.js record-action
{
  "source": {
    "url": "https://x.com/example/status/123",
    "author": "@example",
    "text": "Exact source text",
    "timestamp": 1787640000000,
    "observedAt": 1787641800000,
    "metrics": { "views": 38800, "likes": 920, "reposts": 120, "replies": 4, "bookmarks": 237 }
  },
  "action": "reply",
  "outputTweetId": "456",
  "outputUrl": "https://x.com/ham_zax/status/456",
  "commentary": "Exact reply that was published"
}
JSON
```

`record-action` is local reconciliation only: it never sends to X, requires the confirmed live output ID or URL for direct/quote/reply actions, preserves the original action record on idempotent retries, and refuses a conflicting output tweet ID. The stored source context includes the observed/source timestamps, action/route, observed metrics, reply/bookmark density when computable, available momentum fields, and source-style shape. `inspect` returns that context together with the output identity and any existing post/publication measurements.

If the operator intentionally declines an exact source, record the disposition instead of fabricating a successful action:

```bash
npm run agent -- record-disposition <<'JSON'
{"key":"https://x.com/example/status/123","state":"defer","reason":"Already covered this exact source angle","expiresAt":1787660000000}
JSON
```

Use `state: "clear"` to revise the current disposition back to inactive. Active exact-candidate dispositions are omitted from normal `growth-next`; `includeDisposed: true` exposes them for inspection without changing ranking weights. A recorded successful action still makes that source `alreadyUsed` by default for future distribution decisions.

## Audience interaction

Refresh the follower/following graph when the user asks for audience strategy or periodically when relationship recommendations are stale:

```bash
npm run audience:sync
npm run agent -- audience <<<'{"minScore":12,"limit":30}'
```

The audience classifier is only a prioritization aid. It should not be treated as proof about a person's identity or intent. Prioritize peer builders, maintainers, researchers, model/devtool practitioners, and technical founders. Avoid optimizing growth around legacy crypto/general followers merely because they already follow the account.

### Relationship Intelligence — implemented

Phase 1B keeps `audience_profiles` as raw follower/following observation and materializes separate strategic `relationship_profiles` plus append-only `relationship_events`. Audience refresh recomputes currently observed relevant relationship profiles without deleting omitted profiles or prior interaction history.

Current target classes:

- `distribution` — observed audience/cluster overlap plus useful technical conversation quality;
- `relationship` — recurring interaction is realistically valuable based on topic plus follow/interaction evidence;
- `authority` — conservative technical-role evidence plus strong topic fit;
- `customer_density` — observed audience evidence indicates commercially relevant developer density;
- `source` — explicit source evidence or strong technical authority/topic specificity.

TargetScore exposes **TopicFit, AudienceOverlap, ConversationQuality, ReplyVisibility, and RelationshipPotential**. Missing observable components are omitted and remaining weights are renormalized; follower count is confined to the bounded `-5..+5` ReachModifier.

Relationship stages derive from event/follow evidence:

`observed -> interacted -> responsive -> recurring -> connected -> mutual`

Read through the bridge rather than querying SQLite directly:

```bash
npm run agent -- relationship-targets <<<'{"class":"relationship","stage":"responsive","minTargetScore":40,"limit":20}'
npm run agent -- relationship-inspect <<<'{"username":"example","limit":20}'
npm run agent -- relationship-events <<<'{"username":"example","limit":50}'
```

These Phase-1B commands remain read-only. Phase 1C now records relationship events internally only when it observes a real target response or after an explicitly approved reply is successfully sent.

### Engage Next — implemented

Phase 1C uses a separate `queue_items(lane=engagement, pipeline=reply)` workflow and prioritizes:

1. observed replies/quotes to our existing conversations;
2. fresh posts from high-value relationship/authority/distribution targets;
3. research candidates where a reply is a better action than a quote/original.

Every actionable item exposes target relationship context, Conversation Potential, Relationship Potential, TargetScore, freshness/expiry, per-post ReplyVisibility, EngagePriority, the concrete proposed contribution, and `initial_reply` / `follow_up` / `own_post_response` kind. If the current source cannot support a concrete contribution, it is not queued. Saturation/repetition are bounded soft modifiers; active/direct-response evidence can neutralize them.

Inspect cached state first, then refresh only when freshness can change the selected action:

```bash
npm run agent -- engage-next <<<'{"compact":true,"minPriority":40,"limit":30}'
npm run agent -- engage-refresh <<<'{"minPriority":40,"limit":30}'
```

Create or update reviewable reply text without approving it:

```bash
npm run agent -- engage-draft <<<'{"key":"https://x.com/example/status/123"}'
npm run agent -- engage-draft <<<'{"key":"https://x.com/example/status/123","body":"Concrete reply text","requestReview":true}'
```

Resolve without sending:

```bash
npm run agent -- engage-resolve <<<'{"key":"https://x.com/example/status/123","action":"ignore","reason":"No additional value now"}'
```

The bridge has no engagement-approval command. Human approval lives in the dashboard and recomputes the Phase-2 reply gates, then snapshots the exact approved reply text. Editing/rerouting invalidates that approval. `engage-resolve` can use `action: send` only after that approval exists and requires `confirmSend: true`; the send path verifies the saved draft still matches the approved text exactly before issuing one `replyTo` write. Successful sends record the queue result, candidate `reply` action, and append-only `our_reply` relationship event. Transport failures become recoverable `failed` items; a post that succeeds remotely but cannot finish local recording remains `publishing` for reconciliation rather than being sent again.

### Account Health — current

Phase 1D provides an advisory-first account-health/visibility layer that distinguishes actual platform/visibility evidence from internal efficiency warnings.

Current states:

- `HEALTHY` — no material supported observed concern;
- `WATCH` — soft saturation/repetition/concentration/InteractionYield warning;
- `CONSTRAINED` — supported observed visibility/enforcement evidence or an explicit provenance-backed project/platform hard boundary.

Inspect structured health/network diagnostics:

```bash
npm run agent -- account-health <<<'{}'
```

Record only directly observed evidence, with explicit provenance and observation time:

```bash
npm run agent -- health-observe <<<'{"type":"visibility_label_observed","severity":"constraint","source":"operator","sourceRef":"visible X account label","metadata":{"label":"example visible label"},"observedAt":1787100000000}'
```

Attempt the bounded authenticated Under-the-Hood read with:

```bash
npm run agent -- health-under-the-hood <<<'{}'
```

A snapshot is persisted only when the reader returns `available:true`. `available:false` is a clean read result and does not imply HEALTHY, WATCH, or CONSTRAINED.

Target saturation, daily reply count, repeated reply archetype, crowded conversations, low reach, and InteractionYield are **not** automatic bans. A direct target question, active bidirectional exchange, or new verified evidence can neutralize WATCH-level priority pressure. WATCH never removes the explicit human review/send path. Exact/near-duplicate *draft text* remains a Phase-2 hard failure; archetype/style concentration remains advisory unless the actual text is genuinely duplicate/near-duplicate.

There is no fixed daily reply quota and no human-looking jitter/circadian timing requirement. Health outputs are structured data for later Phase-4 measurement; downstream work must not reverse-engineer the dashboard text.

## When the user manually gives the agent an X post

### 1. Inspect the source first

If the user supplies only an X URL, retrieve the exact post with the authenticated XActions/browser path already used by this project. Capture at minimum:

- URL
- author
- exact source text
- timestamp if available
- views, likes, reposts, replies if available
- quoted-post or thread context when it materially changes the meaning


### 2. Ingest it into the shared research memory

Example:

```bash
cat <<'JSON' | node agent_bridge.js ingest
{
  "url": "https://x.com/example/status/123",
  "author": "@example",
  "text": "Exact source post text",
  "timestamp": 1787090000000,
  "metrics": {
    "views": 82000,
    "likes": 1400,
    "reposts": 180,
    "replies": 95
  },
  "saved": true,
  "createDraft": true
}
JSON
```

`ingest` runs the same niche classifier used by automatic discovery. The result becomes part of the same SQLite research library as dashboard-discovered posts.

### 3. Decide whether it deserves a draft

A source is worth drafting when it provides at least one of:

- developer utility;
- a meaningful model/tool change;
- a reproducible experiment;
- an architectural implication;
- a useful job/career signal for technical people;
- a developer-to-business lesson;
- a viral claim that can be tested, corrected, or reframed.

Do not draft merely because a post is viral.

### 4. Inspect context before writing

Inspect useful source and conversation context before drafting.

For a viral source post, explicitly determine:

1. What is the source claiming?
2. What did most replies/other posts focus on?
3. What is the non-obvious angle for a developer?
4. What concrete action should a developer take?

The goal is not to rewrite the source tweet.

For the final writing pass, use `POST_GENERATION_PROMPT.md` as the canonical style/editor contract: global English, one thesis, short scannable paragraphs, 1-3 natural semantic anchors, zero hashtags by default, and no generic engagement bait.

### 5. Create or inspect the draft

```bash
printf '%s' '{"key":"https://x.com/example/status/123"}' | node agent_bridge.js create-draft
```

The generated scaffold is deliberately incomplete and normally scores below publishable quality. Replace every placeholder.

### 6. Get the canonical writer packet and apply structured output

```bash
printf '%s' '{"key":"https://x.com/example/status/123"}' | node agent_bridge.js writer-packet
```

`writer-packet` returns `{ packet, generation }`. Feed only `packet` to the external Writer. `packet` contains the routed pipeline, candidate/queue opportunity context, relationship context when available, current draft, recent approved/published content, profile-proof slot, constraints, and `docs/POST_GENERATION_PROMPT.md`. It contains `writingStrategy` only when the latest persisted human selection is `apply`. `off`, `suggest`, and no selection add no strategy instruction. `generation` is transport provenance for `apply-writer-output`; it is not Writer guidance. `writer-packet` does not call an LLM.

After applying that prompt externally, persist the structured candidate output and echo the exact `generation` object returned by `writer-packet`:

```bash
cat <<'JSON' | node agent_bridge.js apply-writer-output
{
  "id": 12,
  "generation": {"preparedAt": 1787230000000, "draftId": 12, "draftUpdatedAt": 1787229999000, "selectionId": null, "selectionSelectedAt": null, "selectionSource": null, "mode": null, "strategyApplied": false, "strategySnapshot": null, "writingStrategy": null},
  "output": {
    "decision": "POST",
    "pipeline": "original",
    "thesis": "One defensible developer thesis.",
    "finalText": "Final publication text.",
    "threadParts": [],
    "semanticAnchors": ["MCP"],
    "evidenceUsed": ["verified primary-source fact"],
    "discussionQuestion": "",
    "media": {"required": false, "type": "none", "reason": "", "source": "", "altText": ""},
    "riskFlags": [],
    "followReason": "Why the target developer would want future posts.",
    "notes": ""
  }
}
JSON
```

The writer output pipeline must match the currently routed queue item. `apply-writer-output` validates the echoed generation context against both the append-only human selection history and the exact draft revision that `writer-packet` prepared. A successful apply changes that draft revision, so the same packet cannot be replayed to persist a second output; request a fresh `writer-packet` after any draft edit or completed generation. The command persists generation provenance with the draft and returns the item to `drafting`; it never requests review or approval. If the external Writer has inspectable execution metadata, pass it separately as `writerAiExecution`; otherwise execution remains explicitly unavailable for that bridge generation. `DO_NOT_POST` is preserved with a recommendation to route Research/Watch/Ignore rather than deleting the draft/history.

The persisted media vocabulary is exactly `none | screenshot | chart | code | diagram`. Media planning remains draft/editor metadata; operator-attached JPEG/PNG/WebP/GIF files can now provide real readiness, preview in the dashboard, and upload through the authenticated X transport at publication time. Required media remains approval-blocking until the attachment and media plan are complete.

### 7. Edit and request review

```bash
cat <<'JSON' | node agent_bridge.js update-draft
{
  "id": 12,
  "hook": "The interesting part of X is not the headline. It changes Y.",
  "insight": "Explain the technical implication and who should care.",
  "evidence": "Primary-source evidence, metric, command, benchmark, or concrete result. https://source.example",
  "action": "What I would test/use/avoid next.",
  "status": "ready"
}
JSON
```

The bridge computes the 50-point rubric, saves edited text as `draft`, and interprets `status: ready` as a request to move the workflow item to `needs_review`. The response includes `approvalRequired: true`. The agent never turns the draft itself into `ready`.

Current writing-quality dimensions:

- hook: 8
- insight: 10
- evidence: 10
- action: 7
- originality vs source: 5

These total 40 raw writing points and are proportionally normalized to the 50-point writing-quality scale. Growth fit and Growth Packaging are separate; the score is not a virality or follower-growth prediction.

Final human approval requires at least **40/50** and a passing deterministic gate result. Gates cover niche/additive value; source/recent duplication; scannability/placeholders/weighted length; CTA integrity; hashtag/emoji limits; thread rules; and required-media readiness. Approval recomputes the latest saved content. For main-feed routes, approval sets the queue item to `approved` and its draft to compatibility `ready`. For Engage Next, approval additionally snapshots the exact reply body; only the explicit Engage send path can consume that snapshot. No bridge command can create either human approval.

## Queue and automation interaction

The web dashboard now uses the provisional H2 shell **Today / Discover / Conversations / Posts / Results / Learn**, with **Settings** as a utility destination. These labels are a presentation layer only: agents should continue using the stable bridge commands and existing domain owners below. The guided shell must not be interpreted as a change to approval, send, scheduler, Account Health, experiment, or learned-rule authority.

Phase 1A workflow is current:

1. Explicit workflow entry creates/ensures `queue_items(status=triage)` and stores four opportunity scores plus a route recommendation. Bookmark/reference state is independent and must not be inferred from queue presence.
2. `route` selects the pipeline but does not approve it; newly created text drafts use the actual Original/Quote/Thread/Reply scaffold.
3. `writer-packet` prepares inspectable writing context and `apply-writer-output` persists allow-listed editor output without workflow authorization.
4. `status: ready` through `update-draft` only requests `needs_review`; review computes and persists current hard gates even when they fail so the human can inspect them.
5. The dashboard's explicit human **Approve for publishing** action recomputes the latest gates and is the only workflow path that moves a main-feed item to `approved` and sets its associated text draft to compatibility `ready`.
6. Engage Next uses the same drafting/review gates but a distinct explicit **Approve & send exact reply** boundary; approved engagement drafts are excluded from main-feed scheduling/publication.
7. Phase 3 uses the approved **main-feed queue row** as publication authority. The scheduler computes priority/time without changing approval; an optional concrete human time override is stored separately from approval.
8. With `AUTO_POST=true`, automation atomically claims one due Original/Quote/Thread row from `approved` to `publishing` before transport. Success becomes `published`; a transport failure becomes inspectable `failed`. Repost remains manual.

Inspect workflow state:

```bash
printf '%s' '{"limit":20}' | node agent_bridge.js queue
printf '%s' '{"key":"https://x.com/example/status/123"}' | node agent_bridge.js workflow
printf '%s' '{}' | node agent_bridge.js schedule-next
printf '%s' '{"key":"https://x.com/example/status/123"}' | node agent_bridge.js schedule-inspect
```

Route an item without approving it:

```bash
printf '%s' '{"key":"https://x.com/example/status/123","pipeline":"original"}' | node agent_bridge.js route
```

The automation daemon refreshes real X source snapshots and Engage Next after research, with observed responses checked before cold opportunities. Autonomous replies are independently **off by default**. When the operator explicitly starts the persisted reply grant in Dry run or Live mode, the same daemon keeps evaluating newly observed active, momentum, and normal-relevant opportunities until Pause/Stop/revocation or process shutdown. A cycle may produce zero, one, or several serial decisions; already-decided targets are durable across restart. Dry-run records exact would-send/review/skip decisions without X mutation. Live autonomous send has a distinct atomic authority path and never creates `humanApprovedAt`; it requires remaining operator budget, all autonomous deterministic gates, and an atomic claim. Main-feed selection remains separate: it reads approved main-feed queue items, supplies current/recent publication context to `scheduler.js`, and considers only scheduler-eligible Original/Quote/Thread items for daemon publication.

`AUTO_POST` controls only the main-feed publication path. When `AUTO_POST=false`, main-feed automation previews the recommendation and performs no main-feed claim/transport call; when true it atomically claims the exact approved queue snapshot. The autonomous-reply grant is a separate authority and defaults to stopped. Scheduler spacing/urgency/expiry remain `EMPIRICAL_VARIABLE` editorial heuristics; there is no fake-human minimum interval or jitter. Original uses ordinary tweet creation, Quote uses the stored source tweet ID, and Thread uses the approved explicit thread parts as one main-feed unit. Engagement approval never makes a reply eligible for main-feed scheduling, and Repost remains manual.

A successful main-feed transport marks the queue item `published`, stores its root tweet ID/output URL/publication time, updates the associated draft, and records the candidate action. A transport failure after claim becomes `failed` with its error and is not silently retried. If X succeeds but local recording is incomplete, the item remains non-approved/non-retryable with inspectable recording state. Human and autonomous Engage Next sends share the low-level reply transport/success-recording owner, but their authority provenance stays distinct. An autonomous unresolved remote result remains non-retryable and requires reconciliation.

Implemented here: Phase-2 format-aware writing/gates, Phase-1C Engage Next plus the off-by-default persistent autonomous-reply operator, Phase-1D Account Health, Phase-3 queue-aware main-feed scheduling/claiming plus Original/Quote/Thread HTTP publication, operator-attached image upload/readiness, Phase-4 fixed-window measurement/experiments, and Phase-5 human-controlled learned strategy. Required media remains blocked until a real attachment and complete media plan are present.

Inspect and manage learned strategy without editing SQLite directly:

```bash
printf '%s' '{}' | node agent_bridge.js learning
printf '%s' '{"experimentId":1,"baselineLabel":"original","comparisonLabel":"thread","windowMinutes":60}' | node agent_bridge.js learning-refresh
printf '%s' '{"id":1,"confirmAccept":true}' | node agent_bridge.js learning-accept
printf '%s' '{"id":1,"reason":"newer evidence reversed direction","confirmRetire":true}' | node agent_bridge.js learning-retire
```

`learning-refresh` only creates/updates `suggested` evidence. Suggested and retired rules have zero production effect. Accepted rules remain bounded additions after base TargetScore/opportunity/EngagePriority/health/scheduler logic; explicit human routing/timing, hard gates, expiry, approval requirements, and supported hard Account Health evidence override learning.

## Agent behavior by user request

### User says: "this post is interesting"

- inspect the source;
- `ingest` with `saved: true`;
- do not create a draft unless the user asks or the post clearly produces a strong original angle.

### User says: "make something from this"

- inspect and ingest;
- research primary evidence;
- `create-draft`;
- replace scaffold with an original post;
- `update-draft` and show the quality score;
- leave status `draft` unless the user asks to queue it or has already authorized the publishing workflow.

### User says: "queue this"

- ensure the candidate has the intended `route`;
- ensure the draft is complete and factually checked;
- request `status: ready` through `update-draft`; this moves it to `needs_review` and returns `approvalRequired: true`;
- do **not** claim it is approved or compatibility-ready until the user performs the explicit dashboard approval action;
- do not change `AUTO_POST` unless explicitly asked.

### User says: "post this now"

This is explicit publication authorization for that specific content. The agent may use the project's publication path, but should still preserve the final draft/published state in the system so performance tracking can connect outcome to source/draft history.

### User says: "find opportunities"

Use persisted candidates with tags `jobs/career`, `builders`, or `business`, then distinguish real technical relevance from generic career/business posts.

## Strict invariants

- Never turn a source tweet into a near-copy. Add analysis, testing, context, evidence, or a developer action.
- Never represent `needs_review` as human approval; only the explicit dashboard approval action may create compatibility `ready`.
- Never manipulate SQLite directly from an agent when the bridge command exists.
- Never silently enable `AUTO_POST`.
- Do not impose an arbitrary daily reply cap or fake-human timing/jitter rule. High activity can be healthy when it is human-reviewed, substantive, and genuinely conversational.
- Treat target saturation, repeated archetype, concentration, and InteractionYield as advisory diagnostics; accepted learned rules may tune their bounded soft effect, while exact/near-duplicate replies remain a hard stop owned by the content gate.
- Replies and quote-posts should add a specific technical contribution, not generic praise or engagement bait.
- Record successful candidate-based direct/quote/repost/reply actions through `record-action` when another path has not already done so. The Engage Next approved-send path records its own successful `reply` action and `our_reply` relationship event exactly once.
- Preserve the content and distribution standards in `CONTENT_OPERATING_STANDARD.md` and `GROWTH_DISTRIBUTION_PLAYBOOK.md`.

## Feedback loop

After publishing, the dashboard `Performance` view records account and recent original-post metrics. Future research/drafting decisions should use that history together with saved-source preferences:

**what the user saved + what the account published + what actually performed -> better discovery and drafting decisions.**

The system should learn steadily from explicit user selections and observed outcomes; it should not change niche identity based on one viral post.

The network-first feedback loop additionally tracks:

**who we engaged + who responded + which conversations continued + which targets followed/connected + which owned posts converted relevant followers -> better target selection, reply strategy, profile proof, content, and timing.**

Algorithm/tactic claims must remain tagged according to `ALGORITHM_EVIDENCE_LEDGER.md`; empirical timing/account-size/reply-volume assumptions belong in experiments rather than being hard-coded as X laws.
