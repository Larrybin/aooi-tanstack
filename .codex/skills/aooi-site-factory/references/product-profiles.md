# Product Profiles Reference

Use this reference before adding or changing a site profile. A product profile is
a derived contract lens, not a separate runtime source of truth.

The source of truth remains:

```text
sites/<site-key>/site.config.json
sites/<site-key>/deploy.settings.json
scripts/lib/site-deploy-contract.mjs
tests/**
```

## Profiles

### free-tool-no-db

Use for a public browser tool that does not need account, payment, shared AI,
docs/blog, or database-backed SaaS surfaces.

Required source settings:

```text
site.config.json capabilities.auth=false
site.config.json capabilities.payment="none"
site.config.json capabilities.ai=false
site.config.json capabilities.docs=false
site.config.json capabilities.blog=false
deploy.settings.json bindingRequirements.bindings.hyperdrive=false
deploy.settings.json bindingRequirements.secrets.authSharedSecret=false
```

Required behavior:

- Cloudflare config must not include a Hyperdrive binding.
- Free-tool route pruning must remove disabled SaaS and DB-backed routes.
- DB-backed API routes must not enter the public-web bundle.
- Production doctor/provision must not require database URLs.
- Production doctor/provision must not check or create Hyperdrive.
- Auth-free production checks must not require auth or email secrets.
- Legal, privacy, and terms pages must render through the product shell, not the generic SaaS landing shell.
- Navigation must not link to disabled auth, payment, docs, chat, member, admin, or pricing routes unless the site explicitly enables those capabilities.

Required local evidence:

```bash
SITE=<site-key> pnpm site:contract
pnpm cf:build:no-db --site=<site-key>
```

### free-tool-with-storage

Use for a public tool that needs object storage but still has no database-backed
SaaS surface. It follows the `free-tool-no-db` rules except storage/R2 routes
and bindings may be allowed by an explicit deploy contract.

### ai-saas

Use when the product needs account identity, quota, entitlement, AI runtime, or
history. Reuse the main auth, billing, AI, limiter, and settings modules instead
of forking site-specific implementations.

### paid-saas

Use when the product needs auth plus payment/member/admin/database-backed SaaS
surfaces. Hyperdrive, auth secrets, payment secrets, and production release
doctor checks are expected.

### internal-admin-tool

Use for operator workflows that are not a public marketing/product site. Keep
route access, auth, and deployment checks explicit.

## Drift Rule

If a future `siteType` or `productProfile` field is added to config, it must
only validate or derive existing capabilities and binding requirements. Do not
let it drift from `site.config.json` or `deploy.settings.json`.
