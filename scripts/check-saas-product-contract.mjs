import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

import * as productRuntimeAssertNamespace from '../src/domains/product-runtime/application/assert-runtime-contract.ts';
import * as productRuntimeContractNamespace from '../src/domains/product-runtime/domain/contract.ts';
import { getProductRuntimeContractsForSite } from './lib/product-runtime-contracts.mjs';
import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
  resolveSiteConfigPath,
} from './lib/site-config.mjs';
import {
  resolveSiteDeploySettingsPath,
  validateSiteDeploySettings,
} from './lib/site-deploy-settings.mjs';
import {
  readCurrentSitePricing,
  resolveSitePricingPath,
} from './lib/site-pricing.mjs';

const ROOT_DIR = process.cwd();
const COMMON_ENTITLEMENT_KEYS = new Set([
  'low_res_download',
  'max_upload_mb',
  'retention_days',
]);
const ISSUE_LEVEL = {
  BLOCKER: 'blocker',
  WARNING: 'warning',
};
const productRuntimeAssertModule =
  productRuntimeAssertNamespace.default ?? productRuntimeAssertNamespace;
const { checkProductRuntimeContract, formatProductRuntimeContractIssue } =
  productRuntimeAssertModule;
const productRuntimeContractModule =
  productRuntimeContractNamespace.default ?? productRuntimeContractNamespace;
const { getProductRuntimeRequiredKeys } = productRuntimeContractModule;

function relativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join('/');
}

function source(kind, sourcePath, key) {
  return {
    kind,
    path: sourcePath ? relativePath(sourcePath) : undefined,
    key,
  };
}

function issue(level, code, message, sources = []) {
  return { level, code, message, sources };
}

