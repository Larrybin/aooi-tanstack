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
- `DATABASE_URL`: direct PostgreSQL connection string for the preview database.
  This is used only by local Drizzle migration commands.
- `PREVIEW_HYPERDRIVE_ID`: Cloudflare Hyperdrive config ID pointing at that
  preview database. This is a 32-character lowercase hex ID, not a database
  URL.
- `STORAGE_PUBLIC_BASE_URL`: public base URL for objects in the preview storage
  bucket.

For a quick anonymous upload preview, payment and email secrets can use preview
placeholders. For OAuth, billing, or email testing, provide real preview secrets
instead.

## Cloudflare Resources

Create the preview R2 buckets:

```bash
wrangler r2 bucket create aooi-background-remover-preview-opennext-cache
wrangler r2 bucket create aooi-background-remover-preview-storage
```

Create a Cloudflare Hyperdrive config that points at the preview PostgreSQL
database, then keep the returned ID as `PREVIEW_HYPERDRIVE_ID`.

Cloudflare Images must be enabled for the account because the public-web worker
binds `IMAGES` and uses `segment=foreground`.

## Local Preview Env

Use `sites/background-remover/.env.local` for local preview operator variables.
The repo ignores `sites/*/.env.local`, and `run-with-site` loads the selected
site file for `SITE=background-remover` commands. Shell variables still take
precedence over values in this file.

```bash
cat > sites/background-remover/.env.local <<'ENV'
CF_WORKERS_DEV_SUBDOMAIN=replace_with_workers_dev_subdomain
DATABASE_URL=postgresql://preview-user:preview-password@preview-host:5432/preview-db
STORAGE_PUBLIC_BASE_URL=https://aooi-background-remover-preview-router.replace_with_workers_dev_subdomain.workers.dev/assets/
CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true
ENV
```

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

## Local Preview Overlay

Create the preview deploy overlay with the real Hyperdrive ID:

```bash
cat > sites/background-remover/deploy.preview.settings.json <<'JSON'
{
  "configVersion": 1,
  "resources": {
    "hyperdriveId": "replace_with_preview_hyperdrive_id"
  }
}
JSON
```

Replace `replace_with_preview_hyperdrive_id` before running checks or deploys.
Do not deploy with an all-zero or example Hyperdrive ID.
This file is not ignored by git. Commit it only when the Hyperdrive ID is the
shared team preview config; otherwise keep it as an unstaged local operator
file.

## Database Migration

Run migrations against the preview database. If `DATABASE_URL` is in
`sites/background-remover/.env.local`, this short command is enough:

```bash
SITE=background-remover pnpm db:migrate
```

Cloudflare Workers will use Hyperdrive at runtime; Drizzle CLI uses
`DATABASE_URL` locally.

## Preflight

Run the preview config gate before deploying:

```bash
SITE=background-remover pnpm cf:preview:check
```

Run the preview build gate:

```bash
SITE=background-remover pnpm cf:preview:build
```

## First Deploy

Deploy state first, then bootstrap the app workers:

```bash
SITE=background-remover pnpm cf:preview:deploy:state
```

```bash
SITE=background-remover pnpm cf:preview:bootstrap
```

The preview URL is:

```text
https://aooi-background-remover-preview-router.<CF_WORKERS_DEV_SUBDOMAIN>.workers.dev
```

## Later Updates

After the preview topology exists, deploy app updates with:

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
