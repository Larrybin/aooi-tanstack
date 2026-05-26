# Background Remover Preview Deployment

This runbook brings the `background-remover` site up on Cloudflare
workers.dev. Preview is not a separate site. Use the real site key with the
preview deploy profile.

```bash
SITE=background-remover
CF_DEPLOY_PROFILE=preview
```

## Required Values

Collect these before deploying:

- `CF_WORKERS_DEV_SUBDOMAIN`: the Cloudflare account workers.dev subdomain.
- `PREVIEW_DATABASE_URL`: direct PostgreSQL connection string for the preview
  database. This is used only by local Drizzle migration commands.
- `PREVIEW_HYPERDRIVE_ID`: Cloudflare Hyperdrive config ID pointing at that
  preview database. `SITE=background-remover pnpm site:preview:provision` can
  create this config and write the ID into the local preview overlay.

For a quick anonymous upload preview, payment and email secrets can use preview
placeholders. For OAuth, billing, or email testing, provide real preview secrets
instead.

## Local Preview Env

This site follows the all-site preview env governance in
[Deployment Guide](../../guides/deployment.md#site-operator-env). Keep local
operator values in `sites/background-remover/.env.local`; do not commit this
file, and keep `SITE=background-remover` explicit in each command.

```bash
cat > sites/background-remover/.env.local <<'ENV'
# Common operator
CF_WORKERS_DEV_SUBDOMAIN=replace_with_workers_dev_subdomain

# Local dev
DATABASE_PROVIDER=postgresql
DATABASE_URL=

# Preview
PREVIEW_DATABASE_URL=postgresql://preview-user:preview-password@preview-host:5432/preview-db
CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true
ENV
```

Preview commands map `PREVIEW_DATABASE_URL` to `DATABASE_URL` and derive
`STORAGE_PUBLIC_BASE_URL` from the preview router URL, so do not put preview
`STORAGE_PUBLIC_BASE_URL` in this file.

For anonymous upload testing, placeholder preview secrets are enough. For real
OAuth, email, or billing testing, add the real preview secrets to the same local
file:

```bash
BETTER_AUTH_SECRET=replace_with_preview_auth_secret
AUTH_SECRET=replace_with_preview_auth_secret
GOOGLE_CLIENT_ID=replace_with_google_client_id
GOOGLE_CLIENT_SECRET=replace_with_google_client_secret
REMOVER_CLEANUP_SECRET=replace_with_cleanup_secret
RESEND_API_KEY=replace_with_resend_key
CREEM_API_KEY=replace_with_creem_key
CREEM_SIGNING_SECRET=replace_with_creem_signing_secret
```

## Provision Preview Resources

After `.env.local` has `CF_WORKERS_DEV_SUBDOMAIN` and `PREVIEW_DATABASE_URL`,
run the read-only doctor:

```bash
SITE=background-remover pnpm site:preview:doctor
```

Then create missing preview R2 buckets and the Hyperdrive config:

```bash
SITE=background-remover pnpm site:preview:provision
```

Provision writes `sites/background-remover/deploy.preview.settings.json` with
only `resources.hyperdriveId`. This file is not ignored by git. Commit it only
when the Hyperdrive ID is the shared team preview config; otherwise keep it as
an unstaged local operator file.

Cloudflare Images must be enabled for the account because the public-web worker
binds `IMAGES` and uses `segment=foreground`.

## Deploy

Run the preview deploy wrapper:

```bash
SITE=background-remover pnpm site:preview:deploy
```

It runs the preview database migration, preview config check, preview build,
state worker deploy, and app bootstrap in sequence. Cloudflare Workers use
Hyperdrive at runtime; Drizzle CLI uses the direct preview database URL locally.

The preview URL is:

```text
https://aooi-background-remover-preview-router.<CF_WORKERS_DEV_SUBDOMAIN>.workers.dev
```

## Later Updates

After the preview topology exists, you can still use the lower-level app-only
update command when you do not need the full sequence:

```bash
SITE=background-remover pnpm cf:preview:deploy
```

## Smoke Test

Open the preview URL and run the product flow:

1. Upload a PNG, JPEG, or WebP image under the current plan size limit.
2. Confirm the result preview renders with a transparent checkerboard.
3. Download the PNG.
4. Verify the downloaded PNG has an alpha channel.
5. Confirm failed transforms do not create downloadable result files or consume
   committed quota.

Local offline Images binding support is not enough for this product smoke. Use
the deployed preview runtime to verify real `segment=foreground` output.
