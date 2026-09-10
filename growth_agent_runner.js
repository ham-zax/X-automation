import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { getGrowthAgentSchedulerStatus, updateGrowthAgentSchedulerStatus } from './growth_agent_runtime.js';
import { getOperatorLeaseStatus } from './operator_lease.js';
import { getGrowthOperatorDelegation, listGrowthRuns } from './store.js';

const REPO = '/home/hamza/repo/x_test';
const DEFAULT_RUNTIME = 'opencode';
const DEFAULT_OPENCODE_BIN = '/home/hamza/.opencode/bin/opencode';
const DEFAULT_OPENCODE_MODEL = 'opencode/muse-spark-1.3-contributor-free';
const DEFAULT_CODEX_BIN = '/home/hamza/.nvm/versions/node/v24.19.0/bin/codex';

function runtimeConfig() {
  const runtime = String(process.env.X_GROWTH_AGENT_RUNTIME || DEFAULT_RUNTIME).trim().toLowerCase();
  if (!['opencode', 'codex'].includes(runtime)) {
    throw new Error(`Unsupported X_GROWTH_AGENT_RUNTIME=${runtime}. Expected opencode or codex.`);
  }
  const model = String(process.env.X_GROWTH_AGENT_MODEL || (runtime === 'opencode' ? DEFAULT_OPENCODE_MODEL : '')).trim();
  return {
    runtime,
    model,
    executable: runtime === 'opencode'
      ? String(process.env.X_GROWTH_OPENCODE_BIN || DEFAULT_OPENCODE_BIN)
      : String(process.env.X_GROWTH_CODEX_BIN || DEFAULT_CODEX_BIN),
  };
}

function operatorPrompt({ runtime, sessionId }) {
  return `You are the unattended reasoning operator for XGrowth in ${REPO}.

This is an OPERATIONAL growth session, not a software-engineering task.

Hard boundaries:
- Do not edit source files, docs, configuration, package files, Git state, systemd units, dependencies, or environment variables.
- Do not run git commands.
- The only local state mutations you may make are through the canonical \`npm run agent -- <command>\` Growth OS bridge from ${REPO}.
- Do not inspect implementation source to reverse-engineer bridge behavior. Use the operational docs and bridge outputs as the public contract. Apart from canonical \`npm run agent -- ...\` invocations, do not run ad hoc shell/node/python commands.
- Use browser-fast/WebHarness for routine X/Twitter reading and mutation. Use browser-devtools only for diagnostics when the routine browser path fails.
- Never use a background Node daemon to mutate x.com.
- Never blindly retry a consequential browser/API write after an ambiguous result.
- Never invent a successful publication. Reconciliation requires positive live evidence and route structure.
- A no-action run is healthy when no worthwhile eligible opportunity exists. Ceilings are limits, not action targets.

Read these operational contracts before acting:
- docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md
- docs/GROWTH_OS_MOMENTUM_OPERATOR.md
- docs/GROWTH_RUN_PROTOCOL.md if present
- docs/plans/XGROWTH_AUTONOMOUS_GROWTH_RUN_IMPLEMENTATION.md for the state-machine intent

Before beginning the run, use browser-fast read-only observation of the existing Windows X tab to establish whether the intended account is @ham_zax. Do not claim x_authenticated=true until the account is positively observed.

Begin/resume the canonical run with:
\`npm run agent -- growth-run-begin\`
using adapterType \`${runtime}_unattended\`, sessionId \`${sessionId}\`, and truthful capabilities for reasoning, browser_read, browser_mutation, x_authenticated, and primary_source_web_research. If authentication changes after begin, update the same run through \`growth-run-resume\` rather than abandoning it.

Then follow the run state rather than improvising a parallel workflow:
1. If recovery is requested, inspect the exact publication attempt and reconcile only from evidence. If useful recovery is exhausted, close unresolved rather than calling it not-sent.
2. If \`collect_for_you\` is requested, use the authenticated Windows X session. Verify the intended account is @ham_zax. Collect a bounded, diverse set of recent organic For You observations, stopping early when marginal value falls. Submit them through \`x-for-you-ingest\` with accountHandle=ham_zax plus adapterType, sessionId, runId, browserTarget=windows, browserBackend=chrome, sensorVersion, and collectionStatus.
3. Use \`growth-next\`, \`inspect\`, relationship/context commands, exact live-source inspection, and primary sources where claims are material. Treat heuristic scores as advisory evidence, not sovereign ranking. When your live judgment materially differs, call \`operator-priority-set\` with this runId/sessionId, a 0-100 score, a concrete reason, and the signals that changed your view (for example momentum, crowding, source quality, relationship value, current viral/style context, or Hamza fit). The active-run score becomes the execution priority while the heuristic remains visible for comparison. Do not act on a weak social paraphrase when verification matters.
4. Supply purpose/behavior judgment through canonical bridge commands. Preserve Hamza's persona and the rule that not every useful social act needs a technical lesson.
5. Choose Reply, Quote, Repost, Original, or silence dynamically. Likes are not part of the dependable-autonomy contract yet and must not be performed invisibly.
6. When \`growth-run-next\` recommends \`claim_action\` and includes a \`claim\` object, treat that object as the canonical next executable action. For \`lane=main_feed\`, call its \`browser-publish-claim\` with exactly the supplied queueItemId plus this runId/sessionId. Do not reject browser-owned work merely because the background daemon lacks X API credentials. For an eligible Reply, use \`browser-reply-claim\` with this runId/sessionId. A successful claim returns an attemptId. Re-observe the exact target immediately before mutation. Immediately before the consequential browser mutation call \`publication-attempt-send-start\` with that attemptId plus this runId and sessionId. Execute once. Verify the live result structurally. Then call \`record-action\` with the same attemptId and positive publicationVerification.
7. Re-read \`growth-run-next\` after durable transitions. If it names an executable claim, either execute that claim or record the specific live/policy evidence that invalidated it; do not silently reinterpret it as daemon-owned work. Continue only while another worthwhile eligible action exists and within the run ceilings.
8. Finish via \`growth-run-finish\` with an accurate structured outcome and stop reason. If a capability/auth/authority blocker prevents useful continuation, record that blocker rather than bypassing policy.

Do not optimize for a fixed number of posts/replies. Optimize for useful, relevant growth and stop when marginal value is low.`;
}

