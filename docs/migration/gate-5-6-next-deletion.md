# Gate 5.6 Next Deletion

Status: active SPEC

Gate 5.6 removes the legacy Next/OpenNext baseline after Gate 5.5 native Cloudflare topology is strict-green.

## Required checks

```bash
node scripts/check-gate-5-6-no-next.mjs --report
node scripts/check-gate-5-6-route-coverage.mjs --report
node scripts/check-gate-5-5-native-cloudflare-topology.mjs
```

Strict completion requires:

- no `src/app/**`;
- no `next/*`, `next-intl`, `@next/env`, `@opennextjs/*`, `server-only`, `nextjs-toploader`, or `eslint-config-next` active source/package residues;
- no `.open-next` active source/config assumptions;
- TanStack route coverage checker passes;
- native Cloudflare topology checker passes.

Package deletion belongs to this gate. Production DNS/secrets/deploy state is out of scope.
