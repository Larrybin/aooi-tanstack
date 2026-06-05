# Acceptance Checklist

## Tool Flow

- [ ] `/` renders as the main Text to Speech Generator page.
- [ ] Guest can generate preview after Turnstile.
- [ ] Guest is limited to 5 previews/IP/day.
- [ ] Guest cannot download MP3.
- [ ] Login user can generate and download MP3.
- [ ] Playback speed changes player speed only.
- [ ] Downloaded MP3 is not falsely described as speed-adjusted.

## Quota / Credits

- [ ] Free user monthly quota is 10,000 characters.
- [ ] Lifetime Basic monthly quota is 100,000 characters.
- [ ] Lifetime Pro monthly quota is 500,000 characters.
- [ ] Extra Credits package grants 250,000 characters.
- [ ] Extra Credits expire after 365 days.
- [ ] Monthly quota is consumed before Extra Credits.
- [ ] Generate charges quota/credits.
- [ ] Replay does not charge.
- [ ] Download does not charge.
- [ ] Failed TTS generation rolls back reservation.
- [ ] Matching unexpired request hash reuses audio.

## Payment

- [ ] Creem checkout exists for Lifetime Basic.
- [ ] Creem checkout exists for Lifetime Pro.
- [ ] Creem checkout exists for Extra Credits.
- [ ] Webhook signature is verified.
- [ ] Webhook is idempotent.
- [ ] Purchase grants entitlement/credits.
- [ ] Refund handling is implemented or explicitly guarded.

## History / Storage / Privacy

- [ ] Free history limit is 3.
- [ ] Lifetime Basic history limit is 20.
- [ ] Lifetime Pro history limit is 50.
- [ ] Free audio expires after 3 days.
- [ ] Lifetime Basic audio expires after 30 days.
- [ ] Lifetime Pro audio expires after 90 days.
- [ ] Full original text is not saved.
- [ ] First 100 characters preview is saved.
- [ ] Expired audio cannot be downloaded.

## SEO

- [ ] 10 SEO pages exist.
- [ ] Pricing, FAQ, Privacy Policy, Terms exist.
- [ ] Each SEO page has unique title.
- [ ] Each SEO page has unique H1.
- [ ] Each SEO page has unique meta description.
- [ ] Each SEO page has page-specific FAQ.
- [ ] Sitemap includes approved indexable pages.
- [ ] Canonical tags are correct.
- [ ] No language pages exist in v1.
- [ ] No PDF/document/article pages exist in v1.

## Claims / Safety

- [ ] Site does not claim unlimited free generation.
- [ ] Site does not claim 100+ languages.
- [ ] Site does not claim 500+ voices.
- [ ] Terms prohibit impersonation, scams, illegal use, harassment, sexual exploitation, deepfakes, and rights infringement.
- [ ] Basic rule-based content blocking exists.
