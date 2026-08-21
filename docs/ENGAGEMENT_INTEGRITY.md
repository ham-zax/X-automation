# X Engagement Integrity Policy

This document defines what `@ham_zax` may and may not do to grow through replies, quotes, follows, likes, reposts, DMs, and other engagement behavior.

The objective is **real network formation and durable audience trust**, not artificial metric inflation.

This is separate from `CONTENT_OPERATING_STANDARD.md`: that document governs content quality; this one governs **how we interact with the platform and other people**.

This document is a **constraint layer, not the growth strategy**. Distribution, relationship construction, conversion, experiments, and optimization live in `NETWORK_GROWTH_OPERATING_SYSTEM.md` and the phase plans. Those documents should optimize aggressively inside the boundaries defined here rather than repeating policy/moral framing throughout the strategy.

---

## 1. Core invariant

> **Every engagement action must make sense even if it produces zero algorithmic benefit.**

If an action exists only to manufacture visibility, reciprocity, or metrics, do not do it.

---

## 2. Strict prohibitions

The system MUST NOT:

1. **Automate likes.**
2. **Mass-follow, churn-follow, or proactively auto-follow accounts to get attention.**
3. **Auto-unfollow people based on whether they followed back.**
4. **Send unsolicited automated replies or mentions based on keyword searches, timelines, follower lists, or trend scans.**
5. **Run AI reply bots without the approval/consent model required by X.**
6. **Join or simulate engagement pods.**
7. **Exchange follows, likes, reposts, replies, or bookmarks as a quid pro quo.**
8. **Use multiple accounts to amplify the same content or manufacture popularity.**
9. **Post duplicate or near-duplicate replies across many accounts.**
10. **Hijack trending topics or unrelated hashtags for reach.**
11. **Reply to popular posts with irrelevant self-promotion.**
12. **Repeatedly post/delete/repost the same material to reset distribution.**
13. **Use deceptive editing to preserve old engagement while materially changing what the post promotes.**
14. **Mislead users with links or redirect destinations.**
15. **Coordinate reports, blocks, mutes, likes, reposts, or other actions to manipulate ranking.**
16. **Treat private ranking weights as a raw-points farming formula.** The public X algorithm weights predicted viewer behavior; they are not raw engagement-count multipliers.

These are hard stops, not optimization preferences.

---

## 3. Replies: networking without reply farming

Replies are valuable when they create a real professional relationship or useful technical conversation.

### Allowed and encouraged

- Answer a developer's question when we genuinely know something useful.
- Reproduce an issue and report the result.
- Ask an informed question after reading the source.
- Add an edge case, benchmark, implementation detail, or comparison.
- Disagree respectfully with evidence.
- Congratulate a builder while naming the specific technical/product achievement.
- Continue a conversation when the other person has engaged with us.

### Not allowed for automation

- Search a keyword and auto-reply to matching posts.
- Generate dozens of "smart sounding" replies to creators we do not know.
- Reply solely because the author has a large audience.
- Use templated praise with minor wording changes.
- Insert our product/site into unrelated conversations.

### Standard

A reply should pass this test:

> If the author had 50 followers instead of 500,000, would this still be worth saying?

If no, it is probably reach farming.

---

## 4. Quote posts

Quote posts are allowed when our commentary adds material value.

Good reasons to quote:

- add technical context;
- show a reproduction or experiment;
- explain a consequence for developers;
- compare it with another approach;
- challenge a claim with evidence;
- amplify genuinely useful work while explaining why it matters.

Bad reasons:

- borrow someone else's virality with "this is huge";
- repeatedly quote large accounts just to appear in their conversations;
- manufacture controversy;
- restate the quoted post without adding anything.

Automated quote-posting should be conservative. A quote should satisfy the same content quality gate as an original post.

---

## 5. Follows

Follows should represent genuine interest in the person's future work.

### Good follow reasons

