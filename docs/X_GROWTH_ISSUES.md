# X Growth Issue Inventory

**Date:** 2026-08-29

**Status:** historical issue inventory from the earlier bootstrap phase. Revalidate every still-open item against the current Growth Operator/persona/runtime before treating it as active.

This document records the X growth problems observed at that 2026-08-29 checkpoint. It separates observed defects from strategic hypotheses so later implementation does not turn a plausible idea into a production rule without evidence.

This is not an implementation plan. Each issue should be fixed only after its owner and acceptance condition are confirmed against current runtime state.

## Priority summary

| ID | Issue | Class | Priority |
| --- | --- | --- | --- |
| XG-01 | Editorial can select work the distribution owner will reject | observed defect | P1 |
| XG-02 | Follower conversion attribution is incomplete and inconsistently observable | observed gap | P0 |
| XG-03 | Hook experiment exists but lacks enough formal samples | observed gap | P0 |
| XG-04 | Owned technical proof is underrepresented relative to commentary | strategic hypothesis | P1 |
| XG-05 | Hook experiments optimize attention more clearly than follow intent | strategic hypothesis | P1 |
| XG-06 | Writer/reply voice can drift into lecturer mode | observed quality failure | P1 |
| XG-07 | Source selection can spend expensive reasoning on weak distribution objects | observed efficiency problem | P1 |
| XG-08 | Engagement volume can outrun relationship value | observed operating risk | P1 |
| XG-09 | Late or collapsed measurement windows weaken experiment interpretation | observed measurement problem | P0 |
| XG-10 | Live autonomous replies use the configured transport boundary | resolved implementation constraint | P1 |
| XG-11 | Bootstrap distribution surface is not sufficiently tested | observed strategic gap | P0 |
| XG-12 | Growth Focus and understandability gates can collapse development into AI-heavy, hard-to-follow output | observed defect | P0 |

## XG-01 — Editorial can select work the distribution owner will reject

**Class:** observed defect  
**Priority:** P1  
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
- The operator has to reason about two conflicting recommendation systems.

The `cdb2f86` mitigation removed the production-deadlock consequence, so this is now an efficiency/selection defect rather than a current P0 throughput blocker.

### Desired condition

Editorial and live distribution may still disagree, but the disagreement must be explicit before expensive preparation becomes the chosen production path. An unroutable source must not occupy the effective top production slot.

---

## XG-02 — Follower conversion attribution is incomplete and inconsistently observable

**Class:** observed gap  
**Priority:** P0  
**Primary owner:** account analytics ingestion + Growth OS measurement/learning path.

### Problem

The mission objective is qualified follower growth. Growth OS already stores profile visits, new follows, publication follower baselines, follower deltas, and `associated_follows_per_1000_views`, but those later-funnel signals are not consistently available or attributable to a specific output.

The useful funnel is:

`impressions -> engagement -> profile visits -> new follows -> qualified follower / relationship outcome`

The gap is therefore not absence of follower-conversion machinery. It is incomplete observation and weak attribution, especially when account-level follower changes cannot be tied confidently to one post.

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

For important recent outputs and active experiments, Growth OS should compare matched-age impressions, engagements, profile visits, and follows without treating missing analytics fields as zero. It should distinguish account-level follower delta from post-attributed follows and, where audience observation supports it, record whether new followers are qualified for the target niche.

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

Collect 3–5 completed formal posts per treatment at matched 60m, 360m, and 1440m windows before making an initial directional production adjustment. Do not name or promote a winner from this sample: assignments are caller-selected and the posts remain observationally confounded. The experiment engine's 20-completed-per-variant threshold remains the bar for repeated observational evidence, still not causal proof. If the 3–5-post read is mixed, continue balanced exploration.

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

Owned proof should remain a distinct content treatment from externally anchored commentary.

### Desired condition

The main-feed mix contains enough verified owned technical evidence to compare its profile-visit and follow conversion against externally anchored commentary at similar account stage and post age.

---

## XG-05 — Hook experiments optimize attention more clearly than follow intent

**Class:** strategic hypothesis  
**Priority:** P1  
**Primary owner:** Writer strategy / experiment design.

### Problem

The current hook system is good at defining psychological pull: insider contrast, hidden constraint, decision test, concrete consequence, or sharp question.

Those treatments are primarily designed to win the next few seconds of attention. They do not yet explicitly test whether the payoff makes the reader expect repeated future value from the account.

### Risk

Prefer specific account value and natural calls to action over generic copy templates.

### Desired condition

Future experiments can distinguish scroll-stopping performance from profile/follow conversion and determine whether some payoff structures create a stronger reason to inspect or follow the account.

