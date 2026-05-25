export type ContractSectionStatus =
  | 'resolved'
  | 'partial'
  | 'product_owned'
  | 'runtime_owned'
  | 'missing'
  | 'not_applicable';

export type ContractSourceKind =
  | 'site_config'
  | 'pricing'
  | 'deploy_settings'
  | 'product_modules'
  | 'settings_definition'
  | 'runtime_env'
  | 'billing_domain'
  | 'billing_application'
  | 'billing_infra'
  | 'billing_test'
  | 'provider_route'
  | 'provider_application'
  | 'provider_domain'
  | 'provider_extension'
  | 'provider_runtime'
  | 'provider_test'
  | 'usage_product_domain'
  | 'usage_product_application'
  | 'usage_product_infra'
  | 'usage_product_route'
  | 'usage_platform_credit'
  | 'usage_billing_credit'
  | 'usage_db'
  | 'derived';

export type ContractIssueLevel = 'blocker' | 'warning';

export interface ContractSourceRef {
  kind: ContractSourceKind;
  path?: string;
  key?: string;
}

export interface ContractValidationIssue {
  level: ContractIssueLevel;
  code: string;
  message: string;
  sources: ContractSourceRef[];
}

export interface ContractSection<T> {
  status: ContractSectionStatus;
  value?: T;
  sources: ContractSourceRef[];
  issues: ContractValidationIssue[];
}

export interface SiteSummary {
  key: string;
  appName?: string;
  appUrl?: string;
  supportEmail?: string;
  logo?: string;
  favicon?: string;
  previewImage?: string;
  capabilities?: Record<string, unknown>;
}

export interface CommercialPlanSummary {
  productId: string;
  title?: string;
  checkoutEnabled: boolean;
  interval?: string;
  amount?: number;
  currency?: string;
  paymentProductMapping: {
    status: ContractSectionStatus;
    owner: string;
    sources: ContractSourceRef[];
  };
}

export interface CommercialSummary {
  billing: string;
  pricingFile: 'resolved' | 'missing' | 'invalid';
  planCount: number;
  paidCheckoutPlanCount: number;
  plans: CommercialPlanSummary[];
}

export type EntitlementKeyClassification =
  | 'common_known'
  | 'product_owned'
  | 'raw_unknown';

export interface EntitlementKeySummary {
  keys: Array<{
    key: string;
    classification: EntitlementKeyClassification;
  }>;
  allowedProductOwnedPrefix: string;
}

export interface RuntimeOwnershipSummary {
  fields: Array<{
    name: string;
    expectedKey: string;
    owner: string;
    status: ContractSectionStatus;
    sources: ContractSourceRef[];
  }>;
}

export type BillingReversalSupportStatus =
  | 'handled'
  | 'partially_handled'
  | 'unsupported'
  | 'unknown';

export type BillingReversalEffectStatus =
  | 'changes'
  | 'no_change'
  | 'missing'
  | 'unknown'
  | 'grants'
  | 'revokes'
  | 'downgrades'
  | 'reverses'
  | 'refunds'
  | 'expires'
  | 'writes_audit'
  | 'logs_only'
  | 'explicit'
  | 'fallback'
  | 'required'
  | 'not_required';

export interface BillingReversalEventSummary {
  eventName: string;
  representedBy?: string;
  supportStatus: BillingReversalSupportStatus;
  sources: ContractSourceRef[];
  subscriptionStateEffect: BillingReversalEffectStatus;
  entitlementEffect: BillingReversalEffectStatus;
  creditEffect: BillingReversalEffectStatus;
  usageEffect: BillingReversalEffectStatus;
  auditEffect: BillingReversalEffectStatus;
  idempotency: BillingReversalEffectStatus;
  operatorAction: BillingReversalEffectStatus;
  issues: ContractValidationIssue[];
}

export interface BillingReversalSummary {
  events: BillingReversalEventSummary[];
}

export type ProviderReadinessStatus =
  | 'ready'
  | 'partial'
  | 'missing'
  | 'unsupported'
  | 'unknown';

export type ProviderSourceOwner =
  | 'platform'
  | 'product_owned'
  | 'runtime_owned'
  | 'unknown';

export type ProviderTaskMode = 'sync' | 'async' | 'mixed' | 'unknown';

export type ProviderMediaType =
  | 'image'
  | 'text'
  | 'audio'
  | 'video'
  | 'unknown';

export type ProviderRequirementStatus =
  | 'runtime_owned'
  | 'binding_defined'
  | 'missing'
  | 'not_applicable';

export interface ProviderBindingRequirement {
  name: string;
  owner: ProviderSourceOwner;
  status: ProviderRequirementStatus;
  sources: ContractSourceRef[];
}

export interface ProviderModelSummary {
  modelId: string;
  source: 'defaulted' | 'runtime_env' | 'provider_default' | 'unknown';
  sources: ContractSourceRef[];
}

