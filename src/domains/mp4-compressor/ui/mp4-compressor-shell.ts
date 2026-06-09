import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

import type { Mp4CompressorHomeCopy } from './mp4-compressor-home-copy';

export function buildMp4CompressorHeaderFooter(
  brand: {
    appName: string;
    appLogo: string;
  },
  copy: Mp4CompressorHomeCopy['shell']
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
        { title: copy.howTo, url: '#how-to', icon: 'ListChecks' },
        { title: copy.faq, url: '#faq', icon: 'CircleHelp' },
        { title: 'Privacy', url: '/privacy-policy', icon: 'ShieldCheck' },
      ],
    },
    buttons: [],
    user_nav: {
      show_name: false,
      show_credits: false,
      show_sign_out: false,
      items: [],
    },
    show_sign: false,
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
          children: [{ title: copy.tool, url: '/' }],
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
