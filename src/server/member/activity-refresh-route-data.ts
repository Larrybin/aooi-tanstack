import { createServerFn } from '@tanstack/react-start';

type ActivityRefreshRouteInput = {
  locale: string;
  id: string;
};

export const loadActivityAiTaskRefreshRouteData = createServerFn({
  method: 'GET',
})
  .validator((data: unknown): ActivityRefreshRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      id: typeof input.id === 'string' ? input.id : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveActivityAiTaskRefreshRouteData } =
      await import('./activity-refresh-route-resolver');
    return resolveActivityAiTaskRefreshRouteData(data);
  });
