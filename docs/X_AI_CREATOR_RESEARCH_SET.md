# X AI / Developer Creator Research Set

**Created:** 2026-09-03  
**Purpose:** Phase-1 target inventory for a later read-only study of high-performing X accounts whose audiences overlap `@ham_zax`.

## 1. Scope

This is not a generic "AI influencer" list.

The account positioning in `docs/NICHE_AND_KEYWORDS.md` is **software developer + builder**, with AI-assisted engineering as one major pillar rather than the parent category. The study set therefore favors individual people who sit near one or more of these lanes:

- AI-assisted software development, coding agents, agent harnesses, model APIs;
- AI/ML research with direct developer implications;
- devtools, frameworks, infrastructure, open source, systems, shipping;
- technical founders and indie builders who ship AI-enabled software in public;
- creators whose audience substantially overlaps developers/builders and whose distribution behavior is worth studying.

Corporate, lab, publication, and media-brand accounts are excluded even when they have larger followings.

## 2. Selection gates

A person enters the main set when they satisfy the following Phase-1 gates:

1. **Individual account** rather than an organization.
2. **At least 100K X followers** at the 2026-09-03 XActions profile snapshot.
3. **Material niche overlap** with the Growth OS audience.
4. At least one of:
   - repeated appearance in current/recent high-engagement AI/dev streams;
   - repeated inclusion in current AI researcher/developer/founder curation;
   - unusually strong technical authority whose posting behavior is useful as a contrast class.

Important: "most of their tweets go viral" is **not treated as proven in Phase 1**. Raw follower count or a few famous posts cannot establish that. Phase 2 must measure each author's recent post distribution and compute a within-author hit rate / breakout rate.

## 3. Evidence used

### Primary account facts

Follower counts below come from the installed `xactions` public profile reader (`Scraper.getProfile`) on 2026-09-03. This path reads current public X profile metadata without taking over the logged-in browser.

### Current discovery / activity evidence

Current and recent author surfacing was cross-checked against Tech Twitter's 2026 AI/developer/founder hubs and recent daily trend archives:

- https://www.techtwitter.com/profiles/ai-researchers
- https://www.techtwitter.com/profiles/developers
- https://www.techtwitter.com/profiles/startup-founders
- https://www.techtwitter.com/topics/developer-tools-twitter
- https://www.techtwitter.com/twitter-trending/2026-08-29
- https://www.techtwitter.com/twitter-trending/2026-08-30

Tech Twitter is used as a **discovery/current-signal source**, not as the source of truth for follower counts.

### XActions timeline behavior discovered during this pass

Two different read modes matter:

- unauthenticated `xactions analyze` can return a non-recent / algorithmic sample and must **not** be interpreted as the latest timeline;
- the repo's credentialed `fetchXTargetRecentPosts()` path in `tech_news.js` returned genuinely current September 2026 posts, including current views/likes/reposts/replies, for sampled targets such as `@levelsio` and `@theo`.

The credentialed target path subsequently hit X rate limiting (`429`), so Phase 2 should collect in bounded batches and persist results rather than repeatedly refetching the same accounts.

## 4. Main study set: 52 people

### Tier A — direct harvest set

Start Phase 2 here. These accounts have the best combination of niche overlap, current/recent activity signal, and distribution value.

