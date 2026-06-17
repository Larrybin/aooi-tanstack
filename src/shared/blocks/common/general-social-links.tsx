'use client';

import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

import { Link } from '@/shared/blocks/common/navigation';
import { usePublicAppContext } from '@/shared/contexts/app';

import { SmartIcon } from './smart-icon';

export function GeneralSocialLinks({
  className = 'flex min-w-0 flex-wrap items-center gap-2',
  itemClassName = 'text-muted-foreground hover:text-primary bg-background block cursor-pointer rounded-full p-2 duration-150',
  iconClassName,
  iconSize = 20,
  uiConfig: uiConfigProp,
}: {
  className?: string;
  itemClassName?: string;
  iconClassName?: string;
  iconSize?: number;
  uiConfig?: PublicUiConfig;
}) {
  const { uiConfig: contextUiConfig } = usePublicAppContext();
  const resolvedUiConfig = uiConfigProp ?? contextUiConfig;

  if (!resolvedUiConfig.socialLinksEnabled) {
    return null;
  }

  if (resolvedUiConfig.socialLinks.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {resolvedUiConfig.socialLinks.map((item, index) => (
        <Link
          key={`${item.icon}-${item.url}-${index}`}
          href={item.url || ''}
          target={item.target || '_blank'}
          rel="noopener noreferrer"
          className={itemClassName}
        >
          {item.icon && (
            <SmartIcon
              name={item.icon as string}
              size={iconSize}
              className={iconClassName}
            />
          )}
        </Link>
      ))}
    </div>
  );
}
