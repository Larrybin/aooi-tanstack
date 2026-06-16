import type { ReactNode } from 'react';

/**
 * Email attachment interface
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

/**
 * Email message interface
 */
export interface EmailMessage {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
  tags?: string[];
  headers?: Record<string, string>;
  react?: ReactNode;
}

/**
 * Email send result interface
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

/**
 * Email configs interface
 */
export interface EmailConfigs {
  [key: string]: unknown;
}

/**
 * Email provider interface
 */
export interface EmailProvider {
  // provider name
  readonly name: string;

  // provider configs
  configs: EmailConfigs;

  // send email
  sendEmail(email: EmailMessage): Promise<EmailSendResult>;
}
