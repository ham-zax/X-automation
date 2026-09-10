# X Test user services

These units are rollout artifacts for the production checkout in `/home/hamza/repo/x_test`.

There are two separate automation planes:

- `x-test-automation.service` — background source refresh, preparation, measurement, reconciliation, and official-X-API publication only when that transport is actually configured.
- `x-test-growth-agent.timer` / `x-test-growth-agent.service` — roughly hourly launch of the browser-capable reasoning operator. The reasoning runtime follows `docs/GROWTH_RUN_PROTOCOL.md`; it does not grant itself authority and it does not bypass publication attempts or reconciliation.

Install and load:

```bash
mkdir -p ~/.config/systemd/user
cp /home/hamza/repo/x_test/ops/systemd/x-test-dashboard.service ~/.config/systemd/user/
cp /home/hamza/repo/x_test/ops/systemd/x-test-automation.service ~/.config/systemd/user/
cp /home/hamza/repo/x_test/ops/systemd/x-test-growth-agent.service ~/.config/systemd/user/
cp /home/hamza/repo/x_test/ops/systemd/x-test-growth-agent.timer ~/.config/systemd/user/
systemctl --user daemon-reload
```

Enable and start when ready:

```bash
systemctl --user enable x-test-dashboard.service x-test-automation.service x-test-growth-agent.timer
systemctl --user start x-test-dashboard.service x-test-automation.service
systemctl --user start x-test-growth-agent.timer
```

Inspect:

```bash
systemctl --user status x-test-dashboard.service x-test-automation.service x-test-growth-agent.timer --no-pager
systemctl --user list-timers x-test-growth-agent.timer --no-pager
journalctl --user -u x-test-dashboard.service -u x-test-automation.service -u x-test-growth-agent.service -n 100 --no-pager
```

Before starting the units, stop any hand-launched dashboard or automation process. Do not run a terminal-owned daemon and the corresponding systemd service at the same time.

The Growth Agent service is `Type=oneshot`; the timer wakes it roughly hourly with no catch-up bursts (`Persistent=false`). The runner defaults to OpenCode because its installed WebHarness MCP can reach the authenticated Windows browser. Runtime/model selection is configurable with `X_GROWTH_AGENT_RUNTIME` and `X_GROWTH_AGENT_MODEL`; Codex is supported by the runner when its external account/runtime is available.

Do not enable the Growth Agent timer merely because delegation is Live. First verify `operator-readiness` reports the intended browser account, no active uncertain-write blocker, and a working reasoning/runtime path. An already-active operator lease causes a scheduled wake to coalesce instead of starting a competing operator.
