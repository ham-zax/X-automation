import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBackup, verifyBackup, restoreBackup } from '../ops/backup.mjs';

test('online SQLite backup preserves WAL data, media and secrets and refuses destructive restore', async () => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'x-backup-'));
  const source = path.join(scratch, 'source'), archive = path.join(scratch, 'backup'), restored = path.join(scratch, 'restored');
  await mkdir(source);
  const db = new DatabaseSync(path.join(source, '.x-research.sqlite'));
  try {
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE example (value TEXT); INSERT INTO example VALUES (\'durable\')');
    await mkdir(path.join(source, '.x-media'));
    await writeFile(path.join(source, '.x-media/image.png'), 'image');
    await writeFile(path.join(source, '.env'), 'AUTO_POST=false');
    const secrets = path.join(scratch, 'secrets.json');
    await writeFile(secrets, '{"key":"scratch-only"}');
    await createBackup(source, archive, secrets);
    assert.equal((await stat(archive)).mode & 0o777, 0o700);
    assert.equal((await stat(path.join(archive, '.env'))).mode & 0o777, 0o600);
    await restoreBackup(archive, restored);
    const recovered = new DatabaseSync(path.join(restored, '.x-research.sqlite'), { readOnly: true });
    try { assert.equal(recovered.prepare('SELECT value FROM example').get().value, 'durable'); } finally { recovered.close(); }
    assert.equal(await readFile(path.join(restored, '.x-media/image.png'), 'utf8'), 'image');
    assert.equal(await readFile(path.join(restored, '.secrets/ai-secrets.json'), 'utf8'), '{"key":"scratch-only"}');
    await assert.rejects(restoreBackup(archive, restored), { code: 'EEXIST' });
    await assert.rejects(createBackup(source, path.join(source, 'backup'), secrets), /outside/);
    await writeFile(path.join(archive, '.env'), 'tampered');
    await assert.rejects(verifyBackup(archive), /Checksum/);
    await writeFile(path.join(archive, '.env'), 'AUTO_POST=false');
    const manifestPath = path.join(archive, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.files[0].path = '../escape';
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(verifyBackup(archive), /Unsafe/);
  } finally { db.close(); await rm(scratch, { recursive: true, force: true }); }
});

test('backup refuses symlinked media', async () => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'x-backup-link-'));
  const source = path.join(scratch, 'source');
  await mkdir(source);
  const db = new DatabaseSync(path.join(source, '.x-research.sqlite'));
  db.exec('CREATE TABLE example (value TEXT)'); db.close();
  try {
    await symlink(scratch, path.join(source, '.x-media'));
    await assert.rejects(createBackup(source, path.join(scratch, 'backup'), null), /media directory/);
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
