# Growth Agent execution and recovery

Use this operational checklist in normal Live runs. All IDs, text, provenance,
and authority below come from current bridge results. Never manufacture them.
Use `npm run --silent agent -- COMMAND` with JSON on stdin. Read the complete
result after the command exits; an `error` field means failure even if a shell
pipeline hid the exit code.

## Resume work before discovery

Read `operator-status`, begin/resume the run and inspect `growth-run-next`.
An executable `next.claim` outranks collecting another feed sample. Inspect
existing drafts rather than rebuilding them. A previously attempted send with
an unknown outcome is reconciliation work, never retryable preparation.
Read `queue` with `{"status":"needs_review","limit":10}` and
`{"status":"drafting","limit":10}` before collecting more sources. Match
`queueItems[].draftId` to `drafts[].id` (or inspect `workflow` with the candidate
key). Review a complete, current, purposeful saved draft through the sequence
below before starting another from scratch. No approved claim does not mean
there is no prepared work.

For Windows, run `node ops/windows-dialog-recovery.mjs --dismiss` before the
first observation and when navigation stalls. It only cancels native Leave
site dialogs in the WebHarness profile. Re-observe afterward. A page snapshot
does not prove a native dialog is absent.

## Recover an unfinished publication

When `next.recommendedOperation` is `recover_attempt`, use `next.recovery`:
it names active attempts and the read command. Absence of `next.claim` is
expected here. Do not exit merely because no new claim is offered.
Read the complete `publication-attempts` result and the originating run.
An attempt owned by another run/session cannot be sent under this session.

Use `publication-attempt-resolve` with `attemptId`, `state`, `reason`, and
`evidence` to reconcile it. `confirmed_not_sent` requires
`evidence.sendBoundaryCrossed: false` and an actual `evidence.notSentProof`
with `kind: "mutation_not_dispatched"` or `"transport_rejected"` plus a
concrete `detail`. A null send timestamp, an open composer, or missing output
alone is insufficient. If recovery cannot establish the outcome, use
`closed_unresolved` with evidence of the checks performed and their limits.
Positive exact publication evidence uses `record-action` instead. Re-read
`growth-run-next` after resolution. Never blind-retry the old attempt.

Complete the durable run with `growth-run-finish` before your final response.
A final sentence such as “checking the queue next” ends the headless model
turn; it does not schedule another tool call. Execute the next supported tool
now, or finish with a concrete blocker and the evidence gathered.

## Browser action selection

Parse the JSON result first: the accessibility tree is the decoded `snapshot`
string and `refs` contains current semantic controls. Do not search byte offsets
in escaped raw JSON. After a tab-not-found error, observe the actual tab list
and use its `tab_id`/`target_id`; never reuse an obsolete tab ID.

On an exact live X source, Quote is normally inside the **Repost** menu.
Select the source article's current button named “N reposts. Repost”, observe
the opened menu, then choose its current Quote item. Share and More are
different menus. Verify the quote composer embeds the exact claimed source
and contains the exact approved text before send-start and one Post click.
Navigation/menu opening is preparation, not a completed public action.

## Main-feed text preparation

1. Inspect the saved candidate/workflow and exact live source. Select current
   purpose/behavior and route to Original, Quote, or Thread. Preserve source
   identity. Reopen a stale approved draft using `update-draft` with its `id`
   and `status: "draft"` before editing.
2. Call `writing-strategy-select` with **only** the delegated contract:

   ```json
   {
     "queueItemId": "replace with persisted numeric queue ID",
     "draftId": "replace with persisted numeric draft ID",
     "selectedBy": "mission_agent",
     "grantRevision": "replace with current numeric delegation revision"
   }
   ```

   Substitute numbers, not these example strings. This path computes fresh
   deterministic guidance itself; no option means explicit `off`, not a
   publication blocker. Do not set `confirmSelect`, `selectionSource`,
   `intent`, `style`, or a guessed guidance snapshot. Those belong to the
   separate human lane. `writing-strategy` only previews; `mode: "apply"`
   passed to that read command cannot save a selection.
