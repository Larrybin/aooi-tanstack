# Authentication Guide

This guide covers the authentication system built on [Better Auth](https://better-auth.com), a framework-agnostic authentication library for TypeScript.

## Architecture Overview

```
src/infra/platform/auth/
├── index.ts      # Dynamic auth entry point (runtime)
├── config.ts     # Auth configuration (static + dynamic)
└── client.ts     # Client-side auth utilities
```

### Key Design: Base/Dynamic Configuration Separation

The auth system separates configuration into two layers to avoid database calls during build time:

1. **Base Configuration** (`buildAuthOptionsBase()`): No database dependency, safe for build time
2. **Dynamic Configuration** (`getAuthOptions(request?)`): Loads typed auth UI settings plus server bindings at runtime and resolves request-aware auth origin

```typescript
// Base - used before DB access, no config table reads
function buildAuthOptionsBase() {
  return {
    appName: site.brand.appName,
    baseURL: runtimeEnv.authBaseUrl,
    secret: runtimeEnv.authSecret,
    // ...
  };
}

// Dynamic - used at runtime, fetches typed auth settings + server bindings
export async function getAuthOptions(request?: Request) {
  const authSettings = await readAuthUiRuntimeSettingsCached();
  const authBindings = getAuthServerBindings();
  return {
    ...buildAuthOptionsBase(),
    database: drizzleAdapter(db(), { provider: 'pg', schema }),
    socialProviders: await getSocialProviders({
      settings: authSettings,
      bindings: authBindings,
      authBaseUrl: runtimeBaseUrl,
    }),
    // ...
  };
}
```

## Server-Side Usage

### API Route Handler

The auth API is exposed via a catch-all route at `/api/auth/[...all]`:

Notes:

- This endpoint is a contract exception: it bypasses `withApi()` and does not return the standard `{code,message,data}` envelope (Better Auth controls redirects/cookies/status codes).
- The route is `force-dynamic`, and responses are marked `Cache-Control: no-store`.
- This route is exercised by the Cloudflare smoke chain (`SITE=<site-key> pnpm test:cf-local-smoke` and `SITE=<site-key> pnpm test:cf-app-smoke`).
- The local dual-runtime harness depends on a generated temporary Wrangler config whose `localConnectionString` points at a migrated Postgres instance. Every tracked Wrangler config must keep `localConnectionString = ""`.

```typescript
// src/app/api/auth/[...all]/route.ts
import { getAuth } from '@/infra/platform/auth';
import { toNextJsHandler } from 'better-auth/next-js';

import { setResponseHeader } from '@/shared/lib/api/response-headers';

export const dynamic = 'force-dynamic';

function withNoStore(response: Response): Response {
  return setResponseHeader(response, 'Cache-Control', 'no-store');
}

async function createHandler(request: Request) {
  const auth = await getAuth(request);
  return toNextJsHandler(auth.handler);
}

export async function POST(request: Request) {
  const handler = await createHandler(request);
  const response = await handler.POST(request);
  return withNoStore(response);
}

export async function GET(request: Request) {
  const handler = await createHandler(request);
  const response = await handler.GET(request);
  return withNoStore(response);
}
```

### Getting Auth Instance

Prefer `getAuth(request)` when a Request is available (enables per-request caching).
Otherwise `getAuth()` works too:

```typescript
import { getAuth } from '@/infra/platform/auth';

// In a Route Handler
const auth = await getAuth(request);
const session = await auth.api.getSession({ headers: request.headers });
```

## Client-Side Usage

### Basic Auth Client

```typescript
import {
  signIn,
  signOut,
  signUp,
  useSession,
} from '@/infra/platform/auth/client';

// Sign in with email/password
await signIn.email({ email, password });

// Sign up
await signUp.email({ email, password, name });

// Sign out
await signOut();

// React hook for session
const { data: session, isPending } = useSession();
```

### Auth Client with Dynamic Configs

For features like Google One Tap, use `getAuthClient()`:

```typescript
import { getAuthClient } from '@/infra/platform/auth/client';

// effective auth UI settings loaded on the server and passed to the client
const authClient = getAuthClient(authSettings);

// Now supports Google One Tap if configured
```

## Supported Authentication Methods

### Email/Password

Enabled by default. Can be toggled via database config:

| Config Key           | Value          | Description                |
| -------------------- | -------------- | -------------------------- |
| `email_auth_enabled` | `true`/`false` | Enable email/password auth |

### Social Providers

#### Google OAuth

| Config Key               | Description                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `google_auth_enabled`    | `true`/`false` — Explicitly enable Google OAuth (required to activate even if keys exist) |
| `google_one_tap_enabled` | Enable Google One Tap sign-in                                                             |

#### GitHub OAuth

| Config Key            | Description                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `github_auth_enabled` | `true`/`false` — Explicitly enable GitHub OAuth (required to activate even if keys exist) |

OAuth credentials 已移出 settings，统一来自 runtime bindings / secrets：

| Runtime Binding        | Description                |
| ---------------------- | -------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth Client ID     |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GITHUB_CLIENT_ID`     | GitHub OAuth Client ID     |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |

Auth UI 按 effective availability 展示：

- Google 按钮只看 `google_auth_enabled=true`。
- GitHub 按钮只看 `github_auth_enabled=true`。
- Google One Tap 只在 `google_auth_enabled=true`、`google_one_tap_enabled=true` 且当前 Auth UI worker 存在可用于前端的 `GOOGLE_CLIENT_ID` 时启用。
- OAuth callback / token exchange 仍只依赖 auth handler worker 上的 provider credentials。

## Environment Variables

### Required

| Variable                              | Description                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` or `AUTH_SECRET` | Secret key for signing tokens (required in production)                                             |
| `DATABASE_URL`                        | PostgreSQL connection string (required in production unless running in Cloudflare Workers runtime) |
| `BETTER_AUTH_URL` / `AUTH_URL`        | Optional same-origin auth mirrors; canonical base URL still derives from `site.brand.appUrl`       |

Auth base URL 必须是纯 origin（如 `https://app.example.com`），不支持带路径/查询；生产环境缺失或无效会直接 fail-fast。

Notes:

- canonical auth base URL 由 `site.brand.appUrl` 决定。
- `BETTER_AUTH_URL` 和 `AUTH_URL` 只能作为同源镜像存在，不能指向另一个 auth 域名。
- auth secrets 与 OAuth credentials 只来自 runtime env / Cloudflare secrets，不来自 settings。
- 多 worker Cloudflare 拓扑下，普通 OAuth 按钮显示不再依赖当前页面 worker 是否持有 provider secret；只有 Google One Tap 需要 Auth UI worker 持有 `GOOGLE_CLIENT_ID`。
- 若部署在 Cloudflare Workers（`nodejs_compat`）并通过 Hyperdrive 提供连接串，则 `DATABASE_URL` 可为空；非 Workers 运行时生产环境仍要求 `DATABASE_URL`。
- 本地 Cloudflare smoke 默认要求显式 `DATABASE_URL` 来生成临时 Wrangler config；仓库根 `.dev.vars` 只允许非数据库的运行时键，Wrangler 模板本身也不存储本地数据库连接串。
- CI 中的 `Cloudflare Deploy Acceptance` 已拆分为独立 jobs。`cloudflare-acceptance` matrix job 不再启动临时 Postgres service，也不执行 `pnpm db:migrate`；它在清空直接数据库 URL 后运行 Cloudflare 检查和 `pnpm cf:build:no-db --site=<site>`。schema/migration 配对仍由独立 guard 负责，生产 migration 仍由本地 release 命令负责。
- `pnpm cf:check` 与 Cloudflare secrets 文件生成会基于 `sites/<site>/deploy.settings.json` 要求当前启用能力对应的 provider bindings。需要局部校验时使用 `pnpm cf:check -- --workers=state|app|all|<comma-list>`；secrets 文件生成必须显式传同样的 worker scope。
- `BETTER_AUTH_SECRET` / `AUTH_SECRET` 不属于 provider secrets；它们是 Next server runtime secret，只对当前站点 active topology 里的 server workers 必填，`state` worker 不消费它。

### Optional

| Variable              | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `BETTER_AUTH_URL`     | Optional same-origin override for auth base URL               |
| `AUTH_URL`            | Optional same-origin fallback when `BETTER_AUTH_URL` is unset |
| `NEXT_PUBLIC_APP_URL` | Generated infra field derived from `site.brand.appUrl`        |

## Database Schema

Better Auth uses the following tables (managed by Drizzle adapter):

- `user` - User accounts
- `session` - Active sessions
- `account` - OAuth provider accounts
- `verification` - Email verification tokens

## Trusted Origins

The auth system automatically trusts:

1. Your site identity URL (`site.brand.appUrl`) — normalized to a valid origin (`http`/`https` only, otherwise fail-fast in production)
2. Google accounts domain (`https://accounts.google.com`) for One Tap

If you serve the app from multiple origins (custom domains, preview URLs, reverse proxies), ensure the runtime origin matches `site.brand.appUrl` or extend `buildTrustedOrigins()` accordingly; otherwise requests may be incorrectly blocked (or allowed).

## Security Best Practices

1. **Always set `BETTER_AUTH_SECRET`** in production with a strong random value
2. **Always keep auth mirrors same-origin** (`BETTER_AUTH_URL`/`AUTH_URL`) with `site.brand.appUrl`; mismatches fail fast in production
3. **Never expose auth secrets** to client-side code
4. **Use HTTPS** in production for secure cookie transmission
5. **Reset password is rate-limited** (per-email sliding window; `5m` window, `3` attempts, `1` concurrent; shared across instances via Cloudflare Durable Object); excessive requests are throttled to protect outbound providers

## Password Reset

### UI Routes

- Request reset email: `/<locale?>/forgot-password`
- Set new password (from email link): `/<locale?>/reset-password?token=...`
- Settings entry: `/<locale?>/settings/security` links to `forgot-password` (reset email request)

### Availability

Password reset UI is only available when email/password auth is enabled:

- Enabled when `email_auth_enabled !== 'false'`, or when neither Google nor GitHub auth is enabled (fallback).
- When disabled, the UI shows a "Password reset is not available." message and does not send emails.

### Throttling (Send Reset Email)

The server throttles `sendResetPassword` per email to protect outbound providers:

- Window: 5 minutes
- Max attempts per window: 3
- Max concurrent in-flight: 1
- Storage: Cloudflare Durable Object throttle (shared across instances)

### Reset Link Errors

The reset page accepts query params:

- `token`: required (from email link)
- `error`: may be `INVALID_TOKEN`

## Session Helpers (Server Components)

Prefer `getSignedInUserIdentity()` / `getSignedInUserSnapshot()` in Server Components and server-only helpers:

```typescript
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';

const user = await getSignedInUserIdentity();
```

Related file: `src/shared/lib/auth-session.server.ts`

## Code Generation

If you need to regenerate Better Auth artifacts:

```bash
pnpm auth:generate
```

## Troubleshooting

### "Secret is not set" Error

```
AUTH_SECRET or BETTER_AUTH_SECRET must be set in production
```

**Solution**: Set `BETTER_AUTH_SECRET` in your environment variables with a strong random value (32+ characters).

### Session Not Persisting

**Possible causes**:

1. generated `NEXT_PUBLIC_APP_URL` doesn't match the actual domain
2. Cookies blocked by browser (check SameSite settings)
3. HTTPS required but running on HTTP

**Solution**: Verify current site identity and generated `NEXT_PUBLIC_APP_URL` match your deployment domain exactly, including protocol.

### OAuth Callback Fails

```
OAuth callback error: redirect_uri_mismatch
```

**Solution**:

1. Check OAuth provider settings for correct callback URL: `https://example.com/api/auth/callback/google`
2. Ensure `site.brand.appUrl` and generated `NEXT_PUBLIC_APP_URL` are consistent
3. Verify the auth handler worker has the required provider credentials:
   - Google: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
   - GitHub: `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`

### "Database connection failed" During Auth

**Solution**:

1. Verify `DATABASE_URL` is set correctly
2. Run `pnpm db:migrate` to apply migrations
3. Check database connectivity

### Google One Tap Not Working

**Possible causes**:

1. `google_one_tap_enabled` not set to `true` in database config
2. Missing `GOOGLE_CLIENT_ID` on the Auth UI worker runtime
3. Domain not verified in Google Cloud Console

**Solution**: Ensure Google auth setting is enabled, `google_one_tap_enabled=true`, and the Auth UI worker runtime has `GOOGLE_CLIENT_ID`.

## Related Files

- `src/infra/platform/auth/index.ts` - Auth entry point
- `src/infra/platform/auth/config.ts` - Configuration
- `src/infra/platform/auth/client.ts` - Client utilities
- `src/app/api/auth/[...all]/route.ts` - API route
- `src/shared/lib/api/guard.ts` - Auth guards for API routes
- `src/shared/lib/auth-session.server.ts` - Session helpers (`getSignedInUserIdentity` / `getSignedInUserSnapshot`)
- `src/infra/runtime/env.server.ts` - Server runtime env access (`authBaseUrl` / `authSecret`)
- `src/config/server-auth-base-url.ts` - Same-origin auth base URL normalization
