# Browser tab ownership trace (XR-17)

Date: 28 October 2026. Host: `oci-hunter-arm`, aarch64. Checkout:
`/home/ubuntu/repo/x_test`, HEAD `6b29fcb85a71e85ca3351d753bed907c1de49d6f`.
Scope: read-only diagnosis of retained browser evidence. This file is the only
change. No browser, CDP, network, database, state write, model/agent launch,
service, timer, install, Git mutation, credential read, test or build was used.

## Result

The owned-tab lifecycle is clean in all three retained attached sessions. Each
session created exactly one task tab, closed it, and ended with every baseline
target still present, judged from parsed target-ID sets. No session closed a
baseline tab. No owned-tab leak is demonstrated.

Two sessions ended with one extra page that the session did not create with
`tab new`: a blank tab in `0d5c653e6146` and an X Ads lead form in
`8a7361141c08`. Both sessions recorded the exact extra target ID and left it
open, as the current contract requires. Their creator is observed only as
"appeared during the session"; no creation command or event exists.

The October audit's "8 to 9 to 10" baseline rise is not reproduced here.
Baselines are 9, 5 and 5 tabs. Between sessions, five target IDs disappear and
the fifth baseline tab changes identity while four IDs persist, so the shared
browser also changed outside these three sessions. That limits attribution.

Missing evidence: no attached session exercised a failure exit, and all three
ran an older brief. A bounded current-revision normal/failure pair is the
minimum safe check (below). No source or prompt repair is justified.

## Browser identity

| Item | Value |
| --- | --- |
| Browser | existing authenticated Chromium on CDP `9222`; each session `reused:true`, `launched:false`, `relaunchedBrowser:false` |
| CLI sessions | `luna-arm-20261013T161823Z-4defd110`, `luna-arm-20261013T182725Z-754a15ac`, `luna-arm-20261013T190630Z-cbbed7c7` |
| `launchHash` | `2298170486352137716` in every unfiltered tab list of all three sessions |
| Recorded label | `growth-run-luna-182725` on the owned tab in `0d5c653e6146` only |
| Unknown | Chrome pid, version, profile path; no live list was read |

The four persistent targets are identical across all three sessions:
`EE7FB04B22D884108A739F63B939DFB0` (GitHub armada),
`805FD13B9236394CB0A18B0BBBB6FA7E` (GitHub coachwhip),
`855B7683AA54CF5481C5ADD4FDC9AF1C` (X post),
`79948B5CB71E0941365DBF18905AF69F` (noVNC). A restart would change these IDs,
so Chrome persisted. Evidence classes below: **observed** = parsed
`tab list --json`; **reported** = session text or progress write.

## Session `e6cdcb52dd1e`

Run `76f8e503-c077-4637-b83a-aeb6fa20c2f8`, session
`luna-arm-20261013T161823Z-4defd110`, 16:18:24Z to 16:55:02Z (36.6 min).
Launcher exit 0, state `completed`; run `partial` (`budget_exhausted`).

| Phase | Evidence | Target set | Delta |
| --- | --- | --- | --- |
| Baseline | cmd 7, `item_9`, events line 19 | 9 IDs: `EE7FB04B22D884108A739F63B939DFB0`, `805FD13B9236394CB0A18B0BBBB6FA7E`, `5A70133660DA874B8A13961A7E4508A9`, `855B7683AA54CF5481C5ADD4FDC9AF1C`, `E084D82E056EEDEDBD0A6DFFD32CD978`, `514BEB73C89EF4DFA33B645C000BE049`, `79948B5CB71E0941365DBF18905AF69F`, `444AF46F7B4E03D1C33DE94A9A3F1F1A`, `FB83AB072F99F0338E1A331404F9B45F` (active) | — |
| Allocate | cmd 10, `item_12`, line 25: `tab new` | output `about:blank` | new |
| After allocate | cmd 11, `item_13`, line 27 | baseline + `5DA84487528A049F04BF023AD979B6EF` (`t10`, active) | +1 |
| Before close | cmd 123, `item_139`, line 265 | same 10 IDs | 0 |
| Close | cmd 124, `item_140`, line 267: `tab close 5DA844…` | `✓ Tab [t10] closed` | −owned |
| After close | cmd 125, `item_141`, line 269 | baseline 9 exactly; no active tab | **0 vs baseline** |
| Self-report | cmd 126, `item_142`, line 271 | `ownedTabAbsentAfter:true`, 9 IDs listed, `otherTargetsAfter:[]` | agrees with list |

Baseline already held four `about:blank` tabs before allocation (`t3`, `t5`,
`t6`, `t8`) plus active `t9`. Their origin is outside the measured window.
No extra page is visible at the four sampled listings.

## Session `0d5c653e6146`

Run `bd63e3d2-8256-4e65-a6d8-a00494688a1e`, session
`luna-arm-20261013T182725Z-754a15ac`, 18:27:26Z to 19:02:33Z (35.1 min).
Launcher exit 0, state `completed`; run `completed` (`budget_exhausted`).

