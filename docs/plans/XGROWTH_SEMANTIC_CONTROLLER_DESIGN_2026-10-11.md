# XGrowth: persistent controller, bounded semantic jobs, and System One evaluation

Date: 2026-10-11

Status: local design and implementation record, updated 2026-10-12. The controller is the ordinary runner default, with `executor` retained as an alias and `legacy` blocked. Live collection, public execution, deployment, production configuration changes, restarting the Growth Agent or timer, and publication to X remain outside this scope. Existing repository policy and publication contracts remain authoritative. This document includes the controller plan and optional TypeSafe/System One assessment, with Hamza's constraints on ranking and job scope incorporated.

## Part I: persistent controller and finite Luna jobs

### Problem and recommended direction

How can XGrowth discover worthwhile conversations and maintain strategic consistency while invoking intelligence only when new evidence warrants a decision?

Build XGrowth around a persistent controller that assigns finite semantic jobs to Luna. The controller owns observation, state transitions, execution, and stopping. Luna owns opportunity judgment, writing, and occasional strategic reconsideration.

The important change is the assignment: **“Decide what this new evidence warrants” replaces “operate X for twenty minutes.”**

The target is purposeful growth for Hamza's developer/builder account. Success means relevant opportunities reach a durable outcome, unchanged evidence does not cause repeated reasoning, and strategic conclusions survive independent executions. Activity volume and elapsed session time do not establish value.

### Workflow

```text
Deterministic wake
    |
    v
Collect due, bounded observations
    |
    v
Detect changes and establish advisory priorities
    |
    v
Semantic work needed? -- No --> Persist reason and exit
    |
   Yes
    |
    v
Admit a finite semantic job within its budget
    |
    v
Luna: bounded judgment and, where appropriate, writing
    |
    v
Persist decision, evidence, and revisit condition
    |
    v
Existing Growth OS gates, execution, and reconciliation
    |
    v
Persist terminal outcome and exit
```

#### 1. Every five-minute wake checks for work

The controller reads current policy, delegation, health, unfinished attempts, due observations, and queued work. It exits when nothing needs attention.

A wake does not automatically launch Claive, open a reasoning conversation, or require another discovery pass. Existing deterministic work can proceed within its authority without a semantic call. Unresolved publication attempts retain their recovery priority and fences.

#### 2. Observation produces data, not a conversation

Bounded collectors extract exact posts, authors, parent context, URLs, and visible metrics. They persist observations and identify:

- New conversations.
- Meaningful changes to existing conversations.
- New primary-source evidence.
- Measured acceleration.
- Responses from people we have engaged with.

Repeated observations remain useful for measurement, but unchanged information does not trigger another judgment. Observation timestamps and small metric fluctuations must not automatically invalidate a decision. Material changes and evidence provenance remain inspectable.

This is a proposed collector contract. Current live-X operation requires an attached reasoning-agent Growth Run. Deterministic live collection needs an explicitly reviewed attached-runtime contract before activation; this document does not authorize an unattended browser daemon.

#### 3. Rank cheaply while preserving semantic exploration

Reuse the deterministic scout for duplicate removal, change identification, existing objective exclusions, and advisory ordering. Prioritize active conversations, audience relevance, relationship context, novelty, and observed momentum.

Deterministic ranking must not quietly become a closed topic whitelist or a high-engagement-account filter. Unfamiliar technical topics remain eligible. Cold relationship state, small account size, and a lack of a technical wrinkle are not sufficient reasons to discard a purposeful opportunity. Support, humor, judgment, amplification, and silence remain legitimate outcomes.

Keep an explicit, bounded exploration path for candidates outside familiar rankings. Record why candidates were omitted or deferred so that blind spots can be audited. Soft scores establish priorities; existing objective authority and safety rules own hard exclusions.

Give Luna a genuinely small shortlist with enough context to answer:

> Which opportunity deserves Hamza's participation, what role should he take, and what contribution would make that participation worthwhile?

