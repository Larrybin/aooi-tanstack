import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { site } from '@/site';

import {
  buildAuthUiSettingsFromSite,
  buildBillingUiSettingsFromSite,
  buildPublicUiConfigFromSite,
  readBuildAuthUiSettings,
  readBuildBillingUiSettings,
  readBuildPricingDisplayConfig,
  readBuildPublicUiConfig,
} from './settings-build.query';

const rootDir = process.cwd();
const dbFreeForbiddenImportFragments = [
  'settings-store',
  'settings-runtime.query',
  'infra/adapters/db',
  '/config/db',
  'infra/runtime/env.server',
  'config/env-contract',
];
const publicStaticRuntimeReaderAllowlist = [
  {
    file: 'src/server/pricing/pricing-route-resolver.ts',
    allowedRuntimeReaders: {},
  },
  {
    file: 'src/server/landing/home-route-resolver.ts',
    allowedRuntimeReaders: {},
  },
  {
    file: 'src/server/landing/landing-shell-data.ts',
    allowedRuntimeReaders: {},
  },
  {
    file: 'src/server/landing/blog-index-route-resolver.ts',
    allowedRuntimeReaders: {},
  },
  {
    file: 'src/server/landing/blog-category-route-resolver.ts',
    allowedRuntimeReaders: {},
  },
  {
    file: 'src/server/landing/blog-post-route-resolver.ts',
    allowedRuntimeReaders: {
      readAdsRuntimeSettingsCached: 'blog post ad zones are runtime-configured',
    },
  },
  {
    file: 'src/server/landing/slug-route-resolver.ts',
    allowedRuntimeReaders: {},
  },
] as const;
const publicStaticRuntimeReaderNames = [
  'readPublicUiConfigCached',
  'readAuthUiRuntimeSettingsCached',
  'readBillingRuntimeSettingsCached',
  'readAdsRuntimeSettingsCached',
  'readSettingsCached',
  'readSettingsFresh',
] as const;
const publicStaticBannedRuntimeReaders = [
  'readAuthUiRuntimeSettingsCached',
  'readBillingRuntimeSettingsCached',
  'readSettingsCached',
  'readSettingsFresh',
] as const;

function readRepoFile(...segments: string[]): string {
  return fs.readFileSync(path.resolve(rootDir, ...segments), 'utf8');
}

function collectImportSpecifiers(content: string): string[] {
  const specifiers = new Set<string>();
  const fromImports = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
  const sideEffectImports = content.matchAll(/import\s+['"]([^'"]+)['"]/g);

  for (const match of fromImports) {
    specifiers.add(match[1] ?? '');
  }

  for (const match of sideEffectImports) {
    specifiers.add(match[1] ?? '');
  }

  return [...specifiers].filter(Boolean).sort();
}

function assertDbFreeSettingsFile(relativePath: string): void {
  const content = readRepoFile(...relativePath.split('/'));
  const imports = collectImportSpecifiers(content);

  for (const specifier of imports) {
    for (const forbidden of dbFreeForbiddenImportFragments) {
      assert.equal(
        specifier.includes(forbidden),
        false,
        `${specifier} must not be imported by ${relativePath}`
      );
    }

    assert.equal(
      specifier.endsWith('/db'),
      false,
      `${specifier} must not be imported by ${relativePath}`
    );
  }

  assert.equal(content.includes('DATABASE_URL'), false);
  assert.equal(content.includes('readSettingsCached'), false);
  assert.equal(content.includes('readSettingsFresh'), false);
}

test('settings-build query keeps a DB-free import boundary', () => {
  assertDbFreeSettingsFile(
    'src/domains/settings/application/settings-build.query.ts'
  );
});

test('settings runtime contracts stay DB-free for build-safe imports', () => {
  assertDbFreeSettingsFile(
    'src/domains/settings/application/settings-runtime.contracts.ts'
  );
});

