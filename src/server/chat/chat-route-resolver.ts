import { checkUserPermission } from '@/domains/access-control/application/checker';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import { readMemberChatThreadQuery } from '@/domains/chat/application/member-chats.query';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { readPublicUiConfigCached } from '@/domains/settings/application/settings-runtime.query';
import { readUserPermissionCodes } from '@/infra/adapters/access-control/repository';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';

import { defaultLocale } from '@/config/locale';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import type {
  AuthSessionUserIdentity,
  AuthSessionUserSnapshot,
} from '@/shared/types/auth-session';
import type { Chat } from '@/shared/types/chat';

type ChatRouteInput = { locale: string; chatId?: string };

type ChatRouteDeps = {
  readPublicUiConfig: () => Promise<PublicUiConfig>;
  getCurrentRequest: () => Request | Promise<Request>;
  readSignedInUser: (
    request: Request
  ) => Promise<AuthSessionUserIdentity | null>;
  userHasAdminAccess: (userId: string) => Promise<boolean>;
  readChatThread: typeof readMemberChatThreadQuery;
};

export type ChatShellRouteData =
  | { status: 'hidden' }
  | {
      status: 'ok';
      locale: string;
      initialUser: AuthSessionUserSnapshot | null;
    };

export type ChatThreadRouteData =
  | { status: 'unauthenticated'; redirectTo: string }
  | { status: 'hidden'; redirectTo?: string }
  | {
      status: 'ok';
      locale: string;
      initialUser: AuthSessionUserSnapshot | null;
      initialChat: Chat;
      initialMessagesJson: string;
    };

function resolveLocale(value: string) {
  return normalizeLocale(value);
}

function localizeHref(locale: string, path: string) {
  return locale === defaultLocale ? path : localePath(path, locale);
}

function toSnapshot(
  user: AuthSessionUserIdentity | null
): AuthSessionUserSnapshot | null {
  if (!user) return null;
  return { name: user.name, email: user.email, image: user.image };
}

const defaultChatRouteDeps: ChatRouteDeps = {
  readPublicUiConfig: readPublicUiConfigCached,
  getCurrentRequest: async () => {
    const { getRequest } = await import('@tanstack/react-start/server');
    return getRequest();
  },
  readSignedInUser: getSignedInUserIdentityFromRequest,
  userHasAdminAccess: (userId) =>
    checkUserPermission(userId, PERMISSIONS.ADMIN_ACCESS, {
      readUserPermissionCodes,
    }),
  readChatThread: readMemberChatThreadQuery,
};

export async function resolveChatShellRouteData(
  input: ChatRouteInput,
  deps: ChatRouteDeps = defaultChatRouteDeps
): Promise<ChatShellRouteData> {
  const locale = resolveLocale(input.locale);
  if (!locale) {
    return { status: 'hidden' };
  }

  if (!isAiEnabled(await deps.readPublicUiConfig())) {
    return { status: 'hidden' };
  }

  const user = await deps.readSignedInUser(await deps.getCurrentRequest());
  return { status: 'ok' as const, locale, initialUser: toSnapshot(user) };
}

export async function resolveChatThreadRouteData(
  input: ChatRouteInput,
  deps: ChatRouteDeps = defaultChatRouteDeps
): Promise<ChatThreadRouteData> {
  const locale = resolveLocale(input.locale);
  if (!locale) {
    return { status: 'hidden' };
  }

  if (!isAiEnabled(await deps.readPublicUiConfig())) {
    return { status: 'hidden' };
  }

  const chatId = input.chatId?.trim() ?? '';
  const user = await deps.readSignedInUser(await deps.getCurrentRequest());
  if (!user) {
    return {
      status: 'unauthenticated' as const,
      redirectTo: `${localizeHref(locale, '/sign-in')}?callbackUrl=${encodeURIComponent(localizeHref(locale, `/chat/${chatId}`))}`,
    };
  }

  const viewerHasAdminAccess = await deps.userHasAdminAccess(user.id);
  const result = await deps.readChatThread({
    chatId,
    viewerUserId: user.id,
    viewerHasAdminAccess,
    log: createUseCaseLogger({
      domain: 'chat',
      useCase: 'member-chat-thread',
      operation: 'page-load',
    }),
  });
  if (result.status !== 'ok') {
    return {
      status: 'hidden' as const,
      redirectTo: localizeHref(locale, '/no-permission'),
    };
  }

  const { chat, messages } = result.thread;
  const initialChat: Chat = {
    id: chat.id,
    title: chat.title ?? '',
    createdAt:
      chat.createdAt instanceof Date
        ? chat.createdAt.toISOString()
        : String(chat.createdAt),
    model: chat.model ?? '',
    provider: chat.provider ?? '',
    parts: chat.parts ?? '[]',
    metadata: chat.metadata ?? null,
    content: chat.content ?? null,
  };

  return {
    status: 'ok' as const,
    locale,
    initialUser: toSnapshot(user),
    initialChat,
    initialMessagesJson: JSON.stringify(
      messages.map((message) => ({
        id: message.id,
        role: message.role,
        parts: message.parts,
        metadata: message.metadata ?? undefined,
      }))
    ),
  };
}
