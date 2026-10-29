# Future improvement proposals

These proposals come from the October 28 implementation retrospective.
They do not authorize source changes, new tasks or deployment.

## Prompt size visibility

The recovery document enters the executor prompt verbatim. Three added lines
caused the existing 120-line test to fail during the integrated suite.
Parent shortened the instructions and the affected tests passed.
Proposal: expose the prompt line count in the existing runner check output.
Use the affected runner tests after changes to embedded documents.
The existing CI already runs tests, UI tests, lint and builds. No new CI job is proposed.

## Command documentation contracts

The live command sheet named an engage-refresh items field that the bridge never
returned. Independent review found the mismatch. Parent corrected the field list.
Proposal: derive compact command examples from disposable bridge observations
when updating the command sheet. Keep the bridge as the contract owner.

## Observation ingestion boundaries

Newest-evidence selection amplified an existing missing-count conversion.
Focused tests originally covered ordering but used complete metric fixtures.
Parent added partial-profile regressions and corrected the ingestion owner.
For later observation features, include the real writer in the read-path check.
Existing synthetic zeros need evidence before any historical correction.

## Review output cost

Several combined reads exceeded the chosen output budget and required narrower reads.
Use file outlines, bounded sections and structured tool results once per call.
No tool, skill or global instruction changes form part of this retrospective.

## October 29 continuation observations

Claim and repost fixtures silently depended on the owner's awake hours.
The full suite passed earlier and failed during rest. Three disposable fixture
policies now state their empty rest interval. Future policy-related fixtures
must state whether they exercise rest, urgency or ordinary claim behavior.
Proposal: use explicit fixture policies for other tests only when a demonstrated
clock dependency appears. Do not weaken production rest gates.

The attached launcher now inherits dotenv keys through its existing runner import.
The lifecycle reviewer finds no authority change. Proposal: decide whether the
launch environment needs an explicit inheritance contract before future launcher
refactors. No environment filtering or credential handling changes are authorized
by this proposal.
