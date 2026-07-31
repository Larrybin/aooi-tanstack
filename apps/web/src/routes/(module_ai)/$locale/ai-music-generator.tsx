import { loadAiGeneratorRouteData } from '@/server/ai/ai-generator-route-data';
import { AiGeneratorRouteView } from '@/surfaces/landing/ai-generator/ai-generator.view';
import type { AiGeneratorRouteData } from '@/server/ai/ai-generator-route-resolver';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/ai-music-generator')({
  loader: async ({ params }) => {
    const data = await loadAiGeneratorRouteData({
      data: { locale: params.locale, kind: 'music' },
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
    return data as AiGeneratorRouteData;
  },
  head: ({ loaderData }) => loaderData?.head ?? {},
  component: LocalizedAiMusicGeneratorRoute,
});

function LocalizedAiMusicGeneratorRoute() {
  const data = Route.useLoaderData();
  return <AiGeneratorRouteView data={data} />;
}
