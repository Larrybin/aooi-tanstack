# Technical Spec

## Runtime Stack Assumption

Target repository: `Larrybin/aooi`.

The implementation must align with aooi's existing conventions for:

- site instances,
- auth,
- payments,
- entitlement,
- quota,
- public web routing,
- Cloudflare runtime bindings.

## Core Components

### Frontend

- Generator UI
- Pricing UI
- Account quota display
- Generation history UI
- SEO landing pages

### API

- `POST /api/tts/generate`
- `GET /api/tts/history`
- `GET /api/tts/download/:id`
- Creem webhook endpoint
- Account entitlement/quota endpoints if existing aooi patterns require them

### Storage

- D1 or existing DB for users, entitlements, quota ledger, credit ledger, and generation metadata
- R2 or existing object storage abstraction for generated MP3 files
- KV or existing rate-limit storage for guest rate limiting

## Generation State Machine

Recommended states:

- `pending`
- `reserved`
- `generated`
- `failed`
- `expired`
- `deleted`

## Request Hash

Hash input should include:

- normalized text
- language
- voice
- model
- output format

Do not include user ID if cross-user reuse is intentionally allowed. If privacy boundaries require per-user isolation, include user ID. The safer v1 default is per-user reuse for registered users and IP/session-scoped reuse for guests.

## Quota Reservation

Use reservation before calling TTS:

1. Estimate required characters.
2. Reserve from monthly quota or Extra Credits.
3. Call TTS.
4. Confirm consumption on success.
5. Release reservation on failure.

## Model Routing

Route by language using config. Product default:

- English → `@cf/deepgram/aura-2-en`
- Spanish → `@cf/deepgram/aura-2-es`
- French/German/Japanese/Portuguese → `@cf/myshell-ai/melotts`

## Config Required

- plan prices
- quotas
- request limits
- retention windows
- Creem product IDs
- model routes
- voice catalog
- language status
- rate limit thresholds
- Turnstile requirement
