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

## Scout → act loop

Delegated runs may use a shorter loop for one action at a time. It follows the same run, lease, and attempt rules as the rest of this protocol.

```bash
printf '%s\n' '{"limit":10}' | npm run agent -- scout
printf '%s\n' '{"action":"reply","text":"<text>","targetTweetId":"<id>","candidateKey":"<key>","runId":"<run-id>","sessionId":"<session>"}' | npm run agent -- act
```

`scout` is read-only and opportunity-led. Its `pace` fields describe observed publication counts and recent main-feed activity; these are not action limits, daily targets, or timing gates. Its `cards` are: T0 mentions first, a T2 original-writing idea independent of reply/quote opportunities, then up to one read batch of ranked T1 source conversations. Every T1 card has `eligibleActions: ["reply", "quote"]`: Luna checks the full post/context and chooses a purposeful direct Reply, a genuinely additive Quote for its own audience, or a skip. Measured reach, relevance, momentum, tier and age are **priority evidence**, not minimum thresholds or account categories. The page size controls how many cards are read at once; it does not cap how many distinct worthwhile replies can be published across re-reads/runs.

Before drafting a reply/quote, the agent may call the read-only
`act-target-status` command with `{"targetTweetId":"<source tweet ID>",
"candidateKey":"<saved key if any>"}`. `eligibleForAttempt=false` means
an existing target attempt or terminal queue state must not be re-sent. An
eligible preflight is advisory, never an authorization: the atomic `act` claim
and every existing duplicate, lease, delegation, and Account Health fence still
control the public mutation.

`act` performs one send for the text the agent wrote for a card. It validates the input, checks the run lease when a `runId` is supplied, runs attribution and near-copy checks against the card source, checks the duplicate fence, and atomically claims the exact action. That claim checks Account Health and the live delegation grant. Only then does `act` record `send_started` at the browser click, send through the x.com intent URL, and confirm the result from the CreateTweet response or the post toast.

The outcomes are `confirmed_published`, `confirmed_not_sent`, or `closed_unresolved`. A confirmed send records the candidate action and relationship event inside `act`. A `closed_unresolved` result is never retried; the exact action stays duplicate-fenced.

