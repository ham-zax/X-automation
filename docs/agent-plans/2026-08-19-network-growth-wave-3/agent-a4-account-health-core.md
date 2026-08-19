# Agent A4 — Account Health Core

**Repository:** `/home/hamza/repo/x_test`
**Artifact type:** executable
**Workspace:** `/home/hamza/repo/x_test-w2-engagement` on branch `agent/w3-account-health-core`
**Isolation reason:** concurrent writer; this mission owns only the new pure `health.js` domain module while Agent B3 owns Phase-3 shared integration surfaces
**Can start:** immediately after assigned branch is reset to the Wave-3 coordination base
**Depends on:** completed Phase 1B/1C relationship and engagement history; coordination base includes full Phase 1C
**Execution lifetime:** Persistent Agent Loop required
**Wake strategy:** no artificial timer; event wait only for a real blocker
**Developer visibility:** headless by default

## Read first

- `docs/plans/PHASE_1D_ACCOUNT_HEALTH.md` — authoritative health behavior.
- `docs/ACCOUNT_HEALTH_AND_VISIBILITY.md` — governing semantics and non-goals.
- `docs/agent-plans/2026-08-19-network-growth-wave-3/README.md` — strict ownership boundary.
- `AGENTS.md` — repository invariants.
- `relationship.js`, `engagement.js`, `drafting.js` — neighboring contracts to understand, not modify.

Before source mutation, use **Causal Coding**. Use **Persistent Agent Loop** for execution lifetime. Do not create or run tests unless independently mandated by repository rules; current plans do not authorize tests.

## Objective

Implement the pure derived Account Health domain core in a new `health.js`. Given caller-supplied observations, relationship profiles/events, engagement summaries, and recent reply text/archetypes, the module should calculate explainable saturation pressure, reply repetition, network quality, InteractionYield, and the final `healthy | watch | constrained` state without reading/writing SQLite, touching X, or creating hidden bot/reputation scores.

This mission deliberately stops before persistence, dashboard, bridge, Under-the-Hood reads, or Engage Next wiring.

## Ownership

You own only:

- new `health.js`;
- `HEALTH_STATES`;
- pure `calculateSaturationPressure(...)`;
- pure `analyzeReplyRepetition(...)`;
- pure `summarizeNetworkQuality(...)`;
- pure `calculateInteractionYield(...)`;
- pure `deriveAccountHealth(...)`;
- transparent component explanations/evidence labels;
- focused non-test verification of those pure contracts.

Agent B3 concurrently owns Phase-3 scheduler/publisher integration and must remain collision-free.

## Coordination contract

- Final commit must change only `health.js`.
- Do not modify `store.js`, `relationship.js`, `engagement.js`, `dashboard.js`, `agent_bridge.js`, `tech_news.js`, `scheduler.js`, `automation.js`, `x_http.js`, docs, or package files.
- Accept raw observations/metrics/events as inputs; do not reach into persistence from `health.js`.
- `WATCH` is advisory. It must never be represented as a publication/engagement prohibition by this core.
- `CONSTRAINED` requires caller-supplied actual observed platform/project hard evidence; low reach, volume, saturation, concentration, or repetition alone must never infer it.
- Genuine reciprocal active-conversation bursts remain healthy by default unless actual hard evidence says otherwise.
- Saturation is a bounded explainable diagnostic, not a fixed reply quota or target ban.
- Exact/high-confidence near-duplicate text may be identified as a hard duplicate fact; archetype/style concentration is warning-level.
- Do not add random timing, human simulation, bot-risk probability, hidden reputation scoring, embeddings, external ML, or new dependencies.

## Required behavior

Implement the source-plan contracts:

### Health state

Export:

```js
export const HEALTH_STATES = ['healthy', 'watch', 'constrained'];
```

`deriveAccountHealth(...)` must return state plus explicit reasons/provenance. Behavioral inefficiency can produce `watch`; only supported observed hard evidence can produce `constrained`.

### Saturation pressure

Consume fields such as recent interactions, unanswered interactions, consecutive unanswered count, response/continuation timestamps, topic diversity, and active-conversation context.

Return at least:

```js
{
  pressure: 0..100,
  band: 'low' | 'mild' | 'meaningful' | 'high',
  modifiers: [],
  overrideReasons: [],
  explanation: ...,
}
```

One-sided unanswered concentration raises pressure; recent responses/continued conversation/topic diversity lower it; active bidirectional conversation substantially offsets ordinary pressure. Direct questions/new verified evidence can be represented as opportunity-level override evidence when supplied.

Numeric defaults are internal `EMPIRICAL_VARIABLE` heuristics and must be inspectable in returned explanations.

### Reply repetition

Use local JS normalization/token/Jaccard/shingle style logic only. Distinguish:

- exact duplicate;
- high-confidence near duplicate;
- phrase similarity;
- archetype concentration;
- warnings/examples.

Do not treat five distinct informed questions as a duplicate merely because they share an archetype.

### Network quality

Expose raw components for target, class, and topic diversity; author response rate; continuation rate; recurring/connected/mutual relationship counts; and top-target concentration. An optional 0..100 summary may exist only if every component remains visible and explainable.

### InteractionYield

Implement the source formula:

```text
(author responses
 + 2 * continued conversations
 + 3 * new recurring relationships
 + 3 * relevant target follows
 + 4 * new mutual connections)
/
max(meaningful interactions, 1)
```

Return the raw numerator components alongside the composite.

## Success conditions

- A high-volume reciprocal active conversation is not classified as constrained and ordinarily remains healthy unless other evidence warrants watch.
- Repeated unanswered one-sided activity can raise saturation and contribute to `watch` without creating a hard action ban.
- Low reach or high activity alone can never produce `constrained`.
- Actual supported observed restriction/visibility evidence supplied by the caller can produce `constrained` with provenance.
- Distinct replies sharing an archetype remain non-duplicates; exact/near-identical text is detected distinctly.
- Network Quality and InteractionYield expose their raw components rather than only opaque scalars.
- Results are deterministic for identical explicit inputs.
- Final commit modifies only `health.js`.

## Verification intent

Use focused pure-function smoke scripts only. Demonstrate:

- reciprocal active conversation versus one-sided unanswered saturation;
- WATCH remaining advisory;
- constrained state requiring actual observed hard evidence;
- exact/near duplicate versus archetype-only repetition;
- network diversity/concentration components;
- exact InteractionYield arithmetic;
- deterministic repeated results.

Run `node --check health.js` and `git diff --check` near completion. Do not create tests, access SQLite, make network/X calls, or mutate live state.

## Out of scope

- health observation persistence;
- Under the Hood authenticated reads;
- dashboard or agent bridge;
- changes to Engage Next priority;
- relationship-event schema changes;
- scheduler/publisher work;
- measurement experiments or learned strategy;
- docs synchronization beyond the finish report.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commit;
3. exact public exports added by `health.js`;
4. concise formula/behavior summary;
5. checks actually run and results;
6. inputs the later Phase-1D integration session must supply;
7. empirical assumptions and unresolved risks;
8. explicit confirmation that only `health.js` changed.
