import { existsSync, readdirSync } from 'node:fs';

import * as paymentCapabilityNamespace from '../../src/config/payment-capability.ts';
import * as productRuntimeAssertNamespace from '../../src/domains/product-runtime/application/assert-runtime-contract.ts';
import cloudflareWorkerTopology from '../../src/shared/config/cloudflare-worker-topology.ts';
import { getProductRuntimeContractsForSite } from './product-runtime-contracts.mjs';
import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './site-config.mjs';
import {
  buildPreviewBucketName,
  buildPreviewRouterOrigin,
  buildPreviewWorkerName,
  CLOUDFLARE_DEPLOY_PROFILES,
  resolveCloudflareDeployProfile,
} from './site-deploy-profile.mjs';
import {
  CLOUDFLARE_RESOURCE_SLOT_KEYS,
  CLOUDFLARE_STATE_SLOT_KEYS,
  CLOUDFLARE_WORKER_SLOT_KEYS,
  getActiveServerWorkerSlots,
  getActiveWorkerSlots,
  readSiteDeploySettings,
  readSitePreviewDeploySettings,
} from './site-deploy-settings.mjs';

const {
  CLOUDFLARE_DURABLE_OBJECT_BINDINGS,
  CLOUDFLARE_LOCAL_WORKER_URL_VARS,
  CLOUDFLARE_ROUTER_WORKER,
  CLOUDFLARE_SERVICE_BINDINGS,
  CLOUDFLARE_STATE_WORKER,
  CLOUDFLARE_VERSION_ID_VARS,
  getServerWorkerMetadata,
} = cloudflareWorkerTopology;

const CLOUDFLARE_ROUTER_SLOT = 'router';
const CLOUDFLARE_STATE_SLOT = 'state';
const ROUTE_CUSTOM_DOMAIN = true;
const ROUTE_MODE_CUSTOM_DOMAIN = 'custom-domain';
const ROUTE_MODE_WORKERS_DEV = 'workers-dev';
const paymentCapabilityModule =
  paymentCapabilityNamespace.default ?? paymentCapabilityNamespace;
const { assertPaymentCapabilityContract, resolvePaymentHealth } =
  paymentCapabilityModule;
const productRuntimeAssertModule =
  productRuntimeAssertNamespace.default ?? productRuntimeAssertNamespace;
const { assertProductRuntimeContract } = productRuntimeAssertModule;

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortObject(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortObject(entry)])
  );
}

function buildCanonicalBindingShape(contract) {
  return {
    bindingRequirements: {
      bindings: Object.fromEntries(
        Object.keys(contract.bindingRequirements.bindings).map((key) => [
          key,
          'boolean',
        ])
      ),
      secrets: Object.fromEntries(
        Object.keys(contract.bindingRequirements.secrets).map((key) => [
          key,
          'boolean',
        ])
      ),
      vars: Object.fromEntries(
        Object.keys(contract.bindingRequirements.vars).map((key) => [
          key,
          'boolean',
        ])
      ),
    },
    resources: Object.fromEntries(
      CLOUDFLARE_RESOURCE_SLOT_KEYS.map((key) => [key, 'string'])
    ),
    state: Object.fromEntries(
      CLOUDFLARE_STATE_SLOT_KEYS.map((key) => [
        key,
        key === 'schemaVersion' ? 'integer' : 'unknown',
      ])
    ),
    workers: Object.fromEntries(
      Object.keys(contract.workers).map((key) => [key, 'string'])
    ),
  };
}

