# Luna Reliability Flywheel Implementation Plan

**Goal:** Reduce avoidable Luna tool failures by fixing normal relationship absence, introducing validated read-only tool execution, and adding evidence-grounded operational feedback without weakening Growth OS public-mutation safeguards.

**Architecture:** Deliver bounded work in dependency order: (A1) read-only relationship context; (A2) a typed observation gateway bound to the launcher's existing browser lease; (A3) categorized telemetry and inert verified lessons; (A4) offline RLM-style trace analysis and GEPA-style prompt evaluation. Keep existing canonical publication `act` and social mutation ledgers as the sole public-action owners. Do not enable A2–A4 in production until independent review.

**Tech stack:** Node.js 24 ES modules, `node:sqlite`/SQLite WAL via `store.js`, Claive Codex gpt-6-luna, Agent Browser CLI 0.38.2, authenticated Chromium CDP 9222, systemd --user. No new runtime dependency by default.

**Design:** [LUNA_RELIABILITY_FLYWHEEL_DESIGN_2026-10-10.md](LUNA_RELIABILITY_FLYWHEEL_DESIGN_2026-10-10.md)

## Global constraints

- Work in isolated branch `feat/luna-reliability-flywheel` at `/home/ubuntu/work/luna_reliability_flywheel`; production checkout `/home/ubuntu/repo/x_test` remains untouched until review.
- No live X sends, Follow/Like/Repost, altered daemon/timer, database migrations, browser resets, or use of browser credentials during implementation.
- `act`, publication target fences, the social-action claim ledger, persona/owner authority, account health, rest windows and exact target leases remain authoritative. Never retry an unknown send.
- Do not change other worktrees/branches or `webharness` by accident. Keep commits coherent and preserve reviewer independence.
- `relationship-inspect` remains backward compatible; the new `relationship-context` is additive and read-only.
- Third-party review (R1, possible R2) blocks merge/deploy. This planning pass does not launch an independent reviewer or claim that one has already approved the work.
- The baseline 78 failures in 20 sessions is descriptive; comparisons must account for tool mix, run length, guard refusals, and user-visible quality.
- Use existing/native utilities; avoid new dependencies and data migration until design ownership proves they are necessary.

## Repository file map

| File | Owner responsibility | Planned change |
| --- | --- | --- |
| `agent_bridge.js` | Canonical stdin-JSON bridge | Add `relationship-context`; do not alter strict legacy lookup |
| `store.js` | Relationship/SQLite read owner | Add `readRelationshipContext` using the stored-only reader and `listRelationshipEvents`; no audience refresh or schema change |
| `docs/GROWTH_CONTEXT_RECOVERY.md` | Compaction continuity | Define tracked vs untracked lookup sequence |
| `docs/AGENT_WORKFLOW.md` | Bridge command recipe | Document typed response and ordinary absence |
| `AGENTS.md` | Repository operator contract | Add new read-only command to declared list |
| `ops/browser_operator_contract.js` | Browser instructions | Describe gateway-mode commands and legacy fallback, only after gateway exists |
| `ops/agent_browser_session.js` | Exact launcher-owned Chrome target lifecycle | Add strictly bounded lease metadata publication and cleanup under review |
| `ops/operator_tool_contract.js` (new) | Stateless operation allowlist and schema | Parse/validate versioned read-only tool requests |
| `ops/operator_tool_gateway.js` (new) | Deterministic argv/bridge invocation | Execute only validated read-only operations and redact result metadata |
| `growth_agent_runner.js` | Launcher/session, prompt and run summary | Feature-flag mode, provision verified lease context, additive diagnostics |
| `ops/operational_failure_taxonomy.js` (new) | Structured failure categories | Normalize observed tool results without hiding raw failures |
| `ops/operational_lessons.js` (new) | Safe episodic operational memory | Keep candidate lessons inert, require verified promotion, version expiry |
| `ops/operational_trace_review.js` (new) | Offline trace summarizer | Redact, index and recursively query large prior sessions, no X access |
| `docs/plans/LUNA_RELIABILITY_FLYWHEEL_DESIGN_2026-10-10.md` | Architecture and risks | Design baseline |
| `docs/plans/LUNA_RELIABILITY_FLYWHEEL_IMPLEMENTATION_2026-10-10.md` | Execution and handoff | This plan |
| `docs/plans/LUNA_RELIABILITY_REVIEW_HANDOFF_2026-10-10.md` (new when stable) | Independent Agent R charter | Scope, checklist, immutable commits, blockers, rollout gate |

## A1 — Read-only relationship context (start now)

**Files:** Modify `store.js`, `agent_bridge.js`, `growth_agent_runner.js` (prompt only), `docs/GROWTH_CONTEXT_RECOVERY.md`, `docs/AGENT_WORKFLOW.md`, `AGENTS.md`.

**Consumes:** a new `readRelationshipContext()` in `store.js`, implemented via the existing non-refreshing stored-row reader and `listRelationshipEvents(username,{limit})`. Incoming stdin JSON with `username` and optional integer `limit` (1..200, default 20).

