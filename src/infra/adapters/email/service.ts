import 'server-only';

import {
  readEmailRuntimeBindings,
  readEmailRuntimeSettingsCached,
} from '@/domains/settings/application/settings-runtime.query';

export {
  createEmailService,
  type EmailService,
} from './service-builder';
import { createEmailService, type EmailService } from './service-builder';

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