Its structured result includes the selected action, purpose, rationale, draft or missing evidence, and revisit condition. Routine selection and reply writing can share one invocation when the job fits its contract. A large shortlist, lengthy relationship histories, several primary documents, or complex drafting requirements must be reduced or split into finite jobs. Originals and Threads retain the existing Writer and independent review process.

#### 4. Remember decisions explicitly

Persist each judgment against the relevant source, conversation, persona, policy, and strategy versions. For example:

```text
Decision: defer
Reason: capability is interesting, but compatibility claim is unverified
Reconsider when: primary documentation establishes supported platforms
```

The next execution reads that record rather than rediscovering the uncertainty. Invalidate it only when relevant inputs change or its explicit revisit condition is met.

Build the strategic snapshot from existing persona, owner policy, accepted learning, relationship commitments, and qualified outcomes. New hypotheses remain distinguishable from accepted conclusions, with supporting evidence and reconsideration conditions. Producing another summary does not grant the model authority to rewrite Hamza's strategy.

A higher-level strategy job runs when qualified outcomes, owner direction, relationship developments, or new evidence challenge an existing conclusion. Routine wakes do not require strategic reconsideration.

#### 5. Execute through existing authoritative paths

Once a decision is ready, the executor uses existing claims, exact-target checks, approval requirements, send-start, verification, and reconciliation. Publication authority stays with Growth OS.

Preserve authentication checks, the configured browser interface, active run/session lease, exact approval snapshots, independent Writer review where required, and exact-target browser cleanup. Social mutations retain their separate ledger. No new model result grants approval or bypasses a gate.

Re-observe the exact target immediately before a consequential send, record send-start against the immutable attempt ID, execute once, verify the exact output structure, and reconcile the same attempt. An uncertain send remains fenced. Failure to find an output is not proof that it was never sent.

Unexpected states stop the execution task. A diagnostic job receives the specific failure evidence and has no publication authority. Restarting a worker or changing a model cannot clear an uncertain-send fence.

#### 6. Stop through state

Every task ends with a concrete result: completed, skipped, deferred, waiting for evidence, blocked, or unresolved. Deferred work needs a specific revisit condition. Silence is a successful decision when no worthwhile action is supported.

An unchanged failure cannot launch another repair. A justified repair retains the same parent task and a persistent attempt counter. Usage limits survive restarts. Remaining session time creates no obligation to keep working.

### Semantic job budget: a first-class contract

Each job declares one decision or deliverable, allowed operations, permitted side effects, required input versions, and terminal outcomes before any model invocation. The contract is enforced by the controller and runtime, not merely described in a prompt.

| Contract boundary | Required behavior |
| --- | --- |
| Candidate count and context size | Finite limits on candidates, thread context, relationship records, evidence documents, serialized bytes, and estimated input tokens. |
| Model work | Finite model-call, output-token, reasoning-token where supported, and wall-time limits. Unsupported provider limits must be explicit; a timeout is not a verified token cap. |
| Tool and browser work | An allowlist and finite operation/observation limits. Judgment jobs have no mutation authority. |
| Repairs and escalation | Persistent counters shared by the parent task, a specific reason, and changed evidence or a changed hypothesis. No unchanged-input retry loop. |
| Durable accounting | Task/run/session identity, reservations, actual usage, outcome, and unfinished work survive process termination and restarts. |
| Overflow or exhaustion | Reject, reduce, split, defer, or stop with an explicit reason. Never silently enlarge the job or start a fresh session to reset its budget. |

Thresholds are configuration to validate on frozen conversations, not claims that a particular shortlist size or token allowance is already proven. Jobs involving selection, evidence verification, writing, review, and diagnostics may need different limits. Splitting work retains relevant evidence and decision identities without replaying the parent conversation.

Measure actual input, cached input, output, reasoning tokens when reported, model calls, tool calls, repairs, and durable outcomes together. Cached input is included in input; avoid double counting provider usage events or treating cumulative usage as current context size. Unknown usage must remain unknown and visible. This proposal makes no cost projections.

### Smallest useful implementation, after review

