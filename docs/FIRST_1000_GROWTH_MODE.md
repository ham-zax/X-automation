# First 1,000 Followers Growth Mode

**Status:** implemented bootstrap policy, effective 2026-08-24.

This mode governs `@ham_zax` until the account reaches 1,000 followers or the operator explicitly ends it. When this document conflicts with the normal conservative distribution heuristics in `GROWTH_DISTRIBUTION_PLAYBOOK.md`, this document wins for the bootstrap phase.

The goal is not to maximize low-quality follower count at any cost. The goal is to maximize **relevant distribution surface area and follower-acquisition velocity** while the account has almost no native distribution.

## Current account stage

The 2026-08-19 playbook snapshot recorded 41 followers and zero strongly niche-aligned followers at the current profile-classification threshold. On 2026-08-24 the live account showed 42 followers; the operator reports that only one newly gained follower is clearly from the target niche.

That is a cold-start account. At this size, waiting for a perfect original thesis before participating in a live AI/developer conversation has a large opportunity cost. The account needs repeated presence in the market while topics are moving, not day-long research on every individual tweet.

## Bottleneck that triggered this mode

Before the 2026-08-24 runtime repair, the route recommender was structurally biased toward `Ignore` for cold high-momentum sources.

`opportunity.js:scoreOpportunity()` computes four independent potentials, including `reachPotential`. Momentum, freshness, traction, and topic breadth can therefore produce a strong reach score.

`strategy.js:recommendDistributionAction()` does not use `reachPotential` or `followPotential` to choose a route. Its effective decision tree is:

1. Ignore an already-used candidate.
2. Ignore an unknown or disallowed Growth Focus candidate.
3. Choose Direct only when caller context says the insight is standalone, our experiment, or multi-source.
4. Choose Reply only when `canAddReplyValue && relationshipValue`.
5. Choose Quote only when `addsMaterialValue && sourceIsEvidence`.
6. Choose Repost only when `amplificationOnly` is already true and the candidate viral/score value is at least 70.
7. Otherwise return `Ignore` with `No sufficiently additive distribution action yet; research it or wait for a stronger angle.`

`pipeline.js:recommendationContext()` derives Reply eligibility from `conversationPotential >= 50` plus nonzero relationship potential, and requires `relationshipPotential >= 20` for `relationshipValue`. A cold account often has no stored relationship with the author, so a viral relevant post can have high reach and still fail the Reply branch.

The Quote and Repost branches had a similar problem: momentum alone did not set `addsMaterialValue`, `sourceIsEvidence`, or `amplificationOnly`. Unless another caller explicitly supplied those flags, a high-momentum X source fell through to Ignore.

The queue then makes the conservative recommendation operational. `pipeline.js:routeCandidate()` refreshes the recommendation before routing. When the refreshed recommendation is `ignore`, authored routes and Repost require a current explicit human `Use anyway` decision. In the 2026-08-24 local browser run, clicking `Start reply draft` on one of these candidates produced a `400` response from `/api/discover/triage` because that endpoint reaches the same `routeCandidate()` Ignore gate. The HTTP error was therefore a visible consequence of the routing defect, not a separate `Use anyway` wiring failure.

The strict behavior was understandable in the 2026-08-21 recovery wave: the failed pilot had produced a weak post despite a high writing score, and the recovery mission explicitly said not to manufacture outbound items merely to consume authorization. That recovery constraint should not silently become the long-term acquisition strategy for a 42-follower account.

Changing only the Growth Focus objective to `reach_momentum` is not enough. The editorial layer gives Reach more weight under that objective, but `assessStrategicRelevance()` does not change the route branches above, and the source-level distribution recommender still falls back to Ignore unless its action-specific context flags pass.

## Bootstrap objective

Until 1,000 followers, use this priority:

> **Niche floor -> momentum -> speed -> useful contribution -> deeper authority.**

A source must still be relevant to the AI/developer target audience. Once that floor is met, current momentum and shelf life should matter much more than existing relationship history or whether we can produce a research-grade thesis.

Silence is not neutral at this stage. Missing a live distribution window means losing one of the few ways a cold account can appear around conversations that already have attention.

## Fast action policy

For a fresh, niche-relevant, high-momentum X source, choose the fastest honest action that gets the account into the conversation.

For the agent-operable version of this loop, use `GROWTH_OS_MOMENTUM_OPERATOR.md` and `npm run agent -- growth-next`. It joins X Latest, X Momentum, opportunity scores, source observations, route leverage, and source-style shape into one read-only next-action packet before the live X verification step.

### Repost

During First 1,000 mode, plain reposts are **not exceptional**.

Repost when:

- the source is relevant and already useful on its own;
- the information is time-sensitive or visibly gaining momentum;
- amplification is enough value for the current moment;
- we do not have a distinct angle ready immediately;
- the source has not already been used by this account.

Do not hold a breaking source for hours merely because a Quote would theoretically be better. If the source is clear and the low-risk action is amplification, amplify it while it is current.

### Quote

Quote when a distinct angle is available quickly.

The standard is not a miniature essay. One concrete implication, comparison, caveat, field observation, or useful question is enough when the source carries the factual context.

Prefer short, scannable copy that can be read line by line. The current Viral Styles evidence supports short observations directionally; recent high-performing AI/dev posts also commonly use short first lines and spaced visual beats.

### Reply

Reply to relevant high-momentum conversations even when the author has no prior relationship profile.

