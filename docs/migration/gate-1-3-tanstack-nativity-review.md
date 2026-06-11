# Gate 1-3 TanStack Nativity Review

## Decision

Gate 1-3 remains a valid migration baseline, but it is not a fully native TanStack baseline.

This is a continuation of the original in-place migration in the aooi repository. It is not a new repo, rewrite, or parallel app.

The first principle for Gate 4 is TanStack-native / TanStack-friendly first. Gate 4 must proceed foundation-first: clean route dependencies and framework boundaries before retrying page migration.

## Review Standard

- Native: TanStack Router/Start primitives and typed route data.
- Friendly: Vite SSR, Web APIs, Cloudflare-compatible modules, and neutral surface dependencies.
- Legacy-only: Next app/runtime code that remains under app-private boundaries.
- Blocker: code that pulls Next runtime, app-only helpers, MDX React nodes, docs runtime, or legacy adapters into TanStack route loaders/surfaces.

## Current Baseline

- `apps/web/src/routes/**` owns TanStack route entrypoints.
- `src/surfaces/**` is the shared page dependency layer used by TanStack routes.
- Legacy Next routes remain in `src/app/**`.
- Next-only helpers must stay under app-private boundaries such as `src/app/_metadata/**` or `src/app/_admin-support/**`.

## Blockers Identified Before Continuing Gate 4-A

- `src/surfaces/**` must not import `next/*`, `next-intl/server`, `server-only`, `@/app/**`, or `src/app/**`.
- TanStack route runtime closure must not pull app-private or legacy Next-only helpers.
- Public content used by TanStack loaders must be serializable before slug routes are retried.
- TanStack new paths need their own i18n foundation before replacing legacy `next-intl` behavior.

## F1 Scope

Gate 4-F1 only establishes the surface boundary foundation:

- Audit `src/surfaces/**` for Next-only taint.
- Move Next-only surface helpers to app-private boundaries.
- Strengthen validation so taint fails before page migration.

Gate 4-F1 does not introduce Paraglide, does not build the public content foundation, and does not migrate pages.

## Required Order

1. Complete Gate 4-F1 Surface Boundary Foundation.
2. Add generated serializable public content in Gate 4-F2.
3. Add minimal Paraglide support for TanStack new paths in Gate 4-F3.
4. Retry Gate 4-A slug migration only after F1-F3 pass.

## Compatibility Decision

Compatibility required: no for TanStack paths.

Legacy Next paths can continue using app-private helpers, but TanStack routes and surfaces must converge directly on neutral dependencies.
