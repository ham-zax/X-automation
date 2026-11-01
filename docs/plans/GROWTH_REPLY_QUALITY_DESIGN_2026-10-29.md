# Growth OS reply-quality design and bounded pilot

Current proposal: see “Production repair plan, 1 November 2026” below.
That section supersedes earlier proposed execution sequences for this repair.
Earlier experiments, permissions and stop records retain their historical scope.

Implementation approval supersedes the proposal's hold: Hamza authorizes Terra
high and asks to proceed. See TASKS.md's implementation graph and packet.

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

## Superseding implementation checkpoint, 29 October

Hamza later authorizes Terra high and the bounded offline implementation graph
in TASKS.md. The earlier Terra hold and proposal-only scope above are historical.
The implementation and experiment report now live at
`../research/voice-audit-2026-10-29/integrated-harness/REPORT.md`.
The native cycle keeps the baseline. No production style is accepted.
Optional offline review calibration narrows social-claim classification while
retaining actual factual objections. It grants no publication authority.
Close the experiment after one final graph review. The next proposed causal
test changes selected behavior alone. Do not start another tuning wave here.

## Production repair plan, 1 November 2026

Status: proposed plan reviewed by Terra 6.1 Medium. Its one required interface
clarification is incorporated and checked by the parent. Terra did not re-review
the amended text. No repair implementation or public restart accompanies this
document. TaskStartSnapshot: 83dd296, main.
TASKS.md owns current dependencies, statuses, dispatch IDs and budgets.

### Goal and acceptance

Produce replies, Originals, Quotes and Threads that fit Hamza's developer/builder
identity, the source, and the person being addressed. Permit excitement, humor,
plain support, disagreement, useful advice and silence. Preserve factual meaning
without demanding technical depth from every interaction. Keep the operator
maintainable and inexpensive enough for continuous use.

GLM 5.3 max remains the configurable production Writer. DeepSeek V4.1 max remains
the configurable executor/orchestrator. Terra 6.1 Medium is the single selected
support/evaluation model for this repair. It is not silently substituted for GLM
and is not added as a permanent per-reply critic.

A completed repair needs all of the following evidence:

- An evaluator request uses the same contract, source projection, schema and
  review mode as the production path it claims to evaluate.
- GLM can select a fitting conversational act without obeying an executor-authored
  critical thesis. The final saved typed behavior describes the selected output.
- Source relationships, qualifiers, causes and unknowns remain accurate. Social
  affect does not need a fabricated biography or an analytical justification.
- The selected candidate, saved public text and submitted text agree exactly.
  Profile mode cannot silently substitute operator prose under a Writer label.
- Quotes use the selected Writer and the review required by that chosen route.
  Originals/Threads keep their independent review and approved queue.
- One bounded offline acceptance set passes Terra's assessment of purpose, plain
  language and grounding. Hamza's rejection overrides a model's pass.
- Runtime failures, time limits and recovery are reported truthfully. No unsafe
  resend or hidden model switch occurs. Lifecycle success is reported separately
  from writing quality and public outcomes.

“Correct” means those concrete outcomes hold on the checked scenarios. It is not
proof that all future writing is perfect or that follower growth will result.

### Adaptive personality is an acceptance requirement

Hamza's voice must remain recognizable while his response changes with the
person and situation. Use his expressed preferences and grounded owner examples,
the source's social meaning, supplied thread history and relationship context.
Do not substitute a generic polite developer voice or a permanent senior-reviewer
voice. Concise rough wording, stronger excitement, humor, warmth, blunt disagreement
and detailed technical reasoning can each fit. No one register is the default
answer to every source. Do not fabricate experience to make the voice feel personal.

The existing purpose/mode/affect labels describe the chosen act. They do not prescribe
sentence templates, fixed enthusiasm, neutral tone, length or mandatory technical
content. A celebration can be exuberant. A setback may need simple acknowledgment.
An invited technical discussion can use precise vocabulary. Reject unnecessary
decoding, not individual words such as denominator. A familiar relationship can
permit teasing that would be misplaced toward a stranger. Use actual context,
not an invented relationship.

Terra must assess situational fit and Hamza's requested voice separately from
factual support. A response can be accurate and still fail because it is bland,
patronizing, needlessly analytical or unlike what Hamza wants to say. Reference
replies illustrate possibilities, not target strings or the evaluator's preferred
personality. Hamza's rejection overrides a polished reference or a PASS label.

