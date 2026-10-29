// XR-13: a fetched upstream revision must not execute with account credentials
// until the owner approves its exact full commit. These cases run the real updater
// against a disposable local Git fixture and a fake upstream Scraper. The fixture
// modules append canary lines, so an import or call outside approval is visible.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { mkdtemp, mkdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const updater = path.join(repo, 'ops', 'xactions_update.mjs');
const scratch = await mkdtemp(path.join(os.tmpdir(), 'xgrowth-xr13-'));
const gitHome = path.join(scratch, 'git-home');
const gitConfig = path.join(scratch, 'gitconfig');
await mkdir(gitHome);
await writeFile(gitConfig, '');
after(async () => { await rm(scratch, { recursive: true, force: true }); });

const AUTH_TOKEN = 'xr13-dummy-auth-token';
const PIN_LOG_ENV = 'XR13_PIN_LOG';
const CANDIDATE_LOG_ENV = 'XR13_CANDIDATE_LOG';
const COMMIT_DATE = '2026-10-01T00:00:00+00:00';
const PACKAGE_JSON = `${JSON.stringify({ name: 'xactions-fixture', version: '1.0.0', type: 'module' }, null, 2)}\n`;
const PINNED_AT = '2026-10-27T00:00:00.000Z';

const gitEnv = {
  PATH: process.env.PATH,
  HOME: gitHome,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: gitConfig,
  GIT_AUTHOR_NAME: 'Growth XR-13 Fixture',
  GIT_AUTHOR_EMAIL: 'xr13-fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Growth XR-13 Fixture',
  GIT_COMMITTER_EMAIL: 'xr13-fixture@example.invalid',
  GIT_AUTHOR_DATE: COMMIT_DATE,
  GIT_COMMITTER_DATE: COMMIT_DATE,
};

function git(cwd, ...args) {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 30_000, env: gitEnv });
  assert.equal(run.error, undefined, `git ${args.join(' ')}: ${String(run.error)}`);
  assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
  return run.stdout.trim();
}

// Fake upstream client: six smoke reads run locally, and every step appends a
// canary line to the scenario log named in the fixture module.
function scraperSource({ logEnv, failing = false }) {
  return `import fs from 'node:fs';

const logFile = process.env.${logEnv};
const log = (line) => { if (logFile) fs.appendFileSync(logFile, \`\${line}\\n\`); };
log('import');
const POST = Object.freeze({
  id: '1900000000000000001',
  username: 'ham_zax',
  text: 'XR-13 disposable fixture post',
  inReplyToStatusId: null,
  conversationId: '1900000000000000001',
  timeParsed: new Date('${COMMIT_DATE}'),
  likes: 1,
  replies: 0,
  retweets: 0,
  views: 10,
});

export class Scraper {
  constructor(options) { log('construct'); this.options = options; }
  async setCookies(cookies) { log(\`cookies:\${cookies.map((cookie) => cookie.name).join(',')}\`); }
  async *searchTweets(query) {
    log(\`search:\${query}\`);
    if (${failing}) return;
    yield POST;
  }
  async getTweet(id) { log(\`post:\${id}\`); return { ...POST, id }; }
}
`;
}

async function writeRelease(dir, source) {
  await mkdir(path.join(dir, 'src', 'client'), { recursive: true });
  await writeFile(path.join(dir, 'package.json'), PACKAGE_JSON);
  await writeFile(path.join(dir, 'src', 'client', 'index.js'), source);
}

