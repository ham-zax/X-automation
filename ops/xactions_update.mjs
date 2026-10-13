#!/usr/bin/env node
// Keeps the XActions read client current without trusting an untested commit.
// Fetches upstream, runs the read-only smoke test against the new checkout and
// promotes it only on a pass. A failed candidate leaves the pinned checkout alone.
// Uses no model. Usage: node ops/xactions_update.mjs [ref-or-commit]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { smokeTestXReads, xactionsHome } from '../x_reads.js';

const HOME = xactionsHome();
const REPO_URL = process.env.X_GROWTH_XACTIONS_REPO || 'https://github.com/nirholas/XActions.git';
const REF = process.argv[2] || process.env.X_GROWTH_XACTIONS_REF || 'main';
const AUTO_PROMOTE = process.env.X_GROWTH_XACTIONS_AUTO_PROMOTE !== 'false';
const GIT_DIR = path.join(HOME, 'repo.git');
const RELEASES = path.join(HOME, 'releases');
const CURRENT = path.join(HOME, 'current');
const STATUS = path.join(HOME, 'status.json');

const git = (...args) => execFileSync('git', ['--git-dir', GIT_DIR, ...args], { encoding: 'utf8', timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const readStatus = () => { try { return JSON.parse(fs.readFileSync(STATUS, 'utf8')); } catch { return {}; } };
const currentCommit = () => { try { return path.basename(fs.realpathSync(CURRENT)); } catch { return null; } };
const failed = (smoke) => smoke.checks.filter((check) => !check.ok).map((check) => `${check.name}: ${check.error}`).join('; ');

function fetchCandidate() {
  fs.mkdirSync(RELEASES, { recursive: true });
  if (!fs.existsSync(GIT_DIR)) execFileSync('git', ['init', '-q', '--bare', GIT_DIR]);
  git('fetch', '-q', '--depth', '1', REPO_URL, REF);
  return { commit: git('rev-parse', 'FETCH_HEAD'), commitDate: git('log', '-1', '--format=%cI', 'FETCH_HEAD') };
}

function exportRelease(commit) {
  const dir = path.join(RELEASES, commit);
  if (fs.existsSync(dir)) return dir;
  const tmp = `${dir}.tmp`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp);
  const archive = execFileSync('git', ['--git-dir', GIT_DIR, 'archive', commit, 'src', 'package.json'], { maxBuffer: 256 * 1024 * 1024, timeout: 180_000 });
  execFileSync('tar', ['-x', '-C', tmp], { input: archive });
  fs.renameSync(tmp, dir);
  return dir;
}

function promote(commit) {
  const link = `${CURRENT}.next`;
  fs.rmSync(link, { force: true });
  fs.symlinkSync(path.join('releases', commit), link);
  fs.renameSync(link, CURRENT);
}

function prune(keep) {
  for (const name of fs.readdirSync(RELEASES)) {
    if (!keep.includes(name)) fs.rmSync(path.join(RELEASES, name), { recursive: true, force: true });
  }
}

const previous = readStatus();
const status = { ...previous, checkedAt: new Date().toISOString(), repo: REPO_URL, ref: REF, candidate: null };
const pinned = currentCommit();
let candidate = null;
try {
  candidate = fetchCandidate();
} catch (error) {
  status.fetchError = String(error?.stderr || error?.message || error).trim().slice(0, 300);
}
if (candidate) delete status.fetchError;

if (candidate && candidate.commit !== pinned) {
  const smoke = await smokeTestXReads({ dir: exportRelease(candidate.commit) });
  if (smoke.ok && AUTO_PROMOTE) {
    promote(candidate.commit);
    Object.assign(status, { healthy: true, reason: null, pinnedCommit: candidate.commit, pinnedCommitDate: candidate.commitDate,
      pinnedAt: status.checkedAt, previousCommit: pinned, checks: smoke.checks });
  } else {
    status.candidate = { commit: candidate.commit.slice(0, 7), commitDate: candidate.commitDate,
      result: smoke.ok ? 'passed, waiting for manual promotion' : `failed: ${failed(smoke)}` };
  }
}

// When nothing was promoted, the pinned checkout (or the installed package) is still what serves reads.
if (status.pinnedAt !== status.checkedAt) {
  const smoke = await smokeTestXReads();
  Object.assign(status, { healthy: smoke.ok, reason: smoke.ok ? null : failed(smoke), pinnedCommit: pinned, checks: smoke.checks });
}

prune([status.pinnedCommit, status.previousCommit].filter(Boolean));
fs.writeFileSync(`${STATUS}.tmp`, `${JSON.stringify(status, null, 2)}\n`);
fs.renameSync(`${STATUS}.tmp`, STATUS);
console.log(JSON.stringify(status));
process.exit(status.healthy ? 0 : 1);
