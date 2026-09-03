# Canonical X Writing Study — 4,976-Post Creator Corpus

**Created:** 2026-09-04  
**Target account:** `@ham_zax`  
**Purpose:** derive a durable writing standard from the creator corpus without copying any creator's distinctive wording or pretending that observational patterns are X ranking laws.

---

## Research question

What makes a post from these creators not merely **seen**, but **easy to understand, likable, memorable, and follow-worthy**?

The immediate trigger for this study is an Astra reply that reached roughly 1.3K impressions but produced essentially no visible engagement. That is a useful failure case: distribution occurred, but the writing did not create enough human pull.

This study therefore keeps two outcomes separate:

1. **Reach** — did the post travel?
2. **Human pull** — after seeing it, did people like, reply, repost, or bookmark it?

A post can win the first and lose the second.

---

## Dataset

Raw source:

`docs/research/x_creator_phase2/posts.jsonl`

- 4,976 total cataloged records
- 52 selected creators
- 51 creators with collected post data; `@realGeorgeHotz` is empty in this snapshot
- 3,890 original or quote posts used for writing-style analysis
- 2,134 originals
- 1,756 quote posts
- native reposts excluded from writing-style analysis because the creator did not write the reposted text

The corpus is observational and selected. Topic, author fame, news cycle, media, source-post reach, and existing audience can all affect performance.

### Normalization used in this study

Raw views are misleading across creators with very different audience sizes. For each creator, I therefore calculate a recent within-author baseline and use:

- **reach lift** = post views / that creator's median views in this corpus
- **interaction rate** = `(likes + reposts + replies + bookmarks) / views`
- **interaction lift** = interaction rate / that creator's median interaction rate
- **like lift** = like rate / that creator's median like rate

Useful empirical cutoffs in this corpus:

- top 25% reach: at least **1.88x** the author's median views
- top 10% reach: at least **3.95x** the author's median views
- top 25% interaction rate: at least **1.55%**
- top 10% interaction rate: at least **2.18%**

These are corpus-relative labels, not definitions of virality on X.

---

# Pass 1 — Broad quantitative map

## 1. The first major finding: reach and human pull are different games

Across all 3,890 written posts, median interaction rate is about **1.06%**.

The top 10% by within-author reach has a median interaction rate of only **0.78%**.

That means the posts that travel furthest are not automatically the posts that make readers react most strongly.

This is exactly the failure mode of the Astra reply: high source momentum can give a reply impressions while the wording still fails to make a reader think, "I like how this person thinks; I want more of this."

**Canonical implication:** never evaluate a post only by impressions. The real funnel is:

`impressions -> engagement -> profile curiosity -> follows`

For writing quality, impressions are the entrance, not the goal.

---

## 2. The best balanced posts are not ultra-short; they are compact and complete

The 198 posts that are simultaneously in the top quartile for reach **and** top quartile for interaction have approximately:

- median 40.5 words
- median first line: 81 characters
- median 2 paragraphs
- 50% use first-person language
- 39% use contractions
- 45% contain a concrete number
- 46% contain current/immediate language such as `now`, `today`, `new`, `shipped`, or `released`
- 46% contain media

This is an important correction to the simplistic "shorter is always better" idea.

Posts of only 8 words or fewer underperform the corpus on both normalized reach and interaction. Posts in the **31–60 word** range are materially healthier on reach in this sample.

**Canonical implication:** aim for the shortest version that still gives the reader a complete thought. Do not amputate the useful context merely to make a one-liner.

---

## 3. Originals create substantially more human pull than quote posts

Within this corpus, originals and quote posts have nearly similar median normalized reach, but originals are much stronger on interaction:

- original median interaction lift: **1.13x**
- quote-post median interaction lift: **0.90x**
- original median like lift: **1.12x**
- quote-post median like lift: **0.91x**

This does **not** mean quote posts are bad. A quote can inherit context and distribution. But borrowed context does not automatically make the creator likable.

**Canonical implication:** a reply or quote should sound like a person participating in the conversation, not like a tiny research memo pasted underneath somebody else's post.

