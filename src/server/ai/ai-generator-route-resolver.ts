import { isAiEnabled } from '@/domains/ai/domain/enablement';
import type { AiUiMessages } from '@/domains/ai/ui/i18n';
import { readBuildPublicUiConfig } from '@/domains/settings/application/settings-build.query';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { resolveLandingShellData } from '@/server/landing/landing-shell-data';
import type { SlugShellData } from '@/surfaces/landing/slug/slug.types';

import { defaultLocale } from '@/config/locale';
import { localePath, normalizeLocale } from '@/shared/i18n/locale';

type AiGeneratorKind = 'image' | 'music';
type Messages = Record<string, unknown>;

export type AiGeneratorRouteInput = {
  locale: string;
  kind: AiGeneratorKind;
};

export type AiGeneratorRouteData = {
  kind: AiGeneratorKind;
  locale: string;
  canonicalPath: string;
  shell: SlugShellData;
  page: {
    title: string;
    description: string;
  };
  generatorTitle: string;
  generatorMessages: AiUiMessages;
  head: {
    meta: Array<{ title?: string; name?: string; content?: string }>;
    links: Array<{ rel: string; href: string }>;
  };
};

type AiGeneratorRouteDeps = {
  readBuildPublicUiConfig: () => PublicUiConfig;
};

const defaultDeps: AiGeneratorRouteDeps = {
  readBuildPublicUiConfig,
};

export async function resolveAiGeneratorRouteData(
  input: AiGeneratorRouteInput,
  deps: AiGeneratorRouteDeps = defaultDeps
): Promise<AiGeneratorRouteData | null> {
  const locale = normalizeLocale(input.locale);
  if (!locale || !isAiEnabled(deps.readBuildPublicUiConfig())) {
    return null;
  }

  const messages = await loadAiGeneratorMessages(locale, input.kind);
  const pageTitle =
    getMessage(messages, 'page.title') ?? getFallbackTitle(input.kind);
  const pageDescription = getMessage(messages, 'page.description') ?? '';
  const generatorTitle =
    getMessage(messages, 'generator.title') ?? getFallbackTitle(input.kind);
  const canonicalPath = localizePath(`/${getRouteSlug(input.kind)}`, locale);

  return {
    kind: input.kind,
    locale,
    canonicalPath,
    shell: resolveLandingShellData(locale),
    page: {
      title: pageTitle,
      description: pageDescription,
    },
    generatorTitle,
    generatorMessages:
      input.kind === 'image'
        ? getMessagesObject(messages, 'generator')
        : (messages as AiUiMessages),
    head: {
      meta: [
        { title: getMessage(messages, 'metadata.title') ?? pageTitle },
        {
          name: 'description',
          content:
            getMessage(messages, 'metadata.description') ?? pageDescription,
        },
      ],
      links: [{ rel: 'canonical', href: canonicalPath }],
    },
  };
}

async function loadAiGeneratorMessages(locale: string, kind: AiGeneratorKind) {
  const path = `ai/${kind}`;
  const baseMessages = await importMessages(path, defaultLocale);
  if (locale === defaultLocale) return baseMessages;

  const localizedMessages = await importMessagesOptional(path, locale);
  return localizedMessages
    ? (mergeDeep(baseMessages, localizedMessages) as Messages)
    : baseMessages;
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
    if (isMissingModuleError(error)) return undefined;
    throw error;
  }
}

function getRouteSlug(kind: AiGeneratorKind) {
  return kind === 'image' ? 'ai-image-generator' : 'ai-music-generator';
}

function getFallbackTitle(kind: AiGeneratorKind) {
  return kind === 'image' ? 'AI Image Generator' : 'AI Music Generator';
}

function localizePath(path: string, locale: string) {
  return locale === defaultLocale ? path : localePath(path, locale);
}

function getMessagesObject(messages: Messages, key: string): AiUiMessages {
  const value = messages[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as AiUiMessages)
    : {};
}

function getMessage(messages: Messages, key: string) {
  let current: unknown = messages;

  for (const segment of key.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Messages)[segment];
  }

  return typeof current === 'string' ? current : undefined;
}

function mergeDeep(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;

  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Messages = { ...base };
    for (const [key, value] of Object.entries(override)) {
      result[key] = mergeDeep(result[key], value);
    }
    return result;
  }

  return override;
}

function isPlainObject(value: unknown): value is Messages {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingModuleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes('Cannot find package') ||
    message.includes('Cannot find module') ||
    message.includes('Module not found') ||
    message.includes("Can't resolve")
  );
}
