# SaaS Platform Contract Audit Skeleton Plan

Date: 2026-05-18

## Goal

Implement the smallest useful contract audit for `aooi`: a source-mapped,
report-only check that proves whether one site can safely resolve its site
identity, pricing, plan entitlements, and runtime-owned commercial settings.

This replaces the broader SaaS Platform Core Contract plan. The first PR must
not create a full platform contract runtime.

## Scope

PR 1 only covers:

1. Source mapping.
2. Site contract summary.
3. Commercial/pricing summary.
4. Entitlement key validation.
5. Runtime-owned field report.
6. Launch blockers and warnings.
7. CLI report for `SITE=ai-remover`.

Everything else is deferred.

## Non-Goals

- No `UsageContract`.
- No `CreditsContract`.
- No `BillingReversalContract`.
- No `ProviderCapabilityMatrix`.
- No product template generator.
- No generic quota table.
- No Admin pricing or entitlement editor.
- No AI Remover runtime refactor.
- No changes to runtime routes, webhook handlers, database write paths, billing
  flows, quota reservation paths, or AI provider invocation paths.

## Why This Smaller Scope

The prior plan was directionally reasonable but too broad for a first
implementation. It mixed platform audit, billing reversal, usage semantics,
provider capability design, and future control-plane ideas into one stage.

The first useful engineering step is narrower:

> Can the selected site produce a trustworthy, source-mapped report that shows
> what is resolved, what is missing, what is source-controlled, and what is
> runtime-owned?

If this fails, broader platform contracts would be built on guesses.

## Core Types

Add only the minimum types needed for the audit:

```text
src/config/saas-product-contract/types.ts
src/config/saas-product-contract/index.ts
```

Required concepts:

```ts
type ContractSectionStatus =
  | 'resolved'
  | 'partial'
  | 'product_owned'
  | 'runtime_owned'
  | 'missing'
  | 'not_applicable';

type ContractSourceKind =
  | 'site_config'
  | 'pricing'
  | 'deploy_settings'
  | 'product_modules'
  | 'settings_definition'
  | 'runtime_env'
  | 'derived';

type ContractSourceRef = {
  kind: ContractSourceKind;
  path?: string;
  key?: string;
};

type ContractSection<T> = {
  status: ContractSectionStatus;
  value?: T;
  sources: ContractSourceRef[];
  issues: ContractValidationIssue[];
};
```

Do not introduce class managers, builder chains, plugin loaders, or registry
services.

## Report Shape

The report should be explicit rather than pretending the site has a complete
platform contract:

```ts
type ContractAuditReport = {
  site: ContractSection<SiteSummary>;
  commercial: ContractSection<CommercialSummary>;
  entitlementKeys: ContractSection<EntitlementKeySummary>;
  runtimeOwnership: ContractSection<RuntimeOwnershipSummary>;
  launch: {
    blockers: ContractValidationIssue[];
    warnings: ContractValidationIssue[];
    recommendedCommands: string[];
  };
};
```

The report must mark every section as one of:

```text
resolved
partial
product_owned
runtime_owned
missing
not_applicable
```

## Source-Mapped Audit Rules

### Site Summary

Resolve from `sites/<site-key>/site.config.json` through generated `@/site`
where possible.

Check:

- site key
- app name
- app URL
- support email
- logo
- favicon
- preview image
- capability flags

### Commercial Summary

Resolve from `sites/<site-key>/pricing.json`.

Check:

- pricing file exists when payment capability is enabled
- plan count
- stable internal `product_id`
- `checkout_enabled`
- interval
- amount
- currency
- paid checkout plan has a provider product mapping path

Do not call payment providers.

### Entitlement Key Validation

Validate only keys that already exist in pricing data.

Initial allowed common key aliases may cover current repo reality, but the report
must distinguish:

- common known keys
- product-owned keys
- raw unknown keys

Allowed product-owned format:

```text
product.<site-key>.<name>
```

For current AI Remover raw keys, report warnings instead of rewriting pricing.

### Runtime Ownership

Report which values are intentionally runtime-owned through Admin Settings,
env, or Cloudflare secrets.

Examples:

- OAuth client IDs and secrets
- payment provider product mapping
- payment provider secrets
- email provider secrets
- storage public URL
- cleanup secret

The report should not require these to be present unless the selected check mode
is launch-readiness.

## CLI

Add a check command:

```text
scripts/check-saas-product-contract.mjs
```

Expected usage:

```bash
SITE=ai-remover node scripts/check-saas-product-contract.mjs
```

Optional package script:

```bash
SITE=ai-remover pnpm contract:check
```

Expected human-readable output:

```text
SaaS Contract Audit

Site: ai-remover
Site section: resolved
Billing: enabled
Pricing file: resolved
Plans: 3 resolved

Entitlement keys:
  ok       low_res_download
  warning  raw key: guest_daily_removals
  warning  raw key: monthly_removals

Runtime-owned fields:
  payment provider product mapping: runtime-owned
  OAuth secrets: runtime-owned
  storage public URL: runtime-owned

Launch blockers:
  none

Warnings:
  raw entitlement keys should be migrated to common or product-owned names
```

Machine-readable JSON output can be added later if needed.

## Acceptance Criteria

For `SITE=ai-remover`:

1. The check emits a source-mapped report.
2. Every report section has an explicit status.
3. Site identity is resolved from the selected site.
4. Pricing resolves three AI Remover plans.
5. Paid checkout plans are identified.
6. Runtime-owned payment provider mapping is reported as runtime-owned, not
   guessed from source-controlled files.
7. Existing entitlement keys are classified as known, product-owned, or raw
   unknown.
8. Unknown/raw entitlement keys create warnings, not silent defaults.
9. No runtime route, webhook handler, database write path, billing flow, quota
   reservation path, or AI provider invocation path is modified.

## Verification Commands

Focused verification:

```bash
SITE=ai-remover node scripts/check-saas-product-contract.mjs
pnpm test src/config/product-modules/index.test.ts src/config/product-modules/doc-links.test.ts
```

If a package script is added:

```bash
SITE=ai-remover pnpm contract:check
```

Do not run `run-with-site` commands in parallel because they generate
`.generated/site.ts`.

## Deferred Work

### PR 2: Billing Reversal Report

Audit webhook, refund, subscription, and compensation paths.

Must address:

- partial refund
- refund after usage was consumed
- chargeback/dispute
- duplicate webhook idempotency
- cancel at period end vs immediate downgrade
- subscription renewal success with credit grant failure

### PR 3: Provider Readiness Report

Audit provider technical readiness only:

- required env
- required bindings
- required secrets
- supported models
- sync/async mode
- fallback availability

Plan access policy remains in commercial/entitlement rules, not provider
technical capability.

### PR 4: Usage/Credits Mapping

Map existing credit ledger and AI Remover quota reservation semantics.

Do not migrate to a generic usage table until a second real product proves the
shared shape.

## First PR Boundary

Files likely in scope:

```text
src/config/saas-product-contract/**
scripts/check-saas-product-contract.mjs
docs/guides/saas-product-contract.md
docs/architecture/saas-platform-core-contract-implementation-plan.md
```

Files out of scope:

```text
src/app/api/**
src/domains/remover/**
src/domains/billing/application/**
src/domains/billing/infra/**
src/infra/adapters/payment/**
src/infra/adapters/ai/**
src/config/db/**
```

The first PR is complete when it can audit AI Remover without changing runtime
behavior.
