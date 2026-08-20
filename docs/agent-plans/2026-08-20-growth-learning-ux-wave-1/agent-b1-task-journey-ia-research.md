# Agent B1 — Task, Journey, and IA Research Package

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** documentation/research
**Workspace:** `/home/hamza/repo/x_test-w7-ux-research`
**Branch:** `agent/w7-ux-research`
**Isolation reason:** concurrent documentation writer; this mission owns task/journey/IA research artifacts while Agent A1 owns current-state audit/walkthrough artifacts
**Can start:** immediately
**Depends on:** authoritative plan `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md` at source base `01cc68f`
**Execution lifetime:** ordinary

## Read first

- `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md` — authoritative product purpose, research sequence, learning architecture, IA hypotheses, and implementation constraints.
- `docs/agent-plans/2026-08-20-growth-learning-ux-wave-1/README.md` — ownership and coordination contract.
- Current `ui/src/App.tsx` plus representative Today, Discover, Viral Styles, Conversations, Create/Posts, Results, Improve/Experiments, and Advanced surfaces — ground the research package in the product that actually exists.
- Existing `docs/ux/HUMAN_AI_INTERACTION.md` and `docs/ux/PRODUCT_LANGUAGE.md` as prior hypotheses/background; do not modify them.

## Mission

Turn the agreed product purpose into a rigorous task/journey/IA research package suitable for non-technical operators and stakeholders, without pretending that planned research has already happened.

The strategic product purpose is:

> Grow a relevant AI/dev/builder audience quickly, convert that audience into durable opportunities and visibility, understand what is currently working externally and internally, and let the human optionally reuse supported style/intent guidance while retaining approval/publication authority.

The package should let a later researcher or operator validate the product's mental model with real people instead of asking abstract feature-preference questions.

## Owned artifacts

Create only:

- `docs/ux/TASK_ANALYSIS.md`
- `docs/ux/JOBS_TO_BE_DONE.md`
- `docs/ux/JOURNEY_MAPS.md`
- `docs/ux/SERVICE_BLUEPRINT.md`
- `docs/ux/IA_RESEARCH.md`
- `docs/ux/USER_LANGUAGE_RESEARCH_GUIDE.md`

Do not create `USER_LANGUAGE_LEDGER.md` or any findings artifact without actual participant evidence.

Do not modify React/backend code, persistence, prompts, tests, existing UX docs, or Agent A1-owned artifacts.

## Research framing

Maintain three evidence labels throughout the package where relevant:

- **stakeholder-stated requirement** — directly supported by the authoritative plan/current brief;
- **repository-observed behavior** — supported by current UI/domain behavior;
- **research hypothesis** — proposed model/label that must be validated with users.

Do not collapse them into “findings.”

## Task analysis requirements

Build the task hierarchy around actual decisions/jobs rather than current module names. At minimum include:

- know what deserves attention now;
- evaluate an editorial opportunity;
- decide whether to create an Original/Thread/Quote/Reply/Repost or research more;
- review/edit/approve/schedule/publish safely;
- continue a useful conversation;
- understand why work is blocked or failed;
- discover signals worth discussing;
- understand current performance and audience quality;
- research what writing styles and communicative intents are currently winning;
- distinguish external niche evidence from what works for this account;
- decide whether optional learned strategy should be Off, Suggested, or Applied while creating content;
- understand tests/experiments and learned recommendations;
- inspect advanced AI/runtime/diagnostic detail only when needed;
- understand whether observed growth is only an audience proxy or an actual recorded business opportunity.

Rank by frequency, consequence, and likely confusion. Preserve the source plan's P0/P1/P2/P3 framing rather than inventing numeric scores.

## Jobs-to-be-done requirements

Express the principal jobs in user language. Include functional and confidence/control dimensions, especially:

- “Tell me what to work on next.”
- “Help me turn a worthwhile signal into something useful without accidentally publishing it.”
- “Show me what style/intent is winning right now and whether it also works for me.”
- “Let me use that learning when useful, but do not silently change my writing strategy.”
- “Show me whether this is growing the right audience and creating opportunities.”

