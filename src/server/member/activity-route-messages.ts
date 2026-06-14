type Messages = Record<string, unknown>;

const baseMessagesLocale = 'en';

export type ActivityRouteMessages = {
  sidebar: Messages;
  aiTasks: Messages;
  chats: Messages;
};

export async function loadActivityRouteMessages(
  locale: string
): Promise<ActivityRouteMessages> {
  const [baseSidebar, baseAiTasks, baseChats] = await Promise.all([
    importMessages('activity/sidebar', baseMessagesLocale),
    importMessages('activity/ai-tasks', baseMessagesLocale),
    importMessages('activity/chats', baseMessagesLocale),
  ]);

  if (locale === baseMessagesLocale) {
    return {
      sidebar: baseSidebar,
      aiTasks: baseAiTasks,
      chats: baseChats,
    };
  }

  const [localizedSidebar, localizedAiTasks, localizedChats] =
    await Promise.all([
      importMessagesOptional('activity/sidebar', locale),
      importMessagesOptional('activity/ai-tasks', locale),
      importMessagesOptional('activity/chats', locale),
    ]);

  return {
    sidebar: localizedSidebar
      ? (mergeDeep(baseSidebar, localizedSidebar) as Messages)
      : baseSidebar,
    aiTasks: localizedAiTasks
      ? (mergeDeep(baseAiTasks, localizedAiTasks) as Messages)
      : baseAiTasks,
    chats: localizedChats
      ? (mergeDeep(baseChats, localizedChats) as Messages)
      : baseChats,
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
