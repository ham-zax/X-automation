# Luna Reliability Flywheel — Revised Design (Oracle Review R1)

**Status:** Revised after independent architecture review on 2026-10-10; feature branch only, not deployed.
**Baseline:** `5c5e542` on `main`.
**Implementation branch:** `feat/luna-reliability-flywheel` (A1 originally `af6ec50`).
**Integration gate:** Separate independent **implementation** review required before merge; separate permission required for live deployment.

## 1. Decision and evidence

**Design verdict adopted: major redesign of A2–A4; retain and finish A1.** XGrowth already has authoritative delegated Growth Runs, publication claims, social-action ledgers, tab lifecycle, persona, and bounded editorial learning. This project must not create a competing operator or ownership state machine.

A first read-only audit classified **78 nonzero command results across 20 sessions** (31 missing relationship profiles, 12 wrong browser target syntax, 8 incomplete bridge inputs, 8 stale refs, 6 shell quoting errors, 3 SQLite locks, 10 other). The independent Oracle review used a **different** 20-session sample: 2,043 commands, 56 nonzero, 11 target-as-command failures, 19 missing-profile failures and 7 stale-reference failures. **These samples are not controlled before/after measurements.** They show recurring error classes, not model-specific culpability or a causal improvement.

The leading explanation is **unnecessarily free-form command construction across inconsistent interfaces**, plus the strict relationship lookup treating the expected absence of a new account as failure. Correct documentation alone cannot ensure correct shell argument assembly. `degraded` currently means any reported Claive tool failure; it does not differentiate safety, contract errors or useful completion.

## 2. Relationship context: A1 contract

A new X author is **not required** to have a pre-existing relationship. Existing confirmed replies can generate relationship events and materialize their profiles. `relationship-inspect` remains the strict legacy lookup. The new `relationship-context` operation accepts `{"username":" @Example ","limit":20}` and returns:

- Tracked: `{username:"example",tracked:true,status:"tracked",profile:{...},events:[...]}`
- Untracked: `{username:"example",tracked:false,status:"not_tracked",profile:null,events:[]}`

Normalize by **trimming before** removing the optional `@`, then lowercasing. Enforce a valid X handle (1–15 letters, digits or underscores), integer limit 1–200, reject malformed input. `not_tracked` is not an error, not a low score, and not a reason to avoid meaningful engagement.

**Database nuance:** `readRelationshipContext()` uses `getStoredRelationshipProfile` plus the existing event SELECT and does not refresh/materialize relationship data. But importing `store.js` performs schema initialization under `BEGIN IMMEDIATE`, so the **whole CLI is not a read-only SQLite connection and can fail under a concurrent write lock**. This is documented and covered by isolated tests. Do not add a separate database connection or migration architecture solely to obscure this issue; first measure real contention.

## 3. Owners and trust boundaries

```text
Owner policy / growth focus / persona
            |
      Luna judges what/why
       /             \
canonical Growth OS    existing launcher-bound browser observation
bridge and store         (selected transport; typed if safe)
       \             /
      Structured outcomes (additive)
            |
  sanitized deterministic evaluation
            |
 offline proposed fix / small verified lesson
            |
 independent review + explicit promotion
```

- **Growth OS bridge** owns relationship records, Account Health, delegation, duplicate/send fences, `act`, and the Follow/Like/Repost `social-claim → social-start → exact action → social-resolve` ledger.
- **Launcher** (`ops/agent_browser_session.js`) owns the authenticated Chrome browser identity, CDP tab allocation, exact target ID, lifecycle cleanup and resource limits.
- **Browser interface** transports observation / carefully bounded pre-send preparation; it cannot grant publication authority or choose a foreign target.
- **Reasoning model** owns source selection, editorial judgment and public wording; it does not own command escaping, session/tab selection, credential handling or execution policy.
- **Telemetry and learning** observe evidence but have no ability to publish, edit production code, change policy, or approve themselves.

Any new interface must be explicit about whether it is a **convenience** or a **security enforcement boundary**. A helper advertised to Luna is bypassable when the Claive runtime retains unrestricted shell access (`CLAIVE_CODEX_YOLO=1`). Do not claim an enforceable boundary unless actual tool permissions/process isolation enforce it. Growth OS hard gates remain independent.

