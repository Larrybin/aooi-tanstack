import { mergeEntitlementsFromGrants } from '@/domains/entitlements/domain/entitlements';
import type {
  AppEnvironment,
  EntitlementGrantRecord,
  EntitlementMap,
} from '@/domains/entitlements/domain/types';
import type { ProductActor } from '@/domains/product-access/domain/actor';

import type { Pricing, PricingItem } from '@/shared/types/blocks/pricing';

import {
  validateProductEntitlements,
  type ProductAccessContext,
  type ProductAccessSource,
} from '../domain/schema';

function findPricingItemByProductId(
  pricing: Pricing,
  productId: string
): PricingItem | undefined {
  return pricing.items?.find((item) => item.product_id === productId);
}

export type ResolveProductAccessDeps = {
  getSubscriptionProductId?: (
    userId: string
  ) => Promise<string | null | undefined>;
  listGrants?: (input: {
    userId: string;
    siteKey: string;
    productKey: string;
  }) => Promise<EntitlementGrantRecord[]>;
};

export type ResolveProductAccessInput = {
  actor: ProductActor;
  siteKey: string;
  productKey: string;
  productId?: string | null;
  environment: AppEnvironment;
  pricing?: Pricing | null;
  internalEntitlementGrantsEnabled?: boolean;
  now?: Date;
  deps?: ResolveProductAccessDeps;
};

function readPricingEntitlements({
  pricing,
  productKey,
  productId,
}: {
  pricing: Pricing | null | undefined;
  productKey: string;
  productId: string;
}): { item?: PricingItem; entitlements: EntitlementMap } {
  const item = pricing
    ? findPricingItemByProductId(pricing, productId)
    : undefined;
  return {
    item,
    entitlements: validateProductEntitlements({
      productKey,
      entitlements: item?.entitlements ?? {},
      source: `pricing product ${productId}`,
      entitlementSource: 'pricing',
    }),
  };
}

function resolveSource({
  actor,
  subscriptionProductId,
  grantIds,
}: {
  actor: ProductActor;
  subscriptionProductId: string | null | undefined;
  grantIds: string[];
}): ProductAccessSource {
  if (actor.kind === 'anonymous') {
    return 'guest';
  }
  if (grantIds.length) {
    return 'grant';
  }
  return subscriptionProductId ? 'subscription' : 'default';
}

export async function resolveProductAccess({
  actor,
  siteKey,
  productKey,
  productId,
  environment,
  pricing,
  internalEntitlementGrantsEnabled = false,
  now = new Date(),
  deps = {},
}: ResolveProductAccessInput): Promise<ProductAccessContext> {
  if (actor.kind === 'anonymous') {
    const { item, entitlements } = readPricingEntitlements({
      pricing,
      productKey,
      productId: productId || 'free',
    });

    return {
      actor,
      siteKey,
      productKey,
      productId: 'guest',
      environment,
      source: 'guest',
      planKey: item?.plan_name ?? item?.title ?? null,
      packageKey: item?.product_id ?? null,
      entitlements,
      entitlementGrantIds: [],
    };
  }

  const subscriptionProductId = await deps.getSubscriptionProductId?.(
    actor.userId
  );
  const resolvedProductId = subscriptionProductId || productId || 'free';
  const { item, entitlements: baseEntitlements } = readPricingEntitlements({
    pricing,
    productKey,
    productId: resolvedProductId,
  });

  const effective =
    environment === 'production' && !internalEntitlementGrantsEnabled
      ? { entitlements: baseEntitlements, grantIds: [] }
      : mergeEntitlementsFromGrants({
          baseEntitlements,
          grants:
            (await deps.listGrants?.({
              userId: actor.userId,
              siteKey,
              productKey,
            })) ?? [],
          environment,
          now,
          productKey,
        });

  return {
    actor,
    siteKey,
    productKey,
    productId: resolvedProductId,
    environment,
    source: resolveSource({
      actor,
      subscriptionProductId,
      grantIds: effective.grantIds,
    }),
    planKey: item?.plan_name ?? item?.title ?? null,
    packageKey: item?.product_id ?? null,
    entitlements: validateProductEntitlements({
      productKey,
      entitlements: effective.entitlements,
      source: `access product ${resolvedProductId}`,
    }),
    entitlementGrantIds: effective.grantIds,
  };
}
