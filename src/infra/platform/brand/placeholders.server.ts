
import { site } from '@/site';

import { getDomainFromOrigin } from '@/shared/lib/support-email';

export type BrandPlaceholderValues = {
  appName: string;
  appUrl: string;
  appLogo: string;
  appFavicon: string;
  appOgImage: string;
  domain: string;
  supportEmail: string;
};

export function buildBrandPlaceholderValues(): BrandPlaceholderValues {
  const appUrl = site.brand.appUrl;
  const appName = site.brand.appName;
  const appLogo = site.brand.logo;
  const appFavicon = site.brand.favicon;
  const appOgImage = site.brand.previewImage;
  const domain = getDomainFromOrigin(appUrl);
  const supportEmail = site.brand.supportEmail;

  return {
    appName,
    appUrl,
    appLogo,
    appFavicon,
    appOgImage,
    domain,
    supportEmail,
  };
}

export function replaceBrandPlaceholders(
  input: string,
  brand: BrandPlaceholderValues
): string {
  let output = input;

  if (brand.supportEmail) {
    output = output.replaceAll(
      'mailto:support@your-domain.com',
      `mailto:${brand.supportEmail}`
    );
    output = output.replaceAll('support@your-domain.com', brand.supportEmail);
  }

  if (brand.appUrl) {
    output = output.replaceAll('https://your-domain.com', brand.appUrl);
    output = output.replaceAll('http://your-domain.com', brand.appUrl);
  }

  if (brand.domain) {
    output = output.replaceAll('your-domain.com', brand.domain);
  }

  if (brand.appName) {
    output = output.replaceAll('YourAppName', brand.appName);
    output = output.replaceAll('Roller Rabbit', brand.appName);
  }

  return output;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function replaceBrandPlaceholdersDeep<T>(
  value: T,
  brand: BrandPlaceholderValues
): T {
  if (typeof value === 'string') {
    return replaceBrandPlaceholders(value, brand) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceBrandPlaceholdersDeep(item, brand)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        replaceBrandPlaceholdersDeep(entryValue, brand),
      ])
    ) as T;
  }

  return value;
}
