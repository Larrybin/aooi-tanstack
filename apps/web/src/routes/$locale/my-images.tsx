import { loadMyImagesRouteData } from '@/server/remover/my-images-route-data';
import { MyImagesRouteView } from '@/surfaces/remover/my-images-route.view';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/my-images')({
  loader: async ({ params }) =>
    loadMyImagesRouteData({ data: { locale: params.locale } }),
  component: MyImagesRoute,
});

function MyImagesRoute() {
  return <MyImagesRouteView data={Route.useLoaderData()} />;
}
