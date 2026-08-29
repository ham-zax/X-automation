# X Growth Issue Inventory

**Date:** 2026-08-29

**Status:** active issue inventory for the First-1,000 mission.

This document records the current X growth problems before more growth-system changes are made. It separates observed defects from strategic hypotheses so later implementation does not turn a plausible idea into a production rule without evidence.

This is not an implementation plan. Each issue should be fixed only after its owner and acceptance condition are confirmed against current runtime state.

## Priority summary

| ID | Issue | Class | Priority |
| --- | --- | --- | --- |
| XG-01 | Editorial can select work the distribution owner will reject | observed defect | P0 |
| XG-02 | Measurement is stronger on engagement than follower conversion | observed gap | P0 |
| XG-03 | Hook experiment exists but lacks enough formal samples | observed gap | P0 |
| XG-04 | Owned technical proof is underrepresented relative to commentary | strategic hypothesis | P1 |
| XG-05 | Hooks optimize attention more clearly than follow intent | strategic hypothesis | P1 |
| XG-06 | Writer/reply voice can drift into lecturer mode | observed quality failure | P1 |
| XG-07 | Source selection can spend expensive reasoning on weak distribution objects | observed efficiency problem | P1 |
| XG-08 | Engagement volume can outrun relationship value | observed operating risk | P1 |
| XG-09 | Late or collapsed measurement windows weaken experiment interpretation | observed measurement problem | P1 |

## XG-01 — Editorial can select work the distribution owner will reject

**Class:** observed defect  
**Priority:** P0  
**Primary owner:** `editorial.js` / autonomous main-feed selection boundary; live distribution recommendation remains owned by `pipeline.js` / strategy scoring.

### Problem

Editorial can produce a high-ranked `PREPARE` recommendation for a source that the live distribution owner currently recommends `Ignore`.

The concrete failure occurred with the Xcode/headless-MCP recommendation. Editorial marked it `PREPARE`, but `routeCandidate()` refreshed the live recommendation and correctly rejected the mission-agent route with:

`This opportunity is currently recommended Ignore. Choose “Use anyway” and provide a reason before routing it into authored or repost work.`

Before commit `cdb2f86`, that one stale `PREPARE` recommendation could block the whole autonomous Writer cycle.

### Current mitigation

Commit `cdb2f86` makes autonomous preparation skip a `PREPARE` recommendation when mission routing rejects it specifically because the current recommendation is `Ignore`, then try the next candidate. It does not grant `Use anyway` authority.

This prevents a dead-end recommendation from blocking all preparation, but it does not remove the upstream disagreement.

### Impact

- Editorial spends reasoning and research budget on work that cannot enter production.
- A high-ranked but unroutable recommendation can displace stronger candidates during selection.
- Writer throughput falls even when fresh sources exist.
- The operator has to reason about two conflicting recommendation systems.

### Desired condition

Editorial and live distribution may still disagree, but the disagreement must be explicit before expensive preparation becomes the chosen production path. An unroutable source must not occupy the effective top production slot.

---

## XG-02 — Measurement is stronger on engagement than follower conversion

**Class:** observed gap  
**Priority:** P0  
**Primary owner:** account analytics ingestion + Growth OS measurement/learning path.

### Problem

The mission objective is qualified follower growth, but the easiest currently available measurements are often views, likes, replies, reposts, and derived engagement density.

The useful funnel is:

`impressions -> engagement -> profile visits -> new follows -> qualified follower / relationship outcome`

The later stages are not captured consistently enough to evaluate every important post on the mission objective.

### Evidence

Recent decisions have had to rely on observations such as:

- views;
- likes;
- visible engagement per 1,000 views;
- associated follower snapshots.

Those signals can distinguish a dead post from an engaging post, but they do not reliably distinguish high-reach content from content that causes people to inspect and follow the account.

### Impact

- The system can optimize a proxy while missing follower conversion.
- A high-impression post can look successful even if it produces no profile visits or follows.
- A lower-reach post with strong follow conversion can be undervalued.
- Learned Strategy cannot confidently optimize the mission reward hierarchy.

### Desired condition

For important recent outputs and active experiments, Growth OS should be able to compare matched-age observations across impressions, engagements, profile visits, and new follows without treating missing analytics fields as zero.

