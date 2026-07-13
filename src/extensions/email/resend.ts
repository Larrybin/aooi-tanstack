import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import { Resend, type CreateEmailOptions } from 'resend';

import type {
  EmailConfigs,
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from '.';

const log = createUseCaseLogger({
  domain: 'email',
  useCase: 'send-email',
});

/**
 * Resend email provider configs
 * @docs https://resend.com/docs/api-reference/emails/send-email
 */
export interface ResendConfigs extends EmailConfigs {
  apiKey: string;
  defaultFrom?: string;
}

/**
 * Resend email provider implementation
 * @website https://resend.com/
 */
export class ResendProvider implements EmailProvider {
  readonly name = 'resend';
  configs: ResendConfigs;

  private client: Resend;

  constructor(configs: ResendConfigs) {
    this.configs = configs;
    this.client = new Resend(configs.apiKey);
  }

  async sendEmail(email: EmailMessage): Promise<EmailSendResult> {
    try {
      const from = email.from || this.configs.defaultFrom || '';
      if (!from.trim()) {
        log.error('resend sendEmail failed', {
          operation: 'validate-sender',
          provider: this.name,
          error: 'sender address not configured',
        });
        return {
          success: false,
          error: 'sender address not configured',
          provider: this.name,
        };
      }

      // Convert our format to Resend format
      const resendEmail: Partial<CreateEmailOptions> = {
        from,
        to: Array.isArray(email.to) ? email.to : [email.to],
        subject: email.subject,
      };

      // Add optional fields only if they exist
      if (email.cc) {
        resendEmail.cc = Array.isArray(email.cc) ? email.cc : [email.cc];
      }
      if (email.bcc) {
        resendEmail.bcc = Array.isArray(email.bcc) ? email.bcc : [email.bcc];
      }
      if (email.text) {
        resendEmail.text = email.text;
      }
      if (email.html) {
        resendEmail.html = email.html;
      }
      if (email.replyTo) {
        resendEmail.replyTo = email.replyTo;
      }
      if (email.attachments) {
        resendEmail.attachments = email.attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          content_type: att.contentType,
        }));
      }
      if (email.tags) {
        resendEmail.tags = email.tags.map((tag) => ({
          name: 'category',
          value: tag,
        }));
      }
      if (email.headers) {
        resendEmail.headers = email.headers;
      }

      if (email.react) {
        log.debug('resend email react payload', {
          operation: 'build-email-payload',
          provider: this.name,
          hasReact: true,
        });
        resendEmail.react = email.react;
      }

      const result = await this.client.emails.send(
        resendEmail as CreateEmailOptions
      );

      log.debug('resend email result', {
        operation: 'send-provider-email',
        provider: this.name,
        success: !result.error,
        messageId: result.data?.id,
        error: result.error?.message,
      });

      if (result.error) {
        log.error('resend sendEmail failed', {
          operation: 'send-provider-email',
          provider: this.name,
          error: result.error.message,
        });
        return {
          success: false,
          error: result.error.message,
          provider: this.name,
        };
      }

      return {
        success: true,
        messageId: result.data?.id,
        provider: this.name,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error('resend sendEmail threw', {
        operation: 'send-provider-email',
        provider: this.name,
        error: errorMessage,
      });
      return {
        success: false,
        error: errorMessage || 'Unknown error',
        provider: this.name,
      };
    }
  }
}
