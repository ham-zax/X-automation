#!/usr/bin/env node
import { backup, DatabaseSync } from 'node:sqlite';
import { chmod, copyFile, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const stateFiles = ['.env', '.x-web-owner-password', '.automation-state.json', '.interesting-posts.json'];
const allowed = name => name === '.x-research.sqlite' || stateFiles.includes(name) || name === '.secrets/ai-secrets.json' || (name.startsWith('.x-media/') && name.length > 9);
const safe = name => typeof name === 'string' && !path.isAbsolute(name) && !name.split('/').some(p => !p || p === '.' || p === '..') && !name.includes('\\') && allowed(name);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function present(file) {
  try { return await lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function emptyDirectory(directory) {
  await mkdir(directory, { mode: 0o700 }); // Refuse any pre-existing destination, including an empty directory.
  await chmod(directory, 0o700);
}
async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlink refused: ${name}`);
    if (entry.isDirectory()) result.push(...await files(path.join(directory, entry.name), name + '/'));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`Non-regular file refused: ${name}`);
  }
  return result;
}
async function integrity(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const result = db.prepare('PRAGMA integrity_check').all();
    if (result.length !== 1 || Object.values(result[0])[0] !== 'ok') throw new Error('SQLite integrity check failed');
  } finally { db.close(); }
}
async function copyPrivate(from, to) {
  const info = await lstat(from);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Regular file required: ${from}`);
  await mkdir(path.dirname(to), { recursive: true, mode: 0o700 });
  await copyFile(from, to);
  await chmod(to, 0o600);
}
export async function createBackup(source, destination, secretsFile) {
  source = path.resolve(source); destination = path.resolve(destination);
  if (destination === source || destination.startsWith(source + path.sep)) throw new Error('Backup must be outside the source directory');
  const dbFile = path.join(source, '.x-research.sqlite');
  const info = await lstat(dbFile);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Regular SQLite file required');
  await emptyDirectory(destination);
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try { await backup(db, path.join(destination, '.x-research.sqlite')); } finally { db.close(); }
  const snapshot = new DatabaseSync(path.join(destination, '.x-research.sqlite'));
  try { snapshot.exec('PRAGMA journal_mode=DELETE'); } finally { snapshot.close(); }
  await chmod(path.join(destination, '.x-research.sqlite'), 0o600);
  await integrity(path.join(destination, '.x-research.sqlite'));
  for (const name of stateFiles) if (await present(path.join(source, name))) await copyPrivate(path.join(source, name), path.join(destination, name));
  const media = path.join(source, '.x-media');
  if (await present(media)) {
    if (!(await lstat(media)).isDirectory() || (await lstat(media)).isSymbolicLink()) throw new Error('Regular media directory required');
    for (const name of await files(media)) await copyPrivate(path.join(media, name), path.join(destination, '.x-media', name));
  }
  if (secretsFile && await present(secretsFile)) await copyPrivate(secretsFile, path.join(destination, '.secrets/ai-secrets.json'));
  const entries = [];
  for (const name of await files(destination)) {
    const bytes = await readFile(path.join(destination, name));
    entries.push({ path: name, size: bytes.length, sha256: digest(bytes) });
  }
  await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), files: entries }, null, 2) + '\n', { mode: 0o600 });
  return verifyBackup(destination);
}
export async function verifyBackup(directory) {
  directory = path.resolve(directory);
  const root = await lstat(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error('Regular backup directory required');
  const actual = (await files(directory)).sort();
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported backup manifest');
  const expected = new Set(['manifest.json']);
  for (const entry of manifest.files) {
    if (!safe(entry.path) || expected.has(entry.path)) throw new Error('Unsafe or duplicate manifest path');
    expected.add(entry.path);
    const bytes = await readFile(path.join(directory, entry.path));
    if (bytes.length !== entry.size || digest(bytes) !== entry.sha256) throw new Error(`Checksum mismatch: ${entry.path}`);
  }
  if (!expected.has('.x-research.sqlite') || actual.length !== expected.size || actual.some(name => !expected.has(name))) throw new Error('Backup inventory mismatch');
  await integrity(path.join(directory, '.x-research.sqlite'));
  return manifest;
}
export async function restoreBackup(directory, destination) {
  const manifest = await verifyBackup(directory);
  await emptyDirectory(path.resolve(destination));
  for (const entry of manifest.files) await copyPrivate(path.join(directory, entry.path), path.join(destination, entry.path));
  await integrity(path.join(destination, '.x-research.sqlite'));
  return { restoredFiles: manifest.files.length, destination: path.resolve(destination) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, source, destination, secretsFile] = process.argv.slice(2);
  try {
    let result;
    if (command === 'backup' && source && destination) result = await createBackup(source, destination, secretsFile || process.env.AI_SECRETS_FILE || path.join(homedir(), '.config/x-test/ai-secrets.json'));
    else if (command === 'verify' && source && !destination) result = await verifyBackup(source);
    else if (command === 'restore' && source && destination) result = await restoreBackup(source, destination);
    else throw new Error('Usage: node ops/backup.mjs backup SOURCE NEW_BACKUP_DIR [AI_SECRETS_FILE] | verify BACKUP_DIR | restore BACKUP_DIR NEW_RESTORE_DIR');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