function buildDerivedBindingRequirements(site, { deployProfile }) {
  const paymentCapability = site.capabilities.payment;
  const paymentHealth = resolvePaymentHealth({
    capability: paymentCapability,
    settings: {},
    bindings: {},
  });

  const requiresPaymentSecrets = paymentHealth.provider !== null;

  return {
    secrets: {
      emailProvider:
        deployProfile === 'production' ? site.capabilities.auth : false,
      openrouter: site.capabilities.ai,
    },
    payment: {
      capability: paymentCapability,
      provider: paymentHealth.provider,
      requiredSecrets:
        paymentHealth.provider === null
          ? []
          : [
              ...assertPaymentCapabilityContract({
                capability: paymentHealth.provider,
                settings: {},
                bindings: {
                  ...(paymentHealth.provider === 'stripe'
                    ? {
                        stripePublishableKey: '__contract__',
                        stripeSecretKey: '__contract__',
                        stripeSigningSecret: '__contract__',
                      }
                    : paymentHealth.provider === 'creem'
                      ? {
                          creemApiKey: '__contract__',
                          creemSigningSecret: '__contract__',
                        }
                      : {
                          paypalClientId: '__contract__',
                          paypalClientSecret: '__contract__',
                          paypalWebhookId: '__contract__',
                        }),
                },
              }).requiredSecrets,
            ],
      requiresSecrets: requiresPaymentSecrets,
    },
  };
}

function buildServerWorkers(deploySettings) {
  return Object.fromEntries(
    getActiveServerWorkerSlots(deploySettings).map((target) => {
      const metadata = getServerWorkerMetadata(target);
      return [
        target,
        {
          ...metadata,
          slot: target,
          workerName: deploySettings.workers[target],
          localWorkerUrlVar: CLOUDFLARE_LOCAL_WORKER_URL_VARS[target],
          versionIdVar: CLOUDFLARE_VERSION_ID_VARS[target],
          serviceBinding: CLOUDFLARE_SERVICE_BINDINGS[target],
        },
      ];
    })
  );
}

function buildPreviewDeploySettings({
  siteKey,
  productionDeploySettings,
  previewSettings,
}) {
  const hyperdriveId =
    previewSettings?.resources.hyperdriveId ??
    productionDeploySettings.resources.hyperdriveId;

  return {
    ...productionDeploySettings,
    workers: Object.fromEntries(
      getActiveWorkerSlots(productionDeploySettings).map((slot) => [
        slot,
        buildPreviewWorkerName(siteKey, slot),
      ])
    ),
    resources: {
      incrementalCacheBucket: buildPreviewBucketName(siteKey, 'opennext-cache'),
      appStorageBucket: buildPreviewBucketName(siteKey, 'storage'),
      hyperdriveId,
    },
  };
}

function requiresHyperdrive(deploySettings) {
  return deploySettings.bindingRequirements.bindings.hyperdrive === true;
}

function buildTopologySignature(contract) {
  return JSON.stringify(
    sortObject({
      bindingShape: buildCanonicalBindingShape(contract),
      resources: Object.keys(contract.resources),
      state: Object.keys(contract.state),
      workers: Object.keys(contract.workers),
      route: {
        customDomain: 'boolean',
        mode: contract.route.mode,
        pattern: 'string',
      },
      router: {
        bindings: Object.keys(contract.router.serviceBindings),
        durableObjects: Object.keys(contract.router.durableObjects),
        versionVars: Object.keys(contract.router.versionVars),
      },
      stateWorker: {
        durableObjects: Object.keys(contract.stateWorker.durableObjects),
        migrations: Object.keys(contract.stateWorker.migrations),
      },
      serverWorkers: Object.fromEntries(
        Object.entries(contract.serverWorkers).map(([target, worker]) => [
          target,
          {
            bundleEntryRelativePath: worker.bundleEntryRelativePath,
            localWorkerUrlVar: worker.localWorkerUrlVar,
            serviceBinding: worker.serviceBinding,
            versionIdVar: worker.versionIdVar,
            workerEntryRelativePath: worker.workerEntryRelativePath,
            wranglerConfigRelativePath: worker.wranglerConfigRelativePath,
          },
        ])
      ),
    })
  );
}

function assertUniqueSiteRoutePatterns(contracts) {
  const seen = new Map();
  for (const contract of contracts) {
    const pattern = contract.route.pattern;
    const otherSiteKey = seen.get(pattern);
    if (otherSiteKey && otherSiteKey !== contract.siteKey) {
      throw new Error(
        `duplicate site route pattern detected for "${pattern}" between ${otherSiteKey} and ${contract.siteKey}`
      );
    }
    seen.set(pattern, contract.siteKey);
  }
}

