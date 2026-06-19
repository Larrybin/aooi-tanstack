'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Empty } from '@/shared/blocks/common/empty';
import { LocaleSelector } from '@/shared/blocks/common/locale-selector';
import {
  Link,
  usePathname,
  useRouter,
} from '@/shared/blocks/common/navigation';
import { Pagination } from '@/shared/blocks/common/pagination';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { SidebarTrigger } from '@/shared/components/ui/sidebar';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAuthSnapshot } from '@/shared/contexts/auth-snapshot';
import { fetchApiData } from '@/shared/lib/api/client';
import {
  formatMessageWithRequestId,
  getRequestIdFromError,
} from '@/shared/lib/api/request-id';
import { formatRelativeTime } from '@/shared/lib/date/format';
import { useLocale, useTranslations } from '@/shared/lib/i18n/native-react';

type ChatListItem = {
  id: string;
  title?: string | null;
  createdAt?: string | Date | null;
  model?: string | null;
  provider?: string | null;
};

type ChatListResponse = {
  list: ChatListItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export function ChatHistory() {
  const t = useTranslations('ai.chat.history');
  const intlLocale = useLocale();
  const locale = intlLocale === 'zh' ? 'zh-cn' : intlLocale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useMemo(() => getCurrentSearchParams(), []);
  const snapshot = useAuthSnapshot();

  const page = useMemo(() => {
    const value = Number(searchParams.get('page') || '1');
    return Number.isFinite(value) && value > 0 ? value : 1;
  }, [searchParams]);

  const limit = useMemo(() => {
    const value = Number(searchParams.get('limit') || '10');
    return Number.isFinite(value) && value > 0 ? value : 10;
  }, [searchParams]);

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const buildPageTarget = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextPage === 1) {
        params.delete('page');
      } else {
        params.set('page', String(nextPage));
      }
      params.set('limit', String(limit));
      const queryString = params.toString();
      return queryString ? `${pathname}?${queryString}` : pathname;
    },
    [limit, pathname, searchParams]
  );

  const fetchChats = useCallback(async () => {
    if (!snapshot) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchApiData<ChatListResponse>('/api/chat/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page, limit }),
      });

      const nextChats = data.list || [];
      const nextTotal = data.total || 0;
      setChats(nextChats);
      setTotal(nextTotal);

      const nextTotalPages =
        limit <= 0 ? 1 : Math.max(Math.ceil(nextTotal / limit), 1);
      if (nextTotal > 0 && nextChats.length === 0 && page > nextTotalPages) {
        router.push(buildPageTarget(nextTotalPages));
      }
    } catch (err) {
      console.error('fetch chat history failed:', err);
      setError(
        formatMessageWithRequestId(t('error'), getRequestIdFromError(err))
      );
    } finally {
      setLoading(false);
    }
  }, [buildPageTarget, limit, page, router, snapshot, t]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const timeout = setTimeout(() => {
      void fetchChats();
    }, 0);

    return () => {
      clearTimeout(timeout);
    };
  }, [fetchChats, snapshot]);

  const handleRetry = () => {
    void fetchChats();
  };

  const renderContent = () => {
    if (!snapshot) {
      return <Empty message={t('signin')} />;
    }

    if (loading) {
      return (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="text-destructive">{error}</p>
          <Button onClick={handleRetry} variant="outline">
            {t('retry')}
          </Button>
        </div>
      );
    }

    if (chats.length === 0) {
      return <Empty message={t('empty')} />;
    }

    return (
      <ul className="flex flex-col gap-3">
        {chats.map((chat) => (
          <li key={chat.id}>
            <Card className="hover:border-primary/60 p-0 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/chat/${chat.id}`}
                      className="hover:text-primary text-base font-medium transition-colors hover:underline"
                    >
                      {chat.title?.trim() || t('untitled')}
                    </Link>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span>
                        {chat.createdAt
                          ? formatRelativeTime(chat.createdAt, { locale })
                          : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 text-left sm:items-end sm:text-right">
                    <div className="flex flex-wrap items-center gap-2">
                      {chat.model && (
                        <Badge variant="outline">{chat.model}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="bg-background sticky top-0 z-10 flex w-full items-center gap-2 px-4 py-3">
        <SidebarTrigger className="size-7" />
        <div className="flex-1" />
        <LocaleSelector />
      </header>
      <div className="mx-auto flex w-full flex-1 flex-col px-4 py-6 md:max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">{t('description')}</p>
          </div>
        </div>
        <div className="flex-1">{renderContent()}</div>
        <div className="pt-6">
          <Pagination total={total} page={page} limit={limit} url={pathname} />
        </div>
      </div>
    </div>
  );
}

function getCurrentSearchParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}
