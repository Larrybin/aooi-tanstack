import 'server-only';

import {
  readEmailRuntimeBindings,
  readEmailRuntimeSettingsCached,
} from '@/domains/settings/application/settings-runtime.query';

import type { EmailMessage, EmailSendResult } from '@/extensions/email';
import { ResendProvider } from '@/extensions/email/providers';

import { assertEmailCapabilityContract } from './contract';

export type EmailService = {
  sendEmail(email: EmailMessage): Promise<EmailSendResult>;
};

export function createEmailService(input: {
  settings: Awaited<ReturnType<typeof readEmailRuntimeSettingsCached>>;
  bindings: ReturnType<typeof readEmailRuntimeBindings>;
}) {
  const contract = assertEmailCapabilityContract(input);
  const provider = new ResendProvider({
    apiKey: contract.resendApiKey,
    defaultFrom: contract.resendSenderEmail,
  });

  return {
    async sendEmail(email) {
      return await provider.sendEmail(email);
    },
  } satisfies EmailService;
}

export async function getEmailService(): Promise<EmailService> {
  const [settings, bindings] = await Promise.all([
    readEmailRuntimeSettingsCached(),
    Promise.resolve(readEmailRuntimeBindings()),
  ]);

  return createEmailService({
    settings,
    bindings,
  });
}
