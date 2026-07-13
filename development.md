# Development Guide

The repository has one application runtime: TanStack Start on Vite, deployed as
native Cloudflare Workers bundles. Product-module status is governed by
[Module Contract](docs/guides/module-contract.md).

## Local development

```bash
pnpm install
cp .env.example .env.development
pnpm db:migrate
pnpm dev:local
```

Use `SITE=<site-key> pnpm dev` for a non-default site. Root env files provide
repository defaults; `sites/<site-key>/.env.local` may override them for that
site; shell values always win.

Required database-backed local values normally include:

```dotenv
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/aooi
DB_SINGLETON_ENABLED=true
BETTER_AUTH_SECRET=replace-with-a-local-secret
AUTH_SECRET=replace-with-the-same-local-secret
```

Do not put database URLs in tracked Wrangler files. Cloudflare local tooling
writes temporary configs and uses Hyperdrive at runtime.

## Runtime structure

- `apps/web/src/routes/**` owns URL and HTTP method declarations.
- `apps/web/src/server/**` wires route handlers to runtime dependencies.
- `src/server/**` owns reusable server/API logic.
- `src/domains/**` owns business logic.
- `src/surfaces/**` owns page data, SEO, and view composition.
- `src/infra/**` owns platform and provider adapters.
- `cloudflare/**` owns Worker entrypoints and bindings.

Route files must not instantiate domain infra or provider adapters. Production
code under `src/**` and `cloudflare/**` must not import the Web entry layer.

## Build and validation

```bash
pnpm check
pnpm arch:check
pnpm format:check
SITE=dev-local pnpm build
pnpm client:boundary
pnpm i18n:check --strict
```

The root TypeScript config includes both `src/**` and `apps/web/src/**`.
Production artifacts are `dist/client/**` and
`dist/server/server.mjs`.

Use `pnpm run ci` for the complete repository gate. It runs the default check,
builds `dev-local`, checks the client boundary and architecture, then performs
strict i18n validation.

## Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:check
pnpm db:studio
```

`DATABASE_PROVIDER` supports PostgreSQL. Cloudflare Workers access PostgreSQL
through Hyperdrive. Schema changes must include a generated migration and pass
the release-input guard.

## Authentication and RBAC

Generate a local auth secret, initialize permissions, and assign an admin:

```bash
openssl rand -base64 32
pnpm rbac:init
pnpm rbac:assign -- --email=admin@example.com --role=super_admin
```

OAuth callbacks use `https://<domain>/api/auth/callback/<provider>`. The same
`BETTER_AUTH_SECRET` or `AUTH_SECRET` value must be available to every active
server Worker that participates in auth.

## Configuration

Site identity and capabilities belong in
`sites/<site-key>/site.config.json`. Deployment topology and required bindings
belong in `sites/<site-key>/deploy.settings.json`. Runtime env access must go
through `src/config/env-contract.ts` and approved helpers.

Existing `NEXT_PUBLIC_*` keys are intentionally retained as external deployment
inputs. Do not introduce new framework compatibility keys.

## Cloudflare workflow

Cloudflare Workers is the only production deployment target.

```bash
RESEND_API_KEY=ci-resend-api-key-not-for-production SITE=dev-local pnpm cf:check
SITE=dev-local pnpm cf:build
pnpm cf:build:no-db --site=mp4-compressor
RESEND_API_KEY=ci-resend-api-key-not-for-production SITE=dev-local pnpm cf:typegen:check
SITE=dev-local pnpm test:cf-local-smoke
```

`pnpm cf:build` builds the native TanStack server artifact and validates each
active router/server Worker bundle. The canonical local smoke starts the
generated multi-Worker topology through Wrangler and tests the router origin.

Deployment commands are explicit and never part of ordinary validation:

```bash
SITE=<site-key> pnpm cf:deploy
SITE=<site-key> pnpm release:cf
```

Do not bypass `scripts/run-with-site.mjs` for normal workflows; it generates
the selected site module, content source, and active Worker contract.

## Site and product gates

```bash
SITE=dev-local pnpm site:contract
SITE=mp4-compressor pnpm site:gate
SITE=ai-remover pnpm contract:check
```

Use strict i18n checks whenever route-source configuration or localized assets
change. Do not change approved localized content as part of an infrastructure
cleanup.

## Further reading

- [Architecture Overview](docs/architecture/overview.md)
- [Runtime Boundary](docs/architecture/runtime-boundary.md)
- [Deployment Guide](docs/guides/deployment.md)
- [Database Guide](docs/guides/database.md)
- [Auth Guide](docs/guides/auth.md)
- [Payment Guide](docs/guides/payment.md)
