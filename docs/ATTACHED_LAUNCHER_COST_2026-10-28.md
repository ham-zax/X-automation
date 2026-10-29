# Attached launcher cost baseline (XR-15)

Date: 28 October 2026. Host: `oci-hunter-arm`, aarch64. Checkout:
`/home/ubuntu/repo/x_test`, HEAD `6b29fcb`. Scope: read-only diagnosis for XR-15.
This file is the only change. No source, test, ledger, plan, inventory or state edit.
No launcher run, Growth Run, model call, browser, network, service, timer, database
read, install, test, build, Git mutation, credential read or delegation.

## Result

Three retained attached-live sessions give a usable historical baseline for the
actual launcher path. The sessions ran 27.0 to 36.6 minutes, made 127 to 228 tool
calls, used 9.56M to 16.90M input tokens, and read 96.9% to 98.2% of that input
from the provider cache. The October 13 handoff numbers for two of the sessions
match the retained provider counters exactly.

One concrete avoidable cost survives in the current path. The live brief requires
saved drafts to outrank new collection, but its command sheet has no `queue`
entry. The agent therefore probed `queue` raw and then read protocol text to
interpret it. In session `8a7361141c08`, this sequence produced 75,812 bytes of
queue-related output for the 5,497 bytes the agent used. At least 70,315 bytes
(92.7%) were avoidable.

No repair is executed. The current brief differs from all three measured prompts.
XR-15 acceptance still needs one matched current-revision pair. This diagnosis
cannot run it.

## Sources checked

| Source | What it gave | Limit |
|---|---|---|
| `~/.local/state/claive/<job>/state.json` | Label, engine, model, effort, workspace, start/end, timeout, step count, task failures, rendered prompt in `command` | `steps` is one turn, not a model-call count |
| `~/.local/state/claive/<job>/events.jsonl` | One `turn.completed.usage` block per job. Tool calls and captured output bytes | Captured output, not proven model-visible text |
| `~/.local/state/claive/<job>/result.txt` | Session-reported passes, confirmed replies, skips, cleanup | Self-reported by the agent. Not checked against the database |
| `~/.local/state/claive/<job>/evidence/turn-0001/warnings.json` | Failed tool calls with command text | Only failed calls |
| `claive list` | 0 running, 17 done, 1 failed, 2 stopped, 1 need you. No live-labeled worker for this checkout | Shows only 20 recent results. The October 13 jobs are outside that window |
| `claive show <id> --json` | `token_usage:null`, `usage:null`, `context_tokens:null`, `steps:1` | No usage or context fields |
| `claive usage <id> --json` | `claive: retained Codex session file is unavailable` | The documented usage command cannot read these jobs |
| `journalctl --user -u x-test-growth-agent.service --since '2026-10-13 00:00'` | No records | Empty output |
| `~/.local/state/x_test/live-progress.json` | Last write `2026-10-13T21:15:16Z`, session `luna-arm-20261013T210944Z-a450d407` | State file, read only |
| `~/.local/state/x_test/arm-growth-live.prompt.md` | Retained rendered prompt, 14,051 bytes, mtime `2026-10-13T21:09:44Z` | One prior revision |
| `~/.codex/sessions` | No October 13 rollout. Earliest day is October 17 | No per-request context or model-call data |
| `ops/systemd/arm/attached-live.conf` | `ExecStart` selects `arm-growth-live.sh`. Browser interface `agent-browser-cli` | Versioned drop-in |
| `ops/systemd/arm/arm-growth-live.sh` | Renders the brief and execs Claive Codex | Versioned launcher |
| `ops/systemd/arm/arm-growth-live.md` | Current brief and command sheet | Working copy, modified by the current run |
| `ops/browser_operator_contract.js` | Browser paragraph source | Only the browser contract |
| `agent_bridge.js` | `queue` handler and `compactQueue` | Current source |
| `docs/plans/XGROWTH_HANDOFF_2026-10-13.md` | Historical cost section | Hand-recorded |
| `docs/X_GROWTH_ISSUES.md` and the XR-15 packet | Acceptance and limits | Read only |

