# Niche and Keyword Map

This document describes the default preferences and technical universe for `@ham_zax`. The runtime source of truth is the persisted Growth Focus profile; `strategy.js` supplies defaults plus schema/normalization. Preferred content groups and broader audience/scope groups can be added, removed, renamed, reweighted, or disabled without code changes. Preferred groups bias selection; they do not hard-block a strong unregistered technical opportunity.

The goal is not to become a generic technology-news account or an AI-only account. The account should be recognizable as a **developer and builder in tech**: strongly inclined toward software development and the registered Growth Focus topics, but able to exploit worthwhile adjacent or newly emerging technical conversations. AI-assisted development is one topic family inside that identity.

## 1. Positioning

Primary positioning:

> I make software development easier to understand and use, from frontend and backend to Python, Rust, databases, devtools, infrastructure, shipping products, and AI-assisted engineering.

Short form:

> Software developer + builder.

Audience promise:

> Following this account should save a developer research time, expose useful tools early, improve technical judgment, or teach something immediately applicable.

## 2. Primary audience

The core audience is:

- software developers using or evaluating AI-assisted development;
- developers experimenting with coding agents, MCP, CLIs, local models, and automation;
- full-stack and backend developers who want practical engineering leverage;
- indie hackers and technical founders shipping developer-facing or AI-enabled products;
- early-career developers who want to understand modern tooling without drowning in hype;
- experienced developers who value concise experiments, trade-offs, benchmarks, and implementation details.

Secondary audience:

- AI researchers and model enthusiasts when the topic has developer implications;
- open-source maintainers;
- product engineers;
- developer-relations and infrastructure builders;
- technical founders interested in distribution, pricing, sales, and customer discovery.

## 3. Core content pillars

### A. AI-assisted development and coding agents

One important default pillar, not the parent category for the account.

Examples:

- coding agents;
- agentic software development;
- repository-scale coding;
- code review agents;
- autonomous debugging;
- subagents;
- computer-use agents;
- agent orchestration;
- agent memory;
- agent evaluation;
- tool use;
- MCP;
- agent-friendly APIs and CLIs;
- local coding agents;
- terminal agents;
- IDE agents.

Reader value:

- which agent actually works;
- where it fails;
- how to integrate it;
- whether it is cheaper/faster/better than alternatives;
- useful prompts, configs, workflows, and implementation patterns.

### B. Models that matter to developers

Model news is in scope only when there is a concrete developer implication.

Examples:

- new frontier models;
- open-weight coding models;
- local models;
- inference speed;
- context length;
- tool use;
- structured outputs;
- multimodality;
- reasoning models;
- price/performance;
- benchmark changes that affect real engineering decisions.

Preferred angle:

> What changed for a developer?

Avoid:

> Model X launched. Here are the benchmark numbers.

### C. Developer tools and infrastructure

Examples:

- IDEs;
- terminals;
- databases;
- deployment platforms;
- sandboxes;
- observability;
- testing tools;
- API tooling;
- browser automation;
- dev containers;
- local development;
- Linux tooling;
- package ecosystems;
- security tooling;
- developer productivity;
- open-source infrastructure.

### D. Open-source discoveries

Good candidates:

- fast-growing repositories with genuine utility;
- small projects solving a painful developer problem;
- new agent infrastructure;
- clever libraries;
- useful CLIs;
- self-hostable tools;
- developer-facing AI projects.

The post should explain **why the repository matters**, not merely report star count.

### E. Building products as a developer

Examples:

- building in public;
- shipping MVPs;
- technical product decisions;
- SaaS;
- developer tools businesses;
- AI products;
- pricing;
- distribution;
- customer discovery;
- sales for technical founders;
- product-market fit;
- launch lessons;
- failed experiments;
- revenue lessons;
- founder engineering trade-offs.

This pillar keeps the account connected to the user's own journey rather than becoming a news aggregator.

### F. Developer judgment and opinions

Examples:

