# Growth Learning UX Wave 2 — Prototype + Content Design Coordination

**Repository:** `/home/hamza/repo/x_test`
**Authoritative source plan:** `docs/plans/UX_HCI_DEEP_RESEARCH_PROGRAM.md`
**Wave-1 synthesis:** `docs/ux/WAVE1_SYNTHESIS.md`
**Integrated evidence base:** `407e6a8` plus the Wave-1 synthesis/coordination update in the materialization commit containing this file
**Execution shape:** two parallel documentation/prototype missions, then planner integration; no React/backend implementation in this wave
**Current wave:** 2 — task/user flows, low-fi wireflows, product language, and Human-AI interaction patterns

## Why Wave 2 remains non-executable

Wave 1 established strong repository-observed interaction and recovery problems, but Agent B1 correctly produced **research hypotheses**, not participant findings. The final primary IA and final user-facing terminology remain falsifiable until real card-sort/tree-test/usability evidence exists.

Therefore Wave 2 converts the frozen interaction invariants into testable prototypes and content-design contracts. It must not silently choose H1/H2 as product truth or mutate production navigation.

## Current frontier

| Mission | Type | Status | Can start | Workspace | Branch | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|---|
| Agent A2 — Task/User Flows + Low-Fi Wireflows | documentation/prototype | ready | immediately | `/home/hamza/repo/x_test-w7-ux-audit` | `agent/w7-ux-wireflows` | concurrent writer; owns flow/wireflow artifacts only | none |
| Agent B2 — Product Language + Human-AI Interaction System | documentation/content design | ready | immediately | `/home/hamza/repo/x_test-w7-ux-research` | `agent/w7-ux-language` | concurrent writer; owns language/Human-AI artifacts only | none |

## Dependency map

```text
Wave 1 integrated
A1 audit + B1 task/journey/IA research
                 |
                 v
        WAVE1_SYNTHESIS.md
 frozen authority/consequence/lifecycle/recovery/evidence semantics
 final IA + exact labels remain hypotheses
                 |
        /--------------------\
        v                    v
     Agent A2             Agent B2
 task/user flows         product language
 + low-fi wireflows      + status/recovery
 H1/H2 prototypes        + Human-AI patterns
        \                    /
         \                  /
          planner integration
                 |
                 v
       expert prototype review
       + real participant research
                 |
                 v
 production IA/React implementation only after evidence
 or explicit later decision to proceed provisionally
```

## Frozen contracts from Wave 1

Agents may refine presentation but must preserve these semantics:

1. **Authority:** recommendation != selection != draft/review != approval != schedule/wait != publish/send != published/sent result.
2. **Consequences:** consequential surfaces answer `What / Why now / What can I do / What happens next` before activation.
3. **Lifecycle recognition:** users should not need to remember which module owns review, approval, scheduling, publication, or reconciliation.
4. **Recovery:** exceptional errors say what failed, whether a remote action may already have happened, current authoritative state, whether retry is safe, and the next recovery action.
5. **Evidence provenance:** external niche evidence, internal account evidence, and explicit experiment evidence remain distinguishable.
6. **Writing strategy behavior:** canonical modes are `off|suggest|apply`; behavior is fixed, final user-facing labels are not. `suggest` has zero Writer effect; `apply` is human-controlled guidance for one generation, not approval/publication/learned-rule acceptance.
7. **Product purpose:** default strategic framing is qualified growth velocity, not raw follower count or likes.

See `docs/ux/WAVE1_SYNTHESIS.md` for full wording and unresolved decisions.

## Unresolved research hypotheses — do not freeze by preference

- Current C0 vs five-destination H1 vs six-destination H2.
- Whether `Learn` means evidence/adaptation or education/help.
- Exact labels for external patterns, own-account learning, tests, and strategy recommendations.
- Exact user-facing labels for `off|suggest|apply` semantics.
- Whether strategy selection belongs in Learn, the draft surface, or both with different responsibilities.
- Which Viral Styles controls ordinary users actually need outside Advanced.
- Settings vs Advanced vs Diagnostics language/placement.
- Whether bare recommendation/quality scores help judgment.
- Exact reconciliation UI required for specific partial-success failure classes.

## Ownership

### Agent A2 owns only

- `docs/ux/TASK_FLOWS.md`
- `docs/ux/USER_FLOWS.md`
- `docs/ux/WIREFLOWS.md`

Agent A2 may read all Wave-1 artifacts and current product code. It must not edit product source or Agent B2-owned content-design files.

### Agent B2 owns only

- `docs/ux/PRODUCT_LANGUAGE.md` — update the existing artifact rather than creating a duplicate language system
- `docs/ux/HUMAN_AI_INTERACTION.md` — update the existing artifact; this serves the source plan's Human-AI patterns deliverable
- `docs/ux/STATUS_LANGUAGE.md` — new status/error/recovery vocabulary owner

Agent B2 may read all Wave-1 artifacts and current product code. It must not edit product source or Agent A2-owned flow/wireflow files.

If either mission needs the other's owned file, report the boundary conflict instead of crossing it.

## Research/prototype policy

- Repository-observed facts must be labeled as such.
- Design proposals must be labeled hypotheses/prototype choices.
- Do not fabricate participants, quotations, card-sort results, tree-test results, usability results, percentages, or validated preferences.
- H1/H2 navigation-dependent wireflows should both remain inspectable where the IA choice materially changes task routing.
- Exact user-facing terminology remains provisional unless current repository semantics require a precise authority word.

## Testing and validation policy

No tests or application builds are authorized. These are documentation/prototype missions.

Completion evidence is limited to:

- inspect the produced artifacts against mission success conditions;
- check documentation diff hygiene where useful;
- inspect the final owned-file diff once;
- state unresolved user-evidence questions rather than filling them with assumptions.

## Integration policy

The planner/main session integrates both returned commits. Their file ownership is disjoint.

After integration, the planner performs one synthesis against Wave-1 findings and decides the new frontier. Production React/backend work remains blocked until either:

1. real participant evidence resolves the relevant IA/language hypotheses; or
2. the user explicitly chooses to proceed with a reversible provisional implementation despite that evidence gap.

## Future / blocked work

Low resolution only; do not implement in Wave 2:

- production navigation/shell changes;
- React decision/lifecycle refactors;
- consolidated production Learn surface;
- deterministic writing-strategy synthesis/persistence;
- Writer strategy application;
- outcome attribution/business-opportunity ledger;
- product code recovery/reconciliation changes;
- actual participant research findings.

## Status log

- `2026-08-20` — Wave 1 A1/B1 evidence integrated on main as `7e6c8b6` and `407e6a8`.
- `2026-08-20` — `docs/ux/WAVE1_SYNTHESIS.md` freezes evidence-backed interaction semantics while leaving IA/language hypotheses open.
- `2026-08-20` — Wave 2 materialized as two parallel documentation/prototype missions; production mutation remains intentionally blocked.
