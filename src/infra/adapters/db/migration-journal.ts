export type MigrationRecord = {
  hash: string;
  createdAt: number;
};

export type ExpectedMigration = MigrationRecord & {
  tag: string;
};

export function assertMigrationJournalCurrent({
  applied,
  expected,
}: {
  applied: MigrationRecord | null;
  expected: ExpectedMigration;
}) {
  if (!applied) {
    throw new Error(
      `Database migration journal is empty; run pnpm db:migrate through ${expected.tag}.`
    );
  }

  if (applied.createdAt < expected.createdAt) {
    throw new Error(
      `Database migration journal is behind ${expected.tag}; run pnpm db:migrate.`
    );
  }

  if (applied.createdAt > expected.createdAt) {
    throw new Error(
      `Database migration journal is ahead of repository migration ${expected.tag}.`
    );
  }

  if (applied.hash !== expected.hash) {
    throw new Error(
      `Database migration journal hash mismatch for ${expected.tag}.`
    );
  }
}
