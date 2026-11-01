import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const GROWTH_CONFIG_VERSION = 1;
export const DEFAULT_GROWTH_CONFIG_FILE = path.join(MODULE_DIR, 'ops/systemd/arm/growth-agent.yaml');

const OPERATOR_KEYS = new Set([
  'runtime', 'engine', 'model', 'reasoning', 'thinking', 'replyWriterMode',
  'browserTarget', 'browserInterface', 'browserMcpServer', 'browserFastBackend',
  'cdpPort', 'windowMinutes', 'experiment', 'agentMode', 'agentBrowserCli',
  'claiveBin', 'opencodeBin', 'museBin', 'piBin', 'claudeBin', 'codexBin',
  'codexExecutable',
]);
const ROLE_KEYS = new Set([
  'name', 'runtime', 'providerKind', 'protocol', 'model', 'reasoning',
  'runtimeProfile', 'baseUrl', 'secretRef', 'settings', 'enabled', 'fallback',
]);
const ROLE_NAMES = new Set([
  'continuous_scan', 'editorial_scan', 'editorial_final', 'audience_review',
  'writer', 'reply_writer', 'content_review',
]);
const INHERITED_ROLES = new Set(['reply_writer', 'content_review']);

function isMap(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnsafeKey(key, lineNumber) {
  if (['__proto__', 'constructor', 'prototype'].includes(key)) {
    throw new Error(`Growth config line ${lineNumber}: unsafe key ${key}.`);
  }
}

function stripComment(value) {
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote === "'") {
      if (char === "'" && value[index + 1] === "'") index += 1;
      else if (char === "'") quote = null;
      continue;
    }
    if (quote === '"') {
      if (char === '\\') index += 1;
      else if (char === '"') quote = null;
      continue;
    }
    if (char === "'" || char === '"') quote = char;
    else if (char === '#' && (index === 0 || /\s/.test(value[index - 1]))) return value.slice(0, index).trimEnd();
  }
  return value.trimEnd();
}

function parseScalar(value, lineNumber) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed === 'null' || trimmed === '~') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === '[]' || trimmed === '{}' || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    throw new Error(`Growth config line ${lineNumber}: inline arrays and maps are not supported.`);
  }
  if (trimmed.startsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== 'string') throw new Error('not a string');
      return parsed;
    } catch {
      throw new Error(`Growth config line ${lineNumber}: invalid double-quoted value.`);
    }
  }
  if (trimmed.startsWith("'")) {
    if (!trimmed.endsWith("'") || trimmed.length < 2) {
      throw new Error(`Growth config line ${lineNumber}: invalid single-quoted value.`);
    }
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  if (trimmed.includes(':') && !/^(?:https?:\/\/[^\s]+|env:[A-Za-z_][A-Za-z0-9_]*|file:[A-Za-z0-9._-]+)$/.test(trimmed)) {
    throw new Error(`Growth config line ${lineNumber}: quote values that contain a colon.`);
  }
  return trimmed;
}

function parseRestrictedYaml(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    if (/\t/.test(rawLine)) throw new Error(`Growth config line ${lineNumber}: tabs are not allowed.`);
    const uncommented = stripComment(rawLine);
    if (!uncommented.trim() || uncommented.trim() === '---' || uncommented.trim() === '...') return;
    const indent = uncommented.length - uncommented.trimStart().length;
    if (indent % 2 !== 0) throw new Error(`Growth config line ${lineNumber}: indentation must use two spaces.`);
    const content = uncommented.trim();
    if (content === '-' || content.startsWith('- ')) {
      throw new Error(`Growth config line ${lineNumber}: lists are not supported.`);
    }
    const match = /^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/.exec(content);
    if (!match) throw new Error(`Growth config line ${lineNumber}: expected a map entry.`);
    const [, key, rawValue] = match;
    rejectUnsafeKey(key, lineNumber);
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parentFrame = stack[stack.length - 1];
    if (indent > parentFrame.indent + 2) {
      throw new Error(`Growth config line ${lineNumber}: unexpected indentation.`);
    }
    if (!isMap(parentFrame.value)) throw new Error(`Growth config line ${lineNumber}: parent is not a map.`);
    if (Object.prototype.hasOwnProperty.call(parentFrame.value, key)) {
      throw new Error(`Growth config line ${lineNumber}: duplicate key ${key}.`);
    }
    const value = stripComment(rawValue).trim();
    if (!value) {
      const child = {};
      parentFrame.value[key] = child;
      stack.push({ indent, value: child });
    } else {
      parentFrame.value[key] = parseScalar(value, lineNumber);
    }
  });
  return root;
}

function assertKeys(value, allowed, label) {
  if (!isMap(value)) throw new Error(`Growth config ${label} must be a map.`);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Growth config ${label} has unsupported key ${key}.`);
  }
}

function validateSettings(value, label) {
  if (value == null) return;
  if (!isMap(value)) throw new Error(`Growth config ${label}.settings must be a map.`);
  for (const key of Object.keys(value)) {
    if (!['catalogPath', 'structuredOutput', 'httpReferer', 'appTitle'].includes(key)) {
      throw new Error(`Growth config ${label}.settings has unsupported key ${key}.`);
    }
    if (isMap(value[key]) || Array.isArray(value[key])) {
      throw new Error(`Growth config ${label}.settings.${key} must be scalar.`);
    }
  }
}

function validateRole(role, value, label) {
  assertKeys(value, ROLE_KEYS, label);
  if (value.settings != null) validateSettings(value.settings, label);
  if (value.fallback != null) validateRole(role, value.fallback, `${label}.fallback`);
}

export function growthConfigPath(env = process.env) {
  const configured = String(env.X_GROWTH_CONFIG_FILE || '').trim();
  return configured ? path.resolve(configured) : null;
}

export function loadGrowthConfig({ env = process.env, required = false } = {}) {
  const sourcePath = growthConfigPath(env);
  if (!sourcePath) {
    if (required) throw new Error('X_GROWTH_CONFIG_FILE is required.');
    return null;
  }
  let text;
  try {
    text = readFileSync(sourcePath, 'utf8');
  } catch (error) {
    throw new Error(`Growth config cannot be read at ${sourcePath}: ${error.message}`);
  }
  let parsed;
  try {
    parsed = parseRestrictedYaml(text);
  } catch (error) {
    throw new Error(`${error.message} (${sourcePath})`);
  }
  assertKeys(parsed, new Set(['version', 'operator', 'roles']), 'root');
  if (parsed.version !== GROWTH_CONFIG_VERSION) {
    throw new Error(`Growth config version must be ${GROWTH_CONFIG_VERSION}.`);
  }
  const operator = parsed.operator ?? {};
  assertKeys(operator, OPERATOR_KEYS, 'operator');
  const roles = parsed.roles ?? {};
  assertKeys(roles, ROLE_NAMES, 'roles');
  for (const [role, value] of Object.entries(roles)) validateRole(role, value, `roles.${role}`);
  return { version: parsed.version, operator, roles, sourcePath };
}

export function growthOperatorConfig(env = process.env) {
  return loadGrowthConfig({ env })?.operator || null;
}

export function growthRoleConfig(role, env = process.env) {
  const config = loadGrowthConfig({ env });
  if (!config) return null;
  const direct = config.roles[role];
  if (direct) return { ...direct, sourceRole: role, sourcePath: config.sourcePath };
  if (INHERITED_ROLES.has(role) && config.roles.writer) {
    return { ...config.roles.writer, sourceRole: 'writer', sourcePath: config.sourcePath };
  }
  return null;
}
