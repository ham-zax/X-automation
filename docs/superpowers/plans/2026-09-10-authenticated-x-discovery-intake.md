# Authenticated X Discovery Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated X For You observations and high-signal creator timelines first-class, provenance-preserving Growth OS discovery inputs without adding X mutation authority or duplicate creator reads.

**Architecture:** Extend the existing snapshot store with `x_for_you` and `x_creator_latest`, but keep only the original four sources pull-refreshable. Put browser-observation normalization, signal-watch configuration, and the shared creator-refresh read in a focused `x_discovery.js` boundary; Growth Operator and Discover consume the resulting canonical snapshots exactly like existing sources. The browser remains a read-only sensor, and candidate identity/deduplication remains owned by the existing store.

**Tech Stack:** Node.js ESM, `node:test`, better-sqlite3 through `store.js`, existing React/Vite UI, existing Growth OS agent bridge.

**Spec:** `docs/superpowers/specs/2026-09-09-authenticated-x-discovery-intake-design.md`

## Global Constraints

- Growth OS remains the sole state owner; no direct SQLite edits.
- `x_for_you` is browser-ingested only; `x_creator_latest` is creator-refresh-managed only.
- `refreshAllSourceSnapshots()` must perform network refreshes only for `x_latest`, `x_momentum`, `github_trending`, and `hn_top`.
- Creator timelines are fetched once per engagement/creator refresh and reused for Engage plus Discover.
- FY ingestion performs no X mutation and preserves last-known-good state on invalid/zero-valid batches.
- Signal-watch membership and multi-source presence do not create ranking bonuses or fabricated relationship value.
- `to-review` is the canonical aggregate Discover feed; legacy `for-you` is accepted only as a server-side alias.
- Existing publication claims, approval/delegation, duplicate prevention, transport, verification, and reconciliation paths are unchanged.
- The unrelated untracked `docs/superpowers/plans/2026-09-08-writer-voice-fidelity.md` is not part of this change.

---

### Task 1: Snapshot taxonomy and active provenance

**Files:**
- Modify: `store.js`
- Modify: `source_refresh.js`
- Create: `tests/x_discovery.test.mjs`

**Interfaces:**
- Produces: `SOURCE_SNAPSHOT_KINDS` containing the six canonical storage kinds.
- Produces: `PULL_SOURCE_SNAPSHOT_KINDS` containing only the four network-pull kinds.
- Produces: `getCandidateSourceKinds(candidateKey)` returning source kinds for which the candidate belongs to the current stored snapshot generation and has a current-generation source observation.

- [ ] **Step 1: Write failing store/source tests**

Create an isolated temporary working directory before dynamically importing repository modules. Assert that `saveDiscoverSnapshot('x_for_you', ...)` and `saveDiscoverSnapshot('x_creator_latest', ...)` no longer throw; assert the original four kinds remain accepted; assert `PULL_SOURCE_SNAPSHOT_KINDS` is exactly the original four kinds. Seed one candidate into two current snapshots with source observations, replace one snapshot without that candidate, and assert `getCandidateSourceKinds()` drops the stale provenance.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/x_discovery.test.mjs
```

Expected: FAIL because the two new kinds, pull-only list, and active provenance helper do not exist yet.

- [ ] **Step 3: Implement minimal storage/source changes**

In `store.js`, extend:

```js
export const SOURCE_SNAPSHOT_KINDS = Object.freeze([
  'x_latest',
  'x_momentum',
  'github_trending',
  'hn_top',
  'x_for_you',
  'x_creator_latest',
]);
```

Add `getCandidateSourceKinds(candidateKey)` by checking each canonical current snapshot key set and requiring a `source_observations` row at that snapshot generation timestamp; return canonical kinds in `SOURCE_SNAPSHOT_KINDS` order.

In `source_refresh.js`, export:

```js
export const PULL_SOURCE_SNAPSHOT_KINDS = Object.freeze([
  'x_latest',
  'x_momentum',
  'github_trending',
  'hn_top',
]);
```

and make `refreshAllSourceSnapshots()` iterate that list instead of all storage kinds.

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
node --test tests/x_discovery.test.mjs
```

