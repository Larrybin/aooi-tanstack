
import type { EmailMessage } from '@/extensions/email';

/**
 * Server-only 邮件模板（Content Pipeline）。
 *
 * 约定：仅负责生成 email payload（例如 `react`），不决定 `to/subject` 等编排字段；
 * 入口（Route Handler / Server Service）负责组装并调用发送服务。
 */
function VerificationCodeEmail(props: { code: string }) {
  const { code } = props;
  return (
    <div>
      <h1>Verification Code</h1>
      <p style={{ color: 'red' }}>Your verification code is: {code}</p>
    </div>
  );
}

export function buildVerificationCodeEmailPayload(input: {
  code: string;
}): Pick<EmailMessage, 'react'> {
  return {
    react: <VerificationCodeEmail code={input.code} />,
  };
}
