# Cloudflare deployment

Every site has one App Worker. Sites that need Durable Object rate limiting also
have one State Worker. `sites/<site-key>/deploy.settings.json` is the only worker
and Cloudflare resource manifest:

```json
{
  "configVersion": 2,
  "workers": {
    "app": "aooi-example-app",
    "state": "aooi-example-state"
  },
  "resources": {
    "hyperdriveId": "00000000000000000000000000000000",
    "appStorageBucket": "aooi-example-storage"
  }
}
```

Omit `workers.state`, `hyperdriveId`, and `appStorageBucket` when the selected
modules and product contract do not require them. Bindings, secrets, runtime
variables, and State Worker requirements are derived from
`site.config.json.capabilities` and the product runtime contract.

## Verification

```bash
SITE=<site-key> pnpm site:gate -- --cloudflare
SITE=<site-key> pnpm cf:check
SITE=<site-key> pnpm cf:build
SITE=<site-key> pnpm cf:typegen:check
```

Generated Wrangler files live under ignored `.generated/cloudflare/<site-key>`.
Builds never rename routes or modify tracked source files.

## Production release

```bash
SITE=<site-key> pnpm release:cf
```

For database sites the release order is `db:migrate`, `db:check`, optional
State Worker deploy, then App Worker deploy. Other sites deploy only the
workers their contract requires. App deployment is an atomic replacement of
the current worker; rollback selects the previous deployment version of the
same App Worker.

Sites with Analytics enabled must provide at least one of
`GOOGLE_ANALYTICS_ID`, `CLARITY_ID`, `PLAUSIBLE_DOMAIN`, or
`OPENPANEL_CLIENT_ID`. The release stops before deployment when none is set.

`401k-calculator` intentionally keeps
`aooi-401k-calculator-router` as its App Worker name so its existing custom
domain remains attached during the topology migration.
