type Messages = Record<string, unknown>;

const baseMessagesLocale = 'en';

export type SettingsBillingRouteMessages = {
  billing: Messages;
  sidebar: Messages;
};

export async function loadSettingsBillingRouteMessages(
  locale: string
): Promise<SettingsBillingRouteMessages | null> {
  const [baseBilling, baseSidebar] = await Promise.all([
    importMessages('settings/billing', baseMessagesLocale),
    importMessages('settings/sidebar', baseMessagesLocale),
  ]);

  if (locale === baseMessagesLocale) {
    return {
      billing: baseBilling,
      sidebar: baseSidebar,
    };
  }

  const [localizedBilling, localizedSidebar] = await Promise.all([
    importMessagesOptional('settings/billing', locale),
    importMessagesOptional('settings/sidebar', locale),
  ]);

  return {
    billing: localizedBilling
      ? (mergeDeep(baseBilling, localizedBilling) as Messages)
      : baseBilling,
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
