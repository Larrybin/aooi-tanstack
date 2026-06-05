# SPEC: Text to Speech Generator SaaS v1

Version: v1.0  
Date: 2026-06-05  
Repository target: `Larrybin/aooi`  
Site key: `text-to-speech-generator`  
Brand: `Text to Speech Generator`  
Production domain: `TBD`  
Domain strategy: precise keyword domain first  
Homepage route: `/`  
Core keyword: `text to speech generator`

---

## 1. Problem Statement

Users searching for **text to speech generator**, **online text to speech**, **free text to speech**, **read aloud**, and **text reader** usually want a fast and direct workflow:

> Paste text → generate speech → listen online → sign in → download MP3.

The target market has three common product patterns:

1. **Minimal free tools**: fast and easy, but weak SaaS conversion and poor account/credit systems.
2. **Mature reading SaaS platforms**: rich feature sets such as PDFs, document readers, extensions, and mobile apps, but too heavy for a v1 build.
3. **Free AI TTS tools**: strong SEO and low entry friction, but often risky around cost control, abuse, and overpromising unlimited usage.

The v1 problem to solve:

> Build an SEO-first Online Text to Speech Generator that lets visitors preview generated speech immediately, requires login for MP3 downloads, and establishes a lightweight SaaS monetization loop with lifetime plans and extra credits.

Secondary user focus:

> Students and reading-efficiency users who want to convert notes, short articles, and learning material into speech for listening, review, and comprehension.

---

## 2. Proposed Solution

### 2.1 Product Positioning

Primary positioning:

> **Online Text to Speech Generator** — turn text into natural speech, preview online, and download MP3 after sign-in.

v1 is **not** an ElevenLabs replacement and is **not** a full NaturalReader clone. It is:

- an SEO landing experience,
- a directly usable TTS generator,
- a Cloudflare Workers AI powered speech generator,
- a login-gated MP3 download tool,
- a lifetime-membership and extra-credit SaaS product.

### 2.2 Homepage Strategy

The homepage `/` is the main tool page. It is not a separate brand homepage.

Homepage H1 recommendation:

> Online Text to Speech Generator

The first screen must contain the generator UI, not a marketing-only hero.

### 2.3 v1 Generator Features

Implemented in v1:

- text input box,
- character counter,
- language selector,
- voice selector,
- output format fixed to MP3,
- Generate Preview,
- playback speed control: `0.75x`, `1x`, `1.25x`, `1.5x`,
- login-gated Download MP3,
- recent generation history.

Important limitation:

- Playback speed only affects the browser audio player.
- v1 does **not** change the actual speed of the exported MP3.

### 2.4 Language Strategy

Officially supported in v1:

- English,
- Spanish.

Beta / limited support:

- French,
- German,
- Japanese,
- Portuguese.

No language-specific SEO pages in v1. Language selection is handled inside the generator UI.

### 2.5 Cloudflare TTS Model Routing

Product default:

| Language   | Model                    | Status   |
| ---------- | ------------------------ | -------- |
| English    | `@cf/deepgram/aura-2-en` | Official |
| Spanish    | `@cf/deepgram/aura-2-es` | Official |
| French     | `@cf/myshell-ai/melotts` | Beta     |
| German     | `@cf/myshell-ai/melotts` | Beta     |
| Japanese   | `@cf/myshell-ai/melotts` | Beta     |
| Portuguese | `@cf/myshell-ai/melotts` | Beta     |

Technical rule:

> Provider, model, language, voice, model tier, and plan availability must be configuration-driven. Do not hardcode model IDs or voice IDs in business logic.

### 2.6 Voice / Model Tiering

v1 uses one standard voice pool for all plans. It does not use voices as a paid-plan differentiator.

However, the voice catalog and model config must reserve fields such as:

- `provider`,
- `model_id`,
- `voice_id`,
- `language`,
- `model_tier`,
- `is_beta`,
- `available_plans`.

v2 may introduce premium voices and different credit multipliers by model tier.

---

## 3. SEO Scope

### 3.1 v1 Indexable SEO Pages

v1 ships 10 high-evidence SEO pages based on the provided keyword CSV:

```txt
/
/free-text-to-speech/
/read-aloud/
/text-reader/
/ai-text-to-speech/
/tts-online/
/text-to-voice/
/text-to-audio/
/text-to-speech-converter/
/voice-generator/
```

### 3.2 Trust / Commercial / Legal Pages

```txt
/pricing/
/faq/
/privacy-policy/
/terms-of-service/
```

### 3.3 SEO Page Requirements

Every SEO page must have:

