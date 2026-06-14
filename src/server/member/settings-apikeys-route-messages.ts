type Messages = Record<string, unknown>;

const baseMessagesLocale = 'en';

export type SettingsApiKeysRouteMessages = {
  apikeys: Messages;
  sidebar: Messages;
};

export async function loadSettingsApiKeysRouteMessages(
  locale: string
): Promise<SettingsApiKeysRouteMessages | null> {
  const [baseApiKeys, baseSidebar] = await Promise.all([
    importMessages('settings/apikeys', baseMessagesLocale),
    importMessages('settings/sidebar', baseMessagesLocale),
  ]);

  if (locale === baseMessagesLocale) {
    return {
      apikeys: baseApiKeys,
      sidebar: baseSidebar,
    };
  }

  const [localizedApiKeys, localizedSidebar] = await Promise.all([
    importMessagesOptional('settings/apikeys', locale),
    importMessagesOptional('settings/sidebar', locale),
  ]);

  return {
    apikeys: localizedApiKeys
      ? (mergeDeep(baseApiKeys, localizedApiKeys) as Messages)
      : baseApiKeys,
    sidebar: localizedSidebar
      ? (mergeDeep(baseSidebar, localizedSidebar) as Messages)
      : baseSidebar,
  };
}

async function importMessages(path: string, locale: string): Promise<Messages> {
  const messages = await import(
    `@/config/locale/messages/${locale}/${path}.json`
  );

  return messages.default;
}

async function importMessagesOptional(path: string, locale: string) {
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
