# XGrowth Autonomous Growth-Run Implementation Plan

## Objective

Make **“continue growing”** a durable, resumable Growth OS operation that any supported reasoning agent can begin or resume under the current persisted delegation.

The finished system must support:

`Sense → Select → Verify → Prepare → Claim → Execute → Reconcile → Measure → Stop/Resume`

without requiring a human to keep a particular chat session open.

The architecture must preserve these boundaries:

> **Delegation authorizes. A run coordinates. A lease elects an operator. A claim reserves one exact action. An attempt records one possible mutation. Reconciliation establishes what happened. Sensors provide evidence. The reasoning agent supplies judgment. Browser/API transports execute but never confer authority.**

This work does **not** introduce an action-points system, action targets, or a second publisher.

## Phase 0 — Freeze the Growth-Run Contract

Create this implementation plan and synchronize `docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md` and `docs/GROWTH_OS_MOMENTUM_OPERATOR.md` as implementation lands.

The contract distinguishes five identities:

- `delegationRevision`: exact authority under which an operation is allowed.
- `runId`: durable orchestration/provenance identity.
- operator lease: which reasoning operator currently controls a run.
- action/queue claim: exclusive reservation for one exact mutation.
- `attemptId`: immutable identity of one possible consequential send.

Run stages are `startup`, `recovery`, `sensing`, `selection`, `preparation`, `acting`, `reconciliation`, and `finishing`.

Terminal run results are `completed`, `partial`, `blocked`, or `unresolved`, with structured stop reasons including `no_worthwhile_eligible_work`, `resource_ceiling_reached`, `delegation_revoked`, `delegation_revised`, `capability_unavailable`, `reconciliation_scope_blocked`, `budget_exhausted`, and `manual_intervention_required`.

Bounds are ceilings, never targets. The agent stops earlier whenever no worthwhile eligible opportunity remains. FY collection similarly stops dynamically when enough diversity exists, repetition/freshness lowers marginal value, or a resource ceiling is reached.

## Phase 1 — Separate Publication Attempts from Queue Items

Repair the uncertain-write deadlock before increasing autonomous execution frequency. Queue item `20826` is the first legacy recovery case.

Add append-oriented publication-attempt persistence with fields sufficient to preserve queue/candidate/run identity, action fingerprint, delegation revision and authority snapshot, exact approved content/hash and target identity, transport/claim ownership, state, send-boundary timing, evidence, output identity, closure reason, error, and timestamps.

Define an action fingerprint over route, candidate identity, target identity where applicable, and approved-content hash. Unknown sends retain a duplicate fence for that exact fingerprint.

Attempt state machine:

`claimed → send_started → confirmed_published | confirmed_not_sent | investigating | closed_unresolved`

`send_started` must be recorded **before** invoking a consequential mutation.

`confirmed_published` requires positive evidence of the live output and route-specific structure. `confirmed_not_sent` is allowed only when evidence proves the send boundary was not crossed or a transport authoritatively rejected the operation. Failure to find a post on X is insufficient. `closed_unresolved` preserves uncertainty and permanently prevents automatic replay of the exact action.

Unresolved blocking becomes scoped instead of account-wide and indefinite: exact affected actions remain fenced, active investigation can temporarily block conflicting main-feed publication, and a closed unresolved attempt conservatively counts as a possible publication for the normal cadence window without freezing unrelated future operation forever.

Queue rows remain planned/approved work; publication-attempt state becomes authoritative for send/reconciliation history. Existing `publishing` rows are migrated into attempts. Queue `20826` must not be retried: recover positive evidence if possible, otherwise close unresolved and release unrelated work according to scoped blocking.

Reconciliation must be idempotent and must not duplicate actions, relationships, output records, or attempts.

## Phase 2 — Fix Agent Provenance

Agent-originated judgment must never masquerade as human approval.

Change the agent bridge `behavior-select` path to trusted agent/operator provenance. Do not permit a caller-supplied `actor=human` value to confer provenance or authority.

Normalize agent context where available around `actorType`, `adapterType`, `sessionId`, `runId`, and `delegationRevision`. Provenance remains separate from publication authority.

## Phase 3 — Structured Operational Readiness

Add a readiness owner that reports independent dimensions instead of conflating permission and execution readiness.

Dimensions:

