# AI Remover MVP Design

Date: 2026-05-06
Scope: `ai-remover` site instance plus product-specific remover workflow
Status: Draft for review

## Goal

Build AI Remover as a focused AI Object Remover SaaS on top of the existing aooi
platform.

The MVP should let a guest open the homepage, upload a photo, paint a mask over an
unwanted object or person, submit an AI removal job, view the before/after result,
and download a low-res output. Logged-in and paid users get higher limits,
high-res downloads, history, and billing state through the existing platform
modules.

## Product Intent

AI Remover is not a general image editor. It is a fast browser tool for one job:
remove unwanted objects, people, and background distractions from photos.

The product should feel:

- upload-first
- fast
- credible
- creator-friendly
- lighter than Photoshop or Canva
- more trustworthy than a generic free AI tool site

The homepage is both the SEO page and the product tool. There is no separate brand
landing page in the MVP.

## Non-Goals

- No background remover
- No text remover
- No watermark remover
- No logo remover
- No batch processing
- No public API
- No mobile app
- No project management
- No history version tree
- No multi-language SEO pages
- No self-hosted GPU
- No future tool placeholders
- No provider fallback
- No model A/B testing
- No team collaboration
- No annual discount
- No one-time credit purchase flow
- No full professional image editor
- No active watermark or logo detection

## SEO Contract

The first release targets the English market.

Homepage metadata:

- Title: `AI Remover - Remove Objects from Photos for Free`
- H1: `AI Object Remover`
- Subtitle: `Remove unwanted objects, people, and distractions from photos in seconds.`

Primary keyword targets:

- `ai remover`
- `ai object remover`
- `remove objects from photos`
- `remove unwanted objects from photos`
- `remove people from photos`

The page must not claim support for background, text, watermark, or logo removal.

## Target Users

### Everyday user

Wants to remove tourists, clutter, trash cans, wires, or small distractions from
personal photos without learning an editor.

### Creator or social media operator

Wants cleaner thumbnails, posts, avatars, profile photos, and campaign visuals.

### Photographer, designer, or freelancer

Wants a lightweight cleanup workflow that can produce credible results without a
heavy editing app.

E-commerce sellers are not the first wedge, though product-photo cleanup can be
added later.

## Required Pages

- `/`: homepage and remover tool
- `/pricing`: Free, Pro, Studio pricing
- `/my-images`: logged-in image history
- `/settings/billing`: billing status and billing management entry
- `/sign-in`: sign-in
- `/sign-up`: sign-up
- `/privacy`: privacy policy
- `/terms`: terms of service

## Homepage Structure

The first viewport should prioritize product use:

1. Short H1 and subtitle.
2. Prominent upload card.
3. Small before/after example.
4. Process hint: Upload, Brush, Remove, Download.
5. Trust hint: free to try, no sign-up required for low-res download.

The long page should include:

1. Hero tool area.
2. Before/after examples.
3. How it works.
4. Use cases.
5. Feature highlights.
6. Privacy and security.
7. Pricing CTA.
8. FAQ.
9. Related trust content.

Do not add coming-soon tool cards or future tool navigation.

## Core Flows

### Guest Flow

1. Guest opens `/`.
2. Guest uploads JPG, PNG, or WebP.
3. Page switches to editor state.
4. Guest paints a mask.
5. Guest clicks Remove.
6. Backend creates an AI removal job.
7. Frontend shows queued or processing state.
8. Success shows before/after result.
9. Guest downloads low-res output.
10. High-res download triggers sign-in or sign-up.

### Logged-In Free Flow

1. User signs in with Google or email.
2. New user receives 3 high-res download credits.
3. User gets the configured free daily processing quota.
4. User can open `/my-images`.
5. User can download and delete recent results.
6. Free-user assets expire after 7 days.

### Paid Flow

1. User opens `/pricing`.
2. User selects Pro or Studio.
3. Creem Checkout handles subscription.
4. Creem webhook syncs subscription state.
5. Plan entitlements become effective immediately.
6. User gets higher processing quota, high-res quota, and plan permissions.

## Editor Scope

MVP editor must include:

- image upload
- image preview
- brush mask
- eraser
- undo
- reset
- zoom
- pan
- AI Remove button
- processing state
- before/after comparison
- low-res download
- high-res download entry
- login and upgrade prompts

MVP editor must not include:

- version tree
- projects
- multi-step local repair workflow
- batch operation
- API export
- complex export settings

Keep the current lightweight canvas implementation unless it blocks the required
brush, eraser, undo, zoom, pan, and export behavior. `react-konva` is a good
future migration candidate if editor complexity grows, but the MVP should not
switch editor libraries just to chase a cleaner abstraction.

