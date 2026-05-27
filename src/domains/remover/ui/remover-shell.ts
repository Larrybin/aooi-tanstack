import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

import type { RemoverHomeCopy } from './remover-home-copy';

export function buildRemoverHeaderFooter(
  brand: {
    appName: string;
    appLogo: string;
  },
  copy: RemoverHomeCopy['shell']
) {
  const header: HeaderType = {
    id: 'header',
    brand: {
      title: brand.appName,
      logo: {
        src: brand.appLogo,
        alt: brand.appName,
        width: 512,
        height: 512,
      },
      url: '/',
    },
    nav: {
      items: [
        {
          title: copy.pricing,
          url: '/pricing',
          icon: 'DollarSign',
        },
        {
          title: copy.myImages,
          url: '/my-images',
          icon: 'Images',
        },
      ],
    },
    buttons: [],
    user_nav: {
      show_name: true,
      show_credits: true,
      show_sign_out: true,
      items: [
        {
          title: copy.billing,
          url: '/settings/billing',
          icon: 'CreditCard',
        },
        {
          title: copy.myImages,
          url: '/my-images',
          icon: 'Images',
        },
      ],
    },
    show_sign: true,
    show_locale: false,
  };

  const footer: FooterType = {
    id: 'footer',
    brand: {
      title: brand.appName,
      description: copy.footerDescription,
      logo: {
        src: brand.appLogo,
        alt: brand.appName,
        width: 512,
        height: 512,
      },
      url: '/',
    },
    nav: {
      items: [
        {
          title: copy.productGroup,
          children: [
            { title: copy.tool, url: '/' },
            { title: copy.pricing, url: '/pricing' },
            { title: copy.myImages, url: '/my-images' },
          ],
        },
        {
          title: copy.trustGroup,
          children: [
            { title: copy.privacyPolicy, url: '/privacy-policy' },
            { title: copy.termsOfService, url: '/terms-of-service' },
          ],
        },
      ],
    },
    copyright: `© ${new Date().getFullYear()} ${brand.appName}. ${copy.copyrightSuffix}`,
    agreement: {
      items: [
        { title: copy.privacyPolicy, url: '/privacy-policy' },
        { title: copy.termsOfService, url: '/terms-of-service' },
      ],
    },
  };

  return { header, footer };
}
