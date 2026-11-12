# Growth OS user services

## Current ARM repair status, 1 November 2026

TASKS.md owns the GQ repair status. The active execution update in
`docs/plans/GROWTH_REPLY_QUALITY_DESIGN_2026-10-29.md` supersedes earlier model
assignments. Terra6.1 medium writes Replies, Originals, Quotes and Threads for
repair evidence. Sol6.1 high performs complex review. DeepSeek orchestrates.
The separate content_review role stays configurable and inherits Writer if unbound.
Reply v2 has structured candidates/checks/selection and a Writer-selected behavior.
Profile act requires the exact saved generation. Quote also needs current server
review. Originals/Threads keep reviewed approved queues. No new approval authority.
Source normalization preserves extended note text without changing the trusted pin.
The evaluator imports the active contract and separates diagnostic review failures.
See `docs/research/production-reply-failure-2026-11-01/repair-terra-medium/README.md`
and its OPERATIONS.md for actual evidence and limits. The ledger records their integration state.
The operator and timer run only after an explicit owner re-arm. The current
selection is read from `arm/growth-agent.yaml`, and each later session uses the
file that exists when it starts.
The final review found issues, followed by a parent repair round and focused checks. A later bounded read-only live check passes with an unpublished Terra Reply.
The dashboard loads the committed repair. Public sending and sustained operation
remain untested. Historical entries below are dated evidence, not current deployment.
No retained historical document or private backup is removed by this update.


Current repository guidance: 31 October 2026, implementation commit `7880df5`.
Production checkout: `/home/ubuntu/repo/x_test` on ARM. WSL is test-only.
Do not start a second operator against another database copy.

## Attached operator

The versioned ARM service is `arm/x-test-growth-agent.service`.
Its `arm/attached-live.conf` drop-in selects `arm/arm-growth-live.sh`.
That shell starts `ops/attached_live_session.mjs`, which renders the live brief,
leases one browser target, supervises the selected agent and releases the target.
The drop-in supplies a 60-second stop timeout for cleanup.

