# Agent A5 — Under the Hood Visibility Reader

**Repository:** `/home/hamza/repo/x_test`  
**Artifact type:** executable  
**Workspace:** `/home/hamza/repo/x_test-w2-engagement` on branch `agent/w3-under-the-hood-reader`  
**Isolation reason:** concurrent writable mission; this branch owns only the authenticated Account Health visibility read adapter in `tech_news.js` while Agent B3 owns Phase-3 shared persistence/UI/transport surfaces  
**Can start:** after Account Health Core is integrated on main  
**Depends on:** Phase 1C complete + Account Health Core `f0c4b9b`  
**Execution lifetime:** Persistent Agent Loop required  
**Wake strategy:** no artificial timer; use event waits only for a real external/persistent blocker  
**Developer visibility:** headless by default

## Read first

- `docs/plans/PHASE_1D_ACCOUNT_HEALTH.md` — authoritative visibility-observation contract.
- `docs/ACCOUNT_HEALTH_AND_VISIBILITY.md` — source-of-truth semantics for observed evidence versus inferred diagnostics.
- `docs/agent-plans/2026-08-19-network-growth-wave-3/README.md` — current ownership boundaries.
- `tech_news.js` — existing authenticated X read/browser owner and the only source file this mission may modify.
- `health.js` — read-only derived health contract; do not modify it.

Use **Causal Coding** before source mutation and **Persistent Agent Loop** for execution lifetime. Do not create or run tests unless independently mandated by repository rules; current plans do not authorize tests.

## Objective

Add one bounded authenticated read adapter for X's available **Under the Hood** account surface so later Phase-1D integration can record actual observable visibility/account-label evidence without guessing from reach, timing, or activity.

The adapter is read-only. It must return explicit `available:false` when the surface cannot be reached, authenticated, or parsed. It must never infer a label, health state, restriction, shadowban, bot score, or reputation score from missing data or engagement metrics.

## Ownership

You own:

- `tech_news.js` only;
- reuse of the existing authenticated browser/session pattern already present there;
- bounded navigation to the currently documented X Under-the-Hood surface;
- conservative extraction/normalization of observable account/post labels and summary metadata when present;
- a stable exported read interface for later bridge/persistence integration;
- focused non-test verification without live X writes.

Agent B3 concurrently owns Phase-3 `store.js`, `automation.js`, `x_http.js`, `dashboard.js`, `agent_bridge.js`, and associated distribution integration. Do not touch those files.

## Output contract

Expose one public read function whose result is compatible with the Phase-1D plan:

```js
{
  available: true,
  capturedAt,
  accountLabels: [],
  postLabels: [],
  period: null,
  rawSummary: {},
}
```

or, when the surface is unavailable/unreadable:

```js
{
  available: false,
  capturedAt,
  reason: 'surface unavailable or not readable',
  accountLabels: [],
  postLabels: [],
  period: null,
  rawSummary: {},
}
```

Preserve only observable text/metadata needed for later provenance recording. Do not store cookies, tokens, raw page HTML, database state, or speculative semantics.

## Coordination contract

- Final commit must modify only `tech_news.js`.
- Reuse current `AUTH_TOKEN`/`CT0` browser-cookie setup; do not add another browser/client abstraction.
- No writes to SQLite or app state.
- No dashboard, bridge, health, engagement, relationship, automation, scheduler, transport, or documentation changes.
- No X write actions.
- Absence of labels or surface availability must not be interpreted as HEALTHY or CONSTRAINED.
- Do not reverse-engineer unpublished BotMaker/visibility rules or add hidden-risk heuristics.
- Keep reads bounded and finite; no polling loop.

## Success conditions

- A caller can attempt one authenticated Under-the-Hood read through `tech_news.js`.
- When observable, the result exposes normalized account/post label evidence plus capture/provenance-friendly metadata.
- When unavailable, inaccessible, or structurally unreadable, the result cleanly returns `available:false` with a reason and empty normalized evidence arrays.
- The adapter never derives health state or hidden platform scores.
- Existing X research/target-reader behavior remains unchanged.
- Final commit changes only `tech_news.js`.

## Verification intent

Use the smallest direct evidence capable of disproving the contract:

- `node --check tech_news.js`;
- controlled/mocked browser/page smoke for observable and unavailable DOM shapes when practical;
- confirm bounded navigation and cookie setup without performing live X writes;
- `git diff --check` and final path inspection.

Do not add test files or run broad suites.

## Out of scope

- health observation persistence;
- `deriveAccountHealth` integration;
- Account Health dashboard/bridge commands;
- saturation/repetition modifiers in Engage Next;
- automatic interpretation of labels;
- Phase-3 distribution work;
- experiments or learned strategy.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commit;
3. exact public interface added to `tech_news.js`;
4. normalized observable fields and unavailable behavior;
5. checks actually run and results;
6. current X/browser/DOM assumptions;
7. unresolved risks/deviations;
8. explicit confirmation that only `tech_news.js` changed and no live X write was used.