---

## 4. Concrete numbers are useful; numerical decoration is not the lesson

Posts containing a number show:

- median reach lift: **1.15x**
- about **1.23x** the normalized reach of posts without a number
- only a small interaction advantage

This strengthens the earlier smaller retrospective finding that numerical specificity is worth testing.

The useful lesson is not "put a number in every tweet." It is:

> When a number makes the claim more concrete, the post becomes easier to understand and evaluate.

`100% on ExploitBench` is concrete. `a materially stronger capability surface` is not.

---

## 5. Human grammar matters more than polished analyst grammar

Several human-language markers lean positively in this corpus:

- first-person language has about **1.11x** the normalized reach of posts without it
- contractions have about **1.10x** the normalized reach of posts without them
- posts beginning with `I...` show about **1.21x** the normalized reach of other openings
- posts beginning with `We...` show about **1.27x** the normalized reach of other openings

These are observational associations and partly author-dependent, but the direction is useful.

A creator saying:

> `I can't wait to try this.`

is immediately legible as a human reaction.

A creator saying:

> `The boundary I'm watching is the separation between production capability surfaces.`

asks the reader to decode the writer before they can react to the event.

**Canonical implication:** technical intelligence should appear in the *idea*, not in unnecessarily institutional sentence construction.

---

## 6. There appears to be a technical-density sweet spot

Using a rough technical-term density measure:

- very low technical density (`<=2%`): weaker engagement
- light/moderate technical density (`2–6%`): best reach band in this first pass
- medium density (`6–12%`): stronger engagement but no reach advantage
- very high density (`>12%`): lower reach, although the people who remain can still engage

This is exactly the account's desired niche: technical, but understandable on one read.

**Canonical implication:** use the minimum jargon needed to preserve the technical truth. One strong technical noun is often better than four abstract system nouns in the same sentence.

---

## 7. Stacked abstraction looks dangerous

A rough abstraction-density feature is sparse, so confidence is lower here. Still, the small set of posts with very high abstract-language density (`>6%`) underperforms on:

- normalized reach
- interaction lift
- like lift

The sample is only 14 posts, so this is not yet a law. But it matches the qualitative failure of the Astra reply.

Words such as `boundary`, `configuration`, `capability`, `surface`, `architecture`, and `infrastructure` can each be useful. The problem is stacking several before the reader has a concrete picture.

**Bad reading experience:**

`default production configuration -> capability surfaces -> separation is part of the product`

**Better reading experience:**

`Most people won't get the Astra used in OpenAI's strongest cyber tests. That version has extra tools and access.`

Same idea. Much lower decoding cost.

---

## 8. Questions are not automatically conversational

Posts containing a question have roughly neutral normalized reach but weaker interaction and like lifts in this sample.

So "ask a question to get replies" is not a canonical rule.

A real question works when the audience actually has something interesting to answer. A generic rhetorical question is merely extra punctuation.

---

## 9. Exclamation marks do not create reach

Posts with an exclamation mark show lower normalized reach in this corpus, with roughly neutral interaction.

This does not mean "never use `!`." It means excitement has to be in the substance, not manufactured by punctuation.

Interestingly, explicit excitement words themselves are approximately neutral overall. The emotional tone is not the problem; **empty intensity** is.

---

## 10. Announcements and surprise are strong when there is actually something to announce or discover

Observed first-pass associations:

- announcement language: ~**1.23x** normalized reach versus absence and ~**1.15x** interaction lift
- surprise language: ~**1.38x** normalized reach versus absence

These are useful because they are naturally tied to novelty.

`Fable 5.1 just shipped...`

`I didn't expect this...`

`This API can now...`

are cognitively easy openings because the reader instantly knows what kind of information is coming.

---

## 11. Media appears to help human pull more than raw reach

Media is only mildly positive on normalized reach in the aggregate, but more positive on interaction and likes.

Photos in particular show a stronger like lift than pure reach lift.

**Canonical implication:** use media when it proves, demonstrates, or emotionally completes the post. Do not attach media as decoration.

---

