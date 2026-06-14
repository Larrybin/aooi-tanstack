import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { defaultLocale, locales } from '@/config/locale';
import { localePath } from '@/shared/i18n/locale';
import { buildCanonicalUrl } from '@/shared/seo/canonical';

import {
  resolveSettingsProfileRouteData,
  resolveSettingsProfileUpdate,
} from './settings-profile-route-resolver';

test('resolveSettingsProfileRouteData returns default route data', async () => {
  const data = await resolveSettingsProfileRouteData(
    { locale: defaultLocale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(data);
  assert.equal(data.locale, defaultLocale);
  assert.equal(data.canonicalPath, '/settings/profile');
  assert.equal(data.viewer.signedIn, false);
  assert.equal(data.page.profile, null);
  assert.equal(data.page.title, 'Profile');
});

test('resolveSettingsProfileRouteData returns localized route data', async () => {
  const locale = getLocaleWithProfileMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsProfileRouteData(
    { locale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(data.page.title, '个人资料');
  assert.equal(data.page.fields.email, '邮箱');
});

test('resolveSettingsProfileRouteData returns null for unsupported locale', async () => {
  const data = await resolveSettingsProfileRouteData(
    { locale: 'fr' },
    { readSignedInUserIdentity: async () => null }
  );

  assert.equal(data, null);
});

test('resolveSettingsProfileRouteData falls back to base copy when locale profile messages are missing', async () => {
  const locale = getSupportedLocaleMissingProfileMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsProfileRouteData(
    { locale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(data.page.title, 'Profile');
});

test('resolveSettingsProfileRouteData reflects signed-in profile state', async () => {
  const data = await resolveSettingsProfileRouteData(
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
  assert.deepEqual(data?.page.profile, {
    email: 'ada@example.test',
    name: 'Ada',
    image: null,
  });
});

test('resolveSettingsProfileRouteData exposes only public profile fields', async () => {
  const data = await resolveSettingsProfileRouteData(
    { locale: defaultLocale },
    {
      readSignedInUserIdentity: async () =>
        ({
          id: 'user-1',
          name: 'Ada',
          email: 'ada@example.test',
          image: 'https://example.test/avatar.png',
          role: 'admin',
          sessionToken: 'secret',
        }) as never,
    }
  );

  assert.deepEqual(Object.keys(data?.page.profile ?? {}).sort(), [
    'email',
    'image',
    'name',
  ]);
});

test('resolveSettingsProfileRouteData builds canonical and noindex head', async () => {
  const data = await resolveSettingsProfileRouteData(
    { locale: defaultLocale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(data);
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/settings/profile', defaultLocale),
    }
  );
  assert.deepEqual(
    data.head.meta?.find((meta) => meta.name === 'robots'),
    { name: 'robots', content: 'noindex,nofollow' }
  );
});

test('resolveSettingsProfileRouteData localizes migrated shell nav URLs', async () => {
  const locale = getLocaleWithProfileMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsProfileRouteData(
    { locale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(data);
  assert.deepEqual(
    data.shell.nav.items.map((item) => item.url),
    [
      localePath('/settings/profile', locale),
      localePath('/settings/security', locale),
      localePath('/settings/credits', locale),
      localePath('/settings/billing', locale),
      localePath('/settings/payments', locale),
    ]
  );
  assert.equal(data.shell.nav.items[0]?.active, true);
  assert.equal(data.shell.nav.items[1]?.active, false);
  assert.equal(data.shell.nav.items[2]?.active, false);
  assert.equal(data.shell.nav.items[3]?.active, false);
  assert.equal(data.shell.nav.items[4]?.active, false);
});

test('resolveSettingsProfileRouteData is JSON serializable', async () => {
  const data = await resolveSettingsProfileRouteData(
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

  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsProfileRouteData injected no-auth reader avoids DB requirement', async () => {
  const data = await resolveSettingsProfileRouteData(
    { locale: defaultLocale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.equal(data?.viewer.signedIn, false);
  assert.equal(data?.page.profile, null);
});

test('resolveSettingsProfileUpdate persists signed-in profile changes', async () => {
  const updates: Array<{
    userId: string;
    updatedUser: { name?: string; image?: string };
  }> = [];

  const result = await resolveSettingsProfileUpdate(
    {
      locale: defaultLocale,
      name: 'Grace Hopper',
      image: '/avatar.png',
    },
    {
      readSignedInUserIdentity: async () => ({
        id: 'user-1',
        name: 'Grace',
        email: 'grace@example.test',
        image: null,
      }),
      updateUser: async (userId, updatedUser) => {
        updates.push({ userId, updatedUser });
      },
    }
  );

  assert.equal(result.status, 'success');
  assert.deepEqual(updates, [
    {
      userId: 'user-1',
      updatedUser: {
        name: 'Grace Hopper',
        image: '/avatar.png',
      },
    },
  ]);
});

test('resolveSettingsProfileUpdate returns no-auth error without updating', async () => {
  let updateCalled = false;

  const result = await resolveSettingsProfileUpdate(
    {
      locale: defaultLocale,
      name: 'Ada',
      image: '',
    },
    {
      readSignedInUserIdentity: async () => null,
      updateUser: async () => {
        updateCalled = true;
      },
    }
  );

  assert.equal(result.status, 'error');
  assert.equal(result.message, 'Please sign in to continue');
  assert.equal(updateCalled, false);
});

test('resolveSettingsProfileUpdate rejects empty names', async () => {
  for (const name of ['', '   ']) {
    let updateCalled = false;

    const result = await resolveSettingsProfileUpdate(
      {
        locale: defaultLocale,
        name,
        image: '',
      },
      {
        readSignedInUserIdentity: async () => fakeSignedInUser(),
        updateUser: async () => {
          updateCalled = true;
        },
      }
    );

    assert.equal(result.status, 'error');
    assert.equal(result.message, 'Name is required');
    assert.equal(updateCalled, false);
  }
});

test('resolveSettingsProfileUpdate accepts valid image values', async () => {
  const cases = [
    {
      image: 'https://example.com/avatar.png',
      storedImage: 'https://example.com/avatar.png',
    },
    {
      image: 'http://example.com/avatar.png',
      storedImage: 'http://example.com/avatar.png',
    },
    { image: '', storedImage: '' },
    { image: '/avatar.png', storedImage: '/avatar.png' },
  ];

  for (const { image, storedImage } of cases) {
    const updates: Array<{
      userId: string;
      updatedUser: { name?: string; image?: string };
    }> = [];

    const result = await resolveSettingsProfileUpdate(
      {
        locale: defaultLocale,
        name: 'Ada Lovelace',
        image,
      },
      {
        readSignedInUserIdentity: async () => fakeSignedInUser(),
        updateUser: async (userId, updatedUser) => {
          updates.push({ userId, updatedUser });
        },
      }
    );

    assert.equal(result.status, 'success');
    assert.deepEqual(updates, [
      {
        userId: 'user-1',
        updatedUser: {
          name: 'Ada Lovelace',
          image: storedImage,
        },
      },
    ]);
    assert.equal(result.profile?.image, storedImage || null);
  }
});

test('resolveSettingsProfileUpdate rejects unsafe avatar URLs', async () => {
  for (const image of [
    'javascript:alert(1)',
    '//evil.com/avatar.png',
    'ftp://example.com/avatar.png',
  ]) {
    let updateCalled = false;

    const result = await resolveSettingsProfileUpdate(
      {
        locale: defaultLocale,
        name: 'Ada',
        image,
      },
      {
        readSignedInUserIdentity: async () => fakeSignedInUser(),
        updateUser: async () => {
          updateCalled = true;
        },
      }
    );

    assert.equal(result.status, 'error');
    assert.equal(updateCalled, false);
  }
});

test('resolveSettingsProfileUpdate returns public profile and localized success message', async () => {
  const locale = getLocaleWithProfileMessages() ?? defaultLocale;

  const result = await resolveSettingsProfileUpdate(
    {
      locale,
      name: 'Ada Lovelace',
      image: '/avatar.png',
    },
    {
      readSignedInUserIdentity: async () =>
        ({
          ...fakeSignedInUser(),
          role: 'admin',
          sessionToken: 'secret',
        }) as never,
      updateUser: async () => {},
    }
  );

  assert.equal(result.status, 'success');
  assert.equal(
    result.message,
    locale === 'zh' ? '个人资料已更新' : 'Profile updated'
  );
  assert.deepEqual(Object.keys(result.profile ?? {}).sort(), [
    'email',
    'image',
    'name',
  ]);
  assert.deepEqual(result.profile, {
    email: 'ada@example.test',
    name: 'Ada Lovelace',
    image: '/avatar.png',
  });
});

test('resolveSettingsProfileUpdate returns error for invalid locale', async () => {
  const result = await resolveSettingsProfileUpdate(
    {
      locale: 'not-a-locale',
      name: 'Ada',
      image: '',
    },
    {
      readSignedInUserIdentity: async () => {
        throw new Error('auth should not be read for invalid locale');
      },
      updateUser: async () => {
        throw new Error('update should not run for invalid locale');
      },
    }
  );

  assert.deepEqual(result, { status: 'error', message: 'Invalid locale' });
});

test('resolveSettingsProfileUpdate result is JSON serializable', async () => {
  const result = await resolveSettingsProfileUpdate(
    {
      locale: defaultLocale,
      name: 'Ada',
      image: '',
    },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      updateUser: async () => {},
    }
  );

  assert.doesNotThrow(() => JSON.stringify(result));
});

test('resolveSettingsProfileUpdate returns error when update fails', async () => {
  const result = await resolveSettingsProfileUpdate(
    {
      locale: defaultLocale,
      name: 'Ada',
      image: '',
    },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      updateUser: async () => {
        throw new Error('database unavailable');
      },
    }
  );

  assert.deepEqual(result, {
    status: 'error',
    message: 'Profile update failed',
  });
});

function fakeSignedInUser() {
  return {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.test',
    image: null,
  };
}

function getLocaleWithProfileMessages() {
  return locales.includes('zh' as (typeof locales)[number]) ? 'zh' : null;
}

function getSupportedLocaleMissingProfileMessages() {
  return (
    locales.find(
      (locale) =>
        locale !== defaultLocale &&
        !existsSync(
          join(
            process.cwd(),
            'src/config/locale/messages',
            locale,
            'settings/profile.json'
          )
        )
    ) ?? null
  );
}
