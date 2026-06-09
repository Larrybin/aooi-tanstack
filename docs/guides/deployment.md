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
pnpm cf:build:no-db
pnpm cf:typegen
pnpm cf:typegen:check
```

`cf:typegen` writes the shared canonical Cloudflare type surface. It covers all
supported worker slots; site-specific sparse topology still controls actual
build, deploy, bindings, and routing.

GitHub Actions is the Cloudflare acceptance gate only. Production releases run
from a local operator session after the exact `main` commit has passed the
stable `cloudflare acceptance` summary in `Cloudflare Deploy Acceptance`.

That workflow keeps generic CI, schema migration guarding, Cloudflare
acceptance, and site-scoped contract checks separate. The heavy Cloudflare
matrix runs only for Cloudflare-relevant changes or manual dispatch, while the
required summary check always reports pass, skip, or failure. The Cloudflare
matrix runs `pnpm cf:check` and `pnpm cf:build:no-db --site=<site>` with direct
database URLs cleared, `DATABASE_PROVIDER=postgresql`, and CI-only placeholder
runtime bindings.

`pnpm cf:build:no-db` is the local probe for the same no-database build
contract. It runs the configured no-DB site matrix sequentially, clears
`DATABASE_URL` and `AUTH_SPIKE_DATABASE_URL`, keeps
`DATABASE_PROVIDER=postgresql`, and supplies CI-only placeholder runtime
bindings for auth, storage, Creem, Google, OpenRouter, and AI Remover cleanup.
For free tool sites with auth, payment, AI, docs, blog, and Hyperdrive disabled,
the Cloudflare build temporarily prunes disabled SaaS route files during the
OpenNext build so `public-web` does not ship auth, member settings, admin,
docs/blog, or provider API artifacts. Source routes are restored immediately
after OpenNext finishes. It is not a production release command.

### Site Operator Env

Each site uses one ignored operator file for local, preview, and production
release values:

```bash
sites/<site-key>/.env.local
```

Do not commit this file. Keep `SITE=<site-key>` explicit in commands, and do
not put `SITE`, Hyperdrive IDs, worker names, R2 bucket names, or preview
`STORAGE_PUBLIC_BASE_URL` in env files. Hyperdrive IDs belong in
`deploy.settings.json` or, for sites with
`bindingRequirements.bindings.hyperdrive=true`, in
`deploy.preview.settings.json`; preview storage public URLs are derived from the
preview router origin.

Use named sections so one file stays readable:

```bash
# Common operator
CF_WORKERS_DEV_SUBDOMAIN=replace_with_workers_dev_subdomain
CLOUDFLARE_ACCOUNT_ID=replace_with_account_id
CLOUDFLARE_API_TOKEN=replace_with_api_token

# Local dev
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/site_local
BETTER_AUTH_SECRET=replace_with_local_or_release_auth_secret
AUTH_SECRET=replace_with_local_or_release_auth_secret

# Preview
PREVIEW_DATABASE_URL=postgresql://user:password@preview-db-host:5432/site_preview
CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true

# Production release
RELEASE_TEST_DATABASE_URL=postgresql://user:password@test-db-host:5432/site_release_test
PRODUCTION_DATABASE_URL=postgresql://user:password@prod-db-host:5432/site_prod
PRODUCTION_STORAGE_PUBLIC_BASE_URL=https://example.com/assets/
RESEND_API_KEY=replace_with_resend_key
CREEM_API_KEY=replace_with_creem_key
CREEM_SIGNING_SECRET=replace_with_creem_signing_secret
```

Profile mappings are automatic:

- `cf:preview:*` maps `PREVIEW_DATABASE_URL` to `DATABASE_URL`.
- `cf:preview:*` derives `STORAGE_PUBLIC_BASE_URL` from
  `CF_WORKERS_DEV_SUBDOMAIN`.
- Sites with `bindingRequirements.bindings.hyperdrive=false` skip
  `PREVIEW_DATABASE_URL`, `deploy.preview.settings.json`, `[[hyperdrive]]`, and
  preview `db:migrate`.
- `NODE_ENV=production` maps `PRODUCTION_DATABASE_URL` to `DATABASE_URL`.
- `NODE_ENV=production` maps `PRODUCTION_STORAGE_PUBLIC_BASE_URL` to
  `STORAGE_PUBLIC_BASE_URL`.
- Shell env values still win over `sites/<site-key>/.env.local`.

For a new production topology, provision Cloudflare resources before the first
release:

```bash
SITE=<site-key> pnpm site:production:init-settings
SITE=<site-key> pnpm site:production:doctor
SITE=<site-key> pnpm site:production:provision
```

`site:production:init-settings` writes the recommended production worker and R2
bucket names into `deploy.settings.json`. It does not contact Cloudflare and it
preserves the current production Hyperdrive ID.

`site:production:doctor` is read-only. It checks production operator env,
production R2 buckets, Hyperdrive accessibility, and configured production
workers.

`site:production:provision` creates the production R2 buckets declared in
`deploy.settings.json`. If `resources.hyperdriveId` is still a known
placeholder, it creates a Cloudflare Hyperdrive config from
`PRODUCTION_DATABASE_URL` and writes the returned ID back to
`sites/<site-key>/deploy.settings.json`. It does not create or select an
external PostgreSQL database, custom domain, DNS record, or Cloudflare secrets.
Commit the updated `deploy.settings.json` before running the strict production
release.

For an already initialized production topology, run the production release
explicitly:

```bash
SITE=mamamiya pnpm release:cf
```

The release command loads the selected site operator env, verifies
`HEAD == origin/main`,
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

Preview reuses `site.config.json` and `deploy.settings.json`. Sites with
`bindingRequirements.bindings.hyperdrive=true` also apply
`sites/<site-key>/deploy.preview.settings.json` for the preview Hyperdrive ID.
Worker and bucket names are derived automatically:

- workers: `aooi-<site-key>-preview-<slot>`
- buckets: `aooi-<site-key>-preview-opennext-cache` and
  `aooi-<site-key>-preview-storage`
- router origin:
  `https://aooi-<site-key>-preview-router.<CF_WORKERS_DEV_SUBDOMAIN>.workers.dev`