test('pricing route resolver no longer imports runtime settings readers', () => {
  const content = readRepoFile(
    ...'src/server/pricing/pricing-route-resolver.ts'.split('/')
  );

  assert.equal(content.includes('settings-runtime.query'), false);
  assert.equal(content.includes('readPublicUiConfigCached'), false);
  assert.equal(content.includes('readAuthUiRuntimeSettingsCached'), false);
  assert.equal(content.includes('readBillingRuntimeSettingsCached'), false);
  assert.equal(content.includes('readSettingsCached'), false);
});

test('public landing route resolvers use build-safe shell data', () => {
  const files = [
    'src/server/landing/home-route-resolver.ts',
    'src/server/landing/blog-index-route-resolver.ts',
    'src/server/landing/blog-category-route-resolver.ts',
    'src/server/landing/blog-post-route-resolver.ts',
    'src/server/landing/slug-route-resolver.ts',
  ];

  for (const file of files) {
    const content = readRepoFile(...file.split('/'));
    const allowsRuntimeSettings =
      file === 'src/server/landing/blog-post-route-resolver.ts';

    assert.equal(
      content.includes('settings-runtime.query'),
      allowsRuntimeSettings,
      file
    );
    assert.equal(content.includes('readPublicUiConfigCached'), false, file);
    assert.equal(
      content.includes('readAuthUiRuntimeSettingsCached'),
      false,
      file
    );
    assert.equal(
      content.includes('readBillingRuntimeSettingsCached'),
      false,
      file
    );
    assert.equal(content.includes('readSettingsCached'), false, file);
  }

  const homeResolver = readRepoFile(
    ...'src/server/landing/home-route-resolver.ts'.split('/')
  );
  assert.equal(homeResolver.includes('readBuildPublicUiConfig'), true);
  assert.equal(homeResolver.includes('readBuildAuthUiSettings'), true);
  assert.equal(homeResolver.includes('readBuildBillingUiSettings'), true);

  const shellData = readRepoFile(
    ...'src/server/landing/landing-shell-data.ts'.split('/')
  );
  assert.equal(shellData.includes('filterLandingNavItems'), true);
  assert.equal(shellData.includes('buildPublicUiConfig()'), true);
  assert.equal(shellData.includes('buildAuthSettings()'), true);
  assert.equal(shellData.includes('buildBillingSettings()'), true);
});

test('landing visibility keeps build-safe AI availability gate', () => {
  const content = readRepoFile(
    ...'src/surfaces/public/navigation/landing-visibility.ts'.split('/')
  );

  assert.equal(content.includes('settings-runtime.query'), false);
  assert.equal(content.includes('readPublicUiConfigCached'), false);
  assert.equal(content.includes('isAiEnabled(publicConfig)'), true);
  assert.equal(content.includes('readAuthUiRuntimeSettingsCached'), false);
  assert.equal(content.includes('readBillingRuntimeSettingsCached'), false);
  assert.equal(content.includes('readSettingsCached'), false);
});

test('public static build surfaces keep runtime reader imports explicitly allowlisted', () => {
  for (const surface of publicStaticRuntimeReaderAllowlist) {
    const content = readRepoFile(...surface.file.split('/'));
    const allowedRuntimeReaders = surface.allowedRuntimeReaders as Record<
      string,
      string
    >;

    for (const reason of Object.values(allowedRuntimeReaders)) {
      assert.notEqual(reason.trim(), '', surface.file);
    }

    for (const reader of publicStaticRuntimeReaderNames) {
      assert.equal(
        content.includes(reader),
        Object.hasOwn(allowedRuntimeReaders, reader),
        `${surface.file} must update the explicit public/static runtime-reader allowlist for ${reader}`
      );
    }

    assert.equal(
      content.includes('settings-runtime.query'),
      Object.keys(allowedRuntimeReaders).length > 0,
      `${surface.file} must not import settings-runtime.query without an explicit runtime-reader exception`
    );

    for (const reader of publicStaticBannedRuntimeReaders) {
      assert.equal(
        content.includes(reader),
        false,
        `${surface.file} must not import ${reader}`
      );
    }
  }
});

