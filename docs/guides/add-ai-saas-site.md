# Add AI SaaS Site Runbook

Use this checklist when the new site has its own AI product workflow, not just
the shared chat/generator module. For a normal content or module-only site, use
[Add Site Runbook](./add-site.md).

## Scope

The reusable base is intentionally narrow:

- `product-access`: actor, anonymous session, and ownership.
- `product-entitlements`: product access context from pricing, subscription,
  and grants.
- `product-quota`: reserve, commit, and refund orchestration.
- `product-runtime`: deploy/runtime worker, binding, var, and secret contract.

Do not extract a generic AI job engine, media asset platform, provider adapter,
or new database table family until a second shipped product proves the same
shape.

## Minimal Steps

1. Define product actor usage.
   Reuse `ProductActor` and product ownership. Product code may expose a thin
   product-named resolver, but duplicated actor/session/ownership logic must
   stay out of the product workflow.

2. Register the product entitlement schema.
   Put product-specific entitlement keys in the product schema source, not in
   `product-entitlements`. Pricing and grants must validate against that schema.

3. Wire the product access resolver.
   Resolve pricing, active subscription product id, and optional internal grants
   through `resolveProductAccess`. Product application code should consume the
   returned access context instead of reparsing billing or grants directly.

4. Define product quota operation keys.
   Keep product operation keys explicit, for example `image.remove` or
   `image.hd_download`. Map them to product storage fields inside the product
   adapter, not inside `product-quota`.

5. Implement the product quota storage adapter.
   `product-quota` validates the requested units and builds the reservation
   draft. The product storage adapter owns windowed usage counting, locks,
   transaction consistency, idempotent reservation writes, commit, and refund.

6. Define the product runtime contract.
   Declare required workers, bindings, vars, and secrets through
   `product-runtime`. Product AI runtime bindings are separate from
   `site.config.json.capabilities.ai`, which only controls the shared
   chat/generator module.

7. Add `SITE=<site> pnpm contract:check` coverage.
   The audit must show actor/access, entitlement, quota, and runtime contract
   evidence for the product. Source-map quota reserve/commit/refund behavior
   before treating the product as accepted.

8. Add `pnpm cf:build:no-db --site=<site>` coverage.
   This proves the Cloudflare build path does not reintroduce build-time DB
   access. Keep this check separate from live smoke tests.

## Runtime Check Policy

`SITE=<site> pnpm cf:check` validates generated Cloudflare config and active
runtime bindings. It needs real runtime values for release evidence. For a
structure-only local or CI check, use non-production placeholders and record
that the run is not deploy-ready.

AI Remover currently needs placeholders or real values for:

```bash
SITE=ai-remover \
BETTER_AUTH_SECRET=placeholder \
GOOGLE_CLIENT_ID=placeholder \
GOOGLE_CLIENT_SECRET=placeholder \
RESEND_API_KEY=placeholder \
CREEM_API_KEY=placeholder \
CREEM_SIGNING_SECRET=placeholder \
STORAGE_PUBLIC_BASE_URL=https://example.invalid \
REMOVER_CLEANUP_SECRET=placeholder \
pnpm cf:check
```

Preview/local may warn for optional provider secrets. Production acceptance must
use real Cloudflare worker secrets and vars.

## Required Gates

Run these before opening the final integration PR:

```bash
pnpm test
pnpm lint
pnpm arch:check

SITE=<site> pnpm build
SITE=<site> pnpm contract:check
SITE=<site> pnpm cf:check
pnpm cf:build:no-db --site=<site>
```

For AI Remover, also verify the product smoke path:

- guest upload
- guest create job
- guest poll job
- guest download low-res
- guest high-res download blocked or charged
- logged-in user continues the same ownership path
- internal grant user can create a job
- quota exceeded path
- provider failure refund path
- expired asset/download path

## Boundary Rules

- Product wrappers are allowed when they carry product semantics or keep route
  code out of base details.
- Product wrappers must not duplicate actor/session/ownership, pricing,
  subscription, grants, reserve/commit/refund, or runtime binding logic.
- `product-access`, `product-entitlements`, `product-quota`, and
  `product-runtime` must not import product implementation domains.
- Product runtime AI bindings must not depend on `capabilities.ai=true`.
