import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SlugShellData } from '../slug/slug.types';
import { LandingShellView } from './landing-shell.view';

test('LandingShellView renders child navigation links without placeholder anchors', () => {
  const html = renderToStaticMarkup(
    <LandingShellView shell={createShell()}>
      <div>Landing content</div>
    </LandingShellView>
  );

  assert.match(html, /aria-label="Aooi"/);
  assert.match(html, /class="landing-shell-nav-group"/);
  assert.match(html, /href="\/pricing"/);
  assert.match(html, /href="\/blog"/);
  assert.doesNotMatch(html, /href="#"/);
});

function createShell(): SlugShellData {
  return {
    publicUiConfig: {
      aiEnabled: false,
      localeSwitcherEnabled: false,
      socialLinksEnabled: false,
      socialLinksJson: '',
      socialLinks: [],
      affiliate: {
        affonsoEnabled: false,
        promotekitEnabled: false,
      },
    },
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
    brand: {
      title: 'Aooi',
      url: '/',
    },
    header: {
      navItems: [
        {
          title: 'Products',
          children: [
            { title: 'Pricing', url: '/pricing' },
            { title: 'Blog', url: '/blog' },
          ],
        },
      ],
      buttonItems: [],
      userNavItems: [],
      showSign: true,
      signInHref: '/sign-in',
      signInLabel: 'Sign In',
      ariaLabel: 'Aooi',
    },
    footer: {
      groups: [],
      agreementItems: [{ title: 'Terms', url: '/terms-of-service' }],
      copyright: 'Copyright',
      ariaLabel: 'Aooi footer',
    },
  };
}
