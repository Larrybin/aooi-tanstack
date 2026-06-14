import type { ActivityRouteKind } from '@/surfaces/member/activity/activity.types';
import { createServerFn } from '@tanstack/react-start';

type ActivityRouteInput = {
  locale: string;
  kind: ActivityRouteKind;
  search?: unknown;
};

const activityRouteKinds = new Set<ActivityRouteKind>([
  'ai-tasks',
  'chats',
  'feedbacks',
]);

export const loadActivityRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): ActivityRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const kind = input.kind;

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      kind:
        typeof kind === 'string' &&
        activityRouteKinds.has(kind as ActivityRouteKind)
          ? (kind as ActivityRouteKind)
          : 'ai-tasks',
      search: input.search,
    };
  })
  .handler(async ({ data }) => {
    const { resolveActivityRouteData } =
      await import('./activity-route-resolver');
    return resolveActivityRouteData(data);
  });
