/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require('node:fs');
const path = require('node:path');

const SITE_LOCAL_ENV_FILE = '.env.local';

function normalizeEnvValue(rawValue) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseSiteEnvFileContent(content) {
  const entries = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const assignment = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trim()
      : trimmed;
    const equalsIndex = assignment.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const name = assignment.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) {
      continue;
    }

    entries[name] = normalizeEnvValue(assignment.slice(equalsIndex + 1));
  }

  return entries;
}

function resolveSiteLocalEnvPath({ rootDir = process.cwd(), siteKey }) {
  if (!siteKey?.trim()) {
    return '';
  }

  return path.join(rootDir, 'sites', siteKey.trim(), SITE_LOCAL_ENV_FILE);
}

function readSiteLocalEnv({
  rootDir = process.cwd(),
  siteKey,
  readFileSyncImpl = readFileSync,
} = {}) {
  const envPath = resolveSiteLocalEnvPath({ rootDir, siteKey });
  if (!envPath) {
    return {};
  }

  try {
    return parseSiteEnvFileContent(readFileSyncImpl(envPath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

function hasOwnEnvValue(env, name) {
  return Object.prototype.hasOwnProperty.call(env, name);
}

function applySiteLocalEnvOverlay({
  env = process.env,
  originalEnv = env,
  rootDir = process.cwd(),
  siteKey = env.SITE,
  readFileSyncImpl = readFileSync,
} = {}) {
  const entries = readSiteLocalEnv({
    rootDir,
    siteKey,
    readFileSyncImpl,
  });

  for (const [name, value] of Object.entries(entries)) {
    if (name === 'SITE') {
      continue;
    }

    if (hasOwnEnvValue(originalEnv, name)) {
      continue;
    }

    env[name] = value;
  }

  return env;
}

module.exports = {
  SITE_LOCAL_ENV_FILE,
  applySiteLocalEnvOverlay,
  parseSiteEnvFileContent,
  readSiteLocalEnv,
  resolveSiteLocalEnvPath,
};
