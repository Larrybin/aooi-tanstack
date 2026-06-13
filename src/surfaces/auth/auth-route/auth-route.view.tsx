import { useEffect } from 'react';

import { isRtlLocale } from '@/config/locale';

import type { AuthRouteData } from './auth-route.types';
import { AuthShellView } from './auth-shell.view';
import { ForgotPasswordForm } from './forgot-password-form.client';
import { ResetPasswordForm } from './reset-password-form.client';
import { SignInForm } from './sign-in-form.client';
import { SignUpForm } from './sign-up-form.client';

export function AuthRouteView({ data }: { data: AuthRouteData }) {
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  return (
    <AuthShellView shell={data.shell}>{renderAuthRoute(data)}</AuthShellView>
  );
}

function renderAuthRoute(data: AuthRouteData) {
  switch (data.mode) {
    case 'sign-in':
      return (
        <SignInForm
          authSettings={data.authSettings}
          callbackUrl={data.search.callbackUrl || '/'}
          copy={data.copy.sign}
          locale={data.locale}
        />
      );
    case 'sign-up':
      return (
        <SignUpForm
          authSettings={data.authSettings}
          publicUiConfig={data.publicUiConfig}
          callbackUrl={data.search.callbackUrl || '/'}
          copy={data.copy.sign}
          locale={data.locale}
        />
      );
    case 'forgot-password':
      return (
        <ForgotPasswordForm
          authSettings={data.authSettings}
          copy={data.copy.sign}
          locale={data.locale}
          resetPasswordBaseUrl={data.resetPasswordBaseUrl}
        />
      );
    case 'reset-password':
      return (
        <ResetPasswordForm
          authSettings={data.authSettings}
          copy={data.copy.sign}
          error={data.search.error}
          locale={data.locale}
          token={data.search.token}
        />
      );
    case 'no-permission':
      return (
        <div
          className="auth-card auth-no-permission"
          data-testid="no-permission-page"
        >
          <h2>{data.copy.accessDenied}</h2>
        </div>
      );
  }
}
