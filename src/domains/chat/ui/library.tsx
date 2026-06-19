'use client';

import { useEffect, useRef, useState } from 'react';
import { IconDots, IconMessageCircle } from '@tabler/icons-react';

import { Link } from '@/shared/blocks/common/navigation';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/components/ui/sidebar';
import { useAuthSnapshot } from '@/shared/contexts/auth-snapshot';
import { useChatContext } from '@/shared/contexts/chat';
import { fetchApiData } from '@/shared/lib/api/client';
import { toastFetchError } from '@/shared/lib/api/fetch-json';
import { useTranslations } from '@/shared/lib/i18n/native-react';
import type { Chat } from '@/shared/types/chat';

export function ChatLibrary() {
  const t = useTranslations('ai.chat.library');
  const activeChatId = getActiveChatIdFromPathname();
  const snapshot = useAuthSnapshot();
  const { chats, setChats } = useChatContext();
  const [hasMore, setHasMore] = useState(false);
  const didToastFetchChatsError = useRef(false);

  const page = 1;
  const limit = 10;

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const fetchChats = async () => {
      try {
        const data = await fetchApiData<{
          list: Chat[];
          hasMore: boolean;
        }>('/api/chat/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page, limit }),
        });

        setChats(data.list || []);
        setHasMore(Boolean(data.hasMore));
      } catch (e: unknown) {
        if (!didToastFetchChatsError.current) {
          didToastFetchChatsError.current = true;
          toastFetchError(e, 'Failed to load chats');
        }
      }
    };

    void fetchChats();
  }, [snapshot, page, limit, setChats]);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t('title')}</SidebarGroupLabel>
      <SidebarMenu>
        {chats.length > 0 &&
          chats.slice(0, limit).map((chat) => (
            <SidebarMenuItem key={chat.id}>
              <SidebarMenuButton
                asChild
                className={
                  activeChatId === chat.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : ''
                }
              >
                <Link href={`/chat/${chat.id}`}>
                  <IconMessageCircle className="text-sidebar-foreground/70" />
                  <span>{chat.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

        {hasMore && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/chat/history">
                <IconDots className="text-sidebar-foreground/70" />
                <span>{t('more')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function getActiveChatIdFromPathname() {
  if (typeof window === 'undefined') return '';
  const segments = window.location.pathname.split('/').filter(Boolean);
  const chatIndex = segments.indexOf('chat');
  return chatIndex === -1 ? '' : (segments[chatIndex + 1] ?? '');
}