| Owner | Proposed change |
| --- | --- |
| [`growth_agent_runner.js`](../../growth_agent_runner.js) | Replace the open-ended operational assignment with deterministic admission, budget enforcement, and bounded job dispatch. |
| [`scout.js`](../../scout.js) | Surface changed, unevaluated opportunities; suppress unchanged decisions; preserve advisory ordering and exploration. |
| [`store.js`](../../store.js) | Persist task contracts, compact decisions, input versions, revisit conditions, progress, and cumulative budget accounting. |
| [`growth_run.js`](../../growth_run.js) | Fix cumulative observation accounting and enforce termination independently of prompt instructions. |
| [`ai_runtime.js`](../../ai_runtime.js) / [`ai_cli.js`](../../ai_cli.js) | Reuse isolated structured execution; enforce supported job limits and capture actual usage for every attempt. |

Keep the controller model-independent. Claive to Codex/Pi remains an interchangeable execution path behind a bounded task interface; choosing Pi does not change job scope, authority, or termination semantics.

First validate admission, decision reuse, budget exhaustion, and restart recovery against cached observations. Then validate bounded Luna jobs on frozen conversations. Live collectors and executors require review of the attached-runtime contract and separate deployment authorization. Existing publication owners remain in place throughout migration.

### Assumptions and acceptance checks

- Bounded conversation context preserves Luna's judgment and Hamza's voice: compare against human-reviewed frozen conversations.
- Change detection captures meaningful developments without retriggering on metric noise: test unchanged observations, noisy counters, new replies, and new evidence.
- Extraction preserves sufficient context: include misleading standalone posts and threads whose parent changes the meaning.
- Explicit strategic records improve consistency without entrenching weak beliefs: test evidence that contradicts a prior conclusion.
- Advisory ranking preserves unexpected opportunities: include unfamiliar technical topics, small accounts, and purposeful non-informational interactions.
- A semantic job is genuinely finite: test oversized inputs, call/tool limits, interruption, repair exhaustion, and process restart without budget reset.
- Publication recovery preserves existing guarantees: uncertain attempts cannot be resent, and exact-target cleanup never closes unrelated tabs.

The first proof is straightforward: already-judged unchanged candidates are not repeatedly re-evaluated, so the same observations produce no repeated reasoning; a worthwhile new conversation produces a finite job that reaches a durable outcome. An unchanged observation batch can still legitimately contain other unselected or unfinished candidates that require a different finite job — selecting A does not imply B was rejected or completed. These are proposed acceptance conditions, not measured improvements.

### Not doing in the first version

- Changing Luna as a substitute for architecture work.
- Autonomous prompt evolution or recursive agent teams.
- New infrastructure or unnecessary frameworks.
- Wholesale publication rewrites or new mutation authority.
- Forced action counts, rigid familiar-topic filtering, or compulsory ongoing reasoning.
- Live rollout before diagnosis and design review.

The optional System One evaluation below is a separate experiment, not a dependency of the first controller version.

## Part II: can TypeSafe/System One help?

### Assessment

Yes: Jev is a plausible bounded semantic judge before Luna gets involved. Whether it improves XGrowth remains unverified.

