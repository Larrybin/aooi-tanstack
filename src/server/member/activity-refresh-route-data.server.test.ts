import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

import { defaultLocale } from '@/config/locale';
import { localePath } from '@/shared/i18n/locale';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import { resolveActivityAiTaskRefreshRouteData } from './activity-refresh-route-resolver';

test('resolveActivityAiTaskRefreshRouteData redirects after successful refresh', async () => {
  const seen: Array<{ taskId: string; actorUserId: string }> = [];
  const data = await resolveActivityAiTaskRefreshRouteData(
    { locale: 'zh', id: 'task-1' },
    routeDeps({
      refreshMemberAiTask: async (input) => {
        seen.push(input);
        return { status: 'ok' };
      },
    })
  );

  assert.deepEqual(seen, [{ taskId: 'task-1', actorUserId: 'user-1' }]);
  assert.ok(data);
  assert.equal(data.redirectTo, localePath('/activity/ai-tasks', 'zh'));
  assert.equal(data.canonicalPath, '/activity/ai-tasks/task-1/refresh');
});

test('resolveActivityAiTaskRefreshRouteData returns message for hidden task', async () => {
  const data = await resolveActivityAiTaskRefreshRouteData(
    { locale: defaultLocale, id: 'task-1' },
    routeDeps({
      refreshMemberAiTask: async () => ({ status: 'hidden' }),
    })
  );

  assert.ok(data);
  assert.equal(data.redirectTo, null);
  assert.equal(data.page.message, 'Task not found');
});

test('resolveActivityAiTaskRefreshRouteData returns invalid provider message', async () => {
  const data = await resolveActivityAiTaskRefreshRouteData(
    { locale: defaultLocale, id: 'task-1' },
    routeDeps({
      refreshMemberAiTask: async () => ({ status: 'query_failed' }),
    })
  );

  assert.ok(data);
  assert.equal(data.redirectTo, null);
  assert.equal(data.page.message, 'Invalid AI provider');
});

test('resolveActivityAiTaskRefreshRouteData returns null for invalid gate input', async () => {
  assert.equal(
    await resolveActivityAiTaskRefreshRouteData(
      { locale: 'invalid', id: 'task-1' },
      routeDeps()
    ),
    null
  );
  assert.equal(
    await resolveActivityAiTaskRefreshRouteData(
      { locale: defaultLocale, id: '' },
      routeDeps()
    ),
    null
  );
  assert.equal(
    await resolveActivityAiTaskRefreshRouteData(
      { locale: defaultLocale, id: 'task-1' },
      routeDeps({
        publicUiConfig: fakePublicUiConfig({ aiEnabled: false }),
      })
    ),
    null
  );
});

test('resolveActivityAiTaskRefreshRouteData does not refresh without auth', async () => {
  const data = await resolveActivityAiTaskRefreshRouteData(
    { locale: defaultLocale, id: 'task-1' },
    routeDeps({
      signedInUser: null,
      refreshMemberAiTask: async () => {
        throw new Error('must not refresh');
      },
    })
  );

  assert.ok(data);
  assert.equal(data.page.message, 'Task not found');
});

function routeDeps(
  overrides: {
    publicUiConfig?: PublicUiConfig;
    signedInUser?: AuthSessionUserIdentity | null;
    refreshMemberAiTask?: NonNullable<
      Parameters<typeof resolveActivityAiTaskRefreshRouteData>[1]
    >['refreshMemberAiTask'];
  } = {}
): NonNullable<Parameters<typeof resolveActivityAiTaskRefreshRouteData>[1]> {
  return {
    readPublicUiConfig: async () =>
      overrides.publicUiConfig ?? fakePublicUiConfig(),
    readSignedInUserIdentity: async () =>
      overrides.signedInUser === undefined
        ? fakeSignedInUser()
        : overrides.signedInUser,
    refreshMemberAiTask:
      overrides.refreshMemberAiTask ??
      (async () => ({
        status: 'ok',
      })),
  };
}

function fakeSignedInUser(): AuthSessionUserIdentity {
  return {
    id: 'user-1',
    name: 'User',
    email: 'user@example.test',
    image: null,
  };
}

function fakePublicUiConfig(
  overrides: Partial<PublicUiConfig> = {}
): PublicUiConfig {
  return {
    aiEnabled: true,
    localeSwitcherEnabled: true,
    socialLinksEnabled: false,
    socialLinksJson: '',
    socialLinks: [],
    affiliate: {
      affonsoEnabled: false,
      promotekitEnabled: false,
    },
    ...overrides,
  };
}
