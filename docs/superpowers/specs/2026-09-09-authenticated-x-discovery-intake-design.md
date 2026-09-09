# Authenticated X Discovery Intake Design

**Date:** 2026-09-09
**Status:** Proposed — conversational design approved; repository spec review pending
**Scope:** Growth OS discovery intake, creator monitoring, source provenance, and Discover feed identity
**Repository:** `/home/hamza/repo/x_test`

## Objective

Make two high-value X signal lanes first-class Growth OS discovery inputs without creating a second state owner or weakening publication safety:

1. the real authenticated, personalized X **For You** timeline observed in the existing Windows browser; and
2. the newest original posts from valuable creators, combining the existing relationship-selected target set with an explicit signal-watch list.

The result should let one canonical Growth OS candidate be discovered through multiple independent paths (`x_for_you`, `x_momentum`, `x_latest`, `x_creator_latest`, and existing non-X sources), preserve that provenance, and allow the existing Growth OS arbitration layer to decide whether the opportunity belongs in a Reply, Quote, Original, Watch, Research, or Ignore path.

This change is about **candidate recall and source provenance**. It does not grant browser mutation authority, change protected publication gates, or treat an X recommendation as evidence that a post is viral.

## Current State

Growth OS currently persists four first-class discovery snapshot kinds:

- `x_latest`
- `x_momentum`
- `github_trending`
- `hn_top`

`source_refresh.js` owns pull refreshes for those sources. `store.js` validates snapshot kinds, persists snapshot candidate keys, records source observations, and can calculate source-specific metric deltas.

`agent_bridge.js::growthRead()` merges the four snapshots by canonical candidate key, retains `sourceKinds`, and ranks the merged opportunities through the current operator heuristic.

Creator-latest data already exists in a separate lane. `engagement.js::fetchTargetTimeline()` selects high-value relationship profiles, calls `fetchXTargetRecentPosts()` once for the selected usernames, upserts the returned original posts as candidates, and creates `target_timeline` engagement opportunities. That data is useful but is not currently persisted as a first-class discovery snapshot, so it is not naturally available to broader Growth OS main-feed arbitration.

The Discover API also uses the internal feed ID `for-you` for the aggregate unresolved-candidate view labeled **To review**. That identifier predates this work and is not X's personalized For You feed.

## Design Principles

### One state owner

Growth OS remains the canonical owner of candidate identity, source observations, disposition, scoring, queue state, authorization, duplicate prevention, and publication reconciliation.

The authenticated browser is a **sensor**, not a competing database or autonomous publishing subsystem.

### Observation is not endorsement

Presence in X For You means only that X presented the post to the authenticated account at an observed feed position. It does not by itself imply virality, truth, topical fit, or actionability.

No large source-specific scoring bonus is added merely because `x_for_you` is present. Existing quality, freshness, reach, conversation, follow, relationship, topic-balance, disposition, and protected route logic continue to govern action selection.

### Fetch once, reuse everywhere

Creator timelines must not be fetched independently by Discover and Engage. The existing creator-timeline fetch becomes the shared read. Its normalized results feed both:

- `target_timeline` engagement opportunities; and
- the new `x_creator_latest` discovery snapshot.

### Independent source degradation

A failed authenticated browser scan must not break keyword search, momentum, creator timelines, GitHub, or Hacker News. Likewise, a failed creator fetch must not invalidate a valid For You observation.

Each source reports freshness/error state independently and preserves or replaces its snapshot according to the source-specific semantics defined below.

### Protected writes stay protected

Nothing in this design changes browser reply claims, main-feed claims, approval/delegation gates, provenance checks, duplicate prevention, exact-text verification, public-result verification, or reconciliation.

No direct SQLite mutation is introduced.

## Source Taxonomy

The implementation should distinguish source **storage kinds** from source **refresh mechanisms**.

### Pull-refreshable sources

Owned by the existing `source_refresh.js` pull loop:

- `x_latest`
- `x_momentum`
- `github_trending`
- `hn_top`

