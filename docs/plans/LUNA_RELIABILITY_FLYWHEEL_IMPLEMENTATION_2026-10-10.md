# Luna Reliability Flywheel — Revised Implementation Plan (Oracle R1)

**Goal:** Eliminate avoidable Luna tool errors through existing XGrowth interfaces, truthful diagnostics and minimal, reviewable operational improvement.

**Architecture:** Complete the additive relationship reader; instrument the existing operator before changing its browser path; evaluate existing typed browser MCP against launcher ownership; add a thin observation adapter only if needed; defer operational lessons and recursive prompt experiments until validated by measurements.

**Tech stack:** Node.js 24 ESM, node:sqlite and current `store.js` bridge, Claive session logs, existing Agent Browser CLI/typed WebHarness interface, persistent authenticated ARM Chromium. No new dependency or database schema required by Phase 0.

**Design:** [LUNA_RELIABILITY_FLYWHEEL_DESIGN_2026-10-10.md](LUNA_RELIABILITY_FLYWHEEL_DESIGN_2026-10-10.md)

**Review basis:** Oracle independent architecture report 2026-10-10, findings F01–F13. Major redesign of the former A2–A4 plan adopted; the original generic gateway and lease-proof owner are **cancelled unless later measurements and contract tests justify them**.

## Non-negotiable constraints

- Work in the integration branch `feat/luna-reliability-integration-20261010` and its isolated worktree until review-ready. The owner authorized a **Git-only merge** into `main` before a subsequent independent review; no daemon restart, deployment, production DB change or authenticated X mutation is authorized by that merge.
- Existing Growth OS `act` and social claim/send/resolve ledgers, persona, policy, rest, account health, publication reconciliation and exact tab lease remain authoritative.
- Neither a prompt, a dashboard statistic nor a local adapter grants public-mutation authority. No retry of uncertain sends.
- Instrument before changing browser transport. A before/after claim requires matched command exposure, run duration, safety and content-quality measures.
- Avoid duplicate browser ownership or unproven same-user `0600` authority artifacts. Address the pre-run authentication/bootstrap sequence explicitly.
- Oracle's **architecture** review is not the later independent **implementation** review. Do not merge or deploy without the latter and explicit owner authorization.
- Phase 0 already has the prior regression coverage. For this integration the owner requested **no additional test cases**; existing suites and isolated read-only checks may be reused.

## Exact file ownership and boundaries

| Path | Owns | Planned work |
| --- | --- | --- |
| `store.js` | Relationship persistence/readers; SQLite startup | Phase 0 username normalization + stored SELECT reader; document startup lock, defer DB redesign |
| `agent_bridge.js` | Canonical JSON CLI contract | Phase 0 relationship-context, retain strict inspect |
| `tests/relationship_context.test.mjs` | Isolated contract examples | Phase 0 known/unknown, normalization, invalid input, events, compatibility, lock |
| `docs/RELATIONSHIP_INTELLIGENCE.md` | Canonical relationship contract | Phase 0 new read command + DB lifecycle nuance |
| `docs/GROWTH_CONTEXT_RECOVERY.md` | Resume recipe | Phase 0 normal new author semantics |
| `docs/AGENT_WORKFLOW.md` | Operator command recipes | Phase 0 examples + accurate no-profile/no-write description |
| `AGENTS.md` | Repository operator entrypoints | Phase 0 command reference |
| `growth_agent_runner.js` | Session prompt, result/scheduler status | Phase 0 recipe; Phase 1 additive status/trace metadata; later safe opt-in transport selection |
| `growth_agent_runtime.js` | Scheduler result state (if needed) | Phase 1 only if current result shape cannot carry additive fields |
| `ops/browser_operator_contract.js` | Operator browser documentation | Phase 2 only after owner-bound transport choice |
| `ops/agent_browser_session.js` | Launcher-owned exact target and browser lifecycle | Phase 2 evaluation; minimal adapter only if required |
| `tests/growth_agent_runner.test.mjs` | Existing runtime behavior | Phase 1 additive summary compatibility |
| `docs/plans/*LUNA_RELIABILITY*` | Design, implementation, evidence and review charter | All phases, decisions and post-review integration gate |

No `ops/operator_tool_gateway.js`, `ops/operator_tool_contract.js`, `ops/operational_lessons.js` or recursive trace engine is authorized by this plan *yet*. Add a file only when an implementation milestone proves that no existing owner can fulfill its exact responsibility.

## Phase 0 — Finish A1: relationship context

**Files:** `store.js`, `agent_bridge.js`, `growth_agent_runner.js` (prompt only), `AGENTS.md`, `docs/GROWTH_CONTEXT_RECOVERY.md`, `docs/AGENT_WORKFLOW.md`, `docs/RELATIONSHIP_INTELLIGENCE.md`, `tests/relationship_context.test.mjs`.

**Input:** JSON `{"username":" @Example ","limit":20}`; integer limit 1–200, default 20.

