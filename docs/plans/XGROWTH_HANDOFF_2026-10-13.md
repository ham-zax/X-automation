# XGrowth handoff — 2026-10-13

State of the `fix/context-budget` work after the first measured live sessions, and the
open issues found in them. Nothing here is a decision; the issues are listed for
independent analysis.

## Where things are

| Item | State |
|---|---|
| Branch | `fix/context-budget`, pushed, **not merged** to `main` |
| ARM production checkout | `/home/ubuntu/repo/x_test` on `fix/context-budget` (was `main` @ `ab312d0`) |
| `x-test-growth-agent.timer` | disabled |
| `x-test-growth-agent.service` | `failed` (left by a manual stop; clears on next start) |
| `x-test-xactions-update.timer` | enabled on ARM, daily; XActions pinned at `b9c4bf7`, healthy |
| `x-test-dashboard.service` | still running pre-switch code in memory, not restarted |
| Operator lease | none |
| ARM browser (CDP 9222) | the eight pre-existing tabs, no agent tabs left |
| Uncertain attempts `c8a99266…` (Reply), `1e363f31…` (Quote) | untouched, never retried |

Rollback: on ARM `git checkout main` in the checkout, restore the launcher and drop-in
from `~/.local/state/x_test/backups/` and `attached-live.conf.bak-*`, and
`systemctl --user disable --now x-test-xactions-update.timer`.

## What is on the branch

- `83ace00` compact bridge payloads.
- `3264704` shared scout card guidance, filtered browser read, WSL dry-run plan.
- `2329713` `x-read`: read-only lookups through the pinned XActions client
  (`x_reads.js`), the daily updater (`ops/xactions_update.mjs`) and its systemd units.
- `7e8f7f4` `x-read` `search` kind for niche topic discovery.

Measurements and lane choices per surface are in
`docs/plans/XGROWTH_WSL_DRY_RUN_2026-10-13.md`.

## Sessions run today

All times UTC. Only one publication attempt was created today.

