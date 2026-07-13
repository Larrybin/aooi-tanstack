# API Reference

This document covers the API route patterns, common utilities, and available endpoints.

## Route Handler Patterns

### Standard Structure

Most API routes use the `withApi()` wrapper for consistent error handling.

Contract exceptions exist (for example `/api/auth/*` for Better Auth) where we intentionally bypass `withApi()` to preserve third-party semantics (redirects, cookies, status codes). These endpoints do not follow the `{code,message,data}` response envelope documented below.

```typescript
// apps/web/src/routes/api/example.ts
import { createFileRoute } from '@tanstack/react-router';

import { postExample } from '../../server/handlers/example';

export const Route = createFileRoute('/api/example')({
  server: {
    handlers: {
      POST: ({ request }) => postExample(request),
    },
  },
});
```

The assembled handler belongs in `apps/web/src/server/handlers/**`; reusable
request parsing and use-case logic belongs in `src/server/api/**`.

Route handlers are inbound adapters. They may parse HTTP bodies, enforce auth,
convert transport models to use-case inputs, and wrap responses. Business
rules, provider selection, repositories, pricing, credits, permission policy,
and settings interpretation belong in the owning domain application/domain
layers.

### Request Parsing

```typescript
import { z } from 'zod';

import { parseJson, parseParams, parseQuery } from '@/shared/lib/api/parse';

// Parse JSON body
const BodySchema = z.object({
  name: z.string(),
  amount: z.number(),
});
const body = await parseJson(req, BodySchema);

// Parse query parameters
const QuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
});
const query = parseQuery(req.url, QuerySchema);

// Parse route params
const ParamsSchema = z.object({
  id: z.string(),
});
const params = await parseParams(routeParams, ParamsSchema);
```

Notes:

- `parseJson()` enforces a default **1MB** request body limit and throws `PayloadTooLargeError` (HTTP 413) when exceeded.

### Response Helpers

```typescript
import { jsonCreated, jsonNoContent, jsonOk } from '@/shared/lib/api/response';

// 200 OK with data
return jsonOk({ user: userData });

// 201 Created
return jsonCreated({ id: newId });

// 204 No Content
return jsonNoContent();
```

### Error Handling

```typescript
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from '@/shared/lib/api/errors';

// 400 Bad Request
throw new BadRequestError('Invalid input');

// 401 Unauthorized
throw new UnauthorizedError('Not authenticated');

// 403 Forbidden
throw new ForbiddenError('Access denied');

// 404 Not Found
throw new NotFoundError('Resource not found');

// 422 Unprocessable Entity
throw new UnprocessableEntityError('Validation failed');
```

For shared service code used by both Route Handlers and Server Actions, you can also throw:

- `BusinessError` (`src/shared/lib/errors.ts`) → mapped to HTTP 400 with its `publicMessage`
- `ExternalError` (`src/shared/lib/errors.ts`) → mapped to its HTTP status with its `publicMessage`

## Authentication Guards

```typescript
import { requireUser } from '@/app/access-control/api-guard';

// Throws UnauthorizedError if not authenticated
// Also enforces CSRF check for cookie-based write requests.
const user = await requireUser(req);

// User object includes:
// - id: string
// - email: string
// - name: string
// - image?: string
```

Notes:

- This repo commonly uses `POST` for cookie-authenticated endpoints (even if read-only) so `requireUser()` can enforce same-origin checks for requests carrying cookies.
- For endpoints returning user-specific data, set `Cache-Control: no-store`.
- CSRF compares Origin/Referer host with `Host` (and the configured `APP_URL` host). When running behind a proxy/CDN, ensure forwarded headers are sanitized/owned by the edge.

## Available Endpoints

### Authentication

| Method     | Endpoint             | Description                                         |
| ---------- | -------------------- | --------------------------------------------------- |
| `GET/POST` | `/api/auth/[...all]` | Better Auth handler (signin, signup, signout, etc.) |

Notes:

- `/api/auth/[...all]` is a passthrough to Better Auth and does not use `withApi()`; response shape and errors are defined by Better Auth.
- Treat `/api/auth/**` as sensitive: do not cache it at the edge. The route sets `Cache-Control: no-store`.
- `/api/auth/**` is validated by the Cloudflare smoke chain (`SITE=<site-key> pnpm test:cf-local-smoke`, `SITE=<site-key> pnpm test:cf-app-smoke`).

### User

