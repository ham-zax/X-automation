# Agent Workflow

This document is the operating contract for any agent that researches, drafts, or queues content for this account.

## System objective

The account is an **AI-native developer + builder** account. The agent should turn useful signals into original developer value:

**signal -> why it matters -> evidence -> action**

The agent is not a generic news summarizer. It should prefer AI coding agents, models/inference, developer tools, infrastructure/architecture, developer jobs/career, builders/SaaS, and technical productization/business.

The planned architecture is also **network-first**. Publishing is one instrument inside a broader loop:

**conversation insertion -> repeated interaction -> relationship -> profile conversion -> follow -> stronger future distribution -> owned-content conversion.**

Use `NETWORK_GROWTH_OPERATING_SYSTEM.md` for the strategic model, `RELATIONSHIP_INTELLIGENCE.md` for planned target/relationship ownership, and `ALGORITHM_EVIDENCE_LEDGER.md` for evidence classification.

## Stable interface

Agents should interact with the system through `agent_bridge.js`, not by editing `.x-research.sqlite`, `.automation-state.json`, or dashboard HTML directly.

The bridge is JSON-in / JSON-out:

```bash
printf '%s' '<json>' | node agent_bridge.js <command>
```

Available commands:

- `ingest` - add a manually supplied source post to research memory; classifies niche and saves it by default.
- `inspect` - inspect one stored candidate and its draft.
- `create-draft` - create the structured Hook/Insight/Evidence/Action scaffold for a candidate.
- `update-draft` - update a draft, rescore it, and optionally request `ready` status.
- `queue` - inspect ready/draft queue state.
- `research` - query persisted research candidates.
- `performance` - read the latest persisted account/post performance snapshot.
- `decide` - apply the DIRECT / QUOTE / REPOST / REPLY / IGNORE distribution decision method to a stored candidate.
- `record-action` - persist a successful direct/quote/repost/reply result, including output tweet ID/URL and commentary.
- `audience-sync` - refresh the authenticated follower/following audience snapshot.
- `audience` - inspect niche-aligned followers and relationship targets.

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

### Planned relationship-intelligence upgrade — not implemented yet

Phase 1B replaces simple relevance/follower-count thinking with persistent relationship intelligence.

Planned target classes:

- `distribution` — overlapping audience/reach;
- `relationship` — recurring interaction is realistically valuable;
- `authority` — technically credible account whose engagement/information matters;
- `customer_density` — conversations contain commercially relevant developer audiences;
- `source` — consistently useful primary/early technical information.

Planned target scoring uses **TopicFit, AudienceOverlap, ConversationQuality, ReplyVisibility, and RelationshipPotential**, with follower count only as a bounded reach modifier.

Planned relationship stages:

`observed -> interacted -> responsive -> recurring -> connected -> mutual`

Future commands are specified in `plans/PHASE_1B_RELATIONSHIP_INTELLIGENCE.md`. Until implemented, do not invent `relationship-targets`, `relationship-inspect`, or `relationship-events` bridge behavior.

### Planned Engage Next upgrade — not implemented yet

Phase 1C adds a separate engagement lane that prioritizes:

1. responses to our existing conversations;
2. fresh posts from high-value relationship/authority/distribution targets;
3. research candidates where a reply is a better action than a quote/original.

Every Engage Next item must explain target relationship context, Conversation Potential, Relationship Potential, freshness/expiry, the concrete contribution we can add, and whether the opportunity is an initial reply or a follow-up.

The agent may eventually draft these items, but outbound replies remain explicit human decisions. See `plans/PHASE_1C_ENGAGE_NEXT.md`.

### Planned Account Health upgrade — not implemented yet

Phase 1D adds an advisory account-health/visibility layer. It must distinguish actual platform/visibility evidence from internal efficiency warnings.

Planned states:

- `HEALTHY` — no material observed concern;
- `WATCH` — soft saturation/repetition/concentration/InteractionYield warning;
- `CONSTRAINED` — observed visibility/enforcement evidence or another explicit hard boundary.

Target saturation, daily reply count, repeated reply archetype, and crowded conversations are **not** automatic bans. A direct target question, active bidirectional exchange, or new verified evidence can justify engaging despite a WATCH-level warning.

There is no fixed daily reply quota and no human-looking jitter/circadian timing requirement. Exact/near-duplicate replies remain hard failures; repeated archetypes/structures are advisory unless the text is genuinely near-duplicate.

