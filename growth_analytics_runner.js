// Independent read-only evidence collection assistant. Unlike Growth Run, this
// agent cannot claim a publication and never inherits a growth run lease.
// It observes authenticated X Analytics and writes through analytics-record.
import 'dotenv/config';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { leaseAgentBrowserTab } from './ops/agent_browser_session.js';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const stateDir = path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local/state'), 'x_test');
const statusFile = path.join(stateDir, 'analytics-collector.json');
const now = Date.now();
const state = JSON.parse(await readFile(statusFile,'utf8').catch(()=>'{}'));
if (Number(state.lastStartedAt) > now-21*3_600_000) {
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
await checkpoint({lastStartedAt:now,status:'running'});
const promptDir = await mkdtemp(path.join(os.tmpdir(),'xgrowth-analytics-'));
let browserTabLease;
try {
  // A read-only analytics session still creates a Chrome page. Allocate and
  // later reclaim its exact tab; never close the owner's shared browser.
  const sessionId = `analytics-${randomUUID()}`;
  const browserCli = process.env.X_GROWTH_AGENT_BROWSER_CLI || path.join(os.homedir(),'.local/bin/agent-browser');
  const cdpPort = process.env.X_GROWTH_BROWSER_CDP_PORT || '9222';
  browserTabLease = await leaseAgentBrowserTab({ cli:browserCli, cdpPort, sessionId });
  const template = await readFile(path.join(repo,'ops','analytics_collector_prompt.md'),'utf8');
  const promptFile = path.join(promptDir,'operator.md');
  await writeFile(promptFile,`${template}\nCollection begins at ${new Date(now).toISOString()} (UTC).\nUse ONLY the existing authenticated Chrome on CDP ${cdpPort} with ${browserCli} --cdp ${cdpPort} --session ${sessionId} --pin-tab <command>. This job owns exact tab ${browserTabLease.targetId}. First navigate that OWN tab to https://x.com/ham_zax and verify authentication. Do not switch to another tab or create new tabs. The launcher closes ONLY this exact job-owned tab when done; never close shared Chrome.\n`,{mode:0o600});
  const bin = process.env.X_GROWTH_CLAIVE_BIN || path.join(os.homedir(),'.local/bin/claive');
  if (!existsSync(bin)) throw new Error('Claive binary not found');
  const args = ['run','--workspace',repo,'--prompt-file',promptFile,
    '--label','XGrowth daily analytics collector','--engine','codex',
    '--model','gpt-6-luna','--reasoning-effort','high','--web'];
  const child=spawn(bin,args,{cwd:repo,stdio:'inherit',env:{...process.env,
    CLAIVE_CODEX_YOLO:'1',CLAIVE_CODEX_USE_USER_CONFIG:'1'},});
  const code=await new Promise((resolve,reject)=>{ child.on('error',reject);child.on('close',(exit)=>resolve(exit)); });
  await checkpoint({lastStartedAt:now,status:code===0?'completed':'failed',exitCode:code});
  if (code!==0) process.exitCode=1;
} catch (error) {
  await checkpoint({lastStartedAt:now,status:'failed',error:String(error?.message||error)});
  console.error('Analytics collector failed:',error?.message||error);
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
