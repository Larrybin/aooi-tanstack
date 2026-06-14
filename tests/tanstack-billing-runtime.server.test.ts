import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readTanStackBillingRuntimeSettings,
  readTanStackPaymentRuntimeBindings,
} from '../apps/web/src/server/billing-runtime';

test('readTanStackBillingRuntimeSettings reads config through TanStack Hyperdrive bindings', async () => {
  let selectedDatabaseUrl = '';

  const settings = await readTanStackBillingRuntimeSettings({
    isWorkersRuntime: () => true,
    getTanStackCloudflareBindings: async () =>
      ({
        HYPERDRIVE: {
          connectionString: 'postgres://hyperdrive.example/db',
        },
      }) as never,
    readConfigRows: async (databaseUrl) => {
      selectedDatabaseUrl = databaseUrl ?? '';
      return [
        { name: 'locale', value: 'zh' },
        { name: 'default_locale', value: 'en' },
        { name: 'stripe_payment_methods', value: 'card' },
      ] as never;
    },
  });

  assert.equal(selectedDatabaseUrl, 'postgres://hyperdrive.example/db');
  assert.equal(settings.locale, 'zh');
  assert.equal(settings.defaultLocale, 'en');
});

test('readTanStackPaymentRuntimeBindings reads TanStack worker bindings in worker runtime', async () => {
  let readBindings = false;

  await readTanStackPaymentRuntimeBindings({
    isWorkersRuntime: () => true,
    getTanStackCloudflareBindings: async () => {
      readBindings = true;
      return {};
    },
  });

  assert.equal(readBindings, true);
});