## 4. Measure first: execution and safety as separate dimensions

Preserve the existing `toolFailures`, `operationalStatus`, Growth Run lifecycle, and publication attempt records. Add **observational** structured events before changing browser transport.

Minimum event record (versioned, sanitized, and attributable to one session/operation):

```json
{
  "schemaVersion": 1,
  "sessionId": "session-id",
  "operationId": "bounded-id",
  "operation": "relationship-context",
  "transport": "bridge-cli",
  "outcome": "completed | rejected | failed | unknown",
  "failureCause": "none | contract_error | stale_reference | database_contention | provider_error | browser_error | unknown",
  "safetyState": "not_applicable | guard_enforced | permitted | violated | unknown",
  "dispatchState": "not_applicable | not_dispatched | confirmed | uncertain",
  "recoveryState": "none | recovered | blocked | unresolved",
  "toolVersion": "version-string"
}
```

Expected `not_tracked` is a successful domain outcome, not an execution exception; a deliberately refused policy violation is `outcome=rejected` with `safetyState=guard_enforced`, even when the agent's attempted action was inappropriate. `uncertain` mutation evidence remains critical regardless of tool exit code. Unknown attribution stays `unknown`; never infer a clean result from missing trace data or convert a refusal into harmless success without evidence.

Two distinct top-level diagnostics:
- **Execution reliability:** valid command rate, preventable contract/grammar errors per 100 relevant calls and per matched run, recovery and cost.
- **Safety/outcome integrity:** wrong-target attempts, guard enforcement, uncertain sends, verified useful actions, quality/conversion trends.

If a source trace cannot be reliably tied to the Growth Run, do not force attribution. Log source and sampling limits. Count raw nonzero commands independently from Claive's `Task failures reported` summary; they may be different populations.

## 5. Browser repair: smallest existing-owner solution

**First evaluate the existing `webharness-mcp` typed `observe/execute` interface** against the *same* existing authenticated browser, current launcher-owned exact CDP target and unchanged publication fencing. If it meets ownership, pre-run and lifecycle requirements, reuse it. Do not invent `operator_tool_contract.js`, a general-purpose gateway or a second lease-file authority just for symmetry.

If typed MCP **cannot** bind the launcher's tab securely, add the smallest trusted **observation-only adapter** adjacent to `ops/agent_browser_session.js`, using fixed `spawn/execFile` argv and the launcher-supplied target identity. Initially support only `snapshot`, `get url`, `get attr`; defer navigation, Escape, clicks and all public or draft-state mutations until separately analyzed. `--pin-tab` is a valueless flag; the actual tab is selected only by a documented exact `tab <targetId>` command under launcher control.

### Pre-run bootstrap sequence (explicitly resolves Oracle F01)

1. Launcher allocates and pins one X browser tab, records browser WebSocket identity and exact target in its trusted session context.
2. A **pre-run bootstrap read** (authentication observation only, no public mutation) uses the session/target without a nonexistent Growth Run ID. It may report unverified authentication; it cannot grant action authority.
3. Once authentication and runtime prerequisites are checked, normal `growth-run-begin` establishes run and lease identity.
4. Run-bound actions must supply the actual run/lease; any browser restart, target disappearance or ownership mismatch fails closed. Bootstrap identity is **not** a valid authorization to publish.

Do not materialize an extra model-readable `0600` lease file and call it authority when the model shares the same Unix user. All ownership claims must be grounded in launcher-controlled state.

Observation is not synonymous with harmlessness: navigation can discard an unsent composer, and Escape can close a draft/dialog. Exclude these from the first typed surface. Do not silently switch transports during an active run or after an uncertain public action.

## 6. Stale references and structured validation

Treat stale DOM refs as invalidation of *observation*, not permission to repeat an action. A stale read may request a fresh snapshot and re-resolve the element. Any click/send/like/follow/repost with uncertain dispatch is governed by existing claim/reconciliation fences; no model-driven blind retry. Contract failures need stable field-specific error messages and a single authoritative CLI grammar reference. Do not copy tool schemas into parallel prompts.

## 7. Modest verified operational learning

