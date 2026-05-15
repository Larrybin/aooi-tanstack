import { AUTH_RUNTIME_SETTING_KEYS } from '@/domains/settings/registry';

import type { AuthUiRuntimeSettings } from './settings-runtime.contracts';
import type { Configs } from './settings-store';

export type AuthUiWorkerDiagnosticsSnapshot = {
  role: 'auth-ui';
  workerTarget: string;
  cached: AuthUiRuntimeSettings;
  fresh: AuthUiRuntimeSettings;
  googleClientIdPresent: boolean;
  googleButtonRenderable: boolean;
  githubButtonRenderable: boolean;
  googleOneTapRenderable: boolean;
};

export type AuthHandlerWorkerDiagnosticsSnapshot = {
  role: 'auth-handler';
  workerTarget: string;
  googleCredentialsReady: boolean;
  githubCredentialsReady: boolean;
};

export type AuthRuntimeDiagnostics = {
  settings: {
    googleAuthRequested: boolean;
    githubAuthRequested: boolean;
    googleOneTapRequested: boolean;
  };
  authUiWorker: AuthUiWorkerDiagnosticsSnapshot;
  authHandlerWorker: AuthHandlerWorkerDiagnosticsSnapshot;
  summary: {
    status:
      | 'ready'
      | 'settings-disabled'
      | 'cached-stale'
      | 'one-tap-bindings-missing'
      | 'handler-bindings-missing';
    title: string;
    description: string;
  };
};

function readRequestedFlag(configs: Configs, key: string, fallback = false) {
  const value = configs[key];
  if (value === undefined) {
    return fallback;
  }
  return value === 'true';
}

export function buildAuthRuntimeDiagnostics({
  freshConfigs,
  authUiWorker,
  authHandlerWorker,
}: {
  freshConfigs: Configs;
  authUiWorker: AuthUiWorkerDiagnosticsSnapshot;
  authHandlerWorker: AuthHandlerWorkerDiagnosticsSnapshot;
}): AuthRuntimeDiagnostics {
  const settings = {
    googleAuthRequested: readRequestedFlag(
      freshConfigs,
      AUTH_RUNTIME_SETTING_KEYS.googleAuthEnabled
    ),
    githubAuthRequested: readRequestedFlag(
      freshConfigs,
      AUTH_RUNTIME_SETTING_KEYS.githubAuthEnabled
    ),
    googleOneTapRequested: readRequestedFlag(
      freshConfigs,
      AUTH_RUNTIME_SETTING_KEYS.googleOneTapEnabled
    ),
  };

  const googleCachedStale =
    authUiWorker.cached.googleAuthEnabled !==
    authUiWorker.fresh.googleAuthEnabled;
  const githubCachedStale =
    authUiWorker.cached.githubAuthEnabled !==
    authUiWorker.fresh.githubAuthEnabled;
  const oneTapCachedStale =
    authUiWorker.cached.googleOneTapEnabled !==
    authUiWorker.fresh.googleOneTapEnabled;

  let summary: AuthRuntimeDiagnostics['summary'];
  if (
    !settings.googleAuthRequested &&
    !settings.githubAuthRequested &&
    !settings.googleOneTapRequested
  ) {
    summary = {
      status: 'settings-disabled',
      title: 'OAuth providers are disabled in settings',
      description:
        'Neither Google nor GitHub auth is enabled in the current settings, so the auth UI should not render social login buttons.',
    };
  } else if (
    (settings.googleAuthRequested &&
      !authHandlerWorker.googleCredentialsReady) ||
    (settings.githubAuthRequested && !authHandlerWorker.githubCredentialsReady)
  ) {
    summary = {
      status: 'handler-bindings-missing',
      title: 'OAuth handler bindings are incomplete',
      description:
        'The auth handler worker does not have all provider credentials required to complete the enabled OAuth flows.',
    };
  } else if (
    settings.googleOneTapRequested &&
    !authUiWorker.googleClientIdPresent
  ) {
    summary = {
      status: 'one-tap-bindings-missing',
      title: 'Google One Tap is unavailable on the auth UI worker',
      description:
        'The auth UI worker is missing GOOGLE_CLIENT_ID, so Google One Tap cannot initialize even though Google auth itself is enabled.',
    };
  } else if (googleCachedStale || githubCachedStale || oneTapCachedStale) {
    summary = {
      status: 'cached-stale',
      title: 'Cached auth UI runtime is stale',
      description:
        'Fresh settings are ready, but the cached auth UI projection used by sign-in surfaces has not caught up yet.',
    };
  } else {
    summary = {
      status: 'ready',
      title: 'Auth runtime contract is aligned',
      description:
        'The auth UI worker and auth handler worker agree with the current settings, so social auth should render and complete successfully.',
    };
  }

  return {
    settings,
    authUiWorker,
    authHandlerWorker,
    summary,
  };
}