| Phase | Evidence | Target set | Delta |
| --- | --- | --- | --- |
| Baseline | cmd 6, `item_9`, line 18 | 5 IDs: `EE7FB04B22D884108A739F63B939DFB0`, `805FD13B9236394CB0A18B0BBBB6FA7E`, `855B7683AA54CF5481C5ADD4FDC9AF1C`, `79948B5CB71E0941365DBF18905AF69F`, `A740FCEF4B1DD9C775B657E5BB0CEF5C` (active) | — |
| Allocate | cmd 8, `item_11`, line 22: `tab new --label growth-run-luna-182725 about:blank --json` | parsed JSON: `tabId:t6`, `targetId:BB2FB5269321CAE37704149ED4A0AE90`, `total:6` | new |
| Before close | cmd 182, `item_209`, line 394 | baseline + `BB2FB526…` (`t6`, active) + `B75EDDC99AB36AA4018EE4E3DD1F7636` (`t7`, blank) | +2 |
| Close | cmd 225, `item_253`, line 481: `tab close` (no target) | `✓ Tab [t6] closed` | −owned |
| After close | cmd 226, `item_254`, line 483 | baseline + `B75EDDC9…` | **+1 vs baseline** |
| Self-report | cmd 227, `item_255`, line 485; `result.txt` | owned `t6` closed; five baseline tabs remain; "additional non-owned tab was left untouched" | agrees |

`B75EDDC99AB36AA4018EE4E3DD1F7636` is not in the baseline and has no creation
command. The only in-session click is the account menu (`click @e12`, cmd 12),
which opens no page; the failed `agent-browser tab` probe (cmd 224, `item_252`,
line 479) exited 1 without launching a browser and cannot create one. The
creator is unknown. The close used the active tab, not the recorded target ID,
and did close the owned tab; the post-close list proves it by identity.

## Session `8a7361141c08`

Run `e8fbf05a-1122-4dd7-8f3a-f0a9a5b0a40a`, session
`luna-arm-20261013T190630Z-cbbed7c7`, 19:06:31Z to 19:33:33Z (27.0 min).
Launcher exit 0, state `completed`; run `completed`
(`no_worthwhile_eligible_work`).

| Phase | Evidence | Target set | Delta |
| --- | --- | --- | --- |
| Baseline | cmd 4, `item_5`, line 12 | 5 IDs: `EE7FB04B22D884108A739F63B939DFB0`, `805FD13B9236394CB0A18B0BBBB6FA7E`, `855B7683AA54CF5481C5ADD4FDC9AF1C`, `79948B5CB71E0941365DBF18905AF69F`, `D53D7C49321AB17214D1CFCB3EA8588B` (active) | — |
| Allocate | cmd 7, `item_8`, line 18: `tab new https://x.com/home` | output `https://x.com/home` | new |
| After allocate | cmd 8, `item_9`, line 20 | baseline + `DD7CF7474AC7D094554745F99D4D2745` (`t6`, active) | +1 |
| Candidate trigger | cmd 109, `item_119`, line 231: `click @e518` | `✓ Done`; `<url>` stayed `https://x.com/home` at cmd 110 | ? |
| Before close | cmd 163, `item_180`, line 346 | baseline + `DD7CF747…` + `C76F3FF3B9C33160B8709CC50CA764C9` (`t12`, Ads lead form) | +2 |
| Record extra | cmd 164, `item_182`, line 349 | progress names `C76F3FF3…` (`t12`) before close | — |
| Close | cmd 165, `item_183`, line 351: `tab close DD7CF747…` | `✓ Tab [t6] closed` | −owned |
| Verify | cmd 166, `item_184`, line 353 | `ownedTargetPresent:false`, `baselineTargetsPresent:true`, remaining = baseline + `C76F3FF3…` | **+1 vs baseline** |
| Self-report | cmd 167, `item_185`, line 355; `result.txt` | same, plus exact `t12` | agrees |

`C76F3FF3B9C33160B8709CC50CA764C9` first appears at cmd 163; there is no tab
list between the click and that list, so creation is not observed. The click on
the Alibaba promo card is the only in-session action that can open a page, and
the extra target is an ads lead form. Treat the click as a supported trigger,
not proof. The gap `t7`–`t11` (five tab IDs between the owned `t6` and `t12`)
shows other tab churn that the session did not command.

## Cross-session identity

| Transition | Parsed change |
| --- | --- |
| `e6` end → `0d5` baseline | common 4; removed `5A7013…`, `E084D8…`, `514BEB…`, `444AF4…`, `FB83AB…`; added `A740FCEF…` |
| `0d5` end → `8a` baseline | common 4 (same four); `A740FCEF…` replaced by `D53D7C49…`; `B75EDDC9…` gone |

Chrome persisted (four IDs unchanged), so these are external closes/opens, not
a restart. They also show the browser is shared and mutable between runs. No
ownership is assigned to those changes. This sample does not show a monotonic
baseline rise: 9, 5, 5. Peak within-session counts are 10, 7, 7.

## Collector counter-example `b54e3e759e21`

