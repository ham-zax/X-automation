# ARM 24/7 operator handoff — 2026-10-07

Written for the next agent (any model) to take over. This file lives in a public repository: it names no secrets, addresses or key paths. Server access details are in Hamza's private `myservers` repository.

## Goal

Hamza wants `@ham_zax` operated continuously by an unattended reasoning agent on a small always-on server (the **ARM** host, Oracle Cloud, Ubuntu 24.04 aarch64, **Pi runtime; Muse 1.3 Contributor is the preferred operator model**). The WSL workstation is **not** the operator host any more: Hamza said it will not run the operator. Never start a second operator elsewhere against another copy of the database (duplicate posts).

Hamza asked that no extra code or review effort be spent on the supervision layer for now; the watchdog below is deliberately a hack made of existing parts.

## What runs on ARM (user systemd units, linger on)

Copies of every unit are in `ops/systemd/arm/`. Install paths on ARM: `~/.config/systemd/user/`. Repo: `/home/ubuntu/repo/x_test` (a git clone of this repository, kept current with `git pull --ff-only`).

| Unit | Purpose |
| --- | --- |
| `x-test-dashboard.service` | Dashboard on 127.0.0.1:3030 (owner auth). |
| `x-test-growth-agent.timer` / `.service` | Every ~15 min runs `node growth_agent_runner.js` (oneshot, 9 h timeout). Env: `X_GROWTH_AGENT_RUNTIME=pi`, `X_GROWTH_BROWSER_TARGET=linux`, `X_GROWTH_BROWSER_CDP_PORT=9222`, `X_GROWTH_AGENT_WINDOW_MINUTES=480`, `AI_ALLOW_RUNTIME_MANAGED=true`. An active service coalesces timer wakes. |
| `x-test-growth-agent.service.d/model.conf` | Drop-in setting `X_GROWTH_AGENT_MODEL` (currently `opencode2api/muse-spark-1.3-contributor-free`). The watchdog rewrites this file to switch models. |
| `x-test-growth-agent.service.d/experiment.conf` | Drop-in setting `X_GROWTH_AGENT_EXPERIMENT=1`: adds the **experiment-mode** section to the operator prompt (see below). Delete the file and `daemon-reload` to return to the cautious default prompt. |
| `x-test-watch.timer` / `.service` | Every 30 min queues the **watchdog goal** into claive if the queue is empty. |
| `claive-serve.service` | claive supervisor; works the goal queue (config `~/.config/claive/config.json`, default engine `pi`, worker model `exo-free`). |
| `webharness-xvfb`, `webharness-chrome` | Xvfb :99 and a persistent Chromium on CDP 127.0.0.1:9222 used for X. |

`automation.js` is retired and must not run. `AUTO_POST=true` is set in ARM's `.env` but only requests background publication through the official X API, which has no `X_API_ACCESS_TOKEN`, so it does nothing. Public posting happens through the browser operator.

## How a pass works

`growth_agent_runner.js` checks delegation (must be `running` + `live`, unchanged revision), the operator lease, account health, outstanding publication attempts and active runs; then it launches Pi once per Growth Run (max 20 min, 8 public mutations) with the operator prompt, and may start fresh passes until `X_GROWTH_AGENT_WINDOW_MINUTES` elapses. Pi is run as `pi --print --no-session --offline --no-extensions --no-approve --tools read,bash --thinking high --provider opencode2api --model <model> -- <prompt>`. X is driven through the Agent Browser CLI against the persistent Chromium (`agent-browser --cdp 9222 --session <sessionId> ...`). If the browser is not signed in as `@ham_zax` the run records an authentication blocker and does not log in.

Runner changes this session (`origin/main`): `a2346fb` (Pi runtime, portable paths, `X_GROWTH_BROWSER_TARGET`), `55eed51` (default model `opencode2api/exo-free`). Env knobs: `X_GROWTH_AGENT_RUNTIME`, `X_GROWTH_AGENT_MODEL` (`provider/model`), `X_GROWTH_PI_BIN`, `X_GROWTH_PI_THINKING`, `X_GROWTH_BROWSER_TARGET`, `X_GROWTH_BROWSER_CDP_PORT`, `X_GROWTH_AGENT_BROWSER_CLI`, `X_GROWTH_REPO`. See `ops/systemd/README.md`.

## X login on ARM

ARM's Chromium was signed in by setting the `auth_token` and `ct0` cookies (values from ARM's private `.env`, keys `AUTH_TOKEN`, `CT0`) with `agent-browser --cdp 9222 cookies set ... --domain .x.com --expires <+1y>`, then verified by reading the profile link (`/ham_zax`) on `x.com/home`. If X invalidates the session, passes will record authentication blockers until the cookies are refreshed the same way. Never print the values.

