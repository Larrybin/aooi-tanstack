# Repository Guidelines

## Project Structure & Module Organization

- `apps/web/src/routes`: TanStack page/API route entries; keep them thin.
- `apps/web/src/server`: Web-runtime dependency composition and assembled handlers.
- `src/domains`: business semantics, invariants, and application use cases.
- `src/infra`: platform, runtime, and external adapters such as auth, database, billing transports, and background services.
- `src/shared`: shared utilities, primitives, and cross-cutting types.
- `src/surfaces`: framework-neutral page surfaces for TanStack route data, SEO, and views. Route files should compose these helpers instead of embedding page logic.
- `src/testing`: shared smoke/test contracts and test-only helpers. Production runtime code must not depend on this layer.
- `src/themes`, `content`, `public`: UI themes, marketing/docs content (MDX), and static assets.
- `scripts`: one-off maintenance and automation scripts (RBAC, migrations, etc.).

## Build, Test, and Development Commands

- Install dependencies: `pnpm install`.
- Local development: `pnpm dev` (http://localhost:3000).
- Production build: `SITE=<site-key> pnpm build`.
- Run built app: `SITE=<site-key> pnpm start`.
- Lint code: `pnpm lint`.
- Lint architecture graph: `pnpm lint:deps`.
- Format code: `pnpm format` / check only: `pnpm format:check`.
- Database workflows: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`.
- Client bundle boundary: `SITE=dev-local pnpm build`, then `pnpm client:boundary`.
- Cloudflare deployment helpers: `pnpm cf:check`, `pnpm cf:build`, `pnpm cf:typegen`, `pnpm cf:typegen:check`, `pnpm cf:deploy:state`, `pnpm cf:deploy:app`, `pnpm cf:deploy` (app alias), `pnpm test:cf-local-smoke`.

## Coding Style & Naming Conventions

- Language: TypeScript + React, TanStack Start, TanStack Router, and Vite.
- Use Prettier and ESLint; do not bypass them in CI or local workflows.
- Prefer PascalCase for React components and types, camelCase for variables and functions, UPPER_SNAKE_CASE for environment variables.
- Follow TanStack file-route naming under `apps/web/src/routes` and keep components small and single-responsibility.
- TanStack routes under `apps/web/src/routes` should stay thin: handle params/search, loader, head, component, redirect, and notFound only. Move data loading, SEO, and view composition into `src/surfaces/**`.
- Do not import `next/*`, `next-intl`, `@/app/**`, or `@/themes/**` from TanStack route files or their runtime closure. Do not wrap old Next pages, use `React.use(Promise.resolve(...))`, `params: Promise`, `generateMetadata`, or `generateStaticParams` in TanStack paths.

## Testing Guidelines

- Use `pnpm test` as the default repository test gate; when adding tests, colocate them with features using `*.test.ts` / `*.test.tsx`.
- Keep `src/testing/**` limited to test-only contracts/helpers; do not let `src/**` or `cloudflare/**` production code import it.
- Keep tests fast and deterministic; prefer unit tests for domain logic in `src/domains` and lightweight integration tests for `apps/web` routes and `src/server` handlers.
- Treat generated directories such as `dist/`, `build/`, and `output/` as build artifacts only. Source files that must remain test-reachable may not top-level static `import` them; consume them only at explicit runtime boundaries, preferably via lazy `import()`.
- Treat `src/config/env-contract.ts` as the single env/secret contract source. Non-whitelisted runtime files must not read or propagate `process.env` directly.
- For route or architecture work, run `pnpm arch:check` before broader checks.
- Ensure critical flows (auth, billing, database migrations) have at least basic coverage before major releases.

## Commit & Pull Request Guidelines

- Use clear, imperative commit messages; Conventional Commit style (e.g., `feat(auth): add email login`) is preferred.
- Keep PRs focused; describe **what**, **why**, and **how to test**.
- Link related issues or tasks and include screenshots for UI changes.
- When behavior, configuration, or APIs change, update `README.md`, `content` docs, and relevant config files to keep documentation in sync.
- GitHub Actions in this repo are pinned to full commit SHA with `# pinned from vX` comments; update them through Dependabot PRs plus manual review, and keep `dependency-review` / `cloudflare acceptance` configured as required checks in repo settings.
