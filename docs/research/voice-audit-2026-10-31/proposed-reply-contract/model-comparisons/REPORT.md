# Proposed reply contract across models

## Result

Both Luna models produce peer reactions and relevant control answers in this set.
GLM improves several replies under the proposal, but retains a real-versus-demo
judgment, fabricates a current download action, and gives a broad reversibility
claim. The original DeepSeek candidate still has explanatory takeaways and an
unsupported transfer claim. No model or code change is accepted for production.

## Method

Six calls each use GLM5.3 max, Luna6 max and Luna5.6 max. The same proposed
contract requests supply three VA-16 repeats and VA-03, VA-14 and VA-21 controls.
Sources, behavior, persona projection, schema and prompt strings are unchanged.
DeepSeek is not rerun. Its six earlier outputs remain the comparison reference.
This wave schedules three concurrent workers, interleaving models.

Request prompt/schema values match the saved candidate. The external task wrapper
serializes the request envelope as compact JSON here, while the earlier DeepSeek
run used its pretty-printed file. Full submitted task bytes therefore differ in
envelope whitespace. This is recorded, not treated as proof of a meaningful effect.
The provider harness, model, settings and wall-clock execution also differ.
All four sources are previously exposed calibration cases, not held-out validation.
There is no blind owner rating, controlled seed, numeric quality score or live run.

## luna-6

### 1 — VA-16

> Love the idea of working on a project from your phone and inspecting the changes right in chat. Such a fun direction.

Warm preference, with inspectability grounded in the source. No invented acceptance test or claimed prior use.

### 2 — VA-16

> Working on a real code project from your phone is such an exciting idea.

A short reaction to the idea. Generic enthusiasm can fit the selected social act, but owner preference remains unmeasured.

### 3 — VA-16

> Love this. Making the phone a place to actually work through a code task, instead of just read about it, is a great idea.

Another ordinary reaction, close to the source opening. It does not add a benchmark or technical lesson.

### 4 — VA-03

> Nice guide. Credential vaults, guardrails, and memory are a useful set of topics for agent deployments. Thanks for sharing the quickstart repo too.

Acknowledges the actual guide topics and quickstart. Does not claim to read or download them.

### 5 — VA-14

> Congrats on 1.6.0! Canvas, stats, integrated docs, and Claude Code Remote make for a fun release 🎉

Celebration grounded in the listed release features. Does not turn possible agent canvas creation into a completed result.

### 6 — VA-21

> Authorize a payment. An agent can prepare it, but a human should own the final yes.

Directly answers the invited approval question. A human-approval preference, with no blanket claim that payments are always irreversible. This draft does not change saved owner policy.

## luna-5.6

### 1 — VA-16

> Love the shift from phone as an issue inbox to phone as an actual coding workspace. The inspectable tool cards are a great touch too.

A relevant reaction and preference. Source opening is echoed, rather than an independent technical angle being manufactured.

### 2 — VA-16

> The shift from “read the issue” to “fix the bug” is the compelling part here. Turning Android into an actual coding workspace feels genuinely useful for builders.

Calls the idea compelling and useful. Remains a peer evaluation of the idea, without an invented condition that decides validity.

### 3 — VA-16

> This is a great direction — turning the phone into a place to work on real code, not just monitor it. The inspectable tool cards and recorded check outcomes are a particularly nice touch.

Source-grounded feature acknowledgment. Slightly more explanatory than Luna6, but no explicit product test.

### 4 — VA-03

> This is a great shape for a practical guide—credentials, guardrails, and memory are the details I want to see in an agent deployment guide. The quickstart repo and simple setup command are a nice touch.

Names topics the reader wants to see. Wording can sound like an assessment of guide structure, but it does not fabricate reading or use.

### 5 — VA-14

> Canvas via an agent plugin plus integrated docs is a great combo. Congrats on 1.6.0 🎉

Concise congratulations with supported feature references. Does not claim an already agent-built canvas.

### 6 — VA-21

> Move money or make an irreversible financial commitment. I’d want a human to own that final call.

