# X Content Operating Standard

This document is the source of truth for what `@ham_zax` should publish, reply with, or quote-post.

It is deliberately stricter than "write something engaging." The account should become recognizable as an **AI-native developer + builder** who filters, tests, explains, and applies useful developments in AI, coding agents, developer tooling, open source, software products, and the business of building software.

The core audience promise is:

> **Save developers research time, give them useful judgment, and help them build better software or products.**

This standard has three levels:

- **MUST** — hard invariant. If violated, do not publish.
- **SHOULD** — default preference. Deviate only for a clear reason.
- **EXCELLENT** — characteristics of posts we should actively seek and reproduce.

---

## 1. Global invariants for every outbound action

These apply to original posts, replies, quote posts, and threads.

### MUST

1. **Add information, judgment, or experience.**
   - Do not merely restate a headline or another person's post.
   - Every outbound item must contribute at least one of: explanation, comparison, experiment, implication, opinion with reasoning, implementation detail, useful question, or synthesis.

2. **Fit the account's topic cluster.**
   A normal post should clearly fit at least one:
   - AI models and model releases
   - coding agents / agentic development
   - developer tools and infrastructure
   - open-source software
   - practical software engineering
   - building and shipping software products
   - developer-to-founder/business lessons
   - useful networking or discovery of builders in the same ecosystem

4. **Have a specific reader benefit.**
   At least one must be true:
   - saves research time;
   - teaches something;
   - helps choose between tools;
   - exposes a useful implementation detail;
   - provides evidence from a real experiment;
   - gives a reusable workflow, command, repo, technique, or mental model;
   - identifies an opportunity or risk a developer can act on.

5. **Do not copy another creator's wording or structure too closely.**
   - Facts and source material can be synthesized.
   - The thesis, wording, examples, and framing should be ours.

6. **Do not publish low-confidence generated filler.**
   - If the system cannot identify the value-add, it should produce no post rather than a weak post.

7. **Do not publish substantially duplicate posts.**
   - If the same story is revisited, the second post must have a materially new angle, result, experiment, or update.

8. **Avoid redundant main-feed bursts.**
   - A new main-feed item should be worth occupying another slot in a follower's feed.
   - This does not apply as a blanket slowdown to an active reply conversation; several substantive back-and-forth replies can be appropriate when the conversation is genuinely progressing.
   - Do not dump several weak posts because multiple feeds produced candidates at once.

9. **Use links when useful.**
    - Link to the relevant source or destination when it helps the reader.
    - A link can provide attribution, context, or an action path.

---

## 2. The preferred value hierarchy

When multiple stories are available, prefer them in this order:

1. **We tested or built something and have a result.**
2. **We found a primary-source technical detail most people missed.**
3. **We can compare two tools/models using concrete evidence.**
4. **We can turn fresh news into a useful developer implication.**
5. **We found a genuinely useful new tool/repo/workflow.**
6. **We have a clear technical or builder opinion with reasoning.**
7. **We can ask a high-quality question that invites expert experience.**
8. Plain news summary.

Plain news summary is the weakest acceptable category and should normally be skipped unless speed itself is the value.

---

## 3. Original posts

Original posts are the primary growth surface.

### MUST

- Have one main idea.
- Make the value apparent in the opening lines.
- State what changed, what was learned, or what the reader can do.
- Be understandable without requiring the reader to know the full backstory.
- If based on external news, include our interpretation rather than only the announcement.

### SHOULD

Use one of these structures:

#### Signal -> Insight -> Evidence -> Action

- **Signal:** what changed.
- **Insight:** why it matters.
- **Evidence:** source, number, experiment, code, screenshot, or comparison.
- **Action:** what a developer should try, avoid, watch, or reconsider.

#### Claim -> Proof -> Consequence

- Make a crisp claim.
- Show why it is credible.
- Explain what changes for the reader.

#### Discovery -> Why interesting -> How to use it

Ideal for repos, tools, libraries, MCP servers, CLIs, frameworks, and model releases.

#### Experiment -> Result -> Lesson

Preferred whenever we can actually run something ourselves.

### EXCELLENT

An excellent original post:

- is useful enough to bookmark or send to another developer;
- contains a non-obvious detail or point of view;
- has concrete evidence;
- is easy to skim;
- reinforces exactly what someone would follow `@ham_zax` for;
- creates a natural reason for knowledgeable people to reply;
- remains useful after the immediate news cycle;
- could not be reproduced by simply asking an LLM to summarize the headline.

---

