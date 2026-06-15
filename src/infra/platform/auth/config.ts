
import type {
  AuthServerBindings,
  AuthUiRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';
import { db } from '@/infra/adapters/db';
import { getEmailService } from '@/infra/adapters/email/service';
import { isAuthSpikeOAuthUpstreamMockEnabled } from '@/infra/platform/auth/oauth-spike-config';
import {
  consumeResetPasswordQuota,
  releaseResetPasswordQuota,
} from '@/infra/platform/auth/reset-password-throttle';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import {
  getServerRuntimeEnv,
  isCloudflareWorkersRuntime,
  isRuntimeEnvEnabled,
} from '@/infra/runtime/env.server';
import { site } from '@/site';
import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oneTap } from 'better-auth/plugins';

import * as schema from '@/config/db/schema';
import { buildResetPasswordEmailPayload } from '@/shared/content/email/reset-password';
import { isProductionEnv } from '@/shared/lib/env';
import { getUuid } from '@/shared/lib/hash';

import { installAuthSpikeOAuthFetchMock } from './oauth-spike.mock';
import {
  buildTrustedAuthOrigins,
  isExplicitLocalAuthRuntimeEnabled,
  resolveRuntimeAuthBaseUrl,
} from './runtime-origin';
import { getAuthServerBindings } from './server-bindings';

const log = createUseCaseLogger({
  domain: 'auth',
  useCase: 'auth-config',
});

export type AuthConfigDeps = {
  readAuthUiRuntimeSettings?: () => Promise<AuthUiRuntimeSettings>;
  getAuthServerBindings?: () =>
    | AuthServerBindings
    | Promise<AuthServerBindings>;
};

async function readDefaultAuthUiRuntimeSettings(): Promise<AuthUiRuntimeSettings> {
  const { readAuthUiRuntimeSettingsCached } = await import(
    '@/domains/settings/application/settings-runtime.query'
  );
  return readAuthUiRuntimeSettingsCached();
}

function assertAuthEnv() {
  const isProduction = isProductionEnv();
  if (!isProduction) {
    return;
  }

  const runtimeEnv = getServerRuntimeEnv();

  if (!runtimeEnv.authSecret.trim()) {
    throw new Error(
      'BETTER_AUTH_SECRET or AUTH_SECRET is required in production for auth.'
    );
  }

  if (!runtimeEnv.databaseUrl.trim() && !isCloudflareWorkersRuntime()) {
    throw new Error(
      'DATABASE_URL is required in production for Better Auth database adapter.'
    );
  }
}

function getAuthRuntimeContext(request?: Request) {
  const runtimeEnv = getServerRuntimeEnv();
  const isProduction = isProductionEnv();
  const normalizedAuthBaseUrl = new URL(runtimeEnv.authBaseUrl).origin;
  const additionalAllowedAuthOrigins: string[] = [];
  const isAuthSpikeOAuthUpstreamMock = isAuthSpikeOAuthUpstreamMockEnabled();
  const runtimeBaseUrl = resolveRuntimeAuthBaseUrl({
    defaultBaseUrl: normalizedAuthBaseUrl,
    additionalAllowedOrigins: additionalAllowedAuthOrigins,
    preferRequestOrigin: isAuthSpikeOAuthUpstreamMock,
    request,
  });
  const runtimeTrustedOrigins = buildTrustedAuthOrigins({
    appUrl: normalizedAuthBaseUrl,
    additionalAllowedOrigins: additionalAllowedAuthOrigins,
    request,
    preferRequestOrigin: isAuthSpikeOAuthUpstreamMock,
  });

  return {
    runtimeEnv,
    isProduction,
    normalizedAuthBaseUrl,
    additionalAllowedAuthOrigins,
    isAuthSpikeOAuthUpstreamMock,
    runtimeBaseUrl,
    runtimeTrustedOrigins,
  };
}

