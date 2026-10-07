# ARM Pi AI Runtime & Autonomous Editorial Recovery Implementation Plan

**Goal:** Make Pi a first-class x_test AI runtime and remove the ARM blockers that prevent autonomous main-feed preparation from completing.

**Architecture:** Keep x_test's existing provider-independent `runStructuredAI()` boundary. Add a Pi CLI adapter behind `ai_cli.js`, using Pi's sessionless JSON event stream with tools/context discovery disabled and local schema validation/repair in x_test. Separately shrink editorial inference packets before model dispatch so role execution remains within provider context and per-request safety limits.

**Tech Stack:** Node.js ES modules, Pi 1.0 JSON mode, SQLite, React/TypeScript AI Settings, systemd user services.

## Global Constraints

- Pi is a runtime/harness; the underlying model remains a profile choice.
- No second operator and no destructive reset of production DB state.
- Product AI Pi calls are sessionless, tool-less, context-file-less, extension-less, skill-less, MCP-less, and offline except for the configured model provider.
- Preserve existing Codex, OpenCode and AGY behavior.
- Do not bind live ARM roles until the selected Pi profiles pass connection + structured invocation probes.
- Do not make the live Growth Run depend on source files being edited underneath it; deploy role/config changes for subsequent passes.

### Task 1: Add Pi as a first-class runtime

**Files:**
- Modify: `store.js`
- Modify: `ai_cli.js`
- Modify: `web_api.js`
- Modify: `ui/src/api/client.ts`
- Modify: `ui/src/features/settings/AISettings.tsx`

**Interfaces:**
- Consumes: existing AI profile/runtime contracts and Pi JSON event stream.
- Produces: runtime `pi`, Pi model catalog, availability/connection checks, validated structured execution.

**Steps:**
- Add `pi` to persisted/API/UI runtime enums.
- Discover Pi via the installed binary, report structured capability as `compatible_fallback`.
- Read Pi's configured opencode2api model catalog without exposing API keys.
- Execute Pi with no tools, no MCP/extensions/skills/context files, no session, JSON mode, explicit provider/model/thinking.
- Parse the settled final assistant message and usage metadata.
- Allow schema-repair only for adapters that report non-native structured output.

**Acceptance criteria:**
- Pi appears beside Codex/OpenCode/AGY in AI Settings.
- ARM reports Pi installed and available.
- A Pi profile can return a locally schema-valid object through `runStructuredAI()`.

### Task 2: Make Pi/runtime failures recoverable

**Files:**
- Modify: `growth_agent_runner.js`
- Modify: `ops/claive/xwatch-goal.md`
- Modify: `ops/claive/xwatch-queue.sh`

**Interfaces:**
- Consumes: a reasoning child that exits after a Growth Run has begun.
- Produces: a canonical terminal Growth Run with `result.runtimeFailure`, a released operator lease, and a watchdog-visible provider failure.

**Steps:**
- If the reasoning child fails after beginning a Growth Run, finish that run as `partial/capability_unavailable` through `finishGrowthRun()` rather than leaving an active run/lease orphan.
- Persist runtime/model/error metadata on that terminal run.
- Teach the watchdog that a `capability_unavailable` run carrying `runtimeFailure` is a provider/runtime failure rather than an X-side blocker.
- Keep the watchdog's own rotating models inside Claive's allowed model policy.

**Acceptance criteria:**
- A malformed provider stream or runtime crash cannot wedge later timer passes behind `operator_lease_active`.
- The watchdog can switch the operator model after repeated provider/runtime failures.
- The watchdog itself does not schedule a Claive-disallowed model.

### Task 3: Bound editorial context before inference

**Files:**
- Modify: `editorial.js` and/or `editorial_runtime.js`

**Interfaces:**
- Consumes: full durable editorial context.
- Produces: compact inference packet retaining current candidates, active conversations, bounded recent performance/outcomes, health summary, and algorithm evidence.

**Steps:**
- Keep the full context persisted for observability if useful, but send a deliberately bounded projection to the model.
- Cap historical measurement/outcome arrays and remove duplicated/heavy fields not needed for the scan decision.
- Record inference-packet byte size in AI metadata.

**Acceptance criteria:**
- Editorial scan prompt is far below the current ~926 KB durable context payload and below Pi model context/per-request limits.
- Durable workflow data remains intact.

### Task 4: Keep AI request limits proportional and diagnosable

**Files:**
- Modify: `ai_policy.js`
- Modify callers only where needed.

**Interfaces:**
- Consumes: prompt/output reservation sizes.
- Produces: bounded concurrency and clear per-request size failures without a daily usage quota.

**Steps:**
- Keep cross-process concurrency and per-request input/output/response ceilings.
- Remove daily request/token quota enforcement entirely.
- Surface request-envelope/inference-packet size in safe metadata/logging without source content.

**Acceptance criteria:**
- Normal editorial + writer calls are not blocked by a daily application quota.
- Oversized calls fail before provider dispatch with an actionable per-request input-limit reason.

### Task 5: Deploy safe ARM Pi profiles and role bindings

**Files/config:**
- ARM x_test AI profiles/role bindings.
- ARM systemd/environment only if required by the chosen runtime path.
- Update `docs/ARM_24X7_HANDOFF.md`.

**Steps:**
- Prefer Pi runtime profiles on ARM so credentials/provider URL stay in Pi's own configuration.
- Select a long-context model for editorial scan/final and a suitable model for writer/audience review.
- Probe availability, catalog, connection and one structured call before rebinding.
- Rebind roles atomically only after probes succeed; preserve a rollback snapshot.

**Acceptance criteria:**
- `prepare_main_feed` completes its AI stages instead of `capability_unavailable`.
- Subsequent Growth Runs can autonomously prepare/review main-feed work through governed lanes.

## Implementation status — 2026-10-07

- Pi runtime adapter implemented and isolated + production profile probes passed.
- Production roles and the global default now use `ARM Pi exo-free` as primary/default with `ARM Pi big-pickle` as fallback. Exo's production profile test completed in ~3.84 s. Rollback snapshots: `~/work/scratch/x-test-ai-role-migration-2026-10-07T02-55-00-241Z.json` and `~/work/scratch/x-test-ai-role-migration-exo-default-2026-10-07T02-59-14-959Z.json`.
- The previously orphaned Growth Run 40 was recovered through the canonical finish path after confirming it had zero publication attempts.
- Editorial model packets are projected from the full durable context into a bounded inference view; only safe size metadata is recorded. A real 926,413-byte persisted context replay succeeded through Pi/Exo with a 135,987-byte inference packet / 152,425-byte request envelope, returned 8 stories and used no fallback.
- Application-level daily AI request/token budgeting has been removed. The runtime keeps only per-request input/output/response limits, deadlines and cross-process concurrency control; runtime availability is checked before a concurrency slot is reserved.
- Nemotron and Ling are hard-rejected by x_test profile validation and Growth Operator config; Claive already rejects them. Watchdog live files were refreshed and rotate only through mimo-v2.6-flash-free, big-pickle and space-bunny-free.
- Full x_test suite passes 91/91 and the production UI builds. Post-repair publication evidence includes a confirmed repost, four confirmed replies and one confirmed original; after removal of the daily AI quota, active run 61 immediately resumed successful Exo writer calls.
