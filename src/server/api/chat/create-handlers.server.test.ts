import assert from 'node:assert/strict';
import test from 'node:test';

import { withApi } from '@/shared/lib/api/route';

import { createChatMessagesPostAction } from './create-handlers';

function createApiContextStub(body: unknown) {
  return () =>
    ({
      log: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      parseJson: async () => body,
      requireUser: async () => ({ id: 'user_1' }),
    }) as never;
}

test('chat/messages route 返回统一 json envelope 和 no-store header', async () => {
  const handler = withApi(
    createChatMessagesPostAction({
      requireAiEnabled: async () => undefined,
      createApiContext: createApiContextStub({
        chatId: 'chat_1',
        page: 1,
        limit: 30,
      }),
      generateId: () => 'id_1',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      createProvider: () => ({ chat: () => ({}) }) as never,
      streamText: (() => {
        throw new Error('not used');
      }) as never,
      convertToModelMessages: (() => []) as never,
      chatNewDeps: {
        createChat: async () => {
          throw new Error('not used');
        },
      },
      chatListDeps: {
        getChats: async () => [],
        getChatsCount: async () => 0,
      },
      chatInfoDeps: {
        findChatById: async () => ({ id: 'chat_1', userId: 'user_1' }) as never,
      },
      chatMessagesDeps: {
        findChatById: async () => ({ id: 'chat_1', userId: 'user_1' }) as never,
        getChatMessages: async () =>
          [
            {
              id: 'msg_1',
              chatId: 'chat_1',
              userId: 'user_1',
              role: 'assistant',
              parts: '[]',
              metadata: '{}',
            },
          ] as never,
        getChatMessagesCount: async () => 1,
      },
      chatStreamDeps: {
        findChatById: async () => ({ id: 'chat_1', userId: 'user_1' }) as never,
        createChatMessage: async () => {
          throw new Error('not used');
        },
        getChatMessageWindow: async () => [],
        readAiRuntimeSettings: async () => ({ aiEnabled: true }),
        readAiProviderBindings: async () => ({
          openrouterApiKey: '',
          replicateApiToken: '',
          falApiKey: '',
          kieApiKey: '',
        }),
        consumeCredits: async () => ({ id: 'credit_1' }) as never,
        refundConsumedCreditById: async () => ({ refunded: true }),
      },
    })
  );

  const response = await handler(
    new Request('http://localhost/api/chat/messages', { method: 'POST' })
  );
  const body = (await response.json()) as {
    code: number;
    message: string;
    data: { total: number; list: unknown[] };
  };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(body.code, 0);
  assert.equal(body.message, 'ok');
  assert.equal(body.data.total, 1);
  assert.equal(body.data.list.length, 1);
});
