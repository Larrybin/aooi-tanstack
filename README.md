# Roller Rabbit

Production-ready multi-site SaaS foundation built with TanStack Start, Vite,
TypeScript, PostgreSQL, and Cloudflare Workers.

## Developer map

- `apps/web/src/routes/**`: TanStack page and API route entries. Keep these
  files limited to route metadata, params/search handling, loaders, head
  declarations, redirects/not-found, and assembled handlers.
- `apps/web/src/server/**`: Web-runtime composition and route handler wiring.
- `src/domains/**`: business rules, invariants, and application use cases.
- `src/surfaces/**`: framework-neutral page data, SEO, and view composition.
- `src/server/**`: reusable server actions and API handler factories.
- `src/infra/**`: platform services, runtime readers, and external adapters.
- `src/shared/**`: generic UI, utilities, schemas, and cross-cutting types.
- `src/testing/**`: test-only contracts and helpers; production code must not
  import this layer.
- `cloudflare/**`: router, server Worker, state Worker, and Wrangler contracts.
- `sites/**`: per-site identity, capabilities, deploy settings, i18n, and
  content.
- `scripts/**`: repository automation and release tooling.

See [Architecture Overview](docs/architecture/overview.md) and
[Module Contract](docs/guides/module-contract.md) before changing layer
boundaries or site capabilities.

## Quick start

Requirements: Node.js 20+, pnpm, and PostgreSQL for database-backed features.

```bash
pnpm install
cp .env.example .env.development
pnpm db:migrate
pnpm dev:local
```

Open <http://localhost:3000>. `pnpm dev:local` selects `SITE=dev-local` and
provides safe local fallbacks for auth and storage configuration. To run another
site:

```bash
SITE=ai-remover pnpm dev
```

Shell variables take precedence over `sites/<site-key>/.env.local`, which takes
precedence over root env files. Never commit secrets to site config, deploy
settings, pricing, i18n, or content files.

AI Remover's upload/remove/download flow requires Cloudflare bindings:

```bash
pnpm dev:ai-remover:cloudflare
```

## Commands

| Command                          | Purpose                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm dev`                       | Run the selected site with Vite                                                      |
| `pnpm dev:local`                 | Run the `dev-local` site                                                             |
| `SITE=<site> pnpm build`         | Build `dist/client/**` and `dist/server/server.mjs`                                  |
| `SITE=<site> pnpm start`         | Preview the production build                                                         |
| `pnpm typecheck`                 | Type-check root and Web sources                                                      |
| `pnpm lint`                      | Run ESLint and runtime-env guards                                                    |
| `pnpm test`                      | Run unit, contract, and smoke tests                                                  |
| `pnpm check`                     | Run lint, typecheck, and tests                                                       |
| `pnpm arch:check`                | Run dependency-graph and semantic architecture guards                                |
| `pnpm format:check`              | Verify Prettier formatting                                                           |
| `pnpm client:boundary`           | Check the built client bundle for server-only code                                   |
| `pnpm run ci`                    | Run the full repository gate with a `dev-local` build, architecture, and strict i18n |
| `SITE=<site> pnpm release:check` | Run CI plus Cloudflare release preflight                                             |
| `pnpm db:generate`               | Generate Drizzle migrations                                                          |
| `pnpm db:migrate`                | Apply Drizzle migrations                                                             |
| `pnpm db:studio`                 | Open Drizzle Studio                                                                  |

Site and Cloudflare commands require an explicit `SITE=<site-key>` unless the
script intentionally runs a matrix.

## Site contract

A site is selected from `sites/<site-key>/site.config.json` and exposed through
the generated `@/site` module. The site config owns brand identity and module
capabilities; `deploy.settings.json` owns Cloudflare topology and binding
requirements.

Runtime environment and secret names are governed by
[src/config/env-contract.ts](src/config/env-contract.ts). Existing
`NEXT_PUBLIC_*` keys remain part of the deployed external contract even though
the application no longer uses Next.js.

Use Admin Settings for non-secret operational values after the app is running.
Use env files and Cloudflare secrets for database URLs, auth secrets, OAuth
secrets, provider keys, storage URLs, and deploy credentials.

## Cloudflare

Cloudflare Workers is the only supported production target. The router forwards
requests to the active site-specific server Workers, which all load the native
TanStack server artifact.

```bash
RESEND_API_KEY=ci-resend-api-key-not-for-production SITE=dev-local pnpm cf:check
pnpm cf:build:no-db --site=mp4-compressor
RESEND_API_KEY=ci-resend-api-key-not-for-production SITE=dev-local pnpm cf:typegen:check
SITE=dev-local pnpm test:cf-local-smoke
```

Deployment remains explicit:

```bash
SITE=<site> pnpm release:cf
```

See [Deployment Guide](docs/guides/deployment.md) and
[Cloudflare Deployment Governance](docs/architecture/cloudflare-deployment-governance.md).

## Documentation

- [Development Guide](development.md)
- [Contributing](CONTRIBUTING.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Add Site](docs/guides/add-site.md)
- [Auth](docs/guides/auth.md)
- [Payment](docs/guides/payment.md)
- [Database](docs/guides/database.md)
- [RBAC](docs/guides/rbac.md)
- [Settings](docs/guides/settings.md)
- [Code Review](docs/CODE_REVIEW.md)
- [TanStack migration closeout](docs/archive/architecture/tanstack-migration-closeout.md)

Historical material under `docs/archive/**` and `.codex/plan/**` is not a
current engineering contract.

## CI guardrails

`pnpm run ci` is the canonical repository gate. Database schema changes must
include a committed migration. GitHub Actions are pinned to full commit SHAs
with their source tag in a comment; keep dependency review and Cloudflare
acceptance as required checks.

Production deployment, commit, and push are deliberate operator actions and are
not performed by repository checks.

### GitHub Actions is the Cloudflare acceptance gate, not the production deploy authority

Production release authority belongs to the local operator session.
