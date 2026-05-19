# Database Guide

This guide covers the database setup using Drizzle ORM with PostgreSQL.

## Architecture Overview

```
src/
├── infra/adapters/db/
│   ├── index.ts       # Database connection factory
│   └── config.ts      # Drizzle Kit configuration
└── config/db/
    ├── schema.ts      # Table definitions (single source of truth)
    └── migrations/    # SQL migration files
```

## Database Connection

The `db()` function provides a Drizzle ORM instance with automatic environment detection:

```typescript
import { db } from '@/infra/adapters/db';

// Use in any server-side code
const users = await db().select().from(user);
```

### Connection Modes

| Environment        | Mode                     | Description                                                   |
| ------------------ | ------------------------ | ------------------------------------------------------------- |
| Cloudflare Workers | Hyperdrive (per-request) | Uses `HYPERDRIVE` binding; creates a fresh client per request |
| Traditional Server | Singleton                | Reuses connection pool across requests                        |
| Serverless         | Instance-cached client   | Caches one client (max=1) per instance/`DATABASE_URL`         |

### Configuration

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                      |
| `DB_SINGLETON_ENABLED` | `true` to enable singleton mode                   |
| `DATABASE_PROVIDER`    | Must be `postgresql` (any other value will throw) |

Notes:

- In Cloudflare Workers runtime, `db()` ignores `DATABASE_URL` and uses `HYPERDRIVE.connectionString` from bindings (`[[hyperdrive]] binding = "HYPERDRIVE"`). Missing bindings fail with a `ServiceUnavailableError` and a generic public message.
- In Cloudflare Workers runtime, `db()` does **not** reuse a postgres/Hyperdrive client across requests. It creates a fresh client per request and keeps schema-check state request-scoped to avoid Worker hangs caused by cross-request I/O reuse.
- Cloudflare bindings are read only through `src/infra/runtime/env.server.ts`. Business code should not touch Workers detection or bindings directly.
- This also enables DB-backed settings/configs (the `config` table, `getAllConfigs()`/`getConfigs()`) at runtime in Workers even when `DATABASE_URL` is empty.
- `DB_SINGLETON_ENABLED` only applies to non-Workers Node runtimes. Workers always use the Hyperdrive request-scoped path above.
- Drizzle Kit CLI workflows (`pnpm db:generate|db:migrate|db:push|db:studio`) run on Node.js and require `DATABASE_URL` (see `src/infra/adapters/db/config.ts`).
- Cloudflare is now treated as a full-app runtime target. The Worker serves public, auth, and protected routes from one origin, and cross-origin cookie auth topologies are not supported.
- CI Cloudflare local smoke and app smoke now create a temporary Wrangler config that rewrites `[[hyperdrive]].localConnectionString`, so database-backed runtime checks run against the service-container Postgres without mutating the tracked production config.

## Schema Definition

All tables are defined in `src/config/db/schema.ts` using Drizzle's type-safe API:

```typescript
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

### Core Tables

| Table             | Description                 |
| ----------------- | --------------------------- |
| `user`            | User accounts               |
| `session`         | Active sessions             |
| `account`         | OAuth provider accounts     |
| `verification`    | Email verification tokens   |
| `role`            | RBAC roles                  |
| `permission`      | RBAC permissions            |
| `user_role`       | User-role assignments       |
| `role_permission` | Role-permission assignments |
| `order`           | Payment orders              |
| `subscription`    | Active subscriptions        |
| `credit`          | User credits                |
| `config`          | System configuration        |

## Migrations

### Generate Migration

After modifying `schema.ts`:

```bash
pnpm db:generate
```

This creates a new SQL file in `src/config/db/migrations/`.

### Apply Migrations

```bash
pnpm db:migrate
```

**Important**: Always apply migrations before starting the app in staging/production.

### Schema Check (Fail-fast)

Optional read-only check (does not apply migrations):

```bash
pnpm db:check
```

This verifies required columns exist (e.g. `role.deleted_at`) and provides a migration hint when they do not.

### Migration Files

Migrations are stored as SQL files:

```
src/config/db/migrations/
├── 0000_flashy_galactus.sql
├── 0001_nasty_vindicator.sql
├── 0002_enable_rls_public_tables.sql
├── 0003_payment_webhook_audit.sql
└── meta/
    ├── _journal.json
    ├── 0000_snapshot.json
    ├── 0001_snapshot.json
    └── 0002_snapshot.json
