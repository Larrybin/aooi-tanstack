# 401k Calculator recovery evidence

Recovery date: 2026-07-31  
Observed production domain: `https://401k-calculator.net`

This archive preserves sanitized evidence used to rebuild the public calculator
as the aooi site instance at `sites/401k-calculator`.

## Recovered public behavior

- The public HTML, CSS, JavaScript, `robots.txt`, and `sitemap.xml` were
  downloaded and hashed.
- The calculator defaults, validation behavior, annual calculation order,
  employer-match formula, salary growth, investment growth, four-percent
  monthly-income illustration, reset behavior, and live input updates were
  verified.
- The observed deployment used a homepage fallback for unknown and legal-like
  paths. The rebuilt aooi site intentionally replaces that behavior with real
  legal pages and true not-found responses.
- No source maps or original repository history were available from public
  assets.

## Cloudflare recovery boundary

Read-only checks against the supplied Cloudflare account succeeded, but no
matching Worker, custom domain, or Zone resource was present. A similarly named
Pages project on a different domain was rejected because its public HTML did not
match the production `.net` site.

No Cloudflare deployment, route, domain, binding, storage resource, or setting
was modified during recovery.

Account identity, account IDs, token responses, raw API payloads, and local
Wrangler runtime artifacts are deliberately excluded from this archive.

## Evidence

- `browser-validation.json`: desktop and mobile behavior checks.
- `calculator-source-reference.md`: recovered formula and calculation order.
- `public-file-inventory.json`: public file and fallback inventory.
- `public-file-sha256.txt`: SHA-256 hashes of recovered public files.
- `source-map-search.txt`: source-map search result.
- `local-desktop.png` and `local-mobile.png`: local recovered-site reference
  screenshots.
