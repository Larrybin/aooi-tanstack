import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAuthRuntimeDiagnostics } from './auth-runtime-diagnostics';

test('auth runtime diagnostics: reports cached-stale when auth UI worker cached projection lags fresh settings', () => {
  const diagnostics = buildAuthRuntimeDiagnostics({
    freshConfigs: {
      google_auth_enabled: 'true',
      google_one_tap_enabled: 'false',
      github_auth_enabled: 'false',
    },
    authUiWorker: {
      role: 'auth-ui',
      workerTarget: 'public-web',
      cached: {
        emailAuthEnabled: true,
        googleAuthEnabled: false,
        googleOneTapEnabled: false,
        googleClientId: '',
        githubAuthEnabled: false,
      },
      fresh: {
        emailAuthEnabled: true,
        googleAuthEnabled: true,
        googleOneTapEnabled: false,
        googleClientId: '',
        githubAuthEnabled: false,
      },
      googleClientIdPresent: true,
      googleButtonRenderable: false,
      githubButtonRenderable: false,
      googleOneTapRenderable: false,
    },
    authHandlerWorker: {
      role: 'auth-handler',
      workerTarget: 'auth',
      googleCredentialsReady: true,
      githubCredentialsReady: true,
    },
  });

  assert.equal(diagnostics.summary.status, 'cached-stale');
});

test('auth runtime diagnostics: reports handler-bindings-missing when enabled provider lacks handler credentials', () => {
  const diagnostics = buildAuthRuntimeDiagnostics({
    freshConfigs: {
      google_auth_enabled: 'true',
      google_one_tap_enabled: 'false',
      github_auth_enabled: 'false',
    },
    authUiWorker: {
      role: 'auth-ui',
      workerTarget: 'public-web',
      cached: {
        emailAuthEnabled: true,
        googleAuthEnabled: true,
        googleOneTapEnabled: false,
        googleClientId: '',
        githubAuthEnabled: false,
      },
      fresh: {
        emailAuthEnabled: true,
        googleAuthEnabled: true,
        googleOneTapEnabled: false,
        googleClientId: '',
        githubAuthEnabled: false,
      },
      googleClientIdPresent: false,
      googleButtonRenderable: true,
      githubButtonRenderable: false,
      googleOneTapRenderable: false,
    },
    authHandlerWorker: {
      role: 'auth-handler',
      workerTarget: 'auth',
      googleCredentialsReady: false,
      githubCredentialsReady: true,
    },
  });

  assert.equal(diagnostics.summary.status, 'handler-bindings-missing');
});

test('auth runtime diagnostics: reports one-tap-bindings-missing when Google One Tap is enabled without UI client id', () => {
  const diagnostics = buildAuthRuntimeDiagnostics({
    freshConfigs: {
      google_auth_enabled: 'true',
      google_one_tap_enabled: 'true',
      github_auth_enabled: 'false',
    },
    authUiWorker: {
      role: 'auth-ui',
      workerTarget: 'public-web',
      cached: {
        emailAuthEnabled: true,
        googleAuthEnabled: true,
        googleOneTapEnabled: false,
        googleClientId: '',
        githubAuthEnabled: false,
      },
      fresh: {
        emailAuthEnabled: true,
        googleAuthEnabled: true,
        googleOneTapEnabled: false,
        googleClientId: '',
        githubAuthEnabled: false,
      },
      googleClientIdPresent: false,
      googleButtonRenderable: true,
      githubButtonRenderable: false,
      googleOneTapRenderable: false,
    },
    authHandlerWorker: {
      role: 'auth-handler',
      workerTarget: 'auth',
      googleCredentialsReady: true,
      githubCredentialsReady: true,
    },
  });

  assert.equal(diagnostics.summary.status, 'one-tap-bindings-missing');
});

test('auth runtime diagnostics: reports ready when UI worker, handler worker, and settings align', () => {
  const diagnostics = buildAuthRuntimeDiagnostics({
    freshConfigs: {
      google_auth_enabled: 'true',
      google_one_tap_enabled: 'true',
      github_auth_enabled: 'true',
    },
    authUiWorker: {
      role: 'auth-ui',
      workerTarget: 'public-web',
      cached: {
        emailAuthEnabled: false,
        googleAuthEnabled: true,
        googleOneTapEnabled: true,
        googleClientId: 'google-id',
        githubAuthEnabled: true,
      },
      fresh: {
        emailAuthEnabled: false,
        googleAuthEnabled: true,
        googleOneTapEnabled: true,
        googleClientId: 'google-id',
        githubAuthEnabled: true,
      },
      googleClientIdPresent: true,
      googleButtonRenderable: true,
      githubButtonRenderable: true,
      googleOneTapRenderable: true,
    },
    authHandlerWorker: {
      role: 'auth-handler',
      workerTarget: 'auth',
      googleCredentialsReady: true,
      githubCredentialsReady: true,
    },
  });

  assert.equal(diagnostics.summary.status, 'ready');
});
