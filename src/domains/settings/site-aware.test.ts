import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import { mapSettingsToForms } from './settings-form-mapper';

test('site-aware settings: payment=none 时 payment tab 不存在', async () => {
  const originalCapability = site.capabilities.paymentProvider;
  site.capabilities.paymentProvider = 'none';

  try {
    const mod = await import('./site-aware');
    const tabs = await mod.getAvailableSettingTabs();
    const settings = await mod.getSettings();

    assert.equal(tabs.includes('payment'), false);
    assert.equal(
      settings.some((setting) => setting.tab === 'payment'),
      false
    );
  } finally {
    site.capabilities.paymentProvider = originalCapability;
  }
});

test('site-aware settings: 测试站点 payment!=none 时只暴露当前 provider 组', async () => {
  const settingsModulePath = './site-aware';
  const registryModulePath = './registry';
  const [settingsModule, registryModule] = await Promise.all([
    import(settingsModulePath),
    import(registryModulePath),
  ]);

  const originalCapability = site.capabilities.paymentProvider;
  site.capabilities.paymentProvider = 'stripe';

  try {
    const tabs = await settingsModule.getAvailableSettingTabs();
    const settings = await settingsModule.getSettings();
    const groups = registryModule.getSettingGroupsFromDefinitions(
      settings,
      (key: string) => key
    );
    const forms = mapSettingsToForms({
      tab: 'payment',
      groups,
      settings,
      configs: {},
      submitLabel: 'Save',
      onSubmit: async () => ({
        status: 'success',
        message: 'ok',
      }),
    });
    const paymentGroups = settings
      .filter((setting: { tab: string }) => setting.tab === 'payment')
      .map((setting: { group: { id: string } }) => setting.group.id);
    const paymentGroupNames = groups
      .filter((group: { tab: string }) => group.tab === 'payment')
      .map((group: { name: string }) => group.name);
    const paymentFormProviders = forms.map((form) => {
      const passby = form.passby as { provider?: string } | undefined;
      return passby?.provider ?? '';
    });

    assert.equal(tabs.includes('payment'), true);
    assert.deepEqual([...new Set(paymentGroups)], ['stripe']);
    assert.deepEqual(paymentGroupNames, ['stripe']);
    assert.deepEqual(paymentFormProviders, ['stripe']);
    assert.equal(
      forms.every((form) => form.fields.length > 0),
      true
    );
  } finally {
    site.capabilities.paymentProvider = originalCapability;
  }
});
