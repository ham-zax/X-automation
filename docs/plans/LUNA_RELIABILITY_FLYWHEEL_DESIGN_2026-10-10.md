# Luna Reliability Flywheel — Design Specification

**Status:** Proposed architecture; not enabled in production.  
**Date:** 2026-10-10 (Asia/Kolkata)  
**Baseline:** XGrowth `5c5e542`; persistent authenticated ARM Chrome CDP 9222; Claive Codex gpt-6-luna.  
**Review requirement:** Independent Agent R review of a stable implementation candidate **before** merging to `main` or enabling a new execution transport.

## 1. Problem, evidence, and non-goals

Luna is successfully publishing but often reports `degraded` because the runner marks any nonzero Claive tool-failure count as degraded. A read-only audit of 20 recent sessions found 78 nonzero command results: 31 relationship profiles absent at lookup time, 12 Chrome target IDs accidentally used as commands, 8 bridge-schema/input errors, 8 stale browser refs, 6 shell quoting failures, 3 SQLite locks, and 10 other causes. This is an observational baseline, **not** a controlled performance benchmark. All 22 examined sessions retrieved the Agent Browser core skill at least once.

Crucially, three traced missing-profile lookups preceded successful replies that *created* the corresponding relationship records. An existing relationship profile is not a prerequisite for engaging a new X account. The existing `relationship-inspect` contract incorrectly makes normal absence a failed CLI command.

Goals:
1. Make read-only relationship discovery tolerate not-yet-tracked people.
2. Gradually remove free-form shell/JSON/browser grammar from Luna's critical execution path.
3. Keep raw failures visible while distinguishing policy blocks, absence, operator errors, browser errors, and infrastructure errors.
4. Capture bounded, evidence-checked operational lessons across Claive sessions.
5. Analyze historical traces recursively and evaluate prompt revisions **offline**, without access to public X mutation.
6. Keep the live account, owner preferences, server-owned browser tabs and publication claims safe throughout rollout.

Non-goals: fine-tuning Luna, silently switching browser providers, forcing quotas, editing owner personality, weakening sleep/quality fences, clearing Chrome, reviving `automation.js`, auto-approving code or prompts, or auto-sending after uncertain outcomes.

## 2. Existing authority and proposed trust boundaries

```text
User policy / persona / growth delegation
              |
         Luna decision maker -- chooses intent, source, text, skip
              |
    strict gateway (typed request + preflight)
         /                     \
read-only relationship       browser observation/preparation
context / ordinary bridge    bound to ONE launcher-owned CDP tab
         \                     /
       existing Growth OS bridge claims and ledger
              |
    ONLY canonical act/send reconciliation
              |
        public X mutation (exactly once)
```

**Safety:** the gateway never grants a new mutation privilege. Publishing remains the current `act` authority; Follow/Like/Repost remain behind `social-status → claim → start → exact browser action → resolve`. Unknown dispatch is never retryable. The gateway can initially support read-only operations only; adding a social click or any public send is a separate review-gated contract, not a minor enum extension. Chrome CDP is the *existing* authenticated browser; never spawn another browser/profile. The launcher and exact CDP target ownership remain authoritative.

Untrusted inputs: page/DOM/X text, model-generated JSON, generated reflections, trace excerpts, AI reviewer feedback, and suggested new prompts. Treat these as data, never instructions. No scraped social text may change delegated authority or tool allowlists.

## 3. Relationship context (first deliverable)

Implement `npm run --silent agent -- relationship-context`, consuming stdin:

```json
{"username":"@example","limit":20}
```

Response when tracked:
```json
{"username":"example","tracked":true,"profile":{ "...": "existing profile object" },"events":[],"status":"tracked"}
```

Response when unknown:
```json
{"username":"example","tracked":false,"profile":null,"events":[],"status":"not_tracked"}
```

