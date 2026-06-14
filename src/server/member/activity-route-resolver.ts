import {
  listMemberAiTasksQuery,
  type MemberAiTaskRow,
} from '@/domains/ai/application/member-ai-tasks.query';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import {
  listMemberChatsQuery,
  type MemberChatRow,
} from '@/domains/chat/application/member-chats.query';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { readPublicUiConfigFresh } from '@/domains/settings/application/settings-runtime.query';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type {
  ActivityAction,
  ActivityAiTaskResult,
  ActivityNavItem,
  ActivityRouteData,
  ActivityRouteKind,
  ActivityShellData,
  ActivityTableColumn,
  ActivityTableRow,
} from '@/surfaces/member/activity/activity.types';

import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { formatYmd } from '@/shared/lib/date/format-ymd';
import { safeJsonParse } from '@/shared/lib/json';
import { buildCanonicalUrl, buildSeoHead } from '@/shared/seo/canonical';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import {
  loadActivityRouteMessages,
  type ActivityRouteMessages,
} from './activity-route-messages';

type ActivityRouteInput = {
  locale: unknown;
  kind: ActivityRouteKind;
  search?: unknown;
};

type ActivityQuery = {
  page: number;
  pageSize: number;
  type: string | null;
};

type ActivityAiTasksDeps = Parameters<typeof listMemberAiTasksQuery>[1];
type ActivityChatsDeps = Parameters<typeof listMemberChatsQuery>[1];

type ActivityRouteResolverDeps = {
  readPublicUiConfig?: () => Promise<PublicUiConfig>;
  readSignedInUserIdentity?: () => Promise<AuthSessionUserIdentity | null>;
  aiTasksDeps?: ActivityAiTasksDeps;
  chatsDeps?: ActivityChatsDeps;
};

const canonicalPathByKind: Record<
  ActivityRouteKind,
  ActivityRouteData['canonicalPath']
> = {
  'ai-tasks': '/activity/ai-tasks',
  chats: '/activity/chats',
  feedbacks: '/activity/feedbacks',
};
const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;
const refreshableStatuses = new Set(['pending', 'processing']);

export async function resolveActivityRouteData(
  input: ActivityRouteInput,
  deps: ActivityRouteResolverDeps = {}
): Promise<ActivityRouteData | null> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  if (!locale) {
    return null;
  }

  const publicUiConfig = await (
    deps.readPublicUiConfig ?? readPublicUiConfigFresh
  )();
  if (!isAiEnabled(publicUiConfig)) {
    return null;
  }

  const messages = await loadActivityRouteMessages(locale);
  const query = parseActivityQuery(input.search);
  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();
  const baseData = buildBaseActivityData({
    locale,
    kind: input.kind,
    messages,
    signedIn: Boolean(signedInUser),
  });

  if (!signedInUser) {
    return serializeRouteData(baseData);
  }

  if (input.kind === 'ai-tasks') {
    const { rows, total } = await listMemberAiTasksQuery(
      {
        userId: signedInUser.id,
        page: query.page,
        limit: query.pageSize,
        mediaType: query.type ?? undefined,
      },
      deps.aiTasksDeps
    );

    return serializeRouteData({
      ...baseData,
      page: {
        ...baseData.page,
        tabs: buildAiTaskTabs(messages, locale, query.type),
        rows: rows.map((row) => buildAiTaskRow(row, messages, locale)),
        pagination: buildPagination({
          canonicalPath: canonicalPathByKind[input.kind],
          locale,
          page: query.page,
          pageSize: query.pageSize,
          total,
          extraQuery: query.type ? { type: query.type } : {},
        }),
      },
    });
  }

  if (input.kind === 'chats') {
    const { rows, total } = await listMemberChatsQuery(
      {
        userId: signedInUser.id,
        page: query.page,
        limit: query.pageSize,
      },
      deps.chatsDeps
    );

    return serializeRouteData({
      ...baseData,
      page: {
        ...baseData.page,
        rows: rows.map((row) => buildChatRow(row, messages)),
        pagination: buildPagination({
          canonicalPath: canonicalPathByKind[input.kind],
          locale,
          page: query.page,
          pageSize: query.pageSize,
          total,
        }),
      },
    });
  }

  return serializeRouteData(baseData);
}