**Output:** `{username,tracked,status,profile,events}`; `not_tracked` exits 0 for an unknown handle and creates no relationship row. Strict `relationship-inspect` is unchanged.

**Tasks:**
- [x] Add `readRelationshipContext` stored-only SELECT reader and bridge command; adapt Luna prompt to prefer it for new authors.
- [x] Fix normalization order to trim whitespace before optional `@` removal and lowercasing.
- [x] Add isolated CLI + direct-reader regressions for unknown and known accounts, preserved event/profile rows, malformed JSON, bad usernames/limits, strict legacy compatibility, and SQLite writer-lock behavior.
- [x] Document distinction between non-mutating SELECT *function* and `store.js`'s startup `BEGIN IMMEDIATE`; do not promise non-contending process-level reads.
- [x] Update canonical `docs/RELATIONSHIP_INTELLIGENCE.md` and remove contradictory "guaranteed read-only CLI" wording.
- [x] Complete focused diff review, JS syntax and `git diff --check`; record verification on the feature branch.

**Evidence:** 5 `node --test tests/relationship_context.test.mjs` tests passed on an isolated temporary database on 2026-10-10, including a 3-second expected writer-lock failure. The existing `tests/growth_agent_runner.test.mjs` suite passed 41/41 after compacting an initially overlong added prompt line; the strict prompt-size invariant was not weakened. Branch A1 initially landed as `af6ec50`; this correction is a subsequent feature-branch change. No production DB or X mutation. Oracle's baseline-only clock-sensitive repost failure should not be misattributed to A1.

**Acceptance:** Unknown account is a normal domain outcome; no lookup-created rows or changed saved event/profile; whitespace around `@handle` works; bad arguments fail; strict API unchanged; startup contention is exposed honestly.

**Rollback:** Revert added command/prompt and normalization fix without deleting or reinterpreting prior relationship events.

## Phase 1 — Observe the existing runtime before adapting tools

**Files:** Primarily `growth_agent_runner.js`, potentially `growth_agent_runtime.js`; reuse existing scheduler result state and Claive event files. Reuse existing runner checks without adding new test cases (owner decision).

**Tasks:**
- [ ] Inventory actual Claive event shapes, session-to-run mapping, output-tail limitations, and existing attempt status; determine which data can be *reliably* attributed.
- [ ] Specify versioned operational event fields: `operationId`, `operation`, `toolVersion`, `outcome`, `failureCause`, `safetyState`, `dispatchState`, `recoveryState` and `source`.
- [ ] Add the smallest additive `executionDiagnostics` result with raw Claive failure count, reliably classified counters, unknown count, attribution limitations and explicit sampling range; preserve `toolFailures` and `operationalStatus`.
- [ ] Do not classify nonzero exit alone as a dangerous failure, or a successful exit as a successful public action; use bridge/attempt evidence for dispatch/safety.
- [ ] Compare the two observational trace samples only as distinct baselines, and define frozen representative mixed-command corpus with exact denominators.
- [ ] Add isolated assertions for zero loss/double counting, missing or ambiguous metadata, multiple Claive turns and old scheduler consumers.

**Acceptance:** Raw counts untouched; an unknown category stays unknown; safety outcomes are distinct from input validity; unchanged production run and attempt semantics; no live X action needed.

**Rollback:** Disable additive diagnostic field; original scheduler and counters continue unchanged.

## Phase 2 — Verify typed browser capability before implementing one

**Files:** `ops/agent_browser_session.js`, `ops/browser_operator_contract.js`, `growth_agent_runner.js`; add only narrow adapter code if this evaluation proves existing MCP inadequate.

**Tasks:**
- [ ] Verify the actual Claive Codex exposed tool surface (not just prompt wording): is typed `webharness-mcp` available and can it bind the launcher's exact page/browser identity?
- [ ] Model bootstrap without a Run ID: launcher allocates tab, pre-run observation verifies auth, then Growth Run begins and mutation becomes eligible. Pre-run observations must not grant run mutation authority.
- [ ] Distinguish convenience from enforceable security: unrestricted shell remains a bypass unless process/tool permissions restrict it. Never represent a prompt-only rule as hard isolation.
- [ ] Audit current launcher `tab`, CDP WebSocket ID, target ownership and exact cleanup; avoid new proof file/state authority unless required.
- [ ] If MCP fails the target contract, implement **only** three trusted read operations (`snapshot`, `get url`, `get attr`) via fixed argv tied to launcher's existing binding.
- [ ] Exclude navigation, keypress/ESC, clicks, composer operations, posts, and social mutations from initial adapter. Do not silently switch transport in a live run.
- [ ] Evaluate malformed target/flag fixtures, foreign tab, browser restart, pre-run bootstrap, stale reference, resource budget and fresh-session rollback against nonpublishing fixtures.

**Acceptance:** Zero target-as-command errors in frozen examples, no wrong-tab observation, no second profile, safe failure on browser restart and clean owned-tab lifecycle. No new mutation pathway.

