import assert from 'node:assert/strict';
import test from 'node:test';

import { readCurrentSiteConfig } from '../../scripts/lib/site-config.mjs';
import { buildSiteRouteIgnorePattern } from '../../scripts/lib/site-route-assembly.mjs';

const routeGroups = {
  '/sign-in': '(module_auth)',
  '/pricing': '(module_billing)',
  '/admin/settings/general': '(module_admin_settings)',
  '/docs': '(module_docs)',
  '/blog': '(module_blog)',
  '/my-images': '(module_storage)',
  '/ads.txt': '(module_ads)',
} as const;

for (const siteKey of [
  '401k-calculator',
  'ai-remover',
  'background-remover',
  'dev-local',
  'mamamiya',
  'mp4-compressor',
  'random-group-generator',
  'text-to-speech-generator',
]) {
  test(`${siteKey}: disabled module routes resolve as 404`, () => {
    const site = readCurrentSiteConfig({ siteKey });
    const ignored = new RegExp(buildSiteRouteIgnorePattern({ site }));
    const availability = Object.fromEntries(
      Object.entries(routeGroups).map(([route, group]) => [
        route,
        ignored.test(group) ? 404 : 200,
      ])
    );

    assert.equal(
      availability['/sign-in'],
      site.capabilities.enabledModules.includes('auth') ? 200 : 404
    );
    assert.equal(
      availability['/pricing'],
      site.capabilities.enabledModules.includes('billing') ? 200 : 404
    );
    assert.equal(
      availability['/docs'],
      site.capabilities.enabledModules.includes('docs') ? 200 : 404
    );
    assert.equal(
      availability['/ads.txt'],
      site.capabilities.enabledModules.includes('ads') ? 200 : 404
    );
  });
}
