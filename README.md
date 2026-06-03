# Roller Rabbit

Production-ready AI SaaS template built with Next.js App Router, TypeScript,
PostgreSQL, and a Cloudflare Workers production deploy contract.

## Developer Map

Start here:

- [Quick Start](#quick-start): run the app locally.
- [Project Structure](#project-structure): find the right layer before editing.
- [Common Commands](#common-commands): daily development commands.
- [Documentation](#documentation): deeper guides.

Core references:

- [Module Contract](docs/guides/module-contract.md): mainline vs optional modules.
- [Architecture Overview](docs/architecture/overview.md): current architecture baseline.
- [Deployment Guide](docs/guides/deployment.md): Cloudflare deployment and smoke flow.
- [Contributing](CONTRIBUTING.md): PR, style, and repository rules.

## Product Contract

Roller Rabbit treats the repo as:

- a mainline shell you can ship on day one
- a set of optional modules you enable later

Mainline today:

- Core shell
- Auth
- Billing
- Admin Settings
- Deploy contract

Optional modules today:

- Docs / Blog
- AI
- Storage
- Analytics / Affiliate / Customer Service / Ads

The single source of truth for this split is
[docs/guides/module-contract.md](docs/guides/module-contract.md).

## Project Structure

```text
src/
├── app/           # Route-only: Next.js routes, layouts, route handlers
├── domains/       # Business semantics and application use cases
├── surfaces/      # Product/admin composition surfaces
├── infra/         # Platform/runtime/adapters
├── shared/        # Pure UI, utilities, schemas, and cross-cutting types
├── extensions/    # Third-party integrations
├── config/        # Configuration, DB schema, locale messages
├── testing/       # Shared smoke/test contracts and test-only helpers
└── themes/        # UI themes

docs/              # Engineering documentation
sites/             # Per-site identity, deploy, and content inputs
scripts/           # Maintenance and automation scripts
```

Layering rules:

- `src/app/**` keeps route entries, layouts, and route handlers thin.
- `src/domains/**` owns business semantics, invariants, and use cases.
- `src/surfaces/**` composes product/admin surfaces from domains.
- `src/infra/**` owns platform, runtime, and external adapters.
- `src/shared/**` stays generic: UI primitives, utilities, schemas, types.
- `src/testing/**` is test-only. Production code must not import it.

## Quick Start

Prerequisites:

- Node.js 20+
- pnpm
- PostgreSQL database

Run locally:

```bash
pnpm install
cp .env.example .env.development
```

`pnpm dev:local` runs the `dev-local` site through the normal Next.js dev
server. It also injects local fallback auth secrets when neither
`BETTER_AUTH_SECRET` nor `AUTH_SECRET` is set.

If you need database-backed features such as auth, admin, RBAC, settings, or
payments, edit `.env.development` and set at least:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/aooi"
DATABASE_PROVIDER="postgresql"
DB_SINGLETON_ENABLED="true"
BETTER_AUTH_SECRET="replace-with-a-local-secret"
AUTH_SECRET="replace-with-the-same-local-secret"
```

Apply migrations when `DATABASE_URL` is configured, then start the local site:

```bash
pnpm db:migrate
pnpm dev:local
```

Visit http://localhost:3000.

The root `.env.development` file is the repository-level local fallback. For a
specific SaaS site, add a private `sites/<site-key>/.env.local` file to override
those local values only when running with `SITE=<site-key>`. For example,
`SITE=ai-remover pnpm dev` reads `sites/ai-remover/.env.local` after the root
env files, while shell values passed directly to the command still win.

Do not put database connection strings in `.dev.vars`. Local Cloudflare smoke
and spike commands read `DATABASE_URL` or `AUTH_SPIKE_DATABASE_URL` from the
process env after the root/site env files are loaded, then write only a
temporary Wrangler config for Hyperdrive.

`pnpm dev:local` selects `sites/dev-local/site.config.json`, whose local origin
is `http://localhost:3000`. To run another site locally, use
`SITE=<site-key> pnpm dev`. Production-like, Cloudflare, smoke, build, and
deploy commands must pass the intended `SITE=<site-key>` explicitly.

AI Remover's real upload / remove / download flow needs Cloudflare bindings.
Use `pnpm dev:ai-remover:cloudflare` and open the printed `localhost:8787` URL
instead of `localhost:3000` when testing that flow in a browser.

### Feature Configuration

Use env files and Cloudflare secrets for values required before the app can
boot: database URLs, auth secrets, OAuth client secrets, payment provider
secrets, storage URL prefixes, provider API keys, cleanup secrets, and deploy
operator credentials.

Use Admin Settings only after the app is running with a database. Admin Settings
is for non-secret operational switches and mappings such as auth provider
enablement, sender email, payment environment, Creem product ID mappings, AI
feature enablement, and display/support values.

For site-specific local values, prefer `sites/<site-key>/.env.local` over the
root `.env.development`. For production, configure runtime secrets, vars, and
bindings in Cloudflare; do not put secrets in `site.config.json`,
`deploy.settings.json`, pricing JSON, or content files.

## Common Commands

| Command                    | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `pnpm dev:local`           | Start local Next.js development server      |
| `pnpm test`                | Run fast unit and contract tests            |
| `pnpm test:extended`       | Run external or environment-dependent tests |
| `pnpm lint`                | Run ESLint and env/process guards           |
| `pnpm arch:check`          | Run dependency graph and boundary checks    |
| `pnpm format:check`        | Check Prettier formatting                   |
| `pnpm db:generate`         | Generate Drizzle migrations                 |
| `pnpm db:migrate`          | Apply database migrations                   |
| `pnpm db:studio`           | Open Drizzle Studio                         |
| `SITE=<site> pnpm build`   | Build the selected site                     |
| `SITE=<site> pnpm analyze` | Build with bundle analyzer reports          |

Cloudflare commands live in the
[Deployment Guide](docs/guides/deployment.md).

Repo-local Codex hooks live in `.codex/hooks.json`. They inject short aooi
context, block destructive shell/deploy commands, and require verification
evidence before Codex finalizes code or config changes.

Cloudflare preview deploys use the same `SITE=<site-key>` plus
`CF_DEPLOY_PROFILE=preview`. Preview is a deploy profile, not a separate site.
Use it when local Cloudflare topology is not enough and you need a real
workers.dev runtime before production.

## Bundle 分析

使用分析构建（与现有 build 包装器一致）：

```bash
SITE=<site> pnpm analyze
```

例如本地基线可使用 `SITE=dev-local pnpm analyze`。

报告输出位置（Next Bundle Analyzer 默认目录）：

- `.next/analyze/client.html`
- `.next/analyze/edge.html`
- `.next/analyze/nodejs.html`

为便于基线对比，约定：

- 原始 analyzer 报告固定使用 `.next/analyze/`。
- 将关键指标按日期记录到本文档（或对应运维文档）“Bundle 分析”小节。
- 至少跟踪以下关键页面：首页（`/[locale]`）、登录（`/[locale]/sign-in`）、账单（`/[locale]/settings/billing`）。

### 初始基线（2026-04-28，SITE=dev-local）

- 初始 JS（root main files，总和）：`426,187 bytes`（≈ `416.2 KiB`）。
- 三个关键页面共享 chunk（交集，总和）：`534,522 bytes`（≈ `522.0 KiB`）。
- 主要路由 chunk（路由级 app chunks 总和）：

| 页面                                |             路由级 chunk 总量 |
| ----------------------------------- | ----------------------------: |
| 首页 `(/[locale])`                  | `33,812 bytes` (≈ `33.0 KiB`) |
| 登录 `(/[locale]/sign-in)`          | `41,819 bytes` (≈ `40.8 KiB`) |
| 账单 `(/[locale]/settings/billing)` | `35,939 bytes` (≈ `35.1 KiB`) |

## Site Configuration

Site identity is build-time input from `sites/<site>/site.config.json` and is
exposed to runtime code through the generated `@/site` module.

Current sites:

- `dev-local`: local development and tests
- `mamamiya`: production site
- `ai-remover`: AI Object Remover SaaS product site

Important fields:

- `brand.appName`: site title, docs/SEO, and email title
- `brand.appUrl`: canonical URL, sitemap, and callback origin
- `brand.supportEmail`: legal pages and contact entry points
- `brand.logo`, `brand.favicon`, `brand.previewImage`: brand assets
- `capabilities`: site-level module availability

To add another site, follow
[docs/guides/add-site.md](docs/guides/add-site.md). If the new site has its
own AI product workflow, also follow
[docs/guides/add-ai-saas-site.md](docs/guides/add-ai-saas-site.md).

## Environment Contract

[src/config/env-contract.ts](src/config/env-contract.ts) is the single env and
secret allowlist source. Runtime files should read env through the approved
helpers instead of touching `process.env` directly.

`.env.example` is the template for local `.env.development` and production
operator `.env.production` files. The production deploy target is Cloudflare;
local `pnpm dev:local` still runs through Next.js and does not require Wrangler.

## Documentation

Engineering guides:

| Document                                            | Description                                   |
| --------------------------------------------------- | --------------------------------------------- |
| [Auth Guide](docs/guides/auth.md)                   | Authentication with Better Auth               |
| [Add Site Runbook](docs/guides/add-site.md)         | Add a site instance                           |
| [Add AI SaaS Site](docs/guides/add-ai-saas-site.md) | Add an AI product workflow site               |
| [Module Contract](docs/guides/module-contract.md)   | Product module matrix and verification status |
| [Deployment Guide](docs/guides/deployment.md)       | Cloudflare deploy and smoke flow              |
| [Database Guide](docs/guides/database.md)           | Drizzle ORM and migrations                    |
| [Payment Guide](docs/guides/payment.md)             | Multi-provider payment integration            |
| [RBAC Guide](docs/guides/rbac.md)                   | Role-based access control                     |
| [Settings Guide](docs/guides/settings.md)           | User and admin settings surfaces              |

Quality references:

| Document                                                                | Description                              |
| ----------------------------------------------------------------------- | ---------------------------------------- |
| [Conventions Index](docs/CONVENTIONS.md)                                | Repository conventions and code patterns |
| [Code Review](docs/CODE_REVIEW.md)                                      | Full code review guide                   |
| [Architecture Overview](docs/architecture/overview.md)                  | Current architecture baseline            |
| [Architecture Review](docs/archive/architecture/ARCHITECTURE_REVIEW.md) | Historical architecture audit snapshot   |

Module guides:

- [Auth](docs/guides/modules/auth.md)
- [Billing](docs/guides/modules/billing.md)
- [Docs / Blog](docs/guides/modules/docs-blog.md)
- [AI](docs/guides/modules/ai.md)
- [Storage](docs/guides/modules/storage.md)
- [Growth Support](docs/guides/modules/growth-support.md)

## CI Guardrails

The `Cloudflare Deploy Acceptance` workflow splits generic CI from deployment
acceptance:

- `pnpm lint` and `pnpm arch:check` run as the static CI gate.
- `pnpm test` runs as the default test gate.
- `scripts/check-release-inputs.mjs` enforces DB schema changes shipping with
  migrations.
- `pnpm cf:check` and `pnpm cf:build:no-db --site=<site>` run only for
  Cloudflare-relevant changes, across the explicit deployable site matrix, with
  direct database URLs cleared and CI-only placeholder runtime bindings.
- `SITE=ai-remover pnpm contract:check` runs only for AI Remover contract
  changes.

GitHub Actions are pinned to full commit SHAs with `# pinned from vX` comments.
Keep `dependency-review` and `cloudflare acceptance` configured as required
checks in repository settings.

GitHub Actions is the Cloudflare acceptance gate, not the production deploy authority.
Production Cloudflare releases are run explicitly from a local operator session
with `SITE=mamamiya pnpm release:cf`.

## Feedback

Submit feedback via GitHub Issues.

## License

No license file is included in this repository. Add one if you plan to distribute
the code.
