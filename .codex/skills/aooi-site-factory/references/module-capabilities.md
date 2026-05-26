# Module Capabilities Reference

Use this reference when a site needs auth, payment, AI, docs/blog, storage, analytics, ads, or settings.

## Principle

Site capabilities select existing mainline modules. They should not cause copied code, forked routes, or site-specific provider implementations.

## Capability Ownership

Use `site.config.json` for high-level capability selection:

```text
capabilities.auth
capabilities.payment
capabilities.ai
capabilities.docs
capabilities.blog
```

Use admin/runtime settings, env, secrets, and Cloudflare bindings for provider details.

Use `deploy.settings.json` for infra resource names and binding requirements.

## Common Decisions

- Auth enabled: reuse Better Auth platform code and required email/OAuth secrets.
- Payment enabled: use the billing domain and provider selected by `capabilities.payment`.
- AI enabled: use the AI domain capability resolver and runtime provider settings.
- Docs/blog enabled: provide required site content directories and entries.
- Storage enabled: configure R2 and public storage base URL through deploy/runtime inputs.
- Analytics/ads/customer support: prefer existing settings/integration paths before code.

## Red Flags

Stop and reconsider when an implementation:

- duplicates auth, billing, email, storage, or AI logic for one site.
- imports `sites/**` from runtime code.
- reads `process.env` directly where an approved env/runtime helper exists.
- puts provider secrets in repo-controlled JSON.
- adds a new domain only for UI composition.
- creates compatibility layers for renamed site keys.

## Where Code Belongs

- Business semantics: `src/domains/<domain>/domain/**`.
- Use-case flow: `src/domains/<domain>/application/**`.
- Provider/runtime adapters: `src/infra/**` or domain-owned infra when already established.
- Public/admin composition: `src/surfaces/**`.
- Route entries: `src/app/**`, kept thin.
- Generic pure UI/utilities: `src/shared/**`.
