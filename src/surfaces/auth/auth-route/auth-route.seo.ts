import type { AuthRouteData } from './auth-route.types';

export function getAuthRouteSurfaceHead(data: AuthRouteData | null) {
  return (
    data?.head ?? {
      meta: [{ name: 'robots', content: 'noindex,nofollow' }],
    }
  );
}