**Produces:** New `npm run --silent agent -- relationship-context` response:
- `{username,tracked:true,status:"tracked",profile,events}` for an existing profile.
- `{username,tracked:false,status:"not_tracked",profile:null,events:[]}` when none exists.
- Invalid username/limit/JSON: existing stderr JSON error and nonzero CLI exit; *not* a misleading success.

**Steps:**
- [x] Add a stored-snapshot reader in `store.js` that does not call the audience-refresher; insert the bridge command near `relationship-inspect`, no writes.
- [x] Update the runner prompt and operational contracts to recommend `relationship-context` before engaging an unseen account; keep strict inspect if caller truly expects a pre-existing profile.
- [x] Inspect changed diff for any accidental public/send/relationship record mutation.

**Acceptance:** Known account returns recorded history; unknown account exits 0 with explicit `not_tracked`; no profile/event created by a lookup; strict legacy command remains unchanged; invalid request still rejects. This milestone can be reviewed alone but must not be merged until R1 if grouped with later work.

## A2 — Typed tool gateway: contract before transport

### A2.1 Operation schema

**Files:** Create `ops/operator_tool_contract.js`, `ops/operator_tool_gateway.js`; add an explicit CLI entry in `package.json` only if needed by the operational contract.

**Consumes:** `{v:1,operation,runId,sessionId,args}` with allowlisted operations `relationship.context`, `browser.snapshot`, `browser.current_url`, `browser.navigate`, `browser.element_attribute`; later support `browser.scroll` only with a documented safe schema.

**Produces:** `{ok:true,operation,result}` or `{ok:false,error:{code,message,retryable:false},operation}`. Unknown operation and malformed arguments cannot reach an executable.

**Steps:**
- [ ] Define size limits, exact string bounds, allowed domains, URL parsing, run/session identity checks, selector/ref restrictions, and stable error codes.
- [ ] Reject mutation-like operations (`click`, `post`, `press` when ambiguous, `social*`, local-file navigation and arbitrary paths) rather than converting them into CLI calls.
- [ ] Use `spawn/execFile` with argv arrays and bounded outputs; never `shell:true`, interpolate model input into bash, or silently fallback to another browser.

**Acceptance:** A random input string cannot select a command or execute arbitrary shell. Invalid operations return precise schema errors. No new public mutation path is created.

### A2.2 Exact tab identity

**Files:** Modify `ops/agent_browser_session.js`, `growth_agent_runner.js` and `ops/operator_tool_gateway.js`.

**Consumes:** Real launcher-owned `targetId`, unique session, actual Growth Run identity, browser WebSocket ID and current CDP target list.

**Produces:** Short-lived 0600 private lease record and on-demand target validation for gateway calls.

**Steps:**
- [ ] Write ephemeral lease metadata atomically under a per-run private state directory; record exact owner and browser identity only.
- [ ] Before every browser operation, confirm the registered owner, the active Growth Run/lease, current Chrome identity and exact target ID.
- [ ] Select only the allocated tab using the installed CLI grammar; construct `--pin-tab` as a valueless flag. Never construct a command as `--pin-tab <targetId>`.
- [ ] Clean up the private lease record on all ordinary and exceptional run exits, without closing shared pages or Chrome.
- [ ] Keep feature flag `X_GROWTH_TYPED_TOOL_GATEWAY=off` default until independent review.

**Acceptance:** Wrong session/target/browser identity and stale lease always fail closed. One owned tab remains one owned tab through observation and cleanup; no takeover of another session, no mutation or new browser.

### A2.3 Prompt and migration

**Files:** Modify `ops/browser_operator_contract.js`, `growth_agent_runner.js`, `docs/GROWTH_AGENT_EXECUTION.md`.

**Steps:**
- [ ] Provide gateway recipe only when the new feature flag is explicitly active and a valid lease exists. Otherwise preserve the current Agent Browser CLI path.
- [ ] Make the model responsible for intent and source judgment, not target ID insertion or shell quoting.
- [ ] Keep current publishing `act` and social click mechanism unchanged; do not claim those lanes have migrated to typed gateway.
- [ ] Record mode/version in the run summary to distinguish baseline from experimental sessions.

**Acceptance:** Disabled flag generates identical legacy behavior. Enabled mode allows only bounded observation on one owned target. No undocumented mid-run transport switch.

## A3 — Failure observability and verified operational memory

### A3.1 Failure taxonomy

**Files:** Create `ops/operational_failure_taxonomy.js`, modify `growth_agent_runner.js`; optional UI consumer only if contract is stabilized.

**Consumes:** Raw Claive `Task failures reported: N`, structured gateway outcome, limited sanitized session/tool trace metadata.

**Produces:** Additive `failureSummary:{rawToolFailures,categories,unknownCount,sourceVersion}`; preserve `toolFailures` and `operationalStatus` initially.