Worker ran 2026-10-28 03:46:22Z–03:48:19Z (1m57s), Codex `gpt-6-luna`,
exit 0. The child pinned the pre-allocated blank page
`BD6F4F503CBF6FE7881890CD0C0F1A68` (cmd 6, `item_6`, events line 15) and issued
no `tab new` or `tab close` (1 of 15 commands touches tabs). Its parent,
`growth_analytics_runner.js`, owns the lease in `ops/agent_browser_session.js`.
The XR-06 report (line 125) quotes the journal:
`{"targetId":"BD6F4F503CBF6FE7881890CD0C0F1A68","cleaned":true,"warnings":[]}`.
This is a different lifecycle: launcher lease plus exact CDP close, not an
agent-driven CLI close. It demonstrates exact cleanup for a blocked collection
(result blocked by login, still exit 0).

## What the current owner already covers

- `ops/agent_browser_session.js`: snapshots pages before allocation, accepts
  exactly one new `about:blank` page, pins it, closes only that target, polls
  the exact target for closure, and warns about any other new page without
  closing it (`release()` lines 156-177). Existing regression:
  `tests/browser_tab_lease.test.mjs`.
- `ops/browser_operator_contract.js` line 8 already requires
  `tab close <targetId>` for the session's own tab, one `tab new` per run, and
  no closing of other runs' tabs. That repairs the weak step seen in `0d5`
  (bare `tab close`).
- `ops/systemd/arm/arm-growth-live.md` lines 9 and 48 already require
  baseline listing, one owned tab, closing only owned tabs, verification, and
  recovery identities when a normal finish is impossible. No duplicate
  cleanup instruction is needed.
- `8a` shows the recovery-identity path working: extra target recorded before
  close, exact ID retained afterwards.

## Finding

No defect in the allocated-tab lifecycle is demonstrated. The causal sequence
for the observed drift is only partial:

1. Each run allocates one page and closes that exact page.
2. Page-created or external pages appear during two runs (`t7`, `t12`) and stay
   open because ownership is not established.
3. Those pages are reported with exact IDs, so they are recovery identities,
   not silent leaks.
4. Independent changes between runs also add and remove tabs.

The remaining gap is evidence, not a proven source bug. Missing:
a failure exit; a current-revision run; an independent tab list after close;
creation events for the two extras; and process-level browser identity.

## Minimum safe bounded lifecycle check

Run only after the parent authorizes browser use and model launch. Use no public
action, so the check changes no X state.

1. Normal exit: one attached Growth Run on the current brief with a zero-action
   or urgent-only pass. Capture parsed `tab list --json` at three points:
   before `tab new` (B0), after `tab new` (B1), after `tab close` (B2).
   Accept when `B1 \ B0` is exactly the recorded owned target, that target is
   absent from B2, and `B0 ⊆ B2`. Record any `B2 \ B0` IDs verbatim and leave
   them open.
2. Failure exit: one more launch on the same revision, stopped by the documented
   failure boundary after allocation (hard deadline or an unrecoverable browser
   error). Accept when `live-progress.json` holds B0 and the owned target, no
   baseline tab was closed, and the next listing shows the owned target present
   or reports a browser restart. Do not close an unowned target to pass.
3. Compare only these two runs. Do not use the October 13 counts as a matched
   baseline.

## Acceptance coverage

| Exit | Owned tab | Baseline tabs | Extra pages | Evidence |
| --- | --- | --- | --- | --- |
| Normal, 3/3 | closed and absent by parsed list | all present, 3/3 | 2/3 had one; both reported by exact ID; none closed | observed |
| Failure, attached path | **not covered** | **not covered** | **not covered** | none |
| Blocked collector, 1/1 | exact lease target closed, `cleaned:true` | not compared | none reported | journal via XR-06 |

## Limits

- All three sessions ran 2026-10-13 with 12,995–13,888-byte prompts; the
  current brief is 15,544 bytes and has a rest gate. No measured run matches it.
- Final sets are session-recorded responses, not an independent live read.
- `t7` and `t12` have no observed creation event. The `8a` click is a plausible
  trigger only.
- This sample cannot explain the October audit's count rise or assign ownership
  to pre-existing blank tabs.
- No token, cost or other-worker claim is made. No Growth Run or public action
  was performed.

## Read-only commands

```bash
jq -c '{id,label,engine,model,reasoning_effort,status,exit_code,started_at,ended_at,workspace}' \
  ~/.local/state/claive/<job>/state.json
jq -r 'select(.type=="item.completed" and .item.type=="command_execution") |
  .item.id + "\t" + (.item.command|gsub("\n";" "))' \
  ~/.local/state/claive/<job>/events.jsonl
jq -r 'select(.type=="item.completed" and .item.type=="command_execution" and
  (.item.command|test("tab (list|new|close)"))) |
  .item.aggregated_output' ~/.local/state/claive/<job>/events.jsonl
cat ~/.local/state/claive/<job>/result.txt
jq -r '.details[]? | (.command // "")' \
  ~/.local/state/claive/0d5c653e6146/evidence/turn-0001/warnings.json
```

Jobs read: `e6cdcb52dd1e`, `0d5c653e6146`, `8a7361141c08`,
`b54e3e759e21`. No other worker or project state was opened.
