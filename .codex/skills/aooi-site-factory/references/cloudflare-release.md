# Cloudflare Release Reference

Cloudflare topology is derived from site config v2, deploy settings v2, and
product runtime contracts. Each site has one App Worker and only sites requiring
Durable Object limiting have a State Worker.

## Verification

```bash
SITE=<site-key> pnpm site:contract
SITE=<site-key> pnpm site:gate -- --cloudflare
SITE=<site-key> pnpm cf:check
SITE=<site-key> pnpm cf:build
SITE=<site-key> pnpm cf:typegen:check
```

Generated Wrangler config belongs under `.generated/cloudflare/<site-key>`.
Do not edit generated config or call Wrangler directly during a release.

## Release

```bash
SITE=<site-key> pnpm release:cf
```

The release validates required variables and secrets, requires an Analytics
provider for Analytics-enabled sites, migrates and verifies database sites,
deploys an optional State Worker, then atomically deploys the App Worker.
Rollback uses the prior deployment version of the same App Worker.

Never claim release readiness without the selected site's gate and production
smoke evidence.
