import type {
  LocalizedLandingMessages,
  LocalizedPricingMessages,
} from '@/domains/pricing/application/pricing-page-content';

type Messages = Record<string, unknown>;
type PricingMessagesLocale = string;

const baseMessagesLocale = 'en';

export async function loadPricingPageMessages(
  locale: PricingMessagesLocale
): Promise<{
  localizedPricingMessages: LocalizedPricingMessages;
  localizedLandingMessages: LocalizedLandingMessages;
}> {
  return {
    localizedPricingMessages: (await loadMergedMessagesForPath(
      locale,
      'pricing'
    )) as LocalizedPricingMessages,
    localizedLandingMessages: (await loadMergedMessagesForPath(
      locale,
      'landing'
    )) as LocalizedLandingMessages,
  };
}

async function loadMergedMessagesForPath(
  locale: PricingMessagesLocale,
  path: string
) {
  const baseMessages = await importMessages(path, baseMessagesLocale);

  if (locale === baseMessagesLocale) {
    return baseMessages;
  }

  const localizedMessages = await importMessagesOptional(path, locale);
  return localizedMessages
    ? (mergeDeep(baseMessages, localizedMessages) as Messages)
    : baseMessages;
}

async function importMessages(
  path: string,
  locale: PricingMessagesLocale
): Promise<Messages> {
  const messages = await import(
    `@/config/locale/messages/${locale}/${path}.json`
  );

  return messages.default;
}

async function importMessagesOptional(
  path: string,
  locale: PricingMessagesLocale
) {
  try {
    return await importMessages(path, locale);
  } catch (error) {
    if (isMissingModuleError(error)) {
      return undefined;
    }

    throw error;
  }
}

function isMissingModuleError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error !== undefined
        ? String(error)
        : '';

  return (
    message.includes('Cannot find package') ||
    message.includes('Cannot find module') ||
    message.includes('Module not found') ||
    message.includes("Can't resolve")
  );
}

function mergeDeep(base: unknown, override: unknown): unknown {
  if (override === undefined) {
    return base;
  }

  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };

    for (const [key, value] of Object.entries(override)) {
      result[key] = mergeDeep(result[key], value);
    }

    return result;
  }

  return override;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
