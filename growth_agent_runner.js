import 'dotenv/config';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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
import { BROWSER_INTERFACES, browserOperatorContract } from './ops/browser_operator_contract.js';
import { finishGrowthRun, GROWTH_RUN_STOP_REASONS } from './growth_run.js';
import { getAccountHealthSummary, getGrowthOperatorDelegation, listGrowthRuns, listPublicationAttempts } from './store.js';

const HOME = homedir();
const REPO = path.resolve(process.env.X_GROWTH_REPO || path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_RUNTIME = 'opencode';
const DEFAULT_OPENCODE_BIN = path.join(HOME, '.opencode/bin/opencode');
const DEFAULT_OPENCODE_MODEL = 'opencode/muse-spark-1.3-contributor-free';
const DEFAULT_CODEX_BIN = path.join(HOME, '.nvm/versions/node/v24.19.0/bin/codex');
const DEFAULT_CLAIVE_BIN = path.join(HOME, '.local/bin/claive');
const CLAIVE_MODEL = 'muse-spark-1.3-contributor';
const CLAIVE_CODEX_MODEL = 'gpt-6-luna';
const DEFAULT_PI_BIN = path.join(HOME, '.local/bin/pi');
const CURRENT_PI_BIN = path.join(HOME, '.pi/agent/bin/pi');

function contextRecoveryPrompt() {
  return readFileSync(path.join(REPO, 'docs/GROWTH_CONTEXT_RECOVERY.md'), 'utf8');
}

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
const RUNTIMES = ['opencode', 'codex', 'claude', 'pi', 'claive', 'muse'];
const SCHEDULER_INTERVAL_MS = 5 * 60_000;

function growthAgentMode(env) {
  const mode = String(env.GROWTH_AGENT_MODE || 'executor').trim().toLowerCase();
  if (!['executor', 'legacy'].includes(mode)) {
    throw new Error(`Unsupported GROWTH_AGENT_MODE=${mode}. Expected executor or legacy.`);
  }
  return mode;
}

export function runtimeConfig(env = process.env) {
  if (env.NODE_ENV === 'production' && env.AI_ALLOW_RUNTIME_MANAGED !== 'true') {
    throw new Error('Production reasoning runtimes require AI_ALLOW_RUNTIME_MANAGED=true and provider-side billing limits.');
  }
  const runtime = String(env.X_GROWTH_AGENT_RUNTIME || DEFAULT_RUNTIME).trim().toLowerCase();
  if (!RUNTIMES.includes(runtime)) {
    throw new Error(`Unsupported X_GROWTH_AGENT_RUNTIME=${runtime}. Expected ${RUNTIMES.join(', ')}.`);
  }
  const claiveEngine = String(env.X_GROWTH_CLAIVE_ENGINE || 'muse').trim().toLowerCase();
  if (runtime === 'claive' && !['muse', 'pi', 'codex'].includes(claiveEngine)) {
    throw new Error('X_GROWTH_CLAIVE_ENGINE must be muse, pi, or codex.');
  }
  const defaultModel = runtime === 'opencode' ? DEFAULT_OPENCODE_MODEL : runtime === 'pi' ? DEFAULT_PI_MODEL : (runtime === 'claive' && claiveEngine === 'muse') || runtime === 'muse' ? CLAIVE_MODEL
    : runtime === 'claive' && claiveEngine === 'codex' ? CLAIVE_CODEX_MODEL : '';
  const model = String(env.X_GROWTH_AGENT_MODEL || defaultModel).trim();
  if (runtime === 'claive' && claiveEngine === 'muse' && model !== CLAIVE_MODEL) {
    throw new Error(`Claive Muse workers require ${CLAIVE_MODEL}; alternate engines/models need explicit owner authorization.`);
  }
  if (runtime === 'claive' && claiveEngine === 'codex' && model !== CLAIVE_CODEX_MODEL) {
    throw new Error(`Claive Codex workers require ${CLAIVE_CODEX_MODEL}; alternate engines/models need explicit owner authorization.`);
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
  const browserInterface = String(env.X_GROWTH_BROWSER_INTERFACE
    || 'agent-browser-cli')
    .trim().toLowerCase();
  if (!BROWSER_INTERFACES.includes(browserInterface)) {
    throw new Error(`X_GROWTH_BROWSER_INTERFACE must be ${BROWSER_INTERFACES.join(' or ')}.`);
  }
  const browserMcpServer = String(env.X_GROWTH_BROWSER_MCP_SERVER || 'xgrowth_browser').trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(browserMcpServer)) {
    throw new Error('X_GROWTH_BROWSER_MCP_SERVER must be a simple MCP server name.');
  }
  const browserFastBackend = String(env.X_GROWTH_BROWSER_FAST_BACKEND || 'clearcote').trim().toLowerCase();
  if (!['chrome', 'clearcote'].includes(browserFastBackend)) {
    throw new Error('X_GROWTH_BROWSER_FAST_BACKEND must be chrome or clearcote.');
  }
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
    browserInterface,
    browserMcpServer,
    browserFastBackend,
    thinking,
    experiment: ['1', 'true', 'yes'].includes(String(env.X_GROWTH_AGENT_EXPERIMENT || '').trim().toLowerCase()),
    agentMode: growthAgentMode(env),
    executable: runtime === 'claive'
      ? String(env.X_GROWTH_CLAIVE_BIN || DEFAULT_CLAIVE_BIN)
      : runtime === 'muse'
      ? String(env.X_GROWTH_MUSE_BIN || 'muse')
      : runtime === 'opencode'
      ? String(env.X_GROWTH_OPENCODE_BIN || DEFAULT_OPENCODE_BIN)
      : runtime === 'codex'
        ? String(env.X_GROWTH_CODEX_BIN || DEFAULT_CODEX_BIN)
        : runtime === 'pi'
          ? resolvePiBin(env)
          : String(env.X_GROWTH_CLAUDE_BIN || 'claude'),
  };
}

