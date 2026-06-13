import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCanonicalUrl } from '@/shared/seo/canonical';

import { loadAuthRouteMessages } from './auth-route-messages';
import { resolveAuthRouteData } from './auth-route-resolver';

test('resolveAuthRouteData returns default sign-in data', async () => {
  const data = await resolveAuthRouteData({
    locale: 'en',
    mode: 'sign-in',
  });

  assert.ok(data);
  assert.equal(data.mode, 'sign-in');
  assert.equal(data.locale, 'en');
  assert.equal(data.canonicalPath, '/sign-in');
  assert.equal(data.copy.sign.sign_in_title, 'Sign In');
  assert.equal(data.search.callbackUrl, undefined);
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/sign-in'),
    }
  );
});

test('resolveAuthRouteData returns sign-up settings payloads', async () => {
  const data = await resolveAuthRouteData({
    locale: 'en',
    mode: 'sign-up',
  });

  assert.ok(data);
  assert.equal(typeof data.authSettings.emailAuthEnabled, 'boolean');
  assert.equal(typeof data.publicUiConfig.localeSwitcherEnabled, 'boolean');
  assert.equal(data.copy.sign.sign_up_title, 'Sign Up');
});

test('resolveAuthRouteData returns forgot-password reset base data', async () => {
  const data = await resolveAuthRouteData({
    locale: 'zh',
    mode: 'forgot-password',
  });

  assert.ok(data);
  assert.equal(data.mode, 'forgot-password');
  assert.equal(
    data.resetPasswordBaseUrl,
    buildCanonicalUrl('/reset-password', 'zh')
  );
});

test('resolveAuthRouteData preserves reset token and error search params', async () => {
  const data = await resolveAuthRouteData({
    locale: 'en',
    mode: 'reset-password',
    search: {
      token: 'reset-token',
      error: 'INVALID_TOKEN',
    },
  });

  assert.ok(data);
  assert.equal(data.search.token, 'reset-token');
  assert.equal(data.search.error, 'INVALID_TOKEN');
});

test('resolveAuthRouteData normalizes callbackUrl', async () => {
  const data = await resolveAuthRouteData({
    locale: 'zh',
    mode: 'sign-in',
    search: {
      callbackUrl: '/zh/pricing?plan=pro#checkout',
    },
  });

  assert.ok(data);
  assert.equal(data.search.callbackUrl, '/pricing?plan=pro#checkout');
});

test('resolveAuthRouteData preserves callbackUrl in locale options', async () => {
  const data = await resolveAuthRouteData({
    locale: 'en',
    mode: 'sign-in',
    search: {
      callbackUrl: '/pricing?plan=pro#checkout',
    },
  });

  assert.ok(data);
  const zhOption = data.shell.localeOptions.find(
    (option) => option.locale === 'zh'
  );
  assert.ok(zhOption);
  assert.equal(zhOption.href.startsWith('/zh/sign-in?'), true);
  assert.equal(
    new URL(zhOption.href, 'https://example.test').searchParams.get(
      'callbackUrl'
    ),
    '/pricing?plan=pro#checkout'
  );
});

test('resolveAuthRouteData preserves reset search params in locale options', async () => {
  const data = await resolveAuthRouteData({
    locale: 'en',
    mode: 'reset-password',
    search: {
      token: 'reset-token',
      error: 'INVALID_TOKEN',
    },
  });

  assert.ok(data);
  const zhOption = data.shell.localeOptions.find(
    (option) => option.locale === 'zh'
  );
  assert.ok(zhOption);
  assert.equal(zhOption.href.startsWith('/zh/reset-password?'), true);

  const params = new URL(zhOption.href, 'https://example.test').searchParams;
  assert.equal(params.get('token'), 'reset-token');
  assert.equal(params.get('error'), 'INVALID_TOKEN');
});

test('resolveAuthRouteData rejects unsupported locales', async () => {
  const data = await resolveAuthRouteData({
    locale: 'fr',
    mode: 'sign-in',
  });

  assert.equal(data, null);
});

test('resolveAuthRouteData returns localized canonical data', async () => {
  const data = await resolveAuthRouteData({
    locale: 'zh',
    mode: 'sign-in',
  });

  assert.ok(data);
  assert.equal(data.locale, 'zh');
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/sign-in', 'zh'),
    }
  );
});

test('resolveAuthRouteData returns no-permission mode', async () => {
  const data = await resolveAuthRouteData({
    locale: 'en',
    mode: 'no-permission',
  });

  assert.ok(data);
  assert.equal(data.mode, 'no-permission');
  assert.equal(data.copy.accessDenied, 'Access denied');
});

test('loadAuthRouteMessages returns null for missing locale files', async () => {
  assert.equal(await loadAuthRouteMessages('missing-locale'), null);
});

test('resolveAuthRouteData exposes social provider gates from auth settings', async () => {
  const data = await resolveAuthRouteData({
    locale: 'en',
    mode: 'sign-in',
  });

  assert.ok(data);
  assert.equal(typeof data.authSettings.googleAuthEnabled, 'boolean');
  assert.equal(typeof data.authSettings.githubAuthEnabled, 'boolean');
});
