import { checkUserPermission } from '@/domains/access-control/application/checker';
import { readMemberChatThreadQuery } from '@/domains/chat/application/member-chats.query';
import { readUserPermissionCodes } from '@/infra/adapters/access-control/repository';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import { getRequest } from '@tanstack/react-start/server';

import { defaultLocale } from '@/config/locale';
import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { AuthSessionUserIdentity, AuthSessionUserSnapshot } from '@/shared/types/auth-session';
import type { Chat } from '@/shared/types/chat';

type ChatRouteInput = { locale: string; chatId?: string };

export type ChatShellRouteData = {
  status: 'ok';
  locale: string;
  initialUser: AuthSessionUserSnapshot | null;
};

export type ChatThreadRouteData =
  | { status: 'unauthenticated'; redirectTo: string }
  | { status: 'hidden'; redirectTo: string }
  | {
      status: 'ok';
      locale: string;
      initialUser: AuthSessionUserSnapshot | null;
      initialChat: Chat;
      initialMessagesJson: string;
    };

function resolveLocale(value: string) {
  return normalizeLocale(value) ?? defaultLocale;
}

function localizeHref(locale: string, path: string) {
  return locale === defaultLocale ? path : localePath(path, locale);
}

function toSnapshot(user: AuthSessionUserIdentity | null): AuthSessionUserSnapshot | null {
  if (!user) return null;
  return { name: user.name, email: user.email, image: user.image };
}

export async function resolveChatShellRouteData(
  input: ChatRouteInput
): Promise<ChatShellRouteData> {
  const locale = resolveLocale(input.locale);
  const user = await getSignedInUserIdentityFromRequest(getRequest());
  return { status: 'ok' as const, locale, initialUser: toSnapshot(user) };
}

export async function resolveChatThreadRouteData(
  input: ChatRouteInput
): Promise<ChatThreadRouteData> {
  const locale = resolveLocale(input.locale);
  const chatId = input.chatId?.trim() ?? '';
  const user = await getSignedInUserIdentityFromRequest(getRequest());
  if (!user) {
    return {
      status: 'unauthenticated' as const,
      redirectTo: `${localizeHref(locale, '/sign-in')}?callbackUrl=${encodeURIComponent(localizeHref(locale, `/chat/${chatId}`))}`,
    };
  }

  const viewerHasAdminAccess = await checkUserPermission(user.id, PERMISSIONS.ADMIN_ACCESS, { readUserPermissionCodes });
  const result = await readMemberChatThreadQuery({
    chatId,
    viewerUserId: user.id,
    viewerHasAdminAccess,
    log: createUseCaseLogger({ domain: 'chat', useCase: 'member-chat-thread', operation: 'page-load' }),
  });
  if (result.status !== 'ok') {
    return { status: 'hidden' as const, redirectTo: localizeHref(locale, '/no-permission') };
  }

  const { chat, messages } = result.thread;
  const initialChat: Chat = {
    id: chat.id,
    title: chat.title ?? '',
    createdAt: chat.createdAt instanceof Date ? chat.createdAt.toISOString() : String(chat.createdAt),
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