function browserSection({ browserTarget, browserInterface, browserMcpServer, browserFastBackend, agentBrowserCli, cdpPort, sessionId }) {
  if (browserTarget === 'linux') {
    return {
      cliRule: browserOperatorContract({ browserTarget, browserInterface, browserMcpServer, browserFastBackend, agentBrowserCli, cdpPort, sessionId }),
      observe: 'Before beginning a run, observe the current authenticated X tab and positively confirm @ham_zax; do not log in or enter credentials. If account verification fails, begin with x_authenticated=false and browser_mutation=false and report the blocker.',
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

function executorBrowserLine({ browserTarget, browserInterface, browserMcpServer, browserFastBackend, agentBrowserCli, cdpPort, sessionId }) {
  if (browserTarget === 'linux') return browserOperatorContract({ browserTarget, browserInterface, browserMcpServer, browserFastBackend, agentBrowserCli, cdpPort, sessionId });
  return `Browser: read X with browser-fast (wh-browser fast); if MCP is unavailable, use the named Agent Browser CLI at ${agentBrowserCli}. Observe with \`{"scope":"full","tab":"<tab>"}\` to see permalinks. Before the first observation and whenever navigation stalls, run \`node ops/windows-dialog-recovery.mjs --dismiss\`, then re-observe. Never retry a possibly dispatched send.`;
}

// Compact default prompt for the scout -> write -> act loop. operatorPrompt stays
// reachable through GROWTH_AGENT_MODE=legacy. Keep the sessionId and
// maxDurationMinutes lines: the launcher and tests read them from the prompt.
export function executorPrompt({ runtime, sessionId, maxDurationMinutes = 20, browserTarget = 'windows',
  agentBrowserCli = DEFAULT_WEBHARNESS_AGENT_BROWSER, cdpPort = DEFAULT_CDP_PORT, experiment = false,
  browserInterface = 'agent-browser-cli', browserMcpServer = 'xgrowth_browser', browserFastBackend = 'clearcote' }) {
  const experimentNote = experiment ? `
EXPERIMENT MODE (owner decision): @ham_zax is a test account. The owner has granted authority for governed sends that pass the bridge gates, with no human review before sending. Act on every worthwhile eligible opportunity, including long sequences of valuable replies; do not invent filler or treat measured virality as a required category. The bridge gates still apply.
` : '';
  return `You are the unattended growth operator for XGrowth in ${REPO}, account @ham_zax.
This is an OPERATIONAL growth session, not a software-engineering task. Goal: qualified developer/builder follower growth through purposeful replies, selective quotes and exceptional originals. Most worthwhile actions should be replies. A quiet timeline is normal. Never treat a scheduled wake as a reason to post.

Start:
- Use sessionId \`${sessionId}\` on every bridge call.
- ${executorBrowserLine({ browserTarget, browserInterface, browserMcpServer, browserFastBackend, agentBrowserCli, cdpPort, sessionId })}
- Observe the X tab first and confirm the account is @ham_zax. If the browser shows a login page or another account, do not log in and do not enter credentials. Begin the run with x_authenticated=false and browser_mutation=false, then stop and report the authentication blocker.
- Begin or resume with \`npm run --silent agent -- growth-run-begin\`, JSON on stdin: adapterType \`${runtime}_unattended\`, this sessionId, and capabilities for reasoning, browser_read, browser_mutation, x_authenticated and primary_source_web_research set truthfully. Set ceilings.maxPublicMutations=25 and ceilings.maxDurationMinutes=${maxDurationMinutes} for this bounded pass. This is an atomic per-run resource safety boundary, NOT a posting quota; further eligible work can continue in a subsequent run.
- Keep the \`runId\` from that result. Every \`act\` call needs both \`runId\` and \`sessionId\`. A fresh session MUST NOT call \`growth-run-status\` or \`growth-run-resume\` before it has a real runId; the recovery checklist below applies to existing runs only until \`growth-run-begin\` returns.
- Read the current product policy with \`npm run --silent agent -- growth-policy\`; it is the single owner-controlled source of truth for sleep hours, discovery, publication lanes, FOLLOW/LIKE permissions and conservative rolling daily safety ceilings, topical preferences, strictness, follower selectivity and learning. Read \`npm run --silent agent -- growth-analysis\` and consider verified performance recommendations only when enough measured samples exist. Read the existing writer persona as prescribed below: user persona/preferences always take precedence over generic growth copy.
- Read \`growth-run-next\`. If it recommends \`recover_attempt\` or names an unfinished publication attempt, stop and reconcile that attempt first: read the "Recover an unfinished publication" section of docs/GROWTH_AGENT_EXECUTION.md, decide only from live evidence, and never resend it.

${contextRecoveryPrompt()}

Loop:
- Track time from the begin call with \`date +%s%3N\`. Keep looping until about 3 minutes before the maxDurationMinutes budget ends.
- Each pass: run \`npm run --silent agent -- scout\` with JSON \`{"limit":50}\`. Read the entire \`pace\`, especially \`pace.activity.rest\`, \`pace.activity.fullDiscoveryIntervalMinutes\` and \`pace.activity.lastObservationAt\`, and all cards. This is a discovery batch, not a posting goal. The host probes every five minutes even if full feed collection is configured less frequently: during intermediate wakes, make only a short fresh breaking-news/urgent-source check rather than a full repetitive For You scan. Verified emergencies override the ordinary scan interval.
- Owner activity rhythm: observe the live configurable \`growth-policy.activity\` and \`scout.pace.activity\` values; NEVER use a hardcoded local sleep time. During rest, use read-only discovery and look only for independently observed explosive engagement or verified major AI launches/research breakthroughs. A genuinely verified urgent event may override ANY cadence or rest window immediately; no emergency may override source truth, account health, live authority, near-copy/duplicate fencing, or send reconciliation. Never pretend to be physically online or randomize/post mechanically to impersonate human habits.
- During waking hours, behave like a builder naturally using X: several purposeful replies can occur close together; a standalone post requires exceptional utility. There is no mandatory number, artificial cadence or fake presence. Follower growth is the goal, so prioritize qualified people discovering our useful replies and distinctive writing, not raw post counts. Use product follower-tier guidance to become modestly less selective about good standalone material as a REAL measured audience grows; never manufacture output.
- Substance over generic posts: show useful technical work, runnable code snippets, tiny experiments, new libraries/tools, implementation insight and concrete tradeoffs when they are genuinely interesting and verified. Breaking AI models and research deserve fast, clear explainers. A mix of code, tools, opinions and useful examples is better than endless AI-news summaries. Review the policy interests, and take the active persona and grounded facts seriously.
- Incorporate measured feedback: when \`growth-analysis\` contains at least its configured minimum comparable samples, preferentially explore strong evidenced styles without copying wording, overstating follower causality, or making weak causal claims. If analytics are stale/missing, do not infer winners; continue useful outreach.
- T0 \`check_mentions\` (always the first card): observe https://x.com/notifications/mentions and find new replies. During rest only inspect for exceptional urgent signals; normal mention replies wait until waking hours. For each worthwhile target, call \`act-target-status\` with exact targetTweetId (and candidateKey when saved); skip blocked/previously answered sources. Read its context before a natural, specific reply. A routine reply needs no editorial main-feed packet.
- Fresh discovery: \`scout\` only ranks saved candidates; it does not collect X. After checking mentions, read \`growth-run-next\` with this runId/sessionId. If it recommends \`collect_for_you\`, or scout has no T1 cards and collection is permitted, collect fresh posts before treating the pass as empty. Honor the returned observation/time ceilings and recovery blockers.
- Collection: open https://x.com/home in the Browser above and select For You. Browse successive fresh snapshots and scroll when useful to discover distinct substantive conversations; do not stop after one screen when worthwhile unseen sources remain. Respect run observation/time ceilings, observe real account/target identity and ingest several diverse organic posts with exact text, author, permalink and visible metrics. Do not script around the browser or repeatedly reload. If the feed is exhausted or irrelevant, use other permitted primary sources or conclude no worthwhile work; evaluate age and context rather than applying a hard hour cutoff.
- Immediately submit the observed posts through \`npm run --silent agent -- x-for-you-ingest\`, JSON on stdin: \`{"kind":"x_for_you","observedAt":<actual date +%s%3N>,"accountHandle":"ham_zax","adapterType":"${runtime}_unattended","runId":"<runId>","sessionId":"${sessionId}","browserTarget":"${browserTarget}","browserBackend":"chrome","sensorVersion":"x_for_you_v1","collectionStatus":"complete","posts":[{"tweetId":"<numeric ID>","url":"https://x.com/<author>/status/<ID>","username":"<author>","text":"<exact observed text>","rank":1,"metrics":{"views":<observed number>}}]}\`. Every post needs the matching ID/permalink pair, username, non-empty text and positive integer rank. Include only observed non-negative numeric views/likes/reposts/replies/bookmarks; omit unavailable metrics and timestamp (the bridge derives post time from tweetId). Mark ads \`promoted:true\`; never invent source text, IDs or metrics.
- Read ingestion diagnostics and engagement rejections, then rerun \`scout\` and evaluate the new cards. If collection or ingestion fails, report the exact capability blocker and finish; never report an unchanged cache as fresh discovery.
- T1 conversation cards (\`action=reply\` is default; \`eligibleActions\` also lists quote): call \`act-target-status\` with card.tweetId and candidateKey, then inspect the exact live post/conversation. Reply freely when you have a specific, valuable social or technical contribution; good conversation is the default. Choose a Quote only when your take merits independent visibility in followers' feeds and is distinct from a direct reply. The viralTier is telemetry, never a categorical requirement. \`card.urgent\` is an independently measured short-window acceleration signal: prioritize it right away, including at night, but still consider relevance and content value. For a Quote, send \`editorial\` with specific whyNow, distinctContribution, intendedAudience and verified sourceUrls. Record worthwhile skips via \`record-disposition\`. Continue across any number of distinct worthwhile sources, subject to per-run recovery/resource ceilings; never flood unrelated conversations.
- Independently consider accounts worth following and posts worth liking. During normal waking hours, after source collection, use \`npm run --silent agent -- social-discover\` with JSON \`{\"limit\":15}\`; suggestions are READ ONLY, and neither follow nor like is required by a pass. A follow needs a specific ongoing reason (several observed substantive posts in the niche, promising projects, tools, primary research, or community value), read the exact X profile plus at least two different posts by that author, and verify that the account is not already followed; follower count or one viral post is insufficient. A like needs one exact viewed post that you genuinely found thoughtful, useful, creative, or notable; replying is not a reason to like automatically. Don't like everything you read or require an action every run. Hard prohibition: NEVER automatically unfollow or suggest an unfollow for execution; only the owner handles unfollows manually.
- For a meaningful follow or like, first call \`social-status\` with JSON \`{\"action\":\"follow\"|\"like\",\"username\":\"<observed author>\",\"targetUrl\":\"https://x.com/<author>/status/<tweetId>\"}\` (targetUrl is required only for like). If blocked/already claimed/already followed, STOP for that target. If clear, call \`social-claim\` with action, username, exact like targetUrl (if applicable), runId, sessionId, observedAt (real Unix ms), reason (35+ chars), and evidenceUrls (follow: >=2 distinct ACTUALLY observed posts by this author; like: the one exact post). The bridge validates live delegation, active lease, account health, rest hours, conservative owner-configured 24-hour safety ceilings and per-target duplicate fences.
- After claim, browse the EXACT target/profile using the selected browser interface and take a fresh full observe. Confirm the current profile or tweet is the actual target and current control is exactly Follow or Like (not Following/Unlike). No ambiguous or mismatched controls may be clicked. Call \`social-start\` with the exact attemptId, runId, sessionId and evidence \`{\"targetUrl\":\"<claim targetUrl>\",\"observedAt\":<real ms>,\"controlName\":\"Follow\"|\"Like\",\"snapshot\":\"<specific current observed account/post/visible control proof>\"}\` BEFORE crossing the click boundary. Only then use ONE direct selected-browser click on the freshly observed exact-target control. This is the ONLY approved non-publication browser mutation. Afterward, re-observe; if the same target now shows Following (follow) or Unlike (like), call \`social-resolve\` with runId, sessionId, attemptId, state=confirmed and evidence containing the exact targetUrl, actual observedAt, afterControlName and snapshot. If the click may have fired but verification is inconclusive, resolve closed_unresolved; NEVER blindly click again. If no click was attempted, before social-start you may resolve confirmed_not_applied. These are small natural endorsements, NOT a metrics-chasing quota. Do not work around browser overlays or stale refs.
- T2 \`original\` is a rare editorial REVIEW card, not an instruction to produce a post. For a small follower account, the original must express a genuinely standalone novel insight/strong opinion/helpful firsthand learning with a verifiable primary source, clear why-now, clear audience value and a new angle beyond existing timeline content. Routine headline summaries, paraphrases, weak takes or invented experiences are not worth a post; prefer a reply or skip. Every Original or Quote must include a structured \`editorial\` object in \`act\` (see below) or the claim will be rejected before any send. No daily quantity cap. During rest, only a verified recent major release/breakthrough or independently recorded breakout may authorize an exceptional original; otherwise do not draft/publish one.
- A pass with no worthwhile T1/T2 cards and no new mentions counts as empty only after broad enough fresh live collection, successful ingestion and another scout read; inspect available cards rather than treating raw metrics, labels or elapsed time as action prohibitions. Never repeat the same cached scout result as a second discovery pass.

Calling act: JSON on stdin for Reply: \`{"action":"reply","runId":"<runId>","sessionId":"${sessionId}","targetTweetId":"<tweetId>","targetUrl":"<url>","candidateKey":"<candidateKey>","text":"<text>","card":{"author":"<author>","sourceText":"<exact observed source>"}}\`. For Quote, use action=quote and the same target fields; for Original, omit target fields. For EVERY Original or Quote, add \`"editorial":{"whyNow":"<specific substantive reason, 30+ chars>","distinctContribution":"<unique angle beyond source and existing timeline, 35+ chars>","intendedAudience":"<who specifically benefits, 16+ chars>","whyNotReply":"<why this deserves a standalone feed post instead of a reply, 28+ chars>","sourceUrls":["https://<actual verified primary source>"]}\`. If an official announcement or research breakthrough justifies emergency publication despite rest, ALSO add \`"urgency":{"kind":"verified_major_launch","verifiedAt":<actual date +%s%3N after live checking>,"whatChanged":"<specific verified event, 40+ chars>","whyImmediate":"<why reacting now is valuable, 35+ chars>}\` INSIDE editorial. Cite the actual original source; never mark old, speculative or unsourced material urgent. A fast-moving source already tracked in X ingest can independently qualify through its recorded measured like/reply acceleration without declaring an urgent tier. Only actual confirmed events qualify.

Act outcomes (the \`status\` field of the act result):
- \`confirmed_published\`: the post is live. Keep its \`outputUrl\` for the summary and continue.
- \`confirmed_not_sent\` or \`needs_rewrite\`: nothing was sent. Fix the named problem and retry that same card ONCE.
- \`closed_unresolved\`: the outcome is unknown. Never retry that target; keep its attempt ID for the summary and move on.
- An \`error\` result: if it names an attempt ID with an unknown outcome, treat it as closed_unresolved. Otherwise repair the named technical problem once. If the bridge says rest hours, insufficient editorial evidence or missing verified urgency, DO NOT retry blindly; wait for a genuine later opportunity or provide actual new verifiable evidence.

Writing:
- At most 280 characters. A quote's link counts as 25 characters, so quote text must be at most 255. The content must be additive to its exact observed source.
- Plain, specific, developer/builder voice. Reply to what was actually said; do not restate the source; no generic praise.
- An original must have its own angle; never near-copy an inspiration source.
- No hashtags. No emoji unless the source uses them. No links in replies.
- English unless the source is in another language; then answer in that language.
- Persona: before your first draft and after every context compaction, read the active persona with \`echo '{"consumer":"writer"}' | npm run --silent agent -- persona-model\`. Write every reply, quote and original as that persona (\`slice.identity\`, \`voiceCalibration\`, \`languageRealization\`, \`affectPolicy\`, \`behaviorExamples\`, \`dailyTone\`), not as a neutral assistant. It allows opinion, humor and pushback as well as questions; pick what fits each card. Wording detail: docs/POST_GENERATION_PROMPT.md (optional).

Stop:
- Stop only after the available distinct sources have been meaningfully explored and two separately observed, successfully ingested discovery passes yield no worthwhile opportunities or new mentions. If collection is forbidden by run ceilings, finish with that actual reason instead of inferring no worthwhile work.
- Also stop about 3 minutes before the time budget ends, or at a blocker (authentication, constrained account health, or a lease rejected by act).

Hard rules:
- Never set or fake human approval fields; never click dashboard approval or config controls; never start automation.js.
- Only the bridge \`act\` publishes. Do not call publication-attempt-send-start or browser-publish-claim yourself; act runs its own claim, send-start, one send and verification. For non-publishing Follow/Like, direct browser click is permitted ONLY after an active social-claim followed by social-start on the exact observed target; resolve the same ledger entry immediately afterward. Never follow/like without those fences; never unfollow.
- Never blindly retry an uncertain send. Never invent a publication, URL or outcome.
- Never print cookies, tokens or credentials. Never log in or enter credentials.
- Never wrap a bridge command in \`timeout\`, background it, or pipe it through a process that can end it early.
- Do not edit files, config, packages or environment; do not run git; no background daemons; no ad hoc shell, node or python scripts beyond \`date +%s%3N\` and the browser CLIs.

Finish:
- Call \`npm run --silent agent -- growth-run-finish\` with JSON \`{"runId":"<actual runId>","status":"completed","stopReason":"no_worthwhile_eligible_work","stopDetail":"No worthwhile eligible actions remain."}\` after a healthy empty pass. Supported stopReason values: ${GROWTH_RUN_STOP_REASONS.join(", ")}. If growth-run-next offers the permitted operation \`finish\`, prefer it to derive the reason. Never invent stop reasons: status and stopReason are different fields.
- Final response: published URLs (from \`outputUrl\`), skipped count, unresolved attempt IDs, and any blocker.
${experimentNote}`;
}

export function buildOperatorPrompt({ mode = 'executor', ...options }) {
  return mode === 'legacy' ? operatorPrompt(options) : executorPrompt(options);
}

export function operatorPrompt({ runtime, sessionId, maxDurationMinutes = 20, browserTarget = 'windows',
  agentBrowserCli = DEFAULT_WEBHARNESS_AGENT_BROWSER, cdpPort = DEFAULT_CDP_PORT, experiment = false,
  browserInterface = 'agent-browser-cli', browserMcpServer = 'xgrowth_browser', browserFastBackend = 'clearcote' }) {
  const browser = browserSection({ browserTarget, browserInterface, browserMcpServer, browserFastBackend, agentBrowserCli, cdpPort, sessionId });
  const experimentSection = experiment ? `
EXPERIMENT MODE (owner decision): @ham_zax is a test account and the owner is running an experiment to see 1-2 days of unattended results. The owner has granted full authority for every governed decision in this session: approve, review and send replies, quotes, reposts and originals that pass the bridge's own gates; no human will review before sending. Bias toward action, not silence:
- Each pass should act on as many worthwhile distinct opportunities as found, with no mandatory minimum or maximum per lane. Replies, quotes and originals are independent editorial choices; inspect sources for a meaningful contribution, and never create filler. Do not stop after a thin feed: re-collect, use the editorial plan, or advance eligible drafts and approved queue items.
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

${contextRecoveryPrompt()}

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
- Discovery serves worthwhile action: use fresh observations and further scrolling when it exposes distinct high-value conversations, within the actual run duration and observation ceilings; do not artificially stop after one screen. Ingest exact observed posts and move to selection. Do not repeatedly reload a broken feed or script around the browser. When collection fails, preserve usable observations; if none exist, report the capability blocker.
- Before scanning, read operator-status and growth-run-next. Execute any due eligible claim that the current run permits before collecting more. After ingest, use growth-next and growth-run-next to select a worthwhile Reply/Quote/Original/Repost and carry it through the canonical approval, claim, send, verification, and reconciliation gates. Finding an eligible opportunity is a reason to act, not to keep browsing for a larger sample.
- A second discovery pass is justified only after the ingested candidates have been evaluated and acted on or explicitly skipped/deferred. Never loop on an unchanged snapshot. If preparation returns action=needs_revision, its repair command/payload identifies the existing draft: obtain that fresh writer-packet, correct the named claims/voice/quality problems, apply output, request ready and mission-approve. A failed content review is not proof that no worthwhile work exists. Do not invoke prepare_main_feed again unchanged or reset to feed discovery to avoid revision. For other failures, report and repair the exact bridge blocker when authorized.
- Fresh observation does not mean a newly created post. Age and measured momentum are relative prioritization signals, not a blanket Reply expiry. Judge whether the conversation remains live; if it does not, consider a source-grounded Original/Quote through prepare_main_feed or a targeted Latest search in the Growth Focus. Respect an explicitly persisted expiry, when present. Persist search results with exact text/URL/provenance, never as a personalized For You observation.
- A stale persona-bound main-feed approval has a bridge repair path: update-draft with the persisted draft id and status=draft invalidates approval and reopens drafting; select current behavior/persona, obtain the current writer-packet, apply complete Writer output, request status=ready, then mission-approve only after current gates/provenance pass. Never call mission-approve directly on an approved row or demand owner intervention merely to re-review delegated work.
- Inspect complete bridge results without head/tail truncation or early-closing pipes. With npm output, use a file or npm's silent output and parse the relevant JSON fields after the bridge completes. In particular, retain ingestion engagement.rejections, next.claim, preparation.operationResult, and exact claim errors. A masked shell exit code is not a successful bridge operation.
- On a contract error, read the relevant recipe once and repair the exact missing prerequisite. Never cycle through guessed field/action names. If the documented repair fails, record the exact error and use another eligible candidate or finish with that blocker. Do not call writing-strategy-recommend repeatedly to repair mission-agent selection; it already computes current guidance itself.
- There is no desired number of posts or replies. Reply is the default; Original and Quote demand stronger standalone editorial value. Respect the currently configured owner rest window except independently measured explosive engagement or verified major launches/breakthroughs. Significant breaking events override sleep and ordinary schedule, never factual or duplicate-publication safeguards. If 20 distinct conversations merit replies while awake, work through all 20 subject to per-run capacity. Never create filler or mechanical cadence.
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
using adapterType \`${runtime}_unattended\`, sessionId \`${sessionId}\`, truthful capabilities for reasoning, browser_read, browser_mutation, x_authenticated, and primary_source_web_research, and \`ceilings.maxPublicMutations=25\`, \`ceilings.maxDurationMinutes=${maxDurationMinutes}\` for this bounded pass. The finite per-run ceiling protects lease/resource accounting, not daily frequency or per-lane quotas. The launcher may start another fresh reasoning session only after a clean resource-ceiling finish; this session must finish and exit at its ceiling. If authentication changes after begin, update the same run through \`growth-run-resume\` rather than abandoning it.

Then follow the run state rather than improvising a parallel workflow:
1. If recovery is requested, inspect the exact publication attempt and reconcile only from evidence. If useful recovery is exhausted, close unresolved rather than calling it not-sent.
2. If \`collect_for_you\` is requested, use the ${browser.session}. Verify the intended account is @ham_zax. Collect a bounded, diverse set of recent organic For You observations, stopping early when marginal value falls. Submit them through \`x-for-you-ingest\` with top-level observedAt (the actual observation time as a positive safe-integer Unix timestamp in milliseconds), accountHandle=ham_zax plus adapterType, sessionId, runId, browserTarget=${browserTarget}, browserBackend=chrome, sensorVersion, and collectionStatus. Each \`posts[]\` entry must match the bridge contract exactly: \`tweetId\` as a numeric string, \`url\` as the matching \`https://x.com/<username>/status/<tweetId>\` permalink, \`username\`, non-empty \`text\`, and a positive integer \`rank\`; set \`promoted=true\` for ads/promoted posts so they are skipped, and include \`metrics\` only as non-negative numeric views/likes/reposts/replies/bookmarks plus optional numeric \`timestamp\`. Never submit placeholder IDs, profile URLs, relative-time strings as timestamps, or post objects missing the permalink/ID pair.
3. Use \`growth-next\`, \`inspect\`, relationship/context commands, exact live-source inspection, owner-supplied evidence from \`docs/OWNER_PROFILE_EVIDENCE.md\`, and primary sources where claims are material. If \`growth-next\` returns an empty \`items\` array and \`growth-run-next\` permits \`collect_for_you\`, immediately refresh the For You observations and ingest them before deciding the run is dry; do not idle on an exhausted-but-still-fresh snapshot. Treat heuristic scores and the current Growth Focus taxonomy as advisory evidence, not cages. When your live judgment materially differs, call \`operator-priority-set\` with this runId/sessionId, a 0-100 score, a concrete reason, and the signals that changed your view (for example momentum, crowding, source quality, relationship value, current viral/style context, or Hamza fit). If a clearly durable developer/builder identity or community term is missing from Growth Focus, use \`growth-focus-expand\` under the active run to extend the relevant group (or add a justified Core/Adjacent group) with a concrete reason, then re-evaluate. Do not expand from random off-topic noise or promote explicit exclusion terms. The source itself need not be technical when the social act has a coherent builder-identity, relationship, community, or profile-discovery purpose. The active-run score becomes the execution priority while the heuristic remains visible for comparison. Do not act on a weak social paraphrase when verification matters.
4. Read \`persona-tone\`. If no daily preference is active, use observed candidate context to select a small tilt through \`persona-tone-set\`, with a concrete reason, stored candidate sourceReferences and influence no greater than 0.1. Never override an active owner preference or claim knowledge of Hamza's private mood. This is a wording preference only; it cannot change routing, truth, purpose, silence or authority. Supply purpose/behavior judgment through canonical bridge commands. Preserve Hamza's persona and the rule that not every useful social act needs a technical lesson.
5. Choose Reply, Quote, Repost, Original, thoughtful Like, selective Follow, or silence dynamically. Social likes/follows only use the separate social-claim → social-start → exact-browser-click-once → social-resolve workflow with observed proof; never invisible Likes or unfollows.
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
    } else if (config.claiveEngine === 'codex') {
      // The codex engine rejects --max-model-steps and --output-schema and needs no provider or session flag.
      // Yolo: claive's codex engine drops its Codex sandbox only when CLAIVE_CODEX_YOLO=1 is set for the child.
      args.push('--model', CLAIVE_CODEX_MODEL, '--reasoning-effort', 'max', '--web');
      return { executable: config.executable, args, env: {
        CLAIVE_CODEX_YOLO: '1',
        CLAIVE_CODEX_USE_USER_CONFIG: '1', // Keep Codex worker's browser skill discovery in CLI and typed-MCP mode.
      } };
    } else {
      args.push('--model', CLAIVE_MODEL, '--reasoning-effort', 'xhigh',
        '--max-model-steps', '100', '--web');
    }
    return { executable: config.executable, args };
  }
  if (config.runtime === 'muse') {
    // Direct Muse CLI: --yolo trusts this workspace and disables approval/sandbox so the
    // operator can reach the browser lane; the prompt's hard boundaries remain the guard.
    if (!promptFile) throw new Error('Muse requires a temporary operational prompt file.');
    return {
      executable: config.executable,
      args: ['exec', '--yolo', '--workspace', REPO, '--model', config.model || CLAIVE_MODEL,
        '--reasoning-effort', config.thinking === 'max' ? 'max' : 'xhigh',
        '--max-model-steps', '200', '--prompt-file', promptFile],
    };
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

// Bounded tail of child output kept for failure classification.
const OUTPUT_TAIL_BYTES = 16 * 1024;
// After the child exits, wait this long for piped output before settling, so a
// descendant that inherited the pipes cannot hold the runner open.
const OUTPUT_DRAIN_MS = 2_000;

// Kill the whole reasoning/browser subprocess group; never reconcile claims by guessing.
// Rejections carry exitCode (non-zero child exit), deadlineExpired (the runner's own kill)
// and outputTail (last OUTPUT_TAIL_BYTES of combined output) so the caller can classify
// the failure without parsing messages. Output is forwarded unchanged as it arrives.
export function runChild(command, { cwd = REPO, timeoutMs, killGraceMs = 5_000, stdout = process.stdout, stderr = process.stderr } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('A positive child deadline is required.');
  return new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd, env: { ...process.env, ...command.env, PATH: `${path.join(HOME, '.local/bin')}:${process.env.PATH || ''}` }, shell: false, detached: true,
      stdio: [command.stdinPrompt ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });
    let failure = null;
    let killTimer;
    let drainTimer;
    let exited = null;
    let settled = false;
    let tail = Buffer.alloc(0);
    const capture = (destination) => (chunk) => {
      destination.write(chunk);
      tail = Buffer.concat([tail, chunk]);
      if (tail.length > OUTPUT_TAIL_BYTES) tail = tail.subarray(tail.length - OUTPUT_TAIL_BYTES);
    };
    child.stdout.on('data', capture(stdout));
    child.stderr.on('data', capture(stderr));
    const killGroup = (signal) => {
      if (!child.pid) return;
      try { process.kill(-child.pid, signal); } catch (error) {
        if (error.code !== 'ESRCH') failure ||= error;
      }
    };
    const stop = (reason, { deadlineExpired = false } = {}) => {
      if (failure) return;
      failure = new Error(reason);
      failure.deadlineExpired = deadlineExpired;
      killGroup('SIGTERM');
      killTimer = setTimeout(() => killGroup('SIGKILL'), killGraceMs);
    };
    const onTerm = () => stop('Growth agent interrupted by SIGTERM.');
    const onInt = () => stop('Growth agent interrupted by SIGINT.');
    process.once('SIGTERM', onTerm);
    process.once('SIGINT', onInt);
    const timeout = setTimeout(() => stop('Growth agent runtime deadline expired.', { deadlineExpired: true }), timeoutMs);
    const release = () => {
      clearTimeout(timeout);
      clearTimeout(killTimer);
      clearTimeout(drainTimer);
      process.removeListener('SIGTERM', onTerm);
      process.removeListener('SIGINT', onInt);
    };
    const settle = (action) => {
      if (settled) return;
      settled = true;
      release();
      child.stdout.destroy();
      child.stderr.destroy();
      action();
    };
    const finish = () => {
      const outputTail = tail.toString('utf8');
      if (failure) {
        failure.outputTail = outputTail;
        reject(failure);
        return;
      }
      const { code = null, signal = null } = exited || {};
      if (code === 0) resolve({ code, signal: signal || null, outputTail });
      else {
        const error = new Error(`Growth agent runtime exited with code ${code}${signal ? ` (${signal})` : ''}.`);
        error.exitCode = code;
        error.outputTail = outputTail;
        reject(error);
      }
    };
    child.once('error', (error) => {
      killGroup('SIGKILL');
      settle(() => reject(error));
    });
    child.once('exit', (code, signal) => {
      exited = { code, signal };
      // A CLI may exit while browser/tool descendants remain alive.
      killGroup('SIGKILL');
      drainTimer = setTimeout(() => settle(finish), OUTPUT_DRAIN_MS);
    });
    child.once('close', () => settle(finish));
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

// Patterns are matched against the output tail that runChild captures from a failed child.
export const CHILD_FAILURE_PATTERNS = Object.freeze({
  rate_limited: /\b429\b|rate limit|quota|too many requests/i,
  provider_error: /\b5\d{2}\b|overloaded|ECONNRESET|ETIMEDOUT|socket hang up|provider[\s_-]*error/i,
});

// Precedence: a deadline kill is never a provider signal, and exit 0 is always ok.
export function classifyChildResult({ exitCode, deadlineExpired = false, tail = '' } = {}) {
  if (deadlineExpired) return 'deadline';
  if (exitCode === 0) return 'ok';
  if (CHILD_FAILURE_PATTERNS.rate_limited.test(tail)) return 'rate_limited';
  if (CHILD_FAILURE_PATTERNS.provider_error.test(tail)) return 'provider_error';
  return 'other';
}

// Claive can exit 0 while individual tool calls fail; retain the distinct
// operational signal without changing Growth Run completion or retry policy.
export function parseClaiveToolFailures(outputTail = '') {
  const matches = [...String(outputTail || '').matchAll(/Task failures reported:\s*(\d+)/g)];
  return matches.length ? Number(matches.at(-1)[1]) : 0;
}

export function backoffMinutes(consecutiveFailures) {
  if (!(consecutiveFailures >= 1)) return 0;
  return Math.min(2 ** consecutiveFailures, 30);
}

export function emptyBackoffState() {
  return { consecutiveFailures: 0, lastKind: null, lastAt: null, notBefore: null };
}

export function nextBackoffState(previous, kind, nowMs) {
  if (kind === 'ok') return { consecutiveFailures: 0, lastKind: 'ok', lastAt: nowMs, notBefore: null };
  if (kind === 'rate_limited' || kind === 'provider_error') {
    const consecutiveFailures = previous.consecutiveFailures + 1;
    return { consecutiveFailures, lastKind: kind, lastAt: nowMs,
      notBefore: nowMs + backoffMinutes(consecutiveFailures) * 60_000 };
  }
  // deadline and other are logged but neither extend nor reset the counter.
  return { ...previous, lastKind: kind, lastAt: nowMs };
}

// Missing, unreadable, or malformed state means no backoff.
export function readBackoffState(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    const consecutiveFailures = parsed?.consecutiveFailures;
    if (!Number.isInteger(consecutiveFailures) || consecutiveFailures < 0) return emptyBackoffState();
    return {
      consecutiveFailures,
      lastKind: typeof parsed.lastKind === 'string' ? parsed.lastKind : null,
      lastAt: Number.isFinite(parsed.lastAt) ? parsed.lastAt : null,
      notBefore: Number.isFinite(parsed.notBefore) ? parsed.notBefore : null,
    };
  } catch {
    return emptyBackoffState();
  }
}

export function writeBackoffState(file, state) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, file);
}

// Backoff must survive across invocations, so the default lives outside the repo.
// X_GROWTH_AGENT_BACKOFF_FILE overrides it; X_GROWTH_AGENT_BACKOFF=off disables the gate.
export function backoffStateFilePath(env = process.env) {
  if (env.X_GROWTH_AGENT_BACKOFF_FILE) return env.X_GROWTH_AGENT_BACKOFF_FILE;
  const stateHome = env.XDG_STATE_HOME || path.join(HOME, '.local/state');
  return path.join(stateHome, 'x_test', 'growth-runner-backoff.json');
}

export function backoffGateEnabled(env = process.env) {
  return String(env.X_GROWTH_AGENT_BACKOFF || '').trim().toLowerCase() !== 'off';
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
  let toolFailures = 0;
  record({ configured: true, enabled: true, lastInvocationAt: startedAt,
    nextInvocationAt: startedAt + SCHEDULER_INTERVAL_MS, lastError: null });
  const finish = (result, activeRunId = '') => {
    const outcome = { ...result, toolFailures, operationalStatus: toolFailures > 0 ? 'degraded' : (result.status === 'completed' ? 'clean' : result.status),
      windowMinutes: config.windowMinutes, startedAt,
      deadline, sessions };
    record({ lastInvocationResult: outcome, activeRunId });
    return outcome;
  };
  const env = overrides.env || process.env;
  const backoffEnabled = backoffGateEnabled(env);
  const backoffFile = overrides.backoffStateFile ?? backoffStateFilePath(env);
  if (backoffEnabled) {
    const { notBefore, lastKind } = readBackoffState(backoffFile);
    if (notBefore !== null && now() < notBefore) {
      return finish({ status: 'backoff', reason: 'child_failure_backoff', lastKind,
        notBefore, remainingMs: notBefore - now() });
    }
  }
  // Persisting backoff state must never mask the child outcome it describes.
  const persistChildKind = (kind) => {
    if (!backoffEnabled) return;
    try {
      writeBackoffState(backoffFile, nextBackoffState(readBackoffState(backoffFile), kind, now()));
    } catch (error) {
      console.error(`Growth agent backoff state not written: ${String(error?.message || error)}`);
    }
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
    const prompt = buildOperatorPrompt({ mode: config.agentMode, runtime: config.runtime, sessionId, maxDurationMinutes,
      browserTarget: config.browserTarget, browserInterface: config.browserInterface, browserMcpServer: config.browserMcpServer, browserFastBackend: config.browserFastBackend,
      agentBrowserCli: config.agentBrowserCli, cdpPort: config.cdpPort, experiment: config.experiment })
      + (continuationCheckpoint ? `\nCONTINUATION: Run ${continuationCheckpoint} ended its model turn without finishing and before creating any publication attempt. The launcher closed that run and released its lease. Begin a new run with this session ID and resume its saved queue work. Your previous final statement describing the next action did not execute it. Call the supported tool now; do not end with another progress-only statement. Re-observe before any mutation and use only this new run's canonical claim.\n` : '');
    continuationCheckpoint = '';
    let promptDirectory;
    const stopHeartbeatPump = deps.heartbeat(`${config.runtime}_unattended`, sessionId);
    try {
      let promptFile;
      if (config.runtime === 'claive' || config.runtime === 'muse') {
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
        try {
          const childResult = await deps.child(command, {
            timeoutMs: Math.min(deadline - now(), (maxDurationMinutes + 2) * 60_000),
            killGraceMs: config.runtime === 'claive' ? 15_000 : 5_000,
          });
          if (config.runtime === 'claive') toolFailures += parseClaiveToolFailures(childResult?.outputTail);
        } catch (childError) {
          // Rethrown unchanged: the catch below closes the run or rethrows.
          // A failed child is never relaunched within this invocation.
          persistChildKind(classifyChildResult({
            exitCode: childError?.exitCode,
            deadlineExpired: childError?.deadlineExpired,
            tail: childError?.outputTail,
          }));
          throw childError;
        }
        persistChildKind('ok');
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
${contextRecoveryPrompt()}
Your previous progress sentence ended the model turn without executing the described action. Call the next supported tool now, or finish through growth-run-finish with a concrete blocker.
${attempts.length ? 'First inspect the existing publication-attempts for this run.' : 'The launcher verified that this run has no publication attempts. Execute the pending operation from your previous turn now (for example x-for-you-ingest with the already observed posts), or execute the currently permitted growth-run-next operation. Apart from required context recovery, do not repeat queue/status/discovery inspection before completing that pending operation.'} ${uncertain
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
