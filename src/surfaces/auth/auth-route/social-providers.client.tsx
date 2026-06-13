'use client';

import type { ReactNode } from 'react';
import type { AuthUiRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { signIn, withAuthJsonRequest } from '@/infra/platform/auth/client';
import { normalizeSocialAuthorizationUrl } from '@/infra/platform/auth/social-authorization-url';
import { RiGithubFill, RiGoogleFill } from 'react-icons/ri';
import { toast } from 'sonner';

import { defaultLocale } from '@/config/locale';
import {
  normalizeCallbackUrl,
  withCallbackUrl,
} from '@/shared/lib/callback-url';
import { localizeCallbackUrl } from '@/shared/lib/localize-callback-url';
import type { AuthErrorContext } from '@/shared/types/auth-callback';

import type { AuthSignCopy } from './auth-route.types';

type SocialProvider = {
  name: string;
  title: string;
  icon: ReactNode;
};

export function SocialProviders({
  authSettings,
  callbackUrl,
  copy,
  locale,
  loading,
  setLoading,
}: {
  authSettings: AuthUiRuntimeSettings;
  callbackUrl: string;
  copy: AuthSignCopy;
  locale: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const safeCallbackUrl = normalizeCallbackUrl(callbackUrl);
  const localizedCallbackUrl = localizeCallbackUrl({
    callbackUrl: safeCallbackUrl,
    locale,
    defaultLocale,
  });
  const localizedErrorCallbackUrl = localizeCallbackUrl({
    callbackUrl: withCallbackUrl('/sign-in', safeCallbackUrl),
    locale,
    defaultLocale,
  });

  const handleSignIn = async (provider: string) => {
    const result = await signIn.social(
      {
        provider,
        callbackURL: localizedCallbackUrl,
        errorCallbackURL: localizedErrorCallbackUrl,
        disableRedirect: true,
      },
      withAuthJsonRequest({
        onRequest: () => {
          setLoading(true);
        },
        onResponse: () => {
          setLoading(false);
        },
        onError: (ctx: AuthErrorContext) => {
          toast.error(ctx.error?.message || copy.sign_in_failed);
          setLoading(false);
        },
      })
    );

    if (result.error) {
      return;
    }

    const authorizationUrl = result.data?.url;
    if (!authorizationUrl) {
      toast.error(copy.sign_in_failed);
      return;
    }

    window.location.assign(
      normalizeSocialAuthorizationUrl({
        authorizationUrl,
        provider,
        runtimeOrigin: window.location.origin,
      })
    );
  };

  const providers: SocialProvider[] = [];

  if (authSettings.googleAuthEnabled) {
    providers.push({
      name: 'google',
      title: copy.google_sign_in_title,
      icon: <RiGoogleFill aria-hidden="true" />,
    });
  }

  if (authSettings.githubAuthEnabled) {
    providers.push({
      name: 'github',
      title: copy.github_sign_in_title,
      icon: <RiGithubFill aria-hidden="true" />,
    });
  }

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="auth-social-providers">
      {providers.map((provider) => (
        <button
          key={provider.name}
          type="button"
          className="auth-outline-button"
          data-testid={`auth-social-${provider.name}`}
          disabled={loading}
          onClick={() => {
            void handleSignIn(provider.name);
          }}
        >
          {provider.icon}
          <span>{provider.title}</span>
        </button>
      ))}
    </div>
  );
}
