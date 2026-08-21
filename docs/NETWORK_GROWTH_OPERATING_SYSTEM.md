# Network Growth Operating System

This document is the strategic source of truth for how `@ham_zax` should grow on X.

The system is not primarily a posting bot. It is a **human + AI network-construction system** that uses research, conversations, relationships, original technical content, and measurement to increase the probability that the right developers repeatedly encounter useful work from the account and choose to follow it.

The operating thesis is:

> **conversation insertion -> repeated interaction -> relationship -> profile conversion -> follow -> stronger future distribution -> owned-content conversion**

Publishing remains important, but it is one instrument inside this loop rather than the whole system.

---

## 1. Account objective

Primary objective:

> Build a dense audience of AI engineers, software developers, devtool maintainers, technical founders, builders, and technically credible practitioners who have a rational reason to follow `@ham_zax` for future utility.

The account promise remains:

> **I test the AI tools developers are talking about and explain what actually works, what breaks, why it matters, and whether it is worth changing your workflow.**

The account should optimize for:

1. qualified developer reach;
2. recurring technical conversations;
3. relationship formation with relevant people;
4. profile-to-follow conversion;
5. follower quality and audience density;
6. durable original technical assets;
7. useful downstream commercial density.

Raw likes are an intermediate observation, not the objective.

---

## 2. The four compounding assets

### 2.1 Conversation insertion

Enter already-distributed technical conversations when we have a real contribution.

Good contributions include:

- a benchmark;
- a reproduction result;
- a concrete edge case;
- a command or implementation detail;
- a technical correction;
- a useful comparison;
- an architectural consequence;
- an informed question whose answer improves our research.

The purpose is not to maximize reply count. The purpose is to place demonstrated competence inside relevant conversations that already contain the audience we want.

### 2.2 Relationship conversion

The system should remember who we interact with and whether those interactions become recurring.

Relationship value compounds when a target:

- responds to us;
- recognizes us across multiple conversations;
- follows us;
- repeatedly exchanges useful technical information with us;
- becomes a mutual follow naturally;
- quotes/reposts/references our work;
- becomes a source of future research or distribution.

The system should therefore optimize repeated high-quality interactions, not one-off reply impressions.

### 2.3 Owned-content conversion

Conversation visibility only creates opportunity. The profile must convert it.

When someone visits `@ham_zax`, recent originals should demonstrate:

- technical depth;
- experiments rather than summaries;
- useful judgment;
- a coherent AI-native developer identity;
- clear evidence that future posts will save research time.

Conversation topics and owned content should reinforce each other.

Example:

```text
reply about MCP failure
-> profile visit
-> pinned MCP debugging experiment
-> recent agent-memory benchmark
-> recent coding-model comparison
-> follow becomes rational
```

### 2.4 Multi-action probability optimization

The public X system predicts multiple possible viewer actions. Our content strategy should therefore avoid optimizing a single observed counter.

Instead ask:

- would a developer reply because they have something substantive to add?
- would they spend time reading the result?
- would they send it to another developer?
- would they visit the profile?
- would they follow because the account promise is reinforced?
- would the content avoid negative feedback from being misleading, repetitive, or irrelevant?

The strategic objective is to create information and relationships that make several valuable downstream actions plausible for the same viewer.

---

## 3. System architecture

```text
DISCOVERY
   |
   v
SIGNAL / TARGET / CONVERSATION
   |
   v
NETWORK + CONTENT SCORING
   |
   +---------------------------+
   |                           |
   v                           v
ENGAGEMENT LANE            OWNED-CONTENT LANE
   |                           |
   |                     PHASE-6 EDITORIAL PLAN
   |                    (current stories, evidence,
   |                     objective, format, provenance)
   |                           |
target selection            route selection
   |                           |
contribution idea           research / verify
   |                           |
reply draft                 angle / novelty
   |                           |
human review                writing / media
   |                           |
send / ignore               quality gate
   |                           |
conversation follow-up      human approval
   |                           |
relationship event          schedule / publish
   |                           |
   +-------------+-------------+
                 |
                 v
MEASUREMENT
                 |
                 v
RELATIONSHIP + FOLLOWER + CONTENT OUTCOMES
                 |
                 v
EXPERIMENT / LEARNING LAYER
                 |
                 v
BETTER TARGETS + BETTER CONTENT + BETTER TIMING
```

### Current implementation boundary

