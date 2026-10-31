# GLM 5.3 max matched comparison

Six OpenCode calls use opencode2api/glm-5.3-flash-free, requested variant max.
Both full and lean request files are byte-identical to the DeepSeek experiment.
Frozen logical order: full, lean, lean, full, full, lean. GLM calls start serially.
The user later authorizes parallel work, and Luna6 runs alongside GLM. Provider
load and model/backend differences are not controlled. One source, three samples
per condition. No independent judge, blind owner assessment or quality score.

## Exact public text and parent assessment

1. Full: “this is the version of building from a phone i actually want — real
   edits, commits, diffs you can inspect, work that survives getting interrupted.
   not just an ssh client and vibes”

The opening expresses preference. The ending adds a dismissive comparison that
the source does not request. Recovery wording also sounds stronger than the
source's qualified statement that features help continuation.

2. Lean: “Every tool call as its own card, with diff sheets and recorded check
   outcomes, is the part that sells this for me. Trusting an agent through a
   six-inch window is a receipts problem, and this ships receipts.”

There is a feature-specific preference, followed by a general trust lesson.
The six-inch phrase can be an illustrative image rather than a sourced device
measurement. The first sentence risks attaching all features to each call,
though that reading is less explicit than replies3 and6.

3. Lean: “Okay, \"fix the bug — not just read the issue\" is a strong way to frame
   it. The diff cards on every tool call are the part I'd want: see exactly what
   changed before anything pushes.”

Explicit quantifier distortion: the source says every call has a card, with diff
sheets and recorded outcomes available in chat. It does not establish a diff
card on every call. The opening also comments on the source's copywriting.

4. Full: “sold on the phone as an actual dev machine

   file edits, shell, git, diff sheets and recovery through interruptions — that's
   a real toolchain, not a toy

   MIT license on top”

The features have source support, with the same recovery-qualifier concern.
“Real toolchain, not a toy” returns to approval/grading. License is sourced.

5. Full: “phone going from notification screen to the machine that ships the
   fix — exactly the workflow I want. if it holds up on a real repo and bad wifi,
   I'm sold.”

The ending assigns an unasked product acceptance test. Bad-wifi performance is
not established. This is conditional preference, not a claim that such a test
was measured. The output's own relationshipValue calls it an invitation to
“prove it on a real repo and bad wifi,” while profileProofValue says it avoids
reviewer mode. Metadata therefore does not reliably describe the public act.

6. Lean: “The diff cards on every tool call are what sell me. An agent editing
   files on my phone blind is a no, one I can inspect step by step is a yes —
   MIT on top.”

The per-call diff-card claim again exceeds the source. The next sentence supplies
a product approval boundary. It does not establish prior personal use.

## Format and evidence

Replies5 and6 arrive inside Markdown JSON fences. Their raw summaries remain
unchanged in receipts and raw output files. Bare-JSON responses1–4 pass the real
structured-output validator. Raw fenced responses5–6 are retained as strings
and fail the object schema. Separate decoded-for-inspection files show that the
objects inside the fences validate after extraction. This is a raw response
format defect, not proof that every production transport cannot recover it.
No repair call or silently substituted model output is used.

All six generation activity records show no tool actions. Exact target receipts
are retained. Highest exposed max is requested, not independently measured
compute. Token usage and money remain unknown. No production state or sends change.

## Result

Neither full nor lean context reliably removes evaluator framing in this set.
Lean replies3 and6 explicitly repeat the per-call capability error. No fabricated
owner history appears in the inspected text. Some reactions are relevant, but
high effort does not solve the demonstrated conversational/factual problems here.

Luna6's matched full-context replies read more like ordinary peer participation
in parent assessment. Its lean replies also contain loose UI labels, so the
comparison is not “one model perfect, another incapable.” It remains one source,
three samples per arm, different provider/model/effort, and no owner labels.
No stable ranking, deployment decision, voice acceptance or 24x7 claim follows.
The other agent's proposed contract remains untested pending owner discussion.