| # | Person | X handle | Followers | Main lane | Why study |
|---:|---|---|---:|---|---|
| 1 | Pieter Levels | `@levelsio` | 947,710 | AI indie builder | Extremely high posting velocity; ships AI products in public; repeatedly surfaced in Aug-2026 trend archives. |
| 2 | Theo Browne | `@theo` | 381,057 | AI coding / developer | High-volume developer commentary, fast model/tool reactions, strong quote-post behavior, repeated current trend appearances. |
| 3 | Guillermo Rauch | `@rauchg` | 845,774 | AI devtools / Vercel | Founder + deeply technical developer audience; current agentic/software-engineering commentary; strong launch framing. |
| 4 | Aravind Srinivas | `@AravSrinivas` | 1,100,220 | AI agents / search / founder | Very active product/research founder; current posts repeatedly cover agent APIs, local inference, model orchestration, and developer platforms. |
| 5 | Gergely Orosz | `@GergelyOrosz` | 352,392 | Software engineering | Strong developer trust; consistently converts engineering observations and current AI-coding shifts into high-signal posts. |
| 6 | Michael Truell | `@mntruell` | 225,875 | AI coding / founder | High-interest coding-agent founder account; current launch/industry events create unusually concentrated engagement. |
| 7 | Boris Cherny | `@bcherny` | 566,988 | Claude Code / agentic coding | Direct builder of a major coding agent; technical implementation notes and announcements are highly relevant to the target audience. |
| 8 | Peter Steinberger | `@steipete` | 582,553 | AI agents / open source | Builder-first, high-frequency, experimental agent content; strong fit for learning demo and shipping formats. |
| 9 | Dax | `@thdxr` | 167,117 | OpenCode / developer tools | Dense developer audience, opinionated implementation posts, strong current coding-agent relevance. |
| 10 | Matt Pocock | `@mattpocockuk` | 340,894 | Developer education / AI coding | Converts technical workflows into compact, actionable formats; repeatedly surfaces in current developer streams. |
| 11 | Riley Brown | `@rileybrown` | 237,852 | Agent-native / vibe coding | Fast-moving AI-building content with strong developer/product crossover; appears in current trend streams. |
| 12 | Ethan Mollick | `@emollick` | 381,271 | Applied AI | Very high output and repeated current curation; useful for studying concise claims, evidence framing, and model/tool implications. |
| 13 | Greg Brockman | `@gdb` | 1,039,856 | Frontier AI / founder | Large technical AI audience; high-engagement launch and research communication. |
| 14 | Sam Altman | `@sama` | 6,100,665 | Frontier AI / founder | Massive distribution and high-impact concise posts; useful as a large-account contrast, not as a direct style template. |
| 15 | Dario Amodei | `@DarioAmodei` | 638,569 | Frontier AI / founder | Very low-volume but high-consequence posts; useful for scarcity/authority effects and long-form thesis distribution. |
| 16 | Amjad Masad | `@amasad` | 487,157 | AI coding / founder | Replit/agentic-building audience overlaps strongly with developers and technical founders. |
| 17 | Greg Isenberg | `@gregisenberg` | 704,232 | AI products / founder | High-volume idea and product framing; strong distribution mechanics for builder/founder audiences. |
| 18 | Alex Finn | `@AlexFinn` | 472,969 | Vibe coding / solo building | Repeated high-engagement AI-building posts; useful for hooks, demos, quantified shipping narratives, and audience conversion. |
| 19 | Marc Lou | `@marclou` | 382,154 | Indie building / AI | Build-in-public, revenue/result framing, short emotional hooks; current trend visibility. |
| 20 | Andrew Ng | `@AndrewYNg` | 1,852,050 | AI engineering / education | Current 2026 material explicitly addresses coding agents and software-engineering fundamentals; large practitioner audience. |
| 21 | Matt Shumer | `@mattshumer_` | 385,834 | AI builder / investor | Fast-moving frontier-model and practical-AI commentary with strong builder audience. |
| 22 | Logan Kilpatrick | `@OfficialLoganK` | 362,747 | Gemini / developer platform | Model/API/dev-platform communication; strong fit for launch and developer-use-case analysis. |
| 23 | Harrison Chase | `@hwchase17` | 128,609 | LangChain / agents | Technical agent-builder audience; useful for framework announcements, demos, and ecosystem conversation patterns. |
| 24 | Simon Willison | `@simonw` | 215,624 | LLM engineering / open source | High technical credibility, concrete experiments, source-backed observations, and strong developer overlap. |
| 25 | shadcn | `@shadcn` | 239,725 | UI/devtools / AI building | Developer-native terse posting, shipping artifacts, and product demos; strong design/dev crossover. |
| 26 | swyx | `@swyx` | 187,704 | AI engineering / developer community | AI-engineer ecosystem, agents, developer tooling, and event/network effects; useful for network + content behavior. |
| 27 | Mckay Wrigley | `@mckaywrigley` | 228,130 | AI building / education | Practical AI-building tutorials and demos aimed directly at builders. |
| 28 | Elvis Saravia | `@omarsar0` | 316,003 | AI research / agents education | High-signal technical curation, agents, papers, and practical implementation content. |

### Tier B — technical authority / contrast set

These accounts are highly relevant, but some have lower cadence, narrower technical focus, or authority effects that can distort direct comparison with a 100K-500K creator. Keep them in the study, but analyze them separately from the high-frequency Tier-A cohort.

