import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { defaultLocale, locales } from '@/config/locale';
import { localePath } from '@/shared/i18n/locale';
import { buildCanonicalUrl } from '@/shared/seo/canonical';

import { resolveSettingsSecurityRouteData } from './settings-security-route-resolver';

test('resolveSettingsSecurityRouteData returns default route data', async () => {
  const data = await resolveSettingsSecurityRouteData(
    { locale: defaultLocale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(data);
  assert.equal(data.locale, defaultLocale);
  assert.equal(data.canonicalPath, '/settings/security');
  assert.equal(data.viewer.signedIn, false);
  assert.equal(data.page.resetPassword.title, 'Reset Password');
  assert.equal(data.page.resetPassword.button.href, '/forgot-password');
});

test('resolveSettingsSecurityRouteData returns localized route data', async () => {
  const locale = getLocaleWithSecurityMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsSecurityRouteData(
    { locale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(
    data.page.resetPassword.button.href,
    localePath('/forgot-password', locale)
  );
  assert.equal(data.page.resetPassword.title, '重置密码');
});

test('resolveSettingsSecurityRouteData returns null for unsupported locale', async () => {
  const data = await resolveSettingsSecurityRouteData(
    { locale: 'fr' },
    { readSignedInUserIdentity: async () => null }
  );

  assert.equal(data, null);
});

test('resolveSettingsSecurityRouteData falls back to base copy when locale security messages are missing', async () => {
  const locale = getSupportedLocaleMissingSecurityMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsSecurityRouteData(
    { locale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(data.page.resetPassword.title, 'Reset Password');
  assert.equal(
    data.page.resetPassword.button.href,
    localePath('/forgot-password', locale)
  );
});

test('resolveSettingsSecurityRouteData reflects signed-in state', async () => {
  const data = await resolveSettingsSecurityRouteData(
    { locale: defaultLocale },
    {
      readSignedInUserIdentity: async () => ({
        id: 'user-1',
        name: 'Ada',
        email: 'ada@example.test',
        image: null,
      }),
    }
  );

  assert.equal(data?.viewer.signedIn, true);
});

test('resolveSettingsSecurityRouteData builds canonical and noindex head', async () => {
  const data = await resolveSettingsSecurityRouteData(
    { locale: defaultLocale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(data);
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/settings/security', defaultLocale),
    }
  );
  assert.deepEqual(
    data.head.meta?.find((meta) => meta.name === 'robots'),
    { name: 'robots', content: 'noindex,nofollow' }
  );
});

test('resolveSettingsSecurityRouteData localizes migrated shell nav URLs', async () => {
  const locale = getLocaleWithSecurityMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsSecurityRouteData(
    { locale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(data);
  assert.deepEqual(
    data.shell.nav.items.map((item) => item.url),
    [
      localePath('/settings/profile', locale),
      localePath('/settings/security', locale),
    ]
  );
  assert.equal(data.shell.nav.items[0]?.active, false);
  assert.equal(data.shell.nav.items[1]?.active, true);
  assert.equal(
    data.shell.topNav.items[0]?.url,
    localePath('/settings/security', locale)
  );
});

test('resolveSettingsSecurityRouteData injected no-auth reader avoids DB requirement', async () => {
  const data = await resolveSettingsSecurityRouteData(
    { locale: defaultLocale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.equal(data?.viewer.signedIn, false);
});

function getLocaleWithSecurityMessages() {
  return locales.includes('zh' as (typeof locales)[number]) ? 'zh' : null;
}

function getSupportedLocaleMissingSecurityMessages() {
  return (
    locales.find(
      (locale) =>
        locale !== defaultLocale &&
        !existsSync(
          join(
            process.cwd(),
            'src/config/locale/messages',
            locale,
            'settings/security.json'
          )
        )
    ) ?? null
  );
}
