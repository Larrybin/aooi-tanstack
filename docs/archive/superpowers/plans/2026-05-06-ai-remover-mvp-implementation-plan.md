# AI Remover MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `ai-remover` SaaS site on aooi so guests can remove unwanted objects from a photo, download a low-res result, and convert to logged-in or paid usage for high-res downloads and larger quotas.

**Architecture:** Add a new `sites/ai-remover` site instance, reuse aooi Auth/Billing/Storage/AI/Admin Settings, and place product-specific behavior in a focused `src/domains/remover` domain. Route handlers stay thin. The homepage is the tool page and must lazy-load the editor after upload.

**Tech Stack:** Next.js App Router, TypeScript, React, PostgreSQL, Drizzle,
Cloudflare Workers, Cloudflare R2, Creem, Provider Adapter, Cloudflare Workers
AI inpainting spike, optional hosted GPU provider such as Replicate or Fal

---

## File Structure

### Existing files and areas to read before implementation

- `sites/dev-local/site.config.json`
- `sites/dev-local/deploy.settings.json`
- `src/app/[locale]/(landing)/page.tsx`
- `src/themes/default/pages/landing.tsx`
- `src/themes/default/pages/landing-view.tsx`
- `src/themes/default/blocks/**`
- `src/app/api/storage/upload-image/route.ts`
- `src/app/api/storage/upload-image/upload-image-files.ts`
- `src/domains/ai/application/service.ts`
- `src/domains/ai/infra/ai-task.ts`
- `src/extensions/ai/**`
- `src/infra/runtime/env.server.ts`
- `src/domains/billing/**`
- `src/infra/adapters/payment/creem*.ts`
- `src/config/db/schema.ts`
- `src/shared/lib/api/**`

### Site files to create

- `sites/ai-remover/site.config.json`
- `sites/ai-remover/deploy.settings.json`
- `sites/ai-remover/content/pages/privacy-policy.mdx`
- `sites/ai-remover/content/pages/terms-of-service.mdx`

### Product routes to create or adapt

- `src/app/[locale]/(landing)/page.tsx`, only if the root landing path needs to choose the remover product surface through existing site/product routing
- `src/app/[locale]/(landing)/pricing/page.tsx`, only if current pricing route is not already reusable
- `src/app/[locale]/(member)/my-images/page.tsx`, exact route group may change after reading current app route layout
- `src/app/api/remover/upload/route.ts`
- `src/app/api/remover/jobs/route.ts`
- `src/app/api/remover/jobs/[id]/route.ts`
- `src/app/api/remover/download/high-res/route.ts`
- `src/app/api/my-images/route.ts`
- `src/app/api/my-images/[id]/route.ts`

### Product domain files to create

- `src/domains/remover/domain/job.ts`
- `src/domains/remover/domain/asset.ts`
- `src/domains/remover/domain/quota.ts`
- `src/domains/remover/domain/entitlement.ts`
- `src/domains/remover/application/upload.ts`
- `src/domains/remover/application/create-job.ts`
- `src/domains/remover/application/get-job.ts`
- `src/domains/remover/application/download.ts`
- `src/domains/remover/application/my-images.ts`
- `src/domains/remover/application/cleanup.ts`
- `src/domains/remover/infra/asset-repo.ts`
- `src/domains/remover/infra/job-repo.ts`
- `src/domains/remover/infra/quota-repo.ts`
- `src/domains/remover/infra/provider.ts`
- `src/domains/remover/ui/remover-home.tsx`
- `src/domains/remover/ui/remover-editor.tsx`
- `src/domains/remover/ui/my-images.tsx`

### Database files to modify or create

- Modify: `src/config/db/schema.ts`
- Create: `src/config/db/migrations/<next>_ai_remover.sql`
- Update generated Drizzle migration metadata as required by the repo's migration workflow

### Tests to create

- `src/domains/remover/application/upload.test.ts`
- `src/domains/remover/application/job-flow.test.ts`
- `src/domains/remover/application/quota.test.ts`
- `src/domains/remover/application/my-images.test.ts`
- `src/domains/remover/application/cleanup.test.ts`
- `src/app/api/remover/upload/route.test.ts`
- `src/app/api/remover/jobs/route.test.ts`
- `src/app/api/remover/download/high-res/route.test.ts`
- Creem subscription sync coverage in the existing billing test area if current tests do not cover the remover plan mapping