The checks protect source meaning, owner facts, exact output and sending authority.
They must not become an expanding list of prohibited expressions or a requirement
to flatten creative affect. The two-candidate process remains available to explore
different fitting reactions, not to satisfy a fixed distribution of social modes.

### Scope, constraints and skills

This plan covers the two rejected live replies, the pasted audit's issues 1.1–2.4,
Original/Quote authoring, evaluation drift, publication handoffs and operational
recovery. It does not reopen unrelated Satori work or every historical Growth OS
feature. The existing XR ledger remains historical authority for other tasks.

Use existing modules, role bindings, drafts, queues, source snapshots, AI run
receipts and publication attempts. Add no new daemon, dependency, generalized
framework, model router, vocabulary of personalities or cryptographic tracking.
Do not introduce phrase bans, fixed sentiment, question quotas, posting quotas,
required technical takeaways or an automatic critic stack. Do not weaken source,
owner-attestation, delegation, duplicate, run-lease or uncertain-send rules.

The parent used systematic debugging to trace saved input to published output.
JevShelf selected Scientific Method for causal claims and Concept Fan for design
alternatives. Their roles are distinct: the creative method proposes alternatives,
and evidence determines which claims survive. Brainstorming establishes the
responsibility boundary. Writing Plans specifies the implementation sequence.
The plan does not invoke a new engineering workflow or strict TDD.

TDD route: off/skipped. The owner's standing request excludes unnecessary tests
and hash machinery. No new automated test suite or full-suite run is prescribed.
Reuse request captures, saved artifacts, existing syntax/build checks and a small
unpublished output comparison. Add a focused executable test only if separately
authorized later. Never call a schema check a writing-quality result.

### What the evidence establishes

| Issue | Evidence class | Owner and planned disposition |
|---|---|---|
| Executor prescribes an unwanted thesis | Confirmed in both saved requests | GQ3 separates opportunity, suggested angle, owner instruction and final Writer decision. |
| GLM adds unsupported facts and convoluted language | Confirmed in saved output and checks | GQ3 changes source-based checks and final selection. GQ4 evaluates the public text, not its PASS labels. |
| Two candidates repeat one imposed act | Confirmed in the Chrome records | Keep the adopted v2 process, allow materially distinct fitting responses. Do not require diversity when only one act fits. |
| Full operator persona may encourage systems criticism | Plausible contributor, not isolated cause | Remove prescriptive handoff first. Change persona only if the same failure persists with neutral opportunity context. |
| Linked article absent from Writer evidence | Confirmed in the request path | GQ2 passes excerpts when judging article content. No mandatory paper read for a simple social reaction. |
| Long-post parser drops note text | Existing defect identified in current reader and earlier fixtures | GQ2 repairs source normalization without bypassing upstream trust approval. |
| Evaluator uses V1 with V2 output shape | Confirmed in both evaluation owners | GQ1 uses the canonical production owner and invalidates old cache identities. |
| Offline review differs from direct Reply mode | Confirmed | GQ1 captures the actual mode. Optional independent assessment is labeled separately. |
| “fun.Usu” corruption | Reported artifact, original boundary evidence not inspected here | GQ3 first obtains exact input/output/selected/submitted artifacts. Do not assume schema ordering caused it. |
| Output instructions may be ambiguous | Plausible interface problem | GQ3 gives one JSON output instruction while preserving the two-candidate procedure. No latency promise. |
| Missing invocation and unbound text | Confirmed in replyModelProvenance | GQ3 binds the existing saved generation and exact text before profile-mode claim. |
| Quote generation review is not enforced by act | Confirmed for the selected reviewed-Writer route | GQ3 requires the corresponding current saved draft and review at claim. |
| Direct Reply skips independent review | Confirmed and partly intentional | Preserve one-call v2 self-review. Do not claim independent review occurred or add it universally. |
| Disposition projection returns misleading null/ok | Audit evidence, fields are checkable | GQ5 aligns the command sheet and actual response fields. Treat bridge exit/errors correctly. |
| Orphan-disposition explanation | Contradicted by missing-candidate guard | No code repair for that alleged mechanism. Correct documentation only. |
| luna-arm labels, old default, ignored backup files | Low-severity maintenance, not demonstrated model misrouting | GQ7 labels settings/history correctly. Remove only proven redundant versioned artifacts. |
| Provider free-usage failure | Reported operational event | GQ5 checks current logs and classifies it truthfully, with no silent fallback or restart storm. |
| Early deadline claim | Observed in an earlier live session, cause unresolved | GQ5 compares actual elapsed time, deadline and run recommendations before choosing a repair. |
| 74 due measurements and 20 closed-unresolved attempts | Historical snapshot, current counts need re-read | GQ6 inventories and recovers eligible work. It never replays uncertain sends. |
| Wrong authors/URLs attached to attempt IDs | Audit correction requiring authoritative readback | GQ0/GQ7 use publication-attempts and preserve identities. Do not rewrite history from labels. |
| Schema order, repair rate, speedup estimates | Unproven causal/performance claims | No reorder-only repair or claimed percentage gain. Record actual transport evidence first. |

