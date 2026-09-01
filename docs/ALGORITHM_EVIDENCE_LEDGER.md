# X Algorithm Evidence Ledger

Last reviewed: **2026-08-25**.

This document prevents the growth system from confusing platform code, official product statements, third-party observations, and our own experiments.

The operating rule is:

> **Build strategy around durable mechanisms. Treat constants, timing windows, and creator folklore as variables unless current primary evidence proves otherwise.**

---

## 1. Evidence classes

### `CODE_BACKED`

The mechanism is visible in the current public `xai-org/x-algorithm` repository.

This is the strongest evidence class for For You implementation mechanics available to this project.

Important limitation:

- public code can still be parameterized through feature switches;
- defaults are not guaranteed to equal every viewer's active experiment bucket;
- infrastructure/data not shipped in the repository can affect outcomes;
- code-backed does not mean a creator can directly control the predicted probability.

### `OFFICIAL_PRODUCT_OR_POLICY`

X explicitly documents behavior in Help Center/product/policy materials, but the claim is not necessarily a general For You ranking mechanism.

Example:

- reply prioritization associated with Premium tiers.

Treat this as product behavior, not proof of general candidate eligibility or universal feed boosts.

### `EMPIRICAL_VARIABLE`

A tactic is plausible, repeatedly observed, or operationally useful, but is not established as a universal platform invariant by current code/official documentation.

These belong in our experiment system.

Examples:

- ideal reply age;
- ideal main-feed interval;
- exact media frequency;
- whether links perform better in replies;
- optimal account-size target;
- ideal number of daily replies;
- first-30-minute or first-60-minute cliffs.

### `RETIRED`

A previous claim, parameter, product rule, or strategy assumption is stale, contradicted, superseded, or too weak to continue treating as a system rule.

Retired claims remain documented so they do not silently re-enter the strategy later.

---

## 2. Current primary source set

Primary repository:

- https://github.com/xai-org/x-algorithm

Key files:

- `README.md`
- `phoenix/README.md`
- `home-mixer/scorers/ranking_scorer.rs`
- `home-mixer/params/param.rs`
- `docs/BIDIRECTIONAL_BOOST_CHANGE.md`
- `vm-ranker/`
- `thunder/`
- `simclusters/`
- `visibility-filtering/`
- `scarecrow/`
- `botmaker/` and `botmaker-rules/`
- `agatha/`
- `bdsm/`
- `user-cred-v2/`
- `abuse-enforcement-service/`
- `safety-label-user-agg/`
- `under-the-hood/`

The August 2026 repository README explicitly describes the current tree as the core For You feed code and the Phoenix release as production implementation rather than the earlier Grok-derived sample. The August 13 release also exposes substantially more of the account/post labeling and visibility-filtering path.

---

## 3. CODE_BACKED ledger

### 3.1 Phoenix is a two-stage retrieval + ranking system

**Status:** `CODE_BACKED`

Phoenix currently exposes:

1. retrieval that narrows a very large corpus;
2. ranking that predicts viewer actions for retrieved candidates.

The current Phoenix documentation describes retrieval as a **Two-Tower** architecture and ranking as a transformer.

**Strategic implication:**

Topic/audience coherence matters before ranking. A post that is never retrieved for the relevant viewer cannot benefit from clever copywriting afterward.

**Do not infer:**

- one universal creator-side SEO formula;
- that using a keyword guarantees retrieval;
- that one static engagement count guarantees ranking.

---

### 3.2 Thunder is an in-network source

**Status:** `CODE_BACKED`

Current repository overview describes Thunder as the in-network source holding recent posts from accounts a viewer follows.

**Strategic implication:**

Follower relationships change the retrieval context. Growing the relevant follower graph is structurally different from depending entirely on out-of-network discovery.

---

### 3.3 Out-of-network retrieval exists separately

**Status:** `CODE_BACKED`

Current repository overview identifies Phoenix retrieval and SimClusters as out-of-network sources.

Current parameter defaults also include an `OonWeightFactor` of `0.75` and a separate topic OON factor.

**Strategic implication:**

A small account should expect stranger discovery to operate under different conditions than in-network distribution. Relevant follows/relationships are therefore not merely vanity graph changes.

**Constant caution:**

Treat `0.75` as a current code/default parameter, not an eternal universal multiplier for every viewer/request.

---

### 3.4 Ranking combines predicted actions, not raw observed counts

**Status:** `CODE_BACKED`

`ranking_scorer.rs` reads feature-switch weights and combines Phoenix-predicted action heads/continuous values.

Current exposed heads/values include signals such as:

- favorite;
- reply;
- repost;
- photo expand;
- video open;
- click;
- open link;
- profile click;
- video-quality view;
- share;
- DM share;
- copy-link share;
- dwell;
- quote;
- quoted click/view;
- follow author;
- post-unexplored value;
- several negative feedback probabilities;
- continuous dwell values.

