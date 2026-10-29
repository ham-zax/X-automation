// Independent read-only evidence collection assistant. Unlike Growth Run, this
// agent cannot claim a publication and never inherits a growth run lease.
// It observes authenticated X Analytics and writes through analytics-record.
import 'dotenv/config';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { leaseAgentBrowserTab } from './ops/agent_browser_session.js';
import { mkdtemp, writeFile, readFile, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const stateDir = path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local/state'), 'x_test');
const statusFile = path.join(stateDir, 'analytics-collector.json');
const now = Date.now();
const state = JSON.parse(await readFile(statusFile,'utf8').catch(()=>'{}'));
// Explicit failures may recover at the next timer after one hour. Successful,
// running and legacy checkpoints keep the conservative 21-hour interval.
const cooldownMs = (state.status === 'failed' ? 1 : 21) * 3_600_000;
if (Number(state.lastStartedAt) > now-cooldownMs) {
  console.log('Analytics collector skipped: recently attempted; no duplicate collection.');
  process.exit(0);
}
// Avoid competing over one live authenticated X browser session. The
// scheduled worker retries on its next timer when Growth Luna is idle.
let active = false;
try { active = Number(execFileSync('systemctl',['--user','show','-P','MainPID','x-test-growth-agent.service'],{encoding:'utf8'}).trim()) > 0; }
catch { active = true; }
if (active) {
  console.log('Analytics collector skipped: Growth Luna owns browser.');
  process.exit(0);
}
await mkdir(stateDir,{recursive:true,mode:0o700});
async function checkpoint(next) {
  const temp=`${statusFile}.${process.pid}.tmp`;
  await writeFile(temp,JSON.stringify({...next, updatedAt:Date.now()},null,2),{mode:0o600});
  const {rename} = await import('node:fs/promises'); await rename(temp,statusFile);
}
const RESULT_LIMIT_BYTES = 16 * 1024;
const RESULT_FIELDS = ['schemaVersion','sessionId','outcome','recordedPosts','reason'];
const COLLECTION_OUTCOMES = new Set(['collected','zero_with_access','blocked']);
const boundedError = value => String(value?.message || value || 'unknown error').trim().slice(0,500);
function outcomeError(message) { return new Error(`Analytics collection outcome invalid: ${message}`); }
// A reason is untrusted child text. Reject obvious credential material so it
// never reaches the checkpoint or journal through the failure error.
function reasonLooksCredentialBearing(reason) {
  return /(?:cookie|authorization)\s*[:=]\s*(?:bearer|basic|digest)?\s*[a-z0-9._~+/=-]{16,}/i.test(reason)
    || /\bbearer\s+[a-z0-9._~+/=-]{16,}/i.test(reason)
    || /(?:password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)\s*[:=]\s*[a-z0-9._~+/=-]{8,}/i.test(reason);
}
// The child reports one private outcome. This is metadata, not a database audit.
async function readCollectionOutcome(file, sessionId) {
  let info;
  try { info = await stat(file); } catch { throw outcomeError('file is missing.'); }
  if (!info.isFile()) throw outcomeError('file is missing.');
  if (info.size > RESULT_LIMIT_BYTES) throw outcomeError('file is larger than 16 KiB.');
  let parsed;
  try { parsed = JSON.parse(await readFile(file,'utf8')); }
  catch { throw outcomeError('file is not valid JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw outcomeError('top level must be an object.');
  if (Object.keys(parsed).length !== RESULT_FIELDS.length || !RESULT_FIELDS.every(key => Object.hasOwn(parsed,key))) {
    throw outcomeError('exact fields are required.');
  }
  if (parsed.schemaVersion !== 1) throw outcomeError('schemaVersion must be 1.');
  if (parsed.sessionId !== sessionId) throw outcomeError('sessionId does not match this invocation.');
  if (!COLLECTION_OUTCOMES.has(parsed.outcome)) throw outcomeError('outcome is not supported.');
  if (!Number.isSafeInteger(parsed.recordedPosts) || parsed.recordedPosts < 0) throw outcomeError('recordedPosts must be a nonnegative safe integer.');
  const { reason } = parsed;
  if (typeof reason !== 'string' || reason !== reason.trim() || !reason || reason.length > 500) {
    throw outcomeError('reason must be trimmed text of 1 to 500 characters.');
  }
  if (/[\u0000-\u001f\u007f]/.test(reason)) throw outcomeError('reason must not contain control characters.');
  if (reasonLooksCredentialBearing(reason)) throw outcomeError('reason must not contain credentials.');
  if (parsed.outcome === 'collected' && parsed.recordedPosts < 1) throw outcomeError('collected requires at least one recorded post.');
  if (parsed.outcome === 'zero_with_access' && parsed.recordedPosts !== 0) throw outcomeError('zero_with_access requires zero recorded posts.');
  return { outcome: parsed.outcome, recordedPosts: parsed.recordedPosts, reason };
}
await checkpoint({lastStartedAt:now,status:'running'});
const promptDir = await mkdtemp(path.join(os.tmpdir(),'xgrowth-analytics-'));
let browserTabLease;
try {
  // A read-only analytics session still creates a Chrome page. Allocate and
  // later reclaim its exact tab; never close the owner's shared browser.
  const sessionId = `analytics-${randomUUID()}`;
  const resultFile = path.join(promptDir,'result.json');
  const browserCli = process.env.X_GROWTH_AGENT_BROWSER_CLI || path.join(os.homedir(),'.local/bin/agent-browser');
  const cdpPort = process.env.X_GROWTH_BROWSER_CDP_PORT || '9222';
  browserTabLease = await leaseAgentBrowserTab({ cli:browserCli, cdpPort, sessionId });
  const template = await readFile(path.join(repo,'ops','analytics_collector_prompt.md'),'utf8');
  const promptFile = path.join(promptDir,'operator.md');
  await writeFile(promptFile,`${template}\nCollection begins at ${new Date(now).toISOString()} (UTC).\nUse ONLY the existing authenticated Chrome on CDP ${cdpPort} with ${browserCli} --cdp ${cdpPort} --session ${sessionId} --pin-tab <command>. This job owns exact tab ${browserTabLease.targetId}. First navigate that OWN tab to https://x.com/ham_zax and verify authentication. Do not switch to another tab or create new tabs. The launcher closes ONLY this exact job-owned tab when done; never close shared Chrome.\nPrivate outcome values for this invocation, as JSON literals:\nX_GROWTH_ANALYTICS_SESSION_ID=${JSON.stringify(sessionId)}\nX_GROWTH_ANALYTICS_RESULT_FILE=${JSON.stringify(resultFile)}\nUse exactly these values. This private file is the only additional file you may write; write it before every normal completion.\n`,{mode:0o600});
  const bin = process.env.X_GROWTH_CLAIVE_BIN || path.join(os.homedir(),'.local/bin/claive');
  if (!existsSync(bin)) throw new Error('Claive binary not found');
  const args = ['run','--workspace',repo,'--prompt-file',promptFile,
    '--label','XGrowth daily analytics collector','--engine','codex',
    '--model','gpt-6-luna','--reasoning-effort','max','--web'];
  const child=spawn(bin,args,{cwd:repo,stdio:'inherit',env:{...process.env,
    CLAIVE_CODEX_YOLO:'1',CLAIVE_CODEX_USE_USER_CONFIG:'1',
    X_GROWTH_ANALYTICS_RESULT_FILE:resultFile,X_GROWTH_ANALYTICS_SESSION_ID:sessionId},});
  const code=await new Promise((resolve,reject)=>{ child.on('error',reject);child.on('close',(exit)=>resolve(exit)); });
  if (code!==0) {
    // Preserve a valid receipt as reported metadata while the process failure
    // remains decisive. A malformed receipt still contributes no metadata.
    const outcome = await readCollectionOutcome(resultFile,sessionId).catch(() => null);
    const error = `Analytics collection child exited with code ${code}.`;
    await checkpoint({lastStartedAt:now,status:'failed',exitCode:code,
      collectionOutcome:outcome?.outcome ?? null,recordedPosts:outcome?.recordedPosts ?? null,
      collectionReason:outcome?.reason ?? null,error});
    console.error('Analytics collector failed:',error);
    process.exitCode=1;
  } else {
    let outcome;
    try {
      outcome = await readCollectionOutcome(resultFile,sessionId);
    } catch (error) {
      const message = boundedError(error);
      await checkpoint({lastStartedAt:now,status:'failed',exitCode:code,collectionOutcome:null,recordedPosts:null,collectionReason:null,error:message});
      console.error('Analytics collector failed:',message);
      process.exitCode=1;
    }
    if (outcome) {
      const collectionOutcome = outcome.outcome;
      const { recordedPosts, reason: collectionReason } = outcome;
      if (outcome.outcome === 'blocked') {
        const error = boundedError(`Analytics collection blocked: ${outcome.reason}`);
        await checkpoint({lastStartedAt:now,status:'failed',exitCode:code,collectionOutcome,recordedPosts,collectionReason,error});
        console.error('Analytics collector failed:',error);
        process.exitCode=1;
      } else {
        await checkpoint({lastStartedAt:now,status:'completed',exitCode:code,collectionOutcome,recordedPosts,collectionReason});
      }
    }
  }
} catch (error) {
  const message = boundedError(error);
  await checkpoint({lastStartedAt:now,status:'failed',exitCode:null,collectionOutcome:null,recordedPosts:null,collectionReason:null,error:message});
  console.error('Analytics collector failed:',message);
  process.exitCode=1;
} finally {
  if (browserTabLease) {
    const cleanup = await browserTabLease.release().catch(error => ({
      cleaned:false,warnings:[String(error?.message||error)],
    }));
    console.log(`Analytics browser tab cleanup: ${JSON.stringify(cleanup)}`);
  }
  await rm(promptDir,{recursive:true,force:true});
}
