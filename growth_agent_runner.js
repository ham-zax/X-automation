import 'dotenv/config';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  getGrowthAgentSchedulerStatus,
  renewGrowthAgentRuntimeHeartbeat,
  updateGrowthAgentSchedulerStatus,
} from './growth_agent_runtime.js';
import { getOperatorLeaseStatus } from './operator_lease.js';
import { finishGrowthRun } from './growth_run.js';
import { getAccountHealthSummary, getGrowthOperatorDelegation, listGrowthRuns, listPublicationAttempts } from './store.js';

const HOME = homedir();
const REPO = path.resolve(process.env.X_GROWTH_REPO || path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_RUNTIME = 'opencode';
const DEFAULT_OPENCODE_BIN = path.join(HOME, '.opencode/bin/opencode');
const DEFAULT_OPENCODE_MODEL = 'opencode/muse-spark-1.3-contributor-free';
const DEFAULT_CODEX_BIN = path.join(HOME, '.nvm/versions/node/v24.19.0/bin/codex');
const DEFAULT_CLAIVE_BIN = path.join(HOME, '.local/bin/claive');
const CLAIVE_MODEL = 'muse-spark-1.3-contributor';
const DEFAULT_PI_BIN = path.join(HOME, '.local/bin/pi');
const CURRENT_PI_BIN = path.join(HOME, '.pi/agent/bin/pi');

// Prefer an explicit X_GROWTH_PI_BIN; otherwise use whichever installed Pi
// executable exists. The legacy ~/.local/bin/pi path may only be a
// compatibility symlink, so the current ~/.pi/agent/bin/pi layout is an
// equal fallback. No PATH mutation and no symlink creation here.
function resolvePiBin(env = {}) {
  const explicit = String(env.X_GROWTH_PI_BIN || '').trim();
  if (explicit) return explicit;
  try {
    if (existsSync(DEFAULT_PI_BIN)) return DEFAULT_PI_BIN;
  } catch {}
  try {
    if (existsSync(CURRENT_PI_BIN)) return CURRENT_PI_BIN;
  } catch {}
  return DEFAULT_PI_BIN;
}
const DEFAULT_PI_MODEL = 'opencode2api/muse-spark-1.3-contributor-free';
const DEFAULT_PI_THINKING = 'high';
const PI_THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const DEFAULT_WEBHARNESS_AGENT_BROWSER = path.join(HOME, 'repo/webharness/node_modules/agent-browser/bin/agent-browser.js');
const DEFAULT_LINUX_AGENT_BROWSER = path.join(HOME, '.local/bin/agent-browser');
const DEFAULT_CDP_PORT = '9222';
const BROWSER_TARGETS = ['windows', 'linux'];
const RUNTIMES = ['opencode', 'codex', 'claude', 'pi', 'claive'];
const SCHEDULER_INTERVAL_MS = 15 * 60_000;

export function runtimeConfig(env = process.env) {
  if (env.NODE_ENV === 'production' && env.AI_ALLOW_RUNTIME_MANAGED !== 'true') {
    throw new Error('Production reasoning runtimes require AI_ALLOW_RUNTIME_MANAGED=true and provider-side billing limits.');
  }
  const runtime = String(env.X_GROWTH_AGENT_RUNTIME || DEFAULT_RUNTIME).trim().toLowerCase();
  if (!RUNTIMES.includes(runtime)) {
    throw new Error(`Unsupported X_GROWTH_AGENT_RUNTIME=${runtime}. Expected ${RUNTIMES.join(', ')}.`);
  }
  const claiveEngine = String(env.X_GROWTH_CLAIVE_ENGINE || 'muse').trim().toLowerCase();
  if (runtime === 'claive' && !['muse', 'pi'].includes(claiveEngine)) {
    throw new Error('X_GROWTH_CLAIVE_ENGINE must be muse or pi.');
  }
  const defaultModel = runtime === 'opencode' ? DEFAULT_OPENCODE_MODEL : runtime === 'pi' ? DEFAULT_PI_MODEL : runtime === 'claive' && claiveEngine === 'muse' ? CLAIVE_MODEL : '';
  const model = String(env.X_GROWTH_AGENT_MODEL || defaultModel).trim();
  if (runtime === 'claive' && claiveEngine === 'muse' && model !== CLAIVE_MODEL) {
    throw new Error(`Claive Muse workers require ${CLAIVE_MODEL}; alternate engines/models need explicit owner authorization.`);
  }
  const loweredModel = model.toLowerCase();
  if (loweredModel.includes('nemotron') || /(^|[\/_.:-])ling(?:$|[\/_.:-])/.test(loweredModel)) {
    throw new Error('Nemotron and Ling models are not allowed for the growth operator.');
  }
  // Pi is the headless-Linux runtime: its browser is the persistent CDP Chromium, not a Windows tab.
  const browserTarget = String(env.X_GROWTH_BROWSER_TARGET || (runtime === 'pi' ? 'linux' : 'windows')).trim().toLowerCase();
  if (!BROWSER_TARGETS.includes(browserTarget)) {
    throw new Error(`Unsupported X_GROWTH_BROWSER_TARGET=${browserTarget}. Expected windows or linux.`);
  }
  const thinking = String(env.X_GROWTH_PI_THINKING || DEFAULT_PI_THINKING).trim().toLowerCase();
  if (!PI_THINKING_LEVELS.includes(thinking)) {
    throw new Error(`Unsupported X_GROWTH_PI_THINKING=${thinking}. Expected ${PI_THINKING_LEVELS.join(', ')}.`);
  }
  const cdpPort = String(env.X_GROWTH_BROWSER_CDP_PORT || DEFAULT_CDP_PORT).trim();
  if (!/^\d{2,5}$/.test(cdpPort)) throw new Error('X_GROWTH_BROWSER_CDP_PORT must be a port number.');
  const agentBrowserCli = String(env.X_GROWTH_AGENT_BROWSER_CLI
    || (browserTarget === 'linux' ? DEFAULT_LINUX_AGENT_BROWSER : DEFAULT_WEBHARNESS_AGENT_BROWSER));
  const windowMinutes = Number(env.X_GROWTH_AGENT_WINDOW_MINUTES || 20);
  if (!Number.isFinite(windowMinutes) || windowMinutes < 1 || windowMinutes > 480) {
    throw new Error('X_GROWTH_AGENT_WINDOW_MINUTES must be between 1 and 480.');
  }
  return {
    runtime,
    claiveEngine,
    model,
    windowMinutes,
    browserTarget,
    cdpPort,
    agentBrowserCli,
    thinking,
    experiment: ['1', 'true', 'yes'].includes(String(env.X_GROWTH_AGENT_EXPERIMENT || '').trim().toLowerCase()),
    executable: runtime === 'claive'
      ? String(env.X_GROWTH_CLAIVE_BIN || DEFAULT_CLAIVE_BIN)
      : runtime === 'opencode'
      ? String(env.X_GROWTH_OPENCODE_BIN || DEFAULT_OPENCODE_BIN)
      : runtime === 'codex'
        ? String(env.X_GROWTH_CODEX_BIN || DEFAULT_CODEX_BIN)
        : runtime === 'pi'
          ? resolvePiBin(env)
          : String(env.X_GROWTH_CLAUDE_BIN || 'claude'),
  };
}

function browserSection({ browserTarget, agentBrowserCli, cdpPort, sessionId }) {
  if (browserTarget === 'linux') {
    const cli = `${agentBrowserCli} --cdp ${cdpPort} --session ${sessionId}`;
    return {
      cliRule: `- Drive X through the persistent headless Chromium on CDP port ${cdpPort} with the Agent Browser CLI, always as \`${cli} <command>\` (this exact prefix keeps one named session). Pass \`--cdp ${cdpPort}\` every time; never launch a separate browser. Use no other shell/node/python command to touch x.com; never use the legacy repository writer.`,
      observe: `Before beginning the run, use read-only Agent Browser observation (\`${cli} snapshot\`, \`${cli} get url\`, \`${cli} get title\`) of the existing X tab to establish whether the intended account is @ham_zax. If the browser is on a login page or another account, do not log in, do not enter credentials, and do not claim x_authenticated=true: begin the run with x_authenticated=false and browser_mutation=false, then finish via \`growth-run-finish\` recording the authentication blocker.`,
      session: 'authenticated headless X session',
    };
  }
  return {
    cliRule: `- Read /home/hamza/.agents/skills/browser/SKILL.md and prefer /home/hamza/.local/bin/wh-browser fast for the harness-owned browser-fast surface when MCP is unavailable. If that fails, read the Agent Browser core skill and use the WebHarness-bundled CLI at ${agentBrowserCli} in a named session; never use the legacy repository writer.
- Use \`observe {"scope":"full","tab":"<observed tab>"}\` to read actual posts and permalinks; compact snapshots may omit them. Read the execute schema before assuming action fields. A wait uses \`{"op":"wait","milliseconds":1000}\`; execute returns its observation inside \`final_state\`, while observe returns it at the top level. If a scroll times out, use the already visible posts rather than reload/retry; no page count is required.
- Use browser-fast/WebHarness for routine X/Twitter reading and mutation. Use browser-devtools only for diagnostics when the routine browser path fails.
- Before your first browser observation, and whenever navigation stalls or a native Leave site prompt appears, run \`node ops/windows-dialog-recovery.mjs --dismiss\`. This supported Windows-only recovery command uses native UI Automation on the WebHarness Chrome profile, clicks only Cancel, and reports found/cancelled/remaining. Page snapshots and Escape alone cannot verify native dialog dismissal. If remaining is nonzero or the command fails, record the exact blocker; do not keep navigating. Re-observe after recovery; never retry a possibly dispatched public send.`,
    observe: 'Before beginning the run, use browser-fast read-only observation of the existing Windows X tab to establish whether the intended account is @ham_zax. Do not claim x_authenticated=true until the account is positively observed.',
    session: 'authenticated Windows X session',
  };
}

export function operatorPrompt({ runtime, sessionId, maxDurationMinutes = 20, browserTarget = 'windows',
  agentBrowserCli = DEFAULT_WEBHARNESS_AGENT_BROWSER, cdpPort = DEFAULT_CDP_PORT, experiment = false }) {
  const browser = browserSection({ browserTarget, agentBrowserCli, cdpPort, sessionId });
  const experimentSection = experiment ? `
EXPERIMENT MODE (owner decision): @ham_zax is a test account and the owner is running an experiment to see 1-2 days of unattended results. The owner has granted full authority for every governed decision in this session: approve, review and send replies, quotes, reposts and originals that pass the bridge's own gates; no human will review before sending. Bias toward action, not silence:
- Each pass should complete at least 2 public actions when any eligible candidate exists. Prefer well-grounded replies to fresh For You posts first; if replies are dry, write and publish one original post or quote grounded in what you just observed. Do not stop after a thin feed: re-collect, use the editorial plan, or advance existing drafts and approved queue items.
- Review your own drafts critically before sending: factual grounding, fit with the persona, and no repetition of recent posts. Revise instead of dropping when a draft is close.
- Main-feed drafts do not require a human owner review in this experiment. For an Original, Quote, or Thread you created/revised through the bridge, use the delegated path: establish the current deterministic strategy with \`writing-strategy-select\` using selectedBy=\`mission_agent\`, this run's grantRevision and draftId; re-apply Writer output against that current generation when needed; once the item is \`needs_review\`, call \`mission-approve\` with this runId/sessionId, grantRevision, the candidate key, and concrete \`verificationProvenance\` (\`authorityType=mission_agent\`, sourceReferences, and any evidenceReferences actually used). If a prerequisite is rejected, repair it through the bridge or fall back to \`prepare_main_feed\`; never wait for the dashboard/human lane merely because the item says \`needs_review\`.
- Write like a person, not a bot: varied length and openers, specific details from the source, plain words, no hashtags, no emoji spam, no template phrasing, no "Great point" filler, no restating the source. Reply to what was actually said.
- Expired or stale queue items may be expired through the bridge rather than left blocking the queue.
- The bridge's hard gates (single publication claim, reconciliation, account health, duplicate fences, authentication) still apply; never bypass them and never invent a publication.
` : '';
  return `You are the unattended reasoning operator for XGrowth in ${REPO}.

This is an OPERATIONAL growth session, not a software-engineering task.

Execute this checklist first; it is included here so no separate discovery or historical-plan reading is needed:
${readFileSync(path.join(REPO, 'docs/GROWTH_AGENT_EXECUTION.md'), 'utf8')}

Use the existing Growth OS, not just the browser. Its purpose is qualified developer/builder follower growth through purposeful content and recurring relationships:
- Discovery/selection: operator-status, growth-next, cached engage-next, current Growth Focus, and exact live sources. X conversations feed Replies/Quotes/Reposts; GitHub Trending and HN feed researched Originals/Threads. Consult relationship-targets/relationship-inspect for relevant relationships and active responses.
- Preparation: use the active persona, behavior-select, route, writer-packet/apply-writer-output, writing-strategy, and the content/provenance gates. When growth-run-next permits prepare_main_feed, invoke that operation to reuse the existing editorial, Writer, review, and mission-agent approval pipeline rather than reinvent it or wait for a dashboard click. Main-feed approval is still exact, revisioned, and gated.
- Read docs/GROWTH_AGENT_EXECUTION.md for the exact preparation and error-recovery recipes. These apply in normal mode too. For writing-strategy-select always supply selectedBy="mission_agent", queueItemId, draftId and the current grantRevision. The bridge selects the current deterministic option or explicitly turns strategy influence off. Do not guess intent/style/guidance fields, call the human selection branch, or set confirmSelect=true. writing-strategy is a read-only preview, not a mutation.
- Execution: browser-publish-claim owns eligible scheduled main-feed work; browser-reply-claim performs the persisted autonomous-reply evaluation and owns exact reply authority. Use the returned exact text/target, send-start, one browser send, structural verification, and record-action. Repost needs no invented commentary. Never treat drafting or claiming as a completed public action.
- Outcomes: after useful execution, inspect due measurements, analytics, performance, relationship-events, experiments, and learning where they inform the next decision. Record only observed analytics. Learned suggestions have no effect until accepted under their evidence/authority rules; do not create redundant experiments or force a learning update without evidence. Existing scheduler, health, duplicate, and reconciliation owners remain authoritative.
- Finish with confirmed Replies/Quotes/Originals/Threads/Reposts separately from skipped candidates, preparation, exact blockers, and uncertain attempts. Browsing time and follower-count coincidences are not growth outcomes.

Hard boundaries:
- Do not edit source files, docs, configuration, package files, Git state, systemd units, dependencies, or environment variables.
- Do not run git commands.
- The only local state mutations you may make are through the canonical \`npm run agent -- <command>\` Growth OS bridge from ${REPO}.
- Never wrap a canonical Growth OS bridge command in shell \`timeout\`, background it, pipe it through a process that can terminate it early, or otherwise impose a shorter external deadline. The bridge/runtime owns its bounded AI deadline and must return cleanly so claims, AI concurrency, and audit rows reconcile correctly.
- Do not inspect implementation source to reverse-engineer bridge behavior. Use the operational docs and bridge outputs as the public contract. Apart from canonical \`npm run agent -- ...\` invocations, wh-browser, the named-session Agent Browser CLI, the documented Windows dialog recovery command, and \`date +%s%3N\` to capture observation time, do not run ad hoc shell/node/python commands.
${browser.cliRule}
- Never use a background Node daemon to mutate x.com.
- Never blindly retry a consequential browser/API write after an ambiguous result.
- A native Chrome "Leave site?" dialog is not a page element. If navigation/tab reads stall, cancel the pending navigation with Escape on that exact tab to preserve unsent content, then re-observe. If needed, use browser-devtools handle_dialog(action=dismiss), or the harness-bundled Agent Browser dialog control explicitly attached to the same existing CDP endpoint and named session; never let a fallback launch a different browser/profile. Handle only the dialog, not another Post/Reply click. After any attempted send, dialog recovery is for reconciliation and never grants retry authority.
- Never invent a successful publication. Reconciliation requires positive live evidence and route structure.
- A no-action run is healthy when no worthwhile eligible opportunity exists. Ceilings are limits, not action targets.
- Discovery serves action: spend at most two minutes on the initial feed scan, using one full observation and at most one scroll. A few relevant visible posts are enough; 25-50 observations is not a minimum. Ingest the exact observed posts immediately and move to selection/preparation/claim. Do not repeatedly reload the feed, retry a broken scroll, or build collector scripts. When browser collection fails, preserve any usable observations and proceed with them; if none exist, record the specific capability blocker and finish.
- Before scanning, read operator-status and growth-run-next. Execute any due eligible claim that the current run permits before collecting more. After ingest, use growth-next and growth-run-next to select a worthwhile Reply/Quote/Original/Repost and carry it through the canonical approval, claim, send, verification, and reconciliation gates. Finding an eligible opportunity is a reason to act, not to keep browsing for a larger sample.
- A second discovery pass is justified only after the ingested candidates have been evaluated and acted on or explicitly skipped/deferred. Never loop on an unchanged snapshot. If preparation returns action=needs_revision, its repair command/payload identifies the existing draft: obtain that fresh writer-packet, correct the named claims/voice/quality problems, apply output, request ready and mission-approve. A failed content review is not proof that no worthwhile work exists. Do not invoke prepare_main_feed again unchanged or reset to feed discovery to avoid revision. For other failures, report and repair the exact bridge blocker when authorized.
- Fresh observation does not mean a fresh post. If the visible posts are expired for Replies, consider a source-grounded Original/Quote through prepare_main_feed, or one targeted Latest search in the current Growth Focus. Persist search sources through ingest with their exact text/URL and observed provenance; do not label a search result as a personalized For You observation. Do not keep collecting old For You posts.
- A stale persona-bound main-feed approval has a bridge repair path: update-draft with the persisted draft id and status=draft invalidates approval and reopens drafting; select current behavior/persona, obtain the current writer-packet, apply complete Writer output, request status=ready, then mission-approve only after current gates/provenance pass. Never call mission-approve directly on an approved row or demand owner intervention merely to re-review delegated work.
- Inspect complete bridge results without head/tail truncation or early-closing pipes. With npm output, use a file or npm's silent output and parse the relevant JSON fields after the bridge completes. In particular, retain ingestion engagement.rejections, next.claim, preparation.operationResult, and exact claim errors. A masked shell exit code is not a successful bridge operation.
- On a contract error, read the relevant recipe once and repair the exact missing prerequisite. Never cycle through guessed field/action names. If the documented repair fails, record the exact error and use another eligible candidate or finish with that blocker. Do not call writing-strategy-recommend repeatedly to repair mission-agent selection; it already computes current guidance itself.
- Aim for roughly 4-8 worthwhile completed engagements in one run when the live opportunity set justifies them; stop earlier rather than create filler, and never manufacture one of every action type.
- Purpose/behavior metadata may explain why an interaction is worthwhile, but it must not prescribe Hamza's public wording; the active persona owns how Hamza talks.
- Likes and DMs are eligible only if Growth OS exposes an explicit governed authority, targeting, execution, verification, and reconciliation lane for them; otherwise skip them rather than use a raw browser mutation path.

Read these operational contracts before acting:
- docs/PERSISTENT_GROWTH_OPERATOR_PROMPT.md
- docs/OWNER_PROFILE_EVIDENCE.md
- docs/GROWTH_OS_MOMENTUM_OPERATOR.md
- docs/GROWTH_RUN_PROTOCOL.md if present
- docs/GROWTH_AGENT_EXECUTION.md for executable contracts; historical implementation plans are not required reading

${browser.observe}

Begin/resume the canonical run with:
\`npm run agent -- growth-run-begin\`
using adapterType \`${runtime}_unattended\`, sessionId \`${sessionId}\`, truthful capabilities for reasoning, browser_read, browser_mutation, x_authenticated, and primary_source_web_research, and \`ceilings.maxPublicMutations=8\`, \`ceilings.maxDurationMinutes=${maxDurationMinutes}\` for this bounded pass. The launcher may start another fresh reasoning session only after a clean resource-ceiling finish; this session must finish and exit at its ceiling. If authentication changes after begin, update the same run through \`growth-run-resume\` rather than abandoning it.

Then follow the run state rather than improvising a parallel workflow:
1. If recovery is requested, inspect the exact publication attempt and reconcile only from evidence. If useful recovery is exhausted, close unresolved rather than calling it not-sent.
2. If \`collect_for_you\` is requested, use the ${browser.session}. Verify the intended account is @ham_zax. Collect a bounded, diverse set of recent organic For You observations, stopping early when marginal value falls. Submit them through \`x-for-you-ingest\` with top-level observedAt (the actual observation time as a positive safe-integer Unix timestamp in milliseconds), accountHandle=ham_zax plus adapterType, sessionId, runId, browserTarget=${browserTarget}, browserBackend=chrome, sensorVersion, and collectionStatus. Each \`posts[]\` entry must match the bridge contract exactly: \`tweetId\` as a numeric string, \`url\` as the matching \`https://x.com/<username>/status/<tweetId>\` permalink, \`username\`, non-empty \`text\`, and a positive integer \`rank\`; set \`promoted=true\` for ads/promoted posts so they are skipped, and include \`metrics\` only as non-negative numeric views/likes/reposts/replies/bookmarks plus optional numeric \`timestamp\`. Never submit placeholder IDs, profile URLs, relative-time strings as timestamps, or post objects missing the permalink/ID pair.
3. Use \`growth-next\`, \`inspect\`, relationship/context commands, exact live-source inspection, owner-supplied evidence from \`docs/OWNER_PROFILE_EVIDENCE.md\`, and primary sources where claims are material. If \`growth-next\` returns an empty \`items\` array and \`growth-run-next\` permits \`collect_for_you\`, immediately refresh the For You observations and ingest them before deciding the run is dry; do not idle on an exhausted-but-still-fresh snapshot. Treat heuristic scores and the current Growth Focus taxonomy as advisory evidence, not cages. When your live judgment materially differs, call \`operator-priority-set\` with this runId/sessionId, a 0-100 score, a concrete reason, and the signals that changed your view (for example momentum, crowding, source quality, relationship value, current viral/style context, or Hamza fit). If a clearly durable developer/builder identity or community term is missing from Growth Focus, use \`growth-focus-expand\` under the active run to extend the relevant group (or add a justified Core/Adjacent group) with a concrete reason, then re-evaluate. Do not expand from random off-topic noise or promote explicit exclusion terms. The source itself need not be technical when the social act has a coherent builder-identity, relationship, community, or profile-discovery purpose. The active-run score becomes the execution priority while the heuristic remains visible for comparison. Do not act on a weak social paraphrase when verification matters.
4. Read \`persona-tone\`. If no daily preference is active, use observed candidate context to select a small tilt through \`persona-tone-set\`, with a concrete reason, stored candidate sourceReferences and influence no greater than 0.1. Never override an active owner preference or claim knowledge of Hamza's private mood. This is a wording preference only; it cannot change routing, truth, purpose, silence or authority. Supply purpose/behavior judgment through canonical bridge commands. Preserve Hamza's persona and the rule that not every useful social act needs a technical lesson.
5. Choose Reply, Quote, Repost, Original, or silence dynamically. Likes are not part of the dependable-autonomy contract yet and must not be performed invisibly.
6. When \`growth-run-next\` recommends \`claim_action\` and includes a \`claim\` object, treat that object as the canonical next executable action. For \`lane=main_feed\`, call its \`browser-publish-claim\` with exactly the supplied queueItemId plus this runId/sessionId. Do not reject browser-owned work merely because the background daemon lacks X API credentials. For an eligible Reply, use \`browser-reply-claim\` with this runId/sessionId. A successful claim returns an attemptId whose immutable claim already stores run/session provenance. Re-observe the exact target immediately before mutation. Immediately before the consequential browser mutation call \`publication-attempt-send-start\` with that attemptId only. Execute once. Verify the live result structurally. Then call \`record-action\` with the same attemptId and positive publicationVerification.
7. Re-read \`growth-run-next\` after durable transitions. If it names an executable claim, either execute that claim or record the specific live/policy evidence that invalidated it; do not silently reinterpret it as daemon-owned work. Continue only while another worthwhile eligible action exists and within the run ceilings.
8. Finish via \`growth-run-finish\` with an accurate structured outcome and stop reason. If a capability/auth/authority blocker prevents useful continuation, record that blocker rather than bypassing policy.

Do not optimize for a fixed number of posts/replies. Optimize for useful, relevant growth and stop when marginal value is low.
${experimentSection}`;
}

export function commandFor(config, prompt, { promptFile, engineSessionId } = {}) {
  if (config.runtime === 'claive') {
    if (!promptFile) throw new Error('Claive requires a temporary operational prompt file.');
    const args = [
      'run', '--workspace', REPO, '--prompt-file', promptFile,
      '--label', 'XGrowth autonomous operator', '--engine', config.claiveEngine,
    ];
    if (config.claiveEngine === 'pi') {
      args.push('--provider', 'opencode2api', '--reasoning-effort', 'max');
      if (engineSessionId) args.push('--session-id', engineSessionId);
      if (config.model) args.push('--model', config.model);
    } else {
      args.push('--model', CLAIVE_MODEL, '--reasoning-effort', 'xhigh',
        '--max-model-steps', '100', '--web');
    }
    return { executable: config.executable, args };
  }
  if (config.runtime === 'claude') {
    const args = ['--print', '--no-session-persistence', '--permission-mode', 'dontAsk',
      '--tools', 'Bash,Read', '--allowedTools',
      'Read', 'Bash(npm run agent -- *)',
      `Bash(node ${config.agentBrowserCli} *)`,
      'mcp__browser-fast__*', 'mcp__browser-devtools__*',
      'mcp__open-websearch__*', 'mcp__khiip__*'];
    if (config.model) args.push('--model', config.model);
    return { executable: config.executable, args, stdinPrompt: prompt };
  }
  if (config.runtime === 'opencode') {
    const args = ['run', '--standalone', '--auto', '--title', 'XGrowth unattended operator'];
    if (config.model) args.push('--model', config.model);
    args.push(prompt);
    return { executable: config.executable, args };
  }
  if (config.runtime === 'pi') {
    // Pi has no OS sandbox or per-command allowlist: the prompt's hard boundaries are the only
    // guard, so run it as an unprivileged user with nothing but this repo and the browser to reach.
    const args = ['--print', '--no-session', '--offline', '--no-extensions', '--no-approve',
      '--tools', 'read,bash', '--thinking', config.thinking];
    const slash = config.model.indexOf('/');
    if (slash > 0) args.push('--provider', config.model.slice(0, slash), '--model', config.model.slice(slash + 1));
    else if (config.model) args.push('--model', config.model);
    args.push('--', prompt);
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

// Kill the whole reasoning/browser subprocess group; never reconcile claims by guessing.
export function runChild(command, { cwd = REPO, timeoutMs, killGraceMs = 5_000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('A positive child deadline is required.');
  return new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd, env: { ...process.env, PATH: `${path.join(HOME, '.local/bin')}:${process.env.PATH || ''}` }, shell: false, detached: true,
      stdio: [command.stdinPrompt ? 'pipe' : 'ignore', 'inherit', 'inherit'],
    });
    let failure = null;
    let killTimer;
    const killGroup = (signal) => {
      if (!child.pid) return;
      try { process.kill(-child.pid, signal); } catch (error) {
        if (error.code !== 'ESRCH') failure ||= error;
      }
    };
    const stop = (reason) => {
      if (failure) return;
      failure = new Error(reason);
      killGroup('SIGTERM');
      killTimer = setTimeout(() => killGroup('SIGKILL'), killGraceMs);
    };
    const onTerm = () => stop('Growth agent interrupted by SIGTERM.');
    const onInt = () => stop('Growth agent interrupted by SIGINT.');
    process.once('SIGTERM', onTerm);
    process.once('SIGINT', onInt);
    const timeout = setTimeout(() => stop('Growth agent runtime deadline expired.'), timeoutMs);
    const cleanup = () => {
      clearTimeout(timeout);
      clearTimeout(killTimer);
      process.removeListener('SIGTERM', onTerm);
      process.removeListener('SIGINT', onInt);
      // A CLI may exit while browser/tool descendants remain alive.
      killGroup('SIGKILL');
    };
    child.once('error', (error) => { cleanup(); reject(error); });
    child.once('exit', (code, signal) => {
      cleanup();
      if (failure) reject(failure);
      else if (code === 0) resolve({ code, signal: signal || null });
      else reject(new Error(`Growth agent runtime exited with code ${code}${signal ? ` (${signal})` : ''}.`));
    });
    if (command.stdinPrompt) {
      child.stdin.on('error', (error) => { if (error.code !== 'EPIPE') stop(error.message); });
      child.stdin.end(command.stdinPrompt);
    }
  });
}

