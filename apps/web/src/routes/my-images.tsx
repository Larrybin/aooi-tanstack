import { loadMyImagesRouteData } from '@/server/remover/my-images-route-data';
import { site } from '@/site';
import { MyImagesRouteView } from '@/surfaces/remover/my-images-route.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/my-images')({
  loader: async () => {
    if ((site.key as string) !== 'ai-remover') {
      throw notFound();
    }

    return loadMyImagesRouteData({ data: { locale: defaultLocale } });
  },
  component: MyImagesRoute,
});

function MyImagesRoute() {
  return <MyImagesRouteView data={Route.useLoaderData()} />;
}
