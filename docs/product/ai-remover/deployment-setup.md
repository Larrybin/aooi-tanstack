# AI Remover Deployment Setup

This guide separates the values needed for local development, production
deployment, Cloudflare runtime, and Admin Settings.

## Configuration Model

Use these boundaries:

| Layer                                   | Purpose                                            | Committed? | Examples                                                      |
| --------------------------------------- | -------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| `sites/ai-remover/site.config.json`     | Build-time site identity and capability flags      | Yes        | domain, app URL, support email, payment capability            |
| `sites/ai-remover/deploy.settings.json` | Cloudflare resource names and binding requirements | Yes        | worker names, R2 bucket names, Hyperdrive ID                  |
| `sites/ai-remover/.env.local`           | Local AI Remover runtime values                    | No         | local DB URL, local auth secret, local provider keys          |
| Cloudflare secrets / vars / bindings    | Production Worker runtime values                   | No         | OAuth secrets, Creem secrets, R2 bindings, Workers AI binding |
| `.env.production`                       | Local operator inputs for release commands         | No         | Cloudflare API token, production DB URL, release test DB URL  |
| Admin Settings                          | Non-secret operational switches and mappings       | Database   | Google auth enabled, Creem product mappings, sender email     |

Env, secrets, and bindings wire the app and carry credentials. Admin Settings
controls non-secret operational behavior after the app can already boot.

## Local Development

Create the site-local env file:

```bash
cp sites/ai-remover/.env.example sites/ai-remover/.env.local
```

`sites/ai-remover/.env.local` is ignored by Git. It is loaded only when you run
commands with `SITE=ai-remover`, and it overlays the root `.env.development`.

Minimum values for local database-backed development:

```bash
DATABASE_URL="postgresql://user:password@127.0.0.1:5432/ai_remover"
DATABASE_PROVIDER="postgresql"
DB_SINGLETON_ENABLED="true"
BETTER_AUTH_SECRET="use-a-generated-local-secret"
AUTH_SECRET="use-the-same-generated-local-secret"
```

Do not put a Cloudflare Hyperdrive ID in `sites/ai-remover/.env.local`.
That file is for local Node.js commands such as `SITE=ai-remover pnpm dev` and
`SITE=ai-remover pnpm db:migrate`, which need a direct PostgreSQL
`DATABASE_URL`. Hyperdrive is a Cloudflare Worker binding and is selected by
`deploy.settings.json` or `deploy.preview.settings.json` only when deployed to
Cloudflare.

Generate a local auth secret:

```bash
openssl rand -base64 32
```

Add these when testing the matching feature locally:

| Feature                   | Local env keys                             |
| ------------------------- | ------------------------------------------ |
| Google sign-in            | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Email delivery            | `RESEND_API_KEY` when testing email flows  |
| Creem checkout/webhook    | `CREEM_API_KEY`, `CREEM_SIGNING_SECRET`    |
| Storage URL generation    | `STORAGE_PUBLIC_BASE_URL`                  |
| Cleanup API               | `REMOVER_CLEANUP_SECRET`                   |
| Remover provider override | `REMOVER_AI_PROVIDER`, `REMOVER_AI_MODEL`  |

Default AI Remover provider values:

```bash
REMOVER_AI_PROVIDER="cloudflare-workers-ai"
REMOVER_AI_MODEL="@cf/runwayml/stable-diffusion-v1-5-inpainting"
```

The default provider expects Cloudflare R2 and Workers AI bindings at runtime.
Plain Next.js local dev can render pages and exercise database-backed flows, but
real upload / remove / download must use a Cloudflare runtime, preview, or
deployed environment.

Run local migrations:

```bash
SITE=ai-remover pnpm db:migrate
```

Run page-only local dev:

```bash
SITE=ai-remover pnpm dev
```

Run browser end-to-end local dev with R2 and Workers AI bindings:

```bash
SITE=ai-remover pnpm db:migrate
pnpm dev:ai-remover:cloudflare
```

Open the URL printed by the command, usually `http://localhost:8787`. Do not use
`http://localhost:3000` for the remover flow; that runtime has no
`APP_STORAGE_R2_BUCKET` or `AI` binding.

## Production Site Files

Before deploying, replace the placeholder identity in
`sites/ai-remover/site.config.json`:

```json
{
  "domain": "airemover.com",
  "brand": {
    "appUrl": "https://airemover.com",
    "supportEmail": "support@airemover.com"
  }
}
```

The Google OAuth origin, `AUTH_URL` / `BETTER_AUTH_URL` when used, and
`site.brand.appUrl` must share the same origin.

Update `sites/ai-remover/deploy.settings.json` for real production resources:

| Field                              | Production value                             |
| ---------------------------------- | -------------------------------------------- |
| `resources.incrementalCacheBucket` | R2 bucket for OpenNext cache                 |
| `resources.appStorageBucket`       | R2 bucket for uploaded/remover images        |
| `resources.hyperdriveId`           | Real Cloudflare Hyperdrive ID                |
| `workers.*`                        | Active worker names for this production site |

Do not put secrets, database URLs, or provider API keys in either site JSON
file.

