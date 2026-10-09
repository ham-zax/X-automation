// Relationship lookup contract tests run only against a disposable SQLite DB.
// They never contact X, attach to Chrome, or open the production store.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previousCwd = process.cwd();
const scratch = mkdtempSync(path.join(tmpdir(), 'xgrowth-relationship-context-'));
process.chdir(scratch);
const store = await import('../store.js');
const db = new DatabaseSync(store.DB_FILE);

after(() => {
  db.close();
  process.chdir(previousCwd);
  rmSync(scratch, { recursive: true, force: true });
});

function counts() {
  return {
    profiles: db.prepare('SELECT count(*) AS n FROM relationship_profiles').get().n,
    events: db.prepare('SELECT count(*) AS n FROM relationship_events').get().n,
  };
}

function bridge(command, input) {
  return spawnSync(process.execPath, [path.join(repo, 'agent_bridge.js'), command], {
    cwd: scratch,
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, X_ACCOUNT: 'ham_zax' },
  });
}

test('unknown author is an ordinary not_tracked result, normalized before @ stripping', () => {
  const initial = counts();
  const result = store.readRelationshipContext('  @Never_Seen  ');
  assert.deepEqual(result, {
    username: 'never_seen', tracked: false, status: 'not_tracked',
    profile: null, events: [],
  });
  const cli = bridge('relationship-context', { username: ' @Never_Seen ', limit: 20 });
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout), result);
  assert.deepEqual(counts(), initial, 'unknown lookup must not insert records');
});

test('known profile with events is retrieved without refreshing or changing stored rows', () => {
  store.recordRelationshipEvent({
    username: 'some_builder', eventType: 'observed_relevant_post',
    occurredAt: 1791571000000,
    metadata: { meaningful: true },
  });
  const before = {
    counts: counts(),
    row: db.prepare('SELECT * FROM relationship_profiles WHERE username = ?').get('some_builder'),
    events: db.prepare('SELECT * FROM relationship_events WHERE username = ?').all('some_builder'),
  };
  const result = store.readRelationshipContext(' @SOME_BUILDER ');
  assert.equal(result.username, 'some_builder');
  assert.equal(result.tracked, true);
  assert.equal(result.status, 'tracked');
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].eventType, 'observed_relevant_post');
  const cli = bridge('relationship-context', { username: ' @Some_Builder ', limit: 1 });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).profile.username, 'some_builder');
  assert.deepEqual(counts(), before.counts);
  assert.deepEqual(db.prepare('SELECT * FROM relationship_profiles WHERE username = ?').get('some_builder'), before.row);
  assert.deepEqual(db.prepare('SELECT * FROM relationship_events WHERE username = ?').all('some_builder'), before.events);
});

test('invalid handle, limit and JSON reject rather than masquerading as not_tracked', () => {
  const before = counts();
  for (const username of ['bad space', 'not-valid', 'a'.repeat(16), '@', '', 5, null]) {
    assert.throws(() => store.readRelationshipContext(username), /relationship-context/);
    const result = bridge('relationship-context', { username });
    assert.equal(result.status, 1, `username: ${String(username)}`);
    assert.match(result.stderr, /relationship-context/);
  }
  for (const limit of [0, -1, 201, 2.5, '3', null]) {
    const result = bridge('relationship-context', { username: 'newuser', limit });
    assert.equal(result.status, 1, `limit: ${String(limit)}`);
    assert.match(result.stderr, /relationship-context limit/);
  }
  const malformed = bridge('relationship-context', '{"username":');
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /error/);
  assert.deepEqual(counts(), before);
});

test('legacy strict relationship-inspect remains an error for missing profiles', () => {
  const result = bridge('relationship-inspect', { username: 'never_seen' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Relationship profile not found: never_seen/);
});

test('cold bridge CLI can be blocked by SQLite writer lock despite SELECT-only lookup', () => {
  const lockDb = new DatabaseSync(store.DB_FILE);
  lockDb.exec('BEGIN IMMEDIATE');
  try {
    const result = bridge('relationship-context', { username: 'never_seen' });
    assert.equal(result.status, 1, `unexpected success: ${result.stdout}`);
    assert.match(result.stderr, /database is locked|SQLITE_BUSY/i);
    assert.equal(result.error, undefined, 'the subprocess should complete within its timeout');
  } finally {
    lockDb.exec('ROLLBACK');
    lockDb.close();
  }
});
