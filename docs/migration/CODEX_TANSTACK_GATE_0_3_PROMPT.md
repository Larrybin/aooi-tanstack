# Codex Prompt: Apply Gate 0-3 TanStack Native Overlay

You are applying a Gate 0-3 TanStack Start native migration overlay to aooi.

## Baseline

1. Do not use any previous hard migration zip as baseline.
2. Pull GitHub latest `main`.
3. Run main baseline first:

```bash
pnpm install
pnpm check
pnpm test
pnpm build
SITE=dev-local pnpm cf:check
SITE=background-remover pnpm cf:build:no-db --site=background-remover
SITE=background-remover pnpm contract:check
```

If main is not green, stop TanStack work and create a separate `baseline-fix` branch. Do not introduce TanStack until baseline is green.

## Apply overlay

After baseline is green, create or update `migration/tanstack-start-native`, apply the overlay files, and run:

```bash
pnpm install --lockfile-only --ignore-scripts
pnpm install
pnpm tanstack:inventory
pnpm tanstack:validate
pnpm tanstack:typecheck
pnpm tanstack:build
pnpm check
pnpm test
pnpm build
SITE=dev-local pnpm cf:check
SITE=background-remover pnpm cf:build:no-db --site=background-remover
SITE=background-remover pnpm contract:check
```

## Hard rules

- Do not lower the Cloudflare build contract.
- Do not change DB schema or migration history.
- Do not introduce `next-shims`.
- Do not wrap old Next pages with TanStack routes.
- Do not use `React.use(Promise.resolve(Page(...)))`.
- Do not use `params: Promise` in TanStack paths.
- Do not write module-global request state.
- Do not invent dependency versions.
- If the overlay violates SPEC, stop and report instead of patching on a bad baseline.

## Expected Gate 0-3 scope

Only the following native TanStack routes should exist as real implementations in Gate 0-3:

- `/$locale/pricing`
- `/api/payment/checkout`
- `/api/payment/notify`
- `/api/user/get-user-credits`

All other routes remain in the legacy Next baseline until later Gates.
