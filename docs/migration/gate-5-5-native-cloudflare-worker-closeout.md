# Gate 5.5 Native Cloudflare Worker Closeout

Status: complete

## Completed work

Gate 5.5 replaced the active Cloudflare/OpenNext worker topology with the current aooi TanStack native artifact contract:

```text
server: dist/server/server.mjs
assets: dist/client
```

Closed active paths:

- worker wrappers now import `dist/server/server.mjs`;
- root and server Wrangler assets point to `dist/client`;
- `cf:build` runs `pnpm exec vite build --config vite.config.mts`;
- `cf:build` no longer calls OpenNext or `scripts/bundle-cf-server-functions.mjs`;
- multi-worker dry-run checks the native artifact contract before Wrangler upload dry-runs;
- Cloudflare typegen is refreshed for the native router entry and Hyperdrive binding.

## Checker result

```text
native server artifact: dist/server/server.mjs present
native assets directory: dist/client present
active OpenNext runtime/build blockers: 0
active OpenNext config blockers: 0
deferred Gate 5.6 dependency residues: 26
```

Deferred residues are intentionally left for Gate 5.6:

- `@opennextjs/cloudflare` package dependency;
- `src/shared/types/open-next-generated.d.ts`;
- migration checker/inventory text that still mentions `.open-next`.

## Validation commands and results

```bash
SITE=dev-local pnpm tanstack:build
```

Result: passed.

```bash
node scripts/check-gate-5-5-native-cloudflare-topology.mjs
node scripts/check-gate-5-4-server-only-markers.mjs
node scripts/check-gate-5-3-non-app-next-deps.mjs
node ./scripts/check-gate-5-2-api-parity.mjs
```

Result: passed.

```bash
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm arch:check
```

Result: passed.

```bash
SITE=dev-local pnpm cf:typegen
SITE=dev-local pnpm cf:typegen:check
```

Result: passed.

```bash
STORAGE_PUBLIC_BASE_URL=https://assets.example.com/ SITE=mp4-compressor pnpm cf:check -- --workers=router,public-web
pnpm cf:build:no-db --site=mp4-compressor -- --workers=router,public-web
```

Result: passed. Dry-run upload gzip sizes:

```text
router: 91.63 KiB
public-web: 1503.43 KiB
```

## Known risks before Gate 5.6

- Do not delete `src/app/**` or Next/OpenNext package dependencies until Gate 5.6.
- `SITE=dev-local pnpm cf:check` still requires production-like runtime bindings such as `RESEND_API_KEY`; closeout Cloudflare structure validation used the supported no-db `mp4-compressor` path with explicit `STORAGE_PUBLIC_BASE_URL`.
- Existing R2 bucket names still contain `opennext-cache`; this is storage naming residue, not an active worker/build artifact path.
