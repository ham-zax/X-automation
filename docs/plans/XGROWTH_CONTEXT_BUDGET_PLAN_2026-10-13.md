# XGrowth context-budget plan (Stage 1)

Date: 2026-10-13. Base: `origin/main` `ab312d0`. Branch: `fix/context-budget` (worktree, WSL only).
Status: plan; nothing here is deployed. No ARM service, timer, database, browser or X action is part of this plan.

## Intent

The attached ARM operator spent 283.6M input tokens over 20 sessions (2,187 model calls). 83% of that input was paid by calls made after the conversation had already passed 100k tokens, which happened by call 9–27 of each session. The context was filled by two things before any growth work started: reading about ten contract documents, and bridge reads that return far more than the decision needs.

This stage removes the second cause at its owner and versions the launcher so the first cause can be fixed under review. It does not change what the agent may do, how anything is published, or any gate.

Why a durable plan: the change alters the default response contract of four bridge commands that prompts, docs and a human operator all use.

## Root cause summary

Confirmed (measured from Claive event logs and local payloads):

- Production runs `claive run … --reasoning-effort max --turn-timeout 28800` from an unversioned drop-in (`attached-live.conf` → `arm-growth-live.sh`), bypassing `growth_agent_runner.js` and the bounded `semantic_controller.js`.
- `agent_bridge.js` `result()` pretty-prints every response with two-space indent: 21–65% of the bytes are whitespace.
- `account-health` returns the full `getAccountHealthSummary()` object. `saturation.targets` is 47% of it locally (34 targets) and was ~1 MB on ARM (385 targets).
- `queue` returns `drafts[].editor` (up to 24 KB each) and `queueItems[].engagement` (avg 6.5 KB each).
- `operator-status` embeds the full persona model (11.7 KB) and `readiness.accountHealth` + `readiness.sensors` (8 KB), duplicating its own `accountHealth` key.
- `publication-attempts` defaults to 100 full rows, including every terminal attempt.
- The launcher prompt names `webharness-mcp` as the interface and also tells the agent to use the `wh-browser fast` shell CLI; `ops/browser_operator_contract.js` forbids that combination.

Plausible, not proven:

- `x_browser.js:6` hardcodes `/usr/bin/google-chrome`, which does not exist on ARM, and may explain the 31-day-stale GitHub Trending / HN snapshots.

Open (not investigated; out of scope here):

- The two uncertain sends (`c8a99266…`, `1e363f31…`). They are not retried or touched.
- Writer review pipeline for draft 191; slow `agent-browser-l` shutdown; cost of `x-test-watch.timer`.

## Trace results that shape the design

- `getAccountHealthSummary()` has 45 call sites in 15 modules (`web_api.js`, `dashboard.js`, `semantic_controller.js`, `editorial.js`, `autonomous_reply.js`, …). `dashboard.js:144` and `editorial_runtime.js:268` read `saturation.targets` / `saturation.distribution`. **The store shape must not change.** Compaction belongs only at the bridge response boundary.
- The dashboard reads the store through `web_api.js`, never through the bridge. No test asserts the shape of `account-health`, `operator-status`, `queue` or `publication-attempts`.
- `engage-next` already has an opt-in `compact` flag (`engagementRead`, `compactEngagementPacket`). It is left as it is.
- Claive's codex engine rejects `--max-model-steps` (`growth_agent_runner.js:414`). A model-step cap for the attached agent is therefore not available from this repository; the enforceable limits are turn timeout and reasoning effort.

## Architecture

One owner: `agent_bridge.js`. Two changes there:

1. `result()` writes single-line JSON when stdout is not a TTY and keeps the indented form on a terminal.
2. `account-health`, `operator-status`, `queue` and `publication-attempts` return a compact projection by default. `{"detail": true}` returns exactly today's object.

Every compact response carries `"compact": true` and `"detailHint"` naming the flag, so an agent that needs evidence knows how to ask and nothing is silently lost.

Tech stack: Node ESM, `node --test`, no new dependency.

## Compatibility boundary

- Unchanged: `store.js`, `health.js`, `web_api.js`, `dashboard.js`, every gate, claim, fence and publication path, `engage-next`, and all other bridge commands' payloads (only their whitespace changes when piped).
- Changed: default payload of four read-only commands. Previous payload available with `detail: true`.
- Safety-relevant fields that stay in the compact form: `health.state`, every `health.reasons[]` entry with `level`, `code` and `message`; every publication attempt that is not in a terminal state, in full; `approvedText`, `approvalSnapshot`, `approvalAuthority`, `status` and identifiers of queue items; `integrityWarnings`, `laneChampions`, `execution` and `growthOperator` of `operator-status`.
- Retirement: none. `detail: true` is the permanent evidence path, not a compatibility shim.

## Compact projections

`account-health` (default):
`generatedAt`, `health` (`state`, `reasons`, `advisory`, `explanation`, `details`; `provenance` omitted), `latestObservation`, `interactionCounts`, `interactionYield`, `networkQuality`, `saturation: { distribution, topTargets: top 5 targets as { username, pressure, band } }`, `repetition` without per-reply lists if any exceed 1 KB, `compact`, `detailHint`. Omitted: `saturation.targets`, `observations`, `recentReplies`, `evidence`, `latestUnderTheHood`, `health.provenance`.

`operator-status` (default): unchanged except
`persona` → `{ id, version, dailyTone }` (whichever of these exist) plus `personaHint: "persona-model"`;
`readiness` → same object without `accountHealth` and `sensors`, plus `sensorsOmitted: true`.

