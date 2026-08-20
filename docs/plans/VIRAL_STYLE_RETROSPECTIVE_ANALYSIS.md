# Viral Style Retrospective Analysis Implementation Plan

**Implementation status (2026-08-20): Implemented.** The offline analyzer now produces 14-day and 30-day retrospective post/group/JSON/Markdown reports from the existing gitignored dataset with same-author/same-age comparisons, matched cohort percentiles, deterministic style/hook/feature groups, and 90% Wilson intervals. On the current 83-post dataset, `feature:contains_number` is the first 30-day `REPEATED_ASSOCIATION`; no 14-day group yet reaches that evidence class.

**Goal:** Turn the already-collected viral-style dataset into a retrospective 14-day/30-day style study that identifies repeatable writing-pattern associations with explicit sample sizes and 90% confidence intervals, without collecting new X data first or claiming predictive certainty.

**Architecture:** Reuse the existing `.viral-style-research/` JSONL dataset and `viral_style.js` normalization/features. Add one offline analyzer that re-extracts the current deterministic style taxonomy from stored text, filters by retrospective window and maturity, compares posts against same-author/same-age peers when available, uses matched follower/age cohorts otherwise, and writes auditable JSON/CSV/Markdown reports back into the gitignored research directory. The analyzer must distinguish evidence strength from prediction accuracy: 90% refers to interval confidence around observed directional rates, not a claim that a hook will make a future post viral with 90% accuracy.

**Tech Stack:** Node.js 24, existing `viral_style.js`, standard-library filesystem/statistics utilities, existing gitignored `.viral-style-research/` dataset.

## Global Constraints

- Use the existing collected dataset as the study population; do not perform new X reads for this implementation pass.
- Current dataset baseline observed on 2026-08-20: 83 posts, 99 snapshots, 21 authors, including 20 `viral_seed`, 62 `author_control`, and 1 `targeted` record.
- The analysis population is not restricted to `viral_seed`; mature historical controls are valid retrospective observations and currently supply most of the older sample.
- Default retrospective windows: 14 days and 30 days.
- Default maturity floor: 24 hours. A caller may raise it, but the analyzer must expose the selected maturity floor in every report.
- Preserve current follower counts as observation-time context only. Do not relabel them as exact follower counts at publication time.
- Same-author comparisons must prefer posts in the same post-age band. If there are not enough comparable same-author peers, leave author-relative evidence unavailable rather than comparing immature and mature posts.
- Cohort comparisons must match follower-size cohort and post-age band and exclude the target post itself.
- Re-extract hook/style labels from stored post text at analysis time so one report uses one current taxonomy even if records were collected under an earlier taxonomy revision.
- 90% confidence means a 90% confidence interval around an observed directional rate. Do not use the word `accuracy` for those intervals and do not claim hidden-X ranking causality.
- Always expose sample size and unique-author count. A one-post or one-author style cannot be promoted as a general pattern.
- Research outputs remain observational and cannot automatically modify Editorial Director ordering, writer prompts, learned rules, approval, scheduling, or publication.
- Do not modify the unrelated uncommitted AI/runtime/settings files already present in the working tree.
- No tests are authorized. Use bounded direct/non-test validation only.

## Current dataset facts that shape this plan

At implementation start:

- 14-day window: 77 collected posts, 34 posts already at least 24h old, 13 mature-sample authors.
- 30-day window: 81 collected posts, 38 posts already at least 24h old, 14 mature-sample authors.
- The current `viral_seed` records are too recent to be the only retrospective population, so the analyzer must study all mature collected posts.
- Historical material is uneven across authors and age bands. The analyzer therefore needs explicit insufficiency states rather than forcing a comparison for every label.

## File responsibility map

- Create: `viral_style_analyze.js` — offline retrospective eligibility, per-post comparisons, confidence intervals, style/hook/timing summaries, and JSON/CSV/Markdown report generation.
- Create: this plan — authoritative scope and interpretation contract for the retrospective analyzer.
- Modify: `docs/plans/README.md` — index the retrospective analyzer after implementation.
- Runtime output only: `.viral-style-research/retrospective_14d.*`, `.viral-style-research/retrospective_30d.*` — gitignored study outputs.

