# AI Remover MVP Technical Architecture

## Architecture Decision

AI Remover should be implemented as an aooi site/product workflow:

- Site identity and capabilities live in `sites/ai-remover`.
- Product routes live in `src/app/**`.
- Product composition lives in `src/surfaces/**` or focused domain UI.
- Business semantics live in `src/domains/remover/**`.
- Provider and platform adapters live in `src/infra/**` unless an existing
  domain-owned infra pattern is more direct.
- Shared utilities stay in `src/shared/**`.

Do not fork Auth, Billing, Storage, AI, Admin Settings, or Cloudflare deploy
logic for this product.

## Site Contract

Current site instance:

```text
sites/ai-remover/site.config.json
sites/ai-remover/deploy.settings.json
sites/ai-remover/deploy.preview.settings.json
sites/ai-remover/pricing.json
sites/ai-remover/content/pages/privacy-policy.mdx
sites/ai-remover/content/pages/terms-of-service.mdx
```

Expected capabilities:

```json
{
  "auth": true,
  "payment": "creem",
  "ai": false,
  "docs": false,
  "blog": false
}
```

`capabilities.ai` controls the shared OpenRouter/chat/generator module. AI
Remover image processing uses the Cloudflare Workers AI binding declared in
`deploy.settings.json`, so this site keeps `capabilities.ai=false` and does not
enable the optional `chat` worker in its deploy topology.

Provider keys, OAuth secrets, Creem secrets, and storage settings must stay in
runtime settings, secrets, or Cloudflare bindings. They must not be committed to
site config.

## Domain Boundary

Create a focused `remover` domain for product-specific behavior:

```text
src/domains/remover/domain/**
src/domains/remover/application/**
src/domains/remover/infra/**
src/domains/remover/ui/**
```

The domain owns:

- Removal job state.
- Image asset metadata.
- Anonymous session usage.
- Quota reservation and commit/refund semantics.
- Plan entitlement resolution for this product.
- My Images query and deletion rules.
- High-res download authorization.

The existing AI module can provide configured provider bindings and shared AI
enablement checks, but the generic `ai_task` table should not be stretched to
hold remover-specific asset and anonymous usage state.

## Data Model

Use explicit product tables owned by the remover workflow. Current schema lives
in `src/config/db/schema.ts`, with repository functions under
`src/domains/remover/infra/**`.

### `entitlement_grant`

Generic platform grant table for internal or operational product access. It is
not an AI Remover table, not a pricing plan, and never participates in checkout.

Required fields:

- `userId`
- `siteKey`
- `productKey`
- `environment`: `local`, `preview`, `staging`, `production`
- `source`
- `status`
- `entitlementsJson`
- `reason`
- `grantedByUserId`
- `startsAt`
- `expiresAt`
- `revokedAt`
- `createdAt`
- `updatedAt`

Production grants are ignored unless runtime explicitly sets
`INTERNAL_ENTITLEMENT_GRANTS_ENABLED=true`.

### `remover_image_asset`

Tracks all stored objects for a removal workflow.

Required fields:

- `id`
- `userId`
- `anonymousSessionId`
- `kind`: `original`, `mask`, `result`, `thumbnail`
- `storageKey`
- `url`
- `mimeType`
- `byteSize`
- `width`
- `height`
- `status`: `active`, `deleted`, `expired`
- `createdAt`
- `updatedAt`
- `expiresAt`
- `deletedAt`

At least one of `userId` or `anonymousSessionId` must be present.

### `remover_job`

Tracks the AI removal job.

Required fields:

- `id`
- `userId`
- `anonymousSessionId`
- `provider`
- `model`
- `providerTaskId`
- `status`: `queued`, `processing`, `succeeded`, `failed`
- `inputImageAssetId`
- `maskImageAssetId`
- `inputImageKey`
- `maskImageKey`
- `outputImageKey`
- `thumbnailKey`
- `costUnits`
- `quotaReservationId`
- `errorCode`
- `errorMessage`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `expiresAt`

### `remover_quota_reservation`

