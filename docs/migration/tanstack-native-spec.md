# SPEC: aooi Next.js → TanStack Start Native Migration

## 1. Problem Statement

aooi is currently a Next.js / OpenNext / Cloudflare Workers SaaS base. The target is a TanStack Start full-stack SaaS base that eventually removes Next.js and OpenNext completely while preserving the current `main` branch behavior: all pages, APIs, auth, billing/payment, quota/entitlement, AI, storage, i18n/SEO, scripts, tests, and Cloudflare deployment contract.

The previous hard-migration zip must not be used as a baseline. It removed some Next files and dependency declarations, but it did not prove native TanStack semantics, installability, type safety, Cloudflare build parity, or real payment/quota/AI/storage behavior.

## 2. Proposed Solution

Use a strict Gate-based migration.

Gate 0-3 is a strong baseline, not the final hard migration. It keeps the existing Next legacy baseline intact and adds a native TanStack Start app under `apps/web`. It implements only one real vertical slice:

- `/$locale/pricing`
- `/api/payment/checkout`
- `/api/payment/notify`
- `/api/user/get-user-credits`

The slice must be native TanStack: no `next-shims`, no wrapping old Next pages, no `React.use(Promise.resolve(Page(...)))`, no `params: Promise`, no Next `generateMetadata` or `generateStaticParams` in TanStack paths.

Business logic for checkout, payment notify, pricing data, and user credits must stay in shared domain use cases and infra dependencies. HTTP composition may stay framework-specific at the route boundary; domain application code must not own HTTP schemas or adapter wiring.

Final Gate 7 is the only point where the project may be considered fully migrated. It requires removing Next.js/OpenNext and migrating every page and API to native TanStack routes/server routes.

## 3. Baseline

- GitHub latest `main` is the only source of truth.
- The uploaded `aooi-main.zip` is only an analysis and generation aid.
- If the zip and GitHub latest `main` differ, GitHub latest `main` wins.
- The old hard-migration zip is discarded.

## 4. Responsibility Boundary

ChatGPT provides:

- SPEC
- Gate 0-3 full repo zip and overlay zip
- Hard validation script
- Inventory script
- explicit TanStack request handling at the `apps/web` route boundary
- SEO/i18n helpers for the slice
- Pricing + checkout + notify + credits slice code
- Codex prompt and env checklist

Codex/IT provides:

- GitHub latest main checkout
- Overlay application
- `pnpm install`
- lockfile regeneration
- typecheck/test/build/Cloudflare build
- sandbox/test provider E2E
- minimal real-environment fixes
- verification logs

Codex must stop and report if the overlay violates this SPEC. Codex must not lower standards, change architecture, modify DB schema, rewrite migration history, introduce `next-shims`, simplify `cf:build` to plain Vite build, or continue on a broken baseline.

## 5. Technical Constraints

### 5.1 Framework stack

Use:

- TanStack Start
- TanStack Router
- TanStack Query
- TanStack Form
- Vite
- `@cloudflare/vite-plugin`
- Wrangler
- React
- TypeScript

Do not intentionally introduce:

- Vite+
- custom Nitro deployment layer
- tanstarter-plus experimental build system

`tanstarter-plus` is only a structure reference, not the project base.

### 5.2 Package structure for Gate 0-3

Gate 0-3 keeps a single package:

- Root `package.json` remains the only package manifest.
- `apps/web` is only a source directory.
- No pnpm workspace.
- No `apps/web/package.json`.
- Keep `src/domains`, `src/infra`, `src/shared`, `src/surfaces`, `src/config`, `sites`, `cloudflare`, `scripts`, and `tests`.

### 5.3 Dependency strategy

Dependencies must be real and installable. Do not guess versions. Gate 1 must prove:

```bash
pnpm install --lockfile-only --ignore-scripts
pnpm install
```

`pnpm-lock.yaml` must be regenerated and committed by Codex/IT in a real network environment.

### 5.4 Request Handling

Use explicit request context passing. Never use module-global request state.

Forbidden in TanStack/shared server paths:

- `let currentRequest`
- `let pendingSetCookies`
- `let requestLocale`
- module-global current user/header/cookie state

All core write/read services must accept context explicitly, for example:

```ts
createCheckout(ctx, input);
handlePaymentNotify(ctx, input);
getUserCredits(ctx, input);
consumeQuota(ctx, input);
generateAiResult(ctx, input);
uploadAsset(ctx, input);
```

### 5.5 API boundary

External/public/webhook/callback APIs must be TanStack Server Routes.

Server Routes:

- `/api/payment/checkout`
- `/api/payment/notify`
- `/api/auth/*`
- `/api/ai/generate`
- `/api/storage/upload-image`
- `/api/remover/jobs`
- `/api/tts/history`
- `/api/tts/quota`
- `/api/tts/generate`
- `/api/tts/download/$id`
- all webhooks/callbacks/public APIs

Server Functions are only for same-origin internal page actions, such as settings/admin/member dashboard mutations.

Webhook endpoints must not be implemented as client-callable server functions.

### 5.6 DB and migrations

First stage does not change DB schema or migration history.

Forbidden:

- DB schema rewrite
- migration history rewrite
- changing tables to match tanstarter-plus
- restructuring users/sessions/payments/quota/entitlement/jobs/assets tables

Allowed:

- db client injection adjustments
- repository import path cleanup
- replacing Next runtime dependencies with explicit TanStack route-boundary request handling

### 5.7 Cloudflare contract

Do not weaken aooi's Cloudflare deploy contract.

Keep:

- `SITE=<site>` build behavior
- `sites/<site>/site.config.json`
- `sites/<site>/deploy.settings.json`
- `cf:check`
- `cf:build:no-db`
- `contract:check`
- i18n checks
- multi-build checks
- Cloudflare config checks

Only the internal OpenNext build step may later be replaced with a TanStack Start + Cloudflare Workers build step. Do not set `cf:build` or `cf:build:no-db` to plain `vite build`.

### 5.8 i18n and SEO

Preserve current URL/SEO behavior:

- URL structure
- locale paths
- canonical URLs
- hreflang
- sitemap
- robots
- title/description/OG/Twitter metadata

Next `generateMetadata` and `generateStaticParams` must migrate to TanStack `head` and framework-neutral SEO/route generation helpers. Gate 0-3 pricing uses `head`/SEO helper directly.

## 6. Non-goals

Allowed low-risk engineering improvements:

- explicit TanStack route-boundary request handling
- stricter types
- route structure normalization
- SEO helper unification
- i18n helper unification
- API handler/service layering
- hard validation scripts
- error handling and test skeletons
- Cloudflare contract preservation work

Forbidden product/business/data changes:

- UI redesign
- pricing model redesign
- payment provider change
- auth provider change
- AI provider change
- DB schema/migration rewrite
- first-stage packages/\* migration
- `next-shims`
- Cloudflare validation downgrade

## 7. Gate Plan

### Gate -1: Main Baseline Verification/Fix

Run on GitHub latest `main`:

```bash
pnpm install
pnpm check
pnpm test
pnpm build
SITE=dev-local pnpm cf:check
SITE=background-remover pnpm cf:build:no-db --site=background-remover
SITE=background-remover pnpm contract:check
```

If `main` fails, create a separate `baseline-fix` branch. Fix only existing main issues. Do not introduce TanStack. Only after baseline is green may `migration/tanstack-start-native` start.

### Gate 0: Inventory

Generate:

- `docs/migration/next-route-inventory.md`
- `docs/migration/api-route-inventory.md`
- `docs/migration/route-map.md`
- `docs/migration/cloudflare-contract.md`
- `docs/migration/required-env.md`
- `docs/migration/gate-0-verification.md`

Inventory must include pages/layouts/loading/not-found files, API handlers, `next/*` imports, metadata/static params, `params: Promise`, payment/quota/AI/storage write paths, and Cloudflare build/test/check commands.

### Gate 1: Installable TanStack Baseline

Add `apps/web` TanStack Start baseline without deleting Next legacy and without overwriting original scripts.

Add only `tanstack:*` scripts. Required:

```bash
pnpm install --lockfile-only --ignore-scripts
pnpm install
pnpm tanstack:validate
pnpm tanstack:typecheck
pnpm tanstack:build
```

### Gate 2: Native Vertical Slice

Implement native TanStack routes:

- `/$locale/pricing`
- `/api/payment/checkout`
- `/api/payment/notify`
- `/api/user/get-user-credits`

Pricing requirements:

- `createFileRoute`
- loader
- `head`/SEO helper
- i18n helper
- shared pricing data source
- no old Next page wrapping
- no Next metadata/static params

Payment checkout requirements:

- TanStack native server route
- provider/plan/user/order/checkout URL/error semantics reused from main
- shared framework-neutral service used by both legacy Next route and TanStack route

Payment notify requirements:

- TanStack native server route
- shared webhook/signature/order/entitlement/credits/idempotency semantics
- idempotency E2E skeleton and env checklist
- real sandbox E2E by Codex/IT

User credits requirements:

- TanStack native server route
- shared auth/anonymous/credits/quota read semantics
- shared service used by legacy Next route and TanStack route

### Gate 3: Explicit Request Handling + Hard Validation

Add explicit TanStack request handling and hard validation.

Gate 0-3 allows legacy Next baseline, but TanStack/shared paths must have zero Next dependency:

- `apps/web/**`
- `apps/web/src/server/api-context.ts`
- `src/shared/routing/**`
- `src/shared/i18n/**`
- `src/shared/seo/**`
- pricing/payment/credits slice files

Run:

```bash
pnpm tanstack:validate
pnpm tanstack:typecheck
pnpm tanstack:build
pnpm check
pnpm test
pnpm build
SITE=dev-local pnpm cf:check
SITE=background-remover pnpm cf:build:no-db --site=background-remover
SITE=background-remover pnpm contract:check
```

### Gate 4: Full Page Migration

Move all Next pages to native TanStack routes. Route files may only handle params/search, loader, head, component, redirect/notFound. Business logic must live outside route files.

Forbidden:

- wrapping old pages
- `React.use(Promise.resolve(Page(...)))`
- `params: Promise`
- `generateMetadata`
- `generateStaticParams`

### Gate 5: Full API Migration

Migrate all API routes to native TanStack server routes/server functions while keeping domain services as the business source.

Must cover auth, payment, quota/entitlement, AI, storage, background remover, TTS, admin APIs, member APIs, and every existing API route.

### Gate 6: Cloudflare Build Migration

Replace OpenNext build internals with TanStack Start + Cloudflare Workers build while retaining aooi `SITE` scoped checks and deploy contract.

### Gate 7: Final Remove Next

Remove:

- `next`
- `@opennextjs/cloudflare`
- `eslint-config-next`
- `next-intl` if only Next-specific
- `next.config.mjs`
- `open-next.config.ts`
- `next-env.d.ts`
- `src/app`
- `next-shims`
- all `next/*` imports

Final forbidden checks must be zero outside docs:

```bash
rg "next/" . --glob '!docs/**'
rg "@opennextjs|next.config|open-next|next-shims" . --glob '!docs/**'
rg "generateMetadata|generateStaticParams|params: Promise|React.use\\(Promise.resolve" apps src --glob '!docs/**'
```

## 8. Testing and Environment

Use sandbox/test providers only.

- payment sandbox/test mode
- test DB
- test R2/Images namespace
- test/low-cost AI provider key for later Gates
- no production secrets or production data

Secrets are not committed. Commit only examples/checklists:

- `.env.test.example`
- `.dev.vars.example` if needed
- `docs/migration/required-env.md`

## 9. Success Criteria

### Gate 0-3 success

- Latest main baseline is green or baseline-fix completed.
- TanStack `apps/web` baseline exists.
- Dependency versions are real and lockfile is generated by Codex/IT.
- Original scripts are preserved; `tanstack:*` scripts are additive.
- Pricing/checkout/notify/user credits slice exists and is native TanStack.
- Slice has no Next dependency, no shims, no old page wrapping.
- Explicit TanStack route-boundary request handling exists.
- Pricing data, checkout, notify, credits reuse main fact sources.
- Legacy Next routes and TanStack routes share domain use cases and infra fact sources.
- Inventory docs exist.
- Hard validation passes.
- Original main validation and new TanStack validation both pass in Codex/IT environment.

### Final Gate 7 success

- Next.js/OpenNext fully removed.
- All pages and APIs are native TanStack.
- Full main parity.
- Payment checkout sandbox E2E passes.
- Payment notify idempotency E2E passes.
- Quota/entitlement E2E passes.
- AI generate E2E passes.
- Storage upload E2E passes.
- Admin/member permissions E2E passes.
- i18n/sitemap/hreflang/canonical parity passes.
- Cloudflare build/deploy contract passes.

## 10. Evidence Requirements

Each Gate must output:

- `docs/migration/gate-*-verification.md`
- hard validation output
- install/typecheck/test/build logs
- Cloudflare build logs
- forbidden `rg` check results
- failure reason, fix summary, rerun result

No verbal-only pass claims.

## 11. Branch Strategy

If main fails, use `baseline-fix` first.

Migration branch:

```txt
migration/tanstack-start-native
```

Gate PRs merge into the migration branch:

- `gate-0-inventory`
- `gate-1-installable`
- `gate-2-tanstack-slice`
- `gate-3-request-context`
- `gate-4-page-migration`
- `gate-5-api-migration`
- `gate-6-cloudflare-build`
- `gate-7-final-remove-next`

Only after Gate 7 is green may migration merge to main.
