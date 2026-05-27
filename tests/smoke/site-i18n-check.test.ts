import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildSiteI18nReport,
  resolveSiteI18nReportPath,
  writeSiteI18nReport,
} from '../../scripts/lib/site-i18n-check.mjs';

const site = {
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'zh'],
  },
};

const pages = {
  pages: [
    {
      pageId: 'home',
      path: '/',
      type: 'seo',
      indexable: true,
      required: true,
      source: {
        kind: 'site-content',
        path: 'content/locales/en/home.mdx',
      },
      hashScope: 'seo',
    },
  ],
};

const glossary = {
  preserve: ['AI'],
  terms: {},
  forbidden: {},
};

test('site i18n report treats missing rollout pages as warnings', () => {
  const report = buildSiteI18nReport({
    siteKey: 'ai-remover',
    site,
    pages,
    manifest: {
      locales: {
        zh: {},
      },
    },
    glossary,
    strict: true,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.warnings, 1);
  assert.equal(report.issues[0]?.code, 'i18n_required_page_not_approved');
});

test('site i18n report does not force legacy sites to complete rollout', () => {
  const report = buildSiteI18nReport({
    siteKey: 'mamamiya',
    site,
    pages,
    manifest: {
      locales: {
        zh: {},
      },
    },
    glossary,
    strict: true,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.warnings, 0);
});

test('site i18n report requires target locales for rollout sites', () => {
  const report = buildSiteI18nReport({
    siteKey: 'background-remover',
    site: {
      i18n: {
        defaultLocale: 'en',
        supportedLocales: ['en'],
      },
    },
    pages,
    manifest: {
      locales: {},
    },
    glossary,
    strict: true,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(report.summary.errors, 1);
  assert.equal(
    report.issues[0]?.code,
    'i18n_rollout_site_missing_target_locale'
  );
});

test('site i18n report fails strict checks for declared unapproved entries', () => {
  const report = buildSiteI18nReport({
    siteKey: 'background-remover',
    site,
    pages,
    manifest: {
      locales: {
        zh: {
          home: {
            path: '/',
            status: 'pending',
            sourceHash: 'source',
            targetHash: 'target',
          },
        },
      },
    },
    glossary,
    strict: true,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(report.summary.errors, 1);
  assert.equal(report.summary.warnings, 0);
  assert.equal(report.issues[0]?.code, 'i18n_manifest_entry_not_approved');
});

test('site i18n report writes latest JSON artifact', () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'aooi-i18n-check-'));
  try {
    const report = buildSiteI18nReport({
      siteKey: 'example',
      site,
      pages,
      manifest: {
        locales: {
          zh: {},
        },
      },
      glossary,
      strict: false,
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    const reportPath = writeSiteI18nReport({ rootDir, report });
    assert.equal(
      reportPath,
      resolveSiteI18nReportPath({ rootDir, siteKey: 'example' })
    );

    const savedReport = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(savedReport.siteKey, 'example');
    assert.equal(savedReport.summary.warnings, 1);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
