import type { EntitlementValue } from './types';

export type EntitlementValueType = 'number' | 'boolean' | 'string';
export type EntitlementMergeMode = 'max' | 'override';
export type EntitlementSchemaSource = 'pricing' | 'grant';

export type EntitlementFieldSchema = {
  type: EntitlementValueType;
  merge: EntitlementMergeMode;
  sources: EntitlementSchemaSource[];
};

export type ProductEntitlementSchema = Record<string, EntitlementFieldSchema>;

const PRODUCT_ENTITLEMENT_SCHEMAS: Record<string, ProductEntitlementSchema> = {
  'ai-remover': {
    guest_daily_removals: {
      type: 'number',
      merge: 'max',
      sources: ['pricing'],
    },
    low_res_download: {
      type: 'boolean',
      merge: 'override',
      sources: ['pricing'],
    },
    daily_removals: { type: 'number', merge: 'max', sources: ['pricing'] },
    signup_high_res_downloads: {
      type: 'number',
      merge: 'max',
      sources: ['pricing'],
    },
    monthly_removals: {
      type: 'number',
      merge: 'max',
      sources: ['pricing', 'grant'],
    },
    monthly_high_res_downloads: {
      type: 'number',
      merge: 'max',
      sources: ['pricing', 'grant'],
    },
    advanced_mode: {
      type: 'boolean',
      merge: 'override',
      sources: ['pricing'],
    },
    priority_queue: {
      type: 'boolean',
      merge: 'override',
      sources: ['pricing'],
    },
    max_upload_mb: {
      type: 'number',
      merge: 'max',
      sources: ['pricing', 'grant'],
    },
    retention_days: { type: 'number', merge: 'max', sources: ['pricing'] },
  },
};

export function getProductEntitlementSchema(productKey: string) {
  return PRODUCT_ENTITLEMENT_SCHEMAS[productKey];
}

export function assertEntitlementValueMatchesSchema({
  key,
  value,
  field,
}: {
  key: string;
  value: EntitlementValue;
  field: EntitlementFieldSchema;
}) {
  if (typeof value !== field.type) {
    throw new Error(`entitlement ${key} must be a ${field.type}`);
  }
}

export function assertEntitlementSourceMatchesSchema({
  key,
  source,
  field,
}: {
  key: string;
  source: EntitlementSchemaSource;
  field: EntitlementFieldSchema;
}) {
  if (!field.sources.includes(source)) {
    throw new Error(`entitlement ${key} is not allowed for ${source}`);
  }
}
