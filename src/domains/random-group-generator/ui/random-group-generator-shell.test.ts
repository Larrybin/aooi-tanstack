import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRandomGroupGeneratorHeaderFooter } from './random-group-generator-shell';

const copy = {
  generator: 'Generator',
  howTo: 'How to use',
  faq: 'FAQ',
  footerDescription: 'Create balanced random groups in your browser.',
  productGroup: 'Product',
  tool: 'Random Group Generator',
  trustGroup: 'Trust',
  privacyPolicy: 'Privacy Policy',
  termsOfService: 'Terms of Service',
  copyrightSuffix: 'All rights reserved.',
};

test('product section navigation always returns to the home page', () => {
  const { header } = buildRandomGroupGeneratorHeaderFooter(
    {
      appName: 'Random Group Generator',
      appLogo: '/logo.svg',
    },
    copy
  );

  assert.deepEqual(
    header.nav?.items?.map((item) => item.url),
    ['/#generator', '/#how-to', '/#faq']
  );
});