Expected: PASS for Task 1 assertions.

---

### Task 2: Canonical authenticated X For You ingestion and signal watchlist

**Files:**
- Create: `x_discovery.js`
- Modify: `agent_bridge.js`
- Extend: `tests/x_discovery.test.mjs`

**Interfaces:**
- Produces: `deriveXTimestampFromTweetId(tweetId)`.
- Produces: `normalizeXUsername(value)`.
- Produces: `ingestXForYouObservation(payload)` returning `{ kind, observedAt, acceptedCount, rejectedCount, skippedCount, snapshotReplaced, preservedLastGood, diagnostics, candidates }`.
- Produces: `getXSignalWatchlist()` and `updateXSignalWatchlist({ targets })` backed by `app_state` key `x_signal_watchlist_v1`.
- Agent commands: `x-for-you-ingest`, `x-signal-watchlist`, and `x-signal-watchlist-update`.

- [ ] **Step 1: Add failing FY/watchlist tests**

Add tests that submit canonical and `twitter.com` status URLs, usernames with `@`, promoted entries, malformed/mismatched IDs, duplicate tweet IDs, missing optional metrics, malformed string metrics, and a zero-valid batch. Assert canonical URLs are `https://x.com/<normalized-user>/status/<tweetId>`, duplicate IDs keep the best rank and most complete metric set, tweet timestamps can be derived from the snowflake ID, optional metrics are absent rather than invented, successful batches replace the snapshot and record FY rank/metrics, and invalid/zero-valid batches preserve the last-good snapshot while setting source error state.

Add watchlist tests asserting normalization, disabled-target retention, duplicate rejection, atomic validation, revision increments, and note-only metadata.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node --test tests/x_discovery.test.mjs
```

Expected: FAIL because `x_discovery.js` and the new commands do not exist.

- [ ] **Step 3: Implement FY normalization/ingestion and watchlist state**

Use the X snowflake epoch `1288834974657n` and derive creation time with:

```js
Number((BigInt(tweetId) >> 22n) + 1288834974657n)
```

Require numeric-string tweet IDs, X/Twitter `/status/<id>` URLs with matching IDs, normalized valid usernames, non-empty text, positive integer ranks, and optional non-negative finite numeric metrics. Skip `promoted: true`. Collapse duplicates by tweet ID, choose the lowest rank, and use the duplicate entry with the greatest count of valid observed metric fields for metrics. Prefer snowflake-derived timestamp when a supplied timestamp differs by more than five minutes and report that mismatch in diagnostics.

Upsert normalized X candidates, save `x_for_you` at the batch `observedAt`, and record one observation per accepted candidate with feed rank and only observed metrics. If no valid organic posts remain or top-level validation fails, call `recordDiscoverSnapshotError('x_for_you', ...)`, leave the prior snapshot untouched, and return explicit diagnostics.

Persist watchlist JSON only after validating the complete proposed target array. Normalize usernames, reject normalized duplicates, retain disabled entries, ignore `note` for ranking, and increment revision atomically at the application-state write boundary.

Expose thin agent-bridge commands that call these canonical functions; do not duplicate normalization inside the CLI branch.

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
node --test tests/x_discovery.test.mjs
```

Expected: PASS for FY ingestion and watchlist behavior.

---

### Task 3: One creator fetch serving Engage and `x_creator_latest`

**Files:**
- Modify: `x_discovery.js`
- Modify: `engagement.js`
- Extend: `tests/x_discovery.test.mjs`

