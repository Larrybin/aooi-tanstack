# Site Instance Reference

Use this reference when creating or changing `sites/<site-key>`.

## Required Shape

Each site instance is selected by `SITE=<site-key>` and should keep these values aligned:

```text
sites/<site-key>/
sites/<site-key>/site.config.json      key must equal <site-key>
sites/<site-key>/deploy.settings.json
sites/<site-key>/deploy.preview.settings.json  only when workers.dev preview is needed
sites/<site-key>/.env.local            ignored local operator env
sites/<site-key>/content/pages/
```

`content/docs/` is required only when `capabilities.docs=true`.
`content/posts/` is required only when `capabilities.blog=true`.

## Site Identity

`site.config.json` is the build-time semantic source of truth.

Keep these fields real and site-specific:

```json
{
  "key": "my-site",
  "domain": "example.com",
  "brand": {
    "appName": "My Site",
    "appUrl": "https://example.com",
    "supportEmail": "support@example.com",
    "logo": "/logo.png",
    "favicon": "/favicon.ico",
    "previewImage": "/logo.png"
  },
  "capabilities": {
    "auth": true,
    "payment": "none",
    "ai": false,
    "docs": true,
    "blog": true
  },
  "configVersion": 1
}
```

Rules:

- `key` must match the directory and `SITE`.
- `domain` is the bare domain, without protocol.
- `brand.appUrl` is the canonical origin for metadata, sitemap, auth callbacks, and payment callbacks.
- `capabilities.payment` must be `none`, `stripe`, `creem`, or `paypal`.
- Do not store runtime secrets or provider keys in `site.config.json`.

## Deploy Settings

`deploy.settings.json` is the repo-controlled infra-only manifest.

It owns:

- Cloudflare worker names.
- R2 bucket names.
- Hyperdrive id.
- operator-declared binding requirements.

Recommended production names are explicit, site-scoped values:

```text
workers.router: aooi-<site-key>-router
workers.state: aooi-<site-key>-state
workers.public-web: aooi-<site-key>-public-web
workers.<slot>: aooi-<site-key>-<slot>
resources.appStorageBucket: aooi-<site-key>-storage
```

These names are not derived at production provision time. Production
provisioning reads `deploy.settings.json`; preview deployment derives
`aooi-<site-key>-preview-*` names from the real site key.
Use `SITE=<site-key> pnpm site:production:init-settings` to write these
recommended production names into `deploy.settings.json` during setup.

It must not own:

- brand identity.
- auth/payment/AI business settings.
- runtime feature flags.
- secret values.

Provider-specific runtime requirements are derived from `site.config.json.capabilities` and the deploy resolver. Do not manually add top-level provider fields to `deploy.settings.json`.

Production email provider requirements are derived from `site.config.json.capabilities.auth` only for the production deploy profile. Preview/local checks should not make `RESEND_API_KEY`, `CREEM_API_KEY`, or `CREEM_SIGNING_SECRET` hard blockers.

## Preview Deploy Settings

Workers.dev staging is a Cloudflare deploy profile for the real site, not a separate site instance. Use:

```bash
SITE=<site-key> CF_DEPLOY_PROFILE=preview pnpm cf:check
```

`sites/<site-key>/deploy.preview.settings.json` should contain only:

```json
{
  "configVersion": 1,
  "resources": {
    "hyperdriveId": "00000000000000000000000000000000"
  }
}
```

Preview worker names, bucket names, and router origin are derived by the deploy resolver. Do not copy production worker names into the preview file, and do not create a `<site-key>-preview` directory.

For operator setup, prefer:

```bash
SITE=<site-key> pnpm site:preview:doctor
SITE=<site-key> pnpm site:preview:provision
SITE=<site-key> pnpm site:preview:deploy
```

`site:preview:provision` creates preview R2 buckets and the Hyperdrive config,
then writes `deploy.preview.settings.json`. It does not create the external
PostgreSQL database.

## Site Operator Env

Use one ignored file for site-local operator values:

```text
sites/<site-key>/.env.local
```

Keep it sectioned instead of adding more env files:

```bash
# Common operator
CF_WORKERS_DEV_SUBDOMAIN=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# Local dev
DATABASE_PROVIDER=postgresql
DATABASE_URL=
BETTER_AUTH_SECRET=
AUTH_SECRET=

# Preview
PREVIEW_DATABASE_URL=
CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true

# Production release
RELEASE_TEST_DATABASE_URL=
PRODUCTION_DATABASE_URL=
PRODUCTION_STORAGE_PUBLIC_BASE_URL=
RESEND_API_KEY=
CREEM_API_KEY=
CREEM_SIGNING_SECRET=
```

Do not put `SITE`, Hyperdrive IDs, worker names, R2 bucket names, or preview
`STORAGE_PUBLIC_BASE_URL` in this file. Preview commands map
`PREVIEW_DATABASE_URL` to `DATABASE_URL` and derive the preview storage base URL
from `CF_WORKERS_DEV_SUBDOMAIN`. Production commands map
`PRODUCTION_DATABASE_URL` to `DATABASE_URL` and
`PRODUCTION_STORAGE_PUBLIC_BASE_URL` to `STORAGE_PUBLIC_BASE_URL`.

## Add-Site Flow

1. Copy or create `sites/<new-site>`.
2. Classify the product profile using `references/product-profiles.md`.
3. Immediately update `site.config.json.key`, domain, brand fields, and capabilities.
4. Update `deploy.settings.json` worker/resource names and binding requirements to match the profile.
5. Add minimal `content/pages`.
6. Add `content/docs/index.mdx` only if docs are enabled.
7. Add at least one `content/posts/*.mdx` only if blog is enabled.
8. Add `sites/<new-site>/.env.local` locally when local, preview, or release operator values are needed.
9. Run `SITE=<new-site> pnpm site:contract` before build/deploy checks.
10. Run `SITE=<new-site> pnpm site:production:init-settings` if the production deploy manifest should use the standard derived names.
11. Run `SITE=<new-site> pnpm site:production:doctor` before production setup or release checks.
12. Run `SITE=<new-site> pnpm site:production:provision` when production R2 buckets or a production Hyperdrive config need to be created.
13. Add `deploy.preview.settings.json` only if a workers.dev preview runtime is needed.
14. Run the site/config checks listed in the skill before production-like work.

Avoid fallback mappings, aliases, and compatibility wrappers. Direct convergence is preferred.
