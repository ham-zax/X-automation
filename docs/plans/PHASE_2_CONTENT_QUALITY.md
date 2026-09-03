# Phase 2: Format-Aware Writing, Hard Gates, and Media Planning Implementation Plan

**Status:** historical execution contract. Current Writer/gate semantics are owned by `docs/POST_GENERATION_PROMPT.md`, `docs/CONTENT_OPERATING_STANDARD.md`, `behavior.js`, and `drafting.js`; fixed morphology/additivity guidance below is retained only as implementation history.

**Goal:** Turn a routed queue item into a format-aware, highly scannable draft that follows the canonical writing prompt, stores enough editorial metadata for human review, and cannot reach approval unless the remaining deterministic gates and the existing 50-point quality rubric pass.

**Architecture:** Keep `drafting.js` as the text composition/scoring/gate owner. Do not embed an LLM provider in the repo; the system remains human+AI by exposing a structured writer packet through `agent_bridge.js`, accepting structured writer output back, validating it deterministically, and rendering it for human review in `dashboard.js`. Keep media as a plan/attachment contract in this phase; actual upload/publication is owned by the later distribution phase.

**Tech Stack:** Existing Node.js modules, built-in SQLite, Bootstrap dashboard, `docs/POST_GENERATION_PROMPT.md`, Phase-1 `queue_items`/`pipeline.js`, current `drafting.js`, `store.js`, `agent_bridge.js`, and `dashboard.js`.

## Global Constraints

- Use `docs/POST_GENERATION_PROMPT.md` as the canonical final writing/editor contract.
- Default language is clear global English.
- Single-post content should express one central thesis.
- Use 1-3 precise semantic anchors naturally when relevant.
- Default to zero hashtags; prefer 0-1, allow 2 when both are directly relevant/canonical, and treat the exact optimum as empirical.
- Default to zero emoji; maximum one when it materially improves tone/clarity.
- Original, quote, thread, and reply have different writing contracts.
- Quote commentary must not summarize the visible source; it must add thesis/consequence/test/comparison/correction/informed question.
- Thread Post 1 must stand alone; threads must not withhold the useful conclusion to force continuation.
- A legitimate discussion question must improve research if answered; metric-only engagement bait fails the gate.
- The generation model/agent cannot self-authorize publication.
- Human approval remains Phase-1 `pipeline.js` responsibility.
- Writer packets should include Reach/Follow/Conversation/Relationship potential plus relationship/target context when available from Phase 1B/1C.
- Main-feed originals should consider **ProfileProofCoverage**: if the account repeatedly enters conversations about a topic but has weak owned content proving competence in that topic, high-quality original experiments/threads in that topic receive editorial priority.
- Do not add an LLM SDK/provider dependency.
- Do not add actual media upload in this phase.
- Do not add or run tests unless separately requested.

## Storage Changes

Extend `drafts` only with fields Phase 2 needs:

```sql
ALTER TABLE drafts ADD COLUMN thread_parts_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE drafts ADD COLUMN editor_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE drafts ADD COLUMN gate_json TEXT NOT NULL DEFAULT '{}';
```

`editor_json` stores the structured writer/editor result, not hidden chain-of-thought. Expected shape:

```js
{
  decision: 'POST' | 'DO_NOT_POST',
  pipeline: 'original' | 'quote' | 'thread' | 'reply',
  thesis: 'one sentence',
  finalText: 'single-post or quote/reply text',
  threadParts: ['part 1', 'part 2'],
  semanticAnchors: ['Claude Code', 'MCP'],
  evidenceUsed: ['primary-source fact or verified result'],
  discussionQuestion: '',
  media: {
    required: false,
    type: 'none' | 'screenshot' | 'chart' | 'code' | 'diagram',
    reason: '',
    source: '',
    altText: '',
  },
  riskFlags: [],
  followReason: 'why a target developer would want future posts',
  notes: '',
}
```

`gate_json` stores only deterministic/editorial gate outputs, for example:

```js
{
  passed: true,
  failures: [],
  warnings: [],
  checks: {
    niche: true,
    additiveValue: true,
    originality: true,
    scannability: true,
    noPlaceholders: true,
    length: true,
    ctaIntegrity: true,
    recentDuplicate: true,
    hashtagCount: true,
    emojiCount: true,
    mediaReady: true,
  },
}
```

Do not store model chain-of-thought or private reasoning.

## Format-Aware Draft Contract

`drafting.js` should expose:

```js
createDraftScaffold(candidate, { pipeline = 'original' } = {})
composeDraft(draft, { pipeline = 'original' } = {})
weightedPostLength(text)
buildWriterPacket({ candidate, queueItem, draft, recentPosts = [], evidence = [], profileProof = {} })
applyWriterOutput(draft, writerOutput)
scoreDraft(draft, candidate, { pipeline, recentPosts = [] } = {})
evaluateDraftGates(draft, candidate, {
  pipeline,
  recentPosts = [],
  mediaReady = false,
} = {})
```

### Original

Preferred structure:

```text
hook / concrete finding

insight + evidence

developer consequence/action
```

The post must stand without source context.

### Quote

Input packet must include source text/author/URL and quote target tweet ID when available.

Final text must:

- assume source is visible;
- avoid restating the headline;
- state a consequence, test, disagreement, comparison, limitation, or informed practitioner question;
- be <= 280 weighted characters independently of the quoted source.

### Reply

Input packet must include target author, source post, relationship context when available, and conversation context when available.

Final text must:

- address the actual conversation;
- contribute one concrete useful point or informed question;
- not contain generic praise as the substantive content;
- be <= 280 weighted characters.

### Thread

Store `threadParts` explicitly.

Rules:

- 2-6 posts by default; more requires explicit human choice.
- every part <= 280 weighted characters;
- Post 1 contains the complete high-level finding;
- each later part adds a distinct evidence/implementation block;
- no `1/` teaser whose only purpose is withholding the conclusion;
- final part ends with a developer takeaway/action, not a forced follow CTA.

## Writer Packet Contract

`buildWriterPacket()` returns only inspectable context needed by the agent/editor:

```js
{
  account: {
    identity: 'AI-native developer + builder',
    promise: 'turn fast-moving AI/software signals into developer decisions',
    language: 'English',
  },
  pipeline,
  candidate: {
    source,
    author,
    text,
    url,
    niche,
    metrics,
    viral,
  },
  queue: {
    reachPotential,
    followPotential,
    conversationPotential,
    relationshipPotential,
    routingReason,
  },
  relationship,
  evidence,
  recentPosts,
  recentReplies: [],
  recentReplyArchetypes: [],
  health: {
    state: 'healthy' | 'watch' | 'constrained',
    warnings: [],
  },
  profileProof: {
    topic,
    coverage: 'none' | 'weak' | 'medium' | 'strong',
    supportingPostIds: [],
    reason,
  },
  currentDraft,
  constraints: {
    singlePostWeightedLimit: 280,
    hashtagsPreferredMax: 1,
    hashtagsHardMax: 2,
    emojiMax: 1,
    semanticAnchorsTarget: [1, 3],
  },
  promptDocument: 'docs/POST_GENERATION_PROMPT.md',
}
```

The bridge returns the packet plus the prompt-document path; it does not call an external model itself.

`ProfileProofCoverage` is an editorial context signal, not a hard gate. It is derived from recent owned posts matching the queue item's core topic/semantic anchors. A weak/none value should encourage an original durable asset when the topic is strategically important, but it must not force low-quality posting.

## Deterministic Gate Contract

A draft cannot be human-approved unless `evaluateDraftGates(...).passed === true` and the numeric quality score is >= 40/50. Phase 1's `approveQueueItem()` becomes the enforcement boundary by calling these gates.

### Niche

- candidate niche score >= 12; or
- human override explicitly marks an adjacent technical topic with a reason.

### Additive value

Fail when:

- Quote text is primarily a paraphrase/summary of the source.
- Reply text is generic praise with no technical contribution/question.
- Original has no thesis beyond the source headline.
- Thread merely expands a list without additional evidence/analysis.

Use pipeline-specific checks plus source similarity; deterministic checks may emit `warning` when semantic judgment still requires human review.

