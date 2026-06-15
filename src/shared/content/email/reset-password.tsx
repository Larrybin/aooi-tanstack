
import type { EmailMessage } from '@/extensions/email';

function ResetPasswordEmail(props: { url: string }) {
  const { url } = props;
  return (
    <div>
      <h1>Reset password</h1>
      <p>Click the link below to reset your password:</p>
      <p>
        <a href={url}>{url}</a>
      </p>
      <p>If you did not request a password reset, you can ignore this email.</p>
    </div>
  );
}

export function buildResetPasswordEmailPayload(input: {
  url: string;
}): Pick<EmailMessage, 'react' | 'text'> {
  return {
    react: <ResetPasswordEmail url={input.url} />,
    text: `Reset your password: ${input.url}\n\nIf you did not request a password reset, you can ignore this email.`,
  };
}