Tracks reservation, commit, and refund idempotently.

Required fields:

- `id`
- `userId`
- `anonymousSessionId`
- `productId`
- `quotaType`: `processing`, `high_res_download`, `upload`
- `units`
- `status`: `reserved`, `committed`, `refunded`, `expired`
- `idempotencyKey`
- `jobId`
- `reason`
- `entitlementGrantIdsJson`
- `createdAt`
- `updatedAt`
- `committedAt`
- `refundedAt`
- `expiresAt`

Add a unique constraint on `idempotencyKey`.

### Quota Windows And Entitlements

There is no `remover_usage_counter` table and no `remover_entitlement` table in
the current implementation.

- Quota windows are computed over `remover_quota_reservation` rows.
- Guest and free processing limits use day windows.
- Paid processing and high-res limits use month windows.
- Free high-res sign-up credits use a lifetime window.
- Base product entitlements come from `sites/ai-remover/pricing.json`, exposed
  through generated `@/site` pricing data.
- Active `entitlement_grant` rows are resolved by
  `src/domains/entitlements/**` and merged on top of pricing entitlements.
- Grant entitlement keys are validated by a product schema. AI Remover grants
  currently allow only `monthly_removals`, `monthly_high_res_downloads`, and
  `max_upload_mb`.
- Numeric grant entitlements are merged with `max(base, grant)` so internal
  grants cannot accidentally downgrade a paid plan.
- AI Remover uses the resolved actor entitlements in
  `src/domains/remover/domain/plan.ts`.
- RBAC roles do not grant remover usage or high-res downloads.
- If a quota reservation consumes grant-derived access,
  `entitlementGrantIdsJson` records the grant IDs for auditability. `reason`
  stays available for semantic reservation/refund reasons.

## API Routes

Use thin route handlers that delegate to remover application use cases.

### Upload

```text
POST /api/remover/upload
```

Responsibilities:

- Accept one JPG, PNG, or WebP file.
- Validate type, size, and image limits by entitlement.
- Store original image.
- Create image asset metadata.
- Return asset ID and preview URL.

### Create Job

```text
POST /api/remover/jobs
```

Responsibilities:

- Validate uploaded image and mask ownership.
- Check CSRF/origin for browser writes.
- Check quota availability.
- Reserve processing quota.
- Submit provider task.
- Create `remover_job`.
- Return job ID and initial status.

### Get Job

```text
GET /api/remover/jobs/:id
```

Responsibilities:

- Authorize by user or anonymous session.
- Refresh provider status when needed.
- Commit quota on success.
- Refund quota on failure.
- Return status, user-safe error, and download permissions.
- Do not return a raw high-res output URL.

### Low-Res Download

```text
GET /api/remover/download/low-res?jobId=<id>
POST /api/remover/download/low-res
```

Responsibilities:

- Authorize by user or anonymous session.
- Stream the low-res/thumbnail asset for preview or download.
- Keep storage keys and high-res output URLs private.

### High-Res Download

```text
POST /api/remover/download/high-res
```

Responsibilities:

- Require logged-in user.
- Validate job ownership.
- Reserve/commit high-res download quota idempotently.
- Stream the high-res result.

### My Images

```text
GET /my-images
POST /my-images delete server action
```

Responsibilities:

- Require logged-in user.
- List only the current user's non-deleted jobs/assets.
- Claim matching anonymous-session jobs after sign-in.
- Delete only current user's assets and mark metadata deleted through a server
  action.

### Expiration Cleanup

```text
POST /api/remover/cleanup
```

Responsibilities:

- Require `Authorization: Bearer ${REMOVER_CLEANUP_SECRET}`.
- Select expired jobs/assets by `expiresAt`.
- Delete the unique storage keys once.
- Mark expired metadata deleted after storage deletion.

## Provider Adapter

The current provider adapter defaults to Cloudflare Workers AI through the
`AI` binding. `REMOVER_AI_PROVIDER` defaults to `cloudflare-workers-ai`, and
`REMOVER_AI_MODEL` defaults to
`@cf/runwayml/stable-diffusion-v1-5-inpainting`.

