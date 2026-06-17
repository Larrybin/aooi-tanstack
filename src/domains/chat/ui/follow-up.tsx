'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { nanoid } from 'nanoid';

import type { PromptInputMessage } from '@/shared/components/ai-elements/prompt-input';
import { useChatContext } from '@/shared/contexts/chat';
import { safeJsonParse } from '@/shared/lib/json';

import { ChatInput } from './input';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function FollowUp({
  chatInstance,
}: {
  chatInstance: UseChatHelpers<UIMessage>;
}) {
  const activeChatId = getActiveChatIdFromPathname();
  const { chat } = useChatContext();
  const {
    messages,
    sendMessage,
    status,
    error: chatError,
    setMessages,
  } = chatInstance;
  const lastErrorRef = useRef<string | null>(null);

  const appendErrorMessage = useCallback(
    (errorMessage: string) => {
      setMessages((prev) => {
        const last = prev.at(-1);
        if (
          last &&
          last.role === 'assistant' &&
          last.metadata &&
          typeof last.metadata === 'object' &&
          isRecord(last.metadata) &&
          last.metadata.type === 'error' &&
          last.parts?.[0]?.type === 'text' &&
          last.parts[0].text === errorMessage
        ) {
          return prev;
        }

        return prev.concat({
          id: `error-${nanoid()}`,
          role: 'assistant',
          metadata: { type: 'error' },
          parts: [
            {
              type: 'text' as const,
              text: errorMessage,
            },
          ],
        });
      });
    },
    [setMessages]
  );

  useEffect(() => {
    if (!chatError) {
      return;
    }
    const message =
      chatError instanceof Error
        ? chatError.message
        : typeof chatError === 'string'
          ? chatError
          : 'request failed, please try again';

    if (lastErrorRef.current === message) {
      return;
    }
    lastErrorRef.current = message;
    appendErrorMessage(message);
  }, [chatError, appendErrorMessage]);

  const submitMessage = useCallback(
    async (
      message: PromptInputMessage,
      body: Record<string, unknown>
    ): Promise<void> => {
      const hasText = Boolean(message.text);
      const hasAttachments = Boolean(message.files?.length);
      if (!(hasText || hasAttachments)) {
        return;
      }

      lastErrorRef.current = null;

      try {
        await Promise.resolve(
          sendMessage(
            {
              text: message.text || 'Sent with attachments',
              files: message.files,
            },
            {
              body,
            }
          )
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'request failed, please try again';

        lastErrorRef.current = errorMessage;
        appendErrorMessage(errorMessage);

        throw err instanceof Error ? err : new Error(errorMessage);
      }
    },
    [sendMessage, appendErrorMessage]
  );

  useEffect(() => {
    if (
      chat?.id &&
      chat.id === activeChatId &&
      chat.content &&
      chat.createdAt &&
      messages.length === 0
    ) {
      const parsedMessage = safeJsonParse<unknown>(chat.content);
      const parsedBody = safeJsonParse<unknown>(chat.metadata);

      if (!parsedMessage || !isRecord(parsedMessage)) {
        return;
      }

      const message: PromptInputMessage = {
        text: typeof parsedMessage.text === 'string' ? parsedMessage.text : '',
        files: Array.isArray(parsedMessage.files)
          ? (parsedMessage.files as PromptInputMessage['files'])
          : undefined,
      };

      const body: Record<string, unknown> = isRecord(parsedBody)
        ? parsedBody
        : {};

      void submitMessage(message, body).catch(() => {
        // submitMessage already appends an error message; avoid unhandled rejection.
      });
    }
  }, [activeChatId, chat, submitMessage, messages.length]);

  if (!chat) {
    return null;
  }

  return <ChatInput handleSubmit={submitMessage} status={status} />;
}

function getActiveChatIdFromPathname() {
  if (typeof window === 'undefined') return '';
  const segments = window.location.pathname.split('/').filter(Boolean);
  const chatIndex = segments.indexOf('chat');
  return chatIndex === -1 ? '' : (segments[chatIndex + 1] ?? '');
}