- consistently strong work in AI/devtools/open source/building;
- someone we have had a useful conversation with;
- a primary source we want to monitor;
- a builder/researcher whose work materially overlaps our niche.

### Bad follow reasons

- "they might follow back";
- follower-count ratio optimization;
- mass following everyone who liked a post;
- automated prospecting followed by scheduled unfollows.

The system may **recommend accounts to consider following**, but the follow itself should remain a deliberate human action unless X policy and an approved API workflow clearly allow the intended automation.

---

## 6. Likes and reposts

Likes should be genuine preference signals, not growth automation.

Our system may analyze what `@ham_zax` has liked to learn taste and topic preference, but MUST NOT automatically like posts.

Reposts and quote posts can be automated only when otherwise compliant, but our operating preference is stricter:

- avoid bulk reposting;
- prefer an original synthesis or useful quote post when we have something to add;
- repost without commentary only when the source itself is unusually useful and amplification is the point.

---

## 7. DMs and mentions

Do not use unsolicited automated DMs or mentions for outreach.

For human outreach:

- have a specific reason to contact the person;
- reference their actual work;
- keep the ask small and clear;
- do not disguise a sales message as technical networking;
- do not repeatedly contact someone who has not responded.

Automated responses are only appropriate where the recipient has clearly opted in and the workflow complies with X's current automation rules.

---

## 8. Engagement bait vs legitimate calls to action

### Avoid

- "Like if you agree"
- "RT to save a life"
- "Comment YES and I'll send it"
- "Drop your startup"
- "Follow me for part 2" when part 2 is artificially withheld
- fake binary questions whose only purpose is comments
- giveaways where engagement itself is being used mainly to inflate metrics

### Acceptable

A call to action is fine when the interaction has real informational value:

- "Which of these two models are you using in production, and why?"
- "If you've reproduced this on Windows, what changed?"
- "I'm comparing agent sandboxes; what failure mode should I include?"
- "Is there a better open-source implementation I missed?"

The distinction is simple:

> **A legitimate question seeks information. Engagement bait seeks engagement.**

---

## 9. What the public X algorithm means for engagement

The public `xai-org/x-algorithm` repository shows that Phoenix predicts actions per viewer and combines predicted probabilities using configured weights.

This means we should optimize for **reader value that naturally creates high-value behavior**, not manually farm the behavior itself.

Strategic interpretation:

- Build posts another developer would genuinely share privately.
- Publish originals worth following the author for.
- Create technically substantive conversations with real peers.
- Maintain a coherent niche so retrieval can associate the account with the right audience.
- Avoid repeated low-value output that increases negative feedback or author fatigue.
- Prefer novel analysis over near-duplicate coverage of the same news.

Primary algorithm references:

- https://github.com/xai-org/x-algorithm/blob/main/README.md
- https://github.com/xai-org/x-algorithm/blob/main/home-mixer/params/param.rs
- https://github.com/xai-org/x-algorithm/blob/main/home-mixer/scorers/ranking_scorer.rs
- https://github.com/xai-org/x-algorithm/blob/main/home-mixer/filters/oon_retweet_reply_filter.rs

---

## 10. Automation posture

The system may automate research, ranking, drafting, scheduling assistance, and serialized coverage-aware publishing workflows, but it must not attempt to disguise automation as human behavior or bypass X anti-abuse controls.

Preferred operating model:

- quality and relationship yield over arbitrary action volume;
- no fixed daily reply quota when there are many genuinely useful human-reviewed conversations;
- active bidirectional conversation bursts are allowed and should not be slowed merely to look human;
- high relevance over broad indiscriminate reach;
- human review remains the default reply path; live AI-generated autonomous replies require an explicit persisted operator grant, recipient opt-in for the interaction, a recorded clear/easy opt-out mechanism, recorded X written approval, deterministic eligibility, and atomic duplicate-safe claim; quotes and sensitive interactions remain human-reviewed;
- duplicate prevention and explicit main-feed serialization where self-cannibalization is a concern;
- no timing jitter or browser tricks whose purpose is to evade detection;
- no synthetic social graph construction;
- no coordinated engagement exchange;
- no automated action whose primary purpose is to imitate a person rather than provide genuine value.