The repository now explicitly warns that the weight values multiply **predicted probabilities/values**, not raw engagement counts.

**Strategic implication:**

The system should optimize content for multiple plausible downstream viewer actions rather than trying to convert weights into formulas such as `1 reply = N likes`.

**System rule:**

Never use exposed weights as raw engagement-point arithmetic.

---

### 3.5 Current exposed action weights are parameterized

**Status:** `CODE_BACKED`

The current `param.rs` defaults include values such as:

```text
FavoriteWeight                    0.5
ReplyWeight                       5.0
RetweetWeight                     1.0
ShareWeight                       2.0
ShareViaDmWeight                  5.0
ShareViaCopyLinkWeight           20.0
QuoteWeight                       5.0
FollowAuthorWeight                4.0
NotInterestedWeight             -43.2
BlockAuthorWeight               -31.2
MuteAuthorWeight                -58.8
ReportWeight                   -234.0
NotDwelledWeight                -0.02
```

These are useful to understand which predicted actions the scorer is capable of valuing and the relative scale of current defaults.

They are **not** permission to state count equivalences. In particular, older figures such as report `-369` or block `~-74` are not the current defaults in this August 2026 source snapshot.

They can also be changed through feature switches/experiments.

**Strategic implication:**

Create content that plausibly produces a bundle of valuable actions:

```text
useful read
+ substantive reply
+ share/send utility
+ profile interest
+ follow-author probability
```

rather than maximizing passive likes.

---

### 3.6 Author diversity attenuation exists

**Status:** `CODE_BACKED`

Current defaults expose:

```text
AuthorDiversityDecay = 0.5
AuthorDiversityFloor = 0.25
```

The repository overview explicitly describes repeated-author decay during scoring.

**Strategic implication:**

Bursting many semantically related main-feed posts is strategically weak because the feed also has to manage repeated-author presence.

**Do not infer:**

- a universal mandatory 3-hour/6-hour posting interval;
- that the decay parameter is a literal time half-life.

Posting interval remains an empirical scheduling variable.

---

### 3.7 Bidirectional/mutual-follow original-post reply boost exists

**Status:** `CODE_BACKED`

The current scorer has `is_mutual_follow_author` eligibility for original posts and applies a separate bidirectional follow reply-weight boost.

The current parameter default is:

```text
BidirectionalFollowReplyWeightBoost = 15.0
```

The public change document records:

- July 10, 2026: A/B test with values including 5/10/15/20;
- July 13: value 20 broadly rolled out while experimentation continued;
- July 24: broad value changed to 15.

The boost applies to original posts from mutually followed authors by increasing the reply head weight. The same experimental branch included a dwell boost, but the current default dwell boost is `0.0`.

**Strategic implication:**

Relationship formation can compound into future in-network distribution. This strengthens the case for building recurring relevant relationships rather than permanently borrowing large-thread reach.

**System implication:**

Track:

```text
relationship stage
follows_you
you_follow
mutual
recurring exchanges
```

Track mutual state as an observed relationship signal; relationship targeting should still optimize relevance and repeated useful interaction.

---

### 3.8 Candidate isolation attention masking exists

**Status:** `CODE_BACKED`

Phoenix ranking documentation states that candidates cannot attend to one another during inference; each candidate can attend to viewer/history context and itself.

**Strategic implication:**

The model can score each candidate against the viewer/history without direct candidate-to-candidate attention inside the ranking transformer.

Do not misinterpret this as meaning downstream reranking/diversity does not compare candidates; later stages can still enforce slate-level diversity.

---

### 3.9 Semantic/topic representations are part of retrieval/ranking

**Status:** `CODE_BACKED`

Phoenix documentation describes semantic IDs derived from multimodal embeddings and use of viewer engagement history in retrieval/ranking.

**Strategic implication:**

A coherent topical identity matters more than superficial keyword stuffing.

The content system should use precise semantic anchors because they improve human clarity and topic coherence, not because a literal hashtag/keyword formula is known.

---

### 3.10 Candidate age filtering exists in the current pipeline

**Status:** `CODE_BACKED`

The current main repository architecture description lists pre-scoring filtering for posts older than 48 hours in the For You candidate path.

**Strategic implication:**

Freshness matters structurally for this path.

Evergreen ideas should become new original information objects when revisited rather than assuming an old post remains equally eligible forever.

**Do not infer:**

- a 6-hour universal score half-life;
- a 30/60-minute universal distribution cliff.

Those remain empirical variables.

---

### 3.11 Ranking and visibility filtering are separate layers

**Status:** `CODE_BACKED`

The August 2026 repository architecture explicitly separates ranking/selection from `visibility-filtering/`, which can allow, interstitial, or drop content based on viewer state and labels attached to accounts/posts.

**Strategic implication:**