| Method | Endpoint                     | Description                                    |
| ------ | ---------------------------- | ---------------------------------------------- |
| `POST` | `/api/user/get-user-credits` | Get user credit balance                        |
| `POST` | `/api/user/self-details`     | Get the current user's public account snapshot |

`POST /api/user/get-user-credits` returns:

```json
{
  "remainingCredits": 123,
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

- `expiresAt`: the earliest expiration time among remaining credits; `null` when there is no expiring credit.

### Payment

| Method | Endpoint                | Description                               |
| ------ | ----------------------- | ----------------------------------------- |
| `POST` | `/api/payment/checkout` | Create checkout session                   |
| `GET`  | `/api/payment/callback` | Legacy: redirect-only checkout callback   |
| `POST` | `/api/payment/callback` | Finalize checkout (requires login + CSRF) |
| `POST` | `/api/payment/notify`   | Webhook notifications                     |

Notes:

- Current Cloudflare contract coverage is intentionally narrow: first-class webhook acceptance is gated around **Creem** signature verification plus duplicate-renewal idempotency (`pnpm test:creem-webhook-spike`).

#### Checkout Request

```typescript
// POST /api/payment/checkout
{
  "product_id": "pro_monthly",    // Required: Product ID from pricing
  "currency": "usd",               // Optional: Override currency
  "locale": "en",                  // Optional: Locale for callbacks (as-needed routing; non-default adds prefix; zh-CN -> zh)
  "metadata": {}                   // Optional: Custom metadata
}
```

#### Checkout Response

```typescript
{
  "code": 0,
  "data": {
    "sessionId": "cs_xxx",
    "checkoutUrl": "https://checkout.stripe.com/..."
  }
}
```

### Chat / AI

| Method | Endpoint                    | Description                  |
| ------ | --------------------------- | ---------------------------- |
| `POST` | `/api/chat`                 | Chat completion              |
| `POST` | `/api/chat/new`             | Create new chat              |
| `POST` | `/api/chat/list`            | List user chats              |
| `POST` | `/api/chat/info`            | Get chat info                |
| `POST` | `/api/chat/messages`        | Get chat messages            |
| `GET`  | `/api/ai/capabilities`      | Get enabled AI capabilities  |
| `POST` | `/api/ai/generate`          | AI generation                |
| `POST` | `/api/ai/query`             | AI query                     |
| `POST` | `/api/ai/notify/[provider]` | AI provider webhook callback |

Notes:

- `/api/chat` is an inbound adapter over `src/domains/chat/application/**`.
- Chat HTTP request/response schemas live under `src/shared/schemas/api/chat/**`; use-case inputs live in `src/domains/chat/application/**`.
- Model capability and provider enablement policy lives in `src/domains/ai/domain/**`, not in API routes or `shared/lib`.
- `/api/chat` consumes user credits per request; returns 403 when credits are insufficient; credits are refunded when the completion fails.
- `/api/ai/notify/[provider]` is covered by Cloudflare app smoke through `POST /api/ai/notify/test-provider`, which must return `{ code: 0, message: "ok", data: { ok: true } }`.

### Configuration

| Method     | Endpoint                  | Description        |
| ---------- | ------------------------- | ------------------ |
| `GET/POST` | `/api/config/get-configs` | Get public configs |

### Storage

| Method | Endpoint                    | Description                      |
| ------ | --------------------------- | -------------------------------- |
| `POST` | `/api/storage/upload-image` | Upload image to storage provider |

Notes:

- Current Cloudflare contract coverage is intentionally narrow: first-class upload acceptance is gated around the **R2** path (`pnpm test:r2-upload-spike`).

### AI Remover

These endpoints are active only for the `ai-remover` site target.

| Method     | Endpoint                         | Description                                     |
| ---------- | -------------------------------- | ----------------------------------------------- |
| `POST`     | `/api/remover/upload`            | Upload one original or mask image               |
| `POST`     | `/api/remover/jobs`              | Create or reuse a remover job                   |
| `GET`      | `/api/remover/jobs/[id]`         | Read and refresh a remover job                  |
| `GET/POST` | `/api/remover/download/low-res`  | Download the controlled low-res result          |
| `POST`     | `/api/remover/download/high-res` | Download the quota-gated high-res result        |
| `POST`     | `/api/remover/cleanup`           | Delete expired remover storage objects/metadata |

Notes:

- Use `SITE=ai-remover` for local build and Cloudflare checks.
- `POST /api/remover/upload` accepts exactly one `image` form file plus
  `kind=original|mask`. It validates the detected image bytes as JPG, PNG, or
  WebP before storing the object.
- `POST /api/remover/jobs` accepts `inputImageAssetId`, `maskImageAssetId`,
  and `idempotencyKey`; the route reserves processing quota and submits the
  configured remover provider job.
- `GET /api/remover/jobs/[id]` returns a public job DTO only. It does not
  expose provider task IDs, storage keys, or raw high-res output URLs.
- Low-res downloads remain available to the owning anonymous session or signed
  in user. High-res downloads require a signed-in user and consume
  `high_res_download` quota idempotently.
- `/my-images` is a page with server actions, not a REST API route.
- Runtime provider acceptance is gated by
  `SITE=ai-remover pnpm test:remover-workers-ai-spike`.

### Email

| Method | Endpoint                 | Description                                     |
| ------ | ------------------------ | ----------------------------------------------- |
| `POST` | `/api/email/send-email`  | Send email verification code                    |
| `POST` | `/api/email/verify-code` | Verify email verification code                  |
| `POST` | `/api/email/test`        | Send verification test email (admin-only, RBAC) |

### Documentation

| Method | Endpoint           | Description                  |
| ------ | ------------------ | ---------------------------- |
| `GET`  | `/api/docs/search` | Search documentation content |

## Response Format

This section applies to endpoints wrapped with `withApi()` (the standard JSON envelope).
Contract exceptions (e.g. Better Auth) may return a different response shape.

### Success Response

```typescript
{
  "code": 0,
  "message": "ok",
  "data": { /* response data */ }
}
```

### Error Response

```typescript
{
  "code": -1,
  "message": "Error description",
  "data": { /* optional details, often null */ }
}
// HTTP status code carries 4xx/5xx.
```

Notes:

- For 5xx upstream failures, prefer throwing `UpstreamError(502|503)` and keep client-facing messages generic (`bad gateway` / `service unavailable`). Use `x-request-id` + server logs for details.

## Request ID Tracking

All requests include `x-request-id` header for tracing:

```typescript
import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';