**Interfaces:**
- Produces: `mergeCreatorTargets(relationshipProfiles, signalWatchTargets)` returning normalized `{ username, origins }` entries.
- Produces: `refreshCreatorLatestDiscovery({ relationshipProfiles, postsPerTarget, since, fetchRecentPosts, classifyNiche, observedAt })`, which performs at most one `fetchRecentPosts()` call and returns fetched posts/candidates plus target-origin/failure diagnostics.
- `refreshEngagementOpportunities()` consumes that result and creates `target_timeline` opportunities only where an actual relationship profile exists.

- [ ] **Step 1: Add failing creator-refresh tests**

Use a counting fake `fetchRecentPosts()` to assert relationship targets and enabled signal-watch targets are normalized and deduplicated, an overlap is fetched once, a watch-only creator is included in `x_creator_latest` without a relationship profile, successful zero-post fetch clears the creator snapshot, total attempted-target failure preserves last-good state and records an error, and partial success stores only returned current candidates with diagnostics. Assert one call per refresh.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node --test tests/x_discovery.test.mjs
```

Expected: FAIL because shared creator refresh does not exist.

- [ ] **Step 3: Implement the shared creator read**

Build the merged target list from relationship profiles plus enabled watchlist entries. If no targets exist, save an empty fresh `x_creator_latest` snapshot without a network call. Otherwise call the injected/default target-timeline fetch exactly once for the merged usernames, normalize/upsert all returned original posts, save `x_creator_latest`, and record current-generation X metrics as source observations.

Treat `posts.length === 0` plus errors for every actually attempted target as total failure: preserve last-good and record an error. Treat no-post success as a valid empty snapshot. Treat mixed success/errors as partial success: replace with only successful returned posts and surface errors without refetching.

Replace the direct cold-profile fetch block in `refreshEngagementOpportunities()` with this shared result. Reuse its normalized candidate for relationship-backed posts and preserve the existing `target_timeline`, source class, engagement kind, score, and expiration behavior. Watch-only posts must not call the Engage persistence branch.

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
node --test tests/x_discovery.test.mjs
```

Expected: PASS for creator fetch count, snapshot semantics, and relationship/watch separation.

---

### Task 4: Growth Operator merge and Discover API identity

**Files:**
- Modify: `agent_bridge.js`
- Modify: `web_api.js`
- Create: `tests/discover_api.test.mjs`
- Extend: `tests/x_discovery.test.mjs`

**Interfaces:**
- `growthRead()` consumes all six stored source snapshots and merges by candidate key.
- Discover canonical feed IDs: `to-review`, `x-for-you`, `creators`, plus existing IDs.
- Legacy request alias: `for-you` resolves server-side to canonical response `feed: 'to-review'`.
- Candidate API payload adds `sourceKinds: string[]` from active current-generation provenance.

- [ ] **Step 1: Add failing Growth Operator/API tests**

Seed one X candidate into `x_latest` and `x_for_you`, call exported `growthRead()`, and assert one item with both source kinds. Record its priority, add only the extra source provenance, and assert source multiplicity does not itself change priority.

Exercise `handleApi()` with a minimal request/response harness. Assert `/discover` defaults to `to-review`, `/discover?feed=for-you` responds with `feed: 'to-review'`, `/discover?feed=x-for-you` reads `x_for_you`, `/discover?feed=creators` reads `x_creator_latest`, and candidate payloads expose active `sourceKinds` without duplicating cards.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test tests/x_discovery.test.mjs tests/discover_api.test.mjs
```

Expected: FAIL because Growth Operator and Discover do not consume/emit the new identities yet.

- [ ] **Step 3: Implement merge/API changes**

Make `growthRead` exported for direct behavioral testing and build snapshots from all `SOURCE_SNAPSHOT_KINDS`. Keep the existing candidate-key merge and momentum-preference behavior, with no source-count/FY/watchlist bonus.

In `web_api.js`, canonicalize incoming `for-you` to `to-review` before the switch. Add `x-for-you -> x_for_you` and `creators -> x_creator_latest`, keep existing feed IDs, and never expose browser/creator sources as pull-refreshable. Add `sourceKinds` to formatted candidates using `getCandidateSourceKinds()`.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
node --test tests/x_discovery.test.mjs tests/discover_api.test.mjs
```

