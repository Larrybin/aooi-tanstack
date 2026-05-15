# Cloudflare-Only Deployment Governance

## Contract

- The template supports exactly one production deployment target: `DEPLOY_TARGET=cloudflare`.
- Public routes, auth routes, and protected routes must execute on the same origin.
- Cross-origin cookie auth topology is unsupported.

## Canonical Origin Rules

- `site.brand.appUrl` is the canonical production app origin.
- `NEXT_PUBLIC_APP_URL` is a generated deploy artifact derived from the resolved deploy contract app origin: production uses `site.brand.appUrl`; preview uses the workers.dev router origin.
- `AUTH_URL` and `BETTER_AUTH_URL` may exist only as same-origin mirrors of the runtime app origin.
- In production, any request-derived auth origin that differs from `site.brand.appUrl` is a hard failure.
- In preview/local, request-derived auth origin may override the canonical origin only when it is `localhost` or `127.0.0.1`.

## Cloudflare Rules

- Cloudflare runs as one private `state` Worker, one public router Worker, plus the canonical `public-web/auth/payment/member/chat/admin` private server Workers.
- `sites/<site>/site.config.json` is the semantic source of truth and `sites/<site>/deploy.settings.json` is the infra-only deploy manifest.
- Tracked `wrangler.cloudflare.toml`, `cloudflare/wrangler.state.toml`, and `cloudflare/wrangler.server-*.toml` are static templates, not site-specific source of truth.
- Resolver behavior is deterministic and side-effect free: it reads site identity + deploy manifest, derives contract IR, and feeds every `cf:*` command, smoke script, typegen, and release gate.
- Router-to-server dispatch must use Cloudflare version affinity.
- Production release authority belongs to the local operator session through `SITE=mamamiya pnpm release:cf`.
- GitHub Actions is the acceptance gate only. It must not deploy production.
- The local release command may deploy only the current `main` head whose `Cloudflare Deploy Acceptance` run succeeded.
- Manual lower-level Wrangler deploy commands are diagnostics and emergency procedures; they must follow the same site-resolved contract and post-deploy smoke requirement.
- Cloudflare preview is supported only as `CF_DEPLOY_PROFILE=preview` on the real product `SITE`; preview must not be modeled as a separate site.
- `CF_FALLBACK_ORIGIN` is forbidden.
- Any protected route redirecting to another origin is a failure.
- `pnpm cf:build` is authoritative for app size governance: it must pass `wrangler versions upload --dry-run` for router and every app Worker, and every deployable app gzip bundle must stay below `3 MiB`.
- Any accepted change to `src/config/db/schema.ts` must include committed files under `src/config/db/migrations/**`; otherwise release preparation must fail before deploy.
- Only the state Worker may define `[[migrations]]`.
- Router and all app workers must bind Durable Objects from the resolved `workers.state` in the current site deploy contract.
- State/app releases use an additive compatibility window: state-first changes may add fields or actions, but must not rename or redefine existing semantics in the same release.
- Release input checks enforce schema/migration pairing before deploy; they must not create a parallel release metadata authority.
- `pnpm cf:deploy:app` and `pnpm cf:deploy` are pure production app release commands. They must not bootstrap a missing router/server topology.
- For brand-new or partially initialized production environments, the only valid release order is `pnpm cf:deploy:state` first and `pnpm cf:deploy` second.
- If app deploy detects a missing router/server deployment, it must fail fast and instruct the operator to run `pnpm cf:deploy:state` first.
- Preview bootstrap is the only exception: `CF_DEPLOY_PROFILE=preview CF_DEPLOY_BOOTSTRAP_MISSING=true pnpm cf:deploy` may initialize missing preview app workers after preview state has been deployed.
- `pnpm cf:deploy:state` runs a state-scoped preflight only. It may verify the Durable Object artifacts imported by the state worker, but it must not be blocked by `public-web/auth/payment/member/chat/admin` secrets or router/server worker bundles, and it must not run the full OpenNext app build.

## Test Gates

