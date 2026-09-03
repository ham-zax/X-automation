# X Creator Corpus Collection Runbook

## Purpose

This runbook captures the reusable operational rules learned while building and repairing the Phase 2 Creator Corpus V4. It is intentionally separate from any one corpus run.

The goal is to collect recent creator-authored posts and replies from authenticated X routes without confusing UI stalls, rate limits, or incomplete pagination with genuine timeline exhaustion.

## Core invariants

1. **Use one fixed corpus anchor for an entire collection wave.**
   - Do not recompute the trailing-window boundary from wall-clock time on each resumed subset run.
   - Persist the anchor in the manifest and reuse it for all resumptions.

2. **A sample target is a ceiling, not a quota.**
   - Authored target and reply target bound the sample size.
   - Fewer rows can still be valid, but only if the lane is truthfully classified.

3. **Browser/search stagnation is not exhaustion.**
   - Repeated scrolls or requests that produce no new accepted rows may stop the current attempt.
   - Stagnation alone must produce a partial/stalled lane, not `exhausted: true`.

4. **429 is not exhaustion.**
   - Preserve rows already captured.
   - Record the rate-limit event.
   - Respect `x-rate-limit-reset` or `retry-after` when available.
   - Resume only after the bounded cooldown.

5. **Do not fill gaps from third-party mirrors.**
   - Corpus rows should come from authenticated X routes used by the collector.
   - External mirrors/search snippets may be used for diagnosis or falsification, not silent corpus backfill.

6. **Keep authored posts and replies separate.**
   - Main-feed originals/quotes are the authored corpus.
   - Replies are a behavioral supplement and should not be mixed into authored-post performance comparisons.

## Preferred route order

### Authored posts

1. Authenticated profile timeline (`UserOriginalsTimeline` / compatible live operation).
2. If the profile route remains incomplete, use authenticated `SearchTimeline` fallback with a query equivalent to:
   - `from:<handle> -filter:replies -filter:retweets`
3. Merge by post ID and apply the same fixed anchor/window.

### Replies

1. Authenticated profile replies route (`UserRepliesTimeline` / `UserTweetsAndReplies`).
2. If incomplete, use authenticated `SearchTimeline` fallback with a reply-filter query.
3. Merge by post ID and apply the same fixed anchor/window.

Using profile timeline routes first conserves the more constrained search route and reduces unnecessary pressure on its rate-limit bucket.

## Rate-limit behavior

During the September 2026 V4 repair, X returned authenticated HTTP 429 responses on `SearchTimeline` while profile/reply timeline routes could still return HTTP 200 responses. This is evidence that the operations can be governed by separately enforced rate-limit buckets.

Treat this as an **observed behavior**, not a stable public quota contract. Exact call limits can change and should not be hardcoded into research assumptions.

When a 429 occurs:

1. Preserve all already captured rows.
2. Record the operation, status, and reset metadata when available.
3. If `x-rate-limit-reset` identifies a future reset inside a reasonable bounded interval, wait until that reset plus a small safety margin.
4. If the current operation is limited but another normal authenticated X route remains healthy, that healthy route may continue to be used according to the normal route order.
5. Do not rotate credentials, alternate accounts, or other mechanisms to evade the limited bucket.
6. Stop the batch after repeated consecutive rate limits rather than hammering X.

A healthy independent X operation is a legitimate alternate route. It is not permission to evade a rate limit on the route that returned 429.

## Completion semantics

A lane may be marked complete only when at least one defensible condition is established:

- requested sample target reached;
- fixed trailing-window boundary crossed;
- genuine source-level terminal/exhaustion evidence.

Otherwise keep it partial.

Recommended stop reasons:

- `authored_sample_target_reached`
- `reply_target_reached`
- `time_window_covered`
- `timeline_exhausted`
- `timeline_stalled`
- `rate_limited`

Never use `timeline_exhausted` as a synonym for "the browser stopped yielding rows."

## Resume rules

- Reuse the original fixed anchor.
- Preserve non-targeted creator files and manifest entries during subset runs.
- A prior 10- or 20-row smoke-test limit must not masquerade as completion under a later 50-row policy.
- Re-attempt the lane under the current target when the earlier run used a different target.
- Do not infer that zero recovered rows means zero creator activity unless the lane has genuine completion evidence.

## Normalization rules

- Prefer `note_tweet.note_tweet_results.result.text` when available so long-form X posts are not clipped to legacy text.
- Preserve missing metrics as `null` with matching `metricAvailability=false`; do not convert unavailable metrics to zero.
- Preserve quote identity even when embedded quote context is unavailable.
- Preserve reply-parent metadata (`inReplyToStatusId`, `inReplyToUserId`, `inReplyToUsername`, `conversationId`).
- Record observation-time follower counts as observation snapshots, not historical follower counts at post publication time.

## Validation checklist

Before promoting a corpus:

- all creator IDs/handles match the intended cohort;
- aggregate files equal the per-creator component rows after deduplication;
- duplicate post IDs: 0;
- false-zero view anomalies: 0;
- main corpus contains no reply rows;
- reply corpus contains only reply rows;
- no `RT @...` classification leak in authored rows;
- long-form `note_tweet` regression(s) remain intact;
- quote-context missingness is explicit rather than fabricated;
- partial lanes are visibly partial in the manifest;
- top-level totals agree with component files;
- fixed anchor/window is identical across resumed subsets.

## Known collector follow-up

As of Corpus V4 promotion, `aggregateCommand()` has a known non-blocking robustness issue: it can inherit execution/provenance fields such as `exhausted`, `rateLimited`, `operationResponses`, and `responseErrors` from a pre-existing manifest. The promoted V4 artifact was independently reviewed and does not currently mis-promote any creator because of this behavior, but future aggregation should not treat inherited stale execution state as disk-derived fact.

Until that is repaired, aggregation against an old or contaminated manifest requires explicit review of inherited completion/exhaustion state.

## Special cases

The September 2026 George Hotz zero-public-post case was independently observed and accepted for that corpus. Do not generalize special-case exhaustion logic from one creator to other low-count creators.
