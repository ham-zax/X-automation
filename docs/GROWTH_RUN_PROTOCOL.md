# Growth Run Protocol

## Purpose

A Growth Run is the durable orchestration boundary behind **continue growing**. It lets one reasoning-agent session begin work and another session resume it without relying on chat history.

The control loop is:

`Sense -> Select -> Verify -> Prepare -> Claim -> Execute -> Reconcile -> Measure -> Stop/Resume`

The protocol does not replace the queue, drafts, relationship state, editorial planning, writer runtime, publication transport, or operator lease. It coordinates those existing owners.

## Authority boundaries

Five identities remain distinct:

1. **Delegation revision** — the exact persisted owner authority under which consequential work is permitted.
2. **Run ID** — durable orchestration/provenance identity for one bounded operator pass.
3. **Operator lease** — elects the one reasoning operator that may coordinate a run at a time.
4. **Queue/action claim** — reserves one exact public mutation.
5. **Publication attempt ID** — immutable identity for one possible consequential send and its reconciliation history.

A runtime heartbeat or browser capability never grants authority. A claim never proves a send. A send-start record never proves success. Only reconciliation establishes the publication outcome.

## Run lifecycle

Stages:

- `startup`
- `recovery`
- `sensing`
- `selection`
- `preparation`
- `acting`
- `reconciliation`
- `finishing`

Terminal run results:

- `completed`
- `partial`
- `blocked`
- `unresolved`

Structured stop reasons:

- `no_worthwhile_eligible_work`
- `resource_ceiling_reached`
- `delegation_revoked`
- `delegation_revised`
- `capability_unavailable`
- `reconciliation_scope_blocked`
- `budget_exhausted`
- `manual_intervention_required`

Bounds are ceilings, not targets. A run may stop before any public action. A healthy no-action run is valid when no worthwhile eligible opportunity remains.

## Public agent bridge

Begin or resume:

```bash
printf '%s\n' '{"adapterType":"chatgpt_webharness","sessionId":"<session>","capabilities":{"reasoning":true,"browser_read":true,"browser_mutation":true,"x_authenticated":true,"primary_source_web_research":true}}' | npm run agent -- growth-run-begin
```

Read current state:

```bash
printf '%s\n' '{"runId":"<run-id>"}' | npm run agent -- growth-run-status
```

Resume from another agent session:

```bash
printf '%s\n' '{"runId":"<run-id>","adapterType":"<adapter>","sessionId":"<session>","capabilities":{...}}' | npm run agent -- growth-run-resume
```

Ask for the next deterministic operation or invoke one that the current state explicitly permits:

```bash
printf '%s\n' '{"runId":"<run-id>"}' | npm run agent -- growth-run-next
printf '%s\n' '{"runId":"<run-id>","operation":"prepare_main_feed"}' | npm run agent -- growth-run-next
```

Finish:

```bash
printf '%s\n' '{"runId":"<run-id>","status":"completed","stopReason":"no_worthwhile_eligible_work","stopDetail":"No additional worthwhile eligible action remained."}' | npm run agent -- growth-run-finish
```

The run state returns `recommendedOperation` and `permittedOperations`. When it returns `recommendedOperation: "claim_action"`, it may also return a concrete `claim` object naming the lane, command, queue item, run, and session that own the next executable action. The deterministic layer coordinates what may happen next; the reasoning agent still owns opportunity judgment, exact-source inspection, verification, social purpose, route selection, and the decision to remain silent when live evidence invalidates an otherwise eligible action.

Heuristic opportunity scores are advisory evidence, not immutable truth. During an active Growth Run the reasoning operator may call `operator-priority-set` with the current `runId`, `sessionId`, candidate key, a 0-100 score, a concrete reason, and optional structured signals. The run-scoped judgment may raise or lower execution priority based on live momentum, source quality, thread crowding, relationship value, current viral/style context, or Hamza/persona fit. Hard authority, duplicate, account-health, factual, and content-quality gates remain independent. The underlying heuristic score remains visible for comparison and becomes authoritative again when the run ends.

Growth Focus is also evolvable under live delegation. `growth-focus-expand` may extend an existing content group or create a justified `core`/`adjacent` group when the reasoning operator finds a durable developer/builder identity, community, or adjacent-interest term that the static profile is missing. The command requires the active `runId`/`sessionId`, a concrete reason, and explicit terms; it persists a new Growth Focus revision and reclassifies stored candidates. Explicit exclusion terms cannot be promoted. Prefer expansion for durable identity/scope learning, not as a one-off mechanism to force an unrelated post through the gate.

