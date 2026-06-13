'use client';

import { useState } from 'react';
import type { AuthUiRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { resetPassword } from '@/infra/platform/auth/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { defaultLocale } from '@/config/locale';
import { toErrorMessage } from '@/shared/lib/errors';

import type { AuthSignCopy } from './auth-route.types';

export function ResetPasswordForm({
  authSettings,
  copy,
  error,
  locale,
  token,
}: {
  authSettings: AuthUiRuntimeSettings;
  copy: AuthSignCopy;
  error?: string;
  locale: string;
  token?: string;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const showInvalidToken = error === 'INVALID_TOKEN';
  const showMissingToken = !token && !showInvalidToken;

  const handleReset = async () => {
    if (loading || !authSettings.emailAuthEnabled || !token) {
      return;
    }

    if (!newPassword) {
      toast.error(copy.new_password_required);
      return;
    }

    if (!confirmPassword) {
      toast.error(copy.confirm_password_required);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(copy.password_mismatch);
      return;
    }

    try {
      setLoading(true);
      await resetPassword({
        token,
        newPassword,
      });
      toast.success(copy.reset_password_success);
      window.location.assign(localizeHref('/sign-in', locale));
    } catch (e: unknown) {
      toast.error(toErrorMessage(e) || copy.reset_password_failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <header className="auth-card-header">
        <h2>{copy.reset_password_title}</h2>
        <p>{copy.reset_password_description}</p>
      </header>

      <div className="auth-card-body">
        {!authSettings.emailAuthEnabled ? (
          <p className="auth-muted">{copy.reset_password_disabled}</p>
        ) : showInvalidToken ? (
          <p className="auth-muted">{copy.invalid_reset_token}</p>
        ) : showMissingToken ? (
          <p className="auth-muted">{copy.missing_reset_token}</p>
        ) : (
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleReset();
            }}
          >
            <label>
              <span>{copy.new_password_title}</span>
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder={copy.new_password_placeholder}
                required
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                }}
              />
            </label>

            <label>
              <span>{copy.confirm_password_title}</span>
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder={copy.confirm_password_placeholder}
                required
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                }}
              />
            </label>

            <button
              type="submit"
              className="auth-primary-button"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="auth-spin" /> : null}
              <span>{copy.reset_password_submit}</span>
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
