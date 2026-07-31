import { loadAiGeneratorRouteData } from '@/server/ai/ai-generator-route-data';
import type { AiGeneratorRouteData } from '@/server/ai/ai-generator-route-resolver';
import { AiDemoRouteView } from '@/surfaces/landing/ai-generator/ai-generator.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/ai-audio-generator')({
  loader: async () => {
    const data = await loadAiGeneratorRouteData({
      data: { locale: defaultLocale, kind: 'audio' },
    });
    if (!data) throw notFound();
    return data as AiGeneratorRouteData;
  },
  head: ({ loaderData }) => loaderData?.head ?? {},
  component: AiAudioGeneratorRoute,
});

function AiAudioGeneratorRoute() {
  const data = Route.useLoaderData();
  return <AiDemoRouteView data={data} />;
}
