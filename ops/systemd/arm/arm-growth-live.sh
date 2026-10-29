#!/bin/bash
set -euo pipefail
# Attached live Growth session on ARM. Runs from the production checkout; the brief
# beside this script is the versioned source and the filled prompt goes to STATE.
cd /home/ubuntu/repo/x_test
# Kept short: agent-browser derives a Unix socket path from it (limit 103 bytes).
SESSION="luna-arm-$(date -u +%Y%m%dT%H%M%SZ)-$(tr -d - < /proc/sys/kernel/random/uuid | cut -c1-8)"
export SESSION
exec /usr/local/bin/node /home/ubuntu/repo/x_test/ops/attached_live_session.mjs
