# Gate 5.2 Docs Search Content Boundary SPEC

Status: implementation SPEC
Branch: `codex/gate-5-2-docs-search-content-boundary`
Target base: `migration/tanstack-start-native`

## Problem

`/api/docs/search` currently builds its source through:

```text
src/app/api/docs/search/route.ts
  -> src/domains/content/application/docs-content.query.ts
  -> @/content-source
  -> .source/<site>/<build>/index
  -> MDX-backed Fumadocs source
```

That boundary is not safe for TanStack API route closure. When the TanStack route imports it, SSR build pulls generated MDX modules into the route bundle and fails by parsing MDX frontmatter as JavaScript.

## Decision

Move docs search to a TanStack-safe serialized search-index boundary based on `@/public-content`.

Do not import `docs-content.query` from the API route or search helper.

## Scope

P0:

- Add a framework-neutral docs search index helper under `src/server/api/docs/**`.
- Build the search index from serializable public content documents only.
- Add a TanStack API route at `apps/web/src/routes/api/docs/search.ts`.
- Keep the legacy Next route as a thin re-export while `src/app/**` still exists.
- Add focused tests for query, locale, empty query, and route response shape.
- Ensure TanStack validate/typecheck/build passes.

P1:

- Support better snippet extraction and scoring.
- Support `tag` only if existing docs search requires it.

P2:

- Reintroduce Fumadocs advanced/Orama indexing only after a TanStack-safe generated index exists.

## Non-goals

- Do not migrate the docs page route.
- Do not import `@/content-source` or `docs-content.query` into the docs search API closure.
- Do not import MDX files directly.
- Do not change docs URL behavior.
- Do not change Cloudflare worker topology.
- Do not remove `src/app/**` in this PR.

## Required behavior

`GET /api/docs/search?query=<q>` returns JSON compatible with Fumadocs fetch search client: an array of sorted result objects.

Each result must contain:

```ts
{
  id: string;
  url: string;
  type: 'page' | 'heading' | 'text';
  content: string;
  breadcrumbs?: string[];
}
```

Rules:

- Empty query returns `[]`.
- Query is case-insensitive.
- Results are limited to a small deterministic number.
- Locale filter must use `?locale=<locale>` when present.
- The index must use only serialized fields from `PublicContentDocument`: `title`, `description`, `content`, `toc`, `path`, `locale`, `slug`.

## File plan

Add:

```text
src/server/api/docs/search-index.ts
src/server/api/docs/search-route.ts
src/server/api/docs/search-index.server.test.ts
src/server/api/docs/search-route.server.test.ts
apps/web/src/routes/api/docs/search.ts
```

Modify:

```text
src/app/api/docs/search/route.ts
apps/web/src/routeTree.gen.ts
```

Add SPEC:

```text
docs/migration/gate-5-2-docs-search-content-boundary-spec.md
```

## Validation

Focused:

```bash
SITE=dev-local pnpm test -- src/server/api/docs/search-index.server.test.ts src/server/api/docs/search-route.server.test.ts
SITE=dev-local pnpm tanstack:validate
SITE=dev-local pnpm tanstack:typecheck
SITE=dev-local pnpm tanstack:build
```

Final:

```bash
git diff --check
```

## Success Criteria

- `/api/docs/search` exists in TanStack route tree.
- `src/app/api/docs/search/route.ts` is a thin legacy re-export.
- No new import from `docs-content.query` in API search route/helper.
- No new import from `@/content-source` in API search route/helper.
- Focused tests pass.
- TanStack build no longer fails from docs search route closure.