Do not modify `package.json` in this pass because it currently contains unrelated uncommitted user work. The analyzer remains directly executable as `node viral_style_analyze.js ...`.

## Statistical/interpretation contract

### Eligible post

A post is eligible when:

```text
createdAt >= analysisNow - windowDays
latestSnapshot exists
latestSnapshot.postAgeMinutes >= maturityHours * 60
not a repost
has a finite viewsPerFollower observation
```

Replies may remain in the source dataset but are excluded from the default style study because the research target is main-feed writing style. Quote posts may remain and must be reported as their actual format rather than silently merged with originals.

### Per-post comparisons

For each eligible post calculate:

```text
viewsPerFollower
engagementsPerView
bookmarksPerView
repostsPerView
repliesPerView
viewsPerHour
followerCohort
ageBand
```

Same-author peer set:

```text
same username
other eligible post
same ageBand
```

If the peer set contains at least 2 posts, calculate:

```text
authorPeerCount
authorMedianViewsPerFollower
authorViewsLift = post.viewsPerFollower / author median
authorWin = authorViewsLift > 1
```

Matched cohort set:

```text
other eligible post
same followerCohort
same ageBand
```

If the matched cohort contains at least 4 peers, calculate the target post's percentile rank within that cohort and whether it is in the top quartile (`cohortBreakout = percentile >= 0.75`). This is a dataset-relative label, not an X virality claim.

### Group evidence

Analyze hook labels, style labels, and deterministic feature-presence groups (for example `contains_number`, `second_person_address`, `short_first_line_60_chars_or_less`, `multi_paragraph`, `benchmark_language`, `cost_value_language`, and `resource_promise`). Feature groups are important because broad labels such as `plain_declarative` can hide the concrete writing choices the study is meant to evaluate. For each group report:

```text
sampleSize
uniqueAuthors
median viewsPerFollower
median engagementsPerView
median bookmarksPerView
median repostsPerView
median repliesPerView
median viewsPerHour
authorComparableCount
authorWinCount
authorWinRate
authorWinRate90CiLow
authorWinRate90CiHigh
medianAuthorViewsLift
cohortComparableCount
cohortBreakoutCount
cohortBreakoutRate
cohortBreakoutRate90CiLow
cohortBreakoutRate90CiHigh
```

Use a Wilson score interval at 90% confidence for directional proportions. Do not manufacture an interval when `n = 0`.

Evidence class:

```text
INSUFFICIENT
  sampleSize < 5 OR uniqueAuthors < 3

DIRECTIONAL
  sampleSize >= 5 AND uniqueAuthors >= 3, but comparable evidence is still sparse

REPEATED_ASSOCIATION
  sampleSize >= 6
  uniqueAuthors >= 3
  and either:
    authorComparableCount >= 5 with medianAuthorViewsLift > 1 and authorWinRate90CiLow > 0.50
    OR cohortComparableCount >= 8 with cohortBreakoutRate90CiLow > 0.25

STRONG_REPEATED_ASSOCIATION
  sampleSize >= 10
  uniqueAuthors >= 5
  authorComparableCount >= 8
  medianAuthorViewsLift >= 1.5
  authorWinRate90CiLow > 0.50
```

These labels describe strength of evidence inside the collected dataset. They are not future-post success probabilities.

### Timing

Group eligible posts by UTC publication hour only when the hour has at least 4 observations. Report sample size and normalized medians. Timing remains descriptive because UTC hour is not the author's local-time intent and topic/news cycles remain confounders.

### Thread evidence

Report thread/root observations separately. Do not compare a thread style against single-post styles unless at least 5 eligible thread roots exist. Until then, thread findings remain `INSUFFICIENT` with observed examples only.

## Output contract

For each requested window write:

```text
retrospective_<Nd>_posts.csv
retrospective_<Nd>_groups.csv
retrospective_<Nd>.json
retrospective_<Nd>.md
```

The Markdown report must contain:

1. dataset/window/maturity counts;
2. `What the current evidence supports` — only `REPEATED_ASSOCIATION` or stronger groups;
3. `Promising but not established` — directional groups;
4. `Insufficient sample` — labels a human may care about but cannot yet generalize;
5. top individual normalized performers with URL, first line, author followers at observation, and style/hook labels;
6. timing observations with explicit sample sizes;
7. thread observations and completeness;
8. limitations: selected discovery sample, observation-time follower counts, topic/news confounding, and no causal/predictive claim.

## CLI contract

```bash
node viral_style_analyze.js --days 30 --mature-hours 24 --confidence 0.90
node viral_style_analyze.js --days 14 --mature-hours 24 --confidence 0.90
node viral_style_analyze.js --all
```

`--all` writes both the 14-day and 30-day reports using the same analysis timestamp so the windows are directly comparable.

### Task 1: Build retrospective per-post evidence rows

**Files:**
- Create: `viral_style_analyze.js`

**Interfaces:**
- Consumes: `.viral-style-research/posts.jsonl`, `snapshots.jsonl`, `threads.jsonl`, `viral_style.js`.
- Produces: eligible per-post study rows with current style taxonomy, same-author peer evidence, and matched-cohort percentile evidence.

**Steps:**
- [x] Load the existing local research records without performing network calls.
- [x] Recompute style/hook features from stored text.
- [x] Filter by requested retrospective window, main-feed eligibility, and maturity floor.
- [x] Calculate same-author/same-age peer lift only with at least two peers.
- [x] Calculate follower-cohort/age-band percentile only with at least four peers.
- [x] Preserve unavailable comparisons as `null`.

**Acceptance criteria:**
- Running the analyzer does not contact X and produces one auditable derived row per eligible mature stored post without mutating source JSONL data.

### Task 2: Add 90% confidence-qualified group analysis

**Files:**
- Modify: `viral_style_analyze.js`

**Interfaces:**
- Consumes: Task-1 derived rows.
- Produces: hook/style/feature/timing/thread group summaries and evidence classes.

**Steps:**
- [x] Implement standard-library Wilson score intervals for observed win/breakout proportions at the requested confidence level.
- [x] Aggregate normalized medians, sample sizes, unique authors, same-author win evidence, and cohort-breakout evidence by hook/style label and deterministic feature-presence group.
- [x] Assign evidence classes exactly from the contract above.
- [x] Keep timing and thread evidence separate from general hook/style claims when their sample is insufficient.

**Acceptance criteria:**
- Every group conclusion exposes the observations behind it, and no group with insufficient sample is presented as a reliable style rule.

### Task 3: Produce human-readable retrospective reports

**Files:**
- Modify: `viral_style_analyze.js`

**Interfaces:**
- Consumes: per-post and grouped analysis.
- Produces: JSON, post CSV, group CSV, and Markdown report under `.viral-style-research/`.

**Steps:**
- [x] Write flat post-level evidence rows for manual inspection.
- [x] Write flat hook/style/feature group rows with confidence intervals and evidence classes.
- [x] Write the full structured JSON report.
- [x] Write a concise Markdown interpretation ordered by evidence strength, not raw views.
- [x] Include top normalized individual examples and explicit caveats.

**Acceptance criteria:**
- A human can read the Markdown summary for conclusions and inspect CSV/JSON to trace every conclusion back to stored observations.

### Task 4: Generate the current 14-day and 30-day studies

**Files:**
- Runtime output only: `.viral-style-research/retrospective_*`
- Modify: `docs/plans/README.md`
- Modify: this plan

**Interfaces:**
- Consumes: the existing 83-post dataset at implementation time.
- Produces: current retrospective reports and documented analyzer status.

**Steps:**
- [x] Run `node viral_style_analyze.js --all` against the existing local dataset.
- [x] Inspect the resulting sample counts and evidence classes for mathematical/semantic consistency.
- [x] Mark this plan implemented and index it from the plan README.

**Acceptance criteria:**
- Both 14-day and 30-day reports exist locally, require no new collection to reproduce, and clearly separate supported associations from insufficient evidence.
