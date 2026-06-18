import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveChatShellRouteData,
  resolveChatThreadRouteData,
} from './chat-route-resolver';

type ChatRouteDeps = NonNullable<
  Parameters<typeof resolveChatShellRouteData>[1]
>;

function publicConfig(aiEnabled: boolean) {
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

function buildDeps(overrides: Partial<ChatRouteDeps> = {}): ChatRouteDeps {
  return {
    readPublicUiConfig: async () => publicConfig(true),
    getCurrentRequest: () => new Request('https://example.test/chat'),
    readSignedInUser: async () => null,
    userHasAdminAccess: async () => false,
    readChatThread: async () => {
      throw new Error('readChatThread should not be called');
    },
    ...overrides,
  } as ChatRouteDeps;
}

test('resolveChatShellRouteData hides chat when AI is disabled', async () => {
  let readUser = false;

  const data = await resolveChatShellRouteData(
    { locale: 'en' },
    buildDeps({
      readPublicUiConfig: async () => publicConfig(false),
      readSignedInUser: async () => {
        readUser = true;
        return null;
      },
    })
  );

  assert.deepEqual(data, { status: 'hidden' });
  assert.equal(readUser, false);
});

test('resolveChatShellRouteData rejects unsupported locales before reading settings', async () => {
  let readConfig = false;

  const data = await resolveChatShellRouteData(
    { locale: 'foo' },
    buildDeps({
      readPublicUiConfig: async () => {
        readConfig = true;
        return publicConfig(true);
      },
    })
  );

  assert.deepEqual(data, { status: 'hidden' });
  assert.equal(readConfig, false);
});

test('resolveChatThreadRouteData hides chat thread when AI is disabled', async () => {
  let readUser = false;

  const data = await resolveChatThreadRouteData(
    { locale: 'en', chatId: 'thread_1' },
    buildDeps({
      readPublicUiConfig: async () => publicConfig(false),
      readSignedInUser: async () => {
        readUser = true;
        return null;
      },
    })
  );

  assert.deepEqual(data, { status: 'hidden' });
  assert.equal(readUser, false);
});

test('resolveChatThreadRouteData rejects unsupported locales before reading settings', async () => {
  let readConfig = false;

  const data = await resolveChatThreadRouteData(
    { locale: 'foo', chatId: 'thread_1' },
    buildDeps({
      readPublicUiConfig: async () => {
        readConfig = true;
        return publicConfig(true);
      },
    })
  );

  assert.deepEqual(data, { status: 'hidden' });
  assert.equal(readConfig, false);
});
