import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { countAiProfilesUsingSecretRef } from './store.js';

export const AI_SECRETS_FILE = path.resolve(
  String(process.env.AI_SECRETS_FILE || path.join(homedir(), '.config', 'x-test', 'ai-secrets.json')),
);

function parseSecretRef(secretRef) {
  const value = String(secretRef || '').trim();
  if (/^file:[A-Za-z0-9._-]+$/.test(value)) return { type: 'file', id: value.slice(5), secretRef: value };
  if (/^env:[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return { type: 'env', id: value.slice(4), secretRef: value };
  throw new Error('Invalid AI secret reference.');
}

function normalizeApiKey(apiKey) {
  const value = String(apiKey || '').trim();
  if (!value) throw new Error('AI secret value cannot be empty.');
  return value;
}

async function readSecretMap() {
  try {
    const parsed = JSON.parse(await readFile(AI_SECRETS_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    return parsed;
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw new Error('AI secrets file is invalid or unreadable.');
  }
}

async function writeSecretMap(secrets) {
  const parent = path.dirname(AI_SECRETS_FILE);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const temp = path.join(parent, `.${path.basename(AI_SECRETS_FILE)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temp, `${JSON.stringify(secrets, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(temp, AI_SECRETS_FILE);
  } finally {
    await rm(temp, { force: true }).catch(() => {});
  }
}

export async function getAiSecretStatus(secretRef) {
  if (!secretRef) return { secretRef: '', source: null, hasSecret: false };
  const parsed = parseSecretRef(secretRef);
  if (parsed.type === 'env') {
    return { secretRef: parsed.secretRef, source: 'env', hasSecret: Boolean(process.env[parsed.id]) };
  }
  const secrets = await readSecretMap();
  return {
    secretRef: parsed.secretRef,
    source: 'file',
    hasSecret: Boolean(secrets[parsed.id]?.apiKey),
  };
}

export async function resolveAiSecret(secretRef) {
  if (!secretRef) return null;
  const parsed = parseSecretRef(secretRef);
  if (parsed.type === 'env') return process.env[parsed.id] || null;
  const secrets = await readSecretMap();
  const value = secrets[parsed.id]?.apiKey;
  return typeof value === 'string' && value ? value : null;
}

export async function setAiSecret(secretRef, apiKey) {
  const value = normalizeApiKey(apiKey);
  const parsed = secretRef ? parseSecretRef(secretRef) : { type: 'file', id: randomUUID(), secretRef: null };
  if (parsed.type !== 'file') throw new Error('Environment-backed AI secrets must be changed through the environment.');
  const ref = parsed.secretRef || `file:${parsed.id}`;
  const secrets = await readSecretMap();
  secrets[parsed.id] = { apiKey: value };
  await writeSecretMap(secrets);
  return { secretRef: ref, source: 'file', hasSecret: true };
}

export async function removeAiSecret(secretRef, { excludeProfileId = null } = {}) {
  const parsed = parseSecretRef(secretRef);
  if (parsed.type !== 'file') {
    return { secretRef: parsed.secretRef, source: 'env', hasSecret: Boolean(process.env[parsed.id]), removed: false };
  }
  const otherReferences = countAiProfilesUsingSecretRef(parsed.secretRef, { excludeProfileId });
  if (otherReferences > 0) throw new Error('AI secret reference is still used by another profile.');
  const secrets = await readSecretMap();
  const existed = Object.hasOwn(secrets, parsed.id);
  if (existed) {
    delete secrets[parsed.id];
    await writeSecretMap(secrets);
  }
  return { secretRef: parsed.secretRef, source: 'file', hasSecret: false, removed: existed };
}
