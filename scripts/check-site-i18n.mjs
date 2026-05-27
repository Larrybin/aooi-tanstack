import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
  buildSiteI18nReport,
  writeSiteI18nReport,
} from './lib/site-i18n-check.mjs';
import { readMergedI18nGlossary } from './lib/site-i18n-glossary.mjs';
import { readSiteI18nPackage } from './lib/site-i18n-pages.mjs';

const rootDir = process.cwd();

function parseArgs(args) {
  const siteEqualsArg = args.find((arg) => arg.startsWith('--site='));
  const siteArgIndex = args.indexOf('--site');

  return {
    siteKey:
      siteEqualsArg?.slice('--site='.length).trim() ||
      (siteArgIndex >= 0 ? args[siteArgIndex + 1]?.trim() : '') ||
      '',
    strict: args.includes('--strict'),
  };
}

function listSiteKeys() {
  const sitesDir = path.resolve(rootDir, 'sites');
  return readdirSync(sitesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((siteKey) =>
      existsSync(path.resolve(sitesDir, siteKey, 'site.config.json'))
    )
    .sort();
}

function printReport(report, reportPath) {
  const summary = `${report.summary.errors} error(s), ${report.summary.warnings} warning(s), ${report.summary.info} info`;
  console.log(`[i18n:check] ${report.siteKey}: ${summary}`);

  for (const issue of report.issues) {
    const scope = [issue.locale, issue.pageId, issue.path]
      .filter(Boolean)
      .join(' ');
    console.log(
      `[i18n:check] ${issue.severity} ${issue.code}${scope ? ` ${scope}` : ''}: ${issue.message}`
    );
  }

  console.log(`[i18n:check] report: ${path.relative(rootDir, reportPath)}`);
}

function buildErrorReport({ siteKey, strict, error }) {
  return {
    siteKey,
    generatedAt: new Date().toISOString(),
    strict,
    rolloutRequired: true,
    defaultLocale: '',
    supportedLocales: [],
    glossary: {
      preserveTerms: 0,
      termRules: 0,
      forbiddenGroups: 0,
    },
    summary: {
      errors: 1,
      warnings: 0,
      info: 0,
    },
    issues: [
      {
        severity: 'error',
        code: 'i18n_check_failed',
        message: error instanceof Error ? error.message : String(error),
      },
    ],
  };
}

function checkSite({ siteKey, strict }) {
  try {
    const { site, pages, manifest } = readSiteI18nPackage({
      rootDir,
      siteKey,
    });
    const glossary = readMergedI18nGlossary({ rootDir, siteKey });
    return buildSiteI18nReport({
      siteKey,
      site,
      pages,
      manifest,
      glossary,
      strict,
    });
  } catch (error) {
    return buildErrorReport({ siteKey, strict, error });
  }
}

const { siteKey, strict } = parseArgs(process.argv.slice(2));
const siteKeys = siteKey ? [siteKey] : listSiteKeys();
const reports = siteKeys.map((currentSiteKey) =>
  checkSite({ siteKey: currentSiteKey, strict })
);

for (const report of reports) {
  const reportPath = writeSiteI18nReport({ rootDir, report });
  printReport(report, reportPath);
}

if (strict && reports.some((report) => report.summary.errors > 0)) {
  process.exit(1);
}
