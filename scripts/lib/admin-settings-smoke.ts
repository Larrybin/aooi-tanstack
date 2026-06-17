import assert from 'node:assert/strict';
import type { Page } from 'playwright';

import { defaultLocale, type Locale } from '../../src/config/locale/index.ts';
import {
  getProductModuleItemsByTab,
  type ProductModuleId,
  type ProductModuleTabRelationship,
  type ProductModuleTier,
  type ProductModuleVerification,
} from '../../src/config/product-modules/index.ts';
import type { SettingTabName } from '../../src/domains/settings/tab-names.ts';

export const ADMIN_SETTINGS_SMOKE_TABS = [
  'general',
  'auth',
  'payment',
  'ai',
  'email',
  'storage',
] as const satisfies readonly SettingTabName[];

export type AdminSettingsSmokeTab = (typeof ADMIN_SETTINGS_SMOKE_TABS)[number];

export const ADMIN_SETTINGS_MODULE_CONTRACT_SELECTOR =
  '[data-testid="admin-settings-module-contract"]';
export const ADMIN_SETTINGS_MODULE_CONTRACT_ROW_SELECTOR =
  '[data-testid="admin-settings-module-contract-row"]';
export const ADMIN_SETTINGS_MODULE_CONTRACT_GUIDE_LINK_SELECTOR =
  '[data-testid="admin-settings-module-contract-guide-link"]';
export const ADMIN_SETTINGS_FORM_SHELL_SELECTOR =
  '[data-testid="admin-settings-form-shell"]';
export const NO_PERMISSION_PAGE_SELECTOR = '[data-testid="no-permission-page"]';
export const FORM_SUBMIT_BUTTON_SELECTOR = '[data-testid="form-submit-button"]';

export interface AdminSettingsModuleContractRowExpectation {
  moduleId: ProductModuleId;
  relationship: ProductModuleTabRelationship;
  tier: ProductModuleTier;
  verification: ProductModuleVerification;
  guideHref: string;
}

export interface AdminSettingsModuleContractSnapshotRow {
  moduleId: string;
  relationship: string;
  tier: string;
  verification: string;
  guideHref: string;
}

export interface AdminSettingsModuleContractSnapshot {
  visible: boolean;
  rows: AdminSettingsModuleContractSnapshotRow[];
}

export interface AdminSettingsModuleContractCheck {
  name: AdminSettingsSmokeTab;
  path: string;
  expectedRows: AdminSettingsModuleContractRowExpectation[];
}

export function buildLocalizedAppPath(
  locale: string,
  pathname: string
): string {
  if (!pathname.startsWith('/')) {
    throw new Error(`pathname must start with "/": ${pathname}`);
  }

  return locale === defaultLocale ? pathname : `/${locale}${pathname}`;
}

export function buildAdminSettingsCallbackPath(
  tab: AdminSettingsSmokeTab
): string {
  return `/admin/settings/${tab}`;
}

export function buildAdminSettingsPath(
  tab: AdminSettingsSmokeTab,
  locale: string = defaultLocale
): string {
  return buildLocalizedAppPath(locale, buildAdminSettingsCallbackPath(tab));
}

export function buildLocalizedSignInPath(locale: string): string {
  return buildLocalizedAppPath(locale, '/sign-in');
}

export function buildLocalizedAdminNoPermissionPath(locale: string): string {
  return buildLocalizedAppPath(locale, '/no-permission');
}

export function buildFormFieldSelector(fieldName: string): string {
  return `[data-testid="form-field-${fieldName}"]`;
}

export function buildFormControlSelector(fieldName: string): string {
  return `[data-testid="form-control-${fieldName}"]`;
}

export function buildExpectedModuleContractRows(
  tab: AdminSettingsSmokeTab
): AdminSettingsModuleContractRowExpectation[] {
  return getProductModuleItemsByTab(tab).map((module) => ({
    moduleId: module.moduleId,
    relationship: module.relationship,
    tier: module.tier,
    verification: module.verification,
    guideHref: module.guideHref,
  }));
}

export function getAdminSettingsModuleContractChecks(options?: {
  locale?: Locale | string;
}): AdminSettingsModuleContractCheck[] {
  const locale = options?.locale ?? defaultLocale;

  return ADMIN_SETTINGS_SMOKE_TABS.map((tab) => ({
    name: tab,
    path: buildAdminSettingsPath(tab, locale),
    expectedRows: buildExpectedModuleContractRows(tab),
  }));
}

export async function waitForAdminSettingsPageReady(page: Page): Promise<void> {
  await page.waitForSelector(ADMIN_SETTINGS_MODULE_CONTRACT_SELECTOR, {
    state: 'visible',
    timeout: 20_000,
  });
  await page.waitForSelector(ADMIN_SETTINGS_FORM_SHELL_SELECTOR, {
    state: 'visible',
    timeout: 20_000,
  });
}

export async function captureAdminSettingsModuleContractSnapshot(
  page: Page
): Promise<AdminSettingsModuleContractSnapshot> {
  await waitForAdminSettingsPageReady(page);

  const rows = await page.$$eval(
    ADMIN_SETTINGS_MODULE_CONTRACT_ROW_SELECTOR,
    (elements) =>
      elements.map((element) => ({
        moduleId: element.getAttribute('data-module-id') || '',
        relationship: element.getAttribute('data-relationship') || '',
        tier: element.getAttribute('data-tier') || '',
        verification: element.getAttribute('data-verification') || '',
        guideHref:
          element
            .querySelector(
              '[data-testid="admin-settings-module-contract-guide-link"]'
            )
            ?.getAttribute('href') || '',
      }))
  );

  return {
    visible: true,
    rows,
  };
}

export function validateAdminSettingsModuleContractSnapshot(
  check: AdminSettingsModuleContractCheck,
  snapshot: AdminSettingsModuleContractSnapshot
): void {
  assert.equal(
    snapshot.visible,
    true,
    `[${check.name}] module contract block missing`
  );
  assert.equal(
    snapshot.rows.length,
    check.expectedRows.length,
    `[${check.name}] unexpected row count`
  );

  for (const expectedRow of check.expectedRows) {
    const actualRow = snapshot.rows.find(
      (row) => row.moduleId === expectedRow.moduleId
    );

    assert.ok(
      actualRow,
      `[${check.name}] missing row for ${expectedRow.moduleId}`
    );
    assert.equal(
      actualRow.relationship,
      expectedRow.relationship,
      `[${check.name}] unexpected relationship for ${expectedRow.moduleId}`
    );
    assert.equal(
      actualRow.tier,
      expectedRow.tier,
      `[${check.name}] unexpected tier for ${expectedRow.moduleId}`
    );
    assert.equal(
      actualRow.verification,
      expectedRow.verification,
      `[${check.name}] unexpected verification for ${expectedRow.moduleId}`
    );
    assert.equal(
      actualRow.guideHref,
      expectedRow.guideHref,
      `[${check.name}] unexpected guide href for ${expectedRow.moduleId}`
    );
  }
}
