# Gate 4-B Auth Routes

Gate 4-B.1 migrates public auth page entrypoints into TanStack routes:

- `/sign-in`, `/$locale/sign-in`
- `/sign-up`, `/$locale/sign-up`
- `/forgot-password`, `/$locale/forgot-password`
- `/reset-password`, `/$locale/reset-password`
- `/no-permission`, `/$locale/no-permission`

Scope is page routing only. Better Auth backend routes, auth API handlers, session cookies, member pages, admin pages, and legacy `src/app/[locale]/(auth)/*` files are unchanged.

The TanStack routes are thin glue around `src/surfaces/auth/auth-route/*`. Runtime settings stay behind `src/server/auth/auth-route-data.ts`, which uses a `createServerFn` dynamic import of `auth-route-resolver.ts` so `settings-runtime.query` does not enter the route or surface closure.

Auth localization is functional, not content-publishing gated. A route renders when `normalizeLocale()` accepts the locale and `common.json` can be loaded for that locale, with key-level fallback to English.
