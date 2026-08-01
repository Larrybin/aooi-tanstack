import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { applySiteLocalEnvOverlay } from './site-env';

const DOTENV_LINE_PATTERN =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;
const UNESCAPED_DOLLAR_PATTERN = /(?<!\\)\$/g;
const INTERPOLATION_PATTERN = /((?!(?<=\\))\${?([\w]+)(?::-([^}\\]*))?}?)/;

type ReadFileSync = typeof readFileSync;
type ExistsSync = typeof existsSync;

type LoadRootDotenvOptions = {
  rootDir?: string;
  nodeEnv?: string;
  isDev?: boolean;
  readFileSyncImpl?: ReadFileSync;
  existsSyncImpl?: ExistsSync;
};

type LoadDotenvForScriptsOptions = {
  env?: NodeJS.ProcessEnv;
  rootDir?: string;
  siteKey?: string;
  originalEnv?: NodeJS.ProcessEnv;
  readFileSyncImpl?: ReadFileSync;
  existsSyncImpl?: ExistsSync;
};

function parseDotenv(content: string) {
  const entries: Record<string, string> = {};
  const normalizedContent = content.toString().replace(/\r\n?/gm, '\n');
  DOTENV_LINE_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = DOTENV_LINE_PATTERN.exec(normalizedContent)) !== null) {
    const name = match[1];
    let value = (match[2] || '').trim();
    const quote = value[0];
    value = value.replace(/^(['"`])([\s\S]*)\1$/gm, '$2');
    if (quote === '"') {
      value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    }

    entries[name] = value;
  }

  return entries;
}

function resolveDotenvFiles({
  nodeEnv,
  isDev,
}: {
  nodeEnv?: string;
  isDev: boolean;
}) {
  const mode =
    nodeEnv === 'test' ? 'test' : isDev ? 'development' : 'production';
  return [
    `.env.${mode}.local`,
    mode !== 'test' ? '.env.local' : '',
    `.env.${mode}`,
    '.env',
  ].filter(Boolean);
}

function searchLastUnescapedDollar(value: string) {
  const matches = Array.from(value.matchAll(UNESCAPED_DOLLAR_PATTERN));
  return matches.at(-1)?.index ?? -1;
}

function resolveInterpolationReplacement(
  name: string,
  defaultValue: string | undefined,
  env: NodeJS.ProcessEnv,
  parsed: Record<string, string>,
  stack: Set<string>
) {
  if (Object.prototype.hasOwnProperty.call(env, name)) {
    return String(env[name] ?? '');
  }

  if (stack.has(name)) {
    return defaultValue ?? '';
  }

  if (!Object.prototype.hasOwnProperty.call(parsed, name)) {
    return defaultValue ?? '';
  }

  stack.add(name);
  const replacement = interpolateValue(
    String(parsed[name] ?? ''),
    env,
    parsed,
    stack
  );
  stack.delete(name);
  return replacement;
}

function interpolateValue(
  value: string,
  env: NodeJS.ProcessEnv,
  parsed: Record<string, string>,
  stack = new Set<string>()
) {
  const dollarIndex = searchLastUnescapedDollar(value);
  if (dollarIndex === -1) return value;

  const tail = value.slice(dollarIndex);
  const match = tail.match(INTERPOLATION_PATTERN);
  if (!match) return value;

  const [fullMatch, , name, defaultValue] = match;
  const replacement = resolveInterpolationReplacement(
    name,
    defaultValue,
    env,
    parsed,
    stack
  );
  return interpolateValue(
    value.replace(fullMatch, replacement),
    env,
    parsed,
    stack
  );
}

function expandParsedValues(
  entries: Record<string, string>,
  env: NodeJS.ProcessEnv
) {
  const parsed = { ...entries };

  for (const name of Object.keys(parsed)) {
    const sourceValue = Object.prototype.hasOwnProperty.call(env, name)
      ? env[name]
      : parsed[name];
    parsed[name] = interpolateValue(
      String(sourceValue ?? ''),
      env,
      parsed
    ).replace(/\\\$/g, '$');
  }

  return parsed;
}

export function loadRootDotenv(
  env = process.env,
  {
    rootDir = process.cwd(),
    nodeEnv = env.NODE_ENV,
    isDev = nodeEnv !== 'production',
    readFileSyncImpl = readFileSync,
    existsSyncImpl = existsSync,
  }: LoadRootDotenvOptions = {}
) {
  const originalEnv = { ...env };
  const expansionEnv = { ...env };
  const loadedFiles: string[] = [];

  for (const fileName of resolveDotenvFiles({ nodeEnv, isDev })) {
    const filePath = path.join(rootDir, fileName);
    if (!existsSyncImpl(filePath)) continue;
    const entries = parseDotenv(readFileSyncImpl(filePath, 'utf8'));
    const expandedEntries = expandParsedValues(entries, expansionEnv);
    loadedFiles.push(filePath);
    Object.assign(expansionEnv, expandedEntries);
    for (const [name, value] of Object.entries(expandedEntries)) {
      if (Object.prototype.hasOwnProperty.call(originalEnv, name)) continue;
      if (Object.prototype.hasOwnProperty.call(env, name)) continue;
      env[name] = value;
    }
  }

  return { loadedFiles };
}

export function shouldLoadDotenvForScripts() {
  return typeof process !== 'undefined' && typeof process.cwd === 'function';
}

export function loadDotenvForScripts({
  env = process.env,
  rootDir = process.cwd(),
  siteKey = env.SITE,
  originalEnv = { ...env },
  readFileSyncImpl = readFileSync,
  existsSyncImpl = existsSync,
}: LoadDotenvForScriptsOptions = {}) {
  if (!shouldLoadDotenvForScripts()) {
    return { loaded: false, loadedFiles: [] };
  }

  try {
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
  } catch {
    return { loaded: true, loadedFiles: [] };
  }
}
