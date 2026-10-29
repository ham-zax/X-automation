# Growth OS reply-quality design and bounded pilot

Latest continuation: see "Proposed integrated Harness² benchmark" at the end.
Earlier pilot limits and stop records below retain their historical scope.

Status: pilot stopped after two inconclusive probes. Fresh diagnosis complete. Parent task: XR-14.
Baseline: `8dfcb39ed2a6033d359f47a817b9d2004c767850`, branch `main`.

## Intent and scope

Hamza asks for an agent that participates as him, rather than assigning unsolicited
technical reviews to other builders. Advice remains welcome when the conversation
earns advice. The intended production operator is DeepSeek 4.1 at max effort.

On 29 October, Hamza approves the outline for an independent design, local Harness²
inspection, and a bounded unpublished comparison. This phase does not deploy a
writing change or enable continuous operation. It retains XR-14 in-progress.

The evidence baseline is
`docs/research/GROWTH_REPLY_QUALITY_REPORT_2026-10-29.md`. The frozen corpus and
22 assessed cases reside in `docs/research/voice-audit-2026-10-29/`.

## Facts that constrain the design

The first versioned attached brief, commit `b39f3e8`, is dated 13 October at
11:05:52 +05:30. Of 458 captured replies, 440 predate it. The remaining 18
include 11 matched publications and seven replies of unknown origin.

Commit `6b29fcb` adds the current warning against reviewer-style replies at
14 October 04:56:47 +05:30. All 448 matched publications predate that commit.
All seven later captured replies have unknown human/agent origin. The corpus
therefore does not establish the effect of that warning on agent output.

`writer_runtime.js::reviewWriterOutput` already checks voice. Its prompt explicitly
flags ritual hidden-boundary framing and unnecessary abstract takeaways.
`voiceIssues` already affects acceptance. A new review field is not the first repair.
The useful question is whether the actual review catches these concrete errors.

The approved XActions parser drops extended note text. A local fixture reproduces
the loss for ordinary and visibility-wrapped posts. A legacy-only control retains
its text. The installed pin postdates the historical replies, so the fixture
does not establish every historical input.

`drafting.js` and `persona.js` contain synthesis defaults. However, a valid explicit
behavior decision takes precedence in `selectBehaviorDecision`. A repair must not
reject valid selected behavior merely because an optional archetype is absent.

The persona describes repeated account output as a systems-consequence signature.
That signature reaches the Writer slice, along with explicit limits against
overusing it. The signature may reinforce the unwanted habit. That is a hypothesis,
not a demonstrated feedback mechanism or proof of the owner's private beliefs.

Current queue metadata is not an immutable generation trace. Marker frequencies
cannot establish that selection or realization is the dominant historical cause.

## Independent solution

Use source comprehension to choose the conversational act. Use the persona to
realize that act. A technical interest is available context, not a standing
assignment to audit every source.

The reasoning agent must distinguish a launch, a demonstration, a question,
an invitation for suggestions, and a consequential claim. The agent then chooses
an honest reason to respond. Existing purpose, information-depth, and
reason-to-exist fields can express that choice. No new persona ontology is needed.

For routed writing, use the existing `behavior-select` facility when a heuristic
proposal is wrong. Preserve valid explicit decisions. For direct `act` writing,
apply the same contextual judgment without manufacturing extra queue writes.

A reply that realizes celebration must not acquire an unrelated reliability test.
A reply that answers a technical question must retain the useful explanation.
A question must account for information already supplied. A source's rhetorical
question does not automatically require an answer route.

Keep first-person experience grounded. Neither missing biography nor uncertainty
about a product requires substituting a generic engineering lesson.

## Approach before and after Harness²

The original approach was a manual controlled comparison: freeze the inputs,
establish current behavior, change one suspected contributor, and compare outputs.

Harness² provides a propose, probe, and compose method. It can automate parts of
that comparison. Its selector does not establish the owner's voice or replace
evidence of useful behavior on reserved cases.

Primary sources:

- https://github.com/google-research/harness2
- https://arxiv.org/abs/2610.14224

The local checkout is `/home/ubuntu/repo/harness2`, at `1cfe254`, with pre-existing
Learning OS changes. Those changes remain untouched. Its local adapter uses the
same DeepSeek proxy model, but its rollout command does not request `max`.
Its isolated provider configuration also lacks the normal max-variant declaration.
An unchanged launch cannot establish the requested max-effort baseline.

