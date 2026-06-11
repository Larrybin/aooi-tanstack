# Gate 4-A Slug Verification

Recorded by Codex on `codex/gate-4-a-public-slug-route`.

## Scope

This branch migrates only the public dynamic slug page:

- Next source: `src/app/[locale]/(landing)/[slug]/page.tsx`
- TanStack route: `apps/web/src/routes/$locale/$slug.tsx`

No homepage, pricing layout, blog, docs, 4-B, 4-C, 4-D, API route, database,
or Next legacy baseline migration is included.

## Contracts

- The route file remains thin: params, loader, head, component, and
  TanStack `notFound()`.
- The route imports only slug surface helpers.
- The route does not import `next/*`, `next-intl`, `server-only`,
  `@/domains/**`, `@/themes/**`, or `@/app/**`.
- Page content comes from the generated serializable public content manifest.
- Legacy MDX React nodes are not reintroduced.
- The legacy Next page remains in place.

## Files

- `apps/web/src/routes/$locale/$slug.tsx`
- `src/server/landing/slug-route-data.ts`
- `src/surfaces/landing/slug/slug.data.ts`
- `src/surfaces/landing/slug/slug.seo.ts`
- `src/surfaces/landing/slug/slug.view.tsx`
- `src/surfaces/landing/slug/slug.types.ts`

## Verification

```bash
SITE=dev-local pnpm test -- src/server/landing/slug-route-data.test.ts
node scripts/tanstack-gate-4-plan.mjs --check
SITE=dev-local pnpm tanstack:inventory
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:build
SITE=dev-local pnpm check
SITE=dev-local pnpm build
```
