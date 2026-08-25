# Agent A — Growth OS Live Feedback-State Repair

**Repository:** `/home/hamza/repo/x_test`  
**Artifact type:** mixed  
**Workspace:** current checkout `/home/hamza/repo/x_test`  
**Isolation reason:** none; this is the only current writer mission  
**Can start:** immediately after the coordination package is committed  
**Depends on:** `d17d935` and the coordination README in this folder  
**Execution lifetime:** ordinary  
**Wake strategy:** none  
**Developer visibility:** headless

## Read first

- `docs/agent-plans/2026-08-25-growth-os-live-feedback/README.md` — live evidence, boundaries, dependency map, and scope.
- `docs/GROWTH_OS_MOMENTUM_OPERATOR.md` — authoritative current operator design and prioritized next OS improvements.
- `docs/FIRST_1000_GROWTH_MODE.md` — bootstrap policy and First-1,000 invariants.
- `AGENTS.md` — repository authority, commands, safety boundaries, and coding policy.

## Objective

Make the Growth OS state path trustworthy from **live source discovery -> operator disposition or successful action -> action-time source context -> later outcome inspection**, so the operating agent no longer has to repair local state manually and future ranking changes can learn from real own-account evidence.

This is a state/feedback-loop mission, not a ranking-theory mission. Preserve the current empirical operator heuristic unless the existing code requires a small compatibility adjustment. Capture the missing evidence first; do not promote bookmark density, low reply crowding, or any other live observation into a permanent ranking rule from the current small sample.

## Current state

The First-1,000 operator landed in `d17d935`.

Current runtime behavior materially relevant to this mission:

- `growth-next` merges last-known-good `x_latest` and `x_momentum`, derives route/urgency/operator priority, and exposes reply crowding plus source-style shape.
- `candidate_actions` currently stores `(candidate_key, action, output_tweet_id, output_url, commentary, created_at)` and is keyed by candidate/action.
- `record-action` currently requires the candidate to exist first. A live-discovered source absent from `candidates` produces `Candidate not found`, so the operator has to run `ingest` and then `record-action`.
- Successful action history suppresses reused candidates through `hasCandidateAction`, but there is no durable exact-candidate state for an intentional operator skip/defer. A source that was deliberately rejected because it was redundant/saturated for this account can therefore keep returning near the top of `growth-next`.
- Source conditions at action time are not persisted beside the action. Later output metrics therefore cannot reliably answer whether a reply/quote/repost was chosen against a source with 4 replies or 400, 3K views or 300K, high bookmark density, rising views/hour, or some other observed condition.
- Live X remains authoritative for whether a social mutation actually happened. Local recovery may reconcile a confirmed live action, but must never fabricate or assume one.

## Ownership

You own the smallest coherent production/runtime + documentation change necessary to close these Growth OS state gaps:

- the bridge/store contract used to capture a live-discovered source and record an exact operator action or disposition;
- durable exact-candidate operator disposition used by `growth-next` so a deliberate skip/defer does not immediately resurface the same source;
- durable action-time source context sufficient to later compare our output outcome against the source conditions that existed when the action was chosen;
- the read path needed to inspect that evidence coherently from the agent/operator side;
- documentation updates necessary to keep the operator contract accurate.

Neighboring work owns:

- browser/X mutation mechanics and submit reliability;
- systemd/runtime supervision;
- scheduler/main-feed publication authority;
- Writer/viral-copy changes not required by the new state contract;
- future ranking-weight changes based on the evidence this mission enables;
- dashboard redesign.

## Coordination contract

Preserve these behaviors while changing the state model:

