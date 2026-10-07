# Production operations

This is a single-owner, single-instance service backed by local SQLite and local media. Run one dashboard against one state directory, and at most one attached Growth Run lease. Do not run old and new release processes against the same database during a rollout. The dashboard is an administrative surface: use loopback plus an authenticated tunnel, or an authenticated TLS reverse proxy. It must not be exposed directly to the public internet.

## Release readiness

Use Node 24 and the committed lockfiles. In a separate release checkout, run:

```bash
npm ci
npm ci --prefix ui
npm test
npm run test:ui --prefix ui
npm run lint --prefix ui
npm run ui:build
```

Use `PUPPETEER_SKIP_DOWNLOAD=true npm ci` in verification environments that do not need legacy browser binaries. Inspect `npm audit` before release. The explicit `xactions > xspace-agent: 0.2.0` override resolves an unavailable upstream optional `^0.1.0` dependency so frozen installs can work. Repository imports do not invoke the Spaces integration; this override does not enable that optional feature. Its SDK retains the exported `XSpaceAgent`, event API, `join` and `leave` methods expected by the lazy adapter. Lockfile updates repair compatible dependencies. The 2026-10-02 registry check reports 16 advisory package nodes (12 high, 4 moderate); another compatible `npm audit fix --package-lock-only --ignore-scripts` does not resolve them. Remaining branches include unpatched `extract-zip` via Clearcote/Puppeteer, `basic-ftp` through browser proxy dependencies, `uuid` via Bull/ExcelJS, Nodemailer constrained to version 9 by XActions, and the optional Spaces SDK's Anthropic memory-tool advisories. The frozen-install override introduces that unused optional SDK branch. Resolving the constrained branches requires a verified transport/library upgrade or replacement; they remain release risks and must not be hidden or bypassed with `--force`.

Keep `AUTO_POST=false`. Continuous `automation.js` operation is disabled; do not enable `x-test-automation.service`. A human or reasoning agent may intentionally run `npm run automation:once` for one bounded maintenance cycle, or `npm run measurements:capture` for an explicitly attached measurement-only capture. These commands do not authorize continuous unattended operation. The existing roughly 15-minute Growth Agent timer launches the reasoning runtime, subject to persisted delegation, account readiness, operator lease, exact claims, and reconciliation. It does not confer authority by itself. Runtime selection, multi-hour windows and required browser configuration are documented in [the service instructions](../ops/systemd/README.md).

Before a rollout, finish or suspend attached work through the Growth Run protocol, reconcile uncertain writes, and take and verify a backup. Do not clear publication attempts or leases by editing the database. Stop the dashboard before switching its checkout/state location; restart only after owner review of the release and configuration. `ops/systemd/x-test-dashboard.service` serves prebuilt UI assets with `node dashboard.js`, so restart does not run a build or installation. Unit paths in this repository are examples for the owner's existing checkout, not an automatic deployment command.

## Private access

Set `WEB_HOST=127.0.0.1` in the service environment. Set `WEB_AUTH_USER` (default `owner`) and a long unique `WEB_AUTH_PASSWORD` for remote access. Set `WEB_PUBLIC_ORIGIN` to the exact HTTPS dashboard origin when terminating TLS at the proxy. Install TLS and independent access control at the proxy or authenticated tunnel. Existing dashboard credentials remain required. `ops/nginx/x-test.conf.example` shows a loopback upstream with TLS and the application owner login. Use a VPN, firewall or mTLS for independent ingress control; two independent Basic-auth passwords cannot share one Authorization header. Replace its domain and certificate paths, provision them securely, and validate with `nginx -t` before owner-controlled reload. Restrict the backend port to loopback and restrict proxy ingress to the intended owner network when possible. Never store actual credentials in this repository.

AI provider trust and per-request safety limits are configured by `AI_ALLOWED_ENV_CREDENTIALS`, `AI_ALLOWED_PROVIDER_URLS` (public HTTPS base URLs), `AI_ALLOWED_LOCAL_PROVIDER_URLS` (explicit trusted local origins/path), and the `AI_MAX_OUTPUT_TOKENS`, `AI_MAX_RESPONSE_BYTES`, `AI_TOTAL_TIMEOUT_MS`, `AI_MAX_CONCURRENCY` and `AI_MAX_INPUT_TOKENS` settings in `.env.example`. There is no application-level daily AI request/token budget. Permit only intentionally trusted endpoints and credential names. In production, runtime-managed AI CLIs require explicit `AI_ALLOW_RUNTIME_MANAGED=true`; leave it false by default and apply provider-side billing controls if desired because the application does not impose a daily usage quota. Linux `flock` is required for cross-process AI secret updates; missing locking support fails closed rather than risking lost updates.