export function normalizeDeployContractShape(contract) {
  return sortObject(JSON.parse(buildTopologySignature(contract)));
}

export function resolveSiteDeployContractFromSources({
  site,
  siteKey,
  deploySettings,
  deployProfile = 'production',
  previewSettings = null,
  processEnv = process.env,
}) {
  if (!CLOUDFLARE_DEPLOY_PROFILES.includes(deployProfile)) {
    throw new Error(
      `CF_DEPLOY_PROFILE must be one of: ${CLOUDFLARE_DEPLOY_PROFILES.join(', ')}`
    );
  }

  if (
    deployProfile === 'preview' &&
    requiresHyperdrive(deploySettings) &&
    !previewSettings
  ) {
    throw new Error(`preview deploy settings are required for SITE=${siteKey}`);
  }

  const effectiveDeploySettings =
    deployProfile === 'preview'
      ? buildPreviewDeploySettings({
          siteKey,
          productionDeploySettings: deploySettings,
          previewSettings,
        })
      : deploySettings;
  const derivedBindingRequirements = buildDerivedBindingRequirements(site, {
    deployProfile,
  });
  const productRuntimeContracts = getProductRuntimeContractsForSite(siteKey);
  const serverWorkers = buildServerWorkers(effectiveDeploySettings);
  const activeServerWorkerTargets = Object.keys(serverWorkers);
  const stateMigrationTag = `${effectiveDeploySettings.workers.state}-v${effectiveDeploySettings.state.schemaVersion}`;
  const appUrl =
    deployProfile === 'preview'
      ? buildPreviewRouterOrigin(siteKey, processEnv)
      : site.brand.appUrl;
  const appOrigin = new URL(appUrl).origin;
  const routeMode =
    deployProfile === 'preview'
      ? ROUTE_MODE_WORKERS_DEV
      : ROUTE_MODE_CUSTOM_DOMAIN;

  const contract = {
    site,
    siteKey,
    deployProfile,
    appUrl,
    appOrigin,
    route: {
      mode: routeMode,
      pattern:
        deployProfile === 'preview' ? new URL(appUrl).hostname : site.domain,
      customDomain:
        routeMode === ROUTE_MODE_CUSTOM_DOMAIN ? ROUTE_CUSTOM_DOMAIN : false,
    },
    bindingRequirements: {
      ...effectiveDeploySettings.bindingRequirements,
      secrets: {
        ...effectiveDeploySettings.bindingRequirements.secrets,
        ...derivedBindingRequirements.secrets,
      },
      payment: derivedBindingRequirements.payment,
    },
    workers: effectiveDeploySettings.workers,
    resources: effectiveDeploySettings.resources,
    state: effectiveDeploySettings.state,
    productRuntimeContracts,
    router: {
      slot: CLOUDFLARE_ROUTER_SLOT,
      workerName: effectiveDeploySettings.workers.router,
      workerEntryRelativePath: CLOUDFLARE_ROUTER_WORKER.workerEntryRelativePath,
      wranglerConfigRelativePath:
        CLOUDFLARE_ROUTER_WORKER.wranglerConfigRelativePath,
      serviceBindings: {
        WORKER_SELF_REFERENCE: effectiveDeploySettings.workers.router,
        ...Object.fromEntries(
          activeServerWorkerTargets.map((target) => [
            CLOUDFLARE_SERVICE_BINDINGS[target],
            effectiveDeploySettings.workers[target],
          ])
        ),
      },
      versionVars: Object.fromEntries(
        activeServerWorkerTargets.map((target) => [
          CLOUDFLARE_VERSION_ID_VARS[target],
          '',
        ])
      ),
      workerNameVars: Object.fromEntries(
        activeServerWorkerTargets.map((target) => {
          const metadata = getServerWorkerMetadata(target);
          return [
            metadata.workerNameVar,
            effectiveDeploySettings.workers[target],
          ];
        })
      ),
      durableObjects: Object.fromEntries(
        Object.entries(CLOUDFLARE_DURABLE_OBJECT_BINDINGS).map(
          ([bindingName, className]) => [
            bindingName,
            {
              className,
              scriptName: effectiveDeploySettings.workers.state,
            },
          ]
        )
      ),
    },
    stateWorker: {
      slot: CLOUDFLARE_STATE_SLOT,
      workerName: effectiveDeploySettings.workers.state,
      workerEntryRelativePath: CLOUDFLARE_STATE_WORKER.workerEntryRelativePath,
      wranglerConfigRelativePath:
        CLOUDFLARE_STATE_WORKER.wranglerConfigRelativePath,
      durableObjects: Object.fromEntries(
        Object.entries(CLOUDFLARE_DURABLE_OBJECT_BINDINGS).map(
          ([bindingName, className]) => [bindingName, { className }]
        )
      ),
      migrations: {
        tag: stateMigrationTag,
        newSqliteClasses: Object.values(CLOUDFLARE_DURABLE_OBJECT_BINDINGS),
      },
    },
    serverWorkers,
  };

  for (const productRuntimeContract of productRuntimeContracts) {
    assertProductRuntimeContract({
      contract: productRuntimeContract,
      target: {
        siteKey,
        workers: contract.workers,
        bindingRequirements: contract.bindingRequirements,
      },
    });
  }

  return {
    ...contract,
    topologySignature: buildTopologySignature(contract),
  };
}

