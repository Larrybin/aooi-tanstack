# Repository Conventions

## Routes

TanStack file routes live in `apps/web/src/routes/**`.

- Page routes declare path structure, params/search, loader, head, component,
  redirect, and not-found behavior.
- API routes map HTTP methods to already assembled handlers.
- Dependency composition belongs in `apps/web/src/server/**`.
- Reusable server actions and handler factories belong in `src/server/**`.
- Generated `apps/web/src/routeTree.gen.ts` is never edited manually.

Examples:

- Home: `apps/web/src/routes/index.tsx`
- Pricing: `apps/web/src/routes/pricing.tsx`
- Payment notify: `apps/web/src/routes/api/payment/notify.ts`
- Payment composition: `apps/web/src/server/handlers/payment.ts`

## Page surfaces and SEO

Framework-neutral page data, SEO models, and view composition live in
`src/surfaces/**`. Route `head` functions consume the surface head model.
Routes do not duplicate SEO, locale, or data-loading policy.

Robots and sitemap routes are
`apps/web/src/routes/robots[.]txt.ts` and
`apps/web/src/routes/sitemap[.]xml.ts`.

## API

Use Zod wire schemas from `src/shared/schemas/api/**`, request context from
`apps/web/src/server/api-context.ts`, and response/error helpers from
`src/shared/lib/api/**`. Business decisions remain in domains.

Better Auth routes are a deliberate response-envelope exception. Payment
callbacks and webhooks must preserve status, redirect, signature, and
idempotency contracts.

## Domains and infrastructure

- `src/domains/<domain>/domain/**`: entities, values, and invariants.
- `src/domains/<domain>/application/**`: use cases and read contracts.
- `src/domains/<domain>/infra/**`: domain persistence implementations.
- `src/infra/platform/**`: platform services.
- `src/infra/adapters/**`: third-party/provider adapters.
- `src/infra/runtime/**`: runtime readers and platform detection.

Do not create an interface for one implementation or move business code to
`shared` to avoid a local dependency.

## Configuration

- Site identity/capabilities: `sites/<site-key>/site.config.json`
- Deploy topology/bindings: `sites/<site-key>/deploy.settings.json`
- Runtime env allowlist: `src/config/env-contract.ts`
- Generated site input: `@/site`
- Generated content input: `@/content-source`

Existing `NEXT_PUBLIC_*` variables are retained external names. New runtime
code still reads them only through the env contract.

## Naming

- React components and types: PascalCase
- Variables and functions: camelCase
- Environment variables: UPPER_SNAKE_CASE
- Tests: `*.test.ts` / `*.test.tsx`
- Server-only reusable modules may use `*.server.ts` when the boundary is
  meaningful.

## Validation

`pnpm check` is the default local gate. Use `pnpm arch:check` for layering,
`SITE=dev-local pnpm build && pnpm client:boundary` for bundle changes, and
`pnpm i18n:check --strict` for i18n/config changes.

`pnpm conventions:draft` may generate a review draft; generated drafts are not
tracked engineering contracts.