The first pilot therefore uses T3 for the exact model/variant dispatch. The parent
performs proposal and composition. This is a bounded application of the Harness²
method, not a claim that the stock recursive executor ran successfully.
Do not add a new generic framework or alter another project's adapter to obtain
the initial evidence. A native Harness² adapter can follow only if the pilot
demonstrates value and needs repeated operation.

## Pilot authority and limits

This pilot is a continuation of XR-14. It creates no new implementation graph.
The prior implementation/review budget remains 22/22 and grants no extra workers.
The owner's new approval covers this separate bounded evaluation:

- At most five solver dispatches. No automatic retries or replacement workers.
- One active solver at a time.
- Exact model: `opencode2api/deepseek-v4.1-flash-free`.
- Provider: OpenCode. Variant: `max`.
- Parent designer/composer: GPT-6.1 Sol, xhigh. No additional editor agents.
- At most 75,000 characters in any solver packet.
- At most 12,000 characters in any accepted solver result.
- Wait at most ten minutes for a dispatch result. A wait timeout does not prove
  worker termination. Follow T3's returned next action and record unresolved work.
- No hard provider reasoning-token or dollar cap is available through this tool.
  Do not claim one. Record available usage and stop at the dispatch ceiling.
- No fallback to a different model or lower effort.

Only public source fixtures and approved static persona material enter the packet.
No cookies, headers, database copy, credentials, or production service access enters
the experiment. Solvers return unpublished text. They do not draft into the live
queue, approve, claim, send, alter policy, or delegate work.

## Frozen split and baseline boundary

Calibration cases: VA-03, VA-14, VA-16, and VA-21.

These represent unsolicited review, celebration/output mismatch, an already-answered
question, and a useful direct answer. The other 18 cases are reserved before
candidate construction. The solver receives source text and current guidance,
not old replies, analyst assessments, suggested replacements, or reserved cases.

The baseline uses the current static attached reply guidance and static Writer
persona material. It omits live daily tone, stances, feed history, and browser
state. Those omissions are recorded, not silently treated as equivalent inputs.
This is a controlled writing simulation, not an end-to-end attached session or
an execution of the current Writer generation-and-review pipeline.

All variants use the same captured full sources. Source fidelity is not changed
inside a voice comparison. The parser regression remains separately demonstrated.

## Comparison sequence

1. Baseline: generate four unpublished replies with the current static guidance.
2. Candidate A: make source invitation and actual contribution control realization.
   Replace broad default instructions within the candidate copy. Do not add a
   mandatory sentence pattern, universal friendliness, joke, or technical payload.
3. Candidate B: test a narrower reply persona projection. Remove the repeated
   systems-signature encouragement from the experimental input only. Retain
   technical competence, grounded experience rules, and the owner's other choices.
4. Compose only changes supported by the observed contrast. Generate the same four
   replies again. Keeping the baseline is a valid outcome.
5. Test the selected candidate once on the reserved 18 cases. Do not tune the
   candidate after seeing that result under the same claimed holdout.

Five dispatches are a ceiling, not a quota. If no changed candidate is justified,
stop and record that result. A technical limitation or inconclusive comparison
does not justify changing models or quietly extending the budget.

The parent assesses outputs against sources before inspecting superficial markers.
The parent is also the designer, so this pilot is not an independent acceptance
review. Keep outputs visible for owner feedback and any later independent check.

## Evaluation criteria

Check source comprehension, fit to the invitation, honesty of the contribution,
realization of purpose, clarity, and whether the reply stops when complete.

Retain direct answers and invited technical advice. A skeptical reply can be good.
A short casual reply can still be condescending or inattentive. Question marks,
capitalization, and length are not quality scores.

Keep uncertainty about unseen media, linked methods, and surrounding conversation.
Do not turn the 22 analyst cases into owner-approved gold labels.
Do not use the same model's selection alone as evidence of improvement.

The useful output is a paired comparison with concrete supported differences,
not a claim of a measured follower-growth effect or perfect human imitation.

## Later repair boundaries

Source fidelity belongs at the normalization boundary. Preserve XR-13's exact
upstream-commit approval gate. Harvesting raw text into a second parser inside
`x_reads.js` can miss the separate creator reader in `tech_news.js` and duplicate
normalization. Prefer a tested owner-level repair over an accumulating side cache.
The dataset's length heuristic is an audit hint, not proof that a post is clipped.

A writing repair must reach both active authoring paths. Reuse one concise
canonical contract through the existing loading boundaries. Add review instructions
only when actual outputs show what the existing rubric misses. A source quotation
can establish that words occur, but cannot mechanically prove those words answer
a question or that a reply fits the social moment.

