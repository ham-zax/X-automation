# Analytics collector acceptance — 2026-10-28

Read-only diagnosis for XR-06. No collector, browser, network, model CLI, service,
timer, SQLite query, credential file, Growth OS state write, or Git mutation was used.
This report is the only file written.

## Checked host and time

| Item | Value |
| --- | --- |
| Host | `oci-hunter-arm`, `aarch64`, user `ubuntu` |
| Repo | `/home/ubuntu/repo/x_test` |
| HEAD | `6b29fcb85a71e85ca3351d753bed907c1de49d6f` |
| Dirty paths before this report | 42 |
| Checks | 2026-10-28T17:16Z to 17:23Z |
| Report time | 2026-10-28T17:24Z |
| Final tree check | 2026-10-28T17:26Z, 43 paths: 42 preserved plus this report |

## Owner path and installed revision

| Item | Value |
| --- | --- |
| Installed service | `/home/ubuntu/.config/systemd/user/x-test-growth-analytics.service` |
| Versioned service | `ops/systemd/arm/x-test-growth-analytics.service` |
| Service diff | Byte-identical, `diff` exit 0 |
| Installed timer | `/home/ubuntu/.config/systemd/user/x-test-growth-analytics.timer` |
| Timer diff | Byte-identical, `diff` exit 0 |
| `ExecStart` | `/usr/local/bin/node growth_analytics_runner.js` |
| `WorkingDirectory` | `/home/ubuntu/repo/x_test` |
| Actual runner | `/home/ubuntu/repo/x_test/growth_analytics_runner.js` |
| Prompt | `ops/analytics_collector_prompt.md`, clean, mtime 2026-10-09T08:40:29Z |
| Checkpoint | `/home/ubuntu/.local/state/x_test/analytics-collector.json` |
| Service state | `inactive`, `Result=success`, last `ExecMainStatus=0` at 16:47:21Z |
| Timer state | `active`, `enabled`, last trigger 16:47:21Z, next 2026-10-29T03:47:28Z |

The installed unit runs the repository file. It does not run a copied runner.

The growth agent service was `inactive` and its timer was `disabled`. The runner's
Growth Luna ownership check therefore did not block these runs. Both skips name the
cooldown.

Current hashes:

- Runner: `4db89e96bdeb14b14a07314681519304ddbbdd54c5d6d451d7de0b13eb20d7bb`
- Prompt: `d80b27ff4e7343a8929b849d562eacbe1925cffc47cdac5e6d628c15f9150816`
- Service: `8cb33e38bae3313be6feba444ea46abdf4c6586ea874c1344e31987886d47bee`
- Timer: `00630b18e084300705e96e275c0518580b825272052af1bcba81fb7426c5156f`

The runtime code is the dirty working tree. The only runner diff against HEAD is the
cooldown classification: `failed` gets 1 hour, all other states keep 21 hours. The
runner mtime is 2026-10-28T12:55:45Z. The 03:46 collection predates that mtime. The
16:47 skip used the current file. The exact bytes at 03:46 are not provable. The
`--reasoning-effort max` line is unchanged between HEAD and the working tree.

## Latest invocation is not the latest collection

| Time (UTC) | Event | Evidence |
| --- | --- | --- |
| 2026-10-28T03:46:21.607Z | Checkpoint `lastStartedAt` | checkpoint file |
| 03:46:22.347Z | Worker `b54e3e759e21` starts | journal and `state.json` |
| 03:46:22Z | Session `01a1809d-ba35-7071-ba53-b676e249edbb`, engine `codex`, model `gpt-6-luna`, effort `max` | journal |
| 03:47:25.441Z | Stored-only analysis revision 21 generated | `growth-analysis` |
| 03:48:19.257Z | Worker ends, exit 0 | `state.json` |
| 03:48:19.294Z | Checkpoint `status=completed`, `exitCode=0` | checkpoint file |
| 03:48:19Z | Owned-tab cleanup reports `cleaned=true` | journal |
| 09:50:21Z | Unit skips: recently attempted | journal |
| 16:47:21Z | Unit skips: recently attempted | journal |

The latest unit invocation was a 21-hour cooldown skip. It launched no child and wrote
no checkpoint. The `completed` checkpoint is from 03:48, not from 16:47. The service
`Result=success` at 16:47 describes a successful skip, not a successful collection.

