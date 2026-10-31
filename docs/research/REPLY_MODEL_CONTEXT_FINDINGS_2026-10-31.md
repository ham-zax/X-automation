# Reply content findings before implementation

This document records parent assessments of actual reply text. Markdown, fences
and output formatting do not reduce the content assessment. Separate protocol
checks remain available in each raw experiment. No model is selected for deployment.

## Goal and evaluation

The target is a technical builder participating as a peer. A useful reply can
react, ask, answer, disagree, joke or support. It need not prove account value or
assign an author a product acceptance test. Relevant technical depth remains valid.
Assess conversational fit separately from unsupported facts and owner biography.

## DeepSeek V4.1 max

Full context repeatedly produces a decisive test: phone coding “only counts”
under an inspection condition, competing apps supposedly skip the important part,
or recovery makes the product “more than a demo.” Some claims exceed the source.

Lean context produces one closer peer reaction: “Fixing the bug from the phone
instead of only reading the issue is the part I want.” Other lean samples still
say phone coding “only works” under a condition or rank inspection above the idea.
Subtraction helps some outputs, but does not establish a reliable fix. A prior
short-prompt trial also shows steerability alongside factual drift.

## Luna 5.6 max

Full context gives simple reactions such as “A phone as a real coding workstation
is a wild idea. Love it.” Those replies participate without inventing a test.
Some praise is generic. Lean replies more often explain inspectability or rank it
above phone work. Lean is not clearly better for this model in this set.

## Luna 6 max

Full context gives preferences and interested reactions: “I’m much more interested
in phones as tools for making things than as another place to monitor them.”
Another says Android in the coding workflow is “a fun idea.” No explicit imposed
product test appears in these samples. Natural wording does not prove every reply
adds value, and some are generic or echo the source's framing.

Lean replies remain conversational, with more feature acknowledgment. Some call
the UI “diff cards” or “diff and check cards.” The source distinguishes tool-call
cards, diff sheets and recorded outcomes. Those labels are loose, though they do
not explicitly invent per-call diff coverage as the other models sometimes do.

## GLM 5.3 max

Full replies have energy and relevant interest, but return to “a real toolchain,
not a toy” or “if it holds up on a real repo and bad wifi, I'm sold.” The latter
assigns an unasked test. Lean replies repeatedly claim diff cards on every tool
call, which the source does not establish. A trust lesson also remains. Neither
context reliably fixes the conversational or factual concerns in this set.

## What these observations mean

Both Luna versions come closer to the target on this one source in parent
assessment. The evidence is too small to choose reliably between them. DeepSeek
and GLM still need work. This is not proof that either model cannot improve.

The full packet does not force grading in every model. Prompt size alone is
therefore not a sufficient explanation. Model, provider harness, effort, content
and context interact. Lean context is a hypothesis to test, not a universal rule.
The previous lean condition changes contract, persona projection and schema
together. It does not isolate any single component. Three samples per arm, one
source, no blind owner rating and unknown usage/cost limit all conclusions.

The next proposed contract is a distinct candidate. It adds explicit conversational
and factual guidance, a different persona projection and evidenceUsed. It must not
inherit acceptance from the earlier lean experiment. Test it offline first.
The user subsequently authorizes that test. Its six-call result is mixed:
specific source wording improves, repeated explanatory takeaways remain, and
the direct answer still gives an unsupported blanket claim about transfers.
See [the candidate report](voice-audit-2026-10-31/proposed-reply-contract/REPORT.md).
Do not change production review, attribution, persona, selector or model routing
from these findings alone. The owner has not approved all illustrative replies.

## Evidence

- [DeepSeek full/lean](voice-audit-2026-10-31/lean-reply/REPORT.md)
- [Luna 5.6](voice-audit-2026-10-31/lean-reply/luna-5.6/REPORT.md)
- [Luna 6](voice-audit-2026-10-31/lean-reply/luna-6/REPORT.md)
- [GLM 5.3](voice-audit-2026-10-31/lean-reply/glm-5.3/REPORT.md)
- [Broader problem and history](GROWTH_REPLY_FRONTIER_BRIEF_2026-10-31.md)
