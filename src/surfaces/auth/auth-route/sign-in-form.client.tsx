'use client';

import { useState, useSyncExternalStore } from 'react';
import type { AuthUiRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { signIn, withAuthJsonRequest } from '@/infra/platform/auth/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { defaultLocale } from '@/config/locale';
import {
  normalizeCallbackUrl,
  withCallbackUrl,
} from '@/shared/lib/callback-url';
import { toErrorMessage } from '@/shared/lib/errors';
import { localizeCallbackUrl } from '@/shared/lib/localize-callback-url';
import type { AuthErrorContext } from '@/shared/types/auth-callback';

import type { AuthSignCopy } from './auth-route.types';
import { SocialProviders } from './social-providers.client';

function subscribeToHydration() {
  return () => undefined;
}

export function SignInForm({
  authSettings,
  callbackUrl = '/',
  copy,
  locale,
}: {
  authSettings: AuthUiRuntimeSettings;
  callbackUrl: string;
  copy: AuthSignCopy;
  locale: string;
}) {
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

  const handleSignIn = async () => {
    if (loading) {
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
      await signIn.email(
        {
          email,
          password,
          callbackURL: localizedCallbackUrl,
        },
        withAuthJsonRequest({
          onRequest: () => {
            setLoading(true);
          },
          onResponse: () => {
            setLoading(false);
          },
          onSuccess: () => {
            window.location.assign(localizedCallbackUrl);
          },
          onError: (ctx: AuthErrorContext) => {
            toast.error(ctx.error?.message || copy.sign_in_failed);
            setLoading(false);
          },
        })
      );
    } catch (e: unknown) {
      toast.error(toErrorMessage(e) || copy.sign_in_failed);
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <header className="auth-card-header">
        <h2>{copy.sign_in_title}</h2>
        <p>{copy.sign_in_description}</p>
        {safeCallbackUrl !== '/' ? (
          <span>{formatReturnTo(copy.return_to, localizedCallbackUrl)}</span>
        ) : null}
      </header>

      <div className="auth-card-body">
        {authSettings.emailAuthEnabled ? (
          <form
            className="auth-form"
            data-auth-client-ready={clientReady ? 'true' : 'false'}
            data-testid="auth-sign-in-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSignIn();
            }}
          >
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
              <span className="auth-label-row">
                <span>{copy.password_title}</span>
                <a href={localizeHref('/forgot-password', locale)}>
                  {copy.forgot_password}
                </a>
              </span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
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
              data-testid="auth-sign-in-submit"
            >
              {loading ? <Loader2 size={16} className="auth-spin" /> : null}
              <span>{copy.sign_in_title}</span>
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

      {authSettings.emailAuthEnabled ? (
        <footer className="auth-card-footer">
          <span>{copy.no_account}</span>
          <a
            href={localizeHref(
              withCallbackUrl('/sign-up', safeCallbackUrl),
              locale
            )}
          >
            {copy.sign_up_title}
          </a>
        </footer>
      ) : null}
    </div>
  );
}

function formatReturnTo(template: string, path: string) {
  return template.replace('{path}', path);
}

function localizeHref(href: string, locale: string) {
  if (locale === defaultLocale) {
    return href;
  }

  return href.startsWith('/') ? `/${locale}${href}` : href;
}