Under the 21-hour rule, the next eligible start is 2026-10-29T00:46:21Z. The next timer
tick is 03:47:28Z, so that tick can start a collection if the checkpoint stays
`completed`.

## Outcome and measured writes

The 03:46 child reported:

- New posts measured: **0**. No post or audience metrics were recorded.
- The public profile showed `@ham_zax` and **66 followers**.
- Account Analytics redirected to a login form.
- `operator-status` reported `xAuthenticated:false`.
- The login gate blocked collection. The child did not save the follower count.

Read-only bridge `analytics` with `limit=500` and `audienceLimit=200`:

| Measure | Value |
| --- | --- |
| Stored post rows | 494 |
| Latest post `captured_at` | 2026-10-24T03:51:45.865Z |
| Post rows after run start 03:46:21.607Z | 0 |
| Stored audience rows | 2 |
| Latest audience `capturedAt` | 2026-10-23T03:54:13.955Z |

Read-only bridge `growth-analysis`:

| Field | Value |
| --- | --- |
| Revision | 21 |
| `generatedAt` | 2026-10-28T03:47:25.441Z |
| `measuredPosts` | 388 |
| `analyticsAgeDays` | 4 |
| `provenance` | `stored_post_metrics_only` |

Read-only bridge `operator-status`:

| Field | Value |
| --- | --- |
| Followers | 66 |
| `followersCapturedAt` | 2026-10-24T03:47:20.815Z |
| `followersSource` | `authenticated_x_profile` |

The run wrote a derived analysis refresh from stored rows. It wrote no new post or
audience measurements. The zero is truthful for this run. The cause is an authentication
gate, not evidence that no new posts exist. The 66-follower display is a four-day-old
observation, not a current measurement.

## Owned-tab cleanup

The journal reports:

```text
Analytics browser tab cleanup: {"targetId":"BD6F4F503CBF6FE7881890CD0C0F1A68","cleaned":true,"warnings":[]}
```

The lease allocates exactly one new blank tab and verifies that it is the active pinned
page. Release disconnects the session, snapshots the tab list, closes that exact target
if it is still present, and verifies closure. It warns on a browser restart, a still
present target, or extra new tabs. No warning appeared. The target is absent after
release. A live tab list was not read, because browser access is outside this diagnosis.

Exact owned-tab cleanup is demonstrated for the 03:46 run.

## Demonstrated defect

The runner equates child exit 0 with a completed collection. At
`growth_analytics_runner.js:62` it sets `status=completed` whenever `code===0`.

Evidence chain:

1. The child exited 0 after an explicit login gate.
2. The checkpoint says `completed`.
3. The 21-hour cooldown applied.
4. The 09:50 and 16:47 ticks skipped.

XR-07 gives a one-hour retry only to `status=failed`. A blocked child never produces that
status. The reporting and cleanup were truthful. The defect is the failure
classification and the lost retry opportunities.

Minimal repair boundary:

- Add an explicit child outcome contract. The runner already owns a temporary prompt
  directory. Pass an absolute outcome-file path in the prompt.
- The prompt requires one outcome: `collected`, `zero_with_access`, or `blocked`. A login
  form, `xAuthenticated:false`, or inaccessible Analytics is `blocked`.
- The runner reads the file after the child exits. Keep `completed` for `collected` and
  `zero_with_access`. Set `failed` for `blocked`, missing, or invalid. The existing
  one-hour failed cooldown then applies.

Files: `growth_analytics_runner.js` and `ops/analytics_collector_prompt.md`. No unit,
timer, schema, service, dependency, credential, or public-action change. Do not use row
count alone as the classifier. A truthful zero must stay completed.

This repair belongs to the XR-07 failure-recovery boundary. It is not a new XR-06
collection defect.

## Acceptance status

XR-06 evidence is sufficient for review:

- The collector started with the supported engine, model, and effort.
- It reported an accurate blocker.
- It released its exact owned tab.

The measurement goal is not met:

- No authenticated collection has run since 2026-10-24.
- The 16:47 tick did not launch a browser. Current X authentication state is unknown.
- The current dirty runner's failed path has no production evidence.
- The exact runner bytes at 03:46 are not provable.
- The follower count is four days old.

Minimal next checks, after the parent decides the repair:

1. Run one authorized bounded collection, or read the next timer result. Compare its
   journal outcome with bridge `captured_at` values after the run start.
2. After the classification repair, one blocked run should show `status=failed` and a
   one-hour retry. One successful run should show new `captured_at` rows.
3. Record the runner hash in the checkpoint at start, so each run revision is provable.

## Exact commands

```bash
date -u; uname -m; hostname; whoami
systemctl --user list-units --type=service --all --no-legend | rg -i 'growth|analytics|collector'
systemctl --user list-timers --all --no-legend | rg -i 'growth|analytics|collector'
systemctl --user show x-test-growth-analytics.service -p FragmentPath -p ExecStart \
  -p WorkingDirectory -p Result -p ExecMainStatus -p ExecMainStartTimestamp \
  -p ExecMainExitTimestamp
systemctl --user show x-test-growth-analytics.timer -p FragmentPath -p TimersCalendar \
  -p LastTriggerUSec -p NextElapseUSecRealtime -p Persistent
diff -u ops/systemd/arm/x-test-growth-analytics.service \
  ~/.config/systemd/user/x-test-growth-analytics.service
diff -u ops/systemd/arm/x-test-growth-analytics.timer \
  ~/.config/systemd/user/x-test-growth-analytics.timer
stat -c '%y %s %n' ~/.local/state/x_test/analytics-collector.json
cat ~/.local/state/x_test/analytics-collector.json
journalctl --user -u x-test-growth-analytics.service --since '2026-10-27 00:00:00' \
  --no-pager -o short-iso | rg -n 'Analytics|Worker|Session|cleanup|skipped|Finished'
journalctl --user -u x-test-growth-analytics.service --since '2026-10-28 03:46:00' \
  --until '2026-10-28 03:49:30' --no-pager -o cat
echo '{"limit":500,"audienceLimit":200}' | npm run --silent agent -- analytics \
  | jq -c '{posts:(.posts|length), aud:(.audience|length), postMax:(.posts|map(.captured_at)|max), afterCollector:(.posts|map(select(.captured_at > 1793159181607))|length), audMax:(.audience|map(.capturedAt)|max)}'
echo '{}' | npm run --silent agent -- operator-status \
  | jq -c '.account | {followers, followersCapturedAt, followersSource}'
echo '{}' | npm run --silent agent -- growth-analysis \
  | jq -c '{revision, generatedAt, measuredPosts, analyticsAgeDays, provenance}'
jq -c '{engine,model,reasoning_effort,exit_code,status,terminal,turn,started_at,ended_at}' \
  /home/ubuntu/.local/state/claive/b54e3e759e21/state.json
git status --porcelain
git diff -- growth_analytics_runner.js
sha256sum growth_analytics_runner.js ops/analytics_collector_prompt.md \
  ops/systemd/arm/x-test-growth-analytics.service ops/systemd/arm/x-test-growth-analytics.timer
```

No command in this report was run against the collector, a browser, a service, a timer,
a credential store, or SQLite directly.

## Owner-authorized authentication, 29 October 2026, 06:20 UTC

The owner supplies X login cookies and explicitly requests persistence for future
use. Parent saves AUTH_TOKEN and CT0 in the existing Git-ignored .env with mode
0600. No cookie value, local storage or browser-state export enters tracked files.
Parent imports the two cookies into the existing ARM Chrome on CDP 9222.
Authenticated Home shows Profile https://x.com/ham_zax and the Hamza composer
identity. Premium exposes Analytics at https://x.com/i/account_analytics.
The Analytics page displays Account overview, Overview/Audience/Content tabs,
date controls and measurement data. The earlier login blocker is resolved for
this observed browser session. No collector run or measured database write is
claimed. No public action, growth timer activation or service reload occurs.

Temporary session owner-x-login owns target 0E93BB6DBEA8E353BC0B94EDFE82E6D8.
Parent closes that exact target, disconnects the session and stops the temporary
Agent Browser dashboard. CDP remains live with the exact baseline target
25BA99D2B9C4CDBBD193E52DBF529282. Chrome is not terminated. The failed private
secret card was cancelled. No private-card file requires cleanup.
This explicit authentication request supersedes the earlier no-credential-change
scope only for the supplied X cookies. Dispatch consumption remains 22/22.
