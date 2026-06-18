import { NotFoundSurfaceView } from '@/surfaces/system/not-found/not-found.view';
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useLocation,
} from '@tanstack/react-router';

import { defaultLocale, isRtlLocale } from '@/config/locale';
import { getLocaleFromPathname } from '@/shared/i18n/locale';
import { NativeLocaleProvider } from '@/shared/lib/i18n/native';

import appCss from '../styles/app.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  notFoundComponent: NotFoundSurfaceView,
  component: RootDocument,
});

function RootDocument() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const dir = isRtlLocale(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body>
        <NativeLocaleProvider locale={locale}>
          <Outlet />
        </NativeLocaleProvider>
        <Scripts />
      </body>
    </html>
  );
}
