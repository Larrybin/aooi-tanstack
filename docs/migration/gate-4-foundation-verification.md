# Gate 4 Foundation Verification

Recorded by Codex on `codex/gate-4-foundation-validation`.

Gate 4 foundation adds hard migration validation and the first shared surface
shape for already migrated TanStack pricing routes. It does not migrate any new
page.

## Files Changed

- `scripts/validate-tanstack-native-migration.mjs`
- `apps/web/src/routes/__root.tsx`
- `apps/web/src/routes/pricing.tsx`
- `apps/web/src/routes/$locale/pricing.tsx`
- `src/server/pricing/pricing-route-data.ts`
- `src/surfaces/landing/pricing/*`
- `src/surfaces/system/not-found/not-found.view.tsx`
- `tsconfig.tanstack.json`

## Contracts Added

- Gate 4 generated matrix freshness is enforced by `tanstack:validate`.
- `routeTree.gen.ts` imports, route ids, paths, and fullPath types must match route files.
- TanStack runtime closure must not import `src/app/**`, `src/themes/**`, `next/*`, `next-intl`, or legacy wrappers.
- Migrated page routes must use surface helpers and must not import domain UI directly.
- Pricing routes must throw TanStack `notFound()` for missing route data.
- Root route must use a shared `notFoundComponent`.
- TanStack typecheck now includes the landing pricing and system not-found surfaces.

## Verification

```bash
node scripts/tanstack-gate-4-plan.mjs --check
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:build
SITE=dev-local pnpm check
SITE=dev-local pnpm build
```

## Result

- `node scripts/tanstack-gate-4-plan.mjs --check`: passed.
- `SITE=dev-local pnpm tanstack:validate`: passed.
- `SITE=dev-local pnpm tanstack:typecheck`: passed.
- `SITE=dev-local pnpm tanstack:build`: passed.
- `SITE=dev-local pnpm check`: passed; 1114 tests and 61 server tests passed.
- `SITE=dev-local pnpm build`: passed.

## Notes

- `SITE=dev-local pnpm tanstack:build` emitted existing warnings only: proxy env detected and an ineffective dynamic import warning for request logging.
- `SITE=dev-local pnpm build` emitted the existing Next `middleware` deprecation warning.