Treat exact wording as hypotheses pending language research.

## Journey maps

Create Mermaid journey maps for at least:

1. Daily operator: orient → decide → converse/create → review → act → understand result → learn.
2. Editorial content: discovery/recommendation → optional strategy → draft → human review → approval → schedule/publish → measurement → learning.
3. Viral/Learn: choose research scope → run → understand external patterns → compare with internal outcomes/tests → optionally use a strategy.
4. Stakeholder: understand status → performance/audience → learning → problems → decisions/opportunities.

Mark meaningful cross-session boundaries such as research execution, scheduled publication, publication transport, measurement windows, and later learning.

## Service blueprint

For consequential journey steps, pair the visible frontstage state with the authoritative backstage owner. Cover at minimum:

- source discovery/snapshots;
- Editorial Plan recommendation;
- human selection/routing;
- research/evidence;
- Writer generation;
- draft gates/human confirmations;
- approval;
- schedule/wait;
- publication transport;
- measurement/outcomes;
- Viral Styles external research;
- learned rules/experiments;
- future optional writing-strategy selection.

Make it explicit that the future strategy layer is advisory/human-selected and not another approval/publication authority.

## IA research package

Prepare an evidence-gathering package that compares the current IA with the two source-plan hypotheses, especially the stronger current hypothesis:

**Today / Discover / Conversations / Posts / Results / Learn**

Under Learn, test placement/understanding of:

- Current winning styles;
- What works for you;
- Tests;
- Strategy recommendations.

Under Advanced/Settings, test placement of:

- AI Settings;
- diagnostics;
- raw evidence/runtime/system detail.

Include:

- open-card-sort prompts/content cards;
- closed-card-sort variant when useful;
- tree-test structures for current IA and hypothesis IA;
- task questions that test findability without naming the destination;
- success/error observations to record;
- decision rule for what evidence would justify keeping/changing a label or placement.

Do not include fabricated completion rates or preferences.

## User-language research guide

Prepare interview/observation prompts that collect users' own words before showing product terminology. Specifically probe how people naturally describe:

- “what should I do today?”;
- a recommendation vs a decision;
- draft/review/approve/schedule/publish;
- what is “winning” on X;
- writing “style” vs communicative “intent”;
- “what works for my account” vs “what works generally”;
- Off/Suggest/Apply concepts without leading them to those labels;
- audience growth, relevant followers, authority, relationships, opportunities, build visibility, and revenue;
- confidence/uncertainty in learned recommendations;
- advanced controls they would expect to ignore most of the time.

Include realistic task prompts for non-technical operators and stakeholders. Do not ask “Do you like the Learn tab?” as a substitute for task evidence.

## Success conditions

- Core product jobs can be described without current module names or internal scoring/runtime vocabulary.
- The package preserves qualified-growth velocity and actual opportunity/revenue outcomes as distinct outcome layers rather than collapsing everything into impressions.
- External Viral evidence, internal account evidence, experiments, and optional strategy guidance are conceptually distinct in every journey/blueprint where they appear.
- IA research can falsify the proposed `Learn` grouping rather than merely confirm it.
- Research tasks include both desktop and phone findability/comprehension where relevant.
- No participant findings, percentages, quotations, or language preferences are invented.
- The artifacts are executable by a later researcher without hidden context from this chat.

## Required validation

None. Do not create or run tests. Inspect the six produced documents and the final diff once.

## Out of scope

- Conducting participant sessions or claiming results.
- Finalizing the IA before evidence returns.
- Editing product code or implementing Learn/strategy behavior.
- Creating a second intent/style taxonomy; use the existing canonical Viral Styles concepts from the source plan as the technical reference.
- Editing Agent A1-owned files.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. branch/workspace and commit hash;
3. six artifacts created;
4. principal jobs/task hierarchy;
5. journey/service-blueprint coverage;
6. IA research variants and key tree-test/card-sort tasks;
7. user-language questions still requiring real participants;
8. deviations/conflicts, if any;
9. validation performed — normally documentation/diff inspection only.