For Hyperdrive-enabled sites, the preview Hyperdrive value is not a database
URL. It is the Cloudflare Hyperdrive config ID that Wrangler binds as
`env.HYPERDRIVE`. Local Node.js migration commands still need a direct
PostgreSQL URL. Put that value in the `PREVIEW_DATABASE_URL` section of
`sites/<site-key>/.env.local`.

For Hyperdrive-enabled sites, `sites/<site-key>/deploy.preview.settings.json`
should contain only the preview Hyperdrive ID. Commit it only when it points at
the shared team preview Hyperdrive config. Keep personal one-off preview
overlays unstaged. No-DB sites with
`bindingRequirements.bindings.hyperdrive=false` do not need this file.

`.tmp/cloudflare.secrets.env` is generated by preview helpers, ignored by git,
and should not be edited by hand. Add real preview OAuth, email, billing,
cleanup, or provider secrets to `sites/<site-key>/.env.local` only when those
flows are being tested. Placeholder preview secrets are enough for anonymous
upload or basic topology smoke checks.

| Runtime / command                                       | Database configuration source                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `SITE=<site> pnpm dev`                                  | direct `DATABASE_URL` from local env files                       |
| `SITE=<site> pnpm db:migrate`                           | direct `DATABASE_URL` from env or shell                          |
| `CF_DEPLOY_PROFILE=preview SITE=<site> pnpm db:migrate` | `PREVIEW_DATABASE_URL` mapped to `DATABASE_URL`                  |
| `SITE=<site> pnpm cf:preview:*` with Hyperdrive enabled | `PREVIEW_DATABASE_URL` mapped to `DATABASE_URL`                  |
| `CF_DEPLOY_PROFILE=preview` with Hyperdrive enabled     | `deploy.preview.settings.json.resources.hyperdriveId`            |
| no-DB preview                                           | skips `PREVIEW_DATABASE_URL`, `db:migrate`, and `[[hyperdrive]]` |
| production Cloudflare deploy with Hyperdrive enabled    | `deploy.settings.json.resources.hyperdriveId`                    |

Use the site preview wrapper for operator-friendly setup:

```bash
SITE=<site-key> pnpm site:preview:doctor
SITE=<site-key> pnpm site:preview:provision
SITE=<site-key> pnpm site:preview:deploy
```

`site:preview:doctor` is read-only. It checks local operator env, preview R2
buckets, and the preview router worker; Hyperdrive checks run only when the site
enables the Hyperdrive binding. `site:preview:provision` creates missing preview
R2 buckets. For Hyperdrive-enabled sites it also creates a Cloudflare Hyperdrive
config from `PREVIEW_DATABASE_URL`, then writes
`sites/<site-key>/deploy.preview.settings.json`; it does not create or select an
external PostgreSQL database. `site:preview:deploy` runs preview migrations only
for Hyperdrive-enabled sites, then runs checks, build, state deploy, and app
bootstrap in sequence.

First preview deploy:

```bash
SITE=<site-key> pnpm cf:preview:deploy:state
SITE=<site-key> pnpm cf:preview:bootstrap
```

Later preview updates:

```bash
SITE=<site-key> pnpm cf:preview:deploy
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
SITE=mamamiya pnpm site:production:init-settings
SITE=mamamiya pnpm site:production:doctor
SITE=mamamiya pnpm site:production:provision
NODE_ENV=production SITE=mamamiya pnpm cf:check
NODE_ENV=production SITE=mamamiya pnpm cf:build
NODE_ENV=production SITE=mamamiya pnpm db:migrate
NODE_ENV=production SITE=mamamiya pnpm cf:deploy:state
NODE_ENV=production SITE=mamamiya pnpm cf:deploy
NODE_ENV=production SITE=mamamiya pnpm test:cf-app-smoke
```

After the first production topology is initialized, use
`SITE=mamamiya pnpm release:cf` for later production releases. After the smoke
passes, open the production domain and manually verify sign-up, sign-in,
sign-out, and one protected route redirect.