export const POST = withApi(async (req: Request) => {
  const { log, requestId } = getRequestLogger(req);

  log.info('Processing request', { userId: user.id });
  log.error('Something failed', { error });

  // requestId is automatically included in all logs
});
```

Server logging is owned by `src/infra/platform/logging/**`. Standard log meta:

- `requestId`
- `domain`
- `useCase`
- `operation`
- `route`
- `method`
- `actorUserId`

Use `getRequestLogger(req)` or `getRequestUseCaseLogger(req, ...)` at route
entrypoints. Use `createUseCaseLogger()` in server-side application,
platform, or adapter code. Client-safe request-id formatting lives in
`src/shared/lib/api/request-id.ts`.

## Router middleware

The Cloudflare router middleware (`cloudflare/workers/router-middleware.ts`) handles:

1. **Request ID injection** - Adds `x-request-id` to all requests
2. **Internationalization** - Resolves localized route forms
3. **Light auth check** - Checks session cookie for protected routes

Protected routes (`/admin`, `/settings`, `/activity`) require a session cookie. Full authentication is verified in the route handler.
For settings surfaces, see `docs/guides/settings.md`.

## Best Practices

1. **Prefer `withApi()`** - For consistent error handling and logging (except contract exceptions like Better Auth)
2. **Validate all inputs** - Use Zod schemas with parse helpers
3. **Use typed errors** - Throw specific error classes
4. **Log appropriately** - Use request logger for traceability
5. **Guard at entry** - Check auth/permissions at route entry
6. **Keep routes as adapters** - Convert HTTP input to domain application input; do not implement business policy in routes

## Related Files

- `src/shared/lib/api/route.ts` - `withApi()` wrapper
- `apps/web/src/server/api-context.ts` - API request context composition
- `src/domains/access-control/application/**` - Permission policy
- `src/shared/lib/api/parse.ts` - Request parsing
- `src/shared/lib/api/response.ts` - Response helpers
- `src/shared/lib/api/errors.ts` - Error classes
- `src/shared/lib/api/request-id.ts` - Client-safe request-id formatting
- `src/infra/platform/logging/request-logger.server.ts` - Server request logger
- `cloudflare/workers/router-middleware.ts` - Router middleware
