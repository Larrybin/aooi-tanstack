import type { TanStackHead } from '@/shared/seo/canonical';

export type ActivityRefreshRouteData = {
  locale: string;
  canonicalPath: `/activity/ai-tasks/${string}/refresh`;
  redirectTo: string | null;
  head: TanStackHead;
  page: {
    title: string;
    message: string;
    backHref: string;
    backLabel: string;
  };
};