---

## Task 1: Add the `ai-remover` site contract

**Files:**

- Create: `sites/ai-remover/site.config.json`
- Create: `sites/ai-remover/deploy.settings.json`
- Create: `sites/ai-remover/content/pages/privacy-policy.mdx`
- Create: `sites/ai-remover/content/pages/terms-of-service.mdx`

- [x] **Step 1: Create `sites/ai-remover/site.config.json`**

Use real site identity placeholders that can be safely edited later:

```json
{
  "key": "ai-remover",
  "domain": "airemover.example.com",
  "brand": {
    "appName": "AI Remover",
    "appUrl": "https://airemover.example.com",
    "supportEmail": "support@airemover.example.com",
    "logo": "/logo.png",
    "favicon": "/favicon.ico",
    "previewImage": "/logo.png"
  },
  "capabilities": {
    "auth": true,
    "payment": "creem",
    "ai": true,
    "docs": false,
    "blog": false
  },
  "configVersion": 1
}
```

- [x] **Step 2: Create `sites/ai-remover/deploy.settings.json`**

Follow the current deploy settings shape. Use distinct worker and bucket names:

```json
{
  "configVersion": 1,
  "bindingRequirements": {
    "bindings": {
      "workersAi": true
    },
    "secrets": {
      "authSharedSecret": true,
      "googleOauth": true,
      "githubOauth": false
    },
    "vars": {
      "storagePublicBaseUrl": true
    }
  },
  "workers": {
    "router": "aooi-ai-remover-router",
    "state": "aooi-ai-remover-state",
    "public-web": "aooi-ai-remover-public-web",
    "auth": "aooi-ai-remover-auth",
    "payment": "aooi-ai-remover-payment",
    "member": "aooi-ai-remover-member",
    "chat": "aooi-ai-remover-chat",
    "admin": "aooi-ai-remover-admin"
  },
  "resources": {
    "incrementalCacheBucket": "aooi-ai-remover-opennext-cache",
    "appStorageBucket": "aooi-ai-remover-storage",
    "hyperdriveId": ""
  },
  "state": {
    "schemaVersion": 1
  }
}
```

Do not put provider API keys, OAuth secrets, Creem secrets, or runtime flags in
repo-controlled JSON.

- [x] **Step 3: Write the privacy page**

Include:

- image processing purpose
- no training use
- guest, free, and paid retention windows
- manual delete behavior
- payment data handled by Creem
- support contact

- [x] **Step 4: Write the terms page**

Include:

- user must own or have rights to process uploaded images
- prohibited use for removing copyright watermarks, brand logos, or authorization
  marks
- no guarantee that AI output is perfect
- quota and subscription rules
- deletion and retention terms

- [x] **Step 5: Verify site selection**

Run:

```bash
SITE=ai-remover pnpm build
```

Expected: build selects `sites/ai-remover/site.config.json`. If build fails because
the new product routes are not present yet, capture the failure and continue only
after confirming it is due to missing product implementation, not malformed site
config.

---

## Task 2: Build the upload-first homepage shell

**Files:**

- Create: `src/domains/remover/ui/remover-home.tsx`
- Create: `src/domains/remover/ui/remover-content.ts`
- Modify or create the route/surface that renders `/` for `SITE=ai-remover`

- [x] **Step 1: Read current landing route and theme flow**

Use `rg` and read the smallest set of files needed:

```bash
rg -n "landing|Landing|site\\.key|@/site|metadata|pricing" src/app src/themes src/surfaces
```

Confirm how the current root page chooses content and whether a site-specific
product surface already exists.

- [x] **Step 2: Add remover homepage content**

Required copy:

- Title: `AI Remover - Remove Objects from Photos for Free`
- H1: `AI Object Remover`
- Subtitle: `Remove unwanted objects, people, and distractions from photos in seconds.`
- Process labels: `Upload`, `Brush`, `Remove`, `Download`
- Trust hint: `Free to try. No sign-up required for low-res download.`

- [x] **Step 3: Add the first viewport**

The first viewport must include:

- upload card as the main visual weight
- small before/after example
- no future tool cards
- no giant marketing-only hero that pushes upload below the fold

- [x] **Step 4: Add long-form SEO sections**

Sections:

