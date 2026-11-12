#!/usr/bin/env node
// Keeps the XActions read client current without trusting an untested commit.
// Fetching a candidate is only for review: its code never runs with account
// credentials until the owner approves that exact full commit in
// X_GROWTH_XACTIONS_APPROVED_COMMIT, or until X_GROWTH_XACTIONS_TRUST_POLICY is
// verified_client and the exported client passes the static gate in
// verifyClientRelease. Approval allows the read-only smoke test; promotion then
// needs that pass and AUTO_PROMOTE. A smoke pass is only a compatibility check,
// never a trust decision. An unapproved or failed candidate leaves the pinned
// checkout alone. Uses no model.
// Usage: node ops/xactions_update.mjs [ref-or-commit]
// Exit codes: 0 healthy pin, 1 unhealthy pin, 2 invalid approval or trust configuration.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { smokeTestXReads, xactionsHome } from '../x_reads.js';

const HOME = xactionsHome();
const REPO_URL = process.env.X_GROWTH_XACTIONS_REPO || 'https://github.com/nirholas/XActions.git';
const REF = process.argv[2] || process.env.X_GROWTH_XACTIONS_REF || 'main';
const AUTO_PROMOTE = process.env.X_GROWTH_XACTIONS_AUTO_PROMOTE !== 'false';
const APPROVAL_ENV = 'X_GROWTH_XACTIONS_APPROVED_COMMIT';
const TRUST_POLICY_ENV = 'X_GROWTH_XACTIONS_TRUST_POLICY';
const TRUST_POLICIES = new Set(['manual', 'verified_client']);
const COMMIT_PATTERN = /^[0-9a-f]{40}$/i;
const GIT_DIR = path.join(HOME, 'repo.git');
const RELEASES = path.join(HOME, 'releases');
const CURRENT = path.join(HOME, 'current');
const STATUS = path.join(HOME, 'status.json');

// The verified_client gate: a read client may only reach these modules, may only
// read these environment variables, and may not reach a process, socket or eval.
const ALLOWED_CLIENT_MODULES = new Set(['node:fs', 'node:fs/promises', 'node:path', 'node:os', 'node:crypto',
  'node:url', 'node:util', 'node:buffer', 'undici', 'cheerio']);
const ALLOWED_ENV_NAME = /^(?:XACTIONS_[A-Z0-9_]+|NODE_ENV|VITEST|DEBUG)$/;
const FORBIDDEN_CLIENT_PATTERNS = [
  [/\beval\s*\(/, 'eval('],
  [/\bnew\s+Function\b/, 'new Function'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/process\.dlopen/, 'process.dlopen'],
  [/createRequire/, 'createRequire'],
  [/child_process/, 'child_process'],
];
const REGEX_PRECEDERS = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>']);
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else', 'yield', 'await']);

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

// manual keeps the owner-approval-only path. verified_client additionally allows an
// unapproved candidate to reach the static gate, which runs before any import.
function readTrustPolicy() {
  const value = String(process.env[TRUST_POLICY_ENV] ?? '').trim();
  if (!value) return 'manual';
  if (!TRUST_POLICIES.has(value)) {
    throw new Error(`${TRUST_POLICY_ENV} must be manual or verified_client. Set it to verified_client to allow the static client gate, or unset it for owner approval only. The run stopped before any fetch or smoke test.`);
  }
  return value;
}

let APPROVED = null;
let TRUST_POLICY = 'manual';
try {
  APPROVED = readApprovedCommit();
  TRUST_POLICY = readTrustPolicy();
} catch (error) {
  console.error(`xactions update: ${error.message}`);
  process.exit(2);
}

// Comments are removed before scanning so a comment can never hide or fake code.
// String, template and regex literals are copied verbatim, so a quote or a `//`
// inside one cannot desynchronise the scan.
function stripComments(source) {
  let out = '';
  let index = 0;
  let lastSignificant = '';
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 2;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      out += char;
      index += 1;
      while (index < source.length) {
        const inner = source[index];
        if (inner === '\\') { out += inner + (source[index + 1] ?? ''); index += 2; continue; }
        out += inner;
        index += 1;
        if (inner === char) break;
      }
      lastSignificant = char;
      continue;
    }
    const trailingWord = char === '/' ? /([A-Za-z_$][\w$]*)\s*$/.exec(out)?.[1] : null;
    if (char === '/' && (REGEX_PRECEDERS.has(lastSignificant) || REGEX_KEYWORDS.has(trailingWord))) {
      out += char;
      index += 1;
      let inClass = false;
      while (index < source.length) {
        const inner = source[index];
        if (inner === '\\') { out += inner + (source[index + 1] ?? ''); index += 2; continue; }
        out += inner;
        index += 1;
        if (inner === '[') inClass = true;
        else if (inner === ']') inClass = false;
        else if (inner === '/' && !inClass) break;
      }
      while (index < source.length && /[a-z]/i.test(source[index])) { out += source[index]; index += 1; }
      // A regex literal is an expression, so a following `/` is division, not a new regex.
      lastSignificant = ')';
      continue;
    }
    out += char;
    if (!/\s/.test(char)) lastSignificant = char;
    index += 1;
  }
  return out;
}