Future commands are specified in `plans/PHASE_1D_ACCOUNT_HEALTH.md`. Until implemented, do not invent `account-health`, `health-observe`, or `health-under-the-hood` behavior.

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

### 6. Update and score the draft

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

The bridge computes the 50-point rubric and refuses to leave the draft as `ready` when it is below the publishability gate or still contains placeholders.

Current quality dimensions:

- niche fit: 10
- hook: 8
- insight: 10
- evidence: 10
- action: 7
- originality vs source: 5

`ready` requires at least **40/50**, no scaffold placeholders, and a single-post weighted length of at most **280 characters** (URLs count as 23 characters).

## Queue and automation interaction

The automation daemon does two jobs:

1. refreshes research memory from X niche discovery, X viral discovery, GitHub, and Hacker News;
2. looks for a `ready` draft at or above the configured quality threshold.

Inspect the queue:

```bash
printf '%s' '{"minScore":40}' | node agent_bridge.js queue
```

When `AUTO_POST=false`, the automation only previews the next ready draft. This is the normal safe development mode.

When `AUTO_POST=true`, the automation may publish the next eligible ready draft after the configured cooldown. The agent should not bypass that queue by calling the private posting transport directly unless the user explicitly asks for an immediate manual publication.

A successfully published queued draft is marked `published` and records the returned tweet ID.

### Planned queue upgrade — not implemented yet

`HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md` specifies the next queue architecture. When implemented:

- Save will create/ensure a `triage` queue item;
- AI will recommend Original / Quote / Thread / Reply / Repost / Research / Watch / Ignore;
- the human will select or override the route;
- AI-controlled progress will stop at `needs_review` for main-feed content;
- human approval will be required before scheduling;
- viral items may pre-empt evergreen order while main-feed publication remains serialized;
- successful publication will remain recorded in candidate action history and performance data.

Until those bridge commands and queue states actually exist, agents must continue using the current draft/`ready` workflow documented above and must not invent or simulate future commands.

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

- ensure the draft is complete and factually checked;
- request `status: ready` through `update-draft`;
- confirm whether the quality gate accepted it;
- do not change `AUTO_POST` unless explicitly asked.

### User says: "post this now"

This is explicit publication authorization for that specific content. The agent may use the project's publication path, but should still preserve the final draft/published state in the system so performance tracking can connect outcome to source/draft history.

### User says: "find opportunities"

Use persisted candidates with tags `jobs/career`, `builders`, or `business`, then distinguish real technical relevance from generic career/business posts.

## Strict invariants

- Never manufacture evidence, metrics, benchmark results, quotes, or source context.
- Never turn a source tweet into a near-copy. Add analysis, testing, context, evidence, or a developer action.
- Never mark a scaffold containing placeholders as ready.
- Never manipulate SQLite directly from an agent when the bridge command exists.
- Never silently enable `AUTO_POST`.
- Never use automated likes, follow churn, or mass unsolicited replies as part of this workflow.
- Do not impose an arbitrary daily reply cap or fake-human timing/jitter rule. High activity can be healthy when it is human-reviewed, substantive, and genuinely conversational.
- Treat target saturation/repeated archetype/concentration as advisory until Phase 1D evidence says otherwise; exact/near-duplicate replies remain a hard stop.
- Replies and quote-posts should add a specific technical contribution, not generic praise or engagement bait.
- Record successful candidate-based direct/quote/repost/reply actions through `record-action` so the same source is not accidentally recycled.
- Preserve the content and engagement standards in `CONTENT_OPERATING_STANDARD.md`, `ENGAGEMENT_INTEGRITY.md`, and `GROWTH_DISTRIBUTION_PLAYBOOK.md`.

## Feedback loop

After publishing, the dashboard `Performance` view records account and recent original-post metrics. Future research/drafting decisions should use that history together with saved-source preferences:

**what the user saved + what the account published + what actually performed -> better discovery and drafting decisions.**

The system should learn steadily from explicit user selections and observed outcomes; it should not change niche identity based on one viral post.

The network-first feedback loop additionally tracks:

**who we engaged + who responded + which conversations continued + which targets followed/connected + which owned posts converted relevant followers -> better target selection, reply strategy, profile proof, content, and timing.**

Algorithm/tactic claims must remain tagged according to `ALGORITHM_EVIDENCE_LEDGER.md`; empirical timing/account-size/reply-volume assumptions belong in experiments rather than being hard-coded as X laws.
