import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import React from 'react';
import { resolveCalculatorHomeCopy } from '@/domains/401k-calculator/ui/401k-calculator-home-copy';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SlugShellData } from '../slug/slug.types';
import type { HomeRouteData } from './home.types';
import { HomeSurfaceView } from './home.view';

const calculatorCopy = resolveCalculatorHomeCopy(
  {
    en: JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'sites/401k-calculator/content/home.en.json'),
        'utf8'
      )
    ),
  },
  'en'
);

test('401k home exposes a skip link before the site header', () => {
  const html = renderToStaticMarkup(
    <HomeSurfaceView data={createRouteData()} />
  );
  const skipLinkIndex = html.indexOf('href="#calculator"');
  const headerIndex = html.indexOf('<header');

  assert.notEqual(skipLinkIndex, -1);
  assert.ok(skipLinkIndex < headerIndex);
  assert.match(html, />Skip to calculator<\/a>/);
});

function createRouteData(): HomeRouteData {
  return {
    variant: 'product',
    locale: 'en',
    canonicalPath: '/',
    head: {},
    shell: createShell(),
    productHome: {
      kind: '401k-calculator',
      copy: calculatorCopy,
    },
  };
}

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
      emailAuthEnabled: false,
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
      title: '401k Calculator',
      url: '/',
    },
    header: {
      navItems: [],
      buttonItems: [],
      userNavItems: [],
      showSign: false,
      signInHref: '/sign-in',
      signInLabel: 'Sign In',
      ariaLabel: '401k Calculator',
    },
    footer: {
      groups: [],
      agreementItems: [],
      copyright: 'Copyright',
      ariaLabel: '401k Calculator footer',
    },
  };
}