Phase 1A currently owns persistent workflow entry -> Triage -> Route -> Draft -> Needs Review -> explicit human approval. Bookmark/reference state is separate from workflow entry: starting work does not implicitly bookmark a source, and removing a bookmark does not erase workflow/action history. Phase 1B Relationship Intelligence is also current: `audience_profiles` remains raw observation, while strategic `relationship_profiles` plus append-only `relationship_events` own target classes, explainable TargetScore state, relationship stages, and durable interaction history. Relationship Intelligence is inspectable through the read-only Relationships dashboard and `relationship-targets` / `relationship-inspect` / `relationship-events` bridge commands.

Phase 1C Engage Next is current: bounded target timelines, Discover X observations, and observed replies/quotes feed `queue_items(lane=engagement, pipeline=reply)`; active conversations are prioritized before cold opportunities; every actionable item carries a concrete proposed contribution plus transparent EngagePriority/expiry state; and Phase-2 reply gates own draft quality. The human-reviewed path still uses exact human approval/send. Separately, autonomous replies are off by default and run only under an explicit persisted operator grant. The existing daemon continuously refreshes real X inputs and may process zero, one, or several independently eligible replies serially; live auto-send additionally requires recipient opt-in, a recorded clear/easy opt-out mechanism, recorded X AI-reply approval, remaining operator budget, Account Health/Growth Focus eligibility, and an atomic autonomous claim. Autonomous sends never set `humanApprovedAt`. Successful replies share candidate-action and relationship-event recording, while engagement items remain excluded from main-feed scheduling.

Phase 1D Account Health and Phase 3 main-feed scheduling/publication are current. Phase 4 is also current: published main-feed rows accumulate first-available 15m/1h/6h/24h measurements, audience observations preserve first-seen state, and declared content/timing/network experiments compare normalized observational cohorts with explicit assignment, attribution confidence, sample/confounder visibility, and health/network context. Phase 5 Learned Strategy is current: accepted rules make bounded transparent adjustments while suggestions remain inert until human acceptance.

Phase 6 is current runtime behavior. The AI Editorial Director sits above individual source routing: canonical X/GitHub/HN/conversation snapshots -> story clustering -> controlled evidence -> objective-aware Prepare/Research More/Skip recommendation -> explicit human selection -> existing writer/gates/approval/scheduler. Publication measurements preserve AI-recommended, human-selected, and final-published route separately so later cohort analysis remains observational rather than rewriting history. The shared AI runtime/provider layer lets the operator choose Direct API/OpenRouter/OpenAI-compatible/local, Codex, or supported installed AGY profiles without changing network, evidence, approval, or learning authority; absent OpenCode variants remain unavailable. See `PRODUCT_ARCHITECTURE.md`, `plans/AI_RUNTIME_PROVIDER_LAYER.md`, and `plans/PHASE_6_AI_EDITORIAL_DIRECTOR.md`.

---

## 4. Two operating lanes

### Main-feed lane

Contains:

- original posts;
- quote posts;
- threads;
- rare reposts.

Primary purpose:

- stranger discovery;
- profile proof;
- follow conversion;
- durable technical authority.

### Engagement lane

Contains:

- initial technical replies;
- follow-up responses;
- replies under our own posts;
- relationship-maintenance opportunities.

Primary purpose:

- conversation insertion;
- recurring recognition;
- relationship formation;
- relevant audience exposure.

These lanes share research and measurement, but they should not share the same queue semantics. Main-feed items require scheduling. Engagement items are primarily freshness- and conversation-driven.

---

## 5. Target-account classes

Every strategically relevant account may have one or more target classes.

### Distribution target

Definition:

An account whose conversations can expose our contribution to a substantial overlapping audience.

Signals:

- relevant audience;
- meaningful post velocity;
- healthy technical reply threads;
- high topic overlap;
- sufficient audience scale.

Follower count is secondary to audience overlap.

### Relationship target

Definition:

A peer builder, maintainer, engineer, researcher, or founder where repeated interaction is realistically possible.

Signals:

- regularly responds to knowledgeable commenters;
- posts about our core topics;
- similar scale or reachable social distance;
- recurring technical interests;
- useful mutual exchange is plausible.

This class is strategically important because recurring relationships can compound over time.

### Authority target

Definition:

A technically respected person or team whose engagement can provide credibility or valuable information.

The goal is not flattery. The goal is technically serious interaction.

### Customer-density target

Definition:

An account whose conversations contain many people likely to care about future developer products, consulting, infrastructure, AI implementation, or technical education.

