import {
  assertEntitlementSourceMatchesSchema,
  assertEntitlementValueMatchesSchema,
  getProductEntitlementSchema,
  type EntitlementSchemaSource,
} from '@/domains/entitlements/domain/product-schemas';
import type {
  AppEnvironment,
  EntitlementMap,
} from '@/domains/entitlements/domain/types';
import type { ProductActor } from '@/domains/product-access/domain/actor';

export type ProductAccessSource =
  | 'guest'
  | 'subscription'
  | 'grant'
  | 'default';

export type ProductAccessContext = {
  actor: ProductActor;
  siteKey: string;
  productKey: string;
  productId: string;
  environment: AppEnvironment;
  source: ProductAccessSource;
  planKey: string | null;
  packageKey: string | null;
  entitlements: EntitlementMap;
  entitlementGrantIds: string[];
};

export function validateProductEntitlements({
  productKey,
  entitlements,
  source,
  entitlementSource,
}: {
  productKey: string;
  entitlements: EntitlementMap;
  source: string;
  entitlementSource?: EntitlementSchemaSource;
}): EntitlementMap {
  const schema = getProductEntitlementSchema(productKey);
  if (!schema) {
    throw new Error(`no entitlement schema registered for ${productKey}`);
  }

  for (const [key, value] of Object.entries(entitlements)) {
    const field = schema[key];
    if (!field) {
      throw new Error(
        `unknown entitlement ${key} for ${productKey} in ${source}`
      );
    }
    if (entitlementSource) {
      assertEntitlementSourceMatchesSchema({
        key,
        source: entitlementSource,
        field,
      });
    }
    assertEntitlementValueMatchesSchema({ key, value, field });
  }

  return { ...entitlements };
}
