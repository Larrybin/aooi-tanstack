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
- Product home locales are stricter than the existing product copy resolvers:
  `siteHomeContent[locale]` must exist before any product copy is resolved.
  Existing `content?.[locale] ?? content?.en` resolver behavior is not a
  publishing gate and must not be used to decide whether a localized product
  home can render.
- Home route data uses `readBuildPublicUiConfig`,
  `readBuildAuthUiSettings`, and `readBuildBillingUiSettings`; no hand-written
  public/auth/billing config snapshots are allowed.
- Product sites render serializable product home data through an explicit
  `variant: 'product'` route-data branch. The body, metadata, and product shell
  must come from the same localized product home copy.
- Generic landing messages remain only for `dev-local` and non-product sites.
  Product sites must not fall back to generic landing body or generic metadata.
- `text-to-speech-generator` and `mp4-compressor` currently publish only `en`.
  Localized product home success criteria apply only after content, manifest,
  and site config publish that locale.
- Product home React components used by TanStack routes must be closure-safe:
  no `next/*`, `next-intl/server`, `server-only`, `@/themes/**`, or `@/app/**`.
- No theme adapter, productLanding adapter, i18n compatibility layer, DB
  abstraction, or root runtime injection migration is included.

## Target Files

- `apps/web/src/routes/index.tsx`
- `apps/web/src/routes/$slug.tsx`
- `src/server/landing/home-route-data.ts`
- `src/server/landing/product-home-route-data.ts`
- `src/server/landing/home-route-resolver.ts`
- `src/surfaces/landing/home/home.data.ts`
- `src/surfaces/landing/home/home.seo.ts`
- `src/surfaces/landing/home/home.types.ts`
- `src/surfaces/landing/home/home.view.tsx`
- `src/surfaces/landing/home/product-home.view.tsx`
- `sites/dev-local/i18n/manifest.json`
- `scripts/validate-tanstack-native-migration.mjs`

## Success Criteria

- `/` renders home content directly.
- `/zh` and `/zh-TW` render home content through the root `$slug` dispatcher.
- `SITE=ai-remover` and `SITE=background-remover` render `/`, `/zh`, and `/ja`
  as `variant: 'product'` from `sites/<site>/content/home.<locale>.json`.
- `SITE=text-to-speech-generator` and `SITE=mp4-compressor` render `/` as
  product home and do not publish localized product home routes until their
  locale content and manifest entries exist.
- `/privacy-policy` and `/terms-of-service` still render default-locale slug
  pages through the same dispatcher.
- `/fr` reaches TanStack notFound.
- Default-locale canonical is `/`; non-default canonical URLs are locale
  prefixed.
- Missing loader data returns `noindex,nofollow` fallback head data.
- Route and surface closure do not import `next/*`, `next-intl`,
  `server-only`, `@/themes/**`, or `@/app/**`.
- No productLanding adapter, ReactNode serialization, theme adapter, or generic
  product renderer registry is introduced.

## Validation

```bash
SITE=dev-local pnpm test -- src/server/landing/home-route-data.server.test.ts
SITE=ai-remover pnpm test -- src/server/landing/home-route-data.server.test.ts
SITE=background-remover pnpm test -- src/server/landing/home-route-data.server.test.ts
SITE=text-to-speech-generator pnpm test -- src/server/landing/home-route-data.server.test.ts
SITE=mp4-compressor pnpm test -- src/server/landing/home-route-data.server.test.ts
node scripts/tanstack-gate-4-plan.mjs --check
SITE=dev-local pnpm tanstack:inventory
SITE=dev-local pnpm tanstack:validate
SITE=ai-remover pnpm tanstack:validate
SITE=background-remover pnpm tanstack:validate
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:build
SITE=dev-local pnpm check
SITE=dev-local pnpm build
git diff --check
```