The primary diagnosis remains narrow. The requests prescribe the thesis and GLM
follows it. That is evidence of the immediate failure path, not proof that every
poor reply has the same cause. Terra's evidence review independently supports
this boundary and cautions against broader causal claims.

### Alternatives considered

1. Append more instructions or another critic. This is the obvious branch. It
   leaves the imposed thesis intact and adds context/calls. Reject as the default.
2. Let one model handle the whole account. This could remove the handoff, but
   changes the owner's chosen two-model architecture and does not establish better
   judgment. Keep available through existing configuration, not this repair.
3. Keep DeepSeek as scout/operator and GLM as conversational author. Pass source
   context and actual owner direction, treat executor ideas as suggestions, and
   keep Growth OS in charge of state and publication. Recommend this branch.

Concept Fan's useful reframing is to optimize appropriate participation rather
than compliant production of an analytical reply. “A stricter critic” and “more
natural wording rules” are cosmetic variants if the required argument stays the
same. Neither is the selected architecture.

### Target interfaces and authority

DeepSeek supplies an opportunity: exact source, URL/ID, observed context and
metrics, relevant thread/relationship state, real owner direction and an optional
suggestion. Distinguish observed text from annotations and advice from evidence.
The operator cannot label its own preference as a human instruction.

GLM selects an act and produces its candidates/checks/final text in one writing
invocation. Reuse behavior.js's existing purpose/mode/affect/depth values. A
purpose remains required for a public action. A suggested purpose/angle is not
a required conclusion. Explicit owner direction remains binding. The Writer
may select a more fitting act or DO_NOT_POST when the suggestion does not fit.

For POST, the Writer's selected behavior must be validated and saved with the
exact selected public text. Do not save the executor's judgment label beside a
celebration, or silently change the pipeline. For DO_NOT_POST, save a preparation
outcome without manufacturing ACT authority. Writing never grants a claim.

Keep v2's two candidates and all 16 checks. Clarify that checks compare source
meaning, including relationships and causation, rather than the executor's thesis.
Keep humor and ordinary subjective expressions distinct from claims of product
use or personal history. A prefix such as “To me” cannot make an embedded factual
assertion supported. No requirement makes every response excited or skeptical.

Use existing saved draft/editor fields for selected text, selected behavior,
Writer execution and the audit. The returned generation reference identifies
that saved draft. Reuse its source/evidence/persona/target context. Before claim,
load the server-owned draft and compare exact text, role, run, session and target.
No new hash service or certificate table is needed. An edited draft requires
explicit regeneration or the existing authorized edit/review path. A rejection
returns preparation work, never permission to resend an uncertain attempt.

The chosen reviewed Quote path requires a current passing review for that exact
saved draft. An AI caller cannot supply an independent-review attestation. Do not
retroactively claim every historical direct Quote required that review. Profile
mode is the current selected all-GLM policy. Existing operator mode remains an
explicit configuration choice, never a fallback from a failed selected Writer.

Originals and Threads retain the existing full Writer, independent review and
approved queue. Apply the same distinction between owner direction and executor
suggestion to their writing inputs. Do not redesign their schema merely because
Reply changes help. Capture a real Original/Quote request before removing shared
fields such as thesis or followValue. Keep their useful context and source needs.

### Implementation sequence and exact owners

#### GQ0 — Evidence baseline and acceptance packet

Files: this plan, TASKS.md, the existing production failure report and its four
JSON records. Terra evidence collection is complete. Retain contradictory evidence
and distinguish observations, recommendations and unresolved hypotheses.

