import type {
  ProductRuntimeContract,
  ProductRuntimeRequiredKeys,
} from '../domain/contract';

export type ProductRuntimeContractTarget = {
  siteKey: string;
  workers?: Readonly<Record<string, unknown>>;
  runtime?: {
    bindings?: Readonly<Record<string, boolean>>;
    resources?: Readonly<Record<string, boolean>>;
    vars?: Readonly<Record<string, boolean>>;
    secrets?: Readonly<Record<string, boolean>>;
  };
};

export type ProductRuntimeContractIssue =
  | {
      code: 'site_key_mismatch';
      expected: string;
      actual: string;
    }
  | {
      code: 'missing_worker';
      key: string;
    }
  | {
      code: 'missing_binding';
      key: string;
    }
  | {
      code: 'missing_resource';
      key: string;
    }
  | {
      code: 'missing_var';
      key: string;
    }
  | {
      code: 'missing_secret';
      key: string;
    };

export type ProductRuntimeContractAssertion = {
  contract: ProductRuntimeContract;
  required: ProductRuntimeRequiredKeys;
  issues: ProductRuntimeContractIssue[];
};

export class ProductRuntimeContractError extends Error {
  readonly issues: ProductRuntimeContractIssue[];

  constructor(issues: ProductRuntimeContractIssue[]) {
    super(
      `Product runtime contract failed: ${issues
        .map(formatProductRuntimeContractIssue)
        .join('; ')}`
    );
    this.name = 'ProductRuntimeContractError';
    this.issues = issues;
  }
}

function requiredKeys(
  requirements?: Readonly<Record<string, boolean>>
): string[] {
  return Object.entries(requirements ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
    .sort();
}

function getRequiredKeys(
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

export function formatProductRuntimeContractIssue(
  issue: ProductRuntimeContractIssue
): string {
  switch (issue.code) {
    case 'site_key_mismatch':
      return `siteKey must be ${issue.expected}, got ${issue.actual}`;
    case 'missing_worker':
      return `missing worker ${issue.key}`;
    case 'missing_binding':
      return `missing binding ${issue.key}`;
    case 'missing_resource':
      return `missing resource ${issue.key}`;
    case 'missing_var':
      return `missing var ${issue.key}`;
    case 'missing_secret':
      return `missing secret ${issue.key}`;
  }
}

function collectMissingEnabledKeys({
  required,
  actual,
  code,
}: {
  required: string[];
  actual?: Readonly<Record<string, boolean>>;
  code:
    | 'missing_binding'
    | 'missing_resource'
    | 'missing_var'
    | 'missing_secret';
}): ProductRuntimeContractIssue[] {
  return required
    .filter((key) => actual?.[key] !== true)
    .map((key) => ({ code, key }));
}

export function checkProductRuntimeContract({
  contract,
  target,
}: {
  contract: ProductRuntimeContract;
  target: ProductRuntimeContractTarget;
}): ProductRuntimeContractAssertion {
  const required = getRequiredKeys(contract);
  const issues: ProductRuntimeContractIssue[] = [];

  if (target.siteKey !== contract.siteKey) {
    issues.push({
      code: 'site_key_mismatch',
      expected: contract.siteKey,
      actual: target.siteKey,
    });
  }

  issues.push(
    ...required.workers
      .filter((key) => !(key in (target.workers ?? {})))
      .map((key) => ({ code: 'missing_worker' as const, key })),
    ...collectMissingEnabledKeys({
      required: required.bindings,
      actual: target.runtime?.bindings,
      code: 'missing_binding',
    }),
    ...collectMissingEnabledKeys({
      required: required.resources,
      actual: target.runtime?.resources,
      code: 'missing_resource',
    }),
    ...collectMissingEnabledKeys({
      required: required.vars,
      actual: target.runtime?.vars,
      code: 'missing_var',
    }),
    ...collectMissingEnabledKeys({
      required: required.secrets,
      actual: target.runtime?.secrets,
      code: 'missing_secret',
    })
  );

  return {
    contract,
    required,
    issues,
  };
}

export function assertProductRuntimeContract(input: {
  contract: ProductRuntimeContract;
  target: ProductRuntimeContractTarget;
}): ProductRuntimeContractAssertion {
  const result = checkProductRuntimeContract(input);
  if (result.issues.length > 0) {
    throw new ProductRuntimeContractError(result.issues);
  }
  return result;
}
