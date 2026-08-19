# Growth & Distribution Playbook

This document defines how `@ham_zax` turns research signals into distribution and how the account recruits a better AI/developer audience without mechanical engagement farming.

## 1. Current audience diagnosis

Snapshot captured 2026-08-19:

- Account: `@ham_zax` — Full-Stack Engineer | TypeScript | Node.js | React | Angular | PostgreSQL | Web3 | AI Integration & Automation.
- Followers: 41.
- Following: 547.
- Strongly niche-aligned current followers: 0 at the current profile-classification threshold.
- Strongly niche-aligned accounts already followed: 45.
- Mutual relationships observed: 1.

Interpretation:

> The account is already looking at the right AI/dev ecosystem, but that ecosystem is not yet following the account back.

The main growth job is therefore **audience replacement and relationship conversion**, not simply increasing follower count. New followers should increasingly be developers, AI builders, technical founders, devtool maintainers, model/tool practitioners, and relevant engineering-career accounts.

## 2. Distribution decision: Direct vs Quote vs Repost vs Reply vs Ignore

The system must make this decision before every outbound action.

### DIRECT POST

Use a standalone original when the insight is ours and can survive without the source post being visible.

Choose **DIRECT** when one or more are true:

- we ran the experiment;
- we have an original benchmark, result, failure, implementation, or observation;
- the thesis combines multiple sources;
- our interpretation is materially broader than one source;
- the post teaches a workflow, command, architecture, or decision rule;
- the reader should follow `@ham_zax` for the insight itself.

Preferred structure:

> Hook → finding → evidence → developer implication → action.

Direct originals are the primary follower-acquisition asset.

### QUOTE POST

Use a quote when the original source is itself important evidence and our commentary changes how a developer should interpret it.

Choose **QUOTE** only when all are true:

- the source is strong enough to deserve being visible;
- our commentary adds a distinct thesis, test, implication, comparison, correction, or informed question;
- the combined quote creates more value than the original alone;
- we have not already used the source for distribution.

Good quote angles:

- `why this matters for coding agents`;
- `the benchmark everyone is overlooking`;
- `the cost/reliability tradeoff`;
- `what this changes in an actual workflow`;
- `one concrete limitation`;
- a specific question to practitioners whose answer would improve our understanding.

Do not quote merely with `this`, `huge`, `wow`, a paraphrase, or generic praise.

### REPOST

Plain reposts are deliberately rare.

Choose **REPOST** only when:

- the source itself is unusually useful;
- amplification is genuinely the point;
- we have no honest additive insight yet;
- the source is highly niche-aligned;
- the account has not recently reposted several other sources.

If we can add a useful developer interpretation, prefer QUOTE. If the idea can stand alone, prefer DIRECT.

### REPLY

Replies are a relationship and technical-conversation tool, not the main follower-distribution vehicle.

Choose **REPLY** when:

- we can answer a real question;
- we can add implementation detail, data, a reproduction, caveat, or comparison;
- we can ask a specific informed question;
- the author is in or adjacent to our target audience;
- the reply would still be worthwhile if it generated zero impressions.

A reply should normally contain one concrete contribution. Generic praise does not count.

### IGNORE

Choose **IGNORE** when:

- niche fit is weak;
- we have no additive idea;
- the source has already been used;
- the post is viral but irrelevant;
- the only available action would be engagement bait;
- the topic would pull the account back toward legacy crypto/general-tech noise.

Ignoring weak signals is part of the strategy.

## 3. Attention hooks without engagement bait

We want replies and discussion, but the question must seek information.

### Good discussion prompts

- `If you've tested this in production, where does it fail first?`
- `Which task is still better in Claude/Codex, and why?`
- `What would you benchmark before switching?`
- `Heavy users: is your bottleneck limits, context, latency, or tool reliability?`
- `Is there an open-source implementation that handles this edge case better?`
- `What changes on Windows/Linux?`
- `I'm comparing X vs Y on repo-scale work. What task should be in the test set?`

### Never use

- `Like if you agree`;
- `RT this`;
- `comment YES`;
- artificial `A or B?` questions with no informational purpose;
- withholding useful information solely to force follows or replies;
- repetitive controversy manufactured for impressions.

Rule:

> A legitimate question improves the research if somebody answers it. Engagement bait only improves the metric.

## 4. Keyword usage

Keywords are semantic anchors, not stuffing.

Each post should naturally contain **1–3 high-specificity niche anchors** when relevant.

Examples:

- `Claude Code`, `Codex`, `Cursor`, `OpenCode`, `MCP`, `coding agent`;
- `GLM`, `Qwen`, `DeepSeek`, `inference`, `context window`, `open-weight model`;
- `CLI`, `SDK`, `GitHub`, `Vercel`, `open source`, `developer tool`;
- `latency`, `sandbox`, `Postgres`, `Docker`, `WebGPU`, `API`;
- `AI engineer`, `developer job`, `technical interview`;
- `AI SaaS`, `technical founder`, `build in public`, `pricing`, `distribution`.

Prefer exact product/task vocabulary over generic words such as `AI`, `tech`, `future`, or `innovation`.

Hashtags are not required for keyword relevance. Use them only when they are actually conventional for the event/community.

## 5. Aggressive growth means high-quality surface area

The account should be aggressive about **useful presence**, not mechanical engagement volume.

Starting operating target:

