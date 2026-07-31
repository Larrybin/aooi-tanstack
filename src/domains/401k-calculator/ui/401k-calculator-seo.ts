import type { TanStackHead } from '@/shared/seo/canonical';

import type { CalculatorHomeCopy } from './401k-calculator-home-copy';

type StructuredDataCopy = Pick<CalculatorHomeCopy, 'metadata' | 'faq'>;
type HeadScript = NonNullable<TanStackHead['scripts']>[number];

export function buildCalculatorStructuredData(
  copy: StructuredDataCopy,
  canonical: string
): HeadScript[] {
  return [
    toJsonLdScript({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: '401k Calculator',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Any modern web browser',
      url: canonical,
      description: copy.metadata.description,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    }),
    toJsonLdScript({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: copy.faq.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    }),
    toJsonLdScript({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: canonical,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: '401k Calculator',
          item: canonical,
        },
      ],
    }),
  ];
}

function toJsonLdScript(value: unknown): HeadScript {
  return {
    type: 'application/ld+json',
    children: JSON.stringify(value).replaceAll('<', '\\u003c'),
  };
}
