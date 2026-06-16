# Gate 5.4 Server-only Marker Removal Closeout

Status: complete
Branch: `migration/tanstack-start-native`
PR: #172 `feat(tanstack): migrate Gate 5.2 API routes`

## Current PR state

Last checked during closeout:

```text
state: OPEN
isDraft: false
mergeStateStatus: CLEAN
```

## Completed work

### Checker and protected manifest

Added:

```text
scripts/check-gate-5-4-server-only-markers.mjs
scripts/gate-5-4-server-only-protected-files.mjs
docs/migration/gate-5-4-server-only-marker-removal.md
```

The checker verifies:

- no non-`src/app/**` source marker imports remain;
- the original protected module manifest has 72 files;
- protected modules are not reachable from browser-capable client/surface/TanStack page entries outside explicit TanStack server-function boundaries;
- surface `*.data.ts(x)` and non-boundary `src/server/**` files are traversed by the checker;
- explicit TanStack server-function boundaries are reported by the checker;
- `package.json` `server-only` dependency is required until Gate 5.6;
- `vite.config.mts` `server-only` alias is allowed until Gate 5.6.

### Marker removal

Removed exact source marker lines only:

```text
import 'server-only';
import "server-only";
```

Batches completed:

```text
infra/platform/adapters: 20 files
domains/application/infra: 38 files
server/shared/extensions: 14 files
```

No business logic, function signatures, DB schema, auth, billing, quota, storage, email, AI, or Cloudflare topology was changed.

### Gate 5.3 classification update

Updated Gate 5.3 checker/docs so the remaining `package.json` `server-only` dependency is classified as:

```text
defer_gate_5_6_next_deletion
```

Source-level marker removal is now closed by Gate 5.4.

## Counts

```text
source marker count before: 72
source marker count after: 0
protected module count: 72
server boundary hit count: 62
reachability violation count: 0
server-only package dependency: dependencies
```

## Preserved boundaries

```text
package.json keeps server-only dependency until Gate 5.6
vite.config.mts keeps server-only alias until Gate 5.6
src/domains/settings/application/settings-store.ts keeps next/cache and revalidateTag
src/shared/lib/next-cache.ts keeps next/cache
src/shared/lib/action/with-action.ts keeps next/headers
src/app/** untouched
Cloudflare worker/OpenNext topology untouched
non-client src/themes/** and non-client extension server components remain legacy-only and are not in the Gate 5.4 reachability scope
```

## Validation commands and results

```bash
node scripts/check-gate-5-4-server-only-markers.mjs
```

Result: passed.

```bash
node scripts/check-gate-5-3-non-app-next-deps.mjs
```

Result: passed.

```bash
node ./scripts/check-gate-5-2-api-parity.mjs
```

Result: passed.

```bash
env SITE=dev-local sh -lc 'pnpm arch:check'
```

Result: passed.

```bash
env SITE=dev-local sh -lc 'pnpm tanstack:typecheck'
```

Result: passed.

```bash
env SITE=dev-local sh -lc 'pnpm tanstack:validate'
```

Result: passed.

```bash
SITE=dev-local pnpm tanstack:build
```

Result: passed.

## Known risks before Gate 5.5

- OpenNext worker topology still exists and belongs to Gate 5.5.
- Package dependencies for Next, next-intl, @next/env, @opennextjs/cloudflare, and server-only remain until Gate 5.6.
- `next/cache` and `next/headers` residues remain intentionally classified for later gates.
- Protected manifest must remain in place until final deletion gates provide equivalent executable boundary checks.
