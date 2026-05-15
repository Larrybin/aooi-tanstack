# AI Remover MVP Product Requirements

## Product Positioning

AI Remover is a focused SaaS tool for removing unwanted objects, people, and
visual distractions from photos in the browser.

The MVP product is AI Object Remover. It should feel faster and more trustworthy
than a generic free AI tool site, while staying much lighter than a full image
editor.

## SEO Contract

- Title: `AI Remover - Remove Objects from Photos for Free`
- H1: `AI Object Remover`
- Subtitle: `Remove unwanted objects, people, and distractions from photos in seconds.`
- Primary keywords:
  - `ai remover`
  - `ai object remover`
  - `remove objects from photos`
  - `remove unwanted objects from photos`
  - `remove people from photos`

The MVP must not target or promote background remover, watermark remover, text
remover, or logo remover queries.

## Target Users

- Everyday users cleaning travel, family, social, and personal photos.
- Creators and social media operators cleaning thumbnails, posts, avatars, and
  ad creatives.
- Photographers, designers, and freelancers who need a fast browser-based cleanup
  workflow.

E-commerce, batch processing, API access, and team workflows are future segments,
not MVP scope.

## Pages

- `/`: homepage and core tool page.
- `/pricing`: Free, Pro, and Studio pricing.
- `/my-images`: lightweight logged-in image history.
- `/settings/billing`: billing status and management entry.
- `/sign-in`: sign-in.
- `/sign-up`: sign-up.
- `/privacy`: privacy policy.
- `/terms`: terms of service.

The homepage is the product surface. Do not add a separate brand-only landing
page for MVP.

## Homepage Structure

The first viewport must prioritize upload and immediate product use:

1. Short H1 and subtitle.
2. Prominent upload card.
3. Small before/after example.
4. Clear process: Upload, Brush, Remove, Download.
5. Trust hint: free to try, no sign-up for low-res download.

Long-form content sections:

1. Hero tool area.
2. Before/after examples.
3. How it works.
4. Use cases.
5. Feature highlights.
6. Privacy and security.
7. Pricing CTA.
8. FAQ.
9. Related trust content.

Do not show future tools, coming soon tools, or unrelated tool entry points.

## Core User Flows

### Guest Flow

1. User opens `/`.
2. User uploads JPG, PNG, or WebP.
3. The same page enters editor state.
4. User paints the object/person/distraction mask.
5. User clicks Remove.
6. Backend creates an AI removal job.
7. Frontend shows queued/processing state.
8. Success shows before/after result.
9. Guest can download a low-res result.
10. High-res download triggers sign-in/sign-up.

### Logged-In Free Flow

1. User signs in with Google or email.
2. New user receives 3 high-res download credits.
3. User receives the configured daily free processing quota.
4. User can open `/my-images`.
5. User can download or delete recent images.
6. Free-user assets expire after 7 days.

### Paid Flow

1. User opens `/pricing`.
2. User selects Pro or Studio.
3. Creem Checkout handles subscription.
4. Creem webhook synchronizes subscription state.
5. Entitlements update immediately.
6. User receives higher processing quota, high-res download quota, and plan
   permissions.

## Editor MVP

Must have:

- Image upload.
- Image preview.
- Brush mask.
- Eraser.
- Undo.
- Reset.
- Zoom and pan.
- AI Remove button.
- Processing state.
- Before/after comparison.
- Low-res download.
- High-res download entry.
- Login and upgrade prompts.

Must not have:

- History version tree.
- Project management.
- Multi-step local repair workflow.
- Batch processing.
- Public API.
- Complex export presets.

## Pricing and Entitlements

Default plans:

| Plan | Price | Entitlements |
| --- | ---: | --- |
| Guest | $0 | 2 images/day, low-res download |
| Free | $0 | 5 images/day, 3 sign-up high-res downloads |
| Pro | $9.99/month | 500 images/month, 300 high-res downloads, advanced mode |
| Studio | $29.99/month | 2,000 images/month, 1,500 high-res downloads, priority queue |

All limits must be configurable through product settings or plan entitlement
configuration, not hard-coded into React components.

## Quota Rules

- Clicking Remove reserves 1 processing quota unit.
- A succeeded job commits the reservation.
- Failed, timed-out, or provider-error jobs refund the reservation.
- High-res downloads use a separate quota.
- High-res quota is consumed only after high-res generation/download succeeds.
- Duplicate commit and duplicate refund must be prevented.

## Image Retention

- Guest: 24 hours.
- Free logged-in user: 7 days.
- Pro/Studio: 30 days.

Saved assets:

- Original image.
- Mask image.
- Result image.
- Thumbnail.

Users must be able to delete their own saved images. Deleted or expired assets
must no longer be accessible.

## Compliance Boundaries

The product must state:

- Users must have rights to process uploaded images.
- The tool must not be used to remove copyright watermarks, brand logos, or
  authorization marks.
- Uploaded images are used only for processing.
- Uploaded images are not used for model training.
- Images expire automatically based on the retention policy.
- Logged-in users can manually delete their own images.

## Non-Goals

- Background remover.
- Text remover.
- Watermark remover.
- Logo remover.
- Batch processing.
- API.
- Mobile app.
- Complex project management.
- Version tree.
- Multi-language SEO pages.
- Self-hosted GPU.
- Future tool placeholders.
- Provider fallback.
- Model A/B testing.
- Team collaboration.
- Annual discount.
- One-time credit purchases.
- Full professional image editor.
- Active watermark/logo detection.

