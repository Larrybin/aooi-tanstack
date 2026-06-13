'use client';

import { useState } from 'react';
import type { AuthUiRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { requestPasswordReset } from '@/infra/platform/auth/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { defaultLocale } from '@/config/locale';
import { toErrorMessage } from '@/shared/lib/errors';

import type { AuthSignCopy } from './auth-route.types';

export function ForgotPasswordForm({
  authSettings,
  copy,
  locale,
  resetPasswordBaseUrl,
}: {
  authSettings: AuthUiRuntimeSettings;
  copy: AuthSignCopy;
  locale: string;
  resetPasswordBaseUrl: string;
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async () => {
    if (loading) {
      return;
    }

    if (!email) {
      toast.error(copy.email_required);
      return;
    }

    try {
      setLoading(true);
      await requestPasswordReset({
        email,
        redirectTo: resetPasswordBaseUrl,
      });
      toast.success(copy.forgot_password_sent);
    } catch (e: unknown) {
      toast.error(toErrorMessage(e) || copy.request_password_reset_failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <header className="auth-card-header">
        <h2>{copy.forgot_password_title}</h2>
        <p>{copy.forgot_password_description}</p>
      </header>

      <div className="auth-card-body">
        {!authSettings.emailAuthEnabled ? (
          <p className="auth-muted">{copy.forgot_password_disabled}</p>
        ) : (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleRequestReset();
            }}
          >
            <label>
              <span>{copy.email_title}</span>
              <input
                name="email"
                type="email"
                placeholder={copy.email_placeholder}
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              />
            </label>

            <button
              type="submit"
              className="auth-primary-button"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="auth-spin" /> : null}
              <span>{copy.forgot_password_submit}</span>
            </button>
          </form>
        )}
      </div>

      <footer className="auth-card-footer">
        <a href={localizeHref('/sign-in', locale)}>{copy.back_to_sign_in}</a>
      </footer>
    </div>
  );
}

function localizeHref(href: string, locale: string) {
  if (locale === defaultLocale) {
    return href;
  }

  return href.startsWith('/') ? `/${locale}${href}` : href;
}
