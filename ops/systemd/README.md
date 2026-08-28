# X Test user services

These units are rollout artifacts only. Activate them from the production checkout after the branch is merged into `/home/hamza/repo/x_test`.

Install and load:

```bash
mkdir -p ~/.config/systemd/user
cp /home/hamza/repo/x_test/ops/systemd/x-test-dashboard.service ~/.config/systemd/user/
cp /home/hamza/repo/x_test/ops/systemd/x-test-automation.service ~/.config/systemd/user/
systemctl --user daemon-reload
```

Enable and start when ready:

```bash
systemctl --user enable x-test-dashboard.service x-test-automation.service
systemctl --user start x-test-dashboard.service x-test-automation.service
```

Inspect:

```bash
systemctl --user status x-test-dashboard.service x-test-automation.service --no-pager
journalctl --user -u x-test-dashboard.service -u x-test-automation.service -n 100 --no-pager
```

Before starting the units, stop any hand-launched dashboard or automation process. Do not run a terminal-owned daemon and the corresponding systemd service at the same time.
