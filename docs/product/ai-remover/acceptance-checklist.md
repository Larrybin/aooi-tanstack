# AI Remover MVP Acceptance Checklist

## Product Flow

- [ ] Guest can open `/` and immediately understand the upload workflow.
- [ ] Guest can upload JPG, PNG, or WebP.
- [ ] Guest can paint a mask over an unwanted object/person/distraction.
- [ ] Guest can erase, undo, reset, zoom, and pan.
- [ ] Guest can click Remove.
- [ ] Guest sees queued/processing state.
- [ ] Guest sees before/after result on success.
- [ ] Guest can download low-res result.
- [ ] High-res download asks guest to sign in or sign up.
- [ ] New logged-in user receives 3 high-res download credits.
- [ ] Logged-in user can open `/my-images`.
- [ ] Logged-in user can download and delete own historical results.

## AI Job Reliability

- [ ] Job statuses cover `queued`, `processing`, `succeeded`, and `failed`.
- [ ] Provider task ID is recorded.
- [ ] Provider name is recorded.
- [ ] Model name is recorded.
- [ ] Cost units are recorded.
- [ ] Successful job stores output image and thumbnail metadata.
- [ ] Failed provider response stores user-safe error code/message.
- [ ] Polling does not create duplicate provider tasks.
- [ ] Re-checking a succeeded job does not duplicate quota commits.
- [ ] Re-checking a failed job does not duplicate quota refunds.

## Quota and Entitlements

- [ ] Guest receives 2 processing jobs per day by default.
- [ ] Free logged-in user receives 5 processing jobs per day by default.
- [ ] Pro receives 500 processing jobs per month by default.
- [ ] Studio receives 2,000 processing jobs per month by default.
- [ ] Pro receives 300 high-res downloads per month by default.
- [ ] Studio receives 1,500 high-res downloads per month by default.
- [ ] Processing quota is reserved on Remove click.
- [ ] Processing quota is committed only after job success.
- [ ] Processing quota is refunded on failure, timeout, or provider error.
- [ ] High-res quota is separate from processing quota.
- [ ] High-res quota is consumed only after successful high-res download.
- [ ] Quota limits are configurable and not hard-coded into UI components.

## Billing

- [ ] `/pricing` shows Free, Pro, and Studio.
- [ ] Pro price is $9.99/month.
- [ ] Studio price is $29.99/month.
- [ ] Creem Checkout opens for Pro.
- [ ] Creem Checkout opens for Studio.
- [ ] Creem webhook verification works.
- [ ] Subscription activation updates user entitlement.
- [ ] Subscription cancellation downgrades entitlement at the correct time.
- [ ] Payment failure handles entitlement safely.
- [ ] `/settings/billing` shows current billing state.

## Storage and Privacy

- [ ] Original image is stored.
- [ ] Mask image is stored.
- [ ] Result image is stored.
- [ ] Thumbnail is stored.
- [ ] Guest assets expire after 24 hours.
- [ ] Free logged-in assets expire after 7 days.
- [ ] Pro/Studio assets expire after 30 days.
- [ ] Manual delete removes access to original, mask, result, and thumbnail.
- [ ] Users cannot access another user's image assets.
- [ ] Anonymous sessions cannot access another anonymous session's assets.
- [ ] Privacy page states images are used only for processing.
- [ ] Privacy page states images are not used for training.
- [ ] Terms prohibit removing copyright watermarks, logos, and authorization
  marks.

## SEO and Content

- [ ] Homepage title contains `AI Remover`.
- [ ] Homepage H1 is `AI Object Remover`.
- [ ] Homepage description targets object/person/distraction removal.
- [ ] FAQ is present and relevant.
- [ ] Before/after examples have useful alt text.
- [ ] Page does not claim background remover support.
- [ ] Page does not claim text remover support.
- [ ] Page does not claim watermark remover support.
- [ ] Page does not claim logo remover support.
- [ ] Homepage remains indexable without login.

## Security and Abuse Controls

- [ ] Upload route validates MIME type using file bytes.
- [ ] Upload route validates file size by entitlement.
- [ ] Upload route validates supported image dimensions.
- [ ] Write routes check CSRF/origin.
- [ ] Guest usage is limited by anonymous session and IP.
- [ ] Logged-in usage is limited by user ID.
- [ ] Per-IP hourly/daily limits exist.
- [ ] Concurrent job limits exist per plan.
- [ ] Repeated failures are recorded for abuse review.
- [ ] Provider keys and payment secrets are never exposed to the client.

## Required Verification Commands

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `SITE=ai-remover pnpm build`
- [ ] `SITE=ai-remover pnpm cf:check`
- [ ] `SITE=ai-remover pnpm test:remover-workers-ai-spike`

## Required Focused Tests

- [ ] AI job happy path.
- [ ] AI job failed refund.
- [ ] Quota reserve/commit/refund idempotency.
- [ ] Creem webhook subscription sync.
- [ ] Upload validation.
- [ ] High-res download authorization.
- [ ] My Images permission.
- [ ] Image expiration cleanup.
