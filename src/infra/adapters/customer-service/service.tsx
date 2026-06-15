
import type { CustomerServiceRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { readCustomerServiceRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';

import {
  CrispCustomerServiceProvider,
  CustomerServiceManager,
  TawkCustomerServiceProvider,
} from '@/extensions/customer-service';

export function createCustomerServiceManager(
  settings: CustomerServiceRuntimeSettings
) {
  const customerServiceManager = new CustomerServiceManager();

  if (settings.crispEnabled && settings.crispWebsiteId) {
    customerServiceManager.addProvider(
      new CrispCustomerServiceProvider({
        websiteId: settings.crispWebsiteId,
      })
    );
  }

  if (
    settings.tawkEnabled &&
    settings.tawkPropertyId &&
    settings.tawkWidgetId
  ) {
    customerServiceManager.addProvider(
      new TawkCustomerServiceProvider({
        propertyId: settings.tawkPropertyId,
        widgetId: settings.tawkWidgetId,
      })
    );
  }

  return customerServiceManager;
}

export async function getCustomerService(): Promise<CustomerServiceManager> {
  return createCustomerServiceManager(
    await readCustomerServiceRuntimeSettingsCached()
  );
}
