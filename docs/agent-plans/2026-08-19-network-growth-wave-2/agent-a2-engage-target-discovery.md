# Agent A2 — Engage Target Discovery

**Repository:** `/home/hamza/repo/x_test`  
**Artifact type:** executable  
**Workspace:** `/home/hamza/repo/x_test-w2-engagement` on branch `agent/w2-engage-target-discovery`  
**Isolation reason:** Agent B is still modifying shared Phase-2 persistence/workflow/UI/bridge files; this mission owns only the authenticated X target-timeline read adapter and must remain collision-free  
**Can start:** immediately after the worktree is moved to the new coordination base  
**Depends on:** integrated Engage Next Core `1d480e3`  
**Execution lifetime:** Persistent Agent Loop required  
**Wake strategy:** no artificial timer; use event waits only for a real external/persistent blocker  
**Developer visibility:** headless by default

## Read first

- `docs/plans/PHASE_1C_ENGAGE_NEXT.md` — especially Task 3 and the Discovery Sources contract.
- `docs/agent-plans/2026-08-19-network-growth-wave-2/README.md` — current ownership and integration boundaries.
- `AGENTS.md` — repository invariants.
- `tech_news.js` — existing X read owner and authenticated cookie/session patterns.
- `engagement.js` — already-integrated pure scoring contract; consume it conceptually but do not expand this mission into persistence or UI.

Before source mutation, use **Causal Coding**. Use **Persistent Agent Loop** for execution lifetime. Do not create or run tests unless independently mandated by repository rules; current plans do not authorize tests.

## Objective

Implement the bounded X target-timeline read layer needed by Engage Next. Given a supplied list of relationship-target usernames, the system should be able to fetch a small number of recent source posts in a normalized shape suitable for later Engage scoring/persistence integration.

This mission is intentionally a read adapter only. Do not persist queue items, write relationship events, discover replies to our own posts, change automation, render UI, or send anything.

## Ownership

You own:

- `tech_news.js` only;
- one focused exported target-timeline read function using the repository's existing XActions `Scraper`/cookie conventions;
- normalized target-post output including stable tweet identity, author, text, URL, timestamp, and available public metrics;
- bounded filtering needed by Phase 1C initial-reply discovery, including removal of obvious repost-only items and a configurable freshness/count bound;
- focused non-test verification of normalization, bounds, and no-write behavior.

Agent B concurrently owns `store.js`, `pipeline.js`, `agent_bridge.js`, `dashboard.js`, Phase-2 docs, and related shared content-integration surfaces.

## Coordination contract

- The completed commit must change **only `tech_news.js`**.
- Do not modify `engagement.js`, `store.js`, `relationship.js`, `pipeline.js`, `dashboard.js`, `agent_bridge.js`, `automation.js`, `x_http.js`, docs, package files, or publishing code.
- Do not write SQLite or mutate candidate/action/relationship state.
- Do not post, reply, like, follow, unfollow, repost, or otherwise mutate X state.
- Reuse the existing `Scraper` and authenticated-cookie setup already present in `tech_news.js`; do not add another browser/client abstraction or dependency.
- Accept usernames as supplied inputs. Do not perform external enrichment or follower-count targeting.
- Initial-reply discovery should return original/quote-style source posts suitable for inspection; exclude obvious retweet-only entries. Replies may be excluded by default unless the existing model clearly distinguishes them and the function exposes an explicit option.
- Preserve raw observations where useful; do not invent reply velocity, conversation quality, saturation, or contribution strength in this read layer.

## Required behavior

Provide a small public interface suitable for the later Phase-1C integration session, for example an export semantically equivalent to:

```js
fetchXTargetRecentPosts(usernames, options)
```

The exact name/options may follow current repository conventions, but the finish report must state them precisely.

Expected semantics:

- normalize `@handle`/handle inputs and de-duplicate usernames;
- enforce conservative bounds on number of targets and posts per target so one refresh is finite;
- use `AUTH_TOKEN`/`CT0` cookies when available, consistent with current authenticated reads;
- fetch recent posts for each supplied target independently so one account failure does not discard successful results from others;
- return a normalized list/result with target username, tweet ID when available, text, timestamp, URL, views/likes/reposts/replies when available, and enough source flags to distinguish obvious replies/reposts if XActions exposes them;
- exclude obvious repost-only entries by default;
- support a caller-supplied freshness cutoff or `since` timestamp without pretending that cutoff is an X algorithm law;
- preserve per-target/read errors in a bounded inspectable form rather than failing the entire batch when one target cannot be read;
- perform no persistence or workflow mutation.

## Success conditions

- A supplied list of high-value relationship targets can be read in one bounded call and returns normalized current posts suitable for `engagement.js` scoring later.
- One target read failure does not erase successful results from other targets.
- Duplicate usernames and duplicate tweet IDs do not produce duplicate output.
- Obvious repost-only entries are excluded from initial-reply discovery by default.
- The function is read-only and does not touch SQLite, workflow state, or X write APIs.
- Existing X research/account-performance functions remain compatible.
- Final commit changes only `tech_news.js`.

## Verification intent

Use the smallest evidence that proves the adapter contract:

- `node --check tech_news.js`;
- direct smoke with a stub/fake async tweet iterable or locally controlled helper seam if practical without creating tests;
- if live authenticated reads are available, at most one bounded read-only smoke against a tiny supplied target set; do not make live X availability a requirement for completion;
- verify finite bounds, username/tweet de-duplication, normalization, repost filtering, and per-target error isolation;
- `git diff --check` and final changed-path inspection.

Do not create test files or run a broad suite.

## Out of scope

- replies/responses to our own posts and conversation follow-up detection;
- queue schema or engagement persistence;
- contribution generation or reply drafting;
- relationship-event writes;
- dashboard/bridge/automation integration;
- reply sending;
- Account Health;
- scheduler, experiments, learning;
- unrelated cleanup/refactors.

## Working style

Inspect the actual installed XActions tweet fields before depending on them. Keep the adapter thin and reuse current X read conventions. Status/progress/compatible steering does not terminate the mission; continue until the success conditions are freshly verified or explicitly stopped/replaced.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commit;
3. exact public export/options added in `tech_news.js`;
4. normalized output shape and filtering/bounds semantics;
5. checks actually run and results;
6. any XActions field/behavior assumptions the later integration session needs to know;
7. unresolved risks/deviations;
8. explicit confirmation that only `tech_news.js` changed and no X/application state was mutated.