Acceptance: the task graph references actual artifacts and current HEAD. No new
factual claim uses an actor name without its publication attempt identity. No
implementation or model-quality pass is implied by Terra's design assessment.

#### GQ1 — Repair the measurement path first

Files: reply_contract.js, eval/growth_reply.mjs, eval/harness2_growth.py,
docs/GROWTH_REPLY_BENCHMARK.md.

Import the canonical current contract and schema rather than reading a versioned
filename independently. The direct replay must expand REPLY_WORKFLOW as well as
REPLY_CONTRACT. Include the active contract and workflow inputs in existing cache
identity. This updates existing evaluation identity, not new hash verification.
Invalidate stale requests through a fresh run directory. Preserve historical runs.
Capture skipReview exactly as the production lane uses it. Label any extra review
as diagnostic. Model/runtime/effort, source, context and pipeline accompany receipts.

Acceptance: prepare a fresh local request without a model call and inspect its
contract, schema, mode and expanded placeholders. Changing the active contract
changes the existing cache identity. Historical comparisons do not acquire new
claims of production equivalence. Do not run another Harness² search campaign.

#### GQ2 — Source fidelity and sufficient context

Files: x_reads.js, the existing textFromRaw reference in
x_creator_dataset_repair.js, act_reply_writer.js context input, reply_contract.js
projection, and the active XActions normalization boundary if required.

Inspect the raw-to-normalized boundary before changing it. Prefer one normalization
owner that preserves note_tweet text through the existing approved client. A local
raw-text projection can reuse the existing fetch injection if that boundary
exposes the raw data safely. If only an upstream fix can supply it, prepare that
patch and stop at the existing full-commit trust approval before executing a new
candidate with credentials. Do not edit the installed pin or upgrade dependencies
silently. Preserve legacy-only, visibility-wrapped and missing-note behavior.

Pass already observed room/thread context to the Writer with its source identity.
Pass article excerpts when making claims about the article. The Writer does not
browse. If excerpts are unavailable, omit article-specific judgments or choose a
response supported by the visible post. Do not turn every simple reaction into
an external research job. Missing media must not erase a readable caption.
Bound excerpts using the existing request/context budget, preserving source URL
and location. Mark partial coverage and omitted sections explicitly. The Writer
must not infer that an article lacks something merely because the selected
excerpt omits it. Do not silently truncate a qualifier or conclusion to fit.

Acceptance: raw and normalized text agree on the known long-post examples. The
actual Writer request contains supplied excerpts/context without asserting unseen
material. Claims of missing study evidence are not inferred from a short tweet.
Use existing saved fixtures for boundary inspection. Any trust approval remains
an explicit external boundary, not an automatic consequence of this plan.

#### GQ3 — One coherent authoring-to-publication contract

Files: act_reply_writer.js, reply_contract.js, writer_runtime.js, drafting.js,
behavior.js, agent_bridge.js, store.js, docs/REPLY_GENERATION_PROMPT_V2.md,
docs/POST_GENERATION_PROMPT.md, ops/systemd/arm/arm-growth-live.md,
growth_agent_runner.js, and UI types only if the public payload changes.

Keep this task inline or under one scoped implementation owner. These files share
mutable interfaces and must not be delegated in parallel.

- Separate human direction, observed evidence and executor suggestions in the
  actual packet. Remove the command to realize an executor-authored thesis.
  GLM returns its selected behavior using the existing vocabulary. Validate the
  raw returned enum values before normalization can supply defaults. Invalid or
  missing required values return a preparation error. Do not silently choose
  neutral, synthesis or judgment. This validates metadata, not writing style.
  Persist the valid selected behavior with the selected text before gates inspect it.
  In profile mode, replace the proposed packet behavior with this selected behavior
  before applyWriterOutput, draftReviewContext, reviewWriterOutput, quality scoring
  and purpose/health/policy gates. The saved draft/editor and corresponding queue
  context must agree. The selected purpose still has to satisfy existing grants.
  Profile-mode act loads saved behavior together with saved text. Omission of a
  caller behavior uses the saved value. A caller value that differs after existing
  normalization is rejected before claim or browser work. Forward only that saved
  behavior to all downstream gates. Do not change global caller precedence for
  unrelated non-profile/manual paths as a shortcut.
