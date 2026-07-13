# UI Scope Reference

Use this reference before changing landing pages, product UI, shared theme files, or route structure.

## Classify The UI Work

Use one scope label:

```text
no-ui-change
copy-only
config-only
shared-theme-change
site-product-ui
new-route-or-workflow
```

## Content-Only Changes

Use site inputs when changing:

- landing copy.
- FAQ.
- docs or blog content.
- logo, favicon, preview image.
- button text and links that already exist as content/config.

Prefer:

```text
sites/<site-key>/site.config.json
sites/<site-key>/content/**
locale messages or runtime settings when already used
```

## Shared Theme Changes

Change shared theme code only when the result should apply to every site using that theme.

Current landing path to inspect before editing:

```text
apps/web/src/routes/index.tsx
src/themes/default/layouts/landing-marketing.tsx
src/themes/default/pages/landing.tsx
src/themes/default/pages/landing-view.tsx
src/themes/default/blocks/**
```

Do not add `site.key` branches to shared landing code for one product. If one site needs a different product experience, create a clear product UI path.

## Site/Product UI

Write product UI when the site has a real workflow difference:

- generator, editor, dashboard, calculator, upload flow, or async task.
- different first-screen interaction.
- custom result, preview, or state model.
- new API route or domain use case.

Prefer focused paths such as:

```text
src/themes/default/pages/<product>-landing.tsx
src/domains/<feature>/ui/**
src/domains/<feature>/application/**
apps/web/src/routes/<feature>.tsx
apps/web/src/routes/$locale/<feature>.tsx
```

Keep route files thin. Avoid thin wrappers and speculative abstractions.

## Verification

For meaningful UI changes:

- run focused component/domain tests when present.
- run `SITE=<site-key> pnpm build` for build-time site correctness.
- use browser QA when layout, interactions, or responsive behavior changed.
- check mobile width around 390px when the first screen changed.