The current Claive registry has no live-labeled worker for this checkout. The
registry is not a complete history. Seven completed `XGrowth live ARM` jobs from
`/home/ubuntu/repo/x_test` remain under `~/.local/state/claive`. The list command
shows only 20 recent results, so it does not show them.

## Selected sessions

Seven attached-live jobs from October 13 are retained. Three were selected. Two
are the sessions that the handoff documents. The third is the last full
multi-pass session. Four later jobs were short rest-window or early-stop runs and
were not measured.

| Job | Run | Session | Start UTC | Min | Passes | Replies | Skips | Failed calls | Prompt bytes |
|---|---|---|---|---|---|---|---|---|---|
| `e6cdcb52dd1e` | `76f8e503-c077-4637-b83a-aeb6fa20c2f8` | `luna-arm-20261013T161823Z-4defd110` | 16:18:24 | 36.6 | 2 | 2 | 23 | 14 | 12,995 |
| `0d5c653e6146` | `bd63e3d2-8256-4e65-a6d8-a00494688a1e` | `luna-arm-20261013T182725Z-754a15ac` | 18:27:26 | 35.1 | 4 | 6 | 44 | 4 | 13,552 |
| `8a7361141c08` | `e8fbf05a-1122-4dd7-8f3a-f0a9a5b0a40a` | `luna-arm-20261013T190630Z-cbbed7c7` | 19:06:31 | 27.0 | 5 | 3 | 11 | 3 | 13,888 |

All three used Codex `gpt-6-luna` at effort `max`, with `turn_timeout` 2700
seconds. The workspace was `/home/ubuntu/repo/x_test`. The session ID format and
label match the versioned launcher. The prompt size is the UTF-8 length of the
final `command` argument in `state.json`, which retains the rendered brief.

The pass count for `8a7361141c08` is four discovery passes plus one urgent-only
pass. The stop reasons in `result.txt` are `budget_exhausted` for
`e6cdcb52dd1e` and `0d5c653e6146`, and `no_worthwhile_eligible_work` for
`8a7361141c08`.

## Measured baseline

| Metric | `e6cdcb52dd1e` | `0d5c653e6146` | `8a7361141c08` |
|---|---:|---:|---:|
| Duration (min) | 36.6 | 35.1 | 27.0 |
| Tool calls | 127 | 228 | 171 |
| Captured tool output (bytes) | 637,384 | 1,021,349 | 475,384 |
| Total input tokens | 9,563,546 | 16,901,281 | 16,409,747 |
| Cached input tokens | 9,268,480 | 16,430,336 | 16,107,008 |
| Cached share of input | 96.9% | 97.2% | 98.2% |
| Uncached input tokens | 295,066 | 470,945 | 302,739 |
| Output tokens | 100,253 | 164,054 | 115,162 |
| Reasoning output tokens | 79,014 | 121,977 | 87,049 |
| Reasoning share of output | 78.8% | 74.4% | 75.6% |
| Confirmed replies (reported) | 2 | 6 | 3 |
| Input tokens per confirmed reply | 4,781,773 | 2,816,880 | 5,469,916 |
| Input tokens per minute | 260,978 | 481,195 | 606,962 |

### Counter semantics

- `input_tokens` is the provider total for the whole run. It includes cached
  input. It is not the context-window size.
- `cached_input_tokens` is a subset of `input_tokens`. Do not add it. Uncached
  input is the difference: 295,066, 470,945 and 302,739 tokens.
- `cache_write_input_tokens` is 0 in all three jobs. The field did not report
  writes. Do not read 0 as "no cache writes". The high cache-read share proves
  caching occurred.
- `output_tokens` includes reasoning. `reasoning_output_tokens` is a subset. Do
  not add the two.
