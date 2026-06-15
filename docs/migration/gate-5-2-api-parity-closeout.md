# Gate 5.2 API Parity Closeout

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

## Migrated API list

Gate 5.2 remaining public APIs now have TanStack Server Route parity under `apps/web/src/routes/api/**`:

```text
/api/ai/query
/api/ai/generate
/api/ai/notify/$provider

/api/chat
/api/chat/info
/api/chat/list
/api/chat/messages
/api/chat/new

/api/email/send-email
/api/email/test
/api/email/verify-code

/api/storage/upload-image
```

The migration keeps legacy Next routes under `src/app/api/**` as thin composition/re-export entrypoints until the approved Next removal gate.

## API parity checker

Executable checker:

```text
scripts/check-gate-5-2-api-parity.mjs
```

Closeout result:

```text
Gate 5.2 API parity check passed for 12 API route(s).
```

The checker verifies for the 12 Gate 5.2 APIs:

- TanStack route exists.
- Legacy route still exists.
- Server API core/factory exists.
- Server API core/factory does not import `apps/web/**`.
- Declared TanStack runtime helper files exist.
- TanStack route/runtime helper layer does not import `src/app/**`, `@/app/**`, `next/*`, `next-intl`, `settings-runtime.query`, or `next-cache`.
- Migrated legacy API tests are no longer under `src/app/api/**`.

## Tests moved out of `src/app/api/**`

This gate moved the test facts for the migrated APIs into `src/server/api/**` and related focused locations:

```text
src/server/api/ai/query-route.server.test.ts
src/server/api/ai/generate-route.server.test.ts
src/server/api/ai/notify-route.server.test.ts
src/server/api/ai/notify-signature.server.test.ts
src/server/api/chat/create-handlers.server.test.ts
src/server/api/email/email-routes.server.test.ts
src/server/api/storage/upload-image-route.server.test.ts
src/infra/adapters/email/contract.test.ts
```

## Legacy tests intentionally remaining

These `src/app/api/**/*.test.ts` files remain because they belong to APIs already covered before this Gate 5.2 closeout or to non-Gate-5.2 legacy/API areas. They are not evidence for the 12 APIs closed by this gate.

```text
src/app/api/limiters-contract.test.ts
src/app/api/payment/callback/route.test.ts
src/app/api/payment/checkout/route.test.ts
src/app/api/remover/download/action.test.ts
src/app/api/remover/guest-ip-limit.test.ts
src/app/api/remover/jobs/[id]/action.test.ts
src/app/api/remover/jobs/action.test.ts
src/app/api/remover/provider-adapter.server.test.ts
src/app/api/remover/upload/action.test.ts
src/app/api/tts/generate/action.test.ts
src/app/api/tts/generate/provider.server.test.ts
src/app/api/user/get-user-credits/action.test.ts
```

## Validation commands and results

```bash
node scripts/check-gate-5-2-api-parity.mjs
```

Result: passed.

```bash
pnpm test -- src/server/api/ai/query-route.server.test.ts src/server/api/ai/generate-route.server.test.ts src/server/api/ai/notify-route.server.test.ts src/server/api/ai/notify-signature.server.test.ts src/server/api/chat/create-handlers.server.test.ts src/server/api/email/email-routes.server.test.ts src/server/api/storage/upload-image-route.server.test.ts src/infra/adapters/email/contract.test.ts 'src/domains/ai/application/*.test.ts'
```

Result: passed.

```bash
./node_modules/.bin/tsc --noEmit --pretty false --project tsconfig.tanstack.json
```

Result: passed.

```bash
pnpm tanstack:validate
```

Result: passed.

```bash
pnpm exec vite build --config vite.config.mts
```

Result: passed.

## Known risks before Gate 5.3

- Gate 5.2 preserves API parity only. It does not remove non-app `next/*`, `next-intl`, `server-only`, or OpenNext.
- Legacy Next routes still exist by design and must not be deleted until the approved deletion gate.
- Storage upload remains security-sensitive; future work must preserve auth, file size limits, MIME sniffing, storage public URL behavior, concurrency limiter release, and ownership/access semantics.
- Gate 5.3 must focus on non-app Next dependency replacement. It should not change API behavior.
