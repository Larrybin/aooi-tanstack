import { createElement } from 'react';
import {
  normalizeDocsSlug,
  resolveDocsLocale,
} from '@/domains/content/domain/docs-route';
import {
  docsI18n,
  docsLoaderSource,
  docsSource,
} from '@/domains/content/infra/source';
import type { I18nConfig } from 'fumadocs-core/i18n';
import { loader } from 'fumadocs-core/source';
import { icons } from 'lucide-react';

export { docsI18n, normalizeDocsSlug, resolveDocsLocale };
export { docsSource };

function iconHelper(iconName: string | undefined) {
  if (!iconName) return;
  if (!Object.prototype.hasOwnProperty.call(icons, iconName)) {
    return;
  }

  return createElement(icons[iconName as keyof typeof icons]);
}

export function readDocsPage(params: { slug?: string[]; locale?: string }) {
  const locale = resolveDocsLocale(params.locale);
  return docsSource.getPage(normalizeDocsSlug(params.slug), locale);
}

export function readDocsPageTree(locale?: string) {
  return docsSource.pageTree[resolveDocsLocale(locale)];
}

export function listDocsStaticParams() {
  return docsSource.generateParams('slug', 'locale');
}

export function createDocsSearchSource() {
  const searchI18n: I18nConfig = {
    defaultLanguage: 'en',
    languages: ['en'],
  };

  return loader({
    baseUrl: '/docs',
    source: docsLoaderSource,
    i18n: searchI18n,
    icon: iconHelper,
  });
}