- permission: delegation status/revision/expiry and route-specific grants/budgets;
- reasoning agent: attachment, adapter/session/run, capabilities, lease holder, heartbeat;
- sensors: latest success, freshness, count, provenance, errors;
- publication transport: route-by-transport capability;
- reconciliation: investigating/closed-unresolved counts and scoped blockers;
- scheduler/runtime: configured/running/heartbeat/last outcome/next invocation.

A heartbeat proves only recent attachment. `AUTO_POST=true` must not be rendered as end-to-end publication readiness.

Expose this through agent/API surfaces and the Growth Operator UI.

## Phase 4 — Durable `growth-run`

Add durable `growth_runs` persistence and one public resumable orchestration protocol that reuses existing queue, source, action, writer, main-feed preparation, and operator-lease machinery rather than duplicating them.

Public bridge commands:

- `growth-run-begin`
- `growth-run-status`
- `growth-run-next`
- `growth-run-resume`
- `growth-run-finish`

`growth-run-begin` binds the current delegation revision, acquires the existing operator lease, captures readiness and unresolved-attempt state, establishes ceilings, creates the run, and returns the first permitted operation without publishing anything.

`growth-run-next` is deterministic orchestration. It returns legal/useful operations such as `recover_attempt`, `collect_for_you`, `inspect_candidate`, `verify_source`, `select_behavior`, `prepare_candidate`, `claim_action`, `execute_browser_action`, `reconcile_attempt`, `measure`, and `finish`. It does not decide what is interesting or author content.

`growth-run-resume` must allow a different supported reasoning session to resume durable state without repeating completed actions. The existing operator lease remains the exclusivity primitive. Delegation revision/expiry/grants/capabilities are revalidated before consequential work and immediately before send.

`growth-run-finish` records confirmed actions, skips/dispositions, deferrals, unresolved attempts, metrics, and a structured stop reason, then releases the lease.

## Phase 5 — Authenticated Browser-Sensor Provenance

Make personalized For You sensing a supported browser capability with durable observation provenance rather than an ad-hoc extraction.

Extend canonical FY ingestion with observed time, intended account handle, adapter/session/run identity, browser-session provenance, sensor version, and collection status while preserving exact observed tweet/source identity, metrics, URLs, and timestamps. Never store browser credentials.

Verify the browser visibly represents the intended X account before treating a personalized snapshot as authoritative. A mismatched/indeterminate account is a readiness problem and must not silently overwrite the useful personalized snapshot.

Repair routine Browser Fast scrolling/virtualized-feed operation. DevTools remains diagnostic/recovery tooling, not the normal sensor implementation.

Typical FY collection may observe roughly 25–50 organic items but terminates dynamically and deduplicates tweet IDs. Exact live-source inspection remains required before consequential action where the source contract requires it.

## Phase 6 — Browser-Capable Runtime Adapter

Provide at least one runtime capable of performing a whole Growth Run without a human keeping a chat open. Existing `ai_runtime.js`/CLI writer components are not assumed to be authenticated-browser operator runtimes, and `automation.js` must not become a hidden browser publisher.

A runtime adapter reports real capabilities (reasoning, browser read, browser mutation, X authentication, primary-source research), registers/heartbeats a session, begins or resumes a run, and finishes it.

All supported agent surfaces consume the same Growth Run contract; at least one installed adapter must support unattended scheduled invocation.

## Phase 7 — Foreground End-to-End Validation

Before scheduling, validate foreground behavior through direct runtime/DB/bridge evidence:

- healthy no-action run ending `no_worthwhile_eligible_work`;
- interrupted run resumed by another supported session without replay;
- uncertain publication remains duplicate-fenced while unrelated work can later proceed;
- delegation revision/revocation blocks subsequent consequential action;
- browser capability loss returns a structured capability outcome rather than using an unsupported path;
- successful eligible action follows inspect → prepare → claim → send boundary → execute once → verify → reconcile → persist.

Automated test creation/execution is not part of this implementation unless independently authorized or mandated by repository policy. Use focused non-test completion checks and direct observable acceptance evidence.

## Phase 8 — Recurring Unattended Execution

Add a dedicated browser-capable growth-agent service/timer rather than overloading the existing background automation daemon.

The service starts or contacts the configured reasoning runtime and asks it to begin/resume the canonical Growth Run. The timer activates roughly hourly, coalesces through existing lease semantics, performs no catch-up bursts after downtime, and treats a no-action invocation as healthy.

