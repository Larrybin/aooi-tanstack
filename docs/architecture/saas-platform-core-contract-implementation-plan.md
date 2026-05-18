# SaaS Platform Contract Audit Plan

Date: 2026-05-18

## Goal

Implement the smallest useful contract audit for `aooi`: a source-mapped,
report-only check that proves whether one site can safely resolve its site
identity, pricing, plan entitlements, runtime-owned commercial settings, and
billing reversal readiness.

This replaces the broader SaaS Platform Core Contract plan. It must not create
a full platform contract runtime.

## Scope

PR 1 covered:

1. Source mapping.
2. Site contract summary.
3. Commercial/pricing summary.
4. Entitlement key validation.
5. Runtime-owned field report.
6. Launch blockers and warnings.
7. CLI report for `SITE=ai-remover`.

PR 2 only adds:

1. Source-mapped Billing Reversal Report section.
2. Static audit of existing payment notify, webhook inbox, subscription, order,
   credit, and replay sources.
3. Launch warnings for missing refund, chargeback, expiration, and manual
   compensation contracts.

Everything else is deferred.

## Non-Goals

- No `UsageContract`.
- No `CreditsContract`.
- No `ProviderCapabilityMatrix`.
- No product template generator.
- No generic quota table.
- No Admin pricing or entitlement editor.
- No real refund, cancel, chargeback, or compensation runtime.
- No Admin compensation UI.
- No database schema or migration change.
- No AI Remover runtime refactor.
- No changes to runtime routes, webhook handlers, database write paths, billing
  flows, quota reservation paths, or AI provider invocation paths.

## Why This Smaller Scope

The original plan was directionally reasonable but too broad for a first
implementation. It mixed platform audit, billing reversal, usage semantics,
provider capability design, and future control-plane ideas into one stage.

The useful engineering step is narrower:

> Can the selected site produce a trustworthy, source-mapped report that shows
> what is resolved, what is missing, what is source-controlled, and what is
> runtime-owned?

If this fails, broader platform contracts would be built on guesses.

## Core Types

Keep only the minimum types needed for the audit:

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
  | 'billing_domain'
  | 'billing_application'
  | 'billing_infra'
  | 'billing_test'
  | 'derived';

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

The report is explicit rather than pretending the site has a complete platform
contract:

```ts
type ContractAuditReport = {
  site: ContractSection<SiteSummary>;
  commercial: ContractSection<CommercialSummary>;
  entitlementKeys: ContractSection<EntitlementKeySummary>;
  runtimeOwnership: ContractSection<RuntimeOwnershipSummary>;
  billingReversal: ContractSection<BillingReversalSummary>;
  launch: {
    blockers: ContractValidationIssue[];
    warnings: ContractValidationIssue[];
    recommendedCommands: string[];
  };
};
```

Every section must be marked as one of:

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

Resolve from `sites/<site-key>/site.config.json`.

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

The report must distinguish:

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

The report should not require these values to be present unless the selected
check mode is launch-readiness.

## PR 2 Billing Reversal Report

The Billing Reversal section is a source-mapped audit, not a runtime contract or
state machine.

It audits at least:

1. `checkout.success`
2. `payment.success`
3. `payment.failed`
4. `payment.refunded`
5. `subscribe.updated`
6. `subscribe.canceled`
7. `subscription.renewed`
8. `subscription.expired`
9. `chargeback/dispute`
10. `partial refund`
11. `refund after usage consumed`
12. `manual compensation`
13. `unknown/unsupported webhook`

Each event reports support status, source refs, subscription effect,
entitlement effect, credit effect, usage effect, audit effect, idempotency,
operator action, and issues.

Rules:

- If `subscription.renewed` is represented by `payment.success` plus
  `SubscriptionCycleType.RENEWAL`, the report must say so explicitly.
- Missing `payment.failed`, `payment.refunded`, chargeback, partial refund, or
  refund-after-usage policies must appear as warnings or blockers.
- Duplicate webhook handling must be source-mapped where it exists.
- Missing billing source files should degrade into source-mapped issues when
  possible.
- The audit must not execute webhooks, call payment providers, read secrets, or
  connect to the database.

## CLI

Expected usage:

```bash
SITE=ai-remover node scripts/check-saas-product-contract.mjs
SITE=ai-remover pnpm contract:check
```

Expected human-readable output includes:

```text
SaaS Contract Audit

Site: ai-remover
Site section: resolved
Billing: creem
Pricing file: resolved
Plans: 3 resolved

Billing reversal:
  checkout.success: handled
  payment.success: handled
  payment.failed: unsupported
  payment.refunded: unsupported
  subscribe.updated: handled
  subscribe.canceled: handled
  subscription.renewed: handled (payment.success + SubscriptionCycleType.RENEWAL)
  subscription.expired: unsupported
  chargeback/dispute: unsupported
  partial refund: unsupported
  refund after usage consumed: unsupported
  manual compensation: partially_handled

Launch blockers:
  none
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
9. Billing reversal events are listed with status and source refs.
10. `payment.failed`, `payment.refunded`, chargeback, partial refund, refund
    after usage consumed, and manual compensation are not silently ignored.
11. No runtime route, webhook handler, database write path, billing flow, quota
    reservation path, or AI provider invocation path is modified.

## Verification Commands

Focused verification:

```bash
node --check scripts/check-saas-product-contract.mjs
node --test --import tsx scripts/check-saas-product-contract.test.ts
SITE=ai-remover node scripts/check-saas-product-contract.mjs
SITE=ai-remover pnpm contract:check
pnpm exec eslint scripts/check-saas-product-contract.mjs scripts/check-saas-product-contract.test.ts src/config/saas-product-contract/types.ts src/config/saas-product-contract/index.ts --report-unused-disable-directives
pnpm test src/config/product-modules/index.test.ts src/config/product-modules/doc-links.test.ts
```

Do not run `run-with-site` commands in parallel because they generate
`.generated/site.ts`.

## Deferred Work

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

## PR 2 Boundary

Files likely in scope:

```text
src/config/saas-product-contract/**
scripts/check-saas-product-contract.mjs
scripts/check-saas-product-contract.test.ts
docs/guides/saas-product-contract.md
docs/architecture/saas-platform-core-contract-implementation-plan.md
```

Files out of scope for behavior changes:

```text
src/app/api/**
src/domains/billing/application/**
src/domains/billing/infra/**
src/domains/billing/domain/**
src/domains/remover/**
src/infra/adapters/payment/**
src/infra/adapters/ai/**
src/config/db/**
```

These billing runtime files may be read for static source mapping, but PR 2 must
not change their behavior.
