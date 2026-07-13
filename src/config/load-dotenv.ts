import { loadDotenvForScripts as loadDotenvForScriptsCore } from './load-dotenv-core.mjs';

/**
 * Load `.env` files for Node scripts (tsx/ts-node/drizzle-kit), not application runtime.
 *
 * This module is intended for Node scripts and safe to import as a side effect:
 * `import '@/config/load-dotenv'`
 */
export function loadDotenvForScripts() {
  loadDotenvForScriptsCore();
}

loadDotenvForScripts();
