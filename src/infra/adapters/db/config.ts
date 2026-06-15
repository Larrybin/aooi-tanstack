import { assertPostgresOnlyDatabaseProvider } from '@/infra/runtime/database-provider';
import { defineConfig } from 'drizzle-kit';

import { getTrimmedEnvValue } from '@/config/env-contract';
import { loadDotenvForScripts } from '@/config/load-dotenv';

loadDotenvForScripts();

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
