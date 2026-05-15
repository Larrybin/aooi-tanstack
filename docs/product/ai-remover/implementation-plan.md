# AI Remover MVP Implementation Plan

## Delivery Principle

Ship the smallest complete workflow first:

```text
upload image -> paint mask -> submit job -> wait -> show result -> download
```

Do not begin with a broad editor, future tool pages, batch workflows, or
provider abstractions for hypothetical providers.

## Phase 0: Site Contract

Goal: make `ai-remover` a real aooi site target.

Tasks:

- Add `sites/ai-remover/site.config.json`.
- Add `sites/ai-remover/deploy.settings.json`.
- Add English privacy and terms content.
- Enable auth, Creem payment, AI, and storage-related deploy requirements.
- Confirm `SITE=ai-remover pnpm build` can select the site.

Done when:

- Site key, domain, brand, capabilities, and deploy settings are aligned.
- No runtime code imports `sites/**`.

## Phase 1: Product Homepage and SEO Shell

Goal: render a credible upload-first homepage before the editor is wired.

Tasks:

- Create AI Object Remover homepage surface.
- Add metadata title, description, H1, FAQ, and compliance copy.
- Add before/after example placeholders using real static assets or generated
  image assets.
- Add upload card and lazy editor entry point.
- Keep future tools out of navigation and page copy.

Done when:

- `/` clearly communicates AI Object Remover.
- Upload is the first-screen focus.
- Page remains indexable without client-side editor execution.

## Phase 2: Local Editor MVP

Goal: produce original image and mask image client-side.

Tasks:

- Add image preview.
- Add brush, eraser, undo, reset.
- Add zoom and pan.
- Export mask as PNG.
- Keep controls compact and mobile-usable.
- Lazy-load editor after upload.

Done when:

- User can upload an image and create a usable mask.
- The page does not load editor code before upload.

## Phase 3: Remover Domain and Storage

Goal: persist image assets and create product-specific metadata.

Current status:

- Added `remover_image_asset`, `remover_quota_reservation`, and `remover_job`
  schema/migration.
- Added `/api/remover/upload`, `/api/remover/jobs`, and
  `/api/remover/jobs/:id`.
- Added anonymous-session ownership, owner-scoped storage keys, and queued job
  creation with processing quota reservation.
- Added provider-configured job submission through `REMOVER_AI_PROVIDER` and
  `REMOVER_AI_MODEL`, plus status refresh, output image storage, and quota
  commit/refund transitions.
- Added controlled low-res/high-res download routes and expiration cleanup.

Tasks:

- Add remover domain folders.
- Add migration/schema for image assets, jobs, quota reservations, and usage.
- Implement upload use case.
- Implement `/api/remover/upload`.
- Store original and mask images in R2 through the existing storage module.
- Add ownership and anonymous session handling.

Done when:

- Guest and logged-in uploads are stored with isolated keys.
- Invalid type/size uploads fail cleanly.
- Asset metadata has expiration timestamps.

## Phase 4: AI Job Happy Path

Goal: submit a removal job to one provider and retrieve a result.

Tasks:

- Choose one provider that supports image + mask inpainting/object removal.
- Add the minimal removal provider adapter.
- Implement job create use case.
- Implement job status query use case.
- Implement `/api/remover/jobs`.
- Implement `/api/remover/jobs/:id`.
- Store output and thumbnail assets.
- Render queued/processing/succeeded/failed states.

Done when:

- One real image can be processed end to end.
- Provider task ID, provider, model, cost units, and status are recorded.

Current implementation note:

- The backend now has a Cloudflare-compatible remover adapter. Set
  `REMOVER_AI_PROVIDER=cloudflare-workers-ai` to use the Cloudflare Workers AI
  binding, or use the existing hosted-provider path for non-Cloudflare
  providers. `REMOVER_AI_MODEL` defaults to
  `@cf/runwayml/stable-diffusion-v1-5-inpainting` for Workers AI and must be
  configured for other providers.
- `GET /api/remover/jobs/:id` refreshes non-terminal provider tasks, stores the
  output image in Storage on success, commits processing quota on success, and
  refunds processing quota on provider/storage failure.
