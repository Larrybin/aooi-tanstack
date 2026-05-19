# Deployment Guide

This repository uses Cloudflare Workers as the production deployment target.
Local development still uses the normal Next.js dev server.

## Deployment Contract

- Production deploy target: `DEPLOY_TARGET=cloudflare`.
- Production commands must pass the intended `SITE=<site-key>` explicitly.
- Site identity comes from `sites/<site>/site.config.json`.
- Deploy infrastructure input comes from `sites/<site>/deploy.settings.json`.
- Tracked Wrangler files are static templates. Generated site-specific configs
  are produced by the deploy scripts.
- Public, auth, and protected routes must run on the same canonical origin.
- Cross-origin cookie auth topology is unsupported.

The detailed governance rules live in
[docs/architecture/cloudflare-deployment-governance.md](../architecture/cloudflare-deployment-governance.md).

## Local Development

Use the local site with the Next.js dev server:

```bash
pnpm dev:local
```

This path does not require Wrangler login, R2 buckets, Hyperdrive, or local
multi-worker emulation.

Use `SITE=<site-key> pnpm dev` only when you need to run a different local site.

## Required Production Resources

Provision these before the first Cloudflare deploy:

- PostgreSQL database reachable from Cloudflare Hyperdrive
- Cloudflare zone for the production domain
- Hyperdrive instance pointing at the PostgreSQL database
- R2 buckets for OpenNext cache and app storage when storage is enabled
- Worker route or custom domain for the app origin

`site.brand.appUrl` is the canonical app/auth origin. `AUTH_URL` and
`BETTER_AUTH_URL` may only mirror that same origin.

## Cloudflare Topology

Production uses one public router Worker, one state Worker, and the canonical
server Workers:

```text
router
state
public-web
auth
payment
member
chat
admin
```

The resolver derives worker names, routes, buckets, Hyperdrive id, Durable Object
owner, and runtime bindings from the selected site config and deploy settings.
Do not hardcode site-specific names in scripts or source code.

## Secrets And Runtime Vars

Set at least one shared auth secret for the Next server workers:

```bash
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
```

`AUTH_SECRET` is supported as the paired compatibility key for the same shared
secret. Optional modules require their own provider secrets only when enabled
such as Resend, Stripe, Creem, OpenRouter, Replicate, Fal, Kie, or PayPal.

Storage-related runtime bindings:

- `NEXT_INC_CACHE_R2_BUCKET`: shared OpenNext ISR/data cache bucket
- `APP_STORAGE_R2_BUCKET`: business upload bucket
- `IMAGES`: router/public-web Cloudflare Images binding
- `STORAGE_PUBLIC_BASE_URL`: public base URL for uploaded assets

Do not put real database DSNs or secrets into tracked Wrangler templates.

## Build And Deploy Commands

Run cheap checks first:

```bash
SITE=<site-key> pnpm cf:check
SITE=<site-key> pnpm cf:build
SITE=<site-key> pnpm cf:typegen
SITE=<site-key> pnpm cf:typegen:check
```

GitHub Actions is the Cloudflare acceptance gate only. Production releases run
from a local operator session after the exact `main` commit has passed the
stable `cloudflare acceptance` summary in `Cloudflare Deploy Acceptance`.

That workflow keeps generic CI, schema migration guarding, Cloudflare
acceptance, and site-scoped contract checks separate. The heavy Cloudflare
matrix runs only for Cloudflare-relevant changes or manual dispatch, while the
required summary check always reports pass, skip, or failure. The Cloudflare
matrix job owns a migrated CI Postgres service before `pnpm cf:build` because
the current OpenNext build still prerenders pages that read runtime settings
from the `config` table.

Create a local `.env.production` file for production-only release inputs:

```bash
SITE=mamamiya
DATABASE_PROVIDER=postgresql
RELEASE_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/aooi_release_test
PRODUCTION_DATABASE_URL=postgresql://user:password@db-host:5432/aooi
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
STORAGE_PUBLIC_BASE_URL=https://assets.example.com/assets/
RESEND_API_KEY=...
BETTER_AUTH_SECRET=...
```

For an already initialized production topology, run the production release
explicitly:

```bash
SITE=mamamiya pnpm release:cf
```

