const MISSING_COLUMN = 'public.role.deleted_at';
const MIGRATIONS_DIR = 'src/config/db/migrations';

function formatMessage(parts: string[]): string {
  return parts.filter(Boolean).join(' ');
}

export function buildRoleDeletedAtMissingHint(): string {
  return formatMessage([
    `Database schema mismatch: missing column ${MISSING_COLUMN}.`,
    'This usually means migrations were not applied.',
    'Run: pnpm db:migrate',
    `Migrations directory: ${MIGRATIONS_DIR}`,
  ]);
}

export function buildPublicPermissionMisconfigurationError(): Error {
  return new Error('permission check failed due to server misconfiguration');
}

export function isMissingRoleDeletedAtColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybe = error as { code?: unknown; message?: unknown };
  if (maybe.code !== '42703') return false;

  const message = typeof maybe.message === 'string' ? maybe.message : '';
  if (!message) return false;

  const normalized = message.toLowerCase().replaceAll('"', '');
  return (
    normalized.includes('role.deleted_at') &&
    normalized.includes('does not exist')
  );
}