- The status response does not expose the high-res storage URL. Guests receive
  low-res access through `/api/remover/download/low-res`, and high-res download
  goes through the quota-gated `/api/remover/download/high-res` route.
- Successful processing stores separate high-res output and low-res thumbnail
  assets; guest low-res downloads use the thumbnail key, while high-res
  downloads remain quota-gated.
- Runtime spike command:
  `SITE=ai-remover pnpm test:remover-workers-ai-spike`. The command first builds
  the selected AI Remover Cloudflare output, then uploads a generated
  original/mask pair through `/api/remover/upload`, creates a real
  `/api/remover/jobs` job, verifies the public job status DTO, and downloads the
  low-res result through the controlled download route. To run against an
  already-running environment, set `REMOVER_WORKERS_AI_SPIKE_BASE_URL`. Local
  topology mode requires `DATABASE_URL` or `AUTH_SPIKE_DATABASE_URL`.
  For AI Remover-only local values, copy `sites/ai-remover/.env.example` to
  `sites/ai-remover/.env.local`; this site env overlays root `.env.development`
  only when running with `SITE=ai-remover`. Do not put the database URL in
  `.dev.vars`.

## Phase 5: Quota and Download Rules

Goal: make quota behavior correct before paid plans.

Current status:

- Processing quota reservation, commit, and refund are implemented for remover
  jobs.
- Low-res download is available through `POST /api/remover/download/low-res`
  and `GET /api/remover/download/low-res?jobId=...`.
- High-res download is available through `POST /api/remover/download/high-res`,
  requires a logged-in user, and consumes `high_res_download` quota
  idempotently with one charge per user/job.
- Free users use lifetime sign-up high-res credits. Paid plans use monthly
  high-res quota from site pricing entitlements.

Tasks:

- Add real image resizing for low-res output and thumbnails.
- Add explicit per-IP hourly/daily limits.
- Add concurrent job limits per plan.
- Record repeated provider/user failures for abuse review.

Done when:

- Guest daily limit works.
- Free logged-in limit works.
- Failed jobs do not consume processing quota.
- High-res download cannot be used anonymously.
- High-res download cannot be consumed twice for the same user/job.

## Phase 6: My Images and Retention

Goal: give logged-in users a lightweight history.

Current status:

- `/my-images` exists for `ai-remover`, checks the signed-in user, lists the
  user's non-deleted remover jobs, and supports deleting job history.
- Download actions use the same controlled remover download routes as the
  editor.
- `POST /api/remover/cleanup` deletes expired storage objects and marks expired
  assets/jobs deleted. It requires `Authorization: Bearer
${REMOVER_CLEANUP_SECRET}`.

Tasks:

- Show thumbnail, processed time, download action, delete action, and expiration.
- The AI Remover deploy contract requires `REMOVER_CLEANUP_SECRET` and injects
  a public-web Cloudflare cron trigger for the cleanup route.

Done when:

- Users can see only their own images.
- Deleted images are no longer accessible.
- Guest, free, and paid retention windows are respected.

## Phase 7: Creem Subscription Closure

Goal: turn pricing into an actual commercial loop.

Tasks:

- Configure Free, Pro, Studio pricing content.
- Configure Creem product ID mapping.
- Confirm checkout creation.
- Confirm Creem webhook verification and subscription sync.
- Resolve active plan to remover entitlements.
- Downgrade on cancellation/payment failure.
- Show billing status in `/settings/billing`.

Done when:

- Pro and Studio subscriptions update permissions without manual intervention.
- Pricing, billing, and remover quotas agree on plan state.

## Phase 8: Production Hardening

Goal: close security, reliability, and deploy risks.

Tasks:

- Add CSRF/origin protection to write routes.
- Add IP, user, and concurrency rate limits.
- Add user-safe provider errors.
- Add upload and image dimension limits per plan.
- Add structured logs without private data.
- Run full verification commands.
- Browser-test desktop and mobile upload/edit/result flow.

Done when:

- Product acceptance checklist passes.
- Technical gates pass.
- Remaining risks are explicit and non-blocking.

## Recommended First Milestone

The first milestone should stop after Phase 4:

```text
guest upload -> mask -> provider job -> result preview
```

This proves the product's core value before investing in the full billing and
retention surface.
