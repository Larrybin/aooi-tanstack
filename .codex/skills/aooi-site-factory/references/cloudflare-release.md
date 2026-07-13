# Cloudflare Release Reference

Use this reference when work touches Cloudflare deploy inputs, bindings, workers, runtime topology, smoke tests, or production release.

## Invariants

- Production-like commands must set `SITE=<site-key>` explicitly.
- `site.config.json` owns semantic site identity.
- `deploy.settings.json` owns infra-only deploy input.
- `deploy.preview.settings.json` owns only the preview Hyperdrive overlay.
- `sites/<site-key>/.env.local` owns ignored operator-local values for local dev, preview, and production release.
- Runtime code uses the generated `@/site` module.
- Cloudflare preview uses `CF_DEPLOY_PROFILE=preview` on the real product `SITE`; preview must not be modeled as a separate site.
- Do not put `SITE`, Hyperdrive IDs, worker names, R2 bucket names, or preview `STORAGE_PUBLIC_BASE_URL` in env files.
- Do not bypass `scripts/run-with-site.mjs` by calling low-level Vite or Wrangler commands directly unless you are debugging the wrapper itself.

## Verification Ladder

Start narrow and widen based on risk:

```bash
SITE=<site-key> pnpm cf:check
SITE=<site-key> pnpm cf:build
pnpm cf:build:no-db --site=<site-key>
SITE=<site-key> pnpm cf:typegen
SITE=<site-key> pnpm cf:typegen:check
SITE=<site-key> pnpm site:production:doctor
SITE=<site-key> pnpm site:preview:doctor
SITE=<site-key> pnpm cf:preview:check
SITE=<site-key> pnpm cf:preview:build
SITE=<site-key> pnpm test:cf-local-smoke
SITE=<site-key> pnpm test:cf-admin-settings-smoke
SITE=<site-key> pnpm test:cf-app-smoke
```

Use worker-scoped checks when appropriate:

```bash
SITE=<site-key> pnpm cf:check -- --workers=state
SITE=<site-key> pnpm cf:check -- --workers=app
SITE=<site-key> pnpm cf:check -- --workers=all
```

## Release Path

For workers.dev preview, use the preview wrappers:

```bash
SITE=<site-key> pnpm site:preview:doctor
SITE=<site-key> pnpm site:preview:provision
SITE=<site-key> pnpm site:preview:deploy
```

`site:preview:doctor` is read-only. `site:preview:provision` creates preview
R2 buckets and a Hyperdrive config from `PREVIEW_DATABASE_URL`, then writes the
preview overlay. `site:preview:deploy` runs migration, checks, build, state
deploy, and app bootstrap in sequence.

Use the low-level preview commands for focused debugging:

```bash
SITE=<site-key> pnpm cf:preview:deploy:state
SITE=<site-key> pnpm cf:preview:bootstrap
SITE=<site-key> pnpm cf:preview:deploy
```

Preview values come from `sites/<site-key>/.env.local`: `PREVIEW_DATABASE_URL` maps to `DATABASE_URL`, `CF_WORKERS_DEV_SUBDOMAIN` derives the preview `STORAGE_PUBLIC_BASE_URL`, and `CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true` enables placeholder preview secrets.

Preview/local checks warn on missing `RESEND_API_KEY`, `CREEM_API_KEY`, and `CREEM_SIGNING_SECRET`; do not treat them as production blockers during preview/spike work.

For first production resource setup, use:

```bash
SITE=<site-key> pnpm site:production:init-settings
SITE=<site-key> pnpm site:production:doctor
SITE=<site-key> pnpm site:production:provision
```

`site:production:init-settings` writes the recommended production worker and R2
bucket names into `deploy.settings.json`. It does not contact Cloudflare and it
preserves the current production Hyperdrive ID.

`site:production:doctor` is read-only. It checks production operator env,
production R2 buckets, Hyperdrive accessibility, and configured workers.

`site:production:provision` creates the production R2 buckets declared in
`deploy.settings.json`. If the production Hyperdrive ID is still a known
placeholder, it creates the
Hyperdrive config from `PRODUCTION_DATABASE_URL` and writes the real ID back to
`deploy.settings.json`. It does not create the external PostgreSQL database,
custom domain, DNS record, or Cloudflare secrets. Commit the updated
`deploy.settings.json` before the strict release path.

Production worker and bucket names are not derived at provisioning time. R2
buckets and Hyperdrive come from `deploy.settings.json.resources`; workers come
from `deploy.settings.json.workers` and are created or updated by
`cf:deploy:state` / `cf:deploy`.

For production release, use the repository release wrapper:

```bash
SITE=<site-key> pnpm release:cf
```

Production release values also come from `sites/<site-key>/.env.local`: `PRODUCTION_DATABASE_URL`, `RELEASE_TEST_DATABASE_URL`, and `PRODUCTION_STORAGE_PUBLIC_BASE_URL`. In production mode, `PRODUCTION_DATABASE_URL` maps to `DATABASE_URL` and the production storage value maps to `STORAGE_PUBLIC_BASE_URL`.

Run this only when production deployment is actually requested or approved. It is a mutating deploy flow.

## Common Failure Meaning

- Missing `SITE`: rerun with an explicit site key.
- Site key mismatch: align directory, `site.config.json.key`, and command `SITE`.
- Missing content directory: create required content or disable the corresponding capability.
- Missing docs index: add `content/docs/index.mdx` or disable docs.
- Missing posts: add at least one post or disable blog.
- Duplicate route pattern: give every production site a unique domain.
- Missing `CF_WORKERS_DEV_SUBDOMAIN`: set the workers.dev account subdomain in `sites/<site-key>/.env.local` when using preview commands.
- Missing preview deploy settings: add `sites/<site-key>/deploy.preview.settings.json` with only `resources.hyperdriveId`.
- Missing runtime binding: prepare local placeholders for checks or real Cloudflare secrets for production. In preview/local, missing Resend and Creem secrets should warn, not block.
- Need no-database deployability evidence: run `pnpm cf:build:no-db --site=<site-key>`. It is a build probe, not a release command.

## Completion

Do not call a site release-ready unless the relevant Cloudflare checks and smoke tests passed for the selected `SITE`. If a check was skipped, record why and what risk remains.
