# Settings Guide

This guide documents the **Settings** surfaces in the app. There are two different concepts that share the same word:

- **User Settings**: end-user account pages under `/<locale?>/settings/**` (profile, API keys, credits, billing/payments, security).
- **Admin Settings**: admin-config pages under `/<locale?>/admin/settings/**` (feature flags / integrations / system configs).

## User Settings (`/settings/**`)

### Routes

- Entry: `/<locale?>/settings` → redirects to `/<locale?>/settings/profile`
- Profile: `/<locale?>/settings/profile`
- Security: `/<locale?>/settings/security`
- API Keys: `/<locale?>/settings/apikeys` (+ `create`, `[id]/edit`, `[id]/delete`)
- Credits: `/<locale?>/settings/credits`
- Billing: `/<locale?>/settings/billing` (subscription)
- Payments: `/<locale?>/settings/payments` (one-time/subscription history)
- Invoices: `/<locale?>/settings/invoices/*` (provider-specific retrieve)

Billing/Payments entry points are documented in `docs/guides/payment.md`.

### Access Control

- `src/request-proxy.ts` performs a **light** gate for `/settings/**` by checking the session cookie exists.
- Each leaf page still treats auth as request-bound and renders `Empty message="no auth"` when `getUserInfo()` returns null.

### Server Actions & Data Writes

User settings writes are implemented via Server Actions (not `/api/settings/*` Route Handlers).

**Profile**

- Page routes: `apps/web/src/routes/settings/profile.tsx` and `apps/web/src/routes/$locale/settings/profile.tsx`
- Schema: `src/shared/schemas/actions/settings-profile.ts`
- Write: `updateProfileUseCase()` from `src/domains/account/application/use-cases.ts`

**API Keys**

- List: `apps/web/src/routes/settings/apikeys.tsx`
- Create: `apps/web/src/routes/settings/apikeys_/create.tsx`
- Edit: `apps/web/src/routes/settings/apikeys_/$id/edit.tsx`
- Delete: `apps/web/src/routes/settings/apikeys_/$id/delete.tsx` (soft delete: `status=DELETED` + `deletedAt`)
- Schema: `src/shared/schemas/actions/settings-apikey.ts` (requires `title`)

**Security**

- Page: `apps/web/src/routes/settings/security.tsx` (plus localized counterpart)
- Password reset is handled by the auth flow (`/<locale?>/forgot-password` → email → `/<locale?>/reset-password?token=...`). See `docs/guides/auth.md`.
- Account deletion UI is present but no self-serve delete flow is implemented.

## Admin Settings (`/admin/settings/**`)

### Routes

- `/<locale?>/admin/settings/<tab>` (e.g. `general`, `auth`, `payment`, `email`, `storage`, ...)

### Access Control

Admin pages are guarded in two layers:

1. `/<locale?>/admin/**` requires `admin.access` via the admin route resolver.
2. Admin Settings additionally require **both** `admin.settings.read` and `admin.settings.write` in
   `src/server/admin/admin-route-resolver.ts` (`requireAllPermissions()` and `requireActionPermissions()`).
3. The default `admin` role seeded by `scripts/init-rbac.ts` includes both settings permissions, which is the contract used by Cloudflare app smoke for `/admin/settings/auth`.

### Config Storage & Validation

- Settings values are stored in the `config` table via `src/domains/settings/application/settings-store.ts`.
- `settings-store.ts` owns writes and invalidates `CONFIGS_CACHE_TAG` / `PUBLIC_CONFIGS_CACHE_TAG`.
- Runtime typed reads use `src/domains/settings/application/settings-runtime.query.ts`.
- Public UI/SEO/theme data is projected as `PublicUiConfig` via `settings-runtime.builders.ts` and read through server-side query entrypoints.
- Some fields are validated/normalized on submit (e.g. JSON for social links / payment methods / product mapping), and those rules now live directly on each setting definition.
- The single source of truth for setting-level contract is `src/domains/settings/definitions/*.ts`, aggregated by `src/domains/settings/registry.ts`.
- Public/private exposure, group metadata, module ownership, and submit-time normalize/validate behavior are all derived from that registry. `tabs.ts` remains a separate route contract on purpose.
- `settings` stores fields and values only. Business domains interpret value meaning, such as billing provider enablement or credit behavior.

### Product Module Contract

- Admin Settings is the operator-facing configuration surface for modules.
- It is **not** the source of truth for module definitions, tiers, or verification levels.
- The single source of truth is `src/config/product-modules/**`, and the human-readable matrix lives in `docs/guides/module-contract.md`.
- Inside that module contract, `settingKeys` are no longer hand-maintained. They are derived from the settings registry by `moduleId`.
- `general` is reserved for the Core Shell surface. Docs / Blog availability is site identity, not admin-editable runtime config.
- Header rows on `/admin/settings/<tab>` are a read-only projection of that module contract. A tab may project multiple owned/supporting modules.

## Related Files

- `src/request-proxy.ts` - Protected-route session cookie gate (`/admin`, `/settings`, `/activity`)
- `apps/web/src/routes/settings_.tsx` - User settings shell and canonical redirect
- `apps/web/src/routes/settings/**` - User settings routes
- `apps/web/src/routes/admin/$.tsx` - Admin catch-all route
- `src/server/admin/admin-route-resolver.ts` - Admin settings data/actions
- `src/domains/settings/registry.ts` - Settings registry aggregation + derived public/group indexes
- `src/domains/settings/application/settings-store.ts` - DB settings persistence and cache invalidation
- `src/domains/settings/application/settings-runtime.query.ts` - Server-side typed runtime settings readers
- `src/domains/settings/application/settings-runtime.builders.ts` - Closed typed runtime/public config builders

## How to Verify

- Visit `/<locale?>/settings` and confirm it redirects to `/<locale?>/settings/profile`.
- In user settings:
  - Update profile name/avatar; refresh and confirm persistence.
  - Create/edit/delete an API key; confirm list updates and deleted key disappears.
  - Open security page and confirm the reset button navigates to `/<locale?>/forgot-password`.
- In admin settings:
  - As a user without `admin.access` / settings permissions, confirm redirect/deny behavior.
  - Save a config and confirm the value takes effect where used (and tags revalidate).
