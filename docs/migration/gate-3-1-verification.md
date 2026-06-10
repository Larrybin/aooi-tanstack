# Gate 3.1 Verification

Recorded on 2026-06-10 from branch
`codex/gate-3-1-tighten-slice-boundaries`.

Gate 3.1 tightens the Gate 0-3 TanStack vertical slice without changing the
final migration scope. It is still not Gate 7 and does not claim that all pages,
all APIs, Next.js, or OpenNext have been removed.

## Scope

- Keep the existing Next baseline intact.
- Keep TanStack routes native under `apps/web`.
- Remove duplicated HTTP orchestration from the TanStack API slice where a
  framework-neutral route action already exists.
- Keep business logic in existing domain/use-case modules and runtime bindings
  in the existing infra layer.
- Keep Cloudflare commands site-scoped.

## Changes Verified

- `/api/payment/checkout` now calls
  `createPaymentCheckoutPostAction(...)` from the existing shared route action
  instead of inlining checkout body parsing, pricing lookup, and HTTP error
  branching in the TanStack route file.
- `/api/payment/notify` now calls `buildPaymentNotifyPostLogic(...)` instead
  of rebuilding webhook settings, payment service, and notify flow wiring in
  the TanStack route file.
- `/api/user/get-user-credits` now shares
  `createUserCreditsPostAction(...)` between the legacy Next route and the
  TanStack route.
- `apps/web` disables the Next-only `@next/next/no-head-element` lint rule in
  ESLint configuration instead of carrying a Next lint directive inside a
  TanStack route file.
- `scripts/validate-tanstack-native-migration.mjs` now enforces the shared
  route action contracts for the Gate 0-3 API slice.

## Commands

```bash
node --test --import tsx src/app/api/payment/checkout/route.test.ts src/app/api/user/get-user-credits/action.test.ts
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:build
SITE=dev-local pnpm lint
pnpm arch:check
SITE=dev-local pnpm check
SITE=background-remover pnpm contract:check
SITE=background-remover STORAGE_PUBLIC_BASE_URL=<url> AUTH_SECRET=<secret> BETTER_AUTH_SECRET=<secret> GOOGLE_CLIENT_ID=<id> GOOGLE_CLIENT_SECRET=<secret> RESEND_API_KEY=<secret> REMOVER_CLEANUP_SECRET=<secret> CREEM_API_KEY=<secret> CREEM_SIGNING_SECRET=<secret> pnpm cf:check
SITE=background-remover pnpm cf:build:no-db --site=background-remover
```

## Result

- Status: passed for local code gates.
- `tanstack:build` still emits the existing proxy environment warning and the
  existing `INEFFECTIVE_DYNAMIC_IMPORT` warning for
  `request-logger.server.ts`.
- `cf:check` still requires the production runtime secrets/env values to be
  supplied explicitly.

## Remaining Real-Environment E2E

- Payment checkout with sandbox provider secrets and a test user session.
- Payment notify idempotency with a signed sandbox webhook event.
- Credits read against a disposable authenticated test user.
