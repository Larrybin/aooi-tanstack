const context = [
  'You are working in aooi.',
  'Keep the final code structure simple: KISS, YAGNI, no compatibility layers unless explicitly required.',
  'Before editing, inspect existing implementation with rg and read the relevant files.',
  'Keep apps/web/src/routes thin; compose server dependencies in src/server or apps/web/src/server.',
  'Respect the src/domains, src/infra, src/shared, src/surfaces, and src/testing boundaries.',
  'Production code must not import src/testing/**.',
  'Runtime env and secrets must go through src/config/env-contract.ts; non-whitelisted runtime files must not read or propagate process.env directly.',
  'Site-scoped commands must keep SITE=<site-key> explicit.',
  'For i18n changes, provide strict i18n check plus selected site build evidence.',
  'For Cloudflare, deploy, worker, or deploy settings changes, provide cf check/build/typegen evidence.',
  'For architecture-sensitive changes, prefer pnpm arch:check over only pnpm lint:deps.',
].join('\n');

process.stdout.write(
  `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  })}\n`
);
