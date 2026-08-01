import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listConfiguredSiteKeys,
  readCurrentSiteConfig,
} from '../../scripts/lib/site-config';
import { buildSiteRouteIgnorePattern } from '../../scripts/lib/site-route-assembly';

const routeGroups = {
  '/sign-in': '(module_auth)',
  '/pricing': '(module_billing)',
  '/docs': '(module_docs)',
  '/ads.txt': '(module_ads)',
} as const;

for (const siteKey of listConfiguredSiteKeys()) {
  test(`${siteKey}: route availability follows discovered capabilities`, () => {
    const site = readCurrentSiteConfig({ siteKey });
    const ignored = new RegExp(buildSiteRouteIgnorePattern({ site }));

    for (const [route, group] of Object.entries(routeGroups)) {
      const moduleId = group.slice('(module_'.length, -1);
      assert.equal(
        ignored.test(group) ? 404 : 200,
        site.capabilities.enabledModules.includes(moduleId) ? 200 : 404,
        `${siteKey} ${route}`
      );
    }
  });
}
