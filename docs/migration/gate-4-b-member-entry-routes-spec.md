# Gate 4-B.2 Member Entry Routes

Gate 4-B.2 migrates only the member entry redirects into TanStack routes:

- `/settings`, `/$locale/settings`
- `/activity`, `/$locale/activity`

Scope is entry routing only. Settings pages, activity pages, member shell, auth guard framework, user session reads, billing/profile/API-key leaves, and legacy `src/app/[locale]/(landing)/(settings|activity)/*` files are unchanged.

The routes use non-nested file routes:

- `apps/web/src/routes/settings_.tsx`
- `apps/web/src/routes/activity_.tsx`
- `apps/web/src/routes/$locale/settings_.tsx`
- `apps/web/src/routes/$locale/activity_.tsx`

This keeps entry redirects from becoming parent/layout routes for future member leaves.
TanStack may record the internal route IDs with the non-nested suffix
(`/settings_`, `/activity_`, `/$locale/settings_`, `/$locale/activity_`), while
the generated `fullPath` values remain the public URLs below.

Redirect targets:

- `/settings` -> `/settings/profile`
- `/$locale/settings` -> `/$locale/settings/profile`
- `/activity` -> `/activity/ai-tasks`
- `/$locale/activity` -> `/$locale/activity/ai-tasks`

Query strings are preserved. URL fragments are not part of the server request and are not a route-data requirement.

Locale handling uses the current site locale contract. Unsupported locales return not found route data.

`/activity` keeps the legacy AI visibility gate: if `isAiEnabled(readPublicUiConfigFresh())` is false, the entry returns not found instead of redirecting to an activity leaf. `/settings` does not read public UI config or user session data.

The runtime settings read stays behind `src/server/member/member-entry-route-data.ts`, which uses a `createServerFn` dynamic import of `member-entry-route-resolver.ts` so `settings-runtime.query` does not enter the route or surface closure.

Current middleware still protects `/settings/**` and `/activity/**` before route handling for requests without a session cookie. Member entry route tests verify route-data behavior, not an unauthenticated browser redirect chain.
