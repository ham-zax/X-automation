# Offline Growth OS reply benchmark

This benchmark captures real Growth OS requests and uses native Harness²
task-level recursion. It does not publish or change production settings.

## Boundaries

`eval/growth_reply.mjs` enters a disposable working directory before importing
application modules. It calls the real packet builder, Writer, structured
validator and review through injected callbacks. No actual AI transport runs.
The real publication bridge and browser-send functions are never invoked.
Temporary SQLite state is removed after each command.

Writer lane uses the current writing contract and frozen packet. Direct lane
replays the attached brief's reply instructions with that packet. Direct lane
omits the browser, feed, room, and full attached-agent context. It is not an
end-to-end Growth Run. Pure act-input validation does not authorize publication.

Model jobs are emitted as data and supplied externally through T3. The Python
adapter launches only the local Node replay. It neither launches a model CLI
nor reads model credentials. Native Harness² imports use its existing checkout
without modifying it. Bytecode writes are disabled.

## Local request capture

From the repository root, send one JSON object on stdin:

```bash
echo '{"operation":"prepare","caseId":"VA-16","outputDir":"/tmp/reply-example","lane":"writer"}' | node eval/growth_reply.mjs
```

`prepare` writes `packet.json`, `case.json`, and `request.json`. It accepts
`fixtureFile`, `styleFile`, and `packetFile`. Supplying the saved packet freezes
its bytes across prompt variants. The source must still match the packet.

Write the exact generated JSON to `model-output.json`. Then request review:

```bash
echo '{"operation":"review-request","outputDir":"/tmp/reply-example"}' | node eval/growth_reply.mjs
```

Invalid output produces a blocked inspection. The helper preserves the raw
output and does not repair or silently drop fields. Valid output produces the
canonical `review-request.json`.

Write the independent review JSON to `review-output.json`, then inspect:

```bash
echo '{"operation":"inspect","outputDir":"/tmp/reply-example"}' | node eval/growth_reply.mjs
```

`inspection.json` records schema errors, review failures, exact text, and the
ordinary draft analysis. `publicationAuthority` is always false. An `inspected`
status does not override any separate failed gate in `score` or confer a claim.

## Native Harness² cycle

Use the installed Python environment through uv. No dependency install is needed:

```bash
uv run --no-project --python /home/ubuntu/repo/harness2/.venv/bin/python python eval/harness2_growth.py next --run-root /tmp/growth-harness-run
```

The default configuration chooses writer lane, fixed public fixtures,
DeepSeek V4.1 Flash Free max as solver, and Terra high as reviewer/editor.
The default ceiling is 24 logical T3 request reservations. This is not a hard
provider model-call, token, or monetary cap. A T3 worker may make internal
requests. The parent ledger also counts engineering and final review dispatches.

A custom JSON configuration passed with `--config` contains:

```json
{
  "fixture_file": "/home/ubuntu/repo/x_test/eval/fixtures/growth_reply.json",
  "lane": "writer",
  "max_calls": 24,
  "targets": {
    "solver": {"providerInstanceId":"opencode","model":"opencode2api/deepseek-v4.1-flash-free","options":{"variant":"max"}},
    "reviewer": {"providerInstanceId":"codex","model":"gpt-6.1-terra","options":{"reasoningEffort":"high"}},
    "editor": {"providerInstanceId":"codex","model":"gpt-6.1-terra","options":{"reasoningEffort":"high"}}
  }
}
```

The stored configuration is immutable. Use another run root for a different
configuration. `--lane` and `--solver-target` explicitly select a comparison lane
or solver for a standalone rollout. Their actual targets enter request identity.

`next` returns a pending request with an ID, exact prompt/schema or native
mission/context, target, and hash. The parent delegates that request through T3.
Use only its requested model/options. Return a file shaped as follows:

```json
{
  "requestHash": "copy the complete requestHash",
  "output": {},
  "execution": {
    "providerInstanceId": "copy actual T3 provider",
    "model": "copy actual T3 model",
    "options": {},
    "taskId": "copy actual T3 taskId",
    "status": "completed"
  }
}
```

`output` contains the returned JSON. Preserve invalid returned text as a string
rather than pretending it matches the schema. Record complete raw summaries and
T3 metadata in the parent's run evidence. Never invent an execution receipt.

Import the response and resume:

```bash
uv run --no-project --python /home/ubuntu/repo/harness2/.venv/bin/python python eval/harness2_growth.py accept --run-root /tmp/growth-harness-run --request-id REQUEST_ID --response-file /tmp/model-response.json
uv run --no-project --python /home/ubuntu/repo/harness2/.venv/bin/python python eval/harness2_growth.py next --run-root /tmp/growth-harness-run
```

Repeated `next` requests do not reserve duplicates. A pending request pauses
native recursion without marking a failed rollout. Request hashes, actual
provider, model, and effort bind imported results. Contradictory replacements
are rejected. The parent executes one pending model job at a time.

The adapter runs actual `core.recursion.run_mode` with sequential k=1. The native
cycle accounts for four rollout labels and three edit/compose stages. Each valid
rollout also requests independent content review. Those reviews are additional
model jobs, not part of the method's four-rollout count.

Only `systemprompt.md` may contain a changed voice fragment, at most 2,400
characters. Other required surface files remain empty. The fragment is appended
to the real writing contract. It never changes schemas, sources, persona facts,
evaluation code, approval policy, or the production prompt file.

This implementation runs task-level recursion. It does not promote a library,
run cross-task reflection, or install a winning harness. Native method accounting
uses local cached responses on resume. The external request/response ledger is
the authoritative dispatch count. Unknown monetary costs are exported as null.
There is no numerical voice grade.

## Matched comparisons

Run a standalone baseline or supplied style through the same machinery:

```bash
uv run --no-project --python /home/ubuntu/repo/harness2/.venv/bin/python python eval/harness2_growth.py rollout --run-root /tmp/growth-harness-run --case VA-16 --label baseline
uv run --no-project --python /home/ubuntu/repo/harness2/.venv/bin/python python eval/harness2_growth.py rollout --run-root /tmp/growth-harness-run --case VA-16 --style-file docs/research/voice-audit-2026-10-29/fresh-prompt/prompt-v4.txt --label v4
```

Import pending responses and repeat the identical command until complete.
Exact input/style/target combinations reuse the same outputs. That is a cache,
not a repeated sample. `--replicate fresh-label` creates an independent identity.
`--solver-target target.json` enables a matched Terra comparison. It does not
change the stored production model or supply authority to publish.

Read the raw outputs and review issues before choosing a candidate. A native
cycle can complete while the content review rejects a draft. A favorable review
can still miss factual or social errors. Owner voice acceptance remains separate.

## Checks

```bash
node --test --test-concurrency=1 tests/growth_reply_eval.test.mjs
PYTHONDONTWRITEBYTECODE=1 uv run --no-project --python /home/ubuntu/repo/harness2/.venv/bin/python python -m unittest discover -s tests -p test_growth_harness.py -v
```

The Python check drives a mocked complete cycle through the actual Harness²
library. It launches no live model. Tests exercise the offline protocol and
isolation. They do not prove better replies, live reliability, or follower growth.
