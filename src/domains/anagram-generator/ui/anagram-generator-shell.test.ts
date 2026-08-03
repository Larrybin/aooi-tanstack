import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAnagramGeneratorHeaderFooter } from './anagram-generator-shell';

const copy = {
  generator: 'Generator',
  examples: 'Examples',
  howTo: 'How to use',
  limitations: 'Limitations',
  faq: 'FAQ',
  footerDescription: 'Create anagrams in your browser.',
  productGroup: 'Product',
  tool: 'Anagram Generator',
  trustGroup: 'Trust',
  privacyPolicy: 'Privacy Policy',
  termsOfService: 'Terms of Service',
  copyrightSuffix: 'All rights reserved.',
};

test('product section navigation always returns to the home page', () => {
  const { header } = buildAnagramGeneratorHeaderFooter(
    {
      appName: 'Anagram Generator',
      appLogo: '/logo.svg',
    },
    copy
  );

  assert.deepEqual(
    header.nav?.items?.map((item) => item.url),
    ['/#generator', '/#examples', '/#how-to', '/#limitations', '/#faq']
  );
});