## Models and the watchdog hack

Preferred order for the operator: `muse-spark-1.3-contributor-free` → `big-pickle` → `mimo-v2.6-flash-free` → `space-bunny-free` (all under provider `opencode2api`). Pi's own default model, Pi subagent default and claive's worker role on ARM are `exo-free` (backups of the old config are next to the files as `*.bak-<timestamp>`). The runner has **no** built-in fallback and claive serve only backs off on provider errors; it never switches models.

The substitute is the **watchdog goal** (`ops/claive/xwatch-goal.md`, installed at `~/work/scratch/xwatch/goal.md` on ARM). `x-test-watch.timer` queues it every 30 min (`--write --budget 25m --max-attempts 1 --engine pi --model mimo-v2.6-flash-free`). One cycle: read-only checks of the service, journal and database; classify model/provider failure versus X-side blockers (login, 423, rate limit, capability, delegation, health, reconciliation); on a model failure with no active Growth Run, move `model.conf` to the next model and `daemon-reload`; append a JSON line to `~/work/scratch/xwatch/stats.jsonl`; write X-side blockers to `~/work/scratch/xwatch/ALERTS.md`. It may not touch the repo, `.env`, the database (read-only), claive, git, the browser, or the services.

Caveats: this was **not reviewed or load-tested**. The watchdog runs on a free model with unrestricted bash (Pi has no OS sandbox), so the prompt is its only guard. It uses a different model (mimo) from the operator's preferred one on purpose, but if mimo itself fails nothing repairs the watchdog. It can only change the model for the *next* pass, never mid-run.

## Autonomy grants (owner decision, 2026-10-07)

`@ham_zax` is a **test account** and this is an experiment: Hamza wants everything permitted so the operator keeps posting 24/7 in a human voice (the active persona owns wording), and will read the results after 1–2 days. Hamza explicitly authorised full grants. State on ARM:

- Growth Operator delegation (`growth_operator_delegation`): `running`, `live`.
- Autonomous reply grant (`autonomous_reply_grant`): `running`, `live`, all 9 intents, all sources, all tones, humor allowed. Live budget raised from 100 to 100000 (revision 13; it had used 20). It was already fully open; the grant was never what blocked replies.
- What actually blocked replies: `NO_ALLOWED_REPLY_INTENT` in `autonomous_reply.js` `chooseIntent`. Items the operator created with an **empty `reply_archetype`** mapped to no intent and were skipped (30 such reply items in the database). Fix: when no archetype is set, fall back to the first allowed of `technical_insight`, `constructive_feedback`, `social_reaction`; an archetype that maps to a non-allowed intent is still refused. Tests: `tests/content_readiness.test.mjs` and `tests/autonomous_run_friction_repairs.test.mjs` pass (25/25); the full suite was **not** re-run.
- Remaining legitimate gates, left in place: approvals made under an older persona need re-review (queue item 59983 is also stale — a 25-day-old draft — and should just be expired); deterministic draft quality gates (`DETERMINISTIC_GATE_REVIEW`); stale-source expiry; one-time publication claims. The operator prompt (`growth_agent_runner.js`, "stop earlier rather than create filler") is selective on purpose. If posting stays too sparse, loosening that wording is the next lever.

## Experiment mode (operator prompt)

Runs 36–38 on ARM ended with zero public actions because the default prompt tells the operator to stop rather than create filler. `X_GROWTH_AGENT_EXPERIMENT=1` (runner commit after `55eed51`; opt-in, default prompt unchanged, covered by a test in `tests/growth_agent_runner.test.mjs`) appends an `EXPERIMENT MODE` section to the prompt: the owner has granted full authority on this test account; aim for at least 2 public actions per pass (replies first, then an original or quote); review own drafts critically; write like a person (varied openers, specific details, no hashtag/emoji spam, no template phrasing); stale queue items may be expired. The bridge's hard gates (single publication claim, reconciliation, account health, duplicate fences, authentication) still apply. To tune posting volume or voice, edit the `experimentSection` text in `growth_agent_runner.js` `operatorPrompt`.

## ARM application AI runtime repair — current state on 2026-10-07

The app-level structured-AI path used by `browser-reply-claim`, Writer review, writing-strategy recommendation and editorial refresh was the blocker behind runs 38–39's generic `AI execution failed`. This is separate from the Growth Operator's own Pi process.

Verified root causes:

- Persisted role bindings still pointed at workstation-era Codex/AGY/OpenCode profiles. Those runtimes are not usable on ARM; `ai_runs` 570–573 show the failures.
- The deployment budget used to count UTF-8 bytes as if each byte were one token and reserved budget before discovering an unavailable CLI. A ~926 KB editorial context therefore consumed ~947k of the old 1M daily budget even when the runtime failed before inference.
- The durable editorial context is legitimately large, with duplicated measurement, distribution and account-health diagnostics. Sending the entire durable object to a model is unnecessary.
- Run 40 exposed a separate 24/7 recovery bug: Pi exited after malformed provider SSE, but `growth_agent_runner.js` rethrew without finishing the already-active Growth Run. That left run 40 and its operator lease orphaned and made the next timer wake coalesce.

Current AI architecture and configuration:

- `pi` is now a first-class x_test AI runtime alongside Codex/OpenCode/AGY. Product-AI Pi calls are sessionless, tool-less, MCP-less, extension-less, skill-less and context-file-less; Pi's JSON event stream is parsed at `message_end` / `agent_settled` and x_test validates the result against its own schema.
- **Muse 1.3 Contributor is the default.** Global default profile and all five role primaries (`continuous_scan`, `editorial_scan`, `editorial_final`, `audience_review`, `writer`) are `ARM Pi Muse 1.3 Contributor` / `muse-spark-1.3-contributor-free` (profile 14). The role fallback is `ARM Pi big-pickle` (profile 12).
- `space-bunny-free` remains as an enabled Pi profile for manual use but is not bound. The temporary direct-API profiles created during diagnosis (ids 6, 7, 8 and 10) are disabled and have no secret reference. The duplicate x_test-local gateway secret was removed; Pi owns the gateway credential path.
- **Nemotron and Ling are prohibited.** x_test profile validation and Growth Operator runtime config reject them, Claive already rejects them, the diagnostic Nemotron profile was deleted, and the watchdog rotation contains neither model.
- Local `.env` still allowlists `http://127.0.0.1:13339/v1` for guarded direct-AI diagnostics, but no active role uses the direct adapter.
- There is **no application-level daily AI request/token budget**. AI safety is per request/concurrency only: `AI_MAX_INPUT_TOKENS=120000`, output/response limits, deadlines and `AI_MAX_CONCURRENCY`. CLI availability/profile preflight runs before a concurrency slot is reserved.
- The full editorial context remains durable for observability, but `editorial_runtime.js` projects a bounded inference view. It records only size metadata (`inferencePacketBytes`, `requestEnvelopeBytes`), never prompt content.

Production proof:

- A production Pi/Exo profile test completed in ~3.84 s. Earlier isolated Exo test was ~4.2 s; Space Bunny was ~9.4 s in the equivalent probe. Exo is therefore the preferred default for both latency and simplicity.
- Replaying the last real editorial context (926,413 bytes) through the repaired production `runEditorialScan()` succeeded on the primary Exo profile with no fallback. The bounded inference packet was 135,987 bytes, the full request envelope 152,425 bytes, it returned 8 stories, and `ai_runs.id=576` completed in 43.7 s.
- Before the daily quota was removed, the corrected accounting showed the earlier byte-counting bug clearly; the application now enforces no daily AI request/token allowance at all.
- Run 40 was recovered through the canonical `growth-run-finish` path only after confirming it had zero publication attempts. The recovered terminal result records `runtimeFailure`, detaches the reasoning runtime and releases the lease.
- New runner behavior automatically finishes an active run as `partial/capability_unavailable` with `result.runtimeFailure` when the reasoning child dies. The watchdog recognizes that marker as a provider/runtime failure instead of misclassifying it as an X-side blocker.
- The operator failover order is `big-pickle`, `mimo-v2.6-flash-free`, `space-bunny-free` after preferred `muse-spark-1.3-contributor-free`; the watchdog worker itself remains separately configured. Its tracked/live goal understands `runtimeFailure` and still only changes the operator model for a future pass.
- Full repository test suite: **91/91 pass** after the final no-daily-quota and malformed-stream fallback changes. Production UI build succeeds.

Rollback snapshots for the role migrations are under `~/work/scratch/`, including `x-test-ai-role-migration-2026-10-07T02-55-00-241Z.json` and `x-test-ai-role-migration-exo-default-2026-10-07T02-59-14-959Z.json`.

The delegated main-feed approval path remains as previously repaired: the experiment prompt explicitly tells the operator to establish the current writing strategy, regenerate/apply Writer output when needed, and use `mission-approve` with active run/grant plus concrete verification provenance instead of waiting for the dashboard/human lane. Hard publication/claim/reconciliation gates remain authoritative.