**Only after real telemetry and browser fixes are evaluated**, store at most a handful of relevant verified correction notes across sessions (conceptually Reflexion-style episodic memory). A note requires:
- exact tool/contract fingerprint and context;
- reproducible failed input and verified successful comparison;
- counterexample/falsification evidence;
- trusted human/reviewer approval and expiration/retirement rules;
- explicit denial of permission to modify owner policy, execution allowlists, publication paths or persona.

Candidates remain inert. Retire conflicts and version mismatches; never store page text/cookies/auth tokens as instructions. Keep this separate from `learning.js` content-performance learning. Do not claim memory updates model weights.

**RLM** is optional long-context analysis of exceptional trace volumes, not a runtime dependency. **GEPA** and prompt evolution remain offline research until a frozen, representative replay corpus and independently adjudicated holdout scores exist. No dedicated recursive-agent subsystem is warranted now.

## 8. Verification, rollout and rollback

**Phase 0:** finish A1 normalization and tests; document startup-lock limitation and canonical relationship contract. First deployable unit may be A1 only after independent implementation review and owner authorization.

**Phase 1:** additive telemetry over the current operator path; classify a frozen mixed sample without losing or double-counting raw events. No change in live status semantics.

**Phase 2:** compare existing typed MCP; if ownership fails, minimally adapt CLI observation under launcher control. Prove bootstrap, wrong-tab, stale-target, browser restart and no second profile.

**Phase 3:** narrow stale-reference/input feedback and safe read recovery.

**Phase 4:** optional versioned reviewed lessons.

**Phase 5:** optional offline prompt experiments using frozen/holdout trajectories with content-quality and action-coverage balancing measures.

Acceptance targets: zero normal untracked-profile errors; zero ID-as-command construction on evaluated fixtures; no new wrong-target actions or unknown-send retries; under 1 preventable operator error/comparable run as an initial goal; report per-operation exposure, resource/time/cost and useful engagement; no loss of quality or safeguards. A 20-session pilot is exploratory, not evidence of rare-event safety.

Rollback is **one wave at a time**: revert A1 additive command/recipe without deleting relationship records; disable telemetry without altering old `degraded` fields; restore the selected browser interface only at a new clean run boundary; disable lesson injection and revert the pinned prompt version. Never delete or rewrite publication ledgers.

**Review policy:** The Oracle architecture review is input, **not** implementation approval. A separate independent read-only code review must inspect the stable branch with tests, exact SHAs and all blocking issues before merge. Production service remains on `main` until separately authorized.

## Appendix: Oracle findings disposition

| Finding | Resolution / required follow-up |
| --- | --- |
| F01 Bootstrap dependency | Resolved **in design** by launcher-bound pre-run auth read without Run ID; Phase 2 must verify real transport. |
| F02 Gateway bypass | No claim of enforced isolation while broad shell remains exposed; Phase 2 audits actual permissions. |
| F03 Duplicate ownership | Drop separate persisted lease-proof owner; reuse launcher target and browser identity. |
| F04 Telemetry late | Move additive telemetry to Phase 1, ahead of browser interface selection. |
| F05 Unsafe read operations | First typed surface excludes navigation, Escape, clicks and public actions. |
| F06 Handle normalization | Correct `trim → optional @ removal → lowercase`; isolated tests cover whitespace. |
| F07 SQLite startup lock | Document `BEGIN IMMEDIATE` and preserve a deterministic isolated writer-lock check; do not pretend CLI is read-only. |
| F08 Missing tests | Add dedicated isolated `tests/relationship_context.test.mjs` regression tests. |
| F09 Canonical docs | Update `docs/RELATIONSHIP_INTELLIGENCE.md` with command and startup limitation. |
| F10 Inadequate lesson evidence | Require failing fixture, working comparison, falsifier, version, approval and retirement; defer feature. |
| F11 Conflated errors | Add orthogonal outcome / cause / safety / dispatch / recovery fields, preserving raw counters. |
| F12 Overengineering | Cancel generic gateway, contract and lease-proof modules; optional tiny memory after measurements. |
| F13 Whitespace hygiene | Remove Markdown trailing metadata spaces and run `git diff --check`. |

**Limit:** A design resolution is not implementation evidence. F01–F05 and F10–F12 remain subject to future specific verification and independent code review.