- tool comparisons;
- architecture opinions;
- workflow trade-offs;
- "I stopped using X because Y";
- "the benchmark everyone is discussing misses Z";
- unpopular but defensible engineering views;
- developer culture and humor when it reinforces the niche.

Strong opinions require evidence or firsthand reasoning. Avoid outrage for its own sake.

### G. Networking and interesting builders

Examples:

- highlighting a useful project from another developer;
- quote-posting a technical insight with additional context;
- introducing two related ideas or tools;
- recognizing interesting open-source work;
- replying to a builder with a specific question or technical observation.

The purpose is genuine network formation, not synthetic engagement.

## 4. Content mix target

Use the active Growth Focus `targetShare` values as a planning bias, not rigid quotas. The default profile currently allocates:

- 20% AI-assisted development + models/inference;
- 14% JavaScript/TypeScript/frontend;
- 14% Node.js/backend/APIs;
- 10% Python engineering;
- 10% Rust/Go/systems;
- 8% databases/data systems;
- 10% developer tools/open source;
- 9% infrastructure/architecture;
- 5% building and shipping software.

The percentages are normalized at runtime. Change them in Growth Focus rather than editing ranking code. A short window can deviate when one topic has unusually strong evidence or momentum; topic balance is a bounded ranking adjustment, not a quota that forces weak content.

## 5. Core keyword groups

Keywords are discovery inputs, not instructions to post every match.

### Coding agents and agent infrastructure

`coding agent`
`coding agents`
`AI coding`
`AI developer tools`
`agentic coding`
`software agents`
`developer agent`
`subagents`
`multi-agent`
`agent orchestration`
`agent framework`
`agent runtime`
`agent memory`
`agent evals`
`agent evaluation`
`tool calling`
`computer use`
`browser agent`
`terminal agent`
`CLI agent`
`repo agent`
`code review agent`
`autonomous coding`
`AI pair programmer`
`MCP`
`Model Context Protocol`
`MCP server`
`MCP client`
`skills`
`agent skills`

### Coding products and IDEs

`Codex`
`Claude Code`
`Cursor`
`OpenCode`
`Windsurf`
`Copilot`
`GitHub Copilot`
`Cline`
`Roo Code`
`Aider`
`Zed`
`VS Code`
`IDE agents`
`AI IDE`

Names should be refreshed as products gain or lose relevance.

### Models and inference

`LLM`
`reasoning model`
`coding model`
`open model`
`open weights`
`local LLM`
`local model`
`inference`
`inference speed`
`tokens per second`
`context window`
`long context`
`structured output`
`function calling`
`tool use`
`multimodal`
`benchmark`
`Terminal-Bench`
`SWE-bench`

Watchlist entities include, when relevant:

`OpenAI`
`Anthropic`
`Claude`
`Google DeepMind`
`Gemini`
`xAI`
`Grok`
`DeepSeek`
`Qwen`
`GLM`
`MiniMax`
`Mistral`
`Meta AI`
`Llama`

### Developer tooling

`devtools`
`developer tools`
`developer experience`
`DX`
`CLI`
`SDK`
`API`
`TypeScript`
`Node.js`
`JavaScript`
`React`
`Next.js`
`Postgres`
`database`
`observability`
`sandbox`
`Firecracker`
`container`
`Docker`
`Linux`
`deployment`
`serverless`
`edge runtime`
`web automation`
`browser automation`
`security tooling`

### Open source

`open source`
`open-source`
`GitHub repo`
`GitHub repository`
`OSS`
`self-hosted`
`self host`
`Apache 2.0`
`MIT license`
`new repo`
`released on GitHub`
`starred`
`stars/day`

### Building and business

`build in public`
`indie hacker`
`developer founder`
`technical founder`
`micro SaaS`
`SaaS`
`AI SaaS`
`developer tools startup`
`MVP`
`shipping`
`launch`
`product launch`
`customer discovery`
`distribution`
`GTM`
`go to market`
`developer marketing`
`pricing`
`sales`
`outreach`
`revenue`
`MRR`
`ARR`
`product market fit`

### Networking and opportunity

