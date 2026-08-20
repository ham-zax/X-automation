# Growth Learning UX Wave 3 — Expert Review + Usability Research Preparation

**Repository:** `/home/hamza/repo/x_test`
**Authoritative source plan:** `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md`
**Wave-1 synthesis:** `docs/ux/WAVE1_SYNTHESIS.md`
**Integrated Wave-2 base:** `d2a4e33` plus the coordination materialization commit containing this file
**Execution shape:** two parallel documentation/research-preparation missions, then planner integration; actual participant findings and production React/backend work remain blocked
**Current wave:** 3 — expert prototype review and execution-ready participant-research preparation (complete + integrated)

## Current frontier

| Mission | Type | Status | Can start | Workspace | Branch | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|---|
| Agent A3 — Expert Prototype Review + Repair | documentation/prototype | complete + integrated | completed | `/home/hamza/repo/x_test-w7-ux-audit` | `agent/w7-ux-prototype-review` | concurrent writer; owned expert review and P0/P1 prototype/content repairs | none |
| Agent B3 — Usability / IA / Language Research Runbook | documentation/research preparation | complete + integrated | completed | `/home/hamza/repo/x_test-w7-ux-research` | `agent/w7-ux-usability-guide` | concurrent writer; owned only the participant-session runbook | none |
| Real participant sessions | human research | blocked on participant access | after participants are scheduled | outside repository agent work | not an AI-agent mission; requires actual humans | real participants |

## Dependency map

```text
Wave 2 integrated
flows/wireflows + product language/Human-AI/status system
                    |
          /-------------------\
          v                   v
       Agent A3             Agent B3
 expert walkthrough        moderated usability
 + heuristic review        + IA/language study runbook
 + WCAG/mobile review      no participant findings
 + P0/P1 prototype repair
          \                   /
           \                 /
              planner integration
                    |
                    v
        actual participant sessions
  card sort + tree test + usability/language probes
                    |
                    v
       USABILITY_FINDINGS + UX_STORY_MAP
                    |
                    v
     production implementation frontier
```

## Frozen semantics

Wave 3 must preserve:

1. recommendation != selection != draft/review != approval != schedule/wait != publish/send != confirmed result;
2. every consequential action makes its immediate effect predictable before activation;
3. lifecycle state is recognizable without module recall;
4. recovery explains what failed, remote-effect certainty, authoritative state, retry safety, and next action;
5. external niche, internal account, and explicit test evidence remain separate;
6. strategy behavior IDs remain `off|suggest|apply`: `suggest` has zero Writer effect; `apply` affects one human-authorized generation only;
7. default strategic purpose is qualified growth velocity, not likes or raw follower count.

## Still unresolved by participant evidence

Do not settle these through expert preference:

- C0 vs H1 vs H2 primary IA;
- whether `Learn` means evidence/adaptation or help/education;
- exact labels for external patterns, own-account evidence, tests, and strategy recommendations;
- exact display words for `off|suggest|apply` semantics;
- strategy-choice placement: evidence area, draft, or dual responsibility;
- ordinary-user Viral controls and research-depth labels;
- Settings / Advanced / Diagnostics terminology and placement;
- bare score usefulness;
- exact recovery action required for each partial-success transport class.

## Ownership

### Agent A3

Creates:
- `docs/ux/PROTOTYPE_REVIEW.md`

May modify only when required to repair an expert-detectable P0/P1 defect:
- `docs/ux/TASK_FLOWS.md`
- `docs/ux/USER_FLOWS.md`
- `docs/ux/WIREFLOWS.md`
- `docs/ux/PRODUCT_LANGUAGE.md`
- `docs/ux/HUMAN_AI_INTERACTION.md`
- `docs/ux/STATUS_LANGUAGE.md`

A3 must not turn a research hypothesis into a validated IA or label. P2/P3 polish does not authorize broad rewriting.

### Agent B3

Creates only:
- `docs/ux/USABILITY_GUIDE.md`

B3 may read all current UX artifacts but must not modify prototypes, product language, product source, or research findings. The guide should reference semantic tasks and conditions rather than brittle line numbers so it remains valid if A3 repairs a prototype detail.

## Review/research policy

- Repository-observed facts, expert-review findings, design hypotheses, and participant findings are different evidence classes.
- Expert review can repair clear authority, recovery, accessibility, or task-completion defects before sessions.
- Expert review cannot select H1/H2 or final terminology merely because one option looks cleaner.
- B3 must not simulate users, fabricate participants, quotations, metrics, card-sort results, tree-test results, or usability findings.
- Actual participant execution remains a human research activity after this wave.

## Testing and validation

No tests or application builds are authorized. These are documentation/prototype/research-preparation missions.

Use document readback, scoped diff inspection, and documentation diff hygiene only as needed.

## Integration policy

The planner integrates both commits after verifying scope. If A3 repairs prototype/content artifacts, B3's runbook remains valid because it should address semantic tasks rather than exact prototype line references.

After Wave 3 integration:

- actual participant sessions are the next required evidence step and are not delegated to AI agents;
- the integrated prototype review reports no remaining expert-detectable P0/P1 blocker to moderated sessions;
- `docs/ux/USABILITY_FINDINGS.md` must not exist until real session observations exist;
- `docs/ux/UX_STORY_MAP.md` remains blocked until findings determine the validated IA/language and remaining implementation priorities;
- production React/backend implementation remains blocked unless the user explicitly chooses a reversible provisional implementation despite the evidence gap.

## Future / blocked work

- real moderated participant sessions;
- real card-sort/tree-test results;
- `USABILITY_FINDINGS.md`;
- final IA/language freeze;
- `UX_STORY_MAP.md`;
- React navigation/lifecycle/Learn implementation;
- strategy synthesis/persistence and Writer integration;
- outcome/business-opportunity implementation.

## Status log

- `2026-08-20` — Wave 2 Agent A2 integrated as `e198331`.
- `2026-08-20` — Wave 2 Agent B2 integrated as `d2a4e33`.
- `2026-08-20` — Wave 3 materialized as expert prototype review plus participant-research preparation; no participant findings or production implementation authorized.
- `2026-08-20` — Agent A3 completed `081abb6`; integrated on main as `cba283d`; five expert-detectable P1 prototype/content issues repaired, no P0 remained.
- `2026-08-20` — Agent B3 completed `fc385ff`; integrated on main as `97b9664`; execution-ready moderated usability/IA/language runbook landed without fabricated findings.
- `2026-08-20` — Wave 3 complete. The current frontier is real participant research; no further AI-agent implementation mission is materialized until participant evidence returns or the user explicitly authorizes a provisional implementation.
