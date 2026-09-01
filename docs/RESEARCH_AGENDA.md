# Deep Research Agenda

This document contains research methods and example deep-dive backlogs for `@ham_zax`. **It is not the runtime topic-priority list.** Recurring research topics and tiers come from registered Growth Focus content groups. A one-off or emerging technical topic does not need to be registered before the operator can use it; open-world exploratory topics can compete on momentum first and only become a recurring research niche if they prove worth registering. The detailed AI sections retained below are useful backlog examples, not evidence that AI should dominate current content.

## 1. Research thesis

The account should become known for answering:

> **What actually helps a software developer build and ship better software?**

That question can cover JavaScript/TypeScript/frontend, Node.js/backend/APIs, Python, Rust/Go/systems, databases, devtools/open source, infrastructure, product building, and AI-assisted development. Growth Focus decides which of those—or later-added groups—are active and how strongly they should be represented.

The research advantage should come from four behaviors:

1. **Filter** — identify the small part of a release or trend that matters to developers.
2. **Test** — reproduce claims or apply tools to realistic engineering work.
3. **Judge** — explain the tradeoff rather than only reporting the result.
4. **Implement** — leave the reader with a workflow, command, pattern, benchmark, architecture choice, or next experiment.

## 2. Priority research bets

### Tier 1 — Build account-level intellectual ownership

#### A. Coding-agent reliability and evaluation

Core question:

> What makes a coding agent reliably complete real software work rather than win isolated benchmarks?

Research deeply:

- long-horizon task completion;
- repo navigation and codebase understanding;
- planning vs execution;
- state loss between tool calls;
- retry loops;
- test/verification behavior;
- silent code corruption;
- dependency/configuration mistakes;
- failure recovery;
- human intervention rate;
- monorepo behavior;
- multi-file changes;
- debugging tasks vs greenfield generation;
- benchmark validity vs actual engineering usefulness.

Useful recurring experiments:

- same real repo task across Claude Code / Codex / OpenCode / Cursor / open models;
- success rate with and without a task ledger;
- success rate with explicit verification commands;
- failure taxonomy over 20-50 comparable tasks;
- benchmark winner vs cheapest reliable model by task type.

Strong content outputs:

- original benchmark;
- failure-mode post;
- thread with methodology;
- agent-evaluation harness/repo;
- practical decision matrix.

#### B. Agent context, memory, and state

Core question:

> What information should a coding agent remember, retrieve, compress, or discard during long tasks?

Research deeply:

- context-window saturation;
- summarization/compression;
- retrieval strategies;
- episodic task memory;
- persistent task ledgers;
- subagent handoff;
- artifact/state storage;
- prompt/context drift;
- when more context reduces quality;
- repo maps;
- semantic retrieval vs explicit file references;
- context cost vs success rate.

Experiment ideas:

- same task with full context vs compressed ledger;
- model performance as context accumulates;
- durable task state across interrupted sessions;
- compare agent memory designs on a multi-hour task.

#### C. MCP and tool-use architecture

Core question:

> What makes software genuinely usable by autonomous/semi-autonomous agents?

Research deeply:

- MCP protocol/tool design;
- schema quality;
- tool discovery;
- permission boundaries;
- tool-call reliability;
- tool result compression;
- authentication and secrets;
- filesystem/network restrictions;
- agent-friendly error messages;
- context overhead from tools;
- local vs remote MCP servers;
- security boundaries;
- tool versioning;
- deterministic APIs vs UI automation.

Potential recurring format:

> “Would an agent actually be able to use this API/tool reliably?”

#### D. Coding-model cost × reliability

Core question:

> Which model is the best engineering choice for a specific task once cost, retries, latency, and human intervention are included?

Track:

- Claude-family coding models;
- Codex/OpenAI coding models;
- GLM;
- Qwen;
- DeepSeek;
- Kimi;
- MiniMax;
- other open/local coding models that become relevant.

Measure:

```text
success rate
wall-clock latency
tokens
API cost
retries
human interventions
tool-call failures
verification failures
```

Avoid generic leaderboard reposting. Convert model releases into task-level developer decisions.

### Tier 2 — Strong technical differentiation

#### E. Agent sandboxing and execution environments

Research:

- containers;
- Firecracker/microVMs;
- WebAssembly;
- ephemeral workspaces;
- browser sandboxes;
- network controls;
- secret injection;
- filesystem isolation;
- package installation;
- execution timeouts;
- resource quotas;
- audit logs.

Core content angle:

> Coding agents are useful only when they can execute safely and reproducibly.

#### F. Local/open coding models