export function listSiteKeys({ rootDir = process.cwd() } = {}) {
  return readdirSync(`${rootDir}/sites`, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      const siteDir = `${rootDir}/sites/${entry.name}`;
      return (
        existsSync(`${siteDir}/site.config.json`) &&
        existsSync(`${siteDir}/deploy.settings.json`)
      );
    })
    .map((entry) => entry.name)
    .sort();
}

export function resolveSiteDeployContract({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
  deployProfile,
  processEnv = process.env,
} = {}) {
  const resolvedDeployProfile =
    deployProfile ?? resolveCloudflareDeployProfile(processEnv);
  const site = readCurrentSiteConfig({ rootDir, siteKey });
  const deploySettings = readSiteDeploySettings({ rootDir, siteKey });
  const previewSettings =
    resolvedDeployProfile === 'preview' && requiresHyperdrive(deploySettings)
      ? readSitePreviewDeploySettings({ rootDir, siteKey })
      : null;
  return resolveSiteDeployContractFromSources({
    site,
    siteKey,
    deploySettings,
    deployProfile: resolvedDeployProfile,
    previewSettings,
    processEnv,
  });
}

export function resolveAllSiteDeployContracts({
  rootDir = process.cwd(),
  deployProfile = 'production',
  processEnv = process.env,
} = {}) {
  const siteKeys = listSiteKeys({ rootDir });
  const contracts = siteKeys.map((siteKey) =>
    resolveSiteDeployContract({
      rootDir,
      siteKey,
      deployProfile,
      processEnv,
    })
  );
  assertUniqueSiteRoutePatterns(contracts);
  return contracts;
}

export function createCanonicalTypegenContract(contract) {
  return resolveSiteDeployContractFromSources({
    siteKey: contract.siteKey,
    site: {
      ...contract.site,
      domain: 'typegen.example.com',
      brand: {
        ...contract.site.brand,
        appUrl: 'https://typegen.example.com',
      },
    },
    deploySettings: {
      bindingRequirements: contract.bindingRequirements,
      configVersion: 1,
      workers: Object.fromEntries(
        CLOUDFLARE_WORKER_SLOT_KEYS.map((slot) => [
          slot,
          `cloudflare-typegen-${slot}`,
        ])
      ),
      resources: {
        incrementalCacheBucket: 'cloudflare-typegen-opennext-cache',
        appStorageBucket: 'cloudflare-typegen-storage',
        hyperdriveId: '00000000000000000000000000000001',
      },
      state: {
        schemaVersion: 1,
      },
    },
  });
}
