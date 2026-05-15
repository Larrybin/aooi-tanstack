import { loadEnvConfig } from '@next/env';

import siteEnvModule from './site-env.cjs';

const { applySiteLocalEnvOverlay } = siteEnvModule;

function shouldLoadDotenvForScripts(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof process.cwd === 'function' &&
    !process.env.NEXT_RUNTIME
  );
}

/**
 * Load `.env` files for Node scripts (tsx/ts-node/drizzle-kit), but NOT in Next.js runtime.
 *
 * This module is intended for Node scripts and safe to import as a side effect:
 * `import '@/config/load-dotenv'`
 */
export function loadDotenvForScripts() {
  if (!shouldLoadDotenvForScripts()) {
    return;
  }

  try {
    const originalEnv = { ...process.env };
    const isDev = process.env.NODE_ENV !== 'production';
    loadEnvConfig(process.cwd(), isDev);
    applySiteLocalEnvOverlay({
      env: process.env,
      originalEnv,
      siteKey: process.env.SITE,
    });
  } catch {
    // Silently fail - env loading is optional in some environments
  }
}

loadDotenvForScripts();