**Steps:**
- [ ] Classify documented `not_tracked` as normal result, policy guard as policy outcome, genuine bad argument/syntax as contract error, stale refs as browser_reference, SQLite Busy as contention and unresolved sends as safety incidents.
- [ ] Preserve unknown/unparsed result counts; never call a run clean by dropping failures.
- [ ] Aggregate from actual structured events when available; fall back to `unknown`, not guessed categories, for legacy Claive output.

**Acceptance:** Raw counts never decrease because of relabeling; a policy refusal is distinguishable from infra degradation; uncertain sends remain top-severity.

### A3.2 Episodic operational lessons

**Files:** Create `ops/operational_lessons.js` and extend runner injection only after reviewing read boundaries.

**Consumes:** Sanitized trace references and verified review outcomes.

**Produces:** Private versioned file with `candidate / verified / retired` lessons; bounded 3–5-item model context retrieval.

**Steps:**
- [ ] Use atomic writes, ownership-safe permissions, TTL and tool-version match; never store tokens, cookies or raw X conversations in the lesson.
- [ ] Make all generated lessons inert candidates; require an explicit independent verification record before marking `verified`.
- [ ] Reject lessons attempting to override policy, allowlists, persona or publishing authority.
- [ ] Make retrieval skip retired/expired/version-mismatched lessons.

**Acceptance:** An unverified or malicious candidate cannot modify runner instructions or public-action permissions.

## A4 — Offline recursive review and prompt evolution

**Files:** Create `ops/operational_trace_review.js`; add review configuration and manifest under `docs/plans/` or a private offline analysis workspace, not automatic live state.

**Consumes:** Redacted historical Claive trace fragments and tool contract versions, with holdout samples.

**Produces:** Read-only category report, source-bound candidate lesson, evidence manifest and proposed prompt diff.

**Steps:**
- [ ] Partition long logs by session/operation and retrieve bounded fragments; recursively review conflicting evidence rather than putting full raw transcripts into one context.
- [ ] Use Reflexion-style episodic explanation only as candidate data; compare with healthy examples and look for falsifiers.
- [ ] Apply GEPA-style prompt candidate evaluation offline, measuring both command validity and safety. Reject variants that worsen substantive output, increase unsupported source use or relax exact-target controls.
- [ ] Keep algorithm/adaptation research separate from runtime model weights, owner persona and actual production approval.

**Acceptance:** No reviewer/evaluator process has publication credentials; proposed prompt variants cannot promote themselves to `main`.

## R1 — Independent third-party review (explicitly blocks integration)

**File:** Create `docs/plans/LUNA_RELIABILITY_REVIEW_HANDOFF_2026-10-10.md` once a coherent A1+A2+A3 candidate is committed.

**Reviewer:** A **new independent Agent R** chat/session or third-party engineer with read-only clone of the implementation branch, base SHA, reproducible evidence and diff. Not the implementer.

**Required coverage:** All proposed API schemas, backwards compatibility, external user/content prompt-injection risk, no alternate X send path, no server-wide tab cleanup, CDP ownership identity, file permission and lease expiry, category reporting honesty, non-deployment, rollback, and whether the design fulfills the user request. Report every material blocking finding, with a file/line and reproduction argument. Reviewer must not make repairs.

**Discharge:** R1 declares no blocking findings; if findings exist, repair in the implementation lane and send the same Agent R session an R2 for all corrections + directly related effects. Only then prepare merge/deploy; obtain explicit authorization for production enablement.

## Wave and progress snapshot

| Wave | Dependency | Implementation owner | Status |
| --- | --- | --- | --- |
| A1 Relationship context | existing store reader | current implementation session | IMPLEMENTED IN FEATURE BRANCH; awaiting R1 |
| A2 Typed read-only gateway | A1 API and lease contract | implementation session | NOT STARTED |
| A3 Error categorization/memory | stable typed outputs | implementation session | NOT STARTED |
| A4 Offline RLM/GEPA | sanitized telemetry | later bounded mission | NOT STARTED |
| R1 independent review | stable A1+A2+A3 candidate | independent Agent R | BLOCKED |
| Main merge/deployment | R1/R2 signoff + owner approval | operator | BLOCKED |

A1 manual smoke evidence (isolated temporary SQLite database): unknown account returned `not_tracked` with exit 0; known account returned saved event/profile; invalid handle was rejected; the strict legacy lookup still failed for a missing profile; one temporary seeded event/profile remained exactly one after reads. Node syntax checks and `git diff --check` passed. No automated tests or live X mutations are commissioned solely by this plan. Review criteria above are observable contract checks; additional test creation/execution may be authorized separately or required by repository policy.

## Suggested R1 handoff prompt

> Independently review `feat/luna-reliability-flywheel` against `5c5e542` using both dated plan documents and `AGENTS.md`. Be read-only. Focus on bypasses of Growth OS public-action authority, browser target ownership, input schema/escaping, relationship absence semantics, truthful diagnostics, operational-memory poisoning and rollback. Inspect all material affected files. Return prioritized blocker findings with evidence and exact file/line, then residual risks and whether merger into main is safe. Do not edit code or deploy.
