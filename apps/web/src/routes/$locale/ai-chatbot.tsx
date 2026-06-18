import { loadAiGeneratorRouteData } from '@/server/ai/ai-generator-route-data';
import type { AiGeneratorRouteData } from '@/server/ai/ai-generator-route-resolver';
import { AiChatbotRouteView } from '@/surfaces/landing/ai-generator/ai-generator.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/ai-chatbot')({
  loader: async ({ params }) => {
    const data = await loadAiGeneratorRouteData({
      data: { locale: params.locale, kind: 'chatbot' },
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
    return data as AiGeneratorRouteData;
  },
  head: ({ loaderData }) => loaderData?.head ?? {},
  component: LocalizedAiChatbotRoute,
});

function LocalizedAiChatbotRoute() {
  const data = Route.useLoaderData();
  return <AiChatbotRouteView data={data} />;
}
