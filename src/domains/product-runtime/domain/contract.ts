export type ProductRuntimeEnvironment =
  | 'local'
  | 'preview'
  | 'staging'
  | 'production';

export type ProductRuntimeRequirementMap = Readonly<Record<string, boolean>>;

export type ProductRuntimeContract = {
  siteKey: string;
  productKey: string;
  environment?: ProductRuntimeEnvironment;
  requiredWorkers?: ProductRuntimeRequirementMap;
  requiredBindings?: ProductRuntimeRequirementMap;
  requiredResources?: ProductRuntimeRequirementMap;
  requiredVars?: ProductRuntimeRequirementMap;
  requiredSecrets?: ProductRuntimeRequirementMap;
};

export type ProductRuntimeRequiredKeys = {
  workers: string[];
  bindings: string[];
  resources: string[];
  vars: string[];
  secrets: string[];
};

function assertNonEmptyString(value: string, label: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`);
  }
}

function requiredKeys(requirements?: ProductRuntimeRequirementMap): string[] {
  return Object.entries(requirements ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
    .sort();
}

export function getProductRuntimeRequiredKeys(
  contract: ProductRuntimeContract
): ProductRuntimeRequiredKeys {
  return {
    workers: requiredKeys(contract.requiredWorkers),
    bindings: requiredKeys(contract.requiredBindings),
    resources: requiredKeys(contract.requiredResources),
    vars: requiredKeys(contract.requiredVars),
    secrets: requiredKeys(contract.requiredSecrets),
  };
}

export function defineProductRuntimeContract(
  contract: ProductRuntimeContract
): ProductRuntimeContract {
  assertNonEmptyString(contract.siteKey, 'product runtime siteKey');
  assertNonEmptyString(contract.productKey, 'product runtime productKey');
  return contract;
}
