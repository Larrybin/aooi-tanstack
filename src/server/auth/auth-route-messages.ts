type Messages = Record<string, unknown>;

const baseMessagesLocale = 'en';

export type AuthRouteMessages = {
  metadata?: {
    title?: string;
    description?: string;
  };
  sign?: Record<string, unknown>;
  locale_switcher?: {
    aria_label?: string;
  };
};

export async function loadAuthRouteMessages(
  locale: string
): Promise<AuthRouteMessages | null> {
  const baseMessages = await importMessages(baseMessagesLocale);

  if (locale === baseMessagesLocale) {
    return baseMessages as AuthRouteMessages;
  }

  const localizedMessages = await importMessagesOptional(locale);
  if (!localizedMessages) {
    return null;
  }

  return mergeDeep(baseMessages, localizedMessages) as AuthRouteMessages;
}

async function importMessages(locale: string): Promise<Messages> {
  const messages = await import(
    `@/config/locale/messages/${locale}/common.json`
  );

  return messages.default;
}

async function importMessagesOptional(locale: string) {
  try {
    return await importMessages(locale);
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
