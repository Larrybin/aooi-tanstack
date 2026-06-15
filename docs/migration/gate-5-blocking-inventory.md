# Gate 5 Blocking Inventory

Status: updated after Gate 5.2 partial API migrations
Scope: `migration/tanstack-start-native` only. `main` remains unchanged.

## Current branch state

- Branch: `migration/tanstack-start-native`
- HEAD: `3c019964`
- Upstream HEAD: `fd3d40b3`
- Ahead/behind upstream: `0	5`
- `origin/main...HEAD`: `2	109`

## Summary

- Next API route handlers: 35
- TanStack API route handlers: 24
- Next API routes already covered by TanStack path: 23
- Next API routes missing TanStack path coverage: 12
- `src/app/api` test files that must move before final deletion: 17
- Direct blocked dependencies still present: 8
- Active package scripts with Next/OpenNext references: 8
- `next_intl` active scan hits: 28
- `next_navigation` active scan hits: 7
- `next_image` active scan hits: 6
- `next_cache_headers_dynamic` active scan hits: 7
- `server_only` active scan hits: 67
- `open_next` active scan hits: 59
- `app_import` active scan hits: 1

## P0 blockers before deleting `src/app/**`

### 1. Public API parity gaps

Every listed route must either move to `apps/web/src/routes/api/**` with its tests moved out of `src/app/api/**`, or be explicitly decommissioned as dev-only/non-production. Tests under `src/app/api/**` are not accepted as final Gate 5 evidence.

| API route | Next source | Owner | Phase | Required decision |
| --- | --- | --- | --- | --- |
| `/api/ai/generate` | `src/app/api/ai/generate/route.ts` | apps/web/src/routes/api + src/domains/ai | Gate 5.2 | migrate to TanStack API route |
| `/api/ai/notify/$provider` | `src/app/api/ai/notify/[provider]/route.ts` | apps/web/src/routes/api + src/domains/ai | Gate 5.2 | migrate to TanStack API route |
| `/api/ai/query` | `src/app/api/ai/query/route.ts` | apps/web/src/routes/api + src/domains/ai | Gate 5.2 | migrate to TanStack API route |
| `/api/chat` | `src/app/api/chat/route.ts` | apps/web/src/routes/api + src/domains/chat | Gate 5.2 | migrate to TanStack API route |
| `/api/chat/info` | `src/app/api/chat/info/route.ts` | apps/web/src/routes/api + src/domains/chat | Gate 5.2 | migrate to TanStack API route |
| `/api/chat/list` | `src/app/api/chat/list/route.ts` | apps/web/src/routes/api + src/domains/chat | Gate 5.2 | migrate to TanStack API route |
| `/api/chat/messages` | `src/app/api/chat/messages/route.ts` | apps/web/src/routes/api + src/domains/chat | Gate 5.2 | migrate to TanStack API route |
| `/api/chat/new` | `src/app/api/chat/new/route.ts` | apps/web/src/routes/api + src/domains/chat | Gate 5.2 | migrate to TanStack API route |
| `/api/email/send-email` | `src/app/api/email/send-email/route.ts` | apps/web/src/routes/api + src/infra/adapters/email | Gate 5.2 | migrate to TanStack API route |
| `/api/email/test` | `src/app/api/email/test/route.ts` | apps/web/src/routes/api + src/infra/adapters/email | Gate 5.2 | migrate to TanStack API route |
| `/api/email/verify-code` | `src/app/api/email/verify-code/route.ts` | apps/web/src/routes/api + src/infra/adapters/email | Gate 5.2 | migrate to TanStack API route |
| `/api/storage/upload-image` | `src/app/api/storage/upload-image/route.ts` | apps/web/src/routes/api + storage adapter | Gate 5.2 | migrate to TanStack API route |

Resolved Gate 5.2 API parity:

| API route | TanStack source | Runtime/test owner | Status |
| --- | --- | --- | --- |
| `/api/ai/capabilities` | `apps/web/src/routes/api/ai/capabilities.ts` | `src/server/api/ai/capabilities-route.ts`, `src/domains/ai/application/capabilities-core.ts` | migrated/resolved |
| `/api/config/get-configs` | `apps/web/src/routes/api/config/get-configs.ts` | `src/server/api/config/get-configs-logic.ts` | migrated/resolved |
| `/api/docs/search` | `apps/web/src/routes/api/docs/search.ts` | `src/server/api/docs/search-route.ts`, `src/server/api/docs/search-index.ts` | migrated/resolved |
| `/api/remover/cleanup` | `apps/web/src/routes/api/remover/cleanup.ts` | `src/server/api/remover/cleanup-route.ts` | migrated/resolved |