TypeSafe documents Choice, Score, and Noul primitives that evaluate supplied state and return structured decisions and probabilities. Independent questions can share one request. Jev does not write replies or generate reasoning explanations. [Introduction](https://docs.typesafe.ai/introduction), [System One](https://docs.typesafe.ai/concepts/system-one)

The architectural fit is narrow semantic evaluation inside software whose code owns control flow. Adding Jev as another repeatedly called tool in the current long agent loop would leave the central amplification mechanism intact. TypeSafe's own guidance puts control flow and side effects in code. [How to build with TypeSafe](https://docs.typesafe.ai/concepts/how-to-build-with-system-one)

### Responsibility split

| Component | Responsibility |
| --- | --- |
| Deterministic controller | Collect observations, remove exact duplicates, identify changes, enforce budgets, persist decisions, and stop. |
| Optional Jev evaluator | Classify and rank remaining observations using narrow semantic questions. |
| Luna | Judge the contribution worth making, draft content, resolve difficult ambiguity, and reconsider strategy when justified. |
| Existing Growth OS | Enforce authorization, claim exact targets, execute once, verify, and reconcile. |

Candidate Jev questions include:

- How relevant is this conversation to the configured technical audience?
- Does this message directly respond to something Hamza said?
- Does this observation add a claim absent from the previous observation?
- Is the supplied context sufficient to understand the question?

Keep questions atomic and define explicit unknown/insufficient-context outcomes where appropriate. “What should Hamza contribute here?” still combines purpose, relationships, voice, evidence, and creativity; it belongs in a bounded Luna task.

### Request, reuse, and routing

Give Jev the exact post, necessary thread context, relevant preference or relationship facts, and a short previous decision when required. Persist the result with source, policy, rubric, and model versions. Unchanged relevant inputs reuse the result.

The optional workflow is:

1. A new or materially changed observation arrives.
2. Code checks for a valid existing decision and applies objective gates.
3. Jev evaluates unresolved semantic dimensions within the job budget.
4. Code uses its answers as advisory ranking signals alongside deterministic observations and exploration.
5. A worthwhile candidate receives one finite Luna task.
6. The task ends with an action, skip, defer, or evidence request.

Low confidence does not automatically justify another model call. Escalation needs plausible opportunity value, necessary context, and remaining budget; otherwise defer with a reason. A confident answer does not grant publication authority or prove a source claim.

### Limitations and tradeoffs

TypeSafe documents irrelevant-context degradation, adversarial-input susceptibility, option-order bias, and difficulty with indirect reasoning for `jev-1.13`. These matter for tweets, sarcasm, and unfamiliar technical discoveries. Limitations documented for that version should be rechecked when evaluating another model. [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13)

TypeSafe's confidence value summarizes the answer distribution; it is not independently verified correctness. Domain-specific thresholds require validation. [Confidence](https://docs.typesafe.ai/confidence)

The extra evaluator introduces another provider, failure mode, and decision boundary. Typed outputs reduce parsing problems but do not establish semantic quality. A compact Luna classifier may already be adequate. Aggressive semantic rejection could suppress novel opportunities, so the initial Jev experiment should reorder candidates while recording hypothetical rejections rather than silently excluding them.

Jev supplies no durable strategic memory on XGrowth's behalf. The controller still owns evidence, decisions, beliefs, invalidation, and stopping. Existing Writer review and factual verification remain required where current policy requires them.

### Evaluation recommendation

Design a provider-neutral `evaluateCandidate` interface, then compare Jev with a bounded Luna classifier on the same saved, human-labeled conversations and context. This is an interface proposal, not an implemented API.

Evaluate missed worthwhile opportunities, ranking quality, ambiguity handling, option-order sensitivity, adversarial text, unfamiliar topics, and the number of Luna calls avoided. Measure the entire workflow, including added evaluator calls and escalations. Check that meaningful outcomes and strategic consistency are preserved.

Adopt Jev only if that evidence supports it. The persistent controller and finite semantic job contract should remain useful whichever evaluator is selected.

## Local implementation record

The initial implementation added the durable job contract in `semantic_jobs.js`, persistence in `store.js`, and a cache-fed controller entry through `growth_agent_runner.js`. The controller prepares decisions and returns work descriptors. It does not collect live X data, begin an attached Growth Run, claim publication authority, or send anything.

Controller+runner slice recorded 2026-10-12: every ordinary runner wake — `GROWTH_AGENT_MODE` unset or the deprecated `executor` alias — runs one finite cache-fed `controllerTick` and exits before any browser lease, heartbeat, reasoning child, or open-ended loop. `GROWTH_AGENT_MODE=legacy` returns a blocked result without spawning. The runner forwards the configured selection as an ephemeral profile plus `runtimeExecution` without mutating saved profiles, delegation, or policy. Claive Codex stays pinned to Luna; native Codex preserves an explicit model selection so the bounded adapter can reject an unsupported model before dispatch. Other configured selections report `capability_unavailable` without fallback.

The direct API lane retains strict protocol-level output limits. Codex admission now calls `prepareBoundedCliRequest` and derives sizing, `unsupported`, and enforcement metadata from that result; the full semantic-job budget is passed to the runtime adapter. Native Codex has no per-response output cap or hard request-count cap. For the default zero-tool budget, preparation reports `unsupported: ['maxOutputTokens', 'maxModelCalls']`; a requested positive tool-call limit is also reported unsupported. Codex request/stream retries remain at native defaults because the built-in provider cannot be overridden; controller repair and fallback remain disabled. The adapter measures completed request counts from its own fresh-thread rollout audit; unknown counts remain `null` and fence the next wake. Known input, output, and request counts reconcile against daily reservations once, including crash recovery, and measured output/call/tool excess is charged before a terminal budget stop. Single-response output overshoot remains possible and is disclosed. Live source collection and attached-executor integration acting on the descriptors remain unimplemented.

Each job pins semantic inputs and versions, carries finite candidate/context/input/output/call/tool/repair/time limits, reserves before dispatch, persists exact attempt accounting, and ends with a durable decision or explicit blocked/unresolved state. Cached input and reasoning tokens remain subsets of input and output respectively. Missing provider usage stays unknown and retains a reservation. The controller adds per-opportunity reuse and a persistent usage ceiling across jobs; it must fence incomplete or uncertain work before accepting another request. Correction recorded 2026-10-12: for a terminal completed reply/quote, only the selected target carries a completed candidate judgment — unselected packet members stay eligible, and legacy whole-packet completed receipts are validated against the durable job result at reuse rather than trusted blindly. A completed result with no supported reply/quote target stamps and covers nothing (mapTerminal settles skip as skipped, never completed). Whole-packet memoization for skip/waiting/deferred/blocked/unresolved outcomes is unchanged.

The bounded controller supports direct API with its enforceable output cap and Codex through the labeled adapter accounting path. Codex offers no hard output or request-count cap, and its built-in provider retries cannot be disabled; requested unsupported limits are reported by adapter preparation. Measured usage is accounted, while an unknown request count remains fenced. The bounded adapter rejects tools, uses a fresh retained thread without resuming history, and disables controller-side repair/fallback. Pi and other runtime lanes remain unavailable to semantic controller inference. The controller does not silently switch providers or models.

The observation repair in `growth_run.js` and `x_discovery.js` replaces latest-batch accounting with cumulative run receipts. Replayed batches do not charge twice or overwrite newer observations. Rejected/promoted observations and empty batches consume finite collection capacity. A historical run without complete accounting cannot collect again under a fabricated zero balance.

Verification history includes temporary SQLite databases, frozen observations, fake runtimes/transports, and process-restart/contention checks; no live X or model traffic. The prior full suite finished with 281 tests, 276 passed, 5 failed, and 0 skipped. Four failures were owner-rest-hours rejections in unchanged tests/autonomous_run_friction_repairs.test.mjs, tests/production_state.test.mjs, and tests/social_engagement.test.mjs (test clock 04:44 Asia/Kolkata); the fifth was a lease-test cascade after a send-start test threw before finishing its Growth Run. Parent inspection found those files unchanged, so those failures were outside this lane. The controller-focused 43-test run had passed before the current corrections. The single focused invocation after these corrections (`node --test tests/semantic_controller.test.mjs tests/growth_agent_runner.test.mjs`) exited 1: Node reported both test files as module-level failures with the generic text `test failed`, without an assertion or stack trace, so the failing assertion is not identified. No rerun was made. No real semantic-quality validation has been performed. These checks establish control-flow and safety behavior only; they are not a live rollout. Remaining limitations: live source collection and attached-executor integration are unimplemented; semantic judgment quality, Hamza's voice, and exploration quality still need the frozen-conversation evaluation described above. TypeSafe/Jev remains an optional evaluation proposal with no added dependency.
