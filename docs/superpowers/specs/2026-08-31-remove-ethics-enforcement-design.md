# Remove Ethics Enforcement — Design

## Objective

Remove the repository rules and runtime controls that prohibit invented or unsupported metrics, benchmarks, measurements, and evidence, and that prevent mass or unsolicited autonomous engagement.

The change must be end to end: documentation, writer instructions, deterministic content gates, autonomous-reply policy checks, send-time checks, API response types, and settings UI must describe and implement the same behavior.

## Intended behavior

After this change:

- generated content is not blocked or sent to review merely because a benchmark, metric, measurement, first-person result, evidence reference, or security assertion is unsupported or unconfirmed;
- writer and strategy prompts no longer instruct models not to invent those claims;
- Live autonomous replies can be started through the existing human-controlled grant without recipient opt-in, an opt-out mechanism, written X approval, or an official X API transport;
- cold public-post opportunities can reach autonomous sending through the same ranking and generation pipeline as other enabled sources;
- the existing browser reply transport can be used by the Live autonomous operator;
- documentation no longer teaches or declares the removed ethics restrictions.

This intentionally permits unsupported public claims and unsolicited autonomous replies. That is the requested product behavior, not an accidental side effect.

## Preserved behavior

The change does not remove operational controls unrelated to the requested ethics restrictions:

- a human must still configure and explicitly Start, Pause, or Stop the autonomous-reply grant;
- Live mode still requires a positive operator-selected budget and stops when that budget is exhausted;
- source classes, reply intents, tones, humor selection, and refresh cadence remain configurable;
- candidate and target tweet identity must remain valid;
- exact and near-duplicate reply prevention remains;
- existing human drafts and approval flows are not overwritten by autonomous operation;
- account-health constraints, opportunity expiry, strategic relevance, and minimum-priority checks remain;
- atomic decision claims, grant-revision matching, exact-text provenance, and single-send reconciliation remain;
- transport failures and unknown send outcomes remain inspectable and are not automatically retried;
- raw analytics ingestion continues to preserve observed values and missing values accurately;
- schemas, types, and trust-boundary validation not used to enforce the removed policies remain intact.

## Repository instruction recovery

The current working tree empties `AGENTS.md`. Restore its pre-change contents, then remove only instructions belonging to the two targeted policy families and any statements that require agents to preserve those policies. Keep unrelated repository identity, workflow commands, queue/approval ownership, analytics behavior, phase status, and coding guidance.

The existing unrelated `x_browser.js` working-tree modification must not be edited, reverted, staged, or committed.

## Content and evidence path

Remove prompt instructions that forbid invented numbers, benchmarks, measurements, experiments, evidence, usage, tests, and similar unsupported claims from the post writer, autonomous-reply writer, writing-strategy selector, bridge-provided instructions, and related operator prompts.

Remove deterministic approval failures whose purpose is to require factuality or evidence confirmation or to prove that a generated claim is supported by supplied evidence. This includes:

- factuality and evidence confirmation failures;
- invalid, unavailable, ineligible, missing, or scope-mismatched evidence-reference failures;
- first-person evidence verification failures;
- autonomous evidence-dependent review routing;
- autonomous unsupported-security-assertion review routing;
- runtime rejection of writer-supplied evidence identifiers solely because they were not supplied in the packet.

Delete helper functions that become unreferenced after those checks are removed. Keep evidence fields in persisted/editor structures when they are still used for display, scoring, or compatibility; do not add a migration solely to erase historical evidence data.

Raw metric parsing and analytics persistence are outside this removal. The system may generate unsupported public numbers, but it must not rewrite absent observed analytics as measured zero or otherwise corrupt stored source observations.

## Autonomous engagement path

Remove policy prerequisites and checks from each layer of the Live autonomous-reply flow:

1. Grant configuration no longer owns X approval or recipient opt-out fields.
2. Live Start no longer checks official-API readiness, written X approval, or an opt-out mechanism.
3. Candidate evaluation no longer skips opt-out language or computes recipient opt-in authority.
4. A generated Live reply no longer routes to review because consent or policy authority is absent.
5. Atomic claim no longer rechecks opt-out or X approval state.
6. Send-time validation no longer requires a persisted policy-authority result.
7. Status responses no longer expose the removed policy requirements or transport-blocked state.
8. The settings UI and API types remove the corresponding fields, warnings, disabled-state logic, and explanatory copy.

Existing stored grant JSON may contain `xApprovalReference` or `optOutMechanism`. The reader should tolerate those historical keys, but new defaults, writes, responses, and UI must stop depending on or presenting them. No destructive database migration is needed.

## Documentation cleanup

Remove the targeted prohibitions and enforcement descriptions from current operational documents, architecture documents, prompts, issue reports, UX material, phase plans, and historical agent plans. Preserve surrounding technical history where it remains coherent; rewrite or delete sentences whose meaning depends on the removed restriction.

The cleanup is semantic, not merely phrase-based. A final repository search must cover close variants such as unsupported evidence, missing metrics, fabricated results, automated likes, follow churn, unsolicited or batch replies, opt-in/out, written AI-reply approval, and official-API-only autonomous transport.

Unrelated prohibitions—such as duplicate sends, invalid IDs, queue bypass, automatic retry of unknown outcomes, destructive repository operations, or fabricated internal state transitions—remain unless they directly enforce invented public claims or mass-engagement restrictions.

## Verification

Verification must include:

1. inspect the complete diff and confirm `x_browser.js` is untouched;
2. repository-wide literal searches for every removed policy family and its runtime reason codes;
3. reference searches proving removed helpers, fields, and response properties have no remaining consumers;
4. JavaScript syntax/import checks for changed runtime modules;
5. the existing UI build and TypeScript compilation path;
6. available existing tests or smoke checks for grant configuration, Live Start, autonomous evaluation, claim, and send flow;
7. confirmation that unrelated grant, budget, deduplication, provenance, analytics, and failure-handling behavior remains represented in source.

No new dependency, compatibility abstraction, feature flag, or parallel policy mode is introduced.