| # | Person | X handle | Followers | Main lane | Why study |
|---:|---|---|---:|---|---|
| 29 | Andrej Karpathy | `@karpathy` | 4,080,311 | Deep learning / AI coding | Exceptional ability to coin durable concepts and compress technical shifts into memorable language. |
| 30 | Francois Chollet | `@fchollet` | 721,485 | AI research / reasoning | Strong technical theses, benchmark/reasoning discourse, and high authority among ML practitioners. |
| 31 | Sebastian Raschka | `@rasbt` | 500,055 | ML engineering / education | Repeatedly curated technical AI posts; strong explanatory and diagram/code-driven formats. |
| 32 | Jim Fan | `@DrJimFan` | 579,852 | Physical AI / robotics | Research announcements and future-facing technical narratives with strong visual/demo potential. |
| 33 | Alexandr Wang | `@alexandr_wang` | 648,712 | Frontier AI / Meta | High-interest model and AI-infrastructure commentary; useful for release/reaction mechanics. |
| 34 | George Hotz | `@realGeorgeHotz` | 303,378 | AI systems / hacker | Highly technical, opinionated, builder-native audience; useful contrast against polished corporate communication. |
| 35 | Alex Albert | `@alexalbert__` | 149,487 | Anthropic research | Technical model/research account with strong frontier-AI relevance. |
| 36 | Yann LeCun | `@ylecun` | 1,287,400 | AI research | Large research audience and debate-heavy distribution; useful for studying technical controversy separately from normal posts. |
| 37 | Jeremy Howard | `@jeremyphoward` | 327,340 | Applied ML / open source | Practical ML systems, education, and open-source framing; strong builder credibility. |
| 38 | Chip Huyen | `@chipro` | 143,486 | AI systems engineering | Direct match for AI engineering, production systems, and practitioner education. |
| 39 | Fei-Fei Li | `@drfeifei` | 1,035,336 | AI / spatial intelligence | High-authority research communication; useful for launch/thesis framing at >1M scale. |
| 40 | Demis Hassabis | `@demishassabis` | 1,813,878 | Frontier AI / science | High-authority, high-consequence announcements; study separately for institutional amplification effects. |
| 41 | Mira Murati | `@miramurati` | 988,543 | Frontier AI / founder | Major AI founder account near the 1M band; useful for product/research announcement framing. |
| 42 | John Carmack | `@ID_AA_Carmack` | 3,879,959 | AGI / systems engineering | Deep technical authority and unusually substantive engineering discourse; useful long-form/technical contrast. |
| 43 | Shubham Saboo | `@Saboo_Shubham_` | 120,306 | AI agents / open source | Right at the lower follower band we want to understand; practical agent/RAG/open-source content. |
| 44 | Bindu Reddy | `@bindureddy` | 380,079 | AI models / founder | Active model/tool opinions and product communication with a large AI-native audience. |

### Tier C — adjacent distribution set

These accounts are valuable for distribution, builder psychology, or developer communication, but they should **not** dominate the learned style because their content mix is broader than the target niche.

| # | Person | X handle | Followers | Main lane | Why study |
|---:|---|---|---:|---|---|
| 45 | Rowan Cheung | `@rowancheung` | 596,533 | AI news / creator | Strong information compression and rapid-release framing; useful for speed/packaging, not technical-depth imitation. |
| 46 | Dan Shipper | `@danshipper` | 122,203 | Applied AI / media founder | AI workflows, experiments, and founder framing with practical audience overlap. |
| 47 | Sahil Lavingia | `@shl` | 391,737 | Technical founder / indie building | Concise founder observations, product experiments, and developer-builder audience overlap. |
| 48 | DHH | `@dhh` | 864,024 | Software engineering / founder | Extremely active developer account with strong opinion distribution; useful for studying conviction and disagreement mechanics. |
| 49 | Lee Robinson | `@leerob` | 285,499 | Developer tools / model behavior | Strong developer audience and current AI/model relevance. |
| 50 | Addy Osmani | `@addyosmani` | 409,462 | Web engineering / AI devtools | Long-running developer authority now overlapping AI/Gemini/agent-skills work. |
| 51 | Peter Yang | `@petergyang` | 281,588 | Practical AI / product | Tutorial and interview packaging for busy practitioners; useful for utility-driven hooks. |
| 52 | Linus Ekenstam | `@LinusEkenstam` | 240,025 | AI tools / creator | Fast AI-tool/news packaging; use as a creator-format comparison, not as the technical-quality baseline. |

## 5. Reserve pool

