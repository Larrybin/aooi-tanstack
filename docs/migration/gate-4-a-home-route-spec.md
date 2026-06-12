# Gate 4-A Home Route Spec

## Scope

Migrate only the public home entrypoints to native TanStack routes:

- `/`
- localized single-segment homes such as `/zh` and `/zh-TW`

Legacy Next home files remain in place. This work does not migrate docs, auth,
member, admin, API routes, root runtime injections, sitemap, robots, or product
landing internals.

## Decisions

- `/` renders real home content with `defaultLocale`; it must not redirect to
  `/pricing`.
- Localized home entrypoints are handled by the existing root
  `apps/web/src/routes/$slug.tsx` single-segment dispatcher. It first attempts a
  published locale home, then falls back to the default-locale public slug page.
- Do not add a sibling root `/$locale` route while root `/$slug` exists. Loader
  `notFound()` is not route fallback, so two same-shape dynamic routes can make
  public slug pages unreachable.
- Locale publishing is strict. A localized home route renders only when
  `isPublishedLocaleForPath('/', locale)` is true. `dev-local` therefore keeps
  approved `home` entries for `zh` and `zh-TW`.
- Published locales without matching serializable home messages or product home
  data must return notFound rather than silently rendering English body copy.
- Home route data uses `readBuildPublicUiConfig`,
  `readBuildAuthUiSettings`, and `readBuildBillingUiSettings`; no hand-written
  public/auth/billing config snapshots are allowed.
- Product landing rendering is not adapted in this gate. Existing product
  landing metadata and header/footer may be reused, but the page body falls back
  to serializable landing messages unless a serializable product content API
  already exists.
- No theme adapter, productLanding adapter, i18n compatibility layer, DB
  abstraction, or root runtime injection migration is included.

## Target Files

- `apps/web/src/routes/index.tsx`
- `apps/web/src/routes/$slug.tsx`
- `src/server/landing/home-route-data.ts`
- `src/server/landing/home-route-resolver.ts`
- `src/surfaces/landing/home/home.data.ts`
- `src/surfaces/landing/home/home.seo.ts`
- `src/surfaces/landing/home/home.types.ts`
- `src/surfaces/landing/home/home.view.tsx`
- `sites/dev-local/i18n/manifest.json`
- `scripts/validate-tanstack-native-migration.mjs`

## Success Criteria

- `/` renders home content directly.
- `/zh` and `/zh-TW` render home content through the root `$slug` dispatcher.
- `/privacy-policy` and `/terms-of-service` still render default-locale slug
  pages through the same dispatcher.
- `/fr` reaches TanStack notFound.
- Default-locale canonical is `/`; non-default canonical URLs are locale
  prefixed.
- Missing loader data returns `noindex,nofollow` fallback head data.
- Route and surface closure do not import `next/*`, `next-intl`,
  `server-only`, `@/themes/**`, or `@/app/**`.

## Validation

```bash
SITE=dev-local pnpm test -- src/server/landing/home-route-data.server.test.ts
SITE=ai-remover pnpm test -- src/server/landing/home-route-data.server.test.ts
node scripts/tanstack-gate-4-plan.mjs --check
SITE=dev-local pnpm tanstack:inventory
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:build
SITE=dev-local pnpm check
SITE=dev-local pnpm build
git diff --check
```
