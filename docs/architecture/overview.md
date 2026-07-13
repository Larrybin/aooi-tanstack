# Architecture Overview

## Runtime

The repository has one Web runtime: TanStack Start on Vite. Cloudflare Workers
load the native server artifact at `dist/server/server.mjs`; browser assets are
emitted to `dist/client/**`.

```text
apps/web/src/routes  ->  apps/web/src/server  ->  src/server
          |                    |                    |
          v                    v                    v
     src/surfaces          src/domains          src/infra
          \____________________|____________________/
                               v
                           src/shared
```

## Layer ownership

### `apps/web/src/routes`

Owns URL structure, file-route declarations, params/search parsing, loaders,
head declarations, redirects/not-found, and HTTP method mapping. Route files
must not instantiate domain infra, provider adapters, themes, or testing
helpers.

### `apps/web/src/server`

Owns Web-runtime composition: Cloudflare binding scope, settings/runtime
readers, API context, and assembled route handlers. Provider and persistence
implementations may be wired here.

### `src/surfaces`

Owns framework-neutral page data, SEO models, and view composition. TanStack
routes consume surfaces instead of embedding page logic.

### `src/domains`

Owns domain semantics and application use cases. Domain code does not know
about routes or UI. Domain-layer code must not import surfaces, platform,
adapters, or HTTP schemas.

### `src/server`

Owns reusable API actions, handler factories, and server-side route logic. It
must not import `apps/web/**`.

### `src/infra`

Owns auth, database, logging, environment, Cloudflare runtime bridges, and
external provider adapters.

### `src/shared`

Owns generic UI primitives, utilities, wire schemas, and cross-cutting types.
It is not a holding area for business services.

### `src/testing`

Test-only contracts and helpers. Production code under `apps/web/src`,
`src/**`, and `cloudflare/**` must not depend on it.

## Persistent guards

- `pnpm arch:check` checks the dependency graph and semantic constraints.
- Generated `apps/web/src/routeTree.gen.ts` is excluded from graph traversal.
- Runtime packages and imports may not reintroduce Next.js, next-intl,
  OpenNext, or server-only.
- `src/**` and `cloudflare/**` may not depend on the Web entry layer.
- `pnpm client:boundary` ensures the built browser bundle does not contain
  server-only modules.
