# Site Instance Reference

Each `sites/<site-key>` instance contains:

```text
site.config.json
deploy.settings.json
entry.server.ts
entry.client.tsx
home.tsx
content/pages/
```

`site.config.json` v2 owns identity and capabilities:

```json
{
  "configVersion": 2,
  "key": "my-site",
  "domain": "example.com",
  "brand": {
    "appName": "My Site",
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

Module IDs come from the product-module registry. `core_shell` and
`deploy_contract` are platform-owned. `admin_settings` requires `auth`;
`billing` and a non-`none` payment provider must be enabled together.

`deploy.settings.json` v2 owns only worker and resource identities:

```json
{
  "configVersion": 2,
  "workers": {
    "app": "aooi-my-site-app"
  },
  "resources": {}
}
```

Add `workers.state`, `resources.hyperdriveId`, and
`resources.appStorageBucket` only when derived requirements need them. Runtime
bindings, variables, and secrets do not belong in deploy settings.

Use `(module_<id>)` route groups for optional modules and
`(site_<site-key>)` for product routes. Add the site's own entry and home files;
never add a central site switch.

Verify with:

```bash
SITE=<site-key> pnpm site:contract
SITE=<site-key> pnpm site:gate -- --cloudflare
```