- **2 strong original posts/day**, usually separated by roughly 4–6 hours;
- **0–1 quote post/day**, only when the source passes the quote gate;
- **5–8 high-signal replies/day** across relevant builders, maintainers, researchers, and developer conversations;
- **plain reposts: exceptional**, not a daily quota;
- continuously research viral/niche signals, but do not publish simply to hit a number.

If quality drops, reduce volume.

## 6. Relationship recruitment loop

For the current account, the highest-value pool is the niche-aligned set already being followed but not following back.

Priority order:

1. **Peer builders / maintainers / individual practitioners** — easiest place to build genuine recurring conversation.
2. **Devtool/model team members** — reply when we can provide a test, use case, bug, benchmark, or specific question.
3. **Official tool/model accounts** — quote important releases when we have an interpretation; avoid generic comments.
4. **Large general technology personalities** — interact only when the technical overlap is unusually strong.
5. **Legacy crypto/general accounts** — do not optimize new content around them merely because they currently follow us.

Relationship sequence:

> Read work → useful reply → recurring recognition → quote/amplify when deserved → original work in same problem space → mutual conversation/follow if naturally earned.

Never ask for a follow as the core value proposition.

## 7. Reply quality ladder

### Weak — do not send

> Nice.

> This is huge.

> Great work!

### Good

> The latency improvement matters more to me than the benchmark delta here. Have you measured tool-call round trips on a repo-scale agent loop?

### Excellent

> I hit the same failure mode with a multi-step coding task: the model solved the patch but lost state between tool calls. Persisting a compact task ledger fixed most of it. Does your eval reset tool context between steps or preserve it?

Excellent replies expose competence and give the author something substantive to answer.

## 8. Follow conversion content

Every original should make at least one target developer think one of these:

- `this saved me research time`;
- `I can use this today`;
- `this person actually tested the tool`;
- `this changed my opinion`;
- `I want to see the next experiment`.

The strongest recurring formats are:

- tool/model comparison with a clear winner by task;
- short reproduction of a new claim;
- failure mode + fix;
- `I tried this on a real repo`;
- cost/latency/reliability tradeoff;
- useful CLI/config/prompt;
- new release translated into one developer decision;
- technical founder lesson tied to an actual product experiment.

## 9. Agent decision contract

When the agent receives a post manually:

1. Fetch/read the exact source and surrounding context.
2. Ingest it into research memory.
3. Classify niche and keywords.
4. Check existing candidate actions. If already used, do not recycle it without a new material reason.
5. Decide DIRECT / QUOTE / REPOST / REPLY / IGNORE using the rules above.
6. If DIRECT or QUOTE, build a complete thesis with evidence and action.
7. If REPLY, contribute one concrete useful point or informed question.
8. Run the content quality gate.
9. Only execute a consequential X action when explicitly authorized by the user/current workflow.
10. Record successful action type, output tweet ID/URL, commentary, and timestamp in SQLite.

Useful bridge commands:

```bash
npm run agent -- decide
npm run agent -- record-action
npm run agent -- audience
npm run agent -- audience-sync
```

## 10. Persistence invariants

- Saved candidates remain taste signals.
- Every successful direct/quote/repost/reply associated with a research candidate is written to `candidate_actions`.
- A candidate with a recorded distribution action is treated as already used by default.
- Audience observations live in `audience_profiles`.
- Partial audience scrapes may add/update observations but must not erase previously observed relationships.
- Audience classification is a prioritization aid, not proof of a person's identity or interests.

## 11. Weekly feedback loop

Once a week, review:

- new follower count;
- percentage of new followers that are niche-aligned;
- originals vs quotes vs replies that generated profile/follow activity;
- recurring topics among saved candidates;
- replies that turned into real conversations;
- posts with the strongest views, replies, reposts, and follow-quality outcomes.

Then adjust topics and interaction targets—not by farming more actions, but by increasing the amount of content the desired audience finds genuinely useful.

## 12. Human + AI publishing loop (planned)

The next system milestone is deliberately **human + AI**, not autonomous content spraying.

Planned loop:

> Discover / manual input → Save → Triage → AI route recommendation → human route/override → research/verify → write → media decision → hard gates → human approval → coverage-aware schedule → publish → measure → learn.

Planned route choices expand the current decision model into:

- Original;
- Quote;
- Thread;
- Reply/Engage;
- Repost;
- Research only;
- Watch;
- Ignore.

Saving should mean two things once the plan is implemented:

1. this source is an explicit taste/research signal;
2. this source deserves a visible triage decision.

The AI should explain its recommended route, but the human decides or overrides the route. AI may prepare an item through research, drafting, scoring, and `needs_review`; the main-feed approval boundary remains human.

For ordinary main-feed content, optimize spacing for coverage and semantic diversity rather than attempting to mimic a human. For viral/time-sensitive signals, urgency may pre-empt an evergreen queue item, but publication remains serialized rather than dumping multiple posts together.

Canonical design:

- `HUMAN_AI_PUBLISHING_SYSTEM_PLAN.md` — queue, route, approval, scheduler, media, publication, and learning architecture;
- `POST_GENERATION_PROMPT.md` — final writing/scannability contract;
- `RESEARCH_AGENDA.md` — topics deep enough to create original account-level intellectual property.

Until the plan is implemented, the existing Saved/draft/ready workflow remains authoritative.
