# Growth OS token efficiency investigation

Scope: repository inspection and one prompt optimization. No live X actions,
service changes, model changes or deployment. Local systemd has no installed
x-test-growth-agent service; local progress is dated November 5. Current
production routing and daily usage therefore remain unverified.

## Main finding

The expensive unit is the growing operator conversation, not just a Writer
call. Every additional model turn can consume the accumulated instructions,
tool outputs and previous reasoning context again. Input tokens include cached
input where the provider reports it; total input alone is not a dollar bill.

Historical evidence: docs/plans/XGROWTH_CONTEXT_BUDGET_PLAN_2026-10-13.md records
283.6M input tokens over 20 sessions and 2,187 calls, with 83% consumed after
context exceeded 100k tokens. These are prior measurements, not a new audit of
current production. Its compact bridge responses and shorter launcher have
since been implemented; repeating those proposals would duplicate existing work.

## Workflow and cost locations

Attached launcher -> full operator brief/browser contract -> operator-status,
persona and content standard -> Growth Run -> repeated five-minute discovery
blocks -> exact source/reply reads -> reply-generate -> Writer -> independent
review -> act -> reconciliation -> next block in the same conversation.

* ops/attached_live_session.mjs renders the operator brief and runs a child with
  a 45-minute process deadline. The brief requests finishing by minute 35.
* The brief template is 22,660 bytes before browser/workflow/contract expansion.
  The content standard adds 21,184 bytes when read. These are byte sizes, not
  tokenizer measurements.
* The 8,658-byte Reply contract was embedded even in profile mode, although
  writer_runtime.js supplies it independently to reply_writer. This change
  replaces the operator's redundant copy with a short provenance instruction.
  Operator writing mode retains the complete contract. No review is removed.
* reply_contract.js requires two candidates and 16 detailed checks each. This
  generates substantial structured output even for a short social reply.
  That is an existing quality contract: changing it needs a separate evaluation,
  rather than deleting checks as a token shortcut.
* Every configured AI role currently uses gpt-6-sol with high reasoning. Do not
  silently switch roles: the owner explicitly selected this operator setting.
* The attached launcher has provider-error backoff, but no token admission or
  unchanged-evidence gate before starting the model. Rest detection occurs
  inside the reasoning session after startup.
* growth_agent_runner.js calls the finite semantic controller. Its configured
  defaults bound calls and token reservations and suppress unchanged evidence.
  However semantic_controller.js explicitly lacks live collection and attached
  execution integration. It cannot replace the attached live operator today.
* The versioned base systemd service invokes growth_agent_runner.js, whereas
  attached operation uses ops/attached_live_session.mjs. Inspect installed ARM
  units and drop-ins before deciding which path to optimize or deploy.

## Highest-value next changes

1. Obtain a bounded sample of current ARM session receipts. Attribute input,
   cached input, output, reasoning, call count and prompt/output bytes by session
   and role. Count empty passes, repeated command reads, Writer retries and
   confirmed actions separately. Treat missing usage as unknown. Reuse existing
   ai_runtime telemetry and runtime logs; no direct SQLite writes.
2. Put deterministic admission before expensive operator startup. Use current
   saved policy, health, freshness and changed candidate/conversation evidence.
   Recovery and unresolved-send handling must outrank ordinary idle suppression.
   Rest watch must retain owner-authorized urgent checks. Do not launch a full
   reasoning session solely to decide that nothing changed.
3. Integrate one bounded opportunity decision with the existing guarded live
   executor, carrying only selected evidence and durable run/session/attempt
   identities. Keep collection deterministic where possible. Finish or checkpoint
   between independent decisions instead of carrying all discovery history.
   Preserve single-operator leases and never interrupt an uncertain send merely
   because a token budget expired.
4. Return compact operator-facing Writer receipts: decision, exact text,
   behavior, draft/invocation identities, review outcome and blockers. Keep full
   audit details durable and available explicitly. Inspect actual response sizes
   first to establish which commands still expose bulky review packets.
5. Evaluate smaller routing models or reduced review verbosity offline only
   after the workflow savings. Preserve the selected Writer and independent
   review until evidence supports a contract change. This is lower priority
   than eliminating repeated whole-conversation input.

## Acceptance evidence for a larger change

Compare matched observation windows using total and uncached input separately,
model calls per empty pass, tokens per evaluated opportunity, and tokens per
confirmed action where actions exist. Check exact-source fidelity, relationship
continuity, independent review, claim identity and reconciliation. Zero sends
can be correct; never improve the metric by forcing actions or hiding unknown
usage. No percentage reduction for overnight production is claimed by this pass.