No numerical original/quote/reply quota or fixed 30/90-minute spacing is imposed by `scout`, `act`, or the main-feed scheduler. Separate content merits, current source/context, active delegation, run resource/time ceilings and atomic duplicate fencing decide what can proceed. The bounded run mutation ceiling is for lease/recovery safety, **not** an account posting cadence: a subsequent run may consider additional worthwhile distinct sources.

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
printf '%s\n' '{"attemptId":"<attempt-id>","preSendEvidence":{...}}' | npm run agent -- publication-attempt-send-start
```

This command revalidates the relevant standing authority and Account Health. For a run-bound attempt it derives immutable run/session provenance from the claim and requires that same Growth Run/session to still own the active operator lease. Callers do not repeat stored IDs. It does not prove that the mutation succeeded.

For Browser Fast Reply execution, take one final fresh read-only snapshot after `send-start`, resolve the currently enabled semantic Reply control from that snapshot, and invoke that mutation exactly once. This ordering only reduces stale-ref exposure; it does not create retry authority or change reconciliation semantics.

### Reconciliation

`confirmed_published` requires positive live/transport evidence and route-specific structure. Browser publication should normally reconcile through `record-action` with the same attempt ID plus structural `publicationVerification`. The `act` command reconciles internally (see the scout → act loop) and does not need a separate `record-action` call.

`confirmed_not_sent` is retry authority, so it requires definitive evidence that the mutation was never dispatched or that the transport rejected it before acceptance. The bridge records that proof explicitly as `evidence.notSentProof.kind = mutation_not_dispatched | transport_rejected`. Composer persistence, a missing toast, or failure to find a post on X—even after a short wait—are not proof of not-sent.

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

A heartbeat proves recent runtime attachment only. Growth Run begin/resume/next and run-bound claim/send activity maintain liveness automatically for the operator-lease lifetime; the reasoning model does not schedule heartbeat housekeeping. Consequential authority and capability are still rechecked at claim/send time.

## Unattended runner

`growth_agent_runner.js` launches the configured reasoning runtime and tells it to use this exact protocol rather than inventing a parallel loop.

Default runtime: OpenCode. Override with:

- `X_GROWTH_AGENT_RUNTIME=opencode|codex|claude|pi|claive`
- `X_GROWTH_AGENT_MODEL=<provider/model>`
- `X_GROWTH_OPENCODE_BIN=<path>`
- `X_GROWTH_CODEX_BIN=<path>`
- `X_GROWTH_CLAIVE_BIN=<path>` (defaults to `~/.local/bin/claive`)

The `claive` adapter launches tracked model turns within each bounded pass.
`X_GROWTH_CLAIVE_ENGINE=muse|pi|codex` selects the engine (default Muse). Muse uses
`muse-spark-1.3-contributor`, `xhigh` reasoning, and its filesystem/network sandbox.
Pi uses only `opencode2api`, `max` reasoning, and inherits its current global
model when `X_GROWTH_AGENT_MODEL` is empty. Pi has no OS sandbox; the operational
prompt restricts it to Growth OS bridge operations and the browser lane.
Codex is locked to `gpt-6-luna` at `max` reasoning with web search and runs with
`CLAIVE_CODEX_YOLO=1` (no Codex sandbox; the prompt is the only guard), as on ARM.
No engine automatically switches provider/model. The temporary prompt is removed
on success or failure. Workers operate through the same Growth Run bridge and
authenticated browser lane; Claive never grants publication authority. Inspect
workers with `claive list` / `claive show ID` and scheduler readiness with
`operator-readiness`.

If Pi exits normally while its durable run is active, the launcher may continue
up to four total model turns within the original deadline, retaining the same
Pi history, bridge session, Growth Run and exact claim authority. It checks the
current delegation before each continuation. A send-started or investigating
attempt restricts the follow-up to reconciliation; it never authorizes another
send. Provider failures stop immediately. Exhausting the turn/deadline limit
closes the run as partial through the canonical finish path.

Other runtimes may start one fresh continuation only when the unfinished run
created no publication attempt. That continuation has a new session/run and
must obtain its own claim. Neither path switches provider or model, bypasses
bridge gates, or restores authority to a closed attempt.

Windows agents run `node ops/windows-dialog-recovery.mjs --dismiss` before
initial observation and when navigation stalls. This native UI Automation
fallback cancels only an exact “Leave site?” dialog in the WebHarness Chrome
profile and verifies its absence; omit `--dismiss` for inspection only. It never
clicks Leave or a publication button. Re-observe afterward, and reconcile any
already-started publication without retrying it. A successful page snapshot
alone does not establish that a native dialog is gone.

To use Claive with the existing user timer, install
`ops/systemd/x-test-growth-agent-claive.conf` as
`~/.config/systemd/user/x-test-growth-agent.service.d/claive.conf`, reload the
user systemd manager, then enable `x-test-growth-agent.timer`. Verify the runtime
and authenticated account before enabling recurring runs. The supplied drop-in
selects Pi with its existing model. Stop recurring work
with `systemctl --user disable --now x-test-growth-agent.timer`; also stop
`x-test-growth-agent.service` to end an in-flight worker.

The systemd timer wakes the runner roughly every 15 minutes. Overlapping invocations coalesce through the existing operator lease. Missed invocations do not create catch-up bursts.

The background `automation.js` service remains separate and must not automate browser/X mutation surfaces. It may continue source refresh, measurement, preparation, and compliant official-X-API work.

## Likes

Likes are intentionally outside the dependable-autonomy contract until they have their own delegation, claim, attempt, verification, reconciliation, and outcome semantics. Do not perform invisible Likes outside Growth OS truth.
