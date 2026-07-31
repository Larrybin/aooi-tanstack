import { loadAiGeneratorRouteData } from '@/server/ai/ai-generator-route-data';
import { AiGeneratorRouteView } from '@/surfaces/landing/ai-generator/ai-generator.view';
import type { AiGeneratorRouteData } from '@/server/ai/ai-generator-route-resolver';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/ai-music-generator')({
  loader: async () => {
    const data = await loadAiGeneratorRouteData({
      data: { locale: defaultLocale, kind: 'music' },
    });
    if (!data) throw notFound();
    return data as AiGeneratorRouteData;
  },
  head: ({ loaderData }) => loaderData?.head ?? {},
  component: AiMusicGeneratorRoute,
});

function AiMusicGeneratorRoute() {
  const data = Route.useLoaderData();
  return <AiGeneratorRouteView data={data} />;
}