Existing `relationshipPotential = 0` should not be an admission gate in this bootstrap phase. A cold account needs to create relationships before it can benefit from relationship history.

The reply still needs one real contribution: an observed result, implementation note, comparison, correction, specific reaction, or genuine question. It does not need to justify a day of research.

### Original

Keep publishing originals because borrowed distribution alone cannot build the whole account.

Current code-backed algorithm evidence in `CONTENT_OPERATING_STANDARD.md` says out-of-network replies and reposts are filtered from the normal For You candidate path. Originals therefore remain important for discovery and profile conversion even during an aggressive momentum phase.

Use originals to turn the strongest live themes into account-owned observations, field notes, short takes, useful lists, and tested conclusions. The profile should show enough original proof that a person who discovers `@ham_zax` through a Reply, Quote, or Repost has a reason to follow.

## Do not make Repost the whole strategy

The aggressive policy is **fast participation**, not Repost-only growth.

Use the formats for different jobs:

- **Repost:** immediate presence and amplification when commentary would slow the action down.
- **Quote:** borrowed source context plus a visible account thesis.
- **Reply:** insert into an active conversation and create new relationships.
- **Original:** out-of-network discovery, profile proof, and durable account identity.

The useful bootstrap mix is therefore more surface area across all four formats, not endless plain reposting.

## Research depth should match claim risk

Do not apply one research standard to every outbound action.

For amplification of a clear primary-source announcement, read the source, confirm it is current, and act. Do not build a research report before reposting it.

For a short Quote or Reply that makes a modest inference from the source, check enough surrounding context to avoid misreading the post, then publish the concise contribution.

For benchmarks, security claims, accusations, legal claims, pricing claims, or other assertions where being wrong would materially damage trust, verify the claim or remove it. First 1,000 mode reduces unnecessary research latency; it does not authorize fabrication.

## What should still be skipped

Skip when:

- the source is outside the active niche;
- it is stale relative to the live conversation;
- the candidate has already been used without a genuinely new reason;
- the source is dubious and the claim cannot be checked quickly enough for the intended action;
- the proposed copy is a near-duplicate of recent account output;
- the action would add no market presence because the source itself has no meaningful current distribution or relevance.

`No sufficiently additive distribution action yet` is **not**, by itself, a valid bootstrap reason to skip a fresh high-momentum niche source. Amplification, timely participation, and conversation insertion can themselves be the value at this account stage.

## Cadence

First 1,000 mode is event-driven, not quota-driven.

Do not impose `plain reposts: exceptional`, `0-1 quote/day`, or a fixed cold-reply ceiling as strategic rules during this phase. If several distinct relevant stories break in the same day, participate in several distinct stories.

Do not invent fake-human timing or random jitter. `ALGORITHM_EVIDENCE_LEDGER.md` already classifies exact posting gaps and first-hour timing as empirical variables rather than established universal rules.

Use freshness and observed source movement as decision inputs. A source that is gaining views, likes, reposts, or replies quickly deserves faster consideration than an equally relevant static source.

## Measurement

The first 1,000 phase should answer one practical question: which kinds of participation convert attention into followers for this account?

A 2026-08-25 live check strengthened the need to separate owned-only and borrowed distribution. One standalone Original showed 2 impressions and zero engagements after roughly 32 minutes; another no-hashtag standalone Original showed 8 impressions / 1 engagement after roughly 14 hours; a Quote showed 67 impressions / 6 engagements / 3 detail expands after roughly 9 hours. These samples are observational and heavily confounded, but they are sufficient to make distribution surface an explicit operating variable rather than treating all formats as equivalent.

Track separately by Original, Quote, Reply, and Repost:

- views/reach where observable;
- replies and reposts;
- profile/follow activity where observable;
- account follower delta in fixed windows with attribution caveats;
- newly observed niche-aligned followers;
- recurring author/relationship responses;
- source momentum at action time.

Do not treat one post as causal proof. Use repeated outcomes to decide which bootstrap actions deserve more volume.

## Runtime implementation

The 2026-08-24 repair implements this policy in the source-routing path.

`pipeline.js:recommendationContext()` reads the latest stored account follower snapshot. When it is below 1,000, it passes the account stage and the real opportunity-score breakdown into `strategy.js:recommendDistributionAction()`.

Current bootstrap heuristics are deliberately explicit and empirical:

- a cold Reply may qualify without relationship history when the X source is at most 24 hours old (`freshness >= 10`) and `conversationPotential >= 40`;
- a quick Quote may use a distinct concise contribution without the normal `sourceIsEvidence` requirement while that same freshness condition holds;
- a momentum-only Repost may qualify when `reachPotential >= 50`, freshness is at least `10`, momentum is at least `10`, and traction is at least `8`;
- at 1,000 followers, the normal conservative recommendation behavior resumes;
- already-used candidates, stale low-value sources, and candidates outside Growth Focus remain skippable;
- factuality, duplicate prevention, review/approval, and publication authority are unchanged;
- the explicit human `Use anyway` override remains available for genuinely ignored candidates.

These numeric thresholds are bootstrap heuristics, not claimed X platform laws. They should be revised from observed account outcomes, not folklore.

## Exit condition

At 1,000 followers, reassess rather than automatically preserving the same volume policy.

The likely next mode is the normal `qualified_growth` strategy: rarer plain reposts, stronger additivity requirements, more account-owned research, and greater emphasis on follower quality, recurring relationships, and durable technical authority.

The point of First 1,000 mode is to build enough distribution and audience signal that the system can afford to become more selective later.