- Before/after examples
- How it works
- Use cases
- Feature highlights
- Privacy and security
- Pricing CTA
- FAQ

The content must stay focused on objects, people, and distractions.

- [x] **Step 5: Keep editor code out of the initial bundle**

Use lazy loading or a client boundary so the canvas editor loads after file
selection, not on first paint.

- [x] **Step 6: Verify build and metadata**

Run:

```bash
SITE=ai-remover pnpm build
```

Expected:

- homepage builds
- metadata uses AI Remover copy
- unsupported tools are not claimed

---

## Task 3: Implement the client-side editor MVP

**Files:**

- Create: `src/domains/remover/ui/remover-editor.tsx`
- Create: `src/domains/remover/ui/editor-toolbar.tsx`
- Create: `src/domains/remover/ui/canvas-mask-editor.tsx`
- Create: focused tests if existing React test setup supports the editor logic

Use the simplest canvas implementation that satisfies the MVP. Do not migrate to
`react-konva` during MVP unless the existing canvas approach cannot support
brush, eraser, undo, zoom, pan, and mask export cleanly.

- [x] **Step 1: Implement image preview and canvas sizing**

Support JPG, PNG, and WebP previews. Preserve aspect ratio. Fit desktop and mobile
viewports without layout jumps.

- [x] **Step 2: Implement brush and eraser**

Brush and eraser must draw to a mask layer. The mask export format is PNG.

- [x] **Step 3: Implement undo and reset**

Use a simple stack of mask snapshots or stroke operations. Do not add a history
tree.

- [x] **Step 4: Implement zoom and pan**

Keep controls explicit. Use stable icon buttons and tooltips. Mobile should remain
usable at roughly 390px width.

- [ ] **Step 5: Add editor states**

States:

- empty
- image loaded
- mask edited
- uploading
- queued
- processing
- succeeded
- failed

- [ ] **Step 6: Export original file and mask**

The editor must provide:

- original file reference
- mask PNG blob
- image dimensions

- [x] **Step 7: Run UI verification**

Run:

```bash
SITE=ai-remover pnpm build
```

If a dev server is used for visual QA later, inspect desktop and mobile layouts
with the browser tools before marking the editor done.

---

## Task 4: Add remover schema and repositories

**Files:**

- Modify: `src/config/db/schema.ts`
- Create: `src/config/db/migrations/<next>_ai_remover.sql`
- Create: `src/domains/remover/domain/asset.ts`
- Create: `src/domains/remover/domain/job.ts`
- Create: `src/domains/remover/domain/quota.ts`
- Create: `src/domains/remover/infra/asset-repo.ts`
- Create: `src/domains/remover/infra/job-repo.ts`
- Create: `src/domains/remover/infra/quota-repo.ts`

- [ ] **Step 1: Add `remover_image_asset` table**

Fields:

- `id`
- `ownerUserId`
- `anonymousSessionId`
- `kind`
- `storageKey`
- `contentType`
- `byteSize`
- `width`
- `height`
- `status`
- `createdAt`
- `updatedAt`
- `expiresAt`
- `deletedAt`

Add indexes for owner, anonymous session, status, and expiration cleanup.

- [ ] **Step 2: Add `remover_job` table**

Fields:

- `id`
- `ownerUserId`
- `anonymousSessionId`
- `provider`
- `model`
- `providerTaskId`
- `status`
- `inputImageAssetId`
- `maskImageAssetId`
- `outputImageAssetId`
- `thumbnailAssetId`
- `costUnits`
- `quotaReservationId`
- `errorCode`
- `errorMessage`
- `createdAt`
- `updatedAt`
- `expiresAt`

Add indexes for owner, anonymous session, status, provider task ID, and expiration.

- [ ] **Step 3: Add `remover_quota_reservation` table**

Fields:

- `id`
- `subjectType`
- `subjectId`
- `quotaType`
- `amount`
- `status`
- `idempotencyKey`
- `jobId`
- `createdAt`
- `updatedAt`
- `committedAt`
- `refundedAt`

Add a unique constraint on `idempotencyKey`.

- [ ] **Step 4: Add `remover_usage_counter` table**

Fields:

- `id`
- `subjectType`
- `subjectId`
- `quotaType`
- `windowStart`
- `windowEnd`
- `used`
- `reserved`
- `createdAt`
- `updatedAt`