## 12. Some balanced winners are almost embarrassingly simple

Examples among posts that were simultaneously strong on normalized reach and interaction include first lines shaped like:

- `It's beautiful`
- `the bottleneck is increasingly knowing what you want`
- `Engineering is for the machines. Design is human.`
- `wtf is a graph.`
- `Your next design system is... Markdown.`
- `If you care about your privacy:`

The point is not to copy these sentences. The point is what they *do*:

1. the reader understands the sentence instantly;
2. there is a recognizable human stance;
3. the thought creates curiosity without requiring decoding;
4. any technical depth comes after the reader is already oriented.

That is much closer to the desired account than analyst-style abstraction.

---

## Pass-1 provisional rule

Before publishing, a technically correct post should pass this test:

> **Could a smart developer understand the point in one read and repeat it to a friend without translating my wording first?**

If not, simplify the language before adding more technical insight.

This is provisional. Three additional adversarial re-analysis passes follow below; later passes are allowed to overturn Pass 1.

---

# Pass 2 — Structural re-analysis: what separates reach from conversion?

The second pass does not ask, "Which isolated feature correlates with views?" It compares two much more useful groups:

- **balanced winners** — top quartile in both within-author reach and interaction rate
- **high-reach / low-interaction posts** — top quartile reach but below the top interaction quartile

There are 198 balanced winners and 775 high-reach / lower-interaction posts in this corpus.

## 13. The balanced winners look more like complete human thoughts

| Feature | Balanced: high reach + high interaction | High reach, lower interaction |
|---|---:|---:|
| Median words | 40.5 | 35 |
| Median first-line length | 81 chars | 74 chars |
| First person | 50.0% | 56.3% |
| Second person | **32.8%** | 25.5% |
| Contractions | **39.4%** | 35.0% |
| Contains number | **44.9%** | 38.6% |
| Current/immediate language | **46.0%** | 33.9% |
| Media | **46.0%** | 31.4% |
| Quote post | **25.3%** | 44.3% |
| Contains question | **4.5%** | 8.0% |
| Median interaction rate | **2.01%** | 0.79% |

The strongest contrast is not a clever rhetorical device. It is **context ownership**.

Balanced posts are much less dependent on quote-post context, more likely to give the reader something concrete now, and more likely to contain enough words to make the idea complete.

**Canonical implication:** the account should not confuse *being attached to a viral object* with *having written a compelling post*.

---

## 14. The first line's job is orientation, not intellectual signaling

Very short first lines (`<=30` characters) underperform this corpus on normalized reach and interaction. The 61–100 character range is healthier, and longer first lines are not automatically bad when they contain a complete concrete thought.

So the rule should **not** be "make the hook tiny."

The better rule is:

> The first line should let the reader know what is happening, what you think about it, or why they should care — immediately.

Examples of successful opening *shapes* in the corpus include:

- direct verdict about a named product
- first-hand reaction to a release
- concrete problem the author has noticed
- a single surprising comparison
- a recommendation tied to a specific tool
- an immediately useful conditional: `If you care about X...`

The hidden commonality is **low orientation cost**.

---

## 15. Two to three visual blocks are a useful default because they preserve thought completion

One-paragraph posts have weaker normalized reach and interaction than posts with two or more visual blocks in this sample.

This does not mean a one-liner is bad. Some exceptional one-liners perform extremely well. It means a one-liner should be earned by an idea that is actually complete in one line.

For normal technical commentary, a stronger default is:

1. reaction / concrete finding;
2. one useful reason or piece of evidence;
3. optional implication.

That is still concise. It just does not force the reader to infer the missing middle.

---

## 16. Generic enthusiasm is not the answer — human enthusiasm plus a reason is

The user's instinct that something like `I'm very excited to see this` would have felt more natural is directionally important, but the corpus adds an important correction.

Explicit excitement words by themselves are approximately neutral overall.

So this should **not** become:

> always sound excited

It should become:

> **react like a person, then give the reader the reason for the reaction.**

For a live product/research moment, this is much healthier than beginning with an abstract analytical frame.

A good reply can be as simple as:

`I'm genuinely excited to see where this goes. The cyber results are already much stronger than I expected.`