### Originality / recent duplicate

- preserve current source-similarity gate.
- compare main-feed final text against the most recent 20 published/approved main-feed bodies using the existing token-set/Jaccard style similarity helper.
- for replies, also compare against recent published replies globally and for the same target/topic when Phase 1D context exists.
- fail only on exact/near-duplicate text or similarity >= 0.70.
- warn at 0.50-0.69.
- repeated reply archetype or sentence structure is a warning, not a hard failure, unless the text itself is near-duplicate.
- an active conversation may legitimately use the same archetype repeatedly when each reply addresses new information.
- thread compares Post 1 to recent main-feed bodies and each part against adjacent parts to catch repeated filler.

### Scannability

Single post/quote/reply:

- no paragraph longer than 3 sentences;
- no more than 4 newline-separated blocks;
- first block <= 160 characters unless code/URL structure makes that impossible;
- reject all-caps first lines longer than 5 characters except canonical product acronyms.

Thread:

- each part uses <= 4 blocks;
- no part exceeds weighted limit;
- Post 1 must be non-placeholder and >= 40 characters.

### Placeholder / length

- no `[placeholder]` syntax anywhere.
- single post/quote/reply <= 280 weighted characters.
- every thread part <= 280 weighted characters.

### CTA integrity

Fail on case-insensitive patterns such as:

```text
like if you agree
rt if
repost if
comment yes
comment "yes"
follow for part
follow me for
share this everywhere
tag 3 friends
drop your handle
```

Warnings, not automatic failures, for a final `follow for more`-style CTA; human review should normally remove it unless it is contextually justified after substantial value.

### Hashtags

Count hashtag tokens that are not inside URLs/code-like tokens.

- 0-1: pass/preferred.
- 2: pass with warning unless both are clearly relevant/canonical.
- >2: fail by default as an editorial anti-clutter rule, not an X ranking threshold.

Keep the exact hashtag optimum tagged `EMPIRICAL_VARIABLE`; a human may revise the text rather than treating `2` as inherently harmful.

### Emoji

Use Unicode extended-pictographic matching available in modern Node regex.

- 0-1: pass.
- >1: fail unless human explicitly edits/reviews before approval; no hidden override flag in AI commands.

### Media readiness

Media is not mandatory by default.

- if `editor_json.media.required === false`: pass.
- if required: Phase 2 requires a complete plan (`type`, `reason`, `source` or local evidence reference, `altText`) but actual upload readiness is deferred to Phase 3; Phase-1 human approval should show `media pending` and refuse approval until the later media attachment path marks it ready.

This means a draft that truly requires proof-media can be written/reviewed in Phase 2 but cannot be published through the compatibility path until media support exists. The human may revise the post so media is no longer required.

---

### Task 1: Extend draft persistence for threads/editor/gates

**Files:**
- Modify: `store.js`

**Interfaces:**
- Consumes: existing `drafts` rows.
- Produces: decoded/saved `threadParts`, `editor`, and `gates` fields.

**Steps:**
- [ ] Add idempotent schema migration for `thread_parts_json`, `editor_json`, and `gate_json`; because SQLite does not support `ADD COLUMN IF NOT EXISTS` everywhere, inspect `PRAGMA table_info(drafts)` and run each `ALTER TABLE` only when missing.
- [ ] Extend `decodeDraft` to parse the JSON fields safely.
- [ ] Extend `saveDraft` update/insert statements to persist the three fields.
- [ ] Preserve existing drafts by defaulting missing values to `[]`, `{}`, `{}`.

**Acceptance criteria:**
- Existing drafts remain readable unchanged.
- A thread/editor/gate payload survives save/reload without changing current candidate/draft identity.

### Task 2: Make scaffolding/composition format-aware

**Files:**
- Modify: `drafting.js`

**Interfaces:**
- Consumes: candidate plus routed pipeline.
- Produces: format-aware scaffold/body/thread parts.

