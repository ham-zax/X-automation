# Viral Style Research Findings — 2026-08-20

## Scope

This report records the first retrospective findings from the local viral-style research dataset before the broader all-niche historical sweep.

Dataset at this checkpoint:

- 83 stored posts;
- 99 metric/profile snapshots;
- 21 unique authors;
- 20 `viral_seed` posts;
- 62 `author_control` posts;
- 1 explicitly targeted post;
- 2 reconstructed thread records;
- date range observed in stored posts: 2026-06-30 through 2026-08-20.

The current retrospective analyzer studies all mature stored main-feed posts rather than only records labeled `viral_seed`. This is necessary because the most recent viral seeds are still immature, while the same-author controls contain the bulk of the 14-day/30-day mature historical sample.

## Method

The study is observational. It does not claim that X rewards a particular phrase or that a style causes virality.

For each eligible post, the analyzer preserves:

- views, likes, reposts, replies, bookmarks;
- observation-time follower count;
- views/follower;
- engagement/view;
- bookmarks/view;
- reposts/view;
- replies/view;
- views/hour;
- follower-size cohort;
- post-age band;
- deterministic hook/style/format features;
- same-author, same-age-band comparisons when at least two peer posts exist;
- follower-cohort + age-band comparisons when enough peers exist.

Evidence strength uses 90% Wilson confidence intervals around observed directional rates. A 90% confidence interval is not 90% predictive accuracy for a future post.

## 30-day study population

At this checkpoint:

- 38 mature eligible posts;
- 14 authors;
- 16 posts with usable same-author/same-age comparison;
- 24 posts with usable matched follower-cohort/age comparison.

## First repeated association: explicit numbers

`feature:contains_number` is the first feature to reach the `REPEATED_ASSOCIATION` evidence class in the 30-day study.

Observed evidence:

- sample size: 23 posts;
- unique authors: 13;
- same-author comparable posts: 9;
- same-author wins: 7/9;
- observed win rate: 77.8%;
- 90% Wilson interval: 50.4%–92.4%;
- median same-author views/follower lift: about 1.39x;
- median views/follower: about 2.44x;
- matched-cohort top-quartile observations: 6/15.

Interpretation: within this selected AI/developer research sample, posts containing concrete numbers repeatedly outperformed age-comparable posts from the same authors. The current evidence supports using numerical specificity as an empirical style variable worth testing; it does not establish a causal X ranking mechanism.

The 14-day version of the same feature remains `DIRECTIONAL`: 20 posts / 12 authors, 5/6 same-author wins, but the 90% lower confidence bound is about 49.8%, just below the repeated-association threshold.

## Directional signals worth tracking

The following currently show interesting descriptive behavior but do not yet meet the repeated-association threshold:

- percentages / quantified percentage claims;
- bullet or numbered-list structure;
- second-person address (`you`, `your`);
- cost/value language;
- short first lines;
- multi-paragraph structure;
- media presence;
- urgency/current-event language;
- release-announcement framing;
- benchmark/performance language;
- resource promises.

Examples of why these remain directional:

- percentage-bearing posts currently show a strong median same-author lift, but the sample is only seven posts across four authors;
- bullet-list posts look unusually strong, but there are only six mature observations and too few same-author comparisons;
- benchmark language has promising individual examples but only three mature posts in the 30-day sample.

## Broad labels are not enough

The first retrospective run showed that labels such as `plain_declarative` and `general_observation` are too broad to answer the actual writing-style question. The analyzer therefore also studies concrete observable features such as:

- contains a number;
- contains a percentage;
- first-line length;
- total word count;
- multi-paragraph layout;
- bullet/list formatting;
- question/exclamation usage;
- direct second-person address;
- benchmark/cost/release/urgency language;
- links/media/resource promises.

This feature-level view produced the first statistically qualified association (`contains_number`).

## Timing findings

Current timing evidence is descriptive only. Among UTC hours with at least four mature observations in the 30-day sample, 21:00 and 18:00 UTC currently have the highest median views/follower, but the sample per hour is far too small to call either an optimal posting time.

Timing must remain secondary to topic, author, news-cycle, and format effects until the historical sample is much larger.

## Thread findings

The current mature retrospective subset has too few eligible reconstructed thread roots to generalize thread structure. Recent thread inspection nevertheless shows that root-post distribution can be dramatically larger than child-post distribution, so future thread analysis should separately study:

- root hook;
- promised list length;
- child structure;
- repeated formatting;
- child utility density;
- CTA/resource placement;
- root vs child views/bookmarks/engagement.

Incomplete threads remain explicitly marked partial rather than being treated as complete evidence.

## Author-intent research contract

The next sweep adds **AI-classified observable author-intent signals** through the operator-selected Phase-6 structured model. These are text-supported communicative purposes, not claims about private psychological motivation. The classifier must return constrained labels, confidence, a short rationale, exact supporting text spans, and model/runtime provenance.

Initial intent taxonomy:

- `announce_release` — launch, release, availability, product/model update;
- `report_experiment` — tested, measured, benchmarked, tracked, compared through first-hand work;
- `compare_evaluate` — explicit comparison, winner/loser, better/worse, tradeoff analysis;
- `teach_explain` — guide, explanation, step-by-step, educational breakdown;
- `share_resource` — repo, prompt, template, list, download, useful resource;
- `solve_problem` — workaround, fix, troubleshooting, how to overcome a constraint;
- `save_cost_time` — cheaper, free, pricing, credits, time-saving, efficiency;
- `ask_community` — question, request for experience/help/confirmation;
- `provoke_opinion` — contrarian take, challenge, debate framing;
- `create_urgency` — today, ending soon, breaking, temporary availability;
- `promote_offer` — explicit product/service/plan/signup/purchase promotion;
- `recruit_career` — hiring, job, internship, career opportunity/advice;
- `build_in_public` — shipping/progress/revenue/customer/build journey;
- `share_news_update` — factual current-event/update communication without a strong personal test/teaching frame;
- `share_observation` — fallback for an observation that does not support a stronger communicative intent.

A post may carry multiple intent signals.

## Next research campaign

The next collection pass covers the last 21 days across every existing product niche:

1. AI coding & agents;
2. models & inference;
3. developer tools;
4. infrastructure & architecture;
5. jobs & career;
6. builders & SaaS;
7. business & productization.

The 21-day period is split into three seven-day windows so X Top search returns broader historical coverage instead of allowing the newest week to dominate every query.

Each niche/window is searched at two engagement floors:

- `breakout`: lower threshold intended to retain unusually strong small/mid-account posts;
- `strong`: higher threshold intended to capture established high-engagement posts.

Discovery thresholds are candidate filters only. Final research interpretation continues to use followers, post age, same-author comparisons, and cohort-normalized metrics.

## Current limitations

- This is a selected discovery sample, not a random sample of all X posts.
- Follower counts are counts observed during collection/snapshotting, not reconstructed exact follower counts at publication time.
- Same-author and cohort matching reduce some confounding but do not eliminate topic, network, media, distribution, or news-cycle effects.
- Historical search results can be incomplete or biased by X search ranking.
- Author-intent labels describe observable communicative intent in the text; they do not establish the author's private motivation.
- No finding here is a hidden-X ranking-factor claim.

## Decision rule for editorial use

Do not copy a viral post or hard-code a style because one example performed well. Promote a pattern into editorial guidance only when it has repeated evidence across multiple authors and comparable posts, with sample size and confidence visible to the operator.