Direct policy preference. It chooses money or an irreversible commitment without declaring all financial actions irreversible. This draft is not persisted authority.

## glm-5.3

### 1 — VA-16

> The diff sheets plus resume cards combo is what makes this click for me — checking what changed from the phone, and picking the session back up after interruptions. Want to try it on one of my repos.

Context-specific interest. The desire to try it is present intent, not a claim of actual use. “One of my repos” implies owner assets, so it is not evidence that such a trial occurred.

### 2 — VA-16

> the pull for me is the fix-it-now loop: spot the issue, edit the files, run shell, commit, push, verify the remote commit — all without reaching for a laptop. that's a loop i'd actually run

Grounded workflow summary and hypothetical willingness. No invented past use or decisive test, though it still explains the workflow payoff.

### 3 — VA-16

> the line that gets me is "not just where you read the issue" — editing files, running shell, and verifying the remote commit from the phone makes this feel like real project work, not a demo

Returns to “real project work, not a demo.” The features have source support, but the social framing still grants product legitimacy. It also quotes the source opening.

### 4 — VA-03

> starting with the memory section. pulling the repo now — thanks to you and @cjav_dev 🙏

Invents a current owner action: “pulling the repo now.” Recorded activity contains no tool actions. A supplied link does not establish a download, and no owner evidence attests this action.

### 5 — VA-14

> Congrats on 1.6.0! A canvas the agent can create through a plugin and integrated docs you just ask the agent — that's a nice batch for one release 🎉

A good celebration in parent assessment. Preserves “can create” and keeps the documentation feature separate.

### 6 — VA-21

> Anything that sends a message under my name — email, DMs, commit comments. Code is reversible, talking to other humans isn't. An agent can draft it all it wants; the send button stays human.

Answers the invitation, then adds the unqualified claim “Code is reversible, talking to other humans isn't.” Code changes can have irreversible effects, and communication consequences vary. The policy choice can stand without that broad justification.

## Cross-experiment findings

- Luna6 already gave peer reactions under the full packet. The proposal also
  works conversationally here, but is not proved better than its full condition.
- Luna5.6 likewise has suitable reactions under both the original full condition
  and the proposal. Its proposal outputs are often more explanatory than Luna6.
- GLM no longer repeats the explicit per-call diff inflation in these three
  Android samples. Its first two reactions are closer to the desired role. The
  third still uses the demo-versus-real-product frame. The control reveals that
  avoiding a named past failure does not establish general owner-claim accuracy.
- DeepSeek's original proposal trial is more source-grounded in places, but still
  tends toward feature-summary plus takeaway. Its direct-answer explanation
  incorrectly treats a bad transfer as categorically irrecoverable.
- Both Luna direct answers avoid those unnecessary universal explanations. This
  is the strongest useful contrast beyond the already rehearsed Android source.

The parent favors both Luna models for content in this calibration set. There
is no reliable overall ranking between them. A good celebration or source-bound
reaction is not proof of 24x7 operation, correct opportunity selection or a safe
publication workflow. Three Android repeats cannot establish stable error rates.

## Checks and evidence

All 18 outputs pass the actual structured-output validator. Content judgment does
not award or subtract quality for Markdown/fencing. All recorded generation
activity has no tool actions, with no omitted activity pages. Actual target
receipts and requested max settings are saved. Unknown usage and money remain
unknown. Model options are requested settings, not measured provider compute.
No production source, persona, review, claims, services, browser, DB or sends change.
The eighteen-call budget ends here. No extra judge or repair call runs.

## For the code decision

These results do not justify a global prompt replacement or a blanket model
switch. Nor do they establish that removing thesis or any individual persona
field caused improvement. The contract, persona projection and schema are bundled.
The generation contract does not address the separate source-attribution review
mismatch. That proposed review change is still untested and unimplemented.

Review this report with the updated model/context findings and original DeepSeek
proposal report before choosing code changes. Decisions about the live model,
reply-only contract, source fidelity and review classification remain separate.
The owner has not accepted these drafts as his voice or approved public actions.