**Rollback:** Restore previous selected interface only at a new clean-run boundary. Preserve claim ledger and unresolved attempts.

## Phase 3 — Improve stale-reference and input feedback

**Files:** Existing `ops/browser_operator_contract.js`, actual selected browser adapter (if any), and specific bridge validation owners.

**Tasks:**
- [ ] Normalize field-specific validation errors and link to one authoritative command recipe.
- [ ] On an expired element ref, require a fresh observation before new read; do not replay a click or mutation.
- [ ] Distinguish `never_dispatched`, `dispatched_unknown`, and `confirmed` outcomes with existing ledger evidence.

**Acceptance:** Stale read recovers on a new snapshot when possible; wrong-target and uncertain public mutations always fail closed, no quiet retry.

## Phase 4 — Optional small verified operational memory

**Prerequisite:** Phase 1 telemetry and Phase 2 benchmark show a recurring correctable error **not removable through existing typed contracts**.

**Files:** Prefer existing prompt-owner/runner and a small private versioned storage owner only if necessary.

**Tasks:**
- [ ] Define candidate/verified/retired lesson record including original failed input, working comparison, falsifier, tool version, reviewer, expiration and scope.
- [ ] Keep proposed lessons inert until independent validation; inject at most 3–5 small, current, approved rules.
- [ ] Block promotion for contradictory lessons, poisoned web content, expired tool versions, or attempts to override Growth OS.

**Acceptance:** No raw credential/social-message injection; no model self-approval; disabled flag restores exact previous prompt behavior.

## Phase 5 — Optional offline prompt optimization

**Prerequisite:** Frozen replay/holdout corpus has credible safety and useful-action scores.

**Files:** Existing prompt owner and read-only offline analysis scripts when an unserved need is demonstrated.

**Tasks:**
- [ ] Compare candidate prompt variants against baselines and holdout trajectories; track avoidable input error rate per attempted command, time, cost, coverage, content quality, wrong-target attempts and uncertainty.
- [ ] Use simple deterministic grouping first; RLM only for exceptionally long investigations and GEPA only as offline, reviewable proposals.
- [ ] Pin every candidate version and promote only after independent review.

**Acceptance:** Reproducible improvement beyond baseline without safety, time, usefulness or quality regressions. No autonomous production code/policy modification.

## Independent implementation review and integration

**Review target:** A cohesive stable commit range with exact base/HEAD, diff, tests and evidence. **R1 design review already received; this new gate is R2 implementation review by independent person/session.** The reviewer must not edit code.

Mandatory focus: Phase 0 semantics and lock nuance, `store.js` startup, preservation of existing bridge readers, telemetry honesty, pre-run bootstrap and ownership, CLI versus MCP bypass, composer-state safety, stale DOM refs, no new public send path, no unknown-send retry, injected lesson authority and rollback.

A1 alone may be independently reviewed and then separately deployed. Later browser changes must pass their own gate; don't batch all features into one first production release.

**Deployment:** A source-code merge is owner-authorized before the independent follow-up review, but activation, systemd restarts, and browser mode switching remain separate deployment approvals. Do not confuse `main` HEAD with an already restarted long-lived service.

## Progress / integration disposition (2026-10-10)

See [LUNA_RELIABILITY_IMPLEMENTATION_EVIDENCE_2026-10-10.md](LUNA_RELIABILITY_IMPLEMENTATION_EVIDENCE_2026-10-10.md) for the frozen observational sample, code owners, and explicit activation boundaries.

| Wave | Integrated source state | Production activation |
| --- | --- | --- |
| Phase 0 A1 | Complete; merges reviewed A1 semantics into the discovery baseline | Runs in next new process after a separately authorized deployment |
| Phase 1 diagnostics | Implemented, additive versioned trace reading and baseline | Available in next new scheduled runner; no schema migration |
| Phase 2 typed MCP | Existing Codex registration and provider target binding verified in source; exact launcher-owned tab wired | **Opt-in live read-only pilot still required.** CLI remains default |
| Phase 3 stale-ref recovery | Documented fresh observation/target identity and no uncertain-click retry in canonical browser contract | Applies to whichever interface is selected for a fresh run |
| Phase 4 verified lessons | One observed grammar lesson lives in the canonical existing contract; automated lesson promotion not justified | No background learner enabled |
| Phase 5 offline optimization | Baseline recorded; **no-go** for optimizer until matched after-sample/holdout | No RLM, GEPA or autonomous prompt promotion |
| Independent follow-up review | Invited on the merged source, per new owner instruction | Review does not itself restart services |

**Owner supersession:** The 2026-10-10 instruction authorizes merging the integration branch back into remote `main` after stabilization and existing checks, then independent review. This replaces the earlier source-merge prohibition but not the distinct permission required to restart Luna, migrate its database, interact with authenticated X or change the browser interface.