- unique title,
- unique H1,
- unique meta description,
- unique intro copy,
- a relevant default sample text,
- a real generator entry point,
- a page-specific FAQ,
- relevant internal links,
- correct canonical URL,
- inclusion in sitemap when approved.

Do not create thin doorway pages by only changing the title.

### 3.4 Deferred SEO Pages

Do not create the following in v1:

- language-specific pages,
- PDF/document/article pages,
- competitor-alternative pages,
- YouTube/TikTok/podcast creator pages unless new keyword data supports them.

---

## 4. Pricing and Plans

### 4.1 Plan Structure

v1 plan structure:

```txt
Free
Lifetime Basic
Lifetime Pro
Extra Credits
```

### 4.2 Plan Details

| Plan           |        Price |            Monthly quota | Single request limit |  History |         Audio retention |
| -------------- | -----------: | -----------------------: | -------------------: | -------: | ----------------------: |
| Free           |           $0 |  10,000 characters/month |          3,500 chars |  3 items |                  3 days |
| Lifetime Basic | $29 one-time | 100,000 characters/month |         15,000 chars | 20 items |                 30 days |
| Lifetime Pro   | $79 one-time | 500,000 characters/month |         15,000 chars | 50 items |                 90 days |
| Extra Credits  |           $9 |       250,000 characters |                  N/A |      N/A | expires after 12 months |

Guest Preview:

- 1,500 characters per request,
- 5 previews per IP per day,
- Turnstile required,
- no MP3 download.

### 4.3 Lifetime Plan Definition

Lifetime does **not** mean unlimited generation.

It means:

- permanent member entitlement,
- fixed monthly quota,
- plan-specific history and retention,
- ability to buy Extra Credits after quota exhaustion.

### 4.4 Extra Credits

Extra Credits:

- one-time purchase,
- $9 / 250,000 characters,
- valid for 12 months from purchase,
- consumed only after monthly plan quota is depleted.

---

## 5. Payment and Entitlement

### 5.1 Payment Provider

Payment provider: **Creem**.

v1 Creem products:

- Lifetime Basic — one-time payment,
- Lifetime Pro — one-time payment,
- Extra Credits — one-time payment.

### 5.2 Entitlement Source of Truth

Creem webhook events are the source of truth for purchase completion.

Local aooi tables should store the operational state used by the app:

- entitlement,
- monthly quota,
- extra credit ledger,
- purchase records,
- refund/adjustment records.

### 5.3 Webhook Requirements

Must support:

- webhook signature verification,
- idempotency,
- order-to-user mapping,
- successful purchase activation,
- refund handling,
- duplicate-event safety.

Refund behavior must be explicit:

- Lifetime refund revokes or downgrades entitlement.
- Extra Credits refund removes unused credits or creates a negative adjustment if credits were consumed.

---

## 6. Auth / Account Requirements

Use aooi's existing Auth capability. The SPEC does not mandate Magic Link, Google OAuth, or email/password.

Account must support linking:

- Creem customer/order,
- lifetime entitlement,
- monthly quota state,
- extra credit ledger,
- generation history.

Guests can preview. Downloads require login.

---

## 7. Quota, Credits, and Charging Rules

### 7.1 Charge Timing

- Generate charges quota/credits.
- Replay does not charge.
- Download does not charge.
- Regenerate charges again if text, language, voice, model, or output changes, or if the previous audio expired.

### 7.2 Reuse Rules

If the following are identical and the audio is not expired, reuse existing generated audio without charging again:

- normalized text,
- language,
- voice,
- model,
- output format.

Implementation requires a `request_hash`.

### 7.3 Consumption Order

1. Use monthly quota first.
2. If monthly quota is exhausted, use Extra Credits.
3. If both are insufficient, block generation and prompt the user to buy credits.

### 7.4 Ledger Requirements

Do not implement credits as one mutable balance only. Use a ledger that supports:

- source: purchase / grant / adjustment / refund,
- amount,
- remaining amount,
- expiry date,
- related order ID,
- consumption records,
- audit trail.

### 7.5 Failure Handling

If TTS generation fails:

- quota/credits must not be permanently consumed,
- reserved quota must be released or rolled back,
- partial failed audio must not be exposed as a successful generation.

---

## 8. Guest Preview and Abuse Control

Guest Preview:

- IP-based daily limit: 5 previews/day,
- per-preview max: 1,500 characters,
- Turnstile required,
- no MP3 download,
- exceeded limit leads to registration CTA.

Guest preview does not enter the user credit ledger but should be logged for abuse/rate-limit purposes.

---

## 9. Audio Storage, History, and Privacy

### 9.1 History and Retention