`workers.chat` is intentionally absent for AI Remover. The product does not use
the shared OpenRouter chat runtime; image removal runs on `public-web` through
the Workers AI binding.

## Cloudflare Resources

Provision these before the first production deploy:

- Cloudflare zone and route/custom domain for `site.brand.appUrl`
- PostgreSQL database reachable from Cloudflare
- Cloudflare Hyperdrive pointing to the production PostgreSQL database
- R2 bucket for `resources.incrementalCacheBucket`
- R2 bucket for `resources.appStorageBucket`
- Public R2 custom domain or `r2.dev` URL for uploaded assets
- Cloudflare Images binding named `IMAGES`
- Cloudflare Workers AI binding named `AI`

`STORAGE_PUBLIC_BASE_URL` is the public URL prefix for objects stored in the app
storage bucket. Example:

```bash
STORAGE_PUBLIC_BASE_URL="https://assets.airemover.com/"
```

If an object key is `remover/jobs/job_123/thumbnail.webp`, the app derives:

```text
https://assets.airemover.com/remover/jobs/job_123/thumbnail.webp
```

The Worker reads and writes R2 through the `APP_STORAGE_R2_BUCKET` binding. It
does not use `CLOUDFLARE_API_TOKEN` at runtime.

## Production Runtime Secrets And Vars

Configure these in Cloudflare secrets / vars for the generated workers. They can
also be present in `.env.production` so local release commands can validate and
upload them.