function buildAuthOptionsBase(): BetterAuthOptions {
  const {
    runtimeEnv,
    isProduction,
    normalizedAuthBaseUrl,
    additionalAllowedAuthOrigins,
  } = getAuthRuntimeContext();

  return {
    appName: site.brand.appName,
    baseURL: normalizedAuthBaseUrl,
    secret: runtimeEnv.authSecret,
    trustedOrigins: buildTrustedAuthOrigins({
      appUrl: normalizedAuthBaseUrl,
      additionalAllowedOrigins: additionalAllowedAuthOrigins,
      preferRequestOrigin: isExplicitLocalAuthRuntimeEnabled(),
    }),
    advanced: {
      disableOriginCheck: isAuthSpikeOAuthUpstreamMockEnabled(),
      database: {
        generateId: () => getUuid(),
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    logger: {
      level: isProduction ? 'info' : 'debug',
      // Disable logs in production to reduce noise; keep debug in non-production
      disabled: isProduction && !isAuthSpikeOAuthUpstreamMockEnabled(),
    },
  };
}

export function getAuthOriginDebug(request?: Request) {
  const { runtimeBaseUrl, runtimeTrustedOrigins } =
    getAuthRuntimeContext(request);

  return {
    runtimeBaseUrl,
    runtimeTrustedOrigins,
    requestUrl: request?.url || null,
    requestOrigin: request?.headers.get('origin') || null,
    requestReferer: request?.headers.get('referer') || null,
    requestHost: request?.headers.get('host') || null,
    requestForwardedHost: request?.headers.get('x-forwarded-host') || null,
    requestForwardedProto: request?.headers.get('x-forwarded-proto') || null,
  };
}

type SendResetPasswordData = Parameters<
  NonNullable<
    NonNullable<BetterAuthOptions['emailAndPassword']>['sendResetPassword']
  >
>[0];

// Dynamic auth options - WITH database connection
// Only used in API routes that actually need database access
export async function getAuthOptions(
  request?: Request,
  deps: AuthConfigDeps = {}
): Promise<BetterAuthOptions> {
  installAuthSpikeOAuthFetchMock();
  assertAuthEnv();
  const baseAuthOptions = buildAuthOptionsBase();
  const authSettings = await (
    deps.readAuthUiRuntimeSettings ?? readDefaultAuthUiRuntimeSettings
  )();
  const authBindings = await (
    deps.getAuthServerBindings ?? getAuthServerBindings
  )();
  const { isProduction, isAuthSpikeOAuthUpstreamMock } =
    getAuthRuntimeContext(request);
  const isEmailAuthEnabled = authSettings.emailAuthEnabled;
  const { runtimeBaseUrl, runtimeTrustedOrigins } = getAuthOriginDebug(request);
  const appName = site.brand.appName.trim();
  const socialProviders = await getSocialProviders({
    settings: authSettings,
    bindings: authBindings,
    authBaseUrl: runtimeBaseUrl,
  });
  if (isRuntimeEnvEnabled('CF_LOCAL_AUTH_DEBUG')) {
    log.warn('[auth-debug] request origin resolution', {
      operation: 'resolve-request-origin',
      runtimeBaseUrl,
      runtimeTrustedOrigins,
      requestUrl: request?.url || null,
      requestOrigin: request?.headers.get('origin') || null,
      requestReferer: request?.headers.get('referer') || null,
      requestHost: request?.headers.get('host') || null,
      requestForwardedHost: request?.headers.get('x-forwarded-host') || null,
      requestForwardedProto: request?.headers.get('x-forwarded-proto') || null,
    });
  }
  if (isAuthSpikeOAuthUpstreamMock) {
    log.info('[auth-spike-oauth] runtime auth origin', {
      operation: 'resolve-request-origin',
      runtimeBaseUrl,
      runtimeTrustedOrigins,
      requestOrigin: request?.headers.get('origin') || null,
      requestReferer: request?.headers.get('referer') || null,
    });
  }
  return {
    ...baseAuthOptions,
    appName,
    baseURL: runtimeBaseUrl,
    trustedOrigins: async () => runtimeTrustedOrigins,
    // Add database connection only when actually needed (runtime)
    database: drizzleAdapter(db(), {
      provider: 'pg',
      schema: schema,
    }),
    emailAndPassword: isEmailAuthEnabled
      ? {
          enabled: true,
          sendResetPassword: async ({ user, url }: SendResetPasswordData) => {
            const email = user?.email?.trim().toLowerCase();
            if (!email) {
              return;
            }

            let quota: Awaited<ReturnType<typeof consumeResetPasswordQuota>>;
            try {
              quota = await consumeResetPasswordQuota(email);
            } catch (error: unknown) {
              log.error('[auth] sendResetPassword throttle check failed', {
                operation: 'send-reset-password',
                userId: user.id,
                error,
              });
              return;
            }

            if (!quota.allowed) {
              log.warn('[auth] sendResetPassword throttled', {
                operation: 'send-reset-password',
                userId: user.id,
                reason: quota.reason,
              });
              return;
            }

            try {
              const emailService = await getEmailService();
              const result = await emailService.sendEmail({
                to: email,
                subject: `${site.brand.appName} - Reset password`,
                ...buildResetPasswordEmailPayload({ url }),
              });

              if (!result.success) {
                log.error('[auth] sendResetPassword failed', {
                  operation: 'send-reset-password',
                  userId: user.id,
                  provider: result.provider,
                  error: result.error,
                });
                return;
              }

              if (!isProduction) {
                log.debug('[auth] sendResetPassword ok', {
                  operation: 'send-reset-password',
                  userId: user.id,
                  provider: result.provider,
                  messageId: result.messageId,
                });
              }
            } catch (error: unknown) {
              log.error('[auth] sendResetPassword threw', {
                operation: 'send-reset-password',
                userId: user.id,
                error,
              });
            } finally {
              await releaseResetPasswordQuota(quota.scopeKey).catch(
                (error: unknown) => {
                  log.error(
                    '[auth] sendResetPassword throttle release failed',
                    {
                      operation: 'send-reset-password',
                      userId: user.id,
                      error,
                    }
                  );
                }
              );
            }
          },
        }
      : { enabled: false },
    socialProviders,
    plugins:
      socialProviders.google && authSettings.googleOneTapEnabled
        ? [oneTap()]
        : [],
  };
}

function buildSocialProviderRedirectURI(authBaseUrl: string, provider: string) {
  return `${authBaseUrl.replace(/\/+$/, '')}/api/auth/callback/${provider}`;
}

export async function getSocialProviders({
  settings: authSettings,
  bindings,
  authBaseUrl,
}: {
  settings: AuthUiRuntimeSettings;
  bindings: AuthServerBindings;
  authBaseUrl: string;
}) {
  const providers: Record<
    string,
    { clientId: string; clientSecret: string; redirectURI: string }
  > = {};

  const googleEnabled = authSettings.googleAuthEnabled;
  const githubEnabled = authSettings.githubAuthEnabled;

  if (googleEnabled && bindings.googleClientId && bindings.googleClientSecret) {
    providers.google = {
      clientId: bindings.googleClientId,
      clientSecret: bindings.googleClientSecret,
      redirectURI: buildSocialProviderRedirectURI(authBaseUrl, 'google'),
    };
  }

  if (githubEnabled && bindings.githubClientId && bindings.githubClientSecret) {
    providers.github = {
      clientId: bindings.githubClientId,
      clientSecret: bindings.githubClientSecret,
      redirectURI: buildSocialProviderRedirectURI(authBaseUrl, 'github'),
    };
  }

  return providers;
}