Research:

- Ollama;
- llama.cpp;
- vLLM;
- quantization;
- VRAM requirements;
- throughput;
- speculative decoding;
- tool calling;
- structured output;
- local privacy;
- coding quality by task class;
- hybrid local/API routing.

Question to own:

> Which engineering tasks can move from premium APIs to local/open models without unacceptable reliability loss?

#### G. Agent observability

Research:

- traces;
- tool-call logs;
- token/cost attribution;
- replay;
- failure taxonomies;
- eval dashboards;
- regression evaluation;
- state inspection;
- prompt versioning;
- distributed/multi-agent traces.

Core question:

> How do you debug an AI worker when the failure is probabilistic rather than a deterministic stack trace?

#### H. AI coding security

Research:

- prompt injection from repos/docs/issues;
- malicious dependencies;
- credential exfiltration;
- unsafe shell execution;
- MCP trust boundaries;
- tool permission escalation;
- generated-code vulnerabilities;
- package hallucination;
- browser-agent security;
- agent access to production systems.

Strong content should include reproducible defensive guidance rather than fear-based security headlines.

#### I. Agent-native developer tooling

Core question:

> What should software look like when one of its primary users is an agent?

Research:

- machine-readable CLI output;
- stable exit codes;
- structured errors;
- idempotent commands;
- explicit dry-run modes;
- deterministic APIs;
- discoverable schemas;
- documentation structure;
- agent-oriented repository instructions;
- non-interactive workflows;
- local state and checkpoints;
- safe resumability.

This topic connects directly to the tooling principles used in this repository.

### Tier 3 — Developer-to-business translation

#### J. AI engineer and agent-engineering job market

Research:

- skills appearing in real role descriptions;
- AI product engineer vs ML engineer vs agent engineer;
- evaluation engineering;
- inference/model infrastructure;
- software engineering expectations for AI roles;
- location/remote patterns;
- portfolio signals;
- interview requirements;
- common tool stacks.

Avoid becoming a generic job aggregator. Extract career decisions for developers.

#### K. Devtool and AI-product economics

Research:

- inference margins;
- seat pricing vs usage pricing;
- token-plan economics;
- free-tier strategy;
- cost of agent loops;
- model-routing economics;
- support/infra burden;
- OSS-to-cloud conversion;
- developer acquisition cost;
- API monetization.

Content angle:

> Translate architecture choices into product/business consequences.

#### L. Distribution for technical products

Research:

- OSS -> SaaS funnels;
- GitHub distribution;
- documentation as acquisition;
- launch mechanics;
- developer communities;
- founder-led technical content;
- product-led growth;
- technical demos;
- examples/repositories as marketing;
- converting developer attention into users without spam.

## 3. Research protocol

Every deep-research item should aim to produce evidence rather than only notes.

### Stage 1 — Define the decision

Write the developer decision the research should answer.

Examples:

- `Should I move coding-agent task X from Claude to GLM-5.3?`
- `Does a persistent task ledger improve long-horizon completion?`
- `What permissions should an MCP server receive by default?`
- `Can a 24 GB local GPU replace API models for repo navigation?`

If the question cannot change a developer decision, reduce its priority.

### Stage 2 — Gather primary evidence

Prefer:

- source code;
- official docs;
- release notes;
- model cards;
- benchmark implementations;
- reproducible repositories;
- direct experiments;
- pricing/API documentation.

Secondary commentary is useful for finding claims but should not be the only proof of a technical conclusion.

### Stage 3 — Reproduce or test

Where practical, record:

- exact task;
- environment;
- model/tool version;
- prompt/instructions;
- commands;
- timing;
- cost;
- output;
- failure;
- number of retries;
- human intervention.

Do not retroactively invent methodology to make a post more persuasive.

### Stage 4 — Identify the non-obvious result

Ask:

- What surprised us?
- What common interpretation did not survive testing?
- What tradeoff matters more than the headline metric?
- What failed?
- What condition changes the recommendation?

### Stage 5 — Create reusable research assets

A strong investigation should leave one or more reusable artifacts:

- benchmark dataset;
- scripts;
- result table;
- failure taxonomy;
- decision matrix;
- architecture diagram;
- code example;
- notes with primary-source references.

The tweet is a distribution artifact of the research, not the research itself.

## 4. Research-to-content ladder

One deep investigation can generate multiple distinct outputs without copy-pasting the same post:

```text
research question
  -> fast finding
  -> original single post
  -> technical thread
  -> reusable benchmark/repo
  -> follow-up after new version
  -> reply/quote when another builder touches the same problem
```