## Backup and verification

Choose a destination outside the repository that does not yet exist. Node's native SQLite online backup captures committed WAL data without copying a live SQLite/WAL file pair. Pause media changes and configuration edits during the backup to keep those files aligned with the database snapshot; the tool cannot make SQLite, media and secret files one cross-resource transaction.

```bash
npm run backup -- /home/hamza/repo/x_test /secure/backups/x-test-2026-10-01 /home/hamza/.config/x-test/ai-secrets.json
npm run backup:verify -- /secure/backups/x-test-2026-10-01
```

The third argument explicitly selects the AI secret file. If omitted, the CLI uses exported `AI_SECRETS_FILE`, then the normal home-directory default; it does not load `.env` to discover a custom secret path. Include that explicit argument whenever `.env` configures a different path. Missing optional files are absent from the manifest; inspect the inventory to confirm the expected secrets and media were captured.

The backup contains `.x-research.sqlite`, `.x-media` files, `.env`, optional `.x-web-owner-password`, optional legacy `.automation-state.json` and `.interesting-posts.json`, and an available AI secret file saved as `.secrets/ai-secrets.json`. It uses directory mode 700 and file mode 600, rejects symlinks/non-regular files, checks SQLite integrity, and records file sizes and SHA-256 checksums in `manifest.json`. Partial failures leave a destination without a valid verified backup; use a fresh destination for retry. Verification detects accidental corruption, not a malicious replacement of both data and manifest.

External browser sessions, home-directory X session cookies, external runtime credentials, certificates and proxy password files are not copied. Inventory those separately and retain their secure recovery process; never copy them into a public artifact. Preserve the exact application commit/lockfiles alongside the private backup inventory. Transfer verified backups to encrypted off-host storage with owner-managed keys, and verify a decrypted copy periodically. Choose retention and backup frequency from the amount of work the owner can afford to lose; a backup on the same disk alone does not cover host loss.

## Recovery rehearsal and rollback

Restore only to a new directory that does not exist. The tool refuses every existing destination, validates checksums and SQLite integrity before copying, and verifies the restored database afterward:

```bash
npm run restore -- /secure/backups/x-test-2026-10-01 /secure/recovery/x-test-2026-10-01
```

The result contains state, not application code or dependencies. Prepare the matching application commit in a separate checkout, run the release checks, then place the recovered state in that isolated checkout. Set `AI_SECRETS_FILE` to its recovered `.secrets/ai-secrets.json`; an old absolute path in `.env` is not automatically rewritten. Review all credentials, host bindings and environment settings. Do not attach an X browser session or permit outbound work during a rehearsal. Validate the restored records through read-only bridge commands such as `operator-status`, `queue` and `publication-attempts` after preserving the pristine restore. Startup/bridge migrations may change the rehearsal copy, so keep the verified backup intact.

For production recovery, the owner stops existing services/runs first, checks for unresolved dispatched actions, and reviews backup-era approvals, leases and attempts against the live account. A restored old database cannot establish that a public action never happened. Reconcile these through the normal attempt protocol before resuming any publishing or engagement; never replay old claims automatically. Rotate credentials if host loss may have exposed them.

For rollback, retain the previous code release and a verified pre-release backup. Stop the new process, then select the matching code/state pair in a new directory. Do not assume older code can read a database after newer migrations, and do not overwrite the failed release's state; retain it for reconciliation. Only the owner changes the service path and restarts once the restored state and exact-output uncertainty are resolved. A recovery drill passes when checksums/integrity pass, the matching code starts privately, expected queue/operator records are visible, and no public action was dispatched.

Authenticated `GET /api/health` checks storage access, WAL and foreign-key enforcement. Native HTTP completions log request IDs, owner identity, route, status and latency; authenticated mutation metadata is retained in `owner_request_audit` without request bodies or query strings. Route your process logs to the deployment log service and alert on repeated 5xx responses, unavailable health checks, disk exhaustion and unresolved publication attempts. Those external alert destinations still require deployment configuration.
