# TODOs

## release:cf --trust-ci fast path

- **What:** Add an optional `pnpm release:cf --trust-ci` mode after the CI split is proven on `main`.
- **Why:** Strict `release:cf` currently re-runs lint, architecture checks, tests, Cloudflare config, and Cloudflare build after verifying the exact SHA already passed `Cloudflare Deploy Acceptance`. That is safe, but slow for routine releases.
- **Pros:** Keeps default release strict while giving the operator a faster path that still validates local release context.
- **Cons:** Adds release-script branching and must not weaken production deploy safety.
- **Context:** The fast path should still require clean `main`, `HEAD == origin/main`, a successful exact-SHA `Cloudflare Deploy Acceptance`, `check-release-inputs`, `cf:check`, `cf:build`, production `db:migrate`, state deploy, app deploy, and production smoke. Only lint, `arch:check`, and `pnpm test` should be skipped.
- **Depends on / blocked by:** Wait until the split `Cloudflare Deploy Acceptance` workflow is stable and branch protection requires the summary check.

## AI Remover preview follow-ups

- **What:** Add a separate anonymous remover limiter smoke.
- **Why:** Strict anonymous upload/job limits stay enabled to protect storage and Workers AI capacity. Release and preview remover smoke now require a seeded authenticated user with explicit test entitlements, so anonymous coverage should focus only on guest limiter behavior.
- **Context:** Keep `test:remover-workers-ai-spike` authenticated via `SMOKE_AUTH_REQUIRED=true`; add a dedicated guest limiter check instead of relaxing guest limits.

- **What:** Keep local preview deploy checks warning-only for missing `CREEM_*` / `RESEND_*` secrets.
- **Why:** Missing local payment/email secrets should not block AI Remover preview deploys when those flows are not under test.
- **Context:** Production must still require real Cloudflare secrets before checkout, webhook, password reset, or email verification acceptance.
