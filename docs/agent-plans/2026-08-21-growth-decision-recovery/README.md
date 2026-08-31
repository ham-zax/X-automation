# Growth Decision Recovery + Live Pilot — Agent Coordination

**Repository:** `/home/hamza/repo/x_test`
**Source of truth:** `docs/plans/GROWTH_FOCUS_LEARN_WRITER_LOOP.md` plus the current user direction to optimize qualified follower/engagement growth under factual constraints
**Coordination base:** `92ccd17` plus the current uncommitted recovery edits; **do not reset or discard the dirty working tree**
**Execution shape:** single long-lived mission
**Current wave:** Recovery Wave 1

## Current frontier

| Mission | Type | Status | Can start | Workspace | Isolation reason | Blocked by |
|---|---|---|---|---|---|---|
| Agent A8 — Growth Decision Recovery + Live Pilot | mixed | complete; integration reviewed | complete | current checkout | none; one writer owned the coupled repair and operating pilot | none |

## Dependency map

```text
current integrated product + uncommitted UX/context fixes
        |
        v
A8 repair: Editorial -> candidate decision -> strategy -> Writer -> growth packaging -> review
        |
        v
A8 live pilot: up to four additional authorized outbound items
        |
        v
fixed-window measurement + documented operating findings
        |
        v
future refinement / Learn feedback / media follow-up if still needed
```

## Shared contracts

- Growth objective is **qualified/relevant follower and engagement growth**, not raw activity volume.
- Truth/evidence remains a hard constraint and provenance boundary; it is not the public-copy objective.
- External Viral evidence remains observational. Do not convert association into a causal X-ranking claim.
- Human publication/send authority remains structurally unchanged. The user has given this mission a **bounded live-pilot authorization** described below; do not turn that into generalized autonomous publication authority.
- Writing strategy modes remain `off | suggest | apply`; only persisted `apply` enters Writer.
- Results remains descriptive outcome truth; Learn remains evidence/interpretation.

## Live-pilot authorization

The user originally authorized five outbound posts. One has already been published during the failed pilot:

`https://x.com/ham_zax/status/2090704035259232749`

Therefore this recovery mission may publish **at most four additional outbound X items total** (main-feed posts, quote posts, or replies combined) without asking again.

This is a maximum, not a quota. Publishing zero, one, or two items is correct if those are the only opportunities that survive the repaired decision path. Do not manufacture four items merely to consume the authorization.

The mission may exercise the product's existing explicit review/approval/send/publication actions for those bounded pilot items after the repair's success conditions are satisfied. It must not add a product capability that lets AI approve or publish arbitrary future content.

## Known failed-pilot state

The first published cybersecurity-resource post exposed the following facts:

- generation provenance recorded `strategySelectionId: null`, `strategyMode: null`, `strategyApplied: false` even though substantial external strategy evidence was available;
- the candidate itself had `recommendedPipeline: ignore` with routing reason `No sufficiently additive distribution action yet; research it or wait for a stronger angle.`;
- internal verification/risk context leaked into prime public copy;
- the post had no source/action path despite being a resource post;
- it had no media, and current transport cannot actually attach required media;
- it scored `50/50` Writing Quality despite weak stopping power/distribution packaging;
- the live screenshot showed essentially no engagement and very low reach, but this single outcome must not be treated as causal proof about any individual tactic.

Four pre-repair items were identified as **approved but unscheduled** at mission start. After recovery they are preserved but inactive (`drafting`, no approval, no schedule), and all four retain `recommendedPipeline: ignore`:

- Vercel fx — candidate `https://x.com/vercel_dev/status/2089828083415355806`, draft 12;
- Cursor Origin — candidate `https://x.com/cursor_ai/status/2089758713183613266`, draft 13;
- Block Berd — candidate `https://x.com/blocks/status/2089753189985706377`, draft 14;
- oMLX — candidate `https://github.com/jundot/omlx`, draft 16.

Their pre-failure publication authority has been revoked. Any future reuse must pass the repaired current decision/strategy/packaging flow and receive new approval provenance.

## Workspace policy

Use the current checkout. The dirty tree contains relevant recovery work that must be preserved, including:

- explicit Generate instead of automatic Discover generation;
- blank new draft scaffolds;
- human-supplied `operatorContext` for Writer;
- light mode as the default plus dark-mode contrast repairs;
- evidence-first Learn/Viral composition;
- prompt changes that allow bounded source-attributed commentary without demanding a second source merely because X text is short;
- the live publishing-session documentation.

Do not reset, stash away, discard, or overwrite these changes. Inspect them and either integrate them into the final repair or deliberately revise them with an explicit reason.

No worktree is needed because this wave has one writer. If the current checkout becomes unsafe because another writer appears, stop and report the collision rather than silently creating topology.

## Integration policy

No branch integration is planned. A8 owns the current checkout through the end-to-end recovery. Any commits are optional; report them if created. Do not rewrite unrelated history.

## Execution lifetime policy

A8 requires `persistent-agent-loop` because the mission includes a real live pilot, scheduled/delayed publication decisions, and fixed-window measurement observation.

Use:

- a persistent Terminal/process only when the app/runtime needs one;
- event waits for readiness/process changes;
- native timers for future publication/measurement times;
- meaningful checkpoints after the repair is complete, after each live outbound action, and after the available measurement windows.

Status questions or compatible steering from the user do not terminate the mission. Preserve valid waits and continue until the bounded mission is complete, explicitly stopped/replaced, or genuinely blocked.

## Validation policy

Do not create, modify, or run tests. This mission requires only direct non-test evidence needed to observe the requested product:

- targeted runtime/profile/editorial smoke evidence;
- real browser use of the repaired flow;
- relevant syntax/build checks for changed runtime/UI code;
- final diff inspection;
- real publication/result URLs and fixed-window reads for any live pilot items.

Do not run a broad test suite.

## Future / blocked work

- Participant validation of final IA/labels remains separate from this growth-decision recovery.
- A richer media pipeline may remain future work only if A8 proves that a real attachment path is not a bounded extension of the existing X transport. The current UI must not pretend media can publish if it cannot.
- Strategy-effectiveness conclusions remain blocked on sufficient own-account observations/explicit tests; the pilot may create observations but cannot declare causal winners.

## Status log

- `2026-08-21` — recovery package created after the first live pilot post demonstrated that candidate selection, strategy application, public-copy qualification, packaging review, and distribution flow were not aligned with the product's growth objective.

- `2026-08-21` — A8 completion reviewed against the actual diff and persisted state. Integration review additionally repaired two cross-boundary regressions: existing Engage Next replies are exempt from the main-feed Writing Approach/Ignore override contract, and Growth Packaging now judges the current public copy rather than stale hidden Writer rationale. Current operating docs were synchronized with the new real image attachment/readiness path. A9 Autonomous Reply Operator remains isolated in its separate worktree and may consume the stable main commit after this integration lands.
