---
name: aooi-site-factory
description: Use when creating, adapting, auditing, or shipping SaaS site instances in the aooi repository; guides site.config.json, deploy.settings.json, content, module capabilities, product UI scope, Cloudflare checks, and release workflow for the aooi multi-site SaaS foundation.
metadata:
  short-description: Build and verify aooi SaaS site instances
---

# Aooi Site Factory

Use this skill when work in the `aooi` repository affects a SaaS site instance, site-specific content, module capability setup, product UI, Cloudflare deploy inputs, or release verification.

This skill is for `aooi` as a multi-site SaaS foundation. It is not a keyword-only SEO tool-site workflow. Start from the site instance contract, then decide whether the request is configuration, content, shared platform capability, site/product UI, or deploy/release work.

## Core Contract

`aooi` site work is organized around these facts:

```text
sites/<site-key>/site.config.json       build-time site identity and capabilities
sites/<site-key>/deploy.settings.json   infra-only Cloudflare deploy contract
sites/<site-key>/deploy.preview.settings.json
                                        optional preview Hyperdrive overlay
sites/<site-key>/.env.local             ignored operator-local env for local,
                                        preview, and production release values
sites/<site-key>/content/**             site-scoped pages, docs, and posts
@/site                                  generated runtime site identity module
SITE=<site-key>                         explicit command selector for non-local work
```

Runtime code must read site identity through `@/site`. Do not import `sites/**` from runtime code, do not add site-key alias maps, and do not create compatibility paths for renamed sites.

## Default Workflow

1. Identify the target `site-key` and confirm the directory, `site.config.json`, and command `SITE=<site-key>` match exactly.
2. Classify the product profile before choosing implementation scope:
   - `free-tool-no-db`: public tool, no auth, no payment, no shared AI, no docs/blog, no Hyperdrive.
   - `free-tool-with-storage`: public tool with storage, but no database-backed SaaS surface.
   - `ai-saas`: auth/quota/entitlements with AI runtime.
   - `paid-saas`: auth plus payment/member/admin/database-backed SaaS surface.
   - `internal-admin-tool`: operator/admin workflow, not public marketing.

   The profile is not a second source of truth. Use it to derive or validate
   `site.config.json`, `deploy.settings.json`, route pruning, layout shell,
   production/preview checks, and test evidence.

3. Classify the work:
   - `config-only`: brand, domain, capability flags, deploy resources, runtime bindings.
   - `content-only`: pages, docs, posts, copy, legal, FAQ, marketing text.
   - `shared-capability`: auth, billing, AI, storage, docs/blog, analytics, ads, settings.
   - `site-product-ui`: site-specific route, workflow, generator, dashboard, calculator, or product surface.
   - `shared-platform`: changes that intentionally affect every site.
   - `release-verify`: Cloudflare, smoke, deploy, or production readiness.
4. Read the smallest relevant references:
   - For adding or changing a site instance, read `references/site-instance.md`.
   - For product profile decisions, read `references/product-profiles.md`.
   - For module capability decisions, read `references/module-capabilities.md`.
   - For UI or product feature work, read `references/ui-scope.md`.
   - For upload, conversion, compression, generation, or media tools, read `references/product-lifecycle.md`.
   - For Cloudflare verification or release work, read `references/cloudflare-release.md`.
5. Prefer configuration, content, runtime settings, and existing platform modules before writing new code.
6. If code is needed, place it in the existing `app -> surfaces -> domains -> infra/shared` structure. Keep route files thin and put business semantics in the owning domain.
7. Verify with the narrowest command set that proves the changed behavior, then widen to Cloudflare checks when deploy semantics are touched.

## Write Scope Rules

For normal site work, keep writes close to the selected site:

```text
sites/<site-key>/**
src/themes/** only when the selected UI path requires theme work
src/domains/<feature>/** only for real product/domain behavior
src/surfaces/** only for composition surfaces
src/app/** only for routes, layouts, metadata, and route handlers
scripts/** only for site/deploy automation contract changes
docs/** only when the code or workflow contract changes
```

Shared platform edits must be intentional and recorded in the final summary. Do not change unrelated dirty files.

## Decision Rules

- Brand, canonical URL, logo, preview image, support email, and capability flags belong in `site.config.json`.
- Worker names, Cloudflare resources, and binding requirements belong in `deploy.settings.json`.
- Production worker and bucket names are explicit values in `deploy.settings.json`; only preview worker and bucket names are derived from `SITE=<site-key>`.
- Use `SITE=<site-key> pnpm site:production:init-settings` to write the recommended production worker and R2 bucket names into `deploy.settings.json` during site setup.
- Workers.dev preview belongs to `CF_DEPLOY_PROFILE=preview` on the real product `SITE`, with only the preview Hyperdrive id in `deploy.preview.settings.json`. Do not create a separate `<site-key>-preview` site.
- Operator-local env for every site belongs in one ignored `sites/<site-key>/.env.local` file. Use sections and prefixes for common, local dev, preview, and production release values.
- Do not put `SITE`, Hyperdrive IDs, worker names, R2 bucket names, or preview `STORAGE_PUBLIC_BASE_URL` in env files. `SITE=<site-key>` stays explicit in commands, Hyperdrive IDs stay in deploy settings, and preview storage base URLs are derived.
- Landing copy, docs, blog posts, and page content belong in `sites/<site-key>/content/**`.
- Auth, payment, email, storage, AI, analytics, docs/blog, and admin settings should reuse mainline modules. Do not fork them for a single site.
- Site-specific product behavior may justify code when it changes the actual user workflow.
- Shared UI should change only when the improvement is meant for all sites using that theme.
- Do not add adapters, aliases, or compatibility layers unless an external API, uncontrolled deployment, or data migration requires it.

## Verification Shortlist

Use the smallest useful set first:

```bash
pnpm test
pnpm lint
pnpm arch:check
SITE=<site-key> pnpm site:contract
SITE=<site-key> pnpm build
SITE=<site-key> pnpm cf:check
pnpm cf:build:no-db --site=<site-key>
SITE=<site-key> pnpm site:production:doctor
SITE=<site-key> pnpm site:preview:doctor
SITE=<site-key> pnpm cf:preview:check
SITE=<site-key> pnpm test:cf-local-smoke
SITE=<site-key> pnpm test:cf-admin-settings-smoke
SITE=<site-key> pnpm test:cf-app-smoke
```

When production release is in scope, read `references/cloudflare-release.md` before running deploy commands.

## Completion Standard

Before calling work complete, summarize:

- Target site and scope classification.
- Files or contracts changed.
- Commands run and outcomes.
- Any skipped checks and why.
- Whether the site remains draft/local-only or is release-ready.

Do not describe a site as production-ready unless the relevant Cloudflare and smoke chain has passed for the selected `SITE`.