`ACCOUNT_HEALTH_AND_VISIBILITY.md` owns the softer advisory layer: target saturation, repeated reply archetypes, target concentration, InteractionYield, and observable visibility state. Those signals should warn or reprioritize before they block anything.

The objective is human-quality behavior, not hidden automation.

## 11. Current X policy constraints

As of the current X Help documentation reviewed in August 2026:

- X permits useful automated informational posts subject to its rules.
- X prohibits automated likes.
- Bulk/aggressive/indiscriminate follow and unfollow behavior is prohibited.
- Automated unsolicited replies or mentions are prohibited; keyword-search auto-replies are explicitly given as a disallowed example.
- AI-powered automated reply bots require prior written and explicit approval from X.
- Duplicative, bulk, irrelevant, or unsolicited content can be treated as spam/platform manipulation.
- X's automation rules warn against non-API-based automation such as scripting the website.

Official references:

- https://help.x.com/en/rules-and-policies/x-automation
- https://help.x.com/en/rules-and-policies/authenticity
- https://help.x.com/en/rules-and-policies/x-rules-and-best-practices

### Important implementation risk

The current `x_test` publisher uses X's private web GraphQL interface rather than the official X API. That achieved direct HTTP publishing in our local implementation, but it is **not the same thing as an officially supported API integration**. X's current automation rules explicitly warn that non-API automation can lead to enforcement.

Therefore:

- do not expand the private-GraphQL path into automated likes, follows, unsolicited replies, DMs, or bulk engagement;
- autonomous Dry run may continuously evaluate opportunities, but **Live autonomous reply Start is blocked while the write transport remains private web GraphQL**;
- an official X API write transport is a required production boundary before unattended autonomous replies can be enabled, in addition to recipient opt-in, opt-out, and written X AI-reply approval.

---

## 12. Safe growth loop

The preferred networking loop is:

1. **Discover** relevant builders, researchers, tools, and discussions.
2. **Read** the source before interacting.
3. **Contribute** a useful human-quality reply when there is something real to add.
4. **Publish** original synthesis, experiments, and tools that create reasons for those people and their audience to discover us.
5. **Continue** conversations with people who respond.
6. **Follow** selectively when we genuinely want their future work.
7. **Measure** which topics create follows, substantive replies, shares, bookmarks, and repeat interactions.
8. **Do more of the useful topic**, not more mechanical engagement actions.

Automation may also run the bounded autonomous-reply operator when the operator explicitly starts it. Dry-run may evaluate active, momentum, and normal-relevant opportunities continuously without X mutation. Live autonomous replies are narrower: recipient opt-in, a recorded clear/easy opt-out mechanism, recorded X written AI-reply approval, and an official X API write transport are mandatory in addition to the project gates and operator budget. The current private web GraphQL publisher does not satisfy that transport boundary, so Live autonomous Start remains blocked. Cold timeline/momentum discoveries without recipient opt-in must become human review or skip, not an unsolicited automated reply. The system should never manufacture volume merely because budget remains.

---

## 13. Engagement quality rubric

Before taking an outreach/engagement action, score each 0–2:

| Dimension | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Relevance | unrelated | adjacent | directly relevant |
| Contribution | no value | mild value | concrete new value |
| Authenticity | metric-seeking | mixed motive | would do it without reach benefit |
| Specificity | generic | somewhat specific | clearly based on their actual work |
| Relationship value | no future reason | possible | real peer/network potential |

Interpretation:

- **0–4:** do not engage
- **5–7:** only if natural
- **8–10:** strong networking opportunity

Hard prohibitions override the score.

---

## 14. Final test

Before an engagement action, ask:

> **Are we helping the conversation, or merely trying to be seen inside it?**

If the truthful answer is "trying to be seen," skip it and make a better original post instead.
