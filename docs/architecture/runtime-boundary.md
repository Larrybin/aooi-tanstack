# Runtime Boundary

Cloudflare / Node platform branching is restricted to one canonical boundary under `src/shared/lib/runtime/**`.

Allowed modules:

- `runtime/env.server`
  - `getRuntimePlatform()`
  - `isCloudflareWorkersRuntime()`
  - `getCloudflareBindings()`
  - `getCloudflareAIBinding()`
- `runtime/request-body`
  - `readRequestTextWithLimit()`
  - `readRequestBodyByteCountUpTo()`
  - `readRequestFormData()`
- `runtime/crypto`
  - `signHmacSha256Hex()`
- `runtime/upload`
  - `readUploadRequestInput()`

## Rules

- Feature / route layers must not detect platform directly.
- Shared business services must not fork on Node vs Workers.
- Business runtime signing must not depend on `node:crypto`; use `runtime/crypto`.
- Cloudflare bindings must be read only through `runtime/env.server`.
- Request body / multipart access that exists because of runtime differences must go through `runtime/request-body` or `runtime/upload`.

## Allowed platform differences

Only these capability classes may differ by runtime:

- `env`
- `request-body`
- `crypto`
- `upload`

Anything else stays runtime-agnostic until a new boundary is explicitly introduced.

## Current callers

- `src/core/db/index.ts`
- `src/core/auth/config.ts`
- `src/shared/models/config.ts`
- `src/shared/lib/api/parse.ts`
- `src/app/api/ai/notify/[provider]/route.ts`
- `src/app/api/storage/upload-image/route.ts`
- `src/core/payment/providers/creem-webhook.ts`

## Removed paths

- `src/shared/lib/cloudflare-workers-env.server.ts`
- `src/shared/lib/api/request-body.ts`

Do not re-introduce compatibility aliases for those modules.
