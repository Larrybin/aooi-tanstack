# Codex Prompt: Gate 4-0 Page Migration Plan

Base branch:

```txt
migration/tanstack-start-native
```

Create branch:

```txt
codex/gate-4-0-page-migration-plan
```

Goal:

Only implement Gate 4-0 planning and generated matrix tooling. Do not migrate page code.

Apply files:

- `scripts/tanstack-gate-4-plan.mjs`
- `docs/migration/gate-4-page-migration-plan.md`
- `docs/migration/gate-4-page-migration-plan.generated.md`
- `docs/migration/gate-4-0-verification.md`

Rules:

- Do not create new TanStack page routes.
- Do not modify `src/app/**` page/layout behavior.
- Do not migrate API routes.
- Do not change Cloudflare build internals.
- Do not delete Next.js/OpenNext.
- Do not change DB schema or migration history.
- Do not redesign UI, URLs, or SEO text.
- Generated file must be fresh via `node scripts/tanstack-gate-4-plan.mjs --check`.

Run:

```bash
node scripts/tanstack-gate-4-plan.mjs --check
SITE=dev-local pnpm tanstack:inventory
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:build
SITE=dev-local pnpm check
SITE=dev-local pnpm build
SITE=background-remover pnpm contract:check
SITE=background-remover pnpm cf:build:no-db --site=background-remover
```

Update `docs/migration/gate-4-0-verification.md` with real command results.
