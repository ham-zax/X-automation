# Agent B3 — Usability / IA / Language Research Runbook

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** documentation/research preparation
**Workspace:** `/home/hamza/repo/x_test-w7-ux-research`
**Branch:** `agent/w7-ux-usability-guide`
**Can start:** immediately
**Depends on:** integrated Wave-2 UX artifacts at the coordination base containing this mission
**Execution lifetime:** ordinary

## Read first

- `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md`
- `docs/agent-plans/2026-08-20-growth-learning-ux-wave-3/README.md`
- `docs/ux/WAVE1_SYNTHESIS.md`
- `docs/ux/IA_RESEARCH.md`
- `docs/ux/USER_LANGUAGE_RESEARCH_GUIDE.md`
- `docs/ux/TASK_FLOWS.md`
- `docs/ux/USER_FLOWS.md`
- `docs/ux/WIREFLOWS.md`
- `docs/ux/PRODUCT_LANGUAGE.md`
- `docs/ux/HUMAN_AI_INTERACTION.md`
- `docs/ux/STATUS_LANGUAGE.md`

## Mission

Create an execution-ready moderated research guide for real participants. It must let a human researcher evaluate the unresolved IA, language, consequence-prediction, lifecycle, Viral research, evidence-provenance, and writing-strategy questions without coaching users toward the preferred design.

This mission prepares the study. It does not run sessions and must not create findings.

## Ownership

Create only:
- `docs/ux/USABILITY_GUIDE.md`

Do not modify prototype/content artifacts, React/backend code, APIs, persistence, prompts, tests, `IA_RESEARCH.md`, `USER_LANGUAGE_RESEARCH_GUIDE.md`, or create `USABILITY_FINDINGS.md`.

## Study design requirements

The guide must combine, without duplicating unnecessarily:

1. **Open card sort / grouping probe** for major concepts where useful.
2. **Counterbalanced tree testing** of C0/H1/H2 where appropriate, especially H1 vs H2.
3. **Moderated task-based usability** using the low-fi desktop and phone wireflows.
4. **Language comprehension probes** after users commit to behavior/path choices.
5. **Consequence prediction** before consequential clicks/actions.

Do not expose preferred answers in task wording.

## Participant roles

Prepare recruiting/screening criteria for:
- daily/likely operator;
- owner/stakeholder who mainly wants status/evidence/strategy decisions;
- occasional/non-expert reviewer.

Advanced operators may be a secondary group for Settings/Advanced/Diagnostics and research-control questions, but their needs must not define the default ordinary-user IA.

Do not invent participant counts as statistical proof. If proposing small qualitative rounds, state that the purpose is defect discovery/iteration rather than population inference.

## Required task coverage

Include realistic scenarios for at least:

1. Find and resolve something that genuinely needs a human decision now.
2. Inspect an AI Editorial recommendation without treating it as an obligation.
3. Predict what a recommendation CTA will do before activating it.
4. Move from selected idea to generated draft, then identify review/approval state.
5. Approve wording and determine what has and has not been published.
6. Leave and return later to find scheduled/waiting/published state.
7. Prepare and explicitly send a reply.
8. Interpret a partial-success/reconciliation error and choose the safe next action without ordinary resend.
9. Find how to study writing styles/intents that appear to be working externally.
10. Distinguish external niche evidence from this account's own evidence and explicit test evidence.
11. Interpret evidence strength without turning observational confidence into virality probability or causality.
12. Decide whether a writing strategy should have no influence, advice-only influence, or deliberate one-generation influence; predict each consequence.
13. Determine where the participant expects strategy evidence to live versus where the choice should be made.
14. Find niche/model/settings/system detail without assuming Diagnostics/Advanced/Settings wording is correct.
15. On phone-size wireflows, complete the same high-priority actions and identify current lifecycle state.
16. Stakeholder task: answer what happened, whether things are improving, what has been learned externally vs internally, and what decision is waiting.

## H1/H2 research discipline

- Counterbalance exposure order or use between-participant allocation where learning effects would contaminate a second tree.
- Hold task wording and content constant across IA variants.
- On phone, hold navigation mechanism constant so the tested variable is hierarchy, not chrome.
- Record first choice, path, backtracking, recovery, and verbal interpretation.
- Treat alternative plausible paths as evidence, not automatically as participant error.
- Do not declare H2 successful merely because users can eventually find Learn.
- Explicitly detect `Learn` interpreted as tutorials/help/education.

## Language research discipline

Ask users to explain actions/states in their own words before showing candidate labels.

Cover unresolved terms including:
- recommendation vs selection;
- draft/generate/review/readiness;
- approved/waiting/scheduled;
- winning/working/pattern language;
- style vs communicative intent/purpose/angle;
- Test vs Experiment;
- learned/strategy recommendation;
- no influence / advice only / deliberate use semantics;
- Settings / Advanced / Diagnostics;
- qualified audience growth;
- opportunity meanings;
- reconciliation/remote-effect uncertainty.

A candidate strategy label fails if users interpret it as approval, publication/send, account-wide automation, experiment assignment, or learned-rule acceptance.

## Observation and capture template

The guide must define a repeatable session record covering:
- participant role/context without unnecessary personal data;
- condition/order shown;
- task outcome: completed / completed with recovery / failed / skipped;
- first destination/action;
- wrong-path choices and backtracking;
- hesitation/help requested;
- exact consequence prediction before consequential action;
- actual interpretation after state change;
- terminology questions/misinterpretations;
- recovery behavior;
- mobile-specific issue where applicable;
- verbatim quotes only when actually observed in a real session;
- researcher notes separated from participant statements.

Do not pre-fill results.

## Analysis plan

Define how later `USABILITY_FINDINGS.md` should distinguish:
- observed participant behavior;
- participant language;
- expert interpretation;
- repository constraints;
- design recommendation.

Do not specify arbitrary pass percentages without a baseline. For qualitative rounds, emphasize recurring failure patterns, severity, and whether a finding changes an IA/language/interaction decision.

Specify decision gates for:
- H1 vs H2 vs current C0;
- `Learn` interpretation;
- strategy-choice placement;
- ordinary Viral controls;
- lifecycle/recovery comprehension;
- candidate terminology.

A decision gate may say evidence remains unresolved; forcing a winner is not required.

## Session safety and authority

Use prototypes/read-only scenarios. Do not require real X sends/publications/unfollows or live provider calls for usability research. Consequential scenarios should be simulated in the prototype while preserving exact authority semantics.

## Success conditions

- A researcher can run a session without inventing tasks or leading language.
- H1/H2 order/content is controlled sufficiently to make findings interpretable.
- Consequence prediction is captured before consequential actions.
- External/internal/test evidence distinction is tested directly.
- Strategy behavior and placement are tested without teaching the canonical labels first.
- Desktop and phone tasks are covered.
- Data-capture and later-analysis templates are explicit but blank.
- No participant findings or fake metrics are included.
- No product source or tests/builds are changed/run.

## Required validation

None mandated. Do not create, modify, or run tests or application builds. Read the final guide and inspect the single-file diff once; documentation diff hygiene is sufficient if useful.

## Finish report

Return:
1. status: complete / blocked / needs decision;
2. branch/workspace and commit hash;
3. artifact created;
4. participant roles and study structure;
5. task coverage;
6. H1/H2 counterbalancing/falsification approach;
7. language and strategy-comprehension probes;
8. observation/analysis framework;
9. what remains blocked until real participants;
10. deviations/conflicts;
11. validation performed, explicitly noting no tests/builds.