### Browser-ingested source

- `x_for_you`

This is populated by a bounded authenticated Windows-browser observation and a canonical Growth OS ingestion command. `refreshAllSourceSnapshots()` must not attempt to fetch it itself.

### Creator-managed source

- `x_creator_latest`

This is populated from the existing creator-timeline fetch in the engagement refresh path. `refreshAllSourceSnapshots()` must not issue a second creator fetch.

The store's allowed snapshot-kind set expands to include both new kinds, while `source_refresh.js` keeps an explicit list of only the pull-refreshable kinds.

A future `x_following` source is compatible with the same browser-ingest contract but is out of scope for this implementation.

## Canonical X For You Ingest Contract

V1 introduces one Growth OS command/API boundary for browser observations. The browser operator may observe the authenticated X For You timeline and submit a bounded batch such as:

```json
{
  "kind": "x_for_you",
  "observedAt": 1788921000000,
  "posts": [
    {
      "tweetId": "2090000000000000000",
      "url": "https://x.com/example/status/2090000000000000000",
      "username": "example",
      "text": "Post text as observed",
      "timestamp": 1788920800000,
      "rank": 1,
      "promoted": false,
      "metrics": {
        "views": 12000,
        "likes": 310,
        "reposts": 44,
        "replies": 27
      }
    }
  ]
}
```

The exact external command name may follow existing `agent_bridge.js` naming conventions, but it must implement one canonical function rather than duplicating validation across HTTP and CLI paths.

### Validation and normalization

The ingest boundary must:

- accept only `kind: "x_for_you"` in V1;
- require a positive batch `observedAt` timestamp;
- require a canonical tweet/status identifier for every accepted post;
- accept only X/Twitter status URLs whose status ID agrees with `tweetId`, then normalize stored URLs to `https://x.com/<username>/status/<tweetId>`;
- normalize usernames by removing `@`, trimming whitespace, and using the repository's existing username normalization convention;
- require non-empty post text;
- require `rank` to be a positive integer and deduplicate repeated tweet IDs within the same batch by keeping the best observed rank and most complete observed metric set;
- reject or skip entries explicitly marked `promoted: true`;
- treat all metrics as observed optional values and never fabricate missing counts;
- reject malformed metric values rather than coercing arbitrary strings into invented measurements;
- preserve canonical candidate identity by the existing candidate key/tweet identity logic;
- upsert valid candidates through the normal store boundary before source observations are recorded; and
- remain idempotent for a repeated batch with the same candidate/source/observation timestamp.

If a browser surface cannot provide a trustworthy post timestamp, the V1 browser adapter may derive the creation time from the X snowflake tweet ID only through one tested helper. It must not use UI-relative-time guesswork when the canonical ID can provide a deterministic timestamp. If a supplied timestamp and a snowflake-derived timestamp materially disagree, validation should prefer the deterministic tweet-ID timestamp and expose the mismatch in the ingest diagnostics.

### Bounded scan

The autonomous operator should normally collect the first **25–40 organic posts** from the authenticated For You feed per scan. This is a policy bound, not a requirement to manufacture a fixed count when fewer valid posts are visible.

The scan must:

- reuse the current authenticated Windows X tab when practical;
- switch to `/home` → For You in place;
- avoid opening one tab per candidate;
- keep the current tab-hygiene rule of one working tab plus at most two temporary context tabs;
- open an individual post only after Growth OS selects it for deeper inspection or action; and
- perform no X mutation as part of discovery ingestion.

## X For You Snapshot Semantics

A successful non-empty ingest replaces the `x_for_you` snapshot with the normalized valid candidate keys observed in that batch and records one `source_observations` row per candidate using:

- `snapshot_kind = "x_for_you"`
- `observed_at = batch.observedAt`
- `rank = feed position`
- `metrics_json = observed public metrics`

An invalid batch or a scan that yields zero valid organic posts is treated as a likely sensor/UI failure in V1. It must:

