# XGrowth Chromium tab/resource leak — incident diagnosis and mitigation (2026-10-09)

## Production evidence

The persistent authenticated Chrome instance is managed externally by WebHarness on CDP port 9222. Do not terminate this browser or use `agent-browser close --all` as a cleanup mechanism.

Following an OOM and host restart, the browser grew from 10 Chrome page targets to 14 within an active Growth Run. Source processes were already using multiple X tab renderers and shared workers. Chrome process count is not a tab count: every page can have renderer, worker and utility processes, many with shared RSS.

A controlled experiment with **disposable Chrome on port 9444**, not the authenticated X profile, established:

- Browser before new Agent Browser session: 1 page.
- First `--cdp 9444 --session <unique> --pin-tab tab list --json`: 2 pages. Reading the tab list itself created the extra blank page.
- Navigating using `open`: still 2 pages.
- `agent-browser close`: **still 2 pages**; the shared Chromium process remained alive.
- Explicit, page-ID-specific `Target.closeTarget`: page count returned to 1.
- Three fresh provision-and-release iterations after the fix ended at the original page count, with `cleaned: true`.

The runtime contract previously passed a new random `sessionId` for every unattended Growth Run to Agent Browser through `ops/browser_operator_contract.js` without `--pin-tab`. No source code closed the run's new page at end, even when the model quit cleanly. The analytics reader had a separate session without explicit tab ownership.

## Ownership map

| Code | Browser ownership | Lifecycle and risk |
|---|---|---|
| `growth_agent_runner.js` | Creates each Claive/Luna run and unique session ID | Previously no tab allocation or cleanup; now pinned owned tab allocated and closed in `finally` |
| `ops/browser_operator_contract.js` | Instructions for configured Agent Browser `--cdp 9222` | Previously omitted `--pin-tab`; now required, never use another run's tab |
| `growth_analytics_runner.js` | Separate read-only Luna metrics job | Now uses the same owned-tab lease, with separate analytics session |
| `ops/agent_browser_session.js` | **New explicit per-run Chrome page lease** | Captures baseline CDP IDs, observes exactly one new blank page, logs uncertain ownership, closes **only** its leased page; refuses excessive page count |
| `act.js` / `ops/browser_publish_transport.js` | Official canonical browser publication via `wh-browser` | Opens a temporary `tab_new` intent composer and best-effort `tab_close` in `finally`; if WH times out, cleanup can fail silently (residual risk) |
| `x_browser.js`, `x_browser_publish.js`, `audience.js`, `tech_news.js`, `x_creator_corpus.js`, `viral_style_research.js` | Separate legacy Clearcote launches | Typically call `browser.close()` in `finally`; not the same persistent shared-CDP session leak |
| `/home/ubuntu/repo/webharness/providers/browser-fast/server.mjs` | WebHarness provider (a **different repository**) | Uses per-tab pinned Agent Browser sessions, with `linuxSession()` selecting distinct session IDs. Closing Agent Browser daemon doesn't close its page; this is a remaining independent leak vector |
| `/home/ubuntu/.local/bin/wh-browser` | Persistent `wh-browser` socket daemon | Holds browser-fast provider until idle, which can keep per-tab sessions alive for hours; do not indiscriminately stop it |

## Mitigation implemented in x_test

New `ops/agent_browser_session.js`:

1. Reads `/json/version` and `/json/list` via loopback only.
2. Originally refused another session at 16 page targets. After verifying the separate WebHarness provider fix, production's historical baseline remained at 20 owner-ambiguous pages, so the temporary ceiling is now **24 page targets plus a hard 4 GiB minimum Linux MemAvailable**. It never deletes unknown pre-existing tabs.
3. Calls the installed Agent Browser CLI with `--pin-tab` and a unique run ID.
4. Requires the new page to be exactly one previously absent `about:blank` CDP target, and verifies that it is the active tab; ambiguous ownership is a fail-closed blocker.
5. Gives Luna the exact owned page ID, requiring navigation on that tab rather than taking over an existing X tab.
6. Always runs a release in the host launcher `finally`, independent of Luna voluntarily executing cleanup.
7. Disconnects only that Agent Browser session, then sends Chrome `Target.closeTarget` for **its exact recorded page ID**, verifies absence, and reports leftover new/unowned tabs without deleting them.
8. Refuses to target a different browser after CDP restart and never calls `Browser.close`.

Only the scheduled Linux Agent Browser path is given this provisioned lease; separately configured MCP and Windows workflows retain their original semantics. The analytics runner is independently scoped and does not gain X publication authority.

## Remaining risk and follow-up

The above fix closes **the proven one-page-per-new-Agent-Browser-session leak**, not every possible browser leak.

- **WebHarness browser-fast provider** pinned-session bootstrap leak was repaired separately in `ham-zax/webharness` commit `7fc9aef`. Provider tests passed 36/36; disposable Chrome full observe/new/close/shutdown returned to its initial page count; a live read-only pinned observe and provider shutdown preserved the 20-page historical baseline unchanged. Historical pages with unproven owners remain untouched. The remaining cleanup is ownership reconciliation, not speculative deletion.
- Browser UI `click` can open a legitimate new tab; inspect opener relationships and close only if the tab's current run ownership is proven. The new prompt favors `open` navigation within one pinned owned tab.
- `act.js` composer cleanup is best-effort; instrument failed `tab_close` and implement an exact composer-tab fallback only after verifying the backend and target mapping. Never retry an uncertain publication click.
- Existing tabs from prior runs are deliberately untouched. They should be reconciled and closed in a controlled maintenance window after confirming no active owners, unsent drafts, or unfinished mutations.
- Track CDP page/worker counts and memory. Do not blindly kill renderer subprocesses while Chrome remains running.
- Keep health monitoring, avoid running analytics against Growth Luna concurrently, and keep the automatic browser-page ceiling as a temporary backstop.

## Validation

- Node syntax checks passed for the new module and modified runners/contracts.
- Three complete isolated Chrome allocate/close cycles each returned to the original page count.
- Existing Growth Runner test suite: **39 passed, 2 failed on stale pre-existing assertions** for Claive environment keys and the earlier `maxPublicMutations=8` default. These do not exercise the tab lease.
- No test likes, follows, reposts or publications were made on the live X account.

## Operational cutover

1. Pause `x-test-growth-agent.timer` without killing the active Growth Agent.
2. Wait for active Growth Agent to finish; ensure no live unresolved publication send and no X browser mutation ongoing.
3. Merge the isolated `fix/browser-tab-lifecycle-20261009` worktree to `main`, push, and restart only where needed (the next oneshot picks up the changed runner).
4. Check a new Growth Run: a page allocated on start and its exact target absent after completion. Preserve the shared Chrome, other tabs, account login and all ledgers.
5. Verify page count does not trend upward from **one new session per run**; any residual drift must be traced in `wh-browser` or popup ownership before claiming fully resolved.
6. Restore `x-test-growth-agent.timer` once verified safe.