Add a unique constraint for subject, quota type, and window.

- [ ] **Step 5: Add direct repository functions**

Keep functions explicit:

- create asset
- mark asset deleted
- mark asset expired
- create job
- update job status
- find job by ID for owner/session
- create quota reservation
- commit reservation
- refund reservation
- read/update usage counter

Do not introduce generic repository interfaces for a single implementation.

- [ ] **Step 6: Add schema tests**

Run:

```bash
pnpm test
```

If full tests are too broad while developing, first run focused schema/repository
tests, then run full tests before finishing the task.

---

## Task 5: Implement upload API and asset persistence

**Files:**

- Create: `src/domains/remover/application/upload.ts`
- Create: `src/app/api/remover/upload/route.ts`
- Create: `src/domains/remover/application/upload.test.ts`
- Create: `src/app/api/remover/upload/route.test.ts`

- [ ] **Step 1: Reuse existing upload validation patterns**

Read:

- `src/app/api/storage/upload-image/route.ts`
- `src/app/api/storage/upload-image/upload-image-files.ts`

Reuse byte-level MIME detection where possible. Restrict remover uploads to JPG,
PNG, and WebP.

- [ ] **Step 2: Resolve owner context**

Support:

- logged-in user ID
- anonymous session ID
- IP-derived rate-limit subject

Do not require login for the first upload.

- [ ] **Step 3: Resolve entitlement limits**

Default limits:

- Guest: 5MB
- Free logged-in: 10MB
- Paid: 20MB

Keep these values configurable through entitlement/config resolution.

- [ ] **Step 4: Store the original image**

Use R2 through the existing storage service.

Recommended key:

```text
remover/<guest-or-user>/<subject-id>/<upload-or-job-id>/original.<ext>
```

- [ ] **Step 5: Create asset metadata**

Set `expiresAt` based on subject plan:

- guest: 24 hours
- free: 7 days
- paid: 30 days

- [ ] **Step 6: Return a safe response**

Return:

- asset ID
- preview URL or controlled media URL
- image dimensions if available
- max editor limits

Do not return secrets or treat storage keys as authorization.

- [ ] **Step 7: Test upload validation**

Cover:

- unsupported MIME
- spoofed extension
- too large
- missing file
- guest upload accepted
- logged-in upload accepted

Run:

```bash
pnpm test src/domains/remover/application/upload.test.ts src/app/api/remover/upload/route.test.ts
```

---

## Task 6: Implement the removal provider adapter and job happy path

**Files:**

- Create: `src/domains/remover/infra/provider.ts`
- Create: `src/domains/remover/application/create-job.ts`
- Create: `src/domains/remover/application/get-job.ts`
- Create: `src/app/api/remover/jobs/route.ts`
- Create: `src/app/api/remover/jobs/[id]/route.ts`
- Create: `src/domains/remover/application/job-flow.test.ts`
- Create: `src/app/api/remover/jobs/route.test.ts`

- [ ] **Step 1: Run the Cloudflare Workers AI inpainting spike**

Validate `@cf/runwayml/stable-diffusion-v1-5-inpainting` first because it fits
the Cloudflare deployment model and accepts image plus mask input.

The spike must confirm:

- original image input
- mask input
- inpainting output quality for object/person/background distraction removal
- local or staging invocation path from the existing runtime
- output format and storage path
- latency and timeout behavior
- user-safe error mapping
- cost unit estimate

If the spike fails quality, reliability, or runtime constraints, document the
reason in this plan and use one hosted GPU provider such as Replicate or Fal as
the single MVP provider.

Do not run IOPaint, LaMa, Diffusers, SAM, or SAM 2 inside ordinary Cloudflare
Workers or Pages runtime.

Current spike entrypoint:

```bash
SITE=ai-remover pnpm cf:build
SITE=ai-remover pnpm test:remover-workers-ai-spike
```

This command uses the existing Cloudflare local topology, forces
`REMOVER_AI_PROVIDER=cloudflare-workers-ai`, uploads generated PNG original/mask
fixtures through the public remover APIs, creates a real remover job, and
asserts that the output image is stored. Use
`REMOVER_WORKERS_AI_SPIKE_BASE_URL=https://...` to run the same API smoke
against an already-running local, staging, or production-like environment.

- [ ] **Step 2: Select one real provider**

Validate that the provider supports:

