import { defaultLocale } from '@/config/locale';
import { normalizeLocale } from '@/shared/i18n/locale';

type Messages = Record<string, unknown>;

export type MyImagesRouteCopy = {
  metadataTitle: string;
  metadataDescription: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  startButton: string;
  resultAlt: string;
  succeededTitle: string;
  jobTitle: string;
  statusLabel: string;
  createdLabel: string;
  expiresLabel: string;
  downloadLabel: string;
  deleteLabel: string;
  signInTitle: string;
  signInDescription: string;
  signInButton: string;
  createAccountButton: string;
  statuses: Record<string, string>;
};

export async function loadMyImagesRouteCopy(
  locale: string
): Promise<MyImagesRouteCopy> {
  const messages = await loadCommonMessages(locale);
  const myImages = getObject(messages, 'my_images');
  const statuses = getObject(myImages, 'statuses');

  return {
    metadataTitle: getString(myImages, 'metadata_title'),
    metadataDescription: getString(myImages, 'metadata_description'),
    title: getString(myImages, 'title'),
    description: getString(myImages, 'description'),
    emptyTitle: getString(myImages, 'empty_title'),
    emptyDescription: getString(myImages, 'empty_description'),
    startButton: getString(myImages, 'start_button'),
    resultAlt: getString(myImages, 'result_alt'),
    succeededTitle: getString(myImages, 'succeeded_title'),
    jobTitle: getString(myImages, 'job_title'),
    statusLabel: getString(myImages, 'status_label'),
    createdLabel: getString(myImages, 'created_label'),
    expiresLabel: getString(myImages, 'expires_label'),
    downloadLabel: getString(myImages, 'download_label'),
    deleteLabel: getString(myImages, 'delete_label'),
    signInTitle: getString(myImages, 'sign_in_title'),
    signInDescription: getString(myImages, 'sign_in_description'),
    signInButton: getString(myImages, 'sign_in_button'),
    createAccountButton: getString(myImages, 'create_account_button'),
    statuses: toStringRecord(statuses),
  };
}

async function loadCommonMessages(locale: string) {
  const normalizedLocale = normalizeLocale(locale) ?? defaultLocale;
  const baseMessages = await importMessages(defaultLocale);
  if (normalizedLocale === defaultLocale) return baseMessages;

  const localizedMessages = await importMessagesOptional(normalizedLocale);
  return localizedMessages
    ? (mergeDeep(baseMessages, localizedMessages) as Messages)
    : baseMessages;
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
    if (isMissingModuleError(error)) return undefined;
    throw error;
  }
}

function getObject(messages: Messages, key: string): Messages {
  const value = messages[key];
  return isPlainObject(value) ? value : {};
}

function getString(messages: Messages, key: string) {
  const value = messages[key];
  return typeof value === 'string' ? value : '';
}

function toStringRecord(messages: Messages) {
  return Object.fromEntries(
    Object.entries(messages).filter((entry): entry is [string, string] => {
      return typeof entry[1] === 'string';
    })
  );
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
