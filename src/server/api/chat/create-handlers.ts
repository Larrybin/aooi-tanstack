import {
  createChatUseCase,
  getChatInfoUseCase,
  listChatMessagesUseCase,
  listChatsUseCase,
  streamChatUseCase,
} from '@/domains/chat/application/use-cases';
import type { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { z } from 'zod';
import type { convertToModelMessages, streamText, UIMessage } from 'ai';

import { jsonOk } from '@/shared/lib/api/response';
import { setResponseHeader } from '@/shared/lib/api/response-headers';
import {
  ChatInfoBodySchema,
  type ChatInfoBody,
} from '@/shared/schemas/api/chat/info';
import {
  ChatListBodySchema,
  type ChatListBody,
} from '@/shared/schemas/api/chat/list';
import {
  ChatMessagesBodySchema,
  type ChatMessagesBody,
} from '@/shared/schemas/api/chat/messages';
import {
  ChatNewBodySchema,
  type ChatNewBody,
} from '@/shared/schemas/api/chat/new';
import {
  ChatStreamBodySchema,
  type ChatStreamBody,
} from '@/shared/schemas/api/chat/stream';

import type { ChatDataDeps } from './deps';

type ChatLog = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

export type ChatApiContext = {
  log: ChatLog;
  parseJson: <TSchema extends z.ZodTypeAny>(schema: TSchema) => Promise<z.infer<TSchema>>;
  requireUser: () => Promise<{ id: string }>;
};

export type ChatHandlerDeps = {
  requireAiEnabled: () => Promise<void>;
  createApiContext: (request: Request) => ChatApiContext;
  generateId: () => string;
  now: () => Date;
  createProvider: typeof createOpenRouter;
  streamText: typeof streamText;
  convertToModelMessages: typeof convertToModelMessages;
  chatNewDeps: ChatDataDeps['chatNewDeps'];
  chatListDeps: ChatDataDeps['chatListDeps'];
  chatInfoDeps: ChatDataDeps['chatInfoDeps'];
  chatMessagesDeps: ChatDataDeps['chatMessagesDeps'];
  chatStreamDeps: ChatDataDeps['chatStreamDeps'];
};

export function createChatNewPostAction(deps: ChatHandlerDeps) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { message, body } = (await api.parseJson(
      ChatNewBodySchema
    )) as ChatNewBody;
    const user = await api.requireUser();

    const chat = await createChatUseCase(
      {
        generateId: deps.generateId,
        now: deps.now,
        createChat: deps.chatNewDeps.createChat,
      },
      {
        user,
        message,
        body,
      }
    );

    return jsonOk(chat, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export function createChatListPostAction(deps: ChatHandlerDeps) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { page, limit } = (await api.parseJson(
      ChatListBodySchema
    )) as ChatListBody;
    const user = await api.requireUser();

    const result = await listChatsUseCase(
      {
        getChats: deps.chatListDeps.getChats,
        getChatsCount: deps.chatListDeps.getChatsCount,
      },
      {
        user,
        page,
        limit,
      }
    );

    return jsonOk(result, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export function createChatInfoPostAction(deps: ChatHandlerDeps) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { chatId } = (await api.parseJson(ChatInfoBodySchema)) as ChatInfoBody;
    const user = await api.requireUser();

    const chat = await getChatInfoUseCase(
      {
        findChatById: deps.chatInfoDeps.findChatById,
      },
      {
        chatId,
        user,
      }
    );

    return jsonOk(chat, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export function createChatMessagesPostAction(deps: ChatHandlerDeps) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { log } = api;
    const { chatId, page, limit } = (await api.parseJson(
      ChatMessagesBodySchema
    )) as ChatMessagesBody;
    const user = await api.requireUser();

    const result = await listChatMessagesUseCase(
      {
        findChatById: deps.chatMessagesDeps.findChatById,
        getChatMessages: deps.chatMessagesDeps.getChatMessages,
        getChatMessagesCount: deps.chatMessagesDeps.getChatMessagesCount,
      },
      {
        user,
        chatId,
        page,
        limit,
        log,
      }
    );

    return jsonOk(result, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export function createChatStreamPostAction(deps: ChatHandlerDeps) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { log } = api;
    const parsed = (await api.parseJson(ChatStreamBodySchema)) as ChatStreamBody;
    const { chatId, message: rawMessage, model, webSearch, reasoning } = parsed;
    const user = await api.requireUser();

    const response = await streamChatUseCase(
      {
        generateId: deps.generateId,
        now: deps.now,
        createProvider: deps.createProvider,
        streamText: deps.streamText,
        convertToModelMessages: deps.convertToModelMessages,
        findChatById: deps.chatStreamDeps.findChatById,
        createChatMessage: deps.chatStreamDeps.createChatMessage,
        getChatMessageWindow: deps.chatStreamDeps.getChatMessageWindow,
        readAiRuntimeSettings: deps.chatStreamDeps.readAiRuntimeSettings,
        readAiProviderBindings: deps.chatStreamDeps.readAiProviderBindings,
        consumeCredits: deps.chatStreamDeps.consumeCredits,
        refundConsumedCreditById: deps.chatStreamDeps.refundConsumedCreditById,
      },
      {
        user,
        chatId,
        message: rawMessage as UIMessage,
        model,
        webSearch,
        reasoning,
        log,
      }
    );

    return setResponseHeader(response, 'Cache-Control', 'no-store');
  };
}