async function readCurrentSignedInUserIdentity() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return getSignedInUserIdentityFromRequest(getRequest());
}

function buildBaseActivityData({
  locale,
  kind,
  messages,
  signedIn,
}: {
  locale: string;
  kind: ActivityRouteKind;
  messages: ActivityRouteMessages;
  signedIn: boolean;
}): ActivityRouteData {
  const pageCopy = getPageCopy(messages, kind);
  const title = readString(
    getObject(pageCopy.list).title,
    fallbackTitleForKind(kind)
  );

  return {
    locale,
    canonicalPath: canonicalPathByKind[kind],
    head: buildActivityHead(messages, locale, kind, title),
    shell: buildActivityShellData(messages, locale, canonicalPathByKind[kind]),
    viewer: {
      signedIn,
    },
    page: {
      kind,
      title,
      noAuthMessage: readString(
        getObject(pageCopy.errors).no_auth,
        'Please sign in to continue'
      ),
      emptyMessage: readString(
        getObject(pageCopy.list).empty_message,
        fallbackEmptyMessageForKind(kind)
      ),
      tabs: [],
      columns: buildColumns(kind, pageCopy),
      rows: [],
      buttons: [],
      pagination: {
        total: 0,
        page: defaultPage,
        pageSize: defaultPageSize,
        previousHref: null,
        nextHref: null,
      },
    },
  };
}

function getPageCopy(messages: ActivityRouteMessages, kind: ActivityRouteKind) {
  if (kind === 'chats') {
    return messages.chats;
  }

  if (kind === 'feedbacks') {
    return {};
  }

  return messages.aiTasks;
}