- preserve the last known-good `x_for_you` snapshot;
- record a refresh/ingest error with the attempted timestamp; and
- return diagnostics explaining why zero posts were accepted.

This avoids replacing useful state with an empty snapshot because the authenticated browser was logged out, blocked, on the wrong tab, partially rendered, or temporarily unreachable.

A deliberately empty For You snapshot is not needed in V1.

## Creator-Latest Discovery

### Shared target selection

The creator refresh builds one normalized username set from two inputs:

1. **relationship targets** selected by the existing score/minimum/limit logic; and
2. **signal-watch targets** from a persisted explicit watchlist.

The union is deduplicated by normalized username before calling `fetchXTargetRecentPosts()`.

The existing relationship behavior remains unchanged by default: current minimum relationship score, limit, per-user post limit, and freshness window keep their existing defaults unless caller configuration already overrides them.

### Signal watchlist

V1 stores the explicit watchlist in application state under a versioned key such as `x_signal_watchlist_v1` rather than adding a new database table.

Canonical value:

```json
{
  "revision": 1,
  "updatedAt": 1788921000000,
  "targets": [
    {
      "username": "example",
      "enabled": true,
      "note": "High-signal AI infra account"
    }
  ]
}
```

Requirements:

- normalized username is the identity;
- duplicates are rejected or collapsed deterministically;
- disabled targets are retained in configuration but excluded from fetches;
- `note` is operator metadata only and does not change ranking;
- no fake relationship score is assigned to watch-only creators;
- read/update operations are exposed through the canonical Growth OS agent bridge so an autonomous operator can inspect and maintain the list without direct DB edits; and
- update validation is atomic: an invalid target entry rejects the attempted configuration update rather than partially mutating the watchlist.

A watchlist-management UI is not required for V1.

### One creator fetch, two consumers

The creator refresh calls `fetchXTargetRecentPosts()` once for the merged username set. The returned posts are normalized/upserted once and then reused to:

1. build the existing `target_timeline` Engage opportunities for creators that qualify for the engagement lane; and
2. save all valid fetched originals from the merged target set into `x_creator_latest`.

A watch-only creator may therefore appear in Discover even when no relationship-based Engage opportunity is created. A creator that belongs to both sets is fetched once and represented by one candidate.

The refresh result should retain enough diagnostic metadata to distinguish target origin (`relationship`, `signal_watch`, or both) for operator inspection, but candidate identity itself must remain source-agnostic. V1 does not require a new per-candidate provenance table solely for the watch reason.

### Creator snapshot failure semantics

A successful creator fetch in which the selected targets simply have **zero qualifying original posts** in the configured freshness window is a valid empty result. In that case, `x_creator_latest` is saved as an empty fresh snapshot so stale creator posts do not remain discoverable indefinitely.

If every attempted creator lookup/fetch fails and there is no trustworthy successful result, preserve the last known-good snapshot and record a source error.

If the fetch is partially successful, save the successfully returned qualifying candidates, record the partial errors in refresh diagnostics, and do not reintroduce stale candidates for failed users. Partial failure must not duplicate the network read.

## Cross-Source Provenance

`source_observations` is the canonical evidence that a candidate was observed through a source kind. No second provenance table is required for the new discovery sources.

Add a store/query helper that can return the distinct recent source kinds observed for a candidate, constrained to valid snapshot kinds. The helper should prefer evidence associated with the currently stored snapshot generation (or otherwise use a bounded freshness rule) so a post does not permanently display a source badge from an ancient observation after it has fallen out of that source.

The aggregate discovery response and Growth Operator response should expose canonical `sourceKinds` for each candidate.

Examples:

- `x_for_you`
- `x_momentum`
- `x_creator_latest`
- `x_for_you + x_momentum + x_creator_latest`

The same X status must still appear as one canonical candidate when observed through multiple paths.

## Growth Operator Integration

`growthRead()` expands its snapshot set to include:

- `x_for_you`
- `x_creator_latest`

