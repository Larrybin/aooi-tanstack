# Gate 5.2 API Parity SPEC v5

Status: execution SPEC
Branch: `migration/tanstack-start-native`
PR: `#172`

## Current state check

Before each implementation session, verify current state instead of treating this section as durable truth:

```bash
git status --short --branch
git rev-parse --short HEAD
gh pr view 172 --json number,state,headRefName,baseRefName,title,url,mergeStateStatus,isDraft
```

At the time this SPEC was written:

- `HEAD` and `origin/migration/tanstack-start-native`: `63684807`
- PR `#172`: open, head `migration/tanstack-start-native`, base `codex/gate-4-foundation-validation`

## Decision

Gate 5.2 continues API parity only. Do not enter Gate 5.3, 5.4, 5.5, or 5.6 in this SPEC.

## Completed APIs

- `/api/config/get-configs`
- `/api/docs/search`
- `/api/remover/cleanup`
- `/api/ai/capabilities`

## Remaining APIs

- `/api/ai/query`
- `/api/ai/generate`
- `/api/ai/notify/$provider`
- `/api/chat`
- `/api/chat/info`
- `/api/chat/list`
- `/api/chat/messages`
- `/api/chat/new`
- `/api/email/send-email`
- `/api/email/test`
- `/api/email/verify-code`
- `/api/storage/upload-image`

## Hard boundaries

- Do not delete `src/app/**`.
- Do not remove Next/OpenNext dependencies.
- Do not change DB schema.
- Do not change auth/session/quota/storage/email/AI semantics.
- Do not change Cloudflare config, bindings, secrets, or topology.
- Public APIs must be TanStack Server Routes, not Server Functions.
- `src/server/api/**` must not import `apps/web/**`.
- `apps/web/src/routes/api/**` injects TanStack runtime deps.
- TanStack route closure must not import `src/app/**`, `@/app/**`, `next/*`, `next-intl`, `settings-runtime.query`, or `next-cache`.
- Legacy Next routes may be thin composition/re-export only; they must not own main logic.
- This gate's migrated tests must move out of `src/app/api/**`.
- Do not require all legacy `src/app/api` tests to disappear in closeout; only classify legacy tests outside this gate.

## Thin legacy route rule

Legacy Next route can keep a thin composition layer when it needs Next-only runtime deps. It must not own primary logic.

Allowed:

```ts
import { createRouteHandler } from '@/server/api/example/route';
import { nextOnlyRuntimeDep } from '@/app/api/_lib/runtime';

export const POST = createRouteHandler({ nextOnlyRuntimeDep });
```

Forbidden:

- main business flow in `src/app/api/**/route.ts`
- TanStack route importing legacy Next route
- `src/server/api/**` importing `src/app/**` or `apps/web/**`

## Dependency injection rule

`src/server/api/**` owns route factories and core logic. It exposes dependency contracts only.

`apps/web/src/routes/api/**` owns TanStack-specific runtime injection:

- `createTanStackApiContext`
- TanStack-safe runtime readers
- `withTanStackCloudflareBindings`
- TanStack route params/search mapping

## Execution order

1. AI service builder pre-split
2. `/api/ai/query`
3. `/api/ai/generate`
4. `/api/ai/notify/$provider`
5. `/api/chat/*`
6. TanStack-safe permission helper
7. Email service builder pre-split
8. `/api/email/*`
9. `/api/storage/upload-image`
10. API parity executable checker
11. closeout doc

## AI service builder precondition

Before `/api/ai/query`, split a query-free AI service builder:

```text
src/domains/ai/application/service-builder.ts
```

Requirements:

- accepts `settings` and `bindings`
- does not read env directly
- does not import `server-only`
- does not import `settings-runtime.query`
- does not import `provider-bindings.ts`
- preserves current provider registry behavior

Current `service.ts` may remain as the legacy/default reader facade, but TanStack route closure must use the builder or a query-free factory.

## AI notify semantics

Current `/api/ai/notify/$provider` behavior is ACK/log/signature only:

- read provider route param
- validate `task_id` and `sig`
- validate webhook signature
- read request body
- log
- return `{ ok: true }`

Do not add task status update, quota commit, quota refund, or idempotent task state transition during Gate 5.2.

## TanStack-safe permission helper

Add before email APIs, or as the first step of the email commit:

```text
apps/web/src/server/permission-context.ts
```

or extend:

```text
apps/web/src/server/api-context.ts
```

Requirements:

- no import from `src/app/api/_lib/context`
- no import from `src/app/access-control/api-guard`
- uses non-app auth/access-control functions
- preserves existing permission behavior

## Email service builder precondition

Before `/api/email/*`, split query-free email service builder:

```text
src/infra/adapters/email/service-builder.ts
```

Requirements:

- no `server-only`
- no `settings-runtime.query`
- accepts runtime settings/bindings via deps
- preserves current provider behavior

Current `service.ts` may remain as legacy/default facade.

## API parity executable checker

Add one focused checker before closeout:

```text
scripts/check-gate-5-2-api-parity.mjs
```

It must verify the fixed list of remaining 12 APIs has matching TanStack route files. It should not require all `src/app/api` tests to disappear.

## Per-group validation

Run focused tests first, then migration validation/typecheck/build:

```bash
pnpm test -- '<relevant test paths>'
SITE=dev-local node scripts/run-with-site.mjs node scripts/validate-tanstack-native-migration.mjs
./node_modules/.bin/tsc --noEmit --pretty false --project tsconfig.tanstack.json
pnpm exec vite build --config vite.config.mts
```

## Stop conditions

Stop if:

- implementation would change public API/auth/quota/storage/email/AI semantics
- route closure still imports forbidden deps after 2 focused fixes
- validation failure requires Gate 5.3-5.6
- DB/Cloudflare/secret/topology changes become necessary
- AI notify requires side effects beyond current ACK/log/signature behavior
