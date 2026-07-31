# Add a site

Create `sites/<site-key>` with `site.config.json`, `deploy.settings.json`, and
`content/pages`. Add docs or posts only when the matching module is enabled.

## Site contract

Use site config v2:

```json
{
  "configVersion": 2,
  "key": "example",
  "domain": "example.com",
  "brand": {
    "appName": "Example",
    "appUrl": "https://example.com",
    "supportEmail": "support@example.com",
    "logo": "/logo.png",
    "favicon": "/favicon.ico",
    "previewImage": "/logo.png"
  },
  "capabilities": {
    "enabledModules": ["analytics"],
    "paymentProvider": "none"
  }
}
```

`enabledModules` uses the product-module registry. Do not configure
`core_shell` or `deploy_contract`. `admin_settings` requires `auth`; `billing`
and a non-`none` payment provider must be enabled together.

Each site owns `entry.server.ts`, `entry.client.tsx`, and its home data/view.
Optional routes belong to `(module_<id>)`; product routes belong to
`(site_<site-key>)`. The route generator selects them from the site contract,
so adding a site does not require a central site-key switch or CI list.

## Deploy contract

Use deploy settings v2:

```json
{
  "configVersion": 2,
  "workers": {
    "app": "aooi-example-app"
  },
  "resources": {}
}
```

Add `workers.state`, `resources.hyperdriveId`, or
`resources.appStorageBucket` only when required by enabled modules or a product
runtime contract. Do not duplicate binding or secret requirements here.

## Verify

```bash
SITE=<site-key> pnpm site:contract
SITE=<site-key> pnpm site:gate -- --cloudflare
pnpm run ci
```

The site matrix is discovered from `sites/*/site.config.json`; no workflow
change is required.