function section(status, value, sources, issues = []) {
  return { status, value, sources, issues };
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCheckoutEnabled(item) {
  return item.checkout_enabled !== false && item.amount > 0;
}

function readTextIfExists(filePath) {
  if (!existsSync(filePath)) {
    return '';
  }

  return readFileSync(filePath, 'utf8');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function collectPricingItems(sitePricing) {
  return sitePricing?.pricing?.items ?? [];
}

function isPropertyName(node, name) {
  return (
    (ts.isIdentifier(node) || ts.isStringLiteral(node)) && node.text === name
  );
}

function isStringLike(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function hasSettingDefinition(sourcePath, settingName) {
  const sourceText = readTextIfExists(sourcePath);
  if (!sourceText) {
    return false;
  }

  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let found = false;

  function visit(node) {
    if (found) {
      return;
    }

    if (
      ts.isPropertyAssignment(node) &&
      isPropertyName(node.name, 'name') &&
      isStringLike(node.initializer) &&
      node.initializer.text === settingName
    ) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function collectStringLiterals(sourcePath) {
  const sourceText = readTextIfExists(sourcePath);
  if (!sourceText) {
    return new Set();
  }

  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const values = new Set();

  function visit(node) {
    if (isStringLike(node)) {
      values.add(node.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return values;
}

function envContractStatus(sourcePath, keys, match = 'all') {
  const values = collectStringLiterals(sourcePath);
  const hasKey =
    match === 'any'
      ? keys.some((key) => values.has(key))
      : keys.every((key) => values.has(key));

  return hasKey ? 'runtime_owned' : 'missing';
}

function sourceTextIncludes(sourcePath, text) {
  return readTextIfExists(sourcePath).includes(text);
}

function sourceTextMatches(sourcePath, pattern) {
  return pattern.test(readTextIfExists(sourcePath));
}

function envContractHasKey(sourcePath, key) {
  return collectStringLiterals(sourcePath).has(key);
}

function collectEntitlementKeys(items) {
  const keys = new Set();
  for (const item of items) {
    for (const key of Object.keys(item.entitlements ?? {})) {
      keys.add(key);
    }
  }
  return [...keys].sort();
}

function classifyEntitlementKey(key, siteKey) {
  if (COMMON_ENTITLEMENT_KEYS.has(key)) {
    return 'common_known';
  }

  if (key.startsWith(`product.${siteKey}.`)) {
    return 'product_owned';
  }

  return 'raw_unknown';
}

function auditSite(site, sitePath, siteIssues = []) {
  const checks = [
    ['key', site.key],
    ['brand.appName', site.brand?.appName],
    ['brand.appUrl', site.brand?.appUrl],
    ['brand.supportEmail', site.brand?.supportEmail],
    ['brand.logo', site.brand?.logo],
    ['brand.favicon', site.brand?.favicon],
    ['brand.previewImage', site.brand?.previewImage],
    ['capabilities', site.capabilities],
  ];
  const issues = [
    ...siteIssues,
    ...checks
      .filter(([, value]) => {
        if (typeof value === 'object' && value !== null) {
          return Object.keys(value).length === 0;
        }
        return !hasText(value);
      })
      .map(([key]) =>
        issue(
          ISSUE_LEVEL.BLOCKER,
          'missing_site_field',
          `Missing site ${key}`,
          [source('site_config', sitePath, key)]
        )
      ),
  ];

  return section(
    issues.length === 0 ? 'resolved' : 'partial',
    {
      key: site.key,
      appName: site.brand?.appName,
      appUrl: site.brand?.appUrl,
      supportEmail: site.brand?.supportEmail,
      logo: site.brand?.logo,
      favicon: site.brand?.favicon,
      previewImage: site.brand?.previewImage,
      capabilities: site.capabilities,
    },
    [source('site_config', sitePath)],
    issues
  );
}

function readLooseSiteConfig(sitePath, siteKey) {
  const fallback = { key: siteKey, brand: {}, capabilities: {} };
  const sourceText = readTextIfExists(sitePath);
  if (!sourceText) {
    return fallback;
  }

  try {
    const site = JSON.parse(sourceText);
    if (!isPlainObject(site)) {
      return fallback;
    }

    return {
      ...site,
      key: hasText(site.key) ? site.key : siteKey,
      brand: isPlainObject(site.brand) ? site.brand : {},
      capabilities: isPlainObject(site.capabilities) ? site.capabilities : {},
    };
  } catch {
    return fallback;
  }
}

function readSiteForReport({ rootDir, siteKey, sitePath }) {
  try {
    return {
      site: readCurrentSiteConfig({ rootDir, siteKey }),
      issues: [],
    };
  } catch (error) {
    return {
      site: readLooseSiteConfig(sitePath, siteKey),
      issues: [
        issue(
          ISSUE_LEVEL.BLOCKER,
          'invalid_site_config',
          `Site config could not be read or validated: ${getErrorMessage(error)}`,
          [source('site_config', sitePath)]
        ),
      ],
    };
  }
}

function readPricingForReport({ rootDir, site, siteKey, pricingPath }) {
  try {
    return {
      sitePricing: readCurrentSitePricing({
        rootDir,
        site,
        siteKey,
      }),
      issues: [],
    };
  } catch (error) {
    return {
      sitePricing: null,
      issues: [
        issue(
          ISSUE_LEVEL.BLOCKER,
          'invalid_pricing_file',
          `Pricing file could not be read or validated: ${getErrorMessage(error)}`,
          [source('pricing', pricingPath)]
        ),
      ],
    };
  }
}

function readDeploySettingsForReport({ deploySettingsPath, site }) {
  try {
    const deploySettings = JSON.parse(readFileSync(deploySettingsPath, 'utf8'));
    validateSiteDeploySettings(deploySettings, { siteConfig: site });

    return {
      deploySettings,
      issues: [],
    };
  } catch (error) {
    return {
      deploySettings: null,
      issues: [
        issue(
          ISSUE_LEVEL.BLOCKER,
          'invalid_deploy_settings',
          `Deploy settings could not be read or validated: ${getErrorMessage(error)}`,
          [source('deploy_settings', deploySettingsPath)]
        ),
      ],
    };
  }
}

function resolveMappingOwnership({
  item,
  paymentCapability,
  settingsSourcePath,
}) {
  if (hasText(item.payment_product_id)) {
    return {
      status: 'resolved',
      owner: 'pricing',
      source: source('pricing', null, `${item.product_id}.payment_product_id`),
    };
  }

  const hasCurrencyMapping = (item.currencies ?? []).some((currency) =>
    hasText(currency.payment_product_id)
  );
  if (hasCurrencyMapping) {
    return {
      status: 'resolved',
      owner: 'pricing',
      source: source('pricing', null, `${item.product_id}.currencies`),
    };
  }

  if (
    paymentCapability === 'creem' &&
    hasSettingDefinition(settingsSourcePath, 'creem_product_ids')
  ) {
    return {
      status: 'runtime_owned',
      owner: 'admin_setting',
      source: source(
        'settings_definition',
        settingsSourcePath,
        'creem_product_ids'
      ),
    };
  }

  return {
    status: 'missing',
    owner: 'unknown',
    source: source('derived', null, item.product_id),
  };
}

function auditCommercial({
  site,
  sitePricing,
  sitePath,
  pricingPath,
  pricingIssues,
  settingsSourcePath,
}) {
  if (!sitePricing) {
    const issues = pricingIssues.length
      ? pricingIssues
      : site.capabilities?.payment && site.capabilities.payment !== 'none'
        ? [
            issue(
              ISSUE_LEVEL.BLOCKER,
              'missing_pricing_file',
              `Missing pricing file for payment-enabled site ${site.key}`,
              [source('pricing', pricingPath)]
            ),
          ]
        : [];

    return section(
      issues.length === 0 ? 'not_applicable' : 'missing',
      {
        billing: site.capabilities?.payment ?? 'none',
        pricingFile: pricingIssues.length
          ? 'invalid'
          : existsSync(pricingPath)
            ? 'resolved'
            : 'missing',
        planCount: 0,
        paidCheckoutPlanCount: 0,
        plans: [],
      },
      [source('pricing', pricingPath)],
      issues
    );
  }

  const items = collectPricingItems(sitePricing);
  const planIssues = [];
  const plans = items.map((item) => {
    const mappingOwnership = isCheckoutEnabled(item)
      ? resolveMappingOwnership({
          item,
          paymentCapability: site.capabilities?.payment,
          settingsSourcePath,
        })
      : {
          status: 'not_applicable',
          owner: 'none',
          source: source('derived', null, item.product_id),
        };

    if (isCheckoutEnabled(item) && mappingOwnership.status === 'missing') {
      planIssues.push(
        issue(
          ISSUE_LEVEL.BLOCKER,
          'missing_payment_product_mapping',
          `Paid checkout plan ${item.product_id} has no payment product mapping path`,
          [source('pricing', pricingPath, item.product_id)]
        )
      );
    }

    return {
      productId: item.product_id,
      title: item.title,
      checkoutEnabled: isCheckoutEnabled(item),
      interval: item.interval,
      amount: item.amount,
      currency: item.currency,
      paymentProductMapping: {
        status: mappingOwnership.status,
        owner: mappingOwnership.owner,
        sources: [mappingOwnership.source],
      },
    };
  });

  return section(
    planIssues.length === 0 ? 'resolved' : 'partial',
    {
      billing: site.capabilities?.payment ?? 'none',
      pricingFile: 'resolved',
      planCount: items.length,
      paidCheckoutPlanCount: items.filter(isCheckoutEnabled).length,
      plans,
    },
    [
      source('pricing', pricingPath),
      source('site_config', sitePath, 'capabilities.payment'),
    ],
    planIssues
  );
}

function auditEntitlementKeys({ siteKey, items, pricingPath }) {
  const entries = collectEntitlementKeys(items).map((key) => ({
    key,
    classification: classifyEntitlementKey(key, siteKey),
  }));
  const issues = entries
    .filter((entry) => entry.classification === 'raw_unknown')
    .map((entry) =>
      issue(
        ISSUE_LEVEL.WARNING,
        'raw_entitlement_key',
        `Raw entitlement key ${entry.key} should migrate to common or product-owned naming`,
        [source('pricing', pricingPath, `entitlements.${entry.key}`)]
      )
    );

  return section(
    issues.length === 0 ? 'resolved' : 'partial',
    {
      keys: entries,
      allowedProductOwnedPrefix: `product.${siteKey}.`,
    },
    [source('pricing', pricingPath)],
    issues
  );
}

function settingStatus(sourcePath, settingName) {
  return hasSettingDefinition(sourcePath, settingName)
    ? 'runtime_owned'
    : 'missing';
}

function deployRequirementStatus(deploySettings, group, key) {
  if (!deploySettings) {
    return 'missing';
  }

  return deploySettings?.bindingRequirements?.[group]?.[key]
    ? 'runtime_owned'
    : 'not_applicable';
}

function envBackedDeployRequirementStatus({
  deploySettings,
  group,
  key,
  envContractPath,
  envKeys,
  match,
}) {
  const deployStatus = deployRequirementStatus(deploySettings, group, key);
  if (deployStatus !== 'runtime_owned') {
    return deployStatus;
  }

  return envContractStatus(envContractPath, envKeys, match);
}

function auditRuntimeOwnership({
  site,
  deploySettings,
  deploySettingsPath,
  deployIssues,
  paymentSettingsPath,
  envContractPath,
}) {
  const paymentCapability = site.capabilities?.payment ?? 'none';
  const entries = [
    {
      name: 'payment provider product mapping',
      expectedKey:
        paymentCapability === 'creem'
          ? 'creem_product_ids'
          : `${paymentCapability}_product_mapping`,
      owner: paymentCapability === 'creem' ? 'admin_setting' : 'runtime',
      status:
        paymentCapability === 'creem'
          ? settingStatus(paymentSettingsPath, 'creem_product_ids')
          : 'not_applicable',
      sources: [
        source('settings_definition', paymentSettingsPath, 'creem_product_ids'),
      ],
    },
    {
      name: 'payment provider secrets',
      expectedKey:
        paymentCapability === 'creem'
          ? 'CREEM_API_KEY, CREEM_SIGNING_SECRET'
          : `${String(paymentCapability).toUpperCase()} provider secrets`,
      owner: 'cloudflare_secret',
      status:
        paymentCapability === 'creem'
          ? envContractStatus(envContractPath, [
              'CREEM_API_KEY',
              'CREEM_SIGNING_SECRET',
            ])
          : 'not_applicable',
      sources: [
        source('runtime_env', envContractPath, 'CREEM_API_KEY'),
        source('runtime_env', envContractPath, 'CREEM_SIGNING_SECRET'),
      ],
    },
    {
      name: 'auth shared secret',
      expectedKey: 'BETTER_AUTH_SECRET or AUTH_SECRET',
      owner: 'cloudflare_secret',
      status: envBackedDeployRequirementStatus({
        deploySettings,
        group: 'secrets',
        key: 'authSharedSecret',
        envContractPath,
        envKeys: ['BETTER_AUTH_SECRET', 'AUTH_SECRET'],
        match: 'any',
      }),
      sources: [
        source(
          'deploy_settings',
          deploySettingsPath,
          'secrets.authSharedSecret'
        ),
        source('runtime_env', envContractPath, 'BETTER_AUTH_SECRET'),
        source('runtime_env', envContractPath, 'AUTH_SECRET'),
      ],
    },
    {
      name: 'Google OAuth secrets',
      expectedKey: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET',
      owner: 'cloudflare_secret',
      status: envBackedDeployRequirementStatus({
        deploySettings,
        group: 'secrets',
        key: 'googleOauth',
        envContractPath,
        envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      }),
      sources: [
        source('deploy_settings', deploySettingsPath, 'secrets.googleOauth'),
        source('runtime_env', envContractPath, 'GOOGLE_CLIENT_ID'),
        source('runtime_env', envContractPath, 'GOOGLE_CLIENT_SECRET'),
      ],
    },
    {
      name: 'GitHub OAuth secrets',
      expectedKey: 'GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET',
      owner: 'cloudflare_secret',
      status: envBackedDeployRequirementStatus({
        deploySettings,
        group: 'secrets',
        key: 'githubOauth',
        envContractPath,
        envKeys: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
      }),
      sources: [
        source('deploy_settings', deploySettingsPath, 'secrets.githubOauth'),
        source('runtime_env', envContractPath, 'GITHUB_CLIENT_ID'),
        source('runtime_env', envContractPath, 'GITHUB_CLIENT_SECRET'),
      ],
    },
    {
      name: 'storage public URL',
      expectedKey: 'STORAGE_PUBLIC_BASE_URL',
      owner: 'cloudflare_var',
      status: envBackedDeployRequirementStatus({
        deploySettings,
        group: 'vars',
        key: 'storagePublicBaseUrl',
        envContractPath,
        envKeys: ['STORAGE_PUBLIC_BASE_URL'],
      }),
      sources: [
        source(
          'deploy_settings',
          deploySettingsPath,
          'vars.storagePublicBaseUrl'
        ),
        source('runtime_env', envContractPath, 'STORAGE_PUBLIC_BASE_URL'),
      ],
    },
    {
      name: 'AI Remover cleanup secret',
      expectedKey: 'REMOVER_CLEANUP_SECRET',
      owner: 'cloudflare_secret',
      status: envBackedDeployRequirementStatus({
        deploySettings,
        group: 'secrets',
        key: 'removerCleanup',
        envContractPath,
        envKeys: ['REMOVER_CLEANUP_SECRET'],
      }),
      sources: [
        source('deploy_settings', deploySettingsPath, 'secrets.removerCleanup'),
        source('runtime_env', envContractPath, 'REMOVER_CLEANUP_SECRET'),
      ],
    },
  ];
  const issues = [
    ...deployIssues,
    ...entries
      .filter((entry) => entry.status === 'missing')
      .map((entry) =>
        issue(
          ISSUE_LEVEL.WARNING,
          'missing_runtime_owner',
          `Runtime-owned field ${entry.name} has no configured owner`,
          entry.sources
        )
      ),
  ];

  return section(
    issues.length === 0 ? 'runtime_owned' : 'partial',
    { fields: entries },
    [
      source('deploy_settings', deploySettingsPath),
      source('settings_definition', paymentSettingsPath),
      source('runtime_env', envContractPath),
    ],
    issues
  );
}

function runtimeRequirementEntry({ key, status, sources }) {
  return { key, status, sources };
}

function runtimeRequirementEntries({ keys, actual, sourceKind, sourcePath }) {
  return keys.map((key) =>
    runtimeRequirementEntry({
      key,
      status:
        Object.prototype.hasOwnProperty.call(actual ?? {}, key) &&
        actual?.[key] !== false
          ? 'declared'
          : 'missing',
      sources: [source(sourceKind, sourcePath, key)],
    })
  );
}

function productRuntimeIssueSources({
  issue,
  deploySettingsPath,
  runtimeContractPath,
}) {
  const contractSource = source(
    'product_runtime_contract',
    runtimeContractPath,
    issue.code === 'site_key_mismatch' ? 'siteKey' : issue.key
  );

  switch (issue.code) {
    case 'missing_worker':
      return [
        contractSource,
        source('deploy_settings', deploySettingsPath, `workers.${issue.key}`),
      ];
    case 'missing_binding':
      return [
        contractSource,
        source('deploy_settings', deploySettingsPath, `bindings.${issue.key}`),
      ];
    case 'missing_var':
      return [
        contractSource,
        source('deploy_settings', deploySettingsPath, `vars.${issue.key}`),
      ];
    case 'missing_secret':
      return [
        contractSource,
        source('deploy_settings', deploySettingsPath, `secrets.${issue.key}`),
      ];
    case 'site_key_mismatch':
      return [contractSource, source('deploy_settings', deploySettingsPath)];
  }
}

function auditProductRuntimeContracts({
  siteKey,
  deploySettings,
  deploySettingsPath,
  deployIssues,
  runtimeContractPath,
}) {
  const contracts = getProductRuntimeContractsForSite(siteKey);
  const products = contracts.map((contract) => {
    const required = getProductRuntimeRequiredKeys(contract);
    const result = checkProductRuntimeContract({
      contract,
      target: {
        siteKey,
        workers: deploySettings?.workers ?? {},
        bindingRequirements: deploySettings?.bindingRequirements ?? {},
      },
    });

    return {
      siteKey: contract.siteKey,
      productKey: contract.productKey,
      status: result.issues.length === 0 ? 'resolved' : 'missing',
      workers: runtimeRequirementEntries({
        keys: required.workers,
        actual: deploySettings?.workers,
        sourceKind: 'deploy_settings',
        sourcePath: deploySettingsPath,
      }),
      bindings: runtimeRequirementEntries({
        keys: required.bindings,
        actual: deploySettings?.bindingRequirements?.bindings,
        sourceKind: 'deploy_settings',
        sourcePath: deploySettingsPath,
      }),
      vars: runtimeRequirementEntries({
        keys: required.vars,
        actual: deploySettings?.bindingRequirements?.vars,
        sourceKind: 'deploy_settings',
        sourcePath: deploySettingsPath,
      }),
      secrets: runtimeRequirementEntries({
        keys: required.secrets,
        actual: deploySettings?.bindingRequirements?.secrets,
        sourceKind: 'deploy_settings',
        sourcePath: deploySettingsPath,
      }),
      issues: result.issues,
    };
  });
  const productRuntimeIssues = products.flatMap((product) =>
    product.issues.map((productIssue) =>
      issue(
        ISSUE_LEVEL.BLOCKER,
        `product_runtime_${productIssue.code}`,
        `Product runtime contract ${product.productKey} ${formatProductRuntimeContractIssue(productIssue)}`,
        productRuntimeIssueSources({
          issue: productIssue,
          deploySettingsPath,
          runtimeContractPath,
        })
      )
    )
  );
  const issues = [...deployIssues, ...productRuntimeIssues];

  return section(
    issues.length === 0 ? 'resolved' : 'partial',
    { products },
    [
      source('product_runtime_contract', runtimeContractPath),
      source('deploy_settings', deploySettingsPath),
    ],
    issues
  );
}

function billingEvent({
  eventName,
  representedBy,
  supportStatus,
  sources,
  subscriptionStateEffect,
  entitlementEffect,
  creditEffect,
  usageEffect,
  auditEffect,
  idempotency,
  operatorAction,
  issues = [],
}) {
  return {
    eventName,
    representedBy,
    supportStatus,
    sources,
    subscriptionStateEffect,
    entitlementEffect,
    creditEffect,
    usageEffect,
    auditEffect,
    idempotency,
    operatorAction,
    issues,
  };
}

function billingWarning(code, message, sources) {
  return issue(ISSUE_LEVEL.WARNING, code, message, sources);
}

function collectMissingBillingSourceIssues(sourceEntries) {
  return sourceEntries
    .filter((entry) => !existsSync(entry.path))
    .map((entry) =>
      billingWarning(
        'missing_billing_audit_source',
        `Billing reversal audit source is missing: ${entry.label}`,
        [source(entry.kind, entry.path)]
      )
    );
}

function hasPaymentEventEnum(paymentDomainPath, enumName) {
  return sourceTextMatches(
    paymentDomainPath,
    new RegExp(`\\b${enumName}\\s*=`)
  );
}

function hasPaymentNotifyHandler(processNotifyPath, enumName) {
  return sourceTextMatches(
    processNotifyPath,
    new RegExp(`\\[\\s*PaymentEventType\\.${enumName}\\s*\\]`)
  );
}

function auditBillingReversal(paths) {
  const sourceIssues = collectMissingBillingSourceIssues([
    {
      label: 'payment domain',
      kind: 'billing_domain',
      path: paths.paymentDomain,
    },
    {
      label: 'payment notify process',
      kind: 'billing_application',
      path: paths.processNotify,
    },
    {
      label: 'billing flows',
      kind: 'billing_application',
      path: paths.flows,
    },
    {
      label: 'payment webhook inbox',
      kind: 'billing_infra',
      path: paths.webhookInbox,
    },
    {
      label: 'payment webhook inbox shared contract',
      kind: 'billing_infra',
      path: paths.webhookInboxShared,
    },
    {
      label: 'payment webhook audit',
      kind: 'billing_infra',
      path: paths.webhookAudit,
    },
    {
      label: 'order infra',
      kind: 'billing_infra',
      path: paths.order,
    },
    {
      label: 'subscription infra',
      kind: 'billing_infra',
      path: paths.subscription,
    },
    {
      label: 'credit domain',
      kind: 'billing_domain',
      path: paths.credit,
    },
    {
      label: 'payment notify flow',
      kind: 'billing_application',
      path: paths.paymentNotifyFlow,
    },
    {
      label: 'admin payment replay',
      kind: 'billing_application',
      path: paths.adminReplay,
    },
    {
      label: 'payment notify test',
      kind: 'billing_test',
      path: paths.paymentNotifyTest,
    },
  ]);

  const paymentFailedSources = [
    source(
      'billing_domain',
      paths.paymentDomain,
      'PaymentEventType.PAYMENT_FAILED'
    ),
    source(
      'billing_application',
      paths.processNotify,
      'PAYMENT_NOTIFY_EVENT_HANDLERS'
    ),
    source('billing_test', paths.paymentNotifyTest, 'PAYMENT_FAILED fallback'),
  ];
  const paymentRefundedSources = [
    source(
      'billing_domain',
      paths.paymentDomain,
      'PaymentEventType.PAYMENT_REFUNDED'
    ),
    source(
      'billing_application',
      paths.processNotify,
      'PAYMENT_NOTIFY_EVENT_HANDLERS'
    ),
    source('billing_domain', paths.credit, 'BillingCreditTransactionType'),
  ];
  const renewalSources = [
    source(
      'billing_domain',
      paths.paymentDomain,
      'SubscriptionCycleType.RENEWAL'
    ),
    source(
      'billing_application',
      paths.processNotify,
      'handlePaymentSuccessEvent'
    ),
    source('billing_application', paths.flows, 'handleSubscriptionRenewal'),
    source('billing_infra', paths.order, 'updateSubscriptionInTransaction'),
    source(
      'billing_domain',
      paths.credit,
      'BillingCreditTransactionScene.RENEWAL'
    ),
    source('billing_test', paths.paymentNotifyTest, 'renewal webhook'),
  ];
  const inboxSources = [
    source('billing_infra', paths.webhookInbox, 'rawDigest'),
    source(
      'billing_application',
      paths.paymentNotifyFlow,
      'isFinalizedInboxStatus'
    ),
  ];

  const checkoutHandled =
    hasPaymentEventEnum(paths.paymentDomain, 'CHECKOUT_SUCCESS') &&
    hasPaymentNotifyHandler(paths.processNotify, 'CHECKOUT_SUCCESS') &&
    sourceTextIncludes(paths.flows, 'handleCheckoutSuccess');
  const paymentSuccessHandled =
    hasPaymentEventEnum(paths.paymentDomain, 'PAYMENT_SUCCESS') &&
    hasPaymentNotifyHandler(paths.processNotify, 'PAYMENT_SUCCESS');
  const paymentFailedEnum = hasPaymentEventEnum(
    paths.paymentDomain,
    'PAYMENT_FAILED'
  );
  const paymentRefundedEnum = hasPaymentEventEnum(
    paths.paymentDomain,
    'PAYMENT_REFUNDED'
  );
  const paymentFailedHandled = hasPaymentNotifyHandler(
    paths.processNotify,
    'PAYMENT_FAILED'
  );
  const paymentRefundedHandled = hasPaymentNotifyHandler(
    paths.processNotify,
    'PAYMENT_REFUNDED'
  );
  const subscriptionUpdatedHandled =
    hasPaymentEventEnum(paths.paymentDomain, 'SUBSCRIBE_UPDATED') &&
    hasPaymentNotifyHandler(paths.processNotify, 'SUBSCRIBE_UPDATED') &&
    sourceTextIncludes(paths.flows, 'handleSubscriptionUpdated');
  const subscriptionCanceledHandled =
    hasPaymentEventEnum(paths.paymentDomain, 'SUBSCRIBE_CANCELED') &&
    hasPaymentNotifyHandler(paths.processNotify, 'SUBSCRIBE_CANCELED') &&
    sourceTextIncludes(paths.flows, 'handleSubscriptionCanceled');
  const renewalHandled =
    paymentSuccessHandled &&
    sourceTextIncludes(paths.processNotify, 'SubscriptionCycleType.RENEWAL') &&
    sourceTextIncludes(paths.flows, 'handleSubscriptionRenewal');
  const unknownAuditHandled =
    hasPaymentEventEnum(paths.paymentDomain, 'UNKNOWN') &&
    hasPaymentNotifyHandler(paths.processNotify, 'UNKNOWN') &&
    sourceTextIncludes(paths.processNotify, 'recordUnknownWebhookEvent') &&
    sourceTextIncludes(paths.webhookAudit, 'recordPaymentWebhookAudit');
  const manualCompensationPartial =
    sourceTextIncludes(paths.webhookInboxShared, 'COMPENSATION') &&
    sourceTextIncludes(paths.adminReplay, 'operationKind');

  const events = [
    billingEvent({
      eventName: 'checkout.success',
      supportStatus: checkoutHandled ? 'handled' : 'unknown',
      sources: [
        source(
          'billing_domain',
          paths.paymentDomain,
          'PaymentEventType.CHECKOUT_SUCCESS'
        ),
        source(
          'billing_application',
          paths.processNotify,
          'handleCheckoutSuccessEvent'
        ),
        source('billing_application', paths.flows, 'handleCheckoutSuccess'),
        source('billing_infra', paths.order, 'updateOrderInTransaction'),
        source('billing_domain', paths.credit, 'buildGrantCreditForOrder'),
        ...inboxSources,
      ],
      subscriptionStateEffect: 'changes',
      entitlementEffect: 'grants',
      creditEffect: 'grants',
      usageEffect: 'no_change',
      auditEffect: 'writes_audit',
      idempotency: 'explicit',
      operatorAction: 'not_required',
    }),
    billingEvent({
      eventName: 'payment.success',
      supportStatus: paymentSuccessHandled ? 'handled' : 'unknown',
      sources: [
        source(
          'billing_domain',
          paths.paymentDomain,
          'PaymentEventType.PAYMENT_SUCCESS'
        ),
        source(
          'billing_application',
          paths.processNotify,
          'handlePaymentSuccessEvent'
        ),
        ...inboxSources,
      ],
      subscriptionStateEffect: 'changes',
      entitlementEffect: 'grants',
      creditEffect: 'grants',
      usageEffect: 'no_change',
      auditEffect: 'writes_audit',
      idempotency: 'explicit',
      operatorAction: 'not_required',
    }),
    billingEvent({
      eventName: 'payment.failed',
      supportStatus: paymentFailedHandled
        ? 'handled'
        : paymentFailedEnum
          ? 'unsupported'
          : 'unknown',
      sources: paymentFailedSources,
      subscriptionStateEffect: 'no_change',
      entitlementEffect: 'no_change',
      creditEffect: 'no_change',
      usageEffect: 'no_change',
      auditEffect: 'writes_audit',
      idempotency: 'explicit',
      operatorAction: 'unknown',
      issues:
        paymentFailedEnum && !paymentFailedHandled
          ? [
              billingWarning(
                'missing_payment_failed_handler',
                'payment.failed is canonical but has no payment notify handler and falls through unsupported handling',
                paymentFailedSources
              ),
            ]
          : [],
    }),
    billingEvent({
      eventName: 'payment.refunded',
      supportStatus: paymentRefundedHandled
        ? 'partially_handled'
        : paymentRefundedEnum
          ? 'unsupported'
          : 'unknown',
      sources: paymentRefundedSources,
      subscriptionStateEffect: 'missing',
      entitlementEffect: 'missing',
      creditEffect: 'missing',
      usageEffect: 'missing',
      auditEffect: 'writes_audit',
      idempotency: 'explicit',
      operatorAction: 'required',
      issues: paymentRefundedEnum
        ? [
            paymentRefundedHandled
              ? billingWarning(
                  'missing_payment_refunded_reversal_effects',
                  'payment.refunded has a notify handler but no source-mapped reversal coverage for subscription, entitlement, credit, or usage effects',
                  paymentRefundedSources
                )
              : billingWarning(
                  'missing_payment_refunded_handler',
                  'payment.refunded is canonical but has no reversal handler for subscription, entitlement, credit, or usage effects',
                  paymentRefundedSources
                ),
          ]
        : [],
    }),
    billingEvent({
      eventName: 'subscribe.updated',
      supportStatus: subscriptionUpdatedHandled ? 'handled' : 'unknown',
      sources: [
        source(
          'billing_domain',
          paths.paymentDomain,
          'PaymentEventType.SUBSCRIBE_UPDATED'
        ),
        source(
          'billing_application',
          paths.processNotify,
          'handleSubscriptionUpdatedEvent'
        ),
        source('billing_application', paths.flows, 'handleSubscriptionUpdated'),
        source(
          'billing_infra',
          paths.subscription,
          'updateSubscriptionBySubscriptionNoIfNotCanceled'
        ),
        ...inboxSources,
      ],
      subscriptionStateEffect: 'changes',
      entitlementEffect: 'downgrades',
      creditEffect: 'no_change',
      usageEffect: 'no_change',
      auditEffect: 'writes_audit',
      idempotency: 'explicit',
      operatorAction: 'not_required',
    }),
    billingEvent({
      eventName: 'subscribe.canceled',
      supportStatus: subscriptionCanceledHandled ? 'handled' : 'unknown',
      sources: [
        source(
          'billing_domain',
          paths.paymentDomain,
          'PaymentEventType.SUBSCRIBE_CANCELED'
        ),
        source(
          'billing_application',
          paths.processNotify,
          'handleSubscriptionCanceledEvent'
        ),
        source(
          'billing_application',
          paths.flows,
          'handleSubscriptionCanceled'
        ),
        source(
          'billing_infra',
          paths.subscription,
          'updateSubscriptionBySubscriptionNo'
        ),
        ...inboxSources,
      ],
      subscriptionStateEffect: 'changes',
      entitlementEffect: 'downgrades',
      creditEffect: 'no_change',
      usageEffect: 'no_change',
      auditEffect: 'writes_audit',
      idempotency: 'explicit',
      operatorAction: 'not_required',
      issues: [
        billingWarning(
          'unclear_subscription_cancel_downgrade_timing',
          'subscribe.canceled stores canceledEndAt but sets status canceled immediately; cancel-at-period-end versus immediate downgrade is not explicit',
          [
            source(
              'billing_application',
              paths.flows,
              'handleSubscriptionCanceled'
            ),
            source(
              'billing_infra',
              paths.subscription,
              'SubscriptionStatus.CANCELED'
            ),
          ]
        ),
      ],
    }),
    billingEvent({
      eventName: 'subscription.renewed',
      representedBy: 'payment.success + SubscriptionCycleType.RENEWAL',
      supportStatus: renewalHandled ? 'handled' : 'unknown',
      sources: renewalSources,
      subscriptionStateEffect: 'changes',
      entitlementEffect: 'grants',
      creditEffect: 'grants',
      usageEffect: 'no_change',
      auditEffect: 'writes_audit',
      idempotency: 'fallback',
      operatorAction: 'required',
      issues: [
        billingWarning(
          'renewal_credit_grant_failure_contract_partial',
          'subscription renewal writes order, subscription, and credit in one transaction, but credit grant failure compensation is only covered by generic webhook process_failed/replay handling',
          [
            source(
              'billing_application',
              paths.flows,
              'handleSubscriptionRenewal'
            ),
            source(
              'billing_infra',
              paths.order,
              'updateSubscriptionInTransaction'
            ),
            source(
              'billing_application',
              paths.paymentNotifyFlow,
              'markPaymentWebhookInboxProcessFailed'
            ),
            source(
              'billing_application',
              paths.adminReplay,
              'executeAdminPaymentReplay'
            ),
          ]
        ),
      ],
    }),
    billingEvent({
      eventName: 'subscription.expired',
      supportStatus: 'unsupported',
      sources: [
        source(
          'billing_domain',
          paths.paymentDomain,
          'SubscriptionStatus.EXPIRED'
        ),
        source(
          'billing_application',
          paths.processNotify,
          'PAYMENT_NOTIFY_EVENT_HANDLERS'
        ),
      ],
      subscriptionStateEffect: 'missing',
      entitlementEffect: 'missing',
      creditEffect: 'no_change',
      usageEffect: 'expires',
      auditEffect: 'unknown',
      idempotency: 'unknown',
      operatorAction: 'unknown',
      issues: [
        billingWarning(
          'missing_subscription_expired_event',
          'subscription.expired has no canonical payment event or notify handler',
          [
            source('billing_domain', paths.paymentDomain, 'PaymentEventType'),
            source(
              'billing_application',
              paths.processNotify,
              'PAYMENT_NOTIFY_EVENT_HANDLERS'
            ),
          ]
        ),
      ],
    }),
    billingEvent({
      eventName: 'chargeback/dispute',
      supportStatus: 'unsupported',
      sources: [
        source('billing_domain', paths.paymentDomain, 'PaymentEventType'),
        source(
          'billing_application',
          paths.processNotify,
          'PAYMENT_NOTIFY_EVENT_HANDLERS'
        ),
      ],
      subscriptionStateEffect: 'missing',
      entitlementEffect: 'missing',
      creditEffect: 'missing',
      usageEffect: 'missing',
      auditEffect: 'unknown',
      idempotency: 'unknown',
      operatorAction: 'required',
      issues: [
        billingWarning(
          'missing_chargeback_dispute_event',
          'chargeback/dispute has no canonical event, handler, or reversal policy',
          [
            source('billing_domain', paths.paymentDomain, 'PaymentEventType'),
            source(
              'billing_application',
              paths.processNotify,
              'PAYMENT_NOTIFY_EVENT_HANDLERS'
            ),
          ]
        ),
      ],
    }),
    billingEvent({
      eventName: 'partial refund',
      supportStatus: 'unsupported',
      sources: paymentRefundedSources,
      subscriptionStateEffect: 'missing',
      entitlementEffect: 'missing',
      creditEffect: 'missing',
      usageEffect: 'missing',
      auditEffect: 'unknown',
      idempotency: 'unknown',
      operatorAction: 'required',
      issues: [
        billingWarning(
          'missing_partial_refund_policy',
          'partial refund has no policy for proportional credit reversal, entitlement downgrade, or audit/operator outcome',
          paymentRefundedSources
        ),
      ],
    }),
    billingEvent({
      eventName: 'refund after usage consumed',
      supportStatus: 'unsupported',
      sources: paymentRefundedSources,
      subscriptionStateEffect: 'missing',
      entitlementEffect: 'missing',
      creditEffect: 'missing',
      usageEffect: 'missing',
      auditEffect: 'unknown',
      idempotency: 'unknown',
      operatorAction: 'required',
      issues: [
        billingWarning(
          'missing_refund_after_usage_policy',
          'refund after usage consumed has no debt, negative-credit, reversal, or audit policy',
          paymentRefundedSources
        ),
      ],
    }),
    billingEvent({
      eventName: 'manual compensation',
      supportStatus: manualCompensationPartial
        ? 'partially_handled'
        : 'unsupported',
      sources: [
        source(
          'billing_infra',
          paths.webhookInboxShared,
          'PAYMENT_WEBHOOK_OPERATION_KIND.COMPENSATION'
        ),
        source(
          'billing_application',
          paths.adminReplay,
          'executeAdminPaymentReplay'
        ),
        source(
          'billing_domain',
          paths.credit,
          'BillingCreditTransactionType.GRANT'
        ),
      ],
      subscriptionStateEffect: 'unknown',
      entitlementEffect: 'missing',
      creditEffect: 'missing',
      usageEffect: 'missing',
      auditEffect: manualCompensationPartial ? 'writes_audit' : 'missing',
      idempotency: 'unknown',
      operatorAction: 'required',
      issues: [
        billingWarning(
          'manual_compensation_contract_partial',
          'manual compensation has a webhook replay operation kind, but no dedicated operator primitive for credit grant/reversal with a complete compensation contract',
          [
            source(
              'billing_infra',
              paths.webhookInboxShared,
              'PAYMENT_WEBHOOK_OPERATION_KIND.COMPENSATION'
            ),
            source(
              'billing_application',
              paths.adminReplay,
              'PaymentReplayActionSchema'
            ),
            source(
              'billing_domain',
              paths.credit,
              'BillingCreditTransactionType'
            ),
          ]
        ),
      ],
    }),
    billingEvent({
      eventName: 'unknown/unsupported webhook',
      supportStatus: unknownAuditHandled ? 'handled' : 'unknown',
      sources: [
        source(
          'billing_domain',
          paths.paymentDomain,
          'PaymentEventType.UNKNOWN'
        ),
        source(
          'billing_application',
          paths.processNotify,
          'handleUnknownEvent'
        ),
        source(
          'billing_infra',
          paths.webhookAudit,
          'recordPaymentWebhookAudit'
        ),
        ...inboxSources,
      ],
      subscriptionStateEffect: 'no_change',
      entitlementEffect: 'no_change',
      creditEffect: 'no_change',
      usageEffect: 'no_change',
      auditEffect: unknownAuditHandled ? 'writes_audit' : 'unknown',
      idempotency: 'explicit',
      operatorAction: 'not_required',
    }),
  ];

  const eventIssues = events.flatMap((event) => event.issues);

  return section(
    eventIssues.length === 0 && sourceIssues.length === 0
      ? 'resolved'
      : 'partial',
    { events },
    [
      source('billing_domain', paths.paymentDomain),
      source('billing_application', paths.processNotify),
      source('billing_application', paths.flows),
      source('billing_infra', paths.webhookInbox),
      source('billing_infra', paths.order),
      source('billing_infra', paths.subscription),
      source('billing_domain', paths.credit),
    ],
    [...sourceIssues, ...eventIssues]
  );
}

function providerRequirement({ name, owner, status, sources }) {
  return { name, owner, status, sources };
}

function providerModel({ modelId, source: modelSource, sources }) {
  return { modelId, source: modelSource, sources };
}

function providerFallback({ status, description, sources }) {
  return { status, description, sources };
}

function providerReadinessEntry({
  providerId,
  sourceOwner,
  supportStatus,
  taskMode,
  inputMedia,
  inputDetail,
  outputMedia,
  defaultModel,
  modelSource,
  requiredBindings = [],
  requiredSecrets = [],
  requiredVars = [],
  fallbackPolicy,
  sources,
  issues = [],
}) {
  return {
    providerId,
    sourceOwner,
    supportStatus,
    taskMode,
    inputMedia,
    inputDetail,
    outputMedia,
    defaultModel,
    modelSource,
    requiredBindings,
    requiredSecrets,
    requiredVars,
    fallbackPolicy,
    sources,
    issues,
  };
}

function providerWarning(code, message, sources) {
  return issue(ISSUE_LEVEL.WARNING, code, message, sources);
}

function collectMissingProviderSourceIssues(sourceEntries) {
  return sourceEntries
    .filter((entry) => !existsSync(entry.path))
    .map((entry) =>
      providerWarning(
        'missing_provider_audit_source',
        `Provider readiness audit source is missing: ${entry.label}`,
        [source(entry.kind, entry.path)]
      )
    );
}

function envKeyRequirement({
  key,
  owner = 'runtime_owned',
  envContractPath,
  usageSource,
  usageKind = 'provider_application',
  usageKey = key,
  bindingDefined = false,
}) {
  const inEnvContract = envContractHasKey(envContractPath, key);
  const hasUsage = usageSource
    ? sourceTextIncludes(usageSource, key) || bindingDefined
    : bindingDefined;
  const status =
    inEnvContract && hasUsage
      ? owner === 'runtime_owned'
        ? 'runtime_owned'
        : 'binding_defined'
      : inEnvContract
        ? 'binding_defined'
        : 'missing';

  return providerRequirement({
    name: key,
    owner,
    status,
    sources: [
      source('runtime_env', envContractPath, key),
      usageSource ? source(usageKind, usageSource, usageKey) : undefined,
    ].filter(Boolean),
  });
}

function providerRegistrationStatus(servicePath, providerClassName) {
  return sourceTextIncludes(servicePath, providerClassName) &&
    sourceTextIncludes(servicePath, 'registry.addUnique')
    ? 'partial'
    : 'missing';
}

function providerEntryIssueForMissingRegistration({
  providerId,
  bindingPath,
  servicePath,
  key,
}) {
  return providerWarning(
    'provider_registration_missing',
    `Provider ${providerId} has binding definitions but no registered provider implementation`,
    [
      source('provider_application', bindingPath, key),
      source('provider_application', servicePath, 'getAIService'),
    ]
  );
}

function auditProviderReadiness({
  paths,
  deploySettings,
  deploySettingsPath,
  envContractPath,
}) {
  const sourceIssues = collectMissingProviderSourceIssues([
    {
      label: 'AI Remover provider adapter',
      kind: 'provider_route',
      path: paths.removerProviderAdapter,
    },
    {
      label: 'AI Remover provider domain',
      kind: 'provider_domain',
      path: paths.removerProvider,
    },
    {
      label: 'AI service registration',
      kind: 'provider_application',
      path: paths.aiService,
    },
    {
      label: 'AI provider bindings',
      kind: 'provider_application',
      path: paths.providerBindings,
    },
    {
      label: 'AI settings runtime contracts',
      kind: 'provider_application',
      path: paths.settingsRuntimeContracts,
    },
    {
      label: 'AI extension provider exports',
      kind: 'provider_extension',
      path: paths.aiProviders,
    },
    {
      label: 'Kie provider',
      kind: 'provider_extension',
      path: paths.kieProvider,
    },
    {
      label: 'Replicate provider',
      kind: 'provider_extension',
      path: paths.replicateProvider,
    },
    {
      label: 'runtime env helpers',
      kind: 'provider_runtime',
      path: paths.runtimeEnv,
    },
    {
      label: 'AI notify route',
      kind: 'provider_route',
      path: paths.aiNotifyRoute,
    },
    {
      label: 'AI notify signature',
      kind: 'provider_route',
      path: paths.aiNotifySignature,
    },
    {
      label: 'AI generate handler',
      kind: 'provider_route',
      path: paths.aiGenerateHandler,
    },
  ]);

  const selectedProviderDefaulted =
    sourceTextIncludes(paths.removerProviderAdapter, 'REMOVER_AI_PROVIDER') &&
    sourceTextIncludes(
      paths.removerProviderAdapter,
      'CLOUDFLARE_WORKERS_AI_PROVIDER'
    );
  const selectedModelDefaulted =
    sourceTextIncludes(paths.removerProviderAdapter, 'REMOVER_AI_MODEL') &&
    sourceTextIncludes(
      paths.removerProvider,
      'DEFAULT_CLOUDFLARE_INPAINTING_MODEL'
    );
  const workersAiBindingReady =
    deployRequirementStatus(deploySettings, 'bindings', 'workersAi') ===
      'runtime_owned' &&
    sourceTextIncludes(paths.runtimeEnv, 'getCloudflareAIBinding') &&
    sourceTextIncludes(paths.removerProviderAdapter, 'getCloudflareAIBinding');
  const workersAiSync =
    sourceTextIncludes(paths.removerProvider, 'ai.run') &&
    sourceTextIncludes(
      paths.removerProvider,
      'Workers AI remover tasks complete during submit'
    );
  const notifyRouteAvailable =
    sourceTextIncludes(paths.aiNotifyRoute, 'POST') &&
    sourceTextIncludes(paths.aiNotifySignature, 'AI_NOTIFY_WEBHOOK_SECRET') &&
    sourceTextIncludes(paths.aiGenerateHandler, '/api/ai/notify/');

  const selectedProductProvider = providerModel({
    modelId: 'cloudflare-workers-ai',
    source: selectedProviderDefaulted ? 'defaulted' : 'unknown',
    sources: [
      source(
        'provider_route',
        paths.removerProviderAdapter,
        'REMOVER_AI_PROVIDER'
      ),
      source(
        'provider_domain',
        paths.removerProvider,
        'CLOUDFLARE_WORKERS_AI_PROVIDER'
      ),
    ],
  });
  const selectedProductModel = providerModel({
    modelId: '@cf/runwayml/stable-diffusion-v1-5-inpainting',
    source: selectedModelDefaulted ? 'defaulted' : 'unknown',
    sources: [
      source(
        'provider_route',
        paths.removerProviderAdapter,
        'REMOVER_AI_MODEL'
      ),
      source(
        'provider_domain',
        paths.removerProvider,
        'DEFAULT_CLOUDFLARE_INPAINTING_MODEL'
      ),
    ],
  });

  const removerProviderVar = envKeyRequirement({
    key: 'REMOVER_AI_PROVIDER',
    envContractPath,
    usageSource: paths.removerProviderAdapter,
    usageKind: 'provider_route',
  });
  const removerModelVar = envKeyRequirement({
    key: 'REMOVER_AI_MODEL',
    envContractPath,
    usageSource: paths.removerProviderAdapter,
    usageKind: 'provider_route',
  });
  const workersAiBinding = providerRequirement({
    name: 'workersAi',
    owner: 'runtime_owned',
    status: workersAiBindingReady ? 'runtime_owned' : 'missing',
    sources: [
      source('deploy_settings', deploySettingsPath, 'bindings.workersAi'),
      source('provider_runtime', paths.runtimeEnv, 'getCloudflareAIBinding'),
      source(
        'provider_route',
        paths.removerProviderAdapter,
        'getCloudflareAIBinding'
      ),
    ],
  });
  const notifySecret = envKeyRequirement({
    key: 'AI_NOTIFY_WEBHOOK_SECRET',
    envContractPath,
    usageSource: paths.aiNotifySignature,
    usageKind: 'provider_route',
  });

  const cloudflareIssues = [
    workersAiBinding.status === 'missing'
      ? providerWarning(
          'workers_ai_binding_missing',
          'Cloudflare Workers AI provider requires the workersAi binding',
          workersAiBinding.sources
        )
      : undefined,
    providerWarning(
      'provider_fallback_policy_missing',
      'Provider fallback policy is limited to defaulting REMOVER_AI_PROVIDER to cloudflare-workers-ai; no cross-provider fallback is source-mapped',
      [
        source(
          'provider_route',
          paths.removerProviderAdapter,
          'CLOUDFLARE_WORKERS_AI_PROVIDER'
        ),
      ]
    ),
  ].filter(Boolean);

  const kieSecret = envKeyRequirement({
    key: 'KIE_API_KEY',
    envContractPath,
    usageSource: paths.providerBindings,
  });
  const replicateSecret = envKeyRequirement({
    key: 'REPLICATE_API_TOKEN',
    envContractPath,
    usageSource: paths.providerBindings,
  });
  const openrouterSecret = envKeyRequirement({
    key: 'OPENROUTER_API_KEY',
    owner: 'unknown',
    envContractPath,
    usageSource: paths.providerBindings,
  });
  const falSecret = envKeyRequirement({
    key: 'FAL_API_KEY',
    owner: 'unknown',
    envContractPath,
    usageSource: paths.providerBindings,
  });

  const kieRegistration = providerRegistrationStatus(
    paths.aiService,
    'KieProvider'
  );
  const replicateRegistration = providerRegistrationStatus(
    paths.aiService,
    'ReplicateProvider'
  );
  const openrouterRegistration = providerRegistrationStatus(
    paths.aiService,
    'OpenRouter'
  );
  const falRegistration = providerRegistrationStatus(paths.aiService, 'Fal');

  const entries = [
    providerReadinessEntry({
      providerId: 'cloudflare-workers-ai',
      sourceOwner: 'product_owned',
      supportStatus:
        workersAiBindingReady && workersAiSync ? 'ready' : 'partial',
      taskMode: workersAiSync ? 'sync' : 'unknown',
      inputMedia: ['image'],
      inputDetail: 'image+mask',
      outputMedia: ['image'],
      defaultModel: selectedProductModel,
      modelSource: selectedProductModel,
      requiredBindings: [workersAiBinding],
      requiredSecrets: [],
      requiredVars: [removerProviderVar, removerModelVar],
      fallbackPolicy: providerFallback({
        status: selectedProviderDefaulted ? 'explicit_default' : 'unknown',
        description:
          'REMOVER_AI_PROVIDER defaults to cloudflare-workers-ai; cross-provider fallback is not source-mapped',
        sources: [
          source(
            'provider_route',
            paths.removerProviderAdapter,
            'CLOUDFLARE_WORKERS_AI_PROVIDER'
          ),
        ],
      }),
      sources: [
        source('provider_domain', paths.removerProvider),
        source('provider_route', paths.removerProviderAdapter),
        source('provider_runtime', paths.runtimeEnv),
        source('deploy_settings', deploySettingsPath, 'bindings.workersAi'),
      ],
      issues: cloudflareIssues,
    }),
    providerReadinessEntry({
      providerId: 'kie',
      sourceOwner: 'platform',
      supportStatus: kieRegistration === 'partial' ? 'partial' : 'missing',
      taskMode: 'async',
      inputMedia: ['audio'],
      outputMedia: ['audio'],
      requiredBindings: [],
      requiredSecrets: [kieSecret],
      requiredVars: [],
      fallbackPolicy: providerFallback({
        status: 'missing',
        description: 'No fallback policy is source-mapped for Kie',
        sources: [
          source('provider_application', paths.aiService, 'getAIService'),
        ],
      }),
      sources: [
        source('provider_application', paths.aiService, 'KieProvider'),
        source('provider_extension', paths.kieProvider, 'KieProvider'),
        source('provider_application', paths.providerBindings, 'KIE_API_KEY'),
      ],
      issues: [],
    }),
    providerReadinessEntry({
      providerId: 'replicate',
      sourceOwner: 'platform',
      supportStatus:
        replicateRegistration === 'partial' ? 'partial' : 'missing',
      taskMode: notifyRouteAvailable ? 'async' : 'mixed',
      inputMedia: ['text', 'image'],
      outputMedia: ['image'],
      requiredBindings: [],
      requiredSecrets: [replicateSecret, notifySecret],
      requiredVars: [],
      fallbackPolicy: providerFallback({
        status: 'missing',
        description: 'No fallback policy is source-mapped for Replicate',
        sources: [
          source('provider_application', paths.aiService, 'getAIService'),
        ],
      }),
      sources: [
        source('provider_application', paths.aiService, 'ReplicateProvider'),
        source(
          'provider_extension',
          paths.replicateProvider,
          'ReplicateProvider'
        ),
        source(
          'provider_application',
          paths.providerBindings,
          'REPLICATE_API_TOKEN'
        ),
        source('provider_route', paths.aiNotifyRoute, 'POST'),
      ],
      issues: [],
    }),
    providerReadinessEntry({
      providerId: 'openrouter',
      sourceOwner: 'platform',
      supportStatus:
        openrouterSecret.status !== 'missing' &&
        openrouterRegistration === 'missing'
          ? 'partial'
          : openrouterRegistration,
      taskMode: 'unknown',
      inputMedia: ['unknown'],
      outputMedia: ['unknown'],
      requiredBindings: [],
      requiredSecrets: [openrouterSecret],
      requiredVars: [],
      fallbackPolicy: providerFallback({
        status: 'missing',
        description: 'No fallback policy is source-mapped for OpenRouter',
        sources: [
          source('provider_application', paths.aiService, 'getAIService'),
        ],
      }),
      sources: [
        source(
          'provider_application',
          paths.providerBindings,
          'OPENROUTER_API_KEY'
        ),
        source(
          'provider_application',
          paths.settingsRuntimeContracts,
          'openrouterApiKey'
        ),
        source('provider_application', paths.aiService, 'getAIService'),
      ],
      issues:
        openrouterSecret.status !== 'missing' &&
        openrouterRegistration === 'missing'
          ? [
              providerEntryIssueForMissingRegistration({
                providerId: 'openrouter',
                bindingPath: paths.providerBindings,
                servicePath: paths.aiService,
                key: 'OPENROUTER_API_KEY',
              }),
            ]
          : [],
    }),
    providerReadinessEntry({
      providerId: 'fal',
      sourceOwner: 'platform',
      supportStatus:
        falSecret.status !== 'missing' && falRegistration === 'missing'
          ? 'partial'
          : falRegistration,
      taskMode: 'unknown',
      inputMedia: ['unknown'],
      outputMedia: ['unknown'],
      requiredBindings: [],
      requiredSecrets: [falSecret],
      requiredVars: [],
      fallbackPolicy: providerFallback({
        status: 'missing',
        description: 'No fallback policy is source-mapped for Fal',
        sources: [
          source('provider_application', paths.aiService, 'getAIService'),
        ],
      }),
      sources: [
        source('provider_application', paths.providerBindings, 'FAL_API_KEY'),
        source(
          'provider_application',
          paths.settingsRuntimeContracts,
          'falApiKey'
        ),
        source('provider_application', paths.aiService, 'getAIService'),
      ],
      issues:
        falSecret.status !== 'missing' && falRegistration === 'missing'
          ? [
              providerEntryIssueForMissingRegistration({
                providerId: 'fal',
                bindingPath: paths.providerBindings,
                servicePath: paths.aiService,
                key: 'FAL_API_KEY',
              }),
            ]
          : [],
    }),
  ];

  const missingRuntimeRequirements = entries.flatMap((entry) =>
    [
      ...entry.requiredBindings,
      ...entry.requiredSecrets,
      ...entry.requiredVars,
    ].filter((requirement) => requirement.status === 'missing')
  );
  const entryIssues = entries.flatMap((entry) => entry.issues);
  const warnings = [...sourceIssues, ...entryIssues];

  return section(
    warnings.length === 0 && missingRuntimeRequirements.length === 0
      ? 'resolved'
      : 'partial',
    {
      selectedProductProvider,
      selectedProductModel,
      providers: entries,
      missingRuntimeRequirements,
      warnings,
    },
    [
      source('provider_route', paths.removerProviderAdapter),
      source('provider_domain', paths.removerProvider),
      source('provider_application', paths.aiService),
      source('provider_application', paths.providerBindings),
      source('provider_runtime', paths.runtimeEnv),
      source('deploy_settings', deploySettingsPath, 'bindings.workersAi'),
    ],
    warnings
  );
}

function usageWarning(code, message, sources) {
  return issue(ISSUE_LEVEL.WARNING, code, message, sources);
}

function collectMissingUsageCreditSourceIssues(sourceEntries) {
  return sourceEntries
    .filter((entry) => !existsSync(entry.path))
    .map((entry) =>
      usageWarning(
        'missing_usage_credit_audit_source',
        `Usage / credits audit source is missing: ${entry.label}`,
        [source(entry.kind, entry.path)]
      )
    );
}

function creditStatus(condition) {
  return condition ? 'present' : 'missing';
}

function quotaMappingEntry({
  meterId,
  quotaType,
  owner,
  subject,
  unit,
  window,
  reserveMode,
  commitCondition,
  refundCondition,
  idempotency,
  storage,
  sources,
  issues = [],
}) {
  return {
    meterId,
    quotaType,
    owner,
    subject,
    unit,
    window,
    reserveMode,
    commitCondition,
    refundCondition,
    idempotency,
    storage,
    sources,
    issues,
  };
}

function usageEntitlementClassification(key) {
  switch (key) {
    case 'guest_daily_removals':
      return {
        classification: 'usage_limit',
        mapsTo: 'anonymous processing daily limit',
      };
    case 'daily_removals':
      return {
        classification: 'usage_limit',
        mapsTo: 'user free processing daily limit',
      };
    case 'monthly_removals':
      return {
        classification: 'usage_limit',
        mapsTo: 'paid processing monthly limit',
      };
    case 'signup_high_res_downloads':
      return {
        classification: 'usage_limit',
        mapsTo: 'free user high-res lifetime allowance',
      };
    case 'monthly_high_res_downloads':
      return {
        classification: 'usage_limit',
        mapsTo: 'paid high-res monthly allowance',
      };
    case 'retention_days':
      return {
        classification: 'retention',
        mapsTo: 'product asset and job retention',
      };
    case 'max_upload_mb':
      return {
        classification: 'upload_guard',
        mapsTo: 'upload size guard',
      };
    case 'low_res_download':
      return { classification: 'access', mapsTo: 'low-res download access' };
    case 'advanced_mode':
      return {
        classification: 'product_flag',
        mapsTo: 'AI Remover advanced mode flag',
      };
    case 'priority_queue':
      return {
        classification: 'product_flag',
        mapsTo: 'AI Remover priority queue flag',
      };
    default:
      return { classification: 'unknown', mapsTo: 'unmapped entitlement' };
  }
}

function collectUsageEntitlementMappings(items, pricingPath) {
  return collectEntitlementKeys(items).map((key) => ({
    key,
    ...usageEntitlementClassification(key),
    sources: [source('pricing', pricingPath, `entitlements.${key}`)],
  }));
}

function collectCreditScenes(accountCreditPath, billingCreditPath) {
  const scenes = [
    ['payment', 'PAYMENT'],
    ['subscription', 'SUBSCRIPTION'],
    ['renewal', 'RENEWAL'],
    ['gift', 'GIFT'],
    ['award', 'AWARD'],
  ];

  return scenes
    .filter(
      ([, token]) =>
        sourceTextIncludes(accountCreditPath, token) ||
        sourceTextIncludes(billingCreditPath, token)
    )
    .map(([name]) => name);
}

function auditUsageCredits({ paths, items, pricingPath }) {
  const sourceIssues = collectMissingUsageCreditSourceIssues([
    {
      label: 'AI Remover plan resolver',
      kind: 'usage_product_domain',
      path: paths.removerPlan,
    },
    {
      label: 'AI Remover quota domain',
      kind: 'usage_product_domain',
      path: paths.removerQuota,
    },
    {
      label: 'AI Remover quota types',
      kind: 'usage_product_domain',
      path: paths.removerTypes,
    },
    {
      label: 'AI Remover quota reservation infra',
      kind: 'usage_product_infra',
      path: paths.quotaReservation,
    },
    {
      label: 'AI Remover job application',
      kind: 'usage_product_application',
      path: paths.jobs,
    },
    {
      label: 'AI Remover processing application',
      kind: 'usage_product_application',
      path: paths.processing,
    },
    {
      label: 'AI Remover download application',
      kind: 'usage_product_application',
      path: paths.download,
    },
    {
      label: 'AI Remover jobs route',
      kind: 'usage_product_route',
      path: paths.jobsRoute,
    },
    {
      label: 'AI Remover jobs action',
      kind: 'usage_product_route',
      path: paths.jobsAction,
    },
    {
      label: 'AI Remover download action',
      kind: 'usage_product_route',
      path: paths.downloadAction,
    },
    {
      label: 'AI Remover high-res route',
      kind: 'usage_product_route',
      path: paths.highResRoute,
    },
    {
      label: 'AI Remover low-res route',
      kind: 'usage_product_route',
      path: paths.lowResRoute,
    },
    {
      label: 'platform account credit ledger',
      kind: 'usage_platform_credit',
      path: paths.accountCredit,
    },
    {
      label: 'billing credit grant builder',
      kind: 'usage_billing_credit',
      path: paths.billingCredit,
    },
    {
      label: 'billing flows',
      kind: 'usage_billing_credit',
      path: paths.billingFlows,
    },
    {
      label: 'admin credits list schema',
      kind: 'usage_platform_credit',
      path: paths.adminCreditsSchema,
    },
    {
      label: 'admin credits page',
      kind: 'usage_platform_credit',
      path: paths.adminCreditsPage,
    },
    {
      label: 'admin credits query',
      kind: 'usage_platform_credit',
      path: paths.adminCreditsQuery,
    },
    {
      label: 'account credit use cases',
      kind: 'usage_platform_credit',
      path: paths.accountUseCases,
    },
    {
      label: 'database schema',
      kind: 'usage_db',
      path: paths.dbSchema,
    },
    {
      label: 'AI Remover database migration',
      kind: 'usage_db',
      path: paths.removerMigration,
    },
  ]);

  const processingOperationReady =
    sourceTextIncludes(paths.jobs, "'processing'") ||
    sourceTextIncludes(paths.jobs, 'imageRemove') ||
    sourceTextIncludes(paths.jobs, 'image.remove');
  const processingReserveReady =
    sourceTextIncludes(paths.jobs, 'createQueuedRemoverJob') &&
    processingOperationReady &&
    sourceTextIncludes(
      paths.quotaReservation,
      'createRemoverQuotaReservationWithQuotaCheck'
    );
  const processingWindowReady =
    sourceTextIncludes(paths.removerPlan, 'processingWindow') &&
    sourceTextIncludes(paths.removerQuota, 'getQuotaWindowStart');
  const processingIdempotencyReady =
    sourceTextIncludes(
      paths.jobs,
      'buildProcessingReservationIdempotencyKey'
    ) && sourceTextIncludes(paths.quotaReservation, 'idempotencyKey');
  const processingCommitReady =
    sourceTextIncludes(paths.processing, 'storeOutputImage') &&
    sourceTextIncludes(paths.processing, 'commitReservation');
  const processingRefundReady =
    sourceTextIncludes(paths.processing, 'refundReservation') &&
    sourceTextIncludes(paths.processing, 'output storage failed');
  const subjectTransferReady =
    sourceTextIncludes(paths.jobs, 'claimReservationById') &&
    sourceTextIncludes(
      paths.quotaReservation,
      'claimRemoverQuotaReservationById'
    );
  const quotaExpiryReady =
    sourceTextIncludes(paths.quotaReservation, 'expiresAt') &&
    sourceTextIncludes(paths.quotaReservation, 'reserved') &&
    sourceTextIncludes(paths.quotaReservation, 'refunded');
  const retentionReady =
    sourceTextIncludes(paths.removerPlan, 'retention_days') &&
    sourceTextIncludes(paths.jobs, 'expiresAt');

  const processingSources = [
    source('usage_product_application', paths.jobs, 'createQueuedRemoverJob'),
    source(
      'usage_product_infra',
      paths.quotaReservation,
      'createRemoverQuotaReservationWithQuotaCheck'
    ),
    source('usage_product_domain', paths.removerQuota, 'getQuotaWindowStart'),
    source('usage_product_application', paths.processing, 'commitReservation'),
    source('usage_product_application', paths.processing, 'refundReservation'),
    source('usage_product_route', paths.jobsRoute),
    source('usage_product_route', paths.jobsAction),
  ];
  const processingIssues = [
    processingReserveReady
      ? undefined
      : usageWarning(
          'processing_quota_reservation_evidence_missing',
          'AI Remover processing quota reservation could not be fully source-mapped',
          processingSources
        ),
    processingCommitReady
      ? undefined
      : usageWarning(
          'processing_quota_commit_evidence_missing',
          'AI Remover processing quota commit condition could not be fully source-mapped',
          processingSources
        ),
    processingRefundReady
      ? undefined
      : usageWarning(
          'processing_quota_refund_evidence_missing',
          'AI Remover processing quota refund condition could not be fully source-mapped',
          processingSources
        ),
  ].filter(Boolean);

  const highResOperationReady =
    sourceTextIncludes(paths.download, "'high_res_download'") ||
    sourceTextIncludes(paths.download, 'imageHdDownload') ||
    sourceTextIncludes(paths.download, 'image.hd_download');
  const highResReserveReady =
    sourceTextIncludes(paths.download, 'reserveHighResDownloadQuota') &&
    highResOperationReady &&
    sourceTextIncludes(
      paths.quotaReservation,
      'createRemoverQuotaReservationWithQuotaCheck'
    );
  const highResWindowReady =
    sourceTextIncludes(paths.download, "'lifetime'") &&
    sourceTextIncludes(paths.download, 'getQuotaWindowStart');
  const highResIdempotencyReady =
    sourceTextIncludes(paths.download, 'high-res-download') &&
    sourceTextIncludes(paths.quotaReservation, 'idempotencyKey');
  const highResCommitReady =
    sourceTextIncludes(paths.downloadAction, 'requiresHighResQuota') &&
    sourceTextIncludes(paths.downloadAction, 'commitReservation');
  const lowResNoHighResQuota =
    sourceTextIncludes(paths.download, "variant === 'low_res'") &&
    sourceTextIncludes(paths.download, 'requiresHighResQuota: false');

  const highResSources = [
    source(
      'usage_product_application',
      paths.download,
      'reserveHighResDownloadQuota'
    ),
    source(
      'usage_product_infra',
      paths.quotaReservation,
      'createRemoverQuotaReservationWithQuotaCheck'
    ),
    source('usage_product_route', paths.downloadAction, 'requiresHighResQuota'),
    source('usage_product_route', paths.highResRoute),
    source('usage_product_route', paths.lowResRoute, 'low_res'),
  ];
  const highResIssues = [
    highResReserveReady
      ? undefined
      : usageWarning(
          'high_res_quota_reservation_evidence_missing',
          'AI Remover high-res download quota reservation could not be fully source-mapped',
          highResSources
        ),
    highResCommitReady
      ? undefined
      : usageWarning(
          'high_res_quota_commit_evidence_missing',
          'AI Remover high-res download quota commit condition could not be fully source-mapped',
          highResSources
        ),
    usageWarning(
      'high_res_download_refund_policy_missing',
      'AI Remover high-res download quota has an explicit reservation and commit path, but no source-mapped refund condition after reservation',
      highResSources
    ),
    lowResNoHighResQuota
      ? undefined
      : usageWarning(
          'low_res_download_quota_evidence_missing',
          'Low-res download no-quota behavior could not be source-mapped',
          highResSources
        ),
  ].filter(Boolean);

  const productOwnedQuota = [
    quotaMappingEntry({
      meterId: 'processing',
      quotaType: 'processing',
      owner: 'product_owned',
      subject: ['anonymous', 'user'],
      unit: 'job',
      window: processingWindowReady ? ['day', 'month'] : ['unknown'],
      reserveMode: processingReserveReady ? 'explicit_reservation' : 'unknown',
      commitCondition: processingCommitReady
        ? 'output_storage_success'
        : 'unknown',
      refundCondition: processingRefundReady
        ? ['provider_failure', 'output_storage_failure']
        : ['unknown'],
      idempotency: processingIdempotencyReady ? 'present' : 'missing',
      storage: 'product_quota_reservation',
      sources: processingSources,
      issues: processingIssues,
    }),
    quotaMappingEntry({
      meterId: 'high_res_download',
      quotaType: 'high_res_download',
      owner: 'product_owned',
      subject: ['user'],
      unit: 'download',
      window: highResWindowReady ? ['lifetime', 'month'] : ['unknown'],
      reserveMode: highResReserveReady ? 'explicit_reservation' : 'unknown',
      commitCondition: highResCommitReady ? 'download_success' : 'unknown',
      refundCondition: ['missing'],
      idempotency: highResIdempotencyReady ? 'present' : 'missing',
      storage: 'product_quota_reservation',
      sources: highResSources,
      issues: highResIssues,
    }),
  ];

  const supportsGrant =
    sourceTextIncludes(paths.accountCredit, 'createCredit') &&
    sourceTextIncludes(paths.accountCredit, 'GRANT');
  const supportsConsume =
    sourceTextIncludes(paths.accountCredit, 'consumeCredits') &&
    sourceTextIncludes(paths.accountCredit, 'CONSUME');
  const supportsRefundConsumed = sourceTextIncludes(
    paths.accountCredit,
    'refundConsumedCreditById'
  );
  const supportsExpiration =
    sourceTextIncludes(paths.accountCredit, 'createExpirationCondition') &&
    sourceTextIncludes(paths.accountCredit, 'expiresAt');
  const supportsMetadata =
    sourceTextIncludes(paths.accountCredit, 'metadata') &&
    sourceTextIncludes(paths.accountCredit, 'consumedDetail');
  const supportsOperatorVisibility =
    sourceTextIncludes(paths.adminCreditsPage, 'listAdminCreditsQuery') &&
    sourceTextIncludes(paths.adminCreditsQuery, 'listAdminCreditsQuery') &&
    sourceTextIncludes(paths.adminCreditsSchema, 'AdminCreditsListQuerySchema');
  const billingGrantReady =
    sourceTextIncludes(paths.billingCredit, 'buildGrantCreditForOrder') &&
    sourceTextIncludes(paths.billingFlows, 'buildGrantCreditForOrder');
  const scenes = collectCreditScenes(paths.accountCredit, paths.billingCredit);

  const creditSources = [
    source('usage_platform_credit', paths.accountCredit, 'credit ledger'),
    source(
      'usage_billing_credit',
      paths.billingCredit,
      'buildGrantCreditForOrder'
    ),
    source('usage_billing_credit', paths.billingFlows, 'newCredit'),
    source('usage_platform_credit', paths.adminCreditsSchema),
    source('usage_platform_credit', paths.adminCreditsPage),
    source('usage_platform_credit', paths.adminCreditsQuery),
    source('usage_db', paths.dbSchema, 'credit'),
  ];
  const creditIssues = [
    billingGrantReady
      ? undefined
      : usageWarning(
          'billing_credit_grant_evidence_missing',
          'Billing credit grant evidence could not be fully source-mapped',
          creditSources
        ),
    usageWarning(
      'manual_credit_compensation_contract_partial',
      'Platform credit ledger has grant/consume/refund primitives and admin visibility, but no source-mapped complete manual compensation write contract',
      creditSources
    ),
  ].filter(Boolean);

  const platformCreditLedger = [
    {
      ledgerName: 'platform credit ledger',
      owner: 'platform_owned',
      supportsGrant: creditStatus(supportsGrant),
      supportsConsume: creditStatus(supportsConsume),
      supportsRefundConsumed: creditStatus(supportsRefundConsumed),
      supportsExpiration: creditStatus(supportsExpiration),
      supportsMetadata: creditStatus(supportsMetadata),
      supportsOperatorVisibility: creditStatus(supportsOperatorVisibility),
      supportsManualCompensation: 'partial',
      scenes,
      sources: creditSources,
      issues: creditIssues,
    },
  ];

  const genericUsageTableReady = sourceTextIncludes(
    paths.dbSchema,
    'productQuotaReservation'
  );
  const genericUsageWarning = genericUsageTableReady
    ? undefined
    : usageWarning(
        'generic_usage_table_missing',
        'Generic product quota reservation table could not be source-mapped',
        [
          source('usage_db', paths.dbSchema, 'productQuotaReservation'),
          source('usage_db', paths.dbSchema, 'credit'),
        ]
      );
  const separationWarning = usageWarning(
    'usage_credit_ledgers_separate',
    'AI Remover processing and high-res limits use productQuotaReservation, not the platform credit ledger',
    [
      source('usage_db', paths.dbSchema, 'productQuotaReservation'),
      source('usage_platform_credit', paths.accountCredit, 'credit'),
    ]
  );

  const warnings = [
    ...sourceIssues,
    ...productOwnedQuota.flatMap((entry) => entry.issues),
    ...platformCreditLedger.flatMap((entry) => entry.issues),
    genericUsageWarning,
    separationWarning,
  ].filter(Boolean);

  return section(
    'partial',
    {
      productOwnedQuota,
      platformCreditLedger,
      entitlementMappings: collectUsageEntitlementMappings(items, pricingPath),
      lifecycleMappings: {
        reserve:
          processingReserveReady && highResReserveReady ? 'present' : 'partial',
        commit:
          processingCommitReady && highResCommitReady ? 'present' : 'partial',
        refund: processingRefundReady ? 'partial' : 'missing',
        expire: quotaExpiryReady && retentionReady ? 'present' : 'partial',
        idempotency:
          processingIdempotencyReady && highResIdempotencyReady
            ? 'present'
            : 'partial',
        subjectTransfer: subjectTransferReady ? 'present' : 'missing',
        genericUsageTable: genericUsageTableReady ? 'present' : 'missing',
      },
      gaps: [
        'Generic usage table is not implemented.',
        'AI Remover quota reservation and platform credit ledger are separate.',
        'High-res download refund after reservation is not source-mapped.',
        'Manual credit compensation write contract is partial/missing.',
      ],
      warnings,
    },
    [
      source('usage_product_application', paths.jobs),
      source('usage_product_infra', paths.quotaReservation),
      source('usage_product_application', paths.processing),
      source('usage_product_application', paths.download),
      source('usage_platform_credit', paths.accountCredit),
      source('usage_billing_credit', paths.billingCredit),
      source('usage_db', paths.dbSchema),
      source('pricing', pricingPath),
    ],
    warnings
  );
}

function collectLaunch(report) {
  const issues = [
    report.site,
    report.commercial,
    report.entitlementKeys,
    report.runtimeOwnership,
    report.productRuntime,
    report.billingReversal,
    report.providerReadiness,
    report.usageCredits,
  ].flatMap((item) => item.issues);

  return {
    blockers: issues.filter((item) => item.level === ISSUE_LEVEL.BLOCKER),
    warnings: issues.filter((item) => item.level === ISSUE_LEVEL.WARNING),
    recommendedCommands: [
      'SITE=ai-remover node scripts/check-saas-product-contract.mjs',
      'node --test --import tsx scripts/check-saas-product-contract.test.ts',
      'pnpm test src/config/product-modules/index.test.ts src/config/product-modules/doc-links.test.ts',
    ],
  };
}

function buildAuditReport(siteKey) {
  const sitePath = resolveSiteConfigPath({ rootDir: ROOT_DIR, siteKey });
  const pricingPath = resolveSitePricingPath({ rootDir: ROOT_DIR, siteKey });
  const deploySettingsPath = resolveSiteDeploySettingsPath({
    rootDir: ROOT_DIR,
    siteKey,
  });
  const paymentSettingsPath = path.resolve(
    ROOT_DIR,
    'src/domains/settings/definitions/payment.ts'
  );
  const envContractPath = path.resolve(ROOT_DIR, 'src/config/env-contract.ts');
  const productRuntimeContractPath = path.resolve(
    ROOT_DIR,
    'src/domains/remover/domain/runtime-contract.ts'
  );
  const billingPaths = {
    paymentDomain: path.resolve(
      ROOT_DIR,
      'src/domains/billing/domain/payment.ts'
    ),
    processNotify: path.resolve(
      ROOT_DIR,
      'src/domains/billing/application/process-payment-notify.ts'
    ),
    flows: path.resolve(ROOT_DIR, 'src/domains/billing/application/flows.ts'),
    paymentNotifyFlow: path.resolve(
      ROOT_DIR,
      'src/domains/billing/application/payment-notify-flow.ts'
    ),
    webhookInbox: path.resolve(
      ROOT_DIR,
      'src/domains/billing/infra/payment-webhook-inbox.ts'
    ),
    webhookInboxShared: path.resolve(
      ROOT_DIR,
      'src/domains/billing/infra/payment-webhook-inbox.shared.ts'
    ),
    webhookAudit: path.resolve(
      ROOT_DIR,
      'src/domains/billing/infra/payment-webhook-audit.ts'
    ),
    order: path.resolve(ROOT_DIR, 'src/domains/billing/infra/order.ts'),
    subscription: path.resolve(
      ROOT_DIR,
      'src/domains/billing/infra/subscription.ts'
    ),
    credit: path.resolve(ROOT_DIR, 'src/domains/billing/domain/credit.ts'),
    adminReplay: path.resolve(
      ROOT_DIR,
      'src/domains/billing/application/admin-payment-replay.ts'
    ),
    paymentNotifyTest: path.resolve(
      ROOT_DIR,
      'tests/contract/payment-notify.test.ts'
    ),
  };
  const providerPaths = {
    removerProvider: path.resolve(
      ROOT_DIR,
      'src/domains/remover/application/provider.ts'
    ),
    removerProviderAdapter: path.resolve(
      ROOT_DIR,
      'src/server/api/remover/provider-adapter.ts'
    ),
    aiService: path.resolve(ROOT_DIR, 'src/domains/ai/application/service.ts'),
    providerBindings: path.resolve(
      ROOT_DIR,
      'src/domains/ai/application/provider-bindings.ts'
    ),
    settingsRuntimeContracts: path.resolve(
      ROOT_DIR,
      'src/domains/settings/application/settings-runtime.contracts.ts'
    ),
    aiProviders: path.resolve(ROOT_DIR, 'src/extensions/ai/providers.ts'),
    kieProvider: path.resolve(ROOT_DIR, 'src/extensions/ai/kie.ts'),
    replicateProvider: path.resolve(ROOT_DIR, 'src/extensions/ai/replicate.ts'),
    runtimeEnv: path.resolve(ROOT_DIR, 'src/infra/runtime/env.server.ts'),
    aiNotifyRoute: path.resolve(
      ROOT_DIR,
      'apps/web/src/routes/api/ai/notify/$provider.ts'
    ),
    aiNotifySignature: path.resolve(
      ROOT_DIR,
      'src/server/api/ai/notify-signature.ts'
    ),
    aiGenerateHandler: path.resolve(
      ROOT_DIR,
      'src/server/api/ai/generate-route.ts'
    ),
  };
  const usageCreditPaths = {
    removerPlan: path.resolve(ROOT_DIR, 'src/domains/remover/domain/plan.ts'),
    removerQuota: path.resolve(ROOT_DIR, 'src/domains/remover/domain/quota.ts'),
    removerTypes: path.resolve(ROOT_DIR, 'src/domains/remover/domain/types.ts'),
    quotaReservation: path.resolve(
      ROOT_DIR,
      'src/domains/remover/infra/quota-reservation.ts'
    ),
    jobs: path.resolve(ROOT_DIR, 'src/domains/remover/application/jobs.ts'),
    processing: path.resolve(
      ROOT_DIR,
      'src/domains/remover/application/processing.ts'
    ),
    download: path.resolve(
      ROOT_DIR,
      'src/domains/remover/application/download.ts'
    ),
    jobsRoute: path.resolve(
      ROOT_DIR,
      'apps/web/src/routes/api/remover/jobs.ts'
    ),
    jobsAction: path.resolve(ROOT_DIR, 'src/server/api/remover/jobs-action.ts'),
    downloadAction: path.resolve(
      ROOT_DIR,
      'src/server/api/remover/download-action.ts'
    ),
    highResRoute: path.resolve(
      ROOT_DIR,
      'apps/web/src/routes/api/remover/download/high-res.ts'
    ),
    lowResRoute: path.resolve(
      ROOT_DIR,
      'apps/web/src/routes/api/remover/download/low-res.ts'
    ),
    accountCredit: path.resolve(
      ROOT_DIR,
      'src/domains/account/infra/credit.ts'
    ),
    billingCredit: path.resolve(
      ROOT_DIR,
      'src/domains/billing/domain/credit.ts'
    ),
    billingFlows: path.resolve(
      ROOT_DIR,
      'src/domains/billing/application/flows.ts'
    ),
    adminCreditsSchema: path.resolve(
      ROOT_DIR,
      'src/surfaces/admin/schemas/list/credits.ts'
    ),
    adminCreditsPage: path.resolve(
      ROOT_DIR,
      'src/server/admin/admin-route-resolver.ts'
    ),
    adminCreditsQuery: path.resolve(
      ROOT_DIR,
      'src/domains/account/application/admin-credits.query.ts'
    ),
    accountUseCases: path.resolve(
      ROOT_DIR,
      'src/domains/account/application/use-cases.ts'
    ),
    dbSchema: path.resolve(ROOT_DIR, 'src/config/db/schema.ts'),
    removerMigration: path.resolve(
      ROOT_DIR,
      'src/config/db/migrations/0006_ai_remover_jobs.sql'
    ),
  };

  const { site, issues: siteIssues } = readSiteForReport({
    rootDir: ROOT_DIR,
    siteKey,
    sitePath,
  });
  const { sitePricing, issues: pricingIssues } = readPricingForReport({
    rootDir: ROOT_DIR,
    site,
    siteKey,
    pricingPath,
  });
  const { deploySettings, issues: deployIssues } = readDeploySettingsForReport({
    deploySettingsPath,
    site,
  });
  const pricingItems = collectPricingItems(sitePricing);
  const report = {
    site: auditSite(site, sitePath, siteIssues),
    commercial: auditCommercial({
      site,
      sitePricing,
      sitePath,
      pricingPath,
      pricingIssues,
      settingsSourcePath: paymentSettingsPath,
    }),
    entitlementKeys: auditEntitlementKeys({
      siteKey,
      items: pricingItems,
      pricingPath,
    }),
    runtimeOwnership: auditRuntimeOwnership({
      site,
      deploySettings,
      deploySettingsPath,
      deployIssues,
      paymentSettingsPath,
      envContractPath,
    }),
    productRuntime: auditProductRuntimeContracts({
      siteKey,
      deploySettings,
      deploySettingsPath,
      deployIssues,
      runtimeContractPath: productRuntimeContractPath,
    }),
    billingReversal: auditBillingReversal(billingPaths),
    providerReadiness: auditProviderReadiness({
      paths: providerPaths,
      deploySettings,
      deploySettingsPath,
      envContractPath,
    }),
    usageCredits: auditUsageCredits({
      paths: usageCreditPaths,
      items: pricingItems,
      pricingPath,
    }),
  };

  return {
    ...report,
    launch: collectLaunch(report),
  };
}

function formatSourceRef(item) {
  const parts = [item.kind];
  if (item.path) {
    parts.push(item.path);
  }
  if (item.key) {
    parts.push(item.key);
  }
  return parts.join(':');
}

function formatIssueList(items) {
  if (items.length === 0) {
    return ['  none'];
  }

  return items.flatMap((item) => {
    const lines = [`  ${item.level}  ${item.message}`];
    for (const itemSource of item.sources) {
      lines.push(`    source  ${formatSourceRef(itemSource)}`);
    }
    return lines;
  });
}

function formatSectionSources(label, sources) {
  const refs = sources.map(formatSourceRef).filter(Boolean).join(', ');
  return `  ${label}: ${refs}`;
}

function formatRequirement(prefix, requirement) {
  return `    ${prefix}=${requirement.name} ${requirement.status}`;
}

function appendRequirement(lines, prefix, requirement) {
  lines.push(formatRequirement(prefix, requirement));
  for (const requirementSource of requirement.sources) {
    lines.push(`      source  ${formatSourceRef(requirementSource)}`);
  }
}

function formatJoined(values, separator = '+') {
  return values.filter(Boolean).join(separator);
}

function formatAuditReport(report) {
  const siteValue = report.site.value;
  const commercialValue = report.commercial.value;
  const entitlementKeys = report.entitlementKeys.value.keys;
  const runtimeFields = report.runtimeOwnership.value.fields;
  const productRuntimeProducts = report.productRuntime.value.products;
  const providerReadiness = report.providerReadiness.value;
  const usageCredits = report.usageCredits.value;
  const lines = [
    'SaaS Contract Audit',
    '',
    `Site: ${siteValue.key}`,
    `Site section: ${report.site.status}`,
    `Billing: ${commercialValue.billing}`,
    `Pricing file: ${commercialValue.pricingFile}`,
    `Plans: ${commercialValue.planCount ?? 0} ${report.commercial.status}`,
    '',
    'Entitlement keys:',
  ];

  for (const entry of entitlementKeys) {
    const label =
      entry.classification === 'raw_unknown' ? 'warning' : 'ok     ';
    const suffix =
      entry.classification === 'raw_unknown'
        ? `raw key: ${entry.key}`
        : `${entry.key} (${entry.classification})`;
    lines.push(`  ${label}  ${suffix}`);
  }

  lines.push('', 'Runtime-owned fields:');
  for (const field of runtimeFields) {
    lines.push(
      `  ${field.name}: ${field.status} (${field.owner}, ${field.expectedKey})`
    );
  }

  lines.push('', 'Product runtime contracts:');
  if (productRuntimeProducts.length === 0) {
    lines.push('  none');
  }
  for (const product of productRuntimeProducts) {
    lines.push(`  ${product.productKey}: ${product.status}`);
    for (const worker of product.workers) {
      lines.push(`    worker=${worker.key} ${worker.status}`);
    }
    for (const binding of product.bindings) {
      lines.push(`    binding=${binding.key} ${binding.status}`);
    }
    for (const runtimeVar of product.vars) {
      lines.push(`    var=${runtimeVar.key} ${runtimeVar.status}`);
    }
    for (const secret of product.secrets) {
      lines.push(`    secret=${secret.key} ${secret.status}`);
    }
  }

  lines.push('', 'Billing reversal:');
  for (const event of report.billingReversal.value.events) {
    const representedBy = event.representedBy
      ? ` (${event.representedBy})`
      : '';
    lines.push(
      `  ${event.eventName}: ${event.supportStatus}${representedBy} | subscription=${event.subscriptionStateEffect}, entitlement=${event.entitlementEffect}, credit=${event.creditEffect}, usage=${event.usageEffect}, audit=${event.auditEffect}, idempotency=${event.idempotency}, operator=${event.operatorAction}`
    );
    for (const eventSource of event.sources) {
      lines.push(`    source  ${formatSourceRef(eventSource)}`);
    }
  }

  lines.push('', 'Provider readiness:');
  lines.push(
    `  selected provider: ${providerReadiness.selectedProductProvider.modelId} (${providerReadiness.selectedProductProvider.source})`
  );
  for (const providerSource of providerReadiness.selectedProductProvider
    .sources) {
    lines.push(`    source  ${formatSourceRef(providerSource)}`);
  }
  lines.push(
    `  selected model: ${providerReadiness.selectedProductModel.modelId} (${providerReadiness.selectedProductModel.source})`
  );
  for (const modelSource of providerReadiness.selectedProductModel.sources) {
    lines.push(`    source  ${formatSourceRef(modelSource)}`);
  }
  for (const provider of providerReadiness.providers) {
    const input =
      provider.inputDetail ?? provider.inputMedia.filter(Boolean).join('+');
    lines.push(
      `  ${provider.providerId}: ${provider.supportStatus} (${provider.sourceOwner})`
    );
    lines.push(
      `    taskMode=${provider.taskMode} input=${input} output=${provider.outputMedia.join('+')}`
    );
    if (provider.defaultModel) {
      lines.push(`    defaultModel=${provider.defaultModel.modelId}`);
    }
    for (const requirement of provider.requiredBindings) {
      appendRequirement(lines, 'binding', requirement);
    }
    for (const requirement of provider.requiredSecrets) {
      appendRequirement(lines, 'secret', requirement);
    }
    for (const requirement of provider.requiredVars) {
      appendRequirement(lines, 'var', requirement);
    }
    lines.push(`    fallback=${provider.fallbackPolicy.status}`);
    for (const providerSource of provider.sources) {
      lines.push(`    source  ${formatSourceRef(providerSource)}`);
    }
  }

  lines.push('', 'Usage / credits:');
  lines.push('  product quota:');
  for (const quota of usageCredits.productOwnedQuota) {
    lines.push(`    ${quota.meterId}: ${quota.owner}`);
    lines.push(`      subject=${formatJoined(quota.subject)}`);
    lines.push(`      unit=${quota.unit}`);
    lines.push(`      window=${formatJoined(quota.window, '/')}`);
    lines.push(`      reserve=${quota.reserveMode}`);
    lines.push(`      commit=${quota.commitCondition}`);
    lines.push(`      refund=${formatJoined(quota.refundCondition)}`);
    lines.push(`      idempotency=${quota.idempotency}`);
    lines.push(`      storage=${quota.storage}`);
    for (const quotaSource of quota.sources) {
      lines.push(`      source  ${formatSourceRef(quotaSource)}`);
    }
  }

  lines.push('  entitlement mappings:');
  for (const mapping of usageCredits.entitlementMappings) {
    lines.push(
      `    ${mapping.key} -> ${mapping.mapsTo} (${mapping.classification})`
    );
    for (const mappingSource of mapping.sources) {
      lines.push(`      source  ${formatSourceRef(mappingSource)}`);
    }
  }

  lines.push('  platform credit ledger:');
  for (const ledger of usageCredits.platformCreditLedger) {
    lines.push(`    ${ledger.ledgerName}: ${ledger.owner}`);
    lines.push(`      grant=${ledger.supportsGrant}`);
    lines.push(`      consume=${ledger.supportsConsume}`);
    lines.push(`      refund consumed=${ledger.supportsRefundConsumed}`);
    lines.push(`      expiration=${ledger.supportsExpiration}`);
    lines.push(`      metadata=${ledger.supportsMetadata}`);
    lines.push(`      admin visibility=${ledger.supportsOperatorVisibility}`);
    lines.push(
      `      manual compensation=${ledger.supportsManualCompensation}`
    );
    lines.push(`      scenes=${ledger.scenes.join('/') || 'unknown'}`);
    for (const ledgerSource of ledger.sources) {
      lines.push(`      source  ${formatSourceRef(ledgerSource)}`);
    }
  }

  lines.push('  lifecycle:');
  lines.push(`    reserve=${usageCredits.lifecycleMappings.reserve}`);
  lines.push(`    commit=${usageCredits.lifecycleMappings.commit}`);
  lines.push(`    refund=${usageCredits.lifecycleMappings.refund}`);
  lines.push(`    expire=${usageCredits.lifecycleMappings.expire}`);
  lines.push(`    idempotency=${usageCredits.lifecycleMappings.idempotency}`);
  lines.push(
    `    subject transfer=${usageCredits.lifecycleMappings.subjectTransfer}`
  );
  lines.push(
    `    generic usage table=${usageCredits.lifecycleMappings.genericUsageTable}`
  );

  lines.push('', 'Sources:');
  lines.push(formatSectionSources('site', report.site.sources));
  lines.push(formatSectionSources('commercial', report.commercial.sources));
  lines.push(
    formatSectionSources('entitlement keys', report.entitlementKeys.sources)
  );
  lines.push(
    formatSectionSources('runtime ownership', report.runtimeOwnership.sources)
  );
  lines.push(
    formatSectionSources('product runtime', report.productRuntime.sources)
  );
  lines.push(
    formatSectionSources('billing reversal', report.billingReversal.sources)
  );
  lines.push(
    formatSectionSources('provider readiness', report.providerReadiness.sources)
  );
  lines.push(
    formatSectionSources('usage / credits', report.usageCredits.sources)
  );

  lines.push(
    '',
    'Launch blockers:',
    ...formatIssueList(report.launch.blockers)
  );
  lines.push('', 'Warnings:', ...formatIssueList(report.launch.warnings));
  lines.push('', 'Recommended commands:');
  for (const command of report.launch.recommendedCommands) {
    lines.push(`  ${command}`);
  }

  return lines.join('\n');
}

function buildBackgroundRemoverAuditReport(siteKey) {
  const sitePath = resolveSiteConfigPath({ rootDir: ROOT_DIR, siteKey });
  const pricingPath = resolveSitePricingPath({ rootDir: ROOT_DIR, siteKey });
  const deploySettingsPath = resolveSiteDeploySettingsPath({
    rootDir: ROOT_DIR,
    siteKey,
  });
  const runtimeContractPath = path.resolve(
    ROOT_DIR,
    'src/domains/background-remover/domain/runtime-contract.ts'
  );
  const { site, issues: siteIssues } = readSiteForReport({
    rootDir: ROOT_DIR,
    siteKey,
    sitePath,
  });
  const { sitePricing, issues: pricingIssues } = readPricingForReport({
    rootDir: ROOT_DIR,
    site,
    siteKey,
    pricingPath,
  });
  const { deploySettings, issues: deployIssues } = readDeploySettingsForReport({
    deploySettingsPath,
    site,
  });
  const pricingItems = collectPricingItems(sitePricing);
  const sections = {
    site: auditSite(site, sitePath, siteIssues),
    commercial: auditCommercial({
      site,
      sitePricing,
      sitePath,
      pricingPath,
      pricingIssues,
      settingsSourcePath: path.resolve(
        ROOT_DIR,
        'src/domains/settings/definitions/payment.ts'
      ),
    }),
    entitlementKeys: auditEntitlementKeys({
      siteKey,
      items: pricingItems,
      pricingPath,
    }),
    productRuntime: auditProductRuntimeContracts({
      siteKey,
      deploySettings,
      deploySettingsPath,
      deployIssues,
      runtimeContractPath,
    }),
  };
  const issues = Object.values(sections).flatMap((section) => section.issues);

  return {
    ...sections,
    launch: {
      blockers: issues.filter((item) => item.level === ISSUE_LEVEL.BLOCKER),
      warnings: issues.filter((item) => item.level === ISSUE_LEVEL.WARNING),
      recommendedCommands: [
        'SITE=background-remover node scripts/check-saas-product-contract.mjs',
        'SITE=background-remover pnpm cf:check',
        'pnpm cf:build:no-db --site=background-remover',
      ],
    },
  };
}

function formatBackgroundRemoverAuditReport(report) {
  const lines = ['SaaS product contract audit: background-remover', ''];
  lines.push(`Site: ${report.site.status}`);
  lines.push(`Commercial: ${report.commercial.status}`);
  lines.push(`Entitlement keys: ${report.entitlementKeys.status}`);
  lines.push(`Product runtime: ${report.productRuntime.status}`);

  lines.push('', 'Product runtime contracts:');
  for (const product of report.productRuntime.value.products) {
    lines.push(`  ${product.productKey}: ${product.status}`);
    for (const worker of product.workers) {
      lines.push(`    worker=${worker.key} ${worker.status}`);
    }
    for (const runtimeVar of product.vars) {
      lines.push(`    var=${runtimeVar.key} ${runtimeVar.status}`);
    }
    for (const secret of product.secrets) {
      lines.push(`    secret=${secret.key} ${secret.status}`);
    }
  }

  lines.push('', 'Sources:');
  lines.push(formatSectionSources('site', report.site.sources));
  lines.push(formatSectionSources('commercial', report.commercial.sources));
  lines.push(
    formatSectionSources('entitlement keys', report.entitlementKeys.sources)
  );
  lines.push(
    formatSectionSources('product runtime', report.productRuntime.sources)
  );

  lines.push(
    '',
    'Launch blockers:',
    ...formatIssueList(report.launch.blockers)
  );
  lines.push('', 'Warnings:', ...formatIssueList(report.launch.warnings));
  lines.push('', 'Recommended commands:');
  for (const command of report.launch.recommendedCommands) {
    lines.push(`  ${command}`);
  }

  return lines.join('\n');
}

function main() {
  const siteKey = resolveRequiredSiteKey(process.env);
  if (siteKey === 'background-remover') {
    const report = buildBackgroundRemoverAuditReport(siteKey);
    process.stdout.write(`${formatBackgroundRemoverAuditReport(report)}\n`);

    if (report.launch.blockers.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (siteKey !== 'ai-remover') {
    throw new Error(
      `Contract audit currently only supports SITE=ai-remover or SITE=background-remover; received SITE=${siteKey}`
    );
  }

  const report = buildAuditReport(siteKey);
  process.stdout.write(`${formatAuditReport(report)}\n`);

  if (report.launch.blockers.length > 0) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `SaaS contract audit failed: ${getErrorMessage(error)}\n`
  );
  process.exit(1);
}
