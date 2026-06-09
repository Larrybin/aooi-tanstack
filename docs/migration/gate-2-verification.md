# Gate 2 Verification

Recorded on 2026-06-10 from branch `codex/tanstack-start-native-gate-0-3`.

Vertical slice:

- `/$locale/pricing`
- `/api/payment/checkout`
- `/api/payment/notify`
- `/api/user/get-user-credits`

## Required checks

- Pricing route uses TanStack `createFileRoute`.
- Pricing route does not call legacy Next page.
- Checkout route is a TanStack server route and calls the existing payment checkout use case and provider bindings.
- Notify route is a TanStack server route and calls the existing webhook processing flow, inbox, order, subscription, and provider service dependencies.
- Credits route is a TanStack server route and reads credits through the existing account use case and credit repository.

## Result

- Status: code path verified
- Evidence:
  - `SITE=dev-local pnpm tanstack:validate` passed.
  - `SITE=dev-local pnpm tanstack:typecheck` passed.
  - `SITE=dev-local pnpm tanstack:build` passed.
  - SSR smoke against built `dist/server/server.mjs` for `/en/pricing` returned HTTP 200.
- Remaining real-environment work:
  - Payment checkout must still be exercised with sandbox provider secrets and a test user session.
  - Payment notify idempotency must still be exercised with a signed sandbox webhook event.
  - Credits read must still be exercised against a disposable authenticated test user.
