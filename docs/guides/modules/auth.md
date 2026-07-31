# Auth Module

## What This Module Does

Auth covers the mainline account lifecycle:

- email/password sign-up and sign-in
- password reset flow
- optional Google / GitHub social auth
- the supporting email tab used by auth-related email delivery

Detailed contract and runtime behavior live in [Authentication Guide](../auth.md).

## Required Configuration

- `email_auth_enabled`
- `google_auth_enabled`
- `google_one_tap_enabled`
- `github_auth_enabled`
- `resend_sender_email`

OAuth / Email secrets 已改为 runtime bindings，不再属于 settings：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `RESEND_API_KEY`

## External Services

- Better Auth
- Google OAuth
- GitHub OAuth
- Resend

## Minimum Verification Commands

- `pnpm test:auth-spike`
- `SITE=<site-key> pnpm site:gate -- --cloudflare`

## Common Failure Modes

- OAuth provider config exists but callback origin is wrong.
- settings 开启了 Google / GitHub，但对应 runtime bindings 不完整，前端入口会按 effective availability 自动隐藏。
- Email auth works locally but password-reset delivery fails because Resend is missing.
- Social auth buttons render, but provider-specific OAuth setup still depends on correct callback registration and environment parity.

## Product Impact If Disabled

You lose the default account lifecycle, which breaks the promised mainline sellable path.