- `pnpm cf:check` validates the multi-worker config contract.
- `pnpm cf:check -- --workers=state|app|all|<comma-list>` scopes the same contract to explicit worker targets; the default remains `all`.
- `pnpm cf:check` reads `sites/<site>/site.config.json` + `sites/<site>/deploy.settings.json` through the shared resolver; it does not infer deploy semantics from admin/live settings, local test flags, or static wrangler path bypasses.
- `pnpm cf:build` validates OpenNext multi-bundle generation and hard-fails if any required router/server bundle is missing or if app dry-run upload checks report a deployable gzip bundle `>= 3 MiB`.
- `SITE=<site-key> pnpm test:cf-local-smoke` validates the canonical local Cloudflare runtime path through a generated temporary topology: the router and all server Workers start under one `wrangler dev` multi-config session, required `.open-next` artifacts are checked before boot, and the read-only smoke runs against the router origin.
- `SITE=<site-key> pnpm test:cf-admin-settings-smoke` validates the smaller Cloudflare-only local acceptance chain for storage semantics: direct DB seeding, real `/api/storage/upload-image`, public config projection, and the explicit `STORAGE_PUBLIC_BASE_URL` missing-error path inside the same local Cloudflare runtime session.
- `SITE=<site-key> pnpm test:cf-app-smoke` validates post-deploy production read-only smoke on the real app origin.
- Before production deploy, `Cloudflare Deploy Acceptance` must pass `pnpm lint`, `pnpm arch:check`, `pnpm test`, `pnpm cf:check`, and `pnpm cf:build` for the accepted `main` revision.
- `SITE=mamamiya pnpm release:cf` must verify `HEAD == origin/main` and a successful `Cloudflare Deploy Acceptance` run for that exact commit before any production mutation.
- If schema changes are present, the local release input guard must require committed files under `src/config/db/migrations/**` before deploy.
- The local release command must run `pnpm db:migrate` before `pnpm cf:deploy:state` or app deploy work.
- After app worker deploy, the local release command must run `pnpm test:cf-app-smoke` against the real app origin.
- Compatibility-window safety is enforced by Cloudflare contract checks and state/app smoke coverage, not by changed-path allowlists in release metadata.
- Public smoke package command names are stable, but they are explicit site-driven entrypoints. Internally, `run-with-site.mjs` feeds `scripts/smoke.mjs <scenario>` and dispatches `cf-local`, `cf-app`, and `cf-admin-settings` to their concrete runner scripts.
- `BETTER_AUTH_SECRET` / `AUTH_SECRET` form one shared auth secret requirement for the Next server workers; satisfying either input key is enough, generated secrets files still write both keys, and router/state must not be blocked by auth secret generation when they are the only deploy targets.
- Cloudflare secrets file generation must pass an explicit `--workers=state|app|all|<comma-list>` scope; there is no implicit worker default.

## Raw Conclusion Governance

- Automation exit codes only express `harnessStatus`.
- Governance decisions must read `rawConclusion`.
- A non-zero exit code does not tell you whether the next action is adapter work, replacement work, or simply rerunning after setup repair.

| `rawConclusion` | Meaning                                                                                                         | Governance action                                                                       | Allowed / forbidden                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `PASS`          | The path is trustworthy within the tested scope.                                                                | Treat the path as currently governed and first-class for the tested capability.         | Allowed: update product/docs language to reflect verified evidence.                       |
| `需要 adapter`  | The path is viable, but the current contract still needs bounded normalization on the same implementation path. | Continue only with scoped contract-fix work on the current provider/runtime path.       | Forbidden: do not start provider replacement; do not describe the path as fully verified. |
| `需要替代路线`  | The current implementation path should not remain the governed default for that capability.                     | Stop adapter work and move to replacement-path or capability-reduction decision making. | Forbidden: do not keep presenting the current path as governed/validated by default.      |
| `BLOCKED`       | The run does not provide decision-quality evidence because setup or test trust is broken.                       | Fix environment, prerequisites, or harness trust first, then rerun.                     | Forbidden: do not make product or architecture conclusions from this run.                 |

Current semantic sources:

- `scripts/check-cloudflare-config.mjs`
- `scripts/run-cf-multi-build-check.mjs`
- `scripts/run-cf-admin-settings-smoke.mjs`
