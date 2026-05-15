# Storage Module

## What This Module Does

Storage adds managed asset upload and retrieval paths:

- brand asset uploads
- image upload APIs
- storage-backed media URLs

## Required Configuration

- Cloudflare Wrangler binding `APP_STORAGE_R2_BUCKET`
- Cloudflare Wrangler binding `NEXT_INC_CACHE_R2_BUCKET`
- Router/public-web Cloudflare Images binding `IMAGES`
- Runtime binding `STORAGE_PUBLIC_BASE_URL`

## External Services

- Cloudflare R2

## Minimum Verification Commands

- `pnpm test:r2-upload-spike`

## Common Failure Modes

- Upload succeeds but `STORAGE_PUBLIC_BASE_URL` is missing or malformed, so the public URL cannot be derived.
- Brand asset upload is enabled before `APP_STORAGE_R2_BUCKET` is bound in the Cloudflare runtime.
- Admin stores a brand asset `objectKey`, but the runtime cannot derive the final public URL.

## Product Impact If Disabled

Uploads and storage-backed brand assets stop working, but the shell can still run with static assets.
