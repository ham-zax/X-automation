# Terra medium comparison, 29 October 2026

Hamza requests GPT-6.1 Terra at medium effort after the DeepSeek pilot.
The fifth dispatch completes. All five evaluation dispatches are now consumed.
XR-14 stays in-progress. No production setting changes.

## Method

Use the exact original baseline task, including its recorded final newline.
The task hash matches the earlier DeepSeek baseline. Persona, source text,
instructions, cases, and output contract stay identical. The model, provider,
and reasoning option change together. This comparison cannot isolate model
weights from provider or effort differences.

T3 reports Codex `gpt-6.1-terra` with `reasoningEffort=medium`.
The reference uses OpenCode `opencode2api/deepseek-v4.1-flash-free`, variant max.
Each model supplies one sample for each of four calibration cases. There is no
repeated sample, blind human rating, production Writer review, or reserved-case run.
Usage and cost remain unknown. The 18 reserved cases remain unused.

## Findings

- VA-03: Terra skips the guide share. DeepSeek writes a general credential lesson.
  Silence is allowed. The skip avoids that lesson but does not show a better reply.
- VA-14: Terra congratulates the release and notices the agent-created canvas.
  The reply fits, but its praise is generic. The DeepSeek celebration already works.
- VA-16: Terra reacts to recovery after an interruption. It does not dismiss other
  apps or invent another implementation test. Its phrase "real workflow" still
  evaluates the feature, but the reply is less dismissive in the parent's judgment.
- VA-21: Terra chooses permission escalation and explains the consequence. It gives
  one answer to the invited question without the reference's broad no-undo claim.

Terra looks closer to the owner's stated direction in this small sample. That is
a parent assessment, not owner acceptance or evidence of stable model superiority.
The result supports testing the actual target model before more prompt edits.
It does not establish that DeepSeek cannot improve or that Terra solves every case.

## Exact outputs

VA-03: skip.

VA-14:

> agent-created canvases are a fun addition. congrats on 1.6!

VA-16:

> fixing a bug from your phone is cool. being able to pick the task back up after an interruption makes it feel like a real workflow.

VA-21:

> Grant itself new permissions. A mistake gets a lot more expensive when the agent can expand its own access.

## Evidence and boundary

`result.json` records exact returned text and reported model settings.
`manifest.json` records request reconstruction, authority, and dispatch accounting.
`comparison.html` pairs the outputs with the same sources. The earlier pilot's
artifacts remain unchanged. Its unused-slot statement describes its earlier stop.
TASKS.md and this continuation record consumption of that fifth slot.

No reply is published. No queue, persona, policy, service, timer, or production model
changes. The local artifact checks do not establish a successful writing repair.
