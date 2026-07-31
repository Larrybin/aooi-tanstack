# Docs + Blog Modules

## What These Modules Do

Docs and Blog are optional content modules:

- docs site routes under `/docs`
- blog/post routes under `/blog`
- local content pipeline and search/indexing glue

## Required Configuration

- `sites/<site>/site.config.json` → `capabilities.enabledModules` entry `docs`
- `sites/<site>/site.config.json` → `capabilities.enabledModules` entry `blog`

## External Services

- none required by default

## Minimum Verification Commands

- `pnpm test`
- `SITE=<site-key> pnpm site:gate -- --cloudflare`

## Common Failure Modes

- The site capability says docs/blog should exist, but route gating still reads runtime settings.
- Navigation, sitemap, and route layout use different sources of truth for docs/blog visibility.
- A site capability change is made for one site, but the corresponding smoke/deploy path is not revalidated.

## Product Impact If Disabled

The template keeps the sellable shell, but docs/blog routes should disappear cleanly from public navigation.
