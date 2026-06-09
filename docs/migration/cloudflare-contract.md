# Cloudflare Contract for TanStack Native Migration

Gate 0-3 does not replace the existing Cloudflare deploy contract.

Required legacy scripts remain authoritative:

```bash
SITE=background-remover pnpm cf:check
SITE=background-remover pnpm cf:build:no-db --site=background-remover
SITE=background-remover pnpm contract:check
```

TanStack-specific build scripts are additive only:

```bash
SITE=dev-local pnpm tanstack:build
SITE=<site-key> pnpm tanstack:cf:build
```

`cf:build` and `cf:build:no-db` must not be reduced to plain `vite build`.
`tanstack:cf:build` is a Vite/TanStack build probe and requires an explicit
`SITE`; it is not a deploy acceptance gate. Gate 6 may replace the internal
OpenNext build step with TanStack Start + Cloudflare Workers build, but it must
preserve site-scoped checks, `site.config.json`, `deploy.settings.json`, i18n
checks, multi-build checks, and Cloudflare config checks.