No production prompt, persona file, source parser, runtime model, service, timer,
approval, or sending path changes in this pilot. Only Hamza marks XR-14 done.

## Observed stop condition, 29 October

The baseline and two candidate probes complete on four cases each. Both probes
retain the core unwanted evaluator role. Some individual wording improves, but
the outputs do not justify promoting a candidate.

The repository two-attempt stop rule overrides the planned composition sequence.
Dispatch four obtains a fresh diagnosis from the goal, exact inputs, and outputs.
It receives no parent theory or old analyst assessment. This replaces the fourth
writing run within the five-dispatch ceiling. It is not an extra editor stage
in a claimed stock Harness² run. Dispatch five and the 18 reserved cases stay
unused. No production edit follows from these probes.

## Proposed integrated Harness² benchmark

Hamza proposes small prompt variants, repeated benchmarks, and comparison with
the current Growth OS harness. This section records the proposed next direction.
It does not launch another model run or deploy a writing change.

The fresh DeepSeek experiment supplies a provisional V4 instruction and concrete
factual and format failures. Read
`docs/research/voice-audit-2026-10-29/fresh-prompt/REPORT.md`.
Its improvement is narrower than production acceptance.

### Recommended sequence

1. Build an offline Growth OS replay around the existing packet, generation,
   schema validation, and independent review owners. Use disposable fixture state.
   Production state, browser transport, claims, and publication stay inaccessible.
2. Establish the actual current-harness baseline. Compare V4 in the same context.
   Include direct-reply preparation and routed writing. Do not invoke `act` to
   test text. Its current handler proceeds to a publication claim and browser send.
3. Check whether V4 survives real packet context. A clean-prompt result does not
   prove it survives the old persona projection, purpose selection, or writing
   contract. Keep those inputs fixed within each paired comparison. Investigate
   demonstrated conflicts separately, rather than changing everything together.
4. Connect that replay to Harness²'s benchmark adapter interface. Permit one
   candidate style file to change. Keep source fixtures, evaluation, persona
   facts, model selection, and authority code outside the editable harness tree.
5. Run a bounded propose/probe/compose cycle with DeepSeek as solver and editor.
   Record all calls, including editor, reviewer, repair, and reflector calls.
   One heavy job runs at a time. Do not start until the ledger records the exact
   cycle budget and model configuration. No automatic library or production promotion.
6. Repeat promising variants and test fresh sources after selecting a candidate.
   Eight source cases have now been used. Fourteen original cases remain unused.
   Freeze the next split before tuning and do not rename exposed cases as unseen.

### Acceptance evidence

Mechanical checks cover exact output fields, valid references, request identity,
and the absence of publication side effects. The known `text_alt` addition is a
format regression fixture. Available diff sheets becoming every-tool-call diff
sheets is a factual regression fixture.

Use the existing independent review to inspect factual and owner claims. Its
acceptance is evidence to assess, not proof that every claim is correct. Quotation
matching alone cannot establish support for an inference. Judge conversational
fit against the full source and invitation. Preserve useful technical answers and
invited advice. Do not optimize length, question frequency, or a list of phrases.

The parent and owner inspect paired outputs. Model self-scoring cannot establish
the owner's voice. A gain must preserve factual and format behavior on controls.
This benchmark cannot measure follower growth or a sustained live outcome.

### Existing facilities and gaps

Growth OS already has `buildWriterPacket`, `generateWriterOutput`, structured
validation, role-bound runtimes, and server-owned independent review. Reuse them.
Direct replies still accept operator text through `act`, so changing the Writer
profile alone does not cover both authoring paths.

The local Harness² extension targets Learning OS and Lingua OS. Its interface and
isolated workspace pattern provide reference code. Its adapter is not a Growth OS
benchmark. It launches OpenCode without an explicit max variant. Exact model and
effort requests need verification before any claimed matched benchmark. Model
delegation must follow the current T3 execution rules. Do not silently substitute
CLI launches for the model route used in the successful prompt trial.

The Harness² checkout contains unrelated dirty Learning OS work. Preserve it.
Keep optimization artifacts separate from production style documents until the
candidate earns acceptance. Do not build another general-purpose framework.

### Terra reference and current scope

Terra stays on hold. Saved Terra output is a qualitative reference on four shared
sources. It used the earlier full baseline packet, while the fresh V4 run used a
short new context. Those results do not form a matched final-harness model test.
A later fair comparison must give both models the same final input. Do not make
new Terra calls without a renewed request.

No source code, production model, persona, service, timer, or approval changes are
authorized by this proposal. Implementation scope and the next call budget need
to be recorded before execution. XR-14 stays in-progress.