```

**Note**: `meta/*_snapshot.json` is drizzle-kit metadata used for migration bookkeeping and schema diffing. Features expressed only in hand-written SQL (like `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) may not be reflected in snapshots (e.g. `isRLSEnabled` can stay `false`). Treat migration SQL and PostgreSQL system catalogs (`pg_class`, `pg_policies`) as the source of truth.

### Drizzle Studio

Visual database browser:

```bash
pnpm db:studio
```

Opens at http://local.drizzle.studio

## Data Access Layer

Data access functions live with their owning domain under `src/domains/*/infra/` or in a narrow adapter under `src/infra/adapters/*`.

```typescript
// src/domains/account/infra/user.ts
import 'server-only';

import { db } from '@/infra/adapters/db';
import { eq } from 'drizzle-orm';

import { user } from '@/config/db/schema';

export async function getUserById(id: string) {
  const [result] = await db().select().from(user).where(eq(user.id, id));
  return result;
}

export async function createUser(data: NewUser) {
  const [result] = await db().insert(user).values(data).returning();
  return result;
}
```

### Type Inference

Drizzle provides automatic type inference:

```typescript
// Infer select type
type User = typeof user.$inferSelect;

// Infer insert type
type NewUser = typeof user.$inferInsert;

// Partial update type
type UpdateUser = Partial<Omit<NewUser, 'id' | 'createdAt'>>;
```

## Query Patterns

### Basic Select

```typescript
import { db } from '@/infra/adapters/db';
import { and, desc, eq, like } from 'drizzle-orm';

import { user } from '@/config/db/schema';

// Get by ID
const [user] = await db().select().from(user).where(eq(user.id, id));

// Multiple conditions
const users = await db()
  .select()
  .from(user)
  .where(and(eq(user.emailVerified, true), like(user.name, '%John%')))
  .orderBy(desc(user.createdAt))
  .limit(10);
```

### Joins

```typescript
import { order, user } from '@/config/db/schema';

const ordersWithUser = await db()
  .select({
    orderId: order.id,
    userName: user.name,
    amount: order.amount,
  })
  .from(order)
  .innerJoin(user, eq(order.userId, user.id));
```

### Transactions

```typescript
await db().transaction(async (tx) => {
  await tx.insert(order).values(orderData);
  await tx.insert(credit).values(creditData);
});
```

### Aggregations

```typescript
import { count, sum } from 'drizzle-orm';

const [result] = await db()
  .select({
    totalOrders: count(),
    totalAmount: sum(order.amount),
  })
  .from(order)
  .where(eq(order.status, 'paid'));
```

## Schema Validation

The database connection includes automatic schema validation. On startup, it checks for required columns (e.g., `role.deleted_at`). If migrations are missing:

```
Database schema mismatch: missing column public.role.deleted_at.
This usually means migrations were not applied.
Run: pnpm db:migrate
```

Notes:

- Schema checks cache successful results; failures are cleared and retried after a short cooldown, and queries always gate on the latest check so transient startup failures can self-heal without a process restart.
- Hints reference the migrations directory/log table instead of a specific migration filename to avoid drift.
- In production, connectivity/schema mismatches are mapped to generic public errors (`DB_STARTUP_CHECK_FAILED (...)`) while detailed hints are logged server-side.

## Multi-Environment Support

### Cloudflare Workers + Hyperdrive

Configure the tracked router template together with the current site deploy contract:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "hyperdrive-id"
```

The `db()` function automatically detects and uses Hyperdrive.

Hyperdrive IDs belong in deploy settings, not local env files:

- Local Node.js development and Drizzle commands use a direct `DATABASE_URL`.
- Cloudflare preview uses
  `sites/<site-key>/deploy.preview.settings.json`
  `resources.hyperdriveId`.
- Cloudflare production uses `sites/<site-key>/deploy.settings.json`
  `resources.hyperdriveId`.

Tracked Wrangler configs are templates. Keep every checked-in `localConnectionString = ""` and generate a temporary Wrangler config when local Hyperdrive access is needed.

Cloudflare helper commands:

- `pnpm cf:check`
- `pnpm cf:build`
- `SITE=<site-key> pnpm test:cf-local-smoke`
- `SITE=<site-key> pnpm test:cf-admin-settings-smoke`
- `SITE=<site-key> pnpm test:cf-app-smoke`
- `pnpm cf:typegen`
- `pnpm cf:typegen:check`
- `pnpm cf:deploy:state`
- `pnpm cf:deploy:app`
- `pnpm cf:deploy` (`pnpm cf:deploy:app` 的别名)

Smoke commands keep their public package names, but they now route through `scripts/smoke.mjs <scenario>` internally. Cloudflare local runtime uses the `cf-local` scenario, admin/settings storage smoke uses `cf-admin-settings`, and production read-only app smoke uses `cf-app`.

`SITE=<site-key> pnpm test:cf-admin-settings-smoke` is intentionally a smaller local acceptance chain: it seeds the required settings rows directly in Postgres, uploads through the real Cloudflare runtime API, and then validates public config projection plus the missing-`STORAGE_PUBLIC_BASE_URL` failure path inside the same generated local Cloudflare runtime session.

`pnpm cf:build` now validates the router/app workers through `wrangler versions upload --dry-run` instead of trusting raw intermediate `handler.mjs` file size. State preflight is owned by `pnpm cf:check -- --workers=state` and `pnpm cf:deploy:state`; it only verifies the Durable Object artifacts imported by the state worker, not router/server worker bundles.

`SITE=<site-key> pnpm test:cf-app-smoke` is the Cloudflare full-app smoke: landing, sign-in, sign-up, docs, public config API, sitemap, robots, and same-origin protected-route redirects back to `/sign-in`.

The smoke is read-only. It must not upsert public config values or mutate the `config` table in local runtime or production.

The governed deployment posture is now Cloudflare-only: production deploys must use the canonical multi-worker OpenNext + Hyperdrive topology.

State Worker migrations must stay state-safe. Router request dispatch changes belong in `pnpm cf:deploy:app`, while Durable Object owner/migration changes belong in `pnpm cf:deploy:state`.
`pnpm cf:deploy:app` is a pure app release step. It does not bootstrap missing router/server deployments, so brand-new or partially initialized production environments must run `pnpm cf:deploy:state` first and `pnpm cf:deploy` second.

`Cloudflare Deploy Acceptance` keeps DB schema governance in the schema migration guard, while production migrations remain owned by the local release command before deploy. The split `cloudflare-acceptance` matrix job still starts a temporary Postgres service and runs `pnpm db:migrate` before `pnpm cf:build`, because the current OpenNext build prerenders pages that read runtime settings from the `config` table.

## Best Practices

1. **Always use Drizzle ORM** - Avoid raw SQL unless absolutely necessary
2. **Use `server-only`** - Add to domain infra / adapter files to prevent client imports
3. **Type your functions** - Use inferred types from schema
4. **Apply migrations before deployment** - Run `pnpm db:migrate` before deployment. In this repo, `SITE=mamamiya pnpm release:cf` runs migrations with `PRODUCTION_DATABASE_URL` before deploying Cloudflare workers.
5. **Use transactions** - For multi-table operations
6. **Reuse `db()` per request** - Avoid calling `db()` many times in the same request; share the instance
7. **Index appropriately** - Add indexes in schema for common queries
8. **If using Supabase (PostgREST)**:
   - Enable RLS on `public` tables (see migration `src/config/db/migrations/0002_enable_rls_public_tables.sql`)
   - With RLS enabled and no policies, access is deny-by-default for roles that do not bypass RLS (add policies explicitly when you need exposure)
   - Table owners can bypass RLS unless you `FORCE ROW LEVEL SECURITY`; decide intentionally based on your exposure model
   - Verify the state after applying migrations:

```sql
-- RLS status for all public tables
SELECT
  c.relname AS table,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY 1;

-- Policies (if any)
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Troubleshooting

### Connection Errors

```
DATABASE_URL is not set
```

Ensure `DATABASE_URL` is set in `.env` or environment variables.

### Migration Errors

```
Database schema mismatch
```

Run `pnpm db:migrate` to apply pending migrations.

### Hyperdrive Errors

```
Cloudflare Workers requires Hyperdrive binding
```

Configure the `HYPERDRIVE` binding in the tracked router template and keep the site-specific Hyperdrive id in `sites/<site>/deploy.settings.json`.

## Related Files

- `src/infra/adapters/db/index.ts` - Database connection
- `src/config/db/schema.ts` - Schema definitions
- `src/config/db/migrations/` - Migration files
- `src/domains/*/infra/` - Domain-owned data access
