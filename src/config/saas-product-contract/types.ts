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

export interface ContractAuditReport {
  site: ContractSection<SiteSummary>;
  commercial: ContractSection<CommercialSummary>;
  entitlementKeys: ContractSection<EntitlementKeySummary>;
  runtimeOwnership: ContractSection<RuntimeOwnershipSummary>;
  billingReversal: ContractSection<BillingReversalSummary>;
  providerReadiness: ContractSection<ProviderReadinessSummary>;
  launch: {
    blockers: ContractValidationIssue[];
    warnings: ContractValidationIssue[];
    recommendedCommands: string[];
  };
}
