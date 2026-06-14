import type { Button, NavItem } from '@/shared/types/blocks/common';

import { isAiEnabled } from '@/domains/ai/domain/enablement';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { getSite } from '@/infra/platform/site';

export function isLandingBlogEnabled(
  _publicConfig?: PublicUiConfig
) {
  return Boolean(getSite().capabilities.blog);
}

export function isLandingDocsEnabled(
  _publicConfig?: PublicUiConfig
) {
  return Boolean(getSite().capabilities.docs);
}

export function isLandingAiEnabled(
  publicConfig: PublicUiConfig | undefined
) {
  return isAiEnabled(publicConfig);
}

export function isUnavailableTanStackPublicUrl(url: string) {
  const normalizedUrl =
    url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url;

  return (
    normalizedUrl === '/docs' ||
    normalizedUrl.startsWith('/docs/') ||
    normalizedUrl === '/my-images' ||
    normalizedUrl.startsWith('/my-images/')
  );
}

function shouldHideLandingUrl(
  url: string | undefined,
  publicConfig: PublicUiConfig
) {
  if (!url) return false;

  const normalizedUrl =
    url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url;

  const isAiRoute =
    normalizedUrl === '/chat' ||
    normalizedUrl.startsWith('/chat/') ||
    normalizedUrl.startsWith('/ai-') ||
    normalizedUrl === '/activity' ||
    normalizedUrl.startsWith('/activity/') ||
    normalizedUrl === '/admin/ai-tasks' ||
    normalizedUrl.startsWith('/admin/ai-tasks/') ||
    normalizedUrl === '/admin/chats' ||
    normalizedUrl.startsWith('/admin/chats/');

  if (isAiRoute) {
    return !isAiEnabled(publicConfig);
  }

  if (normalizedUrl === '/blog' || normalizedUrl.startsWith('/blog/')) {
    return !isLandingBlogEnabled(publicConfig);
  }

  if (normalizedUrl === '/docs' || normalizedUrl.startsWith('/docs/')) {
    return !isLandingDocsEnabled(publicConfig);
  }

  return false;
}

export function filterLandingNavItems(
  items: readonly NavItem[] | undefined,
  publicConfig: PublicUiConfig | undefined
): NavItem[] {
  if (!items?.length) return [];

  const nextPublicConfig =
    publicConfig ??
    ({
      aiEnabled: false,
      localeSwitcherEnabled: false,
      socialLinksEnabled: false,
      socialLinksJson: '',
      socialLinks: [],
      affiliate: {
        affonsoEnabled: false,
        promotekitEnabled: false,
      },
    } satisfies PublicUiConfig);

  const filtered: NavItem[] = [];

  for (const item of items) {
    const children = item.children?.length
      ? filterLandingNavItems(item.children, nextPublicConfig)
      : [];

    const url = item.url ? item.url.trim() : '';
    const hideUrl = shouldHideLandingUrl(url || undefined, nextPublicConfig);

    const hasVisibleChildren = children.length > 0;
    const hasVisibleUrl = Boolean(url) && !hideUrl;

    if (!hasVisibleChildren && !hasVisibleUrl) {
      continue;
    }

    filtered.push({
      ...item,
      ...(hasVisibleChildren ? { children } : {}),
      url: hasVisibleUrl ? url : '',
    });
  }

  return filtered;
}

export function filterLandingButtons(
  buttons: readonly Button[] | undefined,
  publicConfig: PublicUiConfig | undefined
): Button[] {
  if (!buttons?.length) return [];

  const nextPublicConfig =
    publicConfig ??
    ({
      aiEnabled: false,
      localeSwitcherEnabled: false,
      socialLinksEnabled: false,
      socialLinksJson: '',
      socialLinks: [],
      affiliate: {
        affonsoEnabled: false,
        promotekitEnabled: false,
      },
    } satisfies PublicUiConfig);

  return buttons.filter((button) => {
    const url = button.url ? button.url.trim() : '';
    return !shouldHideLandingUrl(url || undefined, nextPublicConfig);
  });
}

export function filterTanStackLandingButtons(
  buttons: readonly Button[] | undefined,
  publicConfig: PublicUiConfig | undefined
): Button[] {
  return filterLandingButtons(buttons, publicConfig).filter((button) => {
    const url = button.url ? button.url.trim() : '';
    return !url || !isUnavailableTanStackPublicUrl(url);
  });
}
