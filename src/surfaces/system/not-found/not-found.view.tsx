import { site } from '@/site';
import { Link } from '@tanstack/react-router';

import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Button } from '@/shared/components/ui/button';

export function NotFoundSurfaceView() {
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
      <h1 className="text-2xl font-normal">Page not found</h1>
      <Button asChild>
        <Link to="/" className="mt-4">
          <SmartIcon name="ArrowLeft" />
          <span>Back to Home</span>
        </Link>
      </Button>
    </div>
  );
}