## 4. Replies

Replies can support networking, learning, demonstrating competence, distribution, or any combination of those goals.

### MUST

A reply must do at least one of the following:

- answer a question;
- add a relevant technical detail;
- provide evidence or a useful counterexample;
- ask a specific, informed follow-up question;
- share a directly relevant experience;
- respectfully challenge a claim with reasoning;
- congratulate someone while naming the specific thing that is impressive or useful.

Do not send:

- "Great work"
- "This is huge"
- "Interesting"
- "100%"
- generic compliments with no content
- self-promotional links unrelated to the conversation
- templated replies reused across authors

### SHOULD

- Prefer replying to builders/researchers whose work overlaps our niche.
- Read the linked material when it helps understand the context.
- Keep the reply proportional to the conversation.
- Ask questions whose answers would actually change our understanding.
- When disagreeing, attack the claim rather than the person.

### EXCELLENT

An excellent reply makes the original author or another reader think:

> "This person actually understands the problem."

Best forms:

- a small reproduction result;
- a missing edge case;
- a useful implementation suggestion;
- a concise comparison with another approach;
- a question only someone who read the work carefully would ask.

---

## 5. Quote posts

A quote post must justify taking someone else's post and placing it in our own audience's feed.

### MUST

- Add a distinct thesis, interpretation, test, disagreement, or developer takeaway.
- Be understandable even if the quoted post receives only a quick glance.
- Credit the source naturally through the quote mechanism; do not present their discovery as ours.

Do not quote-post merely to say:

- "this"
- "wow"
- "big if true"
- "we are so back"
- a paraphrase of the quoted text

### SHOULD

Use quote posts when:

- the original itself is strong evidence;
- our commentary changes how a developer should interpret it;
- we have a result or implementation that directly builds on it;
- disagreement benefits from keeping the original claim visible.

### EXCELLENT

The quote and our commentary should form a **new information object**: the reader gets more from the combination than from either alone.

---

## 6. Threads / long-form posts

Long posts are justified when compression would remove useful reasoning.

### MUST

- Earn the length.
- Put the thesis and payoff near the top.
- Use sections or visual structure.
- Remove repeated conclusions and filler transitions.
- End with a practical takeaway, not a generic CTA.

### SHOULD

Good long-form topics include:

- reading a large codebase/spec and extracting what matters;
- benchmark or model-release analysis;
- end-to-end experiment results;
- architecture breakdowns;
- "what everyone is getting wrong";
- detailed builder retrospectives.

### EXCELLENT

A strong long post should function like a compact technical note someone would bookmark as a reference.

---

## 7. News and model releases

News is an input, not the product.

### MUST

For news-based posts, answer at least one:

- What does this enable that was previously impractical?
- What changed technically?
- How does it compare with the current alternative?
- What is the cost/performance/developer-experience tradeoff?
- What should a developer test first?
- What claim in the announcement creates the strongest developer angle?

### SHOULD

- Prefer concrete technical detail.
- Prefer developer consequence over corporate announcement language.
- For models, discuss capability in relation to a task, not only leaderboard position.

### EXCELLENT

Run the model/tool/repo ourselves and publish the result.

---

## 8. Algorithm-aware principles

The public X recommendation code should inform content quality and network strategy without becoming fake raw-count arithmetic.

`ALGORITHM_EVIDENCE_LEDGER.md` is the authority for whether a claim is CODE_BACKED, OFFICIAL_PRODUCT_OR_POLICY, EMPIRICAL_VARIABLE, or RETIRED.

Current public code indicates that ranking predicts multiple actions for **each viewer** and combines those predicted probabilities using weights. The weights are **not raw engagement-count multipliers**. Therefore we do not optimize for simplistic formulas such as "one share equals N likes."

Practical implications:

- **Audience coherence matters.** Retrieval uses viewer history and content/author representations; stay recognizable to a developer/AI-builder audience.
- **Originals matter for discovery.** Out-of-network replies and reposts are filtered from the normal For You candidate path.
- **Share-worthy utility is strategically strong.** Build things developers would genuinely send to another developer.
- **Follow-worthy identity matters.** Every strong post should reinforce why this account deserves a follow.
- **Relevant network topology matters.** Current public code includes in-/out-of-network mechanics and a bidirectional/mutual-follow reply-head boost for eligible original posts; repeated useful relationships are therefore strategically different from one-off borrowed reach.
- **Author diversity matters.** Author-diversity logic reduces repeated-author presence in a candidate slate.
- **Differentiate the angle.** The VMRanker diversity stage uses semantic similarity, so being the 20th near-identical summary is strategically weak.
- **Freshness matters for For You inventory.** The current public pipeline filters posts older than 48 hours from this candidate path; evergreen ideas should be republished only as genuinely new posts with new value.
- **Small-account exploration exists, but is not guaranteed.** Public defaults include a cold-start mechanism for low-impression authors. Treat this as an opportunity to publish strong originals, not as guaranteed distribution.