Then, only if useful, add the technical distinction in plain English.

---

## 17. "Technical but understandable" means delaying abstraction, not deleting technical substance

The strongest technical creators routinely use specialized terms. The difference is sequencing.

They often establish a concrete object first:

`Claude Code`, `GitHub`, `Fable 5.1`, `V8`, `$1,500/month`, `100,000 stars`, `local model`, `API`, `React`.

Only then do they interpret it.

The failed Astra reply did nearly the reverse: it opened with `boundary`, then `published cyber results`, `Daybreak Blue access`, `default production configuration`, `capability surfaces`, and `separation`.

Every phrase is defensible. Together they create decoding work before emotional or practical orientation.

**Canonical rule:** **concrete noun first; abstraction second.**

---

# Pass 3 — Creator-by-creator re-analysis: global averages hide the real craft

The third pass compares each creator's own top quartile of posts with the rest of that creator's sample.

This overturns any temptation to turn Pass 1 into a bag of universal tricks.

## 18. There is no universal "viral syntax"

Several global tendencies reverse for individual creators.

For example:

- questions are weak globally, but appear more often in the top quartile for some creators such as `@shadcn` and `@rileybrown`;
- quote posts are weaker on interaction globally, but are a strong part of the top-post mix for some creators;
- numbers are positive globally, yet `@theo`'s top quartile contains **fewer** number-bearing posts than his lower-performing set;
- media helps some creators materially and is neutral or negative for others.

Therefore the canonical system must be built from **principles**, not feature quotas.

Do not tell the writer: `use numbers + question + media`.

Tell the writer what job the post needs to do.

---

## 19. The creators most relevant to our desired voice repeatedly win through conversational technical authority

A few creator-specific patterns are especially relevant to `@ham_zax`.

### `@theo`

In his own top quartile:

- contractions are about **28 percentage points more common**;
- conversational reaction leads are more common;
- numbers are actually less common.

His strongest openings often sound spoken: a complaint, disbelief, comparison, or direct address to a company/product.

**Lesson:** developer authority does not require analyst diction.

### `@GergelyOrosz`

Top posts use first-person language more often and exclamation marks less often.

His strongest material often begins with something he is hearing, seeing, using, or noticing, then names the engineering problem plainly.

**Lesson:** first-hand observation + concrete consequence is extremely compatible with formal credibility.

### `@rauchg`

Top-quartile posts show much more use of contractions and second-person language.

He can discuss architecture, security, or developer systems while still sounding like somebody talking to another engineer.

**Lesson:** technical depth and conversational grammar are not opposites.

### `@bcherny`

Top posts are much more likely to be originals, use first person, and avoid exclamation-heavy framing.

**Lesson:** practical ownership beats performative excitement.

### `@simonw`

Top posts more often use numbers, first person, and direct reader language.

He frequently anchors an observation in an exact model, app, local experiment, file, benchmark, or price before expanding the implication.

**Lesson:** specificity is a readability tool, not merely an evidence tool.

### `@leerob`

Top posts are more often originals, more often numerical, and more conversational.

His effective short posts usually contain an immediately legible product judgment or practical point rather than abstract positioning.

### `@marclou`

His top posts strongly over-index on immediacy, first-person framing, and a concrete personal result.

**Lesson:** `I did X -> Y happened` is one of the lowest-friction information structures on the platform.

---

## 20. The right thing to copy is the information architecture, not the persona

We should **not** turn `@ham_zax` into Theo, DHH, shadcn, Simon Willison, or anyone else.

The transferable patterns are deeper:

- orient before interpreting;
- let the reader see the object being discussed;
- state a real human reaction when one exists;
- make one concrete claim;
- give one reason;
- stop when the useful thought is complete.

That survives creator differences much better than copying slang, punctuation, all-caps, contrarianism, or meme cadence.

---

# Pass 4 — Hidden-gem re-analysis: likes, bookmarks, and replies are different products