Every follow-up must contain new evidence or a changed conclusion.

## 5. 30-day starting program

### Week 1 — Establish agent reliability baseline

- Select 5-10 realistic repo tasks.
- Run the same task classes across 2-4 coding agents/models available to us.
- Define a simple failure taxonomy.
- Record human intervention and retries, not only pass/fail.
- Produce one concise finding and one methodology thread only if the sample supports it.

### Week 2 — Context/memory experiment

- Choose one multi-step repo task.
- Compare baseline prompting against a compact persistent task ledger.
- Record context size, retries, state-loss failures, latency, and success.
- Publish the strongest reproducible lesson, not every intermediate run.

### Week 3 — MCP/tool-use architecture

- Pick 2-3 real developer tools/APIs.
- Evaluate how reliably an agent can discover and operate them.
- Document schema/error/permission problems.
- Build an `agent-friendly tool` checklist.

### Week 4 — Cost/reliability decision matrix

- Re-run representative tasks across premium and cheaper/open alternatives.
- Calculate cost per successful completion rather than cost per token only.
- Publish a task-specific decision matrix.
- Use audience replies to identify the next task class worth testing.

## 6. Topic selection score

Before spending several hours on a topic, score it 0-2 on each:

| Dimension | Question |
| --- | --- |
| Niche | Is this central to the active software developer/builder Growth Focus? |
| Developer decision | Could the answer change what someone uses/builds? |
| Testability | Can we gather primary evidence or run something? |
| Novelty | Is there room for a non-obvious conclusion? |
| Reusability | Can this become a repeatable benchmark/checklist/tool? |
| Timeliness | Is there a current trigger that makes the result especially useful? |
| Follow value | Would doing this repeatedly create a reason to follow? |

Prioritize topics scoring 10+ / 14, unless a lower-scoring item is strategically important to a current relationship or product decision.

## 7. Research backlog seeds

Maintain a backlog of concrete questions rather than vague topics.

Examples:

- Does Claude Code's increased usage allowance change the real bottleneck, or does context/tool reliability dominate first?
- Where does GLM-5.3 beat premium coding models on cost per successful repo task?
- How much does a task ledger reduce state-loss failures in long agent runs?
- Which MCP server design choices create the largest context overhead?
- Can structured CLI errors reduce coding-agent retries?
- What happens when a repo contains adversarial instructions for an agent?
- Which coding tasks are safe to route to local open models?
- How should an agent verify a patch before declaring completion?
- How much of coding-agent cost comes from retries rather than first-pass inference?
- What does an AI-engineer job description actually ask for in 2026 across 50 recent roles?
- Which open-source devtools convert attention into hosted-product users effectively, and why?

## 8. Research quality invariant

Do not claim depth because a post is long.

Research is strong when:

- the question is precise;
- evidence is traceable;
- methodology is honest;
- failure is reported;
- uncertainty is preserved;
- the conclusion changes a real decision;
- another developer can reproduce or challenge it.

The target output is not `more content`.

The target is **an accumulating body of developer judgment that makes the account worth following**.

## 9. Conversation-derived research loop

Relationship intelligence should become a research sensor, not only a growth surface.

Every substantive target conversation can generate one of:

```text
unresolved technical question
repeated practitioner pain point
benchmark request
missing comparison
contradictory field result
new edge case
implementation gap
```

When the same question/pain appears repeatedly across relevant conversations, feed it into the research backlog with source relationship/topic context.

Suggested priority modifiers:

- +2 when the question appears independently in >=3 relevant conversations;
- +2 when an authority/maintainer target explicitly asks or disputes the point;
- +2 when answering it would strengthen weak `ProfileProofCoverage` for a core topic;
- +1 when customer-density targets repeatedly surface the same implementation problem.

These modifiers supplement the Topic Selection Score; they do not replace testability/evidence requirements.

The intended compounding loop is:

```text
relationship conversations
-> discover unanswered developer question
-> run deeper research/experiment
-> publish durable owned proof
-> future profile visitors see stronger expertise
-> future conversations start from a higher credibility baseline
```

This is one of the system's strongest long-term advantages: the network itself tells us what technically serious people still need answered.

## 10. Profile-proof coverage

For each Tier-1 research area, periodically classify owned content coverage:

```text
none
weak
medium
strong
```

A topic is `strong` when the recent profile contains at least one durable, evidence-backed asset a technical visitor can use to judge competence: experiment, benchmark, implementation guide, architecture teardown, or reproducible result.

Do not fill profile-proof gaps with generic summaries. A gap is a research priority only when there is a testable question or useful original asset to build.
