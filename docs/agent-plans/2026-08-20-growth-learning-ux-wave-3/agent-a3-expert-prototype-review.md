# Agent A3 — Expert Prototype Review + Repair

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** documentation/prototype review
**Workspace:** `/home/hamza/repo/x_test-w7-ux-audit`
**Branch:** `agent/w7-ux-prototype-review`
**Can start:** immediately
**Depends on:** integrated Wave-2 UX artifacts at the coordination base containing this mission
**Execution lifetime:** ordinary

## Read first

- `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md`
- `docs/agent-plans/2026-08-20-growth-learning-ux-wave-3/README.md`
- `docs/ux/WAVE1_SYNTHESIS.md`
- `docs/ux/TASK_FLOWS.md`
- `docs/ux/USER_FLOWS.md`
- `docs/ux/WIREFLOWS.md`
- `docs/ux/PRODUCT_LANGUAGE.md`
- `docs/ux/HUMAN_AI_INTERACTION.md`
- `docs/ux/STATUS_LANGUAGE.md`
- Wave-1 audit/walkthrough artifacts only when needed to compare whether the prototype repairs the original defect.

## Mission

Perform the source plan's expert review before participant sessions. Review the Wave-2 prototype/content system through cognitive walkthrough, heuristic evaluation, WCAG 2.2 AA-oriented design review, and mobile interaction review. Repair only expert-detectable P0/P1 defects in the prototype/content artifacts; leave H1/H2 and unresolved terminology as participant-research hypotheses.

## Ownership

Create:
- `docs/ux/PROTOTYPE_REVIEW.md`

You may modify only when a concrete P0/P1 review finding requires a repair:
- `docs/ux/TASK_FLOWS.md`
- `docs/ux/USER_FLOWS.md`
- `docs/ux/WIREFLOWS.md`
- `docs/ux/PRODUCT_LANGUAGE.md`
- `docs/ux/HUMAN_AI_INTERACTION.md`
- `docs/ux/STATUS_LANGUAGE.md`

Do not modify React, backend, APIs, persistence, prompts, tests, Wave-1 evidence, IA research instruments, or the usability guide owned by B3.

## Required review coverage

### Cognitive walkthrough

Walk through at least:
1. resolve an open obligation from Today without mistaking an advisory recommendation for required work;
2. choose an Editorial recommendation and understand whether the next action routes, generates, approves, schedules, or publishes;
3. review a draft, fix blockers, approve, schedule, leave, and return later to identify current state;
4. prepare and explicitly send a reply;
5. recover from a pre-remote failure versus remote-effect-uncertain reconciliation state;
6. run simplified Viral research and understand progress/result evidence;
7. compare external, internal, and test evidence without blending provenance;
8. inspect a writing-strategy recommendation and choose no influence/advice only/deliberate use without implying publication or account-wide automation.

### Heuristics

Evaluate Nielsen's ten heuristics with special attention to system status, real-world language, control/freedom, consistency, error prevention, recognition over recall, progressive disclosure, recovery, and help.

### Accessibility-oriented prototype review

At design level, inspect:
- logical heading/control order;
- keyboard/focus expectations for disclosures, dialogs if any, tab-like controls, and consequential actions;
- status/progress information that cannot rely on color alone;
- meaningful control names and consequence text;
- touch-target and dense-control risks on phone layouts;
- error association and recovery instructions;
- no motion/animation dependency for understanding state.

Do not claim WCAG conformance from documentation prototypes. Record design risks and implementation requirements instead.

### Mobile review

Check the phone wireflows for:
- primary action visibility;
- lifecycle recognition without horizontal overflow or hidden state;
- recovery copy/action visibility;
- evidence provenance legibility;
- strategy-mode consequence clarity;
- parity of task completion with desktop.

## Repair policy

Use @Causal Coding and @Ponytail.

For each P0/P1 issue:

`observable prototype failure -> violated frozen contract/heuristic -> smallest prototype/content repair -> re-walk affected task`

Do not spend the mission on P2/P3 polish. Do not redesign the entire prototype because an expert prefers one IA. H1/H2 must remain testable wherever Wave 2 intentionally preserved both.

## `PROTOTYPE_REVIEW.md` required structure

Include:
- review scope and evidence class;
- readiness summary;
- issue table with severity, artifact/location, user failure, violated contract/heuristic, repair status;
- cognitive-walkthrough outcomes;
- heuristic findings;
- accessibility-oriented findings;
- mobile findings;
- exact P0/P1 repairs made to prototype/content artifacts;
- unresolved questions reserved for participant evidence;
- explicit statement whether the prototype is ready for moderated sessions after repairs.

Severity follows the authoritative plan:
- P0: blocks task or risks unintended consequential action;
- P1: recurring major misunderstanding/friction;
- P2: efficiency/readability issue;
- P3: polish/consistency.

## Success conditions

- All required review lenses and eight walkthrough tasks are covered.
- Any P0/P1 defect discovered is either repaired in owned prototype/content artifacts or explicitly blocks participant readiness with a concrete reason.
- No final IA or unresolved label is chosen by expert taste.
- The review distinguishes expert evidence from future participant evidence.
- H1/H2 remain comparable after repairs.
- Recovery retains remote-effect certainty and retry-safety semantics.
- Strategy `off|suggest|apply` behavior remains unchanged even if display labels remain provisional.
- No product source or tests/builds are changed/run.

## Required validation

None mandated. Do not create, modify, or run tests or application builds. Read the final review and changed prototype/content areas, inspect the owned diff once, and use documentation diff hygiene if useful.

## Finish report

Return:
1. status: complete / blocked / needs decision;
2. branch/workspace and commit hash;
3. review artifact plus any prototype/content files repaired;
4. P0/P1 findings and repairs;
5. eight walkthrough outcomes;
6. heuristic/accessibility/mobile readiness summary;
7. participant questions deliberately left unresolved;
8. whether the prototype is ready for moderated sessions;
9. deviations/conflicts;
10. validation performed, explicitly noting no tests/builds.
