import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

test('site i18n report treats missing rollout pages as warnings outside strict mode', () => {
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
    strict: false,
    generatedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.warnings, 1);
  assert.equal(report.issues[0]?.code, 'i18n_required_page_not_approved');
});

test('site i18n report fails strict checks for missing rollout pages', () => {
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

  assert.equal(report.summary.errors, 1);
  assert.equal(report.summary.warnings, 0);
  assert.equal(report.issues[0]?.code, 'i18n_required_page_not_approved');
});

test('site i18n report does not force optional sites to complete rollout', () => {
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

test('site i18n report requires explicit rollout site enrollment', () => {
  const report = buildSiteI18nReport({
    siteKey: 'example-production-site',
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

  assert.equal(report.rolloutRequired, false);
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
      siteKey: 'ai-remover',
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
      resolveSiteI18nReportPath({ rootDir, siteKey: 'ai-remover' })
    );

    const savedReport = JSON.parse(readFileSync(reportPath, 'utf8'));
    assert.equal(savedReport.siteKey, 'ai-remover');
    assert.equal(savedReport.summary.warnings, 1);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('site i18n CLI exits non-zero for strict report errors', () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'aooi-i18n-cli-'));
  const repoRoot = path.resolve(import.meta.dirname, '..', '..');

  try {
    mkdirSync(path.join(rootDir, 'sites', 'ai-remover', 'i18n'), {
      recursive: true,
    });
    mkdirSync(path.join(rootDir, 'src', 'config', 'locale'), {
      recursive: true,
    });

    writeFileSync(
      path.join(rootDir, 'src', 'config', 'locale', 'glossary.global.json'),
      `${JSON.stringify({ preserve: [] }, null, 2)}\n`
    );
    writeFileSync(
      path.join(rootDir, 'sites', 'ai-remover', 'site.config.json'),
      `${JSON.stringify(
        {
          key: 'ai-remover',
          domain: 'example.com',
          brand: {
            appName: 'AI Remover',
            appUrl: 'https://example.com',
            supportEmail: 'support@example.com',
            logo: '/logo.png',
            favicon: '/favicon.ico',
            previewImage: '/preview.png',
          },
          capabilities: {
            enabledModules: ['auth', 'ai'],
            paymentProvider: 'none',
          },
          i18n: {
            defaultLocale: 'en',
            supportedLocales: ['en', 'zh'],
            localePrefix: 'as-needed',
            localeDetection: false,
            strictPublishing: true,
          },
          configVersion: 2,
        },
        null,
        2
      )}\n`
    );
    writeFileSync(
      path.join(rootDir, 'sites', 'ai-remover', 'i18n', 'pages.json'),
      `${JSON.stringify(pages, null, 2)}\n`
    );
    writeFileSync(
      path.join(rootDir, 'sites', 'ai-remover', 'i18n', 'manifest.json'),
      `${JSON.stringify({ locales: { zh: {} } }, null, 2)}\n`
    );
    writeFileSync(
      path.join(rootDir, 'sites', 'ai-remover', 'i18n', 'glossary.json'),
      `${JSON.stringify({ preserve: [], terms: {}, forbidden: {} }, null, 2)}\n`
    );

    const result = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, 'scripts', 'check-site-i18n.mjs'),
        '--site',
        'ai-remover',
        '--strict',
      ],
      {
        cwd: rootDir,
        encoding: 'utf8',
      }
    );

    assert.equal(result.status, 1);
    assert.match(result.stdout, /i18n_required_page_not_approved/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
