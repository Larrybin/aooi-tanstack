# AI Remover MVP Acceptance Checklist

Status:

- [x] Implemented in source/config and covered by focused code/tests where
      applicable.
- [ ] Still requires runtime/product acceptance proof, or remains a known gap.

## Product Flow

- [x] Guest can open `/` and immediately understand the upload workflow.
- [x] Guest can upload JPG, PNG, or WebP.
- [x] Guest can paint a mask over an unwanted object/person/distraction.
- [x] Guest can erase, undo, reset, zoom, and pan.
- [x] Guest can click Remove.
- [x] Guest sees queued/processing state.
- [x] Guest sees before/after result on success.
- [x] Guest can download low-res result.
- [x] High-res download asks guest to sign in or sign up.
- [x] New logged-in user receives 3 high-res download credits through the Free
      plan lifetime high-res entitlement.
- [x] Logged-in user can open `/my-images`.
- [x] Logged-in user can download and delete own historical results.

## AI Job Reliability

- [x] Job statuses cover `queued`, `processing`, `succeeded`, and `failed`.
- [x] Provider task ID is recorded.
- [x] Provider name is recorded.
- [x] Model name is recorded.
- [x] Cost units are recorded.
- [x] Successful job stores output image and thumbnail metadata.
- [x] Failed provider response stores user-safe error code/message.
- [x] Polling does not create duplicate provider tasks.
- [x] Re-checking a succeeded job does not duplicate quota commits.
- [x] Re-checking a failed job does not duplicate quota refunds.

## Quota and Entitlements

- [x] Guest receives 2 processing jobs per day by default.
- [x] Free logged-in user receives 5 processing jobs per day by default.
- [x] Pro receives 500 processing jobs per month by default.
- [x] Studio receives 2,000 processing jobs per month by default.
- [x] Pro receives 300 high-res downloads per month by default.
- [x] Studio receives 1,500 high-res downloads per month by default.
- [x] Processing quota is reserved on Remove click.
- [x] Processing quota is committed only after job success.
- [x] Processing quota is refunded on provider or storage failure.
- [ ] Processing quota is refunded on job timeout.
- [x] High-res quota is separate from processing quota.
- [x] High-res quota is consumed only after successful high-res download.
- [x] Quota limits are configurable and not hard-coded into UI components.

## Billing

- [x] `/pricing` shows Free, Pro, and Studio.
- [x] Pro price is $9.99/month.
- [x] Studio price is $29.99/month.
- [ ] Creem Checkout opens for Pro.
- [ ] Creem Checkout opens for Studio.
- [ ] Creem webhook verification works.
- [ ] Subscription activation updates user entitlement.
- [ ] Subscription cancellation downgrades entitlement at the correct time.
- [ ] Payment failure handles entitlement safely.
- [x] `/settings/billing` shows current billing state.

## Storage and Privacy

- [x] Original image is stored.
- [x] Mask image is stored.
- [x] Result image is stored.
- [x] Thumbnail is stored.
- [x] Guest assets expire after 24 hours.
- [x] Free logged-in assets expire after 7 days.
- [x] Pro/Studio assets expire after 30 days.
- [x] Manual delete removes access to original, mask, result, and thumbnail.
- [x] Users cannot access another user's image assets.
- [x] Anonymous sessions cannot access another anonymous session's assets.
- [x] Privacy page states images are used only for processing.
- [x] Privacy page states images are not used for training.
- [x] Terms prohibit removing copyright watermarks, logos, and authorization
      marks.

## SEO and Content

- [x] Homepage title contains `AI Remover`.
- [x] Homepage H1 is `AI Object Remover`.
- [x] Homepage description targets object/person/distraction removal.
- [x] FAQ is present and relevant.
- [ ] Before/after examples have useful alt text.
- [x] Page does not claim background remover support.
- [x] Page does not claim text remover support.
- [x] Page does not claim watermark remover support.
- [x] Page does not claim logo remover support.
- [x] Homepage remains indexable without login.

## Security and Abuse Controls

- [x] Upload route validates MIME type using file bytes.
- [x] Upload route validates file size by entitlement.
- [ ] Upload route validates supported image dimensions.
- [x] Write routes check CSRF/origin.
- [x] Guest usage is limited by anonymous session and IP.
- [x] Logged-in usage is limited by user ID.
- [x] Guest per-IP daily upload/job limits exist.
- [ ] Per-IP hourly limits exist.
- [ ] Concurrent job limits exist per plan.
- [ ] Repeated failures are recorded for abuse review.
- [x] Provider keys and payment secrets are never exposed to the client.

## Required Verification Commands

- [ ] `pnpm test`
- [ ] `pnpm lint`
- [ ] `pnpm arch:check`
- [ ] `SITE=ai-remover pnpm build`
- [ ] `SITE=ai-remover pnpm contract:check`
- [ ] `SITE=ai-remover pnpm cf:check`
- [ ] `pnpm cf:build:no-db --site=ai-remover`
- [ ] `SITE=ai-remover pnpm test:remover-guest-limiter-smoke`
- [ ] `SITE=ai-remover pnpm test:remover-workers-ai-spike`

`SITE=ai-remover pnpm cf:check` needs production runtime bindings. A
structure-only local/CI run may use placeholders for `BETTER_AUTH_SECRET` or
`AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`,
`CREEM_API_KEY`, `CREEM_SIGNING_SECRET`, `STORAGE_PUBLIC_BASE_URL`, and
`REMOVER_CLEANUP_SECRET`, but that run is not deploy-ready evidence.

## Final Foundation Smoke Path

- [ ] Guest upload.
- [ ] Guest create job.
- [ ] Guest poll job.
- [ ] Guest download low-res result.
- [ ] Guest high-res download is blocked or charged.
- [ ] Logged-in user continues through the same ownership path.
- [ ] Internal grant user can create a job.
- [ ] Quota exceeded path returns the expected error.
- [ ] Provider failure refunds processing quota.
- [ ] Expired asset/download path denies access.

## Required Focused Tests

- [x] AI job happy path.
- [x] AI job failed refund.
- [x] Quota reserve/commit/refund idempotency.
- [x] Creem webhook subscription sync.
- [x] Upload validation.
- [x] High-res download authorization.
- [x] My Images permission.
- [x] Image expiration cleanup.
