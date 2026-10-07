# X Test user services

These units are rollout artifacts for the production checkout in `/home/hamza/repo/x_test`.

The dashboard is a read/review service; live X work belongs to the attached reasoning operator:

- `x-test-automation.service` is a retired artifact. Continuous `automation.js` operation is disabled. Do not install, enable, or start it. A human or reasoning agent may explicitly invoke `npm run automation:once` for one bounded maintenance cycle.
- `x-test-growth-agent.timer` / `x-test-growth-agent.service` — roughly every 15 minutes launch of the browser-capable reasoning operator. The reasoning runtime follows `docs/GROWTH_RUN_PROTOCOL.md`; it does not grant itself authority and it does not bypass publication attempts or reconciliation.

Install and load:

```bash
mkdir -p ~/.config/systemd/user
cp /home/hamza/repo/x_test/ops/systemd/x-test-dashboard.service ~/.config/systemd/user/
cp /home/hamza/repo/x_test/ops/systemd/x-test-growth-agent.service ~/.config/systemd/user/
cp /home/hamza/repo/x_test/ops/systemd/x-test-growth-agent.timer ~/.config/systemd/user/
systemctl --user daemon-reload
```

Enable and start when ready:

```bash
systemctl --user enable x-test-dashboard.service x-test-growth-agent.timer
systemctl --user start x-test-dashboard.service
systemctl --user start x-test-growth-agent.timer
```

Inspect:

```bash
systemctl --user status x-test-dashboard.service x-test-growth-agent.timer --no-pager
systemctl --user list-timers x-test-growth-agent.timer --no-pager
journalctl --user -u x-test-dashboard.service -u x-test-growth-agent.service -n 100 --no-pager
```

Before starting the units, build the release with `npm ci`, `npm ci --prefix ui`, and `npm run ui:build`. The dashboard unit executes `node dashboard.js` against those prebuilt assets; it never installs or builds during startup. Stop any hand-launched dashboard or automation process. Do not run a terminal-owned daemon and the corresponding systemd service at the same time.

The Growth Agent service is `Type=oneshot`; the timer wakes it roughly every 15 minutes with no catch-up bursts (`Persistent=false`). An active service coalesces timer wakes. The runner loads `.env` and supports `X_GROWTH_AGENT_RUNTIME=opencode|codex|claude|pi`; each runtime needs its own authenticated model account and configured WebHarness browser tools. OpenCode remains the default, with the existing configurable model default; model availability and live browser access require a deployment check. It uses the installed CLI's `--standalone` mode to keep its private server inside the supervised process group. Claude uses noninteractive `dontAsk` permission mode and explicit bridge/browser tool permissions. Broker aliases must match those permissions or use direct `browser-fast` / `browser-devtools` MCP registrations.

`pi` is the headless-Linux runtime (the ARM host): it runs `pi --print --no-session --offline --no-extensions --no-approve --tools read,bash` with the prompt as the last argument, defaults to `opencode2api/exo-free` (`X_GROWTH_AGENT_MODEL`, `provider/model`), and reads `X_GROWTH_PI_BIN` (default `~/.local/bin/pi`) and `X_GROWTH_PI_THINKING` (default `high`). It defaults to `X_GROWTH_BROWSER_TARGET=linux`: X is driven through the Agent Browser CLI (`X_GROWTH_AGENT_BROWSER_CLI`, default `~/.local/bin/agent-browser`) attached to the persistent Chromium on `X_GROWTH_BROWSER_CDP_PORT` (default 9222), and the run records an authentication blocker instead of logging in when that browser is not signed in as `@ham_zax`. Pi has no OS sandbox or per-command allowlist, so the prompt's hard boundaries are the only guard; run it as an unprivileged user. `X_GROWTH_REPO` overrides the repository path (default: the runner's own directory).

`X_GROWTH_AGENT_WINDOW_MINUTES` defaults to 20 and accepts 1–480 minutes. A window contains fresh sequential Growth Runs of at most 20 minutes and eight public mutation attempts per pass. Another pass begins only after a completed ceiling finish with zero investigating or closed-unresolved attempts, current Live delegation, unconstrained health and no competing lease. No worthwhile work ends the window early. Each runtime has a pass deadline with at most two minutes for exit/reconciliation, capped by the remaining overall window; expiry kills the process group and preserves uncertain attempts for recovery. The service has a nine-hour outer timeout and never automatically restarts a failed runtime.

For example, set `X_GROWTH_AGENT_RUNTIME=claude` and `X_GROWTH_AGENT_WINDOW_MINUTES=120` in the private `.env` to configure a two-hour window before an intentional `npm run growth-agent` invocation. These values do not enable a timer or grant public authority. Production mode requires explicit `AI_ALLOW_RUNTIME_MANAGED=true`; configure provider-side billing limits because external reasoning sessions cannot be token-capped by Growth OS. The unattended prompt verifies the Windows X account before beginning the run and follows concrete `growth-run-next.claim` targets instead of treating browser-owned work as blocked by missing daemon API credentials.

Do not enable the Growth Agent timer merely because delegation is Live. First verify `operator-readiness` reports the intended browser account, no active uncertain-write blocker, and a working reasoning/runtime path. An already-active operator lease causes a scheduled wake to coalesce instead of starting a competing operator.

Release, private access, backup, restoration and rollback: [Production operations](../../docs/PRODUCTION_OPERATIONS.md). These are owner-run rollout instructions; changing the files does not deploy or enable services.