| Session | Model | Result |
|---|---|---|
| ARM launcher, 04:56 | Codex `gpt-6-luna` `high` | refused in 10 s: claive hardcodes Codex effort to `max` (`CODEX_EFFORT` in `claive/bin/claivelib/engines/codex.py`) |
| ARM launcher, 04:58 | Codex `gpt-6-luna` `max` | stopped by hand after 2m36s and 22 model calls (owner's Luna usage was at 1%); no run, no sends |
| Haiku 1, 05:08 | `claude-haiku-5-5` `xhigh` | about 7 min, 53 calls; run `3ea59193…` finished `partial`, 0 sends |
| Haiku 2, 05:16 | `claude-haiku-5-5` `xhigh` | about 6.5 min, 35 calls; run `9fa3e7d3…` finished `partial`, 1 reply |

Token use of the Haiku sessions (input is almost entirely cache reads and writes):

| | Haiku 1 | Haiku 2 |
|---|---|---|
| Input tokens | 2,228,371 | 1,385,390 |
| of which cache reads | 2,095,191 | 1,275,337 |
| of which cache writes | 133,074 | 109,983 |
| Output tokens | 50,980 | 37,850 |

The one reply: attempt `2c9e03f3-1a23-4326-8814-fe7f3a874410` (row 513),
`confirmed_published`, to `devXritesh` post `2109184826838528432`, visible at
`https://x.com/ham_zax/status/2109877050576089479` (verified with `x-read replied`).

### How the Haiku sessions were run

Claude Code is installed on ARM (`~/.local/bin/claude` 2.1.296) but not logged in, so
the model ran in WSL through claive and every command ran on ARM through a wrapper.
State, duplicate fence and browser stayed on production. The wrapper and brief are
**not versioned**; they live in a session scratch directory and will be lost. The
wrapper was:

```bash
#!/bin/bash
# Runs one command in the production checkout on the ARM host. stdin passes through.
set -euo pipefail
[ $# -ge 1 ] || { echo "usage: ./arm '<command>'" >&2; exit 2; }
# shellcheck disable=SC2016  # expanded on the remote host
REMOTE_ENV='export PATH=/home/ubuntu/.local/bin:/usr/local/bin:/usr/bin:/bin DISPLAY=:99 TMPDIR=/home/ubuntu/work/scratch XDG_RUNTIME_DIR=/run/user/$(id -u) X_GROWTH_AGENT_RUNTIME=claive X_GROWTH_BROWSER_TARGET=linux X_GROWTH_BROWSER_INTERFACE=agent-browser-cli X_GROWTH_BROWSER_MCP_SERVER=xgrowth_browser X_GROWTH_BROWSER_FAST_BACKEND=clearcote X_GROWTH_BROWSER_CDP_PORT=9222 X_GROWTH_AGENT_EXPERIMENT=1 AI_ALLOW_RUNTIME_MANAGED=true'
cd /home/hamza/repo/myservers
exec ssh -F ssh_config -o BatchMode=yes -o ControlMaster=auto -o ControlPath=/tmp/claude-1000/cm-%C -o ControlPersist=15m ARM \
  "$REMOTE_ENV; cd /home/ubuntu/repo/x_test && bash -c $(printf '%q' "$*")"
```

Launch: `claive start --engine claude --model claude-haiku-5-5 --reasoning-effort xhigh
--web --turn-timeout <s> --workspace <dir with ./arm> --prompt-file <brief>`. The brief
was the ARM brief (`~/.local/state/x_test/arm-growth-live.md`, placeholders filled from
`ops/browser_operator_contract.js`) with a first section telling the agent to run
everything through `./arm`. Haiku followed the wrapper on every command in both
sessions.

The ARM launcher itself (`~/.local/state/x_test/arm-growth-live.sh` and `.md`, plus the
`attached-live.conf` drop-in) is back on Codex `gpt-6-luna` `max` with
`X_GROWTH_BROWSER_INTERFACE=agent-browser-cli` and a 45-minute `--turn-timeout`. It is
also unversioned.

## Open issues

1. **Sessions end the run after one pass.** Both Haiku sessions finished with
   `no_worthwhile_eligible_work` after about two to four minutes of run time, inside a
   window of 30 to 40 minutes. Session 2 was told not to finish before minute 20 unless
   mentions, For You and niche search had all been judged; it judged each once and
   finished. Nothing makes the agent look again.
2. **For You observations were not ingested in either session.**
   - Session 1 could not attribute snapshot text to authors from the browser snapshot.
   - Session 2 read the `x-for-you-ingest` contract as requiring
     `browserTarget: "windows"` and refused to submit a false label. Session 1 had
     concluded `linux` was right. Which is true has not been checked against the code.
3. **Startup cost.** Each session spent its first minutes re-reading
   `GROWTH_RUN_PROTOCOL.md`, grepping `agent_bridge.js` for command names and probing
   jq shapes of `operator-status`, `growth-run-next`, `growth-run-finish` and
   `publication-attempts`. Several first parses failed (`growth-run-next` fields are
   nested; `growth-run-finish` returned a `.run` with null fields).
4. **Launcher, brief and wrapper are unversioned** (see above).
5. **agent-browser socket path.** With the session id format
   `<engine>-<model>-<effort>-arm-<ts>-<uuid>` the CLI fails with "Socket path would be
   118 bytes (max 103)". Both sessions worked around it with
   `AGENT_BROWSER_SOCKET_DIR=/tmp/abarm`.
6. **Each browser attach leaves an `about:blank` tab.** Three appeared today across
   three sessions and were closed by hand afterwards.
7. **X navigation timeouts.** Session 2 saw `ERR_TIMED_OUT` in the runtime `lastError`
   and did not investigate. `x-read` worked throughout.
8. **Contracts not re-read.** Session 1 disclosed it did not re-read the content
   contracts or verify the persona reload. No send depended on it in that session.
   Whether session 2 did was not checked.
9. **Skipped mentions.** `DanKornas` (`2108287657411563976`): saturation pressure 90
   after 12 consecutive unanswered interactions. `MrrrOzi` (`2108163023118725454`):
   Turkish; the agent would not reply in another language without owner sign-off.
10. **Effort is not selectable for Codex.** `high` cannot be used through claive
    without changing claive.
11. **Monitoring pitfall.** `publication_attempts` has no `created_at`; the time column
    is `claimed_at` in epoch milliseconds. Checks written against `created_at` return
    zero rows or an error and prove nothing.

## Not started from the context-budget plan

Session record (tokens, calls, bytes, outcomes), wake gate and quota ledger, browser
driver records with one resolved config and a `doctor`, compact agent brief, optional
wiring of `replied` into the pre-send path, optional `list` kind for X Lists.

## Owner decisions pending

- Luna `max` or Haiku `xhigh` as the session model once Luna usage resets.
- Merge of `fix/context-budget` to `main`.
- Re-enabling `x-test-growth-agent.timer`.
- Whether non-English mentions get replies.

## Loose ends

- Claive worker `18f98f19fd60` (Haiku, WSL, workspace `context-budget`) is idle and
  still open; `claive close 18f98f19fd60` ends it.
- Five `about:blank` tabs remain in the WSL Clearcote profile `x-main` from the dry
  run. Their ownership was not established, so they were left.
- The daily updater's smoke test runs a freshly fetched upstream XActions commit with
  the account cookies before any review of that commit.
- `x_browser.js` has a hardcoded Chrome path, and the GitHub Trending and HN feeds
  were not exercised today; neither is proven on ARM.
- The ARM checkout is at `7e8f7f4`; this document is one commit later and has not
  been pulled there.
