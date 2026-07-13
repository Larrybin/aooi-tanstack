# RBAC (Role-Based Access Control) Guide

This guide covers the Role-Based Access Control system for managing user permissions.

## Architecture Overview

```text
src/domains/access-control/
  domain/
    policy.ts
    permission-matcher.ts
  application/
    checker.ts

src/infra/adapters/access-control/
  repository.ts

src/shared/lib/api/guard.ts       # API adapter: 401/403 semantics
src/shared/lib/action/guard.ts    # Action adapter: ActionError semantics
apps/web/src/routes/admin_.tsx
apps/web/src/routes/$locale/admin_.tsx
  page adapter: redirect/notFound semantics
```

`domains/access-control` never imports `next/navigation` and never calls `redirect()` / `notFound()`. Web behavior is adapter-owned.

## Database Schema

The RBAC system uses four tables:

| Table             | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `role`            | Role definitions (name, title, status)                 |
| `permission`      | Permission definitions (code, resource, action)        |
| `role_permission` | Many-to-many: roles ↔ permissions                      |
| `user_role`       | Many-to-many: users ↔ roles (with optional expiration) |

## Built-in Roles

| Role          | Description        | Permissions            |
| ------------- | ------------------ | ---------------------- |
| `super_admin` | Full system access | `*` (all)              |
| `admin`       | Administrator      | Most admin permissions |
| `editor`      | Content editor     | Posts, categories      |
| `viewer`      | Read-only access   | View-only permissions  |

The wildcard permission `*` is reserved for `super_admin`.

## Permission Code Format

Permissions follow a hierarchical `resource.action` pattern:

```text
admin.access
admin.users.read
admin.users.write
admin.posts.*
*
```

Permission constants live in `src/shared/constants/rbac-permissions.ts`.

## Server-Side API

Use the checker in `src/domains/access-control/application/checker.ts`.

```typescript
import { checkUserPermission } from '@/domains/access-control/application/checker';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

const result = await checkUserPermission(userId, PERMISSIONS.USERS_READ);
if (!result.allowed) {
  // Convert to page/action/api-specific behavior at the adapter boundary.
}
```

## Guard Adapters

- Page guards live in `app/**` or surface-specific page adapters and may redirect/notFound.
- Server Action guards live in `src/shared/lib/action/guard.ts` and throw `ActionError`.
- API guards live in `src/shared/lib/api/guard.ts` and map to 401/403 semantics.

Do not create a universal guard that switches behavior by parameter.

## Enforcement Model

- `src/request-proxy.ts` only performs a lightweight session-cookie gate for `/admin`, `/settings`, `/activity`.
- `/admin/**` requires `admin.access` through the admin route resolver used by `apps/web/src/routes/admin_.tsx` and its localized counterpart.
- Route Handlers should use `requireUser()` plus permission checks at the entry point.
- Server Actions should use action guards at the action boundary.

## Initialization Scripts

```bash
pnpm rbac:init
pnpm rbac:init -- --admin-email=admin@example.com
pnpm rbac:assign -- --email=user@example.com --role=editor
```

## Error Handling

The RBAC schema check verifies required columns such as `role.deleted_at`.

In non-production, missing schema details include a migration hint. In production, checks throw a generic public error and log detailed hints server-side.

## Related Files

- `src/domains/access-control/domain/policy.ts` - Permission policy
- `src/domains/access-control/domain/permission-matcher.ts` - Wildcard matching
- `src/domains/access-control/application/checker.ts` - Pure checker application entry
- `src/infra/adapters/access-control/repository.ts` - Persistence adapter
- `src/shared/lib/action/guard.ts` - Server Action adapter
- `src/shared/lib/api/guard.ts` - API adapter
- `src/shared/constants/rbac-permissions.ts` - Permission constants
- `src/config/db/schema.ts` - Database schema definitions
- `scripts/init-rbac.ts` - Initialization script
- `scripts/assign-role.ts` - Role assignment script
- `scripts/self-check-rbac.ts` - Smoke-check script
