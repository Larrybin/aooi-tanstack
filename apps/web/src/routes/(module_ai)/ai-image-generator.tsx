import { loadAiGeneratorRouteData } from '@/server/ai/ai-generator-route-data';
import type { AiGeneratorRouteData } from '@/server/ai/ai-generator-route-resolver';
import { AiGeneratorRouteView } from '@/surfaces/landing/ai-generator/ai-generator.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/ai-image-generator')({
  loader: async () => {
    const data = await loadAiGeneratorRouteData({
      data: { locale: defaultLocale, kind: 'image' },
    });
    if (!data) throw notFound();
    return data as AiGeneratorRouteData;
  },
  head: ({ loaderData }) => loaderData?.head ?? {},
  component: AiImageGeneratorRoute,
});

function AiImageGeneratorRoute() {
  const data = Route.useLoaderData();
  return <AiGeneratorRouteView data={data} />;
}
