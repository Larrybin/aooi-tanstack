# Gate 5.3 Non-app Next Dependency Replacement Closeout

Status: complete
Branch: `migration/tanstack-start-native`
PR: #172 `feat(tanstack): migrate Gate 5.2 API routes`

## Current PR state

Last checked during closeout:

```text
state: OPEN
isDraft: false
mergeStateStatus: CLEAN
headRefName: migration/tanstack-start-native
baseRefName: codex/gate-4-foundation-validation
```

## Completed work

### 5.3-A checker and classification

Added:

```text
scripts/check-gate-5-3-non-app-next-deps.mjs
docs/migration/gate-5-3-non-app-next-dependency-replacement.md
```

Checker modes:

```text
--report: reports classified hits and exits 0 when everything is classified, even if active_blocker exists.
strict/default: fails on active_blocker or unclassified.
```

The checker does not duplicate TanStack route closure graph checks. It only owns non-app import inventory and owner-gate classification.

### 5.3-B env loader replacement

Removed direct project-code imports of `@next/env` from:

```text
src/config/load-dotenv.ts
scripts/run-with-site.mjs
src/infra/adapters/db/config.ts
```

Added one shared core:

```text
src/config/load-dotenv-core.mjs
src/config/load-dotenv-core.d.ts
```

Added contract tests:

```text
tests/load-dotenv-contract.server.test.ts
```

Preserved contract:

```text
process.env values keep priority
.env.local effective priority remains higher than .env
mode-specific dotenv files are selected by NODE_ENV/dev mode
SITE overlay reads only sites/<SITE>/.env.local
sites/<SITE>/.env is not read
NEXT_RUNTIME disables script dotenv loading
scripts/run-with-site.mjs uses the shared dotenv core
```

### 5.3-C reusable primitive cleanup

No code changes were needed in this phase. After `@next/env` replacement, strict checker reported zero `active_blocker` hits. Legacy-only UI/provider residues remain classified and are still protected by the existing TanStack route closure validator.

## Classification summary

Closeout strict checker result:

```text
Gate 5.3 non-app Next dependency check passed.
```

Current classified counts:

```text
legacy_only: 70
defer_gate_5_4_server_only: 73
defer_gate_5_5_opennext_worker: 75
defer_gate_5_6_next_cache: 2
defer_gate_5_6_next_deletion: 4
active_blocker: 0
unclassified: 0
```

Representative deferred files:

| classification | representative files | owner gate | action |
| --- | --- | --- | --- |
| `legacy_only` | `src/middleware.ts`, `src/request-proxy.ts`, `src/themes/default/**`, `src/shared/blocks/**`, `src/domains/*/ui/**` | 5.6 or route-specific migration | keep classified |
| `defer_gate_5_4_server_only` | `src/domains/**/infra/**`, `src/infra/adapters/**/service.ts`, `src/shared/lib/api/parse.ts` | 5.4 | remove `server-only` markers only in server-only gate |
| `defer_gate_5_5_opennext_worker` | `cloudflare/workers/**`, `cloudflare/wrangler.server-*.toml`, `src/shared/config/cloudflare-worker-topology.ts` | 5.5 | replace OpenNext worker contract in dedicated gate |
| `defer_gate_5_6_next_cache` | `src/domains/settings/application/settings-store.ts`, `src/shared/lib/next-cache.ts` | 5.6/cache closeout | do not no-op cache invalidation in 5.3 |
| `defer_gate_5_6_next_deletion` | `package.json` Next package deps | 5.6 | remove only after src/app/worker gates close |

## Validation commands and results

```bash
pnpm test -- tests/load-dotenv-contract.server.test.ts
```

Result: passed.

```bash
node scripts/check-gate-5-3-non-app-next-deps.mjs
```

Result: passed.

```bash
node scripts/check-gate-5-2-api-parity.mjs
```

Result: passed.

```bash
SITE=dev-local pnpm arch:check
```

Result: passed.

```bash
env SITE=dev-local ./node_modules/.bin/tsc --noEmit --pretty false --incremental false --project tsconfig.tanstack.json
```

Result: passed.

```bash
pnpm tanstack:validate 2>&1 | tail -80
```

Result: passed.

```bash
pnpm tanstack:build 2>&1 | tail -80
```

Result: passed.

## Known risks before Gate 5.4

- `server-only` markers are intentionally untouched and classified for Gate 5.4.
- `settings-store.ts` still owns `next/cache` invalidation by architecture contract; do not replace it with a no-op.
- OpenNext worker topology remains unchanged and belongs to Gate 5.5.
- Package dependencies for Next, next-intl, @next/env, OpenNext, and server-only remain until Gate 5.6.
- Legacy-only UI/provider components still contain Next imports but are classified; active TanStack route reachability remains enforced by `scripts/validate-tanstack-native-migration.mjs`.

## Post Gate 5.4 classification update

Source-level `server-only` markers are handled by Gate 5.4. The remaining `package.json` dependency is classified as `defer_gate_5_6_next_deletion` and must not be removed before the final Next/OpenNext deletion gate.
