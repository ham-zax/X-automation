# DeepSeek current Writer flow test — 2 November 2026

Model: deepseek/deepseek-flash, OpenCode, variant max. Three separate calls received the current captured Writer prompt, persona packet and output schema through T3. This uses eval/growth_reply.mjs in disposable state. It tests generation and output application, not the configured provider adapter, persistence/claim/send path or a live Growth Run. Production role bindings were not changed. The operator was not started.

Preparation: VA-16, VA-14 and VA-18 prepared. VA-13 failed before any model call: Invalid explicit behavior decision: ACT requires primaryPurpose, socialMode and informationDepth. The fixture was not modified.

All three generated outputs passed the existing structured schema and evidence-reference validation. applyWriterOutput completed through the inspection helper. Both candidates contain 16 checks. All outputs selected POST. Independent diagnostic review was not run. Thus diagnosticStatus=blocked for absent review output is expected and is not a model verdict. publicationAuthority=false throughout.

## Selected outputs and parent review

VA-16 AndroidHarness:
> The diff sheets and recorded check outcomes are the part I'd actually use. Seeing what the agent did inside the chat beats guessing in another window.

The feature reference is grounded. The comparison with guessing in another window is less grounded and makes the reaction somewhat evaluative. It is a preference rather than a proven usage claim.

VA-14 CodeAlta release:
> Congrats on the CodeAlta 1.6.0 release! The plugin that lets an agent create a Canvas is the feature that catches my eye.

This is the strongest of these three: a concrete, supported celebratory reaction without invented experience or a prescribed task.

VA-18 Artificial Analysis:
> The ~9x spread is wild. Does Cost per Task include retries and failed tool calls, or only successful runs?

A plausible scope question. The source explains standardizing token counts from an Intelligence Index run; it does not explicitly settle retry accounting. The final selection reason still favors a technical question as a stronger reason to reply over a complete reaction. That preference deserves further observation, not an automatic fail.

## Limits

One sample per source, no blind reviewer, fixture inputs, no browser or full thread context, and no published recipient outcomes. Current results cannot establish production readiness or numerical improvement against earlier fictional-post tests. The whole benchmark is not ready because one fixture fails preparation.

Full requests, packets, raw model JSON, diagnostic requests and inspection receipts are under /tmp/deepseek-current-flow-20261102/{VA-16,VA-14,VA-18}/.