// One disposable upstream repo (pin commit, then candidate commit), one disposable
// XActions home with a working pinned fake release, and one scratch cwd without a
// .env file.
async function prepareScenario(name, { failingCandidate = false, missingSrc = false } = {}) {
  const base = path.join(scratch, name);
  const source = path.join(base, 'upstream');
  const home = path.join(base, 'xactions');
  const work = path.join(base, 'work');
  const pinLog = path.join(base, 'pin.log');
  const candidateLog = path.join(base, 'candidate.log');
  await mkdir(source, { recursive: true });
  await mkdir(work, { recursive: true });

  await writeRelease(source, scraperSource({ logEnv: PIN_LOG_ENV }));
  git(source, 'init', '-q', '-b', 'main');
  git(source, 'add', '-A');
  git(source, 'commit', '-q', '-m', 'fixture pin');
  const pinSha = git(source, 'rev-parse', 'HEAD');

  if (missingSrc) await rm(path.join(source, 'src'), { recursive: true, force: true });
  else await writeRelease(source, scraperSource({ logEnv: CANDIDATE_LOG_ENV, failing: failingCandidate }));
  git(source, 'add', '-A');
  git(source, 'commit', '-q', '-m', 'fixture candidate');
  const candidateSha = git(source, 'rev-parse', 'HEAD');

  await writeRelease(path.join(home, 'releases', pinSha), scraperSource({ logEnv: PIN_LOG_ENV }));
  await symlink(path.join('releases', pinSha), path.join(home, 'current'));
  await writeFile(path.join(home, 'status.json'), `${JSON.stringify({
    checkedAt: PINNED_AT,
    repo: `file://${source}`,
    ref: 'main',
    candidate: null,
    healthy: true,
    reason: null,
    pinnedCommit: pinSha,
    pinnedCommitDate: COMMIT_DATE,
    pinnedAt: PINNED_AT,
    previousCommit: null,
    checks: [],
  }, null, 2)}\n`);

  return { base, source, home, work, pinLog, candidateLog, pinSha, candidateSha };
}

function runUpdater(scenario, extraEnv = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: gitHome,
    AUTH_TOKEN,
    X_ACCOUNT: 'ham_zax',
    [PIN_LOG_ENV]: scenario.pinLog,
    [CANDIDATE_LOG_ENV]: scenario.candidateLog,
    X_GROWTH_XACTIONS_HOME: scenario.home,
    X_GROWTH_XACTIONS_REPO: `file://${scenario.source}`,
    ...extraEnv,
  };
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
  return spawnSync(process.execPath, [updater], {
    cwd: scenario.work, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024, env,
  });
}

const readStatus = async (home) => JSON.parse(await readFile(path.join(home, 'status.json'), 'utf8'));
const readLog = async (file) => { try { return await readFile(file, 'utf8'); } catch { return null; } };
const pinLink = (home) => readlink(path.join(home, 'current'));

function assertPinUntouched(status, scenario) {
  assert.equal(status.pinnedCommit, scenario.pinSha);
  assert.equal(status.pinnedCommitDate, COMMIT_DATE);
  assert.equal(status.healthy, true, status.reason);
  assert.equal(status.checks.length, 6);
  assert.ok(status.checks.every((check) => check.ok));
}

test('an unapproved candidate never executes and the pin stays healthy', async () => {
  const scenario = await prepareScenario('unapproved');
  const run = runUpdater(scenario);

  assert.equal(run.error, undefined);
  assert.equal(run.status, 0, run.stderr);
  const status = await readStatus(scenario.home);
  assertPinUntouched(status, scenario);
  assert.equal(await pinLink(scenario.home), path.join('releases', scenario.pinSha));
  assert.equal(await readLog(scenario.candidateLog), null, 'unapproved candidate code must not import');
  assert.equal(fs.existsSync(path.join(scenario.home, 'releases', scenario.candidateSha)), false, 'unapproved candidate must not export');
  assert.match(await readLog(scenario.pinLog), /cookies:auth_token/);

  assert.equal(status.approvedCommit, null);
  assert.equal(status.candidate.commit, scenario.candidateSha);
  assert.match(status.candidate.commit, /^[0-9a-f]{40}$/);
  assert.equal(status.candidate.commitDate, COMMIT_DATE);
  assert.match(status.candidate.result, /awaiting owner review/i);
  assert.match(status.candidate.result, /not approved/i);
  assert.match(status.candidate.result, /no smoke test ran/i);
  assert.doesNotMatch(status.candidate.result, /passed/i);
  assert.match(run.stdout, new RegExp(scenario.candidateSha));
});

