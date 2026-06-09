# Gate 3 Verification

Recorded on 2026-06-10 from branch `codex/tanstack-start-native-gate-0-3`.

## Required commands

```bash
SITE=dev-local pnpm tanstack:inventory
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:build
pnpm arch:check
pnpm lint
pnpm check
SITE=dev-local pnpm build
SITE=background-remover pnpm contract:check
SITE=background-remover pnpm cf:check
SITE=background-remover STORAGE_PUBLIC_BASE_URL=<url> AUTH_SECRET=<secret> BETTER_AUTH_SECRET=<secret> GOOGLE_CLIENT_ID=<id> GOOGLE_CLIENT_SECRET=<secret> RESEND_API_KEY=<secret> REMOVER_CLEANUP_SECRET=<secret> CREEM_API_KEY=<secret> CREEM_SIGNING_SECRET=<secret> pnpm cf:check
SITE=background-remover pnpm cf:build:no-db --site=background-remover
```

## Result

- Status: passed for local code gates. Cloudflare config verification is
  environment-sensitive: the bare command fails without required runtime vars,
  and the same config check passes when those vars are supplied.
- Passed:
  - `SITE=dev-local pnpm tanstack:inventory`
  - `SITE=dev-local pnpm tanstack:validate`
  - `SITE=dev-local pnpm tanstack:typecheck`
  - `SITE=dev-local pnpm tanstack:build`
  - built-server SSR smoke for `/en/pricing`
  - `pnpm arch:check`
  - `pnpm lint`
  - `pnpm check`
  - `SITE=dev-local pnpm build`
  - `SITE=background-remover pnpm contract:check`
  - `SITE=background-remover ...required runtime vars... pnpm cf:check`
  - `SITE=background-remover pnpm cf:build:no-db --site=background-remover`
- Blocked:
  - `SITE=background-remover pnpm cf:check` failed because
    `router.vars.STORAGE_PUBLIC_BASE_URL` is required as the R2 public asset
    base URL. This is expected unless the deploy runtime vars/secrets are
    supplied explicitly.

## SSR smoke

After `SITE=dev-local pnpm tanstack:build`, the built TanStack server was
loaded directly:

```bash
node - <<'NODE'
const mod = await import('./dist/server/server.mjs')
const response = await mod.default.fetch(new Request('http://localhost/en/pricing'))
console.log(response.status)
console.log((await response.text()).slice(0, 80))
NODE
```

Result: HTTP `200` with an HTML response prefix.

## Remaining real-environment E2E

- Payment checkout with sandbox provider secrets and a test user session.
- Payment notify idempotency with a signed sandbox webhook event.
- Credits read against a disposable authenticated test user.
