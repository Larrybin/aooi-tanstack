import { loadMyImagesRouteData } from '@/server/remover/my-images-route-data';
import { MyImagesRouteView } from '@/surfaces/remover/my-images-route.view';
import { createFileRoute } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/my-images')({
  loader: async () =>
    loadMyImagesRouteData({ data: { locale: defaultLocale } }),
  component: MyImagesRoute,
});

function MyImagesRoute() {
  return <MyImagesRouteView data={Route.useLoaderData()} />;
}