Commercial relevance affects prioritization, not the wording of the reply. Public interactions remain useful on their own terms.

### Source target

Definition:

An account that reliably produces high-value primary-source or early technical information even when relationship/distribution value is modest.

This class improves discovery quality.

---

## 6. TargetScore

Account targeting should not be driven by follower count.

Use a transparent component model:

```text
TopicFit
AudienceOverlap
ConversationQuality
ReplyVisibility
RelationshipPotential
```

All components are normalized 0-100.

The recommended aggregate is a weighted geometric mean so a very weak component meaningfully reduces the result:

```text
TargetScore = 100 * exp(
  0.30 * ln(max(TopicFit, 10) / 100)
+ 0.25 * ln(max(AudienceOverlap, 10) / 100)
+ 0.20 * ln(max(ConversationQuality, 10) / 100)
+ 0.10 * ln(max(ReplyVisibility, 10) / 100)
+ 0.15 * ln(max(RelationshipPotential, 10) / 100)
)
```

Then apply only a modest reach modifier:

```text
ReachModifier = -5 .. +5
FinalTargetScore = clamp(TargetScore + ReachModifier, 0, 100)
```

Follower count may inform `ReachModifier`, but must never dominate the target decision.

### Component meaning

**TopicFit**

How closely the account's recurring content matches our core research agenda.

**AudienceOverlap**

How likely their audience contains developers/builders we want.

Use signals such as:

- bio/topic overlap;
- accounts commonly followed by both graphs;
- repeated appearance of our niche keywords in their conversations;
- observed followers/repliers who match our target audience.

**ConversationQuality**

Whether their threads contain serious technical exchanges rather than mostly praise/noise.

**ReplyVisibility**

Whether useful replies plausibly remain visible long enough to matter.

Inputs may include:

- current post age;
- current reply count/saturation;
- conversation velocity;
- whether the author responds to replies;
- whether the thread has already become too crowded.

Saturation is an **empirical visibility/context modifier**, not a prohibition. An active bidirectional technical conversation can remain high-value even when reply count or interaction frequency is high.

**RelationshipPotential**

Whether a useful repeated interaction is realistically possible.

Signals include:

- prior responses from the target;
- similar technical interests;
- repeated interaction opportunities;
- current follow state;
- account accessibility/size;
- history of responding to informed commenters.

---

## 7. Candidate opportunity scores

Every content signal that enters triage/workflow should keep four independent scores. A pure Bookmark/reference action does not need to create workflow scoring state by itself.

### Reach Potential

How much broad distribution opportunity the underlying signal may have.

### Follow Potential

How strongly a finished contribution could reinforce why a developer should follow `@ham_zax`.

### Conversation Potential

How likely the topic can produce useful technical exchange.

### Relationship Potential

How valuable the specific source/author/conversation may be for recurring network construction.

Do not collapse these into one pseudo-X score in the UI.

Example:

```text
Reach       93
Follow      46
Conversation 61
Relationship 18
```

Interpretation:

> Large viral source, but weak relationship/follower value. Repost/ignore may be stronger than spending a main-feed slot.

Another:

```text
Reach       58
Follow      91
Conversation 88
Relationship 93
```

Interpretation:

> Smaller conversation but excellent account-building opportunity. Prioritize reply or owned experiment.

---

## 8. Relationship lifecycle

Relationship stage is derived from observed events, not manually guessed status.

Recommended stages:

```text
observed
-> interacted
-> responsive
-> recurring
-> connected
-> mutual
```

Definitions:

**observed**

Relevant account known to the system.

**interacted**

We have sent at least one substantive reply/quote associated with the account.

**responsive**

The target has replied, quoted, reposted, or otherwise produced a meaningful response.

**recurring**

At least two bidirectional exchanges across separate posts or days.

**connected**

The account follows us.

**mutual**

Both accounts follow each other.

Relationship stage must coexist with raw follow flags because the sequence can occur in different orders.

---

## 9. Relationship event history

Every material interaction should become an event.

Suggested event types:

```text
observed_relevant_post
our_reply
our_quote
target_reply
target_quote
target_repost
target_follow
we_followed
mutual_reached
conversation_continued
conversation_expired
```

Each event should carry:

```text
target_username
source_tweet_id
our_tweet_id
topic
candidate_key
occurred_at
metadata_json
```

The event stream is the source of truth for relationship analytics.

---

## 10. Engage Next

