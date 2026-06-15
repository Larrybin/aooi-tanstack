# Gate 5.4 Server-only Marker Removal

Status: active SPEC

## Goal

Remove non-`src/app/**` source-level `import 'server-only'` markers while preserving boundary safety through a static protected-module reachability checker.

## Non-goals

Gate 5.4 does not remove the `server-only` package, delete `src/app/**`, remove Next/OpenNext dependencies, change Cloudflare topology, or replace `next/cache`.

## Checkers

```bash
node scripts/check-gate-5-4-server-only-markers.mjs --report
node scripts/check-gate-5-4-server-only-markers.mjs
```

Protected manifest:

```text
scripts/gate-5-4-server-only-protected-files.mjs
```

`--report` mode reports marker count, protected module count, and reachability violations while source markers are still present.

Strict mode fails when:

- any non-app source-level exact `import 'server-only'` / `import "server-only"` remains;
- any protected module is reachable from protected browser-capable entry roots;
- any marker exists outside the protected manifest.

## Protected module contract

The protected manifest contains the original 72 non-app source files that had `import 'server-only'` before Gate 5.4. After marker removal, these modules must remain unreachable from browser-capable entrypoints.

Forbidden entry roots include:

- files with `'use client'`;
- `apps/web/src/routes/**` excluding `apps/web/src/routes/api/**`;
- `src/surfaces/**/*.view.*` and shell view files;
- `src/shared/blocks/**`;
- `src/shared/components/**`;
- `src/domains/**/ui/**`.

The checker stops traversal at explicit server data boundaries such as `src/server/**` and `*.data.ts(x)`. Existing TanStack server data/resolver paths remain governed by `scripts/validate-tanstack-native-migration.mjs` and architecture checks.

Allowed server owners include:

- `apps/web/src/routes/api/**`;
- `apps/web/src/server/**`;
- `src/server/**`;
- `src/app/**` legacy baseline;
- domain `application` / `infra` paths;
- `src/infra/**`;
- `scripts/**` and `cloudflare/**`.

## Removal rule

Remove only exact marker lines:

```ts
import 'server-only';
import "server-only";
```

Do not alter business logic, signatures, imports, cache semantics, DB schema, or Cloudflare topology.

## Special cases

- `src/domains/settings/application/settings-store.ts`: remove only the marker; keep `next/cache` and `revalidateTag`.
- `src/shared/lib/next-cache.ts`: remove only the marker; keep `next/cache`.
- `src/shared/lib/action/with-action.ts`: remove only the marker; keep `next/headers`.
- `package.json`: keep `server-only` dependency until Gate 5.6.
- `vite.config.mts`: keep `server-only` alias until Gate 5.6.

## Required final validation

```bash
node scripts/check-gate-5-4-server-only-markers.mjs
node scripts/check-gate-5-3-non-app-next-deps.mjs
node scripts/check-gate-5-2-api-parity.mjs
SITE=dev-local pnpm arch:check
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm tanstack:build
```