- Each job has one `turn.started` and one `turn.completed`. The single usage block
  is the run total. There is no cumulative-event stack to sum, so the table has no
  double counting.
- Claive `steps:1` means one turn. It is not one model call.
- `context_tokens` is null. Peak request context is not recorded in the retained
  artifacts.
- `claive usage` cannot read these jobs because the Codex rollout file is gone.
  The counters above come from the Codex `turn.completed` event that Claive
  retained.
- Captured tool output is the sum of `aggregated_output` bytes over completed
  command items. It is not proven model-visible text. A CLI output cap would
  reduce the model share.

## Cross-check with the October 13 handoff

The retained counters match the handoff for both documented sessions.

- `e6cdcb52dd1e`: handoff 9,563,546 input, 9,268,480 cache reads, 100,253 output.
  Retained values are identical.
- `0d5c653e6146`: handoff 16,901,281 input, 16,430,336 cache reads, 164,054
  output. Retained values are identical.

The handoff also records 76 model calls and peak context 243,511 tokens for
`e6cdcb52dd1e`. No retained artifact records either value. The 76-call figure
would imply 125,836 input tokens per call at the measured total, but that is a
derived average, not a measured call count. Treat the peak context as
hand-recorded and unverified.

## Concrete avoidable cost: the queue probe

The live brief says saved drafts outrank new collection (`arm-growth-live.md`
line 39). The command sheet has no `queue` entry. The brief also says to use the
sheet instead of probing shapes (line 5). The sheet is not complete for this
flow.

Session `8a7361141c08` shows the consequence.

| Command | Bytes | What it returned |
|---|---:|---|
| `queue` with `{}` | 61,662 | 20 drafts (12,809 bytes) and 20 queue items (48,756 bytes) |
| `rg` in `docs/GROWTH_RUN_PROTOCOL.md` for saved drafts and queue terms | 8,653 | Protocol text to interpret the missing command |
| `queue` piped through a field projection | 5,497 | 16 drafts with 5 fields each (4,657 bytes) |

The third call supplied the information the agent used. The first two calls cost
70,315 bytes that the session did not need. That is 92.7% of the queue-related
context.

The raw payload is broad. Each queue item carried 45 fields. The `behavior`
object alone was 16,591 bytes, or 34.0% of the item bytes. `approvalSnapshot`
occupied 3,416 bytes. Routing prose occupied 4,735 bytes. The drafts were mostly
empty metadata: 19 of 20 had empty `hook`, `insight` and `evidence`, and 3 of 20
had an empty `body`. The useful signal was the set of draft IDs and statuses.

Session `0d5c653e6146` shows the same shape with a filter.

| Command | Bytes | Notes |
|---|---:|---|
| `queue {"status":"drafting","limit":10}` | 32,507 | 10 items (26,064 bytes) and 10 drafts (6,346 bytes) |
| `queue {"status":"needs_review","limit":10}` | 9,002 | 1 item (2,559 bytes) and the same 10 drafts |

The two draft arrays are byte-identical: same IDs 185 to 194, same 6,346 bytes,
7 with a non-empty body. The second response repeated 6,346 bytes. The first
response's `behavior` object was 8,158 bytes, or 31.3% of its item bytes. The
26,064 bytes of drafting item fields are broad but not proven unused, because
the agent asked for that status. The duplicate draft array is the clear waste in
this session.

The current code still produces this shape. `compactQueue` is unchanged since
commit `83ace00` (13 October). It keeps every queue-item field except
`engagement`, and it adds `engagePriority`. The `queue` handler still defaults
`limit` to 20 for both lists. `{"detail":true}` returns more, never less. The
hint text says only "pass `{"detail":true}` for full evidence". There is no
summary mode.

### Cost bound

The measured fact is 70,315 avoidable bytes in `8a7361141c08`. Session
`0d5c653e6146` repeated a byte-identical 6,346-byte draft array in its two queue
responses. These are captured bytes, not token counters.