- Keep the two-candidate v2 procedure. Use one structured output specification.
  Put candidate texts/checks/selection in an explicit audit structure that permits
  exact selected-text extraction. Migrate replyReview consumers in the same slice.
  Do not require a downstream parser to infer a selected candidate from prose.
  Do not make substring containment a semantic-correctness guarantee.
- Load the reported “fun.Usu” boundary artifacts if retained. Compare raw output,
  selected candidate and final text. Reject an inconsistent selected output as
  preparation failure. Do not silently trim suspicious suffixes or reorder schema
  properties while claiming a causal fix. Genuine extra commentary is returned as
  an error, not posted. Preserve legitimate Unicode, punctuation and examples.
- Save generation text, behavior, Writer execution and target context through
  existing draft facilities. Return the saved generation reference. In profile
  mode, omission, another target's reference or altered text cannot authorize act.
  A valid reference proves only the recorded generation, not hidden provider routing.
- Require profile-mode Quote text to use its current reviewed saved draft. Check
  the exact review and content before claimActPublication, within the existing
  transactional claim boundary. Preserve duplicate and uncertain-send fences.
- Retain deliberate one-call self-review for direct Replies. Describe it honestly.
  Keep existing independent review for Originals, Threads and the selected reviewed
  Quote route. Do not add a new routine Reply reviewer or allow caller-supplied
  checks to mint approval.

Acceptance: captured inputs no longer order the Chrome denominator critique or
assert that outages coincide with scaling spikes. The chosen typed behavior and
public text agree. An executor-suggested judgment followed by GLM-selected
celebration is saved, scored, reviewed and checked as celebration throughout.
Supplying the old judgment in a caller context is rejected rather than silently
winning at a downstream gate. The send path consumes the saved exact selected
text. Changing text/target or omitting the required reference fails before a
claim or browser mutation. Current reviewed Quote text can reach its existing claim path while a
failed/stale review cannot. Nothing sends during these checks.

#### GQ4 — Unpublished output acceptance with Terra support

Files/artifacts: existing evaluation helper, saved failure cases, the peer-reply
experiment directory and the existing integration/failure reports. Add a new run
subdirectory for new outputs, not another benchmark framework.

Use GLM 5.3 max on the repaired real request path. Keep the original failed outputs
as the baseline. No fresh baseline generation is needed. Initial proposed budget:
six GLM invocations, one each for Chrome, Redis, invited technical advice, a direct
question, a social celebration and insufficient context. These are scenario bounds,
not quotas or a statistical reliability estimate. No call runs during planning.

Terra 6.1 Medium supplies unpublished reference responses and evaluates the exact
source/context/output. It sees actual output, not only the Writer's self-check.
Assess social fit, meaning, factual support, usefulness, first-read clarity and
Hamza's adaptive personality requirement above. Accurate but lifeless or wrongly
patronizing output does not pass solely because every factual claim is supported.
Allow criticism when invited or warranted. Allow strong excitement without claiming
humans could never find the bugs. Do not penalize humor, shortness, questions or
silence by form. Do not treat agreement with Terra's wording as acceptance.

For the two failures, require removal of the imposed critique and unsupported
causal assertions. Do not require one particular replacement sentence. Include
at least one supplied correct technical answer to detect over-conservative grading.
The parent inspects exact objections and Hamza's explicit preferences. Terra can
return pass, fail or uncertain with a cited span. Uncertain is unresolved evidence,
not automatic rejection of all creative writing and not a pass.

Acceptance: Terra finds no material unsupported claim or inappropriate prescribed
act on that bounded set, and the parent checks its reasoning. Hamza's contrary
judgment remains decisive. This is offline readiness for owner review, not proof
of unattended quality. If the same defect survives two repair attempts, stop and
use the existing raw evidence for one fresh diagnosis. Do not append more rules.

#### GQ5 — Durable operation and truthful diagnostics

Files: ops/attached_live_session.mjs, growth_agent_runner.js,
ops/systemd/arm/arm-growth-live.md, ops/systemd/README.md,
ops/systemd/arm/arm-growth-live.sh only if lifecycle evidence requires it,
and agent_bridge.js response documentation.

Read actual provider failure and exit records. Preserve selected models and report
usage exhaustion distinctly. Reuse existing scheduling/backoff facilities. Prevent
an exhausted provider from causing repeated costly launches. Do not install a new
supervisor, retry an uncertain send or substitute a different model. The operator
must not claim a 30-minute limit elapsed after 13 minutes based on model narration.
Use actual launcher timestamps, run deadlines and bridge recommendations.