The fourth pass stops treating all engagement as one number.

To reduce tiny-view noise, this pass looks at written posts with at least 10,000 views and compares the top 10% by **bookmark rate**, **like rate**, and **reply rate**.

Each cohort contains 377 posts.

## 21. Bookmark-worthy writing is noticeably more useful and reader-directed

Top 10% by bookmark rate:

- **78.0% originals**
- median **43 words**
- **49.6%** contain a number
- **41.6%** use second-person language
- only **5.0%** contain a question

The strongest bookmark posts repeatedly have utility shapes such as:

- `If you care about X...`
- `do this with <tool>`
- a guide / setup / workflow
- a useful list
- a concrete resource
- a practical result with enough detail to reuse

This is likely the closest available external proxy for **"this account is worth keeping around"**, although the corpus does not contain actual follow-conversion data.

**Canonical implication:** if we want subscribers, we need some posts that give readers something worth saving, not only something worth noticing.

---

## 22. Like-worthy writing is shorter and more identity/emotion driven

Top 10% by like rate:

- **85.4% originals**
- median **29 words**
- only **21.0%** use second-person language
- **37.9%** contain a number
- only **4.2%** contain a question

Qualitatively, many of these posts are:

- a clear belief;
- a clean product/design judgment;
- a personal milestone;
- a relatable reaction;
- an identity statement;
- a sentence people enjoy agreeing with.

This explains why a technically correct caveat can get impressions and still feel unlikable: it offers no obvious emotion or identity for the reader to join.

**Canonical implication:** some posts should make the audience say **"yes"**, not merely **"technically correct."**

---

## 23. Reply-worthy writing genuinely invites participation

Top 10% by reply rate:

- **90.7% originals**
- median **36 words**
- **18.3%** contain a question — more than double the corpus baseline
- **32.4%** use second-person language
- about half use first-person language

This reconciles the earlier apparently negative question result.

Questions are poor as a generic "engagement hack," but they become useful when the actual desired outcome is **conversation** and the question is real.

Examples of strong reply-producing jobs include:

- ask for experience;
- ask for feedback;
- invite people to test something;
- ask what should improve;
- offer to answer questions;
- put a real choice or uncertainty in front of the audience.

**Canonical implication:** a question must create an answer-shaped opening, not merely decorate a statement with `?`.

---

## 24. Hidden gem: a growth account needs at least two kinds of social value

The corpus suggests a useful barbell:

### A. Personality / judgment posts

Goal: likes, recognition, remembered voice.

Characteristics:

- shorter;
- clear stance;
- human reaction;
- easy agreement/disagreement;
- not overloaded with evidence.

### B. Utility / insight posts

Goal: bookmarks, profile curiosity, long-term trust.

Characteristics:

- slightly longer;
- concrete tool/problem;
- numbers when useful;
- reader consequence;
- reusable idea, workflow, resource, or decision.

The account should contain both.

An account made only of technical caveats becomes respectable but forgettable.

An account made only of reactions becomes likable but shallow.

The desired identity is **human technical judgment + useful developer insight**.

---

## 25. Hidden gem: the technical caveat is often better as the *second sentence*, not the post

The Astra idea was not bad. Its placement was bad.

The useful insight was:

> the most powerful cyber-tested Astra setup is not what every normal user gets by default.

That can be understood immediately.

Only after that sentence does `Daybreak Blue`, tool access, monitoring, or deployment configuration become helpful.

This produces a canonical sequencing rule:

> **plain-English truth -> specific technical detail -> implication**

not:

> **technical framework -> abstraction -> reader eventually discovers the point**

---

# Canonical writing standard for `@ham_zax` — proposed from all four passes

This section is the current synthesis. It is **not yet promoted into the X Content skill's permanent memory**; promotion should be a separate explicit decision after review.

## A. Non-negotiable: understandable on one read

A smart developer should understand the main point without rereading or translating the sentence into plainer English.

Technical terms are allowed. Unnecessary decoding is not.

---

## B. Human before analyst

When reacting to a live event, start with the actual human judgment when one exists:

- `I'm excited about this because...`
- `This is genuinely impressive.`
- `I didn't expect this.`
- `This is the part I care about.`
- `I tried this and...`
- `This is a much bigger deal for X than Y.`

Do **not** manufacture emotion. But do not suppress a real reaction merely to sound technical.

---

## C. Concrete object before abstraction

Prefer:

`Astra's strongest cyber setup isn't what normal users get.`

before:

`The relevant capability boundary differs across production configurations.`

Name the model, tool, API, benchmark, price, bug, workflow, or result first.

---

## D. One post, one reason to care

Before writing, choose the job:

- **LIKE:** give the reader a clear reaction, belief, identity, or clean judgment;
- **SAVE:** give a reusable workflow, resource, number, comparison, or developer decision;
- **REPLY:** give the reader a genuine answer-shaped opening;
- **REACH:** attach to current novelty, but never sacrifice the above merely for source momentum.

A post can achieve more than one, but one should be primary.

---

## E. Default size: compact, not skeletal

For normal originals, roughly **25–60 words** is a useful empirical region in this corpus when the idea naturally fits there.

Use one to three short visual blocks.

Do not force an idea into eight words if the missing context is what makes it useful.

---

## F. Replies are conversation, not mini whitepapers

A default reply shape should be:

`human reaction + one useful wrinkle`

or:

`direct agreement/disagreement + one reason`

or:

`one genuine technical question`

Avoid loading a reply with several conceptual nouns and then ending with a generalized "system boundary" conclusion.

---

## G. Numbers are for concreteness

Use a number when it changes how the reader evaluates the claim.

Good reasons:

- price;
- speed;
- benchmark;
- usage;
- scale;
- time;
- observed result.

Bad reason:

- "posts with numbers perform better, so add a number."

---

## H. Translate every abstraction into a consequence

If a draft contains words such as:

`capability`, `surface`, `boundary`, `configuration`, `architecture`, `infrastructure`, `paradigm`, `orchestration`

ask:

> What does this mean somebody can now do, cannot do, should choose, should avoid, or should notice?

Put that consequence first whenever possible.

---

## I. Give people a reason to follow the *person*, not just the information

A technically useful account still needs recognizable judgment.

The desired reader response is not only:

> `I learned something.`

It is:

> `I like how this person notices things.`

That requires occasional taste, excitement, skepticism, humor, personal testing, and conviction — all kept honest.

---

## J. The pre-publish bullshit filter

Do not publish until the draft can answer all five:

1. **What is the concrete thing being discussed?**
2. **Can the point be understood on one read?**
3. **What should the reader feel or gain — agree, save, reply, learn, laugh, reconsider?**
4. **Is there a human point of view, or is this written like an analyst memo?**
5. **Could any sentence be simpler without losing technical truth?**

If #3 has no answer, the post probably has no reason to exist.

---

# Specific diagnosis of the Astra reply

The reply that triggered this study was:

> `The boundary I’m watching: OpenAI says Astra’s published cyber results reflect Daybreak Blue access, not the default production configuration.`
>
> `So “what Astra can do” and “what normal users can invoke” are now different capability surfaces. That separation is part of the product.`

The failure was **not factual correctness**.

The failure was communication order.

The draft asks the reader to parse:

- boundary;
- published cyber results;
- named access tier;
- production configuration;
- invoke;
- capability surfaces;
- product separation.

before it gives them a simple emotional or practical reason to care.

A normal reader encountering a 5M-view launch post is not trying to parse a deployment taxonomy. They are deciding in a fraction of a second whether this reply is interesting, likable, useful, funny, surprising, or worth following.

The canonical fix is not "dumb it down." It is:

> **say the obvious human truth first, then earn the right to be technical.**

---

# Final synthesis

After four passes, the strongest lesson is not a hook formula.

It is this:

> **Write like a technically sharp person talking to another smart person — not like a research note trying to prove it is technically sharp.**

The best creator posts in this corpus repeatedly make difficult ideas feel easier than they were before the reader arrived.

That should be the standard for `@ham_zax`.
