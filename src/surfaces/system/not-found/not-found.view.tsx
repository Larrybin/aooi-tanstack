import { site } from '@/site';
import {
  Link,
  useLocation,
  type NotFoundRouteProps,
} from '@tanstack/react-router';

import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Button } from '@/shared/components/ui/button';
import { getTanStackNotFoundCopy } from '@/shared/i18n/tanstack-paraglide';

import { resolveNotFoundLocale } from './not-found.locale';

export function NotFoundSurfaceView(props: NotFoundRouteProps) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const copy = getTanStackNotFoundCopy(
    resolveNotFoundLocale(props.data, pathname)
  );

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <img
        src={site.brand.logo}
        alt="Logo"
        width={80}
        height={80}
        className="h-20 w-20 object-contain"
      />
      <h1 className="text-2xl font-normal">{copy.title}</h1>
      <Button asChild>
        <Link to="/" className="mt-4">
          <SmartIcon name="ArrowLeft" />
          <span>{copy.backHome}</span>
        </Link>
      </Button>
    </div>
  );
}