The token effect is a bound, not a measurement. At 2.2 to 4 bytes per token, the
70 KB block is 17,600 to 32,000 tokens. The raw `queue` call was command 17 of
171. If the block stayed in context and each of the 154 later commands caused a
separate model request, the block accounts for at most 2.7M to 4.9M input
tokens. That is 16% to 30% of the session's 16.41M input. A CLI output cap,
request batching, or context compaction would reduce the share. The retained
artifacts do not record which of these occurred. The matched run below measures
the real delta.

Do not read the table as a matched benchmark. The three sessions had different
pass counts, reply counts and workloads. The baseline shows the launcher's cost
shape. It does not prove that one session was more efficient than another.

## Exact owning path

The launcher is `ops/systemd/arm/arm-growth-live.sh`. The versioned drop-in
`attached-live.conf` selects it. The script renders the brief and the browser
contract into `~/.local/state/x_test/arm-growth-live.prompt.md`, then executes:

```
claive run --workspace /home/ubuntu/repo/x_test --prompt-file <rendered brief>
  --engine codex --model gpt-6-luna --reasoning-effort max --web
  --turn-timeout 2700 --label "XGrowth live ARM"
```

The script reads `growth_agent_runner.js` only for `runtimeConfig().codexExecutable`
and for the browser contract inputs. `growth_agent_runner.js` does not own the
attached session loop, the context growth or the tool-call pattern. A runner-only
change cannot fix this cost.

The cost has two owners.

1. The trigger is the live brief, `ops/systemd/arm/arm-growth-live.md`. Line 18
   names the approved queue. Line 39 makes saved drafts outrank new collection.
   The command sheet has no `queue` entry. The only `queue` mention in the whole
   file is line 18.
2. The payload size is `agent_bridge.js`. The `queue` handler is at line 1673.
   `compactQueue` is at line 612. The default `limit` is 20.

`AGENTS.md` says `queue` is compact by default. That is true. It is still 62 KB
for 20 items, because compact removes only two fields.

## Smallest supported repair

Recommended: a docs-only change to the live brief. Add one `queue` command-sheet
entry with an exact bounded payload and the fields a Growth Run needs. Example:

```
- `queue` `{"draftStatus":"draft","status":"needs_review","limit":5}` →
  `{drafts:[{id,status,candidateKey,body}], queueItems:[{id,status,pipeline,
  targetUsername,targetTweetId,engagementKind,expiresAt,humanApprovedAt,
  outputUrl}]}`. Call it once at startup only when saved drafts or items awaiting
  review may exist. Read drafts and review items only. Do not list published or
  expired history.
```

Expected effect with the observed rows and this filter: 61,662 bytes becomes
about 3,200 bytes (5 drafts, 0 review items), and 32,507 bytes becomes about
5,700 bytes (5 drafts, 1 review item). A broader status filter returns more.
The exact value depends on the saved rows. The change adds no authority, removes
no gate and changes no model.

Alternative, if the parent wants a bounded default for every caller: project
`compactQueue` to the same fields and add counts by status. Keep
`{"detail":true}` unchanged. In the measured payloads this projects the
61,662-byte response to 17,623 bytes with drafts unchanged, or 10,161 bytes if
drafts also keep only `id`, `status`, `candidateKey` and `body`. The 32,507-byte
response projects to 8,476 and 4,659 bytes. This is a shared-command change and
needs its own review.

Do not change the model, the effort, the turn timeout, the run lease, the
recovery gates, the claim gates or the send path. Do not add reply quotas. Do not
reimplement the completed compact, rest or scout work.

The exact measurable change to test: queue-related output bytes per session,
number of `queue` calls, total and uncached input tokens, pass count and confirmed
outcomes. Queue bytes are deterministic. Total tokens are not, so report both.

## Minimum bounded measurement for acceptance

