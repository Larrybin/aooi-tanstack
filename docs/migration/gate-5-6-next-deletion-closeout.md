# Gate 5.6 Next Deletion Closeout

Status: complete
Branch: `migration/tanstack-start-native`
PR: #172

## Completed work

- Added `scripts/check-gate-5-6-no-next.mjs`.
- Added `scripts/check-gate-5-6-route-coverage.mjs`.
- Replaced `next/cache` with `src/domains/settings/application/settings-cache.ts`.
- Removed the legacy `src/app/**` baseline.
- Removed Next root files: `next.config.mjs`, `next-env.d.ts`.
- Removed legacy Next-only UI/runtime folders including `src/themes/default`, legacy account/chat/AI UI, and legacy platform i18n runtime.
- Removed direct dependencies on Next/OpenNext/next-intl/server-only packages from `package.json` and lockfile.
- Updated package scripts to use Vite/TanStack commands.
- Updated architecture/dependency-cruiser/ESLint rules for the final TanStack-native boundary.
- Updated Gate 5.2 / 5.4 / TanStack validators for the post-legacy-deletion state.

## Deleted legacy package dependencies

```text
next
next-intl
@next/env
@next/bundle-analyzer
@opennextjs/cloudflare
server-only
nextjs-toploader
eslint-config-next
```

## Checker result summary

```text
Gate 5.6 no-Next:
active_blocker: 0
delete_target: 0
package_delete_target: 0
config_delete_target: 0

Gate 5.6 route coverage:
required TanStack route files: 10
missing required TanStack route files: 0
legacy src/app file count: 0
```

## Validation

Required validation commands were run during closeout:

```bash
node scripts/check-gate-5-6-no-next.mjs
node scripts/check-gate-5-6-route-coverage.mjs
node scripts/check-gate-5-5-native-cloudflare-topology.mjs
node scripts/check-gate-5-4-server-only-markers.mjs
node scripts/check-gate-5-3-non-app-next-deps.mjs
node ./scripts/check-gate-5-2-api-parity.mjs
SITE=dev-local pnpm arch:check
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:validate
pnpm tanstack:build
RESEND_API_KEY=ci-resend-api-key-not-for-production SITE=dev-local pnpm cf:check
pnpm cf:build:no-db --site=dev-local
```

## Notes

`SITE=dev-local pnpm cf:check` requires an email provider runtime binding for the active auth worker. Closeout uses the same non-production placeholder convention as the no-DB Cloudflare build path.

## Remaining Gate 5.7 work

- Decide which temporary Gate 5 scripts become durable architecture rules.
- Optionally remove stale migration-only docs/checkers after durable rules cover them.
- Update PR description and push only after explicit user approval.
