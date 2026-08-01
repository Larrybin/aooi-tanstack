import { readCurrentSiteConfig } from './site-config.ts';

export function getCurrentSite() {
  return readCurrentSiteConfig();
}

export function getCurrentSiteAppUrl() {
  return getCurrentSite().brand.appUrl;
}

export function getCurrentSiteOrigin() {
  return new URL(getCurrentSiteAppUrl()).origin;
}
