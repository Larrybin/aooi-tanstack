import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import siteEnvModule from './site-env.cjs';

const { applySiteLocalEnvOverlay } = siteEnvModule;

function parseDotenv(content) {
  const entries = {};
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const assignment = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trim()
      : trimmed;
    const equalsIndex = assignment.indexOf('=');
    if (equalsIndex <= 0) continue;

    const name = assignment.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) continue;

    let value = assignment.slice(equalsIndex + 1).trim();
    const commentIndex = value.search(/\s#/u);
    if (commentIndex >= 0 && !value.startsWith('"') && !value.startsWith("'")) {
      value = value.slice(0, commentIndex).trim();
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[name] = value.replace(/\\n/g, '\n');
  }
  return entries;
}

function resolveDotenvFiles({ nodeEnv, isDev }) {
  const mode = nodeEnv === 'test' ? 'test' : isDev ? 'development' : 'production';
  return [
    `.env.${mode}.local`,
    mode !== 'test' ? '.env.local' : '',
    `.env.${mode}`,
    '.env',
  ].filter(Boolean);
}

function expandValue(value, env) {
  return value.replace(/(^|[^\\])\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/gu, (match, prefix, name) => {
    const replacement = env[name];
    return `${prefix}${typeof replacement === 'string' ? replacement : ''}`;
  }).replace(/\\\$/g, '$');
}

export function loadRootDotenv(
  env = process.env,
  {
    rootDir = process.cwd(),
    nodeEnv = env.NODE_ENV,
    isDev = nodeEnv !== 'production',
    readFileSyncImpl = readFileSync,
    existsSyncImpl = existsSync,
  } = {}
) {
  const originalEnv = { ...env };
  const loadedFiles = [];

  for (const fileName of resolveDotenvFiles({ nodeEnv, isDev })) {
    const filePath = path.join(rootDir, fileName);
    if (!existsSyncImpl(filePath)) continue;
    const entries = parseDotenv(readFileSyncImpl(filePath, 'utf8'));
    loadedFiles.push(filePath);
    for (const [name, rawValue] of Object.entries(entries)) {
      if (Object.prototype.hasOwnProperty.call(originalEnv, name)) continue;
      if (Object.prototype.hasOwnProperty.call(env, name)) continue;
      env[name] = expandValue(rawValue, env);
    }
  }

  return { loadedFiles };
}

export function shouldLoadDotenvForScripts(env = process.env) {
  return (
    typeof process !== 'undefined' &&
    typeof process.cwd === 'function' &&
    !env.NEXT_RUNTIME
  );
}

export function loadDotenvForScripts({
  env = process.env,
  rootDir = process.cwd(),
  siteKey = env.SITE,
  originalEnv = { ...env },
  readFileSyncImpl = readFileSync,
  existsSyncImpl = existsSync,
} = {}) {
  if (!shouldLoadDotenvForScripts(env)) {
    return { loaded: false, loadedFiles: [] };
  }

  const { loadedFiles } = loadRootDotenv(env, {
    rootDir,
    nodeEnv: env.NODE_ENV,
    isDev: env.NODE_ENV !== 'production',
    readFileSyncImpl,
    existsSyncImpl,
  });

  applySiteLocalEnvOverlay({
    env,
    originalEnv,
    rootDir,
    siteKey,
    readFileSyncImpl,
  });

  return { loaded: true, loadedFiles };
}
