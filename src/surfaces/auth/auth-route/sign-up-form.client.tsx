'use client';

import { useState, useSyncExternalStore } from 'react';
import type { AuthUiRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { signUp, withAuthJsonRequest } from '@/infra/platform/auth/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { defaultLocale } from '@/config/locale';
import { normalizeCallbackUrl } from '@/shared/lib/callback-url';
import { toErrorMessage } from '@/shared/lib/errors';
import { localizeCallbackUrl } from '@/shared/lib/localize-callback-url';
import type { AuthErrorContext } from '@/shared/types/auth-callback';

import type {
  AuthSignCopy,
  SerializablePublicUiConfig,
} from './auth-route.types';
import { SocialProviders } from './social-providers.client';

function subscribeToHydration() {
  return () => undefined;
}

export function SignUpForm({
  authSettings,
  publicUiConfig,
  callbackUrl = '/',
  copy,
  locale,
}: {
  authSettings: AuthUiRuntimeSettings;
  publicUiConfig: SerializablePublicUiConfig;
  callbackUrl: string;
  copy: AuthSignCopy;
  locale: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const clientReady = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const safeCallbackUrl = normalizeCallbackUrl(callbackUrl);
  const localizedCallbackUrl = localizeCallbackUrl({
    callbackUrl: safeCallbackUrl,
    locale,
    defaultLocale,
  });

  const handleSignUp = async () => {
    if (loading) {
      return;
    }

    if (!name) {
      toast.error(copy.name_required);
      return;
    }

    if (!email) {
      toast.error(copy.email_required);
      return;
    }

    if (!password) {
      toast.error(copy.password_required);
      return;
    }

    try {
      await signUp.email(
        {
          email,
          password,
          name,
        },
        withAuthJsonRequest({
          onRequest: () => {
            setLoading(true);
          },
          onResponse: () => {
            setLoading(false);
          },
          onSuccess: () => {
            reportSignUpAffiliate({
              uiConfig: publicUiConfig,
              userEmail: email,
            });
            window.location.assign(localizedCallbackUrl);
          },
          onError: (ctx: AuthErrorContext) => {
            toast.error(ctx.error?.message || copy.sign_up_failed);
            setLoading(false);
          },
        })
      );
    } catch (e: unknown) {
      toast.error(toErrorMessage(e) || copy.sign_up_failed);
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <header className="auth-card-header">
        <h2>{copy.sign_up_title}</h2>
        <p>{copy.sign_up_description}</p>
        {safeCallbackUrl !== '/' ? (
          <span>{copy.return_to.replace('{path}', localizedCallbackUrl)}</span>
        ) : null}
      </header>

      <div className="auth-card-body">
        {authSettings.emailAuthEnabled ? (
          <form
            className="auth-form"
            data-auth-client-ready={clientReady ? 'true' : 'false'}
            data-testid="auth-sign-up-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSignUp();
            }}
          >
            <label>
              <span>{copy.name_title}</span>
              <input
                name="name"
                type="text"
                autoComplete="name"
                placeholder={copy.name_placeholder}
                required
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            </label>

            <label>
              <span>{copy.email_title}</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder={copy.email_placeholder}
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              />
            </label>

            <label>
              <span>{copy.password_title}</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder={copy.password_placeholder}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
              />
            </label>

            <button
              type="submit"
              className="auth-primary-button"
              disabled={!clientReady || loading}
              data-testid="auth-sign-up-submit"
            >
              {loading ? <Loader2 size={16} className="auth-spin" /> : null}
              <span>{copy.sign_up_title}</span>
            </button>
          </form>
        ) : null}

        <SocialProviders
          authSettings={authSettings}
          callbackUrl={safeCallbackUrl}
          copy={copy}
          locale={locale}
          loading={loading}
          setLoading={setLoading}
        />
      </div>
    </div>
  );
}

function reportSignUpAffiliate({
  uiConfig,
  userEmail,
}: {
  uiConfig: SerializablePublicUiConfig;
  userEmail: string;
}) {
  if (!userEmail || typeof window === 'undefined') {
    return;
  }

  if (uiConfig.affiliate.affonsoEnabled) {
    window.Affonso?.signup(userEmail);
  }

  if (uiConfig.affiliate.promotekitEnabled) {
    window.promotekit?.refer(userEmail);
  }
}