The implemented Engagement view answers:

> **Which conversation is most worth entering right now, and what can we genuinely contribute?**

Each opportunity card shows the current equivalent of:

```text
@Target · 12m old
Classes: RELATIONSHIP + AUTHORITY
TargetScore: 88
Conversation Potential: 91
Relationship Potential: 94
Topic: agent memory
Relationship stage: responsive

Why now:
The author asked whether tool context resets across retries.

Useful contribution:
Share our task-ledger observation and ask whether their eval preserves tool context.

[Draft reply] [Quote instead] [Ignore] [Expire] [Approve & Send]
```

Sort primarily by:

1. active conversation/direct response value;
2. time-sensitive opportunity quality;
3. relationship potential;
4. conversation potential;
5. topic fit;
6. target score;
7. source velocity.

Apply target saturation, reply-archetype repetition, and target concentration as **soft warnings/modifiers**. They must not automatically block a useful human-approved interaction. A direct question, active bidirectional exchange, or new verified evidence can offset those soft penalties.

Do not sort by follower count alone and do not impose a fixed daily reply quota.

---

## 11. Conversation follow-up

The current refresh path prioritizes observed responses to existing conversations above finding endless new targets.

A sent reply can enter:

```text
sent
-> target_replied
-> follow_up_due
-> replied_again
-> conversation_active
-> resolved
```

If an existing relationship target replies/quotes one of our tracked posts or replies, that observed response appends relationship history and re-enters **Engage Next** as an elevated `follow_up` or `own_post_response` item when a concrete contribution exists.

Follow-up priority is higher when:

- the target directly asks a question;
- the exchange exposes a useful disagreement;
- new technical evidence is available;
- the relationship target is high value;
- the conversation is still fresh.

The system should not manufacture follow-ups when the conversation has naturally ended.

---

## 12. Owned-content alignment

The network system should detect whether the profile has strong owned content matching the conversations we are entering.

Define a simple `ProfileProofCoverage` view by topic:

```text
agents          strong
MCP             strong
model cost      weak
sandboxing      medium
AI career       weak
```

If we repeatedly enter conversations about a topic with weak owned proof, the research/publishing queue should suggest creating a durable original asset in that area.

This creates the compounding loop:

```text
conversation demand
-> identify missing profile proof
-> build original experiment/thread
-> future conversation profile visits convert better
```

---

## 13. Daily operator loop

A practical day should begin with network opportunities, not an arbitrary posting quota.

### Morning / first session

1. Refresh relationship targets and relevant recent posts.
2. Surface conversation follow-ups first.
3. Review top new Engage Next opportunities.
4. Approve only replies with a concrete contribution.
5. Check viral/trend queue for urgent owned-content opportunities.

### Main-feed work

1. Review approved research queue.
2. Prioritize high Follow Potential + strong profile identity.
3. Prefer experiments/benchmarks and useful technical synthesis.
4. Publish only when quality and timing gates pass.

### Throughout the day

- respond to substantive replies under our posts;
- continue valuable target conversations;
- save research sources;
- capture new relationship events.

### End of day

Review:

- meaningful conversations started;
- target responses;
- new followers;
- newly connected/mutual relationships;
- owned posts that produced profile/follower movement;
- research questions generated by conversations.

---

## 14. Metrics hierarchy

### Tier 1 — network construction

```text
author_response_rate
conversation_continuation_rate
relationship_conversion_rate
connected_target_count
mutual_target_count
recurring_relationship_count
interaction_yield
target_diversity
class_diversity
topic_diversity
top_target_concentration
```

### Tier 2 — audience conversion

```text
associated_follows_per_1000_views
niche_aligned_new_followers
profile_conversion_when_observable
```

### Tier 3 — content distribution

```text
views_per_hour
replies_per_1000_views
reposts_per_1000_views
share/bookmark proxies when observable
```

### Tier 4 — raw counters

```text
likes
views
raw follower count
```

Raw counters are useful diagnostics but should not override stronger network/follower outcomes.

---

## 15. Account health and leniency

Account health is an observability/efficiency layer, not a hidden bot-score simulator.

Use `ACCOUNT_HEALTH_AND_VISIBILITY.md` as the source of truth.

Operator-facing states:

```text
HEALTHY
WATCH
CONSTRAINED
```

Most behavior signals remain `WATCH`-level advice:

- target saturation;
- repeated reply archetype;
- high target concentration;
- weak recent InteractionYield;
- crowded conversations;
- repeated thesis/structure.