| Name                                  | Kind        | Required for AI Remover?    | Notes                                                                                                               |
| ------------------------------------- | ----------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` or `AUTH_SECRET` | Secret      | Yes                         | Shared server auth/session secret. Set both to the same value unless there is a reason not to.                      |
| `GOOGLE_CLIENT_ID`                    | Secret/var  | Yes                         | Required because `googleOauth` is enabled in deploy settings.                                                       |
| `GOOGLE_CLIENT_SECRET`                | Secret      | Yes                         | Google OAuth server secret.                                                                                         |
| `RESEND_API_KEY`                      | Secret      | Production only             | Required by the production auth/email deploy contract when auth is enabled. Preview deploy does not require Resend. |
| `CREEM_API_KEY`                       | Secret      | Production checkout/webhook | Preview/local deploy checks warn when this is missing and leave the remote secret unchanged if present.             |
| `CREEM_SIGNING_SECRET`                | Secret      | Production checkout/webhook | Preview/local deploy checks warn when this is missing and leave the remote secret unchanged if present.             |
| `REMOVER_CLEANUP_SECRET`              | Secret      | Yes                         | Used by `/api/remover/cleanup` and the public-web cron.                                                             |
| `STORAGE_PUBLIC_BASE_URL`             | Runtime var | Yes                         | Public URL prefix for uploaded assets.                                                                              |
| `REMOVER_AI_PROVIDER`                 | Runtime var | Optional                    | Defaults to `cloudflare-workers-ai`.                                                                                |
| `REMOVER_AI_MODEL`                    | Runtime var | Optional                    | Defaults to `@cf/runwayml/stable-diffusion-v1-5-inpainting` for Workers AI.                                         |

Cloudflare multi-worker auth boundary:

- `public-web` renders `/sign-in`, `/sign-up`, and related auth entry pages.
- `auth` handles `/api/auth/**` and OAuth callback/token exchange.
- Google/GitHub button visibility follows Admin Settings, not whether the page worker holds provider secrets.
- Only Google One Tap needs `GOOGLE_CLIENT_ID` on the Auth UI worker.
- The auth handler worker still requires the full provider credentials.

For Google OAuth, configure the Google client with:

```text
Authorized JavaScript origin:
https://airemover.com

Authorized redirect URI:
https://airemover.com/api/auth/callback/google
```

Add `www` variants only if the app actually serves auth from `www`.

## Local Release Operator Env

`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are deploy operator
credentials. They are not runtime secrets and are not used by the website after
deployment.

Create a local `.env.production` for release commands:

```bash
SITE=ai-remover
DATABASE_PROVIDER=postgresql
RELEASE_TEST_DATABASE_URL="postgresql://user:password@127.0.0.1:5432/ai_remover_release_test"
PRODUCTION_DATABASE_URL="postgresql://user:password@prod-db-host:5432/ai_remover"

CLOUDFLARE_ACCOUNT_ID="..."
CLOUDFLARE_API_TOKEN="..."

STORAGE_PUBLIC_BASE_URL="https://assets.airemover.com/"
BETTER_AUTH_SECRET="..."
AUTH_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
RESEND_API_KEY="..."
CREEM_API_KEY="..."
CREEM_SIGNING_SECRET="..."
REMOVER_CLEANUP_SECRET="..."
```

Use a Cloudflare API token that can deploy Workers and manage the resources this
site uses. Keep it local to the operator environment.

## Admin Settings After Boot

After the app has a database and you can sign in as an admin, configure
non-secret settings in `/admin/settings/*`.

| Admin page                | Values                                                                |
| ------------------------- | --------------------------------------------------------------------- |
| `/admin/settings/auth`    | `email_auth_enabled`, `google_auth_enabled`, `google_one_tap_enabled` |
| `/admin/settings/payment` | `creem_environment`, `creem_product_ids`                              |
| `/admin/settings/email`   | `resend_sender_email`                                                 |
| `/admin/settings/ai`      | `general_ai_enabled`                                                  |
| `/admin/settings/general` | Runtime brand/support display values                                  |

For AI Remover pricing, `creem_product_ids` should map the site pricing product
IDs to real Creem product IDs:

```json
{
  "pro-monthly": "prod_...",
  "studio-monthly": "prod_..."
}
```

Do not store provider API keys, OAuth secrets, database URLs, Cloudflare API
tokens, or auth secrets in Admin Settings.

## Verification Order

Recommended local checks:

```bash
pnpm lint
pnpm test
SITE=ai-remover pnpm build
SITE=ai-remover STORAGE_PUBLIC_BASE_URL=https://assets.example.com BETTER_AUTH_SECRET=better-secret RESEND_API_KEY=resend-key GOOGLE_CLIENT_ID=google-id GOOGLE_CLIENT_SECRET=google-secret CREEM_API_KEY=creem-api-key CREEM_SIGNING_SECRET=creem-signing-secret REMOVER_CLEANUP_SECRET=cleanup-secret pnpm cf:check
```

Preview checks use the preview deploy profile. Missing local `RESEND_API_KEY`,
`CREEM_API_KEY`, and `CREEM_SIGNING_SECRET` are warnings, not blockers:

```bash
SITE=ai-remover CF_DEPLOY_PROFILE=preview CF_WORKERS_DEV_SUBDOMAIN=<subdomain> STORAGE_PUBLIC_BASE_URL=https://assets.example.com BETTER_AUTH_SECRET=better-secret GOOGLE_CLIENT_ID=google-id GOOGLE_CLIENT_SECRET=google-secret REMOVER_CLEANUP_SECRET=cleanup-secret pnpm cf:check
```

For production bootstrap:

```bash
SITE=ai-remover pnpm cf:deploy:state
SITE=ai-remover pnpm cf:deploy
```

For a real staging runtime on workers.dev, use the preview deploy profile.
Preview is not a separate `SITE`; it is `SITE=ai-remover` plus
`CF_DEPLOY_PROFILE=preview`.

Before the first preview deploy, replace
`sites/ai-remover/deploy.preview.settings.json` with the preview Hyperdrive ID.
The file intentionally contains only the preview Hyperdrive overlay; preview
worker names, R2 bucket names, and app origin are derived automatically.
This ID must be the Cloudflare Hyperdrive config ID, not the Supabase/Postgres
connection string. If you are using Supabase, create a Hyperdrive configuration
that points at the Supabase direct connection string, then copy the returned
32-character Hyperdrive ID into `deploy.preview.settings.json`.

Keep the split explicit:

| Environment                 | Config file                                     | Database value                           |
| --------------------------- | ----------------------------------------------- | ---------------------------------------- |
| Local dev / local migration | `sites/ai-remover/.env.local`                   | `DATABASE_URL=postgresql://...`          |
| Cloudflare preview          | `sites/ai-remover/deploy.preview.settings.json` | `resources.hyperdriveId=<preview ID>`    |
| Cloudflare production       | `sites/ai-remover/deploy.settings.json`         | `resources.hyperdriveId=<production ID>` |

First preview deploy:

```bash
SITE=ai-remover CF_WORKERS_DEV_SUBDOMAIN=<subdomain> CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true pnpm cf:preview:deploy:state
SITE=ai-remover CF_WORKERS_DEV_SUBDOMAIN=<subdomain> CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true pnpm cf:preview:bootstrap
```

Later preview updates:

```bash
SITE=ai-remover CF_WORKERS_DEV_SUBDOMAIN=<subdomain> pnpm cf:preview:deploy
```

`CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true` is only a deployment convenience for
missing staging secrets. OAuth, auth, payment, cleanup, and AI flows are not
accepted until their real staging values are configured. Email delivery itself
is not a preview deploy requirement; test password reset or email verification
only after configuring a real staging Resend key.

For later production releases, prefer:

```bash
SITE=ai-remover pnpm release:cf
```

After Cloudflare runtime is configured, run the real Workers AI remover spike:

```bash
SITE=ai-remover pnpm test:remover-workers-ai-spike
```

The Workers AI spike is an authenticated release/preview smoke. It requires
`SMOKE_AUTH_EMAIL` and `SMOKE_AUTH_PASSWORD` for a seeded user with an active
`preview` or production entitlement grant. `SMOKE_AUTH_ALLOW_SIGNUP` should stay
`false` for release validation.

Run the guest limiter smoke separately:

```bash
SITE=ai-remover pnpm test:remover-guest-limiter-smoke
```

This smoke keeps the user anonymous and verifies the upload and job limiters
return `429` after their configured guest thresholds. It does not submit a
Workers AI job.

Use `REMOVER_WORKERS_AI_SPIKE_BASE_URL` when testing against an already-running
preview or production URL.