| Plan           | History count | Audio retention |
| -------------- | ------------: | --------------: |
| Free           |             3 |          3 days |
| Lifetime Basic |            20 |         30 days |
| Lifetime Pro   |            50 |         90 days |

Expired audio cannot be downloaded.

### 9.2 Text Retention

Save:

- first 100 characters of text as preview,
- character count,
- language,
- voice,
- model,
- request hash,
- audio object key,
- generation timestamp,
- expiry timestamp.

Do not save:

- full original text.

### 9.3 Storage

Use Cloudflare R2 or the existing aooi object storage abstraction.

Must include cleanup for:

- expired audio files,
- records beyond plan history count,
- inaccessible expired downloads.

---

## 10. Content Safety

v1 uses:

> Rule-based blocking + Terms enforcement.

Back-end should block obvious high-risk requests using basic rules.

Terms must prohibit:

- impersonation,
- scams/fraud,
- illegal activity,
- hate/harassment,
- sexual exploitation,
- deepfake or misrepresentation,
- infringement of third-party rights.

v1 does not implement complex AI content moderation.

Accounts may be suspended or limited for abuse.

---

## 11. Technical Constraints

### 11.1 aooi Integration

- Use existing aooi Auth.
- Use site-key `text-to-speech-generator`.
- Follow aooi site instance/config conventions.
- Payment, entitlement, quota, and generation must not be tightly coupled to page UI.
- Runtime entitlement/quota state must be local and queryable without calling Creem for every request.

### 11.2 Configurable Items

Must be configurable:

- plan prices,
- monthly quotas,
- single-request limits,
- history counts,
- retention days,
- Creem product IDs,
- language list,
- voice catalog,
- model routing,
- model tier,
- Beta language flags.

### 11.3 Generation Flow

Recommended flow:

1. Validate input.
2. Normalize text.
3. Check language, voice, and model availability.
4. Check guest rate limit or user quota.
5. Build `request_hash`.
6. Reuse unexpired audio if matching request exists.
7. Reserve quota/credits.
8. Call Cloudflare Workers AI TTS.
9. Store audio.
10. Write generation history.
11. Confirm quota deduction.
12. Return playable audio URL/token.

### 11.4 Sitemap / Canonical / Indexing

- Include all v1 indexable pages in sitemap.
- Trust/legal pages should be accessible and linked.
- Every SEO page needs a canonical URL.
- Do not index non-final, placeholder, or capability-missing pages.

---

## 12. Non-goals

v1 explicitly does not do:

- PDF upload,
- DOCX upload,
- webpage URL fetching,
- article parsing,
- document reader,
- language-specific SEO pages,
- real exported MP3 speed adjustment,
- pitch control,
- emotion control,
- tone control,
- pause tags,
- multi-segment script editor,
- voice cloning,
- celebrity voices,
- 100+ languages claim,
- 500+ voices claim,
- unlimited free generation,
- subscription plans,
- team or enterprise plan,
- permanent storage of all audio,
- saving full original text,
- complex AI moderation.

---

## 13. Success Criteria

v1 is successful when all of the following are true:

- `/` is the main Text to Speech Generator tool page.
- Guest preview works after Turnstile.
- Guest rate limit works: 5 previews/IP/day.
- Logged-in users can download MP3.
- Free / Lifetime Basic / Lifetime Pro / Extra Credits entitlements are correct.
- Generate charges quota/credits.
- Replay and Download do not charge again.
- Monthly quota is consumed before Extra Credits.
- Extra Credits expire after 12 months.
- Creem webhook can activate Lifetime plans and Extra Credits.
- Creem webhook verifies signature and handles idempotency.
- Refund behavior is defined and implemented.
- Cloudflare TTS model routing is configuration-driven.
- English and Spanish are official.
- French, German, Japanese, and Portuguese are marked Beta.
- Audio retention rules work by plan.
- Generation history saves only first 100 characters, not full original text.
- 10 SEO pages are accessible, indexable, and have unique content.
- Sitemap, robots, and canonical tags are correct.
- Pricing, FAQ, Privacy Policy, and Terms pages exist.
- The site does not claim unlimited free usage, 100+ languages, or 500+ voices.

---

## 14. External References

- Cloudflare Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare Aura-2 English model: https://developers.cloudflare.com/workers-ai/models/aura-2-en/
- Cloudflare Aura-2 Spanish model: https://developers.cloudflare.com/workers-ai/models/aura-2-es/
- Cloudflare MeloTTS model: https://developers.cloudflare.com/workers-ai/models/melotts/
- Creem one-time payments: https://docs.creem.io/features/one-time-payment
- Creem webhooks: https://docs.creem.io/code/webhooks
