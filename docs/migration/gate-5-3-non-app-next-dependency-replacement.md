# Gate 5.3 Non-app Next Dependency Replacement

Status: active SPEC

## Goal

Gate 5.3 makes non-`src/app/**` Next residues executable and classified before any Next/OpenNext deletion work. It does not delete `src/app/**`, remove packages, or change Cloudflare topology.

## Checker

Executable checker:

```bash
node scripts/check-gate-5-3-non-app-next-deps.mjs --report
node scripts/check-gate-5-3-non-app-next-deps.mjs
```

### Modes

`--report` mode:

- reports all classified non-app Next residues;
- exits 0 when every hit is classified, even if `active_blocker` exists;
- always fails on `unclassified` or invalid taxonomy.

Strict mode:

- fails on `active_blocker`;
- fails on `unclassified` or invalid taxonomy;
- allows `legacy_only` and `defer_*` residues.

The checker owns only non-app import inventory and owner-gate classification. TanStack route closure rules remain owned by `scripts/validate-tanstack-native-migration.mjs`.

## Classification taxonomy

| classification | meaning |
| --- | --- |
| `migrated` | already replaced or no longer a residue |
| `active_blocker` | must be fixed in Gate 5.3 |
| `legacy_only` | legacy-only surface; not active TanStack route closure |
| `defer_gate_5_4_server_only` | `server-only` marker; belongs to Gate 5.4 |
| `defer_gate_5_5_opennext_worker` | OpenNext / split worker topology; belongs to Gate 5.5 |
| `defer_gate_5_6_next_cache` | `next/cache` residue; deletion/cache replacement gate |
| `defer_gate_5_6_next_deletion` | package/legacy Next deletion residue; belongs to Gate 5.6 |

No `or` classifications are allowed.

## Env loader contract

Current direct `@next/env` users:

| file | classification | action |
| --- | --- | --- |
| `src/config/load-dotenv.ts` | `active_blocker` | replace with shared core |
| `scripts/run-with-site.mjs` | `active_blocker` | replace with shared core |
| `src/infra/adapters/db/config.ts` | `active_blocker` | replace with shared core |
| `package.json` | `defer_gate_5_6_next_deletion` | keep dependency until Gate 5.6 |

One shared core only:

```text
src/config/load-dotenv-core.mjs
```

Allowed wrappers:

```text
src/config/load-dotenv.ts
scripts/run-with-site.mjs
src/infra/adapters/db/config.ts
```

Required behavior:

- preserve current root env loading behavior;
- preserve existing `process.env` priority;
- preserve current `.env.local` effective priority;
- preserve production/non-production behavior;
- preserve `NEXT_RUNTIME` guard in `loadDotenvForScripts`;
- preserve `SITE` handling in `scripts/run-with-site.mjs`;
- site overlay only reads `sites/<SITE>/.env.local`;
- do not add `sites/<SITE>/.env`.

Contract tests belong in:

```text
tests/load-dotenv-contract.server.test.ts
```

They must use the same test file pattern as `scripts/run-tests.mjs`:

```js
/\.(test|spec)\.(mjs|[tj]sx?)$/
```

## settings-store split classification

`src/domains/settings/application/settings-store.ts` is split by import:

| import | classification | owner gate | action |
| --- | --- | --- | --- |
| `server-only` | `defer_gate_5_4_server_only` | 5.4 | no change in 5.3 |
| `next/cache` | `defer_gate_5_6_next_cache` | 5.6/cache closeout | no change in 5.3 |

The existing architecture test requires `settings-store.ts` to own settings cache invalidation. Do not replace `revalidateTag` with a no-op in Gate 5.3.

## Initial inventory format

The checker report is the source of truth. Closeout must summarize:

```text
classification | count | representative files | owner gate | action
```

## Stop conditions

Stop if implementation requires:

- changing env loading priority;
- adding `sites/<SITE>/.env`;
- replacing `settings-store.ts` cache invalidation with no-op;
- deleting `src/app/**`;
- removing Next/OpenNext dependencies;
- changing Cloudflare topology;
- changing auth/session/payment/quota/storage/email/AI semantics.