---

## XG-03 — Hook experiment exists but lacks enough formal samples

**Class:** observed gap  
**Priority:** P0  
**Primary owner:** experiment assignment + main-feed production cadence + measurement.

### Problem

Experiment 2, `First-1,000 audience psychology hooks A/B/C`, is active and production-gated, but the formal Experiment-2 sample is still too small to support a treatment decision.

Variants are:

- A — insider contrast;
- B — hidden constraint;
- C — decision test.

The intended initial exploration is balanced rather than winner-take-all.

### Evidence

Bridge-cohort observations exist, but they are not formal Experiment-2 evidence:

- queue `3276`, A-like GitHub Copilot Quote: about 19 views and 0 visible actions by its stored 360-minute row;
- queue `3245`, C-like Unsloth GLM-5.3 Quote: 32 views and 2 likes in a late shared capture, about 62.5 visible engagements per 1,000 views;
- queue `3223`, B-like agent-extension Thread: published and reconciled, with measurement lag observed during the operating session.

These posts differ in source, format, timing, hashtag treatment, and measurement quality. They cannot identify a winning hook treatment.

### Impact

- A/B/C exists as production machinery without yet producing the evidence needed to tune production.
- One interesting result can be mistaken for a winner.
- The system can accumulate experiment complexity without changing decisions.

### Desired condition

Reach at least two completed formal posts per treatment and compare them at matched 60m, 360m, and 1440m windows before promoting a winner. If evidence remains mixed, continue balanced exploration.

---

## XG-04 — Owned technical proof is underrepresented relative to commentary

**Class:** strategic hypothesis  
**Priority:** P1  
**Primary owner:** Editorial / Research Agenda / content strategy.

### Problem

A large share of candidate activity comes from reacting to external AI/model/tool news through Quotes and Replies. This can borrow distribution, but it may not create enough account-specific reason to follow `@ham_zax`.

The hypothesis is that more owned proof would improve qualified follow conversion: real experiments, implementation findings, architecture observations, benchmarks we actually ran, failure modes we reproduced, repository findings, or compact technical artifacts.

This is not yet established as a performance law.

### Why it matters

A reader can agree with a commentary post and still have no reason to follow the author. Owned proof can demonstrate a repeatable capability or perspective that is specific to the account.

### Risk

Do not turn this into tutorial production or fake first-person evidence. Owned proof must come from work that actually happened and can be supported.

### Desired condition

The main-feed mix contains enough verified owned technical evidence to compare its profile-visit and follow conversion against externally anchored commentary at similar account stage and post age.

---

## XG-05 — Hooks optimize attention more clearly than follow intent

**Class:** strategic hypothesis  
**Priority:** P1  
**Primary owner:** Writer strategy / experiment design.

### Problem

The current hook system is good at defining psychological pull: insider contrast, hidden constraint, decision test, concrete consequence, or sharp question.

Those treatments are primarily designed to win the next few seconds of attention. They do not yet explicitly test whether the payoff makes the reader expect repeated future value from the account.

### Risk

Do not add explicit engagement bait, fake scarcity, or lines such as “follow for more.” The desired effect is inferred account value, not a call-to-action template.

### Desired condition

Future experiments can distinguish scroll-stopping performance from profile/follow conversion and determine whether some payoff structures create a stronger reason to inspect or follow the account.

---

## XG-06 — Writer/reply voice can drift into lecturer mode

**Class:** observed quality failure  
**Priority:** P1  
**Primary owner:** `docs/POST_GENERATION_PROMPT.md` + `x-content` account voice memory.

### Problem

Several replies and draft directions drifted toward mini-essays: polished explanations, packaged takeaways, and advice to “developers” rather than participation in the actual conversation.

The user explicitly rejected this style.

### Current direction

The standing voice is builder-to-builder:

- conversational;
- shorter;
- lowercase when natural;
- contractions and fragments allowed;
- casual punctuation and shorthand allowed when natural;
- occasional tiny imperfections allowed, but never manufactured on a quota;
- curiosity, reaction, disagreement, or a specific observation before explanation.

Commit `6a630f2` made the autonomous Writer prompt more conversational, and the private X-content voice memory was updated in the same operating session.

