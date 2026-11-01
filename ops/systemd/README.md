# Growth OS user services

## Current ARM repair status, 1 November 2026

TASKS.md owns the GQ repair status. The active execution update in
`docs/plans/GROWTH_REPLY_QUALITY_DESIGN_2026-10-29.md` supersedes earlier model
assignments. Terra6.1 medium writes Replies, Originals, Quotes and Threads for
repair evidence. Sol6.1 high performs complex review. DeepSeek orchestrates.
The separate content_review role stays configurable and inherits Writer if unbound.
Reply v2 has structured candidates/checks/selection and a Writer-selected behavior.
Profile act requires the exact saved generation. Quote also needs current server
review. Originals/Threads keep reviewed approved queues. No new approval authority.
Source normalization preserves extended note text without changing the trusted pin.
The evaluator imports the active contract and separates diagnostic review failures.
See `docs/research/production-reply-failure-2026-11-01/repair-terra-medium/README.md`
and its OPERATIONS.md for actual evidence and limits. The ledger records their integration state.
The operator and timer remain stopped pending bounded live acceptance.
The final review found issues, followed by a parent repair round and focused checks. Historical entries below are dated evidence, not current deployment.
No retained historical document or private backup is removed by this update.


Current repository guidance: 31 October 2026, implementation commit `7880df5`.
Production checkout: `/home/ubuntu/repo/x_test` on ARM. WSL is test-only.
Do not start a second operator against another database copy.

## Attached operator

The versioned ARM service is `arm/x-test-growth-agent.service`.
Its `arm/attached-live.conf` drop-in selects `arm/arm-growth-live.sh`.
That shell starts `ops/attached_live_session.mjs`, which renders the live brief,
leases one browser target, supervises the selected agent and releases the target.
The drop-in supplies a 60-second stop timeout for cleanup.

The operator runtime, model and supported reasoning effort are configurable.
Reply writing can use the operator itself or the saved Writer role.
See [model selection](../../docs/AGENT_WORKFLOW.md#operator-and-writer-selection)
and the [live brief](arm/arm-growth-live.md). No Luna model lock remains.
The default attached runtime still uses Claive/Codex when no override exists.
Changing code or settings does not install units, enable timers or grant authority.

The service without the attached drop-in runs `growth_agent_runner.js` instead.
That entry point runs one finite controller tick. It does not launch the retired
elapsed-time browser loop. Do not confuse the two entry points.

## Deployment and inspection

Use [Production operations](../../docs/PRODUCTION_OPERATIONS.md) for release,
private access, backup, restore and rollback. Use ARM units for production.
Do not install the historical WSL units into the ARM account.
Check the installed service and drop-ins before reporting deployment status:

```bash
systemctl --user cat x-test-growth-agent.service
systemctl --user status x-test-growth-agent.service x-test-growth-agent.timer --no-pager
systemctl --user list-timers x-test-growth-agent.timer --no-pager
journalctl --user -u x-test-growth-agent.service -n 100 --no-pager
```

Build dashboard assets before deployment through the release procedure.
Services do not install dependencies or build assets at startup.
The timer wakes the configured service. Owner policy and claim gates decide
whether public action is permitted. Missed wakes create no publishing quota.

Continuous `automation.js` and the old model-rotation watchdog are retired.
Do not enable their services. The dashboard remains an inspection interface.
Historical deployment evidence lives in `docs/ARM_24X7_HANDOFF.md`.
No host installation or current service inspection accompanies this doc update.

## DeepSeek selection, 31 October

The versioned `arm/deepseek.conf` drop-in selects OpenCode with
`opencode2api/deepseek-v4.1-flash-free`, max effort and profile Reply mode.
The current saved Writer role selects profile15: Pi, the same DeepSeek model,
max effort and no fallback. Model bindings remain runtime state, not Git data.

The installed OpenCode executable supports operator sessions. Its SDK/server
structured-output interface does not match the existing Writer adapter. The
Writer therefore uses the existing Pi adapter and the same opencode2api provider.
A real structured Writer connection check passes with DeepSeek and no fallback.
This does not establish end-to-end content quality or continuous availability.

The ARM service and existing timer start under owner authorization. The launcher
reports OpenCode/DeepSeek/max/profile mode and allocates one owned browser tab.
A separate read-only browser check establishes the signed-in Profile href
`/ham_zax`. Its test targets close cleanly. The operator checks current account,
delegation, rest policy and claims before any public action.

## Reply Writer override, 31 October

The owner now selects GLM 5.3 Flash Free max for Replies through the saved
`reply_writer` role, profile16, with no fallback. The executor remains DeepSeek.
The shared `writer` role remains DeepSeek for Originals, structured Quotes and
Threads. Direct operator-authored Quotes still use the executor model.
AI Settings exposes Reply Writer separately. Unbound Reply Writer settings
inherit the shared Writer. See `docs/AGENT_WORKFLOW.md` for selection details.
Contract v2 keeps two candidates and all 16 checks in one writing invocation.
The earlier all-DeepSeek startup record above remains historical evidence.

Owner clarification: GLM now writes all formats, not only Replies. Both writer
and reply_writer select profile16, glm-5.3-flash-free max without fallback.
DeepSeek remains the executor and orchestration model. The bridge now exposes
writer-generate for a routed saved draft, reusing generateDraftCandidate and its
existing independent review. Profile-mode operators use that command for
Originals, Threads and Quotes instead of writing public prose themselves.
Quotes still publish through act and its editorial checks. Originals and Threads
still use the approved queue. These generation commands grant no authority.

Attached sessions classify child quota/provider failures and use the existing
persistent growth-runner-backoff.json delay. The launcher reports actual deadline
and elapsed timestamps. Deferred launches allocate no browser tab or model child.
No automatic model substitution occurs. A timer wake does not prove a public action.
