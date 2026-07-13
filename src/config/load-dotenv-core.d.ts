import type { existsSync, readFileSync } from 'node:fs';

type LoadRootDotenvOptions = {
  rootDir?: string;
  nodeEnv?: string;
  isDev?: boolean;
  readFileSyncImpl?: typeof readFileSync;
  existsSyncImpl?: typeof existsSync;
};

type LoadDotenvForScriptsOptions = {
  env?: NodeJS.ProcessEnv;
  rootDir?: string;
  siteKey?: string;
  originalEnv?: NodeJS.ProcessEnv;
  readFileSyncImpl?: typeof readFileSync;
  existsSyncImpl?: typeof existsSync;
};

export function loadRootDotenv(
  env?: NodeJS.ProcessEnv,
  options?: LoadRootDotenvOptions
): { loadedFiles: string[] };

export function shouldLoadDotenvForScripts(): boolean;

export function loadDotenvForScripts(options?: LoadDotenvForScriptsOptions): {
  loaded: boolean;
  loadedFiles: string[];
};