---

## XG-06 — Writer/reply voice can drift into lecturer mode

**Class:** observed quality failure  
**Priority:** P1  
**Primary owner:** `docs/POST_GENERATION_PROMPT.md`; `x-content` account voice memory may reinforce the same contract but is not the repository source of truth.

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
- occasional tiny imperfections allowed when they arise naturally;
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

After a candidate is eligible to route, low-distribution sources should win expensive Editorial attention only when they offer unusually strong owned-proof value, primary evidence, or a durable Original that does not depend on borrowed distribution. Otherwise, source momentum should lower their effective production priority earlier.

This is distinct from XG-01: XG-01 is a contract disagreement about whether a candidate can route at all; XG-07 is ranking efficiency among candidates that can legitimately proceed.

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

Engagement decisions should favor repeated interaction with relevant builders, maintainers, researchers, and tool authors, and should evaluate author response, continuation, profile visits, follows, and relationship-stage movement rather than reply count alone. Engagement and publishing budgets are ceilings, not fill targets; weak opportunities can be skipped while capacity stays available for stronger targets.

---

## XG-09 — Late or collapsed measurement windows weaken experiment interpretation

**Class:** observed measurement problem  
**Priority:** P0  
**Primary owner:** publication measurement scheduling/capture.

### Problem

Some nominal 15m, 60m, and 360m publication windows were captured late or at the same actual timestamp after the service caught up.

For example, queue `3245` recorded multiple nominal windows from one late shared observation. The data is still useful as a descriptive snapshot, but those rows are not independent matched-age measurements.

### Impact

- A/B/C comparisons become less trustworthy when several nominal windows come from one actual observation.
- Repeated rows can look like a time series when they are one observation copied into several due windows.
- Experiment summaries currently count the presence of each nominal-window row as a completed observation even when several rows share one late capture.

`views_per_hour` itself already uses actual elapsed time from `capturedAt - publishedAt` when those timestamps are present, so the problem is not its denominator.

### Desired condition

Keep the existing actual capture timestamp, but classify capture lateness and collapsed observations explicitly. Matched-window experiment comparisons should use genuinely distinct age-appropriate observations where available and exclude or downgrade nominal windows satisfied by the same late capture.

## XG-10 — Live autonomous replies use the configured transport boundary

**Class:** resolved implementation constraint
**Priority:** P1  
**Primary owner:** autonomous reply transport / operator authority.

### Problem

The autonomous reply operator can continuously discover, score, draft, gate, deduplicate, claim, record, and send reply decisions through the configured Clearcote browser UI transport.

### Impact

- Dry run evaluates growth opportunities without sending.
- Live mode can execute eligible decisions while an explicit grant and budget remain active.
- Exact persisted text/provenance, deduplication, health checks, and atomic claims remain inspectable.

### Desired condition

Keep autonomous discovery, writing, quality gates, dedupe, Account Health checks, atomic claims, exact persisted text/provenance, explicit live budgets, and operator Start/Pause/Stop controls around the configured transport.

## XG-11 — Bootstrap distribution surface is not sufficiently tested

**Class:** observed strategic gap  
**Priority:** P0  
**Primary owner:** Editorial / experiment design / distribution strategy.

### Problem

At the current account size, format and distribution surface may affect reach more than fine-grained hook treatment. Existing First-1,000 observations already show large differences between standalone Originals and Quotes, but those samples are confounded by topic, timing, copy, momentum, and other variables.

Owned proof and borrowed distribution are separate decisions. A technically original contribution does not have to be published as a standalone Original; it can also be delivered through a high-momentum Quote or another borrowed-distribution surface.

### Evidence

`docs/FIRST_1000_GROWTH_MODE.md` records one standalone Original at roughly 2 impressions after about 32 minutes, another no-hashtag Original at 8 impressions / 1 engagement after roughly 14 hours, and a Quote at 67 impressions / 6 engagements / 3 detail expands after roughly 9 hours.

Those observations do not establish causality, but they are strong enough to make distribution surface an explicit production variable rather than assuming all formats provide comparable discovery.

### Impact

- Hook experiments can optimize copy inside a weak distribution surface.
- More owned technical proof can be misread as a reason to publish more standalone Originals even if borrowed distribution is currently more effective.
- Small-account reach can remain the binding constraint while the system spends effort tuning downstream copy variables.

### Desired condition

Run explicit matched-age comparisons across distribution surfaces such as Original, Quote, and other eligible main-feed formats. Track reach, profile visits, follows, and qualified-follower outcomes separately from hook treatment. Do not promote a preferred surface from isolated posts; require repeated directional evidence under reasonably comparable conditions.

