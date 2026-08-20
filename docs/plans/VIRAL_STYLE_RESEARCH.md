# Viral X Style Research Implementation Plan

**Implementation status (2026-08-20): Implemented initial research subsystem.** The read-only collector, matched-author controls, longitudinal snapshots, deterministic style/hook features, best-effort thread reconstruction, CSV/JSONL export, and first live AI/developer sample are implemented. The local dataset is intentionally gitignored and should accumulate over time before any style is promoted into editorial/writer guidance.

**Goal:** Build a local, read-only research pipeline that discovers high-performing X posts in the AI/developer niche, captures author/post/thread/timing context over time, exports auditable CSV/JSONL data, and compares writing styles against matched controls without pretending correlation is causation.

**Architecture:** Use the repository's existing authenticated XActions/browser read patterns for discovery and exact post/profile enrichment. Store immutable post metadata plus append-only metric/author snapshots in a gitignored local research directory, derive deterministic writing/hook/thread/timing features in code, and export a flat CSV plus cohort summaries. Treat raw views as one observation only; normalize by follower count, post age, follower-size cohort, and same-author controls before calling a style unusually successful.

**Tech Stack:** Node.js 24, existing `xactions` dependency, standard-library filesystem/CSV utilities, existing `strategy.js` niche query taxonomy.

## Global Constraints

- Read-only X research only. Never like, repost, follow/unfollow, reply, publish, or change X state.
- Reuse existing `AUTH_TOKEN` / `CT0` authenticated-read conventions; never persist cookies/tokens in the research dataset.
- The canonical local research dataset must be gitignored. Repository commits contain code/docs only, not scraped tweet text or account snapshots.
- Capture public post metrics and public author counts as observations at a timestamp. Do not claim historical follower counts that were not actually observed.
- Before/after follower movement is longitudinal account-level association, not proof that one post caused the follower change.
- Do not call a style "viral" from raw view count alone. Preserve follower count, post age, velocity, engagement/view, views/follower, and matched-control context.
- Same-author controls are required when available because author reach is a major confounder.
- Thread reconstruction is best effort. Missing thread replies must be represented as unavailable rather than invented.
- Store UTC publication/observation times. Do not infer the author's local timezone from location text.
- Style categories are deterministic descriptive labels, not hidden-rank claims and not a claim that X rewards a phrase mechanically.
- No tests are authorized by this request. Use bounded direct/non-test validation only.

## Research basis

Current X documentation exposes public post impressions/reposts/quotes/likes/replies/bookmarks and public user follower/following counts. The installed XActions client also exposes exact post metrics, conversation IDs, bookmarks, media flags, and profile follower counts. Current repository browser search works while the installed HTTP SearchTimeline path currently returns an X 404, so discovery should use the browser path and exact enrichment should use `Scraper.getTweet()` / `Scraper.getProfile()`.

A live probe on 2026-08-20 demonstrates why normalization is necessary: one ~1.9M-view AI-model launch came from an account with ~15.5K followers (roughly 123x views/follower), while a ~130K-view announcement from a multi-million-follower account was only a small fraction of its follower base. The collector must therefore preserve both absolute and normalized performance.

Prior virality research likewise finds author/follower context materially affects virality measurement and that wording can matter even after topic/author controls. The system should produce data suitable for those comparisons rather than hard-coding generic social-media folklore.

## File responsibility map

- Create: `viral_style.js` — pure deterministic feature extraction, style/hook taxonomy, metric normalization, cohort helpers, and summary calculation.
- Create: `viral_style_research.js` — read-only X collector CLI, exact post/profile enrichment, matched-author controls, best-effort thread reconstruction, append-only snapshots, and CSV/JSON exports.
- Modify: `package.json` — explicit local research commands.
- Modify: `.gitignore` — ignore `.viral-style-research/` local dataset.
- Modify: `docs/plans/README.md` — index this research subsystem as implemented/current once landed.
- Modify: this plan — mark implementation status after execution.

## Local data contract

Default root: `.viral-style-research/`

```text
posts.jsonl       immutable/first-seen post + author metadata and deterministic style features
snapshots.jsonl   append-only post metrics + author metrics observed at a timestamp
threads.jsonl     best-effort thread/root-child structure when reconstructed
style_report.csv  latest flattened post/snapshot/features for spreadsheet analysis
style_summary.json cohort/style/hook summaries and matched-control comparisons
```

### `posts.jsonl`