Already covered paths are not deletion blockers, but their tests must still move away from `src/app/api/**` before final deletion.

<details><summary>Covered Next API paths</summary>

- `/api/auth/*` from `src/app/api/auth/[...all]/route.ts`
- `/api/background-remover/cleanup` from `src/app/api/background-remover/cleanup/route.ts`
- `/api/background-remover/download/$id` from `src/app/api/background-remover/download/[id]/route.ts`
- `/api/background-remover/remove` from `src/app/api/background-remover/remove/route.ts`
- `/api/background-remover/result/$id` from `src/app/api/background-remover/result/[id]/route.ts`
- `/api/payment/callback` from `src/app/api/payment/callback/route.ts`
- `/api/payment/checkout` from `src/app/api/payment/checkout/route.ts`
- `/api/payment/notify` from `src/app/api/payment/notify/route.ts`
- `/api/remover/download/high-res` from `src/app/api/remover/download/high-res/route.ts`
- `/api/remover/download/low-res` from `src/app/api/remover/download/low-res/route.ts`
- `/api/remover/jobs` from `src/app/api/remover/jobs/route.ts`
- `/api/remover/jobs/$id` from `src/app/api/remover/jobs/[id]/route.ts`
- `/api/remover/upload` from `src/app/api/remover/upload/route.ts`
- `/api/tts/download/$id` from `src/app/api/tts/download/[id]/route.ts`
- `/api/tts/generate` from `src/app/api/tts/generate/route.ts`
- `/api/tts/history` from `src/app/api/tts/history/route.ts`
- `/api/tts/quota` from `src/app/api/tts/quota/route.ts`
- `/api/user/get-user-credits` from `src/app/api/user/get-user-credits/route.ts`
- `/api/user/self-details` from `src/app/api/user/self-details/route.ts`

</details>

### 2. `src/app/api` tests still own API parity evidence

These tests must move to TanStack route/helper/domain locations before `src/app/**` deletion.

- `src/app/api/ai/generate/route.test.ts`
- `src/app/api/ai/notify-route.server.test.ts`
- `src/app/api/ai/notify/signature.server.test.ts`
- `src/app/api/chat/create-handlers.test.ts`
- `src/app/api/limiters-contract.test.ts`
- `src/app/api/payment/callback/route.test.ts`
- `src/app/api/payment/checkout/route.test.ts`
- `src/app/api/remover/download/action.test.ts`
- `src/app/api/remover/guest-ip-limit.test.ts`
- `src/app/api/remover/jobs/[id]/action.test.ts`
- `src/app/api/remover/jobs/action.test.ts`
- `src/app/api/remover/provider-adapter.server.test.ts`
- `src/app/api/remover/upload/action.test.ts`
- `src/app/api/storage/upload-image/route.test.ts`
- `src/app/api/tts/generate/action.test.ts`
- `src/app/api/tts/generate/provider.server.test.ts`
- `src/app/api/user/get-user-credits/action.test.ts`

Resolved Gate 5.2 test evidence:

- `src/server/api/ai/capabilities-route.server.test.ts`
- `src/domains/ai/application/capabilities.test.ts`
- `src/server/api/config/get-configs-logic.server.test.ts`
- `src/server/api/docs/search-route.server.test.ts`
- `src/server/api/docs/search-index.server.test.ts`
- `src/server/api/remover/cleanup-route.server.test.ts`

### 3. Non-app `next-intl` / `next/navigation` / `next/image` / `next/cache` residues

#### next-intl imports outside `src/app`

Owner: shared/domain/infra i18n replacement. Phase: Gate 5.3.