An unattended adapter should verify the existing Windows X session/account before beginning whenever practical. If authentication is established or changes after begin, resume the same run with updated truthful capabilities rather than starting a second run.

## Personalized For You sensing

`x_for_you` is a browser-agent observation source, not a background HTTP pull source.

A canonical observation must include the intended authenticated account handle plus runtime provenance:

```json
{
  "kind": "x_for_you",
  "observedAt": 0,
  "accountHandle": "ham_zax",
  "adapterType": "chatgpt_webharness",
  "sessionId": "<session>",
  "runId": "<run-id>",
  "browserTarget": "windows",
  "browserBackend": "chrome",
  "sensorVersion": "browser_fast_v1",
  "collectionStatus": "complete",
  "posts": []
}
```

The bridge rejects a personalized FY snapshot whose observed account does not match the configured X account. A rejected observation must not replace the last good snapshot.

Collect a bounded, diverse set of organic observations and stop when marginal value falls. The common 25–50 range is a scanning guideline, not a completeness claim or action quota.

## Publication attempt protocol

Every consequential main-feed or Reply mutation must have an attempt.

Attempt states:

`claimed -> send_started -> confirmed_published | confirmed_not_sent | investigating | closed_unresolved`

### Claim

The canonical browser/API claim creates the immutable attempt and duplicate fence for the exact action fingerprint. A claim made inside a Growth Run must include both that `runId` and the current `sessionId`; the bridge requires the run to own the active operator lease and the session to match before it will reserve the action.

When `growth-run-next` names a main-feed `claim`, the browser-capable reasoning agent owns that `browser-publish-claim` even when the background daemon has no X API credentials. Daemon transport readiness and browser-agent transport readiness are separate lanes; an unavailable daemon API is not a reason to abandon a due browser-owned claim.

The fingerprint binds the route, candidate/source identity, target identity when applicable, and exact approved-content hash.

### Send boundary

Immediately before invoking the consequential browser/API mutation, record:

```bash
printf '%s\n' '{"attemptId":"<attempt-id>","runId":"<run-id>","sessionId":"<session>","preSendEvidence":{...}}' | npm run agent -- publication-attempt-send-start
```

This command revalidates the relevant standing authority and Account Health. For a run-bound attempt it also requires the same Growth Run to still own the active operator lease, and the supplied session must match that lease. It does not prove that the mutation succeeded.

### Reconciliation

`confirmed_published` requires positive live/transport evidence and route-specific structure. Browser publication should normally reconcile through `record-action` with the same attempt ID plus structural `publicationVerification`.

`confirmed_not_sent` is valid only when evidence proves the send boundary was not crossed or an authoritative transport rejection proves the operation was not accepted. Failure to find a post on X is not proof of not-sent.

`investigating` means useful reconciliation remains available.

`closed_unresolved` preserves an unknown outcome after the useful recovery path is exhausted. The exact action remains permanently duplicate-fenced; unrelated future work is not frozen indefinitely. For main-feed cadence, a closed unresolved send is conservatively treated as a possible publication at its send time.

Never blindly retry an ambiguous write.

## Operational readiness

Use:

```bash
printf '%s\n' '{}' | npm run agent -- operator-readiness
```

Read these dimensions independently:

- persisted permission/delegation;
- attached reasoning runtime and operator lease;
- personalized/live sensor freshness and provenance;
- browser/API mutation capability;
- active and historical reconciliation state;
- unattended scheduler/runtime state.

`AUTO_POST=true` means only that automatic publication is requested when a compliant transport exists. It is not proof that X API credentials or an authenticated browser-agent runtime are available.

A heartbeat proves recent runtime attachment only. Consequential authority and capability are rechecked at claim/send time.

## Unattended runner

`growth_agent_runner.js` launches the configured reasoning runtime and tells it to use this exact protocol rather than inventing a parallel loop.

Default runtime: OpenCode. Override with:

- `X_GROWTH_AGENT_RUNTIME=opencode|codex`
- `X_GROWTH_AGENT_MODEL=<provider/model>`
- `X_GROWTH_OPENCODE_BIN=<path>`
- `X_GROWTH_CODEX_BIN=<path>`

The systemd timer wakes the runner roughly hourly. Overlapping invocations coalesce through the existing operator lease. Missed invocations do not create catch-up bursts.

The background `automation.js` service remains separate and must not automate browser/X mutation surfaces. It may continue source refresh, measurement, preparation, and compliant official-X-API work.

## Likes

Likes are intentionally outside the dependable-autonomy contract until they have their own delegation, claim, attempt, verification, reconciliation, and outcome semantics. Do not perform invisible Likes outside Growth OS truth.
