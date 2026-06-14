import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSettingsSignInRedirectHref } from './settings-auth-redirect';

test('buildSettingsSignInRedirectHref builds default-locale callbacks', () => {
  assert.equal(
    buildSettingsSignInRedirectHref({
      locale: 'en',
      pathname: '/settings/profile',
      search: '?tab=account',
    }),
    '/sign-in?callbackUrl=%2Fsettings%2Fprofile%3Ftab%3Daccount'
  );
});

test('buildSettingsSignInRedirectHref localizes sign-in and strips callback locale', () => {
  assert.equal(
    buildSettingsSignInRedirectHref({
      locale: 'zh',
      pathname: '/zh/settings/security',
      search: '?from=nav',
    }),
    '/zh/sign-in?callbackUrl=%2Fsettings%2Fsecurity%3Ffrom%3Dnav'
  );
});

test('buildSettingsSignInRedirectHref preserves TanStack object search callbacks', () => {
  assert.equal(
    buildSettingsSignInRedirectHref({
      locale: 'en',
      pathname: '/settings/billing',
      search: { order_no: 'order-1', retry: true },
    }),
    '/sign-in?callbackUrl=%2Fsettings%2Fbilling%3Forder_no%3Dorder-1%26retry%3Dtrue'
  );
});