One first-seen record per tweet ID:

```text
id
url
username
text
createdAt
conversationId
sampleKind              viral_seed | author_control | targeted
sourceQuery
isReply
isQuote
isRetweet
mediaType               none | image | video | mixed
photoCount
videoCount
hashtags[]
mentions[]
urls[]
firstObservedAt
styleFeatures{}
```

### `snapshots.jsonl`

Append one observation per collector/snapshot run:

```text
tweetId
observedAt
postAgeMinutes
views
likes
reposts
replies
bookmarks
authorFollowers
authorFollowing
authorTweetCount
authorListedCount
authorBlueVerified
authorAccountAgeDays
viewsPerFollower
engagementsPerView
bookmarksPerView
repostsPerView
repliesPerView
viewsPerHour
engagementsPerHour
followerDeltaFromFirstObservation
```

### Deterministic style feature families

Structural:
- character/word/sentence/line/paragraph counts;
- first-line text and length;
- link/mention/hashtag counts;
- image/video presence;
- bullet/list markers;
- question/exclamation counts;
- uppercase-word ratio;
- number/percentage/currency counts.

Voice/claim signals:
- first-person test/experience;
- second-person/direct address;
- quantified claim;
- benchmark/performance language;
- cost/value comparison;
- novelty/release language;
- urgency/breaking language;
- contrarian framing;
- curiosity/information-gap framing;
- impossible/surprising-result framing;
- explicit proof/source language;
- CTA/resource promise;
- thread/list promise.

Hook labels may include multiple tags:

```text
first_person_test
quantified_claim
release_announcement
impossible_result
contrarian_take
conditional_hack
curated_list
breaking_alert
cost_value
problem_solution
social_proof
direct_imperative
question_hook
```

Style labels may include multiple tags:

```text
quantified_release
tested_experiment
utility_workaround
benchmark_proof
curated_resource_thread
compressed_reveal
authority_announcement
cost_value_comparison
educational_breakdown
contrarian_observation
```

No label is an X ranking factor claim.

## Performance comparison contract

For each latest snapshot calculate descriptive values, not a single fake virality score:

```text
viewsPerFollower
engagementsPerView
repostsPerView
bookmarksPerView
viewsPerHour
engagementsPerHour
```

Assign follower-size cohorts only for comparison:

```text
micro        < 5,000
small        5,000-24,999
mid          25,000-99,999
large        100,000-499,999
very_large   >= 500,000
```

Assign observation-age bands:

```text
<1h
1-6h
6-24h
1-3d
3-7d
7d+
```

When same-author controls exist **in the same observation-age band**, calculate:

```text
authorControlSampleSize
authorAgeMatchedControlSampleSize
authorControlMedianViewsPerFollower
authorControlMedianEngagementsPerView
viewsPerFollowerLift
engagementsPerViewLift
```

If no same-author control is available in the seed's age band, keep lift values `null` rather than comparing an immature post with a mature control.

A cohort/style summary must always expose sample size. It must not call a difference causal or recommend a style from a one-post sample.

### Task 1: Add deterministic style and performance analysis

**Files:**
- Create: `viral_style.js`

**Interfaces:**
- Consumes: normalized post text/format metadata and one post/author metric observation.
- Produces: `extractViralStyleFeatures(post)`, `deriveViralPerformance(snapshot)`, `followerSizeCohort(count)`, `postAgeBand(minutes)`, `summarizeViralStyleDataset(posts, snapshots)`.

**Steps:**
- [x] Implement structural feature extraction from exact stored text without NLP-network dependencies.
- [x] Implement transparent hook/style multi-label rules from observable phrasing/format only.
- [x] Implement normalized metric derivation with `null` for unavailable denominators/metrics rather than zero-filling unknowns.
- [x] Implement follower-size and age cohorts.
- [x] Build style/hook/cohort summaries that report sample size, medians, and same-author lift when controls exist.

**Acceptance criteria:**
- A stored tweet can be deterministically converted into inspectable feature/style labels and normalized metrics; summary output never hides sample size or turns correlation into a causal statement.

### Task 2: Build the read-only collector and longitudinal snapshot store