function runChild(executable, args, { cwd = REPO } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: process.env,
      stdio: 'inherit',
      shell: false,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve({ code, signal: signal || null });
      else reject(new Error(`Growth agent runtime exited with code ${code}${signal ? ` (${signal})` : ''}.`));
    });
  });
}

function commandFor(config, prompt) {
  if (config.runtime === 'opencode') {
    const args = ['run', '--pure', '--title', 'XGrowth unattended operator'];
    if (config.model) args.push('--model', config.model);
    args.push(prompt);
    return { executable: config.executable, args };
  }
  const args = [
    'exec',
    '--ephemeral',
    '--sandbox', 'workspace-write',
    '--skip-git-repo-check',
    '-C', REPO,
  ];
  if (config.model) args.push('--model', config.model);
  args.push('-');
  return { executable: config.executable, args, stdinPrompt: prompt };
}

async function runCodexWithInput(command, prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd: REPO,
      env: process.env,
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: false,
    });
    child.stdin.end(prompt);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve({ code, signal: signal || null });
      else reject(new Error(`Growth agent runtime exited with code ${code}${signal ? ` (${signal})` : ''}.`));
    });
  });
}

async function main() {
  const now = Date.now();
  const scheduledInvocation = String(process.env.X_GROWTH_AGENT_SCHEDULED || '') === '1';
  const delegation = getGrowthOperatorDelegation();
  const activeRun = listGrowthRuns({ status: 'active', limit: 1 })[0] || null;
  const lease = getOperatorLeaseStatus({ now });
  const recordScheduler = (patch) => scheduledInvocation
    ? updateGrowthAgentSchedulerStatus(patch)
    : getGrowthAgentSchedulerStatus();

  recordScheduler({
    configured: true,
    enabled: true,
    lastInvocationAt: now,
    activeRunId: activeRun?.runId || '',
    nextInvocationAt: now + 60 * 60_000,
    lastError: null,
  });

  if (delegation.state !== 'running' || delegation.mode !== 'live') {
    recordScheduler({
      lastInvocationResult: {
        status: 'blocked',
        reason: 'delegation_not_live',
        state: delegation.state,
        mode: delegation.mode,
        revision: delegation.revision,
      },
      activeRunId: activeRun?.runId || '',
    });
    return;
  }

  if (lease.active) {
    recordScheduler({
      lastInvocationResult: {
        status: 'coalesced',
        reason: 'operator_lease_active',
        leaseId: lease.leaseId,
        runId: lease.runId || activeRun?.runId || '',
        holder: lease.holder || '',
      },
      activeRunId: lease.runId || activeRun?.runId || '',
    });
    return;
  }

  const config = runtimeConfig();
  const sessionId = `${config.runtime}-${randomUUID()}`;
  const prompt = operatorPrompt({ runtime: config.runtime, sessionId });
  const command = commandFor(config, prompt);

  try {
    if (config.runtime === 'codex') await runCodexWithInput(command, prompt);
    else await runChild(command.executable, command.args);

    const latestRun = listGrowthRuns({ limit: 1 })[0] || null;
    recordScheduler({
      lastInvocationResult: latestRun
        ? {
          status: latestRun.status,
          runId: latestRun.runId,
          stopReason: latestRun.stopReason || null,
          finishedAt: latestRun.finishedAt || null,
        }
        : { status: 'completed', reason: 'runtime_completed_without_growth_run' },
      activeRunId: latestRun?.status === 'active' ? latestRun.runId : '',
      lastError: null,
    });
  } catch (error) {
    const latestRun = listGrowthRuns({ limit: 1 })[0] || null;
    recordScheduler({
      lastInvocationResult: {
        status: 'runtime_error',
        runId: latestRun?.runId || activeRun?.runId || '',
      },
      activeRunId: latestRun?.status === 'active' ? latestRun.runId : '',
      lastError: String(error?.message || error),
    });
    throw error;
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