Read disposition fields as candidateKey and disposition.state. Keep actual errors
and exit status. Do not synthesize ok:true from a null projection. Do not repair
a nonexistent orphan mechanism. Keep exact target cleanup and current run recovery.
Run shellcheck only if a shell script changes, as repository policy requires.

Acceptance: a bounded local nonpublishing failure exercise shows truthful failure,
exact cleanup and no second send/model substitution. Saved elapsed-time evidence
accounts for early finish. Timer/service state is reported separately from whether
a Growth Run is active or any output was published. Public operation stays stopped.

#### GQ6 — Measurement and unresolved-history recovery

Files: existing analytics/measurement bridge handlers, growth_analytics_runner.js,
docs/ANALYTICS_COLLECTOR_ACCEPTANCE_2026-10-28.md, and supported state APIs.
Only change collection code if a current defect is demonstrated.

Re-read current due measurements and closed-unresolved attempts through the bridge.
Associate every record with its real ID, target, time and outcome. Capture only
measurements the existing authenticated route can actually observe, preserving
unknowns. A count alone does not establish that every recent result is missing.
Closed-unresolved is not a retry queue. Reconcile only when exact new evidence
exists. Keep unresolved records when the outcome cannot be established.

Acceptance: a report separates measured, due, inaccessible, reconciled and still
unknown records. No missing result becomes zero, no follower delta becomes causal
proof and no old write is retried. Operational failure to collect remains visible.

#### GQ7 — Documentation and low-risk maintenance closure

Files: docs/AGENT_WORKFLOW.md, docs/GROWTH_REPLY_BENCHMARK.md,
docs/ARM_24X7_HANDOFF.md, ops/systemd/README.md, affected active prompt docs,
this plan, TASKS.md and the issue inventory docs/X_GROWTH_ISSUES.md.

Use actual function names, attempt identities and role settings. Label historical
reports instead of rewriting their results as current. Update stale model lock,
schema/review descriptions and evaluation claims. Session prefixes can become
model-neutral when no session is active. Existing defaults remain explicit defaults,
not evidence that production used them. Ignored host backup files are not deleted
as part of an unrelated repair. Never remove private backups or state.

Acceptance: current docs point to one active contract and actual public commands.
Every supplied issue has a disposition and supporting evidence. Refuted explanations
are marked refuted, hypotheses remain hypotheses and historical artifacts retain
provenance. No cosmetic change is called a writing-quality repair.

#### GQ-R — Final Terra evaluation and integration

Review the final coherent diff and artifact manifest once, using Terra 6.1 Medium.
Its evidence matrix must cover GQ1–GQ7, required authority boundaries and uncovered
live behavior. Parent reviews sensitive claim-boundary changes immediately within
GQ3 rather than postponing that check. One independent final graph review replaces
per-file or per-task review dispatches. Fix small findings inline in one round.
A recheck is a new T3 delegate task, not a hidden continuation or model switch.

Acceptance: Terra reports no unresolved blocker for the proposed delivery scope,
the parent verifies each acceptance record, and the ledger uses review, never done.
A design pass is not an output-quality pass. A code pass is not production acceptance.
Commit and push only the accepted scoped changes, with accurate uncovered limits.

#### GQ-L — Owner-approved live observation, held

No current step starts the service or enables the timer. After offline acceptance,
show the actual proposed live configuration and remaining limits. A new explicit
owner instruction must authorize a bounded live observation after the stop request.
Use the existing single operator, run lease, policy, claims and reconciliation.
Counts are upper bounds, never activity targets. Terra can assess the resulting
source/output records afterward without controlling or duplicating public sends.

Acceptance: confirm actual model receipts, unchanged selected output, public URLs,
run/lease finish and owned-tab cleanup. Record owner acceptance or rejection of
real replies. Public rejection reopens the content task even if all mechanical
checks pass. “Ready for continuous operation” needs observed outcomes, not merely
an active timer. No plan, reviewer or worker can grant itself resume authority.

### Budget, order and stopping

Planning budget: one Terra Medium evidence collector (completed) and one Terra
Medium plan evaluator. The evaluator may provide unpublished reference responses
for the two supplied failures, without external collection or model switching.
No implementation worker, production model call or test execution is authorized
by this plan-writing turn.

