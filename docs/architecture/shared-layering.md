# Shared Layering

`src/shared/**` contains code whose meaning is genuinely cross-cutting. It may
hold UI primitives, generic helpers, API wire schemas, and stable types. It must
not own billing, account, entitlement, provider, route, or deployment logic.

## Direction

```text
routes -> server composition -> domains / infra
surfaces -> domains
domains/application -> same-domain domain and controlled read contracts
domains/domain -> no inbound or adapter dependencies
shared -> no business-domain or adapter ownership
```

Readable local duplication is preferred over moving business logic into
`shared`. Create an abstraction only when multiple real consumers share the
same stable semantics.

`src/shared/lib/**` is allowlisted by the semantic architecture test.
`src/shared/schemas/api/**` contains HTTP wire contracts only. Shared UI may
use approved platform UI entrypoints but may not instantiate adapters.

The dependency graph and semantic rules are owned by
`architecture-rules.cjs`, `dependency-cruiser.cjs`, and
`src/architecture-boundaries.test.ts`.
