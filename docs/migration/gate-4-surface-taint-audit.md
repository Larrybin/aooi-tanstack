# Gate 4 Surface Taint Audit

## Scope

Audit target: current `src/surfaces/**`.

Taint patterns:

- `next/*` imports
- `next-intl/server` imports
- `server-only` imports
- `@/app/**` imports
- `src/app/**` imports
- `src/legacy/**` imports
- `type Metadata from next`
- `params: Promise`
- `generateMetadata`
- `generateStaticParams`

## Current Result

No current file under `src/surfaces/**` matches the taint patterns above.

## Route Closure Boundary

F1 separates TanStack page route closure from TanStack API route closure:

- TanStack page route closure forbids `server-only` because pages are the Gate 4-A/B/C/D migration surface.
- TanStack API routes are not page migrations in this train. Existing API route closure may still reach `server-only` server action/domain modules.
- TanStack API route closure still forbids `next/*`, `next-intl/server`, `@/app/**`, `src/app/**`, and legacy helper imports.

## Required Checks

| File                                             | Matched taint       | Classification | Impact on Gate 4-A/B/C/D                                        | Recommended extraction target                                  |
| ------------------------------------------------ | ------------------- | -------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/surfaces/public/product-landing.tsx`        | none                | TanStack-safe  | No current blocker for 4-A/B/C/D                                | Keep framework-neutral in `src/surfaces/public/**`             |
| `src/surfaces/public/seo/metadata.ts`            | removed / extracted | Legacy-only    | Would block page routes if reintroduced into surfaces           | `src/app/_metadata/public-page-metadata.ts`                    |
| `src/surfaces/admin/create-admin-table-page.tsx` | removed / extracted | Legacy-only    | Would block admin route migration if reintroduced into surfaces | `src/app/_admin-support/create-admin-table-page.tsx`           |
| `src/surfaces/admin/server/action-utils.ts`      | removed / extracted | Legacy-only    | Would taint future admin surface reuse                          | `src/app/_admin-support/action-utils.ts`                       |
| `src/surfaces/admin/server/page-setup.ts`        | removed / extracted | Legacy-only    | Would taint future admin route migration                        | `src/app/_admin-support/page-setup.ts`                         |
| `src/surfaces/admin/server/crumbs.ts`            | none                | TanStack-safe  | No current blocker for 4-A/B/C/D                                | Keep in `src/surfaces/admin/server/**` while framework-neutral |

## Decision

`src/surfaces/**` is the TanStack-safe page dependency layer. Next-only helper code belongs in app-private boundaries:

- `src/app/_metadata/**`
- `src/app/_admin-support/**`
- `src/app/_legacy/**` only when a helper has no clearer app-private home

TanStack routes, TanStack surfaces, server composition, and domains must not import app-private legacy helpers.
