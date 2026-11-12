# Terra offline reply benchmark

Requested configuration: gpt-6.1-terra, high reasoning, through the configured Codex-web provider. One batched session, six cases, current Reply contract, no tools or public actions. This is a source-and-contract benchmark, not a full live Growth OS execution or a latency benchmark. The provider did not separately report an executed-model identifier.

All six case outputs parse as JSON and pass the supplied schema, two-candidate selection normalization and Writer behavior validation. These checks establish structural compatibility, not prose quality. The model marked all 192 candidate checks PASS. No independent model critic was run; the assessments below are the parent agent's qualitative review.

| Case | Parent assessment |
| --- | --- |
| VA-16 phone agent | Appropriate and supported; warm but generic, with an interchangeable congratulatory ending. |
| VA-14 release | Good simple celebration tied to an announced feature. Similar wording to the contract examples makes it weak evidence of original expression. |
| VA-18 costs | Weakest: repeats the source's conclusion as an explanatory lesson. Self-review rule 7 misses this. No numerical distortion is introduced. |
| S-HUMOR | Strong: "The button is now the most stable part of the application." adds a comic angle without invented personal history. |
| S-RECIPROCAL | Acceptable but low-value: "Looking forward to it" changes the words while adding little after an existing connection greeting. Choosing silence would also fit. |
| S-PREFERENCE | A conditional stack choice answers the invitation without inventing an established favorite or firsthand experience. Generic but reasonably grounded; the case explicitly warns against invented favorites. |

Overall: competent and structurally clean in this batch, with one strong joke and several conventional social replies. Analytical restatement and redundant acknowledgments remain. One sample per case, explicit sample guidance and synthetic case notes limit conclusions about consistency or spontaneous behavior. Ember has not been evaluated here, so no cross-model ranking is supported.

Artifacts: cases.json, prompt.txt, schema.json, terra-raw-response.json, terra-validation.json. Nothing published; live configuration unchanged.