- `src/domains/account/ui/auth/forgot-password.tsx:9`
- `src/domains/account/ui/auth/reset-password.tsx:8`
- `src/domains/account/ui/auth/sign-in-form.tsx:7`
- `src/domains/account/ui/auth/sign-in.tsx:8`
- `src/domains/account/ui/auth/sign-modal.tsx:3`
- `src/domains/account/ui/auth/sign-up.tsx:10`
- `src/domains/account/ui/auth/sign-user.tsx:9`
- `src/domains/account/ui/auth/social-providers.tsx:6`
- `src/domains/ai/ui/image-generator.tsx:19`
- `src/domains/ai/ui/music-generator.tsx:24`
- `src/domains/ai/ui/use-ai-generation-controller.ts:12`
- `src/domains/chat/ui/generator.tsx:6`
- `src/domains/chat/ui/history.tsx:6`
- `src/domains/chat/ui/input.tsx:6`
- `src/domains/chat/ui/library.tsx:7`
- `src/domains/settings/site-aware.ts:1`
- `src/domains/settings/tabs.ts:1`
- `src/infra/platform/i18n/config.ts:1`
- `src/infra/platform/i18n/html-lang-provider.tsx:4`
- `src/infra/platform/i18n/navigation.ts:1`
- `src/infra/platform/i18n/request.ts:2`
- `src/infra/platform/i18n/routing.ts:1`
- `src/shared/blocks/common/image-uploader.tsx:6`
- `src/shared/blocks/common/locale-selector.tsx:7`
- `src/shared/blocks/form/brand-assets-preview.tsx:3`
- `src/shared/blocks/table/time.tsx:1`
- `src/shared/blocks/workspace/sidebar-user.tsx:7`
- `src/shared/lib/i18n/scoped-intl-provider.tsx:6`

#### next/navigation imports outside `src/app`

Owner: TanStack router hooks or prop-based navigation. Phase: Gate 5.3.

- `src/domains/account/ui/auth/sign-user.tsx:4`
- `src/domains/chat/ui/follow-up.tsx:4`
- `src/domains/chat/ui/history.tsx:4`
- `src/domains/chat/ui/library.tsx:4`
- `src/shared/blocks/common/pagination.tsx:4`
- `src/shared/blocks/workspace/filter.tsx:4`
- `src/shared/blocks/workspace/search.tsx:4`

#### next/image imports outside `src/app`

Owner: plain img or framework-neutral image primitive. Phase: Gate 5.3.

- `src/domains/ai/ui/music-generator.tsx:4`
- `src/shared/blocks/common/app-image.tsx:3`
- `src/shared/components/ai-elements/message.tsx:14`
- `src/shared/components/ai-elements/model-selector.tsx:19`
- `src/shared/components/ai-elements/prompt-input/attachments.tsx:6`
- `src/shared/components/magicui/avatar-circles.tsx:4`

#### next/cache/headers/dynamic/server imports outside `src/app`

Owner: TanStack request context or explicit fresh reads. Phase: Gate 5.3.

- `src/domains/chat/ui/thread-shell.tsx:3`
- `src/domains/settings/application/settings-store.ts:3`
- `src/infra/platform/auth/session.server.ts:3`
- `src/infra/platform/i18n/request.ts:1`
- `src/shared/blocks/common/locale-detector-lazy.tsx:3`
- `src/shared/lib/action/with-action.ts:3`
- `src/shared/lib/next-cache.ts:3`

### 4. `server-only` marker residues

Phase: Gate 5.4. Decision: remove `import 'server-only'` markers and enforce server-only boundaries via executable architecture checks, not via the external package.