export interface ProviderFallbackSummary {
  status: 'explicit_default' | 'missing' | 'unknown';
  description: string;
  sources: ContractSourceRef[];
}

export interface ProviderReadinessEntry {
  providerId: string;
  sourceOwner: ProviderSourceOwner;
  supportStatus: ProviderReadinessStatus;
  taskMode: ProviderTaskMode;
  inputMedia: ProviderMediaType[];
  inputDetail?: string;
  outputMedia: ProviderMediaType[];
  defaultModel?: ProviderModelSummary;
  modelSource?: ProviderModelSummary;
  requiredBindings: ProviderBindingRequirement[];
  requiredSecrets: ProviderBindingRequirement[];
  requiredVars: ProviderBindingRequirement[];
  fallbackPolicy: ProviderFallbackSummary;
  sources: ContractSourceRef[];
  issues: ContractValidationIssue[];
}

export interface ProviderReadinessSummary {
  selectedProductProvider: ProviderModelSummary;
  selectedProductModel: ProviderModelSummary;
  providers: ProviderReadinessEntry[];
  missingRuntimeRequirements: ProviderBindingRequirement[];
  warnings: ContractValidationIssue[];
}

export type UsageOwner = 'product_owned' | 'platform_owned' | 'unknown';

export type UsageSubject = 'anonymous' | 'user' | 'organization' | 'unknown';

export type UsageWindow = 'day' | 'month' | 'lifetime' | 'none' | 'unknown';

export type UsageReserveMode =
  | 'explicit_reservation'
  | 'direct_consume'
  | 'none'
  | 'unknown';

export type UsageCommitCondition =
  | 'provider_success'
  | 'output_storage_success'
  | 'download_success'
  | 'none'
  | 'unknown';

export type UsageRefundCondition =
  | 'provider_failure'
  | 'output_storage_failure'
  | 'explicit_refund'
  | 'missing'
  | 'none'
  | 'unknown';

export type UsageMappingStatus =
  | 'present'
  | 'partial'
  | 'missing'
  | 'deferred'
  | 'unknown';

export type CreditMappingStatus = 'present' | 'partial' | 'missing' | 'unknown';

export type UsageEntitlementClassification =
  | 'usage_limit'
  | 'access'
  | 'product_flag'
  | 'retention'
  | 'upload_guard'
  | 'unknown';

export interface ProductQuotaMappingEntry {
  meterId: string;
  quotaType: string;
  owner: UsageOwner;
  subject: UsageSubject[];
  unit: string;
  window: UsageWindow[];
  reserveMode: UsageReserveMode;
  commitCondition: UsageCommitCondition;
  refundCondition: UsageRefundCondition[];
  idempotency: UsageMappingStatus;
  storage:
    | 'product_quota_reservation'
    | 'credit_ledger'
    | 'product_table'
    | 'unknown';
  sources: ContractSourceRef[];
  issues: ContractValidationIssue[];
}

export interface CreditLedgerMappingEntry {
  ledgerName: string;
  owner: UsageOwner;
  supportsGrant: CreditMappingStatus;
  supportsConsume: CreditMappingStatus;
  supportsRefundConsumed: CreditMappingStatus;
  supportsExpiration: CreditMappingStatus;
  supportsMetadata: CreditMappingStatus;
  supportsOperatorVisibility: CreditMappingStatus;
  supportsManualCompensation: CreditMappingStatus;
  scenes: string[];
  sources: ContractSourceRef[];
  issues: ContractValidationIssue[];
}

export interface UsageEntitlementMapping {
  key: string;
  classification: UsageEntitlementClassification;
  mapsTo: string;
  sources: ContractSourceRef[];
}

export interface UsageLifecycleMappings {
  reserve: UsageMappingStatus;
  commit: UsageMappingStatus;
  refund: UsageMappingStatus;
  expire: UsageMappingStatus;
  idempotency: UsageMappingStatus;
  subjectTransfer: UsageMappingStatus;
  genericUsageTable: UsageMappingStatus;
}

export interface UsageCreditsSummary {
  productOwnedQuota: ProductQuotaMappingEntry[];
  platformCreditLedger: CreditLedgerMappingEntry[];
  entitlementMappings: UsageEntitlementMapping[];
  lifecycleMappings: UsageLifecycleMappings;
  gaps: string[];
  warnings: ContractValidationIssue[];
}

export interface ContractAuditReport {
  site: ContractSection<SiteSummary>;
  commercial: ContractSection<CommercialSummary>;
  entitlementKeys: ContractSection<EntitlementKeySummary>;
  runtimeOwnership: ContractSection<RuntimeOwnershipSummary>;
  billingReversal: ContractSection<BillingReversalSummary>;
  providerReadiness: ContractSection<ProviderReadinessSummary>;
  usageCredits: ContractSection<UsageCreditsSummary>;
  launch: {
    blockers: ContractValidationIssue[];
    warnings: ContractValidationIssue[];
    recommendedCommands: string[];
  };
}