Expose configured/enabled/last invocation/last result/active run/next invocation through readiness.

Enable recurring execution only after recovery safety, provenance, readiness, foreground Growth Run, and browser sensor/runtime gates are satisfied.

## Phase 9 — UI Operational Truth

Growth Operator settings and overview must distinguish permission, agent attachment, browser readiness, FY freshness, reconciliation state, and scheduler status. Expose current/last run, result, confirmed actions, unresolved outcomes, and stop reason without turning the interface into a raw event log.

## Phase 10 — Likes Later

Do not include Likes in the dependable-autonomy release. Add Likes later as a separate first-class action with explicit delegation scope, target identity, claim/attempt, browser mutation, verification/reconciliation, and `already_liked` semantics. Main-feed delegation must not implicitly authorize Likes.

## Migration Strategy

Converge on the new internal contract in coordinated waves. Inventory all callers of queue publication fields, add attempt persistence, backfill unresolved legacy state, migrate claim/send/reconciliation callers, make attempts the publication-result source of truth, and remove obsolete decision paths once all in-scope callers have moved. Retain historical queue columns only if SQLite migration cost warrants it; they must no longer confer state authority.

## Module Ownership

| Module | Responsibility |
|---|---|
| `store.js` | durable run/attempt persistence |
| `publication_reconciliation.js` | attempt transition and reconciliation policy |
| `pipeline.js` | queue/action lifecycle integration |
| `autonomous_main_feed.js` | existing canonical main-feed preparation |
| `growth_run.js` | deterministic orchestration protocol |
| `operator_lease.js` | operator exclusivity |
| `operator_readiness.js` | aggregate operational truth |
| `agent_bridge.js` | public machine-facing commands and trusted agent provenance |
| `x_browser_sensor.js` | authenticated X observation contract if a separate module proves necessary |
| `growth_agent_runtime.js` | runtime adapter contract |
| `growth_agent_runner.js` | unattended foreground-run launcher |
| `automation.js` | existing background/API maintenance; no browser mutation |
| `web_api.js` | owner-facing status APIs |
| `ui/` | operational-readiness presentation |

## Implementation Sequence

1. Growth Run contract documentation.
2. Publication-attempt persistence.
3. Reconciliation migration, including queue `20826` recovery.
4. Agent provenance.
5. Operational readiness.
6. Resumable Growth Run.
7. Browser sensor provenance and routine browser-sensor repair.
8. Browser-capable runtime adapter.
9. UI readiness.
10. Scheduled runner.
11. Likes separately later.

## Release Gates

**Gate A — Recovery safe:** attempt source of truth, no replay from ambiguity, queue `20826` safely represented/reconciled or closed unresolved, unrelated operation not frozen indefinitely.

**Gate B — Authority truthful:** agent provenance fixed, route-specific permission visible, delegation revision enforced, readiness dimensions separated.

**Gate C — Foreground autonomous:** begin/resume/finish works, handoff works, lease prevents competing operators, no-action run succeeds, mutation results reconcile.

**Gate D — Browser autonomous:** authenticated FY sensing and exact-source inspection work through the normal browser lane; diagnostic DevTools is not required for routine sensing.

**Gate E — Unattended autonomous:** an installed runtime can be launched unattended, hourly wake uses the same Growth Run contract, overlap coalesces, missed runs do not create catch-up bursts, capability failures are recorded rather than bypassed.

Only after Gate E should XGrowth be described as operationally autonomous. Growth effectiveness remains a separate evidence question measured through later audience and relationship outcomes.

## Definition of Done

From a fresh supported reasoning-agent session, with no dependency on previous chat context, `Continue growing` must be able to load current Growth OS state, validate current route authority, acquire/resume the operator lease and run, isolate uncertain writes, collect useful personalized/live evidence, inspect/verify worthwhile opportunities, choose purpose/behavior/route/depth, prepare through existing writing contracts, claim the exact action, create an immutable attempt, recheck capability and authority, record the send boundary, perform exactly one mutation, verify and reconcile durable truth, continue while worthwhile, and finish with a structured outcome.

The identical protocol must be usable by the unattended hourly runner. There must be no fixed output quota, no points system, no blind replay after an uncertain write, no hidden assumption that heartbeat equals permission, and no requirement that a prior ChatGPT conversation remain alive.
