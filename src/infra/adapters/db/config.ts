import { assertPostgresOnlyDatabaseProvider } from '@/infra/runtime/database-provider';
import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'drizzle-kit';

import { getTrimmedEnvValue, isProductionEnv } from '@/config/env-contract';

import siteEnvModule from '@/config/site-env.cjs';

const { applySiteLocalEnvOverlay } = siteEnvModule;

function loadDotenvForDrizzleKit() {
  try {
    const originalEnv = { ...process.env };
    const isDev = !isProductionEnv();
    loadEnvConfig(process.cwd(), isDev);
    applySiteLocalEnvOverlay({
      env: process.env,
      originalEnv,
      siteKey: process.env.SITE,
    });
  } catch {
    // optional
  }
}

loadDotenvForDrizzleKit();

const databaseUrl = getTrimmedEnvValue(undefined, 'DATABASE_URL') ?? '';
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

assertPostgresOnlyDatabaseProvider(
  getTrimmedEnvValue(undefined, 'DATABASE_PROVIDER')
);

export default defineConfig({
  out: './src/config/db/migrations',
  schema: './src/config/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
