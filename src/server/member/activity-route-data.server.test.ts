import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

import { defaultLocale } from '@/config/locale';
import { localePath } from '@/shared/i18n/locale';
import { buildCanonicalUrl } from '@/shared/seo/canonical';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import { resolveActivityRouteData } from './activity-route-resolver';

test('resolveActivityRouteData returns null for unsupported locale', async () => {
  assert.equal(
    await resolveActivityRouteData(
      { locale: 'invalid', kind: 'ai-tasks' },
      routeDeps()
    ),
    null
  );
});

test('resolveActivityRouteData returns null when AI is disabled', async () => {
  assert.equal(
    await resolveActivityRouteData(
      { locale: defaultLocale, kind: 'ai-tasks' },
      routeDeps({
        publicUiConfig: fakePublicUiConfig({ aiEnabled: false }),
      })
    ),
    null
  );
});

test('resolveActivityRouteData returns no-auth page without querying rows', async () => {
  const data = await resolveActivityRouteData(
    { locale: defaultLocale, kind: 'ai-tasks' },
    routeDeps({
      signedInUser: null,
      aiTasksDeps: {
        getAITasks: async () => {
          throw new Error('must not query tasks');
        },
        getAITasksCount: async () => {
          throw new Error('must not count tasks');
        },
      },
    })
  );

  assert.ok(data);
  assert.equal(data.viewer.signedIn, false);
  assert.equal(data.page.noAuthMessage, 'Please sign in to continue');
  assert.deepEqual(data.page.rows, []);
});

test('resolveActivityRouteData returns signed-in AI task list data', async () => {
  const data = await resolveActivityRouteData(
    {
      locale: defaultLocale,
      kind: 'ai-tasks',
      search: { page: '2', pageSize: '1', type: 'image' },
    },
    routeDeps({
      aiTasksDeps: {
        getAITasks: async (input) => {
          assert.deepEqual(input, {
            userId: 'user-1',
            mediaType: 'image',
            page: 2,
            limit: 1,
          });
          return [
            {
              id: 'task-1',
              userId: 'user-1',
              prompt: 'make image',
              mediaType: 'image',
              provider: 'replicate',
              model: 'model-1',
              status: 'pending',
              costCredits: 3,
              taskInfo: JSON.stringify({
                images: [{ imageUrl: 'https://example.test/image.png' }],
              }),
              createdAt: new Date('2026-01-02T00:00:00.000Z'),
            },
          ];
        },
        getAITasksCount: async (input) => {
          assert.deepEqual(input, {
            userId: 'user-1',
            mediaType: 'image',
          });
          return 3;
        },
      },
    })
  );

  assert.ok(data);
  assert.equal(data.canonicalPath, '/activity/ai-tasks');
  assert.equal(data.page.title, 'AI Tasks');
  assert.equal(data.page.rows[0]?.values.prompt, 'make image');
  assert.equal(data.page.rows[0]?.result?.kind, 'images');
  assert.deepEqual(data.page.rows[0]?.actions, [
    {
      title: 'Refresh Task',
      url: '/activity/ai-tasks/task-1/refresh',
    },
  ]);
  assert.equal(
    data.page.tabs.find((tab) => tab.title === 'Image')?.active,
    true
  );
  assert.equal(
    data.page.pagination.previousHref,
    '/activity/ai-tasks?type=image&page=1&pageSize=1'
  );
  assert.equal(
    data.page.pagination.nextHref,
    '/activity/ai-tasks?type=image&page=3&pageSize=1'
  );
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/activity/ai-tasks', defaultLocale),
    }
  );
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveActivityRouteData returns signed-in chat list data', async () => {
  const data = await resolveActivityRouteData(
    { locale: 'zh', kind: 'chats', search: '?page=1&pageSize=20' },
    routeDeps({
      chatsDeps: {
        getChats: async (input) => {
          assert.deepEqual(input, {
            userId: 'user-1',
            page: 1,
            limit: 20,
          });
          return [
            {
              id: 'chat-1',
              userId: 'user-1',
              title: 'Chat title',
              model: 'model-1',
              provider: 'openrouter',
              createdAt: new Date('2026-01-02T00:00:00.000Z'),
            } as never,
          ];
        },
        getChatsCount: async (input) => {
          assert.deepEqual(input, { userId: 'user-1' });
          return 1;
        },
      },
    })
  );

  assert.ok(data);
  assert.equal(data.canonicalPath, '/activity/chats');
  assert.equal(
    data.shell.nav.items[1]?.url,
    localePath('/activity/chats', 'zh')
  );
  assert.equal(data.page.rows[0]?.values.title, 'Chat title');
  assert.deepEqual(data.page.rows[0]?.actions, []);
  assert.deepEqual(data.page.buttons, []);
});

test('resolveActivityRouteData returns feedback placeholder data', async () => {
  const data = await resolveActivityRouteData(
    { locale: defaultLocale, kind: 'feedbacks' },
    routeDeps()
  );

  assert.ok(data);
  assert.equal(data.canonicalPath, '/activity/feedbacks');
  assert.equal(data.page.title, 'Feedbacks');
  assert.equal(data.page.emptyMessage, 'No feedbacks found');
});

function routeDeps(
  overrides: {
    publicUiConfig?: PublicUiConfig;
    signedInUser?: AuthSessionUserIdentity | null;
    aiTasksDeps?: NonNullable<
      Parameters<typeof resolveActivityRouteData>[1]
    >['aiTasksDeps'];
    chatsDeps?: NonNullable<
      Parameters<typeof resolveActivityRouteData>[1]
    >['chatsDeps'];
  } = {}
): NonNullable<Parameters<typeof resolveActivityRouteData>[1]> {
  return {
    readPublicUiConfig: async () =>
      overrides.publicUiConfig ?? fakePublicUiConfig(),
    readSignedInUserIdentity: async () =>
      overrides.signedInUser === undefined
        ? fakeSignedInUser()
        : overrides.signedInUser,
    aiTasksDeps: overrides.aiTasksDeps ?? {
      getAITasks: async () => [],
      getAITasksCount: async () => 0,
    },
    chatsDeps: overrides.chatsDeps ?? {
      getChats: async () => [],
      getChatsCount: async () => 0,
    },
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