- original image input
- mask input
- object removal or inpainting output
- task status query
- result retrieval

Do not implement fallback.

- [x] **Step 3: Define the small adapter**

Use:

```ts
type RemovalProvider = {
  name: string;
  submitTask(input: RemovalSubmitInput): Promise<RemovalSubmitResult>;
  getTaskStatus(input: RemovalStatusInput): Promise<RemovalStatusResult>;
  getResult(input: RemovalResultInput): Promise<RemovalResult>;
  mapProviderError(error: unknown): RemovalProviderError;
  estimateCostUnits(input: RemovalSubmitInput): number;
};
```

Do not add a registry until a second real provider exists.

Current implementation note:

- Added a small remover adapter over the existing AI provider runtime. It uses
  `REMOVER_AI_PROVIDER` (default `cloudflare-workers-ai`) and defaults
  `REMOVER_AI_MODEL` to
  `@cf/runwayml/stable-diffusion-v1-5-inpainting` for Workers AI. Explicit
  non-Cloudflare providers still require `REMOVER_AI_MODEL`.

- [x] **Step 4: Create job use case**

The use case must:

- validate original and mask ownership
- validate current quota and concurrency
- reserve processing quota
- store mask asset
- submit provider task
- create job row
- record provider, model, provider task ID, and cost units

Current implementation note:

- `/api/remover/jobs` validates uploaded asset ownership, reserves processing
  quota with an idempotency key, creates the job row, and submits it to the
  configured provider. Missing provider/model config fails before quota is
  reserved.

- [x] **Step 5: Query job use case**

The use case must:

- authorize by user or anonymous session
- query provider when local job is not terminal
- store result asset and thumbnail on success
- commit quota on success
- refund quota on failure
- return user-safe status and error copy

Current implementation note:

- `GET /api/remover/jobs/:id` authorizes by user or anonymous session, refreshes
  non-terminal provider tasks, stores output assets on success, commits quota on
  success, and refunds quota on provider or output-storage failure.

- [x] **Step 6: Wire route handlers**

Routes:

- `POST /api/remover/jobs`
- `GET /api/remover/jobs/:id`

Use existing `withApi`, parse helpers, error helpers, and request context patterns.

- [ ] **Step 7: Connect editor polling**

The editor should:

- submit original asset ID and mask blob
- show queued/processing
- poll job status
- stop polling on succeeded or failed
- display before/after on success
- display actionable error copy on failure

- [x] **Step 8: Test the happy path**

Use a fake provider in tests.

Cover:

- job created
- provider task submitted once
- status transitions to succeeded
- output asset created
- quota committed once

Run:

```bash
pnpm test src/domains/remover/application/job-flow.test.ts src/app/api/remover/jobs/route.test.ts
```

Implemented focused coverage in
`src/domains/remover/application/processing.test.ts` for provider submission,
success commit/output storage, failure refund, and queued no-op refresh.

---

## Task 7: Implement quota, abuse limits, and high-res download

**Files:**

- Create or modify: `src/domains/remover/domain/entitlement.ts`
- Create or modify: `src/domains/remover/application/download.ts`
- Create: `src/app/api/remover/download/high-res/route.ts`
- Create: `src/domains/remover/application/quota.test.ts`
- Create: `src/app/api/remover/download/high-res/route.test.ts`

- [ ] **Step 1: Implement entitlement resolution**

Default entitlements:

- Guest: 2 images/day, low-res only
- Free: 5 images/day, 3 sign-up high-res credits
- Pro: 500 images/month, 300 high-res downloads
- Studio: 2,000 images/month, 1,500 high-res downloads

Read subscription state through billing application/query functions. Do not call
Creem directly from remover code.

- [x] **Step 2: Implement quota reservation transitions**

Functions:

- reserve
- commit
- refund

Each transition must be idempotent and transaction-safe.

Current implementation note:

- Reservation creation is wired into `/api/remover/jobs` and protected by an
  idempotency key.
- Domain transition helpers make commit/refund idempotent within their terminal
  states.
- Provider success/failure refresh now calls commit/refund through the remover
  job status flow.

- [ ] **Step 3: Add guest and IP rate limits**

Limits:

- anonymous session daily processing count
- IP hourly and daily request count
- per-plan concurrent job limit

Use existing limiter patterns where possible.

- [ ] **Step 4: Add low-res download**

