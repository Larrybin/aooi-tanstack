import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildLocalizedContentIssues } from '../../scripts/lib/site-i18n-content-assets.mjs';

const site = {
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'zh'],
  },
};

const glossary = {
  preserve: ['AI', 'PNG'],
  terms: {},
  forbidden: {
    allLocales: ['free forever'],
  },
};

function writeJson(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test('localized content issues include English residuals from site JSON assets', () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'aooi-i18n-assets-'));
  try {
    writeJson(path.join(rootDir, 'sites/example/content/home.zh.json'), {
      hero: {
        title: '快速 Remove background',
        cta: '生成 PNG',
      },
    });

    const issues = buildLocalizedContentIssues({
      rootDir,
      siteKey: 'example',
      site,
      pages: {
        pages: [
          {
            pageId: 'home',
            path: '/',
            type: 'seo',
            indexable: true,
            required: true,
            source: {
              kind: 'app-route',
              path: 'apps/web/src/routes/index.tsx',
            },
            hashScope: 'seo',
          },
        ],
      },
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
    });

    assert.equal(issues[0]?.code, 'i18n_english_residual');
    assert.equal(issues[0]?.pageId, 'home');
    assert.equal(issues[0]?.path, '/');
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('localized content issues skip pages absent from manifest', () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'aooi-i18n-assets-'));
  try {
    const issues = buildLocalizedContentIssues({
      rootDir,
      siteKey: 'example',
      site,
      pages: {
        pages: [
          {
            pageId: 'home',
            path: '/',
            type: 'seo',
            indexable: true,
            required: true,
            source: {
              kind: 'app-route',
              path: 'apps/web/src/routes/index.tsx',
            },
            hashScope: 'seo',
          },
        ],
      },
      manifest: {
        locales: {
          zh: {},
        },
      },
      glossary,
    });

    assert.deepEqual(issues, []);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('localized content issues ignore non-visible JSON config strings', () => {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'aooi-i18n-assets-'));
  try {
    writeJson(path.join(rootDir, 'sites/example/pricing.zh.json'), {
      pricing: {
        id: 'pricing',
        title: '价格',
        items: [
          {
            title: '专业版',
            interval: 'month',
            product_id: 'pro-monthly',
            button: {
              title: '升级',
              url: '/zh/pricing',
              icon: 'RiFlashlightFill',
            },
          },
        ],
      },
    });

    const issues = buildLocalizedContentIssues({
      rootDir,
      siteKey: 'example',
      site,
      pages: {
        pages: [
          {
            pageId: 'pricing',
            path: '/pricing',
            type: 'seo',
            indexable: true,
            required: true,
            source: {
              kind: 'app-route',
              path: 'apps/web/src/routes/pricing.tsx',
            },
            hashScope: 'seo',
          },
        ],
      },
      manifest: {
        locales: {
          zh: {
            pricing: {
              path: '/pricing',
              status: 'pending',
              sourceHash: 'source',
              targetHash: 'target',
            },
          },
        },
      },
      glossary,
    });

    assert.deepEqual(issues, []);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
