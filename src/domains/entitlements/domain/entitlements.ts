import {
  assertEntitlementSourceMatchesSchema,
  assertEntitlementValueMatchesSchema,
  getProductEntitlementSchema,
  type EntitlementFieldSchema,
  type EntitlementSchemaSource,
} from './product-schemas';
import type {
  AppEnvironment,
  EntitlementGrantRecord,
  EntitlementMap,
  EntitlementValue,
} from './types';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isEntitlementValue(value: unknown): value is EntitlementValue {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

export function parseEntitlementsJson(value: string): EntitlementMap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('entitlements must be valid JSON');
  }

  if (!isPlainRecord(parsed)) {
    throw new Error('entitlements must be a JSON object');
  }

  const entitlements: EntitlementMap = {};
  for (const [key, entitlementValue] of Object.entries(parsed)) {
    if (!key.trim()) {
      throw new Error('entitlement keys must be non-empty strings');
    }
    if (!isEntitlementValue(entitlementValue)) {
      throw new Error(
        `entitlement ${key} must be a string, number, or boolean`
      );
    }
    entitlements[key] = entitlementValue;
  }

  return entitlements;
}

export function stringifyEntitlements(entitlements: EntitlementMap): string {
  return JSON.stringify(parseEntitlementsJson(JSON.stringify(entitlements)));
}

export function parseProductEntitlementsJson({
  productKey,
  value,
  source,
}: {
  productKey: string;
  value: string;
  source?: EntitlementSchemaSource;
}): EntitlementMap {
  const schema = getProductEntitlementSchema(productKey);
  if (!schema) {
    throw new Error(`no entitlement schema registered for ${productKey}`);
  }

  const entitlements = parseEntitlementsJson(value);
  for (const [key, entitlementValue] of Object.entries(entitlements)) {
    const field = schema[key];
    if (!field) {
      throw new Error(`unknown entitlement ${key} for ${productKey}`);
    }
    if (source) {
      assertEntitlementSourceMatchesSchema({
        key,
        source,
        field,
      });
    }
    assertEntitlementValueMatchesSchema({
      key,
      value: entitlementValue,
      field,
    });
  }

  return entitlements;
}

export function stringifyProductEntitlements({
  productKey,
  entitlements,
  source,
}: {
  productKey: string;
  entitlements: EntitlementMap;
  source?: EntitlementSchemaSource;
}): string {
  return JSON.stringify(
    parseProductEntitlementsJson({
      productKey,
      value: JSON.stringify(entitlements),
      source,
    })
  );
}

export function isEntitlementGrantActive({
  grant,
  environment,
  now,
}: {
  grant: EntitlementGrantRecord;
  environment: AppEnvironment;
  now: Date;
}): boolean {
  if (grant.status !== 'active') {
    return false;
  }
  if (grant.revokedAt) {
    return false;
  }
  if (grant.environment !== environment) {
    return false;
  }
  return grant.startsAt <= now && grant.expiresAt > now;
}

export function mergeEntitlementsFromGrants({
  baseEntitlements,
  grants,
  environment,
  now,
  productKey,
}: {
  baseEntitlements?: EntitlementMap;
  grants: EntitlementGrantRecord[];
  environment: AppEnvironment;
  now: Date;
  productKey: string;
}) {
  const entitlements: EntitlementMap = { ...(baseEntitlements ?? {}) };
  const grantIds: string[] = [];

  const activeGrants = grants
    .filter((grant) => isEntitlementGrantActive({ grant, environment, now }))
    .sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
    );

  for (const grant of activeGrants) {
    const grantEntitlements = parseProductEntitlementsJson({
      productKey,
      value: grant.entitlementsJson,
    });
    let mergedGrant = false;
    for (const [key, value] of Object.entries(grantEntitlements)) {
      const field = getProductEntitlementSchema(productKey)?.[key];
      if (!field?.sources.includes('grant')) {
        continue;
      }
      entitlements[key] = mergeEntitlementValue({
        baseValue: entitlements[key],
        grantValue: value,
        field,
      });
      mergedGrant = true;
    }
    if (mergedGrant) {
      grantIds.push(grant.id);
    }
  }

  return { entitlements, grantIds };
}

function mergeEntitlementValue({
  baseValue,
  grantValue,
  field,
}: {
  baseValue: EntitlementValue | undefined;
  grantValue: EntitlementValue;
  field: EntitlementFieldSchema | undefined;
}) {
  if (field?.type === 'number' && field.merge === 'max') {
    return typeof baseValue === 'number' && Number.isFinite(baseValue)
      ? Math.max(baseValue, grantValue as number)
      : grantValue;
  }

  return grantValue;
}
