# Growth OS user services

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
