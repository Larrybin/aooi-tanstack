# Code Review Guide

Use this guide for TypeScript, React, TanStack Start, domain, and Cloudflare
changes.

## 1. Scope and simplicity

- Does the change solve the requested problem without speculative extension
  points, compatibility layers, or new configuration?
- Is obsolete code removed in the same change?
- Is readable local code preferred over an abstraction with one implementation?
- Are unrelated formatting and documentation changes avoided?

## 2. Route and architecture boundaries

- `apps/web/src/routes/**` contains only route declarations, params/search,
  loaders, head, redirects/not-found, and assembled handler calls.
- Domain infra, provider adapters, themes, and testing helpers are composed in
  `apps/web/src/server/**`, not route files.
- Reusable HTTP logic belongs in `src/server/api/**`.
- Page data, SEO, and view composition belong in `src/surfaces/**`.
- Business rules and invariants belong in `src/domains/**`.
- `src/**` and `cloudflare/**` do not import `apps/web/**`.
- Production code does not import `src/testing/**`.
- Shared code remains generic and does not absorb domain semantics.

Run `pnpm arch:check` for any boundary-sensitive change.

## 3. HTTP and security

- Validate body, query, params, and provider callbacks with explicit schemas.
- Authenticate and authorize at the inbound boundary.
- Preserve the public response schema and status/cookie/redirect semantics.
- Use typed public-safe errors; do not leak provider, database, stack, or secret
  details.
- State-changing same-origin requests retain CSRF/origin checks.
- Webhook signatures are verified before persistence or side effects.
- Payment and quota flows remain idempotent and audit failures.

## 4. Environment and site contracts

- Runtime env access goes through `src/config/env-contract.ts` and approved
  helpers.
- Site identity comes from `@/site`, never direct `sites/**` imports.
- Secrets stay out of site config, deploy settings, content, logs, and client
  bundles.
- Existing `NEXT_PUBLIC_*` and deployed Cloudflare resource names are external
  contracts; review any change to them as breaking.
- Site-scoped commands use an explicit `SITE=<site-key>`.

## 5. Cloudflare

- Router/server/state Worker ownership remains aligned with
  `src/shared/config/cloudflare-worker-splits.ts`.
- Server Workers load `dist/server/server.mjs` only at the explicit Worker
  boundary.
- Hyperdrive, R2, Durable Object, service binding, and secret requirements match
  the selected site's deploy settings.
- Cloudflare changes include `cf:check`, build, and typegen evidence.
- Validation does not silently deploy.

## 6. Data and migrations

- Schema changes include a generated migration.
- Transactions cover multi-write invariants.
- Retries and webhook replays are idempotent.
- Queries are bounded, indexed where necessary, and do not introduce N+1
  behavior.
- No startup instrumentation is used as a substitute for query-time validation.

## 7. UI and client boundary

- Route components consume surfaces and keep business logic out of rendering.
- Client code does not import server modules, provider implementations, or
  content pipeline internals.
- Accessibility, loading, empty, error, and responsive states are covered when
  behavior changes.
- A selected-site build followed by `pnpm client:boundary` passes.

## 8. Tests and documentation

- Tests cover changed behavior at the smallest useful level.
- Public HTTP, config, env, command, or architecture changes update current docs.
- i18n route-source/config changes preserve content hashes and approval status
  unless content itself changed.
- Historical files under `docs/archive/**` and `.codex/plan/**` are not used
  as current contracts.

## Review gate

Use the smallest relevant commands first, then the complete gate when handing
off:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm arch:check
pnpm format:check
SITE=dev-local pnpm build
pnpm client:boundary
pnpm i18n:check --strict
```
