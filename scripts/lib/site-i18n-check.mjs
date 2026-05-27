import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const legacyOptionalI18nSites = new Set(['dev-local', 'mamamiya']);

export function isSiteI18nRolloutRequired(siteKey) {
  return !legacyOptionalI18nSites.has(siteKey);
}

export function resolveSiteI18nReportPath({
  rootDir = process.cwd(),
  siteKey,
} = {}) {
  return path.resolve(rootDir, '.reports', 'i18n', siteKey, 'latest.json');
}

function createIssue({
  severity,
  code,
  message,
  locale,
  pageId,
  pageType,
  path: pagePath,
}) {
  return {
    severity,
    code,
    message,
    ...(locale ? { locale } : {}),
    ...(pageId ? { pageId } : {}),
    ...(pageType ? { pageType } : {}),
    ...(pagePath ? { path: pagePath } : {}),
  };
}

function summarizeIssues(issues) {
  return {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.severity === 'info').length,
  };
}

function getTargetLocales(site) {
  return site.i18n.supportedLocales.filter(
    (locale) => locale !== site.i18n.defaultLocale
  );
}

function getManifestEntry(manifest, locale, pageId) {
  return manifest.locales[locale]?.[pageId];
}

export function buildSiteI18nReport({
  siteKey,
  site,
  pages,
  manifest,
  glossary,
  strict = false,
  generatedAt = new Date().toISOString(),
}) {
  const issues = [];
  const targetLocales = getTargetLocales(site);
  const rolloutRequired = isSiteI18nRolloutRequired(siteKey);

  if (rolloutRequired && targetLocales.length === 0) {
    issues.push(
      createIssue({
        severity: 'error',
        code: 'i18n_rollout_site_missing_target_locale',
        message:
          'i18n rollout sites must declare at least one non-default supported locale',
      })
    );
  }

  for (const locale of targetLocales) {
    for (const page of pages.pages) {
      if (!page.required || !rolloutRequired) {
        continue;
      }

      const entry = getManifestEntry(manifest, locale, page.pageId);
      if (!entry) {
        issues.push(
          createIssue({
            severity: 'warning',
            code: 'i18n_required_page_not_approved',
            message: 'required page is not approved for this locale yet',
            locale,
            pageId: page.pageId,
            pageType: page.type,
            path: page.path,
          })
        );
      }
    }

    for (const [pageId, entry] of Object.entries(
      manifest.locales[locale] ?? {}
    )) {
      if (entry.status === 'approved') {
        continue;
      }

      issues.push(
        createIssue({
          severity: rolloutRequired && strict ? 'error' : 'warning',
          code: 'i18n_manifest_entry_not_approved',
          message: `manifest entry is ${entry.status}, not approved`,
          locale,
          pageId,
          path: entry.path,
        })
      );
    }
  }

  return {
    siteKey,
    generatedAt,
    strict,
    rolloutRequired,
    defaultLocale: site.i18n.defaultLocale,
    supportedLocales: site.i18n.supportedLocales,
    glossary: {
      preserveTerms: glossary.preserve.length,
      termRules: Object.keys(glossary.terms).length,
      forbiddenGroups: Object.keys(glossary.forbidden).length,
    },
    summary: summarizeIssues(issues),
    issues,
  };
}

export function writeSiteI18nReport({ rootDir = process.cwd(), report }) {
  const reportPath = resolveSiteI18nReportPath({
    rootDir,
    siteKey: report.siteKey,
  });
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}
