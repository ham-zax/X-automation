# ARM 24/7 operator handoff — 2026-10-07

Written for the next agent (any model) to take over. This file lives in a public repository: it names no secrets, addresses or key paths. Server access details are in Hamza's private `myservers` repository.

## Goal

Hamza wants `@ham_zax` operated continuously by an unattended reasoning agent on a small always-on server (the **ARM** host, Oracle Cloud, Ubuntu 24.04 aarch64, **Pi only, no Muse**). The WSL workstation is **not** the operator host any more: Hamza said it will not run the operator. Never start a second operator elsewhere against another copy of the database (duplicate posts).

Hamza asked that no extra code or review effort be spent on the supervision layer for now; the watchdog below is deliberately a hack made of existing parts.

## What runs on ARM (user systemd units, linger on)

Copies of every unit are in `ops/systemd/arm/`. Install paths on ARM: `~/.config/systemd/user/`. Repo: `/home/ubuntu/repo/x_test` (a git clone of this repository, kept current with `git pull --ff-only`).

| Unit | Purpose |
| --- | --- |
| `x-test-dashboard.service` | Dashboard on 127.0.0.1:3030 (owner auth). |
| `x-test-growth-agent.timer` / `.service` | Every ~15 min runs `node growth_agent_runner.js` (oneshot, 9 h timeout). Env: `X_GROWTH_AGENT_RUNTIME=pi`, `X_GROWTH_BROWSER_TARGET=linux`, `X_GROWTH_BROWSER_CDP_PORT=9222`, `X_GROWTH_AGENT_WINDOW_MINUTES=480`, `AI_ALLOW_RUNTIME_MANAGED=true`. An active service coalesces timer wakes. |
| `x-test-growth-agent.service.d/model.conf` | Drop-in setting `X_GROWTH_AGENT_MODEL` (currently `opencode2api/exo-free`). The watchdog rewrites this file to switch models. |
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

Preferred order for the operator: `exo-free` → `muse-spark-1.3-contributor-free` → `mimo-v2.6-flash-free` → `big-pickle` (all under provider `opencode2api`). Pi's own default model, Pi subagent default and claive's worker role on ARM are `exo-free` (backups of the old config are next to the files as `*.bak-<timestamp>`). The runner has **no** built-in fallback and claive serve only backs off on provider errors; it never switches models.

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

## ARM application AI runtime repair — continuation on 2026-10-07

The app-level structured-AI path used by `browser-reply-claim`, Writer review, writing-strategy recommendation and editorial refresh was the blocker behind run 38's generic `AI execution failed`. This is separate from Pi's own `opencode2api` model connection.

Root cause and evidence:

- The persisted AI role bindings still pointed at workstation-era runtime-managed profiles (Codex, AGY and OpenCode). Those CLIs are not usable on ARM. `ai_runs` 570–573 show `editorial_scan` / `writer` failing essentially immediately on those profiles.
- `ai_policy.reserveAiRequest()` reserves the request budget before a runtime-managed adapter discovers that its CLI is unavailable. The current editorial scan context is about 926 KB, so one dead Codex scan reserved about 947k against the default 1,000,000 daily token budget. The fallback then failed from budget exhaustion and the public bridge surfaced only the generic execution error.
- The context is genuinely large: the dominant fields are measurement history, scan candidates and distribution-surface outcomes. Do not bind `editorial_scan` to `exo-free`: its configured 131k context window is too small for the current packet.
- `testAiProfile()` also had an independent deadline bug: it passed a relative timeout where `executeValidated()` requires an absolute deadline. That made a healthy direct profile appear to time out immediately. The tracked fix is `Date.now() + timeoutMs`.
- A raw local gateway probe and then x_test's own corrected structured-profile test both succeeded. The app-level direct adapter therefore works on ARM; the gateway itself was not the problem.

Current ARM AI configuration:

- Local deployment env now allowlists `http://127.0.0.1:13339/v1` for the app's guarded direct-AI transport.
- The ARM experiment's daily AI token-budget guard is 25,000,000 rather than the 1,000,000 default, because one editorial packet is close to 1 MB. The independent 200-request/day guard remains in place.
- `writer`, `audience_review` and `continuous_scan`: primary `exo-free`, fallback `longcat-2.5-preview-free`.
- `editorial_scan` and `editorial_final`: primary `longcat-2.5-preview-free`, fallback `space-bunny-free`.
- All active role profiles are `direct_api` / OpenAI-compatible chat-completions profiles pointed at the loopback gateway. The secret value remains only in ARM's local secret store and was not printed.
- x_test's corrected profile test passed for all three bound models before rebinding. A Nemotron profile was tested but returned a provider error through the app request shape and is not bound.

Live proof after rebinding: run 40 reached `browser-reply-claim` and `ai_runs` 574 and 575 completed through `direct_api / exo-free` in about 6 s and 15 s. The candidate was then skipped by the deterministic content gate (unsupported factual additions and 291/280 weighted characters), which is a legitimate quality rejection rather than an AI capability failure. As of 02:37 UTC there was still no new publication attempt after the 2026-10-02 posts.

There was also a discoverability gap in delegated main-feed approval. `agent_bridge.js` already exposed `mission-approve`, but the command was missing from the bridge usage string and the experiment prompt did not tell the operator to use it. Run 38 therefore incorrectly concluded there was no agent-lane approval primitive. The experiment prompt now tells the operator to establish the current deterministic writing strategy, regenerate/apply Writer output when necessary, and use `mission-approve` with the active run/grant and concrete verification provenance instead of waiting for the dashboard/human lane. `mission-approve` was also added to the bridge usage contract. The next fresh Pi pass will receive that prompt; run 40 began before the prompt edit, although it already uses the repaired live AI bindings.

Verification performed for this continuation: direct gateway contract probes, x_test's own structured-profile tests, live `ai_runs` evidence from run 40, and `node --check` on the three changed JavaScript files. No automated test suite was run.

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