function buildActivityHead(
  messages: ActivityRouteMessages,
  locale: string,
  kind: ActivityRouteKind,
  title: string
) {
  const shellTitle = readString(getObject(messages.sidebar).title, 'Activity');
  const head = buildSeoHead({
    title: `${title} - ${shellTitle} - ${site.brand.appName}`,
    description: title,
    canonical: buildCanonicalUrl(canonicalPathByKind[kind], locale),
    locale,
    siteName: site.brand.appName,
  });

  return {
    ...head,
    meta: [
      ...(head.meta ?? []),
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  };
}

const migratedActivityPaths = [
  '/activity/ai-tasks',
  '/activity/chats',
  '/activity/feedbacks',
] as const;

function buildActivityShellData(
  messages: ActivityRouteMessages,
  locale: string,
  activePath: ActivityRouteData['canonicalPath']
): ActivityShellData {
  const sidebar = getObject(messages.sidebar);
  const sidebarItems = Array.isArray(getObject(sidebar.nav).items)
    ? (getObject(sidebar.nav).items as Array<Record<string, unknown>>)
    : [];
  const topNavItems = Array.isArray(getObject(sidebar.top_nav).items)
    ? (getObject(sidebar.top_nav).items as Array<Record<string, unknown>>)
    : [];

  return {
    title: readString(sidebar.title, 'Activity'),
    nav: {
      items: migratedActivityPaths.map((path) => {
        const item = sidebarItems.find((entry) => entry.url === path) ?? {};
        return {
          title: readString(item.title, fallbackTitleForPath(path)),
          url: localePath(path, locale),
          icon: readOptionalString(item.icon),
          active: path === activePath,
        };
      }),
    },
    topNav: {
      items: topNavItems.map((item) => ({
        title: readString(item.title, 'Activity'),
        url: localePath(readString(item.url, '/activity'), locale),
        icon: readOptionalString(item.icon),
        active: item.url === '/activity',
      })),
    },
  };
}

function buildColumns(
  kind: ActivityRouteKind,
  pageCopy: Record<string, unknown>
): ActivityTableColumn[] {
  const fields = getObject(pageCopy.fields);
  if (kind === 'chats') {
    return [
      { key: 'title', title: readString(fields.title, 'Title') },
      { key: 'model', title: readString(fields.model, 'Model') },
      { key: 'provider', title: readString(fields.provider, 'Provider') },
      { key: 'createdAt', title: readString(fields.created_at, 'Created At') },
      { key: 'action', title: readString(fields.action, 'Action') },
    ];
  }

  if (kind === 'feedbacks') {
    return [];
  }

  return [
    { key: 'prompt', title: readString(fields.prompt, 'Prompt') },
    { key: 'mediaType', title: readString(fields.media_type, 'Media Type') },
    { key: 'provider', title: readString(fields.provider, 'Provider') },
    { key: 'model', title: readString(fields.model, 'Model') },
    { key: 'status', title: readString(fields.status, 'Status') },
    {
      key: 'costCredits',
      title: readString(fields.cost_credits, 'Cost Credits'),
    },
    { key: 'result', title: readString(fields.result, 'Result') },
    { key: 'createdAt', title: readString(fields.created_at, 'Created At') },
    { key: 'action', title: readString(fields.action, 'Action') },
  ];
}

function buildAiTaskTabs(
  messages: ActivityRouteMessages,
  locale: string,
  activeType: string | null
): ActivityNavItem[] {
  const tabs = getObject(getObject(getObject(messages.aiTasks).list).tabs);
  const types = ['', 'music', 'image', 'video', 'audio', 'text'];

  return types.map((type) => {
    const titleKey = type || 'all';
    const path = '/activity/ai-tasks';
    const url = type ? `${path}?type=${encodeURIComponent(type)}` : path;
    return {
      title: readString(tabs[titleKey], fallbackTitleForTab(titleKey)),
      url: localePath(url, locale),
      active: !type ? !activeType || activeType === 'all' : activeType === type,
    };
  });
}

function buildAiTaskRow(
  row: MemberAiTaskRow,
  messages: ActivityRouteMessages,
  locale: string
): ActivityTableRow {
  const buttons = getObject(
    getObject(getObject(messages.aiTasks).list).buttons
  );
  const actions: ActivityAction[] = [];
  const status = row.status ?? '';

  if (refreshableStatuses.has(status)) {
    actions.push({
      title: readString(buttons.refresh, 'Refresh Task'),
      url: localePath(`/activity/ai-tasks/${row.id}/refresh`, locale),
    });
  }

  return {
    id: row.id,
    values: {
      prompt: row.prompt ?? '',
      mediaType: row.mediaType ?? '',
      provider: row.provider ?? '',
      model: row.model ?? '',
      status,
      costCredits:
        row.costCredits === null || row.costCredits === undefined
          ? ''
          : String(row.costCredits),
      createdAt: formatYmd(row.createdAt),
    },
    result: parseAiTaskResult(row.taskInfo),
    actions,
  };
}

function parseAiTaskResult(
  taskInfo: string | null | undefined
): ActivityAiTaskResult | undefined {
  if (!taskInfo) {
    return undefined;
  }

  const parsed = safeJsonParse<Record<string, unknown>>(taskInfo);
  if (!parsed) {
    return undefined;
  }

  const errorMessage =
    typeof parsed.errorMessage === 'string' ? parsed.errorMessage : '';
  if (errorMessage) {
    return { kind: 'error', message: errorMessage };
  }

  const songs = Array.isArray(parsed.songs)
    ? parsed.songs
        .filter(
          (song): song is { id?: unknown; audioUrl: string; title?: unknown } =>
            Boolean(song) &&
            typeof song === 'object' &&
            typeof (song as { audioUrl?: unknown }).audioUrl === 'string'
        )
        .map((song, index) => ({
          id: typeof song.id === 'string' ? song.id : `song-${index}`,
          audioUrl: song.audioUrl,
          title: typeof song.title === 'string' ? song.title : undefined,
        }))
    : [];
  if (songs.length > 0) {
    return { kind: 'songs', songs };
  }

  const images = Array.isArray(parsed.images)
    ? parsed.images
        .filter(
          (image): image is { imageUrl: string } =>
            Boolean(image) &&
            typeof image === 'object' &&
            typeof (image as { imageUrl?: unknown }).imageUrl === 'string'
        )
        .map((image) => ({ imageUrl: image.imageUrl }))
    : [];
  if (images.length > 0) {
    return { kind: 'images', images };
  }

  return undefined;
}

function buildChatRow(
  row: MemberChatRow,
  _messages: ActivityRouteMessages
): ActivityTableRow {
  return {
    id: row.id,
    values: {
      title: typeof row.title === 'string' ? row.title : '',
      model: typeof row.model === 'string' ? row.model : '',
      provider: typeof row.provider === 'string' ? row.provider : '',
      createdAt: formatYmd(row.createdAt),
    },
    actions: [],
  };
}

function buildPagination({
  canonicalPath,
  locale,
  page,
  pageSize,
  total,
  extraQuery = {},
}: {
  canonicalPath: ActivityRouteData['canonicalPath'];
  locale: string;
  page: number;
  pageSize: number;
  total: number;
  extraQuery?: Record<string, string>;
}) {
  return {
    total,
    page,
    pageSize,
    previousHref:
      page > 1
        ? buildPageHref(canonicalPath, locale, page - 1, pageSize, extraQuery)
        : null,
    nextHref:
      page * pageSize < total
        ? buildPageHref(canonicalPath, locale, page + 1, pageSize, extraQuery)
        : null,
  };
}

function buildPageHref(
  path: ActivityRouteData['canonicalPath'],
  locale: string,
  page: number,
  pageSize: number,
  extraQuery: Record<string, string>
) {
  const params = new URLSearchParams({
    ...extraQuery,
    page: String(page),
    pageSize: String(pageSize),
  });

  return `${localePath(path, locale)}?${params.toString()}`;
}

function parseActivityQuery(search: unknown): ActivityQuery {
  const params = getSearchValues(search);

  return {
    page: normalizePositiveInteger(params.page, defaultPage),
    pageSize: Math.min(
      normalizePositiveInteger(params.pageSize, defaultPageSize),
      maxPageSize
    ),
    type: normalizeType(params.type),
  };
}

function getSearchValues(search: unknown) {
  if (typeof search === 'string') {
    return getSearchParamsValues(
      new URLSearchParams(search.replace(/^\?/, ''))
    );
  }

  if (search instanceof URLSearchParams) {
    return getSearchParamsValues(search);
  }

  if (typeof search === 'object' && search !== null && !Array.isArray(search)) {
    const record = search as Record<string, unknown>;
    return {
      page: readSearchObjectValue(record.page),
      pageSize: readSearchObjectValue(record.pageSize),
      type: readSearchObjectValue(record.type),
    };
  }

  return {
    page: null,
    pageSize: null,
    type: null,
  };
}

function getSearchParamsValues(params: URLSearchParams) {
  return {
    page: params.get('page'),
    pageSize: params.get('pageSize'),
    type: params.get('type'),
  };
}

function readSearchObjectValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return readSearchObjectValue(value[0]);
  }

  return null;
}

function normalizePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeType(value: string | null) {
  if (!value || value === 'all') {
    return null;
  }

  return value;
}

function fallbackTitleForPath(path: (typeof migratedActivityPaths)[number]) {
  if (path === '/activity/chats') {
    return 'AI Chats';
  }

  if (path === '/activity/feedbacks') {
    return 'Feedbacks';
  }

  return 'AI Tasks';
}

function fallbackTitleForKind(kind: ActivityRouteKind) {
  if (kind === 'chats') {
    return 'AI Chats';
  }

  if (kind === 'feedbacks') {
    return 'Feedbacks';
  }

  return 'AI Tasks';
}

function fallbackEmptyMessageForKind(kind: ActivityRouteKind) {
  if (kind === 'chats') {
    return 'No chats found';
  }

  if (kind === 'feedbacks') {
    return 'No feedbacks found';
  }

  return 'No tasks found';
}

function fallbackTitleForTab(tab: string) {
  return tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1);
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function serializeRouteData(data: unknown) {
  return JSON.parse(JSON.stringify(data)) as ActivityRouteData;
}
