import { defaultLocale, locales, type Locale } from '@/config/locale';
import enAdminSettingsMessages from '@/config/locale/messages/en/admin/settings.json';
import enCommonMessages from '@/config/locale/messages/en/common.json';
import jaAdminSettingsMessages from '@/config/locale/messages/ja/admin/settings.json';
import jaCommonMessages from '@/config/locale/messages/ja/common.json';
import zhTwAdminSettingsMessages from '@/config/locale/messages/zh-TW/admin/settings.json';
import zhTwCommonMessages from '@/config/locale/messages/zh-TW/common.json';
import zhAdminSettingsMessages from '@/config/locale/messages/zh/admin/settings.json';
import zhCommonMessages from '@/config/locale/messages/zh/common.json';

type MessageLeafValue = string | number | boolean | null | undefined;
type MessageValues = Record<string, MessageLeafValue>;
type MessageNode = string | { readonly [key: string]: MessageNode };
type MessageBundle = Record<string, MessageNode>;

const messageBundles = {
  en: {
    common: enCommonMessages,
    'admin.settings': enAdminSettingsMessages,
  },
  ja: {
    common: jaCommonMessages,
    'admin.settings': jaAdminSettingsMessages,
  },
  zh: {
    common: zhCommonMessages,
    'admin.settings': zhAdminSettingsMessages,
  },
  'zh-TW': {
    common: zhTwCommonMessages,
    'admin.settings': zhTwAdminSettingsMessages,
  },
} satisfies Partial<Record<Locale, MessageBundle>>;

const namespaceRoots = ['admin.settings', 'common'] as const;

export function getRequestLocaleFallback(): Locale {
  return defaultLocale;
}

export function useLocale(): Locale {
  if (typeof globalThis.location === 'undefined') return defaultLocale;
  const firstSegment = globalThis.location.pathname
    .split('/')
    .filter(Boolean)[0];
  return locales.includes(firstSegment as Locale)
    ? (firstSegment as Locale)
    : defaultLocale;
}

function readMessagePath(root: MessageNode | undefined, path: readonly string[]) {
  let current = root;
  for (const part of path) {
    if (!current || typeof current === 'string') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolateMessage(message: string, values?: MessageValues) {
  if (!values) return message;
  return message.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined || value === null ? match : String(value);
  });
}

function resolveNamespace(namespace = '') {
  for (const root of namespaceRoots) {
    if (namespace === root) {
      return { root, prefix: [] as string[] };
    }
    if (namespace.startsWith(`${root}.`)) {
      return {
        root,
        prefix: namespace.slice(root.length + 1).split('.').filter(Boolean),
      };
    }
  }

  return {
    root: namespace,
    prefix: [] as string[],
  };
}

function resolveMessage(locale: Locale, namespace: string | undefined, key: string) {
  const { root, prefix } = resolveNamespace(namespace);
  const path = [...prefix, ...key.split('.').filter(Boolean)];
  const localeMessages = messageBundles[locale] ?? messageBundles[defaultLocale];
  const defaultMessages = messageBundles[defaultLocale];

  return (
    readMessagePath(localeMessages?.[root], path) ??
    readMessagePath(defaultMessages?.[root], path)
  );
}

export function createNativeTranslator(namespace?: string, locale: Locale = defaultLocale) {
  return (key: string, values?: MessageValues) => {
    const message = resolveMessage(locale, namespace, key);
    if (message) return interpolateMessage(message, values);
    return namespace ? `${namespace}.${key}` : key;
  };
}

export function useTranslations(namespace?: string) {
  return createNativeTranslator(namespace, useLocale());
}

export async function getTranslations(namespace?: string) {
  return createNativeTranslator(namespace, getRequestLocaleFallback());
}
