# Deployment Guide

Cloudflare Workers is the only supported production target. Local development
and production both use the TanStack Start application; production bundles it
with Vite and the Cloudflare plugin.

## Local development

```bash
pnpm dev:local
SITE=<site-key> pnpm dev
```

Use the Cloudflare local runtime when a flow needs Workers bindings:

```bash
SITE=dev-local pnpm test:cf-local-smoke
pnpm dev:ai-remover:cloudflare
```

## Site inputs

- `sites/<site-key>/site.config.json`: identity and capabilities.
- `sites/<site-key>/deploy.settings.json`: active Worker topology and binding
  requirements.
- `sites/<site-key>/.env.local`: private local overrides.
- Cloudflare vars, secrets, R2, Hyperdrive, Durable Objects, and service
  bindings: deployed runtime inputs.

Existing Worker and resource names are external contracts. Do not rename them
as part of internal refactoring.

## Validation

Run with an explicit site:

```bash
SITE=dev-local pnpm site:contract
SITE=mp4-compressor pnpm site:gate
SITE=dev-local pnpm build
pnpm client:boundary
RESEND_API_KEY=ci-resend-api-key-not-for-production SITE=dev-local pnpm cf:check
pnpm cf:build:no-db --site=mp4-compressor
RESEND_API_KEY=ci-resend-api-key-not-for-production SITE=dev-local pnpm cf:typegen:check
```

`cf:check` verifies the selected site's Worker set, required bindings, vars,
secrets, and Wrangler templates. `cf:build` builds
`dist/server/server.mjs` and `dist/client/**`, then performs scoped Worker
upload dry-runs. `cf:typegen:check` verifies the tracked Cloudflare
declarations.

## Runtime topology

The router Worker owns the custom-domain route and forwards to the active
server Workers through service bindings. Server Worker route families are
defined by `src/shared/config/cloudflare-worker-splits.ts`. State
infrastructure remains independently deployable.

Database-backed Workers use Hyperdrive. Upload storage uses
`APP_STORAGE_R2_BUCKET` plus `STORAGE_PUBLIC_BASE_URL`. Auth-enabled server
Workers share the same `BETTER_AUTH_SECRET` or `AUTH_SECRET`. Provider
secrets are required only by the Workers enabled for the selected site.

## Preview

Preview is a deploy profile, not a separate site:

```bash
SITE=<site-key> pnpm cf:preview:check
SITE=<site-key> pnpm cf:preview:build
SITE=<site-key> pnpm cf:preview:deploy:state
SITE=<site-key> pnpm cf:preview:bootstrap
SITE=<site-key> pnpm cf:preview:deploy
```

`cf:preview:bootstrap` creates missing preview router/server Workers. After the
first successful preview deployment, steady-state releases can run
`cf:preview:deploy` without bootstrapping again. The higher-level
`site:preview:doctor`, `site:preview:provision`, and `site:preview:deploy`
commands remain the preferred operator workflow.

## Production release

State and app deployments are separate:

```bash
SITE=<site-key> pnpm cf:deploy:state
SITE=<site-key> pnpm cf:deploy:app
```

The normal operator release entry is:

```bash
SITE=mamamiya pnpm release:cf
```

It validates release inputs, applies the governed migration/release sequence,
deploys the selected topology, and runs post-deploy checks. Ordinary build,
test, and CI commands never deploy.

Store local release inputs in `sites/<site-key>/.env.local`. Database-backed
releases require separate `RELEASE_TEST_DATABASE_URL` and
`PRODUCTION_DATABASE_URL` values so pre-release verification cannot target the
production database.

## Failure handling

- Missing `SITE`: rerun with the intended site key.
- Missing binding/secret: fix the selected site's Cloudflare runtime inputs;
  do not add fallback code.
- Missing native artifact: run `SITE=<site-key> pnpm build`.
- Worker upload size failure: inspect the reported Worker bundle and route
  ownership; do not bypass the size gate.
- Typegen drift: run `SITE=<site-key> pnpm cf:typegen`, review the generated
  declaration, then rerun `cf:typegen:check`.
- Database schema drift: generate and commit a migration before release.

See
[Cloudflare Deployment Governance](../architecture/cloudflare-deployment-governance.md)
for ownership and change-control rules.
