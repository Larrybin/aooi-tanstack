import { createServerFn } from '@tanstack/react-start';

import type { AiGeneratorRouteInput } from './ai-generator-route-resolver';

export const loadAiGeneratorRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): AiGeneratorRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const kind =
      input.kind === 'music'
        ? 'music'
        : input.kind === 'chatbot'
          ? 'chatbot'
          : input.kind === 'audio'
            ? 'audio'
            : input.kind === 'video'
              ? 'video'
              : 'image';

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      kind,
    };
  })
  .handler(async ({ data }) => {
    const { resolveAiGeneratorRouteData } =
      await import('./ai-generator-route-resolver');
    return resolveAiGeneratorRouteData(data);
  });