Normalize account names using the same algorithm as existing store readers (trim, strip leading @, lowercase). **Do not call `getRelationshipProfile()`**: it can persist a refreshed audience-derived profile. Add a dedicated snapshot reader in `store.js` that uses the existing private stored-row reader and event query only. Explicitly reject empty/invalid usernames, out-of-range numeric limits and malformed JSON as invalid requests (do not conceal programming mistakes). Keep `relationship-inspect` behavior unchanged for compatibility. An unknown profile is neither a low TargetScore nor a reason to skip a worthwhile observed conversation; record a relationship event through current owner code only after a confirmed action or verified real interaction. This lookup must be pure read-only and may not fabricate a profile, make a network request, or send.

Update `docs/GROWTH_CONTEXT_RECOVERY.md`, `docs/AGENT_WORKFLOW.md` and active operator prompt to use the new read-only command for people encountered on X. The old inspect command remains documented as an optional strict lookup for already-known profiles.

## 4. Typed tool boundary (second deliverable)

Introduce a narrow `ops/operator_tool_gateway.js`, invoked via a declared `operator-tool` command/subprocess with one JSON object, never an arbitrary shell command string. The interface should provide:
- `v:1`, `operation` from a finite allowlist, `runId`, `sessionId`, `args`.
- Deterministic validation with field-specific machine-readable `error.code` and `retryable` flags. No generated `eval`, templated shell, arbitrary subprocess executable, raw local path, JavaScript injection, or undocumented command alias.
- `relationship.context` as a read-only pass-through to the canonical bridge owner.
- Browser observation operations initially: `browser.snapshot`, `browser.navigate` (only https X pages and approved read-only sources), `browser.current_url`, `browser.element_attribute` (fresh ref), `browser.scroll` and `browser.press` only where no consequential mutation or draft loss could occur. Do **not** enable button clicking, posting, approving or publishing through this gateway in the first migration.
- Idempotent request logging with truncated/redacted arguments, stable categories and sanitized outcomes; no cookies, auth headers, DMs, raw token-bearing URLs or entire message bodies.
- Fail closed for stale ownership, unknown operation, invalid run/session, CDP identity change, tab mismatch or ambiguous effect. Do not silently open a new tab, reconnect another profile, retry an uncertain browser mutation, or change transport.

Ownership: the launcher currently creates a tab lease in `ops/agent_browser_session.js`. In a later approved milestone, serialize a minimal short-lived lease proof (`sessionId`, `runId`, exact target ID, CDP browser identity, issue/expiry) under private runtime state mode 0600; verify against the live run/lease, current CDP identity and target before *each* gateway browser operation. The model must not choose the target ID. The gateway constructs a fixed argv array, including `--cdp`, `--session`, `--pin-tab`, then selects the **owned** target with the documented `tab <targetId>` command, never treating a target ID as the command after the flag. The gateway must not close unowned pages or terminate persistent Chrome.

Migration remains OFF by default until an independent review; legacy CLI continues in production in the meantime.

## 5. Error taxonomy and reporting (third deliverable)

Add a stable, non-destructive `ops/operational_failure_taxonomy.js` classifier. Preserve raw Claive `Task failures reported: N` and existing growth run status; add `failureSummary` with category counts and evidence/sampling reference. Categories:

| Category | Example | Meaning |
| --- | --- | --- |
| `expected_absence` | relationship `not_tracked` | Normal read-only outcome; not a failed command |
| `policy_blocked` | rest-hours guard | Correct safety response; not infra degradation |
| `contract_error` | missing key, bad JSON, shell quoting | Operator or interface defect |
| `browser_reference` | stale ref after navigation | Recover with fresh observation, no blind retry |
| `browser_ownership` | unknown tab/session | Stop/fail closed; potential safety issue |
| `database_contention` | SQLITE_BUSY | Infrastructure failure requiring trace evidence |
| `provider_error` | runtime child 429/5xx | Infrastructure/service issue |
| `uncertain_mutation` | public send outcome unknown | Safety-critical regardless of other counts |

Do not simply subtract errors from `toolFailures` or relabel a run as clean to improve metrics. Initially report raw and categorized diagnostics alongside old `operationalStatus` unchanged. Change the dashboard's semantic health field only after reviewers agree on exact severity rules and data migration. `completed` and `budget_exhausted` remain independent from health.