### Impact

Lecturer copy can make the account sound generic, over-produced, and socially detached from the thread. It also creates repeated structural patterns that are easy to notice across posts.

### Desired condition

Main-feed posts still carry a clear thesis and evidence, but replies and short-form observations read like a builder participating in X rather than publishing a lesson plan.

---

## XG-07 — Source selection can spend expensive reasoning on weak distribution objects

**Class:** observed efficiency problem  
**Priority:** P1  
**Primary owner:** discovery ranking + Editorial candidate selection.

### Problem

Technically interesting, very fresh sources can enter expensive Editorial analysis even when their live distribution is tiny and there is no exceptional owned contribution that justifies ignoring that weakness.

The Xcode/headless-MCP source was the clearest example: the topic was highly relevant and novel, but the source had only about 11 visible views when inspected. The live distribution layer therefore rejected it.

### Impact

- AI/editorial cycles are spent on low-leverage objects.
- Stronger current sources can wait behind novelty-heavy weak-distribution candidates.
- The operator spends time verifying and researching stories that will not route.

### Desired condition

Low-distribution sources should win expensive Editorial attention only when they offer unusually strong owned-proof value, primary evidence, or a durable Original that does not depend on borrowed distribution. Otherwise, source momentum and routability should lower their effective production priority earlier.

---

## XG-08 — Engagement volume can outrun relationship value

**Class:** observed operating risk  
**Priority:** P1  
**Primary owner:** Engage Next / Relationship Intelligence / operator policy.

### Problem

A numeric engagement budget can encourage the system to keep finding another reply after the useful conversation seam is already weak.

During the expanded run, the operator encountered cases where a candidate technically remained available but was not worth forcing. The better behavior was to skip weak opportunities and wait for a thread where the account had a distinct question or observation.

Account Health was also in `WATCH` with weak author-response / conversation-continuation signals during the operating period.

### Impact

- More replies do not necessarily create more relationships.
- Repetitive reply structure can increase.
- Low-value interactions consume operator attention that could go to owned content or stronger targets.

### Desired condition

Engagement decisions should favor repeated interaction with relevant builders, maintainers, researchers, and tool authors, and should evaluate author response, continuation, profile visits, follows, and relationship-stage movement rather than reply count alone.

---

## XG-09 — Late or collapsed measurement windows weaken experiment interpretation

**Class:** observed measurement problem  
**Priority:** P1  
**Primary owner:** publication measurement scheduling/capture.

### Problem

Some nominal 15m, 60m, and 360m publication windows were captured late or at the same actual timestamp after the service caught up.

For example, queue `3245` recorded multiple nominal windows from one late shared observation. The data is still useful as a descriptive snapshot, but those rows are not independent matched-age measurements.

### Impact

- Views/hour can be misleading when the actual capture age differs from the nominal window.
- A/B/C comparisons become less trustworthy.
- Repeated rows can look like a time series when they are one observation copied into several due windows.

### Desired condition

Measurement records must preserve actual capture time and make late/collapsed windows explicit. Experiment comparison should use real matched-age observations where available and downgrade evidence quality when windows were missed.

## Dependency order

The issues should not be attacked as one refactor. The current dependency order is:

1. XG-01 — stop Editorial/distribution disagreement from wasting production selection.
2. XG-02 and XG-09 — make the mission reward and measurement windows trustworthy.
3. XG-03 — collect enough formal A/B/C evidence to change writing decisions.
4. XG-04 and XG-05 — test owned proof and follow-conversion payoff as content hypotheses.
5. XG-06 — keep the explicit human voice constraint intact throughout all experiments.
6. XG-07 — reduce wasted candidate reasoning after the production and measurement contracts are stable.
7. XG-08 — optimize engagement for relationship outcomes rather than volume.

This order is a triage view, not authorization to implement all items.

## Current non-issues

Do not reopen these without new evidence:

- Clearcote browser publication plumbing simply because growth is slow;
- the 20-authored-post hard cap;
- mission-agent approval snapshots;
- the A/B/C hook assignment gate;
- the explicit prohibition on fabricated exclusivity;
- the recent conversational-voice correction.

Those mechanisms may need future work, but the current growth bottleneck is not established to be in those owners.