1. **Live truth first.** A successful action record requires an exact live output ID/URL when one exists. Never synthesize one. Reconciliation of an already-live action is allowed when live evidence is supplied.
2. **No duplicate social action.** This mission changes local recording/disposition, not the external send path. Retrying a local ledger write must not imply or trigger another X mutation.
3. **Unknown != zero.** If the operator did not observe bookmarks, source replies, views, or another metric, preserve that as unknown/absent rather than silently coercing it to zero in the action-time evidence record.
4. **Exact candidate disposition, not target censorship.** A skip/defer applies to the exact candidate/source instance and carries transparent reason/state. Do not create a hard author, topic, or interaction-volume ban.
5. **Inspectable empirical fields.** Source age, views, likes, reposts, replies, bookmarks when observed, reply/bookmark density when computable, source momentum/velocity when available, route/action, and source-style shape are evidence fields. They are not claims about X's ranking algorithm.
6. **First-1,000 behavior remains.** Do not revert the bootstrap routing changes in `d17d935` or make cold relationship history an admission gate again.
7. **Existing callers remain coherent.** Prefer extending the current store/bridge owner rather than creating a second parallel ledger or ad hoc operator-only file.

## Success conditions

The mission is complete when all of the following are true in the real repository/runtime contract:

- A live X source discovered outside the stored snapshots can be supplied once with its required identity/text plus whatever metrics were actually observed, and the operator can durably record either a successful action or an exact-candidate disposition without first performing a separate manual `ingest` round trip.
- Successful action recording remains idempotent for the same exact candidate/action and does not create a duplicate external action.
- A deliberate exact-candidate skip/defer has durable, inspectable state and `growth-next` no longer immediately returns that same candidate as an actionable top item while the disposition is active.
- The disposition model is transparent and bounded: it does not silently ban an author/topic, and its reason/state can be inspected or revised according to the representation you choose.
- Every newly recorded live action can retain the source conditions known at action time, including at least: observed timestamp/source age basis, route/action, views, likes, reposts, replies, bookmarks when observed, reply density when computable, bookmark density when computable, viral/momentum fields available from the current candidate/observations, and the source-style feature shape already exposed by Growth OS.
- Missing action-time source metrics remain missing/unknown rather than being represented as observed zero merely for convenience.
- There is a coherent agent-facing read path that can show a recorded action together with its action-time source context and available output/outcome information, so later Learn/ranking work does not have to reconstruct that join from browser history.
- `growth-next` continues to filter already-successfully-used candidates and now also respects the exact-candidate operator disposition contract without changing unrelated ranking weights.
- Existing publication, approval, scheduler, and browser authority boundaries remain unchanged.
- Relevant operator documentation describes the resulting contract accurately and labels new ranking-sensitive fields as empirical/observational rather than platform laws.

## Required validation

No tests are authorized. Do not create, modify, or run tests.

Follow `AGENTS.md` and Causal Coding. Use only the smallest non-test runtime/CLI observations needed to demonstrate the changed contract, then relevant syntax/static checks and final diff inspection. Do not run a broad suite.

## Out of scope

- Assigning a positive/negative ranking weight to bookmark density, reply density, author authority, or another newly captured field based only on the current live sample.
- New follower-growth heuristics not supported by repeated own-account evidence.
- Dashboard/UI redesign.
- Browser automation changes, click/keyboard submission changes, X transport changes, or auth/session work.
- systemd/service supervision repair.
- Hashtag experiments or content-copy optimization.
- Scheduler/`AUTO_POST` changes.
- A generalized author/topic saturation policy.
- Unrelated cleanup, refactors, abstractions, or new dependencies.

## Working style

Inspect the current store/bridge/operator ownership before choosing the representation. Follow repository conventions and use the existing database/bridge path rather than creating a parallel state system unless the current contract demonstrably cannot express the requirement.

Use Causal Coding before source mutation. Keep one leading causal hypothesis at a time and make the smallest complete change that fixes the demonstrated state gap.

Testing is opt-in and is not authorized here. Do not create, modify, or run tests. Do not add a dependency for this mission unless the repository proves the existing facilities are insufficient and the dependency is genuinely necessary.

## Finish report

Return:

1. status: complete / blocked / needs decision;
2. workspace/branch and commit(s) created;
3. concise summary of the resulting live-source capture, disposition, action-time evidence, and outcome-read contract;
4. any bridge/store/public interface changes another session must know;
5. explicitly required validation actually run, if any; otherwise state none;
6. whether the implementation changed any ranking weight (expected answer: no unless a concrete repository compatibility issue forced a bounded change, which must be explained);
7. unresolved risks, deviations, or decisions needed.