- `src/domains/account/infra/apikey.ts:1`
- `src/domains/account/infra/credit.ts:1`
- `src/domains/account/infra/email-verification-code.ts:1`
- `src/domains/account/infra/user.ts:1`
- `src/domains/ai/application/provider-bindings.ts:1`
- `src/domains/ai/application/service.ts:1`
- `src/domains/ai/infra/ai-task.ts:1`
- `src/domains/background-remover/infra/image.ts:1`
- `src/domains/background-remover/infra/quota.ts:1`
- `src/domains/billing/application/checkout.ts:1`
- `src/domains/billing/application/flows.ts:1`
- `src/domains/billing/domain/credit.ts:1`
- `src/domains/billing/infra/order.ts:1`
- `src/domains/billing/infra/payment-webhook-audit.ts:1`
- `src/domains/billing/infra/payment-webhook-inbox.ts:1`
- `src/domains/billing/infra/subscription.ts:1`
- `src/domains/billing/infra/user-read.ts:1`
- `src/domains/chat/infra/chat-message.ts:1`
- `src/domains/chat/infra/chat.ts:1`
- `src/domains/content/application/local-content.tsx:1`
- `src/domains/content/application/post-management.ts:1`
- `src/domains/content/application/post.query.ts:1`
- `src/domains/content/application/public-content.query.ts:1`
- `src/domains/content/application/taxonomy-management.ts:1`
- `src/domains/content/application/taxonomy.query.ts:1`
- `src/domains/content/domain/post-date.ts:1`
- `src/domains/content/infra/post-repo.ts:1`
- `src/domains/content/infra/taxonomy-repo.ts:1`
- `src/domains/entitlements/infra/grant.ts:1`
- `src/domains/product-quota/infra/reservation.ts:1`
- `src/domains/remover/infra/image-asset.ts:1`
- `src/domains/remover/infra/job.ts:1`
- `src/domains/remover/infra/quota-reservation.ts:1`
- `src/domains/settings/application/settings-build.query.ts:1`
- `src/domains/settings/application/settings-runtime.query.ts:1`
- `src/domains/settings/application/settings-store.ts:1`
- `src/domains/text-to-speech-generator/infra/generation.ts:1`
- `src/domains/text-to-speech-generator/infra/quota.ts:1`
- `src/infra/adapters/ads/service.ts:1`
- `src/infra/adapters/affiliate/service.ts:1`
- `src/infra/adapters/analytics/service.ts:1`
- `src/infra/adapters/customer-service/service.tsx:1`
- `src/infra/adapters/db/index.ts:1`
- `src/infra/adapters/email/service.ts:1`
- `src/infra/adapters/payment/runtime-bindings.ts:1`
- `src/infra/adapters/payment/service.ts:1`
- `src/infra/adapters/storage/service.ts:1`
- `src/infra/platform/auth/config.ts:1`
- `src/infra/platform/auth/index.ts:1`
- `src/infra/platform/auth/reset-password-throttle.ts:1`
- `src/infra/platform/auth/server-bindings.ts:1`
- `src/infra/platform/auth/session.server.ts:1`
- `src/infra/platform/brand/placeholders-react.server.tsx:1`
- `src/infra/platform/brand/placeholders.server.ts:1`
- `src/infra/platform/logging/logger.server.ts:2`
- `src/infra/platform/logging/request-context.server.ts:1`
- `src/infra/platform/logging/request-logger.server.ts:1`
- `src/infra/url/canonical.ts:1`
- `src/shared/content/email/reset-password.tsx:1`
- `src/shared/content/email/verification-code.tsx:1`
- `src/shared/lib/action/errors.ts:1`
- `src/shared/lib/action/form.ts:1`
- `src/shared/lib/action/result.ts:1`
- `src/shared/lib/action/with-action.ts:1`
- `src/shared/lib/api/csrf.server.ts:14`
- `src/shared/lib/api/parse.ts:8`
- `src/shared/lib/next-cache.ts:1`

### 5. OpenNext / `.open-next` / Cloudflare worker residues

Phase: Gate 5.5. These block native TanStack Cloudflare worker ownership.

- `cloudflare/workers/create-server-worker.ts:35`
- `cloudflare/workers/router.ts:4`
- `cloudflare/workers/router.ts:5`
- `cloudflare/workers/router.ts:6`
- `cloudflare/workers/server-admin.ts:5`
- `cloudflare/workers/server-auth.ts:6`
- `cloudflare/workers/server-chat.ts:5`
- `cloudflare/workers/server-member.ts:5`
- `cloudflare/workers/server-payment.ts:5`
- `cloudflare/workers/server-public-web.ts:11`
- `cloudflare/workers/state.ts:1`
- `cloudflare/workers/state.ts:2`
- `cloudflare/wrangler.server-admin.toml:10`
- `cloudflare/wrangler.server-auth.toml:10`
- `cloudflare/wrangler.server-chat.toml:10`
- `cloudflare/wrangler.server-member.toml:10`
- `cloudflare/wrangler.server-payment.toml:10`
- `cloudflare/wrangler.server-public-web.toml:10`
- `package.json:182`
- `scripts/bundle-cf-server-functions.mjs:7`
- `scripts/bundle-cf-server-functions.mjs:24`
- `scripts/bundle-cf-server-functions.mjs:43`
- `scripts/bundle-cf-server-functions.mjs:104`
- `scripts/conventions-index.mjs:8`
- `scripts/detect-cloudflare-acceptance-changes.mjs:14`
- `scripts/lib/cloudflare-build-artifacts.mjs:14`
- `scripts/lib/cloudflare-build-artifacts.mjs:15`
- `scripts/lib/cloudflare-build-artifacts.mjs:16`
- `scripts/lib/cloudflare-build-artifacts.mjs:17`
- `scripts/lib/cloudflare-build-artifacts.mjs:18`
- `scripts/lib/cloudflare-build-artifacts.mjs:19`
- `scripts/lib/cloudflare-build-artifacts.mjs:23`
- `scripts/lib/cloudflare-build-artifacts.mjs:24`
- `scripts/next-build.mjs:5`
- `scripts/run-cf-multi-build-check.mjs:135`
- `scripts/sync-open-next-generated-types.mjs:7`
- `scripts/tanstack-gate-4-plan.mjs:12`
- `scripts/tanstack-native-inventory.mjs:17`
- `scripts/validate-tanstack-native-migration.mjs:16`
- `src/infra/runtime/env.server.ts:3`
- `src/shared/config/cloudflare-worker-topology.ts:83`
- `src/shared/config/cloudflare-worker-topology.ts:91`
- `src/shared/config/cloudflare-worker-topology.ts:99`
- `src/shared/config/cloudflare-worker-topology.ts:107`
- `src/shared/config/cloudflare-worker-topology.ts:115`
- `src/shared/config/cloudflare-worker-topology.ts:123`
- `src/shared/types/open-next-generated.d.ts:5`
- `src/shared/types/open-next-generated.d.ts:6`
- `src/shared/types/open-next-generated.d.ts:9`
- `src/shared/types/open-next-generated.d.ts:22`
- `src/shared/types/open-next-generated.d.ts:31`
- `src/shared/types/open-next-generated.d.ts:39`
- `src/shared/types/open-next-generated.d.ts:45`
- `src/shared/types/open-next-generated.d.ts:51`
- `src/shared/types/open-next-generated.d.ts:60`
- `src/shared/types/open-next-generated.d.ts:69`
- `src/shared/types/open-next-generated.d.ts:78`
- `src/shared/types/open-next-generated.d.ts:87`
- `src/shared/types/open-next-generated.d.ts:96`

