import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { MergedI18nGlossary } from './site-i18n-glossary';
import type {
  SiteI18nManifest,
  SiteI18nManifestEntry,
  SiteI18nPages,
} from './site-i18n-pages';

export type SiteI18nIssue = {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  locale?: string;
  pageId?: string;
  pageType?: string;
  path?: string;
  term?: string;
};

export type SiteI18nReport = {
  siteKey: string;
  generatedAt: string;
  strict: boolean;
  rolloutRequired: boolean;
  defaultLocale: string;
  supportedLocales: string[];
  glossary: {
    preserveTerms: number;
    termRules: number;
    forbiddenGroups: number;
  };
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  issues: SiteI18nIssue[];
};

type SiteLike = {
  i18n: { defaultLocale: string; supportedLocales: string[] };
};

const rolloutRequiredI18nSites = new Set(['ai-remover', 'background-remover']);

export function isSiteI18nRolloutRequired(siteKey: string) {
  return rolloutRequiredI18nSites.has(siteKey);
}

export function resolveSiteI18nReportPath({
  rootDir = process.cwd(),
  siteKey,
}: {
  rootDir?: string;
  siteKey: string;
}) {
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
}: SiteI18nIssue): SiteI18nIssue {
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

function summarizeIssues(issues: SiteI18nIssue[]) {
  return {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.severity === 'info').length,
  };
}

function getTargetLocales(site: SiteLike) {
  return site.i18n.supportedLocales.filter(
    (locale) => locale !== site.i18n.defaultLocale
  );
}

function getManifestEntry(
  manifest: SiteI18nManifest,
  locale: string,
  pageId: string
) {
  return manifest.locales[locale]?.[pageId];
}

export function buildSiteI18nReport({
  siteKey,
  site,
  pages,
  manifest,
  glossary,
  contentIssues = [],
  strict = false,
  generatedAt = new Date().toISOString(),
}: {
  siteKey: string;
  site: SiteLike;
  pages: SiteI18nPages;
  manifest: SiteI18nManifest;
  glossary: MergedI18nGlossary;
  contentIssues?: SiteI18nIssue[];
  strict?: boolean;
  generatedAt?: string;
}): SiteI18nReport {
  const issues: SiteI18nIssue[] = [];
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
            severity: strict ? 'error' : 'warning',
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
    ) as Array<[string, SiteI18nManifestEntry]>) {
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

  issues.push(...contentIssues);

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

export function writeSiteI18nReport({
  rootDir = process.cwd(),
  report,
}: {
  rootDir?: string;
  report: SiteI18nReport;
}) {
  const reportPath = resolveSiteI18nReportPath({
    rootDir,
    siteKey: report.siteKey,
  });
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}
