import { createServerFn } from '@tanstack/react-start';

type ChatRouteInput = { locale: string; chatId?: string };

function toInput(data: unknown): ChatRouteInput {
  const input = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return {
    locale: typeof input.locale === 'string' ? input.locale : '',
    chatId: typeof input.chatId === 'string' ? input.chatId : '',
  };
}

export const loadChatShellRouteData = createServerFn({ method: 'GET' })
  .validator(toInput)
  .handler(async ({ data }) => {
    const { resolveChatShellRouteData } = await import('./chat-route-resolver');
    return resolveChatShellRouteData(data);
  });

export const loadChatThreadRouteData = createServerFn({ method: 'GET' })
  .validator(toInput)
  .handler(async ({ data }) => {
    const { resolveChatThreadRouteData } = await import('./chat-route-resolver');
    return resolveChatThreadRouteData(data);
  });
