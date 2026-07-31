# Product Profiles Reference

Profiles are a design aid, not configuration. The source of truth is
`site.config.json` v2, `deploy.settings.json` v2, and product runtime contracts.

## free-tool-no-db

Enable only the modules the public tool needs, commonly `analytics`, and use
`paymentProvider: "none"`. Omit State Worker, Hyperdrive, and R2 resources.
The build and runtime must work with empty database URLs.

## free-tool-with-storage

Like `free-tool-no-db`, with storage expressed by the `storage` module or the
product runtime contract. The derived Cloudflare contract then requires R2.

## ai-saas

Use existing auth, billing, settings, storage, analytics, and support modules.
Product-specific Workers AI belongs in the product runtime contract, not a
generic site module.

## paid-saas

Enable `billing` and select one non-`none` payment provider. Auth, database,
provider secrets, and any State Worker requirements are derived.

## internal-admin-tool

Enable `auth` before `admin_settings` and keep public routes minimal.

Do not add a `siteType`, compatibility map, or second list of required
bindings.
