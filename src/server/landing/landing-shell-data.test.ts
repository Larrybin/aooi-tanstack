import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { site } from '@/site';

import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

import { buildLandingShellData } from './landing-shell-data';

const publicUiConfig: PublicUiConfig = {
  aiEnabled: false,
  localeSwitcherEnabled: false,
  socialLinksEnabled: false,
  socialLinksJson: '',
  socialLinks: [],
  affiliate: {
    affonsoEnabled: false,
    promotekitEnabled: false,
  },
};

test('buildLandingShellData filters unavailable public shell links before localization', () => {
  const originalDocs = site.capabilities.docs;
  const originalBlog = site.capabilities.blog;
  site.capabilities.docs = true;
  site.capabilities.blog = true;

  try {
    const shell = buildLandingShellData({
      header: createHeader(),
      footer: createFooter(),
      locale: 'zh',
      publicUiConfig,
      authSettings: {
        emailAuthEnabled: true,
        googleAuthEnabled: false,
        googleOneTapEnabled: false,
        googleClientId: '',
        githubAuthEnabled: false,
      },
      billingSettings: {
        locale: '',
        defaultLocale: 'en',
        provider: 'none',
        paymentCapability: 'none',
      },
    });

    assert.equal(shell.header.userNavItems.length, 0);
    assert.deepEqual(
      shell.header.navItems.map((item) => item.title),
      ['Products']
    );
    assert.deepEqual(
      shell.header.navItems[0]?.children?.map((item) => item.url),
      ['/zh/blog', '/zh/pricing']
    );
    assert.deepEqual(
      shell.header.buttonItems.map((item) => item.url),
      ['/zh/pricing']
    );
    assert.deepEqual(
      shell.footer.groups[0]?.items.map((item) => item.url),
      ['/zh/pricing']
    );
  } finally {
    site.capabilities.docs = originalDocs;
    site.capabilities.blog = originalBlog;
  }
});

function createHeader(): HeaderType {
  return {
    brand: { title: 'Aooi', url: '/' },
    nav: {
      items: [
        {
          title: 'Products',
          children: [
            { title: 'Docs', url: '/docs' },
            { title: 'Chat', url: '/chat' },
            { title: 'My Images', url: '/my-images' },
            { title: 'Blog', url: '/blog' },
            { title: 'Pricing', url: '/pricing' },
          ],
        },
        { title: 'Docs', url: '/docs' },
      ],
    },
    buttons: [
      { title: 'Docs CTA', url: '/docs' },
      { title: 'My Images CTA', url: '/my-images' },
      { title: 'Pricing CTA', url: '/pricing' },
    ],
    user_nav: {
      items: [{ title: 'Billing', url: '/settings/billing' }],
    },
    show_sign: true,
  };
}

function createFooter(): FooterType {
  return {
    brand: { title: 'Aooi', url: '/' },
    nav: {
      items: [
        {
          title: 'Company',
          children: [
            { title: 'Docs', url: '/docs' },
            { title: 'Chat', url: '/chat' },
            { title: 'My Images', url: '/my-images' },
            { title: 'Pricing', url: '/pricing' },
          ],
        },
      ],
    },
    agreement: {
      items: [{ title: 'Terms', url: '/terms-of-service' }],
    },
  };
}
