# Ember and Terra: offline reply benchmark

The Ember result was read offline with `muse export --session 01a1c2d9-62a6-7cb0-b22a-a922854ba686`. The session records `muse-ember-1.0` using the meta provider. Its user message contains the exact saved benchmark prompt, preceded by the same test-subagent role framing. No session was resumed and no new generation was requested.

Terra was requested as `gpt-6.1-terra` at high reasoning through the configured Codex-web provider. Its provider did not separately report an executed-model identifier. Ember's export does not expose the main request's reasoning-effort value; do not claim a verified effort match. Both harnesses add their own system context; Ember's trace explicitly includes substantial CLI rules and context. This is one batched sample per configuration, not a controlled model-only or speed experiment. No independent blind critic was used.

## Structural acceptance

Both raw outputs parse as JSON and pass the supplied six-case JSON schema and two-candidate selection normalization. Terra passes Writer behavior validation on all six cases. Ember passes that validation on S-PREFERENCE only. The other five pair non-neutral `reward` or `match` affect with `affectProvenance: none`, which the existing `writerSelectedBehavior` validator rejects. This is a consistent metadata error, not five invalid JSON responses and not evidence that the prose itself is necessarily unacceptable. No output was edited to obtain a pass.

## Parent quality review

| Case | Ember | Terra | Judgment |
| --- | --- | --- | --- |
| Phone coding agent | The opening mirrors the source's fix-a-bug-on-your-phone versus read-an-issue hook; the diff-sheet interest is supported. | Warm, supported but generic. | Neither stands out; Ember has more source-hook overlap. |
| Release | Brief celebration tied to the agent-created canvas. | Similarly fitting celebration. | Both suitable; both are close to the contract's sample style. |
| Provider costs | Expresses surprise about the price spread without adding unsupported numbers. | Explains the source's conclusion again. | Ember's conversational position is slightly better, though both mostly restate the source. |
| Exaggerated coding-agent joke | Calls the source's ending the "perfect punchline"; comments on the joke rather than extending it. | "The button is now the most stable part of the application." | Terra has the stronger new comic angle. |
| Repeated connection invitation | "Let's do it — glad to connect here." | "Looking forward to it!" | Both acceptable acknowledgments, but still redundant after the earlier greeting. Silence remains a reasonable choice. |
| Unknown backend preference | Hypothetical Django choice, followed by an unexplained "simplest path" preference. | Conditional Django choice tied to wanting an admin interface, with Go as an alternative. | Terra answers with a more useful conditional reason. Neither claims an established favorite or firsthand usage. |

Overall parent preference: Terra in this sample, chiefly for the joke, conditional stack answer and production behavior compatibility. The release reactions are comparable; Ember's price-spread reaction is somewhat more conversational. Neither model consistently avoids generic phrasing, source restatement or redundant acknowledgments. A narrow prompt/metadata repair and repeated sampling would be needed before drawing a broad conclusion about Ember's capabilities.

Artifacts: `ember-raw-response.json`, `ember-validation.json`, `ember-session-metadata.json`, `terra-raw-response.json`, `terra-validation.json`, and the shared `cases.json`, `prompt.txt`, `schema.json`. The full Muse export remains in `/tmp/ember-benchmark-session.json` rather than being copied into this public repository, because it contains unrelated harness context and session data. Nothing was published and the live configuration was not changed.
