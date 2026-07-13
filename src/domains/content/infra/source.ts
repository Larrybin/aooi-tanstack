import { createElement } from 'react';
import { create, docs } from '@/content-source';
import type { I18nConfig } from 'fumadocs-core/i18n';
import { loader, type Source, type SourceConfig } from 'fumadocs-core/source';
import { icons } from 'lucide-react';

export const docsI18n: I18nConfig = {
  defaultLanguage: 'en',
  languages: ['en', 'zh'],
};

const iconHelper = (icon: string | undefined) => {
  if (!icon) {
    // You may set a default icon
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(icons, icon)) {
    return;
  }

  return createElement(icons[icon as keyof typeof icons]);
};

export const toLoaderSource = <Config extends SourceConfig>(
  input: Source<Config>
): Source<Config> => {
  if (!input || typeof input !== 'object' || !('files' in input)) {
    return { files: [] } as Source<Config>;
  }

  const inputWithFiles = input as { files: unknown };
  const files =
    typeof inputWithFiles.files === 'function'
      ? (inputWithFiles.files as () => unknown)()
      : inputWithFiles.files;
  return { files } as Source<Config>;
};

export const docsLoaderSource = toLoaderSource(
  await create.sourceAsync(docs.doc, docs.meta)
);

export const docsSource = loader({
  baseUrl: '/docs',
  source: docsLoaderSource,
  i18n: docsI18n,
  icon: iconHelper,
});
