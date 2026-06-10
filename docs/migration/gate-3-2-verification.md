# Gate 3.2 Verification

Recorded on 2026-06-10 from branch
`codex/gate-3-2-pricing-parity-http-composition`.

Gate 3.2 keeps the Gate 0-3 slice scope and does not start Gate 4 page
migration. It closes pricing parity and HTTP composition issues found after
Gate 3.1.

## Scope

- Keep the existing Next baseline intact.
- Keep TanStack routes native under `apps/web`.
- Move shared HTTP actions out of `src/app/api/**` into the neutral
  `src/server/api/**` composition layer.
- Render pricing FAQ and testimonials in the TanStack pricing view.
- Load pricing and landing messages from the same JSON message source used by
  the Next pricing page, without importing `next-intl` into TanStack paths.
- Add `/pricing` as the default-locale TanStack route so canonical URLs resolve
  to an implemented route.

## Changes Verified

- `/api/payment/checkout`, `/api/payment/notify`, and
  `/api/user/get-user-credits` now import shared HTTP composition from
  `src/server/api/**`.
- The old Gate 3.1 action files under `src/app/api/**` were removed instead of
  kept as re-export wrappers.
- `PricingSliceView` renders `faq` and `testimonials` content.
- `resolvePricingRouteData(...)` loads pricing and landing message JSON through
  a framework-neutral loader.
- `apps/web/src/routes/pricing.tsx` implements `/pricing` for the default
  locale.
- `scripts/validate-tanstack-native-migration.mjs` now rejects old
  `src/app/api/**` composition files, TanStack imports from `@/app/api/**`, and
  missing pricing FAQ/testimonials rendering.

## Commands

```bash
node --test --import tsx src/domains/pricing/application/pricing-page-messages.test.ts src/domains/pricing/ui/pricing-slice-view.test.tsx src/app/api/payment/checkout/route.test.ts src/app/api/user/get-user-credits/action.test.ts tests/contract/payment-notify-route.test.ts
SITE=dev-local pnpm tanstack:build
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm lint
pnpm arch:check
SITE=dev-local pnpm check
SITE=dev-local pnpm build
SITE=background-remover pnpm contract:check
SITE=background-remover STORAGE_PUBLIC_BASE_URL=<url> AUTH_SECRET=<secret> BETTER_AUTH_SECRET=<secret> GOOGLE_CLIENT_ID=<id> GOOGLE_CLIENT_SECRET=<secret> RESEND_API_KEY=<secret> REMOVER_CLEANUP_SECRET=<secret> CREEM_API_KEY=<secret> CREEM_SIGNING_SECRET=<secret> pnpm cf:check
SITE=background-remover pnpm cf:build:no-db --site=background-remover
```

## Result

- Status: passed for local code gates.
- `tanstack:build` still emits the existing proxy environment warning and the
  existing `INEFFECTIVE_DYNAMIC_IMPORT` warning for
  `request-logger.server.ts`.
- `cf:check` still requires production runtime secrets/env values to be
  supplied explicitly.

## Request Context Standard

Gate 3.2 does not expand `TanStackApiContext` beyond the fields needed by the
current slice: `log`, `parseJson`, and `requireUser`. Future Gate 5 API work may
extend request context only when a migrated API requires concrete request data
such as cookies, environment bindings, locale, site key, or anonymous identity.
Do not reintroduce module-global request state.

## Remaining Real-Environment E2E

- Payment checkout with sandbox provider secrets and a test user session.
- Payment notify idempotency with a signed sandbox webhook event.
- Credits read against a disposable authenticated test user.
