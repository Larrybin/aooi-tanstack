import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

import { defaultLocale, locales } from '@/config/locale';
import { localePath } from '@/shared/i18n/locale';

import { resolveMemberEntryRouteData } from './member-entry-route-resolver';

test('resolveMemberEntryRouteData redirects default settings entry', async () => {
  const data = await resolveMemberEntryRouteData({
    locale: defaultLocale,
    kind: 'settings',
  });

  assert.deepEqual(data, {
    locale: defaultLocale,
    kind: 'settings',
    redirectTo: localePath('/settings/profile', defaultLocale),
  });
});

test('resolveMemberEntryRouteData redirects localized settings entry', async () => {
  const localizedLocale = getLocalizedLocale();
  if (!localizedLocale) {
    assert.equal(
      await resolveMemberEntryRouteData({
        locale: 'zh',
        kind: 'settings',
      }),
      null
    );
    return;
  }

  const data = await resolveMemberEntryRouteData({
    locale: localizedLocale,
    kind: 'settings',
  });

  assert.deepEqual(data, {
    locale: localizedLocale,
    kind: 'settings',
    redirectTo: localePath('/settings/profile', localizedLocale),
  });
});

test('resolveMemberEntryRouteData redirects default activity entry when AI is enabled', async () => {
  const data = await resolveMemberEntryRouteData(
    {
      locale: defaultLocale,
      kind: 'activity',
    },
    {
      readPublicUiConfig: async () => publicUiConfig({ aiEnabled: true }),
    }
  );

  assert.deepEqual(data, {
    locale: defaultLocale,
    kind: 'activity',
    redirectTo: localePath('/activity/ai-tasks', defaultLocale),
  });
});

test('resolveMemberEntryRouteData redirects localized activity entry when AI is enabled', async () => {
  const localizedLocale = getLocalizedLocale();
  if (!localizedLocale) {
    assert.equal(
      await resolveMemberEntryRouteData(
        {
          locale: 'zh',
          kind: 'activity',
        },
        {
          readPublicUiConfig: async () => publicUiConfig({ aiEnabled: true }),
        }
      ),
      null
    );
    return;
  }

  const data = await resolveMemberEntryRouteData(
    {
      locale: localizedLocale,
      kind: 'activity',
    },
    {
      readPublicUiConfig: async () => publicUiConfig({ aiEnabled: true }),
    }
  );

  assert.deepEqual(data, {
    locale: localizedLocale,
    kind: 'activity',
    redirectTo: localePath('/activity/ai-tasks', localizedLocale),
  });
});

test('resolveMemberEntryRouteData preserves query string', async () => {
  const localizedLocale = getLocalizedLocale();
  const settings = await resolveMemberEntryRouteData({
    locale: defaultLocale,
    kind: 'settings',
    search: { from: 'nav', repeat: ['a', 'b'] },
  });
  const activity = await resolveMemberEntryRouteData(
    {
      locale: localizedLocale ?? 'zh',
      kind: 'activity',
      search: '?tab=recent',
    },
    {
      readPublicUiConfig: async () => publicUiConfig({ aiEnabled: true }),
    }
  );

  assert.equal(
    settings?.redirectTo,
    `${localePath('/settings/profile', defaultLocale)}?from=nav&repeat=a&repeat=b`
  );
  if (!localizedLocale) {
    assert.equal(activity, null);
    return;
  }
  assert.equal(
    activity?.redirectTo,
    `${localePath('/activity/ai-tasks', localizedLocale)}?tab=recent`
  );
});

test('resolveMemberEntryRouteData rejects unsupported locales', async () => {
  const data = await resolveMemberEntryRouteData({
    locale: 'fr',
    kind: 'settings',
  });

  assert.equal(data, null);
});

test('resolveMemberEntryRouteData returns null for activity when AI is disabled', async () => {
  const data = await resolveMemberEntryRouteData(
    {
      locale: defaultLocale,
      kind: 'activity',
    },
    {
      readPublicUiConfig: async () => publicUiConfig({ aiEnabled: false }),
    }
  );

  assert.equal(data, null);
});

test('resolveMemberEntryRouteData does not read public UI config for settings', async () => {
  const data = await resolveMemberEntryRouteData(
    {
      locale: defaultLocale,
      kind: 'settings',
    },
    {
      readPublicUiConfig: async () => {
        throw new Error('settings entry should not read public UI config');
      },
    }
  );

  assert.equal(
    data?.redirectTo,
    localePath('/settings/profile', defaultLocale)
  );
});

function getLocalizedLocale() {
  return locales.find((locale) => locale !== defaultLocale) ?? null;
}

function publicUiConfig({ aiEnabled }: { aiEnabled: boolean }): PublicUiConfig {
  return {
    aiEnabled,
    localeSwitcherEnabled: false,
    socialLinksEnabled: false,
    socialLinksJson: '',
    socialLinks: [],
    affiliate: {
      affonsoEnabled: false,
      promotekitEnabled: false,
    },
  };
}