alongside the existing four sources.

The merge remains candidate-key based. When duplicate observations exist, source provenance accumulates rather than producing duplicate operator items.

### Ranking constraints

The current operator priority calculation remains the baseline. This change must not add an arbitrary large bonus for:

- appearing in For You;
- being on the signal watchlist; or
- being observed through multiple sources.

Multi-source observation is valuable evidence for the operator and can later be studied empirically, but V1 should expose it before attempting to learn or hard-code a ranking law from it.

Existing measured velocity from repeated observations may continue to influence already-supported momentum fields. For You feed rank is observational metadata only in V1.

A watch-only creator receives no relationship score unless the normal relationship model independently provides one.

## Discover API and UI Identity

### Remove the naming collision

The canonical aggregate unresolved-candidate feed ID becomes:

- `to-review` → label `To review`, no single source kind

The old `for-you` aggregate identifier remains a **backward-compatible server-side alias** to `to-review` for existing links/callers, but it must no longer be emitted as the canonical feed ID.

The actual personalized X feed gets a distinct source-backed feed, for example:

- `x-for-you` → label `X For You`, source kind `x_for_you`

Creator discovery gets:

- `creators` → label `Creator watch`, source kind `x_creator_latest`

Existing feed IDs (`x-latest`, `momentum`, `github`, `hn`) remain intact.

### Source badges

Candidate payloads should expose `sourceKinds`. The UI may render compact source badges such as:

- `For You`
- `Momentum`
- `Creator watch`
- `X latest`

A candidate discovered through several paths shows several badges without duplicating the card.

The author/username already identifies which creator produced the post, so V1 does not need to persist the watchlist note on every candidate card.

## Browser / Growth OS Boundary

The authenticated browser is responsible only for observing the personalized feed and sending structured observations into the canonical Growth OS ingest boundary.

Growth OS is responsible for:

- input validation;
- candidate normalization/upsert;
- snapshot persistence;
- source observation persistence;
- deduplication;
- quality filtering;
- ranking;
- route choice;
- claims/authorization; and
- write reconciliation.

This preserves the desired architecture:

```text
authenticated browser = sensor
Growth OS             = state + reasoning boundary
Hamza persona          = content judgment
protected write path   = actuator
```

A browser sensor failure therefore cannot create an untracked X write.

## Operator V1 Flow

At the start of an autonomous growth run, after recovering Growth OS and browser state:

1. refresh normal pull sources through the existing source refresh path;
2. refresh creator targets once through the shared creator/engagement path, which also updates `x_creator_latest`;
3. when the Windows browser is healthy, observe a bounded X For You sample and ingest it as `x_for_you`;
4. call Growth Operator discovery over the merged sources;
5. inspect deeper context only for candidates Growth OS ranks as worthwhile; and
6. continue through the existing protected action-specific claim, execute, verify, and reconcile path if an action is selected.

If the browser sensor is unavailable, steps 1, 2, and 4 still operate using the remaining sources.

## V2 Compatibility

The V1 ingestion boundary must be transport-agnostic enough that a future read-only worker can submit the same `x_for_you` observation payload every roughly 10–15 minutes without changing candidate storage or ranking code.

That worker is explicitly **not part of this implementation**. If added later it must have no X mutation authority and must continue to use Growth OS as the sole state owner.

## Error Handling and Diagnostics

Every new source refresh/ingest result should report at minimum:

- source kind;
- attempted/observed timestamp;
- accepted candidate count;
- rejected/skipped count;
- whether the snapshot was replaced or last-good state was preserved; and
- source-specific errors or validation reasons.

Diagnostics must not silently convert malformed browser observations into valid-looking candidates.

A failure in one source should be visible in operator status without converting unrelated healthy snapshots into errors.

## Testing Strategy

Implementation should be test-driven around the new boundaries.

### Store/source tests

Verify:

- `x_for_you` and `x_creator_latest` are accepted snapshot kinds;
- pull refresh still iterates only pull-refreshable kinds;
- repeated observation ingestion is idempotent;
- source observations retain FY rank and observed metrics;
- source-kind lookup for a candidate is bounded to current/recent snapshot provenance; and
- existing four source kinds remain backward compatible.

### X For You ingest tests

Verify:

- canonical X status URLs and usernames normalize correctly;
- malformed/mismatched status IDs are rejected;
- promoted entries are skipped;
- duplicate tweet IDs collapse deterministically;
- optional metrics remain optional and are never fabricated;
- snowflake timestamp derivation is deterministic when needed;
- zero-valid-post and invalid batches preserve the last known-good FY snapshot while recording an error; and
- a successful batch replaces the prior FY snapshot and records observations.

### Creator-latest tests

Verify:

- relationship targets and enabled signal-watch targets merge/dedupe by username;
- one creator fetch serves both Engage and Discover outputs;
- watch-only creators can enter `x_creator_latest` without receiving invented relationship value;
- creators present in both sets are fetched once;
- successful zero-new-post refresh clears the creator snapshot;
- total fetch failure preserves last-good state and records an error;
- partial success stores successful candidates and diagnostics without a second fetch; and
- existing target-timeline Engage behavior does not regress.

### Growth Operator tests

Verify:

- `growthRead()` merges both new source kinds;
- the same tweet observed through multiple sources remains one item;
- `sourceKinds` contains all active provenance;
- For You presence alone does not create a viral tier or large priority boost; and
- existing filtering/disposition/route behavior remains unchanged.

### API/UI tests

Verify:

- `to-review` is the canonical aggregate feed;
- legacy `for-you` requests resolve to `to-review`;
- `x-for-you` returns `x_for_you` snapshot candidates;
- `creators` returns `x_creator_latest` snapshot candidates;
- aggregate candidates expose compact multi-source provenance; and
- all existing source feeds still render/build.

### Verification commands

At minimum, implementation completion requires:

- focused Node tests covering the new store/ingest/creator/Growth Operator/API behavior using the repository's established test harness;
- the existing relevant regression suites for discovery, engagement, and agent bridge;
- `npm run ui:build`; and
- a final `git diff --check` plus clean review of the implementation diff.

If an authenticated browser is healthy during verification, perform one **read-only** FY smoke scan and confirm the resulting candidates/provenance in Growth OS. This smoke test must not publish, like, reply, repost, or quote.

## Acceptance Criteria

The change is complete when all of the following are true:

1. Real authenticated X For You observations can enter Growth OS as `x_for_you` without browser mutation authority.
2. The current creator-latest fetch populates both Engage and `x_creator_latest` without a duplicate creator-timeline network read.
3. Explicit signal-watch creators can be configured and merged with dynamic relationship targets.
4. The same X post is deduplicated across discovery sources while retaining active source provenance.
5. Growth Operator considers the two new source kinds without treating source presence as a hard-coded virality signal.
6. Discover uses `to-review` as the canonical aggregate identity and reserves `X For You` for the real authenticated feed.
7. Existing source discovery, relationship selection, protected claims, publication transport, and reconciliation behavior remain intact.
8. Browser sensor failure degrades only the FY source and cannot create or retry an X write.
9. Tests and UI build pass, and a read-only live smoke scan succeeds when the authenticated browser is available.

## Explicit Non-Goals

This implementation does **not** include:

- a daemonized sub-hour browser worker;
- an `x_following` snapshot;
- automatic likes or any new X mutation transport;
- changes to autonomous reply or main-feed authorization thresholds;
- bypasses for duplicate prevention, provenance, claims, or post-send verification;
- a new virality formula based on For You appearance;
- a watchlist-management UI;
- direct SQLite edits; or
- changes to the scheduler/publication serialization model.

## Implementation Boundary

Because this is an architectural change, implementation begins only after this repository design spec is reviewed and explicitly approved. The next step after approval is to produce a concrete implementation plan, then execute it test-first against the boundaries above.
