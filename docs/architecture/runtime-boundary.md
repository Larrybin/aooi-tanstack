# Runtime Boundary

Cloudflare / Node platform branching is restricted to two narrow runtime
boundaries:

- `src/infra/runtime/**` for platform/env detection and Cloudflare bindings.
- `src/shared/lib/runtime/**` for pure request, crypto, and upload helpers.

Allowed modules:

- `src/infra/runtime/env.server`
  - `getRuntimePlatform()`
  - `isCloudflareWorkersRuntime()`
  - `getCloudflareBindings()`
  - `getCloudflareAIBinding()`
- `src/shared/lib/runtime/request-body`
  - `readRequestTextWithLimit()`
  - `readRequestBodyByteCountUpTo()`
  - `readRequestFormData()`
- `src/shared/lib/runtime/crypto`
  - `signHmacSha256Hex()`
- `src/shared/lib/runtime/upload`
  - `readUploadRequestInput()`

## Rules

- Feature / route layers must not detect platform directly.
- Shared business services must not fork on Node vs Workers.
- Business runtime signing must not depend on `node:crypto`; use `runtime/crypto`.
- Cloudflare bindings must be read only through `src/infra/runtime/env.server`.
- Request body / multipart access that exists because of runtime differences must go through `src/shared/lib/runtime/request-body` or `src/shared/lib/runtime/upload`.

## Allowed platform differences

Only these capability classes may differ by runtime:

- `env`
- `request-body`
- `crypto`
- `upload`

Anything else stays runtime-agnostic until a new boundary is explicitly introduced.

## Current callers

- `src/infra/adapters/db/index.ts`
- `src/infra/platform/auth/config.ts`
- `src/domains/settings/application/settings-store.ts`
- `src/shared/lib/api/parse.ts`
- `src/shared/lib/api/limiters-factory.ts`
- `src/app/api/ai/notify/[provider]/route.ts`
- `src/app/api/remover/provider-adapter.server.ts`
- `src/app/api/remover/upload/route.ts`
- `src/app/api/storage/upload-image/route.ts`
- `src/domains/billing/application/payment-notify-flow.ts`
- `src/infra/adapters/payment/creem-webhook.ts`
- `src/shared/platform/cloudflare/storage.ts`
- `src/shared/platform/cloudflare/stateful-limiters.ts`

## Removed paths

- `src/shared/lib/cloudflare-workers-env.server.ts`
- `src/shared/lib/api/request-body.ts`

Do not re-introduce compatibility aliases for those modules.
