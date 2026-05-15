import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  readCurrentSitePricing,
  validateSitePricing,
} from '../scripts/lib/site-pricing.mjs';

const execFileAsync = promisify(execFile);
const generatedSiteModulePath = path.resolve(
  process.cwd(),
  '.generated/site.ts'
);

async function generateSiteModule(siteKey: string) {
  await execFileAsync(process.execPath, ['scripts/generate-site-module.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SITE: siteKey,
    },
  });
}

async function importGeneratedSite(siteKey: string) {
  await generateSiteModule(siteKey);
  const source = await readFile(generatedSiteModulePath, 'utf8');
  const siteLiteral = source.match(
    /export const site = ([\s\S]+?) as const;\s+export const sitePricing =/
  );
  assert.ok(
    siteLiteral?.[1],
    'generated site module must export a site literal'
  );

  return Function(`return (${siteLiteral[1]});`)() as {
    key: string;
    domain: string;
    brand: {
      appName: string;
      appUrl: string;
      logo: string;
      favicon: string;
      previewImage: string;
    };
    configVersion: number;
  };
}

async function importGeneratedSitePricing(siteKey: string) {
  await generateSiteModule(siteKey);
  const source = await readFile(generatedSiteModulePath, 'utf8');
  const pricingLiteral = source.match(
    /export const sitePricing = ([\s\S]+?) as const;\s*$/
  );
  assert.ok(
    pricingLiteral?.[1],
    'generated site module must export a sitePricing literal'
  );

  return Function(`return (${pricingLiteral[1]});`)() as {
    pricing: {
      items: Array<{
        product_id: string;
        checkout_enabled?: boolean;
      }>;
    };
  };
}

async function readSitePricingFile(siteKey: string) {
  const source = await readFile(
    path.resolve(process.cwd(), 'sites', siteKey, 'pricing.json'),
    'utf8'
  );
  return JSON.parse(source) as {
    faq?: unknown;
    testimonials?: unknown;
    pricing: {
      groups?: Array<{ name?: string }>;
      items: Array<{ product_id: string }>;
    };
  };
}

async function readLegacyEnglishPricingMessages() {
  const source = await readFile(
    path.resolve(
      process.cwd(),
      'src/config/locale/messages/en/pricing.json'
    ),
    'utf8'
  );
  return JSON.parse(source) as {
    pricing: {
      groups?: Array<{ name?: string }>;
      items: Array<{ product_id: string }>;
    };
  };
}

async function readLegacyEnglishLandingMessages() {
  const source = await readFile(
    path.resolve(
      process.cwd(),
      'src/config/locale/messages/en/landing.json'
    ),
    'utf8'
  );
  return JSON.parse(source) as {
    faq?: unknown;
    testimonials?: unknown;
  };
}

test('@/site: exposes complete build-time site identity', async () => {
  const site = await importGeneratedSite('dev-local');

  assert.equal(site.key, 'dev-local');
  assert.equal(site.domain, 'localhost');
  assert.equal(site.brand.appUrl, 'http://localhost:3000');
  assert.equal(typeof site.brand.appName, 'string');
  assert.equal(typeof site.brand.logo, 'string');
  assert.equal(typeof site.brand.favicon, 'string');
  assert.equal(typeof site.brand.previewImage, 'string');
  assert.equal(site.configVersion, 1);
});

test('@/site: SITE=mamamiya resolves production identity when explicitly selected', async () => {
  const site = await importGeneratedSite('mamamiya');

  assert.equal(site.key, 'mamamiya');
  assert.equal(site.domain, 'mamamiya.pdfreprinting.net');
  assert.equal(site.brand.appUrl, 'https://mamamiya.pdfreprinting.net');
});

test('@/site: generated module is a pure literal module', async () => {
  await generateSiteModule('dev-local');
  const source = await readFile(generatedSiteModulePath, 'utf8');

  assert.equal(source.includes('import '), false);
  assert.equal(source.includes('export {'), false);
  assert.equal(source.includes('export const site = {'), true);
  assert.equal(source.includes('export const sitePricing = {'), true);
});

test('@/site: SITE=ai-remover exports site-scoped pricing', async () => {
  const sitePricing = await importGeneratedSitePricing('ai-remover');

  assert.deepEqual(
    sitePricing.pricing.items.map((item) => item.product_id),
    ['free', 'pro-monthly', 'studio-monthly']
  );
  assert.equal(sitePricing.pricing.items[0].checkout_enabled, false);
});

test('existing sites keep the full legacy pricing catalog after migration', async () => {
  const legacyEnglishPricingMessages = await readLegacyEnglishPricingMessages();
  const legacyEnglishLandingMessages = await readLegacyEnglishLandingMessages();
  const legacyPricing = legacyEnglishPricingMessages.pricing;
  const expectedGroups = legacyPricing.groups?.map((group) => group.name);
  const expectedProductIds = legacyPricing.items.map((item) => item.product_id);

  for (const siteKey of ['dev-local', 'mamamiya']) {
    const sitePricing = await readSitePricingFile(siteKey);

    assert.deepEqual(
      sitePricing.pricing.groups?.map((group) => group.name),
      expectedGroups
    );
    assert.deepEqual(
      sitePricing.pricing.items.map((item) => item.product_id),
      expectedProductIds
    );
    assert.deepEqual(sitePricing.faq, legacyEnglishLandingMessages.faq);
    assert.deepEqual(
      sitePricing.testimonials,
      legacyEnglishLandingMessages.testimonials
    );
  }
});

test('site pricing validation rejects a free checkout item', () => {
  assert.throws(
    () =>
      validateSitePricing(
        {
          pricing: {
            items: [
              {
                product_id: 'free',
                interval: 'month',
                amount: 0,
                currency: 'USD',
              },
            ],
          },
        },
        { siteKey: 'broken' }
      ),
    /free pricing item "free" must set checkout_enabled to false/
  );
});

test('site pricing loader rejects missing pricing when payment is enabled', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'aooi-site-pricing-'));
  await mkdir(path.join(rootDir, 'sites', 'paid-site'), { recursive: true });
  await writeFile(
    path.join(rootDir, 'sites', 'paid-site', 'site.config.json'),
    '{}',
    'utf8'
  );

  assert.throws(
    () =>
      readCurrentSitePricing({
        rootDir,
        siteKey: 'paid-site',
        site: {
          key: 'paid-site',
          capabilities: {
            payment: 'creem',
          },
        },
      }),
    /requires sites\/paid-site\/pricing\.json because payment is enabled/
  );
});