**Steps:**
- [ ] Change `createDraftScaffold` to accept `{ pipeline }` while preserving `original` as default for legacy callers.
- [ ] Original scaffold keeps Hook/Insight/Evidence/Action.
- [ ] Quote scaffold makes the hook/commentary placeholder explicitly additive rather than source-summary oriented.
- [ ] Reply scaffold asks for one concrete contribution/question and omits standalone-post structure that does not fit replies.
- [ ] Thread scaffold initializes 2 empty/thread-placeholder parts while retaining Hook/Insight/Evidence/Action as the high-level research/editor fields.
- [ ] Change `composeDraft` so single routes return one body and thread routes use `threadParts` as publish text.
- [ ] Keep `weightedPostLength` as the single weighted-length owner.

**Acceptance criteria:**
- Creating a draft for each route produces a scaffold that reflects the actual format rather than reusing one generic single-tweet template.

### Task 3: Build the canonical writer packet and apply structured output

**Files:**
- Modify: `drafting.js`
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: candidate, Phase-1 queue item, current draft, available evidence/recent posts.
- Produces: `writer-packet` and `apply-writer-output` agent commands.

**Steps:**
- [ ] Implement `buildWriterPacket()` exactly from the contract above; do not include secrets/cookies/database internals.
- [ ] Add `writer-packet` command accepting `{ key }`; return candidate, workflow/queue metadata, draft, recent published/approved post bodies, and prompt-document path.
- [ ] When Phase 1D is available, include recent published replies, recent reply archetypes, and account-health warnings so the writer can avoid formulaic repetition without treating every repeated archetype as forbidden.
- [ ] Implement `applyWriterOutput(draft, output)` with explicit field allow-listing and valid `decision/pipeline/media.type` enums.
- [ ] Add `apply-writer-output` command accepting `{ id, output }`; save editor metadata and thread/single text but do not request approval automatically.
- [ ] If output decision is `DO_NOT_POST`, keep the draft but return a recommendation to route to Research/Watch/Ignore; do not silently discard evidence/history.
- [ ] Reject pipeline mismatch between queue route and writer output unless the human/agent routes the queue item first through the Phase-1 workflow command.

**Acceptance criteria:**
- Another agent can obtain the exact writing packet, apply `POST_GENERATION_PROMPT.md`, return structured output, and persist it without direct SQLite edits or publication authorization.

### Task 4: Implement the deterministic hard-gate engine

**Files:**
- Modify: `drafting.js`

**Interfaces:**
- Consumes: finalized draft/editor metadata, candidate, pipeline, recent posts, and media readiness.
- Produces: `evaluateDraftGates()` result and updated `scoreDraft()` context.

**Steps:**
- [ ] Reuse/extract current token-set similarity helper rather than adding a new similarity dependency.
- [ ] Implement pipeline-specific additive-value checks.
- [ ] Implement recent-duplicate similarity against up to 20 recent approved/published main-feed bodies passed by caller.
- [ ] For replies, reuse the same local similarity helper against recent replies and hard-fail only exact/near-duplicate text; repeated archetype/construction remains a warning.
- [ ] Implement scannability, placeholder, weighted-length, CTA-integrity, hashtag, and emoji checks from the contract above.
- [ ] Return `failures` with stable machine-readable codes plus readable messages, e.g. `{ code: 'TOO_LONG', message: 'Single post is 312/280 weighted characters.' }`.
- [ ] Keep the current 50-point rubric as a separate score; `publishable = score >= 40 && gates.passed`.

**Acceptance criteria:**
- A high numeric score cannot override length, duplicate, bait, or other hard-gate failures.
- Gate output tells a human/agent exactly what must change without rewriting the draft automatically.

### Task 5: Wire hard gates into Phase-1 review/approval

**Files:**
- Modify: `pipeline.js`
- Modify: `store.js` only to query recent approved/published text if no existing query provides it.

**Interfaces:**
- Consumes: `evaluateDraftGates()` and current queue/draft state.
- Produces: gate-aware `requestQueueReview()` and `approveQueueItem()`.