XR-15 needs one matched pair on the current revision. The parent owns the
authorization and the run.

1. Run one attached-live session on the current brief with at least one saved
   draft present. Record the queue commands and their output bytes from
   `events.jsonl`. Record `turn.completed.usage`, passes, replies, skips and
   failures.
2. Apply only the selected repair.
3. Run a second session on the same host, model, effort and brief revision, with
   the same saved-draft trigger and a comparable pass bound.
4. Check that the queue output is at most 10 KB for the selected filter, that no
   raw `queue` probe and no protocol lookup for queue terms occur, and that the
   same draft IDs remain visible to the agent.
5. Compare input per pass and per confirmed action, not raw session totals.
   Report the variance. Do not call a difference between different workloads a
   matched benchmark.

Without step 1 and step 3, the repair is supported by payload bytes only. The
total-cost reduction remains unproven.

## Already repaired, do not duplicate

- Startup document reads. `e6cdcb52dd1e` used 145,374 bytes in local reads,
  including policy, niche, relationship and network documents. `8a7361141c08`
  used 47,412 bytes. The brief now says the bridge returns those values and names
  the documents not to read.
- `operator-status` detail. `e6cdcb52dd1e` used `{"detail":true}` and received
  one 69,701-byte response. The brief now allows one detail call per session.
- Scout output. `0d5c653e6146` used 110,834 bytes over 5 calls (22.2 KB each).
  `8a7361141c08` used 22,675 bytes over 5 calls (4.5 KB each) after commit
  `77517f1`. The compact scout fix works.
- Browser skill text. `e6cdcb52dd1e` read browser skill files and ran
  `agent-browser skills get core`. The current browser contract lists the
  commands and says not to load the skill text.
- `record-disposition` field name. `e6cdcb52dd1e` had 12 rejections from the old
  `candidateKey` field, one `growth-run-finish` rejection and one `help` probe
  that exited 1. The current brief uses `key`. These account for all 14 failed
  calls in that session.

## Blockers and limits

- No live-labeled worker and no growth-service journal record since 13 October.
  No new attached session can be measured from this diagnosis.
- The October 13 Codex rollout files are not under `~/.codex/sessions`, and
  `claive usage` cannot read the jobs. Peak context and model-call count are
  unknown.
- The current brief is 15,544 bytes and has a rest gate. The measured rendered
  prompts were 12,995 to 13,888 bytes and had no rest gate. No measured session
  ran the current revision.
- Outcomes are session-reported. The database was not read, so confirmed reply
  counts and skip counts are not independently verified.
- The model-visible tool output may be smaller than the captured output. The
  exact cap is not recorded.
- The queue rows that exist today are unknown. A session with no saved drafts
  would not trigger the cost.
- The brief is a production file under `ops/systemd/arm/`. The parent must
  version, review and deploy the change. This diagnosis does not authorize that.
- A `compactQueue` change touches a shared command. It needs review beyond this
  diagnosis.

## Commands used

All commands were read-only. No state write, service call or model call was made.

```bash
claive list
claive show 8a7361141c08 --json
claive usage 8a7361141c08 --json
journalctl --user -u x-test-growth-agent.service --since '2026-10-13 00:00' --no-pager -q
jq -c '{id,label,engine,model,reasoning_effort,status,steps,task_failures}' \
  ~/.local/state/claive/<job>/state.json
jq -c 'select(.type=="turn.completed")' ~/.local/state/claive/<job>/events.jsonl
jq -r 'select(.type=="item.completed") | .item.type' \
  ~/.local/state/claive/<job>/events.jsonl | sort | uniq -c
git log --oneline -8 -- agent_bridge.js
git blame -L 612,622 -- agent_bridge.js
git blame -L 1673,1679 -- agent_bridge.js
```

The byte and field analysis used a local Node script under `/tmp/opencode/`. The
script parsed `events.jsonl` and never opened the database, credentials, the
browser or the network.