## XG-12 — Growth Focus and understandability gates can collapse development into AI-heavy, hard-to-follow output

**Class:** observed defect
**Priority:** P0
**Primary owner:** Growth Focus profile/taxonomy, X discovery query construction, operator candidate ordering, deterministic drafting gates, and outbound browser mutation boundary.

### Problem

The intended niche is software development and building, with AI-assisted development as one important pillar. The production path can instead converge on AI-heavy content and still approve copy that a normal software developer has to decode.

The defect is a chain rather than one bad prompt:

- Growth Focus stores editable terms but `setActiveNicheProfile()` rebuilds the profile from a fixed default group list, so categories cannot actually be added or removed;
- content classification is narrower than audience classification, so ordinary JavaScript, React, Rust, frontend, and backend content can score zero while AI-agent/model content matches multiple weighted groups;
- X search queries are maintained separately from Growth Focus and the fast momentum path takes the first two fixed query buckets, which are AI-heavy;
- `growth-next` ranks momentum/reach without a configurable recent-topic balance term;
- deterministic `scannability` checks layout rather than one-pass comprehension, so jargon-heavy copy can pass;
- repository browser transports are quality-gated when entered through queue/reply workflows, but an operator can still compose freehand in an authenticated browser unless the governing workflow explicitly forbids that bypass.

### Evidence

Representative current classifier probes before this repair:

- `JavaScript performance tips for the browser` -> score `0`;
- `React 20 improves frontend rendering` -> score `0`;
- `Rust makes this backend service faster` -> score `0`;
- `Node.js API with Fastify` -> score `16`;
- `Python FastAPI backend` -> score `16`;
- `Claude Code with Qwen for coding agents` -> score `34`.

A shortened version of the rejected Vercel reply remained `44/50`, `strong`, and publishable under the existing deterministic gate once unrelated length/current-classification blockers were removed. The gate therefore did not encode the human requirement that a competent general software developer should understand the point on one pass.

### Impact

- Topic selection can recursively train itself toward AI because discovery, saved preferences, and source momentum all see the same skewed pool.
- The account can describe itself as a developer account while ordinary development topics are under-discovered or classified outside focus.
- A technically correct post can still reduce follow conversion because the reader has to translate internal engineering vocabulary before receiving the payoff.
- Prompt-only voice corrections are not reliable because the transport/operator can bypass them.

### Desired condition

Growth Focus is the single configurable preference/scope source of truth. Content groups can be added, removed, renamed, reweighted, and assigned a target share without code changes; audience groups define a broader technical universe for open-world exploration. Registered topics receive preference, but an unregistered technical topic may still enter discovery and compete on momentum without first becoming a permanent niche. Discovery queries are derived from both configured preferred groups and the configurable broader technical scope rather than a fixed AI-first list. Candidate ordering exposes a bounded topic-balance adjustment instead of silently repeating the dominant category.

Every authored outbound item must also pass an understandability gate that is separate from visual scannability. This gate does not require a plain or neutral voice; humor, technical language, attitude, and stylistic variation are allowed when the point still lands on one read. Repository-owned browser transports may only send text carrying current approval/gate provenance, and the live operator must not type freehand authored copy directly into X.

## Dependency order

The issues should not be attacked as one refactor. The current dependency order is:

1. XG-12 — restore configurable topic ownership and comprehension as preconditions for every subsequent content experiment.
2. XG-02 and XG-09 — make the mission reward and measurement windows trustworthy.
3. XG-11 — learn which distribution surfaces can reliably earn bootstrap reach and conversion.
4. XG-03 — collect enough formal A/B/C evidence to change writing decisions inside those surfaces.
5. XG-01 and XG-07 — remove avoidable Editorial/distribution disagreement and wasted candidate reasoning.
6. XG-04 and XG-05 — test owned proof and follow-conversion payoff as content hypotheses without conflating proof ownership with distribution surface.
7. XG-06 — keep the explicit human voice constraint intact throughout all experiments.
8. XG-08 — optimize engagement for relationship outcomes rather than volume.
9. XG-10 — use the configured autonomous reply transport under the explicit grant and budget.

This order is a triage view, not authorization to implement all items.

## Current non-issues

Do not reopen these without new evidence:

- Clearcote browser publication plumbing simply because growth is slow;
- mission-agent approval snapshots;
- the A/B/C hook assignment gate;
- the recent conversational-voice correction.

Those mechanisms may need future work, but the current growth bottleneck is not established to be in those owners.
