import type { Locale } from '@/config/locale';
import { isCiEnv, isProductionEnv } from '@/shared/lib/env';

import { resolveMessagePath } from './messages.shared';

export { normalizeLocale } from './messages.shared';

type Messages = Record<string, unknown>;

const baseMessagesLocale: Locale = 'en';
const isDevOrCI = !isProductionEnv() || isCiEnv();
const shouldCacheMessages = !isDevOrCI;
const namespaceCache = new Map<string, Messages>();
const scopedMessagesCache = new Map<string, Messages>();
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createLoadError = (locale: Locale, path: string, cause?: unknown) => {
  const reason =
    cause instanceof Error
      ? cause.message
      : cause !== undefined
        ? String(cause)
        : undefined;
  const suffix = reason ? ` (reason: ${reason})` : '';
  return new Error(
    `[i18n] Failed to load messages for locale "${locale}" at "${path}"${suffix}`
  );
};

const importMessages = async (
  path: string,
  locale: Locale
): Promise<Messages> => {
  const messages = await import(
    `@/config/locale/messages/${locale}/${path}.json`
  );

  return messages.default;
};

const isMissingModuleError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : error !== undefined
        ? String(error)
        : '';

  return (
    message.includes('Cannot find module') ||
    message.includes('Module not found') ||
    message.includes("Can't resolve")
  );
};

const isStrictLocaleInDev = (locale: Locale): boolean =>
  isDevOrCI && (locale === 'en' || locale === 'zh' || locale === 'zh-TW');

const loadMessagesRequired = async (
  path: string,
  locale: Locale
): Promise<Messages> => {
  const cacheKey = `${locale}:${path}`;

  if (shouldCacheMessages && namespaceCache.has(cacheKey)) {
    return namespaceCache.get(cacheKey) as Messages;
  }

  try {
    const messages = await importMessages(path, locale);

    if (shouldCacheMessages) {
      namespaceCache.set(cacheKey, messages);
    }

    return messages;
  } catch (error) {
    throw createLoadError(locale, path, error);
  }
};

const loadMessagesOptional = async (
  path: string,
  locale: Locale
): Promise<Messages | undefined> => {
  try {
    return await loadMessagesRequired(path, locale);
  } catch (error) {
    if (isMissingModuleError(error) && !isStrictLocaleInDev(locale)) {
      return undefined;
    }

    throw createLoadError(locale, path, error);
  }
};

const mergeDeep = (base: unknown, override: unknown): unknown => {
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
};

const assignMessagesAtPath = (
  messages: Messages,
  messagePath: string,
  value: unknown
) => {
  const keys = messagePath.split('/');
  let current = messages;

  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const next = current[key];

    if (!isPlainObject(next)) {
      current[key] = {};
    }

    current = current[key] as Messages;
  }

  current[keys[keys.length - 1]] = value;
};

const readMessagesAtPath = (
  messages: Messages,
  relativePath: string
): unknown => {
  if (!relativePath) {
    return messages;
  }

  return relativePath
    .split('/')
    .filter(Boolean)
    .reduce<unknown>((current, key) => {
      if (!isPlainObject(current)) {
        return undefined;
      }

      return current[key];
    }, messages);
};

async function loadMergedMessagesForPath(
  locale: Locale,
  messagePath: string
): Promise<Messages> {
  const baseMessages = await loadMessagesRequired(
    messagePath,
    baseMessagesLocale
  );

  if (locale === baseMessagesLocale) {
    return baseMessages;
  }

  const localizedMessages = await loadMessagesOptional(messagePath, locale);

  return localizedMessages
    ? (mergeDeep(baseMessages, localizedMessages) as Messages)
    : baseMessages;
}

export async function getScopedMessages(
  locale: Locale,
  namespaces: string[]
): Promise<Messages> {
  const normalizedNamespaces = Array.from(
    new Set(namespaces.map((namespace) => namespace.replace(/\./g, '/')))
  );
  const messagePaths = Array.from(
    new Set(
      normalizedNamespaces.map((namespace) => resolveMessagePath(namespace))
    )
  );

  if (!messagePaths.length) {
    return {};
  }

  const cacheKey = `${locale}:${normalizedNamespaces.join('|')}`;
  if (shouldCacheMessages && scopedMessagesCache.has(cacheKey)) {
    return scopedMessagesCache.get(cacheKey) as Messages;
  }

  const loadedMessages = new Map(
    await Promise.all(
      messagePaths.map(async (messagePath) => [
        messagePath,
        await loadMergedMessagesForPath(locale, messagePath),
      ] as const)
    )
  );

  const segments = normalizedNamespaces.map((namespace) => {
    const messagePath = resolveMessagePath(namespace);
    const messages = loadedMessages.get(messagePath);
    const relativePath =
      namespace === messagePath && messages
        ? ''
        : namespace.slice(messagePath.length + 1);

    return {
      namespace,
      messages: messages
        ? readMessagesAtPath(messages, relativePath)
        : undefined,
    };
  });

  const scopedMessages: Messages = {};
  for (const segment of segments) {
    assignMessagesAtPath(scopedMessages, segment.namespace, segment.messages);
  }

  if (shouldCacheMessages) {
    scopedMessagesCache.set(cacheKey, scopedMessages);
  }

  return scopedMessages;
}