**Steps:**
- [ ] Add one store query that returns up to 20 recent approved/published main-feed draft bodies/thread openers needed for duplicate comparison.
- [ ] `requestQueueReview` computes/saves `gate_json`; it may move to `needs_review` even with gate failures so the human can see what is wrong.
- [ ] `approveQueueItem` recomputes gates from current text/metadata and refuses approval unless gates pass and score >= 40.
- [ ] Preserve the Phase-1 compatibility bridge that only approved items set draft `ready`.

**Acceptance criteria:**
- Approval is always based on the latest saved content, not stale earlier gate results.

### Task 6: Add format-aware editing/review UI

**Files:**
- Modify: `dashboard.js`

**Interfaces:**
- Consumes: routed pipeline, draft/editor/gate data.
- Produces: human editing and final-review experience for Original/Quote/Thread/Reply.

**Steps:**
- [ ] Show selected pipeline prominently on each draft card.
- [ ] For Original/Quote/Reply, show final body preview plus Hook/Insight/Evidence/Action editor fields as research/editor inputs.
- [ ] For Thread, render editable textareas for each thread part; allow 2-6 parts with Add part/Remove last part controls handled by ordinary POST actions.
- [ ] Show weighted character count for each publishable unit.
- [ ] Show semantic anchors, evidence used, follow reason, risk flags, discussion question, and media recommendation from `editor_json`.
- [ ] Show hard-gate pass/fail rows with exact failure messages.
- [ ] Keep `Approve for publishing` disabled/absent when gates fail or score < 40.

**Acceptance criteria:**
- Human can understand exactly what will be posted, why it is supposed to be valuable, and which gate blocks publication.

### Task 7: Add media-plan persistence and review state

**Files:**
- Modify: `pipeline.js`
- Modify: `dashboard.js`
- Modify: `agent_bridge.js`

**Interfaces:**
- Consumes: `editor_json.media`.
- Produces: visible media plan and `mediaReady` review state without uploading media.

**Steps:**
- [ ] Treat `editor_json.media` as the Phase-2 media-plan owner; do not duplicate the same plan into a new queue column yet.
- [ ] Add bridge/UI actions to update media plan fields (`required`, `type`, `reason`, `source`, `altText`).
- [ ] Display `Media: none`, `Media recommended`, or `Media required` on Queue/Draft review cards.
- [ ] If media is marked required, keep approval blocked until a later Phase-3 attachment/upload flow can set actual readiness; do not fake readiness with a checkbox.
- [ ] Allow human to revise `required=false` only by editing the media plan/reason explicitly.

**Acceptance criteria:**
- The system can distinguish decorative media suggestions from evidence-essential media and will not publish a draft whose own editorial plan says required proof-media is missing.

### Task 8: Synchronize docs after Phase 2 implementation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/AGENT_WORKFLOW.md`
- Modify: `docs/CONTENT_OPERATING_STANDARD.md`
- Modify: `docs/HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md`

**Interfaces:**
- Consumes: implemented writer/gate command names and exact review semantics.
- Produces: current-state documentation.

**Steps:**
- [ ] Document `writer-packet` and `apply-writer-output` commands.
- [ ] Document deterministic hard-gate codes and approval responsibility.
- [ ] Mark format-aware Original/Quote/Thread/Reply drafting as implemented.
- [ ] Keep actual media upload, scheduler, experiments, follower conversion, and learned timing marked planned.

**Acceptance criteria:**
- Agent instructions and dashboard docs describe the same route-specific writing/gate behavior as the implementation.

## Phase-2 Completion Criteria

Phase 2 is complete when:

1. Original, Quote, Reply, and Thread have distinct draft contracts.
2. An external AI agent can retrieve a structured writer packet and persist structured writer output without direct DB access.
3. The system stores final single text or explicit thread parts plus inspectable editor metadata.
4. The 50-point score is still visible but cannot override hard-gate failures.
5. Exact/near-duplicate, bait, hashtag, emoji, scannability, placeholder, and weighted-length checks are deterministic and visible; reply-archetype repetition remains advisory unless it is also near-duplicate.
6. Human approval always recomputes current gates.
7. Required media blocks approval until the later upload/attachment path exists or the human legitimately revises the media plan.
8. No LLM provider, media uploader, scheduler, experiment engine, or autonomous reply sender is added in this phase.
