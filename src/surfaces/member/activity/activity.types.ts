import type { TanStackHead } from '@/shared/seo/canonical';

export type ActivityRouteKind = 'ai-tasks' | 'chats' | 'feedbacks';

export type ActivityNavItem = {
  title: string;
  url: string;
  icon?: string;
  active?: boolean;
};

export type ActivityShellData = {
  title: string;
  nav: {
    items: ActivityNavItem[];
  };
  topNav: {
    items: ActivityNavItem[];
  };
};

export type ActivityTableColumn = {
  key: string;
  title: string;
};

export type ActivityAction = {
  title: string;
  url: string;
  target?: string;
};

export type ActivityAiTaskResult =
  | {
      kind: 'error';
      message: string;
    }
  | {
      kind: 'songs';
      songs: Array<{
        id: string;
        audioUrl: string;
        title?: string;
      }>;
    }
  | {
      kind: 'images';
      images: Array<{
        imageUrl: string;
      }>;
    };

export type ActivityTableRow = {
  id: string;
  values: Record<string, string>;
  result?: ActivityAiTaskResult;
  actions: ActivityAction[];
};

export type ActivityRouteData = {
  locale: string;
  canonicalPath:
    | '/activity/ai-tasks'
    | '/activity/chats'
    | '/activity/feedbacks';
  head: TanStackHead;
  shell: ActivityShellData;
  viewer: {
    signedIn: boolean;
  };
  page: {
    kind: ActivityRouteKind;
    title: string;
    noAuthMessage: string;
    emptyMessage: string;
    tabs: ActivityNavItem[];
    columns: ActivityTableColumn[];
    rows: ActivityTableRow[];
    buttons: ActivityAction[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      previousHref: string | null;
      nextHref: string | null;
    };
  };
};
