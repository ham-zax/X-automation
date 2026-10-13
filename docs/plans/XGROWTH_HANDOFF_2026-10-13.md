# XGrowth handoff — 2026-10-13

State of the `fix/context-budget` work at the end of 2026-10-13 (UTC). It replaces the
morning version of this file; the earlier text is in Git history (`1a2df5a`).

## Where things are

| Item | State |
|---|---|
| Branch | `fix/context-budget`, merged to `main` by fast-forward on 2026-10-13 |
| ARM production checkout | `/home/ubuntu/repo/x_test` on `main` |
| WSL | test-only; `~/repo/x_test` on `main`. The worktree `~/repo/x_test.worktrees/context-budget` is merged and can be removed |
| `x-test-growth-agent.timer` | enabled on 2026-10-13 19:10 UTC at the owner's request, with a host drop-in `cadence.conf` that starts a session 30 minutes after the previous start (the unit's own value is 5). A session that is still running is not started twice |
| `x-test-xactions-update.timer` | enabled on ARM, daily; XActions pinned at `b9c4bf7` |
| Browser | CloakBrowser replaced Clearcote in this repository and in WebHarness (`3d1b168`). The ARM growth session still attaches to the signed-in Chromium on CDP 9222 |
| Uncertain attempts `c8a99266-b68c-46d9-986e-a5c2671ac279` (Reply), `1e363f31-eaca-44c1-b95c-1017f2a9b6fc` (Quote) | untouched; never retry them |

Rollback on ARM: `git checkout ab312d0` and `npm ci` in the checkout, restore the launcher,
brief, drop-in and unit from `~/.local/state/x_test/backups/`,
`systemctl --user daemon-reload`, and
`systemctl --user disable --now x-test-xactions-update.timer`.

## What is on the branch

- `83ace00`, `e51832a` compact bridge payloads.
- `3264704` shared scout card guidance, filtered browser read.
- `2329713`, `7e8f7f4` `x-read`: read-only lookups and niche search through the pinned
  XActions client, with the daily updater and its units.
- `b39f3e8`, `d1e8d64` the ARM launcher, brief and drop-ins are versioned under
  `ops/systemd/arm/`; the brief loops discovery passes and ends with a command sheet.
- `83ebded` shorter `AGENTS.md`.
- `9fe66a5` CloakBrowser instead of Clearcote.
- The commit that carries this file: fixes from the first full Luna session (below).

## Live sessions

All times UTC.

| Session | Model | Result |
|---|---|---|
| 05:08 and 05:16 | `claude-haiku-5-5` `xhigh`, run from WSL | about 7 min each, one pass each; 1 reply confirmed in total |
| 16:18, run `76f8e503-c077-4637-b83a-aeb6fa20c2f8` | Codex `gpt-6-luna` `max` on ARM | 37 min, several passes, 2 replies confirmed, 23 skips, run finished and lease released |
| 18:27, run `bd63e3d2-8256-4e65-a6d8-a00494688a1e` | same, on `e3d7953` (brief fixes, `growth-focus`) | 35 min, 4 passes, 6 replies confirmed, 44 skips, run completed and lease released |

Confirmed replies of the 16:18 session:
`https://x.com/ham_zax/status/2110049677135561095` and
`https://x.com/ham_zax/status/2110047426744918387`.

Cost of the 16:18 session: 76 model calls; 9,563,546 input tokens, of which 9,268,480
were cache reads (about 295,000 uncached); 100,253 output tokens; peak context 243,511
tokens.

Cost of the 18:27 session: 16,901,281 input tokens, of which 16,430,336 were cache
reads (about 471,000 uncached); 164,054 output tokens. Total tokens rose because it ran
four passes and judged 50 candidates; per confirmed reply the input fell from about
4.8 million to about 2.8 million tokens. The scout and browser-contract changes
(`77517f1`) were deployed after this session and are not measured yet.

## Fixed after the 16:18 session

| Observed | Fix |
|---|---|
| The brief gave `record-disposition` a `candidateKey` field; the bridge reads `key` | brief corrected |
| No command returned the Growth Focus topics, so the agent read `docs/NICHE_AND_KEYWORDS.md` | new read-only `growth-focus` command (12 groups, first 8 terms each, about 2 KB; `{"detail":true}` for all terms) |
| About 80 KB of policy, network, relationship and niche documents were read | the brief says the bridge returns those live values and names the documents not to read |
| `operator-status {"detail":true}` was called twice | the brief allows it once per session |
| The progress file went stale between minute 5 and the end of pass 1 | the brief asks for an update at least every 5 minutes inside a long pass |
| `publication-attempts` `counts` covered only the newest 100 rows | `counts` now come from the whole table |
| The agent loaded `agent-browser skills get core` (38 KB) at every start | the browser contract in `ops/browser_operator_contract.js` lists the commands a session needs and tells the agent not to load the CLI skill text. Nothing is installed as a system skill |
| `scout` returned about 18 KB per pass and ranked a 79-hour-old post near the top | conversation cards older than 24 hours are dropped unless flagged urgent; the default output omits shape labels and the prose `reason` (`{"detail":true}` returns them) |

## Open issues

1. **Cost per session.** The context still grows to about 240,000 tokens and every call
   re-reads it from cache. The fixes above remove startup reading; they do not bound
   growth across passes. Not started from the context-budget plan: session record
   (tokens, calls, outcomes), wake gate, and a pre-ranked scout.
2. **Discovery snapshots are stale.** `operator-status` `.discovery` shows `x_latest`,
   `x_momentum`, GitHub Trending, HN Top and creator timelines last fetched weeks ago
   with fetch errors. Only For You is current. The GitHub and HN feeds are unproven on
   ARM.
3. **Skipped mentions.** `DanKornas` (`2108287657411563976`): saturation pressure 90.
   `MrrrOzi` (`2108163023118725454`): Turkish; no reply without owner sign-off.
4. **X navigation `ERR_TIMED_OUT`** was seen in one Haiku session and not investigated.
5. **Monitoring pitfall.** `publication_attempts` has no `created_at`; the time column
   is `claimed_at` in epoch milliseconds.
6. **Codex effort.** claive runs Codex at `max` only.
7. **The daily XActions updater** smoke-tests a freshly fetched upstream commit with
   the account cookies before any review of that commit.

## Owner decisions pending

- Luna `max` or Haiku `xhigh` as the session model.
- Whether non-English mentions get replies.

## Starting a session by hand

On ARM, as `ubuntu`, with no other operator running:

```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)
systemctl --user start x-test-growth-agent.service
jq . ~/.local/state/x_test/live-progress.json
```

The unit runs `ops/systemd/arm/arm-growth-live.sh`: Codex `gpt-6-luna` `max` through
claive, 35 minutes of work and a hard stop at 45.
