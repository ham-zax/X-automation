# Corpus V4 Collection Provenance

## Status

Corpus V4 passed independent review through R1, R2, and R3 and was approved for promotion on 2026-09-04.

The canonical Phase 2 entry point was then promoted from this reviewed V4 package. This file records what happened during the V4 collection/repair wave and should be read together with `manifest.json` and `REPAIR_REPORT.md`.

## Fixed collection window

- Anchor: `2026-09-03T20:59:08.867Z`
- 365-day boundary: `2025-09-03T20:59:08.867Z`
- Authored sample ceiling: 100 per creator
- Reply sample ceiling: 50 per creator

Target ceilings are bounded samples, not exhaustive-history requirements.

## Authenticated X routes used

Corpus rows came from authenticated X GraphQL traffic normalized by `x_creator_corpus.js`.

Primary authored route:

- `UserOriginalsTimeline` / compatible live profile operation

Primary reply route:

- `UserRepliesTimeline` / `UserTweetsAndReplies`

Fallback route:

- authenticated `SearchTimeline`

Search fallback was used when a profile timeline did not establish the requested target/window coverage.

No third-party mirror was used as a source of Corpus V4 rows.

## Rate-limit observations during A2

During the uniform reply collection wave, the authenticated SearchTimeline route returned HTTP 429 while other authenticated profile/reply timeline operations could remain healthy.

A notable observed event occurred during the batch containing `@DrJimFan`: the response included `x-rate-limit-reset`, and the collector entered a bounded cooldown of roughly 799 seconds rather than continuing to hit the limited operation.

Later short reset windows were also respected when encountered.

The collector behavior for these events was:

- preserve already collected rows;
- record the 429/reset metadata where observable;
- wait for the reset rather than treating the lane as exhausted;
- use normal healthy authenticated profile routes when their independent operation remained available;
- avoid credential/account rotation or other rate-limit evasion;
- stop after repeated consecutive rate-limit events rather than hammering X.

These observations indicate separately enforced operational buckets during this run. They do **not** establish stable public quota numbers for X; exact endpoint limits should be treated as changeable implementation behavior.

## R1 defect and A2 repair

R1 found that three stagnant browser scroll passes could previously be interpreted as timeline exhaustion and therefore false completeness.

A2 changed that invariant so stagnation means:

- `complete: false`
- `exhausted: false`
- `stopReason: "timeline_stalled"`

unless another independent completion condition is satisfied.

R1 live falsifications were recovered in A2:

### `@sama`

Recovered and retained the three June 4, 2026 posts identified by R1:

- `2062661191969972645`
- `2062661071761211561`
- `2062660086787613116`

Final authored sample: 100, complete by target reached.

### `@ylecun`

Recovered and retained the five May/June 2026 posts identified by R1:

- `2062927632597971240`
- `2058676921110589664`
- `2057979614115307712`
- `2056068940825030965`
- `2055702985578025041`

Final authored sample: 74, truthfully partial with `timeline_stalled` because neither the 100-post ceiling nor fixed boundary was established.

## Final reviewed corpus state

- Creators: 52
- Authored/main records: 4,517
- Replies: 2,413
- Reposts in canonical authored collection: 0
- Main lanes: 40 complete / 12 partial
- Reply lanes: 48 complete / 4 partial
- Creators reaching 100 authored posts: 39
- Creators reaching 50 replies: 47
- George Hotz: separate accepted zero-public-post exhausted case

The four non-George sub-50 reply lanes are:

- `@miramurati`: 37 — partial / `timeline_stalled`
- `@DarioAmodei`: 13 — partial / `timeline_stalled`
- `@AndrewYNg`: 8 — partial / `timeline_stalled`
- `@chipro`: 5 — partial / `timeline_stalled`

These are uniformly attempted low-N samples, not proven natural/historical ceilings and not exhaustive reply histories.

## Structural integrity at promotion

Independent review established:

- duplicate IDs: 0
- false-zero views: 0
- unknown views: 0
- mislabeled authored `RT @...`: 0
- reply rows in main corpus: 0
- non-reply rows in reply corpus: 0
- quote posts: 2,177
- embedded quote context available: 2,161 (99.27%)
- `note_tweet` rows: 1,155
- text rows over 280 characters: 1,369
- reply parent metadata completeness: 100% across 2,413 replies

Known Chip Huyen long-form regression:

- tweet ID `2011485105081237618`
- `textSource: note_tweet`
- 720 characters

## Promotion source hashes

The following reviewed V4 files were copied byte-for-byte to their canonical Phase 2 aggregate counterparts during promotion:

- `posts.jsonl` — `4438992ed55833c2046859b772912d7f9024a243824342086ede2ab4468484e3`
- `manifest.json` — `792aabafa8f426104b56392b815a7024f824d5999549e8bd2f6e45cd8b6c5152`
- `replies.jsonl` — `ba91a850a61d197cb58b4b3312630dc695179daa3cd2e86e43813d9095bba42f`
- `authored_posts.jsonl` — `b05327fd85d3e2372fb8db449578ee876af6dce4420fecdfc4a9a04ddcfe4225`
- `reposts.jsonl` — `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

`posts.jsonl` is the canonical analysis entry point. `authored_posts.jsonl` contains the same post IDs/order but two embedded quoted-context text strings preserve a different Unicode line-separator normalization from `posts.jsonl`; both files are retained exactly as reviewed.

## Analysis restrictions

- Do not infer annual posting frequency from authored row counts: samples are capped and 12 main lanes are partial.
- For equal-size recent-post comparisons, use the 39 creators that reached the 100-post ceiling; treat George separately.
- Replies are behavioral evidence and remain separate from authored main-feed comparisons.
- The four partial low-N reply lanes can support caveated qualitative analysis but must not be called exhaustive histories.
- Observation-time follower counts are not historical follower counts at post publication.
- Sixteen quote rows have unavailable embedded quote context; their quote IDs remain preserved.

## Known non-blocking follow-up

`aggregateCommand()` can inherit stale execution/provenance fields from an existing manifest. R2 found no current V4 mis-promotion from this behavior, so it was not a promotion blocker. It should be repaired before relying on aggregation against arbitrary historical/contaminated manifests in future collection waves.