Do not discard these. Add them if Phase 2 needs a larger sample, a specific follower band, or a contrast class.

| Person | Handle | Followers | Reason held in reserve |
|---|---|---:|---|
| Jeff Dean | `@JeffDean` | 519,618 | Very high technical authority, but current posting cadence appears much lower than the direct study cohort. |
| Ilya Sutskever | `@ilyasut` | 881,925 | Extremely high authority but low-frequency communication. |
| Jensen Huang | `@JensenHuang` | 1,040,004 | Large AI audience, but the X profile itself has very low post count; institutional amplification is a major confounder. |
| Paul Graham | `@paulg` | 5,100,282 | Enormous founder distribution, but content is broader than AI/developer tooling. |
| Nat Friedman | `@natfriedman` | 460,630 | Strong AI/open-source network; broader investor/founder mix. |
| Patrick Collison | `@patrickc` | 1,703,906 | Excellent technical-founder account but broader than the AI-first study. |
| Deedy Das | `@deedydas` | 253,273 | Strong technical/AI network, but investor role can distort audience behavior. |
| Lenny Rachitsky | `@lennysan` | 440,028 | Product/growth rather than developer-first. |
| Dwarkesh Patel | `@dwarkesh_sp` | 269,903 | High AI relevance and engagement, but interview/media mechanics differ from builder accounts. |
| Allie K. Miller | `@alliekmiller` | 108,278 | AI-business creator; lower developer overlap. |
| Wes Bos | `@wesbos` | 438,425 | Excellent developer creator, but less AI-centered. |
| Adam Wathan | `@adamwathan` | 297,743 | Excellent devtool/founder account; less AI-centered. |

## 6. Follower-band coverage

The main set intentionally spans the bands requested for comparison:

- **100K-249K:** examples include `@Saboo_Shubham_`, `@hwchase17`, `@chipro`, `@thdxr`, `@swyx`, `@simonw`, `@mckaywrigley`, `@rileybrown`, `@shadcn`.
- **250K-499K:** examples include `@theo`, `@GergelyOrosz`, `@mattpocockuk`, `@mattshumer_`, `@amasad`, `@AlexFinn`, `@shl`, `@bindureddy`, `@addyosmani`, `@petergyang`.
- **500K-999K:** `@rasbt`, `@bcherny`, `@steipete`, `@rowancheung`, `@DarioAmodei`, `@alexandr_wang`, `@fchollet`, `@rauchg`, `@dhh`, `@levelsio`, `@miramurati`.
- **1M+:** `@AravSrinivas`, `@gdb`, `@drfeifei`, `@ylecun`, `@demishassabis`, `@AndrewYNg`, `@ID_AA_Carmack`, `@karpathy`, `@sama`.

This lets Phase 2 distinguish patterns that survive scale from patterns that only work for already-famous accounts.

## 7. Phase 2: tweet curation and behavior analysis

### 7.1 Collection unit

For each Tier-A account first:

1. Fetch the latest **50-100 main-feed posts** through the existing authenticated XActions target-timeline path.
2. Keep originals and quote posts as separate types.
3. Exclude reposts from content-style analysis.
4. Collect replies separately; replies are behavior/network evidence, not directly comparable to main-feed distribution.
5. Persist the raw post snapshot once so rate limits do not cause repeated reads.
6. Record follower count at collection time so normalized metrics are reproducible.

Expand to Tier B only after Tier A is fully captured.

### 7.2 Metrics to compute

For each post:

- views;
- likes;
- reposts;
- replies;
- `interactions = likes + reposts + replies`;
- `reach_rate = views / followers`;
- `interaction_rate_by_followers = interactions / followers`;
- `interaction_rate_by_views = interactions / views` when views are available;
- media / no media;
- original / quote;
- post length and line count;
- URL, timestamp, day/hour;
- quoted account and mentioned accounts.

For each author:

- median / p75 / p90 / max views and interactions;
- posting cadence;
- median reach rate;
- median interaction rate;
- `p90 / median` breakout ratio;
- share of posts above 2x and 3x the author's own median;
- share of posts whose views exceed follower count;
- share of top-decile posts by format/topic/hook class.

### 7.3 Define "viral" comparatively, not by a single raw threshold

Do not call a 10K-like post from a 6M account equivalent to a 10K-like post from a 150K account.

Primary Phase-2 measures should be within-author and follower-normalized:

