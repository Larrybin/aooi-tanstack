import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCalculatorHeaderFooter } from './401k-calculator-shell';

const copy = {
  skipToCalculator: 'Skip to calculator',
  formula: 'Formula',
  howTo: 'How to use',
  faq: 'FAQ',
  footerDescription: 'Retirement projection calculator.',
  productGroup: 'Product',
  tool: 'Calculator',
  trustGroup: 'Trust',
  privacyPolicy: 'Privacy policy',
  termsOfService: 'Terms of service',
  copyrightSuffix: 'All rights reserved.',
};

test('section navigation points back to the calculator home', () => {
  const { header } = buildCalculatorHeaderFooter(
    {
      appName: '401k Calculator',
      appLogo: '/logo.png',
    },
    copy
  );

  assert.deepEqual(
    header.nav?.items?.map((item) => item.url),
    ['/#formula', '/#guide', '/#faq']
  );
});

test('footer shows legal links once in the Trust group', () => {
  const { footer } = buildCalculatorHeaderFooter(
    {
      appName: '401k Calculator',
      appLogo: '/logo.png',
    },
    copy
  );

  assert.deepEqual(
    footer.nav?.items?.find((item) => item.title === 'Trust')?.children,
    [
      { title: 'Privacy policy', url: '/privacy-policy' },
      { title: 'Terms of service', url: '/terms-of-service' },
    ]
  );
  assert.equal(footer.agreement, undefined);
});
