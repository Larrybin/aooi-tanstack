import { loadAiGeneratorRouteData } from '@/server/ai/ai-generator-route-data';
import type { AiGeneratorRouteData } from '@/server/ai/ai-generator-route-resolver';
import { AiDemoRouteView } from '@/surfaces/landing/ai-generator/ai-generator.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/ai-video-generator')({
  loader: async ({ params }) => {
    const data = await loadAiGeneratorRouteData({
      data: { locale: params.locale, kind: 'video' },
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
    return data as AiGeneratorRouteData;
  },
  head: ({ loaderData }) => loaderData?.head ?? {},
  component: LocalizedAiVideoGeneratorRoute,
});

function LocalizedAiVideoGeneratorRoute() {
  const data = Route.useLoaderData();
  return <AiDemoRouteView data={data} />;
}