test('a different approved commit does not authorize the candidate', async () => {
  const scenario = await prepareScenario('mismatch');
  const run = runUpdater(scenario, { X_GROWTH_XACTIONS_APPROVED_COMMIT: scenario.pinSha });

  assert.equal(run.status, 0, run.stderr);
  const status = await readStatus(scenario.home);
  assertPinUntouched(status, scenario);
  assert.equal(await pinLink(scenario.home), path.join('releases', scenario.pinSha));
  assert.equal(await readLog(scenario.candidateLog), null);
  assert.equal(fs.existsSync(path.join(scenario.home, 'releases', scenario.candidateSha)), false);
  assert.equal(status.approvedCommit, scenario.pinSha);
  assert.equal(status.candidate.commit, scenario.candidateSha);
  assert.match(status.candidate.result, /awaiting owner review/i);
});

test('a malformed approval stops before fetch or smoke execution', async () => {
  const scenario = await prepareScenario('malformed');
  const before = await readFile(path.join(scenario.home, 'status.json'), 'utf8');
  for (const value of ['abc123', scenario.candidateSha.slice(0, 39), 'g'.repeat(40), `${scenario.candidateSha}0`]) {
    const run = runUpdater(scenario, { X_GROWTH_XACTIONS_APPROVED_COMMIT: value });
    assert.equal(run.status, 2, `${value}: ${run.stderr}`);
    assert.match(run.stderr, /X_GROWTH_XACTIONS_APPROVED_COMMIT/);
    assert.match(run.stderr, /40-character/);
    assert.equal(fs.existsSync(path.join(scenario.home, 'repo.git')), false, 'no fetch may start');
    assert.equal(await readLog(scenario.pinLog), null, 'no pin smoke may run');
    assert.equal(await readLog(scenario.candidateLog), null);
    assert.equal(await readFile(path.join(scenario.home, 'status.json'), 'utf8'), before);
    assert.deepEqual(fs.readdirSync(path.join(scenario.home, 'releases')), [scenario.pinSha]);
  }
});

test('the exact approved commit is trusted, smoke-tested and promoted', async () => {
  const scenario = await prepareScenario('approved');
  const run = runUpdater(scenario, { X_GROWTH_XACTIONS_APPROVED_COMMIT: scenario.candidateSha.toUpperCase() });

  assert.equal(run.status, 0, run.stderr);
  const candidateLog = await readLog(scenario.candidateLog);
  assert.match(candidateLog, /import/);
  assert.match(candidateLog, /construct/);
  assert.match(candidateLog, /cookies:auth_token/);
  assert.match(candidateLog, /search:from:ham_zax filter:replies/);
  assert.match(candidateLog, new RegExp(`post:1900000000000000001`));
  assert.equal(candidateLog.includes(AUTH_TOKEN), false, 'the fixture must not see the token value');

  const status = await readStatus(scenario.home);
  assert.equal(status.healthy, true);
  assert.equal(status.reason, null);
  assert.equal(status.pinnedCommit, scenario.candidateSha);
  assert.equal(status.pinnedCommitDate, COMMIT_DATE);
  assert.equal(status.previousCommit, scenario.pinSha);
  assert.equal(status.candidate, null);
  assert.equal(status.approvedCommit, scenario.candidateSha);
  assert.deepEqual(status.checks.map((check) => check.name), ['load', 'own-replies', 'mentions', 'search', 'post', 'thread']);
  assert.ok(status.checks.every((check) => check.ok));
  assert.equal(await pinLink(scenario.home), path.join('releases', scenario.candidateSha));
  assert.equal(fs.existsSync(path.join(scenario.home, 'releases', scenario.candidateSha, 'src', 'client', 'index.js')), true);
  assert.equal(fs.existsSync(path.join(scenario.home, 'releases', scenario.pinSha)), true);
});

test('a failed smoke test on the approved commit keeps the pin', async () => {
  const scenario = await prepareScenario('smoke-failure', { failingCandidate: true });
  const run = runUpdater(scenario, { X_GROWTH_XACTIONS_APPROVED_COMMIT: scenario.candidateSha });

  assert.equal(run.status, 0, run.stderr);
  const candidateLog = await readLog(scenario.candidateLog);
  assert.match(candidateLog, /import/);
  assert.match(candidateLog, /cookies:auth_token/);
  assert.equal(await pinLink(scenario.home), path.join('releases', scenario.pinSha));
  const status = await readStatus(scenario.home);
  assertPinUntouched(status, scenario);
  assert.equal(status.previousCommit, null);
  assert.equal(status.candidate.commit, scenario.candidateSha);
  assert.match(status.candidate.result, /^failed: own-replies:/);
  assert.match(await readLog(scenario.pinLog), /cookies:auth_token/);
});

