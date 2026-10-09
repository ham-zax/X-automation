// Real legacy-schema migration, using a disposable SQLite database only.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';

const oldCwd=process.cwd();
const scratch=mkdtempSync(path.join(os.tmpdir(),'xgrowth-social-migrate-'));
process.chdir(scratch);
after(()=>{process.chdir(oldCwd);rmSync(scratch,{recursive:true,force:true});});
const store=await import('../store.js');
const db=new DatabaseSync(store.DB_FILE);
db.exec(`CREATE TABLE social_action_attempts (
  attempt_id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK(action IN ('follow','like')),
  target_key TEXT NOT NULL,
  target_url TEXT NOT NULL,
  run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('claimed','mutation_started','confirmed','confirmed_not_applied','closed_unresolved')),
  reason TEXT NOT NULL,
  context_json TEXT NOT NULL,
  pre_evidence_json TEXT,
  post_evidence_json TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  UNIQUE(action,target_key)
);
CREATE INDEX idx_social_action_time ON social_action_attempts(action,created_at);`);
db.prepare(`INSERT INTO social_action_attempts
  (attempt_id,action,target_key,target_url,run_id,session_id,state,reason,context_json,created_at)
  VALUES (?,'follow',?,?,?,'old-session','closed_unresolved',?,'{}',?)`)
  .run('legacy-unresolved-001','samplebuilder','https://x.com/samplebuilder',
    'run-legacy','Potential browser mutation was never fully verified',Date.now());
db.close();

const social=await import('../social_engagement.js');
test('old unresolved Follow action is preserved through schema migration',()=>{
  const prior=social.socialStatus({action:'follow',username:'samplebuilder'});
  assert.equal(prior.canClaim,false);
  assert.equal(prior.existing?.attemptId,'legacy-unresolved-001');
  assert.equal(prior.existing?.state,'closed_unresolved');
  assert.match(prior.existing?.reason,/never fully verified/);
});
test('migrated schema accepts Repost action and intermediate menu state',()=>{
  const updated=new DatabaseSync(store.DB_FILE);
  const sql=updated.prepare("SELECT sql FROM sqlite_master WHERE name='social_action_attempts'").get()?.sql || '';
  assert.ok(sql.includes("'repost'"));
  assert.ok(sql.includes("'repost_confirmation_started'"));
  const cols=updated.prepare('PRAGMA table_info(social_action_attempts)').all().map(x=>x.name);
  assert.ok(cols.includes('repost_menu_evidence_json'));
  const next=social.socialStatus({action:'repost',username:'samplebuilder',
    targetUrl:'https://x.com/samplebuilder/status/2108319632490693104'});
  assert.equal(next.canClaim,true);
  const rows=updated.prepare('SELECT COUNT(*) n FROM social_action_attempts').get();
  assert.equal(rows.n,1);
  updated.close();
});
