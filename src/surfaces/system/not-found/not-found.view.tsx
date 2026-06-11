import { site } from '@/site';
import { Link, type NotFoundRouteProps } from '@tanstack/react-router';

import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Button } from '@/shared/components/ui/button';
import { getTanStackNotFoundCopy } from '@/shared/i18n/tanstack-paraglide';

export function NotFoundSurfaceView(props: NotFoundRouteProps) {
  const copy = getTanStackNotFoundCopy(getNotFoundLocale(props.data));

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      {/* TanStack surface: do not import next/image here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
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

function getNotFoundLocale(data: unknown) {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }

  const locale = (data as { locale?: unknown }).locale;
  return typeof locale === 'string' ? locale : undefined;
}