**Files:**
- Create: `viral_style_research.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `X_VIRAL_QUERIES`, existing XActions browser/client and `AUTH_TOKEN`/`CT0` read credentials.
- Produces: `collect`, `snapshot`, `inspect`, and `export` CLI operations plus the local JSONL/CSV dataset.

**Steps:**
- [x] Use browser-backed X Top search for discovery because the installed HTTP SearchTimeline endpoint is currently not reliable.
- [x] Enrich each discovered tweet with `Scraper.getTweet()` for exact public metrics/conversation/media metadata and `Scraper.getProfile()` for follower/profile counts.
- [x] Deduplicate posts by tweet ID and append metric observations by `tweetId + observedAt`.
- [x] For each qualifying seed, collect a bounded set of recent same-author non-repost posts as `author_control`; if the installed HTTP timeline path fails, fall back to the existing browser profile scraper rather than failing the seed.
- [x] For roots that advertise a thread/list, best-effort inspect the root conversation, exact-enrich same-author candidate children, and retain only tweets whose `conversationId` equals the root ID. Preserve observed/expected thread length so partial reconstruction is explicit.
- [x] Never persist cookies, auth headers, raw page HTML, or unrelated account data.
- [x] `inspect --url <x-status-url>` collects one explicitly supplied tweet as `targeted`.
- [x] `snapshot` re-observes every tracked tweet/profile and appends a new metrics row; this is the mechanism for later follower before/after observation.

**Acceptance criteria:**
- Running the collector creates/updates only `.viral-style-research/` and can later re-observe the same tweet/author without X writes or duplicate post metadata.

### Task 3: Export auditable CSV and style summaries

**Files:**
- Modify: `viral_style_research.js`

**Interfaces:**
- Consumes: local `posts.jsonl`, `snapshots.jsonl`, and `threads.jsonl`.
- Produces: `style_report.csv` and `style_summary.json`.

**Steps:**
- [x] Export one CSV row per tracked post using its latest snapshot plus first-observation/follower-delta context.
- [x] Flatten key deterministic features and hook/style labels into spreadsheet-friendly columns while preserving the full JSONL source records.
- [x] Include raw metrics, normalized metrics, follower/age cohorts, source query, sample kind, observed/expected thread length, publication UTC hour/day, and same-author control lift.
- [x] Produce JSON summaries by style label, hook label, sample kind, follower cohort, and UTC publication hour with sample sizes and medians, including seed-only style/hook views separate from controls.
- [x] Explicitly mark follower change as associated account movement, not post-attributed growth.

**Acceptance criteria:**
- A human can open the CSV and independently inspect the text/style/author/timing/performance relationship for every sampled post; summary JSON is reproducible from the JSONL source data.

### Task 4: Add operator commands and usage documentation

**Files:**
- Modify: `package.json`
- Modify: `docs/plans/README.md`
- Modify: `docs/plans/VIRAL_STYLE_RESEARCH.md`

**Interfaces:**
- Produces: stable npm entry points.

**Steps:**
- [x] Add `viral:collect`, `viral:snapshot`, `viral:export`, and `viral:inspect` commands.
- [x] Document default bounds and the local data path.
- [x] Mark this subsystem as research/observational; it does not automatically change writer/editorial rules.

**Acceptance criteria:**
- The collector is discoverable from repository scripts/docs and remains isolated from approval/publication/learned-rule authority.

### Task 5: Generate the first current AI/dev research dataset

**Files:**
- Runtime output only: `.viral-style-research/*` (gitignored)

**Interfaces:**
- Consumes: current X Top-search niche signals.
- Produces: the first local sample and exported report.

**Steps:**
- [x] Run one bounded current collection with a small number of seed posts and same-author controls.
- [x] Export the CSV/summary.
- [x] Inspect the resulting sample sizes and fields for obvious collection gaps, then take a second longitudinal snapshot and verify partial-thread handling on a current list thread.

**Acceptance criteria:**
- The repository has a reproducible research command and the local machine has an initial auditable dataset ready for later snapshots/comparison.

## Interpretation policy

The eventual editorial use should be evidence-weighted:

- `OBSERVED_STYLE_ASSOCIATION`: a style/hook has enough comparable observations to describe an association.
- `WITHIN_AUTHOR_LIFT`: the author's post materially outperformed their own controls on normalized metrics.
- `FOLLOWER_MOVEMENT_ASSOCIATION`: follower count changed after observation; do not attribute the change to one post when overlapping posting/activity exists.
- `INSUFFICIENT`: sample too small or metrics unavailable.

Do not feed a style directly into automatic writing rules merely because it appears in a viral example. Promotion into writer/editorial guidance should require repeated evidence, explicit human review, and remain an empirical variable rather than an X-mechanism claim.