## 6. Durable operational memory (fourth deliverable)

Use a separate `ops/operational_lessons.js` owner and versioned bounded JSON file in `~/.local/state/x_test/` (NOT in user-facing persona memories or content-learning `learning.js`).

Lesson schema: `id`, `errorCode`, `toolVersion`, `scenario`, `rootCause`, `verifiedCorrection`, `evidenceRefs`, `confidence`, `createdAt`, `expiresAt`, `status` (`candidate|verified|retired`) and `reviewer`. A lesson may be injected only when `status=verified` and tool version/context match; cap injected lessons (e.g. 3-5 small rules) and never interpret a lesson as policy authority. Candidates remain inert until approved by a separate trusted process.

No automated modification of code, systemd, deployment, privileged settings, browser safety, delegation, owner voice, or acceptance gates. Version bumps, contradictory evidence and tool contract changes retire stale lessons.

## 7. Offline recursive trace review / prompt evolution (fifth deliverable)

The term RLM here means recursively decomposing **long context** into bounded evidence queries/subcalls; it is not automatic model-weight training. Reflexion-style episodic memory adds linguistic learning from verified feedback; GEPA-style evolution proposes prompt variants and evaluates them on traces.

Offline review process:
1. Load redacted, immutable tool events from existing Claive traces using cursor/range selectors rather than stuffing them into one prompt.
2. Group failures and successes by exact operation, version and causal category; sample both counterexamples and clean trajectories.
3. For each proposed root cause, require at least one observed failed input, the executable contract, a working comparison and a falsification attempt.
4. Produce *candidate* lessons and/or prompt diffs, never mutate production.
5. Evaluate variants on a frozen replay corpus with a holdout set and invariants for publication/lease safety; reject metric gaming.
6. Send a stable candidate to an independent read-only reviewer. The reviewer cannot author the code being reviewed.
7. After explicit approval, promote a signed/versioned prompt or verified lesson and monitor; revert if performance or safety worsens.

Research grounding: Recursive Language Models (arXiv:2512.24601), Reflexion (arXiv:2303.11366), and GEPA (arXiv:2507.19457).

## 8. Reviewable staged rollout

- **A1** — relationship-context + documentation only. No change to live browser/prod schema, no publication mutation.
- **A2** — typed read-only gateway and explicit ownership binding, disabled by default. Require reviewer agreement on target ownership and process lifetime before enabling.
- **A3** — categorized telemetry, inert lessons and offline replay; keep safety authority unchanged.
- **R1** — independent reviewer examines A1+A2+A3 cohesive candidate and reports all blocking issues. Remediate then R2.
- **Deployment** — only after approval: enable read-only gateway for one controlled operator, compare to baseline, retain rollback flag, then consider broader adoption. No mutation gateway until a separate security review.

Rollback must be configuration-only: disable the new gateway/lesson injection; retain exact publication ledgers and historical events. Do not delete or rewrite existing relationship profiles.

## 9. Success criteria, risks, and reviewers

Baseline diagnostic: 78 nonzero results / 20 sessions (3.9 per session), not a controlled experiment. Proposed acceptance window: at least 20 comparable completed sessions, fewer than 1 avoidable operator input error/session, zero ID-as-command errors, zero normal missing-profile lookup errors, no increase in uncertain sends, no unauthorized public mutations or wrong-target browser actions, and no account-content quality deterioration. Keep time-to-action, provider cost, valid source coverage and meaningful engagements as balancing metrics.

Reviewer must scrutinize: trust boundary between Claive shell and gateway, live lease identity binding, what `--pin-tab` actually protects, subprocess lifecycle cleanup, whether "not tracked" can accidentally be interpreted as "blocked", whether categorization hides errors, safe data retention/redaction, relation to `AGENTS.md` and current Growth OS owner policy, and whether rollback preserves sent-attempt state.

**Integration gate:** an independent R1 review with no blocking findings (and R2 if repaired) is required before merge to `main`; separate explicit production rollout permission is required before enabling a new runtime path.
