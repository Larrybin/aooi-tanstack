# Gate 4 Foundation Verification

Recorded by Codex on `codex/gate-4-foundation-validation`.

This branch is the combined Gate 4 foundation baseline. It is not pure Gate
4-0, and it is not pure F1. It contains Gate 4-0 plus the merged F1/F2/F3
foundation train:

- F1 Surface Boundary Foundation.
- F2 Public Content Foundation.
- F3 Minimal Paraglide Foundation for new TanStack paths.

This remains a continuation of the original in-place migration. It does not
create a new repo, rewrite the app, delete the Next legacy baseline, migrate
API routes, or change database schema or migration history.

## Scope Boundary

- No new page migration was added by F1/F2/F3.
- Existing TanStack pricing route work remains part of the foundation baseline.
- Legacy Next routes remain under `src/app/**`.
- TanStack API routes are not migrated by this train.
- The next page migration retry is limited to Gate 4-A `/$locale/$slug`.
- Do not retry homepage, blog/docs, 4-B, 4-C, or 4-D until the slug route
  proves the foundation path.

## Foundation Contracts

- Gate 4 generated matrix freshness is enforced by `tanstack:validate`.
- `src/surfaces/**` must remain the TanStack-safe page dependency layer.
- Next-only helpers belong under app-private boundaries such as
  `src/app/_metadata/**` and `src/app/_admin-support/**`.
- TanStack page route closure must not import `src/app/**`, `@/app/**`,
  `src/legacy/**`, `next/*`, `next-intl`, `server-only`, or app-private
  helpers.
- TanStack API route closure is distinct from page closure: API routes still
  may reach existing `server-only` server action/domain code, but still must
  not reach Next or app-private helpers.
- Public content used by TanStack loaders must be generated as serializable
  data through `@/public-content`.
- New TanStack paths use the minimal Paraglide foundation and must not pull
  legacy `next-intl` into route closure.

## Foundation Components

- Surface taint audit: `docs/migration/gate-4-surface-taint-audit.md`.
- Boundary validator: `scripts/validate-tanstack-native-migration.mjs`.
- Public content generator: `scripts/generate-content-source-module.mjs` and
  `scripts/lib/public-content-manifest.mjs`.
- Public content alias: `@/public-content` to `.generated/public-content.ts`.
- Paraglide config: `project.inlang/settings.json`, `messages/**`, and
  `src/paraglide/**`.
- Not-found copy foundation: `src/shared/i18n/tanstack-paraglide.ts` and
  `src/surfaces/system/not-found/**`.

## Next Step

Create a clean branch from this reconciled foundation baseline for Gate 4-A
`/$locale/$slug`. Do not reuse older slug-migration branches without rebasing
and revalidating against this baseline.

## Verification

```bash
node scripts/tanstack-gate-4-plan.mjs --check
SITE=dev-local pnpm tanstack:inventory
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:build
SITE=dev-local pnpm check
SITE=dev-local pnpm build
```

## Result

The commands above are the required verification set for the reconciled
foundation baseline. Record command results in the reconciliation PR summary
instead of editing historical Gate 4-0 verification records.
