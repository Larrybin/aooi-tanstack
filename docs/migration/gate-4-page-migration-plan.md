# Gate 4 Page Migration Plan

> Manual plan. The generated matrix lives in `docs/migration/gate-4-page-migration-plan.generated.md` and must not be edited by hand.

## Status

- Base branch: `migration/tanstack-start-native`
- Current step: Gate 4-0 planning only
- No page code should be migrated in Gate 4-0.
- Gate 4 does not migrate APIs, does not replace OpenNext/Cloudflare build internals, and does not remove Next.js.

## Problem Statement

aooi has completed the TanStack Gate 0-3 / 3.1 / 3.2 baseline, but the full page surface still lives under Next App Router. Gate 4 must migrate pages, layouts, and not-found behavior to native TanStack routes while preserving URL, SEO, i18n, layout, notFound/redirect behavior, and existing UI/content parity.

## Proposed Solution

Gate 4 is split into a planning gate plus four migration batches:

1. `Gate 4-0`: page migration plan and generated matrix only.
2. `Gate 4-A`: Public / SEO pages.
3. `Gate 4-B`: Auth / Member / Account pages.
4. `Gate 4-C`: Admin pages.
5. `Gate 4-D`: Docs / Chat / AI tool pages.

Each migrated page must use native TanStack routes and shared surface helpers. Route files must remain thin and must not wrap old Next pages.

## Gate 4-0 Deliverables

- `scripts/tanstack-gate-4-plan.mjs`
- `docs/migration/gate-4-page-migration-plan.md`
- `docs/migration/gate-4-page-migration-plan.generated.md`
- `docs/migration/gate-4-0-verification.md`

Run:

```bash
node scripts/tanstack-gate-4-plan.mjs
node scripts/tanstack-gate-4-plan.mjs --check
```

The generated file is a freshness-checked source-of-truth snapshot of current `src/app` pages/layouts/not-found files. Do not edit it manually.

## Route and Surface Rules

### TanStack route files

`apps/web/src/routes/**` may only handle:

- params/search parsing
- loader
- head
- component
- redirect/notFound

They must not contain business logic, complex data orchestration, SEO assembly details, or theme UI composition.

### Required surface pattern

Prefer this structure for migrated pages:

```txt
src/surfaces/<area>/<page>/
  <page>.data.ts
  <page>.seo.ts
  <page>.view.tsx
  <page>.types.ts
```

Route flow:

```txt
apps/web route -> src/surfaces/** -> src/themes/** / src/shared/** / src/domains/**
```

Routes must not import `src/themes/**` directly. `src/surfaces/**` may compose theme and shared UI.

### No dependency on legacy app from new migration paths

These paths must not import `src/app/**` or `@/app/**`:

- `apps/web/src/routes/**`
- `src/surfaces/**`
- `src/shared/**`
- `src/domains/**`

If a reusable helper currently lives under `src/app/**`, extract it first into a neutral layer such as `src/server/**`, `src/surfaces/**`, `src/shared/**`, `src/domains/**`, or `src/infra/**`.

## Legacy Next Page Handling

Gate 4 does not delete `src/app`. After a page is migrated, the legacy Next page should remain but should call the same surface data/SEO/view helpers as the TanStack route.

Goal:

```txt
legacy Next page -> shared surface data/seo/view helper
TanStack route   -> same shared surface data/seo/view helper
```

This prevents two fact sources and lowers Gate 7 deletion risk.

## Batch Plan and Forced Order

### Gate 4-A: Public / SEO pages

#### 4-A-1: Base entry and errors

- `/`
- `/pricing`
- global not-found

#### 4-A-2: Locale home

- `/$locale`

#### 4-A-3: Locale pricing

- `/$locale/pricing`

#### 4-A-4: Dynamic public slug

- `/$locale/[slug]`

`/$locale/my-images` is intentionally deferred to Gate 4-B because it may depend on auth, user assets, storage, or API reads.

### Gate 4-B: Auth / Member / Account pages

#### 4-B-1: Auth pages

- `/$locale/sign-in`
- `/$locale/sign-up`
- `/$locale/forgot-password`
- `/$locale/reset-password`
- `/$locale/no-permission`

#### 4-B-2: Member shell

- `/$locale/settings`
- `/$locale/activity`

#### 4-B-3: Settings pages

- `/$locale/settings/profile`
- `/$locale/settings/security`
- `/$locale/settings/credits`
- `/$locale/settings/billing`
- `/$locale/settings/payments`
- `/$locale/settings/apikeys`
- `/$locale/settings/apikeys/create`
- `/$locale/settings/apikeys/[id]/edit`
- `/$locale/settings/apikeys/[id]/delete`
- `/$locale/settings/billing/cancel`
- `/$locale/settings/billing/retrieve`
- `/$locale/settings/invoices/retrieve`

#### 4-B-4: User asset / activity pages

- `/$locale/my-images`
- `/$locale/activity/ai-tasks`
- `/$locale/activity/ai-tasks/[id]/refresh`
- `/$locale/activity/chats`
- `/$locale/activity/feedbacks`

