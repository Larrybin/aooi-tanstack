export type AiUiMessageValue =
  | string
  | number
  | boolean
  | null
  | AiUiMessageValue[]
  | { [key: string]: AiUiMessageValue };

export type AiUiMessages = { [key: string]: AiUiMessageValue };

export function createAiTranslator(messages: AiUiMessages) {
  return (key: string, values?: Record<string, string | number>) => {
    const template = getMessage(messages, key) ?? key;
    if (!values) return template;

    return template.replace(/\{(\w+)\}/g, (match, name) =>
      values[name] === undefined ? match : String(values[name])
    );
  };
}

function getMessage(messages: AiUiMessages, key: string) {
  let current: unknown = messages;

  for (const segment of key.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === 'string' ? current : undefined;
}