Primary references:

- https://github.com/xai-org/x-algorithm/blob/main/README.md
- https://github.com/xai-org/x-algorithm/blob/main/home-mixer/params/param.rs
- https://github.com/xai-org/x-algorithm/blob/main/home-mixer/scorers/ranking_scorer.rs
- https://github.com/xai-org/x-algorithm/blob/main/home-mixer/scorers/author_cold_start.rs
- https://github.com/xai-org/x-algorithm/blob/main/home-mixer/filters/oon_retweet_reply_filter.rs
- https://github.com/xai-org/x-algorithm/blob/main/vm-ranker/dpp.rs
- https://github.com/xai-org/x-algorithm/blob/main/phoenix/README.md
- https://github.com/xai-org/x-algorithm/blob/main/docs/BIDIRECTIONAL_BOOST_CHANGE.md
- `ALGORITHM_EVIDENCE_LEDGER.md` for current evidence classification and empirical variables.

---

## 9. Draft quality rubric

Use this to compare candidates and drafts. It is not a simulation of X's ranking score.

Score each dimension 0–5.

| Dimension | 0 | 3 | 5 |
| --- | --- | --- | --- |
| Niche fit | unrelated | adjacent | core AI/dev/builder topic |
| Utility | no reader benefit | useful context | immediately actionable / saves real time |
| Novelty | duplicate summary | some framing | non-obvious finding or original result |
| Evidence | unsupported | credible source | primary source + experiment/data |
| Shareability | no reason to send | useful to some peers | "send this to a developer" level |
| Follow value | does not reinforce identity | somewhat aligned | strongly establishes account promise |
| Reply quality | bait or no discussion | reasonable question | invites informed technical discussion |
| Clarity | confusing | understandable | crisp and easy to scan |
| Specificity | generic | some concrete detail | numbers/code/tool/result/decision |
| Integrity | misleading | mostly careful | precise about certainty and limitations |

### Hard gate

A draft is rejected regardless of total score if it violates any MUST invariant.

### Quality bands

- **0–24:** reject
- **25–34:** weak; normally reject
- **35–41:** good enough only if timely and useful
- **42–46:** strong
- **47–50:** excellent; prioritize

Automation should prefer publishing nothing over publishing below the quality bar.

---

## 10. Pre-publish checklist

Before any original post, reply, or quote goes live:

1. What is the intended claim or angle?
2. What new value are we adding?
3. Which developer/building audience does this serve?
4. Why would someone save, share, reply to, or follow from this?
5. Is the hook specific and clear?
6. Is this materially different from our recent posts and the obvious summaries already circulating?
7. Can anything be removed without losing value?
8. Would we still be comfortable publishing it after the engagement numbers disappear?

## 11. Final writing and human approval

Use `POST_GENERATION_PROMPT.md` for the final AI writing/editing pass before a main-feed item enters review.

Default editorial rules:

- write in clear global English;
- one central thesis per single post;
- lead with the concrete finding/tool/problem rather than vague suspense;
- use short paragraphs for scan speed;
- include 1-3 precise semantic anchors naturally when relevant;
- default to zero hashtags and never use hashtag stuffing;
- default to zero emoji;
- recommend media only when it explains something the text cannot;
- a question must seek useful information rather than comments for their own sake;
- do not let the generation model self-authorize publication.

A separate hard gate and the numeric quality rubric run after generation. The implemented Phase-2 workflow lets AI prepare routed Original/Quote/Thread/Reply content and persist structured writer output, but AI cannot self-approve. Review stores deterministic failures/warnings for niche/additive value, source/recent duplication, scannability/placeholders/weighted length, CTA integrity, hashtags/emoji, thread rules, and media readiness. A hard-gate failure always overrides the numeric score.

Media planning is implemented with the persisted enum `none | screenshot | chart | code | diagram`. Operator-attached JPEG/PNG/WebP/GIF images can provide real readiness and are uploaded by the authenticated publication transport. Required media remains unapprovable until an attachment and complete media plan are present; decorative media is never required merely to improve a growth score.
