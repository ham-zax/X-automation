# XGrowth WSL dry run before ARM enablement — 2026-10-13

## Intent

Exercise one complete Growth Run decision cycle on WSL with the `fix/context-budget`
bridge (`83ace00`) and a live, read-only X observation, and measure what the attached
agent has to read. The result decides whether the branch is ready for one measured
production session on ARM.

## Why the run is dry

- `AGENTS.md`: the ARM server is the production operator host and WSL is test-only.
- The WSL `.x-research.sqlite` is a stale copy of production (latest publication
  attempt 2026-10-08, latest X snapshot 2026-09-11). Its duplicate fence does not know
  what ARM has sent since, and a send recorded here would be unknown to ARM.
- Therefore no `act`, no `browser-publish-claim`, no `browser-reply-claim`, no social
  mutation and no approval is issued from WSL. The run stops at "text written for the
  chosen card".

## Fixed inputs

| Item | Value |
|---|---|
| Bridge | `/home/hamza/repo/x_test.worktrees/context-budget/agent_bridge.js` |
| State | `/home/hamza/repo/x_test/.x-research.sqlite` (WSL test database) |
| Browser | `wh-browser fast`, Linux Clearcote, profile `x-main`, one task-owned tab |
| Account | signed in as `@ham_zax` (verified on `x.com/home`) |

## Steps

1. `operator-status` (compact): delegation, health, lease, readiness.
2. Live observation: read the Home timeline and mentions in the task tab. Read only.
3. `scout`: ranked cards from current state.
4. Choose one card, open its exact source in the task tab and read the thread.
5. Write the Reply or Quote text for that card under the active persona.
6. Stop. Record what would have been sent; nothing is claimed or sent.
7. Close the task tab and verify it is gone.

## Measurements

- Bytes returned by every bridge call and every browser observation the agent reads.
- Number of bridge calls and browser calls for the cycle.
- Which calls needed `detail: true`, if any (each one is a compact-default miss).
- Anything the agent could not decide from compact output.

Bytes are a proxy for context cost; this run does not measure model tokens.

## Pass criteria

- The cycle reaches written text without reading any long instruction document.
- No bridge response read by the agent exceeds 80 KB.
- No compact response hides a field that the decision needed.
- Zero public mutations on X and zero publication attempts created locally.

## Not covered

- Token use of the real attached agent on ARM (needs one production session).
- The send, confirm and reconcile path.
- The two uncertain production attempts, which stay untouched.

## After the run

Results are appended below. Enabling anything on ARM is a separate step.

## Results

Run at 09:41–09:55 Asia/Kolkata, outside the rest window. Publication attempts in the
WSL database: 59 before, 59 after. No X mutation was made.

### What the cycle read

| Call | Bytes | Note |
|---|---|---|
| `operator-status` (compact) | 18,528 | enough to see grant, health `watch`, no lease |
| `scout` | 51,127 | 32 cards, about 1.6 KB each; not compacted by this branch |
| Home, `compact` scope | 12,651 | contains no post text |
| Mentions, `compact` scope | 15,008 | contains no post text |
| Mentions, `full` scope | 50,760 | 9 posts; their text is 2,003 bytes of it |
| Thread, `full` scope (twice) | 18,219 + 18,795 | 3 posts |

2 bridge calls and 9 browser calls. No `detail: true` call was needed and no instruction
document was read.

### Pass criteria

| Criterion | Result |
|---|---|
| Reaches written text without a long instruction document | pass |
| No bridge response over 80 KB | pass (largest 51,127) |
| No compact response hid a needed field | pass |
| Zero public mutations, zero local attempts | pass |

### Card chosen and text written (not sent)

- Source: `https://x.com/AlexFreitasAI/status/2109306564305879110`, a reply to
  `@ham_zax` dated Oct 11, asking whether the two PSD mismatches share smart objects or
  a blend mode. An active conversation outranks the cold `scout` cards.
- Text: "Smart objects would be my first guess. They carry an embedded document, so a
  clone has to re-render it instead of copying pixels. A blend mode bug would likely
  show up in more than 2 files."
- Open before any real send: the mention shows "1 reply" that the thread view did not
  display, so whether `@ham_zax` already answered is unknown.

### Findings

1. **Browser observation is now the largest read.** A `full` snapshot of the mentions
   page is 50,760 bytes for 2,003 bytes of post text, and the `compact` scope omits post
   text entirely. Extracting only the `article` lines would cut each page read by about
   25 times.
2. **`scout` is the largest remaining bridge payload** at 51 KB. Each card carries a
   593-byte `reason` plus style-label arrays.
3. **The WSL ledger is stale, as assumed.** The live thread shows an `@ham_zax` reply
   dated Oct 11, while the newest local publication attempt is Oct 8. A send from WSL
   would have run against an incomplete duplicate fence.
4. **X returned "Something went wrong" on the first thread load.** A fixed-time wait
   reported success on the error page; waiting for expected text after a reload worked.
5. **`scout` cards here come from old local snapshots** (last observation Oct 8), so
   card quality was not assessed.
6. **Untargeted `observe` calls each left an `about:blank` tab** in the Clearcote
   profile. The task tab was closed; five blank tabs remain and their ownership is not
   established, so they were left.