Do not treat reach changes as proof that the ranker alone changed. Account/post visibility state is a separate observable dimension when the platform exposes evidence for it.

**System implication:**

Account Health should preserve actual visibility/enforcement observations with provenance rather than estimating a hidden "shadowban" score from impressions.

---

### 3.12 Public labeling/account-scoring/enforcement components exist

**Status:** `CODE_BACKED`

The August 2026 public tree includes components documented for:

- event/rule labeling through `scarecrow/` + `botmaker/`;
- inauthentic/account-quality scoring through systems including `bdsm/`, `agatha/`, and `user-cred-v2/`;
- account/post aggregation through `safety-label-user-agg/`;
- enforcement/challenge/suspension actions through `abuse-enforcement-service/`.

The repository also states that some BotMaker rules are intentionally not published to reduce gaming/circumvention.

**Strategic implication:**

Build around stable positive mechanisms and observable outcomes, not guessed detector thresholds or evasion parameters.

---

### 3.13 Under the Hood exposes aggregate visibility-impacting label information

**Status:** `CODE_BACKED`

The August 2026 repository documents `under-the-hood/` jobs/serving code and an X surface that reports aggregate statistics about visibility-impacting labels on an account and its posts when available.

**Strategic implication:**

Observed Under the Hood state is stronger account-health evidence than inferred "bot risk" from posting volume or timing.

**System implementation:**

The current Account Health reader attempts the authenticated Under-the-Hood surface once, records a provenance-preserving snapshot only when the report is observable, and treats `available:false` as absence of evidence rather than a health state. Observable report labels may support a hard account-health constraint; saturation, repetition, target concentration, activity volume, timing, reach, and InteractionYield remain `EMPIRICAL_VARIABLE` diagnostics.

**Do not infer:**

- that the surface exposes every internal label/rule;
- that absence of a visible label proves zero enforcement risk;
- that one label transition identifies a single causal action without further evidence.

---

## 4. OFFICIAL_PRODUCT_OR_POLICY ledger

### 4.1 Premium reply prioritization

**Status:** `OFFICIAL_PRODUCT_OR_POLICY`

Research supplied to this project cites X Premium documentation and conversation documentation as stating that Premium status affects reply ordering, with larger prioritization for higher tiers.

Source to re-check before building product logic:

- https://help.x.com/en/using-x/x-premium

**Strategic implication:**

Reply visibility can depend on account/product state in addition to content quality.

**Do not infer:**

Premium automatically increases all For You candidate eligibility or universally boosts original-post ranking unless current primary evidence says so.

---

### 4.2 Automation/product rules

**Status:** `OFFICIAL_PRODUCT_OR_POLICY`


They are operational boundaries, not growth-scoring factors.

---

## 5. EMPIRICAL_VARIABLE ledger

These are explicitly experimentable rather than hard-coded truths.

### Reply age / early insertion

Hypotheses:

```text
0-5m
5-15m
15-30m
30-60m
60m+
```

Measure:

- reply impressions when observable;
- target response rate;
- conversation continuation;
- follower conversion;
- relationship progression.

### Main-feed spacing

Initial heuristic may remain 3-6 hours for ordinary posts, but the scheduler must learn from our own outcomes.

Measure:

- first-hour reach;
- associated follower conversion;
- semantic overlap with prior post;
- whether prior post is still accelerating.

### Links in primary post vs reply

Do not encode a fixed penalty without current primary evidence.

Experiment by content archetype.

### Hashtag count

**2026-08-25 account observation:** live profile reconciliation identified the latest three relevant main-feed originals:

- `https://x.com/ham_zax/status/2092100349234684010` — two canonical hashtags (`#OxAlpha #OpenRouter`) — **161 impressions** at about 8h;
- `https://x.com/ham_zax/status/2092091703268417739` — zero hashtags — **8 impressions** at about 8h;
- `https://x.com/ham_zax/status/2092164596266410464` — zero hashtags — **13 impressions** at about 3h.

The 161-vs-8 pair is especially notable because X displayed both at roughly the same post age. Treat it as a strong candidate signal, not a causal result. The sample is only `n=3`; topic momentum (`Ox Alpha` / `OpenRouter`), wording, timing, and other distribution factors remain plausible explanations, and the 13-impression post has a shorter observation window.

Operationally, move hashtag count from a passive variable to an active first-1,000 experiment:

- test **0 vs 1 vs 2** canonical topical hashtags on comparable main-feed originals;
- because the positive observation used two hashtags, do not rewrite the evidence into a one-hashtag rule;
- compare impressions at the same post-age window, then add follow/profile-conversion evidence when observable;
- keep replies at zero hashtags by default unless the hashtag is part of the actual conversation;
- never use generic hashtag blocks as a substitute for semantic specificity.