## AI Runtime Strategy

The product effect is image inpainting: original image plus user-painted mask
produces a repaired output image. The MVP should reuse mature model capability
through a hosted provider. It should not train a model or run PyTorch workloads
inside the app runtime.

Preferred provider order:

1. Run a Cloudflare Workers AI inpainting spike with
   `@cf/runwayml/stable-diffusion-v1-5-inpainting`.
2. If quality, latency, availability, or output handling is not acceptable,
   switch the single provider adapter to a hosted GPU API such as Replicate or
   Fal.
3. Consider self-hosted IOPaint, LaMa, or Diffusers only after real volume proves
   that provider cost or quality justifies operating model infrastructure.

Cloudflare Workers and Pages should remain the SaaS orchestration layer:
routing, auth, billing, storage coordination, quota checks, and job status. They
are not an ordinary runtime for SAM, SAM 2, LaMa, IOPaint, or Diffusers model
execution. Those projects are useful references or future infrastructure
options, not MVP app dependencies.

SAM or SAM 2 can become a V2 automatic object-selection feature. It is not needed
for the MVP because manual brush masks already provide the required model input.

## Plans and Entitlements

Default plans:

| Plan   |        Price | Entitlements                                                 |
| ------ | -----------: | ------------------------------------------------------------ |
| Guest  |           $0 | 2 images/day, low-res download                               |
| Free   |           $0 | 5 images/day, 3 sign-up high-res downloads                   |
| Pro    |  $9.99/month | 500 images/month, 300 high-res downloads, advanced mode      |
| Studio | $29.99/month | 2,000 images/month, 1,500 high-res downloads, priority queue |

Entitlements must be configurable. React components must read resolved plan state
instead of hard-coding limits.

## Quota Rules

- Clicking Remove reserves 1 processing quota unit.
- A succeeded job commits the reservation.
- A failed, timed-out, or provider-error job refunds the reservation.
- Repeated status polling must not double-commit or double-refund.
- High-res downloads use separate quota.
- High-res quota is consumed only after high-res result generation or download
  succeeds.

## Image Retention

Retention windows:

- Guest: 24 hours.
- Free logged-in user: 7 days.
- Pro or Studio: 30 days.

Saved assets:

- original image
- mask image
- result image
- thumbnail

Logged-in users can manually delete their assets. Deleted and expired assets must
not remain accessible.

## Architecture

AI Remover should use the aooi multi-site contract:

```text
sites/ai-remover/site.config.json
sites/ai-remover/deploy.settings.json
sites/ai-remover/content/pages/privacy-policy.mdx
sites/ai-remover/content/pages/terms-of-service.mdx
```

Expected capabilities:

```json
{
  "auth": true,
  "payment": "creem",
  "ai": true,
  "docs": false,
  "blog": false
}
```

Runtime code must read site identity through `@/site`. It must not import from
`sites/**`.

## Domain Boundary

Create a focused remover domain:

```text
src/domains/remover/domain/**
src/domains/remover/application/**
src/domains/remover/infra/**
src/domains/remover/ui/**
```

The remover domain owns:

- removal jobs
- image asset metadata
- anonymous session usage
- quota reservation, commit, and refund
- plan entitlement resolution for remover limits
- My Images query and deletion
- high-res download authorization

Reuse existing Auth, Billing, Storage, AI settings, Admin Settings, and Cloudflare
deploy paths. Do not fork those modules.

## Data Model

Use product-specific tables rather than forcing the generic `ai_task` table to
carry remover-only state.

Suggested tables:

- `remover_image_asset`
- `remover_job`
- `remover_quota_reservation`
- `remover_usage_counter`
- `remover_entitlement`, unless an existing central entitlement table is adopted
  during implementation

### `remover_image_asset`

Tracks all stored image objects:

- `id`
- `ownerUserId`
- `anonymousSessionId`
- `kind`: `original`, `mask`, `result`, `thumbnail`
- `storageKey`
- `contentType`
- `byteSize`
- `width`
- `height`
- `status`: `active`, `deleted`, `expired`
- `createdAt`
- `updatedAt`
- `expiresAt`
- `deletedAt`

### `remover_job`

Tracks AI execution:

- `id`
- `ownerUserId`
- `anonymousSessionId`
- `provider`
- `model`
- `providerTaskId`
- `status`: `queued`, `processing`, `succeeded`, `failed`
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

### `remover_quota_reservation`

Tracks idempotent quota transitions:

- `id`
- `subjectType`: `guest`, `user`
- `subjectId`
- `quotaType`: `process`, `high_res_download`
- `amount`
- `status`: `reserved`, `committed`, `refunded`, `expired`
- `idempotencyKey`
- `jobId`
- `createdAt`
- `updatedAt`
- `committedAt`
- `refundedAt`

Add a unique constraint on `idempotencyKey`.

### `remover_usage_counter`

Tracks quota windows:

- `id`
- `subjectType`: `ip`, `guest`, `user`
- `subjectId`
- `quotaType`
- `windowStart`
- `windowEnd`
- `used`
- `reserved`
- `createdAt`
- `updatedAt`

## API Contract

Thin route handlers delegate to remover application use cases.

Required routes:

- `POST /api/remover/upload`
- `POST /api/remover/jobs`
- `GET /api/remover/jobs/:id`
- `POST /api/remover/download/high-res`
- `GET /api/my-images`
- `DELETE /api/my-images/:id`

Optional route:

- `POST /api/remover/jobs/:id/cancel`

All write routes require input validation, authorization, entitlement checks,
CSRF/origin protection, and rate limits.

## Provider Adapter

MVP uses one hosted image inpainting provider behind a small adapter. The first
candidate should be Cloudflare Workers AI inpainting because it fits the
Cloudflare deploy contract. If the spike fails product-quality requirements,
replace that single adapter with Replicate, Fal, or another hosted provider. Do
not implement fallback.

Define the smallest useful adapter:

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

Do not add provider fallback or a multi-provider registry until there are at least
two real providers.

## Storage

Use the existing storage module and Cloudflare R2.

Recommended keys:

```text
remover/guest/<anonymous-session-id>/<job-id>/original.<ext>
remover/guest/<anonymous-session-id>/<job-id>/mask.png
remover/user/<user-id>/<job-id>/original.<ext>
remover/user/<user-id>/<job-id>/mask.png
remover/user/<user-id>/<job-id>/result.<ext>
remover/user/<user-id>/<job-id>/thumbnail.<ext>
```

Storage keys are not authorization. Access must be controlled by route checks,
signed URLs, or storage service policy.

## Billing

Use existing Billing and Creem support.

Required behavior:

- `/pricing` renders Free, Pro, Studio.
- Creem product IDs map to product plan keys.
- Checkout creation works.
- Webhook verification works.
- Subscription status sync is idempotent.
- Active subscription resolves remover entitlements.
- Cancellation and payment failure downgrade access safely.

## Legal and Safety

Privacy and Terms must state:

- images are used only for processing
- images are not used for training
- images expire automatically
- users can delete their own images
- users must have rights to process uploaded images
- users may not remove copyright watermarks, brand logos, or authorization marks

The product copy must avoid promoting watermark, logo, or copyright-mark removal.

## Risks

### Scope inflation

The editor can easily drift toward a full image editor. Keep the MVP limited to
masking, submit, result, and download.

### Quota correctness

Quota reservation, commit, and refund are user-visible billing behavior. This
needs transaction-safe idempotency before paid plans are opened.

### Anonymous usage

Guest processing requires anonymous session state and IP limits. This should be
designed from the start rather than bolted on later.

### Provider mismatch

Not every image AI provider supports the exact original-image plus mask workflow.
Cloudflare Workers AI inpainting is a good MVP spike, but model quality,
latency, availability, output format, and cost must be validated with a real
happy path before polishing UI. Keep the adapter small so the single provider can
be replaced with Replicate or Fal if the spike fails.

### Storage leakage

R2 object URLs must not bypass product authorization, especially after deletion or
expiration.

## Validation

The MVP is successful when:

- Guest can upload, mask, process, view before/after, and download low-res output.
- High-res download requires sign-in.
- New users receive 3 high-res credits.
- Logged-in users can view and delete `/my-images`.
- Failed jobs refund reserved quota.
- Creem checkout and webhook update plan entitlements.
- Privacy and Terms contain image-use and copyright-boundary language.
- Homepage is indexable and does not promise unsupported tools.

Minimum verification commands:

```bash
pnpm lint
pnpm test
SITE=ai-remover pnpm build
SITE=ai-remover pnpm cf:check
```

Required focused tests:

- upload validation
- AI job happy path
- AI job failed refund
- quota reserve, commit, refund idempotency
- Creem webhook subscription sync
- high-res download authorization
- My Images permission
- image expiration cleanup

## Recommended Next Step

Implement the product in phases:

1. Create the `ai-remover` site contract and legal pages.
2. Ship the upload-first homepage shell.
3. Build the local mask editor.
4. Add remover storage, job, and provider happy path.
5. Add quota and download rules.
6. Add My Images and retention.
7. Close the Creem subscription loop.
8. Harden security, limits, and deployment checks.
