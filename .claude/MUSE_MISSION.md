# Mission: make the X Growth Operator reliably autonomous (WSL, Muse)

You are the engineer-operator for this repository (`/home/hamza/repo/x_test`, the `@ham_zax` Growth OS).
Read `AGENTS.md`, `.claude/HANDOFF.md` and `docs/GROWTH_AGENT_EXECUTION.md` first. Do not re-diagnose what
HANDOFF.md already establishes; treat its claims as evidence to spot-check, not to re-derive.

## Situation (verified 2026-10-08 14:16 UTC)
- WSL is now the ONLY operator host. The ARM timers are stopped; the ARM DB was copied into this checkout's
  `.x-research.sqlite`. Never ssh to ARM or restart anything there.
- The runner now supports a direct Muse runtime: `X_GROWTH_AGENT_RUNTIME=muse` launches
  `muse exec --yolo --model muse-spark-1.3-contributor --reasoning-effort xhigh` per pass
  (`growth_agent_runner.js` `commandFor`). Browser target defaults to `windows` (WebHarness agent-browser
  against Windows Chrome, X already logged in).
- Uncommitted WSL fixes are present (editorial already-linked, needs_revision repair payload, claim before
  For You, recovery payload). Keep them.

## Acceptance (the user's criterion)
An unattended runner session must: start, select useful work, repair a rejected draft when one occurs,
publish and POSITIVELY reconcile (`record-action` with an attempt in `confirmed_published`) at least one
main-feed output (Original/Quote/Thread/Repost) plus replies, then continue useful cycles without you
supplying commands to the operator child. Running is not evidence; only confirmed publication attempts count.

## Loop
1. Run the operator: `cd /home/hamza/repo/x_test && X_GROWTH_AGENT_RUNTIME=muse X_GROWTH_AGENT_WINDOW_MINUTES=60 npm run --silent growth-agent > .claude/runs/run-$(date +%s).log 2>&1`
   (create `.claude/runs/`; run it in the background and poll the log/DB, the shell tool may time out).
   Never edit code while a runner session is in progress. Never start two runners.
2. After it ends, measure from the DB read-only (`sqlite3 -readonly`): `growth_runs` (status, stop_reason,
   result_json), `publication_attempts` (state), `autonomous_reply_decisions` (decision, reasons_json),
   queue_items/drafts status. Plus the run log.
3. For every failure reason, find the true owner in code and make the smallest complete fix. Then run the
   affected tests: `systemd-run --user --scope -q -p MemoryMax=5G -p MemorySwapMax=0 -- node --test tests/<file>.test.mjs`.
   Run the full suite (`npm test`, same cap) once before the final report. Repeat from 1.

## Known failure reasons to fix (priority order)
1. Reply gate failures are terminal. `evaluateAutonomousReplyItem` in `autonomous_reply.js` generates once
   (`generateExactReply`, line ~356) and on `autonomousGateResult` failure returns `decision:'review'`, which
   delegated mode turns into `DELEGATED_REVIEW_SKIPPED` (lines ~655, ~777). 14 skips since 10-07, mostly
   repairable: "An unverified source claim must be explicitly attributed", "Quantitative claims lack supplied
   evidence", "Unsupported claim". Add a bounded repair: regenerate up to 2 more times, feeding the exact
   deterministic failure messages to the Writer as revision feedback, re-running the SAME gates. Only skip if
   still failing. `AI_GENERATION_FAILED` (deadline) gets one retry.
2. A provider/runtime failure ends the whole session. `growth_agent_runner.js` (~lines 487-521) closes the run
   as `capability_unavailable` / `runtime_provider_failure` and returns. Instead: classify the failure
   (rate limit 429, deadline, startup stall, agent error), keep the durable run resumable, back off, and
   relaunch the next pass within the window. Preserve the existing orphan-resume and attempt-ownership logic
   (commits b69cc21, 3fdb9b2, 26c6d5e).
3. Prepared work is lost between passes (draft 762782 was rebuilt across 3 runs). In `growth_run.js`
   `nextOperation` (~line 160), before `collect_for_you`, surface existing drafting/needs_review main-feed
   queue rows with their draft IDs, gate failures and the exact next command, so a pass resumes them first.
4. Repair loops must be bounded: cap `needs_revision` repairs (autonomous_main_feed.js ~447) at 2 per draft,
   then skip that candidate with the exact reason.
5. Prompt cost: the operator prompt (`operatorPrompt` in growth_agent_runner.js) has every pass read ~8 docs.
   Make the pass read only what it needs (AGENTS.md invariants + GROWTH_AGENT_EXECUTION.md), and skip For You
   re-collection when executable/prepared work exists.
6. Quotes have never succeeded: the headless quote composer was empty, then an unverified Post click.
   Observe it live in a run; fix the browser procedure (docs/GROWTH_AGENT_EXECUTION.md) or add a deterministic
   helper under `ops/` that opens the exact source, fills the composer, and verifies text + embedded source
   before the single send. Keep send-start / record-action / attempt fences.
7. Any new failure you observe in your runs.

Do NOT change: scheduler spacing values (owner decision pending), gate thresholds or gate logic to let content
through, model/provider choices.

## Hard boundaries (violating any is a failed mission)
- Never mutate `.x-research.sqlite` directly; writes only via `npm run agent -- CMD`. Read-only sqlite is fine.
- Never set or fake `humanApprovedAt`, never click dashboard approval/config, never enable `AUTO_POST`,
  never start `automation.js` continuous mode.
- Never blind-retry an uncertain send; never reopen or re-send a `closed_unresolved` / investigating attempt;
  `confirmed_not_sent` needs definitive transport evidence.
- No git commit/push/stash/reset; leave all changes unstaged in the working tree. Keep staged changes staged.
- No nemotron or ling models. Don't touch ARM, systemd units, or opencode2api.
- Escalate instead of deciding when a change would alter a gate's policy, a data format/schema migration, the
  authority model, or public behaviour beyond the listed fixes: write the question in the report and continue
  with other items.

## Report
Keep `.claude/MUSE_REPORT.md` current after every runner session (overwrite, max ~80 lines):
runs launched (run IDs, stop reasons), confirmed publications (attempt IDs, route, URL), skips with exact
reasons, each fix (file:line, one line why, test command + pass/fail tail), open questions, next step.
Stop when acceptance is met and a following runner session continues cleanly, or after ~4 hours, or if Muse
quota runs out. Finish by stating exactly what is and is not verified.