A hard constraint requires actual visibility/enforcement evidence, an explicit platform/project boundary, or an item-level factuality/duplicate failure.

There is no arbitrary daily reply quota. Genuine active-conversation bursts are healthy by default when the conversation remains substantive and bidirectional.

When available, X Under the Hood snapshots should be preserved as actual visibility evidence rather than inferring account state from reach changes.

---

## 16. Network experiments

Experiments should test network strategy as well as writing style.

Useful dimensions:

```text
target_class
target_score_bucket
target_size_bucket
reply_age_bucket
conversation_saturation_bucket
reply_archetype
relationship_stage
topic_overlap
```

Example hypotheses:

> Implementation replies to peer builders create more recurring relationships than opinion replies to official accounts.

> Replies at 5-15 minutes outperform 15-60 minutes for high-velocity launch posts.

> Authority targets produce fewer follows but higher later profile conversion when they respond.

> Customer-density targets produce fewer raw impressions but more relevant followers.

These are empirical questions. The current experiment owner persists a plain-language hypothesis and variants, validates population eligibility, and requires explicit caller/operator assignment before execution; it does not randomize assignments or create duplicate/near-duplicate A/B posts. Cohorts retain normalized outcomes, sample size, target/topic/class distributions, Account Health/Network Quality context, and InteractionYield raw components. Evidence progresses `insufficient -> preliminary -> directional -> repeated`; even `repeated` remains observational rather than causal, and Phase 4 never self-promotes a permanent rule.

Saturation, interaction-volume, target-concentration, and archetype-repetition buckets are valid cohort dimensions but never hard activity limits. High-volume reciprocal conversations remain analyzable as healthy network behavior.

---

## 17. Learned strategy

The implemented learning layer converts qualified Phase-4 experiment/cohort evidence into inspectable rule candidates without silently rewriting strategy.

Rule lifecycle:

```text
suggested -> accepted -> retired
```

- `suggested` rules are evidence records with **zero** production effect;
- human acceptance requires qualified `directional` or `repeated` evidence;
- accepted adjustments are bounded and applied after transparent base scoring;
- retired rules remain visible/history-preserving and have zero effect;
- suggestion refresh never overwrites an accepted or retired rule;
- newer/reversing evidence, niche changes, or linked retired/materially changed algorithm mechanisms surface review signals rather than silently changing rule status.

Accepted learning can tune TargetScore components, Reach/Follow/Conversation potential, EngagePriority, soft SaturationPressure/WATCH pressure, and scheduler content/format/topic/timing preference. The UI exposes base vs learned contribution where the rule affects a current recommendation.

Learning cannot override hard content gates, expiry, required human approval, an explicit manual route/schedule, or supported observed Account Health constraints. It cannot infer `CONSTRAINED` from low reach, create a fixed reply quota, or introduce fake-human timing/jitter.

---

## 18. Algorithm evidence discipline

All strategic claims must be categorized using `ALGORITHM_EVIDENCE_LEDGER.md`.

Three main evidence levels:

```text
CODE_BACKED
OFFICIAL_PRODUCT_OR_POLICY
EMPIRICAL_VARIABLE
```

A fourth state may be used for superseded or contradicted claims:

```text
RETIRED
```

Do not silently promote an empirical tactic into a platform law.

Likewise, do not ignore a code-backed mechanism merely because an older strategy document called it folklore.

---

## 19. Performance-first operating boundary

Growth documents should focus on distribution, conversion, network construction, and measurement.

Platform/safety constraints remain centralized in:

- `ENGAGEMENT_INTEGRITY.md`;
- `AGENTS.md`;
- the explicit human-approval boundaries in the implementation plans.

The growth strategy should not duplicate long moral/ethical commentary. It should simply preserve the operational boundaries required by the project while optimizing aggressively inside them.

---

## 20. The strategic moat

The defensible advantage is not posting frequency.

It is the accumulation of:

- a high-quality research memory;
- a technically credible owned-content library;
- a graph of recurring developer relationships;
- evidence about which conversations convert into relationships;
- evidence about which owned content converts profile visitors into followers;
- evidence about which topics attract commercially relevant technical audiences;
- a feedback loop that improves targeting, writing, timing, and research selection.

The long-term system is therefore:

> **research engine + relationship CRM + conversation opportunity engine + technical publishing pipeline + measurement lab + human-controlled learned strategy**

That is the intended architecture for `x_action`.