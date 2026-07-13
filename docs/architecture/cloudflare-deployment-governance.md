# Cloudflare Deployment Governance

Cloudflare Workers is the only supported production topology.

## Topology

Each site selects an active router plus server Worker set from
`sites/<site-key>/deploy.settings.json`. The router owns public routing,
version affinity, image routing, and service binding dispatch. Active server
Workers load the same native TanStack server artifact and expose only their
assigned route families. State Workers remain independently deployable.

Existing Worker names, service bindings, Durable Object names, R2 buckets, and
Hyperdrive IDs are external contracts and must not be renamed during internal
refactors.

## Canonical commands

```bash
RESEND_API_KEY=ci-resend-api-key-not-for-production SITE=dev-local pnpm cf:check
SITE=dev-local pnpm cf:build
pnpm cf:build:no-db --site=mp4-compressor
RESEND_API_KEY=ci-resend-api-key-not-for-production SITE=dev-local pnpm cf:typegen:check
SITE=dev-local pnpm test:cf-local-smoke
```

- `cf:check` validates the selected topology, vars, secrets, bindings, and
  tracked Wrangler templates.
- `cf:build` builds the native TanStack app and performs scoped Worker upload
  dry-runs.
- `cf:build:no-db` verifies no-database sites with database inputs cleared.
- `cf:typegen:check` verifies generated Cloudflare declarations.
- `test:cf-local-smoke` starts the generated multi-Worker topology through
  Wrangler and exercises the router origin.

## Deployment

`cf:deploy:state` deploys only state infrastructure. `cf:deploy:app` deploys
router/server Workers with version affinity. `cf:deploy` aliases the app
deployment entry; `release:cf` is the explicit operator release workflow.

Production release authority belongs to the local operator session. GitHub
Actions validates acceptance requirements but never owns production deploys.

Validation never implies deployment. Production secrets are set through
Cloudflare and must not be written to tracked site files.

## Runtime spike decisions

Runtime spike reports use `rawConclusion` as the machine-readable decision:

| Value          | Required action                                                   |
| -------------- | ----------------------------------------------------------------- |
| `PASS`         | Keep the canonical Cloudflare path.                               |
| `需要 adapter` | Add the smallest runtime adapter at the affected boundary.        |
| `需要替代路线` | Stop and select a different runtime route before implementation.  |
| `BLOCKED`      | Record the external blocker; do not infer an architecture result. |

## Change control

Changes to Worker topology, deploy settings, runtime bindings, or env contracts
require `cf:check`, build, and typegen evidence for an explicit site. Database
schema changes also require a committed migration. GitHub acceptance is a gate,
not the production deploy authority.