function startRuntimeHeartbeatPump(adapterType, sessionId) {
  const renew = () => {
    try { renewGrowthAgentRuntimeHeartbeat({ adapterType, sessionId }); } catch {}
  };
  const timer = setInterval(renew, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}

export function continuationAllowed(run) {
  return !!run && run.status === 'completed'
    && run.stopReason === 'resource_ceiling_reached'
    && run.result?.closedUnresolved === 0
    && run.result?.investigating === 0;
}

export async function main(overrides = {}) {
  const config = overrides.config || runtimeConfig();
  const now = overrides.now || Date.now;
  const deps = {
    delegation: getGrowthOperatorDelegation, runs: listGrowthRuns,
    lease: getOperatorLeaseStatus, health: getAccountHealthSummary,
    child: runChild, attempts: listPublicationAttempts,
    heartbeat: startRuntimeHeartbeatPump, finishRun: finishGrowthRun, ...overrides,
  };
  const startedAt = now();
  const deadline = startedAt + config.windowMinutes * 60_000;
  const scheduledInvocation = String(process.env.X_GROWTH_AGENT_SCHEDULED || '') === '1';
  const record = overrides.record || ((patch) => scheduledInvocation
    ? updateGrowthAgentSchedulerStatus(patch) : getGrowthAgentSchedulerStatus());
  const sessions = [];
  record({ configured: true, enabled: true, lastInvocationAt: startedAt,
    nextInvocationAt: startedAt + SCHEDULER_INTERVAL_MS, lastError: null });
  const finish = (result, activeRunId = '') => {
    const outcome = { ...result, windowMinutes: config.windowMinutes, startedAt,
      deadline, sessions };
    record({ lastInvocationResult: outcome, activeRunId });
    return outcome;
  };
  const initialRevision = deps.delegation().revision;
  let incompleteRestarts = 0;
  let continuationCheckpoint = '';
  while (deadline - now() >= 60_000) {
    const delegation = deps.delegation();
    if (delegation.state !== 'running' || delegation.mode !== 'live'
      || delegation.revision !== initialRevision) {
      return finish({ status: 'blocked', reason: 'delegation_not_live_or_revised' });
    }
    const lease = deps.lease({ now: now() });
    if (lease.active) return finish({ status: 'coalesced', reason: 'operator_lease_active',
      leaseId: lease.leaseId, runId: lease.runId || '' }, lease.runId || '');
    if (deps.health({ now: now() }).health.state === 'constrained') {
      return finish({ status: 'blocked', reason: 'account_health_constrained' });
    }
    // Do not block the launcher on unresolved publication state or an
    // orphaned active Growth Run. beginGrowthRun() resumes an existing active
    // run and ensureRunLease() safely reacquires an expired lease for the new
    // reasoning session. A genuinely concurrent operator is already fenced by
    // the active-lease check above. Launching here is therefore the recovery
    // mechanism: the run state machine can enter recovery, reconcile from live
    // browser evidence, or continue the interrupted run without a blind write.
    const sessionId = `${config.runtime}-${randomUUID()}`;
    const maxDurationMinutes = Math.min(20, Math.floor((deadline - now()) / 60_000));
    const prompt = operatorPrompt({ runtime: config.runtime, sessionId, maxDurationMinutes,
      browserTarget: config.browserTarget, agentBrowserCli: config.agentBrowserCli, cdpPort: config.cdpPort, experiment: config.experiment })
      + (continuationCheckpoint ? `\nCONTINUATION: Run ${continuationCheckpoint} ended its model turn without finishing and before creating any publication attempt. The launcher closed that run and released its lease. Begin a new run with this session ID and resume its saved queue work. Your previous final statement describing the next action did not execute it. Call the supported tool now; do not end with another progress-only statement. Re-observe before any mutation and use only this new run's canonical claim.\n` : '');
    continuationCheckpoint = '';
    let promptDirectory;
    const stopHeartbeatPump = deps.heartbeat(`${config.runtime}_unattended`, sessionId);
    try {
      let promptFile;
      if (config.runtime === 'claive') {
        promptDirectory = await mkdtemp(path.join(tmpdir(), 'x-growth-claive-'));
        promptFile = path.join(promptDirectory, 'operator.md');
        await writeFile(promptFile, prompt, { mode: 0o600 });
      }
      const retainedPi = config.runtime === 'claive' && config.claiveEngine === 'pi';
      const engineSessionId = retainedPi ? randomUUID() : undefined;
      let run;
      // A final progress sentence ends a headless model turn, not the mission.
      // Keep the exact bridge authority and retained Pi history for bounded
      // follow-ups instead of abandoning an owned claim in a closed run.
      for (let turn = 0; turn < 4; turn++) {
        const command = commandFor(config, prompt, { promptFile, engineSessionId });
        await deps.child(command, {
          timeoutMs: Math.min(deadline - now(), (maxDurationMinutes + 2) * 60_000),
          killGraceMs: config.runtime === 'claive' ? 15_000 : 5_000,
        });
        run = deps.runs({ sessionId, limit: 1 })[0] || null;
        if (!retainedPi || run?.status !== 'active' || turn === 3
          || deadline - now() < 60_000) break;
        const currentGrant = deps.delegation();
        if (currentGrant.state !== 'running' || currentGrant.mode !== 'live'
          || currentGrant.revision !== initialRevision
          || deps.health({ now: now() }).health.state === 'constrained') break;
        const attempts = deps.attempts({ runId: run.runId, limit: 100 });
        const uncertain = attempts.some(attempt => ['send_started', 'investigating'].includes(attempt.state));
        const followup = `Continue the SAME Growth Run ${run.runId}, sessionId ${sessionId}. Retained history and all existing operational boundaries still apply. Do not begin a new run or obtain another claim for an existing attempt.
Your previous progress sentence ended the model turn without executing the described action. Call the next supported tool now, or finish through growth-run-finish with a concrete blocker.
${attempts.length ? 'First inspect the existing publication-attempts for this run.' : 'The launcher verified that this run has no publication attempts. Execute the pending operation from your previous turn now (for example x-for-you-ingest with the already observed posts), or execute the currently permitted growth-run-next operation. Do not repeat queue/status/discovery inspection before completing that pending operation.'} ${uncertain
          ? 'RECONCILIATION ONLY this turn: a send has started or is uncertain. Inspect exact live output and reconcile through the bridge. Never click Post/Reply/Repost again or dispatch any public mutation.'
          : 'An owned claimed attempt may continue only under its exact current authority: re-observe the exact source/tab, use its existing attemptId, call send-start immediately before one send, then verify and reconcile. Unknown outcomes permit reconciliation only, never another send.'}
Finish the durable run when done; do not end with another progress-only statement.
`;
        await writeFile(promptFile, followup, { mode: 0o600 });
      }
      // A reasoning child may exit 0 without finishing its durable Growth Run
      // (production run 76 published a reply, then exited while status=active).
      // Close the orphan through the canonical finish path so its lease is
      // released and its runtime detached; publication accounting is preserved
      // by finishGrowthRun and nothing is retried here. No runtimeFailure
      // marker is recorded: a normal exit is not provider-failure evidence and
      // must not trigger model failover.
      if (run?.status === 'active') {
        try {
          const closed = deps.finishRun(run.runId, {
            status: 'partial',
            stopReason: 'manual_intervention_required',
            stopDetail: 'Reasoning runtime exited normally without finishing its Growth Run; launcher closed the orphaned run via the canonical finish path without retrying any publication.',
            result: {
              launcherRecovery: {
                reason: 'normal_child_exit_with_active_run',
                runtime: config.runtime,
                model: config.model,
              },
            },
            now: now(),
          });
          sessions.push({
            sessionId,
            runId: run.runId,
            status: closed?.status || closed?.run?.status || 'partial',
            stopReason: closed?.stopReason || closed?.run?.stopReason || 'manual_intervention_required',
            finishedAt: closed?.finishedAt || closed?.run?.finishedAt || now(),
          });
          // One fresh reasoning continuation is allowed only before the old
          // run created any publication attempt. Never automatically restart
          // a run that crossed a claim/send boundary or spin on repeated exits.
          if (!retainedPi && incompleteRestarts === 0 && deadline - now() >= 60_000
            && deps.attempts({ runId: run.runId, limit: 1 }).length === 0) {
            incompleteRestarts++;
            continuationCheckpoint = run.runId;
            continue;
          }
          return finish({
            status: closed?.status || closed?.run?.status || 'partial',
            runId: run.runId,
            stopReason: closed?.stopReason || closed?.run?.stopReason || 'manual_intervention_required',
            reason: 'launcher_closed_orphaned_active_run',
          });
        } catch (recoveryError) {
          const recoveryMessage = `Launcher could not close orphaned active run ${run.runId}: ${String(recoveryError?.message || recoveryError)}`;
          record({ lastError: recoveryMessage });
          sessions.push({ sessionId, runId: run.runId, status: 'launcher_recovery_failed' });
          return finish({ status: 'blocked', reason: 'launcher_recovery_failed', runId: run.runId, stopDetail: recoveryMessage }, run.runId);
        }
      }
      sessions.push({ sessionId, runId: run?.runId || '', status: run?.status || 'missing',
        stopReason: run?.stopReason || null, finishedAt: run?.finishedAt || null });
      if (!continuationAllowed(run)) return finish(run
        ? { status: run.status, runId: run.runId, stopReason: run.stopReason || null }
        : { status: 'blocked', reason: 'runtime_completed_without_growth_run' },
      run?.status === 'active' ? run.runId : '');
    } catch (error) {
      const run = deps.runs({ sessionId, limit: 1 })[0] || null;
      const message = String(error?.message || error);
      record({ lastError: message });
      if (run?.status === 'active') {
        try {
          const closed = deps.finishRun(run.runId, {
            status: 'partial',
            stopReason: 'capability_unavailable',
            stopDetail: `Reasoning runtime exited before the Growth Run could finish: ${message}`,
            result: {
              runtimeFailure: {
                runtime: config.runtime,
                model: config.model,
                error: message,
              },
            },
            now: now(),
          });
          sessions.push({
            sessionId,
            runId: run.runId,
            status: closed?.status || 'partial',
            stopReason: closed?.stopReason || 'capability_unavailable',
            finishedAt: closed?.finishedAt || now(),
          });
          return finish({
            status: closed?.status || 'partial',
            runId: run.runId,
            stopReason: closed?.stopReason || 'capability_unavailable',
            reason: 'runtime_provider_failure',
          });
        } catch (recoveryError) {
          sessions.push({ sessionId, runId: run.runId, status: 'runtime_error_recovery_failed' });
          record({ lastError: `${message}; recovery failed: ${String(recoveryError?.message || recoveryError)}` });
          throw error;
        }
      }
      sessions.push({ sessionId, runId: '', status: 'runtime_error' });
      finish({ status: 'runtime_error', reason: message });
      throw error;
    } finally {
      stopHeartbeatPump();
      if (promptDirectory) await rm(promptDirectory, { recursive: true, force: true });
    }
  }
  return finish({ status: 'completed', reason: 'operation_window_elapsed' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((outcome) => console.log(JSON.stringify(outcome))).catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