`queue` (default): each draft without `editor`; each queue item without `engagement`, replaced by `engagementKind`/`engagePriority` when present on the item. Both lists gain nothing else.

`publication-attempts` (default, only when the caller passed no `state`, `queueItemId` or `runId` filter): all attempts whose state is not one of `confirmed_published`, `confirmed_not_sent`, `closed_unresolved`, in full, plus the 10 most recent terminal attempts, plus `counts` by state and `omittedTerminal`. With any filter or `detail: true`: today's behaviour.

## TDD route

Mode `auto`, decision `strict`. Authority: response-contract change on a shared CLI. Posture: one new test file, written first, failing at base. AGENTS.md asks for no unrequested tests; this single file is the handoff's required measurable acceptance evidence and is the worker's executable check.

## Tasks

### Task 1 — failing contract test
File: `tests/bridge_compact_output.test.mjs` (new).
Spawn `agent_bridge.js` in a temporary working directory, the way `tests/relationship_context.test.mjs` does. Assert:
- piped stdout of `account-health` is one line of valid JSON;
- default `account-health` has `compact === true`, a string `detailHint`, `health.state`, an array `health.reasons`, no `saturation.targets`, no `observations`, no `recentReplies`;
- `account-health` with `{"detail":true}` has array `saturation.targets` and no `compact` key;
- default `operator-status` has no `readiness.sensors`, no `readiness.accountHealth`, has `integrityWarnings` and `laneChampions`; with `detail` it has `readiness.sensors`;
- default `queue` returns `drafts` and `queueItems` arrays; with a seeded draft, the default item has no `editor` and the `detail` item has it (seed through the bridge the way existing tests do; if seeding costs more than ~40 lines, assert the array shape only and say so in the report);
- default `publication-attempts` has `counts` and `omittedTerminal`; with `{"state":"confirmed_published"}` it has neither.
Proof: `node --test tests/bridge_compact_output.test.mjs` fails at base.

### Task 2 — compact bridge output
File: `agent_bridge.js` only.
- `result()`: `JSON.stringify(value, null, process.stdout.isTTY ? 2 : 0)`.
- Add small local projection functions next to `compactEngagementPacket` and call them from the four handlers when `payload.detail !== true`.
Proof: the Task 1 test passes; `npm test` shows no new failure against the base run.

### Task 3 — size evidence (parent, not worker)
Against a copy of the local WSL database in the worktree, record piped byte counts before/after for the four commands. Acceptance: `account-health` ≤ 12 KB (base 125 KB), `operator-status` ≤ 22 KB (base 51 KB), `queue {limit:20}` ≤ 80 KB (base 462 KB), `publication-attempts` ≤ 40 KB (base 158 KB); `detail: true` output deep-equals the base output for `account-health` and `queue` at a fixed `now`.

### Task 4 — docs
Files: `AGENTS.md` (one sentence after the command list), `docs/AGENT_WORKFLOW.md` line ~260, `README.md` lines ~183–186. State that these four reads are compact by default and `detail: true` returns full evidence.

### Task 5 — version the ARM launcher (parent; owner decision required before merge)
Files: `ops/systemd/arm/attached-live.conf`, `ops/systemd/arm/arm-growth-live.sh`, `ops/systemd/arm/arm-growth-live.md`, `ops/systemd/README.md`.
Copy the three production files read-only from ARM into the repo unchanged in one commit, then propose in a second commit: `--reasoning-effort high`, `--turn-timeout 2700`, the document-reading list replaced by a short brief, and one browser interface. Which interface is the owner's decision: the handoff forbids switching browser transports without explicit authorization. Not deployed by this plan.

### Not in this branch
The Chrome path in `x_browser.js` (cause unproven; needs a read-only check of the refresh job on ARM first). Stage 2 (controller → `act`, or the Pi Durable spike).

## Verification

- Task 1 test fails at base and passes after Task 2.
- `npm test` compared with the base run: same set of failures, if any.
- Task 3 byte table.
- Final diff read in full by the parent; only `agent_bridge.js`, the new test and the three doc files change in Tasks 1–4.

## Expected effect and its limits

Bridge output measured in the traces was ~40 MB of 67.7 MB shell output. The four commands were ~19.4 MB of that; whitespace removal applies to all bridge output. This lowers how fast context fills; it does not by itself stop a 100-call session from re-reading a large context. The launcher change (Task 5) and Stage 2 address that. The real before/after token comparison needs one authorized production session and is not claimed here.

## Deployment and rollback

Deploy (owner-authorized only): merge the branch, `git pull` on ARM. No migration, no service restart needed for the bridge change because each bridge call is a fresh process. Rollback: `git revert` the bridge commit; `detail: true` callers are unaffected either way.

## Risks

- An agent habit of `| rg '"state"'` on indented output finds the whole single line instead. `jq` use is unaffected.
- A prompt that relied on the persona block inside `operator-status` must call `persona-model`. The `personaHint` key says so.
- Compact `publication-attempts` hides older terminal attempts by default; `counts` and `omittedTerminal` make that visible.

## Execution route

Subagent-driven through Claive: one reusable Claude Haiku 5.5 worker, effort `xhigh`, in the worktree, one task per turn (Task 1, then Task 2, then Task 4). Parent runs Task 3, reviews every diff and owns Task 5. User confirmation required: no for Tasks 1–4; yes for Task 5's interface choice, for push, and for anything on ARM.