Proposed later execution budget: up to six GLM output captures in GQ4 and up to
four Terra Medium support/evaluation dispatches: input/evaluation evidence check,
output acceptance/reference review, final graph review, and one recheck if needed.
Record IDs and receipts in TASKS.md. The graph must receive execution authority
before these budgets become active. If a budget ends, stop with unmet evidence
rather than inventing success or adding more workers. No new provider dependency
is required for normal production writing after this repair.

Dependency order is GQ0 → GQ1 → GQ2 → GQ3 → GQ4 → GQ5 → GQ6 → GQ7 → GQ-R.
GQ-L remains held by the owner's stop request. Shared-file changes stay sequential.
At every step, append actual evidence and mark review before moving to the next
ready node. Only Hamza marks done. This plan has not repaired the implementation.

### Terra evidence and plan evaluation record

Support/evaluation model: gpt-6.1-terra, reasoningEffort=medium throughout.
Evidence collection task: ca4c20da-e74c-4da1-abf1-2b1f236e462f.
Plan evaluation task: f606ce6b-f1a1-4d9f-9b29-ddd9f910961f.
Full T3 task IDs are recorded in TASKS.md.

Terra returned NEEDS_REVISION for one blocking ambiguity: caller-supplied behavior
could still override GLM's selected behavior in downstream validation, scoring
and review contexts. The parent checked applyWriterOutput and the caller-first
behavior expressions in drafting.js, then amended GQ3 to require the saved Writer
behavior throughout profile-mode review and claim, rejecting conflicting caller
values. GQ3 acceptance now includes that exact celebration-versus-judgment case.
This was a plan correction only. No runtime behavior is repaired by the amendment.

Other Terra findings were nonblocking limits: the diagnosis covers these examples,
six outputs cannot establish general reliability, reviewed Quote integration must
be checked at implementation, backlog access may remain limited, and a plan review
neither establishes runtime correctness nor authorizes public restart. The plan
retains each limit. No second independent pass on the amended plan is claimed.

Terra's unpublished reference examples, retained as illustrations rather than
production output, gold labels or quality measurements:

- Chrome: “Wow. Chaining four bugs into a sandbox escape is a striking
  demonstration of what these models can do.”
- Redis: “That's a tricky fallback. How are you estimating the live gateway count
  when autoscaling changes it?”

These examples do not become required templates. Hamza may prefer more excitement,
a different reaction or silence. Later acceptance evaluates actual source/output
fit rather than similarity to a reference sentence.

### Reception of the independent review of 767aaba

The supplied review supports the direction but is not an executed implementation
check. Its duration alone neither validates nor discredits its findings.
The parent compares its claims with the actual plan and current code:

- Accept the need to reject invalid Writer behavior values before normalization
  applies defaults. GQ3 now states that boundary explicitly.
- Accept bounded article excerpts with explicit partial-coverage indicators, using
  the existing request budget. GQ2 now states that requirement. Excerpts alone do
  not prove the Writer will preserve meaning.
- Keep GQ3 as one coherent shared-interface slice, as already specified.
- Reject an added candidate-hash requirement: the plan uses saved exact text and
  existing publication records, without new cryptographic tracking.
- Correct “race condition”: caller-first behavior precedence can cause the mismatch
  deterministically. Concurrency is not established as its cause.
- Correct “guarantees,” “airtight” and “eliminates corruption”: these are intended
  invariants awaiting implementation evidence, not results of plan review.
- Correct “no new schema”: the existing behavioral vocabulary stays, but structured
  candidate audits and Writer-selected behavior do require a coordinated payload
  change. Callers must migrate together.
- Do not adopt the claim that cached Harness² passes actually hid prior behavior
  changes without the corresponding run evidence. The confirmed defect is stale
  contract loading/fingerprinting and the resulting risk of invalid comparisons.
- Correct budget attribution: GQ4 proposes six GLM generation captures. Terra
  support/evaluation has its own bounded dispatch budget.
- Provider quota handling is an operational task. Free-tier exhaustion does not
  establish a writing defect and does not authorize a hidden provider/model switch.

No source code, production prompts, model settings, tests or public actions change
as part of receiving this review. The operator and timer stay stopped. These
clarifications improve the plan, not the claimed state of the implementation.
