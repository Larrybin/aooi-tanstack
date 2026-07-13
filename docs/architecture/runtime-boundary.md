# Runtime Boundary

## Inputs

Runtime environment and secret names are defined by
`src/config/env-contract.ts`. Production runtime code reads them through
approved helpers, not direct `process.env` access. Existing
`NEXT_PUBLIC_*` names are retained only as deployed external inputs.

The generated `@/site` module is the only runtime source for site identity and
capabilities. Runtime code must not import `sites/**` directly.

## Web and server boundary

- `apps/web/src/routes/**`: inbound route declarations.
- `apps/web/src/server/**`: TanStack/Cloudflare composition.
- `src/server/**`: reusable server logic.
- `src/infra/runtime/**`: platform-neutral runtime readers.
- `cloudflare/workers/**`: Worker entrypoints and binding projection.

Routes call already assembled handlers. Handler composition owns domain infra,
provider adapters, runtime settings, and Cloudflare binding scope.

## Generated artifacts

- Site module: `.generated/site.ts`
- Content pointers: `.generated/content-source.ts` and
  `.generated/public-content.ts`
- Client bundle: `dist/client/**`
- Server bundle: `dist/server/server.mjs`
- Cloudflare type declarations: `src/shared/types/cloudflare.d.ts`

Build artifacts must not become ordinary source dependencies. Worker entries
load the native server artifact only at the explicit runtime boundary.

## Current examples

- AI composition: `apps/web/src/server/handlers/ai.ts`
- Payment composition: `apps/web/src/server/handlers/payment.ts`
- Remover API logic: `src/server/api/remover/**`
- Cloudflare binding scope: `apps/web/src/server/cloudflare-bindings.ts`
- Server Worker loader: `cloudflare/workers/create-server-worker.ts`
