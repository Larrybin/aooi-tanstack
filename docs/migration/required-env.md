# Required Test Environment Variables

Real secrets must not be committed. Configure these in local test env, CI, or Cloudflare preview/test environment.

## Payment sandbox

- `PAYMENT_PROVIDER`
- `STRIPE_SECRET_KEY` or current provider sandbox secret
- `STRIPE_WEBHOOK_SECRET` or current provider webhook secret
- Provider-specific checkout/test mode variables used by aooi main

## Database

- `DATABASE_URL` pointing to a test database
- Any Cloudflare Hyperdrive/test database binding used by the selected deploy profile

## Storage

- Test R2 bucket / Images binding values required by current aooi storage code

## AI

- Test/low-cost AI provider key for future Gates

## Users

- Admin test user
- Member test user
- Optional anonymous test identity scenario

## Site

- `SITE=dev-local` unless a different test site is explicitly selected
- Matching `sites/<site>/site.config.json`
- Matching `sites/<site>/deploy.settings.json`
