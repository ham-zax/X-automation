# Growth context recovery

At startup, after every context compaction, and when resuming with incomplete
history, complete this recovery before drafting or dispatching a public action.
Chat summaries are working notes; Growth OS and live observations own truth.

1. Read `operator-status`. Reload `persona-model` with `{"consumer":"writer"}`
   even if it was read before compaction. Use the returned identity, voice,
   language, affect, examples, daily tone and current stances for new wording.
2. Recover the current `runId` and `sessionId` from the checkpoint and bridge
   state. Read `growth-run-status` for that run; resume an active run through
   `growth-run-resume` with the actual adapter/session and truthful capabilities
   to revalidate delegation and the operator lease. Do not start a new run,
   reset ceilings, or reuse a foreign claim because context was compacted.
   If IDs cannot be established or resume is rejected, stop public writes and
   report the blocker. Then read `growth-run-next`.
3. Inspect `publication-attempts` for unfinished work. Reconcile any uncertain
   send before continuing; never resend it. Use the existing attempt identity
   and the recovery instructions in `docs/GROWTH_AGENT_EXECUTION.md`.
4. Recover the selected candidate with `inspect`/`workflow` when saved, plus
   relevant `relationship-inspect` history. Preserve existing drafts and exact
   authority. If selection was not saved, select again from current state
   instead of inventing missing context. Re-observe the intended X account,
   exact source/thread and composer before any subsequent public mutation;
   discard old browser refs. Apply the current mode's claim/send protocol.

When producing a compaction checkpoint, preserve the owner request and bounds,
run/session IDs, selected candidate/target, draft and attempt IDs with states,
last confirmed outcomes, blockers and next operation. Include the active
persona version and this recovery document's path. Reload durable state on
return; a progress sentence or prepared draft is not a completed public action.