The operator runtime, model and supported reasoning effort are configurable.
The attached service reads `arm/growth-agent.yaml` on each session. That file
can select the operator and every AI role, including Writer, Reply Writer and
content review. YAML role profiles override saved database bindings. Explicit
profiles passed by a command remain authoritative. A missing role keeps the
saved binding. A changed YAML file applies to the next operator or AI call.
Malformed YAML fails before browser allocation or model dispatch.
Shared Codex launch settings belong to `runtimes.codex` in the same YAML:
`binaryPath` selects the executable, `codexHome` selects CODEX_HOME (and the
Claive web home), optional `shadowHome` sets the child's HOME, and `environment`
maps environment names to quoted string values. These apply to both the attached
operator and AI role calls without changing the parent process environment.
Paths must be absolute. ARM uses its existing home; a shadow home is optional
and must already contain any files the runtime needs. Keep secrets out of YAML.
`sandboxMode` and boolean `networkAccess` configure native Codex role calls;
their defaults remain read-only and no workspace network access. ARM now leaves
both unset, so native Codex uses `~/.codex` and the safe read-only defaults.
A future chatgpt-web selection would need a trusted network-enabled environment
again: that Codex/web bridge combination does not emit the explicit trusted
network context required for sandboxed turns.
Role calls still disable shell and MCP tools.
Claive's operator sandbox follows its native policy and explicit environment
settings. ARM no longer sets `CLAIVE_CODEX_WEB_YOLO`, because no role selects a
web model; add it back only with a chatgpt-web selection that needs local browser access.
Claive launch arguments remain governed by its existing engine configuration;
an environment entry for `CLAIVE_CONFIG` can select that configuration file.
Web model role calls use the existing compatible-output path: the schema is
included in the prompt and Growth OS validates the result locally. The web
bridge's native strict-schema mode rejects Markdown-escaped JSON before the
application can decode it. The Codex adapter therefore decodes CommonMark
punctuation escapes for web responses only, preserving valid JSON and valid
JSON string escapes. It records `markdownEscapesDecoded` in adapter metadata.
Decoding must produce valid JSON; every required field and enum still passes
the original schema validator. Other Codex models retain native strict schemas.
Reply writing can use the operator itself or the configured Reply Writer role.
See [model selection](../../docs/AGENT_WORKFLOW.md#operator-and-writer-selection)
and the [live brief](arm/arm-growth-live.md). No Luna model lock remains.
The default attached runtime still uses Claive/Codex when no override exists.

Inspect the active source and resolved roles with:

```bash
X_GROWTH_CONFIG_FILE=/home/ubuntu/repo/x_test/ops/systemd/arm/growth-agent.yaml \
  npm run --silent agent -- ai-config
```

Discovery alternates Trending and For You in the live brief. Trending runs at
0:00, For You at 10:00, then each source repeats every twenty minutes when work
fits the interval. Saved discoveryIntervalMinutes is ten minutes. Passes never
overlap; slower context reads or Writer calls push the next pass later. Trending uses `growth-refresh {"kind":"x_momentum"}`.
For You uses the authenticated owned browser tab and `x-for-you-ingest`.
The reasoning agent follows this cadence within a finite session. Slow work,
rest hours and the existing gap between sessions can delay collection.
The systemd timer starts sessions, not individual discovery passes.
The versioned `arm/cadence.conf` replaces the old host-only thirty-minute override.
Its empty `OnActiveSec` and `OnUnitInactiveSec` clear the inherited monotonic
timers, then `OnCalendar=*:0/5` wakes on five-minute wall-clock boundaries aligned
with the `discovery_schedule.js` blocks, so a five-minute For You pass cannot shift
later wakes onto only odd or even blocks. Active runs coalesce naturally.
Install it at `~/.config/systemd/user/x-test-growth-agent.timer.d/cadence.conf`,
reload the user manager, and restart the timer. Check `TimersCalendar` for
`OnCalendar=*:0/5`; an active timer alone does not prove the cadence.

The launcher passes its owned target as `X_GROWTH_OPERATOR_BROWSER_TAB`.
The publication transport uses it for its initial read instead of allocating an
unused default blank page. Explicit composer targets still take precedence.
WebHarness closes only proven bootstrap pages. It waits for their disappearance
with bounded inventory reads after one exact close request.
The launcher reads the brief at session startup. An active session keeps its
already-rendered brief until it ends.

Changing code or settings does not install units, enable timers or grant authority.

The service without the attached drop-in runs `growth_agent_runner.js` instead.
That entry point runs one finite controller tick. It does not launch the retired
elapsed-time browser loop. Do not confuse the two entry points.

## Deployment and inspection

Use [Production operations](../../docs/PRODUCTION_OPERATIONS.md) for release,
private access, backup, restore and rollback. Use ARM units for production.
Do not install the historical WSL units into the ARM account.
Check the installed service and drop-ins before reporting deployment status:

```bash
systemctl --user cat x-test-growth-agent.service
systemctl --user status x-test-growth-agent.service x-test-growth-agent.timer --no-pager
systemctl --user list-timers x-test-growth-agent.timer --no-pager
journalctl --user -u x-test-growth-agent.service -n 100 --no-pager
```

Build dashboard assets before deployment through the release procedure.
Services do not install dependencies or build assets at startup.
The timer wakes the configured service. Owner policy and claim gates decide
whether public action is permitted. Missed wakes create no publishing quota.

Continuous `automation.js` and the old model-rotation watchdog are retired.
Do not enable their services. The dashboard remains an inspection interface.
Historical deployment evidence lives in `docs/ARM_24X7_HANDOFF.md`.
The installed ARM operator and dashboard point to the same YAML file. A unit
reload is needed only after changing the unit pointer, not after editing YAML.

## DeepSeek selection, 31 October — retired 12 November

The versioned `arm/deepseek.conf` drop-in selected OpenCode with
`opencode2api/deepseek-v4.1-flash-free`, max effort and profile Reply mode.
Both that drop-in and `arm/experiment.conf` (`X_GROWTH_AGENT_EXPERIMENT=1`) are
retired and removed from the repository; native Codex `gpt-6.1-terra` at `low`
in `arm/growth-agent.yaml` is the only operator selection. Remove any installed
copy under `x-test-growth-agent.service.d/` and reload the user manager.
The historical record below describes the retired selection, not current state.
Model bindings remain runtime state, not Git data.

The installed OpenCode executable supports operator sessions. Its SDK/server
structured-output interface does not match the existing Writer adapter. The
Writer therefore uses the existing Pi adapter and the same opencode2api provider.
A real structured Writer connection check passes with DeepSeek and no fallback.
This does not establish end-to-end content quality or continuous availability.

The ARM service and existing timer start under owner authorization. The launcher
reports OpenCode/DeepSeek/max/profile mode and allocates one owned browser tab.
A separate read-only browser check establishes the signed-in Profile href
`/ham_zax`. Its test targets close cleanly. The operator checks current account,
delegation, rest policy and claims before any public action.

## Reply Writer override, 31 October

The owner now selects GLM 5.3 Flash Free max for Replies through the saved
`reply_writer` role, profile16, with no fallback. The executor remains DeepSeek.
The shared `writer` role remains DeepSeek for Originals, structured Quotes and
Threads. Direct operator-authored Quotes still use the executor model.
AI Settings exposes Reply Writer separately. Unbound Reply Writer settings
inherit the shared Writer. See `docs/AGENT_WORKFLOW.md` for selection details.
Contract v2 keeps two candidates and all 16 checks in one writing invocation.
The earlier all-DeepSeek startup record above remains historical evidence.

Owner clarification: GLM now writes all formats, not only Replies. Both writer
and reply_writer select profile16, glm-5.3-flash-free max without fallback.
DeepSeek remains the executor and orchestration model. The bridge now exposes
writer-generate for a routed saved draft, reusing generateDraftCandidate and its
existing independent review. Profile-mode operators use that command for
Originals, Threads and Quotes instead of writing public prose themselves.
Quotes still publish through act and its editorial checks. Originals and Threads
still use the approved queue. These generation commands grant no authority.

Attached sessions classify child quota/provider failures and use the existing
persistent growth-runner-backoff.json delay. The launcher reports actual deadline
and elapsed timestamps. Deferred launches allocate no browser tab or model child.
No automatic model substitution occurs. A timer wake does not prove a public action.

November1 scope correction: 24x7 is the architecture goal. Deployment and DeepSeek
Flash adaptation are deferred by the owner. The operator and timer are stopped,
and timer autostart is disabled. The versioned timer uses OnUnitInactiveSec=5min
so each finite session can schedule its successor after exit when later enabled.
Existing activation-cadence drop-ins can coexist. systemd does not start a second
copy of an already-running service. No operator runtime/model switch is deployed.

Latest live selection: install `ops/systemd/arm/luna.conf` as the service drop-in
after checks. It points the service at `arm/growth-agent.yaml`. The current file
selects native Codex `gpt-6.1-terra` at `low` reasoning for the operator and all
seven AI roles, with no `codexHome`, sandbox or network override, so the runtime
uses `~/.codex` and the safe read-only role defaults. Edit the YAML to select
another supported model or effort. Do not edit generated or installed copies first.
Only enable the user timer under the owner's live authorization. Individual sessions
stay bounded and obey saved rest, health, grant, claim and reconciliation rules.

## Browser budget and Writer deadline, 4 November 2026

The attached brief targets at most three operator-owned active tabs, normally
one reading tab plus a transport-owned composer. Exceptions need a concrete
task reason. Unrelated pre-existing tabs remain outside the operator's ownership.
This is prompt guidance, not a browser-wide hard cap or automatic tab cleanup.

`ai.totalTimeoutMs` in growth-agent.yaml sets the AI invocation ceiling and
the default Writer deadline. ARM selects 240000 ms. Explicit shorter call
deadlines still apply. Without this YAML setting, existing 120000 ms defaults
remain. Validation requires 1000 through 600000 ms. Writer calls reserve their
full deadline plus two minutes for publication/reconciliation before the session
ends. The existing 35-minute session and 45-minute process boundary remain.

Discovery runs on wall-clock blocks from the `schedule` section in
`growth-agent.yaml`. Defaults: 300-second blocks and the order `momentum,forYou`,
so each stream returns every ten minutes. A pass reads the stream of the current
block. Work that overruns `endsAt` finishes first, a missed block is skipped, and
a session restart continues the current block instead of resetting the rotation.
`restWatchMinutes` allows one momentum-only check per hour during rest.
`builderRefreshMinutes` adds the GitHub and HN refresh to a momentum block when
their snapshots are older than that value. No block is a pass timeout, output
target, or promise that model generation will become faster.
