# Gate 5.5 Native Cloudflare Worker Topology

Status: complete

Closeout: `docs/migration/gate-5-5-native-cloudflare-worker-closeout.md`

## Goal

Replace active OpenNext Cloudflare worker/build topology with aooi's selected TanStack native artifact contract.

## Selected native artifact contract

Gate 5.5 uses the current aooi TanStack build artifacts:

```text
server: dist/server/server.mjs
assets: dist/client
```

This gate does not realign the repo to Cloudflare's default `.output/**` convention. That can be considered after native parity is stable.

## Non-goals

- Do not delete `src/app/**`.
- Do not remove `next`, `next-intl`, `@opennextjs/cloudflare`, `server-only`, or OpenNext package dependencies.
- Do not change auth/session/payment/quota/storage/email/AI behavior.
- Do not change production DNS, secrets, or deploy state.
- Do not add a parallel native router system.

## Checker

```bash
SITE=dev-local pnpm tanstack:build
node scripts/check-gate-5-5-native-cloudflare-topology.mjs --report
node scripts/check-gate-5-5-native-cloudflare-topology.mjs
```

The checker verifies:

- `dist/server/server.mjs` exists after build;
- `dist/client` exists after build;
- active worker runtime no longer imports `.open-next` or `@opennextjs`;
- active Wrangler/config paths no longer point to `.open-next` artifacts;
- active build scripts no longer require `.open-next` artifacts;
- package dependencies are deferred to Gate 5.6.

## Required final validation

```bash
SITE=dev-local pnpm tanstack:build
node scripts/check-gate-5-5-native-cloudflare-topology.mjs
node scripts/check-gate-5-4-server-only-markers.mjs
node scripts/check-gate-5-3-non-app-next-deps.mjs
node ./scripts/check-gate-5-2-api-parity.mjs
SITE=dev-local pnpm arch:check
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm cf:check
pnpm cf:build:no-db --site=<supported-no-db-site>
```