3. Obtain a fresh `writer-packet` with the candidate `key`. Apply its Writer
   contract to produce complete content. Call `apply-writer-output` with the
   draft `id`, the **unchanged returned `generation` object**, and structured
   `output` matching the packet pipeline. See AGENT_WORKFLOW.md for its schema.
   A strategy selection or draft edit invalidates an older packet. Do not
   replay stale generation or copy unrelated evidence IDs.
4. Call `update-draft` with the draft `id` and `status: "ready"`. This requests
   review and returns `needs_review`; it does not authorize publication.
   Inspect deterministic content, persona, provenance and quality gates.
5. If current gates pass, call `mission-approve` with the candidate `key`,
   current `runId`, `sessionId`, `grantRevision`, and `verificationProvenance`
   containing `authorityType: "mission_agent"`, exact `sourceReferences`, and
   only evidence references actually used. Never set human approval fields.
6. Re-read `growth-run-next`. Claim its exact eligible queue row using
   `browser-publish-claim` with `queueItemId`, `runId`, `sessionId`. Re-observe
   the exact tab/source. Record `publication-attempt-send-start` using its
   `attemptId`, send once, verify exact public content and route structure,
   then `record-action` with that same attempt and positive verification.
   Uncertain outcomes stay investigating or closed unresolved.

The supported automatic preparation operation is `growth-run-next` with
`{"runId":"current run ID","operation":"prepare_main_feed"}` when listed
in `next.permittedOperations`. There is no standalone `prepare_main_feed`
bridge command. Inspect `operationResult`; preparation is not publication. An
`action: "needs_revision"` result preserves the candidate and draft after
approval rejection and returns `repair.command`, `repair.payload` and the exact
error. Execute that fresh Writer-packet repair before another scan. Do not
repeat unchanged preparation/approval or label repairable content as an empty
opportunity set.

## Discovery and contract errors

- For `x-for-you-ingest`, include top-level `observedAt`: actual observation
  time in Unix milliseconds as a positive safe integer. It is distinct from
  each post's publication `timestamp`. Capture it with `date +%s%3N` alongside
  the observation. Retain exact observed source IDs,
  URLs, text, rank and account/run/session provenance. Inspect both
  `ingest.diagnostics` and `engagement.rejections` after the call.
- Empty `growth-next.items` is a valid result. Never index `items[0]` without
  checking length. Use current run operations and existing drafts; collect
  again only when the current run permits it and the earlier set is handled.
- An explicit-human-selection error means the wrong lane was called. Use
  `selectedBy: "mission_agent"`; do not invent owner confirmation.
- An editorial “already linked to primary source” error protects provenance.
  Inspect and advance that existing queue item through the text path above,
  or choose another candidate. Never relink sources to silence the error or
  repeat unchanged automatic preparation.
- `CONTENT_FACTUAL_REVIEW_FAILED` with “An unverified source claim must be
  explicitly attributed” requires a text repair, not a bypass. Name the
  source and use a clear attribution such as “Atomic Chat reports …”; “they
  measured …” is insufficient. Keep reported values distinct from results
  Hamza independently reproduced. Obtain a fresh Writer packet, review the
  revised exact claim against its exact source excerpt, and apply complete
  output with a fresh contentReview. Old review issues remain failures if
  copied into the revised output; resolve them through an actual text/evidence
  correction before requesting review again.
- Reply expiry means that reply is ineligible. A purposeful, grounded Quote
  or Original remains a separate option; do not fabricate freshness.
- After a documented repair fails, retain the exact error, candidate and
  operation. Move to another eligible candidate or finish blocked. Do not
  guess field names, refresh recommendation snapshots repeatedly, or hide
  errors under a new browsing loop.

Finish with confirmed public actions, prepared work, skips, exact blockers,
and uncertain attempts reported separately. Running is not evidence of output.
