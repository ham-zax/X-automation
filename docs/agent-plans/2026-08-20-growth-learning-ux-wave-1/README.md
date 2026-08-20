# Growth Learning UX Wave 1 — Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Authoritative source plan:** `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md`
**Source-plan base:** `01cc68f`
**Current execution baseline:** `d99ed94` — includes the latest editable niche-settings surface that Wave 1 must study
**Execution shape:** two parallel documentation/research missions, then planner integration and evidence-backed synthesis before any React/backend implementation
**Current wave:** 1 — UX evidence foundation (complete + integrated)

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A1 — Current-State UX Forensic Audit | documentation/research | complete + integrated | completed | `/home/hamza/repo/x_test-w7-ux-audit` | concurrent writer; owned audit/walkthrough artifacts only | none |
| Agent B1 — Task, Journey, and IA Research Package | documentation/research | complete + integrated | completed | `/home/hamza/repo/x_test-w7-ux-research` | concurrent writer; owned task/journey/IA research artifacts only | none |

## Dependency map

```text
Reviewed UX/HCI plan at 01cc68f
             |
      /--------------\
      v              v
   Agent A1        Agent B1
 current-state     task/journey/IA
 forensic audit    research package
      \              /
       \            /
       planner integration
             |
             v
     Wave 1 synthesis
  - freeze authority/consequence/lifecycle/recovery invariants
  - preserve IA/language as falsifiable hypotheses
             |
             v
 Wave 2 prototype + content-design documentation
 (React implementation remains blocked on participant evidence or an explicit later decision to proceed provisionally)
```

## Shared product thesis

The product is a human-controlled growth operating system whose default strategic objective is **qualified growth velocity**: acquire relevant attention and audience in the AI/dev/builder niche quickly, then turn that audience into durable opportunities such as product visibility, customers, partnerships, authority, relationships, experiments, and later revenue.

The UX must make the normal operator path understandable without requiring knowledge of AI runtimes, scoring internals, database state, experiment mechanics, or algorithm terminology.

The strongest current IA hypothesis is:

**Today / Discover / Conversations / Posts / Results / Learn**

Under **Learn**, the product should eventually distinguish:

- **Current winning styles** — external Viral Styles evidence;
- **What works for you** — internal measured account outcomes;
- **Tests** — explicit experiments;
- **Strategy recommendations** — optional evidence-backed writing guidance.

This remains a hypothesis until the research package evaluates findability and terminology. Agents must not present hypothetical labels as observed user preference.

## Shared authority and safety contracts

- Recommendation is not selection; selection is not approval; approval is not publication.
- Human approval/send/publication authority remains unchanged.
- Learned writing guidance remains optional and eventually supports `Off / Suggest / Apply`; Wave 1 does not implement these modes.
- External Viral evidence, internal account evidence, and experiment evidence must remain distinguishable.
- Do not turn a 90% observational interval into “90% likely to go viral.”
- Do not claim a post caused follower/revenue/opportunity movement without supported attribution.
- Do not change React, backend, persistence, prompts, APIs, AI runtime behavior, or automation in Wave 1.
- Do not create, modify, or run tests. No testing is authorized for these documentation/research missions.

## Ownership boundaries

### Agent A1 owns only

- `docs/ux/CURRENT_STATE_IA.md`
- `docs/ux/ACTION_INVENTORY.md`
- `docs/ux/BASELINE_HEURISTIC_REVIEW.md`
- `docs/ux/COGNITIVE_WALKTHROUGHS.md`

Agent A1 may read but must not modify existing UX artifacts such as `docs/ux/CURRENT_STATE_AUDIT.md`, `docs/ux/HUMAN_AI_INTERACTION.md`, and `docs/ux/PRODUCT_LANGUAGE.md`.

### Agent B1 owns only

- `docs/ux/TASK_ANALYSIS.md`
- `docs/ux/JOBS_TO_BE_DONE.md`
- `docs/ux/JOURNEY_MAPS.md`
- `docs/ux/SERVICE_BLUEPRINT.md`
- `docs/ux/IA_RESEARCH.md`
- `docs/ux/USER_LANGUAGE_RESEARCH_GUIDE.md`

Agent B1 must distinguish repository-observed behavior, stakeholder-stated goals, and research hypotheses. It must not fabricate interviews, usability findings, card-sort results, tree-test results, or a `USER_LANGUAGE_LEDGER.md` without real participant evidence.

If either mission discovers that it needs to edit the other mission's owned file, report the coordination conflict instead of crossing ownership.

## Integration policy

The planner/main session integrates both returned documentation commits after reviewing them against the authoritative plan and current React implementation. The two missions intentionally own disjoint files, so integration should be commit-based rather than manual copy/paste.

After integration, `docs/ux/WAVE1_SYNTHESIS.md` freezes only the contracts supported without participant preference data: authority separation, consequence clarity, lifecycle visibility, recovery semantics, learning-evidence provenance, writing-strategy behavior semantics, and qualified-growth purpose.

Wave 1 does **not** validate the final IA or final user-facing terminology. Agent B1's research package explicitly leaves H1 vs H2 and labels such as `Learn`, `Current winning styles`, and `Off/Suggest/Apply` falsifiable. Wave 2 therefore remains documentation/prototyping work rather than React implementation.

Strategy synthesis, Writer integration, outcome attribution, business-opportunity persistence, and production navigation changes remain intentionally unmaterialized until the relevant research/prototype frontier is complete.

## Validation policy

These are documentation/research missions. No tests or application builds are required or authorized. Completion evidence is:

- inspect the produced artifacts against the mission acceptance criteria;
- inspect the final documentation diff once;
- report any unresolved uncertainty explicitly rather than filling it with assumed findings.

## Future / blocked work

Low-resolution only; do not implement in Wave 1:

- validated responsive shell and primary IA;
- decision-card/lifecycle UX;
- consolidated Learn surface;
- deterministic writing-strategy synthesis and append-only human selection;
- optional strategy application in Writer;
- strategy outcome measurement;
- actual opportunity/revenue outcome ledger;
- advanced/accessibility cleanup.

## Status log

- `2026-08-20` — authoritative UX/HCI growth-learning plan committed as `01cc68f`.
- `2026-08-20` — Wave 1 materialized as two parallel evidence-producing documentation missions; no product implementation authorized yet.
- `2026-08-20` — Agent A1 completed `f827b70`; integrated on main as `7e6c8b6`.
- `2026-08-20` — Agent B1 completed `08bfce9`; integrated on main as `407e6a8`.
- `2026-08-20` — Wave 1 synthesis recorded in `docs/ux/WAVE1_SYNTHESIS.md`; final IA/language remain unvalidated without real participant evidence.
