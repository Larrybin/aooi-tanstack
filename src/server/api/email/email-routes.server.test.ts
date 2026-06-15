import assert from 'node:assert/strict';
import test from 'node:test';

import type { EmailService } from '@/infra/adapters/email/service-builder';

import { createSendEmailPostHandler } from './send-email-route';
import { createEmailTestPostHandler } from './test-route';
import { createVerifyCodePostHandler } from './verify-code-route';

function createApiContext(body: unknown) {
  return () =>
    ({
      log: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      parseJson: async () => body,
      requireUser: async () => ({ id: 'user_1' }),
      requirePermission: async () => undefined,
    }) as never;
}

const emailService: EmailService = {
  sendEmail: async () => ({
    success: true,
    provider: 'resend',
    messageId: 'message_1',
  }),
};

const verificationPayload = async () => ({
  html: '<p>123456</p>',
  text: '123456',
});

test('send-email sends a verification email and returns provider result', async () => {
  const handler = createSendEmailPostHandler({
    getApiContext: createApiContext({
      emails: 'user@example.com',
      subject: 'Verify email',
    }),
    getEmailService: async () => emailService,
    persistSettingsEmailVerificationCode: async () => ({
      id: 'code_1',
      identifier: 'identifier_1',
    }),
    deleteEmailVerificationCodeById: async () => undefined,
    deleteEmailVerificationCodesByIdentifierExceptId: async () => undefined,
    buildVerificationCodeEmailPayload: verificationPayload,
    rateLimiter: {
      check: async () => ({ allowed: true }),
      consume: async () => 1,
      rollback: async () => undefined,
    },
    now: () => 1,
    randomInt: () => 123456,
  });

  const response = await handler(
    new Request('http://localhost/api/email/send-email', { method: 'POST' })
  );
  const body = (await response.json()) as {
    data: { success: boolean; provider: string; messageId?: string };
  };

  assert.equal(response.status, 200);
  assert.equal(body.data.success, true);
  assert.equal(body.data.provider, 'resend');
});

test('email/test sends a test verification email', async () => {
  const handler = createEmailTestPostHandler({
    getApiContext: createApiContext({
      emails: ['user@example.com'],
      subject: 'Test email',
    }),
    getEmailService: async () => emailService,
    buildVerificationCodeEmailPayload: verificationPayload,
    quotaLimiter: {
      acquire: async () => ({ allowed: true }),
      release: async () => undefined,
    },
    now: () => 1,
    randomInt: () => 123456,
  });

  const response = await handler(
    new Request('http://localhost/api/email/test', { method: 'POST' })
  );
  const body = (await response.json()) as {
    data: { success: boolean; provider: string };
  };

  assert.equal(response.status, 200);
  assert.equal(body.data.success, true);
  assert.equal(body.data.provider, 'resend');
});

test('email/verify-code consumes a valid code', async () => {
  const handler = createVerifyCodePostHandler({
    getApiContext: createApiContext({
      email: 'user@example.com',
      code: '123456',
    }),
    consumeSettingsEmailVerificationCode: async () => ({ ok: true }),
    attemptLimiter: {
      check: async () => ({ allowed: true }),
      recordFailure: async () => ({ attempts: 1 }),
      clear: async () => undefined,
    },
    now: () => 1,
  });

  const response = await handler(
    new Request('http://localhost/api/email/verify-code', { method: 'POST' })
  );
  const body = (await response.json()) as { data: { verified: boolean } };

  assert.equal(response.status, 200);
  assert.equal(body.data.verified, true);
});
