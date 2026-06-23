import { site } from '@/site';
import { MyImagesRouteView } from '@/surfaces/remover/my-images-route.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/my-images')({
  loader: async ({ params }) => {
    if ((site.key as string) !== 'ai-remover') {
      throw notFound({ data: { locale: params.locale } });
    }

    const { loadMyImagesRouteData } =
      await import('@/server/remover/my-images-route-data');
    const data = await loadMyImagesRouteData({
      data: { locale: params.locale },
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }

    return data;
  },
  component: MyImagesRoute,
});

function MyImagesRoute() {
  return <MyImagesRouteView data={Route.useLoaderData()} />;
}