`hiring developers`
`looking for engineers`
`open source contributors`
`maintainer`
`founder looking for`
`developer community`
`hackathon`
`launching today`
`feedback wanted`
`show HN`

These terms should be combined with niche terms to avoid generic recruitment or spam.

## 6. High-value keyword combinations

Single broad keywords are noisy. Prefer combinations that imply a useful story.

Examples:

- `coding agent` + `open source`
- `coding model` + `benchmark`
- `Claude Code` + `workflow`
- `Codex` + `MCP`
- `MCP` + `server` + `open source`
- `local model` + `coding`
- `Qwen` + `local` + `RAM`
- `DeepSeek` + `agent`
- `GLM` + `coding`
- `developer tool` + `launch`
- `GitHub` + `agent`
- `sandbox` + `agent security`
- `terminal` + `agent`
- `open source` + `developer tools`
- `AI SaaS` + `developer`
- `technical founder` + `distribution`
- `developer` + `sales`
- `Show HN` + `AI`

## 7. Source-account clusters

The source list should evolve from the account's actual Likes and high-quality discoveries.

Current useful clusters include:

### AI/model builders

- major model labs and their developer accounts;
- open-model teams;
- researchers publishing agent/coding results.

### Developer-tool builders

- Vercel and relevant engineers;
- GitHub and relevant engineers;
- coding-agent companies;
- IDE and terminal-tool creators;
- open-source maintainers.

### Developer voices

Examples from recent liked content include accounts such as Theo / t3.gg and other engineers who mix tooling observations with strong practical opinions.

### Builder/founder accounts

Prefer technical founders who share actual product, distribution, revenue, launch, or engineering lessons instead of motivational business content.

Do not hard-code the entire source universe forever. Likes, replies, bookmarks, and consistently high-value posts should promote new sources over time.

## 8. Negative and exclusion keywords

These are signals to lower priority unless directly relevant to a developer story:

`giveaway`
`airdrop`
`follow for follow`
`like for like`
`engagement group`
`engagement pod`
`retweet to win`
`comment to win`
`free money`
`crypto pump`
`memecoin`
`casino`
`betting`
`celebrity gossip`
`political outrage`
`ragebait`
`viral thread`
`motivational quote`

Crypto/Web3 is not globally banned, but it should only surface when it intersects materially with developer infrastructure, software engineering, security, or a firsthand project.

## 9. Candidate qualification rule

A keyword match alone is never sufficient.

A candidate should normally satisfy at least three of these:

1. strong niche fit;
2. concrete developer utility;
3. fresh or accelerating attention;
4. credible primary evidence;
5. an angle not already repeated across the feed;
6. an opportunity for firsthand testing;
7. a meaningful technical or product trade-off;
8. likely to be shared with another developer;
9. likely to make the right reader want more posts from this account.

If the candidate is merely "news happened," skip it unless we can add useful interpretation.

## 10. Account identity invariant

Before publishing, ask:

> If a developer saw only this post, would it make sense that the same account also posts about coding agents, developer tools, open source, building software products, and technical founder lessons?

If no, the topic is probably outside the account's intended identity.

## 11. Keyword-maintenance invariant

The keyword map is a living research asset.

Add a keyword when repeated evidence shows that it leads to useful niche content.

Remove or down-rank a keyword when it produces mostly noise, spam, generic news, or off-niche content.

Never optimize the account around a keyword merely because it is trending.

## 12. Deep research ownership

Keywords are discovery inputs; they are not the account's intellectual property.

Use `RESEARCH_AGENDA.md` to turn the strongest keyword clusters into repeatable research programs around coding-agent reliability, agent context/memory, MCP/tool-use architecture, coding-model cost/reliability, sandboxes, local/open models, observability, security, agent-native tooling, AI careers, and devtool economics.

The preferred progression is:

> keyword/signal → precise developer question → primary evidence → experiment/reproduction → decision rule → original post/thread/tool.

A topic that repeatedly produces only summaries should be deprioritized relative to one that produces original evidence or reusable developer judgment.