- **Relative breakout:** post interactions / author's recent median interactions.
- **Reach breakout:** post views / author's follower count and / author's recent median views.
- **Viral density:** share of recent posts that are at least 3x the author's recent median interactions **or** reach at least 1.0x the author's follower count in views.
- **Consistency:** median performance plus the p25 floor, not only the maximum hit.

The exact cutoffs can be tuned after inspecting the empirical distribution, but the analysis must remain relative rather than using follower-blind raw likes.

### 7.4 Content features to label

For each post, classify observable features rather than inventing causal stories:

- opening hook: assertion, surprise, question, disagreement, prediction, result, demo, release, warning, number/data, personal observation;
- content intent: teach, report, react, persuade, entertain, ship, ask, compare, recruit conversation;
- novelty type: new information, new framing, first-hand experiment, contrarian interpretation, hidden utility/resource;
- proof: screenshot, benchmark, code, chart, live product, quoted source, personal result, no proof;
- specificity: concrete names/numbers/commands vs abstract claim;
- tone: terse, conversational, technical, provocative, playful, authoritative;
- structure: one-liner, multi-line short post, compact list, long post, thread;
- visual type: none, screenshot, UI demo, chart, meme, video;
- call to action: none, reply prompt, link, try this, follow-up promise;
- temporal hook: breaking release, current controversy, launch window, evergreen;
- quote-post strategy: agreement, disagreement, amplification, reframing, joke, added technical context.

### 7.5 Behavior / network features

The study should also measure what these people *do*, not only what their text looks like:

- original-to-quote-to-reply mix;
- which high-authority accounts they quote/reply to;
- recurring interaction clusters;
- how quickly they react to model/tool launches;
- whether they post multiple follow-ups around one event;
- whether product demos are preceded/followed by conversational posts;
- how often they surface their own work versus external news;
- whether a viral post is followed by a conversion-oriented post;
- whether they reuse a topic across different formats.

### 7.6 Comparison design

Analyze in this order:

1. **Within author** — winning posts vs that author's own baseline.
2. **Within follower band** — 100-249K, 250-499K, 500-999K, 1M+.
3. **Within lane** — AI research, coding agents/devtools, technical founder, developer educator/creator.
4. **Across lanes** only after normalization.

This prevents celebrity/institutional amplification from being mistaken for a transferable writing technique.

## 8. Recommended Phase-2 execution order

### Batch 1 — highest transfer value

`levelsio`, `theo`, `rauchg`, `GergelyOrosz`, `thdxr`, `mattpocockuk`, `steipete`, `rileybrown`, `simonw`, `mckaywrigley`

### Batch 2 — AI/coding founder distribution

`AravSrinivas`, `mntruell`, `bcherny`, `amasad`, `gregisenberg`, `AlexFinn`, `marclou`, `danshipper`, `shl`, `OfficialLoganK`

### Batch 3 — research/authority contrast

`karpathy`, `AndrewYNg`, `fchollet`, `rasbt`, `DrJimFan`, `emollick`, `gdb`, `DarioAmodei`, `alexandr_wang`, `realGeorgeHotz`

Then fill the remaining Tier-A/Tier-B accounts once the schema and rate-limit behavior are stable.

## 9. Implementation fit with the existing Growth OS

Do **not** build a parallel scraper unless the current owners prove insufficient.

Useful existing pieces already in the repo:

- `tech_news.js::fetchXTargetRecentPosts()` — current targeted public-post retrieval when authenticated;
- `xactions` `Scraper.getProfile()` — current follower/profile facts;
- `viral_style_research.js` / `viral_style.js` / `viral_style_analyze.js` — existing read-only external research and style/performance analysis stack;
- Growth OS niche/audience definitions — the source of relevance filtering.

The clean Phase-2 design is therefore:

**selected creator set -> bounded targeted timeline capture -> persisted raw observations -> normalized author/band metrics -> style/intent labels -> observational findings**

Do not feed external findings directly into posting rules as if they were causal. A pattern should remain external observational evidence until our own-account outcomes or an explicit experiment support transfer.

## 10. Current operational note

A separate isolated browser session was created for this research so the existing browser session would not be touched. Direct X navigation in the fresh logged-out headless browser was rejected by X, and the managed Clearcote route timed out during allocation. Neither failure blocks this program because the relevant X profile/timeline reads are available through XActions.

For the next phase, prefer the XActions targeted timeline path first. Use a browser only for spot verification or information XActions does not expose.
