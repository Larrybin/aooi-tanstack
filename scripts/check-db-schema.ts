/**
 * DB Schema Check (fail-fast)
 *
 * Usage:
 *   pnpm db:check
 *
 * Notes:
 * - This script reads DATABASE_URL and performs read-only checks.
 * - It does NOT apply migrations.
 */

import '@/config/load-dotenv';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertMigrationJournalCurrent,
  type MigrationRecord,
} from '@/infra/adapters/db/migration-journal';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres from 'postgres';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 1,
    connect_timeout: 3,
  });

  try {
    const migrations = readMigrationFiles({
      migrationsFolder: path.resolve('src/config/db/migrations'),
    });
    const latest = migrations.at(-1);
    if (!latest) {
      throw new Error('No repository migrations found.');
    }
    const journal = JSON.parse(
      await readFile(
        path.resolve('src/config/db/migrations/meta/_journal.json'),
        'utf8'
      )
    ) as { entries?: Array<{ tag?: string }> };
    const latestTag = journal.entries?.at(-1)?.tag;
    if (!latestTag) {
      throw new Error('Migration journal has no latest tag.');
    }

    const rows = await sql<MigrationRecord[]>`
      select hash, created_at as "createdAt"
      from drizzle.__drizzle_migrations
      order by created_at desc
      limit 1
    `;
    const applied = rows[0]
      ? {
          hash: rows[0].hash,
          createdAt: Number(rows[0].createdAt),
        }
      : null;

    assertMigrationJournalCurrent({
      applied,
      expected: {
        hash: latest.hash,
        createdAt: latest.folderMillis,
        tag: latestTag,
      },
    });
    console.log('db: migration journal current');
  } finally {
    try {
      await sql.end?.({ timeout: 5 });
    } catch {
      // ignore cleanup errors
    }
  }
}

main().catch((error: unknown) => {
  console.error('db: schema check failed', { error });
  process.exitCode = 1;
});
