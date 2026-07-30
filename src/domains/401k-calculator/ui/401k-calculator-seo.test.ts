import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCalculatorStructuredData } from './401k-calculator-seo';

const copy = {
  metadata: {
    description: 'Projection <calculator>',
  },
  faq: {
    items: [
      {
        question: 'What is estimated?',
        answer: 'A hypothetical balance.',
      },
    ],
  },
};

test('buildCalculatorStructuredData returns application and FAQ JSON-LD', () => {
  const scripts = buildCalculatorStructuredData(
    copy,
    'https://401k-calculator.net/'
  );

  assert.equal(scripts.length, 3);
  assert.deepEqual(
    scripts.map((script) => script.type),
    ['application/ld+json', 'application/ld+json', 'application/ld+json']
  );

  const application = JSON.parse(scripts[0]?.children ?? '{}') as {
    '@type': string;
    url: string;
    offers: { price: string };
  };
  assert.equal(application['@type'], 'SoftwareApplication');
  assert.equal(application.url, 'https://401k-calculator.net/');
  assert.equal(application.offers.price, '0');

  const faq = JSON.parse(scripts[1]?.children ?? '{}') as {
    '@type': string;
    mainEntity: unknown[];
  };
  assert.equal(faq['@type'], 'FAQPage');
  assert.equal(faq.mainEntity.length, 1);
});

test('structured data escapes literal less-than characters', () => {
  const scripts = buildCalculatorStructuredData(
    copy,
    'https://401k-calculator.net/'
  );

  assert.equal(
    scripts.some((script) => script.children.includes('<')),
    false
  );
});