Post-repair live evidence is now stronger than the initial run-41 check: publication attempts 35–40 include a confirmed repost, four confirmed replies and one confirmed original post. Run 60 later hit the now-removed daily AI quota; after removing that quota, run 61 immediately resumed Exo work and `ai_runs` 633–635 completed successfully while the run remained active. The old `ai_deployment_budget` state row was deleted; only per-request/concurrency controls remain.

## Closing the WSL session

Nothing runs from WSL. Every moving part is on ARM under user systemd with linger (timers survive logouts and reboots of the workstation): operator timer and service, watchdog timer, `claive-serve`, dashboard, `opencode2api`, Chromium/Xvfb. Closing the Claude/WSL session stops nothing. Do **not** start the operator or a second copy of the database on WSL.

## Recording and stats

Already recorded in the database: every attempt in `publication_attempts` (action type, lane, state `confirmed_published` / `confirmed_not_sent` / `closed_unresolved`, evidence, errors, `run_id`), every run in `growth_runs` (status, stop reason, `adapter_type`, session), and engagement in `post_metrics` / `publication_measurements`. Joining attempts to runs by `run_id` gives per-runtime success counts. Not recorded: model, tokens and duration per run, and blocked-pass reasons only exist in the scheduler status and the journal. There is no stats command yet; the watchdog's `stats.jsonl` is the stopgap.

## Earlier state snapshot (superseded by the continuation update above)

- Timer started 2026-10-07 around 01:27 UTC. First Growth Run (id 36, `pi_unattended`, 01:28–01:35 UTC, model Muse, not exo-free) ended `completed` / `no_worthwhile_eligible_work` with **0 public actions**. It logged in as `@ham_zax`, ingested 4 For You observations, wrote reply draft 152 (Mistral cyber claim) for the human lane, and found nothing it could execute: queue item 59983 is blocked because its approval was granted under persona `hamza-v1-alpha-2026-09-05` while the current one is `...-10-02` (needs owner re-review), and the autonomous `browser-reply-claim` refused the draft (contribution intent outside the grant allowlist). `exo-free` has **not** yet run a pass.
- The ARM database is a copy taken from the WSL machine. It carries a live operator delegation and WSL history; treat it as the one authoritative database from now on.
- claive on ARM is at `c86003b` (symlinked install from `/home/ubuntu/repo/claive`).
- ARM's Pi provider `opencode2api` points at the local gateway (`http://127.0.0.1:13339/v1`, the bun `opencode2api.service`) instead of the public sslip.io/Caddy URL, for latency. Old file kept as `~/.pi/agent/models.json.bak-<ts>`. claive also has a supported `providers.opencode2api.base_url` loopback override, unused here because `models.json` itself is edited.
- ARM's Pi has no sandbox; run it only as the unprivileged `ubuntu` user.

## Operating it

- Look: `systemctl --user status x-test-growth-agent.service`, `journalctl --user -u x-test-growth-agent.service`, `claive goal list --all`, `~/work/scratch/xwatch/{stats.jsonl,ALERTS.md}`. Over non-interactive ssh export `XDG_RUNTIME_DIR=/run/user/$(id -u)` and put `~/.local/bin` on `PATH`.
- Stop: `systemctl --user disable --now x-test-growth-agent.timer x-test-watch.timer`. Stopping the service mid-run leaves an active Growth Run that must be recovered (`active_run_requires_recovery`). Prefer letting the pass end, or pause delegation in the dashboard.
- Switch the model by hand: edit `model.conf`, `systemctl --user daemon-reload` (applies from the next pass).

## Open decisions and next steps

1. Stats: a `growth-stats` bridge command and per-run model/duration recording (not built).
2. Runtime-level model fallback chain inside the runner (not built; the watchdog is the stand-in).
3. Optional quality gate: a separate reviewer model checks drafts before `publication-attempt-send-start`.
4. Optional `claive` runtime in the runner (queue a one-attempt goal per pass). Evaluated and deferred: a goal worker is the same Pi model with the same prompt, so it adds claive's backoff, inbox and goal list but no new judgment; goals need `--write` and `--max-attempts 1` to be safe here.
5. Verify the first public mutation after the ARM AI-runtime repair. `exo-free` is now proven through the live Writer generation/review path; publication is still subject to the deterministic quality, claim, browser-verification and reconciliation gates.
6. A recurring-blocker maintainer goal (writes a proposed fix on a branch in a scratch copy for human review) — idea only. The live operator must never edit production code.

Preserve the existing delegation, relationship and publication data in the database; do not reset it or run destructive tests against it.