Guest can download low-res result after successful job.

Implementation may either:

- store a low-res derivative as the result exposed to guests, or
- generate/serve a controlled compressed derivative

Pick the simpler path that matches available image tooling in the repo.

- [ ] **Step 5: Add high-res download endpoint**

`POST /api/remover/download/high-res` must:

- require login
- validate job ownership
- validate job success
- reserve high-res quota
- commit only after success
- return controlled download response

- [ ] **Step 6: Add sign-up high-res grant**

New users receive 3 high-res download credits. Prefer existing account/credit
grant patterns if they fit. Otherwise add a remover-specific grant path that is
idempotent per user.

- [ ] **Step 7: Test quota correctness**

Cover:

- guest limit reached
- logged-in free limit reached
- success commits reservation
- failure refunds reservation
- duplicate commit is safe
- duplicate refund is safe
- high-res requires login
- high-res consumes separate quota

Run:

```bash
pnpm test src/domains/remover/application/quota.test.ts src/app/api/remover/download/high-res/route.test.ts
```

---

## Task 8: Add My Images and retention cleanup

**Files:**

- Create: `src/domains/remover/application/my-images.ts`
- Create: `src/domains/remover/application/cleanup.ts`
- Create: `src/domains/remover/ui/my-images.tsx`
- Create: `src/app/api/my-images/route.ts`
- Create: `src/app/api/my-images/[id]/route.ts`
- Create: `src/domains/remover/application/my-images.test.ts`
- Create: `src/domains/remover/application/cleanup.test.ts`

- [ ] **Step 1: Add My Images query**

Return for the current user only:

- thumbnail
- processed time
- expiration
- download permission
- delete permission

Do not return guest images in `/my-images`.

- [ ] **Step 2: Add My Images page**

UI should be a simple history list, not project management.

Each item shows:

- thumbnail
- processing date
- download action
- delete action
- expiration hint

- [ ] **Step 3: Add delete use case**

Delete must:

- require current user
- verify ownership
- mark related metadata deleted
- remove or invalidate original, mask, result, and thumbnail access

- [ ] **Step 4: Add cleanup use case**

Cleanup must:

- find expired active assets/jobs
- mark metadata expired
- delete storage objects where possible
- avoid deleting active paid-user assets before their retention window

- [ ] **Step 5: Test My Images permissions**

Cover:

- user sees own images
- user cannot see another user's images
- user can delete own images
- user cannot delete another user's images

- [ ] **Step 6: Test cleanup**

Cover:

- guest 24-hour expiration
- free 7-day expiration
- paid 30-day expiration
- already deleted assets are skipped

Run:

```bash
pnpm test src/domains/remover/application/my-images.test.ts src/domains/remover/application/cleanup.test.ts
```

---

## Task 9: Close Creem pricing and billing loop

**Files:**

- Modify pricing content/config where the current pricing surface reads its items
- Modify billing runtime settings or seed/config docs if required for Creem product mapping
- Add focused tests in existing billing/remover test files

- [ ] **Step 1: Find current pricing source**

Run:

```bash
rg -n "pricing|Pricing|product_id|payment_product_id|creemProductIds|creem_product_ids" src sites
```

Use the existing pricing source instead of creating a second pricing system.

- [ ] **Step 2: Define Free, Pro, Studio**

Required prices:

- Pro: `$9.99/month`
- Studio: `$29.99/month`

Required plan keys:

- `free`
- `pro`
- `studio`

- [ ] **Step 3: Wire Creem product mapping**

Creem product IDs must be configurable through the existing payment settings path.
Do not store real Creem secrets in the repo.

- [ ] **Step 4: Resolve active plan for remover**

The remover entitlement resolver should map:

- no login to Guest
- logged-in without active paid subscription to Free
- active Pro subscription to Pro
- active Studio subscription to Studio

- [ ] **Step 5: Verify webhook idempotency**

Use existing Creem webhook inbox/audit behavior. Add remover-specific assertions
only where plan entitlement mapping needs coverage.

- [ ] **Step 6: Verify billing page entry**

`/settings/billing` should show meaningful current billing state for paid users.
Do not fork the billing page for AI Remover unless the existing surface cannot
represent the needed state.

- [ ] **Step 7: Run billing tests**

Run:

```bash
pnpm test:creem-webhook-spike
pnpm test
```