### Gate 4-C: Admin pages

#### 4-C-1: Admin shell / overview

- `/$locale/admin`
- `/$locale/admin/no-permission`

#### 4-C-2: Admin settings

- `/$locale/admin/settings/[tab]`

#### 4-C-3: Read/list pages

- `/$locale/admin/users`
- `/$locale/admin/payments`
- `/$locale/admin/subscriptions`
- `/$locale/admin/credits`
- `/$locale/admin/chats`
- `/$locale/admin/ai-tasks`
- `/$locale/admin/categories`
- `/$locale/admin/posts`
- `/$locale/admin/roles`
- `/$locale/admin/permissions`
- `/$locale/admin/apikeys`

#### 4-C-4: Edit/create/replay/delete/restore pages

- `/$locale/admin/users/[id]/edit`
- `/$locale/admin/users/[id]/edit-roles`
- `/$locale/admin/categories/add`
- `/$locale/admin/categories/[id]/edit`
- `/$locale/admin/posts/add`
- `/$locale/admin/posts/[id]/edit`
- `/$locale/admin/roles/[id]/edit`
- `/$locale/admin/roles/[id]/edit-permissions`
- `/$locale/admin/roles/[id]/delete`
- `/$locale/admin/roles/[id]/restore`
- `/$locale/admin/payments/replay`

### Gate 4-D: Docs / Chat / AI tool pages

#### 4-D-1: Blog / content SEO

- `/$locale/blog`
- `/$locale/blog/[slug]`
- `/$locale/blog/category/[slug]`

#### 4-D-2: Docs

- `/$locale/docs/[[...slug]]`

#### 4-D-3: Chat pages

- `/$locale/chat`
- `/$locale/chat/[id]`
- `/$locale/chat/history`

#### 4-D-4: AI tool pages

- `/$locale/ai-image-generator`
- `/$locale/ai-music-generator`
- `/$locale/ai-video-generator`
- `/$locale/ai-audio-generator`
- `/$locale/ai-chatbot`

## Risk Model

Each generated row has:

```txt
risk: Low | Medium | High | Critical
tags: seo, i18n, layout, dynamic-slug, auth, admin, api-mutation, content-loader, streaming, chat, ai, storage, ...
primaryBatch: 4-A | 4-B | 4-C | 4-D
blockingTags: string[]
deferTo?: string
```

Risk definitions:

- `Low`: static or near-static public page; SEO/head/i18n are main risks.
- `Medium`: dynamic public page; dynamic slug/content loader/notFound/SEO complexity.
- `High`: auth/session/member/admin permission/forms/tables/mutation/settings/sidebar.
- `Critical`: docs/chat/AI/streaming/file/storage/complex dynamic/static params.

## Blocking Issues

Stop the current page/batch if any of these occur:

- typecheck failure
- build failure
- test failure
- `tanstack:validate` failure
- Cloudflare legacy build/contract failure
- URL parity failure
- SEO/head parity failure
- canonical/hreflang parity failure
- i18n fallback inconsistency
- layout parity failure
- notFound/redirect parity failure
- importing old Next page/layout
- wrapping old Next page
- `React.use(Promise.resolve(Page(...)))`
- `params: Promise` in TanStack route
- `generateMetadata` / `generateStaticParams` in TanStack route
- route directly imports `src/themes/**`
- new migration path imports `src/app/**`
- UI/content/CTA/layout/text changed
- SEO text changed
- URL changed

Do not carry TODO pages forward into the next batch.

## Evidence Requirements

Each Gate 4 sub-batch must produce a verification document:

- `docs/migration/gate-4-0-verification.md`
- `docs/migration/gate-4-a-verification.md`
- `docs/migration/gate-4-b-verification.md`
- `docs/migration/gate-4-c-verification.md`
- `docs/migration/gate-4-d-verification.md`

Each verification must include a parity table:

| page | URL parity | SEO/head parity | canonical/hreflang parity | i18n parity | layout parity | notFound/redirect parity | status | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Non-goals

Gate 4 does not do:

- full API migration
- OpenNext -> TanStack Cloudflare build replacement
- deleting Next / OpenNext
- deleting `src/app`
- DB schema changes
- migration history rewrite
- UI redesign
- SEO text optimization
- URL redesign
- payment/quota/AI/storage E2E
- admin/member business semantics rewrite

Legacy bug policy:

- Migration PRs do not fix legacy bugs directly.
- If a clear legacy bug is found, open a separate baseline-fix/parity-fix PR first.
- Resume Gate 4 after the fix is validated.

## Gate 4-0 Validation Commands

```bash
SITE=dev-local pnpm tanstack:inventory
SITE=dev-local pnpm tanstack:validate
node scripts/tanstack-gate-4-plan.mjs --check
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:build
SITE=dev-local pnpm check
SITE=dev-local pnpm build
SITE=background-remover pnpm contract:check
SITE=background-remover pnpm cf:build:no-db --site=background-remover
```
