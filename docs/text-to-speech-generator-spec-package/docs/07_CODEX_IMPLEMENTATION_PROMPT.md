# Codex Implementation Prompt

You are working in the `Larrybin/aooi` repository.

Goal: implement the v1 `text-to-speech-generator` SaaS site according to the included SPEC package.

## Critical Rules

1. Do not start coding before auditing existing aooi patterns.
2. First inspect existing site instance conventions, auth, payment, entitlement, quota, public-web routing, Cloudflare bindings, sitemap/canonical logic, and tests.
3. Reuse aooi existing architecture. Do not create a parallel auth/payment/quota stack unless the repo has no compatible pattern.
4. The site key is `text-to-speech-generator`.
5. Homepage `/` is the main generator page.
6. Use Creem as payment provider.
7. Use Cloudflare Workers AI TTS model routing via config.
8. Do not save full original text in history.
9. Do not implement non-goals.

## Required First Response From Codex

Before code changes, respond with:

- files inspected,
- existing aooi patterns discovered,
- proposed implementation plan,
- required schema changes,
- risks / open assumptions,
- exact tests/checks to run.

## Implementation Scope

Implement:

- site config and pages,
- generator UI,
- TTS generation API,
- guest Turnstile + rate limit,
- logged-in MP3 download,
- quota/credit ledger,
- R2 audio storage or existing object storage abstraction,
- generation history with 100-char text preview only,
- Creem payment and webhook processing,
- SEO pages and sitemap/canonical integration,
- pricing/FAQ/legal pages.

Do not implement:

- PDF upload,
- document reader,
- webpage fetching,
- language SEO pages,
- real MP3 speed adjustment,
- pitch/emotion/tone controls,
- pause tags,
- voice cloning,
- subscriptions,
- team plans.

## Validation Commands

Derive exact commands from the repository. At minimum, run the repo's relevant:

- typecheck,
- lint,
- tests,
- build for the site,
- sitemap/canonical checks if available,
- any payment/entitlement/quota tests.

Return implementation evidence with command outputs and changed file summary.