The release command loads `.env.production`, verifies `HEAD == origin/main`,
requires a successful `Cloudflare Deploy Acceptance` run for the exact commit,
runs local gates with `RELEASE_TEST_DATABASE_URL`, migrates
`PRODUCTION_DATABASE_URL`, deploys state and app workers, and finishes with
`pnpm test:cf-app-smoke`.

Deploy order for a new or partially initialized environment:

```bash
SITE=<site-key> pnpm cf:deploy:state
SITE=<site-key> pnpm cf:deploy
```

`pnpm cf:deploy` is an alias for `pnpm cf:deploy:app`. App deploys do not
bootstrap missing state/router/server topology.

### Preview Profile

Preview is a Cloudflare deploy profile, not a separate site. Keep using the
real product `SITE=<site-key>` and set `CF_DEPLOY_PROFILE=preview` when you want
the same app topology on workers.dev instead of the production custom domain.

Preview reuses `site.config.json` and `deploy.settings.json`, then applies
`sites/<site-key>/deploy.preview.settings.json` for the preview Hyperdrive ID.
Worker and bucket names are derived automatically:

- workers: `aooi-<site-key>-preview-<slot>`
- buckets: `aooi-<site-key>-preview-opennext-cache` and
  `aooi-<site-key>-preview-storage`
- router origin:
  `https://aooi-<site-key>-preview-router.<CF_WORKERS_DEV_SUBDOMAIN>.workers.dev`

The preview Hyperdrive value is not a database URL. It is the Cloudflare
Hyperdrive config ID that Wrangler binds as `env.HYPERDRIVE`. Local Node.js
commands still use a direct PostgreSQL `DATABASE_URL` from `.env.development`,
`sites/<site-key>/.env.local`, or an explicit shell env.

| Runtime / command             | Database configuration source                         |
| ----------------------------- | ----------------------------------------------------- |
| `SITE=<site> pnpm dev`        | direct `DATABASE_URL` from local env files            |
| `SITE=<site> pnpm db:migrate` | direct `DATABASE_URL` from env or shell               |
| `CF_DEPLOY_PROFILE=preview`   | `deploy.preview.settings.json.resources.hyperdriveId` |
| production Cloudflare deploy  | `deploy.settings.json.resources.hyperdriveId`         |

First preview deploy:

```bash
SITE=<site-key> CF_WORKERS_DEV_SUBDOMAIN=<subdomain> CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true pnpm cf:preview:deploy:state
SITE=<site-key> CF_WORKERS_DEV_SUBDOMAIN=<subdomain> CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true pnpm cf:preview:bootstrap
```

Later preview updates:

```bash
SITE=<site-key> CF_WORKERS_DEV_SUBDOMAIN=<subdomain> pnpm cf:preview:deploy
```

`CF_DEPLOY_BOOTSTRAP_MISSING=true` is only valid for preview. Production keeps
the strict state-first, app-second release path and never bootstraps missing app
workers from `pnpm cf:deploy`.

## Migrations

Cloudflare Workers reads PostgreSQL through Hyperdrive at runtime, but schema
migrations still need direct database access:

```bash
DATABASE_URL="postgresql://user:password@db-host:5432/your_db" pnpm db:migrate
```

Any accepted change to `src/config/db/schema.ts` must include committed files
under `src/config/db/migrations/**`.

## Smoke Checks

Local Cloudflare diagnostics:

```bash
SITE=<site-key> pnpm test:cf-local-smoke
SITE=<site-key> pnpm test:cf-admin-settings-smoke
```

Production read-only smoke after deploy:

```bash
SITE=<site-key> pnpm test:cf-app-smoke
```

The production smoke validates public entry points, protected-route redirects
back to `/sign-in` on the same origin, config API, sitemap, and robots.

## First Deploy Checklist

Use this order for the first production deploy:

```bash
pnpm install
set -a
. ./.env.production
set +a
SITE=mamamiya pnpm cf:check
SITE=mamamiya pnpm cf:build
DATABASE_URL="$PRODUCTION_DATABASE_URL" SITE=mamamiya pnpm db:migrate
SITE=mamamiya pnpm cf:deploy:state
SITE=mamamiya pnpm cf:deploy
SITE=mamamiya pnpm test:cf-app-smoke
```

After the first production topology is initialized, use
`SITE=mamamiya pnpm release:cf` for later production releases. After the smoke
passes, open the production domain and manually verify sign-up, sign-in,
sign-out, and one protected route redirect.
