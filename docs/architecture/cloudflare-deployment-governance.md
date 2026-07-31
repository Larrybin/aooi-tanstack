# Cloudflare deployment governance

Cloudflare deployment has two repository-owned inputs:

- `site.config.json` v2 defines modules and payment provider.
- `deploy.settings.json` v2 defines App/State Worker names and optional
  Hyperdrive/R2 resource identities.

All runtime requirements are derived from those inputs and product runtime
contracts. There are no service-binding forwarding layers, worker version
variables, deployment weights, or compatibility reads.

The required GitHub check is `ci`. It runs the same `pnpm run ci` command used
locally: formatting, lint, typecheck, tests, stable architecture boundaries,
and the dynamically discovered site matrix with build, client-boundary, strict
i18n, and Cloudflare acceptance checks.

Auth/OAuth spike reports retain their explicit `rawConclusion` decision:

| `rawConclusion` | Meaning                                                |
| --------------- | ------------------------------------------------------ |
| `PASS`          | the tested path is acceptable                          |
| `BLOCKED`       | external configuration or access prevents a conclusion |
| `需要 adapter`  | runtime parity requires an adapter                     |
| `需要替代路线`  | the tested topology is not viable                      |

These spike results are diagnostic evidence, not a second deploy contract.
