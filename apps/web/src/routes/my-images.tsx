import { site } from '@/site';
import { MyImagesRouteView } from '@/surfaces/remover/my-images-route.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/my-images')({
  loader: async () => {
    if ((site.key as string) !== 'ai-remover') {
      throw notFound();
    }

    const { loadMyImagesRouteData } =
      await import('@/server/remover/my-images-route-data');
    const data = await loadMyImagesRouteData({
      data: { locale: defaultLocale },
    });
    if (!data) {
      throw notFound();
    }

    return data;
  },
  component: MyImagesRoute,
});

function MyImagesRoute() {
  return <MyImagesRouteView data={Route.useLoaderData()} />;
}