### 6. Direct package dependencies to remove only after replacements land

| Section | Package | Version | Phase |
| --- | --- | --- | --- |
| `dependencies` | `next` | `16.2.7` | Gate 5.6 |
| `dependencies` | `next-intl` | `^4.12.0` | Gate 5.6 |
| `dependencies` | `@next/bundle-analyzer` | `16.2.7` | Gate 5.6 |
| `dependencies` | `@next/env` | `16.2.7` | Gate 5.3 DB/CLI env loader replacement, then Gate 5.6 removal |
| `dependencies` | `nextjs-toploader` | `^3.9.17` | Gate 5.6 |
| `dependencies` | `server-only` | `^0.0.1` | Gate 5.4 marker removal, then Gate 5.6 removal |
| `devDependencies` | `@opennextjs/cloudflare` | `1.19.11` | Gate 5.6 |
| `devDependencies` | `eslint-config-next` | `16.2.7` | Gate 5.6 |

### 7. Active package scripts still referencing Next/OpenNext

| Script | Command | Phase |
| --- | --- | --- |
| `dev` | `node scripts/run-with-site.mjs pnpm exec next dev --turbopack` | Gate 5.6 |
| `dev:local` | `SITE=dev-local node scripts/run-with-site.mjs pnpm exec next dev --turbopack` | Gate 5.6 |
| `build` | `node scripts/run-with-site.mjs node scripts/next-build.mjs` | Gate 5.6 |
| `build:fast` | `node scripts/run-with-site.mjs node scripts/next-build.mjs --max-old-space-size=4096` | Gate 5.6 |
| `analyze` | `ANALYZE=true node scripts/run-with-site.mjs node scripts/next-build.mjs` | Gate 5.6 |
| `start` | `node scripts/run-with-site.mjs pnpm exec next start` | Gate 5.6 |
| `cf:build` | `node scripts/run-with-site.mjs node --import tsx scripts/run-cf-build.mjs` | Gate 5.5 then Gate 5.6 |
| `cf:build:no-db` | `node scripts/run-cf-build-no-db.mjs` | Gate 5.5 then Gate 5.6 |

### 8. `@/app` / `src/app` import residues outside legacy tree

Phase: Gate 5.3 or Gate 5.6 depending on owner. Production imports must be zero before deletion.

- `scripts/self-check-rbac.ts:20`

## Gate 5 execution implications

1. Do not delete `src/app/**` until every public API above is migrated or explicitly decommissioned.
2. Do not remove `next`, `next-intl`, `@next/env`, `@opennextjs/cloudflare`, or `server-only` until non-app imports and build/runtime users are gone.
3. Gate 5.5 must be a standalone PR: split-worker route scopes, OpenNext cache DO removal, and TanStack artifact checks are too risky to mix with deleting `src/app/**`.
4. Final validation must use an executable no-Next runtime checker that excludes validation scripts/docs from forbidden-token matching.

## Commands used to generate this inventory

```bash
git status --short --branch
find apps/web/src/routes/api -type f | sort
find src/app/api -type f | sort
python - <<'PY'  # repository scan for API parity and Next/OpenNext residues
PY
```