The claim that hashtags universally improve X distribution, or that one or two is the universally optimal count, remains an `EMPIRICAL_VARIABLE` until a larger controlled account cohort supports it.

### Media frequency

Do not mandate visuals on 80-90% of posts.

Use media when it supplies proof/explanation, then measure media-type cohorts.

### Target-account size

Do not encode `5K-100K`, `5x-20x`, or any other follower window as a law.

Follower count is a minor target-scoring input.

### Number of daily replies

Do not turn `10-15`, `15-20`, or another quota into a requirement.

The correct volume is the number of high-quality opportunities that pass contribution/review thresholds. A burst of substantive replies in an active bidirectional conversation is not equivalent to bulk cold insertion.

### Target saturation / interaction concentration

Treat target interaction count, consecutive unanswered interactions, thread crowding, and top-target concentration as empirical modifiers.

Measure:

- author response rate;
- conversation continuation;
- InteractionYield;
- relationship progression;
- target/class/topic diversity.

Do not create an automatic ban from a fixed number of unanswered interactions.

### Reply archetype / semantic repetition

Exact and near-duplicate replies are a content-quality/spam problem.

Repeated archetypes, question structures, or similar technical moves are weaker evidence and should begin as advisory diagnostics. Measure whether they reduce target response/continuation before turning them into stronger rules.

### Human-looking timing / jitter

Do not model circadian gaps, random jitter, typing delays, or browser timing patterns as growth requirements. They are not part of the account's coverage optimization objective.

### First 30-60 minutes

Treat early momentum as a high-priority hypothesis, not a universal cliff.

Measure first-hour velocity and conversation outcomes rather than deleting/reposting weak items automatically.

### First 1,000 bootstrap distribution thresholds

**Status:** `EMPIRICAL_VARIABLE` — soft-tuned 2026-09-01

Code `strategy.js:579` / `pipeline.js:135` now use `freshness>=8` (was `10`), `conversationPotential>=35` (was `40`), `reachPotential>=45` (was `50`), `momentum>=8` (was `10`), `traction>=6` (was `8`) for bootstrap `Reply`/`Quote`/`Repost`. `FIRST_1000_GROWTH_MODE.md:165` documents the current values. Treat them as experimentable heuristics to be revised from `editorialOutcomes`/`experiment-summary` at matched window age, not `CODE_BACKED` X laws.

---

## 6. RETIRED claims

### Raw weight equivalences

Examples:

```text
1 reply = 10 likes
1 copy-link = 40 likes
1 report cancels N likes
```

**Status:** `RETIRED`

Reason:

Current repository explicitly states that weights scale predicted probabilities/continuous values, not raw observed counts.

### Author diversity = time decay

**Status:** `RETIRED`

Reason:

Author-diversity attenuation and time freshness are separate mechanisms. A decay value of `0.5` is not evidence that a post loses 50% every six hours.

### Fixed negative-action count equivalences

Examples:

```text
1 report cancels 468 likes
1 block cancels N likes
```

**Status:** `RETIRED`

Reason:

Current repository comments explicitly explain that these weights multiply viewer-specific predicted probabilities, not raw global action counts. Current default values can also change independently of older screenshots/docs.

### Large accounts are always best reply targets

**Status:** `RETIRED`

Reason:

Targeting must consider topic fit, audience overlap, conversation quality, reply visibility, and relationship potential. Large generic accounts can be inferior to smaller dense technical communities.

### Native payout thresholds as strategic milestones

**Status:** `RETIRED`

Reason:

Creator monetization products can change. Native payout eligibility should not determine the account's content/network architecture.

The system should optimize qualified technical audience density; monetization rules are refreshed only when a monetization decision actually depends on them.

---

## 7. Strategy derived from the ledger

The strongest current code-backed strategic loop is:

```text
relevant viewer history / topical retrieval
-> candidate ranking predicts many actions
-> repeated-author and OON mechanics affect distribution
-> useful conversation can create profile/follow relationships
-> relevant follows move future posts into an in-network context
-> mutual relationships can receive an explicit original-post reply-head boost
-> owned technical content converts relationship exposure into durable audience
```

Therefore the system should optimize **network topology + content utility + predicted multi-action plausibility**, not a single engagement counter.

The August 2026 labeling/visibility release adds one more operating rule:

> **Use observable account/post visibility evidence for hard account-health constraints; keep reply volume, saturation, repetition, target size, and timing as empirical variables unless evidence graduates them.**

---

## 8. Implementation rule

Every future strategy feature must point to one of:

```text
CODE_BACKED:<source path>
OFFICIAL_PRODUCT_OR_POLICY:<source>
EMPIRICAL_VARIABLE:<experiment id or planned experiment>
```

If no evidence class can be assigned, the feature is a speculative idea and must not silently become a scheduler/targeting invariant.

When public code changes, update this ledger first, then decide whether the implementation plan must change.
