# Luna reliability integration — evidence and phase decisions (2026-10-10)

**Integration base:** `2f756d8` (production main at start of integration).
**Feature source:** `31476fb` (A1 + telemetry-first design).
**Worktree:** `/home/ubuntu/work/luna_reliability_integration_20261010`.
**Owner priority:** ship a coherent working product without new review-authority services, browser gateways, RLM/GEPA agents, or extra test cases. Git merge authorized; live operator changes are a separate approval.

## Phase 0 — A1 stabilized

Merged the reviewed `relationship-context` command, fixed handle trim/`@` normalization, its existing dedicated test suite, documentation and runner prompt into the discovery-integrated branch. `relationship-inspect` remains strict. `not_tracked` remains normal without lookup-generated relationship rows. `store.js` startup still enters a SQLite write-intent schema transaction; SELECT-only lookup is not a process-level contention guarantee.

## Phase 1 — additive observation implemented

`ops/claive_execution_diagnostics.js` reads only bounded, resolved, non-symlink local Claive `events.jsonl` files identified by the worker's completion output. The operator records **completed** `command_execution` rows once, not both start/end records; it keeps unavailable/partial traces explicit. It publishes only categories, bounded sanitized failed-event metadata and sampling limitations, never shell command strings, X post content or credentials. It does not modify `toolFailures`, `operationalStatus`, the Growth Run contract or the public-action ledger. Counts are not verified safety or public-send outcomes, and traces without reliable Growth Run mapping are not forced into a run.

Provisional offline observation from the 20 most recently modified Claive session logs at the sampling moment: 2,536 completed shell commands, 2,418 zero-exit, 118 nonzero; 44 of 118 remained unclassified; 3 traces lacked a clean terminal turn. Distinct narrow recognizers grouped 52 legacy `relationship-inspect` unknown-profile failures, 12 target-ID-as-CLI-command failures, 7 stale-reference failures and 3 contract errors. This is a *different sampling window* from the previous 56/20 or 78/20 figures. Not all sampled Claive files can be proven to be equivalent Growth Runs; it is not a before/after effectiveness claim. This baseline includes the pre-A1 production runtime and should not be compared causally to post-merge traces without matching relevant operation exposure.

The 20 selected session log identities, in mtime order, are:
`59ecd5db7384, be66c46fcf19, 43e335a29e63, 5e5317b22b25, 8edcd21618a2, fe75e75e9cd5, 75fa4097d454, ba4c285ca72e, 0fadc1db2913, dd7ac11c5255, 42961e28cce3, 7835ff07a9c6, 473c51bcace8, 0bb199c605bf, fd69b74442bc, 2bba3b5c9ba1, d5402c294912, 46e562419458, b70fb6f5df41, 93505b26ee60`.
Ordered content-hash-list digest (SHA-256): `961073fd255a05fc606446e3c0a090a03c6c15a94bf21d65406cbb5c7cb40ce3`.
The private raw logs stay on ARM; do not check raw prompts or command outputs into git.

## Phase 2 — reuse the existing typed MCP, no gateway

`codex mcp list` reports enabled `xgrowth_browser`; its WebHarness V1 Linux `clearcote` configuration targets external CDP port 9222. The provider implementation already supports `observe/execute` with `tab` and an `ensureExternalPinnedSession` path. The existing launcher was extended to allocate/clean up its exact owned CDP tab for either selected browser interface; the MCP instruction passes that tab on **every** typed observation/execution, verifies identity, and prohibits fallback in a live run. This fixes the pre-run Run-ID cycle: the launcher-owned blank tab is observed for authentication first, then the canonical Growth Run begins. No new publisher, browser authority file or public-mutation channel was added. Production `agent-browser-cli` remains the default.

**Remaining rollout check:** a fresh, nonpublishing, isolated browser session must verify MCP active-tab identity, provider restart behavior and cleanup before changing the production environment to `webharness-mcp`. Registration/config/source inspection is not equivalent to a live MCP pilot. Do not automatically change transport mid-run.

## Phase 3 — corrective interaction guidance

The single browser contract now includes the exact `--pin-tab` valueless grammar, `tab <targetId>`, fresh `snapshot -i`, correct `get attr @e1 href` order, and a strict, target-bound MCP observation recipe. An expired ref authorizes a new read/snapshot, **not** a repeated click. No unknown public-send retry, ledger rewrite or new general browser adapter. The Phase 1 recognizers separate confirmed command errors from unknown causes without labeling any command exit as a confirmed send.

## Phase 4 — narrowly scoped lesson, no autonomous learning

One verified, tool-version-specific operational lesson is already embedded in `ops/browser_operator_contract.js`: pinning is a valueless flag; the exact CDP ID belongs in `tab <targetId>` or the typed MCP `tab` property. This corrects an observed repeating failure and relies on an existing deterministic tool contract. No LLM-generated lessons, new operational-memory owner or free-form source-text injection is introduced. Additional lessons remain gated on post-rollout residual errors rather than duplicated as another memory framework.

## Phase 5 — offline evidence gate, no premature optimizer

The historical sample and explicit denominators above establish an inspectable baseline, but **not** a matched post-change replay/holdout evaluation or credible action-quality signal. Accordingly, RLM, GEPA and self-directed prompt changes are **not activated**. The owner-approved simplified decision is to close this phase with a recorded *no-go until matched evidence exists*, rather than pretend an optimizer is beneficial. Future evaluation must compare avoidable errors per comparable command, wrong target and uncertain sends (zero tolerance), meaningful actions and cost before any prompt promotion.

## Merge and activation boundary

Current source integration is additive and backward-compatible. `main` may receive the source after checks under the owner's explicit instruction. Do **not** restart active Luna, modify its database, switch browser mode or dispatch X mutations in this integration task. Subsequent independent review can assess merged code and authorize a separate new-run MCP pilot and production activation. The on-disk service may retain a previously started process until its scheduled run completes.