Expected: PASS.

---

### Task 5: Discover UI naming and source badges

**Files:**
- Modify: `ui/src/api/client.ts`
- Modify: `ui/src/features/discover/discoverView.ts`
- Modify: `ui/src/features/discover/Discover.tsx`
- Modify: `ui/tests/discover-view.test.mjs`

**Interfaces:**
- `DiscoveredCandidate.sourceKinds: string[]`.
- `discoverSourceLabels(sourceKinds)` returns compact stable labels used by candidate rows/details.
- UI emits `to-review`, `x-for-you`, and `creators`; it never emits the old `for-you` aggregate ID.

- [ ] **Step 1: Add failing UI tests**

Extend `ui/tests/discover-view.test.mjs` to assert the source-label helper maps `x_for_you`, `x_momentum`, `x_creator_latest`, and `x_latest` to `For You`, `Momentum`, `Creator watch`, and `X latest`, deduplicates labels, and preserves canonical order.

- [ ] **Step 2: Run the UI test and verify RED**

```bash
cd ui && node --test tests/discover-view.test.mjs
```

Expected: FAIL because the source-label helper does not exist.

- [ ] **Step 3: Implement canonical tabs and badges**

Add `sourceKinds` to the client type. Replace the aggregate tab ID/default with `to-review`, add `x-for-you` (`X For You`) and `creators` (`Creator watch`), update descriptions/topic-filter conditions, and render compact source badges from `sourceKinds` in the candidate row/detail without changing triage actions.

- [ ] **Step 4: Run UI tests and verify GREEN**

```bash
cd ui && node --test tests/discover-view.test.mjs
```

Expected: PASS.

---

### Task 6: Regression/build verification and commit

**Files:**
- Review all files changed by Tasks 1–5 plus this plan.

- [ ] **Step 1: Run focused backend tests**

```bash
node --test tests/x_discovery.test.mjs tests/discover_api.test.mjs
```

Expected: PASS with no warnings/errors.

- [ ] **Step 2: Run the full established UI test suite**

```bash
cd ui && npm run test:ui
```

Expected: PASS.

- [ ] **Step 3: Build the UI**

```bash
npm run ui:build
```

Expected: successful Vite/Tailwind build.

- [ ] **Step 4: Run syntax/static smoke checks for touched backend modules**

```bash
node --check x_discovery.js
node --check source_refresh.js
node --check engagement.js
node --check agent_bridge.js
node --check web_api.js
```

Expected: all exit 0.

- [ ] **Step 5: Review scope and whitespace**

```bash
git diff --check
git status --short
git diff --stat
git diff -- store.js source_refresh.js x_discovery.js engagement.js agent_bridge.js web_api.js tests/x_discovery.test.mjs tests/discover_api.test.mjs ui/src/api/client.ts ui/src/features/discover/discoverView.ts ui/src/features/discover/Discover.tsx ui/tests/discover-view.test.mjs docs/superpowers/plans/2026-09-10-authenticated-x-discovery-intake.md
```

Expected: no whitespace errors; no unrelated tracked changes; the pre-existing writer-voice plan remains untracked and untouched.

- [ ] **Step 6: Optional authenticated read-only smoke**

If the Windows browser sensor is healthy, observe a small bounded For You sample and submit it through `npm run agent -- x-for-you-ingest`; verify `growth-next`/Discover shows `x_for_you` provenance. Do not publish, reply, like, repost, or quote. If the browser is unavailable, record the skipped smoke as an environmental limitation rather than weakening tests.

- [ ] **Step 7: Commit the verified implementation**

Stage only the implementation/test/plan files listed above and commit with:

```bash
git commit -m "feat: add authenticated x discovery intake"
```
