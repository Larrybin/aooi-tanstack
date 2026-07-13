# Contributing Guide

## Development setup

Requirements: Node.js 20+, pnpm, Git, and PostgreSQL for database-backed
features.

```bash
pnpm install
cp .env.example .env.development
pnpm db:migrate
pnpm dev:local
```

Use `SITE=<site-key> pnpm dev` when working on another site. Never commit
secrets to root env files, `sites/**`, deploy settings, pricing, i18n, or
content files.

## Commands

| Command                          | Purpose                                   |
| -------------------------------- | ----------------------------------------- |
| `pnpm dev:local`                 | Start the `dev-local` site                |
| `SITE=<site> pnpm dev`           | Start a selected site                     |
| `SITE=<site> pnpm build`         | Build the selected site with Vite         |
| `SITE=<site> pnpm start`         | Preview that site's production build      |
| `pnpm lint`                      | Run ESLint and runtime-env guards         |
| `pnpm typecheck`                 | Type-check root and Web sources           |
| `pnpm test`                      | Run repository tests, including `apps/**` |
| `pnpm arch:check`                | Run dependency and semantic architecture  |
| `pnpm format:check`              | Check Prettier formatting                 |
| `pnpm run ci`                    | Run the canonical repository gate         |
| `SITE=<site> pnpm release:check` | Run CI and Cloudflare release preflight   |
| `pnpm db:generate`               | Generate a Drizzle migration              |
| `pnpm db:migrate`                | Apply committed Drizzle migrations        |
| `pnpm db:studio`                 | Open Drizzle Studio                       |

## Code structure

- `apps/web/src/routes/**`: thin TanStack route entries. Keep path, params,
  search, loader/head declarations, HTTP methods, redirects/not-found, and
  calls to assembled handlers here.
- `apps/web/src/server/**`: Web-runtime composition and handler wiring.
- `src/domains/**`: business rules, application use cases, and domain-owned
  persistence.
- `src/server/**`: reusable server actions and handler factories.
- `src/surfaces/**`: framework-neutral page data, SEO, and views.
- `src/infra/**`: platform runtime and external adapters.
- `src/shared/**`: generic UI, schemas, and utilities.
- `src/testing/**`: test-only contracts and helpers.
- `cloudflare/**`: Worker entrypoints and runtime contracts.

Production code must not import `src/testing/**`. Runtime env and secrets must
go through `src/config/env-contract.ts`; non-whitelisted runtime files must not
read `process.env` directly.

## Route and client boundaries

TanStack route files must remain thin. Put dependency assembly in
`apps/web/src/server/**`, and reusable request behavior in `src/server/**`.

```typescript
import { createFileRoute } from '@tanstack/react-router';

import { postExample } from '../../../server/handlers/example';

export const Route = createFileRoute('/api/example')({
  server: {
    handlers: {
      POST: ({ request }) => postExample(request),
    },
  },
});
```

Use `withApi()` inside the assembled handler when the endpoint follows the
standard API envelope. Provider-controlled routes such as Better Auth may keep
their explicit contract exception.

Keep browser-only behavior in client modules or interactive leaf components.
Do not import database, secret, Node-only, or Worker-only modules into the
client closure. Validate bundle changes with:

```bash
SITE=dev-local pnpm build
pnpm client:boundary
```

## Database access

Use Drizzle. Domain-owned persistence belongs in `src/domains/<domain>/infra`;
cross-domain platform adapters belong in `src/infra/adapters`. Do not add
runtime marker packages: architecture and client-bundle gates enforce the
boundary.

Database schema changes require a generated, reviewed, and committed migration.

## Testing

Colocate deterministic tests as `*.test.ts` or `*.test.tsx`. Prefer domain unit
tests, then lightweight handler or route integration tests. Tests under
`apps/**`, `src/**`, `scripts/**`, and `tests/**` are discovered by `pnpm test`.

Before submitting:

```bash
pnpm format:check
pnpm run ci
```

For site or Cloudflare changes, also run the smallest affected site contract,
site gate, or Cloudflare preflight with an explicit `SITE`.

## Pull requests

- Keep each PR focused and explain what changed, why, and how it was tested.
- Use clear imperative commit messages; Conventional Commits are preferred.
- Include screenshots for visual changes.
- Update current documentation when commands, configuration, APIs, or
  architecture entrypoints change.
- Do not treat `docs/archive/**` or `.codex/plan/**` as current contracts.

## Security

- Never commit secrets, credentials, production data, or generated secret
  files.
- Validate external input at runtime.
- Enforce identity and permissions on protected operations.
- Keep error responses free of stack traces, secret values, and internal
  diagnostics.

Report security vulnerabilities privately to the maintainers rather than in a
public issue.