test('an approved candidate that cannot export reports the failure and keeps the pin', async () => {
  const scenario = await prepareScenario('export-failure', { missingSrc: true });
  const archive = spawnSync('git', ['archive', scenario.candidateSha, 'src', 'package.json'], {
    cwd: scenario.source, encoding: 'utf8', timeout: 30_000, env: gitEnv,
  });
  assert.equal(archive.error, undefined);
  assert.notEqual(archive.status, 0);
  assert.match(archive.stderr, /pathspec 'src' did not match any files/);
  const run = runUpdater(scenario, { X_GROWTH_XACTIONS_APPROVED_COMMIT: scenario.candidateSha });

  assert.equal(run.error, undefined);
  assert.equal(run.status, 0, run.stderr);
  // Missing src cannot host an import canary. Exact export failure and the
  // pin-only checks below establish this path. Keep these guards if src returns.
  const candidateLog = await readLog(scenario.candidateLog);
  assert.equal(candidateLog, null, 'the missing-src fixture has no candidate canary');
  assert.doesNotMatch(candidateLog ?? '', /cookies:/, 'a candidate without src must not receive cookies');

  const statusText = await readFile(path.join(scenario.home, 'status.json'), 'utf8');
  const status = JSON.parse(statusText);
  assertPinUntouched(status, scenario);
  assert.equal(status.previousCommit, null);
  assert.equal(status.pinnedAt, PINNED_AT);
  assert.notEqual(status.checkedAt, PINNED_AT);
  assert.match(status.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(status.approvedCommit, scenario.candidateSha);
  assert.equal(status.candidate.commit, scenario.candidateSha);
  assert.equal(status.candidate.commitDate, COMMIT_DATE);
  assert.equal(status.candidate.result, 'failed: export: unable to export approved candidate');

  assert.equal(await pinLink(scenario.home), path.join('releases', scenario.pinSha));
  assert.deepEqual(fs.readdirSync(path.join(scenario.home, 'releases')), [scenario.pinSha]);
  assert.equal(fs.existsSync(path.join(scenario.home, 'releases', scenario.candidateSha)), false);
  assert.equal(fs.existsSync(path.join(scenario.home, 'releases', `${scenario.candidateSha}.tmp`)), false);

  const pinLog = await readLog(scenario.pinLog);
  assert.match(pinLog, /import/);
  assert.match(pinLog, /cookies:auth_token/);
  assert.equal(run.stdout.includes(AUTH_TOKEN), false);
  assert.equal(run.stderr.includes(AUTH_TOKEN), false);
  assert.equal(statusText.includes(AUTH_TOKEN), false);
});

test('AUTO_PROMOTE=false keeps the pin after an approved pass', async () => {
  const scenario = await prepareScenario('no-auto-promote');
  const run = runUpdater(scenario, {
    X_GROWTH_XACTIONS_APPROVED_COMMIT: scenario.candidateSha,
    X_GROWTH_XACTIONS_AUTO_PROMOTE: 'false',
  });

  assert.equal(run.status, 0, run.stderr);
  const candidateLog = await readLog(scenario.candidateLog);
  assert.match(candidateLog, /import/);
  assert.match(candidateLog, /cookies:auth_token/);
  assert.match(candidateLog, /search:javascript min_faves:100 lang:en/);
  assert.equal(await pinLink(scenario.home), path.join('releases', scenario.pinSha));
  const status = await readStatus(scenario.home);
  assertPinUntouched(status, scenario);
  assert.equal(status.candidate.commit, scenario.candidateSha);
  assert.match(status.candidate.result, /approved and passed/);
  assert.match(status.candidate.result, /AUTO_PROMOTE=false/);
});