---

## Task 10: Security, legal copy, and UX hardening

**Files:**

- Modify remover route handlers
- Modify privacy and terms pages if gaps remain
- Modify homepage FAQ and upload hints
- Add tests near changed use cases/routes

- [ ] **Step 1: Add CSRF and origin checks to write routes**

Routes:

- `POST /api/remover/upload`
- `POST /api/remover/jobs`
- `POST /api/remover/download/high-res`
- `DELETE /api/my-images/:id`

Use existing API guard patterns.

- [ ] **Step 2: Add safe error messages**

Provider and storage errors should be mapped to user-safe messages. Do not expose
raw provider payloads, keys, signed URLs, or stack traces.

- [ ] **Step 3: Add upload and image dimension limits**

Limits must vary by entitlement and remain configurable.

- [ ] **Step 4: Add compliance copy**

Homepage FAQ, Terms, and Privacy must state:

- images are not used for training
- images expire automatically
- manual delete is available for logged-in users
- users must own or have rights to process uploaded images
- copyright watermarks, brand logos, and authorization marks may not be removed

- [ ] **Step 5: Add structured logs**

Log:

- job ID
- provider
- status transition
- quota reservation ID
- error code

Do not log:

- auth cookies
- provider keys
- raw webhook secrets
- private signed URLs

- [ ] **Step 6: Run security-focused tests**

Run route and use-case tests for:

- unauthorized high-res download
- cross-user image access
- expired image access
- malformed upload
- repeated failed jobs

---

## Task 11: Full verification

**Files:**

- No planned source changes unless verification finds defects

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

- [ ] **Step 2: Run tests**

```bash
pnpm test
```

- [ ] **Step 3: Run AI Remover build**

```bash
SITE=ai-remover pnpm build
```

- [ ] **Step 4: Run Cloudflare contract check**

```bash
SITE=ai-remover pnpm cf:check
```

- [ ] **Step 5: Run local smoke checks if deploy semantics changed**

Use the existing Cloudflare smoke commands if the implementation touches
Cloudflare runtime bindings, storage behavior, payment callbacks, or route split
behavior:

```bash
SITE=ai-remover pnpm test:cf-local-smoke
SITE=ai-remover pnpm test:cf-app-smoke
```

- [ ] **Step 6: Browser QA**

Run the app and verify:

- desktop homepage
- mobile homepage around 390px width
- guest upload
- mask drawing
- remove job processing
- before/after result
- low-res download
- high-res login prompt
- logged-in My Images
- pricing CTA

Fix layout overlap, unreadable text, blank canvas, and broken image states before
calling the MVP ready.

---

## Completion Criteria

- [ ] `sites/ai-remover` exists and selects correctly with `SITE=ai-remover`.
- [ ] Homepage is upload-first and indexable.
- [ ] Editor supports upload, mask, eraser, undo, reset, zoom, pan, remove, and before/after.
- [ ] Guest can process an image and download low-res output.
- [ ] High-res download requires login.
- [ ] New logged-in user receives 3 high-res credits.
- [ ] Quota reservation, commit, and refund are idempotent.
- [ ] Pro and Studio subscriptions resolve to correct entitlements.
- [ ] Logged-in user can view and delete `/my-images`.
- [ ] Expiration cleanup respects guest, free, and paid retention.
- [ ] Terms and Privacy cover image rights, no training, retention, deletion, and prohibited watermark/logo removal.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes.
- [ ] `SITE=ai-remover pnpm build` passes.
- [ ] `SITE=ai-remover pnpm cf:check` passes.

## Do Not Do During MVP

- Do not add provider fallback.
- Do not add a provider registry for one provider.
- Do not build a full image editor.
- Do not self-host IOPaint, LaMa, Diffusers, SAM, or SAM 2 inside ordinary
  Cloudflare Workers or Pages runtime.
- Do not add SAM or SAM 2 automatic object selection during MVP.
- Do not migrate to `react-konva` unless the current canvas editor blocks MVP
  behavior.
- Do not add background/text/watermark/logo remover pages.
- Do not add batch processing.
- Do not add public API access.
- Do not fork Auth, Billing, Storage, or AI platform modules.
- Do not import `sites/**` from runtime code.
- Do not hard-code plan limits into React components.
- Do not expose storage keys or signed URLs as authorization.
