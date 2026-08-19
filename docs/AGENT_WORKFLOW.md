# Agent Workflow

This document is the operating contract for any agent that researches, drafts, or queues content for this account.

## System objective

The account is an **AI-native developer + builder** account. The agent should turn useful signals into original developer value:

**signal -> why it matters -> evidence -> action**

The agent is not a generic news summarizer. It should prefer AI coding agents, models/inference, developer tools, infrastructure/architecture, developer jobs/career, builders/SaaS, and technical productization/business.

The architecture is also **network-first**. Publishing is one instrument inside a broader loop:

**conversation insertion -> repeated interaction -> relationship -> profile conversion -> follow -> stronger future distribution -> owned-content conversion.**

Use `NETWORK_GROWTH_OPERATING_SYSTEM.md` for the strategic model, `RELATIONSHIP_INTELLIGENCE.md` for current relationship ownership plus planned Engage Next inputs, and `ALGORITHM_EVIDENCE_LEDGER.md` for evidence classification.

## Stable interface

Agents should interact with the system through `agent_bridge.js`, not by editing `.x-research.sqlite`, `.automation-state.json`, or dashboard HTML directly.

The bridge is JSON-in / JSON-out:

```bash
printf '%s' '<json>' | node agent_bridge.js <command>
```

Available commands:

- `ingest` - add a manually supplied source post to research memory; classifies niche and saves it by default.
- `inspect` - inspect one stored candidate and its draft.
- `create-draft` - save/route a candidate into a text pipeline and create/reuse the structured Hook/Insight/Evidence/Action scaffold.
- `update-draft` - update/rescore a draft; `status: ready` now means **request workflow review**, not self-approval.
- `queue` - inspect workflow queue items plus the temporary compatibility draft queue.
- `route` - select/override Original / Quote / Thread / Reply / Repost / Research / Watch / Ignore for a candidate; agents cannot approve.
- `workflow` - inspect one candidate's queue row, draft, actions, current score breakdown, and stored recommendation.
- `research` - query persisted research candidates.
- `performance` - read the latest persisted account/post performance snapshot.
- `decide` - apply the DIRECT / QUOTE / REPOST / REPLY / IGNORE distribution decision method to a stored candidate.
- `record-action` - persist a successful direct/quote/repost/reply result, including output tweet ID/URL and commentary.
- `relationship-targets` - list strategic relationship profiles with optional class/stage/min-TargetScore filters.
- `relationship-inspect` - inspect one relationship profile plus recent append-only event history.
- `relationship-events` - read bounded recent relationship events for one username.
- `engage-next` - refresh/read ranked actionable engagement items, grouped into Active Conversations and New Opportunities.
- `engage-draft` - create/update a Phase-2 reply draft and optionally request review; it never approves or sends.
- `engage-resolve` - ignore/expire an item or explicitly send an already human-approved exact reply; it cannot approve one.
- `audience-sync` - refresh the authenticated follower/following audience snapshot and strategic state for currently observed relevant profiles.
- `audience` - inspect the raw niche-aligned follower/following observation layer.

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

After a successful X action, persist it immediately:

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

A recorded action makes that source `alreadyUsed` by default for future distribution decisions.

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

Inspect/refresh:

```bash
npm run agent -- engage-next <<<'{"refresh":true,"minPriority":40,"limit":30}'
```

Create or update reviewable reply text without approving it:

```bash
npm run agent -- engage-draft <<<'{"key":"https://x.com/example/status/123"}'
npm run agent -- engage-draft <<<'{"key":"https://x.com/example/status/123","body":"Concrete reply text","requestReview":true,"factualityConfirmed":true,"evidenceConfirmed":true}'
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

Do not invent metrics or source context.

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

### 4. Research before writing

For claims that can change or that need verification, inspect primary sources before drafting. Prefer official docs, repositories, benchmarks, release notes, code, or the original announcement.

For a viral source post, explicitly determine:

1. What is the source claiming?
2. What is actually verified?
3. What did most replies/other posts focus on?
4. What is the non-obvious angle for a developer?
5. What evidence can the final post include?
6. What concrete action should a developer take?

The goal is not to rewrite the source tweet.

For the final writing pass, use `POST_GENERATION_PROMPT.md` as the canonical style/editor contract: global English, one thesis, short scannable paragraphs, 1-3 natural semantic anchors, zero hashtags by default, evidence-led claims, and no generic engagement bait.

### 5. Create or inspect the draft

```bash
printf '%s' '{"key":"https://x.com/example/status/123"}' | node agent_bridge.js create-draft
```

The generated scaffold is deliberately incomplete and normally scores below publishable quality. Replace every placeholder.

### 6. Get the canonical writer packet and apply structured output

```bash
printf '%s' '{"key":"https://x.com/example/status/123"}' | node agent_bridge.js writer-packet
```

`writer-packet` returns the routed pipeline, candidate/queue opportunity context, relationship context when available, current draft, recent approved/published content, profile-proof slot, constraints, and `docs/POST_GENERATION_PROMPT.md`. It does not call an LLM.

After applying that prompt externally, persist only the structured candidate output:

```bash
cat <<'JSON' | node agent_bridge.js apply-writer-output
{
  "id": 12,
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

The writer output pipeline must match the currently routed queue item. Applying output persists editor/thread text and returns the item to `drafting`; it never requests review or approval. `DO_NOT_POST` is preserved with a recommendation to route Research/Watch/Ignore rather than deleting the draft/history.

The persisted media vocabulary is exactly `none | screenshot | chart | code | diagram`. Media upload/readiness is not implemented in Phase 2.

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

Current quality dimensions:

- niche fit: 10
- hook: 8
- insight: 10
- evidence: 10
- action: 7
- originality vs source: 5

Final human approval requires at least **40/50** and a passing deterministic gate result. Gates cover explicit factuality confirmation; evidence confirmation when claims require it; niche/additive value; source/recent duplication; scannability/placeholders/weighted length; CTA integrity; hashtag/emoji limits; first-person evidence; thread rules; and required-media readiness. The dashboard confirmation checkboxes are deliberately unchecked on every review/approval submission, and approval recomputes the latest saved content. For main-feed routes, approval sets the queue item to `approved` and its draft to compatibility `ready`. For Engage Next, approval additionally snapshots the exact reply body; only the explicit Engage send path can consume that snapshot. No bridge command can create either human approval.

## Queue and automation interaction

Phase 1A workflow is current:

1. Save creates/ensures `queue_items(status=triage)` and stores four opportunity scores plus an AI route recommendation.
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

The automation daemon refreshes Engage Next after research, with observed responses checked before cold opportunities, but it does **not** send replies. Main-feed selection no longer uses compatibility-ready draft FIFO: it reads approved main-feed queue items, supplies current/recent publication context to `scheduler.js`, and considers only scheduler-eligible Original/Quote/Thread items for daemon publication.

When `AUTO_POST=false`, automation previews the recommendation and performs **no claim and no transport call**. When `AUTO_POST=true`, it atomically claims the exact approved queue snapshot before transport. Scheduler spacing/urgency/expiry are editorial coverage heuristics labeled `EMPIRICAL_VARIABLE`; there is no fake-human minimum interval or jitter. Original uses ordinary tweet creation, Quote uses the stored source tweet ID, and Thread uses the approved explicit thread parts as one main-feed unit. Engagement approval never makes a reply eligible for this daemon path, and Repost remains manual.

A successful main-feed transport marks the queue item `published`, stores its root tweet ID/output URL/publication time, updates the associated draft, and records the candidate action. A transport failure after claim becomes `failed` with its error and is not silently retried. If X succeeds but local recording is incomplete, the item remains non-approved/non-retryable with inspectable recording state. A successful Engage Next reply is recorded by the explicit engagement send path instead.

Implemented here: Phase-2 format-aware writing/gates, Phase-1C Engage Next, and Phase-3 queue-aware main-feed scheduling/claiming plus Original/Quote/Thread HTTP publication. Still planned: Account Health, actual media upload/readiness, experiments/follower conversion, and learned strategy.

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

- Never manufacture evidence, metrics, benchmark results, quotes, or source context.
- Never turn a source tweet into a near-copy. Add analysis, testing, context, evidence, or a developer action.
- Never represent `needs_review` as human approval; only the explicit dashboard approval action may create compatibility `ready`.
- Never manipulate SQLite directly from an agent when the bridge command exists.
- Never silently enable `AUTO_POST`.
- Never use automated likes, follow churn, or mass unsolicited replies as part of this workflow.
- Do not impose an arbitrary daily reply cap or fake-human timing/jitter rule. High activity can be healthy when it is human-reviewed, substantive, and genuinely conversational.
- Treat target saturation/repeated archetype/concentration as advisory until Phase 1D evidence says otherwise; exact/near-duplicate replies remain a hard stop.
- Replies and quote-posts should add a specific technical contribution, not generic praise or engagement bait.
- Record successful candidate-based direct/quote/repost/reply actions through `record-action` when another path has not already done so. The Engage Next approved-send path records its own successful `reply` action and `our_reply` relationship event exactly once.
- Preserve the content and engagement standards in `CONTENT_OPERATING_STANDARD.md`, `ENGAGEMENT_INTEGRITY.md`, and `GROWTH_DISTRIBUTION_PLAYBOOK.md`.

## Feedback loop

After publishing, the dashboard `Performance` view records account and recent original-post metrics. Future research/drafting decisions should use that history together with saved-source preferences:

**what the user saved + what the account published + what actually performed -> better discovery and drafting decisions.**

The system should learn steadily from explicit user selections and observed outcomes; it should not change niche identity based on one viral post.

The network-first feedback loop additionally tracks:

**who we engaged + who responded + which conversations continued + which targets followed/connected + which owned posts converted relevant followers -> better target selection, reply strategy, profile proof, content, and timing.**

Algorithm/tactic claims must remain tagged according to `ALGORITHM_EVIDENCE_LEDGER.md`; empirical timing/account-size/reply-volume assumptions belong in experiments rather than being hard-coded as X laws.
