#!/usr/bin/env node
// Keeps the XActions read client current without trusting an untested commit.
// Fetching a candidate is only for review: its code never runs with account
// credentials until the owner approves that exact full commit in
// X_GROWTH_XACTIONS_APPROVED_COMMIT. Approval allows the read-only smoke test;
// promotion then needs that pass and AUTO_PROMOTE. A smoke pass is only a
// compatibility check, never a trust decision. An unapproved or failed candidate
// leaves the pinned checkout alone. Uses no model.
// Usage: node ops/xactions_update.mjs [ref-or-commit]
// Exit codes: 0 healthy pin, 1 unhealthy pin, 2 invalid approval configuration.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { smokeTestXReads, xactionsHome } from '../x_reads.js';

const HOME = xactionsHome();
const REPO_URL = process.env.X_GROWTH_XACTIONS_REPO || 'https://github.com/nirholas/XActions.git';
const REF = process.argv[2] || process.env.X_GROWTH_XACTIONS_REF || 'main';
const AUTO_PROMOTE = process.env.X_GROWTH_XACTIONS_AUTO_PROMOTE !== 'false';
const APPROVAL_ENV = 'X_GROWTH_XACTIONS_APPROVED_COMMIT';
const COMMIT_PATTERN = /^[0-9a-f]{40}$/i;
const GIT_DIR = path.join(HOME, 'repo.git');
const RELEASES = path.join(HOME, 'releases');
const CURRENT = path.join(HOME, 'current');
const STATUS = path.join(HOME, 'status.json');

const git = (...args) => execFileSync('git', ['--git-dir', GIT_DIR, ...args], { encoding: 'utf8', timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const readStatus = () => { try { return JSON.parse(fs.readFileSync(STATUS, 'utf8')); } catch { return {}; } };
const currentCommit = () => { try { return path.basename(fs.realpathSync(CURRENT)); } catch { return null; } };
const failed = (smoke) => smoke.checks.filter((check) => !check.ok).map((check) => `${check.name}: ${check.error}`).join('; ');

// Trust approval is a full commit, configured by the owner after review. A missing
// value is the safe default: no candidate may execute. Only malformed non-empty
// values are configuration errors, and they stop the run before any fetch.
function readApprovedCommit() {
  const value = String(process.env[APPROVAL_ENV] ?? '').trim();
  if (!value) return null;
  if (!COMMIT_PATTERN.test(value)) {
    throw new Error(`${APPROVAL_ENV} must be a full 40-character Git commit SHA-1 in hex. Set it to the exact reviewed commit, or unset it. The run stopped before any fetch or smoke test.`);
  }
  return value.toLowerCase();
}

let APPROVED = null;
try {
  APPROVED = readApprovedCommit();
} catch (error) {
  console.error(`xactions update: ${error.message}`);
  process.exit(2);
}

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
const status = { ...previous, checkedAt: new Date().toISOString(), repo: REPO_URL, ref: REF, candidate: null, approvedCommit: APPROVED };
const pinned = currentCommit();
let candidate = null;
try {
  candidate = fetchCandidate();
} catch (error) {
  status.fetchError = String(error?.stderr || error?.message || error).trim().slice(0, 300);
}
if (candidate) delete status.fetchError;

if (candidate && candidate.commit !== pinned) {
  if (candidate.commit !== APPROVED) {
    // No approval means no export, import, constructor, cookies, calls or promotion.
    // The result must not imply that the candidate was tested.
    status.candidate = { commit: candidate.commit, commitDate: candidate.commitDate,
      result: `awaiting owner review: this exact commit is not approved, so no smoke test ran and nothing was promoted. After review, set ${APPROVAL_ENV} to this full commit to allow the smoke test.` };
  } else {
    // Export failure is reported separately, before any candidate smoke. The text
    // stays fixed and bounded: a Git archive error can contain local paths. The
    // pinned checkout still serves reads, so the pin check below still runs.
    let release = null;
    try {
      release = exportRelease(candidate.commit);
    } catch {
      status.candidate = { commit: candidate.commit, commitDate: candidate.commitDate,
        result: 'failed: export: unable to export approved candidate' };
    }
    if (release) {
      const smoke = await smokeTestXReads({ dir: release });
      if (smoke.ok && AUTO_PROMOTE) {
        promote(candidate.commit);
        Object.assign(status, { healthy: true, reason: null, pinnedCommit: candidate.commit, pinnedCommitDate: candidate.commitDate,
          pinnedAt: status.checkedAt, previousCommit: pinned, checks: smoke.checks });
      } else {
        status.candidate = { commit: candidate.commit, commitDate: candidate.commitDate,
          result: smoke.ok ? 'approved and passed; not promoted because X_GROWTH_XACTIONS_AUTO_PROMOTE=false' : `failed: ${failed(smoke)}` };
      }
    }
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
