import type { AuthRouteMode } from '@/surfaces/auth/auth-route/auth-route.types';
import { createServerFn } from '@tanstack/react-start';

type AuthRouteInput = {
  locale: string;
  mode: AuthRouteMode;
  search?: unknown;
};

const authRouteModes = new Set<AuthRouteMode>([
  'sign-in',
  'sign-up',
  'forgot-password',
  'reset-password',
  'no-permission',
]);

export const loadAuthRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): AuthRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const mode = input.mode;

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      mode:
        typeof mode === 'string' && authRouteModes.has(mode as AuthRouteMode)
          ? (mode as AuthRouteMode)
          : 'sign-in',
      search: input.search,
    };
  })
  .handler(async ({ data }) => {
    const { resolveAuthRouteData } = await import('./auth-route-resolver');
    return resolveAuthRouteData(data);
  });
