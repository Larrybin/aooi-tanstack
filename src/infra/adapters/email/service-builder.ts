import type { EmailRuntimeBindings, EmailRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import type { EmailMessage, EmailSendResult } from '@/extensions/email';
import { ResendProvider } from '@/extensions/email/providers';

import { assertEmailCapabilityContract } from './contract';

export type EmailService = {
  sendEmail(email: EmailMessage): Promise<EmailSendResult>;
};

export function createEmailService(input: {
  settings: EmailRuntimeSettings;
  bindings: EmailRuntimeBindings;
}): EmailService {
  const contract = assertEmailCapabilityContract(input);
  const provider = new ResendProvider({
    apiKey: contract.resendApiKey,
    defaultFrom: contract.resendSenderEmail,
  });

  return {
    async sendEmail(email) {
      return await provider.sendEmail(email);
    },
  };
}