test('build auth settings are conservative and do not synthesize Google client ids', () => {
  const settings = buildAuthUiSettingsFromSite({
    capabilities: {
      auth: true,
      ai: true,
      payment: 'creem',
      docs: false,
      blog: false,
    },
  });

  assert.equal(settings.emailAuthEnabled, false);
  assert.equal(settings.googleAuthEnabled, false);
  assert.equal(settings.googleOneTapEnabled, false);
  assert.equal(settings.googleClientId, '');
  assert.equal(settings.githubAuthEnabled, false);
  assert.equal(readBuildAuthUiSettings().emailAuthEnabled, false);
  assert.equal(readBuildAuthUiSettings().googleClientId, '');
});

test('pricing checkout auth fallback uses the full sign-in page', () => {
  const content = readRepoFile(
    'src',
    'domains',
    'pricing',
    'ui',
    'pricing-slice-view.tsx'
  );

  assert.equal(content.includes('usePublicAppContext'), false);
  assert.equal(content.includes('setIsShowSignModal'), false);
  assert.equal(content.includes('buildPricingSignInUrl'), true);
  assert.equal(content.includes("withCallbackUrl('/sign-in'"), true);
  assert.equal(content.includes('resolvePricingCheckoutReadiness'), true);
  assert.equal(content.includes('window.location.assign'), true);
});

test('auth route view uses full auth pages instead of inline sign modal', () => {
  const content = readRepoFile(
    'src',
    'surfaces',
    'auth',
    'auth-route',
    'auth-route.view.tsx'
  );

  assert.equal(content.includes('SignInForm'), true);
  assert.equal(content.includes('SignUpForm'), true);
  assert.equal(content.includes('SignModal'), false);
  assert.equal(content.includes('setIsShowSignModal'), false);
});

test('build billing settings do not evaluate secrets or provider product mapping readiness', () => {
  const settings = buildBillingUiSettingsFromSite({
    capabilities: {
      auth: true,
      ai: true,
      payment: 'creem',
      docs: false,
      blog: false,
    },
  });

  assert.deepEqual(settings, {
    locale: '',
    defaultLocale: 'en',
    provider: 'creem',
    paymentCapability: 'creem',
    creemEnvironment: 'sandbox',
    creemProductIds: '',
  });
  assert.equal('status' in settings, false);
  assert.equal('missing' in settings, false);
  assert.equal('requiredSecrets' in settings, false);
});

test('build public UI settings come from source-controlled site capabilities', () => {
  const settings = readBuildPublicUiConfig();

  assert.equal(settings.aiEnabled, Boolean(site.capabilities.ai));
  assert.equal(settings.localeSwitcherEnabled, false);
  assert.equal(settings.socialLinksEnabled, false);
  assert.equal(settings.socialLinksJson, '');
  assert.deepEqual(settings.socialLinks, []);
});

test('build public UI settings preserve AI capability visibility semantics', () => {
  assert.equal(
    buildPublicUiConfigFromSite({
      capabilities: {
        auth: false,
        ai: true,
        payment: 'none',
        docs: false,
        blog: false,
      },
    }).aiEnabled,
    true
  );
  assert.equal(
    buildPublicUiConfigFromSite({
      capabilities: {
        auth: false,
        ai: false,
        payment: 'none',
        docs: false,
        blog: false,
      },
    }).aiEnabled,
    false
  );
});

test('pricing display config is read from the selected site pricing config', () => {
  const pricing = readBuildPricingDisplayConfig();
  const sourcePricing = JSON.parse(
    readRepoFile('sites', site.key, 'pricing.json')
  );

  assert.deepEqual(pricing, sourcePricing);
  assert.equal(
    pricing?.pricing?.items?.[0]?.product_id,
    sourcePricing.pricing.items[0].product_id
  );
});

test('current build billing reader follows source-controlled site capability only', () => {
  const settings = readBuildBillingUiSettings();

  assert.equal(settings.paymentCapability, site.capabilities.payment);
  assert.equal(settings.provider, site.capabilities.payment);
});
