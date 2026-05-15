// data: RBAC-gated user + settings schema + configs (unstable_cache tags) + Server Action writes
// cache: no-store (request-bound auth); configs cached via unstable_cache (tag=db-configs, 60s) / (tag=public-configs, 3600s)
// reason: admin settings are user-specific; settings-store owns cache invalidation
import { notFound } from 'next/navigation';
import { requireAllPagePermissions } from '@/app/[locale]/(admin)/_guards/page-access';
import {
  requireActionPermissions,
  requireActionUser,
} from '@/app/access-control/action-guard';
import {
  buildAuthRuntimeDiagnostics,
  type AuthHandlerWorkerDiagnosticsSnapshot,
  type AuthUiWorkerDiagnosticsSnapshot,
} from '@/domains/settings/application/auth-runtime-diagnostics';
import { buildAuthUiRuntimeSettings } from '@/domains/settings/application/settings-runtime.builders';
import { readAuthUiRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';
import {
  readSettingsFresh,
  readSettingsSafe,
  saveSettings,
} from '@/domains/settings/application/settings-store';
import { mapSettingsToForms } from '@/domains/settings/settings-form-mapper';
import { normalizeSettingOverrides } from '@/domains/settings/settings-normalizers';
import { mergeRegisteredSettingValues } from '@/domains/settings/settings-submit-merge';
import {
  getAvailableSettingTabs,
  getSettingGroups,
  getSettings,
} from '@/domains/settings/site-aware';
import { isSettingTabName } from '@/domains/settings/tab-names';
import { getSettingTabs } from '@/domains/settings/tabs';
import { getAuthServerBindings } from '@/infra/platform/auth/server-bindings';
import {
  getCloudflareBindings,
  getRuntimeEnvString,
  type CloudflareBindings,
} from '@/infra/runtime/env.server';
import { getSettingsModuleContractRows } from '@/surfaces/admin/settings/module-contract';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';

import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import {
  AUTH_RUNTIME_DIAGNOSTICS_PATH,
  AUTH_RUNTIME_DIAGNOSTICS_SECRET_HEADER,
  type AuthHandlerWorkerBindingsSnapshot,
  type AuthUiWorkerBindingsSnapshot,
} from '@/shared/config/auth-runtime-diagnostics';
import {
  AUTH_HANDLER_WORKER_TARGETS,
  AUTH_UI_WORKER_TARGETS,
  CLOUDFLARE_SERVICE_BINDINGS,
  type CloudflareServerWorkerTarget,
} from '@/shared/config/cloudflare-worker-splits';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { parseFormData } from '@/shared/lib/action/form';
import { actionErr, actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import type { Crumb } from '@/shared/types/blocks/common';

const SETTINGS_FORM_VALUES_SCHEMA = z.record(z.string(), z.string());

function getAuthDiagnosticsSecret() {
  return (
    getRuntimeEnvString('BETTER_AUTH_SECRET')?.trim() ||
    getRuntimeEnvString('AUTH_SECRET')?.trim() ||
    ''
  );
}

function getServiceBindingFetcher(
  bindings: CloudflareBindings | null,
  target: CloudflareServerWorkerTarget
) {
  const bindingName = CLOUDFLARE_SERVICE_BINDINGS[target];
  const value = bindings?.[bindingName];
  return value && typeof value === 'object' && 'fetch' in value
    ? (value as Fetcher)
    : null;
}

async function fetchWorkerSnapshot<T>({
  bindings,
  target,
}: {
  bindings: CloudflareBindings | null;
  target: CloudflareServerWorkerTarget;
}) {
  const fetcher = getServiceBindingFetcher(bindings, target);
  const secret = getAuthDiagnosticsSecret();
  if (!fetcher || !secret) {
    return null;
  }

  const response = await fetcher.fetch(
    `https://${target}${AUTH_RUNTIME_DIAGNOSTICS_PATH}`,
    {
      headers: {
        [AUTH_RUNTIME_DIAGNOSTICS_SECRET_HEADER]: secret,
      },
    }
  );
  if (!response.ok) {
    throw new Error(
      `failed to read auth runtime diagnostics from ${target}: ${response.status}`
    );
  }

  return (await response.json()) as T;
}

function buildFallbackAuthUiWorkerBindingsSnapshot(
  workerTarget: CloudflareServerWorkerTarget
): AuthUiWorkerBindingsSnapshot {
  const runtimeBindings = getAuthServerBindings();
  return {
    role: 'auth-ui',
    workerTarget,
    googleClientIdPresent: runtimeBindings.googleClientId.trim().length > 0,
  };
}

function buildFallbackAuthHandlerWorkerBindingsSnapshot(
  workerTarget: CloudflareServerWorkerTarget
): AuthHandlerWorkerBindingsSnapshot {
  const runtimeBindings = getAuthServerBindings();
  return {
    role: 'auth-handler',
    workerTarget,
    googleClientIdPresent: runtimeBindings.googleClientId.trim().length > 0,
    googleClientSecretPresent:
      runtimeBindings.googleClientSecret.trim().length > 0,
    githubClientIdPresent: runtimeBindings.githubClientId.trim().length > 0,
    githubClientSecretPresent:
      runtimeBindings.githubClientSecret.trim().length > 0,
  };
}

async function readAuthUiWorkerDiagnosticsSnapshot(
  freshConfigs: Record<string, string>
) {
  const workerTarget = AUTH_UI_WORKER_TARGETS[0];
  const bindings = getCloudflareBindings();
  const fetched = await fetchWorkerSnapshot<AuthUiWorkerBindingsSnapshot>({
    bindings,
    target: workerTarget,
  });
  const workerBindings =
    fetched ?? buildFallbackAuthUiWorkerBindingsSnapshot(workerTarget);
  const cached = await readAuthUiRuntimeSettingsCached();
  const fresh = buildAuthUiRuntimeSettings(freshConfigs, {
    googleClientId: workerBindings.googleClientIdPresent
      ? 'google-client-id'
      : '',
    googleClientSecret: '',
    githubClientId: '',
    githubClientSecret: '',
  });

  return {
    role: 'auth-ui',
    workerTarget,
    cached,
    fresh,
    googleClientIdPresent: workerBindings.googleClientIdPresent,
    googleButtonRenderable: cached.googleAuthEnabled,
    githubButtonRenderable: cached.githubAuthEnabled,
    googleOneTapRenderable:
      cached.googleAuthEnabled &&
      cached.googleOneTapEnabled &&
      cached.googleClientId.trim().length > 0,
  } satisfies AuthUiWorkerDiagnosticsSnapshot;
}

async function readAuthHandlerWorkerDiagnosticsSnapshot() {
  const workerTarget = AUTH_HANDLER_WORKER_TARGETS[0];
  const bindings = getCloudflareBindings();
  const fetched = await fetchWorkerSnapshot<AuthHandlerWorkerBindingsSnapshot>({
    bindings,
    target: workerTarget,
  });
  const workerBindings =
    fetched ?? buildFallbackAuthHandlerWorkerBindingsSnapshot(workerTarget);
  return {
    role: 'auth-handler',
    workerTarget,
    googleCredentialsReady:
      workerBindings.googleClientIdPresent &&
      workerBindings.googleClientSecretPresent,
    githubCredentialsReady:
      workerBindings.githubClientIdPresent &&
      workerBindings.githubClientSecretPresent,
  } satisfies AuthHandlerWorkerDiagnosticsSnapshot;
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string; tab: string }>;
}) {
  const { locale, tab } = await params;
  setRequestLocale(locale);

  if (!isSettingTabName(tab)) {
    notFound();
  }

  const settingsTab = tab;
  const availableTabs = await getAvailableSettingTabs();
  if (!availableTabs.includes(settingsTab)) {
    notFound();
  }

  // Check if user has permission to read settings
  await requireAllPagePermissions({
    codes: [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_WRITE],
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const { configs, error: configsError } = await readSettingsSafe();

  const settingGroups = await getSettingGroups();
  const settings = await getSettings();

  const t = await getTranslations('admin.settings');

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.settings'), is_active: true },
  ];

  const tabs = await getSettingTabs({
    activeTab: settingsTab,
    availableTabs,
  });
  const hasConfigsError = Boolean(configsError);
  const moduleContractRows = getSettingsModuleContractRows(settingsTab);
  const freshConfigs =
    settingsTab === 'auth' && !hasConfigsError
      ? await readSettingsFresh()
      : null;
  const authRuntimeDiagnostics = freshConfigs
    ? buildAuthRuntimeDiagnostics({
        freshConfigs,
        authUiWorker: await readAuthUiWorkerDiagnosticsSnapshot(freshConfigs),
        authHandlerWorker: await readAuthHandlerWorkerDiagnosticsSnapshot(),
      })
    : null;
  const handleSubmit = async (data: FormData) => {
    'use server';

    return withAction(async () => {
      const user = await requireActionUser();
      await requireActionPermissions(
        user.id,
        PERMISSIONS.SETTINGS_READ,
        PERMISSIONS.SETTINGS_WRITE
      );

      if (hasConfigsError) {
        return actionErr(
          'Settings could not be saved because configuration values failed to load. Please try again later.'
        );
      }

      const values = parseFormData(data, SETTINGS_FORM_VALUES_SCHEMA);
      const normalizedOverrides = normalizeSettingOverrides(values);
      if (!normalizedOverrides.ok) {
        return actionErr(normalizedOverrides.error);
      }

      const nextConfigs = mergeRegisteredSettingValues({
        initialConfigs: configs,
        values,
        normalizedOverrides: normalizedOverrides.value,
      });

      await saveSettings(nextConfigs);

      return actionOk('Settings updated');
    });
  };

  const forms = mapSettingsToForms({
    tab: settingsTab,
    groups: settingGroups,
    settings,
    configs,
    submitLabel: t('edit.buttons.submit'),
    onSubmit: handleSubmit,
  });

  const loadErrorTitle = t('edit.errors.load_failed_title');
  const loadErrorDesc = t('edit.errors.load_failed_desc');

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        {configsError && (
          <div className="border-destructive bg-destructive/10 text-destructive mb-4 rounded-md border p-3 text-sm">
            <p className="font-semibold">{loadErrorTitle}</p>
            <p className="text-destructive/80 mt-1 text-xs">{loadErrorDesc}</p>
          </div>
        )}
        <MainHeader title={t('edit.title')} tabs={tabs} />
        {moduleContractRows.length > 0 ? (
          <div
            className="bg-card mb-6 rounded-lg border p-4"
            data-testid="admin-settings-module-contract"
          >
            <div className="flex flex-col gap-3">
              {moduleContractRows.map((moduleContract) => (
                <div
                  key={`${moduleContract.relationship}-${moduleContract.moduleId}`}
                  className="flex flex-wrap items-center gap-4 rounded-md border p-3"
                  data-testid="admin-settings-module-contract-row"
                  data-module-id={moduleContract.moduleId}
                  data-relationship={moduleContract.relationship}
                  data-tier={moduleContract.tier}
                  data-verification={moduleContract.verification}
                >
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-title"
                  >
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {t('edit.module_contract.title_label')}
                    </span>
                    <span className="text-sm font-medium">
                      {moduleContract.title}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-relationship"
                  >
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {t('edit.module_contract.relationship_label')}
                    </span>
                    <Badge variant="secondary">
                      {t(
                        `edit.module_contract.relationship_values.${moduleContract.relationship}`
                      )}
                    </Badge>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-tier"
                  >
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {t('edit.module_contract.tier_label')}
                    </span>
                    <Badge variant="secondary">
                      {t(
                        `edit.module_contract.tier_values.${moduleContract.tier}`
                      )}
                    </Badge>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-verification"
                  >
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {t('edit.module_contract.verification_label')}
                    </span>
                    <Badge variant="outline">
                      {t(
                        `edit.module_contract.verification_values.${moduleContract.verification}`
                      )}
                    </Badge>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid="admin-settings-module-contract-guide"
                  >
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {t('edit.module_contract.guide_label')}
                    </span>
                    <a
                      href={moduleContract.guideHref}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary text-sm underline underline-offset-4"
                      data-testid="admin-settings-module-contract-guide-link"
                    >
                      {t('edit.module_contract.guide_cta')}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {forms.map((form) => (
          <div key={form.title} data-testid="admin-settings-form-shell">
            <FormCard
              title={form.title}
              description={form.description}
              form={form}
              className="mb-8 md:max-w-xl"
            />
          </div>
        ))}
        {authRuntimeDiagnostics ? (
          <div
            className="bg-card mb-8 max-w-4xl rounded-lg border p-6"
            data-testid="admin-auth-runtime-diagnostics"
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Auth Runtime Diagnostics
                </h2>
                <p className="text-muted-foreground text-sm">
                  This compares the cached auth projection used by
                  <code className="bg-muted mx-1 rounded px-1 py-0.5 text-xs">
                    /sign-in
                  </code>
                  with the current auth UI worker and auth handler worker
                  contract.
                </p>
              </div>
              <Badge
                variant={
                  authRuntimeDiagnostics.summary.status === 'ready'
                    ? 'secondary'
                    : authRuntimeDiagnostics.summary.status === 'cached-stale'
                      ? 'outline'
                      : 'destructive'
                }
              >
                {authRuntimeDiagnostics.summary.title}
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              {authRuntimeDiagnostics.summary.description}
            </p>
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-medium">Settings view</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Check</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>google_auth_enabled</TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.settings.googleAuthRequested
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>github_auth_enabled</TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.settings.githubAuthRequested
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>google_one_tap_enabled</TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.settings.googleOneTapRequested
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">
                  Auth UI worker:{' '}
                  {authRuntimeDiagnostics.authUiWorker.workerTarget}
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Check</TableHead>
                      <TableHead>Cached</TableHead>
                      <TableHead>Fresh</TableHead>
                      <TableHead>Worker binding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>google button renderable</TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.authUiWorker
                            .googleButtonRenderable
                        )}
                      </TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.authUiWorker.fresh
                            .googleAuthEnabled
                        )}
                      </TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>github button renderable</TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.authUiWorker
                            .githubButtonRenderable
                        )}
                      </TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.authUiWorker.fresh
                            .githubAuthEnabled
                        )}
                      </TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>google one tap renderable</TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.authUiWorker.cached
                            .googleOneTapEnabled
                        )}
                      </TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.authUiWorker.fresh
                            .googleOneTapEnabled
                        )}
                      </TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.authUiWorker
                            .googleClientIdPresent
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">
                  Auth handler worker:{' '}
                  {authRuntimeDiagnostics.authHandlerWorker.workerTarget}
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Check</TableHead>
                      <TableHead>Ready</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>google credentials ready</TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.authHandlerWorker
                            .googleCredentialsReady
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>github credentials ready</TableCell>
                      <TableCell>
                        {String(
                          authRuntimeDiagnostics.authHandlerWorker
                            .githubCredentialsReady
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : null}
      </Main>
    </>
  );
}