function relativeLabel(root, file) {
  const rel = path.relative(root, file);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : path.basename(file);
}

// Every component of the walked path must be a real entry: a symlinked directory
// would let a release read a file that is not part of the exported commit.
function assertNoSymlinkComponents(root, file) {
  const rel = path.relative(root, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`${path.basename(file)} is outside the release`);
  let current = root;
  for (const part of rel.split(path.sep)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      throw new Error(`${relativeLabel(root, current)} is missing`);
    }
    if (stat.isSymbolicLink()) throw new Error(`${relativeLabel(root, current)} is a symlink`);
  }
}

function moduleSpecifiers(text, label) {
  const specifiers = [];
  for (const match of text.matchAll(/\bimport\s+(?:[^'"();]*?\bfrom\s*)?(['"])([^'"\n]+)\1/g)) specifiers.push(match[2]);
  for (const match of text.matchAll(/\bexport\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*(['"])([^'"\n]+)\1/g)) specifiers.push(match[2]);
  for (const match of text.matchAll(/\bimport\s*\(\s*/g)) {
    const literal = /^(['"])([^'"\n]*)\1/.exec(text.slice(match.index + match[0].length));
    if (!literal) throw new Error(`${label} uses a dynamic import without a plain string literal`);
    specifiers.push(literal[2]);
  }
  return specifiers;
}

function scanClientSource(text, label) {
  for (const [pattern, name] of FORBIDDEN_CLIENT_PATTERNS) {
    if (pattern.test(text)) throw new Error(`${label} uses forbidden ${name}`);
  }
  for (const match of text.matchAll(/\bprocess\s*\.\s*env\s*\[\s*([^\]]*)\]/g)) {
    const literal = /^(['"])([^'"]*)\1$/.exec(match[1].trim());
    if (!literal) throw new Error(`${label} reads process.env with a computed key`);
    if (!ALLOWED_ENV_NAME.test(literal[2])) throw new Error(`${label} reads disallowed environment variable ${literal[2]}`);
  }
  for (const match of text.matchAll(/\bprocess\s*\.\s*env\s*\.\s*([A-Za-z_$][\w$]*)/g)) {
    if (!ALLOWED_ENV_NAME.test(match[1])) throw new Error(`${label} reads disallowed environment variable ${match[1]}`);
  }
}

// Static gate for an unapproved candidate under verified_client. It runs on the
// exported files only, before any import, constructor, cookie or read, so a
// rejected client never executes. Throws with a bounded, relative-path message.
function verifyClientRelease(releaseDir) {
  const root = path.resolve(releaseDir);
  const srcRoot = path.join(root, 'src');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch {
    throw new Error('package.json is missing or unreadable');
  }
  if (pkg?.type !== 'module') throw new Error('package.json must declare "type": "module"');
  const pending = [path.join(srcRoot, 'client', 'index.js')];
  const seen = new Set();
  while (pending.length) {
    const file = pending.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    assertNoSymlinkComponents(root, file);
    if (!fs.lstatSync(file).isFile()) throw new Error(`${relativeLabel(root, file)} is not a regular file`);
    const label = relativeLabel(root, file);
    const text = stripComments(fs.readFileSync(file, 'utf8'));
    scanClientSource(text, label);
    for (const specifier of moduleSpecifiers(text, label)) {
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        const resolved = path.resolve(path.dirname(file), specifier);
        if (!resolved.startsWith(`${srcRoot}${path.sep}`)) throw new Error(`${label} imports outside src: ${specifier}`);
        pending.push(resolved);
      } else if (specifier.startsWith('/') || specifier.startsWith('file:')) {
        throw new Error(`${label} imports an absolute path: ${specifier}`);
      } else if (!ALLOWED_CLIENT_MODULES.has(specifier)) {
        throw new Error(`${label} imports a disallowed module: ${specifier}`);
      }
    }
  }
  return { files: seen.size };
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
  if (candidate.commit !== APPROVED && TRUST_POLICY !== 'verified_client') {
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
      let verified = true;
      if (TRUST_POLICY === 'verified_client' && candidate.commit !== APPROVED) {
        try {
          verifyClientRelease(release);
        } catch (error) {
          verified = false;
          // The unpromoted export is removed so a rejected client cannot be imported later.
          fs.rmSync(release, { recursive: true, force: true });
          status.candidate = { commit: candidate.commit, commitDate: candidate.commitDate,
            result: `failed: verify: ${String(error?.message || error).slice(0, 300)}` };
        }
      }
      if (verified) {
        const smoke = await smokeTestXReads({ dir: release });
        if (smoke.ok && AUTO_PROMOTE) {
          promote(candidate.commit);
          Object.assign(status, { healthy: true, reason: null, pinnedCommit: candidate.commit, pinnedCommitDate: candidate.commitDate,
            pinnedAt: status.checkedAt, previousCommit: pinned, checks: smoke.checks, trustPolicy: TRUST_POLICY });
        } else {
          status.candidate = { commit: candidate.commit, commitDate: candidate.commitDate,
            result: smoke.ok ? 'approved and passed; not promoted because X_GROWTH_XACTIONS_AUTO_PROMOTE=false' : `failed: ${failed(smoke)}` };
        }
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
