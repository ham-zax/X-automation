#!/bin/bash
set -euo pipefail
cd /home/ubuntu/repo/x_test
STATE=/home/ubuntu/.local/state/x_test
CODEX_WORKER_BINARY="$(/usr/local/bin/node --input-type=module -e "import { runtimeConfig } from './growth_agent_runner.js'; console.log(runtimeConfig().codexExecutable);")"
export CODEX_WORKER_BINARY
export CLAIVE_CODEX_YOLO=1
export CLAIVE_CODEX_USE_USER_CONFIG=1
SESSION="codex-gpt-6-luna-max-arm-$(date -u +%Y%m%dT%H%M%SZ)-$(cat /proc/sys/kernel/random/uuid)"
export SESSION
# The browser paragraph comes from the repository contract for the selected interface.
/usr/local/bin/node --input-type=module -e "
import fs from 'node:fs';
import { runtimeConfig } from './growth_agent_runner.js';
import { browserOperatorContract } from './ops/browser_operator_contract.js';
const c = runtimeConfig();
const contract = browserOperatorContract({ ...c, sessionId: process.env.SESSION });
if (!contract) throw new Error('No browser contract for this target.');
const brief = fs.readFileSync('$STATE/arm-growth-live.md', 'utf8').replace('{{BROWSER_CONTRACT}}', () => contract).replaceAll('{{SESSION}}', process.env.SESSION);
if (brief.includes('{{')) throw new Error('Unfilled placeholder in the brief.');
fs.writeFileSync('$STATE/arm-growth-live.prompt.md', brief, { mode: 0o600 });
"
printf 'ARM live Growth agent using %s, session %s\n' "$CODEX_WORKER_BINARY" "$SESSION"
exec /home/ubuntu/repo/claive/bin/claive run --workspace /home/ubuntu/repo/x_test --prompt-file "$STATE/arm-growth-live.prompt.md" --engine codex --model gpt-6-luna --reasoning-effort max --web --turn-timeout 2700 --label "XGrowth live ARM"
