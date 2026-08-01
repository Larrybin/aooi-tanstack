import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import { buildCanonicalUrl, buildSeoHead } from './canonical';

test('buildSeoHead includes absolute social preview images', () => {
  const head = buildSeoHead({
    title: 'Example title',
    description: 'Example description',
    canonical: buildCanonicalUrl('/'),
    locale: site.i18n.defaultLocale,
    siteName: site.brand.appName,
  });
  const previewImage = buildCanonicalUrl(site.brand.previewImage);

  assert.deepEqual(
    head.meta?.find((meta) => meta.property === 'og:image'),
    {
      property: 'og:image',
      content: previewImage,
    }
  );
  assert.deepEqual(
    head.meta?.find((meta) => meta.name === 'twitter:image'),
    {
      name: 'twitter:image',
      content: previewImage,
    }
  );
  assert.deepEqual(
    head.meta?.find((meta) => meta.property === 'og:image:alt'),
    {
      property: 'og:image:alt',
      content: `${site.brand.appName} preview`,
    }
  );
  assert.deepEqual(
    head.meta?.find((meta) => meta.name === 'twitter:image:alt'),
    {
      name: 'twitter:image:alt',
      content: `${site.brand.appName} preview`,
    }
  );
});