The product adapter stays small:

```ts
type RemovalProvider = {
  config: {
    provider: string;
    model: string;
  };
  submitTask(input: RemovalSubmitInput): Promise<RemovalSubmitResult>;
  getTaskStatus(input: RemovalStatusInput): Promise<RemovalStatusResult>;
};
```

Do not introduce a multi-provider registry until there are at least two real
providers in use.

Record:

- Provider name.
- Model.
- Provider task ID.
- Cost units.
- Provider-safe error code.

## Storage

Use the existing storage module and Cloudflare R2 bindings.

Storage keys should be isolated by product and owner:

```text
remover/anonymous/<anonymous-session-id>/original/<asset-id>.<ext>
remover/anonymous/<anonymous-session-id>/mask/<asset-id>.png
remover/anonymous/<anonymous-session-id>/output/<asset-id>.png
remover/anonymous/<anonymous-session-id>/thumbnail/<asset-id>.webp
remover/users/<user-id>/original/<asset-id>.<ext>
remover/users/<user-id>/mask/<asset-id>.png
remover/users/<user-id>/output/<asset-id>.png
remover/users/<user-id>/thumbnail/<asset-id>.webp
```

Rules:

- Do not expose raw keys as authorization.
- Return only signed or controlled URLs where needed.
- Delete marks metadata first, then deletes storage objects.
- Expiration cleanup must select by `expiresAt` and asset status.
- Cleanup must not delete active paid-user assets before their plan retention
  window expires.

## Billing and Entitlements

Use existing Billing and Creem support.

Required behavior:

- Pricing page shows Free, Pro, Studio.
- Checkout uses Creem product mapping.
- Webhook processing is idempotent.
- Active subscription resolves current plan.
- Canceled/failed subscriptions downgrade permissions correctly.
- Entitlements are read from configuration, not React constants.

The remover domain should consume subscription state through billing
application/query functions, not through direct provider calls.

## Auth

Use existing Auth routes and UI.

Login triggers:

- High-res download.
- Guest quota exhausted.
- My Images.
- Subscribe.
- Save or recover results.

The initial upload and low-res result flow must remain available without login.

## Security

All write APIs need:

- Schema validation.
- File MIME and byte validation.
- Image size validation.
- Entitlement checks.
- CSRF/origin protection.
- Rate limits.
- User or anonymous-session authorization.

Current pending hardening:

- Explicit per-IP hourly limits.
- Per-plan concurrent job limits.

Do not log:

- Raw image URLs with private tokens.
- Raw webhook bodies outside the existing webhook inbox/audit pattern.
- Auth cookies, bearer tokens, or provider API keys.

## Frontend Loading

Homepage SEO content must render without loading the heavy editor bundle.

Recommended split:

- Server-rendered homepage content and upload shell.
- Lazy-loaded editor after file selection.
- Canvas editor as client-only UI.
- Polling controller isolated from rendering components.

## Verification Gates

Minimum technical gates for the MVP:

```bash
pnpm lint
pnpm test
SITE=ai-remover pnpm build
SITE=ai-remover pnpm cf:check
SITE=ai-remover pnpm test:remover-guest-limiter-smoke
SITE=ai-remover pnpm test:remover-workers-ai-spike
```

The guest limiter smoke stays anonymous and verifies upload/job limiter `429`
responses without submitting a Workers AI job. The Workers AI spike sets
`SMOKE_AUTH_REQUIRED=true`; release and preview remover AI smoke must use a
seeded authenticated user with active entitlement grants instead of anonymous
guest quota.

The Workers AI spike can run against a local Cloudflare topology when
`DATABASE_URL` or `AUTH_SPIKE_DATABASE_URL` is available, or against an
already-running environment via `REMOVER_WORKERS_AI_SPIKE_BASE_URL`.

Add focused tests for:

- Upload validation.
- Job success commit.
- Job failure refund.
- Duplicate commit/refund prevention.
- Creem webhook subscription sync.
- High-res download authorization.
- My Images permission.
- Expiration cleanup.
